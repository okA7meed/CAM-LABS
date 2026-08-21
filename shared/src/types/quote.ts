export interface Quote {
  id: string;
  userId?: string;
  partName: string;
  technology: string;
  material: string;
  quantity: number;
  leadTime: string;
  unitPrice: string;
  totalPrice: string;
  validUntil: string;
  status: 'Draft' | 'Ready for Approval' | 'Approved' | 'Expired';
  createdAt?: string;
}

export interface QuoteCalculationRequest {
  materialId: string;
  technology: string;
  surfaceFinish: string;
  toleranceGrade: 'standard' | 'precision';
  quantity: number;
  volumeCm3?: number;
  fileName?: string;
}

export interface QuoteCalculationResponse {
  unitPrice: number;
  totalPrice: number;
  formattedUnitPrice: string;
  formattedTotalPrice: string;
  leadTime: string;
  discountAppliedPercentage: number;
}
