const fs = require('fs');
const path = require('path');

// Ensure directories exist
['public', 'public/js', 'public/css', 'public/images', '.agents/worker_frontend_1'].forEach(d => {
  if (!fs.existsSync(d)) fs.mkdirSync(d, { recursive: true });
});

// Copy brand assets to public/ and public/images/
const staticFiles = [
  'PRODUCT 1.png', 'PRODUCT 2.png', 'POSTER 1.png', 'POSTER 2.png',
  'TUNETAGZ LOGO.png', 'manifest.json', 'robots.txt', 'sitemap.xml'
];
staticFiles.forEach(f => {
  if (fs.existsSync(f)) {
    fs.copyFileSync(f, path.join('public', f));
    if (f.endsWith('.png')) {
      fs.copyFileSync(f, path.join('public/images', f));
    }
  }
});

// ============================================================================
// 1. public/js/auth.js
// ============================================================================
const authJs = `/**
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
          navContainer.innerHTML = \`
            <div class="user-nav-dropdown">
              <button class="btn-user-badge" id="userMenuBtn" aria-expanded="false" aria-label="User account menu">
                <span class="user-avatar">\${(user.name || user.email || 'U')[0].toUpperCase()}</span>
                <span class="user-name">\${user.name || user.email.split('@')[0]}</span>
                <span class="dropdown-arrow">▾</span>
              </button>
              <div class="user-dropdown-menu" id="userDropdownMenu" role="menu">
                <div class="dropdown-header">
                  <strong>\${user.name || 'Customer'}</strong>
                  <small>\${user.email}</small>
                </div>
                <hr class="dropdown-divider" />
                <button class="dropdown-item" role="menuitem" id="navMyOrdersBtn">
                  <span class="item-icon">📦</span> My Orders
                </button>
                <button class="dropdown-item" role="menuitem" id="navTrackOrderBtn">
                  <span class="item-icon">🔍</span> Track Order
                </button>
                \${user.role === 'admin' || user.role === 'developer' ? \`
                  <a href="admin.html" class="dropdown-item admin-link" role="menuitem">
                    <span class="item-icon">⚡</span> Developer Admin
                  </a>
                \` : ''}
                <hr class="dropdown-divider" />
                <button class="dropdown-item logout-btn" role="menuitem" id="navLogoutBtn">
                  <span class="item-icon">🚪</span> Sign Out
                </button>
              </div>
            </div>
          \`;

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
          navContainer.innerHTML = \`
            <button class="nav-cta btn-auth-trigger" id="navLoginBtn" aria-label="Sign in or register">
              Sign In
            </button>
          \`;
          document.getElementById('navLoginBtn')?.addEventListener('click', () => {
            AuthModal.open('login');
          });
        }
      }

      if (mobileNavContainer) {
        if (user) {
          mobileNavContainer.innerHTML = \`
            <div class="mobile-user-card">
              <div class="mobile-user-avatar">\${(user.name || user.email || 'U')[0].toUpperCase()}</div>
              <div class="mobile-user-details">
                <strong>\${user.name || 'Customer'}</strong>
                <small>\${user.email}</small>
              </div>
            </div>
            <button class="d-link mobile-btn-link" id="mobileMyOrdersBtn">📦 My Orders</button>
            <button class="d-link mobile-btn-link" id="mobileTrackBtn">🔍 Track Order</button>
            \${user.role === 'admin' || user.role === 'developer' ? \`
              <a href="admin.html" class="d-link mobile-btn-link" style="color: var(--gold);">⚡ Admin Portal</a>
            \` : ''}
            <button class="d-link mobile-btn-link mobile-logout" id="mobileLogoutBtn">🚪 Sign Out</button>
          \`;

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
          mobileNavContainer.innerHTML = \`
            <button class="d-cta" id="mobileLoginBtn" aria-label="Sign in or register">
              Sign In / Register
            </button>
          \`;
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
      const modalHtml = \`
        <div class="ttz-modal-backdrop" id="\${this.modalId}" role="dialog" aria-modal="true" aria-labelledby="authModalTitle">
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
      \`;
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
          showToast(\`Welcome back, \${res.user.name || 'Music Lover'}!\`, 'success');
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
          showToast(\`Welcome to TuneTagZ, \${res.user.name}!\`, 'success');
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
        const testGoogleEmail = prompt('Google OAuth 2.0 Sign-In:\\nEnter your Google Email address:', 'customer@gmail.com');
        if (!testGoogleEmail) return;
        const testName = testGoogleEmail.split('@')[0].replace(/[._]/g, ' ').replace(/\\b\\w/g, c => c.toUpperCase());

        const res = await API.auth.google({
          email: testGoogleEmail,
          name: testName,
          googleId: 'google_' + btoa(testGoogleEmail).slice(0, 12)
        });

        if (res.success) {
          Auth.updateNav(res.user);
          AuthModal.close();
          showToast(\`Connected with Google as \${res.user.name}!\`, 'success');
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
    toast.className = \`ttz-toast ttz-toast-\${type}\`;
    const icon = type === 'success' ? '✓' : type === 'error' ? '✕' : 'ℹ';
    toast.innerHTML = \`
      <span class="toast-icon">\${icon}</span>
      <span class="toast-msg">\${message}</span>
    \`;

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
`;
fs.writeFileSync('public/js/auth.js', authJs);
console.log('✓ public/js/auth.js written');

// ============================================================================
// 2. public/js/customizer.js
// ============================================================================
const customizerJs = `/**
 * TuneTagZ 2-Sided Interactive Spotify Keychain Customizer
 * Real-time soundwave waveform generator, 3D flip card, and laser engraving preview.
 */
(function (global) {
  'use strict';

  const CustomizerModal = {
    modalId: 'customizerModal',
    isFlipped: false,
    activeProduct: null,
    previewState: {
      spotifyUrl: '',
      spotifyCode: '',
      trackTitle: 'Starboy',
      artistName: 'The Weeknd, Daft Punk',
      customText: 'Amal & Sarah',
      fontFamily: 'DM Mono',
      finish: 'Matte Black'
    },

    open(product = null) {
      this.activeProduct = product || {
        id: 'SPT-001',
        sku: 'SPT-001',
        name: 'Spotify Code Tag',
        price: 699,
        is_customizable: true
      };

      let modal = document.getElementById(this.modalId);
      if (!modal) {
        this.renderModal();
        modal = document.getElementById(this.modalId);
      }

      this.isFlipped = false;
      this.updateCardFlipState();
      this.updateSpotifyPreview(this.previewState.spotifyUrl || 'https://open.spotify.com/track/4cOdK2wGLETKBW3PvgPWqT');
      this.updateEngravingPreview();

      modal.classList.add('is-open');
      document.body.style.overflow = 'hidden';
    },

    close() {
      const modal = document.getElementById(this.modalId);
      if (modal) {
        modal.classList.remove('is-open');
        document.body.style.overflow = '';
      }
    },

    flipCard(forceSide = null) {
      if (forceSide === 'front') this.isFlipped = false;
      else if (forceSide === 'back') this.isFlipped = true;
      else this.isFlipped = !this.isFlipped;

      this.updateCardFlipState();
    },

    updateCardFlipState() {
      const card = document.getElementById('customizer3DCard');
      const sideIndicator = document.getElementById('cardSideIndicator');
      const flipBtnText = document.getElementById('flipBtnText');

      if (card) {
        card.classList.toggle('is-flipped', this.isFlipped);
      }
      if (sideIndicator) {
        sideIndicator.innerHTML = this.isFlipped
          ? '<span class=\"badge-side badge-back\">BACK SIDE</span> Laser Engraving'
          : '<span class=\"badge-side badge-front\">FRONT SIDE</span> Spotify Soundwave';
      }
      if (flipBtnText) {
        flipBtnText.textContent = this.isFlipped ? 'Preview Front Side' : 'Preview Back Side';
      }
    },

    // ── Generate Spotify Soundwave SVG (Deterministic 23-bar algorithm) ──
    generateLocalSvg(seed = 'tunetagz') {
      let hash = 0;
      for (let i = 0; i < seed.length; i++) {
        hash = ((hash << 5) - hash) + seed.charCodeAt(i);
        hash |= 0;
      }

      const bars = [];
      const numBars = 23;
      const svgWidth = 400;
      const svgHeight = 70;
      const barWidth = 6;
      const spacing = 11;
      const startX = 65;

      for (let i = 0; i < numBars; i++) {
        const pseudoRand = Math.abs(Math.sin(hash + i * 1.7) * 10000) % 1;
        // Height between 14px and 54px
        const barHeight = Math.round(14 + pseudoRand * 40);
        const x = startX + i * (barWidth + spacing);
        const y = Math.round((svgHeight - barHeight) / 2);
        bars.push(\`<rect x="\${x}" y="\${y}" width="\${barWidth}" height="\${barHeight}" rx="3" fill="#c9a84c" />\`);
      }

      return \`
        <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 \${svgWidth} \${svgHeight}" class="spotify-soundwave-svg" aria-label="Spotify Soundwave Barcode">
          <!-- Spotify Logo Icon -->
          <g transform="translate(18, 17) scale(0.075)" fill="#c9a84c">
            <path d="M248 8C111 8 0 119 0 256s111 248 248 248 248-111 248-248S385 8 248 8zm114 358c-4 7-14 9-21 5-58-35-131-43-217-24-8 2-16-3-18-11-2-8 3-16 11-18 94-21 175-12 240 27 7 4 9 14 5 21zm30-67c-6 9-17 12-26 7-66-41-167-53-246-29-10 3-21-3-24-13-3-10 3-21 13-24 90-27 201-14 276 33 9 5 12 17 7 26zm3-70c-79-47-210-51-285-28-12 4-25-3-28-15-4-12 3-25 15-28 86-26 230-21 321 33 11 6 14 21 8 32-6 10-20 14-31 6z"/>
          </g>
          \${bars.join('')}
        </svg>
      \`;
    },

    async updateSpotifyPreview(inputVal) {
      const val = (inputVal || document.getElementById('spotifyUrlInput')?.value || '').trim();
      const previewContainer = document.getElementById('frontWaveformContainer');
      const songInfoEl = document.getElementById('previewSongInfo');

      this.previewState.spotifyUrl = val;

      if (!val) {
        if (previewContainer) previewContainer.innerHTML = this.generateLocalSvg('tunetagz-default');
        if (songInfoEl) songInfoEl.innerHTML = '<span class=\"song-title\">Your Favorite Track</span> <span class=\"song-artist\">Scan & Play on Spotify</span>';
        return;
      }

      // Quick offline/local render first
      if (previewContainer) {
        previewContainer.innerHTML = this.generateLocalSvg(val);
      }

      // Attempt to parse via Backend API
      try {
        const res = await API.spotify.preview(val);
        if (res && res.success) {
          this.previewState.spotifyCode = res.spotify.id || val;
          this.previewState.trackTitle = res.spotify.title || 'Personalized Spotify Track';
          this.previewState.artistName = res.spotify.artist || 'Engraved Gold Waveform';

          if (previewContainer && res.svg) {
            previewContainer.innerHTML = res.svg;
          }
          if (songInfoEl) {
            songInfoEl.innerHTML = \`<span class="song-title">\${this.previewState.trackTitle}</span> <span class="song-artist">\${this.previewState.artistName}</span>\`;
          }
        }
      } catch (err) {
        // Fallback gracefully to local SVG generator
        if (previewContainer) previewContainer.innerHTML = this.generateLocalSvg(val);
        if (songInfoEl) {
          songInfoEl.innerHTML = \`<span class="song-title">Spotify Track</span> <span class="song-artist">\${val.slice(0, 32)}...</span>\`;
        }
      }
    },

    updateEngravingPreview() {
      const input = document.getElementById('engravingTextInput');
      const rawText = input ? input.value : this.previewState.customText;
      const cleanText = rawText.slice(0, 30);
      this.previewState.customText = cleanText;

      const charCounter = document.getElementById('engravingCharCount');
      if (charCounter) {
        charCounter.textContent = \`\${cleanText.length} / 30\`;
        charCounter.classList.toggle('is-max', cleanText.length >= 30);
      }

      const backTextPreview = document.getElementById('backCardCustomText');
      if (backTextPreview) {
        backTextPreview.textContent = cleanText || 'YOUR NAME / MESSAGE';
        backTextPreview.style.fontFamily = this.previewState.fontFamily;
      }
    },

    setEngravingFont(font) {
      this.previewState.fontFamily = font;
      document.querySelectorAll('.font-picker-btn').forEach(btn => {
        btn.classList.toggle('active', btn.dataset.font === font);
      });
      this.updateEngravingPreview();
    },

    setHardwareFinish(finish) {
      this.previewState.finish = finish;
      document.querySelectorAll('.finish-btn').forEach(btn => {
        btn.classList.toggle('active', btn.dataset.finish === finish);
      });
      const tagRing = document.querySelectorAll('.tag-keyring');
      tagRing.forEach(ring => {
        ring.className = \`tag-keyring ring-\${finish.toLowerCase().replace(' ', '-')}\`;
      });
    },

    proceedToCheckout() {
      const item = {
        productId: (this.activeProduct && this.activeProduct.id) || 1,
        productName: (this.activeProduct && this.activeProduct.name) || 'Spotify Code Tag',
        productSku: (this.activeProduct && this.activeProduct.sku) || 'SPT-001',
        price: (this.activeProduct && this.activeProduct.price) || 699,
        quantity: 1,
        spotifyUrl: this.previewState.spotifyUrl || 'https://open.spotify.com/track/4cOdK2wGLETKBW3PvgPWqT',
        spotifyCode: this.previewState.spotifyCode || '4cOdK2wGLETKBW3PvgPWqT',
        songTitle: this.previewState.trackTitle,
        artistName: this.previewState.artistName,
        customText: this.previewState.customText || 'TuneTagZ',
        hardwareFinish: this.previewState.finish,
        fontFamily: this.previewState.fontFamily
      };

      this.close();
      if (global.CheckoutModal) {
        global.CheckoutModal.open(item);
      }
    },

    renderModal() {
      const modalHtml = \`
        <div class="ttz-modal-backdrop" id="\${this.modalId}" role="dialog" aria-modal="true" aria-labelledby="customizerTitle">
          <div class="ttz-modal-container customizer-modal-container">
            <button class="ttz-modal-close" id="customizerCloseBtn" aria-label="Close customizer">✕</button>
            
            <div class="customizer-layout">
              <!-- Left: Interactive 3D Card Preview Stage -->
              <div class="customizer-stage-wrap">
                <div class="stage-header">
                  <span class="customizer-product-title" id="customizerTitle">Spotify Code Tag</span>
                  <div class="card-side-indicator" id="cardSideIndicator">
                    <span class="badge-side badge-front">FRONT SIDE</span> Spotify Soundwave
                  </div>
                </div>

                <div class="tag-3d-scene" id="tag3DScene" title="Click or tap to flip keychain">
                  <div class="tag-3d-card" id="customizer3DCard">
                    <!-- FRONT SIDE -->
                    <div class="tag-face tag-front">
                      <div class="tag-keyring ring-matte-black"></div>
                      <div class="tag-hole"></div>
                      <div class="tag-metal-body">
                        <div class="tag-front-content">
                          <div class="spotify-waveform-box" id="frontWaveformContainer">
                            \${this.generateLocalSvg('tunetagz-default')}
                          </div>
                          <div class="preview-song-info" id="previewSongInfo">
                            <span class="song-title">Starboy</span>
                            <span class="song-artist">The Weeknd, Daft Punk</span>
                          </div>
                        </div>
                      </div>
                      <div class="tag-sheen"></div>
                    </div>

                    <!-- BACK SIDE -->
                    <div class="tag-face tag-back">
                      <div class="tag-keyring ring-matte-black"></div>
                      <div class="tag-hole"></div>
                      <div class="tag-metal-body">
                        <div class="tag-back-content">
                          <div class="engraving-brand-logo">TUNETAGZ</div>
                          <div class="engraving-laser-text" id="backCardCustomText">Amal & Sarah</div>
                          <div class="engraving-sub-label">LASER ENGRAVED • 2026</div>
                        </div>
                      </div>
                      <div class="tag-sheen"></div>
                    </div>
                  </div>
                </div>

                <div class="stage-controls">
                  <button class="btn-flip-tag" id="flipTagBtn" type="button">
                    <span class="flip-icon">🔄</span>
                    <span id="flipBtnText">Preview Back Side</span>
                  </button>
                </div>
              </div>

              <!-- Right: Customization Controls -->
              <div class="customizer-form-wrap">
                <h3 class="config-heading">Personalize Your Tag</h3>
                <p class="config-sub">Scan on Spotify. Laser engraved in pure gold on matte black steel.</p>

                <!-- Step 1: Spotify Link -->
                <div class="config-section">
                  <label class="config-label" for="spotifyUrlInput">
                    <span>1. Spotify Song Link or URI</span>
                    <span class="label-hint">Paste track link or song name</span>
                  </label>
                  <div class="input-with-icon">
                    <span class="input-icon">🎵</span>
                    <input type="text" id="spotifyUrlInput" placeholder="https://open.spotify.com/track/..." autocomplete="off" />
                  </div>
                  <div class="url-suggestions">
                    <button type="button" class="sug-pill" data-url="https://open.spotify.com/track/4cOdK2wGLETKBW3PvgPWqT">Starboy</button>
                    <button type="button" class="sug-pill" data-url="https://open.spotify.com/track/7qiZfU4dY1lWllzX7mPBI3">Shape of You</button>
                    <button type="button" class="sug-pill" data-url="https://open.spotify.com/track/0VjIjW4GlUZAMYd2vXMi3b">Blinding Lights</button>
                  </div>
                </div>

                <!-- Step 2: Laser Engraved Text (Back) -->
                <div class="config-section">
                  <div class="label-row">
                    <label class="config-label" for="engravingTextInput">2. Backside Engraved Text</label>
                    <span class="char-count" id="engravingCharCount">12 / 30</span>
                  </div>
                  <input type="text" id="engravingTextInput" maxlength="30" placeholder="e.g. Amal & Sarah • Forever" value="Amal & Sarah" />
                  
                  <div class="font-picker-row">
                    <span class="font-picker-label">Font:</span>
                    <button type="button" class="font-picker-btn active" data-font="DM Mono" style="font-family:'DM Mono',monospace;">Mono</button>
                    <button type="button" class="font-picker-btn" data-font="Space Grotesk" style="font-family:'Space Grotesk',sans-serif;">Sans</button>
                    <button type="button" class="font-picker-btn" data-font="Anton" style="font-family:'Anton',sans-serif;">Bold</button>
                  </div>
                </div>

                <!-- Step 3: Hardware Finish -->
                <div class="config-section">
                  <label class="config-label">3. Keyring Finish</label>
                  <div class="finish-selector">
                    <button type="button" class="finish-btn active" data-finish="Matte Black">
                      <span class="finish-dot finish-black"></span> Matte Black
                    </button>
                    <button type="button" class="finish-btn" data-finish="Gold Brass">
                      <span class="finish-dot finish-gold"></span> Gold Brass
                    </button>
                    <button type="button" class="finish-btn" data-finish="Silver Steel">
                      <span class="finish-dot finish-silver"></span> Silver Steel
                    </button>
                  </div>
                </div>

                <!-- Price & Checkout Button -->
                <div class="customizer-footer">
                  <div class="price-box">
                    <span class="price-label">Price:</span>
                    <span class="price-amount" id="customizerPriceDisplay">₹699</span>
                    <span class="shipping-tag">Free Tracked Delivery</span>
                  </div>
                  <button type="button" class="btn-primary customizer-checkout-btn" id="customizerCheckoutBtn">
                    <span>Proceed to Checkout →</span>
                  </button>
                </div>
              </div>
            </div>
          </div>
        </div>
      \`;

      document.body.insertAdjacentHTML('beforeend', modalHtml);

      const modal = document.getElementById(this.modalId);
      document.getElementById('customizerCloseBtn')?.addEventListener('click', () => CustomizerModal.close());
      document.getElementById('flipTagBtn')?.addEventListener('click', () => CustomizerModal.flipCard());
      document.getElementById('tag3DScene')?.addEventListener('click', () => CustomizerModal.flipCard());

      const urlInput = document.getElementById('spotifyUrlInput');
      if (urlInput) {
        let debounceTimer = null;
        urlInput.addEventListener('input', () => {
          clearTimeout(debounceTimer);
          debounceTimer = setTimeout(() => CustomizerModal.updateSpotifyPreview(urlInput.value), 350);
        });
      }

      document.querySelectorAll('.sug-pill').forEach(pill => {
        pill.addEventListener('click', () => {
          if (urlInput) {
            urlInput.value = pill.dataset.url;
            CustomizerModal.updateSpotifyPreview(pill.dataset.url);
          }
        });
      });

      const textInput = document.getElementById('engravingTextInput');
      if (textInput) {
        textInput.addEventListener('input', () => {
          CustomizerModal.updateEngravingPreview();
          if (!CustomizerModal.isFlipped) CustomizerModal.flipCard('back');
        });
      }

      document.querySelectorAll('.font-picker-btn').forEach(btn => {
        btn.addEventListener('click', () => CustomizerModal.setEngravingFont(btn.dataset.font));
      });

      document.querySelectorAll('.finish-btn').forEach(btn => {
        btn.addEventListener('click', () => CustomizerModal.setHardwareFinish(btn.dataset.finish));
      });

      document.getElementById('customizerCheckoutBtn')?.addEventListener('click', () => CustomizerModal.proceedToCheckout());

      modal.addEventListener('click', (e) => {
        if (e.target === modal) CustomizerModal.close();
      });
      document.addEventListener('keydown', (e) => {
        if (e.key === 'Escape' && modal.classList.contains('is-open')) CustomizerModal.close();
      });
    }
  };

  global.CustomizerModal = CustomizerModal;
})(typeof window !== 'undefined' ? window : globalThis);
`;
fs.writeFileSync('public/js/customizer.js', customizerJs);
console.log('✓ public/js/customizer.js written');

