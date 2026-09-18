import React from 'react';
import { X, Check, Copy, MessageSquare, Shield, Key, ExternalLink, Download } from 'lucide-react';
import { api } from '../api';
import { useCurrency } from '../context/CurrencyContext';

interface DeliveryReceiptModalProps {
  isOpen?: boolean;
  onClose: () => void;
  order: any;
}

export const DeliveryReceiptModal: React.FC<DeliveryReceiptModalProps> = ({
  isOpen = true,
  onClose,
  order
}) => {
  const { format: formatMoney } = useCurrency();
  const [copied, setCopied] = React.useState(false);
  const [waMessage, setWaMessage] = React.useState('');
  const [waUrl, setWaUrl] = React.useState<string | null>(null);
  const [lang, setLang] = React.useState('en');
  const [loadingWa, setLoadingWa] = React.useState(false);

  React.useEffect(() => {
    if (isOpen && order) {
      loadWhatsAppMessage(lang);
    }
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape' && isOpen) {
        onClose();
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [isOpen, order, lang, onClose]);

  const loadWhatsAppMessage = async (selectedLang: string) => {
    if (!order?.id) return;
    setLoadingWa(true);
    try {
      const res = await api.composeWhatsApp({
        order_id: order.id,
        language: selectedLang,
        event_type: 'order_created'
      });
      setWaMessage(res.message);
      setWaUrl(res.waUrl);
    } catch (err) {
      console.error(err);
    } finally {
      setLoadingWa(false);
    }
  };

  const handleCopy = (text: string) => {
    navigator.clipboard.writeText(text);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  if (!isOpen || !order) return null;

  const fulfillment = order.fulfillment_data || {};

  return (
    <div
      id="delivery-receipt-modal-backdrop"
      onClick={onClose}
      className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/40 backdrop-blur-xs p-4 overflow-y-auto"
    >
      <div
        id="delivery-receipt-modal-dialog"
        onClick={(e) => e.stopPropagation()}
        className="w-full max-w-xl bg-white rounded-3xl shadow-2xl border border-slate-200 overflow-hidden my-8 animate-in fade-in zoom-in-95 duration-150"
      >
        {/* Header */}
        <div className="px-6 py-4 bg-emerald-600 text-white flex items-center justify-between">
          <div className="flex items-center gap-2.5">
            <div className="w-8 h-8 rounded-full bg-white/20 flex items-center justify-center">
              <Check size={18} />
            </div>
            <div>
              <h3 className="font-bold text-sm">Order Fulfilled Successfully!</h3>
              <p className="text-xs text-emerald-100">Order #{order.order_number}</p>
            </div>
          </div>
          <button onClick={onClose} className="text-white/80 hover:text-white p-1">
            <X size={18} />
          </button>
        </div>

        {/* Body */}
        <div className="p-6 space-y-5">
          {/* Order Snapshot */}
          <div className="p-4 rounded-2xl bg-slate-50 border border-slate-150 grid grid-cols-2 gap-3 text-xs">
            <div>
              <span className="text-slate-400 block text-[10px] uppercase font-semibold">Customer</span>
              <span className="font-semibold text-slate-800">{order.customer_name}</span>
            </div>
            <div>
              <span className="text-slate-400 block text-[10px] uppercase font-semibold">Product & Plan</span>
              <span className="font-semibold text-slate-800">{order.product_name} ({order.plan_name})</span>
            </div>
            <div>
              <span className="text-slate-400 block text-[10px] uppercase font-semibold">Start & End Date</span>
              <span className="font-semibold text-slate-800">{order.start_date} → {order.end_date}</span>
            </div>
            <div>
              <span className="text-slate-400 block text-[10px] uppercase font-semibold">Amount Paid</span>
              <span className="font-bold text-emerald-700">{formatMoney(order.price, order.currency || 'USD')}</span>
            </div>
          </div>

          {/* Service Account Credentials (if applicable) */}
          {fulfillment.login && (
            <div className="p-4 rounded-2xl bg-blue-50/60 border border-blue-200 space-y-3">
              <div className="flex items-center justify-between">
                <span className="text-xs font-semibold text-blue-950 flex items-center gap-1.5">
                  <Shield size={14} className="text-blue-600" />
                  Service Account Credentials
                </span>
                <button
                  onClick={() => handleCopy(`Provider: ${fulfillment.provider}\nLogin: ${fulfillment.login}\nPassword: ${fulfillment.password}\nProfile: ${fulfillment.profile_name || 'Assigned'}\nPIN: ${fulfillment.pin || 'None'}`)}
                  className="px-2.5 py-1 bg-white border border-blue-200 rounded-lg text-[11px] font-medium text-blue-700 hover:bg-blue-50 flex items-center gap-1 transition shadow-2xs"
                >
                  {copied ? <Check size={12} /> : <Copy size={12} />}
                  <span>{copied ? 'Copied' : 'Copy All'}</span>
                </button>
              </div>

              <div className="grid grid-cols-2 gap-2 text-xs font-mono bg-white p-3 rounded-xl border border-blue-100">
                <div>
                  <span className="text-[10px] text-slate-400 font-sans block">Account Login:</span>
                  <span className="text-slate-800 font-bold">{fulfillment.login}</span>
                </div>
                <div>
                  <span className="text-[10px] text-slate-400 font-sans block">Password:</span>
                  <span className="text-slate-800 font-bold">{fulfillment.password}</span>
                </div>
                {fulfillment.profile_name && (
                  <div>
                    <span className="text-[10px] text-slate-400 font-sans block">Assigned Profile:</span>
                    <span className="text-slate-800 font-bold">{fulfillment.profile_name}</span>
                  </div>
                )}
                {fulfillment.pin && (
                  <div>
                    <span className="text-[10px] text-slate-400 font-sans block">Profile PIN:</span>
                    <span className="text-slate-800 font-bold">{fulfillment.pin}</span>
                  </div>
                )}
              </div>
            </div>
          )}

          {/* License Key (if applicable) */}
          {fulfillment.license_key && (
            <div className="p-4 rounded-2xl bg-purple-50/60 border border-purple-200 space-y-2">
              <div className="flex items-center justify-between">
                <span className="text-xs font-semibold text-purple-950 flex items-center gap-1.5">
                  <Key size={14} className="text-purple-600" />
                  Allocated License Key
                </span>
                <button
                  onClick={() => handleCopy(fulfillment.license_key)}
                  className="px-2.5 py-1 bg-white border border-purple-200 rounded-lg text-[11px] font-medium text-purple-700 hover:bg-purple-50 flex items-center gap-1 transition shadow-2xs"
                >
                  {copied ? <Check size={12} /> : <Copy size={12} />}
                  <span>{copied ? 'Copied' : 'Copy Key'}</span>
                </button>
              </div>
              <div className="bg-white p-3 rounded-xl border border-purple-100 font-mono text-xs font-bold text-slate-800">
                {fulfillment.license_key}
              </div>
            </div>
          )}

          {/* WhatsApp Direct Dispatch Section */}
          <div className="space-y-2 pt-2 border-t border-slate-150">
            <div className="flex items-center justify-between">
              <label className="text-xs font-semibold text-slate-700 flex items-center gap-1.5">
                <MessageSquare size={13} className="text-emerald-600" />
                Customer WhatsApp Delivery
              </label>
              <div className="flex items-center gap-1">
                {['en', 'fr', 'ar', 'ru'].map((code) => (
                  <button
                    key={code}
                    onClick={() => setLang(code)}
                    className={`px-2 py-0.5 rounded-md text-[10px] font-semibold uppercase transition ${
                      lang === code
                        ? 'bg-emerald-600 text-white'
                        : 'bg-slate-100 text-slate-500 hover:bg-slate-200'
                    }`}
                  >
                    {code}
                  </button>
                ))}
              </div>
            </div>

            <textarea
              rows={3}
              value={waMessage}
              onChange={(e) => setWaMessage(e.target.value)}
              className="w-full bg-slate-50 border border-slate-200 rounded-xl p-3 text-xs text-slate-700 focus:outline-hidden focus:bg-white"
            />

            <div className="flex items-center gap-2 pt-1">
              {waUrl ? (
                <a
                  href={waUrl}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="flex-1 py-2.5 px-4 bg-emerald-600 hover:bg-emerald-500 text-white text-xs font-semibold rounded-xl flex items-center justify-center gap-2 shadow-md shadow-emerald-600/20 transition"
                >
                  <MessageSquare size={15} />
                  <span>Send via WhatsApp</span>
                  <ExternalLink size={13} />
                </a>
              ) : (
                <button
                  disabled
                  className="flex-1 py-2.5 px-4 bg-slate-100 text-slate-400 text-xs font-semibold rounded-xl cursor-not-allowed"
                >
                  No WhatsApp Number Provided
                </button>
              )}

              <button
                onClick={() => handleCopy(waMessage)}
                className="py-2.5 px-4 bg-slate-100 hover:bg-slate-200 text-slate-700 text-xs font-medium rounded-xl flex items-center gap-1.5 transition"
              >
                <Copy size={14} />
                <span>Copy</span>
              </button>
            </div>
          </div>
        </div>

        <div className="p-4 bg-slate-50 border-t border-slate-100 text-right">
          <button
            onClick={onClose}
            className="px-5 py-2 bg-slate-800 hover:bg-slate-700 text-white rounded-xl text-xs font-semibold transition"
          >
            Done
          </button>
        </div>
      </div>
    </div>
  );
};
