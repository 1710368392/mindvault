/**
 * VisualizerEngine - Core rendering engine for audio visualization.
 * Pure TypeScript class (not a React component) for maximum performance.
 * Manages effect plugins, rendering loop, transitions, and DPR adaptation.
 */

import type { IVisualizerEffect, AudioDataFrame, EffectTheme, EffectConfig, VisualizationMode } from './effects/types';
import { DEFAULT_EFFECT_CONFIG } from './effects/types';
import { createEffect } from './effects/index';
import {
  getAverageFrequency,
  getAdaptiveSmoothing,
  smoothFrequency,
  applySensitivity,
  downsampleFrequency,
  buildAudioDataFrame,
} from './utils/audio-analysis';

/** Engine configuration */
export interface EngineConfig {
  /** Target bar count for down-sampling (default 32) */
  barCount: number;
  /** Whether to enable FPS monitoring */
  enableFpsMonitor: boolean;
}

const DEFAULT_ENGINE_CONFIG: EngineConfig = {
  barCount: 32,
  enableFpsMonitor: false,
};

/** FPS monitor data */
export interface FpsData {
  current: number;
  average: number;
  min: number;
  max: number;
}

type FrequencyDataProvider = () => number[];
type IsPlayingProvider = () => boolean;

export class VisualizerEngine {
  private currentEffect: IVisualizerEffect | null = null;
  private previousEffect: IVisualizerEffect | null = null;
  private transitionProgress = -1; // -1 = no transition, 0→1 = transitioning
  private transitionStartTime = 0;
  private readonly transitionDuration = 500; // ms

  private canvas: HTMLCanvasElement | null = null;
  private ctx: CanvasRenderingContext2D | null = null;
  private animFrameId = 0;
  private startTime = 0;
  private smoothedData: number[] = [];

  private currentMode: VisualizationMode = 'bars';
  private currentTheme: EffectTheme | null = null;
  private currentConfig: EffectConfig = { ...DEFAULT_EFFECT_CONFIG };
  private engineConfig: EngineConfig = { ...DEFAULT_ENGINE_CONFIG };

  private frequencyProvider: FrequencyDataProvider | null = null;
  private isPlayingProvider: IsPlayingProvider | null = null;

  // FPS monitoring
  private fpsFrames: number[] = [];
  private lastFpsTime = 0;
  private fpsData: FpsData = { current: 0, average: 60, min: 60, max: 60 };

  private isVisible = true;
  private destroyed = false;

  /** Set the frequency data provider (e.g., reads from musicStore) */
  setFrequencyProvider(provider: FrequencyDataProvider): void {
    this.frequencyProvider = provider;
  }

  /** Set the is-playing state provider */
  setIsPlayingProvider(provider: IsPlayingProvider): void {
    this.isPlayingProvider = provider;
  }

  /** Set the engine configuration */
  setEngineConfig(config: Partial<EngineConfig>): void {
    this.engineConfig = { ...this.engineConfig, ...config };
  }

  /** Get current FPS data */
  getFpsData(): FpsData {
    return { ...this.fpsData };
  }

  /** Switch to a different visualization mode with transition animation */
  switchMode(mode: VisualizationMode): void {
    if (mode === this.currentMode && this.currentEffect) return;

    // Save current effect as previous for transition
    if (this.currentEffect) {
      this.previousEffect = this.currentEffect;
    }

    // Create new effect
    const newEffect = createEffect(mode);
    if (this.canvas) {
      newEffect.init(this.canvas.width, this.canvas.height);
    }

    this.currentEffect = newEffect;
    this.currentMode = mode;

    // Start transition
    this.transitionProgress = 0;
    this.transitionStartTime = performance.now();

    // Reset smoothed data for new effect
    this.smoothedData = new Array(this.engineConfig.barCount).fill(0);
  }

  /** Set the current color theme */
  setTheme(theme: EffectTheme): void {
    this.currentTheme = theme;
  }

  /** Set the current effect configuration */
  setConfig(config: Partial<EffectConfig>): void {
    this.currentConfig = { ...this.currentConfig, ...config };
  }

  /** Get the current mode */
  getMode(): VisualizationMode {
    return this.currentMode;
  }

  /** Attach the engine to a canvas element */
  attach(canvas: HTMLCanvasElement): void {
    this.canvas = canvas;
    this.ctx = canvas.getContext('2d');
    this.startTime = performance.now();
    this.lastFpsTime = performance.now();

    if (this.currentEffect) {
      this.currentEffect.init(canvas.width, canvas.height);
    }

    // Start render loop
    this.destroyed = false;
    this.tick();
  }

