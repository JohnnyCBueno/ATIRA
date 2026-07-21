import { useState } from 'react';
import { Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { colours, radius, shadow } from '../theme';

type DomainId = 'overview' | 'body' | 'sleep' | 'work' | 'digital' | 'travel' | 'learning';
type RangeId = '7 days' | '30 days' | '3 months';

interface Domain {
  id: DomainId;
  label: string;
  icon: string;
  accent: string;
  title: string;
  narrative: string;
  metrics: { value: string; label: string; change: string }[];
  chartLabel: string;
  values: number[];
  sources: string[];
  insightTitle: string;
  insightBody: string;
  question: string;
}

const domains: Domain[] = [
  {
    id: 'overview', label: 'Overview', icon: '✦', accent: colours.moss,
    title: 'Your life, in balance.', narrative: 'Work became more deliberate while movement and recovery stayed steady.',
    metrics: [{ value: '76', label: 'Balance', change: '↑ 8' }, { value: '88%', label: 'Coverage', change: '↑ 3%' }, { value: '9', label: 'Patterns', change: '2 new' }],
    chartLabel: 'Daily balance', values: [62, 49, 78, 66, 72, 81, 69], sources: ['Location', 'Health', 'Desktop', 'Phone', 'Calendar'],
    insightTitle: 'Mornings remain your strongest window', insightBody: 'Focused creation was 31% higher before 11:00, especially after consistent sleep.', question: 'What helped my best days feel different?',
  },
  {
    id: 'body', label: 'Body & sport', icon: '⌁', accent: colours.coral,
    title: 'Movement found a rhythm.', narrative: 'Six active days combined structured workouts with gentler walking.',
    metrics: [{ value: '6', label: 'Active days', change: '↑ 2' }, { value: '4h 18m', label: 'Exercise', change: '↑ 46m' }, { value: '128', label: 'Peak bpm', change: 'steady' }],
    chartLabel: 'Meaningful movement', values: [48, 64, 36, 82, 73, 91, 58], sources: ['Health', 'Motion', 'Location', 'Gym stays'],
    insightTitle: 'Shorter sessions carried more intensity', insightBody: 'Gym visits were 12 minutes shorter on average, while time above your exercise baseline increased.', question: 'How does sleep affect my workout intensity?',
  },
  {
    id: 'sleep', label: 'Sleep', icon: '☾', accent: '#6B6789',
    title: 'Sleep became steadier.', narrative: 'Your wake time tightened even though total duration varied.',
    metrics: [{ value: '7h 18m', label: 'Average', change: '↑ 22m' }, { value: '42m', label: 'Wake variance', change: '↓ 18m' }, { value: '4', label: 'Rested days', change: '↑ 1' }],
    chartLabel: 'Sleep duration', values: [71, 83, 76, 62, 88, 79, 74], sources: ['Health', 'Phone pickup', 'Motion'],
    insightTitle: 'Consistency mattered more than length', insightBody: 'Your highest-focus mornings followed nights when sleep and first movement aligned closely.', question: 'What usually disrupts my sleep routine?',
  },
  {
    id: 'work', label: 'Work & focus', icon: '▱', accent: colours.moss,
    title: 'Creation moved earlier.', narrative: 'Morning work leaned toward making; afternoons leaned toward coordinating.',
    metrics: [{ value: '31h', label: 'Work observed', change: '↓ 2h' }, { value: '12h 4m', label: 'Creation', change: '↑ 18%' }, { value: '14h 2m', label: 'Communication', change: '↑ 7%' }],
    chartLabel: 'Focused creation', values: [68, 43, 91, 39, 74, 12, 18], sources: ['Desktop', 'Calendar', 'Office stays', 'Phone'],
    insightTitle: 'Meetings changed the shape of Thursday', insightBody: 'Communication occupied the morning, followed by two clusters of short social-phone activity.', question: 'Which environments produce my best focus?',
  },
  {
    id: 'digital', label: 'Digital life', icon: '▯', accent: colours.blue,
    title: 'Your devices served different roles.', narrative: 'Desktop time centred on work; phone activity clustered around transitions and recovery.',
    metrics: [{ value: '33h', label: 'Desktop', change: '↓ 4%' }, { value: '11h', label: 'Phone', change: '↑ 6%' }, { value: '4h 22m', label: 'Intentional', change: '↑ 21m' }],
    chartLabel: 'Phone activity', values: [52, 63, 41, 79, 58, 88, 72], sources: ['Phone usage', 'Desktop companion', 'Calendar'],
    insightTitle: 'Phone breaks often followed calls', insightBody: 'Short social sessions appeared after longer meetings, rather than during deep-work blocks.', question: 'Which apps support me and which drain me?',
  },
  {
    id: 'travel', label: 'Travel & places', icon: '⌖', accent: '#A45E42',
    title: 'Your week stayed local.', narrative: 'Work and home anchored the week, with more varied places over the weekend.',
    metrics: [{ value: '88 km', label: 'Travelled', change: '↓ 9 km' }, { value: '18', label: 'Places', change: '3 new' }, { value: '6h 14m', label: 'In motion', change: '↑ 32m' }],
    chartLabel: 'Time in motion', values: [48, 64, 36, 82, 73, 91, 58], sources: ['Location', 'Motion', 'Known places'],
    insightTitle: 'The weekend widened your radius', insightBody: 'Two new social places appeared, while weekday travel stayed highly predictable.', question: 'Where do I spend time that feels restorative?',
  },
  {
    id: 'learning', label: 'Learning', icon: 'A', accent: '#596FA5',
    title: 'Small sessions accumulated.', narrative: 'Language and reading activity appeared on five days without needing a formal streak.',
    metrics: [{ value: '2h 11m', label: 'Learning', change: '↑ 34m' }, { value: '5', label: 'Active days', change: '↑ 1' }, { value: '24m', label: 'Typical session', change: 'steady' }],
    chartLabel: 'Learning minutes', values: [12, 36, 28, 17, 42, 66, 47], sources: ['Phone activity', 'Places', 'Calendar'],
    insightTitle: 'Context changed what you learned', insightBody: 'Language practice happened at home; longer reading sessions happened away from screens.', question: 'When am I most likely to keep learning?',
  },
];

function MetricChart({ domain }: { domain: Domain }) {
  return (
    <View style={styles.chartCard}>
      <View style={styles.chartHeader}><Text style={styles.chartTitle}>{domain.chartLabel}</Text><Text style={[styles.chartAverage, { color: domain.accent }]}>weekly view</Text></View>
      <View style={styles.chartArea}>
        {domain.values.map((value, index) => (
          <View key={`${domain.id}-${index}`} style={styles.chartColumn}>
            <View style={styles.barTrack}><View style={[styles.barFill, { height: `${value}%`, backgroundColor: domain.accent }]} /></View>
            <Text style={styles.dayLabel}>{['M', 'T', 'W', 'T', 'F', 'S', 'S'][index]}</Text>
          </View>
        ))}
      </View>
    </View>
  );
}

export function PatternsScreen() {
  const [domainId, setDomainId] = useState<DomainId>('overview');
  const [range, setRange] = useState<RangeId>('7 days');
  const domain = domains.find((item) => item.id === domainId) ?? domains[0];

  return (
    <ScrollView showsVerticalScrollIndicator={false} contentInsetAdjustmentBehavior="automatic" contentContainerStyle={styles.content}>
      <Text style={styles.eyebrow}>PATTERNS</Text>
      <Text style={styles.title}>Understand one part,<Text style={{ color: domain.accent }}> or the whole.</Text></Text>
      <Text style={styles.subtitle}>Explore your data directly, then see what ATIRA noticed across it.</Text>

      <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.domainStrip}>
        {domains.map((item) => {
          const selected = item.id === domain.id;
          return (
            <Pressable
              key={item.id}
              accessibilityRole="button"
              accessibilityState={{ selected }}
              onPress={() => setDomainId(item.id)}
              style={[styles.domainChip, selected && { backgroundColor: item.accent, borderColor: item.accent }]}
            >
              <Text style={[styles.domainIcon, selected && styles.domainSelected]}>{item.icon}</Text>
              <Text style={[styles.domainLabel, selected && styles.domainSelected]}>{item.label}</Text>
            </Pressable>
          );
        })}
      </ScrollView>

      <View style={styles.rangePicker}>
        {(['7 days', '30 days', '3 months'] as RangeId[]).map((item) => (
          <Pressable
            key={item}
            accessibilityRole="button"
            accessibilityState={{ selected: item === range }}
            onPress={() => setRange(item)}
            style={[styles.rangeItem, item === range && styles.rangeSelected]}
          >
            <Text style={[styles.rangeText, item === range && styles.rangeTextSelected]}>{item}</Text>
          </Pressable>
        ))}
      </View>

      <View style={[styles.domainHero, { backgroundColor: domain.accent }]}>
        <Text style={styles.heroEyebrow}>{domain.label.toUpperCase()} · {range.toUpperCase()}</Text>
        <Text style={styles.heroTitle}>{domain.title}</Text>
        <Text style={styles.heroNarrative}>{domain.narrative}</Text>
      </View>

      <View style={styles.metricsRow}>
        {domain.metrics.map((metric) => (
          <View key={metric.label} style={styles.metricCard}>
            <Text style={styles.metricValue}>{metric.value}</Text>
            <Text style={styles.metricLabel}>{metric.label}</Text>
            <Text style={[styles.metricChange, { color: domain.accent }]}>{metric.change}</Text>
          </View>
        ))}
      </View>

      <View style={styles.sectionHeader}><Text style={styles.sectionTitle}>Explore your data</Text><Text style={styles.sectionAction}>Adjust ›</Text></View>
      <MetricChart domain={domain} />
      <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.sourceStrip}>
        <Text style={styles.sourcePrefix}>Built from</Text>
        {domain.sources.map((source) => <View key={source} style={styles.sourceChip}><View style={[styles.sourceDot, { backgroundColor: domain.accent }]} /><Text style={styles.sourceText}>{source}</Text></View>)}
      </ScrollView>

      <View style={styles.sectionHeader}><Text style={styles.sectionTitle}>What ATIRA noticed</Text><Text style={styles.sectionAction}>Why this? ›</Text></View>
      <View style={styles.insightCard}>
        <View style={[styles.insightIcon, { backgroundColor: `${domain.accent}20` }]}><Text style={[styles.insightIconText, { color: domain.accent }]}>{domain.icon}</Text></View>
        <Text style={styles.insightKicker}>CROSS-SOURCE INSIGHT</Text>
        <Text style={styles.insightTitle}>{domain.insightTitle}</Text>
        <Text style={styles.insightBody}>{domain.insightBody}</Text>
        <View style={styles.confidenceRow}><Text style={styles.confidenceText}>Confidence</Text><View style={styles.confidenceTrack}><View style={[styles.confidenceFill, { width: '84%', backgroundColor: domain.accent }]} /></View><Text style={styles.confidenceValue}>84%</Text></View>
      </View>

      <View style={styles.questionCard}>
        <Text style={styles.questionEyebrow}>ASK YOUR DATA</Text>
        <Text style={styles.question}>{domain.question}</Text>
        <View style={styles.askButton}><Text style={styles.askButtonText}>Explore this question →</Text></View>
      </View>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  content: { paddingHorizontal: 18, paddingTop: 16, paddingBottom: 112 },
  eyebrow: { color: colours.coral, fontSize: 10, fontWeight: '900', letterSpacing: 1.2 },
  title: { color: colours.ink, fontSize: 29, lineHeight: 35, fontWeight: '900', letterSpacing: -0.9, marginTop: 5 },
  subtitle: { color: colours.inkSoft, fontSize: 12, lineHeight: 18, marginTop: 6 },
  domainStrip: { gap: 7, paddingVertical: 16 },
  domainChip: { height: 39, borderRadius: radius.pill, paddingHorizontal: 13, flexDirection: 'row', alignItems: 'center', backgroundColor: colours.surface, borderWidth: 1, borderColor: colours.line },
  domainIcon: { color: colours.inkSoft, fontSize: 13, fontWeight: '900', marginRight: 6 },
  domainLabel: { color: colours.ink, fontSize: 10, fontWeight: '800' },
  domainSelected: { color: colours.white },
  rangePicker: { flexDirection: 'row', backgroundColor: colours.surfaceMuted, borderRadius: radius.medium, padding: 4, marginBottom: 13 },
  rangeItem: { flex: 1, minHeight: 34, alignItems: 'center', justifyContent: 'center', borderRadius: 11 },
  rangeSelected: { backgroundColor: colours.ink },
  rangeText: { color: colours.inkSoft, fontSize: 10, fontWeight: '800' },
  rangeTextSelected: { color: colours.white },
  domainHero: { borderRadius: radius.large, padding: 20, ...shadow },
  heroEyebrow: { color: 'rgba(255,255,255,0.72)', fontSize: 8, fontWeight: '900', letterSpacing: 1 },
  heroTitle: { color: colours.white, fontSize: 23, fontWeight: '900', letterSpacing: -0.5, marginTop: 8 },
  heroNarrative: { color: 'rgba(255,255,255,0.84)', fontSize: 11, lineHeight: 17, marginTop: 6 },
  metricsRow: { flexDirection: 'row', gap: 7, marginTop: 9 },
  metricCard: { flex: 1, backgroundColor: colours.surface, borderRadius: radius.medium, padding: 12, borderWidth: 1, borderColor: colours.line },
  metricValue: { color: colours.ink, fontSize: 16, fontWeight: '900', letterSpacing: -0.4 },
  metricLabel: { color: colours.inkSoft, fontSize: 8, marginTop: 4 },
  metricChange: { fontSize: 8, fontWeight: '900', marginTop: 8 },
  sectionHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginTop: 25, marginBottom: 11 },
  sectionTitle: { color: colours.ink, fontSize: 19, fontWeight: '900', letterSpacing: -0.45 },
  sectionAction: { color: colours.moss, fontSize: 9, fontWeight: '900' },
  chartCard: { height: 190, backgroundColor: colours.surface, borderRadius: radius.large, padding: 17, borderWidth: 1, borderColor: colours.line },
  chartHeader: { flexDirection: 'row', justifyContent: 'space-between' },
  chartTitle: { color: colours.ink, fontSize: 12, fontWeight: '900' },
  chartAverage: { fontSize: 9, fontWeight: '900' },
  chartArea: { flex: 1, flexDirection: 'row', alignItems: 'flex-end', marginTop: 14 },
  chartColumn: { flex: 1, alignItems: 'center' },
  barTrack: { height: 104, width: 18, backgroundColor: colours.surfaceMuted, borderRadius: 9, justifyContent: 'flex-end', overflow: 'hidden' },
  barFill: { width: '100%', borderRadius: 9 },
  dayLabel: { color: colours.inkSoft, fontSize: 9, fontWeight: '800', marginTop: 6 },
  sourceStrip: { alignItems: 'center', gap: 6, paddingTop: 9 },
  sourcePrefix: { color: colours.inkSoft, fontSize: 8, fontWeight: '800', marginRight: 2 },
  sourceChip: { flexDirection: 'row', alignItems: 'center', backgroundColor: colours.surfaceMuted, paddingHorizontal: 9, paddingVertical: 6, borderRadius: radius.pill },
  sourceDot: { width: 5, height: 5, borderRadius: 3, marginRight: 5 },
  sourceText: { color: colours.inkSoft, fontSize: 8, fontWeight: '700' },
  insightCard: { backgroundColor: colours.ink, borderRadius: radius.large, padding: 20 },
  insightIcon: { width: 42, height: 42, borderRadius: 14, alignItems: 'center', justifyContent: 'center' },
  insightIconText: { fontSize: 18, fontWeight: '900' },
  insightKicker: { color: '#91A09A', fontSize: 8, fontWeight: '900', letterSpacing: 1, marginTop: 16 },
  insightTitle: { color: colours.white, fontSize: 18, lineHeight: 23, fontWeight: '900', marginTop: 6 },
  insightBody: { color: '#B9C3BF', fontSize: 11, lineHeight: 18, marginTop: 7 },
  confidenceRow: { flexDirection: 'row', alignItems: 'center', marginTop: 16 },
  confidenceText: { color: '#91A09A', fontSize: 8, fontWeight: '800' },
  confidenceTrack: { flex: 1, height: 5, backgroundColor: '#35403D', borderRadius: 3, marginHorizontal: 9, overflow: 'hidden' },
  confidenceFill: { height: '100%', borderRadius: 3 },
  confidenceValue: { color: colours.white, fontSize: 8, fontWeight: '900' },
  questionCard: { backgroundColor: colours.amberSoft, borderRadius: radius.large, padding: 18, marginTop: 13, borderWidth: 1, borderColor: '#E8D7A9' },
  questionEyebrow: { color: '#8A641E', fontSize: 8, fontWeight: '900', letterSpacing: 1 },
  question: { color: colours.ink, fontSize: 16, lineHeight: 21, fontWeight: '900', marginTop: 7 },
  askButton: { alignSelf: 'flex-start', backgroundColor: colours.surface, borderRadius: radius.pill, paddingHorizontal: 12, paddingVertical: 8, marginTop: 13 },
  askButtonText: { color: colours.ink, fontSize: 9, fontWeight: '900' },
});
