import { describe, it, expect } from 'vitest';
import { ApiError } from '../../services/api';
import { authErrorMessage } from './authErrors';

const t = (key: string) => key;

describe('authErrorMessage', () => {
  it('maps transport and server failures to localized keys', () => {
    expect(authErrorMessage(new ApiError(0, 'Unable to reach the CAM LABS servers.', 'NETWORK_ERROR'), t)).toBe('auth.errNetwork');
    expect(authErrorMessage(new ApiError(500, 'Temporarily unavailable.', 'SERVER_ERROR'), t)).toBe('auth.errServerDown');
    expect(authErrorMessage(new ApiError(401, 'Invalid email or password.', 'INVALID_CREDENTIALS'), t)).toBe('auth.errInvalidCredentials');
    expect(authErrorMessage(new ApiError(429, 'Too many requests.', 'RATE_LIMITED'), t)).toBe('auth.errRateLimited');
  });

  it('never surfaces blank legacy API-error text', () => {
    expect(authErrorMessage(new ApiError(500, 'API error: '), t)).toBe('auth.errUnexpected');
    expect(authErrorMessage(new ApiError(500, 'API error:'), t)).toBe('auth.errUnexpected');
    expect(authErrorMessage(new ApiError(500, 'Request failed (HTTP 500).', 'REQUEST_FAILED'), t)).toBe('auth.errUnexpected');
    expect(authErrorMessage(new ApiError(500, ''), t)).toBe('auth.errUnexpected');
    expect(authErrorMessage(new TypeError('Failed to fetch'), t)).toBe('auth.errUnexpected');
    expect(authErrorMessage(undefined, t)).toBe('auth.errUnexpected');
  });

  it('passes curated server messages through untouched', () => {
    expect(authErrorMessage(new ApiError(401, 'Invalid email or password.', 'INVALID_CREDENTIALS'), t)).toBe('auth.errInvalidCredentials');
    expect(authErrorMessage(new ApiError(401, 'Incorrect verification code.', 'INVALID_TWO_FACTOR_CODE'), t)).toBe('Incorrect verification code.');
    expect(authErrorMessage(new ApiError(409, 'An account with these credentials already exists.', 'ACCOUNT_EXISTS'), t)).toBe(
      'An account with these credentials already exists.',
    );
  });
});
