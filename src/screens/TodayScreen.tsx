import { Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { TimelineEvent } from '../domain/types';
import { TimelineEventCard } from '../components/TimelineEventCard';
import { colours, radius } from '../theme';

interface Props {
  events: TimelineEvent[];
  onOpenEvent: (event: TimelineEvent) => void;
  onReviewLunch: () => void;
}

export function TodayScreen({ events, onOpenEvent, onReviewLunch }: Props) {
  const confirmed = events.filter((event) => ['confirmed', 'corrected'].includes(event.state)).length;

  return (
    <ScrollView
      showsVerticalScrollIndicator={false}
      contentInsetAdjustmentBehavior="automatic"
      contentContainerStyle={styles.content}
    >
      <View style={styles.header}>
        <View>
          <Text style={styles.eyebrow}>MONDAY · 20 JULY</Text>
          <Text style={styles.greeting}>Good evening, Alex.</Text>
        </View>
        <View style={styles.avatar}><Text style={styles.avatarText}>A</Text></View>
      </View>

      <View style={styles.hero}>
        <View style={styles.heroTop}>
          <View style={styles.coverageRing}>
            <Text style={styles.coverageNumber}>91</Text>
            <Text style={styles.coverageUnit}>%</Text>
          </View>
          <View style={styles.heroCopy}>
            <Text style={styles.heroTitle}>Your day is taking shape</Text>
            <Text style={styles.heroBody}>ATIRA understood 13h 21m from six connected signals.</Text>
          </View>
        </View>
        <View style={styles.heroDivider} />
        <View style={styles.heroStats}>
          <View style={styles.stat}><Text style={styles.statValue}>5h 42m</Text><Text style={styles.statLabel}>Work</Text></View>
          <View style={styles.stat}><Text style={styles.statValue}>1h 15m</Text><Text style={styles.statLabel}>Movement</Text></View>
          <View style={styles.stat}><Text style={styles.statValue}>22m</Text><Text style={styles.statLabel}>Learning</Text></View>
        </View>
      </View>

      <Pressable accessibilityRole="button" onPress={onReviewLunch} style={({ pressed }) => [styles.prompt, pressed && styles.pressed]}>
        <View style={styles.promptIcon}><Text style={styles.promptIconText}>?</Text></View>
        <View style={styles.promptCopy}>
          <Text style={styles.promptEyebrow}>ONE QUICK CHECK</Text>
          <Text style={styles.promptTitle}>Was 12:32 lunch?</Text>
        </View>
        <View style={styles.promptAction}><Text style={styles.promptActionText}>Review</Text></View>
      </Pressable>

      <View style={styles.sectionHeader}>
        <View>
          <Text style={styles.sectionTitle}>Your day</Text>
          <Text style={styles.sectionSubtitle}>{confirmed} moments confirmed · updates as signals arrive</Text>
        </View>
        <Text style={styles.live}>● LIVE</Text>
      </View>

      {events.map((event) => <TimelineEventCard key={event.id} event={event} onPress={() => onOpenEvent(event)} />)}
      <View style={styles.dayEnd}>
        <View style={styles.dayEndLine} />
        <Text style={styles.dayEndText}>Day still in progress</Text>
        <View style={styles.dayEndLine} />
      </View>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  content: { paddingHorizontal: 18, paddingTop: 16, paddingBottom: 110 },
  header: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 21 },
  eyebrow: { color: colours.moss, fontSize: 11, fontWeight: '900', letterSpacing: 1.1 },
  greeting: { color: colours.ink, fontSize: 27, lineHeight: 33, fontWeight: '900', letterSpacing: -0.8, marginTop: 5 },
  avatar: { width: 42, height: 42, borderRadius: 21, backgroundColor: colours.ink, alignItems: 'center', justifyContent: 'center' },
  avatarText: { color: colours.surface, fontSize: 16, fontWeight: '900' },
  hero: { backgroundColor: colours.ink, borderRadius: radius.large, padding: 20 },
  heroTop: { flexDirection: 'row', alignItems: 'center' },
  coverageRing: { width: 76, height: 76, borderRadius: 38, borderWidth: 7, borderColor: colours.coral, alignItems: 'center', justifyContent: 'center', flexDirection: 'row' },
  coverageNumber: { color: colours.white, fontSize: 24, fontWeight: '900', letterSpacing: -1 },
  coverageUnit: { color: '#B9C3BF', fontSize: 11, fontWeight: '800', marginTop: 7, marginLeft: 1 },
  heroCopy: { flex: 1, marginLeft: 17 },
  heroTitle: { color: colours.white, fontSize: 18, lineHeight: 22, fontWeight: '900', letterSpacing: -0.3 },
  heroBody: { color: '#B9C3BF', fontSize: 12, lineHeight: 18, marginTop: 6 },
  heroDivider: { height: 1, backgroundColor: '#35403D', marginVertical: 17 },
  heroStats: { flexDirection: 'row' },
  stat: { flex: 1 },
  statValue: { color: colours.white, fontSize: 14, fontWeight: '900' },
  statLabel: { color: '#91A09A', fontSize: 10, fontWeight: '700', marginTop: 3 },
  prompt: { backgroundColor: colours.amberSoft, borderRadius: radius.medium, padding: 13, flexDirection: 'row', alignItems: 'center', marginTop: 14, borderWidth: 1, borderColor: '#E8D7A9' },
  promptIcon: { width: 36, height: 36, borderRadius: 12, backgroundColor: colours.amber, alignItems: 'center', justifyContent: 'center' },
  promptIconText: { color: colours.white, fontWeight: '900', fontSize: 17 },
  promptCopy: { flex: 1, marginLeft: 11 },
  promptEyebrow: { color: '#8A641E', fontSize: 9, fontWeight: '900', letterSpacing: 0.8 },
  promptTitle: { color: colours.ink, fontSize: 14, fontWeight: '800', marginTop: 2 },
  promptAction: { paddingHorizontal: 12, paddingVertical: 8, borderRadius: radius.pill, backgroundColor: colours.surface },
  promptActionText: { color: colours.ink, fontSize: 11, fontWeight: '900' },
  sectionHeader: { flexDirection: 'row', alignItems: 'flex-end', justifyContent: 'space-between', marginTop: 26, marginBottom: 13 },
  sectionTitle: { color: colours.ink, fontSize: 21, fontWeight: '900', letterSpacing: -0.5 },
  sectionSubtitle: { color: colours.inkSoft, fontSize: 10, marginTop: 3 },
  live: { color: colours.moss, fontSize: 9, fontWeight: '900', letterSpacing: 0.7 },
  dayEnd: { flexDirection: 'row', alignItems: 'center', marginTop: 9 },
  dayEndLine: { flex: 1, height: 1, backgroundColor: colours.line },
  dayEndText: { color: colours.inkSoft, fontSize: 10, marginHorizontal: 10 },
  pressed: { opacity: 0.72 },
});
