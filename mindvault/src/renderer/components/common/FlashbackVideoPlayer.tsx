import React, { useRef, useState, useCallback, useEffect } from 'react';
import { Volume2, VolumeX, Volume1 } from 'lucide-react';

interface FlashbackVideoPlayerProps {
  src: string;
  muted: boolean;
  volume: number;
  style?: React.CSSProperties;
  onLoadedMetadata: (video: HTMLVideoElement) => void;
  onVolumeChange: (volume: number, muted: boolean) => void;
  onEnded: () => void;
  onPause: () => void;
  onPlay: () => void;
  videoRef: (el: HTMLVideoElement | null) => void;
}

const FlashbackVideoPlayer: React.FC<FlashbackVideoPlayerProps> = ({
  src,
  muted,
  volume,
  style,
  onLoadedMetadata,
  onVolumeChange,
  onEnded,
  onPause,
  onPlay,
  videoRef,
}) => {
  const internalRef = useRef<HTMLVideoElement>(null);
  const containerRef = useRef<HTMLDivElement>(null);
  const [currentTime, setCurrentTime] = useState(0);
  const [duration, setDuration] = useState(0);
  const [isMuted, setIsMuted] = useState(muted);
  const [currentVolume, setCurrentVolume] = useState(volume);
  const [showControls, setShowControls] = useState(false);
  const [seeking, setSeeking] = useState(false);
  const [seekTime, setSeekTime] = useState(0);
  const [volumeDisplay, setVolumeDisplay] = useState<number | null>(null);
  const volumeDisplayTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const hideControlsTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const isDraggingRef = useRef(false);

  const handleRef = useCallback((el: HTMLVideoElement | null) => {
    internalRef.current = el;
    videoRef(el);
  }, [videoRef]);

  useEffect(() => {
    const video = internalRef.current;
    if (!video) return;

    const onTimeUpdate = () => {
      if (!isDraggingRef.current) {
        setCurrentTime(video.currentTime);
      }
    };
    const onDurationChange = () => {
      setDuration(video.duration || 0);
    };

    video.addEventListener('timeupdate', onTimeUpdate);
    video.addEventListener('durationchange', onDurationChange);
    return () => {
      video.removeEventListener('timeupdate', onTimeUpdate);
      video.removeEventListener('durationchange', onDurationChange);
    };
  }, []);

  useEffect(() => {
    setIsMuted(muted);
  }, [muted]);

  useEffect(() => {
    setCurrentVolume(volume);
  }, [volume]);

  const formatTime = (t: number) => {
    if (!isFinite(t) || t < 0) return '0:00';
    const m = Math.floor(t / 60);
    const s = Math.floor(t % 60);
    return `${m}:${s.toString().padStart(2, '0')}`;
  };

  const scheduleHideControls = useCallback(() => {
    if (hideControlsTimerRef.current) {
      clearTimeout(hideControlsTimerRef.current);
    }
    hideControlsTimerRef.current = setTimeout(() => {
      if (!isDraggingRef.current) {
        setShowControls(false);
      }
      hideControlsTimerRef.current = null;
    }, 1500);
  }, []);

  const cancelHideControls = useCallback(() => {
    if (hideControlsTimerRef.current) {
      clearTimeout(hideControlsTimerRef.current);
      hideControlsTimerRef.current = null;
    }
  }, []);

  const showVolumeDisplay = useCallback((vol: number) => {
    setVolumeDisplay(Math.round(vol * 100));
    if (volumeDisplayTimerRef.current) {
      clearTimeout(volumeDisplayTimerRef.current);
    }
    volumeDisplayTimerRef.current = setTimeout(() => {
      setVolumeDisplay(null);
    }, 1200);
  }, []);

  const toggleMute = useCallback((e: React.MouseEvent) => {
    e.stopPropagation();
    const video = internalRef.current;
    if (!video) return;
    video.muted = !video.muted;
    setIsMuted(video.muted);
    onVolumeChange(video.volume, video.muted);
  }, [onVolumeChange]);

  const handleVolumeWheel = useCallback((e: React.WheelEvent) => {
    e.stopPropagation();
    e.preventDefault();
    const video = internalRef.current;
    if (!video) return;
    const delta = e.deltaY > 0 ? -0.05 : 0.05;
    const newVol = Math.max(0, Math.min(1, video.volume + delta));
    video.volume = newVol;
    setCurrentVolume(newVol);
    if (video.muted && newVol > 0) {
      video.muted = false;
      setIsMuted(false);
    }
    onVolumeChange(newVol, video.muted);
    showVolumeDisplay(newVol);
  }, [onVolumeChange, showVolumeDisplay]);

  const getProgressFromEvent = useCallback((e: React.MouseEvent<HTMLDivElement>) => {
    const rect = e.currentTarget.getBoundingClientRect();
    return Math.max(0, Math.min(1, (e.clientX - rect.left) / rect.width));
  }, []);

  const handleProgressMouseDown = useCallback((e: React.MouseEvent<HTMLDivElement>) => {
    e.stopPropagation();
    e.preventDefault();
    isDraggingRef.current = true;
    setSeeking(true);
    const progressRect = e.currentTarget.getBoundingClientRect();
    const ratio = Math.max(0, Math.min(1, (e.clientX - progressRect.left) / progressRect.width));
    const newTime = ratio * duration;
    setSeekTime(newTime);

    const handleMouseMove = (ev: MouseEvent) => {
      const r = Math.max(0, Math.min(1, (ev.clientX - progressRect.left) / progressRect.width));
      const t = r * duration;
      setSeekTime(t);
    };

    const handleMouseUp = (ev: MouseEvent) => {
      const video = internalRef.current;
      if (video && duration) {
        const r = Math.max(0, Math.min(1, (ev.clientX - progressRect.left) / progressRect.width));
        video.currentTime = r * duration;
        setCurrentTime(r * duration);
      }
      isDraggingRef.current = false;
      setSeeking(false);
      document.removeEventListener('mousemove', handleMouseMove);
      document.removeEventListener('mouseup', handleMouseUp);
    };

    document.addEventListener('mousemove', handleMouseMove);
    document.addEventListener('mouseup', handleMouseUp);
  }, [duration, getProgressFromEvent]);

  const handleProgressClick = useCallback((e: React.MouseEvent<HTMLDivElement>) => {
    e.stopPropagation();
    const video = internalRef.current;
    if (!video || !duration) return;
    const ratio = getProgressFromEvent(e);
    video.currentTime = ratio * duration;
    setCurrentTime(ratio * duration);
  }, [duration, getProgressFromEvent]);

  const handleMouseMove = useCallback((e: React.MouseEvent<HTMLDivElement>) => {
    const container = containerRef.current;
    if (!container) return;
    const rect = container.getBoundingClientRect();
    const relativeY = rect.bottom - e.clientY;
    const threshold = rect.height * 0.15;

    if (relativeY <= threshold && relativeY >= 0) {
      setShowControls(true);
      cancelHideControls();
    } else {
      if (!isDraggingRef.current) {
        scheduleHideControls();
      }
    }
  }, [scheduleHideControls, cancelHideControls]);

  const handleMouseLeave = useCallback(() => {
    if (!isDraggingRef.current) {
      scheduleHideControls();
    }
  }, [scheduleHideControls]);

  const handleContainerMouseDown = useCallback((e: React.MouseEvent) => {
    e.stopPropagation();
  }, []);

  const handlePlayPauseClick = useCallback((e: React.MouseEvent) => {
    e.stopPropagation();
    e.preventDefault();
    const video = internalRef.current;
    if (!video) return;
    if (video.paused) {
      video.play().catch(() => {});
    } else {
      video.pause();
    }
  }, []);

  useEffect(() => {
    return () => {
      if (volumeDisplayTimerRef.current) clearTimeout(volumeDisplayTimerRef.current);
      if (hideControlsTimerRef.current) clearTimeout(hideControlsTimerRef.current);
    };
  }, []);

  const progress = duration > 0 ? (seeking ? seekTime / duration : currentTime / duration) : 0;

  const VolumeIcon = isMuted || currentVolume === 0 ? VolumeX : currentVolume < 0.5 ? Volume1 : Volume2;

  return (
    <div
      ref={containerRef}
      style={{ position: 'relative', width: 'fit-content', margin: '0 auto', ...style }}
      onMouseMove={handleMouseMove}
      onMouseLeave={handleMouseLeave}
      onMouseDown={handleContainerMouseDown}
    >
      <video
        ref={handleRef}
        src={src}
        autoPlay={false}
        muted={isMuted}
        playsInline
        style={{
          width: '100%',
          maxHeight: '100%',
          display: 'block',
          borderRadius: 8,
        }}
        onLoadedMetadata={() => {
          const video = internalRef.current;
          if (video) onLoadedMetadata(video);
        }}
        onVolumeChange={() => {
          const video = internalRef.current;
          if (video) {
            setCurrentVolume(video.volume);
            setIsMuted(video.muted);
            onVolumeChange(video.volume, video.muted);
          }
        }}
        onEnded={onEnded}
        onPause={onPause}
        onPlay={onPlay}
      />

      <div
        onClick={handlePlayPauseClick}
        onMouseDown={(e) => e.stopPropagation()}
        style={{
          position: 'absolute',
          top: '40%',
          left: '40%',
          width: '20%',
          height: '20%',
          cursor: 'pointer',
          zIndex: 8,
        }}
      />

      {volumeDisplay !== null && (
        <div style={{
          position: 'absolute',
          top: '50%',
          left: '50%',
          transform: 'translate(-50%, -50%)',
          color: '#fff',
          fontSize: 42,
          fontWeight: 700,
          opacity: 0.6,
          pointerEvents: 'none',
          textShadow: '0 2px 8px rgba(0,0,0,0.5)',
          fontFamily: 'var(--font-family, system-ui)',
          transition: 'opacity 0.3s ease',
          zIndex: 5,
        }}>
          {volumeDisplay}
        </div>
      )}

      <div style={{
        position: 'absolute',
        bottom: 0,
        left: 0,
        right: 0,
        opacity: showControls ? 1 : 0,
        transition: 'opacity 0.25s ease',
        pointerEvents: showControls ? 'auto' : 'none',
        zIndex: 10,
      }}>
        <div
          onMouseDown={(e) => e.stopPropagation()}
          onClick={(e) => e.stopPropagation()}
          style={{
            background: 'linear-gradient(transparent, rgba(0,0,0,0.55))',
            padding: '12px 10px 6px',
            borderRadius: '0 0 8px 8px',
          }}
        >
          <div style={{ position: 'relative', marginBottom: 4 }}>
            {seeking && (
              <div style={{
                position: 'absolute',
                bottom: '100%',
                left: `${progress * 100}%`,
                transform: 'translateX(-50%)',
                marginBottom: 6,
                background: 'rgba(0,0,0,0.8)',
                color: '#fff',
                fontSize: 11,
                padding: '2px 6px',
                borderRadius: 4,
                whiteSpace: 'nowrap',
                pointerEvents: 'none',
                fontFamily: 'var(--font-family, system-ui)',
                fontVariantNumeric: 'tabular-nums',
              }}>
                {formatTime(seekTime)} / {formatTime(duration)}
              </div>
            )}
            <div
              style={{
                width: '100%',
                height: 3,
                backgroundColor: 'rgba(255,255,255,0.25)',
                borderRadius: 2,
                cursor: 'pointer',
                position: 'relative',
              }}
              onClick={handleProgressClick}
              onMouseDown={handleProgressMouseDown}
            >
              <div style={{
                width: `${progress * 100}%`,
                height: '100%',
                backgroundColor: 'var(--primary-color, #6C63FF)',
                borderRadius: 2,
                position: 'relative',
              }}>
                <div style={{
                  position: 'absolute',
                  right: -4,
                  top: '50%',
                  transform: 'translateY(-50%)',
                  width: 8,
                  height: 8,
                  borderRadius: '50%',
                  backgroundColor: 'var(--primary-color, #6C63FF)',
                  boxShadow: '0 0 4px rgba(0,0,0,0.3)',
                  opacity: showControls ? 1 : 0,
                  transition: 'opacity 0.2s',
                }} />
              </div>
            </div>
          </div>

          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'flex-end' }}>
            <button
              onClick={toggleMute}
              onWheel={handleVolumeWheel}
              onMouseDown={(e) => e.stopPropagation()}
              style={{
                background: 'none',
                border: 'none',
                color: 'rgba(255,255,255,0.85)',
                cursor: 'pointer',
                padding: 2,
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                borderRadius: 4,
                transition: 'color 0.15s',
              }}
              onMouseEnter={(e) => { (e.currentTarget.style.color = '#fff'); }}
              onMouseLeave={(e) => { (e.currentTarget.style.color = 'rgba(255,255,255,0.85)'); }}
            >
              <VolumeIcon size={14} />
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};

export default FlashbackVideoPlayer;
