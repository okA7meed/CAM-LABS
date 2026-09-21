import React, { useEffect, useRef, useState } from 'react';
import { Button } from '../ui/Button';
import { Icon } from '../../ui/Icon';
import { ORDER_LIFECYCLE_STATUSES, canApproveOrder } from './types';
import { formatPlacedOn } from './format';

export const OrderHeader: React.FC<{
  orderId: string;
  cadBadge: string;
  cadBadgeTone: 'delivered' | 'review' | 'cancelled' | 'unknown';
  createdAt?: string | null;
  status: string;
  onBack: () => void;
  onDownloadPdf: () => void;
  pdfBusy: boolean;
  onMessage: () => void;
  onApprove: () => void;
  approveBusy: boolean;
  onStatusChange: (status: string) => void;
  statusBusy: boolean;
}> = ({ orderId, cadBadge, cadBadgeTone, createdAt, status, onBack, onDownloadPdf, pdfBusy, onMessage, onApprove, approveBusy, onStatusChange, statusBusy }) => {
  const [menuOpen, setMenuOpen] = useState(false);
  const menuRef = useRef<HTMLDivElement>(null);
  const approvable = canApproveOrder(status);

  useEffect(() => {
    if (!menuOpen) return;
    const onPointer = (event: PointerEvent) => {
      if (menuRef.current && !menuRef.current.contains(event.target as Node)) setMenuOpen(false);
    };
    const onKey = (event: KeyboardEvent) => {
      if (event.key === 'Escape') setMenuOpen(false);
    };
    document.addEventListener('pointerdown', onPointer);
    document.addEventListener('keydown', onKey);
    return () => {
      document.removeEventListener('pointerdown', onPointer);
      document.removeEventListener('keydown', onKey);
    };
  }, [menuOpen]);

  return (
    <div className="od-header">
      <div className="od-header-left">
        <button type="button" className="od-back" onClick={onBack}>
          <Icon name="arrowLeft" size={13} />
          Back to Orders
        </button>
        <h1 className="od-title">Order #{orderId}</h1>
        <div className="od-title-meta">
          <span className={`status-badge status-${cadBadgeTone}`}>
            <span className={`status-dot status-${cadBadgeTone}`} />
            {cadBadge}
          </span>
          <span className="od-placed">Placed on {formatPlacedOn(createdAt)}</span>
        </div>
      </div>
      <div className="od-actions">
        <Button variant="outline" size="sm" icon="download" onClick={onDownloadPdf} disabled={pdfBusy} loading={pdfBusy}>
          Download PDF
        </Button>
        <Button variant="outline" size="sm" icon="mail" onClick={onMessage}>
          Message Customer
        </Button>
        <div className="od-status-wrap" ref={menuRef}>
          <button
            type="button"
            className="btn btn-primary btn-sm od-status-btn"
            aria-haspopup="menu"
            aria-expanded={menuOpen}
            disabled={statusBusy}
            onClick={() => setMenuOpen((open) => !open)}
          >
            {statusBusy ? <Icon name="loader" size={13} className="admin-spin" /> : <Icon name="shieldCheck" size={13} />}
            {statusBusy ? 'Updating…' : 'Update Status'}
            <Icon name="chevronDown" size={13} />
          </button>
          {menuOpen && (
            <div className="admin-menu od-status-menu" role="menu" aria-label="Update order status">
              {approvable && (
                <>
                  <button type="button" role="menuitem" onClick={() => { setMenuOpen(false); onApprove(); }} disabled={approveBusy}>
                    <Icon name="check" size={13} />
                    {approveBusy ? 'Approving…' : 'Approve order — move to In Production'}
                  </button>
                  <div className="od-menu-sep" role="separator" aria-hidden="true" />
                </>
              )}
              {ORDER_LIFECYCLE_STATUSES.filter((s) => s !== status).map((next) => (
                <button
                  key={next}
                  type="button"
                  role="menuitem"
                  className="admin-menu-status"
                  onClick={() => { setMenuOpen(false); onStatusChange(next); }}
                  disabled={statusBusy}
                >
                  <span className="od-menu-dot" aria-hidden="true" />
                  Move to {next}
                </button>
              ))}
            </div>
          )}
        </div>
      </div>
    </div>
  );
};
