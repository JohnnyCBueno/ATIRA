export interface DesktopPairingQrPayload {
  address: string;
  code: string;
  expiresAt: string;
}

const PAIRING_SCHEME = 'atira:';
const PAIRING_HOST = 'windows-pair';

export function createDesktopPairingQrPayload(input: DesktopPairingQrPayload) {
  const parsed = validatePayload(input);
  const url = new URL(`${PAIRING_SCHEME}//${PAIRING_HOST}`);
  url.searchParams.set('v', '1');
  url.searchParams.set('address', parsed.address);
  url.searchParams.set('code', parsed.code);
  url.searchParams.set('expires', parsed.expiresAt);
  return url.toString();
}

export function parseDesktopPairingQrPayload(value: string, now = new Date()): DesktopPairingQrPayload {
  if (value.length > 512) throw new Error('This QR code is not an ATIRA pairing code.');
  let url: URL;
  try {
    url = new URL(value);
  } catch {
    throw new Error('This QR code is not an ATIRA pairing code.');
  }
  if (url.protocol !== PAIRING_SCHEME || url.hostname !== PAIRING_HOST || url.searchParams.get('v') !== '1') {
    throw new Error('This QR code is not an ATIRA pairing code.');
  }
  const payload = validatePayload({
    address: url.searchParams.get('address') ?? '',
    code: url.searchParams.get('code') ?? '',
    expiresAt: url.searchParams.get('expires') ?? '',
  });
  const expiry = Date.parse(payload.expiresAt);
  if (expiry <= now.getTime()) throw new Error('This ATIRA pairing QR code has expired. Generate a new one on Windows.');
  if (expiry > now.getTime() + 10 * 60_000) throw new Error('This ATIRA pairing QR code has an invalid expiry.');
  return payload;
}

function validatePayload(input: DesktopPairingQrPayload): DesktopPairingQrPayload {
  const address = input.address.trim().replace(/^https?:\/\//i, '').replace(/\/+$/, '');
  const match = /^(\d{1,3}(?:\.\d{1,3}){3})(?::(\d{1,5}))?$/.exec(address);
  if (!match || !isPrivateIpv4(match[1])) throw new Error('ATIRA can pair only over a private local-network address.');
  const port = Number(match[2] ?? 43123);
  if (port < 1 || port > 65_535) throw new Error('The ATIRA pairing address has an invalid port.');
  if (!/^\d{6}$/.test(input.code)) throw new Error('The ATIRA pairing code must contain six digits.');
  if (!Number.isFinite(Date.parse(input.expiresAt))) throw new Error('The ATIRA pairing code has an invalid expiry.');
  return {
    address: `${match[1]}:${port}`,
    code: input.code,
    expiresAt: new Date(input.expiresAt).toISOString(),
  };
}

function isPrivateIpv4(address: string) {
  const parts = address.split('.').map(Number);
  if (parts.some((part) => !Number.isInteger(part) || part < 0 || part > 255)) return false;
  return parts[0] === 10
    || (parts[0] === 172 && parts[1] >= 16 && parts[1] <= 31)
    || (parts[0] === 192 && parts[1] === 168);
}
