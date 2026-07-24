import { createServer } from 'node:http';
import { spawn } from 'node:child_process';
import { appendFile, mkdir, readFile, rm, writeFile } from 'node:fs/promises';
import { createInterface } from 'node:readline';
import { randomUUID } from 'node:crypto';
import { fileURLToPath } from 'node:url';
import { networkInterfaces } from 'node:os';
import path from 'node:path';
import { DesktopSessionizer } from './sessionizer.mjs';
import { loadOrCreateDesktopIdentity } from './device-identity.mjs';
import { HuaweiHealthConnector } from '../connectors/huawei-health/huawei-health.mjs';
import { appendEncryptedObservation, loadEncryptedObservations, parseEncryptionKey, rewriteEncryptedObservations } from './encrypted-observation-store.mjs';
import { BrowserPairing } from './browser-pairing.mjs';
import { DevicePairing } from './device-pairing.mjs';

const collectorDirectory = path.dirname(fileURLToPath(import.meta.url));
const projectDirectory = path.resolve(collectorDirectory, '..', '..');
const options = parseOptions(process.argv.slice(2));
const dataDirectory = options.dataDirectory
  ? path.resolve(options.dataDirectory)
  : path.join(projectDirectory, 'desktop', 'data');
const observationPath = path.join(dataDirectory, 'observations.ndjson');
const encryptedObservationPath = path.join(dataDirectory, 'observations.atira');
const browserPairingPath = path.join(dataDirectory, 'browser-pairing.atira');
const devicePairingPath = path.join(dataDirectory, 'device-pairing.atira');
const encryptionKey = parseEncryptionKey(process.env.ATIRA_COLLECTOR_ENCRYPTION_KEY);
const pidPath = path.join(dataDirectory, 'collector.pid');
const samplerPath = path.join(collectorDirectory, 'windows-sampler.ps1');
const allowedOrigins = new Set(['http://localhost:8081', 'http://127.0.0.1:8081', 'http://127.0.0.1:43124']);
const huaweiHealth = new HuaweiHealthConnector();
const observations = [];
const startedAt = new Date().toISOString();
let worker = null;
let stopping = false;

await mkdir(dataDirectory, { recursive: true });
const identity = await loadOrCreateDesktopIdentity(dataDirectory);
const browserPairing = new BrowserPairing({ filePath: browserPairingPath, encryptionKey });
await browserPairing.load();
const devicePairing = new DevicePairing({ filePath: devicePairingPath, encryptionKey });
await devicePairing.load();
const sessionizer = new DesktopSessionizer({ observationNamespace: identity.device.id });
await loadObservations();
await writeFile(pidPath, String(process.pid), 'utf8');

