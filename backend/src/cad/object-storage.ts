import { createReadStream } from 'node:fs';
import { mkdir, readFile, rename, rm, stat, writeFile } from 'node:fs/promises';
import path from 'node:path';
import { randomUUID } from 'node:crypto';
import { ENV } from '../config/env';

export interface StoredObject {
  key: string;
  size: number;
  contentType: string;
}

export interface ObjectStorage {
  put(key: string, data: Buffer, contentType: string): Promise<StoredObject>;
  read(key: string): Promise<Buffer>;
  stream(key: string): NodeJS.ReadableStream;
  remove(key: string): Promise<void>;
}

const safeStoragePath = (root: string, key: string): string => {
  const resolvedRoot = path.resolve(root);
  const resolvedKey = path.resolve(resolvedRoot, key);
  if (resolvedKey !== resolvedRoot && !resolvedKey.startsWith(`${resolvedRoot}${path.sep}`)) {
    throw new Error('Storage key escapes the configured storage root.');
  }
  return resolvedKey;
};

export class FilesystemObjectStorage implements ObjectStorage {
  constructor(private readonly root = ENV.CAD_STORAGE_ROOT) {}

  async put(key: string, data: Buffer, contentType: string): Promise<StoredObject> {
    const target = safeStoragePath(this.root, key);
    const temporary = `${target}.${randomUUID()}.tmp`;
    await mkdir(path.dirname(target), { recursive: true });
    await writeFile(temporary, data, { flag: 'wx' });
    await rename(temporary, target);
    return { key, size: data.byteLength, contentType };
  }

  read(key: string): Promise<Buffer> {
    return readFile(safeStoragePath(this.root, key));
  }

  stream(key: string): NodeJS.ReadableStream {
    return createReadStream(safeStoragePath(this.root, key));
  }

  async remove(key: string): Promise<void> {
    await rm(safeStoragePath(this.root, key), { force: true });
  }

  async exists(key: string): Promise<boolean> {
    try {
      await stat(safeStoragePath(this.root, key));
      return true;
    } catch {
      return false;
    }
  }
}

export const createObjectStorage = (): ObjectStorage => new FilesystemObjectStorage();