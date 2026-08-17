/**
 * TuneTagZ Test Suite — HTTP Client Helper
 * Lightweight HTTP fetch wrapper with support for JSON, multipart FormData,
 * cookies, authorization headers, and error formatting.
 */

const http = require('http');
const https = require('https');
const { URL } = require('url');

class HttpClient {
  constructor(baseUrl = process.env.TEST_BASE_URL || 'http://localhost:3000') {
    this.baseUrl = baseUrl.replace(/\/$/, '');
    this.cookies = new Map();
    this.defaultHeaders = {};
  }

  setToken(token) {
    if (token) {
      this.defaultHeaders['Authorization'] = `Bearer ${token}`;
    } else {
      delete this.defaultHeaders['Authorization'];
    }
  }

  clearToken() {
    delete this.defaultHeaders['Authorization'];
    this.cookies.clear();
  }

  clearAuth() {
    delete this.defaultHeaders['Authorization'];
    this.cookies.clear();
  }

  setCookie(name, value) {
    this.cookies.set(name, value);
  }

  clearCookies() {
    this.cookies.clear();
  }

  _getCookieHeader() {
    if (this.cookies.size === 0) return '';
    return Array.from(this.cookies.entries())
      .map(([k, v]) => `${k}=${v}`)
      .join('; ');
  }

  _parseSetCookie(setCookieHeaders) {
    if (!setCookieHeaders) return;
    const headers = Array.isArray(setCookieHeaders) ? setCookieHeaders : [setCookieHeaders];
    for (const header of headers) {
      const parts = header.split(';')[0].split('=');
      if (parts.length >= 2) {
        const key = parts[0].trim();
        const val = parts.slice(1).join('=').trim();
        this.cookies.set(key, val);
      }
    }
  }

  async request(path, options = {}) {
    const fullUrl = path.startsWith('http') ? path : `${this.baseUrl}${path.startsWith('/') ? '' : '/'}${path}`;
    const headers = { ...this.defaultHeaders, ...(options.headers || {}) };

    const cookieHeader = this._getCookieHeader();
    if (cookieHeader && !headers['Cookie'] && !headers['cookie']) {
      headers['Cookie'] = cookieHeader;
    }

    let body = options.body;
    if (body && typeof body === 'object' && !(body instanceof FormData) && !(body instanceof Buffer) && !(typeof body?.pipe === 'function')) {
      if (!headers['Content-Type'] && !headers['content-type']) {
        headers['Content-Type'] = 'application/json';
      }
      if (headers['Content-Type']?.includes('application/json')) {
        body = JSON.stringify(body);
      }
    }

    try {
      const response = await fetch(fullUrl, {
        method: options.method || 'GET',
        headers,
        body: ['GET', 'HEAD'].includes((options.method || 'GET').toUpperCase()) ? undefined : body,
        redirect: options.redirect || 'manual'
      });

      const setCookie = response.headers.get('set-cookie');
      if (setCookie) {
        this._parseSetCookie(setCookie);
      }

      const contentType = response.headers.get('content-type') || '';
      let data = null;
      let text = '';

      if (contentType.includes('application/json')) {
        try {
          text = await response.text();
          data = text ? JSON.parse(text) : null;
        } catch (e) {
          data = text;
        }
      } else {
        text = await response.text();
        data = text;
      }

      return {
        status: response.status,
        ok: response.ok,
        headers: response.headers,
        data,
        text,
        url: response.url
      };
    } catch (error) {
      return {
        status: 0,
        ok: false,
        headers: new Headers(),
        data: null,
        text: '',
        error: error.message
      };
    }
  }

  get(path, headers = {}) {
    return this.request(path, { method: 'GET', headers });
  }

  post(path, body = {}, headers = {}) {
    return this.request(path, { method: 'POST', body, headers });
  }

  put(path, body = {}, headers = {}) {
    return this.request(path, { method: 'PUT', body, headers });
  }

  patch(path, body = {}, headers = {}) {
    return this.request(path, { method: 'PATCH', body, headers });
  }

  delete(path, headers = {}) {
    return this.request(path, { method: 'DELETE', headers });
  }

  /**
   * Helper to upload multipart form data (e.g. image files)
   */
  async uploadFile(path, fieldName, fileBuffer, fileName, mimeType, additionalFields = {}, headers = {}) {
    const boundary = '----WebKitFormBoundary' + Math.random().toString(36).substring(2);
    const chunks = [];

    // Additional fields
    for (const [key, value] of Object.entries(additionalFields)) {
      chunks.push(Buffer.from(
        `--${boundary}\r\n` +
        `Content-Disposition: form-data; name="${key}"\r\n\r\n` +
        `${value}\r\n`
      ));
    }

    // File field
    chunks.push(Buffer.from(
      `--${boundary}\r\n` +
      `Content-Disposition: form-data; name="${fieldName}"; filename="${fileName}"\r\n` +
      `Content-Type: ${mimeType}\r\n\r\n`
    ));
    chunks.push(Buffer.isBuffer(fileBuffer) ? fileBuffer : Buffer.from(fileBuffer));
    chunks.push(Buffer.from(`\r\n--${boundary}--\r\n`));

    const payload = Buffer.concat(chunks);
    const requestHeaders = {
      ...headers,
      'Content-Type': `multipart/form-data; boundary=${boundary}`,
      'Content-Length': payload.length
    };

    return this.request(path, {
      method: 'POST',
      body: payload,
      headers: requestHeaders
    });
  }
}

module.exports = { HttpClient };
