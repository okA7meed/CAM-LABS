import React, { useMemo, useState } from 'react';
import {
  AdminDateInput,
  AdminField,
  AdminFormActions,
  AdminFormCard,
  AdminInfinityToggle,
  AdminNumberInput,
  AdminSelect,
  AdminTextInput,
  AdminUnitSuffix,
} from './ui/AdminForm';

export interface CouponFormValue {
  code: string;
  discountType: 'PERCENTAGE' | 'FIXED';
  discountValue: number;
  maxDiscountAmount: number | null;
  minQuoteAmount: number | null;
  maxTotalUses: number | null;
  usageLimitPerCustomer: number | null;
  /** `datetime-local` wall time ('' = empty). Sent to the API as full ISO. */
  startAt: string;
  expiresAt: string;
  discountScope: 'SUBTOTAL_ONLY' | 'INCLUDING_SHIPPING';
}

export const emptyCouponForm: CouponFormValue = {
  code: '',
  discountType: 'PERCENTAGE',
  discountValue: 20,
  maxDiscountAmount: 500,
  minQuoteAmount: 1000,
  maxTotalUses: 100,
  usageLimitPerCustomer: 1,
  startAt: '',
  expiresAt: '',
  discountScope: 'SUBTOTAL_ONLY',
};

const CODE_RE = /^[A-Z0-9_]{2,32}$/;

/**
 * `datetime-local` wall time → full ISO the API accepts (zod requires an
 * offset). Wall digits are preserved exactly (interpreted as UTC, matching
 * how the server parses them), so displayed values round-trip without drift.
 */
export function toApiDateTime(local: string): string | null {
  const t = local.trim();
  if (!t) return null;
  const normalized = /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}$/.test(t) ? `${t}:00.000Z` : t;
  const d = new Date(normalized);
  if (Number.isNaN(d.getTime())) return null;
  return d.toISOString();
}

/** Stored ISO → `datetime-local` wall digits (exact, no timezone shifting). */
export function toDateTimeLocalInput(iso: string | null | undefined): string {
  if (!iso) return '';
  const m = String(iso).match(/^(\d{4}-\d{2}-\d{2})[T ](\d{2}:\d{2})/);
  if (m) return `${m[1]}T${m[2]}`;
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return '';
  const p = (n: number) => String(n).padStart(2, '0');
  return `${d.getUTCFullYear()}-${p(d.getUTCMonth() + 1)}-${p(d.getUTCDate())}T${p(d.getUTCHours())}:${p(d.getUTCMinutes())}`;
}

export type CouponFormErrors = Partial<Record<'code' | 'discountValue' | 'maxDiscountAmount' | 'minQuoteAmount' | 'maxTotalUses' | 'usageLimitPerCustomer' | 'startAt' | 'expiresAt', string>>;

export function validateCouponForm(form: CouponFormValue): CouponFormErrors {
  const next: CouponFormErrors = {};
  if (!CODE_RE.test(form.code.trim())) next.code = 'Use 2–32 uppercase letters, digits or underscores.';
  if (!Number.isFinite(form.discountValue) || form.discountValue <= 0) {
    next.discountValue = 'Value must be greater than 0.';
  } else if (form.discountType === 'PERCENTAGE' && form.discountValue > 100) {
    next.discountValue = 'Percentage must be between 0 and 100.';
  }
  if (form.maxDiscountAmount != null && (!Number.isFinite(form.maxDiscountAmount) || form.maxDiscountAmount < 0)) {
    next.maxDiscountAmount = 'Max discount must be 0 or more.';
  }
  if (form.minQuoteAmount != null && (!Number.isFinite(form.minQuoteAmount) || form.minQuoteAmount < 0)) {
    next.minQuoteAmount = 'Min quote amount must be 0 or more.';
  }
  if (form.maxTotalUses != null && (!Number.isInteger(form.maxTotalUses) || form.maxTotalUses <= 0)) {
    next.maxTotalUses = 'Max uses must be a positive whole number.';
  }
  if (form.usageLimitPerCustomer != null && (!Number.isInteger(form.usageLimitPerCustomer) || form.usageLimitPerCustomer <= 0)) {
    next.usageLimitPerCustomer = 'Per-customer limit must be a positive whole number.';
  }
  let start: number | null = null;
  let expiry: number | null = null;
  if (form.startAt.trim()) {
    const iso = toApiDateTime(form.startAt);
    if (!iso) next.startAt = 'Enter a valid start date.';
    else start = new Date(iso).getTime();
  }
  if (form.expiresAt.trim()) {
    const iso = toApiDateTime(form.expiresAt);
    if (!iso) next.expiresAt = 'Enter a valid expiry date.';
    else expiry = new Date(iso).getTime();
  }
  if (start != null && expiry != null && expiry <= start) {
    next.expiresAt = 'Expiry must be after the start date.';
  }
  return next;
}

