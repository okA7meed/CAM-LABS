import React, { useEffect, useRef, useState } from 'react';
import * as THREE from 'three';
import { OrbitControls } from 'three/examples/jsm/controls/OrbitControls.js';
import { STLLoader } from 'three/examples/jsm/loaders/STLLoader.js';
import { OBJLoader } from 'three/examples/jsm/loaders/OBJLoader.js';
import { PLYLoader } from 'three/examples/jsm/loaders/PLYLoader.js';
import { GLTFLoader } from 'three/examples/jsm/loaders/GLTFLoader.js';
import DxfParser, { IEntity, IPoint } from 'dxf-parser';
import { CadFile } from '../../types';
import { ApiError, ApiService, CadGeometryData } from '../../services/api';
import { useTranslation } from 'react-i18next';
import { Icon } from '../ui/Icon';
import { ModelDimensions, ModelUnit, convertArea, convertLength, convertVolume, formatModelValue, scaleDimensions } from '../../utils/modelUnits';

type DxfEntityGeometry = IEntity & { vertices?: IPoint[]; center?: IPoint; radius?: number; startAngle?: number; endAngle?: number };

const dxfLinePoints = (entity: IEntity): THREE.Vector3[] => {
  const geometry = entity as DxfEntityGeometry;
  if (geometry.vertices?.length) return geometry.vertices.map((point) => new THREE.Vector3(point.x, point.y, point.z || 0));
  if (geometry.center && Number.isFinite(geometry.radius)) {
    const start = Number.isFinite(geometry.startAngle) ? geometry.startAngle! : 0;
    const end = Number.isFinite(geometry.endAngle) ? geometry.endAngle! : Math.PI * 2;
    const sweep = end >= start ? end - start : end + Math.PI * 2 - start;
    return Array.from({ length: 65 }, (_, index) => {
      const angle = start + sweep * index / 64;
      return new THREE.Vector3(geometry.center!.x + geometry.radius! * Math.cos(angle), geometry.center!.y + geometry.radius! * Math.sin(angle), geometry.center!.z || 0);
    });
  }
  return [];
};

const createDxfModel = (text: string): THREE.Group => {
  const drawing = new DxfParser().parseSync(text);
  if (!drawing) throw new Error('DXF parsing failed.');
  const positions: number[] = [];
  drawing.entities.forEach((entity) => {
    const points = dxfLinePoints(entity);
    for (let index = 1; index < points.length; index += 1) positions.push(...points[index - 1].toArray(), ...points[index].toArray());
  });
  if (positions.length === 0) throw new Error('DXF has no supported line entities.');
  const lineGeometry = new THREE.BufferGeometry();
  lineGeometry.setAttribute('position', new THREE.Float32BufferAttribute(positions, 3));
  const group = new THREE.Group();
  group.add(new THREE.LineSegments(lineGeometry, new THREE.LineBasicMaterial({ color: 0x2f80ff })));
  return group;
};

export interface CadViewerSetup {
  unit: ModelUnit;
  dimensions: ModelDimensions | null;
  baseDimensions: ModelDimensions | null;
  volume: number | null;
  surfaceArea: number | null;
  triangleCount: number | null;
}

