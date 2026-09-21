import { CadFile, Order, OrderEvent, OrderStatus, User } from '../../types';
import { fileExtension } from './dashUtils';

export interface WorkspaceOrderFile {
  fileId: string;
  cad: CadFile | null;
  name: string;
  format: string;
  quantity: number;
  configuration: Record<string, unknown> | null;
  unitPrice: string | null;
}

export interface OrderFileSpec {
  key: string;
  labelKey: string;
  icon: string;
  value: string | null;
  ltr?: boolean;
}

export interface OrderDeliveryInfo {
  recipient: string | null;
  phone: string | null;
  governorate: string | null;
  city: string | null;
  fullAddress: string | null;
  method: string | null;
  estimated: string | null;
  notes: string | null;
}

export interface OrderTimelineNode {
  key: string;
  labelKey: string;
  state: 'done' | 'active' | 'pending' | 'error';
  at: string | null;
}

export interface CustomerOrderUpdate {
  id: string;
  labelKey: string;
  statusKey?: string;
  statusFallback?: string;
  at: string | null;
}

const ORDER_STATUS_LABEL_KEYS: Record<string, string> = {
  'In Review': 'order.status.inReview',
  'In Production': 'order.status.inProduction',
  'Quality Inspection': 'order.status.qualityInspection',
  Delivered: 'order.status.delivered',
  Cancelled: 'order.status.cancelled',
};

/**
 * Customer-visible manufacturing updates derived from order events.
 *
 * SECURITY: order events carry admin-authored free text (approval notes,
 * price-change history, manufacturer assignment notes, internal routing).
 * Only fully server-generated, customer-safe event types are exposed, and
 * rendering uses type-derived labels — raw `description` and `metadata`
 * are NEVER shown. ORDER_APPROVED (admin notes), PRICE_UPDATED (internal
 * pricing), MANUFACTURER_ASSIGNED (internal routing) and CUSTOMER_MESSAGE
 * (belongs to messaging, not manufacturing notes) are always excluded.
 */
export function customerVisibleOrderUpdates(events: OrderEvent[] | undefined, limit = 3): CustomerOrderUpdate[] {
  if (!Array.isArray(events)) return [];
  const out: CustomerOrderUpdate[] = [];
  const sorted = [...events].sort((a, b) => {
    const da = Date.parse(a?.createdAt || '');
    const db = Date.parse(b?.createdAt || '');
    if (Number.isNaN(da) && Number.isNaN(db)) return 0;
    if (Number.isNaN(da)) return 1;
    if (Number.isNaN(db)) return -1;
    return db - da;
  });
  for (const e of sorted) {
    if (out.length >= limit) break;
    if (!e || typeof e.eventType !== 'string') continue;
    if (e.eventType === 'ORDER_CREATED') {
      out.push({ id: e.id, labelKey: 'orderdetail.mfgEventCreated', at: e.createdAt || null });
    } else if (e.eventType === 'STATUS_UPDATE') {
      const to = textOf((e.metadata as Record<string, unknown> | undefined)?.to);
      if (!to) continue;
      const statusKey = ORDER_STATUS_LABEL_KEYS[to];
      out.push({
        id: e.id,
        labelKey: 'orderdetail.mfgEventStatus',
        statusKey,
        statusFallback: statusKey ? undefined : to,
        at: e.createdAt || null,
      });
    }
  }
  return out;
}

const textOf = (value: unknown): string | null => {
  if (typeof value === 'string' && value.trim()) return value.trim();
  if (typeof value === 'number' && Number.isFinite(value)) return String(value);
  return null;
};

export function findConfigParam(config: unknown, keys: string[]): string | null {
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
  return visit(config, 0);
}

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
 * Resolve files for an order joining embedded CAD joins and catalog records.
 */
