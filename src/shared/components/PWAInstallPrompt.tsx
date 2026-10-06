import React, { useState, useEffect, useCallback, useRef } from 'react';
import { Button } from 'antd';
import { 
  DownloadOutlined, 
  CloseOutlined, 
  ShareAltOutlined, 
  PlusSquareOutlined,
  ThunderboltOutlined,
  AppstoreAddOutlined,
  WifiOutlined
} from '@ant-design/icons';
import { 
  usePWAStore, 
  checkIsDismissedRecently, 
  type BeforeInstallPromptEvent 
} from '../stores/pwa.store';

export const PWAInstallPrompt: React.FC = () => {
  const {
    deferredPrompt,
    isStandalone,
    showPrompt,
    isIOS,
    setDeferredPrompt,
    setIsStandalone,
    setShowPrompt,
    closePrompt,
    promptInstall
  } = usePWAStore();

  const [isExiting, setIsExiting] = useState<boolean>(false);
  const exitTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const triggerExitAnimation = useCallback((onComplete: () => void) => {
    setIsExiting(true);
    if (exitTimerRef.current) {
      clearTimeout(exitTimerRef.current);
    }
    exitTimerRef.current = setTimeout(() => {
      onComplete();
      setIsExiting(false);
    }, 240);
  }, []);

  const handleDismiss = useCallback(() => {
    triggerExitAnimation(() => {
      closePrompt({ recordDismissal: true });
    });
  }, [triggerExitAnimation, closePrompt]);

  const handleInstallClick = async () => {
    const outcome = await promptInstall();
    if (outcome === 'accepted') {
      triggerExitAnimation(() => {
        closePrompt({ recordDismissal: false });
      });
    }
  };

  useEffect(() => {
    if (isStandalone) return;

    const isDismissed = checkIsDismissedRecently();

    if (isIOS && !isDismissed) {
      setShowPrompt(true);
    }

    // Android / Chrome / Edge install prompt listener
    const handleBeforeInstallPrompt = (e: Event) => {
      e.preventDefault();
      const promptEvent = e as BeforeInstallPromptEvent;
      setDeferredPrompt(promptEvent);
      if (!isDismissed) {
        setShowPrompt(true);
      }
    };

    // When the app is successfully installed
    const handleAppInstalled = () => {
      setIsStandalone(true);
      setDeferredPrompt(null);
      setShowPrompt(false);
    };

    // Listen to display-mode changes
    const mediaQueryList = window.matchMedia('(display-mode: standalone)');
    const handleDisplayModeChange = (e: MediaQueryListEvent) => {
      if (e.matches) {
        setIsStandalone(true);
        setShowPrompt(false);
      }
    };

    window.addEventListener('beforeinstallprompt', handleBeforeInstallPrompt);
    window.addEventListener('appinstalled', handleAppInstalled);
    mediaQueryList.addEventListener('change', handleDisplayModeChange);

    return () => {
      window.removeEventListener('beforeinstallprompt', handleBeforeInstallPrompt);
      window.removeEventListener('appinstalled', handleAppInstalled);
      mediaQueryList.removeEventListener('change', handleDisplayModeChange);
      if (exitTimerRef.current) {
        clearTimeout(exitTimerRef.current);
      }
    };
  }, [isStandalone, isIOS, setDeferredPrompt, setIsStandalone, setShowPrompt]);

  // Handle ESC key to dismiss prompt
  useEffect(() => {
    if (!showPrompt) return;

    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        handleDismiss();
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => {
      window.removeEventListener('keydown', handleKeyDown);
    };
  }, [showPrompt, handleDismiss]);

  if (isStandalone || !showPrompt) return null;

  const animationClass = isExiting ? 'animate-pwa-exit' : 'animate-pwa-enter';
  const isIOSPrompt = isIOS && !deferredPrompt;

  return (
    <div
      role="region"
      aria-label="Install Application Prompt"
      aria-live="polite"
      className={`fixed z-50 transition-all ${animationClass} 
        bottom-0 left-0 right-0 
        md:bottom-6 md:right-6 md:left-auto md:w-[380px] md:max-w-sm`}
    >
      <div 
        className="bg-white/98 backdrop-blur-md border-t md:border border-gray-200/90 md:rounded-2xl rounded-t-2xl shadow-[0_-8px_30px_rgba(0,0,0,0.12)] md:shadow-xl md:shadow-gray-950/10 p-4 sm:p-5 text-gray-900"
        style={{ paddingBottom: 'max(16px, calc(16px + env(safe-area-inset-bottom, 0px)))' }}
      >
        {/* Mobile Drag Indicator */}
        <div className="w-10 h-1 bg-gray-200 rounded-full mx-auto mb-3.5 md:hidden" />

        {/* Header Row: App Identity + Dismiss Button */}
        <div className="flex items-start justify-between gap-3">
          <div className="flex items-center gap-3 min-w-0">
            {/* Branded Icon Badge */}
            <div className="w-10 h-10 sm:w-11 sm:h-11 rounded-xl bg-gradient-to-tr from-blue-600 via-indigo-600 to-purple-600 flex items-center justify-center text-white font-black text-sm shadow-xs tracking-wider shrink-0 select-none ring-1 ring-black/5">
              EZ
            </div>
            <div className="min-w-0">
              <div className="flex items-center gap-1.5">
                <span className="font-bold text-gray-900 text-sm sm:text-base tracking-tight leading-tight">
                  Install ezee<span className="text-purple-600">.org</span>
                </span>
                <span className="hidden sm:inline-flex text-[10px] font-semibold uppercase px-1.5 py-0.2 bg-purple-50 text-purple-700 rounded-md border border-purple-200/60">
                  Web App
                </span>
              </div>
              <p className="text-xs text-gray-500 leading-snug mt-0.5 truncate">
                {isIOSPrompt ? 'Add to Home Screen on iOS' : 'Install for a better experience'}
              </p>
            </div>
          </div>

          {/* Accessible Close Button */}
          <button
            type="button"
            onClick={handleDismiss}
            aria-label="Dismiss install prompt"
            className="w-8 h-8 rounded-full text-gray-400 hover:text-gray-700 hover:bg-gray-100/80 active:bg-gray-200 flex items-center justify-center transition-colors cursor-pointer shrink-0 -mr-1 -mt-1 focus:outline-hidden focus:ring-2 focus:ring-purple-500/30"
          >
            <CloseOutlined className="text-xs" />
          </button>
        </div>

        {/* Content Section: Android & Desktop Install */}
        {!isIOSPrompt && (
          <div className="mt-3">
            <p className="text-xs text-gray-600 leading-relaxed hidden sm:block">
              Add to your device for instant launch, offline capability, and a distraction-free full-screen workspace.
            </p>

            {/* Mobile Feature Pills */}
            <div className="flex items-center gap-2 mt-2.5 mb-3.5 sm:hidden overflow-x-auto pb-0.5 scrollbar-none">
              <span className="inline-flex items-center gap-1 text-[11px] font-medium text-gray-600 bg-gray-50 border border-gray-100 rounded-md px-2 py-1 shrink-0">
                <ThunderboltOutlined className="text-amber-500 text-xs" /> Faster Load
              </span>
              <span className="inline-flex items-center gap-1 text-[11px] font-medium text-gray-600 bg-gray-50 border border-gray-100 rounded-md px-2 py-1 shrink-0">
                <AppstoreAddOutlined className="text-blue-500 text-xs" /> Full Screen
              </span>
              <span className="inline-flex items-center gap-1 text-[11px] font-medium text-gray-600 bg-gray-50 border border-gray-100 rounded-md px-2 py-1 shrink-0">
                <WifiOutlined className="text-emerald-500 text-xs" /> Offline Ready
              </span>
            </div>

            {/* Action Buttons: Responsive Touch & Desktop Layout */}
            <div className="flex items-center gap-2.5 mt-3 sm:mt-4">
              <Button
                type="primary"
                shape="round"
                size="large"
                icon={<DownloadOutlined className="text-sm" />}
                onClick={handleInstallClick}
                className="flex-1 sm:flex-initial font-semibold shadow-xs bg-purple-600 hover:bg-purple-700 min-h-[44px] sm:min-h-[38px]"
              >
                Install App
              </Button>
              <Button
                type="text"
                shape="round"
                size="large"
                onClick={handleDismiss}
                className="text-gray-500 hover:text-gray-800 font-medium min-h-[44px] sm:min-h-[38px]"
              >
                Not now
              </Button>
            </div>
          </div>
        )}

        {/* Content Section: iOS Safari Step-by-Step Guidance */}
        {isIOSPrompt && (
          <div className="mt-3">
            <p className="text-xs text-gray-600 mb-3 leading-relaxed">
              Safari on iOS requires manual installation. Follow these two quick steps to add the app to your Home Screen:
            </p>

            {/* iOS Visual Step Cards */}
            <div className="bg-gray-50/90 rounded-xl p-3 border border-gray-100 space-y-2.5">
              <div className="flex items-start gap-2.5">
                <div className="w-7 h-7 rounded-lg bg-blue-50 text-blue-600 border border-blue-100 flex items-center justify-center shrink-0 mt-0.5">
                  <ShareAltOutlined className="text-sm" />
                </div>
                <div className="min-w-0">
                  <span className="text-xs font-semibold text-gray-800 block leading-tight">
                    1. Tap the Share button
                  </span>
                  <span className="text-[11px] text-gray-500 block leading-normal mt-0.5">
                    Located in Safari's bottom browser bar
                  </span>
                </div>
              </div>

              <div className="h-px bg-gray-200/60" />

              <div className="flex items-start gap-2.5">
                <div className="w-7 h-7 rounded-lg bg-gray-100 text-gray-700 border border-gray-200/80 flex items-center justify-center shrink-0 mt-0.5">
                  <PlusSquareOutlined className="text-sm" />
                </div>
                <div className="min-w-0">
                  <span className="text-xs font-semibold text-gray-800 block leading-tight">
                    2. Select &quot;Add to Home Screen&quot;
                  </span>
                  <span className="text-[11px] text-gray-500 block leading-normal mt-0.5">
                    Scroll down in the share sheet and tap Add
                  </span>
                </div>
              </div>
            </div>

            {/* Confirmation / Dismiss Action */}
            <div className="mt-3 sm:mt-4">
              <Button
                type="primary"
                shape="round"
                size="large"
                block
                onClick={handleDismiss}
                className="font-semibold shadow-xs bg-purple-600 hover:bg-purple-700 min-h-[44px]"
              >
                Got it
              </Button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
};
