/**
 * Compact - 完整版上下文压缩系统
 * 
 * 基于 Claude Code 源码完整实现
 * 支持 5 级压缩管线、熔断机制、9阶段结构化摘要
 */

import type { Message } from '../QueryEngine';
import { sideQuery } from '../side-query';

// ============================================================================
// Types
// ============================================================================

export interface CompactResult {
  summaryMessages: Message[];
  messagesToKeep: Message[];
  summary: string;
  preCompactTokenCount: number;
  postCompactTokenCount: number;
  compactedCount: number;
  preservedCount: number;
}

export interface CompactOptions {
  keepRecentMessages?: number;
  targetTokens?: number;
  preserveToolCalls?: boolean;
  customInstructions?: string;
  maxCompactRatio?: number; // 最大压缩比例（熔断）
}

export interface TokenStats {
  toolRequests: Map<string, number>;
  toolResults: Map<string, number>;
  humanMessages: number;
  assistantMessages: number;
  localCommandOutputs: number;
  other: number;
  attachments: Map<string, number>;
  duplicateFileReads: Map<string, { count: number; tokens: number }>;
  total: number;
}

export interface CompactBoundary {
  type: 'compact_boundary';
  uuid: string;
  timestamp: number;
  compactMetadata: {
    preCompactTokenCount: number;
    postCompactTokenCount: number;
    summary: string;
  };
}

// ============================================================================
// Constants
// ============================================================================

// 模型上下文窗口配置（tokens）
const MODEL_CONTEXT_WINDOWS: Record<string, number> = {
  // OpenAI
  'gpt-4o': 128000,
  'gpt-4o-mini': 128000,
  'gpt-4-turbo': 128000,
  'gpt-3.5-turbo': 16384,
  // Anthropic
  'claude-3-5-sonnet-20241022': 200000,
  'claude-3-opus-20240229': 200000,
  'claude-3-sonnet-20240229': 200000,
  'claude-3-haiku-20240307': 200000,
  // DeepSeek
  'deepseek-chat': 64000,
  'deepseek-reasoner': 64000,
  'deepseek-v4': 1000000,
  'deepseek-v4-pro': 1000000,
  // 默认值
  'default': 128000,
};

// 压缩比例配置
const AUTO_COMPACT_RATIO = 0.5; // 压缩到 50%
const REACTIVE_COMPACT_RATIO = 0.3; // 压缩到 30%

// 动态阈值计算比例
const AUTO_COMPACT_THRESHOLD_RATIO = 0.6; // 上下文窗口的 60%
const REACTIVE_COMPACT_THRESHOLD_RATIO = 0.8; // 上下文窗口的 80%

// 熔断阈值
const MAX_COMPACT_RATIO = 0.8; // 最大压缩 80%，超过则熔断
const MIN_MESSAGES_TO_KEEP = 5; // 最少保留消息数
const MAX_COMPACT_RETRIES = 3; // 最大重试次数

// 9阶段摘要结构
const SUMMARY_SECTIONS = [
  '用户目标',
  '已完成的任务',
  '关键发现',
  '做出的决策',
  '使用的工具',
  '遇到的问题',
  '当前状态',
  '待办事项',
  '上下文依赖',
];

// ============================================================================
// Model Context Window & Dynamic Thresholds
// ============================================================================

/**
 * 根据模型名称获取上下文窗口大小
 */
export function getModelContextWindow(modelName: string): number {
  if (!modelName) return MODEL_CONTEXT_WINDOWS['default'];
  
  const normalizedName = modelName.toLowerCase();
  
  // 精确匹配
  if (MODEL_CONTEXT_WINDOWS[normalizedName]) {
    return MODEL_CONTEXT_WINDOWS[normalizedName];
  }
  
  // 模糊匹配
  for (const [key, value] of Object.entries(MODEL_CONTEXT_WINDOWS)) {
    if (normalizedName.includes(key.toLowerCase())) {
      return value;
    }
  }
  
  return MODEL_CONTEXT_WINDOWS['default'];
}

/**
 * 根据模型动态计算压缩阈值
 */
export function getCompactThresholds(modelName: string): {
  autoCompactThreshold: number;
  reactiveCompactThreshold: number;
  contextWindow: number;
} {
  const contextWindow = getModelContextWindow(modelName);
  return {
    autoCompactThreshold: Math.floor(contextWindow * AUTO_COMPACT_THRESHOLD_RATIO),
    reactiveCompactThreshold: Math.floor(contextWindow * REACTIVE_COMPACT_THRESHOLD_RATIO),
    contextWindow,
  };
}

// ============================================================================
// Token Estimation
// ============================================================================

