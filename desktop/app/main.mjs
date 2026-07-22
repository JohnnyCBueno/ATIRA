import { app, BrowserWindow, ipcMain, Menu, safeStorage, shell, Tray } from 'electron';
import { spawn } from 'node:child_process';
import { createCipheriv, createDecipheriv, randomBytes } from 'node:crypto';
import { createServer } from 'node:http';
import { mkdir, readFile, writeFile } from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { loadEncryptedObservations, rewriteEncryptedObservations } from '../collector/encrypted-observation-store.mjs';
import { squirrelEventAction } from './squirrel-events.mjs';

const squirrelEventHandled = handleSquirrelEvent();

const isDevelopment = process.argv.includes('--dev');
const appRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..', '..');
const iconPath = path.join(appRoot, 'assets', 'icon.png');
const desktopUrl = isDevelopment ? 'http://localhost:8081' : 'http://127.0.0.1:43124';
let mainWindow = null;
let tray = null;
let staticServer = null;
let collectorProcess = null;
let collectorControlToken = null;
let collectorPaused = false;
let isQuitting = false;
let shutdownStarted = false;

if (!squirrelEventHandled) {
  const ownsInstance = app.requestSingleInstanceLock();
  if (!ownsInstance) app.quit();

  app.setAppUserModelId('com.squirrel.ATIRA.ATIRA');

  app.on('second-instance', () => showWindow());
  app.on('before-quit', (event) => {
    isQuitting = true;
    if (shutdownStarted) return;
    event.preventDefault();
    shutdownStarted = true;
    void shutdownOwnedServices().finally(() => app.exit(0));
  });

  app.whenReady().then(async () => {
    registerDesktopBridge();
    if (!isDevelopment) staticServer = await startStaticServer(path.join(appRoot, 'dist'), 43124);
    collectorPaused = await readCollectorPauseState();
    await startCollector();
    createTray();
    createWindow();
  });

  app.on('activate', () => showWindow());
  app.on('window-all-closed', () => {
    // The tray owns the app lifecycle on Windows so passive collection can continue.
  });
}

function createWindow() {
  mainWindow = new BrowserWindow({
    title: 'ATIRA',
    width: isDevelopment ? 1440 : 1380,
    height: 900,
    minWidth: 980,
    minHeight: 680,
    backgroundColor: '#F5F1E9',
    icon: iconPath,
    show: false,
    webPreferences: {
      preload: path.join(appRoot, 'desktop', 'app', 'preload.cjs'),
      contextIsolation: true,
      nodeIntegration: false,
      sandbox: true,
    },
  });
  mainWindow.removeMenu();
  mainWindow.webContents.setWindowOpenHandler(({ url }) => {
    if (url.startsWith('https://') || url.startsWith('http://')) void shell.openExternal(url);
    return { action: 'deny' };
  });
  mainWindow.once('ready-to-show', () => mainWindow?.show());
  mainWindow.on('close', (event) => {
    if (isQuitting) return;
    event.preventDefault();
    mainWindow?.hide();
  });
  mainWindow.on('closed', () => { mainWindow = null; });
  void mainWindow.loadURL(desktopUrl);
}

function showWindow() {
  if (!mainWindow) createWindow();
  mainWindow?.show();
  mainWindow?.focus();
}

function createTray() {
  tray = new Tray(iconPath);
  tray.setToolTip('ATIRA · private life timeline');
  tray.on('double-click', () => showWindow());
  rebuildTrayMenu();
}

function rebuildTrayMenu() {
  const collectionLabel = collectorPaused ? 'Resume desktop collection' : 'Pause desktop collection';
  tray?.setContextMenu(Menu.buildFromTemplate([
    { label: 'Open ATIRA', click: () => showWindow() },
    { type: 'separator' },
    {
      label: collectionLabel,
      click: async () => {
        collectorPaused = !collectorPaused;
        await writeCollectorPauseState(collectorPaused);
        if (collectorPaused) await stopCollector();
        else await startCollector();
        rebuildTrayMenu();
      },
    },
    { label: 'Window titles: Off', enabled: false },
    { type: 'separator' },
    { label: 'Quit ATIRA', click: () => { isQuitting = true; app.quit(); } },
  ]));
}

