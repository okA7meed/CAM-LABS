import { Material, Order, Quote, CadFile, CadUploadResult, User, ProfileUpdate, AdminNotification, AdminNotificationList, AdminUnreadCount, TechnicalDocument, AddressBookEntry } from '../types';

const API_BASE = '/api/v1';

/** A signed-in session visible in the Account Settings security panel. */
export interface AccountSession {
  id: string;
  /** Raw user-agent string (display metadata only, may be null). */
  device: string | null;
  ipAddress: string | null;
  expiresAt: string;
  createdAt: string;
  current: boolean;
}

/** Real-time Admin notification stream (Server-Sent Events). */
export const ADMIN_NOTIFICATIONS_STREAM = `${API_BASE}/admin/notifications/stream`;

export interface CalculatedQuotationData {
  quoteRef: string;
  manufacturingCostUnit: number;
  manufacturingCostTotal: number;
  totalCustomerPrice: number;
  customerUnitPrice: number;
  formattedManufacturingCost: string;
  formattedTotalPrice: string;
  formattedUnitPrice: string;
  currency: string;
  leadTime: string;
  discountAppliedPercentage: number;
  dfmSummary?: {
    isManufacturable: boolean;
    issues?: string[];
  };
  pricingBreakdown?: {
    materialCost: number;
    machineCost: number;
    laborCost: number;
    setupCost: number;
    postProcessingCost: number;
    finalCustomerPrice: number;
    currency: 'EGP';
    materialUsageGrams: number;
    machineTimeMinutes: number;
    sources: { materialUsage: string; machineTime: string; supportVolume: string };
  };
}

/**
 * NEW (Phase 04): Multi-file quotation response with per-file cost breakdown
 */
export interface MultiFileQuotation {
  quoteId: string;
  timestamp: string;
  expiresAt: string;
  files: Array<{
    fileId: string;
    fileName: string;
    quantity: number;
    material: string;
    process: string;
    perUnitCost: number;
    subtotalBeforeFee: number;
    quantityDiscount: number;
    discountedSubtotal: number;
  }>;
  manufacturingSubtotal: number;
  quantityDiscountSavings: number;
  setupCost: number;
  pricingBreakdown: { files: Array<unknown>; sharedSetupCost: number; manufacturingSubtotal: number; minimumOrderAdjustment: number; currency: 'EGP' };
  shippingEstimate?: number;
  taxEstimate?: number;
  totalCustomerPrice: number;
  leadTime: string;
  leadTimeDays: number;
  currency: string;
  validFor14Days: boolean;
  formattedManufacturingSubtotal: string;
  formattedTotalPrice: string;
  formattedCurrency: string;
}

export interface CadGeometryData {
  fileId: string;
  version: number;
  format: string;
  status: string;
  scanStatus: string;
  metadata: {
    geometryStatus?: 'READY' | 'UNAVAILABLE';
    viewerAsset?: { available?: boolean; format?: 'STL' | 'OBJ' | 'PLY' | 'DXF' | 'GLB' } | null;
    supportLevel?: 'FULLY_SUPPORTED' | 'VIEWER_SUPPORTED' | 'UPLOAD_ONLY' | 'FAILED_VALIDATION';
    variant?: string;
    geometryKind?: '2D' | '3D' | 'SOLID' | 'DOCUMENT';
    units?: string;
    detectedUnit?: string;
    unitsStatus?: string;
    dimensions?: { width: number; height: number; depth: number };
    boundingBox?: { min: number[]; max: number[] };
    volume?: number;
    surfaceArea?: number;
    triangleCount?: number;
    vertexCount?: number;
    faceCount?: number;
    entityCount?: number;
    objectCount?: number;
  } | null;
  dimensions?: string | null;
  volume?: string | null;
  meshTriangles?: string | null;
  jobs: { operation: string; status: string; lastError?: string | null }[];
}

export class ApiError extends Error {
  constructor(
    public readonly status: number,
    message: string,
    public readonly code?: string,
  ) {
    super(message);
    this.name = 'ApiError';
  }
}

/* Stable guest identity for CAD ownership, independent of cookie-commit timing.
   Browsers only persist a Set-Cookie response after it arrives; parallel uploads
   fired in one tick all race that round-trip and would otherwise scatter files
   across fresh guest ids. Sending one explicit id per session (persisted in
   localStorage) keeps every cad-files request under the SAME owner. */