const server = createServer((request, response) => {
  const localRequest = isLoopbackAddress(request.socket.remoteAddress);
  const deviceSyncPath = request.url?.startsWith('/integrations/device/') ?? false;
  if (!localRequest && (!options.allowDeviceSync || !deviceSyncPath)) {
    sendJson(response, 403, { error: 'This collector endpoint is available only on the Windows computer.' });
    return;
  }
  const origin = request.headers.origin;
  const extensionOrigin = isExtensionOrigin(origin);
  if (origin && !allowedOrigins.has(origin) && !extensionOrigin) {
    sendJson(response, 403, { error: 'Origin is not allowed.' });
    return;
  }
  if (origin) {
    response.setHeader('Access-Control-Allow-Origin', origin);
    response.setHeader('Vary', 'Origin');
  }
  response.setHeader('Cache-Control', 'no-store');
  const url = new URL(request.url ?? '/', `http://127.0.0.1:${options.port}`);
  if (request.method === 'OPTIONS') {
    response.writeHead(204, { 'Access-Control-Allow-Methods': 'GET, POST, OPTIONS', 'Access-Control-Allow-Headers': 'Authorization, Content-Type' });
    response.end();
    return;
  }
  if (request.method === 'POST' && url.pathname === '/control/stop') {
    const suppliedToken = request.headers.authorization?.replace(/^Bearer\s+/i, '');
    if (!options.controlToken || suppliedToken !== options.controlToken) {
      sendJson(response, 403, { error: 'Invalid collector control token.' });
      return;
    }
    sendJson(response, 202, { stopping: true });
    setImmediate(() => void stop(0));
    return;
  }
  if (request.method === 'POST' && url.pathname === '/control/delete') {
    const suppliedToken = request.headers.authorization?.replace(/^Bearer\s+/i, '');
    if (!options.controlToken || suppliedToken !== options.controlToken) {
      sendJson(response, 403, { error: 'Invalid collector control token.' });
      return;
    }
    void readRequestJson(request)
      .then(async ({ range }) => {
        if (!['7d', '30d', 'all'].includes(range)) throw new Error('Unsupported deletion range.');
        const cutoff = range === 'all' ? Number.POSITIVE_INFINITY : Date.now() - (range === '7d' ? 7 : 30) * 86_400_000;
        const retained = observations.filter((item) => range !== 'all' && Date.parse(item.startedAt) < cutoff);
        const deleted = observations.length - retained.length;
        observations.splice(0, observations.length, ...retained);
        await rewriteObservationStore();
        sendJson(response, 200, { deleted });
      })
      .catch((error) => sendJson(response, 400, { error: error instanceof Error ? error.message : String(error) }));
    return;
  }
  if (request.method === 'POST' && url.pathname === '/control/browser-pairing-code') {
    if (!hasControlAuthorization(request)) return sendJson(response, 403, { error: 'Invalid collector control token.' });
    sendJson(response, 200, browserPairing.createCode());
    return;
  }
  if (request.method === 'POST' && url.pathname === '/control/browser-unpair') {
    if (!hasControlAuthorization(request)) return sendJson(response, 403, { error: 'Invalid collector control token.' });
    void browserPairing.unpair().then(() => sendJson(response, 200, browserPairing.status()))
      .catch((error) => sendJson(response, 500, { error: error instanceof Error ? error.message : String(error) }));
    return;
  }
  if (request.method === 'POST' && url.pathname === '/control/device-pairing-code') {
    if (!hasControlAuthorization(request)) return sendJson(response, 403, { error: 'Invalid collector control token.' });
    sendJson(response, 200, {
      ...devicePairing.createCode(),
      addresses: localNetworkAddresses().map((address) => `${address}:${options.port}`),
    });
    return;
  }
  if (request.method === 'POST' && url.pathname === '/control/device-unpair') {
    if (!hasControlAuthorization(request)) return sendJson(response, 403, { error: 'Invalid collector control token.' });
    void devicePairing.unpair().then(() => sendJson(response, 200, devicePairing.status()))
      .catch((error) => sendJson(response, 500, { error: error instanceof Error ? error.message : String(error) }));
    return;
  }
  if (request.method === 'POST' && url.pathname === '/integrations/device/pair') {
    if (!options.allowDeviceSync) return sendJson(response, 403, { error: 'Phone sync is not enabled on this Windows collector.' });
    void readRequestJson(request).then(async ({ code, clientId, label }) => {
      const token = await devicePairing.pair(String(code ?? ''), String(clientId ?? ''), String(label ?? 'ATIRA mobile device'));
      sendJson(response, 200, { token, device: identity.device, status: devicePairing.status() });
    }).catch((error) => sendJson(response, 403, { error: error instanceof Error ? error.message : String(error) }));
    return;
  }
  if (request.method === 'POST' && url.pathname === '/integrations/device/unpair') {
    const suppliedToken = request.headers.authorization?.replace(/^Bearer\s+/i, '');
    if (!devicePairing.authenticates(suppliedToken)) return sendJson(response, 403, { error: 'This phone is not paired with the Windows collector.' });
    void devicePairing.unpair().then(() => sendJson(response, 200, { paired: false }))
      .catch((error) => sendJson(response, 500, { error: error instanceof Error ? error.message : String(error) }));
    return;
  }
  if (request.method === 'POST' && url.pathname === '/integrations/browser/pair') {
    if (!extensionOrigin) return sendJson(response, 403, { error: 'Pairing is available only to a browser extension.' });
    void readRequestJson(request).then(async ({ code, extensionInstallId, browser }) => {
      const token = await browserPairing.pair(String(code ?? ''), String(extensionInstallId ?? ''), String(browser ?? 'other'));
      sendJson(response, 200, { token, status: browserPairing.status() });
    }).catch((error) => sendJson(response, 403, { error: error instanceof Error ? error.message : String(error) }));
    return;
  }
  if (request.method === 'POST' && url.pathname === '/integrations/browser/observations') {
    if (!extensionOrigin) return sendJson(response, 403, { error: 'Browser observations require an extension origin.' });
    const suppliedToken = request.headers.authorization?.replace(/^Bearer\s+/i, '');
    const pairedClient = browserPairing.clientForToken(suppliedToken);
    if (!pairedClient) return sendJson(response, 403, { error: 'The browser extension is not paired.' });
    void readRequestJson(request).then(async ({ sessions }) => {
      const items = Array.isArray(sessions) ? sessions.slice(0, 250) : [];
      let accepted = 0;
      let latest = null;
      for (const item of items) {
        const observation = browserObservation(item, pairedClient.browser);
        if (!observation) continue;
        await persistObservation(observation);
        accepted += 1;
        latest = observation.endedAt;
      }
      if (latest) await browserPairing.markObserved(latest, suppliedToken);
      sendJson(response, 200, { accepted });
    }).catch((error) => sendJson(response, 400, { error: error instanceof Error ? error.message : String(error) }));
    return;
  }
  if (request.method !== 'GET') {
    sendJson(response, 405, { error: 'This companion API is read-only.' });
    return;
  }

  if (url.pathname === '/integrations/device/status' || url.pathname === '/integrations/device/observations') {
    const suppliedToken = request.headers.authorization?.replace(/^Bearer\s+/i, '');
    if (!devicePairing.authenticates(suppliedToken)) return sendJson(response, 403, { error: 'This phone is not paired with the Windows collector.' });
    if (url.pathname === '/integrations/device/status') {
      sendJson(response, 200, {
        running: true,
        platform: 'windows',
        device: identity.device,
        collector: identity.collector,
        startedAt,
        samplingIntervalMs: options.intervalMilliseconds,
        completedObservationCount: observations.length,
        currentSession: sessionizer.snapshot(),
        privacy: {
          windowTitles: options.includeWindowTitles,
          screenshots: false,
          keystrokes: false,
          documentContents: false,
          urls: false,
        },
      });
      return;
    }
    void devicePairing.markSynced().then(() => {
      sendJson(response, 200, { device: identity.device, collector: identity.collector, observations: observations.slice(-2000) });
    }).catch((error) => sendJson(response, 500, { error: error instanceof Error ? error.message : String(error) }));
    return;
  }

  if (url.pathname === '/health') {
    sendJson(response, 200, {
      running: true,
      platform: 'windows',
      device: identity.device,
      collector: identity.collector,
      startedAt,
      samplingIntervalMs: options.intervalMilliseconds,
      idleThresholdSeconds: options.idleThresholdSeconds,
      completedObservationCount: observations.length,
      currentSession: sessionizer.snapshot(),
      privacy: {
        windowTitles: options.includeWindowTitles,
        screenshots: false,
        keystrokes: false,
        documentContents: false,
        urls: false,
      },
      storage: {
        scope: 'device-local',
        protection: encryptionKey ? 'windows-dpapi-keyed-aes-256-gcm' : 'development-plaintext',
      },
    });
    return;
  }
  if (url.pathname === '/observations') {
    sendJson(response, 200, { device: identity.device, collector: identity.collector, observations: observations.slice(-2000) });
    return;
  }
  if (url.pathname === '/integrations/huawei/status') {
    sendJson(response, 200, huaweiHealth.status());
    return;
  }
  if (url.pathname === '/integrations/browser/status') {
    sendJson(response, 200, browserPairing.status());
    return;
  }
  if (url.pathname === '/integrations/huawei/connect') {
    try {
      sendJson(response, 200, { authorizationUrl: huaweiHealth.authorizationUrl() });
    } catch (error) {
      sendJson(response, 409, { error: error instanceof Error ? error.message : String(error) });
    }
    return;
  }
  if (url.pathname === '/integrations/huawei/workouts') {
    void huaweiHealth.workoutObservations(Number(url.searchParams.get('days') ?? 7))
      .then((items) => sendJson(response, 200, { observations: items }))
      .catch((error) => sendJson(response, 409, { error: error instanceof Error ? error.message : String(error) }));
    return;
  }
  if (url.pathname === '/oauth/huawei/callback') {
    void huaweiHealth.acceptAuthorizationCallback(url.searchParams)
      .then(() => sendHtml(response, 200, '<h1>HUAWEI Health connected</h1><p>You can close this window and return to ATIRA.</p>'))
      .catch((error) => sendHtml(response, 400, `<h1>Connection failed</h1><p>${escapeHtml(error instanceof Error ? error.message : String(error))}</p>`));
    return;
  }
  sendJson(response, 404, { error: 'Not found.' });
});

