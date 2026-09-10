import React, { useState, useEffect, useCallback, useRef, useMemo } from 'react';
import { useStore } from '../../context/StoreContext';
import { ApiService } from '../../services/api';
import { Icon } from '../ui/Icon';

/* ── Helpers ──────────────────────────────────────────────────────────────── */

const VAR_COLORS = ['blue', 'green', 'amber', 'purple', 'cyan', 'red'] as const;
const getVarColor = (i: number) => VAR_COLORS[i % VAR_COLORS.length];

const VAR_ICONS: Record<string, string> = {
  Volume: 'V', Width: 'W', Height: 'H', Depth: 'D', SurfaceArea: 'Sa',
  BoundingBoxVolume: 'Bv', ConvexHullVolume: 'Cv', Infill: 'If',
  LayerHeight: 'Lh', ShellThickness: 'St', Quantity: 'Q', Density: 'Dn',
  MachineTime: 'Mt', MaterialPrice: 'Mp', Weight: 'Wt', MaterialCost: 'Mc',
  MachineCost: 'Mc', BaseCost: 'Be', Profit: 'Pr', ProfitMargin: 'Pm',
};

function astToFormulaString(node: any, constants: any[]): string {
  if (!node) return '';
  switch (node.type) {
    case 'LITERAL': return String(node.value);
    case 'VARIABLE': return node.name;
    case 'CONSTANT': {
      const c = constants.find((k: any) => k.key === node.name || k.name === node.name);
      return c ? c.name : node.name;
    }
    case 'BINARY_OP': {
      const l = astToFormulaString(node.left, constants);
      const r = astToFormulaString(node.right, constants);
      const op = node.operator === '*' ? ' × ' : node.operator === '/' ? ' ÷ ' : ` ${node.operator} `;
      return `(${l}${op}${r})`;
    }
    case 'GROUP': return `(${astToFormulaString(node.expression, constants)})`;
    default: return '';
  }
}

function formulaStringToInputStr(s: string): string {
  return s.replace(/×/g, '*').replace(/÷/g, '/');
}

function formatNum(n: number | undefined | null): string {
  if (n == null || !Number.isFinite(n)) return '—';
  return n % 1 === 0 ? String(n) : n.toFixed(2);
}

/* ── Component ────────────────────────────────────────────────────────────── */

