/**
 * Visualizer state management (Zustand store).
 * Manages visualization mode, theme, config, fullscreen, screenshot, recording, and AI interface.
 */

import { create } from 'zustand';
import type { VisualizationMode, EffectConfig } from '../components/music/effects/types';
import { DEFAULT_EFFECT_CONFIG } from '../components/music/effects/types';
import type { VisualizerTheme, AiMoodSuggestion } from '../components/music/themes/types';
import { DEFAULT_THEME_ID, getTheme } from '../components/music/themes';

export interface VisualizerState {
  // --- Current state ---
  currentMode: VisualizationMode;
  currentThemeId: string;
  config: EffectConfig;
  isFullscreen: boolean;
  isRecording: boolean;

  // --- AI interface ---
  aiSuggestion: AiMoodSuggestion | null;

  // --- Actions ---
  setMode: (mode: VisualizationMode) => void;
  setTheme: (themeId: string) => void;
  updateConfig: (partial: Partial<EffectConfig>) => void;
  resetConfig: () => void;

  // Fullscreen
  setFullscreen: (v: boolean) => void;
  toggleFullscreen: () => void;

  // Recording
  setRecording: (v: boolean) => void;

  // AI
  setAiSuggestion: (suggestion: AiMoodSuggestion | null) => void;
  applyAiSuggestion: () => void;

  // Helpers
  getCurrentTheme: () => VisualizerTheme;
}

export const useVisualizerStore = create<VisualizerState>((set, get) => ({
  // --- State ---
  currentMode: 'bars',
  currentThemeId: DEFAULT_THEME_ID,
  config: { ...DEFAULT_EFFECT_CONFIG },
  isFullscreen: false,
  isRecording: false,
  aiSuggestion: null,

  // --- Actions ---
  setMode: (mode) => set({ currentMode: mode }),

  setTheme: (themeId) => {
    const theme = getTheme(themeId);
    if (theme) {
      set({
        currentThemeId: themeId,
        config: { ...get().config, ...theme.defaultConfig },
      });
    }
  },

  updateConfig: (partial) =>
    set((state) => ({ config: { ...state.config, ...partial } })),

  resetConfig: () => {
    const theme = get().getCurrentTheme();
    set({ config: { ...DEFAULT_EFFECT_CONFIG, ...theme.defaultConfig } });
  },

  setFullscreen: (v) => set({ isFullscreen: v }),

  toggleFullscreen: () => {
    const isFullscreen = get().isFullscreen;
    if (!isFullscreen) {
      // Open fullscreen window via IPC
      try {
        window.electronAPI?.window?.openVisualizerFullscreen?.();
        set({ isFullscreen: true });
      } catch {
        console.warn('[VisualizerStore] Failed to open fullscreen visualizer');
      }
    } else {
      // Close fullscreen window via IPC
      try {
        window.electronAPI?.window?.closeVisualizerFullscreen?.();
        set({ isFullscreen: false });
      } catch {
        console.warn('[VisualizerStore] Failed to close fullscreen visualizer');
      }
    }
  },

  setRecording: (v) => set({ isRecording: v }),

  setAiSuggestion: (suggestion) => set({ aiSuggestion: suggestion }),

  applyAiSuggestion: () => {
    const suggestion = get().aiSuggestion;
    if (suggestion && suggestion.confidence > 0.5) {
      get().setTheme(suggestion.suggestedThemeId);
    }
  },

  getCurrentTheme: () => {
    const themeId = get().currentThemeId;
    return getTheme(themeId) || getTheme(DEFAULT_THEME_ID)!;
  },
}));
