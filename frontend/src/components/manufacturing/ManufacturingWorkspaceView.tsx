import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import '../../styles/manufacturing-workspace.css';
import { ApiError, ApiService } from '../../services/api';
import { CadFile } from '../../types';
import { useStore } from '../../context/StoreContext';
import { useAuth } from '../../context/AuthContext';
import { useTranslation } from 'react-i18next';
import { CadGeometryViewer } from './CadGeometryViewer';
import { TechnicalDocumentPreview } from './TechnicalDocumentPreview';
import { Icon } from '../ui/Icon';
import { ErrorBoundary } from '../ui/ErrorBoundary';
import { ModelUnit } from '../../utils/modelUnits';
import { useMaterials } from '../../hooks/useMaterials';
import { useQuoteEngine } from '../../hooks/useQuoteEngine';
import { useDraftPersistence, DraftData } from '../../hooks/useDraftPersistence';
import { UploadItemStatus, UploadValidationState, areAllUploadsReady, hasUploadInFlight, hasViewerGeometry, isCadFileReady, isUploadItemReady } from './uploadState';
import { AnimatePresence, motion } from 'motion/react';
import { CAM_EASE } from '../ui/AnimatedModal';
import { fdmParametersFor, hasOwn, panelStatusClass, priceWithPriority } from './workspace/helpers';
import { MAX_TECHNICAL_DOCUMENTS, MAX_TECHNICAL_DOCUMENT_SIZE_BYTES, MAX_UPLOAD_FILES, MAX_UPLOAD_FILE_SIZE_BYTES, MAX_UPLOAD_TOTAL_BYTES, SUPPORTED_DOCUMENT_EXTENSIONS, initialState, panelIds } from './workspace/constants';
import { FileConfiguration, FileSetupState, PanelStatus, QuoteData, RequestState, TechnicalDocumentItem, UploadItem } from './workspace/types';
import { useCadThumbnails } from './workspace/useCadThumbnails';
import { TechnologyPanel } from './workspace/panels/TechnologyPanel';
import { ProcessPanel } from './workspace/panels/ProcessPanel';
import { MaterialPanel } from './workspace/panels/MaterialPanel';
import { UploadPanel } from './workspace/panels/UploadPanel';
import { ViewerPanel } from './workspace/panels/ViewerPanel';
import { ConfigurationPanel } from './workspace/panels/ConfigurationPanel';
import { NotesPanel } from './workspace/panels/NotesPanel';
import { QuotePanel } from './workspace/panels/QuotePanel';

// Progressive entry flow — the panels themselves ARE the workflow (never a
// wizard): technology focus → process focus → Technology + Process physically
// settle into the left column → upload focus → upload contracts as the rest of
// the workspace progressively reveals → settled existing workspace. The stage
// machine is only choreography; real application state drives every advance.
type EntryStage = 'tech-focus' | 'process-focus' | 'morph' | 'upload-focus' | 'reveal' | 'workspace';

// One pose per spatial unit. The poses are pure transform/opacity targets for
// the real panels — layout never changes, so the CAD viewer (and everything
// else) is never resized or reloaded. `dir` mirrors the x-axis for RTL.
type EntryPose = { x?: number | string; y?: number | string; scale?: number; opacity?: number; zIndex?: number };
type EntryPoseSet = {
  leftBlock: EntryPose;
  material: EntryPose;
  upload: EntryPose;
  viewer: EntryPose;
  dock: EntryPose;
  right: EntryPose;
};

const entryPoses = (
  stage: EntryStage,
  dir: -1 | 1,
  reduced: boolean,
  focusDelta: { x: number; y: number }
): EntryPoseSet => {
  if (reduced) {
    // Reduced motion: plain state-change hierarchy, fades only — the spatial
    // choreography (transforms) is disabled, the functional sequence is kept.
    const dim = stage !== 'reveal' && stage !== 'workspace';
    return {
      leftBlock: { x: 0, y: 0, scale: 1, opacity: dim ? (stage === 'upload-focus' ? 0.65 : 1) : 1 },
      material: { x: 0, y: 0, scale: 1, opacity: dim ? 0.45 : 1 },
      upload: { x: 0, y: 0, scale: 1, opacity: stage === 'upload-focus' ? 1 : dim ? 0.45 : 1 },
      viewer: { x: 0, y: 0, scale: 1, opacity: dim ? 0.35 : 1 },
      dock: { x: 0, y: 0, scale: 1, opacity: dim ? 0.35 : 1 },
      right: { x: 0, y: 0, scale: 1, opacity: dim ? 0.35 : 1 },
    };
  }
  const focus = stage === 'tech-focus' || stage === 'process-focus';
  const settled = stage === 'reveal' || stage === 'workspace';
  const targetX = focusDelta.x !== 0 ? focusDelta.x : `${dir * 165}%`;
  const targetY = focusDelta.y;

  return {
    leftBlock: stage === 'tech-focus'
      ? { x: targetX, y: targetY, scale: 1.12, opacity: 1, zIndex: 40 }
      : stage === 'process-focus'
        ? { x: targetX, y: targetY, scale: 1.06, opacity: 1, zIndex: 40 }
        : { x: 0, y: 0, scale: 1, opacity: 1, zIndex: 10 },
    material: focus
      ? { x: 0, y: 6, scale: 0.98, opacity: 0.28 }
      : stage === 'morph'
        ? { x: 0, y: 4, scale: 0.99, opacity: 0.6 }
        : { x: 0, y: 0, scale: 1, opacity: 1 },
    upload: focus
      ? { x: 0, y: 0, scale: 0.98, opacity: 0.28 }
      : stage === 'morph'
        ? { x: 0, y: 0, scale: 1.02, opacity: 0.85 }
        : stage === 'upload-focus'
          ? { x: 0, y: 0, scale: 1.06, opacity: 1, zIndex: 35 }
          : { x: 0, y: 0, scale: 1, opacity: 1 },
    viewer: settled
      ? { x: 0, y: 0, scale: 1, opacity: 1 }
      : { x: 0, y: 8, scale: 0.98, opacity: focus ? 0.28 : 0.35 },
    dock: settled
      ? { x: 0, y: 0, scale: 1, opacity: 1 }
      : { x: 0, y: 8, scale: 0.98, opacity: focus ? 0.28 : 0.35 },
    right: settled
      ? { x: 0, y: 0, scale: 1, opacity: 1 }
      : { x: dir * 6, y: 6, scale: 0.98, opacity: focus ? 0.28 : 0.35 },
  };
};

const settledDelay = (stage: EntryStage, delay: number) => (stage === 'reveal' ? delay : 0);

const entryTransition = (stage: EntryStage, key: keyof EntryPoseSet, reduced: boolean) => {
  if (reduced) return { duration: 0.22, ease: CAM_EASE };
  const base = { ease: CAM_EASE };
  switch (key) {
    case 'leftBlock':
      return { ...base, duration: stage === 'morph' ? 0.6 : 0.52 };
    case 'material':
      return { ...base, duration: 0.3, delay: settledDelay(stage, 0) };
    case 'upload':
      return { ...base, duration: stage === 'reveal' ? 0.52 : stage === 'upload-focus' ? 0.5 : 0.42 };
    case 'viewer':
      return { ...base, duration: 0.3, delay: settledDelay(stage, 0.08) };
    case 'dock':
      return { ...base, duration: 0.28, delay: settledDelay(stage, 0.16) };
    case 'right':
      return { ...base, duration: 0.28, delay: settledDelay(stage, 0.24) };
  }
};

