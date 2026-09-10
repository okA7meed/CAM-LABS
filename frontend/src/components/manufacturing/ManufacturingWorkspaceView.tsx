import React, { DragEvent, useCallback, useEffect, useMemo, useRef, useState } from 'react';
import '../../styles/manufacturing-workspace.css';
import { ApiError, ApiService, CalculatedQuotationData, MultiFileQuotation, CadGeometryData } from '../../services/api';
import { CadFile } from '../../types';
import { useStore } from '../../context/StoreContext';
import { useAuth } from '../../context/AuthContext';
import { useTranslation } from 'react-i18next';
import { CadGeometryViewer } from './CadGeometryViewer';
import { Icon, IconName } from '../ui/Icon';
import { ModelDimensions, ModelUnit } from '../../utils/modelUnits';
import { RequiredMark } from '../ui/FieldLabel';
import { useMaterials } from '../../hooks/useMaterials';
import { PriceEstimateNotice } from '../ui/PriceEstimateNotice';
import { PriceTransition } from '../ui/PriceTransition';
import { UploadItemStatus, UploadValidationState, areAllUploadsReady, hasUploadInFlight, isCadFileReady, isUploadItemReady } from './uploadState';

// ── Layout shell ───────────────────────────────────────────────────────────
type PanelStatus = 'active' | 'completed' | 'inactive';

interface PanelShellProps {
  icon: IconName;
  title: string;
  subtitle?: string;
  status?: PanelStatus;
  id?: string;
  className?: string;
  action?: React.ReactNode;
  children: React.ReactNode;
}

const panelStatusClass = (done: boolean, upstreamReady: boolean): PanelStatus => (!upstreamReady ? 'inactive' : done ? 'completed' : 'active');

const PanelShell = ({ icon, title, subtitle, status, id, className, action, children }: PanelShellProps) => (
  <section id={id} tabIndex={-1} className={`mw-panel ${status ? `is-${status}` : ''} ${className || ''}`}>
    <header className="mw-panel-header">
      {status === 'completed' && (
        <span className="mw-panel-state-mark is-completed" aria-hidden="true"><Icon name="check" size={11} /></span>
      )}
      <span className="mw-panel-head-icon" aria-hidden="true"><Icon name={icon} size={16} /></span>
      <div className="mw-panel-head-text">
        <div className="mw-panel-title">{title}</div>
        {subtitle && <div className="mw-panel-subtitle">{subtitle}</div>}
      </div>
      {status === 'active' && <span className="mw-panel-state-mark is-now" aria-hidden="true" />}
      {action && <div className="mw-panel-action">{action}</div>}
    </header>
    <div className="mw-panel-body">{children}</div>
  </section>
);

// ── Types ──────────────────────────────────────────────────────────────────
type TechnologyId = 'printing' | 'cnc' | 'sheet' | 'injection';
type ProcessId = 'fdm' | 'sla' | 'sls' | 'milling' | 'turning' | 'sheet' | 'injection';
type QuoteData = CalculatedQuotationData | MultiFileQuotation;

const isMultiFileQuote = (d: QuoteData | null): d is MultiFileQuotation => Boolean(d && 'files' in d);
const hasOwn = <T extends object>(o: T, k: PropertyKey): k is keyof T => Object.prototype.hasOwnProperty.call(o, k);

interface UploadItem {
  id: string; name: string; format: string; sizeBytes: number; size: string;
  status: UploadItemStatus; validationState: UploadValidationState; processingComplete: boolean;
  progress: number; message?: string; cadFile?: CadFile;
}
interface FileSetupState {
  unit: ModelUnit; dimensions: ModelDimensions | null; baseDimensions: ModelDimensions | null;
  volume: number | null; surfaceArea: number | null; triangleCount: number | null; selected: boolean;
}
type FileConfiguration = { technology: string | null; process: string | null; material: string | null; quantity: number; quality: string; color: string; finish: string; tolerance: string; wallCount?: number; supportEnabled?: boolean; infillPercent?: number | null };
interface RequestState {
  cadFile: CadFile | null; technology: TechnologyId | null; process: ProcessId | null;
  material: string | null; quantity: number; quality: string; color: string; finish: string;
  tolerance: string; wallCount: number; infillPercent?: number | null; geometry: CadGeometryData | null;
}

// ── Constants ──────────────────────────────────────────────────────────────
const initialState: RequestState = { cadFile: null, technology: null, process: null, material: null, quantity: 1, quality: 'standard', color: 'any', finish: 'standard', tolerance: 'standard', wallCount: 3, infillPercent: null, geometry: null };
const processGroups = [
  { group: 'printing', options: ['fdm', 'sla', 'sls'] },
  { group: 'cnc', options: ['milling', 'turning'] },
  { group: 'sheetMetal', options: ['sheet'] },
  { group: 'injection', options: ['injection'] },
] as const;
const MAX_UPLOAD_FILES = 20; const MAX_UPLOAD_FILE_SIZE_BYTES = 500 * 1024 * 1024; const MAX_UPLOAD_TOTAL_BYTES = 2 * 1024 * 1024 * 1024;
const DRAFT_KEY = 'cw-manufacturing-draft-v1';
const INFILL_OPTIONS = [
  { id: 'hollow', title: '0% (Hollow)', description: 'Completely hollow interior', infillPercent: 0, wallCount: 2, layerHeightMm: 0.28 },
  { id: 'sparse', title: '10% (Sparse)', description: 'Minimal infill for decorative parts', infillPercent: 10, wallCount: 2, layerHeightMm: 0.24 },
  { id: 'standard', title: '15% (Standard)', description: 'Standard lightweight infill', infillPercent: 15, wallCount: 3, layerHeightMm: 0.2 },
  { id: 'high', title: '30% (Moderate)', description: 'Good balance of strength and weight', infillPercent: 30, wallCount: 4, layerHeightMm: 0.16 },
  { id: 'dense', title: '50% (Dense)', description: 'High-density infill', infillPercent: 50, wallCount: 4, layerHeightMm: 0.14 },
  { id: 'verydense', title: '75% (Very Dense)', description: '', infillPercent: 75, wallCount: 4, layerHeightMm: 0.12 },
  { id: 'premium', title: '100% (Solid)', description: 'Completely solid', infillPercent: 100, wallCount: 5, layerHeightMm: 0.1 },
  { id: 'heavyduty', title: 'Heavy Duty (5 walls)', description: 'Maximum wall durability', infillPercent: 100, wallCount: 5, layerHeightMm: 0.1 },
] as const;
const WALL_OPTIONS = [{ walls: 1, title: '1' }, { walls: 2, title: '2' }, { walls: 3, title: '3' }, { walls: 4, title: '4' }, { walls: 5, title: '5' }] as const;
const isIntegerInfill = (v: unknown): v is number => typeof v === 'number' && Number.isInteger(v) && v >= 0 && v <= 100;
const normalizeInfillInput = (raw: string): number | null => { const n = Number(raw.trim()); if (!Number.isFinite(n)) return null; const rounded = Math.round(n); return Math.max(0, Math.min(100, rounded)); };
const fdmParametersFor = (quality: string, wallCount: number, supportEnabled = false, customInfillPercent?: number | null) => { const p = INFILL_OPTIONS.find((o) => o.id === quality) ?? INFILL_OPTIONS.find((o) => o.id === 'standard')!; const infillPercent = isIntegerInfill(customInfillPercent) ? customInfillPercent : p.infillPercent; return { layerHeightMm: p.layerHeightMm, infillPercent, wallCount, supportEnabled }; };

const TECH_OPTIONS: Array<{ id: TechnologyId; label: string; desc: string; icon: IconName; badge?: string }> = [
  { id: 'printing', label: '3D Printing', desc: 'FDM / SLA / SLS', icon: 'technology' },
  { id: 'cnc', label: 'CNC Machining', desc: 'Milling / Turning', icon: 'cpu' },
  { id: 'sheet', label: 'Laser Cutting', desc: '2D / 3D', icon: 'file' },
  { id: 'injection', label: 'Injection Molding', desc: 'ABS / Nylon', icon: 'precision' },
];

