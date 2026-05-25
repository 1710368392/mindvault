// 设置相关类型
import type { AppSettings } from '@shared/types';

export type SettingsFormData = Omit<AppSettings, 'privacyPassword'> & {
  privacyPassword?: string | null;
  privacyPasswordConfirm?: string | null;
};

export type ThemeOption = {
  value: AppSettings['theme'];
  label: string;
  preview?: string;
};

export type FontSettings = {
  fontSize: number;
  fontFamily: string;
  fontLineHeight: number;
  titleFontFamily: string;
};

export type SoundSettings = {
  soundEnabled: boolean;
  soundVolume: number;
};

export type BackupSettings = {
  autoBackup: boolean;
  autoBackupInterval: number;
};

export type PrivacySettings = {
  privacyLock: boolean;
  privacyPassword: string | null;
  privacyLockOnStartup: boolean;
  privacyLockOnMinimize: boolean;
  privacyAutoLockMinutes: number | null;
  privacyMaxAttempts: number;
  privacyLockoutMinutes: number;
  privacyShowHint: boolean;
  privacyHint: string | null;
};

export type ExportSettings = {
  exportIncludedFields: string[];
};