export const EquationBuilderView: React.FC = () => {
  const { showToast } = useStore();

  const technologies = [
    { key: 'FDM', label: 'FDM 3D Printing' },
    { key: 'SLA', label: 'SLA Stereolithography' },
    { key: 'SLS', label: 'SLS Laser Sintering' },
    { key: 'CNC_MILLING', label: 'CNC Milling' },
    { key: 'CNC_TURNING', label: 'CNC Turning' },
    { key: 'LASER_CUTTING', label: 'Laser Cutting' },
  ];

  /* State */
  const [selectedTech, setSelectedTech] = useState('FDM');
  const [equationData, setEquationData] = useState<any>(null);
  const [constantsList, setConstantsList] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [publishing, setPublishing] = useState(false);
  const [testing, setTesting] = useState(false);

  /* Formula editor */
  const [formulaText, setFormulaText] = useState('');
  const [formulaError, setFormulaError] = useState('');
  const [formulaValid, setFormulaValid] = useState(true);
  const editorRef = useRef<HTMLTextAreaElement>(null);

  /* Variables sidebar */
  const [varSearch, setVarSearch] = useState('');
  const [showAllVars, setShowAllVars] = useState(false);

  /* Test mode */
  const [testMode, setTestMode] = useState<'manual' | 'cad'>('manual');
  const [testParams, setTestParams] = useState({
    volumeCm3: 120, width: 30, height: 20, depth: 15,
    surfaceAreaCm2: 30, infillPercent: 20, layerHeightMm: 0.2,
    wallCount: 2, density: 1.24, machineTimeHours: 2.5,
    quantity: 1, material: 'pla',
  });
  const [testResult, setTestResult] = useState<any>(null);

  /* CAD upload */
  const [cadFile, setCadFile] = useState<File | null>(null);
  const [cadUploading, setCadUploading] = useState(false);
  const [cadAnalyzing, setCadAnalyzing] = useState(false);
  const [cadData, setCadData] = useState<any>(null);
  const [dragOver, setDragOver] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

  /* Publish modal */
  const [showPublishModal, setShowPublishModal] = useState(false);
  const [publishNotes, setPublishNotes] = useState('');

  /* Version history drawer */
  const [showVersions, setShowVersions] = useState(false);

  /* Computed */
  const published = equationData?.publishedVersion;
  const draft = equationData?.draftVersion;
  const predefined = equationData?.predefinedVariables || [];
  const customVars = draft?.customVariables || [];

  const allVariables = useMemo(() => {
    const vars = [...predefined];
    for (const cv of customVars) {
      if (!vars.find((v: any) => v.code === cv.code)) {
        vars.push({ code: cv.code, name: cv.name, description: cv.description, unit: cv.unit, type: 'CUSTOM' });
      }
    }
    return vars;
  }, [predefined, customVars]);

  const filteredVars = useMemo(() => {
    if (!varSearch.trim()) return allVariables;
    const q = varSearch.toLowerCase();
    return allVariables.filter((v: any) =>
      v.code.toLowerCase().includes(q) || (v.name || '').toLowerCase().includes(q) || (v.description || '').toLowerCase().includes(q)
    );
  }, [allVariables, varSearch]);

  const displayVars = showAllVars ? filteredVars : filteredVars.slice(0, 12);

  /* ── Data Loading ──────────────────────────────────────────────────────── */

  const loadData = useCallback(async (tech = selectedTech) => {
    setLoading(true);
    try {
      const [data, consts] = await Promise.all([
        ApiService.getPricingEquation(tech),
        ApiService.getPricingConstants(),
      ]);
      setEquationData(data);
      setConstantsList(consts || []);
      const tree = data?.draftVersion?.formulaTree;
      if (tree) {
        setFormulaText(formulaStringToInputStr(astToFormulaString(tree, consts || [])));
        setFormulaError('');
        setFormulaValid(true);
      }
    } catch (err: any) {
      showToast('Error', err.message || 'Failed to load equation data', 'error');
    } finally {
      setLoading(false);
    }
  }, [selectedTech, showToast]);

  useEffect(() => { loadData(selectedTech); }, [selectedTech, loadData]);

  /* ── Formula Validation (client-side basic) ────────────────────────────── */

  useEffect(() => {
    if (!formulaText.trim()) {
      setFormulaError('');
      setFormulaValid(true);
      return;
    }
    const open = (formulaText.match(/\(/g) || []).length;
    const close = (formulaText.match(/\)/g) || []).length;
    if (open !== close) {
      setFormulaError('Missing closing parenthesis');
      setFormulaValid(false);
      return;
    }
    if (/[+\-*/^]{2,}/.test(formulaText.replace(/\s/g, ''))) {
      setFormulaError('Consecutive operators detected');
      setFormulaValid(false);
      return;
    }
    setFormulaError('');
    setFormulaValid(true);
  }, [formulaText]);

  /* ── Insert Variable ───────────────────────────────────────────────────── */

  const insertVariable = useCallback((code: string) => {
    const el = editorRef.current;
    if (!el) {
      setFormulaText(prev => prev ? `${prev} + ${code}` : code);
      return;
    }
    const start = el.selectionStart;
    const end = el.selectionEnd;
    const before = formulaText.slice(0, start);
    const after = formulaText.slice(end);
    const needsOp = before.length > 0 && !before.endsWith('(') && !before.endsWith(' ') && !before.endsWith('+') && !before.endsWith('-') && !before.endsWith('*') && !before.endsWith('/') && !before.endsWith('^');
    const newText = needsOp ? `${before} + ${code}${after}` : `${before}${code}${after}`;
    setFormulaText(newText);
    setTimeout(() => {
      el.focus();
      const pos = start + code.length + (needsOp ? 3 : 0);
      el.setSelectionRange(pos, pos);
    }, 0);
  }, [formulaText]);

  /* ── Save Draft ────────────────────────────────────────────────────────── */

  const handleSaveDraft = async () => {
    if (!equationData) return;
    setSaving(true);
    try {
      const draftData = equationData.draftVersion;
      await ApiService.saveDraftEquation(selectedTech, {
        formulaTree: draftData.formulaTree,
        customVariables: draftData.customVariables || [],
        constantsSnapshot: draftData.constantsSnapshot,
        name: draftData.name,
        description: draftData.description,
      });
      showToast('Draft Saved', `Draft equation saved.`, 'success');
      loadData(selectedTech);
    } catch (err: any) {
      showToast('Save Failed', err.message || 'Failed to save draft', 'error');
    } finally {
      setSaving(false);
    }
  };

  /* ── Run Test ──────────────────────────────────────────────────────────── */

  const handleRunTest = async () => {
    setTesting(true);
    try {
      const modelContext: any = {
        width: Number(testParams.width),
        height: Number(testParams.height),
        depth: Number(testParams.depth),
        volumeCm3: Number(testParams.volumeCm3),
        volume: Number(testParams.volumeCm3) * 1000,
        boundingBoxVolume: Number(testParams.width) * Number(testParams.height) * Number(testParams.depth),
        surfaceAreaCm2: Number(testParams.surfaceAreaCm2),
        surfaceArea: Number(testParams.surfaceAreaCm2) * 100,
        infill: Number(testParams.infillPercent),
        infillPercent: Number(testParams.infillPercent),
        layerHeight: Number(testParams.layerHeightMm),
        shellThickness: Number(testParams.wallCount) * 0.45,
        wallCount: Number(testParams.wallCount),
        density: Number(testParams.density),
        machineTimeHours: Number(testParams.machineTimeHours),
        machineTime: Number(testParams.machineTimeHours),
        quantity: Number(testParams.quantity),
        material: testParams.material,
        technology: selectedTech,
      };
      if (cadData) {
        if (cadData.volume) modelContext.volumeCm3 = cadData.volume;
        if (cadData.surfaceArea) modelContext.surfaceAreaCm2 = cadData.surfaceArea;
        if (cadData.dimensions) {
          modelContext.width = cadData.dimensions.width || modelContext.width;
          modelContext.height = cadData.dimensions.height || modelContext.height;
          modelContext.depth = cadData.dimensions.depth || modelContext.depth;
        }
      }
      const result = await ApiService.testPricingEquation(selectedTech, {
        isDraft: true,
        modelContext,
      });
      setTestResult(result);
    } catch (err: any) {
      showToast('Test Failed', err.message || 'Calculation failed', 'error');
    } finally {
      setTesting(false);
    }
  };

  /* ── CAD Upload ────────────────────────────────────────────────────────── */

  const handleCadUpload = async (file: File) => {
    setCadFile(file);
    setCadUploading(true);
    setCadData(null);
    try {
      const formData = new FormData();
      formData.append('file', file);
      const uploadResult = await fetch('/api/v1/cad', {
        method: 'POST',
        body: formData,
        credentials: 'include',
      });
      if (!uploadResult.ok) throw new Error('Upload failed');
      const { data: cadFileData } = await uploadResult.json();
      setCadAnalyzing(true);
      let attempts = 0;
      const maxAttempts = 30;
      while (attempts < maxAttempts) {
        await new Promise(r => setTimeout(r, 2000));
        const geoRes = await fetch(`/api/v1/cad/${cadFileData.id}/geometry`, { credentials: 'include' });
        if (geoRes.ok) {
          const { data: geo } = await geoRes.json();
          if (geo?.metadata?.geometryStatus === 'READY') {
            setCadData({
              volume: geo.metadata.volume ? Number(geo.metadata.volume) : undefined,
              surfaceArea: geo.metadata.surfaceArea ? Number(geo.metadata.surfaceArea) : undefined,
              dimensions: geo.metadata.dimensions,
              width: geo.metadata.dimensions?.width,
              height: geo.metadata.dimensions?.height,
              depth: geo.metadata.dimensions?.depth,
            });
            if (geo.metadata.dimensions) {
              setTestParams(p => ({
                ...p,
                width: geo.metadata.dimensions.width || p.width,
                height: geo.metadata.dimensions.height || p.height,
                depth: geo.metadata.dimensions.depth || p.depth,
              }));
            }
            if (geo.metadata.volume) {
              setTestParams(p => ({ ...p, volumeCm3: Number(geo.metadata.volume) }));
            }
            break;
          }
        }
        attempts++;
      }
    } catch (err: any) {
      showToast('Upload Error', err.message || 'Failed to process CAD file', 'error');
    } finally {
      setCadUploading(false);
      setCadAnalyzing(false);
    }
  };

  const handleFileDrop = (e: React.DragEvent) => {
    e.preventDefault();
    setDragOver(false);
    const file = e.dataTransfer.files?.[0];
    if (file) handleCadUpload(file);
  };

  /* ── Publish ───────────────────────────────────────────────────────────── */

  const handlePublish = async () => {
    setPublishing(true);
    try {
      await ApiService.publishPricingEquation(selectedTech, {
        notes: publishNotes || 'Published via Pricing Engine',
      });
      showToast('Published', `${selectedTech} equation is now live!`, 'success');
      setShowPublishModal(false);
      setPublishNotes('');
      loadData(selectedTech);
    } catch (err: any) {
      showToast('Publish Failed', err.message || 'Failed to publish', 'error');
    } finally {
      setPublishing(false);
    }
  };

  /* ── Reset test values ─────────────────────────────────────────────────── */

  const resetTestValues = () => {
    setTestParams({
      volumeCm3: 120, width: 30, height: 20, depth: 15,
      surfaceAreaCm2: 30, infillPercent: 20, layerHeightMm: 0.2,
      wallCount: 2, density: 1.24, machineTimeHours: 2.5,
      quantity: 1, material: 'pla',
    });
    setTestResult(null);
    setCadFile(null);
    setCadData(null);
  };

  /* ── Render ────────────────────────────────────────────────────────────── */

  if (loading) {
    return (
      <div className="pe-workspace" style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', minHeight: '60vh' }}>
        <div style={{ textAlign: 'center' }}>
          <div className="pe-spinner pe-spinner-dark" style={{ width: 32, height: 32, margin: '0 auto 16px' }} />
          <p style={{ color: 'var(--pe-text-muted)', fontSize: 13 }}>Loading Pricing Engine...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="pe-workspace">
      {/* ── Control Bar ──────────────────────────────────────────────── */}
      <div className="pe-control-bar">
        <div className="pe-control-left">
          <div className="pe-service-group">
            <span className="pe-service-label">Service</span>
            <select
              className="pe-service-select"
              value={selectedTech}
              onChange={(e) => setSelectedTech(e.target.value)}
            >
              {technologies.map(t => (
                <option key={t.key} value={t.key}>{t.label}</option>
              ))}
            </select>
          </div>
          <div className="pe-version-group">
            {draft && (
              <span className="pe-badge pe-badge-draft">
                <span className="pe-badge-dot" />
                v{draft.version} Draft
              </span>
            )}
            {published && (
              <span className="pe-badge pe-badge-published">
                <span className="pe-badge-dot" />
                Published v{published.version}
              </span>
            )}
          </div>
        </div>
        <div className="pe-control-right">
          <button className="pe-btn pe-btn-outline pe-btn-sm" onClick={handleSaveDraft} disabled={saving}>
            {saving ? <span className="pe-spinner" /> : <Icon name="check" size={14} />}
            {saving ? 'Saving...' : 'Save Draft'}
          </button>
          <button className="pe-btn pe-btn-primary pe-btn-sm" onClick={() => setShowPublishModal(true)}>
            <Icon name="send" size={14} /> Publish Equation
          </button>
        </div>
      </div>

      {/* ── Main Workspace ───────────────────────────────────────────── */}
      <div className="pe-main">
        {/* LEFT: Formula + Test */}
        <div className="pe-main-left">
          {/* Formula Builder */}
          <div className="pe-section-header">
            <div>
              <div className="pe-section-title">Formula Builder</div>
              <div className="pe-section-subtitle">Create and test your pricing formula</div>
            </div>
            <span className={`pe-formula-status ${formulaValid ? 'pe-formula-valid' : 'pe-formula-invalid'}`}>
              {formulaValid ? '✓ Valid Formula' : '⚠ Invalid Formula'}
            </span>
          </div>

          <div className="pe-formula-section">
            <div className="pe-formula-editor-wrap">
              <div className="pe-formula-editor-header">
                <span className="pe-formula-editor-label">Final Price</span>
              </div>
              <textarea
                ref={editorRef}
                className="pe-formula-editor"
                value={formulaText}
                onChange={(e) => setFormulaText(e.target.value)}
                placeholder="Enter your pricing formula, e.g. BaseCost + (BaseCost * ProfitMargin)"
                spellCheck={false}
              />
              {formulaError && (
                <div className="pe-formula-error">⚠ {formulaError}</div>
              )}
              <div className="pe-formula-hint">
                Use variables from the right panel or type directly. Supports + - * / ( ) and %
              </div>
            </div>

            {/* Insert Variable Chips */}
            <div className="pe-insert-bar">
              <span className="pe-insert-label">Insert:</span>
              {allVariables.slice(0, 6).map((v: any) => (
                <button key={v.code} className="pe-insert-chip" onClick={() => insertVariable(v.code)}>
                  {v.code}
                </button>
              ))}
              {allVariables.length > 6 && (
                <button className="pe-insert-chip pe-insert-chip-more" onClick={() => setShowAllVars(true)}>
                  +{allVariables.length - 6} more
                </button>
              )}
            </div>
          </div>

          {/* Test & Calculate */}
          <div className="pe-test-section">
            <div className="pe-test-tabs">
              <button
                className={`pe-test-tab ${testMode === 'manual' ? 'active' : ''}`}
                onClick={() => setTestMode('manual')}
              >
                Manual Input
              </button>
              <button
                className={`pe-test-tab ${testMode === 'cad' ? 'active' : ''}`}
                onClick={() => setTestMode('cad')}
              >
                Upload File
              </button>
            </div>

            <div className="pe-test-body">
              {/* LEFT: Inputs */}
              <div className="pe-test-inputs">
                {testMode === 'manual' ? (
                  <>
                    <div className="pe-test-input-row">
                      <span className="pe-test-input-label">Volume</span>
                      <input type="number" className="pe-test-input-field" value={testParams.volumeCm3}
                        onChange={e => setTestParams(p => ({ ...p, volumeCm3: Number(e.target.value) }))} />
                      <span className="pe-test-input-unit">cm³</span>
                    </div>
                    <div className="pe-test-input-row">
                      <span className="pe-test-input-label">Density</span>
                      <input type="number" step="0.01" className="pe-test-input-field" value={testParams.density}
                        onChange={e => setTestParams(p => ({ ...p, density: Number(e.target.value) }))} />
                      <span className="pe-test-input-unit">g/cm³</span>
                    </div>
                    <div className="pe-test-input-row">
                      <span className="pe-test-input-label">Machine Time</span>
                      <input type="number" step="0.1" className="pe-test-input-field" value={testParams.machineTimeHours}
                        onChange={e => setTestParams(p => ({ ...p, machineTimeHours: Number(e.target.value) }))} />
                      <span className="pe-test-input-unit">hours</span>
                    </div>
                    <div className="pe-test-input-row">
                      <span className="pe-test-input-label">Width</span>
                      <input type="number" className="pe-test-input-field" value={testParams.width}
                        onChange={e => setTestParams(p => ({ ...p, width: Number(e.target.value) }))} />
                      <span className="pe-test-input-unit">mm</span>
                    </div>
                    <div className="pe-test-input-row">
                      <span className="pe-test-input-label">Height</span>
                      <input type="number" className="pe-test-input-field" value={testParams.height}
                        onChange={e => setTestParams(p => ({ ...p, height: Number(e.target.value) }))} />
                      <span className="pe-test-input-unit">mm</span>
                    </div>
                    <div className="pe-test-input-row">
                      <span className="pe-test-input-label">Depth</span>
                      <input type="number" className="pe-test-input-field" value={testParams.depth}
                        onChange={e => setTestParams(p => ({ ...p, depth: Number(e.target.value) }))} />
                      <span className="pe-test-input-unit">mm</span>
                    </div>
                    <div className="pe-test-input-row">
                      <span className="pe-test-input-label">Infill</span>
                      <input type="number" className="pe-test-input-field" value={testParams.infillPercent}
                        onChange={e => setTestParams(p => ({ ...p, infillPercent: Number(e.target.value) }))} />
                      <span className="pe-test-input-unit">%</span>
                    </div>
                    <div className="pe-test-input-row">
                      <span className="pe-test-input-label">Quantity</span>
                      <input type="number" min="1" className="pe-test-input-field" value={testParams.quantity}
                        onChange={e => setTestParams(p => ({ ...p, quantity: Number(e.target.value) }))} />
                      <span className="pe-test-input-unit">pcs</span>
                    </div>
                  </>
                ) : (
                  /* CAD Upload Mode */
                  <>
                    {!cadFile ? (
                      <div
                        className={`pe-upload-zone ${dragOver ? 'dragover' : ''}`}
                        onDragOver={e => { e.preventDefault(); setDragOver(true); }}
                        onDragLeave={() => setDragOver(false)}
                        onDrop={handleFileDrop}
                        onClick={() => fileInputRef.current?.click()}
                      >
                        <div className="pe-upload-icon"><Icon name="upload" size={24} /></div>
                        <div className="pe-upload-text">Upload CAD File</div>
                        <div className="pe-upload-hint">Drag & Drop or Browse</div>
                        <div className="pe-upload-hint" style={{ marginTop: 4 }}>STL, STEP, STP, IGES, IGS, OBJ, DXF</div>
                        <input ref={fileInputRef} type="file" hidden accept=".stl,.step,.stp,.iges,.igs,.obj,.dxf" onChange={e => {
                          const f = e.target.files?.[0];
                          if (f) handleCadUpload(f);
                        }} />
                      </div>
                    ) : (
                      <>
                        <div className="pe-upload-file-info">
                          <div className="pe-upload-file-icon"><Icon name="file" size={18} /></div>
                          <div className="pe-upload-file-meta">
                            <div className="pe-upload-file-name">{cadFile.name}</div>
                            <div className="pe-upload-file-size">{(cadFile.size / 1024).toFixed(1)} KB</div>
                          </div>
                          {(cadUploading || cadAnalyzing) && <div className="pe-spinner pe-spinner-dark" />}
                        </div>
                        {cadData && (
                          <div className="pe-cad-data-grid">
                            {cadData.volume != null && (
                              <div className="pe-cad-data-item">
                                <span className="pe-cad-data-label">Volume</span>
                                <span className="pe-cad-data-value">{cadData.volume} cm³</span>
                              </div>
                            )}
                            {cadData.surfaceArea != null && (
                              <div className="pe-cad-data-item">
                                <span className="pe-cad-data-label">Surface</span>
                                <span className="pe-cad-data-value">{cadData.surfaceArea} cm²</span>
                              </div>
                            )}
                            {cadData.dimensions?.width != null && (
                              <div className="pe-cad-data-item">
                                <span className="pe-cad-data-label">Width</span>
                                <span className="pe-cad-data-value">{cadData.dimensions.width} mm</span>
                              </div>
                            )}
                            {cadData.dimensions?.height != null && (
                              <div className="pe-cad-data-item">
                                <span className="pe-cad-data-label">Height</span>
                                <span className="pe-cad-data-value">{cadData.dimensions.height} mm</span>
                              </div>
                            )}
                            {cadData.dimensions?.depth != null && (
                              <div className="pe-cad-data-item">
                                <span className="pe-cad-data-label">Depth</span>
                                <span className="pe-cad-data-value">{cadData.dimensions.depth} mm</span>
                              </div>
                            )}
                          </div>
                        )}
                      </>
                    )}
                  </>
                )}

                <div className="pe-test-actions">
                  <button className="pe-btn pe-btn-outline pe-btn-sm" onClick={resetTestValues}>
                    <Icon name="reset" size={13} /> Reset
                  </button>
                  <button className="pe-btn pe-btn-primary pe-btn-sm" onClick={handleRunTest} disabled={testing}>
                    {testing ? <span className="pe-spinner" /> : <Icon name="target" size={13} />}
                    {testing ? 'Calculating...' : 'Calculate'}
                  </button>
                </div>
              </div>

              {/* RIGHT: Result */}
              <div className="pe-result">
                <div className="pe-result-header">
                  <span className="pe-result-title">Calculation Result</span>
                  {testResult && <span className="pe-result-success">✓ Success</span>}
                </div>

                {testResult ? (
                  <>
                    {testResult.breakdown?.components?.map((c: any, i: number) => (
                      <div key={i} className="pe-result-row">
                        <span className="pe-result-row-label">
                          <span className="pe-result-row-icon" style={{ background: `var(--pe-${getVarColor(i)}-soft)`, color: `var(--pe-${getVarColor(i)})` }}>
                            {VAR_ICONS[c.code] || c.code[0]}
                          </span>
                          {c.name || c.code}
                        </span>
                        <span className="pe-result-row-value">{formatNum(c.value)} {c.unit !== 'unitless' ? c.unit : ''}</span>
                      </div>
                    ))}

                    <div className="pe-result-row">
                      <span className="pe-result-row-label">
                        <span className="pe-result-row-icon" style={{ background: 'var(--pe-blue-soft)', color: 'var(--pe-blue)' }}>Mc</span>
                        Material Cost
                      </span>
                      <span className="pe-result-row-value">{formatNum(testResult.breakdown?.materialCost)} EGP</span>
                    </div>
                    <div className="pe-result-row">
                      <span className="pe-result-row-label">
                        <span className="pe-result-row-icon" style={{ background: 'var(--pe-amber-soft)', color: 'var(--pe-amber)' }}>Mc</span>
                        Machine Cost
                      </span>
                      <span className="pe-result-row-value">{formatNum(testResult.breakdown?.machineCost)} EGP</span>
                    </div>
                    <div className="pe-result-row">
                      <span className="pe-result-row-label">
                        <span className="pe-result-row-icon" style={{ background: 'var(--pe-purple-soft)', color: 'var(--pe-purple)' }}>Be</span>
                        Base Cost
                      </span>
                      <span className="pe-result-row-value">{formatNum(testResult.breakdown?.baseCost)} EGP</span>
                    </div>
                    <div className="pe-result-row">
                      <span className="pe-result-row-label">
                        <span className="pe-result-row-icon" style={{ background: 'var(--pe-green-soft)', color: 'var(--pe-green)' }}>Pr</span>
                        Profit
                      </span>
                      <span className="pe-result-row-value">{formatNum(testResult.breakdown?.profit)} EGP</span>
                    </div>

                    <div className="pe-result-divider" />

                    <div className="pe-result-final">
                      <span className="pe-result-final-label">Final Price</span>
                      <span>
                        <span className="pe-result-final-value">{formatNum(testResult.totalPrice)}</span>
                        <span className="pe-result-final-unit">EGP</span>
                      </span>
                    </div>
                  </>
                ) : (
                  <div style={{ textAlign: 'center', padding: '40px 20px', color: 'var(--pe-text-muted)', fontSize: 13 }}>
                    Enter test values and click Calculate to see results
                  </div>
                )}
              </div>
            </div>
          </div>
        </div>

        {/* RIGHT: Variables Sidebar */}
        <div className="pe-main-right">
          <div className="pe-sidebar-header">
            <div className="pe-sidebar-title">Available Variables</div>
            <input
              className="pe-sidebar-search"
              placeholder="Search variables..."
              value={varSearch}
              onChange={e => setVarSearch(e.target.value)}
            />
          </div>

          <div className="pe-sidebar-list">
            {displayVars.map((v: any, i: number) => {
              const color = getVarColor(i);
              const iconLabel = VAR_ICONS[v.code] || v.code.slice(0, 2);
              return (
                <div key={v.code} className="pe-var-item" onClick={() => insertVariable(v.code)}>
                  <div className={`pe-var-icon pe-var-color-${color}`}>{iconLabel}</div>
                  <div className="pe-var-info">
                    <div className="pe-var-name">{v.code}</div>
                    <div className="pe-var-desc">{v.description || v.name}</div>
                  </div>
                  <span className="pe-var-unit">{v.unit}</span>
                  <button className="pe-var-add" onClick={(e) => { e.stopPropagation(); insertVariable(v.code); }}>+</button>
                </div>
              );
            })}

            {filteredVars.length > 12 && !showAllVars && (
              <button
                className="pe-var-item"
                style={{ justifyContent: 'center', color: 'var(--pe-blue)', fontSize: 12, fontWeight: 600, cursor: 'pointer', background: 'none', border: 'none', width: '100%' }}
                onClick={() => setShowAllVars(true)}
              >
                More variables ▾
              </button>
            )}
          </div>

          {/* Version History (compact) */}
          <div style={{ borderTop: '1px solid var(--pe-border)', padding: '12px 16px' }}>
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 8 }}>
              <span style={{ fontSize: 12, fontWeight: 700, color: 'var(--pe-text)' }}>Version History</span>
              <button className="pe-btn pe-btn-outline pe-btn-sm" style={{ padding: '3px 8px', fontSize: 11 }} onClick={() => setShowVersions(true)}>
                View All →
              </button>
            </div>
            {(equationData?.versions || []).slice(0, 3).map((v: any) => (
              <div key={v.id} className="pe-version-item">
                <span className="pe-version-num">v{v.version}</span>
                <div className="pe-version-meta">
                  <span className={`pe-badge ${v.status === 'PUBLISHED' ? 'pe-badge-published' : v.status === 'DRAFT' ? 'pe-badge-draft' : ''}`} style={{ fontSize: 10, padding: '2px 6px' }}>
                    {v.status}
                  </span>
                  <div className="pe-version-date">
                    {v.publishedAt ? new Date(v.publishedAt).toLocaleDateString() : v.updatedAt ? new Date(v.updatedAt).toLocaleDateString() : '—'}
                  </div>
                </div>
              </div>
            ))}
          </div>

          {/* Pricing Constants (compact) */}
          {constantsList.length > 0 && (
            <div style={{ borderTop: '1px solid var(--pe-border)', padding: '12px 16px' }}>
              <div style={{ fontSize: 12, fontWeight: 700, color: 'var(--pe-text)', marginBottom: 8 }}>Pricing Constants</div>
              {constantsList.filter((c: any) => !c.technology || c.technology === selectedTech).slice(0, 5).map((c: any) => (
                <div key={c.key} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '4px 0' }}>
                  <span style={{ fontSize: 11, color: 'var(--pe-text-2)', fontFamily: "'Google Sans', monospace" }}>{c.key}</span>
                  <span style={{ fontSize: 11, fontWeight: 600, color: 'var(--pe-text)', fontFamily: "'Google Sans', monospace" }}>{c.value} {c.unit}</span>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>

      {/* ── Status Bar ───────────────────────────────────────────────── */}
      <div className="pe-status-bar">
        <div className="pe-status-left">
          <span className="pe-status-dot" />
          <span>Used by website: <strong style={{ color: 'var(--pe-green)' }}>Active</strong></span>
        </div>
        <div className="pe-status-right">
          <span>Last updated: {draft?.updatedAt ? new Date(draft.updatedAt).toLocaleString() : '—'}</span>
        </div>
      </div>

      {/* ── Publish Modal ────────────────────────────────────────────── */}
      {showPublishModal && (
        <div className="pe-modal-backdrop" onClick={() => setShowPublishModal(false)}>
          <div className="pe-modal" onClick={e => e.stopPropagation()}>
            <div className="pe-modal-title">Publish Equation</div>
            <div className="pe-modal-body">
              <div style={{ marginBottom: 12 }}>
                <strong>Service:</strong> {technologies.find(t => t.key === selectedTech)?.label}
              </div>
              <div style={{ marginBottom: 12 }}>
                <strong>Version:</strong> v{draft?.version}
              </div>
              <p>This formula will become the active pricing formula used by the website.</p>
              <div style={{ marginTop: 12 }}>
                <label style={{ fontSize: 12, fontWeight: 600, color: 'var(--pe-text-2)', display: 'block', marginBottom: 6 }}>Release Notes</label>
                <textarea
                  className="pe-test-input-field"
                  style={{ width: '100%', minHeight: 60, resize: 'vertical' }}
                  placeholder="Optional notes about this release..."
                  value={publishNotes}
                  onChange={e => setPublishNotes(e.target.value)}
                />
              </div>
            </div>
            <div className="pe-modal-actions">
              <button className="pe-btn pe-btn-outline" onClick={() => setShowPublishModal(false)}>Cancel</button>
              <button className="pe-btn pe-btn-primary" onClick={handlePublish} disabled={publishing}>
                {publishing ? <span className="pe-spinner" /> : <Icon name="send" size={14} />}
                {publishing ? 'Publishing...' : 'Publish'}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ── Version History Drawer ───────────────────────────────────── */}
      {showVersions && (
        <div className="pe-modal-backdrop" onClick={() => setShowVersions(false)}>
          <div className="pe-modal" onClick={e => e.stopPropagation()} style={{ maxWidth: 560 }}>
            <div className="pe-modal-title">Version History</div>
            <div className="pe-modal-body">
              <div className="pe-version-list">
                {(equationData?.versions || []).map((v: any) => (
                  <div key={v.id} className="pe-version-item" style={{ borderBottom: '1px solid var(--pe-border)', paddingBottom: 10, marginBottom: 10 }}>
                    <span className="pe-version-num">v{v.version}</span>
                    <div className="pe-version-meta">
                      <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 2 }}>
                        <span className={`pe-badge ${v.status === 'PUBLISHED' ? 'pe-badge-published' : v.status === 'DRAFT' ? 'pe-badge-draft' : ''}`} style={{ fontSize: 10, padding: '2px 6px' }}>
                          {v.status}
                        </span>
                        <span className="pe-version-date">
                          {v.publishedAt ? new Date(v.publishedAt).toLocaleString() : v.updatedAt ? new Date(v.updatedAt).toLocaleString() : '—'}
                        </span>
                      </div>
                      <div className="pe-version-by">{v.description || '—'}</div>
                    </div>
                  </div>
                ))}
              </div>
            </div>
            <div className="pe-modal-actions">
              <button className="pe-btn pe-btn-outline" onClick={() => setShowVersions(false)}>Close</button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
