import { useMemo, useState } from 'react';
import { Platform, Pressable, ScrollView, StyleSheet, Text, TextInput, View } from 'react-native';
import { CollectorStatus, DeviceRecord, RawObservation, RepositoryDiagnostics } from '../data/contracts';
import { BrowserIntegrationStatus, DesktopDeviceConnectionStatus } from '../collectors/desktopCollectorClient';
import { ActivityPurpose, AppProfile, AppProfileDefinition, CapabilityItem, DigitalActivityCategory, DigitalActivityRule } from '../domain/types';
import { profiles } from '../fixtures/demoDay';
import { LocationReconstructionResult } from '../reconstruction/locationEngine';
import { classifyDigitalApplication, classifyDigitalDomain, normalizeDigitalApplication } from '../reconstruction/digitalActivityClassifier';
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
  devices: DeviceRecord[];
  observations: RawObservation[];
  digitalActivityRules: DigitalActivityRule[];
  onUpdateDeviceLabel: (deviceId: string, label: string) => Promise<void>;
  onUpsertDigitalActivityRule: (rule: Omit<DigitalActivityRule, 'id' | 'createdAt' | 'updatedAt'>) => Promise<void>;
  onDeleteDigitalActivityRule: (id: string) => Promise<void>;
  desktopControl: { available: boolean; paused: boolean; running: boolean };
  onSetDesktopPaused: (paused: boolean) => Promise<void>;
  onDeleteDesktopHistory: (range: '7d' | '30d' | 'all') => Promise<void>;
  browserIntegration: BrowserIntegrationStatus;
  onRequestBrowserPairingCode: () => Promise<{ code: string; expiresAt: string }>;
  onDisconnectBrowser: () => Promise<void>;
  desktopDeviceConnection: DesktopDeviceConnectionStatus;
  onRequestDesktopDevicePairingCode: () => Promise<{ code: string; expiresAt: string; addresses: string[] }>;
  onPairDesktopMobile: (address: string, code: string) => Promise<void>;
  onDisconnectDesktopMobile: () => Promise<void>;
}

const collectorLabels: Record<CollectorStatus['source'], string> = {
  location: 'Location', motion: 'Motion', calendar: 'Calendar', desktop: 'Desktop', phone: 'Phone activity', health: 'Health',
};