const GUEST_SESSION_STORAGE_KEY = 'cam_labs_guest_session_id';
const guestSessionId = ((): string => {
  try {
    const stored = window.localStorage.getItem(GUEST_SESSION_STORAGE_KEY);
    if (stored) return stored;
  } catch {
    // Storage unavailable (private mode etc.) — fall back to an in-memory id.
  }
  const next = crypto.randomUUID();
  try {
    window.localStorage.setItem(GUEST_SESSION_STORAGE_KEY, next);
  } catch {
    // Ignore persistence failures; the in-memory id still stabilizes the session.
  }
  return next;
})();
const GUEST_SESSION_HEADERS: Record<string, string> = { 'X-Cad-Guest-Id': guestSessionId };

export class ApiService {
  private static async request<T>(endpoint: string, options: RequestInit = {}, required = false): Promise<T | null> {
    try {
      const response = await fetch(`${API_BASE}${endpoint}`, {
        headers: {
          ...GUEST_SESSION_HEADERS,
          ...(options.body instanceof FormData ? options.headers : { 'Content-Type': 'application/json', ...options.headers }),
        },
        credentials: 'same-origin',
        ...options,
      });

      if (!response.ok) {
        // Error contract: { code, message, status }. Proxies and gateways
        // may return non-JSON bodies (or empty statusText over HTTP/2), so
        // never surface a blank "API error:" — fall back to safe,
        // status-derived messages that the UI can localize by code.
        let message: string | undefined;
        let code: string | undefined;
        try {
          const errorBody = await response.json();
          message = typeof errorBody?.error?.message === 'string' && errorBody.error.message.trim()
            ? errorBody.error.message
            : undefined;
          code = typeof errorBody?.error?.code === 'string' ? errorBody.error.code : undefined;
        } catch {
          // Non-JSON body (proxy HTML page, empty body, connection reset
          // mid-read). Fall through to status-derived handling below.
        }
        if (!message) {
          if (response.status === 401) { code = code || 'UNAUTHENTICATED'; message = 'Authentication is required.'; }
          else if (response.status === 403) { code = code || 'FORBIDDEN'; message = 'You do not have permission to perform this action.'; }
          else if (response.status === 404) { code = code || 'NOT_FOUND'; message = 'The requested resource was not found.'; }
          else if (response.status === 429) { code = code || 'RATE_LIMITED'; message = 'Too many requests. Please try again later.'; }
          else if (response.status >= 500) { code = code || 'SERVER_ERROR'; message = 'The server is temporarily unavailable. Please try again later.'; }
          else { code = code || 'REQUEST_FAILED'; message = `Request failed (HTTP ${response.status}).`; }
        }
        throw new ApiError(response.status, message, code);
      }

      const json = await response.json();
      return json.data as T;
    } catch (e) {
      // Transport failure (DNS, refused connection, CORS block, offline):
      // fetch throws a bare TypeError. Normalize it so the UI never shows
      // "Failed to fetch" or "[object Object]" to users.
      if (e instanceof TypeError) {
        throw new ApiError(0, 'Unable to reach the CAM LABS servers. Please check your connection and try again.', 'NETWORK_ERROR');
      }
      if (required) throw e;
      console.warn(`API call to ${endpoint} failed, falling back to local store:`, e);
      return null;
    }
  }

  private static requestRequired<T>(endpoint: string, options: RequestInit = {}): Promise<T | null> {
    return this.request<T>(endpoint, options, true);
  }

  // Health
  static async getHealth() {
    return this.request<{ status: string; version: string; networkUptime: string }>('/health');
  }

  // Materials
  static async getMaterials(params?: { technology?: string; category?: string; search?: string }) {
    const query = new URLSearchParams(params as Record<string, string>).toString();
    return this.request<Material[]>(`/materials${query ? `?${query}` : ''}`);
  }

