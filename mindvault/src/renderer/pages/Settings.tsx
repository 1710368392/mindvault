import React, { useState, useEffect, useRef, useCallback, useMemo } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  Settings as SettingsIcon,
  RotateCcw,
  Check,
  Sun,
  Moon,
  Eye,
  Play,
  Download,
  Upload,
  Clock,
  RefreshCw,
  AlertTriangle,
  Type,
  Plus,
  Pin,
  PinOff,
  GripHorizontal,
  FileJson,
  FileText,
  Globe,
  Music,
  X,
  Cloud,
  Wifi,
} from 'lucide-react';
import { Progress, Modal, Alert, Popconfirm, Tooltip, Descriptions, Select, InputNumber, Input, Form, ColorPicker, Switch, Checkbox, Anchor, Button, App as AntdApp } from 'antd';

import { motion } from 'framer-motion';
import { useSettingsStore, DEFAULT_SETTINGS } from '../stores/settingsStore';
import { useUIStore } from '../stores/uiStore';
import { useCreativityStore } from '../stores/creativityStore';
import { useTheme, useThemeOptions, applyCustomThemeToDOM } from '../hooks/useTheme';
import { useAuth } from '../hooks/useAuth';
import { THEME_OPTIONS, DEFAULT_CUSTOM_THEME, PRESET_THEMES } from '@shared/constants';
import { playSound, playKeyPressSound } from '../utils/sound';
import { api } from '../utils/api';
import { exportToJson, exportToMarkdown, exportToHtml } from '../utils/exporters';
import { getWeatherPrivacy, saveWeatherPrivacy } from '../utils/weather';
import * as fontRegistry from '../utils/fontRegistry';
import type { AppSettings, CustomThemeConfig } from '@shared/types';
import { AISettings } from '../components/settings/AISettings';

const DEFAULT_THEME: AppSettings['theme'] = 'light';

async function hashPassword(password: string): Promise<string> {
  const encoder = new TextEncoder();
  const data = encoder.encode(password + 'mindvault-salt-2024');
  const hashBuffer = await crypto.subtle.digest('SHA-256', data);
  const hashArray = Array.from(new Uint8Array(hashBuffer));
  return hashArray.map(b => b.toString(16).padStart(2, '0')).join('');
}

// 密码强度检测
function getPasswordStrength(password: string): { label: string; color: string } | null {
  if (!password) return null;
  if (password.length < 4) return { label: '密码过短', color: 'var(--error-color)' };
  if (password.length <= 6) return { label: '强度：弱', color: 'var(--warning-color)' };
  if (password.length <= 10) return { label: '强度：中', color: 'var(--info-color)' };
  return { label: '强度：强', color: 'var(--success-color)' };
}

// 防抖 hook
function useDebounce<T extends (...args: any[]) => void>(callback: T, delay: number): T {
  const timerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const callbackRef = useRef(callback);
  callbackRef.current = callback;

  useEffect(() => {
    return () => {
      if (timerRef.current) clearTimeout(timerRef.current);
    };
  }, []);

  return useCallback((...args: any[]) => {
    if (timerRef.current) clearTimeout(timerRef.current);
    timerRef.current = setTimeout(() => {
      callbackRef.current(...args);
    }, delay);
  }, [delay]) as unknown as T;
}

const Settings: React.FC = () => {
  const { settings, saveSettings, resetSettings } = useSettingsStore();
  const { theme, setTheme, isDark } = useTheme();
  const themeOptions = useThemeOptions();
  const { modal } = AntdApp.useApp();
  const [saveMessage, setSaveMessage] = useState<string | null>(null);

  const getScrollContainer = useCallback(() => {
    return document.querySelector('.main-content') as HTMLElement || window;
  }, []);

  const handleSave = async (partial: Partial<AppSettings>) => {
    await saveSettings(partial);
    setSaveMessage('保存成功');
    setTimeout(() => setSaveMessage(null), 2000);
  };

  const handleReset = () => {
    resetSettings();
    setTheme(DEFAULT_THEME);
    setSaveMessage('已恢复默认设置');
    setTimeout(() => setSaveMessage(null), 2000);
  };

  return (
    <div style={{ padding: 24, maxWidth: 960, margin: '0 auto' }}>
      <div style={{
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'space-between',
        marginBottom: 24,
      }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
          <SettingsIcon size={24} color="var(--text-primary)" />
          <div>
            <h2 style={{ fontSize: 22, fontWeight: 700, color: 'var(--text-primary)', margin: 0 }}>
            </h2>
            <p style={{ fontSize: 13, color: 'var(--text-secondary)', margin: 0 }}>
            </p>
          </div>
        </div>
        <Popconfirm
          title="确定要恢复所有默认设置吗？"
          description="此操作不可撤销"
          onConfirm={handleReset}
          okText="恢复默认"
          cancelText="取消"
          okButtonProps={{ danger: true }}
        >
        <Button
          icon={<RotateCcw size={16} />}
        >
          恢复默认
        </Button>
        </Popconfirm>
      </div>

      <div style={{ display: 'flex', gap: 24 }}>
        <div style={{ flex: 1, minWidth: 0 }}>
          {saveMessage && (
            <Alert type="success" message={saveMessage} showIcon closable style={{ marginBottom: 20 }} />
          )}

          <div id="section-font" style={{ marginBottom: 24 }}>
            <FontSettings settings={settings} onSave={handleSave} />
          </div>

          <div id="section-appearance" style={{ marginBottom: 24 }}>
            <AppearanceSettings
              settings={settings}
              theme={theme}
              setTheme={setTheme}
              themeOptions={themeOptions}
              isDark={isDark}
              onSave={handleSave}
            />
          </div>

          <div id="section-sound" style={{ marginBottom: 24 }}>
            <SoundSettings settings={settings} onSave={handleSave} />
          </div>

          <div id="section-backup" style={{ marginBottom: 24 }}>
            <BackupSettings settings={settings} onSave={handleSave} />
          </div>

          <div id="section-export" style={{ marginBottom: 24 }}>
            <ExportSettings settings={settings} onSave={handleSave} />
          </div>

          <div id="section-privacy" style={{ marginBottom: 24 }}>
            <PrivacySettings settings={settings} onSave={handleSave} />
          </div>

          <div id="section-cloud-account" style={{ marginBottom: 24 }}>
            <CloudAccountSettings />
          </div>

          <div id="section-canvas" style={{ marginBottom: 24 }}>
            <div style={{
              backgroundColor: 'var(--bg-secondary)',
              borderRadius: 'var(--radius-lg)',
              padding: 24,
              borderTop: '1px solid rgba(255,255,255,0.06)',
              borderLeft: '1px solid rgba(0,0,0,0.06)',
              borderRight: '1px solid rgba(0,0,0,0.12)',
              borderBottom: '2px solid rgba(0,0,0,0.15)',
              boxShadow: '0 4px 0 0 rgba(0,0,0,0.08), 1px 4px 0 0 rgba(0,0,0,0.04), -1px 4px 0 0 rgba(0,0,0,0.04), inset 0 1px 0 rgba(255,255,255,0.04)',
            }}>
              <h3 style={{ fontSize: 16, fontWeight: 600, color: 'var(--text-primary)', marginBottom: 20 }}>
              </h3>

              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginTop: 12 }}>
                <div>
                  <div style={{ fontSize: 14, fontWeight: 500, color: 'var(--text-primary)' }}>导入大小阈值(MB)</div>
                  <div style={{ fontSize: 13, color: 'var(--text-secondary)', marginTop: 2 }}>超过此阈值的创意导入画布时将触发确认提示</div>
                </div>
                <InputNumber
                  min={1}
                  max={1000}
                  value={settings.canvasImportThreshold ?? 5}
                  onChange={(val) => handleSave({ canvasImportThreshold: val ?? 5 })}
                  style={{ width: 80 }}
                />
              </div>

              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginTop: 16 }}>
                <div>
                  <div style={{ fontSize: 14, fontWeight: 500, color: 'var(--text-primary)' }}>超阈值默认操作</div>
                  <div style={{ fontSize: 13, color: 'var(--text-secondary)', marginTop: 2 }}>当创意超过阈值且不提示时的默认操作</div>
                </div>
                <Select
                  value={settings.canvasImportOverThresholdAction ?? 'prompt'}
                  onChange={(value) => {
                    handleSave({ canvasImportOverThresholdAction: value as 'prompt' | 'copy' | 'link' });
                  }}
                  style={{ width: 180 }}
                  options={[
                    { value: 'prompt', label: '每次提示' },
                    { value: 'copy', label: '默认静默复制' },
                    { value: 'link', label: '默认使用源数据（互通）' },
                  ]}
                />
              </div>
            </div>
          </div>

          <div id="section-ai" style={{ marginBottom: 24 }}>
            <AISettings />
          </div>

          <div id="section-online-music" style={{ marginBottom: 24 }}>
            <OnlineMusicSettings settings={settings} onSave={handleSave} />
          </div>

          <div id="section-lx-music-api" style={{ marginBottom: 24 }}>
            <LxMusicApiSettings />
          </div>
        </div>

        <div style={{ width: 120, flexShrink: 0, position: 'sticky', top: 80, alignSelf: 'flex-start' }}>
          <Anchor
            offsetTop={80}
            targetOffset={80}
            getContainer={getScrollContainer}
            items={[
              { key: 'font', href: '#section-font', title: '字体' },
              { key: 'appearance', href: '#section-appearance', title: '主题' },
              { key: 'sound', href: '#section-sound', title: '音效' },
              { key: 'backup', href: '#section-backup', title: '备份' },
              { key: 'export', href: '#section-export', title: '导出' },
              { key: 'privacy', href: '#section-privacy', title: '隐私' },
              { key: 'canvas', href: '#section-canvas', title: '画布导入' },
              { key: 'ai', href: '#section-ai', title: 'AI' },
              { key: 'online-music', href: '#section-online-music', title: '在线音乐' },
              { key: 'lx-music-api', href: '#section-lx-music-api', title: '音源服务' },
            ]}
          />
        </div>
      </div>
    </div>
  );
};

