import { randomUUID } from 'node:crypto';
import path from 'node:path';
import { getPrismaClient } from '../config/database';
import { ENV } from '../config/env';
import { AppError, NotFoundError } from '../utils/errors';
import { createFileScanner } from '../cad/file-processing';
import { calculateChecksum } from '../cad/file-processing';
import { MultipartFile } from '../cad/multipart';
import { createObjectStorage, ObjectStorage } from '../cad/object-storage';

const prisma = getPrismaClient();
const storage: ObjectStorage = createObjectStorage();

type DocumentOwner = { userId?: string; guestId?: string };

const ownerWhere = (owner: DocumentOwner) => (owner.userId ? { userId: owner.userId } : { userId: null, guestId: owner.guestId });
const ownerStorageKey = (owner: DocumentOwner) => owner.userId || `guest/${owner.guestId}`;

const safeName = (name: string): string => path.basename(name.replaceAll('\\', '/')).replace(/[\u0000-\u001f]/g, '').trim();

const extensionFor = (name: string): string => {
  const match = name.match(/\.([a-z0-9]+)$/i);
  return match ? match[1].toLowerCase() : '';
};

const OLE_MAGIC = Buffer.from([0xd0, 0xcf, 0x11, 0xe0, 0xa1, 0xb1, 0x1a, 0xe1]);
const PNG_MAGIC = Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]);

const isOle = (buffer: Buffer): boolean => buffer.length >= 8 && buffer.subarray(0, 8).equals(OLE_MAGIC);
const isZip = (buffer: Buffer): boolean => buffer.length >= 4 && buffer.subarray(0, 2).toString('latin1') === 'PK' && buffer[2] === 0x03 && buffer[3] === 0x04;
const isJpeg = (buffer: Buffer): boolean => buffer.length >= 3 && buffer[0] === 0xff && buffer[1] === 0xd8 && buffer[2] === 0xff;
const isPlainText = (buffer: Buffer): boolean => {
  if (buffer.length === 0) return false;
  for (let i = 0; i < buffer.length; i += 1) {
    const byte = buffer[i];
    if (byte === 0x00) return false;
    if (byte < 0x09) return false;
    if (byte >= 0x0e && byte < 0x20) return false;
  }
  return true;
};

interface DocumentFormatRule {
  format: string;
  mimeTypes: readonly string[];
  extensionLabel: string;
  sniff: (buffer: Buffer) => boolean;
}

/**
 * Supported technical documentation formats.
 *
 * Every rule includes a content (magic-byte) sniff — the backend never trusts
 * a filename extension or a client-declared MIME type on its own. EXE/DLL/
 * scripts/SVG/ZIP/archives/binary payloads are rejected outright because no
 * rule matches their content.
 */
export const TECHNICAL_DOCUMENT_FORMATS: Record<string, DocumentFormatRule> = {
  pdf: {
    format: 'PDF',
    mimeTypes: ['application/pdf'],
    extensionLabel: 'PDF',
    sniff: (buffer) => buffer.length >= 5 && buffer.subarray(0, 5).toString('latin1') === '%PDF-',
  },
  doc: {
    format: 'DOC',
    mimeTypes: ['application/msword'],
    extensionLabel: 'DOC',
    sniff: isOle,
  },
  docx: {
    format: 'DOCX',
    mimeTypes: ['application/vnd.openxmlformats-officedocument.wordprocessingml.document'],
    extensionLabel: 'DOCX',
    sniff: isZip,
  },
  txt: {
    format: 'TXT',
    mimeTypes: ['text/plain'],
    extensionLabel: 'TXT',
    sniff: isPlainText,
  },
  rtf: {
    format: 'RTF',
    mimeTypes: ['application/rtf', 'text/rtf'],
    extensionLabel: 'RTF',
    sniff: (buffer) => buffer.length >= 5 && buffer.subarray(0, 5).toString('latin1') === '{\\rtf',
  },
  png: {
    format: 'PNG',
    mimeTypes: ['image/png'],
    extensionLabel: 'PNG',
    sniff: (buffer) => buffer.length >= 8 && buffer.subarray(0, 8).equals(PNG_MAGIC),
  },
  jpg: {
    format: 'JPG',
    mimeTypes: ['image/jpeg'],
    extensionLabel: 'JPG',
    sniff: isJpeg,
  },
  jpeg: {
    format: 'JPEG',
    mimeTypes: ['image/jpeg'],
    extensionLabel: 'JPEG',
    sniff: isJpeg,
  },
};