  // CAM LABS authoritative quotation engine
  static async calculateQuotation(params: {
    cadFileId?: string;
    materialId: string;
    technology: string;
    surfaceFinish: string;
    toleranceGrade: string;
    quantity: number;
    volumeCm3?: number;
    fileName?: string;
    manufacturingParameters?: { layerHeightMm?: number; infillPercent?: number; wallCount?: number; supportEnabled?: boolean };
    signal?: AbortSignal;
  }): Promise<CalculatedQuotationData | null> {
    return this.requestRequired<CalculatedQuotationData>('/quotes/calculate', {
      method: 'POST',
      signal: params.signal,
      body: JSON.stringify(params),
    });
  }

  /**
   * NEW (Phase 04): Calculate multi-file quotation
   * 
   * Submits multiple files with individual configurations (material, quantity, finish, tolerance)
   * to calculate a combined order quotation with per-file cost breakdown.
   */
  static async calculateMultiFileQuotation(params: {
    files: Array<{
      fileId: string;
      fileName: string;
      format: string;
      materialId: string;
      technology: string;
      surfaceFinish: string;
      toleranceGrade: 'standard' | 'precision';
      quantity: number;
      volumeCm3?: number;
      surfaceAreaCm2?: number;
      triangleCount?: number;
      dimensions?: {
        widthMm: number;
        heightMm: number;
        depthMm: number;
      };
      manufacturingParameters?: { layerHeightMm?: number; infillPercent?: number; wallCount?: number; supportEnabled?: boolean };
    }>;
    customerNotes?: string;
    preferredDelivery?: string;
    signal?: AbortSignal;
  }): Promise<MultiFileQuotation | null> {
    return this.requestRequired<MultiFileQuotation>('/quotes/calculate', {
      method: 'POST',
      signal: params.signal,
      body: JSON.stringify({ files: params.files, customerNotes: params.customerNotes, preferredDelivery: params.preferredDelivery }),
    });
  }

  static async getQuotes() {
    return this.request<Quote[]>('/quotes');
  }

  static async createQuote(quoteData: Partial<Quote> & { pricing?: CalculatedQuotationData; files?: Array<Record<string, unknown>>; cadFileIds?: string[]; toleranceGrade?: string; surfaceFinish?: string }) {
    return this.requestRequired<Quote>('/quotes', {
      method: 'POST',
      body: JSON.stringify(quoteData),
    });
  }

  // ─── Submit Quote (quote-first lifecycle; creates Quote ONLY) ──────────
  static async getShippingRates() {
    return this.request<{ rates: Array<{ id: string; label: string; description: string; eta: string; feeEgp: number }>; currency: string }>('/quotes/shipping-rates');
  }

  static async validateCoupon(params: { code: string; subtotalAmount: number; shippingAmount: number }) {
    return this.requestRequired<{
      code: string; discountType: string; discountValue: number;
      eligibleAmount: number; discountAmount: number; amountAfterDiscount: number; currency: string;
    }>('/quotes/validate-coupon', { method: 'POST', body: JSON.stringify(params) });
  }

  static async submitQuote(payload: Record<string, unknown>) {
    return this.requestRequired<{ quote: Quote & Record<string, any>; pricing: { subtotal: number; shippingFee: number; discountAmount: number; estimatedTotal: number; currency: string } }>('/quotes/submit', {
      method: 'POST',
      body: JSON.stringify(payload),
    });
  }

  static async getQuoteById(quoteId: string) {
    return this.request<Quote & Record<string, any>>(`/quotes/${encodeURIComponent(quoteId)}`);
  }

  // ─── Admin coupons (SUPER_ADMIN for mutations) ─────────────────────────
  static async adminListCoupons(includeArchived = false) {
    return this.requestRequired<{ coupons: Array<Record<string, any>>; total: number }>(`/admin/coupons${includeArchived ? '?includeArchived=true' : ''}`);
  }

  static async adminGetCoupon(couponId: string) {
    return this.requestRequired<Record<string, any>>(`/admin/coupons/${encodeURIComponent(couponId)}`);
  }

  static async adminCreateCoupon(payload: Record<string, unknown>) {
    return this.requestRequired<Record<string, any>>('/admin/coupons', { method: 'POST', body: JSON.stringify(payload) });
  }

  static async adminUpdateCoupon(couponId: string, payload: Record<string, unknown>) {
    return this.requestRequired<Record<string, any>>(`/admin/coupons/${encodeURIComponent(couponId)}`, { method: 'PUT', body: JSON.stringify(payload) });
  }

