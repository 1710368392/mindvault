/**
 * Memory System - 完整版记忆系统
 * 
 * 基于 Claude Code 源码完整实现
 * 支持 Agentic Search、语义搜索、Embedding 集成、SQLite 持久化
 */

import type { Message } from '../QueryEngine';
import { sideQuery } from '../side-query';

// ============================================================================
// Types
// ============================================================================

export interface Memory {
  id: string;
  type: 'fact' | 'preference' | 'style' | 'goal' | 'context' | 'procedure';
  content: string;
  keywords: string[];
  embedding?: number[];
  importance: number; // 1-10
  accessCount: number;
  createdAt: number;
  updatedAt: number;
  lastAccessedAt: number;
  source?: string; // 来源对话 ID
  metadata?: Record<string, any>;
}

export interface MemorySearchResult {
  memory: Memory;
  relevance: number; // 0-1
  matchType: 'keyword' | 'semantic' | 'exact' | 'hybrid';
  matchedKeywords?: string[];
}

export interface MemoryStore {
  memories: Map<string, Memory>;
  keywordIndex: Map<string, Set<string>>; // keyword -> memory IDs
  embeddingIndex?: Map<string, number[]>; // memory ID -> embedding
}

export interface MemorySearchOptions {
  maxResults?: number;
  minRelevance?: number;
  types?: Memory['type'][];
  useSemanticSearch?: boolean;
  useKeywordSearch?: boolean;
  recentTools?: string[];
}

// ============================================================================
// Embedding Service
// ============================================================================

/**
 * 生成文本的 embedding 向量
 * 使用 OpenAI text-embedding-3-small 模型
 */
async function generateEmbedding(text: string): Promise<number[] | null> {
  // 尝试使用 RAG 服务生成 embedding
    try {
      // eslint-disable-next-line @typescript-eslint/no-require-imports
      const ragService: any = require('../../rag-service');
      const embedding = await ragService.generateEmbedding?.(text);
      return embedding || null;
    } catch (error) {
    console.warn('Failed to generate embedding:', error);
    return null;
  }
}

/**
 * 计算两个向量的余弦相似度
 */
function cosineSimilarity(a: number[], b: number[]): number {
  if (a.length !== b.length) return 0;
  
  let dotProduct = 0;
  let normA = 0;
  let normB = 0;
  
  for (let i = 0; i < a.length; i++) {
    dotProduct += a[i] * b[i];
    normA += a[i] * a[i];
    normB += b[i] * b[i];
  }
  
  if (normA === 0 || normB === 0) return 0;
  return dotProduct / (Math.sqrt(normA) * Math.sqrt(normB));
}

// ============================================================================
// Memory Manager
// ============================================================================

/**
 * MemoryManager - 记忆管理器
 * 支持关键词索引、语义搜索、SQLite 持久化
 */
export class MemoryManager {
  private store: MemoryStore = {
    memories: new Map(),
    keywordIndex: new Map(),
    embeddingIndex: new Map(),
  };
  private db: any = null;

  constructor() {
    this.initDatabase();
  }

  /**
   * 初始化数据库
   */
  private async initDatabase(): Promise<void> {
    try {
      const Database = require('better-sqlite3');
      const path = require('path');
      const dbPath = path.join(process.cwd(), 'data', 'memories.db');
      
      this.db = new Database(dbPath);
      this.db.exec(`
        CREATE TABLE IF NOT EXISTS memories (
          id TEXT PRIMARY KEY,
          type TEXT NOT NULL,
          content TEXT NOT NULL,
          keywords TEXT,
          embedding BLOB,
          importance INTEGER DEFAULT 5,
          access_count INTEGER DEFAULT 0,
          created_at INTEGER,
          updated_at INTEGER,
          last_accessed_at INTEGER,
          source TEXT,
          metadata TEXT
        )
      `);
      
      // 加载已有记忆
      await this.loadFromDatabase();
    } catch (error) {
      console.warn('Failed to initialize memory database:', error);
    }
  }

