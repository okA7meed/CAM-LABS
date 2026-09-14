import { Router, Request, Response, NextFunction } from 'express';
import express from 'express';
import { ApiResponseHelper } from '../utils/response';
import { TechnicalDocumentsService } from '../services/technicalDocuments.service';
import { parseMultipartForm } from '../cad/multipart';
import { resolveCadOwner } from '../middleware/auth.middleware';
import { hasRole, ROLES } from '../auth/roles';

const router = Router();
const uploadBody = express.raw({ type: 'multipart/form-data', limit: '12mb' });

/** Rank >= SUPPORT_ADMIN (support, finance, pricing, operations, admin, super). */
const TECHNICAL_STAFF_ROLE = ROLES.SUPPORT_ADMIN;

const handle = (handler: (req: Request, res: Response) => Promise<void>) => (req: Request, res: Response, next: NextFunction) => {
  handler(req, res).catch(next);
};

const isStaff = (req: Request): boolean => {
  const user = req.auth;
  if (!user) return false;
  return hasRole(user.role, [TECHNICAL_STAFF_ROLE]);
};

router.get('/', resolveCadOwner, handle(async (req, res) => {
  const documents = await TechnicalDocumentsService.list(req.cadOwner!);
  ApiResponseHelper.success(res, documents, `${documents.length} technical documents returned`);
}));

router.get('/:id/download', resolveCadOwner, handle(async (req, res) => {
  const { document, stream } = await TechnicalDocumentsService.download(req.cadOwner!, req.params.id);
  if (document.userId && document.userId !== req.cadOwner!.userId && !isStaff(req)) {
    ApiResponseHelper.error(res, 'FORBIDDEN', 'You do not have permission to access this resource.', 403);
    return;
  }
  res.setHeader('Content-Type', document.mimeType);
  res.setHeader('Content-Length', document.byteSize);
  const inlinePreviewable = document.mimeType === 'application/pdf' || document.mimeType === 'image/png' || document.mimeType === 'image/jpeg';
  res.setHeader('Content-Disposition', `${inlinePreviewable ? 'inline' : 'attachment'}; filename="${document.name.replace(/"/g, '')}"`);
  res.setHeader('Cache-Control', 'private, no-store');
  res.setHeader('Vary', 'Cookie, Authorization');
  stream.pipe(res);
}));

router.post('/', resolveCadOwner, uploadBody, handle(async (req, res) => {
  const form = parseMultipartForm(req.headers['content-type'], req.body as Buffer);
  const document = await TechnicalDocumentsService.createUpload(req.cadOwner!, form.file);
  ApiResponseHelper.success(res, document, 'Technical document uploaded', 201);
}));

router.delete('/:id', resolveCadOwner, handle(async (req, res) => {
  ApiResponseHelper.success(res, await TechnicalDocumentsService.delete(req.cadOwner!, req.params.id), 'Technical document deleted');
}));

export default router;