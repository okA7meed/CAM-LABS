import { Router, Request, Response } from 'express';
import { ApiResponseHelper } from '../utils/response';

const router = Router();

// In-memory materials store (mirrors frontend MATERIALS_DATA until PostgreSQL is running)
const MATERIALS_STORE = [
  { id: 'pa12-sls', name: 'PA 12 (Nylon 12)', technology: 'SLS', category: 'Polymers', tensileStrength: 48, hdt: 175, leadTime: '24 - 48 Hours' },
  { id: 'pa11-sls', name: 'PA 11 (Bio-based Nylon)', technology: 'SLS', category: 'Polymers', tensileStrength: 52, hdt: 182, leadTime: '2 - 3 Days' },
  { id: 'peek-fdm', name: 'PEEK (Polyetheretherketone)', technology: 'FDM', category: 'High-Performance', tensileStrength: 100, hdt: 250, leadTime: '3 - 5 Days' },
  { id: 'ultem-9085-fdm', name: 'ULTEM™ 9085 (PEI Resin)', technology: 'FDM', category: 'High-Performance', tensileStrength: 68, hdt: 153, leadTime: '2 - 4 Days' },
  { id: 'sla-tough-resin', name: 'Tough ABS-Like 100', technology: 'SLA', category: 'Resins', tensileStrength: 55, hdt: 68, leadTime: '24 - 48 Hours' },
  { id: 'sla-high-temp', name: 'High-Temp Ceramic Resin', technology: 'SLA', category: 'Resins', tensileStrength: 75, hdt: 238, leadTime: '2 - 3 Days' },
  { id: 'alu-6061-cnc', name: 'Aluminum 6061-T6', technology: 'CNC', category: 'Metals', tensileStrength: 310, hdt: 300, leadTime: '3 - 5 Days' },
  { id: 'ss-316l-cnc', name: 'Stainless Steel 316L', technology: 'CNC', category: 'Metals', tensileStrength: 580, hdt: 550, leadTime: '4 - 7 Days' },
  { id: 'ti-6al4v-dmls', name: 'Titanium Ti-6Al-4V (Grade 5)', technology: 'DMLS', category: 'Metals', tensileStrength: 1050, hdt: 800, leadTime: '5 - 8 Days' },
  { id: 'tpu-95a-fdm', name: 'TPU 95A Elastomer', technology: 'FDM', category: 'Elastomers', tensileStrength: 39, hdt: 60, leadTime: '24 - 48 Hours' },
  { id: 'sheet-alu-5052', name: 'Aluminum 5052-H32 Sheet', technology: 'Sheet Metal', category: 'Metals', tensileStrength: 228, hdt: 200, leadTime: '2 - 4 Days' },
];

// GET /api/v1/materials
router.get('/', (req: Request, res: Response) => {
  let results = [...MATERIALS_STORE];

  const { technology, category, search } = req.query;

  if (technology && typeof technology === 'string') {
    results = results.filter((m) => m.technology.toLowerCase() === technology.toLowerCase());
  }

  if (category && typeof category === 'string') {
    results = results.filter((m) => m.category.toLowerCase() === category.toLowerCase());
  }

  if (search && typeof search === 'string') {
    const q = search.toLowerCase();
    results = results.filter((m) => m.name.toLowerCase().includes(q) || m.technology.toLowerCase().includes(q));
  }

  ApiResponseHelper.success(res, results, `${results.length} materials returned`);
});

// GET /api/v1/materials/:id
router.get('/:id', (req: Request, res: Response) => {
  const material = MATERIALS_STORE.find((m) => m.id === req.params.id);
  if (!material) {
    return ApiResponseHelper.error(res, 'MATERIAL_NOT_FOUND', `Material with ID '${req.params.id}' not found`, 404);
  }
  ApiResponseHelper.success(res, material);
});

export default router;
