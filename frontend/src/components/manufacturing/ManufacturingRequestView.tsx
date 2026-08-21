import React, { DragEvent, useEffect, useRef, useState } from 'react';
import { ApiError, ApiService, CalculatedQuotationData, MultiFileQuotation } from '../../services/api';
import { CadFile } from '../../types';
import { useStore } from '../../context/StoreContext';
import { useAuth } from '../../context/AuthContext';
import { useTranslation } from 'react-i18next';
import { CadGeometryViewer } from './CadGeometryViewer';
import { CadGeometryData } from '../../services/api';
import { Icon, IconName } from '../ui/Icon';
import { ModelDimensions, ModelUnit } from '../../utils/modelUnits';
import { RequiredMark, OptionalMark } from '../ui/FieldLabel';
import { MATERIALS_DATA } from '../../data/materialsData';
import { PriceEstimateNotice } from '../ui/PriceEstimateNotice';
import { PriceStatus, PriceTransition } from '../ui/PriceTransition';
import { UploadItemStatus, UploadValidationState, areAllUploadsReady, hasBlockingUploadState, hasUploadInFlight, isCadFileReady, isUploadItemReady } from './uploadState';

type TechnologyId = 'printing' | 'cnc' | 'sheet';
type ProcessId = 'fdm' | 'sla' | 'sls' | 'milling' | 'turning' | 'sheet';
type Step = 0 | 1 | 2 | 3 | 4 | 5 | 6;
type QuoteData = CalculatedQuotationData | MultiFileQuotation;

const isMultiFileQuote = (data: QuoteData | null): data is MultiFileQuotation => Boolean(data && 'files' in data);

const hasOwn = <T extends object>(obj: T, key: PropertyKey): key is keyof T => Object.prototype.hasOwnProperty.call(obj, key);

interface UploadItem {
  id: string;
  name: string;
  format: string;
  sizeBytes: number;
  size: string;
  status: UploadItemStatus;
  validationState: UploadValidationState;
  processingComplete: boolean;
  progress: number;
  message?: string;
  cadFile?: CadFile;
}

interface FileSetupState {
  unit: ModelUnit;
  dimensions: ModelDimensions | null;
  baseDimensions: ModelDimensions | null;
  volume: number | null;
  surfaceArea: number | null;
  triangleCount: number | null;
  selected: boolean;
}

type FileConfiguration = { technology: string | null; process: string | null; material: string | null; quantity: number; quality: string; color: string; finish: string; tolerance: string; wallCount?: number; supportEnabled?: boolean };

interface RequestState {
  cadFile: CadFile | null;
  technology: TechnologyId | null;
  process: ProcessId | null;
  material: string | null;
  quantity: number;
  quality: string;
  color: string;
  finish: string;
  tolerance: string;
  wallCount: number;
  geometry: CadGeometryData | null;
}

const initialState: RequestState = { cadFile: null, technology: 'printing', process: null, material: null, quantity: 1, quality: 'standard', color: 'any', finish: 'standard', tolerance: 'standard', wallCount: 3, geometry: null };
const processGroups = [
  { group: 'printing', options: ['fdm', 'sla', 'sls'] },
  { group: 'cnc', options: ['milling', 'turning'] },
  { group: 'sheetMetal', options: ['sheet'] },
] as const;

const MAX_UPLOAD_FILES = 20;
const MAX_UPLOAD_FILE_SIZE_BYTES = 500 * 1024 * 1024;
const MAX_UPLOAD_TOTAL_BYTES = 2 * 1024 * 1024 * 1024;

const INFILL_OPTIONS = [
  { id: 'hollow', title: '0% (Hollow)', description: 'Completely hollow interior. Lowest weight and material usage but weak', infillPercent: 0, wallCount: 2, layerHeightMm: 0.28 },
  { id: 'sparse', title: '10% (Sparse)', description: 'Minimal infill for decorative parts', infillPercent: 10, wallCount: 2, layerHeightMm: 0.24 },
  { id: 'standard', title: '15% (Standard)', description: 'Standard lightweight infill for most everyday prints', infillPercent: 15, wallCount: 3, layerHeightMm: 0.2 },
  { id: 'high', title: '30% (Moderate)', description: 'Good balance of strength and weight', infillPercent: 30, wallCount: 4, layerHeightMm: 0.16 },
  { id: 'dense', title: '50% (Dense)', description: 'High-density infill', infillPercent: 50, wallCount: 4, layerHeightMm: 0.14 },
  { id: 'verydense', title: '75% (Very Dense)', description: '', infillPercent: 75, wallCount: 4, layerHeightMm: 0.12 },
  { id: 'premium', title: '100% (Solid)', description: 'Completely solid, maximum weight', infillPercent: 100, wallCount: 5, layerHeightMm: 0.1 },
  { id: 'heavyduty', title: 'Heavy Duty (5 walls)', description: 'Maximum wall durability for heavy-duty and high-impact applications', infillPercent: 100, wallCount: 5, layerHeightMm: 0.1 },
] as const;

const WALL_OPTIONS = [
  { walls: 1, title: 'Single (1 walls)' },
  { walls: 2, title: 'Light (2 walls)' },
  { walls: 3, title: 'Standard (3 walls)' },
  { walls: 4, title: 'Strong (4 walls)' },
  { walls: 5, title: 'Heavy Duty (5 walls)' },
] as const;

const fdmParametersFor = (quality: string, wallCount: number, supportEnabled = false) => {
  const preset = INFILL_OPTIONS.find((option) => option.id === quality) ?? INFILL_OPTIONS.find((option) => option.id === 'standard')!;
  return { layerHeightMm: preset.layerHeightMm, infillPercent: preset.infillPercent, wallCount, supportEnabled };
};

