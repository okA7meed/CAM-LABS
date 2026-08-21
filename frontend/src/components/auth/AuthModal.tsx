import React, { useState } from 'react';
import { useStore } from '../../context/StoreContext';
import { useAuth } from '../../context/AuthContext';
import { useTranslation } from 'react-i18next';
import { Icon } from '../ui/Icon';
import { RequiredMark, OptionalMark } from '../ui/FieldLabel';

export const AuthModal: React.FC = () => {
  const { isAuthModalOpen, closeAuthModal, authModalTab, openAuthModal, openForgotPassword, showToast, setActiveView, activeView } = useStore();
  const { login, register } = useAuth();
  const { t } = useTranslation();

  // Login form state
  const [loginEmail, setLoginEmail] = useState('');
  const [loginPass, setLoginPass] = useState('');
  const [showLoginPass, setShowLoginPass] = useState(false);

  // Register form state
  const [regName, setRegName] = useState('');
  const [regEmail, setRegEmail] = useState('');
  const [regCompany, setRegCompany] = useState('');
  const [regPhone, setRegPhone] = useState('');
  const [regPass, setRegPass] = useState('');
  const [regConfirmPass, setRegConfirmPass] = useState('');
  const [showRegPass, setShowRegPass] = useState(false);
  const [showRegConfirmPass, setShowRegConfirmPass] = useState(false);
  const [agreeTerms, setAgreeTerms] = useState(false);

  const [isLoading, setIsLoading] = useState(false);

  if (!isAuthModalOpen) return null;

  // Password strength calculation
  const getPasswordStrength = () => {
    let score = 0;
    if (regPass.length >= 8) score++;
    if (/[A-Z]/.test(regPass)) score++;
    if (/[0-9]/.test(regPass)) score++;
    if (/[^A-Za-z0-9]/.test(regPass)) score++;

    let color = '#EF4444';
    let text = 'Weak';
    if (score === 2 || score === 3) {
      color = '#F59E0B';
      text = 'Medium (Good)';
    } else if (score === 4) {
      color = '#10B981';
      text = 'Strong (Enterprise Grade)';
    }
    return { width: `${(score / 4) * 100}%`, color, text: regPass ? text : 'None' };
  };

  const strength = getPasswordStrength();

  const handleLoginSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!loginEmail || !loginPass) {
      showToast('Validation Error', 'Please enter your email and password.', 'error');
      return;
    }

    setIsLoading(true);
    try {
      await login(loginEmail, loginPass);
      closeAuthModal();
      showToast('Authenticated', 'Welcome back to CAM LABS!', 'success');
      if (activeView !== 'manufacturing-request') {
        setActiveView('dashboard');
        window.scrollTo({ top: 0, behavior: 'smooth' });
      }
    } catch (err: any) {
      showToast('Authentication Failed', err?.message || 'Invalid credentials', 'error');
    } finally {
      setIsLoading(false);
    }
  };

  const handleRegisterSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!regName || !regEmail || !regPhone || !regPass) {
      showToast('Registration Error', 'Please complete all required fields.', 'error');
      return;
    }

    if (!/^(?=.*\d)[0-9+() -]{7,40}$/.test(regPhone)) {
      showToast('Registration Error', 'Please enter a valid phone number.', 'error');
      return;
    }

    if (regPass !== regConfirmPass) {
      showToast('Password Mismatch', 'Passwords do not match.', 'error');
      return;
    }

    if (!agreeTerms) {
      showToast('Terms Required', 'Please accept the CAM LABS Terms of Manufacturing.', 'error');
      return;
    }

    setIsLoading(true);
    try {
      await register(regName, regEmail, regPass, regCompany, regPhone);
      closeAuthModal();
      showToast('Account Created', `Welcome to CAM LABS, ${regName}! Your engineering dashboard is ready.`, 'success');
      if (activeView !== 'manufacturing-request') {
        setActiveView('dashboard');
        window.scrollTo({ top: 0, behavior: 'smooth' });
      }
    } catch (err: any) {
      if (err?.status === 409) {
        openAuthModal('login');
        showToast(t('auth.accountExistsTitle'), t('auth.accountExistsDescription'), 'info');
        return;
      }
      showToast('Registration Failed', err?.message || 'Could not create account', 'error');
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div className="modal-overlay active">
      <div className="modal-card">
        <div className="modal-header">
          <div className="tabs-nav" style={{ borderBottom: 'none', width: '100%' }}>
            <button
              className={`tab-btn ${authModalTab === 'login' ? 'active' : ''}`}
              onClick={() => openAuthModal('login')}
            >
              {t('nav.signIn')}
            </button>
            <button
              className={`tab-btn ${authModalTab === 'register' ? 'active' : ''}`}
              onClick={() => openAuthModal('register')}
            >
              {t('auth.register')}
            </button>
          </div>
          <button className="modal-close" onClick={closeAuthModal}>
            <Icon name="close" size={20} />
          </button>
        </div>

        <div className="modal-body">
          {authModalTab === 'login' ? (
            /* Login Form */
            <form onSubmit={handleLoginSubmit}>
              <div className="form-group">
                <label className="form-label">{t('auth.workEmail')}<RequiredMark /></label>
                <input
                  type="email"
                  className="form-control"
                  placeholder="engineer@company.com"
                  value={loginEmail}
                  onChange={(e) => setLoginEmail(e.target.value)}
                  required
                  aria-required="true"
                />
              </div>

              <div className="form-group">
                <div className="form-label">
                  <span>{t('auth.password')}<RequiredMark /></span>
                  <a
                    href="#forgot"
                    onClick={(e) => {
                      e.preventDefault();
                      openForgotPassword();
                    }}
                    style={{ fontSize: '0.75rem', color: 'var(--cam-blue-primary)' }}
                  >
                    {t('auth.forgotPassword')}
                  </a>
                </div>
                <div className="input-with-icon">
                  <input
                    type={showLoginPass ? 'text' : 'password'}
                    className="form-control"
                    value={loginPass}
                    onChange={(e) => setLoginPass(e.target.value)}
                    required
                    aria-required="true"
                  />
                  <button
                    type="button"
                    className="input-btn-right"
                    onClick={() => setShowLoginPass(!showLoginPass)}
                    aria-label={t('auth.togglePassword')}
                  >
                    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                      <path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z" />
                      <circle cx="12" cy="12" r="3" />
                    </svg>
                  </button>
                </div>
              </div>

              <div className="form-group">
                <label className="custom-checkbox">
                  <input type="checkbox" defaultChecked />
                  <span className="checkbox-mark"></span>
                  <span>{t('auth.keepSignedIn')}</span>
                </label>
              </div>

              <button
                type="submit"
                className="btn btn-primary"
                style={{ width: '100%', marginTop: 'var(--space-4)' }}
                disabled={isLoading}
              >
                {isLoading ? (
                  <span style={{ display: 'inline-flex', alignItems: 'center', gap: '8px' }}>
                    <span className="pulse-dot"></span> {t('auth.authenticating')}
                  </span>
                ) : (
                  t('auth.signInToCam')
                )}
              </button>
            </form>
          ) : (
            /* Registration Form */
            <form onSubmit={handleRegisterSubmit}>
              <div className="form-group">
                <label className="form-label">{t('auth.fullName')}<RequiredMark /></label>
                <input
                  type="text"
                  className="form-control"
                  placeholder={t('auth.namePlaceholder')}
                  value={regName}
                  onChange={(e) => setRegName(e.target.value)}
                  required
                  aria-required="true"
                />
              </div>

              <div className="form-group">
                <label className="form-label">{t('auth.workEmail')}<RequiredMark /></label>
                <input
                  type="email"
                  className="form-control"
                  placeholder="engineer@company.com"
                  value={regEmail}
                  onChange={(e) => setRegEmail(e.target.value)}
                  required
                  aria-required="true"
                />
              </div>

              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 'var(--space-3)' }}>
                <div className="form-group">
                  <label className="form-label">
                    <span>{t('auth.companyName')}</span>
                    <OptionalMark />
                  </label>
                  <input
                    type="text"
                    className="form-control"
                    placeholder={t('auth.companyPlaceholder')}
                    value={regCompany}
                    onChange={(e) => setRegCompany(e.target.value)}
                  />
                </div>
                <div className="form-group">
                  <label className="form-label">{t('auth.phone')}<RequiredMark /></label>
                  <input
                    type="tel"
                    className="form-control"
                    placeholder={t('auth.phonePlaceholder')}
                    value={regPhone}
                    onChange={(e) => setRegPhone(e.target.value)}
                    pattern=".{7,40}"
                    required
                    aria-required="true"
                  />
                </div>
              </div>

              <div className="form-group">
                <label className="form-label">{t('auth.password')}<RequiredMark /></label>
                <div className="input-with-icon">
                  <input
                    type={showRegPass ? 'text' : 'password'}
                    className="form-control"
                    placeholder={t('auth.minimumPassword')}
                    value={regPass}
                    onChange={(e) => setRegPass(e.target.value)}
                    required
                    aria-required="true"
                  />
                  <button
                    type="button"
                    className="input-btn-right"
                    onClick={() => setShowRegPass(!showRegPass)}
                  >
                    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                      <path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z" />
                      <circle cx="12" cy="12" r="3" />
                    </svg>
                  </button>
                </div>
                {/* Strength Meter */}
                <div style={{ marginTop: '4px' }}>
                  <div style={{ width: '100%', height: '4px', background: 'var(--cam-surface-3)', borderRadius: '2px', overflow: 'hidden' }}>
                    <div style={{ width: strength.width, height: '100%', backgroundColor: strength.color, transition: 'all 0.3s' }}></div>
                  </div>
                  <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '0.6875rem', color: 'var(--cam-text-muted)', marginTop: '2px' }}>
                    <span>{t('auth.passwordStrength')}</span>
                    <span>{strength.text}</span>
                  </div>
                </div>
              </div>

              <div className="form-group">
                <label className="form-label">{t('auth.confirmPassword')}<RequiredMark /></label>
                <div className="input-with-icon">
                  <input
                    type={showRegConfirmPass ? 'text' : 'password'}
                    className="form-control"
                    placeholder={t('auth.reenterPassword')}
                    value={regConfirmPass}
                    onChange={(e) => setRegConfirmPass(e.target.value)}
                    required
                    aria-required="true"
                  />
                  <button
                    type="button"
                    className="input-btn-right"
                    onClick={() => setShowRegConfirmPass(!showRegConfirmPass)}
                  >
                    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                      <path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z" />
                      <circle cx="12" cy="12" r="3" />
                    </svg>
                  </button>
                </div>
              </div>

              <div className="form-group">
                <label className="custom-checkbox">
                  <input
                    type="checkbox"
                    checked={agreeTerms}
                    onChange={(e) => setAgreeTerms(e.target.checked)}
                    required
                  />
                  <span className="checkbox-mark"></span>
                  <span>{t('auth.termsAgreement')}</span>
                </label>
              </div>

              <button
                type="submit"
                className="btn btn-primary"
                style={{ width: '100%', marginTop: 'var(--space-4)' }}
                disabled={isLoading}
              >
                {isLoading ? (
                  <span style={{ display: 'inline-flex', alignItems: 'center', gap: '8px' }}>
                    <span className="pulse-dot"></span> Creating Account...
                  </span>
                ) : (
                  t('auth.createAccount')
                )}
              </button>
            </form>
          )}
        </div>
      </div>
    </div>
  );
};
