/**
 * Permission Types - 权限系统类型定义
 */

export type PermissionMode = 'default' | 'auto' | 'bypass' | 'plan';

export type PermissionBehavior = 'allow' | 'deny' | 'ask';

export interface PermissionResult {
  behavior: PermissionBehavior;
  reason?: string;
  updatedInput?: Record<string, any>;
}

export interface YoloClassifierResult {
  decision: 'allow' | 'deny' | 'ask';
  reason: string;
  confidence: number;
}

export interface AutoModeRules {
  allow: string[];
  soft_deny: string[];
  environment: string[];
}

export interface ToolPermissionContext {
  mode: PermissionMode;
  additionalWorkingDirectories: Map<string, any>;
  alwaysAllowRules: Record<string, string[]>;
  alwaysDenyRules: Record<string, string[]>;
  alwaysAskRules: Record<string, string[]>;
  isBypassPermissionsModeAvailable: boolean;
  isAutoModeAvailable?: boolean;
  strippedDangerousRules?: Record<string, string[]>;
  shouldAvoidPermissionPrompts?: boolean;
  awaitAutomatedChecksBeforeDialog?: boolean;
  prePlanMode?: PermissionMode;
}