export function YouScreen({ profile, onChangeProfile, collectorStatuses, diagnostics, actionError, lastReconstruction, knownPlaceCount, onCaptureLocation, onEnableBackgroundLocation, onSyncDesktopActivity, onConnectHuaweiHealth, onRunSyntheticReconstruction, devices, observations, digitalActivityRules, onUpdateDeviceLabel, onUpsertDigitalActivityRule, onDeleteDigitalActivityRule, desktopControl, onSetDesktopPaused, onDeleteDesktopHistory, browserIntegration, onRequestBrowserPairingCode, onDisconnectBrowser, desktopDeviceConnection, onRequestDesktopDevicePairingCode, onPairDesktopMobile, onDisconnectDesktopMobile }: Props) {
  const [localProcessing, setLocalProcessing] = useState(true);
  const [quickChecks, setQuickChecks] = useState(true);
  const [locationBusy, setLocationBusy] = useState<'sample' | 'background' | null>(null);
  const [engineBusy, setEngineBusy] = useState(false);
  const [desktopBusy, setDesktopBusy] = useState(false);
  const [huaweiBusy, setHuaweiBusy] = useState(false);
  const [privacyBusy, setPrivacyBusy] = useState(false);
  const [pendingDelete, setPendingDelete] = useState<'7d' | '30d' | 'all' | null>(null);
  const [browserCode, setBrowserCode] = useState<{ code: string; expiresAt: string } | null>(null);
  const [browserBusy, setBrowserBusy] = useState(false);
  const [devicePairingAddress, setDevicePairingAddress] = useState('');
  const [devicePairingCode, setDevicePairingCode] = useState('');
  const [windowsPairing, setWindowsPairing] = useState<{ code: string; expiresAt: string; addresses: string[] } | null>(null);
  const [devicePairingBusy, setDevicePairingBusy] = useState(false);
  const locationStatus = collectorStatuses.find((item) => item.source === 'location');
  const desktopStatus = collectorStatuses.find((item) => item.source === 'desktop');
  const healthStatus = collectorStatuses.find((item) => item.source === 'health');
  const realSourceCount = new Set(observations.filter((observation) => observation.payload.mocked !== true).map((observation) => observation.source)).size;

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

  const pairWindows = async () => {
    setDevicePairingBusy(true);
    try {
      await onPairDesktopMobile(devicePairingAddress, devicePairingCode);
      setDevicePairingCode('');
    } catch {
      // The repository hook exposes the user-facing failure through actionError.
    } finally {
      setDevicePairingBusy(false);
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
          <View style={styles.memoryStat}><Text style={styles.memoryValue}>{digitalActivityRules.length}</Text><Text style={styles.memoryLabel}>context rules</Text></View>
          <View style={styles.memoryDivider} />
          <View style={styles.memoryStat}><Text style={styles.memoryValue}>{realSourceCount}</Text><Text style={styles.memoryLabel}>observed sources</Text></View>
        </View>
      </View>

      <View style={styles.sectionHeader}>
        <Text style={styles.sectionTitle}>Local data foundation</Text>
        <View style={styles.liveBadge}><Text style={styles.liveBadgeText}>{diagnostics?.adapter === 'sqlite' ? 'ENCRYPTED SQLITE' : diagnostics?.adapter === 'desktop-encrypted' ? 'WINDOWS ENCRYPTED' : 'WEB DEV STORE'}</Text></View>
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
        {desktopControl.available ? (
          <>
            {windowsPairing ? (
              <View style={styles.browserCodeBox}>
                <Text style={styles.browserCodeLabel}>PAIR THIS WINDOWS LAPTOP · EXPIRES IN 5 MINUTES</Text>
                <Text selectable style={styles.browserCode}>{windowsPairing.code}</Text>
                <Text selectable style={styles.desktopCommand}>Windows address: {windowsPairing.addresses.join(' or ') || 'Connect Windows to Wi-Fi'}</Text>
                <Text style={styles.desktopCommand}>On the iPhone, open You → Windows companion and enter this address and code.</Text>
              </View>
            ) : null}
            <Pressable
              disabled={devicePairingBusy}
              onPress={() => {
                setDevicePairingBusy(true);
                void onRequestDesktopDevicePairingCode().then(setWindowsPairing).finally(() => setDevicePairingBusy(false));
              }}
              style={[styles.desktopButton, devicePairingBusy && styles.disabled]}
            >
              <Text style={styles.desktopButtonText}>{devicePairingBusy ? 'Preparing…' : 'Connect my iPhone'}</Text>
            </Pressable>
          </>
        ) : desktopDeviceConnection.supported && !desktopDeviceConnection.paired ? (
          <>
            <TextInput
              autoCapitalize="none"
              autoCorrect={false}
              onChangeText={setDevicePairingAddress}
              placeholder="Windows address, e.g. 192.168.1.20:43123"
              placeholderTextColor={colours.inkSoft}
              style={styles.pairingInput}
              value={devicePairingAddress}
            />
            <TextInput
              keyboardType="number-pad"
              maxLength={6}
              onChangeText={(value) => setDevicePairingCode(value.replace(/\D/g, ''))}
              placeholder="Six-digit code"
              placeholderTextColor={colours.inkSoft}
              style={styles.pairingInput}
              value={devicePairingCode}
            />
            <Pressable
              accessibilityRole="button"
              disabled={devicePairingBusy}
              onPress={() => void pairWindows()}
              style={[styles.desktopButton, devicePairingBusy && styles.disabled]}
            >
              <Text style={styles.desktopButtonText}>{devicePairingBusy ? 'Connecting…' : 'Pair and import Windows activity'}</Text>
            </Pressable>
            <Text style={styles.desktopCommand}>Generate the code in ATIRA on Windows. Both devices must be on the same private Wi-Fi.</Text>
          </>
        ) : (
          <>
            <Pressable accessibilityRole="button" disabled={desktopBusy} onPress={() => void syncDesktop()} style={[styles.desktopButton, desktopBusy && styles.disabled]}>
              <Text style={styles.desktopButtonText}>{desktopBusy ? 'Syncing…' : 'Sync desktop sessions'}</Text>
            </Pressable>
            {desktopDeviceConnection.paired ? (
              <>
                <Text style={styles.desktopCommand}>Paired with {desktopDeviceConnection.deviceLabel} at {desktopDeviceConnection.address}</Text>
                <Pressable disabled={devicePairingBusy} onPress={() => void onDisconnectDesktopMobile()} style={styles.disconnectButton}>
                  <Text style={styles.disconnectButtonText}>Forget Windows connection</Text>
                </Pressable>
              </>
            ) : <Text style={styles.desktopCommand}>{Platform.OS === 'web' ? 'Start in PowerShell: npm run desktop:collector' : 'Pair Windows before syncing.'}</Text>}
          </>
        )}
        {actionError?.startsWith('Desktop companion') ? <Text style={styles.desktopError}>{actionError}</Text> : null}
      </View>

      <View style={styles.desktopCard}>
        <View style={styles.desktopHeader}>
          <View><Text style={styles.desktopEyebrow}>BROWSER ACTIVITY</Text><Text style={styles.desktopTitle}>One private connection for every browser</Text></View>
          <View style={[styles.desktopState, browserIntegration.paired && styles.desktopStateOn]}><Text style={styles.desktopStateText}>{browserIntegration.paired ? `${browserIntegration.connectedBrowserCount} CONNECTED` : 'OPTIONAL'}</Text></View>
        </View>
        <Text style={styles.desktopDetail}>{browserIntegration.paired ? `${browserIntegration.browsers.map((item) => labelBrowser(item.browser)).join(', ')} ${browserIntegration.connectedBrowserCount === 1 ? 'is' : 'are'} securely connected.${browserIntegration.lastObservedAt ? ` Last domain interval: ${new Date(browserIntegration.lastObservedAt).toLocaleString()}.` : ' Waiting for the first completed interval.'}` : 'Connect the browsers you use. ATIRA groups each active website beneath its browser while keeping paths and content private.'}</Text>
        <View style={styles.desktopPrivacyRow}><Text style={styles.desktopPrivacyItem}>Domain only</Text><Text style={styles.desktopPrivacyItem}>No content</Text><Text style={styles.desktopPrivacyItem}>No searches</Text><Text style={styles.desktopPrivacyItem}>No incognito</Text></View>
        {browserCode ? <View style={styles.browserCodeBox}><Text style={styles.browserCodeLabel}>ONE-TIME CONNECTION CODE · EXPIRES IN 5 MINUTES</Text><Text selectable style={styles.browserCode}>{browserCode.code}</Text><Text style={styles.desktopCommand}>Open ATIRA Browser Activity in the browser you want to add and enter this code.</Text></View> : null}
        <View style={styles.collectorActions}>
          <Pressable disabled={!browserIntegration.available || browserBusy} onPress={() => { setBrowserBusy(true); void onRequestBrowserPairingCode().then(setBrowserCode).finally(() => setBrowserBusy(false)); }} style={[styles.collectorPrimary, (!browserIntegration.available || browserBusy) && styles.disabled]}>
            <Text style={styles.collectorPrimaryText}>{browserBusy ? 'Working…' : browserIntegration.available ? browserIntegration.paired ? 'Add another browser' : 'Connect a browser' : 'Installed app required'}</Text>
          </Pressable>
          {browserIntegration.paired ? <Pressable disabled={browserBusy} onPress={() => { setBrowserBusy(true); void onDisconnectBrowser().then(() => setBrowserCode(null)).finally(() => setBrowserBusy(false)); }} style={styles.collectorSecondary}><Text style={styles.collectorSecondaryText}>Disconnect all</Text></Pressable> : null}
        </View>
        <Text style={styles.desktopCommand}>Chrome, Edge, Brave and Opera share one build. Firefox uses the Firefox build; Safari follows with the Apple companion.</Text>
      </View>

      <DeviceActivityControls
        devices={devices}
        observations={observations}
        rules={digitalActivityRules}
        onUpdateDeviceLabel={onUpdateDeviceLabel}
        onUpsertRule={onUpsertDigitalActivityRule}
        onDeleteRule={onDeleteDigitalActivityRule}
      />

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
          <Text style={styles.demoBadge}>{desktopControl.available ? 'WINDOWS LIVE' : 'CONTROL PREVIEW'}</Text>
        </View>
      <Text style={styles.helper}>Windows pause and deletion controls are live in the installed app. Other platform controls remain capability previews.</Text>
      <View style={styles.settingsCard}>
        <SettingToggle
          title="Private mode"
          detail={desktopControl.available ? 'Pause the installed Windows collector until you resume it' : 'Available in the installed Windows app'}
          value={desktopControl.paused}
          onPress={() => {
            if (!desktopControl.available || privacyBusy) return;
            setPrivacyBusy(true);
            void onSetDesktopPaused(!desktopControl.paused).finally(() => setPrivacyBusy(false));
          }}
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
        <Pressable disabled={!desktopControl.available || privacyBusy} onPress={() => { setPrivacyBusy(true); void onSetDesktopPaused(!desktopControl.paused).finally(() => setPrivacyBusy(false)); }} style={styles.controlRow}><Text style={styles.controlLabel}>{desktopControl.paused ? 'Resume Windows collection' : 'Pause Windows collection'}</Text><Text style={styles.controlAction}>{desktopControl.available ? desktopControl.paused ? 'Resume' : 'Pause' : 'Installed app only'}</Text></Pressable>
        {(['7d', '30d', 'all'] as const).map((range) => (
          <Pressable key={range} disabled={!desktopControl.available || privacyBusy} onPress={() => setPendingDelete(range)} style={styles.controlRow}><Text style={styles.controlLabel}>Delete {range === 'all' ? 'all desktop history' : `the last ${range === '7d' ? '7' : '30'} days`}</Text><Text style={styles.deleteAction}>Delete</Text></Pressable>
        ))}
        {pendingDelete && <View style={styles.deleteConfirm}><Text style={styles.deleteConfirmText}>This permanently removes matching raw desktop sessions and their derived summaries from ATIRA.</Text><View style={styles.ruleActions}><Pressable onPress={() => { const range = pendingDelete; setPendingDelete(null); setPrivacyBusy(true); void onDeleteDesktopHistory(range).finally(() => setPrivacyBusy(false)); }} style={styles.deleteConfirmButton}><Text style={styles.deleteConfirmButtonText}>Confirm deletion</Text></Pressable><Pressable onPress={() => setPendingDelete(null)} style={styles.ruleResetButton}><Text style={styles.ruleResetText}>Cancel</Text></Pressable></View></View>}
      </View>
      <Text style={styles.footer}>ATIRA is designed to explain its conclusions, invite correction, and degrade honestly when a signal is unavailable.</Text>
    </ScrollView>
  );
}

function DeviceActivityControls({ devices, observations, rules, onUpdateDeviceLabel, onUpsertRule, onDeleteRule }: {
  devices: DeviceRecord[];
  observations: RawObservation[];
  rules: DigitalActivityRule[];
  onUpdateDeviceLabel: (deviceId: string, label: string) => Promise<void>;
  onUpsertRule: (rule: Omit<DigitalActivityRule, 'id' | 'createdAt' | 'updatedAt'>) => Promise<void>;
  onDeleteRule: (id: string) => Promise<void>;
}) {
  const digitalDevices = useMemo(() => devices.filter((device) => ['computer', 'phone', 'tablet'].includes(device.deviceClass)
    || observations.some((observation) => observation.deviceId === device.id && ['desktop_foreground', 'app_foreground', 'browser_foreground'].includes(observation.kind))), [devices, observations]);
  const [selectedDeviceId, setSelectedDeviceId] = useState(() => digitalDevices.find((device) => device.deviceClass === 'computer' && !device.id.startsWith('legacy-'))?.id
    ?? digitalDevices.find((device) => device.deviceClass === 'computer')?.id
    ?? digitalDevices[0]?.id
    ?? '');
  const [selectedApplicationId, setSelectedApplicationId] = useState<string | null>(null);
  const selectedDevice = digitalDevices.find((device) => device.id === selectedDeviceId)
    ?? digitalDevices.find((device) => device.deviceClass === 'computer' && !device.id.startsWith('legacy-'))
    ?? digitalDevices.find((device) => device.deviceClass === 'computer')
    ?? digitalDevices[0];
  const applications = useMemo(() => {
    if (!selectedDevice) return [];
    const byId = new Map<string, { applicationId: string; rawName: string; sessionCount: number }>();
    for (const observation of observations) {
      if (observation.deviceId !== selectedDevice.id || !['desktop_foreground', 'app_foreground', 'browser_foreground'].includes(observation.kind)) continue;
      const domain = observation.kind === 'browser_foreground' && typeof observation.payload.domain === 'string' ? observation.payload.domain : '';
      const rawName = typeof observation.payload.application === 'string' ? observation.payload.application : '';
      const applicationId = domain ? `web:${domain}` : normalizeDigitalApplication(rawName);
      if (!applicationId) continue;
      const current = byId.get(applicationId) ?? { applicationId, rawName: domain || rawName, sessionCount: 0 };
      current.sessionCount += 1;
      byId.set(applicationId, current);
    }
    return [...byId.values()].map((item) => ({
      ...item,
      classification: item.applicationId.startsWith('web:') ? classifyDigitalDomain(item.rawName, selectedDevice.id, rules) : classifyDigitalApplication(item.rawName, selectedDevice.id, rules),
    })).filter((item) => !['atira', 'electron'].includes(item.applicationId)).sort((a, b) => b.sessionCount - a.sessionCount);
  }, [observations, rules, selectedDevice]);
  const selectedApplication = applications.find((item) => item.applicationId === selectedApplicationId) ?? null;

  if (!selectedDevice) return null;
  return (
    <View style={styles.deviceManagementCard}>
      <View style={styles.desktopHeader}>
        <View><Text style={styles.managementEyebrow}>DEVICES & INTERPRETATION</Text><Text style={styles.desktopTitle}>Teach ATIRA your context</Text></View>
        <Text style={styles.ruleCount}>{rules.length} RULE{rules.length === 1 ? '' : 'S'}</Text>
      </View>
      <Text style={styles.desktopDetail}>Raw sessions stay unchanged. These device-specific rules alter only how activity is labelled and summarised.</Text>
      <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.deviceStrip}>
        {digitalDevices.map((device) => (
          <Pressable key={device.id} onPress={() => { setSelectedDeviceId(device.id); setSelectedApplicationId(null); }} style={[styles.deviceChip, device.id === selectedDevice.id && styles.deviceChipSelected]}>
            <Text style={[styles.deviceChipText, device.id === selectedDevice.id && styles.deviceChipTextSelected]}>{device.label}</Text>
          </Pressable>
        ))}
      </ScrollView>
      <DeviceLabelEditor key={`${selectedDevice.id}:${selectedDevice.label}`} device={selectedDevice} onSave={onUpdateDeviceLabel} />
      <Text style={styles.managementLabel}>DETECTED APPLICATIONS & ACTIVE SITES</Text>
      <View style={styles.applicationList}>
        {applications.length === 0 ? <Text style={styles.managementEmpty}>No complete application sessions have been observed on this device yet.</Text> : applications.slice(0, 25).map((application) => {
          const selected = selectedApplication?.applicationId === application.applicationId;
          return (
            <Pressable key={application.applicationId} onPress={() => setSelectedApplicationId(selected ? null : application.applicationId)} style={[styles.applicationRow, selected && styles.applicationRowSelected]}>
              <View style={styles.applicationCopy}><Text style={styles.applicationName}>{application.classification.applicationName}</Text><Text style={styles.applicationMeta}>{labelWords(application.classification.category)} · {labelWords(application.classification.purpose)} · {application.sessionCount} raw session{application.sessionCount === 1 ? '' : 's'}</Text></View>
              <Text style={[styles.applicationRuleState, application.classification.provenance === 'user_rule' && styles.applicationRuleStateUser]}>{application.classification.excluded ? 'EXCLUDED' : application.classification.provenance === 'user_rule' ? 'YOUR RULE' : application.classification.provenance === 'unclassified' ? 'NEEDS CONTEXT' : 'DEFAULT'}</Text>
            </Pressable>
          );
        })}
      </View>
      {selectedApplication && (
        <ApplicationRuleEditor
          key={`${selectedDevice.id}:${selectedApplication.applicationId}:${rules.find((rule) => rule.deviceId === selectedDevice.id && rule.applicationId === selectedApplication.applicationId)?.updatedAt ?? 'default'}`}
          deviceId={selectedDevice.id}
          applicationId={selectedApplication.applicationId}
          applicationName={selectedApplication.classification.applicationName}
          defaultCategory={selectedApplication.classification.category}
          defaultPurpose={selectedApplication.classification.purpose}
          rule={rules.find((rule) => rule.deviceId === selectedDevice.id && rule.applicationId === selectedApplication.applicationId)}
          onSave={onUpsertRule}
          onReset={onDeleteRule}
        />
      )}
    </View>
  );
}

