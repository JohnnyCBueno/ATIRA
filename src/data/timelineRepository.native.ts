import * as SQLite from 'expo-sqlite';
import { DayPlace, DayRecord, EventCategory, EventState, EvidenceItem, TimelineEvent } from '../domain/types';
import {
  CapabilityState,
  CollectorStatus,
  DATABASE_SCHEMA_VERSION,
  EventCorrection,
  initialCollectorStatuses,
  LocationSegmentRecord,
  ObservationQuery,
  ObservationKind,
  RawObservation,
  TimelineRepository,
} from './contracts';
import { getOrCreateDatabaseKey } from './databaseKey.native';

interface DayRow {
  id: string;
  weekday: string;
  day_number: string;
  month: string;
  relative_label: string;
  coverage: number;
  understood: string;
  work: string;
  movement: string;
  learning: string;
  distance: string;
  route_path: string;
  inferred_route_path: string | null;
  places_json: string;
}

interface EventRow {
  id: string;
  day_id: string;
  title: string;
  category: EventCategory;
  start_time: string;
  end_time: string;
  duration: string;
  place: string | null;
  state: EventState;
  confidence: number | null;
  summary: string;
  alternatives_json: string;
  sort_index: number;
}

interface EvidenceRow {
  id: string;
  event_id: string;
  source: EvidenceItem['source'];
  label: string;
  detail: string;
  strength: EvidenceItem['strength'];
  sort_index: number;
}

interface CollectorRow {
  source: CollectorStatus['source'];
  state: CapabilityState;
  detail: string;
  last_observed_at: string | null;
  coverage: number | null;
  updated_at: string;
}

interface ObservationRow {
  id: string;
  source: RawObservation['source'];
  kind: ObservationKind;
  started_at: string;
  ended_at: string | null;
  captured_at: string;
  quality: number;
  payload_json: string;
}

interface SegmentRow {
  payload_json: string;
}

let databasePromise: Promise<SQLite.SQLiteDatabase> | null = null;

function getDatabase() {
  databasePromise ??= (async () => {
    const database = await SQLite.openDatabaseAsync('atira.db');
    const key = await getOrCreateDatabaseKey();
    await database.execAsync(`PRAGMA key = '${key}'`);
    return database;
  })();
  return databasePromise;
}

async function migrate(database: SQLite.SQLiteDatabase) {
  await database.execAsync('PRAGMA journal_mode = WAL; PRAGMA foreign_keys = ON;');
  const versionRow = await database.getFirstAsync<{ user_version: number }>('PRAGMA user_version');
  let currentVersion = versionRow?.user_version ?? 0;
  if (currentVersion >= DATABASE_SCHEMA_VERSION) return;

  if (currentVersion === 0) {
    await database.execAsync(`
      CREATE TABLE IF NOT EXISTS day_records (
        id TEXT PRIMARY KEY NOT NULL,
        weekday TEXT NOT NULL,
        day_number TEXT NOT NULL,
        month TEXT NOT NULL,
        relative_label TEXT NOT NULL,
        coverage INTEGER NOT NULL,
        understood TEXT NOT NULL,
        work TEXT NOT NULL,
        movement TEXT NOT NULL,
        learning TEXT NOT NULL,
        distance TEXT NOT NULL,
        route_path TEXT NOT NULL,
        inferred_route_path TEXT,
        places_json TEXT NOT NULL
      );

      CREATE TABLE IF NOT EXISTS timeline_events (
        id TEXT PRIMARY KEY NOT NULL,
        day_id TEXT NOT NULL REFERENCES day_records(id) ON DELETE CASCADE,
        title TEXT NOT NULL,
        category TEXT NOT NULL,
        start_time TEXT NOT NULL,
        end_time TEXT NOT NULL,
        duration TEXT NOT NULL,
        place TEXT,
        state TEXT NOT NULL,
        confidence REAL,
        summary TEXT NOT NULL,
        alternatives_json TEXT NOT NULL,
        sort_index INTEGER NOT NULL
      );

      CREATE INDEX IF NOT EXISTS timeline_events_day_start ON timeline_events(day_id, start_time);

      CREATE TABLE IF NOT EXISTS evidence_items (
        id TEXT PRIMARY KEY NOT NULL,
        event_id TEXT NOT NULL REFERENCES timeline_events(id) ON DELETE CASCADE,
        source TEXT NOT NULL,
        label TEXT NOT NULL,
        detail TEXT NOT NULL,
        strength TEXT NOT NULL,
        sort_index INTEGER NOT NULL
      );

      CREATE INDEX IF NOT EXISTS evidence_items_event ON evidence_items(event_id);

      CREATE TABLE IF NOT EXISTS raw_observations (
        id TEXT PRIMARY KEY NOT NULL,
        source TEXT NOT NULL,
        kind TEXT NOT NULL,
        started_at TEXT NOT NULL,
        ended_at TEXT,
        captured_at TEXT NOT NULL,
        quality REAL NOT NULL,
        payload_json TEXT NOT NULL
      );

      CREATE INDEX IF NOT EXISTS observations_source_time ON raw_observations(source, started_at);

      CREATE TABLE IF NOT EXISTS collector_status (
        source TEXT PRIMARY KEY NOT NULL,
        state TEXT NOT NULL,
        detail TEXT NOT NULL,
        last_observed_at TEXT,
        coverage REAL,
        updated_at TEXT NOT NULL
      );

      CREATE TABLE IF NOT EXISTS event_corrections (
        id TEXT PRIMARY KEY NOT NULL,
        day_id TEXT NOT NULL REFERENCES day_records(id) ON DELETE CASCADE,
        event_id TEXT NOT NULL REFERENCES timeline_events(id) ON DELETE CASCADE,
        action TEXT NOT NULL,
        previous_title TEXT NOT NULL,
        corrected_title TEXT NOT NULL,
        created_at TEXT NOT NULL
      );

      CREATE INDEX IF NOT EXISTS corrections_event_time ON event_corrections(event_id, created_at);
    `);
    currentVersion = 1;
  }

  if (currentVersion === 1) {
    await database.execAsync(`
      CREATE TABLE IF NOT EXISTS location_segments (
        id TEXT PRIMARY KEY NOT NULL,
        day_id TEXT NOT NULL,
        kind TEXT NOT NULL,
        started_at TEXT NOT NULL,
        ended_at TEXT NOT NULL,
        payload_json TEXT NOT NULL
      );

      CREATE INDEX IF NOT EXISTS location_segments_day_time ON location_segments(day_id, started_at);
    `);
    currentVersion = 2;
  }

  await database.execAsync(`PRAGMA user_version = ${DATABASE_SCHEMA_VERSION}`);
}

