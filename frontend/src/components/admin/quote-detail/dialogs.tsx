import React, { useEffect, useRef, useState } from 'react';
import { Button } from '../ui/Button';
import { Icon } from '../../ui/Icon';
import { AnimatedModal } from '../../ui/AnimatedModal';
import { formatQuoteDateTime } from './format';
import { QUOTE_LIFECYCLE_STATUSES, QuoteMessageVM } from './types';

const useEscape = (open: boolean, onClose: () => void) => {
  useEffect(() => {
    if (!open) return;
    const onKey = (event: KeyboardEvent) => {
      if (event.key === 'Escape') onClose();
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [open, onClose]);
};

export const QuoteMessageDialog: React.FC<{
  open: boolean;
  customerName?: string | null;
  quoteId: string;
  messages: QuoteMessageVM[];
  messagesLoading: boolean;
  sending: boolean;
  error: string | null;
  onClose: () => void;
  onSend: (message: string, subject: string) => void;
}> = ({ open, customerName, quoteId, messages, messagesLoading, sending, error, onClose, onSend }) => {
  const [message, setMessage] = useState('');
  const [subject, setSubject] = useState('');
  const [touched, setTouched] = useState(false);
  const areaRef = useRef<HTMLTextAreaElement>(null);
  const trimmed = message.trim();
  const invalid = touched && trimmed.length === 0;
  useEscape(open, () => {
    if (!sending) onClose();
  });

  useEffect(() => {
    if (open) {
      setMessage('');
      setSubject('');
      setTouched(false);
      window.setTimeout(() => areaRef.current?.focus(), 60);
    }
  }, [open ]);

  return (
    <AnimatedModal
      open={open}
      role="dialog"
      ariaLabel={`Send message about quote ${quoteId}`}
      onOverlayMouseDown={(e) => {
        if (e.target === e.currentTarget && !sending) onClose();
      }}
    >
      <div className="modal-header">
        <h3 className="modal-title">Send Message</h3>
        <button type="button" className="btn btn-outline btn-sm" onClick={onClose} disabled={sending} aria-label="Close message dialog">
          <Icon name="close" size={13} />
          Cancel
        </button>
      </div>
      <div className="modal-body">
        <div className="qd-recipient">
          <span className="qd-recipient-label">To</span>
          <strong>{customerName || 'Customer'}</strong>
          <span className="qd-recipient-order">Regarding: {quoteId}</span>
        </div>
        {messagesLoading ? (
          <p className="admin-muted">Loading message history…</p>
        ) : messages.length > 0 ? (
          <div className="qd-msg-history" aria-label="Previous messages">
            {messages.map((m) => (
              <div key={m.id} className="qd-msg-item">
                <div className="qd-msg-head">
                  <strong>{m.subject || 'Message'}</strong>
                  <span className="admin-muted">{formatQuoteDateTime(m.createdAt)}</span>
                </div>
                <p className="qd-msg-body">{m.message}</p>
              </div>
            ))}
          </div>
        ) : null}
        <label className="qd-field-label" htmlFor="qd-message-subject">Subject (optional)</label>
        <input
          id="qd-message-subject"
          className="form-control"
          maxLength={200}
          value={subject}
          disabled={sending}
          placeholder="e.g. Question about your RFQ"
          onChange={(e) => setSubject(e.target.value)}
        />
        <label className="qd-field-label" htmlFor="qd-message-text">Message</label>
        <textarea
          id="qd-message-text"
          ref={areaRef}
          className={`form-control qd-textarea${invalid ? ' is-invalid' : ''}`}
          rows={5}
          maxLength={5000}
          value={message}
          disabled={sending}
          placeholder={`Write a message about quote ${quoteId}…`}
          onChange={(e) => setMessage(e.target.value)}
          onBlur={() => setTouched(true)}
        />
        <div className="qd-dialog-meta">
          <span className={invalid ? 'qd-error-text' : 'admin-muted'}>
            {invalid ? 'Enter a message before sending.' : `${trimmed.length}/5000`}
          </span>
        </div>
        {error && (
          <div className="qd-error-box" role="alert">
            <Icon name="alert" size={13} />
            {error}
          </div>
        )}
        <div className="qd-dialog-actions">
          <Button variant="outline" onClick={onClose} disabled={sending}>
            Cancel
          </Button>
          <Button
            variant="primary"
            icon="send"
            onClick={() => {
              setTouched(true);
              if (trimmed.length === 0) return;
              onSend(trimmed, subject.trim());
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

export const QuoteStatusDialog: React.FC<{
  open: boolean;
  currentStatus: string;
  saving: boolean;
  error: string | null;
  onClose: () => void;
  onSave: (status: string, reason: string) => void;
}> = ({ open, currentStatus, saving, error, onClose, onSave }) => {
  const [status, setStatus] = useState(currentStatus);
  const [reason, setReason] = useState('');
  const [touched, setTouched] = useState(false);
  useEscape(open, () => {
    if (!saving) onClose();
  });

  useEffect(() => {
    if (open) {
      setStatus(currentStatus);
      setReason('');
      setTouched(false);
    }
  }, [open, currentStatus]);

  const needsReason = status === 'Rejected';
  const reasonOk = !needsReason || reason.trim().length >= 3;

  return (
    <AnimatedModal
      open={open}
      role="dialog"
      ariaLabel="Change quote status"
      onOverlayMouseDown={(e) => {
        if (e.target === e.currentTarget && !saving) onClose();
      }}
    >
      <div className="modal-header">
        <h3 className="modal-title">Change Status</h3>
        <button type="button" className="btn btn-outline btn-sm" onClick={onClose} disabled={saving} aria-label="Close status dialog">
          <Icon name="close" size={13} />
          Cancel
        </button>
      </div>
      <div className="modal-body">
        <div className="qd-status-list" role="radiogroup" aria-label="Quote status">
          {QUOTE_LIFECYCLE_STATUSES.filter((s) => s !== currentStatus).map((option) => (
            <label key={option} className={`qd-status-option${status === option ? ' is-selected' : ''}`}>
              <input
                type="radio"
                name="qd-status"
                value={option}
                checked={status === option}
                disabled={saving}
                onChange={() => setStatus(option)}
              />
              <span>{option}</span>
            </label>
          ))}
        </div>
        <label className="qd-field-label" htmlFor="qd-status-reason">
          Reason{needsReason ? ' (required for rejection)' : ' (optional)'}
        </label>
        <textarea
          id="qd-status-reason"
          className="form-control qd-textarea"
          rows={3}
          maxLength={1000}
          value={reason}
          disabled={saving}
          placeholder={needsReason ? 'Explain why this quote is rejected…' : 'Optional note recorded in the audit log…'}
          onChange={(e) => setReason(e.target.value)}
          onBlur={() => setTouched(true)}
        />
        {touched && !reasonOk && <span className="qd-error-text">A reason of at least 3 characters is required to reject.</span>}
        {error && (
          <div className="qd-error-box" role="alert">
            <Icon name="alert" size={13} />
            {error}
          </div>
        )}
        <div className="qd-dialog-actions">
          <Button variant="outline" onClick={onClose} disabled={saving}>
            Cancel
          </Button>
          <Button
            variant={status === 'Rejected' ? 'danger' : 'primary'}
            onClick={() => {
              setTouched(true);
              if (!reasonOk) return;
              onSave(status, reason.trim());
            }}
            disabled={saving || !reasonOk}
            loading={saving}
          >
            Save Status
          </Button>
        </div>
      </div>
    </AnimatedModal>
  );
};

export const QuoteRejectDialog: React.FC<{
  open: boolean;
  quoteId: string;
  saving: boolean;
  error: string | null;
  onClose: () => void;
  onConfirm: (reason: string) => void;
}> = ({ open, quoteId, saving, error, onClose, onConfirm }) => {
  const [reason, setReason] = useState('');
  const [touched, setTouched] = useState(false);
  useEscape(open, () => {
    if (!saving) onClose();
  });

  useEffect(() => {
    if (open) {
      setReason('');
      setTouched(false);
    }
  }, [open ]);

  const valid = reason.trim().length >= 3;

  return (
    <AnimatedModal
      open={open}
      role="alertdialog"
      ariaLabel={`Reject quote ${quoteId}`}
      onOverlayMouseDown={(e) => {
        if (e.target === e.currentTarget && !saving) onClose();
      }}
    >
      <div className="modal-header">
        <h3 className="modal-title">Reject Quote</h3>
        <button type="button" className="btn btn-outline btn-sm" onClick={onClose} disabled={saving} aria-label="Close reject dialog">
          <Icon name="close" size={13} />
          Cancel
        </button>
      </div>
      <div className="modal-body">
        <p className="qd-confirm-text">
          Rejecting <strong>{quoteId}</strong> marks it as <strong>Rejected</strong>. The customer will no longer be able to convert it, and
          this action is recorded in the audit log.
        </p>
        <label className="qd-field-label" htmlFor="qd-reject-reason">Rejection reason (required)</label>
        <textarea
          id="qd-reject-reason"
          className="form-control qd-textarea"
          rows={3}
          maxLength={1000}
          value={reason}
          disabled={saving}
          placeholder="e.g. Geometry is not manufacturable with the requested process…"
          onChange={(e) => setReason(e.target.value)}
          onBlur={() => setTouched(true)}
        />
        {touched && !valid && <span className="qd-error-text">A reason of at least 3 characters is required.</span>}
        {error && (
          <div className="qd-error-box" role="alert">
            <Icon name="alert" size={13} />
            {error}
          </div>
        )}
        <div className="qd-dialog-actions">
          <Button variant="outline" onClick={onClose} disabled={saving}>
            Cancel
          </Button>
          <Button
            variant="danger"
            icon="trash"
            onClick={() => {
              setTouched(true);
              if (!valid) return;
              onConfirm(reason.trim());
            }}
            disabled={saving || !valid}
            loading={saving}
          >
            Reject Quote
          </Button>
        </div>
      </div>
    </AnimatedModal>
  );
};

export const QuoteNotesDialog: React.FC<{
  open: boolean;
  initialNotes: string;
  saving: boolean;
  error: string | null;
  onClose: () => void;
  onSave: (notes: string) => void;
}> = ({ open, initialNotes, saving, error, onClose, onSave }) => {
  const [notes, setNotes] = useState(initialNotes);
  useEscape(open, () => {
    if (!saving) onClose();
  });

  useEffect(() => {
    if (open) setNotes(initialNotes);
  }, [open, initialNotes]);

  return (
    <AnimatedModal
      open={open}
      role="dialog"
      ariaLabel="Edit quote notes"
      onOverlayMouseDown={(e) => {
        if (e.target === e.currentTarget && !saving) onClose();
      }}
    >
      <div className="modal-header">
        <h3 className="modal-title">Edit Quote</h3>
        <button type="button" className="btn btn-outline btn-sm" onClick={onClose} disabled={saving} aria-label="Close edit dialog">
          <Icon name="close" size={13} />
          Cancel
        </button>
      </div>
      <div className="modal-body">
        <label className="qd-field-label" htmlFor="qd-edit-notes">Technical Notes</label>
        <textarea
          id="qd-edit-notes"
          className="form-control qd-textarea"
          rows={5}
          maxLength={500}
          value={notes}
          disabled={saving}
          placeholder="Customer-facing technical notes…"
          onChange={(e) => setNotes(e.target.value)}
        />
        <div className="qd-dialog-meta">
          <span className="admin-muted">{notes.trim().length}/500 · pricing and geometry stay engine-owned</span>
        </div>
        {error && (
          <div className="qd-error-box" role="alert">
            <Icon name="alert" size={13} />
            {error}
          </div>
        )}
        <div className="qd-dialog-actions">
          <Button variant="outline" onClick={onClose} disabled={saving}>
            Cancel
          </Button>
          <Button variant="primary" onClick={() => onSave(notes.trim())} disabled={saving} loading={saving}>
            Save Changes
          </Button>
        </div>
      </div>
    </AnimatedModal>
  );
};

export const QuotePriceDialog: React.FC<{
  open: boolean;
  currentPrice: string;
  systemPrice: string | null;
  currency: string;
  overrideMeta: string | null;
  saving: boolean;
  error: string | null;
  onClose: () => void;
  onSave: (price: number, reason: string) => void;
}> = ({ open, currentPrice, systemPrice, currency, overrideMeta, saving, error, onClose, onSave }) => {
  const [rawPrice, setRawPrice] = useState('');
  const [reason, setReason] = useState('');
  const [touched, setTouched] = useState(false);
  const price = Number(rawPrice);
  const priceValid = rawPrice.trim() !== '' && Number.isFinite(price) && price > 0;
  const reasonValid = reason.trim().length >= 3;
  useEscape(open, () => {
    if (!saving) onClose();
  });

  useEffect(() => {
    if (open) {
      setRawPrice('');
      setReason('');
      setTouched(false);
    }
  }, [open ]);

  const currentNumeric = Number(String(currentPrice).replace(/[^0-9.-]+/g, ''));
  const diff = priceValid && Number.isFinite(currentNumeric) ? price - currentNumeric : null;

  return (
    <AnimatedModal
      open={open}
      role="dialog"
      ariaLabel="Edit quote price"
      onOverlayMouseDown={(e) => {
        if (e.target === e.currentTarget && !saving) onClose();
      }}
    >
      <div className="modal-header">
        <h3 className="modal-title">Edit Quote Price</h3>
        <button type="button" className="btn btn-outline btn-sm" onClick={onClose} disabled={saving} aria-label="Close price dialog">
          <Icon name="close" size={13} />
          Cancel
        </button>
      </div>
      <div className="modal-body">
        <div className="qd-price-current">
          <span className="qd-field-label">Current Price</span>
          <strong>{currentPrice}</strong>
          {systemPrice && systemPrice !== currentPrice && (
            <span className="admin-muted">System calculated: {systemPrice}</span>
          )}
          {overrideMeta && <span className="admin-muted">{overrideMeta}</span>}
        </div>
        <label className="qd-field-label" htmlFor="qd-new-price">New Price ({currency})</label>
        <input
          id="qd-new-price"
          className={`form-control${touched && !priceValid ? ' is-invalid' : ''}`}
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
        {touched && !priceValid && <span className="qd-error-text">Enter a valid positive price.</span>}
        {diff !== null && (
          <p className={`qd-diff${diff >= 0 ? ' is-positive' : ' is-negative'}`}>
            Difference: {diff >= 0 ? '+' : '−'}{Math.abs(diff).toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })} {currency}
          </p>
        )}
        <label className="qd-field-label" htmlFor="qd-price-reason">Reason / Notes (required)</label>
        <textarea
          id="qd-price-reason"
          className="form-control qd-textarea"
          rows={3}
          maxLength={1000}
          value={reason}
          disabled={saving}
          placeholder="e.g. Customer loyalty discount on material cost"
          onChange={(e) => setReason(e.target.value)}
          onBlur={() => setTouched(true)}
        />
        {touched && !reasonValid && <span className="qd-error-text">A reason of at least 3 characters is required.</span>}
        <p className="admin-muted qd-audit-note">The engine-calculated price is preserved and this adjustment is recorded in the audit log.</p>
        {error && (
          <div className="qd-error-box" role="alert">
            <Icon name="alert" size={13} />
            {error}
          </div>
        )}
        <div className="qd-dialog-actions">
          <Button variant="outline" onClick={onClose} disabled={saving}>
            Cancel
          </Button>
          <Button
            variant="primary"
            onClick={() => {
              setTouched(true);
              if (!priceValid || !reasonValid) return;
              onSave(price, reason.trim());
            }}
            disabled={saving || !priceValid || !reasonValid}
            loading={saving}
          >
            Save Price
          </Button>
        </div>
      </div>
    </AnimatedModal>
  );
};

export const QuoteConvertDialog: React.FC<{
  open: boolean;
  quoteId: string;
  totalPrice: string;
  converting: boolean;
  error: string | null;
  orderId: string | null;
  onClose: () => void;
  onConfirm: () => void;
  onViewOrder: () => void;
}> = ({ open, quoteId, totalPrice, converting, error, orderId, onClose, onConfirm, onViewOrder }) => {
  useEscape(open, () => {
    if (!converting) onClose();
  });

  return (
    <AnimatedModal
      open={open}
      role={orderId ? 'dialog' : 'alertdialog'}
      ariaLabel={`Convert quote ${quoteId} to order`}
      onOverlayMouseDown={(e) => {
        if (e.target === e.currentTarget && !converting) onClose();
      }}
    >
      <div className="modal-header">
        <h3 className="modal-title">Convert to Order</h3>
        <button type="button" className="btn btn-outline btn-sm" onClick={onClose} disabled={converting} aria-label="Close convert dialog">
          <Icon name="close" size={13} />
          {orderId ? 'Close' : 'Cancel'}
        </button>
      </div>
      <div className="modal-body">
        {orderId ? (
          <>
            <div className="qd-success-box" role="status">
              <Icon name="check" size={15} />
              <div>
                <strong>Quote converted successfully.</strong>
                <p>Order <span className="qd-mono">{quoteId}</span> was created for {totalPrice}.</p>
              </div>
            </div>
            <div className="qd-dialog-actions">
              <Button variant="outline" onClick={onClose}>
                Stay Here
              </Button>
              <Button variant="primary" icon="arrowRight" onClick={onViewOrder}>
                View Order
              </Button>
            </div>
          </>
        ) : (
          <>
            <p className="qd-confirm-text">
              Convert <strong>{quoteId}</strong> ({totalPrice}) into a manufacturing order? The quote will be marked
              <strong> Approved</strong> and linked to the new order. This cannot be undone from here.
            </p>
            {error && (
              <div className="qd-error-box" role="alert">
                <Icon name="alert" size={13} />
                {error}
              </div>
            )}
            <div className="qd-dialog-actions">
              <Button variant="outline" onClick={onClose} disabled={converting}>
                Cancel
              </Button>
              <Button variant="primary" icon="cart" onClick={onConfirm} disabled={converting} loading={converting}>
                Convert to Order
              </Button>
            </div>
          </>
        )}
      </div>
    </AnimatedModal>
  );
};