  /**
   * 从数据库加载记忆
   */
  private async loadFromDatabase(): Promise<void> {
    if (!this.db) return;
    
    try {
      const rows = this.db.prepare('SELECT * FROM memories').all();
      for (const row of rows) {
        const memory: Memory = {
          id: row.id,
          type: row.type,
          content: row.content,
          keywords: JSON.parse(row.keywords || '[]'),
          embedding: row.embedding ? JSON.parse(row.embedding) : undefined,
          importance: row.importance,
          accessCount: row.access_count,
          createdAt: row.created_at,
          updatedAt: row.updated_at,
          lastAccessedAt: row.last_accessed_at,
          source: row.source,
          metadata: row.metadata ? JSON.parse(row.metadata) : undefined,
        };
        
        this.store.memories.set(memory.id, memory);
        
        // 重建关键词索引
        for (const keyword of memory.keywords) {
          const normalizedKeyword = keyword.toLowerCase();
          if (!this.store.keywordIndex.has(normalizedKeyword)) {
            this.store.keywordIndex.set(normalizedKeyword, new Set());
          }
          this.store.keywordIndex.get(normalizedKeyword)!.add(memory.id);
        }
        
        // 重建 embedding 索引
        if (memory.embedding) {
          this.store.embeddingIndex!.set(memory.id, memory.embedding);
        }
      }
    } catch (error) {
      console.warn('Failed to load memories from database:', error);
    }
  }

  /**
   * 保存记忆到数据库
   */
  private async saveToDatabase(memory: Memory): Promise<void> {
    if (!this.db) return;
    
    try {
      const stmt = this.db.prepare(`
        INSERT OR REPLACE INTO memories 
        (id, type, content, keywords, embedding, importance, access_count, created_at, updated_at, last_accessed_at, source, metadata)
        VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
      `);
      
      stmt.run(
        memory.id,
        memory.type,
        memory.content,
        JSON.stringify(memory.keywords),
        memory.embedding ? JSON.stringify(memory.embedding) : null,
        memory.importance,
        memory.accessCount,
        memory.createdAt,
        memory.updatedAt,
        memory.lastAccessedAt,
        memory.source || null,
        memory.metadata ? JSON.stringify(memory.metadata) : null
      );
    } catch (error) {
      console.warn('Failed to save memory to database:', error);
    }
  }

  /**
   * 添加记忆
   */
  async addMemory(
    memory: Omit<Memory, 'id' | 'accessCount' | 'createdAt' | 'updatedAt' | 'lastAccessedAt'>
  ): Promise<Memory> {
    const id = crypto.randomUUID();
    const now = Date.now();
    
    // 生成 embedding
    let embedding: number[] | undefined;
    if (memory.content.length > 10) {
      embedding = await generateEmbedding(memory.content) ?? undefined;
    }
    
    const newMemory: Memory = {
      ...memory,
      id,
      embedding,
      accessCount: 0,
      createdAt: now,
      updatedAt: now,
      lastAccessedAt: now,
    };

    this.store.memories.set(id, newMemory);
    
    // 更新关键词索引
    for (const keyword of memory.keywords) {
      const normalizedKeyword = keyword.toLowerCase();
      if (!this.store.keywordIndex.has(normalizedKeyword)) {
        this.store.keywordIndex.set(normalizedKeyword, new Set());
      }
      this.store.keywordIndex.get(normalizedKeyword)!.add(id);
    }
    
    // 更新 embedding 索引
    if (embedding) {
      this.store.embeddingIndex!.set(id, embedding);
    }
    
    // 保存到数据库
    await this.saveToDatabase(newMemory);

    return newMemory;
  }

  /**
   * 获取记忆
   */
  getMemory(id: string): Memory | undefined {
    const memory = this.store.memories.get(id);
    if (memory) {
      memory.accessCount++;
      memory.lastAccessedAt = Date.now();
      this.saveToDatabase(memory);
    }
    return memory;
  }

