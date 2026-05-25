import React, { useState, useRef, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { Palette, Check } from 'lucide-react';
import type { AppSettings } from '@shared/types';
import { THEME_OPTIONS, MORANDI_COLORS } from '@shared/constants';

// ===== 类型定义 =====

interface ThemeSwitcherProps {
  currentTheme: AppSettings['theme'];
  onThemeChange: (theme: AppSettings['theme']) => void;
}

// ===== 主题预览色块 =====

const THEME_PREVIEWS: Record<string, { bg: string; primary: string; surface: string }> = {
  light: { bg: '#f8f9fa', primary: '#6C63FF', surface: '#ffffff' },
  dark: { bg: '#1a1a2e', primary: '#8B85FF', surface: '#232340' },
  'morandi-warm': { bg: MORANDI_COLORS.warm.bg, primary: MORANDI_COLORS.warm.primary, surface: MORANDI_COLORS.warm.surface },
  'morandi-cool': { bg: MORANDI_COLORS.cool.bg, primary: MORANDI_COLORS.cool.primary, surface: MORANDI_COLORS.cool.surface },
  'morandi-nature': { bg: MORANDI_COLORS.nature.bg, primary: MORANDI_COLORS.nature.primary, surface: MORANDI_COLORS.nature.surface },
  custom: { bg: '#f0f0f0', primary: '#999', surface: '#fff' },
};

// ===== 组件 =====

const ThemeSwitcher: React.FC<ThemeSwitcherProps> = ({
  currentTheme,
  onThemeChange,
}) => {
  const [isOpen, setIsOpen] = useState(false);
  const containerRef = useRef<HTMLDivElement>(null);

  // 点击外部关闭
  useEffect(() => {
    const handleClick = (e: MouseEvent) => {
      if (containerRef.current && !containerRef.current.contains(e.target as Node)) {
        setIsOpen(false);
      }
    };
    if (isOpen) {
      document.addEventListener('mousedown', handleClick);
    }
    return () => document.removeEventListener('mousedown', handleClick);
  }, [isOpen]);

  const currentLabel = THEME_OPTIONS.find((t) => t.value === currentTheme)?.label || '主题';

  return (
    <div ref={containerRef} className="relative">
      {/* 触发按钮 */}
      <button
        onClick={() => setIsOpen(!isOpen)}
        className="flex items-center gap-2 px-3 py-1.5 rounded-lg hover:bg-[var(--bg-hover)] transition-colors text-[var(--text-secondary)]"
      >
        <Palette size={16} />
        <span className="text-sm">{currentLabel}</span>
      </button>

      {/* 下拉面板 */}
      <AnimatePresence>
        {isOpen && (
          <motion.div
            className="absolute top-full right-0 mt-2 w-64 p-3 bg-[var(--bg-secondary)] border border-[var(--border-color)] rounded-xl shadow-lg z-50"
            initial={{ opacity: 0, y: -8, scale: 0.95 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, y: -8, scale: 0.95 }}
            transition={{ duration: 0.15 }}
          >
            <div className="space-y-1.5">
              {THEME_OPTIONS.map((theme) => {
                const preview = THEME_PREVIEWS[theme.value];
                const isActive = currentTheme === theme.value;
                return (
                  <button
                    key={theme.value}
                    onClick={() => {
                      onThemeChange(theme.value);
                      setIsOpen(false);
                    }}
                    className={`w-full flex items-center gap-3 px-3 py-2 rounded-lg transition-colors ${
                      isActive
                        ? 'bg-[var(--primary-bg)]'
                        : 'hover:bg-[var(--bg-hover)]'
                    }`}
                  >
                    {/* 预览色块 */}
                    <div className="relative w-10 h-7 rounded-md overflow-hidden border border-[var(--border-light)] shrink-0">
                      <div
                        className="absolute inset-0"
                        style={{ backgroundColor: preview.bg }}
                      />
                      <div
                        className="absolute bottom-0 left-0 right-0 h-2/3"
                        style={{ backgroundColor: preview.surface }}
                      />
                      <div
                        className="absolute bottom-1 left-1 w-3 h-3 rounded-full"
                        style={{ backgroundColor: preview.primary }}
                      />
                    </div>

                    {/* 标签 */}
                    <span
                      className={`text-sm flex-1 text-left ${
                        isActive
                          ? 'text-[var(--primary-color)] font-medium'
                          : 'text-[var(--text-primary)]'
                      }`}
                    >
                      {theme.label}
                    </span>

                    {/* 选中标记 */}
                    {isActive && (
                      <Check size={16} className="text-[var(--primary-color)]" />
                    )}
                  </button>
                );
              })}
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
};

export default ThemeSwitcher;
