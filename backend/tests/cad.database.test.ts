import { PrismaClient } from '@prisma/client';
import { randomUUID } from 'node:crypto';
import { readFile } from 'node:fs/promises';
import path from 'node:path';
import { beforeAll, afterAll, describe, expect, it } from 'vitest';
import { CadService } from '../src/services/cad.service';
import { hashPassword } from '../src/auth/password.service';

const databaseUrl = process.env.DATABASE_URL || '';
const enabled = databaseUrl.includes('/cam_labs_phase03_test');
const prisma = new PrismaClient();
const userId = `phase03-${randomUUID()}`;
const fixtureRoot = path.resolve(process.cwd(), '../test-fixtures');

const waitForJob = async (jobId: string): Promise<void> => {
  for (let attempt = 0; attempt < 1_200; attempt += 1) {
    const job = await prisma.cadProcessingJob.findUnique({ where: { id: jobId } });
    if (job?.status === 'COMPLETE' || job?.status === 'FAILED') return;
    await new Promise((resolve) => setTimeout(resolve, 100));
  }
  throw new Error(`CAD job ${jobId} did not finish within the test timeout.`);
};

describe.skipIf(!enabled)('Phase 03 CAD PostgreSQL integration', () => {
  beforeAll(async () => {
    await prisma.user.create({
      data: {
        id: userId,
        name: 'Phase 03 CAD Test User',
        email: `${userId}@example.com`,
        passwordHash: await hashPassword('ValidPass1'),
        role: 'CUSTOMER',
        accountStatus: 'ACTIVE',
      },
    });
  });

  afterAll(async () => {
    await prisma.user.delete({ where: { id: userId } });
    await prisma.$disconnect();
  });

  it('persists an owned version and completes a DFM job', async () => {
    const result = await CadService.createUpload(userId, {
      fieldName: 'file',
      originalName: 'bracket.stl',
      mimeType: 'model/stl',
      data: Buffer.alloc(134),
    });
    const version = await prisma.cadFileVersion.findUnique({ where: { id: result.version.id } });
    expect(version?.version).toBe(1);
    expect(version?.checksum).toHaveLength(64);

    for (let attempt = 0; attempt < 20; attempt += 1) {
      const job = await prisma.cadProcessingJob.findUnique({ where: { id: result.jobId } });
      if (job?.status === 'COMPLETE') break;
      await new Promise((resolve) => setTimeout(resolve, 25));
    }

    const report = await prisma.dfmReport.findUnique({ where: { versionId: result.version.id } });
    expect(report?.status).toBe('WARNING');
    expect(await CadService.list(userId)).toHaveLength(1);
    expect(await CadService.list('different-user')).toHaveLength(0);
    const download = await CadService.download(userId, result.id);
    const chunks: Buffer[] = [];
    for await (const chunk of download.stream as AsyncIterable<Buffer>) chunks.push(chunk);
    expect(Buffer.concat(chunks).byteLength).toBe(134);
    await expect(CadService.download('different-user', result.id)).rejects.toThrow('CAD file not found');
  });

  it('returns the existing version for an exact duplicate without creating storage or database records', async () => {
    const data = Buffer.from(`solid duplicate
facet normal 0 0 1
 outer loop
  vertex 0 0 0
  vertex 1 0 0
  vertex 0 1 0
 endloop
endfacet
endsolid duplicate`);
    const first = await CadService.createUpload(userId, { fieldName: 'file', originalName: 'duplicate.stl', mimeType: 'model/stl', data });
    const second = await CadService.createUpload(userId, { fieldName: 'file', originalName: 'duplicate.stl', mimeType: 'model/stl', data });

    expect(second).toMatchObject({ id: first.id, duplicate: true, latestVersion: { id: first.version.id, version: 1 } });
    expect(await prisma.cadFileVersion.count({ where: { cadFileId: first.id } })).toBe(1);
    expect(await prisma.cadProcessingJob.count({ where: { versionId: first.version.id } })).toBe(1);
  });

  it('serves processed geometry and viewer assets only to the owning user', async () => {
    const tetrahedron = Buffer.from(`solid tetrahedron
facet normal 0 0 -1
 outer loop
  vertex 0 0 0
  vertex 1 0 0
  vertex 0 1 0
 endloop
endfacet
facet normal 0 -1 0
 outer loop
  vertex 0 0 0
  vertex 0 0 1
  vertex 1 0 0
 endloop
endfacet
facet normal -1 0 0
 outer loop
  vertex 0 0 0
  vertex 0 1 0
  vertex 0 0 1
 endloop
endfacet
facet normal 1 1 1
 outer loop
  vertex 1 0 0
  vertex 0 0 1
  vertex 0 1 0
 endloop
endfacet
endsolid tetrahedron`);
    const result = await CadService.createUpload(userId, { fieldName: 'file', originalName: 'geometry.stl', mimeType: 'model/stl', data: tetrahedron });
    for (let attempt = 0; attempt < 20; attempt += 1) {
      const job = await prisma.cadProcessingJob.findUnique({ where: { id: result.jobId } });
      if (job?.status === 'COMPLETE') break;
      await new Promise((resolve) => setTimeout(resolve, 25));
    }
    const geometry = await CadService.geometry(userId, result.id);
    expect(geometry.metadata).toMatchObject({ geometryStatus: 'READY', triangleCount: 4, dimensions: { width: 1, height: 1, depth: 1 } });
    const asset = await CadService.viewerAsset(userId, result.id);
    const chunks: Buffer[] = [];
    for await (const chunk of asset.stream as AsyncIterable<Buffer>) chunks.push(chunk);
    expect(Buffer.concat(chunks).equals(tetrahedron)).toBe(true);
    await expect(CadService.geometry('different-user', result.id)).rejects.toThrow('CAD file not found');
    await expect(CadService.viewerAsset('different-user', result.id)).rejects.toThrow('CAD file not found');
  });

  it('deletes every owned CAD version and denies subsequent private access', async () => {
    const data = Buffer.from(`solid delete
facet normal 0 0 1
 outer loop
  vertex 0 0 0
  vertex 1 0 0
  vertex 0 1 0
 endloop
endfacet
endsolid delete`);
    const result = await CadService.createUpload(userId, { fieldName: 'file', originalName: 'delete-me.stl', mimeType: 'model/stl', data });

    for (let attempt = 0; attempt < 20; attempt += 1) {
      const job = await prisma.cadProcessingJob.findUnique({ where: { id: result.jobId! } });
      if (job?.status === 'COMPLETE' || job?.status === 'FAILED') break;
      await new Promise((resolve) => setTimeout(resolve, 25));
    }

    await expect(CadService.delete('different-user', result.id)).rejects.toThrow('CAD file not found');
    expect(await CadService.delete(userId, result.id)).toEqual({ id: result.id, deletedVersionCount: 1 });
    expect(await prisma.cadFile.findUnique({ where: { id: result.id } })).toBeNull();
    expect(await prisma.cadFileVersion.count({ where: { cadFileId: result.id } })).toBe(0);
    await expect(CadService.geometry(userId, result.id)).rejects.toThrow('CAD file not found');
    await expect(CadService.viewerAsset(userId, result.id)).rejects.toThrow('CAD file not found');
    await expect(CadService.download(userId, result.id)).rejects.toThrow('CAD file not found');
  });

  it('quarantines the antivirus test signature before metadata processing', async () => {
    const result = await CadService.createUpload(userId, {
      fieldName: 'file',
      originalName: 'infected.step',
      mimeType: 'application/step',
      data: Buffer.from('X5O!P%@AP[4\\PZX54(P^)7CC)7}$EICAR-STANDARD-ANTIVIRUS-TEST-FILE!$H+H*'),
    });

    for (let attempt = 0; attempt < 20; attempt += 1) {
      const job = await prisma.cadProcessingJob.findUnique({ where: { id: result.jobId } });
      if (job?.status === 'FAILED') break;
      await new Promise((resolve) => setTimeout(resolve, 25));
    }

    const version = await prisma.cadFileVersion.findUnique({ where: { id: result.version.id } });
    expect(version?.scanStatus).toBe('QUARANTINED');
    expect(version?.processingStatus).toBe('FAILED');
  });

  it.each(['STEP', 'STP', 'IGES', 'IGS'] as const)('fails closed for an invalid %s document', async (format) => {
    const result = await CadService.createUpload(userId, {
      fieldName: 'file',
      originalName: `invalid-${randomUUID()}.${format.toLowerCase()}`,
      mimeType: format === 'STEP' || format === 'STP' ? 'application/step' : 'application/iges',
      data: Buffer.from(`invalid ${format} document`),
    });

    for (let attempt = 0; attempt < 600; attempt += 1) {
      const job = await prisma.cadProcessingJob.findUnique({ where: { id: result.jobId } });
      if (job?.status === 'FAILED') break;
      await new Promise((resolve) => setTimeout(resolve, 100));
    }

    const version = await prisma.cadFileVersion.findUnique({ where: { id: result.version.id } });
    expect(version?.processingStatus).toBe('FAILED');
    expect(version?.viewerAssetKey).toBeNull();
    await expect(CadService.viewerAsset(userId, result.id)).rejects.toThrow('viewer asset is not available');
  }, 60_000);

  it.each([
    ['STEP', 'occt-linkrods.step', 'model/step'],
    ['STP', 'occt-screw.stp', 'model/step'],
    ['IGES', 'occt-hammer.iges', 'model/iges'],
    ['IGS', 'occt-hammer.igs', 'model/iges'],
  ] as const)('processes the real OCCT %s fixture through private GLB delivery', async (format, fixtureName, mimeType) => {
    const data = await readFile(path.join(fixtureRoot, fixtureName));
    const result = await CadService.createUpload(userId, {
      fieldName: 'file',
      originalName: fixtureName,
      mimeType,
      data,
    });
    await waitForJob(result.jobId!);

    const version = await prisma.cadFileVersion.findUniqueOrThrow({ where: { id: result.version.id } });
    const metadata = version.metadata as Record<string, any>;
    expect(version.processingStatus).toBe('COMPLETE');
    expect(version.scanStatus).toBe('CLEAN');
    expect(version.dimensions).toContain(' × ');
    expect(version.volume).toBeDefined();
    expect(version.meshTriangles).toBe(String(metadata.triangleCount));
    expect(version.detectedUnit).toBe(metadata.detectedUnit);
    const persistedJob = await prisma.cadProcessingJob.findUniqueOrThrow({ where: { id: result.jobId! } });
    expect(persistedJob.status).toBe('COMPLETE');
    expect(persistedJob.finishedAt).not.toBeNull();
    expect(version.viewerAssetKey).toMatch(/^viewer\/.+\.glb$/);
    expect(version.viewerAssetSize).toBeGreaterThan(20);
    expect(version.processingDuration).toBeGreaterThanOrEqual(0);
    expect(metadata).toMatchObject({
      format,
      supportLevel: 'FULLY_SUPPORTED',
      geometryStatus: 'READY',
      geometryKind: 'SOLID',
      conversionStatus: 'READY',
      viewerAsset: { available: true, format: 'GLB' },
    });
    expect(metadata.faceCount).toBeGreaterThan(0);
    expect(metadata.edgeCount).toBeGreaterThan(0);
    expect(metadata.vertexCount).toBeGreaterThan(0);
    expect(metadata.triangleCount).toBeGreaterThan(0);
    expect(metadata.dimensions.width).toBeGreaterThan(0);
    expect(metadata.dimensions.height).toBeGreaterThan(0);
    expect(metadata.dimensions.depth).toBeGreaterThan(0);

    const viewer = await CadService.viewerAsset(userId, result.id);
    const chunks: Buffer[] = [];
    for await (const chunk of viewer.stream as AsyncIterable<Buffer>) chunks.push(chunk);
    const glb = Buffer.concat(chunks);
    expect(viewer.isViewerAsset).toBe(true);
    expect(glb.subarray(0, 4).toString('ascii')).toBe('glTF');
    expect(glb.readUInt32LE(4)).toBe(2);
    expect(glb.readUInt32LE(8)).toBe(glb.byteLength);
    expect(glb.byteLength).toBe(version.viewerAssetSize);
    await expect(CadService.viewerAsset('different-user', result.id)).rejects.toThrow('CAD file not found');
  }, 120_000);
});