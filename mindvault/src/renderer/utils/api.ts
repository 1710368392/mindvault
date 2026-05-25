/**
 * IPC 通信封装
 * 兼容 Electron 环境和浏览器预览环境
 * 
 * 在 Electron 中：通过 preload.js 暴露的命名空间 API 调用主进程
 * 在浏览器中：使用 mock 数据，确保 Web 预览也能正常使用
 */

// 检测是否在 Electron 环境中
const isElectron = typeof window !== 'undefined' && window.electronAPI;

// ========== Mock 数据 ==========

// 从 localStorage 恢复创意状态
const restoreCreativityState = () => {
  const savedState = localStorage.getItem('mindvault-mock-creativity-state');
  if (savedState) {
    return JSON.parse(savedState);
  }
  return {};
};

// 保存创意状态到 localStorage
const saveCreativityState = (state: Record<string, any>) => {
  localStorage.setItem('mindvault-mock-creativity-state', JSON.stringify(state));
};

// 从 localStorage 获取回收站数据
const getMockTrashItems = (): any[] => {
  const saved = localStorage.getItem('mindvault-mock-trash-items');
  return saved ? JSON.parse(saved) : [];
};

// 保存回收站数据到 localStorage
const saveMockTrashItems = (items: any[]) => {
  localStorage.setItem('mindvault-mock-trash-items', JSON.stringify(items));
};

// 从 localStorage 获取已删除的画布节点
const getRemovedCanvasItems = (): string[] => {
  const saved = localStorage.getItem('mindvault-removed-canvas-items');
  return saved ? JSON.parse(saved) : [];
};

// 保存已删除的画布节点到 localStorage
const saveRemovedCanvasItems = (items: string[]) => {
  localStorage.setItem('mindvault-removed-canvas-items', JSON.stringify(items));
};

// 从 localStorage 获取画布连线
const getCanvasEdges = (boardId: string): any[] => {
  const saved = localStorage.getItem(`mindvault-canvas-edges-${boardId}`);
  return saved ? JSON.parse(saved) : [];
};

// 保存画布连线到 localStorage
const saveCanvasEdges = (boardId: string, edges: any[]) => {
  localStorage.setItem(`mindvault-canvas-edges-${boardId}`, JSON.stringify(edges));
};

// 从 localStorage 获取便签数据
const getStickyNotes = (boardId: string): any[] => {
  const saved = localStorage.getItem(`mindvault-sticky-notes-${boardId}`);
  return saved ? JSON.parse(saved) : [];
};

// 保存便签数据到 localStorage
const saveStickyNotes = (boardId: string, notes: any[]) => {
  localStorage.setItem(`mindvault-sticky-notes-${boardId}`, JSON.stringify(notes));
};

// 从 localStorage 获取创意链数据
const getCreativeChains = (boardId: string): any[] => {
  const saved = localStorage.getItem(`mindvault-creative-chains-${boardId}`);
  return saved ? JSON.parse(saved) : [];
};

// 保存创意链数据到 localStorage
const saveCreativeChains = (boardId: string, chains: any[]) => {
  localStorage.setItem(`mindvault-creative-chains-${boardId}`, JSON.stringify(chains));
};

const mockCreativities = [
  {
    id: 'mock-1',
    title: '欢迎使用脑洞集！',
    content: '这是你的第一个创意。点击左侧"快速录入"按钮或顶部"录入"按钮来记录你的灵感吧！\n\n你可以记录文字、图片、语音、链接等各种形式的创意。',
    type: 'text',
    subtype: 'idea',
    contentFormat: 'markdown',
    wordCount: 50,
    priority: 5,
    emojiReaction: 'happy',
    status: 'active',
    templateId: null,
    boardId: null,
    positionX: null,
    positionY: null,
    cardStyle: null,
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
    lastReviewedAt: null,
    isRead: false,
    tags: [{ id: 't1', name: '示例', color: '#9DBAD5', icon: '📌', createdAt: new Date().toISOString() }],
  },
  {
    id: 'mock-2',
    title: '产品创意：智能水杯',
    content: '一款可以自动记录饮水量的智能水杯，通过手机App查看每日饮水数据，提醒用户按时喝水。',
    type: 'text',
    subtype: 'character',
    contentFormat: 'markdown',
    wordCount: 40,
    priority: 3,
    emojiReaction: 'shoot',
    status: 'active',
    templateId: null,
    boardId: null,
    positionX: null,
    positionY: null,
    cardStyle: '{"color":"blue"}',
    createdAt: new Date(Date.now() - 86400000).toISOString(),
    updatedAt: new Date(Date.now() - 86400000).toISOString(),
    lastReviewedAt: null,
    isRead: true,
    tags: [{ id: 't2', name: '产品', color: '#9CAF88', icon: '📦', createdAt: new Date().toISOString() }],
  },
  {
    id: 'mock-3',
    title: '写作灵感：时间旅行者的日记',
    content: '一个关于时间旅行者的故事创意。主角每天醒来都会发现自己身处不同的时代，他需要通过写日记来记录和寻找回到自己时代的方法。',
    type: 'text',
    subtype: 'plot',
    contentFormat: 'markdown',
    wordCount: 55,
    priority: 4,
    emojiReaction: 'grin',
    status: 'active',
    templateId: null,
    boardId: null,
    positionX: null,
    positionY: null,
    cardStyle: '{"color":"yellow"}',
    createdAt: new Date(Date.now() - 172800000).toISOString(),
    updatedAt: new Date(Date.now() - 172800000).toISOString(),
    lastReviewedAt: null,
    isRead: true,
    tags: [{ id: 't3', name: '写作', color: '#C4A882', icon: '📖', createdAt: new Date().toISOString() }],
  },
];

const mockBoards = [
  { id: 'board-1', name: '初号机', description: '存放所有创意', background: null, theme: null, layout: 'board' as const, sortOrder: 0, createdAt: new Date().toISOString(), updatedAt: new Date().toISOString() },
];

const mockTags = [
  { id: 't1', name: '示例', color: '#9DBAD5', icon: '📌', createdAt: new Date().toISOString() },
  { id: 't2', name: '产品', color: '#9CAF88', icon: '📦', createdAt: new Date().toISOString() },
  { id: 't3', name: '写作', color: '#C4A882', icon: '📖', createdAt: new Date().toISOString() },
  { id: 't4', name: '技术', color: '#B59A8C', icon: '💻', createdAt: new Date().toISOString() },
  { id: 't5', name: '旅行', color: '#94A89A', icon: '✈️', createdAt: new Date().toISOString() },
];

const mockTemplates = [
  { id: 'tpl-1', name: '产品创意', description: '记录产品相关的创意想法', category: '产品', config: '{}', isBuiltin: true, createdAt: new Date().toISOString() },
  { id: 'tpl-2', name: '写作灵感', description: '记录写作相关的灵感', category: '写作', config: '{}', isBuiltin: true, createdAt: new Date().toISOString() },
  { id: 'tpl-3', name: '旅行计划', description: '记录旅行相关的想法和计划', category: '旅行', config: '{}', isBuiltin: true, createdAt: new Date().toISOString() },
  { id: 'tpl-4', name: '学习笔记', description: '记录学习过程中的想法', category: '学习', config: '{}', isBuiltin: true, createdAt: new Date().toISOString() },
  { id: 'tpl-5', name: '待办事项', description: '记录需要完成的任务', category: '效率', config: '{}', isBuiltin: true, createdAt: new Date().toISOString() },
  { id: 'tpl-6', name: '读书笔记', description: '记录读书时的想法和摘录', category: '阅读', config: '{}', isBuiltin: true, createdAt: new Date().toISOString() },
  // 网文创作模板
  { id: 'tpl-chapter-outline', name: '章节大纲', description: '网文章节大纲模板，包含章节标题、摘要、关键情节点', category: '写作', isBuiltin: true, config: JSON.stringify({ fields: [{ name: '章节标题', type: 'text' }, { name: '章节摘要', type: 'textarea' }, { name: '关键情节点', type: 'textarea' }, { name: '字数目标', type: 'number' }] }), createdAt: new Date().toISOString() },
  { id: 'tpl-character', name: '人物设定', description: '角色详细设定模板，包含基本信息、性格、背景故事', category: '写作', isBuiltin: true, config: JSON.stringify({ fields: [{ name: '角色名称', type: 'text' }, { name: '年龄/外貌', type: 'textarea' }, { name: '性格特点', type: 'textarea' }, { name: '背景故事', type: 'textarea' }, { name: '人物关系', type: 'textarea' }] }), createdAt: new Date().toISOString() },
  { id: 'tpl-worldbuilding', name: '世界观设定', description: '故事世界观设定模板，包含时代背景、力量体系、地理环境', category: '写作', isBuiltin: true, config: JSON.stringify({ fields: [{ name: '时代背景', type: 'textarea' }, { name: '力量/魔法体系', type: 'textarea' }, { name: '地理环境', type: 'textarea' }, { name: '社会结构', type: 'textarea' }] }), createdAt: new Date().toISOString() },
  // 剧本创作模板
  { id: 'tpl-scene', name: '场景描述', description: '剧本场景描述模板，包含场景地点、时间、氛围、道具', category: '写作', isBuiltin: true, config: JSON.stringify({ fields: [{ name: '场景地点', type: 'text' }, { name: '时间', type: 'text' }, { name: '氛围描述', type: 'textarea' }, { name: '道具清单', type: 'textarea' }] }), createdAt: new Date().toISOString() },
  { id: 'tpl-dialogue', name: '对话模板', description: '角色对话写作模板，包含角色名、对话内容、动作描写', category: '写作', isBuiltin: true, config: JSON.stringify({ fields: [{ name: '场景', type: 'text' }, { name: '角色A', type: 'text' }, { name: '角色B', type: 'text' }, { name: '对话内容', type: 'textarea' }, { name: '动作/表情描写', type: 'textarea' }] }), createdAt: new Date().toISOString() },
  { id: 'tpl-script-outline', name: '分场大纲', description: '剧本分场大纲模板，包含场次、场景、人物、情节概要', category: '写作', isBuiltin: true, config: JSON.stringify({ fields: [{ name: '场次编号', type: 'text' }, { name: '场景地点', type: 'text' }, { name: '出场人物', type: 'textarea' }, { name: '情节概要', type: 'textarea' }, { name: '情绪节奏', type: 'textarea' }] }), createdAt: new Date().toISOString() },
];

const mockSettings = {
  theme: 'light',
  language: 'zh-CN',
  fontSize: 14,
  fontFamily: 'system-ui',
  fontLineHeight: 1.6,
  titleFontFamily: 'system-ui',
  soundEnabled: true,
  soundVolume: 0.5,
  autoBackup: true,
  autoBackupInterval: 24,
  privacyLock: false,
  privacyPassword: null,
};

// ========== IPC 封装 API ==========

/** 延迟函数，模拟网络请求 */
const delay = (ms: number) => new Promise(resolve => setTimeout(resolve, ms));

