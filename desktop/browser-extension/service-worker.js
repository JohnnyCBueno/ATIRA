const COMPANION = 'http://127.0.0.1:43123';
const CHECKPOINT_ALARM = 'atira-context-checkpoint';
const MAX_QUEUE = 2000;
let transition = Promise.resolve();

chrome.runtime.onInstalled.addListener(() => {
  void ensureIdentity();
  chrome.idle.setDetectionInterval(300);
  chrome.alarms.create(CHECKPOINT_ALARM, { periodInMinutes: 1 });
  queueRefresh();
});
chrome.runtime.onStartup.addListener(() => {
  chrome.idle.setDetectionInterval(300);
  chrome.alarms.create(CHECKPOINT_ALARM, { periodInMinutes: 1 });
  queueRefresh();
});
chrome.tabs.onActivated.addListener(queueRefresh);
chrome.tabs.onUpdated.addListener((_tabId, changeInfo, tab) => {
  if (tab.active && (changeInfo.url || changeInfo.status === 'complete')) queueRefresh();
});
chrome.windows.onFocusChanged.addListener(queueRefresh);
chrome.idle.onStateChanged.addListener(queueRefresh);
chrome.alarms.onAlarm.addListener((alarm) => {
  if (alarm.name === CHECKPOINT_ALARM) queueRefresh(true);
});
chrome.runtime.onMessage.addListener((message, _sender, sendResponse) => {
  if (message?.type === 'status') {
    void status().then(sendResponse);
    return true;
  }
  if (message?.type === 'pair') {
    void pair(String(message.code ?? '')).then(sendResponse);
    return true;
  }
  if (message?.type === 'disconnect') {
    void chrome.storage.local.remove(['pairingToken']).then(() => status()).then(sendResponse);
    return true;
  }
  return false;
});

function queueRefresh(checkpoint = false) {
  transition = transition.then(() => refresh(checkpoint)).catch(() => undefined);
}

async function refresh(checkpoint) {
  const now = new Date().toISOString();
  const context = await activeContext();
  const stored = await chrome.storage.local.get(['currentSession']);
  const current = stored.currentSession ?? null;
  const changed = !context || !current || context.domain !== current.domain || context.audible !== current.audible;
  if (current && (changed || checkpoint)) await closeSession(current, now);
  if (context && (changed || checkpoint || !current)) {
    await chrome.storage.local.set({ currentSession: { ...context, startedAt: now } });
  } else if (!context && current) {
    await chrome.storage.local.remove(['currentSession']);
  }
  await uploadQueue();
}

async function activeContext() {
  if (await chrome.idle.queryState(300) !== 'active') return null;
  const focused = await chrome.windows.getLastFocused({ populate: false });
  if (!focused?.focused || focused.incognito) return null;
  const [tab] = await chrome.tabs.query({ active: true, windowId: focused.id });
  if (!tab || tab.incognito || !tab.url) return null;
  try {
    const url = new URL(tab.url);
    if (!['http:', 'https:'].includes(url.protocol)) return null;
    const domain = url.hostname.toLowerCase().replace(/^www\./, '').replace(/\.$/, '');
    if (!domain || domain === 'localhost' || domain === '127.0.0.1') return null;
    return { domain, audible: Boolean(tab.audible) };
  } catch {
    return null;
  }
}

async function closeSession(current, endedAt) {
  if (Date.parse(endedAt) <= Date.parse(current.startedAt)) return;
  const stored = await chrome.storage.local.get(['pendingSessions']);
  const queue = Array.isArray(stored.pendingSessions) ? stored.pendingSessions : [];
  queue.push({ domain: current.domain, audible: Boolean(current.audible), startedAt: current.startedAt, endedAt });
  await chrome.storage.local.set({ pendingSessions: queue.slice(-MAX_QUEUE) });
}

async function uploadQueue() {
  const stored = await chrome.storage.local.get(['pairingToken', 'pendingSessions']);
  const queue = Array.isArray(stored.pendingSessions) ? stored.pendingSessions : [];
  if (!stored.pairingToken || queue.length === 0) return;
  try {
    const response = await fetch(`${COMPANION}/integrations/browser/observations`, {
      method: 'POST',
      headers: { Authorization: `Bearer ${stored.pairingToken}`, 'Content-Type': 'application/json' },
      body: JSON.stringify({ sessions: queue.slice(0, 250) }),
    });
    if (response.status === 403) await chrome.storage.local.remove(['pairingToken']);
    if (!response.ok) return;
    await chrome.storage.local.set({ pendingSessions: queue.slice(250), lastUploadAt: new Date().toISOString() });
    if (queue.length > 250) await uploadQueue();
  } catch {
    // The companion is often offline; the bounded local queue is retried later.
  }
}

async function pair(code) {
  try {
    const extensionInstallId = await ensureIdentity();
    const response = await fetch(`${COMPANION}/integrations/browser/pair`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ code, extensionInstallId, browser: await browserFamily() }),
    });
    const payload = await response.json().catch(() => ({}));
    if (!response.ok) return { ok: false, error: payload.error ?? 'Pairing failed.' };
    await chrome.storage.local.set({ pairingToken: payload.token });
    await uploadQueue();
    return { ok: true, ...(await status()) };
  } catch {
    return { ok: false, error: 'ATIRA is not reachable. Open the installed Windows app and try again.' };
  }
}

async function status() {
  const stored = await chrome.storage.local.get(['pairingToken', 'pendingSessions', 'currentSession', 'lastUploadAt']);
  return {
    paired: Boolean(stored.pairingToken),
    pendingCount: Array.isArray(stored.pendingSessions) ? stored.pendingSessions.length : 0,
    currentDomain: stored.currentSession?.domain ?? null,
    lastUploadAt: stored.lastUploadAt ?? null,
    browser: await browserFamily(),
  };
}

async function browserFamily() {
  const userAgent = navigator.userAgent;
  if (/Firefox\//i.test(userAgent)) return 'firefox';
  if (/Edg\//i.test(userAgent)) return 'edge';
  if (/OPR\//i.test(userAgent)) return 'opera';
  if (navigator.brave && await navigator.brave.isBrave()) return 'brave';
  if (/Safari\//i.test(userAgent) && !/Chrom(?:e|ium)\//i.test(userAgent)) return 'safari';
  return 'chrome';
}

async function ensureIdentity() {
  const stored = await chrome.storage.local.get(['extensionInstallId']);
  if (stored.extensionInstallId) return stored.extensionInstallId;
  const extensionInstallId = crypto.randomUUID();
  await chrome.storage.local.set({ extensionInstallId });
  return extensionInstallId;
}
