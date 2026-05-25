import type { AppSettings, CustomThemeConfig } from './types';
export { IPC_CHANNELS } from './ipc-channels';
export type { IpcChannel } from './ipc-channels';

// 应用基本信息
export const APP_NAME = '脑洞集';
export const APP_VERSION = '1.0.0';
export const APP_DESCRIPTION = '创意记录与整理桌面软件';

// 预设主题配置
export const PRESET_THEMES: Record<string, CustomThemeConfig> = {
  'sakura': {
    primaryColor: '#F28482',
    primaryHover: '#E66363',
    primaryLight: '#F5AFAF',
    primaryBg: 'rgba(242, 132, 130, 0.12)',
    bgPrimary: '#FFF5F5',
    bgSecondary: '#FFFFFF',
    bgTertiary: '#FDECEC',
    textPrimary: '#4A3030',
    textSecondary: '#8A5F5F',
    textTertiary: '#B88C8C',
    borderColor: '#F2D8D8',
    borderLight: '#F9ECEC',
    successColor: '#10B981',
    warningColor: '#F59E0B',
    errorColor: '#EF4444',
    infoColor: '#3B82F6',
  },
  'mint': {
    primaryColor: '#34D399',
    primaryHover: '#10B981',
    primaryLight: '#6EE7B7',
    primaryBg: 'rgba(52, 211, 153, 0.12)',
    bgPrimary: '#F0FDF7',
    bgSecondary: '#FFFFFF',
    bgTertiary: '#D1FAE5',
    textPrimary: '#064E3B',
    textSecondary: '#059669',
    textTertiary: '#34D399',
    borderColor: '#A7F3D0',
    borderLight: '#D1FAE5',
    successColor: '#10B981',
    warningColor: '#F59E0B',
    errorColor: '#EF4444',
    infoColor: '#3B82F6',
  },
  'sky': {
    primaryColor: '#60A5FA',
    primaryHover: '#3B82F6',
    primaryLight: '#93C5FD',
    primaryBg: 'rgba(96, 165, 250, 0.12)',
    bgPrimary: '#EFF6FF',
    bgSecondary: '#FFFFFF',
    bgTertiary: '#DBEAFE',
    textPrimary: '#1E3A8A',
    textSecondary: '#3B82F6',
    textTertiary: '#60A5FA',
    borderColor: '#BFDBFE',
    borderLight: '#DBEAFE',
    successColor: '#10B981',
    warningColor: '#F59E0B',
    errorColor: '#EF4444',
    infoColor: '#3B82F6',
  },
  'coffee': {
    primaryColor: '#A78B7B',
    primaryHover: '#8B6D5D',
    primaryLight: '#C4A999',
    primaryBg: 'rgba(167, 139, 123, 0.12)',
    bgPrimary: '#F5F0EB',
    bgSecondary: '#FFFFFF',
    bgTertiary: '#E9DFD4',
    textPrimary: '#4A3B2F',
    textSecondary: '#7D6353',
    textTertiary: '#A78B7B',
    borderColor: '#D9CCC2',
    borderLight: '#E9DFD4',
    successColor: '#10B981',
    warningColor: '#F59E0B',
    errorColor: '#EF4444',
    infoColor: '#3B82F6',
  },
  'deep-purple': {
    primaryColor: '#A78BFA',
    primaryHover: '#8B5CF6',
    primaryLight: '#C4B5FD',
    primaryBg: 'rgba(167, 139, 250, 0.12)',
    bgPrimary: '#F5F3FF',
    bgSecondary: '#FFFFFF',
    bgTertiary: '#EDE9FE',
    textPrimary: '#4C1D95',
    textSecondary: '#7C3AED',
    textTertiary: '#A78BFA',
    borderColor: '#DDD6FE',
    borderLight: '#EDE9FE',
    successColor: '#10B981',
    warningColor: '#F59E0B',
    errorColor: '#EF4444',
    infoColor: '#3B82F6',
  },
};

// 默认自定义主题（基于经典白）
export const DEFAULT_CUSTOM_THEME: CustomThemeConfig = {
  primaryColor: '#6C63FF',
  primaryHover: '#5A52E0',
  primaryLight: '#8B85FF',
  primaryBg: 'rgba(108, 99, 255, 0.08)',
  bgPrimary: '#f8f9fa',
  bgSecondary: '#ffffff',
  bgTertiary: '#f0f1f3',
  textPrimary: '#1a1a2e',
  textSecondary: '#6b7280',
  textTertiary: '#9ca3af',
  borderColor: '#e5e7eb',
  borderLight: '#f3f4f6',
  successColor: '#10B981',
  warningColor: '#F59E0B',
  errorColor: '#EF4444',
  infoColor: '#3B82F6',
};

// 默认设置
export const DEFAULT_SETTINGS: AppSettings = {
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
  customCursor: false,
  canvasImportThreshold: 5,
  canvasImportOverThresholdAction: 'prompt',
  nickname: '用户',
  avatar: null,
  signature: '',
};

// 创意类型列表
export const CREATIVITY_TYPES = [
  { value: 'text', label: '文本', icon: 'Type' },
  { value: 'image', label: '图片', icon: 'Image' },
  { value: 'audio', label: '音频', icon: 'Mic' },
  { value: 'link', label: '链接', icon: 'Link' },
  { value: 'video', label: '视频', icon: 'Video' },
  { value: 'document', label: '文档', icon: 'FileText' },
] as const;

