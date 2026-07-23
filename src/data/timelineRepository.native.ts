import * as SQLite from 'expo-sqlite';
import { DayPlace, DayRecord, DigitalActivityRule, EventCategory, EventState, EvidenceItem, TimelineEvent } from '../domain/types';
import {
  CapabilityState,
  CollectorRecord,
  CollectorStatus,
  DATABASE_SCHEMA_VERSION,
  DeviceRecord,
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
  desktop_usages_json: string | null;
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
  last_synced_at: string | null;
  operational_state: CollectorStatus['operationalState'] | null;
  expected_heartbeat_seconds: number | null;
  backfill_state: CollectorStatus['backfillState'] | null;
  coverage: number | null;
  updated_at: string;
}

interface ObservationRow {
  id: string;
  device_id: string | null;
  collector_id: string | null;
  source: RawObservation['source'];
  kind: ObservationKind;
  started_at: string;
  ended_at: string | null;
  captured_at: string;
  quality: number;
  payload_json: string;
}

interface DeviceRow {
  id: string;
  device_class: DeviceRecord['deviceClass'];
  platform: DeviceRecord['platform'];
  label: string;
  created_at: string;
  updated_at: string;
}

interface RegisteredCollectorRow {
  id: string;
  device_id: string;
  source: CollectorRecord['source'];
  provider: string;
  label: string;
  created_at: string;
  updated_at: string;
}

interface SegmentRow {
  payload_json: string;
}

interface ActivityRuleRow {
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
        last_synced_at TEXT,
        operational_state TEXT,
        expected_heartbeat_seconds INTEGER,
        backfill_state TEXT,
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

  if (currentVersion === 2) {
    await database.execAsync(`
      CREATE TABLE IF NOT EXISTS devices (
        id TEXT PRIMARY KEY NOT NULL,
        device_class TEXT NOT NULL,
        platform TEXT NOT NULL,
        label TEXT NOT NULL,
        created_at TEXT NOT NULL,
        updated_at TEXT NOT NULL
      );

      CREATE TABLE IF NOT EXISTS registered_collectors (
        id TEXT PRIMARY KEY NOT NULL,
        device_id TEXT NOT NULL REFERENCES devices(id) ON DELETE CASCADE,
        source TEXT NOT NULL,
        provider TEXT NOT NULL,
        label TEXT NOT NULL,
        created_at TEXT NOT NULL,
        updated_at TEXT NOT NULL
      );

      CREATE INDEX IF NOT EXISTS registered_collectors_device ON registered_collectors(device_id);
    `);
    await ensureColumn(database, 'raw_observations', 'device_id', 'TEXT');
    await ensureColumn(database, 'raw_observations', 'collector_id', 'TEXT');
    await ensureColumn(database, 'day_records', 'desktop_usages_json', 'TEXT');
    const legacyTimestamp = new Date(0).toISOString();
    const sources = await database.getAllAsync<{ source: RawObservation['source'] }>('SELECT DISTINCT source FROM raw_observations');
    for (const { source } of sources) {
      const deviceId = `legacy-${source}-device`;
      const collectorId = `legacy-${source}-collector`;
      await database.runAsync(
        `INSERT OR IGNORE INTO devices (id, device_class, platform, label, created_at, updated_at) VALUES (?, ?, ?, ?, ?, ?)`,
        deviceId,
        source === 'desktop' ? 'computer' : 'other',
        source === 'desktop' ? 'windows' : 'unknown',
        source === 'desktop' ? 'Legacy Windows computer' : `Legacy ${source} source`,
        legacyTimestamp,
        legacyTimestamp,
      );
      await database.runAsync(
        `INSERT OR IGNORE INTO registered_collectors (id, device_id, source, provider, label, created_at, updated_at) VALUES (?, ?, ?, ?, ?, ?, ?)`,
        collectorId,
        deviceId,
        source,
        'legacy_import',
        `Legacy ${source} collector`,
        legacyTimestamp,
        legacyTimestamp,
      );
      await database.runAsync(
        'UPDATE raw_observations SET device_id = COALESCE(device_id, ?), collector_id = COALESCE(collector_id, ?) WHERE source = ?',
        deviceId,
        collectorId,
        source,
      );
    }
    await database.execAsync(`
      CREATE INDEX IF NOT EXISTS observations_device_time ON raw_observations(device_id, started_at);
      CREATE INDEX IF NOT EXISTS observations_collector_time ON raw_observations(collector_id, started_at);
    `);
    currentVersion = 3;
  }

