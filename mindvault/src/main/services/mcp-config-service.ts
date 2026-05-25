// @ts-nocheck
/**
 * MCP 服务器配置服务
 * 管理 MCP 服务器配置的持久化存储和用量统计
 */

const { getDb } = require('../db/repository');

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
    const tableCheck = db.prepare("SELECT name FROM sqlite_master WHERE type='table' AND name='mcp_servers'").get();
    if (!tableCheck) {
      db.exec(`
        CREATE TABLE IF NOT EXISTS mcp_servers (
          id              TEXT PRIMARY KEY,
          name            TEXT NOT NULL,
          transport       TEXT NOT NULL DEFAULT 'stdio',
          command         TEXT,
          args            TEXT,
          env             TEXT,
          url             TEXT,
          headers         TEXT,
          enabled         INTEGER DEFAULT 1,
          is_preset       INTEGER DEFAULT 0,
          description     TEXT,
          icon            TEXT DEFAULT '🔌',
          category        TEXT DEFAULT 'custom',
          api_key         TEXT,
          quota_total     INTEGER,
          quota_used      INTEGER DEFAULT 0,
          quota_reset_at  TEXT,
          expires_at      TEXT,
          created_at      TEXT NOT NULL,
          updated_at      TEXT NOT NULL
        );

        CREATE TABLE IF NOT EXISTS mcp_usage_logs (
          id              TEXT PRIMARY KEY,
          server_id       TEXT NOT NULL,
          tool_name       TEXT NOT NULL,
          args_summary    TEXT,
          result_success  INTEGER DEFAULT 1,
          duration_ms     INTEGER,
          error_message   TEXT,
          called_at       TEXT NOT NULL,
          FOREIGN KEY (server_id) REFERENCES mcp_servers(id) ON DELETE CASCADE
        );

        CREATE TABLE IF NOT EXISTS mcp_usage_stats (
          id              TEXT PRIMARY KEY,
          server_id       TEXT NOT NULL,
          date            TEXT NOT NULL,
          call_count      INTEGER DEFAULT 0,
          success_count   INTEGER DEFAULT 0,
          error_count     INTEGER DEFAULT 0,
          total_duration_ms INTEGER DEFAULT 0,
          FOREIGN KEY (server_id) REFERENCES mcp_servers(id) ON DELETE CASCADE,
          UNIQUE(server_id, date)
        );

        CREATE INDEX IF NOT EXISTS idx_mcp_servers_enabled ON mcp_servers(enabled);
        CREATE INDEX IF NOT EXISTS idx_mcp_servers_category ON mcp_servers(category);
        CREATE INDEX IF NOT EXISTS idx_mcp_usage_logs_server ON mcp_usage_logs(server_id);
        CREATE INDEX IF NOT EXISTS idx_mcp_usage_logs_called_at ON mcp_usage_logs(called_at);
        CREATE INDEX IF NOT EXISTS idx_mcp_usage_stats_server_date ON mcp_usage_stats(server_id, date);
      `);
      console.log('[McpConfig] MCP 相关表已创建');
    }
    return true;
  } catch (err) {
    console.error('[McpConfig] 创建表失败:', err.message);
    return false;
  }
}

// ==================== 预置服务器配置 ====================
// 官方免费 MCP Server，无需 API Key，开箱即用

