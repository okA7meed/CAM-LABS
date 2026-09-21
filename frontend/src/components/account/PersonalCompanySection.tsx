import React, { useEffect, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { useAuth } from '../../context/AuthContext';
import { useStore } from '../../context/StoreContext';
import { AVATAR_COLORS, AvatarColor } from '../../types';
import { AVATAR_COLOR_VALUES, getUserAvatarColor } from '../ui/UserAvatar';
import { Icon } from '../ui/Icon';
import { ApiError } from '../../services/api';
import {
  formatDefaultAddressLine,
  getInitials,
} from './accountUtils';
import { InternationalPhoneInput, PhoneValue } from '../phone/InternationalPhoneInput';
import { validatePhone } from '../phone/phoneLib';
import { EmailChangeModal } from './EmailChangeModal';

const EMAIL_PATTERN = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

export const PersonalCompanySection: React.FC<{ onManageAddresses: () => void }> = ({ onManageAddresses }) => {
  const { currentUser, updateProfile, refreshUser } = useAuth();
  const { showToast } = useStore();
  const { t } = useTranslation();

  const [name, setName] = useState(currentUser?.name || '');
  const [company, setCompany] = useState(currentUser?.company || '');
  // NOTE: the legacy `taxId` column is preserved server-side but intentionally
  // has no customer-facing control in this account center.
  const [phone, setPhone] = useState<PhoneValue>({ e164: null, national: '', country: 'EG', valid: false });
  const [avatarColor, setAvatarColor] = useState<AvatarColor>(getUserAvatarColor(currentUser));
  const [saving, setSaving] = useState(false);
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [emailModalOpen, setEmailModalOpen] = useState(false);

  // Sync form when the authenticated profile (re)loads.
  useEffect(() => {
    setName(currentUser?.name || '');
    setCompany(currentUser?.company || '');
    setAvatarColor(getUserAvatarColor(currentUser));
  }, [currentUser?.id]); // eslint-disable-line react-hooks/exhaustive-deps

  if (!currentUser) return null;

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (saving) return;
    const nextErrors: Record<string, string> = {};
    if (name.trim().length < 2) nextErrors.name = t('account.nameRequired');
    if (!EMAIL_PATTERN.test((currentUser.email || '').trim())) nextErrors.email = t('account.emailInvalid');
    if (!phone.valid || !phone.e164) {
      const check = validatePhone(phone.national, phone.country);
      nextErrors.phone =
        check.error === 'too-short'
          ? t('account.phoneTooShort')
          : check.error === 'too-long'
            ? t('account.phoneTooLong')
            : t('account.phoneInvalidCountry');
    }
    setErrors(nextErrors);
    if (Object.keys(nextErrors).length > 0) return;

    setSaving(true);
    try {
      await updateProfile({
        name: name.trim(),
        phone: phone.e164 as string,
        company: company.trim(),
        preferences: { avatarColor },
      });
      await refreshUser();
      showToast(t('account.saveContact'), t('account.profileUpdated'), 'success');
    } catch (err) {
      const message = err instanceof ApiError ? err.message : t('account.profileSaveFailed');
      showToast(t('account.saveContact'), message, 'error');
    } finally {
      setSaving(false);
    }
  };

  const defaultAddressLine = formatDefaultAddressLine(currentUser);

  return (
    <section className="account-card" aria-labelledby="account-personal-title">
      <header className="account-card-header">
        <span className="account-card-icon" aria-hidden="true">
          <Icon name="userRound" size={20} />
        </span>
        <div>
          <h3 id="account-personal-title">{t('account.personalTitle')}</h3>
          <p>{t('account.personalDesc')}</p>
        </div>
      </header>

      <form onSubmit={(e) => void handleSubmit(e)} noValidate>
        <h4 className="account-section-title">{t('account.personalInfo')}</h4>
        <div className="account-grid-2">
          <div className="form-group">
            <label className="form-label" htmlFor="account-fullname">
              {t('account.fullName')}
            </label>
            <div className={`account-input-wrap${errors.name ? ' has-error' : ''}`}>
              <Icon name="userRound" size={16} className="account-input-icon" />
              <input
                id="account-fullname"
                type="text"
                className="form-control account-input"
                value={name}
                onChange={(e) => setName(e.target.value)}
                autoComplete="name"
                aria-invalid={Boolean(errors.name)}
              />
            </div>
            {errors.name && (
              <p className="account-field-error" role="alert">
                {errors.name}
              </p>
            )}
          </div>

          <div className="form-group">
            <label className="form-label" htmlFor="account-email">
              {t('account.workEmail')}
            </label>
            <div className="account-email-row">
              <div className="account-input-wrap account-email-input">
                <Icon name="mail" size={16} className="account-input-icon" />
                <input
                  id="account-email"
                  type="email"
                  className="form-control account-input"
                  value={currentUser.email}
                  readOnly
                  disabled
                  dir="ltr"
                  autoComplete="email"
                  title={t('account.workEmail')}
                />
              </div>
              <button type="button" className="btn btn-outline btn-sm" onClick={() => setEmailModalOpen(true)}>
                {t('account.changeEmail')}
              </button>
            </div>
          </div>

          <div className="form-group">
            <label className="form-label" htmlFor="account-phone" id="account-phone-label">
              {t('account.phoneNumber')}
            </label>
            <div className={errors.phone ? 'account-phone-error' : undefined}>
              <InternationalPhoneInput
                id="account-phone"
                initialValue={currentUser.phone}
                onChange={setPhone}
                ariaLabelledBy="account-phone-label"
              />
            </div>
            {errors.phone && (
              <p className="account-field-error" role="alert">
                {errors.phone}
              </p>
            )}
          </div>

          <div className="form-group">
            <label className="form-label" htmlFor="account-company">
              {t('account.companyName')}
            </label>
            <div className="account-input-wrap">
              <Icon name="building" size={16} className="account-input-icon" />
              <input
                id="account-company"
                type="text"
                className="form-control account-input"
                value={company}
                onChange={(e) => setCompany(e.target.value)}
                autoComplete="organization"
              />
            </div>
          </div>
        </div>

        <h4 className="account-section-title">{t('account.billingTitle')}</h4>
        <div className="form-group">
          <label className="form-label" htmlFor="account-default-address">
            {t('account.defaultAddress')}
          </label>
          <div className="account-input-wrap">
            <Icon name="mapPin" size={16} className="account-input-icon" />
            <input
              id="account-default-address"
              type="text"
              className="form-control account-input"
              value={defaultAddressLine}
              readOnly
              placeholder={t('account.defaultAddressEmpty')}
            />
          </div>
          <button type="button" className="account-link" onClick={onManageAddresses}>
            {t('account.manageAddresses')}
          </button>
        </div>

        <h4 className="account-section-title">{t('account.appearanceTitle')}</h4>
        <div className="account-appearance">
          <div>
            <span className="form-label" id="avatar-color-label">
              {t('account.avatarColor')}
            </span>
            <div className="avatar-color-select" role="radiogroup" aria-labelledby="avatar-color-label">
              {AVATAR_COLORS.map((color) => (
                <button
                  key={color}
                  type="button"
                  role="radio"
                  aria-checked={avatarColor === color}
                  aria-label={color}
                  title={color}
                  className={`avatar-color-option avatar-${color}${avatarColor === color ? ' selected' : ''}`}
                  style={avatarColor === color ? undefined : { backgroundColor: AVATAR_COLOR_VALUES[color] }}
                  onClick={() => setAvatarColor(color)}
                />
              ))}
            </div>
          </div>
          <div className="account-avatar-preview">
            <span
              className={`account-avatar-preview-badge avatar-${avatarColor}`}
              style={{ backgroundColor: AVATAR_COLOR_VALUES[avatarColor] }}
              aria-hidden="true"
            >
              {getInitials(name || currentUser.name)}
            </span>
            <span>
              <strong>{t('account.avatarPreview')}</strong>
              <span>{t('account.avatarPreviewDesc')}</span>
            </span>
          </div>
        </div>

        <div className="account-actions">
          <button type="submit" className="btn btn-primary" disabled={saving}>
            <Icon name="save" size={16} />
            {saving ? t('account.saving') : t('account.saveContact')}
          </button>
        </div>
      </form>
      <EmailChangeModal open={emailModalOpen} onClose={() => setEmailModalOpen(false)} />
    </section>
  );
};
