import {
  ActivityPurpose,
  ClassificationProvenance,
  DigitalActivityCategory,
  DigitalActivityRule,
} from '../domain/types';

export interface DigitalClassification {
  applicationId: string;
  applicationName: string;
  category: DigitalActivityCategory;
  purpose: ActivityPurpose;
  confidence: number;
  provenance: ClassificationProvenance;
  excluded: boolean;
}

const categoryDefaults: { category: DigitalActivityCategory; purpose: ActivityPurpose; confidence: number; applications: string[] }[] = [
  { category: 'creation', purpose: 'work', confidence: 0.78, applications: ['code', 'devenv', 'rider64', 'webstorm64', 'pycharm64', 'idea64', 'excel', 'winword', 'powerpnt', 'figma', 'photoshop', 'illustrator', 'blender', 'autocad', 'notion', 'obsidian', 'powershell', 'pwsh', 'cmd', 'windowsterminal'] },
  { category: 'communication', purpose: 'unknown', confidence: 0.45, applications: ['teams', 'ms-teams', 'slack', 'zoom', 'outlook', 'thunderbird', 'webex'] },
  { category: 'learning', purpose: 'learning', confidence: 0.76, applications: ['anki', 'kindle', 'duolingo'] },
  { category: 'entertainment', purpose: 'personal', confidence: 0.68, applications: ['spotify', 'vlc', 'steam', 'epicgameslauncher'] },
  { category: 'browser', purpose: 'unknown', confidence: 0.35, applications: ['chrome', 'msedge', 'firefox', 'brave', 'opera'] },
];

const ignoredApplications = new Set(['atira', 'electron']);

export function classifyDigitalApplication(application: string, deviceId: string, rules: DigitalActivityRule[]): DigitalClassification {
  const applicationId = normalizeDigitalApplication(application);
  const rule = rules.find((item) => item.deviceId === deviceId && item.applicationId === applicationId);
  if (!applicationId || ignoredApplications.has(applicationId) || rule?.excluded) {
    return {
      applicationId,
      applicationName: rule?.alias?.trim() || displayApplicationName(applicationId, application),
      category: rule?.category ?? 'other',
      purpose: rule?.purpose ?? 'unknown',
      confidence: rule ? 1 : 0,
      provenance: rule ? 'user_rule' : 'unclassified',
      excluded: true,
    };
  }

  const matched = applicationId === 'chatgpt'
    ? { category: 'ai_assistance' as const, purpose: 'unknown' as const, confidence: 0.4 }
    : categoryDefaults.find((candidate) => candidate.applications.some((name) => applicationId.includes(name)));
  const base = matched ?? { category: 'other' as const, purpose: 'unknown' as const, confidence: 0.3 };
  const hasRule = Boolean(rule);
  return {
    applicationId,
    applicationName: rule?.alias?.trim() || displayApplicationName(applicationId, application),
    category: rule?.category ?? base.category,
    purpose: rule?.purpose ?? base.purpose,
    confidence: hasRule ? 1 : base.confidence,
    provenance: hasRule ? 'user_rule' : base.purpose === 'unknown' ? 'unclassified' : 'system_default',
    excluded: false,
  };
}

export function classifyDigitalDomain(domain: string, deviceId: string, rules: DigitalActivityRule[]): DigitalClassification {
  const normalizedDomain = normalizeDigitalDomain(domain);
  const applicationId = normalizedDomain ? `web:${normalizedDomain}` : '';
  const rule = rules.find((item) => item.deviceId === deviceId && item.applicationId === applicationId);
  const system = classifyDomainDefault(normalizedDomain);
  return {
    applicationId,
    applicationName: rule?.alias?.trim() || system.name,
    category: rule?.category ?? system.category,
    purpose: rule?.purpose ?? system.purpose,
    confidence: rule ? 1 : system.confidence,
    provenance: rule ? 'user_rule' : system.purpose === 'unknown' ? 'unclassified' : 'system_default',
    excluded: !normalizedDomain || Boolean(rule?.excluded),
  };
}

export function normalizeDigitalApplication(application: string) {
  return application.toLowerCase().replace(/\.exe$/, '').replace(/[^a-z0-9-]/g, '');
}

export function normalizeDigitalDomain(domain: string) {
  const value = domain.trim().toLowerCase().replace(/^www\./, '').replace(/\.$/, '');
  return /^(?:[a-z0-9](?:[a-z0-9-]{0,62})\.)+[a-z]{2,63}$/.test(value) ? value : '';
}

function classifyDomainDefault(domain: string): { name: string; category: DigitalActivityCategory; purpose: ActivityPurpose; confidence: number } {
  const defaults: Record<string, { name: string; category: DigitalActivityCategory; purpose: ActivityPurpose; confidence: number }> = {
    'chatgpt.com': { name: 'ChatGPT web', category: 'ai_assistance', purpose: 'unknown', confidence: 0.45 },
    'mail.google.com': { name: 'Gmail', category: 'communication', purpose: 'unknown', confidence: 0.55 },
    'docs.google.com': { name: 'Google Docs', category: 'creation', purpose: 'unknown', confidence: 0.6 },
    'sheets.google.com': { name: 'Google Sheets', category: 'creation', purpose: 'unknown', confidence: 0.6 },
    'slides.google.com': { name: 'Google Slides', category: 'creation', purpose: 'unknown', confidence: 0.6 },
    'calendar.google.com': { name: 'Google Calendar', category: 'other', purpose: 'unknown', confidence: 0.45 },
    'netflix.com': { name: 'Netflix', category: 'entertainment', purpose: 'personal', confidence: 0.75 },
    'youtube.com': { name: 'YouTube', category: 'entertainment', purpose: 'unknown', confidence: 0.5 },
    'open.spotify.com': { name: 'Spotify web', category: 'entertainment', purpose: 'personal', confidence: 0.7 },
  };
  return defaults[domain] ?? {
    name: domain || 'Website',
    category: 'browser',
    purpose: 'unknown',
    confidence: 0.4,
  };
}

function displayApplicationName(applicationId: string, fallback: string) {
  const names: Record<string, string> = {
    chrome: 'Google Chrome',
    msedge: 'Microsoft Edge',
    winword: 'Microsoft Word',
    powerpnt: 'Microsoft PowerPoint',
    devenv: 'Visual Studio',
    windowsterminal: 'Windows Terminal',
    explorer: 'File Explorer',
    chatgpt: 'ChatGPT',
  };
  return names[applicationId] ?? fallback.replace(/\.exe$/i, '');
}
