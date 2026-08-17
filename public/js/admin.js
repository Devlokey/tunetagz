/**
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
        btn.innerHTML = '<span class="spinner"></span> Authenticating...';

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
        el.style.display = el.id === `pane-${tabName}` ? 'block' : 'none';
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
          document.getElementById('statTotalSales').textContent = `₹${res.stats.totalSales || 0}`;
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
        container.innerHTML = '<tr><td colspan="6" class="text-center">No orders placed yet.</td></tr>';
        return;
      }

      container.innerHTML = recent.map(o => `
        <tr>
          <td><strong>${o.orderNumber || o.id}</strong></td>
          <td>${o.customerName}<br/><small class="text-muted">${o.customerEmail}</small></td>
          <td>${o.itemsSummary || 'Custom Tag'}</td>
          <td><strong>₹${o.totalAmount}</strong></td>
          <td><span class="badge-status status-${(o.status || '').toLowerCase()}">${o.status}</span></td>
          <td>
            <button class="btn-sm btn-ghost" onclick="AdminApp.openOrderDetails('${o.id}')">View</button>
          </td>
        </tr>
      `).join('');
    },

    // ── Load Products Catalog ──
    async loadProducts() {
      const container = document.getElementById('adminProductsTableBody');
      if (!container) return;

      try {
        container.innerHTML = '<tr><td colspan="7" class="text-center"><span class="spinner"></span> Loading products...</td></tr>';
        const res = await API.products.list();
        this.products = res && res.data ? res.data : [];

        if (this.products.length === 0) {
          container.innerHTML = '<tr><td colspan="7" class="text-center">No products found in catalog.</td></tr>';
          return;
        }

        container.innerHTML = this.products.map(p => `
          <tr>
            <td>
              <img src="${p.image_url || 'POSTER 1.png'}" alt="${p.name}" class="admin-prod-thumb" />
            </td>
            <td><strong>${p.name}</strong><br/><small class="text-muted">${p.sku || 'SKU-00'}</small></td>
            <td><strong>₹${p.price}</strong> ${p.original_price ? `<del class="text-muted">₹${p.original_price}</del>` : ''}</td>
            <td><span class="badge-tag">${p.badge || 'Standard'}</span></td>
            <td>
              <label class="toggle-switch">
                <input type="checkbox" ${p.in_stock ? 'checked' : ''} onchange="AdminApp.toggleProductStock('${p.id}', this.checked)" />
                <span class="toggle-slider"></span>
              </label>
              <span class="stock-label ${p.in_stock ? 'in-stock' : 'out-stock'}">${p.in_stock ? 'In Stock' : 'Out of Stock'}</span>
            </td>
            <td>${p.is_customizable ? '✓ Yes' : 'No'}</td>
            <td>
              <div class="action-btn-group">
                <button class="btn-sm btn-ghost" onclick="AdminApp.editProduct('${p.id}')">Edit</button>
                <button class="btn-sm btn-danger" onclick="AdminApp.deleteProduct('${p.id}', '${p.name}')">Delete</button>
              </div>
            </td>
          </tr>
        `).join('');
      } catch (err) {
        container.innerHTML = `<tr><td colspan="7" class="text-danger text-center">Failed to load products: ${err.message}</td></tr>`;
      }
    },

    async toggleProductStock(id, inStock) {
      try {
        await API.admin.toggleStock(id, inStock);
        showToast(`Product stock updated to ${inStock ? 'In Stock' : 'Out of Stock'}.`, 'success');
      } catch (err) {
        showToast('Failed to update stock: ' + err.message, 'error');
        this.loadProducts();
      }
    },

    async deleteProduct(id, name) {
      if (!confirm(`Are you sure you want to delete product "${name}"?`)) return;
      try {
        await API.admin.deleteProduct(id);
        showToast(`Product "${name}" deleted successfully.`, 'success');
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
        btn.innerHTML = '<span class="spinner"></span> Creating Product...';

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
        container.innerHTML = '<tr><td colspan="7" class="text-center"><span class="spinner"></span> Loading orders...</td></tr>';
        const res = await API.admin.getOrders({ status: statusFilter, search: searchText });
        this.orders = res && res.orders ? res.orders : (res && res.data ? res.data : []);

        if (this.orders.length === 0) {
          container.innerHTML = '<tr><td colspan="7" class="text-center">No orders found matching filters.</td></tr>';
          return;
        }

        container.innerHTML = this.orders.map(o => `
          <tr>
            <td><strong>${o.order_number || o.orderNumber || o.id}</strong></td>
            <td>${o.customer_name || o.customerName}<br/><small class="text-muted">${o.customer_email || o.customerEmail}</small></td>
            <td>${o.customer_phone || o.customerPhone || 'N/A'}</td>
            <td><strong>₹${o.total_amount || o.totalAmount}</strong></td>
            <td><span class="badge-status status-${(o.status || '').toLowerCase()}">${o.status}</span></td>
            <td>${new Date(o.created_at || o.createdAt || Date.now()).toLocaleDateString('en-IN')}</td>
            <td>
              <div class="action-btn-group">
                <button class="btn-sm btn-ghost" onclick="AdminApp.openOrderDetails('${o.id}')">Details</button>
                <button class="btn-sm btn-gold" onclick="AdminApp.openAdvanceStatusModal('${o.id}', '${o.status}')">Advance Status</button>
              </div>
            </td>
          </tr>
        `).join('');
      } catch (err) {
        container.innerHTML = `<tr><td colspan="7" class="text-danger text-center">Failed to load orders: ${err.message}</td></tr>`;
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

        const modalHtml = `
          <div class="ttz-modal-backdrop is-open" id="adminOrderDetailsModal">
            <div class="ttz-modal-container admin-order-details-container">
              <button class="ttz-modal-close" onclick="document.getElementById('adminOrderDetailsModal').remove()">✕</button>
              <div class="modal-header">
                <h2>Order Details: ${o.orderNumber || o.order_number}</h2>
                <span class="badge-status status-${(o.status || '').toLowerCase()}">${o.status}</span>
              </div>
              <div class="order-details-grid">
                <div class="details-section">
                  <h4>Customer Info</h4>
                  <p><strong>Name:</strong> ${o.customerName}</p>
                  <p><strong>Email:</strong> ${o.customerEmail}</p>
                  <p><strong>Phone:</strong> ${o.customerPhone || 'N/A'}</p>
                </div>
                <div class="details-section">
                  <h4>Shipping Address</h4>
                  <p>${o.shippingAddress?.addressLine1 || 'N/A'}</p>
                  <p>${o.shippingAddress?.city || ''}, ${o.shippingAddress?.state || ''} - ${o.shippingAddress?.postalCode || ''}</p>
                </div>
              </div>
              <div class="details-section">
                <h4>Items & Customization</h4>
                ${(o.items || []).map(i => `
                  <div class="admin-item-card">
                    <p><strong>${i.productName}</strong> (Qty: ${i.quantity}) - ₹${i.unitPrice}</p>
                    ${i.spotifyUrl ? `<p>🎵 <strong>Spotify Link:</strong> <a href="${i.spotifyUrl}" target="_blank">${i.spotifyUrl}</a></p>` : ''}
                    ${i.customText ? `<p>✒️ <strong>Engraved Text:</strong> "${i.customText}"</p>` : ''}
                  </div>
                `).join('')}
              </div>
            </div>
          </div>
        `;
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
        showToast(`Order is in terminal status "${currentStatus}". No further transitions allowed.`, 'info');
        return;
      }

      const options = nextStatuses.map(s => `<option value="${s}">${s}</option>`).join('');

      const modalHtml = `
        <div class="ttz-modal-backdrop is-open" id="advanceStatusModal">
          <div class="ttz-modal-container advance-status-container">
            <button class="ttz-modal-close" onclick="document.getElementById('advanceStatusModal').remove()">✕</button>
            <h3>Update Fulfillment Status</h3>
            <p>Current Status: <strong>${currentStatus}</strong></p>
            
            <form id="advanceStatusForm" onsubmit="AdminApp.handleAdvanceStatusSubmit(event, '${orderId}')">
              <div class="form-group">
                <label for="nextStatusSelect">Advance to New Status</label>
                <select id="nextStatusSelect" required onchange="AdminApp.toggleCourierInputs(this.value)">
                  ${options}
                </select>
              </div>

              <div id="courierInputsGroup" style="display: ${nextStatuses[0] === 'DISPATCHED' ? 'block' : 'none'};">
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
      `;

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
        btn.innerHTML = '<span class="spinner"></span> Updating...';

        await API.admin.updateOrderStatus(orderId, status, {
          courier_name: courierName,
          tracking_number: trackingNumber
        });

        document.getElementById('advanceStatusModal')?.remove();
        showToast(`Order status advanced to ${status}!`, 'success');
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
        container.innerHTML = '<tr><td colspan="5" class="text-center"><span class="spinner"></span> Loading logs...</td></tr>';
        const res = await API.admin.getAuditLogs();
        const logs = res && res.logs ? res.logs : (res && res.data ? res.data : []);

        if (logs.length === 0) {
          container.innerHTML = '<tr><td colspan="5" class="text-center">No audit logs recorded yet.</td></tr>';
          return;
        }

        container.innerHTML = logs.map(l => `
          <tr>
            <td><strong>${l.action}</strong></td>
            <td>${l.target_type || 'SYSTEM'} (${l.target_id || '-'})</td>
            <td><small>${typeof l.details === 'object' ? JSON.stringify(l.details) : (l.details || '-')}</small></td>
            <td>${l.admin_name || l.admin_email || 'Admin'}</td>
            <td>${new Date(l.created_at || Date.now()).toLocaleString('en-IN')}</td>
          </tr>
        `).join('');
      } catch (err) {
        container.innerHTML = `<tr><td colspan="5" class="text-danger text-center">Failed to load logs: ${err.message}</td></tr>`;
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
