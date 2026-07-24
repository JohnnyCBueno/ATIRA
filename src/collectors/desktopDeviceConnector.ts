import * as Crypto from 'expo-crypto';
import * as SecureStore from 'expo-secure-store';
import { Platform } from 'react-native';

const CONNECTION_KEY = 'atira.windows-device-connection.v1';
const CLIENT_ID_KEY = 'atira.mobile-client-id.v1';
const DEFAULT_PORT = 43123;
const REQUEST_TIMEOUT_MS = 5000;

interface StoredDesktopDeviceConnection {
  baseUrl: string;
  token: string;
  deviceLabel: string;
  pairedAt: string;
  lastSyncedAt: string | null;
}

export interface DesktopDeviceConnectionStatus {
  supported: boolean;
  paired: boolean;
  address: string | null;
  deviceLabel: string | null;
  pairedAt: string | null;
  lastSyncedAt: string | null;
}

export async function inspectDesktopDeviceConnection(): Promise<DesktopDeviceConnectionStatus> {
  if (Platform.OS === 'web') return emptyStatus(false);
  try {
    const connection = await loadConnection();
    if (!connection) return emptyStatus(true);
    return {
      supported: true,
      paired: true,
      address: connection.baseUrl.replace(/^http:\/\//, ''),
      deviceLabel: connection.deviceLabel,
      pairedAt: connection.pairedAt,
      lastSyncedAt: connection.lastSyncedAt,
    };
  } catch {
    return emptyStatus(true);
  }
}

export async function pairDesktopDevice(address: string, code: string): Promise<DesktopDeviceConnectionStatus> {
  if (Platform.OS === 'web') throw new Error('Windows-to-phone pairing is available in the iPhone and Android apps.');
  const baseUrl = normalizePrivateNetworkAddress(address);
  const normalizedCode = code.replace(/\D/g, '');
  if (normalizedCode.length !== 6) throw new Error('Enter the six-digit code shown by ATIRA on Windows.');
  const clientId = await loadOrCreateClientId();
  const result = await requestJson<{
    token: string;
    device: { label?: unknown };
    status: { pairedAt?: unknown };
  }>(`${baseUrl}/integrations/device/pair`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ code: normalizedCode, clientId, label: 'ATIRA on iPhone' }),
  });
  if (typeof result.token !== 'string' || result.token.length < 32) throw new Error('Windows returned an invalid pairing credential.');
  const connection: StoredDesktopDeviceConnection = {
    baseUrl,
    token: result.token,
    deviceLabel: typeof result.device?.label === 'string' ? result.device.label : 'Windows laptop',
    pairedAt: typeof result.status?.pairedAt === 'string' ? result.status.pairedAt : new Date().toISOString(),
    lastSyncedAt: null,
  };
  await SecureStore.setItemAsync(CONNECTION_KEY, JSON.stringify(connection), {
    keychainAccessible: SecureStore.WHEN_UNLOCKED_THIS_DEVICE_ONLY,
  });
  return inspectDesktopDeviceConnection();
}

export async function forgetDesktopDevice() {
  if (Platform.OS === 'web') return;
  const connection = await loadConnection();
  if (connection) {
    await requestJson(`${connection.baseUrl}/integrations/device/unpair`, {
      method: 'POST',
      headers: { Authorization: `Bearer ${connection.token}` },
    }).catch(() => undefined);
  }
  await SecureStore.deleteItemAsync(CONNECTION_KEY);
}

export async function fetchPairedDesktopJson<T>(pathname: '/integrations/device/status' | '/integrations/device/observations'): Promise<T> {
  const connection = await loadConnection();
  if (!connection) throw new Error('Pair this iPhone with ATIRA on your Windows laptop first.');
  const result = await requestJson<T>(`${connection.baseUrl}${pathname}`, {
    headers: { Authorization: `Bearer ${connection.token}` },
  });
  if (pathname === '/integrations/device/observations') {
    await SecureStore.setItemAsync(CONNECTION_KEY, JSON.stringify({ ...connection, lastSyncedAt: new Date().toISOString() }), {
      keychainAccessible: SecureStore.WHEN_UNLOCKED_THIS_DEVICE_ONLY,
    });
  }
  return result;
}

async function loadConnection(): Promise<StoredDesktopDeviceConnection | null> {
  if (Platform.OS === 'web') return null;
  const encoded = await SecureStore.getItemAsync(CONNECTION_KEY);
  if (!encoded) return null;
  try {
    const value = JSON.parse(encoded) as Partial<StoredDesktopDeviceConnection>;
    if (
      typeof value.baseUrl !== 'string' ||
      typeof value.token !== 'string' ||
      typeof value.deviceLabel !== 'string' ||
      typeof value.pairedAt !== 'string'
    ) return null;
    return {
      baseUrl: value.baseUrl,
      token: value.token,
      deviceLabel: value.deviceLabel,
      pairedAt: value.pairedAt,
      lastSyncedAt: typeof value.lastSyncedAt === 'string' ? value.lastSyncedAt : null,
    };
  } catch {
    return null;
  }
}

async function loadOrCreateClientId() {
  const existing = await SecureStore.getItemAsync(CLIENT_ID_KEY);
  if (existing) return existing;
  const clientId = Crypto.randomUUID();
  await SecureStore.setItemAsync(CLIENT_ID_KEY, clientId, {
    keychainAccessible: SecureStore.WHEN_UNLOCKED_THIS_DEVICE_ONLY,
  });
  return clientId;
}

function normalizePrivateNetworkAddress(value: string) {
  const trimmed = value.trim().replace(/^https?:\/\//i, '').replace(/\/+$/, '');
  const match = /^(\d{1,3}(?:\.\d{1,3}){3})(?::(\d{1,5}))?$/.exec(trimmed);
  if (!match || !isPrivateIpv4(match[1])) {
    throw new Error('Enter the private Wi-Fi address shown by ATIRA on Windows, such as 192.168.1.20:43123.');
  }
  const port = Number(match[2] ?? DEFAULT_PORT);
  if (port < 1 || port > 65535) throw new Error('The Windows connection address has an invalid port.');
  return `http://${match[1]}:${port}`;
}

function isPrivateIpv4(address: string) {
  const parts = address.split('.').map(Number);
  if (parts.some((part) => !Number.isInteger(part) || part < 0 || part > 255)) return false;
  return parts[0] === 10 ||
    (parts[0] === 172 && parts[1] >= 16 && parts[1] <= 31) ||
    (parts[0] === 192 && parts[1] === 168);
}

async function requestJson<T>(url: string, init: RequestInit): Promise<T> {
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), REQUEST_TIMEOUT_MS);
  try {
    const response = await fetch(url, { ...init, signal: controller.signal });
    if (!response.ok) {
      const payload = await response.json().catch(() => null) as { error?: string } | null;
      throw new Error(payload?.error ?? `Windows companion returned ${response.status}.`);
    }
    return await response.json() as T;
  } catch (cause) {
    if (cause instanceof Error && cause.name === 'AbortError') {
      throw new Error('The iPhone could not reach the Windows laptop. Keep both devices on the same Wi-Fi and leave ATIRA running on Windows.', { cause });
    }
    throw cause;
  } finally {
    clearTimeout(timeout);
  }
}

function emptyStatus(supported: boolean): DesktopDeviceConnectionStatus {
  return { supported, paired: false, address: null, deviceLabel: null, pairedAt: null, lastSyncedAt: null };
}
