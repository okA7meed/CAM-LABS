import * as THREE from 'three';
import { CadFile } from '../../types';
import { CadGeometryUnavailableError, applyCadMaterial } from './cadGeometryLoaders';
import { acquireCadModel, disposeCadClone } from './cadGeometryCache';
import { buildPreviewMaterial } from './materialPreview';

/**
 * Dedicated lightweight CAD thumbnail renderer.
 *
 * Unlike the main 3D Model Viewer — an interactive, DOM-mounted WebGL session —
 * this generates one static frame per uploaded file on a lazily-created WebGL
 * renderer whose canvas never leaves this module. Jobs are serialized through a
 * promise chain, so any number of uploaded files only ever uses ONE WebGL
 * context: no per-card viewers, no context exhaustion, no paint/layout coupling
 * to the React tree.
 *
 * Geometry is NOT fetched or parsed here any more: thumbnail and interactive
 * viewer both acquire from the shared cadGeometryCache, so one file version is
 * fetched + parsed exactly once platform-wide. Each job renders its own cache
 * clone and releases it (and its material instance) after the frame is exported
 * (`preserveDrawingBuffer` keeps the last frame readable).
 */

const THUMB_SIZE = 176;
const MINIMUM_SAFE_RADIUS = 1e-4;

export interface CadThumbnailJob {
  file: CadFile;
  materialId?: string | null;
  colorId?: string | null;
}

let sharedRenderer: THREE.WebGLRenderer | null = null;

const getSharedRenderer = (): THREE.WebGLRenderer => {
  if (sharedRenderer) return sharedRenderer;
  const canvas = document.createElement('canvas');
  canvas.width = canvas.height = THUMB_SIZE;
  const renderer = new THREE.WebGLRenderer({ canvas, antialias: true, preserveDrawingBuffer: true, alpha: false });
  renderer.outputColorSpace = THREE.SRGBColorSpace;
  renderer.toneMapping = THREE.ACESFilmicToneMapping;
  renderer.toneMappingExposure = 1.05;
  sharedRenderer = renderer;
  return renderer;
};

/** Frames the camera around a model using the same convention as the main
    viewer's fit: model centered at origin, bounding-sphere distance, Z-up for
    solids, straight-on for 2D vector drawings. */
const fitAndFrame = (model: THREE.Object3D, is2D: boolean, camera: THREE.PerspectiveCamera): void => {
  const box = new THREE.Box3().setFromObject(model);
  if (box.isEmpty()) throw new CadGeometryUnavailableError('Model has no geometry.');
  const center = box.getCenter(new THREE.Vector3());
  const radius = Math.max(box.getBoundingSphere(new THREE.Sphere()).radius, MINIMUM_SAFE_RADIUS);
  const distance = (radius * 1.5) / Math.tan(THREE.MathUtils.degToRad(camera.fov) / 2);
  model.position.sub(center);
  model.updateMatrixWorld(true);
  camera.near = Math.max(distance - radius * 2, radius / 1000);
  camera.far = distance + radius * 4;
  camera.up.set(0, is2D ? 1 : 0, is2D ? 0 : 1);
  camera.position.set(0, 0, distance);
  if (!is2D) camera.position.set(0, 0, 0).addScaledVector(new THREE.Vector3(1, 0.72, 1).normalize(), distance);
  camera.lookAt(0, 0, 0);
  camera.updateProjectionMatrix();
};

const renderOnce = (model: THREE.Object3D, is2D: boolean, material: THREE.Material, renderer: THREE.WebGLRenderer): string => {
  const scene = new THREE.Scene();
  scene.background = new THREE.Color('#0b101b');
  scene.add(new THREE.HemisphereLight(0xffffff, 0x1b2b3f, 1.15));
  const key = new THREE.DirectionalLight(0xffffff, 2.2);
  key.position.set(6, 8, 5);
  const fill = new THREE.DirectionalLight(0xcfe0f2, 0.55);
  fill.position.set(-5, 3, -4);
  const rim = new THREE.DirectionalLight(0xffffff, 0.7);
  rim.position.set(-4, 5, -7);
  scene.add(key, fill, rim);
  applyCadMaterial(model, material);
  scene.add(model);
  const camera = new THREE.PerspectiveCamera(40, 1, 0.01, 100000);
  fitAndFrame(model, is2D, camera);
  renderer.setSize(THUMB_SIZE, THUMB_SIZE, false);
  renderer.render(scene, camera);
  const dataUrl = renderer.domElement.toDataURL('image/png');
  return dataUrl;
};

const execute = async (job: CadThumbnailJob): Promise<string> => {
  const handle = await acquireCadModel(job.file);
  const material = buildPreviewMaterial(job.materialId ?? null, job.colorId ?? null, { doubleSide: true });
  try {
    return renderOnce(handle.model, handle.is2D, material, getSharedRenderer());
  } finally {
    disposeCadClone(handle.model);
    material.dispose();
    handle.release();
  }
};

let renderQueue: Promise<unknown> = Promise.resolve();
export function renderCadThumbnail(job: CadThumbnailJob): Promise<string> {
  const jobPromise = renderQueue.then(() => execute(job));
  renderQueue = jobPromise.then(() => undefined, () => undefined);
  return jobPromise;
}