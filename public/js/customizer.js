/**
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
          ? '<span class="badge-side badge-back">BACK SIDE</span> Laser Engraving'
          : '<span class="badge-side badge-front">FRONT SIDE</span> Spotify Soundwave';
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
        bars.push(`<rect x="${x}" y="${y}" width="${barWidth}" height="${barHeight}" rx="3" fill="#c9a84c" />`);
      }

      return `
        <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ${svgWidth} ${svgHeight}" class="spotify-soundwave-svg" aria-label="Spotify Soundwave Barcode">
          <!-- Spotify Logo Icon -->
          <g transform="translate(18, 17) scale(0.075)" fill="#c9a84c">
            <path d="M248 8C111 8 0 119 0 256s111 248 248 248 248-111 248-248S385 8 248 8zm114 358c-4 7-14 9-21 5-58-35-131-43-217-24-8 2-16-3-18-11-2-8 3-16 11-18 94-21 175-12 240 27 7 4 9 14 5 21zm30-67c-6 9-17 12-26 7-66-41-167-53-246-29-10 3-21-3-24-13-3-10 3-21 13-24 90-27 201-14 276 33 9 5 12 17 7 26zm3-70c-79-47-210-51-285-28-12 4-25-3-28-15-4-12 3-25 15-28 86-26 230-21 321 33 11 6 14 21 8 32-6 10-20 14-31 6z"/>
          </g>
          ${bars.join('')}
        </svg>
      `;
    },

    async updateSpotifyPreview(inputVal) {
      const val = (inputVal || document.getElementById('spotifyUrlInput')?.value || '').trim();
      const previewContainer = document.getElementById('frontWaveformContainer');
      const songInfoEl = document.getElementById('previewSongInfo');

      this.previewState.spotifyUrl = val;

      if (!val) {
        if (previewContainer) previewContainer.innerHTML = this.generateLocalSvg('tunetagz-default');
        if (songInfoEl) songInfoEl.innerHTML = '<span class="song-title">Your Favorite Track</span> <span class="song-artist">Scan & Play on Spotify</span>';
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
            songInfoEl.innerHTML = `<span class="song-title">${this.previewState.trackTitle}</span> <span class="song-artist">${this.previewState.artistName}</span>`;
          }
        }
      } catch (err) {
        // Fallback gracefully to local SVG generator
        if (previewContainer) previewContainer.innerHTML = this.generateLocalSvg(val);
        if (songInfoEl) {
          songInfoEl.innerHTML = `<span class="song-title">Spotify Track</span> <span class="song-artist">${val.slice(0, 32)}...</span>`;
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
        charCounter.textContent = `${cleanText.length} / 30`;
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
        ring.className = `tag-keyring ring-${finish.toLowerCase().replace(' ', '-')}`;
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
      const modalHtml = `
        <div class="ttz-modal-backdrop" id="${this.modalId}" role="dialog" aria-modal="true" aria-labelledby="customizerTitle">
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
                            ${this.generateLocalSvg('tunetagz-default')}
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
      `;

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
