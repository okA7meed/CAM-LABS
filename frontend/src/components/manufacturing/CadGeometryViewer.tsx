import React, { Fragment, useCallback, useEffect, useLayoutEffect, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import * as THREE from 'three';
import { OrbitControls } from 'three/examples/jsm/controls/OrbitControls.js';
import { RoomEnvironment } from 'three/examples/jsm/environments/RoomEnvironment.js';
import { CadFile } from '../../types';
import { ApiError, ApiService, CadGeometryData } from '../../services/api';
import { useTranslation } from 'react-i18next';
import { Icon } from '../ui/Icon';
import { ModelDimensions, ModelUnit, convertArea, convertLength, convertVolume, formatModelValue, scaleDimensions } from '../../utils/modelUnits';
import { isPreviewMaterial, buildPreviewMaterial, materialColor } from './materialPreview';
import { AnimatePresence, motion } from 'motion/react';
import { CAM_EASE } from '../ui/AnimatedModal';
import { SUPPORTED_GEOMETRY_FORMATS } from './cadGeometryLoaders';
import { acquireCadModel, fetchCadGeometry } from './cadGeometryCache';

export interface CadViewerSetup {
  unit: ModelUnit;
  dimensions: ModelDimensions | null;
  baseDimensions: ModelDimensions | null;
  volume: number | null;
  surfaceArea: number | null;
  triangleCount: number | null;
}

export const CadGeometryViewer: React.FC<{ file: CadFile; onGeometry: (geometry: CadGeometryData) => void; setup?: CadViewerSetup; onSetupChange?: (update: Partial<CadViewerSetup>) => void; thumbnail?: boolean; materialId?: string | null; colorId?: string | null; wireframe?: boolean; fitSignal?: number; dollySignal?: { dir: 1 | -1; nonce: number } | null; panMode?: boolean }> = ({ file, onGeometry, setup, onSetupChange, thumbnail = false, materialId = null, colorId = null, wireframe = false, fitSignal = 0, dollySignal = null, panMode = false }) => {
  const { t } = useTranslation();
  const mountRef = useRef<HTMLDivElement>(null);
  const sceneRef = useRef<THREE.Scene | null>(null);
  const cameraRef = useRef<THREE.PerspectiveCamera | null>(null);
  const controlsRef = useRef<OrbitControls | null>(null);
  const rendererRef = useRef<THREE.WebGLRenderer | null>(null);
  const modelRef = useRef<THREE.Object3D | null>(null);
  const modelHandleRef = useRef<{ release: () => void } | null>(null);
  const viewerRootRef = useRef<THREE.Group | null>(null);
  const orientationRootRef = useRef<THREE.Group | null>(null);
  const livePreviewMaterialsRef = useRef<THREE.MeshPhysicalMaterial[]>([]);
  const lastColorRef = useRef(new THREE.Color());
  const colorInitRef = useRef(false);
  const [geometry, setGeometry] = useState<CadGeometryData | null>(null);
  const [state, setState] = useState<'loading' | 'processing' | 'ready' | 'unavailable' | 'error'>('loading');
  const [message, setMessage] = useState('');
  const [documentUrl, setDocumentUrl] = useState<string | null>(null);
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

  /**
   * CAM LABS viewing convention: X = horizontal, Y = depth, Z = vertical/up.
   *
   * The viewer works on a Z-up scene (scene.up / camera.up = +Z). Uploaded geometry is kept in
   * its original file coordinate system, so this transform is the single non-destructive
   * "viewer transform" that maps a source model's assumed vertical axis onto the scene's Z axis.
   *
   * We deliberately do NOT derive orientation from bounding-box extents (largest/smallest
   * dimension) — that would misfile legitimate flat plates, brackets, enclosures and housings.
   * The backend does not currently surface per-file up-axis metadata for STEP/IGES/STL/etc., and
   * STL/OBJ/PLY carry no declared frame, so no world rotation is reliably determinable. In that
   * case we preserve the model's original orientation (identity), exactly as the convention
   * requires: "If automatic orientation cannot be determined safely, preserve the original
   * orientation rather than making a destructive guess."
   *
   * The model itself is never animated. Instead the viewer runs a cinematic product-showcase
   * orbit: the camera travels a slow, continuous 360° path around the stationary model's
   * bounding-box center (controls.target) while keeping the model centered and at a stable
   * elevation, so front / side / rear / opposite side are all presented in turn.
   */
  const applyViewerOrientation = () => {
    const orientationRoot = orientationRootRef.current;
    if (!orientationRoot) return;
    const up = new THREE.Vector3(0, 0, 1);
    const identity = new THREE.Quaternion().setFromUnitVectors(new THREE.Vector3(0, 0, 1), up);
    orientationRoot.quaternion.copy(identity);
    orientationRoot.updateMatrixWorld(true);
  };

  const fitModel = useCallback(() => {
    const root = viewerRootRef.current;
    const camera = cameraRef.current;
    const controls = controlsRef.current;
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

    camera.up.copy(is2D ? new THREE.Vector3(0, 1, 0) : new THREE.Vector3(0, 0, 1));
    const direction = is2D ? new THREE.Vector3(0, 0, 1) : new THREE.Vector3(1, 0.7, 1).normalize();

    const verticalFov = THREE.MathUtils.degToRad(camera.fov);
    const horizontalFov = 2 * Math.atan(Math.tan(verticalFov / 2) * Math.max(camera.aspect, 0.1));

    // Target model coverage: approximately 68% of useful area (60-75% spec),
    // maintaining comfortable padding on all sides without clipping or appearing tiny.
    const targetCoverage = 0.68;
    const tanHalfV = Math.tan(verticalFov / 2);
    const tanHalfH = Math.tan(horizontalFov / 2);

    const camUp = camera.up.clone();
    const camRight = new THREE.Vector3().crossVectors(camUp, direction).normalize();
    const camOrthoUp = new THREE.Vector3().crossVectors(direction, camRight).normalize();

    const bMin = centeredBox.min;
    const bMax = centeredBox.max;
    const corners = [
      new THREE.Vector3(bMin.x, bMin.y, bMin.z),
      new THREE.Vector3(bMin.x, bMin.y, bMax.z),
      new THREE.Vector3(bMin.x, bMax.y, bMin.z),
      new THREE.Vector3(bMin.x, bMax.y, bMax.z),
      new THREE.Vector3(bMax.x, bMin.y, bMin.z),
      new THREE.Vector3(bMax.x, bMin.y, bMax.z),
      new THREE.Vector3(bMax.x, bMax.y, bMin.z),
      new THREE.Vector3(bMax.x, bMax.y, bMax.z),
    ];

    let maxDist = 0;
    for (const pt of corners) {
      const xCam = Math.abs(pt.dot(camRight));
      const yCam = Math.abs(pt.dot(camOrthoUp));
      const zOffset = -pt.dot(direction);

      const dH = zOffset + xCam / (targetCoverage * tanHalfH);
      const dV = zOffset + yCam / (targetCoverage * tanHalfV);
      const dNeeded = Math.max(dH, dV);
      if (dNeeded > maxDist) maxDist = dNeeded;
    }

    const distance = Math.max(maxDist, radius * 1.18);

    camera.position.copy(centeredCenter).addScaledVector(direction, distance);
    camera.near = Math.max(radius / 1000, distance - radius * 4, 0.001);
    camera.far = Math.max(distance + radius * 6, radius * 24, 100);
    camera.lookAt(centeredCenter);
    camera.updateProjectionMatrix();

    controls.target.copy(centeredCenter);
    controls.maxDistance = distance * 8;
    controls.minDistance = Math.min(radius / 50, distance / 12);
    controls.update();
  }, [is2D]);

  useEffect(() => {
    let active = true; let timer: number | undefined; let viewerUrl: string | undefined;
    setState('loading');
    setGeometry(null);
    setDocumentUrl(null);
    modelRef.current = null;
    const load = async () => {
      try {
        const versionId = file.latestVersion?.id;
        const result = await fetchCadGeometry(file);
        if (!active || !result) return;
        setGeometry(result); onGeometry(result);
        if (result.status !== 'COMPLETE') { setState('processing'); timer = window.setTimeout(load, 1100); return; }
        if (result.metadata?.geometryStatus !== 'READY' || !result.metadata.viewerAsset?.available || !SUPPORTED_GEOMETRY_FORMATS.includes(result.format)) { setState('unavailable'); return; }
        if (result.format === 'SVG' || result.format === 'PDF') {
          const blob = await ApiService.getCadViewerAsset(file.id, versionId);
          viewerUrl = URL.createObjectURL(blob);
          if (!active) { URL.revokeObjectURL(viewerUrl); return; }
          setDocumentUrl(viewerUrl); setState('ready'); return;
        }
        const handle = await acquireCadModel(file);
        if (!handle) return;
        if (!active) { handle.release(); return; }
        modelHandleRef.current?.release();
        modelHandleRef.current = handle;
        modelRef.current = handle.model;
        setState('ready');
      } catch (error) {
        if (!active) return;
        setState('error'); setMessage(error instanceof ApiError ? error.message : t('geometry.loadError'));
      }
    };
    void load();
    return () => { active = false; if (timer) window.clearTimeout(timer); if (viewerUrl) URL.revokeObjectURL(viewerUrl); modelRef.current = null; modelHandleRef.current?.release(); modelHandleRef.current = null; };
  }, [file.id, file.latestVersion?.id, t]);

  useEffect(() => {
    const model = modelRef.current;
    if (state !== 'ready' || !model) return;
    const activeMaterialId = isPreviewMaterial(materialId) ? materialId : null;
    const hasVertexColors = (() => { let found = false; model.traverse((object) => { if (object instanceof THREE.Mesh && object.geometry.getAttribute('color')) found = true; }); return found; })();
    const shared = buildPreviewMaterial(activeMaterialId, colorId, { doubleSide: true });
    shared.wireframe = wireframe === true;
    const vertexColored = hasVertexColors && shared !== null ? shared.clone() : null;
    if (vertexColored) { vertexColored.vertexColors = true; vertexColored.wireframe = wireframe === true; }
    const replaced: (THREE.Material | THREE.Material[])[] = [];
    model.traverse((object) => {
      if (!(object instanceof THREE.Mesh)) return;
      replaced.push(object.material);
      object.material = (vertexColored && object.geometry.getAttribute('color')) ? vertexColored : shared;
    });
    livePreviewMaterialsRef.current = vertexColored ? [shared, vertexColored] : [shared];
    return () => {
      livePreviewMaterialsRef.current = [];
      replaced.forEach((m) => { const list = Array.isArray(m) ? m : [m]; list.forEach((item) => item.dispose()); });
      shared.dispose();
      vertexColored?.dispose();
    };
  }, [state, materialId, colorId, wireframe]);

  /* Lightweight material colour transition: when the selected material / colour
     changes, glide the live material's base colour from the last committed hue
     to the new one (~320ms, ease-out). This is a plain three.js mutation picked
     up by the existing render loop — it never recreates the renderer, never
     animates the camera or geometry, and does not drive React state. */
  useEffect(() => {
    if (state !== 'ready') return;
    const materials = livePreviewMaterialsRef.current;
    const target = new THREE.Color(materialColor(colorId || 'any'));
    if (materials.length === 0) { lastColorRef.current.copy(target); return; }
    if (!colorInitRef.current) {
      colorInitRef.current = true;
      lastColorRef.current.copy(target);
      return;
    }
    if (window.matchMedia('(prefers-reduced-motion: reduce)').matches || lastColorRef.current.equals(target)) {
      lastColorRef.current.copy(target);
      return;
    }
    const from = lastColorRef.current.clone();
    const duration = 320;
    const start = performance.now();
    let raf = 0;
    const tick = (now: number) => {
      const t = Math.min(1, (now - start) / duration);
      const eased = 1 - Math.pow(1 - t, 3);
      materials.forEach((material) => { material.color.copy(from).lerp(target, eased); });
      if (t < 1) { raf = requestAnimationFrame(tick); } else { lastColorRef.current.copy(target); }
    };
    raf = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(raf);
  }, [state, materialId, colorId]);

useEffect(() => {
    const mount = mountRef.current; const model = modelRef.current;
    if (state !== 'ready' || !mount || !model) return;
    let scene: THREE.Scene | null = null;
    let camera: THREE.PerspectiveCamera | null = null;
    let renderer: THREE.WebGLRenderer | null = null;
    let controls: OrbitControls | null = null;
    let observer: ResizeObserver | null = null;
    let frame = 0; let previous = performance.now();
    try {
      scene = new THREE.Scene(); sceneRef.current = scene;
      scene.up.set(0, 0, 1);
      const theme = getComputedStyle(document.documentElement); scene.background = new THREE.Color(theme.getPropertyValue('--cam-bg').trim() || '#0a0a0a');
      camera = new THREE.PerspectiveCamera(45, 1, .01, 100000); cameraRef.current = camera;
      camera.up.set(0, 0, 1);
      renderer = new THREE.WebGLRenderer({ antialias: true }); rendererRef.current = renderer; renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2)); renderer.outputColorSpace = THREE.SRGBColorSpace; mount.appendChild(renderer.domElement);
      // Physically-based presentation: ACES tonemapping (Mr. r185 also default-encodes sRGB output via
      // outputColorSpace) plus a shared PMREM environment so every material reads from the same IBL.
      renderer.toneMapping = THREE.ACESFilmicToneMapping;
      renderer.toneMappingExposure = 1.05;
      const pmrem = new THREE.PMREMGenerator(renderer);
      scene.environment = pmrem.fromScene(new RoomEnvironment(), 0.04).texture;
      pmrem.dispose();
      controls = new OrbitControls(camera, renderer.domElement); controls.enableDamping = true; controls.screenSpacePanning = true; controls.enableRotate = !is2D; controlsRef.current = controls;
      // Controlled studio-style rig: soft ambient fill + key/fill/rim so curvature,
      // roughness and reflections stay readable without flooding the model.
      scene.add(new THREE.HemisphereLight(0xffffff, 0x2c3b4f, 1.0));
      const key = new THREE.DirectionalLight(0xffffff, 2.0); key.position.set(6, 8, 5); scene.add(key);
      const fillLight = new THREE.DirectionalLight(0xcdd8e6, 0.6); fillLight.position.set(-5, 3, -4); scene.add(fillLight);
      const rimLight = new THREE.DirectionalLight(0x93a7c4, 0.65); rimLight.position.set(-4, 5, -7); scene.add(rimLight);
      const viewerRoot = new THREE.Group(); viewerRootRef.current = viewerRoot;
      const orientationRoot = new THREE.Group(); orientationRootRef.current = orientationRoot; orientationRoot.add(model); viewerRoot.add(orientationRoot);
      scene.add(viewerRoot);
      applyViewerOrientation();
      fitModel();
      const reducedMotion = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
      controls.autoRotate = thumbnail ? false : !is2D && !reducedMotion;
      let lastAspect = 0;
      const resize = () => {
        const rect = mount.getBoundingClientRect();
        if (rect.width <= 0 || rect.height <= 0) return;
        renderer!.setSize(rect.width, rect.height, false);
        const aspect = rect.width / rect.height;
        camera!.aspect = aspect;
        camera!.updateProjectionMatrix();
        if (Math.abs(aspect - lastAspect) > 0.05) {
          lastAspect = aspect;
          fitModel();
        }
      };
      const render = (now: number) => {
        const delta = Math.min(Math.max((now - previous) / 1000, 0), 0.05); previous = now;
        controls!.update(delta); renderer!.render(scene!, camera!); frame = requestAnimationFrame(render);
      };
      resize(); render(performance.now()); observer = new ResizeObserver(resize); observer.observe(mount);
    } catch (error) {
      // Never let a WebGL/driver failure escape and unmount the workspace tree.
      setState('error');
      setMessage(error instanceof Error ? error.message : t('geometry.loadError'));
      sceneRef.current = null; controlsRef.current = null; rendererRef.current = null; cameraRef.current = null; viewerRootRef.current = null; orientationRootRef.current = null;
    }
    return () => {
      observer?.disconnect();
      cancelAnimationFrame(frame);
      controls?.dispose();
      if (renderer) { renderer.dispose(); renderer.forceContextLoss(); renderer.domElement.remove(); }
      scene?.environment?.dispose();
      if (scene) {
        scene.traverse((object) => {
          if (!(object instanceof THREE.Mesh) && !(object instanceof THREE.LineSegments)) return;
          const materials = Array.isArray(object.material) ? object.material : [object.material];
          materials.forEach((material) => material.dispose());
        });
      }
      // NOTE: mesh geometry is intentionally NOT disposed here. The model is a
      // cache clone whose geometry is owned by cadGeometryCache and is freed
      // when the last consumer calls release() (unmount cleanup of the load
      // effect). Disposing it here would corrupt other active consumers.
      sceneRef.current = null; controlsRef.current = null; rendererRef.current = null; cameraRef.current = null; viewerRootRef.current = null; orientationRootRef.current = null;
    };
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

  const panelRef = useRef<HTMLElement | null>(null);
  const panelHomeRef = useRef<Element | null>(null);

  useLayoutEffect(() => {
    const panel = panelRef.current;
    if (!panel) return;
    const host = document.getElementById('root') ?? document.body;
    if (isFullscreen) {
      if (!panelHomeRef.current) panelHomeRef.current = panel.parentElement;
      host.appendChild(panel);
      return () => { const home = panelHomeRef.current; if (home && !home.contains(panel)) home.appendChild(panel); };
    }
    const home = panelHomeRef.current;
    if (home && !home.contains(panel)) home.appendChild(panel);
    return undefined;
  }, [isFullscreen]);

  useEffect(() => {
    if (!isFullscreen) return;
    const prevOverflow = document.body.style.overflow;
    const prevBehavior = document.body.style.overscrollBehavior;
    document.body.style.overflow = 'hidden';
    document.body.style.overscrollBehavior = 'none';
    return () => { document.body.style.overflow = prevOverflow; document.body.style.overscrollBehavior = prevBehavior; };
  }, [isFullscreen]);

  useEffect(() => {
    if (thumbnail || state !== 'ready') return;
    const frames: number[] = [];
    for (let i = 0; i < 3; i += 1) frames.push(window.requestAnimationFrame(() => { fitModel(); }));
    return () => { frames.forEach((id) => window.cancelAnimationFrame(id)); };
  }, [isFullscreen, state, thumbnail, fitModel]);

  /* ── External workspace controls (all optional, default-off) ──────────
   * The Quote Review Workspace drives the same viewer instance through
   * these signals instead of mounting a second renderer. Every effect
   * guards on live refs, so unset props change nothing for existing
   * consumers (Manufacturing Workspace, Order Center, thumbnails). */

  /** Reframe the model without reloading geometry (Fit button). */
  useEffect(() => {
    if (fitSignal > 0 && state === 'ready') fitModel();
  }, [fitSignal, state, fitModel]);

  /** Step dolly toward/away from the orbit target (Zoom buttons). */
  useEffect(() => {
    if (!dollySignal || dollySignal.nonce <= 0 || state !== 'ready') return;
    const camera = cameraRef.current;
    const controls = controlsRef.current;
    if (!camera || !controls) return;
    const offset = camera.position.clone().sub(controls.target);
    const distance = Math.max(offset.length(), 1e-6);
    const next = THREE.MathUtils.clamp(
      distance * (dollySignal.dir === 1 ? 0.8 : 1.25),
      controls.minDistance || distance * 0.1,
      controls.maxDistance || distance * 10,
    );
    camera.position.copy(controls.target).addScaledVector(offset.normalize(), next);
    camera.updateProjectionMatrix();
    controls.update();
  }, [dollySignal, state]);

  /** Left-drag pans instead of rotating (Pan/Orbit mode toggle). */
  useEffect(() => {
    const controls = controlsRef.current;
    if (!controls || state !== 'ready') return;
    controls.mouseButtons.LEFT = panMode ? THREE.MOUSE.PAN : THREE.MOUSE.ROTATE;
    controls.touches.ONE = panMode ? THREE.TOUCH.PAN : THREE.TOUCH.ROTATE;
    controls.update();
  }, [panMode, state]);

  const retry = async () => { setState('processing'); setMessage(''); await ApiService.retryCadProcessing(file.id); };

  const value = (property: keyof NonNullable<CadGeometryData['metadata']>) => metadata?.[property] as number | undefined;

  const triangleCount = setup?.triangleCount ?? value('triangleCount');
  const meshStats = [
    { label: t('geometry.triangleCount'), value: triangleCount },
    ...(value('vertexCount') != null ? [{ label: t('geometry.vertexCount'), value: value('vertexCount') }] : []),
    ...(value('faceCount') != null ? [{ label: t('geometry.faceCount'), value: value('faceCount') }] : []),
  ];

  return <div className={`geometry-viewer-layout${thumbnail ? ' is-thumbnail' : ''}`}>
    {!thumbnail && (
      <header className="geometry-module-header">
        <span className="geometry-module-header-icon" aria-hidden="true"><Icon name="cube" size={16} /></span>
        <div className="geometry-module-header-text">
          <h2 className="geometry-module-header-title">{t('geometry.viewer3d')}</h2>
          <p className="geometry-module-header-subtitle">{t('geometry.viewerSubtitle')}</p>
        </div>
      </header>
    )}
    <div className="geometry-module-body">
      {!thumbnail && (
        <section className="geometry-properties-panel" aria-label={t('geometry.modelProperties')}>
          <div className="geometry-properties-header">
            <div className="geometry-properties-heading">
              <span className="geometry-properties-icon" aria-hidden="true"><Icon name="configure" size={15} /></span>
              <div className="geometry-properties-heading-text">
                <h3>{t('geometry.modelProperties')}</h3>
                <p className="geometry-properties-subtitle">{t('geometry.modelPropertiesSubtitle')}</p>
              </div>
            </div>
            <div className="geometry-unit-selector" role="group" aria-label={t('geometry.unit')}><span className="geometry-unit-label">{t('geometry.unit')}</span>{(['mm', 'cm', 'in', 'm'] as ModelUnit[]).map((option) => <button type="button" key={option} className={unit === option ? 'is-active' : ''} aria-pressed={unit === option} onClick={() => onSetupChange?.({ unit: option })}>{option}</button>)}</div>
          </div>
          <div className="geometry-properties-divider" role="separator" aria-hidden="true" />
          <section className="geometry-bounding-card">
            <h4 className="geometry-section-label">{t('geometry.boundingBox', { unit: unit.toUpperCase() })}</h4>
            <div className="geometry-dimensions">{(['x', 'y', 'z'] as const).map((axis, index) => (
              <Fragment key={axis}>
                {index > 0 && <span className="geometry-dimension-sep" aria-hidden="true" />}
                <label className="geometry-dimension">
                  <span className="geometry-dimension-axis"><Icon name={axis === 'x' ? 'dimensionX' : axis === 'y' ? 'dimensionY' : 'dimensionZ'} size={13} /><b>{axis.toUpperCase()}</b></span>
                  <input aria-label={`${axis.toUpperCase()} dimension in ${unit}`} type="number" min="0.000001" step="any" value={displayDimensions ? Math.round(displayDimensions[axis]) : ''} onChange={(event) => { const next = Number(event.target.value); if (!Number.isFinite(next) || next <= 0 || !dimensions) return; const nextMm = convertLength(next, unit, 'mm'); const scaled = scaleDimensions(dimensions, axis, nextMm); const scale = dimensions[axis] ? scaled[axis] / dimensions[axis] : 1; onSetupChange?.({ dimensions: scaled, volume: baseVolume === null ? null : baseVolume * scale ** 3, surfaceArea: baseSurfaceArea === null ? null : baseSurfaceArea * scale ** 2 }); }} />
                </label>
              </Fragment>
            ))}</div>
          </section>
          <div className="geometry-uniform-row">
            <span className="geometry-uniform-row-icon" aria-hidden="true"><Icon name="scaling" size={14} /></span>
            <span className="geometry-uniform-text"><b>{t('geometry.uniformScalingTitle')}</b><span>{t('geometry.uniformScalingDescription')}</span></span>
          </div>
          <div className="geometry-metrics"><div className="geometry-metric geometry-volume"><span className="geometry-metric-title"><Icon name="cube" size={12} /> {t('geometry.volume')}</span><strong>{displayVolume === null ? t('geometry.notAvailable') : formatModelValue(displayVolume, unit === 'm' ? 8 : unit === 'in' ? 5 : 2)}<small> {unit}³</small></strong></div><div className="geometry-metric geometry-area"><span className="geometry-metric-title"><Icon name="surface" size={12} /> {t('geometry.surfaceArea')}</span><strong>{displaySurfaceArea === null ? t('geometry.notAvailable') : formatModelValue(displaySurfaceArea, unit === 'm' ? 8 : unit === 'in' ? 5 : 2)}<small> {unit}²</small></strong></div></div>
          <section className="geometry-mesh-info">
            <div className="geometry-mesh-intro">
              <span className="geometry-mesh-icon" aria-hidden="true"><Icon name="network" size={14} /></span>
              <div className="geometry-mesh-intro-text">
                <h4 className="geometry-section-label">{t('geometry.meshInformation')}</h4>
                <p className="geometry-mesh-subtitle">{t('geometry.meshInformationSubtitle')}</p>
              </div>
            </div>
            <div className="geometry-mesh-stats">{meshStats.map((stat, index) => (
              <Fragment key={stat.label}>
                {index > 0 && <span className="geometry-mesh-sep" aria-hidden="true" />}
                <span className="geometry-mesh-stat"><b>{stat.label}</b><strong>{stat.value === undefined || stat.value === null ? t('geometry.notAvailable') : formatModelValue(stat.value, 0)}</strong></span>
              </Fragment>
            ))}</div>
          </section>
        </section>
      )}
      <section className="geometry-viewer-section">
        <section ref={panelRef} className={`geometry-canvas-panel${isFullscreen ? ' is-fullscreen' : ''}`} data-material={isPreviewMaterial(materialId) ? materialId : ''} data-color={colorId || ''} aria-label={is2D ? t('geometry.viewer2dLabel') : t('geometry.viewerLabel')}>
          {state === 'ready' && documentUrl && geometry?.format === 'SVG' && <img className="geometry-document-canvas" src={documentUrl} alt={t('geometry.viewer2dLabel')} />}
          {state === 'ready' && documentUrl && geometry?.format === 'PDF' && <iframe className="geometry-document-canvas" src={documentUrl} title={t('geometry.documentLabel')} />}
          {state === 'ready' && !documentUrl && <><div ref={mountRef} className="geometry-canvas" /><div className="geometry-toolbar"><button title={t('geometry.resetView')} aria-label={t('geometry.resetView')} onClick={fitModel}><Icon name="reset" size={16} /></button><button title={isFullscreen ? t('geometry.exitFullscreen') : t('geometry.fullscreen')} aria-label={isFullscreen ? t('geometry.exitFullscreen') : t('geometry.fullscreen')} onClick={() => setIsFullscreen((v) => !v)}><Icon name="expand" size={16} /></button></div><div className="geometry-controls-hint">{t('geometry.rotateHint')} <span>{t('geometry.zoomHint')}</span><span>{t('geometry.panHint')}</span></div></>}
          {state === 'ready' && isFullscreen && <button className="geometry-fullscreen-close" title={t('geometry.exitFullscreen')} aria-label={t('geometry.exitFullscreen')} onClick={() => setIsFullscreen(false)}><Icon name="close" size={20} /></button>}
          <AnimatePresence>
            {isFullscreen && !thumbnail && createPortal(
              <motion.div
                className="geometry-fullscreen-overlay cam-motion"
                aria-hidden="true"
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                exit={{ opacity: 0 }}
                transition={{ duration: 0.3, ease: CAM_EASE }}
                onClick={() => setIsFullscreen(false)}
              />,
              document.getElementById('root') ?? document.body,
            )}
          </AnimatePresence>
          <AnimatePresence initial={false}>
            {(state === 'loading' || state === 'processing') && (
              <motion.div key="geometry-busy" className="geometry-state cam-motion" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} transition={{ duration: 0.22, ease: CAM_EASE }}>
                <span className="geometry-spinner" />
                <strong>{t('orderdetail.previewProcessing', { defaultValue: t('geometry.processing') })}</strong>
                <p>{t('geometry.processingDescription')}</p>
              </motion.div>
            )}
            {state === 'unavailable' && (
              <motion.div key="geometry-unavailable" className="geometry-state cam-motion" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} transition={{ duration: 0.22, ease: CAM_EASE }}>
                <Icon name="cube" size={32} />
                <strong>{t('orderdetail.previewError', { defaultValue: t('geometry.unavailable') })}</strong>
                <p>{t('geometry.unavailableDescription', { format: geometry?.format || file.format })}</p>
                <div className="geometry-state-actions" style={{ display: 'flex', gap: '8px', marginTop: '12px' }}>
                  <button type="button" className="btn btn-outline btn-sm" onClick={() => void retry()}>
                    <Icon name="reset" size={13} />
                    {t('orderdetail.retryPreview', { defaultValue: t('geometry.retry') })}
                  </button>
                  {file.id && (
                    <a href={ApiService.getCadDownloadUrl(file.id)} download className="btn btn-outline btn-sm" target="_blank" rel="noopener noreferrer">
                      <Icon name="download" size={13} />
                      {t('orderdetail.downloadFile', { defaultValue: 'Download File' })}
                    </a>
                  )}
                </div>
              </motion.div>
            )}
            {state === 'error' && (
              <motion.div key="geometry-error" className="geometry-state geometry-error cam-motion" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} transition={{ duration: 0.22, ease: CAM_EASE }}>
                <Icon name="alert" size={32} />
                <strong>{t('orderdetail.previewError', { defaultValue: t('geometry.error') })}</strong>
                <p>{message}</p>
                <div className="geometry-state-actions" style={{ display: 'flex', gap: '8px', marginTop: '12px' }}>
                  <button type="button" className="btn btn-outline btn-sm" onClick={() => void retry()}>
                    <Icon name="reset" size={13} />
                    {t('orderdetail.retryPreview', { defaultValue: t('geometry.retry') })}
                  </button>
                  {file.id && (
                    <a href={ApiService.getCadDownloadUrl(file.id)} download className="btn btn-outline btn-sm" target="_blank" rel="noopener noreferrer">
                      <Icon name="download" size={13} />
                      {t('orderdetail.downloadFile', { defaultValue: 'Download File' })}
                    </a>
                  )}
                </div>
              </motion.div>
            )}
          </AnimatePresence>
        </section>
      </section>
    </div>
  </div>;
};