export const ManufacturingRequestView: React.FC = () => {
  const { t } = useTranslation();
  const { setActiveView, openAuthModal } = useStore();
  const { isAuthenticated } = useAuth();
  const [step, setStep] = useState<Step>(0);
  const [request, setRequest] = useState<RequestState>(initialState);
  const [quote, setQuote] = useState<QuoteData | null>(null);
  const [isCalculatingQuote, setIsCalculatingQuote] = useState(false);
  const [quoteFailed, setQuoteFailed] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [uploadItems, setUploadItems] = useState<UploadItem[]>([]);
  const [uploadLifecycleBusy, setUploadLifecycleBusy] = useState(false);
  const [fileConfigurations, setFileConfigurations] = useState<Record<string, FileConfiguration>>({});
  const [error, setError] = useState('');
  const [isDragging, setIsDragging] = useState(false);
  const [previewFile, setPreviewFile] = useState<CadFile | null>(null);
  const [deleteItem, setDeleteItem] = useState<UploadItem | null>(null);
  const [isDeleting, setIsDeleting] = useState(false);
  const [requestReference, setRequestReference] = useState('');
  const [authGateOpen, setAuthGateOpen] = useState(false);
  const [selectedSetupId, setSelectedSetupId] = useState<string | null>(null);
  const [materialSelectionInitialized, setMaterialSelectionInitialized] = useState(false);
  const [fileSetupStates, setFileSetupStates] = useState<Record<string, FileSetupState>>({});
  const submissionInFlightRef = useRef(false);
  const lastNavigationAtRef = useRef(0);
  const quoteRequestVersionRef = useRef(0);
  const quoteAbortControllerRef = useRef<AbortController | null>(null);
  const inputRef = useRef<HTMLInputElement>(null);
  const requestPanelRef = useRef<HTMLElement>(null);
  const modalRef = useRef<HTMLDivElement>(null);
  const modalTriggerRef = useRef<HTMLElement | null>(null);
  const primaryUploadIdRef = useRef<string | null>(null);
  const activeUploadTokensRef = useRef<Record<string, string>>({});
  const uploadLifecycleBusyRef = useRef(false);
  const isPrinting = ['fdm', 'sla', 'sls'].includes(request.process || '');
  const isCnc = ['milling', 'turning'].includes(request.process || '');
  const steps: Array<{ id: string; title: string; description: string; icon: IconName; label: string }> = [
    { id: 'technology', title: 'Choose Technology', description: 'Select your preferred manufacturing technology and compatible process.', icon: 'technology', label: 'Technology' },
    { id: 'upload', title: 'Upload Your CAD File', description: 'Upload your STL, STEP, DXF or supported manufacturing file.', icon: 'upload', label: 'Upload' },
    { id: 'fileSetup', title: 'Upload Files', description: 'Inspect your model and confirm the detected geometry.', icon: 'file', label: 'Upload Files' },
    { id: 'material', title: 'Select Material', description: 'Choose the material and manufacturing parameters for your part.', icon: 'layers3', label: 'Material' },
    { id: 'configure', title: 'Configure Production', description: 'Set quantity, finish, tolerances and production options.', icon: 'configure', label: 'Config' },
    { id: 'review', title: 'Review Your Order', description: 'Review your configuration, pricing and estimated delivery before submitting.', icon: 'clipboard', label: 'Review' },
  ];

  const updateRequest = (partial: Partial<RequestState>) => setRequest((current) => ({ ...current, ...partial }));

  const openPreview = (file: CadFile) => {
    modalTriggerRef.current = document.activeElement instanceof HTMLElement ? document.activeElement : null;
    setPreviewFile(file);
  };

  const openDelete = (item: UploadItem) => {
    modalTriggerRef.current = document.activeElement instanceof HTMLElement ? document.activeElement : null;
    setDeleteItem(item);
  };

  const invalidateQuote = () => {
    quoteRequestVersionRef.current += 1;
    quoteAbortControllerRef.current?.abort();
    setQuote(null);
    setQuoteFailed(false);
  };

  const setUploadBusy = (busy: boolean) => {
    uploadLifecycleBusyRef.current = busy;
    setUploadLifecycleBusy(busy);
  };

  useEffect(() => {
    if (uploadLifecycleBusyRef.current && !hasUploadInFlight(uploadItems)) setUploadBusy(false);
  }, [uploadItems]);

  useEffect(() => {
    requestPanelRef.current?.focus();
  }, [step]);

  useEffect(() => {
    if (!previewFile && !deleteItem) {
      modalTriggerRef.current?.focus();
      modalTriggerRef.current = null;
      return;
    }

    const focusableSelector = 'button:not([disabled]), input:not([disabled]), select:not([disabled]), [tabindex]:not([tabindex="-1"])';
    const focusFirstControl = () => modalRef.current?.querySelector<HTMLElement>(focusableSelector)?.focus();
    const handleModalKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Escape') {
        event.preventDefault();
        if (!isDeleting) {
          setPreviewFile(null);
          setDeleteItem(null);
        }
        return;
      }
      if (event.key !== 'Tab' || !modalRef.current) return;
      const controls = Array.from(modalRef.current.querySelectorAll<HTMLElement>(focusableSelector));
      if (!controls.length) return;
      const first = controls[0];
      const last = controls[controls.length - 1];
      if (event.shiftKey && document.activeElement === first) {
        event.preventDefault();
        last.focus();
      } else if (!event.shiftKey && document.activeElement === last) {
        event.preventDefault();
        first.focus();
      }
    };

    window.addEventListener('keydown', handleModalKeyDown);
    window.requestAnimationFrame(focusFirstControl);
    return () => window.removeEventListener('keydown', handleModalKeyDown);
  }, [previewFile, deleteItem, isDeleting]);

  useEffect(() => {
    if (![3, 4, 5].includes(step) || !request.material || !request.process) return;

    const requestVersion = ++quoteRequestVersionRef.current;
    quoteAbortControllerRef.current?.abort();
    const controller = new AbortController();
    quoteAbortControllerRef.current = controller;
    setIsCalculatingQuote(true);
    setQuote(null);
    setQuoteFailed(false);
    setError('');
    const timeout = window.setTimeout(() => {
      if (requestVersion !== quoteRequestVersionRef.current) return;

      if (!areAllUploadsReady(uploadItems)) {
        setQuote(null);
        setIsCalculatingQuote(false);
        return;
      }

      const usableItems = uploadItems.filter(isUploadItemReady);
      if (usableItems.length === 0) {
        setQuote(null);
        setIsCalculatingQuote(false);
        return;
      }

      const filesToQuote = usableItems.map((item) => {
      const config = fileConfigurations[item.cadFile!.id] || {
        technology: request.technology,
        process: request.process,
        material: request.material,
        quantity: request.quantity,
        quality: request.quality,
        color: request.color,
        finish: request.finish,
        tolerance: request.tolerance,
        wallCount: request.wallCount,
      };
      
      const metadata = item.cadFile?.latestVersion?.metadata;
      const quality = config.quality || request.quality;
      const wallCount = config.wallCount ?? request.wallCount;
      
      return {
        fileId: item.cadFile!.id,
        fileName: item.cadFile!.name,
        format: item.cadFile!.format,
        materialId: config.material || request.material || 'pla',
        technology: (config.process || request.process || 'fdm').toUpperCase(),
        surfaceFinish: config.finish || 'standard',
        toleranceGrade: (config.tolerance || 'standard') === 'precision' ? 'precision' as const : 'standard' as const,
        quantity: config.quantity || request.quantity,
        volumeCm3: (metadata as any)?.volume,
        surfaceAreaCm2: (metadata as any)?.surfaceArea,
        triangleCount: (metadata as any)?.triangleCount,
        dimensions: (metadata as any)?.dimensions ? {
          widthMm: (metadata as any).dimensions.width || 0,
          heightMm: (metadata as any).dimensions.height || 0,
          depthMm: (metadata as any).dimensions.depth || 0,
        } : undefined,
        manufacturingParameters: fdmParametersFor(quality, wallCount, config.supportEnabled),
      };
      });

      ApiService.calculateMultiFileQuotation({ files: filesToQuote, signal: controller.signal }).then((result) => {
        if (requestVersion === quoteRequestVersionRef.current && result) setQuote(result);
      }).catch((err) => {
        if (!controller.signal.aborted && err?.name !== 'AbortError' && requestVersion === quoteRequestVersionRef.current) {
          setQuote(null);
          setQuoteFailed(true);
          setError(err instanceof Error ? err.message : 'CAM LABS could not calculate this configuration.');
        }
      }).finally(() => {
        if (requestVersion === quoteRequestVersionRef.current) setIsCalculatingQuote(false);
      });
    }, 300);

    return () => {
      window.clearTimeout(timeout);
      controller.abort();
    };
  }, [step, request.material, request.process, request.quality, request.finish, request.tolerance, request.quantity, request.wallCount, request.geometry, request.cadFile, fileConfigurations, uploadItems]);

  const updateUploadItem = (id: string, update: Partial<UploadItem>, token?: string) => {
    if (token && activeUploadTokensRef.current[id] !== token) return;
    setUploadItems((items) => items.map((item) => item.id === id ? { ...item, ...update } : item));
  };

  const selectSetupFile = (id: string) => {
    setSelectedSetupId(id);
    setRequest((current) => ({ ...current, geometry: null }));
    setFileSetupStates((current) => ({ ...current, [id]: { ...(current[id] || { unit: 'mm', dimensions: null, baseDimensions: null, volume: null, surfaceArea: null, triangleCount: null, selected: false }) } }));
  };

  const toggleSetupSelection = (id: string) => {
    setFileSetupStates((current) => ({ ...current, [id]: { ...(current[id] || { unit: 'mm', dimensions: null, baseDimensions: null, volume: null, surfaceArea: null, triangleCount: null, selected: false }), selected: !current[id]?.selected } }));
  };

  const toggleAllSetupSelection = (selected: boolean) => {
    setFileSetupStates((current) => Object.fromEntries(uploadItems.map((item) => [item.id, { ...(current[item.id] || { unit: 'mm', dimensions: null, baseDimensions: null, volume: null, surfaceArea: null, triangleCount: null }), selected: isUploadItemReady(item) && selected }])));
  };

  const pollProcessing = async (itemId: string, fileId: string): Promise<CadFile> => {
    for (let attempt = 0; attempt < 40; attempt += 1) {
      const files = await ApiService.getCadFiles();
      const processed = files?.find((candidate) => candidate.id === fileId);
      const version = processed?.latestVersion;
      if (version?.scanStatus === 'QUARANTINED' || version?.processingStatus === 'FAILED') throw new Error(version?.failureMessage || t('request.processingFailed'));
      if (version?.processingStatus === 'COMPLETE' && processed && isCadFileReady(processed)) return processed;
      if (version?.processingStatus === 'COMPLETE' && processed && !isCadFileReady(processed)) throw new Error(t('request.processingFailed'));
      updateUploadItem(itemId, { status: version?.scanStatus === 'PENDING' ? 'scanning' : 'processing' });
      await new Promise((resolve) => window.setTimeout(resolve, 500));
    }
    throw new Error(t('request.processingTimeout'));
  };

  const processUpload = async (itemId: string, file: File, token: string) => {
    try {
      const validation = await ApiService.validateCadFile(file.name, file.size);
      if (activeUploadTokensRef.current[itemId] !== token) return;
      if (validation && !validation.isValidFormat) {
        updateUploadItem(itemId, { status: 'unsupported', validationState: 'invalid', processingComplete: false, message: t('request.invalidFormat') }, token);
        return;
      }
      if (validation && validation.isSizeWithinLimit === false) {
        updateUploadItem(itemId, { status: 'unsupported', validationState: 'invalid', processingComplete: false, message: 'File exceeds the current environment upload size limit (150MB).' }, token);
        return;
      }
      if (file.size < 1) {
        updateUploadItem(itemId, { progress: 100, status: 'processing', validationState: 'pending', processingComplete: false }, token);
        updateUploadItem(itemId, { status: 'failed', validationState: 'invalid', processingComplete: false, message: 'CAD files must not be empty.' }, token);
        return;
      }
      const uploaded = await ApiService.uploadCadFile(file, (progress) => updateUploadItem(itemId, { progress, status: progress < 100 ? 'uploading' : 'scanning' }, token));
      if (activeUploadTokensRef.current[itemId] !== token) return;
      if (!uploaded) throw new Error(t('request.uploadUnavailable'));
      const uploadedFile: CadFile = { ...uploaded, latestVersion: uploaded.version };
      if (uploaded.duplicate && isCadFileReady(uploadedFile)) {
        updateUploadItem(itemId, { status: 'duplicate', cadFile: uploadedFile, validationState: 'valid', processingComplete: true, message: t('request.queue.duplicateMessage') }, token);
        if (itemId === primaryUploadIdRef.current) setRequest((current) => ({ ...current, cadFile: uploadedFile }));
        return;
      }
      updateUploadItem(itemId, { status: 'scanning', progress: 100, cadFile: uploadedFile, validationState: 'pending', processingComplete: false }, token);
      const processed = await pollProcessing(itemId, uploaded.id);
      if (activeUploadTokensRef.current[itemId] !== token) return;
      updateUploadItem(itemId, { status: 'ready', cadFile: processed, validationState: 'valid', processingComplete: true }, token);
      if (itemId === primaryUploadIdRef.current) setRequest((current) => ({ ...current, cadFile: processed }));
    } catch (uploadError) {
      const message = uploadError instanceof ApiError || uploadError instanceof Error ? uploadError.message : t('request.uploadFailed');
      updateUploadItem(itemId, { status: uploadError instanceof ApiError && uploadError.status === 400 ? 'unsupported' : 'failed', validationState: 'invalid', processingComplete: false, message }, token);
    }
  };

  const addFiles = (files: File[]) => {
    if (!files.length) return;
    setError('');
    invalidateQuote();
    setUploadBusy(true);
    const acceptedItems = uploadItems.filter((item) => item.status !== 'unsupported');
    const currentTotalBytes = acceptedItems.reduce((sum, item) => sum + item.sizeBytes, 0);
    let runningTotalBytes = currentTotalBytes;
    let runningCount = acceptedItems.length;
    const stagedItems: Array<{ id: string; name: string; format: string; size: string; sizeBytes: number; status: UploadItemStatus; validationState: UploadValidationState; processingComplete: boolean; progress: number; message?: string; file?: File; token?: string }> = [];

    files.forEach((file) => {
      const id = crypto.randomUUID();
      const size = `${(file.size / (1024 * 1024)).toFixed(2)} MB`;
      const format = file.name.split('.').pop()?.toUpperCase() || 'CAD';

      if (runningCount >= MAX_UPLOAD_FILES) {
        stagedItems.push({ id, name: file.name, format, size, sizeBytes: file.size, status: 'unsupported', validationState: 'invalid', processingComplete: false, progress: 0, message: `Maximum ${MAX_UPLOAD_FILES} files allowed per quote.` });
        return;
      }

      if (file.size > MAX_UPLOAD_FILE_SIZE_BYTES) {
        stagedItems.push({ id, name: file.name, format, size, sizeBytes: file.size, status: 'unsupported', validationState: 'invalid', processingComplete: false, progress: 0, message: 'File exceeds 500MB per-file limit.' });
        return;
      }

      if (runningTotalBytes + file.size > MAX_UPLOAD_TOTAL_BYTES) {
        stagedItems.push({ id, name: file.name, format, size, sizeBytes: file.size, status: 'unsupported', validationState: 'invalid', processingComplete: false, progress: 0, message: 'Upload exceeds the 2GB total limit for this quote.' });
        return;
      }

      stagedItems.push({ id, name: file.name, format, size, sizeBytes: file.size, status: 'uploading', validationState: 'pending', processingComplete: false, progress: 0, file, token: crypto.randomUUID() });
      runningCount += 1;
      runningTotalBytes += file.size;
    });

    const firstValid = stagedItems.find((item) => !!item.file);
    if (!primaryUploadIdRef.current && firstValid) primaryUploadIdRef.current = firstValid.id;
    setUploadItems((current) => [...current, ...stagedItems.map(({ file: _file, token: _token, ...item }) => item)]);
    stagedItems.forEach(({ id, file, token }) => {
      if (file && token) {
        activeUploadTokensRef.current[id] = token;
        void processUpload(id, file, token);
      }
    });
    if (inputRef.current) inputRef.current.value = '';
  };

  const confirmDelete = async () => {
    if (!deleteItem) return;
    invalidateQuote();
    const deletedIndex = uploadItems.findIndex((item) => item.id === deleteItem.id);
    const remainingItems = uploadItems.filter((item) => item.id !== deleteItem.id);
    const nextActiveItem = remainingItems.slice(Math.max(0, deletedIndex), remainingItems.length).find(isUploadItemReady)
      || remainingItems.slice(0, Math.max(0, deletedIndex)).reverse().find(isUploadItemReady);
    if (!deleteItem.cadFile) {
      delete activeUploadTokensRef.current[deleteItem.id];
      setUploadItems((items) => items.filter((item) => item.id !== deleteItem.id));
      setFileSetupStates((current) => { const next = { ...current }; delete next[deleteItem.id]; return next; });
      if (selectedSetupId === deleteItem.id) setSelectedSetupId(nextActiveItem?.id || null);
      if (primaryUploadIdRef.current === deleteItem.id) primaryUploadIdRef.current = nextActiveItem?.id || null;
      setDeleteItem(null);
      return;
    }
    setUploadBusy(true);
    setIsDeleting(true);
    delete activeUploadTokensRef.current[deleteItem.id];
    setUploadItems((items) => items.filter((item) => item.id !== deleteItem.id && item.cadFile?.id !== deleteItem.cadFile?.id));
    setFileConfigurations((current) => { const next = { ...current }; if (deleteItem.cadFile) delete next[deleteItem.cadFile.id]; return next; });
    setFileSetupStates((current) => { const next = { ...current }; delete next[deleteItem.id]; return next; });
    if (selectedSetupId === deleteItem.id) setSelectedSetupId(nextActiveItem?.id || null);
    if (primaryUploadIdRef.current === deleteItem.id) primaryUploadIdRef.current = nextActiveItem?.id || null;
    setRequest((current) => current.cadFile?.id === deleteItem.cadFile?.id ? { ...current, cadFile: null, geometry: null } : current);
    setPreviewFile((current) => current?.id === deleteItem.cadFile?.id ? null : current);
    setDeleteItem(null);
    try {
      await ApiService.deleteCadFile(deleteItem.cadFile.id);
    } catch (deleteError) {
      setError(deleteError instanceof Error ? deleteError.message : t('request.deleteFailed'));
    } finally {
      setUploadBusy(false);
      setIsDeleting(false);
    }
  };

  const clearAllUploads = async () => {
    const existingCadIds = uploadItems.flatMap((item) => item.cadFile ? [item.cadFile.id] : []);
    invalidateQuote();
    setUploadBusy(false);
    setUploadItems([]);
    setFileConfigurations({});
    setFileSetupStates({});
    setSelectedSetupId(null);
    setPreviewFile(null);
    setDeleteItem(null);
    primaryUploadIdRef.current = null;
    activeUploadTokensRef.current = {};
    setRequest((current) => ({ ...current, cadFile: null, geometry: null }));
    if (existingCadIds.length) {
      void Promise.allSettled(existingCadIds.map((id) => ApiService.deleteCadFile(id))).then((results) => {
        if (results.some((result) => result.status === 'rejected')) {
          setError('Some files could not be cleared from storage. The upload list has been reset locally.');
        }
      });
    }
  };

  const validate = (): boolean => {
    if (step === 0 && (!request.technology || !request.process)) setError(t('request.chooseTechnologyError'));
    else if (step >= 1 && uploadLifecycleBusyRef.current) setError(t('request.validationFile'));
    else if (step >= 1 && hasBlockingUploadState(uploadItems)) setError(t('request.validationFile'));
    else if (step === 2 && !request.geometry) setError(t('request.inspectFilesError'));
    else if (step === 3 && !request.material) setError(t('request.validationMaterial'));
    else if (step === 4 && (!request.quantity || !request.quality || !request.finish || !request.tolerance)) setError(t('request.validationConfiguration'));
    else if (step === 5 && (!quote || isCalculatingQuote || quoteFailed)) setError('A fresh quote is required before submission.');
    else { setError(''); return true; }
    return false;
  };

  const next = () => {
    if (!validate()) return;
    const now = performance.now();
    if (now - lastNavigationAtRef.current < 300) return;
    lastNavigationAtRef.current = now;
    setStep((current) => {
      if (current !== step) return current;
      return Math.min(current + 1, 6) as Step;
    });
    window.scrollTo({ top: 0, behavior: 'smooth' });
  };
  const back = () => {
    setError('');
    const now = performance.now();
    if (now - lastNavigationAtRef.current < 300) return;
    lastNavigationAtRef.current = now;
    setStep((current) => {
      if (current !== step) return current;
      return Math.max(current - 1, 0) as Step;
    });
  };
  const submit = async () => {
    if (submissionInFlightRef.current || !request.cadFile || !request.process || !request.material || !validate() || !areAllUploadsReady(uploadItems)) return;
    if (!isAuthenticated) {
      setAuthGateOpen(true);
      openAuthModal('login');
      return;
    }
    submissionInFlightRef.current = true;
    setIsSubmitting(true);
    try {
      const savedQuote = await ApiService.createQuote({
        partName: request.cadFile.name,
        technology: request.process.toUpperCase(),
        material: request.material,
        quantity: request.quantity,
        toleranceGrade: request.tolerance,
        surfaceFinish: request.finish,
        cadFileIds: usableUploadItems.flatMap((item) => item.cadFile ? [item.cadFile.id] : []),
        files: usableUploadItems.map((item) => {
          const configuration = fileConfigurations[item.cadFile!.id] || { process: request.process, material: request.material, quantity: request.quantity, finish: request.finish, tolerance: request.tolerance, quality: request.quality, wallCount: request.wallCount };
          const metadata = item.cadFile!.latestVersion?.metadata as any;
          const quality = configuration.quality || request.quality;
          const wallCount = configuration.wallCount ?? request.wallCount;
          return {
            fileId: item.cadFile!.id,
            fileName: item.cadFile!.name,
            format: item.cadFile!.format,
            materialId: configuration.material || request.material,
            technology: (configuration.process || request.process || 'fdm').toUpperCase(),
            surfaceFinish: configuration.finish || request.finish,
            toleranceGrade: configuration.tolerance === 'precision' ? 'precision' : 'standard',
            quantity: configuration.quantity || request.quantity,
            volumeCm3: metadata?.volume,
            surfaceAreaCm2: metadata?.surfaceArea,
            triangleCount: metadata?.triangleCount,
            manufacturingParameters: fdmParametersFor(quality, wallCount, configuration.supportEnabled),
          };
        }),
      });
      if (!savedQuote) throw new Error('We could not save the manufacturing quote. Please request a fresh quotation.');
      const quoteReference = savedQuote.id;
      const order = await ApiService.createOrder({
        partName: request.cadFile.name,
        cadFileIds: uploadItems.flatMap((item) => isUploadItemReady(item) ? [item.cadFile!.id] : []),
        cadFileConfigs: uploadItems.flatMap((item) => { if (!isUploadItemReady(item)) return []; const configuration = fileConfigurations[item.cadFile!.id] || { process: request.process, technology: request.technology, material: request.material, quantity: request.quantity, quality: request.quality, color: request.color, finish: request.finish, tolerance: request.tolerance }; return [{ cadFileId: item.cadFile!.id, configuration, totalCost: quote?.formattedTotalPrice }]; }),
        technology: request.process.toUpperCase(),
        material: request.material,
        quantity: request.quantity,
        totalCost: quote?.formattedTotalPrice || 'Pending quote',
        tolerance: request.tolerance,
        quoteId: quoteReference,
      });
      if (!order) {
        setError('We could not submit this manufacturing request. Please try again.');
        return;
      }
      setRequestReference(`REQ-2026-${Math.floor(1000 + Math.random() * 9000)}`);
      setStep(6);
    } catch (submissionError) {
      setError(submissionError instanceof Error ? submissionError.message : 'We could not submit this manufacturing request. Please try again.');
    } finally {
      submissionInFlightRef.current = false;
      setIsSubmitting(false);
    }
  };

  useEffect(() => {
    if (!isAuthenticated || !authGateOpen) return;
    setAuthGateOpen(false);
    void submit();
  }, [isAuthenticated, authGateOpen]);

  const materialOptions = isCnc ? ['aluminum', 'steel'] : isPrinting && request.process === 'fdm' ? ['pla', 'abs', 'petg', 'tpu'] : isPrinting ? ['pla', 'abs', 'nylon'] : ['steel', 'aluminum'];
  const hasActiveUploads = hasUploadInFlight(uploadItems) || uploadLifecycleBusy;
  const allUploadsReady = areAllUploadsReady(uploadItems);
  const usableUploadItems = uploadItems.filter(isUploadItemReady);
  const explicitlySelectedIds = usableUploadItems.filter((item) => fileSetupStates[item.id]?.selected).map((item) => item.id);
  const materialSelectedIds = materialSelectionInitialized ? explicitlySelectedIds : usableUploadItems.map((item) => item.id);
  const activeMaterialId = selectedSetupId || materialSelectedIds[0] || usableUploadItems[0]?.id || null;
  const activeMaterialItem = activeMaterialId ? usableUploadItems.find((item) => item.id === activeMaterialId) : undefined;
  const activeMaterialConfig = activeMaterialId ? fileConfigurations[activeMaterialItem?.cadFile?.id || activeMaterialId] : undefined;
  const toggleMaterialFile = (id: string) => {
    setSelectedSetupId(id);
    setMaterialSelectionInitialized(true);
    setFileSetupStates((current) => ({ ...current, [id]: { ...(current[id] || { unit: 'mm', selected: false }), selected: !current[id]?.selected } }));
    const item = usableUploadItems.find((candidate) => candidate.id === id);
    const config = fileConfigurations[item?.cadFile?.id || id];
    if (config) updateRequest({ material: config.material, color: config.color });
  };
  const selectAllMaterialFiles = (selected: boolean) => {
    setMaterialSelectionInitialized(true);
    setFileSetupStates((current) => Object.fromEntries(usableUploadItems.map((item) => [item.id, { ...(current[item.id] || { unit: 'mm' }), selected }])));
  };
  const updateMaterialConfiguration = (update: Partial<FileConfiguration>, applyToAll = false) => {
    const targetIds = applyToAll ? materialSelectedIds : activeMaterialId ? [activeMaterialId] : [];
    if (!targetIds.length) return;
    const defaults: FileConfiguration = {
      technology: request.technology,
      process: request.process,
      material: request.material,
      quantity: request.quantity,
      quality: request.quality,
      color: request.color,
      finish: request.finish,
      tolerance: request.tolerance,
    };
    setFileConfigurations((current) => {
      const next = { ...current };
      targetIds.forEach((id) => {
        const item = usableUploadItems.find((candidate) => candidate.id === id);
        const configurationId = item?.cadFile?.id || id;
        next[configurationId] = { ...defaults, ...(current[configurationId] || {}), ...update };
      });
      return next;
    });
    updateRequest({ material: update.material ?? request.material, color: update.color ?? request.color });
  };
  const updateSelectedConfigurations = (update: Partial<FileConfiguration>) => {
    const targetIds = materialSelectedIds.length ? materialSelectedIds : activeMaterialId ? [activeMaterialId] : [];
    if (!targetIds.length) return;
    const defaults: FileConfiguration = {
      technology: request.technology,
      process: request.process,
      material: request.material,
      quantity: request.quantity,
      quality: request.quality,
      color: request.color,
      finish: request.finish,
      tolerance: request.tolerance,
    };
    setFileConfigurations((current) => {
      const next = { ...current };
      targetIds.forEach((id) => {
        const item = usableUploadItems.find((candidate) => candidate.id === id);
        const configurationId = item?.cadFile?.id || id;
        next[configurationId] = { ...defaults, ...(current[configurationId] || {}), ...update };
      });
      return next;
    });
  };
  const configuredUploadCount = usableUploadItems.filter((item) => {
    const config = fileConfigurations[item.cadFile!.id];
    return Boolean(config?.technology && config?.process && config?.material && config?.quantity && config?.quality && config?.finish && config?.tolerance);
  }).length;
  const canContinue = step === 0 ? Boolean(request.technology && request.process) : step === 1 ? allUploadsReady && !uploadLifecycleBusy : step === 2 ? Boolean(request.geometry) && allUploadsReady && !uploadLifecycleBusy : step === 3 ? Boolean(request.material) && allUploadsReady && !uploadLifecycleBusy : step === 4 ? Boolean(request.quantity && request.quality && request.finish && request.tolerance) && allUploadsReady && !uploadLifecycleBusy : step === 5 ? Boolean(quote) && !isCalculatingQuote && !quoteFailed && allUploadsReady && !uploadLifecycleBusy : true;

  const resetUploadsForTechnologyChange = () => {
    if (uploadItems.length > 0) void clearAllUploads();
  };

  return <main className="manufacturing-request-view">
    <div className="container request-shell">
      <div className="request-heading">
        <span className="section-badge request-quote-badge"><Icon name="upload" size={12} /><span>{t('request.instantQuote')}</span></span>
        <h1>{step === 6 ? t('request.created') : t('request.instantQuote')}</h1>
        <p>{step === 6 ? t('request.createdDescription') : t('request.instantQuoteDescription')}</p>
      </div>

      {step < 6 && <>
      <nav className="request-stepper request-stepper-reference" aria-label={t('request.stepsLabel')}>
        {steps.map((stepDefinition, index) => ({ stepDefinition, index })).filter(({ stepDefinition }) => stepDefinition.id !== 'upload').map(({ stepDefinition, index }) => <button type="button" className={`request-step ${index === step ? 'is-current' : index < step ? 'is-complete' : ''}`} key={stepDefinition.id} onClick={() => index < step && setStep(index as Step)} disabled={index > step} aria-current={index === step ? 'step' : undefined} aria-label={`${index + 1}. ${t(`request.steps.${stepDefinition.id}`)}`}>
          <span className="request-step-number">{index < step ? <Icon name="check" size={18} /> : <Icon name={stepDefinition.icon} size={18} />}</span><span>{t(`request.steps.${stepDefinition.id}`)}</span>
        </button>)}
      </nav>
      <div className="request-progress-track" role="progressbar" aria-valuemin={1} aria-valuemax={6} aria-valuenow={step + 1} aria-label={`Step ${step + 1} of 6`}><span style={{ width: `${((step + 1) / steps.length) * 100}%` }} /></div>
      </>}

      {error && <div className="request-alert" role="alert">{error}</div>}
      <section ref={requestPanelRef} className={`request-panel page-enter step-${steps[Math.min(step, steps.length - 1)].id}`} key={step} tabIndex={-1} aria-live="polite">
        {step === 0 && <TechnologyStep selected={request.technology} selectedProcess={request.process} onSelect={(technology) => { if (technology !== request.technology) resetUploadsForTechnologyChange(); updateRequest({ technology, process: null, material: null, cadFile: null, geometry: null }); }} onProcessSelect={(process) => { if (process !== request.process) resetUploadsForTechnologyChange(); updateRequest({ technology: request.technology ?? 'printing', process, material: process === 'fdm' ? 'pla' : null, cadFile: null, geometry: null }); }} t={t} />}
        {step === 1 && <UploadStep items={uploadItems} isDragging={isDragging} onBrowse={() => inputRef.current?.click()} onFiles={addFiles} onDragState={setIsDragging} onPreview={openPreview} onDelete={openDelete} onClearAll={clearAllUploads} t={t} />}
        {step === 2 && <FileSetupStep items={uploadItems} selectedId={selectedSetupId} states={fileSetupStates} configurations={fileConfigurations} request={request} onSelect={selectSetupFile} onToggle={toggleSetupSelection} onToggleAll={toggleAllSetupSelection} onAddFiles={() => inputRef.current?.click()} onDelete={openDelete} onGeometry={(geometry, itemId) => { updateRequest({ geometry }); setFileSetupStates((current) => { const existing = current[itemId]; if (existing?.baseDimensions) return current; const metadata = geometry.metadata; const baseDimensions = metadata?.dimensions ? { x: metadata.dimensions.width, y: metadata.dimensions.height, z: metadata.dimensions.depth } : null; return { ...current, [itemId]: { ...(existing || { unit: 'mm', selected: false }), baseDimensions, dimensions: baseDimensions, volume: metadata?.volume ?? null, surfaceArea: metadata?.surfaceArea ?? null, triangleCount: metadata?.triangleCount ?? null } }; }); }} onSetupChange={(update, itemId) => setFileSetupStates((current) => ({ ...current, [itemId]: { ...(current[itemId] || { unit: 'mm', selected: false, baseDimensions: update.dimensions || null, dimensions: update.dimensions || null, volume: null, surfaceArea: null, triangleCount: null }), ...update } }))} t={t} />}
        {step === 3 && <WorkflowWorkspace items={uploadItems} selectedIds={materialSelectedIds} configurations={fileConfigurations} request={request} quote={quote} isCalculating={isCalculatingQuote} quoteFailed={quoteFailed} activeId={activeMaterialId} onSelectFile={toggleMaterialFile} onSelectAll={selectAllMaterialFiles} onAddFiles={() => inputRef.current?.click()} onPreview={openPreview} onDelete={openDelete} t={t}><MaterialStep options={materialOptions} selected={request.material} selectedColor={activeMaterialConfig?.color || request.color} selectedPartName={activeMaterialItem?.name} selectedTechnology={request.process} selectedCount={materialSelectedIds.length} onSelectMaterial={(material) => updateMaterialConfiguration({ material })} onSelectColor={(color) => updateMaterialConfiguration({ color })} onApplyAll={() => updateMaterialConfiguration({ material: request.material, color: request.color }, true)} t={t} /></WorkflowWorkspace>}
        {step === 4 && <WorkflowWorkspace items={uploadItems} selectedIds={materialSelectedIds} configurations={fileConfigurations} request={request} quote={quote} isCalculating={isCalculatingQuote} quoteFailed={quoteFailed} onSelectFile={toggleMaterialFile} onSelectAll={selectAllMaterialFiles} onAddFiles={() => inputRef.current?.click()} onPreview={openPreview} onDelete={openDelete} t={t}><ConfigurationStep request={request} isPrinting={isPrinting} isCnc={isCnc} update={(value) => {
          updateRequest(value);
          const configurationUpdate: Partial<FileConfiguration> = {};
          if (hasOwn(value, 'quantity')) configurationUpdate.quantity = value.quantity as number;
          if (hasOwn(value, 'quality')) configurationUpdate.quality = value.quality as string;
          if (hasOwn(value, 'color')) configurationUpdate.color = value.color as string;
          if (hasOwn(value, 'finish')) configurationUpdate.finish = value.finish as string;
          if (hasOwn(value, 'tolerance')) configurationUpdate.tolerance = value.tolerance as string;
          if (Object.keys(configurationUpdate).length > 0) updateSelectedConfigurations(configurationUpdate);
        }} onQualityChange={(quality, tolerance, wallCount) => {
          updateRequest({ quality, tolerance, wallCount });
          updateSelectedConfigurations({ quality, tolerance, wallCount });
        }} t={t} /></WorkflowWorkspace>}
        {step === 5 && <WorkflowWorkspace items={uploadItems} selectedIds={materialSelectedIds} configurations={fileConfigurations} request={request} quote={quote} isCalculating={isCalculatingQuote} quoteFailed={quoteFailed} onSelectFile={toggleMaterialFile} onSelectAll={selectAllMaterialFiles} onAddFiles={() => inputRef.current?.click()} onPreview={openPreview} onDelete={openDelete} t={t}><LegacyReviewStep request={request} authGateOpen={authGateOpen} isAuthenticated={isAuthenticated} onSignIn={() => openAuthModal('login')} onRegister={() => openAuthModal('register')} t={t} /><OrderFilesSummary items={uploadItems} onPreview={openPreview} configurations={fileConfigurations} onConfigurationChange={(id, update) => setFileConfigurations((current) => ({ ...current, [id]: { ...(current[id] || { technology: request.technology, process: request.process, material: request.material, quantity: request.quantity, quality: request.quality, color: request.color, finish: request.finish, tolerance: request.tolerance }), ...update } }))} /><QuoteSummary request={request} quote={quote} isCalculating={isCalculatingQuote} quoteFailed={quoteFailed} t={t} /></WorkflowWorkspace>}
        {step === 6 && <SuccessStep files={uploadItems} reference={requestReference} t={t} onDashboard={() => setActiveView('dashboard')} onNew={() => { setRequest(initialState); setUploadItems([]); primaryUploadIdRef.current = null; setRequestReference(''); setStep(0); }} />}
      </section>

      {step < 6 && <div className="request-actions request-nav">
        <button className="btn btn-lg btn-outline request-nav-back" onClick={back} disabled={step === 0}><Icon name="chevronRight" size={14} className="request-nav-arrow-left" /> {t('request.back')}</button>
        <span className="request-config-pill">{step === 2 ? t('request.filesReady', { ready: usableUploadItems.length, total: uploadItems.length }) : step === 3 ? t('request.materialsReady', { ready: request.material ? materialSelectedIds.length : 0, total: usableUploadItems.length }) : t('request.selectedCount', { count: configuredUploadCount })}</span>
        <span className="request-nav-indicator">{t('request.stepIndicator', { step: step + 1, total: steps.length })}</span>
        {step === 5 ? <button className="btn btn-lg btn-primary request-nav-next" onClick={() => void submit()} disabled={isSubmitting || !canContinue}>{isSubmitting ? t('request.submitting') : t('request.submit')}</button> : <button className="btn btn-lg btn-primary request-nav-next" onClick={next} disabled={!canContinue}>{hasActiveUploads ? t('request.uploading') : t('request.next')} <Icon name="arrowRight" size={14} /></button>}
      </div>}
      <input ref={inputRef} hidden type="file" multiple accept=".step,.stp,.stl,.obj,.ply,.dxf,.svg,.pdf,.iges,.igs" onChange={(event) => addFiles(Array.from(event.target.files || []))} />
      {previewFile && <div className="request-modal-backdrop" role="dialog" aria-modal="true" aria-label={t('request.preview')} onMouseDown={(event) => { if (event.target === event.currentTarget) setPreviewFile(null); }}><div ref={modalRef} className="request-preview-modal"><div className="request-modal-header"><div><h2><Icon name="cube" size={19} />{previewFile.name}</h2><p>{t('request.preview')} · {t('request.version')} {previewFile.latestVersion?.version || 1}</p></div><button type="button" className="request-modal-close" aria-label={t('request.close')} onClick={() => setPreviewFile(null)}><Icon name="close" size={19} /></button></div><CadGeometryViewer file={previewFile} onGeometry={() => undefined} /></div></div>}
      {deleteItem && <div className="request-modal-backdrop" role="alertdialog" aria-modal="true" aria-labelledby="delete-cad-title" onMouseDown={(event) => { if (event.target === event.currentTarget && !isDeleting) setDeleteItem(null); }}><div ref={modalRef} className="request-delete-modal"><h2 id="delete-cad-title">{t('request.deleteTitle')}</h2><p>{t('request.deleteDescription')}</p><strong>{deleteItem.name}</strong><div className="request-delete-actions"><button type="button" className="btn btn-outline" disabled={isDeleting} onClick={() => setDeleteItem(null)}>{t('request.cancel')}</button><button type="button" className="btn request-delete-button" disabled={isDeleting} onClick={() => void confirmDelete()}>{isDeleting ? t('request.deleting') : t('request.delete')}</button></div></div></div>}
    </div>
  </main>;
};

