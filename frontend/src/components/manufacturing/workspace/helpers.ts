import { MultiFileQuotation } from '../../../services/api';
import { areAllUploadsReady } from '../uploadState';
import { INFILL_OPTIONS, PRIORITY_SHIPPING_FEE_EGP } from './constants';
import { PanelStatus, QuoteData, RequestState, UploadItem } from './types';

export const panelStatusClass = (done: boolean, upstreamReady: boolean): PanelStatus => (!upstreamReady ? 'inactive' : done ? 'completed' : 'active');

/** Parses a formatted EGP string like "2,484.18 EGP" into its numeric value. */
export const parseFormattedPrice = (formatted?: string | null): number => {
  if (!formatted) return 0;
  const match = String(formatted).match(/-?\d[\d,]*\.?\d*/);
  if (!match) return 0;
  const value = parseFloat(match[0].replace(/,/g, ''));
  return Number.isFinite(value) ? value : 0;
};

/** Formats a numeric EGP amount exactly like the CAM LABS pricing engine backend. */
export const formatEgp = (amount: number): string => `${amount.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })} EGP`;

/**
 * Derives the customer-facing estimated total from the backend quote base price.
 * The backend quote is never mutated — priority shipping is a derived surcharge
 * on top of it, exactly `PRIORITY_SHIPPING_FEE_EGP` when enabled and 0 when not.
 */
export const priceWithPriority = (baseFormatted: string | null | undefined, priorityShipping: boolean): string => {
  const base = parseFormattedPrice(baseFormatted);
  return formatEgp(base + (priorityShipping ? PRIORITY_SHIPPING_FEE_EGP : 0));
};

export const formatBytes = (bytes?: number): string => {
  if (!bytes || bytes < 1) return '';
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(0)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(2)} MB`;
};

export const hasOwn = <T extends object>(o: T, k: PropertyKey): k is keyof T => Object.prototype.hasOwnProperty.call(o, k);

export const isMultiFileQuote = (d: QuoteData | null): d is MultiFileQuotation => Boolean(d && 'files' in d);

export const isIntegerInfill = (v: unknown): v is number => typeof v === 'number' && Number.isInteger(v) && v >= 0 && v <= 100;

export const normalizeInfillInput = (raw: string): number | null => {
  const n = Number(raw.trim());
  if (!Number.isFinite(n)) return null;
  const rounded = Math.round(n);
  return Math.max(0, Math.min(100, rounded));
};

export const fdmParametersFor = (quality: string, wallCount: number, supportEnabled = false, customInfillPercent?: number | null) => {
  const p = INFILL_OPTIONS.find((o) => o.id === quality) ?? INFILL_OPTIONS.find((o) => o.id === 'standard')!;
  const infillPercent = isIntegerInfill(customInfillPercent) ? customInfillPercent : p.infillPercent;
  return { layerHeightMm: p.layerHeightMm, infillPercent, wallCount, supportEnabled };
};

export const canSubmitFinal = (quote: QuoteData | null, isCalculating: boolean, quoteFailed: boolean, request: RequestState, uploadItems: UploadItem[]) => {
  return Boolean(quote && !isCalculating && !quoteFailed && request.cadFile && request.process && request.material && areAllUploadsReady(uploadItems));
};