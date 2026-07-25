import { useEffect, useMemo, useState } from 'react';
import { Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { DayRouteMap } from '../components/DayRouteMap';
import { DesktopUsagePanel } from '../components/DesktopUsagePanel';
import { TimelineEventCard } from '../components/TimelineEventCard';
import {
  LocationSegmentRecord,
  ObservationOrigin,
  PlaceCandidateSetRecord,
  RawObservation,
} from '../data/contracts';
import { DayPlace, DayRecord, DesktopUsageSummary, DigitalActivityCategory, TimelineEvent } from '../domain/types';
import { KnownPlaceClusteringResult } from '../reconstruction/knownPlaceEngine';
import { groupApplicationsForDisplay } from '../reconstruction/digitalActivityPresentation';
import { formatClock, locationSegmentDetail, locationSegmentTitle } from '../reconstruction/locationSegmentPresentation';
import { normalizeObservationEvidence } from '../triangulation/evidenceNormalizer';
import { assessPlaceCandidates } from '../reconstruction/placeCandidateEngine';
import {
  dayIdsForTimelinePeriod,
  isLiveTimelinePeriod,
  TimelinePeriod,
} from '../reconstruction/timelinePeriod';
import { colours, radius, shadow } from '../theme';

type PeriodScale = TimelinePeriod;

const placeColour: Record<DayPlace['kind'], string> = {
  home: '#6B6789', work: colours.moss, food: colours.coral, exercise: '#A45E42', other: colours.blue,
};

interface Props {
  days: DayRecord[];
  selectedDay: DayRecord;
  locationSegments: LocationSegmentRecord[];
  placeCandidateSets: PlaceCandidateSetRecord[];
  observations: RawObservation[];
  knownPlaceClustering: KnownPlaceClusteringResult;
  onSelectDay: (dayId: string) => void;
  onOpenEvent: (event: TimelineEvent) => void;
  onConfirmPlaceCandidate: (segmentId: string, candidateId?: string) => Promise<void>;
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

function DayView({
  day,
  segments,
  knownPlaceClustering,
  selectedSegmentId,
  onSelectSegment,
  onOpenEvent,
  placeCandidateSets,
  onConfirmPlaceCandidate,
  normalizedEvidence,
}: {
  day: DayRecord;
  segments: LocationSegmentRecord[];
  knownPlaceClustering: KnownPlaceClusteringResult;
  selectedSegmentId: string | null;
  onSelectSegment: (segmentId: string | null) => void;
  onOpenEvent: (event: TimelineEvent) => void;
  placeCandidateSets: PlaceCandidateSetRecord[];
  onConfirmPlaceCandidate: (segmentId: string, candidateId?: string) => Promise<void>;
  normalizedEvidence: ReturnType<typeof normalizeObservationEvidence>;
}) {
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

      {segments.length > 0 ? (
        <LocationSegmentTimeline
          segments={segments}
          knownPlaceClustering={knownPlaceClustering}
          selectedSegmentId={selectedSegmentId}
          onSelectSegment={onSelectSegment}
          placeCandidateSets={placeCandidateSets}
          onConfirmPlaceCandidate={onConfirmPlaceCandidate}
          normalizedEvidence={normalizedEvidence}
        />
      ) : null}

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

function LocationSegmentTimeline({
  segments,
  knownPlaceClustering,
  selectedSegmentId,
  onSelectSegment,
  placeCandidateSets,
  onConfirmPlaceCandidate,
  normalizedEvidence,
}: {
  segments: LocationSegmentRecord[];
  knownPlaceClustering: KnownPlaceClusteringResult;
  selectedSegmentId: string | null;
  onSelectSegment: (segmentId: string | null) => void;
  placeCandidateSets: PlaceCandidateSetRecord[];
  onConfirmPlaceCandidate: (segmentId: string, candidateId?: string) => Promise<void>;
  normalizedEvidence: ReturnType<typeof normalizeObservationEvidence>;
}) {
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
        const selected = segment.id === selectedSegmentId;
        const candidateSet = placeCandidateSets.find((item) => item.segmentId === segment.id);
        return (
          <View key={segment.id}>
            <Pressable
              accessibilityRole="button"
              accessibilityState={{ selected }}
              onPress={() => onSelectSegment(selected ? null : segment.id)}
              style={[styles.locationSegmentRow, selected && styles.locationSegmentRowSelected, index === segments.length - 1 && !selected && styles.locationSegmentRowLast]}
            >
              <View style={[styles.locationSegmentMark, segment.kind === 'coverage_gap' && styles.locationSegmentMarkGap]} />
              <View style={styles.locationSegmentTime}><Text style={styles.locationSegmentTimeText}>{formatClock(segment.startedAt)}</Text><Text style={styles.locationSegmentTimeEnd}>{formatClock(segment.endedAt)}</Text></View>
              <View style={styles.locationSegmentCopy}><Text style={styles.locationSegmentTitle}>{locationSegmentTitle(segment, place?.label)}</Text><Text style={styles.locationSegmentDetail}>{locationSegmentDetail(segment)}</Text></View>
              <Text style={styles.locationSegmentConfidence}>{Math.round(segment.confidence * 100)}%</Text>
            </Pressable>
            {selected && candidateSet ? (
              <PlaceCandidateCard
                candidateSet={candidateSet}
                segment={segment}
                normalizedEvidence={normalizedEvidence}
                onConfirm={(candidateId) => onConfirmPlaceCandidate(segment.id, candidateId)}
              />
            ) : null}
          </View>
        );
      })}
    </View>
  );
}

