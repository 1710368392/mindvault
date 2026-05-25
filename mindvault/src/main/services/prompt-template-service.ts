// @ts-nocheck
/**
 * Prompt 模板服务
 * 管理预设和自定义 Prompt 模板
 */

const { getDb } = require('../db/repository');
const crypto = require('crypto');

function generateId() {
  return Date.now().toString(36) + Math.random().toString(36).substring(2, 11);
}

function nowISO() {
  return new Date().toISOString();
}

function ensureTables() {
  const db = getDb();
  if (!db) return false;

  try {
    const tableCheck = db.prepare("SELECT name FROM sqlite_master WHERE type='table' AND name='prompt_templates'").get();
    if (!tableCheck) {
      db.exec(`
        CREATE TABLE IF NOT EXISTS prompt_templates (
          id              TEXT PRIMARY KEY,
          name            TEXT NOT NULL,
          description     TEXT,
          category        TEXT NOT NULL,
          template        TEXT NOT NULL,
          variables       TEXT,
          is_preset       INTEGER DEFAULT 0,
          use_count       INTEGER DEFAULT 0,
          created_at      TEXT NOT NULL
        );
        CREATE INDEX IF NOT EXISTS idx_prompt_templates_category ON prompt_templates(category);
      `);
      console.log('[PromptTemplate] 模板表已创建');
    }
    return true;
  } catch (err) {
    console.error('[PromptTemplate] 创建表失败:', err.message);
    return false;
  }
}