// 优先级选项
export const PRIORITY_OPTIONS = [
  { value: 0, label: '无优先级', stars: 0 },
  { value: 1, label: '低', stars: 1 },
  { value: 2, label: '较低', stars: 2 },
  { value: 3, label: '中等', stars: 3 },
  { value: 4, label: '较高', stars: 4 },
  { value: 5, label: '最高', stars: 5 },
] as const;

// Emoji 反应列表
export const EMOJI_REACTIONS = [
  'angry', 'beer', 'coffee', 'cry', 'devil', 'grin',
  'happy', 'laugh', 'saint', 'shoot', 'sleep', 'sunglasses',
  'surprised', 'thumbsup', 'tongue', 'unhappy', 'wink', 'wink2',
] as const;

export const EMOJI_SVG_MAP: Record<string, string> = {
  angry: '/images/emoji/FontelicoEmoAngry.svg',
  beer: '/images/emoji/FontelicoEmoBeer.svg',
  coffee: '/images/emoji/FontelicoEmoCoffee.svg',
  cry: '/images/emoji/FontelicoEmoCry.svg',
  devil: '/images/emoji/FontelicoEmoDevil.svg',
  grin: '/images/emoji/FontelicoEmoGrin.svg',
  happy: '/images/emoji/FontelicoEmoHappy.svg',
  laugh: '/images/emoji/FontelicoEmoLaugh.svg',
  saint: '/images/emoji/FontelicoEmoSaint.svg',
  shoot: '/images/emoji/FontelicoEmoShoot.svg',
  sleep: '/images/emoji/FontelicoEmoSleep.svg',
  sunglasses: '/images/emoji/FontelicoEmoSunglasses.svg',
  surprised: '/images/emoji/FontelicoEmoSurprised.svg',
  thumbsup: '/images/emoji/FontelicoEmoThumbsup.svg',
  tongue: '/images/emoji/FontelicoEmoTongue.svg',
  unhappy: '/images/emoji/FontelicoEmoUnhappy.svg',
  wink: '/images/emoji/FontelicoEmoWink.svg',
  wink2: '/images/emoji/FontelicoEmoWink2.svg',
};

// 看板布局类型
export const BOARD_LAYOUTS = [
  { value: 'board', label: '看板视图', icon: 'LayoutGrid' },
  { value: 'canvas', label: '画布视图', icon: 'LayoutDashboard' },
  { value: 'graph', label: '思维导图视图', icon: 'Network' },
  { value: 'folder', label: '文件夹视图', icon: 'FolderOpen' },
] as const;

// 创意状态
export const CREATIVITY_STATUSES = [
  { value: 'active', label: '活跃' },
  { value: 'archived', label: '已归档' },
  { value: 'trashed', label: '已删除' },
] as const;

// 主题列表
export const THEME_OPTIONS = [
  { value: 'light', label: '经典白' },
  { value: 'dark', label: '经典黑' },
  { value: 'morandi-warm', label: '莫兰迪暖调' },
  { value: 'morandi-cool', label: '莫兰迪冷调' },
  { value: 'morandi-nature', label: '莫兰迪自然' },
  { value: 'custom', label: '自定义' },
] as const;

// 分页默认值
export const DEFAULT_PAGE_SIZE = 20;

// 关联类型
export const LINK_RELATION_TYPES = [
  { value: 'related', label: '关联' },
  { value: 'derived', label: '派生' },
  { value: 'combined', label: '组合' },
] as const;

// 便利贴颜色
export const STICKY_COLORS = [
  { name: '柠檬黄', value: '#FFF9C4', shadow: '#F9E44C' },
  { name: '薄荷绿', value: '#C8E6C9', shadow: '#66BB6A' },
  { name: '天空蓝', value: '#BBDEFB', shadow: '#42A5F5' },
  { name: '樱花粉', value: '#F8BBD0', shadow: '#EC407A' },
  { name: '熏衣草紫', value: '#E1BEE7', shadow: '#AB47BC' },
  { name: '蜜桃橙', value: '#FFCCBC', shadow: '#FF7043' },
  { name: '经典白', value: '#FFFFFF', shadow: '#E0E0E0' },
  { name: '浅灰', value: '#D7CCC8', shadow: '#A1887F' },
] as const;

// 莫兰迪色系
export const MORANDI_COLORS = {
  warm: {
    primary: '#C4A882',
    secondary: '#D4B896',
    accent: '#B8956A',
    bg: '#F5EDE4',
    surface: '#EDE3D8',
    text: '#5D4E37',
    textSecondary: '#8B7D6B',
    border: '#D9CFC4',
  },
  cool: {
    primary: '#8FA4B2',
    secondary: '#A3B5C1',
    accent: '#6E8A9A',
    bg: '#E8EEF2',
    surface: '#DEE6EB',
    text: '#3D5A6E',
    textSecondary: '#6B8494',
    border: '#C8D4DB',
  },
  nature: {
    primary: '#8FA882',
    secondary: '#A3B896',
    accent: '#6E8A5A',
    bg: '#EDF2E8',
    surface: '#E3EBDE',
    text: '#4A5D3D',
    textSecondary: '#6B8460',
    border: '#C8D4C2',
  },
} as const;