const LxMusicApiSettings: React.FC = () => {
  const [apiUrl, setApiUrl] = useState('http://127.0.0.1:8080');
  const [status, setStatus] = useState<'unknown' | 'online' | 'offline'>('unknown');
  const [checking, setChecking] = useState(false);

  useEffect(() => {
    api.lxMusic.getApiUrl().then(res => {
      if (res.success && res.data?.url) {
        setApiUrl(res.data.url);
      }
    });
  }, []);

  const handleCheck = async () => {
    setChecking(true);
    try {
      const res = await api.lxMusic.checkStatus();
      setStatus(res.data?.online ? 'online' : 'offline');
    } catch {
      setStatus('offline');
    } finally {
      setChecking(false);
    }
  };

  const handleSave = async () => {
    await api.lxMusic.setApiUrl(apiUrl.trim());
    handleCheck();
  };

  return (
    <div style={{ marginBottom: 16 }}>
      <h3 style={{ fontSize: 15, fontWeight: 600, color: 'var(--text-primary)', marginBottom: 12, display: 'flex', alignItems: 'center', gap: 8 }}>
        <Wifi size={16} />
        音源服务 (lx-music-api)
      </h3>
      <div style={{ fontSize: 11, color: 'var(--text-tertiary)', marginBottom: 8 }}>
        配置 lx-music-api-server 地址后，播放在线歌曲时将优先通过该服务获取播放链接，大大提升资源可用性。      </div>

      <div style={{ marginBottom: 12 }}>
        <div style={{ fontSize: 13, color: 'var(--text-primary)', marginBottom: 6 }}>API 服务地址</div>
        <Input
          value={apiUrl}
          onChange={(e) => { setApiUrl(e.target.value); setStatus('unknown'); }}
          placeholder="http://127.0.0.1:8080"
          style={{ fontFamily: 'monospace', fontSize: 12 }}
        />
      </div>

      <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 12 }}>
        {status === 'online' && (
          <div style={{ display: 'flex', alignItems: 'center', gap: 4 }}>
            <Check size={14} style={{ color: '#22c55e' }} />
            <span style={{ fontSize: 11, color: '#22c55e' }}>服务已连接</span>
          </div>
        )}
        {status === 'offline' && (
          <div style={{ display: 'flex', alignItems: 'center', gap: 4 }}>
            <X size={14} style={{ color: '#ef4444' }} />
            <span style={{ fontSize: 11, color: '#ef4444' }}>服务未运行</span>
          </div>
        )}
        <div style={{ flex: 1 }} />
        <Button size="small" onClick={handleCheck} loading={checking}>检查连接</Button>
        <Button size="small" type="primary" onClick={handleSave}>保存</Button>
      </div>

      <div style={{ padding: 12, borderRadius: 8, backgroundColor: 'var(--bg-tertiary)', border: '1px solid var(--border-light)' }}>
        <div style={{ fontSize: 12, fontWeight: 500, color: 'var(--text-primary)', marginBottom: 8 }}>如何部署 lx-music-api-server？</div>
        <ol style={{ fontSize: 11, color: 'var(--text-tertiary)', lineHeight: 1.8, paddingLeft: 16, margin: 0 }}>
          <li>安装 Python 3.8+ 和 Redis</li>
          <li>克隆项目：<code style={{ fontSize: 10 }}>git clone https://github.com/MeoProject/lx-music-api-server.git</code></li>
          <li>安装依赖：<code style={{ fontSize: 10 }}>pip install -r requirements.txt</code></li>
          <li>启动服务：<code style={{ fontSize: 10 }}>python main.py</code></li>
          <li>默认运行在 <code style={{ fontSize: 10 }}>http://127.0.0.1:8080</code></li>
        </ol>
      </div>
    </div>
  );
};
// 预设主题预览组件
const PresetPreview: React.FC<{ config: CustomThemeConfig; label: string; selected: boolean; onClick: () => void }> = ({ config, label, selected, onClick }) => (
  <Button
    onClick={onClick}
    type={selected ? 'primary' : 'default'}
    style={{
      display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 8, padding: 12, height: 'auto',
      borderColor: selected ? config.primaryColor : 'var(--border-color)',
      backgroundColor: selected ? `${config.primaryColor}15` : 'var(--bg-secondary)',
      color: selected ? config.primaryColor : 'var(--text-secondary)',
    }}
  >
    <div style={{ width: '100%', height: 60, borderRadius: 10, overflow: 'hidden', position: 'relative', border: '1px solid var(--border-light)' }}>
      <div style={{ position: 'absolute', inset: 0, backgroundColor: config.bgPrimary }} />
      <div style={{ position: 'absolute', top: 8, left: 8, width: 24, height: 24, borderRadius: 6, backgroundColor: config.primaryColor }} />
      <div style={{ position: 'absolute', top: 8, right: 8, width: 16, height: 16, borderRadius: 4, backgroundColor: config.bgTertiary }} />
      <div style={{ position: 'absolute', bottom: 8, left: 8, right: 8, height: 12, borderRadius: 4, backgroundColor: config.bgSecondary }} />
    </div>
    <span style={{ fontSize: 12, fontWeight: selected ? 600 : 400 }}>{label}</span>
  </Button>
);

// 颜色选择器组件
const ColorPickerRow: React.FC<{ label: string; value: string; onChange: (v: string) => void }> = ({ label, value, onChange }) => (
  <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 12 }}>
    <span style={{ fontSize: 13, color: 'var(--text-secondary)' }}>{label}</span>
    <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
      <span style={{ fontSize: 12, fontFamily: 'monospace', color: 'var(--text-tertiary)' }}>{value}</span>
      <ColorPicker
        value={value}
        onChange={(_, hex) => onChange(hex)}
        size="small"
      />
    </div>
  </div>
);

interface FontSlot {
  key: keyof AppSettings;
  label: string;
  description: string;
  category: string;
}

const FONT_SLOTS: FontSlot[] = [
  { key: 'h1FontFamily', label: '一级标题', description: '页面中最大的标题', category: '标题字体' },
  { key: 'h2FontFamily', label: '二级标题', description: '章节和分区标题', category: '标题字体' },
  { key: 'h3FontFamily', label: '三级标题', description: '小节和子标题', category: '标题字体' },
  { key: 'titleHighlightFontFamily', label: '标题重点标记', description: '标题中被重点标记的文字', category: '标题字体' },
  { key: 'fontFamily', label: '正文', description: '除创意库外通用的正文字体', category: '正文字体' },
  { key: 'specialFontFamily', label: '特殊字体', description: '特殊场景和装饰性文字', category: '特殊字体' },
  { key: 'englishFontFamily', label: '英文字体', description: '英文字母显示专用', category: '英文字体' },
  { key: 'boardTitleFontFamily', label: '创意库标题', description: '创意库面板的标题字体', category: '专用字体' },
  { key: 'boardBodyFontFamily', label: '创意库正文', description: '创意库面板的正文字体', category: '专用字体' },
  { key: 'boardSpecialFontFamily', label: '创意库特殊', description: '创意库面板的特殊字体', category: '专用字体' },
  { key: 'extensionFontFamily', label: '写作页', description: '写作页页面的替换字体', category: '专用字体' },
];

let _draggedFontFamily: string | null = null;

const FontPoolContent: React.FC<{
  fontPool: { family: string; label: string; source: 'builtin' | 'system' | 'custom' }[];
  dragOverPool: boolean;
  setDragOverPool: (v: boolean) => void;
  handleFontFileDrop: (e: React.DragEvent) => Promise<void>;
  handleRemoveCustomFont: (family: string) => Promise<void>;
}> = ({ fontPool, dragOverPool, setDragOverPool, handleFontFileDrop, handleRemoveCustomFont }) => (
  <div
    onDragOver={(e) => {
      e.preventDefault();
      if (e.dataTransfer.types.includes('Files')) {
        setDragOverPool(true);
      }
    }}
    onDragLeave={() => setDragOverPool(false)}
    onDrop={(e) => {
      if (e.dataTransfer.types.includes('Files')) {
        handleFontFileDrop(e);
      }
    }}
    style={{
      minHeight: 60,
      padding: 12,
      borderRadius: 8,
      border: dragOverPool ? '2px dashed var(--primary-color)' : '1px dashed var(--border-color)',
      backgroundColor: dragOverPool ? 'var(--primary-bg)' : 'transparent',
      transition: 'all 0.15s ease',
    }}
  >
    {fontPool.filter(f => f.source === 'builtin').length > 0 && (
      <div style={{ marginBottom: 8 }}>
        <div style={{ fontSize: 11, color: 'var(--text-tertiary)', marginBottom: 6 }}>内置字体</div>
        <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6 }}>
          {fontPool.filter(f => f.source === 'builtin').map(f => (
            <div
              key={f.family}
              draggable
              onDragStart={(e) => {
                _draggedFontFamily = f.family;
                e.dataTransfer.setData('text/plain', f.family);
                e.dataTransfer.effectAllowed = 'copy';
              }}
              onDragEnd={() => { _draggedFontFamily = null; }}
              style={{
                padding: '4px 10px',
                borderRadius: 6,
                backgroundColor: 'var(--bg-secondary)',
                border: '1px solid var(--border-light)',
                fontSize: 12,
                fontFamily: f.family,
                color: 'var(--text-primary)',
                cursor: 'grab',
                userSelect: 'none',
                transition: 'all 0.1s ease',
              }}
              onMouseDown={(e) => { (e.currentTarget as HTMLElement).style.opacity = '0.7'; }}
              onMouseUp={(e) => { (e.currentTarget as HTMLElement).style.opacity = '1'; }}
              onMouseLeave={(e) => { (e.currentTarget as HTMLElement).style.opacity = '1'; }}
            >
              {f.label}
            </div>
          ))}
        </div>
      </div>
    )}
    {fontPool.filter(f => f.source === 'custom').length > 0 && (
      <div>
        <div style={{ fontSize: 11, color: 'var(--text-tertiary)', marginBottom: 6 }}>自定义字体</div>
        <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6 }}>
          {fontPool.filter(f => f.source === 'custom').map(f => (
            <div
              key={f.family}
              draggable
              onDragStart={(e) => {
                _draggedFontFamily = f.family;
                e.dataTransfer.setData('text/plain', f.family);
                e.dataTransfer.effectAllowed = 'copy';
              }}
              onDragEnd={() => { _draggedFontFamily = null; }}
              style={{
                padding: '4px 10px',
                borderRadius: 6,
                backgroundColor: 'var(--bg-secondary)',
                border: '1px solid var(--border-light)',
                fontSize: 12,
                fontFamily: f.family,
                color: 'var(--text-primary)',
                cursor: 'grab',
                userSelect: 'none',
                display: 'flex',
                alignItems: 'center',
                gap: 4,
                transition: 'all 0.1s ease',
              }}
              onMouseDown={(e) => { (e.currentTarget as HTMLElement).style.opacity = '0.7'; }}
              onMouseUp={(e) => { (e.currentTarget as HTMLElement).style.opacity = '1'; }}
              onMouseLeave={(e) => { (e.currentTarget as HTMLElement).style.opacity = '1'; }}
            >
              {f.label}
              <Tooltip title="移除字体">
                <span
                  onClick={(e) => { e.stopPropagation(); handleRemoveCustomFont(f.family); }}
                  style={{ fontSize: 10, color: 'var(--text-tertiary)', cursor: 'pointer', marginLeft: 2 }}
                >
                  脳
                </span>
              </Tooltip>
            </div>
          ))}
        </div>
      </div>
    )}
    {fontPool.length === 0 && (
      <div style={{ fontSize: 12, color: 'var(--text-tertiary)', textAlign: 'center', padding: 12 }}>
        暂无可用字体
      </div>
    )}
    {dragOverPool && (
      <div style={{ fontSize: 12, color: 'var(--primary-color)', textAlign: 'center', padding: 8, fontWeight: 500 }}>
        拖放以导入字体文件
      </div>
    )}
  </div>
);

