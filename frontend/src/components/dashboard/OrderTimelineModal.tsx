import React from 'react';
import { useStore } from '../../context/StoreContext';
import { useTranslation } from 'react-i18next';
import { Icon } from '../ui/Icon';

export const OrderTimelineModal: React.FC = () => {
  const { isOrderTimelineOpen, closeOrderTimeline, selectedOrder, showToast } = useStore();
  const { t } = useTranslation();

  if (!isOrderTimelineOpen || !selectedOrder) return null;

  const handleDownloadCmm = () => {
    showToast('CMM Inspection Downloaded', `ISO 9001:2015 Dimensional Scan Certificate for ${selectedOrder.id} downloaded.`, 'success');
  };

  return (
    <div className="modal-overlay active">
      <div className="modal-card modal-lg">
        <div className="modal-header">
          <div className="modal-title">
            {t('order.timelineTitle', { id: selectedOrder.id })}
          </div>
          <button className="modal-close" onClick={closeOrderTimeline}>
            <Icon name="close" size={20} />
          </button>
        </div>

        <div className="modal-body">
          <div
            style={{
              background: 'var(--cam-surface-2)',
              padding: 'var(--space-4)',
              borderRadius: 'var(--radius-sm)',
              marginBottom: 'var(--space-6)',
              display: 'grid',
              gridTemplateColumns: 'repeat(auto-fit, minmax(180px, 1fr))',
              gap: 'var(--space-4)',
              fontFamily: 'var(--font-mono)',
              fontSize: '0.8125rem',
            }}
          >
            <div>
              <span style={{ color: 'var(--cam-text-muted)' }}>{t('order.component')}</span>
              <br />
              <strong style={{ color: 'var(--cam-text-primary)' }}>{selectedOrder.partName}</strong>
            </div>
            <div>
              <span style={{ color: 'var(--cam-text-muted)' }}>{t('order.process')}</span>
              <br />
              <strong style={{ color: 'var(--cam-text-primary)' }}>{selectedOrder.technology}</strong>
            </div>
            <div>
              <span style={{ color: 'var(--cam-text-muted)' }}>{t('order.delivery')}</span>
              <br />
              <strong style={{ color: 'var(--cam-text-primary)' }}>{selectedOrder.estDelivery}</strong>
            </div>
            <div>
              <span style={{ color: 'var(--cam-text-muted)' }}>{t('order.material')}</span>
              <br />
              <strong style={{ color: 'var(--cam-text-primary)' }}>{selectedOrder.material}</strong>
            </div>
            <div>
              <span style={{ color: 'var(--cam-text-muted)' }}>{t('order.batchQty')}</span>
              <br />
              <strong style={{ color: 'var(--cam-text-primary)' }}>{selectedOrder.quantity} {t('order.units')}</strong>
            </div>
            <div>
              <span style={{ color: 'var(--cam-text-muted)' }}>{t('order.tracking')}</span>
              <br />
              <strong style={{ color: 'var(--cam-blue-primary)' }}>{selectedOrder.trackingNum || t('order.assigning')}</strong>
            </div>
          </div>

          <h4 style={{ marginBottom: 'var(--space-3)' }}>{t('order.milestones')}</h4>
          <div className="timeline-track">
            {selectedOrder.history.map((h, i) => (
              <div
                key={h.step}
                className={`timeline-node ${h.done ? 'completed' : i === selectedOrder.progressStep ? 'active' : ''}`}
              >
                <div className="timeline-dot">{h.done && <Icon name="check" size={12} />}</div>
                <div className="timeline-node-title">{h.step}</div>
                <div className="timeline-node-time">
                  {h.date} — {h.desc}
                </div>
              </div>
            ))}
          </div>

          <div
            style={{
              marginTop: 'var(--space-6)',
              paddingTop: 'var(--space-4)',
              borderTop: '1px solid var(--cam-border-subtle)',
              display: 'flex',
              justifyContent: 'space-between',
              alignItems: 'center',
              flexWrap: 'wrap',
              gap: 'var(--space-3)',
            }}
          >
            <div style={{ fontFamily: 'var(--font-mono)', fontSize: '0.75rem', color: 'var(--cam-text-muted)' }}>
              {t('order.qaNode')}
            </div>
            <button className="btn btn-sm btn-outline-blue" onClick={handleDownloadCmm}>
              <Icon name="file" size={15} />{t('order.downloadCmm')}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};
