import React, { useState } from 'react';
import { useAuth } from '../../context/AuthContext';
import { useStore } from '../../context/StoreContext';
import { useTranslation } from 'react-i18next';
import { OptionalMark, RequiredMark } from '../ui/FieldLabel';

type ProfileTab = 'personal' | 'manufacturing' | 'security' | 'api';

export const ProfileView: React.FC = () => {
  const { currentUser, updateProfile } = useAuth();
  const { showToast, setActiveView } = useStore();
  const { t } = useTranslation();

  const [activeTab, setActiveTab] = useState<ProfileTab>('personal');

  // Personal form
  const [name, setName] = useState(currentUser?.name || '');
  const [email, setEmail] = useState(currentUser?.email || '');
  const [phone, setPhone] = useState(currentUser?.phone || '');
  const [company, setCompany] = useState(currentUser?.company || '');
  const [address, setAddress] = useState(currentUser?.address || '');
  const [taxId, setTaxId] = useState(currentUser?.taxId || '');

  // Preferences form
  const [units, setUnits] = useState<'mm' | 'in'>(currentUser?.preferences?.units || 'mm');
  const [toleranceStd, setToleranceStd] = useState(
    currentUser?.preferences?.toleranceStandard || 'ISO 2768-fine (±0.05 mm)'
  );
  const [dfmToggle, setDfmToggle] = useState(currentUser?.preferences?.dfmNotifications ?? true);
  const [dispatchToggle, setDispatchToggle] = useState(currentUser?.preferences?.dispatchAlerts ?? true);

  if (!currentUser) {
    return <main className="dashboard-layout"><div className="container"><p>{t('profile.signInRequired')}</p></div></main>;
  }

  const handlePersonalSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!/^(?=.*\d)[0-9+() -]{7,40}$/.test(phone)) {
      showToast('Validation Error', 'Please enter a valid phone number.', 'error');
      return;
    }
    await updateProfile({ name, email, phone, company, address, taxId });
    showToast('Profile Updated', 'Your contact and company details have been saved.', 'success');
  };

  const handlePrefsSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    await updateProfile({
      preferences: {
        units,
        toleranceStandard: toleranceStd,
        dfmNotifications: dfmToggle,
        dispatchAlerts: dispatchToggle,
      },
    });
    showToast('Preferences Applied', `Default manufacturing unit set to ${units.toUpperCase()}.`, 'success');
  };

  return (
    <main className="dashboard-layout">
      <div className="container">
        <div className="dashboard-header-bar">
          <div>
            <h2 style={{ fontSize: '1.75rem' }}>{t('profile.title')}</h2>
            <p style={{ fontSize: '0.875rem', color: 'var(--cam-text-muted)' }}>
              {t('profile.description')}
            </p>
          </div>
          <button className="btn btn-sm btn-outline" onClick={() => setActiveView('dashboard')}>
            ← {t('profile.backDashboard')}
          </button>
        </div>

        <div className="profile-grid">
          {/* Subnav */}
          <div className="profile-nav-card">
            <div
              className={`profile-nav-item ${activeTab === 'personal' ? 'active' : ''}`}
              onClick={() => setActiveTab('personal')}
            >
              <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                <path d="M20 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2" />
                <circle cx="12" cy="7" r="4" />
              </svg>
              {t('profile.personalCompany')}
            </div>

            <div
              className={`profile-nav-item ${activeTab === 'manufacturing' ? 'active' : ''}`}
              onClick={() => setActiveTab('manufacturing')}
            >
              <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                <circle cx="12" cy="12" r="3" />
                <path d="M19.4 15a1.65 1.65 0 0 0 .33 1.82l.06.06a2 2 0 0 1 0 2.83 2 2 0 0 1-2.83 0l-.06-.06a1.65 1.65 0 0 0-1.82-.33 1.65 1.65 0 0 0-1 1.51V21a2 2 0 0 1-2 2 2 2 0 0 1-2-2v-.09A1.65 1.65 0 0 0 9 19.4a1.65 1.65 0 0 0-1.82.33l-.06.06a2 2 0 0 1-2.83 0 2 2 0 0 1 0-2.83l.06-.06a1.65 1.65 0 0 0 .33-1.82 1.65 1.65 0 0 0-1.51-1H3a2 2 0 0 1-2-2 2 2 0 0 1 2-2h.09A1.65 1.65 0 0 0 4.6 9a1.65 1.65 0 0 0-.33-1.82l-.06-.06a2 2 0 0 1 0-2.83 2 2 0 0 1 2.83 0l.06.06a1.65 1.65 0 0 0 1.82.33H9a1.65 1.65 0 0 0 1-1.51V3a2 2 0 0 1 2-2 2 2 0 0 1 2 2v.09a1.65 1.65 0 0 0 1 1.51 1.65 1.65 0 0 0 1.82-.33l.06-.06a2 2 0 0 1 2.83 0 2 2 0 0 1 0 2.83l-.06.06a1.65 1.65 0 0 0-.33 1.82V9a1.65 1.65 0 0 0 1.51 1H21a2 2 0 0 1 2 2 2 2 0 0 1-2 2h-.09a1.65 1.65 0 0 0-1.51 1z" />
              </svg>
              {t('profile.manufacturing')}
            </div>

            <div
              className={`profile-nav-item ${activeTab === 'security' ? 'active' : ''}`}
              onClick={() => setActiveTab('security')}
            >
              <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                <rect x="3" y="11" width="18" height="11" rx="2" ry="2" />
                <path d="M7 11V7a5 5 0 0 1 10 0v4" />
              </svg>
              {t('profile.security')}
            </div>

            <div
              className={`profile-nav-item ${activeTab === 'api' ? 'active' : ''}`}
              onClick={() => setActiveTab('api')}
            >
              <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                <polyline points="16 18 22 12 16 6" />
                <polyline points="8 6 2 12 8 18" />
              </svg>
              {t('profile.apiKeys')}
            </div>
          </div>

          {/* Form Pane */}
          <div className="profile-form-pane">
            {activeTab === 'personal' && (
              <form onSubmit={handlePersonalSubmit}>
                <h3 style={{ marginBottom: 'var(--space-6)' }}>{t('profile.personalInfo')}</h3>
                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 'var(--space-4)' }}>
                  <div className="form-group">
                    <label className="form-label"><span>{t('profile.fullName')}</span><OptionalMark /></label>
                    <input
                      type="text"
                      className="form-control"
                      value={name}
                      onChange={(e) => setName(e.target.value)}
                    />
                  </div>
                  <div className="form-group">
                    <label className="form-label"><span>{t('profile.workEmail')}</span><OptionalMark /></label>
                    <input
                      type="email"
                      className="form-control"
                      value={email}
                      onChange={(e) => setEmail(e.target.value)}
                    />
                  </div>
                </div>

                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 'var(--space-4)' }}>
                  <div className="form-group">
                    <label className="form-label">{t('profile.phone')}<RequiredMark /></label>
                    <input
                      type="tel"
                      className="form-control"
                      value={phone}
                      onChange={(e) => setPhone(e.target.value)}
                      pattern=".{7,40}"
                      required
                      aria-required="true"
                    />
                  </div>
                  <div className="form-group">
                    <label className="form-label"><span>{t('profile.company')}</span><OptionalMark /></label>
                    <input
                      type="text"
                      className="form-control"
                      value={company}
                      onChange={(e) => setCompany(e.target.value)}
                    />
                  </div>
                </div>

                <div className="form-group">
                  <label className="form-label"><span>{t('profile.shipping')}</span><OptionalMark /></label>
                  <input
                    type="text"
                    className="form-control"
                    value={address}
                    onChange={(e) => setAddress(e.target.value)}
                  />
                </div>

                <div className="form-group">
                  <label className="form-label"><span>{t('profile.taxId')}</span><OptionalMark /></label>
                  <input
                    type="text"
                    className="form-control"
                    value={taxId}
                    onChange={(e) => setTaxId(e.target.value)}
                  />
                </div>

                <div style={{ marginTop: 'var(--space-6)', display: 'flex', justifyContent: 'flex-end' }}>
                  <button type="submit" className="btn btn-primary">
                    {t('profile.saveContact')}
                  </button>
                </div>
              </form>
            )}

            {activeTab === 'manufacturing' && (
              <form onSubmit={handlePrefsSubmit}>
                <h3 style={{ marginBottom: 'var(--space-6)' }}>{t('profile.engineeringDefaults')}</h3>
                <div className="form-group">
                  <label className="form-label">{t('profile.unitSystem')}</label>
                  <div style={{ display: 'flex', gap: 'var(--space-6)', marginTop: '4px' }}>
                    <label className="custom-checkbox">
                      <input
                        type="radio"
                        name="units"
                        checked={units === 'mm'}
                        onChange={() => setUnits('mm')}
                      />
                      <span className="checkbox-mark"></span>
                      <span>{t('profile.metric')}</span>
                    </label>
                    <label className="custom-checkbox">
                      <input
                        type="radio"
                        name="units"
                        checked={units === 'in'}
                        onChange={() => setUnits('in')}
                      />
                      <span className="checkbox-mark"></span>
                      <span>{t('profile.imperial')}</span>
                    </label>
                  </div>
                </div>

                <div className="form-group">
                  <label className="form-label">{t('profile.tolerance')}</label>
                  <select
                    className="form-control"
                    value={toleranceStd}
                    onChange={(e) => setToleranceStd(e.target.value)}
                  >
                    <option value="ISO 2768-fine (±0.05 mm)">ISO 2768-fine (±0.05 mm Precision)</option>
                    <option value="ISO 2768-medium (±0.15 mm)">ISO 2768-medium (±0.15 mm Standard)</option>
                    <option value="ISO 2768-coarse (±0.50 mm)">ISO 2768-coarse (±0.50 mm General)</option>
                  </select>
                </div>

                <div className="form-group">
                  <label className="custom-checkbox">
                    <input
                      type="checkbox"
                      checked={dfmToggle}
                      onChange={(e) => setDfmToggle(e.target.checked)}
                    />
                    <span className="checkbox-mark"></span>
                    <span>{t('profile.dfmAudit')}</span>
                  </label>
                </div>

                <div className="form-group">
                  <label className="custom-checkbox">
                    <input
                      type="checkbox"
                      checked={dispatchToggle}
                      onChange={(e) => setDispatchToggle(e.target.checked)}
                    />
                    <span className="checkbox-mark"></span>
                    <span>{t('profile.alerts')}</span>
                  </label>
                </div>

                <div style={{ marginTop: 'var(--space-6)', display: 'flex', justifyContent: 'flex-end' }}>
                  <button type="submit" className="btn btn-primary">
                    {t('profile.updateDefaults')}
                  </button>
                </div>
              </form>
            )}

            {activeTab === 'security' && (
              <div>
                <h3 style={{ marginBottom: 'var(--space-6)' }}>{t('profile.authSecurity')}</h3>
                <div className="form-group">
                  <label className="form-label">{t('profile.twoFactor')}</label>
                  <div
                    style={{
                      display: 'flex',
                      justifyContent: 'space-between',
                      alignItems: 'center',
                      padding: 'var(--space-4)',
                      background: 'var(--cam-surface-2)',
                      borderRadius: 'var(--radius-sm)',
                      border: '1px solid var(--cam-border-subtle)',
                    }}
                  >
                    <div>
                      <strong style={{ color: 'var(--cam-text-primary)' }}>{t('profile.hardwareKey')}</strong>
                      <div style={{ fontSize: '0.75rem', color: 'var(--cam-text-muted)' }}>
                        {t('profile.securityDescription')}
                      </div>
                    </div>
                    <span className="badge badge-success">{t('profile.active')}</span>
                  </div>
                </div>

                <div style={{ marginTop: 'var(--space-6)' }}>
                  <button
                    className="btn btn-outline"
                    onClick={() => showToast('Password Reset', 'Verification link dispatched to your email.', 'info')}
                  >
                    {t('profile.changePassword')}
                  </button>
                </div>
              </div>
            )}

            {activeTab === 'api' && (
              <div>
                <h3 style={{ marginBottom: 'var(--space-4)' }}>{t('profile.apiEndpoints')}</h3>
                <p style={{ color: 'var(--cam-text-muted)', fontSize: '0.875rem', marginBottom: 'var(--space-6)' }}>
                  {t('profile.apiDescription')}
                </p>

                <div className="form-group">
                  <label className="form-label">{t('profile.apiSecret')}</label>
                  <div className="input-with-icon">
                    <input
                      type="password"
                      readOnly
                      className="form-control font-mono"
                      value="cam_live_88491024910481029418291048"
                    />
                    <button
                      type="button"
                      className="input-btn-right"
                      onClick={() => showToast('Copied', 'API Key copied to clipboard.', 'success')}
                    >
                      {t('profile.copy')}
                    </button>
                  </div>
                </div>

                <div className="stat-card" style={{ marginTop: 'var(--space-4)' }}>
                  <div className="stat-label">{t('profile.sdkStatus')}</div>
                  <div style={{ fontFamily: 'var(--font-mono)', fontSize: '0.8125rem', color: 'var(--cam-text-secondary)', marginTop: '4px' }}>
                    {t('profile.readyIntegration')}
                  </div>
                </div>
              </div>
            )}
          </div>
        </div>
      </div>
    </main>
  );
};