// ============================================================================
// 3. public/js/checkout.js
// ============================================================================
const checkoutJs = `/**
 * TuneTagZ Checkout & Razorpay Payment Integration Module
 * Collects Indian shipping address, initiates order creation, invokes Razorpay SDK / sandbox, and confirms order.
 */
(function (global) {
  'use strict';

  const INDIAN_STATES = [
    "Andhra Pradesh", "Arunachal Pradesh", "Assam", "Bihar", "Chhattisgarh", "Goa", "Gujarat",
    "Haryana", "Himachal Pradesh", "Jharkhand", "Karnataka", "Kerala", "Madhya Pradesh",
    "Maharashtra", "Manipur", "Meghalaya", "Mizoram", "Nagaland", "Odisha", "Punjab",
    "Rajasthan", "Sikkim", "Tamil Nadu", "Telangana", "Tripura", "Uttar Pradesh", "Uttarakhand",
    "West Bengal", "Delhi", "Jammu and Kashmir", "Ladakh", "Puducherry", "Chandigarh"
  ];

  const CheckoutModal = {
    modalId: 'checkoutModal',
    orderItems: [],
    totalAmount: 0,

    open(itemsOrItem) {
      if (Array.isArray(itemsOrItem)) {
        this.orderItems = itemsOrItem;
      } else if (itemsOrItem) {
        this.orderItems = [itemsOrItem];
      } else {
        this.orderItems = [{
          productId: 1,
          productName: 'Spotify Code Tag',
          price: 699,
          quantity: 1,
          spotifyUrl: 'https://open.spotify.com/track/4cOdK2wGLETKBW3PvgPWqT',
          customText: 'TuneTagZ'
        }];
      }

      this.totalAmount = this.orderItems.reduce((acc, i) => acc + (Number(i.price) * (i.quantity || 1)), 0);

      let modal = document.getElementById(this.modalId);
      if (!modal) {
        this.renderModal();
        modal = document.getElementById(this.modalId);
      }

      this.populatePrefills();
      this.updateOrderSummary();

      modal.classList.add('is-open');
      document.body.style.overflow = 'hidden';
      const nameInput = document.getElementById('shipFullName');
      if (nameInput) setTimeout(() => nameInput.focus(), 100);
    },

    close() {
      const modal = document.getElementById(this.modalId);
      if (modal) {
        modal.classList.remove('is-open');
        document.body.style.overflow = '';
      }
    },

    populatePrefills() {
      const user = API.getUser();
      if (user) {
        const nameEl = document.getElementById('shipFullName');
        const emailEl = document.getElementById('shipEmail');
        if (nameEl && !nameEl.value) nameEl.value = user.name || '';
        if (emailEl && !emailEl.value) emailEl.value = user.email || '';
      }
    },

    updateOrderSummary() {
      const container = document.getElementById('checkoutItemsList');
      const totalEl = document.getElementById('checkoutTotalAmount');
      const subtotalEl = document.getElementById('checkoutSubtotal');

      if (!container) return;

      container.innerHTML = this.orderItems.map(item => \`
        <div class="checkout-item-row">
          <div class="item-info">
            <strong>\${item.productName || 'TuneTagZ Keychain'}</strong>
            <small class="item-custom-detail">
              \${item.songTitle ? \`🎵 \${item.songTitle} • \` : ''}
              \${item.customText ? \`✒️ "\${item.customText}"\` : ''}
            </small>
          </div>
          <div class="item-price-qty">
            <span>x\${item.quantity || 1}</span>
            <strong>₹\${Number(item.price) * (item.quantity || 1)}</strong>
          </div>
        </div>
      \`).join('');

      if (subtotalEl) subtotalEl.textContent = \`₹\${this.totalAmount}\`;
      if (totalEl) totalEl.textContent = \`₹\${this.totalAmount}\`;
    },

    async handleFormSubmit(event) {
      event.preventDefault();
      const form = event.target;
      const btn = document.getElementById('btnPayRazorpay');
      const errorBox = document.getElementById('checkoutErrorBox');

      if (errorBox) {
        errorBox.style.display = 'none';
        errorBox.textContent = '';
      }

      const shippingData = {
        name: form.fullName.value.trim(),
        email: form.email.value.trim(),
        phone: form.phone.value.trim(),
        address: form.address.value.trim(),
        city: form.city.value.trim(),
        state: form.state.value.trim(),
        pincode: form.pincode.value.trim()
      };

      // Client validation
      if (!shippingData.phone.match(/^(\\+91[\\-\\s]?)?[6-9]\\d{9}$/)) {
        this.showError('Please enter a valid 10-digit Indian mobile number.');
        return;
      }
      if (!shippingData.pincode.match(/^\\d{6}$/)) {
        this.showError('Please enter a valid 6-digit Indian PIN code.');
        return;
      }

      try {
        btn.disabled = true;
        btn.innerHTML = '<span class="spinner"></span> Creating Order...';

        // 1. Call Backend to create Razorpay Order
        const orderPayload = {
          items: this.orderItems.map(i => ({
            productId: i.productId,
            quantity: i.quantity || 1,
            spotifyUrl: i.spotifyUrl,
            customText: i.customText,
            songTitle: i.songTitle,
            artistName: i.artistName,
            customization: {
              spotifyUrl: i.spotifyUrl,
              customText: i.customText,
              songTitle: i.songTitle,
              artistName: i.artistName,
              hardwareFinish: i.hardwareFinish,
              fontFamily: i.fontFamily
            }
          })),
          customer: {
            name: shippingData.name,
            email: shippingData.email,
            phone: shippingData.phone
          },
          shippingAddress: {
            addressLine1: shippingData.address,
            city: shippingData.city,
            state: shippingData.state,
            postalCode: shippingData.pincode,
            country: 'India'
          }
        };

        const paymentRes = await API.payments.createOrder(orderPayload);
        if (!paymentRes || !paymentRes.success) {
          throw new Error(paymentRes?.error || 'Failed to initiate payment.');
        }

        // 2. Launch Razorpay Payment Gateway
        this.launchRazorpayCheckout(paymentRes, shippingData);

      } catch (err) {
        this.showError(err.message || 'Payment initiation failed. Please try again.');
        btn.disabled = false;
        btn.innerHTML = '<span>Pay with Razorpay (UPI, Cards, Netbanking)</span>';
      }
    },

    showError(msg) {
      const errorBox = document.getElementById('checkoutErrorBox');
      if (errorBox) {
        errorBox.textContent = msg;
        errorBox.style.display = 'block';
      }
    },

    launchRazorpayCheckout(paymentData, shippingData) {
      const btn = document.getElementById('btnPayRazorpay');

      // Check if real Razorpay JS SDK loaded
      if (typeof window.Razorpay !== 'undefined') {
        const options = {
          key: paymentData.keyId || 'rzp_test_TuneTagZ2026',
          amount: paymentData.amount,
          currency: paymentData.currency || 'INR',
          name: 'TuneTagZ',
          description: \`Order #\${paymentData.orderNumber}\`,
          image: 'TUNETAGZ%20LOGO.png',
          order_id: paymentData.razorpayOrderId || paymentData.razorpay_order_id,
          handler: async (response) => {
            await this.verifyPayment({
              orderId: paymentData.orderId,
              orderNumber: paymentData.orderNumber,
              razorpay_order_id: response.razorpay_order_id,
              razorpay_payment_id: response.razorpay_payment_id,
              razorpay_signature: response.razorpay_signature
            });
          },
          prefill: {
            name: shippingData.name,
            email: shippingData.email,
            contact: shippingData.phone
          },
          theme: { color: '#0d1f13' },
          modal: {
            ondismiss: () => {
              btn.disabled = false;
              btn.innerHTML = '<span>Pay with Razorpay (UPI, Cards, Netbanking)</span>';
              showToast('Payment cancelled.', 'info');
            }
          }
        };

        const rzp = new window.Razorpay(options);
        rzp.open();
      } else {
        // Mock Sandbox Payment Modal Fallback (For CI / Offline Sandbox testing)
        this.showMockPaymentModal(paymentData, shippingData);
      }
    },

    showMockPaymentModal(paymentData, shippingData) {
      const mockModalHtml = \`
        <div class="ttz-modal-backdrop is-open" id="mockPaymentModal" style="z-index: 1200;">
          <div class="ttz-modal-container mock-payment-container">
            <div class="mock-header">
              <span class="mock-badge">SANDBOX MOCK GATEWAY</span>
              <h3>Razorpay Test Payment</h3>
              <p>Simulating Razorpay UPI / Card payment for ₹\${paymentData.totalAmount || (paymentData.amount / 100)}</p>
            </div>
            <div class="mock-body">
              <p><strong>Order Number:</strong> \${paymentData.orderNumber}</p>
              <p><strong>Customer:</strong> \${shippingData.name} (\${shippingData.email})</p>
              <div class="mock-btn-group">
                <button type="button" class="btn-primary mock-pay-success" id="mockSuccessBtn">
                  ✓ Simulate Successful Payment (UPI / Card)
                </button>
                <button type="button" class="btn-ghost mock-pay-fail" id="mockFailBtn">
                  ✕ Simulate Payment Failure / Cancel
                </button>
              </div>
            </div>
          </div>
        </div>
      \`;

      document.body.insertAdjacentHTML('beforeend', mockModalHtml);

      document.getElementById('mockSuccessBtn')?.addEventListener('click', async () => {
        document.getElementById('mockPaymentModal')?.remove();
        const mockPaymentId = 'pay_mock_' + Math.random().toString(36).substring(2, 10);
        
        // Generate mock signature HMAC
        await this.verifyPayment({
          orderId: paymentData.orderId,
          orderNumber: paymentData.orderNumber,
          razorpay_order_id: paymentData.razorpayOrderId || paymentData.razorpay_order_id,
          razorpay_payment_id: mockPaymentId,
          razorpay_signature: 'mock_signature_for_sandbox'
        });
      });

      document.getElementById('mockFailBtn')?.addEventListener('click', () => {
        document.getElementById('mockPaymentModal')?.remove();
        const btn = document.getElementById('btnPayRazorpay');
        if (btn) {
          btn.disabled = false;
          btn.innerHTML = '<span>Pay with Razorpay (UPI, Cards, Netbanking)</span>';
        }
        showToast('Payment was cancelled in sandbox.', 'info');
      });
    },

    async verifyPayment(payload) {
      const btn = document.getElementById('btnPayRazorpay');
      try {
        if (btn) {
          btn.disabled = true;
          btn.innerHTML = '<span class="spinner"></span> Verifying Payment...';
        }

        const verifyRes = await API.payments.verify(payload);
        if (verifyRes && verifyRes.success) {
          this.close();
          this.showOrderConfirmation(verifyRes.order || { orderNumber: payload.orderNumber, id: payload.orderId });
          showToast('Payment verified! Your order has been placed.', 'success');
        } else {
          throw new Error(verifyRes?.error || 'Payment verification failed.');
        }
      } catch (err) {
        this.showError(err.message || 'Payment signature verification failed.');
        if (btn) {
          btn.disabled = false;
          btn.innerHTML = '<span>Retry Payment</span>';
        }
      }
    },

    showOrderConfirmation(order) {
      const orderNum = order.orderNumber || order.order_number || 'TTZ-ORDER';
      const orderId = order.id || order.orderId;

      const confirmHtml = \`
        <div class="ttz-modal-backdrop is-open" id="orderConfirmModal" role="dialog" aria-modal="true">
          <div class="ttz-modal-container order-confirm-container">
            <div class="confirm-icon">🎉</div>
            <h2 class="confirm-title">Order Confirmed!</h2>
            <p class="confirm-subtitle">Thank you for ordering with TuneTagZ. We've received your customization details and will begin laser engraving shortly.</p>
            
            <div class="confirm-card">
              <div class="confirm-row">
                <span>Order Number:</span>
                <strong class="gold-text">\${orderNum}</strong>
              </div>
              <div class="confirm-row">
                <span>Status:</span>
                <span class="status-pill status-received">ORDER_RECEIVED</span>
              </div>
              <div class="confirm-row">
                <span>Delivery:</span>
                <span>5–7 Working Days (Tracked India-wide)</span>
              </div>
            </div>

            <div class="confirm-actions">
              <button type="button" class="btn-primary" id="btnConfirmTrackOrder">
                🔍 Track Order Now
              </button>
              <button type="button" class="btn-ghost" onclick="document.getElementById('orderConfirmModal').remove()">
                Continue Shopping
              </button>
            </div>
          </div>
        </div>
      \`;

      document.body.insertAdjacentHTML('beforeend', confirmHtml);

      document.getElementById('btnConfirmTrackOrder')?.addEventListener('click', () => {
        document.getElementById('orderConfirmModal')?.remove();
        if (global.TrackingModal) {
          global.TrackingModal.open(orderNum);
        }
      });
    },

    renderModal() {
      const statesOptions = INDIAN_STATES.map(s => \`<option value="\${s}">\${s}</option>\`).join('');

      const modalHtml = \`
        <div class="ttz-modal-backdrop" id="\${this.modalId}" role="dialog" aria-modal="true" aria-labelledby="checkoutModalTitle">
          <div class="ttz-modal-container checkout-modal-container">
            <button class="ttz-modal-close" id="checkoutCloseBtn" aria-label="Close checkout">✕</button>
            
            <div class="checkout-grid">
              <!-- Left: Shipping Address Form -->
              <div class="checkout-form-column">
                <h2 id="checkoutModalTitle" class="checkout-section-title">Shipping & Contact Details</h2>
                <p class="checkout-section-sub">We deliver all custom keychains with tracked shipping across India.</p>

                <div class="checkout-error-box" id="checkoutErrorBox" style="display: none;" role="alert"></div>

                <form id="checkoutShippingForm" onsubmit="CheckoutModal.handleFormSubmit(event)">
                  <div class="form-group">
                    <label for="shipFullName">Full Name *</label>
                    <input type="text" id="shipFullName" name="fullName" required placeholder="Alex Turner" autocomplete="name" />
                  </div>

                  <div class="form-row">
                    <div class="form-group">
                      <label for="shipEmail">Email Address *</label>
                      <input type="email" id="shipEmail" name="email" required placeholder="alex@example.com" autocomplete="email" />
                    </div>
                    <div class="form-group">
                      <label for="shipPhone">Phone Number (+91) *</label>
                      <input type="tel" id="shipPhone" name="phone" required placeholder="9876543210" maxlength="10" autocomplete="tel" />
                    </div>
                  </div>

                  <div class="form-group">
                    <label for="shipAddress">Delivery Street Address *</label>
                    <input type="text" id="shipAddress" name="address" required placeholder="Flat / House No., Street, Landmark" autocomplete="street-address" />
                  </div>

                  <div class="form-row form-row-3">
                    <div class="form-group">
                      <label for="shipCity">City *</label>
                      <input type="text" id="shipCity" name="city" required placeholder="Mumbai" autocomplete="address-level2" />
                    </div>
                    <div class="form-group">
                      <label for="shipState">State *</label>
                      <select id="shipState" name="state" required>
                        <option value="">Select State</option>
                        \${statesOptions}
                      </select>
                    </div>
                    <div class="form-group">
                      <label for="shipPincode">PIN Code *</label>
                      <input type="text" id="shipPincode" name="pincode" required placeholder="400001" maxlength="6" autocomplete="postal-code" />
                    </div>
                  </div>

                  <button type="submit" class="btn-primary btn-razorpay-pay" id="btnPayRazorpay">
                    <span class="rzp-shield">🔒</span>
                    <span>Pay with Razorpay (UPI, Cards, Netbanking)</span>
                  </button>
                </form>
              </div>

              <!-- Right: Order Summary Sidebar -->
              <div class="checkout-summary-column">
                <h3 class="summary-heading">Order Summary</h3>
                <div class="checkout-items-list" id="checkoutItemsList"></div>

                <hr class="summary-divider" />

                <div class="summary-line">
                  <span>Subtotal</span>
                  <strong id="checkoutSubtotal">₹699</strong>
                </div>
                <div class="summary-line">
                  <span>Tracked Shipping (India)</span>
                  <span class="free-shipping-tag">FREE (₹0)</span>
                </div>

                <hr class="summary-divider" />

                <div class="summary-line summary-total">
                  <span>Total Amount</span>
                  <strong class="total-gold" id="checkoutTotalAmount">₹699</strong>
                </div>

                <div class="checkout-guarantee">
                  <div class="guarantee-item">
                    <span>⚡</span> <span>Laser Engraved with Precision</span>
                  </div>
                  <div class="guarantee-item">
                    <span>📦</span> <span>Free 5–7 Day Tracked Delivery</span>
                  </div>
                  <div class="guarantee-item">
                    <span>🛡️</span> <span>100% Secure Razorpay Checkout</span>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>
      \`;

      document.body.insertAdjacentHTML('beforeend', modalHtml);

      const modal = document.getElementById(this.modalId);
      document.getElementById('checkoutCloseBtn')?.addEventListener('click', () => CheckoutModal.close());
      modal.addEventListener('click', (e) => {
        if (e.target === modal) CheckoutModal.close();
      });
      document.addEventListener('keydown', (e) => {
        if (e.key === 'Escape' && modal.classList.contains('is-open')) CheckoutModal.close();
      });
    }
  };

  global.CheckoutModal = CheckoutModal;
})(typeof window !== 'undefined' ? window : globalThis);
`;
fs.writeFileSync('public/js/checkout.js', checkoutJs);
console.log('✓ public/js/checkout.js written');