/**
 * 估算消息的 token 数量
 */
export function estimateTokens(message: Message): number {
  if (typeof message.content === 'string') {
    // 中文约 1.5 字符/token，英文约 4 字符/token
    const chineseChars = (message.content.match(/[\u4e00-\u9fa5]/g) || []).length;
    const otherChars = message.content.length - chineseChars;
    return Math.ceil(chineseChars / 1.5 + otherChars / 4);
  }
  
  if (Array.isArray(message.content)) {
    return message.content.reduce((sum, block) => {
      if (block.type === 'text' && 'text' in block) {
        const text = block.text as string;
        const chineseChars = (text.match(/[\u4e00-\u9fa5]/g) || []).length;
        const otherChars = text.length - chineseChars;
        return sum + Math.ceil(chineseChars / 1.5 + otherChars / 4);
      }
      return sum + 10; // 非文本块估算为 10 tokens
    }, 0);
  }
  
  return 10;
}

/**
 * 估算消息列表的总 token 数
 */
export function estimateTotalTokens(messages: Message[]): number {
  return messages.reduce((sum, msg) => sum + estimateTokens(msg), 0);
}

// ============================================================================
// Level 1: Snip - 裁剪低价值内容
// ============================================================================

/**
 * 裁剪低价值内容
 * - 移除寒暄语
 * - 移除重复确认
 * - 移除空白消息
 */
export function snipMessages(messages: Message[]): Message[] {
  const lowValuePatterns = [
    /^(好的|好的，|明白|收到|了解|嗯|嗯嗯|好的呢|好的呀)[，。！？\s]*$/i,
    /^(谢谢|感谢|多谢)[，。！？\s]*$/i,
    /^(请问|请教一下)[，。！？\s]*$/i,
    /^(继续|请继续|go on)[，。！？\s]*$/i,
    /^(是的|对|没错)[，。！？\s]*$/i,
    /^(好的我知道了|明白了|了解了)[，。！？\s]*$/i,
  ];

  return messages.filter(msg => {
    if (msg.type === 'user' && typeof msg.content === 'string') {
      const content = msg.content.trim();
      // 检查是否匹配低价值模式
      for (const pattern of lowValuePatterns) {
        if (pattern.test(content)) {
          return false;
        }
      }
      // 检查是否为空或仅空白
      if (content.length < 2) {
        return false;
      }
    }
    return true;
  });
}

// ============================================================================
// Level 2: Micro - 微压缩工具调用结果
// ============================================================================

/**
 * 微压缩工具调用结果
 * - 截断长结果
 * - 保留关键信息
 */
export function microCompactMessages(
  messages: Message[],
  maxResultLength: number = 2000
): Message[] {
  return messages.map(msg => {
    if (msg.type === 'tool_result' && msg.toolUseResult) {
      const result = msg.toolUseResult;
      
      if (result.length > maxResultLength) {
        // 保留前 70% 和后 30%
        const headLength = Math.floor(maxResultLength * 0.7);
        const tailLength = Math.floor(maxResultLength * 0.3);
        
        const head = result.slice(0, headLength);
        const tail = result.slice(-tailLength);
        
        return {
          ...msg,
          toolUseResult: `${head}\n\n... [已截断 ${result.length - maxResultLength} 字符] ...\n\n${tail}`,
        };
      }
    }
    return msg;
  });
}

// ============================================================================
// Level 3: Collapse - 折叠历史上下文
// ============================================================================

/**
 * 折叠历史上下文
 * - 将旧消息压缩为摘要
 * - 保留最近的消息
 */
