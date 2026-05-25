import { create } from 'zustand';
import { api } from '../utils/api';
import type { Skill, SkillCategory, SkillDetectionResult, SkillCreateParams, SkillUpdateParams, CategoryCreateParams } from '../../shared/skill-types';

/**
 * 技能系统 Store
 * 管理技能列表、分类、搜索、检测等状态
 */

interface SkillState {
  /** 所有技能 */
  skills: Skill[];
  /** 所有分类 */
  categories: SkillCategory[];
  /** 当前选中的分类（null 表示全部） */
  selectedCategory: string | null;
  /** 搜索关键词 */
  searchQuery: string;
  /** 是否正在加载 */
  loading: boolean;
  /** 当前激活的技能（用户主动选择或 AI 检测到的） */
  activeSkills: string[];
  /** 上次检测到的技能 */
  detectedSkills: SkillDetectionResult[];
  /** 错误信息 */
  error: string | null;

  // ===== Actions =====

  /** 加载所有技能 */
  loadSkills: () => Promise<void>;
  /** 加载分类 */
  loadCategories: () => Promise<void>;
  /** 设置选中分类 */
  setSelectedCategory: (category: string | null) => void;
  /** 设置搜索关键词 */
  setSearchQuery: (query: string) => void;
  /** 搜索技能 */
  searchSkills: (query: string) => Promise<Skill[]>;
  /** 检测匹配的技能 */
  detectSkills: (input: string) => Promise<SkillDetectionResult[]>;
  /** 获取技能 prompt */
  getSkillPrompt: (skillId: string) => Promise<string | null>;
  /** 激活技能 */
  activateSkill: (skillId: string) => void;
  /** 取消激活技能 */
  deactivateSkill: (skillId: string) => void;
  /** 清除所有激活的技能 */
  clearActiveSkills: () => void;
  /** 创建技能 */
  createSkill: (params: SkillCreateParams) => Promise<Skill | null>;
  /** 更新技能 */
  updateSkill: (skillId: string, updates: SkillUpdateParams) => Promise<boolean>;
  /** 删除技能 */
  deleteSkill: (skillId: string) => Promise<boolean>;
  /** 切换技能启用状态 */
  toggleSkill: (skillId: string) => Promise<boolean>;
  /** 创建分类 */
  createCategory: (params: CategoryCreateParams) => Promise<SkillCategory | null>;
  /** 更新分类 */
  updateCategory: (oldName: string, updates: Partial<CategoryCreateParams>) => Promise<boolean>;
  /** 删除分类 */
  deleteCategory: (name: string, moveToCategory?: string) => Promise<boolean>;
  /** 获取过滤后的技能列表 */
  getFilteredSkills: () => Skill[];
}

