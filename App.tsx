import { StatusBar } from 'expo-status-bar';
import { useMemo, useState } from 'react';
import { ActivityIndicator, Platform, Pressable, SafeAreaView, StyleSheet, Text, useWindowDimensions, View } from 'react-native';
import { EventDetailModal } from './src/components/EventDetailModal';
import { useTimelineStore } from './src/data/useTimelineStore';
import { AppProfile } from './src/domain/types';
import { profiles } from './src/fixtures/demoDay';
import { PatternsScreen } from './src/screens/PatternsScreen';
import { TimelineScreen } from './src/screens/TimelineScreen';
import { YouScreen } from './src/screens/YouScreen';
import { colours, radius, shadow } from './src/theme';

type TabId = 'timeline' | 'patterns' | 'you';

const tabs: { id: TabId; label: string; icon: string }[] = [
  { id: 'timeline', label: 'Timeline', icon: '◷' },
  { id: 'patterns', label: 'Patterns', icon: '✦' },
  { id: 'you', label: 'You', icon: '◉' },
];

export default function App() {
  const [activeTab, setActiveTab] = useState<TabId>('timeline');
  const [selectedDayId, setSelectedDayId] = useState(() => localDayId(new Date()));
  const [selectedEventId, setSelectedEventId] = useState<string | null>(null);
  const [profileId, setProfileId] = useState<AppProfile>('ios-global');
  const {
    days,
    collectorStatuses,
    diagnostics,
    loading,
    error,
    actionError,
    lastReconstruction,
    locationSegments,
    placeCandidateSets,
    knownPlaceClustering,
    observations,
    devices,
    digitalActivityRules,
    desktopControl,
    browserIntegration,
    desktopDeviceConnection,
    retry,
    updateEvent,
    captureLocation,
    enableBackgroundLocation,
    syncDesktopActivity,
    connectHuaweiHealth,
    connectHealthKit,
    runSyntheticReconstruction,
    updateDeviceLabel,
    upsertDigitalActivityRule,
    deleteDigitalActivityRule,
    setDesktopPaused,
    deleteDesktopHistory,
    requestBrowserPairingCode,
    disconnectBrowserIntegration,
    requestDesktopDevicePairingCode,
    pairDesktopMobile,
    disconnectDesktopMobile,
    confirmPlaceCandidate,
  } = useTimelineStore();
  const { width } = useWindowDimensions();
  const profile = profiles.find((item) => item.id === profileId) ?? profiles[1];
  const selectedDay = days.find((day) => day.id === selectedDayId) ?? days[days.length - 1] ?? null;
  const selectedEvent = days.flatMap((day) => day.events).find((event) => event.id === selectedEventId) ?? null;
  const selectedEventDay = selectedEvent ? days.find((day) => day.events.some((event) => event.id === selectedEvent.id)) : null;
  const realLocationSegmentIds = new Set(locationSegments.filter((segment) => segment.origin === 'real').map((segment) => segment.id));
  const realKnownPlaceCount = knownPlaceClustering.places.filter((place) => knownPlaceClustering.assignments.some((assignment) => assignment.placeId === place.id && realLocationSegmentIds.has(assignment.segmentId))).length;
  const isDesktop = Platform.OS === 'web' && width >= 900;
  const showDesktopRail = width >= 1280;
  const desktopCollector = collectorStatuses.find((status) => status.source === 'desktop');
  const healthCollector = collectorStatuses.find((status) => status.source === 'health');

  const currentScreen = useMemo(() => {
    if (!selectedDay) return null;
    if (activeTab === 'patterns') return <PatternsScreen observations={observations} devices={devices} rules={digitalActivityRules} />;
    if (activeTab === 'you') return (
      <YouScreen
        profile={profile}
        onChangeProfile={setProfileId}
        collectorStatuses={collectorStatuses}
        diagnostics={diagnostics}
        actionError={actionError}
        lastReconstruction={lastReconstruction}
        onCaptureLocation={captureLocation}
        onEnableBackgroundLocation={enableBackgroundLocation}
        onSyncDesktopActivity={syncDesktopActivity}
        onConnectHuaweiHealth={connectHuaweiHealth}
        onConnectHealthKit={connectHealthKit}
        onRunSyntheticReconstruction={runSyntheticReconstruction}
        knownPlaceCount={realKnownPlaceCount}
        devices={devices}
        observations={observations}
        digitalActivityRules={digitalActivityRules}
        onUpdateDeviceLabel={updateDeviceLabel}
        onUpsertDigitalActivityRule={upsertDigitalActivityRule}
        onDeleteDigitalActivityRule={deleteDigitalActivityRule}
        desktopControl={desktopControl}
        onSetDesktopPaused={setDesktopPaused}
        onDeleteDesktopHistory={deleteDesktopHistory}
        browserIntegration={browserIntegration}
        onRequestBrowserPairingCode={requestBrowserPairingCode}
        onDisconnectBrowser={disconnectBrowserIntegration}
        desktopDeviceConnection={desktopDeviceConnection}
        onRequestDesktopDevicePairingCode={requestDesktopDevicePairingCode}
        onPairDesktopMobile={pairDesktopMobile}
        onDisconnectDesktopMobile={disconnectDesktopMobile}
      />
    );
    return (
      <TimelineScreen
        days={days}
        selectedDay={selectedDay}
        locationSegments={locationSegments}
        placeCandidateSets={placeCandidateSets}
        observations={observations}
        knownPlaceClustering={knownPlaceClustering}
        onSelectDay={setSelectedDayId}
        onOpenEvent={(event) => setSelectedEventId(event.id)}
        onConfirmPlaceCandidate={confirmPlaceCandidate}
      />
    );
  }, [actionError, activeTab, browserIntegration, captureLocation, collectorStatuses, confirmPlaceCandidate, connectHealthKit, connectHuaweiHealth, days, deleteDesktopHistory, deleteDigitalActivityRule, desktopControl, desktopDeviceConnection, devices, diagnostics, digitalActivityRules, disconnectBrowserIntegration, disconnectDesktopMobile, enableBackgroundLocation, knownPlaceClustering, lastReconstruction, locationSegments, observations, pairDesktopMobile, placeCandidateSets, profile, requestBrowserPairingCode, requestDesktopDevicePairingCode, runSyntheticReconstruction, selectedDay, setDesktopPaused, syncDesktopActivity, updateDeviceLabel, upsertDigitalActivityRule]);

  if (loading) {
    return (
      <SafeAreaView style={styles.startup}>
        <StatusBar style="dark" />
        <View style={styles.startupMark}><Text style={styles.startupMarkText}>A</Text></View>
        <ActivityIndicator color={colours.moss} size="large" />
        <Text style={styles.startupTitle}>Opening your private timeline</Text>
        <Text style={styles.startupBody}>Preparing the local data store and collector states…</Text>
      </SafeAreaView>
    );
  }

  if (error || !selectedDay) {
    return (
      <SafeAreaView style={styles.startup}>
        <StatusBar style="dark" />
        <Text style={styles.startupTitle}>ATIRA couldn’t open its local timeline.</Text>
        <Text style={styles.startupBody}>{error ?? 'No reconstructed days are available.'}</Text>
        <Pressable accessibilityRole="button" onPress={() => void retry()} style={styles.retryButton}><Text style={styles.retryText}>Try again</Text></Pressable>
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView style={styles.root}>
      <StatusBar style="dark" />
      {isDesktop ? (
        <View style={[styles.appFrame, styles.desktopFrame]}>
          <View style={styles.desktopSidebar}>
            <View style={styles.desktopBrandRow}>
              <View style={styles.desktopBrandMark}><Text style={styles.desktopBrandMarkText}>A</Text></View>
              <View>
                <Text style={styles.desktopBrand}>ATIRA</Text>
                <Text style={styles.desktopBrandMeta}>PRIVATE LIFE OS</Text>
              </View>
            </View>
            <Text style={styles.desktopSidebarIntro}>Your days, signals and patterns—reconstructed quietly.</Text>
            <View style={styles.desktopNav}>
              <Text style={styles.desktopNavHeading}>WORKSPACE</Text>
              {tabs.map((tab) => {
                const selected = tab.id === activeTab;
                return (
                  <Pressable
                    key={tab.id}
                    accessibilityRole="tab"
                    accessibilityState={{ selected }}
                    onPress={() => setActiveTab(tab.id)}
                    style={({ pressed }) => [styles.desktopNavItem, selected && styles.desktopNavItemSelected, pressed && styles.navPressed]}
                  >
                    <Text style={[styles.desktopNavIcon, selected && styles.desktopNavIconSelected]}>{tab.icon}</Text>
                    <Text style={[styles.desktopNavLabel, selected && styles.desktopNavLabelSelected]}>{tab.label}</Text>
                    {selected && <View style={styles.desktopNavIndicator} />}
                  </Pressable>
                );
              })}
            </View>
            <View style={styles.desktopSidebarFooter}>
              <View style={styles.desktopStatusRow}>
                <View style={[styles.desktopStatusDot, desktopCollector?.state.startsWith('available') && styles.desktopStatusDotLive]} />
                <Text style={styles.desktopStatusText}>{desktopCollector?.state.startsWith('available') ? 'Desktop collector live' : 'Collector reconnecting'}</Text>
              </View>
              <Text style={styles.desktopPrivacy}>Local-first · window titles off</Text>
            </View>
          </View>
          <View style={styles.desktopWorkspace}>
            <View style={styles.desktopScreen}>{currentScreen}</View>
            {showDesktopRail && (
              <View style={styles.desktopRail}>
                <Text style={styles.desktopRailEyebrow}>LIVE SYSTEM</Text>
                <Text style={styles.desktopRailTitle}>Your signal coverage</Text>
                <View style={styles.desktopMetricCard}>
                  <Text style={styles.desktopMetricLabel}>OBSERVATIONS</Text>
                  <Text style={styles.desktopMetricValue}>{diagnostics?.observationCount ?? 0}</Text>
                  <Text style={styles.desktopMetricDetail}>Stored locally across {diagnostics?.dayCount ?? days.length} days</Text>
                </View>
                <View style={styles.desktopMetricGrid}>
                  <View style={styles.desktopSmallMetric}>
                    <Text style={styles.desktopSmallValue}>{selectedDay.events.length}</Text>
                    <Text style={styles.desktopSmallLabel}>moments today</Text>
                  </View>
                  <View style={styles.desktopSmallMetric}>
                    <Text style={styles.desktopSmallValue}>{knownPlaceClustering.places.length}</Text>
                    <Text style={styles.desktopSmallLabel}>known places</Text>
                  </View>
                </View>
                <View style={styles.desktopConnectorCard}>
                  <Text style={styles.desktopConnectorHeading}>CONNECTED LAYERS</Text>
                  <View style={styles.desktopConnectorRow}><Text style={styles.desktopConnectorName}>Windows activity</Text><Text style={styles.desktopConnectorState}>{desktopCollector?.state.startsWith('available') ? 'LIVE' : 'WAITING'}</Text></View>
                  <View style={styles.desktopConnectorRow}><Text style={styles.desktopConnectorName}>Huawei Health</Text><Text style={styles.desktopConnectorState}>{healthCollector?.state.startsWith('available') ? 'LIVE' : 'SET UP'}</Text></View>
                  <View style={styles.desktopConnectorRowLast}><Text style={styles.desktopConnectorName}>Phone location</Text><Text style={styles.desktopConnectorState}>ABSENT</Text></View>
                </View>
                <View style={styles.desktopPrivacyCard}>
                  <Text style={styles.desktopPrivacyIcon}>◎</Text>
                  <View style={styles.desktopPrivacyCopy}>
                    <Text style={styles.desktopPrivacyTitle}>Private by default</Text>
                    <Text style={styles.desktopPrivacyBody}>No screenshots, keystrokes, URLs or document contents.</Text>
                  </View>
                </View>
              </View>
            )}
          </View>
        </View>
      ) : (
        <View style={styles.appFrame}>
          <View style={styles.screen}>{currentScreen}</View>
          <View style={styles.navOuter}>
            <View style={styles.nav}>
            {tabs.map((tab) => {
              const selected = tab.id === activeTab;
              return (
                <Pressable
                  key={tab.id}
                  accessibilityRole="tab"
                  accessibilityState={{ selected }}
                  onPress={() => setActiveTab(tab.id)}
                  style={({ pressed }) => [styles.navItem, selected && styles.navItemSelected, pressed && styles.navPressed]}
                >
                  <Text style={[styles.navIcon, selected && styles.navIconSelected]}>{tab.icon}</Text>
                  <Text style={[styles.navLabel, selected && styles.navLabelSelected]}>{tab.label}</Text>
                </Pressable>
              );
            })}
            </View>
          </View>
        </View>
      )}
      <EventDetailModal
        event={selectedEvent}
        onClose={() => setSelectedEventId(null)}
        onConfirm={(eventId) => {
          if (!selectedEventDay) return;
          void updateEvent({ dayId: selectedEventDay.id, eventId, action: 'confirm' }).then(() => setSelectedEventId(null));
        }}
        onCorrect={(eventId, title) => {
          if (!selectedEventDay) return;
          void updateEvent({ dayId: selectedEventDay.id, eventId, action: 'relabel', correctedTitle: title }).then(() => setSelectedEventId(null));
        }}
      />
    </SafeAreaView>
  );
}

function localDayId(date: Date) {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, '0');
  const day = String(date.getDate()).padStart(2, '0');
  return `${year}-${month}-${day}`;
}

