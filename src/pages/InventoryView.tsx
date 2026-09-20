import React from 'react';
import {
  Layers,
  Key,
  Shield,
  Plus,
  Eye,
  EyeOff,
  Copy,
  Check,
  Trash2,
  Lock,
  UserCheck,
  Users,
  Pencil,
  MoreVertical,
  AlertTriangle,
  X
} from 'lucide-react';
import { api } from '../api';
import type { ServiceAccount, LicenseKey, Product } from '../types';
import { PortalDropdown } from '../components/PortalDropdown';

export const InventoryView: React.FC = () => {
  const [activeTab, setActiveTab] = React.useState<'accounts' | 'licenses'>('accounts');
  const [accounts, setAccounts] = React.useState<ServiceAccount[]>([]);
  const [licenses, setLicenses] = React.useState<LicenseKey[]>([]);
  const [products, setProducts] = React.useState<Product[]>([]);
  const [loading, setLoading] = React.useState(true);

  // 3-dots dropdown menu state
  const [openMenuAccountId, setOpenMenuAccountId] = React.useState<string | null>(null);
  const accountMenuTriggerRef = React.useRef<HTMLButtonElement | null>(null);

  // Edit Service Account modal state
  const [editAccount, setEditAccount] = React.useState<ServiceAccount | null>(null);
  const [editProductId, setEditProductId] = React.useState('');
  const [editProvider, setEditProvider] = React.useState('');
  const [editLogin, setEditLogin] = React.useState('');
  const [editPassword, setEditPassword] = React.useState('');
  const [editCapacity, setEditCapacity] = React.useState(5);
  const [editExpiry, setEditExpiry] = React.useState('');
  const [editStatus, setEditStatus] = React.useState<string>('active');
  const [editNotes, setEditNotes] = React.useState('');
  const [savingEdit, setSavingEdit] = React.useState(false);

  // Notification message
  const [toastMessage, setToastMessage] = React.useState<string | null>(null);

  // Modals state
  const [showAddAccount, setShowAddAccount] = React.useState(false);
  const [accProductId, setAccProductId] = React.useState('');
  const [accProvider, setAccProvider] = React.useState('Netflix');
  const [accLogin, setAccLogin] = React.useState('');
  const [accPassword, setAccPassword] = React.useState('');
  const [accCapacity, setAccCapacity] = React.useState(5);
  const [accExpiry, setAccExpiry] = React.useState('');

  // Reveal Credential modal
  const [revealedCreds, setRevealedCreds] = React.useState<{ login: string; password: string; provider: string } | null>(null);

  // Profiles view modal
  const [activeAccountForProfiles, setActiveAccountForProfiles] = React.useState<ServiceAccount | null>(null);
  const [profilesList, setProfilesList] = React.useState<any[]>([]);

  // Bulk License Keys state
  const [showAddLicenses, setShowAddLicenses] = React.useState(false);
  const [licProductId, setLicProductId] = React.useState('');
  const [licBulkKeys, setLicBulkKeys] = React.useState('');

  React.useEffect(() => {
    loadData(true);
  }, [activeTab]);

  React.useEffect(() => {
    const handleClickOutside = (e: MouseEvent) => {
      if (openMenuAccountId && !(e.target as Element).closest('.account-actions-menu')) {
        setOpenMenuAccountId(null);
      }
    };
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        setOpenMenuAccountId(null);
      }
    };
    document.addEventListener('mousedown', handleClickOutside);
    document.addEventListener('keydown', handleKeyDown);
    return () => {
      document.removeEventListener('mousedown', handleClickOutside);
      document.removeEventListener('keydown', handleKeyDown);
    };
  }, [openMenuAccountId]);

  const loadData = async (showLoadingSpinner = false) => {
    if (showLoadingSpinner) {
      setLoading(true);
    }
    try {
      const pRes = await api.getProducts();
      setProducts(pRes.products);
      if (pRes.products.length > 0) {
        if (!accProductId) setAccProductId(pRes.products[0].id);
        if (!licProductId) setLicProductId(pRes.products[0].id);
      }

      if (activeTab === 'accounts') {
        const aRes = await api.getAccounts();
        setAccounts(aRes.accounts);
      } else {
        const lRes = await api.getLicenses();
        setLicenses(lRes.licenses);
      }
    } catch (err) {
      console.error(err);
    } finally {
      if (showLoadingSpinner) {
        setLoading(false);
      }
    }
  };

  const handleCreateAccount = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!accLogin || !accPassword) return;
    try {
      await api.createAccount({
        product_id: accProductId,
        provider: accProvider,
        login: accLogin,
        password: accPassword,
        capacity: Number(accCapacity),
        expiry_date: accExpiry || undefined
      });
      setShowAddAccount(false);
      setAccLogin('');
      setAccPassword('');
      window.dispatchEvent(new CustomEvent('app:data-mutated'));
      loadData(false);
    } catch (err: any) {
      alert(err.message);
    }
  };

  const handleRevealCredentials = async (accountId: string) => {
    try {
      const res = await api.revealCredentials(accountId);
      setRevealedCreds(res);
    } catch (err: any) {
      alert(err.message);
    }
  };

  const handleOpenEditAccount = (acc: ServiceAccount) => {
    setEditAccount(acc);
    setEditProductId(acc.product_id);
    setEditProvider(acc.provider);
    setEditLogin(acc.login);
    setEditPassword('');
    setEditCapacity(acc.capacity || 5);
    setEditExpiry(acc.expiry_date ? acc.expiry_date.split('T')[0] : '');
    setEditStatus(acc.status || 'active');
    setEditNotes(acc.notes || '');
  };

  const handleSaveEditAccount = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!editAccount) return;
    setSavingEdit(true);
    try {
      await api.updateAccount(editAccount.id, {
        product_id: editProductId,
        provider: editProvider,
        login: editLogin,
        password: editPassword.trim() ? editPassword.trim() : undefined,
        capacity: Number(editCapacity),
        expiry_date: editExpiry || null,
        status: editStatus,
        notes: editNotes || null
      });
      setEditAccount(null);
      setToastMessage(`Account ${editLogin} updated successfully in database.`);
      setTimeout(() => setToastMessage(null), 3500);
      window.dispatchEvent(new CustomEvent('app:data-mutated'));
      await loadData(false);
    } catch (err: any) {
      alert(err.message || 'Failed to update service account.');
    } finally {
      setSavingEdit(false);
    }
  };

  const handleDeleteAccount = async (acc: ServiceAccount) => {
    if ((acc.assigned_profiles || 0) > 0) {
      alert(
        `Cannot delete service account "${acc.login}". It has ${acc.assigned_profiles} active assigned profile(s). Please unassign or cancel the associated subscriptions before deleting this account from the database.`
      );
      return;
    }
    if (
      !window.confirm(
        `Are you sure you want to delete service account "${acc.login}" (${acc.provider})? This operation will remove it from the database.`
      )
    ) {
      return;
    }
    try {
      const res = await api.deleteAccount(acc.id);
      setToastMessage(res.message || 'Account deleted from database.');
      setTimeout(() => setToastMessage(null), 3500);
      window.dispatchEvent(new CustomEvent('app:data-mutated'));
      await loadData(false);
    } catch (err: any) {
      alert(err.message || 'Failed to delete service account.');
    }
  };

  const handleViewProfiles = async (acc: ServiceAccount) => {
    setActiveAccountForProfiles(acc);
    try {
      const res = await api.getAccountProfiles(acc.id);
      setProfilesList(res.profiles);
    } catch (err) {
      console.error(err);
    }
  };

  const handleAddBulkLicenses = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!licBulkKeys.trim()) return;
    try {
      const res = await api.addLicenses({
        product_id: licProductId,
        keys: licBulkKeys
      });
      setShowAddLicenses(false);
      setLicBulkKeys('');
      setToastMessage(`Successfully added ${res.count} license key${res.count === 1 ? '' : 's'} to stock.`);
      setTimeout(() => setToastMessage(null), 4000);
      window.dispatchEvent(new CustomEvent('app:data-mutated'));
      loadData(false);
    } catch (err: any) {
      alert(err.message);
    }
  };

  return (
    <div className="space-y-6">
      {/* Top Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 bg-white p-6 rounded-3xl border border-slate-200/80 shadow-xs">
        <div>
          <h2 className="text-xl font-bold text-slate-900 tracking-tight">Inventory & Account Bank</h2>
          <p className="text-xs text-slate-500 mt-0.5">
            Encrypted service accounts, multi-profile tracking, and serial license management.
          </p>
        </div>

        <div className="flex items-center gap-2.5">
          {activeTab === 'accounts' ? (
            <button
              onClick={() => setShowAddAccount(true)}
              className="px-5 py-2.5 bg-blue-600 hover:bg-blue-500 text-white rounded-xl text-xs font-semibold flex items-center gap-2 shadow-md shadow-blue-600/25 transition"
            >
              <Plus size={16} />
              <span>Add Service Account</span>
            </button>
          ) : (
            <button
              onClick={() => setShowAddLicenses(true)}
              className="px-5 py-2.5 bg-purple-600 hover:bg-purple-500 text-white rounded-xl text-xs font-semibold flex items-center gap-2 shadow-md shadow-purple-600/25 transition"
            >
              <Plus size={16} />
              <span>Bulk Add License Keys</span>
            </button>
          )}
        </div>
      </div>

      {/* Toast Notification */}
      {toastMessage && (
        <div className="bg-emerald-50 border border-emerald-200 text-emerald-800 px-4 py-3 rounded-2xl text-xs font-semibold flex items-center justify-between shadow-xs transition">
          <div className="flex items-center gap-2">
            <Check size={16} className="text-emerald-600" />
            <span>{toastMessage}</span>
          </div>
          <button
            onClick={() => setToastMessage(null)}
            className="text-emerald-600 hover:text-emerald-900 p-1"
          >
            <X size={14} />
          </button>
        </div>
      )}

      {/* Tabs */}
      <div className="flex items-center gap-2">
        <button
          onClick={() => setActiveTab('accounts')}
          className={`px-4 py-2 rounded-2xl text-xs font-semibold flex items-center gap-2 transition ${
            activeTab === 'accounts'
              ? 'bg-slate-900 text-white shadow-2xs'
              : 'bg-white text-slate-600 border border-slate-200 hover:bg-slate-50'
          }`}
        >
          <Shield size={14} />
          <span>Service Accounts & Profiles ({accounts.length})</span>
        </button>
        <button
          onClick={() => setActiveTab('licenses')}
          className={`px-4 py-2 rounded-2xl text-xs font-semibold flex items-center gap-2 transition ${
            activeTab === 'licenses'
              ? 'bg-slate-900 text-white shadow-2xs'
              : 'bg-white text-slate-600 border border-slate-200 hover:bg-slate-50'
          }`}
        >
          <Key size={14} />
          <span>Serial / License Keys ({licenses.length})</span>
        </button>
      </div>

      {/* Tab 1: Service Accounts */}
      {activeTab === 'accounts' && (
        <div className="bg-white rounded-3xl border border-slate-200/80 shadow-xs overflow-hidden">
          {loading ? (
            <div className="p-12 text-center text-xs text-slate-400">Loading inventory accounts...</div>
          ) : accounts.length === 0 ? (
            <div className="p-12 text-center text-xs text-slate-400">
              No service accounts stored yet. Add one above.
            </div>
          ) : (
            <div className="overflow-x-auto min-h-[360px] pb-28">
              <table className="w-full text-left text-xs">
                <thead>
                  <tr className="bg-slate-50/60 border-b border-slate-100 text-slate-400 uppercase text-[10px] tracking-wider">
                    <th className="py-3 px-5 font-semibold">Account / Provider</th>
                    <th className="py-3 px-4 font-semibold">Associated Product</th>
                    <th className="py-3 px-4 font-semibold">Profile Occupancy</th>
                    <th className="py-3 px-4 font-semibold">Expiry Date</th>
                    <th className="py-3 px-4 font-semibold">Status</th>
                    <th className="py-3 px-5 font-semibold text-right">Actions</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100">
                  {accounts.map((acc) => (
                    <tr key={acc.id} className="hover:bg-slate-50/60 transition">
                      <td className="py-3.5 px-5">
                        <div className="flex items-center gap-3">
                          <div className="w-8 h-8 rounded-xl bg-blue-50 text-blue-600 flex items-center justify-center font-bold">
                            <Shield size={14} />
                          </div>
                          <div>
                            <span className="font-semibold text-slate-800 font-mono block">{acc.login}</span>
                            <span className="text-[10px] text-slate-400 uppercase">{acc.provider}</span>
                          </div>
                        </div>
                      </td>
                      <td className="py-3.5 px-4 font-medium text-slate-700">{acc.product_name}</td>
                      <td className="py-3.5 px-4">
                        <div className="flex items-center gap-2">
                          <span className="font-bold text-slate-800">
                            {acc.assigned_profiles || 0}/{acc.capacity}
                          </span>
                          <span className="text-[10px] text-emerald-600 font-medium">
                            ({acc.available_profiles || 0} free)
                          </span>
                        </div>
                        <div className="w-24 h-1.5 rounded-full bg-slate-100 mt-1 overflow-hidden">
                          <div
                            className="h-full bg-blue-600 rounded-full"
                            style={{
                              width: `${Math.min(100, ((acc.assigned_profiles || 0) / acc.capacity) * 100)}%`
                            }}
                          />
                        </div>
                      </td>
                      <td className="py-3.5 px-4 text-slate-600">
                        {acc.expiry_date ? acc.expiry_date.split('T')[0] : 'No Expiry (Lifetime)'}
                      </td>
                      <td className="py-3.5 px-4">
                        <span className="px-2 py-0.5 rounded-full bg-emerald-50 text-emerald-700 font-semibold text-[10px]">
                          {acc.status}
                        </span>
                      </td>
                      <td className="py-3.5 px-5 text-right">
                        <div className="flex items-center justify-end gap-1.5">
                          <button
                            type="button"
                            onClick={() => handleViewProfiles(acc)}
                            className="p-1.5 rounded-lg border border-slate-200 text-slate-600 hover:bg-slate-50 hover:text-indigo-600 transition"
                            title={`Profiles (${acc.assigned_profiles || 0}/${acc.capacity})`}
                          >
                            <Users size={14} />
                          </button>
                          <button
                            type="button"
                            onClick={() => handleRevealCredentials(acc.id)}
                            className="p-1.5 rounded-lg border border-slate-200 text-slate-600 hover:bg-slate-50 hover:text-amber-600 transition"
                            title="Reveal Credentials"
                          >
                            <Key size={14} />
                          </button>
                          <button
                            type="button"
                            onClick={() => handleOpenEditAccount(acc)}
                            className="p-1.5 rounded-lg border border-slate-200 text-slate-600 hover:bg-slate-50 hover:text-blue-600 transition"
                            title="Edit Account"
                          >
                            <Pencil size={14} />
                          </button>
                          <button
                            type="button"
                            onClick={() => handleDeleteAccount(acc)}
                            disabled={(acc.assigned_profiles || 0) > 0}
                            className={`p-1.5 rounded-lg border transition ${
                              (acc.assigned_profiles || 0) > 0
                                ? 'border-slate-100 text-slate-300 cursor-not-allowed'
                                : 'border-slate-200 text-slate-600 hover:bg-rose-50 hover:text-rose-600 hover:border-rose-200'
                            }`}
                            title={
                              (acc.assigned_profiles || 0) > 0
                                ? `Cannot delete: ${acc.assigned_profiles} active assigned profile(s)`
                                : 'Delete Account'
                            }
                          >
                            <Trash2 size={14} />
                          </button>

                          {/* 3 dots with toggle dropdown */}
                          <div className="relative inline-block text-left account-actions-menu">
                            <button
                              type="button"
                              id={`account-menu-btn-${acc.id}`}
                              onClick={(e) => {
                                e.stopPropagation();
                                accountMenuTriggerRef.current = e.currentTarget;
                                setOpenMenuAccountId(openMenuAccountId === acc.id ? null : acc.id);
                              }}
                              className={`p-1.5 rounded-lg border transition ${
                                openMenuAccountId === acc.id
                                  ? 'border-slate-400 bg-slate-100 text-slate-900'
                                  : 'border-slate-200 text-slate-500 hover:bg-slate-50 hover:text-slate-800'
                              }`}
                              title="More Options"
                            >
                              <MoreVertical size={14} />
                            </button>
                          </div>
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>
      )}

      {/* 3-Dots Account Action Menu Portal (Rendered outside table/tbody to prevent scrolling and clipping) */}
      {(() => {
        const activeAcc = accounts.find((a) => a.id === openMenuAccountId);
        if (!activeAcc) return null;

        return (
          <PortalDropdown
            isOpen={Boolean(activeAcc)}
            onClose={() => setOpenMenuAccountId(null)}
            triggerRef={accountMenuTriggerRef}
            width={210}
            className="divide-y divide-slate-100"
          >
            <div className="py-1">
              {/* Edit Account */}
              <button
                id={`menu-edit-${activeAcc.id}`}
                onClick={() => {
                  setOpenMenuAccountId(null);
                  handleOpenEditAccount(activeAcc);
                }}
                className="w-full px-3.5 py-2 text-xs text-slate-700 hover:bg-slate-50 flex items-center gap-2.5 transition font-medium"
              >
                <Pencil size={14} className="text-blue-600 shrink-0" />
                <span>Edit Account</span>
              </button>

              {/* Profiles */}
              <button
                id={`menu-profiles-${activeAcc.id}`}
                onClick={() => {
                  setOpenMenuAccountId(null);
                  handleViewProfiles(activeAcc);
                }}
                className="w-full px-3.5 py-2 text-xs text-slate-700 hover:bg-slate-50 flex items-center gap-2.5 transition font-medium"
              >
                <Users size={14} className="text-indigo-600 shrink-0" />
                <span>Profiles ({activeAcc.assigned_profiles || 0}/{activeAcc.capacity})</span>
              </button>

              {/* Reveal Credentials */}
              <button
                id={`menu-reveal-${activeAcc.id}`}
                onClick={() => {
                  setOpenMenuAccountId(null);
                  handleRevealCredentials(activeAcc.id);
                }}
                className="w-full px-3.5 py-2 text-xs text-slate-700 hover:bg-slate-50 flex items-center gap-2.5 transition font-medium"
              >
                <Key size={14} className="text-amber-600 shrink-0" />
                <span>Reveal Credentials</span>
              </button>
            </div>

            {/* Delete Account */}
            <div className="py-1">
              <button
                id={`menu-delete-${activeAcc.id}`}
                onClick={() => {
                  setOpenMenuAccountId(null);
                  handleDeleteAccount(activeAcc);
                }}
                disabled={(activeAcc.assigned_profiles || 0) > 0}
                title={
                  (activeAcc.assigned_profiles || 0) > 0
                    ? `Cannot delete: ${activeAcc.assigned_profiles} active assigned profile(s)`
                    : 'Delete Account'
                }
                className={`w-full px-3.5 py-2 text-xs flex items-center justify-between transition font-medium ${
                  (activeAcc.assigned_profiles || 0) > 0
                    ? 'text-slate-400 cursor-not-allowed hover:bg-transparent opacity-60'
                    : 'text-rose-600 hover:bg-rose-50'
                }`}
              >
                <div className="flex items-center gap-2.5">
                  <Trash2
                    size={14}
                    className={(activeAcc.assigned_profiles || 0) > 0 ? 'text-slate-400 shrink-0' : 'text-rose-600 shrink-0'}
                  />
                  <span>Delete Account</span>
                </div>
                {(activeAcc.assigned_profiles || 0) > 0 && (
                  <span className="text-[9px] px-1.5 py-0.5 rounded bg-amber-50 text-amber-700 font-semibold border border-amber-200/70">
                    Restricted
                  </span>
                )}
              </button>
            </div>
          </PortalDropdown>
        );
      })()}

      {/* Tab 2: License Keys */}
      {activeTab === 'licenses' && (
        <div className="bg-white rounded-3xl border border-slate-200/80 shadow-xs overflow-hidden">
          {loading ? (
            <div className="p-12 text-center text-xs text-slate-400">Loading licenses...</div>
          ) : licenses.length === 0 ? (
            <div className="p-12 text-center text-xs text-slate-400">
              No license keys in database. Click "Bulk Add License Keys" above.
            </div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-left text-xs">
                <thead>
                  <tr className="bg-slate-50/60 border-b border-slate-100 text-slate-400 uppercase text-[10px] tracking-wider">
                    <th className="py-3 px-5 font-semibold">License Key Code</th>
                    <th className="py-3 px-4 font-semibold">Product</th>
                    <th className="py-3 px-4 font-semibold">Status</th>
                    <th className="py-3 px-4 font-semibold">Assigned To</th>
                    <th className="py-3 px-5 font-semibold text-right">Date Added</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100">
                  {licenses.map((lic) => (
                    <tr key={lic.id} className="hover:bg-slate-50/60 transition">
                      <td className="py-3.5 px-5 font-mono font-bold text-slate-800">{lic.license_key}</td>
                      <td className="py-3.5 px-4 font-medium text-slate-700">{lic.product_name}</td>
                      <td className="py-3.5 px-4">
                        <span
                          className={`px-2 py-0.5 rounded-full font-semibold text-[10px] ${
                            lic.status === 'available'
                              ? 'bg-emerald-50 text-emerald-700 border border-emerald-200'
                              : 'bg-purple-50 text-purple-700'
                          }`}
                        >
                          {lic.status}
                        </span>
                      </td>
                      <td className="py-3.5 px-4 text-slate-600">
                        {lic.customer_name || '—'}
                      </td>
                      <td className="py-3.5 px-5 text-right text-slate-400">
                        {lic.created_at?.split('T')[0]}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>
      )}

      {/* Modal: Add Service Account */}
      {showAddAccount && (
        <div
          onClick={() => setShowAddAccount(false)}
          className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/40 backdrop-blur-xs p-4"
        >
          <div
            onClick={(e) => e.stopPropagation()}
            className="w-full max-w-md bg-white rounded-3xl shadow-2xl border border-slate-200 p-6 space-y-4"
          >
            <h3 className="text-base font-bold text-slate-900">Add Service Account</h3>
            <form onSubmit={handleCreateAccount} className="space-y-3">
              <div>
                <label className="text-xs font-semibold text-slate-700 block mb-1">Target Product *</label>
                <select
                  value={accProductId}
                  onChange={(e) => setAccProductId(e.target.value)}
                  className="w-full bg-slate-50 border border-slate-200 rounded-xl px-3 py-2 text-xs"
                  required
                >
                  {products.map((p) => (
                    <option key={p.id} value={p.id}>{p.name}</option>
                  ))}
                </select>
              </div>

              <div>
                <label className="text-xs font-semibold text-slate-700 block mb-1">Provider Brand</label>
                <input
                  type="text"
                  placeholder="e.g. Netflix, Disney+, ChatGPT"
                  value={accProvider}
                  onChange={(e) => setAccProvider(e.target.value)}
                  className="w-full bg-slate-50 border border-slate-200 rounded-xl px-3 py-2 text-xs"
                />
              </div>

              <div className="grid grid-cols-2 gap-2">
                <div>
                  <label className="text-xs font-semibold text-slate-700 block mb-1">Account Login *</label>
                  <input
                    type="text"
                    required
                    placeholder="email@provider.com"
                    value={accLogin}
                    onChange={(e) => setAccLogin(e.target.value)}
                    className="w-full bg-slate-50 border border-slate-200 rounded-xl px-3 py-2 text-xs"
                  />
                </div>
                <div>
                  <label className="text-xs font-semibold text-slate-700 block mb-1">Account Password *</label>
                  <input
                    type="text"
                    required
                    placeholder="Master password"
                    value={accPassword}
                    onChange={(e) => setAccPassword(e.target.value)}
                    className="w-full bg-slate-50 border border-slate-200 rounded-xl px-3 py-2 text-xs"
                  />
                </div>
              </div>

              <div className="grid grid-cols-2 gap-2">
                <div>
                  <label className="text-xs font-semibold text-slate-700 block mb-1">Profile Capacity</label>
                  <input
                    type="number"
                    min="1"
                    max="1000"
                    value={accCapacity}
                    onChange={(e) => setAccCapacity(Number(e.target.value))}
                    className="w-full bg-slate-50 border border-slate-200 rounded-xl px-3 py-2 text-xs"
                  />
                </div>
                <div>
                  <label className="text-xs font-semibold text-slate-700 block mb-1">Expiry Date (Optional)</label>
                  <input
                    type="date"
                    value={accExpiry}
                    onChange={(e) => setAccExpiry(e.target.value)}
                    className="w-full bg-slate-50 border border-slate-200 rounded-xl px-3 py-2 text-xs"
                  />
                </div>
              </div>

              <div className="flex justify-end gap-2 pt-2">
                <button
                  type="button"
                  onClick={() => setShowAddAccount(false)}
                  className="px-3 py-2 border rounded-xl text-xs text-slate-600"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="px-5 py-2 bg-blue-600 text-white rounded-xl text-xs font-semibold hover:bg-blue-500"
                >
                  Save Account
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Modal: Reveal Password */}
      {revealedCreds && (
        <div
          onClick={() => setRevealedCreds(null)}
          className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/40 backdrop-blur-xs p-4"
        >
          <div
            onClick={(e) => e.stopPropagation()}
            className="w-full max-w-sm bg-white rounded-3xl shadow-2xl border border-slate-200 p-6 space-y-4"
          >
            <h3 className="text-sm font-bold text-slate-900 flex items-center gap-2">
              <Shield size={16} className="text-emerald-600" />
              Decrypted Master Credentials
            </h3>
            <div className="p-3 bg-slate-50 rounded-2xl border border-slate-200 space-y-2 text-xs font-mono">
              <div>
                <span className="text-[10px] text-slate-400 font-sans block">Provider:</span>
                <span className="text-slate-800 font-bold">{revealedCreds.provider}</span>
              </div>
              <div>
                <span className="text-[10px] text-slate-400 font-sans block">Login:</span>
                <span className="text-slate-800 font-bold">{revealedCreds.login}</span>
              </div>
              <div>
                <span className="text-[10px] text-slate-400 font-sans block">Password:</span>
                <span className="text-slate-800 font-bold">{revealedCreds.password}</span>
              </div>
            </div>
            <button
              onClick={() => setRevealedCreds(null)}
              className="w-full py-2 bg-slate-800 text-white rounded-xl text-xs font-semibold"
            >
              Close
            </button>
          </div>
        </div>
      )}

      {/* Modal: View Profiles */}
      {activeAccountForProfiles && (
        <div
          onClick={() => setActiveAccountForProfiles(null)}
          className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/40 backdrop-blur-xs p-4"
        >
          <div
            onClick={(e) => e.stopPropagation()}
            className="w-full max-w-lg bg-white rounded-3xl shadow-2xl border border-slate-200 p-6 space-y-4"
          >
            <div className="flex items-center justify-between border-b pb-3">
              <div>
                <h3 className="text-sm font-bold text-slate-900">
                  Profiles for {activeAccountForProfiles.login}
                </h3>
                <p className="text-xs text-slate-400">Profile slots & customer assignments</p>
              </div>
              <button
                onClick={() => setActiveAccountForProfiles(null)}
                className="text-xs font-semibold text-slate-400 hover:text-slate-600"
              >
                Close
              </button>
            </div>

            <div className="space-y-2 max-h-72 overflow-y-auto">
              {profilesList.map((prof) => (
                <div
                  key={prof.id}
                  className="p-3 rounded-2xl border border-slate-200 bg-slate-50 flex items-center justify-between text-xs"
                >
                  <div className="flex items-center gap-2.5">
                    <div className="w-8 h-8 rounded-xl bg-blue-100 text-blue-800 font-bold flex items-center justify-center">
                      {prof.profile_name.split(' ')[1] || 'P'}
                    </div>
                    <div>
                      <p className="font-semibold text-slate-800">{prof.profile_name}</p>
                      <p className="text-[10px] text-slate-400">PIN: {prof.pin || 'None'}</p>
                    </div>
                  </div>
                  <div>
                    <span
                      className={`px-2.5 py-0.5 rounded-full font-semibold text-[10px] ${
                        prof.status === 'available'
                          ? 'bg-emerald-50 text-emerald-700'
                          : 'bg-blue-50 text-blue-700'
                      }`}
                    >
                      {prof.status === 'available' ? 'Available' : `Assigned (${prof.assigned_customer_name || 'Customer'})`}
                    </span>
                  </div>
                </div>
              ))}
            </div>
          </div>
        </div>
      )}

      {/* Modal: Bulk License Keys */}
      {showAddLicenses && (
        <div
          onClick={() => setShowAddLicenses(false)}
          className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/40 backdrop-blur-xs p-4"
        >
          <div
            onClick={(e) => e.stopPropagation()}
            className="w-full max-w-md bg-white rounded-3xl shadow-2xl border border-slate-200 p-6 space-y-4"
          >
            <h3 className="text-base font-bold text-slate-900">Bulk Add Serial / License Keys</h3>
            <form onSubmit={handleAddBulkLicenses} className="space-y-3">
              <div>
                <label className="text-xs font-semibold text-slate-700 block mb-1">Target Product *</label>
                <select
                  value={licProductId}
                  onChange={(e) => setLicProductId(e.target.value)}
                  className="w-full bg-slate-50 border border-slate-200 rounded-xl px-3 py-2 text-xs"
                  required
                >
                  {products.map((p) => (
                    <option key={p.id} value={p.id}>{p.name}</option>
                  ))}
                </select>
              </div>

              <div>
                <label className="text-xs font-semibold text-slate-700 block mb-1">
                  License Keys (Paste one key per line) *
                </label>
                <textarea
                  rows={5}
                  required
                  placeholder="XXXX-YYYY-ZZZZ-1111&#10;XXXX-YYYY-ZZZZ-2222&#10;XXXX-YYYY-ZZZZ-3333"
                  value={licBulkKeys}
                  onChange={(e) => setLicBulkKeys(e.target.value)}
                  className="w-full bg-slate-50 border border-slate-200 rounded-xl p-3 text-xs font-mono text-slate-800"
                />
              </div>

              <div className="flex justify-end gap-2 pt-2">
                <button
                  type="button"
                  onClick={() => setShowAddLicenses(false)}
                  className="px-3 py-2 border rounded-xl text-xs text-slate-600"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="px-5 py-2 bg-purple-600 text-white rounded-xl text-xs font-semibold hover:bg-purple-500"
                >
                  Import License Keys
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Modal: Edit Service Account */}
      {editAccount && (
        <div
          onClick={() => setEditAccount(null)}
          className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/40 backdrop-blur-xs p-4"
        >
          <div
            onClick={(e) => e.stopPropagation()}
            className="w-full max-w-md bg-white rounded-3xl shadow-2xl border border-slate-200 p-6 space-y-4 max-h-[90vh] overflow-y-auto"
          >
            <div className="flex items-center justify-between border-b border-slate-100 pb-3">
              <div>
                <h3 className="text-base font-bold text-slate-900">Edit Service Account</h3>
                <p className="text-xs text-slate-500 mt-0.5">Update credentials and settings directly in database</p>
              </div>
              <button
                onClick={() => setEditAccount(null)}
                className="p-1 rounded-lg text-slate-400 hover:text-slate-600 hover:bg-slate-100 transition"
              >
                <X size={16} />
              </button>
            </div>

            <form onSubmit={handleSaveEditAccount} className="space-y-3">
              <div>
                <label className="text-xs font-semibold text-slate-700 block mb-1">Target Product *</label>
                <select
                  value={editProductId}
                  onChange={(e) => setEditProductId(e.target.value)}
                  className="w-full bg-slate-50 border border-slate-200 rounded-xl px-3 py-2 text-xs"
                  required
                >
                  {products.map((p) => (
                    <option key={p.id} value={p.id}>{p.name}</option>
                  ))}
                </select>
              </div>

              <div>
                <label className="text-xs font-semibold text-slate-700 block mb-1">Provider Brand *</label>
                <input
                  type="text"
                  placeholder="e.g. Netflix, Disney+, ChatGPT"
                  value={editProvider}
                  onChange={(e) => setEditProvider(e.target.value)}
                  className="w-full bg-slate-50 border border-slate-200 rounded-xl px-3 py-2 text-xs"
                  required
                />
              </div>

              <div>
                <label className="text-xs font-semibold text-slate-700 block mb-1">Account Login / Email *</label>
                <input
                  type="text"
                  required
                  value={editLogin}
                  onChange={(e) => setEditLogin(e.target.value)}
                  className="w-full bg-slate-50 border border-slate-200 rounded-xl px-3 py-2 text-xs font-mono"
                />
              </div>

              <div>
                <label className="text-xs font-semibold text-slate-700 block mb-1">New Password (Optional)</label>
                <input
                  type="text"
                  placeholder="Leave empty to keep existing password"
                  value={editPassword}
                  onChange={(e) => setEditPassword(e.target.value)}
                  className="w-full bg-slate-50 border border-slate-200 rounded-xl px-3 py-2 text-xs"
                />
              </div>

              <div className="grid grid-cols-2 gap-2">
                <div>
                  <label className="text-xs font-semibold text-slate-700 block mb-1">Profile Capacity</label>
                  <input
                    type="number"
                    min="1"
                    max="1000"
                    value={editCapacity}
                    onChange={(e) => setEditCapacity(Number(e.target.value))}
                    className="w-full bg-slate-50 border border-slate-200 rounded-xl px-3 py-2 text-xs"
                    required
                  />
                </div>
                <div>
                  <label className="text-xs font-semibold text-slate-700 block mb-1">Status</label>
                  <select
                    value={editStatus}
                    onChange={(e) => setEditStatus(e.target.value)}
                    className="w-full bg-slate-50 border border-slate-200 rounded-xl px-3 py-2 text-xs"
                  >
                    <option value="active">Active</option>
                    <option value="inactive">Inactive</option>
                    <option value="expired">Expired</option>
                  </select>
                </div>
              </div>

              <div>
                <label className="text-xs font-semibold text-slate-700 block mb-1">Expiry Date (Optional)</label>
                <input
                  type="date"
                  value={editExpiry}
                  onChange={(e) => setEditExpiry(e.target.value)}
                  className="w-full bg-slate-50 border border-slate-200 rounded-xl px-3 py-2 text-xs"
                />
              </div>

              <div>
                <label className="text-xs font-semibold text-slate-700 block mb-1">Internal Notes (Optional)</label>
                <textarea
                  rows={2}
                  placeholder="Any recovery codes, billing info, or notes..."
                  value={editNotes}
                  onChange={(e) => setEditNotes(e.target.value)}
                  className="w-full bg-slate-50 border border-slate-200 rounded-xl px-3 py-2 text-xs"
                />
              </div>

              <div className="flex justify-end gap-2 pt-2 border-t border-slate-100">
                <button
                  type="button"
                  onClick={() => setEditAccount(null)}
                  className="px-4 py-2 border border-slate-200 rounded-xl text-xs text-slate-600 hover:bg-slate-50 transition"
                  disabled={savingEdit}
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={savingEdit}
                  className="px-5 py-2 bg-blue-600 text-white rounded-xl text-xs font-semibold hover:bg-blue-500 disabled:opacity-50 transition"
                >
                  {savingEdit ? 'Saving to DB...' : 'Save Changes'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
};
