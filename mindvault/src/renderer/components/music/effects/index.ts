/**
 * Visualizer effect registry.
 * Central place to register and create visualizer effect instances.
 */

import type { IVisualizerEffect, VisualizationMode } from './types';
import { BarsEffect } from './BarsEffect';
import { WaveEffect } from './WaveEffect';
import { CircularEffect } from './CircularEffect';
import { ParticlesEffect } from './ParticlesEffect';
import { Cube3DEffect } from './Cube3DEffect';

/** Effect factory function type */
type EffectFactory = () => IVisualizerEffect;

/** Registry of all available visualizer effects */
export const effectRegistry: Map<string, EffectFactory> = new Map([
  ['bars', () => new BarsEffect()],
  ['wave', () => new WaveEffect()],
  ['circular', () => new CircularEffect()],
  ['particles', () => new ParticlesEffect()],
  ['cube3d', () => new Cube3DEffect()],
]);

/** Create a new effect instance by mode ID */
export function createEffect(mode: VisualizationMode): IVisualizerEffect {
  const factory = effectRegistry.get(mode);
  if (!factory) {
    throw new Error(`Unknown visualizer effect mode: ${mode}`);
  }
  return factory();
}

/** Get all registered effect IDs */
export function getRegisteredModes(): VisualizationMode[] {
  return Array.from(effectRegistry.keys()) as VisualizationMode[];
}

/** Check if a mode is registered */
export function isModeRegistered(mode: string): boolean {
  return effectRegistry.has(mode);
}
