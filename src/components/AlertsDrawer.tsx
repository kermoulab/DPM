import React from 'react';
import {
  X,
  Bell,
  Clock,
  RefreshCw,
  ShieldAlert,
  ArrowRight,
  Check
} from 'lucide-react';
import { api } from '../api';

interface AlertsDrawerProps {
  isOpen: boolean;
  onClose: () => void;
  onRenewOrder?: (orderId: string) => void;
  onComposeWhatsApp?: (orderId: string) => void;
  onNavigate: (tab: string) => void;
}

export const AlertsDrawer: React.FC<AlertsDrawerProps> = ({
  isOpen,
  onClose,
  onRenewOrder,
  onComposeWhatsApp,
  onNavigate
}) => {
  const [alerts, setAlerts] = React.useState<any>(null);
  const [loading, setLoading] = React.useState(true);

  React.useEffect(() => {
    if (isOpen) {
      loadAlerts();
    }
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape' && isOpen) {
        onClose();
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [isOpen, onClose]);

  const loadAlerts = async () => {
    setLoading(true);
    try {
      const data = await api.getAlerts();
      setAlerts(data);
    } catch (err) {
      console.error(err);
    } finally {
      setLoading(false);
    }
  };

  if (!isOpen) return null;

  const expiring = alerts?.expiringOrders || [];
  const expired = alerts?.expiredOrders || [];

  const allAlerts = [
    ...expiring.map((o: any) => ({
      id: `expiring-${o.id}`,
      type: 'expiring',
      title: o.customer_name,
      subtitle: `${o.product_name} • ${o.plan_name}`,
      badge: o.days_remaining <= 0 ? 'Today' : `${o.days_remaining}d left`,
      badgeClass: 'bg-amber-100 text-amber-800 border-amber-200',
      icon: Clock,
      iconColor: 'text-amber-500 bg-amber-50',
      targetTab: 'alerts'
    })),
    ...expired.map((o: any) => ({
      id: `expired-${o.id}`,
      type: 'expired',
      title: o.customer_name,
      subtitle: `${o.product_name} • ${o.plan_name}`,
      badge: 'Expired',
      badgeClass: 'bg-rose-100 text-rose-800 border-rose-200',
      icon: ShieldAlert,
      iconColor: 'text-rose-500 bg-rose-50',
      targetTab: 'alerts'
    }))
  ];

  const totalCount = allAlerts.length;

  return (
    <div
      id="alerts-drawer-backdrop"
      onClick={onClose}
      className="fixed inset-0 z-50 overflow-hidden bg-slate-900/30 backdrop-blur-2xs flex justify-end"
    >
      <div
        id="alerts-drawer-panel"
        onClick={(e) => e.stopPropagation()}
        className="w-full max-w-md bg-white h-full shadow-2xl flex flex-col animate-in slide-in-from-right duration-200"
      >
        {/* Header */}
        <div className="p-4 px-6 border-b border-slate-100 flex items-center justify-between">
          <div className="flex items-center gap-2.5">
            <div className="p-2 rounded-xl bg-blue-50 text-blue-600">
              <Bell size={18} />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h3 className="font-semibold text-slate-800 text-sm">Action Center & Alerts</h3>
                {totalCount > 0 && (
                  <span className="min-w-5 h-5 px-1.5 rounded-full bg-red-600 text-white text-[10px] font-bold flex items-center justify-center shadow-xs">
                    {totalCount > 99 ? '99+' : totalCount}
                  </span>
                )}
              </div>
              <p className="text-[11px] text-slate-400">Expiring & expired subscription notifications</p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="p-1.5 rounded-lg hover:bg-slate-100 text-slate-400 hover:text-slate-600 transition"
          >
            <X size={16} />
          </button>
        </div>

        {/* Content */}
        <div className="flex-1 overflow-y-auto p-4">
          {loading ? (
            <div className="p-8 text-center text-xs text-slate-400 flex flex-col items-center gap-2">
              <RefreshCw size={20} className="animate-spin text-blue-600" />
              <span>Checking real-time alerts...</span>
            </div>
          ) : allAlerts.length > 0 ? (
            <div className="rounded-xl border border-slate-200 bg-white divide-y divide-slate-100 shadow-2xs overflow-hidden">
              {allAlerts.map((item) => (
                <div
                  key={item.id}
                  onClick={() => {
                    onClose();
                    onNavigate(item.targetTab);
                  }}
                  className="p-3.5 flex items-center justify-between gap-3 hover:bg-slate-50 transition cursor-pointer group"
                  title="Click to view full details in Action Center"
                >
                  <div className="flex items-center gap-3 min-w-0">
                    <div className={`p-2 rounded-lg shrink-0 ${item.iconColor}`}>
                      <item.icon size={15} />
                    </div>
                    <div className="min-w-0">
                      <p className="font-semibold text-slate-800 text-xs truncate group-hover:text-blue-600 transition">
                        {item.title}
                      </p>
                      <p className="text-[11px] text-slate-500 truncate">
                        {item.subtitle}
                      </p>
                    </div>
                  </div>
                  <span className={`px-2 py-0.5 rounded-full text-[10px] font-bold shrink-0 border ${item.badgeClass}`}>
                    {item.badge}
                  </span>
                </div>
              ))}
            </div>
          ) : (
            <div className="p-8 text-center text-xs text-slate-400 bg-slate-50 rounded-xl border border-slate-100 flex flex-col items-center gap-2">
              <Check size={20} className="text-emerald-500" />
              <span>All clear! No pending alerts or warnings.</span>
            </div>
          )}
        </div>

        {/* Footer */}
        <div className="p-4 border-t border-slate-100 bg-slate-50/50 flex items-center justify-between">
          <span className="text-xs text-slate-500 font-medium">
            {totalCount} Total Alerts
          </span>
          <button
            onClick={() => {
              onClose();
              onNavigate('alerts');
            }}
            className="px-3 py-1.5 bg-slate-900 hover:bg-slate-800 text-white rounded-xl text-xs font-semibold flex items-center gap-1.5 transition shadow-2xs"
          >
            <span>Open Alerts Page</span>
            <ArrowRight size={13} />
          </button>
        </div>
      </div>
    </div>
  );
};
