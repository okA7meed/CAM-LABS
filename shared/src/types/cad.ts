export interface CadFile {
  id: string;
  userId?: string;
  name: string;
  format: 'STEP' | 'STP' | 'STL' | 'OBJ' | 'DXF' | 'IGES' | 'IGS';
  size: string;
  uploaded: string;
  volume: string;
  dimensions: string;
  meshTriangles: string;
  status: 'Analyzing' | 'Verified CAD' | 'DFM Flagged' | 'Quarantined' | 'Processing failed';
  minWallThickness?: string;
  surfaceArea?: string;
  latestVersion?: {
    version: number;
    scanStatus: string;
    processingStatus: string;
    dfmReport?: { status: string; summary: { findings?: string[] } } | null;
  } | null;
}

export interface GeometryAnalysisResult {
  fileName: string;
  fileSizeMb: number;
  format: string;
  volumeCm3: number;
  surfaceAreaCm2: number;
  dimensions: { x: number; y: number; z: number };
  minWallThicknessMm: number;
  dfmStatus: 'Pass' | 'Warning' | 'Critical';
  dfmWarnings: string[];
}
