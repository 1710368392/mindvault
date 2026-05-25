// @ts-nocheck
/**
 * Agent 任务规划器 v2
 * 支持思考过程流式输出、任务分组、阶段化执行
 */

const { chatStream, chat } = require('./ai-service');
const { getToolDefinitions } = require('./tool-executor');

let mcpBridge: any = null;
try {
  mcpBridge = require('./mcp-bridge').mcpBridge;
} catch (e) { /* MCP not available */ }

/**
 * 获取所有可用工具的描述文本
 */
function getAvailableToolsDescription(): string {
  const tools = getToolDefinitions();
  let desc = '可用工具列表：\n';

  for (const tool of tools) {
    if (tool.type === 'function') {
      const fn = tool.function;
      desc += `- ${fn.name}: ${fn.description}\n`;
      if (fn.parameters && fn.parameters.properties) {
        const params = Object.keys(fn.parameters.properties);
        if (params.length > 0) {
          desc += `  参数: ${params.join(', ')}`;
          if (fn.parameters.required && fn.parameters.required.length > 0) {
            desc += ` (必填: ${fn.parameters.required.join(', ')})`;
          }
          desc += '\n';
        }
      }
    }
  }

  // 添加 MCP 工具
  if (mcpBridge) {
    try {
      const mcpTools = mcpBridge.getMCPToolDefinitions();
      if (mcpTools && mcpTools.length > 0) {
        desc += '\nMCP 外部工具：\n';
        for (const tool of mcpTools) {
          if (tool.type === 'function') {
            const fn = tool.function;
            desc += `- ${fn.name}: ${fn.description}\n`;
          }
        }
      }
    } catch (e) { /* ignore */ }
  }

  return desc;
}

/**
 * 带思考过程的任务规划（流式输出思考过程）
 * @param instruction - 用户指令
 * @param config - AI 配置
 * @param callbacks - 回调函数集合
 *   - onThinkingToken: 每个思考 token 的回调
 *   - onThinkingEnd: 思考过程结束的回调
 *   - onPlanReady: 规划完成回调
 *   - signal: 取消信号
 */
async function planTaskWithThinking(
  instruction: string,
  config: any,
  callbacks?: {
    onThinkingToken?: (token: string) => void;
    onThinkingEnd?: (fullThinking: string) => void;
    onPlanReady?: (plan: any) => void;
    signal?: any;
  }
): Promise<any> {
  const toolsDescription = getAvailableToolsDescription();

  const systemPrompt = `你是一个智能任务规划助手。用户会给你一个任务，你需要：

1. **先思考**：分析任务，理解用户意图，考虑最优执行方案
2. **再规划**：将任务拆解为可执行的步骤

${toolsDescription}

【铁律 - 违反将导致任务失败】
1. **每个步骤必须指定 toolName**，从上面的可用工具列表中选择
2. **禁止生成没有 toolName 的步骤**，不要只生成文本回复步骤
3. **分析任务后，必须调用工具执行具体操作**，不要只描述要做什么
4. **toolArgs 必须包含该工具所需的所有必填参数**
5. **优先使用最直接的工具完成任务，避免不必要的中间步骤**
6. **如果任务涉及文件操作，先确认文件存在再执行**
7. **对于搜索类任务，优先使用全局搜索而非逐个查看**
8. **合理利用 canParallel 标记，无依赖关系的步骤应标记为可并行**

请严格按照以下格式返回（先输出思考过程，再输出 JSON 规划）：

<thinking>
你的思考过程...
分析用户意图...
确定需要调用的工具...
规划执行步骤...
</thinking>

{
  "summary": "用一句话概括你要做什么",
  "phases": [
    {
      "name": "阶段名称（如：准备阶段、执行阶段、总结阶段）",
      "description": "阶段描述",
      "steps": [
        {
          "goal": "步骤目标",
          "toolName": "工具名称（必须从可用工具列表中选择）",
          "toolArgs": { "参数名": "参数值" },
          "expectedResult": "预期结果",
          "canParallel": false
        }
      ]
    }
  ]
}

重要规则：
- **每个步骤必须有 toolName**，禁止空 toolName
- canParallel 为 true 的步骤可以同时执行
- 每个阶段内的步骤按顺序执行，阶段之间也按顺序执行
- 同一阶段中 canParallel 为 true 的步骤会并行执行
- 通常 2-4 个阶段，每阶段 1-4 个步骤
- 思考过程要详细，展示你的推理过程
- **示例错误**：{"goal": "查询创意", "toolName": ""} ❌
- **示例正确**：{"goal": "查询创意", "toolName": "search_creativity", "toolArgs": {"query": "小说"}} ✅`;

  const messages = [
    { role: 'system', content: systemPrompt },
    { role: 'user', content: `请规划以下任务：\n\n${instruction}` },
  ];

  try {
    let fullText = '';
    let thinkingText = '';
    let thinkingEnded = false;

    // 使用流式输出获取思考过程
    const result = await chatStream(
      config,
      messages,
      (token) => {
        fullText += token;

        // 提取思考过程
        if (!thinkingEnded) {
          thinkingText += token;
          if (callbacks?.onThinkingToken) {
            callbacks.onThinkingToken(token);
          }
          // 检查思考是否结束
          if (thinkingText.includes('</thinking>')) {
            thinkingEnded = true;
            const match = thinkingText.match(/<thinking>([\s\S]*?)<\/thinking>/);
            if (match) {
              thinkingText = match[1].trim();
            }
            if (callbacks?.onThinkingEnd) {
              callbacks.onThinkingEnd(thinkingText);
            }
          }
        }
      },
      callbacks?.signal
    );

    // 解析 JSON 规划
    const jsonMatch = result.match(/\{[\s\S]*\}/);
    if (jsonMatch) {
      const plan = JSON.parse(jsonMatch[0]);

      // 将 phases+steps 扁平化为带阶段信息的步骤列表
      const flatSteps: any[] = [];
      let stepIndex = 0;

      const phases = (plan.phases || []).map((phase: any, phaseIdx: number) => {
        const phaseSteps = (phase.steps || []).map((step: any) => {
          const flatStep = {
            id: `step_${Date.now()}_${stepIndex}`,
            index: stepIndex++,
            phase: phase.name || `阶段 ${phaseIdx + 1}`,
            phaseIndex: phaseIdx,
            goal: step.goal || `步骤 ${stepIndex}`,
            toolName: step.toolName || undefined,
            toolArgs: step.toolArgs || undefined,
            expectedResult: step.expectedResult || undefined,
            canParallel: step.canParallel === true,
            status: 'pending' as string,
            retryCount: 0,
          };
          flatSteps.push(flatStep);
          return flatStep;
        });
        return {
          name: phase.name || `阶段 ${phaseIdx + 1}`,
          description: phase.description || '',
          steps: phaseSteps,
          status: 'pending' as string,
        };
      });

      const finalPlan = {
        summary: plan.summary || '',
        thinking: thinkingText,
        phases,
        steps: flatSteps,
      };

      if (callbacks?.onPlanReady) callbacks.onPlanReady(finalPlan);
      return finalPlan;
    }

    // JSON 解析失败，返回简单的单步任务
    const fallbackPlan = {
      summary: instruction,
      thinking: thinkingText || '无法解析规划结果',
      phases: [{
        name: '执行',
        description: '直接执行',
        steps: [],
        status: 'pending',
      }],
      steps: [{
        id: `step_${Date.now()}_0`,
        index: 0,
        phase: '执行',
        phaseIndex: 0,
        goal: instruction,
        canParallel: false,
        status: 'pending',
        retryCount: 0,
      }],
    };
    fallbackPlan.phases[0].steps = [fallbackPlan.steps[0]];
    return fallbackPlan;

  } catch (err: any) {
    console.error('[AgentPlanner] 规划失败:', err.message);
    const fallbackPlan = {
      summary: instruction,
      thinking: `规划失败: ${err.message}`,
      phases: [{
        name: '执行',
        description: '直接执行',
        steps: [],
        status: 'pending',
      }],
      steps: [{
        id: `step_${Date.now()}_0`,
        index: 0,
        phase: '执行',
        phaseIndex: 0,
        goal: instruction,
        canParallel: false,
        status: 'pending',
        retryCount: 0,
      }],
    };
    fallbackPlan.phases[0].steps = [fallbackPlan.steps[0]];
    return fallbackPlan;
  }
}

