/**
 * AI 统一服务层
 * 支持 OpenAI / Anthropic / 自定义 OpenAI 兼容 API
 */
import OpenAI from 'openai';
import Anthropic from '@anthropic-ai/sdk';
const { getToolDefinitions, executeTool, setAIConfig } = require('./tool-executor');
const aiUsageStats = require('./ai-usage-stats');
let mcpBridge: any = null;
try {
  mcpBridge = require('./mcp-bridge').mcpBridge;
} catch (e) {
  console.warn('[AI] MCP bridge not available:', (e as any).message);
}

// 内联类型定义（避免跨 rootDir 引用 shared/types）
export interface AIProviderConfig {
  provider: 'openai' | 'anthropic' | 'deepseek' | 'custom';
  apiKey: string;
  baseUrl?: string;
  model: string;
}

export interface AIChatMessage {
  role: 'system' | 'user' | 'assistant';
  content: string;
}

// 当前活跃的流式请求控制器，用于中止生成
let currentAbortController: AbortController | null = null;

export function stopGeneration(): void {
  if (currentAbortController) {
    currentAbortController.abort();
    currentAbortController = null;
  }
}

/**
 * 非流式对话
 */
export async function chat(
  config: AIProviderConfig,
  messages: AIChatMessage[],
): Promise<string> {
  if (config.provider === 'anthropic') {
    return chatAnthropic(config, messages);
  }
  return chatOpenAICompatible(withProviderDefaults(config), messages);
}

/**
 * 流式对话 - 通过回调返回 token
 * 返回完整文本
 */
export async function chatStream(
  config: AIProviderConfig,
  messages: AIChatMessage[],
  onToken: (token: string) => void,
  signal?: AbortSignal,
): Promise<string> {
  const startTime = Date.now();
  let isError = false;
  try {
    let result: string;
    if (config.provider === 'anthropic') {
      result = await streamAnthropic(config, messages, onToken, signal);
    } else {
      result = await streamOpenAICompatible(withProviderDefaults(config), messages, onToken, signal);
    }
    try {
      aiUsageStats.recordUsage({
        provider: config.provider || 'openai',
        model: config.model || 'unknown',
        latencyMs: Date.now() - startTime,
        isError: false,
      });
    } catch { /* ignore stats errors */ }
    return result;
  } catch (err) {
    isError = true;
    try {
      aiUsageStats.recordUsage({
        provider: config.provider || 'openai',
        model: config.model || 'unknown',
        latencyMs: Date.now() - startTime,
        isError: true,
      });
    } catch { /* ignore stats errors */ }
    throw err;
  }
}

/**
 * 测试连接
 */
export async function testConnection(config: AIProviderConfig): Promise<{ success: boolean; latency: number; error?: string }> {
  const start = Date.now();
  try {
    const messages: AIChatMessage[] = [{ role: 'user', content: 'Hi' }];
    await chat(config, messages);
    const latency = Date.now() - start;
    return { success: true, latency };
  } catch (err: any) {
    const latency = Date.now() - start;
    return { success: false, latency, error: err.message || String(err) };
  }
}

/**
 * 获取模型列表（仅 OpenAI 兼容）
 */
export async function listModels(config: AIProviderConfig): Promise<string[]> {
  try {
    if (config.provider === 'anthropic') {
      // Anthropic 不提供公开的模型列表 API，返回预设
      return [
        'claude-opus-4-7',
        'claude-sonnet-4-6',
        'claude-haiku-4',
      ];
    }

    const baseUrl = config.baseUrl || 'https://api.openai.com/v1';
    const response = await fetch(`${baseUrl}/models`, {
      headers: {
        'Authorization': `Bearer ${config.apiKey}`,
        'Content-Type': 'application/json',
      },
      signal: AbortSignal.timeout(10000),
    });

    if (!response.ok) {
      throw new Error(`HTTP ${response.status}: ${response.statusText}`);
    }

    const data: any = await response.json();
    const models: string[] = (data.data || [])
      .map((m: any) => m.id)
      .sort();
    return models;
  } catch (err: any) {
    console.error('[AI] 获取模型列表失败:', err);
    throw err;
  }
}