export const api = {
  // --- 创意管理 ---
  creativity: {
    create: async (data: any) => {
      if (isElectron) return window.electronAPI.creativity.create(data);
      await delay(200);
      if (Array.isArray(data)) {
        const items = data.map((d: any) => ({ ...d, id: Date.now().toString(36) + Math.random().toString(36).slice(2, 6), createdAt: new Date().toISOString(), updatedAt: new Date().toISOString(), status: 'active', priority: d.priority || 0, emojiReaction: d.emojiReaction || null, isRead: false }));
        mockCreativities.unshift(...items);
        return items;
      }
      const item = { ...data, id: Date.now().toString(36), createdAt: new Date().toISOString(), updatedAt: new Date().toISOString(), status: 'active', priority: data.priority || 0, emojiReaction: data.emojiReaction || null, isRead: false };
      mockCreativities.unshift(item);
      return item;
    },
    read: async (id: string) => {
      if (isElectron) return window.electronAPI.creativity.read(id);
      await delay(100);
      const savedState = restoreCreativityState();
      const item = mockCreativities.find((c: any) => c.id === id);
      if (item && savedState[id]) {
        return { ...item, ...savedState[id] };
      }
      return item || null;
    },
    update: async (id: string, data: any) => {
      if (isElectron) return window.electronAPI.creativity.update(id, data);
      await delay(200);
      const idx = mockCreativities.findIndex((c: any) => c.id === id);
      if (idx >= 0) { mockCreativities[idx] = { ...mockCreativities[idx], ...data, updatedAt: new Date().toISOString() }; return mockCreativities[idx]; }
      return null;
    },
    delete: async (id: string, options?: { boardId?: string; boardName?: string; skipTrash?: boolean }) => {
      if (isElectron) return window.electronAPI.creativity.delete(id, options);
      await delay(100);
      const { boardId, boardName, skipTrash = false } = options || {};
      const state = restoreCreativityState();
      state[id] = { ...state[id], status: 'trashed' };
      saveCreativityState(state);
      const item = mockCreativities.find((c: any) => c.id === id);
      if (item) {
        item.status = 'trashed';
        item.updatedAt = new Date().toISOString();
        // 添加到 mock 回收站
        if (!skipTrash) {
          const trashItems = getMockTrashItems();
          const isChapter = item.subtype === 'chapter';
          const trashItem = {
            id: 'trash-' + Date.now() + '-' + Math.random().toString(36).slice(2, 6),
            itemType: isChapter ? 'chapter' : 'creativity',
            itemId: id,
            sourceBoardId: boardId || item.boardId || null,
            sourceBoardName: boardName || null,
            snapshot: item,
            deletedAt: new Date().toISOString()
          };
          trashItems.push(trashItem);
          saveMockTrashItems(trashItems);
        }
      }
      return true;
    },
    list: async (params: any = {}) => {
      if (isElectron) return window.electronAPI.creativity.list(params);
      await delay(200);
      const { page = 1, pageSize = 20, status = 'active' } = params;
      const savedState = restoreCreativityState();
      let items = mockCreativities.map((c: any) => {
        if (savedState[c.id]) {
          return { ...c, ...savedState[c.id] };
        }
        return c;
      }).filter((c: any) => c.status === status);
      if (params.boardId) items = items.filter((c: any) => c.boardId === params.boardId);
      if (params.type) items = items.filter((c: any) => c.type === params.type);
      if (params.types && Array.isArray(params.types) && params.types.length > 0) items = items.filter((c: any) => params.types.includes(c.type));
      if (params.priorityMin !== undefined && params.priorityMin > 0) items = items.filter((c: any) => c.priority >= params.priorityMin);
      if (params.tag) items = items.filter((c: any) => (c.tags || []).some((t: any) => t.name === params.tag || t.id === params.tag));
      items.sort((a: any, b: any) => new Date(b.updatedAt).getTime() - new Date(a.updatedAt).getTime());
      const start = (page - 1) * pageSize;
      return { data: items.slice(start, start + pageSize), pagination: { page, pageSize, total: items.length } };
    },
    listAll: async (params: any = {}) => {
      if (isElectron) {
        // 在 Electron 环境中，尝试通过多次请求获取所有数据，或者直接使用 window.electronAPI.creativity.listAll（如果有）
        if (window.electronAPI.creativity.listAll) {
          return window.electronAPI.creativity.listAll(params);
        }
        // 回退方案：使用大 pageSize 获取数据
        const result = await window.electronAPI.creativity.list({ ...params, page: 1, pageSize: 10000 });
        return result?.data || [];
      }
      await delay(200);
      const { status = 'active' } = params;
      const savedState = restoreCreativityState();
      let items = mockCreativities.map((c: any) => {
        if (savedState[c.id]) {
          return { ...c, ...savedState[c.id] };
        }
        return c;
      }).filter((c: any) => c.status === status);
      if (params.boardId) items = items.filter((c: any) => c.boardId === params.boardId);
      if (params.type) items = items.filter((c: any) => c.type === params.type);
      if (params.types && Array.isArray(params.types) && params.types.length > 0) items = items.filter((c: any) => params.types.includes(c.type));
      if (params.priorityMin !== undefined && params.priorityMin > 0) items = items.filter((c: any) => c.priority >= params.priorityMin);
      if (params.tag) items = items.filter((c: any) => (c.tags || []).some((t: any) => t.name === params.tag || t.id === params.tag));
      items.sort((a: any, b: any) => new Date(b.updatedAt).getTime() - new Date(a.updatedAt).getTime());
      return items;
    },
    search: async (paramsOrKeyword: any, filters?: any) => {
      // 兼容两种调用方式：
      // 1. search({ keyword, page, pageSize, ... }) - 新版，返回 { items, total }
      // 2. search(keyword, filters) - 旧版，返回数组（向后兼容）
      let keyword: string;
      let searchFilters: any = filters;
      let isNewStyle = false;
      
      if (typeof paramsOrKeyword === 'object' && paramsOrKeyword !== null) {
        // 新版调用方式：对象参数
        keyword = paramsOrKeyword.keyword || '';
        searchFilters = paramsOrKeyword;
        isNewStyle = true;
      } else {
        // 旧版调用方式：字符串参数
        keyword = paramsOrKeyword || '';
      }
      
      if (isElectron) {
        const results = await window.electronAPI.creativity.search(keyword, searchFilters);
        const items = Array.isArray(results) ? results : [];
        // 新版返回 { items, total }，旧版直接返回数组
        return isNewStyle ? { items, total: items.length } : items;
      }
      
      // Mock 模式
      await delay(200);
      const kw = keyword.toLowerCase();
      const savedState = restoreCreativityState();
      let items = mockCreativities.map((c: any) => {
        if (savedState[c.id]) {
          return { ...c, ...savedState[c.id] };
        }
        return c;
      }).filter((c: any) =>
        c.status === 'active' && ((c as any).title.toLowerCase().includes(kw) || (c.content || '').toLowerCase().includes(kw))
      );
      if (searchFilters) {
        if (searchFilters.types && searchFilters.types.length > 0) items = items.filter((c: any) => searchFilters.types.includes(c.type));
        if (searchFilters.minPriority !== undefined && searchFilters.minPriority > 0) items = items.filter((c: any) => c.priority >= searchFilters.minPriority);
        if (searchFilters.tags && searchFilters.tags.length > 0) items = items.filter((c: any) => (c.tags || []).some((t: any) => searchFilters.tags.includes(t.name)));
      }
      return isNewStyle ? { items, total: items.length } : items;
    },
    random: async () => {
      if (isElectron) return window.electronAPI.creativity.random();
      await delay(100);
      const savedState = restoreCreativityState();
      // 排除写作台章节（subtype = 'chapter'）
      const active = mockCreativities.map((c: any) => {
        if (savedState[c.id]) {
          return { ...c, ...savedState[c.id] };
        }
        return c;
      }).filter((c: any) => c.status === 'active' && c.subtype !== 'chapter');
      return active.length > 0 ? active[Math.floor(Math.random() * active.length)] : null;
    },
    permanentDelete: async (id: string, trashItemId?: string) => {
      if (isElectron) {
        return window.electronAPI.creativity.permanentDelete(id, trashItemId);
      }
      // mock 模式下从 mockCreativities 中移除
      const idx = mockCreativities.findIndex((c: any) => c.id === id);
      if (idx >= 0) mockCreativities.splice(idx, 1);
      return true;
    },
    restore: async (id: string, trashItemId?: string) => {
      if (isElectron) {
        return window.electronAPI.creativity.restore(id, trashItemId);
      }
      // mock 模式下恢复状态
      await delay(100);
      const state = restoreCreativityState();
      if (state[id]) {
        state[id].status = 'active';
        saveCreativityState(state);
      }
      const item = mockCreativities.find((c: any) => c.id === id);
      if (item) {
        item.status = 'active';
        return item;
      }
      return null;
    },
    toggleFavorite: async (id: string) => {
      if (isElectron) return window.electronAPI.creativity.toggleFavorite(id);
      await delay(100);
      const item = mockCreativities.find((c: any) => c.id === id);
      if (item) {
        item.isFavorite = !item.isFavorite;
        return item;
      }
      return null;
    },
    batchUpdate: async (ids: string[], data: any) => {
      if (isElectron) return window.electronAPI.creativity.batchUpdate(ids, data);
      await delay(300);
      for (const id of ids) {
        const idx = mockCreativities.findIndex((c: any) => c.id === id);
        if (idx >= 0) {
          mockCreativities[idx] = { ...mockCreativities[idx], ...data, updatedAt: new Date().toISOString() };
        }
      }
      return { success: true, updatedCount: ids.length };
    },
    batchDelete: async (ids: string[], permanent = false, options?: { boardId?: string; boardName?: string }) => {
      if (isElectron) return window.electronAPI.creativity.batchDelete(ids, permanent, options);
      await delay(300);
      let deletedCount = 0;
      if (permanent) {
        for (const id of ids) {
          const idx = mockCreativities.findIndex((c: any) => c.id === id);
          if (idx >= 0) {
            mockCreativities.splice(idx, 1);
            deletedCount++;
          }
        }
      } else {
        for (const id of ids) {
          const idx = mockCreativities.findIndex((c: any) => c.id === id);
          if (idx >= 0) {
            mockCreativities[idx].status = 'trashed';
            deletedCount++;
          }
        }
      }
      return { success: true, deletedCount };
    },
    stats: async () => {
      if (isElectron) return window.electronAPI.creativity.stats();
      await delay(100);
      const savedState = restoreCreativityState();
      const active = mockCreativities.map((c: any) => {
        if (savedState[c.id]) {
          return { ...c, ...savedState[c.id] };
        }
        return c;
      }).filter((c: any) => c.status === 'active');
      const now = new Date();
      const todayStart = new Date(now.getFullYear(), now.getMonth(), now.getDate()).getTime();
      const weekStart = todayStart - 7 * 86400000;
      const todayCount = active.filter((c: any) => new Date(c.createdAt).getTime() >= todayStart).length;
      const weekCount = active.filter((c: any) => new Date(c.createdAt).getTime() >= weekStart).length;
      const typeDistribution: Record<string, number> = {};
      const priorityDistribution: Record<number, number> = {};
      const tagMap: Record<string, number> = {};
      for (const c of active) {
        typeDistribution[c.type] = (typeDistribution[c.type] || 0) + 1;
        priorityDistribution[c.priority || 0] = (priorityDistribution[c.priority || 0] || 0) + 1;
        for (const t of (c.tags || [])) {
          tagMap[t.name] = (tagMap[t.name] || 0) + 1;
        }
      }
      const recentTags = Object.entries(tagMap).map(([name, count]) => ({ name, count })).sort((a, b) => b.count - a.count).slice(0, 10);
      // 最近7天每日新增
      const dailyData: { date: string; count: number }[] = [];
      for (let i = 6; i >= 0; i--) {
        const d = new Date(todayStart - i * 86400000);
        const dateStr = `${d.getMonth() + 1}/${d.getDate()}`;
        const dayEnd = d.getTime() + 86400000;
        const count = active.filter((c: any) => { const t = new Date(c.createdAt).getTime(); return t >= d.getTime() && t < dayEnd; }).length;
        dailyData.push({ date: dateStr, count });
      }
      return { total: active.length, today: todayCount, thisWeek: weekCount, tags: recentTags.length, totalCount: active.length, todayCount: todayCount, weekCount: weekCount, typeDistribution, priorityDistribution, recentTags, dailyData };
    },
  },

  // --- 看板管理 ---
  board: {
    create: async (data: any) => {
      if (isElectron) return window.electronAPI.board.create(data);
      await delay(200);
      const item = { ...data, id: Date.now().toString(36), createdAt: new Date().toISOString(), updatedAt: new Date().toISOString(), layout: 'board', sortOrder: 0 };
      mockBoards.push(item);
      return item;
    },
    read: async (id: string) => {
      if (isElectron) return window.electronAPI.board.read(id);
      await delay(100);
      return mockBoards.find((b: any) => b.id === id) || null;
    },
    update: async (id: string, data: any) => {
      if (isElectron) return window.electronAPI.board.update(id, data);
      await delay(200);
      const idx = mockBoards.findIndex((b: any) => b.id === id);
      if (idx >= 0) { mockBoards[idx] = { ...mockBoards[idx], ...data, updatedAt: new Date().toISOString() }; return true; }
      return false;
    },
    delete: async (id: string) => {
      if (isElectron) return window.electronAPI.board.delete(id);
      await delay(100);
      const idx = mockBoards.findIndex((b: any) => b.id === id);
      if (idx >= 0) mockBoards.splice(idx, 1);
      return true;
    },
    list: async () => {
      if (isElectron) return window.electronAPI.board.list();
      await delay(100);
      return mockBoards;
    },

    // --- 看板画布 ---
    canvas: {
      listItems: async (boardId: string) => {
        if (isElectron) return window.electronAPI.board.canvas.listItems(boardId);
        await delay(100);
        const now = new Date().toISOString();
        const savedPositions = JSON.parse(localStorage.getItem('mindvault-canvas-positions') || '{}');
        const removedItems = getRemovedCanvasItems();
        const savedState = restoreCreativityState();
        const customItems = (() => {
          const saved = localStorage.getItem(`mindvault-canvas-items-${boardId}`);
          if (saved) {
            try {
              return JSON.parse(saved);
            } catch {
              return [];
            }
          }
          return [];
        })();
        
        const baseItems = [
          { id: 'ci-1', boardId, creativityId: 'mock-1', positionX: 80, positionY: 60, width: null, height: null, title: null, content: null, type: null, isLinked: true, createdAt: now, creativity: savedState['mock-1']?.status === 'trashed' ? null : mockCreativities[0] },
          { id: 'ci-2', boardId, creativityId: 'mock-2', positionX: 350, positionY: 120, width: null, height: null, title: null, content: null, type: null, isLinked: true, createdAt: now, creativity: savedState['mock-2']?.status === 'trashed' ? null : mockCreativities[1] },
          { id: 'ci-3', boardId, creativityId: 'mock-3', positionX: 200, positionY: 300, width: null, height: null, title: null, content: null, type: null, isLinked: true, createdAt: now, creativity: savedState['mock-3']?.status === 'trashed' ? null : mockCreativities[2] },
        ];
        
        const customItemsWithCreativity = customItems.map((item: any) => {
          const creativity = mockCreativities.find((c: any) => c.id === item.creativityId) || null;
          const isTrashed = savedState[item.creativityId]?.status === 'trashed';
          const linked = item.isLinked ?? false;
          return {
            ...item,
            isLinked: linked,
            creativity: (linked && !isTrashed) ? creativity : null,
          };
        });
        
        const allItems = [...baseItems, ...customItemsWithCreativity];
        
        return allItems
          .filter(item => !removedItems.includes(item.id))
          .filter(item => item.isLinked ? item.creativity !== null : true)
          .map((item: any) => {
            const saved = savedPositions[item.id];
            if (saved) { item.positionX = saved.x; item.positionY = saved.y; }
            return item;
          });
      },
      addItem: async (boardId: string, creativityId: string, x: number, y: number, width?: number, height?: number, title?: string | null, content?: string | null, type?: string | null, isLinked?: boolean, subtype?: string | null, cardStyle?: string | null, priority?: number, emojiReaction?: string | null, contentFormat?: string) => {
        if (isElectron) return window.electronAPI.board.canvas.addItem(boardId, creativityId, x, y, width, height, title, content, type, isLinked, subtype, cardStyle, priority, emojiReaction, contentFormat);
        await delay(100);
        const now = new Date().toISOString();
        const savedState = restoreCreativityState();
        
        const creativity = mockCreativities.find((c: any) => c.id === creativityId);
        const isTrashed = savedState[creativityId]?.status === 'trashed';
        const linked = isLinked ?? false;
        
        const newItem = {
          id: Date.now().toString(36),
          boardId,
          creativityId,
          positionX: x,
          positionY: y,
          width: null,
          height: null,
          title: title ?? null,
          content: content ?? null,
          type: type ?? null,
          isLinked: linked,
          createdAt: now,
          creativity: (linked && !isTrashed) ? creativity : null,
        };
        
        const customItems = (() => {
          const saved = localStorage.getItem(`mindvault-canvas-items-${boardId}`);
          if (saved) {
            try {
              return JSON.parse(saved);
            } catch {
              return [];
            }
          }
          return [];
        })();
        
        customItems.push({
          id: newItem.id,
          boardId,
          creativityId,
          positionX: x,
          positionY: y,
          width: null,
          height: null,
          title: title ?? null,
          content: content ?? null,
          type: type ?? null,
          isLinked: linked,
          createdAt: now,
        });
        
        localStorage.setItem(`mindvault-canvas-items-${boardId}`, JSON.stringify(customItems));
        
        return newItem;
      },
      updatePosition: async (itemId: string, x: number, y: number) => {
        if (isElectron) return window.electronAPI.board.canvas.updatePosition(itemId, x, y);
        await delay(50);
        const savedPositions = JSON.parse(localStorage.getItem('mindvault-canvas-positions') || '{}');
        savedPositions[itemId] = { x, y };
        localStorage.setItem('mindvault-canvas-positions', JSON.stringify(savedPositions));
        return true;
      },
      updateSize: async (itemId: string, width: number, height: number) => {
        if (isElectron) return window.electronAPI.board.canvas.updateSize(itemId, width, height);
        await delay(50);
        return true;
      },
      updateContent: async (itemId: string, data: { title?: string | null; content?: string | null; type?: string | null; subtype?: string | null; cardStyle?: string | null; priority?: number; emojiReaction?: string | null; isFavorite?: boolean; contentFormat?: string; isLinked?: boolean; creativityId?: string }) => {
        if (isElectron) return window.electronAPI.board.canvas.updateContent(itemId, data);
        await delay(50);
        return true;
      },
      removeItem: async (itemId: string) => {
        if (isElectron) return window.electronAPI.board.canvas.removeItem(itemId);
        await delay(50);
        const removedItems = getRemovedCanvasItems();
        if (!removedItems.includes(itemId)) {
          removedItems.push(itemId);
          saveRemovedCanvasItems(removedItems);
        }
        return true;
      },
      listEdges: async (boardId: string) => {
        if (isElectron) return window.electronAPI.board.canvas.listEdges(boardId);
        await delay(100);
        return getCanvasEdges(boardId);
      },
      addEdge: async (boardId: string, sourceId: string, targetId: string, edgeType: string, sourceConnector?: any, targetConnector?: any) => {
        if (isElectron) return window.electronAPI.board.canvas.addEdge(boardId, sourceId, targetId, edgeType, sourceConnector, targetConnector);
        await delay(100);
        const newEdge = { id: Date.now().toString(36), boardId, sourceItemId: sourceId, targetItemId: targetId, edgeType: edgeType || 'related', label: null, sourceConnector: sourceConnector || null, targetConnector: targetConnector || null, createdAt: new Date().toISOString() };
        const edges = getCanvasEdges(boardId);
        edges.push(newEdge);
        saveCanvasEdges(boardId, edges);
        return newEdge;
      },
      removeEdge: async (edgeId: string) => {
        if (isElectron) return window.electronAPI.board.canvas.removeEdge(edgeId);
        await delay(50);
        // 需要从所有 board 的 edges 中查找
        for (const key in localStorage) {
          if (key.startsWith('mindvault-canvas-edges-')) {
            const boardId = key.replace('mindvault-canvas-edges-', '');
            const edges = getCanvasEdges(boardId);
            const filteredEdges = edges.filter(e => e.id !== edgeId);
            if (filteredEdges.length !== edges.length) {
              saveCanvasEdges(boardId, filteredEdges);
            }
          }
        }
        return true;
      },
      updateConnector: async (edgeId: string, isSource: boolean, connector: any) => {
        if (isElectron) return window.electronAPI.board.canvas.updateConnector(edgeId, isSource, connector);
        await delay(50);
        for (const key in localStorage) {
          if (key.startsWith('mindvault-canvas-edges-')) {
            const boardId = key.replace('mindvault-canvas-edges-', '');
            const edges = getCanvasEdges(boardId);
            const updated = edges.map(e => {
              if (e.id === edgeId) {
                return isSource ? { ...e, sourceConnector: connector } : { ...e, targetConnector: connector };
              }
              return e;
            });
            if (JSON.stringify(updated) !== JSON.stringify(edges)) {
              saveCanvasEdges(boardId, updated);
            }
          }
        }
        return true;
      },
      updateControlPoints: async (edgeId: string, controlPoints: any) => {
        if (isElectron) return window.electronAPI.board.canvas.updateControlPoints(edgeId, controlPoints);
        await delay(50);
        for (const key in localStorage) {
          if (key.startsWith('mindvault-canvas-edges-')) {
            const boardId = key.replace('mindvault-canvas-edges-', '');
            const edges = getCanvasEdges(boardId);
            const updated = edges.map(e => {
              if (e.id === edgeId) {
                return { ...e, controlPoints };
              }
              return e;
            });
            if (JSON.stringify(updated) !== JSON.stringify(edges)) {
              saveCanvasEdges(boardId, updated);
            }
          }
        }
        return true;
      },
      updateEdgeLabel: async (edgeId: string, label: string) => {
        if (isElectron) return window.electronAPI.board.canvas.updateEdgeLabel(edgeId, label);
        await delay(50);
        for (const key in localStorage) {
          if (key.startsWith('mindvault-canvas-edges-')) {
            const boardId = key.replace('mindvault-canvas-edges-', '');
            const edges = getCanvasEdges(boardId);
            const updated = edges.map(e => {
              if (e.id === edgeId) {
                return { ...e, label };
              }
              return e;
            });
            if (JSON.stringify(updated) !== JSON.stringify(edges)) {
              saveCanvasEdges(boardId, updated);
            }
          }
        }
        return true;
      },
      updateEdgeType: async (edgeId: string, edgeType: string) => {
        if (isElectron) return window.electronAPI.board.canvas.updateEdgeType(edgeId, edgeType);
        await delay(50);
        for (const key in localStorage) {
          if (key.startsWith('mindvault-canvas-edges-')) {
            const boardId = key.replace('mindvault-canvas-edges-', '');
            const edges = getCanvasEdges(boardId);
            const updated = edges.map(e => {
              if (e.id === edgeId) {
                return { ...e, edgeType };
              }
              return e;
            });
            if (JSON.stringify(updated) !== JSON.stringify(edges)) {
              saveCanvasEdges(boardId, updated);
            }
          }
        }
        return true;
      },
    },

    // --- 看板便签 ---
    sticky: {
      list: async (boardId: string) => {
        if (isElectron) return window.electronAPI.board.sticky.list(boardId);
        await delay(100);
        // 从 localStorage 读取，不再返回硬编码的示例便签
        return getStickyNotes(boardId);
      },
      add: async (boardId: string, data: any) => {
        if (isElectron) return window.electronAPI.board.sticky.add(boardId, data);
        await delay(100);
        const now = new Date().toISOString();
        
        // 计算新便签位置，避免堆叠：基于现有便签最大坐标偏移
        const existingNotes = getStickyNotes(boardId);
        let positionX = 120;
        let positionY = 100;
        
        if (existingNotes.length > 0) {
          const maxX = Math.max(...existingNotes.map(n => n.positionX));
          const maxY = Math.max(...existingNotes.map(n => n.positionY));
          const lastNote = existingNotes[existingNotes.length - 1];
          
          // 每次新增便签时，在现有最大坐标基础上向右下偏移
          positionX = lastNote.positionX + 40 + Math.random() * 30;
          positionY = lastNote.positionY + 50 + Math.random() * 40;
          
          // 如果超出一定范围，重新回到左上区域，避免无限向右下移动
          if (positionX > 600) positionX = 100 + Math.random() * 200;
          if (positionY > 500) positionY = 80 + Math.random() * 200;
        }
        
        const newNote = { 
          id: Date.now().toString(36), 
          boardId, 
          title: data.title || '', 
          content: data.content || '', 
          color: data.color || '#FFE082', 
          positionX: data.positionX || positionX, 
          positionY: data.positionY || positionY, 
          sourceCreativityIds: data.sourceCreativityIds || null, 
          sortOrder: data.sortOrder || 0,
          type: data.type || 'note',
          creativeChainId: data.creativeChainId,
          tags: data.tags,
          createdAt: now, 
          updatedAt: now 
        };
        
        // 保存到 localStorage
        const notes = getStickyNotes(boardId);
        notes.push(newNote);
        saveStickyNotes(boardId, notes);
        
        return newNote;
      },
      update: async (noteId: string, data: any) => {
        if (isElectron) return window.electronAPI.board.sticky.update(null, noteId, data);
        await delay(100);
        const now = new Date().toISOString();
        
        // 更新 localStorage 中的数据
        // 需要找到对应的 boardId，这里做一个简单的处理：遍历所有 board 的 notes
        for (const key in localStorage) {
          if (key.startsWith('mindvault-sticky-notes-')) {
            const boardId = key.replace('mindvault-sticky-notes-', '');
            const notes = getStickyNotes(boardId);
            const index = notes.findIndex(n => n.id === noteId);
            if (index !== -1) {
              notes[index] = { ...notes[index], ...data, updatedAt: now };
              saveStickyNotes(boardId, notes);
              return notes[index];
            }
          }
        }
        
        return { id: noteId, ...data, updatedAt: now };
      },
      remove: async (noteId: string) => {
        if (isElectron) return window.electronAPI.board.sticky.remove(null, noteId);
        await delay(50);
        
        // 从 localStorage 删除，遍历所有 board 的 notes
        for (const key in localStorage) {
          if (key.startsWith('mindvault-sticky-notes-')) {
            const boardId = key.replace('mindvault-sticky-notes-', '');
            const notes = getStickyNotes(boardId);
            const filtered = notes.filter(n => n.id !== noteId);
            if (filtered.length !== notes.length) {
              saveStickyNotes(boardId, filtered);
            }
          }
        }
        
        return true;
      },
    },

    // --- 看板创意链 ---
    creativeChain: {
      list: async (boardId: string) => {
        if (isElectron) return window.electronAPI.board.creativeChain.list(boardId);
        await delay(100);
        // 从 localStorage 读取
        return getCreativeChains(boardId);
      },
      create: async (boardId: string, data: any) => {
        if (isElectron) return window.electronAPI.board.creativeChain.create(boardId, data);
        await delay(100);
        const now = new Date().toISOString();
        const newChain = {
          id: Date.now().toString(36),
          boardId,
          name: data.name || '未命名创意链',
          description: data.description,
          tags: data.tags,
          color: data.color,
          snapshot: data.snapshot || { items: [], edges: [] },
          createdAt: now,
          updatedAt: now,
        };
        
        // 保存到 localStorage
        const chains = getCreativeChains(boardId);
        chains.push(newChain);
        saveCreativeChains(boardId, chains);
        
        return newChain;
      },
      read: async (boardId: string, chainId: string) => {
        if (isElectron) return window.electronAPI.board.creativeChain.read(boardId, chainId);
        await delay(100);
        // 从 localStorage 读取
        const chains = getCreativeChains(boardId);
        return chains.find(c => c.id === chainId) || null;
      },
      update: async (boardId: string, chainId: string, data: any) => {
        if (isElectron) return window.electronAPI.board.creativeChain.update(boardId, chainId, data);
        await delay(100);
        const now = new Date().toISOString();
        
        // 更新 localStorage 中的数据
        const chains = getCreativeChains(boardId);
        const index = chains.findIndex(c => c.id === chainId);
        if (index !== -1) {
          chains[index] = { ...chains[index], ...data, updatedAt: now };
          saveCreativeChains(boardId, chains);
          return chains[index];
        }
        
        return { id: chainId, ...data, updatedAt: now };
      },
      delete: async (boardId: string, chainId: string) => {
        if (isElectron) return window.electronAPI.board.creativeChain.delete(boardId, chainId);
        await delay(50);
        
        // 从 localStorage 删除
        const chains = getCreativeChains(boardId);
        const filtered = chains.filter(c => c.id !== chainId);
        if (filtered.length !== chains.length) {
          saveCreativeChains(boardId, filtered);
        }
        
        return true;
      },
    },

    // --- 看板图谱 ---
    graph: {
      listNodes: async (boardId: string) => {
        if (isElectron) return window.electronAPI.board.graph.listNodes(boardId);
        await delay(100);
        // mock: 返回示例图谱节点（树形结构）
        const now = new Date().toISOString();
        return [
          { id: 'gn-1', boardId, creativityId: 'mock-1', parentId: null, positionX: null, positionY: null, nodeType: 'creativity', label: null, createdAt: now, creativity: mockCreativities[0] },
          { id: 'gn-2', boardId, creativityId: 'mock-2', parentId: 'gn-1', positionX: null, positionY: null, nodeType: 'creativity', label: null, createdAt: now, creativity: mockCreativities[1] },
          { id: 'gn-3', boardId, creativityId: 'mock-3', parentId: 'gn-1', positionX: null, positionY: null, nodeType: 'creativity', label: null, createdAt: now, creativity: mockCreativities[2] },
        ];
      },
      addNode: async (boardId: string, data: any) => {
        if (isElectron) return window.electronAPI.board.graph.addNode(boardId, data);
        await delay(100);
        return { id: Date.now().toString(36), boardId, creativityId: data.creativityId || null, parentId: data.parentId || null, positionX: data.positionX || null, positionY: data.positionY || null, nodeType: data.nodeType || 'creativity', label: data.label || null, createdAt: new Date().toISOString() };
      },
      updatePosition: async (nodeId: string, x: number, y: number) => {
        if (isElectron) return window.electronAPI.board.graph.updatePosition(nodeId, x, y);
        await delay(50);
        return true;
      },
      removeNode: async (nodeId: string) => {
        if (isElectron) return window.electronAPI.board.graph.removeNode(nodeId);
        await delay(50);
        return true;
      },
      listEdges: async (boardId: string) => {
        if (isElectron) return window.electronAPI.board.graph.listEdges(boardId);
        await delay(100);
        // mock: 返回示例图谱连线
        const now = new Date().toISOString();
        return [
          { id: 'ge-1', boardId, sourceNodeId: 'gn-1', targetNodeId: 'gn-2', edgeType: 'child', createdAt: now },
          { id: 'ge-2', boardId, sourceNodeId: 'gn-1', targetNodeId: 'gn-3', edgeType: 'child', createdAt: now },
        ];
      },
      addEdge: async (boardId: string, sourceId: string, targetId: string, edgeType: string) => {
        if (isElectron) return window.electronAPI.board.graph.addEdge(boardId, sourceId, targetId, edgeType);
        await delay(100);
        return { id: Date.now().toString(36), boardId, sourceNodeId: sourceId, targetNodeId: targetId, edgeType: edgeType || 'child', createdAt: new Date().toISOString() };
      },
      removeEdge: async (edgeId: string) => {
        if (isElectron) return window.electronAPI.board.graph.removeEdge(edgeId);
        await delay(50);
        return true;
      },
      getSubtree: async (nodeId: string) => {
        if (isElectron) return window.electronAPI.board.graph.getSubtree(nodeId);
        await delay(100);
        return [];
      },
    },

    // --- 看板文件夹 ---
    folder: {
      list: async (boardId: string) => {
        if (isElectron) return window.electronAPI.board.folder.list(boardId);
        await delay(100);
        // mock: 返回示例文件夹
        const now = new Date().toISOString();
        return [
          { id: 'f-1', boardId, name: '产品创意', color: '#6366f1', icon: '📦', sortOrder: 0, createdAt: now, itemCount: 1 },
          { id: 'f-2', boardId, name: '写作灵感', color: '#10b981', icon: '✍️', sortOrder: 1, createdAt: now, itemCount: 1 },
        ];
      },
      create: async (boardId: string, name: string, color?: string) => {
        if (isElectron) return window.electronAPI.board.folder.create(boardId, { name, color });
        await delay(100);
        return { id: Date.now().toString(36), boardId, name, color: color || '#6366f1', icon: null, sortOrder: 0, createdAt: new Date().toISOString() };
      },
      update: async (folderId: string, data: any) => {
        if (isElectron) return window.electronAPI.board.folder.update(null, folderId, data);
        await delay(100);
        return { id: folderId, ...data };
      },
      delete: async (folderId: string) => {
        if (isElectron) return window.electronAPI.board.folder.delete(null, folderId);
        await delay(50);
        return true;
      },
      addItems: async (folderId: string, creativityIds: string[]) => {
        if (isElectron) {
          for (const cid of creativityIds) {
            await window.electronAPI.board.folder.addItems(null, folderId, cid);
          }
          return true;
        }
        await delay(100);
        return true;
      },
      removeItems: async (folderId: string, creativityIds: string[]) => {
        if (isElectron) {
          for (const cid of creativityIds) {
            await window.electronAPI.board.folder.removeItems(null, folderId, cid);
          }
          return true;
        }
        await delay(50);
        return true;
      },
      getItems: async (folderId: string) => {
        if (isElectron) return window.electronAPI.board.folder.getItems(null, folderId);
        await delay(100);
        // mock: 返回文件夹内容
        if (folderId === 'f-1') return [mockCreativities[1]];
        if (folderId === 'f-2') return [mockCreativities[2]];
        return [];
      },
    },

    // --- 看板-创意关联 ---
    listCreativities: async (boardId: string) => {
      if (isElectron) return window.electronAPI.board.listCreativities(boardId);
      await delay(100);
      // mock: 返回所有活跃创意作为看板关联
      const savedState = restoreCreativityState();
      return mockCreativities.map((c: any) => {
        if (savedState[c.id]) {
          return { ...c, ...savedState[c.id] };
        }
        return c;
      }).filter((c: any) => c.status === 'active');
    },
    addCreativityRelation: async (boardId: string, creativityId: string) => {
      if (isElectron) return window.electronAPI.board.addCreativityRelation(boardId, creativityId);
      await delay(50);
      return true;
    },
    removeCreativityRelation: async (boardId: string, creativityId: string) => {
      if (isElectron) return window.electronAPI.board.removeCreativityRelation(boardId, creativityId);
      await delay(50);
      return true;
    },
    uploadIcon: async (boardId: string, imageData: string) => {
      if (isElectron) return window.electronAPI.board.uploadIcon(boardId, imageData);
      await delay(200);
      return '/mock/icon-path.png';
    },
    updateIcon: async (boardId: string, iconPath: string) => {
      if (isElectron) return window.electronAPI.board.updateIcon(boardId, iconPath);
      await delay(100);
      return true;
    },
    deleteIcon: async (boardId: string) => {
      if (isElectron) return window.electronAPI.board.deleteIcon(boardId);
      await delay(100);
      return true;
    },
  },

  // --- 标签管理 ---
  tag: {
    create: async (data: any) => {
      if (isElectron) return window.electronAPI.tag.create(data);
      await delay(200);
      const item = { ...data, id: Date.now().toString(36), createdAt: new Date().toISOString() };
      mockTags.push(item);
      return item;
    },
    list: async () => {
      if (isElectron) return window.electronAPI.tag.list();
      await delay(100);
      return mockTags;
    },
    delete: async (id: string) => {
      if (isElectron) return window.electronAPI.tag.delete(id);
      await delay(100);
      const idx = mockTags.findIndex((t: any) => t.id === id);
      if (idx >= 0) mockTags.splice(idx, 1);
      return true;
    },
  },

  // --- 模板 ---
  template: {
    list: async () => {
      if (isElectron) return window.electronAPI.template.list();
      await delay(100);
      return mockTemplates;
    },
    get: async (id: string) => {
      if (isElectron) return window.electronAPI.template.get(id);
      await delay(100);
      return mockTemplates.find((t: any) => t.id === id) || null;
    },
    create: async (data: any) => {
      if (isElectron) {
        return window.electronAPI.template.create(data);
      }
      await delay(200);
      const item = { id: Date.now().toString(36), ...data, isBuiltin: false, createdAt: new Date().toISOString() };
      mockTemplates.push(item);
      return item;
    },
    update: async (id: string, data: any) => {
      if (isElectron) return window.electronAPI.template.update(id, data);
      await delay(200);
      const idx = mockTemplates.findIndex((t: any) => t.id === id);
      if (idx >= 0) {
        mockTemplates[idx] = { ...mockTemplates[idx], ...data, updatedAt: new Date().toISOString() };
        return mockTemplates[idx];
      }
      return null;
    },
    delete: async (id: string) => {
      if (isElectron) return window.electronAPI.template.delete(id);
      await delay(100);
      const idx = mockTemplates.findIndex((t: any) => t.id === id);
      if (idx >= 0) mockTemplates.splice(idx, 1);
      return true;
    },
  },

  // --- 设置 ---
  settings: {
    get: async (key: string) => {
      if (isElectron) return window.electronAPI.settings.get(key);
      await delay(50);
      return (mockSettings as any)[key] ?? null;
    },
    set: async (key: string, value: any) => {
      if (isElectron) return window.electronAPI.settings.set(key, value);
      await delay(100);
      (mockSettings as any)[key] = value;
      return true;
    },
  },

  // --- 搜索 ---
  search: {
    fulltext: async (keyword: string) => {
      if (isElectron) return window.electronAPI.search.fulltext(keyword);
      await delay(200);
      const kw = keyword.toLowerCase();
      const savedState = restoreCreativityState();
      return mockCreativities.map((c: any) => {
        if (savedState[c.id]) {
          return { ...c, ...savedState[c.id] };
        }
        return c;
      }).filter((c: any) =>
        c.status === 'active' && ((c as any).title.toLowerCase().includes(kw) || (c.content || '').toLowerCase().includes(kw))
      );
    },
    filter: async (filters: any) => {
      if (isElectron) return window.electronAPI.search.filter(filters);
      await delay(200);
      const savedState = restoreCreativityState();
      let items = mockCreativities.map((c: any) => {
        if (savedState[c.id]) {
          return { ...c, ...savedState[c.id] };
        }
        return c;
      }).filter((c: any) => c.status === 'active');
      if (filters.types) items = items.filter((c: any) => filters.types.includes(c.type));
      if (filters.priorityMin) items = items.filter((c: any) => c.priority >= filters.priorityMin);
      return items;
    },
  },

  // --- 导出 ---
  export: {
    json: async (ids?: string[]) => {
      if (isElectron) return window.electronAPI.export.json(ids);
      await delay(200);
      const savedState = restoreCreativityState();
      const items = mockCreativities.map((c: any) => {
        if (savedState[c.id]) {
          return { ...c, ...savedState[c.id] };
        }
        return c;
      }).filter((c: any) => c.status === 'active');
      return JSON.stringify(items, null, 2);
    },
    html: async (ids?: string[]) => {
      if (isElectron) return window.electronAPI.export.html(ids);
      await delay(200);
      const savedState = restoreCreativityState();
      const items = mockCreativities.map((c: any) => {
        if (savedState[c.id]) {
          return { ...c, ...savedState[c.id] };
        }
        return c;
      }).filter((c: any) => c.status === 'active');
      const itemsHtml = items.map((c: any) => `
        <article style="margin-bottom:24px;padding:20px;border:1px solid #e5e7eb;border-radius:12px;background:#fff;">
          <h2 style="margin:0 0 8px;font-size:18px;color:#1f2937;">${(c.emojiReaction || '') + (c.title ? ' ' + c.title : '')}</h2>
          <div style="display:flex;gap:8px;margin-bottom:12px;">
            <span style="font-size:12px;padding:2px 8px;border-radius:99px;background:#f3f4f6;color:#6b7280;">${c.type}</span>
            ${(c.tags || []).map((t: any) => `<span style="font-size:12px;padding:2px 8px;border-radius:99px;background:#eff6ff;color:#3b82f6;">#${t.name}</span>`).join('')}
            ${c.priority > 0 ? `<span style="font-size:12px;color:#f59e0b;">${'★'.repeat(c.priority)}</span>` : ''}
          </div>
          <div style="font-size:14px;color:#374151;line-height:1.8;white-space:pre-wrap;">${(c.content || '').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/\n/g, '<br>')}</div>
          <div style="margin-top:12px;font-size:12px;color:#9ca3af;">创建于 ${new Date(c.createdAt).toLocaleString('zh-CN')}</div>
        </article>
      `).join('');
      return `<!DOCTYPE html><html lang="zh-CN"><head><meta charset="UTF-8"><title>脑洞集导出</title><style>body{font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',sans-serif;max-width:800px;margin:40px auto;padding:0 20px;background:#f9fafb;color:#1f2937;}h1{text-align:center;margin-bottom:32px;}</style></head><body><h1>🧠 脑洞集导出</h1><p style="text-align:center;color:#6b7280;margin-bottom:32px;">共 ${items.length} 条创意 · 导出时间 ${new Date().toLocaleString('zh-CN')}</p>${itemsHtml}</body></html>`;
    },
    markdown: async (ids?: string[]) => {
      if (isElectron) return window.electronAPI.export.markdown(ids);
      await delay(200);
      const savedState = restoreCreativityState();
      const items = mockCreativities.map((c: any) => {
        if (savedState[c.id]) {
          return { ...c, ...savedState[c.id] };
        }
        return c;
      }).filter((c: any) => c.status === 'active');
      return '# 脑洞集导出\n\n' + items.map((c: any) => `## ${c.title}\n\n${c.content}`).join('\n\n---\n\n');
    },
  },

  // --- 备份 ---
  backup: {
    create: async () => {
      if (isElectron) return window.electronAPI.backup.create();
      await delay(300);
      return { success: true, path: '/mock/backup.json' };
    },
  },

  // --- 媒体 ---
  media: {
    list: async () => {
      if (isElectron) return window.electronAPI.media.list();
      await delay(100);
      return [];
    },
    listByCreativity: async (creativityId: string) => {
      if (isElectron) return window.electronAPI.media.listByCreativity(creativityId);
      await delay(100);
      return [];
    },
    save: async (data: any, creativityId?: string) => {
      if (isElectron) return window.electronAPI.media.save(data, creativityId);
      await delay(200);
      return { success: true, data: { id: Date.now().toString(36), filePath: '/mock/media.png', fileName: 'mock.png', fileType: data.fileType || 'image' } };
    },
    saveImage: async (imageDataUrl: string, creativityId?: string) => {
      if (isElectron) return window.electronAPI.media.saveImage(imageDataUrl, creativityId);
      await delay(200);
      return { success: true, data: { id: Date.now().toString(36), filePath: '/mock/image.png' } };
    },
    read: async (idOrPath: string) => {
      if (isElectron) return window.electronAPI.media.read(idOrPath);
      await delay(100);
      return null;
    },
    delete: async (id: string) => {
      if (isElectron) return window.electronAPI.media.delete(id);
      await delay(100);
      return { success: true };
    },
    thumbnail: async (idOrPath: string) => {
      if (isElectron) return window.electronAPI.media.thumbnail(idOrPath);
      await delay(100);
      return null;
    },
    getUrl: async (filePath: string) => {
      if (isElectron) return window.electronAPI.media.getUrl(filePath);
      return filePath;
    },
    selectFile: async (options?: any) => {
      if (isElectron) return window.electronAPI.media.selectFile(options);
      await delay(100);
      return null;
    },
    linkToCreativity: async (mediaIds: string[], creativityId: string) => {
      if (isElectron) return window.electronAPI.media.linkToCreativity(mediaIds, creativityId);
      await delay(100);
      return { success: true, updatedCount: mediaIds.length };
    },
    getThumbnailUrl: async (mediaId: string) => {
      if (isElectron) return window.electronAPI.media.getThumbnailUrl(mediaId);
      await delay(100);
      return null;
    },
    getFileInfo: async (filePath: string) => {
      if (isElectron) return window.electronAPI.media.getFileInfo(filePath);
      await delay(100);
      return null;
    },
    readFileHead: async (filePath: string, maxBytes?: number) => {
      if (isElectron) return window.electronAPI.media.readFileHead(filePath, maxBytes);
      await delay(100);
      return null;
    },
    readFileAsBase64: async (filePath: string) => {
      if (isElectron) return window.electronAPI.media.readFileAsBase64(filePath);
      await delay(100);
      return null;
    },
    migrateContentReferences: async () => {
      if (isElectron) return window.electronAPI.media.migrateContentReferences();
      return { migrated: 0, skipped: 0 };
    },
    loadAllPaths: async () => {
      if (isElectron) return window.electronAPI.media.loadAllPaths();
      return [];
    },
    importFromPath: async (filePath: string, options?: any) => {
      if (isElectron) return window.electronAPI.media.importFromPath(filePath, options);
      await delay(200);
      return { success: true, data: { id: Date.now().toString(36), filePath: '/mock/media.png', fileName: 'mock.png', fileType: options?.fileType || 'image' } };
    },
  },

  file: {
    getPathForFile: (file: File) => {
      if (isElectron) return window.electronAPI.file.getPathForFile(file);
      return '';
    },
    selectMultiple: async (filters?: any[]) => {
      if (isElectron) return window.electronAPI.file.selectMultiple(filters);
      return [];
    },
  },

  // --- 窗口 ---
  window: {
    minimize: async () => { if (isElectron) window.electronAPI.window.minimize(); },
    maximize: async () => { if (isElectron) window.electronAPI.window.maximize(); },
    close: async () => { if (isElectron) window.electronAPI.window.close(); },
  },

  // --- 字体文件 ---
  font: {
    selectFiles: async (filters?: any[]) => {
      if (isElectron) return window.electronAPI.file.selectMultiple(filters);
      await delay(100);
      return [];
    },
    readTextFile: async (filePath: string) => {
      if (isElectron) return window.electronAPI.file.readTextFile(filePath);
      await delay(100);
      return null;
    },
  },

  // --- 回收站 ---
  trash: {
    list: async () => {
      if (isElectron) return window.electronAPI.trash.list();
      await delay(100);
      // 返回 mock 回收站数据
      return getMockTrashItems();
    },
    add: async (data: any) => {
      if (isElectron) return window.electronAPI.trash.add(data);
      await delay(100);
      return data;
    },
    restore: async (trashItemId: string) => {
      if (isElectron) return window.electronAPI.trash.restore(trashItemId);
      await delay(100);
      return null;
    },
    permanentDelete: async (trashItemId: string) => {
      if (isElectron) return window.electronAPI.trash.permanentDelete(trashItemId);
      await delay(100);
      return true;
    },
    clear: async () => {
      if (isElectron) return window.electronAPI.trash.clear();
      await delay(100);
      return true;
    },
    checkBoardExists: async (boardId: string) => {
      if (isElectron) return window.electronAPI.trash.checkBoardExists(boardId);
      await delay(100);
      return null;
    },

    // ===== 新增功能 =====

    // 1. 搜索功能
    search: async (keyword: string, filters?: any) => {
      if (isElectron) return window.electronAPI.trash.search(keyword, filters);
      await delay(100);
      return [];
    },

    // 2. 预览功能
    preview: async (trashItemId: string) => {
      if (isElectron) return window.electronAPI.trash.preview(trashItemId);
      await delay(100);
      return null;
    },

    // 3. 智能恢复
    restoreSmart: async (trashItemId: string, targetBoardId?: string) => {
      if (isElectron) return window.electronAPI.trash.restoreSmart(trashItemId, targetBoardId);
      await delay(100);
      return { success: false, error: '浏览器环境不支持' };
    },

    // 4. 获取版本历史
    getVersions: async (trashItemId: string) => {
      if (isElectron) return window.electronAPI.trash.getVersions(trashItemId);
      await delay(100);
      return [];
    },

    // 5. 恢复到特定版本
    restoreVersion: async (versionId: string) => {
      if (isElectron) return window.electronAPI.trash.restoreVersion(versionId);
      await delay(100);
      return { success: false, error: '浏览器环境不支持' };
    },

    // 6. 项目对比
    compare: async (itemId1: string, itemId2: string) => {
      if (isElectron) return window.electronAPI.trash.compare(itemId1, itemId2);
      await delay(100);
      return { success: false, error: '浏览器环境不支持' };
    },

    // 7. 统计信息
    getStats: async () => {
      if (isElectron) return window.electronAPI.trash.getStats();
      await delay(100);
      return null;
    },

    // 8. 容量信息
    getCapacity: async () => {
      if (isElectron) return window.electronAPI.trash.getCapacity();
      await delay(100);
      return null;
    },

    // 9. 获取设置
    getSettings: async () => {
      if (isElectron) return window.electronAPI.trash.getSettings();
      await delay(100);
      return {
        autoCleanEnabled: false,
        autoCleanDays: 30,
        maxCapacityMB: 500,
        notificationEnabled: true,
        cloudSyncEnabled: false,
        cloudSyncProvider: null,
        lastCleanTime: null,
        smartCleanEnabled: false,
      };
    },

    // 10. 更新设置
    updateSettings: async (settings: any) => {
      if (isElectron) return window.electronAPI.trash.updateSettings(settings);
      await delay(100);
      return false;
    },

    // 11. 自动清理
    autoClean: async () => {
      if (isElectron) return window.electronAPI.trash.autoClean();
      await delay(100);
      return { success: false, error: '浏览器环境不支持' };
    },

    // 12. 获取关联关系
    getRelations: async (trashItemId: string) => {
      if (isElectron) return window.electronAPI.trash.getRelations(trashItemId);
      await delay(100);
      return [];
    },

    // 13. 获取操作历史
    getHistory: async (options?: any) => {
      if (isElectron) return window.electronAPI.trash.getHistory(options);
      await delay(100);
      return [];
    },

    // 14. 记录操作历史
    addHistory: async (record: any) => {
      if (isElectron) return window.electronAPI.trash.addHistory(record);
      await delay(100);
      return false;
    },

    // 15. 生成智能标签
    generateSmartLabels: async (trashItemId: string) => {
      if (isElectron) return window.electronAPI.trash.generateSmartLabels(trashItemId);
      await delay(100);
      return [];
    },

    // 16. 获取删除影响评估
    getDeleteImpact: async (trashItemId: string) => {
      if (isElectron) return window.electronAPI.trash.getDeleteImpact(trashItemId);
      await delay(100);
      return null;
    },

    // 17. 批量恢复
    batchRestore: async (trashItemIds: string[], targetBoardId?: string) => {
      if (isElectron) return window.electronAPI.trash.batchRestore(trashItemIds, targetBoardId);
      await delay(100);
      return { success: false, error: '浏览器环境不支持' };
    },

    // 18. 批量永久删除
    batchPermanentDelete: async (trashItemIds: string[]) => {
      if (isElectron) return window.electronAPI.trash.batchPermanentDelete(trashItemIds);
      await delay(100);
      return { success: false, error: '浏览器环境不支持' };
    },

    // ===== 预留功能接口 =====

    // 19. AI 建议（预留）
    getAISuggestions: async () => {
      if (isElectron) return window.electronAPI.trash.getAISuggestions();
      await delay(100);
      return [];
    },

    // 20. 云同步状态（预留）
    getCloudStatus: async (trashItemId: string) => {
      if (isElectron) return window.electronAPI.trash.getCloudStatus(trashItemId);
      await delay(100);
      return null;
    },

    // 21. 同步到云端（预留）
    syncToCloud: async (trashItemId: string) => {
      if (isElectron) return window.electronAPI.trash.syncToCloud(trashItemId);
      await delay(100);
      return { success: false, error: '云同步功能尚未实现' };
    },

    // 22. 分享到团队（预留）
    shareToTeam: async (trashItemId: string, teamId: string) => {
      if (isElectron) return window.electronAPI.trash.shareToTeam(trashItemId, teamId);
      await delay(100);
      return { success: false, error: '团队协作功能尚未实现' };
    },
  },

  shell: {
    openExternal: async (url: string) => {
      if (isElectron && window.electronAPI.shell?.openExternal) {
        return window.electronAPI.shell.openExternal(url);
      }
      window.open(url, '_blank');
    },
  },

  updater: {
    check: async () => {
      if (isElectron && window.electronAPI.updater?.check) {
        return window.electronAPI.updater.check();
      }
      return { hasUpdate: false, version: '1.0.0' };
    },
  },

  // --- 音乐库 ---
  music: {
    importFiles: async (filePaths: string[]) => {
      if (isElectron && window.electronAPI?.music?.importFiles) {
        return window.electronAPI.music.importFiles(filePaths);
      }
      await delay(200);
      return [];
    },
    getAllTracks: async () => {
      if (isElectron && window.electronAPI?.music?.getAllTracks) {
        return window.electronAPI.music.getAllTracks();
      }
      await delay(100);
      return [];
    },
    getTrack: async (id: string) => {
      if (isElectron && window.electronAPI?.music?.getTrack) {
        return window.electronAPI.music.getTrack(id);
      }
      await delay(100);
      return null;
    },
    deleteTrack: async (id: string) => {
      if (isElectron && window.electronAPI?.music?.deleteTrack) {
        return window.electronAPI.music.deleteTrack(id);
      }
      await delay(100);
      return false;
    },
    searchTracks: async (query: string) => {
      if (isElectron && window.electronAPI?.music?.searchTracks) {
        return window.electronAPI.music.searchTracks(query);
      }
      await delay(100);
      return [];
    },
    toggleFavorite: async (id: string) => {
      if (isElectron && window.electronAPI?.music?.toggleFavorite) {
        return window.electronAPI.music.toggleFavorite(id);
      }
      await delay(100);
      return false;
    },
    getFavorites: async () => {
      if (isElectron && window.electronAPI?.music?.getFavorites) {
        return window.electronAPI.music.getFavorites();
      }
      await delay(100);
      return [];
    },
    updateTrack: async (id: string, updates: any) => {
      if (isElectron && window.electronAPI?.music?.updateTrack) {
        return window.electronAPI.music.updateTrack(id, updates);
      }
      await delay(100);
      return false;
    },
    readMetadata: async (filePath: string) => {
      if (isElectron && window.electronAPI?.music?.readMetadata) {
        return window.electronAPI.music.readMetadata(filePath);
      }
      await delay(100);
      return { title: '', artist: '', album: '', duration: 0 };
    },
    // 歌单相关
    createPlaylist: async (name: string, description?: string) => {
      if (isElectron && window.electronAPI?.music?.createPlaylist) {
        return window.electronAPI.music.createPlaylist(name, description);
      }
      await delay(100);
      return { success: false, data: null };
    },
    getAllPlaylists: async () => {
      if (isElectron && window.electronAPI?.music?.getAllPlaylists) {
        return window.electronAPI.music.getAllPlaylists();
      }
      await delay(100);
      return { success: true, data: [] };
    },
    getPlaylist: async (id: string) => {
      if (isElectron && window.electronAPI?.music?.getPlaylist) {
        return window.electronAPI.music.getPlaylist(id);
      }
      await delay(100);
      return { success: false, data: null };
    },
    updatePlaylist: async (id: string, updates: any) => {
      if (isElectron && window.electronAPI?.music?.updatePlaylist) {
        return window.electronAPI.music.updatePlaylist(id, updates);
      }
      await delay(100);
      return { success: false, data: false };
    },
    deletePlaylist: async (id: string) => {
      if (isElectron && window.electronAPI?.music?.deletePlaylist) {
        return window.electronAPI.music.deletePlaylist(id);
      }
      await delay(100);
      return { success: false, data: false };
    },
    addTrackToPlaylist: async (playlistId: string, trackId: string) => {
      if (isElectron && window.electronAPI?.music?.addTrackToPlaylist) {
        return window.electronAPI.music.addTrackToPlaylist(playlistId, trackId);
      }
      await delay(100);
      return { success: false, data: false };
    },
    removeTrackFromPlaylist: async (playlistId: string, trackId: string) => {
      if (isElectron && window.electronAPI?.music?.removeTrackFromPlaylist) {
        return window.electronAPI.music.removeTrackFromPlaylist(playlistId, trackId);
      }
      await delay(100);
      return { success: false, data: false };
    },
    getPlaylistTracks: async (playlistId: string) => {
      if (isElectron && window.electronAPI?.music?.getPlaylistTracks) {
        return window.electronAPI.music.getPlaylistTracks(playlistId);
      }
      await delay(100);
      return { success: true, data: [] };
    },
    reorderPlaylistTracks: async (playlistId: string, trackIds: string[]) => {
      if (isElectron && window.electronAPI?.music?.reorderPlaylistTracks) {
        return window.electronAPI.music.reorderPlaylistTracks(playlistId, trackIds);
      }
      await delay(100);
      return { success: false, data: false };
    },
    // 播放历史统计
    recordPlay: async (params: {
      trackId: string; trackTitle: string; trackArtist: string; trackAlbum: string;
      source: string; durationPlayed: number; totalDuration: number; playSessionId: string;
    }) => {
      if (isElectron && window.electronAPI?.music?.recordPlay) {
        return window.electronAPI.music.recordPlay(params);
      }
      // 浏览器环境降级：静默忽略
      await delay(50);
      return { success: true, data: true };
    },
    getPlayStats: async (options?: { period?: string }) => {
      if (isElectron && window.electronAPI?.music?.getPlayStats) {
        return window.electronAPI.music.getPlayStats(options);
      }
      // 浏览器环境降级：返回空统计数据
      await delay(100);
      return {
        success: true,
        data: {
          totalPlays: 0,
          totalDuration: 0,
          uniqueTracks: 0,
          topTracks: [],
          topArtists: [],
          topAlbums: [],
          hourlyDistribution: new Array(24).fill(0),
          dailyDistribution: [],
          recentPlays: [],
          sourceDistribution: { local: 0, online: 0, preset: 0 },
          avgCompletionRate: 0,
          longestSession: { trackTitle: '', durationPlayed: 0 },
        },
      };
    },
    // 多源音乐搜索
    aggregateSearch: async (options: { keyword: string; sources?: string[]; limit?: number }, cookie?: string) => {
      console.log('[API] aggregateSearch called, isElectron:', isElectron, 'has music.aggregateSearch:', !!window.electronAPI?.music?.aggregateSearch);
      if (isElectron && window.electronAPI?.music?.aggregateSearch) {
        try {
          const result = await window.electronAPI.music.aggregateSearch(options, cookie);
          console.log('[API] aggregateSearch result:', result);
          return result;
        } catch (e: any) {
          console.error('[API] aggregateSearch error:', e);
          return { success: false, error: e?.message || 'IPC调用失败', data: { songs: [], total: 0, bySource: {} } };
        }
      }
      console.warn('[API] aggregateSearch: not in Electron or API not available');
      await delay(200);
      return { success: false, error: '不在Electron环境或API不可用', data: { songs: [], total: 0, bySource: {} } };
    },
    searchNetease: async (keyword: string, limit?: number, cookie?: string) => {
      if (isElectron && window.electronAPI?.music?.searchNetease) {
        return window.electronAPI.music.searchNetease(keyword, limit, cookie);
      }
      await delay(200);
      return { success: false, data: [] };
    },
    searchQQ: async (keyword: string, limit?: number) => {
      if (isElectron && window.electronAPI?.music?.searchQQ) {
        return window.electronAPI.music.searchQQ(keyword, limit);
      }
      await delay(200);
      return { success: false, data: [] };
    },
    searchKugou: async (keyword: string, limit?: number) => {
      if (isElectron && window.electronAPI?.music?.searchKugou) {
        return window.electronAPI.music.searchKugou(keyword, limit);
      }
      await delay(200);
      return { success: false, data: [] };
    },
    searchMigu: async (keyword: string, limit?: number) => {
      if (isElectron && window.electronAPI?.music?.searchMigu) {
        return window.electronAPI.music.searchMigu(keyword, limit);
      }
      await delay(200);
      return { success: false, data: [] };
    },
    searchBaidu: async (keyword: string, limit?: number) => {
      if (isElectron && window.electronAPI?.music?.searchBaidu) {
        return window.electronAPI.music.searchBaidu(keyword, limit);
      }
      await delay(200);
      return { success: false, data: [] };
    },
    searchKuwo: async (keyword: string, limit?: number) => {
      if (isElectron && window.electronAPI?.music?.searchKuwo) {
        return window.electronAPI.music.searchKuwo(keyword, limit);
      }
      await delay(200);
      return { success: false, data: [] };
    },
    getMultiSourceUrl: async (song: any, cookie?: string) => {
      if (isElectron && window.electronAPI?.music?.getMultiSourceUrl) {
        return window.electronAPI.music.getMultiSourceUrl(song, cookie);
      }
      await delay(100);
      return { success: false, data: null };
    },
    getMultiSourceLyric: async (song: any) => {
      if (isElectron && window.electronAPI?.music?.getMultiSourceLyric) {
        return window.electronAPI.music.getMultiSourceLyric(song);
      }
      await delay(100);
      return { success: false, data: '' };
    },
  },

  // --- 在线音乐 (QQ音乐) ---
  musicOnline: {
    search: (params: { keyword: string; page?: number; limit?: number }) =>
      window.electronAPI?.musicOnline?.search(params) ?? Promise.resolve({ success: false, data: { songs: [], total: 0 } }),
    getUrl: (params: { songmid: string }) =>
      window.electronAPI?.musicOnline?.getUrl(params) ?? Promise.resolve({ success: false, data: { url: null } }),
    getLyric: (songmid: string) =>
      window.electronAPI?.musicOnline?.getLyric(songmid) ?? Promise.resolve({ success: false, data: { lrc: '', tlyric: '' } }),
    getDetail: (songmids: string[]) =>
      window.electronAPI?.musicOnline?.getDetail(songmids) ?? Promise.resolve({ success: false, data: [] }),
    getFullDetail: (songId: string) =>
      window.electronAPI?.musicOnline?.getFullDetail(songId) ?? Promise.resolve({ success: false, data: null }),
    setCookie: (cookie: string) =>
      window.electronAPI?.musicOnline?.setCookie(cookie) ?? Promise.resolve({ success: false }),
    getCookie: () =>
      window.electronAPI?.musicOnline?.getCookie() ?? Promise.resolve({ success: false, data: { cookie: '' } }),
    checkCookie: (cookie: string) =>
      window.electronAPI?.musicOnline?.checkCookie(cookie) ?? Promise.resolve({ success: false, data: { valid: false } }),
    // QQ 登录
    loginOpen: () =>
      window.electronAPI?.musicOnline?.loginOpen?.() ?? Promise.resolve({ success: false, error: '不支持' }),
    loginStatus: () =>
      window.electronAPI?.musicOnline?.loginStatus?.() ?? Promise.resolve({ success: false, data: { status: 'closed' } }),
    loginClose: () =>
      window.electronAPI?.musicOnline?.loginClose?.() ?? Promise.resolve({ success: false }),
    // 网易云登录（需求7）
    loginNetease: () =>
      window.electronAPI?.musicOnline?.loginNetease?.() ?? Promise.resolve({ success: false, error: '不支持' }),
    loginNeteaseStatus: () =>
      window.electronAPI?.musicOnline?.loginNeteaseStatus?.() ?? Promise.resolve({ success: false, data: { status: 'closed' } }),
    loginNeteaseClose: () =>
      window.electronAPI?.musicOnline?.loginNeteaseClose?.() ?? Promise.resolve({ success: false }),
    // 榜单功能（需求8）
    getCharts: () =>
      window.electronAPI?.musicOnline?.getCharts?.() ?? Promise.resolve({ success: false, data: { charts: [], total: 0 } }),
    getChartSongs: (params: { chartId: string; limit?: number }) =>
      window.electronAPI?.musicOnline?.getChartSongs?.(params) ?? Promise.resolve({ success: false, data: { songs: [], total: 0 } }),
    // 账号管理（需求9）
    getNeteaseUser: () =>
      window.electronAPI?.musicOnline?.getNeteaseUser?.() ?? Promise.resolve({ success: false, error: '不支持' }),
    checkNeteaseLogin: () =>
      window.electronAPI?.musicOnline?.checkNeteaseLogin?.() ?? Promise.resolve({ success: false, data: { loggedIn: false } }),
    saveAccount: (params: { platform: string; accountInfo: any }) =>
      window.electronAPI?.musicOnline?.saveAccount?.(params) ?? Promise.resolve({ success: false }),
    getSavedAccounts: (platform: string) =>
      window.electronAPI?.musicOnline?.getSavedAccounts?.(platform) ?? Promise.resolve({ success: false, data: { accounts: [] } }),
    deleteAccount: (params: { platform: string; userId: number }) =>
      window.electronAPI?.musicOnline?.deleteAccount?.(params) ?? Promise.resolve({ success: false }),
    switchAccount: (params: { platform: string; userId: number }) =>
      window.electronAPI?.musicOnline?.switchAccount?.(params) ?? Promise.resolve({ success: false, error: '不支持' }),
    logoutNetease: () =>
      window.electronAPI?.musicOnline?.logoutNetease?.() ?? Promise.resolve({ success: false }),
    // 在线歌曲下载（需求10）
    downloadSong: (songInfo: { id: string; name: string; singer: string; coverUrl: string; duration: number }) =>
      window.electronAPI?.musicOnline?.downloadSong?.(songInfo) ?? Promise.resolve({ success: false, error: '不支持' }),
  },

  // --- lx-music-api 音源服务 ---
  lxMusic: {
    checkStatus: () =>
      window.electronAPI?.lxMusic?.checkStatus?.() ?? Promise.resolve({ success: false, data: { online: false } }),
    getUrl: (params: { source: string; songId: string; quality?: string; fallback?: boolean }) =>
      window.electronAPI?.lxMusic?.getUrl?.(params) ?? Promise.resolve({ success: false, error: '不支持' }),
    getInfo: (params: { source: string; songId: string }) =>
      window.electronAPI?.lxMusic?.getInfo?.(params) ?? Promise.resolve({ success: false, error: '不支持' }),
    getLyric: (params: { source: string; songId: string }) =>
      window.electronAPI?.lxMusic?.getLyric?.(params) ?? Promise.resolve({ success: false, error: '不支持' }),
    setApiUrl: (url: string) =>
      window.electronAPI?.lxMusic?.setApiUrl?.(url) ?? Promise.resolve({ success: false }),
    getApiUrl: () =>
      window.electronAPI?.lxMusic?.getApiUrl?.() ?? Promise.resolve({ success: false, data: { url: '' } }),
    getSources: () =>
      window.electronAPI?.lxMusic?.getSources?.() ?? Promise.resolve({ success: false, data: { sources: [] } }),
    syncQQCredentials: (cookie: string) =>
      window.electronAPI?.lxMusic?.syncQQCredentials?.(cookie) ?? Promise.resolve({ success: false }),
  },

  // --- 统一音乐服务 (QQ + 网易云) ---
  musicUnified: {
    searchQQ: (params: { keyword: string; page?: number; limit?: number }) =>
      window.electronAPI?.musicUnified?.searchQQ?.(params) ?? Promise.resolve({ success: false, data: [] }),
    searchNetease: (params: { keyword: string; page?: number; limit?: number }) =>
      window.electronAPI?.musicUnified?.searchNetease?.(params) ?? Promise.resolve({ success: false, data: [] }),
    searchAll: (params: { keyword: string; page?: number; limit?: number }) =>
      window.electronAPI?.musicUnified?.searchAll?.(params) ?? Promise.resolve({ success: false, data: [] }),
    getQQUrl: (params: { songmid: string; quality?: string }) =>
      window.electronAPI?.musicUnified?.getQQUrl?.(params) ?? Promise.resolve({ success: false, error: '不支持' }),
    getNeteaseUrl: (params: { songId: string; cookie?: string }) =>
      window.electronAPI?.musicUnified?.getNeteaseUrl?.(params) ?? Promise.resolve({ success: false, error: '不支持' }),
    getQQLyric: (params: { songmid: string }) =>
      window.electronAPI?.musicUnified?.getQQLyric?.(params) ?? Promise.resolve({ success: false, error: '不支持' }),
    getNeteaseLyric: (params: { songId: string; cookie?: string }) =>
      window.electronAPI?.musicUnified?.getNeteaseLyric?.(params) ?? Promise.resolve({ success: false, error: '不支持' }),
    getQQToplist: () =>
      window.electronAPI?.musicUnified?.getQQToplist?.() ?? Promise.resolve({ success: false, data: [] }),
    getQQTopDetail: (params: { topId: string }) =>
      window.electronAPI?.musicUnified?.getQQTopDetail?.(params) ?? Promise.resolve({ success: false, data: [] }),
    getQQSonglist: (params: { id: string }) =>
      window.electronAPI?.musicUnified?.getQQSonglist?.(params) ?? Promise.resolve({ success: false }),
    setQQCookie: (cookie: string) =>
      window.electronAPI?.musicUnified?.setQQCookie?.(cookie) ?? Promise.resolve({ success: false }),
    getQQCookie: () =>
      window.electronAPI?.musicUnified?.getQQCookie?.() ?? Promise.resolve({ success: false, data: { cookie: '' } }),
    setNeteaseCookie: (cookie: string) =>
      window.electronAPI?.musicUnified?.setNeteaseCookie?.(cookie) ?? Promise.resolve({ success: false }),
    refreshQQLogin: () =>
      window.electronAPI?.musicUnified?.refreshQQLogin?.() ?? Promise.resolve({ success: false }),
    getQQUserInfo: () =>
      window.electronAPI?.musicUnified?.getQQUserInfo?.() ?? Promise.resolve({ success: false, data: null }),
  },

  // --- AI 大模型 ---
  ai: {
    chat: async (messages: any[], config: any) => {
      if (isElectron && window.electronAPI.ai?.chat) {
        return window.electronAPI.ai.chat(messages, config);
      }
      await delay(1000);
      return { success: false, error: 'AI功能仅在桌面应用中可用' };
    },
    chatStream: async (messages: any[], config: any) => {
      if (isElectron && window.electronAPI.ai?.chatStream) {
        return window.electronAPI.ai.chatStream(messages, config);
      }
      await delay(100);
      return { success: false, error: 'AI功能仅在桌面应用中可用' };
    },
    stopGeneration: async () => {
      if (isElectron && window.electronAPI.ai?.stopGeneration) {
        return window.electronAPI.ai.stopGeneration();
      }
    },
    listModels: async (config: any) => {
      if (isElectron && window.electronAPI.ai?.listModels) {
        return window.electronAPI.ai.listModels(config);
      }
      return { success: false, models: [], error: 'AI功能仅在桌面应用中可用' };
    },
    testConnection: async (config: any) => {
      if (isElectron && window.electronAPI.ai?.testConnection) {
        return window.electronAPI.ai.testConnection(config);
      }
      await delay(500);
      return { success: false, latency: 0, error: 'AI功能仅在桌面应用中可用' };
    },
    onToken: (callback: (token: string) => void) => {
      if (isElectron && window.electronAPI.ai?.onToken) {
        return window.electronAPI.ai.onToken(callback);
      }
      return () => {};
    },
    onStreamEnd: (callback: (fullText: string) => void) => {
      if (isElectron && window.electronAPI.ai?.onStreamEnd) {
        return window.electronAPI.ai.onStreamEnd(callback);
      }
      return () => {};
    },
    onStreamError: (callback: (error: string) => void) => {
      if (isElectron && window.electronAPI.ai?.onStreamError) {
        return window.electronAPI.ai.onStreamError(callback);
      }
      return () => {};
    },
    // AI 音乐工具
    musicSearch: async (params: { keyword: string; source?: 'local' | 'online' | 'all' }) => {
      if (isElectron && window.electronAPI.ai?.musicSearch) {
        return window.electronAPI.ai.musicSearch(params);
      }
      // 浏览器环境 mock 降级
      return { success: false, localResults: [], onlineResults: [], error: 'AI音乐功能仅在桌面应用中可用' };
    },
    musicClassifyEmotion: async (params: { trackIds?: string[]; config?: any }) => {
      if (isElectron && window.electronAPI.ai?.musicClassifyEmotion) {
        return window.electronAPI.ai.musicClassifyEmotion(params);
      }
      // 浏览器环境 mock 降级
      return { success: false, error: 'AI音乐功能仅在桌面应用中可用' };
    },
    musicGetStatsSummary: async () => {
      if (isElectron && window.electronAPI.ai?.musicGetStatsSummary) {
        return window.electronAPI.ai.musicGetStatsSummary();
      }
      // 浏览器环境 mock 降级
      return { success: false, summary: '音乐统计数据仅在桌面应用中可用', error: 'AI音乐功能仅在桌面应用中可用' };
    },
    // 联网搜索
    webSearch: async (query: string) => {
      if (isElectron && window.electronAPI.ai?.webSearch) {
        return window.electronAPI.ai.webSearch(query);
      }
      // 浏览器环境 mock 降级
      return { success: false, results: '', error: '联网搜索功能仅在桌面应用中可用' };
    },
    // Tool Calling
    chatStreamWithTools: async (messages: any[], config: any) => {
      if (isElectron && window.electronAPI.ai?.chatStreamWithTools) {
        return window.electronAPI.ai.chatStreamWithTools(messages, config);
      }
      await delay(100);
      return { success: false, error: 'AI功能仅在桌面应用中可用' };
    },
    getToolDefinitions: async () => {
      if (isElectron && window.electronAPI.ai?.getToolDefinitions) {
        return window.electronAPI.ai.getToolDefinitions();
      }
      return { success: false, tools: [], error: 'AI功能仅在桌面应用中可用' };
    },
    getRealtimeStats: async () => {
      if (isElectron && window.electronAPI.ai?.getRealtimeStats) {
        return window.electronAPI.ai.getRealtimeStats();
      }
      return { success: false, data: null, error: 'AI功能仅在桌面应用中可用' };
    },
    onToolCall: (callback: (data: {name: string, args: any, result: string}) => void) => {
      if (isElectron && window.electronAPI.ai?.onToolCall) {
        return window.electronAPI.ai.onToolCall(callback);
      }
      return () => {};
    },
    onStreamEndWithTools: (callback: (data: {text: string, toolCalls: any[]}) => void) => {
      if (isElectron && window.electronAPI.ai?.onStreamEndWithTools) {
        return window.electronAPI.ai.onStreamEndWithTools(callback);
      }
      return () => {};
    },
    // AI 记忆系统
    memoryAdd: async (memory: any) => {
      if (isElectron && window.electronAPI.ai?.memory?.add) {
        return window.electronAPI.ai.memory.add(memory);
      }
      return { success: false, error: '记忆功能仅在桌面应用中可用' };
    },
    memoryList: async (options?: any) => {
      if (isElectron && window.electronAPI.ai?.memory?.list) {
        return window.electronAPI.ai.memory.list(options);
      }
      return { success: false, data: [] };
    },
    memorySearch: async (query: string) => {
      if (isElectron && window.electronAPI.ai?.memory?.search) {
        return window.electronAPI.ai.memory.search(query);
      }
      return { success: false, data: [] };
    },
    memoryDelete: async (id: string) => {
      if (isElectron && window.electronAPI.ai?.memory?.delete) {
        return window.electronAPI.ai.memory.delete(id);
      }
      return { success: false };
    },
    memoryUpdate: async (id: string, updates: any) => {
      if (isElectron && window.electronAPI.ai?.memory?.update) {
        return window.electronAPI.ai.memory.update(id, updates);
      }
      return { success: false };
    },
    memoryExtract: async (params: {messages: any[], config: any}) => {
      if (isElectron && window.electronAPI.ai?.memory?.extract) {
        return window.electronAPI.ai.memory.extract(params);
      }
      return { success: false, error: '记忆功能仅在桌面应用中可用' };
    },
    memoryRelevant: async (params: {query: string, limit?: number}) => {
      if (isElectron && window.electronAPI.ai?.memory?.relevant) {
        return window.electronAPI.ai.memory.relevant(params);
      }
      return { success: true, data: [] };
    },
    memoryClear: async () => {
      if (isElectron && window.electronAPI.ai?.memory?.clear) {
        return window.electronAPI.ai.memory.clear();
      }
      return { success: false };
    },
    memoryStats: async () => {
      if (isElectron && window.electronAPI.ai?.memory?.stats) {
        return window.electronAPI.ai.memory.stats();
      }
      return { success: false, data: { total: 0 } };
    },
    // Agent 模式
    agentExecuteTask: async (instruction: string, config: any) => {
      if (isElectron && window.electronAPI.ai?.agentExecuteTask) {
        return window.electronAPI.ai.agentExecuteTask(instruction, config);
      }
      return { success: false, error: 'Agent 功能仅在桌面应用中可用' };
    },
    agentCancelTask: async () => {
      if (isElectron && window.electronAPI.ai?.agentCancelTask) {
        return window.electronAPI.ai.agentCancelTask();
      }
    },
    // 思考过程
    onThinkingToken: (callback: (token: string) => void) => {
      if (isElectron && window.electronAPI.ai?.onThinkingToken) {
        return window.electronAPI.ai.onThinkingToken(callback);
      }
      return () => {};
    },
    onThinkingEnd: (callback: (text: string) => void) => {
      if (isElectron && window.electronAPI.ai?.onThinkingEnd) {
        return window.electronAPI.ai.onThinkingEnd(callback);
      }
      return () => {};
    },
    // 规划
    onPlanReady: (callback: (plan: any) => void) => {
      if (isElectron && window.electronAPI.ai?.onPlanReady) {
        return window.electronAPI.ai.onPlanReady(callback);
      }
      return () => {};
    },
    // 状态变化
    onStatusChange: (callback: (status: string) => void) => {
      if (isElectron && window.electronAPI.ai?.onStatusChange) {
        return window.electronAPI.ai.onStatusChange(callback);
      }
      return () => {};
    },
    // 阶段
    onPhaseStart: (callback: (data: any) => void) => {
      if (isElectron && window.electronAPI.ai?.onPhaseStart) {
        return window.electronAPI.ai.onPhaseStart(callback);
      }
      return () => {};
    },
    onPhaseComplete: (callback: (data: any) => void) => {
      if (isElectron && window.electronAPI.ai?.onPhaseComplete) {
        return window.electronAPI.ai.onPhaseComplete(callback);
      }
      return () => {};
    },
    // 步骤
    onAgentStepStart: (callback: (step: any) => void) => {
      if (isElectron && window.electronAPI.ai?.onAgentStepStart) {
        return window.electronAPI.ai.onAgentStepStart(callback);
      }
      return () => {};
    },
    onAgentStepComplete: (callback: (step: any) => void) => {
      if (isElectron && window.electronAPI.ai?.onAgentStepComplete) {
        return window.electronAPI.ai.onAgentStepComplete(callback);
      }
      return () => {};
    },
    onAgentStepError: (callback: (data: any) => void) => {
      if (isElectron && window.electronAPI.ai?.onAgentStepError) {
        return window.electronAPI.ai.onAgentStepError(callback);
      }
      return () => {};
    },
    onStepThinking: (callback: (data: any) => void) => {
      if (isElectron && window.electronAPI.ai?.onStepThinking) {
        return window.electronAPI.ai.onStepThinking(callback);
      }
      return () => {};
    },
    // 任务完成
    onAgentTaskComplete: (callback: (task: any) => void) => {
      if (isElectron && window.electronAPI.ai?.onAgentTaskComplete) {
        return window.electronAPI.ai.onAgentTaskComplete(callback);
      }
      return () => {};
    },
    // AI 导航
    onNavigate: (callback: (command: any) => void) => {
      if (isElectron && window.electronAPI.ai?.onNavigate) {
        return window.electronAPI.ai.onNavigate(callback);
      }
      return () => {};
    },
    // ========== 新版 Query Engine API ==========
    /**
     * 流式查询（基于 QueryEngine）
     * 支持 AsyncGenerator 流式输出、工具调用、上下文压缩、权限控制
     */
    queryStream: async (messages: any[], config: any, options?: any) => {
      if (isElectron && window.electronAPI.ai?.queryStream) {
        return window.electronAPI.ai.queryStream(messages, config, options);
      }
      return { success: false, error: 'AI功能仅在桌面应用中可用' };
    },
    /**
     * 搜索记忆
     */
    searchMemories: async (query: string) => {
      if (isElectron && window.electronAPI.ai?.searchMemories) {
        return window.electronAPI.ai.searchMemories(query);
      }
      return { success: false, results: '', error: 'AI功能仅在桌面应用中可用' };
    },
    /**
     * 获取所有记忆
     */
    getMemories: async () => {
      if (isElectron && window.electronAPI.ai?.getMemories) {
        return window.electronAPI.ai.getMemories();
      }
      return { success: false, memories: [], error: 'AI功能仅在桌面应用中可用' };
    },
    /**
     * 添加记忆
     */
    addMemory: async (memory: any) => {
      if (isElectron && window.electronAPI.ai?.addMemory) {
        return window.electronAPI.ai.addMemory(memory);
      }
      return { success: false, error: 'AI功能仅在桌面应用中可用' };
    },
    /**
     * 删除记忆
     */
    deleteMemory: async (id: string) => {
      if (isElectron && window.electronAPI.ai?.deleteMemory) {
        return window.electronAPI.ai.deleteMemory(id);
      }
      return { success: false, error: 'AI功能仅在桌面应用中可用' };
    },
    /**
     * 使用量事件
     */
    onUsage: (callback: (usage: { inputTokens: number; outputTokens: number }) => void) => {
      if (isElectron && window.electronAPI.ai?.onUsage) {
        return window.electronAPI.ai.onUsage(callback);
      }
      return () => {};
    },
  },

  mcp: {
    getStatus: async () => {
      if (isElectron && window.electronAPI.ai?.mcpGetStatus) {
        return window.electronAPI.ai.mcpGetStatus();
      }
      return { success: false, servers: [] };
    },
    connectServer: async (config: any) => {
      if (isElectron && window.electronAPI.ai?.mcpConnectServer) {
        return window.electronAPI.ai.mcpConnectServer(config);
      }
      return { success: false };
    },
    disconnectServer: async (serverId: string) => {
      if (isElectron && window.electronAPI.ai?.mcpDisconnectServer) {
        return window.electronAPI.ai.mcpDisconnectServer(serverId);
      }
      return { success: false };
    },
    listTools: async () => {
      if (isElectron && window.electronAPI.ai?.mcpListTools) {
        return window.electronAPI.ai.mcpListTools();
      }
      return { success: false, tools: [] };
    },
    callTool: async (toolName: string, args: any) => {
      if (isElectron && window.electronAPI.ai?.mcpCallTool) {
        return window.electronAPI.ai.mcpCallTool(toolName, args);
      }
      return { success: false, result: null };
    },
  },

  // --- MCP 配置管理 ---
  mcpConfig: {
    initPresets: async () => {
      if (isElectron && window.electronAPI.mcpConfig?.initPresets) {
        return window.electronAPI.mcpConfig.initPresets();
      }
      return { success: false };
    },
    list: async () => {
      if (isElectron && window.electronAPI.mcpConfig?.list) {
        return window.electronAPI.mcpConfig.list();
      }
      return { success: false, data: [] };
    },
    get: async (serverId: string) => {
      if (isElectron && window.electronAPI.mcpConfig?.get) {
        return window.electronAPI.mcpConfig.get(serverId);
      }
      return { success: false };
    },
    create: async (server: any) => {
      if (isElectron && window.electronAPI.mcpConfig?.create) {
        return window.electronAPI.mcpConfig.create(server);
      }
      return { success: false };
    },
    update: async (serverId: string, updates: any) => {
      if (isElectron && window.electronAPI.mcpConfig?.update) {
        return window.electronAPI.mcpConfig.update(serverId, updates);
      }
      return { success: false };
    },
    delete: async (serverId: string) => {
      if (isElectron && window.electronAPI.mcpConfig?.delete) {
        return window.electronAPI.mcpConfig.delete(serverId);
      }
      return { success: false };
    },
    toggle: async (serverId: string) => {
      if (isElectron && window.electronAPI.mcpConfig?.toggle) {
        return window.electronAPI.mcpConfig.toggle(serverId);
      }
      return { success: false };
    },
    connect: async (serverId: string) => {
      if (isElectron && window.electronAPI.mcpConfig?.connect) {
        return window.electronAPI.mcpConfig.connect(serverId);
      }
      return { success: false };
    },
    disconnect: async (serverId: string) => {
      if (isElectron && window.electronAPI.mcpConfig?.disconnect) {
        return window.electronAPI.mcpConfig.disconnect(serverId);
      }
      return { success: false };
    },
    usageStats: async (serverId: string, days: number) => {
      if (isElectron && window.electronAPI.mcpConfig?.usageStats) {
        return window.electronAPI.mcpConfig.usageStats(serverId, days);
      }
      return { success: false };
    },
    usageSummary: async (serverId: string) => {
      if (isElectron && window.electronAPI.mcpConfig?.usageSummary) {
        return window.electronAPI.mcpConfig.usageSummary(serverId);
      }
      return { success: false };
    },
    initializeAll: async () => {
      if (isElectron && window.electronAPI.mcpConfig?.initializeAll) {
        return window.electronAPI.mcpConfig.initializeAll();
      }
      return { success: false };
    },
  },

  // --- 技能系统 ---
  skill: {
    loadAll: async () => {
      if (isElectron && window.electronAPI.skill?.loadAll) {
        return window.electronAPI.skill.loadAll();
      }
      return { success: false, data: [] };
    },
    list: async () => {
      if (isElectron && window.electronAPI.skill?.list) {
        return window.electronAPI.skill.list();
      }
      return { success: false, data: [] };
    },
    categories: async () => {
      if (isElectron && window.electronAPI.skill?.categories) {
        return window.electronAPI.skill.categories();
      }
      return { success: false, data: [] };
    },
    listByCategory: async (category: string) => {
      if (isElectron && window.electronAPI.skill?.listByCategory) {
        return window.electronAPI.skill.listByCategory(category);
      }
      return { success: false, data: [] };
    },
    get: async (skillId: string) => {
      if (isElectron && window.electronAPI.skill?.get) {
        return window.electronAPI.skill.get(skillId);
      }
      return { success: false };
    },
    search: async (query: string) => {
      if (isElectron && window.electronAPI.skill?.search) {
        return window.electronAPI.skill.search(query);
      }
      return { success: false, data: [] };
    },
    detect: async (input: string) => {
      if (isElectron && window.electronAPI.skill?.detect) {
        return window.electronAPI.skill.detect(input);
      }
      return { success: false, data: [] };
    },
    getPrompt: async (skillId: string) => {
      if (isElectron && window.electronAPI.skill?.getPrompt) {
        return window.electronAPI.skill.getPrompt(skillId);
      }
      return { success: false };
    },
    create: async (params: any) => {
      if (isElectron && window.electronAPI.skill?.create) {
        return window.electronAPI.skill.create(params);
      }
      return { success: false };
    },
    update: async (skillId: string, updates: any) => {
      if (isElectron && window.electronAPI.skill?.update) {
        return window.electronAPI.skill.update(skillId, updates);
      }
      return { success: false };
    },
    delete: async (skillId: string) => {
      if (isElectron && window.electronAPI.skill?.delete) {
        return window.electronAPI.skill.delete(skillId);
      }
      return { success: false };
    },
    toggle: async (skillId: string) => {
      if (isElectron && window.electronAPI.skill?.toggle) {
        return window.electronAPI.skill.toggle(skillId);
      }
      return { success: false };
    },
    incrementUse: async (skillId: string) => {
      if (isElectron && window.electronAPI.skill?.incrementUse) {
        return window.electronAPI.skill.incrementUse(skillId);
      }
      return { success: false };
    },
    createCategory: async (params: any) => {
      if (isElectron && window.electronAPI.skill?.createCategory) {
        return window.electronAPI.skill.createCategory(params);
      }
      return { success: false };
    },
    updateCategory: async (oldName: string, updates: any) => {
      if (isElectron && window.electronAPI.skill?.updateCategory) {
        return window.electronAPI.skill.updateCategory(oldName, updates);
      }
      return { success: false };
    },
    deleteCategory: async (name: string, moveToCategory?: string) => {
      if (isElectron && window.electronAPI.skill?.deleteCategory) {
        return window.electronAPI.skill.deleteCategory(name, moveToCategory);
      }
      return { success: false };
    },
  },

  // --- AI 聊天记录 ---
  chatHistory: {
    createWindow: async (title?: string) => {
      if (isElectron && window.electronAPI.chatHistory?.createWindow) {
        return window.electronAPI.chatHistory.createWindow(title);
      }
      await delay(100);
      return { success: true, data: { id: Date.now().toString(36), title: title || '新对话', isPinned: 0, isArchived: 0, messages: [], createdAt: new Date().toISOString(), updatedAt: new Date().toISOString() } };
    },
    listWindows: async (options?: any) => {
      if (isElectron && window.electronAPI.chatHistory?.listWindows) {
        return window.electronAPI.chatHistory.listWindows(options);
      }
      await delay(100);
      return { success: true, data: [] };
    },
    getWindow: async (windowId: string) => {
      if (isElectron && window.electronAPI.chatHistory?.getWindow) {
        return window.electronAPI.chatHistory.getWindow(windowId);
      }
      await delay(100);
      return { success: true, data: null };
    },
    updateWindow: async (windowId: string, updates: any) => {
      if (isElectron && window.electronAPI.chatHistory?.updateWindow) {
        return window.electronAPI.chatHistory.updateWindow(windowId, updates);
      }
      await delay(100);
      return { success: true };
    },
    deleteWindow: async (windowId: string) => {
      if (isElectron && window.electronAPI.chatHistory?.deleteWindow) {
        return window.electronAPI.chatHistory.deleteWindow(windowId);
      }
      await delay(100);
      return { success: true };
    },
    addMessage: async (windowId: string, message: any) => {
      if (isElectron && window.electronAPI.chatHistory?.addMessage) {
        return window.electronAPI.chatHistory.addMessage(windowId, message);
      }
      await delay(50);
      return { success: true, data: { id: Date.now().toString(36), ...message } };
    },
    addMessages: async (windowId: string, messages: any[]) => {
      if (isElectron && window.electronAPI.chatHistory?.addMessages) {
        return window.electronAPI.chatHistory.addMessages(windowId, messages);
      }
      await delay(100);
      return { success: true, data: messages.map((_, i) => Date.now().toString(36) + i) };
    },
    getMessages: async (windowId: string, options?: any) => {
      if (isElectron && window.electronAPI.chatHistory?.getMessages) {
        return window.electronAPI.chatHistory.getMessages(windowId, options);
      }
      await delay(100);
      return { success: true, data: [] };
    },
    deleteMessage: async (messageId: string) => {
      if (isElectron && window.electronAPI.chatHistory?.deleteMessage) {
        return window.electronAPI.chatHistory.deleteMessage(messageId);
      }
      await delay(50);
      return { success: true };
    },
    clearMessages: async (windowId: string) => {
      if (isElectron && window.electronAPI.chatHistory?.clearMessages) {
        return window.electronAPI.chatHistory.clearMessages(windowId);
      }
      await delay(50);
      return { success: true };
    },
    searchMessages: async (query: string, options?: any) => {
      if (isElectron && window.electronAPI.chatHistory?.searchMessages) {
        return window.electronAPI.chatHistory.searchMessages(query, options);
      }
      await delay(100);
      return { success: true, data: [] };
    },
    replaceWindowMessages: async (windowId: string, messages: any[]) => {
      if (isElectron && window.electronAPI.chatHistory?.replaceWindowMessages) {
        return window.electronAPI.chatHistory.replaceWindowMessages(windowId, messages);
      }
      await delay(100);
      return { success: true };
    },
    migrateFromLocalStorage: async (windowsData: any[]) => {
      if (isElectron && window.electronAPI.chatHistory?.migrateFromLocalStorage) {
        return window.electronAPI.chatHistory.migrateFromLocalStorage(windowsData);
      }
      return { success: false, error: '仅在桌面应用中可用' };
    },
    getStats: async () => {
      if (isElectron && window.electronAPI.chatHistory?.getStats) {
        return window.electronAPI.chatHistory.getStats();
      }
      return { success: true, data: { windowCount: 0, messageCount: 0 } };
    },
  },

  // --- Prompt 模板 ---
  promptTemplate: {
    list: async (category?: string) => {
      if (isElectron && window.electronAPI.promptTemplate?.list) {
        return window.electronAPI.promptTemplate.list(category);
      }
      return { success: true, data: [] };
    },
    get: async (templateId: string) => {
      if (isElectron && window.electronAPI.promptTemplate?.get) {
        return window.electronAPI.promptTemplate.get(templateId);
      }
      return { success: true, data: null };
    },
    create: async (template: any) => {
      if (isElectron && window.electronAPI.promptTemplate?.create) {
        return window.electronAPI.promptTemplate.create(template);
      }
      return { success: true, data: template };
    },
    update: async (templateId: string, updates: any) => {
      if (isElectron && window.electronAPI.promptTemplate?.update) {
        return window.electronAPI.promptTemplate.update(templateId, updates);
      }
      return { success: true };
    },
    delete: async (templateId: string) => {
      if (isElectron && window.electronAPI.promptTemplate?.delete) {
        return window.electronAPI.promptTemplate.delete(templateId);
      }
      return { success: true };
    },
    render: async (templateId: string, variables?: any) => {
      if (isElectron && window.electronAPI.promptTemplate?.render) {
        return window.electronAPI.promptTemplate.render(templateId, variables);
      }
      return { success: true, data: '' };
    },
    categories: async () => {
      if (isElectron && window.electronAPI.promptTemplate?.categories) {
        return window.electronAPI.promptTemplate.categories();
      }
      return { success: true, data: [] };
    },
    initPresets: async () => {
      if (isElectron && window.electronAPI.promptTemplate?.initPresets) {
        return window.electronAPI.promptTemplate.initPresets();
      }
      return { success: true };
    },
  },

  // --- haoone 音视频转录 ---
  haoone: {
    checkEnvironment: async () => {
      if (isElectron && window.electronAPI.haoone?.checkEnvironment) {
        return window.electronAPI.haoone.checkEnvironment();
      }
      return { success: false, error: 'haoone API 不可用' };
    },
    transcribe: async (params: { filePath: string; outputDir?: string; model?: string; language?: string; timelineName?: string; enableAiCorrection?: boolean; maxSubtitleLength?: number }) => {
      if (isElectron && window.electronAPI.haoone?.transcribe) {
        return window.electronAPI.haoone.transcribe(params);
      }
      return { success: false, error: 'haoone API 不可用' };
    },
    batchTranscribe: async (params: { filePaths: string[]; outputDir?: string; model?: string; language?: string; enableAiCorrection?: boolean }) => {
      if (isElectron && window.electronAPI.haoone?.batchTranscribe) {
        return window.electronAPI.haoone.batchTranscribe(params);
      }
      return { success: false, error: 'haoone API 不可用' };
    },
    listModels: async () => {
      if (isElectron && window.electronAPI.haoone?.listModels) {
        return window.electronAPI.haoone.listModels();
      }
      return { success: false, error: 'haoone API 不可用' };
    },
    getConfig: async () => {
      if (isElectron && window.electronAPI.haoone?.getConfig) {
        return window.electronAPI.haoone.getConfig();
      }
      return { success: false, error: 'haoone API 不可用' };
    },
    createProject: async (projectName: string) => {
      if (isElectron && window.electronAPI.haoone?.createProject) {
        return window.electronAPI.haoone.createProject(projectName);
      }
      return { success: false, error: 'haoone API 不可用' };
    },
    deleteProject: async (projectName?: string) => {
      if (isElectron && window.electronAPI.haoone?.deleteProject) {
        return window.electronAPI.haoone.deleteProject(projectName);
      }
      return { success: false, error: 'haoone API 不可用' };
    },
    formatDraft: async (filePath: string) => {
      if (isElectron && window.electronAPI.haoone?.formatDraft) {
        return window.electronAPI.haoone.formatDraft(filePath);
      }
      return { success: false, error: 'haoone API 不可用' };
    },
    getProjectList: async () => {
      if (isElectron && window.electronAPI.haoone?.getProjectList) {
        return window.electronAPI.haoone.getProjectList();
      }
      return { success: false, error: 'haoone API 不可用' };
    },
    getHotwords: async () => {
      if (isElectron && window.electronAPI.haoone?.getHotwords) {
        return window.electronAPI.haoone.getHotwords();
      }
      return { success: false, error: 'haoone API 不可用' };
    },
  },

  rag: {
    indexContent: async (sourceType: string, sourceId: string, content: string, config?: any) => {
      if (isElectron && window.electronAPI.rag?.indexContent) {
        return window.electronAPI.rag.indexContent(sourceType, sourceId, content, config);
      }
      return { success: true, count: 0 };
    },
    search: async (query: string, config?: any, options?: any) => {
      if (isElectron && window.electronAPI.rag?.search) {
        return window.electronAPI.rag.search(query, config, options);
      }
      return { success: true, data: [] };
    },
    deleteIndex: async (sourceType: string, sourceId: string) => {
      if (isElectron && window.electronAPI.rag?.deleteIndex) {
        return window.electronAPI.rag.deleteIndex(sourceType, sourceId);
      }
      return { success: true, count: 0 };
    },
    stats: async () => {
      if (isElectron && window.electronAPI.rag?.stats) {
        return window.electronAPI.rag.stats();
      }
      return { success: true, data: { total: 0, byType: {}, withEmbedding: 0 } };
    },
    indexAllCreativities: async (config?: any) => {
      if (isElectron && window.electronAPI.rag?.indexAllCreativities) {
        return window.electronAPI.rag.indexAllCreativities(config);
      }
      return { success: true, data: { total: 0, indexed: 0 } };
    },
  },

  workflow: {
    initPresets: async () => {
      if (isElectron && window.electronAPI.workflow?.initPresets) {
        return window.electronAPI.workflow.initPresets();
      }
      return { success: true, count: 0 };
    },
    list: async () => {
      if (isElectron && window.electronAPI.workflow?.list) {
        return window.electronAPI.workflow.list();
      }
      return { success: true, data: [] };
    },
    get: async (id: string) => {
      if (isElectron && window.electronAPI.workflow?.get) {
        return window.electronAPI.workflow.get(id);
      }
      return { success: true, data: null };
    },
    create: async (workflow: any) => {
      if (isElectron && window.electronAPI.workflow?.create) {
        return window.electronAPI.workflow.create(workflow);
      }
      return { success: true, data: null };
    },
    update: async (id: string, updates: any) => {
      if (isElectron && window.electronAPI.workflow?.update) {
        return window.electronAPI.workflow.update(id, updates);
      }
      return { success: true, data: null };
    },
    delete: async (id: string) => {
      if (isElectron && window.electronAPI.workflow?.delete) {
        return window.electronAPI.workflow.delete(id);
      }
      return { success: false };
    },
    recordRun: async (id: string) => {
      if (isElectron && window.electronAPI.workflow?.recordRun) {
        return window.electronAPI.workflow.recordRun(id);
      }
      return { success: true };
    },
  },

  aiStats: {
    record: async (data: any) => {
      if (isElectron && window.electronAPI.aiStats?.record) {
        return window.electronAPI.aiStats.record(data);
      }
      return { success: true };
    },
    get: async (period?: string) => {
      if (isElectron && window.electronAPI.aiStats?.get) {
        return window.electronAPI.aiStats.get(period);
      }
      return { success: true, data: { totalRequests: 0, totalTokenInput: 0, totalTokenOutput: 0, totalToolCalls: 0, dailyData: [], modelDistribution: [] } };
    },
    topTools: async (limit?: number) => {
      if (isElectron && window.electronAPI.aiStats?.topTools) {
        return window.electronAPI.aiStats.topTools(limit);
      }
      return { success: true, data: [] };
    },
    clear: async () => {
      if (isElectron && window.electronAPI.aiStats?.clear) {
        return window.electronAPI.aiStats.clear();
      }
      return { success: true };
    },
  },
};
