
import React from 'react';
import { api } from './api';
import type { User, DashboardStats, Currency, Order } from './types';
import { Sidebar } from './components/Sidebar';
import { Topbar } from './components/Topbar';
import { GlobalSearchModal } from './components/GlobalSearchModal';
import { AlertsDrawer } from './components/AlertsDrawer';
import { OrderBuilderModal } from './components/OrderBuilderModal';
import { DeliveryReceiptModal } from './components/DeliveryReceiptModal';
import { ErrorBoundary } from './components/ErrorBoundary';
import { CurrencyProvider } from './context/CurrencyContext';

import { Installer } from './pages/Installer';
import { Login } from './pages/Login';
import { DashboardView } from './pages/DashboardView';
import { OrdersView } from './pages/OrdersView';
import { ProductsView } from './pages/ProductsView';
import { InventoryView } from './pages/InventoryView';
import { CustomersView } from './pages/CustomersView';
import { WhatsAppView } from './pages/WhatsAppView';
import { DevicesView } from './pages/DevicesView';
import { SettingsView } from './pages/SettingsView';
import { AlertsView } from './pages/AlertsView';

export default function App() {
  // App initialization state
  const [checkingInstall, setCheckingInstall] = React.useState(true);
  const [isInstalled, setIsInstalled] = React.useState<boolean | null>(null);
  const [currentUser, setCurrentUser] = React.useState<User | null>(null);

  // Active navigation (defaults strictly to dashboard)
  const [activeTab, setActiveTabState] = React.useState(() => {
    try {
      const saved = localStorage.getItem('reseller_active_tab');
      return (saved && saved !== 'renewals') ? saved : 'dashboard';
    } catch {
      return 'dashboard';
    }
  });

  const setActiveTab = React.useCallback((tab: string) => {
    try {
      localStorage.setItem('reseller_active_tab', tab);
    } catch {}
    setActiveTabState(tab);
  }, []);
  const [mobileMenuOpen, setMobileMenuOpen] = React.useState(false);

  // Global modals & drawers
  const [searchModalOpen, setSearchModalOpen] = React.useState(false);
  const [alertsDrawerOpen, setAlertsDrawerOpen] = React.useState(false);
  const [orderBuilderOpen, setOrderBuilderOpen] = React.useState(false);
  const [activeReceiptOrder, setActiveReceiptOrder] = React.useState<Order | null>(null);

  // Preselected customer for order builder
  const [preselectedCustomerId, setPreselectedCustomerId] = React.useState<string | undefined>(undefined);

  // App metrics & badges
  const [stats, setStats] = React.useState<DashboardStats | null>(null);
  const [alertCount, setAlertCount] = React.useState(0);
  const [currencies, setCurrencies] = React.useState<Currency[]>([]);
  const [selectedCurrency, setSelectedCurrency] = React.useState<string>('USD');
  const [settingsSubTab, setSettingsSubTab] = React.useState<'profile' | 'general' | 'team' | 'audit'>('profile');

  // Check installation and auth on mount
  React.useEffect(() => {
    checkInitialState();
  }, []);

  // Listen for unauthorized 401 events to instantly destroy session
  React.useEffect(() => {
    const handleUnauthorized = () => {
      handleLogout();
    };
    window.addEventListener('auth:unauthorized', handleUnauthorized);
    return () => window.removeEventListener('auth:unauthorized', handleUnauthorized);
  }, []);

  // Keyboard shortcut for Cmd+K search
  React.useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === 'k') {
        e.preventDefault();
        setSearchModalOpen(true);
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, []);

  // Listen for data mutations across views to keep dashboard metrics & alerts fresh
  React.useEffect(() => {
    const handleDataMutated = () => {
      if (currentUser) {
        loadAppData();
      }
    };
    window.addEventListener('app:data-mutated', handleDataMutated);
    return () => window.removeEventListener('app:data-mutated', handleDataMutated);
  }, [currentUser]);

  // Always revalidate dashboard stats when user navigates to the dashboard tab
  React.useEffect(() => {
    if (activeTab === 'dashboard' && currentUser) {
      api.getDashboardStats().then((freshStats) => {
        setStats(freshStats);
      }).catch((err) => {
        console.error('Failed revalidating dashboard stats:', err);
      });
    }
  }, [activeTab, currentUser]);

  const checkInitialState = async () => {
    setCheckingInstall(true);
    try {
      const installRes = await api.getInstallStatus();
      setIsInstalled(installRes.installed);

      if (installRes.installed) {
        // Only attempt session verification if a token exists in storage
        if (api.hasSession()) {
          try {
            const userRes = await api.getMe();
            setCurrentUser(userRes.user);
            loadAppData();
          } catch {
            api.clearToken();
            setCurrentUser(null);
          }
        } else {
          // No active session: show login screen first
          setCurrentUser(null);
        }
      }
    } catch (err) {
      console.error('Failed checking initialization', err);
    } finally {
      setCheckingInstall(false);
    }
  };

  const loadAppData = async () => {
    try {
      const [statsRes, alertsRes, currRes] = await Promise.all([
        api.getDashboardStats(),
        api.getAlerts(),
        api.getCurrencies()
      ]);
      setStats(statsRes);
      const totalAlerts = typeof alertsRes.badgeCount === 'number'
        ? alertsRes.badgeCount
        : (alertsRes.expiringOrders?.length || 0) +
          (alertsRes.expiredOrders?.length || 0);
      setAlertCount(totalAlerts);
      setCurrencies(currRes.currencies);
    } catch (err) {
      console.error('Failed loading app data', err);
    }
  };

  const refreshAlertCount = async () => {
    try {
      const alertsRes = await api.getAlerts();
      const totalAlerts = typeof alertsRes.badgeCount === 'number'
        ? alertsRes.badgeCount
        : (alertsRes.expiringOrders?.length || 0) +
          (alertsRes.expiredOrders?.length || 0);
      setAlertCount(totalAlerts);
    } catch (err) {
      console.error('Failed refreshing alerts count', err);
    }
  };

  const handleLogout = async () => {
    try {
      await api.logout();
    } catch (e) {
      console.error('Logout error:', e);
    } finally {
      // 1. Destroy session token on client
      api.clearToken();
      try {
        localStorage.removeItem('reseller_active_tab');
        sessionStorage.clear();
      } catch {}

      // 2. Clear authenticated user
      setCurrentUser(null);

      // 3. Clear in-memory operational state
      setStats(null);
      setAlertCount(0);
      setActiveTabState('dashboard');
      setMobileMenuOpen(false);
      setSearchModalOpen(false);
      setAlertsDrawerOpen(false);
      setOrderBuilderOpen(false);
      setActiveReceiptOrder(null);
    }
  };

  const handleOrderCreated = (order: Order) => {
    setOrderBuilderOpen(false);
    setActiveReceiptOrder(order);
    window.dispatchEvent(new CustomEvent('app:data-mutated'));
    loadAppData();
  };

  const handleOpenOrderForCustomer = (customerId: string) => {
    setPreselectedCustomerId(customerId);
    setOrderBuilderOpen(true);
  };

  const handleRenewOrder = async (orderId: string): Promise<any> => {
    try {
      const res = await api.renewOrder(orderId);
      await loadAppData();
      return res;
    } catch (err: any) {
      alert(err.message || 'Failed to renew order.');
      throw err;
    }
  };

  // 1. Loading screen
  if (checkingInstall) {
    return (
      <div className="min-h-screen bg-[#F8FAFC] flex flex-col items-center justify-center space-y-3">
        <div className="w-12 h-12 rounded-2xl bg-blue-600 flex items-center justify-center shadow-lg shadow-blue-600/30 text-white font-bold text-lg animate-pulse">
          R
        </div>
        <p className="text-xs text-slate-500 font-medium tracking-wide">
          Booting Reseller ERP Database Engine...
        </p>
      </div>
    );
  }

  // 2. Installer screen (if not installed)
  if (isInstalled === false) {
    return (
      <Installer
        onInstallComplete={(user, token) => {
          // Auto-login: installer finalize returns a JWT + user
          if (token) api.setToken(token);
          setIsInstalled(true);
          setCurrentUser(user as any);
          setActiveTab('dashboard');
          loadAppData();
        }}
        onInstalled={() => {
          setIsInstalled(true);
          checkInitialState();
        }}
      />
    );
  }


  // 3. Login screen (if installed but not authenticated)
  if (!currentUser) {
    return (
      <Login
        onLoginSuccess={(user, token) => {
          if (token) {
            api.setToken(token);
          }
          setCurrentUser(user);
          setActiveTab('dashboard');
          loadAppData();
        }}
      />
    );
  }

  // 4. Main Application Layout
  return (
    <ErrorBoundary>
      <CurrencyProvider
        currentUser={currentUser}
        onUserCurrencyUpdated={(newCurr) => {
          if (currentUser) {
            setCurrentUser((prev) => (prev ? { ...prev, preferred_currency: newCurr } : null));
          }
        }}
      >
        <div className="min-h-screen bg-[#F8FAFC] text-slate-900 flex antialiased">
        {/* Desktop & Mobile Sidebar */}
        <Sidebar
          activeTab={activeTab}
          onSelectTab={(tab) => {
            setActiveTab(tab);
            setMobileMenuOpen(false);
          }}
          alertCount={alertCount}
          onOpenOrderBuilder={() => {
            setPreselectedCustomerId(undefined);
            setOrderBuilderOpen(true);
            setMobileMenuOpen(false);
          }}
          mobileOpen={mobileMenuOpen}
          onCloseMobile={() => setMobileMenuOpen(false)}
        />

        {/* Main Workspace Column */}
        <div className="flex-1 flex flex-col min-w-0">
          <Topbar
            user={currentUser}
            currentUser={currentUser}
            currencies={currencies}
            selectedCurrency={selectedCurrency}
            onSelectCurrency={setSelectedCurrency}
            alertCount={alertCount}
            onOpenAlerts={() => setAlertsDrawerOpen(true)}
            onOpenSearch={() => setSearchModalOpen(true)}
            onOpenProfile={() => {
              setSettingsSubTab('profile');
              setActiveTab('settings');
            }}
            onLogout={handleLogout}
            onToggleMobileMenu={() => setMobileMenuOpen(!mobileMenuOpen)}
          />

          {/* Scrollable Content Container */}
          <main className="flex-1 p-4 sm:p-6 lg:p-8 max-w-7xl w-full mx-auto">
          {activeTab === 'dashboard' && (
            <DashboardView
              stats={stats}
              onOpenOrderBuilder={() => setOrderBuilderOpen(true)}
              onNavigate={(tab) => setActiveTab(tab)}
            />
          )}

          {activeTab === 'orders' && (
            <OrdersView
              onOpenOrderBuilder={() => {
                setPreselectedCustomerId(undefined);
                setOrderBuilderOpen(true);
              }}
              onViewOrder={(ord) => setActiveReceiptOrder(ord)}
              onComposeWhatsApp={(orderId) => {
                setActiveTab('whatsapp');
              }}
              onRenewOrder={handleRenewOrder}
            />
          )}

          {activeTab === 'products' && <ProductsView />}

          {activeTab === 'inventory' && <InventoryView />}

          {activeTab === 'customers' && (
            <CustomersView
              onComposeWhatsApp={(orderId) => setActiveTab('whatsapp')}
              onOpenOrderForCustomer={handleOpenOrderForCustomer}
            />
          )}

          {activeTab === 'alerts' && (
            <AlertsView
              onRenewOrder={handleRenewOrder}
              onAlertCountChange={setAlertCount}
              onRefreshAlerts={refreshAlertCount}
              onComposeWhatsApp={(orderId) => {
                setActiveTab('whatsapp');
              }}
              onNavigate={(tab) => setActiveTab(tab)}
            />
          )}

          {activeTab === 'whatsapp' && <WhatsAppView />}

          {activeTab === 'devices' && <DevicesView />}

          {activeTab === 'users' && (
            <SettingsView
              initialTab="team"
              currentUser={currentUser}
              onUserUpdated={(updated) => setCurrentUser(updated)}
            />
          )}

          {activeTab === 'settings' && (
            <SettingsView
              initialTab={settingsSubTab}
              currentUser={currentUser}
              onUserUpdated={(updated) => setCurrentUser(updated)}
            />
          )}
        </main>
      </div>

      {/* Global Search Modal */}
      <GlobalSearchModal
        isOpen={searchModalOpen}
        onClose={() => setSearchModalOpen(false)}
        onNavigate={(tab, payload) => {
          setActiveTab(tab);
          setSearchModalOpen(false);
        }}
      />

      {/* Alerts Drawer */}
      <AlertsDrawer
        isOpen={alertsDrawerOpen}
        onClose={() => setAlertsDrawerOpen(false)}
        onRenewOrder={handleRenewOrder}
        onComposeWhatsApp={(orderId) => {
          setActiveTab('whatsapp');
          setAlertsDrawerOpen(false);
        }}
        onNavigate={(tab) => {
          setActiveTab(tab);
          setAlertsDrawerOpen(false);
        }}
      />

      {/* Universal Order Builder Modal */}
      <OrderBuilderModal
        isOpen={orderBuilderOpen}
        onClose={() => setOrderBuilderOpen(false)}
        onOrderCreated={handleOrderCreated}
        preselectedCustomerId={preselectedCustomerId}
      />

      {/* Delivery Receipt Modal */}
      <DeliveryReceiptModal
        isOpen={Boolean(activeReceiptOrder)}
        order={activeReceiptOrder}
        onClose={() => setActiveReceiptOrder(null)}
      />
    </div>
    </CurrencyProvider>
    </ErrorBoundary>
  );
}