const PRESET_SERVERS = [
  // --- 网页抓取 ---
  {
    id: 'preset-fetch',
    name: '网页抓取',
    transport: 'stdio',
    command: 'cmd',
    args: ['/c', 'npx', '-y', '@modelcontextprotocol/server-fetch'],
    env: null,
    url: null,
    headers: null,
    enabled: true,
    description: '抓取网页内容并转换为 LLM 友好的格式，支持 URL 内容提取、Markdown 转换',
    icon: '🌐',
    category: 'network',
  },
  // --- 文件系统 ---
  {
    id: 'preset-filesystem',
    name: '文件系统',
    transport: 'stdio',
    command: 'cmd',
    args: ['/c', 'npx', '-y', '@modelcontextprotocol/server-filesystem', '.'],
    env: null,
    url: null,
    headers: null,
    enabled: true,
    description: '安全的文件操作，支持读写文件、创建目录、搜索文件等（默认访问当前目录）',
    icon: '📁',
    category: 'system',
  },
  // --- Git 仓库 ---
  {
    id: 'preset-git',
    name: 'Git 操作',
    transport: 'stdio',
    command: 'cmd',
    args: ['/c', 'npx', '-y', '@anthropic-ai/mcp-server-git'],
    env: null,
    url: null,
    headers: null,
    enabled: false,
    description: '读取和搜索 Git 仓库，查看文件差异、提交历史、分支信息等',
    icon: '📦',
    category: 'dev',
  },
  // --- 时间与时区 ---
  {
    id: 'preset-time',
    name: '时间与时区',
    transport: 'stdio',
    command: 'cmd',
    args: ['/c', 'npx', '-y', '@modelcontextprotocol/server-time'],
    env: null,
    url: null,
    headers: null,
    enabled: true,
    description: '获取当前时间、转换时区、计算时间差等时间相关功能',
    icon: '🕐',
    category: 'utility',
  },
  // --- 顺序思维 ---
  {
    id: 'preset-sequential-thinking',
    name: '顺序思维',
    transport: 'stdio',
    command: 'cmd',
    args: ['/c', 'npx', '-y', '@modelcontextprotocol/server-sequential-thinking'],
    env: null,
    url: null,
    headers: null,
    enabled: true,
    description: '通过动态思维序列进行反思性问题解决，帮助 AI 进行更深入的推理',
    icon: '🧠',
    category: 'ai',
  },
  // --- 知识图谱记忆 ---
  {
    id: 'preset-memory',
    name: '知识图谱记忆',
    transport: 'stdio',
    command: 'cmd',
    args: ['/c', 'npx', '-y', '@modelcontextprotocol/server-memory'],
    env: null,
    url: null,
    headers: null,
    enabled: true,
    description: '基于知识图谱的持久化记忆系统，AI 可以创建实体、关系并在对话间保持记忆',
    icon: '💾',
    category: 'ai',
  },
  // --- SQLite 数据库 ---
  {
    id: 'preset-sqlite',
    name: 'SQLite 数据库',
    transport: 'stdio',
    command: 'cmd',
    args: ['/c', 'npx', '-y', '@modelcontextprotocol/server-sqlite', '--db-path', '.dev-data/data.db'],
    env: null,
    url: null,
    headers: null,
    enabled: true,
    description: '直接查询和操作 SQLite 数据库，支持执行 SQL、查看表结构、数据分析',
    icon: '🗃️',
    category: 'dev',
  },
  // --- Puppeteer 浏览器自动化 ---
  {
    id: 'preset-puppeteer',
    name: '浏览器自动化',
    transport: 'stdio',
    command: 'cmd',
    args: ['/c', 'npx', '-y', '@modelcontextprotocol/server-puppeteer'],
    env: null,
    url: null,
    headers: null,
    enabled: false,
    description: '通过 Puppeteer 控制浏览器，支持网页截图、点击、填表、抓取动态内容',
    icon: '🎭',
    category: 'network',
  },
  // --- Brave 搜索 ---
  {
    id: 'preset-brave-search',
    name: 'Brave 搜索',
    transport: 'stdio',
    command: 'cmd',
    args: ['/c', 'npx', '-y', '@modelcontextprotocol/server-brave-search'],
    env: { BRAVE_API_KEY: '' },
    url: null,
    headers: null,
    enabled: false,
    description: '使用 Brave Search API 进行网页搜索（需要免费 API Key：brave.com/search/api）',
    icon: '🔍',
    category: 'network',
  },
  // --- Everything 测试服务器 ---
  {
    id: 'preset-everything',
    name: 'MCP 测试工具',
    transport: 'stdio',
    command: 'cmd',
    args: ['/c', 'npx', '-y', '@modelcontextprotocol/server-everything'],
    env: null,
    url: null,
    headers: null,
    enabled: false,
    description: 'MCP 协议全功能测试服务器，包含各种示例工具、资源和提示模板',
    icon: '🧪',
    category: 'dev',
  },
];

