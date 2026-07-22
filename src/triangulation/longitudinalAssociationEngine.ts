import {
  DailyMetricPoint,
  LongitudinalAssociation,
  LongitudinalAssociationResult,
} from './contracts';

export interface LongitudinalAssociationOptions {
  minimumCoveragePercent: number;
  emergingMinimumPairedDays: number;
  emergingMinimumHistoryDays: number;
  emergingMinimumAbsoluteCoefficient: number;
  establishedMinimumPairedDays: number;
  establishedMinimumHistoryDays: number;
  establishedMinimumAbsoluteCoefficient: number;
}

export const defaultLongitudinalAssociationOptions: LongitudinalAssociationOptions = {
  minimumCoveragePercent: 70,
  emergingMinimumPairedDays: 7,
  emergingMinimumHistoryDays: 14,
  emergingMinimumAbsoluteCoefficient: 0.5,
  establishedMinimumPairedDays: 20,
  establishedMinimumHistoryDays: 28,
  establishedMinimumAbsoluteCoefficient: 0.35,
};

export function analyzeLongitudinalAssociation(
  left: DailyMetricPoint[],
  right: DailyMetricPoint[],
  options: LongitudinalAssociationOptions = defaultLongitudinalAssociationOptions,
): LongitudinalAssociationResult {
  const blockedReasons: string[] = [];
  const leftMetric = singleMetric(left);
  const rightMetric = singleMetric(right);
  if (!leftMetric || !rightMetric) {
    return { pairedDayCount: 0, historyDayCount: 0, blockedReasons: ['Each input must contain exactly one metric.'] };
  }
  const leftSources = new Set(left.map((point) => point.source));
  const rightSources = new Set(right.map((point) => point.source));
  const independentSources = new Set([...leftSources, ...rightSources]);
  if (independentSources.size < 2) blockedReasons.push('Cross-source associations require at least two independent source types.');
  if ([...left, ...right].some((point) => point.role === 'declared')) {
    blockedReasons.push('Declared intentions cannot establish an observed behavioural association.');
  }

  const leftByDay = eligibleByDay(left, options.minimumCoveragePercent);
  const rightByDay = eligibleByDay(right, options.minimumCoveragePercent);
  const dayIds = [...leftByDay.keys()].filter((dayId) => rightByDay.has(dayId)).sort();
  const historyDayCount = dayIds.length > 0 ? daysInclusive(dayIds[0], dayIds[dayIds.length - 1]) : 0;
  const pairedDayCount = dayIds.length;
  if (pairedDayCount < options.emergingMinimumPairedDays || historyDayCount < options.emergingMinimumHistoryDays) {
    blockedReasons.push(`Only ${pairedDayCount} sufficiently covered paired days were available across ${historyDayCount} days of history.`);
  }
  if (blockedReasons.length > 0) return { pairedDayCount, historyDayCount, blockedReasons };

  const leftValues = dayIds.map((dayId) => leftByDay.get(dayId)!.value);
  const rightValues = dayIds.map((dayId) => rightByDay.get(dayId)!.value);
  const coefficient = pearson(leftValues, rightValues);
  if (coefficient == null) {
    return { pairedDayCount, historyDayCount, blockedReasons: ['An association cannot be calculated when either metric has no variation.'] };
  }
  const absoluteCoefficient = Math.abs(coefficient);
  const established = pairedDayCount >= options.establishedMinimumPairedDays
    && historyDayCount >= options.establishedMinimumHistoryDays
    && absoluteCoefficient >= options.establishedMinimumAbsoluteCoefficient;
  const emerging = absoluteCoefficient >= options.emergingMinimumAbsoluteCoefficient;
  if (!established && !emerging) {
    return {
      pairedDayCount,
      historyDayCount,
      blockedReasons: [`The observed relationship (${round(coefficient, 2)}) was not strong or mature enough to report.`],
    };
  }

  const maturity: LongitudinalAssociation['maturity'] = established ? 'established' : 'emerging';
  const direction = coefficient >= 0 ? 'higher' : 'lower';
  const leftLabel = leftByDay.get(dayIds[0])!.label;
  const rightLabel = rightByDay.get(dayIds[0])!.label;
  const confidence = round(Math.min(0.9, 0.45 + absoluteCoefficient * 0.25 + Math.min(0.2, pairedDayCount / 100)), 2);
  const association: LongitudinalAssociation = {
    id: `association:${stableHash(`${leftMetric}|${rightMetric}|${dayIds[0]}|${dayIds.at(-1)}`)}`,
    maturity,
    leftMetricId: leftMetric,
    rightMetricId: rightMetric,
    pairedDayCount,
    historyDayCount,
    coefficient: round(coefficient, 2),
    confidence,
    summary: `Across ${pairedDayCount} sufficiently covered days, higher ${leftLabel} coincided with ${direction} ${rightLabel}. This is an association, not evidence that one caused the other.`,
    sources: [...independentSources].sort(),
    observationIds: [...new Set(dayIds.flatMap((dayId) => [
      ...leftByDay.get(dayId)!.observationIds,
      ...rightByDay.get(dayId)!.observationIds,
    ]))],
  };
  return { association, pairedDayCount, historyDayCount, blockedReasons: [] };
}

function singleMetric(points: DailyMetricPoint[]) {
  const metrics = [...new Set(points.map((point) => point.metricId))];
  return metrics.length === 1 ? metrics[0] : null;
}

function eligibleByDay(points: DailyMetricPoint[], minimumCoveragePercent: number) {
  return new Map(points
    .filter((point) => Number.isFinite(point.value) && point.coveragePercent >= minimumCoveragePercent && point.role !== 'declared')
    .map((point) => [point.dayId, point]));
}

function pearson(left: number[], right: number[]) {
  if (left.length !== right.length || left.length < 2) return null;
  const leftMean = left.reduce((total, value) => total + value, 0) / left.length;
  const rightMean = right.reduce((total, value) => total + value, 0) / right.length;
  let numerator = 0;
  let leftVariance = 0;
  let rightVariance = 0;
  for (let index = 0; index < left.length; index += 1) {
    const leftDelta = left[index] - leftMean;
    const rightDelta = right[index] - rightMean;
    numerator += leftDelta * rightDelta;
    leftVariance += leftDelta ** 2;
    rightVariance += rightDelta ** 2;
  }
  const denominator = Math.sqrt(leftVariance * rightVariance);
  return denominator === 0 ? null : numerator / denominator;
}

function daysInclusive(first: string, last: string) {
  const start = Date.parse(`${first}T00:00:00.000Z`);
  const end = Date.parse(`${last}T00:00:00.000Z`);
  return Number.isFinite(start) && Number.isFinite(end) ? Math.floor((end - start) / 86_400_000) + 1 : 0;
}

function stableHash(value: string) {
  let hash = 2_166_136_261;
  for (let index = 0; index < value.length; index += 1) {
    hash ^= value.charCodeAt(index);
    hash = Math.imul(hash, 16_777_619);
  }
  return (hash >>> 0).toString(36);
}

function round(value: number, places: number) { const factor = 10 ** places; return Math.round(value * factor) / factor; }
