import { useCallback, useEffect, useState, useRef } from 'react';
import { useUIStore } from '../stores/uiStore';
import { useSettingsStore } from '../stores/settingsStore';
import type { AppSettings, CustomThemeConfig } from '@shared/types';
import { DEFAULT_SETTINGS, DEFAULT_CUSTOM_THEME } from '@shared/constants';

// 应用自定义主题到 DOM
export function applyCustomThemeToDOM(config: CustomThemeConfig) {
  const root = document.documentElement;
  root.style.setProperty('--primary-color', config.primaryColor);
  root.style.setProperty('--primary-hover', config.primaryHover);
  root.style.setProperty('--primary-light', config.primaryLight);
  root.style.setProperty('--primary-bg', config.primaryBg);
  root.style.setProperty('--bg-primary', config.bgPrimary);
  root.style.setProperty('--bg-secondary', config.bgSecondary);
  root.style.setProperty('--bg-tertiary', config.bgTertiary);
  root.style.setProperty('--text-primary', config.textPrimary);
  root.style.setProperty('--text-secondary', config.textSecondary);
  root.style.setProperty('--text-tertiary', config.textTertiary);
  root.style.setProperty('--border-color', config.borderColor);
  root.style.setProperty('--border-light', config.borderLight);
  root.style.setProperty('--success-color', config.successColor);
  root.style.setProperty('--success-light', config.successColor + '88');
  root.style.setProperty('--warning-color', config.warningColor);
  root.style.setProperty('--warning-light', config.warningColor + '88');
  root.style.setProperty('--error-color', config.errorColor);
  root.style.setProperty('--info-color', config.infoColor);

  const shadowBase = config.primaryColor.replace('#', '');
  const r = parseInt(shadowBase.substring(0, 2), 16);
  const g = parseInt(shadowBase.substring(2, 4), 16);
  const b = parseInt(shadowBase.substring(4, 6), 16);
  root.style.setProperty('--primary-bg-rgb', `${r}, ${g}, ${b}`);
}

export function applyFontSettingsToDOM(settings: Partial<AppSettings>) {
  const root = document.documentElement;
  if (settings.fontFamily) {
    root.style.setProperty('--font-family', settings.fontFamily);
    root.style.setProperty('--font-body', settings.fontFamily);
  }
  if (settings.titleFontFamily) {
    root.style.setProperty('--font-title', settings.titleFontFamily);
  }
  if (settings.h1FontFamily) {
    root.style.setProperty('--font-h1', settings.h1FontFamily);
  }
  if (settings.h2FontFamily) {
    root.style.setProperty('--font-h2', settings.h2FontFamily);
  }
  if (settings.h3FontFamily) {
    root.style.setProperty('--font-h3', settings.h3FontFamily);
  }
  if (settings.titleHighlightFontFamily) {
    root.style.setProperty('--font-title-highlight', settings.titleHighlightFontFamily);
  }
  if (settings.specialFontFamily) {
    root.style.setProperty('--font-special', settings.specialFontFamily);
  }
  if (settings.englishFontFamily) {
    root.style.setProperty('--font-english', settings.englishFontFamily);
  }
  if (settings.boardTitleFontFamily) {
    root.style.setProperty('--font-board-title', settings.boardTitleFontFamily);
  }
  if (settings.boardBodyFontFamily) {
    root.style.setProperty('--font-board-body', settings.boardBodyFontFamily);
  }
  if (settings.boardSpecialFontFamily) {
    root.style.setProperty('--font-board-special', settings.boardSpecialFontFamily);
  }
  if (settings.extensionFontFamily) {
    root.style.setProperty('--font-extension', settings.extensionFontFamily);
  }
  if (settings.fontSize) {
    root.style.setProperty('--font-size-base', `${settings.fontSize}px`);
  }
  if (settings.fontLineHeight) {
    root.style.setProperty('--line-height', String(settings.fontLineHeight));
  }
}

// 解析自定义主题配置
function parseCustomTheme(customThemeJson: string | null): CustomThemeConfig {
  if (!customThemeJson) return DEFAULT_CUSTOM_THEME;
  try {
    return { ...DEFAULT_CUSTOM_THEME, ...JSON.parse(customThemeJson) };
  } catch {
    return DEFAULT_CUSTOM_THEME;
  }
}