export function resolveOrderFiles(order: Order, cadById: Map<string, CadFile>): WorkspaceOrderFile[] {
  const result: WorkspaceOrderFile[] = [];
  const seenIds = new Set<string>();

  const rawEntries = Array.isArray(order.cadFiles) ? order.cadFiles : [];
  for (const entry of rawEntries) {
    const fileId = entry.cadFileId || (entry as { cadFile?: { id?: string } })?.cadFile?.id;
    if (!fileId || seenIds.has(fileId)) continue;
    seenIds.add(fileId);

    const catalogCad = cadById.get(fileId) || null;
    const embeddedCad = (entry as { cadFile?: CadFile }).cadFile || null;
    const cad = catalogCad || embeddedCad;
    const config = (entry.configuration && typeof entry.configuration === 'object'
      ? (entry.configuration as Record<string, unknown>)
      : null);

    const name = cad?.name || (config?.fileName as string) || (config?.partName as string) || order.partName || fileId;
    const format = cad?.format || fileExtension(name) || 'CAD';
    const rawQty = config?.quantity ?? (entry as { quantity?: number })?.quantity;
    const quantity = typeof rawQty === 'number' && Number.isFinite(rawQty) && rawQty > 0
      ? rawQty
      : (rawEntries.length === 1 ? order.quantity : 1);

    const unitPrice = textOf(config?.unitPrice) || textOf(config?.perUnitCost) || null;

    result.push({
      fileId,
      cad,
      name,
      format,
      quantity,
      configuration: config,
      unitPrice,
    });
  }

  // Handle cadFileIds fallback when cadFiles array is empty
  if (result.length === 0 && Array.isArray(order.cadFileIds)) {
    for (const id of order.cadFileIds) {
      if (seenIds.has(id)) continue;
      seenIds.add(id);
      const cad = cadById.get(id) || null;
      const name = cad?.name || (order.cadFileIds && order.cadFileIds.length > 1 ? id : order.partName) || id;
      result.push({
        fileId: id,
        cad,
        name,
        format: cad?.format || fileExtension(name) || 'CAD',
        quantity: order.cadFileIds.length === 1 ? order.quantity : 1,
        configuration: null,
        unitPrice: null,
      });
    }
  }

  return result;
}

/**
 * File-specific manufacturing specifications.
 * Strictly avoids "Total Price (Selected File)".
 */
export function selectedOrderFileSpecs(
  file: WorkspaceOrderFile,
  order: Order,
  liveDims: { width: number; height: number; depth: number } | null,
): OrderFileSpec[] {
  const specs: OrderFileSpec[] = [];
  const config = file.configuration;

  const material = textOf(config?.material) || order.material;
  if (material) {
    specs.push({ key: 'material', labelKey: 'orderdetail.specMaterial', icon: 'cube', value: material });
  }

  const technology = textOf(config?.technology) || textOf(config?.process) || order.technology;
  if (technology) {
    specs.push({ key: 'technology', labelKey: 'orderdetail.specTechnology', icon: 'gear', value: technology });
  }

  const quantity = file.quantity || order.quantity;
  if (Number.isFinite(quantity)) {
    specs.push({ key: 'quantity', labelKey: 'orderdetail.specQuantity', icon: 'layers3', value: `${quantity} pcs`, ltr: true });
  }

  const dims = liveDims ? formatLiveDims(liveDims) : null;
  const catalogDims = file.cad?.dimensions?.trim() && file.cad.dimensions !== 'Pending analysis' ? file.cad.dimensions : null;
  const dimsValue = dims || catalogDims;
  if (dimsValue) {
    specs.push({ key: 'dimensions', labelKey: 'orderdetail.specDimensions', icon: 'scaling', value: dimsValue, ltr: true });
  }

  const layer = findConfigParam(config, ['layerHeight', 'layerHeightMm', 'layer_height']);
  if (layer) {
    specs.push({ key: 'layer', labelKey: 'orderdetail.specLayerHeight', icon: 'layers', value: layer, ltr: true });
  }

  const infill = findConfigParam(config, ['infill', 'infillPercent', 'infill_percent']);
  if (infill) {
    specs.push({ key: 'infill', labelKey: 'orderdetail.specInfill', icon: 'technology', value: infill, ltr: true });
  }

  const tolerance = textOf(config?.tolerance) || order.tolerance;
  if (tolerance) {
    specs.push({ key: 'tolerance', labelKey: 'orderdetail.specTolerance', icon: 'precision', value: tolerance });
  }

  const finish = textOf(config?.surfaceFinish) || textOf(config?.finish) || (order as { surfaceFinish?: string }).surfaceFinish;
  if (finish) {
    specs.push({ key: 'finish', labelKey: 'orderdetail.specFinish', icon: 'surface', value: finish });
  }

  const color = findConfigParam(config, ['color', 'colorId', 'colour']);
  if (color) {
    specs.push({ key: 'color', labelKey: 'orderdetail.specColor', icon: 'tag', value: color });
  }

  if (file.unitPrice) {
    specs.push({ key: 'unitPrice', labelKey: 'orderdetail.specUnitPrice', icon: 'wallet', value: file.unitPrice, ltr: true });
  }

  return specs;
}

const asRecord = (v: unknown): Record<string, unknown> =>
  v && typeof v === 'object' && !Array.isArray(v) ? (v as Record<string, unknown>) : {};