const WorkflowWorkspace = ({ children, items, selectedIds, configurations, request, quote, isCalculating, quoteFailed, activeId, onSelectFile, onSelectAll, onAddFiles, onPreview, onDelete, t }: { children: React.ReactNode; items: UploadItem[]; selectedIds: string[]; configurations: Record<string, FileConfiguration>; request: RequestState; quote: QuoteData | null; isCalculating?: boolean; quoteFailed?: boolean; activeId?: string | null; onSelectFile: (id: string) => void; onSelectAll: (selected: boolean) => void; onAddFiles: () => void; onPreview: (file: CadFile) => void; onDelete: (item: UploadItem) => void; t: any }) => {
  const allSelected = items.length > 0 && selectedIds.length === items.length;
  const readiness = items.length ? Math.round((items.filter(isUploadItemReady).length / items.length) * 100) : 0;
  const fallback: FileConfiguration = { technology: request.technology, process: request.process, material: request.material, quantity: request.quantity, quality: request.quality, color: request.color, finish: request.finish, tolerance: request.tolerance };
  return <div className="workflow-workspace">
    <aside className="workflow-order-sidebar" aria-label={t('request.fileNavigator')}>
      <div className="workflow-sidebar-header"><div><span className="file-setup-kicker">{t('request.fileNavigator')}</span><h2>{t('request.yourParts')}</h2><p>{items.length} {items.length === 1 ? t('request.file') : t('request.files')}</p></div><strong>{selectedIds.length}/{items.length}</strong></div>
      <div className="file-setup-readiness"><div><span>{t('request.readiness')}</span><b>{readiness}%</b></div><span className="file-setup-progress"><i style={{ width: `${readiness}%` }} /></span></div>
      <label className="file-setup-select-all"><input type="checkbox" checked={allSelected} onChange={(event) => onSelectAll(event.target.checked)} /> <span>{allSelected ? t('request.deselectAll') : t('request.selectAll')}</span><small>{selectedIds.length} / {items.length}</small></label>
      <div className="workflow-sidebar-list">{items.map((item) => {
        const config = configurations[item.cadFile?.id || item.id] || fallback;
        const isSelected = selectedIds.includes(item.id);
        const isActive = activeId ? activeId === item.id : isSelected;
        const statusLabel = isUploadItemReady(item)
          ? t('request.status.ready')
          : item.status === 'failed' || item.status === 'unsupported'
            ? t('request.unableToProcess')
            : t('request.processing');
        return <div className={`workflow-part-card ${isSelected ? 'is-selected' : ''} ${isActive ? 'is-active' : ''}`} key={item.id}>
          <input type="checkbox" checked={isSelected} onChange={() => onSelectFile(item.id)} aria-label={t('request.selectFile', { name: item.name })} />
          <button type="button" className="workflow-part-main" onClick={() => onSelectFile(item.id)}><span className="file-setup-thumbnail"><Icon name="cube" size={19} /></span><span className="workflow-part-copy"><strong title={item.name}>{item.name}</strong><small>{config.material ? t(`request.material.${config.material}`) : t('request.notSelected')} · {config.color ? t(`request.colorOption.${config.color}`) : t('request.colorOption.any')}</small><small>{config.finish ? t(`request.options.${config.finish}`) : t('request.notSelected')} · {statusLabel}</small></span></button>
          <span className="workflow-part-actions"><button type="button" onClick={() => isUploadItemReady(item) && onPreview(item.cadFile!)} disabled={!isUploadItemReady(item)} aria-label={t('request.previewFile', { name: item.name })}><Icon name="eye" size={15} /></button><button type="button" onClick={() => onDelete(item)} aria-label={t('request.removeFile', { name: item.name })}><Icon name="trash" size={15} /></button></span>
        </div>;
      })}</div>
      {!items.length && <div className="workflow-sidebar-empty"><Icon name="file" size={20} /><span>{t('request.noParts')}</span></div>}
      <div className="workflow-sidebar-total"><span>{t('request.estimatedPrice')}</span><strong><PriceTransition status={isCalculating ? 'calculating' : quoteFailed ? 'error' : quote ? 'ready' : 'idle'} value={quote?.formattedTotalPrice} calculatingLabel={t('request.quote.calculating')} errorLabel={t('request.quote.failed')} /></strong><PriceEstimateNotice /></div>
      <button type="button" className="file-setup-add" onClick={onAddFiles}><Icon name="upload" size={17} /> {t('request.addMoreFiles')}</button>
    </aside>
    <section className="workflow-main-workspace">{children}</section>
  </div>;
};

