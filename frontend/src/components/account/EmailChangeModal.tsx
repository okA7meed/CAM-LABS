import React, { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { useAuth } from '../../context/AuthContext';
import { useStore } from '../../context/StoreContext';
import { ApiError, ApiService } from '../../services/api';
import { AnimatedModal } from '../ui/AnimatedModal';
import { Icon } from '../ui/Icon';

const EMAIL_PATTERN = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

const CODE_TO_KEY: Record<string, string> = {
  EMAIL_TAKEN: 'account.emailTaken',
  EMAIL_UNCHANGED: 'account.emailUnchanged',
  INVALID_EMAIL: 'account.emailInvalid',
  INVALID_CURRENT_PASSWORD: 'account.emailPasswordWrong',
  INVALID_EMAIL_CODE: 'account.emailCodeWrong',
  EMAIL_CODE_EXPIRED: 'account.emailCodeExpired',
  EMAIL_CODE_LOCKED: 'account.emailCodeLocked',
  EMAIL_SEND_FAILED: 'account.emailSendFailed',
};

/**
 * Verified work-email change. Step 1 collects the new address (+ current
 * password for password accounts) and mails a 6-digit OTP to the NEW
 * address; step 2 verifies it and the login email swaps atomically.
 * The login email is never written directly from client input.
 */
export const EmailChangeModal: React.FC<{ open: boolean; onClose: () => void }> = ({ open, onClose }) => {
  const { currentUser, refreshUser } = useAuth();
  const { showToast } = useStore();
  const { t } = useTranslation();

  const [step, setStep] = useState<1 | 2>(1);
  const [newEmail, setNewEmail] = useState('');
  const [password, setPassword] = useState('');
  const [code, setCode] = useState('');
  const [obfuscated, setObfuscated] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  if (!open) return null;
  const needsPassword = currentUser?.hasPassword !== false;

  const mapError = (err: unknown, fallback: string): string => {
    if (err instanceof ApiError && err.code && CODE_TO_KEY[err.code]) return t(CODE_TO_KEY[err.code]);
    return err instanceof ApiError ? err.message : fallback;
  };

  const close = () => {
    setStep(1);
    setNewEmail('');
    setPassword('');
    setCode('');
    setError(null);
    onClose();
  };

  const handleRequest = async (e: React.FormEvent) => {
    e.preventDefault();
    if (busy) return;
    if (!EMAIL_PATTERN.test(newEmail.trim())) {
      setError(t('account.emailInvalid'));
      return;
    }
    setBusy(true);
    setError(null);
    try {
      const result = await ApiService.requestEmailChange(newEmail.trim(), needsPassword ? password : undefined);
      if (!result) throw new Error('request failed');
      setObfuscated(result.obfuscatedEmail);
      setStep(2);
    } catch (err) {
      setError(mapError(err, t('account.emailChangeFailed')));
    } finally {
      setBusy(false);
    }
  };

  const handleVerify = async (e: React.FormEvent) => {
    e.preventDefault();
    if (busy) return;
    setBusy(true);
    setError(null);
    try {
      const result = await ApiService.verifyEmailChange(code.trim());
      if (!result) throw new Error('verify failed');
      await refreshUser();
      showToast(t('account.workEmail'), t('account.emailChanged'), 'success');
      close();
    } catch (err) {
      setError(mapError(err, t('account.emailChangeFailed')));
    } finally {
      setBusy(false);
    }
  };

  return (
    <AnimatedModal open={open} role="dialog" ariaLabel={t('account.emailChangeTitle')}>
      <div className="account-modal">
        <h3>{t('account.emailChangeTitle')}</h3>
        {step === 1 ? (
          <>
            <p className="account-muted">{t('account.emailChangeIntro')}</p>
            <form onSubmit={(e) => void handleRequest(e)} noValidate>
              <div className="form-group">
                <label className="form-label" htmlFor="email-change-new">
                  {t('account.newEmail')}
                </label>
                <input
                  id="email-change-new"
                  type="email"
                  className="form-control"
                  value={newEmail}
                  onChange={(e) => setNewEmail(e.target.value)}
                  autoComplete="email"
                  dir="ltr"
                />
              </div>
              {needsPassword && (
                <div className="form-group">
                  <label className="form-label" htmlFor="email-change-password">
                    {t('account.currentPassword')}
                  </label>
                  <input
                    id="email-change-password"
                    type="password"
                    className="form-control"
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                    autoComplete="current-password"
                  />
                </div>
              )}
              {error && (
                <p className="account-field-error" role="alert">
                  {error}
                </p>
              )}
              <div className="account-modal-actions">
                <button type="button" className="btn btn-outline" disabled={busy} onClick={close}>
                  {t('account.cancel')}
                </button>
                <button type="submit" className="btn btn-primary" disabled={busy}>
                  {busy ? t('account.saving') : t('account.sendCode')}
                </button>
              </div>
            </form>
          </>
        ) : (
          <>
            <p className="account-muted">{t('account.emailCodeSent', { email: obfuscated })}</p>
            <form onSubmit={(e) => void handleVerify(e)} noValidate>
              <div className="form-group">
                <label className="form-label" htmlFor="email-change-code">
                  {t('account.codeLabel')}
                </label>
                <input
                  id="email-change-code"
                  type="text"
                  className="form-control font-mono"
                  value={code}
                  onChange={(e) => setCode(e.target.value.replace(/[^0-9]/g, '').slice(0, 6))}
                  placeholder={t('account.codePh')}
                  inputMode="numeric"
                  autoComplete="one-time-code"
                  dir="ltr"
                />
              </div>
              {error && (
                <p className="account-field-error" role="alert">
                  {error}
                </p>
              )}
              <div className="account-modal-actions">
                <button
                  type="button"
                  className="btn btn-outline"
                  disabled={busy}
                  onClick={() => {
                    setStep(1);
                    setError(null);
                  }}
                >
                  {t('account.backToEdit')}
                </button>
                <button type="submit" className="btn btn-primary" disabled={busy || code.trim().length !== 6}>
                  <Icon name="check" size={15} />
                  {busy ? t('account.saving') : t('account.verifyChange')}
                </button>
              </div>
            </form>
          </>
        )}
      </div>
    </AnimatedModal>
  );
};
