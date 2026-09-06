import React from 'react';
import { useTranslation } from 'react-i18next';
import { useStore } from '../../context/StoreContext';
import { Icon } from '../ui/Icon';

export const NotFoundView: React.FC = () => {
  const { t } = useTranslation();
  const { setActiveView } = useStore();

  const handleGoHome = () => {
    window.history.pushState({}, '', '/');
    setActiveView('home');
    window.scrollTo({ top: 0, behavior: 'smooth' });
  };

  return (
    <main
      id="view-not-found"
      style={{
        flex: 1,
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        padding: '100px 24px',
        minHeight: '65vh',
      }}
    >
      <div style={{ textAlign: 'center', maxWidth: '520px', width: '100%' }}>
        <div
          style={{
            fontSize: '5.5rem',
            fontWeight: '900',
            letterSpacing: '-2px',
            lineHeight: 1,
            marginBottom: '16px',
            color: 'var(--cam-blue-primary)',
            textShadow: '0 0 40px rgba(59, 130, 246, 0.3)',
          }}
        >
          {t('notFound.code', '404')}
        </div>
        <h1
          style={{
            fontSize: '1.75rem',
            fontWeight: '700',
            color: 'var(--cam-text-primary)',
            marginBottom: '12px',
          }}
        >
          {t('notFound.title', 'Page Not Found')}
        </h1>
        <p
          style={{
            fontSize: '1rem',
            color: 'var(--cam-text-muted)',
            marginBottom: '32px',
            lineHeight: '1.6',
          }}
        >
          {t('notFound.message', 'The page you are looking for does not exist or has been moved.')}
        </p>
        <button
          className="btn btn-primary cam-shine-auto"
          onClick={handleGoHome}
          style={{
            display: 'inline-flex',
            alignItems: 'center',
            gap: '8px',
            padding: '12px 28px',
            fontSize: '0.95rem',
            fontWeight: '600',
            borderRadius: '8px',
          }}
        >
          <Icon name="arrowRight" size={16} />
          <span>{t('notFound.backHome', 'Back to Home')}</span>
        </button>
      </div>
    </main>
  );
};
