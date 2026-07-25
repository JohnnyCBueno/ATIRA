import * as Location from 'expo-location';
import { AppleMaps } from 'expo-maps';
import { useEffect, useMemo, useRef, useState } from 'react';
import { Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { LocationSegmentKind, ObservationOrigin } from '../data/contracts';
import { cameraForLocationSegments } from '../reconstruction/locationNativeMapPresentation';
import {
  formatClock,
  formatDistance,
  locationSegmentDetail,
  locationSegmentTitle,
} from '../reconstruction/locationSegmentPresentation';
import { colours, radius, shadow } from '../theme';
import { RouteMapProps } from './InteractiveRouteMap';

type MapFilter = 'all' | LocationSegmentKind;

const filters: Array<{ id: MapFilter; label: string }> = [
  { id: 'all', label: 'All evidence' },
  { id: 'journey', label: 'Journeys' },
  { id: 'stay', label: 'Stays' },
  { id: 'coverage_gap', label: 'Gaps' },
];

const placeColours = ['#6B6789', colours.moss, colours.coral, '#A45E42', colours.blue];

export function DayRouteMap({
  day,
  period,
  showsLiveLocation,
  segments,
  knownPlaceClustering,
  selectedSegmentId,
  onSelectSegment,
}: RouteMapProps) {
  const [filter, setFilter] = useState<MapFilter>('all');
  const [locationEnabled, setLocationEnabled] = useState(false);
  const [liveCamera, setLiveCamera] = useState<NonNullable<AppleMaps.MapProps['cameraPosition']>>();
  const mapRef = useRef<AppleMaps.MapView>(null);
  const routeCamera = useMemo(
    () => cameraForLocationSegments(segments, selectedSegmentId),
    [segments, selectedSegmentId],
  );
  const routeOverviewCamera = useMemo(() => cameraForLocationSegments(segments), [segments]);
  const camera = routeCamera ?? (showsLiveLocation ? liveCamera : undefined);
  const overviewCamera = routeOverviewCamera ?? (showsLiveLocation ? liveCamera : undefined);
  const visibleSegments = filter === 'all'
    ? segments
    : segments.filter((segment) => segment.kind === filter);
  const selectedSegment = segments.find((segment) => segment.id === selectedSegmentId);
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
  const polylines: NonNullable<AppleMaps.MapProps['polylines']> = visibleSegments
    .filter((segment) => segment.kind !== 'stay' && segment.points.length >= 2)
    .map((segment) => {
      const selected = segment.id === selectedSegmentId;
      const dimmed = selectedSegmentId != null && !selected;
      return {
        id: segment.id,
        coordinates: segment.points.map((point) => ({
          latitude: point.latitude,
          longitude: point.longitude,
        })),
        color: segment.kind === 'coverage_gap'
          ? dimmed ? 'rgba(213,156,53,0.28)' : colours.amber
          : dimmed ? 'rgba(76,116,139,0.28)' : colours.blue,
        width: selected ? 10 : segment.kind === 'coverage_gap' ? 7 : 6,
        contourStyle: AppleMaps.ContourStyle.STRAIGHT,
      };
    });
  const markers: NonNullable<AppleMaps.MapProps['markers']> = visibleSegments
    .filter((segment) => segment.kind === 'stay' && segment.center != null)
    .map((segment) => {
      const placeId = assignmentBySegment.get(segment.id);
      const place = placeById.get(placeId ?? '');
      const colourIndex = placeId ? placeIndexById.get(placeId) ?? 0 : 0;
      return {
        id: segment.id,
        coordinates: segment.center,
        title: locationSegmentTitle(segment, place?.label),
        systemImage: segment.id === selectedSegmentId ? 'mappin.circle.fill' : 'mappin.circle',
        tintColor: placeColours[colourIndex % placeColours.length],
      };
    });
  const origin = segmentOrigin(segments);
  const reconstructedDistance = segments
    .filter((segment) => segment.kind === 'journey')
    .reduce((total, segment) => total + segment.distanceMetres, 0);
  const stopCount = new Set(
    segments
      .filter((segment) => segment.kind === 'stay')
      .map((segment) => assignmentBySegment.get(segment.id) ?? segment.id),
  ).size;

  useEffect(() => {
    setFilter('all');
  }, [day.id, period]);

  useEffect(() => {
    if (camera) mapRef.current?.setCameraPosition(camera);
  }, [camera]);

  useEffect(() => {
    let mounted = true;
    if (!showsLiveLocation) {
      setLocationEnabled(false);
      setLiveCamera(undefined);
      return () => {
        mounted = false;
      };
    }
    async function locateMap() {
      try {
        const permission = await Location.getForegroundPermissionsAsync();
        if (!mounted) return;
        setLocationEnabled(permission.granted);
        if (!permission.granted || routeOverviewCamera) return;
        const location = await Location.getLastKnownPositionAsync({
          maxAge: 15 * 60 * 1000,
          requiredAccuracy: 1_000,
        }) ?? await Location.getCurrentPositionAsync({ accuracy: Location.Accuracy.Balanced });
        if (!mounted) return;
        setLiveCamera({
          coordinates: {
            latitude: location.coords.latitude,
            longitude: location.coords.longitude,
          },
          zoom: 16,
        });
      } catch {
        // The native map remains usable even when a one-time camera fix is unavailable.
      }
    }
    void locateMap();
    return () => {
      mounted = false;
    };
  }, [day.id, period, routeOverviewCamera, showsLiveLocation]);

  const selectSegment = (segmentId: string | undefined) => {
    if (!segmentId) return;
    onSelectSegment(segmentId === selectedSegmentId ? null : segmentId);
  };

  return (
    <View>
      <View style={styles.mapCard}>
        <AppleMaps.View
          ref={mapRef}
          style={styles.map}
          cameraPosition={camera}
          markers={markers}
          polylines={polylines}
          properties={{
            isMyLocationEnabled: showsLiveLocation && locationEnabled,
            mapType: AppleMaps.MapType.STANDARD,
            selectionEnabled: true,
            polylineTapThreshold: 28,
          }}
          uiSettings={{
            compassEnabled: true,
            myLocationButtonEnabled: showsLiveLocation && locationEnabled,
            scaleBarEnabled: true,
            togglePitchEnabled: false,
          }}
          onMapClick={() => onSelectSegment(null)}
          onMarkerClick={(marker) => selectSegment(marker.id)}
          onPolylineClick={(polyline) => selectSegment(polyline.id)}
        />
        <View style={styles.mapTopRow}>
          <View style={styles.mapMetric}>
            <Text style={styles.mapMetricValue}>{formatDistance(reconstructedDistance)}</Text>
            <Text style={styles.mapMetricLabel}>travelled</Text>
          </View>
          <View style={styles.mapMetric}>
            <Text style={styles.mapMetricValue}>{stopCount}</Text>
            <Text style={styles.mapMetricLabel}>meaningful stops</Text>
          </View>
        </View>
        <View style={[styles.mapOrigin, (origin === 'real' || (showsLiveLocation && locationEnabled)) && styles.mapOriginReal]}>
          <Text style={styles.mapOriginText}>{segments.length > 0 ? origin.toUpperCase() : showsLiveLocation && locationEnabled ? 'LIVE' : 'NO ROUTE YET'} · APPLE MAPS</Text>
        </View>
        <View style={styles.mapHint}>
          <Text style={styles.mapHintText}>{segments.length > 0 ? 'Tap a street or business label for Apple Maps details' : `Map ready · no ${period} route samples yet`}</Text>
        </View>
      </View>

      <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.filterRow}>
        {filters.map((item) => {
          const selected = filter === item.id;
          const count = item.id === 'all'
            ? segments.length
            : segments.filter((segment) => segment.kind === item.id).length;
          return (
            <Pressable
              key={item.id}
              accessibilityRole="button"
              accessibilityState={{ selected }}
              onPress={() => {
                setFilter(item.id);
                if (selectedSegment && item.id !== 'all' && selectedSegment.kind !== item.id) onSelectSegment(null);
                if (overviewCamera) mapRef.current?.setCameraPosition(overviewCamera);
              }}
              style={[styles.filterButton, selected && styles.filterButtonSelected]}
            >
              <Text style={[styles.filterText, selected && styles.filterTextSelected]}>{item.label}</Text>
              <Text style={[styles.filterCount, selected && styles.filterTextSelected]}>{count}</Text>
            </Pressable>
          );
        })}
      </ScrollView>

      <View style={styles.controlRow}>
        <Pressable
          accessibilityRole="button"
          accessibilityLabel={`Fit the full reconstructed ${period} on the map`}
          onPress={() => {
            onSelectSegment(null);
            if (overviewCamera) mapRef.current?.setCameraPosition(overviewCamera);
          }}
          style={styles.fitButton}
        >
          <Text style={styles.fitButtonText}>Fit full {period}</Text>
        </Pressable>
        <Text style={styles.nativeGestureHint}>Pinch, drag and rotate normally</Text>
      </View>

      {selectedSegment ? (
        <View style={styles.selectionCard}>
          <View style={[styles.selectionMark, selectedSegment.kind === 'coverage_gap' && styles.selectionMarkGap]} />
          <View style={styles.selectionCopy}>
            <Text style={styles.selectionEyebrow}>{formatClock(selectedSegment.startedAt)}–{formatClock(selectedSegment.endedAt)} · {Math.round(selectedSegment.confidence * 100)}% confidence</Text>
            <Text style={styles.selectionTitle}>{locationSegmentTitle(selectedSegment, placeById.get(assignmentBySegment.get(selectedSegment.id) ?? '')?.label)}</Text>
            <Text style={styles.selectionDetail}>{locationSegmentDetail(selectedSegment)}</Text>
          </View>
          <Pressable accessibilityRole="button" accessibilityLabel="Close selected segment" onPress={() => onSelectSegment(null)} style={styles.closeButton}>
            <Text style={styles.closeText}>×</Text>
          </Pressable>
        </View>
      ) : null}
    </View>
  );
}

