interface AtiraDesktopBridge {
  repository: {
    read(): Promise<unknown | null>;
    write(state: unknown): Promise<void>;
  };
  collector: {
    status(): Promise<{ paused: boolean; running: boolean }>;
    setPaused(paused: boolean): Promise<{ paused: boolean; running: boolean }>;
    delete(range: '7d' | '30d' | 'all'): Promise<{ deleted: number }>;
    createBrowserPairingCode(): Promise<{ code: string; expiresAt: string }>;
    unpairBrowser(): Promise<BrowserIntegrationStatus>;
    createDevicePairingCode(): Promise<{ code: string; expiresAt: string; addresses: string[] }>;
    unpairDevice(): Promise<{ paired: boolean; pairedAt: string | null; lastSyncedAt: string | null }>;
  };
}

interface BrowserIntegrationStatus {
  paired: boolean;
  pairedAt: string | null;
  lastObservedAt: string | null;
}

declare global {
  var atiraDesktop: AtiraDesktopBridge | undefined;
}

export {};