export interface CouponFormPayload {
  code: string;
  discountType: 'PERCENTAGE' | 'FIXED';
  discountValue: number;
  maxDiscountAmount: number | null;
  minQuoteAmount: number | null;
  maxTotalUses: number | null;
  usageLimitPerCustomer: number | null;
  startAt: string | null;
  expiresAt: string | null;
  discountScope: 'SUBTOTAL_ONLY' | 'INCLUDING_SHIPPING';
}

/** Form value → API payload. Field-for-field identical to the previous form's
 *  payload shape, except dates are normalized to full ISO (the old raw
 *  `datetime-local` strings were rejected by backend validation). `isEnabled`
 *  is intentionally absent: enable/disable stays on the list actions so an
 *  edit can never silently flip availability (PUT is partial). */
export function toCouponPayload(form: CouponFormValue): CouponFormPayload {
  return {
    code: form.code.trim(),
    discountType: form.discountType,
    discountValue: Number(form.discountValue),
    maxDiscountAmount: form.maxDiscountAmount == null ? null : Number(form.maxDiscountAmount),
    minQuoteAmount: form.minQuoteAmount == null ? null : Number(form.minQuoteAmount),
    maxTotalUses: form.maxTotalUses == null ? null : Number(form.maxTotalUses),
    usageLimitPerCustomer: form.usageLimitPerCustomer == null ? null : Number(form.usageLimitPerCustomer),
    startAt: toApiDateTime(form.startAt),
    expiresAt: toApiDateTime(form.expiresAt),
    discountScope: form.discountScope,
  };
}

interface Props {
  mode: 'create' | 'edit';
  initial: CouponFormValue;
  saving: boolean;
  onSave: (payload: CouponFormPayload) => void;
  onClose: () => void;
}