  static async adminEnableCoupon(couponId: string) {
    return this.requestRequired<Record<string, any>>(`/admin/coupons/${encodeURIComponent(couponId)}/enable`, { method: 'POST' });
  }

  static async adminDisableCoupon(couponId: string) {
    return this.requestRequired<Record<string, any>>(`/admin/coupons/${encodeURIComponent(couponId)}/disable`, { method: 'POST' });
  }

  static async adminArchiveCoupon(couponId: string) {
    return this.requestRequired<Record<string, any>>(`/admin/coupons/${encodeURIComponent(couponId)}/archive`, { method: 'POST' });
  }

  // ─── Admin shipping methods (SUPER_ADMIN for mutations) ──────────────
  static async adminListShippingMethods(includeArchived = false) {
    return this.requestRequired<{ methods: Array<Record<string, any>>; total: number }>(`/admin/shipping/methods${includeArchived ? '?includeArchived=true' : ''}`);
  }

  static async adminCreateShippingMethod(payload: Record<string, unknown>) {
    return this.requestRequired<Record<string, any>>('/admin/shipping/methods', { method: 'POST', body: JSON.stringify(payload) });
  }

  static async adminUpdateShippingMethod(methodId: string, payload: Record<string, unknown>) {
    return this.requestRequired<Record<string, any>>(`/admin/shipping/methods/${encodeURIComponent(methodId)}`, { method: 'PUT', body: JSON.stringify(payload) });
  }

  static async adminEnableShippingMethod(methodId: string) {
    return this.requestRequired<Record<string, any>>(`/admin/shipping/methods/${encodeURIComponent(methodId)}/enable`, { method: 'POST' });
  }

  static async adminDisableShippingMethod(methodId: string) {
    return this.requestRequired<Record<string, any>>(`/admin/shipping/methods/${encodeURIComponent(methodId)}/disable`, { method: 'POST' });
  }

  static async adminArchiveShippingMethod(methodId: string) {
    return this.requestRequired<Record<string, any>>(`/admin/shipping/methods/${encodeURIComponent(methodId)}/archive`, { method: 'POST' });
  }

  // ─── Admin quote workspace ────────────────────────────────────────────
  // Sole quote→order conversion path. Customer-side conversion was removed;
  // the backend rejects it with 403 for non-staff.
  static async adminConvertQuote(quoteId: string) {
    return this.requestRequired<Order>(`/admin/orders/from-quote/${encodeURIComponent(quoteId)}`, {
      method: 'POST',
    });
  }

  static async adminUpdateQuoteStatus(quoteId: string, status: string, reason?: string) {
    return this.request(`/admin/quotes/${encodeURIComponent(quoteId)}/status`, {
      method: 'PUT',
      body: JSON.stringify({ status, reason }),
    });
  }

  static async adminUpdateQuotePrice(quoteId: string, price: number, reason: string) {
    return this.request(`/admin/quotes/${encodeURIComponent(quoteId)}/price`, {
      method: 'PUT',
      body: JSON.stringify({ price, reason }),
    });
  }

  static async adminUpdateQuoteNotes(quoteId: string, technicalNotes: string) {
    return this.request(`/admin/quotes/${encodeURIComponent(quoteId)}/notes`, {
      method: 'PUT',
      body: JSON.stringify({ technicalNotes }),
    });
  }

  static async adminSendQuoteMessage(quoteId: string, message: string, subject?: string) {
    return this.requestRequired<{ id: string; message: string; subject: string | null; createdAt: string }>(`/admin/quotes/${encodeURIComponent(quoteId)}/message`, {
      method: 'POST',
      body: JSON.stringify({ message, subject }),
    });
  }

  static async adminGetQuoteMessages(quoteId: string) {
    return this.requestRequired<Array<{ id: string; message: string; subject: string | null; senderId: string | null; createdAt: string }>>(`/admin/quotes/${encodeURIComponent(quoteId)}/messages`);
  }

  // Orders
  static async getOrders() {
    return this.request<Order[]>('/orders');
  }

  static async getOrderById(orderId: string) {
    return this.request<Order>(`/orders/${encodeURIComponent(orderId)}`);
  }

