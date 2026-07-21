import { Modal, Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { EvidenceSource, TimelineEvent } from '../domain/types';
import { colours, radius } from '../theme';

const sourceIcon: Record<EvidenceSource, string> = {
  location: '⌖',
  motion: '↝',
  calendar: '□',
  desktop: '▱',
  phone: '▯',
  health: '♥',
};

interface Props {
  event: TimelineEvent | null;
  onClose: () => void;
  onConfirm: (eventId: string) => void;
  onCorrect: (eventId: string, title: string) => void;
}

export function EventDetailModal({ event, onClose, onConfirm, onCorrect }: Props) {
  if (!event) return null;
  const certainty = Math.round((event.confidence ?? 1) * 100);

  return (
    <Modal visible animationType="slide" transparent onRequestClose={onClose}>
      <View style={styles.backdrop}>
        <View style={styles.sheet}>
          <View style={styles.handle} />
          <ScrollView showsVerticalScrollIndicator={false} contentContainerStyle={styles.content}>
            <View style={styles.headerRow}>
              <View style={styles.headerCopy}>
                <Text style={styles.eyebrow}>{event.start}–{event.end} · {event.duration}</Text>
                <Text style={styles.title}>{event.title}</Text>
                {event.place ? <Text style={styles.place}>{event.place}</Text> : null}
              </View>
              <Pressable accessibilityRole="button" accessibilityLabel="Close details" onPress={onClose} style={styles.close}>
                <Text style={styles.closeText}>×</Text>
              </Pressable>
            </View>

            <View style={styles.confidenceCard}>
              <View style={styles.confidenceTop}>
                <Text style={styles.confidenceLabel}>ATIRA’s read</Text>
                <Text style={styles.confidenceValue}>{certainty}% confidence</Text>
              </View>
              <View style={styles.barTrack}>
                <View style={[styles.barFill, { width: `${certainty}%` }]} />
              </View>
              <Text style={styles.summary}>{event.summary}</Text>
            </View>

            <Text style={styles.sectionTitle}>Why ATIRA thinks this</Text>
            {event.evidence.map((item) => (
              <View key={item.id} style={styles.evidenceRow}>
                <View style={styles.sourceIcon}><Text style={styles.sourceIconText}>{sourceIcon[item.source]}</Text></View>
                <View style={styles.evidenceCopy}>
                  <Text style={styles.evidenceLabel}>{item.label}</Text>
                  <Text style={styles.evidenceDetail}>{item.detail}</Text>
                </View>
                <View style={[styles.strength, item.strength === 'strong' ? styles.strong : styles.supporting]}>
                  <Text style={styles.strengthText}>{item.strength}</Text>
                </View>
              </View>
            ))}

            <Text style={styles.sectionTitle}>Is that right?</Text>
            <Pressable
              accessibilityRole="button"
              onPress={() => onConfirm(event.id)}
              style={({ pressed }) => [styles.primaryButton, pressed && styles.pressed]}
            >
              <Text style={styles.primaryButtonText}>Yes, that’s right</Text>
            </Pressable>
            <View style={styles.alternatives}>
              {event.alternatives.map((alternative) => (
                <Pressable
                  key={alternative}
                  accessibilityRole="button"
                  onPress={() => onCorrect(event.id, alternative)}
                  style={({ pressed }) => [styles.alternativeButton, pressed && styles.pressed]}
                >
                  <Text style={styles.alternativeText}>{alternative}</Text>
                </Pressable>
              ))}
            </View>
            <Text style={styles.privacy}>Corrections improve your private model. They are not social posts and are never shared by default.</Text>
          </ScrollView>
        </View>
      </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  backdrop: { flex: 1, backgroundColor: 'rgba(13, 23, 20, 0.38)', justifyContent: 'flex-end' },
  sheet: { maxHeight: '91%', backgroundColor: colours.canvas, borderTopLeftRadius: 28, borderTopRightRadius: 28, overflow: 'hidden' },
  handle: { alignSelf: 'center', width: 44, height: 5, borderRadius: 3, backgroundColor: '#B6B0A7', marginTop: 10 },
  content: { padding: 22, paddingBottom: 38 },
  headerRow: { flexDirection: 'row', alignItems: 'flex-start' },
  headerCopy: { flex: 1 },
  eyebrow: { color: colours.moss, fontSize: 12, fontWeight: '800', textTransform: 'uppercase', letterSpacing: 0.9 },
  title: { color: colours.ink, fontSize: 29, lineHeight: 34, fontWeight: '900', letterSpacing: -0.8, marginTop: 7 },
  place: { color: colours.inkSoft, fontSize: 14, marginTop: 5 },
  close: { width: 38, height: 38, borderRadius: 19, backgroundColor: colours.surfaceMuted, alignItems: 'center', justifyContent: 'center', marginLeft: 12 },
  closeText: { color: colours.ink, fontSize: 26, lineHeight: 27 },
  confidenceCard: { backgroundColor: colours.surface, borderRadius: radius.large, padding: 18, marginTop: 22, borderWidth: 1, borderColor: colours.line },
  confidenceTop: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
  confidenceLabel: { color: colours.ink, fontSize: 14, fontWeight: '800' },
  confidenceValue: { color: colours.moss, fontSize: 12, fontWeight: '800' },
  barTrack: { height: 7, borderRadius: 4, backgroundColor: colours.mossSoft, marginTop: 13, overflow: 'hidden' },
  barFill: { height: '100%', backgroundColor: colours.moss, borderRadius: 4 },
  summary: { color: colours.inkSoft, fontSize: 14, lineHeight: 21, marginTop: 14 },
  sectionTitle: { color: colours.ink, fontSize: 17, fontWeight: '900', marginTop: 25, marginBottom: 11 },
  evidenceRow: { flexDirection: 'row', alignItems: 'center', backgroundColor: colours.surface, padding: 13, marginBottom: 8, borderRadius: radius.medium },
  sourceIcon: { width: 34, height: 34, backgroundColor: colours.mossSoft, borderRadius: 11, alignItems: 'center', justifyContent: 'center' },
  sourceIconText: { color: colours.moss, fontSize: 16, fontWeight: '900' },
  evidenceCopy: { flex: 1, marginLeft: 11 },
  evidenceLabel: { color: colours.ink, fontSize: 13, fontWeight: '800' },
  evidenceDetail: { color: colours.inkSoft, fontSize: 11, marginTop: 3 },
  strength: { borderRadius: radius.pill, paddingHorizontal: 8, paddingVertical: 4, marginLeft: 8 },
  strong: { backgroundColor: colours.mossSoft },
  supporting: { backgroundColor: colours.blueSoft },
  strengthText: { color: colours.inkSoft, fontSize: 9, fontWeight: '800', textTransform: 'uppercase' },
  primaryButton: { backgroundColor: colours.ink, borderRadius: radius.medium, minHeight: 52, justifyContent: 'center', alignItems: 'center' },
  primaryButtonText: { color: colours.white, fontSize: 15, fontWeight: '900' },
  alternatives: { flexDirection: 'row', flexWrap: 'wrap', gap: 8, marginTop: 10 },
  alternativeButton: { borderWidth: 1, borderColor: colours.line, backgroundColor: colours.surface, borderRadius: radius.pill, paddingHorizontal: 14, paddingVertical: 10 },
  alternativeText: { color: colours.ink, fontSize: 12, fontWeight: '700' },
  privacy: { color: colours.inkSoft, fontSize: 11, lineHeight: 17, textAlign: 'center', marginTop: 22, paddingHorizontal: 10 },
  pressed: { opacity: 0.72 },
});