const PRESET_TEMPLATES = [
  {
    id: 'tpl_inspiration_expand',
    name: '灵感拓展',
    description: '从一个核心想法出发，多角度拓展灵感',
    category: 'creative',
    template: '请围绕以下核心想法，从不同角度帮我拓展灵感：\n\n{{核心想法}}\n\n请从以下维度展开：\n1. 反向思考：如果反过来会怎样？\n2. 类比联想：这让我想到了什么？\n3. 极端假设：如果无限放大这个想法？\n4. 组合创新：和其他领域结合会怎样？\n5. 用户视角：谁会需要这个？解决什么问题？',
    variables: JSON.stringify({ '核心想法': { type: 'text', default: '' } }),
    is_preset: 1,
  },
  {
    id: 'tpl_creativity_evaluate',
    name: '创意评估',
    description: '从多个维度评估创意的可行性和价值',
    category: 'analysis',
    template: '请从以下维度评估我的创意：\n\n{{创意内容}}\n\n评估维度：\n1. 新颖性（1-10分）：这个创意有多独特？\n2. 可行性（1-10分）：实现难度如何？\n3. 影响力（1-10分）：能影响多少人？\n4. 可扩展性（1-10分）：能否延伸出更多创意？\n5. 综合建议：优势和风险分别是什么？',
    variables: JSON.stringify({ '创意内容': { type: 'text', default: '' } }),
    is_preset: 1,
  },
  {
    id: 'tpl_writing_polish',
    name: '写作润色',
    description: '优化文字表达，提升写作质量',
    category: 'writing',
    template: '请帮我润色以下文字，提升表达质量：\n\n{{原始文字}}\n\n润色要求：\n- 保持原意不变\n- 使语言更加流畅自然\n- 增强文字的感染力\n- 优化句式结构\n\n请提供润色后的版本，并说明主要修改了哪些地方。',
    variables: JSON.stringify({ '原始文字': { type: 'text', default: '' } }),
    is_preset: 1,
  },
  {
    id: 'tpl_weekly_summary',
    name: '周报生成',
    description: '生成本周创作总结报告',
    category: 'analysis',
    template: '请帮我生成本周的创作总结报告。\n\n请先查看我最近一周的创意和编辑记录，然后生成包含以下内容的报告：\n1. 本周创作概览（数量、类型分布）\n2. 重点关注领域\n3. 创作趋势分析\n4. 下周建议方向',
    variables: null,
    is_preset: 1,
  },
  {
    id: 'tpl_deep_organize',
    name: '深度整理',
    description: '自动分类归纳创意库',
    category: 'organize',
    template: '请帮我深度整理创意库：\n\n1. 先查看所有创意的内容\n2. 按主题/类型进行分类\n3. 为未标签的创意添加合适的标签\n4. 发现创意之间的关联并建立链接\n5. 生成整理报告',
    variables: null,
    is_preset: 1,
  },
  {
    id: 'tpl_story_continuation',
    name: '故事续写',
    description: '根据已有内容续写故事',
    category: 'writing',
    template: '请根据以下已有内容，帮我续写故事：\n\n{{已有内容}}\n\n续写要求：\n- 保持风格和语气一致\n- 自然衔接上文\n- 推进情节发展\n- 增加适当的细节描写\n\n请续写约500字。',
    variables: JSON.stringify({ '已有内容': { type: 'text', default: '' } }),
    is_preset: 1,
  },
  {
    id: 'tpl_translate_polish',
    name: '翻译润色',
    description: '翻译并润色文本',
    category: 'writing',
    template: '请将以下内容翻译为{{目标语言}}，并进行润色：\n\n{{原文}}\n\n要求：\n- 翻译准确，不遗漏信息\n- 语言自然流畅，符合目标语言习惯\n- 保留原文的风格和语气',
    variables: JSON.stringify({ '原文': { type: 'text', default: '' }, '目标语言': { type: 'text', default: '英文' } }),
    is_preset: 1,
  },
  {
    id: 'tpl_explain_concept',
    name: '概念解释',
    description: '用通俗易懂的方式解释复杂概念',
    category: 'analysis',
    template: '请用通俗易懂的方式解释以下概念：\n\n{{概念}}\n\n请按照以下结构解释：\n1. 一句话概括\n2. 生活中的类比\n3. 核心要点（3-5个）\n4. 常见误区\n5. 延伸思考',
    variables: JSON.stringify({ '概念': { type: 'text', default: '' } }),
    is_preset: 1,
  },
  {
    id: 'tpl_batch_tag',
    name: '批量标签',
    description: '为最近的创意自动打标签',
    category: 'organize',
    template: '请帮我为最近的创意自动打标签：\n\n1. 先列出最近的创意\n2. 分析每个创意的主题和关键词\n3. 为每个创意添加2-3个合适的标签\n4. 如果没有合适的标签，创建新标签\n5. 生成标签报告',
    variables: null,
    is_preset: 1,
  },
  {
    id: 'tpl_topic_research',
    name: '主题研究',
    description: '对一个主题进行深度研究',
    category: 'analysis',
    template: '请帮我深入研究以下主题：\n\n{{研究主题}}\n\n研究框架：\n1. 主题概述和定义\n2. 核心概念和术语\n3. 主要流派/观点\n4. 最新发展和趋势\n5. 实际应用场景\n6. 推荐资源（书籍/文章/工具）\n\n请尽量联网搜索获取最新信息。',
    variables: JSON.stringify({ '研究主题': { type: 'text', default: '' } }),
    is_preset: 1,
  },
  {
    id: 'tpl_character_design',
    name: '角色设计',
    description: '创建一个完整的角色设定',
    category: 'creative',
    template: '请帮我设计一个角色：\n\n角色类型：{{角色类型}}\n故事背景：{{故事背景}}\n\n请包含以下设定：\n1. 基本信息（姓名/年龄/外貌）\n2. 性格特征（优点/缺点/怪癖）\n3. 背景故事\n4. 核心动机和目标\n5. 人际关系\n6. 成长弧线',
    variables: JSON.stringify({ '角色类型': { type: 'text', default: '主角' }, '故事背景': { type: 'text', default: '现代都市' } }),
    is_preset: 1,
  },
  {
    id: 'tpl_worldbuilding',
    name: '世界观构建',
    description: '构建一个完整的世界观设定',
    category: 'creative',
    template: '请帮我构建一个世界观：\n\n核心概念：{{核心概念}}\n风格倾向：{{风格倾向}}\n\n请包含以下设定：\n1. 世界基本规则（物理/魔法/科技）\n2. 地理和环境\n3. 社会结构和文化\n4. 历史大事件\n5. 势力分布\n6. 日常生活的细节',
    variables: JSON.stringify({ '核心概念': { type: 'text', default: '' }, '风格倾向': { type: 'text', default: '奇幻' } }),
    is_preset: 1,
  },
];

function initPresetTemplates() {
  const db = getDb();
  if (!db) return;

  ensureTables();

  try {
    const existingCount = db.prepare('SELECT COUNT(*) as count FROM prompt_templates WHERE is_preset = 1').get()?.count || 0;
    if (existingCount > 0) return;

    const insertStmt = db.prepare(`
      INSERT INTO prompt_templates (id, name, description, category, template, variables, is_preset, use_count, created_at)
      VALUES (?, ?, ?, ?, ?, ?, ?, 0, ?)
    `);

    const now = nowISO();
    for (const tpl of PRESET_TEMPLATES) {
      insertStmt.run(
        tpl.id,
        tpl.name,
        tpl.description,
        tpl.category,
        tpl.template,
        tpl.variables,
        tpl.is_preset,
        now
      );
    }

    console.log(`[PromptTemplate] 已初始化 ${PRESET_TEMPLATES.length} 个预设模板`);
  } catch (err) {
    console.error('[PromptTemplate] 初始化预设模板失败:', err.message);
  }
}

