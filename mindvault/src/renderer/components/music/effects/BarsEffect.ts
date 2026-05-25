/**
 * Bars (柱状频谱) visualizer effect.
 * Extracted from AudioVisualizer.tsx drawBars().
 */

import type { IVisualizerEffect, AudioDataFrame, EffectTheme, EffectConfig } from './types';
import { lightenHex, darkenHex, hexToRgba } from '../utils/color';

export class BarsEffect implements IVisualizerEffect {
  readonly id = 'bars';
  readonly name = '柱状频谱';
  readonly description = '经典频谱柱状图，随音乐节奏跳动';
  readonly icon = 'BarChart3';

  private barCount = 32;
  private gap = 2;
  private borderRadius = 2;

  init(width: number, height: number): void {
    // No internal state needed for bars
  }

  render(
    ctx: CanvasRenderingContext2D,
    frame: AudioDataFrame,
    theme: EffectTheme,
    config: EffectConfig,
    _transitionProgress: number,
  ): void {
    const { width: w, height: h, smoothed } = frame;
    const primary = theme.primary;
    const primaryLight = theme.secondary;
    const barCount = smoothed.length;
    const totalGap = this.gap * (barCount - 1);
    const barWidth = Math.max(1, (w - totalGap) / barCount);
    const maxBarHeight = h * 0.9;

    for (let i = 0; i < barCount; i++) {
      const val = smoothed[i] / 255;
      const barHeight = Math.max(2, val * maxBarHeight * config.intensity);
      const x = i * (barWidth + this.gap);
      const y = h - barHeight;

      // Mirror mode: draw from center
      let drawX = x;
      if (config.mirror) {
        const centerX = w / 2;
        const distFromCenter = x - centerX;
        drawX = centerX - distFromCenter;
      }

      // Gradient fill
      const gradient = ctx.createLinearGradient(drawX, h, drawX, y);
      gradient.addColorStop(0, primary);
      gradient.addColorStop(0.5, primaryLight);
      gradient.addColorStop(1, lightenHex(primaryLight, 0.3));
      ctx.fillStyle = gradient;

      // Draw rounded rect
      const r = Math.min(this.borderRadius, barWidth / 2, barHeight / 2);
      ctx.beginPath();
      ctx.moveTo(drawX + r, y);
      ctx.lineTo(drawX + barWidth - r, y);
      ctx.quadraticCurveTo(drawX + barWidth, y, drawX + barWidth, y + r);
      ctx.lineTo(drawX + barWidth, h);
      ctx.lineTo(drawX, h);
      ctx.lineTo(drawX, y + r);
      ctx.quadraticCurveTo(drawX, y, drawX + r, y);
      ctx.closePath();
      ctx.fill();

      // Glow effect for high amplitude bars
      if (config.glow && val > 0.7) {
        ctx.save();
        ctx.shadowColor = theme.glowColor || primary;
        ctx.shadowBlur = 10 * val * config.glowIntensity;
        ctx.fillStyle = hexToRgba(primaryLight, 0.5);
        ctx.fill();
        ctx.restore();
      }
    }
  }

  setBarCount(count: number): void {
    this.barCount = count;
  }

  setGap(gap: number): void {
    this.gap = gap;
  }

  setBorderRadius(radius: number): void {
    this.borderRadius = radius;
  }

  resize(_width: number, _height: number): void {
    // No-op for bars
  }

  destroy(): void {
    // No resources to release
  }
}
