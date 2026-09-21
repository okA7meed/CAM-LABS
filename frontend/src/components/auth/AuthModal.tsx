import React, { useEffect, useRef, useState } from 'react';
import { useStore } from '../../context/StoreContext';
import { useAuth } from '../../context/AuthContext';
import { useTranslation } from 'react-i18next';
import { Logo } from '../layout/Logo';
import { Icon } from '../ui/Icon';
import { AnimatedModal } from '../ui/AnimatedModal';
import { ApiError } from '../../services/api';
import { authErrorMessage } from './authErrors';
import { GoogleAuthError, requestGoogleCredential } from '../../services/googleAuth';
import { InternationalPhoneInput, PhoneValue } from '../phone/InternationalPhoneInput';
import { validatePhone } from '../phone/phoneLib';

const EMAIL_PATTERN = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

const isStrongPassword = (value: string): boolean =>
  value.length >= 8 && /[A-Z]/.test(value) && /[a-z]/.test(value) && /[0-9]/.test(value);

const GoogleMark: React.FC = () => (
  <svg width="20" height="20" viewBox="0 0 24 24" aria-hidden="true" focusable="false">
    <path
      fill="#4285F4"
      d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92a5.06 5.06 0 0 1-2.2 3.32v2.77h3.57c2.08-1.92 3.27-4.74 3.27-8.1z"
    />
    <path
      fill="#34A853"
      d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84A11 11 0 0 0 12 23z"
    />
    <path
      fill="#FBBC05"
      d="M5.84 14.1a6.6 6.6 0 0 1 0-4.2V7.06H2.18a11 11 0 0 0 0 9.88l3.66-2.84z"
    />
    <path
      fill="#EA4335"
      d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15A11 11 0 0 0 2.18 7.06l3.66 2.84C6.71 7.31 9.14 5.38 12 5.38z"
    />
  </svg>
);