const FontConfigPanel: React.FC<{
  settings: AppSettings;
  onSave: (s: Partial<AppSettings>) => Promise<void>;
}> = ({ settings, onSave }) => {
  const debouncedSave = useDebounce(onSave, 300);
  const [dragOverSlot, setDragOverSlot] = useState<string | null>(null);
  const [dragOverPool, setDragOverPool] = useState(false);
  const [importProgress, setImportProgress] = useState<{ active: boolean; current: number; total: number; label: string } | null>(null);
  const [fontPool, setFontPool] = useState<{ family: string; label: string; source: 'builtin' | 'system' | 'custom' }[]>([]);
  const [isDetached, setIsDetached] = useState(false);
  const [floatPos, setFloatPos] = useState({ x: 0, y: 0 });
  const [isDraggingFloat, setIsDraggingFloat] = useState(false);
  const dragOffsetRef = useRef({ x: 0, y: 0 });
  const poolRef = useRef<HTMLDivElement>(null);


  useEffect(() => {
    fontRegistry.loadCustomFontsFromSettings(settings.customFonts);
    const all = [...fontRegistry.getBuiltinFonts(), ...fontRegistry.getSystemFonts(), ...fontRegistry.getCustomFonts()];
    setFontPool(all.map(f => ({ family: f.family, label: f.label, source: f.source })));
  }, [settings.customFonts]);

  useEffect(() => {
    if (!isDraggingFloat) return;
    const handleMouseMove = (e: MouseEvent) => {
      setFloatPos({
        x: e.clientX - dragOffsetRef.current.x,
        y: e.clientY - dragOffsetRef.current.y,
      });
    };
    const handleMouseUp = () => {
      setIsDraggingFloat(false);
    };
    window.addEventListener('mousemove', handleMouseMove);
    window.addEventListener('mouseup', handleMouseUp);
    return () => {
      window.removeEventListener('mousemove', handleMouseMove);
      window.removeEventListener('mouseup', handleMouseUp);
    };
  }, [isDraggingFloat]);

  const handleDetach = () => {
    if (!isDetached && poolRef.current) {
      const rect = poolRef.current.getBoundingClientRect();
      setFloatPos({ x: rect.left, y: rect.top });
    }
    setIsDetached(!isDetached);
  };

  const handleFloatDragStart = (e: React.MouseEvent) => {
    e.preventDefault();
    dragOffsetRef.current = {
      x: e.clientX - floatPos.x,
      y: e.clientY - floatPos.y,
    };
    setIsDraggingFloat(true);
  };

  const categories = useMemo(() => {
    const cats: { name: string; slots: FontSlot[] }[] = [];
    const seen = new Set<string>();
    FONT_SLOTS.forEach(slot => {
      if (!seen.has(slot.category)) {
        seen.add(slot.category);
        cats.push({ name: slot.category, slots: [] });
      }
      cats.find(c => c.name === slot.category)!.slots.push(slot);
    });
    return cats;
  }, []);

  const handleDropOnSlot = (e: React.DragEvent, slotKey: keyof AppSettings) => {
    e.preventDefault();
    e.stopPropagation();
    setDragOverSlot(null);
    const family = _draggedFontFamily || e.dataTransfer.getData('text/plain');
    _draggedFontFamily = null;
    if (!family) { return; }
    const entry = fontRegistry.findFontByFamily(family);
    if (entry) {
      const value = fontRegistry.buildFontValue(entry.family, entry.fallback);
      onSave({ [slotKey]: value } as Partial<AppSettings>);
    }
  };

  const handleFontFileDrop = async (e: React.DragEvent) => {
    e.preventDefault();
    setDragOverPool(false);
    const files: File[] = [];
    if (e.dataTransfer.files) {
      for (let i = 0; i < e.dataTransfer.files.length; i++) {
        const file = e.dataTransfer.files[i];
        const ext = file.name.toLowerCase();
        if (ext.endsWith('.ttf') || ext.endsWith('.otf') || ext.endsWith('.woff') || ext.endsWith('.woff2') || ext.endsWith('.ttc')) {
          files.push(file);
        }
      }
    }
    if (files.length === 0) return;
    modal.confirm({
      title: '导入字体',
      content: `检测到 ${files.length} 个字体文件，是否导入？`,
      okText: '导入',
      cancelText: '取消',
      onOk: () => processFontImport(files.map(f => (f as any).path || f.name)),
    });
  };

  const handleSelectFontFiles = async () => {
    try {
      const filePaths = await api.font.selectFiles([
        { name: '字体文件', extensions: ['ttf', 'otf', 'woff', 'woff2', 'ttc'] },
        { name: '所有文件', extensions: ['*'] },
      ]);
      if (filePaths && filePaths.length > 0) {
        await processFontImport(filePaths);
      }
    } catch { /* silent */ }
  };

  const processFontImport = async (filePaths: string[]) => {
    setImportProgress({ active: true, current: 0, total: filePaths.length, label: '准备导入...' });
    try {
      await fontRegistry.importFontFiles(filePaths, (current: number, total: number, entry: fontRegistry.FontEntry) => {
        setImportProgress({ active: true, current, total, label: `导入 ${entry.label}` });
      });
      const json = fontRegistry.serializeCustomFonts();
      await onSave({ customFonts: json });
      const all = [...fontRegistry.getBuiltinFonts(), ...fontRegistry.getSystemFonts(), ...fontRegistry.getCustomFonts()];
      setFontPool(all.map(f => ({ family: f.family, label: f.label, source: f.source })));
    } catch {
      // silent
    } finally {
      setTimeout(() => setImportProgress(null), 800);
    }
  };

  const handleRemoveCustomFont = async (family: string) => {
    fontRegistry.removeCustomFont(family);
    const json = fontRegistry.serializeCustomFonts();
    await onSave({ customFonts: json });
    const all = [...fontRegistry.getBuiltinFonts(), ...fontRegistry.getSystemFonts(), ...fontRegistry.getCustomFonts()];
    setFontPool(all.map(f => ({ family: f.family, label: f.label, source: f.source })));
  };

  const getSlotDisplayLabel = (slotKey: keyof AppSettings): string => {
    const value = settings[slotKey] as string;
    if (!value) return '未设置';
    const first = value.split(',')[0].trim().replace(/^['"]|['"]$/g, '');
    const poolItem = fontPool.find(f => f.family === first);
    return poolItem ? poolItem.label : first;
  };

  return (
    <div style={{ marginBottom: 24, padding: 16, borderRadius: 'var(--radius-md)', border: '1px solid var(--border-light)', backgroundColor: 'var(--bg-tertiary)' }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 16 }}>
        <Type size={16} color="var(--primary-color)" />
        <span style={{ fontSize: 14, fontWeight: 600, color: 'var(--text-primary)' }}>字体配置</span>
        <span style={{ fontSize: 12, color: 'var(--text-tertiary)', marginLeft: 4 }}>拖动下方字体到设置位</span>
      </div>

      {categories.map(cat => (
        <div key={cat.name} style={{ marginBottom: 16 }}>
          <div style={{ fontSize: 13, fontWeight: 600, color: 'var(--primary-color)', marginBottom: 8, paddingBottom: 4, borderBottom: '1px solid var(--border-light)' }}>
            {cat.name}
          </div>
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(200px, 1fr))', gap: 8 }}>
            {cat.slots.map(slot => (
              <div
                key={slot.key}
                onDragOver={(e) => { e.preventDefault(); e.dataTransfer.dropEffect = 'copy'; setDragOverSlot(slot.key); }}
                onDragLeave={() => { setDragOverSlot(null); }}
                onDrop={(e) => { handleDropOnSlot(e, slot.key); }}
                style={{
                  padding: '8px 12px',
                  borderRadius: 8,
                  border: dragOverSlot === slot.key ? '2px dashed var(--primary-color)' : '1px solid var(--border-light)',
                  backgroundColor: dragOverSlot === slot.key ? 'var(--primary-bg)' : 'var(--bg-secondary)',
                  transition: 'all 0.15s ease',
                  cursor: 'default',
                }}
              >
                <div style={{ fontSize: 12, fontWeight: 500, color: 'var(--text-secondary)' }}>{slot.label}</div>
                <div style={{ fontSize: 11, color: 'var(--text-tertiary)', marginTop: 2 }}>{slot.description}</div>
                <div style={{ fontSize: 13, fontWeight: 600, color: 'var(--text-primary)', marginTop: 4, fontFamily: settings[slot.key] as string, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                  {getSlotDisplayLabel(slot.key)}
                </div>
              </div>
            ))}
          </div>
        </div>
      ))}

      <div ref={poolRef} style={{ marginTop: 20, paddingTop: 16, borderTop: '2px solid var(--border-light)' }}>
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 12 }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
            <span style={{ fontSize: 13, fontWeight: 600, color: 'var(--text-primary)' }}>字体池</span>
            <span style={{ fontSize: 11, color: 'var(--text-tertiary)' }}>拖动到上方设置位替换字体</span>
          </div>
          <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
            <motion.button
              whileHover={{ scale: 1.08 }}
              whileTap={{ scale: 0.92 }}
              onClick={handleDetach}
              title={isDetached ? '复位' : '窗口化'}
              style={{
                display: 'inline-flex',
                alignItems: 'center',
                justifyContent: 'center',
                width: 28,
                height: 28,
                borderRadius: 6,
                border: '1px solid var(--border-light)',
                backgroundColor: isDetached ? 'var(--primary-bg)' : 'var(--bg-secondary)',
                color: isDetached ? 'var(--primary-color)' : 'var(--text-tertiary)',
                cursor: 'pointer',
                transition: 'all 0.15s ease',
              }}
            >
              {isDetached ? <PinOff size={14} /> : <Pin size={14} />}
            </motion.button>
            <Button size="small" icon={<Plus size={14} />} onClick={handleSelectFontFiles}>
              添加字体
            </Button>
          </div>
        </div>

        {!isDetached && (
          <FontPoolContent
            fontPool={fontPool}
            dragOverPool={dragOverPool}
            setDragOverPool={setDragOverPool}
            handleFontFileDrop={handleFontFileDrop}
            handleRemoveCustomFont={handleRemoveCustomFont}
          />
        )}
      </div>

      {isDetached && (
        <div
          style={{
            position: 'fixed',
            left: floatPos.x,
            top: floatPos.y,
            zIndex: 9999,
            width: 320,
            backgroundColor: 'var(--bg-secondary)',
            border: '1px solid var(--border-color)',
            borderRadius: 12,
            boxShadow: '0 12px 40px rgba(0,0,0,0.2), 0 4px 12px rgba(0,0,0,0.1)',
            overflow: 'hidden',
            opacity: isDraggingFloat ? 0.9 : 1,
            transition: isDraggingFloat ? 'none' : 'opacity 0.15s ease',
          }}
        >
          <div
            onMouseDown={handleFloatDragStart}
            style={{
              display: 'flex',
              alignItems: 'center',
              gap: 8,
              padding: '8px 12px',
              backgroundColor: 'var(--bg-tertiary)',
              borderBottom: '1px solid var(--border-light)',
              cursor: isDraggingFloat ? 'grabbing' : 'grab',
              userSelect: 'none',
            }}
          >
            <GripHorizontal size={14} color="var(--text-tertiary)" />
            <span style={{ fontSize: 12, fontWeight: 600, color: 'var(--text-primary)', flex: 1 }}>字体池</span>
            <Tooltip title="复位">
              <motion.button
                whileHover={{ scale: 1.1 }}
                whileTap={{ scale: 0.9 }}
                onClick={handleDetach}
                style={{
                  display: 'inline-flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  width: 24,
                  height: 24,
                  borderRadius: 4,
                  border: 'none',
                  backgroundColor: 'var(--primary-bg)',
                  color: 'var(--primary-color)',
                  cursor: 'pointer',
                }}
              >
                <PinOff size={12} />
              </motion.button>
            </Tooltip>
          </div>
          <div style={{ padding: 12 }}>
            <FontPoolContent
              fontPool={fontPool}
              dragOverPool={dragOverPool}
              setDragOverPool={setDragOverPool}
              handleFontFileDrop={handleFontFileDrop}
              handleRemoveCustomFont={handleRemoveCustomFont}
            />
          </div>
        </div>
      )}

      {importProgress && importProgress.active && (
        <div style={{
          position: 'fixed', bottom: 24, left: '50%', transform: 'translateX(-50%)',
          backgroundColor: 'var(--bg-secondary)', border: '1px solid var(--border-color)',
          borderRadius: 12, padding: '12px 20px', boxShadow: '0 8px 32px rgba(0,0,0,0.15)',
          zIndex: 99999, minWidth: 260, display: 'flex', flexDirection: 'column', gap: 8,
        }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
            <RefreshCw size={14} color="var(--primary-color)" style={{ animation: 'spin 1s linear infinite' }} />
            <span style={{ fontSize: 13, fontWeight: 500, color: 'var(--text-primary)' }}>{importProgress.label}</span>
            <span style={{ fontSize: 12, color: 'var(--text-tertiary)', marginLeft: 'auto' }}>
              {importProgress.current}/{importProgress.total}
            </span>
          </div>
          <Progress
            percent={importProgress.total > 0 ? Math.round((importProgress.current / importProgress.total) * 100) : 0}
            status={importProgress.current === importProgress.total ? 'success' : 'active'}
            showInfo={false}
            size="small"
            strokeColor="var(--primary-color)"
          />
        </div>
      )}
    </div>
  );
};

const FontSettings: React.FC<{
  settings: AppSettings;
  onSave: (s: Partial<AppSettings>) => Promise<void>;
}> = ({ settings, onSave }) => {
  const debouncedSave = useDebounce(onSave, 300);

  return (
    <div style={{
      backgroundColor: 'var(--bg-secondary)',
      borderRadius: 'var(--radius-lg)',
      padding: 24,
      borderTop: '1px solid rgba(255,255,255,0.06)',
      borderLeft: '1px solid rgba(0,0,0,0.06)',
      borderRight: '1px solid rgba(0,0,0,0.12)',
      borderBottom: '2px solid rgba(0,0,0,0.15)',
      boxShadow: '0 4px 0 0 rgba(0,0,0,0.08), 1px 4px 0 0 rgba(0,0,0,0.04), -1px 4px 0 0 rgba(0,0,0,0.04), inset 0 1px 0 rgba(255,255,255,0.04)',
    }}>
      <h3 style={{ fontSize: 16, fontWeight: 600, color: 'var(--text-primary)', marginBottom: 20 }}>
        字体设置
      </h3>

      <div style={{ padding: 16, borderRadius: 'var(--radius-md)', backgroundColor: 'var(--bg-tertiary)', border: '1px solid var(--border-light)', marginBottom: 24 }}>
        <div style={{ fontSize: 12, color: 'var(--text-tertiary)', marginBottom: 8 }}>预览效果</div>
        <p style={{ fontSize: `${settings.fontSize}px`, lineHeight: Number(settings.fontLineHeight), color: 'var(--text-primary)', margin: 0 }}>
          脑洞集 - 记录每一个灵感瞬间，让创意不再流失。
          在这里你可以自由地记录你的想法、灵感和创意。
        </p>
      </div>

      <div style={{ marginBottom: 24 }}>
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
          <label style={{ fontSize: 14, fontWeight: 500, color: 'var(--text-primary)' }}>字体大小</label>
          <span style={{ fontSize: 13, color: 'var(--text-secondary)' }}>{settings.fontSize}px</span>
        </div>
        <input
          type="range"
          min={12}
          max={20}
          value={settings.fontSize}
          onChange={(e) => debouncedSave({ fontSize: Number(e.target.value) })}
          style={{ width: '100%', accentColor: 'var(--primary-color)' }}
        />
      </div>

      <div style={{ marginBottom: 24 }}>
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
          <label style={{ fontSize: 14, fontWeight: 500, color: 'var(--text-primary)' }}>行高</label>
          <span style={{ fontSize: 13, color: 'var(--text-secondary)' }}>{Number(settings.fontLineHeight).toFixed(1)}</span>
        </div>
        <input
          type="range"
          min={1.2}
          max={2.0}
          step={0.1}
          value={Number(settings.fontLineHeight)}
          onChange={(e) => debouncedSave({ fontLineHeight: Number(e.target.value) })}
          style={{ width: '100%', accentColor: 'var(--primary-color)' }}
        />
      </div>

      <FontConfigPanel settings={settings} onSave={onSave} />
    </div>
  );
};
// 主题设置
const AppearanceSettings: React.FC<{
  settings: AppSettings;
  theme: string;
  setTheme: (t: AppSettings['theme'], config?: CustomThemeConfig) => void;
  themeOptions: { value: AppSettings['theme']; label: string }[];
  isDark: boolean;
  onSave: (s: Partial<AppSettings>) => Promise<void>;
}> = ({ settings, theme, setTheme, themeOptions, isDark, onSave }) => {
  const debouncedSave = useDebounce(onSave, 300);
  
  // 本地管理自定义配置状态，实现实时预览
  const [customConfig, setCustomConfig] = useState<CustomThemeConfig>(() => {
    if (settings.customTheme) {
      try { return { ...DEFAULT_CUSTOM_THEME, ...JSON.parse(settings.customTheme) }; } catch { /* fallback */ }
    }
    return DEFAULT_CUSTOM_THEME;
  });
  // 更新单个颜色并预览
  const updateColor = (key: keyof CustomThemeConfig, value: string) => {
    // 自动计算相关的颜色变化，提升体验
    let newConfig = { ...customConfig, [key]: value };

    if (key === 'primaryColor') {
      // 自动计算 primaryHover (稍微加重一点)
      // 简单的颜色加重，作为 fallback
      try {
        newConfig.primaryLight = value + '33'; // 20% 透明度
        newConfig.primaryBg = value + '12'; // 7% 透明度
      } catch { /* fallback */ }
    }

    setCustomConfig(newConfig);

    // 应用到 DOM 实时预览，但不保存到数据库，等用户确认或保存整体
    applyCustomThemeToDOM(newConfig);
  };
  // 选择预设主题
  const selectPreset = (presetKey: string) => {
    const preset = PRESET_THEMES[presetKey];
    setCustomConfig(preset);
    applyCustomThemeToDOM(preset);
    onSave({ customTheme: JSON.stringify(preset) });
    setTheme('custom', preset);
  };
  // 重置自定义
  const resetCustom = () => {
    setCustomConfig(DEFAULT_CUSTOM_THEME);
    applyCustomThemeToDOM(DEFAULT_CUSTOM_THEME);
    onSave({ customTheme: JSON.stringify(DEFAULT_CUSTOM_THEME) });
  };
  
  // 保存自定义配置并应用
  const applyCustom = () => {
    onSave({ customTheme: JSON.stringify(customConfig) });
    setTheme('custom', customConfig);
  };

  return (
    <div style={{
      backgroundColor: 'var(--bg-secondary)',
      borderRadius: 'var(--radius-lg)',
      padding: 24,
      borderTop: '1px solid rgba(255,255,255,0.06)',
      borderLeft: '1px solid rgba(0,0,0,0.06)',
      borderRight: '1px solid rgba(0,0,0,0.12)',
      borderBottom: '2px solid rgba(0,0,0,0.15)',
      boxShadow: '0 4px 0 0 rgba(0,0,0,0.08), 1px 4px 0 0 rgba(0,0,0,0.04), -1px 4px 0 0 rgba(0,0,0,0.04), inset 0 1px 0 rgba(255,255,255,0.04)',
    }}>
      <h3 style={{ fontSize: 16, fontWeight: 600, color: 'var(--text-primary)', marginBottom: 20 }}>
        主题设置
      </h3>
      {/* 主题选择 */}
      <div style={{ marginBottom: 24 }}>
        <label style={{ fontSize: 14, fontWeight: 500, color: 'var(--text-primary)' }}>主题</label>
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: 12 }}>
          {themeOptions.map((opt) => (
            <Button
              key={opt.value}
              onClick={() => {
                if (opt.value !== 'custom') {
                  setTheme(opt.value);
                  onSave({ theme: opt.value });
                }
              }}
              type={theme === opt.value ? 'primary' : 'default'}
              style={{
                display: 'flex',
                flexDirection: 'column',
                alignItems: 'center',
                gap: 8,
                padding: 16,
                height: 'auto',
              }}
            >
              <div style={{ width: 48, height: 48, display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 22 }}>
                {opt.value === 'dark' ? <Moon size={22} /> : opt.value.startsWith('morandi') ? <Eye size={22} /> : <Sun size={22} />}
              </div>
              <span style={{ fontSize: 13 }}>
                {opt.label}
              </span>
            </Button>
          ))}
        </div>
      </div>
      {/* 自定义主色配置区 - 常规显示 */}
      <div
        style={{ marginBottom: 24, padding: 16, borderRadius: 'var(--radius-md)', border: '1px solid var(--border-light)', backgroundColor: 'var(--bg-tertiary)' }}
      >
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 12 }}>
          <span style={{ fontSize: 14, fontWeight: 500, color: 'var(--text-primary)' }}>自定义配色</span>
          <div style={{ display: 'flex', gap: 8 }}>
            <Button
              onClick={resetCustom}
              size="small"
            >
              重置
            </Button>
            {theme !== 'custom' && (
              <Button
                onClick={applyCustom}
                type="primary"
                size="small"
              >
                应用此配色
              </Button>
            )}
          </div>
        </div>
        {/* 预设推荐 */}
        <div style={{ marginBottom: 16 }}>
          <label style={{ fontSize: 14, fontWeight: 500, color: 'var(--text-primary)' }}>推荐预设</label>
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: 10 }}>
            {Object.entries(PRESET_THEMES).map(([key, config]) => {
              const labels = { sakura: '樱花粉', mint: '薄荷绿', sky: '天空蓝', coffee: '咖啡棕', 'deep-purple': '深空紫' };
              return <PresetPreview key={key} config={config} label={labels[key as keyof typeof labels]} selected={JSON.stringify(customConfig) === JSON.stringify(config)} onClick={() => selectPreset(key)} />;
            })}
          </div>
        </div>
        
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 16 }}>
          <div>
            <div style={{ fontSize: 14, fontWeight: 500, color: 'var(--text-primary)', marginBottom: 8 }}>主色调</div>
            <ColorPickerRow label="主色" value={customConfig.primaryColor} onChange={(v) => updateColor('primaryColor', v)} />
            <ColorPickerRow label="主色 hover" value={customConfig.primaryHover} onChange={(v) => updateColor('primaryHover', v)} />
            <ColorPickerRow label="主背景" value={customConfig.bgPrimary} onChange={(v) => updateColor('bgPrimary', v)} />
            <ColorPickerRow label="次背景" value={customConfig.bgSecondary} onChange={(v) => updateColor('bgSecondary', v)} />
            <ColorPickerRow label="次背景2" value={customConfig.bgTertiary} onChange={(v) => updateColor('bgTertiary', v)} />
          </div>
          <div>
            <div style={{ fontSize: 14, fontWeight: 500, color: 'var(--text-primary)', marginBottom: 8 }}>文字与边框</div>
            <ColorPickerRow label="文字 主" value={customConfig.textPrimary} onChange={(v) => updateColor('textPrimary', v)} />
            <ColorPickerRow label="文字 次" value={customConfig.textSecondary} onChange={(v) => updateColor('textSecondary', v)} />
            <ColorPickerRow label="边框" value={customConfig.borderColor} onChange={(v) => updateColor('borderColor', v)} />
            <ColorPickerRow label="边框 浅" value={customConfig.borderLight} onChange={(v) => updateColor('borderLight', v)} />
          </div>
        </div>
      </div>
      {/* 自定义指针 */}
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginTop: 20 }}>
        <div>
          <div style={{ fontSize: 14, fontWeight: 500, color: 'var(--text-primary)' }}>自定义指针</div>
          <div style={{ fontSize: 13, color: 'var(--text-secondary)', marginTop: 2 }}>使用 Aemeath 主题指针美化</div>
        </div>
        <Switch
          checked={settings.customCursor}
          onChange={(val) => {
            debouncedSave({ customCursor: val });
            document.documentElement.setAttribute('data-custom-cursor', val ? 'true' : 'false');
            localStorage.setItem('mindvault-custom-cursor', String(val));
          }}
          size="small"
        />
      </div>
    </div>
  );
};

