import { Pressable, StyleSheet, Text, View } from 'react-native';
import { EventCategory, TimelineEvent } from '../domain/types';
import { colours, radius, shadow } from '../theme';

const categoryStyle: Record<EventCategory, { icon: string; colour: string; soft: string }> = {
  sleep: { icon: '☀', colour: '#6B6789', soft: '#E8E4F1' },
  travel: { icon: '↗', colour: colours.blue, soft: colours.blueSoft },
  creation: { icon: '✦', colour: colours.moss, soft: colours.mossSoft },
  communication: { icon: '◌', colour: '#826447', soft: '#EEE2D5' },
  food: { icon: '◇', colour: colours.coral, soft: colours.coralSoft },
  exercise: { icon: '⌁', colour: '#A45E42', soft: '#F1DED4' },
  learning: { icon: 'A', colour: '#596FA5', soft: '#E0E6F4' },
  home: { icon: '⌂', colour: colours.moss, soft: colours.mossSoft },
  digital: { icon: 'D', colour: colours.blue, soft: colours.blueSoft },
  break: { icon: '—', colour: '#6B6789', soft: '#E8E4F1' },
};

const stateLabel = (event: TimelineEvent) => {
  if (event.state === 'confirmed') return 'Confirmed';
  if (event.state === 'corrected') return 'Corrected';
  if (event.state === 'manual') return 'Added by you';
  return `${Math.round((event.confidence ?? 0) * 100)}% sure`;
};

export function TimelineEventCard({ event, onPress }: { event: TimelineEvent; onPress: () => void }) {
  const category = categoryStyle[event.category];
  const needsCheck = event.state === 'inferred_medium';

  return (
    <View style={styles.row}>
      <View style={styles.timeColumn}>
        <Text style={styles.start}>{event.start}</Text>
        <View style={styles.rail} />
      </View>
      <Pressable
        accessibilityRole="button"
        accessibilityLabel={`${event.title}, ${event.duration}. Open details`}
        onPress={onPress}
        style={({ pressed }) => [styles.card, pressed && styles.pressed]}
      >
        <View style={styles.cardHeader}>
          <View style={[styles.icon, { backgroundColor: category.soft }]}>
            <Text style={[styles.iconText, { color: category.colour }]}>{category.icon}</Text>
          </View>
          <View style={styles.heading}>
            <Text style={styles.title}>{event.title}</Text>
            <Text style={styles.meta}>
              {event.duration}{event.place ? ` · ${event.place}` : ''}
            </Text>
          </View>
          <Text style={styles.chevron}>›</Text>
        </View>
        <Text numberOfLines={2} style={styles.summary}>{event.summary}</Text>
        <View style={styles.cardFooter}>
          <View style={[styles.status, needsCheck ? styles.statusAttention : styles.statusCalm]}>
            <View style={[styles.statusDot, { backgroundColor: needsCheck ? colours.amber : colours.moss }]} />
            <Text style={[styles.statusText, needsCheck && styles.statusTextAttention]}>{stateLabel(event)}</Text>
          </View>
          <Text style={styles.evidenceCount}>{event.evidence.length} signals</Text>
        </View>
      </Pressable>
    </View>
  );
}

const styles = StyleSheet.create({
  row: { flexDirection: 'row', alignItems: 'stretch' },
  timeColumn: { width: 55, alignItems: 'flex-start' },
  start: { color: colours.inkSoft, fontSize: 12, fontWeight: '700', marginTop: 18 },
  rail: { width: 1, flex: 1, backgroundColor: colours.line, marginLeft: 19, marginTop: 8 },
  card: {
    flex: 1,
    backgroundColor: colours.surface,
    borderRadius: radius.medium,
    borderWidth: 1,
    borderColor: '#E7E0D6',
    padding: 16,
    marginBottom: 12,
    ...shadow,
  },
  pressed: { opacity: 0.75, transform: [{ scale: 0.995 }] },
  cardHeader: { flexDirection: 'row', alignItems: 'center' },
  icon: { width: 38, height: 38, borderRadius: 12, alignItems: 'center', justifyContent: 'center' },
  iconText: { fontSize: 17, fontWeight: '800' },
  heading: { flex: 1, marginLeft: 12 },
  title: { color: colours.ink, fontSize: 16, fontWeight: '800', letterSpacing: -0.25 },
  meta: { color: colours.inkSoft, fontSize: 12, marginTop: 3 },
  chevron: { color: colours.inkSoft, fontSize: 27, lineHeight: 29, marginLeft: 8 },
  summary: { color: '#4E5A55', fontSize: 13, lineHeight: 19, marginTop: 13 },
  cardFooter: { marginTop: 14, flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  status: { flexDirection: 'row', alignItems: 'center', borderRadius: radius.pill, paddingHorizontal: 9, paddingVertical: 5 },
  statusCalm: { backgroundColor: colours.mossSoft },
  statusAttention: { backgroundColor: colours.amberSoft },
  statusDot: { width: 6, height: 6, borderRadius: 3, marginRight: 6 },
  statusText: { color: colours.moss, fontSize: 11, fontWeight: '800' },
  statusTextAttention: { color: '#8A641E' },
  evidenceCount: { color: colours.inkSoft, fontSize: 11, fontWeight: '600' },
});
