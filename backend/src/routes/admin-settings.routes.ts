import { Router, Request, Response } from 'express';
import { requireSuperAdmin, requireAnyAdmin } from '../middleware/admin.middleware';
import { ApiResponseHelper } from '../utils/response';
import { sendSafeRouteError } from '../utils/errors';
import { AdminService } from '../services/admin.service';
import { Logger } from '../utils/logger';
import { Prisma } from '@prisma/client';

const router = Router();

// ============================================================================
// SYSTEM SETTINGS
// ============================================================================

// GET /api/v1/admin/settings - Get all settings
router.get('/', requireAnyAdmin, async (req: Request, res: Response) => {
  try {
    const settings = await AdminService.getSettingsSnapshot();
    ApiResponseHelper.success(res, settings, 'System settings retrieved');
  } catch (error: any) {
    sendSafeRouteError(res, error, { code: 'SETTINGS_ERROR', message: 'The request could not be completed.', status: 500 });
  }
});

// PUT /api/v1/admin/settings - Update settings (Super Admin only)
router.put('/', requireSuperAdmin, async (req: Request, res: Response) => {
  try {
    const { section, key, value, description } = req.body;

    if (!section || !key) {
      ApiResponseHelper.error(res, 'INVALID_INPUT', 'section and key are required', 400);
      return;
    }

    await AdminService.upsertSystemSetting({
      key,
      group: section,
      value: value as Prisma.InputJsonValue,
      description,
      updatedBy: req.auth?.email || req.auth?.id,
    });

    // Create audit log for settings change
    await AdminService.createAuditLog({
      userId: req.auth?.id,
      action: 'UPDATE',
      entityType: 'SETTINGS',
      entityId: `${section}.${key}`,
      oldValue: { section, key },
      newValue: { section, key, value },
    });

    ApiResponseHelper.success(res, { section, key, value }, 'Setting updated successfully');
  } catch (error: any) {
    sendSafeRouteError(res, error, { code: 'SETTINGS_UPDATE_ERROR', message: 'The request could not be completed.', status: 400 });
  }
});

// ============================================================================
// ADMIN ROUTE CONFIGURATION
// ============================================================================
// Protected: Only authenticated administrators can inspect the configured admin route.
router.get('/admin-url', requireAnyAdmin, async (_req: Request, res: Response) => {
  try {
    const adminUrl = await AdminService.getSystemSetting<string>('adminUrl');
    ApiResponseHelper.success(res, { adminUrl: adminUrl || '/admin' }, 'Admin URL retrieved');
  } catch (error) {
    Logger.warn(`[AdminSettings] admin-url lookup failed, using default: ${error instanceof Error ? error.message : String(error)}`);
    ApiResponseHelper.success(res, { adminUrl: '/admin' }, 'Admin URL retrieved');
  }
});

export default router;