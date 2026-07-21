import { createServer } from 'node:http';
import { spawn } from 'node:child_process';
import { appendFile, mkdir, readFile, rm, writeFile } from 'node:fs/promises';
import { createInterface } from 'node:readline';
import { fileURLToPath } from 'node:url';
import path from 'node:path';
import { DesktopSessionizer } from './sessionizer.mjs';
import { HuaweiHealthConnector } from '../connectors/huawei-health/huawei-health.mjs';

const collectorDirectory = path.dirname(fileURLToPath(import.meta.url));
const projectDirectory = path.resolve(collectorDirectory, '..', '..');
const options = parseOptions(process.argv.slice(2));
const dataDirectory = options.dataDirectory
  ? path.resolve(options.dataDirectory)
  : path.join(projectDirectory, 'desktop', 'data');
const observationPath = path.join(dataDirectory, 'observations.ndjson');
const pidPath = path.join(dataDirectory, 'collector.pid');
const samplerPath = path.join(collectorDirectory, 'windows-sampler.ps1');
const allowedOrigins = new Set(['http://localhost:8081', 'http://127.0.0.1:8081', 'http://127.0.0.1:43124']);
const sessionizer = new DesktopSessionizer();
const huaweiHealth = new HuaweiHealthConnector();
const observations = [];
const startedAt = new Date().toISOString();
let worker = null;
let stopping = false;

await mkdir(dataDirectory, { recursive: true });
await loadObservations();
await writeFile(pidPath, String(process.pid), 'utf8');

const server = createServer((request, response) => {
  const origin = request.headers.origin;
  if (origin && !allowedOrigins.has(origin)) {
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
  if (request.method !== 'GET') {
    sendJson(response, 405, { error: 'This companion API is read-only.' });
    return;
  }

  if (url.pathname === '/health') {
    sendJson(response, 200, {
      running: true,
      platform: 'windows',
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
        protection: 'development-plaintext',
      },
    });
    return;
  }
  if (url.pathname === '/observations') {
    sendJson(response, 200, { observations: observations.slice(-2000) });
    return;
  }
  if (url.pathname === '/integrations/huawei/status') {
    sendJson(response, 200, huaweiHealth.status());
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

server.listen(options.port, '127.0.0.1', () => {
  console.log(`[ATIRA desktop] Local companion ready at http://127.0.0.1:${options.port}`);
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
  if (observations.some((item) => item.id === observation.id)) return;
  observations.push(observation);
  await appendFile(observationPath, `${JSON.stringify(observation)}\n`, 'utf8');
  console.log(`[ATIRA desktop] Stored ${observation.payload.activityState}: ${observation.payload.application ?? 'no active app'} (${observation.payload.durationSeconds}s)`);
}

async function loadObservations() {
  try {
    const contents = await readFile(observationPath, 'utf8');
    for (const line of contents.split(/\r?\n/)) {
      if (!line.trim()) continue;
      try {
        const observation = JSON.parse(line);
        if (observation?.source === 'desktop' && observation?.kind === 'desktop_foreground') observations.push(observation);
      } catch {
        // A damaged line is isolated; later valid observations remain readable.
      }
    }
  } catch (error) {
    if (!(error && typeof error === 'object' && 'code' in error && error.code === 'ENOENT')) throw error;
  }
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
  };
}

function stringOptionValue(argumentsList, name) {
  const index = argumentsList.indexOf(name);
  return index >= 0 && argumentsList[index + 1] ? argumentsList[index + 1] : null;
}
