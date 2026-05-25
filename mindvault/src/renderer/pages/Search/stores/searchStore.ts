import { create } from 'zustand';
import { api } from '../../../utils/api';
import type { FilterState, SortState } from '../types';
import type { Creativity } from '@shared/types';

interface SearchStore {
  // Search state
  keyword: string;
  results: Creativity[];
  loading: boolean;
  page: number;
  pageSize: number;
  total: number;

  // Filter state
  filter: FilterState;
  sortField: string;
  sortOrder: 'asc' | 'desc';

  // Batch state
  batchMode: boolean;
  selectedIds: Set<string>;
  batchTagInput: string;

  // Actions
  setKeyword: (keyword: string) => void;
  setPage: (page: number) => void;
  setFilter: (filter: Partial<FilterState>) => void;
  setSort: (field: string, order: 'asc' | 'desc') => void;
  search: () => Promise<void>;

  // Batch Actions
  toggleBatchMode: () => void;
  toggleSelectItem: (id: string) => void;
  toggleSelectAll: () => void;
  setBatchTagInput: (value: string) => void;
  batchAddTags: () => Promise<void>;
  batchFavorite: () => Promise<void>;
  batchDelete: () => Promise<void>;

  // Item Actions
  toggleFavorite: (item: Creativity) => Promise<void>;
  deleteItem: (item: Creativity) => Promise<void>;
}

export const useSearchStore = create<SearchStore>((set, get) => ({
  keyword: '',
  results: [],
  loading: false,
  page: 1,
  pageSize: 40,
  total: 0,
  filter: { types: [], minPriority: 0, tags: [], emojiReactions: [] },
  sortField: 'updatedAt',
  sortOrder: 'desc',
  batchMode: false,
  selectedIds: new Set(),
  batchTagInput: '',

  setKeyword: (keyword) => set({ keyword }),
  setPage: (page) => set({ page }),

  setFilter: (partialFilter) => set((state) => ({
    filter: { ...state.filter, ...partialFilter },
  })),

  setSort: (field, order) => set({ sortField: field, sortOrder: order }),

  search: async () => {
    const { keyword, page, pageSize, filter, sortField, sortOrder } = get();
    set({ loading: true });
    try {
      const response = await api.creativity.search({
        keyword,
        page,
        pageSize,
        types: filter.types.length > 0 ? filter.types : undefined,
        minPriority: filter.minPriority > 0 ? filter.minPriority : undefined,
        tags: filter.tags.length > 0 ? filter.tags : undefined,
        emojiReactions: filter.emojiReactions.length > 0 ? filter.emojiReactions : undefined,
        hasAttachments: filter.hasAttachments,
        sortField,
        sortOrder,
      });
      if (response) {
        set({ results: response.items, total: response.total });
      }
    } finally {
      set({ loading: false });
    }
  },

  toggleBatchMode: () => set((state) => ({
    batchMode: !state.batchMode,
    selectedIds: new Set(),
  })),

  toggleSelectItem: (id) => set((state) => {
    const newSet = new Set(state.selectedIds);
    if (newSet.has(id)) { newSet.delete(id); } else { newSet.add(id); }
    return { selectedIds: newSet };
  }),

  toggleSelectAll: () => set((state) => {
    if (state.selectedIds.size === state.results.length) {
      return { selectedIds: new Set() };
    }
    return { selectedIds: new Set(state.results.map((r) => r.id)) };
  }),

  setBatchTagInput: (value) => set({ batchTagInput: value }),

  batchAddTags: async () => {
    const { batchTagInput, selectedIds } = get();
    if (!batchTagInput.trim() || selectedIds.size === 0) return;
    const tags = batchTagInput.split(/[,，]/).map((t) => t.trim()).filter(Boolean);
    try {
      await Promise.all(Array.from(selectedIds).map((id) => api.creativity.addTags(id, tags)));
      set((state) => ({
        results: state.results.map((c) =>
          selectedIds.has(c.id) ? { ...c, tags: [...new Set([...(c.tags || []), ...tags])] } : c
        ),
        batchTagInput: '',
      }));
    } catch (error) {
      console.error('批量添加标签失败:', error);
    }
  },

  batchFavorite: async () => {
    const { selectedIds } = get();
    if (selectedIds.size === 0) return;
    try {
      await Promise.all(Array.from(selectedIds).map((id) => api.creativity.update(id, { isFavorite: true })));
      set((state) => ({
        results: state.results.map((c) => selectedIds.has(c.id) ? { ...c, isFavorite: true } : c),
      }));
    } catch (error) {
      console.error('批量收藏失败:', error);
    }
  },

  batchDelete: async () => {
    const { selectedIds } = get();
    if (selectedIds.size === 0) return;
    if (!window.confirm(`确定要删除选中的 ${selectedIds.size} 个创意吗？`)) return;
    try {
      await Promise.all(Array.from(selectedIds).map((id) => api.creativity.delete(id)));
      set((state) => ({
        results: state.results.filter((c) => !selectedIds.has(c.id)),
        total: state.total - selectedIds.size,
        selectedIds: new Set(),
      }));
    } catch (error) {
      console.error('批量删除失败:', error);
    }
  },

  toggleFavorite: async (item) => {
    try {
      await api.creativity.update(item.id, { isFavorite: !item.isFavorite });
      set((state) => ({
        results: state.results.map((c) =>
          c.id === item.id ? { ...c, isFavorite: !c.isFavorite } : c
        ),
      }));
    } catch (error) {
      console.error('收藏失败:', error);
    }
  },

  deleteItem: async (item) => {
    if (!window.confirm(`确定要删除"${item.title || '未命名创意'}"吗？`)) return;
    try {
      await api.creativity.delete(item.id);
      set((state) => ({
        results: state.results.filter((c) => c.id !== item.id),
        total: state.total - 1,
      }));
    } catch (error) {
      console.error('删除失败:', error);
    }
  },
}));
