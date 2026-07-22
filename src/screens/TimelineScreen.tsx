import { useState } from 'react';
import { Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import Svg, { Circle, Path } from 'react-native-svg';
import { DesktopUsagePanel } from '../components/DesktopUsagePanel';
import { TimelineEventCard } from '../components/TimelineEventCard';
import { LocationSegmentRecord, ObservationOrigin } from '../data/contracts';
import { DayPlace, DayRecord, DesktopUsageSummary, DigitalActivityCategory, TimelineEvent } from '../domain/types';
import { KnownPlaceClusteringResult } from '../reconstruction/knownPlaceEngine';
import { projectLocationSegments, projectedPath } from '../reconstruction/locationMapProjection';
import { groupApplicationsForDisplay } from '../reconstruction/digitalActivityPresentation';
import { colours, radius, shadow } from '../theme';

type PeriodScale = 'day' | 'week' | 'month';

const placeColour: Record<DayPlace['kind'], string> = {
  home: '#6B6789', work: colours.moss, food: colours.coral, exercise: '#A45E42', other: colours.blue,
};

interface Props {
  days: DayRecord[];
  selectedDay: DayRecord;
  locationSegments: LocationSegmentRecord[];
  knownPlaceClustering: KnownPlaceClusteringResult;
  onSelectDay: (dayId: string) => void;
  onOpenEvent: (event: TimelineEvent) => void;
}

function PeriodPicker({ value, onChange }: { value: PeriodScale; onChange: (value: PeriodScale) => void }) {
  return (
    <View style={styles.periodPicker}>
      {(['day', 'week', 'month'] as PeriodScale[]).map((period) => (
        <Pressable
          key={period}
          accessibilityRole="button"
          accessibilityState={{ selected: value === period }}
          onPress={() => onChange(period)}
          style={[styles.periodButton, value === period && styles.periodButtonSelected]}
        >
          <Text style={[styles.periodText, value === period && styles.periodTextSelected]}>{period[0].toUpperCase() + period.slice(1)}</Text>
        </Pressable>
      ))}
    </View>
  );
}

const clusterColours = ['#6B6789', colours.moss, colours.coral, '#A45E42', colours.blue];
const emptyKnownPlaceClustering: KnownPlaceClusteringResult = { places: [], assignments: [] };

function RouteMap({ day, segments, knownPlaceClustering }: { day: DayRecord; segments: LocationSegmentRecord[]; knownPlaceClustering: KnownPlaceClusteringResult }) {
  const projected = projectLocationSegments(segments, 360, 300, 48);
  const hasReconstruction = projected.length > 0;
  const desktopOnly = isDesktopOnlyDay(day) && !hasReconstruction;
  const hasNoLocationEvidence = !hasReconstruction && day.places.length === 0;
  const assignmentBySegment = new Map(knownPlaceClustering.assignments.map((assignment) => [assignment.segmentId, assignment.placeId]));
  const placeIndexById = new Map(knownPlaceClustering.places.map((place, index) => [place.id, index]));
  const reconstructedDistance = segments.filter((segment) => segment.kind === 'journey').reduce((total, segment) => total + segment.distanceMetres, 0);
  const stopCount = new Set(segments.filter((segment) => segment.kind === 'stay').map((segment) => assignmentBySegment.get(segment.id) ?? segment.id)).size;
  const origin = segmentOrigin(segments);
  if (hasNoLocationEvidence) {
    return (
      <View style={styles.noLocationCard}>
        <View style={styles.noLocationIcon}><Text style={styles.noLocationIconText}>D</Text></View>
        <Text style={styles.noLocationEyebrow}>{desktopOnly ? 'DESKTOP DAY IS LIVE' : 'SOURCE NOT CONNECTED'}</Text>
        <Text style={styles.noLocationTitle}>Location isn’t connected here.</Text>
        <Text style={styles.noLocationBody}>{desktopOnly ? 'ATIRA can still reconstruct computer activity while the phone’s place and movement layers remain absent.' : 'This day has no location evidence. ATIRA will not draw a route or report zero travel without a connected phone collector.'}</Text>
      </View>
    );
  }
  return (
    <View style={styles.mapCard}>
      <Svg width="100%" height="100%" viewBox="0 0 360 300">
        <Path d="M-20 42 C82 80 158 44 380 15" stroke="#EEF1EA" strokeWidth="17" fill="none" />
        <Path d="M-15 206 C98 168 210 181 380 236" stroke="#EEF1EA" strokeWidth="15" fill="none" />
        <Path d="M78 -20 C103 72 97 170 135 325" stroke="#EEF1EA" strokeWidth="13" fill="none" />
        <Path d="M338 -10 C311 82 310 174 350 318" stroke="#E7ECE5" strokeWidth="8" fill="none" />
        {hasReconstruction ? projected.filter((item) => item.segment.kind !== 'stay').map((item) => (
          <Path
            key={item.segment.id}
            d={projectedPath(item.points)}
            stroke={item.segment.kind === 'coverage_gap' ? colours.amber : colours.blue}
            strokeWidth={item.segment.kind === 'coverage_gap' ? 7 : 6}
            strokeLinecap="round"
            strokeLinejoin="round"
            strokeDasharray={item.segment.kind === 'coverage_gap' ? '8 7' : undefined}
            fill="none"
          />
        )) : (
          <>
            <Path d={day.routePath} stroke={colours.blue} strokeWidth="6" strokeLinecap="round" strokeLinejoin="round" fill="none" />
            {day.inferredRoutePath ? <Path d={day.inferredRoutePath} stroke={colours.amber} strokeWidth="7" strokeLinecap="round" strokeDasharray="8 7" fill="none" /> : null}
          </>
        )}
        {hasReconstruction ? projected.filter((item) => item.segment.kind === 'stay' && item.center).map((item) => {
          const placeId = assignmentBySegment.get(item.segment.id);
          const colourIndex = placeId ? placeIndexById.get(placeId) ?? 0 : 0;
          return <Circle key={item.segment.id} cx={item.center?.x} cy={item.center?.y} r="9" fill={clusterColours[colourIndex % clusterColours.length]} stroke={colours.white} strokeWidth="4" />;
        }) : day.places.map((place) => (
          <Circle key={place.id} cx={place.x} cy={place.y} r="9" fill={placeColour[place.kind]} stroke={colours.white} strokeWidth="4" />
        ))}
      </Svg>
      <View style={styles.mapTopRow}>
        <View style={styles.mapMetric}><Text style={styles.mapMetricValue}>{hasReconstruction ? formatDistance(reconstructedDistance) : day.distance}</Text><Text style={styles.mapMetricLabel}>travelled</Text></View>
        <View style={styles.mapMetric}><Text style={styles.mapMetricValue}>{hasReconstruction ? stopCount : day.places.length - 1}</Text><Text style={styles.mapMetricLabel}>meaningful stops</Text></View>
      </View>
      <View style={styles.mapLegend}>
        <View style={styles.legendItem}><View style={[styles.legendLine, { backgroundColor: colours.blue }]} /><Text style={styles.legendText}>{hasReconstruction ? 'Measured path' : 'Illustrative demo'}</Text></View>
        {(hasReconstruction ? segments.some((segment) => segment.kind === 'coverage_gap') : day.inferredRoutePath) ? <View style={styles.legendItem}><View style={styles.legendDash} /><Text style={styles.legendText}>Coverage gap</Text></View> : null}
      </View>
      <View style={[styles.mapOrigin, origin === 'real' && styles.mapOriginReal]}><Text style={styles.mapOriginText}>{hasReconstruction ? `${origin.toUpperCase()} RECONSTRUCTION` : 'FIXTURE MAP'}</Text></View>
    </View>
  );
}

function DayView({ day, segments, knownPlaceClustering, onOpenEvent }: { day: DayRecord; segments: LocationSegmentRecord[]; knownPlaceClustering: KnownPlaceClusteringResult; onOpenEvent: (event: TimelineEvent) => void }) {
  const desktopUsages = day.desktopUsages ?? [];
  const applicationCount = desktopUsages.reduce(
    (total, usage) => total + groupApplicationsForDisplay(usage.applications).length,
    0,
  );
  const meaningfulEvents = day.events.filter((event) => !event.evidence.some((item) => item.source === 'desktop'));
  const confirmed = meaningfulEvents.filter((event) => ['confirmed', 'corrected'].includes(event.state)).length;
  const desktopOnly = isDesktopOnlyDay(day);
  const assignmentBySegment = new Map(knownPlaceClustering.assignments.map((assignment) => [assignment.segmentId, assignment.placeId]));
  const placeById = new Map(knownPlaceClustering.places.map((place) => [place.id, place]));
  const reconstructedPlaces = [...new Set(segments
    .filter((segment) => segment.kind === 'stay')
    .map((segment) => assignmentBySegment.get(segment.id))
    .filter((id): id is string => id != null))]
    .map((id) => placeById.get(id))
    .filter((place): place is NonNullable<typeof place> => place != null);
  return (
    <>
      <RouteMap day={day} segments={segments} knownPlaceClustering={knownPlaceClustering} />
      {day.places.length > 0 || reconstructedPlaces.length > 0 ? <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.placeChips}>
        {reconstructedPlaces.length > 0 ? reconstructedPlaces.map((place) => (
          <View key={place.id} style={styles.placeChip}>
            <View style={[styles.placeDot, { backgroundColor: clusterColours[knownPlaceClustering.places.indexOf(place) % clusterColours.length] }]} />
            <View><Text style={styles.placeTitle}>{place.label}</Text><Text style={styles.placeDetail}>{place.visitCount} {place.visitCount === 1 ? 'visit' : 'visits'} across {place.dayCount} {place.dayCount === 1 ? 'day' : 'days'}</Text></View>
          </View>
        )) : day.places.map((place, index) => (
          <View key={`${place.id}-${index}`} style={styles.placeChip}>
            <View style={[styles.placeDot, { backgroundColor: placeColour[place.kind] }]} />
            <View><Text style={styles.placeTitle}>{place.title}</Text><Text style={styles.placeDetail}>{place.detail}</Text></View>
          </View>
        ))}
      </ScrollView> : null}

      {desktopOnly ? (
        <View style={styles.desktopReconstructionStrip}>
          <Text style={styles.desktopReconstructionKicker}>REAL DESKTOP LAYER</Text>
          <Text style={styles.reconstructionText}>{applicationCount} intentional application{applicationCount === 1 ? '' : 's'} across {desktopUsages.length} device{desktopUsages.length === 1 ? '' : 's'} · refreshes automatically while the companion runs</Text>
        </View>
      ) : null}

      {segments.length > 0 ? (
        <View style={styles.reconstructionStrip}>
          <Text style={styles.reconstructionKicker}>LOCATION LAYER</Text>
          <Text style={styles.reconstructionText}>{segments.length} reconstructed segments · {segmentOrigin(segments)} evidence · anonymous place clusters</Text>
        </View>
      ) : null}

      {segments.length > 0 ? <LocationSegmentTimeline segments={segments} knownPlaceClustering={knownPlaceClustering} /> : null}

      <View style={styles.daySummary}>
        <View style={styles.coverageBlock}><Text style={styles.coverageValue}>{day.coverage}%</Text><Text style={styles.coverageLabel}>{desktopOnly ? 'desktop coverage' : 'understood'}</Text></View>
        <View style={styles.summaryDivider} />
        <View style={styles.summaryStat}><Text style={styles.summaryValue}>{day.work}</Text><Text style={styles.summaryLabel}>Work</Text></View>
        <View style={styles.summaryStat}><Text style={styles.summaryValue}>{day.movement}</Text><Text style={styles.summaryLabel}>Movement</Text></View>
        <View style={styles.summaryStat}><Text style={styles.summaryValue}>{day.learning}</Text><Text style={styles.summaryLabel}>Learning</Text></View>
      </View>

      {desktopUsages.some((usage) => usage.totalSeconds > 0) ? <DeviceUsageSection usages={desktopUsages} /> : null}

      {meaningfulEvents.length > 0 ? (
        <>
          <View style={styles.sectionHeader}>
            <View><Text style={styles.sectionTitle}>Meaningful moments</Text><Text style={styles.sectionSubtitle}>{confirmed} confirmed · {meaningfulEvents.length} interpretations worth reviewing</Text></View>
            <Text style={styles.live}>INTERPRETED EVENTS</Text>
          </View>
          {meaningfulEvents.map((event) => <TimelineEventCard key={event.id} event={event} onPress={() => onOpenEvent(event)} />)}
        </>
      ) : null}
    </>
  );
}

