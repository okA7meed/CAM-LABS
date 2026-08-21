/**
 * CAM LABS — Customer Authentication & Persona System
 * Registration, Login, Forgot Password, Demo Quick-Login Switcher & Profile updates
 */

class AuthManager {
  constructor() {
    this.initElements();
    this.initEvents();
  }

  initElements() {
    // Modals
    this.authModal = document.getElementById('auth-modal');
    this.personaModal = document.getElementById('persona-modal');
    this.forgotPasswordModal = document.getElementById('forgot-password-modal');

    // Forms
    this.loginForm = document.getElementById('login-form');
    this.registerForm = document.getElementById('register-form');
    this.profileForm = document.getElementById('profile-form');
    this.preferencesForm = document.getElementById('preferences-form');

    // Password visibility toggles
    this.togglePassBtns = document.querySelectorAll('.toggle-password-btn');
  }

  initEvents() {
    // Password toggles
    this.togglePassBtns.forEach(btn => {
      btn.addEventListener('click', (e) => {
        const input = btn.previousElementSibling;
        if (input && input.tagName === 'INPUT') {
          if (input.type === 'password') {
            input.type = 'text';
            btn.innerHTML = `<svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M17.94 17.94A10.07 10.07 0 0 1 12 20c-7 0-11-8-11-8a18.45 18.45 0 0 1 5.06-5.94M9.9 4.24A9.12 9.12 0 0 1 12 4c7 0 11 8 11 8a18.5 18.5 0 0 1-2.16 3.19m-6.72-1.07a3 3 0 1 1-4.24-4.24"/><line x1="1" y1="1" x2="23" y2="23"/></svg>`;
          } else {
            input.type = 'password';
            btn.innerHTML = `<svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z"/><circle cx="12" cy="12" r="3"/></svg>`;
          }
        }
      });
    });

    // Password Strength Meter in Registration
    const regPasswordInput = document.getElementById('reg-password');
    const strengthBar = document.getElementById('password-strength-bar');
    const strengthText = document.getElementById('password-strength-text');

    if (regPasswordInput && strengthBar && strengthText) {
      regPasswordInput.addEventListener('input', (e) => {
        const val = e.target.value;
        let score = 0;
        if (val.length >= 8) score++;
        if (/[A-Z]/.test(val)) score++;
        if (/[0-9]/.test(val)) score++;
        if (/[^A-Za-z0-9]/.test(val)) score++;

        strengthBar.style.width = `${(score / 4) * 100}%`;
        if (score <= 1) {
          strengthBar.style.backgroundColor = '#EF4444';
          strengthText.textContent = 'Weak';
        } else if (score === 2 || score === 3) {
          strengthBar.style.backgroundColor = '#F59E0B';
          strengthText.textContent = 'Medium (Good)';
        } else {
          strengthBar.style.backgroundColor = '#10B981';
          strengthText.textContent = 'Strong (Enterprise Grade)';
        }
      });
    }

    // Login Form Submit
    if (this.loginForm) {
      this.loginForm.addEventListener('submit', (e) => {
        e.preventDefault();
        const email = document.getElementById('login-email').value;
        const pass = document.getElementById('login-password').value;

        if (!email || !pass) {
          if (window.showToast) window.showToast("Validation Error", "Please enter your email and password.", "error");
          return;
        }

        // Simulate login success
        store.state.isAuthenticated = true;
        store.saveState();
        this.closeAuthModal();

        if (window.showToast) {
          window.showToast("Authenticated", `Welcome back, ${store.state.currentUser.name}!`, "success");
        }

        if (window.navigateTo) window.navigateTo('dashboard');
      });
    }

    // Registration Form Submit
    if (this.registerForm) {
      this.registerForm.addEventListener('submit', (e) => {
        e.preventDefault();
        const name = document.getElementById('reg-name').value;
        const email = document.getElementById('reg-email').value;
        const pass = document.getElementById('reg-password').value;
        const confirmPass = document.getElementById('reg-confirm-password').value;
        const company = document.getElementById('reg-company').value || "Independent Engineer";
        const phone = document.getElementById('reg-phone').value || "";
        const terms = document.getElementById('reg-terms').checked;

        if (!name || !email || !pass) {
          if (window.showToast) window.showToast("Registration Error", "Please complete all required fields.", "error");
          return;
        }

        if (pass !== confirmPass) {
          if (window.showToast) window.showToast("Password Mismatch", "Passwords do not match.", "error");
          return;
        }

        if (!terms) {
          if (window.showToast) window.showToast("Terms Required", "Please accept the CAM LABS Terms of Manufacturing.", "error");
          return;
        }

        // Create new registered user
        const newUser = {
          id: `usr-${Date.now()}`,
          name: name,
          role: "Manufacturing Engineer",
          company: company,
          email: email,
          phone: phone,
          avatar: "https://images.unsplash.com/photo-1535713875002-d1d0cf377fde?w=150&auto=format&fit=crop&q=80",
          tier: "Pro Engineer",
          address: "100 Manufacturing Way, Tech Park",
          taxId: "PENDING-VERIFICATION",
          preferences: {
            units: "mm",
            toleranceStandard: "ISO 2768-fine (±0.05 mm)",
            dfmNotifications: true,
            dispatchAlerts: true
          }
        };

        store.state.currentUser = newUser;
        store.state.isAuthenticated = true;
        store.saveState();
        this.closeAuthModal();

        if (window.showToast) {
          window.showToast("Account Created", `Welcome to CAM LABS, ${name}! Your engineering dashboard is ready.`, "success");
        }

        if (window.navigateTo) window.navigateTo('dashboard');
      });
    }

    // Forgot password flow
    const forgotLink = document.getElementById('forgot-password-link');
    if (forgotLink) {
      forgotLink.addEventListener('click', (e) => {
        e.preventDefault();
        this.closeAuthModal();
        if (this.forgotPasswordModal) this.forgotPasswordModal.classList.add('active');
      });
    }

    const forgotForm = document.getElementById('forgot-password-form');
    if (forgotForm) {
      forgotForm.addEventListener('submit', (e) => {
        e.preventDefault();
        const resetEmail = document.getElementById('reset-email').value;
        if (this.forgotPasswordModal) this.forgotPasswordModal.classList.remove('active');
        if (window.showToast) {
          window.showToast("Reset Link Sent", `Password reset instructions dispatched to ${resetEmail}.`, "info");
        }
      });
    }
  }

