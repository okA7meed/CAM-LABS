import { Worker } from 'node:worker_threads';
import { existsSync } from 'node:fs';
import path from 'node:path';
import { ENV } from '../config/env';

export interface SolidCadProcessingResult {
  glb: Buffer;
  metadata: Record<string, unknown>;
  dimensions: string;
  volume?: string;
  meshTriangles: string;
  detectedUnit: string;
}

export const processSolidCad = (format: 'STEP' | 'STP' | 'IGES' | 'IGS', data: Buffer): Promise<SolidCadProcessingResult> => new Promise((resolve, reject) => {
  const workerPath = path.join(__dirname, existsSync(path.join(__dirname, 'solid-cad.worker.js')) ? 'solid-cad.worker.js' : 'solid-cad.worker.ts');
  const worker = new Worker(workerPath, { workerData: { format, data }, execArgv: workerPath.endsWith('.ts') ? ['--experimental-strip-types'] : undefined });
  let settled = false;
  const timeout = setTimeout(() => {
    void worker.terminate();
    settled = true;
    reject(new Error('CAD_PROCESSING_TIMEOUT'));
  }, ENV.CAD_PROCESSING_TIMEOUT_MS);
  worker.once('message', (message: { error?: string; glb?: Uint8Array } & Partial<SolidCadProcessingResult>) => {
    clearTimeout(timeout);
    void worker.terminate();
    settled = true;
    if (message.error || !message.glb) {
      reject(new Error(message.error || 'CAD_PROCESSING_FAILED'));
      return;
    }
    resolve({ ...message, glb: Buffer.from(message.glb) } as SolidCadProcessingResult);
  });
  worker.once('error', (error) => { clearTimeout(timeout); settled = true; reject(error); });
  worker.once('exit', (code) => {
    if (!settled) {
      clearTimeout(timeout);
      settled = true;
      reject(new Error(code === 0 ? 'CAD_WORKER_NO_RESULT' : 'CAD_WORKER_EXITED'));
    }
  });
});