export const useSkillStore = create<SkillState>((set, get) => ({
  skills: [],
  categories: [],
  selectedCategory: null,
  searchQuery: '',
  loading: false,
  activeSkills: [],
  detectedSkills: [],
  error: null,

  // ===== Actions =====

  loadSkills: async () => {
    set({ loading: true, error: null });
    try {
      const result = await api.skill.loadAll();
      if (result.success && result.data) {
        set({ skills: result.data, loading: false });
      } else {
        set({ error: result.error || '加载技能失败', loading: false });
      }
    } catch (err: any) {
      set({ error: err.message, loading: false });
    }
  },

  loadCategories: async () => {
    try {
      const result = await api.skill.categories();
      if (result.success && result.data) {
        set({ categories: result.data });
      }
    } catch (err: any) {
      console.error('[SkillStore] 加载分类失败:', err.message);
    }
  },

  setSelectedCategory: (category) => set({ selectedCategory: category, searchQuery: '' }),

  setSearchQuery: (query) => set({ searchQuery: query }),

  searchSkills: async (query) => {
    if (!query.trim()) return get().skills;
    try {
      const result = await api.skill.search(query);
      if (result.success && result.data) return result.data;
      return [];
    } catch (err) {
      return [];
    }
  },

  detectSkills: async (input) => {
    try {
      const result = await api.skill.detect(input);
      if (result.success && result.data) {
        set({ detectedSkills: result.data });
        return result.data;
      }
      return [];
    } catch (err) {
      return [];
    }
  },

  getSkillPrompt: async (skillId) => {
    try {
      const result = await api.skill.getPrompt(skillId);
      if (result.success && result.data) return result.data;
      return null;
    } catch (err) {
      return null;
    }
  },

  activateSkill: (skillId) => {
    const { activeSkills } = get();
    if (!activeSkills.includes(skillId)) {
      set({ activeSkills: [...activeSkills, skillId] });
      // 增加使用次数
      api.skill.incrementUse(skillId).catch(() => {});
    }
  },

  deactivateSkill: (skillId) => {
    const { activeSkills } = get();
    set({ activeSkills: activeSkills.filter(id => id !== skillId) });
  },

  clearActiveSkills: () => set({ activeSkills: [], detectedSkills: [] }),

  createSkill: async (params) => {
    try {
      const result = await api.skill.create(params);
      if (result.success && result.data) {
        // 重新加载技能列表
        await get().loadSkills();
        await get().loadCategories();
        return result.data;
      }
      set({ error: result.error || '创建技能失败' });
      return null;
    } catch (err: any) {
      set({ error: err.message });
      return null;
    }
  },

  updateSkill: async (skillId, updates) => {
    try {
      const result = await api.skill.update(skillId, updates);
      if (result.success) {
        await get().loadSkills();
        await get().loadCategories();
        return true;
      }
      set({ error: result.error || '更新技能失败' });
      return false;
    } catch (err: any) {
      set({ error: err.message });
      return false;
    }
  },

  deleteSkill: async (skillId) => {
    try {
      const result = await api.skill.delete(skillId);
      if (result.success) {
        await get().loadSkills();
        await get().loadCategories();
        return true;
      }
      set({ error: result.error || '删除技能失败' });
      return false;
    } catch (err: any) {
      set({ error: err.message });
      return false;
    }
  },

  toggleSkill: async (skillId) => {
    try {
      const result = await api.skill.toggle(skillId);
      if (result.success) {
        await get().loadSkills();
        return result.data;
      }
      return false;
    } catch (err) {
      return false;
    }
  },

  createCategory: async (params) => {
    try {
      const result = await api.skill.createCategory(params);
      if (result.success && result.data) {
        await get().loadCategories();
        return result.data;
      }
      set({ error: result.error || '创建分类失败' });
      return null;
    } catch (err: any) {
      set({ error: err.message });
      return null;
    }
  },

  updateCategory: async (oldName, updates) => {
    try {
      const result = await api.skill.updateCategory(oldName, updates);
      if (result.success) {
        await get().loadCategories();
        await get().loadSkills();
        return true;
      }
      set({ error: result.error || '更新分类失败' });
      return false;
    } catch (err: any) {
      set({ error: err.message });
      return false;
    }
  },

  deleteCategory: async (name, moveToCategory) => {
    try {
      const result = await api.skill.deleteCategory(name, moveToCategory);
      if (result.success) {
        await get().loadCategories();
        await get().loadSkills();
        return true;
      }
      set({ error: result.error || '删除分类失败' });
      return false;
    } catch (err: any) {
      set({ error: err.message });
      return false;
    }
  },

  getFilteredSkills: () => {
    const { skills, selectedCategory, searchQuery } = get();
    let filtered = skills;

    // 按分类过滤
    if (selectedCategory) {
      filtered = filtered.filter(s => s.category === selectedCategory);
    }

    // 按搜索关键词过滤
    if (searchQuery.trim()) {
      const query = searchQuery.toLowerCase();
      filtered = filtered.filter(s =>
        s.name.toLowerCase().includes(query) ||
        s.nameEn.toLowerCase().includes(query) ||
        s.description.toLowerCase().includes(query) ||
        s.triggers.some(t => t.toLowerCase().includes(query))
      );
    }

    return filtered;
  },
}));
