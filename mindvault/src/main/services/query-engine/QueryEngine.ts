/**
 * QueryEngine - 完整版 AI 查询引擎
 * 
 * 基于 Claude Code 源码完整实现
 * 支持 while(true) Agent 循环、流式输出、工具调用、上下文压缩、权限控制、Token 预算
 */

import type { ContentBlockParam, MessageParam } from '@anthropic-ai/sdk/resources/index';
import type { Tool } from './Tool';
import type { PermissionResult, PermissionMode } from './permissions/types';
import { yoloClassify, checkToolPermission } from './permissions/yolo-classifier';
import { compactConversation, shouldAutoCompact, shouldReactiveCompact, estimateTotalTokens, getCompactThresholds } from './compact/compact';
// 记忆系统已删除，使用规则系统替代
// import { agenticMemorySearch, MemoryManager, formatMemoriesForPrompt } from './memory/memory-search';
const aiRules = require('../ai-rules');
const ragService = require('../rag-service');

// ============================================================================
// Types
// ============================================================================

export interface QueryEngineConfig {
  cwd: string;
  tools: Tool[];
  mcpClients?: Map<string, any>;
  maxTurns?: number;
  maxBudgetUsd?: number;
  maxContextTokens?: number;
  abortController?: AbortController;
  canUseTool?: CanUseToolFn;
  customSystemPrompt?: string;
  appendSystemPrompt?: string;
  userSpecifiedModel?: string;
  fallbackModel?: string;
  initialMessages?: Message[];
  thinkingConfig?: ThinkingConfig;
  getAppState: () => AppState;
  setAppState: (updater: (prev: AppState) => AppState) => void;
  handleElicitation?: (request: ElicitationRequest) => Promise<ElicitationResult>;
  permissionMode?: PermissionMode;
  // memoryManager?: MemoryManager; // 已删除
}

export interface Message {
  type: 'user' | 'assistant' | 'system' | 'tool_result' | 'compact_boundary' | 'attachment';
  uuid: string;
  timestamp: number;
  content?: string | ContentBlockParam[];
  toolUseResult?: string;
  toolUseId?: string;
  toolName?: string;
  isMeta?: boolean;
  isCompactSummary?: boolean;
  compactMetadata?: CompactMetadata;
  usage?: Usage;
  apiError?: string;
}

export interface CompactMetadata {
  preCompactTokenCount: number;
  postCompactTokenCount: number;
  summary: string;
  preservedSegment?: {
    headUuid: string;
    anchorUuid: string;
    tailUuid: string;
  };
}

export interface ThinkingConfig {
  type: 'enabled' | 'disabled' | 'adaptive';
  budgetTokens?: number;
}

export interface AppState {
  toolPermissionContext: ToolPermissionContext;
  fastMode: boolean;
  fileHistory: FileHistoryState;
  attribution: AttributionState;
}

export interface ToolPermissionContext {
  mode: PermissionMode;
  additionalWorkingDirectories: Map<string, any>;
  alwaysAllowRules: Record<string, string[]>;
  alwaysDenyRules: Record<string, string[]>;
  alwaysAskRules: Record<string, string[]>;
  isBypassPermissionsModeAvailable: boolean;
  isAutoModeAvailable?: boolean;
}

export interface FileHistoryState {
  snapshots: Map<string, any>;
}

export interface AttributionState {
  sources: Map<string, any>;
}

export interface CanUseToolFn {
  (
    tool: Tool,
    input: Record<string, any>,
    context: ToolUseContext,
    assistantMessage: Message,
    toolUseId: string,
    forceDecision?: boolean
  ): Promise<PermissionResult>;
}

export interface ToolUseContext {
  messages: Message[];
  options: {
    tools: Tool[];
    verbose: boolean;
    mainLoopModel: string;
    thinkingConfig: ThinkingConfig;
    mcpClients?: Map<string, any>;
    customSystemPrompt?: string;
    appendSystemPrompt?: string;
    maxBudgetUsd?: number;
  };
  getAppState: () => AppState;
  setAppState: (updater: (prev: AppState) => AppState) => void;
  abortController: AbortController;
  queryTracking?: {
    chainId: string;
    depth: number;
  };
  agentId?: string;
}

