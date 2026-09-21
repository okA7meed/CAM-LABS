import React from 'react';
import { Icon, IconName } from '../../ui/Icon';
import { Button } from './Button';

export type AdminFieldTone = 'blue' | 'cyan' | 'green' | 'purple' | 'amber';

/* ------------------------------------------------------------------ */
/* Shared admin form primitives (Shipping + Coupon management).        */
/* Visual language: dark card, icon containers with soft accent tones, */
/* integrated unit suffixes, polished toggle, blue primary actions.    */
/* All surfaces use --admin-* / --ds-* tokens (light mode inherits).   */
/* ------------------------------------------------------------------ */

export const AdminFormCard: React.FC<{
  icon: IconName;
  title: string;
  subtitle?: string;
  onClose: () => void;
  closeLabel?: string;
  children: React.ReactNode;
}> = ({ icon, title, subtitle, onClose, closeLabel = 'Close', children }) => (
  <section className="af-card" aria-label={title}>
    <div className="af-head">
      <span className="af-head-icon" aria-hidden="true">
        <Icon name={icon} size={24} />
      </span>
      <span className="af-head-text">
        <span className="af-title">{title}</span>
        {subtitle ? <span className="af-subtitle">{subtitle}</span> : null}
      </span>
      <Button variant="outline" size="sm" icon="close" onClick={onClose}>
        {closeLabel}
      </Button>
    </div>
    {children}
  </section>
);

export const AdminField: React.FC<{
  icon: IconName;
  tone?: AdminFieldTone;
  label: string;
  required?: boolean;
  helper?: string;
  error?: string | null;
  htmlFor?: string;
  children: React.ReactNode;
}> = ({ icon, tone = 'blue', label, required, helper, error, htmlFor, children }) => (
  <div className={`af-field${error ? ' af-invalid' : ''}`}>
    <span className={`af-field-icon af-tone-${tone}`} aria-hidden="true">
      <Icon name={icon} size={20} />
    </span>
    <span className="af-field-main">
      <label className="af-label" htmlFor={htmlFor}>
        {label}
        {required ? (
          <span className="af-required" aria-hidden="true">
            {' *'}
          </span>
        ) : null}
        {required ? <span className="af-sr-only">(required)</span> : null}
      </label>
      {children}
      {error ? (
        <span className="af-error" role="alert">
          {error}
        </span>
      ) : helper ? (
        <span className="af-helper">{helper}</span>
      ) : null}
    </span>
  </div>
);

export const AdminUnitSuffix: React.FC<{ children: React.ReactNode }> = ({ children }) => (
  <span className="af-suffix" aria-hidden="true">
    {children}
  </span>
);

export const AdminInfinityToggle: React.FC<{
  unlimited: boolean;
  onToggle: () => void;
  label: string;
}> = ({ unlimited, onToggle, label }) => (
  <button
    type="button"
    className={`af-suffix af-infinity${unlimited ? ' af-infinity-on' : ''}`}
    onClick={onToggle}
    aria-pressed={unlimited}
    aria-label={label}
    title={label}
  >
    <Icon name="infinity" size={16} />
  </button>
);

export const AdminToggle: React.FC<{
  checked: boolean;
  onChange: (value: boolean) => void;
  label: string;
  hint?: string;
  disabled?: boolean;
}> = ({ checked, onChange, label, hint, disabled }) => (
  <div className="af-toggle-row">
    <button
      type="button"
      role="switch"
      aria-checked={checked}
      aria-label={label}
      disabled={disabled}
      onClick={() => onChange(!checked)}
      onKeyDown={(e) => {
        if (e.key === 'Enter' || e.key === ' ') {
          e.preventDefault();
          onChange(!checked);
        }
      }}
      className={`af-toggle${checked ? ' af-toggle-on' : ''}`}
    >
      <span className="af-toggle-knob" aria-hidden="true" />
    </button>
    <span className="af-toggle-text">
      <span className="af-toggle-label">{label}</span>
      {hint ? <span className="af-toggle-hint">{hint}</span> : null}
    </span>
  </div>
);