const TechnologyStep = ({ selected, selectedProcess, onSelect, onProcessSelect, t }: { selected: TechnologyId | null; selectedProcess: ProcessId | null; onSelect: (technology: TechnologyId) => void; onProcessSelect: (process: ProcessId) => void; t: any }) => {
  const technologies = [
    { id: 'printing', label: t('request.technology.printing'), count: t('request.processCount.one'), icon: 'technology' as IconName },
    { id: 'cnc', label: t('request.technology.cnc'), count: t('request.processCount.two'), icon: 'cpu' as IconName },
    { id: 'sheet', label: t('request.technology.sheet'), count: t('request.processCount.one'), icon: 'file' as IconName },
  ] as const;

  const processDescriptions: Record<ProcessId, { title: string; description: string; group: string; badge?: string; icon: IconName }> = {
    fdm: { title: t('request.process.fdmTitle'), description: t('request.processDescription.fdm'), group: t('request.processGroup.plastics'), badge: t('request.instant'), icon: 'layers' },
    sla: { title: t('request.process.slaTitle'), description: t('request.processDescription.sla'), group: t('request.processGroup.resins'), badge: t('request.instant'), icon: 'layers3' },
    sls: { title: t('request.process.slsTitle'), description: t('request.processDescription.sls'), group: t('request.processGroup.plastics'), badge: t('request.instant'), icon: 'layers' },
    milling: { title: t('request.process.millingTitle'), description: t('request.processDescription.milling'), group: t('request.processGroup.metals'), badge: t('request.instant'), icon: 'cpu' },
    turning: { title: t('request.process.turningTitle'), description: t('request.processDescription.turning'), group: t('request.processGroup.metals'), badge: t('request.instant'), icon: 'cpu' },
    sheet: { title: t('request.process.sheetTitle'), description: t('request.processDescription.sheet'), group: t('request.processGroup.plastics'), badge: t('request.instant'), icon: 'file' },
  };

  const effectiveSelected = selected ?? 'printing';
  const activeTechnology = technologies.find((technology) => technology.id === effectiveSelected) ?? technologies[0];
  const activeProcesses = processGroups.find((group) => group.group === effectiveSelected || (effectiveSelected === 'sheet' && group.group === 'sheetMetal'))?.options ?? [];
  const firstActiveProcess = activeProcesses[0];

  return (
    <div className="technology-selector-step">
      <div className="technology-selector-header">
        <div>
          <h2>{t('request.techSelectorTitle')}</h2>
          <p>{t('request.techSelectorDescription')}</p>
        </div>
      </div>

      <div className="technology-selector-layout">
        <div className="technology-column">
          <div className="technology-list-header">
              <span>{t('request.technologies')}</span>
            <small>{t('request.clickToExpand')}</small>
          </div>
          <div className="technology-list">
            {technologies.map((technology) => {
              const isSelected = effectiveSelected === technology.id;
              return (
                <button
                  key={technology.id}
                  type="button"
                  className={`technology-item ${isSelected ? 'is-selected' : ''}`}
                  onClick={() => onSelect(technology.id)}
                >
                  <span className={`technology-item-icon ${isSelected ? 'is-selected' : ''}`}>
                    <Icon name={isSelected ? 'check' : technology.icon} size={18} />
                  </span>
                  <div className="technology-item-copy">
                    <strong>{technology.label}</strong>
                    <small>{technology.count}</small>
                  </div>
                  <span className="technology-item-chevron">
                    <Icon name={isSelected ? 'chevronDown' : 'chevronRight'} size={16} />
                  </span>
                </button>
              );
            })}
          </div>
        </div>

        <div className="process-column">
          <div className="process-list-header">
            <span>{t('request.processes')}</span>
            {!selectedProcess && <small className="process-instruction">{t('request.selectProcessInstruction')}</small>}
          </div>

          <div className="process-group-panel">
            {activeProcesses.length > 0 && firstActiveProcess && (
              <>
                <div className="process-group-heading">
                  <span className="process-group-dot" />
                  <span>{processDescriptions[firstActiveProcess].group}</span>
                </div>
                <div className="process-divider" />
                <div className="process-list">
                  {activeProcesses.map((process) => {
                    const config = processDescriptions[process];
                    const isSelected = selectedProcess === process;
                    return (
                      <button
                        key={process}
                        type="button"
                        className={`process-item ${isSelected ? 'is-selected' : ''}`}
                        onClick={() => onProcessSelect(process)}
                      >
                        <span className="process-icon-wrap">
                          <Icon name={config.icon} size={18} />
                        </span>
                        <span className="process-copy">
                          <span className="process-title-row">
                            <strong>{config.title}</strong>
                            {config.badge && <span className="instant-badge">{config.badge}</span>}
                            <Icon name="chevronRight" size={14} className="process-row-chevron" />
                          </span>
                          <small>{config.description}</small>
                        </span>
                      </button>
                    );
                  })}
                </div>
              </>
            )}
          </div>
        </div>
      </div>

      {!selected && (
        <div className="technology-selector-empty-state">
          <span className="selection-icon muted"><Icon name="technology" size={18} /></span>
          <div>
            <strong>{activeTechnology.label}</strong>
            <small>{activeTechnology.count}</small>
          </div>
        </div>
      )}
    </div>
  );
};

