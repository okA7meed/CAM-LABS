import { useTranslation } from 'react-i18next';
import { Icon } from '../../../ui/Icon';
import { PanelShell } from '../PanelShell';
import { PROCESS_INFO, panelIds, processGroups } from '../constants';
import { PanelStatus, ProcessId, RequestState } from '../types';

export const ProcessPanel = ({ request, status, className, onSelectProcess, showNextButton, onNext, t: tProp }: {
  request: RequestState;
  status: PanelStatus;
  className?: string;
  onSelectProcess: (p: ProcessId) => void;
  showNextButton?: boolean;
  onNext?: () => void;
  t?: any;
}) => {
  const { t: tHook } = useTranslation();
  const t = tProp || tHook;
  const processOptions = request.technology
    ? (processGroups.find((g) => g.group === request.technology || (request.technology === 'sheet' && g.group === 'sheetMetal'))?.options ?? []).map((id) => ({ id, info: PROCESS_INFO[id] }))
    : [];
  return (
    <PanelShell
      id={panelIds.process}
      icon="layers"
      title={t('mw.selectProcess')}
      subtitle={t('mw.selectProcessSub')}
      status={status}
      className={className}
    >
      {!request.technology ? (
        <div className="mw-panel-empty">
          <span className="mw-panel-empty-hint">{t('mw.selectTechnologyFirst')}</span>
        </div>
      ) : processOptions.length === 0 ? (
        <div className="mw-panel-empty">
          <span className="mw-panel-empty-icon"><Icon name="configure" size={14} /></span>
          <span className="mw-panel-empty-text">{t('mw.noProcesses')}</span>
          <span className="mw-panel-empty-hint">{t('mw.noProcessesHint')}</span>
        </div>
      ) : (
        <>
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
          {showNextButton && request.process && onNext && (
            <div className="mw-stage-focus-action">
              <button
                type="button"
                className="mw-btn mw-btn-primary mw-stage-next-btn"
                onClick={onNext}
              >
                <span>{t ? `${t('request.next')}: ${t('request.uploadDesign')}` : 'Next: Upload Design'}</span>
                <Icon name="arrowRight" size={14} />
              </button>
            </div>
          )}
        </>
      )}
    </PanelShell>
  );
};