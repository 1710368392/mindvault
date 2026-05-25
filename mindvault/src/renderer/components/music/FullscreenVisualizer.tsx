/**
 * FullscreenVisualizer - Full-screen audio visualization component.
 * Runs in a dedicated Electron BrowserWindow.
 */

import React, { useRef, useEffect, useState, useCallback } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { X, SkipBack, Play, Pause, SkipForward, Music } from 'lucide-react';
import { VisualizerEngine } from './VisualizerEngine';
import { useVisualizerStore } from '../../stores/visualizerStore';
import { useMusicStore, getFrequencyData } from '../../stores/musicStore';
import { resolveColor } from './utils/color';
import { takeCanvasScreenshot, CanvasRecorder, isRecordingSupported } from './utils/recording';
import VisualizerControlPanel from './VisualizerControlPanel';
import type { VisualizationMode, EffectTheme } from './effects/types';

const FullscreenVisualizer: React.FC = () => {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const engineRef = useRef<VisualizerEngine | null>(null);
  const recorderRef = useRef<CanvasRecorder | null>(null);
  const mouseTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const ipcFrequencyRef = useRef<number[] | null>(null);

  const [showUI, setShowUI] = useState(true);
  const [isRecording, setIsRecording] = useState(false);

  // Store subscriptions
  const currentMode = useVisualizerStore((s) => s.currentMode);
  const currentThemeId = useVisualizerStore((s) => s.currentThemeId);
  const config = useVisualizerStore((s) => s.config);
  const setMode = useVisualizerStore((s) => s.setMode);
  const setFullscreen = useVisualizerStore((s) => s.setFullscreen);

  const isPlaying = useMusicStore((s) => s.isPlaying);
  const currentTrackIndex = useMusicStore((s) => s.currentTrackIndex);
  const tracks = useMusicStore((s) => s.tracks);
  const togglePlay = useMusicStore((s) => s.togglePlay);
  const nextTrack = useMusicStore((s) => s.nextTrack);
  const prevTrack = useVisualizerStore((s) => s); // unused, just for reactivity
  const loadTrack = useMusicStore((s) => s.loadTrack);
  const formatTime = useMusicStore((s) => s.formatTime);
  const currentTime = useMusicStore((s) => s.currentTime);
  const duration = useMusicStore((s) => s.duration);

  // Build theme
  const effectTheme: EffectTheme = React.useMemo(() => {
    const theme = useVisualizerStore.getState().getCurrentTheme();
    const primary = resolveColor(theme.colors.primary, '#8B5CF6');
    const secondary = resolveColor(theme.colors.secondary, '#A78BFA');
    const accent = resolveColor(theme.colors.accent, '#34D399');
    const glow = resolveColor(theme.colors.glowColor, '#8B5CF6');
    return {
      primary,
      secondary,
      accent,
      background: theme.colors.background,
      glowColor: glow,
      opacity: theme.defaultOpacity,
    };
  }, [currentThemeId]);

  // Initialize engine
  useEffect(() => {
    const engine = new VisualizerEngine();
    engine.setFrequencyProvider(() => ipcFrequencyRef.current || getFrequencyData());
    engine.setIsPlayingProvider(() => useMusicStore.getState().isPlaying);
    engine.setEngineConfig({ barCount: 64, enableFpsMonitor: false });
    engine.setTheme(effectTheme);
    engine.setConfig(config);
    engine.switchMode(currentMode);
    engineRef.current = engine;

    // Initialize recorder
    recorderRef.current = new CanvasRecorder();

    return () => {
      engine.destroy();
      recorderRef.current = undefined as any;
      engineRef.current = null;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Attach canvas with full window size
  useEffect(() => {
    const canvas = canvasRef.current;
    const engine = engineRef.current;
    if (!canvas || !engine) return;

    const resize = () => {
      const dpr = window.devicePixelRatio || 1;
      canvas.width = window.innerWidth * dpr;
      canvas.height = window.innerHeight * dpr;
      canvas.style.width = `${window.innerWidth}px`;
      canvas.style.height = `${window.innerHeight}px`;
      engine.resize && engine.resize?.();
    };

    resize();
    engine.attach(canvas);
    window.addEventListener('resize', resize);

    return () => {
      engine.detach();
      window.removeEventListener('resize', resize);
    };
  }, []);

  // Sync mode changes
  useEffect(() => {
    engineRef.current?.switchMode(currentMode);
  }, [currentMode]);

  // Sync theme changes
  useEffect(() => {
    engineRef.current?.setTheme(effectTheme);
  }, [effectTheme]);

  // Sync config changes
  useEffect(() => {
    engineRef.current?.setConfig(config);
  }, [config]);

  // Listen for frequency data from main window (IPC)
  useEffect(() => {
    if (window.electronAPI?.window?.onFrequencyData) {
      const cleanup = window.electronAPI.window.onFrequencyData((data: number[]) => {
        ipcFrequencyRef.current = data;
      });
      return cleanup;
    }
  }, []);

  // Listen for fullscreen close event
  useEffect(() => {
    if (window.electronAPI?.window?.onFullscreenClosed) {
      const cleanup = window.electronAPI.window.onFullscreenClosed(() => {
        setFullscreen(false);
      });
      return cleanup;
    }
  }, [setFullscreen]);

  // Mouse movement to show/hide UI
  const handleMouseMove = useCallback(() => {
    setShowUI(true);
    if (mouseTimerRef.current) clearTimeout(mouseTimerRef.current);
    mouseTimerRef.current = setTimeout(() => {
      if (!isRecording) setShowUI(false);
    }, 3000);
  }, [isRecording]);

  // ESC to close
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        window.electronAPI?.window?.closeVisualizerFullscreen?.();
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, []);

  // Screenshot handler
  const handleScreenshot = useCallback(async () => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    await takeCanvasScreenshot(canvas);
  }, []);

  // Recording handler
  const handleToggleRecording = useCallback(() => {
    const canvas = canvasRef.current;
    const recorder = recorderRef.current;
    if (!canvas || !recorder) return;

    if (isRecording) {
      recorder.stop();
      setIsRecording(false);
    } else {
      const started = recorder.start(canvas);
      if (started) {
        setIsRecording(true);
        recorder.stop().then(() => setIsRecording(false));
      }
    }
  }, [isRecording]);

  // Exit fullscreen
  const handleExitFullscreen = useCallback(() => {
    window.electronAPI?.window?.closeVisualizerFullscreen?.();
  }, []);

  const track = tracks[currentTrackIndex];

  return (
    <div
      style={{
        width: '100vw',
        height: '100vh',
        background: '#000',
        position: 'relative',
        overflow: 'hidden',
        cursor: showUI ? 'default' : 'none',
      }}
      onMouseMove={handleMouseMove}
    >
      {/* Full-screen Canvas */}
      <canvas
        ref={canvasRef}
        style={{
          position: 'absolute',
          top: 0,
          left: 0,
          width: '100%',
          height: '100%',
        }}
      />

      {/* Track info overlay (top-left) */}
      <AnimatePresence>
        {showUI && (
          <motion.div
            initial={{ opacity: 0, y: -20 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -20 }}
            transition={{ duration: 0.3 }}
            style={{
              position: 'absolute',
              top: 30,
              left: 30,
              zIndex: 10,
            }}
          >
            <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
              <div style={{
                width: 48,
                height: 48,
                borderRadius: 10,
                background: 'linear-gradient(135deg, rgba(255,255,255,0.15), rgba(255,255,255,0.05))',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
              }}>
                <Music size={22} style={{ color: 'rgba(255,255,255,0.7)' }} />
              </div>
              <div>
                <div style={{ fontSize: 16, fontWeight: 600, color: '#fff' }}>
                  {track?.title || '未在播放'}
                </div>
                <div style={{ fontSize: 12, color: 'rgba(255,255,255,0.5)' }}>
                  {track?.artist || ''}
                </div>
              </div>
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Recording indicator */}
      <AnimatePresence>
        {isRecording && (
          <motion.div
            initial={{ opacity: 0, scale: 0.8 }}
            animate={{ opacity: 1, scale: 1 }}
            exit={{ opacity: 0, scale: 0.8 }}
            style={{
              position: 'absolute',
              top: 30,
              right: 30,
              zIndex: 10,
              display: 'flex',
              alignItems: 'center',
              gap: 6,
              padding: '6px 12px',
              borderRadius: 20,
              background: 'rgba(239, 68, 68, 0.3)',
              border: '1px solid rgba(239, 68, 68, 0.5)',
            }}
          >
            <div style={{
              width: 8,
              height: 8,
              borderRadius: '50%',
              background: '#EF4444',
              animation: 'pulse 1s infinite',
            }} />
            <span style={{ fontSize: 11, color: '#EF4444', fontWeight: 600 }}>录制中</span>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Mini playback controls (bottom-center) */}
      <AnimatePresence>
        {showUI && (
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: 20 }}
            transition={{ duration: 0.3 }}
            style={{
              position: 'absolute',
              bottom: 30,
              left: '50%',
              transform: 'translateX(-50%)',
              zIndex: 10,
              display: 'flex',
              alignItems: 'center',
              gap: 16,
              padding: '8px 20px',
              borderRadius: 30,
              background: 'rgba(0, 0, 0, 0.5)',
              backdropFilter: 'blur(12px)',
              border: '1px solid rgba(255, 255, 255, 0.1)',
            }}
          >
            <span style={{ fontSize: 10, color: 'rgba(255,255,255,0.4)', fontVariantNumeric: 'tabular-nums', width: 36 }}>
              {formatTime(currentTime)}
            </span>
            <motion.button
              whileHover={{ scale: 1.1 }}
              whileTap={{ scale: 0.9 }}
              onClick={() => { const idx = useMusicStore.getState().prevTrack(); if (idx !== currentTrackIndex) loadTrack(idx, isPlaying); }}
              style={{ display: 'flex', border: 'none', background: 'none', cursor: 'pointer', color: 'rgba(255,255,255,0.7)', padding: 0 }}
            >
              <SkipBack size={18} />
            </motion.button>
            <motion.button
              whileHover={{ scale: 1.1 }}
              whileTap={{ scale: 0.9 }}
              onClick={togglePlay}
              style={{
                display: 'flex', alignItems: 'center', justifyContent: 'center',
                width: 40, height: 40, borderRadius: '50%',
                background: 'rgba(255,255,255,0.15)',
                border: 'none', cursor: 'pointer', color: '#fff',
              }}
            >
              {isPlaying ? <Pause size={18} /> : <Play size={18} style={{ marginLeft: 2 }} />}
            </motion.button>
            <motion.button
              whileHover={{ scale: 1.1 }}
              whileTap={{ scale: 0.9 }}
              onClick={() => { const idx = useMusicStore.getState().nextTrack(); loadTrack(idx, isPlaying); }}
              style={{ display: 'flex', border: 'none', background: 'none', cursor: 'pointer', color: 'rgba(255,255,255,0.7)', padding: 0 }}
            >
              <SkipForward size={18} />
            </motion.button>
            <span style={{ fontSize: 10, color: 'rgba(255,255,255,0.4)', fontVariantNumeric: 'tabular-nums', width: 36, textAlign: 'right' }}>
              {formatTime(duration)}
            </span>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Control Panel */}
      <AnimatePresence>
        {showUI && (
          <motion.div
            initial={{ opacity: 0, x: 20 }}
            animate={{ opacity: 1, x: 0 }}
            exit={{ opacity: 0, x: 20 }}
            transition={{ duration: 0.3, delay: 0.1 }}
          >
            <VisualizerControlPanel
              isFullscreen
              onScreenshot={handleScreenshot}
              onToggleRecording={handleToggleRecording}
              isRecording={isRecording}
              onExitFullscreen={handleExitFullscreen}
            />
          </motion.div>
        )}
      </AnimatePresence>

      {/* Pulse animation keyframes */}
      <style>{`
        @keyframes pulse {
          0%, 100% { opacity: 1; }
          50% { opacity: 0.4; }
        }
      `}</style>
    </div>
  );
};

export default FullscreenVisualizer;
