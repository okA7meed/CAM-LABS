import React, { useState } from 'react';
import { MaterialCard } from './MaterialCard';
import { MATERIALS_DATA } from '../../data/materialsData';
import { useTranslation } from 'react-i18next';
import { SectionReveal } from '../ui/Reveal';


export const MaterialsExplorer: React.FC = () => {
  const { t } = useTranslation();
  const [activeTech, setActiveTech] = useState<string>('ALL');
  const [activeCat, setActiveCat] = useState<string>('ALL');
  const [searchQuery, setSearchQuery] = useState<string>('');

  const techOptions: { label: string; value: string }[] = [
    { label: t('materials.allTech'), value: 'ALL' },
    { label: t('materials.sls'), value: 'SLS' },
    { label: t('materials.sla'), value: 'SLA' },
    { label: t('materials.fdm'), value: 'FDM' },
    { label: t('materials.cnc'), value: 'CNC' },
    { label: t('materials.dmls'), value: 'DMLS' },
    { label: t('materials.sheet'), value: 'Sheet Metal' },
  ];

  const catOptions: { label: string; value: string }[] = [
    { label: t('materials.allCategories'), value: 'ALL' },
    { label: t('materials.polymers'), value: 'Polymers' },
    { label: t('materials.highPerformance'), value: 'High-Performance' },
    { label: t('materials.metals'), value: 'Metals' },
    { label: t('materials.resins'), value: 'Resins' },
    { label: t('materials.elastomers'), value: 'Elastomers' },
  ];

  const filteredMaterials = MATERIALS_DATA.filter((mat) => {
    const matchTech = activeTech === 'ALL' || mat.technology.toLowerCase() === activeTech.toLowerCase();
    const matchCat = activeCat === 'ALL' || mat.category.toLowerCase() === activeCat.toLowerCase();
    const q = searchQuery.toLowerCase().trim();
    const matchSearch =
      q === '' ||
      mat.name.toLowerCase().includes(q) ||
      mat.description.toLowerCase().includes(q) ||
      mat.tags.some((t) => t.toLowerCase().includes(q));

    return matchTech && matchCat && matchSearch;
  });

  const handleReset = () => {
    setActiveTech('ALL');
    setActiveCat('ALL');
    setSearchQuery('');
  };

  return (
    <SectionReveal
      className="section-padding explorer-section themed-section-band"
      id="materials-section"
    >
      <div className="container">
        <div className="section-header">
          <div className="section-badge">
            <span className="section-badge-dot"></span>
            <span>{t('materials.kicker')}</span>
          </div>
          <h2 className="section-title">{t('materials.title')}</h2>
          <p className="section-subtitle">
            {t('materials.description')}
          </p>
        </div>

        {/* Filter Toolbar */}
        <div className="explorer-toolbar">
          <div className="toolbar-search-row">
            <div className="search-input-box">
              <input
                type="text"
                className="form-control"
                placeholder={t('materials.searchPlaceholder')}
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
              />
            </div>
            <button className="btn btn-outline btn-sm" onClick={handleReset}>
              {t('materials.reset')}
            </button>
          </div>

          <div className="filter-group-row">
            <span className="filter-label">{t('materials.technology')}</span>
            <div className="filter-chips">
              {techOptions.map((opt) => (
                <button
                  key={opt.value}
                  className={`chip-btn tech-filter-chip ${activeTech === opt.value ? 'active' : ''}`}
                  onClick={() => setActiveTech(opt.value)}
                >
                  {opt.label}
                </button>
              ))}
            </div>
          </div>

          <div className="filter-group-row">
            <span className="filter-label">{t('materials.category')}</span>
            <div className="filter-chips">
              {catOptions.map((opt) => (
                <button
                  key={opt.value}
                  className={`chip-btn cat-filter-chip ${activeCat === opt.value ? 'active' : ''}`}
                  onClick={() => setActiveCat(opt.value)}
                >
                  {opt.label}
                </button>
              ))}
            </div>
          </div>
        </div>

        {/* Materials Grid */}
        <div className="materials-grid" id="materials-explorer-grid">
          {filteredMaterials.length === 0 ? (
            <div
              style={{
                gridColumn: '1 / -1',
                textAlign: 'center',
                padding: 'var(--space-12)',
                background: 'var(--cam-surface-1)',
                borderRadius: 'var(--radius-md)',
                border: '1px solid var(--cam-border-subtle)',
              }}
            >
              <p style={{ color: 'var(--cam-text-muted)', fontSize: '1rem' }}>
                No engineering materials found matching your filters.
              </p>
              <button className="btn btn-sm btn-outline" style={{ marginTop: 'var(--space-4)' }} onClick={handleReset}>
                {t('materials.reset')}
              </button>
            </div>
          ) : (
            filteredMaterials.map((mat) => <MaterialCard key={mat.id} material={mat} />)
          )}
        </div>
      </div>
    </SectionReveal>
  );
};