/**
 * 向后兼容：不带思考过程的任务规划
 */
async function planTask(instruction: string, config: any): Promise<any> {
  return planTaskWithThinking(instruction, config);
}

/**
 * 基于执行上下文重新规划任务
 * @param {string} context - 包含原始任务、已完成步骤、失败信息的上下文
 * @param {object} config - AI 配置
 * @param {string} toolsDescription - 可用工具描述
 * @returns {object} 新的执行计划
 */
async function replanTask(context: string, config: any, toolsDescription: string): Promise<any> {
  const systemPrompt = `你是一个智能任务重新规划助手。任务执行过程中遇到了问题，需要你根据当前情况调整执行计划。

${toolsDescription}

【铁律】
1. 重新规划时只规划剩余需要执行的步骤，不要重复已成功的步骤
2. 每个步骤必须指定 toolName
3. 如果某个工具不可用，尝试寻找替代方案
4. 保持简洁，通常 1-5 个步骤即可
5. 优先使用最直接的工具完成任务，避免不必要的中间步骤
6. 如果任务涉及文件操作，先确认文件存在再执行
7. 对于搜索类任务，优先使用全局搜索而非逐个查看
8. 合理利用 canParallel 标记，无依赖关系的步骤应标记为可并行

请返回 JSON 格式：
{
  "summary": "调整说明",
  "steps": [
    {
      "goal": "步骤目标",
      "toolName": "工具名称",
      "toolArgs": {},
      "expectedResult": "预期结果",
      "canParallel": false
    }
  ]
}`;

  try {
    const result = await chat(config, [
      { role: 'system', content: systemPrompt },
      { role: 'user', content: context },
    ]);
    const jsonMatch = result.match(/\{[\s\S]*\}/);
    if (jsonMatch) {
      const plan = JSON.parse(jsonMatch[0]);
      return {
        summary: plan.summary || '已调整执行计划',
        steps: (plan.steps || []).map((s: any, i: number) => ({
          id: `replan_${Date.now()}_${i}`,
          index: i,
          goal: s.goal,
          toolName: s.toolName,
          toolArgs: s.toolArgs || {},
          expectedResult: s.expectedResult,
          canParallel: s.canParallel || false,
          status: 'pending' as string,
          retryCount: 0,
        })),
      };
    }
  } catch (err: any) {
    console.error('[AgentPlanner] 重新规划失败:', err);
  }
  return null;
}

module.exports = { planTask, planTaskWithThinking, replanTask, getAvailableToolsDescription };