function initPresetServers() {
  const db = getDb();
  if (!db) return;

  ensureTables();

  try {
    const existingCount = db.prepare('SELECT COUNT(*) as count FROM mcp_servers WHERE is_preset = 1').get()?.count || 0;
    if (existingCount > 0) return;

    const insertStmt = db.prepare(`
      INSERT INTO mcp_servers (id, name, transport, command, args, env, url, headers, enabled, is_preset, description, icon, category, api_key, quota_total, quota_used, quota_reset_at, expires_at, created_at, updated_at)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    `);

    const now = nowISO();
    for (const server of PRESET_SERVERS) {
      insertStmt.run(
        server.id,
        server.name,
        server.transport || 'stdio',
        server.command || null,
        server.args ? JSON.stringify(server.args) : null,
        server.env ? JSON.stringify(server.env) : null,
        server.url || null,
        server.headers ? JSON.stringify(server.headers) : null,
        server.enabled ? 1 : 0,
        server.is_preset ? 1 : 0,
        server.description || null,
        server.icon || '🔌',
        server.category || 'custom',
        server.api_key || null,
        server.quota_total || null,
        0,
        server.quota_reset_at || null,
        server.expires_at || null,
        now,
        now
      );
    }

    console.log(`[McpConfig] 已初始化 ${PRESET_SERVERS.length} 个预置服务器`);
  } catch (err) {
    console.error('[McpConfig] 初始化预置服务器失败:', err.message);
  }
}

// ==================== 行转换辅助函数 ====================

function rowToServer(row) {
  return {
    id: row.id,
    name: row.name,
    transport: row.transport,
    command: row.command,
    args: row.args ? JSON.parse(row.args) : null,
    env: row.env ? JSON.parse(row.env) : null,
    url: row.url,
    headers: row.headers ? JSON.parse(row.headers) : null,
    enabled: row.enabled === 1,
    isPreset: row.is_preset === 1,
    description: row.description,
    icon: row.icon,
    category: row.category,
    apiKey: row.api_key,
    quotaTotal: row.quota_total,
    quotaUsed: row.quota_used,
    quotaResetAt: row.quota_reset_at,
    expiresAt: row.expires_at,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  };
}

// ==================== 配置管理 ====================

function listServers() {
  const db = getDb();
  if (!db) return [];

  ensureTables();

  try {
    const rows = db.prepare('SELECT * FROM mcp_servers ORDER BY is_preset DESC, created_at ASC').all();
    return rows.map(rowToServer);
  } catch (err) {
    console.error('[McpConfig] 列出服务器失败:', err.message);
    return [];
  }
}

function getServer(serverId) {
  const db = getDb();
  if (!db) return null;

  ensureTables();

  try {
    const row = db.prepare('SELECT * FROM mcp_servers WHERE id = ?').get(serverId);
    if (!row) return null;
    return rowToServer(row);
  } catch (err) {
    console.error('[McpConfig] 获取服务器失败:', err.message);
    return null;
  }
}

function createServer(server) {
  const db = getDb();
  if (!db) return null;

  ensureTables();

  const id = generateId();
  const now = nowISO();

  try {
    db.prepare(`
      INSERT INTO mcp_servers (id, name, transport, command, args, env, url, headers, enabled, is_preset, description, icon, category, api_key, quota_total, quota_used, quota_reset_at, expires_at, created_at, updated_at)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    `).run(
      id,
      server.name || '未命名服务器',
      server.transport || 'stdio',
      server.command || null,
      server.args ? JSON.stringify(server.args) : null,
      server.env ? JSON.stringify(server.env) : null,
      server.url || null,
      server.headers ? JSON.stringify(server.headers) : null,
      server.enabled !== false ? 1 : 0,
      0,
      server.description || null,
      server.icon || '🔌',
      server.category || 'custom',
      server.api_key || null,
      server.quota_total || null,
      0,
      server.quota_reset_at || null,
      server.expires_at || null,
      now,
      now
    );

    return getServer(id);
  } catch (err) {
    console.error('[McpConfig] 创建服务器失败:', err.message);
    return null;
  }
}

function updateServer(serverId, updates) {
  const db = getDb();
  if (!db) return false;

  ensureTables();

  const allowedFields = ['name', 'transport', 'command', 'args', 'env', 'url', 'headers', 'description', 'icon', 'category', 'api_key', 'quota_total', 'quota_reset_at', 'expires_at'];
  const jsonFields = ['args', 'env', 'headers'];
  const fields = [];
  const values = [];

  for (const [key, val] of Object.entries(updates)) {
    const col = key.replace(/([A-Z])/g, '_$1').toLowerCase();
    if (allowedFields.includes(col)) {
      fields.push(col + ' = ?');
      values.push(jsonFields.includes(col) && val ? JSON.stringify(val) : val);
    }
  }

  if (fields.length === 0) return false;

  fields.push('updated_at = ?');
  values.push(nowISO());
  values.push(serverId);

  try {
    const result = db.prepare(`UPDATE mcp_servers SET ${fields.join(', ')} WHERE id = ?`).run(...values);
    return result.changes > 0;
  } catch (err) {
    console.error('[McpConfig] 更新服务器失败:', err.message);
    return false;
  }
}

