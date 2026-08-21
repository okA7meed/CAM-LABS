/**
 * CAM LABS — Main Application Controller & View Router
 */

document.addEventListener('DOMContentLoaded', () => {
  // Global instances
  window.cadViewer = new CadViewer('hero-cad-canvas');
  window.configurator = new ManufacturingConfigurator();
  window.authManager = new AuthManager();
  window.dashboardCtrl = new DashboardController();

  // Initialize UI & routing
  initNavigation();
  initMaterialsExplorer();
  initComparisonSystem();
  initNotificationSystem();
  initPersonaSwitcher();

  // Subscribe to store updates
  store.subscribe((state) => {
    updateUiFromStore();
  });

  // Handle URL hash routing
  window.addEventListener('hashchange', handleRoute);
  handleRoute();
  updateUiFromStore();
});

/* --------------------------------------------------------------------------
   1. Toast Notification Helper
   -------------------------------------------------------------------------- */
window.showToast = function(title, message, type = 'info') {
  const container = document.getElementById('global-toast-container');
  if (!container) return;

  const toast = document.createElement('div');
  toast.className = `toast ${type}`;
  toast.innerHTML = `
    <div class="toast-content">
      <div class="toast-title">${title}</div>
      <div class="toast-message">${message}</div>
    </div>
    <button class="toast-close" onclick="this.parentElement.remove()">✕</button>
  `;

  container.appendChild(toast);
  setTimeout(() => toast.classList.add('show'), 10);
  setTimeout(() => {
    toast.classList.remove('show');
    setTimeout(() => toast.remove(), 400);
  }, 4500);
};

/* --------------------------------------------------------------------------
   2. Navigation & Client-side Routing
   -------------------------------------------------------------------------- */
function initNavigation() {
  const header = document.querySelector('.cam-header');
  const mobileToggle = document.getElementById('mobile-nav-toggle');
  const mobileDrawer = document.getElementById('mobile-menu-drawer');

  // Sticky header background
  window.addEventListener('scroll', () => {
    if (window.scrollY > 20) {
      header.classList.add('scrolled');
    } else {
      header.classList.remove('scrolled');
    }
  });

  // Mobile menu toggle
  if (mobileToggle && mobileDrawer) {
    mobileToggle.addEventListener('click', () => {
      mobileDrawer.classList.toggle('open');
    });

    mobileDrawer.querySelectorAll('a, button').forEach(link => {
      link.addEventListener('click', () => {
        mobileDrawer.classList.remove('open');
      });
    });
  }

  // Header quick buttons
  const startReqBtns = document.querySelectorAll('.trigger-configurator-btn');
  startReqBtns.forEach(btn => {
    btn.addEventListener('click', (e) => {
      e.preventDefault();
      window.configurator.open();
    });
  });

  const loginBtns = document.querySelectorAll('.trigger-login-btn');
  loginBtns.forEach(btn => {
    btn.addEventListener('click', (e) => {
      e.preventDefault();
      window.authManager.openAuthModal('login');
    });
  });

  const regBtns = document.querySelectorAll('.trigger-register-btn');
  regBtns.forEach(btn => {
    btn.addEventListener('click', (e) => {
      e.preventDefault();
      window.authManager.openAuthModal('register');
    });
  });

  // 3D CAD HUD controls
  const hudSolid = document.getElementById('hud-mode-solid');
  const hudWire = document.getElementById('hud-mode-wireframe');
  const hudSlice = document.getElementById('hud-mode-slicing');
  const hudStress = document.getElementById('hud-mode-stress');

  [hudSolid, hudWire, hudSlice, hudStress].forEach(btn => {
    if (btn) {
      btn.addEventListener('click', () => {
        [hudSolid, hudWire, hudSlice, hudStress].forEach(b => b?.classList.remove('active'));
        btn.classList.add('active');
        const mode = btn.getAttribute('data-mode');
        window.cadViewer.setMode(mode);
      });
    }
  });

  // CAD Model selector buttons
  const btnPartManifold = document.getElementById('cad-part-manifold');
  const btnPartBracket = document.getElementById('cad-part-bracket');
  const btnPartHinge = document.getElementById('cad-part-hinge');

  [btnPartManifold, btnPartBracket, btnPartHinge].forEach(btn => {
    if (btn) {
      btn.addEventListener('click', () => {
        [btnPartManifold, btnPartBracket, btnPartHinge].forEach(b => b?.classList.remove('active'));
        btn.classList.add('active');
        const part = btn.getAttribute('data-part');
        window.cadViewer.loadPart(part);
      });
    }
  });
}

