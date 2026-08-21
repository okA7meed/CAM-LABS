/**
 * CAM LABS — Instant Manufacturing Request Configurator & CAD Analyzer
 */

class ManufacturingConfigurator {
  constructor() {
    this.modal = document.getElementById('configurator-modal');
    this.uploadedFile = null;
    this.parsedGeometry = null;
    this.selectedTech = 'SLS';
    this.selectedMaterialId = 'pa12-sls';
    this.selectedFinish = 'bead-blast';
    this.selectedTolerance = 'standard';
    this.quantity = 5;

    this.initElements();
    this.initEvents();
  }

  initElements() {
    this.dropzone = document.getElementById('cad-dropzone');
    this.fileInput = document.getElementById('cad-file-input');
    this.analysisSection = document.getElementById('cad-analysis-results');
    this.techSelect = document.getElementById('config-tech-select');
    this.materialSelect = document.getElementById('config-material-select');
    this.finishSelect = document.getElementById('config-finish-select');
    this.toleranceSelect = document.getElementById('config-tolerance-select');
    this.qtyInput = document.getElementById('config-quantity-input');
    
    this.estPriceEl = document.getElementById('config-est-price');
    this.unitPriceEl = document.getElementById('config-unit-price');
    this.leadTimeEl = document.getElementById('config-lead-time');
  }

  initEvents() {
    if (!this.dropzone) return;

    // Drag & Drop triggers
    ['dragenter', 'dragover'].forEach(eventName => {
      this.dropzone.addEventListener(eventName, (e) => {
        e.preventDefault();
        e.stopPropagation();
        this.dropzone.classList.add('dragover');
      });
    });

    ['dragleave', 'drop'].forEach(eventName => {
      this.dropzone.addEventListener(eventName, (e) => {
        e.preventDefault();
        e.stopPropagation();
        this.dropzone.classList.remove('dragover');
      });
    });

    this.dropzone.addEventListener('drop', (e) => {
      const files = e.dataTransfer.files;
      if (files.length > 0) {
        this.handleFileUpload(files[0]);
      }
    });

    this.dropzone.addEventListener('click', () => {
      if (this.fileInput) this.fileInput.click();
    });

    if (this.fileInput) {
      this.fileInput.addEventListener('change', (e) => {
        if (e.target.files.length > 0) {
          this.handleFileUpload(e.target.files[0]);
        }
      });
    }

    // Technology Change
    if (this.techSelect) {
      this.techSelect.addEventListener('change', (e) => {
        this.selectedTech = e.target.value;
        this.updateMaterialOptions();
        this.recalculateQuote();
      });
    }

    // Material Change
    if (this.materialSelect) {
      this.materialSelect.addEventListener('change', (e) => {
        this.selectedMaterialId = e.target.value;
        this.recalculateQuote();
      });
    }

    // Finish & Tolerance Change
    if (this.finishSelect) {
      this.finishSelect.addEventListener('change', (e) => {
        this.selectedFinish = e.target.value;
        this.recalculateQuote();
      });
    }

    if (this.toleranceSelect) {
      this.toleranceSelect.addEventListener('change', (e) => {
        this.selectedTolerance = e.target.value;
        this.recalculateQuote();
      });
    }

    // Quantity Change
    if (this.qtyInput) {
      this.qtyInput.addEventListener('input', (e) => {
        this.quantity = Math.max(1, parseInt(e.target.value) || 1);
        this.recalculateQuote();
      });
    }

    // Form submission buttons
    const submitBtn = document.getElementById('config-submit-order-btn');
    if (submitBtn) {
      submitBtn.addEventListener('click', () => this.submitManufacturingOrder());
    }

    const saveQuoteBtn = document.getElementById('config-save-quote-btn');
    if (saveQuoteBtn) {
      saveQuoteBtn.addEventListener('click', () => this.saveAsQuoteDraft());
    }
  }

  open(preselectedMaterialId = null) {
    if (this.modal) {
      this.modal.classList.add('active');
      document.body.style.overflow = 'hidden';

      if (preselectedMaterialId) {
        const mat = MATERIALS_DATA.find(m => m.id === preselectedMaterialId);
        if (mat) {
          this.selectedTech = mat.technology;
          if (this.techSelect) this.techSelect.value = mat.technology;
          this.updateMaterialOptions();
          this.selectedMaterialId = mat.id;
          if (this.materialSelect) this.materialSelect.value = mat.id;
        }
      } else {
        this.updateMaterialOptions();
      }

      // If no file loaded yet, load a default simulation
      if (!this.uploadedFile) {
        this.simulateSampleFile("Turbine_Manifold_v3.step", 14.2);
      }
      this.recalculateQuote();
    }
  }

