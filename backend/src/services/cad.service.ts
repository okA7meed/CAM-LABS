import { Prisma } from '@prisma/client';
import { randomUUID } from 'node:crypto';
import path from 'node:path';
import { getPrismaClient } from '../config/database';
import { ENV } from '../config/env';
import { AppError, NotFoundError } from '../utils/errors';
import { BasicCadMetadataExtractor, calculateChecksum, createFileScanner, getCadFormat, isCadMimeTypeCompatible } from '../cad/file-processing';
import { MultipartFile } from '../cad/multipart';
import { createObjectStorage, ObjectStorage } from '../cad/object-storage';
import { processSolidCad } from '../cad/solid-cad-processor';

const prisma = getPrismaClient();
const storage: ObjectStorage = createObjectStorage();
const extractor = new BasicCadMetadataExtractor();
const isSolidCad = (format: string): format is 'STEP' | 'STP' | 'IGES' | 'IGS' => ['STEP', 'STP', 'IGES', 'IGS'].includes(format);
type CadOwner = { userId?: string; guestId?: string };
const ownerWhere = (owner: CadOwner) => owner.userId ? { userId: owner.userId } : { userId: null, guestId: owner.guestId };
const ownerStorageKey = (owner: CadOwner) => owner.userId || `guest/${owner.guestId}`;

const formatSize = (size: number): string => `${(size / (1024 * 1024)).toFixed(2)} MB`;
const safeName = (name: string): string => path.basename(name.replaceAll('\\', '/')).replace(/[\u0000-\u001f]/g, '').trim();

const publicVersion = (version: Prisma.CadFileVersionGetPayload<{ include: { dfmReport: true; jobs: true } }>) => ({
  id: version.id,
  version: version.version,
  originalName: version.originalName,
  format: version.format,
  mimeType: version.mimeType,
  byteSize: version.byteSize,
  checksum: version.checksum,
  uploadStatus: version.uploadStatus,
  scanStatus: version.scanStatus,
  processingStatus: version.processingStatus,
  conversionStatus: (version.metadata as { conversionStatus?: string } | null)?.conversionStatus || null,
  metadata: version.metadata,
  dimensions: version.dimensions,
  volume: version.volume,
  meshTriangles: version.meshTriangles,
  viewerAsset: version.viewerAssetKey ? { available: true, size: version.viewerAssetSize, format: 'GLB' } : null,
  processingDuration: version.processingDuration,
  detectedUnit: version.detectedUnit,
  failureCode: version.failureCode,
  failureMessage: version.failureMessage,
  createdAt: version.createdAt,
  updatedAt: version.updatedAt,
  dfmReport: version.dfmReport,
  jobs: version.jobs.map((job) => ({ id: job.id, operation: job.operation, status: job.status, attempts: job.attempts, lastError: job.status === 'FAILED' ? 'CAD processing failed.' : null })),
});

const versionInclude = { dfmReport: true, jobs: true } as const;

