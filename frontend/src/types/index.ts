export type ManufacturingTechnology = 'SLS' | 'SLA' | 'FDM' | 'CNC' | 'DMLS' | 'Sheet Metal' | 'Injection Molding';

export type MaterialCategory = 'Polymers' | 'High-Performance' | 'Metals' | 'Resins' | 'Elastomers';

export interface Material {
  id: string;
  name: string;
  technology: ManufacturingTechnology;
  category: MaterialCategory;
  description: string;
  tensileStrength: number; // in MPa
  hdt: number; // in °C @ 0.45 MPa
  elongation: number; // in %
  density: number; // in g/cm³
  standardTolerance: string;
  minWallThickness: string;
  leadTime: string;
  surfaceFinish: string;
  tags: string[];
  colorOptions: string[];
  idealFor: string;
  isCertified?: boolean;
  pricePerUnit?: number;
  priceUnit?: string;
  availability?: string;
  isActive?: boolean;
}

export type AvatarColor = 'blue' | 'red' | 'green' | 'purple' | 'orange' | 'yellow';

export const AVATAR_COLORS: AvatarColor[] = ['blue', 'red', 'green', 'purple', 'orange', 'yellow'];

export interface NotificationPreferences {
  quoteUpdates: boolean;
  orderStatus: boolean;
  manufacturingUpdates: boolean;
  shippingDelivery: boolean;
  messagesSupport: boolean;
  marketing: boolean;
}

export const DEFAULT_NOTIFICATION_PREFERENCES: NotificationPreferences = {
  quoteUpdates: true,
  orderStatus: true,
  manufacturingUpdates: true,
  shippingDelivery: true,
  messagesSupport: true,
  marketing: false,
};

export interface AddressBookEntry {
  id: string;
  label: string;
  street: string;
  building?: string;
  area?: string;
  city: string;
  governorate: string;
  postalCode?: string;
  deliveryNotes?: string;
}

export interface UserPreferences {
  units: 'mm' | 'in';
  toleranceStandard: string;
  dfmNotifications: boolean;
  dispatchAlerts: boolean;
  avatarColor?: AvatarColor;
  addressBook?: AddressBookEntry[];
  defaultAddressId?: string | null;
  notificationPrefs?: Partial<NotificationPreferences>;
  language?: 'en' | 'ar';
  theme?: 'light' | 'dark' | 'system';
}

export interface User {
  id: string;
  name: string;
  email: string;
  role: string;
  company: string;
  phone?: string;
  avatar: string;
  tier: string;
  address?: string;
  taxId?: string;
  preferences: UserPreferences;
  /** True when the account has TOTP two-factor authentication enabled. */
  twoFactorEnabled?: boolean;
  /** False for OAuth-only accounts (no password credential set). */
  hasPassword?: boolean;
  createdAt?: string;
  updatedAt?: string;
}

/**
 * Partial profile update accepted by PUT /auth/profile. Preferences are
 * merged server-side per key namespace, so sections send only their keys.
 */
export interface ProfileUpdate {
  name?: string;
  company?: string;
  phone?: string;
  address?: string;
  taxId?: string;
  governorate?: string;
  city?: string;
  addressLine1?: string;
  addressLine2?: string;
  postalCode?: string;
  country?: string;
  preferences?: Partial<UserPreferences> & Record<string, unknown>;
}

export interface OrderMilestone {
  step: string;
  date: string;
  done: boolean;
  desc: string;
}

export type OrderStatus = 'In Review' | 'In Production' | 'Quality Inspection' | 'Delivered' | 'Cancelled';

export interface TechnicalDocument {
  id: string;
  name: string;
  mimeType: string;
  byteSize: number;
  checksum?: string;
  scanStatus?: string;
  quoteId?: string | null;
  orderId?: string | null;
  createdAt?: string;
  userId?: string;
}

