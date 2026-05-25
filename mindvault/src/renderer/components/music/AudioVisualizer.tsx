import React, { useRef, useEffect, useMemo } from 'react';
import { useMusicStore, getFrequencyData } from '../../stores/musicStore';
import { VisualizerEngine } from './VisualizerEngine';
import type { VisualizationMode, EffectTheme } from './effects/types';
import { resolveColor } from './utils/color';
import { DEFAULT_THEME_ID, getTheme } from './themes';

interface AudioVisualizerProps {
  width?: number;
  height?: number;
  style?: React.CSSProperties;
  mode?: 'bars' | 'wave' | 'circular' | 'particles';
  color?: string;
  barCount?: number;
  gap?: number;
  borderRadius?: number;
  opacity?: number;
  sensitivity?: number; // 灵敏度 0-2
  mirror?: boolean; // 是否镜像显示
}

/**
 * AudioVisualizer - Lightweight shell component that delegates rendering to VisualizerEngine.
 *
 * Props interface is 100% backward compatible with the original implementation.
 * Header.tsx and MusicPlayerWindow.tsx require ZERO changes.
 */
const AudioVisualizer: React.FC<AudioVisualizerProps> = ({
  width = 360,
  height = 48,
  style,
  mode = 'bars',
  color,
  barCount = 32,
  gap = 2,
  borderRadius = 2,
  opacity = 1,
  sensitivity = 1,
  mirror = false,
}) => {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const engineRef = useRef<VisualizerEngine | null>(null);

  const isPlaying = useMusicStore((s) => s.isPlaying);

  // Build effect theme from color prop or CSS variable
  const effectTheme: EffectTheme = useMemo(() => {
    const primary = resolveColor(color, 'var(--primary-color)');
    // Resolve CSS variable to actual color for the engine
    let resolvedPrimary = primary;
    if (primary.startsWith('var(')) {
      try {
        const varName = primary.slice(4, -1).trim();
        resolvedPrimary = getComputedStyle(document.documentElement).getPropertyValue(varName).trim() || '#8B5CF6';
      } catch {
        resolvedPrimary = '#8B5CF6';
      }
    }
    return {
      primary: resolvedPrimary,
      secondary: resolvedPrimary, // Engine's lightenHex will handle this
      accent: resolvedPrimary,
      background: 'transparent',
      glowColor: resolvedPrimary,
      opacity,
    };
  }, [color, opacity]);

  // Initialize engine once
  useEffect(() => {
    const engine = new VisualizerEngine();
    engine.setFrequencyProvider(() => getFrequencyData());
    engine.setIsPlayingProvider(() => useMusicStore.getState().isPlaying);
    engine.setEngineConfig({ barCount });
    engine.setTheme(effectTheme);
    engine.setConfig({
      sensitivity,
      mirror,
      glow: true,
      glowIntensity: 0.7,
      speed: 1,
      intensity: 1,
    });
    engine.switchMode(mode as VisualizationMode);
    engineRef.current = engine;

    return () => {
      engine.destroy();
      engineRef.current = null;
    };
    // Only re-init when these core props change
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [barCount]);

  // Attach/detach canvas
  useEffect(() => {
    const canvas = canvasRef.current;
    const engine = engineRef.current;
    if (!canvas || !engine) return;

    const dpr = window.devicePixelRatio || 1;
    canvas.width = width * dpr;
    canvas.height = height * dpr;
    canvas.style.width = `${width}px`;
    canvas.style.height = `${height}px`;

    engine.attach(canvas);

    return () => {
      engine.detach();
    };
  }, [width, height]);

  // Update engine when mode changes
  useEffect(() => {
    engineRef.current?.switchMode(mode as VisualizationMode);
  }, [mode]);

  // Update engine when theme/color changes
  useEffect(() => {
    engineRef.current?.setTheme(effectTheme);
  }, [effectTheme]);

  // Update engine when sensitivity or mirror changes
  useEffect(() => {
    engineRef.current?.setConfig({ sensitivity, mirror });
  }, [sensitivity, mirror]);

  return (
    <canvas
      ref={canvasRef}
      style={{
        display: 'block',
        opacity,
        ...style,
      }}
    />
  );
};

export default AudioVisualizer;
