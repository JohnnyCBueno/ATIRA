import { useMemo, useState } from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import { DesktopUsageApplication, DesktopUsageSummary, DigitalActivityCategory } from '../domain/types';
import { colours, radius } from '../theme';
import { buildDisplayTwoHourBuckets, groupApplicationsForDisplay } from '../reconstruction/digitalActivityPresentation';

const categoryMeta: Record<DigitalActivityCategory, { label: string; colour: string; soft: string }> = {
  creation: { label: 'Creation', colour: colours.moss, soft: colours.mossSoft },
  communication: { label: 'Communication', colour: colours.coral, soft: '#FCE5DD' },
  learning: { label: 'Learning', colour: '#6B6789', soft: '#E8E5F0' },
  entertainment: { label: 'Entertainment', colour: '#B85C74', soft: '#F8E4E9' },
  browser: { label: 'Browser · context unknown', colour: colours.blue, soft: colours.blueSoft },
  ai_assistance: { label: 'AI assistance · context unknown', colour: colours.amber, soft: colours.amberSoft },
  other: { label: 'Other', colour: '#7D8985', soft: colours.surfaceMuted },
};

interface Props {
  usage: DesktopUsageSummary;
}

export function DesktopUsagePanel({ usage }: Props) {
  const [expandedApplicationId, setExpandedApplicationId] = useState<string | null>(null);
  const displayApplications = useMemo(() => groupApplicationsForDisplay(usage.applications), [usage.applications]);
  const visibleApplications = useMemo(() => displayApplications.map((item) => item.application), [displayApplications]);
  const buckets = useMemo(() => buildDisplayTwoHourBuckets(visibleApplications), [visibleApplications]);
  const maxBucketSeconds = Math.max(1, ...buckets.map((bucket) => bucket.totalSeconds));
  const categoryTotals = useMemo(() => aggregateCategories(visibleApplications), [visibleApplications]);
  const maximumApplicationSeconds = Math.max(1, ...displayApplications.map((item) => item.application.durationSeconds));
  const visibleTotalSeconds = visibleApplications.reduce((total, application) => total + application.durationSeconds, 0);

  return (
    <View>
      <View style={styles.headerRow}>
        <View>
          <Text style={styles.eyebrow}>DIGITAL ACTIVITY · {usage.platform.toUpperCase()}</Text>
          <Text style={styles.total}>{formatDuration(visibleTotalSeconds)}</Text>
          <Text style={styles.totalLabel}>explained foreground use</Text>
        </View>
        <View style={styles.deviceIdentity}>
          <Text style={styles.deviceIdentityKicker}>DEVICE</Text>
          <Text style={styles.deviceIdentityLabel}>{usage.deviceLabel}</Text>
          <Text style={styles.deviceIdentityRule}>Meaningful use · 1m+</Text>
        </View>
      </View>

      <View style={styles.chartCard}>
        <View style={styles.chartLegend}>
          {categoryTotals.slice(0, 4).map((item) => (
            <View key={item.category} style={styles.legendItem}>
              <View style={[styles.legendDot, { backgroundColor: categoryMeta[item.category].colour }]} />
              <Text style={styles.legendLabel}>{categoryMeta[item.category].label.split(' · ')[0]}</Text>
              <Text style={styles.legendValue}>{formatDuration(item.durationSeconds)}</Text>
            </View>
          ))}
        </View>
        <View style={styles.chartPlot}>
          {buckets.map((bucket) => {
            const height = Math.max(bucket.totalSeconds > 0 ? 4 : 1, Math.round((bucket.totalSeconds / maxBucketSeconds) * 100));
            return (
              <View key={bucket.startHour} style={styles.barColumn}>
                <View style={styles.barTrack}>
                  <View style={[styles.barStack, { height: `${height}%` }]}>
                    {bucket.categories.map((segment) => (
                      <View
                        key={segment.category}
                        style={{ flex: segment.durationSeconds, backgroundColor: categoryMeta[segment.category].colour }}
                      />
                    ))}
                  </View>
                </View>
                <Text style={styles.hourLabel}>{String(bucket.startHour).padStart(2, '0')}</Text>
              </View>
            );
          })}
        </View>
        <View style={styles.chartCaptionRow}><Text style={styles.chartCaption}>Foreground use across the day</Text><Text style={styles.chartCaption}>2-hour blocks</Text></View>
      </View>

      <View style={styles.listHeader}>
        <View><Text style={styles.listTitle}>Most used</Text><Text style={styles.listSubtitle}>{displayApplications.length} intentional application{displayApplications.length === 1 ? '' : 's'} detected</Text></View>
        <Text style={styles.listHint}>SELECT FOR TIMES</Text>
      </View>
      <View style={styles.appList}>
        {displayApplications.map(({ application, browserSites }, index) => {
          const expanded = application.applicationId === expandedApplicationId;
          return (
            <View key={application.applicationId}>
              <ApplicationRow
                application={application}
                maximumSeconds={maximumApplicationSeconds}
                expanded={expanded}
                isLast={index === displayApplications.length - 1}
                detail={browserSites.length > 0 ? `Browser · ${browserSites.length} active site${browserSites.length === 1 ? '' : 's'} · ${formatDuration(browserSites.reduce((total, site) => total + site.durationSeconds, 0))} classified` : undefined}
                onPress={() => setExpandedApplicationId(expanded ? null : application.applicationId)}
              />
              {expanded ? browserSites.length > 0
                ? <BrowserBreakdown browserName={application.applicationName} sites={browserSites} />
                : <ApplicationSessions application={application} /> : null}
            </View>
          );
        })}
      </View>
      <Text style={styles.auditNote}>Shorter than one minute, ATIRA itself, Electron, idle time and lock-screen time stay out of this audit. They remain local evidence only when they may help a later multi-source inference.</Text>
    </View>
  );
}

