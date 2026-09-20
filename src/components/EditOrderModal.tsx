import React from 'react';
import { X, Calendar, DollarSign, CreditCard, FileText, CheckCircle2, AlertCircle, User, Box, Layers, RefreshCw } from 'lucide-react';
import { api } from '../api';
import type { Order, Customer, Product, Plan } from '../types';

interface EditOrderModalProps {
  isOpen: boolean;
  order: Order | null;
  onClose: () => void;
  onOrderUpdated: (updated: Order) => void;
}

const formatDateForInput = (d: any): string => {
  if (!d) return '';
  if (typeof d === 'string') {
    if (d.includes('T')) return d.split('T')[0];
    if (d.includes(' ')) return d.split(' ')[0];
    return d.slice(0, 10);
  }
  if (d instanceof Date && !isNaN(d.getTime())) {
    const y = d.getFullYear();
    const m = String(d.getMonth() + 1).padStart(2, '0');
    const day = String(d.getDate()).padStart(2, '0');
    return `${y}-${m}-${day}`;
  }
  return '';
};

const calculateStatusForEndDate = (dateStr: string): 'active' | 'expiring' | 'expired' => {
  if (!dateStr) return 'active';
  const clean = dateStr.split('T')[0];
  const today = new Date().toISOString().split('T')[0];
  if (clean < today) return 'expired';
  const d = new Date();
  d.setUTCDate(d.getUTCDate() + 3);
  const threeDays = d.toISOString().split('T')[0];
  if (clean <= threeDays) return 'expiring';
  return 'active';
};

