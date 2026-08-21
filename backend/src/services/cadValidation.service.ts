import { Logger } from '../utils/logger';
import { ENV } from '../config/env';
import { SUPPORTED_CAD_FORMATS } from '../cad/file-processing';

export interface LocalCadValidationResult {
  fileName: string;
  fileExtension: string;
  isValidFormat: boolean;
  fileSizeMb: number;
  isSizeWithinLimit: boolean; // Limit: 150MB
  preliminaryStatus: 'Valid' | 'Format Unsupported' | 'File Exceeds 150MB Limit';
  note: string;
}

/** Lightweight pre-flight validation. Byte parsing and DFM analysis happen asynchronously after upload. */
export class CadValidationService {
  static validateFile(fileName: string, sizeBytes: number = 1024 * 1024 * 5): LocalCadValidationResult {
    const extMatch = fileName.match(/\.[0-9a-z]+$/i);
    const ext = extMatch ? extMatch[0].toLowerCase() : '';
    const isValidFormat = SUPPORTED_CAD_FORMATS.includes(ext.replace('.', '').toUpperCase() as typeof SUPPORTED_CAD_FORMATS[number]);
    const sizeMb = parseFloat((sizeBytes / (1024 * 1024)).toFixed(2));
    const isSizeWithinLimit = sizeBytes <= ENV.CAD_MAX_FILE_SIZE_BYTES;

    let preliminaryStatus: LocalCadValidationResult['preliminaryStatus'] = 'Valid';
    if (!isValidFormat) preliminaryStatus = 'Format Unsupported';
    else if (!isSizeWithinLimit) preliminaryStatus = 'File Exceeds 150MB Limit';

    Logger.debug(`[CadValidationService] Pre-flight checked ${fileName}: ${preliminaryStatus}`);

    return {
      fileName,
      fileExtension: ext.toUpperCase().replace('.', ''),
      isValidFormat,
      fileSizeMb: sizeMb,
      isSizeWithinLimit,
      preliminaryStatus,
      note: 'Pre-flight format and size check completed. Metadata and DFM analysis run asynchronously after secure upload.',
    };
  }
}