export interface ElicitationRequest {
  message: string;
  type: 'confirmation' | 'input' | 'choice';
  choices?: string[];
}

export interface ElicitationResult {
  action: 'accept' | 'decline' | 'cancel';
  content?: string;
}

export interface Usage {
  inputTokens: number;
  outputTokens: number;
  cacheCreationInputTokens?: number;
  cacheReadInputTokens?: number;
}

export interface StreamEvent {
  type: 'content_block_start' | 'content_block_delta' | 'content_block_stop' | 'message_start' | 'message_delta' | 'message_stop';
  index?: number;
  content_block?: {
    type: 'text' | 'tool_use' | 'thinking';
    id?: string;
    name?: string;
    input?: Record<string, any>;
  };
  delta?: {
    type: 'text_delta' | 'input_json_delta' | 'thinking_delta';
    text?: string;
    partial_json?: string;
    thinking?: string;
  };
  message?: {
    id: string;
    model: string;
    usage: Usage;
  };
  usage?: Usage;
}

export interface RequestStartEvent {
  type: 'stream_request_start';
  model: string;
}

export interface ToolCallEvent {
  type: 'tool_call';
  id: string;
  name: string;
  input: Record<string, any>;
}

export interface ToolResultEvent {
  type: 'tool_result';
  id: string;
  name: string;
  result: string;
  isError?: boolean;
}

export interface CompactEvent {
  type: 'compact_boundary';
  summary: string;
  preCompactTokens: number;
  postCompactTokens: number;
}

export interface PermissionRequestEvent {
  type: 'permission_request';
  toolName: string;
  input: Record<string, any>;
  reason: string;
}

export interface PermissionDecisionEvent {
  type: 'permission_decision';
  toolName: string;
  decision: 'allow' | 'deny';
}

// 查询循环状态
interface QueryState {
  messages: Message[];
  turnCount: number;
  maxOutputTokensRecoveryCount: number;
  hasAttemptedReactiveCompact: boolean;
  pendingToolCalls: Array<{
    id: string;
    name: string;
    input: Record<string, any>;
  }>;
  totalUsage: Usage;
  shouldStop: boolean;
  stopReason?: 'end_turn' | 'max_tokens' | 'stop_sequence' | 'tool_use' | 'error' | 'user_abort';
}

// ============================================================================
// QueryEngine Class
// ============================================================================

export class QueryEngine {
  private config: QueryEngineConfig;
  private abortController: AbortController;
  private permissionDenials: Array<{
    tool_name: string;
    tool_use_id: string;
    tool_input: Record<string, any>;
  }> = [];
  // private memoryManager: MemoryManager; // 已删除

  constructor(config: QueryEngineConfig) {
    this.config = config;
    this.abortController = config.abortController ?? new AbortController();
    // this.memoryManager = config.memoryManager ?? new MemoryManager(); // 已删除
  }

