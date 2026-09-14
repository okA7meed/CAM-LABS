/**
 * TechnicalDocumentsService — validation & security unit tests.
 *
 * Covers the backend-authoritative technical document rules:
 *  - Extension + declared-MIME allowlists
 *  - Magic-byte content sniffing (PDF / PNG / JPEG / RTF / DOC / DOCX / TXT)
 *  - Rejection of executables, archives, SVG, and disguised binary payloads
 *  - Per-owner document count limit and binary-safe dedupe
 *  - Attach-to-quote ownership checks
 */
import { describe, expect, it, vi, beforeEach } from 'vitest';
import { AppError } from '../src/utils/errors';

const state = vi.hoisted(() => ({
  technicalDocument: {
    count: vi.fn(async () => 0),
    findFirst: vi.fn(async () => null),
    create: vi.fn(async (args: any) => ({
      id: 'doc-1',
      name: args.data.name,
      mimeType: args.data.mimeType,
      byteSize: args.data.byteSize,
      checksum: args.data.checksum,
      storageKey: args.data.storageKey,
      scanStatus: args.data.scanStatus,
      userId: args.data.userId ?? null,
      guestId: args.data.guestId ?? null,
      quoteId: null,
      orderId: null,
      createdAt: new Date(),
    })),
    findMany: vi.fn(async () => []),
    updateMany: vi.fn(async () => ({ count: 1 })),
    delete: vi.fn(async () => ({})),
  },
  storageKey: '',
  storagePut: vi.fn(async (_key: string, _data: Buffer, _mime: string) => ({ key: _key, size: _data.byteLength, contentType: _mime })),
  storageRemove: vi.fn(async () => undefined),
}));

vi.mock('../src/config/database', () => ({
  getPrismaClient: () => ({ technicalDocument: state.technicalDocument }),
}));

vi.mock('../src/cad/object-storage', () => ({
  createObjectStorage: () => ({
    put: state.storagePut,
    read: vi.fn(async () => Buffer.alloc(0)),
    stream: vi.fn(() => ({ pipe: () => undefined })),
    remove: state.storageRemove,
  }),
}));

import { TechnicalDocumentsService, TECHNICAL_DOCUMENT_FORMATS } from '../src/services/technicalDocuments.service';

const fileFor = (name: string, data: Buffer, mimeType = '') => ({ fieldName: 'file', originalName: name, mimeType, data });

const PDF = Buffer.from('%PDF-1.4\n%\xe2\xe3\xcf\xd3\n1 0 obj<<>>endobj\n');
const OLE = Buffer.from([0xd0, 0xcf, 0x11, 0xe0, 0xa1, 0xb1, 0x1a, 0xe1, 0x00, 0x00, 0x00, 0x00]);
const ZIP_DOCX = Buffer.from([0x50, 0x4b, 0x03, 0x04, 0x14, 0x00, 0x00, 0x00, 0x00]);
const PNG = Buffer.concat([Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]), Buffer.from('IHDR')]);
const JPEG = Buffer.from([0xff, 0xd8, 0xff, 0xe0, 0x00, 0x10]);
const RTF = Buffer.from('{\\rtf1\\ansi hello}');
const TXT = Buffer.from('Fully printable plain surface finish instruction.\n');

describe('technical document format registry', () => {
  it('exposes exactly the supported extensions', () => {
    expect(Object.keys(TECHNICAL_DOCUMENT_FORMATS).sort()).toEqual(['doc', 'docx', 'jpeg', 'jpg', 'pdf', 'png', 'rtf', 'txt']);
  });

  it('rejects every disallowed extension', () => {
    for (const ext of ['exe', 'dll', 'bat', 'cmd', 'sh', 'js', 'html', 'svg', 'zip', 'rar', '7z', 'bin']) {
      expect(TECHNICAL_DOCUMENT_FORMATS[ext]).toBeUndefined();
    }
  });
});

