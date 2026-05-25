/**
 * 写作台 API 封装
 * 独立于创意库，专门用于写作台数据管理
 */

// 检测是否在 Electron 环境
const isElectron = typeof window !== 'undefined' && !!(window as any).electronAPI?.writing;

// 延迟函数（用于 mock 模式）
const delay = (ms: number) => new Promise(resolve => setTimeout(resolve, ms));

// 本地存储 key
const STORAGE_KEY_VOLUMES = 'mindvault_writing_volumes';
const STORAGE_KEY_CHAPTERS = 'mindvault_writing_chapters';
const STORAGE_KEY_BACKUPS = 'mindvault_writing_backups';

// 类型定义
export interface WritingVolume {
  id: string;
  boardId?: string;
  title: string;
  sortOrder: number;
  createdAt: string;
  updatedAt: string;
}

export interface WritingChapter {
  id: string;
  volumeId?: string;
  boardId?: string;
  title: string;
  content: string;
  wordCount: number;
  contentFormat: string;
  sortOrder: number;
  createdAt: string;
  updatedAt: string;
  lastSavedAt?: string;
}

export interface WritingBackup {
  id: string;
  chapterId: string;
  title: string;
  content: string;
  wordCount: number;
  backupType: 'auto' | 'manual' | 'exit';
  createdAt: string;
}

// Mock 数据存储
let mockVolumes: WritingVolume[] = [];
let mockChapters: WritingChapter[] = [];
let mockBackups: WritingBackup[] = [];

// 从 localStorage 加载 mock 数据
function loadMockData() {
  try {
    const volumes = localStorage.getItem(STORAGE_KEY_VOLUMES);
    const chapters = localStorage.getItem(STORAGE_KEY_CHAPTERS);
    const backups = localStorage.getItem(STORAGE_KEY_BACKUPS);
    
    if (volumes) mockVolumes = JSON.parse(volumes);
    if (chapters) mockChapters = JSON.parse(chapters);
    if (backups) mockBackups = JSON.parse(backups);
  } catch (e) {
    console.error('[WritingAPI] 加载 mock 数据失败:', e);
  }
}

// 保存 mock 数据到 localStorage
function saveMockData() {
  try {
    localStorage.setItem(STORAGE_KEY_VOLUMES, JSON.stringify(mockVolumes));
    localStorage.setItem(STORAGE_KEY_CHAPTERS, JSON.stringify(mockChapters));
    localStorage.setItem(STORAGE_KEY_BACKUPS, JSON.stringify(mockBackups));
  } catch (e) {
    console.error('[WritingAPI] 保存 mock 数据失败:', e);
  }
}

// 初始化
if (!isElectron) {
  loadMockData();
}

// 生成 ID
function generateId(): string {
  return 'wrt_' + Date.now().toString(36) + Math.random().toString(36).substr(2, 9);
}