function deleteServer(serverId) {
  const db = getDb();
  if (!db) return false;

  ensureTables();

  try {
    const result = db.prepare('DELETE FROM mcp_servers WHERE id = ?').run(serverId);
    return result.changes > 0;
  } catch (err) {
    console.error('[McpConfig] 删除服务器失败:', err.message);
    return false;
  }
}

function toggleServer(serverId) {
  const db = getDb();
  if (!db) return null;

  ensureTables();

  try {
    db.prepare('UPDATE mcp_servers SET enabled = CASE WHEN enabled = 1 THEN 0 ELSE 1 END, updated_at = ? WHERE id = ?').run(nowISO(), serverId);
    return getServer(serverId);
  } catch (err) {
    console.error('[McpConfig] 切换服务器状态失败:', err.message);
    return null;
  }
}

function getEnabledServers() {
  const db = getDb();
  if (!db) return [];

  ensureTables();

  try {
    const rows = db.prepare('SELECT * FROM mcp_servers WHERE enabled = 1 ORDER BY is_preset DESC, created_at ASC').all();
    return rows.map(rowToServer);
  } catch (err) {
    console.error('[McpConfig] 获取启用服务器失败:', err.message);
    return [];
  }
}

// ==================== 用量统计 ====================

function logUsage(serverId, toolName, argsSummary, success, durationMs, errorMessage) {
  const db = getDb();
  if (!db) return null;

  ensureTables();

  const id = generateId();
  const now = nowISO();
  const today = now.substring(0, 10);
  const isSuccess = success ? 1 : 0;
  const isError = success ? 0 : 1;

  try {
    const insertLog = db.prepare(`
      INSERT INTO mcp_usage_logs (id, server_id, tool_name, args_summary, result_success, duration_ms, error_message, called_at)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?)
    `);

    const upsertStats = db.prepare(`
      INSERT INTO mcp_usage_stats (id, server_id, date, call_count, success_count, error_count, total_duration_ms)
      VALUES (?, ?, ?, 1, ?, ?, ?)
      ON CONFLICT(server_id, date) DO UPDATE SET
        call_count = call_count + 1,
        success_count = success_count + ?,
        error_count = error_count + ?,
        total_duration_ms = total_duration_ms + ?
    `);

    const statsId = `${serverId}_${today}`;

    const transaction = db.transaction(() => {
      insertLog.run(id, serverId, toolName, argsSummary || null, isSuccess, durationMs || null, errorMessage || null, now);
      upsertStats.run(statsId, serverId, today, isSuccess, isError, durationMs || 0, isSuccess, isError, durationMs || 0);
    });

    transaction();

    return { id, serverId, toolName, calledAt: now };
  } catch (err) {
    console.error('[McpConfig] 记录用量失败:', err.message);
    return null;
  }
}

function getUsageStats(serverId, days) {
  const db = getDb();
  if (!db) return [];

  ensureTables();

  days = days || 7;

  try {
    const rows = db.prepare(`
      SELECT * FROM mcp_usage_stats
      WHERE server_id = ? AND date >= date('now', '-' || ? || ' days')
      ORDER BY date DESC
    `).all(serverId, days);

    return rows.map(row => ({
      id: row.id,
      serverId: row.server_id,
      date: row.date,
      callCount: row.call_count,
      successCount: row.success_count,
      errorCount: row.error_count,
      totalDurationMs: row.total_duration_ms,
    }));
  } catch (err) {
    console.error('[McpConfig] 获取用量统计失败:', err.message);
    return [];
  }
}

