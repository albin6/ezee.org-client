import { useEffect } from 'react';
import { useVersionStore } from '@/shared/stores/version.store';

const HEARTBEAT_INTERVAL_MS = 20 * 60 * 1000; // 20 minutes

export function useVersionUpdate() {
  const { hasUpdate, isUpdating, latestVersion, checkForUpdates, dismissUpdate, applyUpdate } =
    useVersionStore();

  useEffect(() => {
    // Only run periodic background checks in production
    if (import.meta.env.DEV) return;

    // Check once on mount
    checkForUpdates();

    // Check when user returns to the tab
    const handleVisibilityChange = () => {
      if (document.visibilityState === 'visible') {
        checkForUpdates();
      }
    };

    // Check when network connection is restored
    const handleOnline = () => {
      checkForUpdates();
    };

    document.addEventListener('visibilitychange', handleVisibilityChange);
    window.addEventListener('online', handleOnline);

    // Heartbeat check with randomized jitter (+- 60s) to avoid edge synchronization
    const jitter = Math.floor(Math.random() * 120_000) - 60_000;
    const intervalTimer = setInterval(() => {
      checkForUpdates();
    }, HEARTBEAT_INTERVAL_MS + jitter);

    // Listen to service worker registration updates if available
    let swCleanup: (() => void) | undefined;
    if ('serviceWorker' in navigator) {
      navigator.serviceWorker.getRegistration().then((reg) => {
        if (!reg) return;
        const handleUpdateFound = () => {
          const installingWorker = reg.installing;
          if (installingWorker) {
            installingWorker.addEventListener('statechange', () => {
              if (installingWorker.state === 'installed' && navigator.serviceWorker.controller) {
                // New SW is installed and waiting
                checkForUpdates(true);
              }
            });
          }
        };
        reg.addEventListener('updatefound', handleUpdateFound);
        swCleanup = () => {
          reg.removeEventListener('updatefound', handleUpdateFound);
        };
      }).catch(() => {});
    }

    return () => {
      document.removeEventListener('visibilitychange', handleVisibilityChange);
      window.removeEventListener('online', handleOnline);
      clearInterval(intervalTimer);
      if (swCleanup) swCleanup();
    };
  }, [checkForUpdates]);

  return {
    hasUpdate,
    isUpdating,
    latestVersion,
    dismissUpdate,
    applyUpdate,
  };
}
