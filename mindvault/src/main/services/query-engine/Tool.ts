/**
 * Tool - 工具定义接口
 * 
 * 基于 Claude Code 架构，支持权限声明、参数校验、结果格式化
 */

import type { z } from 'zod';

// ============================================================================
// Types
// ============================================================================

export type ToolPermission = 'read' | 'write' | 'dangerous';

export interface ToolInputSchema {
  type: 'object';
  properties?: Record<string, {
    type: string;
    description?: string;
    enum?: string[];
    default?: any;
  }>;
  required?: string[];
}

export interface Tool<TInput = any, TOutput = any> {
  /** 工具名称（唯一标识） */
  name: string;
  
  /** 工具描述（AI 会看到这个描述） */
  description: string;
  
  /** 输入参数 JSON Schema */
  inputSchema: ToolInputSchema;
  
  /** 权限级别 */
  permission: ToolPermission;
  
  /** 是否为只读工具（不修改数据） */
  readOnly?: boolean;
  
  /** 最大结果字符数（用于压缩） */
  maxResultSizeChars?: number;
  
  /** 执行工具 */
  execute: (input: TInput, context?: ToolExecutionContext) => Promise<TOutput>;
  
  /** 验证输入（可选） */
  validate?: (input: TInput) => ValidationResult;
  
  /** 格式化结果（可选） */
  formatResult?: (result: TOutput) => string;
}

export interface ToolExecutionContext {
  /** 当前工作目录 */
  cwd: string;
  
  /** 用户 ID */
  userId?: string;
  
  /** 请求 ID */
  requestId?: string;
  
  /** 中止信号 */
  signal?: AbortSignal;
  
  /** 额外上下文 */
  [key: string]: any;
}

export interface ValidationResult {
  success: boolean;
  errors?: Array<{
    path: string;
    message: string;
  }>;
}

// ============================================================================
// Tool Builder
// ============================================================================

/**
 * buildTool - 工厂函数，用于创建标准化的工具定义
 * 
 * 示例:
 * ```ts
 * const searchTool = buildTool({
 *   name: 'search_creativity',
 *   description: '搜索创意',
 *   permission: 'read',
 *   inputSchema: {
 *     type: 'object',
 *     properties: {
 *       keyword: { type: 'string', description: '搜索关键词' },
 *       limit: { type: 'number', description: '返回数量', default: 10 },
 *     },
 *     required: ['keyword'],
 *   },
 *   execute: async (input) => {
 *     // 实现搜索逻辑
 *     return results;
 *   },
 * });
 * ```
 */
export function buildTool<TInput = any, TOutput = any>(config: {
  name: string;
  description: string;
  permission: ToolPermission;
  inputSchema: ToolInputSchema;
  readOnly?: boolean;
  maxResultSizeChars?: number;
  execute: (input: TInput, context?: ToolExecutionContext) => Promise<TOutput>;
  validate?: (input: TInput) => ValidationResult;
  formatResult?: (result: TOutput) => string;
}): Tool<TInput, TOutput> {
  return {
    name: config.name,
    description: config.description,
    permission: config.permission,
    inputSchema: config.inputSchema,
    readOnly: config.readOnly ?? (config.permission === 'read'),
    maxResultSizeChars: config.maxResultSizeChars,
    execute: config.execute,
    validate: config.validate,
    formatResult: config.formatResult,
  };
}

// ============================================================================
// Tool Registry
// ============================================================================

/**
 * ToolRegistry - 工具注册表
 * 管理所有可用工具，支持按名称查找、按权限过滤
 */
export class ToolRegistry {
  private tools: Map<string, Tool> = new Map();

  /**
   * 注册工具
   */
  register(tool: Tool): void {
    if (this.tools.has(tool.name)) {
      console.warn(`Tool "${tool.name}" is already registered. Overwriting.`);
    }
    this.tools.set(tool.name, tool);
  }

  /**
   * 批量注册工具
   */
  registerAll(tools: Tool[]): void {
    for (const tool of tools) {
      this.register(tool);
    }
  }

  /**
   * 获取工具
   */
  get(name: string): Tool | undefined {
    return this.tools.get(name);
  }

  /**
   * 获取所有工具
   */
  getAll(): Tool[] {
    return Array.from(this.tools.values());
  }

  /**
   * 按权限过滤工具
   */
  getByPermission(permission: ToolPermission): Tool[] {
    return this.getAll().filter(t => t.permission === permission);
  }

  /**
   * 获取只读工具
   */
  getReadOnlyTools(): Tool[] {
    return this.getAll().filter(t => t.readOnly);
  }

  /**
   * 获取危险工具
   */
  getDangerousTools(): Tool[] {
    return this.getAll().filter(t => t.permission === 'dangerous');
  }

  /**
   * 转换为 OpenAI function calling 格式
   */
  toOpenAIFormat(): Array<{
    type: 'function';
    function: {
      name: string;
      description: string;
      parameters: ToolInputSchema;
    };
  }> {
    return this.getAll().map(tool => ({
      type: 'function' as const,
      function: {
        name: tool.name,
        description: tool.description,
        parameters: tool.inputSchema,
      },
    }));
  }

  /**
   * 转换为 Anthropic tool use 格式
   */
  toAnthropicFormat(): Array<{
    name: string;
    description: string;
    input_schema: ToolInputSchema;
  }> {
    return this.getAll().map(tool => ({
      name: tool.name,
      description: tool.description,
      input_schema: tool.inputSchema,
    }));
  }
}

// ============================================================================
// Built-in Tools
// ============================================================================

/**
 * 创建内置工具集合
 */
export function createBuiltinTools(): Tool[] {
  return [
    // 时间工具
    buildTool({
      name: 'get_current_time',
      description: '获取当前时间',
      permission: 'read',
      inputSchema: {
        type: 'object',
        properties: {
          timezone: { type: 'string', description: '时区，如 Asia/Shanghai' },
        },
      },
      execute: async (input) => {
        const tz = input.timezone || 'Asia/Shanghai';
        return new Date().toLocaleString('zh-CN', { timeZone: tz });
      },
    }),

    // 计算器工具
    buildTool({
      name: 'calculate',
      description: '执行数学计算',
      permission: 'read',
      inputSchema: {
        type: 'object',
        properties: {
          expression: { type: 'string', description: '数学表达式' },
        },
        required: ['expression'],
      },
      execute: async (input) => {
        try {
          // 安全计算（仅允许数学运算）
          const sanitized = input.expression.replace(/[^0-9+\-*/().%\s]/g, '');
          const result = Function(`"use strict"; return (${sanitized})`)();
          return { result, expression: input.expression };
        } catch (error) {
          return { error: `计算错误: ${error}` };
        }
      },
    }),
  ];
}

export default Tool;
