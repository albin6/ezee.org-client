import React, { useState, useRef, useEffect } from 'react';
import { Button } from 'antd';
import {
  PlayCircleFilled,
  PauseCircleFilled,
  DeleteOutlined,
  CustomerServiceOutlined,
} from '@ant-design/icons';

interface AudioPreviewPlayerProps {
  src: string;
  blob?: Blob | null;
  duration?: number;
  onDiscard: () => void;
  disabled?: boolean;
}

export const AudioPreviewPlayer: React.FC<AudioPreviewPlayerProps> = ({
  src,
  blob,
  duration: initialDuration = 0,
  onDiscard,
  disabled = false,
}) => {
  const audioRef = useRef<HTMLAudioElement>(null);
  const [isPlaying, setIsPlaying] = useState(false);
  const [duration, setDuration] = useState(initialDuration);
  const [currentTime, setCurrentTime] = useState(0);

  useEffect(() => {
    const audio = audioRef.current;
    if (!audio) return;

    const setAudioData = () => {
      if (audio.duration && isFinite(audio.duration)) {
        setDuration(Math.max(audio.duration, initialDuration));
      } else if (initialDuration > 0) {
        setDuration(initialDuration);
      }
    };

    const setAudioTime = () => {
      setCurrentTime(audio.currentTime);
    };

    const handleEnded = () => {
      setIsPlaying(false);
      setCurrentTime(0);
    };

    audio.addEventListener('loadedmetadata', setAudioData);
    audio.addEventListener('timeupdate', setAudioTime);
    audio.addEventListener('ended', handleEnded);

    return () => {
      audio.removeEventListener('loadedmetadata', setAudioData);
      audio.removeEventListener('timeupdate', setAudioTime);
      audio.removeEventListener('ended', handleEnded);
    };
  }, [src, initialDuration]);

  const togglePlayPause = () => {
    const audio = audioRef.current;
    if (!audio) return;

    if (isPlaying) {
      audio.pause();
      setIsPlaying(false);
    } else {
      audio.play().then(() => {
        setIsPlaying(true);
      }).catch(err => {
        console.error('Audio preview play error:', err);
      });
    }
  };

  const handleSeek = (e: React.ChangeEvent<HTMLInputElement>) => {
    const audio = audioRef.current;
    if (!audio) return;
    const time = Number(e.target.value);
    audio.currentTime = time;
    setCurrentTime(time);
  };

  const formatTime = (time: number) => {
    if (isNaN(time) || !isFinite(time)) return '0:00';
    const mins = Math.floor(time / 60);
    const secs = Math.floor(time % 60);
    return `${mins}:${secs < 10 ? '0' : ''}${secs}`;
  };

  const progressPercent = duration ? (currentTime / duration) * 100 : 0;
  const sliderBackground = `linear-gradient(to right, #00a884 ${progressPercent}%, rgba(0,0,0,0.12) ${progressPercent}%)`;

  const sizeText = blob && blob.size > 0
    ? (blob.size > 1024 * 1024
      ? `${(blob.size / (1024 * 1024)).toFixed(1)} MB`
      : `${Math.round(blob.size / 1024)} KB`)
    : '';

  return (
    <div className="flex items-center gap-2.5 w-full py-1 px-1">
      <audio ref={audioRef} src={src} preload="metadata" />

      {/* Play/Pause Button */}
      <Button
        type="text"
        shape="circle"
        size="small"
        className="flex-shrink-0 w-8 h-8 flex items-center justify-center p-0 border-none hover:bg-black/5"
        onClick={togglePlayPause}
        disabled={disabled}
      >
        {isPlaying ? (
          <PauseCircleFilled className="text-2xl text-emerald-600" />
        ) : (
          <PlayCircleFilled className="text-2xl text-emerald-600" />
        )}
      </Button>

      {/* Scrubber & Duration */}
      <div className="flex-1 flex flex-col justify-center gap-0.5">
        <div className="relative w-full h-2.5 flex items-center">
          <input
            type="range"
            min={0}
            max={duration || 100}
            value={currentTime}
            onChange={handleSeek}
            disabled={disabled}
            className="w-full h-1 appearance-none rounded-full cursor-pointer outline-none"
            style={{ background: sliderBackground }}
          />
        </div>
        <div className="flex justify-between items-center text-[10px] text-gray-500 font-medium">
          <span>{formatTime(currentTime)} / {formatTime(duration || initialDuration)}</span>
          {sizeText && <span className="text-[10px] text-gray-400 font-mono">{sizeText}</span>}
        </div>
      </div>

      {/* Voice Badge */}
      <div className="flex items-center gap-1 px-1.5 py-0.5 rounded bg-emerald-50 text-emerald-700 text-[10px] font-medium shrink-0">
        <CustomerServiceOutlined />
        <span>Voice Preview</span>
      </div>

      {/* Discard Button */}
      <Button
        type="text"
        shape="circle"
        size="small"
        icon={<DeleteOutlined className="text-gray-400 hover:text-red-500 text-sm" />}
        onClick={onDiscard}
        disabled={disabled}
        title="Discard audio"
        className="shrink-0 flex items-center justify-center hover:bg-red-50"
      />
    </div>
  );
};
