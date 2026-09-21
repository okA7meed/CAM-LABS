import React from 'react';
import { CadFile } from '../../../types';
import { Icon } from '../../ui/Icon';
import { humanizeSpecValue } from '../order-detail/format';
import { CadThumbnail } from '../order-detail/CadThumbnail';
import { fmtEgp, fmtHoursShort, fmtInt, fmtNum, formatDimsMm } from './format';
import { QuoteFileVM } from './types';

const rec = (v: unknown): Record<string, unknown> => (v && typeof v === 'object' ? (v as Record<string, unknown>) : {});
const num = (v: unknown): number | null => (typeof v === 'number' && Number.isFinite(v) ? v : null);

const weightOf = (pb: Record<string, unknown>): string => {
  const evaluated = rec(pb.customVariablesEvaluated);
  const direct = rec(evaluated.Weight);
  if (typeof direct.formatted === 'string' && direct.formatted) return direct.formatted;
  const components = Array.isArray(rec(pb.equationBreakdown).components) ? (rec(pb.equationBreakdown).components as Record<string, unknown>[]) : [];
  const found = components.find((c) => c.code === 'Weight');
  if (found && typeof found.formatted === 'string' && found.formatted) return found.formatted;
  if (num(direct.value) !== null) return `${fmtNum(direct.value)} g`;
  if (found && num(found.value) !== null) return `${fmtNum(found.value)} g`;
  return '—';
};

export const fileFinalPrice = (file: QuoteFileVM): string => {
  const eb = rec(file.pricingBreakdown.equationBreakdown);
  const total = num(eb.finalTotalPrice);
  if (total !== null) return fmtEgp(total);
  if (num(file.perUnitCost) !== null) return fmtEgp((file.perUnitCost as number) * file.quantity);
  return '—';
};

const SummaryStat: React.FC<{ icon: string; label: string; value: string }> = ({ icon, label, value }) => (
  <div className="qd-file-stat">
    <span className="qd-file-stat-label"><Icon name={icon as 'cube'} size={12} />{label}</span>
    <span className="qd-file-stat-value" title={value}>{value}</span>
  </div>
);

const DetailRow: React.FC<{ label: string; value: string; title?: string }> = ({ label, value, title }) => (
  <div className="qd-detail-row">
    <span className="qd-detail-label">{label}</span>
    <span className="qd-detail-value" title={title || value}>{value}</span>
  </div>
);

