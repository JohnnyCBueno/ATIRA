import { DesktopUsageApplication } from '../domain/types';

export interface DisplayApplication {
  application: DesktopUsageApplication;
  browserSites: DesktopUsageApplication[];
}

export function groupApplicationsForDisplay(applications: DesktopUsageApplication[]): DisplayApplication[] {
  const browserSites = applications.filter((application) => application.applicationId.startsWith('web:'))
    .sort((a, b) => b.durationSeconds - a.durationSeconds);
  if (browserSites.length === 0) return applications.map((application) => ({ application, browserSites: [] }));
  const sitesByBrowser = new Map<string, DesktopUsageApplication[]>();
  for (const site of browserSites) {
    const browserId = site.browserId ?? 'chrome';
    sitesByBrowser.set(browserId, [...(sitesByBrowser.get(browserId) ?? []), site]);
  }
  const consumedNativeIds = new Set<string>();
  const browserParents = [...sitesByBrowser.entries()].map(([browserId, sites]): DisplayApplication => {
    const meta = browserMeta(browserId);
    const native = applications.find((application) => application.applicationId === meta.applicationId);
    if (native) consumedNativeIds.add(native.applicationId);
    const seed = native ?? sites[0];
    return {
      application: {
        ...seed,
        applicationId: meta.applicationId,
        applicationName: meta.label,
        browserId,
        category: 'browser',
        purpose: 'unknown',
        classificationConfidence: native?.classificationConfidence ?? 0.35,
        classificationProvenance: native?.classificationProvenance ?? 'unclassified',
        // Native browser foreground without an active-domain record remains
        // private coverage evidence. It is not shown as meaningful usage.
        durationSeconds: sites.reduce((total, site) => total + site.durationSeconds, 0),
        sessions: sites.flatMap((site) => site.sessions).sort((a, b) => a.startedAt.localeCompare(b.startedAt)),
      },
      browserSites: sites.sort((a, b) => b.durationSeconds - a.durationSeconds),
    };
  });
  return [
    ...applications.filter((application) => !application.applicationId.startsWith('web:') && !consumedNativeIds.has(application.applicationId))
      .map((application) => ({ application, browserSites: [] })),
    ...browserParents,
  ].sort((a, b) => b.application.durationSeconds - a.application.durationSeconds);
}

function browserMeta(browserId: string) {
  return ({
    chrome: { applicationId: 'chrome', label: 'Google Chrome' },
    edge: { applicationId: 'msedge', label: 'Microsoft Edge' },
    brave: { applicationId: 'brave', label: 'Brave' },
    opera: { applicationId: 'opera', label: 'Opera' },
    firefox: { applicationId: 'firefox', label: 'Firefox' },
    safari: { applicationId: 'safari', label: 'Safari' },
  } as Record<string, { applicationId: string; label: string }>)[browserId] ?? { applicationId: browserId, label: 'Browser' };
}
