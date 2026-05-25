// @ts-nocheck
/**
 * Agent 任务执行器 v2
 * 支持思考过程可视化、阶段化执行、并行子任务
 */

const { chat, chatStream, chatWithTools } = require('./ai-service');
const { executeTool } = require('./tool-executor');
const { planTaskWithThinking, replanTask, getAvailableToolsDescription } = require('./agent-planner');

let mcpBridge: any = null;
try {
  mcpBridge = require('./mcp-bridge').mcpBridge;
} catch (e) { /* MCP not available */ }

/** 当前活跃的任务（支持取消） */
let currentTaskId: string | null = null;
let currentAbortController: AbortController | null = null;

/** 步骤执行超时时间（毫秒） */
const STEP_TIMEOUT = 120000; // 120秒超时
/** 最大重新规划次数 */
const MAX_REPLAN_COUNT = 2;

/**
 * 取消当前任务
 */
function cancelCurrentTask() {
  if (currentAbortController) {
    currentAbortController.abort();
    currentAbortController = null;
  }
  currentTaskId = null;
}

/**
 * 执行单个步骤（支持思考过程）
 */
async function executeStep(step: any, config: any, callbacks?: any): Promise<{ success: boolean; result: string }> {
  if (!step.toolName) {
    try {
      const messages = [
        { role: 'system', content: '你是一个任务执行助手。请根据步骤目标，给出简洁有用的回复。如果需要思考，先在<thinking>标签中写出思考过程。你可以使用工具来辅助完成任务。' },
        { role: 'user', content: `请执行以下步骤：${step.goal}` },
      ];

      const result = await chatWithTools(
        config,
        messages,
        (token) => {
          if (callbacks?.onStepThinking) callbacks.onStepThinking(step.id, token);
        },
        currentAbortController?.signal,
      );
      return { success: true, result: result.text };
    } catch (err: any) {
      return { success: false, result: `执行失败: ${err.message}` };
    }
  }

  // 有指定工具，执行工具调用
  try {
    let result: string;
    if (mcpBridge && mcpBridge.isMCPTool(step.toolName)) {
      result = await mcpBridge.executeMCPTool(step.toolName, step.toolArgs || {});
    } else {
      result = await executeTool(step.toolName, step.toolArgs || {});
    }
    return { success: true, result };
  } catch (err: any) {
    return { success: false, result: `工具执行失败: ${err.message}` };
  }
}

/**
 * 反思步骤结果
 */
async function reflectStep(step: any, result: string, config: any): Promise<{ shouldRetry: boolean; feedback: string }> {
  try {
    const messages = [
      { role: 'system', content: '你是一个任务审查助手。请判断步骤执行结果是否符合预期目标。如果不符合，给出简短的改进建议。只返回 JSON 格式：{"shouldRetry": true/false, "feedback": "反馈说明"}' },
      { role: 'user', content: `步骤目标: ${step.goal}\n预期结果: ${step.expectedResult || '无特定预期'}\n实际结果: ${result}\n\n请判断结果是否符合预期。` },
    ];
    const response = await chat(config, messages);

    const jsonMatch = response.match(/\{[\s\S]*\}/);
    if (jsonMatch) {
      const reflection = JSON.parse(jsonMatch[0]);
      return {
        shouldRetry: reflection.shouldRetry === true,
        feedback: reflection.feedback || '',
      };
    }
    return { shouldRetry: false, feedback: '反思结果解析失败，默认通过' };
  } catch (err: any) {
    return { shouldRetry: false, feedback: `反思失败: ${err.message}` };
  }
}

/**
 * 并行执行多个步骤
 */