  close() {
    if (this.modal) {
      this.modal.classList.remove('active');
      document.body.style.overflow = '';
    }
  }

  handleFileUpload(file) {
    this.uploadedFile = file;
    const sizeMb = (file.size / (1024 * 1024)).toFixed(1);
    this.simulateSampleFile(file.name, sizeMb);

    // Also register into CAD file vault
    store.addCadFile({
      name: file.name,
      format: file.name.split('.').pop().toUpperCase(),
      size: `${sizeMb} MB`,
      volume: `${this.parsedGeometry.volume} cm³`,
      dimensions: this.parsedGeometry.dimensions,
      meshTriangles: "142,500"
    });

    if (window.showToast) {
      window.showToast("CAD File Uploaded", `${file.name} successfully analyzed for DFM compliance.`, "success");
    }
  }

  simulateSampleFile(fileName, sizeMb) {
    // Generate realistic geometric volume based on name
    const vol = Math.floor(45 + Math.random() * 95);
    const x = Math.floor(80 + Math.random() * 60);
    const y = Math.floor(50 + Math.random() * 40);
    const z = Math.floor(25 + Math.random() * 30);

    this.parsedGeometry = {
      name: fileName,
      sizeMb: sizeMb,
      volume: vol,
      surfaceArea: Math.floor(vol * 2.8),
      dimensions: `${x} × ${y} × ${z} mm`,
      minWallThickness: "0.85 mm",
      dfmStatus: "DFM Pass (Ready for Production)"
    };

    this.renderAnalysisResults();
    this.recalculateQuote();
  }

  renderAnalysisResults() {
    if (!this.analysisSection || !this.parsedGeometry) return;
    this.analysisSection.innerHTML = `
      <div style="background: var(--cam-surface-2); border: 1px solid var(--cam-border-blue); border-radius: var(--radius-sm); padding: var(--space-4); margin-top: var(--space-4);">
        <div style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 8px;">
          <div style="display: flex; align-items: center; gap: 8px;">
            <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="#0066FF" stroke-width="2"><path d="M21 16V8a2 2 0 0 0-1-1.73l-7-4a2 2 0 0 0-2 0l-7 4A2 2 0 0 0 3 8v8a2 2 0 0 0 1 1.73l7 4a2 2 0 0 0 2 0l7-4A2 2 0 0 0 21 16z"/></svg>
            <strong style="color: var(--cam-text-primary); font-size: 0.9375rem;">${this.parsedGeometry.name}</strong>
          </div>
          <span class="badge badge-success">DFM Passed</span>
        </div>
        <div style="display: grid; grid-template-columns: repeat(4, 1fr); gap: 8px; font-family: var(--font-mono); font-size: 0.75rem;">
          <div><span style="color: var(--cam-text-muted);">Bounding Box:</span><br><strong style="color: var(--cam-text-primary);">${this.parsedGeometry.dimensions}</strong></div>
          <div><span style="color: var(--cam-text-muted);">Volume:</span><br><strong style="color: var(--cam-text-primary);">${this.parsedGeometry.volume} cm³</strong></div>
          <div><span style="color: var(--cam-text-muted);">Surface Area:</span><br><strong style="color: var(--cam-text-primary);">${this.parsedGeometry.surfaceArea} cm²</strong></div>
          <div><span style="color: var(--cam-text-muted);">Min Wall:</span><br><strong style="color: var(--cam-text-primary);">${this.parsedGeometry.minWallThickness}</strong></div>
        </div>
      </div>
    `;
  }

  updateMaterialOptions() {
    if (!this.materialSelect) return;
    const filtered = MATERIALS_DATA.filter(m => m.technology.toLowerCase() === this.selectedTech.toLowerCase() || this.selectedTech === 'ALL');
    const matsToUse = filtered.length > 0 ? filtered : MATERIALS_DATA;

    this.materialSelect.innerHTML = matsToUse.map(m => `
      <option value="${m.id}" ${m.id === this.selectedMaterialId ? 'selected' : ''}>
        ${m.name} (${m.technology}) — Tensile: ${m.tensileStrength} MPa
      </option>
    `).join('');

    if (matsToUse.length > 0 && !matsToUse.find(m => m.id === this.selectedMaterialId)) {
      this.selectedMaterialId = matsToUse[0].id;
    }
  }