window.navigateTo = function(viewName) {
  window.location.hash = `#${viewName}`;
};

function handleRoute() {
  const hash = window.location.hash.replace('#', '') || 'home';
  const views = ['home', 'services', 'materials', 'workflow', 'dashboard', 'profile'];
  
  // Show / Hide main sections
  const landingSection = document.getElementById('view-landing');
  const dashboardSection = document.getElementById('view-dashboard');
  const profileSection = document.getElementById('view-profile');

  // Update active nav links
  document.querySelectorAll('.nav-link, .mobile-nav-link').forEach(link => {
    const href = link.getAttribute('href') || '';
    if (href === `#${hash}`) {
      link.classList.add('active');
    } else {
      link.classList.remove('active');
    }
  });

  if (hash === 'dashboard') {
    if (landingSection) landingSection.style.display = 'none';
    if (profileSection) profileSection.style.display = 'none';
    if (dashboardSection) dashboardSection.style.display = 'block';
    window.dashboardCtrl.renderAll();
    window.scrollTo({ top: 0, behavior: 'smooth' });
  } else if (hash === 'profile') {
    if (landingSection) landingSection.style.display = 'none';
    if (dashboardSection) dashboardSection.style.display = 'none';
    if (profileSection) profileSection.style.display = 'block';
    window.dashboardCtrl.renderProfileForm();
    window.scrollTo({ top: 0, behavior: 'smooth' });
  } else {
    // Landing View with sections
    if (dashboardSection) dashboardSection.style.display = 'none';
    if (profileSection) profileSection.style.display = 'none';
    if (landingSection) landingSection.style.display = 'block';

    if (hash === 'services') {
      const el = document.getElementById('services-section');
      if (el) el.scrollIntoView({ behavior: 'smooth' });
    } else if (hash === 'materials') {
      const el = document.getElementById('materials-section');
      if (el) el.scrollIntoView({ behavior: 'smooth' });
    } else if (hash === 'workflow') {
      const el = document.getElementById('workflow-section');
      if (el) el.scrollIntoView({ behavior: 'smooth' });
    } else if (hash === 'about') {
      const el = document.getElementById('about');
      if (el) el.scrollIntoView({ behavior: 'smooth' });
    } else {
      window.scrollTo({ top: 0, behavior: 'smooth' });
    }
  }
}

/* --------------------------------------------------------------------------
   3. Materials & Technology Explorer
   -------------------------------------------------------------------------- */
let activeTechFilter = 'ALL';
let activeCatFilter = 'ALL';
let activeSearchQuery = '';

function initMaterialsExplorer() {
  const techChips = document.querySelectorAll('.tech-filter-chip');
  const catChips = document.querySelectorAll('.cat-filter-chip');
  const searchInput = document.getElementById('material-search-input');

  techChips.forEach(chip => {
    chip.addEventListener('click', () => {
      techChips.forEach(c => c.classList.remove('active'));
      chip.classList.add('active');
      activeTechFilter = chip.getAttribute('data-tech');
      renderMaterialsGrid();
    });
  });

  catChips.forEach(chip => {
    chip.addEventListener('click', () => {
      catChips.forEach(c => c.classList.remove('active'));
      chip.classList.add('active');
      activeCatFilter = chip.getAttribute('data-cat');
      renderMaterialsGrid();
    });
  });

  if (searchInput) {
    searchInput.addEventListener('input', (e) => {
      activeSearchQuery = e.target.value.toLowerCase().trim();
      renderMaterialsGrid();
    });
  }

  renderMaterialsGrid();
}