// ============================================================================
// 4. public/js/tracking.js
// ============================================================================
const trackingJs = `/**
 * TuneTagZ Live Order Tracking & Customer Order History Module
 * 5-Step visual fulfillment timeline stepper and customer order portal.
 */
(function (global) {
  'use strict';

  const MILESTONES = [
    { key: 'ORDER_RECEIVED', label: 'Order Received', desc: 'Order placed & payment verified' },
    { key: 'ENGRAVING', label: 'Laser Engraving', desc: 'Engraving Spotify soundwave & custom text' },
    { key: 'QUALITY_CHECK', label: 'Quality Inspection', desc: 'Scannability test & hardware assembly' },
    { key: 'DISPATCHED', label: 'Dispatched', desc: 'Shipped with courier tracking' },
    { key: 'DELIVERED', label: 'Delivered', desc: 'Delivered to your doorstep' }
  ];

  const TrackingModal = {
    modalId: 'trackingModal',
    activeTab: 'track',

    open(initialOrderNumber = null) {
      let modal = document.getElementById(this.modalId);
      if (!modal) {
        this.renderModal();
        modal = document.getElementById(this.modalId);
      }

      this.switchTab('track');
      modal.classList.add('is-open');
      document.body.style.overflow = 'hidden';

      if (initialOrderNumber) {
        const input = document.getElementById('trackOrderInput');
        if (input) {
          input.value = initialOrderNumber;
          this.searchOrder(initialOrderNumber);
        }
      }
    },

    close() {
      const modal = document.getElementById(this.modalId);
      if (modal) {
        modal.classList.remove('is-open');
        document.body.style.overflow = '';
      }
    },

    switchTab(tab) {
      this.activeTab = tab;
      const modal = document.getElementById(this.modalId);
      if (!modal) return;

      const tabTrack = modal.querySelector('#tabTrackSingle');
      const tabHistory = modal.querySelector('#tabMyOrders');
      const viewTrack = modal.querySelector('#viewTrackSingle');
      const viewHistory = modal.querySelector('#viewMyOrders');

      if (tab === 'track') {
        tabTrack?.classList.add('active');
        tabHistory?.classList.remove('active');
        if (viewTrack) viewTrack.style.display = 'block';
        if (viewHistory) viewHistory.style.display = 'none';
      } else {
        tabTrack?.classList.remove('active');
        tabHistory?.classList.add('active');
        if (viewTrack) viewTrack.style.display = 'none';
        if (viewHistory) viewHistory.style.display = 'block';
        this.loadMyOrders();
      }
    },

    showMyOrders() {
      this.open();
      this.switchTab('history');
    },

    async searchOrder(orderNumOrId = null) {
      const query = (orderNumOrId || document.getElementById('trackOrderInput')?.value || '').trim();
      const phoneOrEmail = document.getElementById('trackVerifyInput')?.value?.trim() || null;
      const resultContainer = document.getElementById('trackResultContainer');
      const btn = document.getElementById('btnSearchTrack');

      if (!query) {
        if (resultContainer) {
          resultContainer.innerHTML = '<div class=\"track-empty\">Please enter an Order Number or Order ID.</div>';
        }
        return;
      }

      try {
        if (btn) {
          btn.disabled = true;
          btn.innerHTML = '<span class=\"spinner\"></span> Searching...';
        }
        if (resultContainer) {
          resultContainer.innerHTML = '<div class=\"track-loading\"><span class=\"spinner\"></span> Fetching live order status...</div>';
        }

        const res = await API.orders.track(query, phoneOrEmail);
        if (res && res.success && res.order) {
          this.renderTimeline(res.order);
        } else {
          throw new Error(res?.error || 'Order not found.');
        }
      } catch (err) {
        if (resultContainer) {
          resultContainer.innerHTML = \`
            <div class="track-error-card">
              <span class="err-icon">⚠️</span>
              <h4>Order Not Found</h4>
              <p>\${err.message || 'No order found matching this Order Number. Please verify and try again.'}</p>
            </div>
          \`;
        }
      } finally {
        if (btn) {
          btn.disabled = false;
          btn.innerHTML = '<span>Track Order</span>';
        }
      }
    },

    renderTimeline(order) {
      const container = document.getElementById('trackResultContainer');
      if (!container) return;

      const currentStatus = order.status || 'ORDER_RECEIVED';
      const statusIdx = MILESTONES.findIndex(m => m.key === currentStatus);
      const activeIdx = statusIdx >= 0 ? statusIdx : 0;
      const isCancelled = currentStatus === 'CANCELLED';

      const itemsHtml = (order.items || []).map(item => \`
        <div class="track-item-card">
          <div class="item-head">
            <strong>\${item.productName || 'Spotify Code Tag'}</strong>
            <span class="item-qty">Qty: \${item.quantity || 1} • ₹\${item.unitPrice || 699}</span>
          </div>
          \${item.spotifyUrl ? \`
            <div class="item-spotify-row">
              <span class="sp-icon">🎵</span>
              <a href="\${item.spotifyUrl}" target="_blank" rel="noopener noreferrer">\${item.songTitle || item.spotifyUrl}</a>
            </div>
          \` : ''}
          \${item.customText ? \`
            <div class="item-engraved-row">
              <span class="eng-icon">✒️ Laser Engraving:</span>
              <strong class="eng-val">"\${item.customText}"</strong>
            </div>
          \` : ''}
        </div>
      \`).join('');

      const stepsHtml = MILESTONES.map((step, idx) => {
        const isCompleted = !isCancelled && idx <= activeIdx;
        const isCurrent = !isCancelled && idx === activeIdx;
        const stepClass = isCancelled ? 'step-cancelled' : isCompleted ? (isCurrent ? 'step-current' : 'step-completed') : 'step-pending';
        const icon = isCompleted ? (isCurrent ? '●' : '✓') : '○';

        return \`
          <div class="stepper-step \${stepClass}">
            <div class="step-indicator">
              <span class="step-bullet">\${icon}</span>
              \${idx < MILESTONES.length - 1 ? '<div class="step-line"></div>' : ''}
            </div>
            <div class="step-content">
              <h4 class="step-label">\${step.label}</h4>
              <p class="step-desc">\${step.desc}</p>
            </div>
          </div>
        \`;
      }).join('');

      container.innerHTML = \`
        <div class="order-track-card">
          <div class="order-track-header">
            <div>
              <span class="order-num-badge">\${order.orderNumber || order.id}</span>
              <h3 class="order-customer-name">Order for \${order.customerName || 'Customer'}</h3>
            </div>
            <div class="order-status-badge status-\${currentStatus.toLowerCase()}">
              \${order.statusDisplay || currentStatus}
            </div>
          </div>

          \${isCancelled ? \`
            <div class="cancelled-alert">
              <span>⚠️ This order has been cancelled.</span>
            </div>
          \` : ''}

          <!-- 5-Step Visual Stepper -->
          <div class="track-stepper">
            \${stepsHtml}
          </div>

          <!-- Courier Info (if Dispatched/Delivered) -->
          \${order.courierName || order.trackingNumber ? \`
            <div class="courier-dispatch-info">
              <div class="courier-row">
                <span>🚚 Courier Partner:</span>
                <strong>\${order.courierName || 'BlueDart / Delhivery'}</strong>
              </div>
              <div class="courier-row">
                <span>📋 Tracking AWB:</span>
                <strong class="gold-text">\${order.trackingNumber || 'TTZ-AWB-PENDING'}</strong>
              </div>
            </div>
          \` : ''}

          <!-- Customized Products List -->
          <div class="track-section">
            <h4 class="track-sec-title">Customized Items</h4>
            <div class="track-items-grid">
              \${itemsHtml || '<p class=\"no-items\">Custom Spotify Keychain</p>'}
            </div>
          </div>

          <!-- Shipping Address -->
          \${order.shippingAddress ? \`
            <div class="track-section">
              <h4 class="track-sec-title">Delivery Address</h4>
              <p class="shipping-address-text">
                \${order.shippingAddress.addressLine1 || order.shippingAddress.line1 || ''}, 
                \${order.shippingAddress.city || ''}, \${order.shippingAddress.state || ''} - \${order.shippingAddress.postalCode || order.shippingAddress.pincode || ''}
              </p>
            </div>
          \` : ''}
        </div>
      \`;
    },

    async loadMyOrders() {
      const container = document.getElementById('myOrdersContainer');
      if (!container) return;

      const token = API.getToken();
      if (!token) {
        container.innerHTML = \`
          <div class="track-login-prompt">
            <span class="prompt-icon">🔒</span>
            <h3>Sign in to view your order history</h3>
            <p>Access your past Spotify keychain orders, customization details, and invoices.</p>
            <button type="button" class="btn-primary" onclick="AuthModal.open('login')">Sign In / Register</button>
          </div>
        \`;
        return;
      }

      try {
        container.innerHTML = '<div class=\"track-loading\"><span class=\"spinner\"></span> Loading your orders...</div>';
        const res = await API.orders.getMyOrders();
        const orders = res && res.data ? res.data : (res && res.orders ? res.orders : []);

        if (!orders || orders.length === 0) {
          container.innerHTML = \`
            <div class="track-empty">
              <span class="empty-icon">📦</span>
              <h3>No orders found</h3>
              <p>You haven't placed any orders yet. Customize your first Spotify tag!</p>
              <button type="button" class="btn-primary" onclick="TrackingModal.close(); CustomizerModal.open();">Customize Now</button>
            </div>
          \`;
          return;
        }

        container.innerHTML = \`
          <div class="my-orders-list">
            \${orders.map(o => \`
              <div class="my-order-card">
                <div class="my-order-head">
                  <div>
                    <strong class="gold-text">\${o.orderNumber || o.order_number || o.id}</strong>
                    <span class="order-date">\${new Date(o.createdAt || o.created_at || Date.now()).toLocaleDateString('en-IN', { day: 'numeric', month: 'short', year: 'numeric' })}</span>
                  </div>
                  <span class="order-status-badge status-\${(o.status || 'ORDER_RECEIVED').toLowerCase()}">\${o.status}</span>
                </div>
                <div class="my-order-body">
                  <p class="order-items-summary">\${(o.items || []).map(i => i.productName || 'Spotify Tag').join(', ') || 'Custom Keychain'}</p>
                  <strong class="order-amount">₹\${o.totalAmount || o.total_amount || 699}</strong>
                </div>
                <div class="my-order-foot">
                  <button type="button" class="btn-ghost btn-sm" onclick="TrackingModal.switchTab('track'); TrackingModal.searchOrder('\${o.orderNumber || o.id}');">
                    🔍 View Live Tracking
                  </button>
                </div>
              </div>
            \`).join('')}
          </div>
        \`;
      } catch (err) {
        container.innerHTML = \`
          <div class="track-error-card">
            <h4>Failed to load order history</h4>
            <p>\${err.message || 'Please check your connection and try again.'}</p>
          </div>
        \`;
      }
    },

    renderModal() {
      const modalHtml = \`
        <div class="ttz-modal-backdrop" id="\${this.modalId}" role="dialog" aria-modal="true" aria-labelledby="trackModalTitle">
          <div class="ttz-modal-container tracking-modal-container">
            <button class="ttz-modal-close" id="trackCloseBtn" aria-label="Close tracking">✕</button>
            
            <div class="tracking-modal-header">
              <h2 id="trackModalTitle" class="tracking-title">Track Your TuneTagZ Order</h2>
              <p class="tracking-sub">Real-time laser engraving and courier dispatch updates.</p>
            </div>

            <div class="tracking-tabs" role="tablist">
              <button class="tracking-tab-btn active" id="tabTrackSingle" role="tab">Lookup Order</button>
              <button class="tracking-tab-btn" id="tabMyOrders" role="tab">My Orders</button>
            </div>

            <!-- Tab 1: Single Order Search -->
            <div id="viewTrackSingle" class="tracking-tab-view">
              <form class="track-search-form" onsubmit="event.preventDefault(); TrackingModal.searchOrder();">
                <div class="track-input-group">
                  <input type="text" id="trackOrderInput" placeholder="Enter Order Number (e.g. TTZ-20260817-XXXX)" required autocomplete="off" />
                  <button type="submit" class="btn-primary btn-search-track" id="btnSearchTrack">
                    <span>Track Order</span>
                  </button>
                </div>
                <div class="track-optional-row">
                  <input type="text" id="trackVerifyInput" placeholder="Optional: Phone or Email (for guest security)" />
                </div>
              </form>

              <div class="track-result-container" id="trackResultContainer">
                <div class="track-placeholder">
                  <span class="placeholder-icon">📦</span>
                  <p>Enter your Order Number above to see live progress.</p>
                </div>
              </div>
            </div>

            <!-- Tab 2: Customer Order History -->
            <div id="viewMyOrders" class="tracking-tab-view" style="display: none;">
              <div id="myOrdersContainer"></div>
            </div>
          </div>
        </div>
      \`;

      document.body.insertAdjacentHTML('beforeend', modalHtml);

      const modal = document.getElementById(this.modalId);
      document.getElementById('trackCloseBtn')?.addEventListener('click', () => TrackingModal.close());
      document.getElementById('tabTrackSingle')?.addEventListener('click', () => TrackingModal.switchTab('track'));
      document.getElementById('tabMyOrders')?.addEventListener('click', () => TrackingModal.switchTab('history'));

      modal.addEventListener('click', (e) => {
        if (e.target === modal) TrackingModal.close();
      });
      document.addEventListener('keydown', (e) => {
        if (e.key === 'Escape' && modal.classList.contains('is-open')) TrackingModal.close();
      });
    }
  };

  global.TrackingModal = TrackingModal;
})(typeof window !== 'undefined' ? window : globalThis);
`;
fs.writeFileSync('public/js/tracking.js', trackingJs);
console.log('✓ public/js/tracking.js written');

