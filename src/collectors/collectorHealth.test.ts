import { describe, expect, it } from 'vitest';
import { CollectorStatus } from '../data/contracts';
import { assessCollectorHealth } from './collectorHealth';

const now = '2026-07-23T12:00:00.000Z';

describe('collector health', () => {
  it('reports a fresh running desktop collector as healthy', () => {
    const result = assessCollectorHealth(status({ operationalState: 'collecting', updatedAt: '2026-07-23T11:59:30.000Z' }), now);
    expect(result).toMatchObject({ state: 'healthy', operationalState: 'collecting', staleAfterSeconds: 240, ageSeconds: 30 });
  });

  it('reports a stale health report without pretending that its history is missing', () => {
    const result = assessCollectorHealth(status({ operationalState: 'collecting', updatedAt: '2026-07-23T11:50:00.000Z' }), now);
    expect(result).toMatchObject({ state: 'delayed', operationalState: 'collecting', ageSeconds: 600 });
    expect(result.reason).toContain('has not received');
  });

  it('preserves a user pause as an explicit coverage gap', () => {
    const result = assessCollectorHealth(status({ operationalState: 'paused', state: 'missing_coverage' }), now);
    expect(result).toMatchObject({ state: 'paused', operationalState: 'paused' });
  });

  it('keeps permissions and offline collectors distinct', () => {
    expect(assessCollectorHealth(status({ source: 'location', state: 'permission_required', operationalState: 'unknown' }), now).state).toBe('setup_required');
    expect(assessCollectorHealth(status({ state: 'temporarily_unavailable', operationalState: 'offline' }), now).state).toBe('offline');
  });
});

function status(overrides: Partial<CollectorStatus> = {}): CollectorStatus {
  return {
    source: 'desktop',
    state: 'available_full',
    detail: 'Windows collector is running.',
    updatedAt: '2026-07-23T11:59:30.000Z',
    ...overrides,
  };
}
