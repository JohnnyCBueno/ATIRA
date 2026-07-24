import { useEffect, useMemo, useState } from 'react';
import { Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import Svg, { Circle, Path } from 'react-native-svg';
import { LocationSegmentKind, LocationSegmentRecord, ObservationOrigin } from '../data/contracts';
import { DayPlace, DayRecord } from '../domain/types';
import { KnownPlaceClusteringResult } from '../reconstruction/knownPlaceEngine';
import {
  focusViewportOnSegment,
  MAP_HEIGHT,
  MAP_WIDTH,
  overviewViewport,
  panViewport,
  viewBoxForViewport,
  zoomViewport,
} from '../reconstruction/locationMapInteraction';
import { projectLocationSegments, projectedPath } from '../reconstruction/locationMapProjection';
import {
  formatClock,
  locationSegmentDetail,
  locationSegmentTitle,
} from '../reconstruction/locationSegmentPresentation';
import { colours, radius, shadow } from '../theme';

type MapFilter = 'all' | LocationSegmentKind;

const clusterColours = ['#6B6789', colours.moss, colours.coral, '#A45E42', colours.blue];
const placeColour: Record<DayPlace['kind'], string> = {
  home: '#6B6789', work: colours.moss, food: colours.coral, exercise: '#A45E42', other: colours.blue,
};
const filters: Array<{ id: MapFilter; label: string }> = [
  { id: 'all', label: 'All evidence' },
  { id: 'journey', label: 'Journeys' },
  { id: 'stay', label: 'Stays' },
  { id: 'coverage_gap', label: 'Gaps' },
];

interface Props {
  day: DayRecord;
  segments: LocationSegmentRecord[];
  knownPlaceClustering: KnownPlaceClusteringResult;
  selectedSegmentId: string | null;
  onSelectSegment: (segmentId: string | null) => void;
}

export function InteractiveRouteMap({
  day,
  segments,
  knownPlaceClustering,
  selectedSegmentId,
  onSelectSegment,
}: Props) {
  const [filter, setFilter] = useState<MapFilter>('all');
  const [viewport, setViewport] = useState(overviewViewport);
  const projected = useMemo(() => projectLocationSegments(segments, MAP_WIDTH, MAP_HEIGHT, 48), [segments]);
  const hasReconstruction = projected.length > 0;
  const hasNoLocationEvidence = !hasReconstruction && day.places.length === 0;
  const assignmentBySegment = useMemo(
    () => new Map(knownPlaceClustering.assignments.map((assignment) => [assignment.segmentId, assignment.placeId])),
    [knownPlaceClustering.assignments],
  );
  const placeById = useMemo(
    () => new Map(knownPlaceClustering.places.map((place) => [place.id, place])),
    [knownPlaceClustering.places],
  );
  const placeIndexById = useMemo(
    () => new Map(knownPlaceClustering.places.map((place, index) => [place.id, index])),
    [knownPlaceClustering.places],
  );
  const visibleProjected = filter === 'all' ? projected : projected.filter((item) => item.segment.kind === filter);
  const selectedProjected = projected.find((item) => item.segment.id === selectedSegmentId);
  const selectedSegment = selectedProjected?.segment;
  const reconstructedDistance = segments
    .filter((segment) => segment.kind === 'journey')
    .reduce((total, segment) => total + segment.distanceMetres, 0);
  const stopCount = new Set(
    segments
      .filter((segment) => segment.kind === 'stay')
      .map((segment) => assignmentBySegment.get(segment.id) ?? segment.id),
  ).size;
  const origin = segmentOrigin(segments);
  const box = viewBoxForViewport(viewport);
  const viewBox = `${box.x} ${box.y} ${box.width} ${box.height}`;

  useEffect(() => {
    setFilter('all');
    setViewport(overviewViewport);
  }, [day.id]);

  useEffect(() => {
    if (selectedProjected) setViewport(focusViewportOnSegment(selectedProjected));
  }, [selectedProjected]);

  const selectSegment = (segmentId: string) => {
    onSelectSegment(segmentId === selectedSegmentId ? null : segmentId);
  };

  if (hasNoLocationEvidence) {
    const desktopOnly = isDesktopOnlyDay(day);
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
    <View>
      <View style={styles.mapCard}>
        <Svg width="100%" height="100%" viewBox={viewBox}>
          <Path d="M-20 42 C82 80 158 44 380 15" stroke="#EEF1EA" strokeWidth="17" fill="none" />
          <Path d="M-15 206 C98 168 210 181 380 236" stroke="#EEF1EA" strokeWidth="15" fill="none" />
          <Path d="M78 -20 C103 72 97 170 135 325" stroke="#EEF1EA" strokeWidth="13" fill="none" />
          <Path d="M338 -10 C311 82 310 174 350 318" stroke="#E7ECE5" strokeWidth="8" fill="none" />
          {hasReconstruction ? visibleProjected.filter((item) => item.segment.kind !== 'stay').map((item) => {
            const selected = item.segment.id === selectedSegmentId;
            const path = projectedPath(item.points);
            const stroke = item.segment.kind === 'coverage_gap' ? colours.amber : colours.blue;
            return (
              <Path
                key={item.segment.id}
                d={path}
                stroke={stroke}
                strokeWidth={selected ? 10 : item.segment.kind === 'coverage_gap' ? 7 : 6}
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeDasharray={item.segment.kind === 'coverage_gap' ? '8 7' : undefined}
                opacity={selectedSegmentId && !selected ? 0.35 : 1}
                fill="none"
              />
            );
          }) : (
            <>
              <Path d={day.routePath} stroke={colours.blue} strokeWidth="6" strokeLinecap="round" strokeLinejoin="round" fill="none" />
              {day.inferredRoutePath ? <Path d={day.inferredRoutePath} stroke={colours.amber} strokeWidth="7" strokeLinecap="round" strokeDasharray="8 7" fill="none" /> : null}
            </>
          )}
          {hasReconstruction ? visibleProjected.filter((item) => item.segment.kind === 'stay' && item.center).map((item) => {
            const placeId = assignmentBySegment.get(item.segment.id);
            const colourIndex = placeId ? placeIndexById.get(placeId) ?? 0 : 0;
            const selected = item.segment.id === selectedSegmentId;
            return (
              <Circle
                key={item.segment.id}
                cx={item.center?.x}
                cy={item.center?.y}
                r={selected ? 14 : 9}
                fill={clusterColours[colourIndex % clusterColours.length]}
                stroke={selected ? colours.ink : colours.white}
                strokeWidth={selected ? 5 : 4}
                opacity={selectedSegmentId && !selected ? 0.4 : 1}
              />
            );
          }) : day.places.map((place) => (
            <Circle key={place.id} cx={place.x} cy={place.y} r="9" fill={placeColour[place.kind]} stroke={colours.white} strokeWidth="4" />
          ))}
        </Svg>
        {hasReconstruction ? visibleProjected.map((item) => {
          const target = mapHitTarget(item.center ?? item.points[Math.floor(item.points.length / 2)], box);
          if (!target) return null;
          const placeLabel = placeById.get(assignmentBySegment.get(item.segment.id) ?? '')?.label;
          return (
            <Pressable
              key={`map-target-${item.segment.id}`}
              accessibilityRole="button"
              accessibilityLabel={`Inspect ${locationSegmentTitle(item.segment, placeLabel)} on map`}
              onPress={() => selectSegment(item.segment.id)}
              style={[styles.mapHitTarget, { left: `${target.left}%`, top: `${target.top}%` }]}
            />
          );
        }) : null}
        <View style={styles.mapTopRow}>
          <View style={styles.mapMetric}><Text style={styles.mapMetricValue}>{hasReconstruction ? formatDistance(reconstructedDistance) : day.distance}</Text><Text style={styles.mapMetricLabel}>travelled</Text></View>
          <View style={styles.mapMetric}><Text style={styles.mapMetricValue}>{hasReconstruction ? stopCount : Math.max(0, day.places.length - 1)}</Text><Text style={styles.mapMetricLabel}>meaningful stops</Text></View>
        </View>
        <View style={styles.mapLegend}>
          <View style={styles.legendItem}><View style={[styles.legendLine, { backgroundColor: colours.blue }]} /><Text style={styles.legendText}>{hasReconstruction ? 'Measured path' : 'Illustrative demo'}</Text></View>
          {(hasReconstruction ? segments.some((segment) => segment.kind === 'coverage_gap') : day.inferredRoutePath) ? <View style={styles.legendItem}><View style={styles.legendDash} /><Text style={styles.legendText}>Coverage gap</Text></View> : null}
        </View>
        <View style={[styles.mapOrigin, origin === 'real' && styles.mapOriginReal]}><Text style={styles.mapOriginText}>{hasReconstruction ? `${origin.toUpperCase()} RECONSTRUCTION` : 'FIXTURE MAP'}</Text></View>
      </View>

      {hasReconstruction ? (
        <>
          <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.filterRow}>
            {filters.map((item) => {
              const selected = filter === item.id;
              const count = item.id === 'all' ? segments.length : segments.filter((segment) => segment.kind === item.id).length;
              return (
                <Pressable
                  key={item.id}
                  accessibilityRole="button"
                  accessibilityState={{ selected }}
                  onPress={() => {
                    setFilter(item.id);
                    setViewport(overviewViewport);
                    if (selectedSegment && item.id !== 'all' && selectedSegment.kind !== item.id) onSelectSegment(null);
                  }}
                  style={[styles.filterButton, selected && styles.filterButtonSelected]}
                >
                  <Text style={[styles.filterText, selected && styles.filterTextSelected]}>{item.label}</Text>
                  <Text style={[styles.filterCount, selected && styles.filterTextSelected]}>{count}</Text>
                </Pressable>
              );
            })}
          </ScrollView>

          <View style={styles.mapControls}>
            <Pressable accessibilityRole="button" accessibilityLabel="Reset map to overview" onPress={() => { setViewport(overviewViewport); onSelectSegment(null); }} style={[styles.controlButton, styles.overviewButton]}><Text style={styles.overviewText}>Overview</Text></Pressable>
            <Pressable accessibilityRole="button" accessibilityLabel="Pan map left" onPress={() => setViewport((current) => panViewport(current, -1, 0))} style={styles.controlButton}><Text style={styles.controlText}>←</Text></Pressable>
            <Pressable accessibilityRole="button" accessibilityLabel="Pan map up" onPress={() => setViewport((current) => panViewport(current, 0, -1))} style={styles.controlButton}><Text style={styles.controlText}>↑</Text></Pressable>
            <Pressable accessibilityRole="button" accessibilityLabel="Pan map down" onPress={() => setViewport((current) => panViewport(current, 0, 1))} style={styles.controlButton}><Text style={styles.controlText}>↓</Text></Pressable>
            <Pressable accessibilityRole="button" accessibilityLabel="Pan map right" onPress={() => setViewport((current) => panViewport(current, 1, 0))} style={styles.controlButton}><Text style={styles.controlText}>→</Text></Pressable>
            <Pressable accessibilityRole="button" accessibilityLabel="Zoom map out" onPress={() => setViewport((current) => zoomViewport(current, -0.5))} style={styles.controlButton}><Text style={styles.controlText}>−</Text></Pressable>
            <Pressable accessibilityRole="button" accessibilityLabel="Zoom map in" onPress={() => setViewport((current) => zoomViewport(current, 0.5))} style={styles.controlButton}><Text style={styles.controlText}>＋</Text></Pressable>
          </View>

          {selectedSegment ? (
            <View style={styles.selectionCard}>
              <View style={[styles.selectionMark, selectedSegment.kind === 'coverage_gap' && styles.selectionMarkGap]} />
              <View style={styles.selectionCopy}>
                <Text style={styles.selectionEyebrow}>{formatClock(selectedSegment.startedAt)}–{formatClock(selectedSegment.endedAt)} · {Math.round(selectedSegment.confidence * 100)}% confidence</Text>
                <Text style={styles.selectionTitle}>{locationSegmentTitle(selectedSegment, placeById.get(assignmentBySegment.get(selectedSegment.id) ?? '')?.label)}</Text>
                <Text style={styles.selectionDetail}>{locationSegmentDetail(selectedSegment)}</Text>
              </View>
              <Pressable accessibilityRole="button" accessibilityLabel="Close selected segment" onPress={() => onSelectSegment(null)} style={styles.closeButton}><Text style={styles.closeText}>×</Text></Pressable>
            </View>
          ) : (
            <Text style={styles.interactionHint}>Select a route, stay, gap, or timeline row to inspect its evidence. Coordinates remain hidden.</Text>
          )}
        </>
      ) : null}
    </View>
  );
}