export function useTheme() {
  const theme = useUIStore((s) => s.theme);
  const setUITheme = useUIStore((s) => s.setTheme);
  const [isTransitioning, setIsTransitioning] = useState(false);
  const [transitionDirection, setTransitionDirection] = useState<'to-dark' | 'to-light' | null>(null);
  const [transitionPhase, setTransitionPhase] = useState<'sweep' | 'settle' | null>(null);
  const [transitionColor, setTransitionColor] = useState<string>('#6C63FF');
  const timerRef = useRef<ReturnType<typeof setTimeout>[]>([]);

  const THEME_PRIMARY_COLORS: Record<string, string> = {
    light: '#6C63FF',
    dark: '#8B85FF',
    'morandi-warm': '#C4A882',
    'morandi-cool': '#8FA4B2',
    'morandi-nature': '#8FA882',
    'ocean-blue': '#00a5d8',
    'lemon-lavender': '#7a7aff',
    'lime-fresh': '#0ed6e0',
    'peach-blossom': '#ff8a80',
  };

  const clearTimers = useCallback(() => {
    timerRef.current.forEach(t => clearTimeout(t));
    timerRef.current = [];
  }, []);

  const applyTheme = useCallback(
    (newTheme: AppSettings['theme'], customConfig?: CustomThemeConfig) => {
      timerRef.current.forEach(t => clearTimeout(t));
      timerRef.current = [];
      const isGoingDark = newTheme === 'dark' || (newTheme !== 'light' && theme === 'light');

      setUITheme(newTheme);
      useSettingsStore.getState().saveSetting('theme', newTheme);
      
      document.documentElement.removeAttribute('style');
      
      if (newTheme === 'custom') {
        const config = customConfig || parseCustomTheme(useSettingsStore.getState().settings?.customTheme);
        applyCustomThemeToDOM(config);
        document.documentElement.setAttribute('data-theme', 'custom');
        setTransitionColor(config.primaryColor);
      } else {
        document.documentElement.setAttribute('data-theme', newTheme);
        setTransitionColor(THEME_PRIMARY_COLORS[newTheme] || '#6C63FF');
      }

      applyFontSettingsToDOM(useSettingsStore.getState().settings);

      setIsTransitioning(true);
      setTransitionDirection(isGoingDark ? 'to-dark' : 'to-light');
      setTransitionPhase('sweep');

      const t1 = setTimeout(() => {
        setTransitionPhase('settle');

        const t2 = setTimeout(() => {
          setIsTransitioning(false);
          setTransitionDirection(null);
          setTransitionPhase(null);
        }, 300);
        timerRef.current.push(t2);
      }, 400);
      timerRef.current.push(t1);
    },
    [setUITheme, theme]
  );

  const toggleTheme = useCallback(() => {
    const newTheme: AppSettings['theme'] = theme === 'dark' ? 'light' : 'dark';
    applyTheme(newTheme);
  }, [theme, applyTheme]);

  // 初始化时应用自定义主题
  useEffect(() => {
    if (theme === 'custom') {
      const customTheme = useSettingsStore.getState().settings?.customTheme;
      const config = parseCustomTheme(customTheme);
      applyCustomThemeToDOM(config);
      document.documentElement.setAttribute('data-theme', 'custom');
    }
  }, []);

  useEffect(() => {
    if (theme !== 'custom') {
      document.documentElement.removeAttribute('style');
      applyFontSettingsToDOM(useSettingsStore.getState().settings);
      document.documentElement.setAttribute('data-theme', theme);
    }
  }, [theme]);

  useEffect(() => {
    const unsubscribe = useSettingsStore.subscribe((state) => {
      if (state.settings?.theme && state.settings.theme !== theme) {
        setUITheme(state.settings.theme);
        if (state.settings.theme === 'custom') {
          const config = parseCustomTheme(state.settings.customTheme);
          applyCustomThemeToDOM(config);
        } else {
          document.documentElement.removeAttribute('style');
        }
        applyFontSettingsToDOM(state.settings);
        document.documentElement.setAttribute('data-theme', state.settings.theme);
      }
    });
    return unsubscribe;
  }, [setUITheme, theme]);

  useEffect(() => {
    const savedTheme = useSettingsStore.getState().settings?.theme;
    if (savedTheme && savedTheme !== theme) {
      setUITheme(savedTheme);
      if (savedTheme === 'custom') {
        const config = parseCustomTheme(useSettingsStore.getState().settings?.customTheme);
        applyCustomThemeToDOM(config);
      }
      applyFontSettingsToDOM(useSettingsStore.getState().settings);
      document.documentElement.setAttribute('data-theme', savedTheme);
    }
  }, [setUITheme, theme]);

  useEffect(() => {
    return () => clearTimers();
  }, [clearTimers]);

  return {
    theme,
    setTheme: applyTheme,
    toggleTheme,
    isDark: theme === 'dark',
    isTransitioning,
    transitionDirection,
    transitionPhase,
    transitionColor,
    parseCustomTheme,
    applyCustomThemeToDOM,
  };
}

export function useThemeOptions() {
  const themes: { value: AppSettings['theme']; label: string }[] = [
    { value: 'light', label: '经典白' },
    { value: 'dark', label: '经典黑' },
    { value: 'morandi-warm', label: '莫兰迪暖调' },
    { value: 'morandi-cool', label: '莫兰迪冷调' },
    { value: 'morandi-nature', label: '莫兰迪自然' },
    { value: 'ocean-blue', label: '🫧 海洋蓝' },
    { value: 'lemon-lavender', label: '🍋 柠檬紫' },
    { value: 'lime-fresh', label: '🍃 青柠绿' },
    { value: 'peach-blossom', label: '🍑 蜜桃粉' },
    { value: 'custom', label: '自定义' },
  ];
  return themes;
}
