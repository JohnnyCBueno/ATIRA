import { describe, expect, it } from 'vitest';
import {
  createDesktopPairingQrPayload,
  parseDesktopPairingQrPayload,
} from './devicePairingQr';

describe('Windows device pairing QR payload', () => {
  it('round-trips only the private address, one-time code and expiry', () => {
    const input = {
      address: '192.168.1.20:43123',
      code: '042913',
      expiresAt: '2026-07-25T19:05:00.000Z',
    };
    const encoded = createDesktopPairingQrPayload(input);

    expect(encoded).toContain('atira://windows-pair');
    expect(parseDesktopPairingQrPayload(encoded, new Date('2026-07-25T19:01:00.000Z'))).toEqual(input);
    expect(encoded).not.toContain('token');
  });

  it('rejects public addresses, malformed codes and foreign QR codes', () => {
    expect(() => createDesktopPairingQrPayload({
      address: '8.8.8.8:43123',
      code: '123456',
      expiresAt: '2026-07-25T19:05:00.000Z',
    })).toThrow('private');
    expect(() => createDesktopPairingQrPayload({
      address: '192.168.1.20:43123',
      code: '123',
      expiresAt: '2026-07-25T19:05:00.000Z',
    })).toThrow('six digits');
    expect(() => parseDesktopPairingQrPayload(
      'https://example.com/not-atira',
      new Date('2026-07-25T19:01:00.000Z'),
    )).toThrow('not an ATIRA');
  });

  it('rejects expired and implausibly long-lived payloads', () => {
    const expired = createDesktopPairingQrPayload({
      address: '10.0.0.4:43123',
      code: '123456',
      expiresAt: '2026-07-25T19:05:00.000Z',
    });
    expect(() => parseDesktopPairingQrPayload(expired, new Date('2026-07-25T19:06:00.000Z'))).toThrow('expired');

    const longLived = createDesktopPairingQrPayload({
      address: '172.16.0.4:43123',
      code: '123456',
      expiresAt: '2026-07-25T20:00:00.000Z',
    });
    expect(() => parseDesktopPairingQrPayload(longLived, new Date('2026-07-25T19:01:00.000Z'))).toThrow('invalid expiry');
  });
});