// 音效设置（含试听按钮）
const SoundSettings: React.FC<{
  settings: AppSettings;
  onSave: (s: Partial<AppSettings>) => Promise<void>;
}> = ({ settings, onSave }) => {
  const [isTestingTTS, setIsTestingTTS] = useState(false);
  const [audioInputDevices, setAudioInputDevices] = useState<MediaDeviceInfo[]>([]);
  const [audioOutputDevices, setAudioOutputDevices] = useState<MediaDeviceInfo[]>([]);
  const [isLoadingDevices, setIsLoadingDevices] = useState(false);
  // 加载音频设备
  const loadAudioDevices = useCallback(async () => {
    setIsLoadingDevices(true);
    try {
      // 先请求权限，这样可以获取到设备名称
      try {
        await navigator.mediaDevices.getUserMedia({ audio: true });
      } catch {
        // 忽略权限错误，继续枚举设备（可能没有名称）
      }

      const devices = await navigator.mediaDevices.enumerateDevices();
      setAudioInputDevices(devices.filter(d => d.kind === 'audioinput'));
      setAudioOutputDevices(devices.filter(d => d.kind === 'audiooutput'));
    } catch (error) {
      console.error('加载音频设备失败:', error);
    } finally {
      setIsLoadingDevices(false);
    }
  }, []);
  // 组件挂载时加载设备
  useEffect(() => {
    loadAudioDevices();
  }, [loadAudioDevices]);
  
  const testTTS = async () => {
    if (isTestingTTS) return;
    setIsTestingTTS(true);
    try {
      const { useEdgeTTS } = await import('../hooks/useEdgeTTS');
      const { speak } = useEdgeTTS({
        voice: settings.ttsVoice,
        rate: settings.ttsRate,
        pitch: settings.ttsPitch,
        volume: settings.ttsVolume,
      });
      await speak('你好，这是测试朗读效果。');
    } catch (e) {
      console.error('TTS test failed:', e);
    } finally {
      setIsTestingTTS(false);
    }
  };

  return (
    <div style={{
      backgroundColor: 'var(--bg-secondary)',
      borderRadius: 'var(--radius-lg)',
      padding: 24,
      borderTop: '1px solid rgba(255,255,255,0.06)',
      borderLeft: '1px solid rgba(0,0,0,0.06)',
      borderRight: '1px solid rgba(0,0,0,0.12)',
      borderBottom: '2px solid rgba(0,0,0,0.15)',
      boxShadow: '0 4px 0 0 rgba(0,0,0,0.08), 1px 4px 0 0 rgba(0,0,0,0.04), -1px 4px 0 0 rgba(0,0,0,0.04), inset 0 1px 0 rgba(255,255,255,0.04)',
    }}>
      <h3 style={{ fontSize: 16, fontWeight: 600, color: 'var(--text-primary)', marginBottom: 20 }}>
        音效设置
      </h3>

      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 20 }}>
        <div>
          <div style={{ fontSize: 14, fontWeight: 500, color: 'var(--text-primary)' }}>启用音效</div>
          <div style={{ fontSize: 13, color: 'var(--text-secondary)', marginTop: 2 }}>操作时播放提示音</div>
        </div>
        <Switch
          checked={settings.soundEnabled}
          onChange={() => onSave({ soundEnabled: !settings.soundEnabled })}
        />
      </div>

      {settings.soundEnabled && (
        <div>
          <label style={{ fontSize: 14, fontWeight: 500, color: 'var(--text-primary)' }}>音量</label>
          <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
            <span style={{ fontSize: 13, color: 'var(--text-secondary)' }}>{Math.round(settings.soundVolume * 100)}%</span>
            <Button
              onClick={() => playSound('save', settings.soundVolume)}
              size="small"
              icon={<Play size={14} />}
            >
              试听
            </Button>
          </div>
          <input
            type="range"
            min={0} max={1} step={0.1}
            value={settings.soundVolume}
            onChange={(e) => onSave({ soundVolume: Number(e.target.value) })}
            style={{ width: '100%', accentColor: 'var(--primary-color)' }}
          />
        </div>
      )}

      {settings.soundEnabled && (
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginTop: 20 }}>
          <div>
            <div style={{ fontSize: 14, fontWeight: 500, color: 'var(--text-primary)' }}>键盘打字音效</div>
            <div style={{ fontSize: 13, color: 'var(--text-secondary)', marginTop: 2 }}>点击侧边栏按钮时播放键盘敲击音效</div>
          </div>
          <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
            <Button
              onClick={() => playKeyPressSound(settings.soundVolume)}
              size="small"
              icon={<Play size={14} />}
            >
              试听
            </Button>
            <Switch
              checked={settings.keyPressSoundEnabled}
              onChange={() => onSave({ keyPressSoundEnabled: !settings.keyPressSoundEnabled })}
              size="small"
            />
          </div>
        </div>
      )}
      {/* TTS 朗读设置 */}
      <div style={{ marginTop: 24, paddingTop: 20, borderTop: '1px solid var(--border-color)' }}>
        <h4 style={{ fontSize: 14, fontWeight: 600, color: 'var(--text-primary)', marginBottom: 12 }}>
          AI 朗读音色
        </h4>

        <div style={{ fontSize: 13, color: 'var(--text-secondary)', marginBottom: 8 }}>选择音色</div>
        <Select
          value={settings.ttsVoice}
          onChange={(value) => onSave({ ttsVoice: value })}
          style={{ width: '100%' }}
          options={[
            { label: '晓晓（女声）', value: 'zh-CN-XiaoxiaoNeural' },
            { label: '晓依（女声）', value: 'zh-CN-XiaoyiNeural' },
            { label: '云健（男声）', value: 'zh-CN-YunjianNeural' },
            { label: '云希（男声）', value: 'zh-CN-YunxiNeural' },
            { label: '云夏（女声）', value: 'zh-CN-YunxiaNeural' },
            { label: '云扬（男声）', value: 'zh-CN-YunyangNeural' },
            { label: '晓涵（女声）', value: 'zh-CN-XiaohanNeural' },
            { label: '晓瑞（女声）', value: 'zh-CN-XiaoruiNeural' },
            { label: '晓双（女声）', value: 'zh-CN-XiaoshuangNeural' },
            { label: '晓萱（女声）', value: 'zh-CN-XiaoxuanNeural' },
            { label: '晓颜（女声）', value: 'zh-CN-XiaoyanNeural' },
            { label: '云野（女声）', value: 'zh-CN-YunyeNeural' },
            { label: '云泽（男声）', value: 'zh-CN-YunzeiNeural' },
            { label: '云臻（女声）', value: 'zh-CN-YunzhenNeural' },
            { label: 'Jenny（英文女声）', value: 'en-US-JennyNeural' },
            { label: 'Guy（英文男声）', value: 'en-US-GuyNeural' },
          ]}
        />

        <div style={{ display: 'flex', alignItems: 'center', gap: 12, marginBottom: 12 }}>
          <Button
            onClick={testTTS}
            loading={isTestingTTS}
            size="small"
            icon={<Play size={14} />}
          >
            试听音色
          </Button>
        </div>

        <div style={{ marginBottom: 12 }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
            <span style={{ fontSize: 13, color: 'var(--text-secondary)' }}>语速</span>
            <span style={{ fontSize: 12, color: 'var(--text-tertiary)' }}>{settings.ttsRate > 0 ? '+' : ''}{settings.ttsRate}%</span>
          </div>
          <input
            type="range"
            min={-50} max={50} step={10}
            value={settings.ttsRate}
            onChange={(e) => onSave({ ttsRate: Number(e.target.value) })}
            style={{ width: '100%', accentColor: 'var(--primary-color)' }}
          />
        </div>

        <div style={{ marginBottom: 12 }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
            <span style={{ fontSize: 13, color: 'var(--text-secondary)' }}>音调</span>
            <span style={{ fontSize: 12, color: 'var(--text-tertiary)' }}>{settings.ttsPitch > 0 ? '+' : ''}{settings.ttsPitch}%</span>
          </div>
          <input
            type="range"
            min={-20} max={20} step={5}
            value={settings.ttsPitch}
            onChange={(e) => onSave({ ttsPitch: Number(e.target.value) })}
            style={{ width: '100%', accentColor: 'var(--primary-color)' }}
          />
        </div>

        <div>
          <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
            <span style={{ fontSize: 13, color: 'var(--text-secondary)' }}>音量</span>
            <span style={{ fontSize: 12, color: 'var(--text-tertiary)' }}>{settings.ttsVolume}%</span>
          </div>
          <input
            type="range"
            min={0} max={100} step={10}
            value={settings.ttsVolume}
            onChange={(e) => onSave({ ttsVolume: Number(e.target.value) })}
            style={{ width: '100%', accentColor: 'var(--primary-color)' }}
          />
        </div>
      </div>
      {/* 音频设备设置 */}
      <div style={{ marginTop: 24, paddingTop: 20, borderTop: '1px solid var(--border-color)' }}>
        <h4 style={{ fontSize: 14, fontWeight: 600, color: 'var(--text-primary)', marginBottom: 12 }}>
          音频设备
        </h4>
        
        <div style={{ marginBottom: 16 }}>
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
            <div style={{ fontSize: 13, color: 'var(--text-secondary)' }}>录音输入设备</div>
            <Button
              size="small"
              icon={<RefreshCw size={14} />}
              onClick={loadAudioDevices}
              loading={isLoadingDevices}
            >
              刷新
            </Button>
          </div>
          <Select
            value={settings.audioInputDeviceId}
            onChange={(value) => onSave({ audioInputDeviceId: value })}
            style={{ width: '100%' }}
            options={[
              { label: '默认', value: null },
              ...audioInputDevices.map(device => ({
                label: device.label || `麦克风${audioInputDevices.indexOf(device) + 1}`,
                value: device.deviceId
              }))
            ]}
          />
          <div style={{ fontSize: 11, color: 'var(--text-tertiary)', marginTop: 4 }}>
            {audioInputDevices.length === 0 ? '未检测到麦克风设备' : `已检测到 ${audioInputDevices.length} 个录音设备`}
          </div>
        </div>

        <div style={{ marginBottom: 16 }}>
          <div style={{ fontSize: 13, color: 'var(--text-secondary)', marginBottom: 8 }}>音频输出设备</div>
          <Select
            value={settings.audioOutputDeviceId}
            onChange={(value) => onSave({ audioOutputDeviceId: value })}
            style={{ width: '100%' }}
            options={[
              { label: '默认', value: null },
              ...audioOutputDevices.map(device => ({
                label: device.label || `扬声器${audioOutputDevices.indexOf(device) + 1}`,
                value: device.deviceId
              }))
            ]}
          />
        </div>
      </div>
    </div>
  );
};
// 备份设置（含手动备份、恢复、上次备份时间、自动备份间隔、备份路径）
const BackupSettings: React.FC<{
  settings: AppSettings;
  onSave: (s: Partial<AppSettings>) => Promise<void>;
}> = ({ settings, onSave }) => {
  const [lastBackupTime, setLastBackupTime] = useState<string | null>(null);
  const [backupResult, setBackupResult] = useState<{ type: 'success' | 'error'; message: string } | null>(null);
  const [isBackingUp, setIsBackingUp] = useState(false);
  const [isRestoring, setIsRestoring] = useState(false);
  const [countdown, setCountdown] = useState<number | null>(null);
  const [backupPath, setBackupPath] = useState<string>('');
  const countdownRef = useRef<ReturnType<typeof setInterval> | null>(null);
  // 读取上次备份时间
  useEffect(() => {
    const stored = localStorage.getItem('mindvault:lastBackupTime');
    if (stored) {
      setLastBackupTime(stored);
    }
  }, []);
  // 获取备份路径
  useEffect(() => {
    const getBackupPath = async () => {
      try {
        const api = (window as any).electronAPI;
        if (api?.settings) {
          const path = await api.settings.get('backupPath');
          if (path) {
            setBackupPath(path);
          } else {
            // 默认显示用户数据目录下的 backups 文件夹
            setBackupPath('用户数据目录/mindvault/backups');
          }
        } else {
          setBackupPath('用户数据目录/mindvault/backups');
        }
      } catch {
        // 静默处理
      }
    };
    getBackupPath();
  }, []);
  // 自动备份倒计时
  useEffect(() => {
    if (settings.autoBackup) {
      // 从 localStorage 读取上次备份时间来计算倒计时
      const lastBackupTs = localStorage.getItem('mindvault:lastBackupTimestamp');
      let startTime: number;
      if (lastBackupTs) {
        startTime = parseInt(lastBackupTs, 10);
      } else {
        startTime = Date.now();
        localStorage.setItem('mindvault:lastBackupTimestamp', String(startTime));
      }

      const intervalMs = settings.autoBackupInterval * 60 * 1000;

      const updateCountdown = () => {
        const elapsed = Date.now() - startTime;
        const remaining = Math.max(0, intervalMs - elapsed);
        const remainingMinutes = Math.ceil(remaining / 60000);
        setCountdown(remainingMinutes);
      };

      countdownRef.current = setInterval(updateCountdown, 10000); // 每 10秒更新
      return () => {
        if (countdownRef.current) clearInterval(countdownRef.current);
      };
    } else {
      setCountdown(null);
      if (countdownRef.current) {
        clearInterval(countdownRef.current);
        countdownRef.current = null;
      }
    }
  }, [settings.autoBackup, settings.autoBackupInterval]);
  // 手动备份
  const handleManualBackup = async () => {
    setIsBackingUp(true);
    setBackupResult(null);
    try {
      const api = (window as any).electronAPI;
      if (api?.backup?.create) {
        const result = await api.backup.create();
        if (result.success) {
          const now = new Date().toISOString();
          localStorage.setItem('mindvault:lastBackupTime', now);
          localStorage.setItem('mindvault:lastBackupTimestamp', String(Date.now()));
          setLastBackupTime(now);
          setBackupResult({ type: 'success', message: '备份成功！' });
        } else {
          setBackupResult({ type: 'error', message: `备份失败：${result.error || '未知错误'}` });
        }
      } else {
        setBackupResult({ type: 'error', message: '备份功能不可用' });
      }
    } catch (e: any) {
      setBackupResult({ type: 'error', message: `备份出错：${e.message || '未知错误'}` });
    } finally {
      setIsBackingUp(false);
      setTimeout(() => setBackupResult(null), 5000);
    }
  };
  // 恢复数据
  const handleRestore = async () => {
    setIsRestoring(true);
    setBackupResult(null);
    try {
      const api = (window as any).electronAPI;
      if (api?.backup?.restore) {
        const result = await api.backup.restore();
        if (result.success) {
          setBackupResult({ type: 'success', message: '数据恢复成功！建议重启应用以确保数据完全加载。' });
        } else {
          setBackupResult({ type: 'error', message: `恢复失败：${result.error || '未知错误'}` });
        }
      } else {
        setBackupResult({ type: 'error', message: '恢复功能不可用' });
      }
    } catch (e: any) {
      setBackupResult({ type: 'error', message: `恢复出错：${e.message || '未知错误'}` });
    } finally {
      setIsRestoring(false);
      setTimeout(() => setBackupResult(null), 8000);
    }
  };
  // 格式化时间
  const formatTime = (isoStr: string) => {
    try {
      const d = new Date(isoStr);
      return d.toLocaleString('zh-CN', {
        year: 'numeric', month: '2-digit', day: '2-digit',
        hour: '2-digit', minute: '2-digit', second: '2-digit',
      });
    } catch {
      return isoStr;
    }
  };

  return (
    <div style={{
      backgroundColor: 'var(--bg-secondary)',
      borderRadius: 'var(--radius-lg)',
      padding: 24,
      borderTop: '1px solid rgba(255,255,255,0.06)',
      borderLeft: '1px solid rgba(0,0,0,0.06)',
      borderRight: '1px solid rgba(0,0,0,0.12)',
      borderBottom: '2px solid rgba(0,0,0,0.15)',
      boxShadow: '0 4px 0 0 rgba(0,0,0,0.08), 1px 4px 0 0 rgba(0,0,0,0.04), -1px 4px 0 0 rgba(0,0,0,0.04), inset 0 1px 0 rgba(255,255,255,0.04)',
    }}>
      <h3 style={{ fontSize: 16, fontWeight: 600, color: 'var(--text-primary)', marginBottom: 20 }}>
        备份设置
      </h3>
      {/* 自动备份开关 */}
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 20 }}>
        <div>
          <div style={{ fontSize: 14, fontWeight: 500, color: 'var(--text-primary)' }}>自动备份</div>
          <div style={{ fontSize: 13, color: 'var(--text-secondary)', marginTop: 2 }}>定期自动备份你的数据</div>
        </div>
        <Switch
          checked={settings.autoBackup}
          onChange={() => onSave({ autoBackup: !settings.autoBackup })}
        />
      </div>
      {/* 自动备份间隔 */}
      {settings.autoBackup && (
        <div style={{ marginBottom: 20 }}>
          <label style={{ fontSize: 14, fontWeight: 500, color: 'var(--text-primary)' }}>备份间隔</label>
          <Select
            value={settings.autoBackupInterval}
            onChange={(value) => onSave({ autoBackupInterval: value })}
            style={{ width: '100%' }}
            options={[
              { value: 15, label: '每 15 分钟' },
              { value: 30, label: '每 30 分钟' },
              { value: 60, label: '每 1 小时' },
              { value: 120, label: '每 2 小时' },
              { value: 360, label: '每 6 小时' },
            ]}
          />
        </div>
      )}
      {/* 自动备份倒计时 */}
      {settings.autoBackup && countdown !== null && (
        <div style={{
          display: 'flex',
          alignItems: 'center',
          gap: 8,
          padding: '10px 14px',
          borderRadius: 'var(--radius-md)',
          backgroundColor: 'var(--bg-tertiary)',
          marginBottom: 20,
        }}>
          <Clock size={14} color="var(--text-secondary)" />
          <span style={{ fontSize: 13, color: 'var(--text-secondary)' }}>
            距离下次自动备份还有 <strong style={{ color: 'var(--primary-color)' }}>{countdown}</strong> 分钟
          </span>
        </div>
      )}
      {/* 上次备份时间 */}
      <Descriptions
        bordered
        size="small"
        column={1}
        style={{ marginBottom: 20 }}
        labelStyle={{ color: 'var(--text-secondary)', fontSize: 13, minWidth: 120 }}
        contentStyle={{ fontSize: 13 }}
      >
        <Descriptions.Item label="上次备份时间">
          {lastBackupTime
            ? formatTime(lastBackupTime)
            : <span style={{ color: 'var(--text-tertiary)' }}>暂无备份记录</span>
          }
        </Descriptions.Item>
        <Descriptions.Item label="备份路径">
          <span
            onClick={async () => {
              try {
                const electronAPI = (window as any).electronAPI;
                if (electronAPI?.dialog?.showOpenDialog) {
                  const result = await electronAPI.dialog.showOpenDialog({
                    title: '选择备份目录',
                    properties: ['openDirectory', 'createDirectory'],
                  });
                  if (result && !result.canceled && result.filePaths && result.filePaths.length > 0) {
                    const selectedPath = result.filePaths[0];
                    setBackupPath(selectedPath);
                    await onSave({ backupPath: selectedPath });
                  }
                } else {
                  const input = prompt('请输入备份路径：', backupPath);
                  if (input && input.trim()) {
                    setBackupPath(input.trim());
                    await onSave({ backupPath: input.trim() });
                  }
                }
              } catch {
                // 静默处理
              }
            }}
            style={{ color: 'var(--primary-color)', fontWeight: 500, cursor: 'pointer' }}
          >
            {backupPath}
            <span style={{ fontSize: 11, color: 'var(--text-tertiary)', marginLeft: 8 }}>点击修改</span>
          </span>
        </Descriptions.Item>
      </Descriptions>

      {/* 备份结果提示 */}
      {backupResult && (
        <Alert
          type={backupResult.type as 'success' | 'error'}
          message={backupResult.message}
          showIcon
          closable
          style={{ marginBottom: 16 }}
        />
      )}
      {/* 手动备份和恢复按钮 */}
      <div style={{ display: 'flex', gap: 12 }}>
        <Button
          onClick={handleManualBackup}
          disabled={isBackingUp}
          loading={isBackingUp}
          icon={<Download size={16} />}
          block
        >
          {isBackingUp ? '备份中...' : '手动备份'}
        </Button>

        <Popconfirm
          title="确定要恢复数据吗？"
          description="此操作将覆盖当前所有数据，且不可撤销。建议先手动备份当前数据。"
          okText="恢复数据"
          cancelText="取消"
          okButtonProps={{ danger: true }}
        >
        <Button
          disabled={isRestoring}
          loading={isRestoring}
          danger
          icon={<Upload size={16} />}
          block
        >
          {isRestoring ? '恢复中...' : '恢复数据'}
        </Button>
        </Popconfirm>
      </div>
    </div>
  );
};

