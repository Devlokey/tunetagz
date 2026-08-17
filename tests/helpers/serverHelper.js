/**
 * TuneTagZ Test Suite — Server Lifecycle Helper
 * Starts backend server process if not running, monitors health,
 * and handles graceful teardown.
 */

require('dotenv').config();
const { spawn } = require('child_process');
const path = require('path');
const http = require('http');

let serverProcess = null;
let spawnedByRunner = false;

async function isPortOpen(port = 3000, host = '127.0.0.1') {
  return new Promise((resolve) => {
    const req = http.request({
      host,
      port,
      path: '/api/health',
      method: 'GET',
      timeout: 1000
    }, (res) => {
      resolve(true);
    });

    req.on('error', () => {
      const reqRoot = http.request({
        host,
        port,
        path: '/',
        method: 'GET',
        timeout: 1000
      }, (resRoot) => {
        resolve(true);
      });
      reqRoot.on('error', () => resolve(false));
      reqRoot.on('timeout', () => { reqRoot.destroy(); resolve(false); });
      reqRoot.end();
    });

    req.on('timeout', () => {
      req.destroy();
      resolve(false);
    });

    req.end();
  });
}

async function waitForServer(baseUrl, maxAttempts = 30, intervalMs = 300) {
  const url = new URL('/api/health', baseUrl);
  for (let i = 0; i < maxAttempts; i++) {
    try {
      const isAlive = await isPortOpen(url.port || 3000, url.hostname);
      if (isAlive) {
        return true;
      }
    } catch (e) {
      // Continue polling
    }
    await new Promise(r => setTimeout(r, intervalMs));
  }
  return false;
}

async function startServer(port = process.env.PORT || 3000) {
  const baseUrl = `http://localhost:${port}`;
  const alreadyRunning = await isPortOpen(port);

  if (alreadyRunning) {
    return { baseUrl, spawned: false, process: null };
  }

  const projectRoot = path.resolve(__dirname, '../../');
  const serverPath = path.join(projectRoot, 'server.js');

  const env = {
    ...process.env,
    PORT: String(port),
    NODE_ENV: 'test',
    MOCK_PAYMENTS: 'true',
    JWT_SECRET: process.env.JWT_SECRET || 'tunetagz_super_secret_jwt_key_2026_!#%',
    ADMIN_EMAIL: process.env.ADMIN_EMAIL || 'admin@tunetagz.com',
    ADMIN_PASSWORD: process.env.ADMIN_PASSWORD || 'Admin@TuneTagZ2026!',
    RAZORPAY_KEY_SECRET: process.env.RAZORPAY_KEY_SECRET || 'rzp_test_TuneTagZ2026Secret',
    RAZORPAY_WEBHOOK_SECRET: process.env.RAZORPAY_WEBHOOK_SECRET || 'rzp_webhook_secret_2026'
  };

  serverProcess = spawn(process.execPath, [serverPath], {
    cwd: projectRoot,
    env,
    stdio: ['ignore', 'pipe', 'pipe'],
    detached: false
  });

  spawnedByRunner = true;

  serverProcess.stdout.on('data', (data) => {
    if (process.env.DEBUG_SERVER) {
      process.stdout.write(`[SERVER STDOUT] ${data}`);
    }
  });

  serverProcess.stderr.on('data', (data) => {
    if (process.env.DEBUG_SERVER) {
      process.stderr.write(`[SERVER STDERR] ${data}`);
    }
  });

  const ready = await waitForServer(baseUrl, 30, 300);
  if (!ready) {
    stopServer();
    throw new Error(`Server failed to start on ${baseUrl} within timeout.`);
  }

  return { baseUrl, spawned: true, process: serverProcess };
}

function stopServer() {
  if (spawnedByRunner && serverProcess) {
    try {
      serverProcess.kill('SIGTERM');
    } catch (e) {
      try {
        serverProcess.kill('SIGKILL');
      } catch (err) {}
    }
    serverProcess = null;
    spawnedByRunner = false;
  }
}

module.exports = {
  startServer,
  stopServer,
  isPortOpen,
  waitForServer
};