export const CouponForm: React.FC<Props> = ({ mode, initial, saving, onSave, onClose }) => {
  const [form, setForm] = useState<CouponFormValue>(initial);
  const [attempted, setAttempted] = useState(false);
  // Restores when re-enabling an unlimited field (never sent to the server).
  const [lastLimited, setLastLimited] = useState({ maxTotalUses: 100, usageLimitPerCustomer: 1 });
  const editing = mode === 'edit';
  const isPercentage = form.discountType === 'PERCENTAGE';

  const errors = useMemo(() => validateCouponForm(form), [form]);
  const visible = (key: keyof CouponFormErrors) => (attempted ? errors[key] ?? null : null);

  const submit = () => {
    setAttempted(true);
    if (Object.keys(errors).length > 0) return;
    onSave(toCouponPayload(form));
  };

  const reset = () => {
    // Create → defaults; edit → last-loaded persisted values. Never persists.
    setForm(initial);
    setAttempted(false);
  };

  const setUnlimited = (key: 'maxTotalUses' | 'usageLimitPerCustomer', unlimited: boolean) => {
    if (unlimited) {
      const current = form[key];
      if (current != null) setLastLimited((prev) => ({ ...prev, [key]: current }));
      setForm({ ...form, [key]: null });
    } else {
      setForm({ ...form, [key]: lastLimited[key] });
    }
  };

  const unlimitedControl = (
    key: 'maxTotalUses' | 'usageLimitPerCustomer',
    id: string,
    value: number | null,
    placeholder: string,
    invalid: boolean,
  ) => (
    <span className="af-input-wrap">
      <AdminNumberInput
        id={id}
        min={1}
        step={1}
        value={value ?? ''}
        placeholder={value == null ? 'Unlimited' : placeholder}
        disabled={value == null}
        onChange={(e) => {
          const n = Number(e.target.value);
          setForm({ ...form, [key]: e.target.value === '' ? lastLimited[key] : n });
        }}
        invalid={invalid}
      />
      <AdminInfinityToggle
        unlimited={value == null}
        onToggle={() => setUnlimited(key, value != null)}
        label={value == null ? 'Set a limited number of uses' : 'Allow unlimited uses'}
      />
    </span>
  );

  return (
    <AdminFormCard
      icon="coupon"
      title={editing ? 'Edit Coupon' : 'Add Coupon'}
      subtitle={editing ? 'Update discount rules and limits. Historical quote snapshots are preserved.' : 'Create a new discount coupon with custom rules and limits.'}
      onClose={onClose}
    >
      <div className="af-grid-4">
        <AdminField icon="tag" tone="blue" label="Coupon Code" required htmlFor="cp-code" error={visible('code')}>
          <AdminTextInput
            id="cp-code"
            value={form.code}
            onChange={(e) => setForm({ ...form, code: e.target.value.toUpperCase() })}
            placeholder="CAM20"
            disabled={editing}
            invalid={Boolean(visible('code'))}
            autoComplete="off"
            maxLength={32}
          />
        </AdminField>
        <AdminField icon="percent" tone="green" label="Discount Type" required htmlFor="cp-type">
          <AdminSelect
            id="cp-type"
            value={form.discountType}
            onChange={(e) => setForm({ ...form, discountType: e.target.value as 'PERCENTAGE' | 'FIXED' })}
          >
            <option value="PERCENTAGE">Percentage</option>
            <option value="FIXED">Fixed Amount</option>
          </AdminSelect>
        </AdminField>
        <AdminField icon="database" tone="green" label="Value" required htmlFor="cp-value" error={visible('discountValue')}>
          <span className="af-input-wrap">
            <AdminNumberInput
              id="cp-value"
              min={0}
              step="any"
              value={form.discountValue}
              onChange={(e) => setForm({ ...form, discountValue: Number(e.target.value) })}
              invalid={Boolean(visible('discountValue'))}
            />
            <AdminUnitSuffix>{isPercentage ? '%' : 'EGP'}</AdminUnitSuffix>
          </span>
        </AdminField>
        <AdminField icon="trendUp" tone="purple" label="Max Discount" htmlFor="cp-maxdisc" helper={isPercentage ? undefined : 'Applies to percentage discounts.'} error={visible('maxDiscountAmount')}>
          <span className="af-input-wrap">
            <AdminNumberInput
              id="cp-maxdisc"
              min={0}
              step="any"
              value={form.maxDiscountAmount ?? ''}
              placeholder="No cap"
              onChange={(e) => setForm({ ...form, maxDiscountAmount: e.target.value === '' ? null : Number(e.target.value) })}
              invalid={Boolean(visible('maxDiscountAmount'))}
            />
            <AdminUnitSuffix>EGP</AdminUnitSuffix>
          </span>
        </AdminField>
      </div>
      <div className="af-grid-5" style={{ marginTop: 14 }}>
        <AdminField icon="cart" tone="amber" label="Min Quote Amount" htmlFor="cp-minquote" error={visible('minQuoteAmount')}>
          <span className="af-input-wrap">
            <AdminNumberInput
              id="cp-minquote"
              min={0}
              step="any"
              value={form.minQuoteAmount ?? ''}
              placeholder="No minimum"
              onChange={(e) => setForm({ ...form, minQuoteAmount: e.target.value === '' ? null : Number(e.target.value) })}
              invalid={Boolean(visible('minQuoteAmount'))}
            />
            <AdminUnitSuffix>EGP</AdminUnitSuffix>
          </span>
        </AdminField>
        <AdminField icon="layers" tone="blue" label="Max Uses" htmlFor="cp-maxuses" error={visible('maxTotalUses')}>
          {unlimitedControl('maxTotalUses', 'cp-maxuses', form.maxTotalUses, '100', Boolean(visible('maxTotalUses')))}
        </AdminField>
        <AdminField icon="userRound" tone="purple" label="Per Customer" htmlFor="cp-percust" error={visible('usageLimitPerCustomer')}>
          {unlimitedControl('usageLimitPerCustomer', 'cp-percust', form.usageLimitPerCustomer, '1', Boolean(visible('usageLimitPerCustomer')))}
        </AdminField>
        <AdminField icon="calendar" tone="cyan" label="Start Date" htmlFor="cp-start" error={visible('startAt')}>
          <AdminDateInput
            id="cp-start"
            value={form.startAt}
            onChange={(e) => setForm({ ...form, startAt: e.target.value })}
            invalid={Boolean(visible('startAt'))}
          />
        </AdminField>
        <AdminField icon="calendar" tone="blue" label="Expiry Date" htmlFor="cp-expiry" error={visible('expiresAt')}>
          <AdminDateInput
            id="cp-expiry"
            value={form.expiresAt}
            onChange={(e) => setForm({ ...form, expiresAt: e.target.value })}
            invalid={Boolean(visible('expiresAt'))}
          />
        </AdminField>
      </div>
      <div className="af-grid-3" style={{ marginTop: 14 }}>
        <AdminField icon="target" tone="blue" label="Scope" htmlFor="cp-scope" helper="Define where the discount will be applied.">
          <AdminSelect
            id="cp-scope"
            value={form.discountScope}
            onChange={(e) => setForm({ ...form, discountScope: e.target.value as 'SUBTOTAL_ONLY' | 'INCLUDING_SHIPPING' })}
          >
            <option value="SUBTOTAL_ONLY">Subtotal only</option>
            <option value="INCLUDING_SHIPPING">Including shipping</option>
          </AdminSelect>
        </AdminField>
      </div>
      <div className="af-bottombar">
        <span style={{ flex: 1 }} aria-hidden="true" />
        <AdminFormActions
          onReset={reset}
          onSubmit={submit}
          submitLabel={editing ? 'Update Coupon' : 'Save Coupon'}
          saving={saving}
        />
      </div>
    </AdminFormCard>
  );
};
