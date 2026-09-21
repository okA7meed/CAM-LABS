import React, { useEffect, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { AddressBookEntry } from '../../types';
import { GOVERNORATES } from '../../constants/locations';
import { AnimatedModal } from '../ui/AnimatedModal';

interface Props {
  open: boolean;
  initial: AddressBookEntry | null;
  isDefault: boolean;
  busy: boolean;
  onClose: () => void;
  onSave: (entry: AddressBookEntry, makeDefault: boolean) => Promise<void>;
}

const newId = (): string =>
  typeof crypto !== 'undefined' && 'randomUUID' in crypto
    ? crypto.randomUUID()
    : `addr-${Date.now()}-${Math.floor(Math.random() * 1e6)}`;

export const AddressModal: React.FC<Props> = ({ open, initial, isDefault, busy, onClose, onSave }) => {
  const { t } = useTranslation();
  const [label, setLabel] = useState('');
  const [street, setStreet] = useState('');
  const [building, setBuilding] = useState('');
  const [area, setArea] = useState('');
  const [city, setCity] = useState('');
  const [governorate, setGovernorate] = useState('');
  const [postalCode, setPostalCode] = useState('');
  const [deliveryNotes, setDeliveryNotes] = useState('');
  const [makeDefault, setMakeDefault] = useState(false);
  const [errors, setErrors] = useState<Record<string, string>>({});

  useEffect(() => {
    if (!open) return;
    setLabel(initial?.label || '');
    setStreet(initial?.street || '');
    setBuilding(initial?.building || '');
    setArea(initial?.area || '');
    setCity(initial?.city || '');
    setGovernorate(initial?.governorate || '');
    setPostalCode(initial?.postalCode || '');
    setDeliveryNotes(initial?.deliveryNotes || '');
    setMakeDefault(isDefault);
    setErrors({});
  }, [open, initial, isDefault]);

  if (!open) return null;

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (busy) return;
    const nextErrors: Record<string, string> = {};
    if (label.trim().length < 2) nextErrors.label = t('account.fieldRequired');
    if (street.trim().length < 2) nextErrors.street = t('account.fieldRequired');
    if (city.trim().length < 2) nextErrors.city = t('account.fieldRequired');
    if (!governorate || !GOVERNORATES.includes(governorate)) nextErrors.governorate = t('account.fieldRequired');
    setErrors(nextErrors);
    if (Object.keys(nextErrors).length > 0) return;
    await onSave(
      {
        id: initial?.id || newId(),
        label: label.trim(),
        street: street.trim(),
        building: building.trim(),
        area: area.trim(),
        city: city.trim(),
        governorate,
        postalCode: postalCode.trim(),
        deliveryNotes: deliveryNotes.trim(),
      },
      makeDefault,
    );
  };

  return (
    <AnimatedModal open={open} role="dialog" ariaLabel={t(initial ? 'account.modalEdit' : 'account.modalAdd')}>
      <div className="account-modal account-modal-lg">
        <h3>{t(initial ? 'account.modalEdit' : 'account.modalAdd')}</h3>
        <form onSubmit={(e) => void handleSubmit(e)} noValidate>
          <div className="form-group">
            <label className="form-label" htmlFor="addr-label">
              {t('account.fieldLabel')}
            </label>
            <input
              id="addr-label"
              type="text"
              className="form-control"
              value={label}
              onChange={(e) => setLabel(e.target.value)}
              placeholder={t('account.fieldLabelPh')}
              aria-invalid={Boolean(errors.label)}
            />
            {errors.label && (
              <p className="account-field-error" role="alert">
                {errors.label}
              </p>
            )}
          </div>

          <div className="account-grid-2">
            <div className="form-group">
              <label className="form-label" htmlFor="addr-street">
                {t('account.fieldStreet')}
              </label>
              <input
                id="addr-street"
                type="text"
                className="form-control"
                value={street}
                onChange={(e) => setStreet(e.target.value)}
                placeholder={t('account.fieldStreetPh')}
                autoComplete="street-address"
                aria-invalid={Boolean(errors.street)}
              />
              {errors.street && (
                <p className="account-field-error" role="alert">
                  {errors.street}
                </p>
              )}
            </div>
            <div className="form-group">
              <label className="form-label" htmlFor="addr-building">
                {t('account.fieldBuilding')}
              </label>
              <input
                id="addr-building"
                type="text"
                className="form-control"
                value={building}
                onChange={(e) => setBuilding(e.target.value)}
                placeholder={t('account.fieldBuildingPh')}
              />
            </div>
            <div className="form-group">
              <label className="form-label" htmlFor="addr-area">
                {t('account.fieldArea')}
              </label>
              <input
                id="addr-area"
                type="text"
                className="form-control"
                value={area}
                onChange={(e) => setArea(e.target.value)}
                placeholder={t('account.fieldAreaPh')}
              />
            </div>
            <div className="form-group">
              <label className="form-label" htmlFor="addr-city">
                {t('account.fieldCity')}
              </label>
              <input
                id="addr-city"
                type="text"
                className="form-control"
                value={city}
                onChange={(e) => setCity(e.target.value)}
                placeholder={t('account.fieldCityPh')}
                autoComplete="address-level2"
                aria-invalid={Boolean(errors.city)}
              />
              {errors.city && (
                <p className="account-field-error" role="alert">
                  {errors.city}
                </p>
              )}
            </div>
            <div className="form-group">
              <label className="form-label" htmlFor="addr-gov">
                {t('account.fieldGovernorate')}
              </label>
              <select
                id="addr-gov"
                className="form-control"
                value={governorate}
                onChange={(e) => setGovernorate(e.target.value)}
                aria-invalid={Boolean(errors.governorate)}
              >
                <option value="">{t('account.selectGovernorate')}</option>
                {GOVERNORATES.map((g) => (
                  <option key={g} value={g}>
                    {g}
                  </option>
                ))}
              </select>
              {errors.governorate && (
                <p className="account-field-error" role="alert">
                  {errors.governorate}
                </p>
              )}
            </div>
            <div className="form-group">
              <label className="form-label" htmlFor="addr-postal">
                {t('account.fieldPostal')}
              </label>
              <input
                id="addr-postal"
                type="text"
                className="form-control"
                value={postalCode}
                onChange={(e) => setPostalCode(e.target.value)}
                placeholder={t('account.fieldPostalPh')}
                autoComplete="postal-code"
                inputMode="numeric"
                dir="ltr"
              />
            </div>
          </div>

          <div className="form-group">
            <label className="form-label" htmlFor="addr-notes">
              {t('account.fieldNotes')}
            </label>
            <input
              id="addr-notes"
              type="text"
              className="form-control"
              value={deliveryNotes}
              onChange={(e) => setDeliveryNotes(e.target.value)}
              placeholder={t('account.fieldNotesPh')}
            />
          </div>

          <div className="form-group">
            <label className="custom-checkbox">
              <input type="checkbox" checked={makeDefault} onChange={(e) => setMakeDefault(e.target.checked)} />
              <span className="checkbox-mark" aria-hidden="true" />
              <span>{t('account.fieldDefaultCheck')}</span>
            </label>
          </div>

          <div className="account-modal-actions">
            <button type="button" className="btn btn-outline" onClick={onClose} disabled={busy}>
              {t('account.cancel')}
            </button>
            <button type="submit" className="btn btn-primary" disabled={busy}>
              {busy ? t('account.saving') : t('account.save')}
            </button>
          </div>
        </form>
      </div>
    </AnimatedModal>
  );
};
