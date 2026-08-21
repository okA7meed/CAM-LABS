export type ManufacturingTechnology = 'SLS' | 'SLA' | 'FDM' | 'CNC' | 'DMLS' | 'Sheet Metal' | 'Injection Molding';

export type MaterialCategory = 'Polymers' | 'High-Performance' | 'Metals' | 'Resins' | 'Elastomers';

export interface Material {
  id: string;
  name: string;
  technology: ManufacturingTechnology;
  category: MaterialCategory;
  description: string;
  tensileStrength: number; // in MPa
  hdt: number; // in °C @ 0.45 MPa
  elongation: number; // in %
  density: number; // in g/cm³
  standardTolerance: string;
  minWallThickness: string;
  leadTime: string;
  surfaceFinish: string;
  tags: string[];
  colorOptions: string[];
  idealFor: string;
  isCertified?: boolean;
}