export const SUPPORTED_TECHNICAL_DOCUMENT_EXTENSIONS = Object.keys(TECHNICAL_DOCUMENT_FORMATS);

const formatSize = (size: number): string => `${(size / (1024 * 1024)).toFixed(2)} MB`;

const publicDocument = (document: {
  id: string;
  userId: string | null;
  guestId: string | null;
  quoteId: string | null;
  orderId: string | null;
  name: string;
  mimeType: string;
  byteSize: number;
  checksum: string;
  scanStatus: string;
  createdAt: Date;
}) => ({
  id: document.id,
  name: document.name,
  mimeType: document.mimeType,
  byteSize: document.byteSize,
  checksum: document.checksum,
  scanStatus: document.scanStatus,
  quoteId: document.quoteId,
  orderId: document.orderId,
  createdAt: document.createdAt,
  userId: document.userId || undefined,
});

export class TechnicalDocumentsService {
  static async createUpload(owner: DocumentOwner, file: MultipartFile) {
    const originalName = safeName(file.originalName);
    if (!originalName) throw new AppError('A valid filename is required.', 400, 'INVALID_UPLOAD');
    if (file.data.byteLength < 1) {
      throw new AppError('Technical documents must not be empty.', 400, 'TECHNICAL_DOCUMENT_EMPTY');
    }
    if (file.data.byteLength > ENV.TECHNICAL_MAX_FILE_SIZE_BYTES) {
      throw new AppError(`Technical documents must not exceed ${formatSize(ENV.TECHNICAL_MAX_FILE_SIZE_BYTES)}.`, 400, 'TECHNICAL_DOCUMENT_TOO_LARGE');
    }

    const extension = extensionFor(originalName);
    const rule = TECHNICAL_DOCUMENT_FORMATS[extension];
    if (!rule) {
      throw new AppError(
        `Unsupported document type "${extension ? `.${extension}` : 'unknown'}". Supported types: ${SUPPORTED_TECHNICAL_DOCUMENT_EXTENSIONS.map((ext) => `.${ext}`).join(', ')}.`,
        400,
        'UNSUPPORTED_TECHNICAL_DOCUMENT_TYPE'
      );
    }

    const declaredMime = file.mimeType.split(';', 1)[0].trim().toLowerCase();
    if (declaredMime && declaredMime !== 'application/octet-stream' && !rule.mimeTypes.includes(declaredMime)) {
      throw new AppError(`The declared MIME type "${declaredMime}" does not match a .${extension} document.`, 400, 'TECHNICAL_DOCUMENT_MIME_TYPE_MISMATCH');
    }

    if (!rule.sniff(file.data)) {
      throw new AppError(`The file content does not match a .${extension} document. Only genuine ${rule.format} files are accepted.`, 400, 'TECHNICAL_DOCUMENT_CONTENT_MISMATCH');
    }

    const existingCount = await prisma.technicalDocument.count({ where: ownerWhere(owner) });
    if (existingCount >= ENV.TECHNICAL_MAX_DOCUMENTS) {
      throw new AppError(`A maximum of ${ENV.TECHNICAL_MAX_DOCUMENTS} technical documents can be attached to a request.`, 400, 'TECHNICAL_DOCUMENT_LIMIT_REACHED');
    }

    const checksum = calculateChecksum(file.data);
    const existing = await prisma.technicalDocument.findFirst({ where: { ...ownerWhere(owner), name: originalName, checksum, orderId: null } });
    if (existing) return publicDocument(existing);

    const scanner = createFileScanner();
    const verdict = await scanner.scan(file.data);
    if (verdict.status === 'QUARANTINED') {
      throw new AppError('The upload was quarantined by the antivirus scanner.', 400, 'TECHNICAL_DOCUMENT_QUARANTINED');
    }

    const storageKey = `${ownerStorageKey(owner)}/docs/${randomUUID()}.${extension}`;
    await storage.put(storageKey, file.data, rule.mimeTypes[0] || file.mimeType);

    let document;
    try {
      document = await prisma.technicalDocument.create({
        data: {
          userId: owner.userId,
          guestId: owner.guestId,
          name: originalName,
          mimeType: rule.mimeTypes[0] || file.mimeType || 'application/octet-stream',
          byteSize: file.data.byteLength,
          checksum,
          storageKey,
          scanStatus: 'CLEAN',
        },
      });
    } catch (error) {
      await storage.remove(storageKey).catch(() => undefined);
      throw error;
    }

    return publicDocument(document);
  }