/**
 * 联网搜索 - 使用 DuckDuckGo 搜索
 * @param query 搜索关键词
 * @returns 搜索结果文本摘要
 */
export async function webSearch(query: string): Promise<string> {
  try {
    // 使用 DuckDuckGo 的 HTML 搜索结果
    const searchUrl = `https://html.duckduckgo.com/html/?q=${encodeURIComponent(query)}`;

    const response = await fetch(searchUrl, {
      headers: {
        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
        'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,image/webp,*/*;q=0.8',
        'Accept-Language': 'zh-CN,zh;q=0.9,en;q=0.8',
      },
      signal: AbortSignal.timeout(15000),
    });

    if (!response.ok) {
      throw new Error(`搜索请求失败: HTTP ${response.status}`);
    }

    const html = await response.text();

    // 解析搜索结果
    const results = parseDuckDuckGoResults(html);

    if (results.length === 0) {
      return '未找到相关搜索结果。';
    }

    // 格式化搜索结果为文本
    const formattedResults = results
      .slice(0, 5) // 取前5条结果
      .map((result, index) => {
        return `[${index + 1}] ${result.title}\n${result.snippet}\n来源: ${result.url}`;
      })
      .join('\n\n');

    return `搜索关键词: "${query}"\n\n搜索结果:\n\n${formattedResults}`;
  } catch (err: any) {
    console.error('[AI] 联网搜索失败:', err);
    throw new Error(`联网搜索失败: ${err.message}`);
  }
}

/**
 * 解析 DuckDuckGo HTML 搜索结果
 */
function parseDuckDuckGoResults(html: string): Array<{ title: string; snippet: string; url: string }> {
  const results: Array<{ title: string; snippet: string; url: string }> = [];

  try {
    // 使用正则表达式提取搜索结果
    // DuckDuckGo HTML 版本的搜索结果结构
    const resultRegex = /<div class="result[^"]*"[^>]*>.*?<\/div>\s*<\/div>/gs;
    const matches = html.match(resultRegex);

    if (!matches) {
      return results;
    }

    for (const match of matches.slice(0, 10)) {
      try {
        // 提取标题
        const titleMatch = match.match(/<a[^>]*class="result__a"[^>]*>(.*?)<\/a>/s);
        const title = titleMatch ? cleanHtml(titleMatch[1]) : '';

        // 提取摘要
        const snippetMatch = match.match(/<a[^>]*class="result__snippet"[^>]*>(.*?)<\/a>/s);
        const snippet = snippetMatch ? cleanHtml(snippetMatch[1]) : '';

        // 提取 URL
        const urlMatch = match.match(/<a[^>]*class="result__url"[^>]*href="([^"]*)"[^>]*>/s);
        let url = urlMatch ? urlMatch[1] : '';

        // 如果没有找到 URL，尝试从其他位置提取
        if (!url) {
          const hrefMatch = match.match(/<a[^>]*href="([^"]*)"[^>]*class="result__a"/s);
          url = hrefMatch ? hrefMatch[1] : '';
        }

        // 解码 DuckDuckGo 的重定向 URL
        if (url.startsWith('//duckduckgo.com/l/')) {
          const encodedMatch = url.match(/uddg=([^&]*)/);
          if (encodedMatch) {
            url = decodeURIComponent(encodedMatch[1]);
          }
        }

        if (title && snippet) {
          results.push({ title, snippet, url });
        }
      } catch (e) {
        // 忽略单个结果解析错误
      }
    }

    return results;
  } catch (err) {
    console.error('[AI] 解析搜索结果失败:', err);
    return results;
  }
}

/**
 * 清理 HTML 标签和实体
 */