  if (currentVersion === 3) {
    await database.execAsync(`
      CREATE TABLE IF NOT EXISTS digital_activity_rules (
        id TEXT PRIMARY KEY NOT NULL,
        device_id TEXT NOT NULL REFERENCES devices(id) ON DELETE CASCADE,
        application_id TEXT NOT NULL,
        payload_json TEXT NOT NULL,
        updated_at TEXT NOT NULL
      );

      CREATE UNIQUE INDEX IF NOT EXISTS activity_rules_device_app ON digital_activity_rules(device_id, application_id);
    `);
    await database.execAsync(`
      DELETE FROM day_records
      WHERE id IN ('2026-07-14', '2026-07-15', '2026-07-16', '2026-07-17', '2026-07-18', '2026-07-19', '2026-07-20')
        AND NOT EXISTS (
          SELECT 1 FROM raw_observations WHERE substr(started_at, 1, 10) = day_records.id
        );
    `);
    currentVersion = 4;
  }

  if (currentVersion === 4) {
    await database.execAsync(`
      DELETE FROM timeline_events
      WHERE day_id IN ('2026-07-14', '2026-07-15', '2026-07-16', '2026-07-17', '2026-07-18', '2026-07-19', '2026-07-20')
        AND id NOT IN (SELECT DISTINCT event_id FROM evidence_items WHERE source = 'desktop');
      UPDATE day_records
      SET movement = '—', distance = '—', route_path = '', inferred_route_path = NULL, places_json = '[]'
      WHERE id IN ('2026-07-14', '2026-07-15', '2026-07-16', '2026-07-17', '2026-07-18', '2026-07-19', '2026-07-20');
    `);
    currentVersion = 5;
  }

  if (currentVersion < 7) {
    await ensureColumn(database, 'collector_status', 'last_synced_at', 'TEXT');
    await ensureColumn(database, 'collector_status', 'operational_state', 'TEXT');
    await ensureColumn(database, 'collector_status', 'expected_heartbeat_seconds', 'INTEGER');
    await ensureColumn(database, 'collector_status', 'backfill_state', 'TEXT');
    currentVersion = 7;
  }

  await database.execAsync(`PRAGMA user_version = ${DATABASE_SCHEMA_VERSION}`);
}

