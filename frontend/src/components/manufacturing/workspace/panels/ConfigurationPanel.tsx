import { useEffect, useState } from 'react';
import { AnimatePresence, motion } from 'motion/react';
import { Icon, IconName } from '../../../ui/Icon';
import { RequiredMark } from '../../../ui/FieldLabel';
import { CAM_EASE } from '../../../ui/AnimatedModal';
import { fdmParametersFor, normalizeInfillInput } from '../helpers';
import { PanelShell } from '../PanelShell';
import { INFILL_OPTIONS, PRIORITY_SHIPPING_FEE_EGP, WALL_OPTIONS, panelIds } from '../constants';
import { ConfigTab, FileConfiguration, PanelStatus, RequestState } from '../types';

export const ConfigurationPanel = ({ request, isPrinting, activeConfigTab, configReady, status, selectedSupportEnabled, priorityShipping, onTabChange, onUpdate, onConfigUpdate, onPriorityShippingChange }: {
  request: RequestState;
  isPrinting: boolean;
  activeConfigTab: ConfigTab;
  configReady: boolean;
  status: PanelStatus;
  selectedSupportEnabled: boolean;
  priorityShipping: boolean;
  onTabChange: (tab: ConfigTab) => void;
  onUpdate: (p: Partial<RequestState>) => void;
  onConfigUpdate: (u: Partial<FileConfiguration>) => void;
  onPriorityShippingChange: (v: boolean) => void;
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
        <div className="mw-stage-config-divider" aria-hidden="true" />
        <AnimatePresence mode="wait" initial={false}>
          <motion.div
            key={activeConfigTab}
            className="cam-motion"
            initial={{ opacity: 0, y: 4 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -2 }}
            transition={{ duration: 0.14, ease: CAM_EASE }}
          >
            {activeConfigTab === 'basic' ? (
              <ConfigTabBasic request={request} isPrinting={isPrinting} onUpdate={onUpdate} />
            ) : (
              <ConfigTabAdvanced request={request} isPrinting={isPrinting} selectedSupportEnabled={selectedSupportEnabled} onUpdate={onUpdate} onConfigUpdate={onConfigUpdate} />
            )}
          </motion.div>
        </AnimatePresence>

        {/* Restored Delivery Priority add-on: a real option in the options box,
            sharing the single `priorityShipping` source of truth with the pricing
            summary. The derived +100 EGP surcharge is applied by priceWithPriority,
            so this switch and the total can never diverge. */}
        <div className="mw-stage-config-divider" aria-hidden="true" />
        <div className="mw-stage-config-field mw-config-delivery" data-delivery-priority>
          <label className="mw-stage-config-label">Delivery Priority</label>
          <div className="mw-config-delivery-row">
            <span className="mw-config-delivery-text">
              <span className="mw-config-delivery-title">Faster delivery of your order</span>
              <span className="mw-config-delivery-fee">+{PRIORITY_SHIPPING_FEE_EGP} EGP</span>
            </span>
            <button
              type="button"
              className={`mw-toggle ${priorityShipping ? 'is-on' : ''}`}
              role="switch"
              aria-checked={priorityShipping}
              aria-label="Delivery Priority"
              onClick={() => onPriorityShippingChange(!priorityShipping)}
            >
              <span className="mw-toggle-thumb" />
            </button>
          </div>
        </div>
      </div>
    )}
  </PanelShell>
);

const ConfigTabBasic = ({ request, isPrinting, onUpdate }: { request: RequestState; isPrinting: boolean; onUpdate: (p: Partial<RequestState>) => void }) => (
  <div className="mw-stage-config-fields">
    {isPrinting && (
      <div className="mw-stage-config-field mw-profile-section">
        <div className="mw-stage-config-section-title">Print Profile</div>
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
  </div>
);

const CustomInfillField = ({ value, presetInfill, onCommit }: { value: number | null | undefined; presetInfill: number; onCommit: (v: number) => void }) => {
  const [text, setText] = useState(value != null ? String(value) : String(presetInfill));
  useEffect(() => { if (value != null) setText(String(value)); }, [value]);
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

const PROFILE_ICONS: Record<string, IconName> = {
  lightweight: 'layers3',
  standard: 'shieldCheck',
  strong: 'layers',
  solid: 'cube',
};

const ConfigBasicProfiles = ({ request, onQualityChange }: { request: RequestState; onQualityChange: (q: string, tolerance: string, wallCount: number) => void }) => {
  const profiles = [
    { id: 'lightweight', quality: 'sparse', tolerance: 'standard', wallCount: 2, meta: '10% infill · 2 walls', description: 'Lightweight, decorative' },
    { id: 'standard', quality: 'standard', tolerance: 'standard', wallCount: 3, meta: '15% infill · 3 walls', description: 'Standard daily prints', recommended: true },
    { id: 'strong', quality: 'high', tolerance: 'precision', wallCount: 5, meta: '30% infill · 5 walls', description: 'Strong functional parts' },
    { id: 'solid', quality: 'premium', tolerance: 'precision', wallCount: 5, meta: '100% infill · 5 walls', description: 'Maximum density parts' },
  ];
  const sel = profiles.find((p) => p.quality === request.quality && p.tolerance === request.tolerance && p.wallCount === request.wallCount) || profiles.find((p) => p.quality === request.quality && p.tolerance === request.tolerance) || profiles[1];
  return (
    <div className="mw-profile-list">
      {profiles.map((p) => {
        const selected = sel.id === p.id;
        return (
          <button key={p.id} type="button" className={`mw-profile-item ${selected ? 'is-selected' : ''}`} aria-pressed={selected} onClick={() => onQualityChange(p.quality, p.tolerance, p.wallCount)}>
            <span className="mw-profile-head">
              <span className="mw-profile-icon" aria-hidden="true"><Icon name={PROFILE_ICONS[p.id]} size={14} /></span>
              <span className="mw-profile-name">{p.id.charAt(0).toUpperCase() + p.id.slice(1)}</span>
              {p.recommended && <span className="mw-profile-badge">REC</span>}
            </span>
            <span className="mw-profile-tech">{p.meta}</span>
            <span className="mw-profile-desc">{p.description}</span>
            <span className={`mw-profile-check ${selected ? 'is-selected' : ''}`} aria-hidden="true">{selected && <Icon name="check" size={11} />}</span>
          </button>
        );
      })}
    </div>
  );
};