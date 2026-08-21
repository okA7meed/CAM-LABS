import React, { useRef } from 'react';
import { useCadViewer, RenderMode, PartType } from '../../hooks/useCadViewer';
import { useTranslation } from 'react-i18next';

export const CadViewerStage: React.FC = () => {
  const { t } = useTranslation();
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const { renderMode, setRenderMode, activePart, setActivePart } = useCadViewer(canvasRef);

  const partLabels: Record<PartType, string> = {
    manifold: 'Turbine_Manifold_v3.step',
    bracket: 'Structural_Bracket_L70.step',
    hinge: 'Robotic_Exoskeleton_Joint.step',
  };

  const partSpecs: Record<PartType, string> = {
    manifold: '142.6 cm³ · AL-6061',
    bracket: '88.4 cm³ · TI-6AL4V',
    hinge: '62.1 cm³ · PA-12',
  };

  const partDimensions: Record<PartType, string> = {
    manifold: '120 × 85 × 45 mm',
    bracket: '96 × 70 × 32 mm',
    hinge: '78 × 54 × 28 mm',
  };

  return (
    <div className="hero-cad-stage" id="hero-cad-stage">
      <div className="cad-stage-header">
        <span className="cad-window-lights" aria-hidden="true">
          <span className="cad-light cad-light-red" />
          <span className="cad-light cad-light-amber" />
          <span className="cad-light cad-light-green" />
        </span>

        <div className="cad-part-meta">
          <span className="cad-app-name">{t('cadInspector.title')}</span>
          <span className="cad-meta-divider" aria-hidden="true" />
          <span className="cad-filename" title={partLabels[activePart]}>
            {partLabels[activePart]}
          </span>
        </div>

        <div className="cad-controls-hud">
          {(['solid', 'wireframe', 'slicing', 'stress'] as RenderMode[]).map((mode) => (
            <button
              key={mode}
              className={`hud-btn ${renderMode === mode ? 'active' : ''}`}
              aria-pressed={renderMode === mode}
              onClick={() => setRenderMode(mode)}
            >
              {mode.charAt(0).toUpperCase() + mode.slice(1)}
            </button>
          ))}
        </div>
      </div>

      <div className="cad-canvas-wrapper">
        <canvas ref={canvasRef} style={{ width: '100%', height: '100%', display: 'block' }} />
        <div className="cad-overlay-crosshairs">
          <div className="cad-crosshair-row">
            <span>+ [X: 0.00, Y: 0.00]</span>
            <span>CAM-SIM v4.8</span>
          </div>
          <div className="cad-crosshair-row">
            <span>{t('cadInspector.controls')}</span>
          </div>
        </div>
      </div>

      <div className="cad-stage-footer">
        <div className="cad-part-switch">
          {(['manifold', 'bracket', 'hinge'] as PartType[]).map((part) => (
            <button
              key={part}
              className={`hud-btn ${activePart === part ? 'active' : ''}`}
              aria-pressed={activePart === part}
              onClick={() => setActivePart(part)}
            >
              {part.charAt(0).toUpperCase() + part.slice(1)}
            </button>
          ))}
        </div>

        <div className="cad-status-readout">
          <span className="cad-status-flag">{t('cadInspector.status')}</span>
          <span className="cad-status-sep" aria-hidden="true" />
          <span>{partDimensions[activePart]}</span>
          <span className="cad-status-sep" aria-hidden="true" />
          <span className="cad-status-material">{partSpecs[activePart]}</span>
        </div>
      </div>
    </div>
  );
};
