import React from 'react';
import {
  Settings,
  ShieldCheck,
  FileText,
  Save,
  Check,
  Plus,
  Trash2,
  Lock,
  UserCheck,
  User as UserIcon,
  X,
  CheckCircle2,
  AlertCircle,
  Eye,
  EyeOff,
  KeyRound,
  ShieldAlert,
  Coins,
  ChevronDown
} from 'lucide-react';
import { api } from '../api';
import { useCurrency } from '../context/CurrencyContext';
import type { User, AuditLog, UserRole } from '../types';

interface SettingsViewProps {
  initialTab?: 'profile' | 'general' | 'team' | 'audit';
  currentUser?: User | null;
  onUserUpdated?: (user: User) => void;
}

export const SettingsView: React.FC<SettingsViewProps> = ({
  initialTab = 'profile',
  currentUser,
  onUserUpdated
}) => {
  const [activeTab, setActiveTab] = React.useState<'profile' | 'general' | 'team' | 'audit'>(initialTab);
  const [sessionUser, setSessionUser] = React.useState<User | null>(currentUser || null);

  React.useEffect(() => {
    if (initialTab) {
      setActiveTab(initialTab);
    }
  }, [initialTab]);

  React.useEffect(() => {
    if (currentUser) {
      setSessionUser(currentUser);
    } else {
      api.getMe()
        .then((res) => {
          setSessionUser(res.user);
        })
        .catch(() => {});
    }
  }, [currentUser]);

  const { currencies, selectedCurrency, setCurrency: setGlobalCurrency } = useCurrency();
  const [loading, setLoading] = React.useState(true);

  // Profile Form state
  const [profileName, setProfileName] = React.useState('');
  const [profileUsername, setProfileUsername] = React.useState('');
  const [profileEmail, setProfileEmail] = React.useState('');
  const [profileRole, setProfileRole] = React.useState('agent');
  const [profileCurrency, setProfileCurrency] = React.useState<string>(
    currentUser?.preferred_currency || selectedCurrency || 'USD'
  );

  // Password fields (never show plain login password)
  const [currentPassword, setCurrentPassword] = React.useState('');
  const [newPassword, setNewPassword] = React.useState('');
  const [confirmPassword, setConfirmPassword] = React.useState('');

  const [showCurrentPw, setShowCurrentPw] = React.useState(false);
  const [showNewPw, setShowNewPw] = React.useState(false);
  const [showConfirmPw, setShowConfirmPw] = React.useState(false);

  const [profileSaving, setProfileSaving] = React.useState(false);
  const [profileError, setProfileError] = React.useState<string | null>(null);
  const [profileSuccess, setProfileSuccess] = React.useState<string | null>(null);

  // Sync profile fields when sessionUser updates
  React.useEffect(() => {
    if (sessionUser) {
      setProfileName(sessionUser.name || '');
      setProfileUsername(sessionUser.username || '');
      setProfileEmail(sessionUser.email || '');
      setProfileRole(sessionUser.role || 'agent');
      if (sessionUser.preferred_currency) {
        setProfileCurrency(sessionUser.preferred_currency.toUpperCase());
      }
    }
  }, [sessionUser]);

  // General Settings state
  const [settings, setSettings] = React.useState<Record<string, string>>({
    company_name: 'Apex Digital Reseller Hub',
    base_currency: 'USD',
    currency_symbol: '$',
    support_phone: '+12025550198',
    low_inventory_threshold: '5',
    order_expiry_warning_days: '3'
  });
  const [savedSettingsSuccess, setSavedSettingsSuccess] = React.useState(false);

  // Team Users state
  const [users, setUsers] = React.useState<User[]>([]);
  const [showAddUser, setShowAddUser] = React.useState(false);
  const [newUsername, setNewUsername] = React.useState('');
  const [newName, setNewName] = React.useState('');
  const [newEmail, setNewEmail] = React.useState('');
  const [newPasswordState, setNewPasswordState] = React.useState('');
  const [newRole, setNewRole] = React.useState<UserRole>('agent');
  const [deletingUserId, setDeletingUserId] = React.useState<string | null>(null);
  const [userPendingDelete, setUserPendingDelete] = React.useState<User | null>(null);
  const [toastMessage, setToastMessage] = React.useState<string | null>(null);

  // Audit Logs state
  const [auditLogs, setAuditLogs] = React.useState<AuditLog[]>([]);

  // Keyboard shortcut for modals
  React.useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        if (showAddUser) setShowAddUser(false);
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [showAddUser]);

  React.useEffect(() => {
    if (toastMessage) {
      const timer = setTimeout(() => setToastMessage(null), 3000);
      return () => clearTimeout(timer);
    }
  }, [toastMessage]);

  React.useEffect(() => {
    loadTabContent(true);
  }, [activeTab]);

  const loadTabContent = async (showLoadingSpinner = false) => {
    if (showLoadingSpinner) {
      setLoading(true);
    }
    try {
      if (activeTab === 'profile') {
        const res = await api.getMe();
        setSessionUser(res.user);
      } else if (activeTab === 'general') {
        const res = await api.getSettings();
        setSettings(res.settings);
      } else if (activeTab === 'team') {
        const res = await api.getUsers();
        setUsers(res.users);
      } else if (activeTab === 'audit') {
        const res = await api.getAuditLogs({ limit: 50 });
        setAuditLogs(res.logs);
      }
    } catch (err) {
      console.error(err);
    } finally {
      if (showLoadingSpinner) {
        setLoading(false);
      }
    }
  };

  // Helper to detect harmful scripts or injection strings
  const containsHarmfulCode = (val: string): boolean => {
    if (!val) return false;
    const lower = val.toLowerCase();
    const maliciousPatterns = [
      /<script/i,
      /<\/script/i,
      /javascript:/i,
      /data:text\/html/i,
      /<iframe/i,
      /<object/i,
      /<embed/i,
      /onload\s*=/i,
      /onerror\s*=/i,
      /onclick\s*=/i,
      /onmouseover\s*=/i,
      /<svg/i,
      /<img/i,
      /eval\s*\(/i,
      /'\s*or\s*'1'\s*=\s*'1'/i,
      /'\s*or\s*1\s*=\s*1/i,
      /union\s+select/i,
      /drop\s+table/i,
      /;\s*drop\s+/i,
      /;\s*delete\s+from/i,
      /exec\s*\(/i
    ];
    return maliciousPatterns.some((pattern) => pattern.test(lower));
  };

  // Password requirements real-time checks
  const hasMinLength = newPassword.length >= 8;
  const hasUpperCase = /[A-Z]/.test(newPassword);
  const hasLowerCase = /[a-z]/.test(newPassword);
  const hasNumber = /[0-9]/.test(newPassword);
  const hasSymbol = /[!@#$%^&*()_+\-=\[\]{};':"\\|,.<>\/?~`]/.test(newPassword);
  const passwordsMatch = newPassword.length > 0 && newPassword === confirmPassword;

  // Handle saving profile
  const handleSaveProfile = async (e: React.FormEvent) => {
    e.preventDefault();
    setProfileError(null);
    setProfileSuccess(null);

    // 1. Check all inputs are filled
    if (!profileName.trim()) {
      setProfileError('Full Name is required and cannot be blank.');
      return;
    }
    if (!profileUsername.trim()) {
      setProfileError('Username is required and cannot be blank.');
      return;
    }
    if (!profileEmail.trim()) {
      setProfileError('Email address is required and cannot be blank.');
      return;
    }

    // 2. Security validation: check if inputs contain scripts or malicious codes
    if (
      containsHarmfulCode(profileName) ||
      containsHarmfulCode(profileUsername) ||
      containsHarmfulCode(profileEmail) ||
      (currentPassword && containsHarmfulCode(currentPassword)) ||
      (newPassword && containsHarmfulCode(newPassword))
    ) {
      setProfileError('Security Exception: Inputs contain prohibited script tags, HTML tags, or malicious injection code.');
      return;
    }

    // Basic format validations
    const usernameRegex = /^[a-zA-Z0-9_.-]{3,30}$/;
    if (!usernameRegex.test(profileUsername.trim())) {
      setProfileError('Username must be 3-30 characters (letters, numbers, hyphens, dots, and underscores only).');
      return;
    }

    const emailRegex = /^[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}$/;
    if (!emailRegex.test(profileEmail.trim())) {
      setProfileError('Please enter a valid email address.');
      return;
    }

    // 3. Password check logic:
    // If current password input is filled, verify and check new password constraints
    if (currentPassword || newPassword || confirmPassword) {
      if (!currentPassword) {
        setProfileError('Current password is required to authorize password update.');
        return;
      }

      if (!newPassword) {
        setProfileError('New password is required when updating password.');
        return;
      }

      if (!hasMinLength) {
        setProfileError('New password must be at least 8 characters long.');
        return;
      }

      if (!hasUpperCase) {
        setProfileError('New password must contain at least one capital (uppercase) letter [A-Z].');
        return;
      }

      if (!hasLowerCase) {
        setProfileError('New password must contain at least one minuscule (lowercase) letter [a-z].');
        return;
      }

      if (!hasNumber) {
        setProfileError('New password must contain at least one number [0-9].');
        return;
      }

      if (!hasSymbol) {
        setProfileError('New password must contain at least one special symbol (!@#$%^&*).');
        return;
      }

      if (newPassword !== confirmPassword) {
        setProfileError('Confirm new password does not match the new password.');
        return;
      }
    }

    setProfileSaving(true);
    try {
      const res = await api.updateMyProfile({
        name: profileName.trim(),
        username: profileUsername.trim(),
        email: profileEmail.trim(),
        preferred_currency: profileCurrency,
        currentPassword: currentPassword || undefined,
        newPassword: newPassword || undefined,
        confirmPassword: confirmPassword || undefined
      });

      if (res.token) {
        api.setToken(res.token);
      }

      setSessionUser(res.user);
      if (onUserUpdated) {
        onUserUpdated(res.user);
      }

      // Synchronize global application currency state
      if (profileCurrency && profileCurrency !== selectedCurrency) {
        await setGlobalCurrency(profileCurrency);
      }

      // Clear password inputs
      setCurrentPassword('');
      setNewPassword('');
      setConfirmPassword('');

      setProfileSuccess(res.message || 'Profile updated successfully.');
      setToastMessage(`Profile saved successfully. Preferred currency set to ${profileCurrency}.`);
      setTimeout(() => setProfileSuccess(null), 4000);
    } catch (err: any) {
      setProfileError(err.message || 'Failed to update profile.');
    } finally {
      setProfileSaving(false);
    }
  };

  const handleSaveSettings = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      await api.updateSettings(settings);
      setSavedSettingsSuccess(true);
      setTimeout(() => setSavedSettingsSuccess(false), 2500);
    } catch (err: any) {
      setToastMessage(err.message || 'Failed to save settings.');
    }
  };

  const handleCreateUser = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newUsername || !newPasswordState) return;
    try {
      await api.createUser({
        username: newUsername,
        name: newName,
        email: newEmail,
        password: newPasswordState,
        role: newRole
      });
      setShowAddUser(false);
      setNewUsername('');
      setNewName('');
      setNewEmail('');
      setNewPasswordState('');
      setNewRole('agent');
      setToastMessage(`Staff user ${newUsername} created successfully.`);
      window.dispatchEvent(new CustomEvent('app:data-mutated'));
      loadTabContent(false);
    } catch (err: any) {
      setToastMessage(err.message || 'Failed to create staff user.');
    }
  };

  const handleDeleteUser = (u: User) => {
    setUserPendingDelete(u);
  };

  const handleConfirmDeleteUser = async () => {
    if (!userPendingDelete) return;
    const targetUser = userPendingDelete;
    setUserPendingDelete(null);
    setDeletingUserId(targetUser.id);
    try {
      await api.deleteUser(targetUser.id);
      setToastMessage(`User "${targetUser.name}" deleted from database.`);
      window.dispatchEvent(new CustomEvent('app:data-mutated'));
      await loadTabContent(false);
    } catch (err: any) {
      setToastMessage(err.message || 'Failed to delete user.');
    } finally {
      setDeletingUserId(null);
    }
  };

  // Helper to extract first letter of first name and last name
  const getUserInitials = (name: string): string => {
    if (!name) return '??';
    const parts = name.trim().split(/\s+/);
    if (parts.length >= 2) {
      return (parts[0][0] + parts[parts.length - 1][0]).toUpperCase();
    }
    return name.slice(0, 2).toUpperCase();
  };

  const isAdmin = sessionUser?.role === 'admin' || sessionUser?.role === 'owner';
  const isOwner = sessionUser?.role === 'owner';

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 bg-white p-6 rounded-3xl border border-slate-200/80 shadow-xs">
        <div>
          <h2 className="text-xl font-bold text-slate-900 tracking-tight">System & Business Settings</h2>
          <p className="text-xs text-slate-500 mt-0.5">
            Active profile management, storefront configuration, staff roles, and security audit log.
          </p>
        </div>
      </div>

      {/* Tabs */}
      <div className="flex items-center gap-2 overflow-x-auto pb-1">
        {[
          { id: 'profile', label: 'My Profile', icon: UserIcon },
          { id: 'general', label: 'General Configuration', icon: Settings },
          { id: 'team', label: 'Staff & Roles (RBAC)', icon: ShieldCheck },
          { id: 'audit', label: 'Security Audit Log', icon: FileText }
        ].map((tab) => {
          const Icon = tab.icon;
          return (
            <button
              key={tab.id}
              onClick={() => setActiveTab(tab.id as any)}
              className={`px-4 py-2 rounded-2xl text-xs font-semibold flex items-center gap-2 transition shrink-0 ${
                activeTab === tab.id
                  ? 'bg-slate-900 text-white shadow-2xs'
                  : 'bg-white text-slate-600 border border-slate-200 hover:bg-slate-50'
              }`}
            >
              <Icon size={14} />
              <span>{tab.label}</span>
            </button>
          );
        })}
      </div>

      {/* Tab 1: Profile Tab */}
      {activeTab === 'profile' && (
        <div className="space-y-6">
          {/* Active Profile Overview Card */}
          <div className="bg-white p-6 rounded-3xl border border-slate-200/80 shadow-xs">
            <div className="flex flex-col sm:flex-row sm:items-center gap-5 pb-6 border-b border-slate-100">
              {/* Avatar with initials */}
              <div
                className={`w-16 h-16 rounded-2xl flex items-center justify-center text-xl font-extrabold shrink-0 shadow-sm ${
                  isAdmin
                    ? 'bg-gradient-to-br from-violet-600 to-indigo-700 text-white ring-4 ring-indigo-100'
                    : 'bg-gradient-to-br from-teal-500 to-emerald-600 text-white ring-4 ring-emerald-100'
                }`}
              >
                {getUserInitials(profileName || sessionUser?.name || 'User')}
              </div>

              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-2.5 flex-wrap">
                  <h3 className="text-lg font-bold text-slate-900 tracking-tight">
                    {profileName || sessionUser?.name || 'User Profile'}
                  </h3>
                  <span
                    className={`px-2.5 py-0.5 rounded-full font-bold text-[10px] uppercase tracking-wide inline-flex items-center gap-1 ${
                      isAdmin
                        ? 'bg-purple-50 text-purple-700 border border-purple-200'
                        : 'bg-emerald-50 text-emerald-700 border border-emerald-200'
                    }`}
                  >
                    <Lock size={10} />
                    {profileRole}
                  </span>
                </div>
                <p className="text-xs text-slate-500 mt-1 flex items-center gap-2 font-mono">
                  <span>@{profileUsername || sessionUser?.username}</span>
                  <span className="text-slate-300">•</span>
                  <span className="text-slate-500">{profileEmail || sessionUser?.email}</span>
                </p>
              </div>

              <div className="text-right sm:border-l sm:border-slate-100 sm:pl-6 text-xs text-slate-400">
                <p className="text-[11px] text-slate-400">Account Status</p>
                <span className="inline-flex items-center gap-1.5 font-semibold text-emerald-600 mt-0.5">
                  <span className="w-2 h-2 rounded-full bg-emerald-500 animate-pulse" />
                  Active & Verified
                </span>
              </div>
            </div>

            {/* Profile Edit Form */}
            <form onSubmit={handleSaveProfile} className="mt-6 space-y-6 max-w-2xl">
              {/* Alert / Error Banner */}
              {profileError && (
                <div className="p-4 rounded-2xl bg-red-50 border border-red-200 flex items-start gap-3 text-xs text-red-700 animate-in fade-in">
                  <AlertCircle size={16} className="shrink-0 mt-0.5 text-red-600" />
                  <div className="flex-1">
                    <p className="font-bold">Security & Validation Alert</p>
                    <p className="mt-0.5">{profileError}</p>
                  </div>
                  <button
                    type="button"
                    onClick={() => setProfileError(null)}
                    className="text-red-400 hover:text-red-700 p-0.5"
                  >
                    <X size={14} />
                  </button>
                </div>
              )}

              {/* Success Banner */}
              {profileSuccess && (
                <div className="p-4 rounded-2xl bg-emerald-50 border border-emerald-200 flex items-center gap-3 text-xs text-emerald-800 animate-in fade-in">
                  <CheckCircle2 size={16} className="shrink-0 text-emerald-600" />
                  <span className="font-semibold">{profileSuccess}</span>
                </div>
              )}

              {/* Personal Information Inputs */}
              <div>
                <h4 className="text-xs font-bold uppercase tracking-wider text-slate-400 mb-3">
                  Personal Information
                </h4>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                  {/* Full Name */}
                  <div className="space-y-1">
                    <label className="text-xs font-semibold text-slate-700">Full Name *</label>
                    <input
                      id="profile-name-input"
                      type="text"
                      required
                      value={profileName}
                      onChange={(e) => setProfileName(e.target.value)}
                      placeholder="Your full name"
                      className="w-full bg-slate-50 border border-slate-200 rounded-xl px-3.5 py-2.5 text-xs text-slate-800 focus:outline-hidden focus:bg-white focus:border-blue-500 transition"
                    />
                  </div>

                  {/* Username */}
                  <div className="space-y-1">
                    <label className="text-xs font-semibold text-slate-700">Username *</label>
                    <div className="relative">
                      <span className="absolute left-3.5 top-2.5 text-xs text-slate-400 font-mono">@</span>
                      <input
                        id="profile-username-input"
                        type="text"
                        required
                        value={profileUsername}
                        onChange={(e) => setProfileUsername(e.target.value.toLowerCase())}
                        placeholder="username"
                        className="w-full bg-slate-50 border border-slate-200 rounded-xl pl-8 pr-3.5 py-2.5 text-xs text-slate-800 font-mono focus:outline-hidden focus:bg-white focus:border-blue-500 transition"
                      />
                    </div>
                  </div>

                  {/* Email */}
                  <div className="space-y-1">
                    <label className="text-xs font-semibold text-slate-700">Email Address *</label>
                    <input
                      id="profile-email-input"
                      type="email"
                      required
                      value={profileEmail}
                      onChange={(e) => setProfileEmail(e.target.value)}
                      placeholder="name@example.com"
                      className="w-full bg-slate-50 border border-slate-200 rounded-xl px-3.5 py-2.5 text-xs text-slate-800 focus:outline-hidden focus:bg-white focus:border-blue-500 transition"
                    />
                  </div>

                  {/* Role (Restricted to change) */}
                  <div className="space-y-1">
                    <div className="flex items-center justify-between">
                      <label className="text-xs font-semibold text-slate-700">User Role</label>
                      <span className="text-[10px] text-amber-600 font-medium flex items-center gap-1">
                        <Lock size={10} />
                        Restricted
                      </span>
                    </div>
                    <div className="relative">
                      <input
                        id="profile-role-input"
                        type="text"
                        disabled
                        readOnly
                        value={profileRole.toUpperCase()}
                        className="w-full bg-slate-100 border border-slate-200 rounded-xl px-3.5 py-2.5 text-xs text-slate-500 font-bold uppercase cursor-not-allowed select-none"
                      />
                      <div className="absolute right-3 top-2.5 text-slate-400">
                        <Lock size={14} />
                      </div>
                    </div>
                    <p className="text-[10px] text-slate-400 leading-tight mt-1">
                      Role modifications are restricted to organizational owners and admins in the Staff tab.
                    </p>
                  </div>

                  {/* Preferred Display Currency */}
                  <div className="space-y-1">
                    <label htmlFor="profile-currency-select" className="text-xs font-semibold text-slate-700">
                      Currency
                    </label>
                    <div className="relative">
                      <select
                        id="profile-currency-select"
                        value={profileCurrency.toUpperCase()}
                        onChange={(e) => setProfileCurrency(e.target.value)}
                        className="w-full bg-slate-50 border border-slate-200 rounded-xl px-3.5 py-2.5 text-xs text-slate-800 font-medium focus:outline-hidden focus:bg-white focus:border-blue-500 transition appearance-none cursor-pointer pr-9"
                      >
                        {currencies.map((c) => (
                          <option key={c.code} value={c.code.toUpperCase()}>
                            {c.code} ({c.symbol}) — {c.name}
                          </option>
                        ))}
                      </select>
                      <div className="absolute right-3.5 top-1/2 -translate-y-1/2 pointer-events-none text-slate-400">
                        <ChevronDown size={14} />
                      </div>
                    </div>
                  </div>
                </div>
              </div>

              {/* Password & Security Section */}
              <div className="pt-4 border-t border-slate-100">
                <div className="flex items-center justify-between mb-3">
                  <div>
                    <h4 className="text-xs font-bold uppercase tracking-wider text-slate-400 flex items-center gap-1.5">
                      <KeyRound size={13} className="text-blue-600" />
                      <span>Security & Password (Optional)</span>
                    </h4>
                    <p className="text-[11px] text-slate-400 mt-0.5">
                      Leave blank to keep your current password. To change your password, verify your current password.
                    </p>
                  </div>
                </div>

                <div className="space-y-3.5">
                  {/* Current Password Input */}
                  <div className="space-y-1">
                    <label className="text-xs font-semibold text-slate-700">Current Password</label>
                    <div className="relative">
                      <input
                        id="profile-current-password"
                        type={showCurrentPw ? 'text' : 'password'}
                        value={currentPassword}
                        onChange={(e) => setCurrentPassword(e.target.value)}
                        placeholder="Enter your current password to authorize changes"
                        className="w-full bg-slate-50 border border-slate-200 rounded-xl px-3.5 pr-10 py-2.5 text-xs text-slate-800 focus:outline-hidden focus:bg-white focus:border-blue-500 transition"
                      />
                      <button
                        type="button"
                        onClick={() => setShowCurrentPw(!showCurrentPw)}
                        className="absolute right-3 top-2.5 text-slate-400 hover:text-slate-600 transition"
                        title={showCurrentPw ? 'Hide password' : 'Show password'}
                      >
                        {showCurrentPw ? <EyeOff size={15} /> : <Eye size={15} />}
                      </button>
                    </div>
                  </div>

                  {/* New Password Input & Confirm Password Input */}
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                    <div className="space-y-1">
                      <label className="text-xs font-semibold text-slate-700">New Password</label>
                      <div className="relative">
                        <input
                          id="profile-new-password"
                          type={showNewPw ? 'text' : 'password'}
                          value={newPassword}
                          onChange={(e) => setNewPassword(e.target.value)}
                          placeholder="Min. 8 characters"
                          className="w-full bg-slate-50 border border-slate-200 rounded-xl px-3.5 pr-10 py-2.5 text-xs text-slate-800 focus:outline-hidden focus:bg-white focus:border-blue-500 transition"
                        />
                        <button
                          type="button"
                          onClick={() => setShowNewPw(!showNewPw)}
                          className="absolute right-3 top-2.5 text-slate-400 hover:text-slate-600 transition"
                          title={showNewPw ? 'Hide password' : 'Show password'}
                        >
                          {showNewPw ? <EyeOff size={15} /> : <Eye size={15} />}
                        </button>
                      </div>
                    </div>

                    <div className="space-y-1">
                      <label className="text-xs font-semibold text-slate-700">Confirm New Password</label>
                      <div className="relative">
                        <input
                          id="profile-confirm-password"
                          type={showConfirmPw ? 'text' : 'password'}
                          value={confirmPassword}
                          onChange={(e) => setConfirmPassword(e.target.value)}
                          placeholder="Re-type new password"
                          className="w-full bg-slate-50 border border-slate-200 rounded-xl px-3.5 pr-10 py-2.5 text-xs text-slate-800 focus:outline-hidden focus:bg-white focus:border-blue-500 transition"
                        />
                        <button
                          type="button"
                          onClick={() => setShowConfirmPw(!showConfirmPw)}
                          className="absolute right-3 top-2.5 text-slate-400 hover:text-slate-600 transition"
                          title={showConfirmPw ? 'Hide password' : 'Show password'}
                        >
                          {showConfirmPw ? <EyeOff size={15} /> : <Eye size={15} />}
                        </button>
                      </div>
                    </div>
                  </div>

                  {/* Password Requirements Checklist (Appears when user starts typing a new password) */}
                  {(newPassword.length > 0 || currentPassword.length > 0) && (
                    <div className="p-3.5 bg-slate-50 rounded-2xl border border-slate-200/80 space-y-2">
                      <p className="text-[11px] font-bold text-slate-700">Password Security Standards:</p>
                      <div className="grid grid-cols-2 sm:grid-cols-3 gap-2 text-[11px]">
                        <div className={`flex items-center gap-1.5 ${hasMinLength ? 'text-emerald-700 font-semibold' : 'text-slate-400'}`}>
                          <Check size={13} className={hasMinLength ? 'text-emerald-600' : 'text-slate-300'} />
                          <span>8+ characters</span>
                        </div>
                        <div className={`flex items-center gap-1.5 ${hasUpperCase ? 'text-emerald-700 font-semibold' : 'text-slate-400'}`}>
                          <Check size={13} className={hasUpperCase ? 'text-emerald-600' : 'text-slate-300'} />
                          <span>Uppercase (A-Z)</span>
                        </div>
                        <div className={`flex items-center gap-1.5 ${hasLowerCase ? 'text-emerald-700 font-semibold' : 'text-slate-400'}`}>
                          <Check size={13} className={hasLowerCase ? 'text-emerald-600' : 'text-slate-300'} />
                          <span>Lowercase (a-z)</span>
                        </div>
                        <div className={`flex items-center gap-1.5 ${hasNumber ? 'text-emerald-700 font-semibold' : 'text-slate-400'}`}>
                          <Check size={13} className={hasNumber ? 'text-emerald-600' : 'text-slate-300'} />
                          <span>Number (0-9)</span>
                        </div>
                        <div className={`flex items-center gap-1.5 ${hasSymbol ? 'text-emerald-700 font-semibold' : 'text-slate-400'}`}>
                          <Check size={13} className={hasSymbol ? 'text-emerald-600' : 'text-slate-300'} />
                          <span>Symbol (!@#$)</span>
                        </div>
                        <div className={`flex items-center gap-1.5 ${passwordsMatch ? 'text-emerald-700 font-semibold' : 'text-slate-400'}`}>
                          <Check size={13} className={passwordsMatch ? 'text-emerald-600' : 'text-slate-300'} />
                          <span>Passwords Match</span>
                        </div>
                      </div>
                    </div>
                  )}
                </div>
              </div>

              {/* Submit Button */}
              <div className="pt-3 flex items-center gap-3">
                <button
                  id="save-profile-btn"
                  type="submit"
                  disabled={profileSaving}
                  className="px-6 py-2.5 bg-blue-600 hover:bg-blue-500 disabled:opacity-50 text-white rounded-xl text-xs font-semibold flex items-center gap-2 shadow-xs transition"
                >
                  <Save size={14} />
                  <span>{profileSaving ? 'Verifying & Saving...' : 'Save Profile Changes'}</span>
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Tab 2: General Settings */}
      {activeTab === 'general' && (
        <div className="bg-white p-6 rounded-3xl border border-slate-200/80 shadow-xs">
          <form onSubmit={handleSaveSettings} className="space-y-4 max-w-xl">
            <div className="space-y-1">
              <label className="text-xs font-semibold text-slate-700">Company / Store Name</label>
              <input
                type="text"
                value={settings.company_name || ''}
                onChange={(e) => setSettings({ ...settings, company_name: e.target.value })}
                className="w-full bg-slate-50 border border-slate-200 rounded-xl px-3.5 py-2.5 text-xs text-slate-800"
              />
            </div>

            <div className="space-y-1">
              <label className="text-xs font-semibold text-slate-700">WhatsApp Support Number</label>
              <input
                type="text"
                value={settings.support_phone || ''}
                onChange={(e) => setSettings({ ...settings, support_phone: e.target.value })}
                className="w-full bg-slate-50 border border-slate-200 rounded-xl px-3.5 py-2.5 text-xs text-slate-800"
              />
            </div>

            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-1">
                <label className="text-xs font-semibold text-slate-700">Low Stock Alert Threshold</label>
                <input
                  type="number"
                  value={settings.low_inventory_threshold || '5'}
                  onChange={(e) => setSettings({ ...settings, low_inventory_threshold: e.target.value })}
                  className="w-full bg-slate-50 border border-slate-200 rounded-xl px-3.5 py-2.5 text-xs text-slate-800"
                />
              </div>
              <div className="space-y-1">
                <label className="text-xs font-semibold text-slate-700">Expiry Warning Days</label>
                <input
                  type="number"
                  value={settings.order_expiry_warning_days || '3'}
                  onChange={(e) => setSettings({ ...settings, order_expiry_warning_days: e.target.value })}
                  className="w-full bg-slate-50 border border-slate-200 rounded-xl px-3.5 py-2.5 text-xs text-slate-800"
                />
              </div>
            </div>

            <div className="pt-2 flex items-center gap-3">
              <button
                type="submit"
                className="px-5 py-2.5 bg-blue-600 hover:bg-blue-500 text-white rounded-xl text-xs font-semibold flex items-center gap-2 shadow-xs transition"
              >
                <Save size={14} />
                <span>Save Store Settings</span>
              </button>
              {savedSettingsSuccess && (
                <span className="text-xs text-emerald-600 font-semibold flex items-center gap-1">
                  <Check size={14} />
                  <span>Settings updated successfully</span>
                </span>
              )}
            </div>
          </form>
        </div>
      )}

      {/* Tab 3: Team Staff & RBAC */}
      {activeTab === 'team' && (
        <div className="bg-white rounded-3xl border border-slate-200/80 shadow-xs overflow-hidden">
          <div className="p-5 border-b border-slate-100 flex items-center justify-between">
            <div>
              <h3 className="text-sm font-bold text-slate-800">Staff Members & Roles</h3>
              <p className="text-xs text-slate-400">Role-Based Access Control (RBAC) matrix</p>
            </div>
            {isAdmin && (
              <button
                id="add-staff-user-btn"
                onClick={() => setShowAddUser(true)}
                className="px-4 py-2 bg-blue-600 text-white rounded-xl text-xs font-semibold flex items-center gap-1.5 hover:bg-blue-500 transition shadow-xs"
              >
                <Plus size={14} />
                <span>Add Staff User</span>
              </button>
            )}
          </div>

          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs">
              <thead>
                <tr className="bg-slate-50/60 border-b border-slate-100 text-slate-400 uppercase text-[10px] tracking-wider">
                  <th className="py-3 px-5 font-semibold">User</th>
                  <th className="py-3 px-4 font-semibold">Username</th>
                  <th className="py-3 px-4 font-semibold">Email</th>
                  <th className="py-3 px-4 font-semibold">Role</th>
                  <th className="py-3 px-4 font-semibold">Currency</th>
                  <th className="py-3 px-4 font-semibold">Created</th>
                  {isAdmin && <th className="py-3 px-5 font-semibold text-right">Actions</th>}
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {users.map((u) => {
                  const isUserAdmin = u.role === 'admin' || u.role === 'owner';
                  return (
                    <tr key={u.id} className="hover:bg-slate-50/60 transition">
                      {/* Avatar with first letter of first name and last name, color-coded by role */}
                      <td className="py-3.5 px-5 font-semibold text-slate-800">
                        <div className="flex items-center gap-3">
                          <div
                            className={`w-8 h-8 rounded-full flex items-center justify-center text-xs font-bold shrink-0 transition-transform ${
                              isUserAdmin
                                ? 'bg-gradient-to-br from-violet-600 to-indigo-700 text-white ring-2 ring-indigo-200 shadow-xs'
                                : 'bg-gradient-to-br from-teal-500 to-emerald-600 text-white ring-2 ring-emerald-200 shadow-xs'
                            }`}
                            title={`${u.name} (${u.role})`}
                          >
                            {getUserInitials(u.name)}
                          </div>
                          <div>
                            <span className="font-semibold text-slate-900 block">{u.name}</span>
                          </div>
                        </div>
                      </td>
                      <td className="py-3.5 px-4 font-mono text-slate-600">@{u.username}</td>
                      <td className="py-3.5 px-4 text-slate-600">{u.email}</td>
                      <td className="py-3.5 px-4">
                        <span
                          className={`px-2.5 py-0.5 rounded-full font-bold text-[10px] uppercase tracking-wide ${
                            isUserAdmin
                              ? 'bg-purple-50 text-purple-700 border border-purple-200'
                              : 'bg-emerald-50 text-emerald-700 border border-emerald-200'
                          }`}
                        >
                          {u.role}
                        </span>
                      </td>
                      <td className="py-3.5 px-4">
                        <span className="px-2 py-0.5 rounded-md bg-slate-100 border border-slate-200/80 font-mono text-[11px] font-bold text-slate-700">
                          {u.preferred_currency || 'USD'}
                        </span>
                      </td>
                      <td className="py-3.5 px-4 text-slate-400">
                        {u.created_at?.split('T')[0]}
                      </td>

                      {/* Action column: only visible to admins. Delete icon shown only for role agent, not admin */}
                      {isAdmin && (
                        <td className="py-3.5 px-5 text-right">
                          {u.role === 'agent' ? (
                            <button
                              id={`delete-user-btn-${u.id}`}
                              onClick={() => handleDeleteUser(u)}
                              disabled={deletingUserId === u.id}
                              className="p-1.5 rounded-xl border border-red-200 text-red-600 hover:bg-red-50 hover:border-red-300 transition inline-flex items-center gap-1.5 text-xs font-semibold disabled:opacity-50"
                              title={`Delete agent ${u.name}`}
                            >
                              <Trash2 size={13} />
                              <span className="text-[11px]">{deletingUserId === u.id ? 'Deleting...' : 'Delete'}</span>
                            </button>
                          ) : (
                            <span className="text-slate-300 text-xs select-none pr-3">—</span>
                          )}
                        </td>
                      )}
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* Tab 5: Security Audit Log */}
      {activeTab === 'audit' && (
        <div className="bg-white rounded-3xl border border-slate-200/80 shadow-xs overflow-hidden">
          <div className="p-5 border-b border-slate-100">
            <h3 className="text-sm font-bold text-slate-800">Immutable Security Audit Trail</h3>
            <p className="text-xs text-slate-400">Chronological ledger of logins, credential decryptions, and orders</p>
          </div>

          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs font-mono">
              <thead>
                <tr className="bg-slate-50/60 border-b border-slate-100 text-slate-400 uppercase text-[10px] tracking-wider">
                  <th className="py-3 px-5 font-semibold">Timestamp</th>
                  <th className="py-3 px-4 font-semibold">Actor</th>
                  <th className="py-3 px-4 font-semibold">Action</th>
                  <th className="py-3 px-4 font-semibold">Target Entity</th>
                  <th className="py-3 px-5 font-semibold">Details</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100 text-[11px]">
                {auditLogs.map((log) => (
                  <tr key={log.id} className="hover:bg-slate-50/60 transition">
                    <td className="py-3 px-5 text-slate-500 whitespace-nowrap">
                      {new Date(log.created_at).toLocaleString()}
                    </td>
                    <td className="py-3 px-4 font-semibold text-slate-800">{log.username || 'System'}</td>
                    <td className="py-3 px-4 font-bold text-blue-700">{log.action}</td>
                    <td className="py-3 px-4 text-slate-600">{log.entity} #{log.entity_id?.slice(0, 8)}</td>
                    <td className="py-3 px-5 text-slate-400 truncate max-w-xs">
                      {JSON.stringify(log.details)}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* Modal: Add Staff User (Role select kept strictly to admin and agent) */}
      {showAddUser && (
        <div
          id="add-staff-modal-backdrop"
          onClick={() => setShowAddUser(false)}
          className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/40 backdrop-blur-xs p-4 animate-in fade-in duration-150"
        >
          <div
            id="add-staff-modal-dialog"
            onClick={(e) => e.stopPropagation()}
            className="w-full max-w-md bg-white rounded-3xl shadow-2xl border border-slate-200 p-6 space-y-4 relative"
          >
            <div className="flex items-center justify-between">
              <h3 className="text-base font-bold text-slate-900">Add Staff Team Member</h3>
              <button
                onClick={() => setShowAddUser(false)}
                className="p-1 text-slate-400 hover:text-slate-700 rounded-lg hover:bg-slate-100 transition"
              >
                <X size={18} />
              </button>
            </div>

            <form onSubmit={handleCreateUser} className="space-y-3">
              <div>
                <label className="text-xs font-semibold text-slate-700 block mb-1">Full Name *</label>
                <input
                  type="text"
                  required
                  placeholder="e.g. Marcus Vance"
                  value={newName}
                  onChange={(e) => setNewName(e.target.value)}
                  className="w-full bg-slate-50 border border-slate-200 rounded-xl px-3 py-2 text-xs text-slate-800 focus:outline-hidden focus:bg-white"
                />
              </div>

              <div className="grid grid-cols-2 gap-2">
                <div>
                  <label className="text-xs font-semibold text-slate-700 block mb-1">Username *</label>
                  <input
                    type="text"
                    required
                    placeholder="marcus"
                    value={newUsername}
                    onChange={(e) => setNewUsername(e.target.value)}
                    className="w-full bg-slate-50 border border-slate-200 rounded-xl px-3 py-2 text-xs text-slate-800 focus:outline-hidden focus:bg-white"
                  />
                </div>
                <div>
                  <label className="text-xs font-semibold text-slate-700 block mb-1">Role *</label>
                  <select
                    value={newRole}
                    onChange={(e) => setNewRole(e.target.value as any)}
                    className="w-full bg-slate-50 border border-slate-200 rounded-xl px-3 py-2 text-xs text-slate-800 font-medium focus:outline-hidden focus:bg-white"
                  >
                    <option value="agent">Agent</option>
                    <option value="admin">Admin</option>
                  </select>
                </div>
              </div>

              <div>
                <label className="text-xs font-semibold text-slate-700 block mb-1">Email *</label>
                <input
                  type="email"
                  required
                  placeholder="marcus@reseller-erp.com"
                  value={newEmail}
                  onChange={(e) => setNewEmail(e.target.value)}
                  className="w-full bg-slate-50 border border-slate-200 rounded-xl px-3 py-2 text-xs text-slate-800 focus:outline-hidden focus:bg-white"
                />
              </div>

              <div>
                <label className="text-xs font-semibold text-slate-700 block mb-1">Password *</label>
                <input
                  type="password"
                  required
                  placeholder="At least 6 characters"
                  value={newPasswordState}
                  onChange={(e) => setNewPasswordState(e.target.value)}
                  className="w-full bg-slate-50 border border-slate-200 rounded-xl px-3 py-2 text-xs text-slate-800 focus:outline-hidden focus:bg-white"
                />
              </div>

              <div className="flex justify-end gap-2 pt-2">
                <button
                  type="button"
                  onClick={() => setShowAddUser(false)}
                  className="px-4 py-2 border border-slate-200 hover:bg-slate-50 rounded-xl text-xs text-slate-600 transition"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="px-5 py-2 bg-blue-600 text-white rounded-xl text-xs font-semibold hover:bg-blue-500 shadow-xs transition"
                >
                  Create User
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Delete User Confirmation Modal */}
      {userPendingDelete && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-xs animate-in fade-in">
          <div className="bg-white rounded-3xl max-w-md w-full p-6 shadow-2xl border border-slate-100 space-y-4">
            <div className="flex items-center gap-3">
              <div className="h-10 w-10 rounded-2xl bg-rose-50 flex items-center justify-center text-rose-600 shrink-0">
                <Trash2 size={20} />
              </div>
              <div>
                <h3 className="font-bold text-sm text-slate-900">Delete Staff User</h3>
                <p className="text-xs text-slate-500">
                  Are you sure you want to delete <span className="font-semibold text-slate-800">{userPendingDelete.name}</span> (@{userPendingDelete.username})?
                </p>
              </div>
            </div>

            <p className="text-xs text-slate-500 bg-slate-50 p-3 rounded-2xl border border-slate-100">
              This action cannot be undone. The user will immediately lose system access.
            </p>

            <div className="flex items-center justify-end gap-2 pt-2">
              <button
                type="button"
                onClick={() => setUserPendingDelete(null)}
                disabled={deletingUserId !== null}
                className="px-4 py-2 border border-slate-200 rounded-xl text-xs text-slate-600 hover:bg-slate-50 transition"
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={handleConfirmDeleteUser}
                disabled={deletingUserId !== null}
                className="px-4 py-2 bg-rose-600 hover:bg-rose-500 text-white rounded-xl text-xs font-semibold shadow-xs disabled:opacity-50 transition"
              >
                {deletingUserId ? 'Deleting...' : 'Delete User'}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Toast Notification */}
      {toastMessage && (
        <div className="fixed bottom-6 right-6 z-50 bg-slate-900 text-white px-4 py-3 rounded-2xl shadow-2xl flex items-center gap-2.5 text-xs animate-in slide-in-from-bottom-3 duration-150 border border-slate-700">
          <CheckCircle2 size={16} className="text-emerald-400 shrink-0" />
          <span>{toastMessage}</span>
          <button
            onClick={() => setToastMessage(null)}
            className="text-slate-400 hover:text-white p-0.5 ml-2 transition"
          >
            <X size={14} />
          </button>
        </div>
      )}
    </div>
  );
};
