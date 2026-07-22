import { useMemo, useState } from 'react';
import { Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { buildDigitalAudit } from '../analytics/digitalAuditEngine';
import { DeviceRecord, RawObservation } from '../data/contracts';
import { DigitalActivityCategory, DigitalActivityRule, DigitalAudit, DigitalAuditRange } from '../domain/types';
import { colours, radius } from '../theme';

type DomainId = 'overview' | 'work' | 'digital' | 'body' | 'sleep' | 'travel' | 'learning';

interface Props {
  observations: RawObservation[];
  devices: DeviceRecord[];
  rules: DigitalActivityRule[];
}

const domains: { id: DomainId; label: string; source?: string }[] = [
  { id: 'overview', label: 'Overview' },
  { id: 'work', label: 'Work & focus' },
  { id: 'digital', label: 'Digital life' },
  { id: 'body', label: 'Body & sport', source: 'a health or wearable source' },
  { id: 'sleep', label: 'Sleep', source: 'a sleep or health source' },
  { id: 'travel', label: 'Travel & places', source: 'a phone location collector' },
  { id: 'learning', label: 'Learning', source: 'more history or a classified learning source' },
];

const ranges: { id: DigitalAuditRange; label: string }[] = [
  { id: '7d', label: '7 days' },
  { id: '30d', label: '30 days' },
  { id: '90d', label: '90 days' },
];

const categoryColours: Record<DigitalActivityCategory, string> = {
  creation: colours.moss,
  communication: colours.coral,
  learning: '#596FA5',
  entertainment: '#8A641E',
  browser: colours.blue,
  ai_assistance: '#6B6789',
  other: colours.inkSoft,
};

export function PatternsScreen({ observations, devices, rules }: Props) {
  const [domainId, setDomainId] = useState<DomainId>('overview');
  const [range, setRange] = useState<DigitalAuditRange>('7d');
  const [expandedEvidenceId, setExpandedEvidenceId] = useState<string | null>(null);
  const audit = useMemo(() => buildDigitalAudit(observations, devices, rules, range), [devices, observations, range, rules]);
  const domain = domains.find((item) => item.id === domainId) ?? domains[0];
  const unavailable = Boolean(domain.source) && !(domain.id === 'learning' && audit.purposes.find((item) => item.purpose === 'learning')?.durationSeconds);

  return (
    <ScrollView showsVerticalScrollIndicator={false} contentInsetAdjustmentBehavior="automatic" contentContainerStyle={styles.content}>
      <Text style={styles.eyebrow}>PATTERNS</Text>
      <Text style={styles.title}>Your history, without the guesswork.</Text>
      <Text style={styles.subtitle}>Facts appear immediately. Signals and insights unlock only when the evidence earns them.</Text>

      <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.domainStrip}>
        {domains.map((item) => {
          const selected = item.id === domainId;
          return (
            <Pressable key={item.id} onPress={() => setDomainId(item.id)} style={[styles.domainChip, selected && styles.domainChipSelected]}>
              <Text style={[styles.domainLabel, selected && styles.domainLabelSelected]}>{item.label}</Text>
            </Pressable>
          );
        })}
      </ScrollView>

      <View style={styles.rangePicker}>
        {ranges.map((item) => (
          <Pressable key={item.id} onPress={() => setRange(item.id)} style={[styles.rangeItem, item.id === range && styles.rangeSelected]}>
            <Text style={[styles.rangeText, item.id === range && styles.rangeTextSelected]}>{item.label}</Text>
          </Pressable>
        ))}
      </View>

      {unavailable ? <UnavailableDomain label={domain.label} source={domain.source ?? 'the relevant source'} /> : (
        <>
          <MaturityHero audit={audit} domainId={domainId} />
          <AuditSummary audit={audit} domainId={domainId} />
          <InteractionShape audit={audit} domainId={domainId} />
          <DailyChart audit={audit} domainId={domainId} />
          <HourlyDistribution audit={audit} domainId={domainId} />
          <Breakdown audit={audit} domainId={domainId} />
          <ApplicationRanking audit={audit} domainId={domainId} />
          <InsightSection audit={audit} expandedEvidenceId={expandedEvidenceId} onToggleEvidence={setExpandedEvidenceId} />
        </>
      )}
    </ScrollView>
  );
}

