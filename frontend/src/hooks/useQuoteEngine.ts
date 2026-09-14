import { useCallback, useEffect, useRef } from 'react';
import { ApiService } from '../services/api';
import { areAllUploadsReady, isUploadItemReady } from '../components/manufacturing/uploadState';
import { fdmParametersFor } from '../components/manufacturing/workspace/helpers';
import { FileConfiguration, QuoteData, RequestState, UploadItem } from '../components/manufacturing/workspace/types';

export const useQuoteEngine = ({ request, fileConfigurations, uploadItems, setQuote, setIsCalculatingQuote, setQuoteFailed, setError }: {
  request: RequestState;
  fileConfigurations: Record<string, FileConfiguration>;
  uploadItems: UploadItem[];
  setQuote: (q: QuoteData | null) => void;
  setIsCalculatingQuote: (b: boolean) => void;
  setQuoteFailed: (b: boolean) => void;
  setError: (m: string) => void;
}) => {
  const quoteRequestVersionRef = useRef(0);
  const quoteAbortControllerRef = useRef<AbortController | null>(null);

  const invalidateQuote = useCallback(() => {
    quoteRequestVersionRef.current += 1;
    quoteAbortControllerRef.current?.abort();
    setQuote(null);
    setQuoteFailed(false);
  }, [setQuote, setQuoteFailed]);

  useEffect(() => {
    if (!request.material || !request.process || !areAllUploadsReady(uploadItems)) return;
    const ver = ++quoteRequestVersionRef.current;
    quoteAbortControllerRef.current?.abort();
    const ctrl = new AbortController(); quoteAbortControllerRef.current = ctrl;
    setIsCalculatingQuote(true); setQuote(null); setQuoteFailed(false); setError('');
    const timeout = window.setTimeout(() => {
      if (ver !== quoteRequestVersionRef.current) return;
      const usable = uploadItems.filter(isUploadItemReady);
      if (!usable.length) { setQuote(null); setIsCalculatingQuote(false); return; }
      const files = usable.map((item) => {
        const cfg = fileConfigurations[item.cadFile!.id] || { technology: request.technology, process: request.process, material: request.material, quantity: request.quantity, quality: request.quality, color: request.color, finish: request.finish, tolerance: request.tolerance, wallCount: request.wallCount, infillPercent: null, supportEnabled: false };
        const md = item.cadFile?.latestVersion?.metadata; const q = cfg.quality || request.quality; const w = cfg.wallCount ?? request.wallCount;
        return { fileId: item.cadFile!.id, fileName: item.cadFile!.name, format: item.cadFile!.format, materialId: cfg.material || request.material || 'pla', technology: (cfg.process || request.process || 'fdm').toUpperCase(), surfaceFinish: cfg.finish || 'standard', toleranceGrade: (cfg.tolerance || 'standard') === 'precision' ? 'precision' as const : 'standard' as const, quantity: cfg.quantity || request.quantity, volumeCm3: (md as any)?.volume, surfaceAreaCm2: (md as any)?.surfaceArea, triangleCount: (md as any)?.triangleCount, dimensions: (md as any)?.dimensions ? { widthMm: (md as any).dimensions.width || 0, heightMm: (md as any).dimensions.height || 0, depthMm: (md as any).dimensions.depth || 0 } : undefined, manufacturingParameters: fdmParametersFor(q, w, cfg.supportEnabled, (cfg as Partial<FileConfiguration>).infillPercent ?? null) };
      });
      ApiService.calculateMultiFileQuotation({ files, signal: ctrl.signal }).then((r) => { if (ver === quoteRequestVersionRef.current && r) setQuote(r); }).catch((e) => { if (!ctrl.signal.aborted && e?.name !== 'AbortError' && ver === quoteRequestVersionRef.current) { setQuote(null); setQuoteFailed(true); setError(e instanceof Error ? e.message : 'Could not calculate this configuration.'); } }).finally(() => { if (ver === quoteRequestVersionRef.current) setIsCalculatingQuote(false); });
    }, 300);
    return () => { window.clearTimeout(timeout); ctrl.abort(); };
  }, [request.material, request.process, request.quality, request.finish, request.tolerance, request.quantity, request.wallCount, request.infillPercent, request.geometry, request.cadFile, fileConfigurations, uploadItems, setQuote, setIsCalculatingQuote, setQuoteFailed, setError]);

  return { invalidateQuote };
};