const styles = StyleSheet.create({
  startup: { flex: 1, backgroundColor: colours.canvas, alignItems: 'center', justifyContent: 'center', padding: 32 },
  startupMark: { width: 62, height: 62, borderRadius: 31, backgroundColor: colours.ink, alignItems: 'center', justifyContent: 'center', marginBottom: 22 },
  startupMarkText: { color: colours.white, fontSize: 23, fontWeight: '900' },
  startupTitle: { color: colours.ink, fontSize: 20, lineHeight: 26, fontWeight: '900', textAlign: 'center', marginTop: 18 },
  startupBody: { color: colours.inkSoft, fontSize: 12, lineHeight: 18, textAlign: 'center', marginTop: 7 },
  retryButton: { backgroundColor: colours.ink, borderRadius: radius.pill, paddingHorizontal: 18, paddingVertical: 12, marginTop: 18 },
  retryText: { color: colours.white, fontSize: 12, fontWeight: '900' },
  root: { flex: 1, backgroundColor: colours.canvas, paddingTop: Platform.OS === 'android' ? 26 : 0 },
  appFrame: { flex: 1, width: '100%', alignSelf: 'center', backgroundColor: colours.canvas },
  screen: { flex: 1 },
  navOuter: { position: 'absolute', bottom: Platform.OS === 'web' ? 14 : 8, left: 14, right: 14, alignItems: 'center' },
  nav: { width: '100%', maxWidth: 450, minHeight: 68, borderRadius: radius.large, padding: 6, flexDirection: 'row', backgroundColor: colours.surface, borderWidth: 1, borderColor: '#E0D9CE', ...shadow },
  navItem: { flex: 1, alignItems: 'center', justifyContent: 'center', borderRadius: 18 },
  navItemSelected: { backgroundColor: colours.ink },
  navIcon: { color: colours.inkSoft, fontSize: 19, lineHeight: 21, fontWeight: '900' },
  navIconSelected: { color: colours.white },
  navLabel: { color: colours.inkSoft, fontSize: 9, fontWeight: '800', marginTop: 3 },
  navLabelSelected: { color: colours.white },
  navPressed: { opacity: 0.7 },
  desktopFrame: { flexDirection: 'row', alignSelf: 'stretch' },
  desktopSidebar: { width: 244, backgroundColor: colours.ink, paddingHorizontal: 20, paddingTop: 26, paddingBottom: 22 },
  desktopBrandRow: { flexDirection: 'row', alignItems: 'center' },
  desktopBrandMark: { width: 38, height: 38, borderRadius: 13, alignItems: 'center', justifyContent: 'center', backgroundColor: colours.coral, marginRight: 11 },
  desktopBrandMarkText: { color: colours.white, fontSize: 16, fontWeight: '900' },
  desktopBrand: { color: colours.white, fontSize: 18, fontWeight: '900', letterSpacing: 1.2 },
  desktopBrandMeta: { color: '#91AAA2', fontSize: 8, fontWeight: '900', letterSpacing: 1.4, marginTop: 2 },
  desktopSidebarIntro: { color: '#AEBDB8', fontSize: 11, lineHeight: 17, marginTop: 24, maxWidth: 185 },
  desktopNav: { marginTop: 42 },
  desktopNavHeading: { color: '#6E837C', fontSize: 8, fontWeight: '900', letterSpacing: 1.6, marginBottom: 10, marginLeft: 10 },
  desktopNavItem: { minHeight: 48, borderRadius: 14, flexDirection: 'row', alignItems: 'center', paddingHorizontal: 12, marginBottom: 6 },
  desktopNavItemSelected: { backgroundColor: '#263632' },
  desktopNavIcon: { width: 29, color: '#8FA19B', fontSize: 17, fontWeight: '900' },
  desktopNavIconSelected: { color: colours.coral },
  desktopNavLabel: { color: '#AEBDB8', fontSize: 12, fontWeight: '800' },
  desktopNavLabelSelected: { color: colours.white },
  desktopNavIndicator: { marginLeft: 'auto', width: 6, height: 6, borderRadius: 3, backgroundColor: colours.coral },
  desktopSidebarFooter: { marginTop: 'auto', borderTopWidth: 1, borderTopColor: '#31413D', paddingTop: 17 },
  desktopStatusRow: { flexDirection: 'row', alignItems: 'center' },
  desktopStatusDot: { width: 7, height: 7, borderRadius: 4, backgroundColor: colours.amber, marginRight: 8 },
  desktopStatusDotLive: { backgroundColor: '#61C39B' },
  desktopStatusText: { color: '#D8E2DE', fontSize: 10, fontWeight: '800' },
  desktopPrivacy: { color: '#738A82', fontSize: 8, fontWeight: '700', marginTop: 7 },
  desktopWorkspace: { flex: 1, width: '100%', maxWidth: 1450, alignSelf: 'stretch', marginHorizontal: 'auto', flexDirection: 'row', gap: 22, paddingHorizontal: 24 },
  desktopScreen: { flex: 1, minWidth: 0, maxWidth: 940 },
  desktopRail: { width: 280, paddingTop: 24, paddingBottom: 24 },
  desktopRailEyebrow: { color: colours.moss, fontSize: 8, fontWeight: '900', letterSpacing: 1.5 },
  desktopRailTitle: { color: colours.ink, fontSize: 19, fontWeight: '900', letterSpacing: -0.4, marginTop: 5, marginBottom: 16 },
  desktopMetricCard: { backgroundColor: colours.ink, borderRadius: radius.large, padding: 18 },
  desktopMetricLabel: { color: '#83A69A', fontSize: 8, fontWeight: '900', letterSpacing: 1.2 },
  desktopMetricValue: { color: colours.white, fontSize: 36, lineHeight: 41, fontWeight: '900', marginTop: 7 },
  desktopMetricDetail: { color: '#AFC0BA', fontSize: 9, lineHeight: 14, marginTop: 3 },
  desktopMetricGrid: { flexDirection: 'row', gap: 8, marginTop: 8 },
  desktopSmallMetric: { flex: 1, backgroundColor: colours.surface, borderWidth: 1, borderColor: colours.line, borderRadius: radius.medium, padding: 13 },
  desktopSmallValue: { color: colours.ink, fontSize: 20, fontWeight: '900' },
  desktopSmallLabel: { color: colours.inkSoft, fontSize: 8, lineHeight: 12, marginTop: 3 },
  desktopConnectorCard: { backgroundColor: colours.surface, borderWidth: 1, borderColor: colours.line, borderRadius: radius.large, padding: 16, marginTop: 15 },
  desktopConnectorHeading: { color: colours.inkSoft, fontSize: 8, fontWeight: '900', letterSpacing: 1.2, marginBottom: 8 },
  desktopConnectorRow: { minHeight: 35, flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', borderBottomWidth: 1, borderBottomColor: '#EEEAE3' },
  desktopConnectorRowLast: { minHeight: 35, flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  desktopConnectorName: { color: colours.ink, fontSize: 10, fontWeight: '700' },
  desktopConnectorState: { color: colours.moss, fontSize: 8, fontWeight: '900', letterSpacing: 0.7 },
  desktopPrivacyCard: { flexDirection: 'row', backgroundColor: colours.mossSoft, borderRadius: radius.medium, padding: 14, marginTop: 15 },
  desktopPrivacyIcon: { color: colours.moss, fontSize: 20, width: 30, fontWeight: '900' },
  desktopPrivacyCopy: { flex: 1 },
  desktopPrivacyTitle: { color: colours.ink, fontSize: 10, fontWeight: '900' },
  desktopPrivacyBody: { color: colours.inkSoft, fontSize: 8, lineHeight: 13, marginTop: 3 },
});
