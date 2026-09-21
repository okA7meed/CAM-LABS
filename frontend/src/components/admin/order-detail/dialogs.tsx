import React, { useEffect, useRef, useState } from 'react';
import { Button } from '../ui/Button';
import { Icon } from '../../ui/Icon';
import { AnimatedModal } from '../../ui/AnimatedModal';

/** Message-customer dialog: recipient context + validated textarea + guarded send. */
export const MessageCustomerDialog: React.FC<{
  open: boolean;
  customerName?: string | null;
  customerEmail?: string | null;
  orderId: string;
  sending: boolean;
  error: string | null;
  onClose: () => void;
  onSend: (message: string) => void;
}> = ({ open, customerName, customerEmail, orderId, sending, error, onClose, onSend }) => {
  const [message, setMessage] = useState('');
  const [touched, setTouched] = useState(false);
  const areaRef = useRef<HTMLTextAreaElement>(null);
  const trimmed = message.trim();
  const invalid = touched && trimmed.length === 0;

  useEffect(() => {
    if (open) {
      setMessage('');
      setTouched(false);
      window.setTimeout(() => areaRef.current?.focus(), 60);
    }
  }, [open]);

  useEffect(() => {
    if (!open) return;
    const onKey = (event: KeyboardEvent) => {
      if (event.key === 'Escape') onClose();
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [open, onClose]);

  return (
    <AnimatedModal
      open={open}
      role="dialog"
      ariaLabel={`Message customer about order ${orderId}`}
      onOverlayMouseDown={(e) => {
        if (e.target === e.currentTarget && !sending) onClose();
      }}
    >
      <div className="modal-header">
        <h3 className="modal-title">Message Customer</h3>
        <button type="button" className="btn btn-outline btn-sm" onClick={onClose} disabled={sending} aria-label="Close message dialog">
          <Icon name="close" size={13} />
          Cancel
        </button>
      </div>
      <div className="modal-body">
        <div className="od-recipient">
          <span className="od-recipient-label">To</span>
          <strong>{customerName || 'Customer'}</strong>
          {customerEmail ? <span className="admin-muted">{customerEmail}</span> : null}
          <span className="od-recipient-order">Re: Order {orderId}</span>
        </div>
        <label className="od-field-label" htmlFor="od-message-text">Message</label>
        <textarea
          id="od-message-text"
          ref={areaRef}
          className={`form-control od-textarea${invalid ? ' is-invalid' : ''}`}
          rows={5}
          maxLength={5000}
          value={message}
          disabled={sending}
          placeholder={`Write an update about order ${orderId}…`}
          onChange={(e) => setMessage(e.target.value)}
          onBlur={() => setTouched(true)}
        />
        <div className="od-dialog-meta">
          <span className={invalid ? 'od-error-text' : 'admin-muted'}>
            {invalid ? 'Enter a message before sending.' : `${trimmed.length}/5000 · recorded in the order history`}
          </span>
        </div>
        {error && (
          <div className="od-error-box" role="alert">
            <Icon name="alert" size={13} />
            {error}
          </div>
        )}
        <div className="od-dialog-actions">
          <Button variant="outline" onClick={onClose} disabled={sending}>
            Cancel
          </Button>
          <Button
            variant="primary"
            icon="send"
            onClick={() => {
              setTouched(true);
              if (trimmed.length === 0) return;
              onSend(trimmed);
            }}
            disabled={sending || trimmed.length === 0}
            loading={sending}
          >
            Send Message
          </Button>
        </div>
      </div>
    </AnimatedModal>
  );
};

/** Price-override dialog: current vs new price, reason, audit notice, guarded save. */
export const EditPriceDialog: React.FC<{
  open: boolean;
  currentPrice?: string | null;
  currency: string;
  saving: boolean;
  error: string | null;
  onClose: () => void;
  onSave: (price: number, reason: string) => void;
}> = ({ open, currentPrice, currency, saving, error, onClose, onSave }) => {
  const [rawPrice, setRawPrice] = useState('');
  const [reason, setReason] = useState('');
  const [touched, setTouched] = useState(false);
  const price = Number(rawPrice);
  const priceValid = rawPrice.trim() !== '' && Number.isFinite(price) && price > 0;
  const showError = touched && !priceValid;

  useEffect(() => {
    if (open) {
      setRawPrice('');
      setReason('');
      setTouched(false);
    }
  }, [open ]);

  useEffect(() => {
    if (!open) return;
    const onKey = (event: KeyboardEvent) => {
      if (event.key === 'Escape') onClose();
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [open, onClose]);

  return (
    <AnimatedModal
      open={open}
      role="dialog"
      ariaLabel="Edit order price"
      onOverlayMouseDown={(e) => {
        if (e.target === e.currentTarget && !saving) onClose();
      }}
    >
      <div className="modal-header">
        <h3 className="modal-title">Edit Order Price</h3>
        <button type="button" className="btn btn-outline btn-sm" onClick={onClose} disabled={saving} aria-label="Close price dialog">
          <Icon name="close" size={13} />
          Cancel
        </button>
      </div>
      <div className="modal-body">
        <div className="od-price-current">
          <span className="od-field-label">Current Price</span>
          <strong>{currentPrice || '—'}</strong>
        </div>
        <label className="od-field-label" htmlFor="od-new-price">New Price ({currency})</label>
        <input
          id="od-new-price"
          className={`form-control${showError ? ' is-invalid' : ''}`}
          type="number"
          min="0"
          step="0.01"
          inputMode="decimal"
          value={rawPrice}
          disabled={saving}
          placeholder="0.00"
          onChange={(e) => setRawPrice(e.target.value)}
          onBlur={() => setTouched(true)}
        />
        {showError && <span className="od-error-text">Enter a valid positive price.</span>}
        <label className="od-field-label" htmlFor="od-price-reason">Adjustment Note / Reason</label>
        <textarea
          id="od-price-reason"
          className="form-control od-textarea"
          rows={3}
          maxLength={1000}
          value={reason}
          disabled={saving}
          placeholder="e.g. Additional finishing cost"
          onChange={(e) => setReason(e.target.value)}
        />
        <p className="admin-muted od-audit-note">This adjustment will be recorded in the order history.</p>
        {error && (
          <div className="od-error-box" role="alert">
            <Icon name="alert" size={13} />
            {error}
          </div>
        )}
        <div className="od-dialog-actions">
          <Button variant="outline" onClick={onClose} disabled={saving}>
            Cancel
          </Button>
          <Button
            variant="primary"
            onClick={() => {
              setTouched(true);
              if (!priceValid) return;
              onSave(price, reason.trim());
            }}
            disabled={saving || !priceValid}
            loading={saving}
          >
            Save Changes
          </Button>
        </div>
      </div>
    </AnimatedModal>
  );
};
