import React, { useRef, useEffect, useState, useCallback } from 'react';
import { Repeat, Play, Pause, Volume2, VolumeX } from 'lucide-react';

interface CanvasVideoPlayerProps {
  src: string;
  loopMode: number;
  frozenTime: number;
  onLoopModeChange: (mode: number) => void;
  onFrozenTimeChange: (time: number) => void;
  onDoubleClick: (e: React.MouseEvent) => void;
  onLoadedMetadata: () => void;
}

const CanvasVideoPlayer: React.FC<CanvasVideoPlayerProps> = ({
  src,
  loopMode,
  frozenTime,
  onLoopModeChange,
  onFrozenTimeChange,
  onDoubleClick,
  onLoadedMetadata,
}) => {
  const videoRef = useRef<HTMLVideoElement>(null);
  const [isPlaying, setIsPlaying] = useState(false);
  const [isMuted, setIsMuted] = useState(true);
  const [currentTime, setCurrentTime] = useState(0);
  const [duration, setDuration] = useState(0);
  const [showControls, setShowControls] = useState(false);
  const frozenTimeRef = useRef(frozenTime);
  frozenTimeRef.current = frozenTime;
  const loopModeRef = useRef(loopMode);
  loopModeRef.current = loopMode;
  const lastTimeUpdateRef = useRef(0);
  const frozenTimeSaveTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const containerRef = useRef<HTMLDivElement>(null);
  const isVisibleRef = useRef(true);

  useEffect(() => {
    const video = videoRef.current;
    if (!video) return;

    if (frozenTime > 0 && video.readyState >= 1) {
      video.currentTime = frozenTime;
      if (loopMode === 1) {
        video.play().catch(() => {});
      }
    }
  }, [src]);

  useEffect(() => {
    const video = videoRef.current;
    if (!video) return;

    const handleLoadedData = () => {
      if (frozenTimeRef.current > 0) {
        video.currentTime = frozenTimeRef.current;
        if (loopModeRef.current === 1) {
          video.play().catch(() => {});
        }
      }
    };

    const handleEnded = () => {
      if (loopModeRef.current === 1) {
        video.currentTime = 0;
        video.play().catch(() => {});
      } else {
        setIsPlaying(false);
      }
    };

    const handleTimeUpdate = () => {
      const now = performance.now();
      if (now - lastTimeUpdateRef.current < 250) return;
      lastTimeUpdateRef.current = now;
      setCurrentTime(video.currentTime);
    };

    const handleDurationChange = () => {
      setDuration(video.duration || 0);
    };

    const handlePlay = () => setIsPlaying(true);
    const handlePause = () => setIsPlaying(false);

    video.addEventListener('loadeddata', handleLoadedData);
    video.addEventListener('ended', handleEnded);
    video.addEventListener('timeupdate', handleTimeUpdate);
    video.addEventListener('durationchange', handleDurationChange);
    video.addEventListener('play', handlePlay);
    video.addEventListener('pause', handlePause);

    return () => {
      video.removeEventListener('loadeddata', handleLoadedData);
      video.removeEventListener('ended', handleEnded);
      video.removeEventListener('timeupdate', handleTimeUpdate);
      video.removeEventListener('durationchange', handleDurationChange);
      video.removeEventListener('play', handlePlay);
      video.removeEventListener('pause', handlePause);
    };
  }, [src]);

  useEffect(() => {
    if (loopMode === 1) {
      const video = videoRef.current;
      if (video) {
        video.loop = true;
      }
    }
  }, [loopMode]);

  useEffect(() => {
    const container = containerRef.current;
    if (!container) return;

    const observer = new IntersectionObserver(
      (entries) => {
        const entry = entries[0];
        const wasVisible = isVisibleRef.current;
        isVisibleRef.current = entry.isIntersecting;

        const video = videoRef.current;
        if (!video) return;

        if (!entry.isIntersecting && wasVisible) {
          if (!video.paused) {
            video.pause();
          }
        } else if (entry.isIntersecting && !wasVisible) {
          if (loopModeRef.current === 1 && video.paused && video.currentTime > 0) {
            video.play().catch(() => {});
          }
        }
      },
      { threshold: 0.1 }
    );

    observer.observe(container);
    return () => observer.disconnect();
  }, []);

  useEffect(() => {
    return () => {
      if (frozenTimeSaveTimerRef.current) {
        clearTimeout(frozenTimeSaveTimerRef.current);
      }
      const video = videoRef.current;
      if (loopModeRef.current === 1 && video && video.currentTime > 0) {
        onFrozenTimeChange(video.currentTime);
      }
    };
  }, []);

  const saveFrozenTimeDebounced = useCallback((time: number) => {
    if (frozenTimeSaveTimerRef.current) {
      clearTimeout(frozenTimeSaveTimerRef.current);
    }
    frozenTimeSaveTimerRef.current = setTimeout(() => {
      onFrozenTimeChange(time);
      frozenTimeSaveTimerRef.current = null;
    }, 2000);
  }, [onFrozenTimeChange]);

  const togglePlay = useCallback((e: React.MouseEvent) => {
    e.stopPropagation();
    const video = videoRef.current;
    if (!video) return;
    if (video.paused) {
      video.play().catch(() => {});
    } else {
      video.pause();
      if (loopMode === 1) {
        saveFrozenTimeDebounced(video.currentTime);
      }
    }
  }, [loopMode, saveFrozenTimeDebounced]);

  const toggleMute = useCallback((e: React.MouseEvent) => {
    e.stopPropagation();
    const video = videoRef.current;
    if (!video) return;
    video.muted = !video.muted;
    setIsMuted(video.muted);
  }, []);

  const toggleLoop = useCallback((e: React.MouseEvent) => {
    e.stopPropagation();
    const newMode = loopMode === 1 ? 0 : 1;
    const video = videoRef.current;
    if (video) {
      video.loop = newMode === 1;
    }
    onLoopModeChange(newMode);
    if (newMode === 0) {
      if (video) {
        onFrozenTimeChange(0);
      }
    }
  }, [loopMode, onLoopModeChange, onFrozenTimeChange]);

  const handleSeek = useCallback((e: React.MouseEvent<HTMLDivElement>) => {
    e.stopPropagation();
    const video = videoRef.current;
    if (!video || !duration) return;
    const rect = e.currentTarget.getBoundingClientRect();
    const ratio = Math.max(0, Math.min(1, (e.clientX - rect.left) / rect.width));
    video.currentTime = ratio * duration;
  }, [duration]);

  const formatTime = (t: number) => {
    if (!isFinite(t) || t < 0) return '0:00';
    const m = Math.floor(t / 60);
    const s = Math.floor(t % 60);
    return `${m}:${s.toString().padStart(2, '0')}`;
  };

  return (
    <div
      ref={containerRef}
      style={{ position: 'relative', width: '100%' }}
      onMouseEnter={() => setShowControls(true)}
      onMouseLeave={() => setShowControls(false)}
      onDoubleClick={onDoubleClick}
    >
      <video
        ref={videoRef}
        src={src}
        muted={isMuted}
        loop={loopMode === 1}
        playsInline
        preload="metadata"
        style={{ display: 'block', borderRadius: 8, width: '100%' }}
        onLoadedMetadata={onLoadedMetadata}
      />

      {showControls && (
        <div
          style={{
            position: 'absolute',
            bottom: 0,
            left: 0,
            right: 0,
            background: 'linear-gradient(transparent, rgba(0,0,0,0.7))',
            padding: '8px 8px 4px',
            borderRadius: '0 0 8px 8px',
          }}
          onClick={(e) => e.stopPropagation()}
        >
          <div
            style={{ width: '100%', height: 4, backgroundColor: 'rgba(255,255,255,0.3)', borderRadius: 2, cursor: 'pointer', marginBottom: 4 }}
            onClick={handleSeek}
          >
            <div
              style={{ width: duration ? `${(currentTime / duration) * 100}%` : '0%', height: '100%', backgroundColor: 'var(--primary-color, #6366f1)', borderRadius: 2, transition: 'width 0.1s' }}
            />
          </div>

          <div style={{ display: 'flex', alignItems: 'center', gap: 6, color: 'white', fontSize: 12 }}>
            <button onClick={togglePlay} style={{ background: 'none', border: 'none', color: 'white', cursor: 'pointer', padding: 2, display: 'flex' }}>
              {isPlaying ? <Pause size={14} /> : <Play size={14} />}
            </button>

            <span style={{ fontSize: 10, fontVariantNumeric: 'tabular-nums', minWidth: 70 }}>
              {formatTime(currentTime)} / {formatTime(duration)}
            </span>

            <div style={{ flex: 1 }} />

            <button onClick={toggleMute} style={{ background: 'none', border: 'none', color: 'white', cursor: 'pointer', padding: 2, display: 'flex' }}>
              {isMuted ? <VolumeX size={14} /> : <Volume2 size={14} />}
            </button>

            <button
              onClick={toggleLoop}
              style={{
                background: loopMode === 1 ? 'rgba(99,102,241,0.4)' : 'none',
                border: 'none',
                color: loopMode === 1 ? '#818cf8' : 'rgba(255,255,255,0.6)',
                cursor: 'pointer',
                padding: '2px 4px',
                display: 'flex',
                borderRadius: 4,
              }}
              title={loopMode === 1 ? '循环播放中（离开页面将冻结进度）' : '开启循环播放'}
            >
              <Repeat size={14} />
            </button>
          </div>
        </div>
      )}
    </div>
  );
};

export default CanvasVideoPlayer;