export class CadService {
  static async createUpload(owner: CadOwner, file: MultipartFile) {
    const originalName = safeName(file.originalName);
    if (!originalName) throw new AppError('A valid filename is required.', 400, 'INVALID_UPLOAD');
    if (file.data.byteLength < 1) {
      throw new AppError('CAD files must not be empty.', 400, 'CAD_FILE_EMPTY');
    }
    if (file.data.byteLength > ENV.CAD_MAX_FILE_SIZE_BYTES) {
      throw new AppError(`CAD files must not exceed ${formatSize(ENV.CAD_MAX_FILE_SIZE_BYTES)}.`, 400, 'CAD_FILE_TOO_LARGE');
    }

    const format = getCadFormat(originalName);
    if (!isCadMimeTypeCompatible(format, file.mimeType)) {
      throw new AppError(`The declared MIME type does not match the .${format.toLowerCase()} file extension.`, 400, 'CAD_MIME_TYPE_MISMATCH');
    }
    const checksum = calculateChecksum(file.data);
    const existingFile = await prisma.cadFile.findFirst({
      where: { ...ownerWhere(owner), name: originalName },
      include: { versions: { where: { checksum }, orderBy: { version: 'desc' }, take: 1, include: versionInclude } },
    });
    const existingVersion = existingFile?.versions[0];
    if (existingFile && existingVersion) {
      const version = publicVersion(existingVersion);
      return {
        ...this.toCadFile(existingFile),
        version,
        latestVersion: version,
        jobId: existingVersion.jobs[0]?.id || null,
        duplicate: true as const,
      };
    }
    const storageKey = `${ownerStorageKey(owner)}/${randomUUID()}.${format.toLowerCase()}`;
    await storage.put(storageKey, file.data, file.mimeType);

    try {
      const result = await prisma.$transaction(async (tx) => {
        const existing = await tx.cadFile.findFirst({ where: { ...ownerWhere(owner), name: originalName }, orderBy: { updatedAt: 'desc' } });
        const cadFile = existing || await tx.cadFile.create({
          data: {
            userId: owner.userId,
            guestId: owner.guestId,
            name: originalName,
            format,
            size: formatSize(file.data.byteLength),
            uploaded: new Date().toISOString().slice(0, 10),
            volume: 'Pending analysis',
            dimensions: 'Pending analysis',
            meshTriangles: 'Pending analysis',
            status: 'Analyzing',
          },
        });
        const latest = await tx.cadFileVersion.findFirst({ where: { cadFileId: cadFile.id }, orderBy: { version: 'desc' } });
        const version = await tx.cadFileVersion.create({
          data: {
            cadFileId: cadFile.id,
            version: (latest?.version || 0) + 1,
            originalName,
            format,
            mimeType: file.mimeType,
            byteSize: file.data.byteLength,
            checksum,
            storageKey,
          },
          include: versionInclude,
        });
        const job = await tx.cadProcessingJob.create({
          data: { versionId: version.id, operation: 'CAD_ANALYSIS' },
        });
        return { cadFile, version, job };
      });

      void this.processJob(result.job.id);
      const version = publicVersion(result.version);
      return { ...this.toCadFile(result.cadFile), version, latestVersion: version, jobId: result.job.id, duplicate: false as const };
    } catch (error) {
      await storage.remove(storageKey);
      if (error instanceof Prisma.PrismaClientKnownRequestError && error.code === 'P2002') {
        const duplicateFile = await prisma.cadFile.findFirst({
          where: { ...ownerWhere(owner), name: originalName },
          include: { versions: { where: { checksum }, orderBy: { version: 'desc' }, take: 1, include: versionInclude } },
        });
        const duplicateVersion = duplicateFile?.versions[0];
        if (duplicateFile && duplicateVersion) {
          const version = publicVersion(duplicateVersion);
          return { ...this.toCadFile(duplicateFile), version, latestVersion: version, jobId: duplicateVersion.jobs[0]?.id || null, duplicate: true as const };
        }
        throw new AppError('This CAD version has already been uploaded.', 409, 'CAD_VERSION_EXISTS');
      }
      throw error;
    }
  }

  static async list(owner: CadOwner) {
    const files = await prisma.cadFile.findMany({
      where: ownerWhere(owner),
      orderBy: { updatedAt: 'desc' },
      include: { versions: { orderBy: { version: 'desc' }, take: 1, include: versionInclude } },
    });
    return files.map((file) => ({ ...this.toCadFile(file), latestVersion: file.versions[0] ? publicVersion(file.versions[0]) : null }));
  }

  static async get(owner: CadOwner, id: string) {
    const file = await prisma.cadFile.findFirst({ where: { id, ...ownerWhere(owner) }, include: { versions: { orderBy: { version: 'desc' }, include: versionInclude } } });
    if (!file) throw new NotFoundError('CAD file');
    return { ...this.toCadFile(file), versions: file.versions.map(publicVersion) };
  }

  static async report(owner: CadOwner, id: string) {
    const file = await prisma.cadFile.findFirst({ where: { id, ...ownerWhere(owner) }, include: { versions: { orderBy: { version: 'desc' }, take: 1, include: { dfmReport: true } } } });
    if (!file) throw new NotFoundError('CAD file');
    return file.versions[0]?.dfmReport || null;
  }

  static async download(owner: CadOwner, id: string) {
    const file = await prisma.cadFile.findFirst({ where: { id, ...ownerWhere(owner) }, include: { versions: { orderBy: { version: 'desc' }, take: 1 } } });
    const version = file?.versions[0];
    if (!version) throw new NotFoundError('CAD file');
    const key = version.viewerAssetKey || version.storageKey;
    return { version, stream: storage.stream(key), isViewerAsset: Boolean(version.viewerAssetKey) };
  }

  static async geometry(owner: CadOwner, id: string, versionId?: string) {
    const file = await prisma.cadFile.findFirst({ where: { id, ...ownerWhere(owner) }, include: { versions: { where: versionId ? { id: versionId } : undefined, orderBy: { version: 'desc' }, take: 1, include: versionInclude } } });
    const version = file?.versions[0];
    if (!file || !version) throw new NotFoundError('CAD file');
    return { fileId: file.id, version: version.version, format: version.format, status: version.processingStatus, scanStatus: version.scanStatus, metadata: version.metadata, dimensions: version.dimensions, volume: version.volume, meshTriangles: version.meshTriangles, jobs: version.jobs.map((job) => ({ operation: job.operation, status: job.status, lastError: job.status === 'FAILED' ? 'CAD processing failed.' : null })) };
  }

