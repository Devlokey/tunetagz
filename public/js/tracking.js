/**
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
          resultContainer.innerHTML = '<div class="track-empty">Please enter an Order Number or Order ID.</div>';
        }
        return;
      }

      try {
        if (btn) {
          btn.disabled = true;
          btn.innerHTML = '<span class="spinner"></span> Searching...';
        }
        if (resultContainer) {
          resultContainer.innerHTML = '<div class="track-loading"><span class="spinner"></span> Fetching live order status...</div>';
        }

        const res = await API.orders.track(query, phoneOrEmail);
        if (res && res.success && res.order) {
          this.renderTimeline(res.order);
        } else {
          throw new Error(res?.error || 'Order not found.');
        }
      } catch (err) {
        if (resultContainer) {
          resultContainer.innerHTML = `
            <div class="track-error-card">
              <span class="err-icon">⚠️</span>
              <h4>Order Not Found</h4>
              <p>${err.message || 'No order found matching this Order Number. Please verify and try again.'}</p>
            </div>
          `;
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

      const itemsHtml = (order.items || []).map(item => `
        <div class="track-item-card">
          <div class="item-head">
            <strong>${item.productName || 'Spotify Code Tag'}</strong>
            <span class="item-qty">Qty: ${item.quantity || 1} • ₹${item.unitPrice || 699}</span>
          </div>
          ${item.spotifyUrl ? `
            <div class="item-spotify-row">
              <span class="sp-icon">🎵</span>
              <a href="${item.spotifyUrl}" target="_blank" rel="noopener noreferrer">${item.songTitle || item.spotifyUrl}</a>
            </div>
          ` : ''}
          ${item.customText ? `
            <div class="item-engraved-row">
              <span class="eng-icon">✒️ Laser Engraving:</span>
              <strong class="eng-val">"${item.customText}"</strong>
            </div>
          ` : ''}
        </div>
      `).join('');

      const stepsHtml = MILESTONES.map((step, idx) => {
        const isCompleted = !isCancelled && idx <= activeIdx;
        const isCurrent = !isCancelled && idx === activeIdx;
        const stepClass = isCancelled ? 'step-cancelled' : isCompleted ? (isCurrent ? 'step-current' : 'step-completed') : 'step-pending';
        const icon = isCompleted ? (isCurrent ? '●' : '✓') : '○';

        return `
          <div class="stepper-step ${stepClass}">
            <div class="step-indicator">
              <span class="step-bullet">${icon}</span>
              ${idx < MILESTONES.length - 1 ? '<div class="step-line"></div>' : ''}
            </div>
            <div class="step-content">
              <h4 class="step-label">${step.label}</h4>
              <p class="step-desc">${step.desc}</p>
            </div>
          </div>
        `;
      }).join('');

      container.innerHTML = `
        <div class="order-track-card">
          <div class="order-track-header">
            <div>
              <span class="order-num-badge">${order.orderNumber || order.id}</span>
              <h3 class="order-customer-name">Order for ${order.customerName || 'Customer'}</h3>
            </div>
            <div class="order-status-badge status-${currentStatus.toLowerCase()}">
              ${order.statusDisplay || currentStatus}
            </div>
          </div>

          ${isCancelled ? `
            <div class="cancelled-alert">
              <span>⚠️ This order has been cancelled.</span>
            </div>
          ` : ''}

          <!-- 5-Step Visual Stepper -->
          <div class="track-stepper">
            ${stepsHtml}
          </div>

          <!-- Courier Info (if Dispatched/Delivered) -->
          ${order.courierName || order.trackingNumber ? `
            <div class="courier-dispatch-info">
              <div class="courier-row">
                <span>🚚 Courier Partner:</span>
                <strong>${order.courierName || 'BlueDart / Delhivery'}</strong>
              </div>
              <div class="courier-row">
                <span>📋 Tracking AWB:</span>
                <strong class="gold-text">${order.trackingNumber || 'TTZ-AWB-PENDING'}</strong>
              </div>
            </div>
          ` : ''}

          <!-- Customized Products List -->
          <div class="track-section">
            <h4 class="track-sec-title">Customized Items</h4>
            <div class="track-items-grid">
              ${itemsHtml || '<p class="no-items">Custom Spotify Keychain</p>'}
            </div>
          </div>

          <!-- Shipping Address -->
          ${order.shippingAddress ? `
            <div class="track-section">
              <h4 class="track-sec-title">Delivery Address</h4>
              <p class="shipping-address-text">
                ${order.shippingAddress.addressLine1 || order.shippingAddress.line1 || ''}, 
                ${order.shippingAddress.city || ''}, ${order.shippingAddress.state || ''} - ${order.shippingAddress.postalCode || order.shippingAddress.pincode || ''}
              </p>
            </div>
          ` : ''}
        </div>
      `;
    },

    async loadMyOrders() {
      const container = document.getElementById('myOrdersContainer');
      if (!container) return;

      const token = API.getToken();
      if (!token) {
        container.innerHTML = `
          <div class="track-login-prompt">
            <span class="prompt-icon">🔒</span>
            <h3>Sign in to view your order history</h3>
            <p>Access your past Spotify keychain orders, customization details, and invoices.</p>
            <button type="button" class="btn-primary" onclick="AuthModal.open('login')">Sign In / Register</button>
          </div>
        `;
        return;
      }

      try {
        container.innerHTML = '<div class="track-loading"><span class="spinner"></span> Loading your orders...</div>';
        const res = await API.orders.getMyOrders();
        const orders = res && res.data ? res.data : (res && res.orders ? res.orders : []);

        if (!orders || orders.length === 0) {
          container.innerHTML = `
            <div class="track-empty">
              <span class="empty-icon">📦</span>
              <h3>No orders found</h3>
              <p>You haven't placed any orders yet. Customize your first Spotify tag!</p>
              <button type="button" class="btn-primary" onclick="TrackingModal.close(); CustomizerModal.open();">Customize Now</button>
            </div>
          `;
          return;
        }

        container.innerHTML = `
          <div class="my-orders-list">
            ${orders.map(o => `
              <div class="my-order-card">
                <div class="my-order-head">
                  <div>
                    <strong class="gold-text">${o.orderNumber || o.order_number || o.id}</strong>
                    <span class="order-date">${new Date(o.createdAt || o.created_at || Date.now()).toLocaleDateString('en-IN', { day: 'numeric', month: 'short', year: 'numeric' })}</span>
                  </div>
                  <span class="order-status-badge status-${(o.status || 'ORDER_RECEIVED').toLowerCase()}">${o.status}</span>
                </div>
                <div class="my-order-body">
                  <p class="order-items-summary">${(o.items || []).map(i => i.productName || 'Spotify Tag').join(', ') || 'Custom Keychain'}</p>
                  <strong class="order-amount">₹${o.totalAmount || o.total_amount || 699}</strong>
                </div>
                <div class="my-order-foot">
                  <button type="button" class="btn-ghost btn-sm" onclick="TrackingModal.switchTab('track'); TrackingModal.searchOrder('${o.orderNumber || o.id}');">
                    🔍 View Live Tracking
                  </button>
                </div>
              </div>
            `).join('')}
          </div>
        `;
      } catch (err) {
        container.innerHTML = `
          <div class="track-error-card">
            <h4>Failed to load order history</h4>
            <p>${err.message || 'Please check your connection and try again.'}</p>
          </div>
        `;
      }
    },

    renderModal() {
      const modalHtml = `
        <div class="ttz-modal-backdrop" id="${this.modalId}" role="dialog" aria-modal="true" aria-labelledby="trackModalTitle">
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
      `;

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
