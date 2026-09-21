import { escapeHtml, extractCurrency, formatPlacedOn, humanizeKey, humanizeSpecValue } from './format';

/**
 * Functional order PDF: renders the CURRENT order record (never static
 * fixture data) into a printable document and hands it to the browser print
 * pipeline (Save as PDF). No PDF library is vendored in the project, so this
 * reuses the platform print path instead of introducing a new dependency.
 * Returns false when the popup was blocked so the caller can surface an error.
 */
export const generateOrderPdf = (order: Record<string, unknown>): boolean => {
  const get = (key: string): string => {
    const value = order[key];
    return value === null || value === undefined ? '—' : String(value);
  };
  const user = (order.user || {}) as Record<string, unknown>;
  // ONE business reference on business documents (internal id is routing-only).
  const reference = typeof order.reference === 'string' && order.reference ? order.reference : get('id');
  const cadFiles = (Array.isArray(order.cadFiles) ? order.cadFiles : []) as Array<Record<string, unknown>>;
  const events = (Array.isArray(order.events) ? order.events : []) as Array<Record<string, unknown>>;
  const currency = extractCurrency(get('totalCost'));

  const cadRows = cadFiles
    .map((entry) => {
      const file = (entry.cadFile || {}) as Record<string, unknown>;
      const config =
        entry.configuration && typeof entry.configuration === 'object'
          ? Object.entries(entry.configuration as Record<string, unknown>)
              .map(([k, v]) => `<tr><td>${escapeHtml(humanizeKey(k))}</td><td>${escapeHtml(humanizeSpecValue(v))}</td></tr>`)
              .join('')
          : '';
      return `<section class="cad">
        <h3>${escapeHtml(String(file.name || 'CAD file'))}</h3>
        <p class="muted">${escapeHtml(String(file.format || ''))} · ${escapeHtml(String(file.size || ''))} · ${escapeHtml(String(file.dimensions || ''))} · ${escapeHtml(String(file.volume || ''))}</p>
        ${config ? `<table><tbody>${config}</tbody></table>` : ''}
      </section>`;
    })
    .join('');

  const eventRows = events
    .map((event) => {
      const when = event.createdAt ? formatPlacedOn(String(event.createdAt)) : '—';
      return `<tr><td>${escapeHtml(String(event.eventType || ''))}</td><td>${escapeHtml(String(event.description || ''))}</td><td>${escapeHtml(when)}</td></tr>`;
    })
    .join('');

  const html = `<!doctype html><html><head><meta charset="utf-8"><title>Order ${escapeHtml(reference)}</title>
<style>
body{font-family:Arial,Helvetica,sans-serif;color:#111;margin:32px}h1{font-size:22px;margin:0 0 4px}.muted{color:#555;font-size:12px}
table{width:100%;border-collapse:collapse;margin:12px 0;font-size:13px}td,th{border:1px solid #ccc;padding:6px 8px;text-align:left;vertical-align:top}
h2{font-size:15px;margin:22px 0 6px;border-bottom:1px solid #ddd;padding-bottom:4px}.cad{margin:10px 0;padding:10px;border:1px solid #ddd;border-radius:6px}
.total{font-size:16px;font-weight:bold;margin-top:8px}
@media print{.no-print{display:none}}
</style></head><body>
<h1>Order ${escapeHtml(reference)}</h1>
<p class="muted">Placed on ${escapeHtml(formatPlacedOn(String(order.createdAt || '')))} · Status: ${escapeHtml(get('status'))}</p>
<h2>Summary</h2>
<table><tbody>
<tr><th>Reference</th><td>${escapeHtml(reference)}</td></tr>
<tr><th>Customer</th><td>${escapeHtml(String(user.name || '—'))} · ${escapeHtml(String(user.email || '—'))}</td></tr>
<tr><th>Total Price</th><td>${escapeHtml(get('totalCost'))}</td></tr>
<tr><th>Currency</th><td>${escapeHtml(currency)}</td></tr>
<tr><th>Manufacturer</th><td>${escapeHtml(String((order.manufacturer as Record<string, unknown> | null)?.companyName || 'Unassigned'))}</td></tr>
</tbody></table>
<h2>CAD Items (${cadFiles.length})</h2>
${cadRows || '<p class="muted">No CAD files linked to this order.</p>'}
<h2>Configuration</h2>
<table><tbody>
<tr><th>Technology</th><td>${escapeHtml(get('technology'))}</td></tr>
<tr><th>Material</th><td>${escapeHtml(get('material'))}</td></tr>
<tr><th>Quantity</th><td>${escapeHtml(get('quantity'))}</td></tr>
<tr><th>Tolerance</th><td>${escapeHtml(get('tolerance'))}</td></tr>
<tr><th>Shipping Method</th><td>${escapeHtml(get('shippingMethod'))}</td></tr>
<tr><th>Provider</th><td>${escapeHtml(get('provider'))}</td></tr>
</tbody></table>
<h2>Order History</h2>
${eventRows ? `<table><thead><tr><th>Event</th><th>Description</th><th>Date</th></tr></thead><tbody>${eventRows}</tbody></table>` : '<p class="muted">No timeline events.</p>'}
<p class="total">Total: ${escapeHtml(get('totalCost'))}</p>
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
      // Print dialog availability varies by browser; the document remains open.
    }
  }, 350);
  return true;
};