// 写作台 API
export const writingApi = {
  // ==================== 卷管理 ====================
  
  listVolumes: async (boardId?: string): Promise<WritingVolume[]> => {
    if (isElectron) {
      return (window as any).electronAPI.writing.listVolumes(boardId);
    }
    await delay(50);
    return mockVolumes.filter(v => !boardId || v.boardId === boardId);
  },
  
  createVolume: async (data: { boardId?: string; title?: string }): Promise<WritingVolume | null> => {
    if (isElectron) {
      return (window as any).electronAPI.writing.createVolume(data);
    }
    await delay(50);
    const now = new Date().toISOString();
    const volume: WritingVolume = {
      id: generateId(),
      boardId: data.boardId,
      title: data.title || '新卷',
      sortOrder: mockVolumes.length,
      createdAt: now,
      updatedAt: now,
    };
    mockVolumes.push(volume);
    saveMockData();
    return volume;
  },
  
  updateVolume: async (id: string, data: { title?: string; sortOrder?: number }): Promise<boolean> => {
    if (isElectron) {
      return (window as any).electronAPI.writing.updateVolume(id, data);
    }
    await delay(50);
    const idx = mockVolumes.findIndex(v => v.id === id);
    if (idx >= 0) {
      mockVolumes[idx] = { ...mockVolumes[idx], ...data, updatedAt: new Date().toISOString() };
      saveMockData();
      return true;
    }
    return false;
  },
  
  deleteVolume: async (id: string): Promise<boolean> => {
    if (isElectron) {
      return (window as any).electronAPI.writing.deleteVolume(id);
    }
    await delay(50);
    // 删除卷下的所有章节
    mockChapters = mockChapters.filter(c => c.volumeId !== id);
    mockVolumes = mockVolumes.filter(v => v.id !== id);
    saveMockData();
    return true;
  },
  
  // ==================== 章节管理 ====================
  
  listChapters: async (volumeId?: string, boardId?: string): Promise<WritingChapter[]> => {
    if (isElectron) {
      return (window as any).electronAPI.writing.listChapters(volumeId, boardId);
    }
    await delay(50);
    return mockChapters.filter(c => {
      if (volumeId && c.volumeId !== volumeId) return false;
      if (boardId && c.boardId !== boardId) return false;
      return true;
    });
  },
  
  getChapter: async (id: string): Promise<WritingChapter | null> => {
    if (isElectron) {
      return (window as any).electronAPI.writing.getChapter(id);
    }
    await delay(50);
    return mockChapters.find(c => c.id === id) || null;
  },
  
  createChapter: async (data: { volumeId?: string; boardId?: string; title?: string; content?: string }): Promise<WritingChapter | null> => {
    if (isElectron) {
      return (window as any).electronAPI.writing.createChapter(data);
    }
    await delay(50);
    const now = new Date().toISOString();
    const chapter: WritingChapter = {
      id: generateId(),
      volumeId: data.volumeId,
      boardId: data.boardId,
      title: data.title || '新章节',
      content: data.content || '',
      wordCount: (data.content || '').length,
      contentFormat: 'plain',
      sortOrder: mockChapters.filter(c => c.volumeId === data.volumeId).length,
      createdAt: now,
      updatedAt: now,
      lastSavedAt: now,
    };
    mockChapters.push(chapter);
    saveMockData();
    return chapter;
  },
  
  updateChapter: async (id: string, data: { title?: string; content?: string; volumeId?: string; sortOrder?: number }): Promise<boolean> => {
    if (isElectron) {
      return (window as any).electronAPI.writing.updateChapter(id, data);
    }
    await delay(50);
    const idx = mockChapters.findIndex(c => c.id === id);
    if (idx >= 0) {
      const now = new Date().toISOString();
      const oldContent = mockChapters[idx].content;
      
      // 如果内容有变化，创建备份
      if (data.content !== undefined && oldContent !== data.content) {
        const backup: WritingBackup = {
          id: generateId(),
          chapterId: id,
          title: mockChapters[idx].title,
          content: oldContent,
          wordCount: mockChapters[idx].wordCount,
          backupType: 'auto',
          createdAt: now,
        };
        mockBackups.push(backup);
        
        // 只保留最近 10 个备份
        const chapterBackups = mockBackups.filter(b => b.chapterId === id);
        if (chapterBackups.length > 10) {
          const toDelete = chapterBackups.sort((a, b) => b.createdAt.localeCompare(a.createdAt)).slice(10);
          mockBackups = mockBackups.filter(b => !toDelete.find(d => d.id === b.id));
        }
      }
      
      mockChapters[idx] = {
        ...mockChapters[idx],
        ...data,
        wordCount: data.content !== undefined ? data.content.length : mockChapters[idx].wordCount,
        updatedAt: now,
        lastSavedAt: now,
      };
      saveMockData();
      return true;
    }
    return false;
  },
  
  deleteChapter: async (id: string): Promise<boolean> => {
    if (isElectron) {
      return (window as any).electronAPI.writing.deleteChapter(id);
    }
    await delay(50);
    mockChapters = mockChapters.filter(c => c.id !== id);
    mockBackups = mockBackups.filter(b => b.chapterId !== id);
    saveMockData();
    return true;
  },
  
  // ==================== 备份管理 ====================
  
  listBackups: async (chapterId: string): Promise<WritingBackup[]> => {
    if (isElectron) {
      return (window as any).electronAPI.writing.listBackups(chapterId);
    }
    await delay(50);
    return mockBackups
      .filter(b => b.chapterId === chapterId)
      .sort((a, b) => b.createdAt.localeCompare(a.createdAt))
      .slice(0, 20);
  },
  
  restoreBackup: async (backupId: string): Promise<boolean> => {
    if (isElectron) {
      return (window as any).electronAPI.writing.restoreBackup(backupId);
    }
    await delay(50);
    const backup = mockBackups.find(b => b.id === backupId);
    if (!backup) return false;
    
    const idx = mockChapters.findIndex(c => c.id === backup.chapterId);
    if (idx >= 0) {
      const now = new Date().toISOString();
      mockChapters[idx] = {
        ...mockChapters[idx],
        title: backup.title,
        content: backup.content,
        wordCount: backup.wordCount,
        updatedAt: now,
        lastSavedAt: now,
      };
      saveMockData();
      return true;
    }
    return false;
  },
  
  createBackup: async (chapterId: string): Promise<WritingBackup | null> => {
    if (isElectron) {
      return (window as any).electronAPI.writing.createBackup(chapterId);
    }
    await delay(50);
    const chapter = mockChapters.find(c => c.id === chapterId);
    if (!chapter) return null;
    
    const now = new Date().toISOString();
    const backup: WritingBackup = {
      id: generateId(),
      chapterId,
      title: chapter.title,
      content: chapter.content,
      wordCount: chapter.wordCount,
      backupType: 'manual',
      createdAt: now,
    };
    mockBackups.push(backup);
    saveMockData();
    return backup;
  },
  
  // ==================== 数据迁移 ====================
  
  migrateFromCreativities: async (): Promise<{ success: boolean; message: string; migrated: number }> => {
    if (isElectron) {
      return (window as any).electronAPI.writing.migrateFromCreativities();
    }
    // Mock 模式下不需要迁移
    return { success: true, message: 'Mock 模式，跳过迁移', migrated: 0 };
  },
  
  // ==================== 统计信息 ====================
  
  getStats: async (boardId?: string): Promise<{ volumeCount: number; chapterCount: number; totalWordCount: number }> => {
    if (isElectron) {
      return (window as any).electronAPI.writing.getStats(boardId);
    }
    await delay(50);
    const volumes = mockVolumes.filter(v => !boardId || v.boardId === boardId);
    const chapters = mockChapters.filter(c => !boardId || c.boardId === boardId);
    return {
      volumeCount: volumes.length,
      chapterCount: chapters.length,
      totalWordCount: chapters.reduce((sum, c) => sum + c.wordCount, 0),
    };
  },
};