export interface Order {
  id: string;
  reference?: string | null;
  userId?: string;
  quoteId?: string;
  partName: string;
  technology: string;
  material: string;
  quantity: number;
  date: string;
  estDelivery: string;
  status: OrderStatus;
  statusBadge?: string;
  progressStep: number;
  totalCost: string;
  tolerance: string;
  priorityShipping?: boolean;
  trackingNum?: string;
  history: OrderMilestone[];
  preferredPaymentMethod?: string | null;
  shippingAddressSnapshot?: unknown;
  billingAddressSnapshot?: unknown;
  couponCodeSnapshot?: string | null;
  couponDiscountAmountApplied?: number | null;
  cadFileIds?: string[];
  cadFileConfigs?: Array<{ cadFileId: string; configuration: Record<string, unknown>; totalCost?: string }>;
  cadFiles?: Array<{ cadFileId: string; cadFile: CadFile; configuration?: Record<string, unknown> }>;
  technicalNotes?: string;
  technicalDocuments?: TechnicalDocument[];
  technicalDocumentIds?: string[];
  events?: OrderEvent[];
  user?: { id: string; name: string; email: string };
  createdAt?: string;
  updatedAt?: string;
}

export interface OrderEvent {
  id: string;
  orderId: string;
  eventType: string;
  description: string;
  metadata?: {
    previousPrice?: string;
    newPrice?: string;
    price?: number;
    changedByName?: string;
    changedBy?: string;
    reason?: string;
    from?: string;
    to?: string;
    [key: string]: unknown;
  };
  createdAt: string;
}

export type QuoteDeletionRequestStatus = 'PENDING' | 'APPROVED' | 'REJECTED';

export interface QuoteDeletionRequest {
  id: string;
  quoteId: string;
  requestedByUserId: string;
  status: QuoteDeletionRequestStatus;
  reason?: string | null;
  requestedAt: string;
  reviewedAt?: string | null;
  reviewedByAdminId?: string | null;
  adminNote?: string | null;
  quote?: (Partial<Quote> & {
    id: string;
    reference?: string | null;
    partName?: string;
    status?: string;
    user?: { id: string; name: string; email: string; company?: string } | null;
  }) | null;
}

export interface Quote {
  id: string;
  reference?: string | null;
  userId?: string;
  partName: string;
  technology: string;
  material: string;
  quantity: number;
  leadTime: string;
  unitPrice: string;
  totalPrice: string;
  validUntil: string;
  // Backend lifecycle (admin API QUOTE_LIFECYCLE_STATUSES): Draft, Ready for
  // Approval, Approved, Revised, Rejected — plus Expired for lapsed quotes.
  status: 'Draft' | 'Ready for Approval' | 'Approved' | 'Revised' | 'Rejected' | 'Expired';
  technicalNotes?: string;
  technicalDocuments?: TechnicalDocument[];
  technicalDocumentIds?: string[];
  contactName?: string | null;
  contactEmail?: string | null;
  contactPhone?: string | null;
  governorate?: string | null;
  city?: string | null;
  shippingMethod?: string | null;
  preferredPaymentMethod?: string | null;
  couponCodeSnapshot?: string | null;
  couponDiscountAmountApplied?: number | null;
  estimatedTotalAmount?: number | null;
  convertedOrderId?: string | null;
  /** Backend `cadFileIds` JSON column (authoritative quotation file list).
   *  Present on GET /quotes; absent on older cached payloads. */
  cadFileIds?: unknown;
  /** PENDING deletion request attached by GET /quotes and GET /quotes/:id
   *  (max 1). Present when the customer filed a deletion request that an
   *  admin has not reviewed yet. */
  deletionRequests?: Array<Pick<QuoteDeletionRequest, 'id' | 'status' | 'requestedAt' | 'reason'>>;
  /* ── Detail fields (GET /quotes/:id returns the full row; list payloads
   *  carry the same columns. All optional so lightweight snapshots stay
   *  assignable. No backend change. ── */
  /** Engine cost breakdown snapshot (multi-file: {files:[...]}, single: direct). */
  pricingBreakdown?: unknown;
  toleranceGrade?: string | null;
  surfaceFinish?: string | null;
  shippingCostAmount?: number | null;
  addressLine1?: string | null;
  addressLine2?: string | null;
  postalCode?: string | null;
  country?: string | null;
  /** Status audit (Quote has no event stream; these + createdAt are the record). */
  statusReason?: string | null;
  statusUpdatedAt?: string | null;
  statusUpdatedBy?: string | null;
  createdAt?: string;
  updatedAt?: string;
}

