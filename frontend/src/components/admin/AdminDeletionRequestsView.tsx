import React, { useCallback, useEffect, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { useStore } from '../../context/StoreContext';
import { AdminLayout } from './AdminLayout';
import { StatCard } from './ui/StatCard';
import { AdminCard, AdminCardBody } from './ui/Card';
import { Button } from './ui/Button';
import { AdminFilterSelect } from './ui/Fields';
import { LoadingRows, EmptyState, ErrorState } from './ui/States';
import { StatusBadge } from './ui/StatusBadge';
import { ApiService } from '../../services/api';

type DeletionRequest = {
  id: string;
  quoteId: string;
  requestedByUserId: string;
  status: 'PENDING' | 'APPROVED' | 'REJECTED';
  reason?: string | null;
  requestedAt: string;
  reviewedAt?: string | null;
  adminNote?: string | null;
  quoteReference?: string | null;
  quotePartName?: string | null;
  customerName?: string | null;
  customerEmail?: string | null;
  quote?: {
    id: string;
    reference?: string | null;
    partName?: string;
    status?: string;
    user?: { id: string; name: string; email: string; company?: string } | null;
  } | null;
};

const TONES: Record<string, 'review' | 'delivered' | 'cancelled' | 'unknown'> = {
  PENDING: 'review',
  APPROVED: 'delivered',
  REJECTED: 'cancelled',
};

/**
 * Super Admin deletion-request queue: customer, CAM reference, Quote ID,
 * request date, Quote status, reason, and current request status — with
 * Approve Delete / Reject Delete Request actions (authorized roles only,
 * enforced server-side).
 */
export const AdminDeletionRequestsView: React.FC = () => {
  const { t } = useTranslation();
  const { openAdminQuoteDetail, showToast } = useStore();
  const [requests, setRequests] = useState<DeletionRequest[]>([]);
  const [filter, setFilter] = useState('');
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [actingId, setActingId] = useState<string | null>(null);
  const [noteById, setNoteById] = useState<Record<string, string>>({});

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const data = await ApiService.adminListDeletionRequests(filter || undefined);
      setRequests((data?.requests || []) as DeletionRequest[]);
    } catch (err: any) {
      setError(err?.message || String(err));
    } finally {
      setLoading(false);
    }
  }, [filter]);

  useEffect(() => {
    void load();
  }, [load]);

  const pending = requests.filter((r) => r.status === 'PENDING').length;

  const act = async (req: DeletionRequest, decision: 'approve' | 'reject') => {
    setActingId(req.id);
    try {
      const note = (noteById[req.id] || '').trim();
      if (decision === 'approve') {
        await ApiService.adminApproveDeletionRequest(req.id, note || undefined);
        showToast('Deletion approved', `Quote ${req.quote?.reference || req.quoteId} was removed from active quotes.`, 'success');
      } else {
        await ApiService.adminRejectDeletionRequest(req.id, note || undefined);
        showToast('Request rejected', `Quote ${req.quote?.reference || req.quoteId} remains active.`, 'info');
      }
      await load();
    } catch (err: any) {
      showToast('Action failed', err?.message || 'The request could not be completed.', 'error');
    } finally {
      setActingId(null);
    }
  };

  return (
    <AdminLayout title="Quote Deletion Requests" subtitle={`${requests.length} requests · ${pending} pending`}>
      <div className="admin-section">
        <div className="admin-kpi-grid">
          <StatCard title="Total Requests" value={requests.length} icon="trash" tone="blue" />
          <StatCard title="Pending Review" value={pending} icon="clock" tone="amber" />
          <StatCard title="Approved" value={requests.filter((r) => r.status === 'APPROVED').length} icon="check" tone="green" />
          <StatCard title="Rejected" value={requests.filter((r) => r.status === 'REJECTED').length} icon="close" tone="magenta" />
        </div>

        <div className="admin-toolbar">
          <AdminFilterSelect
            icon="filter"
            value={filter}
            onChange={setFilter}
            ariaLabel="Request status"
            options={[
              { value: '', label: 'All statuses' },
              { value: 'PENDING', label: 'Pending' },
              { value: 'APPROVED', label: 'Approved' },
              { value: 'REJECTED', label: 'Rejected' },
            ]}
          />
          <Button variant="ghost" size="sm" icon="reset" onClick={() => void load()}>
            {t('admin.lists.retry')}
          </Button>
        </div>

        <AdminCard>
          <AdminCardBody flush>
            {error ? (
              <ErrorState text={error} onRetry={() => void load()} retryLabel={t('admin.lists.retry')} />
            ) : requests.length === 0 && !loading ? (
              <EmptyState icon="trash" text="No deletion requests." />
            ) : (
              <div className="admin-table-wrap">
                <table className="admin-table">
                  <thead>
                    <tr>
                      <th>Customer</th>
                      <th>CAM Reference</th>
                      <th>Quote ID</th>
                      <th>Request Date</th>
                      <th>Quote Status</th>
                      <th>Reason</th>
                      <th>Request Status</th>
                      <th>Admin Note</th>
                      <th>Actions</th>
                    </tr>
                  </thead>
                  <tbody>
                    {loading ? (
                      <LoadingRows cols={9} />
                    ) : (
                      requests.map((req) => (
                        <tr key={req.id}>
                          <td>
                            <div>{req.quote?.user?.name || req.customerName || '—'}</div>
                            <div className="mono-muted">{req.quote?.user?.email || req.customerEmail || ''}</div>
                          </td>
                          <td className="mono-primary" dir="ltr">{req.quote?.reference || req.quoteReference || '—'}</td>
                          <td className="mono-muted" dir="ltr">{req.quoteId || '—'}</td>
                          <td className="mono-muted">{new Date(req.requestedAt).toLocaleDateString()}</td>
                          <td>{req.quote?.status || '—'}</td>
                          <td>{req.reason || '—'}</td>
                          <td>
                            <StatusBadge status={req.status} tone={TONES[req.status] ?? 'unknown'} />
                          </td>
                          <td>
                            {req.status === 'PENDING' ? (
                              <input
                                className="form-control"
                                value={noteById[req.id] || ''}
                                disabled={actingId === req.id}
                                onChange={(e) => setNoteById((prev) => ({ ...prev, [req.id]: e.target.value }))}
                                placeholder="Admin note (optional)"
                                aria-label={`Admin note for ${req.quoteId}`}
                              />
                            ) : (
                              req.adminNote || '—'
                            )}
                          </td>
                          <td>
                            <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6 }}>
                              <Button variant="outline" size="sm" icon="eye" onClick={() => openAdminQuoteDetail(req.quoteId)}>
                                {t('admin.lists.view')}
                              </Button>
                              {req.status === 'PENDING' && (
                                <>
                                  <Button
                                    variant="primary"
                                    size="sm"
                                    icon="check"
                                    disabled={actingId === req.id}
                                    loading={actingId === req.id}
                                    onClick={() => void act(req, 'approve')}
                                  >
                                    Approve Delete
                                  </Button>
                                  <Button variant="outline" size="sm" icon="close" disabled={actingId === req.id} onClick={() => void act(req, 'reject')}>
                                    Reject
                                  </Button>
                                </>
                              )}
                            </div>
                          </td>
                        </tr>
                      ))
                    )}
                  </tbody>
                </table>
              </div>
            )}
          </AdminCardBody>
        </AdminCard>
      </div>
    </AdminLayout>
  );
};