function listTemplates(category) {
  const db = getDb();
  if (!db) return [];

  ensureTables();

  try {
    let sql = 'SELECT * FROM prompt_templates';
    const params = [];

    if (category) {
      sql += ' WHERE category = ?';
      params.push(category);
    }

    sql += ' ORDER BY is_preset DESC, use_count DESC, created_at ASC';

    const rows = db.prepare(sql).all(...params);
    return rows.map(row => ({
      id: row.id,
      name: row.name,
      description: row.description,
      category: row.category,
      template: row.template,
      variables: row.variables ? JSON.parse(row.variables) : null,
      isPreset: row.is_preset === 1,
      useCount: row.use_count,
      createdAt: row.created_at,
    }));
  } catch (err) {
    console.error('[PromptTemplate] 列出模板失败:', err.message);
    return [];
  }
}

function getTemplate(templateId) {
  const db = getDb();
  if (!db) return null;

  ensureTables();

  try {
    const row = db.prepare('SELECT * FROM prompt_templates WHERE id = ?').get(templateId);
    if (!row) return null;

    return {
      id: row.id,
      name: row.name,
      description: row.description,
      category: row.category,
      template: row.template,
      variables: row.variables ? JSON.parse(row.variables) : null,
      isPreset: row.is_preset === 1,
      useCount: row.use_count,
      createdAt: row.created_at,
    };
  } catch (err) {
    console.error('[PromptTemplate] 获取模板失败:', err.message);
    return null;
  }
}

function createTemplate(template) {
  const db = getDb();
  if (!db) return null;

  ensureTables();

  const id = generateId();
  const now = nowISO();

  try {
    db.prepare(`
      INSERT INTO prompt_templates (id, name, description, category, template, variables, is_preset, use_count, created_at)
      VALUES (?, ?, ?, ?, ?, ?, 0, 0, ?)
    `).run(
      id,
      template.name || '自定义模板',
      template.description || '',
      template.category || 'custom',
      template.template || '',
      template.variables ? JSON.stringify(template.variables) : null,
      now
    );

    return {
      id,
      name: template.name || '自定义模板',
      description: template.description || '',
      category: template.category || 'custom',
      template: template.template || '',
      variables: template.variables || null,
      isPreset: false,
      useCount: 0,
      createdAt: now,
    };
  } catch (err) {
    console.error('[PromptTemplate] 创建模板失败:', err.message);
    return null;
  }
}

function updateTemplate(templateId, updates) {
  const db = getDb();
  if (!db) return false;

  ensureTables();

  const allowedFields = ['name', 'description', 'category', 'template', 'variables'];
  const fields = [];
  const values = [];

  for (const [key, val] of Object.entries(updates)) {
    const col = key.replace(/([A-Z])/g, '_$1').toLowerCase();
    if (allowedFields.includes(col)) {
      fields.push(col + ' = ?');
      values.push(col === 'variables' && val ? JSON.stringify(val) : val);
    }
  }

  if (fields.length === 0) return false;

  values.push(templateId);

  try {
    const result = db.prepare(`UPDATE prompt_templates SET ${fields.join(', ')} WHERE id = ? AND is_preset = 0`).run(...values);
    return result.changes > 0;
  } catch (err) {
    console.error('[PromptTemplate] 更新模板失败:', err.message);
    return false;
  }
}

function deleteTemplate(templateId) {
  const db = getDb();
  if (!db) return false;

  ensureTables();

  try {
    const result = db.prepare('DELETE FROM prompt_templates WHERE id = ? AND is_preset = 0').run(templateId);
    return result.changes > 0;
  } catch (err) {
    console.error('[PromptTemplate] 删除模板失败:', err.message);
    return false;
  }
}

function incrementUseCount(templateId) {
  const db = getDb();
  if (!db) return;

  ensureTables();

  try {
    db.prepare('UPDATE prompt_templates SET use_count = use_count + 1 WHERE id = ?').run(templateId);
  } catch (err) {
    console.error('[PromptTemplate] 更新使用次数失败:', err.message);
  }
}

function renderTemplate(templateId, variableValues) {
  const template = getTemplate(templateId);
  if (!template) return null;

  let rendered = template.template;

  if (template.variables && variableValues) {
    for (const [key, config] of Object.entries(template.variables)) {
      const value = variableValues[key] || (config as any).default || '';
      rendered = rendered.replace(new RegExp(`\\{\\{${key}\\}\\}`, 'g'), value);
    }
  }

  incrementUseCount(templateId);

  return rendered;
}

function getCategories() {
  const db = getDb();
  if (!db) return [];

  ensureTables();

  try {
    const rows = db.prepare('SELECT DISTINCT category FROM prompt_templates ORDER BY category').all();
    return rows.map(r => r.category);
  } catch (err) {
    console.error('[PromptTemplate] 获取分类失败:', err.message);
    return [];
  }
}

module.exports = {
  ensureTables,
  initPresetTemplates,
  listTemplates,
  getTemplate,
  createTemplate,
  updateTemplate,
  deleteTemplate,
  incrementUseCount,
  renderTemplate,
  getCategories,
};
