// @ts-nocheck
/**
 * AI 自定义工作流服务
 * 支持创建、编辑、删除、执行自定义工作流
 */

const crypto = require('crypto');
const repo = require('../db/repository');

function generateId() {
  return crypto.randomUUID ? crypto.randomUUID() : Date.now().toString(36) + Math.random().toString(36).substr(2, 9);
}

function getDb() { return repo.db; }

const PRESET_WORKFLOWS = [
  {
    id: 'wf-creative-brainstorm',
    name: '创意头脑风暴',
    description: '基于一个主题，从多个角度发散思维，生成创意灵感列表',
    icon: '💡',
    steps: [
      { id: 's1', name: '搜索灵感', type: 'tool', toolName: 'web_search', toolArgs: { query: '{{topic}} 创意灵感' }, goal: '搜索与主题相关的创意灵感' },
      { id: 's2', name: '阅读相关创意', type: 'tool', toolName: 'read_creativities', toolArgs: { query: '{{topic}}', limit: 5 }, goal: '查看创意库中相关内容' },
      { id: 's3', name: '生成创意列表', type: 'ai', goal: '基于搜索结果和创意库内容，从5个不同角度生成创意灵感列表，每个角度3条创意' },
      { id: 's4', name: '保存创意', type: 'tool', toolName: 'batch_create_creativities', toolArgs: {}, goal: '将生成的创意保存到创意库' },
    ],
    isPreset: true,
  },
  {
    id: 'wf-daily-review',
    name: '每日创意复盘',
    description: '回顾今天的创意，总结亮点，发现改进方向',
    icon: '📋',
    steps: [
      { id: 's1', name: '查看今日创意', type: 'tool', toolName: 'scan_creativity_library', toolArgs: { includeRecent: true, recentLimit: 10 }, goal: '获取今日创意概览' },
      { id: 's2', name: '阅读今日内容', type: 'tool', toolName: 'read_creativities', toolArgs: { query: '', limit: 10 }, goal: '详细阅读今日创意' },
      { id: 's3', name: '生成复盘报告', type: 'ai', goal: '生成今日创意复盘报告，包含：亮点总结、改进建议、明日计划' },
      { id: 's4', name: '保存复盘', type: 'tool', toolName: 'create_creativity', toolArgs: { type: 'text', subtype: 'review' }, goal: '保存复盘报告' },
    ],
    isPreset: true,
  },
  {
    id: 'wf-deep-research',
    name: '深度研究助手',
    description: '对某个主题进行多轮搜索，生成结构化研究报告',
    icon: '🔬',
    steps: [
      { id: 's1', name: '多角度搜索', type: 'tool', toolName: 'deep_research', toolArgs: { topic: '{{topic}}', depth: 3 }, goal: '深度搜索研究主题' },
      { id: 's2', name: '生成报告', type: 'ai', goal: '基于搜索结果生成结构化研究报告' },
    ],
    isPreset: true,
  },
  {
    id: 'wf-content-polish',
    name: '内容润色工坊',
    description: '对创意内容进行多风格润色，生成多个版本供选择',
    icon: '✨',
    steps: [
      { id: 's1', name: '阅读原始内容', type: 'tool', toolName: 'read_creativity_full', toolArgs: { id: '{{creativityId}}' }, goal: '获取创意完整内容' },
      { id: 's2', name: '正式风格润色', type: 'tool', toolName: 'smart_edit_creativity', toolArgs: { mode: 'rewrite', rewriteStyle: 'formal' }, goal: '正式风格润色' },
      { id: 's3', name: '创意风格润色', type: 'tool', toolName: 'smart_edit_creativity', toolArgs: { mode: 'rewrite', rewriteStyle: 'creative' }, goal: '创意风格润色' },
      { id: 's4', name: '精简风格润色', type: 'tool', toolName: 'smart_edit_creativity', toolArgs: { mode: 'rewrite', rewriteStyle: 'concise' }, goal: '精简风格润色' },
    ],
    isPreset: true,
  },
];