export const AdminFormActions: React.FC<{
  onReset: () => void;
  onSubmit: () => void;
  submitLabel: string;
  saving?: boolean;
  disabled?: boolean;
}> = ({ onReset, onSubmit, submitLabel, saving, disabled }) => (
  <div className="af-actions">
    <Button variant="outline" size="md" icon="reset" onClick={onReset} disabled={saving || disabled} className="af-reset">
      Reset
    </Button>
    <Button variant="primary" size="md" icon="save" onClick={onSubmit} disabled={saving || disabled} loading={saving} className="af-submit">
      {submitLabel}
    </Button>
  </div>
);

const baseControlProps = (props: {
  id?: string;
  disabled?: boolean;
  invalid?: boolean;
  className?: string;
}) => ({
  id: props.id,
  disabled: props.disabled,
  'aria-invalid': props.invalid ? true : undefined,
  className: ['af-control', props.className ?? ''].filter(Boolean).join(' '),
});

export const AdminTextInput = React.forwardRef<
  HTMLInputElement,
  React.InputHTMLAttributes<HTMLInputElement> & { invalid?: boolean }
>(function AdminTextInput({ invalid, className, ...rest }, ref) {
  return <input ref={ref} {...rest} {...baseControlProps({ id: rest.id, disabled: rest.disabled, invalid, className })} type={rest.type || 'text'} />;
});

export const AdminNumberInput = React.forwardRef<
  HTMLInputElement,
  React.InputHTMLAttributes<HTMLInputElement> & { invalid?: boolean }
>(function AdminNumberInput({ invalid, className, ...rest }, ref) {
  return <input ref={ref} {...rest} {...baseControlProps({ id: rest.id, disabled: rest.disabled, invalid, className })} type="number" inputMode="decimal" />;
});

export const AdminSelect = React.forwardRef<
  HTMLSelectElement,
  React.SelectHTMLAttributes<HTMLSelectElement> & { invalid?: boolean }
>(function AdminSelect({ invalid, className, children, ...rest }, ref) {
  return (
    <span className="af-select-wrap">
      <select ref={ref} {...rest} {...baseControlProps({ id: rest.id, disabled: rest.disabled, invalid, className })}>
        {children}
      </select>
      <span className="af-select-chev" aria-hidden="true">
        <Icon name="chevronDown" size={16} />
      </span>
    </span>
  );
});

export const AdminDateInput = React.forwardRef<
  HTMLInputElement,
  React.InputHTMLAttributes<HTMLInputElement> & { invalid?: boolean }
>(function AdminDateInput({ invalid, className, onClick, ...rest }, ref) {
  const innerRef = React.useRef<HTMLInputElement | null>(null);
  const setRefs = (node: HTMLInputElement | null) => {
    innerRef.current = node;
    if (typeof ref === 'function') ref(node);
    else if (ref) (ref as React.MutableRefObject<HTMLInputElement | null>).current = node;
  };
  return (
    <span
      className="af-input-wrap"
      onClick={(e) => {
        onClick?.(e as unknown as React.MouseEvent<HTMLInputElement>);
        // The native picker indicator is visually replaced by our calendar
        // affordance; open it programmatically so mouse users keep one-click
        // access. Keyboard users can still type or use Alt+ArrowDown.
        try {
          innerRef.current?.showPicker?.();
        } catch {
          /* showPicker unsupported — native typing remains available */
        }
      }}
    >
      <input ref={setRefs} {...rest} {...baseControlProps({ id: rest.id, disabled: rest.disabled, invalid, className })} type="datetime-local" />
      <span className="af-input-cal" aria-hidden="true">
        <Icon name="calendar" size={16} />
      </span>
    </span>
  );
});