const EXPORT_CONTENT_OPTIONS = [
  { label: '标题', value: 'title' },
  { label: '内容', value: 'content' },
  { label: '标签', value: 'tags' },
  { label: '优先级评分', value: 'priority' },
  { label: 'Emoji 反应', value: 'emoji' },
  { label: '创建/更新时间', value: 'timestamps' },
  { label: '媒体文件', value: 'media' },
  { label: '关联关系', value: 'links' },
];

const ExportSettings: React.FC<{
  settings: AppSettings;
  onSave: (s: Partial<AppSettings>) => Promise<void>;
}> = ({ settings, onSave }) => {
  const includedFields = settings.exportIncludedFields || ['title', 'content', 'tags', 'timestamps'];
  const [exporting, setExporting] = useState<string | null>(null);
  const { creativities } = useCreativityStore();
  const { showToast } = useUIStore();

  const exportFormats = [
    { id: 'json', label: 'JSON', icon: FileJson, color: '#F59E0B' },
    { id: 'markdown', label: 'Markdown', icon: FileText, color: '#10B981' },
    { id: 'html', label: 'HTML', icon: Globe, color: '#3B82F6' },
  ];

  const filterFields = (data: any[]): any[] => {
    return data.map((item: any) => {
      const output: any = {};
      if (includedFields.includes('title')) output.title = item.title;
      if (includedFields.includes('content')) output.content = item.content;
      if (includedFields.includes('tags')) output.tags = item.tags;
      if (includedFields.includes('priority')) output.priority = item.priority;
      if (includedFields.includes('emoji')) output.emojiReactions = item.emojiReactions;
      if (includedFields.includes('timestamps')) {
        output.createdAt = item.createdAt;
        output.updatedAt = item.updatedAt;
      }
      if (includedFields.includes('media')) output.media = item.media;
      if (includedFields.includes('links')) output.links = item.links;
      if (!output.title && !output.content) {
        output.title = item.title;
        output.content = item.content;
      }
      return output;
    });
  };

  const handleExport = async (format: string) => {
    if (includedFields.length === 0) {
      showToast('warning', '请至少选择一项导出内容');
      return;
    }
    setExporting(format);
    try {
      const data: any[] = await api.creativity.listAll() || creativities as unknown as any[];
      if (data.length === 0) {
        showToast('warning', '没有可导出的创意');
        setExporting(null);
        return;
      }
      const filtered = filterFields(data);
      const timestamp = new Date().toISOString().slice(0, 10);
      switch (format) {
        case 'json': exportToJson(filtered, `脑洞集导出_${timestamp}.json`); break;
        case 'markdown': exportToMarkdown(filtered, `脑洞集导出_${timestamp}.md`); break;
        case 'html': exportToHtml(filtered, `脑洞集导出_${timestamp}.html`); break;
      }
      showToast('success', '导出成功');
    } catch (error) {
      console.error('导出失败:', error);
      useUIStore.getState().showNotification('error', '导出失败', '请检查文件权限或磁盘空间');
    } finally {
      setExporting(null);
    }
  };

  return (
    <div style={{
      backgroundColor: 'var(--bg-secondary)',
      borderRadius: 'var(--radius-lg)',
      padding: 24,
      borderTop: '1px solid rgba(255,255,255,0.06)',
      borderLeft: '1px solid rgba(0,0,0,0.06)',
      borderRight: '1px solid rgba(0,0,0,0.12)',
      borderBottom: '2px solid rgba(0,0,0,0.15)',
      boxShadow: '0 4px 0 0 rgba(0,0,0,0.08), 1px 4px 0 0 rgba(0,0,0,0.04), -1px 4px 0 0 rgba(0,0,0,0.04), inset 0 1px 0 rgba(255,255,255,0.04)',
    }}>
      <h3 style={{ fontSize: 16, fontWeight: 600, color: 'var(--text-primary)', marginBottom: 20 }}>
        导出设置
      </h3>

      <div style={{ marginBottom: 24 }}>
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 12 }}>
          <div>
            <div style={{ fontSize: 14, fontWeight: 500, color: 'var(--text-primary)' }}>导出内容</div>
            <div style={{ fontSize: 13, color: 'var(--text-secondary)', marginTop: 2 }}>选择导出创意时包含哪些字段</div>
          </div>
          <Checkbox
            indeterminate={includedFields.length > 0 && includedFields.length < EXPORT_CONTENT_OPTIONS.length}
            checked={includedFields.length === EXPORT_CONTENT_OPTIONS.length}
            onChange={(e) => onSave({ exportIncludedFields: e.target.checked ? EXPORT_CONTENT_OPTIONS.map(o => o.value) : [] })}
          >
            全选
          </Checkbox>
        </div>
        <Checkbox.Group
          options={EXPORT_CONTENT_OPTIONS}
          value={includedFields}
          onChange={(values) => onSave({ exportIncludedFields: values as string[] })}
          style={{ display: 'flex', flexWrap: 'wrap', gap: '8px 16px' }}
        />
      </div>

      <div style={{
        borderTop: '1px solid var(--border-light)',
        paddingTop: 20,
        marginBottom: 16,
      }}>
        <div style={{ fontSize: 14, fontWeight: 600, color: 'var(--text-primary)', marginBottom: 12 }}>
          立即导出
        </div>
        <div style={{ display: 'flex', gap: 12 }}>
          {exportFormats.map((format) => (
            <button
              key={format.id}
              onClick={() => handleExport(format.id)}
              disabled={exporting !== null}
              style={{
                display: 'flex', alignItems: 'center', gap: 8,
                padding: '10px 20px',
                borderRadius: 'var(--radius-md)',
                border: '1px solid var(--border-color)',
                backgroundColor: exporting === format.id ? 'var(--primary-bg)' : 'var(--bg-primary)',
                color: exporting === format.id ? 'var(--primary-color)' : 'var(--text-primary)',
                fontSize: 13, fontWeight: 500,
                cursor: exporting !== null ? 'not-allowed' : 'pointer',
                opacity: exporting !== null && exporting !== format.id ? 0.5 : 1,
                transition: 'all 0.15s ease',
              }}
              onMouseEnter={(e) => {
                if (exporting === null) {
                  (e.currentTarget as HTMLElement).style.borderColor = 'var(--primary-color)';
                  (e.currentTarget as HTMLElement).style.color = 'var(--primary-color)';
                }
              }}
              onMouseLeave={(e) => {
                (e.currentTarget as HTMLElement).style.borderColor = 'var(--border-color)';
                (e.currentTarget as HTMLElement).style.color = 'var(--text-primary)';
              }}
            >
              {exporting === format.id ? (
                <motion.div
                  animate={{ rotate: 360 }}
                  transition={{ duration: 1, repeat: Infinity, ease: 'linear' }}
                  style={{ width: 14, height: 14, border: '2px solid var(--primary-bg)', borderTopColor: 'var(--primary-color)', borderRadius: '50%' }}
                />
              ) : (
                <format.icon size={14} color={format.color} />
              )}
              {format.label}
            </button>
          ))}
        </div>
      </div>
    </div>
  );
};