export const EditOrderModal: React.FC<EditOrderModalProps> = ({
  isOpen,
  order,
  onClose,
  onOrderUpdated
}) => {
  const [customers, setCustomers] = React.useState<Customer[]>([]);
  const [products, setProducts] = React.useState<Product[]>([]);
  const [plans, setPlans] = React.useState<Plan[]>([]);

  const [customerId, setCustomerId] = React.useState('');
  const [productId, setProductId] = React.useState('');
  const [planId, setPlanId] = React.useState('');
  const [startDate, setStartDate] = React.useState('');
  const [endDate, setEndDate] = React.useState('');
  const [price, setPrice] = React.useState('');
  const [paymentStatus, setPaymentStatus] = React.useState<'paid' | 'pending' | 'refunded'>('paid');
  const [paymentMethod, setPaymentMethod] = React.useState('cash');
  const [status, setStatus] = React.useState<'active' | 'expiring' | 'expired'>('active');
  const [notes, setNotes] = React.useState('');

  const [loadingData, setLoadingData] = React.useState(false);
  const [loading, setLoading] = React.useState(false);
  const [error, setError] = React.useState<string | null>(null);

  // Close on Escape key
  React.useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape' && isOpen) {
        onClose();
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [isOpen, onClose]);

  // Load customer and product lists when modal opens
  React.useEffect(() => {
    if (isOpen) {
      loadInitialOptions();
    }
  }, [isOpen]);

  // Synchronize state when order changes
  React.useEffect(() => {
    if (order) {
      setCustomerId(order.customer_id || '');
      setProductId(order.product_id || '');
      setPlanId(order.plan_id || '');
      setStartDate(formatDateForInput(order.start_date));
      const formattedEnd = formatDateForInput(order.end_date);
      setEndDate(formattedEnd);
      setPrice(order.price !== undefined ? String(order.price) : '0');
      setPaymentStatus((order.payment_status as any) || 'paid');
      setPaymentMethod(order.payment_method || 'cash');
      setStatus(
        (order.status as any) === 'expiring'
          ? 'expiring'
          : (order.status as any) === 'expired'
          ? 'expired'
          : 'active'
      );
      setNotes(order.fulfillment_data?.notes || '');
      setError(null);

      if (order.product_id) {
        loadPlansForProduct(order.product_id, false);
      }
    }
  }, [order]);

  const loadInitialOptions = async () => {
    setLoadingData(true);
    try {
      const [cRes, pRes] = await Promise.all([
        api.getCustomers(),
        api.getProducts()
      ]);
      setCustomers(cRes.customers || []);
      setProducts(pRes.products || []);
    } catch (err: any) {
      console.error('Failed to load customers or products', err);
    } finally {
      setLoadingData(false);
    }
  };

  const loadPlansForProduct = async (prodId: string, autoSelectFirst = true) => {
    if (!prodId) {
      setPlans([]);
      return;
    }
    try {
      const details = await api.getProduct(prodId);
      const availablePlans = details.plans || [];
      setPlans(availablePlans);

      if (autoSelectFirst && availablePlans.length > 0) {
        const firstPlan = availablePlans[0];
        setPlanId(firstPlan.id);
        setPrice(String(firstPlan.price || 0));
        recalculateEndDate(firstPlan.id, startDate);
      }
    } catch (err) {
      console.error('Failed to load plans for product', err);
    }
  };

  const handleProductChange = (newProdId: string) => {
    setProductId(newProdId);
    loadPlansForProduct(newProdId, true);
  };

  const handlePlanChange = (newPlanId: string) => {
    setPlanId(newPlanId);
    const selectedPlan = plans.find((p) => p.id === newPlanId);
    if (selectedPlan) {
      setPrice(String(selectedPlan.price || 0));
    }
    recalculateEndDate(newPlanId, startDate);
  };

  const recalculateEndDate = async (targetPlanId: string, targetStartDate: string) => {
    if (!targetPlanId || !targetStartDate) return;
    try {
      const calc = await api.calculateDates(targetPlanId, targetStartDate);
      if (calc.end_date) {
        const formattedEnd = formatDateForInput(calc.end_date);
        setEndDate(formattedEnd);
        setStatus(calculateStatusForEndDate(formattedEnd));
      }
      if (calc.price !== undefined && (!price || price === '0')) {
        setPrice(String(calc.price));
      }
    } catch {
      // Keep existing manual date if calculation fails
    }
  };

  if (!isOpen || !order) return null;

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setError(null);

    try {
      const res = await api.updateOrder(order.id, {
        customer_id: customerId,
        product_id: productId,
        plan_id: planId,
        start_date: startDate,
        end_date: endDate,
        price: parseFloat(price) || 0,
        payment_status: paymentStatus,
        payment_method: paymentMethod,
        status,
        notes
      });

      if (res.order) {
        onOrderUpdated(res.order);
      }
      window.dispatchEvent(new CustomEvent('app:data-mutated'));
      onClose();
    } catch (err: any) {
      setError(err.message || 'Failed to update order');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div
      id="edit-order-modal-backdrop"
      onClick={onClose}
      className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/40 backdrop-blur-xs p-4 overflow-y-auto"
    >
      <div
        id="edit-order-modal-dialog"
        onClick={(e) => e.stopPropagation()}
        className="w-full max-w-xl bg-white rounded-3xl shadow-2xl border border-slate-200 overflow-hidden my-8 animate-in fade-in zoom-in-95 duration-150"
      >
        {/* Modal Header */}
        <div className="px-6 py-4 bg-slate-900 text-white flex items-center justify-between">
          <div>
            <span className="text-[10px] uppercase font-mono tracking-wider text-slate-400">Order Modification</span>
            <h3 className="text-base font-bold flex items-center gap-2">
              Edit Order #{order.order_number}
            </h3>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="p-1 rounded-full text-slate-400 hover:text-white hover:bg-slate-800 transition"
            title="Close (Esc)"
          >
            <X size={18} />
          </button>
        </div>

        <form onSubmit={handleSubmit} className="p-6 space-y-4 max-h-[80vh] overflow-y-auto">
          {error && (
            <div className="p-3 bg-red-50 border border-red-200 text-red-700 rounded-xl text-xs flex items-center gap-2">
              <AlertCircle size={15} className="shrink-0" />
              <span>{error}</span>
            </div>
          )}

          {/* Editable Customer Selection */}
          <div>
            <label className="block text-xs font-semibold text-slate-700 mb-1 flex items-center gap-1.5">
              <User size={14} className="text-blue-600" />
              Customer
            </label>
            <select
              required
              value={customerId}
              onChange={(e) => setCustomerId(e.target.value)}
              className="w-full bg-slate-50 border border-slate-200 rounded-xl px-3 py-2 text-xs text-slate-800 focus:outline-hidden focus:bg-white focus:border-blue-500 font-medium"
            >
              <option value="" disabled>Select customer...</option>
              {customers.map((c) => (
                <option key={c.id} value={c.id}>
                  {c.name} {c.whatsapp ? `(${c.whatsapp})` : c.email ? `(${c.email})` : ''}
                </option>
              ))}
            </select>
          </div>

          {/* Editable Product & Plan Selection */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <div>
              <label className="block text-xs font-semibold text-slate-700 mb-1 flex items-center gap-1.5">
                <Box size={14} className="text-indigo-600" />
                Product
              </label>
              <select
                required
                value={productId}
                onChange={(e) => handleProductChange(e.target.value)}
                className="w-full bg-slate-50 border border-slate-200 rounded-xl px-3 py-2 text-xs text-slate-800 focus:outline-hidden focus:bg-white focus:border-blue-500 font-medium"
              >
                <option value="" disabled>Select product...</option>
                {products.map((p) => (
                  <option key={p.id} value={p.id}>
                    {p.name} {p.brand ? `[${p.brand}]` : ''}
                  </option>
                ))}
              </select>
            </div>

            <div>
              <label className="block text-xs font-semibold text-slate-700 mb-1 flex items-center gap-1.5">
                <Layers size={14} className="text-purple-600" />
                Plan / Term
              </label>
              <select
                required
                value={planId}
                onChange={(e) => handlePlanChange(e.target.value)}
                className="w-full bg-slate-50 border border-slate-200 rounded-xl px-3 py-2 text-xs text-slate-800 focus:outline-hidden focus:bg-white focus:border-blue-500 font-medium"
              >
                <option value="" disabled>Select plan...</option>
                {plans.map((pl) => (
                  <option key={pl.id} value={pl.id}>
                    {pl.name} (${pl.price} / {pl.duration} {pl.duration_unit})
                  </option>
                ))}
              </select>
            </div>
          </div>

          {/* Dates Row */}
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block text-xs font-semibold text-slate-700 mb-1 flex items-center gap-1">
                <Calendar size={13} className="text-slate-400" />
                Start Date
              </label>
              <input
                type="date"
                required
                value={startDate}
                onChange={(e) => {
                  setStartDate(e.target.value);
                  recalculateEndDate(planId, e.target.value);
                }}
                className="w-full bg-slate-50 border border-slate-200 rounded-xl px-3 py-2 text-xs text-slate-800 focus:outline-hidden focus:bg-white focus:border-blue-500"
              />
            </div>
            <div>
              <label className="block text-xs font-semibold text-slate-700 mb-1 flex items-center gap-1">
                <Calendar size={13} className="text-slate-400" />
                End Date (Expiry)
              </label>
              <input
                type="date"
                required
                value={endDate}
                onChange={(e) => {
                  const val = e.target.value;
                  setEndDate(val);
                  setStatus(calculateStatusForEndDate(val));
                }}
                className="w-full bg-slate-50 border border-slate-200 rounded-xl px-3 py-2 text-xs text-slate-800 focus:outline-hidden focus:bg-white focus:border-blue-500"
              />
            </div>
          </div>

          {/* Financials Row */}
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block text-xs font-semibold text-slate-700 mb-1 flex items-center gap-1">
                <DollarSign size={13} className="text-slate-400" />
                Price Charged ({order.currency || 'USD'})
              </label>
              <input
                type="number"
                step="0.01"
                min="0"
                required
                value={price}
                onChange={(e) => setPrice(e.target.value)}
                className="w-full bg-slate-50 border border-slate-200 rounded-xl px-3 py-2 text-xs text-slate-800 focus:outline-hidden focus:bg-white focus:border-blue-500 font-semibold"
              />
            </div>

            <div>
              <label className="block text-xs font-semibold text-slate-700 mb-1 flex items-center gap-1">
                <CreditCard size={13} className="text-slate-400" />
                Payment Method
              </label>
              <select
                value={paymentMethod}
                onChange={(e) => setPaymentMethod(e.target.value)}
                className="w-full bg-slate-50 border border-slate-200 rounded-xl px-3 py-2 text-xs text-slate-800 focus:outline-hidden focus:bg-white focus:border-blue-500"
              >
                <option value="cash">Cash in Hand</option>
                <option value="transfer">Bank / Wire Transfer</option>
                <option value="card">Card / Stripe</option>
                <option value="crypto">Cryptocurrency</option>
              </select>
            </div>
          </div>

          {/* Status & Payment Status */}
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block text-xs font-semibold text-slate-700 mb-1">
                Subscription Status
              </label>
              <select
                value={status}
                onChange={(e) => setStatus(e.target.value as any)}
                className="w-full bg-slate-50 border border-slate-200 rounded-xl px-3 py-2 text-xs text-slate-800 focus:outline-hidden focus:bg-white focus:border-blue-500 font-medium"
              >
                <option value="active">Active</option>
                <option value="expiring">Expiring Soon</option>
                <option value="expired">Expired</option>
              </select>
            </div>

            <div>
              <label className="block text-xs font-semibold text-slate-700 mb-1">
                Payment Status
              </label>
              <select
                value={paymentStatus}
                onChange={(e) => setPaymentStatus(e.target.value as any)}
                className="w-full bg-slate-50 border border-slate-200 rounded-xl px-3 py-2 text-xs text-slate-800 focus:outline-hidden focus:bg-white focus:border-blue-500 font-medium"
              >
                <option value="paid">Paid & Settled</option>
                <option value="pending">Pending Payment</option>
                <option value="refunded">Refunded</option>
              </select>
            </div>
          </div>

          {/* Internal Notes */}
          <div>
            <label className="block text-xs font-semibold text-slate-700 mb-1 flex items-center gap-1">
              <FileText size={13} className="text-slate-400" />
              Internal Notes / Remarks
            </label>
            <textarea
              rows={2}
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
              placeholder="e.g. Agreed on custom terms, grace period extension..."
              className="w-full bg-slate-50 border border-slate-200 rounded-xl p-3 text-xs text-slate-800 placeholder-slate-400 focus:outline-hidden focus:bg-white focus:border-blue-500"
            />
          </div>

          {/* Buttons */}
          <div className="pt-2 flex items-center justify-end gap-2 border-t border-slate-100">
            <button
              type="button"
              onClick={onClose}
              className="px-4 py-2 text-xs font-medium text-slate-600 hover:bg-slate-100 rounded-xl transition"
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={loading || loadingData}
              className="px-5 py-2 text-xs font-semibold bg-blue-600 hover:bg-blue-500 text-white rounded-xl shadow-xs transition flex items-center gap-1.5 disabled:opacity-50"
            >
              <CheckCircle2 size={14} />
              <span>{loading ? 'Saving...' : 'Save Changes'}</span>
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};
