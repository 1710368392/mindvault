import { create } from 'zustand';
import type { Creativity } from '@shared/types';
import { api } from '../utils/api';
import { playSound } from '../utils/sound';
import { useSettingsStore } from './settingsStore';

interface CreativityState {
  creativities: any[];
  currentCreativity: Creativity | null;
  stats: any;
  isLoading: boolean;
  isSaving: boolean;
  pagination: { page: number; pageSize: number; total: number };

  fetchCreativities: (params?: any) => Promise<void>;
  fetchCreativity: (id: string) => Promise<void>;
  createCreativity: (input: any) => Promise<any | null>;
  updateCreativity: (id: string, data: any) => Promise<boolean>;
  deleteCreativity: (id: string) => Promise<boolean>;
  searchCreativities: (keyword: string) => Promise<any[]>;
  getRandomCreativity: () => Promise<Creativity | null>;
  toggleFavorite: (id: string) => Promise<boolean>;
  fetchStats: () => Promise<void>;
  setCurrentCreativity: (c: Creativity | null) => void;
  clearCurrentCreativity: () => void;
}

export const useCreativityStore = create<CreativityState>((set, get) => ({
  creativities: [],
  currentCreativity: null,
  stats: null,
  isLoading: false,
  isSaving: false,
  pagination: { page: 1, pageSize: 20, total: 0 },

  fetchCreativities: async (params = {}) => {
    set({ isLoading: true });
    try {
      const result = await api.creativity.list(params);
      set({
        creativities: result.data || [],
        pagination: result.pagination || { page: 1, pageSize: 20, total: 0 },
      });
    } catch (error) {
      console.error('获取创意列表失败:', error);
    } finally {
      set({ isLoading: false });
    }
  },

  fetchCreativity: async (id: string) => {
    set({ isLoading: true });
    try {
      const result = await api.creativity.read(id);
      if (result) set({ currentCreativity: result });
    } catch (error) {
      console.error('获取创意详情失败:', error);
    } finally {
      set({ isLoading: false });
    }
  },

  createCreativity: async (input) => {
    set({ isSaving: true });
    try {
      const result = await api.creativity.create(input);
      if (result) {
        const { soundEnabled, soundVolume } = useSettingsStore.getState();
        if (soundEnabled) playSound('save', soundVolume);
        await get().fetchCreativities();
        return result;
      }
      return null;
    } catch (error) {
      console.error('创建创意失败:', error);
      return null;
    } finally {
      set({ isSaving: false });
    }
  },

  updateCreativity: async (id, data) => {
    set({ isSaving: true });
    try {
      const result = await api.creativity.update(id, data);
      if (result) {
        if (get().currentCreativity?.id === id) {
          set({ currentCreativity: result });
        }
        await get().fetchCreativities();
        return true;
      }
      return false;
    } catch (error) {
      console.error('更新创意失败:', error);
      return false;
    } finally {
      set({ isSaving: false });
    }
  },

  deleteCreativity: async (id) => {
    try {
      await api.creativity.delete(id);
      const { soundEnabled, soundVolume } = useSettingsStore.getState();
      if (soundEnabled) playSound('delete', soundVolume);
      await get().fetchCreativities();
      if (get().currentCreativity?.id === id) {
        set({ currentCreativity: null });
      }
      return true;
    } catch (error) {
      console.error('删除创意失败:', error);
      return false;
    }
  },

  searchCreativities: async (keyword) => {
    set({ isLoading: true });
    try {
      const results = await api.creativity.search(keyword);
      set({ creativities: results || [] });
      return results || [];
    } catch (error) {
      console.error('搜索创意失败:', error);
      return [];
    } finally {
      set({ isLoading: false });
    }
  },

  getRandomCreativity: async () => {
    try {
      return await api.creativity.random();
    } catch (error) {
      console.error('获取随机创意失败:', error);
      return null;
    }
  },

  toggleFavorite: async (id) => {
    try {
      const result = await api.creativity.toggleFavorite(id);
      if (result) {
        // 更新本地列表中的收藏状态
        set((state) => ({
          creativities: state.creativities.map((c: any) =>
            c.id === id ? { ...c, isFavorite: result.is_favorite === 1 || result.isFavorite } : c
          ),
        }));
        // 如果当前查看的是该创意，也更新
        if (get().currentCreativity?.id === id) {
          set((state) => ({
            currentCreativity: {
              ...state.currentCreativity!,
              isFavorite: result.is_favorite === 1 || result.isFavorite,
            },
          }));
        }
        return true;
      }
      return false;
    } catch (error) {
      console.error('切换收藏失败:', error);
      return false;
    }
  },

  fetchStats: async () => {
    try {
      const result = await api.creativity.stats();
      if (result) set({ stats: result });
    } catch (error) {
      console.error('获取统计信息失败:', error);
    }
  },

  setCurrentCreativity: (c) => set({ currentCreativity: c }),
  clearCurrentCreativity: () => set({ currentCreativity: null }),
}));