async function startCollector() {
  if (process.platform !== 'win32' || collectorPaused || collectorProcess) return;
  if (await companionIsRunning()) return;
  const collectorPath = path.join(appRoot, 'desktop', 'collector', 'collector.mjs');
  const dataDirectory = path.join(app.getPath('userData'), 'collector');
  const encryptionKey = await loadOrCreateCollectorKey();
  collectorControlToken = randomBytes(32).toString('base64url');
  collectorProcess = spawn(process.execPath, [collectorPath, '--data-dir', dataDirectory, '--control-token', collectorControlToken], {
    env: { ...process.env, ELECTRON_RUN_AS_NODE: '1', ATIRA_COLLECTOR_ENCRYPTION_KEY: encryptionKey },
    windowsHide: true,
    stdio: ['ignore', 'pipe', 'pipe'],
  });
  collectorProcess.stdout.on('data', (data) => console.log(String(data).trim()));
  collectorProcess.stderr.on('data', (data) => console.error(String(data).trim()));
  collectorProcess.on('exit', () => {
    collectorProcess = null;
    collectorControlToken = null;
    rebuildTrayMenu();
  });
}

function registerDesktopBridge() {
  ipcMain.handle('repository:read', () => readEncryptedRepository());
  ipcMain.handle('repository:write', (_event, state) => writeEncryptedRepository(state));
  ipcMain.handle('collector:status', () => ({ paused: collectorPaused, running: Boolean(collectorProcess) }));
  ipcMain.handle('collector:set-paused', async (_event, paused) => {
    collectorPaused = Boolean(paused);
    await writeCollectorPauseState(collectorPaused);
    if (collectorPaused) await stopCollector();
    else await startCollector();
    rebuildTrayMenu();
    return { paused: collectorPaused, running: Boolean(collectorProcess) };
  });
  ipcMain.handle('collector:delete', async (_event, range) => {
    if (!['7d', '30d', 'all'].includes(range)) throw new Error('Unsupported deletion range.');
    if (collectorProcess && collectorControlToken) {
      const response = await fetch('http://127.0.0.1:43123/control/delete', {
        method: 'POST',
        headers: { Authorization: `Bearer ${collectorControlToken}`, 'Content-Type': 'application/json' },
        body: JSON.stringify({ range }),
        signal: AbortSignal.timeout(3000),
      });
      if (!response.ok) throw new Error(`Collector deletion returned ${response.status}.`);
      return response.json();
    }
    return deletePackagedCollectorHistory(range);
  });
  ipcMain.handle('collector:browser-pairing-code', () => collectorControlRequest('/control/browser-pairing-code'));
  ipcMain.handle('collector:browser-unpair', () => collectorControlRequest('/control/browser-unpair'));
}

async function collectorControlRequest(pathname) {
  if (!collectorProcess || !collectorControlToken) throw new Error('The Windows collector is not running.');
  const response = await fetch(`http://127.0.0.1:43123${pathname}`, {
    method: 'POST',
    headers: { Authorization: `Bearer ${collectorControlToken}` },
    signal: AbortSignal.timeout(3000),
  });
  if (!response.ok) throw new Error(`Collector control returned ${response.status}.`);
  return response.json();
}