server.on('error', async (error) => {
  console.error(`[ATIRA desktop] ${error.message}`);
  await stop(1);
});

server.listen(options.port, options.allowDeviceSync ? '0.0.0.0' : '127.0.0.1', () => {
  console.log(`[ATIRA desktop] Local companion ready on port ${options.port}`);
  console.log(`[ATIRA desktop] Window titles: ${options.includeWindowTitles ? 'enabled by explicit opt-in' : 'off'}`);
  console.log('[ATIRA desktop] Press Ctrl+C to stop and close the current session.');
  if (!options.serveOnly) startSampler();
});

process.on('SIGINT', () => void stop(0));
process.on('SIGTERM', () => void stop(0));

function startSampler() {
  const samplerArguments = [
    '-NoProfile',
    '-ExecutionPolicy', 'Bypass',
    '-File', samplerPath,
    '-IntervalMilliseconds', String(options.intervalMilliseconds),
    '-IdleThresholdSeconds', String(options.idleThresholdSeconds),
  ];
  if (options.includeWindowTitles) samplerArguments.push('-IncludeWindowTitles');
  if (options.maxSamples > 0) samplerArguments.push('-MaxSamples', String(options.maxSamples));
  worker = spawn('powershell.exe', samplerArguments, { windowsHide: true, stdio: ['ignore', 'pipe', 'pipe'] });
  const lines = createInterface({ input: worker.stdout });
  lines.on('line', (line) => {
    try {
      const completed = sessionizer.push(JSON.parse(line));
      if (completed) void persistObservation(completed);
    } catch (error) {
      console.error(`[ATIRA desktop] Ignored an invalid sampler message: ${error instanceof Error ? error.message : String(error)}`);
    }
  });
  worker.stderr.on('data', (data) => console.error(`[ATIRA desktop sampler] ${String(data).trim()}`));
  worker.on('exit', (code) => {
    if (!stopping) {
      const completed = sessionizer.flush();
      void (async () => {
        if (completed) await persistObservation(completed);
        console.log(`[ATIRA desktop] Sampler stopped${code == null ? '' : ` with code ${code}`}.`);
        if (options.maxSamples > 0) await stop(code ?? 0);
      })();
    }
  });
}

