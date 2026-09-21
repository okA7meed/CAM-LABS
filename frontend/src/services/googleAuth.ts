/**
 * Google Identity Services (GIS) ID-token helper for "Continue with Google".
 *
 * Standards: Google Identity Services + OAuth 2.0 / OpenID Connect ID tokens.
 * The browser obtains a Google-signed ID token (public VITE_GOOGLE_CLIENT_ID);
 * the backend verifies it server-side via Google tokeninfo before creating any
 * session. The ID token itself is NEVER trusted client-side for auth state.
 */

const GIS_SCRIPT_SRC = 'https://accounts.google.com/gsi/client';

declare global {
  interface Window {
    google?: {
      accounts?: {
        id?: {
          initialize: (config: {
            client_id: string;
            callback: (response: { credential?: string }) => void;
            auto_select?: boolean;
            use_fedcm_for_prompt?: boolean;
          }) => void;
          prompt: (callback?: (notification: {
            isNotDisplayed: () => boolean;
            isSkippedMoment: () => boolean;
            isDismissedMoment: () => boolean;
          }) => void) => void;
          cancel: () => void;
        };
      };
    };
  }
}

export type GoogleAuthErrorCode =
  | 'unconfigured'
  | 'unavailable'
  | 'cancelled'
  | 'failed';

export class GoogleAuthError extends Error {
  constructor(
    public readonly code: GoogleAuthErrorCode,
    message: string,
  ) {
    super(message);
    this.name = 'GoogleAuthError';
  }
}

export const getGoogleClientId = (): string =>
  (import.meta.env.VITE_GOOGLE_CLIENT_ID as string | undefined)?.trim() ?? '';

let gisScriptPromise: Promise<void> | null = null;

const loadGisScript = (): Promise<void> => {
  if (typeof window === 'undefined') {
    return Promise.reject(new GoogleAuthError('unavailable', 'Google sign-in is unavailable.'));
  }
  if (window.google?.accounts?.id) return Promise.resolve();
  if (gisScriptPromise) return gisScriptPromise;
  gisScriptPromise = new Promise<void>((resolve, reject) => {
    const existing = document.querySelector<HTMLScriptElement>(`script[src="${GIS_SCRIPT_SRC}"]`);
    if (existing) {
      existing.addEventListener('load', () => resolve(), { once: true });
      existing.addEventListener('error', () => reject(new GoogleAuthError('unavailable', 'Google sign-in is unavailable.')), { once: true });
      return;
    }
    const script = document.createElement('script');
    script.src = GIS_SCRIPT_SRC;
    script.async = true;
    script.defer = true;
    script.onload = () => resolve();
    script.onerror = () => reject(new GoogleAuthError('unavailable', 'Google sign-in is unavailable.'));
    document.head.appendChild(script);
  });
  gisScriptPromise.catch(() => {
    gisScriptPromise = null;
  });
  return gisScriptPromise;
};

/**
 * Open the Google account chooser via GIS One Tap prompt and resolve the
 * Google-signed ID token (credential). The caller must POST it to
 * POST /api/v1/auth/google for server-side verification — never decode it
 * locally as proof of authentication.
 */
export const requestGoogleCredential = async (): Promise<string> => {
  const clientId = getGoogleClientId();
  if (!clientId) {
    throw new GoogleAuthError('unconfigured', 'Google sign-in is not configured yet.');
  }
  await loadGisScript();
  const accountsId = window.google?.accounts?.id;
  if (!accountsId) {
    throw new GoogleAuthError('unavailable', 'Google sign-in is unavailable.');
  }

  return new Promise<string>((resolve, reject) => {
    let settled = false;
    const fail = (code: GoogleAuthErrorCode, message: string) => {
      if (settled) return;
      settled = true;
      try {
        accountsId.cancel();
      } catch {
        /* ignore cleanup errors */
      }
      reject(new GoogleAuthError(code, message));
    };

    accountsId.initialize({
      client_id: clientId,
      auto_select: false,
      callback: (response) => {
        if (settled) return;
        settled = true;
        if (response?.credential) resolve(response.credential);
        else fail('failed', 'Google authentication failed.');
      },
    });

    try {
      accountsId.prompt((notification) => {
        try {
          if (
            notification.isNotDisplayed() ||
            notification.isSkippedMoment() ||
            notification.isDismissedMoment()
          ) {
            fail('cancelled', 'Google sign-in was cancelled.');
          }
        } catch {
          /* The credential callback remains the source of truth. */
        }
      });
    } catch {
      fail('failed', 'Google authentication failed.');
    }

    // Safety net: if GIS neither returns a credential nor reports the prompt
    // outcome (e.g. third-party cookies blocked), don't hang the UI forever.
    window.setTimeout(() => {
      fail('cancelled', 'Google sign-in was cancelled.');
    }, 60_000);
  });
};
