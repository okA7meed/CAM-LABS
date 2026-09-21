import React from 'react';
import { GOVERNORATES } from '../../../constants/locations';
import { SectionCard, Field } from './SectionCard';

export interface BillingForm {
  sameAsShipping: boolean;
  country: string;
  governorate: string;
  city: string;
  address: string;
  apartment: string;
  postalCode: string;
}

interface Props {
  value: BillingForm;
  errors: Record<string, string>;
  onChange: (patch: Partial<BillingForm>) => void;
}

export const BillingAddressSection: React.FC<Props> = ({ value, errors, onChange }) => (
  <SectionCard icon="bill" title="Billing Address" subtitle="Choose your billing address.">
    <div role="radiogroup" aria-label="Billing address" className="sq-billing-toggle">
      <button
        type="button"
        role="radio"
        aria-checked={value.sameAsShipping}
        onClick={() => onChange({ sameAsShipping: true })}
        className={`sq-radio-card sq-billing-opt${value.sameAsShipping ? ' is-active' : ''}`}
      >
        <span className="sq-radio-dot" aria-hidden="true" />
        <span className="sq-radio-title">Same as shipping address</span>
      </button>
      <button
        type="button"
        role="radio"
        aria-checked={!value.sameAsShipping}
        onClick={() => onChange({ sameAsShipping: false })}
        className={`sq-radio-card sq-billing-opt${!value.sameAsShipping ? ' is-active' : ''}`}
      >
        <span className="sq-radio-dot" aria-hidden="true" />
        <span className="sq-radio-title">Use a different billing address</span>
      </button>
    </div>
    {!value.sameAsShipping ? (
      <div className="sq-billing-fields">
        <div className="sq-grid-3">
          <Field label="Country / Region" error={errors.billingCountry}>
            <select className="sq-input sq-select" value={value.country} onChange={(e) => onChange({ country: e.target.value })}>
              <option value="Egypt">Egypt</option>
            </select>
          </Field>
          <Field label="Governorate" error={errors.billingGovernorate}>
            <select
              className="sq-input sq-select"
              value={value.governorate}
              onChange={(e) => onChange({ governorate: e.target.value, city: '' })}
            >
              <option value="">Select governorate</option>
              {GOVERNORATES.map((g) => (
                <option key={g} value={g}>
                  {g}
                </option>
              ))}
            </select>
          </Field>
          <Field label="City" error={errors.billingCity}>
            <input
              className="sq-input"
              value={value.city}
              onChange={(e) => onChange({ city: e.target.value })}
              placeholder="City"
            />
          </Field>
        </div>
        <div className="sq-grid-3">
          <Field label="Address" error={errors.billingAddress}>
            <input className="sq-input" value={value.address} onChange={(e) => onChange({ address: e.target.value })} placeholder="Billing address" />
          </Field>
          <Field label="Apartment, suite, etc." optional>
            <input className="sq-input" value={value.apartment} onChange={(e) => onChange({ apartment: e.target.value })} placeholder="Optional" />
          </Field>
          <Field label="Postal code" optional>
            <input className="sq-input" value={value.postalCode} onChange={(e) => onChange({ postalCode: e.target.value })} placeholder="Optional" />
          </Field>
        </div>
      </div>
    ) : null}
  </SectionCard>
);
