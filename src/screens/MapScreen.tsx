import { ScrollView, StyleSheet, Text, View } from 'react-native';
import { colours, radius, shadow } from '../theme';

const stops = [
  { time: '07:12', title: 'Home', detail: 'Morning routine', colour: '#6B6789' },
  { time: '08:38', title: 'Office', detail: '8h 57m · 3 work modes', colour: colours.moss },
  { time: '12:32', title: 'Mildreds', detail: '46m · likely lunch', colour: colours.coral },
  { time: '18:16', title: 'PureGym', detail: '1h 15m · moderate effort', colour: '#A45E42' },
  { time: '20:04', title: 'Home', detail: 'Evening', colour: '#6B6789' },
];

export function MapScreen() {
  return (
    <ScrollView showsVerticalScrollIndicator={false} contentContainerStyle={styles.content}>
      <Text style={styles.eyebrow}>MONDAY · 20 JULY</Text>
      <Text style={styles.title}>Your day, in places.</Text>
      <Text style={styles.subtitle}>Four meaningful places and 1h 39m in motion.</Text>

      <View style={styles.map}>
        <View style={[styles.road, styles.roadOne]} />
        <View style={[styles.road, styles.roadTwo]} />
        <View style={[styles.road, styles.roadThree]} />
        <Text style={[styles.mapLabel, { top: 35, left: 24 }]}>CAMDEN</Text>
        <Text style={[styles.mapLabel, { top: 178, right: 25 }]}>CITY</Text>
        <Text style={[styles.mapLabel, { bottom: 32, left: 108 }]}>SOUTHWARK</Text>
        <View style={[styles.route, styles.routeOne]} />
        <View style={[styles.route, styles.routeTwo]} />
        <View style={[styles.pin, { top: 56, left: 52 }]}><Text style={styles.pinText}>⌂</Text></View>
        <View style={[styles.pin, { top: 103, right: 78, backgroundColor: colours.moss }]}><Text style={styles.pinText}>▱</Text></View>
        <View style={[styles.smallPin, { top: 170, left: 126, backgroundColor: colours.coral }]} />
        <View style={[styles.pin, { bottom: 53, right: 48, backgroundColor: '#A45E42' }]}><Text style={styles.pinText}>⌁</Text></View>
        <View style={styles.mapBadge}><Text style={styles.mapBadgeText}>4 places · 16.3 km</Text></View>
      </View>

      <Text style={styles.sectionTitle}>Place timeline</Text>
      <View style={styles.placeCard}>
        {stops.map((stop, index) => (
          <View key={`${stop.time}-${stop.title}`} style={styles.stopRow}>
            <Text style={styles.stopTime}>{stop.time}</Text>
            <View style={styles.stopRail}>
              <View style={[styles.stopDot, { backgroundColor: stop.colour }]} />
              {index < stops.length - 1 ? <View style={styles.stopLine} /> : null}
            </View>
            <View style={[styles.stopCopy, index < stops.length - 1 && styles.stopCopyBorder]}>
              <Text style={styles.stopTitle}>{stop.title}</Text>
              <Text style={styles.stopDetail}>{stop.detail}</Text>
            </View>
          </View>
        ))}
      </View>

      <View style={styles.note}>
        <Text style={styles.noteIcon}>⌖</Text>
        <Text style={styles.noteText}>Precise coordinates become meaningful places on your device. The timeline shows the meaning, not a surveillance trail.</Text>
      </View>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  content: { paddingHorizontal: 18, paddingTop: 16, paddingBottom: 110 },
  eyebrow: { color: colours.moss, fontSize: 11, fontWeight: '900', letterSpacing: 1.1 },
  title: { color: colours.ink, fontSize: 29, lineHeight: 35, fontWeight: '900', letterSpacing: -0.9, marginTop: 5 },
  subtitle: { color: colours.inkSoft, fontSize: 13, marginTop: 5 },
  map: { height: 310, backgroundColor: '#DCE4DC', borderRadius: radius.large, marginTop: 20, overflow: 'hidden', ...shadow },
  road: { position: 'absolute', height: 13, width: 420, backgroundColor: '#EDF0E8', borderWidth: 1, borderColor: '#CDD5CC', transform: [{ rotate: '-22deg' }] },
  roadOne: { top: 75, left: -54 },
  roadTwo: { top: 205, left: -35, transform: [{ rotate: '18deg' }] },
  roadThree: { top: 145, left: -130, transform: [{ rotate: '72deg' }] },
  mapLabel: { position: 'absolute', color: '#9AA59F', fontSize: 10, fontWeight: '900', letterSpacing: 2 },
  route: { position: 'absolute', height: 5, borderRadius: 3, backgroundColor: colours.blue, transformOrigin: 'left center' },
  routeOne: { width: 195, top: 91, left: 71, transform: [{ rotate: '11deg' }] },
  routeTwo: { width: 155, top: 188, left: 157, transform: [{ rotate: '36deg' }] },
  pin: { position: 'absolute', width: 37, height: 37, borderRadius: 19, backgroundColor: '#6B6789', borderWidth: 4, borderColor: colours.white, alignItems: 'center', justifyContent: 'center', ...shadow },
  pinText: { color: colours.white, fontWeight: '900', fontSize: 13 },
  smallPin: { position: 'absolute', width: 17, height: 17, borderRadius: 9, borderWidth: 3, borderColor: colours.white },
  mapBadge: { position: 'absolute', bottom: 13, left: 13, backgroundColor: 'rgba(23, 34, 31, 0.9)', paddingHorizontal: 12, paddingVertical: 8, borderRadius: radius.pill },
  mapBadgeText: { color: colours.white, fontSize: 11, fontWeight: '800' },
  sectionTitle: { color: colours.ink, fontSize: 20, fontWeight: '900', letterSpacing: -0.5, marginTop: 27, marginBottom: 12 },
  placeCard: { backgroundColor: colours.surface, borderRadius: radius.large, padding: 17, borderWidth: 1, borderColor: colours.line },
  stopRow: { flexDirection: 'row', minHeight: 61 },
  stopTime: { color: colours.inkSoft, fontSize: 11, fontWeight: '700', width: 43, marginTop: 2 },
  stopRail: { width: 22, alignItems: 'center' },
  stopDot: { width: 11, height: 11, borderRadius: 6, borderWidth: 2, borderColor: colours.surface },
  stopLine: { width: 1, flex: 1, backgroundColor: colours.line },
  stopCopy: { flex: 1, paddingLeft: 8, paddingBottom: 15 },
  stopCopyBorder: { borderBottomWidth: 1, borderBottomColor: '#EEEAE3', marginBottom: 12 },
  stopTitle: { color: colours.ink, fontSize: 14, fontWeight: '800' },
  stopDetail: { color: colours.inkSoft, fontSize: 11, marginTop: 3 },
  note: { flexDirection: 'row', alignItems: 'center', marginTop: 15, padding: 15, borderRadius: radius.medium, backgroundColor: colours.mossSoft },
  noteIcon: { color: colours.moss, fontSize: 18, marginRight: 11 },
  noteText: { flex: 1, color: '#3E5E55', fontSize: 11, lineHeight: 17 },
});
