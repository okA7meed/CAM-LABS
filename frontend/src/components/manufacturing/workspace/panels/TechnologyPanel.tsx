import { Icon } from '../../../ui/Icon';
import { PanelShell } from '../PanelShell';
import { TECH_OPTIONS, panelIds } from '../constants';
import { PanelStatus, RequestState, TechnologyId } from '../types';

export const TechnologyPanel = ({ request, status, className, onSelectTechnology }: {
  request: RequestState;
  status: PanelStatus;
  className?: string;
  onSelectTechnology: (tech: TechnologyId) => void;
}) => (
  <PanelShell
    id={panelIds.technology}
    icon="technology"
    title="Select Technology"
    subtitle="Choose a manufacturing technology"
    status={status}
    className={className}
  >
    <div className="mw-stage-tech-list">
      {TECH_OPTIONS.map((tech) => {
        const sel = request.technology === tech.id;
        return (
          <button
            key={tech.id}
            type="button"
            className={`mw-stage-tech-item ${sel ? 'is-selected' : ''}`}
            onClick={() => onSelectTechnology(tech.id)}
          >
            <span className="mw-stage-tech-icon"><Icon name={tech.icon} size={20} /></span>
            <span className="mw-stage-tech-text">
              <span className="mw-stage-tech-name">{tech.label}</span>
              <span className="mw-stage-tech-desc">{tech.desc}</span>
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