export interface CadFile {
  id: string;
  userId?: string;
  name: string;
  format: 'STEP' | 'STP' | 'STL' | 'OBJ' | 'PLY' | 'DXF' | 'SVG' | 'PDF' | 'IGES' | 'IGS';
  size: string;
  uploaded: string;
  volume: string;
  dimensions: string;
  meshTriangles: string;
  status: 'Analyzing' | 'Verified CAD' | 'DFM Flagged';
  latestVersion?: {
    id?: string;
    version: number;
    scanStatus: string;
    processingStatus: string;
    metadata?: { geometryStatus?: string; viewerAsset?: { available?: boolean; format?: string } | null } | null;
    failureCode?: string | null;
    failureMessage?: string | null;
    dfmReport?: { status: string; summary: { findings?: string[] } } | null;
  } | null;
}

export interface CadUploadResult extends CadFile {
  duplicate: boolean;
  jobId: string | null;
  version: NonNullable<CadFile['latestVersion']>;
}

export type ToastType = 'success' | 'error' | 'info' | 'warning';

export interface ToastAction {
  label: string;
  onClick: () => void;
}

export interface ToastOptions {
  /** Domain icon override (e.g. 'file' for Quote actions). State icon stays default. */
  icon?: import('../components/ui/Icon').IconName;
  /** Optional single action button (must represent a real available action). */
  action?: ToastAction;
  /** Auto-dismiss override in ms. Defaults: success/info 4500, warning 6000, error 8000. */
  durationMs?: number;
}

export interface ToastMessage {
  id: string;
  title: string;
  message: string;
  type: ToastType;
  /** Resolved icon name (domain override or per-type default). */
  icon: import('../components/ui/Icon').IconName;
  /** Real lifetime in ms — drives the progress indicator. */
  durationMs: number;
  /** Epoch ms when this toast dismisses — restarts on coalesced repeats. */
  expiresAt: number;
  /** Bumped when an identical visible toast coalesces (restarts progress). */
  repeat: number;
  action?: ToastAction;
}

export type ViewType = 'home' | 'services' | 'materials' | 'workflow' | 'about' | 'dashboard' | 'orders' | 'profile' | 'marketplace' | 'manufacturing-request' | 'submit-quote' | 'quote-success' | 'coming-soon' | 'equation-builder'
  | 'quotes' | 'shipping' | 'contact' | 'faq' | 'privacy' | 'terms' | 'nda' | 'security'
  | 'not-found' | 'admin-dashboard'
  | 'admin-orders' | 'admin-order-detail'
  | 'admin-customers' | 'admin-customer-detail'
  | 'admin-manufacturers' | 'admin-manufacturer-detail'
  | 'admin-manufacturing-requests' | 'admin-manufacturing-request-detail'
  | 'admin-materials'
  | 'admin-quotes' | 'admin-quote-detail'
  | 'admin-deletion-requests'
  | 'admin-discount-codes' | 'admin-discount-code-detail'
  | 'admin-cad-files' | 'admin-cad-file-detail'
  | 'admin-payments'
  | 'admin-shipping'
  | 'admin-pricing'
  | 'admin-pricing-constants'
  | 'admin-reports'
  | 'admin-notifications'
  | 'admin-users'
  | 'admin-audit-logs'
  | 'admin-settings';

export type AdminNotificationType = 'QUOTE' | 'ORDER' | 'USER_REGISTERED' | 'USER_LOGIN';
export type AdminNotificationPriority = 'INFO' | 'SUCCESS' | 'WARNING' | 'ERROR';

export interface AdminNotification {
  id: string;
  userId: string | null;
  type: string;
  title: string;
  message: string;
  metadata?: Record<string, unknown> | null;
  /** Read-only server enrichment: live Quote/Order reference for rows that
   *  predate the unified model. Absent on SSE payloads and older clients. */
  resolvedReference?: string | null;
  priority: AdminNotificationPriority;
  entityType?: string | null;
  entityId?: string | null;
  isRead: boolean;
  createdAt: string;
  readAt: string | null;
}

export interface AdminNotificationList {
  notifications: AdminNotification[];
  total: number;
  /** Backward-compatible server aggregation (same visibility scope). */
  counts?: {
    total: number;
    unread: number;
    quotes: number;
    orders: number;
    customers: number;
    system: number;
    quotesUnread: number;
    ordersUnread: number;
    customersUnread: number;
    systemUnread: number;
  } | null;
}

export interface AdminUnreadCount {
  count: number;
}