function DeviceLabelEditor({ device, onSave }: { device: DeviceRecord; onSave: (deviceId: string, label: string) => Promise<void> }) {
  const [label, setLabel] = useState(device.label);
  const [busy, setBusy] = useState(false);
  return (
    <View style={styles.labelEditor}>
      <TextInput accessibilityLabel="Device name" value={label} onChangeText={setLabel} style={styles.labelInput} />
      <Pressable disabled={busy || !label.trim() || label.trim() === device.label} onPress={() => { setBusy(true); void onSave(device.id, label).finally(() => setBusy(false)); }} style={[styles.smallSaveButton, (busy || !label.trim() || label.trim() === device.label) && styles.disabled]}><Text style={styles.smallSaveText}>{busy ? 'Saving…' : 'Rename'}</Text></Pressable>
    </View>
  );
}

function ApplicationRuleEditor({ deviceId, applicationId, applicationName, defaultCategory, defaultPurpose, rule, onSave, onReset }: {
  deviceId: string;
  applicationId: string;
  applicationName: string;
  defaultCategory: DigitalActivityCategory;
  defaultPurpose: ActivityPurpose;
  rule?: DigitalActivityRule;
  onSave: (rule: Omit<DigitalActivityRule, 'id' | 'createdAt' | 'updatedAt'>) => Promise<void>;
  onReset: (id: string) => Promise<void>;
}) {
  const [alias, setAlias] = useState(rule?.alias ?? '');
  const [category, setCategory] = useState<DigitalActivityCategory>(rule?.category ?? defaultCategory);
  const [purpose, setPurpose] = useState<ActivityPurpose>(rule?.purpose ?? defaultPurpose);
  const [excluded, setExcluded] = useState(rule?.excluded ?? false);
  const [busy, setBusy] = useState(false);
  const categories: DigitalActivityCategory[] = ['creation', 'communication', 'learning', 'entertainment', 'browser', 'ai_assistance', 'other'];
  const purposes: ActivityPurpose[] = ['work', 'learning', 'personal', 'unknown'];
  const save = async () => {
    setBusy(true);
    try { await onSave({ deviceId, applicationId, alias: alias.trim() || undefined, category, purpose, excluded }); } finally { setBusy(false); }
  };
  return (
    <View style={styles.ruleEditor}>
      <Text style={styles.ruleEditorTitle}>Interpret {applicationName} on this device</Text>
      <Text style={styles.ruleEditorHelp}>This does not rewrite the raw observation. It creates a reversible interpretation rule.</Text>
      <TextInput accessibilityLabel="Application alias" value={alias} onChangeText={setAlias} placeholder={`Display as ${applicationName}`} placeholderTextColor={colours.inkSoft} style={styles.ruleInput} />
      <Text style={styles.ruleFieldLabel}>CATEGORY</Text>
      <View style={styles.ruleOptions}>{categories.map((item) => <Pressable key={item} onPress={() => setCategory(item)} style={[styles.ruleOption, item === category && styles.ruleOptionSelected]}><Text style={[styles.ruleOptionText, item === category && styles.ruleOptionTextSelected]}>{labelWords(item)}</Text></Pressable>)}</View>
      <Text style={styles.ruleFieldLabel}>PURPOSE</Text>
      <View style={styles.ruleOptions}>{purposes.map((item) => <Pressable key={item} onPress={() => setPurpose(item)} style={[styles.ruleOption, item === purpose && styles.ruleOptionSelected]}><Text style={[styles.ruleOptionText, item === purpose && styles.ruleOptionTextSelected]}>{labelWords(item)}</Text></Pressable>)}</View>
      <Pressable onPress={() => setExcluded((value) => !value)} style={styles.excludeRow}><View style={[styles.checkBox, excluded && styles.checkBoxOn]}><Text style={styles.checkMark}>{excluded ? '✓' : ''}</Text></View><View><Text style={styles.excludeTitle}>Exclude from meaningful usage</Text><Text style={styles.excludeDetail}>Raw sessions remain stored and can be restored by resetting this rule.</Text></View></Pressable>
      <View style={styles.ruleActions}>
        <Pressable disabled={busy} onPress={() => void save()} style={[styles.ruleSaveButton, busy && styles.disabled]}><Text style={styles.ruleSaveText}>{busy ? 'Saving…' : 'Save rule'}</Text></Pressable>
        {rule && <Pressable disabled={busy} onPress={() => { setBusy(true); void onReset(rule.id).finally(() => setBusy(false)); }} style={styles.ruleResetButton}><Text style={styles.ruleResetText}>Reset to default</Text></Pressable>}
      </View>
    </View>
  );
}

