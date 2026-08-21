/**
 * CAM LABS — Customer Dashboard, Order Management & Profile Controller
 */

class DashboardController {
  constructor() {
    this.initEvents();
  }

  initEvents() {
    // Profile settings tab switcher
    const navItems = document.querySelectorAll('.profile-nav-item');
    navItems.forEach(item => {
      item.addEventListener('click', () => {
        navItems.forEach(n => n.classList.remove('active'));
        item.classList.add('active');
        const target = item.getAttribute('data-target');
        document.querySelectorAll('.profile-tab-content').forEach(pane => {
          pane.style.display = pane.id === target ? 'block' : 'none';
        });
      });
    });

    // Profile form saving
    const saveProfileBtn = document.getElementById('save-profile-btn');
    if (saveProfileBtn) {
      saveProfileBtn.addEventListener('click', (e) => {
        e.preventDefault();
        const name = document.getElementById('profile-name').value;
        const email = document.getElementById('profile-email').value;
        const phone = document.getElementById('profile-phone').value;
        const company = document.getElementById('profile-company').value;
        const address = document.getElementById('profile-address').value;
        const taxId = document.getElementById('profile-taxid').value;

        store.updateProfile({
          name, email, phone, company, address, taxId
        });

        if (window.showToast) {
          window.showToast("Profile Updated", "Your contact & billing preferences were saved.", "success");
        }
      });
    }

    // Manufacturing Preferences saving
    const savePrefsBtn = document.getElementById('save-prefs-btn');
    if (savePrefsBtn) {
      savePrefsBtn.addEventListener('click', (e) => {
        e.preventDefault();
        const units = document.querySelector('input[name="pref-units"]:checked')?.value || 'mm';
        const tol = document.getElementById('pref-tolerance-std')?.value || 'ISO 2768-fine (±0.05 mm)';
        const dfm = document.getElementById('pref-dfm-toggle')?.checked ?? true;
        const dispatch = document.getElementById('pref-dispatch-toggle')?.checked ?? true;

        store.updateProfile({
          preferences: {
            units,
            toleranceStandard: tol,
            dfmNotifications: dfm,
            dispatchAlerts: dispatch
          }
        });

        if (window.showToast) {
          window.showToast("Preferences Applied", `Default engineering units set to ${units.toUpperCase()}.`, "success");
        }
      });
    }

    // Orders search input
    const orderSearch = document.getElementById('order-search-input');
    if (orderSearch) {
      orderSearch.addEventListener('input', (e) => {
        this.renderOrdersTable(e.target.value);
      });
    }
  }

  renderAll() {
    this.renderMetrics();
    this.renderOrdersTable();
    this.renderQuotesTable();
    this.renderCadFilesGrid();
    this.renderProfileForm();
  }

  renderMetrics() {
    const activeOrders = store.state.orders.filter(o => o.status !== 'Delivered').length;
    const pendingQuotes = store.state.quotes.length;
    const totalParts = store.state.orders.reduce((acc, o) => acc + (o.quantity || 1), 0) + 1420;

    const elActive = document.getElementById('metric-active-orders');
    const elQuotes = document.getElementById('metric-pending-quotes');
    const elParts = document.getElementById('metric-total-parts');
    const elCompliance = document.getElementById('metric-qa-compliance');

    if (elActive) elActive.textContent = activeOrders;
    if (elQuotes) elQuotes.textContent = pendingQuotes;
    if (elParts) elParts.textContent = totalParts.toLocaleString();
    if (elCompliance) elCompliance.textContent = "99.94%";
  }

