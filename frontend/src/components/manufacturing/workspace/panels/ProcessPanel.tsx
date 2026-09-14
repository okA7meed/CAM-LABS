import { Icon } from '../../../ui/Icon';
import { PanelShell } from '../PanelShell';
import { PROCESS_INFO, panelIds, processGroups } from '../constants';
import { PanelStatus, ProcessId, RequestState } from '../types';

export const ProcessPanel = ({ request, status, onSelectProcess }: {
  request: RequestState;
  status: PanelStatus;
  onSelectProcess: (p: ProcessId) => void;
}) => {
  const processOptions = request.technology
    ? (processGroups.find((g) => g.group === request.technology || (request.technology === 'sheet' && g.group === 'sheetMetal'))?.options ?? []).map((id) => ({ id, info: PROCESS_INFO[id] }))
    : [];
  return (
    <PanelShell
      id={panelIds.process}
      icon="layers"
      title="Select Process / Type"
      subtitle="Available for the selected technology"
      status={status}
    >
      {!request.technology ? (
        <div className="mw-panel-empty">
          <span className="mw-panel-empty-hint">Select a manufacturing technology first.</span>
        </div>
      ) : processOptions.length === 0 ? (
        <div className="mw-panel-empty">
          <span className="mw-panel-empty-icon"><Icon name="configure" size={14} /></span>
          <span className="mw-panel-empty-text">No processes yet</span>
          <span className="mw-panel-empty-hint">Processes for this technology are coming soon</span>
        </div>
      ) : (
        <div className="mw-stage-process-grid">
          {processOptions.map(({ id, info }) => {
            const sel = request.process === id;
            return (
              <button
                key={id}
                type="button"
                className={`mw-stage-process-chip ${sel ? 'is-selected' : ''}`}
                onClick={() => onSelectProcess(id)}
              >
                <span className="mw-stage-process-name">{info.title}</span>
                {info.badge && <span className="mw-stage-process-badge">{info.badge}</span>}
                {sel && <span className="mw-stage-process-check" aria-hidden="true"><Icon name="check" size={11} /></span>}
              </button>
            );
          })}
        </div>
      )}
    </PanelShell>
  );
};