  openAuthModal(tab = 'login') {
    if (this.authModal) {
      this.authModal.classList.add('active');
      document.body.style.overflow = 'hidden';
      this.switchAuthTab(tab);
    }
  }

  closeAuthModal() {
    if (this.authModal) {
      this.authModal.classList.remove('active');
      document.body.style.overflow = '';
    }
  }

  switchAuthTab(tab) {
    const loginTabBtn = document.getElementById('auth-tab-login');
    const regTabBtn = document.getElementById('auth-tab-reg');
    const loginPane = document.getElementById('auth-pane-login');
    const regPane = document.getElementById('auth-pane-reg');

    if (tab === 'login') {
      if (loginTabBtn) loginTabBtn.classList.add('active');
      if (regTabBtn) regTabBtn.classList.remove('active');
      if (loginPane) loginPane.style.display = 'block';
      if (regPane) regPane.style.display = 'none';
    } else {
      if (regTabBtn) regTabBtn.classList.add('active');
      if (loginTabBtn) loginTabBtn.classList.remove('active');
      if (loginPane) loginPane.style.display = 'none';
      if (regPane) regPane.style.display = 'block';
    }
  }

  openPersonaModal() {
    if (this.personaModal) {
      this.personaModal.classList.add('active');
      document.body.style.overflow = 'hidden';
    }
  }

  closePersonaModal() {
    if (this.personaModal) {
      this.personaModal.classList.remove('active');
      document.body.style.overflow = '';
    }
  }

  selectPersona(personaId) {
    store.switchPersona(personaId);
    this.closePersonaModal();
    if (window.showToast) {
      window.showToast("Persona Activated", `Switched active session to ${store.state.currentUser.name} (${store.state.currentUser.company}).`, "info");
    }
    if (window.updateUiFromStore) {
      window.updateUiFromStore();
    }
  }
}

window.AuthManager = AuthManager;
