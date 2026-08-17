/**
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

      container.innerHTML = this.orderItems.map(item => `
        <div class="checkout-item-row">
          <div class="item-info">
            <strong>${item.productName || 'TuneTagZ Keychain'}</strong>
            <small class="item-custom-detail">
              ${item.songTitle ? `🎵 ${item.songTitle} • ` : ''}
              ${item.customText ? `✒️ "${item.customText}"` : ''}
            </small>
          </div>
          <div class="item-price-qty">
            <span>x${item.quantity || 1}</span>
            <strong>₹${Number(item.price) * (item.quantity || 1)}</strong>
          </div>
        </div>
      `).join('');

      if (subtotalEl) subtotalEl.textContent = `₹${this.totalAmount}`;
      if (totalEl) totalEl.textContent = `₹${this.totalAmount}`;
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
      if (!shippingData.phone.match(/^(\+91[\-\s]?)?[6-9]\d{9}$/)) {
        this.showError('Please enter a valid 10-digit Indian mobile number.');
        return;
      }
      if (!shippingData.pincode.match(/^\d{6}$/)) {
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
          description: `Order #${paymentData.orderNumber}`,
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
      const mockModalHtml = `
        <div class="ttz-modal-backdrop is-open" id="mockPaymentModal" style="z-index: 1200;">
          <div class="ttz-modal-container mock-payment-container">
            <div class="mock-header">
              <span class="mock-badge">SANDBOX MOCK GATEWAY</span>
              <h3>Razorpay Test Payment</h3>
              <p>Simulating Razorpay UPI / Card payment for ₹${paymentData.totalAmount || (paymentData.amount / 100)}</p>
            </div>
            <div class="mock-body">
              <p><strong>Order Number:</strong> ${paymentData.orderNumber}</p>
              <p><strong>Customer:</strong> ${shippingData.name} (${shippingData.email})</p>
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
      `;

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

      const confirmHtml = `
        <div class="ttz-modal-backdrop is-open" id="orderConfirmModal" role="dialog" aria-modal="true">
          <div class="ttz-modal-container order-confirm-container">
            <div class="confirm-icon">🎉</div>
            <h2 class="confirm-title">Order Confirmed!</h2>
            <p class="confirm-subtitle">Thank you for ordering with TuneTagZ. We've received your customization details and will begin laser engraving shortly.</p>
            
            <div class="confirm-card">
              <div class="confirm-row">
                <span>Order Number:</span>
                <strong class="gold-text">${orderNum}</strong>
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
      `;

      document.body.insertAdjacentHTML('beforeend', confirmHtml);

      document.getElementById('btnConfirmTrackOrder')?.addEventListener('click', () => {
        document.getElementById('orderConfirmModal')?.remove();
        if (global.TrackingModal) {
          global.TrackingModal.open(orderNum);
        }
      });
    },

    renderModal() {
      const statesOptions = INDIAN_STATES.map(s => `<option value="${s}">${s}</option>`).join('');

      const modalHtml = `
        <div class="ttz-modal-backdrop" id="${this.modalId}" role="dialog" aria-modal="true" aria-labelledby="checkoutModalTitle">
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
                        ${statesOptions}
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
      `;

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
