import { CadGeometryData } from '../../../../services/api';
import { Icon } from '../../../ui/Icon';
import { ErrorBoundary } from '../../../ui/ErrorBoundary';
import { CadGeometryViewer } from '../../CadGeometryViewer';
import { PanelShell } from '../PanelShell';
import { panelIds } from '../constants';
import { FileSetupState, PanelStatus, UploadItem } from '../types';

export const ViewerPanel = ({ status, activeItem, fileSetupStates, materialId, colorId, onGeometry }: {
  status: PanelStatus | undefined;
  activeItem: UploadItem | undefined;
  fileSetupStates: Record<string, FileSetupState>;
  materialId: string | null;
  colorId: string | null;
  onGeometry: (g: CadGeometryData, id: string) => void;
}) => (
  <PanelShell
    id={panelIds.viewer}
    icon="cube"
    title="3D Model Viewer"
    subtitle="Inspect your model before production"
    status={status}
    className="mw-panel-viewer"
  >
    {activeItem?.cadFile ? (
      <div className="mw-stage-viewer-wrap">
        <ErrorBoundary
          label="cad-viewer"
          fallback={(error, retry) => (
            <div className="mw-stage-viewer-empty" role="alert">
              <span className="mw-stage-viewer-empty-icon"><Icon name="cube" size={22} /></span>
              <span className="mw-stage-viewer-empty-text">The 3D viewer could not start on this device.</span>
              <span className="mw-stage-viewer-empty-hint">{error.message || 'WebGL may be unavailable or a graphics driver failed.'}</span>
              <button type="button" className="mw-btn mw-btn-secondary" onClick={retry}>Retry viewer</button>
            </div>
          )}
        >
          <CadGeometryViewer
            file={activeItem.cadFile}
            setup={fileSetupStates[activeItem.id]}
            materialId={materialId}
            colorId={colorId}
            onGeometry={(g) => onGeometry(g, activeItem.id)}
            onSetupChange={(u) => { void u; }}
          />
        </ErrorBoundary>
      </div>
    ) : (
      <div className="mw-stage-viewer-empty">
        <span className="mw-stage-viewer-empty-icon"><Icon name="cube" size={22} /></span>
        <span className="mw-stage-viewer-empty-text">Upload a CAD file to preview your model.</span>
        <span className="mw-stage-viewer-empty-hint">After uploading, rotate, pan, zoom and inspect your part in 3D.</span>
      </div>
    )}
  </PanelShell>
);