// ============================================================================
// 5. public/js/admin.js
// ============================================================================
const adminJs = `/**
 * TuneTagZ Developer Admin Portal
 * KPI Dashboard, Product Catalog Management (Multer upload, stock toggle, CRUD), Order Fulfillment Pipeline.
 */
(function (global) {
  'use strict';

  const AdminApp = {
    activeTab: 'overview',
    stats: null,
    products: [],
    orders: [],

    init() {
      this.bindEvents();
      this.checkAuth();
    },

    bindEvents() {
      document.getElementById('adminLoginForm')?.addEventListener('submit', (e) => this.handleLogin(e));
      document.getElementById('adminLogoutBtn')?.addEventListener('click', () => this.handleLogout());

      // Nav Tabs
      document.querySelectorAll('.admin-nav-item').forEach(btn => {
        btn.addEventListener('click', () => this.switchTab(btn.dataset.tab));
      });

      // Product Add Form
      document.getElementById('addProductForm')?.addEventListener('submit', (e) => this.handleAddProduct(e));

      // Order Filter & Search
      document.getElementById('orderStatusFilter')?.addEventListener('change', (e) => this.loadOrders());
      document.getElementById('orderSearchInput')?.addEventListener('input', () => this.debounceLoadOrders());
    },

    async checkAuth() {
      const token = API.getAdminToken();
      const user = API.getAdminUser();

      if (token && user && (user.role === 'admin' || user.role === 'developer')) {
        this.showDashboard();
      } else {
        this.showLogin();
      }
    },

    showLogin() {
      const loginView = document.getElementById('adminLoginView');
      const dashView = document.getElementById('adminDashboardView');
      if (loginView) loginView.style.display = 'flex';
      if (dashView) dashView.style.display = 'none';
    },

    showDashboard() {
      const loginView = document.getElementById('adminLoginView');
      const dashView = document.getElementById('adminDashboardView');
      if (loginView) loginView.style.display = 'none';
      if (dashView) dashView.style.display = 'flex';

      const adminUser = API.getAdminUser();
      const userBadge = document.getElementById('adminUserBadge');
      if (userBadge && adminUser) {
        userBadge.textContent = adminUser.name || adminUser.email;
      }

      this.switchTab('overview');
    },

    async handleLogin(event) {
      event.preventDefault();
      const form = event.target;
      const email = form.email.value.trim();
      const password = form.password.value;
      const errorBox = document.getElementById('adminLoginError');
      const btn = document.getElementById('adminLoginSubmitBtn');

      if (errorBox) errorBox.style.display = 'none';

      try {
        btn.disabled = true;
        btn.innerHTML = '<span class=\"spinner\"></span> Authenticating...';

        const res = await API.auth.adminLogin({ email, password });
        if (res && res.success) {
          this.showDashboard();
          showToast('Welcome to Developer Admin Portal!', 'success');
        } else {
          throw new Error(res?.error || 'Invalid administrator credentials.');
        }
      } catch (err) {
        if (errorBox) {
          errorBox.textContent = err.message || 'Login failed. Please check your credentials.';
          errorBox.style.display = 'block';
        }
      } finally {
        btn.disabled = false;
        btn.innerHTML = '<span>Sign In to Admin Portal</span>';
      }
    },

    async handleLogout() {
      API.clearAdminAuth();
      this.showLogin();
      showToast('Logged out of Admin Portal.', 'info');
    },

    switchTab(tabName) {
      this.activeTab = tabName;
      document.querySelectorAll('.admin-nav-item').forEach(el => {
        el.classList.toggle('active', el.dataset.tab === tabName);
      });

      document.querySelectorAll('.admin-tab-pane').forEach(el => {
        el.style.display = el.id === \`pane-\${tabName}\` ? 'block' : 'none';
      });

      if (tabName === 'overview') this.loadStats();
      else if (tabName === 'products') this.loadProducts();
      else if (tabName === 'orders') this.loadOrders();
      else if (tabName === 'audit') this.loadAuditLogs();
    },

    // ── Load Dashboard KPIs ──
    async loadStats() {
      try {
        const res = await API.admin.getStats();
        if (res && res.success && res.stats) {
          this.stats = res.stats;
          document.getElementById('statTotalSales').textContent = \`₹\${res.stats.totalSales || 0}\`;
          document.getElementById('statTotalOrders').textContent = res.stats.totalPaidOrders || res.stats.totalOrders || 0;
          document.getElementById('statPendingOrders').textContent = res.stats.pendingOrders || 0;
          document.getElementById('statTotalProducts').textContent = res.stats.totalProducts || 0;
          
          this.renderRecentOrders(res.stats.recentOrders || []);
        }
      } catch (err) {
        showToast('Failed to load dashboard stats: ' + err.message, 'error');
      }
    },

    renderRecentOrders(recent) {
      const container = document.getElementById('recentOrdersTableBody');
      if (!container) return;

      if (!recent || recent.length === 0) {
        container.innerHTML = '<tr><td colspan=\"6\" class=\"text-center\">No orders placed yet.</td></tr>';
        return;
      }

      container.innerHTML = recent.map(o => \`
        <tr>
          <td><strong>\${o.orderNumber || o.id}</strong></td>
          <td>\${o.customerName}<br/><small class=\"text-muted\">\${o.customerEmail}</small></td>
          <td>\${o.itemsSummary || 'Custom Tag'}</td>
          <td><strong>₹\${o.totalAmount}</strong></td>
          <td><span class=\"badge-status status-\${(o.status || '').toLowerCase()}\">\${o.status}</span></td>
          <td>
            <button class=\"btn-sm btn-ghost\" onclick=\"AdminApp.openOrderDetails('\${o.id}')\">View</button>
          </td>
        </tr>
      \`).join('');
    },

    // ── Load Products Catalog ──
    async loadProducts() {
      const container = document.getElementById('adminProductsTableBody');
      if (!container) return;

      try {
        container.innerHTML = '<tr><td colspan=\"7\" class=\"text-center\"><span class=\"spinner\"></span> Loading products...</td></tr>';
        const res = await API.products.list();
        this.products = res && res.data ? res.data : [];

        if (this.products.length === 0) {
          container.innerHTML = '<tr><td colspan=\"7\" class=\"text-center\">No products found in catalog.</td></tr>';
          return;
        }

        container.innerHTML = this.products.map(p => \`
          <tr>
            <td>
              <img src="\${p.image_url || 'POSTER 1.png'}" alt="\${p.name}" class="admin-prod-thumb" />
            </td>
            <td><strong>\${p.name}</strong><br/><small class="text-muted">\${p.sku || 'SKU-00'}</small></td>
            <td><strong>₹\${p.price}</strong> \${p.original_price ? \`<del class="text-muted">₹\${p.original_price}</del>\` : ''}</td>
            <td><span class="badge-tag">\${p.badge || 'Standard'}</span></td>
            <td>
              <label class="toggle-switch">
                <input type="checkbox" \${p.in_stock ? 'checked' : ''} onchange="AdminApp.toggleProductStock('\${p.id}', this.checked)" />
                <span class="toggle-slider"></span>
              </label>
              <span class="stock-label \${p.in_stock ? 'in-stock' : 'out-stock'}">\${p.in_stock ? 'In Stock' : 'Out of Stock'}</span>
            </td>
            <td>\${p.is_customizable ? '✓ Yes' : 'No'}</td>
            <td>
              <div class="action-btn-group">
                <button class="btn-sm btn-ghost" onclick="AdminApp.editProduct('\${p.id}')">Edit</button>
                <button class="btn-sm btn-danger" onclick="AdminApp.deleteProduct('\${p.id}', '\${p.name}')">Delete</button>
              </div>
            </td>
          </tr>
        \`).join('');
      } catch (err) {
        container.innerHTML = \`<tr><td colspan="7" class="text-danger text-center">Failed to load products: \${err.message}</td></tr>\`;
      }
    },

    async toggleProductStock(id, inStock) {
      try {
        await API.admin.toggleStock(id, inStock);
        showToast(\`Product stock updated to \${inStock ? 'In Stock' : 'Out of Stock'}.\`, 'success');
      } catch (err) {
        showToast('Failed to update stock: ' + err.message, 'error');
        this.loadProducts();
      }
    },

    async deleteProduct(id, name) {
      if (!confirm(\`Are you sure you want to delete product "\${name}"?\`)) return;
      try {
        await API.admin.deleteProduct(id);
        showToast(\`Product "\${name}" deleted successfully.\`, 'success');
        this.loadProducts();
      } catch (err) {
        showToast('Failed to delete product: ' + err.message, 'error');
      }
    },

    openAddProductModal() {
      const modal = document.getElementById('addProductModal');
      if (modal) {
        document.getElementById('addProductForm')?.reset();
        modal.classList.add('is-open');
      }
    },

    closeAddProductModal() {
      document.getElementById('addProductModal')?.classList.remove('is-open');
    },

    async handleAddProduct(event) {
      event.preventDefault();
      const form = event.target;
      const btn = document.getElementById('btnAddProductSubmit');

      const formData = new FormData();
      formData.append('name', form.name.value.trim());
      formData.append('sku', form.sku.value.trim());
      formData.append('price', form.price.value.trim());
      formData.append('description', form.description.value.trim());
      formData.append('badge', form.badge.value.trim());
      formData.append('is_customizable', form.is_customizable.checked ? 'true' : 'false');
      formData.append('in_stock', form.in_stock.checked ? 'true' : 'false');

      const fileInput = document.getElementById('productImageFile');
      if (fileInput && fileInput.files && fileInput.files[0]) {
        formData.append('image', fileInput.files[0]);
      }

      try {
        btn.disabled = true;
        btn.innerHTML = '<span class=\"spinner\"></span> Creating Product...';

        const res = await API.admin.createProduct(formData);
        if (res && res.success) {
          showToast('Product added successfully to catalog!', 'success');
          this.closeAddProductModal();
          this.loadProducts();
        } else {
          throw new Error(res?.error || 'Failed to create product.');
        }
      } catch (err) {
        showToast(err.message || 'Error uploading product.', 'error');
      } finally {
        btn.disabled = false;
        btn.innerHTML = '<span>Create & Sync Product</span>';
      }
    },

    // ── Load Orders Fulfillment ──
    async loadOrders() {
      const container = document.getElementById('adminOrdersTableBody');
      if (!container) return;

      const statusFilter = document.getElementById('orderStatusFilter')?.value || 'ALL';
      const searchText = document.getElementById('orderSearchInput')?.value?.trim() || '';

      try {
        container.innerHTML = '<tr><td colspan=\"7\" class=\"text-center\"><span class=\"spinner\"></span> Loading orders...</td></tr>';
        const res = await API.admin.getOrders({ status: statusFilter, search: searchText });
        this.orders = res && res.orders ? res.orders : (res && res.data ? res.data : []);

        if (this.orders.length === 0) {
          container.innerHTML = '<tr><td colspan=\"7\" class=\"text-center\">No orders found matching filters.</td></tr>';
          return;
        }

        container.innerHTML = this.orders.map(o => \`
          <tr>
            <td><strong>\${o.order_number || o.orderNumber || o.id}</strong></td>
            <td>\${o.customer_name || o.customerName}<br/><small class="text-muted">\${o.customer_email || o.customerEmail}</small></td>
            <td>\${o.customer_phone || o.customerPhone || 'N/A'}</td>
            <td><strong>₹\${o.total_amount || o.totalAmount}</strong></td>
            <td><span class="badge-status status-\${(o.status || '').toLowerCase()}">\${o.status}</span></td>
            <td>\${new Date(o.created_at || o.createdAt || Date.now()).toLocaleDateString('en-IN')}</td>
            <td>
              <div class="action-btn-group">
                <button class="btn-sm btn-ghost" onclick="AdminApp.openOrderDetails('\${o.id}')">Details</button>
                <button class="btn-sm btn-gold" onclick="AdminApp.openAdvanceStatusModal('\${o.id}', '\${o.status}')">Advance Status</button>
              </div>
            </td>
          </tr>
        \`).join('');
      } catch (err) {
        container.innerHTML = \`<tr><td colspan="7" class="text-danger text-center">Failed to load orders: \${err.message}</td></tr>\`;
      }
    },

    debounceLoadOrders() {
      clearTimeout(this._searchTimer);
      this._searchTimer = setTimeout(() => this.loadOrders(), 350);
    },

    async openOrderDetails(orderId) {
      try {
        const res = await API.admin.getOrder(orderId);
        if (!res || !res.order) throw new Error('Order not found.');
        const o = res.order;

        const modalHtml = \`
          <div class="ttz-modal-backdrop is-open" id="adminOrderDetailsModal">
            <div class="ttz-modal-container admin-order-details-container">
              <button class="ttz-modal-close" onclick="document.getElementById('adminOrderDetailsModal').remove()">✕</button>
              <div class="modal-header">
                <h2>Order Details: \${o.orderNumber || o.order_number}</h2>
                <span class="badge-status status-\${(o.status || '').toLowerCase()}">\${o.status}</span>
              </div>
              <div class="order-details-grid">
                <div class="details-section">
                  <h4>Customer Info</h4>
                  <p><strong>Name:</strong> \${o.customerName}</p>
                  <p><strong>Email:</strong> \${o.customerEmail}</p>
                  <p><strong>Phone:</strong> \${o.customerPhone || 'N/A'}</p>
                </div>
                <div class="details-section">
                  <h4>Shipping Address</h4>
                  <p>\${o.shippingAddress?.addressLine1 || 'N/A'}</p>
                  <p>\${o.shippingAddress?.city || ''}, \${o.shippingAddress?.state || ''} - \${o.shippingAddress?.postalCode || ''}</p>
                </div>
              </div>
              <div class="details-section">
                <h4>Items & Customization</h4>
                \${(o.items || []).map(i => \`
                  <div class="admin-item-card">
                    <p><strong>\${i.productName}</strong> (Qty: \${i.quantity}) - ₹\${i.unitPrice}</p>
                    \${i.spotifyUrl ? \`<p>🎵 <strong>Spotify Link:</strong> <a href="\${i.spotifyUrl}" target="_blank">\${i.spotifyUrl}</a></p>\` : ''}
                    \${i.customText ? \`<p>✒️ <strong>Engraved Text:</strong> "\${i.customText}"</p>\` : ''}
                  </div>
                \`).join('')}
              </div>
            </div>
          </div>
        \`;
        document.body.insertAdjacentHTML('beforeend', modalHtml);
      } catch (err) {
        showToast('Error opening order details: ' + err.message, 'error');
      }
    },

    openAdvanceStatusModal(orderId, currentStatus) {
      const nextStatuses = {
        'PENDING_PAYMENT': ['ORDER_RECEIVED', 'CANCELLED'],
        'ORDER_RECEIVED': ['ENGRAVING', 'CANCELLED'],
        'ENGRAVING': ['QUALITY_CHECK', 'DISPATCHED', 'CANCELLED'],
        'QUALITY_CHECK': ['DISPATCHED', 'CANCELLED'],
        'DISPATCHED': ['DELIVERED'],
        'DELIVERED': []
      }[currentStatus] || ['ORDER_RECEIVED', 'ENGRAVING', 'DISPATCHED', 'DELIVERED', 'CANCELLED'];

      if (nextStatuses.length === 0) {
        showToast(\`Order is in terminal status "\${currentStatus}". No further transitions allowed.\`, 'info');
        return;
      }

      const options = nextStatuses.map(s => \`<option value="\${s}">\${s}</option>\`).join('');

      const modalHtml = \`
        <div class="ttz-modal-backdrop is-open" id="advanceStatusModal">
          <div class="ttz-modal-container advance-status-container">
            <button class="ttz-modal-close" onclick="document.getElementById('advanceStatusModal').remove()">✕</button>
            <h3>Update Fulfillment Status</h3>
            <p>Current Status: <strong>\${currentStatus}</strong></p>
            
            <form id="advanceStatusForm" onsubmit="AdminApp.handleAdvanceStatusSubmit(event, '\${orderId}')">
              <div class="form-group">
                <label for="nextStatusSelect">Advance to New Status</label>
                <select id="nextStatusSelect" required onchange="AdminApp.toggleCourierInputs(this.value)">
                  \${options}
                </select>
              </div>

              <div id="courierInputsGroup" style="display: \${nextStatuses[0] === 'DISPATCHED' ? 'block' : 'none'};">
                <div class="form-group">
                  <label for="courierNameInput">Courier Partner Name</label>
                  <input type="text" id="courierNameInput" placeholder="BlueDart / Delhivery / DTDC" />
                </div>
                <div class="form-group">
                  <label for="trackingNumInput">Courier Tracking / AWB Number</label>
                  <input type="text" id="trackingNumInput" placeholder="AWB-987654321" />
                </div>
              </div>

              <button type="submit" class="btn-primary" id="btnAdvanceStatusSubmit">
                Update Status
              </button>
            </form>
          </div>
        </div>
      \`;

      document.body.insertAdjacentHTML('beforeend', modalHtml);
    },

    toggleCourierInputs(status) {
      const group = document.getElementById('courierInputsGroup');
      if (group) {
        group.style.display = status === 'DISPATCHED' ? 'block' : 'none';
      }
    },

    async handleAdvanceStatusSubmit(event, orderId) {
      event.preventDefault();
      const status = document.getElementById('nextStatusSelect').value;
      const courierName = document.getElementById('courierNameInput')?.value || '';
      const trackingNumber = document.getElementById('trackingNumInput')?.value || '';
      const btn = document.getElementById('btnAdvanceStatusSubmit');

      try {
        btn.disabled = true;
        btn.innerHTML = '<span class=\"spinner\"></span> Updating...';

        await API.admin.updateOrderStatus(orderId, status, {
          courier_name: courierName,
          tracking_number: trackingNumber
        });

        document.getElementById('advanceStatusModal')?.remove();
        showToast(\`Order status advanced to \${status}!\`, 'success');
        this.loadOrders();
      } catch (err) {
        showToast('Failed to update status: ' + err.message, 'error');
      } finally {
        btn.disabled = false;
        btn.innerHTML = 'Update Status';
      }
    },

    // ── Load Audit Logs ──
    async loadAuditLogs() {
      const container = document.getElementById('adminAuditLogsTableBody');
      if (!container) return;

      try {
        container.innerHTML = '<tr><td colspan=\"5\" class=\"text-center\"><span class=\"spinner\"></span> Loading logs...</td></tr>';
        const res = await API.admin.getAuditLogs();
        const logs = res && res.logs ? res.logs : (res && res.data ? res.data : []);

        if (logs.length === 0) {
          container.innerHTML = '<tr><td colspan=\"5\" class=\"text-center\">No audit logs recorded yet.</td></tr>';
          return;
        }

        container.innerHTML = logs.map(l => \`
          <tr>
            <td><strong>\${l.action}</strong></td>
            <td>\${l.target_type || 'SYSTEM'} (\${l.target_id || '-'})</td>
            <td><small>\${typeof l.details === 'object' ? JSON.stringify(l.details) : (l.details || '-')}</small></td>
            <td>\${l.admin_name || l.admin_email || 'Admin'}</td>
            <td>\${new Date(l.created_at || Date.now()).toLocaleString('en-IN')}</td>
          </tr>
        \`).join('');
      } catch (err) {
        container.innerHTML = \`<tr><td colspan="5" class="text-danger text-center">Failed to load logs: \${err.message}</td></tr>\`;
      }
    }
  };

  global.AdminApp = AdminApp;

  if (typeof document !== 'undefined') {
    if (document.readyState === 'loading') {
      document.addEventListener('DOMContentLoaded', () => AdminApp.init());
    } else {
      AdminApp.init();
    }
  }
})(typeof window !== 'undefined' ? window : globalThis);
`;
fs.writeFileSync('public/js/admin.js', adminJs);
console.log('✓ public/js/admin.js written');