/**
 * Extract structured delivery information from order snapshots and fallback fields.
 */
export function orderDeliveryInfoOf(order: Order, currentUser?: User | null): OrderDeliveryInfo {
  const snap = asRecord(order.shippingAddressSnapshot);
  const contact = asRecord((order as { contactSnapshot?: unknown }).contactSnapshot);

  const recipient =
    textOf(snap.recipientName) ||
    textOf(snap.name) ||
    textOf(contact.name) ||
    order.user?.name ||
    currentUser?.name ||
    null;

  const phone =
    textOf(snap.phone) ||
    textOf(snap.contactPhone) ||
    textOf(contact.phone) ||
    textOf((order as { contactPhone?: unknown }).contactPhone) ||
    currentUser?.phone ||
    null;

  const governorate =
    textOf(snap.governorate) ||
    textOf((order as { governorate?: unknown }).governorate) ||
    null;

  const city =
    textOf(snap.city) ||
    textOf(snap.area) ||
    textOf((order as { city?: unknown }).city) ||
    null;

  const street =
    textOf(snap.street) ||
    textOf(snap.addressLine1) ||
    textOf(snap.address) ||
    null;

  const building =
    textOf(snap.building) ||
    textOf(snap.addressLine2) ||
    null;

  let fullAddress: string | null = null;
  const parts = [building, street, city, governorate].filter((p): p is string => Boolean(p && p.trim()));
  if (parts.length > 0) {
    fullAddress = parts.join(', ');
  } else if (typeof (order as { shippingAddress?: unknown }).shippingAddress === 'string') {
    const raw = ((order as { shippingAddress?: string }).shippingAddress || '').trim();
    if (raw) fullAddress = raw;
  }

  const method =
    textOf((order as { shippingMethod?: unknown }).shippingMethod) ||
    textOf(snap.methodName) ||
    textOf(snap.methodLabel) ||
    null;

  const estimated =
    textOf(order.estDelivery) ||
    textOf(snap.eta) ||
    textOf(snap.deliveryEstimate) ||
    null;

  const notes =
    textOf(snap.deliveryNotes) ||
    textOf((order as { deliveryNotes?: unknown }).deliveryNotes) ||
    null;

  return {
    recipient,
    phone,
    governorate,
    city,
    fullAddress,
    method,
    estimated,
    notes,
  };
}

const LIFECYCLE_STAGES: Array<{ key: OrderStatus; labelKey: string }> = [
  { key: 'In Review', labelKey: 'order.status.inReview' },
  { key: 'In Production', labelKey: 'order.status.inProduction' },
  { key: 'Quality Inspection', labelKey: 'order.status.qualityInspection' },
  { key: 'Delivered', labelKey: 'order.status.delivered' },
];

export function orderTimelineOf(order: Order): OrderTimelineNode[] {
  if (order.status === 'Cancelled') {
    const events = order.events || [];
    const cancelEvt = events.find((e: OrderEvent) => e.eventType === 'CANCELLED');
    return [
      {
        key: 'created',
        labelKey: 'order.status.inReview',
        state: 'done',
        at: order.createdAt || order.date || null,
      },
      {
        key: 'cancelled',
        labelKey: 'order.status.cancelled',
        state: 'error',
        at: cancelEvt?.createdAt || order.updatedAt || null,
      },
    ];
  }

  const events = order.events || [];
  const statusTimestamps: Record<string, string> = {};
  if (order.createdAt || order.date) {
    statusTimestamps['In Review'] = order.createdAt || order.date;
  }

  for (const evt of events) {
    const toStatus = textOf(evt.metadata?.to);
    if (toStatus && evt.createdAt && !statusTimestamps[toStatus]) {
      statusTimestamps[toStatus] = evt.createdAt;
    }
    if (evt.eventType === 'ORDER_CREATED' && !statusTimestamps['In Review']) {
      statusTimestamps['In Review'] = evt.createdAt;
    }
  }

  const currentIndex = LIFECYCLE_STAGES.findIndex((s) => s.key === order.status);
  const activeIdx = currentIndex >= 0 ? currentIndex : 0;

  return LIFECYCLE_STAGES.map((stage, idx) => {
    let state: 'done' | 'active' | 'pending' = 'pending';
    if (idx < activeIdx) state = 'done';
    else if (idx === activeIdx) state = 'active';

    const at = statusTimestamps[stage.key] || (idx === 0 ? order.createdAt || order.date || null : null);

    return {
      key: stage.key,
      labelKey: stage.labelKey,
      state,
      at,
    };
  });
}
