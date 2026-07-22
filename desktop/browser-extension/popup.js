const pairing = document.querySelector('#pairing');
const connected = document.querySelector('#connected');
const code = document.querySelector('#code');
const message = document.querySelector('#message');

document.querySelector('#pair').addEventListener('click', async () => {
  message.className = '';
  message.textContent = 'Connecting…';
  const result = await chrome.runtime.sendMessage({ type: 'pair', code: code.value.trim() });
  if (!result?.ok) {
    message.className = 'error';
    message.textContent = result?.error ?? 'Pairing failed.';
    return;
  }
  message.textContent = '';
  await render();
});

document.querySelector('#disconnect').addEventListener('click', async () => {
  await chrome.runtime.sendMessage({ type: 'disconnect' });
  await render();
});

async function render() {
  const status = await chrome.runtime.sendMessage({ type: 'status' });
  pairing.hidden = status.paired;
  connected.hidden = !status.paired;
  document.querySelector('#browser-status').textContent = `${labelBrowser(status.browser)} connected locally`;
  document.querySelector('#current').textContent = status.currentDomain
    ? `Currently observing: ${status.currentDomain}`
    : 'Waiting for an active website.';
  document.querySelector('#queue').textContent = status.pendingCount
    ? `${status.pendingCount} interval${status.pendingCount === 1 ? '' : 's'} waiting to sync.`
    : status.lastUploadAt ? 'All completed intervals are synced.' : 'No completed intervals yet.';
}

function labelBrowser(browser) {
  return ({ chrome: 'Chrome', edge: 'Edge', brave: 'Brave', opera: 'Opera', firefox: 'Firefox', safari: 'Safari' })[browser] ?? 'Browser';
}

void render();