function DeviceUsageSection({ usages }: { usages: DesktopUsageSummary[] }) {
  const [selectedDeviceId, setSelectedDeviceId] = useState(usages[0]?.deviceId ?? '');
  const selected = usages.find((usage) => usage.deviceId === selectedDeviceId) ?? usages[0];
  if (!selected) return null;
  return (
    <View>
      {usages.length > 1 ? (
        <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.devicePicker}>
          {usages.map((usage) => {
            const active = usage.deviceId === selected.deviceId;
            return (
              <Pressable
                key={usage.deviceId}
                accessibilityRole="button"
                accessibilityState={{ selected: active }}
                onPress={() => setSelectedDeviceId(usage.deviceId)}
                style={[styles.deviceButton, active && styles.deviceButtonActive]}
              >
                <Text style={[styles.deviceButtonText, active && styles.deviceButtonTextActive]}>{usage.deviceLabel}</Text>
              </Pressable>
            );
          })}
        </ScrollView>
      ) : null}
      <DesktopUsagePanel usage={selected} />
    </View>
  );
}

function LocationSegmentTimeline({ segments, knownPlaceClustering }: { segments: LocationSegmentRecord[]; knownPlaceClustering: KnownPlaceClusteringResult }) {
  const assignmentBySegment = new Map(knownPlaceClustering.assignments.map((assignment) => [assignment.segmentId, assignment.placeId]));
  const placeById = new Map(knownPlaceClustering.places.map((place) => [place.id, place]));
  return (
    <View style={styles.locationTimeline}>
      <View style={styles.locationTimelineHeader}>
        <Text style={styles.locationTimelineTitle}>What location reconstructed</Text>
        <Text style={styles.locationTimelineCount}>{segments.length} SEGMENTS</Text>
      </View>
      {segments.map((segment, index) => {
        const place = placeById.get(assignmentBySegment.get(segment.id) ?? '');
        const title = segment.kind === 'stay'
          ? place?.label ?? 'Unclustered stay'
          : segment.kind === 'coverage_gap'
            ? 'Missing coverage'
            : `${travelModeLabel(segment.mode)} journey`;
        const detail = segment.kind === 'stay'
          ? `${formatMinutes(segment.durationMinutes)} in one area · ${segment.sampleCount} samples`
          : segment.kind === 'coverage_gap'
            ? `${formatMinutes(segment.durationMinutes)} without measurements · straight line is not counted as travel`
            : `${formatDistance(segment.distanceMetres)} · ${formatMinutes(segment.durationMinutes)} · ${segment.sampleCount} samples`;
        return (
          <View key={segment.id} style={[styles.locationSegmentRow, index === segments.length - 1 && styles.locationSegmentRowLast]}>
            <View style={[styles.locationSegmentMark, segment.kind === 'coverage_gap' && styles.locationSegmentMarkGap]} />
            <View style={styles.locationSegmentTime}><Text style={styles.locationSegmentTimeText}>{formatClock(segment.startedAt)}</Text><Text style={styles.locationSegmentTimeEnd}>{formatClock(segment.endedAt)}</Text></View>
            <View style={styles.locationSegmentCopy}><Text style={styles.locationSegmentTitle}>{title}</Text><Text style={styles.locationSegmentDetail}>{detail}</Text></View>
            <Text style={styles.locationSegmentConfidence}>{Math.round(segment.confidence * 100)}%</Text>
          </View>
        );
      })}
    </View>
  );
}