  static async viewerAsset(owner: CadOwner, id: string, versionId?: string) {
    const file = await prisma.cadFile.findFirst({ where: { id, ...ownerWhere(owner) }, include: { versions: { where: versionId ? { id: versionId } : undefined, orderBy: { version: 'desc' }, take: 1 } } });
    const version = file?.versions[0];
    const metadata = version?.metadata as { geometryStatus?: string; viewerAsset?: { available?: boolean } } | null;
    if (!file || !version) throw new NotFoundError('CAD file');
    if (version.processingStatus !== 'COMPLETE' || metadata?.geometryStatus !== 'READY' || !metadata.viewerAsset?.available) {
      throw new AppError('A browser viewer asset is not available for this CAD version.', 409, 'VIEWER_ASSET_NOT_READY');
    }
    return { version, stream: storage.stream(version.viewerAssetKey || version.storageKey), isViewerAsset: Boolean(version.viewerAssetKey) };
  }

  static async retryProcessing(owner: CadOwner, id: string) {
    const file = await prisma.cadFile.findFirst({ where: { id, ...ownerWhere(owner) }, include: { versions: { orderBy: { version: 'desc' }, take: 1 } } });
    const version = file?.versions[0];
    if (!version) throw new NotFoundError('CAD file');
    const job = await prisma.cadProcessingJob.create({ data: { versionId: version.id, operation: 'CAD_ANALYSIS_RETRY' } });
    void this.processJob(job.id);
    return { jobId: job.id, status: 'PENDING' };
  }

  static async delete(owner: CadOwner, id: string) {
    const file = await prisma.cadFile.findFirst({ where: { id, ...ownerWhere(owner) }, include: { versions: { include: { jobs: true } } } });
    if (!file) throw new NotFoundError('CAD file');
    if (file.versions.some((version) => version.jobs.some((job) => job.status === 'PENDING' || job.status === 'PROCESSING'))) {
      throw new AppError('CAD processing must finish before this file can be deleted.', 409, 'CAD_PROCESSING_ACTIVE');
    }
    await prisma.cadFile.delete({ where: { id: file.id } });
    await Promise.all(file.versions.flatMap((version) => [storage.remove(version.storageKey), ...(version.viewerAssetKey ? [storage.remove(version.viewerAssetKey)] : [])]));
    return { id: file.id, deletedVersionCount: file.versions.length };
  }

