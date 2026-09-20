import crypto from 'crypto';
import { transaction, query } from '../db/connection/pool.js';
import { ordersRepo, type OrderRow } from '../db/repositories/orders.repository.js';
import { plansRepo } from '../db/repositories/plans.repository.js';
import { productsRepo } from '../db/repositories/products.repository.js';
import { decryptCredential } from '../utils/crypto.js';
import { auditRepo } from '../db/repositories/audit.repository.js';

export function calculateEndDate(startDateStr: string, duration: number, unit: string): string {
  // Normalize startDateStr: if it contains 'T', take just the YYYY-MM-DD part
  const cleanDateStr = startDateStr.split('T')[0];
  const [yearStr, monthStr, dayStr] = cleanDateStr.split('-');
  const year = parseInt(yearStr, 10);
  const month = parseInt(monthStr, 10) - 1; // 0-indexed month
  const day = parseInt(dayStr, 10);

  const end = new Date(Date.UTC(year, month, day));

  switch (unit) {
    case 'hours':
      end.setUTCHours(end.getUTCHours() + duration);
      break;
    case 'days':
      end.setUTCDate(end.getUTCDate() + duration);
      break;
    case 'weeks':
      end.setUTCDate(end.getUTCDate() + duration * 7);
      break;
    case 'months':
      end.setUTCMonth(end.getUTCMonth() + duration);
      break;
    case 'years':
      end.setUTCFullYear(end.getUTCFullYear() + duration);
      break;
    default:
      end.setUTCDate(end.getUTCDate() + duration);
  }

  return end.toISOString().split('T')[0];
}

