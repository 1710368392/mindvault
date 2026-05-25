/**
 * Circular (环形频谱) visualizer effect.
 * Extracted from AudioVisualizer.tsx drawCircular().
 */

import type { IVisualizerEffect, AudioDataFrame, EffectTheme, EffectConfig } from './types';
import { lightenHex, darkenHex, hexToRgba } from '../utils/color';
import { getAverageFrequency } from '../utils/audio-analysis';

export class CircularEffect implements IVisualizerEffect {
  readonly id = 'circular';
  readonly name = '环形频谱';
  readonly description = '音频波形围绕圆心旋转，线条随音量变化';
  readonly icon = 'Circle';

  private rotationAngle = 0;

  init(_width: number, _height: number): void {
    this.rotationAngle = 0;
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
    const cx = w / 2;
    const cy = h / 2;
    const baseRadius = Math.min(w, h) * 0.2;
    const maxBarLen = Math.min(w, h) * 0.25;
    const count = smoothed.length;
    const angleStep = (Math.PI * 2) / count;
    const speed = config.speed;

    // Update rotation
    this.rotationAngle += 0.001 * speed;

    // Draw inner glow circle
    const avgFreq = getAverageFrequency(smoothed);
    const pulseRadius = baseRadius * 0.8 + (avgFreq / 255) * 10 * config.intensity;
    const gradient = ctx.createRadialGradient(cx, cy, 0, cx, cy, pulseRadius);
    gradient.addColorStop(0, hexToRgba(primary, 0.3));
    gradient.addColorStop(0.5, hexToRgba(primaryLight, 0.1));
    gradient.addColorStop(1, 'transparent');
    ctx.fillStyle = gradient;
    ctx.beginPath();
    ctx.arc(cx, cy, pulseRadius, 0, Math.PI * 2);
    ctx.fill();

    // Draw frequency bars
    for (let i = 0; i < count; i++) {
      const val = smoothed[i] / 255;
      const barLen = Math.max(2, val * maxBarLen * config.intensity);
      const angle = i * angleStep - Math.PI / 2 + this.rotationAngle + time * 0.1 * speed;

      const x1 = cx + Math.cos(angle) * baseRadius;
      const y1 = cy + Math.sin(angle) * baseRadius;
      const x2 = cx + Math.cos(angle) * (baseRadius + barLen);
      const y2 = cy + Math.sin(angle) * (baseRadius + barLen);

      const barGradient = ctx.createLinearGradient(x1, y1, x2, y2);
      barGradient.addColorStop(0, primary);
      barGradient.addColorStop(0.5, primaryLight);
      barGradient.addColorStop(1, lightenHex(primaryLight, val * 0.5));

      ctx.beginPath();
      ctx.moveTo(x1, y1);
      ctx.lineTo(x2, y2);
      ctx.strokeStyle = barGradient;
      ctx.lineWidth = Math.max(1.5, (Math.PI * 2 * baseRadius) / count * 0.6);
      ctx.lineCap = 'round';

      if (config.glow && val > 0.6) {
        ctx.save();
        ctx.shadowColor = theme.glowColor || primary;
        ctx.shadowBlur = 8 * val * config.glowIntensity;
        ctx.stroke();
        ctx.restore();
      } else {
        ctx.stroke();
      }
    }

    // Draw center circle
    ctx.beginPath();
    ctx.arc(cx, cy, baseRadius * 0.6, 0, Math.PI * 2);
    ctx.fillStyle = hexToRgba(primaryDark, 0.8);
    ctx.fill();
    ctx.strokeStyle = primary;
    ctx.lineWidth = 2;
    ctx.stroke();
  }

  resize(_width: number, _height: number): void {
    // No-op
  }

  destroy(): void {
    // No resources to release
  }
}
