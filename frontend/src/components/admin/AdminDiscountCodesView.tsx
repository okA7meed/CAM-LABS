import React, { useCallback, useEffect, useState } from 'react';
import { useStore } from '../../context/StoreContext';
import { useAuth } from '../../context/AuthContext';
import { ApiService } from '../../services/api';
import { AdminLayout } from './AdminLayout';
import { AdminCard, AdminCardBody } from './ui/Card';
import { Button } from './ui/Button';
import { LoadingRows, EmptyState, ErrorState } from './ui/States';
import { StatusBadge } from './ui/StatusBadge';
import { CouponForm, CouponFormPayload, emptyCouponForm } from './CouponForm';

const isSuperAdmin = (role?: string) => role === 'SUPER_ADMIN';

export const AdminDiscountCodesView: React.FC = () => {
  const { showToast, openAdminCouponDetail, setActiveView } = useStore();
  const { currentUser } = useAuth();
  const [coupons, setCoupons] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [showCreate, setShowCreate] = useState(false);
  const [saving, setSaving] = useState(false);

  const superAdmin = isSuperAdmin(currentUser?.role);

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const res = await ApiService.adminListCoupons(true);
      setCoupons(res?.coupons || []);
    } catch (e: any) {
      setError(e?.message || 'Coupons could not be loaded.');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void load();
  }, [load]);

  const create = async (payload: CouponFormPayload) => {
    if (!superAdmin) {
      showToast('Forbidden', 'Only Super Admin can manage coupons.', 'error');
      return;
    }
    setSaving(true);
    try {
      await ApiService.adminCreateCoupon({ ...payload, isEnabled: true, appliesToShipping: false });
      setShowCreate(false);
      showToast('Coupon created', payload.code.toUpperCase(), 'success');
      void load();
    } catch (e: any) {
      showToast('Create failed', e?.message || 'Could not create coupon.', 'error');
    } finally {
      setSaving(false);
    }
  };

  const toggle = async (c: any, enable: boolean) => {
    if (!superAdmin) {
      showToast('Forbidden', 'Only Super Admin can manage coupons.', 'error');
      return;
    }
    try {
      if (enable) await ApiService.adminEnableCoupon(c.id);
      else await ApiService.adminDisableCoupon(c.id);
      void load();
    } catch (e: any) {
      showToast('Update failed', e?.message || 'Could not update coupon.', 'error');
    }
  };

  return (
    <AdminLayout title="Discount Codes" subtitle="COMMERCE — Super Admin only for mutations">
      {showCreate && superAdmin ? (
        <CouponForm
          mode="create"
          initial={{ ...emptyCouponForm, code: 'CAM20' }}
          saving={saving}
          onSave={(payload) => void create(payload)}
          onClose={() => setShowCreate(false)}
        />
      ) : null}
      <AdminCard>
        <AdminCardBody>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 12 }}>
            <strong>{coupons.length} coupons</strong>
            {superAdmin ? (
              <Button onClick={() => setShowCreate((v) => !v)}>{showCreate ? 'Close' : 'Create Coupon'}</Button>
            ) : (
              <span style={{ fontSize: 12, opacity: 0.7 }}>View-only — Super Admin required to manage</span>
            )}
          </div>
          {loading ? <table className="admin-table"><tbody><LoadingRows cols={6} /></tbody></table> : error ? <ErrorState text={error} onRetry={load} retryLabel="Retry" /> : coupons.length === 0 ? <EmptyState text="No coupons" /> : (
            <div style={{ overflowX: 'auto' }}>
              <table className="admin-table">
                <thead><tr><th>Code</th><th>Type</th><th>Value</th><th>Status</th><th>Uses</th><th>Actions</th></tr></thead>
                <tbody>
                  {coupons.map((c) => (
                    <tr key={c.id}>
                      <td><strong>{c.code}</strong></td>
                      <td>{c.discountType} {c.discountType === 'PERCENTAGE' ? `${c.discountValue}%` : `${c.discountValue} EGP`}</td>
                      <td>max {c.maxDiscountAmount ?? '—'} · min {c.minQuoteAmount ?? '—'}</td>
                      <td><StatusBadge status={c.effectiveStatus} tone={c.effectiveStatus === 'Active' ? 'delivered' : c.effectiveStatus === 'Expired' ? 'cancelled' : 'review'} /></td>
                      <td>{c.totalUses ?? 0}{c.maxTotalUses != null ? ` / ${c.maxTotalUses}` : ''}</td>
                      <td style={{ display: 'flex', gap: 8 }}>
                        <Button onClick={() => openAdminCouponDetail(c.id)}>View</Button>
                        {superAdmin ? (
                          c.isEnabled ? <Button onClick={() => toggle(c, false)}>Disable</Button> : <Button onClick={() => toggle(c, true)}>Reactivate</Button>
                        ) : null}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
          <div style={{ marginTop: 12 }}>
            <Button onClick={() => setActiveView('admin-quotes')}>Back to Quotes</Button>
          </div>
        </AdminCardBody>
      </AdminCard>
    </AdminLayout>
  );
};