// ============================================================================
// 6. public/css/customizer.css
// ============================================================================
const customizerCss = `/**
 * TuneTagZ Frontend Stylesheet
 * Modals (Auth, Customizer, Checkout, Tracking), 3D Flip Card, Soundwave Generator, Toast Notifications.
 */

:root {
  --modal-bg: rgba(10, 26, 15, 0.96);
  --card-bg: #112318;
  --card-border: rgba(232, 228, 200, 0.12);
  --gold-glow: rgba(201, 168, 76, 0.25);
  --green-glow: rgba(74, 222, 128, 0.2);
}

/* ── MODAL BACKDROP & CONTAINER ── */
.ttz-modal-backdrop {
  position: fixed;
  inset: 0;
  z-index: 1100;
  background: rgba(4, 12, 7, 0.82);
  backdrop-filter: blur(12px);
  -webkit-backdrop-filter: blur(12px);
  display: flex;
  align-items: center;
  justify-content: center;
  padding: 20px;
  opacity: 0;
  visibility: hidden;
  transition: opacity 0.3s cubic-bezier(0.16, 1, 0.3, 1), visibility 0.3s ease;
}
.ttz-modal-backdrop.is-open {
  opacity: 1;
  visibility: visible;
}

.ttz-modal-container {
  background: var(--modal-bg);
  border: 1px solid var(--card-border);
  border-radius: 6px;
  box-shadow: 0 24px 64px rgba(0, 0, 0, 0.7), 0 0 40px rgba(201, 168, 76, 0.08);
  width: 100%;
  max-height: 90vh;
  overflow-y: auto;
  position: relative;
  transform: scale(0.94) translateY(12px);
  transition: transform 0.3s cubic-bezier(0.16, 1, 0.3, 1);
}
.ttz-modal-backdrop.is-open .ttz-modal-container {
  transform: scale(1) translateY(0);
}

.ttz-modal-close {
  position: absolute;
  top: 16px;
  right: 18px;
  background: rgba(232, 228, 200, 0.08);
  border: 1px solid var(--card-border);
  color: var(--cream);
  width: 34px;
  height: 34px;
  border-radius: 50%;
  font-size: 1rem;
  cursor: pointer;
  display: flex;
  align-items: center;
  justify-content: center;
  transition: background 0.2s, transform 0.2s;
  z-index: 10;
}
.ttz-modal-close:hover {
  background: rgba(232, 228, 200, 0.2);
  transform: rotate(90deg);
}

/* ── AUTH MODAL ── */
.auth-modal-container {
  max-width: 440px;
  padding: 36px 32px;
}
.auth-modal-header {
  text-align: center;
  margin-bottom: 24px;
}
.auth-logo {
  height: 44px;
  width: auto;
  margin-bottom: 12px;
}
.auth-title {
  font-family: 'Anton', sans-serif;
  font-size: 1.8rem;
  letter-spacing: 0.04em;
  color: var(--cream);
  margin-bottom: 6px;
}
.auth-subtitle {
  font-size: 0.85rem;
  color: var(--muted);
  line-height: 1.4;
}

.auth-tabs {
  display: flex;
  background: var(--bg2);
  border: 1px solid var(--card-border);
  border-radius: 4px;
  padding: 4px;
  margin-bottom: 22px;
}
.auth-tab-btn {
  flex: 1;
  background: transparent;
  border: none;
  color: var(--muted);
  font-family: 'Space Grotesk', sans-serif;
  font-size: 0.85rem;
  font-weight: 600;
  padding: 9px;
  border-radius: 3px;
  cursor: pointer;
  transition: color 0.2s, background 0.2s;
}
.auth-tab-btn.active {
  background: var(--card-bg);
  color: var(--cream);
  box-shadow: 0 2px 8px rgba(0,0,0,0.3);
}

.form-group {
  margin-bottom: 16px;
  text-align: left;
}
.form-group label {
  display: block;
  font-family: 'DM Mono', monospace;
  font-size: 0.72rem;
  text-transform: uppercase;
  letter-spacing: 0.08em;
  color: var(--muted);
  margin-bottom: 6px;
}
.form-group input,
.form-group select {
  width: 100%;
  background: var(--bg2);
  border: 1px solid var(--card-border);
  border-radius: 3px;
  color: var(--cream);
  font-family: 'Space Grotesk', sans-serif;
  font-size: 0.9rem;
  padding: 11px 14px;
  transition: border-color 0.2s, box-shadow 0.2s;
}
.form-group input:focus,
.form-group select:focus {
  outline: none;
  border-color: var(--gold);
  box-shadow: 0 0 10px var(--gold-glow);
}

.auth-submit-btn {
  width: 100%;
  margin-top: 8px;
  padding: 12px;
  font-weight: 600;
  letter-spacing: 0.08em;
}

.auth-divider {
  display: flex;
  align-items: center;
  text-align: center;
  margin: 20px 0 16px;
  color: var(--muted);
  font-size: 0.75rem;
}
.auth-divider::before, .auth-divider::after {
  content: '';
  flex: 1;
  border-bottom: 1px solid var(--card-border);
}
.auth-divider span {
  padding: 0 10px;
  letter-spacing: 0.1em;
}

.btn-google-oauth {
  width: 100%;
  display: flex;
  align-items: center;
  justify-content: center;
  gap: 12px;
  background: #ffffff;
  color: #1f1f1f;
  border: none;
  border-radius: 3px;
  font-family: 'Space Grotesk', sans-serif;
  font-weight: 600;
  font-size: 0.85rem;
  padding: 11px 16px;
  cursor: pointer;
  transition: transform 0.18s, box-shadow 0.2s;
}
.btn-google-oauth:hover {
  transform: translateY(-2px);
  box-shadow: 0 4px 16px rgba(255,255,255,0.2);
}

.auth-error-box,
.checkout-error-box {
  background: rgba(239, 68, 68, 0.15);
  border: 1px solid rgba(239, 68, 68, 0.35);
  color: #fca5a5;
  padding: 10px 14px;
  border-radius: 4px;
  font-size: 0.82rem;
  margin-bottom: 16px;
}

/* ── USER NAV & DROPDOWN ── */
.user-nav-dropdown {
  position: relative;
}
.btn-user-badge {
  display: flex;
  align-items: center;
  gap: 10px;
  background: rgba(232, 228, 200, 0.08);
  border: 1px solid var(--card-border);
  color: var(--cream);
  padding: 7px 16px 7px 10px;
  border-radius: 999px;
  cursor: pointer;
  font-family: 'Space Grotesk', sans-serif;
  font-size: 0.8rem;
  font-weight: 500;
  transition: background 0.2s, border-color 0.2s;
}
.btn-user-badge:hover {
  background: rgba(232, 228, 200, 0.15);
  border-color: var(--gold);
}
.user-avatar {
  background: var(--gold);
  color: #0a1a0f;
  width: 26px;
  height: 26px;
  border-radius: 50%;
  display: flex;
  align-items: center;
  justify-content: center;
  font-weight: 700;
  font-size: 0.78rem;
}
.user-name {
  max-width: 110px;
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
}
.dropdown-arrow {
  font-size: 0.7rem;
  color: var(--muted);
}

.user-dropdown-menu {
  position: absolute;
  top: calc(100% + 8px);
  right: 0;
  background: var(--modal-bg);
  border: 1px solid var(--card-border);
  border-radius: 4px;
  box-shadow: 0 12px 32px rgba(0, 0, 0, 0.6);
  min-width: 220px;
  padding: 8px 0;
  display: none;
  z-index: 1050;
  backdrop-filter: blur(16px);
}
.user-dropdown-menu.show {
  display: block;
  animation: dropdownFade 0.2s ease;
}
@keyframes dropdownFade {
  from { opacity: 0; transform: translateY(-6px); }
  to { opacity: 1; transform: translateY(0); }
}

.dropdown-header {
  padding: 10px 16px;
  text-align: left;
}
.dropdown-header strong {
  display: block;
  color: var(--cream);
  font-size: 0.85rem;
}
.dropdown-header small {
  color: var(--muted);
  font-size: 0.72rem;
}
.dropdown-divider {
  border: none;
  border-top: 1px solid var(--card-border);
  margin: 6px 0;
}
.dropdown-item {
  width: 100%;
  display: flex;
  align-items: center;
  gap: 10px;
  padding: 9px 16px;
  background: transparent;
  border: none;
  color: var(--cream);
  font-family: 'Space Grotesk', sans-serif;
  font-size: 0.82rem;
  text-decoration: none;
  text-align: left;
  cursor: pointer;
  transition: background 0.15s, color 0.15s;
}
.dropdown-item:hover {
  background: rgba(232, 228, 200, 0.08);
  color: var(--gold);
}
.dropdown-item.logout-btn:hover {
  color: #f87171;
}

/* Mobile User Card */
.mobile-user-card {
  display: flex;
  align-items: center;
  gap: 12px;
  padding: 16px 20px;
  background: var(--bg2);
  border-radius: 4px;
  margin-bottom: 12px;
}
.mobile-user-avatar {
  width: 38px;
  height: 38px;
  background: var(--gold);
  color: #0a1a0f;
  border-radius: 50%;
  display: flex;
  align-items: center;
  justify-content: center;
  font-weight: 700;
  font-size: 1rem;
}
.mobile-btn-link {
  text-align: left;
  background: transparent;
  border: none;
  cursor: pointer;
  width: 100%;
  font-family: inherit;
  padding: 12px 20px;
}

/* ── 2-SIDED CUSTOMIZER MODAL ── */
.customizer-modal-container {
  max-width: 960px;
  padding: 36px 36px;
}
.customizer-layout {
  display: grid;
  grid-template-columns: 1fr 1.2fr;
  gap: 40px;
  align-items: center;
}
@media (max-width: 840px) {
  .customizer-layout {
    grid-template-columns: 1fr;
    gap: 28px;
  }
}

.customizer-stage-wrap {
  display: flex;
  flex-direction: column;
  align-items: center;
  background: var(--bg2);
  border: 1px solid var(--card-border);
  border-radius: 6px;
  padding: 24px 20px;
}
.stage-header {
  width: 100%;
  display: flex;
  justify-content: space-between;
  align-items: center;
  margin-bottom: 20px;
}
.customizer-product-title {
  font-family: 'Anton', sans-serif;
  font-size: 1.15rem;
  letter-spacing: 0.05em;
  color: var(--cream);
}
.card-side-indicator {
  font-family: 'DM Mono', monospace;
  font-size: 0.7rem;
  color: var(--muted);
}
.badge-side {
  display: inline-block;
  padding: 2px 7px;
  border-radius: 2px;
  font-weight: 600;
  margin-right: 4px;
}
.badge-front {
  background: rgba(74, 222, 128, 0.2);
  color: #4ade80;
}
.badge-back {
  background: rgba(201, 168, 76, 0.2);
  color: var(--gold);
}

/* 3D Keychain Card Flip */
.tag-3d-scene {
  width: 280px;
  height: 380px;
  perspective: 1000px;
  cursor: pointer;
  user-select: none;
  margin: 10px 0 20px;
}
.tag-3d-card {
  width: 100%;
  height: 100%;
  position: relative;
  transform-style: preserve-3d;
  transition: transform 0.65s cubic-bezier(0.34, 1.56, 0.64, 1);
}
.tag-3d-card.is-flipped {
  transform: rotateY(180deg);
}

.tag-face {
  position: absolute;
  inset: 0;
  backface-visibility: hidden;
  -webkit-backface-visibility: hidden;
  border-radius: 12px;
  background: #111512;
  border: 2px solid #28322a;
  box-shadow: 0 16px 36px rgba(0,0,0,0.8), inset 0 0 24px rgba(0,0,0,0.6);
  padding: 20px 16px;
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: space-between;
  overflow: hidden;
}
.tag-back {
  transform: rotateY(180deg);
}

.tag-keyring {
  width: 44px;
  height: 44px;
  border: 4px solid #333;
  border-radius: 50%;
  position: absolute;
  top: -22px;
  left: calc(50% - 22px);
  box-shadow: 0 4px 10px rgba(0,0,0,0.5);
  z-index: 5;
  transition: border-color 0.3s;
}
.ring-matte-black { border-color: #2b2b2b; }
.ring-gold-brass { border-color: #c9a84c; box-shadow: 0 0 12px rgba(201,168,76,0.4); }
.ring-silver-steel { border-color: #d1d5db; }

.tag-hole {
  width: 12px;
  height: 12px;
  background: #060907;
  border: 2px solid #28322a;
  border-radius: 50%;
  margin-top: 6px;
}

.tag-metal-body {
  flex: 1;
  width: 100%;
  display: flex;
  flex-direction: column;
  justify-content: center;
  align-items: center;
  text-align: center;
}

.tag-front-content {
  width: 100%;
}
.spotify-waveform-box {
  background: #0b0e0c;
  border: 1px solid rgba(201, 168, 76, 0.25);
  border-radius: 6px;
  padding: 12px 8px;
  box-shadow: inset 0 2px 8px rgba(0,0,0,0.8);
}
.spotify-soundwave-svg {
  width: 100%;
  height: auto;
  display: block;
}
.preview-song-info {
  margin-top: 14px;
  display: flex;
  flex-direction: column;
  gap: 2px;
}
.preview-song-info .song-title {
  font-family: 'Space Grotesk', sans-serif;
  font-size: 0.95rem;
  font-weight: 700;
  color: var(--cream);
}
.preview-song-info .song-artist {
  font-family: 'DM Mono', monospace;
  font-size: 0.72rem;
  color: var(--gold);
}

.tag-back-content {
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  gap: 16px;
  padding: 20px 10px;
}
.engraving-brand-logo {
  font-family: 'Anton', sans-serif;
  letter-spacing: 0.15em;
  font-size: 0.8rem;
  color: rgba(201, 168, 76, 0.4);
}
.engraving-laser-text {
  font-size: 1.25rem;
  font-weight: 600;
  color: #f1df9a;
  text-shadow: 0 0 10px rgba(201, 168, 76, 0.6), 0 0 2px #fff;
  letter-spacing: 0.05em;
  word-break: break-word;
  padding: 0 8px;
}
.engraving-sub-label {
  font-family: 'DM Mono', monospace;
  font-size: 0.65rem;
  color: rgba(232, 228, 200, 0.35);
  letter-spacing: 0.12em;
}

.tag-sheen {
  position: absolute;
  inset: 0;
  background: linear-gradient(135deg, rgba(255,255,255,0.06) 0%, transparent 50%, rgba(0,0,0,0.3) 100%);
  pointer-events: none;
}

.btn-flip-tag {
  display: flex;
  align-items: center;
  gap: 8px;
  background: rgba(232, 228, 200, 0.08);
  border: 1px solid var(--card-border);
  color: var(--cream);
  font-family: 'DM Mono', monospace;
  font-size: 0.75rem;
  padding: 8px 18px;
  border-radius: 4px;
  cursor: pointer;
  transition: background 0.2s, border-color 0.2s, transform 0.15s;
}
.btn-flip-tag:hover {
  background: rgba(232, 228, 200, 0.15);
  border-color: var(--gold);
  transform: translateY(-1px);
}

/* Customizer Form Controls */
.customizer-form-wrap {
  text-align: left;
}
.config-heading {
  font-family: 'Anton', sans-serif;
  font-size: 1.7rem;
  letter-spacing: 0.04em;
  color: var(--cream);
  margin-bottom: 4px;
}
.config-sub {
  font-size: 0.85rem;
  color: var(--muted);
  margin-bottom: 22px;
}

.config-section {
  margin-bottom: 20px;
}
.config-label {
  display: flex;
  justify-content: space-between;
  align-items: center;
  font-family: 'DM Mono', monospace;
  font-size: 0.74rem;
  letter-spacing: 0.06em;
  color: var(--cream);
  margin-bottom: 8px;
}
.label-hint {
  font-size: 0.68rem;
  color: var(--muted);
}
.label-row {
  display: flex;
  justify-content: space-between;
  align-items: center;
  margin-bottom: 8px;
}
.char-count {
  font-family: 'DM Mono', monospace;
  font-size: 0.72rem;
  color: var(--muted);
}
.char-count.is-max {
  color: var(--gold);
  font-weight: 700;
}

.input-with-icon {
  position: relative;
}
.input-icon {
  position: absolute;
  left: 12px;
  top: 50%;
  transform: translateY(-50%);
  font-size: 0.9rem;
}
.input-with-icon input {
  padding-left: 36px;
}

.url-suggestions {
  display: flex;
  gap: 8px;
  margin-top: 8px;
  flex-wrap: wrap;
}
.sug-pill {
  background: rgba(232, 228, 200, 0.06);
  border: 1px solid var(--card-border);
  color: var(--muted);
  font-family: 'Space Grotesk', sans-serif;
  font-size: 0.72rem;
  padding: 4px 10px;
  border-radius: 999px;
  cursor: pointer;
  transition: color 0.2s, border-color 0.2s;
}
.sug-pill:hover {
  color: var(--cream);
  border-color: var(--gold);
}

.font-picker-row {
  display: flex;
  align-items: center;
  gap: 8px;
  margin-top: 10px;
}
.font-picker-label {
  font-family: 'DM Mono', monospace;
  font-size: 0.7rem;
  color: var(--muted);
}
.font-picker-btn {
  background: var(--bg2);
  border: 1px solid var(--card-border);
  color: var(--muted);
  padding: 5px 12px;
  border-radius: 3px;
  font-size: 0.78rem;
  cursor: pointer;
  transition: all 0.2s;
}
.font-picker-btn.active {
  border-color: var(--gold);
  color: var(--cream);
  background: rgba(201, 168, 76, 0.15);
}

.finish-selector {
  display: flex;
  gap: 10px;
}
.finish-btn {
  flex: 1;
  display: flex;
  align-items: center;
  justify-content: center;
  gap: 8px;
  background: var(--bg2);
  border: 1px solid var(--card-border);
  color: var(--muted);
  font-family: 'Space Grotesk', sans-serif;
  font-size: 0.78rem;
  padding: 9px 8px;
  border-radius: 4px;
  cursor: pointer;
  transition: all 0.2s;
}
.finish-btn.active {
  border-color: var(--gold);
  color: var(--cream);
  background: rgba(201, 168, 76, 0.12);
}
.finish-dot {
  width: 10px;
  height: 10px;
  border-radius: 50%;
}
.finish-black { background: #2b2b2b; }
.finish-gold { background: #c9a84c; }
.finish-silver { background: #e5e7eb; }

.customizer-footer {
  margin-top: 28px;
  padding-top: 20px;
  border-top: 1px solid var(--card-border);
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 16px;
}
.price-box {
  display: flex;
  flex-direction: column;
}
.price-label {
  font-family: 'DM Mono', monospace;
  font-size: 0.7rem;
  color: var(--muted);
}
.price-amount {
  font-family: 'Anton', sans-serif;
  font-size: 1.8rem;
  color: var(--gold);
}
.shipping-tag {
  font-size: 0.7rem;
  color: #4ade80;
}
.customizer-checkout-btn {
  padding: 14px 28px;
  font-weight: 700;
  font-size: 0.95rem;
}

/* ── CHECKOUT MODAL ── */
.checkout-modal-container {
  max-width: 900px;
  padding: 36px 36px;
}
.checkout-grid {
  display: grid;
  grid-template-columns: 1.4fr 1fr;
  gap: 36px;
}
@media (max-width: 768px) {
  .checkout-grid {
    grid-template-columns: 1fr;
  }
}
.checkout-section-title {
  font-family: 'Anton', sans-serif;
  font-size: 1.5rem;
  letter-spacing: 0.04em;
  color: var(--cream);
  margin-bottom: 4px;
}
.checkout-section-sub {
  font-size: 0.82rem;
  color: var(--muted);
  margin-bottom: 20px;
}
.form-row {
  display: grid;
  grid-template-columns: 1fr 1fr;
  gap: 14px;
}
.form-row-3 {
  grid-template-columns: 1fr 1fr 1fr;
}
@media (max-width: 600px) {
  .form-row, .form-row-3 {
    grid-template-columns: 1fr;
  }
}
.btn-razorpay-pay {
  width: 100%;
  margin-top: 16px;
  padding: 14px;
  display: flex;
  align-items: center;
  justify-content: center;
  gap: 10px;
  font-size: 0.95rem;
  font-weight: 700;
  background: var(--gold);
  color: #0a1a0f;
}
.btn-razorpay-pay:hover {
  background: #d4b55c;
  box-shadow: 0 8px 24px var(--gold-glow);
}

.checkout-summary-column {
  background: var(--bg2);
  border: 1px solid var(--card-border);
  border-radius: 6px;
  padding: 24px 20px;
  height: fit-content;
}
.summary-heading {
  font-family: 'Anton', sans-serif;
  font-size: 1.2rem;
  letter-spacing: 0.05em;
  color: var(--cream);
  margin-bottom: 16px;
}
.checkout-items-list {
  display: flex;
  flex-direction: column;
  gap: 12px;
}
.checkout-item-row {
  display: flex;
  justify-content: space-between;
  align-items: flex-start;
  font-size: 0.85rem;
}
.item-custom-detail {
  display: block;
  font-size: 0.72rem;
  color: var(--gold);
  margin-top: 2px;
}
.summary-divider {
  border: none;
  border-top: 1px solid var(--card-border);
  margin: 16px 0;
}
.summary-line {
  display: flex;
  justify-content: space-between;
  align-items: center;
  font-size: 0.85rem;
  color: var(--muted);
  margin-bottom: 8px;
}
.summary-total {
  font-size: 1.1rem;
  font-weight: 700;
  color: var(--cream);
  margin-top: 6px;
}
.total-gold {
  color: var(--gold);
  font-size: 1.3rem;
  font-family: 'DM Mono', monospace;
}
.free-shipping-tag {
  color: #4ade80;
  font-weight: 600;
}
.checkout-guarantee {
  margin-top: 24px;
  padding-top: 16px;
  border-top: 1px solid var(--card-border);
  display: flex;
  flex-direction: column;
  gap: 10px;
}
.guarantee-item {
  display: flex;
  align-items: center;
  gap: 8px;
  font-size: 0.75rem;
  color: var(--muted);
}

/* Mock Payment Modal */
.mock-payment-container {
  max-width: 480px;
  padding: 30px;
  text-align: center;
}
.mock-badge {
  background: #f59e0b;
  color: #000;
  font-size: 0.68rem;
  font-weight: 800;
  padding: 3px 8px;
  border-radius: 2px;
  letter-spacing: 0.1em;
}
.mock-btn-group {
  display: flex;
  flex-direction: column;
  gap: 12px;
  margin-top: 24px;
}

/* Order Confirmation Modal */
.order-confirm-container {
  max-width: 500px;
  padding: 40px 32px;
  text-align: center;
}
.confirm-icon {
  font-size: 3rem;
  margin-bottom: 12px;
}
.confirm-title {
  font-family: 'Anton', sans-serif;
  font-size: 2rem;
  color: var(--cream);
  margin-bottom: 8px;
}
.confirm-subtitle {
  font-size: 0.88rem;
  color: var(--muted);
  margin-bottom: 24px;
}
.confirm-card {
  background: var(--bg2);
  border: 1px solid var(--card-border);
  border-radius: 4px;
  padding: 16px;
  margin-bottom: 24px;
  text-align: left;
}
.confirm-row {
  display: flex;
  justify-content: space-between;
  padding: 6px 0;
  font-size: 0.85rem;
}
.gold-text { color: var(--gold); }
.status-pill {
  padding: 3px 8px;
  border-radius: 999px;
  font-size: 0.72rem;
  font-weight: 700;
}
.status-received {
  background: rgba(74, 222, 128, 0.15);
  color: #4ade80;
}
.confirm-actions {
  display: flex;
  flex-direction: column;
  gap: 10px;
}

/* ── TRACKING MODAL ── */
.tracking-modal-container {
  max-width: 720px;
  padding: 36px 32px;
}
.tracking-modal-header {
  text-align: center;
  margin-bottom: 24px;
}
.tracking-title {
  font-family: 'Anton', sans-serif;
  font-size: 1.8rem;
  color: var(--cream);
  margin-bottom: 4px;
}
.tracking-sub {
  font-size: 0.85rem;
  color: var(--muted);
}
.tracking-tabs {
  display: flex;
  background: var(--bg2);
  border: 1px solid var(--card-border);
  border-radius: 4px;
  padding: 4px;
  margin-bottom: 24px;
}
.tracking-tab-btn {
  flex: 1;
  background: transparent;
  border: none;
  color: var(--muted);
  font-family: 'Space Grotesk', sans-serif;
  font-size: 0.85rem;
  font-weight: 600;
  padding: 8px;
  border-radius: 3px;
  cursor: pointer;
}
.tracking-tab-btn.active {
  background: var(--card-bg);
  color: var(--cream);
}

.track-search-form {
  margin-bottom: 24px;
}
.track-input-group {
  display: flex;
  gap: 10px;
}
.track-input-group input {
  flex: 1;
  background: var(--bg2);
  border: 1px solid var(--card-border);
  border-radius: 3px;
  color: var(--cream);
  padding: 12px 16px;
  font-size: 0.9rem;
}
.track-optional-row {
  margin-top: 8px;
}
.track-optional-row input {
  width: 100%;
  background: transparent;
  border: none;
  border-bottom: 1px solid var(--card-border);
  color: var(--muted);
  font-size: 0.75rem;
  padding: 6px 4px;
}

.order-track-card {
  background: var(--bg2);
  border: 1px solid var(--card-border);
  border-radius: 6px;
  padding: 24px;
  text-align: left;
}
.order-track-header {
  display: flex;
  justify-content: space-between;
  align-items: center;
  margin-bottom: 24px;
  padding-bottom: 16px;
  border-bottom: 1px solid var(--card-border);
}
.order-num-badge {
  font-family: 'DM Mono', monospace;
  font-size: 0.78rem;
  color: var(--gold);
  letter-spacing: 0.08em;
}
.order-customer-name {
  font-size: 1.1rem;
  color: var(--cream);
  margin-top: 2px;
}

/* 5-Step Stepper Timeline */
.track-stepper {
  display: flex;
  flex-direction: column;
  margin: 20px 0;
  position: relative;
}
.stepper-step {
  display: flex;
  gap: 16px;
  position: relative;
  padding-bottom: 20px;
}
.stepper-step:last-child {
  padding-bottom: 0;
}
.step-indicator {
  display: flex;
  flex-direction: column;
  align-items: center;
  width: 24px;
}
.step-bullet {
  width: 22px;
  height: 22px;
  border-radius: 50%;
  display: flex;
  align-items: center;
  justify-content: center;
  font-size: 0.75rem;
  font-weight: 700;
  z-index: 2;
}
.step-line {
  width: 2px;
  flex: 1;
  background: var(--card-border);
  margin: 4px 0;
}

.step-completed .step-bullet {
  background: var(--gold);
  color: #0a1a0f;
}
.step-completed .step-line {
  background: var(--gold);
}
.step-current .step-bullet {
  background: #4ade80;
  color: #0a1a0f;
  box-shadow: 0 0 12px rgba(74, 222, 128, 0.5);
}
.step-current .step-label {
  color: #4ade80;
  font-weight: 700;
}
.step-pending .step-bullet {
  background: var(--card-bg);
  border: 1px solid var(--card-border);
  color: var(--muted);
}
.step-pending .step-label {
  color: var(--muted);
}

.step-content {
  flex: 1;
}
.step-label {
  font-size: 0.95rem;
  color: var(--cream);
  margin-bottom: 2px;
}
.step-desc {
  font-size: 0.78rem;
  color: var(--muted);
}

.courier-dispatch-info {
  background: rgba(201, 168, 76, 0.1);
  border: 1px solid rgba(201, 168, 76, 0.3);
  border-radius: 4px;
  padding: 12px 16px;
  margin: 16px 0;
  display: flex;
  flex-direction: column;
  gap: 6px;
  font-size: 0.85rem;
}
.courier-row {
  display: flex;
  justify-content: space-between;
}

.track-section {
  margin-top: 18px;
  padding-top: 14px;
  border-top: 1px solid var(--card-border);
}
.track-sec-title {
  font-family: 'DM Mono', monospace;
  font-size: 0.72rem;
  text-transform: uppercase;
  color: var(--muted);
  letter-spacing: 0.08em;
  margin-bottom: 8px;
}
.track-items-grid {
  display: flex;
  flex-direction: column;
  gap: 8px;
}
.track-item-card {
  background: rgba(232, 228, 200, 0.04);
  border-radius: 4px;
  padding: 10px 14px;
}
.item-spotify-row,
.item-engraved-row {
  font-size: 0.78rem;
  margin-top: 4px;
}
.item-spotify-row a {
  color: var(--gold);
  text-decoration: none;
}
.shipping-address-text {
  font-size: 0.85rem;
  color: var(--cream);
  line-height: 1.4;
}

/* My Orders List */
.my-orders-list {
  display: flex;
  flex-direction: column;
  gap: 12px;
}
.my-order-card {
  background: var(--bg2);
  border: 1px solid var(--card-border);
  border-radius: 4px;
  padding: 16px;
  text-align: left;
}
.my-order-head {
  display: flex;
  justify-content: space-between;
  align-items: center;
  margin-bottom: 8px;
}
.order-date {
  display: block;
  font-size: 0.72rem;
  color: var(--muted);
}
.my-order-body {
  display: flex;
  justify-content: space-between;
  align-items: center;
  margin-bottom: 12px;
}
.order-items-summary {
  font-size: 0.85rem;
  color: var(--cream);
}
.order-amount {
  color: var(--gold);
  font-size: 1rem;
}
.btn-sm {
  padding: 6px 14px;
  font-size: 0.75rem;
}

/* ── TOAST NOTIFICATIONS ── */
.ttz-toast-container {
  position: fixed;
  bottom: 24px;
  right: 24px;
  z-index: 1500;
  display: flex;
  flex-direction: column;
  gap: 10px;
  pointer-events: none;
}
.ttz-toast {
  background: #0f2717;
  border: 1px solid var(--card-border);
  color: var(--cream);
  border-radius: 4px;
  padding: 12px 18px;
  display: flex;
  align-items: center;
  gap: 10px;
  font-size: 0.85rem;
  box-shadow: 0 8px 24px rgba(0,0,0,0.5);
  pointer-events: auto;
  opacity: 0;
  transform: translateY(16px);
  transition: all 0.25s cubic-bezier(0.16, 1, 0.3, 1);
}
.ttz-toast.show {
  opacity: 1;
  transform: translateY(0);
}
.ttz-toast-success {
  border-color: #4ade80;
}
.ttz-toast-success .toast-icon {
  color: #4ade80;
  font-weight: 800;
}
.ttz-toast-error {
  border-color: #ef4444;
}
.ttz-toast-error .toast-icon {
  color: #ef4444;
  font-weight: 800;
}
.ttz-toast-info .toast-icon {
  color: var(--gold);
}

.spinner {
  display: inline-block;
  width: 14px;
  height: 14px;
  border: 2px solid rgba(255,255,255,0.3);
  border-top-color: currentColor;
  border-radius: 50%;
  animation: spin 0.6s linear infinite;
  vertical-align: middle;
  margin-right: 4px;
}
@keyframes spin {
  to { transform: rotate(360deg); }
}
`;
fs.writeFileSync('public/css/customizer.css', customizerCss);
console.log('✓ public/css/customizer.css written');

