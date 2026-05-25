/**
 * Preset visualizer themes.
 * 8 built-in themes + custom theme support.
 */

import type { VisualizerTheme, AiMoodSuggestion } from './types';

/** Aurora theme - purple-green gradient, dark background */
export const auroraTheme: VisualizerTheme = {
  id: 'aurora',
  name: '极光',
  description: '紫绿渐变，深邃夜空',
  isDark: true,
  colors: {
    primary: '#8B5CF6',
    secondary: '#A78BFA',
    accent: '#34D399',
    background: '#0F0B1E',
    glowColor: '#8B5CF6',
  },
  defaultOpacity: 1,
  defaultConfig: { glow: true, glowIntensity: 0.7 },
};

/** Flame theme - red-orange gradient */
export const flameTheme: VisualizerTheme = {
  id: 'flame',
  name: '烈焰',
  description: '红橙渐变，热情似火',
  isDark: true,
  colors: {
    primary: '#EF4444',
    secondary: '#F97316',
    accent: '#FBBF24',
    background: '#1A0A0A',
    glowColor: '#EF4444',
  },
  defaultOpacity: 1,
  defaultConfig: { glow: true, glowIntensity: 0.8, sensitivity: 1.2 },
};

/** Ocean theme - blue-cyan gradient */
export const oceanTheme: VisualizerTheme = {
  id: 'ocean',
  name: '海洋',
  description: '蓝青渐变，深海宁静',
  isDark: true,
  colors: {
    primary: '#3B82F6',
    secondary: '#06B6D4',
    accent: '#22D3EE',
    background: '#0A0F1E',
    glowColor: '#3B82F6',
  },
  defaultOpacity: 1,
  defaultConfig: { glow: true, glowIntensity: 0.6, speed: 0.8 },
};

/** Forest theme - green tones */
export const forestTheme: VisualizerTheme = {
  id: 'forest',
  name: '森林',
  description: '翠绿自然，清新宁静',
  isDark: true,
  colors: {
    primary: '#22C55E',
    secondary: '#4ADE80',
    accent: '#86EFAC',
    background: '#0A1A0A',
    glowColor: '#22C55E',
  },
  defaultOpacity: 1,
  defaultConfig: { glow: true, glowIntensity: 0.5, speed: 0.7 },
};

/** Sunset theme - orange-pink-purple gradient */
export const sunsetTheme: VisualizerTheme = {
  id: 'sunset',
  name: '日落',
  description: '橙粉紫渐变，温暖浪漫',
  isDark: true,
  colors: {
    primary: '#F97316',
    secondary: '#EC4899',
    accent: '#A855F7',
    background: '#1A0A1A',
    glowColor: '#EC4899',
  },
  defaultOpacity: 1,
  defaultConfig: { glow: true, glowIntensity: 0.7 },
};

/** Neon theme - cyan-pink contrast */
export const neonTheme: VisualizerTheme = {
  id: 'neon',
  name: '霓虹',
  description: '青粉对比色，赛博朋克',
  isDark: true,
  colors: {
    primary: '#06B6D4',
    secondary: '#EC4899',
    accent: '#FBBF24',
    background: '#0A0A1A',
    glowColor: '#06B6D4',
  },
  defaultOpacity: 1,
  defaultConfig: { glow: true, glowIntensity: 0.9, sensitivity: 1.1 },
};

/** Minimal theme - white/light, clean look */
export const minimalTheme: VisualizerTheme = {
  id: 'minimal',
  name: '极简',
  description: '白色系，简洁优雅',
  isDark: false,
  colors: {
    primary: '#6B7280',
    secondary: '#9CA3AF',
    accent: '#374151',
    background: '#F9FAFB',
    glowColor: '#6B7280',
  },
  defaultOpacity: 0.8,
  defaultConfig: { glow: false, sensitivity: 0.8 },
};

/** Custom theme - uses CSS variables from the app theme */
export const customTheme: VisualizerTheme = {
  id: 'custom',
  name: '自定义',
  description: '跟随应用主题颜色',
  isDark: true,
  colors: {
    primary: 'var(--primary-color, #8B5CF6)',
    secondary: 'var(--primary-light, #A78BFA)',
    accent: 'var(--accent-color, #34D399)',
    background: 'var(--bg-primary, #0F0B1E)',
    glowColor: 'var(--primary-color, #8B5CF6)',
  },
  defaultOpacity: 1,
  defaultConfig: { glow: true, glowIntensity: 0.7 },
};

/** All preset themes */
export const presetThemes: VisualizerTheme[] = [
  auroraTheme,
  flameTheme,
  oceanTheme,
  forestTheme,
  sunsetTheme,
  neonTheme,
  minimalTheme,
  customTheme,
];

/** Theme registry map */
export const themeRegistry: Map<string, VisualizerTheme> = new Map(
  presetThemes.map((t) => [t.id, t]),
);

/** Get a theme by ID */
export function getTheme(id: string): VisualizerTheme | undefined {
  return themeRegistry.get(id);
}

/** Default theme ID */
export const DEFAULT_THEME_ID = 'aurora';

/** AI mood to theme mapping */
export const moodToThemeMap: Record<string, string> = {
  energetic: 'flame',
  passionate: 'flame',
  intense: 'neon',
  calm: 'ocean',
  peaceful: 'forest',
  relaxed: 'forest',
  melancholic: 'ocean',
  sad: 'ocean',
  happy: 'sunset',
  joyful: 'sunset',
  romantic: 'sunset',
  mysterious: 'aurora',
  dark: 'aurora',
  futuristic: 'neon',
  cyber: 'neon',
  natural: 'forest',
  clean: 'minimal',
  elegant: 'minimal',
};

/** Get suggested theme ID based on AI mood */
export function getThemeForMood(mood: string): string {
  return moodToThemeMap[mood.toLowerCase()] || DEFAULT_THEME_ID;
}

/** Create an AI mood suggestion */
export function createMoodSuggestion(mood: string, confidence: number): AiMoodSuggestion {
  const suggestedThemeId = getThemeForMood(mood);
  return { mood, confidence, suggestedThemeId };
}
