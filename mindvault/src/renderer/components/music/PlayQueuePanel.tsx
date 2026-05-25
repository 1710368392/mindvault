import React from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { ListMusic, X, Trash2, Play, Music } from 'lucide-react';
import { useMusicStore, MusicTrack } from '../../stores/musicStore';

const PlayQueuePanel: React.FC = () => {
  const playQueue = useMusicStore((s) => s.playQueue);
  const useQueueMode = useMusicStore((s) => s.useQueueMode);
  const tracks = useMusicStore((s) => s.tracks);
  const currentTrackIndex = useMusicStore((s) => s.currentTrackIndex);
  const isPlaying = useMusicStore((s) => s.isPlaying);
  const loadTrack = useMusicStore((s) => s.loadTrack);
  const removeFromQueue = useMusicStore((s) => s.removeFromQueue);
  const clearQueue = useMusicStore((s) => s.clearQueue);
  const toggleQueueMode = useMusicStore((s) => s.toggleQueueMode);
  const formatTime = useMusicStore((s) => s.formatTime);

  const currentTrack = tracks[currentTrackIndex];

  const handlePlayFromQueue = (track: MusicTrack) => {
    const idx = tracks.findIndex(t => t.id === track.id);
    if (idx >= 0) {
      loadTrack(idx, true);
    }
  };

  return (
    <div style={{ padding: '12px 16px', display: 'flex', flexDirection: 'column', gap: 10 }}>
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
          <ListMusic size={14} style={{ color: 'var(--primary-color)' }} />
          <span style={{ fontSize: 13, fontWeight: 600, color: 'var(--text-primary)' }}>播放队列</span>
          <span style={{ fontSize: 10, color: 'var(--text-tertiary)' }}>({playQueue.length})</span>
        </div>
        <div style={{ display: 'flex', alignItems: 'center', gap: 4 }}>
          <motion.button
            whileHover={{ scale: 1.05 }}
            whileTap={{ scale: 0.95 }}
            onClick={toggleQueueMode}
            style={{
              padding: '3px 8px',
              fontSize: 9,
              borderRadius: 4,
              border: '1px solid',
              borderColor: useQueueMode ? 'var(--primary-color)' : 'var(--border-light)',
              cursor: 'pointer',
              background: useQueueMode ? 'var(--primary-color)' : 'var(--bg-tertiary)',
              color: useQueueMode ? 'white' : 'var(--text-secondary)',
              transition: 'all 0.2s',
            }}
          >
            {useQueueMode ? '队列模式' : '普通模式'}
          </motion.button>
          {playQueue.length > 0 && (
            <motion.button
              whileHover={{ scale: 1.1 }}
              whileTap={{ scale: 0.9 }}
              onClick={clearQueue}
              style={{
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                border: 'none',
                background: 'none',
                cursor: 'pointer',
                color: 'var(--text-tertiary)',
                padding: 2,
              }}
              title="清空队列"
            >
              <Trash2 size={12} />
            </motion.button>
          )}
        </div>
      </div>

      {useQueueMode && (
        <div style={{
          padding: '4px 8px',
          borderRadius: 4,
          backgroundColor: 'rgba(var(--primary-rgb, 139,92,246), 0.08)',
          border: '1px solid rgba(var(--primary-rgb, 139,92,246), 0.15)',
          fontSize: 9,
          color: 'var(--text-secondary)',
        }}>
          队列模式已开启：播放将按队列顺序进行
        </div>
      )}

      {playQueue.length === 0 ? (
        <div style={{
          display: 'flex',
          flexDirection: 'column',
          alignItems: 'center',
          justifyContent: 'center',
          padding: '20px 0',
          gap: 8,
        }}>
          <Music size={20} style={{ color: 'var(--text-tertiary)', opacity: 0.4 }} />
          <span style={{ fontSize: 11, color: 'var(--text-tertiary)' }}>队列为空</span>
          <span style={{ fontSize: 9, color: 'var(--text-tertiary)', opacity: 0.6 }}>
            在线搜索歌曲后可添加到队列
          </span>
        </div>
      ) : (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 1, maxHeight: 300, overflow: 'auto' }}>
          <AnimatePresence>
            {playQueue.map((track, idx) => {
              const isCurrent = currentTrack?.id === track.id;

              return (
                <motion.div
                  key={`${track.id}-${idx}`}
                  initial={{ opacity: 0, x: -10 }}
                  animate={{ opacity: 1, x: 0 }}
                  exit={{ opacity: 0, x: 10, height: 0 }}
                  transition={{ duration: 0.15 }}
                  onClick={() => handlePlayFromQueue(track)}
                  whileHover={{ backgroundColor: 'var(--bg-hover)' }}
                  style={{
                    display: 'flex',
                    alignItems: 'center',
                    gap: 6,
                    padding: '5px 6px',
                    borderRadius: 5,
                    cursor: 'pointer',
                    backgroundColor: isCurrent ? 'rgba(var(--primary-rgb, 139,92,246), 0.08)' : 'transparent',
                    borderLeft: isCurrent ? '2px solid var(--primary-color)' : '2px solid transparent',
                  }}
                >
                  <span style={{
                    fontSize: 9,
                    color: isCurrent ? 'var(--primary-color)' : 'var(--text-tertiary)',
                    width: 16,
                    textAlign: 'center',
                    flexShrink: 0,
                  }}>
                    {isCurrent && isPlaying ? '♪' : idx + 1}
                  </span>

                  <div style={{ flex: 1, minWidth: 0 }}>
                    <div style={{
                      fontSize: 11,
                      fontWeight: isCurrent ? 600 : 400,
                      color: isCurrent ? 'var(--primary-color)' : 'var(--text-primary)',
                      overflow: 'hidden',
                      textOverflow: 'ellipsis',
                      whiteSpace: 'nowrap',
                    }}>
                      {track.title}
                    </div>
                    <div style={{
                      fontSize: 9,
                      color: 'var(--text-tertiary)',
                      overflow: 'hidden',
                      textOverflow: 'ellipsis',
                      whiteSpace: 'nowrap',
                    }}>
                      {track.artist}
                    </div>
                  </div>

                  {track.duration != null && track.duration > 0 && (
                    <span style={{
                      fontSize: 8,
                      color: 'var(--text-tertiary)',
                      fontVariantNumeric: 'tabular-nums',
                      flexShrink: 0,
                    }}>
                      {formatTime(track.duration)}
                    </span>
                  )}

                  <motion.button
                    whileHover={{ scale: 1.2 }}
                    whileTap={{ scale: 0.9 }}
                    onClick={(e) => {
                      e.stopPropagation();
                      removeFromQueue(track.id);
                    }}
                    style={{
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'center',
                      border: 'none',
                      background: 'none',
                      cursor: 'pointer',
                      color: 'var(--text-tertiary)',
                      padding: 0,
                      opacity: 0.4,
                      flexShrink: 0,
                    }}
                  >
                    <X size={10} />
                  </motion.button>
                </motion.div>
              );
            })}
          </AnimatePresence>
        </div>
      )}
    </div>
  );
};

export default PlayQueuePanel;
