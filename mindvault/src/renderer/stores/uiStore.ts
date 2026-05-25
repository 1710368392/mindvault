import { create } from 'zustand';
import type { AppSettings } from '@shared/types';
import { DEFAULT_SETTINGS } from '@shared/constants';
import { notification, message } from 'antd';
import type { MessageInstance, NotificationInstance } from 'antd/es/message/interface';
import type { HookAPI as ModalHookAPI } from 'antd/es/modal/confirm';

const SIDEBAR_OPEN_KEY = 'mindvault:sidebarOpen';
const SEARCH_VIEW_MODE_KEY = 'mindvault:searchViewMode';

/** 从 localStorage 读取侧边栏状态 */
function loadSidebarOpen(): boolean {
  try {
    const stored = localStorage.getItem(SIDEBAR_OPEN_KEY);
    if (stored !== null) return stored === 'true';
  } catch { /* ignore */ }
  return true;
}

/** 持久化侧边栏状态到 localStorage */
function persistSidebarOpen(open: boolean): void {
  try {
    localStorage.setItem(SIDEBAR_OPEN_KEY, String(open));
  } catch { /* ignore */ }
}

function loadSearchViewMode(): 'list' | 'masonry' {
  try {
    const stored = localStorage.getItem(SEARCH_VIEW_MODE_KEY);
    if (stored === 'list' || stored === 'masonry') return stored;
  } catch { /* ignore */ }
  return 'masonry';
}

function persistSearchViewMode(mode: 'list' | 'masonry'): void {
  try {
    localStorage.setItem(SEARCH_VIEW_MODE_KEY, mode);
  } catch { /* ignore */ }
}

interface UIState {
  // 主题
  theme: AppSettings['theme'];
  setTheme: (theme: AppSettings['theme']) => void;

  // 侧边栏
  sidebarOpen: boolean;
  toggleSidebar: () => void;
  setSidebarOpen: (open: boolean) => void;

  // 搜索页视图模式
  searchViewMode: 'list' | 'masonry';
  setSearchViewMode: (mode: 'list' | 'masonry') => void;

  // 快速录入弹窗
  quickCaptureOpen: boolean;
  setQuickCaptureOpen: (open: boolean) => void;
  toggleQuickCapture: () => void;

  // 快捷键指南弹窗
  shortcutGuideOpen: boolean;
  setShortcutGuideOpen: (open: boolean) => void;

  // 快速设置抽屉
  quickSettingsOpen: boolean;
  setQuickSettingsOpen: (open: boolean) => void;
  toggleQuickSettings: () => void;

  // 搜索弹窗
  searchDialogOpen: boolean;
  setSearchDialogOpen: (open: boolean) => void;

  // 关于弹窗
  aboutDialogOpen: boolean;
  setAboutDialogOpen: (open: boolean) => void;

  showToast: (type: 'success' | 'error' | 'warning' | 'info', message: string) => void;
  showNotification: (type: 'success' | 'error' | 'warning' | 'info', message: string, description?: string, duration?: number) => void;

  _antdMessage: MessageInstance | null;
  _antdNotification: NotificationInstance | null;
  _antdModal: ModalHookAPI | null;
  setAntdContext: (msg: MessageInstance, notify: NotificationInstance, modal: ModalHookAPI) => void;

  // 模板选择
  selectedTemplate: any | null;
  setSelectedTemplate: (template: any | null) => void;

  // 拖拽待处理文件
  pendingFiles: File[];
  setPendingFiles: (files: File[]) => void;
  clearPendingFiles: () => void;

  // 待关联的媒体ID（新建创意时暂存）
  pendingMediaIds: string[];
  addPendingMediaId: (id: string) => void;
  clearPendingMediaIds: () => void;

  // 批量导入进度
  batchImportProgress: { visible: boolean; current: number; total: number; fileName: string };
  setBatchImportProgress: (progress: { visible: boolean; current: number; total: number; fileName: string }) => void;

  // 自定义拖拽状态（跨页面拖拽创意项）
  isDraggingItem: boolean;
  dragItem: { id: string; title: string; type: string } | null;
  dragPosition: { x: number; y: number } | null;
  dragOverTarget: string | null;
  dragEnded: boolean;
  startDrag: (item: { id: string; title: string; type: string }, position: { x: number; y: number }) => void;
  updateDragPosition: (position: { x: number; y: number }) => void;
  setDragOverTarget: (target: string | null) => void;
  endDrag: () => void;

  // 编辑器浮动窗口
  editorWindows: Array<{
    id: string;
    creativity: any | null; // null = 新建
  }>;
  openEditor: (creativity?: any) => void;
  closeEditor: (id: string) => void;

  // 分离的看板窗口
  detachedBoardWindows: Array<{
    id: string;
    boardId?: string;
  }>;
  openDetachedBoard: (boardId?: string) => void;
  closeDetachedBoard: (id: string) => void;

  // 专注模式
  focusMode: boolean;
  setFocusMode: (focus: boolean) => void;
  toggleFocusMode: () => void;

  // 锁屏
  isLocked: boolean;
  lockScreen: () => void;
  unlockScreen: () => void;

  // AI 助手面板状态
  aiPanelMode: 'closed' | 'mini' | 'fullscreen';
  setAiPanelMode: (mode: 'closed' | 'mini' | 'fullscreen') => void;
  openAiMini: () => void;
  openAiFullscreen: () => void;
  closeAiPanel: () => void;

  // AI 悬浮球位置
  aiBallPosition: { x: number; y: number };
  setAiBallPosition: (pos: { x: number; y: number }) => void;
}

