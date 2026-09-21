import React from 'react';
import { GOVERNORATES } from '../../../constants/locations';
import { SectionCard, Field } from './SectionCard';

export interface DeliveryForm {
  country: string;
  governorate: string;
  city: string;
  address: string;
  apartment: string;
  postalCode: string;
  saveForNextTime: boolean;
}

interface Props {
  value: DeliveryForm;
  errors: Record<string, string>;
  onChange: (patch: Partial<DeliveryForm>) => void;
}

export const DeliveryInformationSection: React.FC<Props> = ({ value, errors, onChange }) => (
  <SectionCard
    icon="pin"
    title="Delivery Information"
    subtitle="Where should we deliver your order?"
    aside={
      <label className="sq-save">
        <input
          type="checkbox"
          checked={value.saveForNextTime}
          onChange={(e) => onChange({ saveForNextTime: e.target.checked })}
        />
        <span>Save this information for next time</span>
      </label>
    }
  >
    <div className="sq-grid-3">
      <Field label="Country / Region" error={errors.country}>
        <select
          className="sq-input sq-select"
          value={value.country}
          onChange={(e) => onChange({ country: e.target.value })}
          aria-required="true"
        >
          <option value="Egypt">Egypt</option>
        </select>
      </Field>
      <Field label="Governorate" error={errors.governorate}>
        <select
          className="sq-input sq-select"
          value={value.governorate}
          onChange={(e) => onChange({ governorate: e.target.value, city: '' })}
          aria-required="true"
        >
          <option value="">Select governorate</option>
          {GOVERNORATES.map((g) => (
            <option key={g} value={g}>
              {g}
            </option>
          ))}
        </select>
      </Field>
      <Field label="City" error={errors.city}>
        <input
          className="sq-input"
          type="text"
          value={value.city}
          onChange={(e) => onChange({ city: e.target.value })}
          placeholder={value.governorate ? `City in ${value.governorate}` : 'Select city'}
          aria-required="true"
          list="sq-city-suggestions"
        />
      </Field>
    </div>
    <div className="sq-grid-3">
      <Field label="Address" error={errors.address}>
        <input
          className="sq-input"
          type="text"
          value={value.address}
          onChange={(e) => onChange({ address: e.target.value })}
          placeholder="Enter your address"
          autoComplete="street-address"
          aria-required="true"
        />
      </Field>
      <Field label="Apartment, suite, etc." optional>
        <input
          className="sq-input"
          type="text"
          value={value.apartment}
          onChange={(e) => onChange({ apartment: e.target.value })}
          placeholder="e.g. Apt 4, Floor 2"
          autoComplete="address-line2"
        />
      </Field>
      <Field label="Postal code" optional>
        <input
          className="sq-input"
          type="text"
          value={value.postalCode}
          onChange={(e) => onChange({ postalCode: e.target.value })}
          placeholder="Enter postal code"
          autoComplete="postal-code"
          inputMode="numeric"
        />
      </Field>
    </div>
  </SectionCard>
);