function initPresets() {
  const db = getDb();
  if (!db) return 0;

  let count = 0;
  for (const preset of PRESET_WORKFLOWS) {
    const existing = db.prepare('SELECT id FROM ai_workflows WHERE id = ?').get(preset.id);
    if (!existing) {
      const now = new Date().toISOString();
      db.prepare(`
        INSERT INTO ai_workflows (id, name, description, icon, steps, is_preset, is_active, run_count, created_at, updated_at)
        VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
      `).run(preset.id, preset.name, preset.description, preset.icon, JSON.stringify(preset.steps), 1, 0, 0, now, now);
      count++;
    }
  }
  return count;
}

function listWorkflows() {
  const db = getDb();
  if (!db) return [];
  const rows = db.prepare('SELECT * FROM ai_workflows ORDER BY is_preset DESC, updated_at DESC').all();
  return rows.map(mapRow);
}

function getWorkflow(id) {
  const db = getDb();
  if (!db) return null;
  const row = db.prepare('SELECT * FROM ai_workflows WHERE id = ?').get(id);
  return row ? mapRow(row) : null;
}

function createWorkflow(workflow) {
  const db = getDb();
  if (!db) throw new Error('数据库未初始化');

  const now = new Date().toISOString();
  const id = generateId();
  const steps = workflow.steps || [];

  db.prepare(`
    INSERT INTO ai_workflows (id, name, description, icon, steps, is_preset, is_active, run_count, created_at, updated_at)
    VALUES (?, ?, ?, ?, ?, 0, 0, 0, ?, ?)
  `).run(id, workflow.name || '未命名工作流', workflow.description || '', workflow.icon || '⚙️', JSON.stringify(steps), now, now);

  return getWorkflow(id);
}

function updateWorkflow(id, updates) {
  const db = getDb();
  if (!db) return null;

  const existing = db.prepare('SELECT * FROM ai_workflows WHERE id = ?').get(id);
  if (!existing) return null;
  if (existing.is_preset && (updates.name || updates.steps || updates.description)) {
    return null;
  }

  const allowedFields = { name: 'name', description: 'description', icon: 'icon', steps: 'steps' };
  const setClauses = [];
  const params = [];

  for (const [key, col] of Object.entries(allowedFields)) {
    if (updates[key] !== undefined) {
      setClauses.push(`${col} = ?`);
      params.push(key === 'steps' ? JSON.stringify(updates[key]) : updates[key]);
    }
  }

  if (setClauses.length === 0) return mapRow(existing);

  setClauses.push('updated_at = ?');
  params.push(new Date().toISOString());
  params.push(id);

  db.prepare(`UPDATE ai_workflows SET ${setClauses.join(', ')} WHERE id = ?`).run(...params);
  return getWorkflow(id);
}

function deleteWorkflow(id) {
  const db = getDb();
  if (!db) return false;

  const existing = db.prepare('SELECT * FROM ai_workflows WHERE id = ?').get(id);
  if (!existing || existing.is_preset) return false;

  const result = db.prepare('DELETE FROM ai_workflows WHERE id = ?').run(id);
  return result.changes > 0;
}

function recordRun(id) {
  const db = getDb();
  if (!db) return;
  const now = new Date().toISOString();
  db.prepare('UPDATE ai_workflows SET run_count = run_count + 1, last_run_at = ?, updated_at = ? WHERE id = ?').run(now, now, id);
}

function mapRow(row) {
  if (!row) return row;
  let steps = [];
  try { steps = typeof row.steps === 'string' ? JSON.parse(row.steps) : (row.steps || []); } catch { steps = []; }
  return {
    id: row.id,
    name: row.name,
    description: row.description,
    icon: row.icon,
    steps,
    isPreset: !!row.is_preset,
    isActive: !!row.is_active,
    runCount: row.run_count || 0,
    lastRunAt: row.last_run_at,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  };
}

module.exports = {
  initPresets,
  listWorkflows,
  getWorkflow,
  createWorkflow,
  updateWorkflow,
  deleteWorkflow,
  recordRun,
};
