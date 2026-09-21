import React, { useCallback, useEffect, useState } from 'react';
import { useTranslation } from 'react-i18next';
import QRCode from 'qrcode';
import { useAuth } from '../../context/AuthContext';
import { useStore } from '../../context/StoreContext';
import { AccountSession, ApiError, ApiService } from '../../services/api';
import { Icon } from '../ui/Icon';
import { AnimatedModal } from '../ui/AnimatedModal';
import { formatIp, parseUserAgent } from './accountUtils';

const isStrongPassword = (value: string): boolean =>
  value.length >= 8 && /[A-Z]/.test(value) && /[a-z]/.test(value) && /[0-9]/.test(value);

function useRelativeTime() {
  const { t, i18n } = useTranslation();
  return useCallback(
    (iso: string) => {
      const diffMs = Date.now() - new Date(iso).getTime();
      const minutes = Math.max(0, Math.floor(diffMs / 60000));
      if (minutes < 1) return t('account.justNow');
      if (minutes < 60) return t('account.minutesAgo', { count: minutes });
      const hours = Math.floor(minutes / 60);
      if (hours < 24) return t('account.hoursAgo', { count: hours });
      const days = Math.floor(hours / 24);
      try {
        return new Intl.DateTimeFormat(i18n.language, { dateStyle: 'medium' }).format(new Date(iso));
      } catch {
        return t('account.daysAgo', { count: days });
      }
    },
    [t, i18n.language],
  );
}

