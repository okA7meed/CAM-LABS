export type ManufacturingTechnology = 'SLS' | 'SLA' | 'FDM' | 'CNC' | 'DMLS' | 'Sheet Metal' | 'Injection Molding';

export type MaterialCategory = 'Polymers' | 'High-Performance' | 'Metals' | 'Resins' | 'Elastomers';

export interface Material {
  id: string;
  name: string;
  technology: ManufacturingTechnology;
  category: MaterialCategory;
  description: string;
  tensileStrength: number; // in MPa
  hdt: number; // in °C @ 0.45 MPa
  elongation: number; // in %
  density: number; // in g/cm³
  standardTolerance: string;
  minWallThickness: string;
  leadTime: string;
  surfaceFinish: string;
  tags: string[];
  colorOptions: string[];
  idealFor: string;
  isCertified?: boolean;
}

export interface UserPreferences {
  units: 'mm' | 'in';
  toleranceStandard: string;
  dfmNotifications: boolean;
  dispatchAlerts: boolean;
}

export interface User {
  id: string;
  name: string;
  email: string;
  role: string;
  company: string;
  phone?: string;
  avatar: string;
  tier: string;
  address?: string;
  taxId?: string;
  preferences: UserPreferences;
  createdAt?: string;
  updatedAt?: string;
}

export interface OrderMilestone {
  step: string;
  date: string;
  done: boolean;
  desc: string;
}

export type OrderStatus = 'In Review' | 'In Production' | 'Quality Inspection' | 'Delivered' | 'Cancelled';

export interface Order {
  id: string;
  userId?: string;
  quoteId?: string;
  partName: string;
  technology: string;
  material: string;
  quantity: number;
  date: string;
  estDelivery: string;
  status: OrderStatus;
  statusBadge?: string;
  progressStep: number;
  totalCost: string;
  tolerance: string;
  trackingNum?: string;
  history: OrderMilestone[];
  cadFileIds?: string[];
  cadFileConfigs?: Array<{ cadFileId: string; configuration: Record<string, unknown>; totalCost?: string }>;
  cadFiles?: Array<{ cadFileId: string; cadFile: CadFile }>;
}

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
}

export interface CadFile {
  id: string;
  userId?: string;
  name: string;
  format: 'STEP' | 'STP' | 'STL' | 'OBJ' | 'PLY' | 'DXF' | 'SVG' | 'PDF' | 'IGES' | 'IGS';
  size: string;
  uploaded: string;
  volume: string;
  dimensions: string;
  meshTriangles: string;
  status: 'Analyzing' | 'Verified CAD' | 'DFM Flagged';
  latestVersion?: {
    id?: string;
    version: number;
    scanStatus: string;
    processingStatus: string;
    metadata?: { geometryStatus?: string; viewerAsset?: { available?: boolean; format?: string } | null } | null;
    failureCode?: string | null;
    failureMessage?: string | null;
    dfmReport?: { status: string; summary: { findings?: string[] } } | null;
  } | null;
}

export interface CadUploadResult extends CadFile {
  duplicate: boolean;
  jobId: string | null;
  version: NonNullable<CadFile['latestVersion']>;
}

export interface ToastMessage {
  id: string;
  title: string;
  message: string;
  type: 'success' | 'error' | 'info' | 'warning';
}

export type ViewType = 'home' | 'services' | 'materials' | 'workflow' | 'about' | 'dashboard' | 'profile' | 'marketplace' | 'manufacturing-request';
