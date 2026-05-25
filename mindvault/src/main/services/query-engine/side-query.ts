/**
 * Side Query - 双AI审核系统
 * 
 * 基于 Claude Code 的 sideQuery 架构
 * 用于权限审核、上下文分析、记忆搜索等辅助查询
 */

import type { Tool } from './Tool';
import type { Message } from './QueryEngine';

// ============================================================================
// Types
// ============================================================================

export interface SideQueryOptions {
  model: string;
  systemPrompt?: string;
  messages: SideQueryMessage[];
  tools?: Tool[];
  toolChoice?: { type: 'tool'; name: string } | { type: 'auto' };
  maxTokens?: number;
  temperature?: number;
  signal?: AbortSignal;
  querySource: 'permission_explainer' | 'session_search' | 'context_analysis' | 'memory_search' | 'validation';
}

export interface SideQueryMessage {
  role: 'user' | 'assistant' | 'system';
  content: string;
}

export interface SideQueryResult {
  success: boolean;
  content?: string;
  toolCalls?: Array<{
    name: string;
    input: Record<string, any>;
  }>;
  usage?: {
    inputTokens: number;
    outputTokens: number;
  };
  error?: string;
}

// ============================================================================
// Permission Explainer Prompts
// ============================================================================

const PERMISSION_EXPLAINER_SYSTEM_PROMPT = `You are a permission explainer. Your job is to analyze tool calls and explain what they do in simple terms.

When a user asks to perform an action that requires permission, you should:
1. Explain what the tool does in plain language
2. Describe what data or resources it will access or modify
3. Highlight any potential risks
4. Suggest safer alternatives if applicable

Be concise and helpful. Use bullet points for clarity.`;

const PERMISSION_REVIEWER_SYSTEM_PROMPT = `You are a security reviewer AI. Your job is to review tool calls and determine if they are safe to execute.

For each tool call, you should:
1. Analyze the tool name and input parameters
2. Determine the risk level (safe, moderate, dangerous)
3. Check for any suspicious patterns or potential abuse
4. Provide a recommendation (allow, ask, deny)

Output your decision in the following JSON format:
{
  "decision": "allow" | "ask" | "deny",
  "riskLevel": "safe" | "moderate" | "dangerous",
  "reason": "explanation of your decision",
  "suggestions": ["optional suggestions for safer alternatives"]
}`;

// ============================================================================
// Side Query Implementation
// ============================================================================

/**
 * 执行辅助查询
 * 用于权限审核、上下文分析等场景
 */
export async function sideQuery(options: SideQueryOptions): Promise<SideQueryResult> {
  const {
    model,
    systemPrompt,
    messages,
    tools,
    toolChoice,
    maxTokens = 1024,
    temperature = 0.3,
    signal,
    querySource,
  } = options;

  try {
    // 导入 AI 服务
    const aiServiceModule: any = await import('../ai-service');
    const aiService = aiServiceModule.default || aiServiceModule;

    // 构建请求
    const requestMessages = [
      ...(systemPrompt ? [{ role: 'system' as const, content: systemPrompt }] : []),
      ...messages,
    ];

    // 调用 AI 服务
    const response = await (aiService as any).chat?.({
      messages: requestMessages,
      model,
      maxTokens,
      temperature,
      tools: tools?.map(t => ({
        name: t.name,
        description: t.description,
        parameters: t.inputSchema,
      })),
      toolChoice,
    });

    return {
      success: true,
      content: response.content,
      toolCalls: response.toolCalls,
      usage: response.usage,
    };
  } catch (error: any) {
    return {
      success: false,
      error: error.message,
    };
  }
}

/**
 * 权限解释器 - 解释工具调用的作用
 */
export async function explainPermission(
  toolName: string,
  input: Record<string, any>,
  model: string
): Promise<string> {
  const result = await sideQuery({
    model,
    systemPrompt: PERMISSION_EXPLAINER_SYSTEM_PROMPT,
    messages: [
      {
        role: 'user',
        content: `Please explain what this tool call does:\n\nTool: ${toolName}\nInput: ${JSON.stringify(input, null, 2)}`,
      },
    ],
    querySource: 'permission_explainer',
    maxTokens: 512,
  });

  return result.success ? result.content ?? 'Unable to explain' : 'Error explaining permission';
}

/**
 * 权限审核器 - 双AI审核
 * 主 AI 提议，影子 AI 审核
 */
