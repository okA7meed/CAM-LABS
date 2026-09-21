import { escapeHtml } from '../order-detail/format';
import { formatQuoteDateTime } from './format';
import { QuoteFileVM } from './types';

/**
 * Functional quote PDF: renders the CURRENT quote record into a printable
 * document via the browser print pipeline (Save as PDF) — same approach as
 * order PDFs, no new dependency. Returns false when the popup was blocked.
 */
export const generateQuotePdf = (
  quote: Record<string, unknown>,
  files: QuoteFileVM[],
  customerName: string,
): boolean => {
  const get = (key: string): string => {
    const value = quote[key];
    return value === null || value === undefined ? '—' : String(value);
  };
  // ONE business reference on business documents (internal id is routing-only).
  const reference = typeof quote.reference === 'string' && quote.reference ? quote.reference : get('id');

  const fileRows = files
    .map((file, index) => {
      const pb = file.pricingBreakdown;
      const num = (v: unknown): string => (typeof v === 'number' && Number.isFinite(v) ? v.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 }) : '—');
      return `<section class="file"><h3>#${index + 1} ${escapeHtml(file.fileName)}</h3>
<p class="muted">${escapeHtml(file.material)} · ${escapeHtml(file.process)} · Qty ${escapeHtml(String(file.quantity))}</p>
<table><tbody>
<tr><th>Machine Cost</th><td>${escapeHtml(num(pb.machineCost))} EGP</td></tr>
<tr><th>Material Cost</th><td>${escapeHtml(num(pb.materialCost))} EGP</td></tr>
<tr><th>Labor Cost</th><td>${escapeHtml(num(pb.laborCost))} EGP</td></tr>
<tr><th>Setup Cost</th><td>${escapeHtml(num(pb.setupCost))} EGP</td></tr>
</tbody></table></section>`;
    })
    .join('');

  const html = `<!doctype html><html><head><meta charset="utf-8"><title>Quote ${escapeHtml(reference)}</title>
<style>
body{font-family:Arial,Helvetica,sans-serif;color:#111;margin:32px}h1{font-size:22px;margin:0 0 4px}.muted{color:#555;font-size:12px}
table{width:100%;border-collapse:collapse;margin:12px 0;font-size:13px}td,th{border:1px solid #ccc;padding:6px 8px;text-align:left;vertical-align:top}
h2{font-size:15px;margin:22px 0 6px;border-bottom:1px solid #ddd;padding-bottom:4px}.file{margin:10px 0;padding:10px;border:1px solid #ddd;border-radius:6px}
.total{font-size:16px;font-weight:bold;margin-top:8px}
@media print{.no-print{display:none}}
</style></head><body>
<h1>Quote ${escapeHtml(reference)}</h1>
<p class="muted">Customer: ${escapeHtml(customerName)} · Status: ${escapeHtml(get('status'))} · Created ${escapeHtml(formatQuoteDateTime(String(quote.createdAt || '')))}</p>
<h2>Summary</h2>
<table><tbody>
<tr><th>Reference</th><td>${escapeHtml(reference)}</td></tr>
<tr><th>Total Price</th><td>${escapeHtml(get('totalPrice'))}</td></tr>
<tr><th>Technology</th><td>${escapeHtml(get('technology'))}</td></tr>
<tr><th>Material</th><td>${escapeHtml(get('material'))}</td></tr>
<tr><th>Valid Until</th><td>${escapeHtml(formatQuoteDateTime(String(quote.validUntil || '')))}</td></tr>
<tr><th>Converted Order</th><td>${escapeHtml(get('convertedOrderId'))}</td></tr>
</tbody></table>
<h2>Files &amp; Pricing (${files.length})</h2>
${fileRows || '<p class="muted">No priced files.</p>'}
<p class="total">Total: ${escapeHtml(get('totalPrice'))}</p>
<p class="muted no-print">Use your browser print dialog and choose “Save as PDF”.</p>
</body></html>`;

  const popup = window.open('', '_blank', 'width=900,height=700');
  if (!popup) return false;
  popup.document.open();
  popup.document.write(html);
  popup.document.close();
  popup.focus();
  window.setTimeout(() => {
    try {
      popup.print();
    } catch {
      // Print availability varies; the document remains open.
    }
  }, 350);
  return true;
};
