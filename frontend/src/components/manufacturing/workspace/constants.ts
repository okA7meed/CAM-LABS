import { IconName } from '../../ui/Icon';
import { ProcessId, RequestState, TechnologyId } from './types';

export const initialState: RequestState = { cadFile: null, technology: null, process: null, material: null, quantity: 1, quality: 'standard', color: 'any', finish: 'standard', tolerance: 'standard', wallCount: 3, infillPercent: null, geometry: null };
export const processGroups = [
  { group: 'printing', options: ['fdm', 'sla', 'sls'] },
  { group: 'cnc', options: ['milling', 'turning'] },
  { group: 'sheetMetal', options: ['sheet'] },
  { group: 'injection', options: ['injection'] },
] as const;
export const MAX_UPLOAD_FILES = 20; export const MAX_UPLOAD_FILE_SIZE_BYTES = 500 * 1024 * 1024; export const MAX_UPLOAD_TOTAL_BYTES = 2 * 1024 * 1024 * 1024;
export const DRAFT_KEY = 'cw-manufacturing-draft-v1';
export const PRIORITY_SHIPPING_FEE_EGP = 100;
export const MAX_TECHNICAL_DOCUMENTS = 10; export const MAX_TECHNICAL_DOCUMENT_SIZE_BYTES = 10 * 1024 * 1024;
export const SUPPORTED_DOCUMENT_EXTENSIONS = ['pdf', 'doc', 'docx', 'txt', 'rtf', 'png', 'jpg', 'jpeg'];
export const INFILL_OPTIONS = [
  { id: 'hollow', title: '0% (Hollow)', description: 'Completely hollow interior', infillPercent: 0, wallCount: 2, layerHeightMm: 0.28 },
  { id: 'sparse', title: '10% (Sparse)', description: 'Minimal infill for decorative parts', infillPercent: 10, wallCount: 2, layerHeightMm: 0.24 },
  { id: 'standard', title: '15% (Standard)', description: 'Standard lightweight infill', infillPercent: 15, wallCount: 3, layerHeightMm: 0.2 },
  { id: 'high', title: '30% (Moderate)', description: 'Good balance of strength and weight', infillPercent: 30, wallCount: 4, layerHeightMm: 0.16 },
  { id: 'dense', title: '50% (Dense)', description: 'High-density infill', infillPercent: 50, wallCount: 4, layerHeightMm: 0.14 },
  { id: 'verydense', title: '75% (Very Dense)', description: '', infillPercent: 75, wallCount: 4, layerHeightMm: 0.12 },
  { id: 'premium', title: '100% (Solid)', description: 'Completely solid', infillPercent: 100, wallCount: 5, layerHeightMm: 0.1 },
  { id: 'heavyduty', title: 'Heavy Duty (5 walls)', description: 'Maximum wall durability', infillPercent: 100, wallCount: 5, layerHeightMm: 0.1 },
] as const;
export const WALL_OPTIONS = [{ walls: 1, title: '1' }, { walls: 2, title: '2' }, { walls: 3, title: '3' }, { walls: 4, title: '4' }, { walls: 5, title: '5' }] as const;

export const TECH_OPTIONS: Array<{ id: TechnologyId; label: string; desc: string; icon: IconName; badge?: string }> = [
  { id: 'printing', label: '3D Printing', desc: 'FDM / SLA / SLS', icon: 'technology' },
  { id: 'cnc', label: 'CNC Machining', desc: 'Milling / Turning', icon: 'cpu' },
  { id: 'sheet', label: 'Laser Cutting', desc: '2D / 3D', icon: 'file' },
  { id: 'injection', label: 'Injection Molding', desc: 'ABS / Nylon', icon: 'precision' },
];

export const PROCESS_INFO: Record<ProcessId, { title: string; desc: string; icon: IconName; badge?: string }> = {
  fdm: { title: 'FDM Printing', desc: 'Fused Deposition Modeling — versatile, fast, cost-effective for functional prototypes', icon: 'layers', badge: 'Most Popular' },
  sla: { title: 'SLA Printing', desc: 'Stereolithography — high detail, smooth surface finish for visual prototypes', icon: 'layers3' },
  sls: { title: 'SLS Printing', desc: 'Selective Laser Sintering — strong, durable parts without support structures', icon: 'layers' },
  milling: { title: 'CNC Milling', desc: 'Subtractive precision machining from solid billets', icon: 'cpu' },
  turning: { title: 'CNC Turning', desc: 'Precision turned parts on CNC lathes', icon: 'cpu' },
  sheet: { title: 'Sheet Cutting', desc: 'Laser or waterjet cutting of sheet materials', icon: 'file' },
  injection: { title: 'Injection Molding', desc: 'High-volume plastic production through precision molds', icon: 'precision', badge: 'Tooling' },
};

export const MATERIAL_SWATCHES: Record<string, string> = {
  pla: 'linear-gradient(135deg, #f5426c, #ff9f45)', abs: 'linear-gradient(135deg, #4f5b66, #aab5c0)',
  petg: 'linear-gradient(135deg, #00b4d8, #90e0ef)', tpu: 'linear-gradient(135deg, #333, #6b7280)',
  nylon: 'linear-gradient(135deg, #d4c29a, #8a7f5e)', aluminum: 'linear-gradient(135deg, #c0c8d0, #7d8590)',
  steel: 'linear-gradient(135deg, #9aa5b1, #475159)',
};

export const MATERIAL_PROPERTIES: Record<string, { icon: IconName; label: string }[]> = {
  pla: [
    { icon: 'layers', label: 'FDM printed' },
    { icon: 'globe', label: 'Biodegradable' },
  ],
  abs: [
    { icon: 'layers', label: 'FDM printed' },
    { icon: 'shieldCheck', label: 'Impact resistant' },
  ],
  petg: [
    { icon: 'layers', label: 'FDM printed' },
    { icon: 'globe', label: 'Water resistant' },
  ],
  tpu: [
    { icon: 'layers', label: 'FDM printed' },
    { icon: 'layers3', label: 'Flexible' },
  ],
  nylon: [
    { icon: 'layers', label: 'FDM printed' },
    { icon: 'shieldCheck', label: 'Abrasion resistant' },
  ],
  aluminum: [
    { icon: 'cpu', label: 'CNC machined' },
    { icon: 'shieldCheck', label: 'High strength' },
  ],
  steel: [
    { icon: 'cpu', label: 'CNC machined' },
    { icon: 'shieldCheck', label: 'Maximum strength' },
  ],
};

export const panelIds = {
  technology: 'mw-sec-tech', process: 'mw-sec-process', material: 'mw-sec-material',
  upload: 'mw-sec-upload', viewer: 'mw-sec-viewer', config: 'mw-sec-config', notes: 'mw-sec-notes', quote: 'mw-sec-quote',
} as const;