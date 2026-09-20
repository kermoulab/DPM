import React from 'react';
import { Search, Bell, LogOut, Key, UserCheck, Shield, ChevronDown, Coins, Menu, User as UserIcon } from 'lucide-react';
import type { User, Currency } from '../types';
import { useCurrency } from '../context/CurrencyContext';

interface TopbarProps {
  user?: User | null;
  currentUser?: User | null;
  currencies?: Currency[];
  selectedCurrency?: string;
  onSelectCurrency?: (code: string) => void;
  isSavingCurrency?: boolean;
  alertCount: number;
  onOpenSearch: () => void;
  onOpenAlerts: () => void;
  onLogout: () => void;
  onOpenProfile?: () => void;
  onChangePassword?: () => void;
  onToggleMobileMenu?: () => void;
}

export const Topbar: React.FC<TopbarProps> = ({
  user,
  currentUser,
  currencies = [],
  selectedCurrency = 'USD',
  onSelectCurrency,
  isSavingCurrency,
  alertCount,
  onOpenSearch,
  onOpenAlerts,
  onLogout,
  onOpenProfile,
  onChangePassword,
  onToggleMobileMenu
}) => {
  const [profileOpen, setProfileOpen] = React.useState(false);
  const [currencyOpen, setCurrencyOpen] = React.useState(false);
  const menuRef = React.useRef<HTMLDivElement>(null);
  const currRef = React.useRef<HTMLDivElement>(null);

  const currencyCtx = useCurrency();
  const availableCurrencies = (currencies && currencies.length > 0) ? currencies : currencyCtx.currencies;
  const activeCurrencyCode = (currencyCtx.selectedCurrency) || selectedCurrency || 'USD';
  const isSaving = isSavingCurrency !== undefined ? isSavingCurrency : currencyCtx.isSaving;

  const handleCurrencySelect = (code: string) => {
    if (onSelectCurrency) {
      onSelectCurrency(code);
    }
    currencyCtx.setCurrency(code);
  };

  const activeUser: User = (user || currentUser) ?? {
    id: '',
    username: 'user',
    name: 'User',
    email: '',
    role: 'viewer',
    status: 'active',
    created_at: ''
  };

  const displayName = activeUser.name || activeUser.username || 'Admin';
  const displayRole = activeUser.role === 'owner' ? 'Store Owner' : (activeUser.role || 'Staff');
  const initials = displayName
    .split(' ')
    .map((n) => n[0])
    .filter(Boolean)
    .join('')
    .toUpperCase()
    .slice(0, 2) || 'AD';

  React.useEffect(() => {
    function handleClickOutside(e: MouseEvent) {
      if (menuRef.current && !menuRef.current.contains(e.target as Node)) {
        setProfileOpen(false);
      }
      if (currRef.current && !currRef.current.contains(e.target as Node)) {
        setCurrencyOpen(false);
      }
    }
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  return (
    <header
      id="erp-topbar"
      className="h-16 bg-white border-b border-slate-200/80 px-4 sm:px-6 flex items-center justify-between sticky top-0 z-20 shadow-xs"
    >
      {/* Left Area: Mobile Menu Toggle & Search Bar */}
      <div className="flex items-center gap-2 flex-1 max-w-xl">
        {onToggleMobileMenu && (
          <button
            id="mobile-menu-toggle-btn"
            type="button"
            onClick={onToggleMobileMenu}
            className="lg:hidden p-2 rounded-xl text-slate-600 hover:text-slate-900 hover:bg-slate-100 transition shrink-0"
            title="Toggle Navigation Menu"
            aria-label="Toggle navigation menu"
          >
            <Menu size={20} />
          </button>
        )}
        <div
          id="global-search-trigger"
          onClick={onOpenSearch}
          className="relative flex items-center w-full cursor-pointer group"
        >
          <div className="absolute left-3.5 text-slate-400 group-hover:text-blue-600 transition">
            <Search size={17} />
          </div>
          <input
            type="text"
            readOnly
            placeholder="Search for anything's... (Customers, Orders, Keys)"
            className="w-full bg-slate-50 hover:bg-slate-100/80 border border-slate-200 rounded-full pl-10 pr-16 py-2 text-xs text-slate-700 placeholder-slate-400 focus:outline-hidden transition cursor-pointer"
          />
          <div className="absolute right-3 flex items-center gap-1">
            <kbd className="px-1.5 py-0.5 text-[10px] font-semibold text-slate-400 bg-white border border-slate-200 rounded-md shadow-2xs">
              Ctrl+K
            </kbd>
          </div>
        </div>
      </div>

      {/* Right Controls */}
      <div className="flex items-center gap-3.5 ml-4">
        {/* Currency Switcher */}
        {availableCurrencies.length > 0 && (
          <div className="relative" ref={currRef}>
            <button
              id="topbar-currency-switcher-btn"
              onClick={() => setCurrencyOpen(!currencyOpen)}
              className="flex items-center gap-1.5 px-3 py-1.5 rounded-full border border-slate-200 bg-slate-50 hover:bg-slate-100 hover:border-slate-300 text-xs font-semibold text-slate-700 transition shadow-2xs cursor-pointer"
              title={`Active Currency: ${activeCurrencyCode}`}
            >
              <Coins size={14} className="text-amber-500 shrink-0" />
              <span className="font-bold">{activeCurrencyCode}</span>
              {isSaving && (
                <span className="w-1.5 h-1.5 rounded-full bg-blue-500 animate-ping" title="Saving to database..." />
              )}
              <ChevronDown size={12} className={`text-slate-400 transition-transform duration-150 ${currencyOpen ? 'rotate-180' : ''}`} />
            </button>

            {currencyOpen && (
              <div
                id="topbar-currency-dropdown"
                className="absolute right-0 mt-2 w-56 bg-white rounded-2xl shadow-xl border border-slate-200 py-1.5 z-50 text-xs animate-in fade-in zoom-in-95 duration-100 divide-y divide-slate-100"
              >
                <div className="px-3.5 py-2">
                  <span className="font-semibold text-slate-700 text-[11px]">System Currency</span>
                </div>
                <div className="max-h-64 overflow-y-auto py-1">
                  {availableCurrencies.map((c) => (
                    <button
                      key={c.code}
                      onClick={() => {
                        handleCurrencySelect(c.code);
                        setCurrencyOpen(false);
                      }}
                      className={`w-full px-3.5 py-2 text-left flex items-center justify-between hover:bg-slate-50 transition cursor-pointer ${
                        activeCurrencyCode === c.code ? 'font-bold text-blue-600 bg-blue-50/70' : 'text-slate-700'
                      }`}
                    >
                      <div className="flex items-center gap-2.5 min-w-0">
                        <span className="w-6 h-6 rounded-lg bg-slate-100 flex items-center justify-center font-bold text-[11px] text-slate-700 shrink-0 border border-slate-200/60">
                          {c.symbol}
                        </span>
                        <div className="min-w-0">
                          <p className="font-bold text-xs text-slate-800 leading-tight">{c.code}</p>
                          <p className="text-[10px] text-slate-400 font-normal truncate leading-tight">{c.name}</p>
                        </div>
                      </div>
                      {activeCurrencyCode === c.code && (
                        <span className="text-[10px] text-blue-600 font-bold bg-blue-100 px-1.5 py-0.5 rounded-md shrink-0">
                          Active
                        </span>
                      )}
                    </button>
                  ))}
                </div>
              </div>
            )}
          </div>
        )}

        {/* Notification Bell with indicator */}
        <button
          id="notification-bell-btn"
          onClick={onOpenAlerts}
          className="relative p-2.5 rounded-full hover:bg-slate-100 text-slate-600 transition"
          title={`Action Center: ${alertCount} total alerts (expiring, expired, low stock)`}
          aria-label={`${alertCount} active alerts`}
        >
          <Bell size={19} />
          {alertCount > 0 && (
            <span
              id="topbar-alerts-badge"
              className="absolute -top-0.5 -right-0.5 min-w-[18px] h-[18px] px-1 rounded-full bg-red-600 text-white text-[10px] font-bold flex items-center justify-center ring-2 ring-white shadow-xs"
            >
              {alertCount > 99 ? '99+' : alertCount}
            </span>
          )}
        </button>

        {/* Divider */}
        <div className="h-6 w-px bg-slate-200" />

        {/* Profile Pill (Matches topbar.png) */}
        <div className="relative" ref={menuRef}>
          <button
            id="profile-dropdown-btn"
            onClick={() => setProfileOpen(!profileOpen)}
            className="flex items-center gap-3 p-1.5 pr-3 rounded-full hover:bg-slate-100 transition text-left cursor-pointer"
          >
            <div className="relative">
              <div className="w-9 h-9 rounded-full bg-gradient-to-tr from-blue-600 to-indigo-500 text-white flex items-center justify-center font-semibold text-xs shadow-xs overflow-hidden">
                {activeUser.avatar ? (
                  <img
                    src={activeUser.avatar}
                    alt={displayName}
                    className="w-full h-full object-cover"
                  />
                ) : (
                  initials
                )}
              </div>
              {/* Online Green Status Dot */}
              <span className="absolute bottom-0 right-0 w-2.5 h-2.5 bg-emerald-500 border-2 border-white rounded-full" />
            </div>

            <div className="hidden sm:block leading-tight">
              <p className="text-xs font-semibold text-slate-800 tracking-tight">
                {displayName}
              </p>
              <p className="text-[11px] text-slate-400 capitalize">
                {displayRole}
              </p>
            </div>
          </button>

          {/* Profile Dropdown */}
          {profileOpen && (
            <div className="absolute right-0 mt-2 w-56 bg-white rounded-2xl shadow-xl border border-slate-150 py-2 z-50 text-xs animate-in fade-in zoom-in-95 duration-100">
              <div className="px-4 py-2 border-b border-slate-100">
                <p className="font-semibold text-slate-800">{displayName}</p>
                <p className="text-[11px] text-slate-400 truncate">{activeUser.email || `${activeUser.username}@apex-reseller.com`}</p>
                <span className="inline-block mt-1 px-2 py-0.5 rounded-full bg-blue-50 text-blue-700 text-[10px] font-medium uppercase tracking-wider">
                  {displayRole}
                </span>
              </div>

              <div className="py-1">
                {onOpenProfile && (
                  <button
                    onClick={() => {
                      setProfileOpen(false);
                      onOpenProfile();
                    }}
                    className="w-full px-4 py-2 flex items-center gap-2.5 text-slate-700 hover:bg-slate-50 hover:text-slate-900 text-left transition"
                  >
                    <UserIcon size={15} className="text-blue-600" />
                    <span className="font-medium">My Profile & Account</span>
                  </button>
                )}
                {onChangePassword && (
                  <button
                    onClick={() => {
                      setProfileOpen(false);
                      onChangePassword();
                    }}
                    className="w-full px-4 py-2 flex items-center gap-2.5 text-slate-600 hover:bg-slate-50 hover:text-slate-900 text-left transition"
                  >
                    <Key size={15} />
                    <span>Change Password</span>
                  </button>
                )}
              </div>

              <div className="border-t border-slate-100 pt-1">
                <button
                  onClick={() => {
                    setProfileOpen(false);
                    onLogout();
                  }}
                  className="w-full px-4 py-2 flex items-center gap-2.5 text-red-600 hover:bg-red-50 text-left transition"
                >
                  <LogOut size={15} />
                  <span>Log Out</span>
                </button>
              </div>
            </div>
          )}
        </div>
      </div>
    </header>
  );
};
