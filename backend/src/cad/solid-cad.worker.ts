import { parentPort, workerData } from 'node:worker_threads';

type SolidCadFormat = 'STEP' | 'STP' | 'IGES' | 'IGS';

interface SolidCadWorkerInput {
  format: SolidCadFormat;
  data: Uint8Array;
}

interface SolidCadWorkerResult {
  glb: Uint8Array;
  metadata: Record<string, unknown>;
  dimensions: string;
  volume: string | undefined;
  meshTriangles: string;
  detectedUnit: string;
}

const loadOpenCascade = new Function('specifier', 'return import(specifier)') as (specifier: string) => Promise<{ default: () => Promise<any> }>;

const pad4 = (value: number): number => (value + 3) & ~3;

const createGlb = (positions: number[], indices: number[]): Uint8Array => {
  const positionBuffer = Buffer.from(new Float32Array(positions).buffer);
  const indexBuffer = Buffer.from(new Uint32Array(indices).buffer);
  const binaryLength = pad4(positionBuffer.byteLength) + pad4(indexBuffer.byteLength);
  const positionOffset = 0;
  const indexOffset = pad4(positionBuffer.byteLength);
  const min = [Infinity, Infinity, Infinity];
  const max = [-Infinity, -Infinity, -Infinity];
  for (let index = 0; index < positions.length; index += 3) {
    for (let axis = 0; axis < 3; axis += 1) {
      min[axis] = Math.min(min[axis], positions[index + axis]);
      max[axis] = Math.max(max[axis], positions[index + axis]);
    }
  }
  const json = JSON.stringify({
    asset: { version: '2.0', generator: 'CAM LABS OpenCascade processor' },
    scene: 0,
    scenes: [{ nodes: [0] }],
    nodes: [{ mesh: 0 }],
    meshes: [{ primitives: [{ attributes: { POSITION: 0 }, indices: 1, mode: 4 }] }],
    buffers: [{ byteLength: binaryLength }],
    bufferViews: [
      { buffer: 0, byteOffset: positionOffset, byteLength: positionBuffer.byteLength, target: 34962 },
      { buffer: 0, byteOffset: indexOffset, byteLength: indexBuffer.byteLength, target: 34963 },
    ],
    accessors: [
      { bufferView: 0, componentType: 5126, count: positions.length / 3, type: 'VEC3', min, max },
      { bufferView: 1, componentType: 5125, count: indices.length, type: 'SCALAR' },
    ],
  });
  const jsonBuffer = Buffer.from(json.padEnd(pad4(Buffer.byteLength(json)), ' '));
  const binaryBuffer = Buffer.alloc(binaryLength);
  positionBuffer.copy(binaryBuffer, positionOffset);
  indexBuffer.copy(binaryBuffer, indexOffset);
  const totalLength = 12 + 8 + jsonBuffer.byteLength + 8 + binaryBuffer.byteLength;
  const output = Buffer.alloc(totalLength);
  output.writeUInt32LE(0x46546c67, 0);
  output.writeUInt32LE(2, 4);
  output.writeUInt32LE(totalLength, 8);
  output.writeUInt32LE(jsonBuffer.byteLength, 12);
  output.writeUInt32LE(0x4e4f534a, 16);
  jsonBuffer.copy(output, 20);
  const binaryHeader = 20 + jsonBuffer.byteLength;
  output.writeUInt32LE(binaryBuffer.byteLength, binaryHeader);
  output.writeUInt32LE(0x004e4942, binaryHeader + 4);
  binaryBuffer.copy(output, binaryHeader + 8);
  return output;
};

const readUnit = (reader: any, oc: any, data: Uint8Array): string => {
  if (!reader.FileUnits) return 'unknown';
  try {
    const lengths = new oc.TColStd_SequenceOfAsciiString_1();
    const angles = new oc.TColStd_SequenceOfAsciiString_1();
    const solidAngles = new oc.TColStd_SequenceOfAsciiString_1();
    reader.FileUnits(lengths, angles, solidAngles);
    if (lengths.Length() > 0) {
      const value = lengths.Value(1);
      const text = typeof value === 'string' ? value.toLowerCase() : '';
      if (/^(mm|cm|m|in|ft|micron|um|mil)$/.test(text)) return text;
    }
  } catch {
    return 'unknown';
  }
  const source = Buffer.from(data).toString('latin1');
  if (/SI_UNIT\s*\(\s*\.MILLI\.\s*,\s*\.METRE\.\s*\)/i.test(source)) return 'mm';
  if (/SI_UNIT\s*\(\s*\.CENTI\.\s*,\s*\.METRE\.\s*\)/i.test(source)) return 'cm';
  if (/SI_UNIT\s*\(\s*\$\s*,\s*\.METRE\.\s*\)/i.test(source)) return 'm';
  return 'unknown';
};