function MaturityHero({ audit, domainId }: { audit: DigitalAudit; domainId: DomainId }) {
  const workSeconds = audit.purposes.find((item) => item.purpose === 'work')?.durationSeconds ?? 0;
  const title = audit.totalSeconds === 0
    ? 'Waiting for the first complete sessions.'
    : audit.maturity === 'audit'
      ? 'ATIRA is still learning.'
      : audit.maturity === 'emerging'
        ? 'An early signal is taking shape.'
        : 'A repeated pattern has enough history.';
  const body = audit.totalSeconds === 0
    ? 'Keep the Windows collector running while you use the computer. Missing evidence is never treated as zero activity.'
    : audit.maturity === 'audit'
      ? `${audit.observedDayCount} of ${audit.expectedDayCount} days contain usable digital evidence. The audit is real; a personal pattern is not established yet.`
      : audit.maturity === 'emerging'
        ? 'Two sufficiently covered periods can now be compared, but the result remains provisional.'
        : 'At least 28 days and repeated occurrences support the statement below. It remains an association, not a causal claim.';
  return (
    <View style={styles.hero}>
      <View style={styles.heroTop}>
        <Text style={styles.heroEyebrow}>{audit.maturity.toUpperCase()} · {rangeLabel(audit.range).toUpperCase()}</Text>
        <View style={styles.maturityBadge}><Text style={styles.maturityBadgeText}>{audit.maturity === 'audit' ? 'FACTS ONLY' : audit.maturity.toUpperCase()}</Text></View>
      </View>
      <Text style={styles.heroTitle}>{title}</Text>
      <Text style={styles.heroBody}>{body}</Text>
      {domainId === 'work' && <Text style={styles.heroFootnote}>{workSeconds > 0 ? `${formatDuration(workSeconds)} is currently classified as work.` : 'No observed time is currently classified as work.'}</Text>}
    </View>
  );
}

function AuditSummary({ audit, domainId }: { audit: DigitalAudit; domainId: DomainId }) {
  const workSeconds = audit.purposes.find((item) => item.purpose === 'work')?.durationSeconds ?? 0;
  const unknownSeconds = audit.purposes.find((item) => item.purpose === 'unknown')?.durationSeconds ?? 0;
  const primary = domainId === 'work' ? workSeconds : audit.totalSeconds;
  return (
    <View style={styles.metricsRow}>
      <Metric value={formatDuration(primary)} label={domainId === 'work' ? 'classified work' : 'observed time'} />
      <Metric value={`${audit.observedDayCount}/${audit.expectedDayCount}`} label="days observed" />
      <Metric value={formatDuration(unknownSeconds)} label="purpose unknown" />
      <Metric value={String(audit.devices.length)} label={audit.devices.length === 1 ? 'device' : 'devices'} />
    </View>
  );
}

function Metric({ value, label }: { value: string; label: string }) {
  return <View style={styles.metricCard}><Text style={styles.metricValue}>{value}</Text><Text style={styles.metricLabel}>{label}</Text></View>;
}

function InteractionShape({ audit, domainId }: { audit: DigitalAudit; domainId: DomainId }) {
  if (!['overview', 'work', 'digital'].includes(domainId)) return null;
  const applications = audit.applications.filter((application) => domainId !== 'work' || application.purpose === 'work');
  const interactive = applications.reduce((total, application) => total + application.interactiveSeconds, 0);
  const passive = applications.reduce((total, application) => total + application.passiveSeconds, 0);
  const classified = interactive + passive;
  const observed = applications.reduce((total, application) => total + application.durationSeconds, 0);
  if (classified < 60 || observed === 0 || classified / observed < 0.5) return null;
  const share = interactive / classified;
  const title = share >= 0.65 ? 'Mostly hands-on.' : share <= 0.35 ? 'Mostly passive.' : 'A mixed interaction rhythm.';
  const body = share >= 0.65
    ? 'Most qualified foreground time included recent keyboard or mouse input.'
    : share <= 0.35
      ? 'Most qualified foreground time continued without recent input—consistent with reading, watching, waiting or leaving an application visible.'
      : 'Foreground time alternated between active input and passive attention.';
  return (
    <View style={styles.interactionCard}>
      <View style={styles.interactionCopy}><Text style={styles.interactionKicker}>INTERACTION SHAPE</Text><Text style={styles.interactionTitle}>{title}</Text><Text style={styles.interactionBody}>{body} This is context for later insights, not a productivity score.</Text></View>
      <View style={styles.interactionMeasure}><Text style={styles.interactionValue}>{Math.round(share * 100)}%</Text><Text style={styles.interactionLabel}>hands-on share</Text></View>
    </View>
  );
}