function segmentOrigin(segments: LocationSegmentRecord[]): ObservationOrigin | 'unknown' {
  const origins = new Set(segments.map((segment) => segment.origin).filter(Boolean));
  if (origins.size === 0) return 'unknown';
  if (origins.size === 1) return [...origins][0] as ObservationOrigin;
  return 'mixed';
}

function isDesktopOnlyDay(day: DayRecord) {
  return Boolean(day.desktopUsages?.some((usage) => usage.totalSeconds > 0))
    && day.places.length === 0
    && day.events.every((event) => event.evidence.some((item) => item.source === 'desktop'));
}

function formatDistance(distanceMetres: number) {
  return distanceMetres >= 1000 ? `${(distanceMetres / 1000).toFixed(1)} km` : `${Math.round(distanceMetres)} m`;
}

function mapHitTarget(
  point: { x: number; y: number } | undefined,
  box: { x: number; y: number; width: number; height: number },
) {
  if (
    !point ||
    point.x < box.x || point.x > box.x + box.width ||
    point.y < box.y || point.y > box.y + box.height
  ) return null;
  return {
    left: ((point.x - box.x) / box.width) * 100,
    top: ((point.y - box.y) / box.height) * 100,
  };
}

const styles = StyleSheet.create({
  mapCard: { height: 300, backgroundColor: '#DCE4DC', borderRadius: radius.large, overflow: 'hidden', position: 'relative', ...shadow },
  mapHitTarget: { position: 'absolute', width: 34, height: 34, marginLeft: -17, marginTop: -17, borderRadius: 17 },
  noLocationCard: { minHeight: 180, backgroundColor: colours.blueSoft, borderRadius: radius.large, padding: 20, justifyContent: 'center', borderWidth: 1, borderColor: '#CFD9E9', ...shadow },
  noLocationIcon: { width: 38, height: 38, borderRadius: 13, backgroundColor: colours.blue, alignItems: 'center', justifyContent: 'center' },
  noLocationIconText: { color: colours.white, fontSize: 15, fontWeight: '900' },
  noLocationEyebrow: { color: colours.blue, fontSize: 8, fontWeight: '900', letterSpacing: 0.9, marginTop: 14 },
  noLocationTitle: { color: colours.ink, fontSize: 19, fontWeight: '900', marginTop: 5 },
  noLocationBody: { color: colours.inkSoft, fontSize: 10, lineHeight: 16, marginTop: 6, maxWidth: 330 },
  mapTopRow: { position: 'absolute', top: 13, left: 13, right: 13, flexDirection: 'row', justifyContent: 'space-between', pointerEvents: 'none' },
  mapMetric: { backgroundColor: 'rgba(255,253,248,0.94)', borderRadius: 12, paddingHorizontal: 11, paddingVertical: 8 },
  mapMetricValue: { color: colours.ink, fontSize: 12, fontWeight: '900' },
  mapMetricLabel: { color: colours.inkSoft, fontSize: 8, marginTop: 2 },
  mapLegend: { position: 'absolute', left: 12, bottom: 12, flexDirection: 'row', gap: 7, pointerEvents: 'none' },
  mapOrigin: { position: 'absolute', right: 12, top: 62, backgroundColor: colours.amberSoft, borderRadius: radius.pill, paddingHorizontal: 9, paddingVertical: 7, pointerEvents: 'none' },
  mapOriginReal: { backgroundColor: colours.mossSoft },
  mapOriginText: { color: colours.ink, fontSize: 7, fontWeight: '900', letterSpacing: 0.4 },
  legendItem: { flexDirection: 'row', alignItems: 'center', backgroundColor: 'rgba(23,34,31,0.9)', paddingHorizontal: 9, paddingVertical: 7, borderRadius: radius.pill },
  legendLine: { width: 15, height: 3, borderRadius: 2, marginRight: 5 },
  legendDash: { width: 15, height: 3, borderTopWidth: 2, borderStyle: 'dashed', borderColor: colours.amber, marginRight: 5 },
  legendText: { color: colours.white, fontSize: 8, fontWeight: '800' },
  filterRow: { gap: 7, paddingTop: 10, paddingBottom: 8 },
  filterButton: { minHeight: 34, flexDirection: 'row', alignItems: 'center', gap: 7, paddingHorizontal: 11, borderRadius: radius.pill, borderWidth: 1, borderColor: colours.line, backgroundColor: colours.surface },
  filterButtonSelected: { backgroundColor: colours.ink, borderColor: colours.ink },
  filterText: { color: colours.inkSoft, fontSize: 9, fontWeight: '900' },
  filterTextSelected: { color: colours.white },
  filterCount: { color: colours.moss, fontSize: 8, fontWeight: '900' },
  mapControls: { flexDirection: 'row', alignItems: 'center', gap: 5, marginBottom: 8 },
  controlButton: { width: 34, height: 34, borderRadius: 11, borderWidth: 1, borderColor: colours.line, backgroundColor: colours.surface, alignItems: 'center', justifyContent: 'center' },
  overviewButton: { width: 76, paddingHorizontal: 10 },
  overviewText: { color: colours.ink, fontSize: 8, fontWeight: '900' },
  controlText: { color: colours.ink, fontSize: 15, fontWeight: '900' },
  selectionCard: { minHeight: 84, flexDirection: 'row', alignItems: 'center', backgroundColor: colours.surface, borderRadius: radius.medium, borderWidth: 1, borderColor: colours.line, padding: 12, marginBottom: 10 },
  selectionMark: { width: 7, height: 42, borderRadius: 4, backgroundColor: colours.blue, marginRight: 11 },
  selectionMarkGap: { backgroundColor: colours.amber },
  selectionCopy: { flex: 1, paddingRight: 8 },
  selectionEyebrow: { color: colours.moss, fontSize: 7, fontWeight: '900', letterSpacing: 0.5 },
  selectionTitle: { color: colours.ink, fontSize: 13, fontWeight: '900', marginTop: 3 },
  selectionDetail: { color: colours.inkSoft, fontSize: 9, lineHeight: 13, marginTop: 3 },
  closeButton: { width: 32, height: 32, borderRadius: 16, backgroundColor: colours.surfaceMuted, alignItems: 'center', justifyContent: 'center' },
  closeText: { color: colours.ink, fontSize: 18, lineHeight: 20 },
  interactionHint: { color: colours.inkSoft, fontSize: 8, lineHeight: 13, marginBottom: 10 },
});