async function insertEvent(database: SQLite.SQLiteDatabase, dayId: string, event: TimelineEvent, sortIndex: number) {
  await database.runAsync(
    `INSERT OR REPLACE INTO timeline_events
      (id, day_id, title, category, start_time, end_time, duration, place, state, confidence, summary, alternatives_json, sort_index)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
    event.id,
    dayId,
    event.title,
    event.category,
    event.start,
    event.end,
    event.duration,
    event.place ?? null,
    event.state,
    event.confidence ?? null,
    event.summary,
    JSON.stringify(event.alternatives),
    sortIndex,
  );
  await database.runAsync('DELETE FROM evidence_items WHERE event_id = ?', event.id);
  for (const [evidenceIndex, evidence] of event.evidence.entries()) {
    await database.runAsync(
      `INSERT INTO evidence_items (id, event_id, source, label, detail, strength, sort_index)
       VALUES (?, ?, ?, ?, ?, ?, ?)`,
      evidence.id,
      event.id,
      evidence.source,
      evidence.label,
      evidence.detail,
      evidence.strength,
      evidenceIndex,
    );
  }
}

async function seedIfEmpty(database: SQLite.SQLiteDatabase, seedDays: DayRecord[]) {
  const row = await database.getFirstAsync<{ count: number }>('SELECT COUNT(*) AS count FROM day_records');
  if ((row?.count ?? 0) > 0) return;
  await database.withExclusiveTransactionAsync(async (transaction) => {
    for (const day of seedDays) {
      await transaction.runAsync(
        `INSERT INTO day_records
          (id, weekday, day_number, month, relative_label, coverage, understood, work, movement, learning, distance, route_path, inferred_route_path, places_json)
          VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
        day.id,
        day.weekday,
        day.dayNumber,
        day.month,
        day.relativeLabel,
        day.coverage,
        day.understood,
        day.work,
        day.movement,
        day.learning,
        day.distance,
        day.routePath,
        day.inferredRoutePath ?? null,
        JSON.stringify(day.places),
      );
      for (const [eventIndex, event] of day.events.entries()) {
        await insertEvent(transaction, day.id, event, eventIndex);
      }
    }
    for (const status of initialCollectorStatuses) {
      await transaction.runAsync(
        `INSERT INTO collector_status (source, state, detail, last_observed_at, coverage, updated_at)
         VALUES (?, ?, ?, ?, ?, ?)`,
        status.source,
        status.state,
        status.detail,
        status.lastObservedAt ?? null,
        status.coverage ?? null,
        status.updatedAt,
      );
    }
  });
}

