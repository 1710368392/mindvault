/**
 * Particles (粒子系统) visualizer effect.
 * Extracted from AudioVisualizer.tsx drawParticles().
 */

import type { IVisualizerEffect, AudioDataFrame, EffectTheme, EffectConfig } from './types';
import { hexToRgba } from '../utils/color';
import { getBassAverage, getAverageFrequency } from '../utils/audio-analysis';

interface Particle {
  x: number;
  y: number;
  vx: number;
  vy: number;
  life: number;
  maxLife: number;
  size: number;
  color: string;
}

const MAX_PARTICLES = 200;

export class ParticlesEffect implements IVisualizerEffect {
  readonly id = 'particles';
  readonly name = '粒子效果';
  readonly description = '低音驱动粒子发射，频率环与脉冲效果';
  readonly icon = 'Sparkles';

  private particles: Particle[] = [];

  init(_width: number, _height: number): void {
    this.particles = [];
  }

  render(
    ctx: CanvasRenderingContext2D,
    frame: AudioDataFrame,
    theme: EffectTheme,
    config: EffectConfig,
    _transitionProgress: number,
  ): void {
    const { width: w, height: h, smoothed, isPlaying, time } = frame;
    const primary = theme.primary;
    const primaryLight = theme.secondary;
    const cx = w / 2;
    const cy = h / 2;
    const bassAvg = getBassAverage(smoothed);
    const avgFreq = getAverageFrequency(smoothed);
    const speed = config.speed;

    // Spawn new particles based on bass
    if (isPlaying && bassAvg > 80) {
      const spawnCount = Math.min(Math.floor(bassAvg / 60), 5);
      for (let i = 0; i < spawnCount; i++) {
        if (this.particles.length >= MAX_PARTICLES) break;
        const angle = Math.random() * Math.PI * 2;
        const spd = (1 + Math.random() * 3) * speed;
        this.particles.push({
          x: cx,
          y: cy,
          vx: Math.cos(angle) * spd,
          vy: Math.sin(angle) * spd,
          life: 1,
          maxLife: 0.5 + Math.random() * 1,
          size: 2 + Math.random() * 4,
          color: Math.random() > 0.5 ? primary : primaryLight,
        });
      }
    }

    // Update and draw particles
    this.particles = this.particles.filter((p) => {
      p.x += p.vx * speed;
      p.y += p.vy * speed;
      p.life -= 0.016 / p.maxLife;
      p.size *= 0.99;

      if (p.life > 0) {
        ctx.save();
        ctx.globalAlpha = p.life * config.intensity;
        ctx.fillStyle = p.color;
        if (config.glow) {
          ctx.shadowColor = theme.glowColor || p.color;
          ctx.shadowBlur = 10 * config.glowIntensity;
        }
        ctx.beginPath();
        ctx.arc(p.x, p.y, p.size, 0, Math.PI * 2);
        ctx.fill();
        ctx.restore();
      }

      return p.life > 0;
    });

    // Draw frequency rings
    const ringCount = 3;
    for (let r = 0; r < ringCount; r++) {
      const radius = 20 + r * 15 + (avgFreq / 255) * 10 * config.intensity;
      const alpha = 0.3 - r * 0.1;

      ctx.beginPath();
      ctx.arc(cx, cy, radius, 0, Math.PI * 2);
      ctx.strokeStyle = hexToRgba(primary, alpha);
      ctx.lineWidth = 2;
      ctx.stroke();
    }

    // Draw bass pulse
    if (bassAvg > 50) {
      const pulseSize = (bassAvg / 255) * Math.min(w, h) * 0.4 * config.intensity;
      ctx.save();
      ctx.strokeStyle = hexToRgba(primaryLight, 0.5);
      ctx.lineWidth = 3;
      if (config.glow) {
        ctx.shadowColor = theme.glowColor || primary;
        ctx.shadowBlur = 15 * config.glowIntensity;
      }
      ctx.beginPath();
      ctx.arc(cx, cy, pulseSize, 0, Math.PI * 2);
      ctx.stroke();
      ctx.restore();
    }
  }

  resize(_width: number, _height: number): void {
    // No-op
  }

  destroy(): void {
    this.particles = [];
  }
}
