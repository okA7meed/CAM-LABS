import React, { useState } from 'react';
import { MaterialCard } from './MaterialCard';
import { useMaterials } from '../../hooks/useMaterials';
import { useTranslation } from 'react-i18next';
import { SectionReveal } from '../ui/Reveal';
import { Icon } from '../ui/Icon';

const COLLAPSED_VISIBLE_COUNT = 3;

export const MaterialsExplorer: React.FC = () => {
  const { t } = useTranslation();
  const { materials, loading, error, refetch } = useMaterials();
  const [activeTech, setActiveTech] = useState<string>('ALL');
  const [activeCat, setActiveCat] = useState<string>('ALL');
  const [searchQuery, setSearchQuery] = useState<string>('');
  const [isExpanded, setIsExpanded] = useState<boolean>(false);

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

  const filteredMaterials = materials.filter((mat) => {
    const matchTech = activeTech === 'ALL' || mat.technology.toLowerCase() === activeTech.toLowerCase();
    const matchCat = activeCat === 'ALL' || mat.category.toLowerCase() === activeCat.toLowerCase();
    const q = searchQuery.toLowerCase().trim();
    const matchSearch =
      q === '' ||
      mat.name.toLowerCase().includes(q) ||
      mat.description.toLowerCase().includes(q) ||
      mat.tags.some((tag) => tag.toLowerCase().includes(q));

    return matchTech && matchCat && matchSearch;
  });

  // Presentation-only visibility rule: the collapsed state shows the first 3
  // of the already-filtered result set. Filtering/searching always operate on
  // the full catalog result; expansion never duplicates cards.
  const visibleMaterials = isExpanded
    ? filteredMaterials
    : filteredMaterials.slice(0, COLLAPSED_VISIBLE_COUNT);
  const hasMoreResults = filteredMaterials.length > COLLAPSED_VISIBLE_COUNT;

  const handleReset = () => {
    setActiveTech('ALL');
    setActiveCat('ALL');
    setSearchQuery('');
    setIsExpanded(false);
  };

  const handleSearchChange = (value: string) => {
    setSearchQuery(value);
    setIsExpanded(false);
  };

  const handleTechChange = (value: string) => {
    setActiveTech(value);
    setIsExpanded(false);
  };

  const handleCatChange = (value: string) => {
    setActiveCat(value);
    setIsExpanded(false);
  };

  return (
    <SectionReveal
      className="section-padding explorer-section themed-section-band"
      id="materials-section"
    >
      <div className="container explorer-container">
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
            <div className="search-input-box input-with-icon">
              <span className="input-icon-left" aria-hidden="true">
                <Icon name="search" size={17} />
              </span>
              <input
                type="text"
                className="form-control"
                placeholder={t('materials.searchPlaceholder')}
                aria-label={t('materials.searchPlaceholder')}
                value={searchQuery}
                onChange={(e) => handleSearchChange(e.target.value)}
              />
            </div>
            <button type="button" className="btn btn-outline btn-sm explorer-reset-btn" onClick={handleReset}>
              <Icon name="reset" size={15} />
              {t('materials.reset')}
            </button>
          </div>

          <div className="filter-group-row">
            <span className="filter-label">{t('materials.technology')}</span>
            <div className="filter-chips">
              {techOptions.map((opt) => (
                <button
                  key={opt.value}
                  type="button"
                  aria-pressed={activeTech === opt.value}
                  className={`chip-btn tech-filter-chip ${activeTech === opt.value ? 'active' : ''}`}
                  onClick={() => handleTechChange(opt.value)}
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
                  type="button"
                  aria-pressed={activeCat === opt.value}
                  className={`chip-btn cat-filter-chip ${activeCat === opt.value ? 'active' : ''}`}
                  onClick={() => handleCatChange(opt.value)}
                >
                  {opt.label}
                </button>
              ))}
            </div>
          </div>
        </div>

        {/* Materials Grid */}
        <div className="materials-grid" id="materials-explorer-grid">
          {loading ? (
            <div
              style={{
                gridColumn: '1 / -1',
                textAlign: 'center',
                padding: 'var(--space-12)',
                background: 'var(--cam-surface-1)',
                borderRadius: 'var(--radius-md)',
                border: '1px solid var(--cam-border-subtle)',
                color: 'var(--cam-text-muted)',
              }}
            >
              {t('materials.loading')}
            </div>
          ) : error ? (
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
              <p style={{ color: 'var(--cam-text-muted)', fontSize: '1rem' }}>{error}</p>
              <button className="btn btn-sm btn-outline" style={{ marginTop: 'var(--space-4)' }} onClick={refetch}>
                {t('materials.reset')}
              </button>
            </div>
          ) : filteredMaterials.length === 0 ? (
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
            visibleMaterials.map((mat) => <MaterialCard key={mat.id} material={mat} />)
          )}
        </div>

        {hasMoreResults && !loading && !error && (
          <div className="view-more-wrap">
            <span className="view-more-rail" aria-hidden="true"></span>
            <button
              type="button"
              className="view-more-btn"
              aria-expanded={isExpanded}
              aria-controls="materials-explorer-grid"
              onClick={() => setIsExpanded((prev) => !prev)}
            >
              <Icon name={isExpanded ? 'chevronDown' : 'expand'} size={16} />
              {isExpanded ? t('materials.showLess') : t('materials.viewMore')}
              <Icon name="arrowRight" size={16} />
            </button>
            <span className="view-more-rail" aria-hidden="true"></span>
          </div>
        )}
      </div>
    </SectionReveal>
  );
};
