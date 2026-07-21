import { randomUUID } from 'node:crypto';
import { mkdir, readFile, writeFile } from 'node:fs/promises';
import path from 'node:path';

const IDENTITY_FILE = 'identity.json';

export async function loadOrCreateDesktopIdentity(dataDirectory, now = () => new Date()) {
  await mkdir(dataDirectory, { recursive: true });
  const identityPath = path.join(dataDirectory, IDENTITY_FILE);
  const existing = await readIdentity(identityPath);
  if (existing) return existing;

  const timestamp = now().toISOString();
  const deviceId = `device-${randomUUID()}`;
  const identity = {
    device: {
      id: deviceId,
      deviceClass: 'computer',
      platform: 'windows',
      label: 'Windows computer',
      createdAt: timestamp,
      updatedAt: timestamp,
    },
    collector: {
      id: `collector-${randomUUID()}`,
      deviceId,
      source: 'desktop',
      provider: 'atira_windows_companion',
      label: 'Windows activity',
      createdAt: timestamp,
      updatedAt: timestamp,
    },
  };
  try {
    await writeFile(identityPath, `${JSON.stringify(identity, null, 2)}\n`, { encoding: 'utf8', flag: 'wx' });
    return identity;
  } catch (error) {
    if (!(error && typeof error === 'object' && 'code' in error && error.code === 'EEXIST')) throw error;
    const concurrentIdentity = await readIdentity(identityPath);
    if (!concurrentIdentity) throw new Error('The desktop identity file exists but is invalid.');
    return concurrentIdentity;
  }
}

async function readIdentity(identityPath) {
  try {
    const parsed = JSON.parse(await readFile(identityPath, 'utf8'));
    return isIdentity(parsed) ? parsed : null;
  } catch (error) {
    if (error && typeof error === 'object' && 'code' in error && error.code === 'ENOENT') return null;
    if (error instanceof SyntaxError) return null;
    throw error;
  }
}

function isIdentity(value) {
  return Boolean(
    value && typeof value === 'object' &&
    value.device && typeof value.device.id === 'string' && value.device.id.startsWith('device-') &&
    value.device.deviceClass === 'computer' && value.device.platform === 'windows' &&
    typeof value.device.label === 'string' && typeof value.device.createdAt === 'string' && typeof value.device.updatedAt === 'string' &&
    value.collector && typeof value.collector.id === 'string' && value.collector.id.startsWith('collector-') &&
    value.collector.deviceId === value.device.id && value.collector.source === 'desktop' &&
    value.collector.provider === 'atira_windows_companion' && typeof value.collector.label === 'string' &&
    typeof value.collector.createdAt === 'string' && typeof value.collector.updatedAt === 'string'
  );
}
