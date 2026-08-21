export type CadFormatCategory = 'MESH_3D' | 'WEB_3D' | 'SOLID_CAD' | 'CAD_2D' | 'DOCUMENT';
export type CadCapabilityLevel = 0 | 1 | 2 | 3 | 4;

export interface CadFormatCapability {
  format: string;
  displayName: string;
  extensions: readonly string[];
  mimeTypes: readonly string[];
  category: CadFormatCategory;
  capabilityLevel: CadCapabilityLevel;
  uploadSupported: boolean;
  processingSupported: boolean;
  geometryParsingSupported: boolean;
  viewerSupported: boolean;
  metadataSupported: boolean;
  conversionRequired: boolean;
  limitations: readonly string[];
}

export const CAD_FORMAT_CAPABILITIES = [
  { format: 'STL', displayName: 'STL', extensions: ['STL'], mimeTypes: ['model/stl', 'application/sla', 'application/vnd.ms-pki.stl'], category: 'MESH_3D', capabilityLevel: 1, uploadSupported: true, processingSupported: true, geometryParsingSupported: true, viewerSupported: true, metadataSupported: true, conversionRequired: false, limitations: ['Units are not encoded reliably and require confirmation.'] },
  { format: 'OBJ', displayName: 'Wavefront OBJ', extensions: ['OBJ'], mimeTypes: ['model/obj', 'text/plain'], category: 'MESH_3D', capabilityLevel: 1, uploadSupported: true, processingSupported: true, geometryParsingSupported: true, viewerSupported: true, metadataSupported: true, conversionRequired: false, limitations: ['External materials and textures are not loaded.'] },
  { format: 'PLY', displayName: 'Polygon File Format', extensions: ['PLY'], mimeTypes: ['model/ply', 'application/ply', 'application/octet-stream', 'text/plain'], category: 'MESH_3D', capabilityLevel: 1, uploadSupported: true, processingSupported: true, geometryParsingSupported: true, viewerSupported: true, metadataSupported: true, conversionRequired: false, limitations: ['Units are not encoded reliably and require confirmation.', 'Faces must use a supported scalar list encoding.'] },
  { format: 'GLTF', displayName: 'glTF', extensions: ['GLTF'], mimeTypes: ['model/gltf+json', 'application/json'], category: 'WEB_3D', capabilityLevel: 0, uploadSupported: false, processingSupported: false, geometryParsingSupported: false, viewerSupported: false, metadataSupported: false, conversionRequired: false, limitations: ['External buffer and texture dependencies require an asset-bundle design.'] },
  { format: 'GLB', displayName: 'Binary glTF', extensions: ['GLB'], mimeTypes: ['model/gltf-binary'], category: 'WEB_3D', capabilityLevel: 0, uploadSupported: false, processingSupported: false, geometryParsingSupported: false, viewerSupported: false, metadataSupported: false, conversionRequired: false, limitations: ['Installed GLTFLoader is not yet connected to trusted backend parsing.'] },
  { format: '3MF', displayName: '3D Manufacturing Format', extensions: ['3MF'], mimeTypes: ['model/3mf', 'application/vnd.ms-package.3dmanufacturing-3dmodel+xml'], category: 'MESH_3D', capabilityLevel: 0, uploadSupported: false, processingSupported: false, geometryParsingSupported: false, viewerSupported: false, metadataSupported: false, conversionRequired: false, limitations: ['Installed ThreeMFLoader is not yet connected to trusted backend package validation.'] },
  { format: 'OFF', displayName: 'Object File Format', extensions: ['OFF'], mimeTypes: ['application/octet-stream', 'text/plain'], category: 'MESH_3D', capabilityLevel: 0, uploadSupported: false, processingSupported: false, geometryParsingSupported: false, viewerSupported: false, metadataSupported: false, conversionRequired: false, limitations: ['No trusted parser or viewer pipeline is implemented.'] },
  { format: 'AMF', displayName: 'Additive Manufacturing File', extensions: ['AMF'], mimeTypes: ['application/x-amf'], category: 'MESH_3D', capabilityLevel: 0, uploadSupported: false, processingSupported: false, geometryParsingSupported: false, viewerSupported: false, metadataSupported: false, conversionRequired: false, limitations: ['Installed AMFLoader is not yet connected to trusted backend XML validation.'] },
  { format: 'STEP', displayName: 'STEP', extensions: ['STEP'], mimeTypes: ['model/step', 'application/step'], category: 'SOLID_CAD', capabilityLevel: 4, uploadSupported: true, processingSupported: true, geometryParsingSupported: true, viewerSupported: true, metadataSupported: true, conversionRequired: true, limitations: ['Supported entities depend on the installed OpenCascade reader.'] },
  { format: 'STP', displayName: 'STEP', extensions: ['STP'], mimeTypes: ['model/step', 'application/step'], category: 'SOLID_CAD', capabilityLevel: 4, uploadSupported: true, processingSupported: true, geometryParsingSupported: true, viewerSupported: true, metadataSupported: true, conversionRequired: true, limitations: ['Alias of STEP; supported entities depend on the installed OpenCascade reader.'] },
  { format: 'IGES', displayName: 'IGES', extensions: ['IGES'], mimeTypes: ['model/iges', 'application/iges'], category: 'SOLID_CAD', capabilityLevel: 4, uploadSupported: true, processingSupported: true, geometryParsingSupported: true, viewerSupported: true, metadataSupported: true, conversionRequired: true, limitations: ['Unsupported IGES entities may cause processing to fail.'] },
  { format: 'IGS', displayName: 'IGES', extensions: ['IGS'], mimeTypes: ['model/iges', 'application/iges'], category: 'SOLID_CAD', capabilityLevel: 4, uploadSupported: true, processingSupported: true, geometryParsingSupported: true, viewerSupported: true, metadataSupported: true, conversionRequired: true, limitations: ['Alias of IGES; unsupported entities may cause processing to fail.'] },
  { format: 'DXF', displayName: 'AutoCAD DXF', extensions: ['DXF'], mimeTypes: ['image/vnd.dxf', 'application/dxf', 'text/plain'], category: 'CAD_2D', capabilityLevel: 2, uploadSupported: true, processingSupported: true, geometryParsingSupported: true, viewerSupported: true, metadataSupported: true, conversionRequired: false, limitations: ['Preview is explicitly 2D.', 'Non-planar entities and unsupported entity types are not promoted to viewer-ready.'] },
  { format: 'SVG', displayName: 'Scalable Vector Graphics', extensions: ['SVG'], mimeTypes: ['image/svg+xml'], category: 'CAD_2D', capabilityLevel: 2, uploadSupported: true, processingSupported: true, geometryParsingSupported: true, viewerSupported: true, metadataSupported: true, conversionRequired: false, limitations: ['Preview is explicitly 2D.', 'SVG is rendered as an image; scripts and linked resources are not executed.'] },
  { format: 'PDF', displayName: 'Portable Document Format', extensions: ['PDF'], mimeTypes: ['application/pdf'], category: 'DOCUMENT', capabilityLevel: 3, uploadSupported: true, processingSupported: true, geometryParsingSupported: false, viewerSupported: true, metadataSupported: true, conversionRequired: false, limitations: ['Preview is a document viewer, not a CAD geometry viewer.', 'Only signature and byte size metadata are extracted.'] },
  { format: 'BREP', displayName: 'Boundary Representation', extensions: ['BREP'], mimeTypes: ['application/octet-stream'], category: 'SOLID_CAD', capabilityLevel: 0, uploadSupported: false, processingSupported: false, geometryParsingSupported: false, viewerSupported: false, metadataSupported: false, conversionRequired: true, limitations: ['No production OpenCascade conversion worker is configured.'] },
  { format: 'SAT', displayName: 'ACIS SAT', extensions: ['SAT'], mimeTypes: ['application/sat', 'text/plain'], category: 'SOLID_CAD', capabilityLevel: 0, uploadSupported: false, processingSupported: false, geometryParsingSupported: false, viewerSupported: false, metadataSupported: false, conversionRequired: true, limitations: ['No licensed/trusted ACIS parser is configured.'] },
  { format: 'DWG', displayName: 'AutoCAD DWG', extensions: ['DWG'], mimeTypes: ['image/vnd.dwg', 'application/acad'], category: 'SOLID_CAD', capabilityLevel: 0, uploadSupported: false, processingSupported: false, geometryParsingSupported: false, viewerSupported: false, metadataSupported: false, conversionRequired: true, limitations: ['No licensed/trusted DWG parser is configured.'] },
] as const satisfies readonly CadFormatCapability[];

export const UPLOAD_SUPPORTED_CAD_FORMATS = CAD_FORMAT_CAPABILITIES
  .filter((capability) => capability.uploadSupported)
  .flatMap((capability) => capability.extensions);

export type SupportedCadFormat = (typeof CAD_FORMAT_CAPABILITIES)[number]['format'];

export const getCadCapabilityByExtension = (extension: string): CadFormatCapability | undefined => {
  const normalized = extension.replace(/^\./, '').toUpperCase();
  return CAD_FORMAT_CAPABILITIES.find((capability) => capability.extensions.includes(normalized as never));
};