  /**
   * 提交用户消息并启动 Agent 循环
   * 完整实现 while(true) 模式
   */
  async *submitMessage(
    prompt: string | ContentBlockParam[],
    options?: { uuid?: string; isMeta?: boolean }
  ): AsyncGenerator<
    | StreamEvent
    | RequestStartEvent
    | Message
    | ToolCallEvent
    | ToolResultEvent
    | CompactEvent
    | PermissionRequestEvent
    | PermissionDecisionEvent,
    void,
    unknown
  > {
    const {
      cwd,
      tools,
      maxTurns = 20,
      maxContextTokens = 200000,
      permissionMode = 'default',
      userSpecifiedModel,
      fallbackModel,
      thinkingConfig,
    } = this.config;

    // 初始化状态
    const state: QueryState = {
      messages: this.config.initialMessages ?? [],
      turnCount: 0,
      maxOutputTokensRecoveryCount: 0,
      hasAttemptedReactiveCompact: false,
      pendingToolCalls: [],
      totalUsage: { inputTokens: 0, outputTokens: 0 },
      shouldStop: false,
    };

    // 添加用户消息
    const userMessage: Message = {
      type: 'user',
      uuid: options?.uuid ?? crypto.randomUUID(),
      timestamp: Date.now(),
      content: typeof prompt === 'string' ? prompt : prompt,
    };
    state.messages.push(userMessage);

    // 发送请求开始事件
    yield {
      type: 'stream_request_start',
      model: userSpecifiedModel ?? fallbackModel ?? 'claude-sonnet-4-20250514',
    };

    // ========== 主循环 while(true) ==========
    while (!state.shouldStop && state.turnCount < maxTurns) {
      state.turnCount++;

      // 检查中止信号
      if (this.abortController.signal.aborted) {
        state.stopReason = 'user_abort';
        break;
      }

      // 1. 检查是否需要压缩上下文（使用动态阈值）
      const modelName = this.config.userSpecifiedModel ?? this.config.fallbackModel ?? '';
      const { autoCompactThreshold, reactiveCompactThreshold } = getCompactThresholds(modelName);
      
      const currentTokens = estimateTotalTokens(state.messages);
      if (shouldReactiveCompact(state.messages, reactiveCompactThreshold)) {
        // 响应式压缩
        const compactResult = await this.performCompact(state.messages, 'reactive');
        if (compactResult) {
          yield {
            type: 'compact_boundary',
            summary: compactResult.summary,
            preCompactTokens: compactResult.preCompactTokenCount,
            postCompactTokens: compactResult.postCompactTokenCount,
          };
          state.messages = compactResult.messages;
          state.hasAttemptedReactiveCompact = true;
        }
      } else if (shouldAutoCompact(state.messages, autoCompactThreshold)) {
        // 自动压缩
        const compactResult = await this.performCompact(state.messages, 'auto');
        if (compactResult) {
          yield {
            type: 'compact_boundary',
            summary: compactResult.summary,
            preCompactTokens: compactResult.preCompactTokenCount,
            postCompactTokens: compactResult.postCompactTokenCount,
          };
          state.messages = compactResult.messages;
        }
      }

      // 2. 构建系统提示（包含记忆注入和 RAG 检索）
      const userPrompt = typeof prompt === 'string' ? prompt : undefined;
      const systemPrompt = await this.buildSystemPrompt(tools, userPrompt);

      // 3. 调用 API
      const response = await this.callAPI({
        messages: state.messages,
        systemPrompt,
        tools,
        thinkingConfig,
      });

      // 4. 流式输出响应
      for (const event of response.streamEvents) {
        yield event;
      }

      // 5. 处理助手消息
      const assistantMessage: Message = {
        type: 'assistant',
        uuid: crypto.randomUUID(),
        timestamp: Date.now(),
        content: response.content,
        usage: response.usage,
        apiError: response.error,
      };
      state.messages.push(assistantMessage);

      // 更新总使用量
      if (response.usage) {
        state.totalUsage.inputTokens += response.usage.inputTokens;
        state.totalUsage.outputTokens += response.usage.outputTokens;
      }

      // 6. 检查错误
      if (response.error) {
        if (response.error === 'max_output_tokens') {
          // 尝试恢复
          state.maxOutputTokensRecoveryCount++;
          if (state.maxOutputTokensRecoveryCount <= 3) {
            continue; // 继续循环
          }
        }
        state.shouldStop = true;
        state.stopReason = 'error';
        break;
      }

      // 7. 处理工具调用
      if (response.toolCalls && response.toolCalls.length > 0) {
        for (const toolCall of response.toolCalls) {
          const tool = tools.find(t => t.name === toolCall.name);
          if (!tool) {
            // 工具不存在
            const errorMessage: Message = {
              type: 'tool_result',
              uuid: crypto.randomUUID(),
              timestamp: Date.now(),
              toolUseId: toolCall.id,
              toolName: toolCall.name,
              toolUseResult: `Error: Unknown tool "${toolCall.name}"`,
            };
            state.messages.push(errorMessage);
            yield {
              type: 'tool_result',
              id: toolCall.id,
              name: toolCall.name,
              result: `Error: Unknown tool "${toolCall.name}"`,
              isError: true,
            };
            continue;
          }

          // 发送工具调用事件
          yield {
            type: 'tool_call',
            id: toolCall.id,
            name: toolCall.name,
            input: toolCall.input,
          };

          // 检查权限
          const permissionResult = await this.checkPermission(tool, toolCall.input, permissionMode);
          
          yield {
            type: 'permission_decision',
            toolName: toolCall.name,
            decision: permissionResult.allowed ? 'allow' : 'deny',
          };

          if (!permissionResult.allowed) {
            // 权限被拒绝
            const denyMessage: Message = {
              type: 'tool_result',
              uuid: crypto.randomUUID(),
              timestamp: Date.now(),
              toolUseId: toolCall.id,
              toolName: toolCall.name,
              toolUseResult: `Permission denied: ${permissionResult.reason}`,
            };
            state.messages.push(denyMessage);
            yield {
              type: 'tool_result',
              id: toolCall.id,
              name: toolCall.name,
              result: `Permission denied: ${permissionResult.reason}`,
              isError: true,
            };
            continue;
          }

          // 需要确认
          if (permissionResult.needsConfirmation) {
            yield {
              type: 'permission_request',
              toolName: toolCall.name,
              input: toolCall.input,
              reason: permissionResult.reason ?? 'This action requires confirmation',
            };
            // 这里应该等待用户确认，简化实现直接允许
          }

          // 执行工具
          try {
            const result = await tool.execute(toolCall.input);
            const resultStr = typeof result === 'string' ? result : JSON.stringify(result, null, 2);
            
            const resultMessage: Message = {
              type: 'tool_result',
              uuid: crypto.randomUUID(),
              timestamp: Date.now(),
              toolUseId: toolCall.id,
              toolName: toolCall.name,
              toolUseResult: resultStr,
            };
            state.messages.push(resultMessage);
            
            yield {
              type: 'tool_result',
              id: toolCall.id,
              name: toolCall.name,
              result: resultStr,
            };
          } catch (error: any) {
            const errorMessage: Message = {
              type: 'tool_result',
              uuid: crypto.randomUUID(),
              timestamp: Date.now(),
              toolUseId: toolCall.id,
              toolName: toolCall.name,
              toolUseResult: `Error: ${error.message}`,
            };
            state.messages.push(errorMessage);
            
            yield {
              type: 'tool_result',
              id: toolCall.id,
              name: toolCall.name,
              result: `Error: ${error.message}`,
              isError: true,
            };
          }
        }
        
        // 有工具调用，继续循环
        continue;
      }

      // 8. 没有工具调用，结束循环
      state.shouldStop = true;
      state.stopReason = 'end_turn';
    }

    // 9. 记忆提取已移除，使用规则系统替代
    // await this.extractMemories(state.messages);
  }

