import { useTranslation } from 'react-i18next';
import { Icon } from '../../../ui/Icon';
import { MATERIAL_COLORS, materialColor } from '../../materialPreview';
import { PanelShell } from '../PanelShell';
import { MATERIAL_PROPERTIES, MATERIAL_SWATCHES, panelIds } from '../constants';
import { PanelStatus, RequestState } from '../types';

export const MaterialPanel = ({ request, materialOptions, selectedColor, status, className, t: tProp, onSelectMaterial, onColorChange }: {
  request: RequestState;
  materialOptions: string[];
  selectedColor: string;
  status: PanelStatus;
  className?: string;
  t: any;
  onSelectMaterial: (m: string) => void;
  onColorChange: (c: string) => void;
}) => {
  const { t: tHook } = useTranslation();
  const t = tProp || tHook;
  const selectedProps = request.material ? MATERIAL_PROPERTIES[request.material] || [] : [];
  const isInactive = status === 'inactive';
  return (
    <PanelShell
      id={panelIds.material}
      icon="layers3"
      title={t('mw.selectMaterial')}
      subtitle={t('mw.selectMaterialSub')}
      status={status}
      className={className}
    >
      {isInactive && (
        <div className="mw-panel-empty">
          <span className="mw-panel-empty-hint">{t('mw.selectProcessUploadFirst')}</span>
        </div>
      )}

      {materialOptions.length === 0 ? (
        !isInactive && (
          <div className="mw-panel-empty">
            <span className="mw-panel-empty-hint">{t('mw.noMaterials')}</span>
          </div>
        )
      ) : (
        <>
          <div className={`mw-stage-material-grid ${isInactive ? 'is-inactive' : ''}`}>
            {materialOptions.map((m) => {
              const sel = request.material === m;
              return (
                <button
                  key={m}
                  type="button"
                  disabled={isInactive}
                  className={`mw-stage-material-chip ${sel ? 'is-selected' : ''}`}
                  onClick={() => onSelectMaterial(m)}
                  title={isInactive ? 'Select a process and upload a design first' : m}
                >
                  <span className="mw-stage-material-swatch" style={{ background: MATERIAL_SWATCHES[m] || 'linear-gradient(135deg, #3b82f6, #14b8a6)' }} />
                  <span className="mw-stage-material-name">{t(`request.material.${m}`)}</span>
                  {sel && <span className="mw-stage-material-check" aria-hidden="true"><Icon name="check" size={10} /></span>}
                </button>
              );
            })}
          </div>

          {request.material && selectedProps.length > 0 && (
            <div className="mw-stage-material-props">
              <div className="mw-stage-section-label">{t('mw.materialProperties')}</div>
              <div className="mw-stage-material-props-list">
                {selectedProps.map((p) => (
                  <span key={p.label} className="mw-stage-material-prop">
                    <Icon name={p.icon} size={11} /> {p.label}
                  </span>
                ))}
              </div>
            </div>
          )}

          {request.material && (
            <div className="mw-stage-color-row">
              <span className="mw-stage-section-label">{t('mw.color')}</span>
              <div className="mw-color-grid">
                {MATERIAL_COLORS.map((c) => (
                  <button
                    key={c}
                    type="button"
                    disabled={isInactive}
                    className={`mw-color-swatch ${selectedColor === c ? 'is-selected' : ''}`}
                    style={{ background: materialColor(c) }}
                    onClick={() => onColorChange(c)}
                    title={c}
                  />
                ))}
              </div>
            </div>
          )}
        </>
      )}
    </PanelShell>
  );
};