function ApplicationRow({ application, maximumSeconds, expanded, isLast, detail, onPress }: {
  application: DesktopUsageApplication;
  maximumSeconds: number;
  expanded: boolean;
  isLast: boolean;
  detail?: string;
  onPress: () => void;
}) {
  const meta = categoryMeta[application.category];
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityState={{ expanded }}
      accessibilityLabel={`${application.applicationName}, ${formatDuration(application.durationSeconds)}`}
      onPress={onPress}
      style={({ pressed }) => [styles.appRow, isLast && !expanded && styles.appRowLast, pressed && styles.appRowPressed]}
    >
      <View style={[styles.appIcon, { backgroundColor: meta.soft }]}><Text style={[styles.appIconText, { color: meta.colour }]}>{application.applicationName[0]}</Text></View>
      <View style={styles.appCopy}>
        <View style={styles.appNameRow}><Text style={styles.appName}>{application.applicationName}</Text><Text style={styles.appDuration}>{formatDuration(application.durationSeconds)}</Text></View>
        <Text style={styles.appCategory}>{detail ?? `${meta.label.split(' · ')[0]} · ${application.purpose === 'unknown' ? 'context unknown' : application.purpose} · ${application.classificationProvenance === 'user_rule' ? 'your rule' : 'ATIRA default'}`}</Text>
        <View style={styles.appBarTrack}><View style={[styles.appBarFill, { width: `${Math.max(3, Math.round((application.durationSeconds / maximumSeconds) * 100))}%`, backgroundColor: meta.colour }]} /></View>
      </View>
      <Text style={styles.chevron}>{expanded ? '⌃' : '›'}</Text>
    </Pressable>
  );
}

function BrowserBreakdown({ browserName, sites }: { browserName: string; sites: DesktopUsageApplication[] }) {
  const [expandedId, setExpandedId] = useState<string | null>(null);
  const items = [...sites].sort((a, b) => b.durationSeconds - a.durationSeconds);
  return (
    <View style={styles.browserBreakdown}>
      <Text style={styles.sessionsHeading}>WHERE YOUR {browserName.toUpperCase()} TIME WENT</Text>
      {items.map((item) => {
        const expanded = expandedId === item.applicationId;
        const meta = categoryMeta[item.category];
        return (
          <View key={item.applicationId}>
            <Pressable accessibilityRole="button" accessibilityState={{ expanded }} accessibilityLabel={`${item.applicationName}, ${formatDuration(item.durationSeconds)}`} onPress={() => setExpandedId(expanded ? null : item.applicationId)} style={({ pressed }) => [styles.domainRow, pressed && styles.appRowPressed]}>
              <View style={[styles.domainIcon, { backgroundColor: meta.soft }]}><Text style={[styles.domainIconText, { color: meta.colour }]}>{item.applicationName[0]}</Text></View>
              <View style={styles.domainCopy}><Text style={styles.domainName}>{item.applicationName}</Text><Text style={styles.domainCategory}>{item.applicationId.endsWith(':unclassified') ? `Active ${browserName} without domain context` : `${meta.label.split(' · ')[0]} · ${item.purpose === 'unknown' ? 'context unknown' : item.purpose}`}</Text></View>
              <Text style={styles.domainDuration}>{formatDuration(item.durationSeconds)}</Text>
              <Text style={styles.domainChevron}>{expanded ? '⌃' : '›'}</Text>
            </Pressable>
            {expanded ? <ApplicationSessions application={item} /> : null}
          </View>
        );
      })}
    </View>
  );
}

