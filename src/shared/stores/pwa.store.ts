import { create } from 'zustand';

export interface BeforeInstallPromptEvent extends Event {
  prompt: () => Promise<void>;
  userChoice: Promise<{ outcome: 'accepted' | 'dismissed'; platform: string }>;
}

export const DISMISS_STORAGE_KEY = 'pwa_prompt_dismissed_at';
export const DISMISS_DURATION_MS = 24 * 60 * 60 * 1000; // 24 hours

export const checkIsStandalone = (): boolean => {
  if (typeof window === 'undefined') return false;
  return (
    window.matchMedia('(display-mode: standalone)').matches ||
    !!(window.navigator as unknown as { standalone?: boolean }).standalone
  );
};

export const checkIsDismissedRecently = (): boolean => {
  if (typeof window === 'undefined') return false;
  try {
    const lastDismissed = localStorage.getItem(DISMISS_STORAGE_KEY);
    if (!lastDismissed) return false;
    return Date.now() - parseInt(lastDismissed, 10) < DISMISS_DURATION_MS;
  } catch {
    return false;
  }
};

export const checkIsIOSDevice = (): boolean => {
  if (typeof window === 'undefined') return false;
  const userAgent = window.navigator.userAgent.toLowerCase();
  return /iphone|ipad|ipod/.test(userAgent) && !(window as unknown as { MSStream?: unknown }).MSStream;
};

interface PWAState {
  deferredPrompt: BeforeInstallPromptEvent | null;
  isStandalone: boolean;
  showPrompt: boolean;
  isIOS: boolean;
  canInstall: boolean;
  setDeferredPrompt: (prompt: BeforeInstallPromptEvent | null) => void;
  setIsStandalone: (isStandalone: boolean) => void;
  setShowPrompt: (show: boolean) => void;
  openPrompt: () => void;
  closePrompt: (options?: { recordDismissal?: boolean }) => void;
  promptInstall: () => Promise<'accepted' | 'dismissed' | 'manual'>;
}

export const usePWAStore = create<PWAState>((set, get) => ({
  deferredPrompt: null,
  isStandalone: checkIsStandalone(),
  showPrompt: false,
  isIOS: checkIsIOSDevice(),
  canInstall: checkIsIOSDevice(),

  setDeferredPrompt: (prompt) => set({ deferredPrompt: prompt, canInstall: !!prompt || get().isIOS }),
  setIsStandalone: (isStandalone) => set({ isStandalone }),
  setShowPrompt: (show) => set({ showPrompt: show }),

  openPrompt: () => set({ showPrompt: true }),

  closePrompt: (options = { recordDismissal: true }) => {
    if (options.recordDismissal) {
      try {
        localStorage.setItem(DISMISS_STORAGE_KEY, Date.now().toString());
      } catch {
        // Ignore storage errors in private browsing
      }
    }
    set({ showPrompt: false });
  },

  promptInstall: async () => {
    const { deferredPrompt } = get();

    if (deferredPrompt) {
      try {
        await deferredPrompt.prompt();
        const { outcome } = await deferredPrompt.userChoice;
        if (outcome === 'accepted') {
          set({ deferredPrompt: null, showPrompt: false, canInstall: false });
        }
        return outcome;
      } catch (err) {
        console.error('PWA install error:', err);
      }
    }

    // If on iOS or deferredPrompt is not directly triggerable, open guidance prompt
    set({ showPrompt: true });
    return 'manual';
  },
}));