function renderMaterialsGrid() {
  const grid = document.getElementById('materials-explorer-grid');
  if (!grid) return;

  const filtered = MATERIALS_DATA.filter(mat => {
    const matchTech = activeTechFilter === 'ALL' || mat.technology.toLowerCase() === activeTechFilter.toLowerCase();
    const matchCat = activeCatFilter === 'ALL' || mat.category.toLowerCase() === activeCatFilter.toLowerCase();
    const matchSearch = activeSearchQuery === '' || 
      mat.name.toLowerCase().includes(activeSearchQuery) ||
      mat.description.toLowerCase().includes(activeSearchQuery) ||
      mat.tags.some(t => t.toLowerCase().includes(activeSearchQuery));

    return matchTech && matchCat && matchSearch;
  });

  if (filtered.length === 0) {
    grid.innerHTML = `
      <div style="grid-column: 1 / -1; text-align: center; padding: var(--space-12); background: var(--cam-surface-1); border-radius: var(--radius-md); border: 1px solid var(--cam-border-subtle);">
        <p style="color: var(--cam-text-muted); font-size: 1rem;">No engineering materials found matching your filters.</p>
        <button class="btn btn-sm btn-outline" style="margin-top: var(--space-4);" onclick="resetMaterialFilters()">Reset Filters</button>
      </div>
    `;
    return;
  }

  const comparedList = store.state.comparisonList || [];

  grid.innerHTML = filtered.map(mat => {
    const isCompared = comparedList.includes(mat.id);
    const tensilePct = Math.min(100, (mat.tensileStrength / 600) * 100);
    const hdtPct = Math.min(100, (mat.hdt / 350) * 100);

    return `
      <div class="material-card">
        <div class="material-header">
          <div>
            <span class="material-tech-pill">${mat.technology} · ${mat.category}</span>
            <div class="material-name" style="margin-top: 6px;">${mat.name}</div>
          </div>
          <label class="custom-checkbox" style="font-size: 0.75rem;">
            <input type="checkbox" ${isCompared ? 'checked' : ''} onchange="window.toggleMaterialComparison('${mat.id}')">
            <span class="checkbox-mark"></span>
            <span style="font-family: var(--font-mono); color: var(--cam-text-muted);">Compare</span>
          </label>
        </div>

        <p style="font-size: 0.8125rem; color: var(--cam-text-muted); line-height: 1.5;">${mat.description}</p>

        <div class="material-props-list">
          <div>
            <div class="prop-row">
              <span class="prop-name">Tensile Strength:</span>
              <span class="prop-val">${mat.tensileStrength} MPa</span>
            </div>
            <div class="prop-bar-track"><div class="prop-bar-fill" style="width: ${tensilePct}%;"></div></div>
          </div>

          <div>
            <div class="prop-row">
              <span class="prop-name">Heat Deflection (HDT):</span>
              <span class="prop-val">${mat.hdt} °C</span>
            </div>
            <div class="prop-bar-track"><div class="prop-bar-fill" style="width: ${hdtPct}%; background-color: var(--cam-warning);"></div></div>
          </div>

          <div class="prop-row" style="margin-top: 4px;">
            <span class="prop-name">Std Tolerance:</span>
            <span class="prop-val">${mat.standardTolerance}</span>
          </div>

          <div class="prop-row">
            <span class="prop-name">Lead Time:</span>
            <span class="prop-val" style="color: var(--cam-success);">${mat.leadTime}</span>
          </div>
        </div>

        <div class="material-tags">
          ${mat.tags.map(tag => `<span class="prop-tag">${tag}</span>`).join('')}
        </div>

        <div class="material-card-actions">
          <button class="btn btn-sm btn-primary" style="width: 100%;" onclick="window.configurator.open('${mat.id}')">
            Configure with ${mat.name.split(' ')[0]}
          </button>
        </div>
      </div>
    `;
  }).join('');
}

window.resetMaterialFilters = function() {
  activeTechFilter = 'ALL';
  activeCatFilter = 'ALL';
  activeSearchQuery = '';
  document.querySelectorAll('.tech-filter-chip, .cat-filter-chip').forEach(c => {
    if (c.getAttribute('data-tech') === 'ALL' || c.getAttribute('data-cat') === 'ALL') c.classList.add('active');
    else c.classList.remove('active');
  });
  const s = document.getElementById('material-search-input');
  if (s) s.value = '';
  renderMaterialsGrid();
};

/* --------------------------------------------------------------------------
   4. Side-by-Side Comparison System
   -------------------------------------------------------------------------- */
function initComparisonSystem() {
  updateComparisonBar();
}

window.toggleMaterialComparison = function(matId) {
  store.toggleComparison(matId);
  updateComparisonBar();
  renderMaterialsGrid();
};

function updateComparisonBar() {
  const bar = document.getElementById('comparison-floating-bar');
  const countEl = document.getElementById('comparison-count-label');
  if (!bar) return;

  const count = (store.state.comparisonList || []).length;
  if (count > 0) {
    bar.classList.add('active');
    if (countEl) countEl.textContent = `${count} Material${count > 1 ? 's' : ''} Selected`;
  } else {
    bar.classList.remove('active');
  }
}