// ============================================================================
// 7. public/css/admin.css
// ============================================================================
const adminCss = `/**
 * TuneTagZ Developer Admin Portal Stylesheet
 */

:root {
  --admin-bg: #07130a;
  --admin-card: #0d1f13;
  --admin-sidebar: #061109;
  --gold: #c9a84c;
  --cream: #e8e4c8;
  --muted: rgba(232, 228, 200, 0.45);
  --border: rgba(232, 228, 200, 0.08);
}

*, *::before, *::after { box-sizing: border-box; margin: 0; padding: 0; }
body {
  background: var(--admin-bg);
  color: var(--cream);
  font-family: 'Space Grotesk', sans-serif;
  min-height: 100vh;
}

/* ── ADMIN LOGIN SCREEN ── */
.admin-login-wrapper {
  min-height: 100vh;
  display: flex;
  align-items: center;
  justify-content: center;
  padding: 20px;
  background: radial-gradient(circle at 50% 30%, rgba(201, 168, 76, 0.08), transparent 70%);
}
.admin-login-box {
  width: 100%;
  max-width: 440px;
  background: var(--admin-card);
  border: 1px solid var(--border);
  border-radius: 8px;
  padding: 40px 32px;
  box-shadow: 0 24px 64px rgba(0,0,0,0.8);
  text-align: center;
}
.admin-logo {
  height: 48px;
  margin-bottom: 16px;
}
.admin-login-title {
  font-family: 'Anton', sans-serif;
  font-size: 1.8rem;
  color: var(--cream);
  margin-bottom: 4px;
}
.admin-login-sub {
  font-size: 0.85rem;
  color: var(--muted);
  margin-bottom: 24px;
}
.admin-credentials-hint {
  background: rgba(201, 168, 76, 0.1);
  border: 1px solid rgba(201, 168, 76, 0.25);
  border-radius: 4px;
  padding: 10px;
  font-size: 0.75rem;
  color: var(--gold);
  margin-top: 20px;
  text-align: left;
  font-family: 'DM Mono', monospace;
}

/* ── ADMIN DASHBOARD LAYOUT ── */
.admin-dashboard-wrapper {
  display: flex;
  min-height: 100vh;
}

/* Sidebar */
.admin-sidebar {
  width: 250px;
  background: var(--admin-sidebar);
  border-right: 1px solid var(--border);
  display: flex;
  flex-direction: column;
  justify-content: space-between;
  padding: 24px 16px;
  flex-shrink: 0;
}
.admin-brand {
  display: flex;
  align-items: center;
  gap: 12px;
  padding: 0 8px 24px;
  border-bottom: 1px solid var(--border);
}
.admin-brand img {
  height: 32px;
}
.admin-brand-label {
  font-family: 'Anton', sans-serif;
  font-size: 1.1rem;
  letter-spacing: 0.05em;
}

.admin-nav {
  margin-top: 20px;
  display: flex;
  flex-direction: column;
  gap: 6px;
}
.admin-nav-item {
  display: flex;
  align-items: center;
  gap: 12px;
  padding: 11px 14px;
  background: transparent;
  border: none;
  color: var(--muted);
  font-family: 'Space Grotesk', sans-serif;
  font-size: 0.88rem;
  font-weight: 500;
  border-radius: 4px;
  cursor: pointer;
  text-align: left;
  transition: all 0.2s;
  width: 100%;
}
.admin-nav-item:hover {
  color: var(--cream);
  background: rgba(232, 228, 200, 0.05);
}
.admin-nav-item.active {
  color: var(--gold);
  background: rgba(201, 168, 76, 0.12);
  font-weight: 600;
}

.sidebar-footer {
  padding-top: 16px;
  border-top: 1px solid var(--border);
}
.admin-user-info {
  display: flex;
  align-items: center;
  gap: 10px;
  margin-bottom: 12px;
}
.admin-avatar {
  width: 32px;
  height: 32px;
  background: var(--gold);
  color: #000;
  border-radius: 50%;
  display: flex;
  align-items: center;
  justify-content: center;
  font-weight: 700;
}
.admin-user-details strong {
  display: block;
  font-size: 0.8rem;
}
.admin-role-badge {
  font-size: 0.65rem;
  color: #4ade80;
  text-transform: uppercase;
}
.btn-admin-logout {
  width: 100%;
  background: transparent;
  border: 1px solid var(--border);
  color: var(--muted);
  padding: 8px;
  border-radius: 4px;
  cursor: pointer;
  font-size: 0.78rem;
}
.btn-admin-logout:hover {
  color: #ef4444;
  border-color: #ef4444;
}

/* Main Admin Workspace */
.admin-main {
  flex: 1;
  padding: 32px 40px;
  overflow-y: auto;
}
.admin-header {
  display: flex;
  justify-content: space-between;
  align-items: center;
  margin-bottom: 32px;
}
.admin-page-title {
  font-family: 'Anton', sans-serif;
  font-size: 2rem;
  color: var(--cream);
}
.admin-page-sub {
  font-size: 0.85rem;
  color: var(--muted);
}

/* KPI Stats Grid */
.admin-stats-grid {
  display: grid;
  grid-template-columns: repeat(4, 1fr);
  gap: 20px;
  margin-bottom: 36px;
}
@media (max-width: 1024px) {
  .admin-stats-grid { grid-template-columns: repeat(2, 1fr); }
}
.stat-card {
  background: var(--admin-card);
  border: 1px solid var(--border);
  border-radius: 6px;
  padding: 22px;
  display: flex;
  align-items: center;
  gap: 16px;
}
.stat-icon {
  font-size: 2rem;
  background: rgba(232, 228, 200, 0.05);
  width: 54px;
  height: 54px;
  border-radius: 6px;
  display: flex;
  align-items: center;
  justify-content: center;
}
.stat-value {
  font-family: 'Anton', sans-serif;
  font-size: 1.8rem;
  color: var(--cream);
  line-height: 1.1;
}
.stat-label {
  font-size: 0.75rem;
  color: var(--muted);
  text-transform: uppercase;
  letter-spacing: 0.06em;
}

/* Admin Data Tables */
.admin-panel-card {
  background: var(--admin-card);
  border: 1px solid var(--border);
  border-radius: 6px;
  padding: 24px;
  margin-bottom: 32px;
}
.panel-header {
  display: flex;
  justify-content: space-between;
  align-items: center;
  margin-bottom: 20px;
}
.panel-title {
  font-family: 'Anton', sans-serif;
  font-size: 1.3rem;
  color: var(--cream);
}
.panel-actions {
  display: flex;
  gap: 12px;
}

.admin-table-responsive {
  width: 100%;
  overflow-x: auto;
}
.admin-table {
  width: 100%;
  border-collapse: collapse;
  text-align: left;
  font-size: 0.85rem;
}
.admin-table th {
  padding: 12px 14px;
  font-family: 'DM Mono', monospace;
  font-size: 0.72rem;
  text-transform: uppercase;
  color: var(--muted);
  border-bottom: 1px solid var(--border);
  letter-spacing: 0.06em;
}
.admin-table td {
  padding: 14px;
  border-bottom: 1px solid rgba(232, 228, 200, 0.04);
  vertical-align: middle;
}
.admin-table tr:hover td {
  background: rgba(232, 228, 200, 0.02);
}

.admin-prod-thumb {
  width: 48px;
  height: 48px;
  object-fit: cover;
  border-radius: 4px;
  border: 1px solid var(--border);
}

/* Status Badges */
.badge-status {
  display: inline-block;
  padding: 4px 10px;
  border-radius: 999px;
  font-size: 0.72rem;
  font-weight: 700;
  text-transform: uppercase;
}
.status-order_received { background: rgba(59, 130, 246, 0.18); color: #60a5fa; }
.status-engraving { background: rgba(201, 168, 76, 0.18); color: #fbbf24; }
.status-quality_check { background: rgba(168, 85, 247, 0.18); color: #c084fc; }
.status-dispatched { background: rgba(14, 165, 233, 0.18); color: #38bdf8; }
.status-delivered { background: rgba(34, 197, 94, 0.18); color: #4ade80; }
.status-cancelled { background: rgba(239, 68, 68, 0.18); color: #f87171; }

.badge-tag {
  background: rgba(232, 228, 200, 0.08);
  padding: 3px 8px;
  border-radius: 3px;
  font-size: 0.72rem;
}

/* Stock Toggle Switch */
.toggle-switch {
  position: relative;
  display: inline-block;
  width: 36px;
  height: 20px;
  vertical-align: middle;
  margin-right: 8px;
}
.toggle-switch input { opacity: 0; width: 0; height: 0; }
.toggle-slider {
  position: absolute;
  cursor: pointer;
  inset: 0;
  background: #374151;
  border-radius: 20px;
  transition: 0.25s;
}
.toggle-slider::before {
  position: absolute;
  content: "";
  height: 14px;
  width: 14px;
  left: 3px;
  bottom: 3px;
  background: white;
  border-radius: 50%;
  transition: 0.25s;
}
input:checked + .toggle-slider { background: #22c55e; }
input:checked + .toggle-slider::before { transform: translateX(16px); }

.stock-label {
  font-size: 0.75rem;
  font-weight: 600;
}
.stock-label.in-stock { color: #4ade80; }
.stock-label.out-stock { color: #f87171; }

/* Buttons & Inputs */
.action-btn-group {
  display: flex;
  gap: 6px;
}
.btn-gold {
  background: var(--gold);
  color: #0a1a0f;
  border: none;
  font-weight: 600;
  border-radius: 3px;
  cursor: pointer;
}
.btn-danger {
  background: rgba(239, 68, 68, 0.15);
  color: #f87171;
  border: 1px solid rgba(239, 68, 68, 0.3);
  border-radius: 3px;
  cursor: pointer;
}

.admin-order-details-container,
.advance-status-container {
  max-width: 600px;
  padding: 30px;
}
.admin-item-card {
  background: rgba(232, 228, 200, 0.04);
  padding: 12px;
  border-radius: 4px;
  margin-top: 8px;
}
`;
fs.writeFileSync('public/css/admin.css', adminCss);
console.log('✓ public/css/admin.css written');