function DailyChart({ audit, domainId }: { audit: DigitalAudit; domainId: DomainId }) {
  const dailyPoints = audit.days.map((day) => ({
    id: day.dayId,
    label: day.dayId.slice(8),
    observed: day.observed,
    value: domainId === 'work' ? day.purposes.find((item) => item.purpose === 'work')?.durationSeconds ?? 0 : day.totalSeconds,
  }));
  const points = audit.range === '90d'
    ? Array.from({ length: Math.ceil(dailyPoints.length / 7) }, (_, index) => {
        const week = dailyPoints.slice(index * 7, index * 7 + 7);
        return { id: `week-${index}`, label: `W${index + 1}`, observed: week.some((day) => day.observed), value: week.reduce((total, day) => total + day.value, 0) };
      })
    : dailyPoints;
  const values = points.map((point) => point.value);
  const maximum = Math.max(...values, 1);
  return (
    <View style={styles.section}>
      <View style={styles.sectionHeader}><Text style={styles.sectionTitle}>Observed days</Text><Text style={styles.sectionMeta}>{audit.coveragePercent}% day coverage</Text></View>
      <View style={styles.chartCard}>
        <View style={styles.chartArea}>
          {points.map((day, index) => {
            const value = values[index];
            const height = day.observed ? Math.max(5, Math.round((value / maximum) * 100)) : 2;
            return (
              <View key={day.id} style={styles.chartColumn}>
                <View style={styles.barTrack}><View style={[styles.barFill, !day.observed && styles.barMissing, { height: `${height}%` }]} /></View>
                <Text style={[styles.dayLabel, !day.observed && styles.dayMissing]}>{day.label}</Text>
              </View>
            );
          })}
        </View>
        <View style={styles.missingLegend}><View style={styles.missingDot} /><Text style={styles.missingText}>Thin grey marks mean missing coverage, not zero activity.</Text></View>
      </View>
    </View>
  );
}

function HourlyDistribution({ audit, domainId }: { audit: DigitalAudit; domainId: DomainId }) {
  const points = audit.hours.map((item) => ({
    hour: item.hour,
    value: domainId === 'work' ? item.purposes.find((purpose) => purpose.purpose === 'work')?.durationSeconds ?? 0 : item.totalSeconds,
  }));
  const maximum = Math.max(...points.map((item) => item.value), 1);
  const activeHours = points.filter((item) => item.value > 0);
  return (
    <View style={styles.section}>
      <View style={styles.sectionHeader}><Text style={styles.sectionTitle}>Observed by hour</Text><Text style={styles.sectionMeta}>local device time</Text></View>
      <View style={styles.hourCard}>
        <View style={styles.hourChart}>
          {points.map((point) => (
            <View key={point.hour} style={styles.hourColumn}>
              <View style={[styles.hourBar, { height: `${Math.max(point.value > 0 ? 6 : 1, Math.round((point.value / maximum) * 100))}%` }]} />
              {point.hour % 6 === 0 ? <Text style={styles.hourLabel}>{String(point.hour).padStart(2, '0')}</Text> : null}
            </View>
          ))}
        </View>
        <Text style={styles.hourFootnote}>{activeHours.length > 0 ? `${activeHours.length} hour bucket${activeHours.length === 1 ? '' : 's'} contain observed activity.` : 'No observed activity in this range.'}</Text>
      </View>
    </View>
  );
}