export async function collapseMessages(
  messages: Message[],
  options: CompactOptions = {}
): Promise<CompactResult> {
  const {
    keepRecentMessages = 10,
    targetTokens = 50000,
    maxCompactRatio = MAX_COMPACT_RATIO,
  } = options;

  const preCompactTokenCount = estimateTotalTokens(messages);

  // 如果已经在目标范围内，不需要压缩
  if (preCompactTokenCount <= targetTokens) {
    return {
      summaryMessages: [],
      messagesToKeep: messages,
      summary: '',
      preCompactTokenCount,
      postCompactTokenCount: preCompactTokenCount,
      compactedCount: 0,
      preservedCount: messages.length,
    };
  }

  // 熔断检查：如果压缩比例过大，拒绝压缩
  const compactRatio = 1 - (targetTokens / preCompactTokenCount);
  if (compactRatio > maxCompactRatio) {
    console.warn(`Compact ratio ${compactRatio.toFixed(2)} exceeds max ${maxCompactRatio}, triggering circuit breaker`);
    // 熔断：只保留最近的消息
    const toKeep = messages.slice(-keepRecentMessages);
    const summary = await generateCircuitBreakerSummary(messages.slice(0, -keepRecentMessages));
    
    const summaryMessage: Message = {
      type: 'user',
      uuid: crypto.randomUUID(),
      timestamp: Date.now(),
      content: `[熔断压缩 - 超过最大压缩比例]\n${summary}`,
      isCompactSummary: true,
    };

    const postCompactTokenCount = estimateTotalTokens([summaryMessage, ...toKeep]);

    return {
      summaryMessages: [summaryMessage],
      messagesToKeep: toKeep,
      summary,
      preCompactTokenCount,
      postCompactTokenCount,
      compactedCount: messages.length - keepRecentMessages,
      preservedCount: keepRecentMessages,
    };
  }

  // 分离要压缩的消息和要保留的消息
  const toCompact = messages.slice(0, -keepRecentMessages);
  const toKeep = messages.slice(-keepRecentMessages);

  // 确保至少保留最小消息数
  if (toKeep.length < MIN_MESSAGES_TO_KEEP) {
    const additionalNeeded = MIN_MESSAGES_TO_KEEP - toKeep.length;
    toKeep.unshift(...toCompact.slice(-additionalNeeded));
    toCompact.splice(-additionalNeeded, additionalNeeded);
  }

  // 生成9阶段结构化摘要
  const summary = await generateStructuredSummary(toCompact);

  // 创建摘要消息
  const summaryMessage: Message = {
    type: 'user',
    uuid: crypto.randomUUID(),
    timestamp: Date.now(),
    content: `[上下文摘要]\n${summary}`,
    isCompactSummary: true,
  };

  const postCompactTokenCount = estimateTotalTokens([summaryMessage, ...toKeep]);

  return {
    summaryMessages: [summaryMessage],
    messagesToKeep: toKeep,
    summary,
    preCompactTokenCount,
    postCompactTokenCount,
    compactedCount: toCompact.length,
    preservedCount: toKeep.length,
  };
}

// ============================================================================
// Level 4: Auto Compact - 自动触发压缩
// ============================================================================

/**
 * 检查是否需要自动压缩
 */
export function shouldAutoCompact(messages: Message[], maxTokens: number = 100000): boolean {
  const tokens = estimateTotalTokens(messages);
  return tokens > maxTokens;
}

/**
 * 执行自动压缩
 */
export async function autoCompact(
  messages: Message[],
  options: CompactOptions = {}
): Promise<CompactResult> {
  const tokens = estimateTotalTokens(messages);
  const targetTokens = Math.floor(tokens * AUTO_COMPACT_RATIO);

  return collapseMessages(messages, {
    ...options,
    targetTokens,
  });
}

// ============================================================================
// Level 5: Reactive Compact - 响应式压缩
// ============================================================================

/**
 * 检查是否需要响应式压缩
 */
export function shouldReactiveCompact(messages: Message[], maxTokens: number = 150000): boolean {
  const tokens = estimateTotalTokens(messages);
  return tokens > maxTokens;
}

/**
 * 执行响应式压缩（更激进的压缩策略）
 */
export async function reactiveCompact(
  messages: Message[],
  options: CompactOptions = {}
): Promise<CompactResult> {
  const tokens = estimateTotalTokens(messages);
  
  // 更激进的压缩：只保留最近 5 条消息
  const keepRecentMessages = 5;
  const targetTokens = Math.floor(tokens * REACTIVE_COMPACT_RATIO);

  return collapseMessages(messages, {
    ...options,
    keepRecentMessages,
    targetTokens,
  });
}

// ============================================================================
// Summary Generation
// ============================================================================

/**
 * 生成9阶段结构化摘要
 */
async function generateStructuredSummary(messages: Message[]): Promise<string> {
  // 提取关键信息
  const userMessages = messages.filter(m => m.type === 'user');
  const assistantMessages = messages.filter(m => m.type === 'assistant');
  const toolCalls = messages.filter(m => m.type === 'tool_result');

  // 构建 AI 摘要请求
  const summaryRequest = `请为以下对话生成一个结构化摘要，包含以下9个部分：
${SUMMARY_SECTIONS.map((s, i) => `${i + 1}. ${s}`).join('\n')}

对话内容：
用户消息: ${userMessages.length} 条
助手消息: ${assistantMessages.length} 条
工具调用: ${toolCalls.length} 次

主要用户请求：
${userMessages.slice(0, 5).map(m => typeof m.content === 'string' ? m.content.slice(0, 200) : '[复杂内容]').join('\n---\n')}`;

  try {
    const result = await sideQuery({
      model: 'claude-haiku-4-20250514',
      systemPrompt: `你是一个对话摘要专家。请生成简洁、准确的结构化摘要。
每个部分用2-3句话描述，保持客观和信息密度。`,
      messages: [{ role: 'user', content: summaryRequest }],
      querySource: 'context_analysis',
      maxTokens: 1024,
    });

    if (result.success && result.content) {
      return result.content;
    }
  } catch (error) {
    console.error('Failed to generate structured summary:', error);
  }

  // 回退到简单摘要
  return generateSimpleSummary(messages);
}