// 隐私设置（含密码强度校验 + SHA-256 哈希存储）
const PrivacySettings: React.FC<{
  settings: AppSettings;
  onSave: (s: Partial<AppSettings>) => Promise<void>;
}> = ({ settings, onSave }) => {
  const [form] = Form.useForm();
  const [passwordValue, setPasswordValue] = useState('');

  const handleToggleLock = async () => {
    if (!settings.privacyLock) {
      try {
        const values = await form.validateFields();
        const hashedPassword = await hashPassword(values.password);
        await onSave({
          privacyLock: true,
          privacyPassword: hashedPassword,
        });
        form.resetFields();
      } catch { /* Form.Item 自动显示验证错误 */ }
    } else {
      await onSave({
        privacyLock: false,
        privacyPassword: null,
      });
    }
  };

  const strength = getPasswordStrength(passwordValue);

  return (
    <div style={{
      backgroundColor: 'var(--bg-secondary)',
      borderRadius: 'var(--radius-lg)',
      padding: 24,
      borderTop: '1px solid rgba(255,255,255,0.06)',
      borderLeft: '1px solid rgba(0,0,0,0.06)',
      borderRight: '1px solid rgba(0,0,0,0.12)',
      borderBottom: '2px solid rgba(0,0,0,0.15)',
      boxShadow: '0 4px 0 0 rgba(0,0,0,0.08), 1px 4px 0 0 rgba(0,0,0,0.04), -1px 4px 0 0 rgba(0,0,0,0.04), inset 0 1px 0 rgba(255,255,255,0.04)',
    }}>
      <h3 style={{ fontSize: 16, fontWeight: 600, color: 'var(--text-primary)', marginBottom: 20 }}>
        隐私锁
      </h3>

      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 20 }}>
        <div>
          <div style={{ fontSize: 14, fontWeight: 500, color: 'var(--text-primary)' }}>启用隐私锁</div>
          <div style={{ fontSize: 13, color: 'var(--text-secondary)', marginTop: 2 }}>启动应用时需要输入密码</div>
        </div>
        <Switch
          checked={settings.privacyLock}
          onChange={handleToggleLock}
        />
      </div>

      {settings.privacyLock && (
        <>
            <div style={{ fontSize: 14, fontWeight: 600, color: 'var(--text-primary)', marginBottom: 12 }}>锁定行为</div>
            <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
              <Checkbox
                checked={settings.privacyLockOnStartup}
                onChange={(e) => onSave({ privacyLockOnStartup: e.target.checked })}
              >
                应用启动时锁定              </Checkbox>
              <Checkbox
                checked={settings.privacyLockOnMinimize}
                onChange={(e) => onSave({ privacyLockOnMinimize: e.target.checked })}
              >
                窗口最小化后自动锁定
              </Checkbox>
              <div>
                <Checkbox
                  checked={settings.privacyAutoLockMinutes !== null}
                  onChange={(e) => onSave({ privacyAutoLockMinutes: e.target.checked ? 5 : null })}
                >
                  闲置后自动锁定
                </Checkbox>
                {settings.privacyAutoLockMinutes !== null && (
                  <InputNumber
                    min={1}
                    max={120}
                    value={settings.privacyAutoLockMinutes}
                    addonAfter="分钟"
                    size="small"
                    style={{ marginLeft: 24, width: 140 }}
                  />
                )}
              </div>
            </div>

            <div style={{ fontSize: 14, fontWeight: 600, color: 'var(--text-primary)', marginBottom: 12 }}>安全选项</div>
            <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
              <div>
                <Checkbox
                  checked={settings.privacyMaxAttempts > 0}
                  onChange={(e) => onSave({ privacyMaxAttempts: e.target.checked ? 5 : 0 })}
                >
                  密码错误多次后临时锁定
                </Checkbox>
                {settings.privacyMaxAttempts > 0 && (
                  <div style={{ marginLeft: 24, display: 'flex', alignItems: 'center', gap: 4, marginTop: 4 }}>
                    <span style={{ fontSize: 13, color: 'var(--text-secondary)' }}>错误</span>
                    <InputNumber
                      min={1}
                      max={20}
                      value={settings.privacyMaxAttempts}
                      onChange={(val) => onSave({ privacyMaxAttempts: val ?? 5 })}
                      size="small"
                      style={{ width: 60 }}
                    />
                    <span style={{ fontSize: 13, color: 'var(--text-secondary)' }}>次后锁定</span>
                    <InputNumber
                      min={1}
                      max={120}
                      value={settings.privacyLockoutMinutes}
                      onChange={(val) => onSave({ privacyLockoutMinutes: val ?? 30 })}
                      size="small"
                      addonAfter="分钟"
                    />
                  </div>
                )}
              </div>
              <div>
                <Checkbox
                  checked={settings.privacyShowHint}
                  onChange={(e) => onSave({ privacyShowHint: e.target.checked })}
                >
                  显示密码提示
                </Checkbox>
                {settings.privacyShowHint && (
                  <Input
                    placeholder="输入密码提示文字"
                    value={settings.privacyHint || ''}
                    onChange={(e) => onSave({ privacyHint: e.target.value })}
                    size="small"
                    style={{ marginLeft: 24, marginTop: 6, width: 240 }}
                  />
                )}
              </div>
            </div>
        </>
      )}

      {!settings.privacyLock && (
        <Form form={form} layout="vertical" style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
          <Form.Item
            label="设置密码"
            name="password"
            rules={[
              { required: true, message: '请设置密码' },
              { min: 4, message: '密码过短，至少需要 4 位' },
            ]}
            extra={strength && passwordValue.length > 0 ? (
              <span style={{ color: strength.color }}>{strength.label}</span>
            ) : undefined}
          >
            <Input.Password
              placeholder="请输入密码（至少 4 位）"
              onChange={(e) => setPasswordValue(e.target.value)}
            />
          </Form.Item>
          <Form.Item
            label="确认密码"
            name="confirmPassword"
            dependencies={['password']}
            rules={[
              { required: true, message: '请确认密码' },
              ({ getFieldValue }) => ({
                validator(_, value) {
                  if (!value || getFieldValue('password') === value) {
                    return Promise.resolve();
                  }
                  return Promise.reject(new Error('两次密码不一致'));
                },
              }),
            ]}
          >
            <Input.Password placeholder="请再次输入密码" />
          </Form.Item>
        </Form>
      )}
      {/* 天气隐私设置 */}
      <WeatherPrivacySettings />
    </div>
  );
};
/** 天气隐私设置 */
const WeatherPrivacySettings: React.FC = () => {
  const [privacy, setPrivacy] = useState(() => getWeatherPrivacy());

  const handleToggle = (checked: boolean) => {
    const newSettings = { showLocationName: checked };
    saveWeatherPrivacy(newSettings);
    setPrivacy(newSettings);
  };

  return (
    <div style={{ marginTop: 24, paddingTop: 24, borderTop: '1px solid rgba(0,0,0,0.06)' }}>
      <h3 style={{ fontSize: 14, fontWeight: 600, color: 'var(--text-primary)', marginBottom: 12 }}>
        天气隐私
      </h3>
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
        <div>
          <div style={{ fontSize: 14, fontWeight: 500, color: 'var(--text-primary)' }}>显示定位地区名</div>
          <div style={{ fontSize: 13, color: 'var(--text-secondary)', marginTop: 2 }}>自动定位时，在首页天气显示具体地区名称</div>
        </div>
        <Switch
          checked={privacy.showLocationName}
          onChange={handleToggle}
        />
      </div>
    </div>
  );
};
/** 云账号设置 */
const CloudAccountSettings: React.FC = () => {
  const { user, isAuthenticated, signOut } = useAuth();
  const { modal } = AntdApp.useApp();
  const navigate = useNavigate();
  const [syncStatus, setSyncStatus] = useState<any>(null);

  useEffect(() => {
    if (window.electronAPI?.auth) {
      window.electronAPI.auth.getSyncStatus().then(setSyncStatus);
    }
  }, [isAuthenticated]);

  const handleSignOut = () => {
    modal.confirm({
      title: '退出云账号',
      content: '退出后本地数据不会被删除，但将停止云端同步。确定要退出吗？',
      okText: '确定退出',
      cancelText: '取消',
      okButtonProps: { danger: true },
      onOk: async () => {
        await signOut();
      },
    });
  };

  return (
    <div style={{
      backgroundColor: 'var(--bg-secondary)',
      borderRadius: 'var(--radius-lg)',
      padding: 24,
      borderTop: '1px solid rgba(255,255,255,0.06)',
      borderLeft: '1px solid rgba(0,0,0,0.06)',
      borderRight: '1px solid rgba(0,0,0,0.12)',
      borderBottom: '2px solid rgba(0,0,0,0.15)',
    }}>
      <h3 style={{ fontSize: 15, fontWeight: 600, color: 'var(--text-primary)', marginBottom: 16, display: 'flex', alignItems: 'center', gap: 8 }}>
        账号与云同步
      </h3>

      {isAuthenticated && user ? (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
            <div style={{
              width: 40, height: 40, borderRadius: '50%',
              background: 'linear-gradient(135deg, #667eea, #764ba2)',
              display: 'flex', alignItems: 'center', justifyContent: 'center',
              color: 'white', fontSize: 18, fontWeight: 600,
            }}>
              {(user.nickname || user.email || '?')[0].toUpperCase()}
            </div>
            <div>
              <div style={{ fontSize: 14, fontWeight: 500, color: 'var(--text-primary)' }}>
                {user.nickname || '用户'}
              </div>
              <div style={{ fontSize: 12, color: 'var(--text-tertiary)' }}>
                {user.email}
              </div>
            </div>
            <span style={{
              marginLeft: 'auto',
              fontSize: 11,
              padding: '2px 8px',
              borderRadius: 10,
              background: 'var(--success-color, #52c41a)',
              color: 'white',
              fontWeight: 500,
            }}>
              已连接
            </span>
          </div>

          {syncStatus?.userId && (
            <div style={{
              fontSize: 12, color: 'var(--text-tertiary)',
              padding: '8px 12px',
              background: 'var(--bg-tertiary)',
              borderRadius: 8,
            }}>
              同步状态：已连接 · 用户 ID {syncStatus.userId.substring(0, 8)}...
            </div>
          )}

          <Button
            onClick={handleSignOut}
            danger
            size="small"
          >
            退出云账号
          </Button>
        </div>
      ) : (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
          <p style={{ fontSize: 13, color: 'var(--text-secondary)', margin: 0 }}>
            登录云账号后，你的创意数据将自动同步到云端，支持多设备访问。
          </p>
          <Button
            type="primary"
            onClick={() => navigate('/login')}
            style={{
              background: 'linear-gradient(135deg, #667eea, #764ba2)',
              border: 'none',
              alignSelf: 'flex-start',
            }}
          >
            登录 / 注册
          </Button>
          {!syncStatus?.configured && (
            <div style={{
              fontSize: 12, color: 'var(--warning-color, #faad14)',
              padding: '8px 12px',
              background: 'rgba(250, 173, 20, 0.08)',
              borderRadius: 8,
            }}>
              注意：数据同步服务未配置，请在 .env 文件中设置 Supabase 环境变量
            </div>
          )}
        </div>
      )}
    </div>
  );
};