  /** Detach the engine from the canvas */
  detach(): void {
    this.stopLoop();
    this.canvas = null;
    this.ctx = null;
  }

  /** Notify the engine about visibility changes */
  setVisible(visible: boolean): void {
    this.isVisible = visible;
    if (visible && !this.destroyed && this.canvas) {
      this.lastFpsTime = performance.now();
      this.tick();
    } else {
      this.stopLoop();
    }
  }

  /** Get the canvas element (for screenshot/recording) */
  getCanvas(): HTMLCanvasElement | null {
    return this.canvas;
  }

  /** Destroy the engine and release all resources */
  destroy(): void {
    this.destroyed = true;
    this.stopLoop();
    this.currentEffect?.destroy();
    this.previousEffect?.destroy();
    this.currentEffect = null;
    this.previousEffect = null;
    this.canvas = null;
    this.ctx = null;
  }

  // ===== Private methods =====

  private stopLoop(): void {
    if (this.animFrameId) {
      cancelAnimationFrame(this.animFrameId);
      this.animFrameId = 0;
    }
  }

  private tick = (): void => {
    if (this.destroyed || !this.isVisible) return;

    this.renderFrame();
    this.updateFps();

    this.animFrameId = requestAnimationFrame(this.tick);
  };

  private renderFrame(): void {
    if (!this.ctx || !this.canvas || !this.currentEffect || !this.currentTheme) return;

    const canvas = this.canvas;
    const ctx = this.ctx;
    const dpr = window.devicePixelRatio || 1;
    const displayW = canvas.width / dpr;
    const displayH = canvas.height / dpr;

    // Get audio data
    const rawFrequency = this.frequencyProvider ? this.frequencyProvider() : new Array(64).fill(0);
    const isPlaying = this.isPlayingProvider ? this.isPlayingProvider() : false;

    // Down-sample and apply sensitivity
    const sampled = downsampleFrequency(rawFrequency, this.engineConfig.barCount);
    const sensitized = applySensitivity(sampled, this.currentConfig.sensitivity);

    // Smooth
    const avgFreq = getAverageFrequency(sensitized);
    const smoothingFactor = getAdaptiveSmoothing(isPlaying, avgFreq);
    const targets = isPlaying ? sensitized : new Array(this.engineConfig.barCount).fill(0);
    this.smoothedData = smoothFrequency(this.smoothedData, targets, smoothingFactor);

    // Build frame data
    const time = (performance.now() - this.startTime) / 1000;
    const frame: AudioDataFrame = buildAudioDataFrame(
      rawFrequency,
      this.smoothedData,
      isPlaying,
      displayW,
      displayH,
      time,
    );

    // Update transition
    if (this.transitionProgress >= 0) {
      const elapsed = performance.now() - this.transitionStartTime;
      const raw = Math.min(elapsed / this.transitionDuration, 1);
      // easeInOutCubic
      this.transitionProgress = raw < 0.5
        ? 4 * raw * raw * raw
        : 1 - Math.pow(-2 * raw + 2, 3) / 2;

      if (raw >= 1) {
        this.transitionProgress = -1;
        this.previousEffect?.destroy();
        this.previousEffect = null;
      }
    }

    // Clear canvas
    ctx.clearRect(0, 0, displayW, displayH);

    // Render previous effect (fading out)
    if (this.previousEffect && this.transitionProgress >= 0) {
      ctx.save();
      ctx.globalAlpha = 1 - this.transitionProgress;
      this.previousEffect.render(ctx, frame, this.currentTheme, this.currentConfig, -1);
      ctx.restore();
    }

    // Render current effect (fading in during transition)
    if (this.transitionProgress >= 0) {
      ctx.save();
      ctx.globalAlpha = this.transitionProgress;
      this.currentEffect.render(ctx, frame, this.currentTheme, this.currentConfig, this.transitionProgress);
      ctx.restore();
    } else {
      this.currentEffect.render(ctx, frame, this.currentTheme, this.currentConfig, -1);
    }
  }

  private updateFps(): void {
    if (!this.engineConfig.enableFpsMonitor) return;

    const now = performance.now();
    const delta = now - this.lastFpsTime;
    this.lastFpsTime = now;

    if (delta > 0) {
      const fps = 1000 / delta;
      this.fpsFrames.push(fps);
      if (this.fpsFrames.length > 60) this.fpsFrames.shift();

      this.fpsData.current = Math.round(fps);
      this.fpsData.average = Math.round(
        this.fpsFrames.reduce((a, b) => a + b, 0) / this.fpsFrames.length,
      );
      this.fpsData.min = Math.round(Math.min(...this.fpsFrames));
      this.fpsData.max = Math.round(Math.max(...this.fpsFrames));
    }
  }
}