  renderOrdersTable(filterQuery = '') {
    const tableBody = document.getElementById('dashboard-orders-tbody');
    if (!tableBody) return;

    let orders = store.state.orders;
    if (filterQuery.trim() !== '') {
      const q = filterQuery.toLowerCase();
      orders = orders.filter(o => 
        o.id.toLowerCase().includes(q) || 
        o.partName.toLowerCase().includes(q) || 
        o.technology.toLowerCase().includes(q) ||
        o.material.toLowerCase().includes(q)
      );
    }

    if (orders.length === 0) {
      tableBody.innerHTML = `
        <tr>
          <td colspan="7" style="text-align: center; padding: var(--space-8); color: var(--cam-text-muted);">
            No manufacturing orders match your filter criteria.
          </td>
        </tr>
      `;
      return;
    }

    tableBody.innerHTML = orders.map(order => {
      let progressWidth = '25%';
      if (order.progressStep === 2) progressWidth = '50%';
      if (order.progressStep === 3) progressWidth = '75%';
      if (order.progressStep === 4) progressWidth = '100%';

      return `
        <tr>
          <td>
            <strong style="color: var(--cam-text-primary); font-family: var(--font-mono); font-size: 0.8125rem;">${order.id}</strong>
          </td>
          <td>
            <div style="display: flex; align-items: center; gap: 8px;">
              <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="#0066FF" stroke-width="2"><path d="M21 16V8a2 2 0 0 0-1-1.73l-7-4a2 2 0 0 0-2 0l-7 4A2 2 0 0 0 3 8v8a2 2 0 0 0 1 1.73l7 4a2 2 0 0 0 2 0l7-4A2 2 0 0 0 21 16z"/></svg>
              <span>${order.partName}</span>
            </div>
          </td>
          <td>
            <span class="mono-tag" style="color: var(--cam-text-secondary);">${order.technology}</span>
            <div style="font-size: 0.75rem; color: var(--cam-text-muted);">${order.material}</div>
          </td>
          <td style="font-family: var(--font-mono);">${order.quantity} pcs</td>
          <td style="font-family: var(--font-mono); color: var(--cam-text-primary); font-weight: 600;">${order.totalCost}</td>
          <td>
            <span class="badge ${order.statusBadge || 'badge-blue'}">
              <span class="pulse-dot"></span> ${order.status}
            </span>
          </td>
          <td>
            <button class="btn btn-sm btn-outline" onclick="window.dashboardCtrl.openOrderTimeline('${order.id}')">
              Track & QA
            </button>
          </td>
        </tr>
      `;
    }).join('');
  }

  renderQuotesTable() {
    const tableBody = document.getElementById('dashboard-quotes-tbody');
    if (!tableBody) return;

    const quotes = store.state.quotes;
    if (quotes.length === 0) {
      tableBody.innerHTML = `
        <tr>
          <td colspan="7" style="text-align: center; padding: var(--space-8); color: var(--cam-text-muted);">
            No pending quotations. Create an RFQ using "New Manufacturing Request".
          </td>
        </tr>
      `;
      return;
    }

    tableBody.innerHTML = quotes.map(quote => `
      <tr>
        <td><strong style="color: var(--cam-text-primary); font-family: var(--font-mono);">${quote.id}</strong></td>
        <td>
          <div style="display: flex; align-items: center; gap: 8px;">
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="#0066FF" stroke-width="2"><path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"/><polyline points="14 2 14 8 20 8"/></svg>
            <span>${quote.partName}</span>
          </div>
        </td>
        <td><span class="mono-tag">${quote.technology}</span></td>
        <td style="font-family: var(--font-mono);">${quote.quantity} pcs</td>
        <td style="font-family: var(--font-mono);">${quote.unitPrice}</td>
        <td style="font-family: var(--font-mono); color: var(--cam-text-primary); font-weight: 700;">${quote.totalPrice}</td>
        <td>
          <div style="display: flex; gap: 6px;">
            <button class="btn btn-sm btn-primary" onclick="window.dashboardCtrl.approveQuote('${quote.id}')">Approve & Produce</button>
            <button class="btn btn-sm btn-outline" onclick="window.dashboardCtrl.downloadSpecSheet('${quote.id}')">Spec PDF</button>
          </div>
        </td>
      </tr>
    `).join('');
  }