export default Settings;

const OnlineMusicSettings: React.FC<{
  settings: any;
  onSave: (s: any) => Promise<void>;
}> = ({ settings, onSave }) => {
  const [cookie, setCookie] = useState('');
  const [isValidating, setIsValidating] = useState(false);
  const [cookieStatus, setCookieStatus] = useState<'unknown' | 'valid' | 'invalid'>('unknown');

  useEffect(() => {
    api.musicOnline.getCookie().then(res => {
      if (res.success && res.data?.cookie) {
        setCookie(res.data.cookie);
        setCookieStatus('valid');
      }
    });
  }, []);

  const handleValidate = async () => {
    if (!cookie.trim()) return;
    setIsValidating(true);
    try {
      const res = await api.musicOnline.checkCookie(cookie.trim());
      setCookieStatus(res.success && res.data?.valid ? 'valid' : 'invalid');
      if (res.success && res.data?.valid) {
        await onSave({ qqMusicCookie: cookie.trim() });
      }
    } catch (e) {
      setCookieStatus('invalid');
    }
    setIsValidating(false);
  };

  const handleSave = async () => {
    if (!cookie.trim()) return;
    await api.musicOnline.setCookie(cookie.trim());
    await onSave({ qqMusicCookie: cookie.trim() });
    setCookieStatus('valid');
  };

  return (
    <div style={{ marginBottom: 16 }}>
      <h3 style={{ fontSize: 15, fontWeight: 600, color: 'var(--text-primary)', marginBottom: 12, display: 'flex', alignItems: 'center', gap: 8 }}>
        在线音乐
      </h3>
      {/* Cookie 输入 */}
      <div style={{ marginBottom: 12 }}>
        <div style={{ fontSize: 13, color: 'var(--text-primary)', marginBottom: 6 }}>音乐平台 Cookie（可选）</div>
        <div style={{ fontSize: 11, color: 'var(--text-tertiary)', marginBottom: 8 }}>
          配置 Cookie 可解锁 VIP 歌曲播放功能。不配置也可搜索和播放免费歌曲。        </div>
        <Input.TextArea
          value={cookie}
          placeholder="在此粘贴音乐平台 Cookie..."
          rows={3}
          style={{ fontFamily: 'monospace', fontSize: 11 }}
        />
      </div>

      {/* 状态 + 操作按钮 */}
      <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 12 }}>
        {cookieStatus === 'valid' && (
          <div style={{ display: 'flex', alignItems: 'center', gap: 4 }}>
            <span style={{ fontSize: 11, color: '#22c55e' }}>Cookie 有效</span>
          </div>
        )}
        {cookieStatus === 'invalid' && (
          <div style={{ display: 'flex', alignItems: 'center', gap: 4 }}>
            <span style={{ fontSize: 11, color: '#ef4444' }}>Cookie 无效</span>
          </div>
        )}
        <Button size="small" onClick={handleValidate} loading={isValidating}>验证</Button>
        <Button size="small" type="primary" onClick={handleSave} disabled={!cookie.trim()}>保存</Button>
      </div>
      {/* 获取 Cookie 引导 */}
      <div style={{ padding: 12, borderRadius: 8, backgroundColor: 'var(--bg-tertiary)', border: '1px solid var(--border-light)' }}>
        <div style={{ fontSize: 12, fontWeight: 500, color: 'var(--text-primary)', marginBottom: 8 }}>如何获取 Cookie？</div>
        <ol style={{ fontSize: 11, color: 'var(--text-tertiary)', lineHeight: 1.8, paddingLeft: 16, margin: 0 }}>
          <li>打开浏览器，访问 <a href="https://y.qq.com" target="_blank" rel="noopener" style={{ color: 'var(--primary-color)' }}>y.qq.com</a> 并登录</li>
          <li>按 <kbd style={{ padding: '1px 4px', borderRadius: 3, backgroundColor: 'var(--bg-secondary)', fontSize: 10 }}>F12</kbd> 打开开发者工具</li>
          <li>切换到 Network（网络）标签</li>
          <li>刷新页面，点击任意请求</li>
          <li>在请求头中找到 Cookie 字段，复制完整值</li>
          <li>粘贴到上方输入框并点击保存</li>
        </ol>
      </div>
    </div>
  );
};

