import React from 'react';
import {
  Bell,
  AlertTriangle,
  Clock,
  RefreshCw,
  Send,
  Check,
  ExternalLink,
  ShieldAlert,
  CheckCircle2,
  Calendar,
  Sparkles,
  Phone,
  X,
  MessageSquare
} from 'lucide-react';
import { api } from '../api';

interface AlertsViewProps {
  onRenewOrder?: (orderId: string) => Promise<any> | void;
  onComposeWhatsApp?: (orderId: string) => void;
  onNavigate?: (tab: string) => void;
  onAlertCountChange?: (count: number) => void;
  onRefreshAlerts?: () => void;
}

export const AlertsView: React.FC<AlertsViewProps> = ({
  onRenewOrder,
  onComposeWhatsApp,
  onNavigate,
  onAlertCountChange,
  onRefreshAlerts
}) => {
  const [alerts, setAlerts] = React.useState<any>(null);
  const [loading, setLoading] = React.useState(true);
  const [activeTab, setActiveTab] = React.useState<'all' | 'expiring' | 'expired'>('all');
  
  // WhatsApp direct send state
  const [sendingId, setSendingId] = React.useState<string | null>(null);
  const [sentId, setSentId] = React.useState<string | null>(null);
  const [feedback, setFeedback] = React.useState<{ type: 'success' | 'error'; message: string; waUrl?: string } | null>(null);

  // Renewal handling state & real-time duration confirmation
  const [renewingId, setRenewingId] = React.useState<string | null>(null);
  const [renewalFeedback, setRenewalFeedback] = React.useState<{
    orderNumber: string;
    startDate: string;
    newEndDate: string;
    previousEndDate?: string;
    duration?: number;
    durationUnit?: string;
  } | null>(null);

  // Helper to calculate the projected duration from current base date
  const computeProjectedRenewal = (order: any) => {
    const today = new Date().toISOString().split('T')[0];
    const duration = Number(order.duration) || 1;
    const unit = order.duration_unit || 'months';
    const isExpired = order.end_date < today;
    // If order is active/expiring: renewal begins from its existing end_date.
    // If order is already expired: renewal begins from current date (today).
    const startDate = isExpired ? today : order.end_date;

    const parts = startDate.split('T')[0].split('-');
    const year = parseInt(parts[0], 10);
    const month = parseInt(parts[1], 10) - 1;
    const day = parseInt(parts[2], 10);
    const d = new Date(Date.UTC(year, month, day, 12, 0, 0));

    switch (unit) {
      case 'hours': d.setUTCHours(d.getUTCHours() + duration); break;
      case 'days': d.setUTCDate(d.getUTCDate() + duration); break;
      case 'weeks': d.setUTCDate(d.getUTCDate() + duration * 7); break;
      case 'months': d.setUTCMonth(d.getUTCMonth() + duration); break;
      case 'years': d.setUTCFullYear(d.getUTCFullYear() + duration); break;
      default: d.setUTCDate(d.getUTCDate() + duration);
    }
    const y = d.getUTCFullYear();
    const m = String(d.getUTCMonth() + 1).padStart(2, '0');
    const dayStr = String(d.getUTCDate()).padStart(2, '0');
    const newEndDate = `${y}-${m}-${dayStr}`;

    return {
      isExpired,
      startDate,
      newEndDate,
      duration,
      unit
    };
  };

  const handleRenew = async (o: any) => {
    if (!onRenewOrder || renewingId) return;
    setRenewingId(o.id);
    try {
      const res = await onRenewOrder(o.id);
      await loadAlerts();
      if (onRefreshAlerts) onRefreshAlerts();

      const proj = computeProjectedRenewal(o);
      setRenewalFeedback({
        orderNumber: o.order_number,
        startDate: res?.start_date || proj.startDate,
        newEndDate: res?.new_end_date || proj.newEndDate,
        previousEndDate: o.end_date,
        duration: res?.duration || proj.duration,
        durationUnit: res?.duration_unit || proj.unit
      });
    } catch (err: any) {
      setFeedback({
        type: 'error',
        message: err.message || 'Failed to process renewal.'
      });
    } finally {
      setRenewingId(null);
    }
  };

  // Persistent tracked contacted orders (synced with DB & localStorage)
  const [contactedOrderIds, setContactedOrderIds] = React.useState<Set<string>>(() => {
    try {
      const saved = localStorage.getItem('saas_contacted_orders');
      return saved ? new Set(JSON.parse(saved)) : new Set();
    } catch {
      return new Set();
    }
  });

  const markOrderContacted = (orderId: string) => {
    setContactedOrderIds((prev) => {
      const next = new Set(prev).add(orderId);
      try {
        localStorage.setItem('saas_contacted_orders', JSON.stringify(Array.from(next)));
      } catch {}
      return next;
    });
  };

  // Phone input modal for customers with missing WhatsApp numbers
  const [phonePrompt, setPhonePrompt] = React.useState<{
    order: any;
    eventType: 'order_expiring' | 'order_expired';
  } | null>(null);
  const [phoneInput, setPhoneInput] = React.useState('');
  const [savePhone, setSavePhone] = React.useState(true);
  const [phoneSubmitting, setPhoneSubmitting] = React.useState(false);

  React.useEffect(() => {
    loadAlerts();
  }, []);

  const loadAlerts = async () => {
    setLoading(true);
    try {
      const data = await api.getAlerts();
      setAlerts(data);
      const expiring = data?.expiringOrders || [];
      const expired = data?.expiredOrders || [];
      const total = expiring.length + expired.length;
      onAlertCountChange?.(total);

      // Populate contacted orders from server record
      const serverContacted = new Set<string>();
      [...expiring, ...expired].forEach((o: any) => {
        if (o.whatsapp_contacted_at) {
          serverContacted.add(o.id);
        }
      });
      setContactedOrderIds((prev) => {
        const merged = new Set([...prev, ...serverContacted]);
        try {
          localStorage.setItem('saas_contacted_orders', JSON.stringify(Array.from(merged)));
        } catch {}
        return merged;
      });
    } catch (err) {
      console.error(err);
    } finally {
      setLoading(false);
    }
  };

  const expiringOrders = alerts?.expiringOrders || [];
  const expiredOrders = alerts?.expiredOrders || [];

  const totalCount = expiringOrders.length + expiredOrders.length;

  const triggerOpenWhatsAppUrl = (url: string) => {
    try {
      const link = document.createElement('a');
      link.href = url;
      link.target = '_blank';
      link.rel = 'noopener noreferrer';
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
    } catch (e) {
      window.open(url, '_blank', 'noopener,noreferrer');
    }
  };

  const handleSendWhatsApp = async (
    order: any,
    eventType: 'order_expiring' | 'order_expired'
  ) => {
    // Check if customer has a valid phone number
    const phone = order.customer_whatsapp ? String(order.customer_whatsapp).trim() : '';
    if (!phone) {
      setPhonePrompt({ order, eventType });
      setPhoneInput('');
      setSavePhone(true);
      return;
    }

    setSendingId(order.id);
    setFeedback(null);

    try {
      const res = await api.composeWhatsApp({
        order_id: order.id,
        event_type: eventType
      });

      if (res.waUrl) {
        triggerOpenWhatsAppUrl(res.waUrl);
        setSentId(order.id);
        markOrderContacted(order.id);
        order.whatsapp_contacted_at = new Date().toISOString();
        setTimeout(() => setSentId((prev) => (prev === order.id ? null : prev)), 3500);

        setFeedback({
          type: 'success',
          message: `WhatsApp ${eventType === 'order_expiring' ? 'expiring subscription notice' : 'expired subscription follow-up'} opened for ${order.customer_name} (${res.phone || phone}).`,
          waUrl: res.waUrl
        });
      } else {
        // Missing sanitized phone
        setPhonePrompt({ order, eventType });
        setPhoneInput(phone);
        setSavePhone(true);
      }
    } catch (err: any) {
      console.error('Failed to compose/send WhatsApp message:', err);
      setFeedback({
        type: 'error',
        message: err.message || 'Failed to prepare WhatsApp message. Please check order details.'
      });
    } finally {
      setSendingId(null);
    }
  };

  const handlePhonePromptSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!phonePrompt || !phoneInput.trim()) return;

    setPhoneSubmitting(true);
    const { order, eventType } = phonePrompt;

    try {
      const res = await api.composeWhatsApp({
        order_id: order.id,
        event_type: eventType,
        phone: phoneInput.trim(),
        save_phone: savePhone
      });

      if (res.waUrl) {
        triggerOpenWhatsAppUrl(res.waUrl);
        setSentId(order.id);
        markOrderContacted(order.id);
        order.whatsapp_contacted_at = new Date().toISOString();
        setTimeout(() => setSentId((prev) => (prev === order.id ? null : prev)), 3500);

        // Update local object
        order.customer_whatsapp = phoneInput.trim();

        setFeedback({
          type: 'success',
          message: `WhatsApp ${eventType === 'order_expiring' ? 'expiring subscription notice' : 'expired follow-up'} opened for ${order.customer_name} (${phoneInput.trim()}).`,
          waUrl: res.waUrl
        });

        if (savePhone) {
          onRefreshAlerts?.();
        }
      }

      setPhonePrompt(null);
    } catch (err: any) {
      console.error('Failed to send WhatsApp after entering phone:', err);
      alert(err.message || 'Failed to prepare WhatsApp message with provided number.');
    } finally {
      setPhoneSubmitting(false);
    }
  };

  return (
    <div className="space-y-6">
      {/* Top Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 bg-white p-6 rounded-3xl border border-slate-200/80 shadow-xs">
        <div>
          <div className="flex items-center gap-2.5">
            <h2 className="text-xl font-bold text-slate-900 tracking-tight">
              Action Center & Alerts
            </h2>
            {totalCount > 0 && (
              <span className="px-2.5 py-0.5 rounded-full bg-red-600 text-white font-bold text-xs shadow-xs">
                {totalCount} Active
              </span>
            )}
          </div>
          <p className="text-xs text-slate-500 mt-0.5">
            Real-time proactive triggers for expiring customer subscriptions and expired accounts.
          </p>
        </div>

        <div className="flex items-center gap-2">
          <button
            onClick={loadAlerts}
            disabled={loading}
            className="px-3.5 py-2 rounded-xl border border-slate-200 text-slate-700 font-medium text-xs hover:bg-slate-50 flex items-center gap-1.5 transition shadow-2xs"
          >
            <RefreshCw size={14} className={loading ? 'animate-spin text-blue-600' : ''} />
            <span>Refresh</span>
          </button>
        </div>
      </div>

      {/* Dynamic Feedback Banner */}
      {feedback && (
        <div
          className={`p-4 rounded-2xl border text-xs flex items-center justify-between gap-3 shadow-xs animate-in fade-in duration-200 ${
            feedback.type === 'success'
              ? 'bg-emerald-50 border-emerald-200 text-emerald-900'
              : 'bg-rose-50 border-rose-200 text-rose-900'
          }`}
        >
          <div className="flex items-center gap-2.5 min-w-0">
            {feedback.type === 'success' ? (
              <CheckCircle2 size={16} className="text-emerald-600 shrink-0" />
            ) : (
              <AlertTriangle size={16} className="text-rose-600 shrink-0" />
            )}
            <span className="font-medium truncate">{feedback.message}</span>
          </div>

          <div className="flex items-center gap-2 shrink-0">
            {feedback.waUrl && (
              <a
                href={feedback.waUrl}
                target="_blank"
                rel="noopener noreferrer"
                className="px-2.5 py-1 bg-emerald-600 hover:bg-emerald-500 text-white text-[11px] font-semibold rounded-lg flex items-center gap-1 transition"
              >
                <span>Re-open WhatsApp</span>
                <ExternalLink size={11} />
              </a>
            )}
            <button
              onClick={() => setFeedback(null)}
              className="p-1 hover:bg-black/5 rounded-md transition text-slate-500"
            >
              <X size={14} />
            </button>
          </div>
        </div>
      )}

      {/* Renewal Confirmation & Duration Banner */}
      {renewalFeedback && (
        <div className="p-4 rounded-2xl border border-blue-200 bg-blue-50/90 text-blue-950 flex items-center justify-between gap-3 text-xs shadow-xs animate-in fade-in slide-in-from-top-1 duration-200">
          <div className="flex items-center gap-2.5 min-w-0">
            <div className="w-8 h-8 rounded-xl bg-blue-600 text-white flex items-center justify-center shrink-0 shadow-2xs font-bold">
              <RefreshCw size={15} />
            </div>
            <div>
              <p className="font-bold text-slate-900">
                Order #{renewalFeedback.orderNumber} successfully renewed!
              </p>
              <p className="text-slate-600 text-[11px] mt-0.5">
                New order duration:{' '}
                <span className="font-semibold text-blue-800">
                  {renewalFeedback.startDate} → {renewalFeedback.newEndDate}
                </span>{' '}
                (+{renewalFeedback.duration} {renewalFeedback.durationUnit} from {renewalFeedback.previousEndDate ? `expiration ${renewalFeedback.previousEndDate}` : 'current date'})
              </p>
            </div>
          </div>

          <button
            onClick={() => setRenewalFeedback(null)}
            className="p-1.5 hover:bg-blue-200/50 rounded-lg transition text-slate-600 cursor-pointer"
          >
            <X size={14} />
          </button>
        </div>
      )}

      {/* Tabs */}
      <div className="flex items-center gap-2 border-b border-slate-200/80 pb-3 overflow-x-auto">
        <button
          onClick={() => setActiveTab('all')}
          className={`px-4 py-2 rounded-xl text-xs font-semibold transition flex items-center gap-2 ${
            activeTab === 'all'
              ? 'bg-slate-900 text-white shadow-xs'
              : 'text-slate-600 hover:bg-slate-100'
          }`}
        >
          <span>All Triggers</span>
          <span className={`px-1.5 py-0.2 rounded-full text-[10px] ${activeTab === 'all' ? 'bg-slate-700 text-slate-200' : 'bg-slate-200 text-slate-700'}`}>
            {totalCount}
          </span>
        </button>

        <button
          onClick={() => setActiveTab('expiring')}
          className={`px-4 py-2 rounded-xl text-xs font-semibold transition flex items-center gap-2 ${
            activeTab === 'expiring'
              ? 'bg-amber-600 text-white shadow-xs'
              : 'text-slate-600 hover:bg-slate-100'
          }`}
        >
          <Clock size={13} />
          <span>Expiring Subscriptions</span>
          <span className={`px-1.5 py-0.2 rounded-full text-[10px] ${activeTab === 'expiring' ? 'bg-amber-700 text-white' : 'bg-amber-100 text-amber-800'}`}>
            {expiringOrders.length}
          </span>
        </button>

        <button
          onClick={() => setActiveTab('expired')}
          className={`px-4 py-2 rounded-xl text-xs font-semibold transition flex items-center gap-2 ${
            activeTab === 'expired'
              ? 'bg-rose-600 text-white shadow-xs'
              : 'text-slate-600 hover:bg-slate-100'
          }`}
        >
          <ShieldAlert size={13} />
          <span>Expired Subscriptions</span>
          <span className={`px-1.5 py-0.2 rounded-full text-[10px] ${activeTab === 'expired' ? 'bg-rose-700 text-white' : 'bg-rose-100 text-rose-800'}`}>
            {expiredOrders.length}
          </span>
        </button>
      </div>

      {loading ? (
        <div className="p-12 text-center bg-white rounded-3xl border border-slate-200/80 shadow-xs">
          <RefreshCw size={24} className="animate-spin text-blue-600 mx-auto mb-2" />
          <p className="text-xs text-slate-500 font-medium">Evaluating subscription lifecycles...</p>
        </div>
      ) : totalCount === 0 ? (
        <div className="p-12 text-center bg-white rounded-3xl border border-slate-200/80 shadow-xs">
          <div className="w-12 h-12 rounded-2xl bg-emerald-50 text-emerald-600 flex items-center justify-center mx-auto mb-3">
            <CheckCircle2 size={24} />
          </div>
          <h3 className="text-sm font-bold text-slate-800">All Operations Clear</h3>
          <p className="text-xs text-slate-500 mt-1 max-w-sm mx-auto">
            No active subscriptions are expiring within 3 days and no accounts have expired.
          </p>
        </div>
      ) : (
        <div className="space-y-6">
          {/* 1. Expiring Orders Section */}
          {(activeTab === 'all' || activeTab === 'expiring') && expiringOrders.length > 0 && (
            <div className="bg-white rounded-3xl border border-amber-200/80 shadow-xs overflow-hidden">
              <div className="p-5 border-b border-amber-100 bg-amber-50/50 flex items-center justify-between">
                <div className="flex items-center gap-2 text-amber-900">
                  <Clock size={16} className="text-amber-600" />
                  <h3 className="text-sm font-bold">
                    Expiring Within 3 Days ({expiringOrders.length})
                  </h3>
                </div>
              </div>

              <div className="divide-y divide-slate-100">
                {expiringOrders.map((o: any) => {
                  const proj = computeProjectedRenewal(o);
                  return (
                    <div key={o.id} className="p-4 sm:p-5 flex flex-col sm:flex-row sm:items-center justify-between gap-4 hover:bg-slate-50/80 transition">
                      <div className="space-y-1.5">
                        <div className="flex items-center gap-2">
                          <span className="font-mono text-xs font-bold text-slate-900">#{o.order_number}</span>
                          <span className="px-2 py-0.5 rounded-full bg-amber-100 text-amber-800 text-[10px] font-bold">
                            Expires: {o.end_date} {o.days_remaining !== undefined && (o.days_remaining <= 0 ? '(Today)' : `(${o.days_remaining}d left)`)}
                          </span>
                        </div>
                        <p className="text-xs font-medium text-slate-800">
                          {o.customer_name} &bull; <span className="text-blue-600">{o.product_name}</span> ({o.plan_name})
                        </p>
                      </div>

                      <div className="flex items-center gap-2">
                        {onRenewOrder && (
                          <button
                            id={`btn-renew-${o.id}`}
                            onClick={() => handleRenew(o)}
                            disabled={renewingId === o.id}
                            className="px-3 py-1.5 bg-blue-600 hover:bg-blue-500 active:bg-blue-700 disabled:opacity-50 text-white rounded-xl text-xs font-semibold flex items-center gap-1.5 shadow-xs transition cursor-pointer"
                            title={`Renew order duration from ${proj.startDate} to ${proj.newEndDate} (+${proj.duration} ${proj.unit})`}
                          >
                            <RefreshCw size={13} className={renewingId === o.id ? 'animate-spin' : ''} />
                            <span>{renewingId === o.id ? 'Renewing...' : 'Renew'}</span>
                          </button>
                        )}

                        {/* Contacted Check Icon near Send Button */}
                        {(o.whatsapp_contacted_at || contactedOrderIds.has(o.id)) && (
                          <span
                            id={`contacted-check-expiring-${o.id}`}
                            className="inline-flex items-center gap-1.5 px-2.5 py-1.5 rounded-xl bg-emerald-50 border border-emerald-200 text-emerald-700 text-xs font-medium shadow-2xs transition animate-in fade-in duration-200"
                            title={
                              o.whatsapp_contacted_at
                                ? `WhatsApp message sent on ${new Date(o.whatsapp_contacted_at).toLocaleDateString()} at ${new Date(o.whatsapp_contacted_at).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}`
                                : 'WhatsApp message sent successfully'
                            }
                          >
                            <CheckCircle2 size={14} className="text-emerald-600 shrink-0 stroke-[2.5]" />
                            <span className="text-[11px] font-semibold text-emerald-800 hidden sm:inline">Contacted</span>
                          </span>
                        )}
                        
                        {/* Send Green Icon Button for Expiring Order */}
                        <button
                          id={`send-whatsapp-expiring-${o.id}`}
                          onClick={() => handleSendWhatsApp(o, 'order_expiring')}
                          disabled={sendingId === o.id}
                          className={`px-3 py-1.5 rounded-xl text-xs font-semibold flex items-center gap-1.5 shadow-xs transition cursor-pointer ${
                            sentId === o.id
                              ? 'bg-emerald-700 text-white shadow-emerald-700/20 ring-2 ring-emerald-300'
                              : 'bg-emerald-600 hover:bg-emerald-500 active:bg-emerald-700 text-white shadow-emerald-600/20'
                          }`}
                          title={
                            o.customer_whatsapp
                              ? `Send expiring WhatsApp reminder template to ${o.customer_whatsapp}`
                              : 'Send expiring WhatsApp reminder template to customer'
                          }
                        >
                          {sendingId === o.id ? (
                            <RefreshCw size={13} className="animate-spin" />
                          ) : sentId === o.id ? (
                            <Check size={13} />
                          ) : (
                            <Send size={13} />
                          )}
                          <span>{sendingId === o.id ? 'Sending...' : sentId === o.id ? 'Sent!' : 'Send'}</span>
                        </button>
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>
          )}

          {/* 2. Expired Orders Section */}
          {(activeTab === 'all' || activeTab === 'expired') && expiredOrders.length > 0 && (
            <div className="bg-white rounded-3xl border border-rose-200/80 shadow-xs overflow-hidden">
              <div className="p-5 border-b border-rose-100 bg-rose-50/50 flex items-center justify-between">
                <div className="flex items-center gap-2 text-rose-900">
                  <ShieldAlert size={16} className="text-rose-600" />
                  <h3 className="text-sm font-bold">
                    Past Expiration ({expiredOrders.length})
                  </h3>
                </div>
              </div>

              <div className="divide-y divide-slate-100">
                {expiredOrders.map((o: any) => {
                  const proj = computeProjectedRenewal(o);
                  return (
                    <div key={o.id} className="p-4 sm:p-5 flex flex-col sm:flex-row sm:items-center justify-between gap-4 hover:bg-slate-50/80 transition">
                      <div className="space-y-1.5">
                        <div className="flex items-center gap-2">
                          <span className="font-mono text-xs font-bold text-slate-900">#{o.order_number}</span>
                          <span className="px-2 py-0.5 rounded-full bg-rose-100 text-rose-800 text-[10px] font-bold">
                            Expired: {o.end_date} {o.days_expired !== undefined && `(${o.days_expired}d ago)`}
                          </span>
                        </div>
                        <p className="text-xs font-medium text-slate-800">
                          {o.customer_name} &bull; <span className="text-slate-600">{o.product_name}</span> ({o.plan_name})
                        </p>
                      </div>

                      <div className="flex items-center gap-2">
                        {onRenewOrder && (
                          <button
                            id={`btn-reactivate-${o.id}`}
                            onClick={() => handleRenew(o)}
                            disabled={renewingId === o.id}
                            className="px-3 py-1.5 bg-blue-600 hover:bg-blue-500 active:bg-blue-700 disabled:opacity-50 text-white rounded-xl text-xs font-semibold flex items-center gap-1.5 shadow-xs transition cursor-pointer"
                            title={`Reactivate order duration starting today until ${proj.newEndDate} (+${proj.duration} ${proj.unit})`}
                          >
                            <RefreshCw size={13} className={renewingId === o.id ? 'animate-spin' : ''} />
                            <span>{renewingId === o.id ? 'Reactivating...' : 'Reactivate'}</span>
                          </button>
                        )}

                        {/* Contacted Check Icon near Send Button */}
                        {(o.whatsapp_contacted_at || contactedOrderIds.has(o.id)) && (
                          <span
                            id={`contacted-check-expired-${o.id}`}
                            className="inline-flex items-center gap-1.5 px-2.5 py-1.5 rounded-xl bg-emerald-50 border border-emerald-200 text-emerald-700 text-xs font-medium shadow-2xs transition animate-in fade-in duration-200"
                            title={
                              o.whatsapp_contacted_at
                                ? `WhatsApp message sent on ${new Date(o.whatsapp_contacted_at).toLocaleDateString()} at ${new Date(o.whatsapp_contacted_at).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}`
                                : 'WhatsApp message sent successfully'
                            }
                          >
                            <CheckCircle2 size={14} className="text-emerald-600 shrink-0 stroke-[2.5]" />
                            <span className="text-[11px] font-semibold text-emerald-800 hidden sm:inline">Contacted</span>
                          </span>
                        )}

                        {/* Send Green Icon Button for Expired Order */}
                        <button
                          id={`send-whatsapp-expired-${o.id}`}
                          onClick={() => handleSendWhatsApp(o, 'order_expired')}
                          disabled={sendingId === o.id}
                          className={`px-3 py-1.5 rounded-xl text-xs font-semibold flex items-center gap-1.5 shadow-xs transition cursor-pointer ${
                            sentId === o.id
                              ? 'bg-emerald-700 text-white shadow-emerald-700/20 ring-2 ring-emerald-300'
                              : 'bg-emerald-600 hover:bg-emerald-500 active:bg-emerald-700 text-white shadow-emerald-600/20'
                          }`}
                          title={
                            o.customer_whatsapp
                              ? `Send expired follow-up WhatsApp template to ${o.customer_whatsapp}`
                              : 'Send expired follow-up WhatsApp template to customer'
                          }
                        >
                          {sendingId === o.id ? (
                            <RefreshCw size={13} className="animate-spin" />
                          ) : sentId === o.id ? (
                            <Check size={13} />
                          ) : (
                            <Send size={13} />
                          )}
                          <span>{sendingId === o.id ? 'Sending...' : sentId === o.id ? 'Sent!' : 'Send'}</span>
                        </button>
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>
          )}
        </div>
      )}

      {/* Modal: Customer Phone Entry (if missing in order) */}
      {phonePrompt && (
        <div className="fixed inset-0 z-50 bg-slate-900/60 backdrop-blur-xs flex items-center justify-center p-4">
          <div className="bg-white rounded-3xl max-w-md w-full p-6 shadow-2xl border border-slate-200 animate-in zoom-in-95 duration-150">
            <div className="flex items-center justify-between pb-3 border-b border-slate-100">
              <div className="flex items-center gap-2 text-emerald-700">
                <div className="w-8 h-8 rounded-xl bg-emerald-50 text-emerald-600 flex items-center justify-center">
                  <Send size={16} />
                </div>
                <div>
                  <h3 className="text-sm font-bold text-slate-900">Send WhatsApp Notification</h3>
                  <p className="text-[11px] text-slate-500">
                    {phonePrompt.eventType === 'order_expiring' ? 'Expiring Subscription Template' : 'Expired Subscription Template'}
                  </p>
                </div>
              </div>
              <button
                onClick={() => setPhonePrompt(null)}
                className="p-1.5 hover:bg-slate-100 rounded-lg text-slate-400 hover:text-slate-600 transition"
              >
                <X size={16} />
              </button>
            </div>

            <form onSubmit={handlePhonePromptSubmit} className="mt-4 space-y-4">
              <div className="p-3.5 rounded-2xl bg-slate-50 border border-slate-100 text-xs space-y-1">
                <p className="font-semibold text-slate-800">
                  Customer: {phonePrompt.order.customer_name}
                </p>
                <p className="text-slate-500">
                  Order #{phonePrompt.order.order_number} &bull; {phonePrompt.order.product_name} ({phonePrompt.order.plan_name})
                </p>
              </div>

              <div>
                <label className="block text-xs font-semibold text-slate-700 mb-1.5">
                  Customer WhatsApp Phone Number <span className="text-red-500">*</span>
                </label>
                <div className="relative">
                  <Phone size={15} className="absolute left-3.5 top-1/2 -translate-y-1/2 text-slate-400" />
                  <input
                    type="tel"
                    required
                    autoFocus
                    placeholder="e.g. +14155552671 or 4155552671"
                    value={phoneInput}
                    onChange={(e) => setPhoneInput(e.target.value)}
                    className="w-full pl-10 pr-3.5 py-2.5 bg-slate-50 border border-slate-200 rounded-xl text-xs text-slate-800 focus:outline-hidden focus:bg-white focus:border-emerald-500 transition"
                  />
                </div>
                <p className="text-[10px] text-slate-400 mt-1">
                  Include international country code (e.g. +1 for US, +44 for UK, +966 for KSA).
                </p>
              </div>

              <div className="flex items-center gap-2">
                <input
                  type="checkbox"
                  id="save-customer-phone"
                  checked={savePhone}
                  onChange={(e) => setSavePhone(e.target.checked)}
                  className="rounded-md border-slate-300 text-emerald-600 focus:ring-emerald-500"
                />
                <label htmlFor="save-customer-phone" className="text-xs text-slate-600 cursor-pointer">
                  Save this phone number to customer record for future alerts
                </label>
              </div>

              <div className="flex items-center gap-2 pt-2">
                <button
                  type="button"
                  onClick={() => setPhonePrompt(null)}
                  className="flex-1 py-2.5 px-4 bg-slate-100 hover:bg-slate-200 text-slate-700 font-semibold text-xs rounded-xl transition"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={phoneSubmitting || !phoneInput.trim()}
                  className="flex-1 py-2.5 px-4 bg-emerald-600 hover:bg-emerald-500 active:bg-emerald-700 text-white font-semibold text-xs rounded-xl flex items-center justify-center gap-1.5 shadow-md shadow-emerald-600/20 transition disabled:opacity-50"
                >
                  {phoneSubmitting ? (
                    <RefreshCw size={14} className="animate-spin" />
                  ) : (
                    <Send size={14} />
                  )}
                  <span>{phoneSubmitting ? 'Preparing...' : 'Send WhatsApp'}</span>
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
};
