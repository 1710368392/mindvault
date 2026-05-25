/**
 * Visualizer theme system types.
 */

import type { EffectConfig } from '../effects/types';

/** Visualizer color theme */
export interface VisualizerTheme {
  /** Unique theme identifier */
  readonly id: string;
  /** Display name */
  readonly name: string;
  /** Short description */
  readonly description: string;
  /** Whether this is a dark theme */
  readonly isDark: boolean;
  /** Theme colors */
  readonly colors: {
    primary: string;
    secondary: string;
    accent: string;
    background: string;
    glowColor: string;
  };
  /** Default opacity for this theme */
  readonly defaultOpacity: number;
  /** Default effect config overrides for this theme */
  readonly defaultConfig: Partial<EffectConfig>;
}

/** AI mood/style suggestion for theme mapping */
export interface AiMoodSuggestion {
  /** Detected mood (e.g. "energetic", "calm", "melancholic", "happy") */
  mood: string;
  /** Confidence score (0-1) */
  confidence: number;
  /** Suggested theme ID */
  suggestedThemeId: string;
  /** Optional: custom color overrides based on AI analysis */
  colorOverrides?: Partial<VisualizerTheme['colors']>;
}
