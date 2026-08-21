import { PricingBreakdown } from './IManufacturingProvider';

/**
 * Multi-File Quotation Types
 * 
 * Extends the base provider interface to support quotations
 * with multiple files, each with potentially different configurations.
 */


/**
 * Per-file quotation request with CAD geometry details
 */
export interface FileQuoteRequest {
  fileId: string;
  fileName: string;
  format: string;
  materialId: string;
  technology: string;
  surfaceFinish: string;
  toleranceGrade: 'standard' | 'precision';
  quantity: number;
  // CAD metadata from file processing
  volumeCm3?: number;
  surfaceAreaCm2?: number;
  triangleCount?: number;
  dimensions?: {
    widthMm: number;
    heightMm: number;
    depthMm: number;
  };
  manufacturingParameters?: {
    layerHeightMm?: number;
    infillPercent?: number;
    wallCount?: number;
    supportEnabled?: boolean;
  };
}

/**
 * Per-file quotation cost breakdown
 */
export interface FileQuoteCost {
  fileId: string;
  fileName: string;
  quantity: number;
  material: string;
  process: string;
  // Cost breakdown
  perUnitCost: number;
  subtotalBeforeFee: number;  // quantity * perUnitCost
  quantityDiscount: number;
  discountedSubtotal: number;
  productionSubtotal: number;
  pricingBreakdown?: PricingBreakdown;
  // This is the per-file subtotal that customer pays
}

/**
 * Complete multi-file quotation response from CAM LABS
 * (normalized after applying CAM LABS business rules)
 */
export interface MultiFileQuotationResponse {
  quoteId: string;
  timestamp: string;
  expiresAt: string;
  
  // Per-file costs
  files: FileQuoteCost[];
  
  // Cost summary
  manufacturingSubtotal: number;      // Sum of all file discountedSubtotals
  quantityDiscountSavings: number;    // Total savings from volume discounts
  setupCost: number;
  pricingBreakdown: {
    files: FileQuoteCost[];
    sharedSetupCost: number;
    manufacturingSubtotal: number;
    minimumOrderAdjustment: number;
    currency: 'EGP';
  };
  
  // Optional: shipping, taxes, etc.
  shippingEstimate?: number;
  taxEstimate?: number;
  
  // Grand total for customer
  totalCustomerPrice: number;
  
  // CAM LABS manufacturing metadata
  leadTime: string;
  leadTimeDays: number;
  currency: 'EGP';
  
  // Validity
  validFor14Days: boolean;
  
  // Formatted strings for UI
  formattedManufacturingSubtotal: string;
  formattedTotalPrice: string;
  formattedCurrency: string;
}

/**
 * Request body for multi-file quotation calculation
 * Sent from frontend to backend POST /api/v1/quotes/calculate
 */
export interface MultiFileQuotationRequest {
  files: FileQuoteRequest[];
  cadOwner?: { userId?: string; guestId?: string };
  // Optional metadata
  customerNotes?: string;
  preferredDelivery?: string;
}
