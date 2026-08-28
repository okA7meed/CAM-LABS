import { Router, Request, Response } from 'express';
import { ApiResponseHelper } from '../utils/response';
import { getPrismaClient } from '../config/database';
import { Logger } from '../utils/logger';

const router = Router();

// GET /api/v1/materials
// Authoritative material catalog: served directly from PostgreSQL (materials table).
// No static/in-memory fallback — the database is the single source of truth.
router.get('/', async (_req: Request, res: Response) => {
  try {
    const prisma = getPrismaClient();
    const { technology, category, search } = _req.query;

    const where: { technology?: string; category?: string; OR?: Array<Record<string, unknown>> } = {};
    if (technology && typeof technology === 'string' && technology.trim()) {
      where.technology = technology.trim();
    }
    if (category && typeof category === 'string' && category.trim()) {
      where.category = category.trim();
    }
    if (search && typeof search === 'string') {
      const q = search.trim().toLowerCase();
      if (q) {
        where.OR = [
          { name: { contains: q, mode: 'insensitive' } },
          { description: { contains: q, mode: 'insensitive' } },
          { tags: { has: q } },
          { technology: { contains: q, mode: 'insensitive' } },
        ];
      }
    }

    const materials = await prisma.material.findMany({
      where,
      orderBy: { name: 'asc' },
    });

    ApiResponseHelper.success(res, materials, `${materials.length} materials returned`);
  } catch (err: any) {
    Logger.error(`[Materials] Catalog fetch failed: ${err.message}`);
    ApiResponseHelper.error(res, 'MATERIALS_FETCH_ERROR', err.message, 500);
  }
});

// GET /api/v1/materials/:id
router.get('/:id', async (req: Request, res: Response) => {
  try {
    const prisma = getPrismaClient();
    const material = await prisma.material.findUnique({ where: { id: req.params.id } });
    if (!material) {
      return ApiResponseHelper.error(res, 'MATERIAL_NOT_FOUND', `Material with ID '${req.params.id}' not found`, 404);
    }
    ApiResponseHelper.success(res, material);
  } catch (err: any) {
    Logger.error(`[Materials] Single material fetch failed: ${err.message}`);
    ApiResponseHelper.error(res, 'MATERIALS_FETCH_ERROR', err.message, 500);
  }
});

export default router;