import { useTranslation } from 'react-i18next';
import { Icon } from '../../../ui/Icon';
import { PanelShell } from '../PanelShell';
import { TECH_OPTIONS, panelIds } from '../constants';
import { PanelStatus, RequestState, TechnologyId } from '../types';

const TECH_I18N: Record<string, { label: string; desc: string }> = {
  printing: { label: 'mw.tech.printing', desc: 'mw.tech.printingDesc' },
  cnc: { label: 'mw.tech.cnc', desc: 'mw.tech.cncDesc' },
  sheet: { label: 'mw.tech.sheet', desc: 'mw.tech.sheetDesc' },
  injection: { label: 'mw.tech.injection', desc: 'mw.tech.injectionDesc' },
};

export const TechnologyPanel = ({ request, status, className, onSelectTechnology }: {
  request: RequestState;
  status: PanelStatus;
  className?: string;
  onSelectTechnology: (tech: TechnologyId) => void;
}) => {
  const { t } = useTranslation();
  return (
  <PanelShell
    id={panelIds.technology}
    icon="technology"
    title={t('mw.selectTechnology')}
    subtitle={t('mw.selectTechnologySub')}
    status={status}
    className={className}
  >
    <div className="mw-stage-tech-list">
      {TECH_OPTIONS.map((tech) => {
        const sel = request.technology === tech.id;
        const keys = TECH_I18N[tech.id];
        return (
          <button
            key={tech.id}
            type="button"
            className={`mw-stage-tech-item ${sel ? 'is-selected' : ''}`}
            onClick={() => onSelectTechnology(tech.id)}
            aria-pressed={sel}
          >
            <span className="mw-stage-tech-icon"><Icon name={tech.icon} size={20} /></span>
            <span className="mw-stage-tech-text">
              <span className="mw-stage-tech-name">{keys ? t(keys.label, { defaultValue: tech.label }) : tech.label}</span>
              <span className="mw-stage-tech-desc">{keys ? t(keys.desc, { defaultValue: tech.desc }) : tech.desc}</span>
            </span>
            <span className="mw-stage-tech-mark" aria-hidden="true">
              {sel ? <Icon name="check" size={14} /> : <Icon name="chevronRight" size={14} />}
            </span>
          </button>
        );
      })}
    </div>
  </PanelShell>
  );
};