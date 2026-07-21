import { app, BrowserWindow, Menu, shell, Tray } from 'electron';
import { spawn } from 'node:child_process';
import { randomBytes } from 'node:crypto';
import { createServer } from 'node:http';
import { readFile } from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
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
    if (!isDevelopment) staticServer = await startStaticServer(path.join(appRoot, 'dist'), 43124);
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
  collectorControlToken = randomBytes(32).toString('base64url');
  collectorProcess = spawn(process.execPath, [collectorPath, '--data-dir', dataDirectory, '--control-token', collectorControlToken], {
    env: { ...process.env, ELECTRON_RUN_AS_NODE: '1' },
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