async function executeParallelSteps(steps: any[], config: any, callbacks?: any): Promise<Map<string, any>> {
  const results = new Map();

  const promises = steps.map(async (step) => {
    step.status = 'running';
    step.startedAt = Date.now();
    if (callbacks?.onStepStart) callbacks.onStepStart(step);

    const MAX_RETRIES = 3;
    let execResult: any = null;

    for (let retry = 0; retry <= MAX_RETRIES; retry++) {
      if (currentAbortController?.signal.aborted) break;

      execResult = await executeStep(step, config, callbacks);
      step.retryCount = retry;

      if (execResult.success) {
        if (step.expectedResult && retry < MAX_RETRIES) {
          const reflection = await reflectStep(step, execResult.result, config);
          if (reflection.shouldRetry) continue;
        }
        break;
      }
    }

    step.completedAt = Date.now();
    if (currentAbortController?.signal.aborted) {
      step.status = 'skipped';
    } else if (execResult?.success) {
      step.status = 'completed';
      step.result = execResult.result;
      if (callbacks?.onStepComplete) callbacks.onStepComplete(step);
    } else {
      step.status = 'failed';
      step.error = execResult?.result || '执行失败';
      step.result = execResult?.result;
      if (callbacks?.onStepError) callbacks.onStepError(step, step.error);
    }
    results.set(step.id, execResult);
  });

  await Promise.all(promises);
  return results;
}

/**
 * 执行单个步骤（带重试、反思、超时和重新规划）
 */
async function executeSingleStep(
  step: any,
  config: any,
  callbacks?: any,
  replanContext?: {
    instruction: string;
    completedResults: string[];
    task: any;
    replanCount: { value: number };
  }
): Promise<{ replanned: boolean; newPlan: any }> {
  step.status = 'running';
  step.startedAt = Date.now();
  if (callbacks?.onStepStart) callbacks.onStepStart(step);

  const MAX_RETRIES = 3;
  let execResult: any = null;
  let replanned = false;
  let newPlan: any = null;

  for (let retry = 0; retry <= MAX_RETRIES; retry++) {
    if (currentAbortController?.signal.aborted) break;

    // 带超时控制的步骤执行
    const execPromise = executeStep(step, config, callbacks);
    const timeoutPromise = new Promise<never>((_, reject) =>
      setTimeout(() => reject(new Error('步骤执行超时(120s)')), STEP_TIMEOUT)
    );

    try {
      execResult = await Promise.race([execPromise, timeoutPromise]);
    } catch (err: any) {
      execResult = { success: false, result: err.message };
    }

    step.retryCount = retry;

    if (execResult.success) {
      if (step.expectedResult && retry < MAX_RETRIES) {
        const reflection = await reflectStep(step, execResult.result, config);
        if (reflection.shouldRetry) continue;
      }
      break;
    } else {
      // 步骤执行失败
      callbacks?.onStepError?.(step, execResult.result || '执行失败');

      // 如果已经重试多次且还有重新规划次数，触发重新规划
      if (retry >= 2 && replanContext && replanContext.replanCount.value < MAX_REPLAN_COUNT) {
        replanContext.replanCount.value++;
        const rc = replanContext.replanCount.value;
        callbacks?.onStatusChange?.('planning');
        callbacks?.onThinkingToken?.(`\n[重新规划 第${rc}次] 上一步骤失败，正在调整执行计划...\n`);

        try {
          const context = `原始任务: ${replanContext.instruction}\n已完成步骤的结果: ${replanContext.completedResults.join('\n')}\n当前失败的步骤: ${step.goal}\n失败原因: ${execResult.result}\n请重新规划剩余的执行步骤。`;
          const toolsDesc = getAvailableToolsDescription();
          newPlan = await replanTask(context, config, toolsDesc);

          if (newPlan && newPlan.steps.length > 0) {
            // 替换当前步骤及后续步骤
            const currentIdx = replanContext.task.steps.findIndex((s: any) => s.id === step.id);
            if (currentIdx >= 0) {
              replanContext.task.steps.splice(currentIdx, 1, ...newPlan.steps.map((s: any, i: number) => ({
                ...s,
                index: currentIdx + i,
                status: 'pending',
                retryCount: 0,
              })));
              callbacks?.onThinkingToken?.(`\n[新计划] ${newPlan.summary}\n`);
              callbacks?.onStatusChange?.('executing');
              replanned = true;
              break; // 跳出重试循环，使用新计划
            }
          }
        } catch (err: any) {
          console.error('[Agent] 重新规划失败:', err);
        }
      }
    }
  }

  step.completedAt = Date.now();
  if (currentAbortController?.signal.aborted) {
    step.status = 'skipped';
  } else if (execResult?.success) {
    step.status = 'completed';
    step.result = execResult.result;
    if (callbacks?.onStepComplete) callbacks.onStepComplete(step);
  } else {
    step.status = 'failed';
    step.error = execResult?.result || '执行失败';
    step.result = execResult?.result;
    if (callbacks?.onStepError) callbacks.onStepError(step, step.error);
  }

  return { replanned, newPlan };
}

