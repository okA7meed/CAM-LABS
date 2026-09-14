import * as THREE from 'three';
import { STLLoader } from 'three/examples/jsm/loaders/STLLoader.js';
import { OBJLoader } from 'three/examples/jsm/loaders/OBJLoader.js';
import { PLYLoader } from 'three/examples/jsm/loaders/PLYLoader.js';
import { GLTFLoader } from 'three/examples/jsm/loaders/GLTFLoader.js';
import DxfParser, { IEntity, IPoint } from 'dxf-parser';

/* Single source of truth for the CAD geometry pipeline. Both the main 3D Model
   Viewer and the uploaded-file thumbnails parse uploaded files through these
   helpers — the exact same API request, the exact same loaders, the exact same
   camera convention (Z-up). One pipeline, two consumers. */

export const SUPPORTED_GEOMETRY_FORMATS = ['STL', 'OBJ', 'PLY', 'DXF', 'SVG', 'PDF', 'STEP', 'STP', 'IGES', 'IGS'];

export class CadGeometryUnavailableError extends Error {}

/* The backend's solid-CAD worker emits GLB (STEP/IGES output) with positions
   only. Without normals, three.js shades every fragment with the default
   (0,0,1) normal and these models render as flat black silhouettes in both the
   viewer and the thumbnails. Rebuild normals from the triangle winding so the
   geometry is lit. Meshes that already carry a normal attribute (e.g. glTF
   reports one) are left untouched. */
export const ensureVertexNormals = (scene: THREE.Object3D): void => {
  scene.traverse((object) => {
    if (object instanceof THREE.Mesh && !object.geometry.getAttribute('normal')) object.geometry.computeVertexNormals();
  });
};

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

/** Parses an uploaded geometry buffer (already converted by the backend when
    needed — STEP/IGES arrive as GLB) into an in-memory three.js object. */
export async function parseCadBuffer(format: string, buffer: ArrayBuffer): Promise<THREE.Object3D> {
  if (format === 'STL') {
    const geometry = new STLLoader().parse(buffer);
    geometry.computeVertexNormals();
    return new THREE.Mesh(geometry, new THREE.MeshPhysicalMaterial({ side: THREE.DoubleSide }));
  }
  if (format === 'OBJ') {
    const model = new OBJLoader().parse(new TextDecoder().decode(buffer));
    model.traverse((object) => { if (object instanceof THREE.Mesh) object.material = new THREE.MeshPhysicalMaterial({ side: THREE.DoubleSide }); });
    return model;
  }
  if (format === 'PLY') {
    const geometry = new PLYLoader().parse(buffer);
    geometry.computeVertexNormals();
    return new THREE.Mesh(geometry, new THREE.MeshPhysicalMaterial({ side: THREE.DoubleSide, vertexColors: geometry.hasAttribute('color') }));
  }
  if (format === 'STEP' || format === 'STP' || format === 'IGES' || format === 'IGS') {
    const scene = (await new GLTFLoader().parseAsync(buffer, '')).scene;
    ensureVertexNormals(scene);
    return scene;
  }
  if (format === 'DXF') {
    return createDxfModel(new TextDecoder().decode(buffer));
  }
  throw new CadGeometryUnavailableError(`Unsupported thumbnail format: ${format}`);
}

/** Disposes every geometry and material owned by a parsed model. Must be called
    exactly once, after the model's last render, to release GPU resources. */
export function disposeCadModel(model: THREE.Object3D): void {
  model.traverse((object) => {
    if (object instanceof THREE.Mesh || object instanceof THREE.LineSegments) {
      object.geometry?.dispose();
      const materials = Array.isArray(object.material) ? object.material : [object.material];
      materials.forEach((material) => material?.dispose());
    }
  });
}

/** Applies a built material to every mesh in the model, preserving PLY vertex
    colours when present. Returns the applied material instances. */
export function applyCadMaterial(model: THREE.Object3D, shared: THREE.Material): THREE.Material[] {
  const applied: THREE.Material[] = [shared];
  model.traverse((object) => {
    if (!(object instanceof THREE.Mesh)) return;
    const wantsVertexColors = Boolean(object.geometry.getAttribute('color'));
    if (wantsVertexColors && object.material instanceof THREE.MeshPhysicalMaterial && !object.material.vertexColors) {
      const clone = object.material.clone();
      clone.vertexColors = true;
      applied.push(clone);
      object.material = clone;
      return;
    }
    object.material = shared;
  });
  return applied;
}