  recalculateQuote() {
    const mat = MATERIALS_DATA.find(m => m.id === this.selectedMaterialId) || MATERIALS_DATA[0];
    const vol = this.parsedGeometry ? this.parsedGeometry.volume : 50;

    // Base cost formula: Material density * volume cost + Machine fixed setup + Machining time
    let baseUnitCost = 15;
    if (mat.technology === 'CNC') {
      baseUnitCost = 45 + (vol * 0.45);
    } else if (mat.technology === 'DMLS') {
      baseUnitCost = 85 + (vol * 1.2);
    } else if (mat.technology === 'FDM' && mat.category === 'High-Performance') {
      baseUnitCost = 40 + (vol * 0.5);
    } else {
      // SLS / SLA / Standard
      baseUnitCost = 18 + (vol * 0.22);
    }

    // Surface finish adder
    if (this.selectedFinish === 'anodized' || this.selectedFinish === 'vapor-smooth') {
      baseUnitCost += 12;
    } else if (this.selectedFinish === 'electropolished') {
      baseUnitCost += 24;
    }

    // Tolerance adder
    if (this.selectedTolerance === 'precision') {
      baseUnitCost *= 1.25;
    }

    // Volume discount curve
    let discount = 1.0;
    if (this.quantity >= 100) discount = 0.55;
    else if (this.quantity >= 50) discount = 0.65;
    else if (this.quantity >= 20) discount = 0.75;
    else if (this.quantity >= 5) discount = 0.88;

    const unitPrice = (baseUnitCost * discount).toFixed(2);
    const totalPrice = (unitPrice * this.quantity).toFixed(2);

    if (this.unitPriceEl) this.unitPriceEl.textContent = `$${unitPrice}`;
    if (this.estPriceEl) this.estPriceEl.textContent = `$${Number(totalPrice).toLocaleString('en-US', { minimumFractionDigits: 2 })}`;
    if (this.leadTimeEl) this.leadTimeEl.textContent = mat.leadTime;
  }

  submitManufacturingOrder() {
    const mat = MATERIALS_DATA.find(m => m.id === this.selectedMaterialId) || MATERIALS_DATA[0];
    const fileName = this.parsedGeometry ? this.parsedGeometry.name : "Custom_Component.step";
    const totalCostFormatted = this.estPriceEl ? this.estPriceEl.textContent : "$480.00";

    const order = store.addOrder({
      partName: fileName,
      technology: `${mat.technology} Manufacturing`,
      material: `${mat.name} (${this.selectedFinish})`,
      quantity: this.quantity,
      totalCost: totalCostFormatted,
      estDelivery: "2026-08-20",
      tolerance: this.selectedTolerance === 'precision' ? "±0.025 mm (ISO 2768-f)" : "±0.15 mm (ISO 2768-m)"
    });

    this.close();

    if (window.showToast) {
      window.showToast("Order Dispatched to Production", `Order #${order.id} has entered automated toolpath queue.`, "success");
    }

    // Navigate to dashboard
    if (window.navigateTo) {
      window.navigateTo('dashboard');
    }
  }

  saveAsQuoteDraft() {
    const mat = MATERIALS_DATA.find(m => m.id === this.selectedMaterialId) || MATERIALS_DATA[0];
    const fileName = this.parsedGeometry ? this.parsedGeometry.name : "Custom_Component.step";
    const unitPriceFormatted = this.unitPriceEl ? this.unitPriceEl.textContent : "$48.00";
    const totalPriceFormatted = this.estPriceEl ? this.estPriceEl.textContent : "$240.00";

    const quote = store.addQuote({
      partName: fileName,
      technology: `${mat.technology} Manufacturing`,
      material: mat.name,
      quantity: this.quantity,
      unitPrice: unitPriceFormatted,
      totalPrice: totalPriceFormatted,
      leadTime: mat.leadTime
    });

    this.close();

    if (window.showToast) {
      window.showToast("Quotation Saved", `Quote #${quote.id} saved to your dashboard drafts.`, "info");
    }

    if (window.navigateTo) {
      window.navigateTo('dashboard');
    }
  }
}

window.ManufacturingConfigurator = ManufacturingConfigurator;