const UploadStep = ({ items, isDragging, onBrowse, onFiles, onDragState, onPreview, onDelete, onClearAll, t }: { items: UploadItem[]; isDragging: boolean; onBrowse: () => void; onFiles: (files: File[]) => void; onDragState: (active: boolean) => void; onPreview: (file: CadFile) => void; onDelete: (item: UploadItem) => void; onClearAll: () => void; t: any }) => {
  const getPropertiesCount = (item: UploadItem): number | null => {
    const metadata = item.cadFile?.latestVersion?.metadata;
    if (!metadata) return null;
    const values = Object.values(metadata).filter((value) => value !== null && value !== undefined);
    if (!values.length) return null;
    return values.length;
  };

  const getVisualState = (status: UploadItemStatus): 'uploading' | 'analyzing' | 'ready' | 'error' => {
    if (status === 'uploading') return 'uploading';
    if (status === 'scanning' || status === 'processing') return 'analyzing';
    if (status === 'ready' || status === 'duplicate') return 'ready';
    return 'error';
  };

  const readyCount = items.filter(isUploadItemReady).length;
  const usedBytes = items.filter((item) => item.status !== 'unsupported').reduce((sum, item) => sum + item.sizeBytes, 0);
  const usedMb = (usedBytes / (1024 * 1024)).toFixed(1);

  return <>
  <div className="request-title-row request-title-row-upload"><div><h2><Icon name="upload" size={18} />{t('request.uploadDesign')}</h2><p>{t('request.uploadDesignDescription')} <span className="request-instruction-highlight">{t('request.uploadTechnologyDescription')}</span> ({t('request.supported')})</p></div><span className="request-status">{items.length ? t('request.fileCount', { count: items.length }) : t('request.status.empty')}</span></div>
  <div
    className={`upload-zone ${isDragging ? 'is-dragging' : ''}`}
    role="button"
    tabIndex={0}
    aria-label={t('request.uploadFilesLabel')}
    onClick={onBrowse}
    onKeyDown={(event) => {
      if (event.key === 'Enter' || event.key === ' ') {
        event.preventDefault();
        onBrowse();
      }
    }}
    onDragEnter={(event: DragEvent) => { event.preventDefault(); onDragState(true); }}
    onDragOver={(event: DragEvent) => { event.preventDefault(); onDragState(true); }}
    onDragLeave={(event: DragEvent) => { if (!event.currentTarget.contains(event.relatedTarget as Node | null)) onDragState(false); }}
    onDrop={(event: DragEvent) => { event.preventDefault(); onDragState(false); onFiles(Array.from(event.dataTransfer.files)); }}
  >
    <span className="upload-symbol"><Icon name="upload" size={24} /></span>
    <h3>{isDragging ? t('request.dropFiles') : t('request.dragFiles')}</h3>
    <p>{t('request.browseMultiple')}</p>
    <small>{t('request.uploadLimits')}</small>
  </div>
  {items.length > 0 && <section className="uploaded-files-panel" aria-label={t('request.cadFiles')}>
    <header className="uploaded-files-header">
      <div className="uploaded-files-title-wrap"><h3>{t('request.uploadedFiles')}</h3><span className="uploaded-files-count">{t('request.filesReady', { ready: readyCount, total: items.length })}</span></div>
      <button className="uploaded-files-clear" onClick={() => void onClearAll()} aria-label={t('request.clearAll')}><Icon name="trash" size={16} />{t('request.clearAll')}</button>
    </header>
    <div className="uploaded-files-usage">{t('request.filesUsed', { count: items.length, used: usedMb })}</div>
    <div className="uploaded-files-divider" />
    <div className="cad-upload-list">
      {items.map((item) => {
        const visualState = getVisualState(item.status);
        const isReady = isUploadItemReady(item);
        const propertiesCount = isReady ? getPropertiesCount(item) : null;
        const statusLabel = visualState === 'uploading' ? t('request.status.uploading') : visualState === 'analyzing' ? t('request.status.processing') : visualState === 'ready' ? t('request.status.ready') : t(`request.queue.${item.status}`);

        return <article className={`cad-upload-card status-${visualState}`} key={item.id}>
          <div className="cad-upload-left">
            <span className="cad-file-icon" aria-hidden="true"><Icon name="cube" size={24} /></span>
            <div className="cad-upload-meta">
              <strong title={item.name}>{item.name}</strong>
              <span>{item.size}{isReady && propertiesCount !== null ? ` • ${t('request.properties', { count: propertiesCount })}` : ''}</span>
              {visualState === 'uploading' && <div className="cad-upload-progress-wrap"><div className="cad-upload-progress" aria-label={`${item.progress}% uploaded`}><span style={{ width: `${item.progress}%` }} /></div><em>{Math.max(0, Math.min(100, Math.round(item.progress)))}%</em></div>}
              {visualState === 'error' && item.message && <span className="cad-upload-message">{item.message}</span>}
            </div>
          </div>
          <div className="cad-upload-right">
            <span className={`cad-state-badge is-${visualState}`}><span className="cad-state-icon">{visualState === 'uploading' ? <Icon name="upload" size={14} /> : visualState === 'analyzing' ? <Icon name="loader" size={14} /> : visualState === 'ready' ? <Icon name="check" size={14} /> : <Icon name="alert" size={14} />}</span>{statusLabel}</span>
            {isReady && <button className="cad-icon-button" onClick={() => onPreview(item.cadFile!)} aria-label={t('request.previewFile', { name: item.name })}><Icon name="eye" size={20} /></button>}
            <button className="cad-icon-button is-remove" onClick={() => onDelete(item)} aria-label={t('request.removeFile', { name: item.name })}><Icon name="close" size={20} /></button>
          </div>
        </article>;
      })}
    </div>
  </section>}
</>;
};