async function ensureColumn(database: SQLite.SQLiteDatabase, table: string, column: string, definition: string) {
  const columns = await database.getAllAsync<{ name: string }>(`PRAGMA table_info(${table})`);
  if (!columns.some((item) => item.name === column)) await database.execAsync(`ALTER TABLE ${table} ADD COLUMN ${column} ${definition}`);
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
          (id, weekday, day_number, month, relative_label, coverage, understood, work, movement, learning, distance, route_path, inferred_route_path, places_json, desktop_usages_json)
          VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
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
        day.desktopUsages ? JSON.stringify(day.desktopUsages) : null,
      );
      for (const [eventIndex, event] of day.events.entries()) {
        await insertEvent(transaction, day.id, event, eventIndex);
      }
    }
    for (const status of initialCollectorStatuses) {
      await transaction.runAsync(
        `INSERT INTO collector_status (source, state, detail, last_observed_at, last_synced_at, operational_state, expected_heartbeat_seconds, backfill_state, coverage, updated_at)
         VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
        status.source,
        status.state,
        status.detail,
        status.lastObservedAt ?? null,
        status.lastSyncedAt ?? null,
        status.operationalState ?? null,
        status.expectedHeartbeatSeconds ?? null,
        status.backfillState ?? null,
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
      desktopUsages: row.desktop_usages_json ? JSON.parse(row.desktop_usages_json) as DayRecord['desktopUsages'] : undefined,
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
          (id, weekday, day_number, month, relative_label, coverage, understood, work, movement, learning, distance, route_path, inferred_route_path, places_json, desktop_usages_json)
          VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
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
        day.desktopUsages ? JSON.stringify(day.desktopUsages) : null,
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
          `INSERT INTO raw_observations
            (id, device_id, collector_id, source, kind, started_at, ended_at, captured_at, quality, payload_json)
            VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
            ON CONFLICT(id) DO UPDATE SET
              device_id = COALESCE(excluded.device_id, raw_observations.device_id),
              collector_id = COALESCE(excluded.collector_id, raw_observations.collector_id)`,
          observation.id,
          observation.deviceId ?? null,
          observation.collectorId ?? null,
          observation.source,
          observation.kind,
          observation.startedAt,
          observation.endedAt ?? null,
          observation.capturedAt,
          observation.quality,
          JSON.stringify(observation.payload),
        );
      }
      await transaction.runAsync(
        `DELETE FROM registered_collectors
         WHERE provider = 'legacy_import'
           AND id NOT IN (SELECT DISTINCT collector_id FROM raw_observations WHERE collector_id IS NOT NULL)`,
      );
      await transaction.runAsync(
        `DELETE FROM devices
         WHERE id LIKE 'legacy-%'
           AND id NOT IN (SELECT DISTINCT device_id FROM raw_observations WHERE device_id IS NOT NULL)`,
      );
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
    if (query.deviceId) {
      clauses.push('device_id = ?');
      parameters.push(query.deviceId);
    }
    if (query.collectorId) {
      clauses.push('collector_id = ?');
      parameters.push(query.collectorId);
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
      deviceId: row.device_id ?? undefined,
      collectorId: row.collector_id ?? undefined,
      source: row.source,
      kind: row.kind,
      startedAt: row.started_at,
      endedAt: row.ended_at ?? undefined,
      capturedAt: row.captured_at,
      quality: row.quality,
      payload: JSON.parse(row.payload_json) as RawObservation['payload'],
    }));
  }

  async deleteObservations(query: ObservationQuery = {}) {
    const database = await getDatabase();
    const clauses: string[] = [];
    const parameters: string[] = [];
    if (query.source) { clauses.push('source = ?'); parameters.push(query.source); }
    if (query.deviceId) { clauses.push('device_id = ?'); parameters.push(query.deviceId); }
    if (query.collectorId) { clauses.push('collector_id = ?'); parameters.push(query.collectorId); }
    if (query.from) { clauses.push('started_at >= ?'); parameters.push(query.from); }
    if (query.to) { clauses.push('started_at <= ?'); parameters.push(query.to); }
    const where = clauses.length > 0 ? ` WHERE ${clauses.join(' AND ')}` : '';
    const result = await database.runAsync(`DELETE FROM raw_observations${where}`, parameters);
    return result.changes;
  }

  async listDevices(): Promise<DeviceRecord[]> {
    const database = await getDatabase();
    const rows = await database.getAllAsync<DeviceRow>('SELECT * FROM devices ORDER BY label, id');
    return rows.map((row) => ({
      id: row.id,
      deviceClass: row.device_class,
      platform: row.platform,
      label: row.label,
      createdAt: row.created_at,
      updatedAt: row.updated_at,
    }));
  }

  async upsertDevice(device: DeviceRecord) {
    const database = await getDatabase();
    await database.runAsync(
      `INSERT INTO devices (id, device_class, platform, label, created_at, updated_at)
       VALUES (?, ?, ?, ?, ?, ?)
       ON CONFLICT(id) DO UPDATE SET
         device_class = excluded.device_class,
         platform = excluded.platform,
         label = excluded.label,
         updated_at = excluded.updated_at`,
      device.id,
      device.deviceClass,
      device.platform,
      device.label,
      device.createdAt,
      device.updatedAt,
    );
  }

  async reconcileLegacyDesktopIdentity(device: DeviceRecord, collector: CollectorRecord) {
    if (device.id.startsWith('legacy-') || device.deviceClass !== 'computer' || device.platform !== 'windows') return 0;
    const database = await getDatabase();
    const legacyIds = ['legacy-desktop-device'];
    const rows = await database.getAllAsync<{ id: string }>(
      `SELECT id FROM devices
       WHERE id <> ? AND device_class = 'computer' AND platform = 'windows'
         AND (id LIKE 'legacy-desktop-%' OR EXISTS (
           SELECT 1 FROM registered_collectors
           WHERE registered_collectors.device_id = devices.id
             AND registered_collectors.provider = 'atira_windows_companion'
         ))`,
      device.id,
    );
    for (const row of rows) if (!legacyIds.includes(row.id)) legacyIds.push(row.id);
    let reconciled = 0;
    for (const legacyId of legacyIds) {
      const result = await database.runAsync(
        `UPDATE raw_observations SET device_id = ?, collector_id = ? WHERE source = 'desktop' AND device_id = ?`,
        device.id, collector.id, legacyId,
      );
      reconciled += result.changes;
      const rules = await database.getAllAsync<ActivityRuleRow>(
        'SELECT payload_json FROM digital_activity_rules WHERE device_id = ?', legacyId,
      );
      for (const row of rules) {
        const rule = JSON.parse(row.payload_json) as DigitalActivityRule;
        const existing = await database.getFirstAsync<{ id: string }>(
          'SELECT id FROM digital_activity_rules WHERE device_id = ? AND application_id = ?', device.id, rule.applicationId,
        );
        if (!existing) {
          const moved = { ...rule, id: `${device.id}:${rule.applicationId}`, deviceId: device.id, updatedAt: new Date().toISOString() };
          await this.upsertDigitalActivityRule(moved);
        }
        await database.runAsync('DELETE FROM digital_activity_rules WHERE id = ?', rule.id);
      }
      await database.runAsync('DELETE FROM registered_collectors WHERE device_id = ? AND NOT EXISTS (SELECT 1 FROM raw_observations WHERE collector_id = registered_collectors.id)', legacyId);
      await database.runAsync('DELETE FROM devices WHERE id = ? AND NOT EXISTS (SELECT 1 FROM raw_observations WHERE device_id = ?)', legacyId, legacyId);
    }
    await database.runAsync(`DELETE FROM registered_collectors WHERE provider = 'legacy_import' AND source = 'desktop' AND NOT EXISTS (SELECT 1 FROM raw_observations WHERE collector_id = registered_collectors.id)`);
    return reconciled;
  }

  async listDigitalActivityRules(): Promise<DigitalActivityRule[]> {
    const database = await getDatabase();
    const rows = await database.getAllAsync<ActivityRuleRow>('SELECT payload_json FROM digital_activity_rules ORDER BY updated_at DESC');
    return rows.map((row) => JSON.parse(row.payload_json) as DigitalActivityRule);
  }

  async upsertDigitalActivityRule(rule: DigitalActivityRule) {
    const database = await getDatabase();
    await database.runAsync(
      `INSERT INTO digital_activity_rules (id, device_id, application_id, payload_json, updated_at)
       VALUES (?, ?, ?, ?, ?)
       ON CONFLICT(id) DO UPDATE SET
         device_id = excluded.device_id,
         application_id = excluded.application_id,
         payload_json = excluded.payload_json,
         updated_at = excluded.updated_at`,
      rule.id,
      rule.deviceId,
      rule.applicationId,
      JSON.stringify(rule),
      rule.updatedAt,
    );
  }

  async deleteDigitalActivityRule(id: string) {
    const database = await getDatabase();
    await database.runAsync('DELETE FROM digital_activity_rules WHERE id = ?', id);
  }

  async listCollectors(): Promise<CollectorRecord[]> {
    const database = await getDatabase();
    const rows = await database.getAllAsync<RegisteredCollectorRow>('SELECT * FROM registered_collectors ORDER BY label, id');
    return rows.map((row) => ({
      id: row.id,
      deviceId: row.device_id,
      source: row.source,
      provider: row.provider,
      label: row.label,
      createdAt: row.created_at,
      updatedAt: row.updated_at,
    }));
  }

  async upsertCollector(collector: CollectorRecord) {
    const database = await getDatabase();
    await database.runAsync(
      `INSERT INTO registered_collectors (id, device_id, source, provider, label, created_at, updated_at)
       VALUES (?, ?, ?, ?, ?, ?, ?)
       ON CONFLICT(id) DO UPDATE SET
         device_id = excluded.device_id,
         source = excluded.source,
         provider = excluded.provider,
         label = excluded.label,
         updated_at = excluded.updated_at`,
      collector.id,
      collector.deviceId,
      collector.source,
      collector.provider,
      collector.label,
      collector.createdAt,
      collector.updatedAt,
    );
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
      lastSyncedAt: row.last_synced_at ?? undefined,
      operationalState: row.operational_state ?? undefined,
      expectedHeartbeatSeconds: row.expected_heartbeat_seconds ?? undefined,
      backfillState: row.backfill_state ?? undefined,
      coverage: row.coverage ?? undefined,
      updatedAt: row.updated_at,
    }));
  }

  async upsertCollectorStatus(status: CollectorStatus) {
    const database = await getDatabase();
    await database.runAsync(
      `INSERT INTO collector_status (source, state, detail, last_observed_at, last_synced_at, operational_state, expected_heartbeat_seconds, backfill_state, coverage, updated_at)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
       ON CONFLICT(source) DO UPDATE SET
         state = excluded.state,
         detail = excluded.detail,
         last_observed_at = excluded.last_observed_at,
         last_synced_at = excluded.last_synced_at,
         operational_state = excluded.operational_state,
         expected_heartbeat_seconds = excluded.expected_heartbeat_seconds,
         backfill_state = excluded.backfill_state,
         coverage = excluded.coverage,
         updated_at = excluded.updated_at`,
      status.source,
      status.state,
      status.detail,
      status.lastObservedAt ?? null,
      status.lastSyncedAt ?? null,
      status.operationalState ?? null,
      status.expectedHeartbeatSeconds ?? null,
      status.backfillState ?? null,
      status.coverage ?? null,
      status.updatedAt,
    );
  }

  async getDiagnostics() {
    const database = await getDatabase();
    const [dayRow, observationRow, correctionRow, segmentRow, deviceRow, collectorRow, activityRuleRow] = await Promise.all([
      database.getFirstAsync<{ count: number }>('SELECT COUNT(*) AS count FROM day_records'),
      database.getFirstAsync<{ count: number }>('SELECT COUNT(*) AS count FROM raw_observations'),
      database.getFirstAsync<{ count: number }>('SELECT COUNT(*) AS count FROM event_corrections'),
      database.getFirstAsync<{ count: number }>('SELECT COUNT(*) AS count FROM location_segments'),
      database.getFirstAsync<{ count: number }>('SELECT COUNT(*) AS count FROM devices'),
      database.getFirstAsync<{ count: number }>('SELECT COUNT(*) AS count FROM registered_collectors'),
      database.getFirstAsync<{ count: number }>('SELECT COUNT(*) AS count FROM digital_activity_rules'),
    ]);
    return {
      adapter: 'sqlite' as const,
      schemaVersion: DATABASE_SCHEMA_VERSION,
      dayCount: dayRow?.count ?? 0,
      observationCount: observationRow?.count ?? 0,
      correctionCount: correctionRow?.count ?? 0,
      segmentCount: segmentRow?.count ?? 0,
      deviceCount: deviceRow?.count ?? 0,
      collectorCount: collectorRow?.count ?? 0,
      activityRuleCount: activityRuleRow?.count ?? 0,
    };
  }
}

const repository = new NativeTimelineRepository();

export function getTimelineRepository(): TimelineRepository {
  return repository;
}