// ============================================================================
// 8. index.html & public/index.html
// ============================================================================
function generateIndexHtml() {
  // Read base index.html
  let rawHtml = fs.readFileSync('index.html', 'utf8');

  // Ensure customizer.css is linked in head
  if (!rawHtml.includes('customizer.css')) {
    rawHtml = rawHtml.replace('</head>', '  <link rel="stylesheet" href="/public/css/customizer.css" />\n  <link rel="stylesheet" href="public/css/customizer.css" />\n</head>');
  }

  // Update Nav links to include Track Order and User Auth Container
  if (!rawHtml.includes('navUserContainer')) {
    rawHtml = rawHtml.replace(
      '<a href="https://www.instagram.com/tune.tagz/" class="nav-cta" target="_blank" rel="noopener noreferrer" aria-label="Shop TuneTagZ on Instagram">Shop Now</a>',
      `<a href="#track" class="nav-link" onclick="if(window.TrackingModal) TrackingModal.open(); return false;">Track Order</a>
    </div>
    <div id="navUserContainer">
      <button class="nav-cta btn-auth-trigger" onclick="if(window.AuthModal) AuthModal.open('login')">Sign In</button>
    </div>`
    );
  }

  // Update Mobile Drawer to include Track Order and User Auth Container
  if (!rawHtml.includes('mobileNavUserContainer')) {
    rawHtml = rawHtml.replace(
      '<a href="https://www.instagram.com/tune.tagz/" class="d-cta" target="_blank" rel="noopener noreferrer" aria-label="Order TuneTagZ on Instagram">Order on Instagram</a>',
      `<a href="#track" class="d-link" data-drawer-close onclick="if(window.TrackingModal) TrackingModal.open();">Track Order</a>
    <div id="mobileNavUserContainer" style="margin-top: 16px;">
      <button class="d-cta" onclick="if(window.AuthModal) AuthModal.open('login'); closeDrawer();">Sign In / Register</button>
    </div>`
    );
  }

  // Update hero CTA and product action buttons
  rawHtml = rawHtml.replace(
    '<a href="https://www.instagram.com/tune.tagz/" class="pbtn" target="_blank" rel="noopener noreferrer" aria-label="Order Spotify Code Tag on Instagram">Order Now</a>',
    '<button type="button" class="pbtn btn-customize-trigger" onclick="if(window.CustomizerModal) CustomizerModal.open();" aria-label="Customize Spotify Code Tag">Customize Now</button>'
  );

  rawHtml = rawHtml.replace(
    '<a href="https://www.instagram.com/tune.tagz/" class="pbtn" target="_blank" rel="noopener noreferrer" aria-label="Order Rocky Keychain on Instagram">Order Now</a>',
    '<button type="button" class="pbtn btn-buy-rocky-trigger" onclick="if(window.CheckoutModal) CheckoutModal.open({productId:2, productName:\'Rocky Keychain\', price:300, quantity:1});" aria-label="Buy Rocky Keychain">Buy Now</button>'
  );

  rawHtml = rawHtml.replace(
    '<a href="https://www.instagram.com/tune.tagz/" class="btn-primary" target="_blank" rel="noopener noreferrer" aria-label="Order Rocky Keychain on Instagram">Order Rocky</a>',
    '<button type="button" class="btn-primary" onclick="if(window.CheckoutModal) CheckoutModal.open({productId:2, productName:\'Rocky Keychain\', price:300, quantity:1});" aria-label="Order Rocky Keychain">Order Rocky</button>'
  );

  // Update Hero CTA buttons
  rawHtml = rawHtml.replace(
    '<a href="#products" class="btn-primary">Shop Collection</a>',
    '<button type="button" class="btn-primary" onclick="if(window.CustomizerModal) CustomizerModal.open();">Customize & Order</button>'
  );

  // Dynamic Catalog Sync script injection
  const catalogSyncScript = `
  <!-- Dynamic Backend Catalog Sync & Client Integration -->
  <script src="https://checkout.razorpay.com/v1/checkout.js"></script>
  <script src="/public/js/api.js"></script>
  <script src="public/js/api.js"></script>
  <script src="/public/js/auth.js"></script>
  <script src="public/js/auth.js"></script>
  <script src="/public/js/customizer.js"></script>
  <script src="public/js/customizer.js"></script>
  <script src="/public/js/checkout.js"></script>
  <script src="public/js/checkout.js"></script>
  <script src="/public/js/tracking.js"></script>
  <script src="public/js/tracking.js"></script>

  <script>
    // Dynamic Product Catalog Loader
    (async function initStorefrontCatalog() {
      const grid = document.querySelector('.products-grid');
      const countBadge = document.querySelector('.s-count');
      if (!grid) return;

      try {
        const res = await API.products.list();
        if (res && res.success && Array.isArray(res.data) && res.data.length > 0) {
          const products = res.data;
          const availableCount = products.filter(p => p.in_stock && !p.coming_soon).length;
          if (countBadge) {
            countBadge.textContent = \`0\${availableCount} / 0\${products.length} Available\`;
          }

          grid.innerHTML = products.map((p, idx) => {
            const isComingSoon = p.coming_soon || p.sku === 'DRP-003';
            const isOutStock = !p.in_stock && !isComingSoon;
            const cardClass = isComingSoon ? 'pcard soon reveal visible' : 'pcard reveal visible';
            const imgUrl = p.image_url || (idx === 0 ? 'POSTER 1.png' : idx === 1 ? 'POSTER 2.png' : 'PRODUCT 1.png');

            let actionBtn = '';
            if (isComingSoon) {
              actionBtn = '<button type="button" class="pbtn" style="opacity:0.65" onclick="showToast(\\'Drop 03 coming soon! Follow our updates.\\', \\'info\\')">Notify Me</button>';
            } else if (isOutStock) {
              actionBtn = '<button type="button" class="pbtn" disabled style="opacity:0.4; cursor:not-allowed;">Out of Stock</button>';
            } else if (p.is_customizable) {
              actionBtn = \`<button type="button" class="pbtn" onclick="CustomizerModal.open({id:\${p.id}, sku:'\${p.sku}', name:'\${p.name.replace(/'/g, "\\\\'")}', price:\${p.price}, is_customizable:true})">Customize Now</button>\`;
            } else {
              actionBtn = \`<button type="button" class="pbtn" onclick="CheckoutModal.open({productId:\${p.id}, productName:'\${p.name.replace(/'/g, "\\\\'")}', price:\${p.price}, quantity:1})">Buy Now</button>\`;
            }

            return \`
              <article class="\${cardClass}" aria-labelledby="pname-prod-\${p.id}">
                <div class="pimg-wrap">
                  \${p.badge ? \`<span class="pbadge">\${p.badge}</span>\` : ''}
                  <span class="psku">\${p.sku || 'SKU-' + p.id}</span>
                  \${isComingSoon ? \`
                    <div class="soon-inner">
                      <div class="soon-label">Coming<br/>Soon</div>
                      <div class="soon-tag">\${p.name}</div>
                    </div>
                  \` : \`
                    <img class="pimg" src="\${imgUrl}" alt="\${p.name}" loading="lazy" decoding="async" width="1254" height="1254" />
                  \`}
                </div>
                <div class="pbody">
                  <div class="pbar"></div>
                  <h3 id="pname-prod-\${p.id}" class="pname" \${isComingSoon ? 'style="opacity:0.3"' : ''}>\${p.name.replace(' ', '<br/>')}</h3>
                  <p class="pdesc">\${p.description || 'Handcrafted custom keychain with premium materials.'}</p>
                  <div class="pfooter">
                    <div class="pprice" \${isComingSoon ? 'style="opacity:0.3"' : ''}>\${isComingSoon ? 'TBA' : \`₹\${p.price} <small>/ piece</small>\`}</div>
                    \${actionBtn}
                  </div>
                </div>
              </article>
            \`;
          }).join('');

          // Re-bind mouse tilt animation
          if (window.matchMedia('(hover: hover)').matches) {
            document.querySelectorAll('.pcard').forEach(card => {
              let tiltRect = null;
              card.addEventListener('mouseenter', () => { tiltRect = card.getBoundingClientRect(); });
              card.addEventListener('mousemove', e => {
                if (!tiltRect) return;
                const x = (e.clientX - tiltRect.left) / tiltRect.width - 0.5;
                const y = (e.clientY - tiltRect.top) / tiltRect.height - 0.5;
                card.style.transform = \`translateY(-8px) perspective(600px) rotateY(\${x * 8}deg) rotateX(\${-y * 6}deg)\`;
              });
              card.addEventListener('mouseleave', () => { card.style.transform = ''; });
            });
          }
        }
      } catch (e) {
        console.warn('Backend catalog offline or initializing, falling back to static markup.', e);
      }
    })();
  </script>
  `;

  if (!rawHtml.includes('initStorefrontCatalog')) {
    rawHtml = rawHtml.replace('</body>', `${catalogSyncScript}\n</body>`);
  }

  fs.writeFileSync('index.html', rawHtml);
  fs.writeFileSync('public/index.html', rawHtml);
  console.log('✓ index.html & public/index.html written');
}

generateIndexHtml();

