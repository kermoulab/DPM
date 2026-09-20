export type UserRole = 'owner' | 'admin' | 'manager' | 'agent' | 'viewer';

export interface User {
  id: string;
  username: string;
  email: string;
  name: string;
  role: UserRole;
  avatar?: string;
  preferred_currency?: string;
  status: 'active' | 'suspended';
  created_at: string;
  last_login?: string;
}

export interface Category {
  id: string;
  name: string;
  slug: string;
  icon?: string;
  description?: string;
  status: 'active' | 'inactive';
  product_count?: number;
  created_at: string;
}

export type ProductCapability = 
  | 'subscription'
  | 'service_account'
  | 'profiles'
  | 'license_key'
  | 'activation_code'
  | 'digital_file'
  | 'merch_mockup'
  | 'automatic_fulfillment'
  | 'manual_fulfillment'
  | 'custom_fields';

export interface Product {
  id: string;
  category_id: string;
  category_name?: string;
  name: string;
  slug: string;
  brand?: string;
  description?: string;
  status: 'active' | 'inactive';
  capabilities: ProductCapability[];
  fulfillment_type: string;
  custom_fields?: any[];
  icon?: string;
  image_url?: string;
  plan_count?: number;
  plans_count?: number;
  account_count?: number;
  license_count?: number;
  stock_limit?: number | null;
  is_stock_full?: boolean;
  available_stock?: number;
  created_at: string;
}

export interface Plan {
  id: string;
  product_id: string;
  product_name?: string;
  name: string;
  duration: number;
  duration_unit: 'hours' | 'days' | 'weeks' | 'months' | 'years';
  price: number;
  cost: number;
  currency: string;
  stock_limit?: number | null;
  active_orders_count?: number;
  is_stock_full?: boolean;
  status: 'active' | 'inactive';
  created_at: string;
}

export interface Customer {
  id: string;
  name: string;
  email?: string;
  whatsapp?: string;
  notes?: string;
  status: 'active' | 'inactive' | 'deactive' | 'blocked';
  total_orders?: number;
  total_spent?: number;
  active_orders?: number;
  expired_orders?: number;
  last_order_date?: string;
  created_at: string;
}

export interface ServiceAccount {
  id: string;
  product_id: string;
  product_name?: string;
  product_brand?: string;
  provider: string;
  login: string;
  has_credential: boolean;
  credential_masked?: string;
  status: 'active' | 'suspended' | 'expired';
  expiry_date?: string;
  capacity: number;
  notes?: string;
  total_profiles?: number;
  available_profiles?: number;
  assigned_profiles?: number;
  created_at: string;
}

export interface ServiceProfile {
  id: string;
  service_account_id: string;
  profile_name: string;
  pin?: string;
  status: 'available' | 'assigned' | 'reserved' | 'blocked';
  assigned_customer_id?: string;
  assigned_customer_name?: string;
  assigned_order_id?: string;
  created_at: string;
}

export interface LicenseKey {
  id: string;
  product_id: string;
  product_name?: string;
  license_key: string;
  status: 'available' | 'assigned' | 'expired' | 'blocked';
  assigned_order_id?: string;
  assigned_customer_id?: string;
  customer_name?: string;
  expiry_date?: string;
  notes?: string;
  created_at: string;
}

export interface Order {
  id: string;
  order_number: string;
  customer_id: string;
  customer_name: string;
  customer_email?: string;
  customer_whatsapp?: string;
  product_id: string;
  product_name: string;
  product_brand?: string;
  product_icon?: string;
  product_capabilities?: ProductCapability[];
  plan_id: string;
  plan_name: string;
  duration?: number;
  duration_unit?: string;
  status: 'pending' | 'active' | 'expiring' | 'expired' | 'cancelled' | 'completed';
  start_date: string;
  end_date: string;
  price: number;
  cost: number;
  currency: string;
  payment_status: 'paid' | 'pending' | 'refunded';
  payment_method: string;
  fulfillment_type: string;
  assigned_service_account_id?: string;
  assigned_profile_id?: string;
  assigned_license_key_id?: string;
  fulfillment_data: Record<string, any>;
  renewal_count: number;
  created_by_name?: string;
  created_at: string;
}

