import React, { useEffect, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { useAuth } from '../../context/AuthContext';
import { useStore } from '../../context/StoreContext';
import { useTheme, ThemePreference } from '../../context/ThemeContext';
import { DEFAULT_NOTIFICATION_PREFERENCES, NotificationPreferences } from '../../types';
import { ApiError } from '../../services/api';
import { Icon, IconName } from '../ui/Icon';

const NOTIFICATION_ROWS: Array<{ key: keyof NotificationPreferences; icon: IconName; titleKey: string; descKey: string }> = [
  { key: 'quoteUpdates', icon: 'file', titleKey: 'account.quoteUpdates', descKey: 'account.quoteUpdatesDesc' },
  { key: 'orderStatus', icon: 'package', titleKey: 'account.orderStatus', descKey: 'account.orderStatusDesc' },
  { key: 'manufacturingUpdates', icon: 'gear', titleKey: 'account.manufacturing', descKey: 'account.manufacturingDesc' },
  { key: 'shippingDelivery', icon: 'truck', titleKey: 'account.shippingNotif', descKey: 'account.shippingNotifDesc' },
  { key: 'messagesSupport', icon: 'message', titleKey: 'account.messages', descKey: 'account.messagesDesc' },
  { key: 'marketing', icon: 'megaphone', titleKey: 'account.marketing', descKey: 'account.marketingDesc' },
];

export const NotificationsSection: React.FC = () => {
  const { currentUser, updateProfile, refreshUser } = useAuth();
  const { showToast } = useStore();
  const { t, i18n } = useTranslation();
  const { preference: themePreference, setPreference: setThemePreference } = useTheme();

  const [prefs, setPrefs] = useState<NotificationPreferences>(DEFAULT_NOTIFICATION_PREFERENCES);
  const [language, setLanguage] = useState<'en' | 'ar'>(i18n.language.startsWith('ar') ? 'ar' : 'en');
  const [theme, setTheme] = useState<ThemePreference>(themePreference);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    const saved = currentUser?.preferences?.notificationPrefs;
    setPrefs({ ...DEFAULT_NOTIFICATION_PREFERENCES, ...(saved || {}) });
    const savedLanguage = currentUser?.preferences?.language;
    if (savedLanguage === 'en' || savedLanguage === 'ar') setLanguage(savedLanguage);
    else setLanguage(i18n.language.startsWith('ar') ? 'ar' : 'en');
    const savedTheme = currentUser?.preferences?.theme;
    if (savedTheme === 'light' || savedTheme === 'dark' || savedTheme === 'system') setTheme(savedTheme);
    else setTheme(themePreference);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [currentUser?.id]);

  useEffect(() => {
    setTheme(themePreference);
  }, [themePreference]);

  if (!currentUser) return null;

  const toggle = (key: keyof NotificationPreferences) => {
    setPrefs((prev) => ({ ...prev, [key]: !prev[key] }));
  };

  const handleSave = async (e: React.FormEvent) => {
    e.preventDefault();
    if (saving) return;
    setSaving(true);
    try {
      // Language and theme apply live through the existing global systems.
      if (language !== (i18n.language.startsWith('ar') ? 'ar' : 'en')) {
        await i18n.changeLanguage(language);
      }
      if (theme !== themePreference) setThemePreference(theme);
      await updateProfile({
        preferences: { notificationPrefs: prefs, language, theme },
      });
      await refreshUser();
      showToast(t('account.savePrefs'), t('account.prefsSaved'), 'success');
    } catch (err) {
      const message = err instanceof ApiError ? err.message : t('account.prefsFailed');
      showToast(t('account.savePrefs'), message, 'error');
    } finally {
      setSaving(false);
    }
  };

  return (
    <section className="account-card" aria-labelledby="account-notif-title">
      <header className="account-card-header">
        <span className="account-card-icon" aria-hidden="true">
          <Icon name="bell" size={20} />
        </span>
        <div>
          <h3 id="account-notif-title">{t('account.notifTitle')}</h3>
          <p>{t('account.notifDesc')}</p>
        </div>
      </header>

      <form onSubmit={(e) => void handleSave(e)}>
        <h4 className="account-section-title">{t('account.notifSettings')}</h4>
        <ul className="account-toggle-list">
          {NOTIFICATION_ROWS.map((row) => (
            <li key={row.key} className="account-toggle-row">
              <span className="account-toggle-icon" aria-hidden="true">
                <Icon name={row.icon} size={18} />
              </span>
              <span className="account-toggle-text">
                <strong>{t(row.titleKey)}</strong>
                <span>{t(row.descKey)}</span>
              </span>
              <button
                type="button"
                role="switch"
                aria-checked={prefs[row.key]}
                aria-label={t(row.titleKey)}
                className={`account-switch${prefs[row.key] ? ' on' : ''}`}
                onClick={() => toggle(row.key)}
              >
                <span className="account-switch-knob" aria-hidden="true" />
              </button>
            </li>
          ))}
        </ul>

        <h4 className="account-section-title">{t('account.generalPrefs')}</h4>
        <div className="account-grid-2">
          <div className="form-group">
            <label className="form-label" htmlFor="account-language">
              {t('account.language')}
            </label>
            <div className="account-input-wrap">
              <Icon name="globe" size={16} className="account-input-icon" />
              <select
                id="account-language"
                className="form-control account-input account-select"
                value={language}
                onChange={(e) => setLanguage(e.target.value === 'ar' ? 'ar' : 'en')}
              >
                <option value="en">{t('account.english')}</option>
                <option value="ar">{t('account.arabic')}</option>
              </select>
            </div>
          </div>
          <div className="form-group">
            <label className="form-label" htmlFor="account-theme">
              {t('account.theme')}
            </label>
            <div className="account-input-wrap">
              <Icon name="moon" size={16} className="account-input-icon" />
              <select
                id="account-theme"
                className="form-control account-input account-select"
                value={theme}
                onChange={(e) => setTheme(e.target.value as ThemePreference)}
              >
                <option value="light">{t('account.themeLight')}</option>
                <option value="dark">{t('account.themeDark')}</option>
                <option value="system">{t('account.themeSystem')}</option>
              </select>
            </div>
          </div>
        </div>

        <div className="account-actions">
          <button type="submit" className="btn btn-primary" disabled={saving}>
            <Icon name="save" size={16} />
            {saving ? t('account.saving') : t('account.savePrefs')}
          </button>
        </div>
      </form>
    </section>
  );
};
