// @ts-nocheck
/**
 * Agent 相关类型定义
 */

/** Agent 任务步骤状态 */
export type AgentStepStatus = 'pending' | 'running' | 'completed' | 'failed' | 'skipped';

/** Agent 任务状态 */
export type AgentTaskStatus = 'planning' | 'executing' | 'reflecting' | 'completed' | 'failed' | 'cancelled';

/** Agent 任务步骤 */
export interface AgentTaskStep {
  id: string;
  index: number;
  goal: string;
  toolName?: string;
  toolArgs?: Record<string, any>;
  expectedResult?: string;
  status: AgentStepStatus;
  result?: string;
  error?: string;
  startedAt?: number;
  completedAt?: number;
  retryCount: number;
}

/** Agent 任务 */
export interface AgentTask {
  id: string;
  userInstruction: string;
  steps: AgentTaskStep[];
  status: AgentTaskStatus;
  currentStepIndex: number;
  createdAt: number;
  updatedAt: number;
  finalResult?: string;
  error?: string;
}

/** Agent 工作流定义 */
export interface AgentWorkflow {
  id: string;
  name: string;
  description: string;
  triggerKeywords: string[];
  steps: Array<{
    goal: string;
    toolName?: string;
    toolArgs?: Record<string, any>;
    expectedResult?: string;
  }>;
}

/** Agent 执行回调 */
export interface AgentCallbacks {
  onStepStart?: (step: AgentTaskStep) => void;
  onStepComplete?: (step: AgentTaskStep) => void;
  onStepError?: (step: AgentTaskStep, error: string) => void;
  onTaskComplete?: (task: AgentTask) => void;
  onTaskError?: (task: AgentTask, error: string) => void;
  onToken?: (token: string) => void;
}

/** Agent 规划结果 */
export interface AgentPlan {
  steps: Array<{
    goal: string;
    toolName?: string;
    toolArgs?: Record<string, any>;
    expectedResult?: string;
  }>;
  reasoning: string;
}
