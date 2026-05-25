/**
 * Query Service - 查询服务
 * 
 * 基于 QueryEngine 的新一代 AI 查询服务
 * 支持 AsyncGenerator 流式输出、工具调用、上下文压缩、权限控制
 */

import { QueryEngine, yoloClassify, MemoryManager, agenticMemorySearch } from './query-engine';
import type { Message, Tool, StreamEvent, RequestStartEvent } from './query-engine';

// ============================================================================
// Types
// ============================================================================

export interface QueryOptions {
  config: any;
  messages: QueryMessage[];
  systemPrompt?: string;
  tools?: Tool[];
  maxTurns?: number;
  permissionMode?: 'default' | 'auto' | 'bypass';
  onToken?: (token: string) => void;
  onToolCall?: (name: string, args: any, result: string) => void;
  onStreamEvent?: (event: StreamEvent | RequestStartEvent) => void;
  signal?: AbortSignal;
}

export interface QueryMessage {
  role: 'system' | 'user' | 'assistant';
  content: string;
  toolCalls?: Array<{
    id: string;
    name: string;
    arguments: any;
  }>;
  toolCallId?: string;
}

export interface QueryResult {
  text: string;
  toolCalls: Array<{
    name: string;
    args: any;
    result: string;
  }>;
  usage?: {
    inputTokens: number;
    outputTokens: number;
  };
}

// ============================================================================
// Query Service
// ============================================================================

const memoryManager = new MemoryManager();

/**
 * 创建查询引擎实例
 */
export function createQueryEngineInstance(options: QueryOptions): QueryEngine {
  const tools = options.tools || [];

  const canUseTool = async (tool: Tool, input: any) => {
    const result = await yoloClassify(tool, input);
    if (result.decision === 'allow') {
      return { behavior: 'allow' as const, reason: result.reason };
    } else if (result.decision === 'deny') {
      return { behavior: 'deny' as const, reason: result.reason };
    }
    return { behavior: 'ask' as const, reason: result.reason };
  };

  const config = {
    cwd: process.cwd(),
    tools,
    maxTurns: options.maxTurns || 10,
    canUseTool,
    customSystemPrompt: options.systemPrompt,
    getAppState: () => ({
      toolPermissionContext: {
        mode: options.permissionMode || 'default',
        additionalWorkingDirectories: new Map(),
        alwaysAllowRules: {},
        alwaysDenyRules: {},
        alwaysAskRules: {},
        isBypassPermissionsModeAvailable: options.permissionMode === 'bypass',
      },
      fastMode: false,
      fileHistory: { snapshots: new Map() },
      attribution: { sources: new Map() },
    }),
    setAppState: () => {},
    memoryManager,
  };

  return new QueryEngine(config);
}

/**
 * 执行流式查询
 */
export async function* queryStream(
  options: QueryOptions
): AsyncGenerator<string | { type: 'tool_call'; name: string; args: any; result: string } | { type: 'usage'; input: number; output: number }, void, unknown> {
  const engine = createQueryEngineInstance(options);

  // 转换消息格式
  const messages: Message[] = options.messages.map(msg => ({
    type: msg.role === 'user' ? 'user' : msg.role === 'assistant' ? 'assistant' : 'system',
    uuid: crypto.randomUUID(),
    timestamp: Date.now(),
    content: msg.content,
  }));

  // 执行查询
  for await (const event of engine.submitMessage(messages as any)) {
    if ('type' in event) {
      // 流事件
      if (event.type === 'content_block_delta' && 'delta' in event) {
        const delta = event.delta as any;
        if (delta.type === 'text_delta' && delta.text) {
          yield delta.text;
        }
      }
      // 工具调用
      else if (event.type === 'tool_call') {
        const tcEvent = event as any;
        yield { type: 'tool_call', name: tcEvent.name, args: tcEvent.input, result: '' };
      }
      // 工具结果
      else if (event.type === 'tool_result') {
        const trEvent = event as any;
        yield { type: 'tool_call', name: trEvent.name, args: {}, result: trEvent.result };
      }
      // 使用量
      else if (event.type === 'message_delta' && 'usage' in event) {
        const usage = (event as any).usage;
        yield { type: 'usage', input: usage.inputTokens || 0, output: usage.outputTokens || 0 };
      }
    }
  }
}

/**
 * 获取记忆管理器
 */
export function getMemoryManager(): MemoryManager {
  return memoryManager;
}

/**
 * 搜索相关记忆
 */
export async function searchMemories(query: string): Promise<string> {
  const results = await agenticMemorySearch(query, memoryManager);
  return results.map(r => r.memory.content).join('\n');
}

export { QueryEngine, MemoryManager };
export default queryStream;