function getUsageSummary(serverId) {
  const db = getDb();
  if (!db) return null;

  ensureTables();

  try {
    const row = db.prepare(`
      SELECT
        COUNT(*) as total_calls,
        SUM(CASE WHEN result_success = 1 THEN 1 ELSE 0 END) as success_calls,
        SUM(CASE WHEN result_success = 0 THEN 1 ELSE 0 END) as error_calls,
        AVG(duration_ms) as avg_duration_ms,
        MAX(duration_ms) as max_duration_ms,
        MIN(duration_ms) as min_duration_ms,
        COUNT(DISTINCT tool_name) as unique_tools,
        MIN(called_at) as first_call,
        MAX(called_at) as last_call
      FROM mcp_usage_logs
      WHERE server_id = ?
    `).get(serverId);

    if (!row || row.total_calls === 0) {
      return {
        serverId,
        totalCalls: 0,
        successCalls: 0,
        errorCalls: 0,
        successRate: 0,
        avgDurationMs: 0,
        maxDurationMs: 0,
        minDurationMs: 0,
        uniqueTools: 0,
        firstCall: null,
        lastCall: null,
      };
    }

    return {
      serverId,
      totalCalls: row.total_calls,
      successCalls: row.success_calls,
      errorCalls: row.error_calls,
      successRate: row.total_calls > 0 ? Math.round((row.success_calls / row.total_calls) * 10000) / 100 : 0,
      avgDurationMs: Math.round(row.avg_duration_ms) || 0,
      maxDurationMs: row.max_duration_ms || 0,
      minDurationMs: row.min_duration_ms || 0,
      uniqueTools: row.unique_tools,
      firstCall: row.first_call,
      lastCall: row.last_call,
    };
  } catch (err) {
    console.error('[McpConfig] 获取用量摘要失败:', err.message);
    return null;
  }
}

function incrementQuotaUsed(serverId) {
  const db = getDb();
  if (!db) return false;

  ensureTables();

  try {
    db.prepare('UPDATE mcp_servers SET quota_used = quota_used + 1, updated_at = ? WHERE id = ?').run(nowISO(), serverId);
    return true;
  } catch (err) {
    console.error('[McpConfig] 增加配额使用量失败:', err.message);
    return false;
  }
}

function checkQuota(serverId) {
  const db = getDb();
  if (!db) return { ok: true, remaining: null };

  ensureTables();

  try {
    const row = db.prepare('SELECT quota_total, quota_used, quota_reset_at FROM mcp_servers WHERE id = ?').get(serverId);
    if (!row) return { ok: false, remaining: 0 };

    // 没有设置配额限制
    if (row.quota_total === null || row.quota_total === undefined) {
      return { ok: true, remaining: null };
    }

    // 检查是否需要重置配额
    if (row.quota_reset_at) {
      const resetAt = new Date(row.quota_reset_at);
      if (new Date() >= resetAt) {
        db.prepare('UPDATE mcp_servers SET quota_used = 0, updated_at = ? WHERE id = ?').run(nowISO(), serverId);
        return { ok: true, remaining: row.quota_total };
      }
    }

    const remaining = row.quota_total - (row.quota_used || 0);
    return {
      ok: remaining > 0,
      remaining,
      total: row.quota_total,
      used: row.quota_used || 0,
    };
  } catch (err) {
    console.error('[McpConfig] 检查配额失败:', err.message);
    return { ok: false, remaining: 0 };
  }
}

function checkExpiration(serverId) {
  const db = getDb();
  if (!db) return { expired: false };

  ensureTables();

  try {
    const row = db.prepare('SELECT expires_at FROM mcp_servers WHERE id = ?').get(serverId);
    if (!row) return { expired: true };

    // 没有设置过期时间
    if (!row.expires_at) {
      return { expired: false };
    }

    const expiresAt = new Date(row.expires_at);
    const now = new Date();
    const isExpired = now >= expiresAt;

    return {
      expired: isExpired,
      expiresAt: row.expires_at,
      remainingDays: Math.max(0, Math.ceil((expiresAt - now) / (1000 * 60 * 60 * 24))),
    };
  } catch (err) {
    console.error('[McpConfig] 检查过期失败:', err.message);
    return { expired: true };
  }
}

module.exports = {
  ensureTables,
  initPresetServers,
  listServers,
  getServer,
  createServer,
  updateServer,
  deleteServer,
  toggleServer,
  getEnabledServers,
  logUsage,
  getUsageStats,
  getUsageSummary,
  incrementQuotaUsed,
  checkQuota,
  checkExpiration,
};
