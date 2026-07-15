import React, { useState, useRef, useEffect } from 'react';
import { Button, Avatar } from 'antd';
import { PlayCircleFilled, PauseCircleFilled, AudioFilled, UserOutlined } from '@ant-design/icons';

interface VoiceMessagePlayerProps {
  src: string;
  isMe: boolean;
  avatarUrl?: string;
  userName?: string;
}

export const VoiceMessagePlayer: React.FC<VoiceMessagePlayerProps> = ({ src, isMe, avatarUrl, userName }) => {
  const audioRef = useRef<HTMLAudioElement>(null);
  const [isPlaying, setIsPlaying] = useState(false);
  const [duration, setDuration] = useState(0);
  const [currentTime, setCurrentTime] = useState(0);

  useEffect(() => {
    const audio = audioRef.current;
    if (!audio) return;

    const setAudioData = () => {
      if (audio.duration === Infinity || isNaN(audio.duration)) {
        audio.currentTime = 1e6;
        const fixDuration = () => {
          audio.removeEventListener('timeupdate', fixDuration);
          setDuration(audio.duration);
          audio.currentTime = 0;
        };
        audio.addEventListener('timeupdate', fixDuration);
      } else {
        setDuration(audio.duration);
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
  }, [src]);

  const togglePlayPause = () => {
    const audio = audioRef.current;
    if (!audio) return;

    if (isPlaying) {
      audio.pause();
    } else {
      audio.play();
    }
    setIsPlaying(!isPlaying);
  };

  const handleSeek = (e: React.ChangeEvent<HTMLInputElement>) => {
    const audio = audioRef.current;
    if (!audio) return;
    const time = Number(e.target.value);
    audio.currentTime = time;
    setCurrentTime(time);
  };

  const formatTime = (time: number) => {
    if (isNaN(time)) return '0:00';
    if (!isFinite(time)) return '0:00';
    const minutes = Math.floor(time / 60);
    const seconds = Math.floor(time % 60);
    return `${minutes}:${seconds < 10 ? '0' : ''}${seconds}`;
  };

  // Calculate percentage for gradient
  const progressPercent = duration ? (currentTime / duration) * 100 : 0;
  const sliderBackground = `linear-gradient(to right, ${isMe ? '#00a884' : '#1677ff'} ${progressPercent}%, ${isMe ? 'rgba(0,0,0,0.1)' : 'rgba(0,0,0,0.1)'} ${progressPercent}%)`;

  return (
    <div className="flex items-center gap-3 w-full min-w-[240px] sm:min-w-[280px] py-1 px-1">
      <audio ref={audioRef} src={src} preload="metadata" />
      
      {/* Play/Pause Button */}
      <Button 
        type="text" 
        shape="circle" 
        className="flex-shrink-0 w-10 h-10 flex items-center justify-center p-0 border-none hover:bg-black/5"
        onClick={togglePlayPause}
      >
        {isPlaying ? (
          <PauseCircleFilled className={`text-3xl ${isMe ? 'text-gray-500' : 'text-gray-400'}`} />
        ) : (
          <PlayCircleFilled className={`text-3xl ${isMe ? 'text-gray-500' : 'text-gray-400'}`} />
        )}
      </Button>
      
      {/* Waveform / Slider */}
      <div className="flex-1 flex flex-col justify-center h-full gap-1 pt-1">
        <div className="relative w-full h-3 flex items-center">
          <input
            type="range"
            min={0}
            max={duration || 100}
            value={currentTime}
            onChange={handleSeek}
            className="absolute w-full h-1.5 appearance-none rounded-full cursor-pointer outline-none z-10"
            style={{ 
              background: sliderBackground,
            }}
          />
          {/* Custom CSS to hide default thumb and show simple dot */}
          <style dangerouslySetInnerHTML={{__html: `
            input[type=range]::-webkit-slider-thumb {
              -webkit-appearance: none;
              appearance: none;
              width: 12px;
              height: 12px;
              border-radius: 50%;
              background: ${isMe ? '#00a884' : '#1677ff'};
              cursor: pointer;
            }
            input[type=range]::-moz-range-thumb {
              width: 12px;
              height: 12px;
              border-radius: 50%;
              background: ${isMe ? '#00a884' : '#1677ff'};
              cursor: pointer;
              border: none;
            }
          `}} />
        </div>
        <div className="flex justify-between items-center text-[11px] text-gray-500 font-medium">
          <span>{isPlaying ? formatTime(currentTime) : formatTime(duration)}</span>
        </div>
      </div>
      
      {/* Avatar with Mic */}
      <div className="relative flex-shrink-0 ml-2">
        <Avatar src={avatarUrl} icon={!avatarUrl ? <UserOutlined /> : undefined} size={32} className="bg-gray-300 shadow-sm" />
        <div className={`absolute -bottom-1 -left-1 rounded-full p-[3px] z-10 shadow-sm ${isMe ? 'bg-[#d9fdd3]' : 'bg-white'}`}>
          <AudioFilled className={`text-[10px] block ${isMe ? 'text-[#00a884]' : 'text-blue-500'}`} />
        </div>
      </div>
    </div>
  );
};
