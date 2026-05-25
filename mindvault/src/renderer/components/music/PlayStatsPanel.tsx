import React, { useState, useEffect, useMemo } from 'react';
import { Typography } from 'antd';
import { BarChart3, Clock, Music, Users, Disc, TrendingUp, Headphones } from 'lucide-react';
import { api } from '../../utils/api';

interface PlayStats {
  totalPlays: number;
  totalDuration: number;
  uniqueTracks: number;
  topTracks: Array<{ trackTitle: string; trackArtist: string; playCount: number; totalDuration: number }>;
  topArtists: Array<{ artist: string; playCount: number; totalDuration: number }>;
  topAlbums: Array<{ album: string; playCount: number; totalDuration: number }>;
  hourlyDistribution: number[];
  dailyDistribution: Array<{ date: string; playCount: number; totalDuration: number }>;
  sourceDistribution: { local: number; online: number; preset: number };
  avgCompletionRate: number;
  longestSession: { trackTitle: string; durationPlayed: number };
}

const PERIOD_OPTIONS = [
  { key: 'today', label: '今天' },
  { key: 'week', label: '本周' },
  { key: 'month', label: '本月' },
  { key: '', label: '全部' },
];

const formatDuration = (seconds: number): string => {
  if (seconds < 60) return `${Math.round(seconds)}秒`;
  if (seconds < 3600) return `${Math.floor(seconds / 60)}分${Math.round(seconds % 60)}秒`;
  const h = Math.floor(seconds / 3600);
  const m = Math.floor((seconds % 3600) / 60);
  return `${h}小时${m}分`;
};

