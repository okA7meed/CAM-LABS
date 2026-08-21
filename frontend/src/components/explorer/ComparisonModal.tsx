import React from 'react';
import { useStore } from '../../context/StoreContext';
import { MATERIALS_DATA } from '../../data/materialsData';
import { useTranslation } from 'react-i18next';

export const ComparisonModal: React.FC = () => {
  const { isComparisonModalOpen, closeComparisonModal, comparisonList } = useStore();
  const { t } = useTranslation();

  if (!isComparisonModalOpen) return null;

  const comparedMaterials = MATERIALS_DATA.filter((m) => comparisonList.includes(m.id));

  return (
    <div className="modal-overlay active">
      <div className="modal-card modal-lg">
        <div className="modal-header">
          <div className="modal-title">{t('comparison.title')}</div>
          <button className="modal-close" onClick={closeComparisonModal}>
            <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
              <line x1="18" y1="6" x2="6" y2="18" />
              <line x1="6" y1="6" x2="18" y2="18" />
            </svg>
          </button>
        </div>
        <div className="modal-body">
          {comparedMaterials.length === 0 ? (
            <p style={{ textAlign: 'center', color: 'var(--cam-text-muted)', padding: 'var(--space-8)' }}>
              {t('comparison.empty')}
            </p>
          ) : (
            <div className="table-responsive">
              <table className="cam-table comparison-table">
                <thead>
                  <tr>
                    <th>{t('comparison.property')}</th>
                    {comparedMaterials.map((m) => (
                      <th key={m.id}>
                        <strong>{m.name}</strong>
                        <br />
                        <span style={{ color: 'var(--cam-blue-primary)', fontSize: '0.75rem' }}>
                          {m.technology}
                        </span>
                      </th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  <tr>
                    <td><strong>{t('comparison.category')}</strong></td>
                    {comparedMaterials.map((m) => (
                      <td key={m.id}>{m.category}</td>
                    ))}
                  </tr>
                  <tr>
                    <td><strong>{t('comparison.tensileStrength')}</strong></td>
                    {comparedMaterials.map((m) => (
                      <td key={m.id}>
                        <strong style={{ color: 'var(--cam-text-primary)' }}>{m.tensileStrength} MPa</strong>
                      </td>
                    ))}
                  </tr>
                  <tr>
                    <td><strong>{t('comparison.heatDeflection')}</strong></td>
                    {comparedMaterials.map((m) => (
                      <td key={m.id}>
                        <strong style={{ color: 'var(--cam-text-primary)' }}>{m.hdt} °C</strong>
                      </td>
                    ))}
                  </tr>
                  <tr>
                    <td><strong>{t('comparison.elongation')}</strong></td>
                    {comparedMaterials.map((m) => (
                      <td key={m.id}>{m.elongation}%</td>
                    ))}
                  </tr>
                  <tr>
                    <td><strong>{t('comparison.density')}</strong></td>
                    {comparedMaterials.map((m) => (
                      <td key={m.id}>{m.density} g/cm³</td>
                    ))}
                  </tr>
                  <tr>
                    <td><strong>{t('comparison.standardTolerance')}</strong></td>
                    {comparedMaterials.map((m) => (
                      <td key={m.id}>
                        <span className="mono-tag" style={{ color: 'var(--cam-cyan-tech)' }}>
                          {m.standardTolerance}
                        </span>
                      </td>
                    ))}
                  </tr>
                  <tr>
                    <td><strong>{t('comparison.minWall')}</strong></td>
                    {comparedMaterials.map((m) => (
                      <td key={m.id}>{m.minWallThickness}</td>
                    ))}
                  </tr>
                  <tr>
                    <td><strong>{t('comparison.leadTime')}</strong></td>
                    {comparedMaterials.map((m) => (
                      <td key={m.id}>
                        <span style={{ color: 'var(--cam-success)', fontWeight: 600 }}>{m.leadTime}</span>
                      </td>
                    ))}
                  </tr>
                  <tr>
                    <td><strong>{t('comparison.surfaceFinish')}</strong></td>
                    {comparedMaterials.map((m) => (
                      <td key={m.id} style={{ fontSize: '0.8125rem', color: 'var(--cam-text-muted)' }}>
                        {m.surfaceFinish}
                      </td>
                    ))}
                  </tr>
                  <tr>
                    <td><strong>{t('comparison.idealApplications')}</strong></td>
                    {comparedMaterials.map((m) => (
                      <td key={m.id} style={{ fontSize: '0.8125rem' }}>
                        {m.idealFor}
                      </td>
                    ))}
                  </tr>
                </tbody>
              </table>
            </div>
          )}
        </div>
      </div>
    </div>
  );
};