  // ─── Super Admin order management ─────────────────────────────────────────
  static async adminApproveOrder(orderId: string, notes?: string) {
    return this.request<Order>(`/admin/orders/${encodeURIComponent(orderId)}/approve`, {
      method: 'POST',
      body: JSON.stringify({ notes }),
    });
  }

  static async adminUpdateOrderPrice(orderId: string, price: number, reason?: string) {
    return this.request<Order>(`/admin/orders/${encodeURIComponent(orderId)}/price`, {
      method: 'PUT',
      body: JSON.stringify({ price, reason }),
    });
  }

  static async adminUpdateOrderStatus(orderId: string, status: string, extra?: { manufacturingStatus?: string; shippingStatus?: string; notes?: string }) {
    return this.request<Order>(`/admin/orders/${encodeURIComponent(orderId)}/status`, {
      method: 'PUT',
      body: JSON.stringify({ status, ...extra }),
    });
  }

  static async adminSendCustomerMessage(orderId: string, message: string, subject?: string) {
    return this.requestRequired<{ id: string; eventType: string; description: string; createdAt: string }>(`/admin/orders/${encodeURIComponent(orderId)}/message`, {
      method: 'POST',
      body: JSON.stringify({ message, subject }),
    });
  }

  static getCadDownloadUrl(fileId: string): string {
    return `${API_BASE}/cad-files/${encodeURIComponent(fileId)}/download`;
  }

  // CAD Files & Pre-flight Validation
  static async validateCadFile(fileName: string, sizeBytes: number) {
    return this.request<{
      isValidFormat: boolean;
      isSizeWithinLimit?: boolean;
      fileExtension: string;
      preliminaryStatus: string;
      note: string;
    }>('/cad-files/validate', {
      method: 'POST',
      body: JSON.stringify({ fileName, sizeBytes }),
    });
  }

  static async getCadFiles() {
    return this.request<CadFile[]>('/cad-files');
  }

  static async getCadFile(fileId: string) {
    return this.request<CadFile>(`/cad-files/${encodeURIComponent(fileId)}`);
  }

  static async uploadCadFile(file: File, onProgress?: (percentage: number) => void) {
    const formData = new FormData();
    formData.append('file', file);
    if (!onProgress) {
      return this.requestRequired<CadUploadResult>('/cad-files', {
        method: 'POST',
        body: formData,
      });
    }
    return new Promise<CadUploadResult | null>((resolve, reject) => {
      const xhr = new XMLHttpRequest();
      xhr.open('POST', `${API_BASE}/cad-files`);
      xhr.withCredentials = true;
      xhr.setRequestHeader('X-Cad-Guest-Id', guestSessionId);
      xhr.upload.addEventListener('progress', (event) => {
        if (event.lengthComputable) onProgress(Math.min(100, Math.round((event.loaded / event.total) * 100)));
      });
      xhr.addEventListener('error', () => reject(new ApiError(0, 'The CAD upload service is currently unavailable.', 'NETWORK_ERROR')));
      xhr.addEventListener('load', () => {
        try {
          const json = JSON.parse(xhr.responseText) as { data?: CadUploadResult; error?: { message?: string } };
          if (xhr.status < 200 || xhr.status >= 300) throw new ApiError(xhr.status, json.error?.message || `Upload failed (HTTP ${xhr.status}).`, 'UPLOAD_FAILED');
          onProgress(100);
          resolve(json.data || null);
        } catch (error) {
          reject(error);
        }
      });
      xhr.send(formData);
    });
  }

  static async getCadGeometry(fileId: string, versionId?: string) {
    const query = versionId ? `?versionId=${encodeURIComponent(versionId)}` : '';
    return this.requestRequired<CadGeometryData>(`/cad-files/${fileId}/geometry${query}`);
  }

  static async getCadViewerAsset(fileId: string, versionId?: string): Promise<Blob> {
    const query = versionId ? `?versionId=${encodeURIComponent(versionId)}` : '';
    const response = await fetch(`${API_BASE}/cad-files/${fileId}/viewer-asset${query}`, { credentials: 'same-origin', headers: GUEST_SESSION_HEADERS });
    if (!response.ok) throw new ApiError(response.status, 'Viewer asset is unavailable.');
    return response.blob();
  }

