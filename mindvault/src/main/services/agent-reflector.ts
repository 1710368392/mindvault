// @ts-nocheck
/**
 * Agent 反思器
 * 审查任务执行结果，提供改进建议
 */

const { chat } = require('./ai-service');

/**
 * 反思单个步骤的执行结果
 * @param step - 步骤信息
 * @param result - 执行结果
 * @param config - AI 配置
 * @returns 反思结果
 */
async function reflectOnStep(step: any, result: string, config: any): Promise<{
  passed: boolean;
  score: number; // 0-10
  feedback: string;
  suggestion?: string;
}> {
  const messages = [
    {
      role: 'system',
      content: `你是一个任务质量审查员。请评估步骤执行结果是否符合预期。

评估标准：
- 结果是否完整回答了步骤目标
- 结果是否准确无误
- 结果格式是否合理

请严格按以下 JSON 格式返回（不要包含其他文字）：
{
  "passed": true或false,
  "score": 0到10的评分,
  "feedback": "简要评估说明",
  "suggestion": "改进建议（仅当passed为false时提供）"
}`,
    },
    {
      role: 'user',
      content: `步骤目标: ${step.goal}
${step.expectedResult ? `预期结果: ${step.expectedResult}` : ''}
实际结果: ${result}

请评估此步骤的执行结果。`,
    },
  ];

  try {
    const response = await chat(config, messages);
    const jsonMatch = response.match(/\{[\s\S]*\}/);
    if (jsonMatch) {
      const reflection = JSON.parse(jsonMatch[0]);
      return {
        passed: reflection.passed === true,
        score: typeof reflection.score === 'number' ? reflection.score : 5,
        feedback: reflection.feedback || '评估完成',
        suggestion: reflection.suggestion,
      };
    }
    return { passed: true, score: 5, feedback: '反思结果解析失败，默认通过' };
  } catch (err: any) {
    console.error('[AgentReflector] 反思失败:', err.message);
    return { passed: true, score: 5, feedback: `反思失败: ${err.message}` };
  }
}

/**
 * 反思整个任务的执行结果
 */
async function reflectOnTask(task: any, config: any): Promise<{
  overallScore: number;
  summary: string;
  improvements: string[];
}> {
  const stepsSummary = task.steps
    .map((s: any, i: number) => `${i + 1}. [${s.status}] ${s.goal}${s.error ? ` - 错误: ${s.error}` : ''}`)
    .join('\n');

  const messages = [
    {
      role: 'system',
      content: `你是一个任务执行质量评估专家。请评估整个任务的执行情况，给出总结和改进建议。

请严格按以下 JSON 格式返回：
{
  "overallScore": 0到10的总体评分,
  "summary": "任务执行总结（2-3句话）",
  "improvements": ["改进建议1", "改进建议2"]
}`,
    },
    {
      role: 'user',
      content: `用户指令: ${task.userInstruction}

执行步骤:
${stepsSummary}

最终结果: ${task.finalResult || '无'}

请评估整个任务的执行情况。`,
    },
  ];

  try {
    const response = await chat(config, messages);
    const jsonMatch = response.match(/\{[\s\S]*\}/);
    if (jsonMatch) {
      const reflection = JSON.parse(jsonMatch[0]);
      return {
        overallScore: typeof reflection.overallScore === 'number' ? reflection.overallScore : 5,
        summary: reflection.summary || '评估完成',
        improvements: reflection.improvements || [],
      };
    }
    return { overallScore: 5, summary: '评估解析失败', improvements: [] };
  } catch (err: any) {
    return { overallScore: 5, summary: `评估失败: ${err.message}`, improvements: [] };
  }
}

module.exports = { reflectOnStep, reflectOnTask };