  renderCadFilesGrid() {
    const grid = document.getElementById('dashboard-cad-grid');
    if (!grid) return;

    const files = store.state.cadFiles;
    grid.innerHTML = files.map(file => `
      <div class="cad-file-card">
        <div class="file-preview-thumb">
          <svg width="44" height="44" viewBox="0 0 24 24" fill="none" stroke="#0066FF" stroke-width="1.5"><polygon points="12 2 2 7 12 12 22 7 12 2"/><polyline points="2 17 12 22 22 17"/><polyline points="2 12 12 17 22 12"/></svg>
          <span class="file-format-tag">${file.format}</span>
        </div>
        <div>
          <strong style="color: var(--cam-text-primary); font-size: 0.9375rem; display: block; overflow: hidden; text-overflow: ellipsis; white-space: nowrap;">
            ${file.name}
          </strong>
          <span style="font-size: 0.75rem; color: var(--cam-text-muted); font-family: var(--font-mono);">${file.size} · ${file.uploaded}</span>
        </div>
        <div class="file-details-list">
          <div class="file-detail-entry">
            <span style="color: var(--cam-text-muted);">Bounding Box:</span>
            <span style="color: var(--cam-text-primary);">${file.dimensions}</span>
          </div>
          <div class="file-detail-entry">
            <span style="color: var(--cam-text-muted);">Volume:</span>
            <span style="color: var(--cam-text-primary);">${file.volume}</span>
          </div>
        </div>
        <div style="display: flex; gap: 8px; margin-top: auto; padding-top: 8px; border-top: 1px solid var(--cam-border-subtle);">
          <button class="btn btn-sm btn-primary" style="flex: 1;" onclick="window.configurator.open()">Configure Order</button>
          <button class="btn btn-sm btn-outline" onclick="window.dashboardCtrl.preview3dPart('${file.name}')">3D View</button>
        </div>
      </div>
    `).join('');
  }

  renderProfileForm() {
    const u = store.state.currentUser;
    if (!u) return;

    // Header greeting
    const welcomeName = document.getElementById('user-display-name');
    const userRoleCompany = document.getElementById('user-role-company');
    const userAvatar = document.getElementById('user-avatar-img');
    const userTierBadge = document.getElementById('user-tier-badge');

    if (welcomeName) welcomeName.textContent = u.name;
    if (userRoleCompany) userRoleCompany.textContent = `${u.role} · ${u.company}`;
    if (userAvatar) userAvatar.src = u.avatar;
    if (userTierBadge) userTierBadge.textContent = u.tier || 'Enterprise Pro';

    // Personal & Company Inputs
    const fName = document.getElementById('profile-name');
    const fEmail = document.getElementById('profile-email');
    const fPhone = document.getElementById('profile-phone');
    const fCompany = document.getElementById('profile-company');
    const fAddress = document.getElementById('profile-address');
    const fTaxId = document.getElementById('profile-taxid');

    if (fName) fName.value = u.name || '';
    if (fEmail) fEmail.value = u.email || '';
    if (fPhone) fPhone.value = u.phone || '';
    if (fCompany) fCompany.value = u.company || '';
    if (fAddress) fAddress.value = u.address || '';
    if (fTaxId) fTaxId.value = u.taxId || '';

    // Preferences
    if (u.preferences) {
      const unitRadio = document.querySelector(`input[name="pref-units"][value="${u.preferences.units}"]`);
      if (unitRadio) unitRadio.checked = true;

      const tolSelect = document.getElementById('pref-tolerance-std');
      if (tolSelect) tolSelect.value = u.preferences.toleranceStandard;

      const dfmToggle = document.getElementById('pref-dfm-toggle');
      if (dfmToggle) dfmToggle.checked = u.preferences.dfmNotifications;

      const dispatchToggle = document.getElementById('pref-dispatch-toggle');
      if (dispatchToggle) dispatchToggle.checked = u.preferences.dispatchAlerts;
    }
  }