function PlaceCandidateCard({
  candidateSet,
  segment,
  normalizedEvidence,
  onConfirm,
}: {
  candidateSet: PlaceCandidateSetRecord;
  segment: LocationSegmentRecord;
  normalizedEvidence: ReturnType<typeof normalizeObservationEvidence>;
  onConfirm: (candidateId?: string) => Promise<void>;
}) {
  const resolution = assessPlaceCandidates({
    stay: segment,
    candidates: candidateSet.candidates,
    evidence: normalizedEvidence,
  });
  const presentedCandidates = resolution.candidates.map((item) => item.candidate);
  const confirmed = candidateSet.decision?.kind === 'candidate'
    ? candidateSet.candidates.find((candidate) => candidate.id === candidateSet.decision?.candidateId)
    : undefined;
  return (
    <View style={styles.placeCandidateCard}>
      <Text style={styles.placeCandidateKicker}>APPLE MAPS POSSIBILITIES</Text>
      {confirmed ? (
        <Text style={styles.placeCandidateDecision}>Confirmed by you: {confirmed.name}</Text>
      ) : candidateSet.decision?.kind === 'somewhere_else' ? (
        <Text style={styles.placeCandidateDecision}>You marked this as somewhere else.</Text>
      ) : resolution.status === 'supported' && resolution.candidates[0] ? (
        <Text style={styles.placeCandidateDecision}>Evidence currently supports {resolution.candidates[0].candidate.name}, but you can correct it.</Text>
      ) : (
        <Text style={styles.placeCandidateIntro}>These are nearby candidates, not a claim about where you went.</Text>
      )}
      {presentedCandidates.slice(0, 4).map((candidate) => (
        <Pressable
          key={candidate.id}
          accessibilityRole="button"
          accessibilityLabel={`Confirm ${candidate.name}`}
          onPress={() => void onConfirm(candidate.id)}
          style={[
            styles.placeCandidateRow,
            candidate.id === candidateSet.decision?.candidateId && styles.placeCandidateRowConfirmed,
          ]}
        >
          <View style={styles.placeCandidateCopy}>
            <Text style={styles.placeCandidateName}>{candidate.name}</Text>
            <Text style={styles.placeCandidateMeta}>
              {candidate.distanceMetres} m away · {labelPlaceCategory(candidate.category)}
              {candidate.street ? ` · ${candidate.street}` : ''}
            </Text>
          </View>
          <Text style={styles.placeCandidateAction}>
            {candidate.id === candidateSet.decision?.candidateId ? 'CONFIRMED' : 'THAT WAS ME'}
          </Text>
        </Pressable>
      ))}
      {candidateSet.candidates.length === 0 ? (
        <Text style={styles.placeCandidateIntro}>Apple Maps did not return a named place within 180 metres.</Text>
      ) : null}
      <Pressable accessibilityRole="button" onPress={() => void onConfirm()} style={styles.somewhereElseButton}>
        <Text style={styles.somewhereElseText}>Somewhere else / none of these</Text>
      </Pressable>
    </View>
  );
}

