import React, { useMemo, useState } from 'react';
import { Icon } from '../ui/Icon';
import {
  AdminField,
  AdminFormActions,
  AdminFormCard,
  AdminNumberInput,
  AdminTextInput,
  AdminToggle,
} from './ui/AdminForm';

export interface ShippingMethodFormValue {
  code: string;
  name: string;
  description: string;
  eta: string;
  priceEgp: number;
  sortOrder: number;
  isEnabled: boolean;
}

export const emptyShippingForm: ShippingMethodFormValue = {
  code: '',
  name: '',
  description: '',
  eta: '',
  priceEgp: 0,
  sortOrder: 0,
  isEnabled: true,
};

const CODE_RE = /^[A-Z0-9_]{2,32}$/;

export type ShippingFormErrors = Partial<Record<keyof ShippingMethodFormValue, string>>;

export function validateShippingForm(form: ShippingMethodFormValue): ShippingFormErrors {
  const next: ShippingFormErrors = {};
  if (!CODE_RE.test(form.code.trim())) next.code = 'Use 2–32 uppercase letters, digits or underscores.';
  if (form.name.trim().length < 2) next.name = 'Name must be at least 2 characters.';
  if (!Number.isFinite(form.priceEgp) || form.priceEgp < 0) next.priceEgp = 'Price must be 0 or more.';
  if (!Number.isInteger(form.sortOrder) || form.sortOrder < 0) next.sortOrder = 'Sort order must be a whole number of 0 or more.';
  if (form.description.trim().length > 500) next.description = 'Description must be 500 characters or fewer.';
  if (form.eta.trim().length > 60) next.eta = 'ETA must be 60 characters or fewer.';
  return next;
}

/** Common delivery estimates offered as suggestions — the field stays free
 *  text so existing custom ETA values keep working (backend stores a string). */
const ETA_PRESETS = ['Same Day', '1–2 Days', '2–5 Days', '3–7 Days', '1–2 Weeks', '2–4 Weeks'];

interface Props {
  mode: 'create' | 'edit';
  initial: ShippingMethodFormValue;
  saving: boolean;
  onSave: (value: ShippingMethodFormValue) => void;
  onClose: () => void;
}

export const ShippingMethodForm: React.FC<Props> = ({ mode, initial, saving, onSave, onClose }) => {
  const [form, setForm] = useState<ShippingMethodFormValue>(initial);
  const [attempted, setAttempted] = useState(false);
  const editing = mode === 'edit';

  const errors = useMemo(() => validateShippingForm(form), [form]);

  const visible = (key: keyof ShippingMethodFormValue) => (attempted ? errors[key] ?? null : null);

  const submit = () => {
    setAttempted(true);
    if (Object.keys(errors).length > 0) return;
    onSave({ ...form, code: form.code.trim(), name: form.name, description: form.description, eta: form.eta });
  };

  const reset = () => {
    // Create → defaults; edit → last-loaded persisted values. Never persists.
    setForm(initial);
    setAttempted(false);
  };

  return (
    <AdminFormCard
      icon="truck"
      title="Shipping Method"
      subtitle="Add or edit a shipping method with pricing and delivery details."
      onClose={onClose}
    >
      <div className="af-grid-3">
        <AdminField
          icon="tag"
          tone="purple"
          label="Shipping Code"
          required
          htmlFor="sm-code"
          helper="Unique code for internal use."
          error={visible('code')}
        >
          <AdminTextInput
            id="sm-code"
            value={form.code}
            onChange={(e) => setForm({ ...form, code: e.target.value.toUpperCase() })}
            placeholder="STANDARD"
            disabled={editing}
            invalid={Boolean(visible('code'))}
            autoComplete="off"
            maxLength={32}
          />
        </AdminField>
        <AdminField
          icon="review"
          tone="blue"
          label="Shipping Name"
          required
          htmlFor="sm-name"
          helper="Display name shown to customers."
          error={visible('name')}
        >
          <AdminTextInput
            id="sm-name"
            value={form.name}
            onChange={(e) => setForm({ ...form, name: e.target.value })}
            placeholder="Standard Shipping"
            invalid={Boolean(visible('name'))}
            autoComplete="off"
            maxLength={120}
          />
        </AdminField>
        <AdminField
          icon="database"
          tone="green"
          label="Price (EGP)"
          required
          htmlFor="sm-price"
          helper="Shipping cost for this method."
          error={visible('priceEgp')}
        >
          <span className="af-input-wrap">
            <AdminNumberInput
              id="sm-price"
              min={0}
              step="any"
              value={form.priceEgp}
              onChange={(e) => setForm({ ...form, priceEgp: Number(e.target.value) })}
              invalid={Boolean(visible('priceEgp'))}
            />
            <span className="af-suffix" aria-hidden="true">EGP</span>
          </span>
        </AdminField>
      </div>
      <div className="af-grid-3" style={{ marginTop: 14 }}>
        <AdminField
          icon="clock"
          tone="amber"
          label="Estimated Delivery Time (ETA)"
          required
          htmlFor="sm-eta"
          helper="Expected delivery time."
          error={visible('eta')}
        >
          <span className="af-text-wrap">
            <AdminTextInput
              id="sm-eta"
              value={form.eta}
              onChange={(e) => setForm({ ...form, eta: e.target.value })}
              placeholder="2–5 Days"
              invalid={Boolean(visible('eta'))}
              autoComplete="off"
              maxLength={60}
              list="sm-eta-presets"
            />
            <span className="af-adorn" aria-hidden="true">
              <Icon name="chevronDown" size={16} />
            </span>
            <datalist id="sm-eta-presets">
              {ETA_PRESETS.map((preset) => (
                <option key={preset} value={preset} />
              ))}
            </datalist>
          </span>
        </AdminField>
        <AdminField
          icon="file"
          tone="blue"
          label="Description"
          htmlFor="sm-description"
          helper="Short description for customers."
          error={visible('description')}
        >
          <AdminTextInput
            id="sm-description"
            value={form.description}
            onChange={(e) => setForm({ ...form, description: e.target.value })}
            placeholder="Reliable delivery within 2 to 5 business days."
            invalid={Boolean(visible('description'))}
            autoComplete="off"
            maxLength={500}
          />
        </AdminField>
        <AdminField
          icon="sortList"
          tone="purple"
          label="Sort Order"
          htmlFor="sm-sort"
          helper="Display order in the list."
          error={visible('sortOrder')}
        >
          <AdminNumberInput
            id="sm-sort"
            min={0}
            step={1}
            value={form.sortOrder}
            onChange={(e) => setForm({ ...form, sortOrder: Number(e.target.value) })}
            invalid={Boolean(visible('sortOrder'))}
          />
        </AdminField>
      </div>
      <div className="af-bottombar">
        <AdminToggle
          checked={form.isEnabled}
          onChange={(v) => setForm({ ...form, isEnabled: v })}
          label="Enabled"
          hint="Make this shipping method available to customers."
        />
        <AdminFormActions
          onReset={reset}
          onSubmit={submit}
          submitLabel={editing ? 'Update Shipping Method' : 'Add Shipping Method'}
          saving={saving}
        />
      </div>
    </AdminFormCard>
  );
};
