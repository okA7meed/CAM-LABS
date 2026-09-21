import React, { useCallback } from 'react';
import { useTranslation } from 'react-i18next';
import { useAuth } from '../../context/AuthContext';
import { useStore } from '../../context/StoreContext';
import { AccountSection } from '../../routing/hashRouter';
import { Icon, IconName } from '../ui/Icon';
import { getInitials, truncateMiddle } from './accountUtils';
import { AVATAR_COLOR_VALUES, getUserAvatarColor } from '../ui/UserAvatar';
import { PersonalCompanySection } from './PersonalCompanySection';
import { AddressesSection } from './AddressesSection';
import { SecuritySection } from './SecuritySection';
import { NotificationsSection } from './NotificationsSection';

const SECTIONS: Array<{ id: AccountSection; icon: IconName; labelKey: string }> = [
  { id: 'personal', icon: 'userRound', labelKey: 'account.personalCompany' },
  { id: 'addresses', icon: 'mapPin', labelKey: 'account.addressesShipping' },
  { id: 'security', icon: 'lock', labelKey: 'account.security2fa' },
  { id: 'notifications', icon: 'bell', labelKey: 'account.notificationsPrefs' },
];

export const AccountSettingsView: React.FC = () => {
  const { currentUser } = useAuth();
  const { setActiveView, accountSection: section } = useStore();
  const { t } = useTranslation();

  const selectSection = useCallback(
    (next: AccountSection) => {
      // Single source: the store writes `#/account/<section>` for deep links.
      setActiveView('profile', { section: next });
    },
    [setActiveView],
  );

  if (!currentUser) {
    return (
      <main className="dashboard-layout">
        <div className="container">
          <p>{t('account.signInRequired')}</p>
        </div>
      </main>
    );
  }

  return (
    <main className="dashboard-layout account-settings-page">
      <div className="container">
        <div className="account-topbar">
          <div>
            <h2 className="account-title">{t('account.title')}</h2>
            <p className="account-subtitle">{t('account.subtitle')}</p>
          </div>
          <nav className="account-breadcrumb" aria-label="Breadcrumb">
            <button type="button" className="account-crumb" onClick={() => setActiveView('home')}>
              <Icon name="home" size={14} />
            </button>
            <span className="account-crumb-sep" aria-hidden="true">
              <Icon name="chevronRight" size={12} />
            </span>
            <button type="button" className="account-crumb" onClick={() => setActiveView('dashboard')}>
              {t('account.dashboard')}
            </button>
            <span className="account-crumb-sep" aria-hidden="true">
              <Icon name="chevronRight" size={12} />
            </span>
            <span className="account-crumb-current" aria-current="page">
              {t('account.title')}
            </span>
          </nav>
        </div>

        {/* Mobile account navigation: horizontal scrollable tabs */}
        <div className="account-mobile-tabs" role="tablist" aria-label={t('account.title')}>
          {SECTIONS.map((item) => (
            <button
              key={item.id}
              type="button"
              role="tab"
              aria-selected={section === item.id}
              className={`account-mobile-tab${section === item.id ? ' active' : ''}`}
              onClick={() => selectSection(item.id)}
            >
              <Icon name={item.icon} size={16} />
              <span>{t(item.labelKey)}</span>
            </button>
          ))}
        </div>

        <div className="account-grid">
          <aside className="account-sidebar" aria-label={t('account.title')}>
            <button
              type="button"
              className="account-identity"
              onClick={() => selectSection('personal')}
              aria-label={currentUser.name}
            >
              <span
                className={`account-identity-avatar avatar-${getUserAvatarColor(currentUser)}`}
                style={{ backgroundColor: AVATAR_COLOR_VALUES[getUserAvatarColor(currentUser)] }}
                aria-hidden="true"
              >
                {getInitials(currentUser.name)}
              </span>
              <span className="account-identity-text">
                <strong className="account-identity-name">{currentUser.name}</strong>
                <span className="account-identity-email" dir="ltr">
                  {truncateMiddle(currentUser.email)}
                </span>
              </span>
              <span className="account-identity-chevron" aria-hidden="true">
                <Icon name="chevronRight" size={16} />
              </span>
            </button>

            <nav className="account-nav" aria-label={t('account.title')}>
              {SECTIONS.map((item) => (
                <button
                  key={item.id}
                  type="button"
                  className={`account-nav-item${section === item.id ? ' active' : ''}`}
                  aria-current={section === item.id ? 'page' : undefined}
                  onClick={() => selectSection(item.id)}
                >
                  <Icon name={item.icon} size={17} />
                  <span>{t(item.labelKey)}</span>
                </button>
              ))}
            </nav>

            <div className="account-help">
              <span className="account-help-icon" aria-hidden="true">
                <Icon name="headset" size={20} />
              </span>
              <strong>{t('account.needHelp')}</strong>
              <p>{t('account.needHelpBody')}</p>
              <button type="button" className="btn btn-outline btn-sm" onClick={() => setActiveView('contact')}>
                {t('account.contactSupport')}
                <Icon name="arrowRight" size={14} />
              </button>
            </div>
          </aside>

          <div className="account-content">
            {section === 'personal' && <PersonalCompanySection onManageAddresses={() => selectSection('addresses')} />}
            {section === 'addresses' && <AddressesSection />}
            {section === 'security' && <SecuritySection />}
            {section === 'notifications' && <NotificationsSection />}
          </div>
        </div>
      </div>
    </main>
  );
};