async function deletePackagedCollectorHistory(range) {
  const collectorDirectory = path.join(app.getPath('userData'), 'collector');
  const observationPath = path.join(collectorDirectory, 'observations.atira');
  const key = Buffer.from(await loadOrCreateCollectorKey(), 'hex');
  let observations;
  try {
    observations = await loadEncryptedObservations(observationPath, key);
  } catch (error) {
    if (error && typeof error === 'object' && 'code' in error && error.code === 'ENOENT') return { deleted: 0 };
    throw error;
  }
  const cutoff = range === 'all'
    ? Number.POSITIVE_INFINITY
    : Date.now() - (range === '7d' ? 7 : 30) * 86_400_000;
  const retained = observations.filter((item) => range !== 'all' && Date.parse(item.startedAt) < cutoff);
  await rewriteEncryptedObservations(observationPath, retained, key);
  return { deleted: observations.length - retained.length };
}

async function readEncryptedRepository() {
  const repositoryPath = path.join(app.getPath('userData'), 'repository.atira');
  try {
    const encoded = await readFile(repositoryPath, 'utf8');
    const payload = Buffer.from(encoded, 'base64');
    const key = Buffer.from(await loadOrCreateProtectedKey('repository-key.atira'), 'hex');
    const nonce = payload.subarray(0, 12);
    const tag = payload.subarray(12, 28);
    const ciphertext = payload.subarray(28);
    const decipher = createDecipheriv('aes-256-gcm', key, nonce);
    decipher.setAuthTag(tag);
    const decrypted = Buffer.concat([decipher.update(ciphertext), decipher.final()]).toString('utf8');
    return JSON.parse(decrypted);
  } catch (error) {
    if (error && typeof error === 'object' && 'code' in error && error.code === 'ENOENT') return null;
    throw error;
  }
}

async function writeEncryptedRepository(state) {
  if (!safeStorage.isEncryptionAvailable()) throw new Error('Windows protected storage is unavailable.');
  const repositoryPath = path.join(app.getPath('userData'), 'repository.atira');
  const key = Buffer.from(await loadOrCreateProtectedKey('repository-key.atira'), 'hex');
  const nonce = randomBytes(12);
  const cipher = createCipheriv('aes-256-gcm', key, nonce);
  const ciphertext = Buffer.concat([cipher.update(JSON.stringify(state), 'utf8'), cipher.final()]);
  const encrypted = Buffer.concat([nonce, cipher.getAuthTag(), ciphertext]).toString('base64');
  await writeFile(repositoryPath, encrypted, { encoding: 'utf8', mode: 0o600 });
}

async function loadOrCreateCollectorKey() {
  return loadOrCreateProtectedKey('collector-key.atira', 'collector');
}

async function readCollectorPauseState() {
  const settingsPath = path.join(app.getPath('userData'), 'collector-settings.atira');
  try {
    const encoded = await readFile(settingsPath, 'utf8');
    return safeStorage.decryptString(Buffer.from(encoded, 'base64')) === 'paused';
  } catch (error) {
    if (error && typeof error === 'object' && 'code' in error && error.code === 'ENOENT') return false;
    throw error;
  }
}

async function writeCollectorPauseState(paused) {
  if (!safeStorage.isEncryptionAvailable()) throw new Error('Windows protected storage is unavailable.');
  const settingsPath = path.join(app.getPath('userData'), 'collector-settings.atira');
  const protectedValue = safeStorage.encryptString(paused ? 'paused' : 'running').toString('base64');
  await writeFile(settingsPath, protectedValue, { encoding: 'utf8', mode: 0o600 });
}

async function loadOrCreateProtectedKey(fileName, directoryName = '') {
  if (!safeStorage.isEncryptionAvailable()) throw new Error('Windows protected storage is unavailable.');
  const dataDirectory = path.join(app.getPath('userData'), directoryName);
  const keyPath = path.join(dataDirectory, fileName);
  await mkdir(dataDirectory, { recursive: true });
  try {
    const encoded = await readFile(keyPath, 'utf8');
    return safeStorage.decryptString(Buffer.from(encoded, 'base64'));
  } catch (error) {
    if (!(error && typeof error === 'object' && 'code' in error && error.code === 'ENOENT')) throw error;
  }
  const key = randomBytes(32).toString('hex');
  const protectedKey = safeStorage.encryptString(key).toString('base64');
  await writeFile(keyPath, protectedKey, { encoding: 'utf8', mode: 0o600, flag: 'wx' });
  return key;
}

