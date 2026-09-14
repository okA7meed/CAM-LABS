import { describe, it, expect } from 'vitest';
import * as THREE from 'three';
import {
  SUPPORTED_GEOMETRY_FORMATS,
  CadGeometryUnavailableError,
  parseCadBuffer,
  disposeCadModel,
  applyCadMaterial,
  ensureVertexNormals,
} from './cadGeometryLoaders';

const stlBuffer = (): ArrayBuffer => {
  const buffer = new ArrayBuffer(80 + 4 + 50);
  const view = new DataView(buffer);
  const floats = [
    0, 0, 0,
    1, 0, 0,
    0, 1, 0,
  ];
  view.setUint32(80, 1, true); /* triangle count */
  const base = 84;
  floats.forEach((value, index) => view.setFloat32(base + index * 4, value, true));
  return buffer;
};

describe('SUPPORTED_GEOMETRY_FORMATS', () => {
  it('covers every geometry format the backend can convert to a viewer asset', () => {
    const expected = ['STL', 'OBJ', 'PLY', 'DXF', 'SVG', 'PDF', 'STEP', 'STP', 'IGES', 'IGS'];
    expected.forEach((format) => expect(SUPPORTED_GEOMETRY_FORMATS).toContain(format));
  });

  it('stays in sync with the CAD file type union', () => {
    expect(SUPPORTED_GEOMETRY_FORMATS.length).toBe(10);
  });
});

describe('parseCadBuffer', () => {
  it('parses a binary STL into a double-sided mesh with vertex normals', async () => {
    const model = await parseCadBuffer('STL', stlBuffer());
    const mesh = model as THREE.Mesh;
    expect(mesh.geometry).toHaveProperty('attributes');
    expect(mesh.geometry.getAttribute('normal').count).toBeGreaterThan(0);
    expect((mesh.material as THREE.MeshPhysicalMaterial).side).toBe(THREE.DoubleSide);
  });

  it('parses a DXF drawing into line geometry', async () => {
    const dxf = '0\nSECTION\n2\nENTITIES\n0\nLINE\n8\n0\n10\n0\n20\n0\n30\n0\n11\n10\n21\n0\n31\n0\n0\nENDSEC\n0\nEOF\n';
    const encoded = new TextEncoder().encode(dxf);
    const buffer = encoded.buffer.slice(encoded.byteOffset, encoded.byteOffset + encoded.byteLength) as ArrayBuffer;
    const model = await parseCadBuffer('DXF', buffer);
    const lines = model.children.filter((child): child is THREE.LineSegments => child instanceof THREE.LineSegments);
    expect(lines.length).toBe(1);
    expect(lines[0].geometry.getAttribute('position').count).toBeGreaterThanOrEqual(2);
  });

  it('rejects formats outside the supported set', async () => {
    await expect(parseCadBuffer('GLB', new ArrayBuffer(8))).rejects.toThrow(CadGeometryUnavailableError);
  });
});

describe('ensureVertexNormals', () => {
  it('computes normals for GLB-based geometry that ships without them (STEP/IGES)', () => {
    const geometry = new THREE.BufferGeometry();
    geometry.setAttribute('position', new THREE.BufferAttribute(new Float32Array([0, 0, 0, 1, 0, 0, 0, 1, 0, 1, 1, 0]), 3));
    const mesh = new THREE.Mesh(geometry, new THREE.MeshPhysicalMaterial());
    const scene = new THREE.Group();
    scene.add(mesh);
    expect(mesh.geometry.getAttribute('normal')).toBeUndefined();
    ensureVertexNormals(scene);
    const normal = mesh.geometry.getAttribute('normal');
    expect(normal).toBeDefined();
    expect(normal.count).toBe(4);
    expect(new THREE.Vector3().fromBufferAttribute(normal, 0).length()).toBeCloseTo(1, 5);
  });

  it('leaves meshes that already carry normals untouched', () => {
    const geometry = new THREE.BufferGeometry();
    geometry.setAttribute('position', new THREE.BufferAttribute(new Float32Array([0, 0, 0, 1, 0, 0, 0, 1, 0]), 3));
    const original = new THREE.BufferAttribute(new Float32Array([0, 1, 0, 0, 1, 0, 0, 1, 0]), 3);
    geometry.setAttribute('normal', original);
    const mesh = new THREE.Mesh(geometry, new THREE.MeshPhysicalMaterial());
    const scene = new THREE.Group();
    scene.add(mesh);
    ensureVertexNormals(scene);
    expect(mesh.geometry.getAttribute('normal')).toBe(original);
  });
});

describe('applyCadMaterial / disposeCadModel', () => {
  it('applies a shared physical material to every mesh without leaking clones', async () => {
    const model = await parseCadBuffer('STL', stlBuffer());
    const shared = new THREE.MeshPhysicalMaterial({ color: 0x6b7a92 });
    const applied = applyCadMaterial(model, shared);
    expect(applied.every((material) => material === shared)).toBe(true);
    model.traverse((object) => {
      if (object instanceof THREE.Mesh) expect(object.material).toBe(shared);
    });
    disposeCadModel(model);
    expect(shared.dispose()).toBeUndefined();
  });

  it('keeps PLY vertex colors when present', () => {
    const geometry = new THREE.BufferGeometry();
    geometry.setAttribute('position', new THREE.Float32BufferAttribute([0, 0, 0, 1, 0, 0, 0, 1, 0], 3));
    geometry.setAttribute('color', new THREE.Float32BufferAttribute([1, 0, 0, 0, 1, 0, 0, 0, 1], 3));
    const mesh = new THREE.Mesh(geometry, new THREE.MeshPhysicalMaterial());
    const group = new THREE.Group();
    group.add(mesh);
    const shared = new THREE.MeshPhysicalMaterial();
    const applied = applyCadMaterial(group, shared);
    expect(applied.some((material) => material !== shared)).toBe(true);
    expect((mesh.material as THREE.MeshPhysicalMaterial).vertexColors).toBe(true);
    disposeCadModel(group);
  });
});