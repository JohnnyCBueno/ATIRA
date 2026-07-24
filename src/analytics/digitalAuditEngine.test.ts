import { describe, expect, it } from 'vitest';
import { RawObservation } from '../data/contracts';
import { DigitalActivityRule } from '../domain/types';
import { buildDigitalAudit } from './digitalAuditEngine';

const devices = [
  { id: 'computer', deviceClass: 'computer' as const, platform: 'windows' as const, label: 'Work laptop', createdAt: '2026-01-01T00:00:00.000Z', updatedAt: '2026-01-01T00:00:00.000Z' },
  { id: 'phone', deviceClass: 'phone' as const, platform: 'android' as const, label: 'Phone', createdAt: '2026-01-01T00:00:00.000Z', updatedAt: '2026-01-01T00:00:00.000Z' },
];

describe('buildDigitalAudit', () => {
  it('keeps the same application independently classified by device', () => {
    const rules: DigitalActivityRule[] = [
      rule('computer', 'chatgpt', 'work'),
      rule('phone', 'chatgpt', 'personal'),
    ];
    const audit = buildDigitalAudit([
      observation('desktop-1', 'computer', '2026-07-21T09:00:00', 'ChatGPT', 600, 'desktop_foreground'),
      observation('phone-1', 'phone', '2026-07-21T10:00:00', 'ChatGPT', 300, 'app_foreground', 'phone'),
    ], devices, rules, '7d', new Date(2026, 6, 21, 12));

    expect(audit.applications).toHaveLength(2);
    expect(audit.applications.find((item) => item.deviceId === 'computer')?.purpose).toBe('work');
    expect(audit.applications.find((item) => item.deviceId === 'phone')?.purpose).toBe('personal');
    expect(audit.applications.every((item) => item.classificationProvenance === 'user_rule')).toBe(true);
  });

  it('ignores short, idle, internal, and explicitly excluded sessions', () => {
    const excluded = { ...rule('computer', 'spotify', 'personal'), excluded: true };
    const items = [
      observation('short', 'computer', '2026-07-21T09:00:00', 'Code', 59),
      observation('idle', 'computer', '2026-07-21T10:00:00', 'Code', 600, 'desktop_foreground', 'desktop', 'idle'),
      observation('internal', 'computer', '2026-07-21T11:00:00', 'ATIRA', 600),
      observation('excluded', 'computer', '2026-07-21T12:00:00', 'Spotify', 600),
    ];
    const audit = buildDigitalAudit(items, devices, [excluded], '7d', new Date(2026, 6, 21, 12));
    expect(audit.totalSeconds).toBe(0);
    expect(audit.observedDayCount).toBe(0);
  });

  it('does not turn an uninterrupted overnight foreground session into audit time', () => {
    const audit = buildDigitalAudit([
      observation('overnight', 'computer', '2026-07-20T22:00:00', 'explorer', 10 * 60 * 60),
    ], devices, [], '7d', new Date(2026, 6, 21, 12));
    expect(audit.totalSeconds).toBe(0);
    expect(audit.observedDayCount).toBe(0);
  });

  it('distinguishes a missing day from an observed day with activity', () => {
    const audit = buildDigitalAudit([
      observation('one', 'computer', '2026-07-21T09:00:00', 'Code', 600),
    ], devices, [], '7d', new Date(2026, 6, 21, 12));
    expect(audit.days.filter((day) => day.observed)).toHaveLength(1);
    expect(audit.missingDayCount).toBe(6);
    expect(audit.coveragePercent).toBe(14);
    expect(audit.maturity).toBe('audit');
    expect(audit.hours.find((item) => item.hour === 9)?.totalSeconds).toBe(600);
    expect(audit.hours.find((item) => item.hour === 8)?.totalSeconds).toBe(0);
  });

  it('creates only a provisional signal from two sufficiently covered periods', () => {
    const items: RawObservation[] = [];
    for (let offset = 0; offset < 7; offset += 1) {
      items.push(observation(`prior-${offset}`, 'computer', localIso(2026, 6, 8 + offset, 9), 'Code', 600));
      items.push(observation(`current-${offset}`, 'computer', localIso(2026, 6, 15 + offset, 9), offset < 6 ? 'Teams' : 'Code', 600));
    }
    const audit = buildDigitalAudit(items, devices, [], '7d', new Date(2026, 6, 21, 12));
    expect(audit.signals).toHaveLength(1);
    expect(audit.signals[0].summary).toContain('provisional');
    expect(audit.insights).toHaveLength(0);
    expect(audit.maturity).toBe('emerging');
  });

  it('requires longitudinal repetition before establishing an insight', () => {
    const items: RawObservation[] = [];
    for (let offset = 0; offset < 30; offset += 1) {
      const date = new Date(2026, 6, 21 - offset, 9);
      items.push(observation(`history-${offset}`, 'computer', localIso(date.getFullYear(), date.getMonth(), date.getDate(), 9), 'Code', 600));
    }
    const audit = buildDigitalAudit(items, devices, [], '30d', new Date(2026, 6, 21, 12));
    expect(audit.insights).toHaveLength(1);
    expect(audit.insights[0].summary).toContain('not whether that time was productive');
    expect(audit.maturity).toBe('established');
  });

  it('keeps interaction intensity out of the timeline while establishing a longitudinal engagement insight', () => {
    const items: RawObservation[] = [];
    for (let offset = 0; offset < 30; offset += 1) {
      const date = new Date(2026, 6, 21 - offset, 9);
      items.push({
        ...observation(`excel-${offset}`, 'computer', localIso(date.getFullYear(), date.getMonth(), date.getDate(), 9), 'EXCEL', 600),
        payload: { application: 'EXCEL', activityState: 'active', interactiveSeconds: 480, passiveSeconds: 120 },
      });
    }
    const audit = buildDigitalAudit(items, devices, [], '30d', new Date(2026, 6, 21, 12));
    const excel = audit.applications.find((application) => application.applicationId === 'excel');
    expect(excel).toMatchObject({ interactiveSeconds: 14_400, passiveSeconds: 3_600 });
    expect(audit.insights.find((insight) => insight.id.includes('engagement'))?.summary).toContain('not the quality or productivity');
  });

  it('recalculates and invalidates classified work when a user rule changes', () => {
    const items = [observation('one', 'computer', '2026-07-21T09:00:00', 'ChatGPT', 600)];
    const workAudit = buildDigitalAudit(items, devices, [rule('computer', 'chatgpt', 'work')], '7d', new Date(2026, 6, 21, 12));
    const personalAudit = buildDigitalAudit(items, devices, [rule('computer', 'chatgpt', 'personal')], '7d', new Date(2026, 6, 21, 12));

    expect(workAudit.purposes.find((item) => item.purpose === 'work')?.durationSeconds).toBe(600);
    expect(personalAudit.purposes.find((item) => item.purpose === 'work')?.durationSeconds).toBe(0);
    expect(personalAudit.purposes.find((item) => item.purpose === 'personal')?.durationSeconds).toBe(600);
  });

  it('uses active-domain evidence without double-counting the overlapping Chrome process', () => {
    const chrome = observation('chrome', 'computer', '2026-07-21T09:00:00', 'chrome', 600);
    const website: RawObservation = {
      ...observation('website', 'computer', '2026-07-21T09:02:00', 'chrome', 300),
      kind: 'browser_foreground',
      payload: { application: 'chrome', activityState: 'active', domain: 'docs.google.com' },
    };
    const audit = buildDigitalAudit([chrome, website], devices, [], '7d', new Date(2026, 6, 21, 12));
    expect(audit.totalSeconds).toBe(600);
    expect(audit.applications.find((item) => item.applicationId === 'web:docs.google.com')).toMatchObject({
      applicationName: 'Google Docs',
      durationSeconds: 300,
      purpose: 'unknown',
    });
    expect(audit.applications.find((item) => item.applicationId === 'chrome')?.durationSeconds).toBe(300);
  });

  it('joins adjacent same-domain fragments before applying the one-minute noise threshold', () => {
    const chrome = observation('chrome-run', 'computer', '2026-07-21T09:00:00', 'chrome', 120);
    const first: RawObservation = {
      ...observation('gmail-a', 'computer', '2026-07-21T09:00:10', 'chrome', 40),
      kind: 'browser_foreground',
      payload: { application: 'chrome', activityState: 'active', domain: 'mail.google.com' },
    };
    const second: RawObservation = {
      ...observation('gmail-b', 'computer', '2026-07-21T09:00:50', 'chrome', 30),
      kind: 'browser_foreground',
      payload: { application: 'chrome', activityState: 'active', domain: 'mail.google.com' },
    };
    const audit = buildDigitalAudit([chrome, first, second], devices, [], '7d', new Date(2026, 6, 21, 12));
    const gmail = audit.applications.find((item) => item.applicationId === 'web:mail.google.com');
    expect(gmail).toMatchObject({ applicationName: 'Gmail', durationSeconds: 70, sessionCount: 1 });
    expect(gmail?.observationIds).toEqual(['gmail-a', 'gmail-b']);
    expect(audit.totalSeconds).toBe(70);
  });
});

function observation(
  id: string,
  deviceId: string,
  startedAt: string,
  application: string,
  durationSeconds: number,
  kind: RawObservation['kind'] = 'desktop_foreground',
  source: RawObservation['source'] = 'desktop',
  activityState = 'active',
): RawObservation {
  const start = new Date(startedAt);
  const end = new Date(start.getTime() + durationSeconds * 1000);
  return {
    id,
    deviceId,
    source,
    kind,
    startedAt: start.toISOString(),
    endedAt: end.toISOString(),
    capturedAt: end.toISOString(),
    quality: 1,
    payload: { application, activityState },
  };
}

function rule(deviceId: string, applicationId: string, purpose: DigitalActivityRule['purpose']): DigitalActivityRule {
  return { id: `${deviceId}:${applicationId}`, deviceId, applicationId, purpose, excluded: false, createdAt: '2026-01-01T00:00:00.000Z', updatedAt: '2026-01-01T00:00:00.000Z' };
}

function localIso(year: number, month: number, day: number, hour: number) {
  return new Date(year, month, day, hour).toISOString();
}