  static async retryCadProcessing(fileId: string) {
    return this.requestRequired<{ jobId: string; status: string }>(`/cad-files/${fileId}/retry-processing`, { method: 'POST' });
  }

  static async deleteCadFile(fileId: string) {
    return this.requestRequired<{ id: string; deletedVersionCount: number }>(`/cad-files/${fileId}`, { method: 'DELETE' });
  }

  // Technical documents (drawings, datasheets, notes)
  static async getTechnicalDocuments() {
    return this.request<TechnicalDocument[]>('/technical-documents');
  }

  static async uploadTechnicalDocument(file: File, onProgress?: (percentage: number) => void) {
    const formData = new FormData();
    formData.append('file', file);
    if (!onProgress) {
      return this.requestRequired<TechnicalDocument>('/technical-documents', {
        method: 'POST',
        body: formData,
      });
    }
    return new Promise<TechnicalDocument | null>((resolve, reject) => {
      const xhr = new XMLHttpRequest();
      xhr.open('POST', `${API_BASE}/technical-documents`);
      xhr.withCredentials = true;
      xhr.setRequestHeader('X-Cad-Guest-Id', guestSessionId);
      xhr.upload.addEventListener('progress', (event) => {
        if (event.lengthComputable) onProgress(Math.min(100, Math.round((event.loaded / event.total) * 100)));
      });
      xhr.addEventListener('error', () => reject(new ApiError(0, 'The technical document upload service is currently unavailable.', 'NETWORK_ERROR')));
      xhr.addEventListener('load', () => {
        try {
          const json = JSON.parse(xhr.responseText) as { data?: TechnicalDocument; error?: { message?: string } };
          if (xhr.status < 200 || xhr.status >= 300) throw new ApiError(xhr.status, json.error?.message || `Upload failed (HTTP ${xhr.status}).`, 'UPLOAD_FAILED');
          onProgress(100);
          resolve(json.data || null);
        } catch (error) {
          reject(error);
        }
      });
      xhr.send(formData);
    });
  }

  static async deleteTechnicalDocument(documentId: string) {
    return this.requestRequired<{ id: string }>(`/technical-documents/${encodeURIComponent(documentId)}`, { method: 'DELETE' });
  }

  static getTechnicalDocumentDownloadUrl(documentId: string): string {
    return `${API_BASE}/technical-documents/${encodeURIComponent(documentId)}/download`;
  }

  // Auth / Profile
  static async login(email: string, password: string, twoFactorCode?: string, rememberMe: boolean = true) {
    return this.requestRequired<{ user: User }>('/auth/login', {
      method: 'POST',
      body: JSON.stringify({ email, password, ...(twoFactorCode ? { twoFactorCode } : {}), rememberMe }),
    });
  }

  static async register(data: { name: string; email: string; password: string; company?: string; phone: string }) {
    return this.requestRequired<{ user: User }>('/auth/register', {
      method: 'POST',
      body: JSON.stringify(data),
    });
  }

  /** GIS "Continue with Google": the credential is a Google-signed ID token
   *  verified server-side. The client never treats the token as auth proof. */
  static async loginWithGoogle(credential: string, twoFactorCode?: string) {
    return this.requestRequired<{ user: User }>('/auth/google', {
      method: 'POST',
      body: JSON.stringify({ credential, ...(twoFactorCode ? { twoFactorCode } : {}) }),
    });
  }

  // ─── Self-service password reset (6-digit email OTP) ────────────────────
  /** Always resolves with the generic message (anti-enumeration). */
  static async forgotPassword(email: string) {
    return this.requestRequired<{ message: string }>('/auth/forgot-password', {
      method: 'POST',
      body: JSON.stringify({ email }),
    });
  }

  /** Verifies the OTP; resolves with a single-use opaque reset authorization. */
  static async verifyResetCode(email: string, code: string) {
    return this.requestRequired<{ resetToken: string; expiresInMinutes: number }>('/auth/verify-reset-code', {
      method: 'POST',
      body: JSON.stringify({ email, code }),
    });
  }

  /** Consumes the reset authorization and sets the new password. */
  static async resetPassword(resetToken: string, newPassword: string, confirmPassword: string) {
    return this.requestRequired<null>('/auth/reset-password', {
      method: 'POST',
      body: JSON.stringify({ resetToken, newPassword, confirmPassword }),
    });
  }