async function persistObservation(observation) {
  observation = attachIdentity(observation);
  if (observations.some((item) => item.id === observation.id)) return;
  observations.push(observation);
  if (encryptionKey) await appendEncryptedObservation(encryptedObservationPath, observation, encryptionKey);
  else await appendFile(observationPath, `${JSON.stringify(observation)}\n`, 'utf8');
  console.log(`[ATIRA desktop] Stored ${observation.payload.activityState}: ${observation.payload.application ?? 'no active app'} (${observation.payload.durationSeconds}s)`);
}

async function loadObservations() {
  if (encryptionKey) {
    try {
      const encrypted = await loadEncryptedObservations(encryptedObservationPath, encryptionKey);
      for (const observation of encrypted) if (isStoredDesktopObservation(observation)) observations.push(attachIdentity(observation));
    } catch (error) {
      if (!(error && typeof error === 'object' && 'code' in error && error.code === 'ENOENT')) throw error;
    }
  }
  try {
    const contents = await readFile(observationPath, 'utf8');
    for (const line of contents.split(/\r?\n/)) {
      if (!line.trim()) continue;
      try {
        const observation = JSON.parse(line);
        if (isStoredDesktopObservation(observation) && !observations.some((item) => item.id === observation.id)) observations.push(attachIdentity(observation));
      } catch {
        // A damaged line is isolated; later valid observations remain readable.
      }
    }
  } catch (error) {
    if (!(error && typeof error === 'object' && 'code' in error && error.code === 'ENOENT')) throw error;
  }
  if (encryptionKey) {
    await rewriteEncryptedObservations(encryptedObservationPath, observations, encryptionKey);
    await rm(observationPath, { force: true });
  }
}

async function rewriteObservationStore() {
  if (encryptionKey) await rewriteEncryptedObservations(encryptedObservationPath, observations, encryptionKey);
  else await writeFile(observationPath, observations.map((item) => JSON.stringify(item)).join('\n') + (observations.length ? '\n' : ''), 'utf8');
}

function attachIdentity(observation) {
  return {
    ...observation,
    deviceId: identity.device.id,
    collectorId: identity.collector.id,
  };
}