function WeekView({ days, selectedDay, onSelectDay, onSwitchToDay }: { days: DayRecord[]; selectedDay: DayRecord; onSelectDay: (id: string) => void; onSwitchToDay: () => void }) {
  const slots = dayIdsForTimelinePeriod('week', selectedDay.id).map((id) => ({
    id,
    date: parseDayId(id),
    day: days.find((item) => item.id === id),
  }));
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

export function TimelineScreen({
  days,
  selectedDay,
  locationSegments = [],
  placeCandidateSets = [],
  observations = [],
  knownPlaceClustering = emptyKnownPlaceClustering,
  onSelectDay,
  onOpenEvent,
  onConfirmPlaceCandidate,
}: Props) {
  const [period, setPeriod] = useState<PeriodScale>('day');
  const [selectedSegmentId, setSelectedSegmentId] = useState<string | null>(null);
  const visibleDayIds = useMemo(
    () => new Set(dayIdsForTimelinePeriod(period, selectedDay.id)),
    [period, selectedDay.id],
  );
  const visibleSegments = useMemo(
    () => locationSegments.filter((segment) => visibleDayIds.has(segment.dayId)),
    [locationSegments, visibleDayIds],
  );
  const selectedSegments = useMemo(
    () => locationSegments.filter((segment) => segment.dayId === selectedDay.id),
    [locationSegments, selectedDay.id],
  );
  const normalizedEvidence = useMemo(
    () => normalizeObservationEvidence(observations),
    [observations],
  );

  useEffect(() => setSelectedSegmentId(null), [period, selectedDay.id]);

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

      <DayRouteMap
        day={selectedDay}
        period={period}
        showsLiveLocation={isLiveTimelinePeriod(period, selectedDay.id)}
        segments={visibleSegments}
        knownPlaceClustering={knownPlaceClustering}
        selectedSegmentId={selectedSegmentId}
        onSelectSegment={setSelectedSegmentId}
      />

      {period === 'day' ? (
        <DayView
          day={selectedDay}
          segments={selectedSegments}
          knownPlaceClustering={knownPlaceClustering}
          selectedSegmentId={selectedSegmentId}
          onSelectSegment={setSelectedSegmentId}
          onOpenEvent={onOpenEvent}
          placeCandidateSets={placeCandidateSets}
          onConfirmPlaceCandidate={onConfirmPlaceCandidate}
          normalizedEvidence={normalizedEvidence}
        />
      ) : null}
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

function labelPlaceCategory(category: PlaceCandidateSetRecord['candidates'][number]['category']) {
  return category === 'other' ? 'place' : category;
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
  locationSegmentRowSelected: { backgroundColor: colours.blueSoft, marginHorizontal: -8, paddingHorizontal: 8, borderRadius: 12 },
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
  placeCandidateCard: { backgroundColor: colours.blueSoft, borderRadius: 13, padding: 12, marginBottom: 10 },
  placeCandidateKicker: { color: colours.blue, fontSize: 7, fontWeight: '900', letterSpacing: 0.7 },
  placeCandidateIntro: { color: colours.inkSoft, fontSize: 9, lineHeight: 14, marginTop: 4, marginBottom: 7 },
  placeCandidateDecision: { color: colours.moss, fontSize: 10, fontWeight: '900', marginTop: 5, marginBottom: 7 },
  placeCandidateRow: { minHeight: 46, flexDirection: 'row', alignItems: 'center', borderTopWidth: 1, borderTopColor: '#D8E2EA', paddingVertical: 8 },
  placeCandidateRowConfirmed: { backgroundColor: colours.mossSoft, marginHorizontal: -6, paddingHorizontal: 6, borderRadius: 9 },
  placeCandidateCopy: { flex: 1, paddingRight: 8 },
  placeCandidateName: { color: colours.ink, fontSize: 10, fontWeight: '900' },
  placeCandidateMeta: { color: colours.inkSoft, fontSize: 8, marginTop: 2 },
  placeCandidateAction: { color: colours.blue, fontSize: 7, fontWeight: '900' },
  somewhereElseButton: { alignSelf: 'flex-start', paddingVertical: 8, paddingRight: 8 },
  somewhereElseText: { color: colours.inkSoft, fontSize: 8, fontWeight: '800', textDecorationLine: 'underline' },
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