const FileSetupStep = ({ items, selectedId, states, configurations, request, onSelect, onToggle, onToggleAll, onAddFiles, onDelete, onGeometry, onSetupChange, t }: { items: UploadItem[]; selectedId: string | null; states: Record<string, FileSetupState>; configurations: Record<string, FileConfiguration>; request: RequestState; onSelect: (id: string) => void; onToggle: (id: string) => void; onToggleAll: (selected: boolean) => void; onAddFiles: () => void; onDelete: (item: UploadItem) => void; onGeometry: (geometry: CadGeometryData, itemId: string) => void; onSetupChange: (update: Partial<FileSetupState>, itemId: string) => void; t: any }) => {
  const readyItems = items.filter(isUploadItemReady);
  const selectedItem = items.find((item) => item.id === selectedId) || readyItems[0];
  const selectedState = selectedItem ? states[selectedItem.id] : undefined;
  const selectableItems = readyItems;
  const selectedCount = selectableItems.filter((item) => states[item.id]?.selected).length;
  const allSelected = selectableItems.length > 0 && selectedCount === selectableItems.length;
  const readyPercent = items.length ? Math.round((readyItems.length / items.length) * 100) : 0;

  useEffect(() => {
    if (!selectedId && readyItems[0]) onSelect(readyItems[0].id);
  }, [selectedId, readyItems]);

  return <div className="file-setup-workspace">
    <aside className="file-setup-sidebar" aria-label={t('request.fileNavigator')}>
      <div className="file-setup-sidebar-header"><div><span className="file-setup-kicker">{t('request.fileNavigator')}</span><h2>{t('request.yourParts')}</h2><p>{items.length} {items.length === 1 ? t('request.file') : t('request.files')}</p></div><strong className={readyItems.length === items.length && items.length > 0 ? 'is-ready' : ''}>{readyItems.length}/{items.length}</strong></div>
      <div className="file-setup-readiness"><div><span>{t('request.readiness')}</span><b>{readyPercent}%</b></div><span className="file-setup-progress"><i style={{ width: `${readyPercent}%` }} /></span></div>
      <label className="file-setup-select-all"><input type="checkbox" checked={allSelected} ref={(input) => { if (input) input.indeterminate = selectedCount > 0 && !allSelected; }} onChange={(event) => onToggleAll(event.target.checked)} /> <span>{t('request.selectAll')}</span><small>{t('request.selectedCount', { count: selectedCount })}</small></label>
      <div className="file-setup-list">
        {items.map((item) => { const isReady = readyItems.some((ready) => ready.id === item.id); const isSelected = item.id === selectedItem?.id; const setupSelected = states[item.id]?.selected ?? false; const config = configurations[item.cadFile?.id || item.id]; const material = config?.material || request.material; const color = config?.color || request.color; return <article key={item.id} className={`file-setup-item ${isSelected ? 'is-current' : ''} ${setupSelected ? 'is-checked' : ''}`}>
          <input type="checkbox" checked={setupSelected} onChange={() => onToggle(item.id)} aria-label={`Select ${item.name}`} />
          <div className={`file-setup-item-main ${!isReady ? 'is-disabled' : ''}`} role="button" tabIndex={isReady ? 0 : -1} onClick={() => isReady && onSelect(item.id)} onKeyDown={(event) => { if (isReady && (event.key === 'Enter' || event.key === ' ')) { event.preventDefault(); onSelect(item.id); } }} aria-current={isSelected ? 'true' : undefined}>
            <span className="file-setup-thumbnail" aria-hidden="true">{isReady && item.cadFile ? <CadGeometryViewer file={item.cadFile} thumbnail onGeometry={() => undefined} /> : <Icon name="loader" size={19} />}</span><span className="file-setup-item-copy"><strong title={item.name}>{item.name}</strong><small>{item.format} · {material ? t(`request.material.${material}`) : t('request.notSelected')} · {color ? t(`request.colorOption.${color}`) : t('request.colorOption.any')}</small><small>{isReady ? t('request.status.ready') : item.status === 'failed' || item.status === 'unsupported' ? t('request.unableToProcess') : t('request.processing')}</small></span><span className={`file-setup-status ${isReady ? 'is-ready' : item.status === 'failed' || item.status === 'unsupported' ? 'is-error' : 'is-loading'}`} aria-label={isReady ? t('request.status.ready') : t('request.processing')}>{isReady ? <Icon name="check" size={13} /> : <Icon name="loader" size={13} />}</span>
          </div><button type="button" className="file-setup-remove" onClick={() => onDelete(item)} aria-label={t('request.removeFile', { name: item.name })} title={t('request.remove')}><Icon name="trash" size={15} /></button>
        </article>; })}
        {!items.length && <div className="file-setup-empty-list"><Icon name="file" size={20} /><span>{t('request.noParts')}</span></div>}
      </div>
      <button type="button" className="file-setup-add" onClick={onAddFiles}><Icon name="upload" size={17} /> {t('request.addMoreFiles')}</button>
    </aside>
    <section className="file-setup-detail">
      <div className="file-setup-detail-header"><div><span className="file-setup-kicker">{t('request.stepOf', { step: 3, total: 6 })}</span><h2>{t('request.fileSetupTitle')}</h2><p>{selectedItem ? <>{t('request.viewing', { name: '' }).replace(': ', ': ')}<strong title={selectedItem.name}>{selectedItem.name}</strong></> : t('request.selectPartDescription')}</p></div>{selectedItem && <span className="file-setup-format-badge">{selectedItem.format}</span>}</div>
      {selectedItem?.cadFile ? <CadGeometryViewer file={selectedItem.cadFile} setup={selectedState} onSetupChange={(update) => onSetupChange(update, selectedItem.id)} onGeometry={(geometry) => onGeometry(geometry, selectedItem.id)} /> : <div className="file-setup-no-selection"><Icon name="file" size={28} /><h3>{t('request.noPartSelected')}</h3><p>{t('request.selectReadyPart')}</p></div>}
    </section>
  </div>;
};

/**
 * Enhanced QuoteSummary component that supports both single-file and multi-file quotations
 * NEW (Phase 04): Displays detailed cost breakdown for multi-file orders
 */
const QuoteSummary = ({ request, quote, isCalculating, quoteFailed, t }: { request: RequestState; quote: QuoteData | null; isCalculating: boolean; quoteFailed?: boolean; t: any }) => {
  // Check if this is a multi-file quotation (has 'files' array) or single-file (has 'formattedTotalPrice')
  const multiFileQuote = isMultiFileQuote(quote) ? quote : null;
  const priceStatus: PriceStatus = isCalculating ? 'calculating' : quoteFailed ? 'error' : quote ? 'ready' : 'idle';
  
  if (multiFileQuote) {
    // Multi-file quotation with breakdown
    return <aside className={`quote-inline ${isCalculating ? 'is-calculating' : ''}`} aria-live="polite">
      <div className="quote-inline-heading">
        <div>
          <span>{isCalculating && !quote ? t('request.quote.calculating') : quoteFailed ? t('request.quote.failed') : quote ? t('request.quote.ready') : t('request.quote.unavailable')}</span>
          <small>{isCalculating && !quote ? t('request.quote.checking') : t('request.quote.engine')}</small>
        </div>
        <div className="quote-price-value"><strong><PriceTransition status={priceStatus} value={quote?.formattedTotalPrice} calculatingLabel={t('request.quote.calculating')} errorLabel={t('request.quote.failed')} size="lg" /></strong><PriceEstimateNotice /></div>
      </div>
      
      {/* Per-file breakdown for multi-file quotations */}
      {multiFileQuote.files.length > 0 && (
        <div className="quote-files-breakdown">
          <details open>
            <summary>{t('request.quote.fileBreakdown') || 'Cost Breakdown'} ({multiFileQuote.files.length} files)</summary>
            <div className="quote-files-list">
              {multiFileQuote.files.map((file, idx: number) => (
                <div key={file.fileId} className="quote-file-item">
                  <div className="quote-file-info">
                    <span className="quote-file-number">{idx + 1}</span>
                    <div>
                      <strong title={file.fileName}>{file.fileName}</strong>
                      <small>{file.material} · {file.quantity}x</small>
                    </div>
                  </div>
                  <div className="quote-file-price">
                    <div className="quote-price-value"><span>{file.quantity > 1 ? `${file.perUnitCost.toFixed(2)} EGP × ${file.quantity}` : `${file.perUnitCost.toFixed(2)} EGP`}</span><PriceEstimateNotice /></div>
                    {file.quantityDiscount > 0 && <div className="quote-price-value"><small>-{file.quantityDiscount.toFixed(2)} EGP</small><PriceEstimateNotice /></div>}
                    <div className="quote-price-value"><strong>{file.discountedSubtotal.toFixed(2)} EGP</strong><PriceEstimateNotice /></div>
                  </div>
                </div>
              ))}
            </div>
          </details>
        </div>
      )}
      
      {/* Cost summary for multi-file quotations */}
      {quote && (
        <div className="quote-summary-details">
          <div className="quote-cost-breakdown">
            <div className="quote-cost-row">
              <span>{t('request.quote.manufacturing') || 'Manufacturing'}</span>
              <div className="quote-price-value"><strong>{multiFileQuote.manufacturingSubtotal?.toFixed(2) || '0.00'} EGP</strong><PriceEstimateNotice /></div>
            </div>
            {multiFileQuote.quantityDiscountSavings > 0 && (
              <div className="quote-cost-row is-discount">
                <span>{t('request.quote.quantityDiscount') || 'Quantity Discount'}</span>
                <div className="quote-price-value"><strong>-{multiFileQuote.quantityDiscountSavings.toFixed(2)} EGP</strong><PriceEstimateNotice /></div>
              </div>
            )}
            <div className="quote-cost-row is-total">
              <span>{t('request.quote.totalPrice') || 'Total'}</span>
              <div className="quote-price-value"><strong>{multiFileQuote.totalCustomerPrice ? `${multiFileQuote.totalCustomerPrice.toFixed(2)} EGP` : multiFileQuote.formattedTotalPrice || '—'}</strong><PriceEstimateNotice /></div>
            </div>
          </div>
          
          {/* Validity info */}
          {multiFileQuote.expiresAt && (
            <small className="quote-validity">
              {t('request.quote.validUntil') || 'Valid until'} {new Date(multiFileQuote.expiresAt).toLocaleDateString()}
            </small>
          )}
          
          <span><b>{t('request.quote.production')}</b>{quote.leadTime || t('request.pending')}</span>
        </div>
      )}
    </aside>;
  }
  
  // Legacy single-file quotation display
  return <aside className={`quote-inline ${isCalculating ? 'is-calculating' : ''}`} aria-live="polite">
    <div className="quote-inline-heading">
      <div>
        <span>{isCalculating && !quote ? t('request.quote.calculating') : quoteFailed ? t('request.quote.failed') : quote ? t('request.quote.ready') : t('request.quote.unavailable')}</span>
        <small>{isCalculating && !quote ? t('request.quote.checking') : t('request.quote.engine')}</small>
      </div>
      <div className="quote-price-value"><strong><PriceTransition status={priceStatus} value={quote?.formattedTotalPrice} calculatingLabel={t('request.quote.calculating')} errorLabel={t('request.quote.failed')} size="lg" /></strong><PriceEstimateNotice /></div>
    </div>
    <div className="quote-summary-details">
      <span><b>{t('request.materialLabel')}</b>{request.material ? t(`request.material.${request.material}`) : t('request.notSelected')}</span>
      <span><b>{t('request.quantity')}</b>{request.quantity} {t('request.units')}</span>
      <span><b>{t('request.configurationTitle')}</b>{t(`request.options.${request.quality}`)} · {t(`request.options.${request.finish}`)}</span>
      <span><b>{t('request.quote.production')}</b>{quote?.leadTime || t('request.pending')}</span>
      <span><b>{t('request.quote.delivery')}</b>{t('request.quote.afterDispatch')}</span>
    </div>
  </aside>;
};

