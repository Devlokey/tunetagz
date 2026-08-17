/**
 * TuneTagZ Customer Authentication & Session Management
 */
(function (global) {
  'use strict';

  const Auth = {
    init() {
      this.checkSession();
      this.bindEvents();
    },

    async checkSession() {
      const token = API.getToken();
      if (!token) {
        this.updateNav(null);
        return;
      }

      try {
        const res = await API.auth.getMe();
        if (res && res.success && res.user) {
          API.setUser(res.user);
          this.updateNav(res.user);
        } else {
          API.clearAuth();
          this.updateNav(null);
        }
      } catch (err) {
        if (err.status === 401 || err.status === 403) {
          API.clearAuth();
          this.updateNav(null);
        } else {
          const localUser = API.getUser();
          this.updateNav(localUser);
        }
      }
    },

    updateNav(user) {
      const navContainer = document.getElementById('navUserContainer');
      const mobileNavContainer = document.getElementById('mobileNavUserContainer');

      if (navContainer) {
        if (user) {
          navContainer.innerHTML = `
            <div class="user-nav-dropdown">
              <button class="btn-user-badge" id="userMenuBtn" aria-expanded="false" aria-label="User account menu">
                <span class="user-avatar">${(user.name || user.email || 'U')[0].toUpperCase()}</span>
                <span class="user-name">${user.name || user.email.split('@')[0]}</span>
                <span class="dropdown-arrow">▾</span>
              </button>
              <div class="user-dropdown-menu" id="userDropdownMenu" role="menu">
                <div class="dropdown-header">
                  <strong>${user.name || 'Customer'}</strong>
                  <small>${user.email}</small>
                </div>
                <hr class="dropdown-divider" />
                <button class="dropdown-item" role="menuitem" id="navMyOrdersBtn">
                  <span class="item-icon">📦</span> My Orders
                </button>
                <button class="dropdown-item" role="menuitem" id="navTrackOrderBtn">
                  <span class="item-icon">🔍</span> Track Order
                </button>
                ${user.role === 'admin' || user.role === 'developer' ? `
                  <a href="admin.html" class="dropdown-item admin-link" role="menuitem">
                    <span class="item-icon">⚡</span> Developer Admin
                  </a>
                ` : ''}
                <hr class="dropdown-divider" />
                <button class="dropdown-item logout-btn" role="menuitem" id="navLogoutBtn">
                  <span class="item-icon">🚪</span> Sign Out
                </button>
              </div>
            </div>
          `;

          const userMenuBtn = document.getElementById('userMenuBtn');
          const userDropdownMenu = document.getElementById('userDropdownMenu');
          if (userMenuBtn && userDropdownMenu) {
            userMenuBtn.addEventListener('click', (e) => {
              e.stopPropagation();
              const isOpen = userDropdownMenu.classList.toggle('show');
              userMenuBtn.setAttribute('aria-expanded', String(isOpen));
            });
            document.addEventListener('click', () => {
              userDropdownMenu.classList.remove('show');
              userMenuBtn.setAttribute('aria-expanded', 'false');
            });
          }

          document.getElementById('navMyOrdersBtn')?.addEventListener('click', () => {
            if (global.TrackingModal) global.TrackingModal.showMyOrders();
          });
          document.getElementById('navTrackOrderBtn')?.addEventListener('click', () => {
            if (global.TrackingModal) global.TrackingModal.open();
          });
          document.getElementById('navLogoutBtn')?.addEventListener('click', () => {
            Auth.logout();
          });

        } else {
          navContainer.innerHTML = `
            <button class="nav-cta btn-auth-trigger" id="navLoginBtn" aria-label="Sign in or register">
              Sign In
            </button>
          `;
          document.getElementById('navLoginBtn')?.addEventListener('click', () => {
            AuthModal.open('login');
          });
        }
      }

      if (mobileNavContainer) {
        if (user) {
          mobileNavContainer.innerHTML = `
            <div class="mobile-user-card">
              <div class="mobile-user-avatar">${(user.name || user.email || 'U')[0].toUpperCase()}</div>
              <div class="mobile-user-details">
                <strong>${user.name || 'Customer'}</strong>
                <small>${user.email}</small>
              </div>
            </div>
            <button class="d-link mobile-btn-link" id="mobileMyOrdersBtn">📦 My Orders</button>
            <button class="d-link mobile-btn-link" id="mobileTrackBtn">🔍 Track Order</button>
            ${user.role === 'admin' || user.role === 'developer' ? `
              <a href="admin.html" class="d-link mobile-btn-link" style="color: var(--gold);">⚡ Admin Portal</a>
            ` : ''}
            <button class="d-link mobile-btn-link mobile-logout" id="mobileLogoutBtn">🚪 Sign Out</button>
          `;

          document.getElementById('mobileMyOrdersBtn')?.addEventListener('click', () => {
            if (global.TrackingModal) global.TrackingModal.showMyOrders();
            if (typeof global.closeDrawer === 'function') global.closeDrawer();
          });
          document.getElementById('mobileTrackBtn')?.addEventListener('click', () => {
            if (global.TrackingModal) global.TrackingModal.open();
            if (typeof global.closeDrawer === 'function') global.closeDrawer();
          });
          document.getElementById('mobileLogoutBtn')?.addEventListener('click', () => {
            Auth.logout();
            if (typeof global.closeDrawer === 'function') global.closeDrawer();
          });

        } else {
          mobileNavContainer.innerHTML = `
            <button class="d-cta" id="mobileLoginBtn" aria-label="Sign in or register">
              Sign In / Register
            </button>
          `;
          document.getElementById('mobileLoginBtn')?.addEventListener('click', () => {
            AuthModal.open('login');
            if (typeof global.closeDrawer === 'function') global.closeDrawer();
          });
        }
      }
    },

    async logout() {
      try {
        await API.auth.logout();
      } catch (e) {}
      this.updateNav(null);
      showToast('Signed out successfully.', 'info');
    },

    bindEvents() {}
  };

  const AuthModal = {
    modalId: 'authModal',
    currentTab: 'login',

    open(tab = 'login') {
      this.currentTab = tab;
      let modal = document.getElementById(this.modalId);
      if (!modal) {
        this.renderModal();
        modal = document.getElementById(this.modalId);
      }
      this.switchTab(tab);
      modal.classList.add('is-open');
      document.body.style.overflow = 'hidden';
      const inputToFocus = modal.querySelector(tab === 'login' ? '#loginEmail' : '#regName');
      if (inputToFocus) setTimeout(() => inputToFocus.focus(), 100);
    },

    close() {
      const modal = document.getElementById(this.modalId);
      if (modal) {
        modal.classList.remove('is-open');
        document.body.style.overflow = '';
      }
    },

    switchTab(tab) {
      this.currentTab = tab;
      const modal = document.getElementById(this.modalId);
      if (!modal) return;

      const tabLogin = modal.querySelector('#tabBtnLogin');
      const tabRegister = modal.querySelector('#tabBtnRegister');
      const formLogin = modal.querySelector('#formLogin');
      const formRegister = modal.querySelector('#formRegister');
      const errorBox = modal.querySelector('#authErrorBox');

      if (errorBox) {
        errorBox.textContent = '';
        errorBox.style.display = 'none';
      }

      if (tab === 'login') {
        tabLogin.classList.add('active');
        tabRegister.classList.remove('active');
        formLogin.style.display = 'block';
        formRegister.style.display = 'none';
      } else {
        tabLogin.classList.remove('active');
        tabRegister.classList.add('active');
        formLogin.style.display = 'none';
        formRegister.style.display = 'block';
      }
    },

    showError(msg) {
      const errorBox = document.getElementById('authErrorBox');
      if (errorBox) {
        errorBox.textContent = msg;
        errorBox.style.display = 'block';
      }
    },

    renderModal() {
      const modalHtml = `
        <div class="ttz-modal-backdrop" id="${this.modalId}" role="dialog" aria-modal="true" aria-labelledby="authModalTitle">
          <div class="ttz-modal-container auth-modal-container">
            <button class="ttz-modal-close" id="authModalCloseBtn" aria-label="Close authentication modal">✕</button>
            
            <div class="auth-modal-header">
              <img src="TUNETAGZ%20LOGO.png" alt="TuneTagZ" class="auth-logo" />
              <h2 id="authModalTitle" class="auth-title">Welcome to TuneTagZ</h2>
              <p class="auth-subtitle">Wear your sound. Sign in to customize tags, save carts, and track your orders.</p>
            </div>

            <div class="auth-tabs" role="tablist">
              <button class="auth-tab-btn active" id="tabBtnLogin" role="tab">Sign In</button>
              <button class="auth-tab-btn" id="tabBtnRegister" role="tab">Create Account</button>
            </div>

            <div class="auth-error-box" id="authErrorBox" style="display: none;" role="alert"></div>

            <!-- Login Form -->
            <form id="formLogin" class="auth-form">
              <div class="form-group">
                <label for="loginEmail">Email Address</label>
                <input type="email" id="loginEmail" name="email" required placeholder="name@example.com" autocomplete="email" />
              </div>
              <div class="form-group">
                <label for="loginPassword">Password</label>
                <input type="password" id="loginPassword" name="password" required placeholder="••••••••" autocomplete="current-password" />
              </div>
              <button type="submit" class="btn-primary auth-submit-btn" id="loginSubmitBtn">
                <span>Sign In</span>
              </button>
            </form>

            <!-- Register Form -->
            <form id="formRegister" class="auth-form" style="display: none;">
              <div class="form-group">
                <label for="regName">Full Name</label>
                <input type="text" id="regName" name="name" required placeholder="Alex Turner" autocomplete="name" />
              </div>
              <div class="form-group">
                <label for="regEmail">Email Address</label>
                <input type="email" id="regEmail" name="email" required placeholder="alex@example.com" autocomplete="email" />
              </div>
              <div class="form-group">
                <label for="regPassword">Password</label>
                <input type="password" id="regPassword" name="password" required minlength="6" placeholder="At least 6 characters" autocomplete="new-password" />
              </div>
              <button type="submit" class="btn-primary auth-submit-btn" id="regSubmitBtn">
                <span>Create Account</span>
              </button>
            </form>

            <div class="auth-divider">
              <span>OR</span>
            </div>

            <!-- Google OAuth Button -->
            <button class="btn-google-oauth" type="button" id="btnGoogleOAuth">
              <svg class="google-icon" viewBox="0 0 24 24" width="18" height="18">
                <path fill="#EA4335" d="M12 5c1.7 0 3 .6 4.1 1.6l3.1-3.1C17.3 1.7 14.8 1 12 1 7.5 1 3.7 3.6 1.9 7.3l3.7 2.9C6.5 7.3 9 5 12 5z"/>
                <path fill="#4285F4" d="M23.5 12.3c0-.8-.1-1.6-.2-2.3H12v4.5h6.5c-.3 1.5-1.1 2.8-2.4 3.7l3.7 2.9c2.2-2 3.7-5 3.7-8.8z"/>
                <path fill="#FBBC05" d="M5.6 14.8c-.2-.7-.4-1.5-.4-2.3 0-.8.2-1.6.4-2.3L1.9 7.3C.7 9.7 0 12 0 14.5s.7 4.8 1.9 7.2l3.7-6.9z"/>
                <path fill="#34A853" d="M12 23.5c3.2 0 6-1.1 8-3l-3.7-2.9c-1.1.7-2.5 1.2-4.3 1.2-3 0-5.5-2.3-6.4-5.2L1.9 16.5C3.7 20.4 7.5 23.5 12 23.5z"/>
              </svg>
              <span>Continue with Google</span>
            </button>
          </div>
        </div>
      `;
      document.body.insertAdjacentHTML('beforeend', modalHtml);

      const modal = document.getElementById(this.modalId);
      document.getElementById('authModalCloseBtn')?.addEventListener('click', () => AuthModal.close());
      document.getElementById('tabBtnLogin')?.addEventListener('click', () => AuthModal.switchTab('login'));
      document.getElementById('tabBtnRegister')?.addEventListener('click', () => AuthModal.switchTab('register'));

      document.getElementById('formLogin')?.addEventListener('submit', (e) => AuthModal.handleLogin(e));
      document.getElementById('formRegister')?.addEventListener('submit', (e) => AuthModal.handleRegister(e));
      document.getElementById('btnGoogleOAuth')?.addEventListener('click', () => AuthModal.handleGoogleLogin());

      modal.addEventListener('click', (e) => {
        if (e.target === modal) AuthModal.close();
      });
      document.addEventListener('keydown', (e) => {
        if (e.key === 'Escape' && modal.classList.contains('is-open')) AuthModal.close();
      });
    },

    async handleLogin(event) {
      event.preventDefault();
      const form = event.target;
      const email = form.email.value.trim();
      const password = form.password.value;
      const btn = document.getElementById('loginSubmitBtn');

      try {
        btn.disabled = true;
        btn.innerHTML = '<span class="spinner"></span> Signing In...';
        const res = await API.auth.login({ email, password });
        if (res.success) {
          Auth.updateNav(res.user);
          AuthModal.close();
          showToast(`Welcome back, ${res.user.name || 'Music Lover'}!`, 'success');
          if (global.__pendingAuthAction) {
            const act = global.__pendingAuthAction;
            global.__pendingAuthAction = null;
            act();
          }
        }
      } catch (err) {
        AuthModal.showError(err.message || 'Failed to sign in. Please check your credentials.');
      } finally {
        btn.disabled = false;
        btn.innerHTML = '<span>Sign In</span>';
      }
    },

    async handleRegister(event) {
      event.preventDefault();
      const form = event.target;
      const name = form.name.value.trim();
      const email = form.email.value.trim();
      const password = form.password.value;
      const btn = document.getElementById('regSubmitBtn');

      try {
        btn.disabled = true;
        btn.innerHTML = '<span class="spinner"></span> Creating Account...';
        const res = await API.auth.register({ name, email, password });
        if (res.success) {
          Auth.updateNav(res.user);
          AuthModal.close();
          showToast(`Welcome to TuneTagZ, ${res.user.name}!`, 'success');
          if (global.__pendingAuthAction) {
            const act = global.__pendingAuthAction;
            global.__pendingAuthAction = null;
            act();
          }
        }
      } catch (err) {
        AuthModal.showError(err.message || 'Registration failed. Email might already be in use.');
      } finally {
        btn.disabled = false;
        btn.innerHTML = '<span>Create Account</span>';
      }
    },

    async handleGoogleLogin() {
      try {
        const testGoogleEmail = prompt('Google OAuth 2.0 Sign-In:\nEnter your Google Email address:', 'customer@gmail.com');
        if (!testGoogleEmail) return;
        const testName = testGoogleEmail.split('@')[0].replace(/[._]/g, ' ').replace(/\b\w/g, c => c.toUpperCase());

        const res = await API.auth.google({
          email: testGoogleEmail,
          name: testName,
          googleId: 'google_' + btoa(testGoogleEmail).slice(0, 12)
        });

        if (res.success) {
          Auth.updateNav(res.user);
          AuthModal.close();
          showToast(`Connected with Google as ${res.user.name}!`, 'success');
          if (global.__pendingAuthAction) {
            const act = global.__pendingAuthAction;
            global.__pendingAuthAction = null;
            act();
          }
        }
      } catch (err) {
        AuthModal.showError(err.message || 'Google Sign-In failed.');
      }
    }
  };

  function showToast(message, type = 'info') {
    let toastContainer = document.getElementById('ttzToastContainer');
    if (!toastContainer) {
      toastContainer = document.createElement('div');
      toastContainer.id = 'ttzToastContainer';
      toastContainer.className = 'ttz-toast-container';
      document.body.appendChild(toastContainer);
    }

    const toast = document.createElement('div');
    toast.className = `ttz-toast ttz-toast-${type}`;
    const icon = type === 'success' ? '✓' : type === 'error' ? '✕' : 'ℹ';
    toast.innerHTML = `
      <span class="toast-icon">${icon}</span>
      <span class="toast-msg">${message}</span>
    `;

    toastContainer.appendChild(toast);

    setTimeout(() => {
      toast.classList.add('show');
    }, 10);

    setTimeout(() => {
      toast.classList.remove('show');
      setTimeout(() => toast.remove(), 300);
    }, 4000);
  }

  global.Auth = Auth;
  global.AuthModal = AuthModal;
  global.showToast = showToast;

  if (typeof document !== 'undefined') {
    if (document.readyState === 'loading') {
      document.addEventListener('DOMContentLoaded', () => Auth.init());
    } else {
      Auth.init();
    }
  }
})(typeof window !== 'undefined' ? window : globalThis);