function WeekView({ days, selectedDay, onSelectDay, onSwitchToDay }: { days: DayRecord[]; selectedDay: DayRecord; onSelectDay: (id: string) => void; onSwitchToDay: () => void }) {
  const selectedDate = parseDayId(selectedDay.id);
  const slots = Array.from({ length: 7 }, (_, index) => {
    const date = new Date(selectedDate);
    date.setDate(date.getDate() - (6 - index));
    const id = localDateId(date);
    return { id, date, day: days.find((item) => item.id === id) };
  });
  const observed = slots.filter((slot) => desktopSeconds(slot.day) > 0);
  const totalSeconds = observed.reduce((total, slot) => total + desktopSeconds(slot.day), 0);
  const totals = aggregateCategories(observed.flatMap((slot) => slot.day?.desktopUsages ?? []));
  return (
    <>
      <View style={styles.weekHero}>
        <Text style={styles.heroEyebrow}>{formatDateRange(slots[0].date, slots[6].date).toUpperCase()}</Text>
        <Text style={styles.heroTitle}>{observed.length === 0 ? 'Waiting for this week to become visible.' : 'A factual week in progress.'}</Text>
        <Text style={styles.heroBody}>{observed.length} of 7 days contain desktop evidence · {formatSeconds(totalSeconds)} observed. Missing days are not treated as zero.</Text>
        <View style={styles.weekBars}>
          {slots.map((slot) => (
            <Pressable key={slot.id} disabled={!slot.day} onPress={() => { if (slot.day) onSelectDay(slot.day.id); onSwitchToDay(); }} style={styles.weekBarColumn}>
              <View style={styles.weekBarTrack}><View style={[styles.weekBarFill, desktopSeconds(slot.day) === 0 && { backgroundColor: '#CBC5BB' }, { height: `${desktopSeconds(slot.day) > 0 ? Math.max(7, slot.day?.coverage ?? 0) : 2}%` }]} /></View>
              <Text style={styles.weekBarDay}>{slot.date.toLocaleDateString([], { weekday: 'short' })[0]}</Text>
              <Text style={styles.weekBarNumber}>{slot.date.getDate()}</Text>
            </Pressable>
          ))}
        </View>
      </View>

      <Text style={styles.sectionTitleStandalone}>Observed digital composition</Text>
      <View style={styles.compositionCard}>
        {totals.length > 0 && <View style={styles.stackedBar}>{totals.map((item) => <View key={item.category} style={{ flex: item.durationSeconds, backgroundColor: categoryColour[item.category] }} />)}</View>}
        {totals.length === 0 ? <Text style={styles.heroBody}>No complete desktop sessions in this period.</Text> : totals.map((item) => (
          <View key={item.category} style={styles.compositionRow}>
            <View style={[styles.compositionDot, { backgroundColor: categoryColour[item.category] }]} />
            <Text style={styles.compositionLabel}>{labelCategory(item.category)}</Text>
            <Text style={styles.compositionValue}>{formatSeconds(item.durationSeconds)}</Text>
          </View>
        ))}
      </View>

      <Text style={styles.sectionTitleStandalone}>Interpretation</Text>
      <View style={styles.signalCard}><Text style={styles.signalIcon}>·</Text><View style={styles.signalCopy}><Text style={styles.signalTitle}>Facts only for now</Text><Text style={styles.signalBody}>Use Patterns to compare sufficiently covered periods. The timeline will not manufacture a weekly story from one source and a short history.</Text></View></View>
    </>
  );
}