const FileDetails: React.FC<{ file: QuoteFileVM; onEditPrice: () => void; canMutate: boolean }> = ({ file, onEditPrice, canMutate }) => {
  const pb = file.pricingBreakdown;
  const geometry = rec(pb.geometry);
  const manufacturing = rec(pb.manufacturing);
  const material = rec(pb.material);
  const machine = rec(pb.machine);
  const labor = rec(pb.labor);
  const eb = rec(pb.equationBreakdown);
  const units = typeof geometry.units === 'string' ? geometry.units : 'mm';
  const profitPct = num(eb.profitMarginPercentage);
  const machineCost = num(machine.cost) ?? num(pb.machineCost);
  const materialCost = num(material.cost) ?? num(pb.materialCost);

  return (
    <div className="qd-file-details">
      <div className="qd-detail-card">
        <h4 className="qd-detail-title"><Icon name="configure" size={14} />Geometry &amp; Print Settings</h4>
        <DetailRow label="Units" value={units} />
        <DetailRow label="Dimensions (W × D × H)" value={formatDimsMm(geometry.dimensionsMm)} />
        <DetailRow label="Volume" value={num(geometry.volumeCm3) !== null ? `${fmtNum(geometry.volumeCm3)} cm³` : '—'} />
        <DetailRow label="Surface Area" value={num(geometry.surfaceAreaCm2) !== null ? `${fmtNum(geometry.surfaceAreaCm2)} cm²` : '—'} />
        <DetailRow label="Triangle Count" value={num(geometry.triangleCount) !== null ? fmtInt(geometry.triangleCount) : '—'} />
        <DetailRow label="Layer Count" value={num(manufacturing.layerCount) !== null ? fmtInt(manufacturing.layerCount) : '—'} />
        <DetailRow label="Line Width" value={num(manufacturing.lineWidthMm) !== null ? `${fmtNum(manufacturing.lineWidthMm)} mm` : '—'} />
        <DetailRow label="Layer Height" value={num(manufacturing.layerHeightMm) !== null ? `${fmtNum(manufacturing.layerHeightMm)} mm` : '—'} />
        <DetailRow label="Infill Percent" value={num(manufacturing.infillPercent) !== null ? `${fmtNum((manufacturing.infillPercent as number), 0)}%` : '—'} />
      </div>
      <div className="qd-detail-card">
        <h4 className="qd-detail-title"><Icon name="calculator" size={14} />Costs Breakdown (EGP)</h4>
        <DetailRow label="Machine Cost" value={machineCost !== null ? fmtNum(machineCost) : '—'} />
        <DetailRow label="Material Cost" value={materialCost !== null ? fmtNum(materialCost) : '—'} />
        <DetailRow label="Labor Cost" value={num(labor.cost) !== null ? fmtNum(labor.cost) : '—'} />
        <DetailRow label="Setup Cost" value={num(pb.setupCost) !== null ? fmtNum(pb.setupCost) : '—'} />
        <div className="qd-detail-sep" role="separator" aria-hidden="true" />
        <DetailRow label="Base Cost" value={num(eb.baseCost) !== null ? fmtNum(eb.baseCost) : '—'} />
        <DetailRow label={`Profit Margin${profitPct !== null ? ` (${fmtNum(profitPct, 0)}%)` : ''}`} value={num(eb.profit) !== null ? fmtNum(eb.profit) : '—'} />
        <div className="qd-final-box">
          <span>Final Price</span>
          <strong>{fileFinalPrice(file)}</strong>
          {canMutate && (
            <button type="button" className="qd-price-edit" onClick={onEditPrice} title="Edit quote price" aria-label="Edit quote price">
              <Icon name="configure" size={12} />
            </button>
          )}
        </div>
      </div>
      <div className="qd-detail-card">
        <h4 className="qd-detail-title"><Icon name="database" size={14} />Material Details</h4>
        <DetailRow label="Material" value={humanizeSpecValue(manufacturing.material || file.material)} />
        <DetailRow label="Material Usage" value={num(material.materialUsageGrams) !== null ? `${fmtNum(material.materialUsageGrams)} g` : '—'} />
        <DetailRow label="Material Volume" value={num(material.materialVolumeCm3) !== null ? `${fmtNum(material.materialVolumeCm3)} cm³` : '—'} />
        <DetailRow label="Waste Volume" value={num(material.wasteVolumeCm3) !== null ? `${fmtNum(material.wasteVolumeCm3)} cm³` : '—'} />
        <DetailRow label="Density" value={num(material.densityGramsPerCm3) !== null ? `${fmtNum(material.densityGramsPerCm3)} g/cm³` : '—'} />
        <DetailRow label="Price per Gram" value={num(material.pricePerGramEgp) !== null ? `${fmtNum(material.pricePerGramEgp)} EGP` : '—'} />
        <DetailRow label="Deposited Volume" value={num(material.depositedMaterialVolumeCm3) !== null ? `${fmtNum(material.depositedMaterialVolumeCm3)} cm³` : '—'} />
        <DetailRow label="Support Volume" value={num(material.supportVolumeCm3) !== null ? `${fmtNum(material.supportVolumeCm3)} cm³` : '—'} />
      </div>
    </div>
  );
};