/**
 * 执行完整的 Agent 任务（v2：思考过程 + 阶段化 + 并行）
 */
async function executeAgentTask(instruction: string, config: any, callbacks?: any): Promise<any> {
  const taskId = `task_${Date.now()}`;
  currentTaskId = taskId;
  currentAbortController = new AbortController();

  const task: any = {
    id: taskId,
    userInstruction: instruction,
    summary: '',
    thinking: '',
    phases: [],
    steps: [],
    status: 'thinking',  // thinking -> planning -> executing -> reflecting -> completed
    currentPhaseIndex: -1,
    currentStepIndex: -1,
    createdAt: Date.now(),
    updatedAt: Date.now(),
  };

  try {
    // ===== 阶段1：思考 + 规划（流式输出思考过程） =====
    task.status = 'thinking';
    if (callbacks?.onStatusChange) callbacks.onStatusChange('thinking');

    const plan = await planTaskWithThinking(instruction, config, {
      onThinkingToken: (token: string) => {
        task.thinking += token;
        if (callbacks?.onThinkingToken) callbacks.onThinkingToken(token);
      },
      onThinkingEnd: (fullThinking: string) => {
        task.thinking = fullThinking;
        if (callbacks?.onThinkingEnd) callbacks.onThinkingEnd(fullThinking);
      },
      signal: currentAbortController.signal,
    });

    task.summary = plan.summary || '';
    task.phases = plan.phases || [];
    task.steps = plan.steps || [];
    task.status = 'planning';
    if (callbacks?.onStatusChange) callbacks.onStatusChange('planning');
    if (callbacks?.onPlanReady) callbacks.onPlanReady(plan);

    // ===== 阶段2：按阶段逐步执行 =====
    task.status = 'executing';
    if (callbacks?.onStatusChange) callbacks.onStatusChange('executing');

    // 重新规划上下文
    const replanCount = { value: 0 };

    for (let pIdx = 0; pIdx < task.phases.length; pIdx++) {
      if (currentAbortController.signal.aborted) {
        task.status = 'cancelled';
        break;
      }

      const phase = task.phases[pIdx];
      phase.status = 'running';
      task.currentPhaseIndex = pIdx;
      task.updatedAt = Date.now();
      if (callbacks?.onPhaseStart) callbacks.onPhaseStart(phase, pIdx);

      const phaseSteps = phase.steps || [];

      // 找出可以并行执行的步骤组
      let i = 0;
      while (i < phaseSteps.length) {
        if (currentAbortController.signal.aborted) break;

        // 收集连续的 canParallel 步骤
        const parallelGroup: any[] = [];
        while (i < phaseSteps.length && phaseSteps[i].canParallel) {
          parallelGroup.push(phaseSteps[i]);
          i++;
        }

        if (parallelGroup.length > 1) {
          // 并行执行
          await executeParallelSteps(parallelGroup, config, callbacks);
        } else if (parallelGroup.length === 1) {
          // 单个并行步骤（无需并行，直接执行）
          const step = parallelGroup[0];
          task.currentStepIndex = step.index;
          task.updatedAt = Date.now();

          const completedResults = task.steps
            .filter((s: any) => s.status === 'completed')
            .map((s: any) => `${s.goal}: ${s.result || ''}`);

          const stepResult = await executeSingleStep(step, config, callbacks, {
            instruction,
            completedResults,
            task,
            replanCount,
          });

          // 如果触发了重新规划，需要重新构建 phase.steps 引用
          if (stepResult.replanned) {
            // 重新规划后新步骤已插入 task.steps，需要同步到当前 phase
            const newPhaseSteps = task.steps.filter((s: any) => s.phaseIndex === pIdx);
            phase.steps = newPhaseSteps;
            // 重置循环变量以从当前位置继续
            i = newPhaseSteps.findIndex((s: any) => s.status === 'pending');
            if (i < 0) i = newPhaseSteps.length;
          }

          task.updatedAt = Date.now();
        } else {
          // canParallel=false 的步骤，串行执行
          const step = phaseSteps[i];
          task.currentStepIndex = step.index;
          task.updatedAt = Date.now();

          const completedResults = task.steps
            .filter((s: any) => s.status === 'completed')
            .map((s: any) => `${s.goal}: ${s.result || ''}`);

          const stepResult = await executeSingleStep(step, config, callbacks, {
            instruction,
            completedResults,
            task,
            replanCount,
          });

          // 如果触发了重新规划，需要重新构建 phase.steps 引用
          if (stepResult.replanned) {
            const newPhaseSteps = task.steps.filter((s: any) => s.phaseIndex === pIdx);
            phase.steps = newPhaseSteps;
            i = newPhaseSteps.findIndex((s: any) => s.status === 'pending');
            if (i < 0) i = newPhaseSteps.length;
          } else {
            i++;
          }

          task.updatedAt = Date.now();
        }
      }

      // 阶段完成
      const phaseCompleted = phaseSteps.every((s: any) => s.status === 'completed');
      phase.status = currentAbortController.signal.aborted ? 'cancelled' : (phaseCompleted ? 'completed' : 'partial');
      task.updatedAt = Date.now();
      if (callbacks?.onPhaseComplete) callbacks.onPhaseComplete(phase, pIdx);
    }

    // ===== 阶段3：生成最终总结 =====
    if (task.status !== 'cancelled') {
      task.status = 'reflecting';
      if (callbacks?.onStatusChange) callbacks.onStatusChange('reflecting');

      const completedSteps = task.steps.filter((s: any) => s.status === 'completed');
      const failedSteps = task.steps.filter((s: any) => s.status === 'failed');

      // 构建执行摘要信息
      const summaryInfo = {
        totalSteps: task.steps.length,
        successSteps: completedSteps.length,
        failedSteps: failedSteps.length,
        toolsUsed: [...new Set(task.steps.filter((s: any) => s.toolName).map((s: any) => s.toolName))],
        totalDuration: Date.now() - task.createdAt,
        replanCount: replanCount.value,
      };

      // 用 LLM 生成总结
      try {
        const stepsSummary = task.steps.map((s: any, i: number) =>
          `${i + 1}. [${s.status}] ${s.goal}${s.result ? '\n   结果: ' + s.result.substring(0, 100) : ''}`
        ).join('\n');

        const summaryPrompt = `请根据以下任务执行信息生成一段简洁的中文总结（3-5句话）。
直接输出总结文本，不要加前缀。

执行信息：
- 总步骤: ${summaryInfo.totalSteps}
- 成功: ${summaryInfo.successSteps}
- 失败: ${summaryInfo.failedSteps}
- 使用工具: ${summaryInfo.toolsUsed.join(', ') || '无'}
- 重新规划次数: ${summaryInfo.replanCount}
- 总耗时: ${(summaryInfo.totalDuration / 1000).toFixed(1)}秒

最后一步的执行结果：
${task.steps[task.steps.length - 1]?.result || '无'}`;

        const summaryMessages = [
          { role: 'system', content: '你是一个任务总结助手。请根据任务执行信息，生成一段简洁的中文总结。直接输出总结文本，不要加前缀。' },
          { role: 'user', content: summaryPrompt },
        ];
        task.finalResult = await chat(config, summaryMessages);
        task.executionSummary = summaryInfo;
      } catch (e) {
        if (failedSteps.length === 0) {
          task.finalResult = `任务完成！成功执行了 ${completedSteps.length} 个步骤。`;
        } else if (completedSteps.length > 0) {
          task.finalResult = `任务部分完成。成功 ${completedSteps.length} 步，失败 ${failedSteps.length} 步。`;
        } else {
          task.finalResult = `任务执行失败。所有步骤均失败。`;
        }
        task.executionSummary = summaryInfo;
      }

      task.status = failedSteps.length === 0 && completedSteps.length > 0 ? 'completed' :
                     completedSteps.length > 0 ? 'completed' : 'failed';
    }

    if (callbacks?.onTaskComplete) callbacks.onTaskComplete(task);
    return task;
  } catch (err: any) {
    task.status = 'failed';
    task.error = err.message;
    if (callbacks?.onTaskError) callbacks.onTaskError(task, err.message);
    return task;
  } finally {
    currentTaskId = null;
    currentAbortController = null;
  }
}

module.exports = { executeAgentTask, cancelCurrentTask };