const PROCESS_INFO: Record<ProcessId, { title: string; desc: string; icon: IconName; badge?: string }> = {
  fdm: { title: 'FDM Printing', desc: 'Fused Deposition Modeling — versatile, fast, cost-effective for functional prototypes', icon: 'layers', badge: 'Most Popular' },
  sla: { title: 'SLA Printing', desc: 'Stereolithography — high detail, smooth surface finish for visual prototypes', icon: 'layers3' },
  sls: { title: 'SLS Printing', desc: 'Selective Laser Sintering — strong, durable parts without support structures', icon: 'layers' },
  milling: { title: 'CNC Milling', desc: 'Subtractive precision machining from solid billets', icon: 'cpu' },
  turning: { title: 'CNC Turning', desc: 'Precision turned parts on CNC lathes', icon: 'cpu' },
  sheet: { title: 'Sheet Cutting', desc: 'Laser or waterjet cutting of sheet materials', icon: 'file' },
  injection: { title: 'Injection Molding', desc: 'High-volume plastic production through precision molds', icon: 'precision', badge: 'Tooling' },
};

const MATERIAL_SWATCHES: Record<string, string> = {
  pla: 'linear-gradient(135deg, #f5426c, #ff9f45)', abs: 'linear-gradient(135deg, #4f5b66, #aab5c0)',
  petg: 'linear-gradient(135deg, #00b4d8, #90e0ef)', tpu: 'linear-gradient(135deg, #333, #6b7280)',
  nylon: 'linear-gradient(135deg, #d4c29a, #8a7f5e)', aluminum: 'linear-gradient(135deg, #c0c8d0, #7d8590)',
  steel: 'linear-gradient(135deg, #9aa5b1, #475159)',
};

const MATERIAL_COLORS = ['any', 'black', 'white', 'red', 'blue', 'green', 'yellow', 'orange', 'purple', 'gray'];
const materialColor = (c: string) => (c === 'any' ? '#6B7A92' : c === 'black' ? '#1a1a1a' : c === 'white' ? '#f0f0f0' : c === 'red' ? '#e53e3e' : c === 'blue' ? '#3182ce' : c === 'green' ? '#38a169' : c === 'yellow' ? '#d69e2e' : c === 'orange' ? '#dd6b20' : c === 'purple' ? '#805ad5' : '#a0aec0');

const MATERIAL_PROPERTIES: Record<string, { icon: IconName; label: string }[]> = {
  pla: [
    { icon: 'layers', label: 'FDM printed' },
    { icon: 'globe', label: 'Biodegradable' },
  ],
  abs: [
    { icon: 'layers', label: 'FDM printed' },
    { icon: 'shieldCheck', label: 'Impact resistant' },
  ],
  petg: [
    { icon: 'layers', label: 'FDM printed' },
    { icon: 'globe', label: 'Water resistant' },
  ],
  tpu: [
    { icon: 'layers', label: 'FDM printed' },
    { icon: 'layers3', label: 'Flexible' },
  ],
  nylon: [
    { icon: 'layers', label: 'FDM printed' },
    { icon: 'shieldCheck', label: 'Abrasion resistant' },
  ],
  aluminum: [
    { icon: 'cpu', label: 'CNC machined' },
    { icon: 'shieldCheck', label: 'High strength' },
  ],
  steel: [
    { icon: 'cpu', label: 'CNC machined' },
    { icon: 'shieldCheck', label: 'Maximum strength' },
  ],
};

const panelIds = {
  technology: 'mw-sec-tech', process: 'mw-sec-process', material: 'mw-sec-material',
  upload: 'mw-sec-upload', viewer: 'mw-sec-viewer', config: 'mw-sec-config', notes: 'mw-sec-notes', quote: 'mw-sec-quote',
} as const;