export const FilesSection: React.FC<{
  files: QuoteFileVM[];
  cadById: Map<string, CadFile>;
  expanded: Set<string>;
  onToggle: (fileId: string) => void;
  onExpandAll: () => void;
  onCollapseAll: () => void;
  onPreview: (fileId: string) => void;
  onDownload: (file: QuoteFileVM) => void;
  onEditPrice: () => void;
  canMutate: boolean;
}> = ({ files, cadById, expanded, onToggle, onExpandAll, onCollapseAll, onPreview, onDownload, onEditPrice, canMutate }) => {
  const allExpanded = files.length > 0 && files.every((f) => expanded.has(f.fileId));

  return (
    <section className="admin-card qd-card" aria-label={`Files and pricing breakdown (${files.length})`}>
      <div className="admin-card-header">
        <div className="qd-section-title">
          <span className="qd-title-icon" aria-hidden="true"><Icon name="cube" size={15} /></span>
          <h2 className="admin-card-title">Files &amp; Pricing Breakdown</h2>
        </div>
        <div className="admin-card-header-actions">
          <button type="button" className="btn btn-outline btn-sm" onClick={allExpanded ? onCollapseAll : onExpandAll} disabled={files.length === 0}>
            <Icon name="expand" size={13} />
            {allExpanded ? 'Collapse All' : 'Expand All'}
          </button>
        </div>
      </div>
      <div className="admin-card-body">
        {files.length === 0 && (
          <div className="qd-empty">
            <Icon name="cube" size={18} />
            <span>No priced files in this quote.</span>
          </div>
        )}
        <div className="qd-file-list">
          {files.map((file, index) => {
            const isOpen = expanded.has(file.fileId);
            const cad = cadById.get(file.fileId);
            const geometry = rec(file.pricingBreakdown.geometry);
            const machine = rec(file.pricingBreakdown.machine);
            return (
              <article key={file.fileId} className="qd-file-card" aria-label={`File ${index + 1}: ${file.fileName}`}>
                <div className="qd-file-top">
                  <span className="qd-file-index" aria-hidden="true">#{index + 1}</span>
                  <button
                    type="button"
                    className="qd-thumb"
                    onClick={() => onPreview(file.fileId)}
                    title={cad ? `Open 3D preview of ${file.fileName}` : file.fileName}
                    aria-label={cad ? `Open 3D preview of ${file.fileName}` : file.fileName}
                    disabled={!cad}
                  >
                    {cad ? (
                      <CadThumbnail file={cad} label={file.fileName} />
                    ) : (
                      <span className="qd-thumb-fallback" role="img" aria-label={`No preview for ${file.fileName}`}>
                        <Icon name="cube" size={28} />
                      </span>
                    )}
                  </button>
                  <div className="qd-file-main">
                    <div className="qd-file-title-row">
                      <h3 className="qd-file-name" title={file.fileName}>{file.fileName}</h3>
                      <span className="qd-file-tags">
                        <span className="qd-tag">{humanizeSpecValue(file.material).toUpperCase()}</span>
                        <span className="qd-tag">{humanizeSpecValue(file.process).toUpperCase()}</span>
                      </span>
                    </div>
                    <div className="qd-file-stats">
                      <SummaryStat icon="cpu" label="Dimensions" value={formatDimsMm(geometry.dimensionsMm)} />
                      <SummaryStat icon="cube" label="Volume" value={num(geometry.volumeCm3) !== null ? `${fmtNum(geometry.volumeCm3)} cm³` : '—'} />
                      <SummaryStat icon="chart" label="Weight" value={weightOf(file.pricingBreakdown)} />
                      <SummaryStat icon="clock" label="Print Time" value={fmtHoursShort(machine.printTimeMinutes)} />
                    </div>
                    <div className="qd-file-row-actions">
                      <button type="button" className="qd-link" onClick={() => onPreview(file.fileId)} disabled={!cad}>
                        <Icon name="cube" size={12} />
                        3D Preview
                      </button>
                      <button type="button" className="qd-link" onClick={() => onDownload(file)}>
                        <Icon name="download" size={12} />
                        Download
                      </button>
                    </div>
                  </div>
                  <div className="qd-file-price">
                    <span className="qd-file-price-label">Final Price</span>
                    <strong className="qd-file-price-value">{fileFinalPrice(file)}</strong>
                  </div>
                  <button
                    type="button"
                    className={`qd-chevron${isOpen ? ' is-open' : ''}`}
                    onClick={() => onToggle(file.fileId)}
                    aria-expanded={isOpen}
                    aria-label={isOpen ? `Collapse ${file.fileName}` : `Expand ${file.fileName}`}
                  >
                    <Icon name="chevronDown" size={15} />
                  </button>
                </div>
                {isOpen && <FileDetails file={file} onEditPrice={onEditPrice} canMutate={canMutate} />}
              </article>
            );
          })}
        </div>
      </div>
    </section>
  );
};
