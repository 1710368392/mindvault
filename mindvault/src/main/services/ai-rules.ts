// @ts-nocheck
/**
 * AI 规则管理服务
 * 用户自定义提示词规则，在对话时自动注入到 System Prompt
 */

const crypto = require('crypto');
const repo = require('../db/repository');

function generateId() {
  return crypto.randomUUID ? crypto.randomUUID() : Date.now().toString(36) + Math.random().toString(36).substr(2, 9);
}

function getDb() {
  return repo.db;
}

/**
 * 创建规则
 */
function createRule(rule) {
  const db = getDb();
  if (!db) throw new Error('数据库未初始化');

  const now = new Date().toISOString();
  const id = generateId();
  
  const newRule = {
    id,
    name: rule.name || '',
    content: rule.content || '',
    type: rule.type || 'global',
    scope: rule.scope || null,
    apply_mode: rule.apply_mode || 'always',
    description: rule.description || null,
    sort_order: rule.sort_order || 0,
    enabled: rule.enabled !== false ? 1 : 0,
    created_at: now,
    updated_at: now,
  };

  db.prepare(`
    INSERT INTO ai_rules (
      id, name, content, type, scope, apply_mode, description, 
      sort_order, enabled, created_at, updated_at
    ) VALUES (
      @id, @name, @content, @type, @scope, @apply_mode, @description,
      @sort_order, @enabled, @created_at, @updated_at
    )
  `).run(newRule);

  return mapRow(newRule);
}

/**
 * 获取规则列表
 */
function getRules(options = {}) {
  const db = getDb();
  if (!db) return [];

  let sql = 'SELECT * FROM ai_rules WHERE 1=1';
  const params = [];

  if (options.type) {
    sql += ' AND type = ?';
    params.push(options.type);
  }
  
  if (options.enabled !== undefined) {
    sql += ' AND enabled = ?';
    params.push(options.enabled ? 1 : 0);
  }

  sql += ' ORDER BY sort_order ASC, created_at DESC';

  if (options.limit) {
    sql += ' LIMIT ?';
    params.push(options.limit);
  }

  const rows = db.prepare(sql).all(...params);
  return rows.map(mapRow);
}

/**
 * 获取单条规则
 */
function getRuleById(id) {
  const db = getDb();
  if (!db) return null;

  const row = db.prepare('SELECT * FROM ai_rules WHERE id = ?').get(id);
  return row ? mapRow(row) : null;
}

/**
 * 更新规则
 */
function updateRule(id, updates) {
  const db = getDb();
  if (!db) return null;

  const existing = getRuleById(id);
  if (!existing) return null;

  const now = new Date().toISOString();
  
  const fields = [];
  const params = [];

  if (updates.name !== undefined) {
    fields.push('name = ?');
    params.push(updates.name);
  }
  if (updates.content !== undefined) {
    fields.push('content = ?');
    params.push(updates.content);
  }
  if (updates.type !== undefined) {
    fields.push('type = ?');
    params.push(updates.type);
  }
  if (updates.scope !== undefined) {
    fields.push('scope = ?');
    params.push(updates.scope);
  }
  if (updates.apply_mode !== undefined) {
    fields.push('apply_mode = ?');
    params.push(updates.apply_mode);
  }
  if (updates.description !== undefined) {
    fields.push('description = ?');
    params.push(updates.description);
  }
  if (updates.sort_order !== undefined) {
    fields.push('sort_order = ?');
    params.push(updates.sort_order);
  }
  if (updates.enabled !== undefined) {
    fields.push('enabled = ?');
    params.push(updates.enabled ? 1 : 0);
  }

  if (fields.length === 0) return existing;

  fields.push('updated_at = ?');
  params.push(now);
  params.push(id);

  db.prepare(`UPDATE ai_rules SET ${fields.join(', ')} WHERE id = ?`).run(...params);

  return getRuleById(id);
}

/**
 * 删除规则
 */
function deleteRule(id) {
  const db = getDb();
  if (!db) return false;

  const result = db.prepare('DELETE FROM ai_rules WHERE id = ?').run(id);
  return result.changes > 0;
}

/**
 * 切换规则启用状态
 */
function toggleRule(id) {
  const db = getDb();
  if (!db) return null;

  const rule = getRuleById(id);
  if (!rule) return null;

  return updateRule(id, { enabled: !rule.enabled });
}

/**
 * 获取当前生效的规则
 * 用于构建上下文时注入
 */
function getActiveRules(type = 'global') {
  return getRules({
    type,
    enabled: true,
  });
}

/**
 * 将规则注入到 System Prompt
 */
function injectRules(systemPrompt, rules) {
  if (!rules || rules.length === 0) {
    return systemPrompt;
  }

  // 过滤出始终生效的规则
  const alwaysRules = rules.filter(r => r.apply_mode === 'always');
  
  if (alwaysRules.length === 0) {
    return systemPrompt;
  }

  let enhancedPrompt = systemPrompt || '';
  
  enhancedPrompt += '\n\n## 用户规则（请严格遵守）\n';
  
  for (const rule of alwaysRules) {
    enhancedPrompt += `\n### ${rule.name}\n${rule.content}\n`;
  }

  return enhancedPrompt;
}

/**
 * 估算规则内容的 token 数（简单估算）
 */
function estimateRuleTokens(content) {
  // 简单估算：中文字符算1个token，英文单词算1个token
  const chineseChars = (content.match(/[\u4e00-\u9fa5]/g) || []).length;
  const englishWords = (content.match(/[a-zA-Z]+/g) || []).length;
  const otherTokens = Math.ceil((content.length - chineseChars - englishWords) / 4);
  return chineseChars + englishWords + otherTokens;
}

/**
 * 检查规则总 token 数是否超过限制
 */
function checkRulesTokenLimit(rules, maxTokens = 2000) {
  const totalTokens = rules.reduce((sum, rule) => {
    return sum + estimateRuleTokens(rule.content);
  }, 0);
  
  return {
    totalTokens,
    isOverLimit: totalTokens > maxTokens,
    maxTokens,
  };
}

/**
 * 映射数据库行到对象
 */
function mapRow(row) {
  return {
    id: row.id,
    name: row.name,
    content: row.content,
    type: row.type,
    scope: row.scope,
    apply_mode: row.apply_mode,
    description: row.description,
    sort_order: row.sort_order,
    enabled: row.enabled === 1,
    created_at: row.created_at,
    updated_at: row.updated_at,
  };
}

module.exports = {
  createRule,
  getRules,
  getRuleById,
  updateRule,
  deleteRule,
  toggleRule,
  getActiveRules,
  injectRules,
  estimateRuleTokens,
  checkRulesTokenLimit,
};