function cleanHtml(html: string): string {
  return html
    .replace(/<[^>]+>/g, '') // 移除 HTML 标签
    .replace(/&quot;/g, '"')
    .replace(/&amp;/g, '&')
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>')
    .replace(/&#39;/g, "'")
    .replace(/&nbsp;/g, ' ')
    .replace(/\s+/g, ' ') // 合并多个空格
    .trim();
}

// ===== OpenAI 兼容实现 =====

async function chatOpenAICompatible(
  config: AIProviderConfig,
  messages: AIChatMessage[],
): Promise<string> {
  const client = createOpenAIClient(config);
  const response = await client.chat.completions.create({
    model: config.model,
    messages: messages.map(m => ({ role: m.role, content: m.content })),
    max_tokens: 4096,
  });
  return response.choices[0]?.message?.content || '';
}

async function streamOpenAICompatible(
  config: AIProviderConfig,
  messages: AIChatMessage[],
  onToken: (token: string) => void,
  signal?: AbortSignal,
): Promise<string> {
  const controller = new AbortController();
  currentAbortController = controller;

  // 如果外部 signal 触发，也中止内部 controller
  if (signal) {
    signal.addEventListener('abort', () => controller.abort());
  }

  const client = createOpenAIClient(config);
  let fullText = '';

  try {
    const stream = await client.chat.completions.create({
      model: config.model,
      messages: messages.map(m => ({ role: m.role, content: m.content })),
      max_tokens: 4096,
      stream: true,
    }, { signal: controller.signal });

    for await (const chunk of stream as AsyncIterable<any>) {
      const delta = chunk.choices[0]?.delta?.content;
      if (delta) {
        fullText += delta;
        onToken(delta);
      }
    }
  } finally {
    currentAbortController = null;
  }

  return fullText;
}

// ===== Provider 默认配置 =====

const PROVIDER_DEFAULTS: Record<string, Partial<AIProviderConfig>> = {
  deepseek: {
    baseUrl: 'https://api.deepseek.com',
  },
};

function withProviderDefaults(config: AIProviderConfig): AIProviderConfig {
  const defaults = PROVIDER_DEFAULTS[config.provider];
  if (!defaults) return config;
  return {
    ...config,
    baseUrl: config.baseUrl || defaults.baseUrl,
  };
}

function createOpenAIClient(config: AIProviderConfig): OpenAI {
  return new OpenAI({
    apiKey: config.apiKey,
    baseURL: config.baseUrl || undefined,
  });
}

// ===== Anthropic 实现 =====

async function chatAnthropic(
  config: AIProviderConfig,
  messages: AIChatMessage[],
): Promise<string> {
  const client = new Anthropic({ apiKey: config.apiKey });
  const { system, anthropicMessages } = convertToAnthropicMessages(messages);

  const response = await client.messages.create({
    model: config.model,
    max_tokens: 4096,
    system: system || undefined,
    messages: anthropicMessages,
  });

  return response.content
    .filter((block: any) => block.type === 'text')
    .map((block: any) => block.text)
    .join('');
}

async function streamAnthropic(
  config: AIProviderConfig,
  messages: AIChatMessage[],
  onToken: (token: string) => void,
  signal?: AbortSignal,
): Promise<string> {
  const controller = new AbortController();
  currentAbortController = controller;

  if (signal) {
    signal.addEventListener('abort', () => controller.abort());
  }

  const client = new Anthropic({
    apiKey: config.apiKey,
  });

  const { system, anthropicMessages } = convertToAnthropicMessages(messages);
  let fullText = '';

  try {
    const stream = await client.messages.stream({
      model: config.model,
      max_tokens: 4096,
      system: system || undefined,
      messages: anthropicMessages,
    }, { signal: controller.signal } as any);

    for await (const event of stream as AsyncIterable<any>) {
      if (event.type === 'content_block_delta' && event.delta?.type === 'text_delta') {
        const text = event.delta.text;
        if (text) {
          fullText += text;
          onToken(text);
        }
      }
    }
  } finally {
    currentAbortController = null;
  }

  return fullText;
}

/**
 * 将通用消息格式转换为 Anthropic 格式
 * Anthropic 的 system 是独立参数，不在 messages 中
 * 支持 tool_use / tool_result 内容块
 */
function convertToAnthropicMessages(messages: AIChatMessage[]): {
  system: string;
  anthropicMessages: Array<{ role: 'user' | 'assistant'; content: string | any[] }>;
} {
  let system = '';
  const anthropicMessages: Array<{ role: 'user' | 'assistant'; content: string | any[] }> = [];

  for (const msg of messages as any[]) {
    if (msg.role === 'system') {
      system += (system ? '\n' : '') + msg.content;
    } else if (msg.role === 'user' || msg.role === 'assistant') {
      if (msg.role === 'assistant' && msg.tool_calls && msg.tool_calls.length > 0) {
        const contentBlocks: any[] = [];
        if (msg.content) {
          contentBlocks.push({ type: 'text', text: msg.content });
        }
        for (const tc of msg.tool_calls) {
          contentBlocks.push({
            type: 'tool_use',
            id: tc.id || tc.function?.name,
            name: tc.function?.name || tc.name,
            input: typeof tc.function?.arguments === 'string'
              ? JSON.parse(tc.function.arguments)
              : (tc.function?.arguments || tc.input || {}),
          });
        }
        anthropicMessages.push({ role: 'assistant', content: contentBlocks });
      } else if (msg.role === 'user' && msg.tool_call_id) {
        const existing = anthropicMessages[anthropicMessages.length - 1];
        const toolResultBlock = {
          type: 'tool_result',
          tool_use_id: msg.tool_call_id,
          content: msg.content,
        };
        if (existing && existing.role === 'user' && Array.isArray(existing.content)) {
          existing.content.push(toolResultBlock);
        } else {
          anthropicMessages.push({ role: 'user', content: [toolResultBlock] });
        }
      } else {
        anthropicMessages.push({ role: msg.role, content: msg.content });
      }
    }
  }

  return { system, anthropicMessages };
}

/**
 * 将 OpenAI function calling 格式的工具定义转换为 Anthropic 格式
 * OpenAI: { type: 'function', function: { name, description, parameters } }
 * Anthropic: { name, description, input_schema }
 */
function convertToolsToAnthropicFormat(tools: any[]): any[] {
  return tools.map(tool => {
    if (tool.name && tool.input_schema) {
      return tool;
    }
    const func = tool.function || tool;
    return {
      name: func.name,
      description: func.description || '',
      input_schema: func.parameters || { type: 'object', properties: {} },
    };
  });
}

/**
 * 获取所有工具定义（内置 + MCP）
 */
export function getAllToolDefinitions(): any[] {
  const builtInTools = getToolDefinitions();
  
  // 合并 MCP 工具
  if (mcpBridge) {
    try {
      const mcpTools = mcpBridge.getMCPToolDefinitions();
      if (mcpTools && mcpTools.length > 0) {
        return [...builtInTools, ...mcpTools];
      }
    } catch (err) {
      console.warn('[AI] 获取 MCP 工具定义失败:', (err as any).message);
    }
  }
  
  return builtInTools;
}

// ===== Tool Calling 支持 =====

/** 工具调用记录 */
interface ToolCallRecord {
  name: string;
  args: any;
  result: string;
}

/** 判断 provider 是否支持 tool calling（OpenAI 兼容 API） */
function supportsToolCalling(config: AIProviderConfig): boolean {
  return true;
}

/**
 * 非流式 Tool Calling 对话
 * 支持 OpenAI function calling，自动执行工具并将结果回传
 */
export async function chatWithTools(
  config: AIProviderConfig,
  messages: AIChatMessage[],
  onToken?: (token: string) => void,
  signal?: AbortSignal,
  onToolCall?: (toolName: string, args: any) => void,
): Promise<{ text: string; toolCalls: ToolCallRecord[] }> {
  setAIConfig(config);
  if (config.provider === 'anthropic') {
    return chatWithToolsAnthropic(config, messages, onToken, signal, onToolCall);
  }

  const resolvedConfig = withProviderDefaults(config);
  const client = createOpenAIClient(resolvedConfig);
  const tools = getAllToolDefinitions();
  const allToolCalls: ToolCallRecord[] = [];
  const MAX_TOOL_ROUNDS = 5;

  // 构建工作消息列表（可变副本）- 使用 any 避免类型问题
  const workingMessages: any[] = messages.map(m => ({ role: m.role, content: m.content }));

  for (let round = 0; round < MAX_TOOL_ROUNDS; round++) {
    const response = await client.chat.completions.create({
      model: resolvedConfig.model,
      messages: workingMessages,
      max_tokens: 4096,
      tools: tools.length > 0 ? tools : undefined,
      tool_choice: tools.length > 0 ? 'auto' : undefined,
    }, { signal });

    const choice = response.choices[0];
    const message = choice?.message;

    if (!message) {
      break;
    }

    // 如果没有 tool_calls，直接返回文本
    if (!message.tool_calls || message.tool_calls.length === 0) {
      const text = message.content || '';
      if (onToken && text) {
        onToken(text);
      }
      return { text, toolCalls: allToolCalls };
    }

    // 有 tool_calls：将 assistant 消息（含 tool_calls）加入消息列表
    workingMessages.push({
      role: 'assistant',
      content: message.content || '',
      tool_calls: message.tool_calls.map((tc: any) => ({
        id: tc.id,
        type: 'function',
        function: {
          name: tc.function.name,
          arguments: tc.function.arguments,
        },
      })),
    });

    // 执行每个工具调用
    for (const tc of message.tool_calls as any[]) {
      const toolName = tc.function?.name || '';
      let toolArgs: any;
      try {
        toolArgs = JSON.parse(tc.function?.arguments || '{}');
      } catch {
        toolArgs = {};
      }

      // 通知前端工具调用开始
      if (onToolCall) {
        onToolCall(toolName, toolArgs);
      }

      // 执行工具
      let result: string;
      try {
        // 先尝试 MCP 工具
        if (mcpBridge && mcpBridge.isMCPTool(toolName)) {
          result = await mcpBridge.executeMCPTool(toolName, toolArgs);
        } else {
          result = await executeTool(toolName, toolArgs);
        }
      } catch (err: any) {
        result = `工具执行失败: ${err.message || String(err)}`;
        console.error(`[AI] 工具 ${toolName} 执行失败:`, err);
      }

      allToolCalls.push({ name: toolName, args: toolArgs, result });

      // 将工具结果加入消息列表
      workingMessages.push({
        role: 'tool',
        content: result,
        tool_call_id: tc.id,
      });
    }
  }

  // 超过最大轮次，做最后一次普通调用获取总结回复
  try {
    const finalResponse = await client.chat.completions.create({
      model: resolvedConfig.model,
      messages: workingMessages,
      max_tokens: 4096,
    }, { signal });

    const text = finalResponse.choices[0]?.message?.content || '';
    if (onToken && text) {
      onToken(text);
    }
    return { text, toolCalls: allToolCalls };
  } catch (err: any) {
    return { text: `[工具调用达到最大轮次(${MAX_TOOL_ROUNDS})，且最终回复生成失败: ${err.message}]`, toolCalls: allToolCalls };
  }
}

/**
 * 流式 Tool Calling 对话
 * 先用非流式检测是否需要工具调用，需要时执行工具后用流式生成最终回复
 */
export async function chatStreamWithTools(
  config: AIProviderConfig,
  messages: AIChatMessage[],
  onToken: (token: string) => void,
  signal?: AbortSignal,
  onToolCall?: (toolName: string, args: any, result: string) => void,
): Promise<{ text: string; toolCalls: ToolCallRecord[] }> {
  setAIConfig(config);
  if (config.provider === 'anthropic') {
    return chatStreamWithToolsAnthropic(config, messages, onToken, signal, onToolCall);
  }

  const resolvedConfig = withProviderDefaults(config);
  const tools = getAllToolDefinitions();

  // 如果没有工具定义，直接走普通流式
  if (tools.length === 0) {
    const text = await chatStream(config, messages, onToken, signal);
    return { text, toolCalls: [] };
  }

  const client = createOpenAIClient(resolvedConfig);
  const allToolCalls: ToolCallRecord[] = [];
  const MAX_TOOL_ROUNDS = 5;

  // 构建工作消息列表 - 使用 any 避免类型问题
  const workingMessages: any[] = messages.map(m => ({ 
    role: m.role, 
    content: m.content 
  }));

  // 第一轮：非流式调用，检测是否需要工具调用
  for (let round = 0; round < MAX_TOOL_ROUNDS; round++) {
    let response: any;
    try {
      response = await client.chat.completions.create({
        model: resolvedConfig.model,
        messages: workingMessages,
        max_tokens: 4096,
        tools: tools,
        tool_choice: 'auto',
      }, { signal });
    } catch (err: any) {
      // 如果出错（如模型不支持 tools），回退到普通流式
      console.warn('[AI] Tool calling 检测失败，回退到普通流式:', err.message);
      const text = await chatStream(config, messages, onToken, signal);
      return { text, toolCalls: allToolCalls };
    }

    const choice = response.choices[0];
    const message = choice?.message;

    if (!message) {
      break;
    }

    // 没有工具调用，用流式方式生成回复
    if (!message.tool_calls || message.tool_calls.length === 0) {
      if (round === 0 && message.content) {
        try {
          const streamClient = createOpenAIClient(resolvedConfig);
          const stream = await streamClient.chat.completions.create({
            model: resolvedConfig.model,
            messages: workingMessages,
            max_tokens: 4096,
            stream: true,
          }, { signal });

          let fullText = '';
          for await (const chunk of stream as AsyncIterable<any>) {
            const content = chunk.choices?.[0]?.delta?.content;
            if (content) {
              fullText += content;
              onToken(content);
            }
          }
          return { text: fullText, toolCalls: [] };
        } catch {
          onToken(message.content);
          return { text: message.content, toolCalls: [] };
        }
      }

      // 多轮工具调用后模型不再调用工具，用 workingMessages 流式生成最终回复
      try {
        const client = createOpenAIClient(resolvedConfig);
        const stream = await client.chat.completions.create({
          model: resolvedConfig.model,
          messages: workingMessages,
          max_tokens: 4096,
          stream: true,
        }, { signal });

        let fullText = '';
        for await (const chunk of stream as AsyncIterable<any>) {
          const content = chunk.choices?.[0]?.delta?.content;
          if (content) {
            fullText += content;
            onToken(content);
          }
        }
        return { text: fullText, toolCalls: allToolCalls };
      } catch (err: any) {
        return { text: `[工具调用完成，但最终回复生成失败: ${err.message}]`, toolCalls: allToolCalls };
      }
    }

    // 有工具调用：记录 assistant 消息
    workingMessages.push({
      role: 'assistant',
      content: message.content || '',
      tool_calls: message.tool_calls.map((tc: any) => ({
        id: tc.id,
        type: 'function',
        function: {
          name: tc.function.name,
          arguments: tc.function.arguments,
        },
      })),
    });

    // 执行每个工具调用
    for (const tc of message.tool_calls) {
      const toolName = tc.function.name;
      let toolArgs: any;
      try {
        toolArgs = JSON.parse(tc.function.arguments || '{}');
      } catch {
        toolArgs = {};
      }

      let result: string;
      try {
        // 先尝试 MCP 工具
        if (mcpBridge && mcpBridge.isMCPTool(toolName)) {
          result = await mcpBridge.executeMCPTool(toolName, toolArgs);
        } else {
          result = await executeTool(toolName, toolArgs);
        }
      } catch (err: any) {
        result = `工具执行失败: ${err.message || String(err)}`;
        console.error(`[AI] 工具 ${toolName} 执行失败:`, err);
      }

      allToolCalls.push({ name: toolName, args: toolArgs, result });

      // 通知前端
      if (onToolCall) {
        onToolCall(toolName, toolArgs, result);
      }

      // 将工具结果加入消息列表
      workingMessages.push({
        role: 'tool',
        content: result,
        tool_call_id: tc.id,
      });
    }
  }

  // 工具调用完成后，用流式生成最终回复
  // 直接使用 workingMessages（包含工具调用上下文），用 OpenAI client 做流式调用
  try {
    const client = createOpenAIClient(resolvedConfig);
    const stream = await client.chat.completions.create({
      model: resolvedConfig.model,
      messages: workingMessages,
      max_tokens: 4096,
      stream: true,
    }, { signal });

    let fullText = '';
    for await (const chunk of stream as AsyncIterable<any>) {
      const content = chunk.choices?.[0]?.delta?.content;
      if (content) {
        fullText += content;
        onToken(content);
      }
    }
    return { text: fullText, toolCalls: allToolCalls };
  } catch (err: any) {
    return { text: `[工具调用完成，但最终回复生成失败: ${err.message}]`, toolCalls: allToolCalls };
  }
}

// ===== Anthropic Tool Calling 实现 =====

async function chatWithToolsAnthropic(
  config: AIProviderConfig,
  messages: AIChatMessage[],
  onToken?: (token: string) => void,
  signal?: AbortSignal,
  onToolCall?: (toolName: string, args: any) => void,
): Promise<{ text: string; toolCalls: ToolCallRecord[] }> {
  const client = new Anthropic({ apiKey: config.apiKey });
  const tools = getAllToolDefinitions();
  const allToolCalls: ToolCallRecord[] = [];
  const MAX_TOOL_ROUNDS = 5;

  const { system, anthropicMessages } = convertToAnthropicMessages(messages);
  const anthropicTools = convertToolsToAnthropicFormat(tools);
  const workingMessages: any[] = [...anthropicMessages];

  for (let round = 0; round < MAX_TOOL_ROUNDS; round++) {
    const response = await client.messages.create({
      model: config.model,
      max_tokens: 4096,
      system: system || undefined,
      messages: workingMessages,
      tools: anthropicTools.length > 0 ? anthropicTools : undefined,
    }, { signal } as any);

    const toolUseBlocks = response.content.filter((block: any) => block.type === 'tool_use');
    const textBlocks = response.content.filter((block: any) => block.type === 'text');
    const textContent = textBlocks.map((b: any) => b.text).join('');

    if (toolUseBlocks.length === 0) {
      if (onToken && textContent) onToken(textContent);
      return { text: textContent, toolCalls: allToolCalls };
    }

    workingMessages.push({ role: 'assistant', content: response.content });

    const toolResultBlocks: any[] = [];
    for (const toolBlock of toolUseBlocks as any[]) {
      const toolName = toolBlock.name;
      const toolArgs = toolBlock.input;

      if (onToolCall) onToolCall(toolName, toolArgs);

      let result: string;
      try {
        if (mcpBridge && mcpBridge.isMCPTool(toolName)) {
          result = await mcpBridge.executeMCPTool(toolName, toolArgs);
        } else {
          result = await executeTool(toolName, toolArgs);
        }
      } catch (err: any) {
        result = `工具执行失败: ${err.message || String(err)}`;
        console.error(`[AI] 工具 ${toolName} 执行失败:`, err);
      }

      allToolCalls.push({ name: toolName, args: toolArgs, result });
      toolResultBlocks.push({
        type: 'tool_result',
        tool_use_id: toolBlock.id,
        content: result,
      });
    }

    workingMessages.push({ role: 'user', content: toolResultBlocks });
  }

  try {
    const finalResponse = await client.messages.create({
      model: config.model,
      max_tokens: 4096,
      system: system || undefined,
      messages: workingMessages,
    }, { signal } as any);

    const text = finalResponse.content
      .filter((block: any) => block.type === 'text')
      .map((block: any) => block.text)
      .join('');
    if (onToken && text) onToken(text);
    return { text, toolCalls: allToolCalls };
  } catch (err: any) {
    return { text: `[工具调用达到最大轮次(${MAX_TOOL_ROUNDS})，且最终回复生成失败: ${err.message}]`, toolCalls: allToolCalls };
  }
}

async function chatStreamWithToolsAnthropic(
  config: AIProviderConfig,
  messages: AIChatMessage[],
  onToken: (token: string) => void,
  signal?: AbortSignal,
  onToolCall?: (toolName: string, args: any, result: string) => void,
): Promise<{ text: string; toolCalls: ToolCallRecord[] }> {
  const client = new Anthropic({ apiKey: config.apiKey });
  const tools = getAllToolDefinitions();

  if (tools.length === 0) {
    const text = await chatStream(config, messages, onToken, signal);
    return { text, toolCalls: [] };
  }

  const allToolCalls: ToolCallRecord[] = [];
  const MAX_TOOL_ROUNDS = 5;

  const { system, anthropicMessages } = convertToAnthropicMessages(messages);
  const anthropicTools = convertToolsToAnthropicFormat(tools);
  const workingMessages: any[] = [...anthropicMessages];

  for (let round = 0; round < MAX_TOOL_ROUNDS; round++) {
    let response: any;
    try {
      response = await client.messages.create({
        model: config.model,
        max_tokens: 4096,
        system: system || undefined,
        messages: workingMessages,
        tools: anthropicTools,
      }, { signal } as any);
    } catch (err: any) {
      console.warn('[AI] Anthropic tool calling 检测失败，回退到普通流式:', err.message);
      const text = await chatStream(config, messages, onToken, signal);
      return { text, toolCalls: allToolCalls };
    }

    const toolUseBlocks = response.content.filter((block: any) => block.type === 'tool_use');
    const textBlocks = response.content.filter((block: any) => block.type === 'text');
    const textContent = textBlocks.map((b: any) => b.text).join('');

    if (toolUseBlocks.length === 0) {
      if (round === 0 && textContent) {
        onToken(textContent);
        return { text: textContent, toolCalls: [] };
      }
      const streamText = await streamAnthropicFinal(config, system, workingMessages, onToken, signal);
      return { text: streamText, toolCalls: allToolCalls };
    }

    workingMessages.push({ role: 'assistant', content: response.content });

    const toolResultBlocks: any[] = [];
    for (const toolBlock of toolUseBlocks as any[]) {
      const toolName = toolBlock.name;
      const toolArgs = toolBlock.input;

      let result: string;
      try {
        if (mcpBridge && mcpBridge.isMCPTool(toolName)) {
          result = await mcpBridge.executeMCPTool(toolName, toolArgs);
        } else {
          result = await executeTool(toolName, toolArgs);
        }
      } catch (err: any) {
        result = `工具执行失败: ${err.message || String(err)}`;
        console.error(`[AI] 工具 ${toolName} 执行失败:`, err);
      }

      allToolCalls.push({ name: toolName, args: toolArgs, result });
      if (onToolCall) onToolCall(toolName, toolArgs, result);

      toolResultBlocks.push({
        type: 'tool_result',
        tool_use_id: toolBlock.id,
        content: result,
      });
    }

    workingMessages.push({ role: 'user', content: toolResultBlocks });
  }

  const streamText = await streamAnthropicFinal(config, system, workingMessages, onToken, signal);
  return { text: streamText, toolCalls: allToolCalls };
}

async function streamAnthropicFinal(
  config: AIProviderConfig,
  system: string,
  anthropicMessages: any[],
  onToken: (token: string) => void,
  signal?: AbortSignal,
): Promise<string> {
  const controller = new AbortController();
  currentAbortController = controller;
  if (signal) signal.addEventListener('abort', () => controller.abort());

  const client = new Anthropic({ apiKey: config.apiKey });
  let fullText = '';

  try {
    const stream = await client.messages.stream({
      model: config.model,
      max_tokens: 4096,
      system: system || undefined,
      messages: anthropicMessages,
    }, { signal: controller.signal } as any);

    for await (const event of stream as AsyncIterable<any>) {
      if (event.type === 'content_block_delta' && event.delta?.type === 'text_delta') {
        const text = event.delta.text;
        if (text) {
          fullText += text;
          onToken(text);
        }
      }
    }
  } finally {
    currentAbortController = null;
  }

  return fullText;
}
