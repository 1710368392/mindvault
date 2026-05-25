import React, { useState, useEffect } from 'react';
import { X, BarChart3, TrendingUp, Zap, Clock, AlertCircle } from 'lucide-react';
import { useAIStore } from '../../stores/aiStore';

interface Props {
  onClose: () => void;
}

const PERIOD_OPTIONS = [
  { value: '24h', label: '24小时' },
  { value: '7d', label: '7天' },
  { value: '30d', label: '30天' },
  { value: 'all', label: '全部' },
];

const AIUsageDashboard: React.FC<Props> = ({ onClose }) => {
  const aiUsageStats = useAIStore((s) => s.aiUsageStats);
  const aiUsageStatsPeriod = useAIStore((s) => s.aiUsageStatsPeriod);
  const loadAIUsageStats = useAIStore((s) => s.loadAIUsageStats);

  useEffect(() => { loadAIUsageStats(); }, []);

  const stats = aiUsageStats || {
    totalRequests: 0, totalTokenInput: 0, totalTokenOutput: 0,
    totalToolCalls: 0, totalErrors: 0, avgLatency: 0,
    todayRequests: 0, dailyData: [], modelDistribution: [],
  };

  const maxDailyRequests = Math.max(...(stats.dailyData?.map((d: any) => d.requests) || [1]), 1);

  return (
    <div style={{ position: 'fixed', inset: 0, zIndex: 10000, display: 'flex', alignItems: 'center', justifyContent: 'center', background: 'rgba(0,0,0,0.4)' }}>
      <div style={{ width: 600, maxHeight: '80vh', background: 'var(--bg-primary)', borderRadius: 16, boxShadow: '0 20px 60px rgba(0,0,0,0.3)', display: 'flex', flexDirection: 'column', overflow: 'hidden' }}>
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '16px 20px', borderBottom: '1px solid var(--border-light)' }}>
          <div style={{ fontSize: 16, fontWeight: 700, color: 'var(--text-primary)' }}>📊 AI 使用统计</div>
          <button onClick={onClose} style={{ background: 'none', border: 'none', cursor: 'pointer', color: 'var(--text-tertiary)' }}><X size={18} /></button>
        </div>

        <div style={{ display: 'flex', gap: 6, padding: '10px 20px', borderBottom: '1px solid var(--border-light)' }}>
          {PERIOD_OPTIONS.map(opt => (
            <button key={opt.value} onClick={() => loadAIUsageStats(opt.value)}
              style={{
                padding: '4px 12px', borderRadius: 6, border: 'none', fontSize: 12, fontWeight: 600, cursor: 'pointer',
                background: aiUsageStatsPeriod === opt.value ? 'var(--primary-color)' : 'var(--bg-secondary)',
                color: aiUsageStatsPeriod === opt.value ? '#fff' : 'var(--text-secondary)',
              }}>
              {opt.label}
            </button>
          ))}
        </div>

        <div style={{ flex: 1, overflowY: 'auto', padding: 16 }}>
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: 10, marginBottom: 16 }}>
            {[
              { label: '总请求', value: stats.totalRequests, icon: <Zap size={14} />, color: '#3b82f6' },
              { label: '今日请求', value: stats.todayRequests, icon: <TrendingUp size={14} />, color: '#10b981' },
              { label: '工具调用', value: stats.totalToolCalls, icon: <BarChart3 size={14} />, color: '#8b5cf6' },
              { label: '输入 Token', value: stats.totalTokenInput?.toLocaleString(), icon: <Clock size={14} />, color: '#f59e0b' },
              { label: '输出 Token', value: stats.totalTokenOutput?.toLocaleString(), icon: <Clock size={14} />, color: '#ef4444' },
              { label: '平均延迟', value: `${stats.avgLatency}ms`, icon: <AlertCircle size={14} />, color: '#6366f1' },
            ].map((item, i) => (
              <div key={i} style={{ padding: '10px 12px', borderRadius: 10, background: 'var(--bg-secondary)', border: '1px solid var(--border-light)' }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: 4, marginBottom: 4 }}>
                  <span style={{ color: item.color }}>{item.icon}</span>
                  <span style={{ fontSize: 11, color: 'var(--text-tertiary)' }}>{item.label}</span>
                </div>
                <div style={{ fontSize: 18, fontWeight: 700, color: 'var(--text-primary)' }}>{item.value}</div>
              </div>
            ))}
          </div>

          {stats.dailyData?.length > 0 && (
            <div style={{ marginBottom: 16 }}>
              <div style={{ fontSize: 13, fontWeight: 600, color: 'var(--text-secondary)', marginBottom: 8 }}>每日请求趋势</div>
              <div style={{ display: 'flex', alignItems: 'flex-end', gap: 4, height: 80, padding: '0 4px' }}>
                {stats.dailyData.slice(-14).map((d: any, i: number) => (
                  <div key={i} style={{ flex: 1, display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 2 }}>
                    <div style={{
                      width: '100%', borderRadius: 3, background: 'var(--primary-color)',
                      height: Math.max(4, (d.requests / maxDailyRequests) * 60),
                      opacity: 0.6 + (d.requests / maxDailyRequests) * 0.4,
                      transition: 'height 0.3s ease',
                    }} />
                    <span style={{ fontSize: 8, color: 'var(--text-tertiary)' }}>{d.date?.slice(5)}</span>
                  </div>
                ))}
              </div>
            </div>
          )}

          {stats.modelDistribution?.length > 0 && (
            <div>
              <div style={{ fontSize: 13, fontWeight: 600, color: 'var(--text-secondary)', marginBottom: 8 }}>模型使用分布</div>
              {stats.modelDistribution.map((m: any, i: number) => {
                const total = stats.modelDistribution.reduce((s: number, x: any) => s + x.requests, 0);
                const pct = total > 0 ? Math.round((m.requests / total) * 100) : 0;
                return (
                  <div key={i} style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 6 }}>
                    <span style={{ fontSize: 12, color: 'var(--text-secondary)', width: 120, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{m.model}</span>
                    <div style={{ flex: 1, height: 6, borderRadius: 3, background: 'var(--bg-secondary)', overflow: 'hidden' }}>
                      <div style={{ height: '100%', borderRadius: 3, background: 'var(--primary-color)', width: `${pct}%`, transition: 'width 0.3s ease' }} />
                    </div>
                    <span style={{ fontSize: 11, color: 'var(--text-tertiary)', width: 50, textAlign: 'right' }}>{m.requests} ({pct}%)</span>
                  </div>
                );
              })}
            </div>
          )}

          {stats.totalRequests === 0 && (
            <div style={{ textAlign: 'center', padding: 30, color: 'var(--text-tertiary)' }}>
              <BarChart3 size={32} style={{ opacity: 0.3, marginBottom: 8 }} />
              <div style={{ fontSize: 13 }}>暂无使用数据</div>
              <div style={{ fontSize: 11, marginTop: 4 }}>开始使用 AI 助手后，统计数据将自动记录</div>
            </div>
          )}
        </div>

        <div style={{ padding: '12px 16px', borderTop: '1px solid var(--border-light)', display: 'flex', justifyContent: 'flex-end' }}>
          <button onClick={onClose} style={{ padding: '6px 14px', borderRadius: 8, border: '1px solid var(--border-light)', background: 'var(--bg-primary)', cursor: 'pointer', fontSize: 12 }}>关闭</button>
        </div>
      </div>
    </div>
  );
};

export default AIUsageDashboard;