function Breakdown({ audit, domainId }: { audit: DigitalAudit; domainId: DomainId }) {
  const items = domainId === 'work'
    ? audit.purposes.map((item) => ({ id: item.purpose, label: labelWords(item.purpose), durationSeconds: item.durationSeconds, colour: purposeColour(item.purpose) }))
    : audit.categories.map((item) => ({ id: item.category, label: labelWords(item.category), durationSeconds: item.durationSeconds, colour: categoryColours[item.category] }));
  const visible = items.filter((item) => item.durationSeconds > 0).sort((a, b) => b.durationSeconds - a.durationSeconds);
  return (
    <View style={styles.section}>
      <View style={styles.sectionHeader}><Text style={styles.sectionTitle}>{domainId === 'work' ? 'Purpose classification' : 'Activity categories'}</Text><Text style={styles.sectionMeta}>derived from application sessions</Text></View>
      <View style={styles.breakdownCard}>
        {visible.length === 0 ? <Text style={styles.emptyText}>No classified activity in this range.</Text> : visible.map((item) => (
          <View key={item.id} style={styles.breakdownRow}>
            <View style={[styles.categoryDot, { backgroundColor: item.colour }]} />
            <Text style={styles.breakdownLabel}>{item.label}</Text>
            <Text style={styles.breakdownValue}>{formatDuration(item.durationSeconds)}</Text>
          </View>
        ))}
      </View>
    </View>
  );
}

function ApplicationRanking({ audit, domainId }: { audit: DigitalAudit; domainId: DomainId }) {
  const applications = audit.applications.filter((item) => domainId !== 'work' || item.purpose === 'work');
  const maximum = applications[0]?.durationSeconds ?? 1;
  return (
    <View style={styles.section}>
      <View style={styles.sectionHeader}><Text style={styles.sectionTitle}>Most observed applications</Text><Text style={styles.sectionMeta}>device-qualified</Text></View>
      <View style={styles.appCard}>
        {applications.length === 0 ? <Text style={styles.emptyText}>No applications meet this view’s criteria.</Text> : applications.slice(0, 12).map((application) => (
          <View key={`${application.deviceId}:${application.applicationId}`} style={styles.appRow}>
            <View style={styles.appIdentity}><Text style={styles.appName}>{application.applicationName}</Text><Text style={styles.appDevice}>{application.deviceLabel} · {labelWords(application.category)} · {labelWords(application.purpose)}</Text></View>
            <View style={styles.appMeasure}><Text style={styles.appDuration}>{formatDuration(application.durationSeconds)}</Text><View style={styles.appTrack}><View style={[styles.appFill, { width: `${Math.max(3, Math.round((application.durationSeconds / maximum) * 100))}%` }]} /></View></View>
            <Text style={[styles.ruleBadge, application.classificationProvenance === 'user_rule' && styles.ruleBadgeUser]}>{application.classificationProvenance === 'user_rule' ? 'YOUR RULE' : application.classificationProvenance === 'unclassified' ? 'NEEDS CONTEXT' : 'DEFAULT'}</Text>
          </View>
        ))}
      </View>
    </View>
  );
}

function InsightSection({ audit, expandedEvidenceId, onToggleEvidence }: { audit: DigitalAudit; expandedEvidenceId: string | null; onToggleEvidence: (id: string | null) => void }) {
  const statements = [...audit.insights, ...audit.signals];
  return (
    <View style={styles.section}>
      <View style={styles.sectionHeader}><Text style={styles.sectionTitle}>What ATIRA can honestly say</Text><Text style={styles.sectionMeta}>{audit.maturity}</Text></View>
      {statements.length === 0 ? (
        <View style={styles.learningCard}>
          <Text style={styles.learningKicker}>LEARNING STATE</Text>
          <Text style={styles.learningTitle}>No personal pattern claimed yet.</Text>
          <Text style={styles.learningBody}>ATIRA needs comparable periods for an emerging signal and at least 28 days with repeated evidence for an established insight.</Text>
        </View>
      ) : statements.map((statement) => {
        const expanded = expandedEvidenceId === statement.id;
        return (
          <Pressable key={statement.id} onPress={() => onToggleEvidence(expanded ? null : statement.id)} style={styles.insightCard}>
            <Text style={styles.insightKicker}>{statement.maturity.toUpperCase()}</Text>
            <Text style={styles.insightTitle}>{statement.title}</Text>
            <Text style={styles.insightBody}>{statement.summary}</Text>
            <View style={styles.confidenceRow}><Text style={styles.confidenceText}>{Math.round(statement.confidence * 100)}% confidence</Text><Text style={styles.evidenceAction}>{expanded ? 'Hide evidence' : 'Inspect evidence'}</Text></View>
            {expanded && statement.evidence.map((evidence) => (
              <View key={evidence.id} style={styles.evidenceBox}><Text style={styles.evidenceLabel}>{evidence.label}</Text><Text style={styles.evidenceDetail}>{evidence.detail}</Text><Text style={styles.evidenceCount}>{evidence.observationIds.length} raw observation{evidence.observationIds.length === 1 ? '' : 's'}</Text></View>
            ))}
          </Pressable>
        );
      })}
    </View>
  );
}

