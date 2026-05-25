/**
 * 全局类型定义
 */

// 拖放 API 类型
interface DragDropAPI {
  onFilesDropped: (callback: (filePaths: string[]) => void) => () => void;
  getDroppedFiles: () => Promise<string[]>;
}

// RAG API 类型
interface RAGAPI {
  indexContent: (sourceType: string, sourceId: string, content: string, config?: any, options?: any) => Promise<any>;
  search: (query: string, config?: any, options?: any) => Promise<any>;
  deleteIndex: (sourceType: string, sourceId: string) => Promise<any>;
  stats: () => Promise<any>;
  logs: (limit?: number) => Promise<any>;
  modelInfo: (config?: any) => Promise<any>;
  indexAllCreativities: (config?: any, options?: any) => Promise<any>;
  indexAllChapters: (config?: any, options?: any) => Promise<any>;
  indexAllCards: (config?: any, options?: any) => Promise<any>;
  rebuildAll: (config?: any, options?: any) => Promise<any>;
  clearAll: () => Promise<any>;
  setConfig: (config: any) => Promise<any>;
}

// 扩展 Window 接口
declare global {
  interface Window {
    electronAPI?: {
      // ... 其他已有的 API
      dragDrop?: DragDropAPI;
      rag?: RAGAPI;
    };
  }
}

export {};
