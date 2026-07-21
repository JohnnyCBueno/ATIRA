import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import { HuaweiHealthConnector, normalizeWorkoutRecords, optionalRouteScope, readConfiguration } from './huawei-health.mjs';

describe('HUAWEI Health connector', () => {
  it('does not expose a client secret in the authorization URL', () => {
    const connector = new HuaweiHealthConnector({ ATIRA_HUAWEI_CLIENT_ID: 'client', ATIRA_HUAWEI_CLIENT_SECRET: 'private-secret' });
    const url = connector.authorizationUrl();
    assert.match(url, /client_id=client/);
    assert.doesNotMatch(url, /private-secret/);
    assert.match(url, /code_challenge=/);
  });

  it('requests workout routes only by explicit configuration', () => {
    assert.equal(readConfiguration({}).scopes.includes(optionalRouteScope), false);
    assert.equal(readConfiguration({ ATIRA_HUAWEI_INCLUDE_WORKOUT_ROUTES: 'true' }).scopes.includes(optionalRouteScope), true);
  });

  it('normalizes a workout without claiming a route that is absent', () => {
    const [observation] = normalizeWorkoutRecords([{
      id: 'run-1', startTime: 1_784_608_200_000, endTime: 1_784_611_800_000, activityType: 1,
      activitySummary: { dataSummary: [{ value: [{ fieldName: 'calories_total', floatValue: 412 }] }] },
      details: [],
    }]);
    assert.equal(observation.id, 'huawei-workout-run-1');
    assert.equal(observation.payload.calories, 412);
    assert.equal(observation.payload.routeDetailsPresent, false);
  });
});
