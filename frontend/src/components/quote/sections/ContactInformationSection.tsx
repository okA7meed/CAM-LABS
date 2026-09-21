import React from 'react';
import { SectionCard, Field } from './SectionCard';

interface Props {
  fullName: string;
  email: string;
  phone: string;
  errors: Record<string, string>;
  onChange: (patch: { fullName?: string; email?: string; phone?: string }) => void;
}

export const ContactInformationSection: React.FC<Props> = ({ fullName, email, phone, errors, onChange }) => (
  <SectionCard icon="contact" title="Contact Information" subtitle="We'll use this information to get in touch with you about your quote.">
    <div className="sq-grid-2">
      <Field label="Full Name" error={errors.fullName}>
        <input
          className="sq-input"
          type="text"
          autoComplete="name"
          value={fullName}
          onChange={(e) => onChange({ fullName: e.target.value })}
          placeholder="Ahmed Khaled Hussien"
          aria-required="true"
        />
      </Field>
      <Field label="Email Address" error={errors.email}>
        <input
          className="sq-input"
          type="email"
          autoComplete="email"
          value={email}
          onChange={(e) => onChange({ email: e.target.value })}
          placeholder="ahmed@gmail.com"
          aria-required="true"
        />
      </Field>
    </div>
    <Field label="Phone Number" error={errors.phone}>
      <input
        className="sq-input"
        type="tel"
        autoComplete="tel"
        value={phone}
        onChange={(e) => onChange({ phone: e.target.value })}
        placeholder="01xxxxxxxxx"
        aria-required="true"
      />
    </Field>
  </SectionCard>
);
