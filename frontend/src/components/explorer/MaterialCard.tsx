import React from 'react';
import { Material } from '../../types';
import { useStore } from '../../context/StoreContext';
import { useTranslation } from 'react-i18next';
import { Icon } from '../ui/Icon';
import { getMaterialVisual } from './materialVisuals';

interface MaterialCardProps {
  material: Material;
}

export const MaterialCard: React.FC<MaterialCardProps> = ({ material }) => {
  const { comparisonList, toggleComparison, startManufacturingRequest } = useStore();
  const { t } = useTranslation();
  const isCompared = comparisonList.includes(material.id);
  const visual = getMaterialVisual(material);

  const tensilePct = Math.min(100, (material.tensileStrength / 600) * 100);
  const hdtPct = Math.min(100, (material.hdt / 350) * 100);

  return (
    <article className="material-card" aria-labelledby={`material-name-${material.id}`}>
      <div className="material-card-top">
        <div
          className={`material-thumb material-thumb--${visual.tone}`}
          role="img"
          aria-label={t('materials.materialImageAlt', { name: material.name })}
        >
          <Icon name={visual.icon} size={30} />
        </div>
        <div className="material-identity">
          <span className="material-tech-pill">
            {material.technology} · {material.category}
          </span>
          <h3 className="material-name" id={`material-name-${material.id}`}>
            {material.name}
          </h3>
        </div>
        <label className="custom-checkbox material-compare">
          <input
            type="checkbox"
            checked={isCompared}
            onChange={() => toggleComparison(material.id)}
            aria-label={`${t('materials.compare')}: ${material.name}`}
          />
          <span className="checkbox-mark" aria-hidden="true"></span>
          <span className="material-compare-label">{t('materials.compare')}</span>
        </label>
      </div>

      <p className="material-desc">{material.description}</p>

      <div className="material-props-list">
        <div className="prop-item">
          <div className="prop-row">
            <span className="prop-left">
              <Icon name="scaling" size={15} className="prop-icon" />
              <span className="prop-name">{t('materials.tensileStrength')}</span>
            </span>
            <span className="prop-val">{material.tensileStrength} MPa</span>
          </div>
          <div className="prop-bar-track" aria-hidden="true">
            <div className="prop-bar-fill" style={{ width: `${tensilePct}%` }}></div>
          </div>
        </div>

        <div className="prop-item">
          <div className="prop-row">
            <span className="prop-left">
              <Icon name="shieldCheck" size={15} className="prop-icon" />
              <span className="prop-name">{t('materials.heatDeflection')}</span>
            </span>
            <span className="prop-val">{material.hdt} °C</span>
          </div>
          <div className="prop-bar-track" aria-hidden="true">
            <div
              className="prop-bar-fill"
              style={{ width: `${hdtPct}%`, backgroundColor: 'var(--cam-warning)' }}
            ></div>
          </div>
        </div>

        <div className="prop-item">
          <div className="prop-row">
            <span className="prop-left">
              <Icon name="precision" size={15} className="prop-icon" />
              <span className="prop-name">{t('materials.standardTolerance')}</span>
            </span>
            <span className="prop-val">{material.standardTolerance}</span>
          </div>
        </div>

        <div className="prop-item">
          <div className="prop-row">
            <span className="prop-left">
              <Icon name="clock" size={15} className="prop-icon" />
              <span className="prop-name">{t('materials.leadTime')}</span>
            </span>
            <span className="prop-val prop-val--lead">{material.leadTime}</span>
          </div>
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
          type="button"
          className="btn btn-primary material-configure"
          onClick={() => startManufacturingRequest()}
        >
          <Icon name="gear" size={15} />
          {t('materials.configureWith', { name: material.name.split(' ')[0] })}
        </button>
      </div>
    </article>
  );
};
