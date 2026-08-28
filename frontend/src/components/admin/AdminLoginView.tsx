import React, { useState } from 'react';
import { useStore } from '../../context/StoreContext';
import { Icon } from '../ui/Icon';
import { ApiService } from '../../services/api';

export const AdminLoginView: React.FC = () => {
  const { showToast, setActiveView } = useStore();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    setLoading(true);

    try {
      const result = await ApiService.adminLogin(email, password);
      if (result?.user) {
        const adminUrl = (await ApiService.getAdminUrl().catch(() => null))?.adminUrl || '/admin';
        setActiveView('admin-dashboard');
        window.history.replaceState({}, '', adminUrl);
        showToast('Welcome Admin', 'Successfully logged into CAM LABS Admin Panel', 'success');
      } else {
        setError('Invalid credentials or insufficient permissions');
      }
    } catch (err: any) {
      setError(err.message || 'Login failed. Please try again.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="tech-grid-bg" style={{ minHeight: '100vh', display: 'flex', alignItems: 'center', justifyContent: 'center', padding: '20px', background: 'var(--cam-bg)' }}>
      <div style={{ maxWidth: '440px', width: '100%' }}>
        <div style={{ textAlign: 'center', marginBottom: '40px' }}>
          <h1 style={{ fontSize: '2rem', fontWeight: '900', marginBottom: '12px', color: 'var(--cam-text-primary)' }}>
            CAM LABS
          </h1>
          <p style={{ color: 'var(--cam-text-muted)', fontSize: '1rem' }}>
            Admin Panel
          </p>
        </div>

        <div style={{
          background: 'var(--cam-surface-1)',
          border: '1px solid var(--cam-border-subtle)',
          borderRadius: '16px',
          padding: '40px',
          boxShadow: '0 20px 40px rgba(0, 0, 0, 0.4)',
        }}>
          <form onSubmit={handleSubmit}>
            <div style={{ marginBottom: '24px' }}>
              <label className="form-label" style={{ display: 'block', marginBottom: '8px', color: 'var(--cam-text-secondary)', fontSize: '0.875rem', fontWeight: '500' }}>
                Email Address
              </label>
              <input
                type="email"
                className="form-control"
                placeholder="admin@cam-labs.com"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                required
                disabled={loading}
                style={{
                  width: '100%',
                  padding: '12px 16px',
                  background: 'var(--cam-surface-2)',
                  border: '1px solid var(--cam-border-subtle)',
                  borderRadius: '8px',
                  color: 'var(--cam-text-primary)',
                  fontSize: '1rem',
                  transition: 'border-color 0.2s',
                }}
              />
            </div>

            <div style={{ marginBottom: '32px' }}>
              <label className="form-label" style={{ display: 'block', marginBottom: '8px', color: 'var(--cam-text-secondary)', fontSize: '0.875rem', fontWeight: '500' }}>
                Password
              </label>
              <input
                type="password"
                className="form-control"
                placeholder="••••••••••••"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                required
                disabled={loading}
                style={{
                  width: '100%',
                  padding: '12px 16px',
                  background: 'var(--cam-surface-2)',
                  border: '1px solid var(--cam-border-subtle)',
                  borderRadius: '8px',
                  color: 'var(--cam-text-primary)',
                  fontSize: '1rem',
                  transition: 'border-color 0.2s',
                }}
              />
            </div>

            {error && (
              <div style={{
                marginBottom: '24px',
                padding: '12px 16px',
                background: 'rgba(239, 68, 68, 0.1)',
                border: '1px solid rgba(239, 68, 68, 0.3)',
                borderRadius: '8px',
                color: 'var(--cam-danger)',
                fontSize: '0.875rem',
                display: 'flex',
                alignItems: 'center',
                gap: '8px',
              }}>
                <Icon name="alert" size={16} />
                {error}
              </div>
            )}

            <button
              type="submit"
              className="btn btn-primary"
              disabled={loading}
              style={{
                width: '100%',
                padding: '14px',
                fontSize: '1rem',
                fontWeight: '600',
                borderRadius: '8px',
                background: 'var(--cam-blue-primary)',
                color: '#fff',
                border: 'none',
                cursor: loading ? 'not-allowed' : 'pointer',
                opacity: loading ? 0.6 : 1,
                transition: 'all 0.2s',
              }}
            >
              {loading ? (
                <span style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '8px' }}>
                  <Icon name="loader" size={16} />
                  Signing in...
                </span>
              ) : (
                'Sign In to Admin Panel'
              )}
            </button>
          </form>

          <div style={{ marginTop: '24px', textAlign: 'center', color: 'var(--cam-text-muted)', fontSize: '0.875rem' }}>
            <p>Authorized personnel only. All access is logged.</p>
          </div>
        </div>
      </div>
    </div>
  );
};