function UnavailableDomain({ label, source }: { label: string; source: string }) {
  return (
    <View style={styles.unavailableCard}>
      <Text style={styles.unavailableKicker}>SOURCE NOT CONNECTED</Text>
      <Text style={styles.unavailableTitle}>{label} is waiting for real evidence.</Text>
      <Text style={styles.unavailableBody}>This view needs {source}. ATIRA will not substitute fixture statistics or infer a life pattern from unrelated laptop activity.</Text>
    </View>
  );
}

function rangeLabel(range: DigitalAuditRange) { return ranges.find((item) => item.id === range)?.label ?? range; }
function labelWords(value: string) { return value.replaceAll('_', ' ').replace(/^./, (letter) => letter.toUpperCase()); }
function purposeColour(purpose: string) { return purpose === 'work' ? colours.moss : purpose === 'learning' ? '#596FA5' : purpose === 'personal' ? colours.coral : colours.inkSoft; }
function formatDuration(seconds: number) { if (seconds <= 0) return '0m'; const hours = Math.floor(seconds / 3600); const minutes = Math.round((seconds % 3600) / 60); return hours > 0 ? `${hours}h ${minutes}m` : `${Math.max(1, minutes)}m`; }

const styles = StyleSheet.create({
  content: { paddingHorizontal: 20, paddingTop: 20, paddingBottom: 120, width: '100%', maxWidth: 920, alignSelf: 'center' },
  eyebrow: { color: colours.coral, fontSize: 10, fontWeight: '900', letterSpacing: 1.3 },
  title: { color: colours.ink, fontSize: 30, lineHeight: 36, fontWeight: '900', letterSpacing: -0.9, marginTop: 5 },
  subtitle: { color: colours.inkSoft, fontSize: 12, lineHeight: 18, marginTop: 6, maxWidth: 620 },
  domainStrip: { gap: 7, paddingVertical: 17 },
  domainChip: { minHeight: 39, borderRadius: radius.pill, paddingHorizontal: 14, alignItems: 'center', justifyContent: 'center', backgroundColor: colours.surface, borderWidth: 1, borderColor: colours.line },
  domainChipSelected: { backgroundColor: colours.ink, borderColor: colours.ink },
  domainLabel: { color: colours.inkSoft, fontSize: 10, fontWeight: '800' },
  domainLabelSelected: { color: colours.white },
  rangePicker: { flexDirection: 'row', backgroundColor: colours.surfaceMuted, borderRadius: radius.medium, padding: 4, marginBottom: 14 },
  rangeItem: { flex: 1, minHeight: 36, alignItems: 'center', justifyContent: 'center', borderRadius: 11 },
  rangeSelected: { backgroundColor: colours.ink },
  rangeText: { color: colours.inkSoft, fontSize: 10, fontWeight: '800' },
  rangeTextSelected: { color: colours.white },
  hero: { backgroundColor: colours.ink, borderRadius: radius.large, padding: 22 },
  heroTop: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  heroEyebrow: { color: '#90ADA3', fontSize: 8, fontWeight: '900', letterSpacing: 1.2 },
  maturityBadge: { backgroundColor: '#2D413B', paddingHorizontal: 9, paddingVertical: 5, borderRadius: radius.pill },
  maturityBadgeText: { color: '#BBD0C9', fontSize: 7, fontWeight: '900', letterSpacing: 0.8 },
  heroTitle: { color: colours.white, fontSize: 23, lineHeight: 29, fontWeight: '900', marginTop: 18 },
  heroBody: { color: '#BECBC7', fontSize: 11, lineHeight: 17, marginTop: 7, maxWidth: 650 },
  heroFootnote: { color: '#87B7A6', fontSize: 9, fontWeight: '700', marginTop: 13 },
  metricsRow: { flexDirection: 'row', flexWrap: 'wrap', gap: 8, marginTop: 9 },
  metricCard: { flexGrow: 1, flexBasis: 150, backgroundColor: colours.surface, borderWidth: 1, borderColor: colours.line, borderRadius: radius.medium, padding: 15 },
  metricValue: { color: colours.ink, fontSize: 20, fontWeight: '900' },
  metricLabel: { color: colours.inkSoft, fontSize: 8, fontWeight: '700', marginTop: 4 },
  interactionCard: { flexDirection: 'row', alignItems: 'center', backgroundColor: '#E7EFEA', borderRadius: radius.large, padding: 18, marginTop: 9 },
  interactionCopy: { flex: 1, paddingRight: 18 },
  interactionKicker: { color: colours.moss, fontSize: 7, fontWeight: '900', letterSpacing: 1.1 },
  interactionTitle: { color: colours.ink, fontSize: 17, fontWeight: '900', marginTop: 6 },
  interactionBody: { color: colours.inkSoft, fontSize: 9, lineHeight: 14, marginTop: 4 },
  interactionMeasure: { minWidth: 92, alignItems: 'center', borderLeftWidth: 1, borderLeftColor: '#C7D8CF', paddingLeft: 16 },
  interactionValue: { color: colours.moss, fontSize: 25, fontWeight: '900' },
  interactionLabel: { color: colours.inkSoft, fontSize: 7, fontWeight: '800', marginTop: 2 },
  section: { marginTop: 23 },
  sectionHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'flex-end', marginBottom: 9 },
  sectionTitle: { color: colours.ink, fontSize: 17, fontWeight: '900' },
  sectionMeta: { color: colours.inkSoft, fontSize: 8, fontWeight: '800' },
  chartCard: { backgroundColor: colours.surface, borderWidth: 1, borderColor: colours.line, borderRadius: radius.large, padding: 16 },
  hourCard: { backgroundColor: colours.surface, borderWidth: 1, borderColor: colours.line, borderRadius: radius.large, padding: 16 },
  hourChart: { height: 120, flexDirection: 'row', alignItems: 'flex-end', gap: 4 },
  hourColumn: { flex: 1, height: '100%', justifyContent: 'flex-end', alignItems: 'center' },
  hourBar: { width: '72%', minHeight: 1, backgroundColor: colours.blue, borderTopLeftRadius: 3, borderTopRightRadius: 3 },
  hourLabel: { position: 'absolute', bottom: -16, color: colours.inkSoft, fontSize: 8, fontWeight: '700' },
  hourFootnote: { marginTop: 24, color: colours.inkSoft, fontSize: 11 },
  chartArea: { height: 150, flexDirection: 'row', alignItems: 'flex-end', gap: 4 },
  chartColumn: { flex: 1, height: '100%', alignItems: 'center' },
  barTrack: { flex: 1, width: '72%', backgroundColor: 'transparent', borderRadius: 7, overflow: 'hidden', justifyContent: 'flex-end' },
  barFill: { width: '100%', backgroundColor: colours.moss, borderRadius: 7, minHeight: 2 },
  barMissing: { backgroundColor: '#CBC5BB' },
  dayLabel: { color: colours.inkSoft, fontSize: 7, fontWeight: '800', marginTop: 6 },
  dayMissing: { color: '#AAA399' },
  missingLegend: { flexDirection: 'row', alignItems: 'center', marginTop: 13 },
  missingDot: { width: 8, height: 2, backgroundColor: '#CBC5BB', marginRight: 7 },
  missingText: { color: colours.inkSoft, fontSize: 8 },
  breakdownCard: { backgroundColor: colours.surface, borderWidth: 1, borderColor: colours.line, borderRadius: radius.large, paddingHorizontal: 16, paddingVertical: 5 },
  breakdownRow: { minHeight: 42, flexDirection: 'row', alignItems: 'center', borderBottomWidth: 1, borderBottomColor: '#EEEAE3' },
  categoryDot: { width: 8, height: 8, borderRadius: 4, marginRight: 10 },
  breakdownLabel: { flex: 1, color: colours.ink, fontSize: 11, fontWeight: '800' },
  breakdownValue: { color: colours.ink, fontSize: 11, fontWeight: '900' },
  appCard: { backgroundColor: colours.surface, borderWidth: 1, borderColor: colours.line, borderRadius: radius.large, paddingHorizontal: 16 },
  appRow: { minHeight: 72, paddingVertical: 12, borderBottomWidth: 1, borderBottomColor: '#EEEAE3', flexDirection: 'row', alignItems: 'center', gap: 12 },
  appIdentity: { flex: 1, minWidth: 130 },
  appName: { color: colours.ink, fontSize: 12, fontWeight: '900' },
  appDevice: { color: colours.inkSoft, fontSize: 8, marginTop: 3 },
  appMeasure: { width: 120 },
  appDuration: { color: colours.ink, fontSize: 10, fontWeight: '900', textAlign: 'right' },
  appTrack: { height: 4, backgroundColor: colours.surfaceMuted, borderRadius: 2, marginTop: 6, overflow: 'hidden' },
  appFill: { height: 4, backgroundColor: colours.moss, borderRadius: 2 },
  ruleBadge: { color: colours.inkSoft, backgroundColor: colours.surfaceMuted, borderRadius: radius.pill, paddingHorizontal: 7, paddingVertical: 4, fontSize: 6, fontWeight: '900', overflow: 'hidden' },
  ruleBadgeUser: { color: colours.moss, backgroundColor: colours.mossSoft },
  emptyText: { color: colours.inkSoft, fontSize: 10, lineHeight: 16, paddingVertical: 16 },
  learningCard: { backgroundColor: colours.mossSoft, borderRadius: radius.large, padding: 20 },
  learningKicker: { color: colours.moss, fontSize: 8, fontWeight: '900', letterSpacing: 1.2 },
  learningTitle: { color: colours.ink, fontSize: 17, fontWeight: '900', marginTop: 8 },
  learningBody: { color: colours.inkSoft, fontSize: 10, lineHeight: 16, marginTop: 6 },
  insightCard: { backgroundColor: colours.surface, borderWidth: 1, borderColor: colours.line, borderRadius: radius.large, padding: 19, marginBottom: 9 },
  insightKicker: { color: colours.moss, fontSize: 8, fontWeight: '900', letterSpacing: 1.1 },
  insightTitle: { color: colours.ink, fontSize: 16, fontWeight: '900', lineHeight: 21, marginTop: 8 },
  insightBody: { color: colours.inkSoft, fontSize: 10, lineHeight: 16, marginTop: 6 },
  confidenceRow: { flexDirection: 'row', justifyContent: 'space-between', marginTop: 14 },
  confidenceText: { color: colours.inkSoft, fontSize: 8, fontWeight: '800' },
  evidenceAction: { color: colours.moss, fontSize: 8, fontWeight: '900' },
  evidenceBox: { backgroundColor: colours.surfaceMuted, borderRadius: radius.medium, padding: 12, marginTop: 12 },
  evidenceLabel: { color: colours.ink, fontSize: 9, fontWeight: '900' },
  evidenceDetail: { color: colours.inkSoft, fontSize: 9, lineHeight: 14, marginTop: 4 },
  evidenceCount: { color: colours.moss, fontSize: 7, fontWeight: '900', marginTop: 7 },
  unavailableCard: { backgroundColor: colours.surface, borderWidth: 1, borderColor: colours.line, borderRadius: radius.large, padding: 25, marginTop: 3 },
  unavailableKicker: { color: colours.coral, fontSize: 8, fontWeight: '900', letterSpacing: 1.2 },
  unavailableTitle: { color: colours.ink, fontSize: 21, lineHeight: 27, fontWeight: '900', marginTop: 10 },
  unavailableBody: { color: colours.inkSoft, fontSize: 11, lineHeight: 18, marginTop: 7, maxWidth: 620 },
});