export interface OrderRenewal {
  id: string;
  order_id: string;
  previous_end_date: string;
  new_end_date: string;
  price: number;
  cost: number;
  currency: string;
  created_by_user_id?: string;
  renewed_by_name?: string;
  notes?: string;
  created_at: string;
}

export interface Currency {
  code: string;
  symbol: string;
  name: string;
  exchange_rate: number;
  decimal_precision: number;
  is_base: number;
  updated_at: string;
}

export interface NotificationTemplate {
  id: string;
  name: string;
  event_type: string;
  language: 'en' | 'fr' | 'ar' | 'ru';
  content: string;
  created_at: string;
  updated_at?: string;
}

export interface PairedDevice {
  id: string;
  device_name: string;
  device_type: string;
  status: 'pending' | 'paired' | 'revoked';
  paired_by_user?: string;
  pairing_code?: string;
  last_seen?: string;
  created_at: string;
}

export interface AuditLog {
  id: string;
  user_id?: string;
  username?: string;
  action: string;
  entity: string;
  entity_id?: string;
  details: Record<string, any>;
  ip?: string;
  created_at: string;
}

export interface MerchMockup {
  id: string;
  customer_id?: string;
  customer_name?: string;
  product_name: string;
  color: string;
  placement: string;
  logo_url: string;
  preview_image_url?: string;
  print_specs: {
    resolution?: string;
    dimensions_inches?: string;
    dimensions_pixels?: string;
    bleed?: string;
    color_profile?: string;
    print_technique?: string;
    safe_zone?: string;
    created_at?: string;
  };
  status: string;
  created_at: string;
}

export interface DashboardStats {
  financial: {
    totalRevenue: number;
    totalCost: number;
    grossProfit: number;
    profitMargin: number;
    revenueToday: number;
    revenueThisMonth: number;
    revenuePrevMonth: number;
    revenueGrowth: number;
  };
  customers: {
    total: number;
    active: number;
    blocked: number;
    inactive?: number;
    inactiveOrBlocked?: number;
    newThisMonth: number;
    growthRate: number;
    monthly?: Array<{ month: string; count: number }>;
  };
  orders: {
    total: number;
    active: number;
    expiring: number;
    expired: number;
    cancelled: number;
    activePercent?: number;
    expiringPercent?: number;
    expiredPercent?: number;
    growthRate: number;
    dailyOrders?: Array<{ day: string; count: number }>;
  };
  inventory: {
    stockStatus: number;
    turnoverRate: number;
    productsOrdered: number;
    serviceAccountsCount: number;
    assignedProfilesPercent?: number;
    unallocatedKeysPercent?: number;
    activeSubsPercent?: number;
    totalProfiles?: number;
    availableProfiles?: number;
    assignedProfiles?: number;
    totalLicenses?: number;
    availableLicenses?: number;
    assignedLicenses?: number;
  };
  saleAnalytics: {
    totalCompletedRate: number;
    completed: number;
    distributed: number;
    returned: number;
  };
  ordersOverview: Array<{
    month: string;
    orders: number;
    profit: number;
    revenue: number;
  }>;
  ordersOverviewByYear?: Record<string, Array<{
    month: string;
    orders: number;
    profit: number;
    revenue: number;
  }>>;
  purchaseAnalytics: Array<{
    month: string;
    sold: number;
    purchased: number;
  }>;
  categoryAnalytics?: {
    topCategories: Array<{
      id: string;
      name: string;
      totalOrders: number;
      totalRevenue: number;
      percentage: number;
      color: string;
    }>;
    monthlyTrendsByYear: Record<string, Array<{
      month: string;
      byCategory: Record<string, { orders: number; revenue: number }>;
      totalOrders: number;
      totalRevenue: number;
    }>>;
  };
  topProducts: Array<{
    id: string;
    name: string;
    slug: string;
    brand: string;
    icon: string;
    fulfillment_type: string;
    orderCount: number;
    totalRevenue: number;
  }>;
  suggestions: Array<{
    type: 'warning' | 'alert' | 'opportunity';
    title: string;
    description: string;
    actionText?: string;
    actionRoute?: string;
    items?: any[];
  }>;
}
