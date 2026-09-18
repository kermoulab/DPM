import React from 'react';
import { X, Check, AlertCircle, Sparkles, User, Box, Calendar, CreditCard, Shield, Plus } from 'lucide-react';
import { api } from '../api';
import type { Customer, Product, Plan } from '../types';
import { useCurrency } from '../context/CurrencyContext';

interface OrderBuilderModalProps {
  isOpen: boolean;
  onClose: () => void;
  onOrderCreated: (order: any) => void;
  preselectedCustomerId?: string;
  preselectedProductId?: string;
}

export const OrderBuilderModal: React.FC<OrderBuilderModalProps> = ({
  isOpen,
  onClose,
  onOrderCreated,
  preselectedCustomerId,
  preselectedProductId
}) => {
  const { format: formatMoney } = useCurrency();
  const [customers, setCustomers] = React.useState<Customer[]>([]);
  const [products, setProducts] = React.useState<Product[]>([]);
  const [plans, setPlans] = React.useState<Plan[]>([]);
  
  const [selectedCustomerId, setSelectedCustomerId] = React.useState(preselectedCustomerId || '');
  const [selectedProductId, setSelectedProductId] = React.useState(preselectedProductId || '');
  const [selectedPlanId, setSelectedPlanId] = React.useState('');
  const [startDate, setStartDate] = React.useState(new Date().toISOString().split('T')[0]);
  const [paymentMethod, setPaymentMethod] = React.useState('cash');
  const [notes, setNotes] = React.useState('');

  // Merch / Mockup specific dynamic fields
  const [logoUrl, setLogoUrl] = React.useState('');
  const [merchColor, setMerchColor] = React.useState('#1e293b');
  const [placement, setPlacement] = React.useState('chest_center');

  // Dynamic calculated info
  const [dateInfo, setDateInfo] = React.useState<{ start_date: string; end_date: string; price: number; currency: string } | null>(null);
  const [inventorySummary, setInventorySummary] = React.useState<any>(null);

  // Quick Customer Creation inline state
  const [showNewCustomer, setShowNewCustomer] = React.useState(false);
  const [newCustName, setNewCustName] = React.useState('');
  const [newCustEmail, setNewCustEmail] = React.useState('');
  const [newCustWhatsapp, setNewCustWhatsapp] = React.useState('');

  const [loading, setLoading] = React.useState(false);
  const [error, setError] = React.useState<string | null>(null);

  React.useEffect(() => {
    if (isOpen) {
      loadInitialData();
    }
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape' && isOpen) {
        onClose();
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [isOpen, onClose]);

  const loadInitialData = async () => {
    try {
      const [cRes, pRes] = await Promise.all([
        api.getCustomers({ status: 'active' }),
        api.getProducts({ status: 'active' })
      ]);
      setCustomers(cRes.customers);
      setProducts(pRes.products);

      if (preselectedCustomerId) setSelectedCustomerId(preselectedCustomerId);
      if (preselectedProductId) handleProductChange(preselectedProductId);
      else if (pRes.products.length > 0) handleProductChange(pRes.products[0].id);
    } catch (err: any) {
      setError(err.message);
    }
  };

  const handleProductChange = async (prodId: string) => {
    setSelectedProductId(prodId);
    setSelectedPlanId('');
    setDateInfo(null);
    try {
      const details = await api.getProduct(prodId);
      setPlans(details.plans);
      setInventorySummary(details.inventorySummary);
      if (details.plans.length > 0) {
        handlePlanChange(details.plans[0].id, prodId);
      }
    } catch (err: any) {
      setError(err.message);
    }
  };

  const handlePlanChange = async (planId: string, prodId = selectedProductId) => {
    setSelectedPlanId(planId);
    try {
      const calc = await api.calculateDates(planId, startDate);
      setDateInfo(calc);
    } catch (err: any) {
      setError(err.message);
    }
  };

  const handleStartDateChange = async (date: string) => {
    setStartDate(date);
    if (selectedPlanId) {
      try {
        const calc = await api.calculateDates(selectedPlanId, date);
        setDateInfo(calc);
      } catch (err: any) {
        setError(err.message);
      }
    }
  };

  const handleCreateCustomer = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newCustName.trim()) return;
    try {
      const res = await api.createCustomer({
        name: newCustName,
        email: newCustEmail,
        whatsapp: newCustWhatsapp
      });
      const newCust: Customer = {
        id: res.id,
        name: newCustName,
        email: newCustEmail,
        whatsapp: newCustWhatsapp,
        status: 'active',
        created_at: new Date().toISOString()
      };
      setCustomers([newCust, ...customers]);
      setSelectedCustomerId(res.id);
      setShowNewCustomer(false);
      setNewCustName('');
      setNewCustEmail('');
      setNewCustWhatsapp('');
    } catch (err: any) {
      setError(err.message);
    }
  };

  const isProductStockFull = Boolean(inventorySummary?.isStockFull);
  const selectedPlan = plans.find((p) => p.id === selectedPlanId);
  const isPlanStockFull = Boolean(selectedPlan?.is_stock_full);
  const cannotOrder = isProductStockFull || isPlanStockFull;

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedCustomerId || !selectedProductId || !selectedPlanId) {
      setError('Please select a customer, product, and plan.');
      return;
    }

    if (isProductStockFull) {
      setError(`Cannot create order: Stock for this product is full. ${inventorySummary?.stockReason || ''}`);
      return;
    }

    if (isPlanStockFull) {
      setError(`Cannot create order: Stock for plan "${selectedPlan?.name}" is full.`);
      return;
    }

    setLoading(true);
    setError(null);

    const product = products.find((p) => p.id === selectedProductId);
    const caps = product?.capabilities || [];

    const fulfillmentMeta: Record<string, any> = {};
    if (caps.includes('merch_mockup') || caps.includes('digital_file')) {
      fulfillmentMeta.logo_url = logoUrl;
      fulfillmentMeta.color = merchColor;
      fulfillmentMeta.placement = placement;
      fulfillmentMeta.print_specs = {
        resolution: '300 DPI',
        dimensions: '4500x5400 px',
        bleed: '0.125 in',
        color_profile: 'CMYK FOGRA39'
      };
    }

    try {
      const res = await api.createOrder({
        customer_id: selectedCustomerId,
        product_id: selectedProductId,
        plan_id: selectedPlanId,
        start_date: startDate,
        payment_method: paymentMethod,
        notes,
        fulfillment_meta: fulfillmentMeta
      });

      onOrderCreated(res.order);
      onClose();
    } catch (err: any) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  };

  if (!isOpen) return null;

  const currentProduct = products.find((p) => p.id === selectedProductId);
  const capabilities = currentProduct?.capabilities || [];

  return (
    <div
      id="order-builder-modal-backdrop"
      onClick={onClose}
      className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/40 backdrop-blur-xs p-4 overflow-y-auto"
    >
      <div
        id="order-builder-modal-dialog"
        onClick={(e) => e.stopPropagation()}
        className="w-full max-w-2xl bg-white rounded-3xl shadow-2xl border border-slate-200 overflow-hidden my-8 animate-in fade-in zoom-in-95 duration-150"
      >
        {/* Header */}
        <div className="px-6 py-4 border-b border-slate-100 flex items-center justify-between bg-gradient-to-r from-slate-50 to-white">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-2xl bg-blue-600 text-white flex items-center justify-center font-bold shadow-md shadow-blue-600/30">
              ⚡
            </div>
            <div>
              <h3 className="font-bold text-slate-800 text-base">Add new order</h3>
              <p className="text-xs text-slate-400">Create and assign customer subscription</p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="p-2 rounded-xl text-slate-400 hover:text-slate-600 hover:bg-slate-100 transition"
          >
            <X size={18} />
          </button>
        </div>

        {error && (
          <div className="mx-6 mt-4 p-3.5 rounded-xl bg-red-50 border border-red-200 text-red-700 text-xs flex items-center gap-2">
            <AlertCircle size={16} className="shrink-0" />
            <span>{error}</span>
          </div>
        )}

        {/* Form Body */}
        <form onSubmit={handleSubmit} className="p-6 space-y-5">
          {/* 1. Customer Selection */}
          <div className="space-y-1.5">
            <div className="flex items-center justify-between">
              <label className="text-xs font-semibold text-slate-700 uppercase tracking-wider flex items-center gap-1.5">
                <User size={13} className="text-blue-600" />
                Select Customer
              </label>
              <button
                type="button"
                onClick={() => setShowNewCustomer(!showNewCustomer)}
                className="text-xs text-blue-600 hover:text-blue-700 font-medium flex items-center gap-1"
              >
                <Plus size={13} />
                <span>{showNewCustomer ? 'Cancel' : 'New Customer'}</span>
              </button>
            </div>

            {showNewCustomer ? (
              <div className="p-4 rounded-2xl bg-slate-50 border border-slate-200 space-y-3">
                <p className="text-xs font-semibold text-slate-700">Add New Customer</p>
                <div className="grid grid-cols-1 sm:grid-cols-3 gap-2">
                  <input
                    type="text"
                    placeholder="Full Name *"
                    value={newCustName}
                    onChange={(e) => setNewCustName(e.target.value)}
                    className="bg-white border border-slate-200 rounded-xl px-3 py-2 text-xs text-slate-800"
                    required
                  />
                  <input
                    type="email"
                    placeholder="Email Address"
                    value={newCustEmail}
                    onChange={(e) => setNewCustEmail(e.target.value)}
                    className="bg-white border border-slate-200 rounded-xl px-3 py-2 text-xs text-slate-800"
                  />
                  <input
                    type="text"
                    placeholder="WhatsApp (+1202...)"
                    value={newCustWhatsapp}
                    onChange={(e) => setNewCustWhatsapp(e.target.value)}
                    className="bg-white border border-slate-200 rounded-xl px-3 py-2 text-xs text-slate-800"
                  />
                </div>
                <button
                  type="button"
                  onClick={handleCreateCustomer}
                  className="px-4 py-2 bg-blue-600 text-white rounded-xl text-xs font-medium hover:bg-blue-500 transition"
                >
                  Save & Select Customer
                </button>
              </div>
            ) : (
              <select
                value={selectedCustomerId}
                onChange={(e) => setSelectedCustomerId(e.target.value)}
                className="w-full bg-slate-50 border border-slate-200 rounded-xl px-3.5 py-2.5 text-xs text-slate-800 focus:outline-hidden focus:border-blue-600 focus:bg-white transition"
                required
              >
                <option value="">-- Choose Customer --</option>
                {customers.map((c) => (
                  <option key={c.id} value={c.id}>
                    {c.name} {c.whatsapp ? `(${c.whatsapp})` : c.email ? `(${c.email})` : ''}
                  </option>
                ))}
              </select>
            )}
          </div>

          {/* 2. Product Selection */}
          <div className="space-y-1.5">
            <div className="flex items-center justify-between">
              <label className="text-xs font-semibold text-slate-700 uppercase tracking-wider flex items-center gap-1.5">
                <Box size={13} className="text-blue-600" />
                Product & Capabilities
              </label>
              {inventorySummary && (
                <span className={`px-2 py-0.5 rounded-md font-semibold text-[10px] border ${
                  inventorySummary.isStockFull
                    ? 'bg-rose-50 text-rose-700 border-rose-200'
                    : 'bg-emerald-50 text-emerald-700 border-emerald-100'
                }`}>
                  {inventorySummary.isStockFull
                    ? '● Stock Full (0 Available)'
                    : `Stock: ${inventorySummary.availableProfiles + inventorySummary.availableLicenses} available`}
                </span>
              )}
            </div>
            <select
              value={selectedProductId}
              onChange={(e) => handleProductChange(e.target.value)}
              className="w-full bg-slate-50 border border-slate-200 rounded-xl px-3.5 py-2.5 text-xs text-slate-800 focus:outline-hidden focus:border-blue-600 focus:bg-white transition"
              required
            >
              {products.map((p) => (
                <option key={p.id} value={p.id}>
                  {p.name} ({p.brand || 'Digital'} - {p.category_name}) {p.is_stock_full ? '— [STOCK FULL]' : ''}
                </option>
              ))}
            </select>

            {/* Dynamic Capabilities Display */}
            {currentProduct && (
              <div className="flex flex-wrap gap-1.5 pt-1">
                {capabilities.map((c) => (
                  <span
                    key={c}
                    className="px-2 py-0.5 rounded-md bg-blue-50 text-blue-700 font-medium text-[10px] uppercase tracking-wide border border-blue-100"
                  >
                    {c.replace('_', ' ')}
                  </span>
                ))}
              </div>
            )}

            {/* Stock Full Warning Banner */}
            {isProductStockFull && (
              <div className="p-3 bg-rose-50 border border-rose-200 rounded-xl text-rose-700 text-xs flex items-start gap-2.5 mt-2">
                <AlertCircle size={16} className="text-rose-500 shrink-0 mt-0.5" />
                <div>
                  <p className="font-bold">Stock is Full for this Product</p>
                  <p className="text-[11px] text-rose-600 mt-0.5">
                    {inventorySummary?.stockReason || 'All available inventory slots or licenses are occupied. Cannot assign or create more orders until stock is replenished.'}
                  </p>
                </div>
              </div>
            )}
          </div>

          {/* 3. Plan & Authoritative Duration */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div className="space-y-1.5">
              <label className="text-xs font-semibold text-slate-700 uppercase tracking-wider flex items-center gap-1.5">
                <Calendar size={13} className="text-blue-600" />
                Subscription Plan
              </label>
              <select
                value={selectedPlanId}
                onChange={(e) => handlePlanChange(e.target.value)}
                className="w-full bg-slate-50 border border-slate-200 rounded-xl px-3.5 py-2.5 text-xs text-slate-800 focus:outline-hidden focus:border-blue-600 focus:bg-white transition"
                required
              >
                <option value="">-- Choose Plan --</option>
                {plans.map((pl) => (
                  <option key={pl.id} value={pl.id} disabled={pl.is_stock_full}>
                    {pl.name} — {formatMoney(pl.price, 'USD')} ({pl.duration} {pl.duration_unit}) {pl.is_stock_full ? '— [STOCK FULL]' : ''}
                  </option>
                ))}
              </select>

              {isPlanStockFull && !isProductStockFull && (
                <p className="text-[11px] text-amber-600 font-medium flex items-center gap-1 pt-1">
                  <AlertCircle size={12} />
                  <span>This plan capacity is full. Please select a different plan.</span>
                </p>
              )}
            </div>

            <div className="space-y-1.5">
              <label className="text-xs font-semibold text-slate-700 uppercase tracking-wider flex items-center gap-1.5">
                Start Date
              </label>
              <input
                type="date"
                value={startDate}
                onChange={(e) => handleStartDateChange(e.target.value)}
                className="w-full bg-slate-50 border border-slate-200 rounded-xl px-3.5 py-2 text-xs text-slate-800 focus:outline-hidden focus:border-blue-600 focus:bg-white transition"
              />
            </div>
          </div>

          {/* 4. Calculated Dates Preview (Authoritative) */}
          {dateInfo && (
            <div className="p-3.5 rounded-2xl bg-blue-50/60 border border-blue-100 flex items-center justify-between text-xs">
              <div>
                <span className="text-slate-400 block text-[10px] uppercase font-semibold">
                  Valid Duration
                </span>
                <span className="font-semibold text-blue-900">
                  {dateInfo.start_date} → {dateInfo.end_date}
                </span>
              </div>
              <div className="text-right">
                <span className="text-slate-400 block text-[10px] uppercase font-semibold">
                  Total Price
                </span>
                <span className="font-bold text-blue-900 text-sm">
                  {formatMoney(dateInfo.price, dateInfo.currency || 'USD')}
                </span>
              </div>
            </div>
          )}

          {/* 5. Dynamic Fulfillment Fields: Merch Mockups / Print Files */}
          {(capabilities.includes('merch_mockup') || capabilities.includes('digital_file')) && (
            <div className="p-4 rounded-2xl bg-slate-50 border border-slate-200 space-y-3">
              <p className="text-xs font-semibold text-slate-800 flex items-center gap-1.5">
                <Sparkles size={14} className="text-purple-600" />
                On-Demand Merch & Mockup Configuration
              </p>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div>
                  <label className="text-[11px] font-medium text-slate-600 block mb-1">
                    Logo Image URL (or upload below)
                  </label>
                  <input
                    type="text"
                    placeholder="https://... logo.png"
                    value={logoUrl}
                    onChange={(e) => setLogoUrl(e.target.value)}
                    className="w-full bg-white border border-slate-200 rounded-xl px-3 py-2 text-xs text-slate-800"
                  />
                </div>
                <div>
                  <label className="text-[11px] font-medium text-slate-600 block mb-1">
                    Print Placement
                  </label>
                  <select
                    value={placement}
                    onChange={(e) => setPlacement(e.target.value)}
                    className="w-full bg-white border border-slate-200 rounded-xl px-3 py-2 text-xs text-slate-800"
                  >
                    <option value="chest_center">Front Chest (Centered)</option>
                    <option value="pocket_left">Left Pocket Area</option>
                    <option value="back_large">Back Center (Large)</option>
                    <option value="wrap_360">360 Full Wrap (Mugs)</option>
                  </select>
                </div>
              </div>
              <div className="text-[11px] text-slate-500 bg-white p-2 rounded-xl border border-slate-150">
                <span className="font-medium text-slate-700">Print Production Engine:</span> Generates 300 DPI vector layout, 0.125" bleed margins, and CMYK proof file on order completion.
              </div>
            </div>
          )}

          {/* 6. Dynamic Fulfillment Notice for Service Accounts / Licenses */}
          {(capabilities.includes('service_account') || capabilities.includes('profiles')) && (
            <div className="p-3 rounded-xl bg-emerald-50/70 border border-emerald-200 text-xs text-emerald-800 flex items-center gap-2">
              <Shield size={16} className="text-emerald-600 shrink-0" />
              <span>
                <strong>Automatic Atomic Allocation:</strong> An available profile and encrypted password will be securely reserved and bound to this order upon submission.
              </span>
            </div>
          )}

          {/* 7. Payment & Notes */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div className="space-y-1.5">
              <label className="text-xs font-semibold text-slate-700 uppercase tracking-wider flex items-center gap-1.5">
                <CreditCard size={13} className="text-blue-600" />
                Payment Method
              </label>
              <select
                value={paymentMethod}
                onChange={(e) => setPaymentMethod(e.target.value)}
                className="w-full bg-slate-50 border border-slate-200 rounded-xl px-3.5 py-2.5 text-xs text-slate-800 focus:outline-hidden focus:border-blue-600 focus:bg-white transition"
              >
                <option value="cash">Cash / In Person</option>
                <option value="transfer">Bank Wire / Wire Transfer</option>
                <option value="card">Stripe / Credit Card</option>
                <option value="crypto">Cryptocurrency (USDT/BTC)</option>
              </select>
            </div>

            <div className="space-y-1.5">
              <label className="text-xs font-semibold text-slate-700 uppercase tracking-wider">
                Internal Order Notes
              </label>
              <input
                type="text"
                placeholder="Optional notes or instructions..."
                value={notes}
                onChange={(e) => setNotes(e.target.value)}
                className="w-full bg-slate-50 border border-slate-200 rounded-xl px-3.5 py-2 text-xs text-slate-800 focus:outline-hidden focus:border-blue-600 focus:bg-white transition"
              />
            </div>
          </div>

          {/* Footer Submit */}
          <div className="pt-4 border-t border-slate-100 flex items-center justify-end gap-3">
            <button
              type="button"
              onClick={onClose}
              className="px-5 py-2.5 rounded-xl border border-slate-200 text-xs font-medium text-slate-600 hover:bg-slate-50 transition"
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={loading || cannotOrder}
              title={cannotOrder ? 'Stock is full. Cannot create or assign orders.' : undefined}
              className="px-6 py-2.5 rounded-xl bg-blue-600 hover:bg-blue-500 disabled:bg-slate-300 disabled:text-slate-500 disabled:cursor-not-allowed disabled:shadow-none text-white text-xs font-semibold shadow-lg shadow-blue-600/30 flex items-center gap-2 transition"
            >
              {loading ? (
                <span>Fulfilling Order...</span>
              ) : cannotOrder ? (
                <>
                  <AlertCircle size={16} />
                  <span>Stock Full — Cannot Create Order</span>
                </>
              ) : (
                <>
                  <Check size={16} />
                  <span>Create & Fulfill Order</span>
                </>
              )}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};
