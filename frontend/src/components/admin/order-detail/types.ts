import { CadFile } from '../../../types';

/** Raw CAD join row as returned by GET /api/v1/admin/orders/:id. */
export interface AdminOrderCadEntry {
  cadFileId: string;
  configuration?: Record<string, unknown> | null;
  totalCost?: string | null;
  cadFile?: {
    id: string;
    name: string;
    format: string;
    size?: string | null;
    dimensions?: string | null;
    volume?: string | null;
    meshTriangles?: string | null;
    status?: string | null;
    versions?: Array<{ id: string; version: number; scanStatus?: string; processingStatus?: string }>;
  } | null;
}

export interface AdminOrderEvent {
  id: string;
  orderId: string;
  eventType: string;
  description?: string | null;
  metadata?: Record<string, unknown> | null;
  createdAt: string;
}

/** Canonical CAM LABS order lifecycle — mirrors ORDER_LIFECYCLE_STATUSES in the admin API. */
export const ORDER_LIFECYCLE_STATUSES = [
  'In Review',
  'In Production',
  'Quality Inspection',
  'Delivered',
  'Cancelled',
] as const;

export const ORDER_PROGRESSION_STAGES = [
  'In Review',
  'In Production',
  'Quality Inspection',
  'Delivered',
] as const;

/**
 * Adapt an admin order CAD join row to the shared CadFile shape consumed by the
 * existing geometry pipeline (fetchCadGeometry / acquireCadModel /
 * renderCadThumbnail / CadGeometryViewer). The backend already includes the
 * latest version row; this only remaps it to `latestVersion` — no invented data.
 */
export const toViewerFile = (entry: AdminOrderCadEntry): CadFile | null => {
  const raw = entry.cadFile;
  if (!raw?.id) return null;
  const latest = raw.versions?.[0];
  return {
    id: raw.id,
    name: raw.name || 'CAD file',
    format: (raw.format || 'STL') as CadFile['format'],
    size: raw.size || '—',
    uploaded: '',
    volume: raw.volume || '—',
    dimensions: raw.dimensions || '—',
    meshTriangles: raw.meshTriangles || '—',
    status: (raw.status || 'Verified CAD') as CadFile['status'],
    latestVersion: latest
      ? {
          id: latest.id,
          version: latest.version,
          scanStatus: latest.scanStatus || '',
          processingStatus: latest.processingStatus || '',
        }
      : null,
  };
};

/** Price-edit permission mirrors the backend gate (requireOperationsAdmin). */
export const canEditOrderPrice = (role?: string | null): boolean => {
  if (!role) return false;
  if (['SUPER_ADMIN', 'ADMIN', 'OPERATIONS_ADMIN'].includes(role)) return true;
  // Legacy mapping: backend normalizes isAdmin+CUSTOMER to ADMIN.
  return role.includes('ADMIN');
};

export const canApproveOrder = (status?: string | null): boolean =>
  Boolean(status) && !['Delivered', 'Cancelled', 'Quality Inspection'].includes(String(status));
