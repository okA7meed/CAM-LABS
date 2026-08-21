import { mkdtemp, rm } from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import { describe, expect, it, afterEach } from 'vitest';
import { BasicCadMetadataExtractor, calculateChecksum, LocalFileScanner, getCadFormat, isCadMimeTypeCompatible } from '../src/cad/file-processing';
import { FilesystemObjectStorage } from '../src/cad/object-storage';
import { parseMultipartForm } from '../src/cad/multipart';

const temporaryDirectories: string[] = [];

afterEach(async () => {
  await Promise.all(temporaryDirectories.splice(0).map((directory) => rm(directory, { recursive: true, force: true })));
});

describe('CAD processing boundaries', () => {
  it('parses a binary multipart upload without altering file bytes', () => {
    const boundary = 'phase03-boundary';
    const payload = Buffer.from('solid test\nfacet normal 0 0 0\nendsolid test');
    const body = Buffer.concat([
      Buffer.from(`--${boundary}\r\nContent-Disposition: form-data; name="file"; filename="part.stl"\r\nContent-Type: model/stl\r\n\r\n`),
      payload,
      Buffer.from(`\r\n--${boundary}--\r\n`),
    ]);

    const form = parseMultipartForm(`multipart/form-data; boundary=${boundary}`, body);
    expect(form.file.originalName).toBe('part.stl');
    expect(form.file.data.equals(payload)).toBe(true);
  });

  it('rejects storage traversal keys', async () => {
    const directory = await mkdtemp(path.join(os.tmpdir(), 'cam-labs-cad-'));
    temporaryDirectories.push(directory);
    const storage = new FilesystemObjectStorage(directory);
    await expect(storage.put('../outside.step', Buffer.from('x'), 'application/octet-stream')).rejects.toThrow();
  });

  it('calculates stable checksums and quarantines the antivirus test signature', async () => {
    const data = Buffer.from('CAD content');
    expect(calculateChecksum(data)).toBe(calculateChecksum(Buffer.from('CAD content')));
    const scanner = new LocalFileScanner();
    const clean = await scanner.scan(data);
    const quarantined = await scanner.scan(Buffer.from('X5O!P%@AP[4\\PZX54(P^)7CC)7}$EICAR-STANDARD-ANTIVIRUS-TEST-FILE!$H+H*'));
    expect(clean.status).toBe('CLEAN');
    expect(quarantined.status).toBe('QUARANTINED');
  });

  it('extracts deterministic STL metadata and flags empty geometry', () => {
    const extractor = new BasicCadMetadataExtractor();
    const stl = Buffer.alloc(134);
    stl.writeUInt32LE(1, 80);
    expect(extractor.extract('STL', stl).metadata).toMatchObject({ geometryStatus: 'UNAVAILABLE' });
    expect(extractor.extract('STL', Buffer.alloc(0)).dfmStatus).toBe('WARNING');
    expect(getCadFormat('bracket.STEP')).toBe('STEP');
    expect(() => getCadFormat('bracket.exe')).toThrowError(/Unsupported CAD format/);
  });

  it('extracts real dimensions, area, volume, and mesh counts from an ASCII STL tetrahedron', () => {
    const tetrahedron = Buffer.from(`solid tetrahedron
facet normal 0 0 -1
 outer loop
  vertex 0 0 0
  vertex 1 0 0
  vertex 0 1 0
 endloop
endfacet
facet normal 0 -1 0
 outer loop
  vertex 0 0 0
  vertex 0 0 1
  vertex 1 0 0
 endloop
endfacet
facet normal -1 0 0
 outer loop
  vertex 0 0 0
  vertex 0 1 0
  vertex 0 0 1
 endloop
endfacet
facet normal 1 1 1
 outer loop
  vertex 1 0 0
  vertex 0 0 1
  vertex 0 1 0
 endloop
endfacet
endsolid tetrahedron`);
    const metadata = new BasicCadMetadataExtractor().extract('STL', tetrahedron);
    expect(metadata.metadata).toMatchObject({ geometryStatus: 'READY', triangleCount: 4, vertexCount: 12, faceCount: 4, dimensions: { width: 1, height: 1, depth: 1 } });
    expect(metadata.metadata.volume).toBeCloseTo(1 / 6);
    expect(metadata.dimensions).toBe('1.000 × 1.000 × 1.000 units');
  });

  it('extracts real geometry from binary STL and OBJ variants', () => {
    const binaryStl = Buffer.alloc(84 + 4 * 50);
    binaryStl.writeUInt32LE(4, 80);
    const triangles = [
      [[0, 0, 0], [0, 1, 0], [1, 0, 0]],
      [[0, 0, 0], [1, 0, 0], [0, 0, 1]],
      [[0, 0, 0], [0, 0, 1], [0, 1, 0]],
      [[1, 0, 0], [0, 1, 0], [0, 0, 1]],
    ];
    triangles.forEach((triangle, triangleIndex) => {
      triangle.forEach((vertex, vertexIndex) => {
        vertex.forEach((coordinate, axis) => binaryStl.writeFloatLE(coordinate, 84 + triangleIndex * 50 + 12 + vertexIndex * 12 + axis * 4));
      });
    });
    const binaryMetadata = new BasicCadMetadataExtractor().extract('STL', binaryStl);
    expect(binaryMetadata.metadata).toMatchObject({ geometryStatus: 'READY', triangleCount: 4, dimensions: { width: 1, height: 1, depth: 1 } });
    expect(binaryMetadata.metadata.volume).toBeCloseTo(1 / 6);

    const obj = Buffer.from('v 0 0 0\nv 1 0 0\nv 0 1 0\nv 0 0 1\nf 1 3 2\nf 1 2 4\nf 1 4 3\nf 2 3 4\n');
    const objMetadata = new BasicCadMetadataExtractor().extract('OBJ', obj);
    expect(objMetadata.metadata).toMatchObject({ geometryStatus: 'READY', triangleCount: 4, vertexCount: 4, dimensions: { width: 1, height: 1, depth: 1 } });
    expect(objMetadata.metadata.volume).toBeCloseTo(1 / 6);
  });

  it('does not promote malformed or degenerate mesh data to viewer-ready geometry', () => {
    const malformedAscii = Buffer.from('vertex 0 0 0\nvertex 1 0 0\nvertex 0 1 0');
    const degenerateBinary = Buffer.alloc(134);
    degenerateBinary.writeUInt32LE(1, 80);

    expect(new BasicCadMetadataExtractor().extract('STL', malformedAscii).metadata).toMatchObject({ geometryStatus: 'UNAVAILABLE', supportLevel: 'FAILED_VALIDATION' });
    expect(new BasicCadMetadataExtractor().extract('STL', degenerateBinary).metadata).toMatchObject({ geometryStatus: 'UNAVAILABLE', supportLevel: 'FAILED_VALIDATION' });
    expect(new BasicCadMetadataExtractor().extract('OBJ', Buffer.from('v 0 0 0\nv 1 0 0\nf 1 2\n')).metadata).toMatchObject({ geometryStatus: 'UNAVAILABLE', supportLevel: 'FAILED_VALIDATION' });
    expect(new BasicCadMetadataExtractor().extract('PLY', Buffer.from('ply\nformat ascii 1.0\nend_header\n')).metadata).toMatchObject({ geometryStatus: 'UNAVAILABLE', supportLevel: 'FAILED_VALIDATION' });
  });

  it('extracts real geometry from ASCII and binary little-endian PLY tetrahedra', () => {
    const asciiPly = Buffer.from(`ply
format ascii 1.0
element vertex 4
property float x
property float y
property float z
element face 4
property list uchar int vertex_indices
end_header
0 0 0
1 0 0
0 1 0
0 0 1
3 0 2 1
3 0 1 3
3 0 3 2
3 1 2 3
`);
    const asciiMetadata = new BasicCadMetadataExtractor().extract('PLY', asciiPly);
    expect(asciiMetadata.metadata).toMatchObject({ geometryStatus: 'READY', variant: 'ASCII', triangleCount: 4, vertexCount: 4, dimensions: { width: 1, height: 1, depth: 1 } });
    expect(asciiMetadata.metadata.volume).toBeCloseTo(1 / 6);

    const header = Buffer.from('ply\nformat binary_little_endian 1.0\nelement vertex 4\nproperty float x\nproperty float y\nproperty float z\nelement face 4\nproperty list uchar int vertex_indices\nend_header\n');
    const body = Buffer.alloc(4 * 12 + 4 * 13);
    const vertices = [[0, 0, 0], [1, 0, 0], [0, 1, 0], [0, 0, 1]];
    vertices.forEach((vertex, vertexIndex) => vertex.forEach((coordinate, axis) => body.writeFloatLE(coordinate, vertexIndex * 12 + axis * 4)));
    const faces = [[0, 2, 1], [0, 1, 3], [0, 3, 2], [1, 2, 3]];
    faces.forEach((face, faceIndex) => {
      const offset = 48 + faceIndex * 13;
      body.writeUInt8(3, offset);
      face.forEach((vertexIndex, index) => body.writeInt32LE(vertexIndex, offset + 1 + index * 4));
    });
    const binaryMetadata = new BasicCadMetadataExtractor().extract('PLY', Buffer.concat([header, body]));
    expect(binaryMetadata.metadata).toMatchObject({ geometryStatus: 'READY', variant: 'BINARY_LITTLE_ENDIAN', triangleCount: 4, vertexCount: 4, dimensions: { width: 1, height: 1, depth: 1 } });
    expect(binaryMetadata.metadata.volume).toBeCloseTo(1 / 6);
  });

  it('classifies accepted but unparsed engineering formats as upload-only', () => {
    for (const format of ['STEP', 'STP', 'IGES', 'IGS'] as const) {
      const metadata = new BasicCadMetadataExtractor().extract(format, Buffer.from('VALIDATION_PLACEHOLDER_PAYLOAD'));
      expect(metadata.metadata).toMatchObject({ geometryStatus: 'UNAVAILABLE', supportLevel: 'UPLOAD_ONLY' });
      expect(metadata.dfmStatus).toBe('WARNING');
    }
  });

  it('extracts declared units, bounds, and entity counts from a real planar DXF drawing', () => {
    const dxf = Buffer.from(`0
SECTION
2
HEADER
9
$INSUNITS
70
4
0
ENDSEC
0
SECTION
2
ENTITIES
0
LINE
8
0
10
0
20
0
30
0
11
10
21
0
31
0
0
LINE
8
0
10
10
20
0
30
0
11
10
21
5
31
0
0
LINE
8
0
10
10
20
5
30
0
11
0
21
5
31
0
0
LINE
8
0
10
0
20
5
30
0
11
0
21
0
31
0
0
ENDSEC
0
EOF
`);
    const metadata = new BasicCadMetadataExtractor().extract('DXF', dxf);
    expect(metadata.metadata).toMatchObject({ geometryStatus: 'READY', geometryKind: '2D', supportLevel: 'VIEWER_SUPPORTED', units: 'mm', dimensions: { width: 10, height: 5, depth: 0 }, entityCount: 4, objectCount: 4 });
    expect(metadata.volume).toBeUndefined();
  });

  it('validates SVG drawings and PDF documents before marking private viewer assets ready', () => {
    const extractor = new BasicCadMetadataExtractor();
    const svg = Buffer.from('<svg viewBox="0 0 120 60" xmlns="http://www.w3.org/2000/svg"><rect width="120" height="60" /></svg>');
    const validSvg = extractor.extract('SVG', svg);
    expect(validSvg.metadata).toMatchObject({ geometryStatus: 'READY', geometryKind: '2D', viewerAsset: { available: true, format: 'SVG' }, dimensions: { width: 120, height: 60, depth: 0 } });
    expect(extractor.extract('SVG', Buffer.from('<svg><script>alert(1)</script></svg>')).metadata).toMatchObject({ supportLevel: 'FAILED_VALIDATION' });

    const validPdf = extractor.extract('PDF', Buffer.from('%PDF-1.7\n1 0 obj\n<<>>\nendobj\n%%EOF'));
    expect(validPdf.metadata).toMatchObject({ geometryStatus: 'READY', geometryKind: 'DOCUMENT', viewerAsset: { available: true, format: 'PDF' }, metadataStatus: 'LIMITED' });
    expect(extractor.extract('PDF', Buffer.from('not a pdf')).metadata).toMatchObject({ supportLevel: 'FAILED_VALIDATION' });
    expect(getCadFormat('drawing.svg')).toBe('SVG');
    expect(getCadFormat('drawing.pdf')).toBe('PDF');
  });

  it('rejects formats without upload or processing implementations', () => {
    expect(getCadFormat('part.ply')).toBe('PLY');
    for (const fileName of ['part.3mf', 'part.glb', 'part.gltf', 'part.dwg']) {
      expect(() => getCadFormat(fileName)).toThrowError(/Unsupported CAD format/);
    }
  });

  it('accepts compatible CAD MIME declarations and rejects contradictory content types', () => {
    expect(isCadMimeTypeCompatible('STL', 'model/stl')).toBe(true);
    expect(isCadMimeTypeCompatible('STL', 'application/octet-stream')).toBe(true);
    expect(isCadMimeTypeCompatible('OBJ', 'text/plain; charset=utf-8')).toBe(true);
    expect(isCadMimeTypeCompatible('STEP', 'application/step')).toBe(true);
    expect(isCadMimeTypeCompatible('PLY', 'model/ply')).toBe(true);
    expect(isCadMimeTypeCompatible('STL', 'text/html')).toBe(false);
    expect(isCadMimeTypeCompatible('OBJ', 'image/png')).toBe(false);
  });
});