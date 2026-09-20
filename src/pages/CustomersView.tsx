import React from 'react';
import {
  Search,
  Plus,
  ShoppingBag,
  X,
  MoreVertical,
  Edit2,
  Trash2,
  Power,
  AlertTriangle,
  CheckCircle2
} from 'lucide-react';
import { api } from '../api';
import type { Customer } from '../types';
import { useCurrency } from '../context/CurrencyContext';
import { PortalDropdown } from '../components/PortalDropdown';

interface CustomersViewProps {
  onComposeWhatsApp: (orderId: string) => void;
  onOpenOrderForCustomer: (customerId: string) => void;
}

export const CustomersView: React.FC<CustomersViewProps> = ({
  onComposeWhatsApp,
  onOpenOrderForCustomer
}) => {
  const { format: formatMoney } = useCurrency();
  const [customers, setCustomers] = React.useState<Customer[]>([]);
  const [loading, setLoading] = React.useState(true);
  const [searchTerm, setSearchTerm] = React.useState('');

  // 3-dots action menu state
  const [openActionMenuId, setOpenActionMenuId] = React.useState<string | null>(null);
  const customerMenuTriggerRef = React.useRef<HTMLButtonElement | null>(null);

  // New Customer Modal
  const [showNewCustomer, setShowNewCustomer] = React.useState(false);
  const [name, setName] = React.useState('');
  const [email, setEmail] = React.useState('');
  const [whatsapp, setWhatsapp] = React.useState('');
  const [notes, setNotes] = React.useState('');

  // Edit Customer Modal
  const [editCustomer, setEditCustomer] = React.useState<Customer | null>(null);
  const [editName, setEditName] = React.useState('');
  const [editEmail, setEditEmail] = React.useState('');
  const [editWhatsapp, setEditWhatsapp] = React.useState('');
  const [editNotes, setEditNotes] = React.useState('');
  const [editStatus, setEditStatus] = React.useState<'active' | 'inactive'>('active');

  // Delete Confirmation Modal
  const [customerToDelete, setCustomerToDelete] = React.useState<Customer | null>(null);

  // Toast notification
  const [toastMessage, setToastMessage] = React.useState<string | null>(null);

  React.useEffect(() => {
    loadCustomers();
  }, []);

  React.useEffect(() => {
    if (toastMessage) {
      const timer = setTimeout(() => setToastMessage(null), 3500);
      return () => clearTimeout(timer);
    }
  }, [toastMessage]);

  // Close menus/modals on Escape and click outside
  React.useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        setOpenActionMenuId(null);
        setShowNewCustomer(false);
        setEditCustomer(null);
        setCustomerToDelete(null);
      }
    };

    const handleClickOutside = (e: MouseEvent) => {
      if (!(e.target as HTMLElement).closest('.action-menu-dropdown-container')) {
        setOpenActionMenuId(null);
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    window.addEventListener('click', handleClickOutside);
    return () => {
      window.removeEventListener('keydown', handleKeyDown);
      window.removeEventListener('click', handleClickOutside);
    };
  }, []);

  const loadCustomers = async () => {
    setLoading(true);
    try {
      const res = await api.getCustomers();
      setCustomers(res.customers);
    } catch (err) {
      console.error('Failed to load customers from database:', err);
    } finally {
      setLoading(false);
    }
  };

  const handleCreateCustomer = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!name.trim()) return;
    try {
      await api.createCustomer({ name: name.trim(), email: email.trim(), whatsapp: whatsapp.trim(), notes: notes.trim() });
      setShowNewCustomer(false);
      setName('');
      setEmail('');
      setWhatsapp('');
      setNotes('');
      setToastMessage('Customer created successfully.');
      await loadCustomers();
    } catch (err: any) {
      alert(err.message || 'Failed to create customer');
    }
  };

  const handleOpenEditCustomer = (cust: Customer) => {
    setEditCustomer(cust);
    setEditName(cust.name || '');
    setEditEmail(cust.email || '');
    setEditWhatsapp(cust.whatsapp || '');
    setEditNotes(cust.notes || '');
    setEditStatus(cust.status === 'active' ? 'active' : 'inactive');
  };

  const handleUpdateCustomer = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!editCustomer || !editName.trim()) return;
    try {
      await api.updateCustomer(editCustomer.id, {
        name: editName.trim(),
        email: editEmail.trim(),
        whatsapp: editWhatsapp.trim(),
        notes: editNotes.trim(),
        status: editStatus
      });
      setToastMessage(`Customer "${editName.trim()}" updated successfully.`);
      setEditCustomer(null);
      await loadCustomers();
    } catch (err: any) {
      alert(err.message || 'Failed to update customer');
    }
  };

  const handleToggleStatus = async (cust: Customer) => {
    const newStatus = cust.status === 'active' ? 'inactive' : 'active';
    try {
      await api.updateCustomer(cust.id, { status: newStatus });
      setToastMessage(`Customer "${cust.name}" marked as ${newStatus === 'active' ? 'Active' : 'Deactivated'}.`);
      await loadCustomers();
    } catch (err: any) {
      alert(err.message || 'Failed to update customer status');
    }
  };

  const handleDeleteCustomer = async () => {
    if (!customerToDelete) return;
    try {
      await api.deleteCustomer(customerToDelete.id);
      setToastMessage(`Customer "${customerToDelete.name}" deleted from database.`);
      setCustomerToDelete(null);
      await loadCustomers();
    } catch (err: any) {
      alert(err.message || 'Failed to delete customer');
    }
  };

  const filtered = customers.filter((c) => {
    if (!searchTerm) return true;
    const term = searchTerm.toLowerCase();
    return (
      c.name.toLowerCase().includes(term) ||
      (c.email && c.email.toLowerCase().includes(term)) ||
      (c.whatsapp && c.whatsapp.includes(term))
    );
  });

  return (
    <div className="space-y-6">
      {/* Top Header with Total Customer Count in () from DB */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 bg-white p-6 rounded-3xl border border-slate-200/80 shadow-xs">
        <div>
          <h2 className="text-xl font-bold text-slate-900 tracking-tight">
            Customers ({customers.length})
          </h2>
          <p className="text-xs text-slate-500 mt-0.5">
            Customer profiles, subscription histories, lifetime value, and direct contact channels.
          </p>
        </div>

        <div className="flex items-center gap-3">
          <button
            onClick={() => setShowNewCustomer(true)}
            className="px-5 py-2 bg-blue-600 hover:bg-blue-500 text-white rounded-xl text-xs font-semibold flex items-center gap-2 shadow-md shadow-blue-600/25 transition shrink-0"
          >
            <Plus size={16} />
            <span>Add Customer</span>
          </button>
        </div>
      </div>

      {/* Customers Table */}
      <div className="bg-white rounded-3xl border border-slate-200/80 shadow-xs overflow-visible">
        {loading ? (
          <div className="p-12 text-center text-xs text-slate-400">Loading customers from database...</div>
        ) : filtered.length === 0 ? (
          <div className="p-12 text-center text-xs text-slate-400">
            {searchTerm ? 'No matching customers found.' : 'No customers in database yet.'}
          </div>
        ) : (
          <div className="overflow-x-auto overflow-y-visible">
            <table className="w-full text-left text-xs">
              <thead>
                <tr className="bg-slate-50/60 border-b border-slate-100 text-slate-400 uppercase text-[10px] tracking-wider">
                  <th className="py-3 px-5 font-semibold">Customer</th>
                  <th className="py-3 px-4 font-semibold">Contact Details</th>
                  <th className="py-3 px-4 font-semibold text-center">Active / Total Orders</th>
                  <th className="py-3 px-4 font-semibold text-right">Lifetime Spent</th>
                  <th className="py-3 px-4 font-semibold">Status</th>
                  <th className="py-3 px-5 font-semibold text-right">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {filtered.map((cust) => {
                  const isActive = cust.status === 'active';

                  return (
                    <tr key={cust.id} className="hover:bg-slate-50/60 transition">
                      <td className="py-3.5 px-5">
                        <div className="flex items-center gap-3">
                          <div className="w-9 h-9 rounded-2xl bg-blue-50 text-blue-600 font-bold flex items-center justify-center text-xs shrink-0">
                            {cust.name.charAt(0)}
                          </div>
                          <div>
                            <p className="font-semibold text-slate-800">
                              {cust.name}
                            </p>
                            <p className="text-[10px] text-slate-400">Joined {cust.created_at?.split('T')[0]}</p>
                          </div>
                        </div>
                      </td>
                      <td className="py-3.5 px-4 text-slate-600">
                        <p className="font-mono text-xs">{cust.whatsapp || 'No WhatsApp'}</p>
                        <p className="text-[11px] text-slate-400">{cust.email || 'No Email'}</p>
                      </td>
                      <td className="py-3.5 px-4 text-center">
                        <span className="font-bold text-slate-800">{cust.active_orders || 0}</span>
                        <span className="text-slate-400 text-[10px]"> / {cust.total_orders || 0}</span>
                      </td>
                      <td className="py-3.5 px-4 text-right font-bold text-emerald-600">
                        {formatMoney(cust.total_spent || 0, 'USD')}
                      </td>
                      <td className="py-3.5 px-4">
                        {isActive ? (
                          <span className="inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full bg-emerald-50 text-emerald-700 font-semibold text-[10px]">
                            <span className="w-1.5 h-1.5 rounded-full bg-emerald-500"></span>
                            Active
                          </span>
                        ) : (
                          <span className="inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full bg-slate-100 text-slate-600 font-semibold text-[10px]">
                            <span className="w-1.5 h-1.5 rounded-full bg-slate-400"></span>
                            Deactivated
                          </span>
                        )}
                      </td>
                      <td className="py-3.5 px-5 text-right relative">
                        <div className="action-menu-dropdown-container inline-block text-left">
                          <button
                            onClick={(e) => {
                              e.stopPropagation();
                              customerMenuTriggerRef.current = e.currentTarget;
                              setOpenActionMenuId(openActionMenuId === cust.id ? null : cust.id);
                            }}
                            className={`p-1.5 rounded-xl border transition flex items-center justify-center ${
                              openActionMenuId === cust.id
                                ? 'bg-blue-50 border-blue-300 text-blue-600 shadow-xs'
                                : 'border-slate-200 text-slate-500 hover:bg-slate-100 hover:text-slate-800'
                            }`}
                            title="Actions"
                          >
                            <MoreVertical size={16} />
                          </button>
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

      {/* 3-Dots Customer Action Menu Portal (Rendered outside table/tbody to prevent scrolling and clipping) */}
      {(() => {
        const activeCust = customers.find((c) => c.id === openActionMenuId);
        if (!activeCust) return null;
        const isActive = activeCust.status === 'active';

        return (
          <PortalDropdown
            isOpen={Boolean(activeCust)}
            onClose={() => setOpenActionMenuId(null)}
            triggerRef={customerMenuTriggerRef}
            width={180}
          >
            {/* Edit Action */}
            <button
              onClick={() => {
                setOpenActionMenuId(null);
                handleOpenEditCustomer(activeCust);
              }}
              className="w-full px-3.5 py-2 text-xs font-medium text-slate-700 hover:bg-slate-50 flex items-center gap-2.5 transition"
            >
              <Edit2 size={14} className="text-blue-600 shrink-0" />
              <span>Edit</span>
            </button>

            {/* Deactivate / Activate Action */}
            <button
              onClick={() => {
                setOpenActionMenuId(null);
                handleToggleStatus(activeCust);
              }}
              className="w-full px-3.5 py-2 text-xs font-medium text-slate-700 hover:bg-slate-50 flex items-center gap-2.5 transition"
            >
              <Power
                size={14}
                className={`shrink-0 ${
                  isActive ? 'text-amber-500' : 'text-emerald-500'
                }`}
              />
              <span>{isActive ? 'Deactivate' : 'Activate'}</span>
            </button>

            {/* New Order Action */}
            <button
              onClick={() => {
                setOpenActionMenuId(null);
                onOpenOrderForCustomer(activeCust.id);
              }}
              className="w-full px-3.5 py-2 text-xs font-medium text-slate-700 hover:bg-slate-50 flex items-center gap-2.5 transition"
            >
              <ShoppingBag size={14} className="text-emerald-600 shrink-0" />
              <span>New Order</span>
            </button>

            <div className="my-1 border-t border-slate-100" />

            {/* Delete Action */}
            <button
              onClick={() => {
                setOpenActionMenuId(null);
                setCustomerToDelete(activeCust);
              }}
              className="w-full px-3.5 py-2 text-xs font-semibold text-rose-600 hover:bg-rose-50 flex items-center gap-2.5 transition"
            >
              <Trash2 size={14} className="shrink-0" />
              <span>Delete</span>
            </button>
          </PortalDropdown>
        );
      })()}

      {/* Modal: Edit Customer */}
      {editCustomer && (
        <div
          onClick={() => setEditCustomer(null)}
          className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/40 backdrop-blur-xs p-4 animate-in fade-in duration-150"
        >
          <div
            onClick={(e) => e.stopPropagation()}
            className="w-full max-w-md bg-white rounded-3xl shadow-2xl border border-slate-200 p-6 space-y-4 relative"
          >
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <div className="p-2 bg-blue-50 text-blue-600 rounded-xl">
                  <Edit2 size={18} />
                </div>
                <div>
                  <h3 className="text-base font-bold text-slate-900">Edit Customer</h3>
                  <p className="text-xs text-slate-400">Update account info in database</p>
                </div>
              </div>
              <button
                onClick={() => setEditCustomer(null)}
                className="p-1 text-slate-400 hover:text-slate-700 rounded-lg hover:bg-slate-100 transition"
              >
                <X size={18} />
              </button>
            </div>

            <form onSubmit={handleUpdateCustomer} className="space-y-3 pt-1">
              <div>
                <label className="text-xs font-semibold text-slate-700 block mb-1">Full Name *</label>
                <input
                  type="text"
                  required
                  placeholder="e.g. Sarah Jenkins"
                  value={editName}
                  onChange={(e) => setEditName(e.target.value)}
                  className="w-full bg-slate-50 border border-slate-200 rounded-xl px-3 py-2 text-xs focus:bg-white focus:outline-hidden"
                />
              </div>

              <div>
                <label className="text-xs font-semibold text-slate-700 block mb-1">Email Address</label>
                <input
                  type="email"
                  placeholder="sarah@example.com"
                  value={editEmail}
                  onChange={(e) => setEditEmail(e.target.value)}
                  className="w-full bg-slate-50 border border-slate-200 rounded-xl px-3 py-2 text-xs focus:bg-white focus:outline-hidden"
                />
              </div>

              <div>
                <label className="text-xs font-semibold text-slate-700 block mb-1">WhatsApp Phone (International)</label>
                <input
                  type="text"
                  placeholder="+12025550198"
                  value={editWhatsapp}
                  onChange={(e) => setEditWhatsapp(e.target.value)}
                  className="w-full bg-slate-50 border border-slate-200 rounded-xl px-3 py-2 text-xs focus:bg-white focus:outline-hidden"
                />
              </div>

              <div>
                <label className="text-xs font-semibold text-slate-700 block mb-1">Account Status</label>
                <select
                  value={editStatus}
                  onChange={(e) => setEditStatus(e.target.value as 'active' | 'inactive')}
                  className="w-full bg-slate-50 border border-slate-200 rounded-xl px-3 py-2 text-xs focus:bg-white focus:outline-hidden"
                >
                  <option value="active">Active</option>
                  <option value="inactive">Deactivated</option>
                </select>
              </div>

              <div>
                <label className="text-xs font-semibold text-slate-700 block mb-1">Notes</label>
                <input
                  type="text"
                  placeholder="Preferences, client tier..."
                  value={editNotes}
                  onChange={(e) => setEditNotes(e.target.value)}
                  className="w-full bg-slate-50 border border-slate-200 rounded-xl px-3 py-2 text-xs focus:bg-white focus:outline-hidden"
                />
              </div>

              <div className="flex justify-end gap-2 pt-3">
                <button
                  type="button"
                  onClick={() => setEditCustomer(null)}
                  className="px-4 py-2 border border-slate-200 rounded-xl text-xs font-medium text-slate-600 hover:bg-slate-50 transition"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="px-5 py-2 bg-blue-600 text-white rounded-xl text-xs font-semibold hover:bg-blue-500 shadow-xs transition"
                >
                  Save Changes
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Modal: Delete Confirmation */}
      {customerToDelete && (
        <div
          onClick={() => setCustomerToDelete(null)}
          className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/40 backdrop-blur-xs p-4 animate-in fade-in duration-150"
        >
          <div
            onClick={(e) => e.stopPropagation()}
            className="w-full max-w-md bg-white rounded-3xl shadow-2xl border border-slate-200 p-6 space-y-4"
          >
            <div className="flex items-center gap-3 text-rose-600">
              <div className="p-2.5 bg-rose-50 rounded-2xl">
                <AlertTriangle size={24} />
              </div>
              <div>
                <h3 className="text-base font-bold text-slate-900">Delete Customer</h3>
                <p className="text-xs text-slate-500">Database deletion confirmation</p>
              </div>
            </div>

            <p className="text-xs text-slate-600 leading-relaxed">
              Are you sure you want to permanently delete{' '}
              <strong className="text-slate-900">{customerToDelete.name}</strong> from the database?
              All associated records, orders, and history will be cleanly unlinked and removed.
            </p>

            <div className="flex justify-end gap-2 pt-2">
              <button
                type="button"
                onClick={() => setCustomerToDelete(null)}
                className="px-4 py-2 border border-slate-200 hover:bg-slate-50 rounded-xl text-xs font-medium text-slate-600 transition"
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={handleDeleteCustomer}
                className="px-5 py-2 bg-rose-600 hover:bg-rose-500 text-white rounded-xl text-xs font-semibold shadow-xs transition"
              >
                Delete Permanently
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Modal: New Customer */}
      {showNewCustomer && (
        <div
          onClick={() => setShowNewCustomer(false)}
          className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/40 backdrop-blur-xs p-4 animate-in fade-in duration-150"
        >
          <div
            onClick={(e) => e.stopPropagation()}
            className="w-full max-w-md bg-white rounded-3xl shadow-2xl border border-slate-200 p-6 space-y-4"
          >
            <h3 className="text-base font-bold text-slate-900">Add New Customer</h3>
            <form onSubmit={handleCreateCustomer} className="space-y-3">
              <div>
                <label className="text-xs font-semibold text-slate-700 block mb-1">Full Name *</label>
                <input
                  type="text"
                  required
                  placeholder="e.g. Sarah Jenkins"
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                  className="w-full bg-slate-50 border border-slate-200 rounded-xl px-3 py-2 text-xs focus:bg-white focus:outline-hidden"
                />
              </div>

              <div>
                <label className="text-xs font-semibold text-slate-700 block mb-1">Email Address</label>
                <input
                  type="email"
                  placeholder="sarah@example.com"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  className="w-full bg-slate-50 border border-slate-200 rounded-xl px-3 py-2 text-xs focus:bg-white focus:outline-hidden"
                />
              </div>

              <div>
                <label className="text-xs font-semibold text-slate-700 block mb-1">WhatsApp Phone (International)</label>
                <input
                  type="text"
                  placeholder="+12025550198"
                  value={whatsapp}
                  onChange={(e) => setWhatsapp(e.target.value)}
                  className="w-full bg-slate-50 border border-slate-200 rounded-xl px-3 py-2 text-xs focus:bg-white focus:outline-hidden"
                />
              </div>

              <div>
                <label className="text-xs font-semibold text-slate-700 block mb-1">Notes</label>
                <input
                  type="text"
                  placeholder="VIP client, prefers English..."
                  value={notes}
                  onChange={(e) => setNotes(e.target.value)}
                  className="w-full bg-slate-50 border border-slate-200 rounded-xl px-3 py-2 text-xs focus:bg-white focus:outline-hidden"
                />
              </div>

              <div className="flex justify-end gap-2 pt-2">
                <button
                  type="button"
                  onClick={() => setShowNewCustomer(false)}
                  className="px-4 py-2 border rounded-xl text-xs text-slate-600 hover:bg-slate-50 transition"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="px-5 py-2 bg-blue-600 text-white rounded-xl text-xs font-semibold hover:bg-blue-500 shadow-xs transition"
                >
                  Save Customer
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Toast Notification */}
      {toastMessage && (
        <div className="fixed bottom-6 right-6 z-50 bg-slate-900 text-white px-4 py-3 rounded-2xl shadow-2xl flex items-center gap-2.5 text-xs animate-in slide-in-from-bottom-3 duration-150 border border-slate-700">
          <CheckCircle2 size={16} className="text-emerald-400 shrink-0" />
          <span>{toastMessage}</span>
        </div>
      )}
    </div>
  );
};
