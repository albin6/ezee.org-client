import { RouterProvider } from 'react-router-dom';
import { ConfigProvider, App as AntdApp } from 'antd';
import { router } from '@/app/router';
import { PWAInstallPrompt } from '@/shared/components/PWAInstallPrompt';
import { useEffect } from 'react';

function App() {
  useEffect(() => {
    if ('serviceWorker' in navigator) {
      window.addEventListener('load', () => {
        navigator.serviceWorker.register('/sw.js').catch((error) => {
          console.error('Service Worker registration failed:', error);
        });
      });
    }
  }, []);
  return (
    <ConfigProvider
      theme={{
        token: {
          colorPrimary: '#9333ea', // Tailwind purple-600
          borderRadius: 8,
          fontFamily: 'inherit', // Uses the body font defined in Tailwind
          colorBgContainer: '#ffffff',
          colorTextBase: '#111827', // Tailwind gray-900
        },
        components: {
          Layout: {
            headerBg: '#ffffff',
            bodyBg: '#f9fafb', // Tailwind gray-50
            siderBg: '#111827', // Tailwind gray-900
          },
          Card: {
            paddingLG: 24,
            boxShadow: '0 1px 2px 0 rgb(0 0 0 / 0.05)', // Tailwind shadow-sm
          },
          Button: {
            controlHeightLG: 48, // Used in login page for large buttons
          },
          Menu: {
            darkItemBg: '#111827', // Tailwind gray-900
            darkSubMenuItemBg: '#111827',
            darkItemSelectedBg: '#9333ea', // Tailwind purple-600
          }
        },
      }}
    >
      <AntdApp>
        <RouterProvider router={router} />
        <PWAInstallPrompt />
      </AntdApp>
    </ConfigProvider>
  );
}

export default App;
