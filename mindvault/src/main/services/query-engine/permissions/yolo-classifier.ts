/**
 * YOLO Classifier - 权限分类器
 * 
 * 基于 Claude Code 的 YOLO (You Only Look Once) 分类器
 * 将工具调用分为 auto-allow / ask / hard-deny 三类
 */

import type { Tool } from '../Tool';
import type { YoloClassifierResult, AutoModeRules } from './types';

// ============================================================================
// Constants
// ============================================================================

/** 自动允许的工具（只读、安全） */
const AUTO_ALLOW_TOOLS = [
  'get_current_time',
  'calculate',
  'search_creativity',
  'get_creativity_detail',
  'list_creativities',
  'get_random_creativity',
  'get_creativity_stats',
  'list_boards',
  'get_board_overview',
  'search_tags',
  'get_popular_tags',
  'list_tags',
  'search_templates',
  'global_search',
  'search_by_date_range',
  'get_app_stats',
  'get_recent_edits',
  'get_weather',
  'get_weather_forecast',
  'get_music_status',
  'search_music',
  'get_current_context',
  'read_file',
  'list_directory',
];

/** 需要确认的工具（写入、修改） */
const ASK_TOOLS = [
  'create_creativity',
  'update_creativity',
  'delete_creativity',
  'tag_creativity',
  'link_creativities',
  'toggle_favorite',
  'create_board',
  'update_board',
  'delete_board',
  'add_to_board',
  'remove_from_board',
  'create_tag',
  'update_tag',
  'delete_tag',
  'apply_template',
  'control_music',
  'update_settings',
  'execute_code',
];

/** 硬拒绝的工具（危险操作） */
const HARD_DENY_TOOLS = [
  'permanent_delete_creativity',
  'batch_delete_creativities',
  'clear_trash',
];

/** 危险关键词（输入中包含这些词需要额外确认） */
const DANGEROUS_PATTERNS = [
  /delete\s+all/i,
  /drop\s+table/i,
  /truncate/i,
  /rm\s+-rf/i,
  /format\s+disk/i,
  /sudo/i,
  /chmod\s+777/i,
  /eval\s*\(/i,
  /Function\s*\(/i,
  /exec\s*\(/i,
];

// ============================================================================
// YOLO Classifier
// ============================================================================

/**
 * YOLO 分类器 - 快速判断工具调用权限
 * 
 * 分类逻辑：
 * 1. 硬拒绝列表 -> hard-deny
 * 2. 自动允许列表 + 只读 -> auto-allow
 * 3. 需确认列表 -> ask
 * 4. 未知工具 -> ask（保守策略）
 * 5. 危险模式检测 -> ask（即使工具本身是安全的）
 */
export async function yoloClassify(
  tool: Tool,
  input: Record<string, any>,
  rules?: AutoModeRules
): Promise<YoloClassifierResult> {
  const toolName = tool.name;

  // 1. 检查硬拒绝列表
  if (HARD_DENY_TOOLS.includes(toolName)) {
    return {
      decision: 'deny',
      reason: `工具 "${toolName}" 是危险操作，需要管理员权限`,
      confidence: 1.0,
    };
  }

  // 2. 检查用户自定义规则
  if (rules) {
    // 检查 allow 规则
    if (rules.allow.some(rule => matchesRule(toolName, input, rule))) {
      return {
        decision: 'allow',
        reason: `匹配用户允许规则: ${rules.allow.find(r => matchesRule(toolName, input, r))}`,
        confidence: 0.9,
      };
    }

    // 检查 soft_deny 规则
    if (rules.soft_deny.some(rule => matchesRule(toolName, input, rule))) {
      return {
        decision: 'ask',
        reason: `匹配用户拒绝规则，需要确认`,
        confidence: 0.9,
      };
    }
  }

  // 3. 检查自动允许列表
  if (AUTO_ALLOW_TOOLS.includes(toolName) && tool.readOnly) {
    // 仍然需要检查危险模式
    const dangerousPattern = detectDangerousPattern(input);
    if (dangerousPattern) {
      return {
        decision: 'ask',
        reason: `检测到潜在危险模式: ${dangerousPattern}`,
        confidence: 0.7,
      };
    }

    return {
      decision: 'allow',
      reason: `工具 "${toolName}" 是只读操作，自动允许`,
      confidence: 0.95,
    };
  }

  // 4. 检查需确认列表
  if (ASK_TOOLS.includes(toolName)) {
    return {
      decision: 'ask',
      reason: `工具 "${toolName}" 会修改数据，需要用户确认`,
      confidence: 0.9,
    };
  }

  // 5. 未知工具，保守策略
  return {
    decision: 'ask',
    reason: `未知工具 "${toolName}"，需要用户确认`,
    confidence: 0.5,
  };
}

/**
 * 检查输入中是否包含危险模式
 */
function detectDangerousPattern(input: Record<string, any>): string | null {
  const inputStr = JSON.stringify(input);
  
  for (const pattern of DANGEROUS_PATTERNS) {
    const match = inputStr.match(pattern);
    if (match) {
      return match[0];
    }
  }
  
  return null;
}

/**
 * 检查工具调用是否匹配规则
 */
function matchesRule(
  toolName: string,
  input: Record<string, any>,
  rule: string
): boolean {
  // 简单匹配：规则是工具名
  if (rule === toolName) {
    return true;
  }

  // 通配符匹配
  if (rule.includes('*')) {
    const regex = new RegExp('^' + rule.replace(/\*/g, '.*') + '$');
    return regex.test(toolName);
  }

  // 输入参数匹配
  if (rule.includes(':')) {
    const [key, value] = rule.split(':');
    if (input[key] === value) {
      return true;
    }
  }

  return false;
}

// ============================================================================
// Permission Checker
// ============================================================================

/**
 * 权限检查器 - 综合判断工具调用权限
 */
export async function checkToolPermission(
  tool: Tool,
  input: Record<string, any>,
  context: {
    mode: 'default' | 'auto' | 'bypass';
    rules?: AutoModeRules;
    recentDecisions?: Map<string, 'allow' | 'deny'>;
  }
): Promise<{
  allowed: boolean;
  reason: string;
  needsConfirmation: boolean;
}> {
  // bypass 模式：允许所有操作
  if (context.mode === 'bypass') {
    return {
      allowed: true,
      reason: 'bypass 模式，自动允许',
      needsConfirmation: false,
    };
  }

  // 使用 YOLO 分类器
  const result = await yoloClassify(tool, input, context.rules);

  // auto 模式：根据分类结果决定
  if (context.mode === 'auto') {
    if (result.decision === 'allow') {
      return {
        allowed: true,
        reason: result.reason,
        needsConfirmation: false,
      };
    } else if (result.decision === 'deny') {
      return {
        allowed: false,
        reason: result.reason,
        needsConfirmation: false,
      };
    }
    // ask 仍然需要确认
    return {
      allowed: true,
      reason: result.reason,
      needsConfirmation: true,
    };
  }

  // default 模式：所有非只读操作都需要确认
  if (tool.readOnly) {
    return {
      allowed: true,
      reason: '只读操作，自动允许',
      needsConfirmation: false,
    };
  }

  return {
    allowed: true,
    reason: result.reason,
    needsConfirmation: true,
  };
}

export default yoloClassify;
