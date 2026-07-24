import { describe, expect, it } from 'vitest';
import { DesktopUsageApplication } from '../domain/types';
import { groupApplicationsForDisplay } from '../reconstruction/digitalActivityPresentation';

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
