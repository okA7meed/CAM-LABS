import { ManufacturingQuoteResponse } from '../providers/manufacturing/IManufacturingProvider';
import { MultiFileQuotationResponse, FileQuoteRequest, FileQuoteCost } from '../providers/manufacturing/IMultiFileProvider';
import { Logger } from '../utils/logger';
import { MANUFACTURING_PRICING_CONFIGURATION } from './pricing-config.service';

export interface NormalizedCustomerQuote {
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
  pricingBreakdown?: ManufacturingQuoteResponse['pricingBreakdown'];
}
const formatEgp = (amount: number): string => `${amount.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })} EGP`;

export class PricingService {
  static processManufacturingQuote(rawQuote: ManufacturingQuoteResponse, quantity: number): NormalizedCustomerQuote {
    if (rawQuote.engineName !== 'CAM LABS') throw new Error('Only the CAM LABS manufacturing engine is supported.');
    if (!Number.isFinite(rawQuote.manufacturingBaseCost) || !Number.isFinite(rawQuote.manufacturingTotalCost) || rawQuote.manufacturingTotalCost < 0) {
      throw new Error('CAM LABS manufacturing engine returned invalid pricing.');
    }

    const totalCustomerPrice = parseFloat(rawQuote.manufacturingTotalCost.toFixed(2));
    const customerUnitPrice = parseFloat((totalCustomerPrice / Math.max(1, quantity)).toFixed(2));
    const manufacturingCostUnit = parseFloat(rawQuote.manufacturingBaseCost.toFixed(2));
    Logger.debug(`[PricingService] CAM LABS manufacturing price: ${totalCustomerPrice} EGP`);

    return {
      quoteRef: rawQuote.quoteRef || `CAM-RFQ-${Date.now()}`,
      manufacturingCostUnit,
      manufacturingCostTotal: totalCustomerPrice,
      totalCustomerPrice,
      customerUnitPrice,
      formattedManufacturingCost: formatEgp(totalCustomerPrice),
      formattedTotalPrice: formatEgp(totalCustomerPrice),
      formattedUnitPrice: formatEgp(customerUnitPrice),
      currency: 'EGP',
      leadTime: rawQuote.leadTimeFormatted,
      discountAppliedPercentage: rawQuote.discountAppliedPercentage,
      dfmSummary: rawQuote.dfmSummary,
      pricingBreakdown: rawQuote.pricingBreakdown,
    };
  }

  static calculateMultiFileQuotation(files: FileQuoteRequest[], manufacturingQuotes?: ManufacturingQuoteResponse[]): MultiFileQuotationResponse {
    if (!files.length) throw new Error('At least one file is required for quotation');
    const fileCosts: FileQuoteCost[] = files.map((file, index) => {
      const manufacturingQuote = manufacturingQuotes?.[index];
      if (!manufacturingQuote) throw new Error(`Manufacturing calculation is unavailable for ${file.fileName}.`);
      const breakdown = manufacturingQuote.pricingBreakdown;
      if (!breakdown) throw new Error(`Pricing breakdown is unavailable for ${file.fileName}.`);
      const baseUnitCost = breakdown.unitManufacturingCost;
      const subtotalBeforeDiscount = breakdown.unitManufacturingCost * file.quantity;
      const discountMultiplier = 1;
      const discountedSubtotal = parseFloat((subtotalBeforeDiscount * discountMultiplier).toFixed(2));
      const quantityDiscount = parseFloat((subtotalBeforeDiscount - discountedSubtotal).toFixed(2));
      return {
        fileId: file.fileId,
        fileName: file.fileName,
        quantity: file.quantity,
        material: file.materialId,
        process: file.technology,
        perUnitCost: parseFloat((baseUnitCost * discountMultiplier).toFixed(2)),
        subtotalBeforeFee: parseFloat(subtotalBeforeDiscount.toFixed(2)),
        quantityDiscount: parseFloat(quantityDiscount.toFixed(2)),
        discountedSubtotal: parseFloat(discountedSubtotal.toFixed(2)),
        productionSubtotal: parseFloat(subtotalBeforeDiscount.toFixed(2)),
        pricingBreakdown: breakdown,
      };
    });
    const setupGroupCount = new Set(files.map((file) => `${file.technology.toUpperCase()}:${file.materialId.toLowerCase()}`)).size;
    const setupPerGroup = fileCosts[0]?.pricingBreakdown?.setupCost || 0;
    const sharedSetupCost = parseFloat((setupPerGroup * setupGroupCount).toFixed(2));
    const calculatedManufacturingCost = parseFloat((fileCosts.reduce((sum, file) => sum + file.discountedSubtotal, 0) + sharedSetupCost).toFixed(2));
    const minimumOrderAdjustment = parseFloat(Math.max(0, MANUFACTURING_PRICING_CONFIGURATION.minimumOrderPriceEgp - calculatedManufacturingCost).toFixed(2));
    const manufacturingSubtotal = calculatedManufacturingCost + minimumOrderAdjustment;
    const quantityDiscountSavings = parseFloat(fileCosts.reduce((sum, file) => sum + file.quantityDiscount, 0).toFixed(2));
    const now = new Date();
    const expiresAt = new Date(now.getTime() + 14 * 24 * 60 * 60 * 1000);
    const leadTimeDays = files.some((file) => file.technology.toUpperCase().includes('CNC')) ? 4 : 2;

    return {
      quoteId: `CAM-QT-${Date.now()}`,
      timestamp: now.toISOString(),
      expiresAt: expiresAt.toISOString(),
      files: fileCosts,
      manufacturingSubtotal,
      quantityDiscountSavings,
      setupCost: sharedSetupCost,
      pricingBreakdown: { files: fileCosts, sharedSetupCost, manufacturingSubtotal, minimumOrderAdjustment, currency: 'EGP' },
      totalCustomerPrice: manufacturingSubtotal,
      leadTime: leadTimeDays === 4 ? '3 - 5 Days' : '24 - 48 Hours',
      leadTimeDays,
      currency: 'EGP',
      validFor14Days: true,
      formattedManufacturingSubtotal: formatEgp(manufacturingSubtotal),
      formattedTotalPrice: formatEgp(manufacturingSubtotal),
      formattedCurrency: 'EGP',
    };
  }
}
