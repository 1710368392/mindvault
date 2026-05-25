// @ts-nocheck
/**
 * 视觉分析服务
 * 将截图发送给多模态 LLM 进行界面理解
 */

const OpenAI = require('openai').default;
const Anthropic = require('@anthropic-ai/sdk').default;

interface VisionAnalysisResult {
  description: string;
  elements: Array<{
    type: string;
    description: string;
    location?: string;
    actionable: boolean;
  }>;
  suggestedActions: string[];
}

/**
 * 使用 OpenAI 兼容 API 分析截图
 */
async function analyzeWithOpenAI(
  imageBase64: string,
  task: string,
  config: any,
): Promise<VisionAnalysisResult> {
  const client = new OpenAI({
    apiKey: config.apiKey,
    baseURL: config.baseUrl || undefined,
  });

  const response = await client.chat.completions.create({
    model: config.model,
    messages: [
      {
        role: 'system',
        content: `你是一个界面分析专家。用户会给你一张应用界面的截图和一个任务描述。
请分析截图内容，识别界面中的关键元素，并建议可以执行的操作。

请严格按以下 JSON 格式返回：
{
  "description": "界面的整体描述（1-2句话）",
  "elements": [
    {"type": "按钮/输入框/列表/卡片/...", "description": "元素描述", "location": "位置描述", "actionable": true/false}
  ],
  "suggestedActions": ["建议操作1", "建议操作2"]
}`,
      },
      {
        role: 'user',
        content: [
          {
            type: 'image_url',
            image_url: {
              url: `data:image/jpeg;base64,${imageBase64}`,
              detail: 'low',
            },
          },
          {
            type: 'text',
            text: `任务: ${task}\n\n请分析这个界面，告诉我当前看到了什么，以及可以执行什么操作来完成上述任务。`,
          },
        ],
      },
    ],
    max_tokens: 2048,
  });

  const content = response.choices[0]?.message?.content || '';
  try {
    const jsonMatch = content.match(/\{[\s\S]*\}/);
    if (jsonMatch) {
      return JSON.parse(jsonMatch[0]);
    }
  } catch (e) { /* parse failed */ }

  return {
    description: content,
    elements: [],
    suggestedActions: [],
  };
}

/**
 * 使用 Anthropic API 分析截图
 */
async function analyzeWithAnthropic(
  imageBase64: string,
  task: string,
  config: any,
): Promise<VisionAnalysisResult> {
  const client = new Anthropic({ apiKey: config.apiKey });

  const response = await client.messages.create({
    model: config.model,
    max_tokens: 2048,
    messages: [
      {
        role: 'user',
        content: [
          {
            type: 'image',
            source: {
              type: 'base64',
              media_type: 'image/jpeg',
              data: imageBase64,
            },
          },
          {
            type: 'text',
            text: `你是一个界面分析专家。任务: ${task}\n\n请分析这个界面截图，按 JSON 格式返回：{"description": "界面描述", "elements": [{"type": "元素类型", "description": "描述", "actionable": true/false}], "suggestedActions": ["建议操作"]}`,
          },
        ],
      },
    ],
  });

  const content = response.content
    .filter((block: any) => block.type === 'text')
    .map((block: any) => block.text)
    .join('');

  try {
    const jsonMatch = content.match(/\{[\s\S]*\}/);
    if (jsonMatch) {
      return JSON.parse(jsonMatch[0]);
    }
  } catch (e) { /* parse failed */ }

  return {
    description: content,
    elements: [],
    suggestedActions: [],
  };
}

/**
 * 分析截图（自动选择 provider）
 */
async function analyzeScreenshot(
  imageBase64: string,
  task: string,
  config: any,
): Promise<VisionAnalysisResult> {
  if (config.provider === 'anthropic') {
    return analyzeWithAnthropic(imageBase64, task, config);
  }
  return analyzeWithOpenAI(imageBase64, task, config);
}

module.exports = { analyzeScreenshot };