async function stopCollector() {
  if (!collectorProcess) return;
  const ownedProcess = collectorProcess;
  try {
    const response = await fetch('http://127.0.0.1:43123/control/stop', {
      method: 'POST',
      headers: { Authorization: `Bearer ${collectorControlToken}` },
      signal: AbortSignal.timeout(1000),
    });
    if (!response.ok) throw new Error(`Collector stop returned ${response.status}.`);
    await Promise.race([
      new Promise((resolve) => ownedProcess.once('exit', resolve)),
      new Promise((resolve) => setTimeout(resolve, 1000)),
    ]);
  } catch {
    ownedProcess.kill();
  }
  if (collectorProcess === ownedProcess) {
    collectorProcess = null;
    collectorControlToken = null;
  }
}

async function shutdownOwnedServices() {
  await stopCollector();
  await new Promise((resolve) => {
    if (!staticServer) {
      resolve();
      return;
    }
    staticServer.close(resolve);
  });
}

async function companionIsRunning() {
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), 500);
  try {
    const response = await fetch('http://127.0.0.1:43123/health', { signal: controller.signal });
    return response.ok;
  } catch {
    return false;
  } finally {
    clearTimeout(timeout);
  }
}

async function startStaticServer(root, port) {
  const server = createServer(async (request, response) => {
    if (!['GET', 'HEAD'].includes(request.method ?? '')) {
      response.writeHead(405).end();
      return;
    }
    try {
      const requestUrl = new URL(request.url ?? '/', `http://127.0.0.1:${port}`);
      const relativePath = decodeURIComponent(requestUrl.pathname === '/' ? '/index.html' : requestUrl.pathname);
      const target = path.resolve(root, `.${relativePath}`);
      if (target !== root && !target.startsWith(`${root}${path.sep}`)) {
        response.writeHead(403).end();
        return;
      }
      const body = await readFile(target);
      response.writeHead(200, {
        'Content-Type': contentType(target),
        'Cache-Control': target.endsWith('index.html') ? 'no-store' : 'public, max-age=31536000, immutable',
      });
      if (request.method === 'HEAD') response.end();
      else response.end(body);
    } catch (error) {
      const status = error && typeof error === 'object' && 'code' in error && error.code === 'ENOENT' ? 404 : 500;
      response.writeHead(status).end();
    }
  });
  await new Promise((resolve, reject) => {
    server.once('error', reject);
    server.listen(port, '127.0.0.1', resolve);
  });
  return server;
}

function contentType(filePath) {
  if (filePath.endsWith('.html')) return 'text/html; charset=utf-8';
  if (filePath.endsWith('.js')) return 'text/javascript; charset=utf-8';
  if (filePath.endsWith('.json')) return 'application/json; charset=utf-8';
  if (filePath.endsWith('.css')) return 'text/css; charset=utf-8';
  if (filePath.endsWith('.png')) return 'image/png';
  if (filePath.endsWith('.ico')) return 'image/x-icon';
  return 'application/octet-stream';
}

function handleSquirrelEvent() {
  if (process.platform !== 'win32') return false;
  const action = squirrelEventAction(process.argv[1]);
  if (action === 'launch') return false;
  if (action === 'quit') return true;
  const updateExecutable = path.resolve(path.dirname(process.execPath), '..', 'Update.exe');
  const target = path.basename(process.execPath);
  const updateArguments = action === 'remove-shortcut'
    ? [`--removeShortcut=${target}`]
    : [`--createShortcut=${target}`];
  spawn(updateExecutable, updateArguments, { detached: true, windowsHide: true }).once('close', () => app.quit());
  return true;
}
