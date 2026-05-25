/**
 * Wave (波形图) visualizer effect.
 * Extracted from AudioVisualizer.tsx drawWave().
 */

import type { IVisualizerEffect, AudioDataFrame, EffectTheme, EffectConfig } from './types';
import { lightenHex, darkenHex, hexToRgba } from '../utils/color';
import { getAverageFrequency } from '../utils/audio-analysis';

export class WaveEffect implements IVisualizerEffect {
  readonly id = 'wave';
  readonly name = '波形图';
  readonly description = '平滑贝塞尔曲线波形，带渐变填充';
  readonly icon = 'Activity';

  init(_width: number, _height: number): void {
    // No internal state needed
  }

  render(
    ctx: CanvasRenderingContext2D,
    frame: AudioDataFrame,
    theme: EffectTheme,
    config: EffectConfig,
    _transitionProgress: number,
  ): void {
    const { width: w, height: h, smoothed, time } = frame;
    const primary = theme.primary;
    const primaryLight = theme.secondary;
    const primaryDark = darkenHex(primary, 0.2);
    const count = smoothed.length;
    const step = w / (count - 1);
    const midY = h / 2;
    const speed = config.speed;

    // Dynamic baseline
    const avg = getAverageFrequency(smoothed);
    const baselineOffset = Math.sin(time * 2 * speed) * (avg / 255) * 5;

    // Draw filled area with gradient
    ctx.beginPath();
    ctx.moveTo(0, midY + baselineOffset);

    for (let i = 0; i < count; i++) {
      const val = smoothed[i] / 255;
      const amplitude = val * midY * 0.85 * config.intensity;
      const x = i * step;
      const waveOffset = Math.sin(time * 3 * speed + i * 0.2) * 3 * val;
      const y = midY - amplitude + waveOffset + baselineOffset;

      if (i === 0) {
        ctx.lineTo(x, y);
      } else {
        const prevX = (i - 1) * step;
        const prevVal = smoothed[i - 1] / 255;
        const prevWaveOffset = Math.sin(time * 3 * speed + (i - 1) * 0.2) * 3 * prevVal;
        const prevY = midY - prevVal * midY * 0.85 * config.intensity + prevWaveOffset + baselineOffset;
        const cpx = (prevX + x) / 2;
        ctx.bezierCurveTo(cpx, prevY, cpx, y, x, y);
      }
    }

    // Close path
    if (config.mirror) {
      for (let i = count - 1; i >= 0; i--) {
        const val = smoothed[i] / 255;
        const amplitude = val * midY * 0.85 * config.intensity;
        const x = i * step;
        const waveOffset = Math.sin(time * 3 * speed + i * 0.2) * 3 * val;
        const y = midY + amplitude + waveOffset + baselineOffset;

        if (i === count - 1) {
          ctx.lineTo(x, y);
        } else {
          const nextX = (i + 1) * step;
          const nextVal = smoothed[i + 1] / 255;
          const nextWaveOffset = Math.sin(time * 3 * speed + (i + 1) * 0.2) * 3 * nextVal;
          const nextY = midY + nextVal * midY * 0.85 * config.intensity + nextWaveOffset + baselineOffset;
          const cpx = (nextX + x) / 2;
          ctx.bezierCurveTo(cpx, nextY, cpx, y, x, y);
        }
      }
    } else {
      ctx.lineTo(w, midY + baselineOffset);
      ctx.lineTo(w, h);
      ctx.lineTo(0, h);
    }
    ctx.closePath();

    const gradient = ctx.createLinearGradient(0, 0, 0, h);
    gradient.addColorStop(0, hexToRgba(primaryLight, 0.8));
    gradient.addColorStop(0.3, hexToRgba(primary, 0.6));
    gradient.addColorStop(0.7, hexToRgba(primaryDark, 0.3));
    gradient.addColorStop(1, 'transparent');
    ctx.fillStyle = gradient;
    ctx.fill();

    // Draw wave line with glow
    ctx.save();
    ctx.beginPath();
    ctx.moveTo(0, midY + baselineOffset);
    for (let i = 0; i < count; i++) {
      const val = smoothed[i] / 255;
      const amplitude = val * midY * 0.85 * config.intensity;
      const x = i * step;
      const waveOffset = Math.sin(time * 3 * speed + i * 0.2) * 3 * val;
      const y = midY - amplitude + waveOffset + baselineOffset;
      if (i === 0) {
        ctx.lineTo(x, y);
      } else {
        const prevX = (i - 1) * step;
        const prevVal = smoothed[i - 1] / 255;
        const prevWaveOffset = Math.sin(time * 3 * speed + (i - 1) * 0.2) * 3 * prevVal;
        const prevY = midY - prevVal * midY * 0.85 * config.intensity + prevWaveOffset + baselineOffset;
        const cpx = (prevX + x) / 2;
        ctx.bezierCurveTo(cpx, prevY, cpx, y, x, y);
      }
    }
    ctx.strokeStyle = primary;
    ctx.lineWidth = 2;
    ctx.lineCap = 'round';
    ctx.lineJoin = 'round';
    if (config.glow) {
      ctx.shadowColor = theme.glowColor || primary;
      ctx.shadowBlur = 8 * config.glowIntensity;
    }
    ctx.stroke();
    ctx.restore();
  }

  resize(_width: number, _height: number): void {
    // No-op
  }

  destroy(): void {
    // No resources to release
  }
}
