import React, { useState, useEffect } from 'react';
import { useStore } from '../../context/StoreContext';
import { ApiService } from '../../services/api';
import { Icon } from '../ui/Icon';

export const EquationBuilderView: React.FC = () => {
  const { showToast, setActiveView } = useStore();

  const [selectedTech, setSelectedTech] = useState<string>('FDM');
  const [equationData, setEquationData] = useState<any>(null);
  const [constantsList, setConstantsList] = useState<any[]>([]);
  const [loading, setLoading] = useState<boolean>(true);
  const [saving, setSaving] = useState<boolean>(false);
  const [testing, setTesting] = useState<boolean>(false);
  const [publishing, setPublishing] = useState<boolean>(false);

  // Active view mode in builder
  const [builderTab, setBuilderTab] = useState<'equation' | 'customVars' | 'constants' | 'test' | 'versions'>('equation');

  // Test parameters
  const [testParams, setTestParams] = useState({
    width: 30,
    height: 20,
    depth: 15,
    volumeCm3: 12,
    surfaceAreaCm2: 30,
    infillPercent: 20,
    layerHeightMm: 0.2,
    wallCount: 2,
    density: 1.24,
    machineTimeHours: 0.5,
    quantity: 1,
    material: 'pla',
  });

  const [testResult, setTestResult] = useState<any>(null);
  const [comparisonResult, setComparisonResult] = useState<any>(null);
  const [publishNotes, setPublishNotes] = useState<string>('');
  const [isPublishModalOpen, setIsPublishModalOpen] = useState<boolean>(false);

  // Editable custom variable modal/form
  const [newVar, setNewVar] = useState<{
    code: string;
    name: string;
    description: string;
    unit: string;
    leftVar: string;
    op: string;
    rightVar: string;
  }>({
    code: '',
    name: '',
    description: '',
    unit: 'EGP',
    leftVar: 'Weight',
    op: '*',
    rightVar: 'PLA_PRICE',
  });

  const technologies = [
    { key: 'FDM', label: 'FDM 3D Printing' },
    { key: 'SLA', label: 'SLA Stereolithography' },
    { key: 'SLS', label: 'SLS Laser Sintering' },
    { key: 'CNC_MILLING', label: 'CNC Milling' },
    { key: 'CNC_TURNING', label: 'CNC Turning' },
    { key: 'LASER_CUTTING', label: 'Laser Cutting' },
  ];

  const loadData = async (tech = selectedTech) => {
    setLoading(true);
    try {
      const data = await ApiService.getPricingEquation(tech);
      setEquationData(data);
      const consts = await ApiService.getPricingConstants();
      setConstantsList(consts || []);
    } catch (err: any) {
      showToast('Error', err.message || 'Failed to load equation data', 'error');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadData(selectedTech);
  }, [selectedTech]);

  const handleSaveDraft = async () => {
    if (!equationData) return;
    setSaving(true);
    try {
      const draft = equationData.draftVersion;
      await ApiService.saveDraftEquation(selectedTech, {
        formulaTree: draft.formulaTree,
        customVariables: draft.customVariables || [],
        constantsSnapshot: draft.constantsSnapshot,
        name: draft.name,
        description: draft.description,
      });
      showToast('Draft Saved', `Draft equation for ${selectedTech} saved successfully.`, 'success');
      loadData(selectedTech);
    } catch (err: any) {
      showToast('Save Failed', err.message || 'Failed to save draft', 'error');
    } finally {
      setSaving(false);
    }
  };

  const handleRunTest = async (isDraft = true) => {
    setTesting(true);
    try {
      const modelContext = {
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

      const result = await ApiService.testPricingEquation(selectedTech, {
        isDraft,
        modelContext,
      });
      setTestResult(result);

      // Also run comparison
      const comparison = await ApiService.comparePricingEquations(selectedTech, {
        modelContext,
      });
      setComparisonResult(comparison);
    } catch (err: any) {
      showToast('Test Calculation Failed', err.message || 'Error executing test', 'error');
    } finally {
      setTesting(false);
    }
  };

  const handlePublish = async () => {
    setPublishing(true);
    try {
      await ApiService.publishPricingEquation(selectedTech, {
        notes: publishNotes || 'Published via Equation Builder UI',
      });
      showToast('Equation Published', `${selectedTech} equation is now live for all customer quotations!`, 'success');
      setIsPublishModalOpen(false);
      setPublishNotes('');
      loadData(selectedTech);
    } catch (err: any) {
      showToast('Publish Failed', err.message || 'Failed to publish equation', 'error');
    } finally {
      setPublishing(false);
    }
  };

  const handleAddCustomVariable = () => {
    if (!newVar.code || !newVar.name) {
      showToast('Input Required', 'Please provide a variable code and name.', 'warning');
      return;
    }

    const createdVar = {
      code: newVar.code.trim().replace(/\s+/g, ''),
      name: newVar.name,
      description: newVar.description,
      unit: newVar.unit,
      dataType: 'number',
      formulaTree: {
        type: 'BINARY_OP',
        operator: newVar.op,
        left: { type: newVar.leftVar.includes('PRICE') || newVar.leftVar.includes('RATE') || newVar.leftVar.includes('MARGIN') ? 'CONSTANT' : 'VARIABLE', name: newVar.leftVar },
        right: { type: newVar.rightVar.includes('PRICE') || newVar.rightVar.includes('RATE') || newVar.rightVar.includes('MARGIN') ? 'CONSTANT' : 'VARIABLE', name: newVar.rightVar },
      },
      dependencies: [newVar.leftVar, newVar.rightVar].filter((v) => !v.includes('PRICE') && !v.includes('RATE') && !v.includes('MARGIN')),
      isEnabled: true,
    };

    const currentDraftVars = equationData?.draftVersion?.customVariables || [];
    const updated = [...currentDraftVars.filter((v: any) => v.code !== createdVar.code), createdVar];

    setEquationData({
      ...equationData,
      draftVersion: {
        ...equationData.draftVersion,
        customVariables: updated,
      },
    });

    setNewVar({ code: '', name: '', description: '', unit: 'EGP', leftVar: 'Weight', op: '*', rightVar: 'PLA_PRICE' });
    showToast('Variable Added', `Custom variable ${createdVar.code} added to draft.`, 'info');
  };

  const handleUpdateConstant = async (key: string, value: number) => {
    try {
      const c = constantsList.find((item) => item.key === key);
      if (!c) return;
      await ApiService.updatePricingConstant({
        key,
        name: c.name,
        value,
        unit: c.unit,
        description: c.description,
        technology: selectedTech,
      });
      showToast('Constant Updated', `${c.name} updated to ${value} ${c.unit}.`, 'success');
      loadData(selectedTech);
    } catch (err: any) {
      showToast('Update Failed', err.message || 'Failed to update constant', 'error');
    }
  };

  if (loading) {
    return (
      <main className="dashboard-layout">
        <div className="container" style={{ padding: '60px 0', textAlign: 'center' }}>
          <div className="skeleton" style={{ width: '80px', height: '80px', margin: '0 auto 20px', borderRadius: '50%' }} />
          <p>Loading Equation Builder...</p>
        </div>
      </main>
    );
  }

  const published = equationData?.publishedVersion;
  const draft = equationData?.draftVersion;
  const predefined = equationData?.predefinedVariables || [];
  const customVars = draft?.customVariables || [];

  return (
    <main className="dashboard-layout" style={{ minHeight: '85vh', paddingBottom: '60px' }}>
      <div className="container">
        {/* Header Bar */}
        <div className="dashboard-header-bar" style={{ marginBottom: '24px' }}>
          <div>
            <div className="user-welcome-title">
              <span>CAM LABS — Pricing Engine & Equation Builder</span>
              <span className="badge badge-primary" style={{ marginLeft: '12px' }}>v{published?.version || 1} Published</span>
              <span className="badge badge-warning" style={{ marginLeft: '6px' }}>v{draft?.version || 2} Draft</span>
            </div>
            <div className="dashboard-user-meta">
              Authoritative Centralized Pricing Architecture · Zero Platform Fee · All calculations in EGP
            </div>
          </div>
          <div className="dashboard-actions-cluster">
            <button className="btn btn-sm btn-outline" onClick={() => setActiveView('dashboard')}>
              <Icon name="review" size={14} /> Back to Dashboard
            </button>
            <button className="btn btn-sm btn-outline" onClick={handleSaveDraft} disabled={saving}>
              <Icon name="check" size={14} /> {saving ? 'Saving...' : 'Save Draft'}
            </button>
            <button className="btn btn-sm btn-primary" onClick={() => setIsPublishModalOpen(true)}>
              <Icon name="send" size={14} /> Publish Equation
            </button>
          </div>
        </div>

        {/* Technology Selector Tabs */}
        <div style={{ display: 'flex', gap: '8px', marginBottom: '24px', flexWrap: 'wrap', borderBottom: '1px solid var(--cam-border-subtle)', paddingBottom: '12px' }}>
          {technologies.map((tech) => (
            <button
              key={tech.key}
              className={`btn btn-sm ${selectedTech === tech.key ? 'btn-primary' : 'btn-outline'}`}
              onClick={() => setSelectedTech(tech.key)}
            >
              {tech.label}
            </button>
          ))}
        </div>

        {/* Builder View Mode Tabs */}
        <div style={{ display: 'flex', gap: '12px', marginBottom: '20px' }}>
          <button className={`btn btn-sm ${builderTab === 'equation' ? 'btn-primary' : 'btn-outline'}`} onClick={() => setBuilderTab('equation')}>
            Equation Box
          </button>
          <button className={`btn btn-sm ${builderTab === 'customVars' ? 'btn-primary' : 'btn-outline'}`} onClick={() => setBuilderTab('customVars')}>
            Custom Variables ({customVars.length})
          </button>
          <button className={`btn btn-sm ${builderTab === 'constants' ? 'btn-primary' : 'btn-outline'}`} onClick={() => setBuilderTab('constants')}>
            Pricing Constants ({constantsList.length})
          </button>
          <button className={`btn btn-sm ${builderTab === 'test' ? 'btn-primary' : 'btn-outline'}`} onClick={() => { setBuilderTab('test'); handleRunTest(); }}>
            Testing & Comparison
          </button>
          <button className={`btn btn-sm ${builderTab === 'versions' ? 'btn-primary' : 'btn-outline'}`} onClick={() => setBuilderTab('versions')}>
            Version History
          </button>
        </div>

        {/* ─── TAB 1: VISUAL EQUATION BOX ────────────────────────────────────────── */}
        {builderTab === 'equation' && (
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 340px', gap: '24px' }}>
            <div className="dashboard-section-panel">
              <div className="panel-header-row">
                <div className="panel-title-group">
                  <h3 className="panel-title">Active Equation Canvas (Draft v{draft?.version})</h3>
                  <span className="badge badge-neutral">Visual Formula Box</span>
                </div>
              </div>

              {/* Formula Visual Box */}
              <div style={{
                background: 'rgba(0,0,0,0.4)',
                border: '1px solid var(--cam-border-medium)',
                borderRadius: '8px',
                padding: '24px',
                marginBottom: '20px',
                fontFamily: 'monospace',
                fontSize: '18px',
                color: '#4ade80',
              }}>
                <div style={{ fontSize: '13px', color: 'var(--cam-text-muted)', marginBottom: '10px' }}>Final Unit Price Formula:</div>
                <div style={{ display: 'flex', alignItems: 'center', flexWrap: 'wrap', gap: '8px' }}>
                  <span style={{ padding: '4px 10px', background: 'rgba(59, 130, 246, 0.2)', border: '1px solid #3b82f6', borderRadius: '4px', color: '#60a5fa' }}>BaseCost</span>
                  <span style={{ color: '#f59e0b', fontWeight: 'bold' }}>+</span>
                  <span style={{ padding: '4px 10px', background: 'rgba(59, 130, 246, 0.2)', border: '1px solid #3b82f6', borderRadius: '4px', color: '#60a5fa' }}>Profit</span>
                </div>
                <div style={{ fontSize: '12px', color: 'var(--cam-text-muted)', marginTop: '16px' }}>
                  Order Total = Unit Price × Quantity (EGP) · Profit = BaseCost × Profit Margin (20%)
                </div>
              </div>

              {/* Visual Breakdown of Equation Pipeline */}
              <div style={{ marginBottom: '20px' }}>
                <h4 style={{ fontSize: '15px', color: 'var(--cam-text-secondary)', marginBottom: '12px' }}>Equation Pipeline Hierarchy</h4>
                <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
                  <div style={{ padding: '12px', background: 'var(--cam-surface-2)', borderRadius: '6px', border: '1px solid var(--cam-border-subtle)' }}>
                    <strong>1. Model Variables:</strong> <span style={{ color: 'var(--cam-text-muted)' }}>Volume (cm³), SurfaceArea (cm²), Infill (%), LayerHeight (mm), Density (g/cm³), MachineTime (hours)</span>
                  </div>
                  <div style={{ padding: '12px', background: 'var(--cam-surface-2)', borderRadius: '6px', border: '1px solid var(--cam-border-subtle)' }}>
                    <strong>2. Weight:</strong> <span style={{ color: 'var(--cam-text-muted)' }}>Density × Volume (g)</span>
                  </div>
                  <div style={{ padding: '12px', background: 'var(--cam-surface-2)', borderRadius: '6px', border: '1px solid var(--cam-border-subtle)' }}>
                    <strong>3. Material Cost:</strong> <span style={{ color: 'var(--cam-text-muted)' }}>Weight × PLA Price (2 EGP/g)</span>
                  </div>
                  <div style={{ padding: '12px', background: 'var(--cam-surface-2)', borderRadius: '6px', border: '1px solid var(--cam-border-subtle)' }}>
                    <strong>4. Machine Cost:</strong> <span style={{ color: 'var(--cam-text-muted)' }}>MachineTime × Machine Hourly Rate (50 EGP/hour)</span>
                  </div>
                  <div style={{ padding: '12px', background: 'var(--cam-surface-2)', borderRadius: '6px', border: '1px solid var(--cam-border-subtle)' }}>
                    <strong>5. Base Cost:</strong> <span style={{ color: 'var(--cam-text-muted)' }}>Material Cost + Machine Cost (EGP)</span>
                  </div>
                  <div style={{ padding: '12px', background: 'var(--cam-surface-2)', borderRadius: '6px', border: '1px solid var(--cam-border-subtle)' }}>
                    <strong>6. Profit Margin:</strong> <span style={{ color: 'var(--cam-text-muted)' }}>Base Cost × Profit Margin (20%)</span>
                  </div>
                </div>
              </div>
            </div>

            {/* Predefined Variables Palette */}
            <div className="dashboard-section-panel">
              <h3 className="panel-title" style={{ marginBottom: '16px' }}>Predefined CAD Variables</h3>
              <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
                {predefined.map((pv: any) => (
                  <div key={pv.code} style={{ padding: '8px 12px', background: 'var(--cam-surface-2)', borderRadius: '6px', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                    <div>
                      <span style={{ fontWeight: 'bold', color: '#60a5fa', fontSize: '13px' }}>{pv.code}</span>
                      <div style={{ fontSize: '11px', color: 'var(--cam-text-muted)' }}>{pv.description}</div>
                    </div>
                    <span className="badge badge-neutral" style={{ fontSize: '10px' }}>{pv.unit}</span>
                  </div>
                ))}
              </div>
            </div>
          </div>
        )}

        {/* ─── TAB 2: CUSTOM VARIABLES ────────────────────────────────────────── */}
        {builderTab === 'customVars' && (
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 380px', gap: '24px' }}>
            <div className="dashboard-section-panel">
              <div className="panel-header-row">
                <div className="panel-title-group">
                  <h3 className="panel-title">Reusable Custom Variables</h3>
                  <span className="badge badge-neutral">{customVars.length} defined</span>
                </div>
              </div>

              <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
                {customVars.map((cv: any) => (
                  <div key={cv.code} style={{ padding: '16px', background: 'var(--cam-surface-2)', borderRadius: '8px', border: '1px solid var(--cam-border-subtle)' }}>
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '8px' }}>
                      <span style={{ fontSize: '16px', fontWeight: 'bold', color: '#60a5fa' }}>{cv.code}</span>
                      <span className="badge badge-blue">{cv.unit}</span>
                    </div>
                    <div style={{ fontSize: '13px', color: 'var(--cam-text-secondary)', marginBottom: '8px' }}>{cv.description}</div>
                    <div style={{ fontSize: '12px', color: 'var(--cam-text-muted)' }}>
                      Dependencies: {cv.dependencies?.join(', ') || 'None'}
                    </div>
                  </div>
                ))}
              </div>
            </div>

            {/* Add Custom Variable Form */}
            <div className="dashboard-section-panel">
              <h3 className="panel-title" style={{ marginBottom: '16px' }}>Add Custom Variable</h3>
              <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
                <div>
                  <label className="form-label" style={{ fontSize: '12px' }}>Variable Code</label>
                  <input
                    className="form-control"
                    placeholder="e.g. TotalLaborCost"
                    value={newVar.code}
                    onChange={(e) => setNewVar({ ...newVar, code: e.target.value })}
                  />
                </div>
                <div>
                  <label className="form-label" style={{ fontSize: '12px' }}>Display Name</label>
                  <input
                    className="form-control"
                    placeholder="e.g. Total Labor Cost"
                    value={newVar.name}
                    onChange={(e) => setNewVar({ ...newVar, name: e.target.value })}
                  />
                </div>
                <div>
                  <label className="form-label" style={{ fontSize: '12px' }}>Unit</label>
                  <select
                    className="form-control"
                    value={newVar.unit}
                    onChange={(e) => setNewVar({ ...newVar, unit: e.target.value })}
                  >
                    <option value="EGP">EGP</option>
                    <option value="g">g</option>
                    <option value="cm3">cm3</option>
                    <option value="mm">mm</option>
                    <option value="hour">hour</option>
                    <option value="percentage">%</option>
                    <option value="unitless">unitless</option>
                  </select>
                </div>
                <div>
                  <label className="form-label" style={{ fontSize: '12px' }}>Equation (Left × Right)</label>
                  <div style={{ display: 'flex', gap: '6px' }}>
                    <input
                      className="form-control"
                      placeholder="Left Identifier"
                      value={newVar.leftVar}
                      onChange={(e) => setNewVar({ ...newVar, leftVar: e.target.value })}
                    />
                    <select
                      className="form-control"
                      style={{ width: '70px' }}
                      value={newVar.op}
                      onChange={(e) => setNewVar({ ...newVar, op: e.target.value })}
                    >
                      <option value="*">×</option>
                      <option value="+">+</option>
                      <option value="-">-</option>
                      <option value="/">÷</option>
                      <option value="^">^</option>
                    </select>
                    <input
                      className="form-control"
                      placeholder="Right Identifier"
                      value={newVar.rightVar}
                      onChange={(e) => setNewVar({ ...newVar, rightVar: e.target.value })}
                    />
                  </div>
                </div>
                <button className="btn btn-primary" onClick={handleAddCustomVariable} style={{ marginTop: '8px' }}>
                  <Icon name="check" size={14} /> Add to Draft
                </button>
              </div>
            </div>
          </div>
        )}

        {/* ─── TAB 3: PRICING CONSTANTS ────────────────────────────────────────── */}
        {builderTab === 'constants' && (
          <div className="dashboard-section-panel">
            <div className="panel-header-row">
              <div className="panel-title-group">
                <h3 className="panel-title">Configurable Pricing Constants</h3>
                <span className="badge badge-neutral">Technology: {selectedTech}</span>
              </div>
            </div>
            <p style={{ color: 'var(--cam-text-muted)', fontSize: '13px', marginBottom: '20px' }}>
              These rates are stored in the database and can be adjusted without code modifications. No hardcoded constants or platform fees are used.
            </p>

            <div className="table-responsive">
              <table className="cam-table">
                <thead>
                  <tr>
                    <th>Constant Key</th>
                    <th>Name</th>
                    <th>Configured Value</th>
                    <th>Unit</th>
                    <th>Description</th>
                    <th>Action</th>
                  </tr>
                </thead>
                <tbody>
                  {constantsList.map((c) => (
                    <tr key={c.key}>
                      <td><strong className="mono-primary">{c.key}</strong></td>
                      <td>{c.name}</td>
                      <td>
                        <input
                          type="number"
                          step="any"
                          className="form-control"
                          style={{ width: '120px' }}
                          defaultValue={c.value}
                          onBlur={(e) => handleUpdateConstant(c.key, Number(e.target.value))}
                        />
                      </td>
                      <td><span className="mono-tag">{c.unit}</span></td>
                      <td style={{ color: 'var(--cam-text-muted)', fontSize: '12px' }}>{c.description}</td>
                      <td>
                        <span className="badge badge-neutral">Auto-saved</span>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        )}

        {/* ─── TAB 4: TESTING & COMPARISON ────────────────────────────────────── */}
        {builderTab === 'test' && (
          <div style={{ display: 'grid', gridTemplateColumns: '320px 1fr', gap: '24px' }}>
            {/* Test Input Parameters */}
            <div className="dashboard-section-panel">
              <h3 className="panel-title" style={{ marginBottom: '16px' }}>Test Model Parameters</h3>
              <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
                <div>
                  <label className="form-label" style={{ fontSize: '12px' }}>Model Volume (cm³)</label>
                  <input
                    type="number"
                    className="form-control"
                    value={testParams.volumeCm3}
                    onChange={(e) => setTestParams({ ...testParams, volumeCm3: Number(e.target.value) })}
                  />
                </div>
                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: '6px' }}>
                  <div>
                    <label className="form-label" style={{ fontSize: '11px' }}>Width (mm)</label>
                    <input
                      type="number"
                      className="form-control"
                      value={testParams.width}
                      onChange={(e) => setTestParams({ ...testParams, width: Number(e.target.value) })}
                    />
                  </div>
                  <div>
                    <label className="form-label" style={{ fontSize: '11px' }}>Height (mm)</label>
                    <input
                      type="number"
                      className="form-control"
                      value={testParams.height}
                      onChange={(e) => setTestParams({ ...testParams, height: Number(e.target.value) })}
                    />
                  </div>
                  <div>
                    <label className="form-label" style={{ fontSize: '11px' }}>Depth (mm)</label>
                    <input
                      type="number"
                      className="form-control"
                      value={testParams.depth}
                      onChange={(e) => setTestParams({ ...testParams, depth: Number(e.target.value) })}
                    />
                  </div>
                </div>
                <div>
                  <label className="form-label" style={{ fontSize: '12px' }}>Infill (%)</label>
                  <input
                    type="number"
                    className="form-control"
                    value={testParams.infillPercent}
                    onChange={(e) => setTestParams({ ...testParams, infillPercent: Number(e.target.value) })}
                  />
                </div>
                <div>
                  <label className="form-label" style={{ fontSize: '12px' }}>Layer Height (mm)</label>
                  <input
                    type="number"
                    step="0.05"
                    className="form-control"
                    value={testParams.layerHeightMm}
                    onChange={(e) => setTestParams({ ...testParams, layerHeightMm: Number(e.target.value) })}
                  />
                </div>
                <div>
                  <label className="form-label" style={{ fontSize: '12px' }}>Quantity</label>
                  <input
                    type="number"
                    min="1"
                    className="form-control"
                    value={testParams.quantity}
                    onChange={(e) => setTestParams({ ...testParams, quantity: Number(e.target.value) })}
                  />
                </div>
                <button className="btn btn-primary" onClick={() => handleRunTest()} disabled={testing}>
                  <Icon name="technology" size={14} /> {testing ? 'Calculating...' : 'Run Test & Compare'}
                </button>
              </div>
            </div>

            {/* Test Results & Comparison */}
            <div className="dashboard-section-panel">
              <div className="panel-header-row">
                <div className="panel-title-group">
                  <h3 className="panel-title">Side-by-Side Pricing Comparison</h3>
                  <span className="badge badge-warning">Current Published vs Draft</span>
                </div>
              </div>

              {comparisonResult ? (
                <div>
                  {/* Comparison Summary Cards */}
                  <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr 1fr', gap: '12px', marginBottom: '24px' }}>
                    <div style={{ padding: '16px', background: 'var(--cam-surface-2)', borderRadius: '8px' }}>
                      <div style={{ fontSize: '12px', color: 'var(--cam-text-muted)' }}>Published Price</div>
                      <div style={{ fontSize: '20px', fontWeight: 'bold', color: '#60a5fa' }}>{comparisonResult.previousPrice.toFixed(2)} EGP</div>
                    </div>
                    <div style={{ padding: '16px', background: 'var(--cam-surface-2)', borderRadius: '8px' }}>
                      <div style={{ fontSize: '12px', color: 'var(--cam-text-muted)' }}>Draft Price</div>
                      <div style={{ fontSize: '20px', fontWeight: 'bold', color: '#4ade80' }}>{comparisonResult.newPrice.toFixed(2)} EGP</div>
                    </div>
                    <div style={{ padding: '16px', background: 'var(--cam-surface-2)', borderRadius: '8px' }}>
                      <div style={{ fontSize: '12px', color: 'var(--cam-text-muted)' }}>Difference</div>
                      <div style={{ fontSize: '20px', fontWeight: 'bold', color: comparisonResult.differenceEgp >= 0 ? '#f59e0b' : '#ef4444' }}>
                        {comparisonResult.differenceEgp >= 0 ? '+' : ''}{comparisonResult.differenceEgp.toFixed(2)} EGP
                      </div>
                    </div>
                    <div style={{ padding: '16px', background: 'var(--cam-surface-2)', borderRadius: '8px' }}>
                      <div style={{ fontSize: '12px', color: 'var(--cam-text-muted)' }}>Percent Difference</div>
                      <div style={{ fontSize: '20px', fontWeight: 'bold', color: '#38bdf8' }}>
                        {comparisonResult.percentDifference}%
                      </div>
                    </div>
                  </div>

                  {/* Detailed Itemized Breakdown Diff */}
                  <h4 style={{ fontSize: '15px', color: 'var(--cam-text-secondary)', marginBottom: '12px' }}>Itemized Breakdown Diff</h4>
                  <table className="cam-table">
                    <thead>
                      <tr>
                        <th>Cost Component</th>
                        <th>Published (Live)</th>
                        <th>Draft (New)</th>
                        <th>Delta</th>
                      </tr>
                    </thead>
                    <tbody>
                      <tr>
                        <td><strong>Material Cost</strong></td>
                        <td>{comparisonResult.publishedBreakdown?.materialCost?.toFixed(2) || '0.00'} EGP</td>
                        <td>{comparisonResult.draftBreakdown?.materialCost?.toFixed(2) || '0.00'} EGP</td>
                        <td>{((comparisonResult.draftBreakdown?.materialCost || 0) - (comparisonResult.publishedBreakdown?.materialCost || 0)).toFixed(2)} EGP</td>
                      </tr>
                      <tr>
                        <td><strong>Machine Cost</strong></td>
                        <td>{comparisonResult.publishedBreakdown?.machineCost?.toFixed(2) || '0.00'} EGP</td>
                        <td>{comparisonResult.draftBreakdown?.machineCost?.toFixed(2) || '0.00'} EGP</td>
                        <td>{((comparisonResult.draftBreakdown?.machineCost || 0) - (comparisonResult.publishedBreakdown?.machineCost || 0)).toFixed(2)} EGP</td>
                      </tr>
                      <tr>
                        <td><strong>Base Cost</strong></td>
                        <td>{comparisonResult.publishedBreakdown?.baseCost?.toFixed(2) || '0.00'} EGP</td>
                        <td>{comparisonResult.draftBreakdown?.baseCost?.toFixed(2) || '0.00'} EGP</td>
                        <td>{((comparisonResult.draftBreakdown?.baseCost || 0) - (comparisonResult.publishedBreakdown?.baseCost || 0)).toFixed(2)} EGP</td>
                      </tr>
                      <tr>
                        <td><strong>Profit Margin ({comparisonResult.draftBreakdown?.profitMarginPercentage || 20}%)</strong></td>
                        <td>{comparisonResult.publishedBreakdown?.profit?.toFixed(2) || '0.00'} EGP</td>
                        <td>{comparisonResult.draftBreakdown?.profit?.toFixed(2) || '0.00'} EGP</td>
                        <td>{((comparisonResult.draftBreakdown?.profit || 0) - (comparisonResult.publishedBreakdown?.profit || 0)).toFixed(2)} EGP</td>
                      </tr>
                      <tr style={{ background: 'var(--cam-surface-2)', fontWeight: 'bold' }}>
                        <td><strong>Final Total Price</strong></td>
                        <td style={{ color: '#60a5fa' }}>{comparisonResult.publishedBreakdown?.finalTotalPrice?.toFixed(2) || '0.00'} EGP</td>
                        <td style={{ color: '#4ade80' }}>{comparisonResult.draftBreakdown?.finalTotalPrice?.toFixed(2) || '0.00'} EGP</td>
                        <td style={{ color: '#f59e0b' }}>{comparisonResult.differenceEgp.toFixed(2)} EGP</td>
                      </tr>
                    </tbody>
                  </table>
                  {testResult && (
                    <div style={{ marginTop: '20px', padding: '12px', background: 'var(--cam-surface-2)', borderRadius: '6px' }}>
                      <span style={{ fontSize: '12px', color: 'var(--cam-text-muted)' }}>
                        Calculated Unit Price: <strong style={{ color: '#60a5fa' }}>{testResult.unitPrice?.toFixed(2)} EGP</strong> · Total: <strong style={{ color: '#4ade80' }}>{testResult.totalPrice?.toFixed(2)} EGP</strong>
                      </span>
                    </div>
                  )}
                </div>
              ) : (
                <div style={{ textAlign: 'center', padding: '40px', color: 'var(--cam-text-muted)' }}>
                  Click "Run Test & Compare" to evaluate the draft against the live published equation.
                </div>
              )}
            </div>
          </div>
        )}

        {/* ─── TAB 5: VERSION HISTORY ─────────────────────────────────────────── */}
        {builderTab === 'versions' && (
          <div className="dashboard-section-panel">
            <h3 className="panel-title" style={{ marginBottom: '16px' }}>Version Audit & History</h3>
            <table className="cam-table">
              <thead>
                <tr>
                  <th>Version</th>
                  <th>Status</th>
                  <th>Published Date</th>
                  <th>Published By</th>
                  <th>Release Notes</th>
                </tr>
              </thead>
              <tbody>
                {(equationData?.versions || []).map((v: any) => (
                  <tr key={v.id}>
                    <td><strong className="mono-primary">v{v.version}</strong></td>
                    <td>
                      <span className={`badge ${v.status === 'PUBLISHED' ? 'badge-primary' : v.status === 'DRAFT' ? 'badge-warning' : 'badge-neutral'}`}>
                        {v.status}
                      </span>
                    </td>
                    <td>{v.publishedAt ? new Date(v.publishedAt).toLocaleString() : '—'}</td>
                    <td>{v.publishedBy || '—'}</td>
                    <td style={{ color: 'var(--cam-text-muted)' }}>{v.description || '—'}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}

        {/* ─── PUBLISH MODAL ─────────────────────────────────────────────────── */}
        {isPublishModalOpen && (
          <div className="modal-backdrop">
            <div className="modal-content" style={{ maxWidth: '520px', background: 'var(--cam-surface-2)', border: '1px solid var(--cam-border-medium)', borderRadius: '12px', padding: '24px' }}>
              <h3 style={{ fontSize: '18px', color: 'var(--cam-text-primary)', marginBottom: '12px' }}>Publish Equation to Live Quotations</h3>
              <p style={{ fontSize: '13px', color: 'var(--cam-text-muted)', marginBottom: '16px' }}>
                Publishing will turn draft <strong>v{draft?.version}</strong> into the live authoritative equation for <strong>{selectedTech}</strong>. Existing historical quotes will retain their original version data.
              </p>
              <div style={{ marginBottom: '16px' }}>
                <label className="form-label" style={{ fontSize: '12px' }}>Publication / Release Notes</label>
                <textarea
                  className="form-control"
                  rows={3}
                  placeholder="e.g. Updated PLA rates to 2 EGP/g and machine rates to 50 EGP/hour"
                  value={publishNotes}
                  onChange={(e) => setPublishNotes(e.target.value)}
                />
              </div>
              <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '12px' }}>
                <button className="btn btn-outline" onClick={() => setIsPublishModalOpen(false)}>
                  Cancel
                </button>
                <button className="btn btn-primary" onClick={handlePublish} disabled={publishing}>
                  {publishing ? 'Publishing...' : 'Confirm & Publish Live'}
                </button>
              </div>
            </div>
          </div>
        )}
      </div>
    </main>
  );
};