describe('TechnicalDocumentsService.createUpload', () => {
  beforeEach(() => {
    state.technicalDocument.count.mockResolvedValue(0);
    state.technicalDocument.findFirst.mockResolvedValue(null);
  });

  it('rejects an empty document', async () => {
    await expect(TechnicalDocumentsService.createUpload({ guestId: 'g-1' }, fileFor('empty.pdf', Buffer.alloc(0))))
      .rejects.toMatchObject({ code: 'TECHNICAL_DOCUMENT_EMPTY' });
  });

  it('rejects a document exceeding the size limit', async () => {
    const big = Buffer.concat([Buffer.from('%PDF-1.4'), Buffer.alloc(11 * 1024 * 1024)]);
    await expect(TechnicalDocumentsService.createUpload({ guestId: 'g-1' }, fileFor('giant.pdf', big, 'application/pdf')))
      .rejects.toMatchObject({ code: 'TECHNICAL_DOCUMENT_TOO_LARGE' });
  });

  it('rejects an unsupported extension (executable hostname + bytes do not matter)', async () => {
    const exe = Buffer.concat([Buffer.from('MZ'), Buffer.alloc(128)]);
    await expect(TechnicalDocumentsService.createUpload({ guestId: 'g-1' }, fileFor('installer.exe', exe, 'application/octet-stream')))
      .rejects.toMatchObject({ code: 'UNSUPPORTED_TECHNICAL_DOCUMENT_TYPE' });
  });

  it('rejects SVG images even though they are text XML', async () => {
    const svg = Buffer.from('<svg xmlns="http://www.w3.org/2000/svg"><script>alert(1)</script></svg>');
    await expect(TechnicalDocumentsService.createUpload({ guestId: 'g-1' }, fileFor('logo.svg', svg, 'image/svg+xml')))
      .rejects.toMatchObject({ code: 'UNSUPPORTED_TECHNICAL_DOCUMENT_TYPE' });
  });

  it('rejects a declared MIME type that contradicts the extension', async () => {
    await expect(TechnicalDocumentsService.createUpload({ guestId: 'g-1' }, fileFor('drawing.pdf', PDF, 'image/png')))
      .rejects.toMatchObject({ code: 'TECHNICAL_DOCUMENT_MIME_TYPE_MISMATCH' });
  });

  it('rejects content that does not match the extension (renamed binary)', async () => {
    await expect(TechnicalDocumentsService.createUpload({ guestId: 'g-1' }, fileFor('fake.pdf', Buffer.alloc(512, 0x41), 'application/pdf')))
      .rejects.toMatchObject({ code: 'TECHNICAL_DOCUMENT_CONTENT_MISMATCH' });
  });

  it('rejects a zip archive disguised as a .txt (control bytes not plain text)', async () => {
    await expect(TechnicalDocumentsService.createUpload({ guestId: 'g-1' }, fileFor('notes.txt', ZIP_DOCX, 'text/plain')))
      .rejects.toMatchObject({ code: 'TECHNICAL_DOCUMENT_CONTENT_MISMATCH' });
  });

  it.each([
    ['PDF', 'drawing.pdf', PDF, 'application/pdf'],
    ['PNG', 'schema.png', PNG, 'image/png'],
    ['JPEG', 'photo.jpg', JPEG, 'image/jpeg'],
    ['RTF', 'spec.rtf', RTF, 'application/rtf'],
    ['DOC', 'old.doc', OLE, 'application/msword'],
    ['DOCX', 'report.docx', ZIP_DOCX, 'application/vnd.openxmlformats-officedocument.wordprocessingml.document'],
    ['TXT', 'instructions.txt', TXT, 'text/plain'],
  ])('accepts a genuine %s document', async (_label, name, data, mimeType) => {
    const doc = await TechnicalDocumentsService.createUpload({ userId: 'user-1' }, fileFor(name, data, mimeType));
    expect(doc.name).toBe(name);
    expect(doc.byteSize).toBe(data.byteLength);
    expect(doc.scanStatus).toBe('CLEAN');
    expect(state.storagePut).toHaveBeenCalled();
    expect(state.technicalDocument.create).toHaveBeenCalled();
  });

  it('stores under an owner-scoped, uuid-named key (never the raw filename)', async () => {
    state.storagePut.mockImplementation(async (key: string, _data: Buffer, _mime: string) => {
      state.storageKey = key;
      return { key, size: _data.byteLength, contentType: _mime };
    });
    await TechnicalDocumentsService.createUpload({ userId: 'user-abc' }, fileFor('my drawing.pdf', PDF, 'application/pdf'));
    expect(state.storageKey.startsWith('user-abc/docs/')).toBe(true);
    expect(state.storageKey.endsWith('.pdf')).toBe(true);
    expect(state.storageKey).not.toContain('my drawing');
  });

  it('enforces the per-owner document limit', async () => {
    state.technicalDocument.count.mockResolvedValue(10);
    await expect(TechnicalDocumentsService.createUpload({ guestId: 'g-1' }, fileFor('drawing.pdf', PDF, 'application/pdf')))
      .rejects.toMatchObject({ code: 'TECHNICAL_DOCUMENT_LIMIT_REACHED' });
  });

  it('dedupes an identical unlinked upload instead of writing again', async () => {
    state.technicalDocument.create.mockClear();
    state.storagePut.mockClear();
    state.technicalDocument.findFirst.mockResolvedValue({ id: 'doc-existing', name: 'drawing.pdf', mimeType: 'application/pdf', byteSize: PDF.byteLength, checksum: 'x', scanStatus: 'CLEAN', quoteId: null, orderId: null, userId: null, guestId: 'g-1', createdAt: new Date() });
    const doc = await TechnicalDocumentsService.createUpload({ guestId: 'g-1' }, fileFor('drawing.pdf', PDF, 'application/pdf'));
    expect(doc.id).toBe('doc-existing');
    expect(state.technicalDocument.create).not.toHaveBeenCalled();
    expect(state.storagePut).not.toHaveBeenCalled();
  });

  it('quarantines an EICAR test signature even with a genuine PDF prefix', async () => {
    const eicar = Buffer.concat([PDF, Buffer.from('X5O!P%@AP[4\\PZX54(P^)7CC)7}$EICAR-STANDARD-ANTIVIRUS-TEST-FILE!$H+H*')]);
    await expect(TechnicalDocumentsService.createUpload({ guestId: 'g-1' }, fileFor('malware.pdf', eicar, 'application/pdf')))
      .rejects.toMatchObject({ code: 'TECHNICAL_DOCUMENT_QUARANTINED' });
  });
});

