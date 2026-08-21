import React from 'react';
import { Material } from '../../types';
import { useStore } from '../../context/StoreContext';
import { useTranslation } from 'react-i18next';

interface MaterialCardProps {
  material: Material;
}

export const MaterialCard: React.FC<MaterialCardProps> = ({ material }) => {
  const { comparisonList, toggleComparison, startManufacturingRequest } = useStore();
  const { t } = useTranslation();
  const isCompared = comparisonList.includes(material.id);

  const tensilePct = Math.min(100, (material.tensileStrength / 600) * 100);
  const hdtPct = Math.min(100, (material.hdt / 350) * 100);

  return (
    <div className="material-card">
      <div className="material-header">
        <div>
          <span className="material-tech-pill">
            {material.technology} · {material.category}
          </span>
          <div className="material-name" style={{ marginTop: '6px' }}>
            {material.name}
          </div>
        </div>
        <label className="custom-checkbox" style={{ fontSize: '0.75rem' }}>
          <input
            type="checkbox"
            checked={isCompared}
            onChange={() => toggleComparison(material.id)}
          />
          <span className="checkbox-mark"></span>
          <span style={{ fontFamily: 'var(--font-mono)', color: 'var(--cam-text-muted)' }}>{t('materials.compare')}</span>
        </label>
      </div>

      <p style={{ fontSize: '0.8125rem', color: 'var(--cam-text-muted)', lineHeight: '1.5' }}>
        {material.description}
      </p>

      <div className="material-props-list">
        <div>
          <div className="prop-row">
            <span className="prop-name">{t('materials.tensileStrength')}</span>
            <span className="prop-val">{material.tensileStrength} MPa</span>
          </div>
          <div className="prop-bar-track">
            <div className="prop-bar-fill" style={{ width: `${tensilePct}%` }}></div>
          </div>
        </div>

        <div>
          <div className="prop-row">
            <span className="prop-name">{t('materials.heatDeflection')}</span>
            <span className="prop-val">{material.hdt} °C</span>
          </div>
          <div className="prop-bar-track">
            <div
              className="prop-bar-fill"
              style={{ width: `${hdtPct}%`, backgroundColor: 'var(--cam-warning)' }}
            ></div>
          </div>
        </div>

        <div className="prop-row" style={{ marginTop: '4px' }}>
          <span className="prop-name">{t('materials.standardTolerance')}</span>
          <span className="prop-val">{material.standardTolerance}</span>
        </div>

        <div className="prop-row">
          <span className="prop-name">{t('materials.leadTime')}</span>
          <span className="prop-val" style={{ color: 'var(--cam-success)' }}>
            {material.leadTime}
          </span>
        </div>
      </div>

      <div className="material-tags">
        {material.tags.map((tag) => (
          <span key={tag} className="prop-tag">
            {tag}
          </span>
        ))}
      </div>

      <div className="material-card-actions">
        <button
          className="btn btn-sm btn-primary"
          style={{ width: '100%' }}
          onClick={() => startManufacturingRequest()}
        >
          {t('materials.configureWith', { name: material.name.split(' ')[0] })}
        </button>
      </div>
    </div>
  );
};
