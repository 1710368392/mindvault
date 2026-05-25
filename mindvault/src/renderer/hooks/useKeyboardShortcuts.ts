import { useEffect, useRef } from 'react';
import { useNavigate } from 'react-router-dom';
import { useUIStore } from '../stores/uiStore';
import { useBoardStore } from '../stores/boardStore';

interface ShortcutConfig {
  key: string;
  ctrl?: boolean;
  shift?: boolean;
  alt?: boolean;
  description: string;
  action: () => void;
}

export function useKeyboardShortcuts(shortcuts: ShortcutConfig[]) {
  const shortcutsRef = useRef(shortcuts);
  shortcutsRef.current = shortcuts;

  useEffect(() => {
    const handleKeyDown = (event: KeyboardEvent) => {
      const target = event.target as HTMLElement;
      const isInput = target.tagName === 'INPUT' || target.tagName === 'TEXTAREA' || target.isContentEditable;

      // 遍历所有快捷键，找到第一个匹配的
      for (const shortcut of shortcutsRef.current) {
        const keyMatch = event.key.toLowerCase() === shortcut.key.toLowerCase();
        const ctrlMatch = shortcut.ctrl ? (event.ctrlKey || event.metaKey) : !(event.ctrlKey || event.metaKey);
        const shiftMatch = shortcut.shift ? event.shiftKey : !event.shiftKey;
        const altMatch = shortcut.alt ? event.altKey : !event.altKey;

        if (keyMatch && ctrlMatch && shiftMatch && altMatch) {
          if (isInput && shortcut.key.toLowerCase() !== 'escape') continue;
          event.preventDefault();
          shortcut.action();
          break;
        }
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, []);
}

/** 全局快捷键 - 在 Layout 组件中调用 */
export function useGlobalShortcuts() {
  const navigate = useNavigate();
  const originalToolMode = useRef<'pointer' | 'hand'>('pointer');
  const spacePressTime = useRef<number>(0);
  const isLongPress = useRef<boolean>(false);
  const longPressTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

  // 空格键：单击切换模式，长按临时切换
  useEffect(() => {
    const handleKeyDown = (event: KeyboardEvent) => {
      const target = event.target as HTMLElement;
      const isInput = target.tagName === 'INPUT' || target.tagName === 'TEXTAREA' || target.isContentEditable;
      
      if (event.key === ' ' && !isInput && !event.repeat) {
        event.preventDefault();
        const boardStore = useBoardStore.getState();
        originalToolMode.current = boardStore.canvasToolMode;
        spacePressTime.current = Date.now();
        isLongPress.current = false;

        // 200ms后视为长按，临时切换到抓手模式
        longPressTimer.current = setTimeout(() => {
          isLongPress.current = true;
          boardStore.setCanvasToolMode('hand');
        }, 200);
      }
    };

    const handleKeyUp = (event: KeyboardEvent) => {
      if (event.key === ' ') {
        // 清除长按定时器
        if (longPressTimer.current) {
          clearTimeout(longPressTimer.current);
          longPressTimer.current = null;
        }

        const boardStore = useBoardStore.getState();

        if (isLongPress.current) {
          // 长按松开：恢复原模式
          boardStore.setCanvasToolMode(originalToolMode.current);
        } else {
          // 单击：切换模式
          const newMode = originalToolMode.current === 'pointer' ? 'hand' : 'pointer';
          boardStore.setCanvasToolMode(newMode);
        }
        isLongPress.current = false;
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    window.addEventListener('keyup', handleKeyUp);
    return () => {
      window.removeEventListener('keydown', handleKeyDown);
      window.removeEventListener('keyup', handleKeyUp);
      if (longPressTimer.current) clearTimeout(longPressTimer.current);
    };
  }, []);

  const shortcuts: ShortcutConfig[] = [
    {
      key: 'n',
      ctrl: true,
      shift: true,
      description: '快速录入',
      action: () => useUIStore.getState().setQuickCaptureOpen(true),
    },
    {
      key: 'n',
      ctrl: true,
      description: '新建创意',
      action: () => useUIStore.getState().setQuickCaptureOpen(true),
    },
    {
      key: 'k',
      ctrl: true,
      description: '搜索',
      action: () => {
        useUIStore.getState().setSearchDialogOpen(true);
      },
    },
    {
      key: ',',
      ctrl: true,
      description: '快速设置',
      action: () => useUIStore.getState().toggleQuickSettings(),
    },
    {
      key: '1',
      ctrl: true,
      description: '回到首页',
      action: () => navigate('/'),
    },
    {
      key: 'Escape',
      description: '关闭弹窗',
      action: () => {
        const state = useUIStore.getState();
        if (state.quickCaptureOpen) state.setQuickCaptureOpen(false);
        if (state.shortcutGuideOpen) state.setShortcutGuideOpen(false);
        if (state.searchDialogOpen) state.setSearchDialogOpen(false);
      },
    },
  ];

  useKeyboardShortcuts(shortcuts);
}
