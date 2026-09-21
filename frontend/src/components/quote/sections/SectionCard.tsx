import React from 'react';

export const SectionCard: React.FC<{
  icon: string;
  title: string;
  subtitle: string;
  children: React.ReactNode;
  aside?: React.ReactNode;
}> = ({ icon, title, subtitle, children, aside }) => (
  <section className="sq-card" aria-label={title}>
    <header className="sq-card-head">
      <span className="sq-icon" aria-hidden="true">
        <span className={`sq-glyph sq-glyph-${icon}`} />
      </span>
      <span className="sq-head-text">
        <span className="sq-card-title">{title}</span>
        <span className="sq-card-sub">{subtitle}</span>
      </span>
      {aside ? <span className="sq-head-aside">{aside}</span> : null}
    </header>
    <div className="sq-card-body">{children}</div>
  </section>
);

export const Field: React.FC<{
  label: string;
  error?: string | null;
  children: React.ReactNode;
  optional?: boolean;
}> = ({ label, error, children, optional }) => (
  <label className={`sq-field${error ? ' has-error' : ''}`}>
    <span className="sq-label">
      {label}
      {optional ? <span className="sq-optional"> (optional)</span> : null}
    </span>
    {children}
    {error ? (
      <span className="sq-error" role="alert">
        {error}
      </span>
    ) : null}
  </label>
);
