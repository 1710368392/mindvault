import React, { useCallback, useEffect } from 'react';
import { motion } from 'framer-motion';
import { Typography } from 'antd';
import {
  Play, Pause, SkipBack, SkipForward, Repeat, Shuffle, Music, Music2, X, GripHorizontal,
  Volume2, VolumeX, Volume1, ListMusic,
} from 'lucide-react';
import { useMusicStore } from '../../stores/musicStore';
import LyricsDisplay from '../music/LyricsDisplay';
import AudioVisualizer from '../music/AudioVisualizer';

const MusicPlayerWindow: React.FC = () => {
  const isPlaying = useMusicStore((s) => s.isPlaying);
  const currentTrackIndex = useMusicStore((s) => s.currentTrackIndex);
  const progress = useMusicStore((s) => s.progress);
  const currentTime = useMusicStore((s) => s.currentTime);
  const duration = useMusicStore((s) => s.duration);
  const playMode = useMusicStore((s) => s.playMode);
  const tracks = useMusicStore((s) => s.tracks);
  const volume = useMusicStore((s) => s.volume);
  const lyrics = useMusicStore((s) => s.lyrics);

  const togglePlay = useMusicStore((s) => s.togglePlay);
  const loadTrack = useMusicStore((s) => s.loadTrack);
  const nextTrack = useMusicStore((s) => s.nextTrack);
  const prevTrack = useMusicStore((s) => s.prevTrack);
  const cyclePlayMode = useMusicStore((s) => s.cyclePlayMode);
  const formatTime = useMusicStore((s) => s.formatTime);
  const getPlayModeLabel = useMusicStore((s) => s.getPlayModeLabel);
  const initAudio = useMusicStore((s) => s.initAudio);
  const seekToRatio = useMusicStore((s) => s.seekToRatio);
  const setVolume = useMusicStore((s) => s.setVolume);
  const seekTo = useMusicStore((s) => s.seekTo);

  useEffect(() => {
    initAudio();
  }, [initAudio]);

  const handleClose = useCallback(() => {
    if (window.electronAPI?.window?.closeMusicPlayer) {
      window.electronAPI.window.closeMusicPlayer();
    } else {
      window.close();
    }
  }, []);

  const currentTrack = tracks[currentTrackIndex];

  return (
    <div style={{
      width: '100vw',
      height: '100vh',
      background: 'linear-gradient(135deg, #1a1a2e 0%, #16213e 50%, #0f3460 100%)',
      display: 'flex',
      flexDirection: 'column',
      overflow: 'hidden',
    }}>
      <div style={{
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'space-between',
        padding: '6px 10px',
        backgroundColor: 'var(--bg-tertiary)',
        borderBottom: '1px solid var(--border-light)',
        WebkitAppRegion: 'drag',
        cursor: 'default',
      } as React.CSSProperties}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 4, WebkitAppRegion: 'no-drag' }}>
          <GripHorizontal size={12} style={{ color: 'var(--text-tertiary)', opacity: 0.5 }} />
          <Music2 size={11} style={{ color: 'var(--primary-color)' }} />
          <span style={{ fontSize: 10, fontWeight: 600, color: 'var(--text-primary)' }}>音乐播放器</span>
        </div>
        <motion.button
          onClick={handleClose}
          whileHover={{ scale: 1.1 }}
          whileTap={{ scale: 0.9 }}
          style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', border: 'none', background: 'none', cursor: 'pointer', color: 'var(--text-tertiary)', padding: 0, WebkitAppRegion: 'no-drag' }}
        >
          <X size={12} />
        </motion.button>
      </div>

      <div style={{ display: 'flex', flex: 1, padding: '6px 10px', gap: 8, overflow: 'hidden' }}>
        <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', gap: 4, flexShrink: 0 }}>
          <div style={{
            width: 48,
            height: 48,
            borderRadius: 8,
            background: 'linear-gradient(135deg, var(--primary-color), var(--primary-light))',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            flexShrink: 0,
          }}>
            <Music size={20} style={{ color: 'white' }} />
          </div>
          <span style={{ fontSize: 8, color: 'var(--text-tertiary)', whiteSpace: 'nowrap' }}>
            {formatTime(currentTime)} / {formatTime(duration)}
          </span>
        </div>

        <div style={{ flex: 1, display: 'flex', flexDirection: 'column', minWidth: 0, gap: 4 }}>
          <div style={{ overflow: 'hidden' }}>
            <Typography.Text ellipsis style={{ fontSize: 11, fontWeight: 600, color: 'var(--primary-color)' }}>
              {currentTrack?.title}
            </Typography.Text>
            <Typography.Text ellipsis style={{ fontSize: 9, color: 'var(--text-tertiary)' }}>
              {currentTrack?.artist}
            </Typography.Text>
          </div>

          <div style={{ display: 'flex', alignItems: 'center', gap: 4 }}>
            <div
              onMouseDown={(e) => {
                e.preventDefault();
                const bar = e.currentTarget as HTMLElement;
                if (!bar) return;
                const rect = bar.getBoundingClientRect();
                const ratio = Math.max(0, Math.min((e.clientX - rect.left) / rect.width, 1));
                seekToRatio(ratio);
              }}
              style={{
                flex: 1,
                height: 4,
                borderRadius: 2,
                backgroundColor: 'var(--bg-tertiary)',
                cursor: 'pointer',
                position: 'relative',
              }}
            >
              <div style={{
                height: '100%',
                borderRadius: 2,
                background: 'linear-gradient(90deg, var(--primary-color), var(--primary-light))',
                width: `${progress * 100}%`,
              }} />
            </div>
          </div>

          <div style={{ display: 'flex', justifyContent: 'center', padding: '0 10px' }}>
            <AudioVisualizer width={240} height={16} mode="bars" barCount={24} gap={1} borderRadius={1} opacity={isPlaying ? 0.5 : 0.15} />
          </div>

          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 8 }}>
            <motion.button onClick={() => { const idx = prevTrack(); if (idx !== currentTrackIndex) loadTrack(idx, isPlaying); }} whileHover={{ scale: 1.1 }} whileTap={{ scale: 0.9 }} style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', border: 'none', background: 'none', cursor: 'pointer', color: 'var(--text-tertiary)', padding: 0 }}>
              <SkipBack size={13} />
            </motion.button>
            <motion.button onClick={togglePlay} whileHover={{ scale: 1.1 }} whileTap={{ scale: 0.9 }} style={{
              display: 'flex', alignItems: 'center', justifyContent: 'center',
              width: 28, height: 28, borderRadius: '50%',
              background: 'linear-gradient(135deg, var(--primary-color), var(--primary-light))',
              border: 'none', cursor: 'pointer', color: 'white',
            }}>
              {isPlaying ? <Pause size={13} /> : <Play size={13} style={{ marginLeft: 1 }} />}
            </motion.button>
            <motion.button onClick={() => { const idx = nextTrack(); loadTrack(idx, isPlaying); }} whileHover={{ scale: 1.1 }} whileTap={{ scale: 0.9 }} style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', border: 'none', background: 'none', cursor: 'pointer', color: 'var(--text-tertiary)', padding: 0 }}>
              <SkipForward size={13} />
            </motion.button>
            <div style={{ width: 1, height: 16, backgroundColor: 'var(--border-light)' }} />
            <motion.button onClick={cyclePlayMode} whileHover={{ scale: 1.1 }} whileTap={{ scale: 0.9 }} style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', border: 'none', background: 'none', cursor: 'pointer', color: playMode !== 'sequential' ? 'var(--primary-color)' : 'var(--text-tertiary)', padding: 0 }} title={getPlayModeLabel()}>
              {playMode === 'random' ? <Shuffle size={12} /> : <Repeat size={12} />}
            </motion.button>
            <div style={{ width: 1, height: 16, backgroundColor: 'var(--border-light)' }} />
            <div style={{ display: 'flex', alignItems: 'center', gap: 2 }}>
              <motion.button
                onClick={() => setVolume(volume > 0 ? 0 : 60)}
                whileHover={{ scale: 1.1 }}
                whileTap={{ scale: 0.9 }}
                style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', border: 'none', background: 'none', cursor: 'pointer', color: 'var(--text-tertiary)', padding: 0 }}
              >
                {volume === 0 ? <VolumeX size={12} /> : volume < 50 ? <Volume1 size={12} /> : <Volume2 size={12} />}
              </motion.button>
              <input
                type="range"
                min={0}
                max={100}
                value={Math.min(volume, 100)}
                onChange={(e) => setVolume(Number(e.target.value))}
                style={{ width: 50, height: 3, accentColor: 'var(--primary-color)', cursor: 'pointer' }}
              />
            </div>
          </div>

          <div style={{ flex: 1, display: 'flex', gap: 4, overflow: 'hidden', minHeight: 0 }}>
            <div style={{ flex: 1, overflow: 'hidden' }}>
              <LyricsDisplay lines={lyrics} currentTime={currentTime} onSeek={seekTo} compact />
            </div>
            <div style={{ width: 1, backgroundColor: 'var(--border-light)', opacity: 0.3 }} />
            <div style={{ flex: 1, overflow: 'auto', display: 'flex', flexDirection: 'column', gap: 1 }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 3, marginBottom: 2 }}>
                <ListMusic size={9} style={{ color: 'var(--text-tertiary)' }} />
                <span style={{ fontSize: 8, color: 'var(--text-tertiary)', fontWeight: 600 }}>播放列表</span>
                <span style={{ fontSize: 7, color: 'var(--text-tertiary)', opacity: 0.6 }}>({tracks.length})</span>
              </div>
              {tracks.slice(0, 20).map((track, idx) => (
                <motion.div
                  key={track.id}
                  onClick={() => loadTrack(idx, true)}
                  whileHover={{ backgroundColor: 'rgba(255,255,255,0.05)' }}
                  style={{
                    display: 'flex',
                    alignItems: 'center',
                    gap: 4,
                    padding: '2px 4px',
                    borderRadius: 3,
                    cursor: 'pointer',
                    backgroundColor: idx === currentTrackIndex ? 'rgba(var(--primary-rgb, 99,102,241), 0.15)' : 'transparent',
                    borderLeft: idx === currentTrackIndex ? '2px solid var(--primary-color)' : '2px solid transparent',
                  }}
                >
                  <span style={{
                    fontSize: 7,
                    color: idx === currentTrackIndex ? 'var(--primary-color)' : 'var(--text-tertiary)',
                    width: 12,
                    textAlign: 'right',
                    flexShrink: 0,
                  }}>
                    {idx + 1}
                  </span>
                  <div style={{ flex: 1, minWidth: 0 }}>
                    <div style={{
                      fontSize: 8,
                      fontWeight: idx === currentTrackIndex ? 600 : 400,
                      color: idx === currentTrackIndex ? 'var(--primary-color)' : 'var(--text-primary)',
                      whiteSpace: 'nowrap',
                      overflow: 'hidden',
                      textOverflow: 'ellipsis',
                    }}>
                      {track.title}
                    </div>
                    <div style={{
                      fontSize: 7,
                      color: 'var(--text-tertiary)',
                      whiteSpace: 'nowrap',
                      overflow: 'hidden',
                      textOverflow: 'ellipsis',
                    }}>
                      {track.artist}
                    </div>
                  </div>
                </motion.div>
              ))}
              {tracks.length > 20 && (
                <span style={{ fontSize: 7, color: 'var(--text-tertiary)', opacity: 0.5, textAlign: 'center', padding: '2px 0' }}>
                  还有 {tracks.length - 20} 首...
                </span>
              )}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};

export default MusicPlayerWindow;