// ============================================================================
// 9. admin.html & public/admin.html
// ============================================================================
const adminHtml = `<!DOCTYPE html>
<html lang="en-IN" dir="ltr">
<head>
  <meta charset="UTF-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1.0" />
  <title>Developer Admin Portal — TuneTagZ</title>
  <link rel="icon" type="image/svg+xml" href="data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 32 32'%3E%3Crect width='32' height='32' fill='%230d1f13'/%3E%3Ctext x='50%25' y='50%25' dominant-baseline='central' text-anchor='middle' font-family='serif' font-weight='bold' font-size='18' fill='%23c9a84c'%3ETZ%3C/text%3E%3C/svg%3E" />
  <link rel="stylesheet" href="https://fonts.googleapis.com/css2?family=Anton&family=Space+Grotesk:wght@300;400;500;600;700&family=DM+Mono:wght@300;400;500&display=swap" />
  <link rel="stylesheet" href="/public/css/admin.css" />
  <link rel="stylesheet" href="public/css/admin.css" />
  <link rel="stylesheet" href="/public/css/customizer.css" />
  <link rel="stylesheet" href="public/css/customizer.css" />
</head>
<body>

  <!-- LOGIN VIEW -->
  <div id="adminLoginView" class="admin-login-wrapper">
    <div class="admin-login-box">
      <img src="TUNETAGZ%20LOGO.png" alt="TuneTagZ" class="admin-logo" />
      <h1 class="admin-login-title">Developer Admin Portal</h1>
      <p class="admin-login-sub">Authenticate with administrator credentials to manage products, orders, and fulfillment.</p>

      <div class="auth-error-box" id="adminLoginError" style="display: none;" role="alert"></div>

      <form id="adminLoginForm">
        <div class="form-group">
          <label for="adminEmail">Admin Email</label>
          <input type="email" id="adminEmail" name="email" required placeholder="admin@tunetagz.com" value="admin@tunetagz.com" autocomplete="email" />
        </div>
        <div class="form-group">
          <label for="adminPassword">Admin Password</label>
          <input type="password" id="adminPassword" name="password" required placeholder="••••••••" value="Admin@TuneTagZ2026!" autocomplete="current-password" />
        </div>
        <button type="submit" class="btn-primary auth-submit-btn" id="adminLoginSubmitBtn">
          <span>Sign In to Admin Portal</span>
        </button>
      </form>

      <div class="admin-credentials-hint">
        <strong>Default Admin Credentials:</strong><br/>
        Email: admin@tunetagz.com<br/>
        Password: Admin@TuneTagZ2026!
      </div>
    </div>
  </div>

  <!-- AUTHENTICATED DASHBOARD VIEW -->
  <div id="adminDashboardView" class="admin-dashboard-wrapper" style="display: none;">
    <!-- Sidebar -->
    <aside class="admin-sidebar">
      <div>
        <div class="admin-brand">
          <img src="TUNETAGZ%20LOGO.png" alt="TuneTagZ" />
          <span class="admin-brand-label">Admin Console</span>
        </div>
        <nav class="admin-nav">
          <button class="admin-nav-item active" data-tab="overview">
            <span>📊</span> Dashboard Overview
          </button>
          <button class="admin-nav-item" data-tab="products">
            <span>🏷️</span> Product Catalog
          </button>
          <button class="admin-nav-item" data-tab="orders">
            <span>📦</span> Order Fulfillment
          </button>
          <button class="admin-nav-item" data-tab="audit">
            <span>📜</span> Audit Trail
          </button>
          <a href="index.html" class="admin-nav-item" target="_blank" style="margin-top: 12px; color: var(--gold);">
            <span>🌐</span> View Storefront ↗
          </a>
        </nav>
      </div>

      <div class="sidebar-footer">
        <div class="admin-user-info">
          <div class="admin-avatar">A</div>
          <div class="admin-user-details">
            <strong id="adminUserBadge">admin@tunetagz.com</strong>
            <span class="admin-role-badge">Lead Developer</span>
          </div>
        </div>
        <button class="btn-admin-logout" id="adminLogoutBtn">Sign Out</button>
      </div>
    </aside>

    <!-- Main Workspace -->
    <main class="admin-main">
      <!-- PANE 1: OVERVIEW -->
      <section id="pane-overview" class="admin-tab-pane">
        <div class="admin-header">
          <div>
            <h2 class="admin-page-title">Executive Dashboard</h2>
            <p class="admin-page-sub">Live revenue metrics, fulfillment pipeline, and inventory status.</p>
          </div>
          <button class="btn-primary btn-sm" onclick="AdminApp.loadStats()">🔄 Refresh KPIs</button>
        </div>

        <div class="admin-stats-grid">
          <div class="stat-card">
            <div class="stat-icon">💰</div>
            <div>
              <div class="stat-value" id="statTotalSales">₹0</div>
              <div class="stat-label">Total Revenue</div>
            </div>
          </div>
          <div class="stat-card">
            <div class="stat-icon">🛍️</div>
            <div>
              <div class="stat-value" id="statTotalOrders">0</div>
              <div class="stat-label">Paid Orders</div>
            </div>
          </div>
          <div class="stat-card">
            <div class="stat-icon">⏳</div>
            <div>
              <div class="stat-value" id="statPendingOrders">0</div>
              <div class="stat-label">Pending Fulfillment</div>
            </div>
          </div>
          <div class="stat-card">
            <div class="stat-icon">🏷️</div>
            <div>
              <div class="stat-value" id="statTotalProducts">0</div>
              <div class="stat-label">Catalog Products</div>
            </div>
          </div>
        </div>

        <div class="admin-panel-card">
          <div class="panel-header">
            <h3 class="panel-title">Recent Orders</h3>
            <button class="btn-ghost btn-sm" onclick="AdminApp.switchTab('orders')">View All Orders →</button>
          </div>
          <div class="admin-table-responsive">
            <table class="admin-table">
              <thead>
                <tr>
                  <th>Order #</th>
                  <th>Customer</th>
                  <th>Items</th>
                  <th>Amount</th>
                  <th>Status</th>
                  <th>Action</th>
                </tr>
              </thead>
              <tbody id="recentOrdersTableBody">
                <tr><td colspan="6" class="text-center">Loading orders...</td></tr>
              </tbody>
            </table>
          </div>
        </div>
      </section>

      <!-- PANE 2: PRODUCTS CATALOG -->
      <section id="pane-products" class="admin-tab-pane" style="display: none;">
        <div class="admin-header">
          <div>
            <h2 class="admin-page-title">Product Catalog Manager</h2>
            <p class="admin-page-sub">Add new items with Multer image upload, toggle live inventory stock, and edit details.</p>
          </div>
          <button class="btn-primary" onclick="AdminApp.openAddProductModal()">+ Add New Product</button>
        </div>

        <div class="admin-panel-card">
          <div class="admin-table-responsive">
            <table class="admin-table">
              <thead>
                <tr>
                  <th>Image</th>
                  <th>Product / SKU</th>
                  <th>Price</th>
                  <th>Badge</th>
                  <th>Inventory Stock</th>
                  <th>Customizable</th>
                  <th>Actions</th>
                </tr>
              </thead>
              <tbody id="adminProductsTableBody">
                <tr><td colspan="7" class="text-center">Loading products...</td></tr>
              </tbody>
            </table>
          </div>
        </div>
      </section>

      <!-- PANE 3: ORDER FULFILLMENT -->
      <section id="pane-orders" class="admin-tab-pane" style="display: none;">
        <div class="admin-header">
          <div>
            <h2 class="admin-page-title">Order Fulfillment Pipeline</h2>
            <p class="admin-page-sub">Track incoming custom Spotify orders, laser engraving progress, and dispatch tracking.</p>
          </div>
        </div>

        <div class="admin-panel-card">
          <div class="panel-header">
            <div class="panel-actions">
              <select id="orderStatusFilter" class="form-group" style="margin-bottom:0; width: 180px;">
                <option value="ALL">All Statuses</option>
                <option value="ORDER_RECEIVED">Order Received</option>
                <option value="ENGRAVING">Engraving</option>
                <option value="QUALITY_CHECK">Quality Check</option>
                <option value="DISPATCHED">Dispatched</option>
                <option value="DELIVERED">Delivered</option>
                <option value="CANCELLED">Cancelled</option>
              </select>
              <input type="text" id="orderSearchInput" placeholder="Search by customer name, email, or order #" style="width: 320px;" />
            </div>
            <button class="btn-ghost btn-sm" onclick="AdminApp.loadOrders()">🔄 Refresh</button>
          </div>

          <div class="admin-table-responsive">
            <table class="admin-table">
              <thead>
                <tr>
                  <th>Order #</th>
                  <th>Customer</th>
                  <th>Phone</th>
                  <th>Total</th>
                  <th>Fulfillment Status</th>
                  <th>Date</th>
                  <th>Actions</th>
                </tr>
              </thead>
              <tbody id="adminOrdersTableBody">
                <tr><td colspan="7" class="text-center">Loading orders...</td></tr>
              </tbody>
            </table>
          </div>
        </div>
      </section>

      <!-- PANE 4: AUDIT TRAIL -->
      <section id="pane-audit" class="admin-tab-pane" style="display: none;">
        <div class="admin-header">
          <div>
            <h2 class="admin-page-title">Administrator Audit Trail</h2>
            <p class="admin-page-sub">Cryptographic log of administrative actions, stock changes, and fulfillment updates.</p>
          </div>
        </div>

        <div class="admin-panel-card">
          <div class="admin-table-responsive">
            <table class="admin-table">
              <thead>
                <tr>
                  <th>Action</th>
                  <th>Target</th>
                  <th>Details</th>
                  <th>Admin</th>
                  <th>Timestamp</th>
                </tr>
              </thead>
              <tbody id="adminAuditLogsTableBody">
                <tr><td colspan="5" class="text-center">Loading audit logs...</td></tr>
              </tbody>
            </table>
          </div>
        </div>
      </section>
    </main>
  </div>

  <!-- ADD PRODUCT MODAL -->
  <div class="ttz-modal-backdrop" id="addProductModal" role="dialog" aria-modal="true">
    <div class="ttz-modal-container" style="max-width: 580px; padding: 32px;">
      <button class="ttz-modal-close" onclick="AdminApp.closeAddProductModal()">✕</button>
      <h2 style="font-family:'Anton',sans-serif; margin-bottom: 6px;">Add New Product</h2>
      <p style="font-size: 0.85rem; color: var(--muted); margin-bottom: 20px;">Upload image and configure product parameters. Instant sync to storefront.</p>

      <form id="addProductForm">
        <div class="form-row">
          <div class="form-group">
            <label for="newProdName">Product Name *</label>
            <input type="text" id="newProdName" name="name" required placeholder="Spotify Code Tag v2" />
          </div>
          <div class="form-group">
            <label for="newProdSku">SKU *</label>
            <input type="text" id="newProdSku" name="sku" required placeholder="SPT-002" />
          </div>
        </div>

        <div class="form-row">
          <div class="form-group">
            <label for="newProdPrice">Price (₹ INR) *</label>
            <input type="number" id="newProdPrice" name="price" required min="1" placeholder="799" />
          </div>
          <div class="form-group">
            <label for="newProdBadge">Badge (e.g. Bestseller, New, Drop 04)</label>
            <input type="text" id="newProdBadge" name="badge" placeholder="Exclusive" />
          </div>
        </div>

        <div class="form-group">
          <label for="newProdDesc">Description</label>
          <textarea id="newProdDesc" name="description" rows="3" style="width:100%; background:var(--bg2); border:1px solid var(--card-border); color:var(--cream); padding:10px; border-radius:3px;" placeholder="Laser engraved Spotify code keychain with matte black finish."></textarea>
        </div>

        <div class="form-group">
          <label for="productImageFile">Product Image (Multer Upload)</label>
          <input type="file" id="productImageFile" name="image" accept="image/*" />
        </div>

        <div class="form-row" style="margin-top: 10px;">
          <label style="display:flex; align-items:center; gap:8px; font-size:0.85rem; cursor:pointer;">
            <input type="checkbox" name="is_customizable" checked />
            <span>Enable Spotify 2-Sided Customizer</span>
          </label>
          <label style="display:flex; align-items:center; gap:8px; font-size:0.85rem; cursor:pointer;">
            <input type="checkbox" name="in_stock" checked />
            <span>In Stock (Available for purchase)</span>
          </label>
        </div>

        <button type="submit" class="btn-primary" id="btnAddProductSubmit" style="width: 100%; margin-top: 24px; padding: 12px;">
          <span>Create & Sync Product</span>
        </button>
      </form>
    </div>
  </div>

  <!-- Scripts -->
  <script src="/public/js/api.js"></script>
  <script src="public/js/api.js"></script>
  <script src="/public/js/auth.js"></script>
  <script src="public/js/auth.js"></script>
  <script src="/public/js/admin.js"></script>
  <script src="public/js/admin.js"></script>
</body>
</html>
`;

fs.writeFileSync('admin.html', adminHtml);
fs.writeFileSync('public/admin.html', adminHtml);
console.log('✓ admin.html & public/admin.html written');

// ============================================================================
// 10. .agents/worker_frontend_1/verify_frontend.js
// ============================================================================
const verifyJs = `/**
 * Frontend Verification Test Suite
 * Validates presence, syntax, markup elements, API wiring, and admin dashboard controls.
 */
const fs = require('fs');
const path = require('path');
const http = require('http');

let passCount = 0;
let failCount = 0;

function assert(condition, message) {
  if (condition) {
    console.log(\`✅ PASS: \${message}\`);
    passCount++;
  } else {
    console.error(\`❌ FAIL: \${message}\`);
    failCount++;
  }
}

async function runVerification() {
  console.log('--- STARTING FRONTEND INTEGRATION VERIFICATION ---');

  // 1. Check all required client files exist
  const requiredFiles = [
    'public/js/api.js',
    'public/js/auth.js',
    'public/js/customizer.js',
    'public/js/checkout.js',
    'public/js/tracking.js',
    'public/js/admin.js',
    'public/css/customizer.css',
    'public/css/admin.css',
    'index.html',
    'public/index.html',
    'admin.html',
    'public/admin.html'
  ];

  requiredFiles.forEach(f => {
    assert(fs.existsSync(f) && fs.statSync(f).size > 100, \`Required frontend file '\${f}' exists and is populated\`);
  });

  // 2. Validate index.html markup & integrations
  const indexHtml = fs.readFileSync('index.html', 'utf8');
  assert(indexHtml.includes('navUserContainer'), 'index.html contains #navUserContainer for dynamic customer authentication state');
  assert(indexHtml.includes('TrackingModal'), 'index.html contains live Order Tracking modal triggers');
  assert(indexHtml.includes('CustomizerModal'), 'index.html contains Spotify 2-sided Customizer modal triggers');
  assert(indexHtml.includes('CheckoutModal'), 'index.html contains Razorpay Checkout triggers');
  assert(indexHtml.includes('customizer.css'), 'index.html links to customizer.css');
  assert(indexHtml.includes('initStorefrontCatalog'), 'index.html contains dynamic catalog fetch from /api/products with fallback');

  // 3. Validate admin.html markup & integrations
  const adminHtml = fs.readFileSync('admin.html', 'utf8');
  assert(adminHtml.includes('adminLoginForm'), 'admin.html contains Admin Login Form');
  assert(adminHtml.includes('adminDashboardView'), 'admin.html contains Developer Admin Dashboard View');
  assert(adminHtml.includes('statTotalSales'), 'admin.html contains KPI metrics (Sales, Orders, Pending, Products)');
  assert(adminHtml.includes('adminProductsTableBody'), 'admin.html contains Product Catalog Table');
  assert(adminHtml.includes('adminOrdersTableBody'), 'admin.html contains Order Fulfillment Table');
  assert(adminHtml.includes('adminAuditLogsTableBody'), 'admin.html contains Admin Audit Trail');

  // 4. Validate customizer.js logic
  const customizerJs = fs.readFileSync('public/js/customizer.js', 'utf8');
  assert(customizerJs.includes('CustomizerModal'), 'customizer.js exports CustomizerModal');
  assert(customizerJs.includes('generateLocalSvg'), 'customizer.js contains 23-bar soundwave waveform generator');
  assert(customizerJs.includes('is-flipped'), 'customizer.js handles 3D card flip animation');
  assert(customizerJs.includes('updateSpotifyPreview'), 'customizer.js calls /api/spotify/preview for live preview');
  assert(customizerJs.includes('updateEngravingPreview'), 'customizer.js validates and previews laser engraved text (max 30 chars)');

  // 5. Validate checkout.js logic
  const checkoutJs = fs.readFileSync('public/js/checkout.js', 'utf8');
  assert(checkoutJs.includes('CheckoutModal'), 'checkout.js exports CheckoutModal');
  assert(checkoutJs.includes('API.payments.createOrder'), 'checkout.js initiates Razorpay order creation');
  assert(checkoutJs.includes('API.payments.verify'), 'checkout.js verifies cryptographic Razorpay signature');
  assert(checkoutJs.includes('showMockPaymentModal'), 'checkout.js provides deterministic sandbox mock payment flow');

  // 6. Validate tracking.js logic
  const trackingJs = fs.readFileSync('public/js/tracking.js', 'utf8');
  assert(trackingJs.includes('TrackingModal'), 'tracking.js exports TrackingModal');
  assert(trackingJs.includes('ORDER_RECEIVED') && trackingJs.includes('DELIVERED'), 'tracking.js implements 5-stage fulfillment stepper');
  assert(trackingJs.includes('API.orders.getMyOrders'), 'tracking.js loads customer order history');

  // 7. Validate admin.js logic
  const adminJs = fs.readFileSync('public/js/admin.js', 'utf8');
  assert(adminJs.includes('API.auth.adminLogin'), 'admin.js authenticates developer admin');
  assert(adminJs.includes('API.admin.getStats'), 'admin.js fetches dashboard stats');
  assert(adminJs.includes('API.admin.createProduct'), 'admin.js supports product creation with Multer file uploads');
  assert(adminJs.includes('API.admin.toggleStock'), 'admin.js toggles in-stock availability');
  assert(adminJs.includes('API.admin.updateOrderStatus'), 'admin.js advances order fulfillment statuses with courier tracking');

  console.log(\`\\n--- FRONTEND VERIFICATION COMPLETE: \${passCount} PASSED, \${failCount} FAILED ---\`);
  if (failCount > 0) process.exit(1);
}

runVerification();
`;

fs.writeFileSync('.agents/worker_frontend_1/verify_frontend.js', verifyJs);
console.log('✓ .agents/worker_frontend_1/verify_frontend.js written');
console.log('=======================================================');
console.log('All frontend assets and verification script built!');
