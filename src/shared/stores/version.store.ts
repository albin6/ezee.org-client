import { create } from 'zustand';

export const CURRENT_BUILD_VERSION = (import.meta.env.VITE_APP_VERSION as string) || 'dev';
export const CURRENT_BUILD_TIME = (import.meta.env.VITE_APP_BUILD_TIME as string) || '';

export const DISMISS_STORAGE_KEY = 'app_version_update_dismissed';
export const DISMISS_DURATION_MS = 24 * 60 * 60 * 1000; // 24 hours
export const MIN_CHECK_INTERVAL_MS = 5 * 60 * 1000; // 5 minutes throttle

interface DismissedRecord {
  version: string;
  timestamp: number;
}

export const checkIsDismissedRecently = (remoteVersion: string): boolean => {
  if (typeof window === 'undefined') return false;
  try {
    const raw = localStorage.getItem(DISMISS_STORAGE_KEY);
    if (!raw) return false;
    const record: DismissedRecord = JSON.parse(raw);
    if (record.version !== remoteVersion) return false;
    return Date.now() - record.timestamp < DISMISS_DURATION_MS;
  } catch {
    return false;
  }
};

export const recordDismissal = (remoteVersion: string): void => {
  if (typeof window === 'undefined') return;
  try {
    const record: DismissedRecord = {
      version: remoteVersion,
      timestamp: Date.now(),
    };
    localStorage.setItem(DISMISS_STORAGE_KEY, JSON.stringify(record));
  } catch {
    // Ignore localStorage write failures (e.g. private mode quota)
  }
};

interface VersionState {
  currentVersion: string;
  currentBuildTime: string;
  latestVersion: string | null;
  latestBuildTime: string | null;
  hasUpdate: boolean;
  isUpdating: boolean;
  lastCheckedAt: number;
  checkForUpdates: (force?: boolean) => Promise<boolean>;
  dismissUpdate: () => void;
  applyUpdate: () => Promise<void>;
}

export const useVersionStore = create<VersionState>((set, get) => ({
  currentVersion: CURRENT_BUILD_VERSION,
  currentBuildTime: CURRENT_BUILD_TIME,
  latestVersion: null,
  latestBuildTime: null,
  hasUpdate: false,
  isUpdating: false,
  lastCheckedAt: 0,

  checkForUpdates: async (force = false) => {
    if (typeof window === 'undefined') return false;
    // Skip in local development unless explicitly forced for testing
    if (import.meta.env.DEV && !force) return false;

    const now = Date.now();
    const { lastCheckedAt, hasUpdate } = get();

    // Respect throttle threshold
    if (!force && now - lastCheckedAt < MIN_CHECK_INTERVAL_MS) {
      return hasUpdate;
    }

    if (typeof navigator !== 'undefined' && !navigator.onLine) {
      return hasUpdate;
    }

    set({ lastCheckedAt: now });

    try {
      const response = await fetch(`/version.json?_t=${now}`, {
        method: 'GET',
        cache: 'no-store',
        headers: {
          'Cache-Control': 'no-cache, no-store, must-revalidate',
          'Pragma': 'no-cache',
        },
      });

      if (!response.ok) return hasUpdate;

      const data: { version?: string; buildTime?: string } = await response.json();
      const remoteVersion = data.version;

      if (
        remoteVersion &&
        remoteVersion !== CURRENT_BUILD_VERSION &&
        remoteVersion !== 'dev'
      ) {
        if (!checkIsDismissedRecently(remoteVersion)) {
          set({
            hasUpdate: true,
            latestVersion: remoteVersion,
            latestBuildTime: data.buildTime || null,
          });
          return true;
        }
      }
    } catch {
      // Network drops / offline failures are silently ignored to prevent unhandled rejections
    }

    return get().hasUpdate;
  },

  dismissUpdate: () => {
    const { latestVersion } = get();
    if (latestVersion) {
      recordDismissal(latestVersion);
    }
    set({ hasUpdate: false });
  },

  applyUpdate: async () => {
    set({ isUpdating: true });

    try {
      if ('serviceWorker' in navigator) {
        const registration = await navigator.serviceWorker.getRegistration();
        if (registration) {
          if (registration.waiting) {
            registration.waiting.postMessage({ type: 'SKIP_WAITING' });
          }
          await registration.update().catch(() => {});
        }
      }
    } catch (err) {
      console.warn('[VersionUpdate] Error notifying service worker:', err);
    }

    // Clear dynamic chunk retry locks
    if (typeof sessionStorage !== 'undefined') {
      sessionStorage.removeItem('chunk_reload_lock');
    }

    // Refresh application to load latest assets
    window.location.reload();
  },
}));