class NativeTimelineRepository implements TimelineRepository {
  async initialize(seedDays: DayRecord[]) {
    const database = await getDatabase();
    await migrate(database);
    await seedIfEmpty(database, seedDays);
  }

  async listDays(): Promise<DayRecord[]> {
    const database = await getDatabase();
    const [dayRows, eventRows, evidenceRows] = await Promise.all([
      database.getAllAsync<DayRow>('SELECT * FROM day_records ORDER BY id'),
      database.getAllAsync<EventRow>('SELECT * FROM timeline_events ORDER BY day_id, sort_index'),
      database.getAllAsync<EvidenceRow>('SELECT * FROM evidence_items ORDER BY event_id, sort_index'),
    ]);
    const evidenceByEvent = new Map<string, EvidenceItem[]>();
    for (const row of evidenceRows) {
      const items = evidenceByEvent.get(row.event_id) ?? [];
      items.push({ id: row.id, source: row.source, label: row.label, detail: row.detail, strength: row.strength });
      evidenceByEvent.set(row.event_id, items);
    }
    const eventsByDay = new Map<string, TimelineEvent[]>();
    for (const row of eventRows) {
      const events = eventsByDay.get(row.day_id) ?? [];
      events.push({
        id: row.id,
        title: row.title,
        category: row.category,
        start: row.start_time,
        end: row.end_time,
        duration: row.duration,
        place: row.place ?? undefined,
        state: row.state,
        confidence: row.confidence ?? undefined,
        summary: row.summary,
        alternatives: JSON.parse(row.alternatives_json) as string[],
        evidence: evidenceByEvent.get(row.id) ?? [],
      });
      eventsByDay.set(row.day_id, events);
    }
    return dayRows.map((row) => ({
      id: row.id,
      weekday: row.weekday,
      dayNumber: row.day_number,
      month: row.month,
      relativeLabel: row.relative_label,
      coverage: row.coverage,
      understood: row.understood,
      work: row.work,
      movement: row.movement,
      learning: row.learning,
      distance: row.distance,
      routePath: row.route_path,
      inferredRoutePath: row.inferred_route_path ?? undefined,
      places: JSON.parse(row.places_json) as DayPlace[],
      events: eventsByDay.get(row.id) ?? [],
    }));
  }