// ── Main Component ─────────────────────────────────────────────────────────
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
  const [activeConfigTab, setActiveConfigTab] = useState<'basic' | 'advanced'>('basic');
  const [priorityShipping, setPriorityShipping] = useState(false);

  const submissionInFlightRef = useRef(false);
  const quoteRequestVersionRef = useRef(0);
  const quoteAbortControllerRef = useRef<AbortController | null>(null);
  const inputRef = useRef<HTMLInputElement>(null);
  const modalRef = useRef<HTMLDivElement>(null);
  const modalTriggerRef = useRef<HTMLElement | null>(null);
  const primaryUploadIdRef = useRef<string | null>(null);
  const activeUploadTokensRef = useRef<Record<string, string>>({});
  const uploadLifecycleBusyRef = useRef(false);
  const restoredRef = useRef(false);

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
  const invalidateQuote = useCallback(() => { quoteRequestVersionRef.current += 1; quoteAbortControllerRef.current?.abort(); setQuote(null); setQuoteFailed(false); }, []);
  const setUploadBusy = useCallback((b: boolean) => { uploadLifecycleBusyRef.current = b; }, []);

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

  // ── Save draft (existing local persistence, unchanged) ───────────────────
  useEffect(() => {
    if (restoredRef.current) return;
    restoredRef.current = true;
    try {
      const raw = window.localStorage.getItem(DRAFT_KEY);
      if (!raw) return;
      const data = JSON.parse(raw);
      if (data?.request) setRequest((c) => ({ ...c, ...data.request }));
      if (typeof data.note === 'string') setNote(data.note);
      if (data.fileConfigurations) setFileConfigurations(data.fileConfigurations);
      if (data.fileSetupStates) setFileSetupStates(data.fileSetupStates);
      if (typeof data.configTouched === 'boolean') setConfigTouched(data.configTouched);
      if (data.activeConfigTab === 'advanced') setActiveConfigTab('advanced');
      setToast('Draft restored');
    } catch { /* ignore malformed draft */ }
  }, []);

  useEffect(() => {
    if (!toast) return;
    const id = window.setTimeout(() => setToast(''), 2600);
    return () => window.clearTimeout(id);
  }, [toast]);

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

  // ── Quote calculation (existing engine, unchanged) ───────────────────────
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
  }, [request.material, request.process, request.quality, request.finish, request.tolerance, request.quantity, request.wallCount, request.infillPercent, request.geometry, request.cadFile, fileConfigurations, uploadItems]);

  const updateUploadItem = useCallback((id: string, update: Partial<UploadItem>, token?: string) => {
    if (token && activeUploadTokensRef.current[id] !== token) return;
    setUploadItems((items) => items.map((item) => item.id === id ? { ...item, ...update } : item));
  }, []);

  const pollProcessing = useCallback(async (itemId: string, fileId: string): Promise<CadFile> => {
    for (let i = 0; i < 40; i++) {
      const files = await ApiService.getCadFiles();
      const f = files?.find((c) => c.id === fileId); const v = f?.latestVersion;
      if (v?.scanStatus === 'QUARANTINED' || v?.processingStatus === 'FAILED') throw new Error(v?.failureMessage || t('request.processingFailed'));
      if (v?.processingStatus === 'COMPLETE' && f && isCadFileReady(f)) return f;
      if (v?.processingStatus === 'COMPLETE' && f && !isCadFileReady(f)) throw new Error(t('request.processingFailed'));
      updateUploadItem(itemId, { status: v?.scanStatus === 'PENDING' ? 'scanning' : 'processing' });
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
    try {
      const savedQuote = await ApiService.createQuote({ partName: request.cadFile.name, technology: request.process.toUpperCase(), material: request.material, quantity: request.quantity, toleranceGrade: request.tolerance, surfaceFinish: request.finish, cadFileIds: usableUploadItems.flatMap((i) => i.cadFile ? [i.cadFile.id] : []), files: usableUploadItems.map((i) => { const cfg = fileConfigurations[i.cadFile!.id] || { process: request.process, material: request.material, quantity: request.quantity, finish: request.finish, tolerance: request.tolerance, quality: request.quality, wallCount: request.wallCount }; const md = i.cadFile!.latestVersion?.metadata as any; const q = cfg.quality || request.quality; const w = cfg.wallCount ?? request.wallCount; return { fileId: i.cadFile!.id, fileName: i.cadFile!.name, format: i.cadFile!.format, materialId: cfg.material || request.material, technology: (cfg.process || request.process || 'fdm').toUpperCase(), surfaceFinish: cfg.finish || request.finish, toleranceGrade: cfg.tolerance === 'precision' ? 'precision' as const : 'standard' as const, quantity: cfg.quantity || request.quantity, volumeCm3: md?.volume, surfaceAreaCm2: md?.surfaceArea, triangleCount: md?.triangleCount, manufacturingParameters: fdmParametersFor(q, w, cfg.supportEnabled, (cfg as Partial<FileConfiguration>).infillPercent ?? null) }; }) });
      if (!savedQuote) throw new Error('Could not save quote.');
      const order = await ApiService.createOrder({ partName: request.cadFile.name, cadFileIds: uploadItems.filter(isUploadItemReady).flatMap((i) => i.cadFile ? [i.cadFile.id] : []), cadFileConfigs: uploadItems.filter(isUploadItemReady).flatMap((i) => { const cfg = fileConfigurations[i.cadFile!.id] || { process: request.process, technology: request.technology, material: request.material, quantity: request.quantity, quality: request.quality, color: request.color, finish: request.finish, tolerance: request.tolerance }; return [{ cadFileId: i.cadFile!.id, configuration: cfg, totalCost: quote?.formattedTotalPrice }]; }), technology: request.process.toUpperCase(), material: request.material, quantity: request.quantity, totalCost: quote?.formattedTotalPrice || 'Pending', tolerance: request.tolerance, quoteId: savedQuote.id });
      if (!order) throw new Error('Could not submit request.');
    } catch (e) { setError(e instanceof Error ? e.message : 'Could not submit.'); } finally { submissionInFlightRef.current = false; setIsSubmitting(false); }
  }, [request, uploadItems, isAuthenticated, openAuthModal, usableUploadItems, fileConfigurations, quote]);

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
  return (
    <main className="mw-workspace" aria-live="polite">
      {/* Full-viewport engineering canvas — three logical columns of panels */}
      <div className="mw-canvas">
        {error && <div className="mw-error-bar" role="alert"><Icon name="close" size={12} /> {error}</div>}
        {toast && <div className="mw-toast" role="status"><Icon name="check" size={12} /> {toast}</div>}

        <div className="mw-workspace-grid">
          {/* ── LEFT — what am I manufacturing? ─────────────────────────────── */}
          <aside className="mw-col mw-col-left">
            <TechnologyPanel
              request={request}
              status={techStatus}
              onSelectTechnology={(tech) => {
                if (tech !== request.technology) { invalidateQuote(); if (uploadItems.length > 0) void clearAllUploads(); }
                updateRequest({ technology: tech, process: null, material: null, cadFile: null, geometry: null });
                setConfigTouched(false);
              }}
            />

            <ProcessPanel
              request={request}
              status={processStatus}
              onSelectProcess={(p) => {
                if (p !== request.process) { invalidateQuote(); if (uploadItems.length > 0) void clearAllUploads(); }
                updateRequest({ technology: request.technology ?? 'printing', process: p, material: p === 'fdm' ? 'pla' : null, cadFile: null, geometry: null });
                setConfigTouched(false);
              }}
            />

            <MaterialPanel
              request={request}
              materialOptions={materialOptions}
              selectedColor={selectedQuoteColor}
              status={materialStatus}
              t={t}
              onSelectMaterial={(m) => updateMaterialConfiguration({ material: m })}
              onColorChange={(c) => updateMaterialConfiguration({ color: c })}
            />

            <OrderSummaryPanel quote={quote} isCalculatingQuote={isCalculatingQuote} usableUploadItems={usableUploadItems} />
          </aside>

          {/* ── CENTER — how do I upload, inspect and configure my part? ────── */}
          <main className="mw-col mw-col-center">
            <UploadPanel
              status={uploadStatus}
              hasProcess={hasProcess}
              isDragging={isDragging}
              isUploading={uploadBusy}
              uploadItems={uploadItems}
              onBrowse={() => inputRef.current?.click()}
              onFiles={addFiles}
              onDragState={setIsDragging}
              onDelete={openDelete}
              onPreview={openPreview}
            />

            <ViewerPanel
              status={activeMaterialItem?.cadFile ? undefined : 'inactive'}
              activeItem={activeMaterialItem}
              fileSetupStates={fileSetupStates}
              onGeometry={(g, id) => {
                updateRequest({ geometry: g });
                const u: ModelUnit = g.metadata?.units ? (g.metadata.units.toLowerCase().includes('in') ? 'in' : g.metadata.units.toLowerCase().includes('cm') ? 'cm' : 'mm') : 'mm';
                setFileSetupStates((c) => ({ ...c, [id]: { ...(c[id] || { unit: u, dimensions: null, baseDimensions: null, volume: null, surfaceArea: null, triangleCount: null, selected: false }), dimensions: g.metadata?.dimensions ? { x: g.metadata.dimensions.width, y: g.metadata.dimensions.height, z: g.metadata.dimensions.depth } : null, baseDimensions: g.metadata?.dimensions ? { x: g.metadata.dimensions.width, y: g.metadata.dimensions.height, z: g.metadata.dimensions.depth } : null, volume: g.metadata?.volume ?? null, surfaceArea: g.metadata?.surfaceArea ?? null, triangleCount: g.metadata?.triangleCount ?? null } }));
              }}
            />

            <ConfigurationPanel
              request={request}
              isPrinting={isPrinting}
              activeConfigTab={activeConfigTab}
              configReady={hasProcess && hasMaterial && uploadsDone}
              status={configStatus}
              selectedSupportEnabled={activeSupportEnabled}
              onTabChange={setActiveConfigTab}
              onUpdate={handleConfigUpdate}
              onConfigUpdate={(u) => updateMaterialConfiguration(u)}
            />

            <NotesPanel note={note} onNoteChange={setNote} />
          </main>

          {/* ── RIGHT — what is in my order, how much, and how do I submit? ─── */}
          <aside className="mw-col mw-col-right">
            <QuotePanel
              request={request}
              quote={quote}
              isCalculatingQuote={isCalculatingQuote}
              quoteFailed={quoteFailed}
              usableUploadItems={usableUploadItems}
              fileConfigurations={fileConfigurations}
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
          </aside>
        </div>
      </div>

      {/* Hidden file input */}
      <input ref={inputRef} hidden type="file" multiple accept=".step,.stp,.stl,.obj,.ply,.dxf,.svg,.pdf,.iges,.igs" onChange={(e) => addFiles(Array.from(e.target.files || []))} />

      {/* Preview Modal */}
      {previewFile && (
        <div className="mw-modal-backdrop" role="dialog" aria-modal="true" onMouseDown={(e) => { if (e.target === e.currentTarget) setPreviewFile(null); }}>
          <div ref={modalRef} className="mw-modal" style={{ maxWidth: 960 }}>
            <div className="mw-modal-header">
              <div className="mw-modal-title"><Icon name="cube" size={16} /> {previewFile.name}</div>
              <button className="mw-modal-close" onClick={() => setPreviewFile(null)}><Icon name="close" size={14} /></button>
            </div>
            <div className="mw-modal-body" style={{ padding: 0 }}><CadGeometryViewer file={previewFile} onGeometry={() => undefined} /></div>
          </div>
        </div>
      )}

      {/* Delete Modal */}
      {deleteItem && (
        <div className="mw-modal-backdrop" role="alertdialog" onMouseDown={(e) => { if (e.target === e.currentTarget && !isDeleting) setDeleteItem(null); }}>
          <div ref={modalRef} className="mw-modal mw-delete-modal">
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
          </div>
        </div>
      )}
    </main>
  );
};