window.openComparisonModal = function() {
  const modal = document.getElementById('comparison-modal');
  const body = document.getElementById('comparison-modal-body');
  if (!modal || !body) return;

  const comparedIds = store.state.comparisonList || [];
  const mats = MATERIALS_DATA.filter(m => comparedIds.includes(m.id));

  if (mats.length === 0) return;

  body.innerHTML = `
    <div class="table-responsive">
      <table class="cam-table comparison-table">
        <thead>
          <tr>
            <th>Property</th>
            ${mats.map(m => `<th><strong>${m.name}</strong><br><span style="color: var(--cam-blue-primary); font-size: 0.75rem;">${m.technology}</span></th>`).join('')}
          </tr>
        </thead>
        <tbody>
          <tr>
            <td><strong>Category</strong></td>
            ${mats.map(m => `<td>${m.category}</td>`).join('')}
          </tr>
          <tr>
            <td><strong>Tensile Strength</strong></td>
            ${mats.map(m => `<td><strong style="color: var(--cam-text-primary);">${m.tensileStrength} MPa</strong></td>`).join('')}
          </tr>
          <tr>
            <td><strong>Heat Deflection Temp (HDT)</strong></td>
            ${mats.map(m => `<td><strong style="color: var(--cam-text-primary);">${m.hdt} °C</strong></td>`).join('')}
          </tr>
          <tr>
            <td><strong>Elongation at Break</strong></td>
            ${mats.map(m => `<td>${m.elongation}%</td>`).join('')}
          </tr>
          <tr>
            <td><strong>Density</strong></td>
            ${mats.map(m => `<td>${m.density} g/cm³</td>`).join('')}
          </tr>
          <tr>
            <td><strong>Standard Tolerance</strong></td>
            ${mats.map(m => `<td><span class="mono-tag" style="color: var(--cam-cyan-tech);">${m.standardTolerance}</span></td>`).join('')}
          </tr>
          <tr>
            <td><strong>Min Wall Thickness</strong></td>
            ${mats.map(m => `<td>${m.minWallThickness}</td>`).join('')}
          </tr>
          <tr>
            <td><strong>Lead Time</strong></td>
            ${mats.map(m => `<td><span style="color: var(--cam-success); font-weight: 600;">${m.leadTime}</span></td>`).join('')}
          </tr>
          <tr>
            <td><strong>Surface Finish Options</strong></td>
            ${mats.map(m => `<td style="font-size: 0.8125rem; color: var(--cam-text-muted);">${m.surfaceFinish}</td>`).join('')}
          </tr>
          <tr>
            <td><strong>Ideal Applications</strong></td>
            ${mats.map(m => `<td style="font-size: 0.8125rem;">${m.idealFor}</td>`).join('')}
          </tr>
        </tbody>
      </table>
    </div>
  `;

  modal.classList.add('active');
};

/* --------------------------------------------------------------------------
   5. Persona Switcher & Global UI Sync
   -------------------------------------------------------------------------- */
function initPersonaSwitcher() {
  const triggerBtn = document.getElementById('header-persona-btn');
  if (triggerBtn) {
    triggerBtn.addEventListener('click', () => {
      window.authManager.openPersonaModal();
    });
  }

  // Persona modal cards
  const personaCards = document.querySelectorAll('.persona-select-card');
  personaCards.forEach(card => {
    card.addEventListener('click', () => {
      const pid = card.getAttribute('data-persona-id');
      window.authManager.selectPersona(pid);
    });
  });
}

function initNotificationSystem() {
  const notifBtn = document.getElementById('header-notif-btn');
  const notifDrawer = document.getElementById('notifications-drawer');

  if (notifBtn && notifDrawer) {
    notifBtn.addEventListener('click', () => {
      notifDrawer.classList.toggle('active');
    });
  }
}

window.updateUiFromStore = function() {
  const u = store.state.currentUser;
  
  // Header persona label
  const personaLabel = document.getElementById('header-persona-name');
  if (personaLabel && u) {
    personaLabel.textContent = u.name.split(' ')[0] + ' (' + u.role.split(' ')[0] + ')';
  }

  // Auth button states
  const authNavBtn = document.getElementById('header-auth-btn');
  if (authNavBtn) {
    if (store.state.isAuthenticated) {
      authNavBtn.textContent = 'Dashboard';
      authNavBtn.onclick = () => window.navigateTo('dashboard');
    } else {
      authNavBtn.textContent = 'Sign In';
      authNavBtn.onclick = () => window.authManager.openAuthModal('login');
    }
  }

  // Render dashboard if active
  if (window.location.hash === '#dashboard' && window.dashboardCtrl) {
    window.dashboardCtrl.renderAll();
  }
};