function MonthView({ days, selectedDay }: { days: DayRecord[]; selectedDay: DayRecord }) {
  const selectedDate = parseDayId(selectedDay.id);
  const year = selectedDate.getFullYear();
  const month = selectedDate.getMonth();
  const dayCount = new Date(year, month + 1, 0).getDate();
  const monthDays = days.filter((day) => { const date = parseDayId(day.id); return date.getFullYear() === year && date.getMonth() === month; });
  const maximum = Math.max(...monthDays.map((day) => desktopSeconds(day)), 1);
  const cells = Array.from({ length: dayCount }, (_, index) => {
    const dayNumber = index + 1;
    const record = monthDays.find((day) => Number(day.dayNumber) === dayNumber);
    return { day: dayNumber, observed: desktopSeconds(record) > 0, intensity: desktopSeconds(record) / maximum };
  });
  const spacerCount = (new Date(year, month, 1).getDay() + 6) % 7;
  const totalSeconds = monthDays.reduce((total, day) => total + desktopSeconds(day), 0);
  const observedCount = monthDays.filter((day) => desktopSeconds(day) > 0).length;
  return (
    <>
      <View style={styles.monthHero}>
        <Text style={styles.heroEyebrowDark}>{selectedDate.toLocaleDateString([], { month: 'long', year: 'numeric' }).toUpperCase()}</Text>
        <Text style={styles.monthTitle}>{observedCount > 0 ? 'A month becoming visible.' : 'This month has no digital evidence yet.'}</Text>
        <Text style={styles.monthBody}>{observedCount} observed days · missing evidence is not inactivity</Text>
        <View style={styles.monthStats}><View><Text style={styles.monthStatValue}>{formatSeconds(totalSeconds)}</Text><Text style={styles.monthStatLabel}>observed desktop</Text></View><View><Text style={styles.monthStatValue}>{observedCount}</Text><Text style={styles.monthStatLabel}>observed days</Text></View><View><Text style={styles.monthStatValue}>0</Text><Text style={styles.monthStatLabel}>forced stories</Text></View></View>
      </View>

      <Text style={styles.sectionTitleStandalone}>Daily desktop coverage</Text>
      <View style={styles.calendarCard}>
        <View style={styles.calendarLabels}>{['M', 'T', 'W', 'T', 'F', 'S', 'S'].map((label, index) => <Text key={`${label}-${index}`} style={styles.calendarLabel}>{label}</Text>)}</View>
        <View style={styles.calendarGrid}>
          {Array.from({ length: spacerCount }, (_, index) => <View key={`spacer-${index}`} style={styles.calendarSpacer} />)}
          {cells.map((cell) => <View key={cell.day} style={[styles.calendarCell, { backgroundColor: cell.observed ? `rgba(23,107,91,${Math.max(0.18, cell.intensity)})` : '#E8E3DA' }]}><Text style={[styles.calendarNumber, cell.intensity > 0.6 && styles.calendarNumberLight]}>{cell.day}</Text></View>)}
        </View>
        <Text style={styles.calendarNote}>Colour reflects observed desktop duration only. Grey means missing evidence, not inactivity or a poor day.</Text>
      </View>

      <Text style={styles.sectionTitleStandalone}>The month’s story</Text>
      <View style={styles.monthStory}><Text style={styles.monthStoryKicker}>LEARNING STATE</Text><Text style={styles.monthStoryTitle}>No story is being forced onto the data.</Text><Text style={styles.monthStoryBody}>Patterns promotes a statement only after comparable coverage or repeated longitudinal evidence meets the maturity rules.</Text></View>
    </>
  );
}