  static async processJob(jobId: string): Promise<void> {
    const claimed = await prisma.cadProcessingJob.updateMany({
      where: { id: jobId, status: 'PENDING', availableAt: { lte: new Date() } },
      data: { status: 'PROCESSING', startedAt: new Date(), attempts: { increment: 1 } },
    });
    if (claimed.count === 0) return;

    const job = await prisma.cadProcessingJob.findUnique({ where: { id: jobId }, include: { version: true } });
    if (!job) return;
    try {
      const data = await storage.read(job.version.storageKey);
      const scanner = createFileScanner();
      const verdict = await scanner.scan(data);
      if (verdict.status === 'QUARANTINED') {
        await prisma.$transaction([
          prisma.cadFileVersion.update({ where: { id: job.versionId }, data: { scanStatus: 'QUARANTINED', processingStatus: 'FAILED', failureCode: 'MALWARE_DETECTED', failureMessage: 'The upload was quarantined by the antivirus scanner.' } }),
          prisma.cadProcessingJob.update({ where: { id: job.id }, data: { status: 'FAILED', finishedAt: new Date(), lastError: verdict.reason } }),
          prisma.dfmReport.upsert({ where: { versionId: job.versionId }, update: { status: 'CRITICAL', summary: { findings: [verdict.reason || 'File quarantined'] } }, create: { versionId: job.versionId, status: 'CRITICAL', summary: { findings: [verdict.reason || 'File quarantined'] } } }),
        ]);
        return;
      }

      const format = getCadFormat(job.version.originalName);
      const startedAt = job.startedAt?.getTime() || Date.now();
      if (isSolidCad(format)) {
        const result = await processSolidCad(format, data);
        const viewerAssetKey = `viewer/${job.version.storageKey}.glb`;
        await storage.put(viewerAssetKey, result.glb, 'model/gltf-binary');
        await prisma.$transaction([
          prisma.cadFileVersion.update({ where: { id: job.versionId }, data: { scanStatus: 'CLEAN', processingStatus: 'COMPLETE', metadata: { ...result.metadata, conversionStatus: 'READY', processingDuration: Date.now() - startedAt } as Prisma.InputJsonValue, dimensions: result.dimensions, volume: result.volume, meshTriangles: result.meshTriangles, viewerAssetKey, viewerAssetSize: result.glb.byteLength, processingDuration: Date.now() - startedAt, detectedUnit: result.detectedUnit, failureCode: null, failureMessage: null } }),
          prisma.cadFile.update({ where: { id: job.version.cadFileId }, data: { status: 'Verified CAD', dimensions: result.dimensions, volume: result.volume || 'Unavailable', meshTriangles: result.meshTriangles, updatedAt: new Date() } }),
          prisma.cadProcessingJob.update({ where: { id: job.id }, data: { status: 'COMPLETE', finishedAt: new Date(), lastError: null } }),
          prisma.dfmReport.upsert({ where: { versionId: job.versionId }, update: { status: 'PASS', summary: { findings: [], metadata: result.metadata } as Prisma.InputJsonValue }, create: { versionId: job.versionId, status: 'PASS', summary: { findings: [], metadata: result.metadata } as Prisma.InputJsonValue } }),
        ]);
        return;
      }
      const metadata = extractor.extract(format, data);
      const failedValidation = metadata.metadata.supportLevel === 'FAILED_VALIDATION';
      await prisma.$transaction([
        prisma.cadFileVersion.update({ where: { id: job.versionId }, data: { scanStatus: 'CLEAN', processingStatus: failedValidation ? 'FAILED' : 'COMPLETE', metadata: metadata.metadata as Prisma.InputJsonValue, dimensions: metadata.dimensions, volume: metadata.volume, meshTriangles: metadata.meshTriangles } }),
        prisma.cadFile.update({ where: { id: job.version.cadFileId }, data: { status: metadata.dfmStatus === 'PASS' ? 'Verified CAD' : 'DFM Flagged', dimensions: metadata.dimensions || 'Unavailable', volume: metadata.volume || 'Unavailable', meshTriangles: metadata.meshTriangles || 'Unavailable', updatedAt: new Date() } }),
        prisma.cadProcessingJob.update({ where: { id: job.id }, data: { status: failedValidation ? 'FAILED' : 'COMPLETE', finishedAt: new Date(), lastError: failedValidation ? metadata.findings.join(' ') : null } }),
        prisma.dfmReport.upsert({ where: { versionId: job.versionId }, update: { status: metadata.dfmStatus, summary: { findings: metadata.findings, metadata: metadata.metadata } as Prisma.InputJsonValue }, create: { versionId: job.versionId, status: metadata.dfmStatus, summary: { findings: metadata.findings, metadata: metadata.metadata } as Prisma.InputJsonValue } }),
      ]);
    } catch (error) {
      const message = error instanceof Error ? error.message : 'CAD processing failed.';
      const solidFailure = isSolidCad(job.version.format);
      const failureCode = message.startsWith('CAD_') ? message : 'CAD_PROCESSING_FAILED';
      const safeMessage = solidFailure ? 'The CAD model could not be converted into a browser viewer asset.' : message;
      const shouldFail = solidFailure || job.attempts >= job.maxAttempts;
      await prisma.cadProcessingJob.update({ where: { id: job.id }, data: { status: shouldFail ? 'FAILED' : 'PENDING', lastError: message, finishedAt: shouldFail ? new Date() : null, availableAt: new Date(Date.now() + 1000) } });
      await prisma.cadFileVersion.update({ where: { id: job.versionId }, data: { scanStatus: shouldFail ? 'FAILED' : 'PENDING', processingStatus: shouldFail ? 'FAILED' : 'PENDING', failureCode: shouldFail ? failureCode : null, failureMessage: shouldFail ? safeMessage : null } });
    }
  }

  private static toCadFile(file: { id: string; userId: string | null; name: string; format: string; size: string; uploaded: string; volume: string; dimensions: string; meshTriangles: string; status: string; createdAt: Date; updatedAt: Date }) {
    return { id: file.id, userId: file.userId || undefined, name: file.name, format: file.format, size: file.size, uploaded: file.uploaded, volume: file.volume, dimensions: file.dimensions, meshTriangles: file.meshTriangles, status: file.status, createdAt: file.createdAt, updatedAt: file.updatedAt };
  }
}