export const SecuritySection: React.FC = () => {
  const { currentUser, refreshUser } = useAuth();
  const { showToast } = useStore();
  const { t } = useTranslation();
  const relativeTime = useRelativeTime();

  // Password modal
  const [pwOpen, setPwOpen] = useState(false);
  const [currentPw, setCurrentPw] = useState('');
  const [newPw, setNewPw] = useState('');
  const [confirmPw, setConfirmPw] = useState('');
  const [pwError, setPwError] = useState<string | null>(null);
  const [pwBusy, setPwBusy] = useState(false);

  // 2FA
  const [twofaEnabled, setTwofaEnabled] = useState(Boolean(currentUser?.twoFactorEnabled));
  const [setupOpen, setSetupOpen] = useState(false);
  const [setupSecret, setSetupSecret] = useState('');
  const [setupUri, setSetupUri] = useState('');
  const [qrDataUrl, setQrDataUrl] = useState<string | null>(null);
  const [setupCode, setSetupCode] = useState('');
  const [setupBusy, setSetupBusy] = useState(false);
  const [setupError, setSetupError] = useState<string | null>(null);
  const [backupCodes, setBackupCodes] = useState<string[] | null>(null);
  const [copiedKey, setCopiedKey] = useState(false);
  const [disableOpen, setDisableOpen] = useState(false);
  const [disablePw, setDisablePw] = useState('');
  const [disableBusy, setDisableBusy] = useState(false);

  // Sessions
  const [sessions, setSessions] = useState<AccountSession[]>([]);
  const [sessionsLoading, setSessionsLoading] = useState(true);
  const [sessionsError, setSessionsError] = useState(false);
  const [revoking, setRevoking] = useState<string | null>(null);
  const [revokeAllOpen, setRevokeAllOpen] = useState(false);
  const [revokeAllBusy, setRevokeAllBusy] = useState(false);

  const loadTwofa = useCallback(async () => {
    try {
      const status = await ApiService.getTwoFactorStatus();
      if (status) setTwofaEnabled(status.enabled);
    } catch {
      setTwofaEnabled(Boolean(currentUser?.twoFactorEnabled));
    }
  }, [currentUser?.twoFactorEnabled]);

  const loadSessions = useCallback(async () => {
    setSessionsLoading(true);
    setSessionsError(false);
    try {
      const result = await ApiService.getSessions();
      if (result) setSessions(result.sessions);
      else setSessionsError(true);
    } catch {
      setSessionsError(true);
    } finally {
      setSessionsLoading(false);
    }
  }, []);

  useEffect(() => {
    void loadTwofa();
    void loadSessions();
  }, [loadTwofa, loadSessions]);

  const handlePasswordSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (pwBusy) return;
    if (newPw !== confirmPw) {
      setPwError(t('account.passwordMismatch'));
      return;
    }
    if (!isStrongPassword(newPw)) {
      setPwError(t('account.passwordWeak'));
      return;
    }
    setPwBusy(true);
    setPwError(null);
    try {
      await ApiService.changePassword(currentPw, newPw);
      setPwOpen(false);
      setCurrentPw('');
      setNewPw('');
      setConfirmPw('');
      showToast(t('account.passwordTitle'), t('account.passwordChanged'), 'success');
    } catch (err) {
      const message = err instanceof ApiError ? err.message : t('account.passwordFailed');
      setPwError(message);
    } finally {
      setPwBusy(false);
    }
  };

  const openSetup = async () => {
    setSetupError(null);
    setSetupCode('');
    setBackupCodes(null);
    setSetupBusy(true);
    try {
      const result = await ApiService.setupTwoFactor();
      if (!result) throw new Error('setup failed');
      setSetupSecret(result.secret);
      setSetupUri(result.otpauthUrl);
      setQrDataUrl(null);
      setSetupOpen(true);
    } catch (err) {
      const message = err instanceof ApiError ? err.message : t('account.twofaFailed');
      showToast(t('account.twofaTitle'), message, 'error');
    } finally {
      setSetupBusy(false);
    }
  };

  // Render the scannable QR from the SERVER-issued otpauth URI only.
  // Dark modules on a white tile stay scannable in both app themes.
  useEffect(() => {
    if (!setupOpen || !setupUri) return;
    let cancelled = false;
    QRCode.toDataURL(setupUri, { width: 192, margin: 1, color: { dark: '#0a0f1c', light: '#ffffff' } })
      .then((url) => {
        if (!cancelled) setQrDataUrl(url);
      })
      .catch(() => {
        if (!cancelled) setQrDataUrl(null);
      });
    return () => {
      cancelled = true;
    };
  }, [setupOpen, setupUri]);

  const confirmSetup = async (e: React.FormEvent) => {
    e.preventDefault();
    if (setupBusy) return;
    setSetupBusy(true);
    setSetupError(null);
    try {
      const result = await ApiService.enableTwoFactor(setupCode.trim());
      if (!result) throw new Error('enable failed');
      setBackupCodes(result.backupCodes);
      setTwofaEnabled(true);
      await refreshUser();
      showToast(t('account.twofaTitle'), t('account.twofaEnabled'), 'success');
    } catch (err) {
      const message = err instanceof ApiError ? err.message : t('account.twofaFailed');
      setSetupError(message);
    } finally {
      setSetupBusy(false);
    }
  };

  const confirmDisable = async (e: React.FormEvent) => {
    e.preventDefault();
    if (disableBusy) return;
    setDisableBusy(true);
    try {
      await ApiService.disableTwoFactor(disablePw);
      setDisableOpen(false);
      setDisablePw('');
      setTwofaEnabled(false);
      await refreshUser();
      showToast(t('account.twofaTitle'), t('account.twofaDisabled'), 'success');
    } catch (err) {
      const message = err instanceof ApiError ? err.message : t('account.twofaFailed');
      showToast(t('account.twofaTitle'), message, 'error');
    } finally {
      setDisableBusy(false);
    }
  };

  const copyKey = async () => {
    try {
      await navigator.clipboard.writeText(setupSecret);
      setCopiedKey(true);
      window.setTimeout(() => setCopiedKey(false), 2000);
    } catch {
      /* clipboard unavailable — key remains visible for manual entry */
    }
  };

  const handleRevoke = async (id: string) => {
    if (revoking) return;
    setRevoking(id);
    try {
      await ApiService.revokeSession(id);
      setSessions((prev) => prev.filter((s) => s.id !== id));
      showToast(t('account.sessionsTitle'), t('account.sessionRevoked'), 'success');
    } catch (err) {
      const message = err instanceof ApiError ? err.message : t('account.sessionFailed');
      showToast(t('account.sessionsTitle'), message, 'error');
    } finally {
      setRevoking(null);
    }
  };

  const handleRevokeAll = async () => {
    if (revokeAllBusy) return;
    setRevokeAllBusy(true);
    try {
      await ApiService.revokeOtherSessions();
      setSessions((prev) => prev.filter((s) => s.current));
      setRevokeAllOpen(false);
      showToast(t('account.sessionsTitle'), t('account.sessionsRevoked'), 'success');
    } catch (err) {
      const message = err instanceof ApiError ? err.message : t('account.sessionFailed');
      showToast(t('account.sessionsTitle'), message, 'error');
    } finally {
      setRevokeAllBusy(false);
    }
  };

  const otherSessions = sessions.filter((s) => !s.current);

  return (
    <section className="account-card" aria-labelledby="account-security-title">
      <header className="account-card-header">
        <span className="account-card-icon" aria-hidden="true">
          <Icon name="lock" size={20} />
        </span>
        <div>
          <h3 id="account-security-title">{t('account.securityTitle')}</h3>
          <p>{t('account.securityDesc')}</p>
        </div>
      </header>

      <div className="account-security-card">
        <span className="account-security-icon" aria-hidden="true">
          <Icon name="key" size={20} />
        </span>
        <div className="account-security-text">
          <strong>{t('account.passwordTitle')}</strong>
          <p>{t('account.passwordDesc')}</p>
        </div>
        <button type="button" className="btn btn-outline btn-sm" onClick={() => setPwOpen(true)}>
          {t('account.changePassword')}
        </button>
      </div>

      <div className="account-security-card">
        <span className="account-security-icon" aria-hidden="true">
          <Icon name="shieldCheck" size={20} />
        </span>
        <div className="account-security-text">
          <strong>{t('account.twofaTitle')}</strong>
          <p>{t('account.twofaDesc')}</p>
          <p className={`account-2fa-status${twofaEnabled ? ' on' : ''}`} role="status">
            <span className="account-2fa-dot" aria-hidden="true" />
            {twofaEnabled ? t('account.enabled') : t('account.notEnabled')}
          </p>
        </div>
        {twofaEnabled ? (
          <button type="button" className="btn btn-outline btn-sm" onClick={() => setDisableOpen(true)}>
            {t('account.manage2fa')}
          </button>
        ) : (
          <button type="button" className="btn btn-primary btn-sm" disabled={setupBusy} onClick={() => void openSetup()}>
            {t('account.enable2fa')}
          </button>
        )}
      </div>

      <div className="account-security-card account-security-column">
        <div className="account-security-head">
          <span className="account-security-icon" aria-hidden="true">
            <Icon name="desktop" size={20} />
          </span>
          <div className="account-security-text">
            <strong>{t('account.sessionsTitle')}</strong>
            <p>{t('account.sessionsDesc')}</p>
          </div>
        </div>

        {sessionsLoading && (
          <div className="account-skeleton" aria-label={t('account.saving')}>
            <div className="skeleton account-skeleton-row" />
          </div>
        )}
        {!sessionsLoading && sessionsError && (
          <p className="account-muted" role="alert">
            {t('account.sessionsUnavailable')}
          </p>
        )}
        {!sessionsLoading && !sessionsError && sessions.length === 0 && (
          <p className="account-muted">{t('account.noSessions')}</p>
        )}
        {!sessionsLoading && !sessionsError && sessions.length > 0 && (
          <ul className="account-session-list">
            {sessions.map((session) => {
              const device = parseUserAgent(session.device);
              const deviceLabel =
                [device.os, device.browser].filter(Boolean).join(' • ') || t('account.unknownDevice');
              const ip = formatIp(session.ipAddress);
              const isPhone = (session.device || '').toLowerCase().includes('iphone') || (session.device || '').toLowerCase().includes('android');
              return (
                <li key={session.id} className="account-session-row">
                  <span className="account-session-icon" aria-hidden="true">
                    <Icon name={isPhone ? 'phone' : 'desktop'} size={18} />
                  </span>
                  <span className="account-session-meta">
                    <strong>
                      {deviceLabel}
                      {session.current && <span className="account-badge-current">{t('account.currentSession')}</span>}
                    </strong>
                    <span className="account-session-sub">
                      <span dir="ltr">{ip || t('account.unknownIp')}</span>
                      <span aria-hidden="true">•</span>
                      <span>
                        {t('account.signedInLabel')} {relativeTime(session.createdAt)}
                      </span>
                    </span>
                  </span>
                  {!session.current && (
                    <button
                      type="button"
                      className="btn btn-outline btn-sm account-btn-danger-ghost"
                      disabled={revoking === session.id}
                      onClick={() => void handleRevoke(session.id)}
                    >
                      {t('account.signOut')}
                    </button>
                  )}
                </li>
              );
            })}
          </ul>
        )}

        {otherSessions.length > 0 && (
          <button
            type="button"
            className="btn account-btn-danger-ghost account-signout-all"
            onClick={() => setRevokeAllOpen(true)}
          >
            <Icon name="lock" size={15} />
            {t('account.signOutAll')}
          </button>
        )}
      </div>

      {/* Change password */}
      <AnimatedModal open={pwOpen} role="dialog" ariaLabel={t('account.changePassword')}>
        <div className="account-modal">
          <h3>{t('account.changePassword')}</h3>
          <form onSubmit={(e) => void handlePasswordSubmit(e)} noValidate>
            <div className="form-group">
              <label className="form-label" htmlFor="pw-current">
                {t('account.currentPassword')}
              </label>
              <input
                id="pw-current"
                type="password"
                className="form-control"
                value={currentPw}
                onChange={(e) => setCurrentPw(e.target.value)}
                autoComplete="current-password"
              />
            </div>
            <div className="form-group">
              <label className="form-label" htmlFor="pw-new">
                {t('account.newPassword')}
              </label>
              <input
                id="pw-new"
                type="password"
                className="form-control"
                value={newPw}
                onChange={(e) => setNewPw(e.target.value)}
                autoComplete="new-password"
              />
            </div>
            <div className="form-group">
              <label className="form-label" htmlFor="pw-confirm">
                {t('account.confirmPassword')}
              </label>
              <input
                id="pw-confirm"
                type="password"
                className="form-control"
                value={confirmPw}
                onChange={(e) => setConfirmPw(e.target.value)}
                autoComplete="new-password"
              />
            </div>
            {pwError && (
              <p className="account-field-error" role="alert">
                {pwError}
              </p>
            )}
            <div className="account-modal-actions">
              <button
                type="button"
                className="btn btn-outline"
                disabled={pwBusy}
                onClick={() => {
                  setPwOpen(false);
                  setPwError(null);
                }}
              >
                {t('account.cancel')}
              </button>
              <button type="submit" className="btn btn-primary" disabled={pwBusy}>
                {pwBusy ? t('account.saving') : t('account.save')}
              </button>
            </div>
          </form>
        </div>
      </AnimatedModal>

      {/* 2FA setup / backup codes */}
      <AnimatedModal open={setupOpen} role="dialog" ariaLabel={t('account.setupTitle')}>
        <div className="account-modal account-modal-lg">
          {!backupCodes ? (
            <>
              <h3>{t('account.setupTitle')}</h3>
              <p className="account-muted">{t('account.setupStep1')}</p>
              {qrDataUrl && (
                <div className="account-2fa-qr">
                  <img src={qrDataUrl} alt={t('account.setupQrAlt')} width={192} height={192} dir="ltr" />
                </div>
              )}
              <div className="account-2fa-secret">
                <span className="account-2fa-secret-label">{t('account.setupSecret')}</span>
                <code dir="ltr">{setupSecret}</code>
                <button type="button" className="btn btn-outline btn-sm" onClick={() => void copyKey()}>
                  <Icon name={copiedKey ? 'check' : 'copy'} size={14} />
                  {t(copiedKey ? 'account.copied' : 'account.copy')}
                </button>
              </div>
              <p className="account-muted">{t('account.setupStep2')}</p>
              <form onSubmit={(e) => void confirmSetup(e)} noValidate>
                <div className="form-group">
                  <label className="form-label" htmlFor="2fa-code">
                    {t('account.codeLabel')}
                  </label>
                  <input
                    id="2fa-code"
                    type="text"
                    className="form-control font-mono"
                    value={setupCode}
                    onChange={(e) => setSetupCode(e.target.value.replace(/[^0-9]/g, '').slice(0, 6))}
                    placeholder={t('account.codePh')}
                    inputMode="numeric"
                    autoComplete="one-time-code"
                    dir="ltr"
                  />
                </div>
                {setupError && (
                  <p className="account-field-error" role="alert">
                    {setupError}
                  </p>
                )}
                <div className="account-modal-actions">
                  <button
                    type="button"
                    className="btn btn-outline"
                    disabled={setupBusy}
                    onClick={() => setSetupOpen(false)}
                  >
                    {t('account.cancel')}
                  </button>
                  <button type="submit" className="btn btn-primary" disabled={setupBusy || setupCode.length !== 6}>
                    {setupBusy ? t('account.saving') : t('account.verifyEnable')}
                  </button>
                </div>
              </form>
            </>
          ) : (
            <>
              <h3>{t('account.backupTitle')}</h3>
              <p className="account-muted">{t('account.backupDesc')}</p>
              <ul className="account-backup-codes" dir="ltr">
                {backupCodes.map((code) => (
                  <li key={code}>
                    <code>{code}</code>
                  </li>
                ))}
              </ul>
              <div className="account-modal-actions">
                <button
                  type="button"
                  className="btn btn-primary"
                  onClick={() => {
                    setSetupOpen(false);
                    setBackupCodes(null);
                  }}
                >
                  {t('account.finish')}
                </button>
              </div>
            </>
          )}
        </div>
      </AnimatedModal>

      {/* 2FA disable */}
      <AnimatedModal open={disableOpen} role="alertdialog" ariaLabel={t('account.disableTitle')}>
        <div className="account-modal">
          <h3>{t('account.disableTitle')}</h3>
          <p className="account-muted">{t('account.disableBody')}</p>
          <form onSubmit={(e) => void confirmDisable(e)} noValidate>
            <div className="form-group">
              <label className="form-label" htmlFor="2fa-disable-pw">
                {t('account.currentPassword')}
              </label>
              <input
                id="2fa-disable-pw"
                type="password"
                className="form-control"
                value={disablePw}
                onChange={(e) => setDisablePw(e.target.value)}
                autoComplete="current-password"
              />
            </div>
            <div className="account-modal-actions">
              <button type="button" className="btn btn-outline" disabled={disableBusy} onClick={() => setDisableOpen(false)}>
                {t('account.cancel')}
              </button>
              <button type="submit" className="btn account-btn-danger" disabled={disableBusy || !disablePw}>
                {t('account.disable2fa')}
              </button>
            </div>
          </form>
        </div>
      </AnimatedModal>

      {/* Revoke all */}
      <AnimatedModal open={revokeAllOpen} role="alertdialog" ariaLabel={t('account.signOutAllTitle')}>
        <div className="account-modal">
          <h3>{t('account.signOutAllTitle')}</h3>
          <p className="account-muted">{t('account.signOutAllBody')}</p>
          <div className="account-modal-actions">
            <button type="button" className="btn btn-outline" disabled={revokeAllBusy} onClick={() => setRevokeAllOpen(false)}>
              {t('account.cancel')}
            </button>
            <button type="button" className="btn account-btn-danger" disabled={revokeAllBusy} onClick={() => void handleRevokeAll()}>
              {t('account.signOutAllConfirm')}
            </button>
          </div>
        </div>
      </AnimatedModal>
    </section>
  );
};