// ── LEFT PANELS ─────────────────────────────────────────────────────────────

// 9A. Select Technology
const TechnologyPanel = ({ request, status, onSelectTechnology }: {
  request: RequestState;
  status: PanelStatus;
  onSelectTechnology: (tech: TechnologyId) => void;
}) => (
  <PanelShell
    id={panelIds.technology}
    icon="technology"
    title="Select Technology"
    subtitle="Choose a manufacturing technology"
    status={status}
  >
    <div className="mw-stage-tech-list">
      {TECH_OPTIONS.map((tech) => {
        const sel = request.technology === tech.id;
        return (
          <button
            key={tech.id}
            type="button"
            className={`mw-stage-tech-item ${sel ? 'is-selected' : ''}`}
            onClick={() => onSelectTechnology(tech.id)}
          >
            <span className="mw-stage-tech-icon"><Icon name={tech.icon} size={20} /></span>
            <span className="mw-stage-tech-text">
              <span className="mw-stage-tech-name">{tech.label}</span>
              <span className="mw-stage-tech-desc">{tech.desc}</span>
            </span>
            <span className="mw-stage-tech-mark" aria-hidden="true">
              {sel ? <Icon name="check" size={14} /> : <Icon name="chevronRight" size={14} />}
            </span>
          </button>
        );
      })}
    </div>
  </PanelShell>
);

// 10. Select Process / Type (dependent on technology)
const ProcessPanel = ({ request, status, onSelectProcess }: {
  request: RequestState;
  status: PanelStatus;
  onSelectProcess: (p: ProcessId) => void;
}) => {
  const processOptions = request.technology
    ? (processGroups.find((g) => g.group === request.technology || (request.technology === 'sheet' && g.group === 'sheetMetal'))?.options ?? []).map((id) => ({ id, info: PROCESS_INFO[id] }))
    : [];
  return (
    <PanelShell
      id={panelIds.process}
      icon="layers"
      title="Select Process / Type"
      subtitle="Available for the selected technology"
      status={status}
    >
      {!request.technology ? (
        <div className="mw-panel-empty">
          <span className="mw-panel-empty-hint">Select a manufacturing technology first.</span>
        </div>
      ) : processOptions.length === 0 ? (
        <div className="mw-panel-empty">
          <span className="mw-panel-empty-icon"><Icon name="configure" size={14} /></span>
          <span className="mw-panel-empty-text">No processes yet</span>
          <span className="mw-panel-empty-hint">Processes for this technology are coming soon</span>
        </div>
      ) : (
        <div className="mw-stage-process-grid">
          {processOptions.map(({ id, info }) => {
            const sel = request.process === id;
            return (
              <button
                key={id}
                type="button"
                className={`mw-stage-process-chip ${sel ? 'is-selected' : ''}`}
                onClick={() => onSelectProcess(id)}
              >
                <span className="mw-stage-process-name">{info.title}</span>
                {info.badge && <span className="mw-stage-process-badge">{info.badge}</span>}
                {sel && <span className="mw-stage-process-check" aria-hidden="true"><Icon name="check" size={11} /></span>}
              </button>
            );
          })}
        </div>
      )}
    </PanelShell>
  );
};

// 11. Select Material (dependent on process, applied per uploaded part)
const MaterialPanel = ({ request, materialOptions, selectedColor, status, t, onSelectMaterial, onColorChange }: {
  request: RequestState;
  materialOptions: string[];
  selectedColor: string;
  status: PanelStatus;
  t: any;
  onSelectMaterial: (m: string) => void;
  onColorChange: (c: string) => void;
}) => {
  const selectedProps = request.material ? MATERIAL_PROPERTIES[request.material] || [] : [];
  const isInactive = status === 'inactive';
  return (
    <PanelShell
      id={panelIds.material}
      icon="layers3"
      title="Select Material"
      subtitle="Only compatible materials for your process"
      status={status}
    >
      {isInactive && (
        <div className="mw-panel-empty">
          <span className="mw-panel-empty-hint">Select a process and upload a design first.</span>
        </div>
      )}

      {materialOptions.length === 0 ? (
        !isInactive && (
          <div className="mw-panel-empty">
            <span className="mw-panel-empty-hint">No materials configured for this process.</span>
          </div>
        )
      ) : (
        <>
          <div className={`mw-stage-material-grid ${isInactive ? 'is-inactive' : ''}`}>
            {materialOptions.map((m) => {
              const sel = request.material === m;
              return (
                <button
                  key={m}
                  type="button"
                  disabled={isInactive}
                  className={`mw-stage-material-chip ${sel ? 'is-selected' : ''}`}
                  onClick={() => onSelectMaterial(m)}
                  title={isInactive ? 'Select a process and upload a design first' : m}
                >
                  <span className="mw-stage-material-swatch" style={{ background: MATERIAL_SWATCHES[m] || 'linear-gradient(135deg, #3b82f6, #14b8a6)' }} />
                  <span className="mw-stage-material-name">{t(`request.material.${m}`)}</span>
                  {sel && <span className="mw-stage-material-check" aria-hidden="true"><Icon name="check" size={10} /></span>}
                </button>
              );
            })}
          </div>

          {request.material && selectedProps.length > 0 && (
            <div className="mw-stage-material-props">
              <div className="mw-stage-section-label">Material Properties</div>
              <div className="mw-stage-material-props-list">
                {selectedProps.map((p) => (
                  <span key={p.label} className="mw-stage-material-prop">
                    <Icon name={p.icon} size={11} /> {p.label}
                  </span>
                ))}
              </div>
            </div>
          )}

          {request.material && (
            <div className="mw-stage-color-row">
              <span className="mw-stage-section-label">Color</span>
              <div className="mw-color-grid">
                {MATERIAL_COLORS.map((c) => (
                  <button
                    key={c}
                    type="button"
                    disabled={isInactive}
                    className={`mw-color-swatch ${selectedColor === c ? 'is-selected' : ''}`}
                    style={{ background: materialColor(c) }}
                    onClick={() => onColorChange(c)}
                    title={c}
                  />
                ))}
              </div>
            </div>
          )}
        </>
      )}
    </PanelShell>
  );
};

// 12. Order summary (left column footer) — real values only
const OrderSummaryPanel = ({ quote, isCalculatingQuote, usableUploadItems }: {
  quote: QuoteData | null;
  isCalculatingQuote: boolean;
  usableUploadItems: UploadItem[];
}) => {
  const readyCount = usableUploadItems.length;
  const multiFile = isMultiFileQuote(quote);
  const totalParts = multiFile && quote
    ? quote.files.reduce((sum, f) => sum + f.quantity, 0)
    : readyCount;
  const leadTime = multiFile ? (quote as MultiFileQuotation).leadTime : quote ? (quote as CalculatedQuotationData).leadTime : null;
  const total = quote ? quote.formattedTotalPrice : null;
  return (
    <PanelShell icon="clipboard" title="Order Summary" subtitle="Live overview of your order" className="mw-panel-summary">
      <div className="mw-order-summary-grid">
        <div className="mw-order-summary-item">
          <span className="mw-order-summary-label">Total Parts</span>
          <span className="mw-order-summary-value">{readyCount > 0 ? String(totalParts) : '—'}</span>
        </div>
        <div className="mw-order-summary-item">
          <span className="mw-order-summary-label">Production Time</span>
          <span className="mw-order-summary-value">{isCalculatingQuote ? '…' : leadTime || '—'}</span>
        </div>
        <div className="mw-order-summary-item">
          <span className="mw-order-summary-label">Estimated Price</span>
          <span className="mw-order-summary-value is-price">{isCalculatingQuote ? '…' : total || '—'}</span>
        </div>
      </div>
      {readyCount === 0 && <div className="mw-order-summary-empty">No parts yet — upload a design to build your order.</div>}
    </PanelShell>
  );
};