const MATERIAL_IMAGES: Record<string, string> = {
  pla: 'https://makersgate1.s3.amazonaws.com/materials/images/pla_GfL9oIw.png',
  abs: 'https://makersgate1.s3.amazonaws.com/materials/images/abs_5USM7mw.png',
  petg: 'https://makersgate1.s3.amazonaws.com/materials/images/petg_adskWZ2.png',
  tpu: 'https://makersgate1.s3.amazonaws.com/materials/images/tpu3.png',
};

const MATERIAL_DENSITIES: Record<string, number> = { pla: 1.24, abs: 1.04, petg: 1.27, tpu: 1.2 };
const MATERIAL_RATIOS: Record<string, string> = { pla: '1X', abs: '1.3X', petg: '1.3X', tpu: '2.5X' };

const MaterialStep = ({ options, selected, selectedColor, selectedPartName, selectedTechnology, selectedCount, onSelectMaterial, onSelectColor, onApplyAll, t }: { options: string[]; selected: string | null; selectedColor: string; selectedPartName?: string; selectedTechnology: string | null; selectedCount: number; onSelectMaterial: (material: string) => void; onSelectColor: (color: string) => void; onApplyAll: () => void; t: any }) => {
  const selectedRecord = MATERIALS_DATA.find((material) => material.name.toLowerCase().includes((selected || '').toLowerCase())) || MATERIALS_DATA.find((material) => material.technology === 'FDM');
  const colors = ['any', 'black', 'white', 'red', 'blue', 'green', 'yellow', 'orange', 'purple', 'gray'];
  const materialLabel = (material: string) => t(`request.material.${material}`);
  const colorLabel = (color: string) => t(`request.colorOption.${color}`);
  return <div className="material-main">
      <div className="material-context"><div><span className="file-setup-kicker">{t('request.stepOf', { step: 4, total: 6 })}</span><h2>{selectedPartName || t('request.yourParts')}</h2><p>{selectedTechnology ? t(`request.process.${selectedTechnology}`) : t('request.materialBulkHint')}</p></div><button type="button" className="btn btn-outline" onClick={onApplyAll} disabled={!selected || selectedCount < 2}>{t('request.applyToAll', { count: selectedCount })}</button></div>
      <div className="material-title"><span className="request-current-icon"><Icon name="layers3" size={22} /></span><div><h2>{t('request.materialTitle')}</h2><p>{t('request.materialFdmDescription')}</p></div></div>
      <div className="material-config-layout"><div className="material-options"><div className="material-option-list">{options.map((material) => <button type="button" key={material} className={`material-option-card ${selected === material ? 'is-selected' : ''}`} onClick={() => onSelectMaterial(material)}><img className="material-option-image" src={MATERIAL_IMAGES[material]} alt={materialLabel(material)} /><span><strong>{materialLabel(material)}</strong><small>{t(`request.materialDescription.${material}`)}</small><em>{material === 'pla' && <span className="material-default-badge"><Icon name="check" size={13} /> {t('request.default')}</span>}<b>{MATERIAL_RATIOS[material] || '1X'}</b></em></span>{selected === material && <Icon name="check" size={18} />}</button>)}</div></div>
        <div className="material-details"><article className="material-detail-card"><h3>{t('request.color')}</h3><div className="material-color-row">{colors.map((color) => <button type="button" key={color} className={`material-color ${selectedColor === color ? 'is-selected' : ''}`} onClick={() => onSelectColor(color)} aria-label={colorLabel(color)}><span className={`color-dot color-dot-${color}`}>{selectedColor === color && <Icon name="check" size={12} />}</span><small>{colorLabel(color)}</small></button>)}</div></article><article className="material-detail-card"><h3><Icon name="cube" size={17} /> {t('request.materialPropertiesTitle')}</h3><dl><div><dt>{t('request.density')}</dt><dd>{selected && MATERIAL_DENSITIES[selected] ? `${MATERIAL_DENSITIES[selected].toFixed(4)} g/cm³` : selectedRecord?.density ? `${selectedRecord.density.toFixed(4)} g/cm³` : '—'}</dd></div><div><dt>{t('request.priceRatio')}</dt><dd>{MATERIAL_RATIOS[selected || 'pla'] || '1X'}</dd></div></dl></article></div></div>
      <div className="material-summary"><Icon name="check" size={17} /><strong>{materialLabel(selected || 'pla')}</strong><span className={`color-dot color-dot-${selectedColor}`} />{colorLabel(selectedColor)}<span>{t('request.options.standard')}</span></div>
    </div>;
};

const ConfigurationStep = ({ request, isPrinting, isCnc, update, onQualityChange, t }: { request: RequestState; isPrinting: boolean; isCnc: boolean; update: (value: Partial<RequestState>) => void; onQualityChange: (quality: string, tolerance: string, wallCount: number) => void; t: any }) => {
  const [activeTab, setActiveTab] = useState<'basic' | 'advanced'>('basic');
  const profiles = [
    { id: 'lightweight', quality: 'sparse', tolerance: 'standard', wallCount: 2, meta: '10.00% infill · 2 wall', description: t('request.configProfiles.lightweightDescription') },
    { id: 'standard', quality: 'standard', tolerance: 'standard', wallCount: 3, meta: '15.00% infill · 3 wall', description: t('request.configProfiles.standardDescription'), recommended: true },
    { id: 'strong', quality: 'high', tolerance: 'precision', wallCount: 5, meta: '30.00% infill · 5 wall', description: t('request.configProfiles.strongDescription') },
    { id: 'solid', quality: 'premium', tolerance: 'precision', wallCount: 5, meta: '100.00% infill · 5 wall', description: t('request.configProfiles.solidDescription') },
  ];
  const selectedProfile = profiles.find((profile) => profile.quality === request.quality && profile.tolerance === request.tolerance && profile.wallCount === request.wallCount) || profiles.find((profile) => profile.quality === request.quality && profile.tolerance === request.tolerance) || profiles[1];
  const selectProfile = (profile: typeof profiles[number]) => onQualityChange(profile.quality, profile.tolerance, profile.wallCount);

  return <div className="config-reference">
    <div className="config-reference-tabs" role="tablist" aria-label={t('request.configurationTitle')}>
      <button type="button" role="tab" aria-selected={activeTab === 'basic'} className={activeTab === 'basic' ? 'is-active' : ''} onClick={() => setActiveTab('basic')}>{t('request.configBasic')}</button>
      <button type="button" role="tab" aria-selected={activeTab === 'advanced'} className={activeTab === 'advanced' ? 'is-active' : ''} onClick={() => setActiveTab('advanced')}><Icon name="configure" size={17} />{t('request.configAdvanced')}</button>
    </div>
    {activeTab === 'basic' && isPrinting && <section className="config-profile-panel" aria-labelledby="config-profile-title">
      <header className="config-panel-heading"><h2 id="config-profile-title"><Icon name="configure" size={19} />{t('request.configPrintProfile')}</h2><span>{t('request.configRecommended')}</span></header>
      <div className="config-profile-list">{profiles.map((profile) => <button type="button" key={profile.id} className={`config-profile-card ${selectedProfile.id === profile.id ? 'is-selected' : ''}`} onClick={() => selectProfile(profile)}>
        <span className="config-profile-copy"><strong>{t(`request.configProfiles.${profile.id}`)}</strong><small>{profile.meta}</small><em>{profile.description}</em></span>
        {profile.recommended && <span className="config-default-badge">{t('request.configDefault')} <Icon name="check" size={14} /></span>}
        {selectedProfile.id === profile.id && <Icon name="check" size={19} className="config-profile-check" />}
      </button>)}</div>
    </section>}
    {activeTab === 'advanced' && <section className="config-advanced-panel" aria-label={t('request.configAdvanced')}>
      {isPrinting ? <>
        <InfillOptions value={request.quality} onChange={(quality) => update({ quality })} label={t('request.infill')} />
        <WallCountSelect value={request.wallCount} onChange={(wallCount) => update({ wallCount })} />
      </> : <>
        <Choice label={t('request.quality')} value={request.tolerance} options={['standard', 'precision']} onChange={(value) => update({ tolerance: value })} t={t} required />
        <Choice label={t('request.color')} value={request.color} options={isCnc ? ['natural', 'black', 'silver'] : ['any', 'white', 'black', 'blue']} onChange={(color) => update({ color })} t={t} swatches />
        <Choice label={t('request.surfaceFinish')} value={request.finish} options={['standard', 'smooth']} onChange={(finish) => update({ finish })} t={t} required />
        <label className="config-quantity-field">{t('request.quantity')}<RequiredMark /><div className="quantity-input"><button type="button" onClick={() => update({ quantity: Math.max(1, request.quantity - 1) })}>−</button><input type="number" min="1" value={request.quantity} onChange={(event) => update({ quantity: Math.max(1, Number(event.target.value)) })} required aria-required="true" /><button type="button" onClick={() => update({ quantity: request.quantity + 1 })}>+</button></div></label>
      </>}
    </section>}
    {activeTab === 'basic' && !isPrinting && <section className="config-advanced-panel"><Choice label={t('request.quality')} value={request.quality} options={['standard', 'high', 'premium']} onChange={(quality) => update({ quality })} t={t} required /><Choice label={t('request.color')} value={request.color} options={isCnc ? ['natural', 'black', 'silver'] : ['any', 'white', 'black', 'blue']} onChange={(color) => update({ color })} t={t} swatches /><Choice label={t('request.surfaceFinish')} value={request.finish} options={['standard', 'smooth']} onChange={(finish) => update({ finish })} t={t} required /></section>}
    <div className="config-selection-summary"><Icon name="check" size={17} /><strong>{request.material ? t(`request.material.${request.material}`) : t('request.notSelected')}</strong><span>{t(`request.options.${request.color}`)}</span><span>{t(`request.options.${request.finish}`)}</span></div>
  </div>;
};

const Choice = ({ label, value, options, onChange, t, swatches = false, required = false }: { label: string; value: string; options: string[]; onChange: (value: string) => void; t: any; swatches?: boolean; required?: boolean }) => <fieldset className="choice-field"><legend>{label}{required ? <RequiredMark /> : <OptionalMark />}</legend><div className={swatches ? 'color-choices' : 'choice-options'}>{options.map((option) => <button key={option} type="button" className={`${value === option ? 'is-selected' : ''} ${swatches ? `color-${option}` : ''}`} onClick={() => onChange(option)}>{swatches && <span />}{t(`request.options.${option}`)}</button>)}</div></fieldset>;

