import { useState } from 'react';
import { Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { CollectorStatus, RepositoryDiagnostics } from '../data/contracts';
import { AppProfile, AppProfileDefinition, CapabilityItem } from '../domain/types';
import { profiles } from '../fixtures/demoDay';
import { LocationReconstructionResult } from '../reconstruction/locationEngine';
import { colours, radius } from '../theme';

const capabilityIcon: Record<string, string> = { location: '⌖', phone: '▯', health: '♥', desktop: '▱' };
const statusStyle: Record<CapabilityItem['status'], { label: string; colour: string; soft: string }> = {
  full: { label: 'FULL', colour: colours.moss, soft: colours.mossSoft },
  connected: { label: 'ON', colour: colours.moss, soft: colours.mossSoft },
  limited: { label: 'LIMITED', colour: '#8A641E', soft: colours.amberSoft },
  unavailable: { label: 'OFF', colour: colours.inkSoft, soft: colours.surfaceMuted },
};

interface Props {
  profile: AppProfileDefinition;
  onChangeProfile: (profile: AppProfile) => void;
  collectorStatuses: CollectorStatus[];
  diagnostics: RepositoryDiagnostics | null;
  actionError: string | null;
  lastReconstruction: LocationReconstructionResult | null;
  knownPlaceCount: number;
  onCaptureLocation: () => Promise<void>;
  onEnableBackgroundLocation: () => Promise<void>;
  onSyncDesktopActivity: () => Promise<void>;
  onConnectHuaweiHealth: () => Promise<void>;
  onRunSyntheticReconstruction: () => Promise<LocationReconstructionResult>;
}

const collectorLabels: Record<CollectorStatus['source'], string> = {
  location: 'Location', motion: 'Motion', calendar: 'Calendar', desktop: 'Desktop', phone: 'Phone activity', health: 'Health',
};

export function YouScreen({ profile, onChangeProfile, collectorStatuses, diagnostics, actionError, lastReconstruction, knownPlaceCount, onCaptureLocation, onEnableBackgroundLocation, onSyncDesktopActivity, onConnectHuaweiHealth, onRunSyntheticReconstruction }: Props) {
  const [privateMode, setPrivateMode] = useState(false);
  const [localProcessing, setLocalProcessing] = useState(true);
  const [quickChecks, setQuickChecks] = useState(true);
  const [locationBusy, setLocationBusy] = useState<'sample' | 'background' | null>(null);
  const [engineBusy, setEngineBusy] = useState(false);
  const [desktopBusy, setDesktopBusy] = useState(false);
  const [huaweiBusy, setHuaweiBusy] = useState(false);
  const locationStatus = collectorStatuses.find((item) => item.source === 'location');
  const desktopStatus = collectorStatuses.find((item) => item.source === 'desktop');
  const healthStatus = collectorStatuses.find((item) => item.source === 'health');

  const runLocationAction = async (kind: 'sample' | 'background') => {
    setLocationBusy(kind);
    try {
      if (kind === 'sample') await onCaptureLocation();
      else await onEnableBackgroundLocation();
    } catch {
      // The repository hook exposes the user-facing failure through actionError.
    } finally {
      setLocationBusy(null);
    }
  };

  const runEngineDemo = async () => {
    setEngineBusy(true);
    try {
      await onRunSyntheticReconstruction();
    } catch {
      // The repository hook exposes the user-facing failure through actionError.
    } finally {
      setEngineBusy(false);
    }
  };

  const syncDesktop = async () => {
    setDesktopBusy(true);
    try {
      await onSyncDesktopActivity();
    } catch {
      // The repository hook exposes the user-facing failure through actionError.
    } finally {
      setDesktopBusy(false);
    }
  };

  const connectHuawei = async () => {
    setHuaweiBusy(true);
    try {
      await onConnectHuaweiHealth();
    } catch {
      // The repository hook exposes the user-facing failure through actionError.
    } finally {
      setHuaweiBusy(false);
    }
  };

  return (
    <ScrollView showsVerticalScrollIndicator={false} contentContainerStyle={styles.content}>
      <Text style={styles.eyebrow}>YOUR ATIRA</Text>
      <Text style={styles.title}>You own the picture.</Text>
      <Text style={styles.subtitle}>See what contributes, what it can reveal, and what stays limited.</Text>

      <View style={styles.profileCard}>
        <View style={styles.profileHeader}>
          <View style={styles.profileIcon}><Text style={styles.profileIconText}>A</Text></View>
          <View style={styles.profileCopy}><Text style={styles.profileName}>Alex’s private model</Text><Text style={styles.profileDetail}>Local schema v{diagnostics?.schemaVersion ?? 1} · {diagnostics?.deviceCount ?? 0} registered device{diagnostics?.deviceCount === 1 ? '' : 's'} · {diagnostics?.correctionCount ?? 0} saved corrections</Text></View>
        </View>
        <View style={styles.memoryRow}>
          <View style={styles.memoryStat}><Text style={styles.memoryValue}>{knownPlaceCount}</Text><Text style={styles.memoryLabel}>known places</Text></View>
          <View style={styles.memoryDivider} />
          <View style={styles.memoryStat}><Text style={styles.memoryValue}>0</Text><Text style={styles.memoryLabel}>learned routines</Text></View>
          <View style={styles.memoryDivider} />
          <View style={styles.memoryStat}><Text style={styles.memoryValue}>6</Text><Text style={styles.memoryLabel}>data sources</Text></View>
        </View>
      </View>

      <View style={styles.sectionHeader}>
        <Text style={styles.sectionTitle}>Local data foundation</Text>
        <View style={styles.liveBadge}><Text style={styles.liveBadgeText}>{diagnostics?.adapter === 'sqlite' ? 'ENCRYPTED SQLITE' : 'WEB DEV STORE'}</Text></View>
      </View>
      <View style={styles.healthGrid}>
        <View style={styles.healthCard}><Text style={styles.healthIcon}>▤</Text><Text style={styles.healthValue}>{diagnostics?.dayCount ?? 0}</Text><Text style={styles.healthLabel}>Persisted days</Text></View>
        <View style={styles.healthCard}><Text style={styles.healthIcon}>⌖</Text><Text style={styles.healthValue}>{diagnostics?.observationCount ?? 0}</Text><Text style={styles.healthLabel}>Raw observations</Text></View>
        <View style={styles.healthCard}><Text style={styles.healthIcon}>✓</Text><Text style={styles.healthValue}>{diagnostics?.correctionCount ?? 0}</Text><Text style={styles.healthLabel}>Saved corrections</Text></View>
      </View>

      <View style={styles.collectorCard}>
        <View style={styles.collectorHeader}>
          <View style={styles.collectorIcon}><Text style={styles.collectorIconText}>⌖</Text></View>
          <View style={styles.collectorCopy}><Text style={styles.collectorTitle}>First real collector: location</Text><Text style={styles.collectorDetail}>{locationStatus?.detail ?? 'Evaluating location capability…'}</Text></View>
        </View>
        <View style={styles.collectorActions}>
          <Pressable
            accessibilityRole="button"
            disabled={locationBusy !== null}
            onPress={() => void runLocationAction('sample')}
            style={[styles.collectorPrimary, locationBusy !== null && styles.disabled]}
          >
            <Text style={styles.collectorPrimaryText}>{locationBusy === 'sample' ? 'Capturing…' : 'Capture one sample'}</Text>
          </Pressable>
          <Pressable
            accessibilityRole="button"
            disabled={locationBusy !== null}
            onPress={() => void runLocationAction('background')}
            style={[styles.collectorSecondary, locationBusy !== null && styles.disabled]}
          >
            <Text style={styles.collectorSecondaryText}>{locationBusy === 'background' ? 'Starting…' : 'Enable background'}</Text>
          </Pressable>
        </View>
        <Text style={styles.collectorPrivacy}>Permission is requested only after a button press. Coordinates remain in the local repository.</Text>
        {actionError && !actionError.startsWith('Desktop companion') && !actionError.startsWith('HUAWEI Health') ? <Text style={styles.actionError}>{actionError}</Text> : null}
      </View>

      <View style={styles.desktopCard}>
        <View style={styles.desktopHeader}>
          <View><Text style={styles.desktopEyebrow}>WINDOWS COMPANION</Text><Text style={styles.desktopTitle}>Real desktop activity</Text></View>
          <View style={[styles.desktopState, desktopStatus?.state === 'available_full' && styles.desktopStateOn]}><Text style={styles.desktopStateText}>{desktopStatus?.state === 'available_full' ? 'SYNCED' : desktopStatus?.state === 'available_limited' ? 'RUNNING' : 'OFFLINE'}</Text></View>
        </View>
        <Text style={styles.desktopDetail}>{desktopStatus?.detail ?? 'Checking the local companion…'}</Text>
        <View style={styles.desktopPrivacyRow}><Text style={styles.desktopPrivacyItem}>No screenshots</Text><Text style={styles.desktopPrivacyItem}>No keystrokes</Text><Text style={styles.desktopPrivacyItem}>Titles off</Text></View>
        <Pressable accessibilityRole="button" disabled={desktopBusy} onPress={() => void syncDesktop()} style={[styles.desktopButton, desktopBusy && styles.disabled]}>
          <Text style={styles.desktopButtonText}>{desktopBusy ? 'Syncing…' : 'Sync desktop sessions'}</Text>
        </Pressable>
        <Text style={styles.desktopCommand}>Start in PowerShell: npm run desktop:collector</Text>
        {actionError?.startsWith('Desktop companion') ? <Text style={styles.desktopError}>{actionError}</Text> : null}
      </View>

      <View style={styles.huaweiCard}>
        <View style={styles.desktopHeader}>
          <View><Text style={styles.huaweiEyebrow}>HUAWEI HEALTH</Text><Text style={styles.desktopTitle}>Wearable health bridge</Text></View>
          <View style={[styles.desktopState, healthStatus?.state === 'available_full' && styles.desktopStateOn]}><Text style={styles.desktopStateText}>{healthStatus?.state === 'available_full' ? 'SYNCED' : healthStatus?.state === 'available_limited' ? 'CONNECTED' : 'SETUP'}</Text></View>
        </View>
        <Text style={styles.desktopDetail}>{healthStatus?.detail ?? 'Checking HUAWEI Health connector setup…'}</Text>
        <View style={styles.desktopPrivacyRow}><Text style={styles.huaweiDataItem}>Sleep</Text><Text style={styles.huaweiDataItem}>Heart rate</Text><Text style={styles.huaweiDataItem}>Steps</Text><Text style={styles.huaweiDataItem}>Workouts</Text></View>
        <Pressable accessibilityRole="button" disabled={huaweiBusy} onPress={() => void connectHuawei()} style={[styles.huaweiButton, huaweiBusy && styles.disabled]}>
          <Text style={styles.desktopButtonText}>{huaweiBusy ? 'Opening…' : healthStatus?.state === 'available_full' || healthStatus?.state === 'available_limited' ? 'Sync HUAWEI Health' : 'Connect HUAWEI Health'}</Text>
        </Pressable>
        <Text style={styles.desktopCommand}>Workout routes are a separate optional permission—not continuous phone location.</Text>
        {actionError?.startsWith('HUAWEI Health') ? <Text style={styles.huaweiError}>{actionError}</Text> : null}
      </View>

      <View style={styles.statusList}>
        {collectorStatuses.filter((item) => !['location', 'desktop', 'health'].includes(item.source)).map((item) => (
          <View key={item.source} style={styles.statusRow}>
            <Text style={styles.statusSource}>{collectorLabels[item.source]}</Text>
            <Text style={styles.statusState}>{item.state.replaceAll('_', ' ')}</Text>
          </View>
        ))}
      </View>

      <View style={styles.engineCard}>
        <View style={styles.engineTopRow}>
          <View><Text style={styles.engineEyebrow}>RECONSTRUCTION ENGINE</Text><Text style={styles.engineTitle}>From points to a day</Text></View>
          <View style={styles.engineBadge}><Text style={styles.engineBadgeText}>TEST TRACE</Text></View>
        </View>
        <Text style={styles.engineBody}>Run four fictional days through the same cleaning, stay, journey, gap, distance, travel-mode, and repeat-place pipeline intended for real observations.</Text>
        {lastReconstruction ? (
          <View style={styles.engineResults}>
            <View style={styles.engineMetric}><Text style={styles.engineMetricValue}>{lastReconstruction.acceptedSamples}</Text><Text style={styles.engineMetricLabel}>clean points</Text></View>
            <View style={styles.engineMetric}><Text style={styles.engineMetricValue}>{lastReconstruction.segments.filter((item) => item.kind === 'stay').length}</Text><Text style={styles.engineMetricLabel}>stays</Text></View>
            <View style={styles.engineMetric}><Text style={styles.engineMetricValue}>{lastReconstruction.segments.filter((item) => item.kind === 'journey').length}</Text><Text style={styles.engineMetricLabel}>journeys</Text></View>
            <View style={styles.engineMetric}><Text style={styles.engineMetricValue}>{lastReconstruction.coveragePercent}%</Text><Text style={styles.engineMetricLabel}>coverage</Text></View>
          </View>
        ) : (
          <Text style={styles.enginePersisted}>{diagnostics?.segmentCount ?? 0} reconstructed segments currently persisted.</Text>
        )}
        <Pressable accessibilityRole="button" disabled={engineBusy} onPress={() => void runEngineDemo()} style={[styles.engineButton, engineBusy && styles.disabled]}>
          <Text style={styles.engineButtonText}>{engineBusy ? 'Reconstructing…' : 'Run four-day test trace'}</Text>
        </Pressable>
        <Text style={styles.engineNote}>Every test point is synthetic and marked as mocked. It contains no location from this device.</Text>
      </View>

      <View style={styles.sectionHeader}>
        <Text style={styles.sectionTitle}>Capability preview</Text>
        <Text style={styles.demoBadge}>PROTOTYPE</Text>
      </View>
      <Text style={styles.helper}>Switch regions to see how one product adapts without pretending every platform grants the same access.</Text>
      <View style={styles.segmented}>
        {profiles.map((item) => (
          <Pressable
            accessibilityRole="button"
            accessibilityState={{ selected: item.id === profile.id }}
            key={item.id}
            onPress={() => onChangeProfile(item.id)}
            style={[styles.segment, item.id === profile.id && styles.segmentSelected]}
          >
            <Text style={[styles.segmentText, item.id === profile.id && styles.segmentTextSelected]}>{item.shortLabel}</Text>
          </Pressable>
        ))}
      </View>

      <View style={styles.capabilityIntro}>
        <Text style={styles.capabilityTitle}>{profile.title}</Text>
        <Text style={styles.capabilityDescription}>{profile.description}</Text>
      </View>

      {profile.capabilities.map((capability) => {
        const status = statusStyle[capability.status];
        return (
          <View key={capability.id} style={styles.capabilityRow}>
            <View style={styles.capabilityIcon}><Text style={styles.capabilityIconText}>{capabilityIcon[capability.id]}</Text></View>
            <View style={styles.capabilityCopy}>
              <Text style={styles.capabilityLabel}>{capability.label}</Text>
              <Text style={styles.capabilityDetail}>{capability.detail}</Text>
            </View>
            <View style={[styles.status, { backgroundColor: status.soft }]}><Text style={[styles.statusText, { color: status.colour }]}>{status.label}</Text></View>
          </View>
        );
      })}

      <View style={styles.sectionHeader}>
        <Text style={styles.sectionTitle}>Privacy by default</Text>
        <Text style={styles.demoBadge}>CONTROL PREVIEW</Text>
      </View>
      <Text style={styles.helper}>These broader controls are still interface previews; location permission and repository persistence above are now functional.</Text>
      <View style={styles.settingsCard}>
        <SettingToggle
          title="Private mode"
          detail="Pause observation until you turn it back on"
          value={privateMode}
          onPress={() => setPrivateMode((value) => !value)}
        />
        <SettingToggle
          title="Process raw signals locally"
          detail="Keep coordinates and activity intervals on this device"
          value={localProcessing}
          onPress={() => setLocalProcessing((value) => !value)}
        />
        <SettingToggle
          title="Quick confirmation prompts"
          detail="Ask only when an answer improves the record"
          value={quickChecks}
          onPress={() => setQuickChecks((value) => !value)}
          last
        />
      </View>

      <View style={styles.controlCard}>
        <View style={styles.controlHeading}><Text style={styles.controlIcon}>◉</Text><Text style={styles.controlTitle}>Your controls</Text></View>
        <View style={styles.controlRow}><Text style={styles.controlLabel}>Pause collection</Text><Text style={styles.controlAction}>Open ›</Text></View>
        <View style={styles.controlRow}><Text style={styles.controlLabel}>Review private memory</Text><Text style={styles.controlAction}>Open ›</Text></View>
        <View style={styles.controlRow}><Text style={styles.controlLabel}>Export or delete data</Text><Text style={styles.controlAction}>Open ›</Text></View>
      </View>
      <Text style={styles.footer}>ATIRA is designed to explain its conclusions, invite correction, and degrade honestly when a signal is unavailable.</Text>
    </ScrollView>
  );
}

function SettingToggle({ title, detail, value, onPress, last = false }: { title: string; detail: string; value: boolean; onPress: () => void; last?: boolean }) {
  return (
    <Pressable accessibilityRole="switch" accessibilityState={{ checked: value }} aria-checked={value} onPress={onPress} style={[styles.settingRow, last && styles.settingRowLast]}>
      <View style={styles.settingCopy}><Text style={styles.settingTitle}>{title}</Text><Text style={styles.settingDetail}>{detail}</Text></View>
      <View style={[styles.toggle, value && styles.toggleOn]}><View style={[styles.toggleKnob, value && styles.toggleKnobOn]} /></View>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  content: { paddingHorizontal: 18, paddingTop: 16, paddingBottom: 110 },
  eyebrow: { color: colours.moss, fontSize: 11, fontWeight: '900', letterSpacing: 1.1 },
  title: { color: colours.ink, fontSize: 30, lineHeight: 36, fontWeight: '900', letterSpacing: -1, marginTop: 6 },
  subtitle: { color: colours.inkSoft, fontSize: 13, lineHeight: 19, marginTop: 6 },
  profileCard: { backgroundColor: colours.ink, borderRadius: radius.large, padding: 19, marginTop: 21 },
  profileHeader: { flexDirection: 'row', alignItems: 'center' },
  profileIcon: { width: 48, height: 48, borderRadius: 24, backgroundColor: colours.coral, alignItems: 'center', justifyContent: 'center' },
  profileIconText: { color: colours.white, fontWeight: '900', fontSize: 18 },
  profileCopy: { marginLeft: 13 },
  profileName: { color: colours.white, fontSize: 16, fontWeight: '900' },
  profileDetail: { color: '#91A09A', fontSize: 10, marginTop: 4 },
  memoryRow: { flexDirection: 'row', alignItems: 'center', marginTop: 20, paddingTop: 17, borderTopWidth: 1, borderTopColor: '#35403D' },
  memoryStat: { flex: 1, alignItems: 'center' },
  memoryValue: { color: colours.white, fontSize: 18, fontWeight: '900' },
  memoryLabel: { color: '#91A09A', fontSize: 8, marginTop: 3 },
  memoryDivider: { width: 1, height: 28, backgroundColor: '#35403D' },
  sectionHeader: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginTop: 27 },
  sectionTitle: { color: colours.ink, fontSize: 20, fontWeight: '900', letterSpacing: -0.5 },
  demoBadge: { color: colours.coral, fontSize: 9, fontWeight: '900', letterSpacing: 0.7 },
  liveBadge: { backgroundColor: colours.mossSoft, borderRadius: radius.pill, paddingHorizontal: 9, paddingVertical: 5 },
  liveBadgeText: { color: colours.moss, fontSize: 8, fontWeight: '900', letterSpacing: 0.5 },
  healthGrid: { flexDirection: 'row', gap: 7, marginTop: 12 },
  healthCard: { flex: 1, minHeight: 105, backgroundColor: colours.surface, borderRadius: radius.medium, padding: 12, borderWidth: 1, borderColor: colours.line },
  healthIcon: { color: colours.moss, fontSize: 15, fontWeight: '900' },
  healthValue: { color: colours.ink, fontSize: 14, fontWeight: '900', marginTop: 13 },
  healthLabel: { color: colours.inkSoft, fontSize: 8, lineHeight: 12, marginTop: 4 },
  collectorCard: { backgroundColor: colours.ink, borderRadius: radius.large, padding: 17, marginTop: 10 },
  collectorHeader: { flexDirection: 'row', alignItems: 'center' },
  collectorIcon: { width: 40, height: 40, borderRadius: 13, backgroundColor: '#29473F', alignItems: 'center', justifyContent: 'center' },
  collectorIconText: { color: '#9ED5C2', fontSize: 18, fontWeight: '900' },
  collectorCopy: { flex: 1, marginLeft: 12 },
  collectorTitle: { color: colours.white, fontSize: 13, fontWeight: '900' },
  collectorDetail: { color: '#AAB8B3', fontSize: 9, lineHeight: 14, marginTop: 4 },
  collectorActions: { flexDirection: 'row', gap: 7, marginTop: 15 },
  collectorPrimary: { flex: 1, minHeight: 41, borderRadius: 13, backgroundColor: colours.coral, alignItems: 'center', justifyContent: 'center' },
  collectorPrimaryText: { color: colours.white, fontSize: 9, fontWeight: '900' },
  collectorSecondary: { flex: 1, minHeight: 41, borderRadius: 13, borderWidth: 1, borderColor: '#53625D', alignItems: 'center', justifyContent: 'center' },
  collectorSecondaryText: { color: colours.white, fontSize: 9, fontWeight: '900' },
  disabled: { opacity: 0.48 },
  collectorPrivacy: { color: '#7F8D88', fontSize: 8, lineHeight: 13, marginTop: 11 },
  actionError: { color: '#FFB9A8', fontSize: 9, lineHeight: 14, marginTop: 8 },
  desktopCard: { backgroundColor: colours.surface, borderRadius: radius.large, padding: 17, marginTop: 10, borderWidth: 1, borderColor: colours.line },
  desktopHeader: { flexDirection: 'row', alignItems: 'flex-start', justifyContent: 'space-between' },
  desktopEyebrow: { color: colours.blue, fontSize: 8, fontWeight: '900', letterSpacing: 0.8 },
  desktopTitle: { color: colours.ink, fontSize: 15, fontWeight: '900', marginTop: 4 },
  desktopState: { backgroundColor: colours.surfaceMuted, borderRadius: radius.pill, paddingHorizontal: 8, paddingVertical: 5 },
  desktopStateOn: { backgroundColor: colours.mossSoft },
  desktopStateText: { color: colours.inkSoft, fontSize: 7, fontWeight: '900', letterSpacing: 0.5 },
  desktopDetail: { color: colours.inkSoft, fontSize: 9, lineHeight: 14, marginTop: 10 },
  desktopPrivacyRow: { flexDirection: 'row', gap: 6, marginTop: 11 },
  desktopPrivacyItem: { color: colours.moss, fontSize: 7, fontWeight: '800', backgroundColor: colours.mossSoft, borderRadius: radius.pill, paddingHorizontal: 7, paddingVertical: 5 },
  desktopButton: { minHeight: 42, borderRadius: 13, backgroundColor: colours.blue, alignItems: 'center', justifyContent: 'center', marginTop: 13 },
  desktopButtonText: { color: colours.white, fontSize: 10, fontWeight: '900' },
  desktopCommand: { color: colours.inkSoft, fontSize: 8, textAlign: 'center', marginTop: 8 },
  desktopError: { color: '#A1432C', fontSize: 9, lineHeight: 14, marginTop: 8 },
  huaweiCard: { backgroundColor: colours.surface, borderRadius: radius.large, padding: 17, marginTop: 10, borderWidth: 1, borderColor: '#D8E3DA' },
  huaweiEyebrow: { color: colours.moss, fontSize: 8, fontWeight: '900', letterSpacing: 0.8 },
  huaweiDataItem: { color: colours.moss, fontSize: 7, fontWeight: '800', backgroundColor: colours.mossSoft, borderRadius: radius.pill, paddingHorizontal: 7, paddingVertical: 5 },
  huaweiButton: { minHeight: 42, borderRadius: 13, backgroundColor: colours.moss, alignItems: 'center', justifyContent: 'center', marginTop: 13 },
  huaweiError: { color: '#A1432C', fontSize: 9, lineHeight: 14, marginTop: 8 },
  statusList: { backgroundColor: colours.surface, borderRadius: radius.medium, paddingHorizontal: 14, marginTop: 9, borderWidth: 1, borderColor: colours.line },
  statusRow: { minHeight: 38, flexDirection: 'row', alignItems: 'center', borderBottomWidth: 1, borderBottomColor: '#EEEAE3' },
  statusSource: { flex: 1, color: colours.ink, fontSize: 10, fontWeight: '800' },
  statusState: { color: colours.inkSoft, fontSize: 8, fontWeight: '800', textTransform: 'uppercase' },
  engineCard: { backgroundColor: colours.surface, borderRadius: radius.large, padding: 17, marginTop: 11, borderWidth: 1, borderColor: colours.line },
  engineTopRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'flex-start' },
  engineEyebrow: { color: colours.moss, fontSize: 8, fontWeight: '900', letterSpacing: 0.9 },
  engineTitle: { color: colours.ink, fontSize: 16, fontWeight: '900', marginTop: 4 },
  engineBadge: { backgroundColor: colours.amberSoft, borderRadius: radius.pill, paddingHorizontal: 8, paddingVertical: 5 },
  engineBadgeText: { color: '#8A641E', fontSize: 7, fontWeight: '900', letterSpacing: 0.5 },
  engineBody: { color: colours.inkSoft, fontSize: 10, lineHeight: 16, marginTop: 10 },
  engineResults: { flexDirection: 'row', marginTop: 15, backgroundColor: colours.surfaceMuted, borderRadius: 14, paddingVertical: 11 },
  engineMetric: { flex: 1, alignItems: 'center' },
  engineMetricValue: { color: colours.ink, fontSize: 14, fontWeight: '900' },
  engineMetricLabel: { color: colours.inkSoft, fontSize: 7, marginTop: 3 },
  enginePersisted: { color: colours.inkSoft, fontSize: 9, marginTop: 13 },
  engineButton: { minHeight: 42, borderRadius: 13, backgroundColor: colours.moss, alignItems: 'center', justifyContent: 'center', marginTop: 13 },
  engineButtonText: { color: colours.white, fontSize: 10, fontWeight: '900' },
  engineNote: { color: colours.inkSoft, fontSize: 8, lineHeight: 13, textAlign: 'center', marginTop: 9 },
  helper: { color: colours.inkSoft, fontSize: 11, lineHeight: 17, marginTop: 7 },
  segmented: { flexDirection: 'row', backgroundColor: colours.surfaceMuted, borderRadius: radius.medium, padding: 4, marginTop: 14 },
  segment: { flex: 1, minHeight: 38, borderRadius: 12, justifyContent: 'center', alignItems: 'center' },
  segmentSelected: { backgroundColor: colours.ink },
  segmentText: { color: colours.inkSoft, fontSize: 11, fontWeight: '800' },
  segmentTextSelected: { color: colours.white },
  capabilityIntro: { marginTop: 17, marginBottom: 11 },
  capabilityTitle: { color: colours.ink, fontSize: 15, fontWeight: '900' },
  capabilityDescription: { color: colours.inkSoft, fontSize: 11, lineHeight: 17, marginTop: 4 },
  capabilityRow: { flexDirection: 'row', alignItems: 'center', backgroundColor: colours.surface, borderRadius: radius.medium, padding: 14, marginBottom: 8, borderWidth: 1, borderColor: '#E7E0D6' },
  capabilityIcon: { width: 38, height: 38, borderRadius: 12, backgroundColor: colours.mossSoft, alignItems: 'center', justifyContent: 'center' },
  capabilityIconText: { color: colours.moss, fontSize: 17, fontWeight: '900' },
  capabilityCopy: { flex: 1, marginLeft: 12 },
  capabilityLabel: { color: colours.ink, fontSize: 13, fontWeight: '900' },
  capabilityDetail: { color: colours.inkSoft, fontSize: 10, lineHeight: 14, marginTop: 3 },
  status: { borderRadius: radius.pill, paddingHorizontal: 8, paddingVertical: 5, marginLeft: 7 },
  statusText: { fontSize: 8, fontWeight: '900', letterSpacing: 0.4 },
  settingsCard: { backgroundColor: colours.surface, borderRadius: radius.large, paddingHorizontal: 16, marginTop: 13, borderWidth: 1, borderColor: colours.line },
  settingRow: { minHeight: 71, flexDirection: 'row', alignItems: 'center', borderBottomWidth: 1, borderBottomColor: '#EEEAE3' },
  settingRowLast: { borderBottomWidth: 0 },
  settingCopy: { flex: 1, paddingRight: 12 },
  settingTitle: { color: colours.ink, fontSize: 12, fontWeight: '900' },
  settingDetail: { color: colours.inkSoft, fontSize: 9, lineHeight: 13, marginTop: 3 },
  toggle: { width: 40, height: 23, borderRadius: 12, backgroundColor: colours.surfaceMuted, padding: 3 },
  toggleOn: { backgroundColor: colours.moss },
  toggleKnob: { width: 17, height: 17, borderRadius: 9, backgroundColor: colours.white },
  toggleKnobOn: { alignSelf: 'flex-end' },
  controlCard: { backgroundColor: colours.surface, borderRadius: radius.large, padding: 17, marginTop: 19, borderWidth: 1, borderColor: colours.line },
  controlHeading: { flexDirection: 'row', alignItems: 'center', marginBottom: 5 },
  controlIcon: { color: colours.moss, fontSize: 16, marginRight: 9 },
  controlTitle: { color: colours.ink, fontSize: 15, fontWeight: '900' },
  controlRow: { flexDirection: 'row', justifyContent: 'space-between', borderTopWidth: 1, borderTopColor: '#EEEAE3', paddingVertical: 14 },
  controlLabel: { color: colours.ink, fontSize: 12, fontWeight: '700' },
  controlAction: { color: colours.moss, fontSize: 11, fontWeight: '800' },
  footer: { color: colours.inkSoft, fontSize: 10, lineHeight: 16, textAlign: 'center', margin: 20 },
});
