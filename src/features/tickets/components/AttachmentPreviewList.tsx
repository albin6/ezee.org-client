import React from 'react';
import { Button, Image, Progress } from 'antd';
import {
  CloseOutlined,
  FilePdfOutlined,
  FileWordOutlined,
  FileTextOutlined,
  CustomerServiceOutlined,
} from '@ant-design/icons';

interface AttachmentPreviewListProps {
  attachments: File[];
  onRemove: (index: number) => void;
  isUploading?: boolean;
  uploadProgress?: number;
  onPreview?: (file: File) => void;
}

export function formatFileSize(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}

export const AttachmentPreviewList: React.FC<AttachmentPreviewListProps> = ({
  attachments,
  onRemove,
  isUploading = false,
  uploadProgress = 0,
  onPreview,
}) => {
  if (attachments.length === 0) return null;

  return (
    <div className="flex flex-col gap-1.5 p-2 mb-2 bg-gray-50/90 rounded-xl border border-gray-200 shadow-sm animate-fadeIn">
      <div className="flex flex-wrap gap-2">
        {attachments.map((file, index) => {
          const isImage = file.type.startsWith('image/') || /\.(jpg|jpeg|png|gif|webp|svg)$/i.test(file.name);
          const isAudio = file.type.startsWith('audio/') || /\.(mp3|wav|ogg|m4a|aac|webm)$/i.test(file.name);
          const isPdf = file.type === 'application/pdf' || /\.pdf$/i.test(file.name);
          const isDoc = file.type.includes('word') || /\.(doc|docx)$/i.test(file.name);

          return (
            <div
              key={`${file.name}-${index}-${file.size}`}
              className="flex items-center gap-2 bg-white border border-gray-200/80 rounded-lg p-1.5 pr-2 shadow-xs max-w-[240px] group transition-all hover:border-gray-300"
            >
              {/* Media Icon or Image Thumbnail */}
              {isImage ? (
                <div className="w-9 h-9 rounded overflow-hidden shrink-0 bg-gray-100 border border-gray-200">
                  <Image
                    src={URL.createObjectURL(file)}
                    alt={file.name}
                    width={36}
                    height={36}
                    className="w-full h-full object-cover"
                  />
                </div>
              ) : isPdf ? (
                <div className="w-9 h-9 rounded bg-red-50 text-red-600 flex flex-col items-center justify-center shrink-0 border border-red-100">
                  <FilePdfOutlined className="text-base" />
                  <span className="text-[8px] font-bold uppercase leading-none mt-0.5">PDF</span>
                </div>
              ) : isDoc ? (
                <div className="w-9 h-9 rounded bg-blue-50 text-blue-600 flex flex-col items-center justify-center shrink-0 border border-blue-100">
                  <FileWordOutlined className="text-base" />
                  <span className="text-[8px] font-bold uppercase leading-none mt-0.5">DOC</span>
                </div>
              ) : isAudio ? (
                <div className="w-9 h-9 rounded bg-emerald-50 text-emerald-600 flex flex-col items-center justify-center shrink-0 border border-emerald-100">
                  <CustomerServiceOutlined className="text-base" />
                  <span className="text-[8px] font-bold uppercase leading-none mt-0.5">AUDIO</span>
                </div>
              ) : (
                <div className="w-9 h-9 rounded bg-gray-100 text-gray-500 flex flex-col items-center justify-center shrink-0 border border-gray-200">
                  <FileTextOutlined className="text-base" />
                  <span className="text-[8px] font-bold uppercase leading-none mt-0.5">FILE</span>
                </div>
              )}

              {/* File Info */}
              <div
                className={`flex flex-col min-w-0 flex-1 ${onPreview && !isImage ? 'cursor-pointer' : ''}`}
                onClick={() => onPreview && onPreview(file)}
              >
                <span className="text-xs font-medium text-gray-800 truncate" title={file.name}>
                  {file.name}
                </span>
                <span className="text-[10px] text-gray-400 font-mono">
                  {formatFileSize(file.size)}
                </span>
              </div>

              {/* Remove Action */}
              <Button
                type="text"
                size="small"
                disabled={isUploading}
                icon={<CloseOutlined className="text-[10px] text-gray-400 group-hover:text-red-500" />}
                onClick={() => onRemove(index)}
                className="w-5 h-5 min-w-0 p-0 flex items-center justify-center rounded-full hover:bg-red-50"
                title={`Remove ${file.name}`}
              />
            </div>
          );
        })}
      </div>

      {/* Upload Progress Indicator */}
      {isUploading && (
        <div className="w-full mt-1 px-1">
          <div className="flex justify-between text-xs text-blue-600 mb-1 font-medium">
            <span className="flex items-center gap-1.5">
              <span className="w-2 h-2 rounded-full bg-blue-500 animate-ping" />
              Uploading attachments...
            </span>
            <span>{uploadProgress > 0 ? `${uploadProgress}%` : ''}</span>
          </div>
          <Progress
            percent={uploadProgress > 0 ? uploadProgress : undefined}
            status="active"
            size="small"
            showInfo={false}
            strokeColor="#1677ff"
          />
        </div>
      )}
    </div>
  );
};
