/**
 * Visualizer effect plugin interfaces and types.
 */

/** Frequency data snapshot, computed each frame by the engine */
export interface AudioDataFrame {
  /** Raw frequency data (64 bins, 0-255) */
  frequency: number[];
  /** Smoothed frequency data (same length as barCount) */
  smoothed: number[];
  /** Bass average (0-1) */
  bass: number;
  /** Mid average (0-1) */
  mid: number;
  /** High average (0-1) */
  high: number;
  /** Overall average (0-1) */
  overall: number;
  /** Current time in seconds */
  time: number;
  /** Whether audio is playing */
  isPlaying: boolean;
  /** Canvas logical width */
  width: number;
  /** Canvas logical height */
  height: number;
}

/** Effect color theme parameters */
export interface EffectTheme {
  primary: string;
  secondary: string;
  accent: string;
  background: string;
  glowColor: string;
  opacity: number;
}

/** Effect configuration parameters */
export interface EffectConfig {
  /** Sensitivity multiplier (0-2, default 1) */
  sensitivity: number;
  /** Animation speed multiplier (0.5-3, default 1) */
  speed: number;
  /** Effect intensity (0-1, default 1) */
  intensity: number;
  /** Mirror mode */
  mirror: boolean;
  /** Enable glow effects */
  glow: boolean;
  /** Glow intensity (0-1, default 0.7) */
  glowIntensity: number;
}

/** Default effect config values */
export const DEFAULT_EFFECT_CONFIG: EffectConfig = {
  sensitivity: 1,
  speed: 1,
  intensity: 1,
  mirror: false,
  glow: true,
  glowIntensity: 0.7,
};

/** Visualizer effect plugin interface */
export interface IVisualizerEffect {
  /** Unique effect identifier */
  readonly id: string;
  /** Display name */
  readonly name: string;
  /** Short description */
  readonly description: string;
  /** Lucide icon name */
  readonly icon: string;

  /** Initialize the effect with canvas dimensions */
  init(width: number, height: number): void;

  /**
   * Render one frame.
   * @param ctx Canvas 2D context
   * @param frame Current audio data frame
   * @param theme Current color theme
   * @param config Current effect configuration
   * @param transitionProgress Transition progress (-1 = no transition, 0→1 = transitioning)
   */
  render(
    ctx: CanvasRenderingContext2D,
    frame: AudioDataFrame,
    theme: EffectTheme,
    config: EffectConfig,
    transitionProgress: number,
  ): void;

  /** Handle canvas resize */
  resize(width: number, height: number): void;

  /** Destroy the effect and release resources */
  destroy(): void;
}

/** All available visualization mode IDs */
export type VisualizationMode = 'bars' | 'wave' | 'circular' | 'particles' | 'cube3d';
