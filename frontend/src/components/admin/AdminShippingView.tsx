import React, { useCallback, useEffect, useState } from 'react';
import { useStore } from '../../context/StoreContext';
import { useAuth } from '../../context/AuthContext';
import { ApiService } from '../../services/api';
import { AdminLayout } from './AdminLayout';
import { AdminCard, AdminCardBody } from './ui/Card';
import { Button } from './ui/Button';
import { LoadingRows, EmptyState, ErrorState } from './ui/States';
import { StatusBadge } from './ui/StatusBadge';
import { ShippingMethodForm, ShippingMethodFormValue, emptyShippingForm } from './ShippingMethodForm';

const isSuperAdmin = (role?: string) => role === 'SUPER_ADMIN';

export const AdminShippingView: React.FC = () => {
  const { showToast } = useStore();
  const { currentUser } = useAuth();
  const [methods, setMethods] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [showCreate, setShowCreate] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [form, setForm] = useState<ShippingMethodFormValue>(emptyShippingForm);
  const [saving, setSaving] = useState(false);

  const superAdmin = isSuperAdmin(currentUser?.role);

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const res = await ApiService.adminListShippingMethods(true);
      setMethods(res?.methods || []);
    } catch (e: any) {
      setError(e?.message || 'Shipping methods could not be loaded.');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void load();
  }, [load]);

  const openCreate = () => {
    setEditingId(null);
    setForm(emptyShippingForm);
    setShowCreate(true);
  };

  const openEdit = (m: any) => {
    setEditingId(m.id);
    setForm({
      code: m.code || '',
      name: m.name || '',
      description: m.description || '',
      eta: m.eta || '',
      priceEgp: Number(m.priceEgp) || 0,
      sortOrder: Number(m.sortOrder) || 0,
      isEnabled: m.isEnabled !== false,
    });
    setShowCreate(true);
  };

  const save = async (value: ShippingMethodFormValue) => {
    if (!superAdmin) {
      showToast('Forbidden', 'Only Super Admin can manage shipping methods.', 'error');
      return;
    }
    setSaving(true);
    try {
      const payload = {
        code: value.code,
        name: value.name.trim(),
        description: value.description.trim(),
        eta: value.eta.trim(),
        priceEgp: Number(value.priceEgp) || 0,
        sortOrder: Number(value.sortOrder) || 0,
        isEnabled: value.isEnabled,
      };
      if (editingId) {
        await ApiService.adminUpdateShippingMethod(editingId, payload);
        showToast('Shipping method updated', value.code.toUpperCase(), 'success');
      } else {
        await ApiService.adminCreateShippingMethod(payload);
        showToast('Shipping method created', value.code.toUpperCase(), 'success');
      }
      setShowCreate(false);
      setEditingId(null);
      void load();
    } catch (e: any) {
      showToast('Save failed', e?.message || 'Could not save shipping method.', 'error');
    } finally {
      setSaving(false);
    }
  };

  const toggle = async (m: any, enable: boolean) => {
    if (!superAdmin) {
      showToast('Forbidden', 'Only Super Admin can manage shipping methods.', 'error');
      return;
    }
    try {
      if (enable) await ApiService.adminEnableShippingMethod(m.id);
      else await ApiService.adminDisableShippingMethod(m.id);
      showToast(enable ? 'Shipping method enabled' : 'Shipping method disabled', m.code, 'success');
      void load();
    } catch (e: any) {
      showToast('Update failed', e?.message || 'Could not update shipping method.', 'error');
    }
  };

  const archive = async (m: any) => {
    if (!superAdmin) {
      showToast('Forbidden', 'Only Super Admin can manage shipping methods.', 'error');
      return;
    }
    try {
      await ApiService.adminArchiveShippingMethod(m.id);
      showToast('Shipping method archived', m.code, 'success');
      void load();
    } catch (e: any) {
      showToast('Archive failed', e?.message || 'Could not archive shipping method.', 'error');
    }
  };

  return (
    <AdminLayout title="Shipping Methods" subtitle="MANUFACTURING — Super Admin only for mutations">
      {showCreate && superAdmin ? (
        <ShippingMethodForm
          mode={editingId ? 'edit' : 'create'}
          initial={form}
          saving={saving}
          onSave={(value) => void save(value)}
          onClose={() => {
            setShowCreate(false);
            setEditingId(null);
          }}
        />
      ) : null}
      <AdminCard>
        <AdminCardBody>
          {showCreate && superAdmin ? null : (
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 12 }}>
            <strong>{methods.length} shipping methods</strong>
            {superAdmin ? (
              <Button onClick={() => (showCreate ? setShowCreate(false) : openCreate())}>{showCreate ? 'Close' : 'Create Method'}</Button>
            ) : (
              <span style={{ fontSize: 12, opacity: 0.7 }}>View-only — Super Admin required to manage</span>
            )}
          </div>
          )}
          {loading ? (
            <table className="admin-table"><tbody><LoadingRows cols={5} /></tbody></table>
          ) : error ? (
            <ErrorState text={error} onRetry={load} retryLabel="Retry" />
          ) : methods.length === 0 ? (
            <EmptyState text="No shipping methods" />
          ) : (
            <div style={{ overflowX: 'auto' }}>
              <table className="admin-table">
                <thead><tr><th>Method</th><th>Price</th><th>ETA</th><th>Status</th><th>Updated</th><th>Actions</th></tr></thead>
                <tbody>
                  {methods.map((m) => (
                    <tr key={m.id}>
                      <td><strong>{m.name}</strong><div style={{ fontSize: 11, opacity: 0.7 }}>{m.code}</div></td>
                      <td>{Number(m.priceEgp).toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })} {m.currency || 'EGP'}</td>
                      <td>{m.eta || '—'}</td>
                      <td><StatusBadge status={m.effectiveStatus || (m.isEnabled ? 'Active' : 'Inactive')} /></td>
                      <td>{m.updatedAt ? new Date(m.updatedAt).toLocaleString() : '—'}</td>
                      <td style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
                        {superAdmin ? (
                          <>
                            <Button onClick={() => openEdit(m)}>Edit</Button>
                            {m.isEnabled ? <Button onClick={() => toggle(m, false)}>Disable</Button> : <Button onClick={() => toggle(m, true)}>Re-enable</Button>}
                            {!m.archivedAt ? <Button onClick={() => archive(m)}>Archive</Button> : null}
                          </>
                        ) : null}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
          <p style={{ fontSize: 12, opacity: 0.7, marginTop: 12 }}>
            Disabled methods are hidden from customers and rejected at submission. Archived methods are kept for history —
            submitted quotes preserve their shipping snapshot and never change retroactively.
          </p>
        </AdminCardBody>
      </AdminCard>
    </AdminLayout>
  );
};
