import React from 'react';
import { useTranslation } from 'react-i18next';
import { useStore } from '../../context/StoreContext';
import { useAuth } from '../../context/AuthContext';
import { DEMO_PERSONAS } from '../../data/initialData';

export const PersonaModal: React.FC = () => {
  const { t } = useTranslation();
  const { isPersonaModalOpen, closePersonaModal, showToast } = useStore();
  const { switchPersona, currentUser } = useAuth();

  if (!isPersonaModalOpen || !currentUser) return null;

  const handleSelect = (id: string, name: string) => {
    switchPersona(id);
    closePersonaModal();
    showToast('Persona Activated', `Switched active session to ${name}.`, 'info');
  };

  return (
    <div className="modal-overlay active">
      <div className="modal-card">
        <div className="modal-header">
          <div>
            <div className="modal-title">{t('auth.switchPersona')}</div>
            <div style={{ fontSize: '0.75rem', color: 'var(--cam-text-muted)' }}>
              Experience CAM LABS from different customer roles
            </div>
          </div>
          <button className="modal-close" onClick={closePersonaModal}>
            <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
              <line x1="18" y1="6" x2="6" y2="18" />
              <line x1="6" y1="6" x2="18" y2="18" />
            </svg>
          </button>
        </div>

        <div className="modal-body" style={{ display: 'flex', flexDirection: 'column', gap: 'var(--space-3)' }}>
          {DEMO_PERSONAS.map((p) => (
            <div
              key={p.id}
              className={`card card-interactive persona-select-card ${currentUser.id === p.id ? 'card-highlight' : ''}`}
              onClick={() => handleSelect(p.id, p.name)}
            >
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                <div>
                  <strong style={{ color: 'var(--cam-text-primary)' }}>{p.name}</strong>
                  <div style={{ fontSize: '0.8125rem', color: 'var(--cam-text-muted)' }}>
                    {p.role} · {p.company}
                  </div>
                </div>
                <span className={`badge ${p.id === 'persona-1' ? 'badge-blue' : p.id === 'persona-2' ? 'badge-neutral' : 'badge-success'}`}>
                  {p.tier}
                </span>
              </div>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
};
