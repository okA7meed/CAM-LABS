import { CadFile } from '../../../types';
import { CadGeometryData, CalculatedQuotationData, MultiFileQuotation } from '../../../services/api';
import { ModelDimensions, ModelUnit } from '../../../utils/modelUnits';
import { UploadItemStatus, UploadValidationState } from '../uploadState';

export type TechnologyId = 'printing' | 'cnc' | 'sheet' | 'injection';
export type ProcessId = 'fdm' | 'sla' | 'sls' | 'milling' | 'turning' | 'sheet' | 'injection';
export type QuoteData = CalculatedQuotationData | MultiFileQuotation;
export type PanelStatus = 'active' | 'completed' | 'inactive';
export type ConfigTab = 'basic' | 'advanced';

export interface TechnicalDocumentItem {
  key: string;
  id?: string;
  name: string;
  mimeType?: string;
  byteSize?: number;
  progress: number;
  status: 'uploading' | 'ready' | 'error';
  message?: string;
}

export interface UploadItem {
  id: string; name: string; format: string; sizeBytes: number; size: string;
  status: UploadItemStatus; validationState: UploadValidationState; processingComplete: boolean;
  progress: number; message?: string; cadFile?: CadFile;
}
export interface FileSetupState {
  unit: ModelUnit; dimensions: ModelDimensions | null; baseDimensions: ModelDimensions | null;
  volume: number | null; surfaceArea: number | null; triangleCount: number | null; selected: boolean;
}
export type FileConfiguration = { technology: string | null; process: string | null; material: string | null; quantity: number; quality: string; color: string; finish: string; tolerance: string; wallCount?: number; supportEnabled?: boolean; infillPercent?: number | null };
export interface RequestState {
  cadFile: CadFile | null; technology: TechnologyId | null; process: ProcessId | null;
  material: string | null; quantity: number; quality: string; color: string; finish: string;
  tolerance: string; wallCount: number; infillPercent?: number | null; geometry: CadGeometryData | null;
}