import { describe, expect, it } from 'vitest';
import { CollectorRecord, DeviceRecord, RawObservation } from './contracts';
import { getTimelineRepository } from './timelineRepository.web';

describe('local Windows identity reconciliation', () => {
  it('moves a predecessor companion identity into the current installed identity without losing observations or rules', async () => {
    const repository = getTimelineRepository();
    await repository.initialize([]);
    const predecessor = device('device-predecessor', '2026-07-21T09:00:00.000Z');
    const current = device('device-current', '2026-07-22T09:00:00.000Z');
    const predecessorCollector = collector('collector-predecessor', predecessor.id, predecessor.createdAt);
    const currentCollector = collector('collector-current', current.id, current.createdAt);
    await repository.upsertDevice(predecessor);
    await repository.upsertDevice(current);
    await repository.upsertCollector(predecessorCollector);
    await repository.upsertCollector(currentCollector);
    await repository.appendObservations([
      observation('old-session', predecessor.id, predecessorCollector.id, '2026-07-21T10:00:00.000Z'),
      observation('new-session', current.id, currentCollector.id, '2026-07-22T10:00:00.000Z'),
    ]);
    await repository.upsertDigitalActivityRule({
      id: `${predecessor.id}:chatgpt`,
      deviceId: predecessor.id,
      applicationId: 'chatgpt',
      purpose: 'work',
      excluded: false,
      createdAt: predecessor.createdAt,
      updatedAt: predecessor.createdAt,
    });

    expect(await repository.reconcileLegacyDesktopIdentity(current, currentCollector)).toBe(1);
    expect((await repository.listDevices()).map((item) => item.id)).toEqual([current.id]);
    expect((await repository.listObservations()).map((item) => [item.id, item.deviceId, item.collectorId])).toEqual([
      ['old-session', current.id, currentCollector.id],
      ['new-session', current.id, currentCollector.id],
    ]);
    expect(await repository.listDigitalActivityRules()).toEqual([
      expect.objectContaining({ id: `${current.id}:chatgpt`, deviceId: current.id, applicationId: 'chatgpt', purpose: 'work' }),
    ]);
  });
});

function device(id: string, createdAt: string): DeviceRecord {
  return { id, deviceClass: 'computer', platform: 'windows', label: 'Windows computer', createdAt, updatedAt: createdAt };
}

function collector(id: string, deviceId: string, createdAt: string): CollectorRecord {
  return { id, deviceId, source: 'desktop', provider: 'atira_windows_companion', label: 'Windows activity', createdAt, updatedAt: createdAt };
}

function observation(id: string, deviceId: string, collectorId: string, startedAt: string): RawObservation {
  const endedAt = new Date(Date.parse(startedAt) + 120_000).toISOString();
  return { id, deviceId, collectorId, source: 'desktop', kind: 'desktop_foreground', startedAt, endedAt, capturedAt: endedAt, quality: 1, payload: { application: 'ChatGPT', activityState: 'active' } };
}
