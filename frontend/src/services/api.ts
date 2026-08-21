import { Material, Order, Quote, CadFile, CadUploadResult, User } from '../types';

const API_BASE = '/api/v1';

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
  constructor(public readonly status: number, message: string) {
    super(message);
    this.name = 'ApiError';
  }
}

export class ApiService {
  private static async request<T>(endpoint: string, options: RequestInit = {}, required = false): Promise<T | null> {
    try {
      const response = await fetch(`${API_BASE}${endpoint}`, {
        headers: options.body instanceof FormData ? options.headers : { 'Content-Type': 'application/json', ...options.headers },
        credentials: 'same-origin',
        ...options,
      });

      if (!response.ok) {
        let message = `API error: ${response.statusText}`;
        try {
          const errorBody = await response.json();
          message = errorBody.error?.message || message;
        } catch {
          // Preserve the HTTP status message when the server has no JSON body.
        }
        throw new ApiError(response.status, message);
      }

      const json = await response.json();
      return json.data as T;
    } catch (e) {
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

  static async approveQuote(quoteId: string) {
    return this.request<Order>(`/orders/convert-quote/${quoteId}`, {
      method: 'POST',
    });
  }

  // Orders
  static async getOrders() {
    return this.request<Order[]>('/orders');
  }

  static async createOrder(orderData: Partial<Order>) {
    return this.request<Order>('/orders', {
      method: 'POST',
      body: JSON.stringify(orderData),
    });
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
      xhr.upload.addEventListener('progress', (event) => {
        if (event.lengthComputable) onProgress(Math.min(100, Math.round((event.loaded / event.total) * 100)));
      });
      xhr.addEventListener('error', () => reject(new ApiError(0, 'The CAD upload service is currently unavailable.')));
      xhr.addEventListener('load', () => {
        try {
          const json = JSON.parse(xhr.responseText) as { data?: CadUploadResult; error?: { message?: string } };
          if (xhr.status < 200 || xhr.status >= 300) throw new ApiError(xhr.status, json.error?.message || `API error: ${xhr.statusText}`);
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
    const response = await fetch(`${API_BASE}/cad-files/${fileId}/viewer-asset${query}`, { credentials: 'same-origin' });
    if (!response.ok) throw new ApiError(response.status, 'Viewer asset is unavailable.');
    return response.blob();
  }

  static async retryCadProcessing(fileId: string) {
    return this.requestRequired<{ jobId: string; status: string }>(`/cad-files/${fileId}/retry-processing`, { method: 'POST' });
  }

  static async deleteCadFile(fileId: string) {
    return this.requestRequired<{ id: string; deletedVersionCount: number }>(`/cad-files/${fileId}`, { method: 'DELETE' });
  }

  // Auth / Profile
  static async login(email: string, password: string) {
    return this.requestRequired<{ user: User }>('/auth/login', {
      method: 'POST',
      body: JSON.stringify({ email, password }),
    });
  }

  static async register(data: { name: string; email: string; password: string; company?: string; phone: string }) {
    return this.requestRequired<{ user: User }>('/auth/register', {
      method: 'POST',
      body: JSON.stringify(data),
    });
  }

  static async logout() {
    return this.requestRequired<null>('/auth/logout', { method: 'POST' });
  }

  static async getCurrentUser() {
    return this.request<User>('/auth/me');
  }

  static async updateProfile(profileData: Partial<User>) {
    return this.request<User>('/auth/profile', {
      method: 'PUT',
      body: JSON.stringify(profileData),
    });
  }
}