function labelWords(value: string) { return value.replaceAll('_', ' ').replace(/^./, (letter) => letter.toUpperCase()); }
function labelBrowser(value: string) { return ({ chrome: 'Chrome', edge: 'Edge', brave: 'Brave', opera: 'Opera', firefox: 'Firefox', safari: 'Safari' } as Record<string, string>)[value] ?? 'Browser'; }

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
  pairingInput: { minHeight: 42, borderRadius: 13, borderWidth: 1, borderColor: colours.line, color: colours.ink, backgroundColor: colours.surfaceMuted, paddingHorizontal: 12, marginTop: 10, fontSize: 11 },
  disconnectButton: { alignItems: 'center', paddingVertical: 10, marginTop: 3 },
  disconnectButtonText: { color: colours.inkSoft, fontSize: 9, fontWeight: '800' },
  browserCodeBox: { backgroundColor: colours.surfaceMuted, borderRadius: 13, padding: 13, alignItems: 'center', marginTop: 13 },
  browserCodeLabel: { color: colours.inkSoft, fontSize: 7, fontWeight: '900', letterSpacing: 0.8 },
  browserCode: { color: colours.ink, fontSize: 25, fontWeight: '900', letterSpacing: 6, marginTop: 6 },
  desktopError: { color: '#A1432C', fontSize: 9, lineHeight: 14, marginTop: 8 },
  deviceManagementCard: { backgroundColor: colours.surface, borderRadius: radius.large, padding: 18, marginTop: 13, borderWidth: 1, borderColor: colours.line },
  managementEyebrow: { color: colours.moss, fontSize: 8, fontWeight: '900', letterSpacing: 1.2 },
  ruleCount: { color: colours.moss, backgroundColor: colours.mossSoft, borderRadius: radius.pill, paddingHorizontal: 8, paddingVertical: 5, fontSize: 7, fontWeight: '900', overflow: 'hidden' },
  deviceStrip: { gap: 7, paddingVertical: 13 },
  deviceChip: { borderRadius: radius.pill, borderWidth: 1, borderColor: colours.line, paddingHorizontal: 11, paddingVertical: 8 },
  deviceChipSelected: { backgroundColor: colours.ink, borderColor: colours.ink },
  deviceChipText: { color: colours.inkSoft, fontSize: 9, fontWeight: '800' },
  deviceChipTextSelected: { color: colours.white },
  labelEditor: { flexDirection: 'row', gap: 7, marginBottom: 15 },
  labelInput: { flex: 1, minHeight: 39, borderWidth: 1, borderColor: colours.line, borderRadius: 11, paddingHorizontal: 11, color: colours.ink, fontSize: 10, backgroundColor: colours.canvas },
  smallSaveButton: { minWidth: 72, minHeight: 39, borderRadius: 11, backgroundColor: colours.moss, alignItems: 'center', justifyContent: 'center', paddingHorizontal: 11 },
  smallSaveText: { color: colours.white, fontSize: 9, fontWeight: '900' },
  managementLabel: { color: colours.inkSoft, fontSize: 7, fontWeight: '900', letterSpacing: 1.1, marginBottom: 5 },
  applicationList: { borderWidth: 1, borderColor: colours.line, borderRadius: radius.medium, overflow: 'hidden' },
  applicationRow: { minHeight: 53, paddingHorizontal: 12, paddingVertical: 9, flexDirection: 'row', alignItems: 'center', borderBottomWidth: 1, borderBottomColor: '#EEEAE3' },
  applicationRowSelected: { backgroundColor: colours.mossSoft },
  applicationCopy: { flex: 1 },
  applicationName: { color: colours.ink, fontSize: 10, fontWeight: '900' },
  applicationMeta: { color: colours.inkSoft, fontSize: 7, marginTop: 3 },
  applicationRuleState: { color: colours.inkSoft, fontSize: 6, fontWeight: '900', letterSpacing: 0.4 },
  applicationRuleStateUser: { color: colours.moss },
  managementEmpty: { color: colours.inkSoft, fontSize: 9, lineHeight: 14, padding: 13 },
  ruleEditor: { backgroundColor: colours.canvas, borderRadius: radius.medium, padding: 14, marginTop: 10, borderWidth: 1, borderColor: colours.line },
  ruleEditorTitle: { color: colours.ink, fontSize: 13, fontWeight: '900' },
  ruleEditorHelp: { color: colours.inkSoft, fontSize: 8, lineHeight: 13, marginTop: 4 },
  ruleInput: { minHeight: 39, borderWidth: 1, borderColor: colours.line, borderRadius: 11, paddingHorizontal: 11, color: colours.ink, fontSize: 10, backgroundColor: colours.surface, marginTop: 12 },
  ruleFieldLabel: { color: colours.inkSoft, fontSize: 7, fontWeight: '900', letterSpacing: 1, marginTop: 13, marginBottom: 6 },
  ruleOptions: { flexDirection: 'row', flexWrap: 'wrap', gap: 5 },
  ruleOption: { borderRadius: radius.pill, backgroundColor: colours.surface, borderWidth: 1, borderColor: colours.line, paddingHorizontal: 9, paddingVertical: 6 },
  ruleOptionSelected: { backgroundColor: colours.ink, borderColor: colours.ink },
  ruleOptionText: { color: colours.inkSoft, fontSize: 7, fontWeight: '800' },
  ruleOptionTextSelected: { color: colours.white },
  excludeRow: { flexDirection: 'row', alignItems: 'center', marginTop: 14 },
  checkBox: { width: 19, height: 19, borderWidth: 1, borderColor: colours.line, borderRadius: 6, marginRight: 9, alignItems: 'center', justifyContent: 'center', backgroundColor: colours.surface },
  checkBoxOn: { backgroundColor: colours.coral, borderColor: colours.coral },
  checkMark: { color: colours.white, fontSize: 10, fontWeight: '900' },
  excludeTitle: { color: colours.ink, fontSize: 9, fontWeight: '900' },
  excludeDetail: { color: colours.inkSoft, fontSize: 7, marginTop: 2 },
  ruleActions: { flexDirection: 'row', gap: 7, marginTop: 14 },
  ruleSaveButton: { minHeight: 38, backgroundColor: colours.moss, borderRadius: 11, paddingHorizontal: 15, alignItems: 'center', justifyContent: 'center' },
  ruleSaveText: { color: colours.white, fontSize: 9, fontWeight: '900' },
  ruleResetButton: { minHeight: 38, borderWidth: 1, borderColor: colours.line, borderRadius: 11, paddingHorizontal: 15, alignItems: 'center', justifyContent: 'center' },
  ruleResetText: { color: colours.inkSoft, fontSize: 9, fontWeight: '800' },
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
  deleteAction: { color: colours.coral, fontSize: 11, fontWeight: '800' },
  deleteConfirm: { backgroundColor: '#FBE9E3', borderRadius: radius.medium, padding: 13, marginBottom: 12 },
  deleteConfirmText: { color: '#7A3524', fontSize: 9, lineHeight: 14 },
  deleteConfirmButton: { minHeight: 38, backgroundColor: colours.coral, borderRadius: 11, paddingHorizontal: 15, alignItems: 'center', justifyContent: 'center' },
  deleteConfirmButtonText: { color: colours.white, fontSize: 9, fontWeight: '900' },
  footer: { color: colours.inkSoft, fontSize: 10, lineHeight: 16, textAlign: 'center', margin: 20 },
});