export const CadGeometryViewer: React.FC<{ file: CadFile; onGeometry: (geometry: CadGeometryData) => void; setup?: CadViewerSetup; onSetupChange?: (update: Partial<CadViewerSetup>) => void; thumbnail?: boolean }> = ({ file, onGeometry, setup, onSetupChange, thumbnail = false }) => {
  const { t } = useTranslation();
  const mountRef = useRef<HTMLDivElement>(null);
  const sceneRef = useRef<THREE.Scene | null>(null);
  const cameraRef = useRef<THREE.PerspectiveCamera | null>(null);
  const controlsRef = useRef<OrbitControls | null>(null);
  const modelRef = useRef<THREE.Object3D | null>(null);
  const viewerRootRef = useRef<THREE.Group | null>(null);
  const gridRef = useRef<THREE.GridHelper | null>(null);
  const axesRef = useRef<THREE.AxesHelper | null>(null);
  const [geometry, setGeometry] = useState<CadGeometryData | null>(null);
  const [state, setState] = useState<'loading' | 'processing' | 'ready' | 'unavailable' | 'error'>('loading');
  const [message, setMessage] = useState('');
  const [documentUrl, setDocumentUrl] = useState<string | null>(null);
  const [gridVisible] = useState(true);
  const [axesVisible] = useState(true);
  const [isFullscreen, setIsFullscreen] = useState(false);
  const is2D = geometry?.metadata?.geometryKind === '2D';
  const metadata = geometry?.metadata;
  const baseDimensions = setup?.baseDimensions || (metadata?.dimensions ? { x: metadata.dimensions.width, y: metadata.dimensions.height, z: metadata.dimensions.depth } : null);
  const dimensions = setup?.dimensions || baseDimensions;
  const unit = setup?.unit || 'mm';
  const displayDimensions = dimensions ? { x: convertLength(dimensions.x, 'mm', unit), y: convertLength(dimensions.y, 'mm', unit), z: convertLength(dimensions.z, 'mm', unit) } : null;
  const baseVolume = setup?.volume ?? metadata?.volume ?? null;
  const baseSurfaceArea = setup?.surfaceArea ?? metadata?.surfaceArea ?? null;
  const displayVolume = baseVolume === null ? null : convertVolume(baseVolume, 'mm', unit);
  const displaySurfaceArea = baseSurfaceArea === null ? null : convertArea(baseSurfaceArea, 'mm', unit);

  const fitModel = () => {
    const root = viewerRootRef.current; const camera = cameraRef.current; const controls = controlsRef.current;
    if (!root || !camera || !controls) return;
    root.position.set(0, 0, 0);
    root.updateMatrixWorld(true);
    const box = new THREE.Box3().setFromObject(root);
    if (box.isEmpty()) return;
    const center = box.getCenter(new THREE.Vector3());
    const sphere = box.getBoundingSphere(new THREE.Sphere());
    root.position.sub(center);
    root.updateMatrixWorld(true);
    const centeredBox = new THREE.Box3().setFromObject(root);
    const centeredCenter = centeredBox.getCenter(new THREE.Vector3());
    const radius = Math.max(sphere.radius, 0.001);
    const verticalFov = THREE.MathUtils.degToRad(camera.fov);
    const horizontalFov = 2 * Math.atan(Math.tan(verticalFov / 2) * Math.max(camera.aspect, 0.1));
    const limitingFov = Math.min(verticalFov, horizontalFov);
    const distance = (radius * 1.35) / Math.tan(limitingFov / 2);
    const direction = is2D ? new THREE.Vector3(0, 0, 1) : new THREE.Vector3(1, 0.65, 1).normalize();
    camera.position.copy(centeredCenter).addScaledVector(direction, distance);
    camera.near = Math.max(radius / 1000, distance - radius * 1.5, 0.001);
    camera.far = Math.max(distance + radius * 2.5, radius * 10, 100);
    camera.lookAt(centeredCenter);
    camera.updateProjectionMatrix();
    controls.target.copy(centeredCenter);
    controls.maxDistance = Math.max(radius * 20, distance * 6);
    controls.minDistance = Math.max(radius / 1000, 0.001);
    controls.update();
    const grid = gridRef.current;
    if (grid) {
      grid.position.copy(centeredCenter);
      grid.scale.setScalar(Math.max(radius * 3, 1) / 10);
    }
    const axes = axesRef.current;
    if (axes) {
      axes.position.copy(centeredCenter);
      axes.scale.setScalar(Math.max(radius, 1));
    }
  };

  useEffect(() => {
    let active = true; let timer: number | undefined; let viewerUrl: string | undefined;
    setState('loading');
    setGeometry(null);
    setDocumentUrl(null);
    modelRef.current = null;
    const load = async () => {
      try {
        const versionId = file.latestVersion?.id;
        const result = await ApiService.getCadGeometry(file.id, versionId);
        if (!active || !result) return;
        setGeometry(result); onGeometry(result);
        if (result.status !== 'COMPLETE') { setState('processing'); timer = window.setTimeout(load, 1100); return; }
        if (result.metadata?.geometryStatus !== 'READY' || !result.metadata.viewerAsset?.available || !['STL', 'OBJ', 'PLY', 'DXF', 'SVG', 'PDF', 'STEP', 'STP', 'IGES', 'IGS'].includes(result.format)) { setState('unavailable'); return; }
        const blob = await ApiService.getCadViewerAsset(file.id, versionId); const buffer = await blob.arrayBuffer();
        if (result.format === 'SVG' || result.format === 'PDF') {
          viewerUrl = URL.createObjectURL(blob);
          if (!active) { URL.revokeObjectURL(viewerUrl); return; }
          setDocumentUrl(viewerUrl); setState('ready'); return;
        }
        let model: THREE.Object3D;
        if (result.format === 'STL') {
          const bufferGeometry = new STLLoader().parse(buffer); bufferGeometry.computeVertexNormals();
          model = new THREE.Mesh(bufferGeometry, new THREE.MeshStandardMaterial({ color: 0x72e6d2, metalness: .18, roughness: .5, side: THREE.DoubleSide }));
        } else if (result.format === 'OBJ') {
          model = new OBJLoader().parse(new TextDecoder().decode(buffer));
          model.traverse((child) => { if (child instanceof THREE.Mesh) child.material = new THREE.MeshStandardMaterial({ color: 0x72e6d2, metalness: .18, roughness: .5, side: THREE.DoubleSide }); });
        } else if (result.format === 'PLY') {
          const bufferGeometry = new PLYLoader().parse(buffer); bufferGeometry.computeVertexNormals();
          model = new THREE.Mesh(bufferGeometry, new THREE.MeshStandardMaterial({ color: 0x72e6d2, metalness: .18, roughness: .5, side: THREE.DoubleSide, vertexColors: bufferGeometry.hasAttribute('color') }));
        } else if (['STEP', 'STP', 'IGES', 'IGS'].includes(result.format)) {
          const gltf = await new GLTFLoader().parseAsync(buffer, '');
          model = gltf.scene;
        } else {
          model = createDxfModel(new TextDecoder().decode(buffer));
        }
        if (!active) return;
        modelRef.current = model; setState('ready');
      } catch (error) {
        if (!active) return;
        setState('error'); setMessage(error instanceof ApiError ? error.message : t('geometry.loadError'));
      }
    };
    void load();
    return () => { active = false; if (timer) window.clearTimeout(timer); if (viewerUrl) URL.revokeObjectURL(viewerUrl); };
  }, [file.id, t]);

  useEffect(() => {
    const mount = mountRef.current; const model = modelRef.current;
    if (state !== 'ready' || !mount || !model) return;
    const scene = new THREE.Scene(); sceneRef.current = scene;
    const theme = getComputedStyle(document.documentElement); scene.background = new THREE.Color(theme.getPropertyValue('--cam-bg').trim() || '#0a0a0a');
    const camera = new THREE.PerspectiveCamera(45, 1, .01, 100000); cameraRef.current = camera;
    const renderer = new THREE.WebGLRenderer({ antialias: true }); renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2)); renderer.outputColorSpace = THREE.SRGBColorSpace; mount.appendChild(renderer.domElement);
    const controls = new OrbitControls(camera, renderer.domElement); controls.enableDamping = true; controls.screenSpacePanning = true; controls.enableRotate = !is2D; controlsRef.current = controls;
    scene.add(new THREE.HemisphereLight(0xffffff, 0x26364d, 2.2)); const directional = new THREE.DirectionalLight(0xffffff, 2.4); directional.position.set(4, 7, 5); scene.add(directional);
    const grid = new THREE.GridHelper(20, 20, 0x4d6480, 0x26364d); if (is2D) grid.rotation.x = Math.PI / 2; grid.visible = gridVisible; gridRef.current = grid; scene.add(grid);
    const axes = new THREE.AxesHelper(2); axes.visible = axesVisible; axesRef.current = axes;
    const viewerRoot = new THREE.Group(); viewerRootRef.current = viewerRoot; viewerRoot.add(model); scene.add(axes, viewerRoot);
    fitModel();
    let frame = 0;
    const resize = () => { const rect = mount.getBoundingClientRect(); renderer.setSize(rect.width, rect.height, false); camera.aspect = rect.width / Math.max(rect.height, 1); camera.updateProjectionMatrix(); };
    const render = () => { controls.update(); renderer.render(scene, camera); frame = requestAnimationFrame(render); };
    resize(); render(); const observer = new ResizeObserver(resize); observer.observe(mount);
    return () => { observer.disconnect(); cancelAnimationFrame(frame); controls.dispose(); renderer.dispose(); renderer.forceContextLoss(); renderer.domElement.remove(); scene.traverse((object) => { if (object instanceof THREE.Mesh) { object.geometry.dispose(); const materials = Array.isArray(object.material) ? object.material : [object.material]; materials.forEach((material) => material.dispose()); } }); sceneRef.current = null; controlsRef.current = null; cameraRef.current = null; viewerRootRef.current = null; };
  }, [state]);

  useEffect(() => {
    const root = viewerRootRef.current;
    if (!root || !baseDimensions || !dimensions) return;
    root.scale.set(dimensions.x / baseDimensions.x, dimensions.y / baseDimensions.y, dimensions.z / baseDimensions.z);
    root.updateMatrixWorld(true);
    fitModel();
  }, [dimensions?.x, dimensions?.y, dimensions?.z, baseDimensions?.x, baseDimensions?.y, baseDimensions?.z]);

  useEffect(() => {
    const exitFullscreen = (event: KeyboardEvent) => { if (event.key === 'Escape') setIsFullscreen(false); };
    window.addEventListener('keydown', exitFullscreen);
    return () => window.removeEventListener('keydown', exitFullscreen);
  }, []);

  const retry = async () => { setState('processing'); setMessage(''); await ApiService.retryCadProcessing(file.id); };

  const value = (property: keyof NonNullable<CadGeometryData['metadata']>) => metadata?.[property] as number | undefined;

  return <div className={`geometry-viewer-layout${isFullscreen ? ' is-fullscreen' : ''}${thumbnail ? ' is-thumbnail' : ''}`}>
    {!thumbnail && <section className="geometry-properties-panel">
      <div className="geometry-properties-heading"><h3><Icon name="configure" size={16} /> {t('geometry.modelProperties')}</h3><fieldset className="geometry-unit-selector"><legend>{t('geometry.unit')}</legend>{(['mm', 'cm', 'in', 'm'] as ModelUnit[]).map((option) => <button type="button" key={option} className={unit === option ? 'is-active' : ''} onClick={() => onSetupChange?.({ unit: option })}>{option}</button>)}</fieldset></div>
      <div className="geometry-dimensions"><span>{t('geometry.boundingBox', { unit })}</span><div>{(['x', 'y', 'z'] as const).map((axis) => <label className="geometry-dimension" key={axis}><b>{axis.toUpperCase()}</b><input aria-label={`${axis.toUpperCase()} dimension in ${unit}`} type="number" min="0.000001" step="any" value={displayDimensions ? Number(displayDimensions[axis].toFixed(6)) : ''} onChange={(event) => { const next = Number(event.target.value); if (!Number.isFinite(next) || next <= 0 || !dimensions) return; const nextMm = convertLength(next, unit, 'mm'); const scaled = scaleDimensions(dimensions, axis, nextMm); const scale = dimensions[axis] ? scaled[axis] / dimensions[axis] : 1; onSetupChange?.({ dimensions: scaled, volume: baseVolume === null ? null : baseVolume * scale ** 3, surfaceArea: baseSurfaceArea === null ? null : baseSurfaceArea * scale ** 2 }); }} /></label>)}</div><p className="geometry-uniform-hint"><Icon name="configure" size={13} /> {t('geometry.uniformScaling')}</p></div>
      <div className="geometry-metrics"><div className="geometry-metric geometry-volume"><span>{t('geometry.volume')}</span><strong>{displayVolume === null ? t('geometry.notAvailable') : formatModelValue(displayVolume, unit === 'm' ? 8 : unit === 'in' ? 5 : 2)}<small> {unit}³</small></strong></div><div className="geometry-metric geometry-area"><span>{t('geometry.surfaceArea')}</span><strong>{displaySurfaceArea === null ? t('geometry.notAvailable') : formatModelValue(displaySurfaceArea, unit === 'm' ? 8 : unit === 'in' ? 5 : 2)}<small> {unit}²</small></strong></div></div>
      <div className="geometry-mesh-info"><span>{t('geometry.meshInformation')}</span><div><b>{t('geometry.triangleCount')}</b><strong>{(setup?.triangleCount ?? value('triangleCount')) === undefined || (setup?.triangleCount ?? value('triangleCount')) === null ? t('geometry.notAvailable') : formatModelValue(setup?.triangleCount ?? value('triangleCount'), 0)}</strong></div></div>
    </section>}
    <section className="geometry-viewer-section">
      <h3><Icon name="cube" size={16} /> {t('geometry.viewer3d')}</h3>
    <section className="geometry-canvas-panel" aria-label={is2D ? t('geometry.viewer2dLabel') : t('geometry.viewerLabel')}>
      {state === 'ready' && documentUrl && geometry?.format === 'SVG' && <img className="geometry-document-canvas" src={documentUrl} alt={t('geometry.viewer2dLabel')} />}
      {state === 'ready' && documentUrl && geometry?.format === 'PDF' && <iframe className="geometry-document-canvas" src={documentUrl} title={t('geometry.documentLabel')} />}
      {state === 'ready' && !documentUrl && <><div ref={mountRef} className="geometry-canvas" /><div className="geometry-toolbar"><button title={t('geometry.resetView')} aria-label={t('geometry.resetView')} onClick={fitModel}><Icon name="reset" size={16} /></button><button title={t('geometry.fullscreen')} aria-label={t('geometry.fullscreen')} onClick={() => setIsFullscreen(true)}><Icon name="expand" size={16} /></button></div><div className="geometry-controls-hint">{t('geometry.rotateHint')} <span>{t('geometry.zoomHint')}</span><span>{t('geometry.panHint')}</span></div>{isFullscreen && <button className="geometry-fullscreen-close" title={t('geometry.exitFullscreen')} aria-label={t('geometry.exitFullscreen')} onClick={() => setIsFullscreen(false)}><Icon name="close" size={20} /></button>}</>}
      {(state === 'loading' || state === 'processing') && <div className="geometry-state"><span className="geometry-spinner" /><strong>{t('geometry.processing')}</strong><p>{t('geometry.processingDescription')}</p></div>}
      {state === 'unavailable' && <div className="geometry-state"><strong>{t('geometry.unavailable')}</strong><p>{t('geometry.unavailableDescription', { format: geometry?.format || file.format })}</p></div>}
      {state === 'error' && <div className="geometry-state geometry-error"><strong>{t('geometry.error')}</strong><p>{message}</p><button className="btn btn-outline" onClick={() => void retry()}>{t('geometry.retry')}</button></div>}
    </section>
    </section>
  </div>;
};