export const AuthModal: React.FC = () => {
  const {
    isAuthModalOpen,
    closeAuthModal,
    authModalTab,
    openAuthModal,
    openForgotPassword,
    showToast,
    setActiveView,
    activeView,
    postAuthDestination,
    setPostAuthDestination,
  } = useStore();
  const { login, register, loginWithGoogle } = useAuth();
  const { t } = useTranslation();
  const isRegister = authModalTab === 'register';

  // Login form state
  const [loginEmail, setLoginEmail] = useState('');
  const [loginPass, setLoginPass] = useState('');
  const [showLoginPass, setShowLoginPass] = useState(false);
  // NOTE: sessions are server-side opaque records with a fixed
  // SESSION_TTL_DAYS (30) lifetime. The checkbox records the standard
  // 30-day preference; it does not negotiate a different TTL with the server.
  const [keepSigned, setKeepSigned] = useState(true);

  // Register form state
  const [regName, setRegName] = useState('');
  const [regEmail, setRegEmail] = useState('');
  const [regCompany, setRegCompany] = useState('');
  const [regPhone, setRegPhone] = useState<PhoneValue>({ e164: null, national: '', country: 'EG', valid: false });
  const [regPass, setRegPass] = useState('');
  const [regConfirmPass, setRegConfirmPass] = useState('');
  const [showRegPass, setShowRegPass] = useState(false);
  const [showRegConfirmPass, setShowRegConfirmPass] = useState(false);
  const [agreeTerms, setAgreeTerms] = useState(false);

  const [isLoading, setIsLoading] = useState(false);
  const [googleBusy, setGoogleBusy] = useState(false);
  const busy = isLoading || googleBusy;

  // Second-factor challenge: set when the server answers TWO_FACTOR_REQUIRED.
  const [twoFactorRequired, setTwoFactorRequired] = useState(false);
  const [twoFactorCode, setTwoFactorCode] = useState('');

  const [fieldErrors, setFieldErrors] = useState<Record<string, string>>({});
  const [formError, setFormError] = useState<string | null>(null);

  const firstFieldRef = useRef<HTMLInputElement>(null);

  // Clear per-mode errors and move focus into the dialog when it opens.
  useEffect(() => {
    if (!isAuthModalOpen) return;
    setFieldErrors({});
    setFormError(null);
    setTwoFactorRequired(false);
    setTwoFactorCode('');
    const frame = window.requestAnimationFrame(() => {
      firstFieldRef.current?.focus({ preventScroll: true });
    });
    return () => window.cancelAnimationFrame(frame);
  }, [isAuthModalOpen, authModalTab]);

  const postAuthRedirect = (welcomeName?: string) => {
    closeAuthModal();
    showToast(
      'Authenticated',
      welcomeName ? `Welcome back to CAM LABS, ${welcomeName}!` : 'Welcome back to CAM LABS!',
      'success',
    );
    // Footer auth-gated navigation may stash a resume destination (e.g. My
    // Quotes). Honor it once, then clear so later logins fall through.
    if (postAuthDestination) {
      const destination = postAuthDestination;
      setPostAuthDestination(null);
      setActiveView(destination);
      window.scrollTo({ top: 0, behavior: 'smooth' });
      return;
    }
    // Preserve quote workflows: manufacturing + submit-quote restore their
    // server-persisted configuration after login instead of bouncing to dashboard.
    if (activeView !== 'manufacturing-request' && activeView !== 'submit-quote' && activeView !== 'quote-success') {
      setActiveView('dashboard');
      window.scrollTo({ top: 0, behavior: 'smooth' });
    }
  };

  // Maps API failures to safe, localized UI messages. Server-curated
  // messages pass through; transport/proxy failures and any legacy
  // "API error"-shaped text fall back to generic localized strings so the
  // UI can never render a blank "API error:".
  const toAuthErrorMessage = (err: unknown): string => authErrorMessage(err, t);

  const handleLoginSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (busy) return;
    const errors: Record<string, string> = {};
    if (!loginEmail.trim()) errors.loginEmail = t('auth.errRequired');
    else if (!EMAIL_PATTERN.test(loginEmail.trim())) errors.loginEmail = t('auth.errInvalidEmail');
    if (!loginPass) errors.loginPass = t('auth.errRequired');
    if (twoFactorRequired && !/^[0-9]{6,8}$/.test(twoFactorCode.trim())) errors.login2fa = t('auth.errInvalid2faCode');
    setFieldErrors(errors);
    setFormError(null);
    if (Object.keys(errors).length > 0) return;

    setIsLoading(true);
    try {
      await login(loginEmail.trim(), loginPass, twoFactorRequired ? twoFactorCode.trim() : undefined, keepSigned);
      postAuthRedirect();
    } catch (err: unknown) {
      if (err instanceof ApiError && err.code === 'TWO_FACTOR_REQUIRED') {
        setTwoFactorRequired(true);
        setFormError(t('auth.twoFactorRequired'));
        return;
      }
      const message = toAuthErrorMessage(err);
      setFormError(message);
      showToast('Authentication Failed', message, 'error');
    } finally {
      setIsLoading(false);
    }
  };

  const handleRegisterSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (busy) return;
    const errors: Record<string, string> = {};
    if (!regName.trim() || regName.trim().length < 2) errors.regName = t('auth.errRequired');
    if (!regEmail.trim()) errors.regEmail = t('auth.errRequired');
    else if (!EMAIL_PATTERN.test(regEmail.trim())) errors.regEmail = t('auth.errInvalidEmail');
    if (!regPhone.valid || !regPhone.e164) {
      const check = validatePhone(regPhone.national, regPhone.country);
      errors.regPhone =
        check.error === 'too-short'
          ? t('auth.errPhoneTooShort')
          : check.error === 'too-long'
            ? t('auth.errPhoneTooLong')
            : t('auth.errPhoneInvalidCountry');
    }
    if (!regPass) errors.regPass = t('auth.errRequired');
    else if (!isStrongPassword(regPass)) errors.regPass = t('auth.errWeakPassword');
    if (!regConfirmPass) errors.regConfirmPass = t('auth.errRequired');
    else if (regPass !== regConfirmPass) errors.regConfirmPass = t('auth.errPasswordMismatch');
    if (!agreeTerms) errors.agreeTerms = t('auth.errTermsRequired');
    setFieldErrors(errors);
    setFormError(null);
    if (Object.keys(errors).length > 0) return;

    setIsLoading(true);
    try {
      await register(regName.trim(), regEmail.trim(), regPass, regCompany.trim() || undefined, regPhone.e164 as string);
      closeAuthModal();
      showToast(
        'Account Created',
        `Welcome to CAM LABS, ${regName.trim()}! Your engineering dashboard is ready.`,
        'success',
      );
      if (activeView !== 'manufacturing-request' && activeView !== 'submit-quote' && activeView !== 'quote-success') {
        setActiveView('dashboard');
        window.scrollTo({ top: 0, behavior: 'smooth' });
      }
    } catch (err: unknown) {
      // Preserved behavior: an existing account routes the user to Sign In.
      if (err instanceof ApiError && err.status === 409) {
        openAuthModal('login');
        showToast(t('auth.accountExistsTitle'), t('auth.accountExistsDescription'), 'info');
        return;
      }
      const message = toAuthErrorMessage(err);
      setFormError(message);
      showToast('Registration Failed', message, 'error');
    } finally {
      setIsLoading(false);
    }
  };

  const handleGoogleContinue = async () => {
    if (busy) return;
    setFormError(null);
    setGoogleBusy(true);
    try {
      const credential = await requestGoogleCredential();
      await loginWithGoogle(credential, twoFactorCode.trim() || undefined);
      postAuthRedirect();
    } catch (err: unknown) {
      // Popup/account-chooser dismissal is not an error state — stay silent.
      if (err instanceof GoogleAuthError && err.code === 'cancelled') return;
      if (err instanceof ApiError && err.code === 'TWO_FACTOR_REQUIRED') {
        setTwoFactorRequired(true);
        setFormError(t('auth.twoFactorRequired'));
        return;
      }
      const message =
        err instanceof GoogleAuthError && err.code === 'unconfigured'
          ? t('auth.googleNotConfigured')
          : err instanceof GoogleAuthError
            ? t('auth.googleFailed')
            : toAuthErrorMessage(err);
      setFormError(message);
      if (!(err instanceof GoogleAuthError && err.code === 'unconfigured')) {
        showToast('Google Sign-In', message, 'error');
      } else {
        showToast('Google Sign-In', message, 'info');
      }
    } finally {
      setGoogleBusy(false);
    }
  };

  const titleId = isRegister ? 'auth-title-register' : 'auth-title-login';

  return (
    <AnimatedModal
      open={isAuthModalOpen}
      role="dialog"
      ariaLabel={isRegister ? t('auth.createYourAccount') : t('auth.welcomeBack')}
      cardClassName={`auth-modal${isRegister ? ' auth-modal-register' : ''}`}
      overlayClassName="auth-overlay"
      onOverlayMouseDown={(e) => {
        // Keep the dialog modal: only a direct backdrop press is ignored
        // (no accidental dismiss); X / Escape remain the close paths.
        if (e.target === e.currentTarget) e.stopPropagation();
      }}
    >
      <div className="auth-brand">
        <div className="auth-brand-lockup">
          <Logo />
          {/* Brand tagline is part of the logo lockup: always English, never
              translated or mirrored (the logo itself is never mirrored). */}
          <p className="auth-tagline" aria-hidden="true">
            ENGINEER&nbsp;&nbsp;MANUFACTURE&nbsp;&nbsp;INNOVATE
          </p>
        </div>
        <button
          type="button"
          className="auth-close"
          onClick={closeAuthModal}
          aria-label={t('auth.closeDialog')}
        >
          <Icon name="close" size={20} />
        </button>
      </div>

      {isRegister ? (
        <div key="register">
          <h2 id={titleId} className="auth-title">
            {t('auth.createYourAccount')}
          </h2>
          <p className="auth-subtitle">{t('auth.joinSubtitle')}</p>

          <form className="auth-form" onSubmit={handleRegisterSubmit} noValidate>
            {formError && (
              <p className="auth-form-error" role="alert">
                {formError}
              </p>
            )}

            <div className="auth-field">
              <div className="auth-input-wrap has-trailing">
                <span className="auth-input-icon" aria-hidden="true">
                  <Icon name="userRound" size={20} />
                </span>
                <input
                  ref={firstFieldRef}
                  type="text"
                  className="auth-input"
                  placeholder={t('auth.fullNamePlaceholder')}
                  aria-label={t('auth.fullName')}
                  value={regName}
                  onChange={(e) => setRegName(e.target.value)}
                  required
                  aria-required="true"
                  aria-invalid={fieldErrors.regName ? 'true' : undefined}
                  autoComplete="name"
                  name="name"
                  disabled={busy}
                />
                <span className="auth-trailing" aria-hidden="true">
                  <span className="auth-asterisk">*</span>
                </span>
              </div>
              {fieldErrors.regName && (
                <span className="auth-error" role="alert">
                  {fieldErrors.regName}
                </span>
              )}
            </div>

            <div className="auth-field">
              <div className="auth-input-wrap has-trailing">
                <span className="auth-input-icon" aria-hidden="true">
                  <Icon name="mail" size={20} />
                </span>
                <input
                  type="email"
                  className="auth-input"
                  placeholder={t('auth.workEmailPlaceholder')}
                  aria-label={t('auth.workEmail')}
                  value={regEmail}
                  onChange={(e) => setRegEmail(e.target.value)}
                  required
                  aria-required="true"
                  aria-invalid={fieldErrors.regEmail ? 'true' : undefined}
                  autoComplete="email"
                  name="email"
                  disabled={busy}
                />
                <span className="auth-trailing" aria-hidden="true">
                  <span className="auth-asterisk">*</span>
                </span>
              </div>
              {fieldErrors.regEmail && (
                <span className="auth-error" role="alert">
                  {fieldErrors.regEmail}
                </span>
              )}
            </div>

            <div className="auth-grid-2">
              <div className="auth-field">
                <div className="auth-input-wrap">
                  <span className="auth-input-icon" aria-hidden="true">
                    <Icon name="building" size={20} />
                  </span>
                  <input
                    type="text"
                    className="auth-input"
                    placeholder={t('auth.companyOptionalPlaceholder')}
                    aria-label={t('auth.companyName')}
                    value={regCompany}
                    onChange={(e) => setRegCompany(e.target.value)}
                    autoComplete="organization"
                    name="company"
                    disabled={busy}
                  />
                </div>
              </div>
              <div className="auth-field">
                <div className={fieldErrors.regPhone ? 'auth-phone-error' : undefined}>
                  <InternationalPhoneInput
                    id="auth-register-phone"
                    onChange={setRegPhone}
                    placeholder={t('auth.phonePlaceholderShort')}
                    ariaLabelledBy="auth-register-phone-label"
                  />
                  <span id="auth-register-phone-label" className="auth-sr-only">
                    {t('auth.phone')}
                  </span>
                </div>
                {fieldErrors.regPhone && (
                  <span className="auth-error" role="alert">
                    {fieldErrors.regPhone}
                  </span>
                )}
              </div>
            </div>

            <div className="auth-field">
              <div className="auth-input-wrap has-trailing">
                <span className="auth-input-icon" aria-hidden="true">
                  <Icon name="lock" size={20} />
                </span>
                <input
                  type={showRegPass ? 'text' : 'password'}
                  className="auth-input"
                  placeholder={t('auth.passwordPlaceholderShort')}
                  aria-label={t('auth.password')}
                  value={regPass}
                  onChange={(e) => setRegPass(e.target.value)}
                  required
                  aria-required="true"
                  aria-invalid={fieldErrors.regPass ? 'true' : undefined}
                  autoComplete="new-password"
                  name="new-password"
                  disabled={busy}
                />
                <span className="auth-trailing">
                  <button
                    type="button"
                    className="auth-eye"
                    onClick={() => setShowRegPass((v) => !v)}
                    aria-label={showRegPass ? t('auth.hidePassword') : t('auth.showPassword')}
                    aria-pressed={showRegPass}
                    disabled={busy}
                  >
                    <Icon name={showRegPass ? 'eyeOff' : 'eye'} size={20} />
                  </button>
                  <span className="auth-asterisk" aria-hidden="true">
                    *
                  </span>
                </span>
              </div>
              {fieldErrors.regPass && (
                <span className="auth-error" role="alert">
                  {fieldErrors.regPass}
                </span>
              )}
            </div>

            <div className="auth-field">
              <div className="auth-input-wrap has-trailing">
                <span className="auth-input-icon" aria-hidden="true">
                  <Icon name="lock" size={20} />
                </span>
                <input
                  type={showRegConfirmPass ? 'text' : 'password'}
                  className="auth-input"
                  placeholder={t('auth.confirmPasswordPlaceholder')}
                  aria-label={t('auth.confirmPassword')}
                  value={regConfirmPass}
                  onChange={(e) => setRegConfirmPass(e.target.value)}
                  required
                  aria-required="true"
                  aria-invalid={fieldErrors.regConfirmPass ? 'true' : undefined}
                  autoComplete="new-password"
                  name="confirm-password"
                  disabled={busy}
                />
                <span className="auth-trailing">
                  <button
                    type="button"
                    className="auth-eye"
                    onClick={() => setShowRegConfirmPass((v) => !v)}
                    aria-label={showRegConfirmPass ? t('auth.hidePassword') : t('auth.showPassword')}
                    aria-pressed={showRegConfirmPass}
                    disabled={busy}
                  >
                    <Icon name={showRegConfirmPass ? 'eyeOff' : 'eye'} size={20} />
                  </button>
                  <span className="auth-asterisk" aria-hidden="true">
                    *
                  </span>
                </span>
              </div>
              {fieldErrors.regConfirmPass && (
                <span className="auth-error" role="alert">
                  {fieldErrors.regConfirmPass}
                </span>
              )}
            </div>

            <div className="auth-field">
              <label className="auth-check">
                <input
                  type="checkbox"
                  checked={agreeTerms}
                  onChange={(e) => setAgreeTerms(e.target.checked)}
                  aria-invalid={fieldErrors.agreeTerms ? 'true' : undefined}
                  disabled={busy}
                />
                <span className="auth-check-box" aria-hidden="true">
                  {agreeTerms && <Icon name="check" size={13} />}
                </span>
                <span>
                  {t('auth.termsPrefix')}
                  <button
                    type="button"
                    className="auth-terms-link"
                    onClick={() => {
                      closeAuthModal();
                      setActiveView('terms');
                      window.scrollTo({ top: 0, behavior: 'smooth' });
                    }}
                  >
                    {t('auth.termsLink')}
                  </button>
                </span>
              </label>
              {fieldErrors.agreeTerms && (
                <span className="auth-error" role="alert">
                  {fieldErrors.agreeTerms}
                </span>
              )}
            </div>

            <button type="submit" className="auth-cta" disabled={busy}>
              {isLoading ? (
                <>
                  <span className="auth-spinner" aria-hidden="true" />
                  {t('auth.creatingAccount')}
                </>
              ) : (
                <>
                  {t('auth.createAccount')}
                  <span className="auth-cta-arrow" aria-hidden="true">
                    <Icon name="arrowRight" size={20} />
                  </span>
                </>
              )}
            </button>

            <div className="auth-divider" aria-hidden="true">
              <span>{t('auth.or')}</span>
            </div>

            <button
              type="button"
              className="auth-google"
              onClick={handleGoogleContinue}
              disabled={busy}
            >
              {googleBusy ? (
                <span className="auth-spinner" aria-hidden="true" />
              ) : (
                <GoogleMark />
              )}
              {t('auth.continueWithGoogle')}
            </button>

            <p className="auth-switch">
              {t('auth.haveAccount')}
              <button
                type="button"
                className="auth-link"
                onClick={() => openAuthModal('login')}
                disabled={busy}
              >
                {t('auth.signInAction')}
              </button>
            </p>
          </form>
        </div>
      ) : (
        <div key="login">
          <h2 id={titleId} className="auth-title">
            {t('auth.welcomeBack')}
          </h2>
          <p className="auth-subtitle">{t('auth.signInSubtitle')}</p>

          <form className="auth-form" onSubmit={handleLoginSubmit} noValidate>
            {formError && (
              <p className="auth-form-error" role="alert">
                {formError}
              </p>
            )}

            <div className="auth-field">
              <label className="auth-label" htmlFor="auth-login-email">
                {t('auth.workEmail')}
              </label>
              <div className="auth-input-wrap">
                <span className="auth-input-icon" aria-hidden="true">
                  <Icon name="mail" size={20} />
                </span>
                <input
                  ref={firstFieldRef}
                  id="auth-login-email"
                  type="email"
                  className="auth-input"
                  placeholder={t('auth.emailPlaceholder')}
                  value={loginEmail}
                  onChange={(e) => setLoginEmail(e.target.value)}
                  required
                  aria-required="true"
                  aria-invalid={fieldErrors.loginEmail ? 'true' : undefined}
                  aria-describedby={fieldErrors.loginEmail ? 'auth-login-email-error' : undefined}
                  autoComplete="email"
                  name="email"
                  disabled={busy}
                />
              </div>
              {fieldErrors.loginEmail && (
                <span id="auth-login-email-error" className="auth-error" role="alert">
                  {fieldErrors.loginEmail}
                </span>
              )}
            </div>

            <div className="auth-field">
              <label className="auth-label" htmlFor="auth-login-password">
                {t('auth.password')}
              </label>
              <div className="auth-input-wrap has-trailing">
                <span className="auth-input-icon" aria-hidden="true">
                  <Icon name="lock" size={20} />
                </span>
                <input
                  id="auth-login-password"
                  type={showLoginPass ? 'text' : 'password'}
                  className="auth-input"
                  placeholder={t('auth.enterPassword')}
                  value={loginPass}
                  onChange={(e) => setLoginPass(e.target.value)}
                  required
                  aria-required="true"
                  aria-invalid={fieldErrors.loginPass ? 'true' : undefined}
                  aria-describedby={fieldErrors.loginPass ? 'auth-login-password-error' : undefined}
                  autoComplete="current-password"
                  name="password"
                  disabled={busy}
                />
                <span className="auth-trailing">
                  <button
                    type="button"
                    className="auth-eye"
                    onClick={() => setShowLoginPass((v) => !v)}
                    aria-label={showLoginPass ? t('auth.hidePassword') : t('auth.showPassword')}
                    aria-pressed={showLoginPass}
                    disabled={busy}
                  >
                    <Icon name={showLoginPass ? 'eyeOff' : 'eye'} size={20} />
                  </button>
                </span>
              </div>
              {fieldErrors.loginPass && (
                <span id="auth-login-password-error" className="auth-error" role="alert">
                  {fieldErrors.loginPass}
                </span>
              )}
            </div>

            <div className="auth-forgot-row">
              <button
                type="button"
                className="auth-link"
                onClick={openForgotPassword}
                disabled={busy}
              >
                {t('auth.forgotPassword')}
              </button>
            </div>

            {twoFactorRequired && (
              <div className="auth-field">
                <label className="auth-label" htmlFor="auth-login-2fa">
                  {t('auth.twoFactorCode')}
                </label>
                <div className="auth-input-wrap">
                  <span className="auth-input-icon" aria-hidden="true">
                    <Icon name="shieldCheck" size={20} />
                  </span>
                  <input
                    id="auth-login-2fa"
                    type="text"
                    className="auth-input"
                    placeholder={t('auth.twoFactorPlaceholder')}
                    value={twoFactorCode}
                    onChange={(e) => setTwoFactorCode(e.target.value.replace(/[^0-9]/g, '').slice(0, 8))}
                    inputMode="numeric"
                    autoComplete="one-time-code"
                    dir="ltr"
                    disabled={busy}
                    aria-invalid={fieldErrors.login2fa ? 'true' : undefined}
                    aria-describedby={fieldErrors.login2fa ? 'auth-login-2fa-error' : undefined}
                  />
                </div>
                {fieldErrors.login2fa && (
                  <span id="auth-login-2fa-error" className="auth-error" role="alert">
                    {fieldErrors.login2fa}
                  </span>
                )}
              </div>
            )}

            <div className="auth-field">
              <label className="auth-check">
                <input
                  type="checkbox"
                  checked={keepSigned}
                  onChange={(e) => setKeepSigned(e.target.checked)}
                  disabled={busy}
                />
                <span className="auth-check-box" aria-hidden="true">
                  {keepSigned && <Icon name="check" size={13} />}
                </span>
                <span>{t('auth.keepSignedIn')}</span>
              </label>
            </div>

            <button type="submit" className="auth-cta" disabled={busy}>
              {isLoading ? (
                <>
                  <span className="auth-spinner" aria-hidden="true" />
                  {t('auth.authenticating')}
                </>
              ) : (
                <>
                  {t('auth.signInToCam')}
                  <span className="auth-cta-arrow" aria-hidden="true">
                    <Icon name="arrowRight" size={20} />
                  </span>
                </>
              )}
            </button>

            <div className="auth-divider" aria-hidden="true">
              <span>{t('auth.or')}</span>
            </div>

            <p className="auth-switch">
              {t('auth.noAccount')}
              <button
                type="button"
                className="auth-link"
                onClick={() => openAuthModal('register')}
                disabled={busy}
              >
                {t('auth.register')}
              </button>
            </p>
          </form>
        </div>
      )}
    </AnimatedModal>
  );
};
