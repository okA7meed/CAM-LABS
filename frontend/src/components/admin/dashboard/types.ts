export type DashboardRange = '7' | '30' | '90' | 'year';

export interface DashboardStats {
  range: number | 'year';
  orders: {
    total: number;
    pending: number;
    inProduction: number;
    qualityInspection: number;
    completed: number;
    cancelled: number;
  };
  customers: { total: number };
  quotes: { total: number; active: number; approved: number };
  cadFiles: { total: number };
  manufacturers: { total: number; active: number };
  manufacturingRequests: {
    pending: number;
    accepted: number;
    inProgress: number;
    completed: number;
  };
  revenue: { total: number; currency: string; orderCount: number };
  pendingActions: {
    manufacturingRequests: number;
    orders: number;
    quotes: number;
    total: number;
  };
  system: { database: string; platform: string };
  trends: {
    orders: number[];
    revenue: number[];
    customers: number[];
    quotes: number[];
    cadFiles: number[];
    manufacturers: number[];
  };
  orderTimeline: Array<{ date: string; orders: number }>;
  activity: Array<{
    id: string;
    action: string;
    entityType: string;
    entityId?: string | null;
    actor?: string | null;
    createdAt: string;
  }>;
}