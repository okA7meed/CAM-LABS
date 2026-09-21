import { CadFile, Quote } from '../../types';
import { QuoteFileVM, quoteFilesOf } from '../admin/quote-detail/types';
import { parseQuoteFileIds } from './dashUtils';

/**
 * Customer Quote Review Workspace — pure data mappers (tested).
 *
 * Every mapper derives ONLY from real record fields. Unavailable data is
 * represented as null (rendered as an honest empty/unavailable state), never
 * synthesized. No backend change: GET /quotes/:id already returns the full
 * row (pricingBreakdown, snapshots, audit fields); GET /cad-files resolves
 * the catalog.
 */

export interface WorkspaceFile {
  /** Catalog id in stable cadFileIds order. */
  fileId: string;
  /** Full catalog record when resolvable (null = deleted/unavailable file). */
  cad: CadFile | null;
  /** Priced-file view model matched by fileId (null = unpriced/legacy). */
  vm: QuoteFileVM | null;
  /** Display name: catalog name first, priced-file name fallback. */
  name: string;
}

/** Files in authoritative cadFileIds order with catalog + pricing joined. */
export function resolveWorkspaceFiles(quote: Quote, cadById: Map<string, CadFile>): WorkspaceFile[] {
  const ids = parseQuoteFileIds(quote.cadFileIds);
  const vms = quoteFilesOf(quote as unknown as Record<string, unknown>);
  const vmById = new Map<string, QuoteFileVM>();
  for (const vm of vms) {
    if (!vmById.has(vm.fileId)) vmById.set(vm.fileId, vm);
  }
  return ids.map((fileId) => {
    const cad = cadById.get(fileId) || null;
    const vm = vmById.get(fileId) || null;
    return { fileId, cad, vm, name: cad?.name || vm?.fileName || fileId };
  });
}

export interface FileSpec {
  key: string;
  labelKey: string;
  icon: string;
  /** Rendered value, or null when genuinely unavailable. */
  value: string | null;
  /** Keep technical values (dims, prices) LTR in RTL layouts. */
  ltr?: boolean;
}

const textOf = (value: unknown): string | null => {
  if (typeof value === 'string' && value.trim()) return value.trim();
  if (typeof value === 'number' && Number.isFinite(value)) return String(value);
  return null;
};

/** Defensive deep lookup for optional engine params (layer/infill/color). */
export function findSpecParam(breakdown: unknown, keys: string[]): string | null {
  const seen = new Set<unknown>();
  const visit = (node: unknown, depth: number): string | null => {
    if (depth > 4 || node === null || node === undefined || seen.has(node)) return null;
    if (typeof node === 'object') {
      seen.add(node);
      const record = node as Record<string, unknown>;
      for (const key of keys) {
        const hit = textOf(record[key]);
        if (hit) return hit;
      }
      for (const value of Object.values(record)) {
        const hit = visit(value, depth + 1);
        if (hit) return hit;
      }
    }
    return null;
  };
  return visit(breakdown, 0);
}

const egpOf = (n: number | null): string | null =>
  n === null ? null : `${n.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })} EGP`;

const gradeLabel = (value: string | null | undefined): string | null => {
  const v = (value || '').trim();
  if (!v) return null;
  return v.charAt(0).toUpperCase() + v.slice(1).toLowerCase();
};

/** "96.80 × 71.20 × 38.50 mm" passthrough of geometry metadata (X × Y × Z). */
export function formatLiveDims(dims: { width: number; height: number; depth: number } | null): string | null {
  if (!dims) return null;
  const parts = [dims.width, dims.height, dims.depth].map((v) =>
    typeof v === 'number' && Number.isFinite(v)
      ? v.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })
      : null,
  );
  if (parts.some((p) => p === null)) return null;
  return `${parts.join(' × ')} mm`;
}

/**
 * Technology-aware spec rows for the selected file. Rows whose data does not
 * exist (layer height/infill/color are engine inputs, not persisted) are
 * omitted — never fabricated.
 */
export function selectedFileSpecs(
  file: WorkspaceFile,
  quote: Quote,
  liveDims: { width: number; height: number; depth: number } | null,
): FileSpec[] {
  const specs: FileSpec[] = [];
  const vm = file.vm;
  const breakdown = vm?.pricingBreakdown as Record<string, unknown> | undefined;

  const material = vm?.material && vm.material !== '—' ? vm.material : (quote.material || null);
  if (material) specs.push({ key: 'material', labelKey: 'quotedetail.specMaterial', icon: 'layers', value: material });

  const technology = vm?.process && vm.process !== '—' ? vm.process : (quote.technology || null);
  if (technology) specs.push({ key: 'technology', labelKey: 'quotedetail.specTechnology', icon: 'cpu', value: technology });

  const quantity = vm?.quantity ?? quote.quantity;
  if (Number.isFinite(quantity)) {
    specs.push({ key: 'quantity', labelKey: 'quotedetail.specQuantity', icon: 'layers3', value: `${quantity} pcs`, ltr: true });
  }

  const dims = liveDims ? formatLiveDims(liveDims) : null;
  const catalogDims = file.cad?.dimensions?.trim() && file.cad.dimensions !== 'Pending analysis' ? file.cad.dimensions : null;
  const dimsValue = dims || catalogDims;
  if (dimsValue) specs.push({ key: 'dimensions', labelKey: 'quotedetail.specDimensions', icon: 'scaling', value: dimsValue, ltr: true });

  // Engine-input params: rendered ONLY when present in the stored breakdown.
  const layer = findSpecParam(breakdown, ['layerHeight', 'layerHeightMm', 'layer_height']);
  if (layer) specs.push({ key: 'layer', labelKey: 'quotedetail.specLayerHeight', icon: 'layers', value: layer, ltr: true });
  const infill = findSpecParam(breakdown, ['infill', 'infillPercent', 'infill_percent']);
  if (infill) specs.push({ key: 'infill', labelKey: 'quotedetail.specInfill', icon: 'technology', value: infill, ltr: true });

  const tolerance = gradeLabel(quote.toleranceGrade);
  if (tolerance) specs.push({ key: 'tolerance', labelKey: 'quotedetail.specTolerance', icon: 'precision', value: tolerance });
  const finish = (quote.surfaceFinish || '').trim() || null;
  if (finish) specs.push({ key: 'finish', labelKey: 'quotedetail.specFinish', icon: 'surface', value: finish });
  const color = findSpecParam(breakdown, ['color', 'colorId', 'colour']);
  if (color) specs.push({ key: 'color', labelKey: 'quotedetail.specColor', icon: 'tag', value: color });

  const perUnit = vm?.perUnitCost ?? null;
  const unitValue = perUnit !== null ? egpOf(perUnit) : null;
  if (unitValue) specs.push({ key: 'unit', labelKey: 'quotedetail.specUnitPrice', icon: 'wallet', value: unitValue, ltr: true });

  return specs;
}