/**
 * 生成简单摘要
 */
async function generateSimpleSummary(messages: Message[]): Promise<string> {
  const userMessages = messages.filter(m => m.type === 'user');
  const assistantMessages = messages.filter(m => m.type === 'assistant');
  const toolCalls = messages.filter(m => m.type === 'tool_result');

  const parts: string[] = [];

  parts.push(`📊 对话统计：`);
  parts.push(`- 用户消息: ${userMessages.length} 条`);
  parts.push(`- 助手消息: ${assistantMessages.length} 条`);
  parts.push(`- 工具调用: ${toolCalls.length} 次`);

  // 提取主要请求
  const mainRequests = userMessages
    .slice(0, 3)
    .map(m => {
      if (typeof m.content === 'string') {
        return m.content.slice(0, 100);
      }
      return '';
    })
    .filter(Boolean);

  if (mainRequests.length > 0) {
    parts.push(`\n🎯 主要请求：`);
    mainRequests.forEach((r, i) => parts.push(`${i + 1}. ${r}`));
  }

  // 提取使用的工具
  const toolNames = new Set(
    toolCalls.map(t => t.toolName).filter(Boolean) as string[]
  );
  if (toolNames.size > 0) {
    parts.push(`\n🔧 使用的工具：${Array.from(toolNames).join(', ')}`);
  }

  return parts.join('\n');
}

/**
 * 生成熔断摘要
 */
async function generateCircuitBreakerSummary(messages: Message[]): Promise<string> {
  const parts: string[] = [];
  parts.push('⚠️ 由于对话过长，触发了熔断机制。');
  parts.push('以下是被压缩内容的简要概述：\n');

  const userMessages = messages.filter(m => m.type === 'user');
  const toolCalls = messages.filter(m => m.type === 'tool_result');

  parts.push(`- 压缩了 ${messages.length} 条消息`);
  parts.push(`- 其中包含 ${userMessages.length} 条用户消息`);
  parts.push(`- 执行了 ${toolCalls.length} 次工具调用`);

  return parts.join('\n');
}

// ============================================================================
// Context Analysis
// ============================================================================

/**
 * 分析上下文 token 分布
 */
export function analyzeContext(messages: Message[]): TokenStats {
  const stats: TokenStats = {
    toolRequests: new Map(),
    toolResults: new Map(),
    humanMessages: 0,
    assistantMessages: 0,
    localCommandOutputs: 0,
    other: 0,
    attachments: new Map(),
    duplicateFileReads: new Map(),
    total: 0,
  };

  const fileReadStats = new Map<string, { count: number; totalTokens: number }>();

  messages.forEach(msg => {
    const tokens = estimateTokens(msg);
    stats.total += tokens;

    if (msg.type === 'user') {
      stats.humanMessages += tokens;
    } else if (msg.type === 'assistant') {
      stats.assistantMessages += tokens;
    } else if (msg.type === 'tool_result') {
      const toolName = msg.toolName ?? 'unknown';
      stats.toolResults.set(toolName, (stats.toolResults.get(toolName) ?? 0) + tokens);
    }
  });

  return stats;
}

// ============================================================================
// Main Compact Function
// ============================================================================

/**
 * 压缩对话上下文
 * 自动选择合适的压缩级别
 */
export async function compactConversation(
  messages: Message[],
  options: CompactOptions = {}
): Promise<CompactResult> {
  // 1. 先执行 Snip（裁剪低价值内容）
  let processed = snipMessages(messages);

  // 2. 执行 Micro（微压缩工具调用结果）
  processed = microCompactMessages(processed);

  // 3. 检查是否需要更激进的压缩
  if (shouldReactiveCompact(processed, options.targetTokens ?? 150000)) {
    return reactiveCompact(processed, options);
  }

  // 4. 检查是否需要自动压缩
  if (shouldAutoCompact(processed, options.targetTokens ?? 100000)) {
    return autoCompact(processed, options);
  }

  // 5. 执行普通压缩
  return collapseMessages(processed, options);
}

export default compactConversation;