describe('TechnicalDocumentsService.attachToQuote', () => {
  it('rejects documents the caller does not own', async () => {
    state.technicalDocument.findMany.mockResolvedValue([]);
    await expect(TechnicalDocumentsService.attachToQuote({ userId: 'user-a', quoteId: 'q-1', technicalDocumentIds: ['doc-x'] }))
      .rejects.toMatchObject({ code: 'TECHNICAL_DOCUMENT_NOT_OWNED' });
  });

  it('claims guest documents to the authenticated user on attach', async () => {
    state.technicalDocument.findMany.mockResolvedValue([{ id: 'doc-1' }]);
    await TechnicalDocumentsService.attachToQuote({ userId: 'user-a', guestId: 'g-1', quoteId: 'q-1', technicalDocumentIds: ['doc-1'] });
    expect(state.technicalDocument.updateMany).toHaveBeenCalledWith({
      where: { id: { in: ['doc-1'] } },
      data: { quoteId: 'q-1', userId: 'user-a', guestId: null },
    });
  });
});

describe('TechnicalDocumentsService.resolveForOrder', () => {
  it('enforces the symmetric doc-set guard between quote and order', async () => {
    await expect(TechnicalDocumentsService.resolveForOrder({
      userId: 'user-a', quoteId: 'q-1', quoteDocumentIds: ['d1', 'd2'], technicalDocumentIds: ['d1'],
    })).rejects.toMatchObject({ code: 'TECHNICAL_DOCUMENT_MISMATCH' });
  });

  it('accepts an exact match and verifies ownership', async () => {
    state.technicalDocument.findMany.mockResolvedValue([{ id: 'd1' }, { id: 'd2' }]);
    const resolved = await TechnicalDocumentsService.resolveForOrder({
      userId: 'user-a', quoteId: 'q-1', quoteDocumentIds: ['d1', 'd2'], technicalDocumentIds: ['d2', 'd1'],
    });
    expect(resolved.sort()).toEqual(['d1', 'd2']);
  });

  it('rejects a mismatched ownership set', async () => {
    state.technicalDocument.findMany.mockResolvedValue([{ id: 'd1' }]);
    await expect(TechnicalDocumentsService.resolveForOrder({
      userId: 'user-a', quoteId: 'q-1', quoteDocumentIds: ['d1', 'd2'], technicalDocumentIds: ['d1', 'd2'],
    })).rejects.toMatchObject({ code: 'TECHNICAL_DOCUMENT_NOT_OWNED' });
  });
});

describe('TechnicalDocumentsService.delete', () => {
  beforeEach(() => {
    state.technicalDocument.findFirst.mockReset();
  });

  it('blocks deletion of a document committed to an order', async () => {
    state.technicalDocument.findFirst.mockResolvedValue({ id: 'doc-1', orderId: 'ord-1' });
    await expect(TechnicalDocumentsService.delete({ userId: 'user-a' }, 'doc-1'))
      .rejects.toMatchObject({ code: 'TECHNICAL_DOCUMENT_IN_ORDER' });
  });

  it('removes the storage object when an uncommitted document is deleted', async () => {
    state.technicalDocument.findFirst.mockResolvedValue({ id: 'doc-1', orderId: null, storageKey: 'user-a/docs/k.pdf' });
    await TechnicalDocumentsService.delete({ userId: 'user-a' }, 'doc-1');
    expect(state.storageRemove).toHaveBeenCalledWith('user-a/docs/k.pdf');
    expect(state.technicalDocument.delete).toHaveBeenCalled();
  });

  it('throws NotFoundError for a non-owned document', async () => {
    state.technicalDocument.findFirst.mockResolvedValue(null);
    await expect(TechnicalDocumentsService.delete({ userId: 'user-a' }, 'nope')).rejects.toBeInstanceOf(AppError);
  });
});