  static async list(owner: DocumentOwner) {
    const documents = await prisma.technicalDocument.findMany({
      where: ownerWhere(owner),
      orderBy: { createdAt: 'desc' },
    });
    return documents.map(publicDocument);
  }

  static async get(owner: DocumentOwner, id: string) {
    const document = await prisma.technicalDocument.findFirst({ where: { id, ...ownerWhere(owner) } });
    if (!document) throw new NotFoundError('Technical document');
    return publicDocument(document);
  }

  static async download(owner: DocumentOwner, id: string) {
    const document = await prisma.technicalDocument.findFirst({ where: { id, ...ownerWhere(owner) } });
    if (!document) throw new NotFoundError('Technical document');
    return { document, stream: storage.stream(document.storageKey) };
  }

  static async delete(owner: DocumentOwner, id: string) {
    const document = await prisma.technicalDocument.findFirst({ where: { id, ...ownerWhere(owner) } });
    if (!document) throw new NotFoundError('Technical document');
    if (document.orderId) {
      throw new AppError('This technical document is attached to an order and cannot be removed.', 400, 'TECHNICAL_DOCUMENT_IN_ORDER');
    }
    await prisma.technicalDocument.delete({ where: { id: document.id } });
    await storage.remove(document.storageKey).catch(() => undefined);
    return { id: document.id };
  }

  /**
   * Validate that every requested document is owned by the caller and attach
   * them to a quote. Guest-owned documents are claimed by the authenticated
   * user at the same time (mirrors the CAD ownership-claim at order time).
   */
  static async attachToQuote(data: {
    userId?: string;
    guestId?: string;
    quoteId: string;
    technicalDocumentIds?: string[];
    technicalNotes?: string;
  }): Promise<void> {
    const ids = [...new Set(data.technicalDocumentIds || [])];
    if (ids.length === 0) return;

    const ownerFilter = data.userId
      ? { OR: [{ userId: data.userId }, { userId: null, guestId: data.guestId }] }
      : { userId: null, guestId: data.guestId };

    const documents = await prisma.technicalDocument.findMany({
      where: { id: { in: ids }, ...ownerFilter },
    });
    if (documents.length !== ids.length) {
      throw new AppError('One or more technical documents do not belong to this customer.', 403, 'TECHNICAL_DOCUMENT_NOT_OWNED');
    }

    await prisma.technicalDocument.updateMany({
      where: { id: { in: ids } },
      data: {
        quoteId: data.quoteId,
        ...(data.userId ? { userId: data.userId, guestId: null } : {}),
      },
    });
  }

  /**
   * Resolve the technical documents an order must carry. The document set is
   * guarded symmetrically against the quoted set (never fewer, never more).
   * Called from OrdersService.createOrder.
   */
  static async resolveForOrder(data: {
    userId?: string;
    guestId?: string;
    quoteId: string;
    quoteDocumentIds: string[];
    technicalDocumentIds?: string[];
  }): Promise<string[]> {
    const quotedIds = [...new Set(data.quoteDocumentIds)].sort();
    const submittedIds = [...new Set(data.technicalDocumentIds || [])].sort();
    if (submittedIds.length === 0 && quotedIds.length === 0) return [];
    if (submittedIds.length === 0) return quotedIds;

    if (submittedIds.join(',') !== quotedIds.join(',')) {
      throw new AppError('The submitted technical documents do not match the quoted documents.', 400, 'TECHNICAL_DOCUMENT_MISMATCH');
    }

    const ownerFilter = data.userId
      ? { OR: [{ userId: data.userId }, { userId: null, guestId: data.guestId }] }
      : { userId: null, guestId: data.guestId };
    const documents = await prisma.technicalDocument.findMany({
      where: { id: { in: submittedIds }, ...ownerFilter },
    });
    if (documents.length !== submittedIds.length) {
      throw new AppError('One or more technical documents do not belong to this customer.', 403, 'TECHNICAL_DOCUMENT_NOT_OWNED');
    }
    return submittedIds;
  }

  /** Claim guest documents to a user and bind them to an order. */
  static async attachToOrder(data: {
    userId?: string;
    guestId?: string;
    orderId: string;
    quoteId: string;
    technicalDocumentIds: string[];
  }): Promise<void> {
    if (data.technicalDocumentIds.length === 0) return;
    await prisma.technicalDocument.updateMany({
      where: { id: { in: data.technicalDocumentIds } },
      data: {
        orderId: data.orderId,
        quoteId: data.quoteId,
        ...(data.userId ? { userId: data.userId, guestId: null } : {}),
      },
    });
  }
}