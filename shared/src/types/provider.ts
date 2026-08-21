import { QuoteCalculationRequest, QuoteCalculationResponse } from './quote';
import { Order } from './order';

export interface ManufacturingQuoteRequest extends QuoteCalculationRequest {
  partnerId?: string;
}

export interface ManufacturingOrderDispatch {
  orderId: string;
  cadFileUrl?: string;
  technology: string;
  material: string;
  quantity: number;
  tolerance: string;
  surfaceFinish: string;
  shippingAddress: string;
}

export interface ManufacturingDispatchResult {
  engineName: 'CAM LABS';
  trackingId: string;
  dispatchedAt: string;
  status: 'Queued' | 'Dispatched' | 'In Production';
  estimatedCompletion: string;
}

/**
 * CAM LABS internal manufacturing engine contract.
 */
export interface IManufacturingEngine {
  readonly name: string;
  calculateQuote(request: ManufacturingQuoteRequest): Promise<QuoteCalculationResponse>;
  dispatchOrder(dispatchData: ManufacturingOrderDispatch): Promise<ManufacturingDispatchResult>;
  getOrderStatus(trackingId: string): Promise<{ status: string; telemetry: Record<string, unknown> }>;
}
