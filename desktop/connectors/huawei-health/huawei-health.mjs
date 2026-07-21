import { createHash, randomBytes, randomUUID } from 'node:crypto';

const AUTHORIZE_URL = 'https://oauth-login.cloud.huawei.com/oauth2/v3/authorize';
const TOKEN_URL = 'https://oauth-login.cloud.huawei.com/oauth2/v3/token';
const HEALTH_API_URL = 'https://health-api.cloud.huawei.com/healthkit/v2';

export const minimumHealthScopes = [
  'https://www.huawei.com/healthkit/step.read',
  'https://www.huawei.com/healthkit/heartrate.read',
  'https://www.huawei.com/healthkit/sleep.read',
  'https://www.huawei.com/healthkit/activity.read',
];

export const optionalRouteScope = 'https://www.huawei.com/healthkit/location.read';

export class HuaweiHealthConnector {
  #configuration;
  #pendingState = null;
  #tokens = null;

  constructor(environment = process.env) {
    this.#configuration = readConfiguration(environment);
  }

  status() {
    const configured = Boolean(this.#configuration.clientId && this.#configuration.clientSecret);
    return {
      configured,
      connected: Boolean(this.#tokens?.accessToken),
      requestedScopes: this.#configuration.scopes,
      routeScopeRequested: this.#configuration.scopes.includes(optionalRouteScope),
      tokenStorage: 'memory-only-prototype',
      detail: !configured
        ? 'Create an HUAWEI Developers app, enable Health Service Kit test scopes, then configure the client ID and secret locally.'
        : this.#tokens?.accessToken
          ? 'HUAWEI Health is authorized for this desktop session.'
          : 'Developer credentials are configured; HUAWEI ID authorization is still required.',
    };
  }

  authorizationUrl() {
    if (!this.#configuration.clientId || !this.#configuration.clientSecret) throw new Error('HUAWEI Health developer credentials are not configured.');
    const state = randomBytes(24).toString('hex');
    const verifier = randomBytes(48).toString('base64url');
    this.#pendingState = { state, verifier, createdAt: Date.now() };
    const challenge = createHash('sha256').update(verifier).digest('base64url');
    const url = new URL(AUTHORIZE_URL);
    url.searchParams.set('response_type', 'code');
    url.searchParams.set('access_type', 'offline');
    url.searchParams.set('client_id', this.#configuration.clientId);
    url.searchParams.set('redirect_uri', this.#configuration.redirectUri);
    url.searchParams.set('scope', this.#configuration.scopes.join(' '));
    url.searchParams.set('state', state);
    url.searchParams.set('code_challenge', challenge);
    url.searchParams.set('code_challenge_method', 'S256');
    return url.toString();
  }

  async acceptAuthorizationCallback(parameters) {
    if (parameters.get('error')) throw new Error(`HUAWEI authorization was declined: ${parameters.get('error')}`);
    const code = parameters.get('code');
    const state = parameters.get('state');
    if (!code || !state || !this.#pendingState || state !== this.#pendingState.state) throw new Error('HUAWEI authorization state did not match.');
    if (Date.now() - this.#pendingState.createdAt > 10 * 60_000) throw new Error('HUAWEI authorization expired before completion.');
    const body = new URLSearchParams({
      grant_type: 'authorization_code',
      code,
      client_id: this.#configuration.clientId,
      client_secret: this.#configuration.clientSecret,
      redirect_uri: this.#configuration.redirectUri,
      code_verifier: this.#pendingState.verifier,
    });
    const response = await fetch(TOKEN_URL, {
      method: 'POST',
      headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
      body,
    });
    const payload = await response.json();
    if (!response.ok || typeof payload.access_token !== 'string') throw new Error(payload.error_description ?? 'HUAWEI did not issue an access token.');
    this.#tokens = {
      accessToken: payload.access_token,
      refreshToken: typeof payload.refresh_token === 'string' ? payload.refresh_token : null,
      expiresAt: Date.now() + Math.max(60, Number(payload.expires_in ?? 3600)) * 1000,
    };
    this.#pendingState = null;
  }

  async workoutObservations(days = 7) {
    if (!this.#tokens?.accessToken) throw new Error('HUAWEI Health is not authorized.');
    const endTime = Date.now();
    const startTime = endTime - Math.min(30, Math.max(1, days)) * 86_400_000;
    const url = new URL(`${HEALTH_API_URL}/activityRecords`);
    url.searchParams.set('startTime', String(startTime));
    url.searchParams.set('endTime', String(endTime));
    const response = await fetch(url, {
      headers: {
        Authorization: `Bearer ${this.#tokens.accessToken}`,
        'x-client-id': this.#configuration.clientId,
        'x-version': '1',
        'x-caller-trace-id': randomUUID(),
      },
    });
    const payload = await response.json();
    if (!response.ok) throw new Error(payload.error_description ?? 'HUAWEI Health workout retrieval failed.');
    return normalizeWorkoutRecords(payload.activityRecord ?? []);
  }
}

export function readConfiguration(environment = {}) {
  const includeRoutes = environment.ATIRA_HUAWEI_INCLUDE_WORKOUT_ROUTES === 'true';
  return {
    clientId: environment.ATIRA_HUAWEI_CLIENT_ID?.trim() ?? '',
    clientSecret: environment.ATIRA_HUAWEI_CLIENT_SECRET?.trim() ?? '',
    redirectUri: environment.ATIRA_HUAWEI_REDIRECT_URI?.trim() || 'http://127.0.0.1:43123/oauth/huawei/callback',
    scopes: includeRoutes ? [...minimumHealthScopes, optionalRouteScope] : minimumHealthScopes,
  };
}

export function normalizeWorkoutRecords(records) {
  return records.flatMap((record) => {
    const startedAt = timestampToIso(record.startTime);
    const endedAt = timestampToIso(record.endTime);
    if (!startedAt || !endedAt) return [];
    const summary = Object.fromEntries((record.activitySummary?.dataSummary ?? []).flatMap((item) =>
      (item.value ?? []).map((value) => [value.fieldName, value.floatValue ?? value.integerValue ?? value.stringValue ?? null])));
    return [{
      id: `huawei-workout-${record.id ?? createHash('sha256').update(`${startedAt}|${endedAt}`).digest('hex').slice(0, 20)}`,
      source: 'health',
      kind: 'health_sample',
      startedAt,
      endedAt,
      capturedAt: new Date().toISOString(),
      quality: 0.94,
      payload: {
        provider: 'huawei_health',
        recordType: 'workout',
        activityType: Number(record.activityType ?? -1),
        calories: numericValue(summary.calories_total),
        averageHeartRate: numericValue(summary.avg),
        maximumHeartRate: numericValue(summary.max),
        minimumHeartRate: numericValue(summary.min),
        routeDetailsPresent: Array.isArray(record.details) && record.details.some((detail) => (detail.samplePoints ?? []).some((point) => point.dataTypeName === 'com.huawei.instantaneous.location.sample')),
      },
    }];
  });
}

function timestampToIso(value) {
  const numeric = Number(value);
  if (!Number.isFinite(numeric)) return null;
  const milliseconds = numeric > 10_000_000_000_000 ? numeric / 1_000_000 : numeric;
  const date = new Date(milliseconds);
  return Number.isFinite(date.getTime()) ? date.toISOString() : null;
}

function numericValue(value) {
  const numeric = Number(value);
  return Number.isFinite(numeric) ? numeric : 0;
}
