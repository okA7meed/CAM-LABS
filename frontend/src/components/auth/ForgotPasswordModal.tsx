import React, { useEffect, useRef, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { useStore } from '../../context/StoreContext';
import { RequiredMark } from '../ui/FieldLabel';
import { AnimatedModal } from '../ui/AnimatedModal';
import { Icon } from '../ui/Icon';
import { Logo } from '../layout/Logo';
import { ApiError, ApiService } from '../../services/api';

type ResetStep = 'email' | 'code' | 'password' | 'success';

const OTP_LENGTH = 6;
/** Mirrors PASSWORD_RESET_RESEND_COOLDOWN_SECONDS (backend default). UX only. */
const RESEND_COOLDOWN_SECONDS = 60;
/** Mirrors PASSWORD_RESET_OTP_TTL_MINUTES (backend default). Display only. */
const CODE_TTL_SECONDS = 10 * 60;

const EMAIL_PATTERN = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

const formatCountdown = (totalSeconds: number): string => {
  const clamped = Math.max(0, totalSeconds);
  const minutes = Math.floor(clamped / 60);
  const seconds = clamped % 60;
  return `${String(minutes).padStart(2, '0')}:${String(seconds).padStart(2, '0')}`;
};

/** Presentation-only masking, e.g. ahmed@gmail.com → a••••@gmail.com. */
export const maskEmail = (email: string): string => {
  const at = email.indexOf('@');
  if (at <= 0) return email;
  const local = email.slice(0, at);
  const domain = email.slice(at + 1);
  return `${local.charAt(0)}••••@${domain}`;
};

const mapVerifyError = (error: unknown, t: (key: string) => string): string => {
  if (error instanceof ApiError) {
    switch (error.code) {
      case 'INVALID_RESET_CODE':
        return t('auth.errCodeIncorrect');
      case 'RESET_CODE_EXPIRED':
        return t('auth.errCodeExpired');
      case 'RESET_CODE_LOCKED':
        return t('auth.errTooManyAttempts');
      case 'AUTH_RATE_LIMIT':
        return error.message;
      default:
        return t('auth.errNetwork');
    }
  }
  return t('auth.errNetwork');
};

export const ForgotPasswordModal: React.FC = () => {
  const { t } = useTranslation();
  const { isForgotPasswordOpen, closeForgotPassword, openAuthModal } = useStore();

  const [step, setStep] = useState<ResetStep>('email');
  const [email, setEmail] = useState('');
  const [digits, setDigits] = useState<string[]>(() => Array(OTP_LENGTH).fill(''));
  // Transient in-memory only: never localStorage, never URL, never analytics.
  const [resetToken, setResetToken] = useState<string | null>(null);
  const [newPassword, setNewPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [showNewPassword, setShowNewPassword] = useState(false);
  const [showConfirmPassword, setShowConfirmPassword] = useState(false);

  const [emailError, setEmailError] = useState<string | null>(null);
  const [codeError, setCodeError] = useState<string | null>(null);
  const [passwordError, setPasswordError] = useState<string | null>(null);
  const [status, setStatus] = useState<string | null>(null);

  const [sending, setSending] = useState(false);
  const [verifying, setVerifying] = useState(false);
  const [resetting, setResetting] = useState(false);

  const [cooldownEndsAt, setCooldownEndsAt] = useState<number | null>(null);
  const [codeExpiresAt, setCodeExpiresAt] = useState<number | null>(null);
  const [now, setNow] = useState(() => Date.now());

  const emailRef = useRef<HTMLInputElement>(null);
  const otpRefs = useRef<Array<HTMLInputElement | null>>([]);
  const newPasswordRef = useRef<HTMLInputElement>(null);

  const cooldownLeft = cooldownEndsAt ? Math.max(0, Math.ceil((cooldownEndsAt - now) / 1000)) : 0;
  const codeTtlLeft = codeExpiresAt ? Math.max(0, Math.ceil((codeExpiresAt - now) / 1000)) : 0;

  // One-second ticker only while a countdown is live.
  useEffect(() => {
    if (!isForgotPasswordOpen) return;
    if (cooldownLeft <= 0 && codeTtlLeft <= 0) return;
    const timer = window.setInterval(() => setNow(Date.now()), 1000);
    return () => window.clearInterval(timer);
  }, [isForgotPasswordOpen, cooldownLeft, codeTtlLeft]);

  // Focus the primary control whenever the dialog opens or the step changes.
  useEffect(() => {
    if (!isForgotPasswordOpen) return;
    const frame = window.requestAnimationFrame(() => {
      if (step === 'email') emailRef.current?.focus({ preventScroll: true });
      else if (step === 'code') otpRefs.current[0]?.focus({ preventScroll: true });
      else if (step === 'password') newPasswordRef.current?.focus({ preventScroll: true });
    });
    return () => window.cancelAnimationFrame(frame);
  }, [isForgotPasswordOpen, step]);

  const secureClear = () => {
    setStep('email');
    setEmail('');
    setDigits(Array(OTP_LENGTH).fill(''));
    setResetToken(null);
    setNewPassword('');
    setConfirmPassword('');
    setShowNewPassword(false);
    setShowConfirmPassword(false);
    setEmailError(null);
    setCodeError(null);
    setPasswordError(null);
    setStatus(null);
    setSending(false);
    setVerifying(false);
    setResetting(false);
    setCooldownEndsAt(null);
    setCodeExpiresAt(null);
  };

  const handleClose = () => {
    secureClear();
    closeForgotPassword();
  };

  const handleBackToSignIn = () => {
    secureClear();
    closeForgotPassword();
    openAuthModal('login');
  };

  const sendCode = async (isResend: boolean) => {
    if (sending) return;
    const normalized = email.trim();
    if (!EMAIL_PATTERN.test(normalized)) {
      setEmailError(t('auth.errInvalidEmail'));
      return;
    }
    setEmailError(null);
    setCodeError(null);
    setSending(true);
    try {
      // Public response is generic by design (anti-enumeration); either way
      // the user proceeds to the code step.
      await ApiService.forgotPassword(normalized);
      const sentAt = Date.now();
      setCooldownEndsAt(sentAt + RESEND_COOLDOWN_SECONDS * 1000);
      setCodeExpiresAt(sentAt + CODE_TTL_SECONDS * 1000);
      setDigits(Array(OTP_LENGTH).fill(''));
      setCodeError(null);
      setStatus(t(isResend ? 'auth.codeResent' : 'auth.codeSent'));
      setStep('code');
    } catch (error) {
      if (error instanceof ApiError && error.code === 'AUTH_RATE_LIMIT') {
        setEmailError(error.message);
      } else {
        setEmailError(t('auth.errNetwork'));
      }
    } finally {
      setSending(false);
    }
  };

  const handleVerify = async (e: React.FormEvent) => {
    e.preventDefault();
    if (verifying) return;
    const code = digits.join('');
    if (!/^[0-9]{6}$/.test(code)) {
      setCodeError(t('auth.errInvalidCode'));
      return;
    }
    setCodeError(null);
    setVerifying(true);
    try {
      const result = await ApiService.verifyResetCode(email.trim(), code);
      if (!result) throw new Error('empty response');
      setResetToken(result.resetToken);
      setStatus(t('auth.codeVerified'));
      setStep('password');
    } catch (error) {
      setCodeError(mapVerifyError(error, t));
    } finally {
      setVerifying(false);
    }
  };

  const handleResetPassword = async (e: React.FormEvent) => {
    e.preventDefault();
    if (resetting || !resetToken) return;
    if (!newPassword) {
      setPasswordError(t('auth.errRequired'));
      return;
    }
    if (newPassword.length < 8 || !/[A-Z]/.test(newPassword) || !/[a-z]/.test(newPassword) || !/[0-9]/.test(newPassword)) {
      setPasswordError(t('auth.errWeakPassword'));
      return;
    }
    if (newPassword !== confirmPassword) {
      setPasswordError(t('auth.errPasswordMismatch'));
      return;
    }
    setPasswordError(null);
    setResetting(true);
    try {
      await ApiService.resetPassword(resetToken, newPassword, confirmPassword);
      // The authorization is consumed server-side; drop our copy immediately.
      setResetToken(null);
      setNewPassword('');
      setConfirmPassword('');
      setStep('success');
    } catch (error) {
      if (error instanceof ApiError && error.code === 'WEAK_PASSWORD') {
        setPasswordError(t('auth.errWeakPassword'));
      } else if (error instanceof ApiError && error.code === 'INVALID_RESET_TOKEN') {
        // Flow is dead — restart from email with the same address kept.
        setResetToken(null);
        setPasswordError(null);
        setStep('email');
        setEmailError(t('auth.errResetFailed'));
      } else if (error instanceof ApiError && error.code === 'AUTH_RATE_LIMIT') {
        setPasswordError(error.message);
      } else {
        setPasswordError(t('auth.errNetwork'));
      }
    } finally {
      setResetting(false);
    }
  };

  const setDigitAt = (index: number, value: string) => {
    setDigits((prev) => {
      const next = [...prev];
      next[index] = value;
      return next;
    });
  };

  const handleOtpChange = (index: number, rawValue: string) => {
    const cleaned = rawValue.replace(/[^0-9]/g, '');
    if (!cleaned) {
      setDigitAt(index, '');
      return;
    }
    // Paste / autofill of several digits: distribute from this box onward.
    const chars = cleaned.split('').slice(0, OTP_LENGTH - index);
    setDigits((prev) => {
      const next = [...prev];
      chars.forEach((char, offset) => {
        next[index + offset] = char;
      });
      return next;
    });
    const focusIndex = Math.min(index + chars.length, OTP_LENGTH - 1);
    otpRefs.current[focusIndex]?.focus();
  };

  const handleOtpKeyDown = (index: number, e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key === 'Backspace' && !digits[index] && index > 0) {
      e.preventDefault();
      otpRefs.current[index - 1]?.focus();
    } else if (e.key === 'ArrowLeft' && index > 0) {
      e.preventDefault();
      otpRefs.current[index - 1]?.focus();
    } else if (e.key === 'ArrowRight' && index < OTP_LENGTH - 1) {
      e.preventDefault();
      otpRefs.current[index + 1]?.focus();
    } else if (e.key === 'Home') {
      e.preventDefault();
      otpRefs.current[0]?.focus();
    } else if (e.key === 'End') {
      e.preventDefault();
      otpRefs.current[OTP_LENGTH - 1]?.focus();
    }
  };

  const handleOtpPaste = (index: number, e: React.ClipboardEvent<HTMLInputElement>) => {
    const text = e.clipboardData.getData('text').replace(/[^0-9]/g, '');
    if (!text) return;
    e.preventDefault();
    const chars = text.split('').slice(0, OTP_LENGTH - index);
    setDigits((prev) => {
      const next = [...prev];
      chars.forEach((char, offset) => {
        next[index + offset] = char;
      });
      return next;
    });
    otpRefs.current[Math.min(index + chars.length, OTP_LENGTH - 1)]?.focus();
  };

  const stepLabel =
    step === 'email'
      ? t('auth.resetPassword')
      : step === 'code'
        ? t('auth.verifyTitle')
        : step === 'password'
          ? t('auth.newPasswordTitle')
          : t('auth.resetSuccessTitle');

  return (
    <AnimatedModal
      open={isForgotPasswordOpen}
      role="dialog"
      ariaLabel={stepLabel}
      cardClassName="auth-modal auth-modal-forgot"
      overlayClassName="auth-overlay"
    >
      <div className="auth-brand">
        <div className="auth-brand-lockup">
          <Logo />
          <p className="auth-tagline" aria-hidden="true">
            ENGINEER&nbsp;&nbsp;MANUFACTURE&nbsp;&nbsp;INNOVATE
          </p>
        </div>
        <button type="button" className="auth-close" onClick={handleClose} aria-label={t('auth.closeDialog')}>
          <Icon name="close" size={20} />
        </button>
      </div>

      {step === 'email' && (
        <div key="fp-email">
          <h2 className="auth-title">{t('auth.resetPassword')}</h2>
          <p className="auth-subtitle">{t('auth.resetSubtitle')}</p>
          <form className="auth-form" onSubmit={(e) => { e.preventDefault(); void sendCode(false); }} noValidate>
            <div className="auth-field">
              <label className="auth-label" htmlFor="fp-email">
                {t('auth.workEmail')}
              </label>
              <div className="auth-input-wrap">
                <span className="auth-input-icon" aria-hidden="true">
                  <Icon name="mail" size={20} />
                </span>
                <input
                  ref={emailRef}
                  id="fp-email"
                  type="email"
                  className="auth-input"
                  placeholder={t('auth.emailPlaceholder')}
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  required
                  aria-required="true"
                  aria-invalid={emailError ? 'true' : undefined}
                  aria-describedby={emailError ? 'fp-email-error' : undefined}
                  autoComplete="email"
                  name="email"
                  disabled={sending}
                />
              </div>
              {emailError && (
                <span id="fp-email-error" className="auth-error" role="alert">
                  {emailError}
                </span>
              )}
            </div>
            <button type="submit" className="auth-cta" disabled={sending}>
              {sending ? (
                <>
                  <span className="auth-spinner" aria-hidden="true" />
                  {t('auth.sendingCode')}
                </>
              ) : (
                <>
                  {t('auth.sendCode')}
                  <span className="auth-cta-arrow" aria-hidden="true">
                    <Icon name="arrowRight" size={20} />
                  </span>
                </>
              )}
            </button>
            <p className="auth-switch">
              <button type="button" className="auth-link" onClick={handleBackToSignIn} disabled={sending}>
                {t('auth.backToSignIn')}
              </button>
            </p>
          </form>
        </div>
      )}

      {step === 'code' && (
        <div key="fp-code">
          <h2 className="auth-title">{t('auth.verifyTitle')}</h2>
          <p className="auth-subtitle">
            {t('auth.verifySubtitle')}
            <br />
            <strong className="fp-masked-email">{maskEmail(email.trim())}</strong>
          </p>
          {status && (
            <p className="fp-status" role="status">
              {status}
            </p>
          )}
          <form className="auth-form" onSubmit={handleVerify} noValidate>
            {/* LTR isolate: digit order must equal submission order in RTL too. */}
            <div className="fp-otp-group" dir="ltr" role="group" aria-label={t('auth.otpLabel')}>
              {digits.map((digit, index) => (
                <input
                  // eslint-disable-next-line react/no-array-index-key
                  key={index}
                  ref={(el) => {
                    otpRefs.current[index] = el;
                  }}
                  type="text"
                  inputMode="numeric"
                  autoComplete={index === 0 ? 'one-time-code' : 'off'}
                  pattern="[0-9]*"
                  maxLength={OTP_LENGTH}
                  className="fp-otp-cell"
                  value={digit}
                  onChange={(e) => handleOtpChange(index, e.target.value)}
                  onKeyDown={(e) => handleOtpKeyDown(index, e)}
                  onPaste={(e) => handleOtpPaste(index, e)}
                  onFocus={(e) => e.target.select()}
                  aria-label={`${t('auth.otpLabel')} ${index + 1}`}
                  aria-invalid={codeError ? 'true' : undefined}
                  disabled={verifying}
                />
              ))}
            </div>
            {codeError && (
              <span className="auth-error fp-otp-error" role="alert">
                {codeError}
              </span>
            )}
            <p className="fp-expiry" role="timer">
              {t('auth.codeExpiresIn', { time: formatCountdown(codeTtlLeft) })}
            </p>
            <button type="submit" className="auth-cta" disabled={verifying}>
              {verifying ? (
                <>
                  <span className="auth-spinner" aria-hidden="true" />
                  {t('auth.verifying')}
                </>
              ) : (
                <>
                  {t('auth.verifyCode')}
                  <span className="auth-cta-arrow" aria-hidden="true">
                    <Icon name="arrowRight" size={20} />
                  </span>
                </>
              )}
            </button>
            <div className="fp-resend-row">
              <span className="fp-resend-prompt">{t('auth.noCode')}</span>
              {cooldownLeft > 0 ? (
                <span className="fp-resend-wait">
                  {t('auth.resendIn', { time: formatCountdown(cooldownLeft) })}
                </span>
              ) : (
                <button
                  type="button"
                  className="auth-link"
                  onClick={() => void sendCode(true)}
                  disabled={sending || verifying}
                >
                  {sending ? t('auth.resending') : t('auth.resendCode')}
                </button>
              )}
            </div>
          </form>
        </div>
      )}

      {step === 'password' && (
        <div key="fp-password">
          <h2 className="auth-title">{t('auth.newPasswordTitle')}</h2>
          <p className="auth-subtitle">{t('auth.newPasswordSubtitle')}</p>
          <form className="auth-form" onSubmit={handleResetPassword} noValidate>
            <div className="auth-field">
              <label className="auth-label" htmlFor="fp-new-password">
                {t('auth.newPassword')}
                <RequiredMark />
              </label>
              <div className="auth-input-wrap has-trailing">
                <span className="auth-input-icon" aria-hidden="true">
                  <Icon name="lock" size={20} />
                </span>
                <input
                  ref={newPasswordRef}
                  id="fp-new-password"
                  type={showNewPassword ? 'text' : 'password'}
                  className="auth-input"
                  placeholder={t('auth.newPasswordPlaceholder')}
                  value={newPassword}
                  onChange={(e) => setNewPassword(e.target.value)}
                  required
                  aria-required="true"
                  aria-invalid={passwordError ? 'true' : undefined}
                  aria-describedby={passwordError ? 'fp-password-error' : 'fp-password-hint'}
                  autoComplete="new-password"
                  name="new-password"
                  disabled={resetting}
                />
                <span className="auth-trailing">
                  <button
                    type="button"
                    className="auth-eye"
                    onClick={() => setShowNewPassword((v) => !v)}
                    aria-label={showNewPassword ? t('auth.hidePassword') : t('auth.showPassword')}
                    aria-pressed={showNewPassword}
                    disabled={resetting}
                  >
                    <Icon name={showNewPassword ? 'eyeOff' : 'eye'} size={20} />
                  </button>
                </span>
              </div>
              <span id="fp-password-hint" className="fp-hint">
                {t('auth.passwordHint')}
              </span>
            </div>
            <div className="auth-field">
              <label className="auth-label" htmlFor="fp-confirm-password">
                {t('auth.confirmNewPassword')}
                <RequiredMark />
              </label>
              <div className="auth-input-wrap has-trailing">
                <span className="auth-input-icon" aria-hidden="true">
                  <Icon name="lock" size={20} />
                </span>
                <input
                  id="fp-confirm-password"
                  type={showConfirmPassword ? 'text' : 'password'}
                  className="auth-input"
                  placeholder={t('auth.confirmNewPlaceholder')}
                  value={confirmPassword}
                  onChange={(e) => setConfirmPassword(e.target.value)}
                  required
                  aria-required="true"
                  aria-invalid={passwordError ? 'true' : undefined}
                  aria-describedby={passwordError ? 'fp-password-error' : undefined}
                  autoComplete="new-password"
                  name="confirm-password"
                  disabled={resetting}
                />
                <span className="auth-trailing">
                  <button
                    type="button"
                    className="auth-eye"
                    onClick={() => setShowConfirmPassword((v) => !v)}
                    aria-label={showConfirmPassword ? t('auth.hidePassword') : t('auth.showPassword')}
                    aria-pressed={showConfirmPassword}
                    disabled={resetting}
                  >
                    <Icon name={showConfirmPassword ? 'eyeOff' : 'eye'} size={20} />
                  </button>
                </span>
              </div>
              {passwordError && (
                <span id="fp-password-error" className="auth-error" role="alert">
                  {passwordError}
                </span>
              )}
            </div>
            <button type="submit" className="auth-cta" disabled={resetting}>
              {resetting ? (
                <>
                  <span className="auth-spinner" aria-hidden="true" />
                  {t('auth.resetting')}
                </>
              ) : (
                <>
                  {t('auth.resetPasswordAction')}
                  <span className="auth-cta-arrow" aria-hidden="true">
                    <Icon name="arrowRight" size={20} />
                  </span>
                </>
              )}
            </button>
          </form>
        </div>
      )}

      {step === 'success' && (
        <div key="fp-success" className="fp-success">
          <div className="fp-success-icon" aria-hidden="true">
            <Icon name="check" size={28} />
          </div>
          <h2 className="auth-title fp-success-title">{t('auth.resetSuccessTitle')}</h2>
          <p className="auth-subtitle fp-success-subtitle">{t('auth.resetSuccessBody')}</p>
          <button type="button" className="auth-cta" onClick={handleBackToSignIn}>
            {t('auth.backToSignIn')}
            <span className="auth-cta-arrow" aria-hidden="true">
              <Icon name="arrowRight" size={20} />
            </span>
          </button>
        </div>
      )}
    </AnimatedModal>
  );
};
