import { describe, expect, it } from 'vitest';
import { assessSourceCoverage } from './coverageEngine';
import { SourceCoverageWindow } from './contracts';

describe('source coverage assessment', () => {
  it('distinguishes partial coverage from genuine zero activity', () => {
    const result = assessSourceCoverage([
      window('desktop-observed', 'desktop', '2026-07-21T09:00:00.000Z', '2026-07-21T09:30:00.000Z', 'observed'),
      window('desktop-missing', 'desktop', '2026-07-21T09:30:00.000Z', '2026-07-21T10:00:00.000Z', 'missing'),
    ], ['desktop'], '2026-07-21T09:00:00.000Z', '2026-07-21T10:00:00.000Z')[0];

    expect(result).toMatchObject({ state: 'partial', coveragePercent: 50, observedSeconds: 1800, expectedSeconds: 3600 });
  });

  it('uses the strongest explicit coverage when intervals overlap', () => {
    const result = assessSourceCoverage([
      window('partial', 'phone', '2026-07-21T09:00:00.000Z', '2026-07-21T10:00:00.000Z', 'partial'),
      window('observed', 'phone', '2026-07-21T09:15:00.000Z', '2026-07-21T09:45:00.000Z', 'observed'),
    ], ['phone'], '2026-07-21T09:00:00.000Z', '2026-07-21T10:00:00.000Z')[0];

    expect(result).toMatchObject({ state: 'sufficient', coveragePercent: 75 });
  });

  it('reports unknown rather than assuming coverage from silence', () => {
    const result = assessSourceCoverage([], ['health'], '2026-07-21T09:00:00.000Z', '2026-07-21T10:00:00.000Z')[0];
    expect(result).toMatchObject({ state: 'unknown', coveragePercent: 0 });
    expect(result.reasons[0]).toContain('No explicit collector coverage');
  });
});

function window(
  id: string,
  source: SourceCoverageWindow['source'],
  startedAt: string,
  endedAt: string,
  state: SourceCoverageWindow['state'],
): SourceCoverageWindow {
  return { id, source, startedAt, endedAt, state, quality: 1 };
}