  async upsertDay(day: DayRecord) {
    const database = await getDatabase();
    await database.withExclusiveTransactionAsync(async (transaction) => {
      const eventIds = await transaction.getAllAsync<{ id: string }>('SELECT id FROM timeline_events WHERE day_id = ?', day.id);
      for (const event of eventIds) await transaction.runAsync('DELETE FROM evidence_items WHERE event_id = ?', event.id);
      await transaction.runAsync('DELETE FROM timeline_events WHERE day_id = ?', day.id);
      await transaction.runAsync(
        `INSERT OR REPLACE INTO day_records
          (id, weekday, day_number, month, relative_label, coverage, understood, work, movement, learning, distance, route_path, inferred_route_path, places_json)
          VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
        day.id,
        day.weekday,
        day.dayNumber,
        day.month,
        day.relativeLabel,
        day.coverage,
        day.understood,
        day.work,
        day.movement,
        day.learning,
        day.distance,
        day.routePath,
        day.inferredRoutePath ?? null,
        JSON.stringify(day.places),
      );
      for (const [eventIndex, event] of day.events.entries()) await insertEvent(transaction, day.id, event, eventIndex);
    });
  }

  async saveEvent(dayId: string, event: TimelineEvent, correction: EventCorrection) {
    const database = await getDatabase();
    await database.withExclusiveTransactionAsync(async (transaction) => {
      const indexRow = await transaction.getFirstAsync<{ sort_index: number }>('SELECT sort_index FROM timeline_events WHERE id = ?', event.id);
      await insertEvent(transaction, dayId, event, indexRow?.sort_index ?? 0);
      await transaction.runAsync(
        `INSERT INTO event_corrections
          (id, day_id, event_id, action, previous_title, corrected_title, created_at)
          VALUES (?, ?, ?, ?, ?, ?, ?)`,
        correction.id,
        correction.dayId,
        correction.eventId,
        correction.action,
        correction.previousTitle,
        correction.correctedTitle,
        correction.createdAt,
      );
    });
  }

  async appendObservations(observations: RawObservation[]) {
    if (observations.length === 0) return;
    const database = await getDatabase();
    await database.withExclusiveTransactionAsync(async (transaction) => {
      for (const observation of observations) {
        await transaction.runAsync(
          `INSERT OR IGNORE INTO raw_observations
            (id, source, kind, started_at, ended_at, captured_at, quality, payload_json)
            VALUES (?, ?, ?, ?, ?, ?, ?, ?)`,
          observation.id,
          observation.source,
          observation.kind,
          observation.startedAt,
          observation.endedAt ?? null,
          observation.capturedAt,
          observation.quality,
          JSON.stringify(observation.payload),
        );
      }
    });
  }

  async listObservations(query: ObservationQuery = {}): Promise<RawObservation[]> {
    const database = await getDatabase();
    const clauses: string[] = [];
    const parameters: (string | number | null)[] = [];
    if (query.source) {
      clauses.push('source = ?');
      parameters.push(query.source);
    }
    if (query.from) {
      clauses.push('started_at >= ?');
      parameters.push(query.from);
    }
    if (query.to) {
      clauses.push('started_at <= ?');
      parameters.push(query.to);
    }
    const where = clauses.length > 0 ? ` WHERE ${clauses.join(' AND ')}` : '';
    const rows = await database.getAllAsync<ObservationRow>(`SELECT * FROM raw_observations${where} ORDER BY started_at`, parameters);
    return rows.map((row) => ({
      id: row.id,
      source: row.source,
      kind: row.kind,
      startedAt: row.started_at,
      endedAt: row.ended_at ?? undefined,
      capturedAt: row.captured_at,
      quality: row.quality,
      payload: JSON.parse(row.payload_json) as RawObservation['payload'],
    }));
  }

  async replaceLocationSegments(dayId: string, segments: LocationSegmentRecord[]) {
    const database = await getDatabase();
    await database.withExclusiveTransactionAsync(async (transaction) => {
      await transaction.runAsync('DELETE FROM location_segments WHERE day_id = ?', dayId);
      for (const segment of segments) {
        await transaction.runAsync(
          `INSERT INTO location_segments (id, day_id, kind, started_at, ended_at, payload_json)
           VALUES (?, ?, ?, ?, ?, ?)`,
          segment.id,
          segment.dayId,
          segment.kind,
          segment.startedAt,
          segment.endedAt,
          JSON.stringify(segment),
        );
      }
    });
  }

  async listLocationSegments(dayId?: string): Promise<LocationSegmentRecord[]> {
    const database = await getDatabase();
    const rows = dayId
      ? await database.getAllAsync<SegmentRow>('SELECT payload_json FROM location_segments WHERE day_id = ? ORDER BY started_at', dayId)
      : await database.getAllAsync<SegmentRow>('SELECT payload_json FROM location_segments ORDER BY started_at');
    return rows.map((row) => JSON.parse(row.payload_json) as LocationSegmentRecord);
  }

  async listCollectorStatuses(): Promise<CollectorStatus[]> {
    const database = await getDatabase();
    const rows = await database.getAllAsync<CollectorRow>('SELECT * FROM collector_status ORDER BY source');
    return rows.map((row) => ({
      source: row.source,
      state: row.state,
      detail: row.detail,
      lastObservedAt: row.last_observed_at ?? undefined,
      coverage: row.coverage ?? undefined,
      updatedAt: row.updated_at,
    }));
  }

  async upsertCollectorStatus(status: CollectorStatus) {
    const database = await getDatabase();
    await database.runAsync(
      `INSERT INTO collector_status (source, state, detail, last_observed_at, coverage, updated_at)
       VALUES (?, ?, ?, ?, ?, ?)
       ON CONFLICT(source) DO UPDATE SET
         state = excluded.state,
         detail = excluded.detail,
         last_observed_at = excluded.last_observed_at,
         coverage = excluded.coverage,
         updated_at = excluded.updated_at`,
      status.source,
      status.state,
      status.detail,
      status.lastObservedAt ?? null,
      status.coverage ?? null,
      status.updatedAt,
    );
  }

  async getDiagnostics() {
    const database = await getDatabase();
    const [dayRow, observationRow, correctionRow, segmentRow] = await Promise.all([
      database.getFirstAsync<{ count: number }>('SELECT COUNT(*) AS count FROM day_records'),
      database.getFirstAsync<{ count: number }>('SELECT COUNT(*) AS count FROM raw_observations'),
      database.getFirstAsync<{ count: number }>('SELECT COUNT(*) AS count FROM event_corrections'),
      database.getFirstAsync<{ count: number }>('SELECT COUNT(*) AS count FROM location_segments'),
    ]);
    return {
      adapter: 'sqlite' as const,
      schemaVersion: DATABASE_SCHEMA_VERSION,
      dayCount: dayRow?.count ?? 0,
      observationCount: observationRow?.count ?? 0,
      correctionCount: correctionRow?.count ?? 0,
      segmentCount: segmentRow?.count ?? 0,
    };
  }
}

const repository = new NativeTimelineRepository();

export function getTimelineRepository(): TimelineRepository {
  return repository;
}