// ── CENTER PANELS ───────────────────────────────────────────────────────────

// 14. Upload Design
const UploadPanel = ({ status, hasProcess, isDragging, isUploading, uploadItems, onBrowse, onFiles, onDragState, onDelete, onPreview }: {
  status: PanelStatus;
  hasProcess: boolean;
  isDragging: boolean;
  isUploading: boolean;
  uploadItems: UploadItem[];
  onBrowse: () => void;
  onFiles: (files: File[]) => void;
  onDragState: (d: boolean) => void;
  onDelete: (i: UploadItem) => void;
  onPreview: (f: CadFile) => void;
}) => {
  const disabled = !hasProcess || isUploading;
  return (
    <PanelShell
      id={panelIds.upload}
      icon="upload"
      title="Upload Design"
      subtitle="Drag & drop or click to browse"
      status={status}
      className="mw-panel-upload"
    >
      <div
        className={`mw-stage-upload-zone ${isDragging ? 'is-dragging' : ''} ${disabled ? 'is-disabled' : ''}`}
        role="button" tabIndex={disabled ? -1 : 0} aria-disabled={disabled}
        onClick={() => { if (!disabled) onBrowse(); }}
        onKeyDown={(e) => { if ((e.key === 'Enter' || e.key === ' ') && !disabled) { e.preventDefault(); onBrowse(); } }}
        onDragEnter={(e: DragEvent) => { e.preventDefault(); onDragState(true); }}
        onDragOver={(e: DragEvent) => { e.preventDefault(); onDragState(true); }}
        onDragLeave={(e: DragEvent) => { if (!e.currentTarget.contains(e.relatedTarget as Node | null)) onDragState(false); }}
        onDrop={(e: DragEvent) => { e.preventDefault(); onDragState(false); if (!disabled) onFiles(Array.from(e.dataTransfer.files)); }}
      >
        <span className="mw-stage-upload-icon" aria-hidden="true"><Icon name="upload" size={22} /></span>
        <span className="mw-stage-upload-text">
          {disabled ? (hasProcess ? 'Processing uploads…' : 'Select your manufacturing technology and process first.') : isDragging ? 'Drop files here' : 'Drag & drop your CAD files here'}
        </span>
        {!disabled && <span className="mw-stage-upload-or">or click to browse</span>}
        <span className="mw-stage-upload-hint">Supported formats: STEP, STL, OBJ, IGES, and more (max 500MB per file)</span>
      </div>

      {uploadItems.length > 0 && (
        <div className="mw-stage-file-list">
          {uploadItems.map((item) => (
            <div key={item.id} className="mw-stage-file-row">
              <span className={`mw-stage-file-status ${isUploadItemReady(item) ? 'is-ready' : ''} ${item.status === 'failed' || item.status === 'unsupported' ? 'is-failed' : ''}`}>
                {isUploadItemReady(item) ? <Icon name="check" size={11} /> : item.status === 'failed' || item.status === 'unsupported' ? <Icon name="close" size={11} /> : <Icon name="loader" size={11} />}
              </span>
              <div className="mw-stage-file-info">
                <div className="mw-stage-file-name" title={item.name}>{item.name}</div>
                <div className="mw-stage-file-meta">{item.format} · {item.size}{isUploadItemReady(item) ? ' · Ready' : item.status === 'uploading' ? ` · ${item.progress}%` : ''}</div>
              </div>
              {isUploadItemReady(item) ? (
                <span className="mw-stage-file-badge is-ready"><Icon name="check" size={10} /> Ready</span>
              ) : (
                <span className="mw-stage-file-badge">{item.status}</span>
              )}
              {isUploadItemReady(item) && item.cadFile && (
                <button type="button" className="mw-text-btn" onClick={() => onPreview(item.cadFile!)}>
                  <Icon name="eye" size={11} /> Preview
                </button>
              )}
              <button type="button" className="mw-stage-file-remove" onClick={() => onDelete(item)} aria-label="Remove file">
                <Icon name="close" size={11} />
              </button>
            </div>
          ))}
        </div>
      )}
    </PanelShell>
  );
};

// 15. 3D Model Viewer
const ViewerPanel = ({ status, activeItem, fileSetupStates, onGeometry }: {
  status: PanelStatus | undefined;
  activeItem: UploadItem | undefined;
  fileSetupStates: Record<string, FileSetupState>;
  onGeometry: (g: CadGeometryData, id: string) => void;
}) => (
  <PanelShell
    id={panelIds.viewer}
    icon="cube"
    title="3D Model Viewer"
    subtitle="Inspect your model before production"
    status={status}
    className="mw-panel-viewer"
  >
    {activeItem?.cadFile ? (
      <div className="mw-stage-viewer-wrap">
        <CadGeometryViewer
          file={activeItem.cadFile}
          setup={fileSetupStates[activeItem.id]}
          onGeometry={(g) => onGeometry(g, activeItem.id)}
          onSetupChange={(u) => { void u; }}
        />
      </div>
    ) : (
      <div className="mw-stage-viewer-empty">
        <span className="mw-stage-viewer-empty-icon"><Icon name="cube" size={22} /></span>
        <span className="mw-stage-viewer-empty-text">Upload a CAD file to preview your model.</span>
        <span className="mw-stage-viewer-empty-hint">After uploading, rotate, pan, zoom and inspect your part in 3D.</span>
      </div>
    )}
  </PanelShell>
);

// 16–17. Configuration (Basic / Advanced engineering controls)
const ConfigurationPanel = ({ request, isPrinting, activeConfigTab, configReady, status, selectedSupportEnabled, onTabChange, onUpdate, onConfigUpdate }: {
  request: RequestState;
  isPrinting: boolean;
  activeConfigTab: 'basic' | 'advanced';
  configReady: boolean;
  status: PanelStatus;
  selectedSupportEnabled: boolean;
  onTabChange: (tab: 'basic' | 'advanced') => void;
  onUpdate: (p: Partial<RequestState>) => void;
  onConfigUpdate: (u: Partial<FileConfiguration>) => void;
}) => (
  <PanelShell
    id={panelIds.config}
    icon="configure"
    title="Configuration"
    subtitle="Set your manufacturing parameters"
    status={status}
    className="mw-panel-config"
    action={(
      <div className="mw-stage-config-tabs">
        <button type="button" className={`mw-stage-config-tab ${activeConfigTab === 'basic' ? 'is-active' : ''}`} onClick={() => onTabChange('basic')}>Basic</button>
        <button type="button" className={`mw-stage-config-tab ${activeConfigTab === 'advanced' ? 'is-active' : ''}`} onClick={() => onTabChange('advanced')}>Advanced</button>
      </div>
    )}
  >
    {!configReady ? (
      <div className="mw-panel-empty">
        <span className="mw-panel-empty-hint">Complete technology, process, upload and material to enable configuration settings.</span>
      </div>
    ) : (
      <div className="mw-stage-config-content">
        {activeConfigTab === 'basic' ? (
          <ConfigTabBasic request={request} isPrinting={isPrinting} onUpdate={onUpdate} />
        ) : (
          <ConfigTabAdvanced request={request} isPrinting={isPrinting} selectedSupportEnabled={selectedSupportEnabled} onUpdate={onUpdate} onConfigUpdate={onConfigUpdate} />
        )}
      </div>
    )}
  </PanelShell>
);

