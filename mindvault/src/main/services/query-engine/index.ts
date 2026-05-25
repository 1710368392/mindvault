/**
 * Query Engine - 入口文件
 * 
 * 导出所有模块，提供统一的 API 入口
 * 基于 Claude Code 源码完整实现
 */

// Core
export { QueryEngine } from './QueryEngine';
export type {
  QueryEngineConfig,
  Message,
  CompactMetadata,
  ThinkingConfig,
  AppState,
  ToolPermissionContext,
  CanUseToolFn,
  ToolUseContext,
  ElicitationRequest,
  ElicitationResult,
  Usage,
  StreamEvent,
  RequestStartEvent,
  ToolCallEvent,
  ToolResultEvent,
  CompactEvent,
  PermissionRequestEvent,
  PermissionDecisionEvent,
} from './QueryEngine';

// Tool
export { Tool, buildTool, ToolRegistry, createBuiltinTools } from './Tool';
export type {
  ToolPermission,
  ToolInputSchema,
  ToolExecutionContext,
  ValidationResult,
} from './Tool';

// Tool Registry
export { createFullToolRegistry, getAllTools, getToolRegistry, executeTool } from './tool-registry';

// Permissions
export { yoloClassify, checkToolPermission } from './permissions/yolo-classifier';
export type {
  PermissionMode,
  PermissionBehavior,
  PermissionResult,
  YoloClassifierResult,
  AutoModeRules,
} from './permissions/types';

// Side Query
export {
  sideQuery,
  explainPermission,
  reviewPermission,
  searchSessions,
  analyzeContext,
} from './side-query';

// Compact
export {
  compactConversation,
  snipMessages,
  microCompactMessages,
  collapseMessages,
  autoCompact,
  reactiveCompact,
  shouldAutoCompact,
  shouldReactiveCompact,
  estimateTokens,
  estimateTotalTokens,
  analyzeContext as analyzeTokenContext,
} from './compact/compact';
export type {
  CompactResult,
  CompactOptions,
  CompactBoundary,
  TokenStats,
} from './compact/compact';

// Memory
export {
  MemoryManager,
  agenticMemorySearch,
  extractMemoriesFromConversation,
  formatMemoriesForPrompt,
} from './memory/memory-search';
export type {
  Memory,
  MemorySearchResult,
  MemoryStore,
  MemorySearchOptions,
} from './memory/memory-search';

// ============================================================================
// Convenience Functions
// ============================================================================

import { QueryEngine } from './QueryEngine';
import { createFullToolRegistry } from './tool-registry';
import type { QueryEngineConfig } from './QueryEngine';

/**
 * 创建默认配置的 QueryEngine
 */
export function createQueryEngine(
  partialConfig: Partial<QueryEngineConfig>
): QueryEngine {
  const toolRegistry = createFullToolRegistry();

  const defaultConfig: Partial<QueryEngineConfig> = {
    tools: toolRegistry.getAll(),
    maxTurns: 20,
    maxContextTokens: 200000,
    permissionMode: 'default',
    getAppState: () => ({
      toolPermissionContext: {
        mode: 'default',
        additionalWorkingDirectories: new Map(),
        alwaysAllowRules: {},
        alwaysDenyRules: {},
        alwaysAskRules: {},
        isBypassPermissionsModeAvailable: false,
      },
      fastMode: false,
      fileHistory: { snapshots: new Map() },
      attribution: { sources: new Map() },
    }),
    setAppState: () => {},
  };

  return new QueryEngine({
    ...defaultConfig,
    ...partialConfig,
  } as QueryEngineConfig);
}

export default QueryEngine;
