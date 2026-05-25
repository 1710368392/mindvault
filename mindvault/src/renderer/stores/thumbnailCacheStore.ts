import { create } from 'zustand';

/**
 * 缩略图缓存 Store
 * 用于在页面间共享缩略图 URL，避免重复加载和计算
 */

interface ThumbnailCacheState {
  /** 缓存映射：缓存 key -> 缩略图 URL */
  cache: Map<string, string>;
  
  /** 
   * 获取缓存的缩略图 URL
   * @param key 缓存 key（通常是文件路径或 thumbnailPath）
   * @returns 缓存的 URL，不存在则返回 undefined
   */
  getCachedThumbnail: (key: string) => string | undefined;
  
  /**
   * 设置缓存
   * @param key 缓存 key
   * @param url 缩略图 URL
   */
  setCachedThumbnail: (key: string, url: string) => void;
  
  /**
   * 批量设置缓存
   * @param entries 缓存条目数组
   */
  setCachedThumbnails: (entries: Array<[string, string]>) => void;
  
  /**
   * 清空所有缓存
   */
  clearCache: () => void;
  
  /**
   * 检查是否已缓存
   * @param key 缓存 key
   */
  hasCached: (key: string) => boolean;
}

/** 缓存大小限制 */
const MAX_CACHE_SIZE = 500;

export const useThumbnailCacheStore = create<ThumbnailCacheState>((set, get) => ({
  cache: new Map<string, string>(),
  
  getCachedThumbnail: (key: string) => {
    return get().cache.get(key);
  },
  
  setCachedThumbnail: (key: string, url: string) => {
    set((state) => {
      const newCache = new Map(state.cache);
      
      // 如果超过大小限制，删除最早的条目
      if (newCache.size >= MAX_CACHE_SIZE && !newCache.has(key)) {
        const firstKey = newCache.keys().next().value;
        if (firstKey) {
          newCache.delete(firstKey);
        }
      }
      
      newCache.set(key, url);
      return { cache: newCache };
    });
  },
  
  setCachedThumbnails: (entries: Array<[string, string]>) => {
    set((state) => {
      const newCache = new Map(state.cache);
      
      for (const [key, url] of entries) {
        // 如果超过大小限制，删除最早的条目
        if (newCache.size >= MAX_CACHE_SIZE && !newCache.has(key)) {
          const firstKey = newCache.keys().next().value;
          if (firstKey) {
            newCache.delete(firstKey);
          }
        }
        newCache.set(key, url);
      }
      
      return { cache: newCache };
    });
  },
  
  clearCache: () => {
    set({ cache: new Map<string, string>() });
  },
  
  hasCached: (key: string) => {
    return get().cache.has(key);
  },
}));

/**
 * 生成缓存 key
 * @param type 媒体类型
 * @param content 文件路径或内容
 * @returns 缓存 key
 */
export function generateThumbnailCacheKey(type: string, content: string | undefined | null): string {
  if (!content) return '';
  // 使用 type:content 作为 key，避免不同类型媒体冲突
  return `${type}:${content}`;
}

/**
 * 生成基于 thumbnailPath 的缓存 key
 * @param thumbnailPath 缩略图路径
 * @returns 缓存 key
 */
export function generateThumbnailPathCacheKey(thumbnailPath: string): string {
  return `thumb:${thumbnailPath}`;
}