// 18. Technical Drawings & Notes
const NotesPanel = ({ note, onNoteChange }: { note: string; onNoteChange: (n: string) => void }) => (
  <PanelShell
    id={panelIds.notes}
    icon="file"
    title="Technical Drawings & Notes"
    subtitle="Add notes or special requirements about your design"
    className="mw-panel-notes"
  >
    <div className="mw-stage-notes-callout">Add references, drawing numbers, or manufacturing instructions for your part.</div>
    <textarea
      className="mw-stage-notes"
      value={note}
      onChange={(e) => onNoteChange(e.target.value)}
      placeholder="Add drawings, special requirements or notes about your design…"
      rows={3}
      maxLength={500}
    />
    <div className="mw-stage-notes-foot">
      <span>{note.length}/500</span>
    </div>
  </PanelShell>
);

// ── RIGHT COLUMN — Quote / Review, Pricing & Checkout (persistent) ─────────
// The right column is a set of separate floating panels: Parts & Review,
// Pricing (real engine values), and Checkout actions.
const QuotePanel = ({ request, quote, isCalculatingQuote, quoteFailed, usableUploadItems, fileConfigurations, selectedSetupId, orderReady, authGateOpen, onConfigUpdate, onSelectItem, isAuthenticated, isSubmitting, onSignIn, onRegister, onSubmit, priorityShipping, onPriorityShippingChange, t }: {
  request: RequestState;
  quote: QuoteData | null;
  isCalculatingQuote: boolean;
  quoteFailed: boolean;
  usableUploadItems: UploadItem[];
  fileConfigurations: Record<string, FileConfiguration>;
  selectedSetupId: string | null;
  orderReady: boolean;
  authGateOpen: boolean;
  onConfigUpdate: (u: Partial<FileConfiguration>, itemId?: string | null) => void;
  onSelectItem: (id: string) => void;
  isAuthenticated: boolean;
  isSubmitting: boolean;
  onSignIn: () => void;
  onRegister: () => void;
  onSubmit: () => void;
  priorityShipping: boolean;
  onPriorityShippingChange: (v: boolean) => void;
  t: any;
}) => {
  const multiFile = isMultiFileQuote(quote);
  const priceStatus: 'calculating' | 'error' | 'ready' | 'idle' = isCalculatingQuote ? 'calculating' : quoteFailed ? 'error' : quote ? 'ready' : 'idle';
  const activeId = selectedSetupId || usableUploadItems[0]?.id || null;
  const activeFile = usableUploadItems.find((i) => i.id === activeId);
  const activeQuoteFile = multiFile && activeFile?.cadFile ? quote.files.find((f) => f.fileId === activeFile.cadFile!.id) : undefined;
  const techLabel = request.technology ? TECH_OPTIONS.find((o) => o.id === request.technology)?.label || '—' : '—';
  const processTitle = request.process ? PROCESS_INFO[request.process]?.title || '—' : '—';
  const materialLabel = request.material ? t(`request.material.${request.material}`) : '—';
  const totalParts = usableUploadItems.reduce((s, i) => s + (fileConfigurations[i.cadFile!.id]?.quantity || request.quantity || 1), 0);
  const hasValidQuote = Boolean(quote && !isCalculatingQuote && !quoteFailed);
  const manualQuoteVisible = orderReady && !hasValidQuote;

  return (
    <>
      {/* Right Panel 1 — Parts & Review */}
      <PanelShell
        id={panelIds.quote}
        icon="clipboard"
        title="Proposed Technical Quote"
        subtitle="Review parts & configuration"
        className="mw-panel-quote mw-panel-quote-main"
      >
        <div className="mw-qup-live-badge">
          <span className="mw-qup-live-dot" /> LIVE
        </div>

        <div className="mw-qup-body">
          {usableUploadItems.length === 0 ? (
            <div className="mw-qup-no-items">
              <span className="mw-qup-no-items-icon"><Icon name="upload" size={18} /></span>
              <span className="mw-qup-no-items-title">No items in quote</span>
              <span className="mw-qup-no-items-sub">Upload files to get started</span>
            </div>
          ) : (
            <>
              {/* Order items + per-file quantity */}
              <div className="mw-qup-files">
                <div className="mw-stage-section-label">Parts / Items</div>
                {usableUploadItems.map((item) => {
                  const cfg = fileConfigurations[item.cadFile!.id] || {};
                  const material = cfg.material || request.material;
                  const processId = (cfg.process || request.process) as ProcessId | null;
                  const processTitle = processId ? PROCESS_INFO[processId]?.title || '' : '';
                  const quoteFile = multiFile && item.cadFile ? quote?.files.find((f) => f.fileId === item.cadFile!.id) : undefined;
                  const sel = item.id === activeId;
                  return (
                    <div key={item.id} className={`mw-qup-file-row ${sel ? 'is-active' : ''}`} onClick={() => onSelectItem(item.id)} role="button" tabIndex={0} onKeyDown={(e) => { if (e.key === 'Enter') onSelectItem(item.id); }}>
                      <span className="mw-qup-file-thumb" aria-hidden="true"><Icon name="cube" size={14} /></span>
                      <span className="mw-qup-file-info">
                        <span className="mw-qup-file-name">{item.name}</span>
                        <span className="mw-qup-file-meta">{item.format}{processTitle ? ` · ${processTitle.replace(' Printing', '')}` : ''}{material ? ` · ${t(`request.material.${material}`)}` : ''}</span>
                      </span>
                      <span className="mw-qup-file-price">
                        {quoteFile ? (
                          <span className="mw-qup-file-price-value">{quoteFile.perUnitCost.toFixed(2)}</span>
                        ) : null}
                      </span>
                      <span className="mw-qup-file-qty">
                        <div className="mw-qty-control">
                          <button className="mw-qty-btn" onClick={(e) => { e.stopPropagation(); onConfigUpdate({ quantity: Math.max(1, (cfg.quantity || request.quantity || 1) - 1) }, item.id); }} aria-label="Decrease quantity">−</button>
                          <span className="mw-qty-value">{cfg.quantity || request.quantity || 1}</span>
                          <button className="mw-qty-btn" onClick={(e) => { e.stopPropagation(); onConfigUpdate({ quantity: (cfg.quantity || request.quantity || 1) + 1 }, item.id); }} aria-label="Increase quantity">+</button>
                        </div>
                      </span>
                    </div>
                  );
                })}
              </div>

              {/* Selected part summary */}
              {activeFile && (
                <div className="mw-qup-part">
                  <div className="mw-qup-part-thumb">
                    <Icon name="cube" size={20} />
                  </div>
                  <div className="mw-qup-part-info">
                    <div className="mw-qup-part-name">{activeFile.name}</div>
                    <div className="mw-qup-part-meta">
                      {processTitle}{request.material ? ` · ${materialLabel}` : ''}
                    </div>
                  </div>
                  <div className="mw-qup-part-price">
                    {activeQuoteFile ? (
                      <span className="mw-qup-part-price-value">{activeQuoteFile.perUnitCost.toFixed(2)} EGP / unit</span>
                    ) : quote ? (
                      <span className="mw-qup-part-price-value">{quote.formattedTotalPrice}</span>
                    ) : (
                      <span className="mw-qup-part-price-value mw-qup-part-price-pending">—</span>
                    )}
                  </div>
                </div>
              )}

              {/* Configuration summary */}
              <div className="mw-qup-summary">
                <div className="mw-qup-summary-row">
                  <span className="mw-qup-summary-label">Technology</span>
                  <span className="mw-qup-summary-value">{techLabel}</span>
                </div>
                <div className="mw-qup-summary-row">
                  <span className="mw-qup-summary-label">Process</span>
                  <span className="mw-qup-summary-value">{processTitle}</span>
                </div>
                <div className="mw-qup-summary-row">
                  <span className="mw-qup-summary-label">Parts ({usableUploadItems.length})</span>
                  <span className="mw-qup-summary-value">{totalParts}</span>
                </div>
                <div className="mw-qup-summary-row">
                  <span className="mw-qup-summary-label">Material</span>
                  <span className="mw-qup-summary-value">{materialLabel}</span>
                </div>
              </div>
            </>
          )}
        </div>
      </PanelShell>

      {/* Right Panel 2 — Pricing (real engine values only) */}
      <PanelShell
        icon="wallet"
        title="Pricing"
        subtitle="Based on your selected configuration"
        className="mw-panel-quote-pricing"
      >
        <div className="mw-qup-body">
          {quote ? (
            <div className="mw-qup-pricing">
              {multiFile && (
                <>
                  <div className="mw-qup-pricing-row">
                    <span>Subtotal ({usableUploadItems.length} {usableUploadItems.length === 1 ? 'item' : 'items'})</span>
                    <span>{parseFloat((quote as MultiFileQuotation).manufacturingSubtotal.toFixed(2)) > 0 ? (quote as MultiFileQuotation).manufacturingSubtotal.toFixed(2) : '—'}</span>
                  </div>
                  {(quote as MultiFileQuotation).quantityDiscountSavings > 0 && (
                    <div className="mw-qup-pricing-row is-discount">
                      <span>Quantity discount</span>
                      <span>-{(quote as MultiFileQuotation).quantityDiscountSavings.toFixed(2)}</span>
                    </div>
                  )}
                  {(quote as MultiFileQuotation).shippingEstimate != null && (
                    <div className="mw-qup-pricing-row">
                      <span>Shipping</span>
                      <span>{(quote as MultiFileQuotation).shippingEstimate!.toFixed(2)}</span>
                    </div>
                  )}
                  {(quote as MultiFileQuotation).taxEstimate != null && (
                    <div className="mw-qup-pricing-row">
                      <span>Tax</span>
                      <span>{(quote as MultiFileQuotation).taxEstimate!.toFixed(2)}</span>
                    </div>
                  )}
                </>
              )}
              {!multiFile && (
                <div className="mw-qup-pricing-row">
                  <span>Subtotal</span>
                  <span>{quote.formattedTotalPrice}</span>
                </div>
              )}
              <div className="mw-qup-pricing-divider" />
              <div className="mw-qup-pricing-row is-total">
                <span>Estimated total</span>
                <span className="mw-qup-pricing-total-value">
                  <PriceTransition status={priceStatus} value={quote?.formattedTotalPrice} calculatingLabel="..." errorLabel="Error" />
                </span>
              </div>
              <PriceEstimateNotice />
            </div>
          ) : (
            <div className="mw-qup-checkout-status">
              <Icon name={isCalculatingQuote ? 'loader' : 'configure'} size={12} />
              {isCalculatingQuote ? 'Calculating pricing…' : 'Pricing updates once parts are uploaded and configuration is set.'}
            </div>
          )}

          {/* Shipping */}
          {orderReady && (
            <div className="mw-qup-priority">
              <span className="mw-qup-priority-icon" aria-hidden="true"><Icon name="send" size={14} /></span>
              <div className="mw-qup-priority-text">
                <span className="mw-qup-priority-title">Priority shipping</span>
                <span className="mw-qup-priority-sub">Selected in your delivery details</span>
              </div>
              <button
                type="button"
                className={`mw-toggle ${priorityShipping ? 'is-on' : ''}`}
                role="switch"
                aria-checked={priorityShipping}
                aria-label="Priority shipping"
                onClick={() => onPriorityShippingChange(!priorityShipping)}
              >
                <span className="mw-toggle-thumb" />
              </button>
            </div>
          )}
        </div>
      </PanelShell>

      {/* Right Panel 3 — Checkout */}
      <PanelShell
        icon="shieldCheck"
        title="Checkout"
        subtitle="Submit your manufacturing request"
        className="mw-panel-quote-checkout"
      >
        <div className="mw-qup-body">
          {orderReady && authGateOpen && !isAuthenticated && (
            <div className="mw-qup-auth-gate">
              <div>
                <div className="mw-qup-auth-gate-text">Sign in to submit</div>
                <div className="mw-qup-auth-gate-sub">Create an order with your account</div>
              </div>
              <div className="mw-qup-auth-gate-actions">
                <button className="mw-btn mw-btn-secondary" style={{ width: 'auto', padding: '8px 14px' }} onClick={onSignIn}>Sign In</button>
                <button className="mw-btn mw-btn-primary" style={{ width: 'auto', padding: '8px 14px' }} onClick={onRegister}>Register</button>
              </div>
            </div>
          )}

          <button className="mw-btn mw-btn-primary mw-qup-confirm" onClick={onSubmit} disabled={isSubmitting || !canSubmitFinal(quote, isCalculatingQuote, quoteFailed, request, usableUploadItems)}>
            {isSubmitting ? <><span className="mw-spinner" /> Submitting...</> : <><Icon name="check" size={14} /> Confirm &amp; Pay</>}
          </button>

          {manualQuoteVisible && (
            <button className="mw-btn mw-btn-secondary mw-qup-manual" onClick={onSubmit} disabled={isSubmitting}>
              <Icon name="file" size={14} /> Request Manual Quote
            </button>
          )}
          <div className="mw-qup-secure" aria-hidden="true">
            <Icon name="shieldCheck" size={11} /> Secure and encrypted checkout
          </div>

          {!canSubmitFinal(quote, isCalculatingQuote, quoteFailed, request, usableUploadItems) && !manualQuoteVisible && (
            <div className="mw-qup-checkout-status">
              <Icon name="configure" size={12} /> Complete technology, process, material and upload, then set configuration to enable checkout.
            </div>
          )}
        </div>
      </PanelShell>
    </>
  );
};