function browserObservation(item, browser) {
  const domain = typeof item?.domain === 'string' ? item.domain.trim().toLowerCase().replace(/^www\./, '') : '';
  const started = Date.parse(item?.startedAt);
  const ended = Date.parse(item?.endedAt);
  if (!/^(?:[a-z0-9](?:[a-z0-9-]{0,62})\.)+[a-z]{2,63}$/.test(domain)) return null;
  if (!Number.isFinite(started) || !Number.isFinite(ended) || ended <= started || ended - started > 24 * 60 * 60_000 || ended > Date.now() + 60_000) return null;
  return attachIdentity({
    id: `browser-${randomUUID()}`,
    source: 'desktop',
    kind: 'browser_foreground',
    startedAt: new Date(started).toISOString(),
    endedAt: new Date(ended).toISOString(),
    capturedAt: new Date().toISOString(),
    quality: 0.94,
    payload: {
      application: browserApplication(browser),
      browser,
      domain,
      activityState: 'active',
      audible: Boolean(item?.audible),
      privacyLevel: 'domain_only',
    },
  });
}

function isStoredDesktopObservation(observation) {
  return observation?.source === 'desktop' && ['desktop_foreground', 'browser_foreground'].includes(observation?.kind);
}

function isExtensionOrigin(origin) {
  return typeof origin === 'string' && /^(?:chrome-extension|moz-extension|safari-web-extension):\/\/[a-z0-9-]{16,64}$/i.test(origin);
}

function browserApplication(browser) {
  return { chrome: 'chrome', edge: 'msedge', brave: 'brave', opera: 'opera', firefox: 'firefox', safari: 'safari' }[browser] ?? 'browser';
}

function hasControlAuthorization(request) {
  const suppliedToken = request.headers.authorization?.replace(/^Bearer\s+/i, '');
  return Boolean(options.controlToken && suppliedToken === options.controlToken);
}

async function stop(exitCode) {
  if (stopping) return;
  stopping = true;
  if (worker && !worker.killed) worker.kill();
  const completed = sessionizer.flush();
  if (completed) await persistObservation(completed);
  await new Promise((resolve) => server.close(resolve));
  await rm(pidPath, { force: true });
  process.exit(exitCode);
}

function sendJson(response, status, body) {
  response.writeHead(status, { 'Content-Type': 'application/json; charset=utf-8' });
  response.end(JSON.stringify(body));
}

function sendHtml(response, status, body) {
  response.writeHead(status, { 'Content-Type': 'text/html; charset=utf-8', 'Cache-Control': 'no-store' });
  response.end(`<!doctype html><html><head><meta name="viewport" content="width=device-width"><title>ATIRA</title></head><body style="font-family:system-ui;padding:40px;max-width:620px">${body}</body></html>`);
}

async function readRequestJson(request) {
  const chunks = [];
  for await (const chunk of request) chunks.push(chunk);
  const body = Buffer.concat(chunks).toString('utf8');
  return body ? JSON.parse(body) : {};
}

function escapeHtml(value) {
  return value.replaceAll('&', '&amp;').replaceAll('<', '&lt;').replaceAll('>', '&gt;').replaceAll('"', '&quot;').replaceAll("'", '&#039;');
}

function parseOptions(argumentsList) {
  const optionValue = (name, fallback) => {
    const index = argumentsList.indexOf(name);
    return index >= 0 && argumentsList[index + 1] ? Number(argumentsList[index + 1]) : fallback;
  };
  return {
    port: optionValue('--port', 43123),
    intervalMilliseconds: Math.max(500, optionValue('--interval', 5000)),
    idleThresholdSeconds: Math.max(30, optionValue('--idle-threshold', 300)),
    maxSamples: Math.max(0, optionValue('--max-samples', 0)),
    includeWindowTitles: argumentsList.includes('--include-window-titles'),
    serveOnly: argumentsList.includes('--serve-only'),
    dataDirectory: stringOptionValue(argumentsList, '--data-dir'),
    controlToken: stringOptionValue(argumentsList, '--control-token'),
    allowDeviceSync: argumentsList.includes('--allow-device-sync'),
  };
}

function isLoopbackAddress(address) {
  return address === '127.0.0.1' || address === '::1' || address === '::ffff:127.0.0.1';
}

function localNetworkAddresses() {
  return Object.values(networkInterfaces())
    .flat()
    .filter((item) => item && item.family === 'IPv4' && !item.internal && isPrivateIpv4(item.address))
    .map((item) => item.address);
}

function isPrivateIpv4(address) {
  const parts = address.split('.').map(Number);
  return parts.length === 4 && (
    parts[0] === 10 ||
    (parts[0] === 172 && parts[1] >= 16 && parts[1] <= 31) ||
    (parts[0] === 192 && parts[1] === 168)
  );
}

function stringOptionValue(argumentsList, name) {
  const index = argumentsList.indexOf(name);
  return index >= 0 && argumentsList[index + 1] ? argumentsList[index + 1] : null;
}