export function TimelineScreen({ days, selectedDay, locationSegments = [], knownPlaceClustering = emptyKnownPlaceClustering, onSelectDay, onOpenEvent }: Props) {
  const [period, setPeriod] = useState<PeriodScale>('day');
  const selectedSegments = locationSegments.filter((segment) => segment.dayId === selectedDay.id);
  return (
    <ScrollView showsVerticalScrollIndicator={false} contentInsetAdjustmentBehavior="automatic" contentContainerStyle={styles.content}>
      <View style={styles.headerRow}>
        <View><Text style={styles.eyebrow}>YOUR TIMELINE</Text><Text style={styles.title}>{period === 'day' ? `${relativeLabelForDay(selectedDay)}.` : period === 'week' ? 'This week.' : 'This month.'}</Text></View>
        <View style={styles.avatar}><Text style={styles.avatarText}>A</Text></View>
      </View>
      <PeriodPicker value={period} onChange={setPeriod} />

      {period === 'day' ? (
        <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.dateStrip}>
          {days.map((day) => {
            const selected = day.id === selectedDay.id;
            return (
              <Pressable
                key={day.id}
                accessibilityRole="button"
                accessibilityLabel={`${day.weekday} ${day.dayNumber} ${day.month}, ${relativeLabelForDay(day)}`}
                accessibilityState={{ selected }}
                onPress={() => onSelectDay(day.id)}
                style={[styles.dateItem, selected && styles.dateItemSelected]}
              >
                <Text style={[styles.dateWeekday, selected && styles.dateTextSelected]}>{day.weekday}</Text>
                <Text style={[styles.dateNumber, selected && styles.dateTextSelected]}>{day.dayNumber}</Text>
              </Pressable>
            );
          })}
        </ScrollView>
      ) : null}

      {period === 'day' ? <DayView day={selectedDay} segments={selectedSegments} knownPlaceClustering={knownPlaceClustering} onOpenEvent={onOpenEvent} /> : null}
      {period === 'week' ? <WeekView days={days} selectedDay={selectedDay} onSelectDay={onSelectDay} onSwitchToDay={() => setPeriod('day')} /> : null}
      {period === 'month' ? <MonthView days={days} selectedDay={selectedDay} /> : null}
    </ScrollView>
  );
}

function segmentOrigin(segments: LocationSegmentRecord[]): ObservationOrigin | 'unknown' {
  const origins = new Set(segments.map((segment) => segment.origin).filter(Boolean));
  if (origins.size === 0) return 'unknown';
  if (origins.size === 1) return [...origins][0] as ObservationOrigin;
  return 'mixed';
}

function isDesktopOnlyDay(day: DayRecord) {
  return day.places.length === 0 && Boolean(day.desktopUsages?.some((usage) => usage.totalSeconds > 0));
}

function relativeLabelForDay(day: DayRecord) {
  const [year, month, date] = day.id.split('-').map(Number);
  const selected = new Date(year, month - 1, date, 12);
  const now = new Date();
  const today = new Date(now.getFullYear(), now.getMonth(), now.getDate(), 12);
  const difference = Math.round((today.getTime() - selected.getTime()) / 86_400_000);
  if (difference === 0) return 'Today';
  if (difference === 1) return 'Yesterday';
  if (difference > 1 && difference < 7) return `${difference} days ago`;
  return selected.toLocaleDateString([], { day: 'numeric', month: 'short' });
}

const categoryColour: Record<DigitalActivityCategory, string> = {
  creation: colours.moss,
  communication: colours.coral,
  learning: '#596FA5',
  entertainment: '#8A641E',
  browser: colours.blue,
  ai_assistance: '#6B6789',
  other: colours.inkSoft,
};

