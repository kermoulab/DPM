import React from 'react';
import {
  LayoutDashboard,
  ShoppingBag,
  Box,
  Layers,
  Users,
  MessageSquare,
  Bell,
  Smartphone,
  ShieldCheck,
  Settings,
  ChevronLeft,
  ChevronRight,
  Plus,
  X
} from 'lucide-react';

interface SidebarProps {
  currentTab?: string;
  activeTab?: string;
  onSelectTab: (tab: string) => void;
  onOpenOrderBuilder: () => void;
  alertCount: number;
  mobileOpen?: boolean;
  onCloseMobile?: () => void;
}

export const Sidebar: React.FC<SidebarProps> = ({
  currentTab,
  activeTab,
  onSelectTab,
  onOpenOrderBuilder,
  alertCount,
  mobileOpen = false,
  onCloseMobile
}) => {
  const [collapsed, setCollapsed] = React.useState(false);
  const selectedTab = currentTab || activeTab || 'dashboard';

  // Close mobile sidebar on Escape key
  React.useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape' && mobileOpen && onCloseMobile) {
        onCloseMobile();
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [mobileOpen, onCloseMobile]);

  const navItems = [
    { id: 'dashboard', label: 'Dashboard', icon: LayoutDashboard },
    { id: 'orders', label: 'Orders & Sales', icon: ShoppingBag },
    { id: 'products', label: 'Products & Plans', icon: Box },
    { id: 'inventory', label: 'Inventory Bank', icon: Layers },
    { id: 'customers', label: 'Customers', icon: Users },
    { id: 'whatsapp', label: 'WhatsApp', icon: MessageSquare },
    { id: 'alerts', label: 'Alerts', icon: Bell, badge: alertCount },
    { id: 'devices', label: 'Android Pairing', icon: Smartphone },
    { id: 'settings', label: 'Settings', icon: Settings }
  ];

  const handleNavClick = (tabId: string) => {
    onSelectTab(tabId);
    if (onCloseMobile) {
      onCloseMobile();
    }
  };

  const handleOrderBuilderClick = () => {
    onOpenOrderBuilder();
    if (onCloseMobile) {
      onCloseMobile();
    }
  };

  return (
    <>
      {/* 1. Mobile Backdrop Overlay (Clicking anywhere outside closes drawer) */}
      {mobileOpen && (
        <div
          id="mobile-sidebar-backdrop"
          onClick={onCloseMobile}
          className="fixed inset-0 bg-slate-950/60 backdrop-blur-xs z-40 lg:hidden animate-in fade-in duration-200"
          aria-hidden="true"
        />
      )}

      {/* 2. Mobile Slide-Over Drawer */}
      <aside
        id="mobile-sidebar-drawer"
        onClick={(e) => e.stopPropagation()}
        className={`fixed inset-y-0 left-0 w-60 bg-[#151828] text-slate-400 flex flex-col justify-between z-50 shadow-2xl transition-transform duration-300 lg:hidden ${
          mobileOpen ? 'translate-x-0' : '-translate-x-full'
        }`}
      >
        <div>
          {/* Mobile Header */}
          <div className="h-16 flex items-center justify-between px-4 border-b border-slate-800/80">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-xl bg-blue-600 flex items-center justify-center text-white font-bold text-lg shadow-lg shadow-blue-600/30 shrink-0">
                ⚡
              </div>
              <div>
                <h1 className="font-semibold text-white text-sm tracking-tight">
                  Vectis SYSTEM
                </h1>
              </div>
            </div>

            {/* Mobile Close Button */}
            <button
              id="mobile-sidebar-close-btn"
              onClick={onCloseMobile}
              className="text-slate-400 hover:text-white p-1.5 rounded-lg hover:bg-slate-800/60 transition"
              title="Close navigation"
            >
              <X size={20} />
            </button>
          </div>

          {/* Mobile Create Order Button */}
          <div className="p-3">
            <button
              onClick={handleOrderBuilderClick}
              className="w-full bg-blue-600 hover:bg-blue-500 text-white rounded-xl font-medium text-xs flex items-center justify-center gap-2 py-3 shadow-md shadow-blue-600/20 transition px-3"
            >
              <Plus size={18} />
              <span>New Order</span>
            </button>
          </div>

          {/* Mobile Navigation List */}
          <nav className="px-3 space-y-1 py-2 max-h-[calc(100vh-210px)] overflow-y-auto">
            {navItems.map((item) => {
              const Icon = item.icon;
              const isActive = selectedTab === item.id;
              return (
                <button
                  key={item.id}
                  onClick={() => handleNavClick(item.id)}
                  className={`w-full flex items-center gap-3 px-3.5 py-2.5 rounded-2xl text-xs font-medium transition-all ${
                    isActive
                      ? 'bg-blue-600 text-white shadow-lg shadow-blue-600/25'
                      : 'text-slate-400 hover:text-slate-200 hover:bg-slate-800/60'
                  }`}
                >
                  <Icon size={18} className={isActive ? 'text-white' : 'text-slate-400'} />
                  <span className="truncate text-left flex-1">{item.label}</span>
                  {item.badge !== undefined && item.badge > 0 && (
                    <span className="min-w-[20px] h-5 px-1.5 rounded-full bg-red-600 text-white text-[10px] font-bold flex items-center justify-center shadow-xs">
                      {item.badge > 99 ? '99+' : item.badge}
                    </span>
                  )}
                </button>
              );
            })}
          </nav>
        </div>


      </aside>

      {/* 3. Desktop Sticky Sidebar (Always visible & sticky on large screens) */}
      <aside
        id="erp-sidebar"
        className={`hidden lg:flex bg-[#151828] text-slate-400 border-r border-slate-800 flex-col justify-between transition-all duration-200 z-30 shrink-0 sticky top-0 h-screen select-none overflow-y-auto ${
          collapsed ? 'w-16' : 'w-52'
        }`}
      >
        {/* Top Logo / App header */}
        <div>
          <div className="h-16 flex items-center justify-between px-3 border-b border-slate-800/80">
            <div className="flex items-center gap-2.5 overflow-hidden">
              <div className="w-9 h-9 rounded-xl bg-blue-600 flex items-center justify-center text-white font-bold text-base shadow-lg shadow-blue-600/30 shrink-0">
                ⚡
              </div>
              {!collapsed && (
                <div className="truncate">
                  <h1 className="font-semibold text-white text-xs tracking-tight">
                    Vectis SYSTEM
                  </h1>
                </div>
              )}
            </div>
            <button
              id="toggle-sidebar-btn"
              onClick={() => setCollapsed(!collapsed)}
              className="text-slate-500 hover:text-white p-1 rounded-lg hover:bg-slate-800/60 transition"
              title={collapsed ? 'Expand sidebar' : 'Collapse sidebar'}
            >
              {collapsed ? <ChevronRight size={15} /> : <ChevronLeft size={15} />}
            </button>
          </div>

          {/* Quick Create Order Button */}
          <div className="p-2.5">
            <button
              id="quick-create-order-btn"
              onClick={onOpenOrderBuilder}
              className={`w-full bg-blue-600 hover:bg-blue-500 text-white rounded-xl font-medium text-xs flex items-center justify-center gap-2 py-2.5 shadow-md shadow-blue-600/20 transition group ${
                collapsed ? 'px-0' : 'px-3'
              }`}
              title="Create New Order (Universal Engine)"
            >
              <Plus size={16} className="group-hover:rotate-90 transition-transform duration-200" />
              {!collapsed && <span>New Order</span>}
            </button>
          </div>

          {/* Nav Items */}
          <nav className="px-2.5 space-y-1 py-1.5">
            {navItems.map((item) => {
              const Icon = item.icon;
              const isActive = selectedTab === item.id;
              return (
                <button
                  key={item.id}
                  id={`nav-${item.id}`}
                  onClick={() => onSelectTab(item.id)}
                  className={`w-full flex items-center gap-2.5 px-3 py-2.5 rounded-xl text-xs font-medium transition-all relative group ${
                    isActive
                      ? 'bg-blue-600 text-white shadow-lg shadow-blue-600/25'
                      : 'text-slate-400 hover:text-slate-200 hover:bg-slate-800/60'
                  }`}
                  title={collapsed ? item.label : undefined}
                >
                  <div className="relative shrink-0 flex items-center justify-center">
                    <Icon size={18} className={isActive ? 'text-white' : 'text-slate-400 group-hover:text-white'} />
                    {item.badge !== undefined && item.badge > 0 && collapsed && (
                      <span className="absolute -top-1.5 -right-2 min-w-[18px] h-[18px] px-1 rounded-full bg-red-600 text-white text-[10px] font-bold flex items-center justify-center ring-2 ring-[#151828] shadow-xs">
                        {item.badge > 99 ? '99+' : item.badge}
                      </span>
                    )}
                  </div>
                  {!collapsed && (
                    <span className="truncate text-left flex-1">{item.label}</span>
                  )}
                  {!collapsed && item.badge !== undefined && item.badge > 0 && (
                    <span className="min-w-[18px] h-4.5 px-1 rounded-full bg-red-600 text-white text-[10px] font-bold flex items-center justify-center shadow-xs">
                      {item.badge > 99 ? '99+' : item.badge}
                    </span>
                  )}
                </button>
              );
            })}
          </nav>
        </div>


      </aside>
    </>
  );
};
