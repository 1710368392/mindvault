import { create } from 'zustand';
import { api } from '../utils/api';
import type { AppSettings } from '../../shared/types';

interface SettingsState {
  settings: AppSettings;
  isLoading: boolean;

  loadSettings: () => Promise<void>;
  saveSetting: (key: string, value: any) => Promise<void>;
  saveSettings: (settings: Partial<AppSettings>) => Promise<void>;
  resetSettings: () => Promise<void>;
}

const DEFAULT_SETTINGS: AppSettings = {
  theme: 'light',
  customTheme: null,
  language: 'zh-CN',
  fontSize: 14,
  fontFamily: "'Microsoft YaHei', 'PingFang SC', sans-serif",
  fontLineHeight: 1.6,
  h1FontFamily: "SimHei, 'Microsoft YaHei', sans-serif",
  h2FontFamily: "'MindVault-Extend-Heiti', 'PingFang SC', 'Microsoft YaHei', sans-serif",
  h3FontFamily: "'MindVault-Body', 'PingFang SC', 'Microsoft YaHei', 'Hiragino Sans GB', sans-serif",
  titleHighlightFontFamily: "'MindVault-Title', 'PingFang SC', 'Microsoft YaHei', sans-serif",
  titleFontFamily: "'MindVault-Title', 'PingFang SC', 'Microsoft YaHei', sans-serif",
  specialFontFamily: "'MindVault-Extend-Songti', serif",
  englishFontFamily: "'MindVault-English', sans-serif",
  boardTitleFontFamily: "'PingFang SC', 'Microsoft YaHei', sans-serif",
  boardBodyFontFamily: "'MindVault-Body', 'PingFang SC', 'Microsoft YaHei', 'Hiragino Sans GB', sans-serif",
  boardSpecialFontFamily: "'MindVault-Special', serif",
  extensionFontFamily: "'MindVault-Extend-Kaiti', serif",
  customFonts: '[]',
  soundEnabled: true,
  soundVolume: 0.5,
  keyPressSoundEnabled: true,
  autoBackup: true,
  autoBackupInterval: 30,
  privacyLock: false,
  privacyPassword: null,
  privacyLockOnStartup: true,
  privacyLockOnMinimize: false,
  privacyAutoLockMinutes: null,
  privacyMaxAttempts: 5,
  privacyLockoutMinutes: 30,
  privacyShowHint: false,
  privacyHint: null,
  customCursor: false,
  canvasImportThreshold: 5,
  canvasImportOverThresholdAction: 'prompt',
  nickname: '用户',
  avatar: null,
  signature: '',
  exportIncludedFields: ['title', 'content', 'tags', 'timestamps'],

  // AI 设置
  aiEnabled: false,
  aiDefaultProvider: 'openai',
  aiDefaultModel: 'gpt-4o-mini',
  aiOpenaiApiKey: '',
  aiOpenaiBaseUrl: 'https://api.openai.com/v1',
  aiOpenaiModel: 'gpt-5.5',
  aiAnthropicApiKey: '',
  aiAnthropicModel: 'claude-sonnet-4-6',
  aiDeepseekApiKey: '',
  aiDeepseekModel: 'deepseek-v4-flash',
  aiCustomApiKey: '',
  aiCustomBaseUrl: '',
  aiCustomModel: '',
  aiCustomProviderName: '自定义',

  // 在线音乐设置 (QQ音乐)
  qqMusicCookie: '',
  // 在线音乐设置 (网易云)
  neteaseCookie: '',

  // TTS 朗读设置
  ttsVoice: 'zh-CN-XiaoxiaoNeural',
  ttsRate: 0,
  ttsPitch: 0,
  ttsVolume: 100,

  // 音频设备设置
  audioInputDeviceId: null,
  audioOutputDeviceId: null,
};

export const useSettingsStore = create<SettingsState>((set, get) => ({
  settings: { ...DEFAULT_SETTINGS },
  isLoading: false,

  loadSettings: async () => {
    set({ isLoading: true });
    try {
      const keys = Object.keys(DEFAULT_SETTINGS);
      const newSettings: Partial<AppSettings> = {};
      for (const key of keys) {
        const val = await api.settings.get(key);
        newSettings[key as keyof AppSettings] = val !== null && val !== undefined ? val : DEFAULT_SETTINGS[key as keyof AppSettings];
      }
      set({ settings: { ...DEFAULT_SETTINGS, ...newSettings } });
    } catch (error) {
      console.error('加载设置失败:', error);
    } finally {
      set({ isLoading: false });
    }
  },

  saveSetting: async (key, value) => {
    try {
      await api.settings.set(key, value);
      set((state) => ({ settings: { ...state.settings, [key]: value } }));
    } catch (error) {
      console.error('保存设置失败:', error);
    }
  },

  saveSettings: async (partial) => {
    try {
      for (const [key, value] of Object.entries(partial)) {
        await api.settings.set(key, value);
      }
      set((state) => ({ settings: { ...state.settings, ...partial } }));
    } catch (error) {
      console.error('批量保存设置失败:', error);
    }
  },

  resetSettings: async () => {
    try {
      for (const [key, value] of Object.entries(DEFAULT_SETTINGS)) {
        await api.settings.set(key, value);
      }
      set({ settings: { ...DEFAULT_SETTINGS } });
    } catch (error) {
      console.error('重置设置失败:', error);
    }
  },
}));

export { DEFAULT_SETTINGS };
