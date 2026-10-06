import React from 'react';
import { Button } from 'antd';
import { SyncOutlined, CloseOutlined, CloudDownloadOutlined } from '@ant-design/icons';
import { useVersionUpdate } from '@/shared/hooks/useVersionUpdate';

export const VersionUpdatePrompt: React.FC = () => {
  const { hasUpdate, isUpdating, dismissUpdate, applyUpdate } = useVersionUpdate();

  if (!hasUpdate) return null;

  return (
    <aside
      role="alert"
      aria-live="polite"
      className="fixed z-50 bottom-4 left-4 right-4 sm:left-6 sm:right-auto sm:max-w-md animate-in fade-in slide-in-from-bottom-5 duration-300"
    >
      <div className="bg-gray-900/95 backdrop-blur-md text-white border border-gray-700/80 rounded-2xl p-4 shadow-2xl flex items-center justify-between gap-3.5 ring-1 ring-white/10">
        {/* Icon & Message */}
        <div className="flex items-center gap-3 min-w-0">
          <div className="w-9 h-9 rounded-xl bg-purple-500/20 border border-purple-500/30 flex items-center justify-center shrink-0 text-purple-400">
            <CloudDownloadOutlined className="text-lg" />
          </div>
          <div className="min-w-0">
            <div className="flex items-center gap-2">
              <span className="relative flex h-2 w-2">
                <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-purple-400 opacity-75"></span>
                <span className="relative inline-flex rounded-full h-2 w-2 bg-purple-500"></span>
              </span>
              <p className="font-semibold text-sm text-gray-100 tracking-tight leading-snug">
                New Version Available
              </p>
            </div>
            <p className="text-xs text-gray-400 truncate mt-0.5">
              Update to get the latest features and fixes.
            </p>
          </div>
        </div>

        {/* Action Buttons */}
        <div className="flex items-center gap-2 shrink-0">
          <Button
            type="primary"
            size="small"
            loading={isUpdating}
            icon={<SyncOutlined spin={isUpdating} />}
            onClick={() => void applyUpdate()}
            aria-label="Apply application update"
            className="!bg-purple-600 hover:!bg-purple-500 !border-none !text-xs !font-semibold !h-8 !px-3 !rounded-lg"
          >
            Update
          </Button>
          <button
            onClick={dismissUpdate}
            aria-label="Dismiss notification"
            className="text-gray-400 hover:text-gray-200 transition-colors p-1.5 rounded-lg hover:bg-gray-800 focus:outline-none focus:ring-2 focus:ring-purple-500 cursor-pointer"
          >
            <CloseOutlined className="text-xs" />
          </button>
        </div>
      </div>
    </aside>
  );
};