  static async logout() {
    return this.requestRequired<null>('/auth/logout', { method: 'POST' });
  }

  static async getCurrentUser() {
    return this.request<User>('/auth/me');
  }

  static async getAdminSettings() {
    return this.requestRequired<any>('/admin/settings');
  }

  static async updateAdminSetting(section: string, key: string, value: unknown, description?: string) {
    return this.requestRequired<any>('/admin/settings', {
      method: 'PUT',
      body: JSON.stringify({ section, key, value, description }),
    });
  }

  // ─── Admin notifications ───────────────────────────────────────────────────
  static async getAdminNotifications(params?: { limit?: number; offset?: number; unreadOnly?: boolean; type?: string }) {
    const query = new URLSearchParams();
    if (params?.limit != null) query.set('limit', String(params.limit));
    if (params?.offset != null) query.set('offset', String(params.offset));
    if (params?.unreadOnly) query.set('unreadOnly', 'true');
    if (params?.type) query.set('type', params.type);
    const qs = query.toString();
    return this.requestRequired<AdminNotificationList>(`/admin/notifications${qs ? `?${qs}` : ''}`);
  }

  static async getAdminUnreadCount() {
    return this.requestRequired<AdminUnreadCount>('/admin/notifications/unread-count');
  }

  static async markAdminNotificationRead(notificationId: string) {
    return this.requestRequired<AdminNotification>(`/admin/notifications/${encodeURIComponent(notificationId)}/read`, {
      method: 'PUT',
    });
  }

  static async markAllAdminNotificationsRead() {
    return this.requestRequired<{ markedRead: number }>('/admin/notifications/read-all', {
      method: 'PUT',
    });
  }

  static async getAdminUrl() {
    return this.requestRequired<{ adminUrl: string }>('/admin/settings/admin-url');
  }

  static async updateProfile(profileData: ProfileUpdate) {
    return this.request<User>('/auth/profile', {
      method: 'PUT',
      body: JSON.stringify(profileData),
    });
  }

  // ─── Account Settings: security, sessions, address book ──────────────
  static async changePassword(currentPassword: string, newPassword: string) {
    return this.requestRequired<null>('/auth/change-password', {
      method: 'POST',
      body: JSON.stringify({ currentPassword, newPassword }),
    });
  }

  static async requestEmailChange(newEmail: string, password?: string) {
    return this.requestRequired<{ obfuscatedEmail: string; expiresInMinutes: number }>('/auth/email/change-request', {
      method: 'POST',
      body: JSON.stringify({ newEmail, ...(password ? { password } : {}) }),
    });
  }

  static async verifyEmailChange(code: string) {
    return this.requestRequired<{ user: User }>('/auth/email/change-verify', {
      method: 'POST',
      body: JSON.stringify({ code }),
    });
  }

  static async deleteQuote(quoteId: string) {
    return this.requestRequired<{ id: string }>(`/quotes/${encodeURIComponent(quoteId)}`, { method: 'DELETE' });
  }

  // ─── Quote deletion requests (deletion-by-approval) ───────────────────
  // Customers file a request; the Quote stays visible until an admin acts.
  static async requestQuoteDeletion(quoteId: string, reason?: string) {
    return this.requestRequired<Record<string, any>>(`/quotes/${encodeURIComponent(quoteId)}/deletion-request`, {
      method: 'POST',
      body: JSON.stringify({ reason: reason || '' }),
    });
  }

  static async getQuoteDeletionState(quoteId: string) {
    return this.requestRequired<{ requests: Array<Record<string, any>> }>(`/quotes/${encodeURIComponent(quoteId)}/deletion-request`);
  }

  static async adminListDeletionRequests(status?: string) {
    const qs = status ? `?status=${encodeURIComponent(status)}` : '';
    return this.requestRequired<{ requests: Array<Record<string, any>>; total: number }>(`/admin/quote-deletion-requests${qs}`);
  }

  static async adminApproveDeletionRequest(requestId: string, adminNote?: string) {
    return this.requestRequired<Record<string, any>>(`/admin/quote-deletion-requests/${encodeURIComponent(requestId)}/approve`, {
      method: 'POST',
      body: JSON.stringify({ adminNote: adminNote || '' }),
    });
  }

