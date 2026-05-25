// @ts-nocheck
/**
 * Agent 预设工作流
 * 定义常用的多步骤任务模板
 */

const WORKFLOWS = [
  {
    id: 'deep-organize',
    name: '深度整理',
    description: '扫描所有创意，自动分类归纳，创建看板并分配',
    triggerKeywords: ['整理', '归类', '分类', '整理创意', '组织'],
    steps: [
      { goal: '列出所有创意，了解当前创意库的整体情况', toolName: 'list_creativities', toolArgs: { page: 1, pageSize: 50 }, expectedResult: '获取到所有创意的列表' },
      { goal: '根据创意内容分析主题分布，确定分类方案', expectedResult: '生成分类方案（如：写作、设计、技术、生活等）' },
      { goal: '为每个分类创建对应的标签', toolName: 'create_tag', toolArgs: { name: '{category}', color: '#6366F1' }, expectedResult: '所有分类标签创建成功' },
      { goal: '创建一个整理看板', toolName: 'create_board', toolArgs: { name: '创意整理', layout: 'board' }, expectedResult: '看板创建成功' },
      { goal: '将创意按分类分配到看板中', toolName: 'add_to_board', toolArgs: { boardId: '{boardId}', creativityId: '{creativityId}' }, expectedResult: '所有创意已分配到看板' },
      { goal: '为创意批量添加分类标签', toolName: 'tag_creativity', toolArgs: { creativityId: '{id}', tags: ['{tag}'] }, expectedResult: '标签添加完成' },
      { goal: '生成整理报告，总结分类结果', expectedResult: '输出整理报告' },
    ],
  },
  {
    id: 'weekly-summary',
    name: '周报生成',
    description: '生成本周创作活动的总结报告',
    triggerKeywords: ['周报', '本周总结', '创作总结', '周总结'],
    steps: [
      { goal: '获取本周创建和修改的创意', toolName: 'search_by_date_range', toolArgs: { dateFrom: '{weekStart}', dateTo: '{weekEnd}', limit: 50 }, expectedResult: '获取到本周的创意列表' },
      { goal: '获取应用统计数据', toolName: 'get_app_stats', expectedResult: '获取到应用整体统计' },
      { goal: '分析本周创作趋势和亮点', expectedResult: '生成创作分析' },
      { goal: '创建一条总结创意记录', toolName: 'create_creativity', toolArgs: { title: '本周创作总结 - {date}', content: '{summary}', subtype: 'note' }, expectedResult: '总结创意创建成功' },
    ],
  },
  {
    id: 'idea-expand',
    name: '灵感拓展',
    description: '基于选中的灵感进行深度拓展，搜索相关资料并生成关联创意',
    triggerKeywords: ['拓展', '展开', '深入', '扩展灵感', '丰富'],
    steps: [
      { goal: '读取当前选中的创意内容', toolName: 'get_creativity_detail', toolArgs: { id: '{selectedId}' }, expectedResult: '获取到选中创意的完整内容' },
      { goal: '联网搜索相关资料和灵感', toolName: 'web_search', toolArgs: { query: '{keywords}' }, expectedResult: '获取到相关搜索结果' },
      { goal: '基于原始灵感和搜索结果生成拓展内容', expectedResult: '生成拓展内容' },
      { goal: '创建拓展后的关联创意', toolName: 'create_creativity', toolArgs: { title: '{expandedTitle}', content: '{expandedContent}', subtype: 'idea' }, expectedResult: '拓展创意创建成功' },
      { goal: '在两个创意之间建立关联', toolName: 'link_creativities', toolArgs: { sourceId: '{originalId}', targetId: '{expandedId}', relationType: 'derived' }, expectedResult: '创意关联创建成功' },
    ],
  },
  {
    id: 'batch-tag',
    name: '批量打标签',
    description: '分析最近的创意内容，自动生成并应用标签',
    triggerKeywords: ['打标签', '标签', '自动标签', '批量标签'],
    steps: [
      { goal: '列出最近创建的创意', toolName: 'get_recent_edits', toolArgs: { limit: 30 }, expectedResult: '获取到最近的创意列表' },
      { goal: '逐个分析创意内容，生成合适的标签', expectedResult: '为每个创意生成标签建议' },
      { goal: '批量创建新标签并应用到创意', toolName: 'tag_creativity', toolArgs: { creativityId: '{id}', tags: ['{tags}'] }, expectedResult: '所有标签应用完成' },
    ],
  },
  {
    id: 'research-topic',
    name: '主题研究',
    description: '围绕一个主题进行深度研究，收集资料并整理成创意笔记',
    triggerKeywords: ['研究', '调研', '资料收集', '调研主题'],
    steps: [
      { goal: '联网搜索主题的基础信息', toolName: 'web_search', toolArgs: { query: '{topic} 概述' }, expectedResult: '获取到基础信息' },
      { goal: '搜索主题的深入资料', toolName: 'web_search', toolArgs: { query: '{topic} 深入分析 案例' }, expectedResult: '获取到深入资料' },
      { goal: '搜索主题的最新动态', toolName: 'web_search', toolArgs: { query: '{topic} 2025 2026 最新趋势' }, expectedResult: '获取到最新动态' },
      { goal: '整合所有资料生成研究笔记', toolName: 'create_creativity', toolArgs: { title: '主题研究: {topic}', content: '{research}', subtype: 'note' }, expectedResult: '研究笔记创建成功' },
    ],
  },
];

/**
 * 获取所有预设工作流
 */
function getWorkflows() {
  return WORKFLOWS;
}

/**
 * 根据用户指令匹配工作流
 */
function matchWorkflow(instruction: string): any | null {
  const lowerInstruction = instruction.toLowerCase();

  for (const workflow of WORKFLOWS) {
    for (const keyword of workflow.triggerKeywords) {
      if (lowerInstruction.includes(keyword)) {
        return workflow;
      }
    }
  }

  return null;
}

module.exports = { getWorkflows, matchWorkflow };