function ApplicationSessions({ application }: { application: DesktopUsageApplication }) {
  return (
    <View style={styles.sessions}>
      <Text style={styles.sessionsHeading}>WHEN YOU USED IT</Text>
      {application.sessions.map((session) => (
        <View key={session.id} style={styles.sessionRow}>
          <View style={[styles.sessionDot, { backgroundColor: categoryMeta[application.category].colour }]} />
          <Text style={styles.sessionTime}>{formatClock(session.startedAt)}–{formatClock(session.endedAt)}</Text>
          <View style={styles.sessionLine} />
          <Text style={styles.sessionDuration}>{formatDuration(session.durationSeconds)}</Text>
        </View>
      ))}
    </View>
  );
}

function aggregateCategories(applications: DesktopUsageApplication[]) {
  const totals = new Map<DigitalActivityCategory, number>();
  for (const application of applications) totals.set(application.category, (totals.get(application.category) ?? 0) + application.durationSeconds);
  return [...totals.entries()]
    .map(([category, durationSeconds]) => ({ category, durationSeconds }))
    .sort((a, b) => b.durationSeconds - a.durationSeconds);
}

function formatDuration(seconds: number) {
  const minutes = Math.max(1, Math.round(seconds / 60));
  if (minutes < 60) return `${minutes}m`;
  const hours = Math.floor(minutes / 60);
  const remainder = minutes % 60;
  return `${hours}h${remainder > 0 ? ` ${remainder}m` : ''}`;
}

function formatClock(timestamp: string) {
  return new Date(timestamp).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', hour12: false });
}