export class OrderService {
  async createOrder(payload: {
    customer_id: string;
    product_id: string;
    plan_id: string;
    start_date?: string;
    custom_price?: number;
    custom_cost?: number;
    payment_method?: string;
    payment_status?: string;
    notes?: string;
    assigned_service_account_id?: string;
    assigned_profile_id?: string;
    assigned_license_key_id?: string;
    userId?: string;
  }): Promise<OrderRow> {
    const product = await productsRepo.findById(payload.product_id);
    if (!product) {
      const err = new Error('Product not found.');
      (err as any).statusCode = 404;
      throw err;
    }

    const plan = await plansRepo.findById(payload.plan_id);
    if (!plan) {
      const err = new Error('Plan not found.');
      (err as any).statusCode = 404;
      throw err;
    }

    const startDate = payload.start_date || new Date().toISOString().split('T')[0];
    const endDate = calculateEndDate(startDate, plan.duration, plan.duration_unit);
    const orderId = 'ord-' + crypto.randomUUID().slice(0, 8);
    const orderNumber = 'ORD-' + Math.floor(100000 + Math.random() * 900000);

    const price = payload.custom_price !== undefined ? payload.custom_price : Number(plan.price);
    const cost = payload.custom_cost !== undefined ? payload.custom_cost : Number(plan.cost);

    // Execute order creation & stock allocation inside a managed PostgreSQL transaction
    return await transaction<OrderRow>(async (client) => {
      let assignedAccountId = payload.assigned_service_account_id || null;
      let assignedProfileId = payload.assigned_profile_id || null;
      let assignedLicenseKeyId = payload.assigned_license_key_id || null;
      const fulfillmentData: Record<string, any> = {};

      if (product.fulfillment_type === 'service_account') {
        if (!assignedProfileId) {
          // Find and lock available profile (explicitly locking only the profile row)
          const profileRes = await client.query<{ id: string; service_account_id: string; profile_name: string; pin: string }>(
            `SELECT sp.id, sp.service_account_id, sp.profile_name, sp.pin
             FROM service_profiles sp
             JOIN service_accounts sa ON sa.id = sp.service_account_id
             WHERE sa.product_id = $1 AND sa.status = 'active' AND sp.status = 'available'
             LIMIT 1
             FOR UPDATE OF sp SKIP LOCKED`,
            [product.id]
          );

          if (profileRes.rows.length === 0) {
            // Self-healing: if an active account exists for this product with capacity not yet created as profiles, create next profile
            const unalloc = await client.query<{ id: string; capacity: number; count: string }>(
              `SELECT sa.id, sa.capacity, COUNT(sp.id)::int as count
               FROM service_accounts sa
               LEFT JOIN service_profiles sp ON sp.service_account_id = sa.id
               WHERE sa.product_id = $1 AND sa.status = 'active'
               GROUP BY sa.id, sa.capacity
               HAVING COUNT(sp.id) < sa.capacity
               LIMIT 1
               FOR UPDATE OF sa`,
              [product.id]
            );

            if (unalloc.rows[0]) {
              const acc = unalloc.rows[0];
              const nextNum = Number(acc.count) + 1;
              const newProfId = 'prof-' + crypto.randomUUID().slice(0, 8);
              const insRes = await client.query<{ id: string; service_account_id: string; profile_name: string; pin: string }>(
                `INSERT INTO service_profiles (id, service_account_id, profile_name, status, created_at)
                 VALUES ($1, $2, $3, 'available', CURRENT_TIMESTAMP)
                 RETURNING id, service_account_id, profile_name, pin`,
                [newProfId, acc.id, `Profile ${nextNum}`]
              );
              profileRes.rows.push(insRes.rows[0]);
            }
          }

          if (profileRes.rows.length === 0) {
            const err = new Error('Out of stock: No available profiles for this service account product.');
            (err as any).statusCode = 400;
            throw err;
          }

          assignedProfileId = profileRes.rows[0].id;
          assignedAccountId = profileRes.rows[0].service_account_id;
        } else {
          // Atomically lock and verify availability of requested profile
          const profCheck = await client.query<{ id: string; service_account_id: string; status: string }>(
            'SELECT id, service_account_id, status FROM service_profiles WHERE id = $1 FOR UPDATE',
            [assignedProfileId]
          );
          if (!profCheck.rows[0] || profCheck.rows[0].status !== 'available') {
            const err = new Error('The selected service profile is not available.');
            (err as any).statusCode = 400;
            throw err;
          }
          assignedAccountId = profCheck.rows[0].service_account_id;
        }

        // Fetch account credentials for fulfillment receipt
        const accRes = await client.query<{ login: string; encrypted_credential: string; iv: string; tag: string }>(
          'SELECT login, encrypted_credential, iv, tag FROM service_accounts WHERE id = $1',
          [assignedAccountId]
        );

        const profRes = await client.query<{ profile_name: string; pin: string }>(
          'SELECT profile_name, pin FROM service_profiles WHERE id = $1',
          [assignedProfileId]
        );

        if (accRes.rows[0]) {
          const decPass = decryptCredential(accRes.rows[0].encrypted_credential, accRes.rows[0].iv, accRes.rows[0].tag);
          fulfillmentData.login = accRes.rows[0].login;
          fulfillmentData.password = decPass;
          fulfillmentData.profile_name = profRes.rows[0]?.profile_name;
          fulfillmentData.pin = profRes.rows[0]?.pin;
        }

        // Assign profile
        await client.query(
          `UPDATE service_profiles
           SET status = 'assigned', assigned_customer_id = $1, assigned_order_id = $2
           WHERE id = $3`,
          [payload.customer_id, orderId, assignedProfileId]
        );
      } else if (product.fulfillment_type === 'license_key') {
        if (!assignedLicenseKeyId) {
          const licRes = await client.query<{ id: string; license_key: string }>(
            `SELECT id, license_key FROM license_keys
             WHERE product_id = $1 AND status = 'available'
             LIMIT 1
             FOR UPDATE SKIP LOCKED`,
            [product.id]
          );

          if (licRes.rows.length === 0) {
            const err = new Error('Out of stock: No available license keys for this product.');
            (err as any).statusCode = 400;
            throw err;
          }

          assignedLicenseKeyId = licRes.rows[0].id;
          fulfillmentData.license_key = licRes.rows[0].license_key;
        } else {
          // Atomically lock and verify availability of requested license key
          const licCheck = await client.query<{ id: string; status: string; license_key: string }>(
            'SELECT id, status, license_key FROM license_keys WHERE id = $1 FOR UPDATE',
            [assignedLicenseKeyId]
          );
          if (!licCheck.rows[0] || licCheck.rows[0].status !== 'available') {
            const err = new Error('The selected license key is not available.');
            (err as any).statusCode = 400;
            throw err;
          }
          fulfillmentData.license_key = licCheck.rows[0].license_key;
        }

        await client.query(
          `UPDATE license_keys
           SET status = 'assigned', assigned_customer_id = $1, assigned_order_id = $2
           WHERE id = $3`,
          [payload.customer_id, orderId, assignedLicenseKeyId]
        );
      }

      // Insert Order
      const orderRes = await client.query<OrderRow>(
        `INSERT INTO orders (
           id, order_number, customer_id, product_id, plan_id, status,
           start_date, end_date, price, cost, currency, payment_status,
           payment_method, fulfillment_type, assigned_service_account_id,
           assigned_profile_id, assigned_license_key_id, fulfillment_data,
           renewal_count, created_by_user_id, created_at
         ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14, $15, $16, $17, $18, 0, $19, CURRENT_TIMESTAMP)
         RETURNING *`,
        [
          orderId, orderNumber, payload.customer_id, product.id, plan.id,
          'active', startDate, endDate, price, cost, plan.currency || 'USD',
          payload.payment_status || 'paid', payload.payment_method || 'cash',
          product.fulfillment_type, assignedAccountId, assignedProfileId,
          assignedLicenseKeyId, JSON.stringify(fulfillmentData), payload.userId || null
        ]
      );

      // Return fully joined order so receipt and notifications have customer_name, product_name, and plan_name
      const fullOrderRes = await client.query<OrderRow>(
        `SELECT o.*,
                c.name as customer_name, c.email as customer_email, c.whatsapp as customer_whatsapp,
                p.name as product_name,
                pl.name as plan_name,
                lk.license_key as license_key,
                sa.login as account_login,
                sp.profile_name as profile_name, sp.pin as profile_pin
         FROM orders o
         JOIN customers c ON c.id = o.customer_id
         JOIN products p ON p.id = o.product_id
         JOIN plans pl ON pl.id = o.plan_id
         LEFT JOIN license_keys lk ON lk.id = o.assigned_license_key_id
         LEFT JOIN service_accounts sa ON sa.id = o.assigned_service_account_id
         LEFT JOIN service_profiles sp ON sp.id = o.assigned_profile_id
         WHERE o.id = $1`,
        [orderId]
      );

      return fullOrderRes.rows[0] || orderRes.rows[0];
    });
  }