const processSolidCad = async ({ format, data }: SolidCadWorkerInput): Promise<SolidCadWorkerResult> => {
  const { default: initOpenCascade } = await loadOpenCascade('opencascade.js/dist/node.js');
  const oc = await initOpenCascade();
  const fileName = `/cad-input.${format.toLowerCase()}`;
  oc.FS.writeFile(fileName, Buffer.from(data));
  const reader = format === 'STEP' || format === 'STP' ? new oc.STEPControl_Reader_1() : new oc.IGESControl_Reader_1();
  if (format === 'STEP' || format === 'STP') oc.STEPControl_Controller.Init();
  else oc.IGESControl_Controller.Init();
  const status = reader.ReadFile(fileName);
  const roots = Number(reader.NbRootsForTransfer());
  if (!status || roots < 1) throw new Error('CAD_IMPORT_FAILED');
  reader.TransferRoots(new oc.Message_ProgressRange_1());
  const shape = reader.OneShape();
  if (shape.IsNull()) throw new Error('CAD_EMPTY_GEOMETRY');
  if (!new oc.BRepCheck_Analyzer(shape, true, false).IsValid_2()) throw new Error('CAD_INVALID_TOPOLOGY');

  const faceEnum = oc.TopAbs_ShapeEnum.TopAbs_FACE;
  const shapeEnum = oc.TopAbs_ShapeEnum.TopAbs_SHAPE;
  const counts = { solidCount: 0, shellCount: 0, faceCount: 0, edgeCount: 0, vertexCount: 0 };
  for (const [key, type] of Object.entries({ solidCount: 'TopAbs_SOLID', shellCount: 'TopAbs_SHELL', faceCount: 'TopAbs_FACE', edgeCount: 'TopAbs_EDGE', vertexCount: 'TopAbs_VERTEX' })) {
    const explorer = new oc.TopExp_Explorer_2(shape, oc.TopAbs_ShapeEnum[type], shapeEnum);
    while (explorer.More()) { counts[key as keyof typeof counts] += 1; explorer.Next(); }
    explorer.delete();
  }
  if (counts.faceCount < 1) throw new Error('CAD_EMPTY_GEOMETRY');

  const bounds = new oc.Bnd_Box_1();
  oc.BRepBndLib.Add(shape, bounds, true);
  const minPoint = bounds.CornerMin();
  const maxPoint = bounds.CornerMax();
  const dimensionsArray = [maxPoint.X() - minPoint.X(), maxPoint.Y() - minPoint.Y(), maxPoint.Z() - minPoint.Z()];
  if (dimensionsArray.some((value) => !Number.isFinite(value) || value <= 0)) throw new Error('CAD_EMPTY_GEOMETRY');

  new oc.BRepMesh_IncrementalMesh_2(shape, Math.max(Math.max(...dimensionsArray) / 500, 0.01), false, 0.5, false);
  const positions: number[] = [];
  const indices: number[] = [];
  const location = new oc.TopLoc_Location_1();
  const faceExplorer = new oc.TopExp_Explorer_2(shape, faceEnum, shapeEnum);
  while (faceExplorer.More()) {
    const rawFace = faceExplorer.Value();
    const face = new oc.TopoDS_Face();
    face.TShape_2(rawFace.TShape_1());
    face.Location_2(rawFace.Location_1(), false);
    face.Orientation_2(rawFace.Orientation_1());
    const triangulation = oc.BRep_Tool.Triangulation(face, location, undefined);
    if (triangulation && !triangulation.IsNull()) {
      const mesh = triangulation.get();
      const offset = positions.length / 3;
      const transform = location.Transformation();
      for (let node = 1; node <= Number(mesh.NbNodes()); node += 1) {
        const point = mesh.Node(node).Transformed(transform);
        positions.push(point.X(), point.Y(), point.Z());
      }
      for (let triangle = 1; triangle <= Number(mesh.NbTriangles()); triangle += 1) {
        const item = mesh.Triangle(triangle);
        indices.push(offset + Number(item.Value(1)) - 1, offset + Number(item.Value(2)) - 1, offset + Number(item.Value(3)) - 1);
      }
    }
    faceExplorer.Next();
  }
  faceExplorer.delete();
  if (indices.length < 3) throw new Error('CAD_TESSELLATION_FAILED');

  const volumeProps = new oc.GProp_GProps_1();
  oc.BRepGProp.VolumeProperties_1(shape, volumeProps, true, false, false);
  const surfaceProps = new oc.GProp_GProps_1();
  oc.BRepGProp.SurfaceProperties_1(shape, surfaceProps, false, false);
  const volume = Number(volumeProps.Mass());
  const surfaceArea = Number(surfaceProps.Mass());
  const detectedUnit = format === 'STEP' || format === 'STP' ? readUnit(reader, oc, data) : 'unknown';
  oc.FS.unlink(fileName);
  const glb = createGlb(positions, indices);
  return {
    glb,
    dimensions: `${dimensionsArray.map((value) => value.toFixed(3)).join(' × ')} ${detectedUnit}`,
    volume: Number.isFinite(volume) ? `${volume.toFixed(3)} cubic ${detectedUnit}` : undefined,
    meshTriangles: String(indices.length / 3),
    detectedUnit,
    metadata: {
      format,
      supportLevel: 'FULLY_SUPPORTED',
      geometryStatus: 'READY',
      geometryKind: 'SOLID',
      viewerAsset: { available: true, format: 'GLB' },
      detectedUnit,
      unitsStatus: detectedUnit === 'unknown' ? 'UNKNOWN' : 'DECLARED',
      boundingBox: { min: [minPoint.X(), minPoint.Y(), minPoint.Z()], max: [maxPoint.X(), maxPoint.Y(), maxPoint.Z()] },
      dimensions: { width: dimensionsArray[0], height: dimensionsArray[1], depth: dimensionsArray[2] },
      volume: Number.isFinite(volume) ? volume : null,
      surfaceArea: Number.isFinite(surfaceArea) ? surfaceArea : null,
      ...counts,
      triangleCount: indices.length / 3,
      vertexCount: positions.length / 3,
    },
  };
};

processSolidCad(workerData as SolidCadWorkerInput)
  .then((result) => parentPort?.postMessage(result))
  .catch((error) => parentPort?.postMessage({ error: error instanceof Error ? error.message : 'CAD_PROCESSING_FAILED' }));