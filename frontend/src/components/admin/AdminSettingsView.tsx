import React, { useState, useEffect } from 'react';
import { useTranslation } from 'react-i18next';
import { useStore } from '../../context/StoreContext';
import { AdminLayout } from './AdminLayout';
import { ApiService } from '../../services/api';
import { AdminCard, AdminCardHeader, AdminCardBody } from './ui/Card';
import { Button } from './ui/Button';

export const AdminSettingsView: React.FC = () => {
  const { t } = useTranslation();
  const { showToast } = useStore();
  const [settings, setSettings] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [activeTab, setActiveTab] = useState('general');
  const [adminUrl, setAdminUrl] = useState('/admin');
  const [saving, setSaving] = useState(false);

  const load = async () => {
    setLoading(true);
    try {
      const data = await ApiService.getAdminSettings();
      setSettings(data);
      setAdminUrl(data?.admin?.adminUrl || '/admin');
    } catch (err: any) {
      showToast('Error', err.message, 'error');
    } finally { setLoading(false); }
  };

  useEffect(() => { load(); }, []);

  const tabs = [
    { key: 'general', label: t('admin.settings.tabs.general') },
    { key: 'admin', label: t('admin.settings.tabs.admin') },
    { key: 'upload', label: t('admin.settings.tabs.upload') },
    { key: 'manufacturing', label: t('admin.settings.tabs.manufacturing') },
    { key: 'notifications', label: t('admin.settings.tabs.notifications') },
    { key: 'system', label: t('admin.settings.tabs.system') },
  ];

  const renderSettingValue = (value: any) => {
    if (Array.isArray(value)) {
      return (
        <div style={{ display: 'flex', gap: '4px', flexWrap: 'wrap', justifyContent: 'flex-end' }}>
          {value.map((v: string) => (
            <span key={v} className="badge badge-neutral" style={{ fontSize: '10px' }}>{v}</span>
          ))}
        </div>
      );
    }
    if (typeof value === 'boolean') {
      return <span className={`badge ${value ? 'badge-primary' : 'badge-neutral'}`}>{value ? t('admin.settings.enabled') : t('admin.settings.disabled')}</span>;
    }
    return <span style={{ color: 'var(--admin-text)' }}>{String(value)}</span>;
  };

  const saveAdminUrl = async () => {
    setSaving(true);
    try {
      await ApiService.updateAdminSetting('admin', 'adminUrl', adminUrl, 'Configured admin route');
      window.history.replaceState({}, '', adminUrl || '/admin');
      showToast(t('admin.settings.savedToast'), t('admin.settings.adminUrlSaved'), 'success');
      await load();
    } catch (err: any) {
      showToast('Error', err.message || t('admin.settings.saveFailed'), 'error');
    } finally {
      setSaving(false);
    }
  };

  if (loading) {
    return <AdminLayout title={t('admin.settings.title')}><div style={{ textAlign: 'center', padding: '60px', color: 'var(--admin-text-muted)' }}>{t('admin.settings.loading')}</div></AdminLayout>;
  }

  return (
    <AdminLayout title={t('admin.settings.title')} subtitle={t('admin.settings.subtitle')}>
      <div className="admin-section">
        <div className="admin-toolbar">
          <div className="admin-toolbar-filters">
            {tabs.map((tab) => (
              <Button
                key={tab.key}
                variant={activeTab === tab.key ? 'primary' : 'outline'}
                size="sm"
                onClick={() => setActiveTab(tab.key)}
              >
                {tab.label}
              </Button>
            ))}
          </div>
        </div>

        {settings && (
          <AdminCard>
            <AdminCardHeader title={tabs.find((t) => t.key === activeTab)?.label ?? activeTab} description={t('admin.settings.subtitle')} />
            <AdminCardBody>
              {activeTab === 'admin' && (
                <div style={{ display: 'grid', gap: '12px', marginBottom: '16px' }}>
                  <div style={{ padding: '14px 16px', background: 'var(--admin-card-2)', borderRadius: '8px', border: '1px solid var(--admin-border)' }}>
                    <div className="admin-detail-label" style={{ marginBottom: '8px' }}>{t('admin.settings.adminUrl')}</div>
                    <div style={{ display: 'flex', gap: '8px', flexWrap: 'wrap' }}>
                      <input
                        className="form-control"
                        value={adminUrl}
                        onChange={(e) => setAdminUrl(e.target.value)}
                        placeholder="/admin"
                        style={{ minWidth: '240px', flex: 1 }}
                      />
                      <Button variant="primary" onClick={saveAdminUrl} loading={saving}>
                        {saving ? t('admin.saving') : t('admin.settings.saveAdminUrl')}
                      </Button>
                    </div>
                  </div>
                </div>
              )}

              <div style={{ display: 'grid', gap: '12px' }}>
                {Object.entries(settings[activeTab] || {}).filter(([key]) => !(activeTab === 'admin' && key === 'adminUrl')).map(([key, value]) => (
                  <div key={key} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: '16px', padding: '12px 16px', background: 'var(--admin-card-2)', borderRadius: '8px', border: '1px solid var(--admin-border)' }}>
                    <div className="admin-detail-label" style={{ textTransform: 'capitalize', marginBottom: 0 }}>
                      {key.replace(/([A-Z])/g, ' $1').trim()}
                    </div>
                    {renderSettingValue(value)}
                  </div>
                ))}
              </div>
            </AdminCardBody>
          </AdminCard>
        )}
      </div>
    </AdminLayout>
  );
};