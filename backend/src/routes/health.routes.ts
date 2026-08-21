import { Router, Request, Response } from 'express';
import { ApiResponseHelper } from '../utils/response';

const router = Router();

router.get('/', (_req: Request, res: Response) => {
  ApiResponseHelper.success(res, {
    status: 'operational',
    version: '1.0.0',
    platform: 'CAM LABS Manufacturing API',
    networkUptime: '99.8%',
    environment: process.env.NODE_ENV || 'development',
    timestamp: new Date().toISOString(),
  });
});

export default router;
