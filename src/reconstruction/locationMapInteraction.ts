import { ProjectedLocationSegment, ProjectedPoint } from './locationMapProjection';

export const MAP_WIDTH = 360;
export const MAP_HEIGHT = 300;

export interface MapViewport {
  centerX: number;
  centerY: number;
  zoom: number;
}

export const overviewViewport: MapViewport = {
  centerX: MAP_WIDTH / 2,
  centerY: MAP_HEIGHT / 2,
  zoom: 1,
};

export function viewBoxForViewport(viewport: MapViewport) {
  const zoom = clamp(viewport.zoom, 1, 3);
  const width = MAP_WIDTH / zoom;
  const height = MAP_HEIGHT / zoom;
  const centerX = clamp(viewport.centerX, width / 2, MAP_WIDTH - width / 2);
  const centerY = clamp(viewport.centerY, height / 2, MAP_HEIGHT - height / 2);
  return {
    x: round(centerX - width / 2),
    y: round(centerY - height / 2),
    width: round(width),
    height: round(height),
  };
}

export function zoomViewport(viewport: MapViewport, amount: number): MapViewport {
  return { ...viewport, zoom: clamp(round(viewport.zoom + amount), 1, 3) };
}

export function panViewport(viewport: MapViewport, xDirection: number, yDirection: number): MapViewport {
  const box = viewBoxForViewport(viewport);
  const next = {
    ...viewport,
    centerX: viewport.centerX + xDirection * box.width * 0.22,
    centerY: viewport.centerY + yDirection * box.height * 0.22,
  };
  const bounded = viewBoxForViewport(next);
  return {
    ...next,
    centerX: bounded.x + bounded.width / 2,
    centerY: bounded.y + bounded.height / 2,
  };
}

export function focusViewportOnSegment(segment: ProjectedLocationSegment): MapViewport {
  const points = segment.center ? [segment.center] : segment.points;
  if (points.length === 0) return overviewViewport;
  const center = midpoint(points);
  return {
    centerX: center.x,
    centerY: center.y,
    zoom: segment.segment.kind === 'stay' ? 2.25 : 1.75,
  };
}

function midpoint(points: ProjectedPoint[]) {
  const minX = Math.min(...points.map((point) => point.x));
  const maxX = Math.max(...points.map((point) => point.x));
  const minY = Math.min(...points.map((point) => point.y));
  const maxY = Math.max(...points.map((point) => point.y));
  return { x: (minX + maxX) / 2, y: (minY + maxY) / 2 };
}

function clamp(value: number, minimum: number, maximum: number) {
  return Math.min(maximum, Math.max(minimum, value));
}

function round(value: number) {
  return Math.round(value * 10) / 10;
}