  openOrderTimeline(orderId) {
    const order = store.state.orders.find(o => o.id === orderId);
    if (!order) return;

    const modal = document.getElementById('order-timeline-modal');
    const titleEl = document.getElementById('timeline-order-title');
    const contentEl = document.getElementById('timeline-order-body');

    if (titleEl) titleEl.textContent = `Order ${order.id} — Production Telemetry & QA`;
    if (contentEl) {
      contentEl.innerHTML = `
        <div style="background: var(--cam-surface-2); padding: var(--space-4); border-radius: var(--radius-sm); margin-bottom: var(--space-6); display: grid; grid-template-columns: repeat(3, 1fr); gap: var(--space-4); font-family: var(--font-mono); font-size: 0.8125rem;">
          <div><span style="color: var(--cam-text-muted);">Component:</span><br><strong style="color: var(--cam-text-primary);">${order.partName}</strong></div>
          <div><span style="color: var(--cam-text-muted);">Process:</span><br><strong style="color: var(--cam-text-primary);">${order.technology}</strong></div>
          <div><span style="color: var(--cam-text-muted);">Est. Delivery:</span><br><strong style="color: var(--cam-text-primary);">${order.estDelivery}</strong></div>
          <div><span style="color: var(--cam-text-muted);">Material:</span><br><strong style="color: var(--cam-text-primary);">${order.material}</strong></div>
          <div><span style="color: var(--cam-text-muted);">Batch Qty:</span><br><strong style="color: var(--cam-text-primary);">${order.quantity} units</strong></div>
          <div><span style="color: var(--cam-text-muted);">Tracking:</span><br><strong style="color: var(--cam-blue-primary);">${order.trackingNum || 'ASSIGNING'}</strong></div>
        </div>

        <h4 style="margin-bottom: var(--space-3);">Manufacturing Milestones</h4>
        <div class="timeline-track">
          ${order.history.map((h, i) => `
            <div class="timeline-node ${h.done ? 'completed' : (i === order.progressStep ? 'active' : '')}">
              <div class="timeline-dot"></div>
              <div class="timeline-node-title">${h.step}</div>
              <div class="timeline-node-time">${h.date} — ${h.desc}</div>
            </div>
          `).join('')}
        </div>

        <div style="margin-top: var(--space-6); padding-top: var(--space-4); border-top: 1px solid var(--cam-border-subtle); display: flex; justify-content: space-between; align-items: center;">
          <div style="font-family: var(--font-mono); font-size: 0.75rem; color: var(--cam-text-muted);">
            DIN ISO 2768-m Certified QA Node
          </div>
          <button class="btn btn-sm btn-outline-blue" onclick="window.dashboardCtrl.downloadCmmReport('${order.id}')">
            Download CMM Inspection Sheet (PDF)
          </button>
        </div>
      `;
    }

    if (modal) modal.classList.add('active');
  }

  closeOrderTimeline() {
    const modal = document.getElementById('order-timeline-modal');
    if (modal) modal.classList.remove('active');
  }

  approveQuote(quoteId) {
    store.convertQuoteToOrder(quoteId);
    this.renderAll();
    if (window.showToast) {
      window.showToast("Quote Converted to Order", `Quote ${quoteId} approved and transferred to automated manufacturing queue.`, "success");
    }
  }

  downloadSpecSheet(quoteId) {
    if (window.showToast) {
      window.showToast("Generating Specification Sheet", `PDF Engineering Spec sheet for ${quoteId} generated successfully.`, "info");
    }
  }

  downloadCmmReport(orderId) {
    if (window.showToast) {
      window.showToast("CMM Inspection Downloaded", `ISO 9001:2015 Dimensional Scan Certificate for ${orderId} downloaded.`, "success");
    }
  }

  preview3dPart(partName) {
    if (window.cadViewer) {
      if (partName.includes('Bracket')) window.cadViewer.loadPart('bracket');
      else if (partName.includes('Hinge') || partName.includes('Exoskeleton')) window.cadViewer.loadPart('hinge');
      else window.cadViewer.loadPart('manifold');
    }
    if (window.navigateTo) {
      window.navigateTo('home');
      const cadStage = document.getElementById('hero-cad-stage');
      if (cadStage) cadStage.scrollIntoView({ behavior: 'smooth' });
    }
  }
}

window.DashboardController = DashboardController;
