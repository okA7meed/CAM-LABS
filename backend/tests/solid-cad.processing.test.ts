import { describe, expect, it } from 'vitest';
import { processSolidCad } from '../src/cad/solid-cad-processor';

describe('OpenCascade solid CAD worker', () => {
  it.each(['STEP', 'STP', 'IGES', 'IGS'] as const)('rejects corrupt %s input without producing an asset', async (format) => {
    await expect(processSolidCad(format, Buffer.from(`corrupt ${format} document`))).rejects.toThrow(/CAD_(IMPORT_FAILED|WORKER_EXITED|PROCESSING_FAILED)/);
  }, 30_000);

  it('returns a bounded failure for input that cannot initialize the CAD pipeline', async () => {
    await expect(processSolidCad('STEP', Buffer.alloc(0))).rejects.toThrow();
  }, 30_000);
});