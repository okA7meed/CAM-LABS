import dotenv from 'dotenv';
dotenv.config();

export const ENV = {
  PORT: parseInt(process.env.PORT || '5001', 10),
  NODE_ENV: process.env.NODE_ENV || 'development',
  DATABASE_URL: process.env.DATABASE_URL || 'postgresql://postgres:postgres@localhost:5432/cam_labs_db?schema=public',
  CORS_ORIGIN: process.env.CORS_ORIGIN || 'http://localhost:3000',
  SESSION_TTL_DAYS: parseInt(process.env.SESSION_TTL_DAYS || '30', 10),
  GOOGLE_CLIENT_ID: (process.env.GOOGLE_CLIENT_ID || '').trim(),
  RESEND_API_KEY: (process.env.RESEND_API_KEY || '').trim(),
  RESEND_FROM: (process.env.RESEND_FROM || 'CAM LABS <onboarding@resend.dev>').trim(),
  PASSWORD_RESET_PEPPER: (process.env.PASSWORD_RESET_PEPPER || '').trim(),
  PASSWORD_RESET_OTP_TTL_MINUTES: parseInt(process.env.PASSWORD_RESET_OTP_TTL_MINUTES || '10', 10),
  PASSWORD_RESET_MAX_ATTEMPTS: parseInt(process.env.PASSWORD_RESET_MAX_ATTEMPTS || '5', 10),
  PASSWORD_RESET_RESEND_COOLDOWN_SECONDS: parseInt(process.env.PASSWORD_RESET_RESEND_COOLDOWN_SECONDS || '60', 10),
  PASSWORD_RESET_TOKEN_TTL_MINUTES: parseInt(process.env.PASSWORD_RESET_TOKEN_TTL_MINUTES || '15', 10),
  CAD_STORAGE_ROOT: process.env.CAD_STORAGE_ROOT || '.data/cad-files',
  CAD_MAX_FILE_SIZE_BYTES: parseInt(process.env.CAD_MAX_FILE_SIZE_BYTES || String(150 * 1024 * 1024), 10),
  TECHNICAL_MAX_FILE_SIZE_BYTES: parseInt(process.env.TECHNICAL_MAX_FILE_SIZE_BYTES || String(10 * 1024 * 1024), 10),
  TECHNICAL_MAX_DOCUMENTS: parseInt(process.env.TECHNICAL_MAX_DOCUMENTS || '10', 10),
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

  if (!Number.isInteger(ENV.TECHNICAL_MAX_FILE_SIZE_BYTES) || ENV.TECHNICAL_MAX_FILE_SIZE_BYTES < 1) {
    issues.push('TECHNICAL_MAX_FILE_SIZE_BYTES must be a positive integer.');
  }

  if (!Number.isInteger(ENV.TECHNICAL_MAX_DOCUMENTS) || ENV.TECHNICAL_MAX_DOCUMENTS < 1 || ENV.TECHNICAL_MAX_DOCUMENTS > 50) {
    issues.push('TECHNICAL_MAX_DOCUMENTS must be an integer between 1 and 50.');
  }

  if (ENV.NODE_ENV === 'production' && ENV.CAD_SCANNER_MODE === 'local') {
    issues.push('CAD_SCANNER_MODE must select a production scanner in production.');
  }

  if (!Number.isInteger(ENV.PASSWORD_RESET_OTP_TTL_MINUTES) || ENV.PASSWORD_RESET_OTP_TTL_MINUTES < 1 || ENV.PASSWORD_RESET_OTP_TTL_MINUTES > 60) {
    issues.push('PASSWORD_RESET_OTP_TTL_MINUTES must be an integer between 1 and 60.');
  }

  if (!Number.isInteger(ENV.PASSWORD_RESET_MAX_ATTEMPTS) || ENV.PASSWORD_RESET_MAX_ATTEMPTS < 1 || ENV.PASSWORD_RESET_MAX_ATTEMPTS > 10) {
    issues.push('PASSWORD_RESET_MAX_ATTEMPTS must be an integer between 1 and 10.');
  }

  if (!Number.isInteger(ENV.PASSWORD_RESET_RESEND_COOLDOWN_SECONDS) || ENV.PASSWORD_RESET_RESEND_COOLDOWN_SECONDS < 10 || ENV.PASSWORD_RESET_RESEND_COOLDOWN_SECONDS > 600) {
    issues.push('PASSWORD_RESET_RESEND_COOLDOWN_SECONDS must be an integer between 10 and 600.');
  }

  if (!Number.isInteger(ENV.PASSWORD_RESET_TOKEN_TTL_MINUTES) || ENV.PASSWORD_RESET_TOKEN_TTL_MINUTES < 5 || ENV.PASSWORD_RESET_TOKEN_TTL_MINUTES > 60) {
    issues.push('PASSWORD_RESET_TOKEN_TTL_MINUTES must be an integer between 5 and 60.');
  }

  return issues;
};