const styles = StyleSheet.create({
  headerRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'flex-end', marginTop: 27, marginBottom: 12 },
  eyebrow: { color: colours.moss, fontSize: 8, fontWeight: '900', letterSpacing: 1.1 },
  total: { color: colours.ink, fontSize: 28, lineHeight: 32, fontWeight: '900', letterSpacing: -0.7, marginTop: 4 },
  totalLabel: { color: colours.inkSoft, fontSize: 9, marginTop: 2 },
  deviceIdentity: { maxWidth: 155, alignItems: 'flex-end', backgroundColor: colours.mossSoft, borderRadius: radius.medium, paddingHorizontal: 11, paddingVertical: 8 },
  deviceIdentityKicker: { color: colours.moss, fontSize: 6, fontWeight: '900', letterSpacing: 0.8 },
  deviceIdentityLabel: { color: colours.ink, fontSize: 10, fontWeight: '900', marginTop: 2 },
  deviceIdentityRule: { color: colours.inkSoft, fontSize: 7, marginTop: 2 },
  chartCard: { backgroundColor: colours.surface, borderRadius: radius.large, borderWidth: 1, borderColor: colours.line, padding: 16 },
  chartLegend: { flexDirection: 'row', flexWrap: 'wrap', gap: 12, minHeight: 26 },
  legendItem: { flexDirection: 'row', alignItems: 'center' },
  legendDot: { width: 7, height: 7, borderRadius: 4, marginRight: 5 },
  legendLabel: { color: colours.inkSoft, fontSize: 8, fontWeight: '700', marginRight: 5 },
  legendValue: { color: colours.ink, fontSize: 8, fontWeight: '900' },
  chartPlot: { height: 142, flexDirection: 'row', alignItems: 'flex-end', gap: 5, borderBottomWidth: 1, borderBottomColor: colours.line, paddingTop: 12 },
  barColumn: { flex: 1, height: '100%', justifyContent: 'flex-end', alignItems: 'center' },
  barTrack: { flex: 1, width: '65%', minWidth: 6, justifyContent: 'flex-end', overflow: 'hidden', borderRadius: 5, backgroundColor: colours.surfaceMuted },
  barStack: { width: '100%', minHeight: 1, flexDirection: 'column-reverse', borderRadius: 5, overflow: 'hidden' },
  hourLabel: { color: colours.inkSoft, fontSize: 7, fontWeight: '700', marginTop: 6, height: 10 },
  chartCaptionRow: { flexDirection: 'row', justifyContent: 'space-between', marginTop: 9 },
  chartCaption: { color: colours.inkSoft, fontSize: 8 },
  listHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'flex-end', marginTop: 24, marginBottom: 10 },
  listTitle: { color: colours.ink, fontSize: 18, fontWeight: '900', letterSpacing: -0.4 },
  listSubtitle: { color: colours.inkSoft, fontSize: 9, marginTop: 3 },
  listHint: { color: colours.moss, fontSize: 7, fontWeight: '900', letterSpacing: 0.6 },
  appList: { backgroundColor: colours.surface, borderRadius: radius.large, borderWidth: 1, borderColor: colours.line, paddingHorizontal: 14, overflow: 'hidden' },
  appRow: { minHeight: 82, flexDirection: 'row', alignItems: 'center', borderBottomWidth: 1, borderBottomColor: '#EEEAE3', paddingVertical: 12 },
  appRowLast: { borderBottomWidth: 0 },
  appRowPressed: { opacity: 0.68 },
  appIcon: { width: 40, height: 40, borderRadius: 13, alignItems: 'center', justifyContent: 'center', marginRight: 11 },
  appIconText: { fontSize: 15, fontWeight: '900' },
  appCopy: { flex: 1 },
  appNameRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
  appName: { color: colours.ink, fontSize: 12, fontWeight: '900' },
  appDuration: { color: colours.ink, fontSize: 11, fontWeight: '900' },
  appCategory: { color: colours.inkSoft, fontSize: 8, marginTop: 3 },
  appBarTrack: { height: 4, borderRadius: 2, backgroundColor: colours.surfaceMuted, overflow: 'hidden', marginTop: 8 },
  appBarFill: { height: '100%', borderRadius: 2 },
  chevron: { color: colours.inkSoft, fontSize: 20, width: 22, textAlign: 'right', marginLeft: 8 },
  sessions: { backgroundColor: '#F7F4ED', marginHorizontal: -14, paddingHorizontal: 22, paddingTop: 13, paddingBottom: 14, borderBottomWidth: 1, borderBottomColor: colours.line },
  browserBreakdown: { backgroundColor: '#F7F4ED', marginHorizontal: -14, paddingHorizontal: 18, paddingTop: 14, paddingBottom: 8, borderBottomWidth: 1, borderBottomColor: colours.line },
  domainRow: { minHeight: 58, flexDirection: 'row', alignItems: 'center', borderTopWidth: 1, borderTopColor: colours.line, paddingVertical: 9 },
  domainIcon: { width: 30, height: 30, borderRadius: 10, alignItems: 'center', justifyContent: 'center', marginRight: 10 },
  domainIconText: { fontSize: 11, fontWeight: '900' },
  domainCopy: { flex: 1 },
  domainName: { color: colours.ink, fontSize: 10, fontWeight: '900' },
  domainCategory: { color: colours.inkSoft, fontSize: 7, marginTop: 2 },
  domainDuration: { color: colours.ink, fontSize: 9, fontWeight: '900' },
  domainChevron: { color: colours.inkSoft, fontSize: 16, width: 18, textAlign: 'right', marginLeft: 6 },
  sessionsHeading: { color: colours.inkSoft, fontSize: 7, fontWeight: '900', letterSpacing: 0.8, marginBottom: 8 },
  sessionRow: { minHeight: 30, flexDirection: 'row', alignItems: 'center' },
  sessionDot: { width: 6, height: 6, borderRadius: 3, marginRight: 8 },
  sessionTime: { color: colours.ink, fontSize: 9, fontWeight: '800' },
  sessionLine: { flex: 1, height: 1, backgroundColor: colours.line, marginHorizontal: 9 },
  sessionDuration: { color: colours.inkSoft, fontSize: 9, fontWeight: '800' },
  auditNote: { color: colours.inkSoft, fontSize: 8, lineHeight: 13, marginTop: 10, paddingHorizontal: 4 },
});