/** Line total = per-unit × quantity; null unless both are real numbers. */
export function fileLineTotal(vm: QuoteFileVM | null): string | null {
  if (vm?.perUnitCost == null || !Number.isFinite(vm.perUnitCost) || !Number.isFinite(vm.quantity)) return null;
  return egpOf(vm.perUnitCost * vm.quantity);
}

/* ── Timeline ─────────────────────────────────────────────────────────── */

export type TimelineState = 'done' | 'active' | 'pending' | 'error';

export interface TimelineNode {
  key: string;
  labelKey: string;
  /** ISO timestamp, or null when the event time is genuinely unknown. */
  at: string | null;
  state: TimelineState;
}

const atOf = (value: unknown): string | null => {
  if (typeof value !== 'string' || !value.trim()) return null;
  const d = new Date(value);
  return Number.isNaN(d.getTime()) ? null : value;
};

/**
 * Truthful lifecycle timeline. Only two timestamps exist on the record:
 * createdAt (submission) and statusUpdatedAt (last transition). Intermediate
 * stages are NEVER backfilled — unreached stages render pending.
 */
export function quoteTimelineOf(quote: Quote): TimelineNode[] {
  const created = atOf(quote.createdAt);
  const changed = atOf(quote.statusUpdatedAt) || atOf(quote.updatedAt) || created;
  const status = quote.status;
  const nodes: TimelineNode[] = [{ key: 'submitted', labelKey: 'quotedetail.timelineSubmitted', at: created, state: 'done' }];

  const current: TimelineNode = { key: 'current', labelKey: 'quotedetail.timelineCurrent', at: changed, state: 'active' };
  if (status === 'Approved') {
    nodes.push({ key: 'ready', labelKey: 'dashboard.readyApproval', at: null, state: 'done' });
    nodes.push({ key: 'approved', labelKey: 'dashboard.approved', at: changed, state: 'done' });
    if (quote.convertedOrderId) {
      nodes.push({ key: 'converted', labelKey: 'quotedetail.timelineConverted', at: null, state: 'done' });
    } else {
      nodes.push({ key: 'rejected', labelKey: 'dashboard.rejected', at: null, state: 'pending' });
    }
  } else if (status === 'Rejected') {
    nodes.push({ key: 'ready', labelKey: 'dashboard.readyApproval', at: null, state: 'done' });
    nodes.push({ key: 'rejected', labelKey: 'dashboard.rejected', at: changed, state: 'error' });
  } else if (status === 'Ready for Approval') {
    nodes.push({ key: 'ready', labelKey: 'dashboard.readyApproval', at: changed, state: 'active' });
    nodes.push({ key: 'approved', labelKey: 'dashboard.approved', at: null, state: 'pending' });
    nodes.push({ key: 'rejected', labelKey: 'dashboard.rejected', at: null, state: 'pending' });
  } else if (status === 'Expired') {
    nodes.push({ key: 'ready', labelKey: 'dashboard.readyApproval', at: null, state: 'pending' });
    nodes.push({ key: 'expired', labelKey: 'quotedetail.timelineExpired', at: changed, state: 'error' });
  } else {
    // Draft / Revised: pre-decision, awaiting action.
    current.labelKey = status === 'Revised' ? 'quotedetail.timelineRevised' : 'quotedetail.timelineDraft';
    nodes.push(current);
    nodes.push({ key: 'ready', labelKey: 'dashboard.readyApproval', at: null, state: 'pending' });
    nodes.push({ key: 'approved', labelKey: 'dashboard.approved', at: null, state: 'pending' });
    nodes.push({ key: 'rejected', labelKey: 'dashboard.rejected', at: null, state: 'pending' });
  }
  return nodes;
}

/** Full delivery address from snapshot fields; null when entirely absent. */
export function joinFullAddress(quote: Quote): string | null {
  const parts = [quote.addressLine1, quote.addressLine2, quote.city, quote.governorate, quote.postalCode, quote.country]
    .map((p) => (typeof p === 'string' ? p.trim() : ''))
    .filter(Boolean);
  return parts.length > 0 ? parts.join(', ') : null;
}