export const ManufacturingRequestView: React.FC = () => {
  const { t } = useTranslation();
  useMaterials();
  const { openAuthModal } = useStore();
  const { isAuthenticated } = useAuth();

  const [configTouched, setConfigTouched] = useState(false);
  const [toast, setToast] = useState('');

  const [request, setRequest] = useState<RequestState>(initialState);
  const [quote, setQuote] = useState<QuoteData | null>(null);
  const [isCalculatingQuote, setIsCalculatingQuote] = useState(false);
  const [quoteFailed, setQuoteFailed] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);

  const [uploadItems, setUploadItems] = useState<UploadItem[]>([]);
  const [fileConfigurations, setFileConfigurations] = useState<Record<string, FileConfiguration>>({});
  const [error, setError] = useState('');
  const [isDragging, setIsDragging] = useState(false);
  const [previewFile, setPreviewFile] = useState<CadFile | null>(null);
  const [deleteItem, setDeleteItem] = useState<UploadItem | null>(null);
  const [isDeleting, setIsDeleting] = useState(false);
  const [authGateOpen, setAuthGateOpen] = useState(false);
  const [selectedSetupId, setSelectedSetupId] = useState<string | null>(null);
  const [materialSelectionInitialized] = useState(false);
  const [fileSetupStates, setFileSetupStates] = useState<Record<string, FileSetupState>>({});
  const [note, setNote] = useState('');
  const [technicalDocuments, setTechnicalDocuments] = useState<TechnicalDocumentItem[]>([]);
  const [activeConfigTab, setActiveConfigTab] = useState<'basic' | 'advanced'>('basic');
  const [priorityShipping, setPriorityShipping] = useState(false);
  const [isDocDragging, setIsDocDragging] = useState(false);
  const [previewDoc, setPreviewDoc] = useState<TechnicalDocumentItem | null>(null);

  const [entryStage, setEntryStage] = useState<EntryStage>('tech-focus');
  const restoredRef = useRef(false);
  const entryFocusMovedRef = useRef(false);
  const rtlRef = useRef(typeof document !== 'undefined' && document.documentElement.dir === 'rtl');
  const reducedMotionRef = useRef(typeof window !== 'undefined' && window.matchMedia('(prefers-reduced-motion: reduce)').matches);

  const gridRef = useRef<HTMLDivElement>(null);
  const leftBlockRef = useRef<HTMLDivElement>(null);
  const [focusDelta, setFocusDelta] = useState<{ x: number; y: number }>({ x: 0, y: 0 });

  const calculateFocusDelta = useCallback(() => {
    if (!gridRef.current || !leftBlockRef.current) return;
    const gridEl = gridRef.current;
    const leftBlockEl = leftBlockRef.current;
    const colLeftEl = leftBlockEl.parentElement;
    if (!colLeftEl) return;

    const gridW = gridEl.clientWidth;
    const gridH = gridEl.clientHeight;
    const colLeft = colLeftEl.offsetLeft;
    const blockW = leftBlockEl.offsetWidth;
    const blockH = leftBlockEl.offsetHeight;

    if (gridW <= 0 || blockW <= 0) return;

    const targetCenterX = gridW / 2;
    const currentCenterX = colLeft + blockW / 2;
    const dx = targetCenterX - currentCenterX;

    const targetCenterY = gridH * 0.44;
    const currentCenterY = leftBlockEl.offsetTop + blockH / 2;
    const dy = targetCenterY - currentCenterY;

    setFocusDelta({ x: dx, y: dy });
  }, []);

  useEffect(() => {
    calculateFocusDelta();
    const onResize = () => calculateFocusDelta();
    window.addEventListener('resize', onResize);
    return () => window.removeEventListener('resize', onResize);
  }, [calculateFocusDelta]);

  useEffect(() => {
    const id = requestAnimationFrame(() => {
      calculateFocusDelta();
    });
    return () => cancelAnimationFrame(id);
  }, [calculateFocusDelta]);

  const submissionInFlightRef = useRef(false);
  const inputRef = useRef<HTMLInputElement>(null);
  const docInputRef = useRef<HTMLInputElement>(null);
  const modalRef = useRef<HTMLDivElement>(null);
  const modalTriggerRef = useRef<HTMLElement | null>(null);
  const primaryUploadIdRef = useRef<string | null>(null);
  const activeUploadTokensRef = useRef<Record<string, string>>({});
  const uploadLifecycleBusyRef = useRef(false);

  const isPrinting = ['fdm', 'sla', 'sls'].includes(request.process || '');

  // ── Derived workflow state (panels ARE the workflow — no stepper) ───────
  const allUploadsReady = useMemo(() => areAllUploadsReady(uploadItems), [uploadItems]);
  const uploadsDone = uploadItems.length > 0 && allUploadsReady;
  const uploadBusy = hasUploadInFlight(uploadItems) || uploadLifecycleBusyRef.current;
  const hasProcess = !!request.process;
  const hasMaterial = !!request.material;
  const orderReady = Boolean(request.cadFile && request.process && request.material && uploadsDone);

  const techStatus: PanelStatus = request.technology ? 'completed' : 'active';
  const processStatus = panelStatusClass(!!request.process, !!request.technology);
  const uploadStatus = panelStatusClass(uploadsDone, hasProcess);
  const materialStatus = panelStatusClass(!!request.material, hasProcess && uploadsDone);
  const configStatus = panelStatusClass(configTouched, hasProcess && hasMaterial && uploadsDone);

  const updateRequest = useCallback((p: Partial<RequestState>) => setRequest((c) => ({ ...c, ...p })), []);
  const { invalidateQuote } = useQuoteEngine({ request, fileConfigurations, uploadItems, setQuote, setIsCalculatingQuote, setQuoteFailed, setError });
  const setUploadBusy = useCallback((b: boolean) => { uploadLifecycleBusyRef.current = b; }, []);
  const { thumbnails, thumbFailed, activeThumbIds } = useCadThumbnails({ uploadItems, fileConfigurations, request, enabled: entryStage === 'reveal' || entryStage === 'workspace' });

  const focusSection = useCallback((id: string, label: string) => {
    const el = document.getElementById(id);
    if (!el) return;
    el.scrollIntoView({ behavior: 'smooth', block: 'center' });
    el.querySelector('.mw-panel-header')?.scrollIntoView({ behavior: 'smooth', block: 'nearest' });
    el.classList.remove('mw-flash');
    void el.offsetWidth;
    el.classList.add('mw-flash');
    setToast(`Next: ${label}`);
  }, []);

  // ── Draft persistence (restore + autosave of notes/doc metadata) ─────────
  // Files themselves are never stored client-side — only server-issued document
  // metadata (ids + names) is kept, so the draft stays tiny and binary-free.
  useDraftPersistence({
    request, note, fileConfigurations, fileSetupStates, configTouched, activeConfigTab, technicalDocuments,
    onRestore: useCallback((data: DraftData) => {
      restoredRef.current = true;
      if (data?.request) setRequest((c) => ({ ...c, ...data.request }));
      if (data.request?.technology) {
        if (data.request?.cadFile) {
          setEntryStage('workspace');
        } else if (data.request.process) {
          setEntryStage('upload-focus');
        } else {
          setEntryStage('process-focus');
        }
      }
      if (typeof data.note === 'string') setNote(data.note);
      if (Array.isArray(data.technicalDocuments)) {
        setTechnicalDocuments(data.technicalDocuments
          .filter((d: any) => d && typeof d.name === 'string' && typeof d.key === 'string')
          .map((d: any) => ({ key: d.key, id: typeof d.id === 'string' ? d.id : undefined, name: d.name, mimeType: d.mimeType, byteSize: d.byteSize, progress: 100, status: 'ready' as const })));
      }
      if (data.fileConfigurations) setFileConfigurations(data.fileConfigurations);
      if (data.fileSetupStates) setFileSetupStates(data.fileSetupStates);
      if (typeof data.configTouched === 'boolean') setConfigTouched(data.configTouched);
      if (data.activeConfigTab === 'advanced') setActiveConfigTab('advanced');
      setToast('Draft restored');
    }, [setRequest, setNote, setTechnicalDocuments, setFileConfigurations, setFileSetupStates, setConfigTouched, setActiveConfigTab, setToast, setEntryStage]),
  });

  useEffect(() => {
    if (!toast) return;
    const id = window.setTimeout(() => setToast(''), 2600);
    return () => window.clearTimeout(id);
  }, [toast]);

  // ── Progressive entry choreography (one-shot, driven by real state) ──────
  const advanceFromTechFocus = useCallback(() => {
    if (request.technology) setEntryStage('process-focus');
  }, [request.technology]);
  useEffect(() => {
    if (entryStage !== 'tech-focus') return;
    advanceFromTechFocus();
  }, [entryStage, advanceFromTechFocus]);

  // morph → upload-focus is presentation-only (the left block has finished its
  // travel). Animating elements report completion via onAnimationComplete on the
  // left block; a short bounded fallback keeps the choreography alive even if
  // that callback is suppressed (e.g. reduced motion / interrupted animation).
  useEffect(() => {
    if (entryStage !== 'morph') return;
    const id = window.setTimeout(() => setEntryStage('upload-focus'), 900);
    return () => window.clearTimeout(id);
  }, [entryStage]);

  // reveal → workspace settles the workspace AFTER every uploaded file is
  // actually ready — never on an arbitrary wall-clock while the backend is still
  // scanning/processing. The settle completes on the right column's animation
  // completion (added in the render below); this bounded fallback only touches
  // the PRESENTATION stage and is gated on real business readiness, so it can
  // never reveal the workspace early. The synthetic resize dispatch is gone —
  // the viewer's own ResizeObserver refits when the columns settle.
  useEffect(() => {
    if (entryStage !== 'reveal') return;
    if (uploadItems.length > 0 && areAllUploadsReady(uploadItems)) {
      const id = window.setTimeout(() => setEntryStage('workspace'), 1600);
      return () => window.clearTimeout(id);
    }
    return undefined;
  }, [entryStage, uploadItems]);

  useEffect(() => {
    if (entryStage !== 'upload-focus') return;
    // The reveal is driven by REAL application state — every uploaded file has
    // been processed, validated and is viewer + quote ready. Files mid-scan or
    // mid-process keep the focused upload panel (honest, never fake-early).
    if (areAllUploadsReady(uploadItems)) {
      setEntryStage('reveal');
    }
  }, [entryStage, uploadItems]);

  // If every file is removed mid-reveal, do not strand the workspace in the
  // reveal pose — glide the focus back to the Process section.
  useEffect(() => {
    if (entryStage !== 'reveal' || uploadItems.length > 0) return;
    setEntryStage('process-focus');
  }, [entryStage, uploadItems]);

  // If the user revisits technology/process after the morph, steer the focus
  // back to the left column instead of leaving the emphasis stranded on upload.
  useEffect(() => {
    if (entryStage !== 'upload-focus' && entryStage !== 'reveal') return;
    if (request.technology && !request.process) setEntryStage('process-focus');
    else if (!request.technology) setEntryStage('tech-focus');
  }, [entryStage, request.technology, request.process]);

  // A restored draft skips the choreography — touch nothing if we got one.
  const focusFirstTechOption = useCallback(() => {
    if (restoredRef.current || entryStage !== 'tech-focus' || request.technology) return;
    const id = window.setTimeout(() => {
      const el = document.querySelector<HTMLElement>('#mw-sec-tech .mw-stage-tech-item');
      if (el) el.focus({ preventScroll: true });
    }, 240);
    return () => window.clearTimeout(id);
  }, [entryStage, request.technology]);
  useEffect(() => {
    if (entryFocusMovedRef.current) return;
    entryFocusMovedRef.current = true;
    focusFirstTechOption();
  }, [focusFirstTechOption]);

  const focusFirstProcessChip = useCallback(() => {
    if (entryStage !== 'process-focus' || request.process) return;
    const id = window.setTimeout(() => {
      if (entryStage !== 'process-focus' || request.process) return;
      const el = document.querySelector<HTMLElement>('#mw-sec-process .mw-stage-process-chip');
      if (el) el.focus({ preventScroll: true });
    }, 160);
    return () => window.clearTimeout(id);
  }, [entryStage, request.process]);
  useEffect(() => {
    if (restoredRef.current) return;
    focusFirstProcessChip();
  }, [focusFirstProcessChip]);

  // ── Upload lifecycle ─────────────────────────────────────────────────────
  useEffect(() => { if (uploadLifecycleBusyRef.current && !hasUploadInFlight(uploadItems)) setUploadBusy(false); }, [uploadItems, setUploadBusy]);

  // Modal focus trap
  useEffect(() => {
    if (!previewFile && !deleteItem) { modalTriggerRef.current?.focus(); modalTriggerRef.current = null; return; }
    const sel = 'button:not([disabled]), input:not([disabled]), select:not([disabled]), [tabindex]:not([tabindex="-1"])';
    const focusFirst = () => modalRef.current?.querySelector<HTMLElement>(sel)?.focus();
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') { e.preventDefault(); if (!isDeleting) { setPreviewFile(null); setDeleteItem(null); } return; }
      if (e.key !== 'Tab' || !modalRef.current) return;
      const ctrls = Array.from(modalRef.current.querySelectorAll<HTMLElement>(sel));
      if (!ctrls.length) return;
      if (e.shiftKey && document.activeElement === ctrls[0]) { e.preventDefault(); ctrls[ctrls.length - 1].focus(); }
      else if (!e.shiftKey && document.activeElement === ctrls[ctrls.length - 1]) { e.preventDefault(); ctrls[0].focus(); }
    };
    window.addEventListener('keydown', onKey); window.requestAnimationFrame(focusFirst);
    return () => window.removeEventListener('keydown', onKey);
  }, [previewFile, deleteItem, isDeleting]);

  const updateUploadItem = useCallback((id: string, update: Partial<UploadItem>, token?: string) => {
    if (token && activeUploadTokensRef.current[id] !== token) return;
    setUploadItems((items) => items.map((item) => item.id === id ? { ...item, ...update } : item));
  }, []);

  const pollProcessing = useCallback(async (itemId: string, fileId: string): Promise<CadFile> => {
    let lastStatus: UploadItemStatus | null = null;
    for (let i = 0; i < 40; i++) {
      const files = await ApiService.getCadFiles();
      const f = files?.find((c) => c.id === fileId); const v = f?.latestVersion;
      if (v?.scanStatus === 'QUARANTINED' || v?.processingStatus === 'FAILED') throw new Error(v?.failureMessage || t('request.processingFailed'));
      if (v?.processingStatus === 'COMPLETE' && f) {
        if (isCadFileReady(f)) return f;
        // Analysed but not quote-eligible (2D drawing or zero-volume model).
        if (hasViewerGeometry(f)) return f;
        throw new Error(t('request.processingFailed'));
      }
      // Skip redundant re-renders: only write to React state when the status
      // actually changed (typically scanning → processing → done, not every
      // 500ms tick of an unchanged backend status).
      const nextStatus: UploadItemStatus = v?.scanStatus === 'PENDING' ? 'scanning' : 'processing';
      if (lastStatus !== nextStatus) {
        lastStatus = nextStatus;
        updateUploadItem(itemId, { status: nextStatus });
      }
      await new Promise((r) => window.setTimeout(r, 500));
    }
    throw new Error(t('request.processingTimeout'));
  }, [t, updateUploadItem]);

  const processUpload = useCallback(async (itemId: string, file: File, token: string) => {
    const seedFor = (cf: CadFile) => {
      const cid = cf.id;
      setFileConfigurations((c) => {
        if (c[cid]) return c;
        const base = { technology: request.technology, process: request.process, material: request.material };
        const first = Object.keys(c).length === 0;
        const def: FileConfiguration = first
          ? { ...base, quantity: request.quantity, quality: request.quality, color: request.color, finish: request.finish, tolerance: request.tolerance, wallCount: request.wallCount, infillPercent: request.infillPercent ?? null, supportEnabled: false }
          : { ...base, quantity: initialState.quantity, quality: initialState.quality, color: initialState.color, finish: initialState.finish, tolerance: initialState.tolerance, wallCount: initialState.wallCount, infillPercent: null, supportEnabled: false };
        return { ...c, [cid]: def };
      });
    };
    try {
      const val = await ApiService.validateCadFile(file.name, file.size);
      if (activeUploadTokensRef.current[itemId] !== token) return;
      if (val && !val.isValidFormat) { updateUploadItem(itemId, { status: 'unsupported', validationState: 'invalid', processingComplete: false, message: t('request.invalidFormat') }, token); return; }
      if (val && val.isSizeWithinLimit === false) { updateUploadItem(itemId, { status: 'unsupported', validationState: 'invalid', processingComplete: false, message: 'File exceeds size limit.' }, token); return; }
      if (file.size < 1) { updateUploadItem(itemId, { status: 'failed', validationState: 'invalid', processingComplete: false, message: 'CAD files must not be empty.' }, token); return; }
      const uploaded = await ApiService.uploadCadFile(file, (p) => updateUploadItem(itemId, { progress: p, status: p < 100 ? 'uploading' : 'scanning' }, token));
      if (activeUploadTokensRef.current[itemId] !== token) return;
      if (!uploaded) throw new Error(t('request.uploadUnavailable'));
      const uf: CadFile = { ...uploaded, latestVersion: uploaded.version };
      if (uploaded.duplicate && isCadFileReady(uf)) { seedFor(uf); updateUploadItem(itemId, { status: 'duplicate', cadFile: uf, validationState: 'valid', processingComplete: true, message: t('request.queue.duplicateMessage') }, token); if (itemId === primaryUploadIdRef.current) setRequest((c) => ({ ...c, cadFile: uf })); return; }
      updateUploadItem(itemId, { status: 'scanning', progress: 100, cadFile: uf, validationState: 'pending', processingComplete: false }, token);
      const processed = await pollProcessing(itemId, uploaded.id);
      if (activeUploadTokensRef.current[itemId] !== token) return;
      updateUploadItem(itemId, { status: 'ready', cadFile: processed, validationState: 'valid', processingComplete: true }, token);
      seedFor(processed);
      if (itemId === primaryUploadIdRef.current) setRequest((c) => ({ ...c, cadFile: processed }));
    } catch (e) {
      const msg = e instanceof ApiError || e instanceof Error ? e.message : t('request.uploadFailed');
      updateUploadItem(itemId, { status: e instanceof ApiError && e.status === 400 ? 'unsupported' : 'failed', validationState: 'invalid', processingComplete: false, message: msg }, token);
    }
  }, [t, updateUploadItem, pollProcessing, request, setFileConfigurations]);

  const addFiles = useCallback((files: File[]) => {
    if (!request.process) { setError('Select a manufacturing process first to enable uploads.'); focusSection(panelIds.process, 'Select Process'); return; }
    if (!files.length) return; setError(''); invalidateQuote(); setUploadBusy(true);
    const accepted = uploadItems.filter((i) => i.status !== 'unsupported');
    const curBytes = accepted.reduce((s, i) => s + i.sizeBytes, 0);
    let runBytes = curBytes, runCount = accepted.length;
    const staged: Array<{ id: string; name: string; format: string; size: string; sizeBytes: number; status: UploadItemStatus; validationState: UploadValidationState; processingComplete: boolean; progress: number; message?: string; file?: File; token?: string }> = [];
    files.forEach((f) => {
      const id = crypto.randomUUID(); const size = `${(f.size / (1024 * 1024)).toFixed(2)} MB`; const fmt = f.name.split('.').pop()?.toUpperCase() || 'CAD';
      if (runCount >= MAX_UPLOAD_FILES) { staged.push({ id, name: f.name, format: fmt, size, sizeBytes: f.size, status: 'unsupported', validationState: 'invalid', processingComplete: false, progress: 0, message: `Max ${MAX_UPLOAD_FILES} files.` }); return; }
      if (f.size > MAX_UPLOAD_FILE_SIZE_BYTES) { staged.push({ id, name: f.name, format: fmt, size, sizeBytes: f.size, status: 'unsupported', validationState: 'invalid', processingComplete: false, progress: 0, message: 'Exceeds 500MB.' }); return; }
      if (runBytes + f.size > MAX_UPLOAD_TOTAL_BYTES) { staged.push({ id, name: f.name, format: fmt, size, sizeBytes: f.size, status: 'unsupported', validationState: 'invalid', processingComplete: false, progress: 0, message: 'Exceeds 2GB total.' }); return; }
      staged.push({ id, name: f.name, format: fmt, size, sizeBytes: f.size, status: 'uploading', validationState: 'pending', processingComplete: false, progress: 0, file: f, token: crypto.randomUUID() });
      runCount++; runBytes += f.size;
    });
    const first = staged.find((i) => !!i.file);
    if (!primaryUploadIdRef.current && first) primaryUploadIdRef.current = first.id;
    setUploadItems((c) => [...c, ...staged.map(({ file: _f, token: _t, ...i }) => i)]);
    staged.forEach(({ id, file: f, token: tok }) => { if (f && tok) { activeUploadTokensRef.current[id] = tok; void processUpload(id, f, tok); } });
    if (inputRef.current) inputRef.current.value = '';
  }, [uploadItems, request.process, invalidateQuote, setUploadBusy, processUpload, focusSection]);

  const confirmDelete = useCallback(async () => {
    if (!deleteItem) return; invalidateQuote();
    const idx = uploadItems.findIndex((i) => i.id === deleteItem.id);
    const rem = uploadItems.filter((i) => i.id !== deleteItem.id);
    const next = rem.slice(Math.max(0, idx), rem.length).find(isUploadItemReady) || rem.slice(0, Math.max(0, idx)).reverse().find(isUploadItemReady);
    if (!deleteItem.cadFile) { delete activeUploadTokensRef.current[deleteItem.id]; setUploadItems((i) => i.filter((x) => x.id !== deleteItem.id)); setFileSetupStates((c) => { const n = { ...c }; delete n[deleteItem.id]; return n; }); if (selectedSetupId === deleteItem.id) setSelectedSetupId(next?.id || null); if (primaryUploadIdRef.current === deleteItem.id) primaryUploadIdRef.current = next?.id || null; setDeleteItem(null); return; }
    setUploadBusy(true); setIsDeleting(true); delete activeUploadTokensRef.current[deleteItem.id];
    setUploadItems((i) => i.filter((x) => x.id !== deleteItem.id && x.cadFile?.id !== deleteItem.cadFile?.id));
    setFileConfigurations((c) => { const n = { ...c }; if (deleteItem.cadFile) delete n[deleteItem.cadFile.id]; return n; });
    setFileSetupStates((c) => { const n = { ...c }; delete n[deleteItem.id]; return n; });
    if (selectedSetupId === deleteItem.id) setSelectedSetupId(next?.id || null);
    if (primaryUploadIdRef.current === deleteItem.id) primaryUploadIdRef.current = next?.id || null;
    setRequest((c) => c.cadFile?.id === deleteItem.cadFile?.id ? { ...c, cadFile: null, geometry: null } : c);
    setPreviewFile((c) => c?.id === deleteItem.cadFile?.id ? null : c);
    setDeleteItem(null);
    try { await ApiService.deleteCadFile(deleteItem.cadFile.id); } catch (e) { setError(e instanceof Error ? e.message : t('request.deleteFailed')); } finally { setUploadBusy(false); setIsDeleting(false); }
  }, [deleteItem, uploadItems, selectedSetupId, invalidateQuote, setUploadBusy, t]);

  const clearAllUploads = useCallback(async () => {
    const ids = uploadItems.flatMap((i) => i.cadFile ? [i.cadFile.id] : []);
    invalidateQuote(); setUploadBusy(false); setUploadItems([]); setFileConfigurations({}); setFileSetupStates({}); setSelectedSetupId(null); setPreviewFile(null); setDeleteItem(null);
    primaryUploadIdRef.current = null; activeUploadTokensRef.current = {};
    setRequest((c) => ({ ...c, cadFile: null, geometry: null }));
    if (ids.length) void Promise.allSettled(ids.map((id) => ApiService.deleteCadFile(id)));
  }, [uploadItems, invalidateQuote, setUploadBusy]);

  // ── Technical documents (drawings, datasheets, notes) ─────────────────────
  const updateDocumentItem = useCallback((key: string, update: Partial<TechnicalDocumentItem>) => {
    setTechnicalDocuments((items) => items.map((item) => item.key === key ? { ...item, ...update } : item));
  }, []);

  const removeDocument = useCallback((key: string) => {
    const item = technicalDocuments.find((d) => d.key === key);
    setTechnicalDocuments((d) => d.filter((x) => x.key !== key));
    if (item?.id) void ApiService.deleteTechnicalDocument(item.id).catch(() => undefined);
  }, [technicalDocuments]);

  const handleDocs = useCallback((files: File[]) => {
    if (!files.length) return;
    const readyCount = technicalDocuments.filter((d) => d.status !== 'error').length;
    let runCount = readyCount;
    const staged: Array<TechnicalDocumentItem & { file?: File }> = [];
    files.forEach((f) => {
      const key = crypto.randomUUID();
      const ext = f.name.split('.').pop()?.toLowerCase() || '';
      if (runCount >= MAX_TECHNICAL_DOCUMENTS) {
        staged.push({ key, name: f.name, progress: 0, status: 'error', message: `Max ${MAX_TECHNICAL_DOCUMENTS} documents.` });
        return;
      }
      if (!SUPPORTED_DOCUMENT_EXTENSIONS.includes(ext)) {
        staged.push({ key, name: f.name, progress: 0, status: 'error', message: 'Unsupported type. Use PDF, DOC, DOCX, TXT, RTF, PNG, JPG.' });
        return;
      }
      if (f.size < 1) {
        staged.push({ key, name: f.name, progress: 0, status: 'error', message: 'Document must not be empty.' });
        return;
      }
      if (f.size > MAX_TECHNICAL_DOCUMENT_SIZE_BYTES) {
        staged.push({ key, name: f.name, progress: 0, status: 'error', message: 'Max 10MB per document.' });
        return;
      }
      staged.push({ key, name: f.name, progress: 0, status: 'uploading', file: f });
      runCount += 1;
    });
    setTechnicalDocuments((c) => [...c, ...staged.map(({ file: _f, ...d }) => d)]);
    staged.forEach(({ key, file }) => {
      if (!file) return;
      void (async () => {
        try {
          const uploaded = await ApiService.uploadTechnicalDocument(file, (p) => updateDocumentItem(key, { progress: p }));
          if (!uploaded) throw new Error('Technical document upload is currently unavailable.');
          updateDocumentItem(key, { id: uploaded.id, name: uploaded.name, mimeType: uploaded.mimeType, byteSize: uploaded.byteSize, progress: 100, status: 'ready' });
        } catch (e) {
          updateDocumentItem(key, { status: 'error', message: e instanceof Error ? e.message : 'Document upload failed.' });
        }
      })();
    });
    if (docInputRef.current) docInputRef.current.value = '';
  }, [technicalDocuments, updateDocumentItem]);

  const materialOptions = useMemo(() => {
    switch (request.process) {
      case 'fdm': return ['pla', 'abs', 'petg', 'tpu'];
      case 'sla':
      case 'sls': return ['pla', 'abs', 'nylon'];
      case 'milling':
      case 'turning': return ['aluminum', 'steel'];
      case 'sheet': return ['steel', 'aluminum'];
      case 'injection': return ['abs', 'nylon', 'petg'];
      default: return [];
    }
  }, [request.process]);
  const usableUploadItems = useMemo(() => uploadItems.filter(isUploadItemReady), [uploadItems]);
  const explicitlySelectedIds = useMemo(() => usableUploadItems.filter((i) => fileSetupStates[i.id]?.selected).map((i) => i.id), [usableUploadItems, fileSetupStates]);
  const materialSelectedIds = materialSelectionInitialized ? explicitlySelectedIds : usableUploadItems.map((i) => i.id);
  const activeMaterialId = selectedSetupId || materialSelectedIds[0] || usableUploadItems[0]?.id || null;
  const activeMaterialItem = activeMaterialId ? usableUploadItems.find((i) => i.id === activeMaterialId) : undefined;
  const activeMaterialConfig = activeMaterialId ? fileConfigurations[activeMaterialItem?.cadFile?.id || activeMaterialId] : undefined;

  const updateMaterialConfiguration = useCallback((update: Partial<FileConfiguration>, applyToAll = false, targetItemId: string | null = null) => {
    const targets = targetItemId ? [targetItemId] : applyToAll ? materialSelectedIds : activeMaterialId ? [activeMaterialId] : [];
    if (!targets.length) return;
    const def: FileConfiguration = { technology: request.technology, process: request.process, material: request.material, quantity: request.quantity, quality: request.quality, color: request.color, finish: request.finish, tolerance: request.tolerance };
    setFileConfigurations((c) => { const n = { ...c }; targets.forEach((id) => { const item = usableUploadItems.find((x) => x.id === id); const cid = item?.cadFile?.id || id; n[cid] = { ...def, ...(c[cid] || {}), ...update }; }); return n; });
    updateRequest({ material: update.material ?? request.material, color: update.color ?? request.color });
  }, [materialSelectedIds, activeMaterialId, request, usableUploadItems, updateRequest]);

  const updateSelectedConfigurations = useCallback((update: Partial<FileConfiguration>) => {
    const targetId = activeMaterialId || usableUploadItems[0]?.id || null;
    if (!targetId) return;
    const item = usableUploadItems.find((x) => x.id === targetId);
    const cid = item?.cadFile?.id || targetId;
    const def: FileConfiguration = { technology: request.technology, process: request.process, material: request.material, quantity: request.quantity, quality: request.quality, color: request.color, finish: request.finish, tolerance: request.tolerance };
    setFileConfigurations((c) => ({ ...c, [cid]: { ...def, ...(c[cid] || {}), ...update } }));
  }, [activeMaterialId, request, usableUploadItems]);

  const handleConfigUpdate = useCallback((p: Partial<RequestState>) => {
    if (hasOwn(p, 'quality') || hasOwn(p, 'finish') || hasOwn(p, 'tolerance') || hasOwn(p, 'quantity') || hasOwn(p, 'wallCount') || hasOwn(p, 'infillPercent')) setConfigTouched(true);
    updateRequest(p);
    const cu: Partial<FileConfiguration> = {};
    if (hasOwn(p, 'quantity')) cu.quantity = p.quantity as number;
    if (hasOwn(p, 'quality')) cu.quality = p.quality as string;
    if (hasOwn(p, 'color')) cu.color = p.color as string;
    if (hasOwn(p, 'finish')) cu.finish = p.finish as string;
    if (hasOwn(p, 'tolerance')) cu.tolerance = p.tolerance as string;
    if (hasOwn(p, 'wallCount')) cu.wallCount = p.wallCount as number;
    if (hasOwn(p, 'infillPercent')) cu.infillPercent = p.infillPercent as number | null;
    if (Object.keys(cu).length > 0) updateSelectedConfigurations(cu);
  }, [updateRequest, updateSelectedConfigurations]);

  const openPreview = useCallback((f: CadFile) => { modalTriggerRef.current = document.activeElement instanceof HTMLElement ? document.activeElement : null; setPreviewFile(f); }, []);
  const openDelete = useCallback((i: UploadItem) => { modalTriggerRef.current = document.activeElement instanceof HTMLElement ? document.activeElement : null; setDeleteItem(i); }, []);

  const submit = useCallback(async () => {
    if (submissionInFlightRef.current || !request.cadFile || !request.process || !request.material || !areAllUploadsReady(uploadItems)) return;
    if (!isAuthenticated) { setAuthGateOpen(true); openAuthModal('login'); return; }
    submissionInFlightRef.current = true; setIsSubmitting(true);
    const technicalDocumentIds = technicalDocuments.filter((d) => d.status === 'ready' && d.id).map((d) => d.id!);
    try {
      const savedQuote = await ApiService.createQuote({ partName: request.cadFile.name, technology: request.process.toUpperCase(), material: request.material, quantity: request.quantity, toleranceGrade: request.tolerance, surfaceFinish: request.finish, technicalNotes: note, technicalDocumentIds, cadFileIds: usableUploadItems.flatMap((i) => i.cadFile ? [i.cadFile.id] : []), files: usableUploadItems.map((i) => { const cfg = fileConfigurations[i.cadFile!.id] || { process: request.process, material: request.material, quantity: request.quantity, finish: request.finish, tolerance: request.tolerance, quality: request.quality, wallCount: request.wallCount }; const md = i.cadFile!.latestVersion?.metadata as any; const q = cfg.quality || request.quality; const w = cfg.wallCount ?? request.wallCount; return { fileId: i.cadFile!.id, fileName: i.cadFile!.name, format: i.cadFile!.format, materialId: cfg.material || request.material, technology: (cfg.process || request.process || 'fdm').toUpperCase(), surfaceFinish: cfg.finish || request.finish, toleranceGrade: cfg.tolerance === 'precision' ? 'precision' as const : 'standard' as const, quantity: cfg.quantity || request.quantity, volumeCm3: md?.volume, surfaceAreaCm2: md?.surfaceArea, triangleCount: md?.triangleCount, manufacturingParameters: fdmParametersFor(q, w, cfg.supportEnabled, (cfg as Partial<FileConfiguration>).infillPercent ?? null) }; }) });
      if (!savedQuote) throw new Error('Could not save quote.');
      const order = await ApiService.createOrder({ partName: request.cadFile.name, cadFileIds: uploadItems.filter(isUploadItemReady).flatMap((i) => i.cadFile ? [i.cadFile.id] : []), cadFileConfigs: uploadItems.filter(isUploadItemReady).flatMap((i) => { const cfg = fileConfigurations[i.cadFile!.id] || { process: request.process, technology: request.technology, material: request.material, quantity: request.quantity, quality: request.quality, color: request.color, finish: request.finish, tolerance: request.tolerance }; return [{ cadFileId: i.cadFile!.id, configuration: cfg, totalCost: quote?.formattedTotalPrice }]; }), technology: request.process.toUpperCase(), material: request.material, quantity: request.quantity, totalCost: quote ? priceWithPriority(quote.formattedTotalPrice, priorityShipping) : 'Pending', tolerance: request.tolerance, quoteId: savedQuote.id, technicalNotes: note, technicalDocumentIds, priorityShipping });
      if (!order) throw new Error('Could not submit request.');
    } catch (e) { setError(e instanceof Error ? e.message : 'Could not submit.'); } finally { submissionInFlightRef.current = false; setIsSubmitting(false); }
  }, [request, uploadItems, isAuthenticated, openAuthModal, usableUploadItems, fileConfigurations, quote, technicalDocuments, note]);

  useEffect(() => { if (!isAuthenticated || !authGateOpen) return; setAuthGateOpen(false); void submit(); }, [isAuthenticated, authGateOpen, submit]);

  const selectedQuoteColor = activeMaterialConfig?.color || request.color || 'any';
  const activeSupportEnabled = activeMaterialConfig?.supportEnabled ?? false;

  // Per-file configuration: mirror the selected file's config into the request
  // so the Configuration panel (bound to `request`) always reflects the
  // currently-selected file. Each file owns its own independent configuration.
  useEffect(() => {
    const cfg = activeMaterialConfig;
    setRequest((c) => ({
      ...c,
      material: cfg?.material !== undefined ? cfg.material : c.material,
      quantity: cfg?.quantity !== undefined ? cfg.quantity : c.quantity,
      quality: cfg?.quality !== undefined ? cfg.quality : c.quality,
      color: cfg?.color !== undefined ? cfg.color : c.color,
      finish: cfg?.finish !== undefined ? cfg.finish : c.finish,
      tolerance: cfg?.tolerance !== undefined ? cfg.tolerance : c.tolerance,
      wallCount: cfg?.wallCount !== undefined ? cfg.wallCount : c.wallCount,
      infillPercent: cfg?.infillPercent !== undefined ? cfg.infillPercent : c.infillPercent,
    }));
  }, [activeMaterialId, activeMaterialConfig]);

  // ── Render ───────────────────────────────────────────────────────────────
  const isSettled = entryStage === 'workspace';
  const showSurrounding = entryStage === 'reveal' || isSettled;
  const showUpload = entryStage === 'upload-focus' || entryStage === 'reveal' || isSettled;

  const pose = entryPoses(entryStage, rtlRef.current ? -1 : 1, reducedMotionRef.current, focusDelta);
  const trans = (key: keyof EntryPoseSet) => entryTransition(entryStage, key, reducedMotionRef.current);

  return (
    <main
      className="mw-workspace"
      data-entry={entryStage}
      aria-live="polite"
      onPointerDownCapture={(e) => {
        if (entryStage !== 'upload-focus') return;
        if (!(e.target as HTMLElement).closest('.mw-panel-upload') && areAllUploadsReady(uploadItems)) setEntryStage('reveal');
      }}
    >
      {/* Full-viewport engineering canvas — three logical columns of panels */}
      <div className="mw-canvas">
        <AnimatePresence>
          {error && (
            <motion.div
              key="mw-error"
              className="mw-error-bar cam-motion"
              role="alert"
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              transition={{ duration: 0.18, ease: CAM_EASE }}
            >
              <Icon name="close" size={12} /> {error}
            </motion.div>
          )}
          {toast && (
            <motion.div
              key="mw-toast"
              className="mw-toast cam-motion"
              role="status"
              initial={{ opacity: 0, y: 8 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: 8 }}
              transition={{ duration: 0.18, ease: CAM_EASE }}
            >
              <Icon name="check" size={12} /> {toast}
            </motion.div>
          )}
        </AnimatePresence>

        <div className="mw-workspace-grid" ref={gridRef}>
          {/* ── LEFT — Technology + Process travel as one block during focus,
              then settle into the column. Material rests below them. */}
          <aside className="mw-col mw-col-left">
            <motion.div
              ref={leftBlockRef}
              className="mw-entry-left-block"
              animate={pose.leftBlock}
              transition={trans('leftBlock')}
              onAnimationComplete={() => {
                if (entryStage === 'morph' && request.process) setEntryStage('upload-focus');
              }}
            >
              <TechnologyPanel
                request={request}
                status={techStatus}
                className="mw-panel-tech"
                onSelectTechnology={(tech) => {
                  if (tech !== request.technology) { invalidateQuote(); if (uploadItems.length > 0) void clearAllUploads(); }
                  updateRequest({ technology: tech, process: null, material: null, cadFile: null, geometry: null });
                  setConfigTouched(false);
                  if (entryStage === 'tech-focus') {
                    setEntryStage('process-focus');
                  }
                }}
              />

              <AnimatePresence>
                {(entryStage !== 'tech-focus' || request.technology) && (
                  <motion.div
                    key="mw-process-wrapper"
                    initial={{ opacity: 0, y: 12, scale: 0.98 }}
                    animate={{ opacity: 1, y: 0, scale: 1 }}
                    exit={{ opacity: 0, y: 8, scale: 0.98 }}
                    transition={{ duration: 0.26, ease: CAM_EASE }}
                  >
                    <ProcessPanel
                      request={request}
                      status={processStatus}
                      className="mw-panel-process"
                      showNextButton={entryStage === 'process-focus'}
                      onNext={() => setEntryStage('morph')}
                      t={t}
                      onSelectProcess={(p) => {
                        if (p !== request.process) { invalidateQuote(); if (uploadItems.length > 0) void clearAllUploads(); }
                        updateRequest({ technology: request.technology ?? 'printing', process: p, material: p === 'fdm' ? 'pla' : null, cadFile: null, geometry: null });
                        setConfigTouched(false);
                      }}
                    />
                  </motion.div>
                )}
              </AnimatePresence>
            </motion.div>

            <AnimatePresence>
              {showSurrounding && (
                <motion.div
                  key="mw-material-wrap"
                  className="mw-mw-material"
                  initial={isSettled ? false : { opacity: 0, y: 14 }}
                  animate={{ opacity: 1, y: 0 }}
                  exit={{ opacity: 0 }}
                  transition={{ duration: 0.28, ease: CAM_EASE }}
                >
                  <MaterialPanel
                    request={request}
                    materialOptions={materialOptions}
                    selectedColor={selectedQuoteColor}
                    status={materialStatus}
                    t={t}
                    className="mw-panel-material"
                    onSelectMaterial={(m) => updateMaterialConfiguration({ material: m })}
                    onColorChange={(c) => updateMaterialConfiguration({ color: c })}
                  />
                </motion.div>
              )}
            </AnimatePresence>
          </aside>

          {/* ── CENTER — Upload focus grows here, Viewer and Dock settle during reveal */}
          <main className="mw-col mw-col-center">
            <AnimatePresence>
              {showUpload && (
                <motion.div
                  key="mw-upload-wrap"
                  className="mw-mw-upload"
                  initial={isSettled ? false : { opacity: 0, y: 14, scale: 0.98 }}
                  animate={pose.upload}
                  exit={{ opacity: 0 }}
                  transition={trans('upload')}
                >
                  <UploadPanel
                    status={uploadStatus}
                    hasProcess={hasProcess}
                    isDragging={isDragging}
                    isUploading={uploadBusy}
                    uploadItems={uploadItems}
                    fileConfigurations={fileConfigurations}
                    request={request}
                    thumbnails={thumbnails}
                    thumbFailed={thumbFailed}
                    activeThumbIds={activeThumbIds}
                    onBrowse={() => inputRef.current?.click()}
                    onFiles={addFiles}
                    onDragState={setIsDragging}
                    onDelete={openDelete}
                    onPreview={openPreview}
                    onClearAll={clearAllUploads}
                    t={t}
                  />
                </motion.div>
              )}
            </AnimatePresence>

            <AnimatePresence>
              {showSurrounding && (
                <>
                  <motion.div
                    key="mw-viewer-wrap"
                    className="mw-mw-viewer"
                    initial={isSettled ? false : { opacity: 0, y: 16 }}
                    animate={{ opacity: 1, y: 0 }}
                    exit={{ opacity: 0 }}
                    transition={{ duration: 0.3, delay: 0.08, ease: CAM_EASE }}
                  >
                    <ViewerPanel
                      status={activeMaterialItem?.cadFile ? undefined : 'inactive'}
                      activeItem={activeMaterialItem}
                      fileSetupStates={fileSetupStates}
                      materialId={activeMaterialConfig?.material ?? request.material ?? null}
                      colorId={activeMaterialConfig?.color ?? request.color ?? null}
                      onGeometry={(g, id) => {
                        updateRequest({ geometry: g });
                        const u: ModelUnit = g.metadata?.units ? (g.metadata.units.toLowerCase().includes('in') ? 'in' : g.metadata.units.toLowerCase().includes('cm') ? 'cm' : 'mm') : 'mm';
                        setFileSetupStates((c) => ({ ...c, [id]: { ...(c[id] || { unit: u, dimensions: null, baseDimensions: null, volume: null, surfaceArea: null, triangleCount: null, selected: false }), dimensions: g.metadata?.dimensions ? { x: g.metadata.dimensions.width, y: g.metadata.dimensions.height, z: g.metadata.dimensions.depth } : null, baseDimensions: g.metadata?.dimensions ? { x: g.metadata.dimensions.width, y: g.metadata.dimensions.height, z: g.metadata.dimensions.depth } : null, volume: g.metadata?.volume ?? null, surfaceArea: g.metadata?.surfaceArea ?? null, triangleCount: g.metadata?.triangleCount ?? null } }));
                      }}
                    />
                  </motion.div>

                  <motion.div
                    key="mw-dock-wrap"
                    className="mw-mw-dock mw-center-dock"
                    initial={isSettled ? false : { opacity: 0, y: 16 }}
                    animate={{ opacity: 1, y: 0 }}
                    exit={{ opacity: 0 }}
                    transition={{ duration: 0.28, delay: 0.16, ease: CAM_EASE }}
                  >
                    <ConfigurationPanel
                      request={request}
                      isPrinting={isPrinting}
                      activeConfigTab={activeConfigTab}
                      configReady={hasProcess && hasMaterial && uploadsDone}
                      status={configStatus}
                      selectedSupportEnabled={activeSupportEnabled}
                      priorityShipping={priorityShipping}
                      onTabChange={setActiveConfigTab}
                      onUpdate={handleConfigUpdate}
                      onConfigUpdate={(u) => updateMaterialConfiguration(u)}
                      onPriorityShippingChange={setPriorityShipping}
                    />

                    <NotesPanel
                      note={note}
                      onNoteChange={setNote}
                      documents={technicalDocuments}
                      isDragging={isDocDragging}
                      onBrowse={() => docInputRef.current?.click()}
                      onDocs={handleDocs}
                      onDragState={setIsDocDragging}
                      onRemove={removeDocument}
                      onPreview={setPreviewDoc}
                    />
                  </motion.div>
                </>
              )}
            </AnimatePresence>
          </main>

          {/* ── RIGHT — Review / Quote, settles last during the reveal ──── */}
          <aside className="mw-col mw-col-right">
            <AnimatePresence>
              {showSurrounding && (
                <motion.div
                  key="mw-right-wrap"
                  className="mw-mw-right"
                  initial={isSettled ? false : { opacity: 0, y: 16 }}
                  animate={{ opacity: 1, y: 0 }}
                  exit={{ opacity: 0 }}
                  transition={{ duration: 0.3, delay: 0.24, ease: CAM_EASE }}
                  onAnimationComplete={() => {
                    if (entryStage === 'reveal' && areAllUploadsReady(uploadItems)) setEntryStage('workspace');
                  }}
                >
                  <ErrorBoundary
                    label="quote-panel"
                    fallback={(error, retry) => (
                      <div className="mw-panel mw-panel-quote" role="alert">
                        <div className="mw-error-boundary-inner">
                          <strong>Your quote could not be displayed.</strong>
                          <p>{error.message || 'An unexpected error occurred.'}</p>
                          <button type="button" className="mw-btn mw-btn-secondary" onClick={retry}>Retry quote</button>
                        </div>
                      </div>
                    )}
                  >
                    <QuotePanel
                      request={request}
                      quote={quote}
                      isCalculatingQuote={isCalculatingQuote}
                      quoteFailed={quoteFailed}
                      usableUploadItems={usableUploadItems}
                      fileConfigurations={fileConfigurations}
                      thumbnails={thumbnails}
                      thumbFailed={thumbFailed}
                      activeThumbIds={activeThumbIds}
                      selectedSetupId={selectedSetupId}
                      orderReady={orderReady}
                      authGateOpen={authGateOpen}
                      onConfigUpdate={(u, id) => updateMaterialConfiguration(u, false, id)}
                      onSelectItem={setSelectedSetupId}
                      isAuthenticated={isAuthenticated}
                      isSubmitting={isSubmitting}
                      onSignIn={() => openAuthModal('login')}
                      onRegister={() => openAuthModal('register')}
                      onSubmit={() => void submit()}
                      priorityShipping={priorityShipping}
                      onPriorityShippingChange={setPriorityShipping}
                      t={t}
                    />
                  </ErrorBoundary>
                </motion.div>
              )}
            </AnimatePresence>
          </aside>
        </div>
      </div>

      {/* Hidden file input */}
      <input ref={inputRef} hidden type="file" multiple accept=".step,.stp,.stl,.obj,.ply,.dxf,.svg,.pdf,.iges,.igs" onChange={(e) => addFiles(Array.from(e.target.files || []))} />
      <input ref={docInputRef} hidden type="file" multiple accept=".pdf,.doc,.docx,.txt,.rtf,.png,.jpg,.jpeg" onChange={(e) => handleDocs(Array.from(e.target.files || []))} />

      {/* Preview Modal */}
      <AnimatePresence>
        {previewFile && (
          <motion.div
            className="mw-modal-backdrop cam-motion"
            role="dialog"
            aria-modal="true"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            transition={{ duration: 0.16, ease: CAM_EASE }}
            onMouseDown={(e) => { if (e.target === e.currentTarget) setPreviewFile(null); }}
          >
            <motion.div
              ref={modalRef}
              className="mw-modal cam-motion"
              style={{ maxWidth: 960 }}
              initial={{ opacity: 0, y: 14, scale: 0.98 }}
              animate={{ opacity: 1, y: 0, scale: 1 }}
              exit={{ opacity: 0, y: 8, scale: 0.985 }}
              transition={{ duration: 0.22, ease: CAM_EASE }}
            >
              <div className="mw-modal-header">
                <div className="mw-modal-title"><Icon name="cube" size={16} /> {previewFile.name}</div>
                <button className="mw-modal-close" onClick={() => setPreviewFile(null)}><Icon name="close" size={14} /></button>
              </div>
              <div className="mw-modal-body" style={{ padding: 0 }}>
                <ErrorBoundary
                  label="cad-viewer-preview"
                  fallback={(error, retry) => (
                    <div className="mw-stage-viewer-empty" role="alert" style={{ minHeight: 420, justifyContent: 'center' }}>
                      <span className="mw-stage-viewer-empty-icon"><Icon name="cube" size={22} /></span>
                      <span className="mw-stage-viewer-empty-text">The 3D preview could not start on this device.</span>
                      <span className="mw-stage-viewer-empty-hint">{error.message || 'WebGL may be unavailable or a graphics driver failed.'}</span>
                      <button type="button" className="mw-btn mw-btn-secondary" onClick={retry}>Retry preview</button>
                    </div>
                  )}
                >
                  <CadGeometryViewer file={previewFile} onGeometry={() => undefined} materialId={fileConfigurations[previewFile.id]?.material ?? request.material ?? null} colorId={fileConfigurations[previewFile.id]?.color ?? request.color ?? null} />
                </ErrorBoundary>
              </div>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Delete Modal */}
      <AnimatePresence>
        {deleteItem && (
          <motion.div
            className="mw-modal-backdrop cam-motion"
            role="alertdialog"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            transition={{ duration: 0.16, ease: CAM_EASE }}
            onMouseDown={(e) => { if (e.target === e.currentTarget && !isDeleting) setDeleteItem(null); }}
          >
            <motion.div
              ref={modalRef}
              className="mw-modal mw-delete-modal cam-motion"
              initial={{ opacity: 0, y: 14, scale: 0.98 }}
              animate={{ opacity: 1, y: 0, scale: 1 }}
              exit={{ opacity: 0, y: 8, scale: 0.985 }}
              transition={{ duration: 0.22, ease: CAM_EASE }}
            >
              <div className="mw-modal-header">
                <div className="mw-modal-title">Remove File</div>
                <button className="mw-modal-close" disabled={isDeleting} onClick={() => setDeleteItem(null)}><Icon name="close" size={14} /></button>
              </div>
              <div className="mw-modal-body">
                <div className="mw-delete-text">This will permanently remove the file from your quote.</div>
                <div className="mw-delete-filename">{deleteItem.name}</div>
              </div>
              <div className="mw-modal-actions">
                <button className="mw-btn mw-btn-secondary" style={{ width: 'auto' }} disabled={isDeleting} onClick={() => setDeleteItem(null)}>Cancel</button>
                <button className="mw-btn mw-btn-danger" style={{ width: 'auto' }} disabled={isDeleting} onClick={() => void confirmDelete()}>{isDeleting ? 'Removing...' : 'Remove'}</button>
              </div>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Technical Document Preview */}
      <AnimatePresence>
        {previewDoc && <TechnicalDocumentPreview key={previewDoc.key} doc={previewDoc} onClose={() => setPreviewDoc(null)} />}
      </AnimatePresence>
    </main>
  );
};

export default ManufacturingRequestView;