  /**
   * 更新记忆
   */
  async updateMemory(id: string, updates: Partial<Memory>): Promise<Memory | undefined> {
    const memory = this.store.memories.get(id);
    if (!memory) return undefined;

    // 如果关键词变化，更新索引
    if (updates.keywords) {
      // 移除旧索引
      for (const keyword of memory.keywords) {
        const normalizedKeyword = keyword.toLowerCase();
        this.store.keywordIndex.get(normalizedKeyword)?.delete(id);
      }
      
      // 添加新索引
      for (const keyword of updates.keywords) {
        const normalizedKeyword = keyword.toLowerCase();
        if (!this.store.keywordIndex.has(normalizedKeyword)) {
          this.store.keywordIndex.set(normalizedKeyword, new Set());
        }
        this.store.keywordIndex.get(normalizedKeyword)!.add(id);
      }
    }

    // 如果内容变化，重新生成 embedding
    if (updates.content && updates.content !== memory.content) {
      updates.embedding = await generateEmbedding(updates.content) ?? undefined;
      if (updates.embedding) {
        this.store.embeddingIndex!.set(id, updates.embedding);
      }
    }

    const updatedMemory: Memory = {
      ...memory,
      ...updates,
      updatedAt: Date.now(),
    };

    this.store.memories.set(id, updatedMemory);
    await this.saveToDatabase(updatedMemory);
    
    return updatedMemory;
  }

  /**
   * 删除记忆
   */
  async deleteMemory(id: string): Promise<boolean> {
    const memory = this.store.memories.get(id);
    if (!memory) return false;

    // 移除索引
    for (const keyword of memory.keywords) {
      const normalizedKeyword = keyword.toLowerCase();
      this.store.keywordIndex.get(normalizedKeyword)?.delete(id);
    }
    
    this.store.embeddingIndex?.delete(id);
    this.store.memories.delete(id);
    
    // 从数据库删除
    if (this.db) {
      try {
        this.db.prepare('DELETE FROM memories WHERE id = ?').run(id);
      } catch (error) {
        console.warn('Failed to delete memory from database:', error);
      }
    }

    return true;
  }

  /**
   * 获取所有记忆
   */
  getAllMemories(): Memory[] {
    return Array.from(this.store.memories.values());
  }

  /**
   * 按类型获取记忆
   */
  getMemoriesByType(type: Memory['type']): Memory[] {
    return this.getAllMemories().filter(m => m.type === type);
  }

  /**
   * 获取高重要性记忆
   */
  getImportantMemories(threshold: number = 7): Memory[] {
    return this.getAllMemories().filter(m => m.importance >= threshold);
  }

  /**
   * 获取 embedding 索引
   */
  getEmbeddingIndex(): Map<string, number[]> | undefined {
    return this.store.embeddingIndex;
  }
}

// ============================================================================
// Agentic Search
// ============================================================================

/**
 * Agentic Search - AI 主动搜索记忆
 * 
 * 支持三种搜索模式：
 * 1. 关键词搜索 - 基于关键词索引
 * 2. 语义搜索 - 基于 embedding 相似度
 * 3. 混合搜索 - 结合关键词和语义
 */
export async function agenticMemorySearch(
  query: string,
  memoryManager: MemoryManager,
  options: MemorySearchOptions = {}
): Promise<MemorySearchResult[]> {
  const {
    maxResults = 5,
    minRelevance = 0.3,
    types,
    useSemanticSearch = true,
    useKeywordSearch = true,
  } = options;

  // 1. 提取查询关键词
  const queryKeywords = extractKeywords(query);

  // 2. 生成查询 embedding
  let queryEmbedding: number[] | null = null;
  if (useSemanticSearch) {
    queryEmbedding = await generateEmbedding(query);
  }

  // 3. 执行搜索
  const results: Map<string, MemorySearchResult> = new Map();

  // 关键词搜索
  if (useKeywordSearch) {
    const keywordResults = searchByKeywords(queryKeywords, memoryManager);
    for (const result of keywordResults) {
      const existing = results.get(result.memory.id);
      if (existing) {
        existing.relevance = Math.max(existing.relevance, result.relevance);
        existing.matchType = 'hybrid';
        existing.matchedKeywords = [...(existing.matchedKeywords || []), ...(result.matchedKeywords || [])];
      } else {
        results.set(result.memory.id, result);
      }
    }
  }

  // 语义搜索
  if (useSemanticSearch && queryEmbedding) {
    const semanticResults = searchByEmbedding(queryEmbedding, memoryManager);
    for (const result of semanticResults) {
      const existing = results.get(result.memory.id);
      if (existing) {
        existing.relevance = Math.max(existing.relevance, result.relevance);
        existing.matchType = 'hybrid';
      } else {
        results.set(result.memory.id, result);
      }
    }
  }

  // 4. 过滤和排序
  let filtered = Array.from(results.values())
    .filter(r => r.relevance >= minRelevance)
    .filter(r => !types || types.includes(r.memory.type));

  // 5. 按相关性排序
  filtered.sort((a, b) => b.relevance - a.relevance);

  // 6. 返回前 N 个结果
  return filtered.slice(0, maxResults);
}

