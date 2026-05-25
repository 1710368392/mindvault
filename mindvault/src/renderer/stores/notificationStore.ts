import { create } from 'zustand';

export type NotificationCategory = 'weather' | 'system' | 'update' | 'ai' | 'general';
export type NotificationLevel = 'info' | 'warning' | 'error' | 'success';

export interface AppNotification {
  id: string;
  category: NotificationCategory;
  level: NotificationLevel;
  title: string;
  message: string;
  timestamp: number;
  read: boolean;
  extra?: Record<string, unknown>;
}

interface NotificationState {
  notifications: AppNotification[];
  centerVisible: boolean;
  activeTab: NotificationCategory | 'all';
  highlightNotificationId: string | null;

  addNotification: (input: Omit<AppNotification, 'id' | 'timestamp' | 'read'>) => string;
  markRead: (id: string) => void;
  markAllRead: () => void;
  deleteNotification: (id: string) => void;
  clearAll: () => void;
  setCenterVisible: (visible: boolean) => void;
  setActiveTab: (tab: NotificationCategory | 'all') => void;
  setHighlightNotificationId: (id: string | null) => void;
  openCenterWithHighlight: (id: string, category: NotificationCategory) => void;
}

const STORAGE_KEY = 'mindvault-notifications';
const MAX_RECORDS = 100;

function loadFromStorage(): AppNotification[] {
  try {
    return JSON.parse(localStorage.getItem(STORAGE_KEY) || '[]');
  } catch {
    return [];
  }
}

function saveToStorage(notifications: AppNotification[]) {
  localStorage.setItem(STORAGE_KEY, JSON.stringify(notifications.slice(0, MAX_RECORDS)));
}

export const useNotificationStore = create<NotificationState>((set, get) => ({
  notifications: loadFromStorage(),
  centerVisible: false,
  activeTab: 'all',
  highlightNotificationId: null,

  addNotification: (input) => {
    const id = `${input.category}-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`;
    const notification: AppNotification = {
      ...input,
      id,
      timestamp: Date.now(),
      read: false,
    };
    set(state => {
      const updated = [notification, ...state.notifications].slice(0, MAX_RECORDS);
      saveToStorage(updated);
      return { notifications: updated };
    });
    return id;
  },

  markRead: (id) => {
    set(state => {
      const updated = state.notifications.map(n =>
        n.id === id ? { ...n, read: true } : n
      );
      saveToStorage(updated);
      return { notifications: updated };
    });
  },

  markAllRead: () => {
    set(state => {
      const updated = state.notifications.map(n => ({ ...n, read: true }));
      saveToStorage(updated);
      return { notifications: updated };
    });
  },

  deleteNotification: (id) => {
    set(state => {
      const updated = state.notifications.filter(n => n.id !== id);
      saveToStorage(updated);
      return { notifications: updated };
    });
  },

  clearAll: () => {
    saveToStorage([]);
    set({ notifications: [] });
  },

  setCenterVisible: (visible) => {
    set({ centerVisible: visible });
  },

  setActiveTab: (tab) => {
    set({ activeTab: tab });
  },

  setHighlightNotificationId: (id) => {
    set({ highlightNotificationId: id });
  },

  openCenterWithHighlight: (id, category) => {
    set({ 
      centerVisible: true, 
      activeTab: category, 
      highlightNotificationId: id 
    });
  },
}));
