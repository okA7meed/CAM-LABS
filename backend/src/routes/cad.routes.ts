import { Router, Request, Response, NextFunction } from 'express';
import express from 'express';
import { ApiResponseHelper } from '../utils/response';
import { CadValidationService } from '../services/cadValidation.service';
import { CadService } from '../services/cad.service';
import { parseMultipartForm } from '../cad/multipart';
import { resolveCadOwner } from '../middleware/auth.middleware';

const router = Router();
const uploadBody = express.raw({ type: 'multipart/form-data', limit: '160mb' });

const handle = (handler: (req: Request, res: Response) => Promise<void>) => (req: Request, res: Response, next: NextFunction) => {
  handler(req, res).catch(next);
};

router.get('/', resolveCadOwner, handle(async (req, res) => {
  const files = await CadService.list(req.cadOwner!);
  ApiResponseHelper.success(res, files, `${files.length} CAD files returned`);
}));

router.get('/:id', resolveCadOwner, handle(async (req, res) => {
  ApiResponseHelper.success(res, await CadService.get(req.cadOwner!, req.params.id), 'CAD file returned');
}));

router.get('/:id/dfm-report', resolveCadOwner, handle(async (req, res) => {
  const report = await CadService.report(req.cadOwner!, req.params.id);
  if (!report) {
    ApiResponseHelper.error(res, 'REPORT_NOT_READY', 'The DFM report is not ready yet.', 409);
    return;
  }
  ApiResponseHelper.success(res, report, 'DFM report returned');
}));

router.get('/:id/download', resolveCadOwner, handle(async (req, res) => {
  const { version, stream } = await CadService.download(req.cadOwner!, req.params.id);
  res.setHeader('Content-Type', version.mimeType);
  res.setHeader('Content-Length', version.byteSize);
  res.setHeader('Content-Disposition', `attachment; filename="${version.originalName.replace(/"/g, '')}"`);
  stream.pipe(res);
}));

router.get('/:id/geometry', resolveCadOwner, handle(async (req, res) => {
  const versionId = typeof req.query.versionId === 'string' ? req.query.versionId : undefined;
  ApiResponseHelper.success(res, await CadService.geometry(req.cadOwner!, req.params.id, versionId), 'CAD geometry metadata returned');
}));

router.get('/:id/viewer-asset', resolveCadOwner, handle(async (req, res) => {
  const versionId = typeof req.query.versionId === 'string' ? req.query.versionId : undefined;
  const { version, stream } = await CadService.viewerAsset(req.cadOwner!, req.params.id, versionId);
  res.setHeader('Content-Type', version.viewerAssetKey ? 'model/gltf-binary' : version.mimeType);
  res.setHeader('Content-Length', version.viewerAssetKey ? (version.viewerAssetSize || 0) : version.byteSize);
  res.setHeader('Cache-Control', 'private, no-store');
  res.setHeader('Vary', 'Cookie, Authorization');
  stream.pipe(res);
}));

router.post('/:id/retry-processing', resolveCadOwner, handle(async (req, res) => {
  ApiResponseHelper.success(res, await CadService.retryProcessing(req.cadOwner!, req.params.id), 'CAD geometry processing retry requested', 202);
}));

router.delete('/:id', resolveCadOwner, handle(async (req, res) => {
  ApiResponseHelper.success(res, await CadService.delete(req.cadOwner!, req.params.id), 'CAD file deleted');
}));

router.post('/validate', (req: Request, res: Response) => {
  const { fileName, sizeBytes } = req.body;
  if (!fileName) {
    ApiResponseHelper.error(res, 'INVALID_INPUT', 'fileName is required for validation', 400);
    return;
  }
  ApiResponseHelper.success(res, CadValidationService.validateFile(fileName, sizeBytes), 'CAD pre-flight validation completed');
});

router.post('/', resolveCadOwner, uploadBody, handle(async (req, res) => {
  const form = parseMultipartForm(req.headers['content-type'], req.body as Buffer);
  const result = await CadService.createUpload(req.cadOwner!, form.file);
  ApiResponseHelper.success(res, result, result.duplicate ? 'Existing CAD version returned' : 'CAD file accepted for secure processing', result.duplicate ? 200 : 202);
}));

export default router;