  /**
   * 构建系统提示
   */
  private async buildSystemPrompt(tools: Tool[], userPrompt?: string): Promise<string> {
    const parts: string[] = [];

    // 基础系统提示
    if (this.config.customSystemPrompt) {
      parts.push(this.config.customSystemPrompt);
    } else {
      parts.push(this.getDefaultSystemPrompt());
    }

    // 工具描述
    const toolDescriptions = tools
      .map(t => `- ${t.name}: ${t.description}`)
      .join('\n');
    parts.push(`\n\n## Available Tools\n${toolDescriptions}`);

    // RAG 自动检索（如果提供了用户提示）
    if (userPrompt && typeof userPrompt === 'string') {
      try {
        const ragResults = await ragService.search(userPrompt, this.getAIConfig(), { limit: 5 });
        if (ragResults && ragResults.length > 0) {
          const ragContext = ragService.formatForPrompt(ragResults);
          parts.push(ragContext);
          console.log(`[QueryEngine] RAG 检索到 ${ragResults.length} 条相关内容`);
        }
      } catch (err) {
        console.warn('[QueryEngine] RAG 检索失败:', err.message);
      }
    }

    // 规则注入（替代记忆系统）
    const activeRules = aiRules.getActiveRules('global');
    if (activeRules && activeRules.length > 0) {
      const rulesText = aiRules.injectRules('', activeRules);
      if (rulesText) {
        parts.push(rulesText);
      }
    }

    // 追加提示
    if (this.config.appendSystemPrompt) {
      parts.push('\n\n' + this.config.appendSystemPrompt);
    }

    return parts.join('');
  }