function desktopSeconds(day?: DayRecord) {
  return day?.desktopUsages?.reduce((total, usage) => total + usage.totalSeconds, 0) ?? 0;
}

function aggregateCategories(usages: DesktopUsageSummary[]) {
  const totals = new Map<DigitalActivityCategory, number>();
  for (const usage of usages) for (const application of usage.applications) totals.set(application.category, (totals.get(application.category) ?? 0) + application.durationSeconds);
  return [...totals.entries()].map(([category, durationSeconds]) => ({ category, durationSeconds })).sort((a, b) => b.durationSeconds - a.durationSeconds);
}

function parseDayId(dayId: string) {
  const [year, month, day] = dayId.split('-').map(Number);
  return new Date(year, month - 1, day, 12);
}

function localDateId(date: Date) {
  return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}-${String(date.getDate()).padStart(2, '0')}`;
}

function formatDateRange(start: Date, end: Date) {
  return `${start.toLocaleDateString([], { day: 'numeric', month: 'short' })}–${end.toLocaleDateString([], { day: 'numeric', month: 'short' })}`;
}

function formatSeconds(seconds: number) {
  if (seconds <= 0) return '0m';
  const hours = Math.floor(seconds / 3600);
  const minutes = Math.round((seconds % 3600) / 60);
  return hours > 0 ? `${hours}h ${minutes}m` : `${Math.max(1, minutes)}m`;
}

function labelCategory(category: DigitalActivityCategory) {
  return category.replace('_', ' ').replace(/^./, (letter) => letter.toUpperCase());
}

function formatDistance(distanceMetres: number) {
  return distanceMetres >= 1000 ? `${(distanceMetres / 1000).toFixed(1)} km` : `${Math.round(distanceMetres)} m`;
}

function formatMinutes(minutes: number) {
  if (minutes < 60) return `${Math.round(minutes)}m`;
  const hours = Math.floor(minutes / 60);
  const remaining = Math.round(minutes % 60);
  return `${hours}h${remaining > 0 ? ` ${remaining}m` : ''}`;
}

function formatClock(timestamp: string) {
  return new Date(timestamp).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', hour12: false });
}

function travelModeLabel(mode: LocationSegmentRecord['mode']) {
  if (mode === 'fast_transit') return 'Fast transit';
  if (mode === 'road') return 'Road';
  if (mode === 'cycling') return 'Cycling';
  if (mode === 'walking') return 'Walking';
  return 'Unclassified';
}

const styles = StyleSheet.create({
  content: { paddingHorizontal: 18, paddingTop: 16, paddingBottom: 112 },
  devicePicker: { gap: 8, paddingTop: 20, paddingBottom: 2 },
  deviceButton: { borderRadius: radius.pill, borderWidth: 1, borderColor: colours.line, backgroundColor: colours.surface, paddingHorizontal: 13, paddingVertical: 8 },
  deviceButtonActive: { borderColor: colours.ink, backgroundColor: colours.ink },
  deviceButtonText: { color: colours.inkSoft, fontSize: 9, fontWeight: '800' },
  deviceButtonTextActive: { color: colours.white },
  headerRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
  eyebrow: { color: colours.moss, fontSize: 10, fontWeight: '900', letterSpacing: 1.2 },
  title: { color: colours.ink, fontSize: 29, lineHeight: 34, fontWeight: '900', letterSpacing: -0.9, marginTop: 4 },
  avatar: { width: 41, height: 41, borderRadius: 21, backgroundColor: colours.ink, alignItems: 'center', justifyContent: 'center' },
  avatarText: { color: colours.white, fontSize: 15, fontWeight: '900' },
  periodPicker: { flexDirection: 'row', backgroundColor: colours.surfaceMuted, borderRadius: radius.medium, padding: 4, marginTop: 17 },
  periodButton: { flex: 1, minHeight: 37, alignItems: 'center', justifyContent: 'center', borderRadius: 12 },
  periodButtonSelected: { backgroundColor: colours.ink },
  periodText: { color: colours.inkSoft, fontSize: 11, fontWeight: '800' },
  periodTextSelected: { color: colours.white },
  dateStrip: { flexDirection: 'row', gap: 5, marginTop: 14, marginBottom: 13, paddingRight: 4 },
  dateItem: { width: 43, minHeight: 58, borderRadius: 15, alignItems: 'center', justifyContent: 'center' },
  dateItemSelected: { backgroundColor: colours.coral },
  dateWeekday: { color: colours.inkSoft, fontSize: 9, fontWeight: '800' },
  dateNumber: { color: colours.ink, fontSize: 16, fontWeight: '900', marginTop: 4 },
  dateTextSelected: { color: colours.white },
  mapCard: { height: 300, backgroundColor: '#DCE4DC', borderRadius: radius.large, overflow: 'hidden', position: 'relative', ...shadow },
  noLocationCard: { minHeight: 180, backgroundColor: colours.blueSoft, borderRadius: radius.large, padding: 20, justifyContent: 'center', borderWidth: 1, borderColor: '#CFD9E9', ...shadow },
  noLocationIcon: { width: 38, height: 38, borderRadius: 13, backgroundColor: colours.blue, alignItems: 'center', justifyContent: 'center' },
  noLocationIconText: { color: colours.white, fontSize: 15, fontWeight: '900' },
  noLocationEyebrow: { color: colours.blue, fontSize: 8, fontWeight: '900', letterSpacing: 0.9, marginTop: 14 },
  noLocationTitle: { color: colours.ink, fontSize: 19, fontWeight: '900', marginTop: 5 },
  noLocationBody: { color: colours.inkSoft, fontSize: 10, lineHeight: 16, marginTop: 6, maxWidth: 330 },
  mapTopRow: { position: 'absolute', top: 13, left: 13, right: 13, flexDirection: 'row', justifyContent: 'space-between' },
  mapMetric: { backgroundColor: 'rgba(255,253,248,0.92)', borderRadius: 12, paddingHorizontal: 11, paddingVertical: 8 },
  mapMetricValue: { color: colours.ink, fontSize: 12, fontWeight: '900' },
  mapMetricLabel: { color: colours.inkSoft, fontSize: 8, marginTop: 2 },
  mapLegend: { position: 'absolute', left: 12, bottom: 12, flexDirection: 'row', gap: 7 },
  mapOrigin: { position: 'absolute', right: 12, bottom: 12, backgroundColor: colours.amberSoft, borderRadius: radius.pill, paddingHorizontal: 9, paddingVertical: 7 },
  mapOriginReal: { backgroundColor: colours.mossSoft },
  mapOriginText: { color: colours.ink, fontSize: 7, fontWeight: '900', letterSpacing: 0.4 },
  legendItem: { flexDirection: 'row', alignItems: 'center', backgroundColor: 'rgba(23,34,31,0.9)', paddingHorizontal: 9, paddingVertical: 7, borderRadius: radius.pill },
  legendLine: { width: 15, height: 3, borderRadius: 2, marginRight: 5 },
  legendDash: { width: 15, height: 3, borderTopWidth: 2, borderStyle: 'dashed', borderColor: colours.amber, marginRight: 5 },
  legendText: { color: colours.white, fontSize: 8, fontWeight: '800' },
  placeChips: { gap: 7, paddingVertical: 10 },
  placeChip: { minWidth: 120, backgroundColor: colours.surface, borderRadius: 14, padding: 10, flexDirection: 'row', alignItems: 'center', borderWidth: 1, borderColor: colours.line },
  placeDot: { width: 9, height: 9, borderRadius: 5, marginRight: 8 },
  placeTitle: { color: colours.ink, fontSize: 11, fontWeight: '900' },
  placeDetail: { color: colours.inkSoft, fontSize: 8, marginTop: 2 },
  reconstructionStrip: { backgroundColor: colours.mossSoft, borderRadius: radius.medium, paddingHorizontal: 13, paddingVertical: 11, marginBottom: 10 },
  reconstructionKicker: { color: colours.moss, fontSize: 7, fontWeight: '900', letterSpacing: 0.8 },
  reconstructionText: { color: colours.ink, fontSize: 9, lineHeight: 14, marginTop: 3 },
  desktopReconstructionStrip: { backgroundColor: colours.blueSoft, borderRadius: radius.medium, paddingHorizontal: 13, paddingVertical: 11, marginBottom: 10 },
  desktopReconstructionKicker: { color: colours.blue, fontSize: 7, fontWeight: '900', letterSpacing: 0.8 },
  locationTimeline: { backgroundColor: colours.surface, borderRadius: radius.large, borderWidth: 1, borderColor: colours.line, paddingHorizontal: 14, marginBottom: 10 },
  locationTimelineHeader: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingVertical: 13, borderBottomWidth: 1, borderBottomColor: '#EEEAE3' },
  locationTimelineTitle: { color: colours.ink, fontSize: 12, fontWeight: '900' },
  locationTimelineCount: { color: colours.moss, fontSize: 7, fontWeight: '900', letterSpacing: 0.6 },
  locationSegmentRow: { minHeight: 62, flexDirection: 'row', alignItems: 'center', borderBottomWidth: 1, borderBottomColor: '#EEEAE3' },
  locationSegmentRowLast: { borderBottomWidth: 0 },
  locationSegmentMark: { width: 7, height: 24, borderRadius: 4, backgroundColor: colours.blue, marginRight: 9 },
  locationSegmentMarkGap: { backgroundColor: colours.amber },
  locationSegmentTime: { width: 42 },
  locationSegmentTimeText: { color: colours.ink, fontSize: 9, fontWeight: '900' },
  locationSegmentTimeEnd: { color: colours.inkSoft, fontSize: 7, marginTop: 3 },
  locationSegmentCopy: { flex: 1, paddingRight: 7 },
  locationSegmentTitle: { color: colours.ink, fontSize: 10, fontWeight: '900' },
  locationSegmentDetail: { color: colours.inkSoft, fontSize: 8, lineHeight: 12, marginTop: 3 },
  locationSegmentConfidence: { color: colours.inkSoft, fontSize: 8, fontWeight: '900' },
  daySummary: { backgroundColor: colours.ink, borderRadius: radius.large, padding: 16, flexDirection: 'row', alignItems: 'center' },
  coverageBlock: { width: 72 },
  coverageValue: { color: colours.white, fontSize: 20, fontWeight: '900' },
  coverageLabel: { color: '#91A09A', fontSize: 8, marginTop: 2 },
  summaryDivider: { width: 1, height: 35, backgroundColor: '#3A4642', marginRight: 11 },
  summaryStat: { flex: 1 },
  summaryValue: { color: colours.white, fontSize: 12, fontWeight: '900' },
  summaryLabel: { color: '#91A09A', fontSize: 8, marginTop: 3 },
  sectionHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'flex-end', marginTop: 25, marginBottom: 12 },
  sectionTitle: { color: colours.ink, fontSize: 20, fontWeight: '900', letterSpacing: -0.5 },
  sectionSubtitle: { color: colours.inkSoft, fontSize: 9, marginTop: 3 },
  live: { color: colours.moss, fontSize: 8, fontWeight: '900', letterSpacing: 0.6 },
  sectionTitleStandalone: { color: colours.ink, fontSize: 20, fontWeight: '900', letterSpacing: -0.5, marginTop: 27, marginBottom: 12 },
  weekHero: { backgroundColor: colours.ink, borderRadius: radius.large, padding: 20, marginTop: 16 },
  heroEyebrow: { color: '#91A09A', fontSize: 9, fontWeight: '900', letterSpacing: 1 },
  heroTitle: { color: colours.white, fontSize: 23, fontWeight: '900', letterSpacing: -0.5, marginTop: 7 },
  heroBody: { color: '#B9C3BF', fontSize: 11, lineHeight: 17, marginTop: 5 },
  weekBars: { height: 126, flexDirection: 'row', alignItems: 'flex-end', marginTop: 17 },
  weekBarColumn: { flex: 1, alignItems: 'center' },
  weekBarTrack: { height: 82, width: 17, borderRadius: 9, backgroundColor: '#30403B', overflow: 'hidden', justifyContent: 'flex-end' },
  weekBarFill: { width: '100%', backgroundColor: colours.coral, borderRadius: 9 },
  weekBarDay: { color: colours.white, fontSize: 9, fontWeight: '900', marginTop: 7 },
  weekBarNumber: { color: '#7F8D88', fontSize: 8, marginTop: 2 },
  compositionCard: { backgroundColor: colours.surface, borderRadius: radius.large, padding: 18, borderWidth: 1, borderColor: colours.line },
  stackedBar: { height: 13, borderRadius: 7, overflow: 'hidden', flexDirection: 'row', marginBottom: 15 },
  compositionRow: { flexDirection: 'row', alignItems: 'center', paddingVertical: 7 },
  compositionDot: { width: 8, height: 8, borderRadius: 4, marginRight: 9 },
  compositionLabel: { flex: 1, color: colours.ink, fontSize: 12, fontWeight: '700' },
  compositionValue: { color: colours.inkSoft, fontSize: 11, fontWeight: '800' },
  signalCard: { backgroundColor: colours.surface, borderRadius: radius.medium, padding: 15, flexDirection: 'row', marginBottom: 9, borderWidth: 1, borderColor: '#E7E0D6' },
  signalIcon: { color: colours.moss, fontSize: 17, width: 31, fontWeight: '900' },
  signalCopy: { flex: 1 },
  signalTitle: { color: colours.ink, fontSize: 13, fontWeight: '900' },
  signalBody: { color: colours.inkSoft, fontSize: 11, lineHeight: 17, marginTop: 4 },
  monthHero: { backgroundColor: colours.coral, borderRadius: radius.large, padding: 20, marginTop: 16 },
  heroEyebrowDark: { color: '#7A3525', fontSize: 9, fontWeight: '900', letterSpacing: 1 },
  monthTitle: { color: colours.white, fontSize: 23, fontWeight: '900', letterSpacing: -0.5, marginTop: 7 },
  monthBody: { color: '#FFE8E1', fontSize: 11, marginTop: 5 },
  monthStats: { flexDirection: 'row', justifyContent: 'space-between', marginTop: 20, paddingTop: 16, borderTopWidth: 1, borderTopColor: 'rgba(122,53,37,0.24)' },
  monthStatValue: { color: colours.white, fontSize: 17, fontWeight: '900' },
  monthStatLabel: { color: '#FFE8E1', fontSize: 8, marginTop: 2 },
  calendarCard: { backgroundColor: colours.surface, borderRadius: radius.large, padding: 16, borderWidth: 1, borderColor: colours.line },
  calendarLabels: { flexDirection: 'row', justifyContent: 'space-around', marginBottom: 8 },
  calendarLabel: { width: '13.5%', textAlign: 'center', color: colours.inkSoft, fontSize: 9, fontWeight: '900' },
  calendarGrid: { flexDirection: 'row', flexWrap: 'wrap', gap: '1%' },
  calendarSpacer: { width: '13.42%', aspectRatio: 1 },
  calendarCell: { width: '13.42%', aspectRatio: 1, borderRadius: 9, alignItems: 'center', justifyContent: 'center', marginBottom: 4 },
  calendarNumber: { color: colours.ink, fontSize: 10, fontWeight: '800' },
  calendarNumberLight: { color: colours.white },
  calendarNote: { color: colours.inkSoft, fontSize: 9, lineHeight: 14, marginTop: 10, textAlign: 'center' },
  monthStory: { backgroundColor: colours.mossSoft, borderRadius: radius.large, padding: 18 },
  monthStoryKicker: { color: colours.moss, fontSize: 8, fontWeight: '900', letterSpacing: 1 },
  monthStoryTitle: { color: colours.ink, fontSize: 17, lineHeight: 22, fontWeight: '900', marginTop: 7 },
  monthStoryBody: { color: colours.inkSoft, fontSize: 11, lineHeight: 17, marginTop: 6 },
});
