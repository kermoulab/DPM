import React from 'react';
import {
  ShoppingBag,
  Filter,
  RefreshCw,
  MessageSquare,
  Eye,
  Plus,
  Calendar,
  Clock,
  XCircle,
  MoreVertical,
  Edit3,
  Trash2,
  ShieldAlert,
  CheckCircle2,
  X,
  ArrowRight
} from 'lucide-react';
import { api } from '../api';
import type { Order } from '../types';
import { EditOrderModal } from '../components/EditOrderModal';
import { useCurrency } from '../context/CurrencyContext';
import { PortalDropdown } from '../components/PortalDropdown';

interface OrdersViewProps {
  onOpenOrderBuilder: () => void;
  onViewOrder: (order: Order) => void;
  onComposeWhatsApp: (orderId: string) => void;
  onRenewOrder: (orderId: string) => Promise<any> | void;
}

export type OrderStatus = 'active' | 'expiring' | 'expired' | 'pending' | 'cancelled' | 'completed';

export interface StatusConfig {
  label: string;
  badgeBg: string;
  badgeText: string;
  badgeBorder: string;
  selectClass: string;
  dotClass: string;
  activeTabClass: string;
  tabBadgeClass: string;
  description: string;
}

const formatDateOnly = (d?: string | null) => {
  if (!d) return '—';
  return String(d).split('T')[0].split(' ')[0];
};

export const ORDER_STATUS_CONFIG: Record<OrderStatus, StatusConfig> = {
  active: {
    label: 'Active',
    badgeBg: 'bg-emerald-50',
    badgeText: 'text-emerald-700',
    badgeBorder: 'border-emerald-200',
    selectClass: 'bg-emerald-50 text-emerald-700 border-emerald-300 hover:bg-emerald-100/80 focus:ring-emerald-400',
    dotClass: 'bg-emerald-500',
    activeTabClass: 'bg-emerald-600 text-white shadow-xs',
    tabBadgeClass: 'bg-emerald-100 text-emerald-700',
    description: 'Service actively operational'
  },
  expiring: {
    label: 'Expiring Soon',
    badgeBg: 'bg-amber-50',
    badgeText: 'text-amber-800',
    badgeBorder: 'border-amber-200',
    selectClass: 'bg-amber-50 text-amber-800 border-amber-300 hover:bg-amber-100/80 focus:ring-amber-400',
    dotClass: 'bg-amber-500',
    activeTabClass: 'bg-amber-600 text-white shadow-xs',
    tabBadgeClass: 'bg-amber-100 text-amber-800',
    description: 'Term expiring within 3 days'
  },
  expired: {
    label: 'Expired',
    badgeBg: 'bg-rose-50',
    badgeText: 'text-rose-700',
    badgeBorder: 'border-rose-200',
    selectClass: 'bg-rose-50 text-rose-700 border-rose-300 hover:bg-rose-100/80 focus:ring-rose-400',
    dotClass: 'bg-rose-500',
    activeTabClass: 'bg-rose-600 text-white shadow-xs',
    tabBadgeClass: 'bg-rose-100 text-rose-700',
    description: 'Subscription term ended'
  },
  pending: {
    label: 'Pending',
    badgeBg: 'bg-slate-50',
    badgeText: 'text-slate-700',
    badgeBorder: 'border-slate-200',
    selectClass: 'bg-slate-50 text-slate-700 border-slate-300 hover:bg-slate-100/80 focus:ring-slate-400',
    dotClass: 'bg-slate-400',
    activeTabClass: 'bg-slate-600 text-white shadow-xs',
    tabBadgeClass: 'bg-slate-100 text-slate-700',
    description: 'Awaiting fulfillment'
  },
  cancelled: {
    label: 'Cancelled',
    badgeBg: 'bg-zinc-100',
    badgeText: 'text-zinc-600',
    badgeBorder: 'border-zinc-300',
    selectClass: 'bg-zinc-100 text-zinc-600 border-zinc-300 hover:bg-zinc-200/80 focus:ring-zinc-400',
    dotClass: 'bg-zinc-400',
    activeTabClass: 'bg-zinc-700 text-white shadow-xs',
    tabBadgeClass: 'bg-zinc-200 text-zinc-700',
    description: 'Order cancelled and stock released'
  },
  completed: {
    label: 'Completed',
    badgeBg: 'bg-blue-50',
    badgeText: 'text-blue-700',
    badgeBorder: 'border-blue-200',
    selectClass: 'bg-blue-50 text-blue-700 border-blue-300 hover:bg-blue-100/80 focus:ring-blue-400',
    dotClass: 'bg-blue-500',
    activeTabClass: 'bg-blue-600 text-white shadow-xs',
    tabBadgeClass: 'bg-blue-100 text-blue-700',
    description: 'Order completed'
  }
};

