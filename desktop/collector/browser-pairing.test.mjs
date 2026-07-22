import assert from 'node:assert/strict';
import { mkdtemp, readFile, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import path from 'node:path';
import test from 'node:test';
import { randomBytes } from 'node:crypto';
import { BrowserPairing } from './browser-pairing.mjs';

test('browser pairing stores only an encrypted token hash and survives restart', async () => {
  const directory = await mkdtemp(path.join(tmpdir(), 'atira-browser-pairing-'));
  const filePath = path.join(directory, 'pairing.atira');
  const encryptionKey = randomBytes(32);
  try {
    const pairing = new BrowserPairing({ filePath, encryptionKey });
    await pairing.load();
    const code = pairing.createCode();
    const token = await pairing.pair(code.code, 'extension-install', 'edge');
    assert.equal(pairing.authenticates(token), true);
    assert.equal(pairing.authenticates('wrong-token'), false);
    const stored = await readFile(filePath, 'utf8');
    assert.equal(stored.includes(token), false);
    assert.equal(stored.includes('extension-install'), false);

    const restarted = new BrowserPairing({ filePath, encryptionKey });
    await restarted.load();
    assert.equal(restarted.authenticates(token), true);
    assert.equal(restarted.status().paired, true);
    assert.equal(restarted.status().browsers[0].browser, 'edge');
  } finally {
    await rm(directory, { recursive: true, force: true });
  }
});

test('multiple browsers remain independently authenticated', async () => {
  const directory = await mkdtemp(path.join(tmpdir(), 'atira-browser-pairing-'));
  const pairing = new BrowserPairing({ filePath: path.join(directory, 'pairing.json'), encryptionKey: null });
  try {
    const chromeCode = pairing.createCode();
    const chromeToken = await pairing.pair(chromeCode.code, 'chrome-install', 'chrome');
    const firefoxCode = pairing.createCode();
    const firefoxToken = await pairing.pair(firefoxCode.code, 'firefox-install', 'firefox');
    assert.equal(pairing.authenticates(chromeToken), true);
    assert.equal(pairing.authenticates(firefoxToken), true);
    assert.equal(pairing.status().connectedBrowserCount, 2);
    assert.deepEqual(pairing.status().browsers.map((item) => item.browser), ['chrome', 'firefox']);
  } finally {
    await rm(directory, { recursive: true, force: true });
  }
});

test('legacy single-browser records migrate as Chrome', async () => {
  const directory = await mkdtemp(path.join(tmpdir(), 'atira-browser-pairing-'));
  const filePath = path.join(directory, 'pairing.json');
  try {
    await import('node:fs/promises').then(({ writeFile }) => writeFile(filePath, JSON.stringify({ tokenHash: 'abc', extensionInstallId: 'legacy', pairedAt: '2026-01-01T00:00:00.000Z', lastObservedAt: null })));
    const pairing = new BrowserPairing({ filePath, encryptionKey: null });
    await pairing.load();
    assert.equal(pairing.status().browsers[0].browser, 'chrome');
  } finally {
    await rm(directory, { recursive: true, force: true });
  }
});

test('a pairing code is one-time use', async () => {
  const directory = await mkdtemp(path.join(tmpdir(), 'atira-browser-pairing-'));
  const pairing = new BrowserPairing({ filePath: path.join(directory, 'pairing.json'), encryptionKey: null });
  try {
    const code = pairing.createCode();
    await pairing.pair(code.code, 'first');
    await assert.rejects(() => pairing.pair(code.code, 'second'), /invalid or has expired/);
  } finally {
    await rm(directory, { recursive: true, force: true });
  }
});
