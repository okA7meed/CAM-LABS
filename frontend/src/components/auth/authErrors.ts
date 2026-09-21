import { ApiError } from '../../services/api';

/**
 * Maps API failures to safe, localized auth UI messages. Server-curated
 * messages pass through; transport/proxy failures and any legacy
 * "API error"-shaped text fall back to generic localized strings so the
 * UI can never render a blank "API error:".
 */
export const authErrorMessage = (err: unknown, t: (key: string) => string): string => {
  if (err instanceof ApiError) {
    if (err.code === 'NETWORK_ERROR') return t('auth.errNetwork');
    if (err.code === 'SERVER_ERROR') return t('auth.errServerDown');
    if (err.code === 'INVALID_CREDENTIALS') return t('auth.errInvalidCredentials');
    if (err.code === 'RATE_LIMITED' || err.status === 429) return t('auth.errRateLimited');
    if (err.message && err.message.trim() && !/^API error:?\s*$/.test(err.message) && !/^Request failed/.test(err.message)) {
      return err.message;
    }
    return t('auth.errUnexpected');
  }
  return t('auth.errUnexpected');
};
