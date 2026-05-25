/**
 * Audio analysis utility functions.
 * Extracted from AudioVisualizer.tsx and DynamicBackground.tsx.
 */

import type { AudioDataFrame } from '../effects/types';

/** Calculate average frequency value (0-255) */
export function getAverageFrequency(data: number[]): number {
  if (data.length === 0) return 0;
  return data.reduce((sum, val) => sum + val, 0) / data.length;
}

/** Get bass frequency average (low frequencies, first 25%) */
export function getBassAverage(data: number[]): number {
  if (data.length === 0) return 0;
  const bassCount = Math.max(1, Math.floor(data.length * 0.25));
  const bassData = data.slice(0, bassCount);
  return bassData.reduce((sum, val) => sum + val, 0) / bassData.length;
}

/** Get mid frequency average (mid frequencies, 25%-50%) */
export function getMidAverage(data: number[]): number {
  if (data.length === 0) return 0;
  const start = Math.max(1, Math.floor(data.length * 0.25));
  const end = Math.max(start + 1, Math.floor(data.length * 0.5));
  const midData = data.slice(start, end);
  if (midData.length === 0) return 0;
  return midData.reduce((sum, val) => sum + val, 0) / midData.length;
}

/** Get high frequency average (high frequencies, 50%-100%) */
export function getHighAverage(data: number[]): number {
  if (data.length === 0) return 0;
  const start = Math.max(1, Math.floor(data.length * 0.5));
  const highData = data.slice(start);
  if (highData.length === 0) return 0;
  return highData.reduce((sum, val) => sum + val, 0) / highData.length;
}

/** Get frequency bands as normalized values (0-1) */
export function getFrequencyBands(data: number[]): { bass: number; mid: number; high: number; overall: number } {
  const bass = getBassAverage(data) / 255;
  const mid = getMidAverage(data) / 255;
  const high = getHighAverage(data) / 255;
  const overall = (bass + mid + high) / 3;
  return { bass, mid, high, overall };
}

/** Down-sample frequency data to target bin count */
export function downsampleFrequency(data: number[], targetBins: number): number[] {
  if (data.length === 0) return new Array(targetBins).fill(0);
  const step = data.length / targetBins;
  const result: number[] = [];
  for (let i = 0; i < targetBins; i++) {
    const idx = Math.floor(i * step);
    result.push(data[idx] ?? 0);
  }
  return result;
}

/** Apply sensitivity multiplier to frequency data */
export function applySensitivity(data: number[], sensitivity: number): number[] {
  return data.map((val) => Math.min(255, val * sensitivity));
}

/** Smooth frequency values towards targets */
export function smoothFrequency(
  smoothed: number[],
  targets: number[],
  factor: number,
): number[] {
  const result = [...smoothed];
  for (let i = 0; i < targets.length; i++) {
    const target = i < targets.length ? targets[i] : 0;
    const current = i < result.length ? result[i] : 0;
    result[i] = current + (target - current) * factor;
    if (Math.abs(result[i] - target) < 0.5) result[i] = target;
  }
  return result;
}

/** Calculate adaptive smoothing factor based on audio energy */
export function getAdaptiveSmoothing(isPlaying: boolean, avgFrequency: number): number {
  const baseSmoothing = isPlaying ? 0.25 : 0.08;
  return baseSmoothing + (avgFrequency / 255) * 0.15;
}

/** Build a complete AudioDataFrame from raw frequency data */
export function buildAudioDataFrame(
  rawFrequency: number[],
  smoothedData: number[],
  isPlaying: boolean,
  width: number,
  height: number,
  time: number,
): AudioDataFrame {
  const data = rawFrequency.length > 0 ? rawFrequency : new Array(64).fill(0);
  const bands = getFrequencyBands(data);
  return {
    frequency: data,
    smoothed: smoothedData,
    bass: bands.bass,
    mid: bands.mid,
    high: bands.high,
    overall: bands.overall,
    time,
    isPlaying,
    width,
    height,
  };
}
