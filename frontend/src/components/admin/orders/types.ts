export interface OrderUser {
  id: string;
  name: string;
  email: string;
  company?: string | null;
}

export interface OrderManufacturer {
  id: string;
  companyName: string;
}

export interface OrderCadFileRef {
  cadFile: {
    id: string;
    name: string;
  };
}

export interface OrderRow {
  id: string;
  partName: string;
  technology: string;
  material: string;
  quantity: number;
  status: string;
  totalCost: string;
  paymentStatus?: string;
  manufacturingStatus?: string;
  shippingStatus?: string;
  createdAt: string;
  date?: string | null;
  user?: OrderUser;
  manufacturer?: OrderManufacturer | null;
  cadFiles?: OrderCadFileRef[];
}

export interface TrendDay {
  date: string;
  orders: number;
  inReview: number;
  inProduction: number;
  completed: number;
  cancelled: number;
}

export interface OrderStats {
  totalOrders: number;
  inReview: number;
  inProduction: number;
  qualityInspection: number;
  completed: number;
  cancelled: number;
  trend: TrendDay[];
}

export interface OrdersFilters {
  technologies: string[];
  materials: string[];
}

export interface OrdersResponse {
  orders: OrderRow[];
  total: number;
  stats: OrderStats;
  filters: OrdersFilters;
}

export interface AppliedFilters {
  status: string;
  technology: string;
  material: string;
  startDate: string;
  endDate: string;
}

export const EMPTY_FILTERS: AppliedFilters = { status: '', technology: '', material: '', startDate: '', endDate: '' };

export const ORDER_LIFECYCLE_STATUSES = ['In Review', 'In Production', 'Quality Inspection', 'Delivered', 'Cancelled'] as const;

export const ORDER_STATUS_TABS = [
  { key: 'all', labelKey: 'admin.orders.tabs.all', status: '', countKey: 'totalOrders' },
  { key: 'inReview', labelKey: 'admin.orders.tabs.inReview', status: 'In Review', countKey: 'inReview' },
  { key: 'inProduction', labelKey: 'admin.orders.tabs.inProduction', status: 'In Production', countKey: 'inProduction' },
  { key: 'shipped', labelKey: 'admin.orders.tabs.shipped', status: 'Delivered', countKey: 'qualityInspection' },
  { key: 'completed', labelKey: 'admin.orders.tabs.completed', status: 'Completed', countKey: 'completed' },
] as const;

export type OrderStatusTab = typeof ORDER_STATUS_TABS[number]['key'];
export type SortableColumn = 'id' | 'customer' | 'partName' | 'technology' | 'material' | 'quantity' | 'total' | 'status' | 'manufacturer' | 'createdAt';