/**
 * 提取关键词
 */
function extractKeywords(text: string): string[] {
  // 停用词
  const stopWords = new Set([
    '的', '了', '是', '在', '我', '有', '和', '就', '不', '人', '都', '一', '一个',
    '上', '也', '很', '到', '说', '要', '去', '你', '会', '着', '没有', '看', '好',
    'the', 'a', 'an', 'is', 'are', 'was', 'were', 'be', 'been', 'being',
    'have', 'has', 'had', 'do', 'does', 'did', 'will', 'would', 'could', 'should',
    'i', 'you', 'he', 'she', 'it', 'we', 'they', 'this', 'that', 'these', 'those',
  ]);

  // 中文分词（简单实现：二元分词）
  const chineseChars = text.match(/[\u4e00-\u9fa5]+/g) || [];
  const chineseWords = chineseChars.flatMap(str => {
    const words: string[] = [];
    for (let i = 0; i < str.length - 1; i++) {
      words.push(str.slice(i, i + 2));
    }
    if (str.length === 1) words.push(str);
    return words;
  });

  // 英文分词
  const englishWords = text.toLowerCase().match(/[a-z]+/g) || [];

  // 合并并过滤
  const allWords = [...chineseWords, ...englishWords];
  return allWords.filter(word => !stopWords.has(word) && word.length > 1);
}

/**
 * 关键词搜索
 */
function searchByKeywords(
  keywords: string[],
  memoryManager: MemoryManager
): MemorySearchResult[] {
  const results: Map<string, MemorySearchResult> = new Map();
  const store = (memoryManager as any).store as MemoryStore;

  for (const keyword of keywords) {
    const normalizedKeyword = keyword.toLowerCase();
    const ids = store.keywordIndex.get(normalizedKeyword);
    
    if (ids) {
      for (const id of ids) {
        const memory = memoryManager.getMemory(id);
        if (!memory) continue;
        
        const existing = results.get(id);
        if (existing) {
          existing.relevance += 0.1;
          existing.matchedKeywords?.push(keyword);
        } else {
          results.set(id, {
            memory,
            relevance: 0.3,
            matchType: 'keyword',
            matchedKeywords: [keyword],
          });
        }
      }
    }
  }

  return Array.from(results.values());
}

/**
 * 语义搜索（基于 embedding）
 */
function searchByEmbedding(
  queryEmbedding: number[],
  memoryManager: MemoryManager
): MemorySearchResult[] {
  const results: MemorySearchResult[] = [];
  const embeddingIndex = memoryManager.getEmbeddingIndex();
  
  if (!embeddingIndex) return [];

  for (const [id, embedding] of embeddingIndex) {
    const similarity = cosineSimilarity(queryEmbedding, embedding);
    if (similarity > 0.5) {
      const memory = memoryManager.getMemory(id);
      if (memory) {
        results.push({
          memory,
          relevance: similarity,
          matchType: 'semantic',
        });
      }
    }
  }

  return results;
}

// ============================================================================
// Memory Extraction
// ============================================================================

