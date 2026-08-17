/**
 * TuneTagZ Centralized Frontend API Client
 * Manages HTTP communication, JWT authorization headers, session state, and error handling.
 */
(function (global) {
  "use strict";

  const BASE_URL = "";
  const TOKEN_KEY = "tunetagz_token";
  const USER_KEY = "tunetagz_user";
  const ADMIN_TOKEN_KEY = "tunetagz_admin_token";
  const ADMIN_USER_KEY = "tunetagz_admin_user";

  const API = {
    // ── Session & Storage Management ──
    getToken() {
      try {
        return localStorage.getItem(TOKEN_KEY) || null;
      } catch (e) {
        return null;
      }
    },
    setToken(token) {
      try {
        if (token) localStorage.setItem(TOKEN_KEY, token);
        else localStorage.removeItem(TOKEN_KEY);
      } catch (e) {}
    },
    getUser() {
      try {
        const raw = localStorage.getItem(USER_KEY);
        return raw ? JSON.parse(raw) : null;
      } catch (e) {
        return null;
      }
    },
    setUser(user) {
      try {
        if (user) localStorage.setItem(USER_KEY, JSON.stringify(user));
        else localStorage.removeItem(USER_KEY);
      } catch (e) {}
    },
    clearAuth() {
      try {
        localStorage.removeItem(TOKEN_KEY);
        localStorage.removeItem(USER_KEY);
      } catch (e) {}
    },
    getAdminToken() {
      try {
        return localStorage.getItem(ADMIN_TOKEN_KEY) || localStorage.getItem(TOKEN_KEY) || null;
      } catch (e) {
        return null;
      }
    },
    setAdminToken(token) {
      try {
        if (token) localStorage.setItem(ADMIN_TOKEN_KEY, token);
        else localStorage.removeItem(ADMIN_TOKEN_KEY);
      } catch (e) {}
    },
    getAdminUser() {
      try {
        const raw = localStorage.getItem(ADMIN_USER_KEY);
        return raw ? JSON.parse(raw) : null;
      } catch (e) {
        return null;
      }
    },
    setAdminUser(user) {
      try {
        if (user) localStorage.setItem(ADMIN_USER_KEY, JSON.stringify(user));
        else localStorage.removeItem(ADMIN_USER_KEY);
      } catch (e) {}
    },
    clearAdminAuth() {
      try {
        localStorage.removeItem(ADMIN_TOKEN_KEY);
        localStorage.removeItem(ADMIN_USER_KEY);
      } catch (e) {}
    },

    // ── Core Fetch Request Wrapper ──
    async request(endpoint, options = {}) {
      const url = endpoint.startsWith("http") ? endpoint : `${BASE_URL}${endpoint}`;
      const headers = Object.assign({}, options.headers || {});
      const isAdminReq = endpoint.startsWith("/api/admin") || options.isAdmin;
      const token = isAdminReq ? (this.getAdminToken() || this.getToken()) : this.getToken();

      if (token && !headers["Authorization"]) {
        headers["Authorization"] = `Bearer ${token}`;
      }

      // Automatically set JSON content type if body is not FormData
      if (options.body && !(options.body instanceof FormData) && typeof options.body === "object") {
        headers["Content-Type"] = "application/json";
        options.body = JSON.stringify(options.body);
      }

      const fetchConfig = Object.assign({}, options, {
        headers,
        credentials: options.credentials || "same-origin"
      });

      try {
        const response = await fetch(url, fetchConfig);
        const contentType = response.headers.get("content-type") || "";
        let data = null;

        if (contentType.includes("application/json")) {
          data = await response.json();
        } else {
          data = await response.text();
        }

        if (!response.ok) {
          const errorMessage = (data && data.error) || (data && data.message) || response.statusText || "Request failed";
          const err = new Error(errorMessage);
          err.status = response.status;
          err.data = data;
          throw err;
        }

        return data;
      } catch (err) {
        if (!err.status) {
          err.message = err.message || "Network error. Please check your internet connection.";
        }
        throw err;
      }
    },

    // ── Authentication Endpoints ──
    auth: {
      async register(payload) {
        const res = await API.request("/api/auth/register", {
          method: "POST",
          body: payload
        });
        if (res.token && res.user) {
          API.setToken(res.token);
          API.setUser(res.user);
        }
        return res;
      },
      async login(payload) {
        const res = await API.request("/api/auth/login", {
          method: "POST",
          body: payload
        });
        if (res.token && res.user) {
          API.setToken(res.token);
          API.setUser(res.user);
        }
        return res;
      },
      async google(payload) {
        const res = await API.request("/api/auth/google", {
          method: "POST",
          body: payload
        });
        if (res.token && res.user) {
          API.setToken(res.token);
          API.setUser(res.user);
        }
        return res;
      },
      async adminLogin(payload) {
        const res = await API.request("/api/auth/admin/login", {
          method: "POST",
          body: payload
        });
        if (res.token && res.user) {
          API.setAdminToken(res.token);
          API.setAdminUser(res.user);
          API.setToken(res.token);
          API.setUser(res.user);
        }
        return res;
      },
      async getMe() {
        return API.request("/api/auth/me", { method: "GET" });
      },
      async logout() {
        try {
          await API.request("/api/auth/logout", { method: "POST" });
        } catch (e) {}
        API.clearAuth();
        API.clearAdminAuth();
        return { success: true };
      }
    },

    // ── Product Endpoints ──
    products: {
      async list() {
        return API.request("/api/products", { method: "GET" });
      },
      async get(id) {
        return API.request(`/api/products/${encodeURIComponent(id)}`, { method: "GET" });
      },
      async uploadImage(formData) {
        return API.request("/api/products/upload", {
          method: "POST",
          body: formData,
          isAdmin: true
        });
      },
      async create(data) {
        const isForm = data instanceof FormData;
        return API.request("/api/products", {
          method: "POST",
          body: data,
          isAdmin: true
        });
      },
      async update(id, data) {
        return API.request(`/api/products/${encodeURIComponent(id)}`, {
          method: "PUT",
          body: data,
          isAdmin: true
        });
      },
      async toggleStock(id, inStock) {
        return API.request(`/api/products/${encodeURIComponent(id)}/stock`, {
          method: "PATCH",
          body: { in_stock: inStock !== undefined ? inStock : true },
          isAdmin: true
        });
      },
      async delete(id) {
        return API.request(`/api/products/${encodeURIComponent(id)}`, {
          method: "DELETE",
          isAdmin: true
        });
      }
    },

    // ── Spotify Customizer Endpoints ──
    spotify: {
      async preview(urlOrUri) {
        return API.request(`/api/spotify/preview?url=${encodeURIComponent(urlOrUri)}`, { method: "GET" });
      }
    },

    // ── Orders & Tracking Endpoints ──
    orders: {
      async calculate(items) {
        return API.request("/api/orders/calculate", {
          method: "POST",
          body: { items }
        });
      },
      async create(orderPayload) {
        return API.request("/api/orders", {
          method: "POST",
          body: orderPayload
        });
      },
      async track(orderIdOrNumber, emailOrPhone = null) {
        let endpoint = `/api/orders/${encodeURIComponent(orderIdOrNumber)}/track`;
        if (emailOrPhone) {
          endpoint += `?emailOrPhone=${encodeURIComponent(emailOrPhone)}`;
        }
        return API.request(endpoint, { method: "GET" });
      },
      async getMyOrders() {
        return API.request("/api/orders/my-orders", { method: "GET" });
      },
      async get(orderId) {
        return API.request(`/api/orders/${encodeURIComponent(orderId)}`, { method: "GET" });
      }
    },

    // ── Payments Endpoints ──
    payments: {
      async createOrder(payload) {
        return API.request("/api/payments/create-order", {
          method: "POST",
          body: payload
        });
      },
      async verify(verificationData) {
        return API.request("/api/payments/verify", {
          method: "POST",
          body: verificationData
        });
      }
    },

    // ── Admin Portal Endpoints ──
    admin: {
      async getStats() {
        return API.request("/api/admin/stats", { method: "GET", isAdmin: true });
      },
      async getOrders(params = {}) {
        const query = new URLSearchParams();
        if (params.status) query.append("status", params.status);
        if (params.search) query.append("search", params.search);
        if (params.page) query.append("page", params.page);
        if (params.limit) query.append("limit", params.limit);
        const qs = query.toString() ? `?${query.toString()}` : "";
        return API.request(`/api/admin/orders${qs}`, { method: "GET", isAdmin: true });
      },
      async getOrder(id) {
        return API.request(`/api/admin/orders/${encodeURIComponent(id)}`, { method: "GET", isAdmin: true });
      },
      async updateOrderStatus(id, status, courierInfo = {}) {
        return API.request(`/api/admin/orders/${encodeURIComponent(id)}/status`, {
          method: "PATCH",
          body: {
            status,
            courier_name: courierInfo.courier_name || courierInfo.courierName,
            tracking_number: courierInfo.tracking_number || courierInfo.trackingNumber,
            notes: courierInfo.notes
          },
          isAdmin: true
        });
      },
      async cancelOrder(id, reason = "") {
        return API.request(`/api/admin/orders/${encodeURIComponent(id)}/cancel`, {
          method: "POST",
          body: { reason },
          isAdmin: true
        });
      },
      async getProducts(params = {}) {
        const query = new URLSearchParams();
        if (params.search) query.append("search", params.search);
        if (params.in_stock !== undefined) query.append("in_stock", params.in_stock);
        const qs = query.toString() ? `?${query.toString()}` : "";
        return API.request(`/api/admin/products${qs}`, { method: "GET", isAdmin: true });
      },
      async createProduct(formDataOrJson) {
        return API.request("/api/admin/products", {
          method: "POST",
          body: formDataOrJson,
          isAdmin: true
        });
      },
      async updateProduct(id, formDataOrJson) {
        return API.request(`/api/admin/products/${encodeURIComponent(id)}`, {
          method: "PUT",
          body: formDataOrJson,
          isAdmin: true
        });
      },
      async toggleStock(id, inStock) {
        return API.request(`/api/admin/products/${encodeURIComponent(id)}/stock`, {
          method: "PATCH",
          body: { in_stock: inStock },
          isAdmin: true
        });
      },
      async deleteProduct(id) {
        return API.request(`/api/admin/products/${encodeURIComponent(id)}`, {
          method: "DELETE",
          isAdmin: true
        });
      },
      async getSettings() {
        return API.request("/api/admin/settings", { method: "GET", isAdmin: true });
      },
      async updateSettings(settings) {
        return API.request("/api/admin/settings", {
          method: "PUT",
          body: settings,
          isAdmin: true
        });
      },
      async getAuditLogs(params = {}) {
        const query = new URLSearchParams();
        if (params.page) query.append("page", params.page);
        if (params.limit) query.append("limit", params.limit);
        const qs = query.toString() ? `?${query.toString()}` : "";
        return API.request(`/api/admin/audit-logs${qs}`, { method: "GET", isAdmin: true });
      }
    }
  };

  global.API = API;
})(typeof window !== "undefined" ? window : globalThis);