// ── Helpers ────────────────────────────────────────────────────────────────
const canSubmitFinal = (quote: QuoteData | null, isCalculating: boolean, quoteFailed: boolean, request: RequestState, uploadItems: UploadItem[]) => {
  return Boolean(quote && !isCalculating && !quoteFailed && request.cadFile && request.process && request.material && areAllUploadsReady(uploadItems));
};

const ConfigTabBasic = ({ request, isPrinting, onUpdate }: { request: RequestState; isPrinting: boolean; onUpdate: (p: Partial<RequestState>) => void }) => (
  <div className="mw-stage-config-fields">
    {isPrinting && (
      <div className="mw-stage-config-field">
        <label className="mw-stage-config-label">Print Profile</label>
        <ConfigBasicProfiles request={request} onQualityChange={(q, tol, w) => onUpdate({ quality: q, tolerance: tol, wallCount: w, infillPercent: null })} />
      </div>
    )}
    {!isPrinting && (
      <>
        <div className="mw-stage-config-field">
          <label className="mw-stage-config-label">Quality <RequiredMark /></label>
          <div className="mw-stage-btn-group">
            {['standard', 'high', 'premium'].map((v) => <button key={v} type="button" className={`mw-stage-btn ${request.quality === v ? 'is-active' : ''}`} onClick={() => onUpdate({ quality: v, infillPercent: null })}>{v}</button>)}
          </div>
        </div>
        <div className="mw-stage-config-field">
          <label className="mw-stage-config-label">Surface Finish <RequiredMark /></label>
          <div className="mw-stage-btn-group">
            {['standard', 'smooth'].map((v) => <button key={v} type="button" className={`mw-stage-btn ${request.finish === v ? 'is-active' : ''}`} onClick={() => onUpdate({ finish: v })}>{v}</button>)}
          </div>
        </div>
      </>
    )}
    <div className="mw-stage-config-2col">
      <div className="mw-stage-config-field">
        <label className="mw-stage-config-label">Quantity <RequiredMark /></label>
        <QtyInput value={request.quantity} onChange={(q) => onUpdate({ quantity: q })} />
      </div>
      <div className="mw-stage-config-field">
        <label className="mw-stage-config-label">Color</label>
        <div className="mw-color-grid">
          {MATERIAL_COLORS.map((c) => (
            <button key={c} type="button" className={`mw-color-swatch ${request.color === c ? 'is-selected' : ''}`} style={{ background: materialColor(c) }} onClick={() => onUpdate({ color: c })} title={c} />
          ))}
        </div>
      </div>
    </div>
  </div>
);

