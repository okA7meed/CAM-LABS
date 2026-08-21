import dotenv from 'dotenv';
dotenv.config();

export const ENV = {
  PORT: parseInt(process.env.PORT || '5001', 10),
  NODE_ENV: process.env.NODE_ENV || 'development',
  DATABASE_URL: process.env.DATABASE_URL || 'postgresql://postgres:postgres@localhost:5432/cam_labs_db?schema=public',
  CORS_ORIGIN: process.env.CORS_ORIGIN || 'http://localhost:3000',
  SESSION_TTL_DAYS: parseInt(process.env.SESSION_TTL_DAYS || '30', 10),
  CAD_STORAGE_ROOT: process.env.CAD_STORAGE_ROOT || '.data/cad-files',
  CAD_MAX_FILE_SIZE_BYTES: parseInt(process.env.CAD_MAX_FILE_SIZE_BYTES || String(150 * 1024 * 1024), 10),
  CAD_PROCESSING_TIMEOUT_MS: parseInt(process.env.CAD_PROCESSING_TIMEOUT_MS || String(120_000), 10),
  CAD_SCANNER_MODE: process.env.CAD_SCANNER_MODE || 'local',
  FDM_SLICER_PATH: process.env.FDM_SLICER_PATH || (process.platform === 'darwin' ? '/Applications/PrusaSlicer.app/Contents/MacOS/PrusaSlicer' : 'prusa-slicer'),
  FDM_SLICER_PROFILE: process.env.FDM_SLICER_PROFILE || (process.platform === 'darwin' ? '/Applications/PrusaSlicer.app/Contents/Resources/profiles/PrusaResearch.ini' : ''),
  FDM_SLICER_TIMEOUT_MS: parseInt(process.env.FDM_SLICER_TIMEOUT_MS || '120000', 10),
  
  
};

export const getEnvironmentIssues = (): string[] => {
  const issues: string[] = [];

  if (ENV.NODE_ENV === 'production' && !process.env.DATABASE_URL) {
    issues.push('DATABASE_URL is required in production.');
  }

  if (!Number.isInteger(ENV.SESSION_TTL_DAYS) || ENV.SESSION_TTL_DAYS < 1 || ENV.SESSION_TTL_DAYS > 90) {
    issues.push('SESSION_TTL_DAYS must be an integer between 1 and 90.');
  }

  if (!Number.isInteger(ENV.CAD_MAX_FILE_SIZE_BYTES) || ENV.CAD_MAX_FILE_SIZE_BYTES < 1) {
    issues.push('CAD_MAX_FILE_SIZE_BYTES must be a positive integer.');
  }

  if (ENV.NODE_ENV === 'production' && ENV.CAD_SCANNER_MODE === 'local') {
    issues.push('CAD_SCANNER_MODE must select a production scanner in production.');
  }

  return issues;
};
