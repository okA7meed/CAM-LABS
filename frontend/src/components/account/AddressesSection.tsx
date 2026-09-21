import React, { useCallback, useEffect, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { useAuth } from '../../context/AuthContext';
import { useStore } from '../../context/StoreContext';
import { AddressBookEntry } from '../../types';
import { ApiError, ApiService } from '../../services/api';
import { Icon } from '../ui/Icon';
import { AnimatedModal } from '../ui/AnimatedModal';
import { AddressModal } from './AddressModal';
import { formatAddressSummary } from './accountUtils';

export const AddressesSection: React.FC = () => {
  const { refreshUser } = useAuth();
  const { showToast } = useStore();
  const { t } = useTranslation();

  const [addresses, setAddresses] = useState<AddressBookEntry[]>([]);
  const [defaultId, setDefaultId] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState(false);
  const [modalOpen, setModalOpen] = useState(false);
  const [editing, setEditing] = useState<AddressBookEntry | null>(null);
  const [pendingDelete, setPendingDelete] = useState<AddressBookEntry | null>(null);
  const [busy, setBusy] = useState(false);

  const load = useCallback(async () => {
    setLoading(true);
    setLoadError(false);
    try {
      const result = await ApiService.getAddresses();
      if (result) {
        setAddresses(result.addresses);
        setDefaultId(result.defaultAddressId);
      } else {
        setLoadError(true);
      }
    } catch {
      setLoadError(true);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void load();
  }, [load]);

  const persist = async (next: AddressBookEntry[], nextDefault: string | null, successKey: string) => {
    setBusy(true);
    try {
      const result = await ApiService.saveAddresses(next, nextDefault);
      if (!result) throw new Error('save failed');
      setAddresses(result.addresses);
      setDefaultId(result.defaultAddressId);
      await refreshUser();
      showToast(t('account.addressesTitle'), t(successKey), 'success');
      return true;
    } catch (err) {
      const message = err instanceof ApiError ? err.message : t('account.addressFailed');
      showToast(t('account.addressesTitle'), message, 'error');
      return false;
    } finally {
      setBusy(false);
    }
  };

  const handleSetDefault = (id: string) => {
    if (busy || id === defaultId) return;
    void persist(addresses, id, 'account.defaultChanged');
  };

  const handleDelete = (entry: AddressBookEntry) => {
    if (entry.id === defaultId && addresses.length > 1) {
      showToast(t('account.addressesTitle'), t('account.cannotDeleteDefault'), 'warning');
      return;
    }
    setPendingDelete(entry);
  };

  const confirmDelete = async () => {
    if (!pendingDelete || busy) return;
    // Deleting the only/default address clears the default as well.
    const next = addresses.filter((a) => a.id !== pendingDelete.id);
    const nextDefault = pendingDelete.id === defaultId ? null : defaultId;
    const ok = await persist(next, nextDefault, 'account.addressDeleted');
    if (ok) setPendingDelete(null);
  };

  const defaultAddress = addresses.find((a) => a.id === defaultId) ?? null;
  const others = addresses.filter((a) => a.id !== defaultId);

  return (
    <section className="account-card" aria-labelledby="account-addresses-title">
      <header className="account-card-header account-card-header-split">
        <div className="account-card-header-main">
          <span className="account-card-icon" aria-hidden="true">
            <Icon name="mapPin" size={20} />
          </span>
          <div>
            <h3 id="account-addresses-title">{t('account.addressesTitle')}</h3>
            <p>{t('account.addressesDesc')}</p>
          </div>
        </div>
        <button
          type="button"
          className="btn btn-primary btn-sm"
          disabled={busy || loading}
          onClick={() => {
            if (addresses.length >= 10) {
              showToast(t('account.addressesTitle'), t('account.maxAddresses'), 'warning');
              return;
            }
            setEditing(null);
            setModalOpen(true);
          }}
        >
          <Icon name="plus" size={15} />
          {t('account.addNew')}
        </button>
      </header>

      {loading && (
        <div className="account-skeleton" aria-label={t('account.saving')}>
          <div className="skeleton account-skeleton-row" />
          <div className="skeleton account-skeleton-row" />
        </div>
      )}

      {!loading && loadError && (
        <div className="account-empty" role="alert">
          <p>{t('account.loadFailed')}</p>
          <button type="button" className="btn btn-outline btn-sm" onClick={() => void load()}>
            {t('account.retry')}
          </button>
        </div>
      )}

      {!loading && !loadError && addresses.length === 0 && (
        <div className="account-empty">
          <span className="account-empty-icon" aria-hidden="true">
            <Icon name="mapPin" size={26} />
          </span>
          <strong>{t('account.noAddresses')}</strong>
          <p>{t('account.noAddressesBody')}</p>
          <button
            type="button"
            className="btn btn-primary btn-sm"
            onClick={() => {
              setEditing(null);
              setModalOpen(true);
            }}
          >
            <Icon name="plus" size={15} />
            {t('account.addNew')}
          </button>
        </div>
      )}

      {!loading && !loadError && defaultAddress && (
        <>
          <h4 className="account-section-title account-section-title-row">
            {t('account.defaultShippingTitle')}
            <span className="account-badge-default">{t('account.defaultBadge')}</span>
          </h4>
          <article className="account-address-card account-address-default">
            <div className="account-address-top">
              <strong>{defaultAddress.label}</strong>
              <div className="account-address-actions">
                <button
                  type="button"
                  className="btn btn-outline btn-sm"
                  disabled={busy}
                  onClick={() => {
                    setEditing(defaultAddress);
                    setModalOpen(true);
                  }}
                >
                  {t('account.edit')}
                </button>
                <button
                  type="button"
                  className="btn btn-sm account-btn-danger-ghost"
                  disabled={busy}
                  onClick={() => handleDelete(defaultAddress)}
                  aria-label={`${t('account.delete')}: ${defaultAddress.label}`}
                >
                  <Icon name="trash" size={15} />
                </button>
              </div>
            </div>
            <p className="account-address-line">
              <Icon name="mapPin" size={15} />
              <span>{formatAddressSummary(defaultAddress)}</span>
            </p>
            <dl className="account-address-meta">
              <div>
                <dt>
                  <Icon name="building" size={14} />
                  {t('account.fieldStreet')}
                </dt>
                <dd>{defaultAddress.street}</dd>
              </div>
              <div>
                <dt>
                  <Icon name="building" size={14} />
                  {t('account.fieldBuilding')}
                </dt>
                <dd>{defaultAddress.building || '—'}</dd>
              </div>
              <div>
                <dt>
                  <Icon name="mapPin" size={14} />
                  {t('account.fieldArea')}
                </dt>
                <dd>{defaultAddress.area || '—'}</dd>
              </div>
              <div>
                <dt>
                  <Icon name="mapPin" size={14} />
                  {t('account.fieldCity')}
                </dt>
                <dd>{defaultAddress.city}</dd>
              </div>
              <div>
                <dt>
                  <Icon name="mail" size={14} />
                  {t('account.fieldPostal')}
                </dt>
                <dd dir="ltr">{defaultAddress.postalCode || '—'}</dd>
              </div>
              <div>
                <dt>
                  <Icon name="file" size={14} />
                  {t('account.fieldNotes')}
                </dt>
                <dd>{defaultAddress.deliveryNotes || '—'}</dd>
              </div>
            </dl>
          </article>
        </>
      )}

      {!loading && !loadError && others.length > 0 && (
        <>
          <h4 className="account-section-title">{t('account.otherAddresses')}</h4>
          <ul className="account-address-list">
            {others.map((entry) => (
              <li key={entry.id} className="account-address-card">
                <div className="account-address-top">
                  <span>
                    <Icon name="mapPin" size={15} aria-hidden="true" />
                    <strong>{entry.label}</strong>
                    <span className="account-address-summary">{formatAddressSummary(entry)}</span>
                  </span>
                  <div className="account-address-actions">
                    <button
                      type="button"
                      className="btn btn-outline btn-sm"
                      disabled={busy}
                      onClick={() => handleSetDefault(entry.id)}
                    >
                      {t('account.setDefault')}
                    </button>
                    <button
                      type="button"
                      className="btn btn-outline btn-sm"
                      disabled={busy}
                      onClick={() => {
                        setEditing(entry);
                        setModalOpen(true);
                      }}
                    >
                      {t('account.edit')}
                    </button>
                    <button
                      type="button"
                      className="btn btn-sm account-btn-danger-ghost"
                      disabled={busy}
                      onClick={() => handleDelete(entry)}
                      aria-label={`${t('account.delete')}: ${entry.label}`}
                    >
                      <Icon name="trash" size={15} />
                    </button>
                  </div>
                </div>
              </li>
            ))}
          </ul>
        </>
      )}

      <AddressModal
        open={modalOpen}
        initial={editing}
        isDefault={editing ? editing.id === defaultId : addresses.length === 0}
        busy={busy}
        onClose={() => setModalOpen(false)}
        onSave={async (entry, makeDefault) => {
          const exists = addresses.some((a) => a.id === entry.id);
          const next = exists ? addresses.map((a) => (a.id === entry.id ? entry : a)) : [...addresses, entry];
          const nextDefault = makeDefault ? entry.id : defaultId;
          const ok = await persist(next, nextDefault, 'account.addressSaved');
          if (ok) setModalOpen(false);
        }}
      />

      <AnimatedModal open={pendingDelete !== null} role="alertdialog" ariaLabel={t('account.deleteAddressTitle')}>
        <div className="account-modal">
          <h3>{t('account.deleteAddressTitle')}</h3>
          <p>{t('account.deleteAddressBody')}</p>
          <div className="account-modal-actions">
            <button type="button" className="btn btn-outline" onClick={() => setPendingDelete(null)}>
              {t('account.cancel')}
            </button>
            <button type="button" className="btn btn-danger" disabled={busy} onClick={() => void confirmDelete()}>
              {t('account.deleteConfirm')}
            </button>
          </div>
        </div>
      </AnimatedModal>
    </section>
  );
};