const CustomInfillField = ({ value, presetInfill, onCommit }: { value: number | null | undefined; presetInfill: number; onCommit: (v: number) => void }) => {
  const [text, setText] = React.useState(value != null ? String(value) : String(presetInfill));
  React.useEffect(() => { if (value != null) setText(String(value)); }, [value]);
  const resetToCommitted = () => setText(value != null ? String(value) : String(presetInfill));
  const finalize = () => {
    const n = normalizeInfillInput(text);
    if (n == null) { resetToCommitted(); return; }
    if (n !== value) onCommit(n); else setText(String(n));
  };
  return (
    <span className="mw-stage-btn mw-infill-custom is-active" data-infill-custom>
      <input
        type="number"
        className="mw-infill-custom-input"
        min={0}
        max={100}
        step={1}
        inputMode="numeric"
        value={text}
        aria-label="Custom infill percentage"
        onChange={(e) => {
          setText(e.target.value);
          const n = normalizeInfillInput(e.target.value);
          if (n != null && n !== value) onCommit(n);
        }}
        onBlur={finalize}
        onFocus={(e) => e.currentTarget.select()}
        onKeyDown={(e) => { if (e.key === 'Enter') (e.target as HTMLInputElement).blur(); }}
      />
      <span className="mw-infill-custom-suffix">%</span>
    </span>
  );
};

const ConfigTabAdvanced = ({ request, isPrinting, selectedSupportEnabled, onUpdate, onConfigUpdate }: {
  request: RequestState;
  isPrinting: boolean;
  selectedSupportEnabled: boolean;
  onUpdate: (p: Partial<RequestState>) => void;
  onConfigUpdate: (u: Partial<FileConfiguration>) => void;
}) => (
  <div className="mw-stage-config-fields">
    {isPrinting && (
      <>
        <div className="mw-stage-config-section-title">Infill &amp; Walls</div>
        <div className="mw-stage-config-field">
          <label className="mw-stage-config-label">Infill Density</label>
          <div className="mw-stage-btn-group">
            {INFILL_OPTIONS.filter((o) => o.id !== 'heavyduty').map((o) => (
              <button key={o.id} type="button" data-infill-preset={o.infillPercent} className={`mw-stage-btn ${request.infillPercent == null && request.quality === o.id ? 'is-active' : ''}`} onClick={() => onUpdate({ quality: o.id, infillPercent: null })}>{o.infillPercent}%</button>
            ))}
            {request.infillPercent == null ? (
              <button type="button" data-infill-custom className="mw-stage-btn" onClick={() => { onUpdate({ infillPercent: fdmParametersFor(request.quality, request.wallCount).infillPercent }); }}>Custom</button>
            ) : (
              <CustomInfillField value={request.infillPercent ?? null} presetInfill={fdmParametersFor(request.quality, request.wallCount).infillPercent} onCommit={(v) => onUpdate({ infillPercent: v })} />
            )}
          </div>
        </div>
        <div className="mw-stage-config-field">
          <label className="mw-stage-config-label">Wall Count</label>
          <div className="mw-stage-btn-group">
            {WALL_OPTIONS.map((o) => <button key={o.walls} type="button" className={`mw-stage-btn ${request.wallCount === o.walls ? 'is-active' : ''}`} onClick={() => onUpdate({ wallCount: o.walls })}>{o.walls} wall{o.walls === 1 ? '' : 's'}</button>)}
          </div>
        </div>
        <div className="mw-stage-config-2col">
          <div className="mw-stage-config-field">
            <label className="mw-stage-config-label">Layer Height</label>
            <select className="form-control" value={request.quality} onChange={(e) => onUpdate({ quality: e.target.value, infillPercent: null })}>
              {INFILL_OPTIONS.filter((o) => o.id !== 'heavyduty').map((o) => <option key={o.id} value={o.id}>{o.layerHeightMm.toFixed(2)} mm</option>)}
              {request.quality === 'heavyduty' && <option value="heavyduty">0.10 mm</option>}
            </select>
          </div>
          <div className="mw-stage-config-field">
            <label className="mw-stage-config-label">Support Structure</label>
            <select className="form-control" value={selectedSupportEnabled ? 'yes' : 'no'} onChange={(e) => onConfigUpdate({ supportEnabled: e.target.value === 'yes' })}>
              <option value="no">Off</option>
              <option value="yes">On</option>
            </select>
          </div>
        </div>
      </>
    )}
    {!isPrinting && (
      <>
        <div className="mw-stage-config-field">
          <label className="mw-stage-config-label">Tolerance <RequiredMark /></label>
          <div className="mw-stage-btn-group">
            {['standard', 'precision'].map((v) => <button key={v} type="button" className={`mw-stage-btn ${request.tolerance === v ? 'is-active' : ''}`} onClick={() => onUpdate({ tolerance: v })}>{v}</button>)}
          </div>
        </div>
        <div className="mw-stage-config-field">
          <label className="mw-stage-config-label">Surface Finish <RequiredMark /></label>
          <div className="mw-stage-btn-group">
            {['standard', 'smooth'].map((v) => <button key={v} type="button" className={`mw-stage-btn ${request.finish === v ? 'is-active' : ''}`} onClick={() => onUpdate({ finish: v })}>{v}</button>)}
          </div>
        </div>
      </>
    )}
  </div>
);

const ConfigBasicProfiles = ({ request, onQualityChange }: { request: RequestState; onQualityChange: (q: string, tolerance: string, wallCount: number) => void }) => {
  const profiles = [
    { id: 'lightweight', quality: 'sparse', tolerance: 'standard', wallCount: 2, meta: '10% infill · 2 walls', description: 'Lightweight, decorative parts' },
    { id: 'standard', quality: 'standard', tolerance: 'standard', wallCount: 3, meta: '15% infill · 3 walls', description: 'Standard everyday prints', recommended: true },
    { id: 'strong', quality: 'high', tolerance: 'precision', wallCount: 5, meta: '30% infill · 5 walls', description: 'Strong functional parts' },
    { id: 'solid', quality: 'premium', tolerance: 'precision', wallCount: 5, meta: '100% infill · 5 walls', description: 'Maximum density' },
  ];
  const sel = profiles.find((p) => p.quality === request.quality && p.tolerance === request.tolerance && p.wallCount === request.wallCount) || profiles.find((p) => p.quality === request.quality && p.tolerance === request.tolerance) || profiles[1];
  return (
    <div className="mw-profile-list">
      {profiles.map((p) => (
        <button key={p.id} type="button" className={`mw-profile-item ${sel.id === p.id ? 'is-selected' : ''}`} onClick={() => onQualityChange(p.quality, p.tolerance, p.wallCount)}>
          <span className="mw-profile-info">
            <span className="mw-profile-name">{p.id.charAt(0).toUpperCase() + p.id.slice(1)}</span>
            <span className="mw-profile-desc">{p.meta}{p.description ? ` · ${p.description}` : ''}</span>
          </span>
          {p.recommended && <span className="mw-profile-badge">REC</span>}
          <span className="mw-profile-check">{sel.id === p.id && <Icon name="check" size={12} />}</span>
        </button>
      ))}
    </div>
  );
};

const QtyInput = ({ value, onChange }: { value: number; onChange: (q: number) => void }) => (
  <div className="mw-qty-control">
    <button className="mw-qty-btn" onClick={() => onChange(Math.max(1, value - 1))} aria-label="Decrease quantity">−</button>
    <input className="mw-qty-value" type="number" min="1" value={value} onChange={(e) => onChange(Math.max(1, Number(e.target.value)))} aria-label="Quantity" />
    <button className="mw-qty-btn" onClick={() => onChange(value + 1)} aria-label="Increase quantity">+</button>
  </div>
);

export default ManufacturingRequestView;