/**
 * 从对话中提取记忆
 */
export async function extractMemoriesFromConversation(
  messages: Message[],
  existingMemories: Memory[]
): Promise<Omit<Memory, 'id' | 'accessCount' | 'createdAt' | 'updatedAt' | 'lastAccessedAt'>[]> {
  const newMemories: Omit<Memory, 'id' | 'accessCount' | 'createdAt' | 'updatedAt' | 'lastAccessedAt'>[] = [];

  // 使用 AI 提取记忆
  const conversationText = messages
    .filter(m => m.type === 'user' || m.type === 'assistant')
    .map(m => `${m.type}: ${typeof m.content === 'string' ? m.content : '[复杂内容]'}`)
    .join('\n');

  if (conversationText.length < 50) return [];

  try {
    const result = await sideQuery({
      model: 'claude-haiku-4-20250514',
      systemPrompt: `你是一个记忆提取专家。从对话中提取重要的记忆信息。

输出 JSON 数组，每个元素包含：
- type: fact（事实）| preference（偏好）| style（风格）| goal（目标）| context（上下文）| procedure（流程）
- content: 记忆内容（简洁明了）
- importance: 1-10 的重要性评分
- keywords: 相关关键词数组

只提取有价值的、可能在未来有用的信息。忽略寒暄和无关内容。`,
      messages: [{ role: 'user', content: `请从以下对话中提取记忆：\n\n${conversationText.slice(0, 3000)}` }],
      querySource: 'memory_search',
      maxTokens: 1024,
    });

    if (result.success && result.content) {
      try {
        const extracted = JSON.parse(result.content);
        for (const item of extracted) {
          // 检查是否已存在类似记忆
          const exists = existingMemories.some(
            m => m.content.includes(item.content) || item.content.includes(m.content)
          );
          
          if (!exists && item.content && item.content.length > 5) {
            newMemories.push({
              type: item.type || 'fact',
              content: item.content,
              keywords: item.keywords || extractKeywords(item.content),
              importance: item.importance || 5,
            });
          }
        }
      } catch (parseError) {
        console.warn('Failed to parse memory extraction result:', parseError);
      }
    }
  } catch (error) {
    console.warn('Failed to extract memories:', error);
  }

  // 简单模式匹配作为补充
  const userMessages = messages.filter(m => m.type === 'user');
  
  for (const msg of userMessages) {
    if (typeof msg.content !== 'string') continue;
    
    const content = msg.content.toLowerCase();
    
    // 检测偏好表达
    const preferencePatterns = [
      /我喜欢(.+?)(?:，|。|$)/g,
      /我偏好(.+?)(?:，|。|$)/g,
      /我习惯(.+?)(?:，|。|$)/g,
      /请(不要|别)(.+?)(?:，|。|$)/g,
      /我想要(.+?)(?:，|。|$)/g,
    ];

    for (const pattern of preferencePatterns) {
      const matches = content.matchAll(pattern);
      for (const match of matches) {
        const preference = match[1] || match[2];
        if (preference && preference.length > 2 && preference.length < 100) {
          const exists = existingMemories.some(
            m => m.type === 'preference' && m.content.includes(preference)
          );
          
          if (!exists) {
            newMemories.push({
              type: 'preference',
              content: preference,
              keywords: extractKeywords(preference),
              importance: 5,
            });
          }
        }
      }
    }
  }

  return newMemories;
}

// ============================================================================
// Memory Formatting
// ============================================================================

/**
 * 格式化记忆用于注入到 system prompt
 */
export function formatMemoriesForPrompt(memories: Memory[]): string {
  if (memories.length === 0) return '';

  const lines: string[] = ['## 相关记忆'];
  
  for (const memory of memories) {
    const typeEmoji: Record<Memory['type'], string> = {
      fact: '📌',
      preference: '❤️',
      style: '✨',
      goal: '🎯',
      context: '📝',
      procedure: '📋',
    };
    
    lines.push(`${typeEmoji[memory.type]} ${memory.content}`);
  }

  return lines.join('\n');
}

export default MemoryManager;