export async function reviewPermission(
  toolName: string,
  input: Record<string, any>,
  model: string,
  context?: {
    recentToolCalls?: Array<{ name: string; input: Record<string, any>; result: string }>;
    userMessage?: string;
  }
): Promise<{
  decision: 'allow' | 'ask' | 'deny';
  riskLevel: 'safe' | 'moderate' | 'dangerous';
  reason: string;
  suggestions?: string[];
}> {
  // 构建上下文信息
  const contextInfo = context?.recentToolCalls
    ? `\n\nRecent tool calls:\n${context.recentToolCalls.map(t => `- ${t.name}: ${JSON.stringify(t.input)}`).join('\n')}`
    : '';

  const userContext = context?.userMessage
    ? `\n\nUser's request: ${context.userMessage}`
    : '';

  const result = await sideQuery({
    model,
    systemPrompt: PERMISSION_REVIEWER_SYSTEM_PROMPT,
    messages: [
      {
        role: 'user',
        content: `Please review this tool call:${contextInfo}${userContext}\n\nTool: ${toolName}\nInput: ${JSON.stringify(input, null, 2)}`,
      },
    ],
    querySource: 'permission_explainer',
    maxTokens: 512,
  });

  if (!result.success || !result.content) {
    // 默认保守策略：需要确认
    return {
      decision: 'ask',
      riskLevel: 'moderate',
      reason: 'Unable to review permission, defaulting to ask for confirmation',
    };
  }

  try {
    // 尝试解析 JSON 响应
    const parsed = JSON.parse(result.content);
    return {
      decision: parsed.decision ?? 'ask',
      riskLevel: parsed.riskLevel ?? 'moderate',
      reason: parsed.reason ?? 'No reason provided',
      suggestions: parsed.suggestions,
    };
  } catch {
    // 无法解析 JSON，使用文本分析
    const content = result.content.toLowerCase();
    if (content.includes('deny') || content.includes('dangerous')) {
      return {
        decision: 'deny',
        riskLevel: 'dangerous',
        reason: result.content,
      };
    }
    if (content.includes('ask') || content.includes('moderate')) {
      return {
        decision: 'ask',
        riskLevel: 'moderate',
        reason: result.content,
      };
    }
    return {
      decision: 'allow',
      riskLevel: 'safe',
      reason: result.content,
    };
  }
}

/**
 * 会话搜索 - 使用 AI 搜索相关历史对话
 */
export async function searchSessions(
  query: string,
  sessions: Array<{ id: string; title: string; summary?: string; messages: Message[] }>,
  model: string
): Promise<Array<{ sessionId: string; relevance: number; reason: string }>> {
  const sessionDescriptions = sessions
    .map((s, i) => `[${i}] ${s.title}${s.summary ? `: ${s.summary}` : ''}`)
    .join('\n');

  const result = await sideQuery({
    model,
    systemPrompt: `You are a session search assistant. Given a query and a list of sessions, identify which sessions are most relevant.

Output a JSON array of objects with:
- index: the session index
- relevance: a score from 0 to 1
- reason: a brief explanation

Only include sessions with relevance > 0.3`,
    messages: [
      {
        role: 'user',
        content: `Query: ${query}\n\nSessions:\n${sessionDescriptions}`,
      },
    ],
    querySource: 'session_search',
    maxTokens: 1024,
  });

  if (!result.success || !result.content) {
    return [];
  }

  try {
    const parsed = JSON.parse(result.content);
    return parsed.map((item: any) => ({
      sessionId: sessions[item.index]?.id ?? '',
      relevance: item.relevance ?? 0,
      reason: item.reason ?? '',
    }));
  } catch {
    return [];
  }
}

/**
 * 上下文分析 - 分析当前对话上下文
 */
export async function analyzeContext(
  messages: Message[],
  model: string
): Promise<{
  tokenStats: {
    humanMessages: number;
    assistantMessages: number;
    toolCalls: number;
    total: number;
  };
  topics: string[];
  suggestions: string[];
}> {
  const messageSummary = messages.map(m => ({
    type: m.type,
    contentLength: typeof m.content === 'string' ? m.content.length : 0,
  }));

  const result = await sideQuery({
    model,
    systemPrompt: `You are a context analysis assistant. Analyze the conversation and provide insights.

Output JSON with:
- tokenStats: { humanMessages, assistantMessages, toolCalls, total }
- topics: array of main topics discussed
- suggestions: array of suggestions for improving the conversation`,
    messages: [
      {
        role: 'user',
        content: `Analyze this conversation:\n${JSON.stringify(messageSummary, null, 2)}`,
      },
    ],
    querySource: 'context_analysis',
    maxTokens: 512,
  });

  if (!result.success || !result.content) {
    return {
      tokenStats: {
        humanMessages: messages.filter(m => m.type === 'user').length,
        assistantMessages: messages.filter(m => m.type === 'assistant').length,
        toolCalls: messages.filter(m => m.type === 'tool_result').length,
        total: messages.length,
      },
      topics: [],
      suggestions: [],
    };
  }

  try {
    return JSON.parse(result.content);
  } catch {
    return {
      tokenStats: {
        humanMessages: messages.filter(m => m.type === 'user').length,
        assistantMessages: messages.filter(m => m.type === 'assistant').length,
        toolCalls: messages.filter(m => m.type === 'tool_result').length,
        total: messages.length,
      },
      topics: [],
      suggestions: [],
    };
  }
}

export default sideQuery;
