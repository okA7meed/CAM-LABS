export interface OrderMilestone {
  step: string;
  date: string;
  done: boolean;
  desc: string;
}

export type OrderStatus = 'In Review' | 'In Production' | 'Quality Inspection' | 'Delivered' | 'Cancelled';

export interface Order {
  id: string;
  userId?: string;
  partName: string;
  technology: string;
  material: string;
  quantity: number;
  date: string;
  estDelivery: string;
  status: OrderStatus;
  statusBadge?: string;
  progressStep: number; // 1: CAD Review, 2: Machining, 3: CMM QA, 4: Shipped
  totalCost: string;
  tolerance: string;
  trackingNum?: string;
  history: OrderMilestone[];
  createdAt?: string;
  updatedAt?: string;
}