const PlayStatsPanel: React.FC = () => {
  const [period, setPeriod] = useState('week');
  const [stats, setStats] = useState<PlayStats | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    setLoading(true);
    api.music.getPlayStats(period ? { period } : {}).then((result: any) => {
      if (result?.success && result.data) {
        setStats(result.data);
      }
    }).catch(() => {}).finally(() => setLoading(false));
  }, [period]);

  const maxHourly = useMemo(() => {
    if (!stats?.hourlyDistribution) return 1;
    return Math.max(...stats.hourlyDistribution, 1);
  }, [stats]);

  const maxDaily = useMemo(() => {
    if (!stats?.dailyDistribution) return 1;
    return Math.max(...stats.dailyDistribution.map(d => d.playCount), 1);
  }, [stats]);

  if (loading) {
    return (
      <div style={{ padding: 20, textAlign: 'center', color: 'var(--text-tertiary)' }}>
        <Headphones size={24} style={{ marginBottom: 8, opacity: 0.5 }} />
        <div>加载统计中...</div>
      </div>
    );
  }

  if (!stats) {
    return (
      <div style={{ padding: 20, textAlign: 'center', color: 'var(--text-tertiary)' }}>
        <BarChart3 size={24} style={{ marginBottom: 8, opacity: 0.5 }} />
        <div>暂无播放数据</div>
      </div>
    );
  }

  return (
    <div style={{ padding: '12px 16px', display: 'flex', flexDirection: 'column', gap: 12 }}>
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
          <BarChart3 size={14} style={{ color: 'var(--primary-color)' }} />
          <span style={{ fontSize: 13, fontWeight: 600, color: 'var(--text-primary)' }}>播放统计</span>
        </div>
        <div style={{ display: 'flex', gap: 2 }}>
          {PERIOD_OPTIONS.map(opt => (
            <button
              key={opt.key}
              onClick={() => setPeriod(opt.key)}
              style={{
                padding: '2px 8px',
                fontSize: 10,
                borderRadius: 4,
                border: 'none',
                cursor: 'pointer',
                background: period === opt.key ? 'var(--primary-color)' : 'var(--bg-tertiary)',
                color: period === opt.key ? 'white' : 'var(--text-tertiary)',
                transition: 'all 0.2s',
              }}
            >
              {opt.label}
            </button>
          ))}
        </div>
      </div>

      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: 8 }}>
        {[
          { icon: <Music size={12} />, label: '总播放', value: stats.totalPlays, unit: '次' },
          { icon: <Clock size={12} />, label: '总时长', value: formatDuration(stats.totalDuration), unit: '' },
          { icon: <Disc size={12} />, label: '不同曲目', value: stats.uniqueTracks, unit: '首' },
        ].map((item, i) => (
          <div key={i} style={{
            padding: '8px 10px',
            borderRadius: 8,
            background: 'var(--bg-tertiary)',
            display: 'flex',
            flexDirection: 'column',
            gap: 2,
          }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 4, color: 'var(--text-tertiary)' }}>
              {item.icon}
              <span style={{ fontSize: 9 }}>{item.label}</span>
            </div>
            <div style={{ fontSize: 16, fontWeight: 700, color: 'var(--primary-color)' }}>
              {item.value}
              {item.unit && <span style={{ fontSize: 9, fontWeight: 400, marginLeft: 2 }}>{item.unit}</span>}
            </div>
          </div>
        ))}
      </div>

      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 8 }}>
        <div style={{ padding: '8px 10px', borderRadius: 8, background: 'var(--bg-tertiary)' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 4, marginBottom: 6, color: 'var(--text-tertiary)' }}>
            <TrendingUp size={10} />
            <span style={{ fontSize: 10, fontWeight: 600 }}>最爱歌曲</span>
          </div>
          {stats.topTracks.slice(0, 5).map((t, i) => (
            <div key={i} style={{ display: 'flex', alignItems: 'center', gap: 4, padding: '2px 0' }}>
              <span style={{ fontSize: 8, color: 'var(--text-tertiary)', width: 12, textAlign: 'right' }}>{i + 1}</span>
              <div style={{ flex: 1, minWidth: 0 }}>
                <div style={{ fontSize: 9, color: 'var(--text-primary)', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>{t.trackTitle}</div>
                <div style={{ fontSize: 8, color: 'var(--text-tertiary)' }}>{t.trackArtist} · {t.playCount}次</div>
              </div>
            </div>
          ))}
          {stats.topTracks.length === 0 && <div style={{ fontSize: 9, color: 'var(--text-tertiary)', opacity: 0.5 }}>暂无数据</div>}
        </div>

        <div style={{ padding: '8px 10px', borderRadius: 8, background: 'var(--bg-tertiary)' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 4, marginBottom: 6, color: 'var(--text-tertiary)' }}>
            <Users size={10} />
            <span style={{ fontSize: 10, fontWeight: 600 }}>最爱艺术家</span>
          </div>
          {stats.topArtists.slice(0, 5).map((a, i) => (
            <div key={i} style={{ display: 'flex', alignItems: 'center', gap: 4, padding: '2px 0' }}>
              <span style={{ fontSize: 8, color: 'var(--text-tertiary)', width: 12, textAlign: 'right' }}>{i + 1}</span>
              <div style={{ flex: 1, minWidth: 0 }}>
                <div style={{ fontSize: 9, color: 'var(--text-primary)', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>{a.artist}</div>
                <div style={{ fontSize: 8, color: 'var(--text-tertiary)' }}>{a.playCount}次 · {formatDuration(a.totalDuration)}</div>
              </div>
            </div>
          ))}
          {stats.topArtists.length === 0 && <div style={{ fontSize: 9, color: 'var(--text-tertiary)', opacity: 0.5 }}>暂无数据</div>}
        </div>
      </div>

      <div style={{ padding: '8px 10px', borderRadius: 8, background: 'var(--bg-tertiary)' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 4, marginBottom: 6, color: 'var(--text-tertiary)' }}>
          <Clock size={10} />
          <span style={{ fontSize: 10, fontWeight: 600 }}>24小时分布</span>
        </div>
        <div style={{ display: 'flex', alignItems: 'flex-end', gap: 1, height: 40 }}>
          {stats.hourlyDistribution.map((count, h) => (
            <div key={h} style={{ flex: 1, display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 1 }}>
              <div style={{
                width: '100%',
                minHeight: 2,
                height: Math.max(2, (count / maxHourly) * 36),
                borderRadius: 1,
                background: count > 0 ? 'var(--primary-color)' : 'var(--border-light)',
                opacity: count > 0 ? 0.7 : 0.3,
                transition: 'height 0.3s ease',
              }} />
              {h % 4 === 0 && <span style={{ fontSize: 6, color: 'var(--text-tertiary)' }}>{h}</span>}
            </div>
          ))}
        </div>
      </div>

      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 8 }}>
        <div style={{ padding: '8px 10px', borderRadius: 8, background: 'var(--bg-tertiary)' }}>
          <div style={{ fontSize: 9, color: 'var(--text-tertiary)', marginBottom: 4 }}>来源分布</div>
          <div style={{ display: 'flex', gap: 6 }}>
            {[
              { label: '本地', value: stats.sourceDistribution.local, color: '#4ade80' },
              { label: '在线', value: stats.sourceDistribution.online, color: '#60a5fa' },
              { label: '预设', value: stats.sourceDistribution.preset, color: '#fbbf24' },
            ].map(s => (
              <div key={s.label} style={{ textAlign: 'center' }}>
                <div style={{ fontSize: 12, fontWeight: 600, color: s.color }}>{s.value}</div>
                <div style={{ fontSize: 7, color: 'var(--text-tertiary)' }}>{s.label}</div>
              </div>
            ))}
          </div>
        </div>
        <div style={{ padding: '8px 10px', borderRadius: 8, background: 'var(--bg-tertiary)' }}>
          <div style={{ fontSize: 9, color: 'var(--text-tertiary)', marginBottom: 4 }}>平均完成率</div>
          <div style={{ fontSize: 18, fontWeight: 700, color: 'var(--primary-color)' }}>
            {Math.round(stats.avgCompletionRate * 100)}%
          </div>
          {stats.longestSession && (
            <div style={{ fontSize: 7, color: 'var(--text-tertiary)', marginTop: 2 }}>
              最长: {stats.longestSession.trackTitle} ({formatDuration(stats.longestSession.durationPlayed)})
            </div>
          )}
        </div>
      </div>

      {stats.dailyDistribution.length > 0 && (
        <div style={{ padding: '8px 10px', borderRadius: 8, background: 'var(--bg-tertiary)' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 4, marginBottom: 6, color: 'var(--text-tertiary)' }}>
            <TrendingUp size={10} />
            <span style={{ fontSize: 10, fontWeight: 600 }}>每日趋势</span>
          </div>
          <div style={{ display: 'flex', alignItems: 'flex-end', gap: 1, height: 36 }}>
            {stats.dailyDistribution.slice(-14).map((d, i) => (
              <div key={i} style={{ flex: 1, display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 1 }}>
                <div style={{
                  width: '100%',
                  minHeight: 2,
                  height: Math.max(2, (d.playCount / maxDaily) * 32),
                  borderRadius: 1,
                  background: d.playCount > 0 ? 'var(--primary-color)' : 'var(--border-light)',
                  opacity: d.playCount > 0 ? 0.7 : 0.3,
                }} />
                <span style={{ fontSize: 5, color: 'var(--text-tertiary)' }}>
                  {d.date.slice(-2)}
                </span>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
};

export default PlayStatsPanel;