export const useUIStore = create<UIState>((set) => ({
  // 主题
  theme: DEFAULT_SETTINGS.theme,
  setTheme: (theme) => set({ theme }),

  // 侧边栏（从 localStorage 恢复初始状态）
  sidebarOpen: loadSidebarOpen(),
  toggleSidebar: () => set((s) => {
    const next = !s.sidebarOpen;
    persistSidebarOpen(next);
    return { sidebarOpen: next };
  }),
  setSidebarOpen: (open) => {
    persistSidebarOpen(open);
    set({ sidebarOpen: open });
  },

  searchViewMode: loadSearchViewMode(),
  setSearchViewMode: (mode) => {
    persistSearchViewMode(mode);
    set({ searchViewMode: mode });
  },

  // 快速录入弹窗
  quickCaptureOpen: false,
  setQuickCaptureOpen: (open) => set({ quickCaptureOpen: open }),
  toggleQuickCapture: () => set((s) => ({ quickCaptureOpen: !s.quickCaptureOpen })),

  // 快捷键指南弹窗
  shortcutGuideOpen: false,
  setShortcutGuideOpen: (open) => set({ shortcutGuideOpen: open }),

  quickSettingsOpen: false,
  setQuickSettingsOpen: (open) => set({ quickSettingsOpen: open }),
  toggleQuickSettings: () => set((s) => ({ quickSettingsOpen: !s.quickSettingsOpen })),

  // 搜索弹窗
  searchDialogOpen: false,
  setSearchDialogOpen: (open) => set({ searchDialogOpen: open }),

  // 关于弹窗
  aboutDialogOpen: false,
  setAboutDialogOpen: (open) => set({ aboutDialogOpen: open }),

  showToast: (type, msg) => {
    const instance = useUIStore.getState()._antdMessage;
    if (instance) {
      instance[type](msg, 3);
    } else {
      message[type](msg, 3);
    }
  },

  showNotification: (type, msg, description, duration) => {
    const instance = useUIStore.getState()._antdNotification;
    if (instance) {
      instance[type]({
        message: msg,
        description,
        duration: duration ?? (type === 'error' ? 6 : 4.5),
        placement: 'topRight',
      });
    } else {
      notification[type]({
        message: msg,
        description,
        duration: duration ?? (type === 'error' ? 6 : 4.5),
        placement: 'topRight',
      });
    }
  },

  _antdMessage: null,
  _antdNotification: null,
  _antdModal: null,
  setAntdContext: (msg, notify, modal) => set({ _antdMessage: msg, _antdNotification: notify, _antdModal: modal }),

  // 模板选择
  selectedTemplate: null,
  setSelectedTemplate: (template) => set({ selectedTemplate: template }),

  // 拖拽待处理文件
  pendingFiles: [],
  setPendingFiles: (files) => set({ pendingFiles: files }),
  clearPendingFiles: () => set({ pendingFiles: [] }),
  pendingMediaIds: [],
  addPendingMediaId: (id) => set((s) => ({ pendingMediaIds: [...s.pendingMediaIds, id] })),
  clearPendingMediaIds: () => set({ pendingMediaIds: [] }),

  batchImportProgress: { visible: false, current: 0, total: 0, fileName: '' },
  setBatchImportProgress: (progress) => set({ batchImportProgress: progress }),

  // 自定义拖拽状态
  isDraggingItem: false,
  dragItem: null,
  dragPosition: null,
  dragOverTarget: null,
  dragEnded: false, // 防止多次触发
  startDrag: (item, position) => set({ isDraggingItem: true, dragItem: item, dragPosition: position, dragOverTarget: null, dragEnded: false }),
  updateDragPosition: (position) => set({ dragPosition: position }),
  setDragOverTarget: (target) => set({ dragOverTarget: target }),
  endDrag: () => set((s) => {
    if (s.dragEnded) return {};
    return { isDraggingItem: false, dragItem: null, dragPosition: null, dragOverTarget: null, dragEnded: true };
  }),

  // 编辑器浮动窗口
  editorWindows: [],
  openEditor: (creativity) => {
    const id = `editor-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
    set((s) => ({
      editorWindows: [...s.editorWindows, { id, creativity: creativity || null }],
    }));
  },
  closeEditor: (id) =>
    set((s) => ({
      editorWindows: s.editorWindows.filter((w) => w.id !== id),
    })),

  // 分离的看板窗口
  detachedBoardWindows: [],
  openDetachedBoard: (boardId) => {
    const id = `detached-board-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
    set((s) => ({
      detachedBoardWindows: [...s.detachedBoardWindows, { id, boardId }],
    }));
  },
  closeDetachedBoard: (id) =>
    set((s) => ({
      detachedBoardWindows: s.detachedBoardWindows.filter((w) => w.id !== id),
    })),

  // 专注模式
  focusMode: false,
  setFocusMode: (focus) => set({ focusMode: focus }),
  toggleFocusMode: () => set((s) => ({ focusMode: !s.focusMode })),

  isLocked: false,
  lockScreen: () => set({ isLocked: true }),
  unlockScreen: () => set({ isLocked: false }),

  aiPanelMode: 'closed',
  setAiPanelMode: (mode) => set({ aiPanelMode: mode }),
  openAiMini: () => set({ aiPanelMode: 'mini' }),
  openAiFullscreen: () => set({ aiPanelMode: 'fullscreen' }),
  closeAiPanel: () => set({ aiPanelMode: 'closed' }),

  aiBallPosition: { x: window.innerWidth - 70, y: window.innerHeight / 2 },
  setAiBallPosition: (pos) => set({ aiBallPosition: pos }),
}));
