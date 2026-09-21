import React from 'react';
import { Icon, IconName } from '../../ui/Icon';
import { humanizeSpecValue } from '../order-detail/format';

const Card: React.FC<{ icon: IconName; tone: string; label: string; value: React.ReactNode; sub?: React.ReactNode; action?: React.ReactNode }> = ({ icon, tone, label, value, sub, action }) => (
  <div className={`qd-sum-card qd-tone-${tone}`}>
    <span className="qd-sum-icon" aria-hidden="true"><Icon name={icon} size={17} /></span>
    <div className="qd-sum-body">
      <span className="qd-sum-label">{label}</span>
      <span className="qd-sum-value">{value}{action}</span>
      {sub && <span className="qd-sum-sub">{sub}</span>}
    </div>
  </div>
);

export const QuoteSummaryCards: React.FC<{
  totalPrice: string;
  totalLabel?: string;
  manualOverride: boolean;
  fileCount: number;
  technology: string;
  material: string;
  quantity: number;
  printTime: string;
  canMutate: boolean;
  onEditPrice: () => void;
}> = ({ totalPrice, totalLabel, manualOverride, fileCount, technology, material, quantity, printTime, canMutate, onEditPrice }) => (
  <section className="qd-summary" aria-label="Quote summary">
    <Card
      icon="calculator"
      tone="green"
      label={totalLabel || 'Total Price'}
      value={<span className="qd-sum-price">{totalPrice}</span>}
      sub={manualOverride ? <span className="qd-manual-badge"><Icon name="review" size={11} /> Adjusted manually</span> : undefined}
      action={canMutate ? (
        <button type="button" className="qd-price-edit" onClick={onEditPrice} title="Edit quote price" aria-label="Edit quote price">
          <Icon name="configure" size={12} />
        </button>
      ) : undefined}
    />
    <Card icon="cube" tone="purple" label="Files / Parts" value={String(fileCount)} sub={fileCount === 1 ? 'STL file' : 'STL files'} />
    <Card icon="layers" tone="blue" label="Technology" value={humanizeSpecValue(technology)} />
    <Card icon="database" tone="magenta" label="Material" value={humanizeSpecValue(material)} />
    <Card icon="cube" tone="amber" label="Quantity" value={String(quantity)} />
    <Card icon="clock" tone="cyan" label="Est. Print Time" value={printTime} />
  </section>
);