const InfillOptions = ({ label, value, onChange }: { label: string; value: string; onChange: (value: string) => void }) => <fieldset className="choice-field infill-field">
  <legend>{label}<RequiredMark /></legend>
  <div className="infill-options" role="radiogroup" aria-label={label}>
    {INFILL_OPTIONS.map((option) => {
      const isSelected = value === option.id;
      return <button type="button" key={option.id} role="radio" aria-checked={isSelected} className={`infill-option ${isSelected ? 'is-selected' : ''}`} onClick={() => onChange(option.id)}>
        <span className="infill-option-copy"><strong>{option.title}</strong>{option.description && <small>{option.description}</small>}</span>
        <span className="infill-option-mark">{isSelected && <Icon name="check" size={16} />}</span>
      </button>;
    })}
  </div>
</fieldset>;

const WallCountSelect = ({ value, onChange }: { value: number; onChange: (walls: number) => void }) => {
  const [isOpen, setIsOpen] = useState(false);
  const containerRef = useRef<HTMLDivElement>(null);
  const selected = WALL_OPTIONS.find((option) => option.walls === value) || WALL_OPTIONS[2];

  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (containerRef.current && !containerRef.current.contains(event.target as Node)) setIsOpen(false);
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  return <div className="choice-field wall-count-field" ref={containerRef}>
    <span className="wall-count-legend"><Icon name="layers3" size={17} />Wall Count</span>
    <div className="wall-count-dropdown">
      <button type="button" className={`wall-count-trigger ${isOpen ? 'is-open' : ''}`} onClick={() => setIsOpen((open) => !open)} aria-haspopup="listbox" aria-expanded={isOpen}>
        <span>{selected.title}</span>
        <Icon name="chevronDown" size={16} />
      </button>
      {isOpen && <ul className="wall-count-options" role="listbox">
        {WALL_OPTIONS.map((option) => {
          const isSelected = option.walls === value;
          return <li key={option.walls} role="presentation"><button type="button" role="option" aria-selected={isSelected} className={`wall-count-option ${isSelected ? 'is-selected' : ''}`} onClick={() => { onChange(option.walls); setIsOpen(false); }}>
            <span>{option.title}</span>
            {isSelected && <Icon name="check" size={15} />}
          </button></li>;
        })}
      </ul>}
    </div>
  </div>;
};

const LegacyReviewStep = ({ request, authGateOpen, isAuthenticated, onSignIn, onRegister, t }: { request: RequestState; authGateOpen: boolean; isAuthenticated: boolean; onSignIn: () => void; onRegister: () => void; t: any }) => { const geometry = request.geometry?.metadata; return <><div className="request-title-row"><div><h2>{t('request.reviewTitle')}</h2><p>{t('request.reviewDescription')}</p></div></div><div className="review-grid"><ReviewBlock title={t('request.cadInformation')} rows={[[t('request.fileName'), request.cadFile?.name], [t('request.fileFormat'), request.cadFile?.format], [t('request.fileStatus'), geometry?.geometryStatus === 'READY' ? t('geometry.ready') : t('geometry.notAvailable')]]} />{geometry?.geometryStatus === 'READY' && <ReviewBlock title={t('geometry.dimensions')} rows={[[t('geometry.width'), geometry.dimensions?.width?.toString()], [t('geometry.height'), geometry.dimensions?.height?.toString()], [t('geometry.depth'), geometry.dimensions?.depth?.toString()], [t('geometry.triangleCount'), geometry.triangleCount?.toString()]]} />}<ReviewBlock title={t('request.manufacturing')} rows={[[t('request.processLabel'), request.process ? t(`request.process.${request.process}`) : ''], [t('request.materialLabel'), request.material ? t(`request.material.${request.material}`) : '']]} /><ReviewBlock title={t('request.configurationTitle')} rows={[[t('request.quantity'), String(request.quantity)], [t('request.quality'), t(`request.options.${request.quality}`)], [t('request.color'), t(`request.options.${request.color}`)], [t('request.surfaceFinish'), t(`request.options.${request.finish}`)], [t('request.tolerance'), t(`request.options.${request.tolerance}`)]]} /><ReviewBlock title={t('request.estimatedInformation')} rows={[[t('request.productionTime'), t('request.pendingCalculation')], [t('request.estimatedPrice'), t('request.analysisRequired')], [t('request.quoteStatus'), t('request.pendingCalculation')]]} muted /></div>{authGateOpen && !isAuthenticated && <aside className="request-auth-gate"><div><span className="selection-icon">▣</span><h3>{t('request.authGateTitle')}</h3><p>{t('request.authGateDescription')}</p></div><div className="request-auth-actions"><button className="btn btn-outline" onClick={onSignIn}>{t('request.authSignIn')}</button><button className="btn btn-primary" onClick={onRegister}>{t('request.authRegister')}</button></div></aside>}</>; };
const _legacyOrderFilesSummary = ({ items, onPreview, configurations, onConfigurationChange }: { items: UploadItem[]; onPreview: (file: CadFile) => void; configurations?: Record<string, FileConfiguration>; onConfigurationChange?: (id: string, update: Partial<FileConfiguration>) => void }) => {
  const usable = items.filter(isUploadItemReady);
  return <section className="order-files-summary" aria-label="Files in this order"><div className="request-title-row"><div><h2>Files in this order</h2><p>Every uploaded file below will be submitted together as one manufacturing order.</p></div><span className="request-status">{usable.length} file{usable.length === 1 ? '' : 's'} included</span></div><div className="order-files-list">{usable.map((item, index) => { const file = item.cadFile!; const config = configurations?.[file.id] || { technology: null, process: null, material: null, quantity: 1, quality: 'standard', color: 'black', finish: 'standard', tolerance: 'standard' }; const update = (change: Partial<FileConfiguration>) => onConfigurationChange?.(file.id, change); return <article className="order-file-summary" key={`${file.id}-${item.id}`}><div className="order-file-summary-heading"><span>{String(index + 1).padStart(2, '0')}</span><strong>{file.name}</strong><em>{file.format} · {file.size}</em><b>Ready</b><button className="cad-card-action" onClick={() => onPreview(file)}>Preview</button></div><div className="order-file-summary-config"><label>Quantity<input type="number" min="1" value={config.quantity} onChange={(event) => update({ quantity: Math.max(1, Number(event.target.value)) })} /></label><label>Material<select value={config.material || ''} onChange={(event) => update({ material: event.target.value || null })}><option value="">Use order material</option><option value="pla">PLA</option><option value="abs">ABS</option><option value="nylon">Nylon</option><option value="aluminum">Aluminum</option><option value="steel">Steel</option></select></label><label>Quality<select value={config.quality} onChange={(event) => update({ quality: event.target.value })}><option value="standard">Standard</option><option value="high">High</option><option value="premium">Premium</option></select></label><label>Finish<select value={config.finish} onChange={(event) => update({ finish: event.target.value })}><option value="standard">Standard</option><option value="smooth">Smooth</option><option value="matte">Matte</option><option value="polished">Polished</option></select></label><label>Color<select value={config.color} onChange={(event) => update({ color: event.target.value })}><option value="black">Black</option><option value="white">White</option><option value="blue">Blue</option><option value="natural">Natural</option></select></label><span>Configured independently and included in this order.</span></div></article>; })}</div></section>;
};
void _legacyOrderFilesSummary;

const OrderFilesSummary = ({ items, onPreview, configurations, onConfigurationChange }: { items: UploadItem[]; onPreview: (file: CadFile) => void; configurations?: Record<string, FileConfiguration>; onConfigurationChange?: (id: string, update: Partial<FileConfiguration>) => void }) => {
  const { t } = useTranslation();
  const usable = items.filter(isUploadItemReady);
  const options = ['standard', 'high', 'premium'].map((value) => <option key={value} value={value}>{t(`request.options.${value}`)}</option>);
  return <section className="order-files-summary" aria-label={t('request.orderFilesLabel')}><div className="request-title-row"><div><h2>{t('request.orderFilesTitle')}</h2><p>{t('request.orderFilesDescription')}</p></div><span className="request-status">{t('request.filesIncluded', { count: usable.length })}</span></div><div className="order-files-list">{usable.map((item, index) => { const file = item.cadFile!; const config = configurations?.[file.id] || { technology: null, process: null, material: null, quantity: 1, quality: 'standard', color: 'black', finish: 'standard', tolerance: 'standard' }; const update = (change: Partial<FileConfiguration>) => onConfigurationChange?.(file.id, change); return <article className="order-file-summary" key={`${file.id}-${item.id}`}><div className="order-file-summary-heading"><span>{String(index + 1).padStart(2, '0')}</span><strong>{file.name}</strong><em>{file.format} · {file.size}</em><b>{t('request.status.ready')}</b><button className="cad-card-action" onClick={() => onPreview(file)}>{t('request.preview')}</button></div><div className="order-file-summary-config"><label>{t('request.quantity')}<OptionalMark /><input type="number" min="1" value={config.quantity} onChange={(event) => update({ quantity: Math.max(1, Number(event.target.value)) })} /></label><label>{t('request.materialLabel')}<OptionalMark /><select value={config.material || ''} onChange={(event) => update({ material: event.target.value || null })}><option value="">{t('request.useOrderMaterial')}</option>{['pla', 'abs', 'nylon', 'aluminum', 'steel'].map((value) => <option key={value} value={value}>{t(`request.material.${value}`)}</option>)}</select></label><label>{t('request.quality')}<OptionalMark /><select value={config.quality} onChange={(event) => update({ quality: event.target.value })}>{options}</select></label><label>{t('request.surfaceFinish')}<OptionalMark /><select value={config.finish} onChange={(event) => update({ finish: event.target.value })}>{['standard', 'smooth', 'matte', 'polished'].map((value) => <option key={value} value={value}>{t(`request.options.${value}`)}</option>)}</select></label><label>{t('request.color')}<select value={config.color} onChange={(event) => update({ color: event.target.value })}>{['black', 'white', 'blue', 'natural'].map((value) => <option key={value} value={value}>{t(`request.options.${value}`)}</option>)}</select></label></div><small>{t('request.fileConfigured')}</small></article>; })}</div></section>;
};

const ReviewBlock = ({ title, rows, muted = false }: { title: string; rows: (string | undefined)[][]; muted?: boolean }) => <article className={`review-block ${muted ? 'is-muted' : ''}`}><h3>{title}</h3>{rows.map(([label, value]) => <div key={label}><span>{label}</span><strong>{value}</strong></div>)}</article>;

const SuccessStep = ({ files, reference, t, onDashboard, onNew }: { files: UploadItem[]; reference: string; t: any; onDashboard: () => void; onNew: () => void }) => <div className="success-state"><div className="success-mark"><Icon name="check" size={30} /></div><h2>{t('request.created')}</h2><p>{t('request.createdDescription')}</p><div className="success-reference"><span>{t('request.reference')}</span><strong>{reference}</strong></div><div className="status-timeline"><div className="is-complete"><span><Icon name="check" size={13} /></span>{t('request.timeline.created')}</div><div className="is-current"><span>2</span>{t('request.timeline.analyzing')}</div><div><span>3</span>{t('request.timeline.waiting')}</div></div><div className="success-summary"><strong>{files.filter(isUploadItemReady).length} files in this order</strong>{files.filter(isUploadItemReady).map((file) => <span key={file.id}>{file.name} · {file.format}</span>)}</div><div className="request-actions"><button className="btn btn-lg btn-outline" onClick={onNew}>{t('request.newRequest')}</button><button className="btn btn-lg btn-primary" onClick={onDashboard}>{t('request.viewRequest')}</button></div></div>;
