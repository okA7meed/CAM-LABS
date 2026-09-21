import React from 'react';
import { Button } from '../ui/Button';
import { Icon } from '../../ui/Icon';

/**
 * Quote command toolbar: identity block + normal operations + consequential
 * actions in one full-width card. Presentation only — every control reuses
 * the existing canonical handlers passed in as props.
 */
export const QuoteActions: React.FC<{
  onDownload: () => void;
  downloadBusy: boolean;
  canMessage: boolean;
  onMessage: () => void;
  canMutate: boolean;
  onStatus: () => void;
  onReject: () => void;
  onEdit: () => void;
  onConvert: () => void;
  convertBusy: boolean;
  converted: boolean;
  statusBusy: boolean;
}> = ({ onDownload, downloadBusy, canMessage, onMessage, canMutate, onStatus, onReject, onEdit, onConvert, convertBusy, converted, statusBusy }) => {
  const showOps = true;
  const showConsequential = canMutate;

  return (
    <section className="qd-actions-card" aria-label="Quote actions">
      <div className="qd-actions-identity">
        <span className="qd-actions-bolt" aria-hidden="true">
          <Icon name="bolt" size={24} />
        </span>
        <div className="qd-actions-titles">
          <strong>Actions</strong>
          <span>Manage this quote</span>
        </div>
      </div>
      <div className="qd-actions-div" role="separator" aria-hidden="true" />
      {showOps && (
        <div className="qd-actions-group">
          <Button variant="outline" icon="download" onClick={onDownload} disabled={downloadBusy} loading={downloadBusy} className="qd-action-btn">
            Download Quote
          </Button>
          {canMessage && (
            <Button variant="outline" icon="send" onClick={onMessage} className="qd-action-btn">
              Send Message
            </Button>
          )}
          {canMutate && !converted && (
            <Button variant="outline" icon="clock" onClick={onStatus} disabled={statusBusy} className="qd-action-btn qd-status-btn">
              <span>Change Status</span>
              <Icon name="chevronDown" size={14} />
            </Button>
          )}
        </div>
      )}
      {showOps && showConsequential && <div className="qd-actions-div" role="separator" aria-hidden="true" />}
      {showConsequential && (
        <div className="qd-actions-group qd-actions-group--end">
          {!converted && (
            <Button variant="outline" icon="pencil" onClick={onEdit} className="qd-action-btn">
              Edit
            </Button>
          )}
          {!converted && (
            <Button variant="outline" icon="trash" onClick={onReject} disabled={statusBusy} className="qd-action-btn qd-reject-btn">
              Reject
            </Button>
          )}
          <Button
            variant="primary"
            icon="cart"
            onClick={onConvert}
            disabled={convertBusy || converted}
            loading={convertBusy}
            className="qd-action-btn qd-convert-btn"
            title={converted ? 'This quote has already been converted' : 'Convert this quote to a manufacturing order'}
          >
            {converted ? 'Converted' : 'Convert to Order'}
          </Button>
        </div>
      )}
    </section>
  );
};
