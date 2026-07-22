import { describe, expect, it } from 'vitest';
import { buildConfirmationQueue } from './confirmationPolicy';
import { ConfirmationHistoryRecord, TriangulationCandidate } from './contracts';

describe('confirmation policy', () => {
  it('asks only a high-value, uncertain yes-or-no question', () => {
    const result = buildConfirmationQueue([
      candidate('useful', 0.65, 0.8),
      candidate('obvious', 0.95, 0.8),
      candidate('low-value', 0.65, 0.2),
    ], [], new Date('2026-07-21T12:00:00.000Z'));

    expect(result.prompts).toHaveLength(1);
    expect(result.prompts[0]).toMatchObject({ candidateId: 'useful', question: 'Did this happen?' });
  });

  it('respects quiet hours rather than interrupting the user', () => {
    const result = buildConfirmationQueue([candidate('one', 0.65, 0.8)], [], new Date('2026-07-21T22:00:00.000Z'));
    expect(result.prompts).toHaveLength(0);
    expect(result.deferredReasons[0]).toContain('quiet hours');
  });

  it('enforces the daily question limit', () => {
    const history: ConfirmationHistoryRecord[] = [
      historyItem('previous-a', '2026-07-21T10:00:00.000Z'),
      historyItem('previous-b', '2026-07-21T11:00:00.000Z'),
    ];
    const result = buildConfirmationQueue([candidate('one', 0.65, 0.8)], history, new Date('2026-07-21T12:00:00.000Z'));
    expect(result.prompts).toHaveLength(0);
    expect(result.deferredReasons[0]).toContain('daily confirmation limit');
  });

  it('does not repeat answered or recently dismissed questions', () => {
    const answered: ConfirmationHistoryRecord = {
      ...historyItem('one', '2026-07-20T10:00:00.000Z'),
      fingerprint: 'fingerprint-one',
      state: 'answered',
      answer: 'yes',
    };
    const dismissed: ConfirmationHistoryRecord = {
      ...historyItem('two', '2026-07-20T10:00:00.000Z'),
      fingerprint: 'fingerprint-two',
      state: 'dismissed',
    };
    const result = buildConfirmationQueue([
      candidate('one', 0.65, 0.8),
      candidate('two', 0.65, 0.8),
    ], [answered, dismissed], new Date('2026-07-21T12:00:00.000Z'));
    expect(result.prompts).toHaveLength(0);
  });
});

function candidate(id: string, confidence: number, informationGain: number): TriangulationCandidate {
  return {
    id,
    fingerprint: `fingerprint-${id}`,
    ruleId: 'test-rule',
    kind: 'test',
    title: 'Test candidate',
    summary: 'Test candidate summary.',
    startedAt: '2026-07-21T09:00:00.000Z',
    endedAt: '2026-07-21T09:10:00.000Z',
    confidence,
    status: 'candidate',
    informationGain,
    independentObservedSources: ['desktop', 'motion'],
    evidence: [{ evidenceId: 'evidence', relation: 'support', source: 'motion', role: 'observed', observationIds: ['observation'] }],
    coverage: [],
    reasoning: [],
    alternatives: [],
    confirmationQuestion: 'Did this happen?',
  };
}

function historyItem(candidateId: string, createdAt: string): ConfirmationHistoryRecord {
  return {
    id: `history-${candidateId}`,
    candidateId,
    fingerprint: `fingerprint-${candidateId}`,
    state: 'presented',
    createdAt,
  };
}