function segmentOrigin(segments: RouteMapProps['segments']): ObservationOrigin | 'unknown' {
  const origins = new Set(segments.map((segment) => segment.origin).filter(Boolean));
  if (origins.size === 0) return 'unknown';
  if (origins.size === 1) return [...origins][0] as ObservationOrigin;
  return 'mixed';
}

const styles = StyleSheet.create({
  mapCard: {
    height: 320,
    backgroundColor: '#DCE4DC',
    borderRadius: radius.large,
    overflow: 'hidden',
    position: 'relative',
    ...shadow,
  },
  map: { flex: 1 },
  mapTopRow: {
    position: 'absolute',
    top: 13,
    left: 13,
    right: 13,
    flexDirection: 'row',
    justifyContent: 'space-between',
    pointerEvents: 'none',
  },
  mapMetric: {
    backgroundColor: 'rgba(255,253,248,0.94)',
    borderRadius: 12,
    paddingHorizontal: 11,
    paddingVertical: 8,
  },
  mapMetricValue: { color: colours.ink, fontSize: 12, fontWeight: '900' },
  mapMetricLabel: { color: colours.inkSoft, fontSize: 8, marginTop: 2 },
  mapOrigin: {
    position: 'absolute',
    right: 12,
    top: 62,
    backgroundColor: colours.amberSoft,
    borderRadius: radius.pill,
    paddingHorizontal: 9,
    paddingVertical: 7,
    pointerEvents: 'none',
  },
  mapOriginReal: { backgroundColor: colours.mossSoft },
  mapOriginText: { color: colours.ink, fontSize: 7, fontWeight: '900', letterSpacing: 0.4 },
  mapHint: {
    position: 'absolute',
    left: 12,
    bottom: 12,
    maxWidth: 240,
    backgroundColor: 'rgba(23,34,31,0.88)',
    borderRadius: radius.pill,
    paddingHorizontal: 10,
    paddingVertical: 7,
    pointerEvents: 'none',
  },
  mapHintText: { color: colours.white, fontSize: 8, fontWeight: '800' },
  filterRow: { gap: 7, paddingTop: 10, paddingBottom: 8 },
  filterButton: {
    minHeight: 34,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 7,
    paddingHorizontal: 11,
    borderRadius: radius.pill,
    borderWidth: 1,
    borderColor: colours.line,
    backgroundColor: colours.surface,
  },
  filterButtonSelected: { backgroundColor: colours.ink, borderColor: colours.ink },
  filterText: { color: colours.inkSoft, fontSize: 9, fontWeight: '900' },
  filterTextSelected: { color: colours.white },
  filterCount: { color: colours.moss, fontSize: 8, fontWeight: '900' },
  controlRow: { flexDirection: 'row', alignItems: 'center', gap: 10, marginBottom: 10 },
  fitButton: {
    minHeight: 34,
    borderRadius: 11,
    borderWidth: 1,
    borderColor: colours.line,
    backgroundColor: colours.surface,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 13,
  },
  fitButtonText: { color: colours.ink, fontSize: 8, fontWeight: '900' },
  nativeGestureHint: { color: colours.inkSoft, fontSize: 8, flex: 1 },
  selectionCard: {
    minHeight: 84,
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: colours.surface,
    borderRadius: radius.medium,
    borderWidth: 1,
    borderColor: colours.line,
    padding: 12,
    marginBottom: 10,
  },
  selectionMark: { width: 7, height: 42, borderRadius: 4, backgroundColor: colours.blue, marginRight: 11 },
  selectionMarkGap: { backgroundColor: colours.amber },
  selectionCopy: { flex: 1, paddingRight: 8 },
  selectionEyebrow: { color: colours.moss, fontSize: 7, fontWeight: '900', letterSpacing: 0.5 },
  selectionTitle: { color: colours.ink, fontSize: 13, fontWeight: '900', marginTop: 3 },
  selectionDetail: { color: colours.inkSoft, fontSize: 9, lineHeight: 13, marginTop: 3 },
  closeButton: { width: 32, height: 32, borderRadius: 16, backgroundColor: colours.surfaceMuted, alignItems: 'center', justifyContent: 'center' },
  closeText: { color: colours.ink, fontSize: 18, lineHeight: 20 },
});
