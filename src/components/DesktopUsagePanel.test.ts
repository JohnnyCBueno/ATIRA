import { describe, expect, it } from 'vitest';
import { DesktopUsageApplication } from '../domain/types';
import { buildDisplayTwoHourBuckets, groupApplicationsForDisplay } from '../reconstruction/digitalActivityPresentation';

describe('desktop application presentation', () => {
  it('nests active domains under Chrome and hides unclassified browser remainder', () => {
    const chrome = application('chrome', 'Google Chrome', 1200);
    const gmail = application('web:mail.google.com', 'Gmail', 180, 'communication');
    const docs = application('web:docs.google.com', 'Google Docs', 420, 'creation');
    const chatgpt = application('chatgpt', 'ChatGPT', 600, 'ai_assistance');
    const result = groupApplicationsForDisplay([chrome, gmail, docs, chatgpt]);

    expect(result.map((item) => item.application.applicationId)).toEqual(['chatgpt', 'chrome']);
    expect(result[1].application.durationSeconds).toBe(600);
    expect(result[1].browserSites.map((item) => item.applicationId)).toEqual(['web:docs.google.com', 'web:mail.google.com']);
  });

  it('keeps website activity beneath the browser that supplied it', () => {
    const edge = application('msedge', 'Microsoft Edge', 300);
    const edgeDocs = { ...application('web:docs.google.com', 'Google Docs', 120, 'creation'), browserId: 'edge' };
    const result = groupApplicationsForDisplay([edge, edgeDocs]);
    expect(result).toHaveLength(1);
    expect(result[0].application).toMatchObject({ applicationId: 'msedge', applicationName: 'Microsoft Edge', durationSeconds: 120 });
    expect(result[0].browserSites[0].browserId).toBe('edge');
  });

  it('plots historical sessions by their local clock time instead of the current date', () => {
    const historical = {
      ...application('chatgpt', 'ChatGPT', 1800, 'ai_assistance'),
      sessions: [{
        id: 'historical-session',
        deviceId: 'computer',
        applicationId: 'chatgpt',
        applicationName: 'ChatGPT',
        category: 'ai_assistance' as const,
        purpose: 'unknown' as const,
        classificationConfidence: 0.5,
        classificationProvenance: 'unclassified' as const,
        startedAt: '2024-01-15T14:15:00.000Z',
        endedAt: '2024-01-15T14:45:00.000Z',
        durationSeconds: 1800,
      }],
    };

    const buckets = buildDisplayTwoHourBuckets([historical]);
    const expectedLocalBucket = Math.floor(new Date(historical.sessions[0].startedAt).getHours() / 2) * 2;

    expect(buckets.find((bucket) => bucket.startHour === expectedLocalBucket)).toMatchObject({
      totalSeconds: 1800,
      categories: [{ category: 'ai_assistance', durationSeconds: 1800 }],
    });
    expect(buckets.reduce((total, bucket) => total + bucket.totalSeconds, 0)).toBe(1800);
  });
});

function application(id: string, name: string, durationSeconds: number, category: DesktopUsageApplication['category'] = 'browser'): DesktopUsageApplication {
  return {
    deviceId: 'computer',
    applicationId: id,
    applicationName: name,
    category,
    purpose: 'unknown',
    classificationConfidence: 0.5,
    classificationProvenance: 'unclassified',
    durationSeconds,
    sessions: [],
  };
}
