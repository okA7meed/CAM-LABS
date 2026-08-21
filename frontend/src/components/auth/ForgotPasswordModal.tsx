import React, { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { useStore } from '../../context/StoreContext';
import { RequiredMark } from '../ui/FieldLabel';

export const ForgotPasswordModal: React.FC = () => {
  const { t } = useTranslation();
  const { isForgotPasswordOpen, closeForgotPassword, showToast } = useStore();
  const [email, setEmail] = useState('');

  if (!isForgotPasswordOpen) return null;

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    closeForgotPassword();
    showToast('Reset Link Sent', `Password reset instructions dispatched to ${email}.`, 'info');
  };

  return (
    <div className="modal-overlay active">
      <div className="modal-card" style={{ maxWidth: '440px' }}>
        <div className="modal-header">
          <div className="modal-title">{t('auth.resetPassword')}</div>
          <button className="modal-close" onClick={closeForgotPassword}>
            <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
              <line x1="18" y1="6" x2="6" y2="18" />
              <line x1="6" y1="6" x2="18" y2="18" />
            </svg>
          </button>
        </div>
        <div className="modal-body">
          <p style={{ fontSize: '0.875rem', color: 'var(--cam-text-muted)', marginBottom: 'var(--space-4)' }}>
            Enter your registered email address and we'll dispatch a secure password reset link.
          </p>
          <form onSubmit={handleSubmit}>
            <div className="form-group">
              <label className="form-label">{t('auth.emailAddress')}<RequiredMark /></label>
              <input
                type="email"
                className="form-control"
                placeholder="engineer@company.com"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                required
                aria-required="true"
              />
            </div>
            <button type="submit" className="btn btn-primary" style={{ width: '100%', marginTop: 'var(--space-4)' }}>
              Send Reset Link
            </button>
          </form>
        </div>
      </div>
    </div>
  );
};
