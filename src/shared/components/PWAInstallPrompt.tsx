import React, { useState, useEffect } from 'react';
import { Modal, Button, Typography, Space } from 'antd';
import { ShareAltOutlined, PlusSquareOutlined } from '@ant-design/icons';

const { Text, Title, Paragraph } = Typography;

export const PWAInstallPrompt: React.FC = () => {
  const [deferredPrompt, setDeferredPrompt] = useState<any>(null);
  const [_isIOS, setIsIOS] = useState(false);
  const [showIOSPrompt, setShowIOSPrompt] = useState(false);
  const [isStandalone, setIsStandalone] = useState(false);

  useEffect(() => {
    // Check if app is already installed/running in standalone
    const _isStandalone = window.matchMedia('(display-mode: standalone)').matches || (window.navigator as any).standalone;
    setIsStandalone(!!_isStandalone);

    if (_isStandalone) return; // Don't show prompts if already installed

    // Detect iOS Safari
    const userAgent = window.navigator.userAgent.toLowerCase();
    const isIOSDevice = /iphone|ipad|ipod/.test(userAgent);
    // iOS Safari does not support beforeinstallprompt, so we check user agent
    if (isIOSDevice) {
      setIsIOS(true);
      // Optional: use localStorage to only show once a day or once per session
      const hasSeenPrompt = localStorage.getItem('pwa_ios_prompt_seen');
      if (!hasSeenPrompt) {
        setShowIOSPrompt(true);
      }
    }

    // Android/Chrome install prompt
    const handleBeforeInstallPrompt = (e: Event) => {
      e.preventDefault();
      setDeferredPrompt(e);
      // Automatically show the native prompt by triggering it immediately or let Chrome handle its own mini-infobar.
      // The prompt will just be available if the user clicks a custom install button.
      // But Chrome usually shows a mini infobar automatically. 
      // If we want a custom button, we keep deferredPrompt.
    };

    window.addEventListener('beforeinstallprompt', handleBeforeInstallPrompt);

    return () => {
      window.removeEventListener('beforeinstallprompt', handleBeforeInstallPrompt);
    };
  }, []);

  const handleInstallClick = async () => {
    if (deferredPrompt) {
      deferredPrompt.prompt();
      const { outcome } = await deferredPrompt.userChoice;
      if (outcome === 'accepted') {
        setDeferredPrompt(null);
      }
    }
  };

  const handleCloseIOSPrompt = () => {
    setShowIOSPrompt(false);
    localStorage.setItem('pwa_ios_prompt_seen', 'true');
  };

  if (isStandalone) return null;

  return (
    <>
      {/* Custom Install Button for Android/Desktop (optional, as Chrome shows mini-infobar natively, but having this ensures visibility) */}
      {deferredPrompt && (
        <div className="fixed bottom-4 left-4 right-4 md:left-auto md:right-4 z-50 bg-white p-4 rounded-xl shadow-lg border border-gray-100 flex items-center justify-between gap-4 max-w-sm">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 bg-black rounded-full flex items-center justify-center text-white font-bold text-xs">
              EZEE
            </div>
            <div>
              <Text strong className="block">Ezee Org</Text>
              <Text type="secondary" className="text-xs">ezee-org-client.vercel.app</Text>
            </div>
          </div>
          <Button type="primary" shape="round" onClick={handleInstallClick}>
            Install App
          </Button>
        </div>
      )}

      {/* Custom Modal for iOS Safari */}
      <Modal
        title={null}
        open={showIOSPrompt}
        onCancel={handleCloseIOSPrompt}
        footer={null}
        centered
        className="ios-pwa-modal"
        styles={{
          body: { padding: '24px 16px' }
        }}
      >
        <div className="text-center flex flex-col items-center">
          <div className="w-16 h-16 bg-black rounded-2xl flex items-center justify-center text-white font-bold text-sm mb-4">
            EZEE ORG
          </div>
          <Title level={4} style={{ marginBottom: 8 }}>Install Web App</Title>
          <Paragraph className="text-gray-500 mb-6">
            Install this application on your home screen for quick and easy access when you're on the go.
          </Paragraph>

          <div className="bg-gray-50 rounded-lg p-4 w-full text-left">
            <Space direction="vertical" size="middle" className="w-full">
              <div className="flex items-start gap-3">
                <div className="mt-1"><ShareAltOutlined className="text-blue-500 text-xl" /></div>
                <div>
                  <Text strong>1. Tap the Share icon</Text>
                  <div className="text-xs text-gray-500">Located at the bottom of your Safari window.</div>
                </div>
              </div>

              <div className="flex items-start gap-3">
                <div className="mt-1"><PlusSquareOutlined className="text-gray-700 text-xl" /></div>
                <div>
                  <Text strong>2. Select "Add to Home Screen"</Text>
                  <div className="text-xs text-gray-500">Scroll down the menu to find this option.</div>
                </div>
              </div>
            </Space>
          </div>

          <Button type="primary" size="large" block className="mt-6" onClick={handleCloseIOSPrompt}>
            Got it
          </Button>
        </div>
      </Modal>
    </>
  );
};
