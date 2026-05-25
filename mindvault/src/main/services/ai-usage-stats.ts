// @ts-nocheck
/**
 * AI 使用统计服务
 * 收集和查询 AI 调用的统计数据
 */

const crypto = require('crypto');
const repo = require('../db/repository');

function generateId() {
  return crypto.randomUUID ? crypto.randomUUID() : Date.now().toString(36) + Math.random().toString(36).substr(2, 9);
}

function getDb() { return repo.db; }

function recordUsage(data) {
  const db = getDb();
  if (!db) return;

  const today = new Date().toISOString().split('T')[0];
  const provider = data.provider || 'unknown';
  const model = data.model || 'unknown';

  const existing = db.prepare(
    'SELECT id, request_count, token_input, token_output, tool_call_count, error_count, avg_latency_ms, cache_hit_count FROM ai_usage_stats WHERE date = ? AND provider = ? AND model = ?'
  ).get(today, provider, model);

  if (existing) {
    const newReqCount = existing.request_count + 1;
    const newTokenIn = existing.token_input + (data.tokenInput || 0);
    const newTokenOut = existing.token_output + (data.tokenOutput || 0);
    const newToolCalls = existing.tool_call_count + (data.toolCallCount || 0);
    const newErrors = existing.error_count + (data.isError ? 1 : 0);
    const newCacheHits = (existing.cache_hit_count || 0) + (data.cacheHit ? 1 : 0);
    const newAvgLatency = Math.round(
      (existing.avg_latency_ms * existing.request_count + (data.latencyMs || 0)) / newReqCount
    );

    db.prepare(`
      UPDATE ai_usage_stats SET request_count = ?, token_input = ?, token_output = ?,
        tool_call_count = ?, error_count = ?, avg_latency_ms = ?, cache_hit_count = ?
      WHERE id = ?
    `).run(newReqCount, newTokenIn, newTokenOut, newToolCalls, newErrors, newAvgLatency, newCacheHits, existing.id);
  } else {
    const id = generateId();
    const now = new Date().toISOString();
    db.prepare(`
      INSERT INTO ai_usage_stats (id, date, provider, model, request_count, token_input, token_output,
        tool_call_count, error_count, avg_latency_ms, cache_hit_count, created_at)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    `).run(id, today, provider, model, 1, data.tokenInput || 0, data.tokenOutput || 0,
      data.toolCallCount || 0, data.isError ? 1 : 0, data.latencyMs || 0, data.cacheHit ? 1 : 0, now);
  }
}

function getStats(period = '7d') {
  const db = getDb();
  if (!db) return { totalRequests: 0, totalTokenInput: 0, totalTokenOutput: 0, totalToolCalls: 0, dailyData: [], modelDistribution: [] };

  const now = new Date();
  let startDate;
  switch (period) {
    case '24h': startDate = new Date(now.getTime() - 24 * 60 * 60 * 1000); break;
    case '7d': startDate = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000); break;
    case '30d': startDate = new Date(now.getTime() - 30 * 24 * 60 * 60 * 1000); break;
    case 'all': startDate = new Date('2020-01-01'); break;
    default: startDate = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000);
  }

  const startStr = startDate.toISOString().split('T')[0];

  const summary = db.prepare(`
    SELECT COALESCE(SUM(request_count), 0) as total_requests,
           COALESCE(SUM(token_input), 0) as total_token_input,
           COALESCE(SUM(token_output), 0) as total_token_output,
           COALESCE(SUM(tool_call_count), 0) as total_tool_calls,
           COALESCE(SUM(error_count), 0) as total_errors,
           COALESCE(AVG(avg_latency_ms), 0) as avg_latency
    FROM ai_usage_stats WHERE date >= ?
  `).get(startStr);

  const dailyData = db.prepare(`
    SELECT date, SUM(request_count) as requests, SUM(token_input) as token_in,
           SUM(token_output) as token_out, SUM(tool_call_count) as tool_calls
    FROM ai_usage_stats WHERE date >= ?
    GROUP BY date ORDER BY date
  `).all(startStr);

  const modelDistribution = db.prepare(`
    SELECT provider, model, SUM(request_count) as requests, SUM(token_input) as token_in, SUM(token_output) as token_out
    FROM ai_usage_stats WHERE date >= ?
    GROUP BY provider, model ORDER BY requests DESC
  `).all(startStr);

  const todayStr = now.toISOString().split('T')[0];
  const todayStats = db.prepare(`
    SELECT COALESCE(SUM(request_count), 0) as requests, COALESCE(SUM(token_input), 0) as token_in,
           COALESCE(SUM(token_output), 0) as token_out
    FROM ai_usage_stats WHERE date = ?
  `).get(todayStr);

  return {
    totalRequests: summary.total_requests,
    totalTokenInput: summary.total_token_input,
    totalTokenOutput: summary.total_token_output,
    totalToolCalls: summary.total_tool_calls,
    totalErrors: summary.total_errors,
    avgLatency: Math.round(summary.avg_latency),
    todayRequests: todayStats.requests,
    todayTokenInput: todayStats.token_in,
    todayTokenOutput: todayStats.token_out,
    dailyData: dailyData.map(d => ({
      date: d.date,
      requests: d.requests,
      tokenInput: d.token_in,
      tokenOutput: d.token_out,
      toolCalls: d.tool_calls,
    })),
    modelDistribution: modelDistribution.map(m => ({
      provider: m.provider,
      model: m.model,
      requests: m.requests,
      tokenInput: m.token_in,
      tokenOutput: m.token_out,
    })),
  };
}

function getTopTools(limit = 10) {
  const db = getDb();
  if (!db) return [];

  const rows = db.prepare(`
    SELECT date, SUM(tool_call_count) as total_tools FROM ai_usage_stats
    WHERE tool_call_count > 0 GROUP BY date ORDER BY date DESC LIMIT ?
  `).all(limit);

  return rows.map(r => ({ date: r.date, totalToolCalls: r.total_tools }));
}

function getRealtimeStats() {
  const db = getDb();
  if (!db) return null;

  const today = new Date().toISOString().split('T')[0];

  const row = db.prepare(`
    SELECT
      COALESCE(SUM(request_count), 0) as total_requests,
      COALESCE(SUM(token_input), 0) as total_input_tokens,
      COALESCE(SUM(token_output), 0) as total_output_tokens,
      COALESCE(SUM(token_input) + SUM(token_output), 0) as total_tokens,
      COALESCE(SUM(tool_call_count), 0) as total_tool_calls,
      COALESCE(SUM(error_count), 0) as total_errors,
      COALESCE(SUM(cache_hit_count), 0) as cache_hits,
      COUNT(DISTINCT model) as model_count
    FROM ai_usage_stats
    WHERE date = ?
  `).get(today);

  return row;
}

function clearStats() {
  const db = getDb();
  if (!db) return;
  db.prepare('DELETE FROM ai_usage_stats').run();
}

module.exports = {
  recordUsage,
  getStats,
  getTopTools,
  getRealtimeStats,
  clearStats,
};
