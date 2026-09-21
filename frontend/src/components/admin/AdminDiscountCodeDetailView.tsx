import React, { useCallback, useEffect, useState } from 'react';
import { useStore } from '../../context/StoreContext';
import { useAuth } from '../../context/AuthContext';
import { ApiService } from '../../services/api';
import { AdminLayout } from './AdminLayout';
import { AdminCard, AdminCardBody } from './ui/Card';
import { Button } from './ui/Button';
import { LoadingRows, ErrorState } from './ui/States';
import { CouponForm, CouponFormPayload, toDateTimeLocalInput } from './CouponForm';

export const AdminDiscountCodeDetailView: React.FC = () => {
  const { selectedAdminCouponId, showToast, setActiveView } = useStore();
  const { currentUser } = useAuth();
  const [data, setData] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);

  const superAdmin = currentUser?.role === 'SUPER_ADMIN';

  const load = useCallback(async () => {
    if (!selectedAdminCouponId) return;
    setLoading(true);
    setError(null);
    try {
      const res = await ApiService.adminGetCoupon(selectedAdminCouponId);
      if (!res) throw new Error('Could not load coupon.');
      setData(res as any);
    } catch (e: any) {
      setError(e?.message || 'Could not load coupon.');
    } finally {
      setLoading(false);
    }
  }, [selectedAdminCouponId]);

  useEffect(() => {
    void load();
  }, [load]);

  const save = async (payload: CouponFormPayload) => {
    if (!superAdmin || !selectedAdminCouponId) return;
    setSaving(true);
    try {
      await ApiService.adminUpdateCoupon(selectedAdminCouponId, { ...payload });
      showToast('Coupon updated', 'Historical quote snapshots are preserved.', 'success');
      void load();
    } catch (e: any) {
      showToast('Update failed', e?.message || 'Could not update.', 'error');
    } finally {
      setSaving(false);
    }
  };

  if (!selectedAdminCouponId) {
    return (
      <AdminLayout title="Coupon Details" subtitle="No coupon selected">
        <Button onClick={() => setActiveView('admin-discount-codes')}>Back</Button>
      </AdminLayout>
    );
  }

  return (
    <AdminLayout title={`Coupon ${data?.coupon?.code || ''}`} subtitle="Usage history & analytics (server truth)">
      {loading ? <table className="admin-table"><tbody><LoadingRows cols={4} /></tbody></table> : error ? <ErrorState text={error} onRetry={load} retryLabel="Retry" /> : data ? (
        <>
          {superAdmin && data.coupon ? (
            <CouponForm
              mode="edit"
              initial={{
                code: data.coupon.code || '',
                discountType: data.coupon.discountType === 'FIXED' ? 'FIXED' : 'PERCENTAGE',
                discountValue: Number(data.coupon.discountValue) || 0,
                maxDiscountAmount: data.coupon.maxDiscountAmount ?? null,
                minQuoteAmount: data.coupon.minQuoteAmount ?? null,
                maxTotalUses: data.coupon.maxTotalUses ?? null,
                usageLimitPerCustomer: data.coupon.usageLimitPerCustomer ?? null,
                startAt: toDateTimeLocalInput(data.coupon.startAt),
                expiresAt: toDateTimeLocalInput(data.coupon.expiresAt),
                discountScope: data.coupon.discountScope === 'INCLUDING_SHIPPING' ? 'INCLUDING_SHIPPING' : 'SUBTOTAL_ONLY',
              }}
              saving={saving}
              onSave={(payload) => void save(payload)}
              onClose={() => setActiveView('admin-discount-codes')}
            />
          ) : null}
          <AdminCard>
            <AdminCardBody>
              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit,minmax(160px,1fr))', gap: 12 }}>
                <div><div>Code</div><strong>{data.coupon.code}</strong></div>
                <div><div>Discount</div><strong>{data.coupon.discountType} {data.coupon.discountValue}{data.coupon.discountType === 'PERCENTAGE' ? '%' : ' EGP'}</strong></div>
                <div><div>Status</div><strong>{data.coupon.effectiveStatus}</strong></div>
                <div><div>Total Uses</div><strong>{data.totalUses}</strong></div>
                <div><div>Unique Customers</div><strong>{data.uniqueCustomers}</strong></div>
                <div><div>Max Uses</div><strong>{data.coupon.maxTotalUses ?? 'Unlimited'}</strong></div>
                <div><div>Remaining</div><strong>{data.remainingUses ?? 'Unlimited'}</strong></div>
              </div>
            </AdminCardBody>
          </AdminCard>
          <AdminCard>
            <AdminCardBody>
              <strong>Usage history ({data.usages?.length || 0})</strong>
              <div style={{ overflowX: 'auto', marginTop: 8 }}>
                <table className="admin-table">
                  <thead><tr><th>Customer</th><th>Quote Ref</th><th>Date</th><th>Eligible</th><th>Discount</th><th>After</th></tr></thead>
                  <tbody>
                    {(data.usages || []).map((u: any) => (
                      <tr key={u.id}>
                        <td>{u.user ? `${u.user.name} (${u.user.email})` : u.userId || '—'}<div style={{ fontSize: 11, opacity: 0.7 }}>{u.userId || ''}</div></td>
                        <td>{u.quoteReference || u.quoteId || '—'}</td>
                        <td>{new Date(u.createdAt).toLocaleString()}</td>
                        <td>{Number(u.eligibleAmountSnapshot).toFixed(2)}</td>
                        <td>−{Number(u.discountAmountApplied).toFixed(2)}</td>
                        <td>{Number(u.amountAfterDiscount).toFixed(2)}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
              <div style={{ marginTop: 12 }}>
                <Button onClick={() => setActiveView('admin-discount-codes')}>Back to Discount Codes</Button>
              </div>
            </AdminCardBody>
          </AdminCard>
        </>
      ) : null}
    </AdminLayout>
  );
};
