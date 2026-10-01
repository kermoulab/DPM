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
  ChevronDown,
  ChevronLeft,
  ChevronRight,
  Bell,
  Upload,
  Smartphone,
  Radio,
  FileCode,
  RefreshCw,
  Send,
  ExternalLink,
  HelpCircle,
  Loader2
} from 'lucide-react';
import { api } from '../api';
import { useCurrency } from '../context/CurrencyContext';
import { User, AuditLog, UserRole, sanitizeWhatsAppPhone, NotificationConfigStatus } from '../types';

interface SettingsViewProps {
  initialTab?: 'profile' | 'general' | 'team' | 'notifications' | 'audit';
  currentUser?: User | null;
  onUserUpdated?: (user: User) => void;
}

export const SettingsView: React.FC<SettingsViewProps> = ({
  initialTab = 'profile',
  currentUser,
  onUserUpdated
}) => {
  const [activeTab, setActiveTab] = React.useState<'profile' | 'general' | 'team' | 'notifications' | 'audit'>(initialTab);
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
  const [auditPage, setAuditPage] = React.useState(1);
  const [auditTotal, setAuditTotal] = React.useState(0);
  const [auditTotalPages, setAuditTotalPages] = React.useState(1);
  const [auditLoading, setAuditLoading] = React.useState(false);

  // Push Notifications state
  const [notifConfig, setNotifConfig] = React.useState<NotificationConfigStatus | null>(null);
  const [notifLoading, setNotifLoading] = React.useState(false);
  const [notifJsonInput, setNotifJsonInput] = React.useState('');
  const [showNotifPaste, setShowNotifPaste] = React.useState(false);
  const [notifSaveLoading, setNotifSaveLoading] = React.useState(false);
  const [notifError, setNotifError] = React.useState<string | null>(null);
  const [notifSuccess, setNotifSuccess] = React.useState<string | null>(null);
  const [testConnLoading, setTestConnLoading] = React.useState(false);
  const [testConnResult, setTestConnResult] = React.useState<{ success: boolean; message: string; projectId?: string } | null>(null);
  const [testPushLoading, setTestPushLoading] = React.useState(false);
  const [testPushResult, setTestPushResult] = React.useState<{ success: boolean; message: string; count?: number } | null>(null);
  const [runExpLoading, setRunExpLoading] = React.useState(false);
  const [runExpResult, setRunExpResult] = React.useState<{ success: boolean; message: string } | null>(null);
  const [notifFileType, setNotifFileType] = React.useState<'service_account' | 'client_config'>('service_account');
  const notifFileInputRef = React.useRef<HTMLInputElement | null>(null);

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

  const loadAuditLogs = async (pageToLoad: number) => {
    setAuditLoading(true);
    try {
      const res = await api.getAuditLogs({ page: pageToLoad, limit: 30 });
      setAuditLogs(res.logs || []);
      setAuditTotal(res.total ?? (res.logs?.length || 0));
      setAuditTotalPages(res.totalPages ?? 1);
      setAuditPage(res.page ?? pageToLoad);
    } catch (err) {
      console.error(err);
    } finally {
      setAuditLoading(false);
    }
  };

  const loadNotifConfig = async () => {
    setNotifLoading(true);
    setNotifError(null);
    try {
      const res = await api.getNotificationConfig();
      if (res && res.status) {
        setNotifConfig(res.status);
      }
    } catch (err: any) {
      setNotifError(err.message || 'Failed to load push notification configuration.');
    } finally {
      setNotifLoading(false);
    }
  };

  const handleFileUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    setNotifError(null);
    setNotifSuccess(null);
    const reader = new FileReader();
    reader.onload = (event) => {
      try {
        const content = event.target?.result as string;
        const parsed = JSON.parse(content);
        if (parsed.project_info && Array.isArray(parsed.client)) {
          setNotifFileType('client_config');
          setNotifJsonInput(content);
          setNotifSuccess(`Loaded Android Client Configuration (google-services.json) for project: ${parsed.project_info.project_id}`);
        } else if (parsed.project_id && parsed.client_email && parsed.private_key) {
          setNotifFileType('service_account');
          setNotifJsonInput(content);
          setNotifSuccess(`Loaded Firebase Service Account for project: ${parsed.project_id}`);
        } else {
          throw new Error('Unrecognized JSON format. Please upload either a Firebase service-account.json or google-services.json file.');
        }
      } catch (err: any) {
        setNotifError(err.message || 'Invalid JSON file.');
      }
    };
    reader.onerror = () => setNotifError('Failed to read file from disk.');
    reader.readAsText(file);
  };

  const handleSaveNotifConfig = async () => {
    if (!notifJsonInput.trim()) {
      setNotifError('Please select a JSON file or paste the Firebase credentials first.');
      return;
    }
    setNotifSaveLoading(true);
    setNotifError(null);
    setNotifSuccess(null);
    try {
      if (notifFileType === 'client_config') {
        const res = await api.saveClientConfig(notifJsonInput.trim());
        setNotifSuccess(`Android client configuration saved for project "${res.config?.projectId}".`);
      } else {
        const res = await api.saveNotificationConfig(notifJsonInput.trim());
        setNotifSuccess(`Firebase successfully activated for project "${res.projectId}".`);
      }
      setNotifJsonInput('');
      setShowNotifPaste(false);
      await loadNotifConfig();
      setToastMessage('Push notifications configured successfully!');
    } catch (err: any) {
      setNotifError(err.message || 'Failed to save Firebase configuration.');
    } finally {
      setNotifSaveLoading(false);
    }
  };

  const handleDisconnectNotif = async () => {
    if (!window.confirm('Are you sure you want to disconnect Firebase? Android push notifications will be disabled.')) return;
    setNotifSaveLoading(true);
    try {
      await api.deleteNotificationConfig();
      setNotifSuccess('Firebase disconnected successfully.');
      await loadNotifConfig();
      setToastMessage('Firebase configuration removed.');
    } catch (err: any) {
      setNotifError(err.message || 'Failed to disconnect Firebase.');
    } finally {
      setNotifSaveLoading(false);
    }
  };

  const handleTestConnection = async () => {
    setTestConnLoading(true);
    setTestConnResult(null);
    try {
      const res = await api.testNotificationConnection();
      setTestConnResult(res);
    } catch (err: any) {
      setTestConnResult({ success: false, message: err.message || 'Connection test failed.' });
    } finally {
      setTestConnLoading(false);
    }
  };

  const handleSendTestPush = async () => {
    setTestPushLoading(true);
    setTestPushResult(null);
    try {
      const res = await api.sendTestNotificationPush();
      setTestPushResult(res);
      if (res.success) {
        setToastMessage('Test notification sent to your Android device!');
      }
    } catch (err: any) {
      setTestPushResult({ success: false, message: err.message || 'Failed to dispatch test notification.' });
    } finally {
      setTestPushLoading(false);
    }
  };

  const handleRunExpirationCheck = async () => {
    setRunExpLoading(true);
    setRunExpResult(null);
    try {
      const res = await api.runExpirationCheck();
      const orderNotifs = res.orders?.notificationsSent ?? 0;
      const saNotifs = res.serviceAccounts?.notificationsSent ?? 0;
      const totalSent = orderNotifs + saNotifs;
      const msg = `Checked ${res.orders?.processed ?? 0} order(s) and ${res.serviceAccounts?.processed ?? 0} account(s). Dispatched ${totalSent} push notification(s) to active devices.`;
      setRunExpResult({ success: true, message: msg });
      setToastMessage(msg);
    } catch (err: any) {
      setRunExpResult({ success: false, message: err.message || 'Failed to execute expiration check.' });
    } finally {
      setRunExpLoading(false);
    }
  };

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
      } else if (activeTab === 'notifications') {
        await loadNotifConfig();
      } else if (activeTab === 'audit') {
        await loadAuditLogs(1);
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
          { id: 'notifications', label: 'Push Notifications', icon: Bell },
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
                        value={(profileRole === 'owner' ? 'admin' : profileRole).toUpperCase()}
                        className="w-full bg-slate-100 border border-slate-200 rounded-xl px-3.5 py-2.5 text-xs text-slate-500 font-bold uppercase cursor-not-allowed select-none"
                      />
                      <div className="absolute right-3 top-2.5 text-slate-400">
                        <Lock size={14} />
                      </div>
                    </div>
                    <p className="text-[10px] text-slate-400 leading-tight mt-1">
                      Role modifications are restricted to administrators in the Staff tab.
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
                type="tel"
                value={settings.support_phone || ''}
                onChange={(e) => setSettings({ ...settings, support_phone: sanitizeWhatsAppPhone(e.target.value) })}
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
                          {u.role === 'owner' ? 'admin' : u.role}
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

      {/* Tab 4: Push Notifications */}
      {activeTab === 'notifications' && (
        <div className="space-y-6">
          {/* Card 1: Overview & Live Status */}
          <div className="bg-white p-6 rounded-3xl border border-slate-200/80 shadow-xs space-y-5">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 pb-5 border-b border-slate-100">
              <div className="flex items-center gap-3.5">
                <div className={`w-12 h-12 rounded-2xl flex items-center justify-center text-white shadow-xs ${
                  notifConfig?.configured
                    ? 'bg-gradient-to-br from-emerald-500 to-teal-600'
                    : 'bg-gradient-to-br from-slate-400 to-slate-600'
                }`}>
                  <Bell size={22} />
                </div>
                <div>
                  <h3 className="text-base font-bold text-slate-900 tracking-tight">Android Push Notifications</h3>
                  <p className="text-xs text-slate-500">Firebase Cloud Messaging (FCM) Integration</p>
                </div>
              </div>

              <div>
                {notifLoading ? (
                  <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-semibold bg-slate-100 text-slate-600">
                    <Loader2 size={12} className="animate-spin" /> Checking status...
                  </span>
                ) : notifConfig?.configured ? (
                  <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-semibold bg-emerald-50 text-emerald-700 border border-emerald-200">
                    <span className="w-2 h-2 rounded-full bg-emerald-500 animate-pulse" />
                    Connected & Active
                  </span>
                ) : (
                  <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-semibold bg-slate-100 text-slate-600 border border-slate-200">
                    <span className="w-2 h-2 rounded-full bg-slate-400" />
                    Not Configured
                  </span>
                )}
              </div>
            </div>

            {/* Quick Metrics */}
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3">
              <div className="p-4 rounded-2xl bg-slate-50 border border-slate-200/70">
                <p className="text-[11px] font-semibold text-slate-400 uppercase tracking-wider">Connected Project</p>
                <p className="text-sm font-bold text-slate-800 mt-1 font-mono truncate">
                  {notifConfig?.projectId || '—'}
                </p>
                <span className="text-[10px] text-slate-400">
                  {notifConfig?.source === 'database' ? 'Stored in DB (Web Settings)' : notifConfig?.source === 'env' ? 'Configured via .env' : 'No credentials loaded'}
                </span>
              </div>

              <div className="p-4 rounded-2xl bg-slate-50 border border-slate-200/70">
                <p className="text-[11px] font-semibold text-slate-400 uppercase tracking-wider">Service Account</p>
                <p className="text-sm font-bold text-slate-800 mt-1 font-mono truncate" title={notifConfig?.clientEmail}>
                  {notifConfig?.clientEmail ? notifConfig.clientEmail.split('@')[0] + '@...' : '—'}
                </p>
                <span className="text-[10px] text-slate-400">Google Cloud IAM role</span>
              </div>

              <div className="p-4 rounded-2xl bg-slate-50 border border-slate-200/70">
                <p className="text-[11px] font-semibold text-slate-400 uppercase tracking-wider">Android App Sync</p>
                <div className="flex items-center gap-2 mt-1">
                  <Smartphone size={16} className={notifConfig?.clientConfigured ? 'text-emerald-600' : 'text-slate-400'} />
                  <p className="text-sm font-bold text-slate-800">
                    {notifConfig?.clientConfigured ? 'Auto-Synced' : 'Pending'}
                  </p>
                </div>
                <span className="text-[10px] text-slate-400">
                  {notifConfig?.clientConfigured ? 'Generic APK connects automatically' : 'Upload google-services.json to sync'}
                </span>
              </div>

              <div className="p-4 rounded-2xl bg-slate-50 border border-slate-200/70">
                <p className="text-[11px] font-semibold text-slate-400 uppercase tracking-wider">Registered Devices</p>
                <div className="flex items-center gap-2 mt-1">
                  <Smartphone size={16} className="text-blue-600" />
                  <p className="text-sm font-bold text-slate-800">
                    {notifConfig?.activeDevicesCount ?? 0}
                  </p>
                </div>
                <span className="text-[10px] text-slate-400">Active tokens ready to receive alerts</span>
              </div>
            </div>
          </div>

          {/* Card 2: Configuration & Credentials */}
          <div className="bg-white p-6 rounded-3xl border border-slate-200/80 shadow-xs space-y-6">
            <div>
              <h3 className="text-sm font-bold text-slate-900">Firebase Service Account Credentials</h3>
              <p className="text-xs text-slate-500 mt-0.5">
                No code or server commands needed. Simply upload the JSON key file you downloaded from your Firebase Console.
              </p>
            </div>

            {/* Error / Alert */}
            {notifError && (
              <div className="p-4 rounded-2xl bg-red-50 border border-red-200 flex items-start gap-3 text-xs text-red-700 animate-in fade-in">
                <AlertCircle size={16} className="shrink-0 mt-0.5 text-red-600" />
                <div className="flex-1">
                  <p className="font-bold">Configuration Error</p>
                  <p className="mt-0.5">{notifError}</p>
                </div>
                <button type="button" onClick={() => setNotifError(null)} className="text-red-400 hover:text-red-700 p-0.5">
                  <X size={14} />
                </button>
              </div>
            )}

            {/* Success */}
            {notifSuccess && (
              <div className="p-4 rounded-2xl bg-emerald-50 border border-emerald-200 flex items-center gap-3 text-xs text-emerald-800 animate-in fade-in">
                <CheckCircle2 size={16} className="shrink-0 text-emerald-600" />
                <span className="font-semibold">{notifSuccess}</span>
              </div>
            )}

            {/* Upload Area */}
            <div className="space-y-4">
              <input
                type="file"
                ref={notifFileInputRef}
                onChange={handleFileUpload}
                accept=".json,application/json"
                className="hidden"
              />

              <div
                onClick={() => notifFileInputRef.current?.click()}
                className="border-2 border-dashed border-slate-300 hover:border-blue-500 hover:bg-blue-50/30 rounded-2xl p-6 text-center cursor-pointer transition flex flex-col items-center justify-center gap-2 group"
              >
                <div className="w-12 h-12 rounded-2xl bg-blue-50 group-hover:bg-blue-100 flex items-center justify-center text-blue-600 transition">
                  <Upload size={20} />
                </div>
                <div>
                  <p className="text-xs font-bold text-slate-800 group-hover:text-blue-700 transition">
                    Click to browse and upload Firebase Service Account JSON
                  </p>
                  <p className="text-[11px] text-slate-400 mt-0.5">
                    Select your downloaded <code className="bg-slate-100 px-1 py-0.5 rounded font-mono">service-account.json</code> file
                  </p>
                </div>
              </div>

              {/* Paste Manual Accordion */}
              <div>
                <button
                  type="button"
                  onClick={() => setShowNotifPaste(!showNotifPaste)}
                  className="text-xs font-semibold text-blue-600 hover:text-blue-500 inline-flex items-center gap-1.5 transition"
                >
                  <ChevronDown size={14} className={`transform transition-transform ${showNotifPaste ? 'rotate-180' : ''}`} />
                  <span>{showNotifPaste ? 'Hide manual paste area' : 'Or paste JSON content manually'}</span>
                </button>

                {showNotifPaste && (
                  <div className="mt-3 space-y-2 animate-in fade-in duration-150">
                    <textarea
                      rows={6}
                      value={notifJsonInput}
                      onChange={(e) => setNotifJsonInput(e.target.value)}
                      placeholder='{ "type": "service_account", "project_id": "...", "private_key": "..." }'
                      className="w-full bg-slate-50 border border-slate-200 rounded-xl p-3 font-mono text-[11px] text-slate-800 focus:outline-hidden focus:bg-white focus:border-blue-500 transition"
                    />
                    <p className="text-[10px] text-slate-400">
                      Paste the raw contents of your Google Service Account key file here.
                    </p>
                  </div>
                )}
              </div>

              {/* Action Buttons */}
              <div className="flex flex-wrap items-center gap-3 pt-2">
                <button
                  type="button"
                  onClick={handleSaveNotifConfig}
                  disabled={notifSaveLoading || !notifJsonInput.trim()}
                  className="px-5 py-2.5 bg-blue-600 hover:bg-blue-500 text-white rounded-xl text-xs font-semibold flex items-center gap-2 shadow-xs disabled:opacity-50 transition"
                >
                  {notifSaveLoading ? <Loader2 size={14} className="animate-spin" /> : <Save size={14} />}
                  <span>Save & Activate Firebase</span>
                </button>

                {notifConfig?.configured && (
                  <button
                    type="button"
                    onClick={handleDisconnectNotif}
                    disabled={notifSaveLoading}
                    className="px-4 py-2.5 border border-red-200 text-red-600 hover:bg-red-50 rounded-xl text-xs font-semibold flex items-center gap-1.5 transition disabled:opacity-50"
                  >
                    <Trash2 size={13} />
                    <span>Disconnect Firebase</span>
                  </button>
                )}
              </div>
            </div>

            {/* Simple 3-step Instructions */}
            <div className="p-4 rounded-2xl bg-slate-50 border border-slate-200/80 space-y-2">
              <p className="text-xs font-bold text-slate-800 flex items-center gap-1.5">
                <HelpCircle size={14} className="text-blue-600" />
                <span>How to get your Firebase key in 3 simple steps:</span>
              </p>
              <ol className="list-decimal list-inside text-[11px] text-slate-600 space-y-1.5 leading-relaxed pl-1">
                <li>
                  Open <a href="https://console.firebase.google.com" target="_blank" rel="noreferrer" className="text-blue-600 font-semibold inline-flex items-center gap-0.5 hover:underline">Firebase Console <ExternalLink size={10} /></a> and select or create your project.
                </li>
                <li>
                  Click the gear icon <strong>⚙️ Project settings</strong> &gt; open the <strong>Service accounts</strong> tab.
                </li>
                <li>
                  Click <strong>Generate new private key</strong> &gt; choose <strong>Generate key</strong>. Upload or paste that downloaded file here.
                </li>
              </ol>
            </div>
          </div>

          {/* Card 3: Live Diagnostics & Verification */}
          <div className="bg-white p-6 rounded-3xl border border-slate-200/80 shadow-xs space-y-4">
            <div>
              <h3 className="text-sm font-bold text-slate-900">Live Diagnostics & Verification</h3>
              <p className="text-xs text-slate-500 mt-0.5">
                Test your server-to-Firebase connection and send an actual test push to your phone to confirm everything works.
              </p>
            </div>

            <div className="flex flex-wrap items-center gap-3">
              <button
                type="button"
                onClick={handleTestConnection}
                disabled={testConnLoading}
                className="px-4 py-2 rounded-xl border border-slate-200 bg-white text-slate-700 hover:bg-slate-50 text-xs font-semibold flex items-center gap-1.5 transition disabled:opacity-50 shadow-2xs"
              >
                {testConnLoading ? <Loader2 size={13} className="animate-spin text-blue-600" /> : <RefreshCw size={13} />}
                <span>Test Firebase Connection</span>
              </button>

              <button
                type="button"
                onClick={handleSendTestPush}
                disabled={testPushLoading || !notifConfig?.configured}
                className="px-4 py-2 rounded-xl bg-slate-900 hover:bg-slate-800 text-white text-xs font-semibold flex items-center gap-1.5 transition disabled:opacity-50 shadow-xs"
              >
                {testPushLoading ? <Loader2 size={13} className="animate-spin text-white" /> : <Send size={13} />}
                <span>Send Test Push to My Device</span>
              </button>

              <button
                type="button"
                onClick={handleRunExpirationCheck}
                disabled={runExpLoading || !notifConfig?.configured}
                className="px-4 py-2 rounded-xl border border-blue-200 bg-blue-50/70 hover:bg-blue-100/70 text-blue-700 text-xs font-semibold flex items-center gap-1.5 transition disabled:opacity-50 shadow-2xs"
              >
                {runExpLoading ? <Loader2 size={13} className="animate-spin text-blue-600" /> : <Bell size={13} />}
                <span>Run Expiration & Alert Check Now</span>
              </button>
            </div>

            {/* Test Connection Result */}
            {testConnResult && (
              <div className={`p-3.5 rounded-xl border text-xs font-medium flex items-center gap-2.5 animate-in fade-in ${
                testConnResult.success ? 'bg-emerald-50 border-emerald-200 text-emerald-800' : 'bg-red-50 border-red-200 text-red-700'
              }`}>
                {testConnResult.success ? <CheckCircle2 size={15} className="text-emerald-600 shrink-0" /> : <AlertCircle size={15} className="text-red-600 shrink-0" />}
                <span>{testConnResult.message}</span>
              </div>
            )}

            {/* Test Push Result */}
            {testPushResult && (
              <div className={`p-3.5 rounded-xl border text-xs font-medium flex items-center gap-2.5 animate-in fade-in ${
                testPushResult.success ? 'bg-emerald-50 border-emerald-200 text-emerald-800' : 'bg-amber-50 border-amber-200 text-amber-800'
              }`}>
                {testPushResult.success ? <CheckCircle2 size={15} className="text-emerald-600 shrink-0" /> : <AlertCircle size={15} className="text-amber-600 shrink-0" />}
                <span>{testPushResult.message}</span>
              </div>
            )}

            {/* Expiration Check Result */}
            {runExpResult && (
              <div className={`p-3.5 rounded-xl border text-xs font-medium flex items-center gap-2.5 animate-in fade-in ${
                runExpResult.success ? 'bg-emerald-50 border-emerald-200 text-emerald-800' : 'bg-red-50 border-red-200 text-red-700'
              }`}>
                {runExpResult.success ? <CheckCircle2 size={15} className="text-emerald-600 shrink-0" /> : <AlertCircle size={15} className="text-red-600 shrink-0" />}
                <span>{runExpResult.message}</span>
              </div>
            )}
          </div>
        </div>
      )}

      {/* Tab 5: Security Audit Log */}
      {activeTab === 'audit' && (
        <div className="bg-white rounded-3xl border border-slate-200/80 shadow-xs overflow-hidden">
          <div className="p-5 border-b border-slate-100 flex flex-col sm:flex-row sm:items-center justify-between gap-3">
            <div>
              <div className="flex items-center gap-2">
                <h3 className="text-sm font-bold text-slate-800">Immutable Security Audit Trail</h3>
                <span className="px-2 py-0.5 rounded-full text-[10px] font-bold bg-amber-50 text-amber-700 border border-amber-200">
                  30-Day Retention
                </span>
              </div>
              <p className="text-xs text-slate-400 mt-0.5">
                Chronological ledger of logins, decryptions, and orders
              </p>
            </div>
            <div className="text-xs font-medium text-slate-500 bg-slate-50 px-3 py-1.5 rounded-xl border border-slate-100 self-start sm:self-auto">
              Total: <span className="font-bold text-slate-800">{auditTotal}</span> events
            </div>
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
                {auditLogs.length === 0 ? (
                  <tr>
                    <td colSpan={5} className="py-12 text-center text-slate-400">
                      <div className="flex flex-col items-center justify-center gap-2">
                        <ShieldCheck size={28} className="text-slate-300" />
                        <p className="text-xs font-medium">No security events found within the 30-day retention window.</p>
                      </div>
                    </td>
                  </tr>
                ) : (
                  auditLogs.map((log) => (
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
                  ))
                )}
              </tbody>
            </table>
          </div>

          {/* Pagination Controls */}
          {auditTotal > 0 && (
            <div className="p-4 bg-slate-50/70 border-t border-slate-100 flex items-center justify-between gap-3 text-xs">
              <span className="text-slate-500 text-[11px]">
                Showing <strong className="text-slate-700">{(auditPage - 1) * 30 + 1}</strong> to{' '}
                <strong className="text-slate-700">{Math.min(auditPage * 30, auditTotal)}</strong> of{' '}
                <strong className="text-slate-700">{auditTotal}</strong> events
              </span>

              <div className="flex items-center gap-2">
                <button
                  type="button"
                  id="audit-prev-btn"
                  onClick={() => loadAuditLogs(auditPage - 1)}
                  disabled={auditPage <= 1 || auditLoading}
                  className="inline-flex items-center gap-1 px-3 py-1.5 rounded-xl border border-slate-200 bg-white text-slate-700 font-medium hover:bg-slate-50 disabled:opacity-40 disabled:cursor-not-allowed transition"
                >
                  <ChevronLeft size={14} />
                  <span>Previous</span>
                </button>

                <span className="px-3 py-1 rounded-xl bg-slate-100 text-slate-700 font-semibold text-[11px]">
                  {auditPage} / {auditTotalPages}
                </span>

                <button
                  type="button"
                  id="audit-next-btn"
                  onClick={() => loadAuditLogs(auditPage + 1)}
                  disabled={auditPage >= auditTotalPages || auditLoading}
                  className="inline-flex items-center gap-1 px-3 py-1.5 rounded-xl border border-slate-200 bg-white text-slate-700 font-medium hover:bg-slate-50 disabled:opacity-40 disabled:cursor-not-allowed transition"
                >
                  <span>Next</span>
                  <ChevronRight size={14} />
                </button>
              </div>
            </div>
          )}
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