interface ToastNotification {
  message: string;
  targetTab?: string;
  targetTabLabel?: string;
}

export const OrdersView: React.FC<OrdersViewProps> = ({
  onOpenOrderBuilder,
  onViewOrder,
  onComposeWhatsApp,
  onRenewOrder
}) => {
  const { format: formatMoney } = useCurrency();
  const [orders, setOrders] = React.useState<Order[]>([]);
  const [orderCounts, setOrderCounts] = React.useState({
    active: 0,
    expiring: 0,
    expired: 0
  });
  const [loading, setLoading] = React.useState(true);
  const [statusFilter, setStatusFilter] = React.useState('active');
  const [activeMenuOrderId, setActiveMenuOrderId] = React.useState<string | null>(null);
  const menuTriggerRef = React.useRef<HTMLButtonElement | null>(null);
  const [editingOrder, setEditingOrder] = React.useState<Order | null>(null);
  const [deleteRestrictedOrder, setDeleteRestrictedOrder] = React.useState<Order | null>(null);
  const [toast, setToast] = React.useState<ToastNotification | null>(null);
  const [updatingOrderId, setUpdatingOrderId] = React.useState<string | null>(null);

  React.useEffect(() => {
    loadOrders(true);
  }, [statusFilter]);

  // Listen for data mutations across the app so newly created/updated orders appear immediately
  React.useEffect(() => {
    const handleDataMutated = () => {
      loadOrders(false);
    };
    window.addEventListener('app:data-mutated', handleDataMutated);
    return () => {
      window.removeEventListener('app:data-mutated', handleDataMutated);
    };
  }, [statusFilter]);

  React.useEffect(() => {
    if (toast) {
      const timer = setTimeout(() => setToast(null), 5000);
      return () => clearTimeout(timer);
    }
  }, [toast]);

  const loadOrders = async (showLoadingSpinner = false) => {
    if (showLoadingSpinner) {
      setLoading(true);
    }
    try {
      const params: any = { status: statusFilter };
      const res = await api.getOrders(params);
      setOrders(res.orders);
      if (res.counts) {
        setOrderCounts({
          active: res.counts.active || 0,
          expiring: res.counts.expiring || 0,
          expired: res.counts.expired || 0
        });
      }
    } catch (err) {
      console.error(err);
    } finally {
      if (showLoadingSpinner) {
        setLoading(false);
      }
    }
  };

  const handleDelete = async (order: Order) => {
    if (!confirm(`Are you sure you want to permanently delete order #${order.order_number}? This action cannot be undone.`)) {
      return;
    }
    // Optimistic remove
    setOrders((prev) => prev.filter((o) => o.id !== order.id));
    try {
      const res = await api.deleteOrder(order.id);
      setToast({ message: res.message || `Order #${order.order_number} deleted successfully.` });
      window.dispatchEvent(new CustomEvent('app:data-mutated'));
      loadOrders(false);
    } catch (err: any) {
      setToast({ message: err.message || 'Failed to delete order.' });
      loadOrders(false);
    }
  };

  const handleRestrictedDelete = (order: Order) => {
    setDeleteRestrictedOrder(order);
  };

  const handleStatusChange = async (orderId: string, orderNumber: string, newStatus: string) => {
    const currentOrder = orders.find((o) => o.id === orderId);
    const oldStatus = currentOrder?.status || 'active';
    if (oldStatus === newStatus) return;

    setUpdatingOrderId(orderId);
    const targetStatusConfig = ORDER_STATUS_CONFIG[newStatus as OrderStatus] || { label: newStatus };

    // Optimistic UI updates
    if (statusFilter !== newStatus) {
      // Moves out of current tab immediately
      setOrders((prev) => prev.filter((o) => o.id !== orderId));
    } else {
      // Updates in-place with new status and color
      setOrders((prev) =>
        prev.map((o) => (o.id === orderId ? { ...o, status: newStatus as any } : o))
      );
    }

    // Optimistic count adjustment
    setOrderCounts((prev) => ({
      ...prev,
      [oldStatus]: Math.max(0, (prev[oldStatus as keyof typeof prev] || 0) - 1),
      [newStatus]: (prev[newStatus as keyof typeof prev] || 0) + 1
    }));

    const isTargetTab = ['active', 'expiring', 'expired'].includes(newStatus);
    if (statusFilter !== newStatus) {
      setToast({
        message: isTargetTab
          ? `Order #${orderNumber} moved to ${targetStatusConfig.label} tab.`
          : `Order #${orderNumber} status changed to ${targetStatusConfig.label}.`,
        targetTab: isTargetTab ? newStatus : undefined,
        targetTabLabel: isTargetTab ? targetStatusConfig.label : undefined
      });
    } else {
      setToast({
        message: `Order #${orderNumber} status changed to ${targetStatusConfig.label}.`
      });
    }

    try {
      await api.updateOrder(orderId, { status: newStatus });
      window.dispatchEvent(new CustomEvent('app:data-mutated'));
      // Background re-fetch to ensure database state sync without spinner
      const params: any = { status: statusFilter };
      const res = await api.getOrders(params);
      setOrders(res.orders);
      if (res.counts) {
        setOrderCounts({
          active: res.counts.active || 0,
          expiring: res.counts.expiring || 0,
          expired: res.counts.expired || 0
        });
      }
    } catch (err: any) {
      setToast({ message: err.message || 'Failed to update order status' });
      loadOrders(false); // Rollback on error
    } finally {
      setUpdatingOrderId(null);
    }
  };

  // Close modals on Escape key
  React.useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        if (activeMenuOrderId) setActiveMenuOrderId(null);
        if (deleteRestrictedOrder) setDeleteRestrictedOrder(null);
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [activeMenuOrderId, deleteRestrictedOrder]);

  const handleOrderUpdated = (updated: Order) => {
    setToast({ message: `Order #${updated.order_number} updated successfully.` });
    loadOrders();
  };

  const filteredOrders = orders;

  const statusTabs: {
    id: string;
    label: string;
    count: number;
    dotClass: string;
    activeClass: string;
    badgeClass: string;
  }[] = [
    {
      id: 'active',
      label: 'Active',
      count: orderCounts.active,
      dotClass: ORDER_STATUS_CONFIG.active.dotClass,
      activeClass: ORDER_STATUS_CONFIG.active.activeTabClass,
      badgeClass: ORDER_STATUS_CONFIG.active.tabBadgeClass
    },
    {
      id: 'expiring',
      label: 'Expiring ≤3d',
      count: orderCounts.expiring,
      dotClass: ORDER_STATUS_CONFIG.expiring.dotClass,
      activeClass: ORDER_STATUS_CONFIG.expiring.activeTabClass,
      badgeClass: ORDER_STATUS_CONFIG.expiring.tabBadgeClass
    },
    {
      id: 'expired',
      label: 'Expired',
      count: orderCounts.expired,
      dotClass: ORDER_STATUS_CONFIG.expired.dotClass,
      activeClass: ORDER_STATUS_CONFIG.expired.activeTabClass,
      badgeClass: ORDER_STATUS_CONFIG.expired.tabBadgeClass
    }
  ];

  return (
    <div className="space-y-6">
      {/* Top action bar */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 bg-white p-6 rounded-3xl border border-slate-200/80 shadow-xs">
        <div>
          <h2 className="text-xl font-bold text-slate-900 tracking-tight">Order Management & Sales</h2>
          <p className="text-xs text-slate-500 mt-0.5">
            Atomic fulfillment lifecycle, active subscriptions, and real-time status tracking.
          </p>
        </div>

        <button
          onClick={onOpenOrderBuilder}
          className="px-5 py-2.5 bg-blue-600 hover:bg-blue-500 text-white rounded-xl text-xs font-semibold flex items-center gap-2 shadow-md shadow-blue-600/25 transition shrink-0"
        >
          <Plus size={16} />
          <span>Create New Order</span>
        </button>
      </div>

      {/* Status Filter Toolbar */}
      <div className="bg-white p-4 rounded-2xl border border-slate-200/80 shadow-xs">
        {/* Status Tabs with Distinct Colors & Counts */}
        <div className="flex items-center gap-1.5 overflow-x-auto pb-1 md:pb-0 scrollbar-thin">
          {statusTabs.map((tab) => {
            const isActive = statusFilter === tab.id;
            return (
              <button
                key={tab.id}
                onClick={() => setStatusFilter(tab.id)}
                className={`px-3 py-1.5 rounded-xl text-xs font-semibold transition shrink-0 flex items-center gap-2 border ${
                  isActive
                    ? `${tab.activeClass} border-transparent`
                    : 'bg-white text-slate-600 border-slate-200/80 hover:bg-slate-50 hover:text-slate-900'
                }`}
              >
                <span className={`h-2 w-2 rounded-full shrink-0 ${tab.dotClass}`} />
                <span>{tab.label}</span>
                <span
                  className={`text-[10px] px-1.5 py-0.5 rounded-full font-bold transition ${
                    isActive ? 'bg-white/20 text-white' : tab.badgeClass
                  }`}
                >
                  {tab.count}
                </span>
              </button>
            );
          })}
        </div>
      </div>

      {/* Orders Table */}
      <div className="bg-white rounded-3xl border border-slate-200/80 shadow-xs overflow-hidden">
        {loading ? (
          <div className="p-12 text-center text-xs text-slate-400">Loading orders...</div>
        ) : filteredOrders.length === 0 ? (
          <div className="p-12 text-center text-xs text-slate-400">
            No orders found in {statusTabs.find((t) => t.id === statusFilter)?.label || 'this filter'}.
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs">
              <thead>
                <tr className="bg-slate-50/60 border-b border-slate-100 text-slate-400 uppercase text-[10px] tracking-wider">
                  <th className="py-3 px-5 font-semibold">Order</th>
                  <th className="py-3 px-4 font-semibold">Customer</th>
                  <th className="py-3 px-4 font-semibold">Product & Plan</th>
                  <th className="py-3 px-4 font-semibold">Subscription Term</th>
                  <th className="py-3 px-4 font-semibold">Status</th>
                  <th className="py-3 px-4 font-semibold">Price</th>
                  <th className="py-3 px-5 font-semibold text-right">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {filteredOrders.map((o, index) => {
                  const statusConf = ORDER_STATUS_CONFIG[o.status as OrderStatus] || {
                    label: o.status,
                    badgeBg: 'bg-slate-50',
                    badgeText: 'text-slate-700',
                    badgeBorder: 'border-slate-200',
                    selectClass: 'bg-slate-100 text-slate-700 border-slate-200',
                    dotClass: 'bg-slate-400'
                  };
                  const isRowUpdating = updatingOrderId === o.id;

                  return (
                    <tr key={o.id} className="hover:bg-slate-50/60 transition">
                      <td className="py-3.5 px-5">
                        <span className="font-mono font-bold text-slate-800">#{o.order_number}</span>
                      </td>
                      <td className="py-3.5 px-4">
                        <p className="font-semibold text-slate-800">{o.customer_name}</p>
                        <p className="text-[11px] text-slate-400">{o.customer_whatsapp || o.customer_email || 'No contact'}</p>
                      </td>
                      <td className="py-3.5 px-4">
                        <p className="font-semibold text-slate-800">{o.product_name}</p>
                        <p className="text-[11px] text-slate-400">{o.plan_name}</p>
                      </td>
                      <td className="py-3.5 px-4">
                        <div className="flex items-center gap-1.5 text-slate-600">
                          <Calendar size={13} className="text-slate-400 shrink-0" />
                          <span>
                            {formatDateOnly(o.start_date)} → {formatDateOnly(o.end_date)}
                          </span>
                        </div>
                        {o.renewal_count > 0 && (
                          <span className="inline-block mt-0.5 text-[10px] text-blue-600 font-medium">
                            Renewed {o.renewal_count}x
                          </span>
                        )}
                      </td>
                      <td className="py-3.5 px-4">
                        {/* Status Badge (Unchangeable) */}
                        <div
                          id={`order-status-badge-${o.id}`}
                          className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full font-semibold text-[11px] border shadow-2xs ${
                            statusConf.badgeBg
                          } ${statusConf.badgeText} ${statusConf.badgeBorder} ${
                            isRowUpdating ? 'opacity-60 animate-pulse' : ''
                          }`}
                        >
                          <span className={`h-2 w-2 rounded-full shrink-0 ${statusConf.dotClass}`} />
                          <span>{statusConf.label}</span>
                        </div>
                      </td>
                      <td className="py-3.5 px-4 font-bold text-slate-800">
                        {formatMoney(o.price, o.currency || 'USD')}
                      </td>
                      <td className="py-3.5 px-5 text-right relative">
                        <div className="flex items-center justify-end">
                          <div className="relative inline-block text-left">
                            <button
                              id={`order-actions-btn-${o.id}`}
                              type="button"
                              onClick={(e) => {
                                e.stopPropagation();
                                menuTriggerRef.current = e.currentTarget;
                                setActiveMenuOrderId(activeMenuOrderId === o.id ? null : o.id);
                              }}
                              className={`p-1.5 rounded-xl border transition flex items-center justify-center ${
                                activeMenuOrderId === o.id
                                  ? 'bg-slate-900 text-white border-slate-900 shadow-2xs'
                                  : 'border-slate-200 text-slate-500 hover:text-slate-900 hover:bg-slate-100'
                              }`}
                              title="Order Actions"
                            >
                              <MoreVertical size={16} />
                            </button>
                          </div>
                        </div>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {/* 3-Dots Dropdown Portal (Rendered outside table/tbody to prevent scrolling and clipping) */}
      {(() => {
        const activeOrder = orders.find((o) => o.id === activeMenuOrderId);
        if (!activeOrder) return null;

        return (
          <PortalDropdown
            isOpen={Boolean(activeOrder)}
            onClose={() => setActiveMenuOrderId(null)}
            triggerRef={menuTriggerRef}
            width={220}
          >
            {/* View */}
            <button
              id={`action-view-${activeOrder.id}`}
              onClick={() => {
                setActiveMenuOrderId(null);
                onViewOrder(activeOrder);
              }}
              className="w-full px-3.5 py-2 text-xs text-slate-700 hover:bg-slate-50 flex items-center gap-2.5 transition font-medium"
            >
              <Eye size={15} className="text-blue-600 shrink-0" />
              <span>View Order & Receipt</span>
            </button>

            {/* Edit */}
            <button
              id={`action-edit-${activeOrder.id}`}
              onClick={() => {
                setActiveMenuOrderId(null);
                setEditingOrder(activeOrder);
              }}
              className="w-full px-3.5 py-2 text-xs text-slate-700 hover:bg-slate-50 flex items-center gap-2.5 transition font-medium"
            >
              <Edit3 size={15} className="text-amber-600 shrink-0" />
              <span>Edit Order</span>
            </button>

            {/* Contact via WhatsApp */}
            <button
              id={`action-whatsapp-${activeOrder.id}`}
              onClick={() => {
                setActiveMenuOrderId(null);
                onViewOrder(activeOrder);
              }}
              className="w-full px-3.5 py-2 text-xs text-slate-700 hover:bg-slate-50 flex items-center gap-2.5 transition font-medium"
            >
              <MessageSquare size={15} className="text-emerald-600 shrink-0" />
              <span>Contact via WhatsApp</span>
            </button>

            {/* Renewal */}
            <button
              id={`action-renew-${activeOrder.id}`}
              onClick={async () => {
                setActiveMenuOrderId(null);
                await onRenewOrder(activeOrder.id);
                await loadOrders();
              }}
              className="w-full px-3.5 py-2 text-xs text-slate-700 hover:bg-slate-50 flex items-center gap-2.5 transition font-medium"
            >
              <RefreshCw size={15} className="text-indigo-600 shrink-0" />
              <span>Renew Subscription</span>
            </button>

            <div className="my-1 border-t border-slate-100" />

            {/* Delete (Restricted for active/expiring orders) */}
            {activeOrder.status === 'active' || activeOrder.status === 'expiring' ? (
              <button
                id={`action-delete-${activeOrder.id}`}
                onClick={() => {
                  setActiveMenuOrderId(null);
                  handleRestrictedDelete(activeOrder);
                }}
                className="w-full px-3.5 py-2 text-xs text-slate-400 hover:bg-amber-50/50 flex items-center justify-between transition group"
                title="Active orders cannot be deleted. Cancel first to free allocated assets."
              >
                <div className="flex items-center gap-2.5">
                  <Trash2 size={15} className="text-slate-300 group-hover:text-slate-400 shrink-0" />
                  <span>Delete Order</span>
                </div>
                <span className="text-[9px] font-bold uppercase tracking-wider text-amber-700 bg-amber-100/70 px-1.5 py-0.5 rounded border border-amber-200">
                  Restricted
                </span>
              </button>
            ) : (
              <button
                id={`action-delete-${activeOrder.id}`}
                onClick={() => {
                  setActiveMenuOrderId(null);
                  handleDelete(activeOrder);
                }}
                className="w-full px-3.5 py-2 text-xs text-rose-600 hover:bg-rose-50 flex items-center gap-2.5 transition font-medium"
              >
                <Trash2 size={15} className="text-rose-500 shrink-0" />
                <span>Delete Order</span>
              </button>
            )}
          </PortalDropdown>
        );
      })()}

      {/* Edit Order Modal */}
      <EditOrderModal
        isOpen={Boolean(editingOrder)}
        order={editingOrder}
        onClose={() => setEditingOrder(null)}
        onOrderUpdated={handleOrderUpdated}
      />

      {/* Restricted Delete Alert Modal */}
      {deleteRestrictedOrder && (
        <div
          id="restricted-delete-modal-backdrop"
          onClick={() => setDeleteRestrictedOrder(null)}
          className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/40 backdrop-blur-xs p-4 animate-in fade-in duration-100"
        >
          <div
            id="restricted-delete-modal-dialog"
            onClick={(e) => e.stopPropagation()}
            className="bg-white rounded-3xl p-6 max-w-md w-full shadow-2xl border border-slate-200 space-y-4 animate-in zoom-in-95 duration-150"
          >
            <div className="flex items-center gap-3">
              <div className="p-2.5 rounded-2xl bg-amber-50 border border-amber-200 text-amber-600">
                <ShieldAlert size={24} />
              </div>
              <div>
                <h4 className="font-bold text-slate-900 text-sm">Active Order Deletion Restricted</h4>
                <p className="text-xs text-slate-500">Order #{deleteRestrictedOrder.order_number}</p>
              </div>
            </div>

            <p className="text-xs text-slate-600 leading-relaxed bg-slate-50 p-3.5 rounded-2xl border border-slate-200/80">
              Active subscriptions cannot be deleted while in service. This safeguard prevents losing track of assigned accounts/licenses and preserves accounting records. Please mark the order as expired first to release all allocated assets.
            </p>

            <div className="flex items-center justify-end gap-2 pt-2">
              <button
                onClick={() => setDeleteRestrictedOrder(null)}
                className="px-4 py-2 text-xs font-medium text-slate-600 hover:bg-slate-100 rounded-xl transition"
              >
                Dismiss
              </button>
              <button
                onClick={() => {
                  const targetOrder = deleteRestrictedOrder;
                  setDeleteRestrictedOrder(null);
                  handleStatusChange(targetOrder.id, targetOrder.order_number, 'expired');
                }}
                className="px-4 py-2 text-xs font-semibold bg-rose-600 hover:bg-rose-500 text-white rounded-xl shadow-xs transition"
              >
                Expire Order Instead
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Feedback Toast with Navigation Button to Target Tab */}
      {toast && (
        <div className="fixed bottom-6 right-6 z-50 bg-slate-900 text-white px-4 py-3 rounded-2xl shadow-2xl flex items-center gap-3 text-xs animate-in slide-in-from-bottom-3 duration-150 border border-slate-700 max-w-md">
          <CheckCircle2 size={16} className="text-emerald-400 shrink-0" />
          <span className="font-medium text-slate-100">{toast.message}</span>
          {toast.targetTab && (
            <button
              onClick={() => {
                setStatusFilter(toast.targetTab!);
                setToast(null);
              }}
              className="px-2.5 py-1 bg-blue-600 hover:bg-blue-500 text-white text-[11px] font-bold rounded-lg transition shrink-0 flex items-center gap-1 shadow-xs"
            >
              <span>View Tab</span>
              <ArrowRight size={12} />
            </button>
          )}
          <button
            onClick={() => setToast(null)}
            className="text-slate-400 hover:text-white p-0.5 ml-1 transition"
          >
            <X size={14} />
          </button>
        </div>
      )}
    </div>
  );
};