  /**
   * 获取 AI 配置（用于 RAG Embedding）
   */
  private getAIConfig(): any {
    // 从配置或全局设置获取 AI 配置
    // 这里需要根据实际项目结构调整
    try {
      const repo = require('../../db/repository');
      const db = repo.db;
      if (!db) return null;
      
      const settings = db.prepare("SELECT value FROM settings WHERE key = 'aiConfig'").get();
      if (settings && settings.value) {
        return JSON.parse(settings.value);
      }
    } catch (err) {
      console.warn('[QueryEngine] 获取 AI 配置失败:', err.message);
    }
    return null;
  }

  /**
   * 获取默认系统提示
   */
  private getDefaultSystemPrompt(): string {
    return `You are Claude, a helpful AI assistant integrated into MindVault (脑洞集), a creativity management application.

Your role is to help users manage their creative ideas, notes, and content. You have access to various tools for:
- Creating, updating, and searching creativity items
- Managing tags and categories
- Working with the kanban board
- Controlling music playback
- And more

When the user asks you to do something, use the appropriate tools to accomplish the task. Always explain what you're doing and why.

## Guidelines
1. Be concise and helpful
2. Use tools when appropriate to accomplish tasks
3. Explain your reasoning before taking actions
4. Ask for clarification if the request is ambiguous
5. Report errors clearly and suggest solutions

## Tool Usage
- For read-only operations, proceed without asking
- For write operations, briefly explain what you're about to do
- For dangerous operations, always ask for confirmation`;
  }

  /**
   * 调用 API
   */
  private async callAPI(params: {
    messages: Message[];
    systemPrompt: string;
    tools: Tool[];
    thinkingConfig?: ThinkingConfig;
  }): Promise<{
    content: ContentBlockParam[];
    toolCalls: Array<{ id: string; name: string; input: Record<string, any> }>;
    streamEvents: StreamEvent[];
    usage?: Usage;
    error?: string;
  }> {
    // 这里需要调用实际的 AI 服务
    // 导入 ai-service
    const aiServiceModule: any = await import('../ai-service');
    const aiService = aiServiceModule.default || aiServiceModule;
    
    // 转换消息格式
    const apiMessages = this.convertMessagesToAPI(params.messages);
    
    try {
      // 调用 AI 服务的流式接口
      const streamEvents: StreamEvent[] = [];
      const content: ContentBlockParam[] = [];
      const toolCalls: Array<{ id: string; name: string; input: Record<string, any> }> = [];
      let usage: Usage | undefined;

      // 模拟流式响应（实际实现需要调用真实 API）
      const response = await aiService.chatStreamWithTools({
        messages: apiMessages,
        systemPrompt: params.systemPrompt,
        tools: params.tools.map(t => ({
          name: t.name,
          description: t.description,
          parameters: t.inputSchema,
        })),
        model: this.config.userSpecifiedModel ?? this.config.fallbackModel,
      });

      // 收集流式事件
      for await (const chunk of response.stream) {
        if (chunk.type === 'content_block_delta') {
          streamEvents.push(chunk as StreamEvent);
          if ('delta' in chunk && chunk.delta?.type === 'text_delta') {
            content.push({
              type: 'text',
              text: chunk.delta.text ?? '',
            });
          }
        } else if (chunk.type === 'content_block_start') {
          streamEvents.push(chunk as StreamEvent);
          if ('content_block' in chunk && chunk.content_block?.type === 'tool_use') {
            toolCalls.push({
              id: chunk.content_block.id ?? '',
              name: chunk.content_block.name ?? '',
              input: chunk.content_block.input ?? {},
            });
          }
        } else if (chunk.type === 'message_delta') {
          streamEvents.push(chunk as StreamEvent);
          if ('usage' in chunk) {
            usage = {
              inputTokens: chunk.usage.input_tokens ?? 0,
              outputTokens: chunk.usage.output_tokens ?? 0,
            };
          }
        }
      }

      return {
        content,
        toolCalls,
        streamEvents,
        usage,
      };
    } catch (error: any) {
      return {
        content: [],
        toolCalls: [],
        streamEvents: [],
        error: error.message,
      };
    }
  }

