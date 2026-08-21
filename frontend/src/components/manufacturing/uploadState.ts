import { CadFile } from '../../types';

export type UploadItemStatus = 'idle' | 'uploading' | 'scanning' | 'processing' | 'ready' | 'failed' | 'duplicate' | 'unsupported';
export type UploadValidationState = 'pending' | 'valid' | 'invalid';

export interface UploadStateItem {
  status: UploadItemStatus;
  cadFile?: CadFile;
  validationState?: UploadValidationState;
  processingComplete?: boolean;
}

type CadMetadata = NonNullable<NonNullable<CadFile['latestVersion']>['metadata']> & {
  supportLevel?: string;
  volume?: number;
  surfaceArea?: number;
  dimensions?: { width?: number; height?: number; depth?: number };
};

export const isCadFileReady = (cadFile?: CadFile): boolean => {
  const version = cadFile?.latestVersion;
  const metadata = version?.metadata as CadMetadata | null | undefined;
  return Boolean(
    cadFile?.id
    && version?.processingStatus === 'COMPLETE'
    && metadata?.geometryStatus === 'READY'
    && metadata.supportLevel !== 'FAILED_VALIDATION'
    && typeof metadata.volume === 'number'
    && metadata.volume > 0
    && typeof metadata.surfaceArea === 'number'
    && metadata.surfaceArea > 0
    && metadata.dimensions
  );
};

export const isUploadItemReady = (item: UploadStateItem): boolean => Boolean(
  item.cadFile?.id
  && (item.status === 'ready' || item.status === 'duplicate')
  && item.validationState === 'valid'
  && item.processingComplete === true
  && isCadFileReady(item.cadFile)
);

export const areAllUploadsReady = (items: UploadStateItem[]): boolean => items.length > 0 && items.every(isUploadItemReady);

export const hasUploadInFlight = (items: UploadStateItem[]): boolean => items.some((item) => ['uploading', 'scanning', 'processing'].includes(item.status));

export const hasBlockingUploadState = (items: UploadStateItem[]): boolean => items.length === 0 || items.some((item) => !isUploadItemReady(item));