  static async adminRejectDeletionRequest(requestId: string, adminNote?: string) {
    return this.requestRequired<Record<string, any>>(`/admin/quote-deletion-requests/${encodeURIComponent(requestId)}/reject`, {
      method: 'POST',
      body: JSON.stringify({ adminNote: adminNote || '' }),
    });
  }

  static async getTwoFactorStatus() {
    return this.requestRequired<{ enabled: boolean }>('/auth/2fa/status');
  }

  static async setupTwoFactor() {
    return this.requestRequired<{ secret: string; otpauthUrl: string }>('/auth/2fa/setup', { method: 'POST' });
  }

  static async enableTwoFactor(code: string) {
    return this.requestRequired<{ backupCodes: string[] }>('/auth/2fa/enable', {
      method: 'POST',
      body: JSON.stringify({ code }),
    });
  }

  static async disableTwoFactor(password: string) {
    return this.requestRequired<null>('/auth/2fa/disable', {
      method: 'POST',
      body: JSON.stringify({ password }),
    });
  }

  static async getSessions() {
    return this.requestRequired<{ sessions: AccountSession[] }>('/auth/sessions');
  }

  static async revokeSession(sessionId: string) {
    return this.requestRequired<null>(`/auth/sessions/${encodeURIComponent(sessionId)}`, { method: 'DELETE' });
  }

  static async revokeOtherSessions() {
    return this.requestRequired<{ revoked: number }>('/auth/sessions/revoke-others', { method: 'POST' });
  }

  static async getAddresses() {
    return this.requestRequired<{ addresses: AddressBookEntry[]; defaultAddressId: string | null }>('/auth/addresses');
  }

  static async saveAddresses(addresses: AddressBookEntry[], defaultAddressId: string | null) {
    return this.requestRequired<{ addresses: AddressBookEntry[]; defaultAddressId: string | null }>('/auth/addresses', {
      method: 'PUT',
      body: JSON.stringify({ addresses, defaultAddressId }),
    });
  }

  // ─── Equation Builder & Pricing Engine Administration ─────────────────────────
  static async getPricingEquations() {
    return this.requestRequired<any[]>('/admin/pricing/equations');
  }

  static async getPricingEquation(technology: string) {
    return this.requestRequired<any>(`/admin/pricing/equations/${technology}`);
  }

  static async saveDraftEquation(technology: string, payload: {
    formulaTree: any;
    customVariables: any[];
    constantsSnapshot?: Record<string, any>;
    name?: string;
    description?: string;
  }) {
    return this.requestRequired<any>(`/admin/pricing/equations/${technology}/draft`, {
      method: 'PUT',
      body: JSON.stringify(payload),
    });
  }

  static async testPricingEquation(technology: string, payload: {
    isDraft?: boolean;
    modelContext: Record<string, any>;
    customVariablesOverride?: any[];
    formulaTreeOverride?: any;
    constantsOverride?: Record<string, any>;
  }) {
    return this.requestRequired<any>(`/admin/pricing/equations/${technology}/test`, {
      method: 'POST',
      body: JSON.stringify(payload),
    });
  }

  static async comparePricingEquations(technology: string, payload: {
    modelContext: Record<string, any>;
    draftFormulaOverride?: any;
    draftCustomVariablesOverride?: any[];
  }) {
    return this.requestRequired<any>(`/admin/pricing/equations/${technology}/compare`, {
      method: 'POST',
      body: JSON.stringify(payload),
    });
  }

  static async publishPricingEquation(technology: string, payload: {
    notes?: string;
  }) {
    return this.requestRequired<any>(`/admin/pricing/equations/${technology}/publish`, {
      method: 'POST',
      body: JSON.stringify(payload),
    });
  }

  static async getPricingConstants() {
    return this.requestRequired<any[]>('/admin/pricing/constants');
  }

  static async updatePricingConstant(payload: {
    key: string;
    name: string;
    value: number;
    unit: string;
    description?: string;
    technology?: string;
  }) {
    return this.requestRequired<any>('/admin/pricing/constants', {
      method: 'POST',
      body: JSON.stringify(payload),
    });
  }
}