  async cancelOrder(orderId: string, reason?: string, user?: any): Promise<void> {
    await transaction(async (client) => {
      // Row-level lock on the target order to prevent concurrent cancellations
      const orderRes = await client.query<OrderRow>(
        'SELECT * FROM orders WHERE id = $1 FOR UPDATE',
        [orderId]
      );
      const order = orderRes.rows[0];
      if (!order) {
        const err = new Error('Order not found.');
        (err as any).statusCode = 404;
        throw err;
      }

      if (order.status === 'cancelled') {
        return; // Idempotent: already cancelled
      }

      // Release assigned profile if any
      if (order.assigned_profile_id) {
        await client.query(
          `UPDATE service_profiles
           SET status = 'available', assigned_customer_id = NULL, assigned_order_id = NULL
           WHERE id = $1`,
          [order.assigned_profile_id]
        );
      }

      // Release assigned license key if any
      if (order.assigned_license_key_id) {
        await client.query(
          `UPDATE license_keys
           SET status = 'available', assigned_customer_id = NULL, assigned_order_id = NULL
           WHERE id = $1`,
          [order.assigned_license_key_id]
        );
      }

      // Mark order as cancelled
      await client.query("UPDATE orders SET status = 'cancelled' WHERE id = $1", [orderId]);
    });

    await auditRepo.log(user || null, 'CANCEL_ORDER', 'order', orderId, { reason });
  }

  async renewOrder(orderId: string, customPrice?: number, notes?: string, user?: any): Promise<any> {
    const result = await transaction(async (client) => {
      // Row-level lock on the order being renewed
      const orderRes = await client.query<OrderRow>(
        'SELECT * FROM orders WHERE id = $1 FOR UPDATE',
        [orderId]
      );
      const order = orderRes.rows[0];
      if (!order) {
        const err = new Error('Order not found.');
        (err as any).statusCode = 404;
        throw err;
      }

      const plan = await plansRepo.findById(order.plan_id);
      if (!plan) {
        const err = new Error('Subscription plan not found.');
        (err as any).statusCode = 404;
        throw err;
      }

      // New end date calculated from previous end date or today, whichever is later
      const previousEndStr = typeof order.end_date === 'string'
        ? order.end_date.split('T')[0]
        : new Date(order.end_date).toISOString().split('T')[0];
      const todayStr = new Date().toISOString().split('T')[0];
      const baseDate = previousEndStr > todayStr ? previousEndStr : todayStr;
      const newEndDate = calculateEndDate(baseDate, plan.duration, plan.duration_unit);

      const renewalPrice = customPrice !== undefined ? customPrice : Number(plan.price);
      const renewalId = 'ren-' + crypto.randomUUID().slice(0, 8);

      await client.query(
        `INSERT INTO order_renewals (id, order_id, previous_end_date, new_end_date, price, cost, currency, created_by_user_id, notes, created_at)
         VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, CURRENT_TIMESTAMP)`,
        [
          renewalId, orderId, order.end_date, newEndDate,
          renewalPrice, Number(plan.cost || 0), plan.currency || 'USD',
          user?.id || null, notes || null
        ]
      );

      await client.query(
        `UPDATE orders
         SET end_date = $1, status = 'active', renewal_count = renewal_count + 1
         WHERE id = $2`,
        [newEndDate, orderId]
      );

      return {
        success: true,
        previous_end_date: order.end_date,
        new_end_date: newEndDate,
        price: renewalPrice,
        duration: plan.duration,
        duration_unit: plan.duration_unit
      };
    });

    await auditRepo.log(user || null, 'RENEW_ORDER', 'order', orderId, { newEndDate: result.new_end_date, price: result.price });
    return result;
  }
}

export const orderService = new OrderService();