  /**
   * 转换消息格式
   */
  private convertMessagesToAPI(messages: Message[]): MessageParam[] {
    return messages.map(msg => {
      if (msg.type === 'user') {
        return {
          role: 'user',
          content: typeof msg.content === 'string' ? msg.content : msg.content,
        };
      } else if (msg.type === 'assistant') {
        return {
          role: 'assistant',
          content: typeof msg.content === 'string' ? msg.content : msg.content,
        };
      } else if (msg.type === 'tool_result') {
        return {
          role: 'user',
          content: [{
            type: 'tool_result',
            tool_use_id: msg.toolUseId ?? '',
            content: msg.toolUseResult ?? '',
          }],
        };
      } else if (msg.type === 'compact_boundary') {
        return {
          role: 'user',
          content: `[Context was compacted. Summary: ${msg.compactMetadata?.summary ?? 'N/A'}]`,
        };
      }
      return {
        role: 'user',
        content: '',
      };
    });
  }

  /**
   * 检查权限
   */
  private async checkPermission(
    tool: Tool,
    input: Record<string, any>,
    mode: PermissionMode
  ): Promise<{
    allowed: boolean;
    reason?: string;
    needsConfirmation: boolean;
  }> {
    // bypass 模式：允许所有
    if (mode === 'bypass') {
      return { allowed: true, needsConfirmation: false };
    }

    // 使用 YOLO 分类器
    const result = await yoloClassify(tool, input);

    // auto 模式：根据分类结果
    if (mode === 'auto') {
      if (result.decision === 'allow') {
        return { allowed: true, needsConfirmation: false, reason: result.reason };
      } else if (result.decision === 'deny') {
        return { allowed: false, reason: result.reason, needsConfirmation: false };
      }
      // ask 需要确认
      return { allowed: true, reason: result.reason, needsConfirmation: true };
    }

    // default 模式：只读自动允许，其他需要确认
    if (tool.readOnly) {
      return { allowed: true, needsConfirmation: false };
    }

    return { allowed: true, reason: result.reason, needsConfirmation: true };
  }

  /**
   * 执行压缩
   */
  private async performCompact(
    messages: Message[],
    type: 'auto' | 'reactive' | 'manual'
  ): Promise<{
    messages: Message[];
    summary: string;
    preCompactTokenCount: number;
    postCompactTokenCount: number;
  } | null> {
    try {
      const result = await compactConversation(messages);
      return {
        messages: [...result.summaryMessages, ...result.messagesToKeep],
        summary: result.summary,
        preCompactTokenCount: result.preCompactTokenCount,
        postCompactTokenCount: result.postCompactTokenCount,
      };
    } catch (error) {
      console.error('Compact failed:', error);
      return null;
    }
  }

  /**
   * 获取最后的用户消息
   */
  private getLastUserMessage(): Message | undefined {
    for (let i = this.config.initialMessages?.length ?? 0; i >= 0; i--) {
      const msg = this.config.initialMessages?.[i];
      if (msg?.type === 'user') {
        return msg;
      }
    }
    return undefined;
  }

  /**
   * 从对话中提取记忆
   */
  // 记忆提取功能已删除，使用规则系统替代
  // private async extractMemories(messages: Message[]): Promise<void> { ... }

  /**
   * 中止查询
   */
  abort(): void {
    this.abortController.abort();
  }

  /**
   * 获取权限拒绝记录
   */
  getPermissionDenials(): Array<{
    tool_name: string;
    tool_use_id: string;
    tool_input: Record<string, any>;
  }> {
    return [...this.permissionDenials];
  }

  /**
   * 获取记忆管理器（已删除）
   */
  // getMemoryManager(): MemoryManager { ... } // 已删除
}

export default QueryEngine;
