import React, { useEffect, useState } from 'react';
import { TrendingUp, Thermometer, Droplets, Wind } from 'lucide-react';
import { WEATHER_LABELS } from '../../../shared/weather-constants';
import { useWeatherStore } from '../../stores/weatherStore';
import type { HourlyForecast } from '../../../shared/weather-constants';

type TrendMetric = 'temperature' | 'humidity' | 'wind_speed';

/**
 * Catmull-Rom 样条曲线算法，将点连接为平滑曲线
 * @param points 点数组 [ [x1,y1], [x2,y2], ... ]
 * @param alpha 张力参数 (0.0 = 均匀, 0.5 = 弦长, 1.0 = 向心)
 * @returns SVG path d 属性字符串
 */
function catmullRomSpline(points: number[][], alpha: number = 0.5): string {
  if (points.length < 2) return '';
  if (points.length === 2) return `M ${points[0][0]},${points[0][1]} L ${points[1][0]},${points[1][1]}`;

  const p0 = points[0];
  const p1 = points[1];
  const p2 = points[points.length - 2];
  const p3 = points[points.length - 1];

  const controlPoints = [
    [2 * p0[0] - p1[0], 2 * p0[1] - p1[1]],
    ...points,
    [2 * p2[0] - p3[0], 2 * p2[1] - p3[1]],
  ];

  let path = `M ${points[0][0]},${points[0][1]}`;

  for (let i = 1; i < points.length; i++) {
    const cp0 = controlPoints[i - 1];
    const cp1 = controlPoints[i];
    const cp2 = controlPoints[i + 1];
    const cp3 = controlPoints[i + 2];

    const t0 = 0;
    const t1 = t0 + Math.pow(Math.hypot(cp1[0] - cp0[0], cp1[1] - cp0[1]), alpha);
    const t2 = t1 + Math.pow(Math.hypot(cp2[0] - cp1[0], cp2[1] - cp1[1]), alpha);
    const t3 = t2 + Math.pow(Math.hypot(cp3[0] - cp2[0], cp3[1] - cp2[1]), alpha);

    const c1 = [
      ((t1 - t0) / (t2 - t0)) * (cp2[0] - cp0[0]) + cp1[0],
      ((t1 - t0) / (t2 - t0)) * (cp2[1] - cp0[1]) + cp1[1],
    ];

    const c2 = [
      cp2[0] - ((t3 - t2) / (t3 - t1)) * (cp3[0] - cp1[0]),
      cp2[1] - ((t3 - t2) / (t3 - t1)) * (cp3[1] - cp1[1]),
    ];

    path += ` C ${c1[0]},${c1[1]} ${c2[0]},${c2[1]} ${cp2[0]},${cp2[1]}`;
  }

  return path;
}

const WeatherTrendChart: React.FC = () => {
  const [metric, setMetric] = useState<TrendMetric>('temperature');
  const [loading, setLoading] = useState(true);
  const hourlyForecast = useWeatherStore(s => s.hourlyForecast);
  const loadHourlyForecast = useWeatherStore(s => s.loadHourlyForecast);

  useEffect(() => {
    const loadData = async () => {
      try {
        await loadHourlyForecast();
      } catch (err) {
        console.error('[WeatherTrend] loadHourlyData error:', err);
      } finally {
        setLoading(false);
      }
    };
    loadData();
  }, [loadHourlyForecast]);

  const hourlyData = hourlyForecast || [];

  if (loading) {
    return (
      <div style={{
        display: 'flex', flexDirection: 'column', alignItems: 'center',
        justifyContent: 'center', padding: '20px 0', gap: 8,
      }}>
        <TrendingUp size={20} style={{ color: 'var(--text-tertiary)', opacity: 0.4 }} />
        <span style={{ fontSize: 11, color: 'var(--text-tertiary)' }}>加载中...</span>
      </div>
    );
  }

  if (hourlyData.length < 2) {
    return (
      <div style={{
        display: 'flex', flexDirection: 'column', alignItems: 'center',
        justifyContent: 'center', padding: '20px 0', gap: 8,
      }}>
        <TrendingUp size={20} style={{ color: 'var(--text-tertiary)', opacity: 0.4 }} />
        <span style={{ fontSize: 11, color: 'var(--text-tertiary)' }}>暂无逐时数据</span>
      </div>
    );
  }

  const getValues = (forecast: HourlyForecast): number => {
    switch (metric) {
      case 'temperature': return forecast.temperature;
      case 'humidity': return forecast.humidity;
      case 'wind_speed': return forecast.windSpeed;
    }
  };

  const getUnit = (): string => {
    switch (metric) {
      case 'temperature': return '°C';
      case 'humidity': return '%';
      case 'wind_speed': return 'km/h';
    }
  };

  const formatTime = (timeStr: string): string => {
    try {
      const date = new Date(timeStr);
      const hours = date.getHours().toString().padStart(2, '0');
      return `${hours}:00`;
    } catch {
      return timeStr.slice(-5);
    }
  };

  const maxPoints = 12;
  const step = Math.ceil(hourlyData.length / maxPoints);
  const sampledData = [];
  for (let i = 0; i < hourlyData.length; i += step) {
    sampledData.push(hourlyData[i]);
  }
  if (sampledData.length > 0 && sampledData[sampledData.length - 1] !== hourlyData[hourlyData.length - 1]) {
    sampledData[sampledData.length - 1] = hourlyData[hourlyData.length - 1];
  }

  const values = sampledData.map(getValues);
  const allValues = hourlyData.map(getValues);
  const minVal = Math.min(...allValues);
  const maxVal = Math.max(...allValues);
  const range = maxVal - minVal || 1;

  const chartW = 360;
  const chartH = 130;
  const padX = 35;
  const padY = 18;
  const plotW = chartW - padX * 2;
  const plotH = chartH - padY * 2;

  const pointCoords = sampledData.map((_, i) => {
    const x = padX + (i / (sampledData.length - 1)) * plotW;
    const y = padY + plotH - ((getValues(sampledData[i]) - minVal) / range) * plotH;
    return [x, y];
  });

  const linePath = catmullRomSpline(pointCoords, 0.5);

  const areaPath = `${linePath} L ${padX + plotW},${padY + plotH} L ${padX},${padY + plotH} Z`;

  const metrics: { key: TrendMetric; label: string; icon: any; color: string }[] = [
    { key: 'temperature', label: '温度', icon: Thermometer, color: '#f97316' },
    { key: 'humidity', label: '湿度', icon: Droplets, color: '#3b82f6' },
    { key: 'wind_speed', label: '风速', icon: Wind, color: '#06b6d4' },
  ];

  const activeColor = metrics.find(m => m.key === metric)?.color || '#8b5cf6';

  const xLabels = [];
  const labelInterval = Math.ceil(sampledData.length / 6);
  for (let i = 0; i < sampledData.length; i += labelInterval) {
    xLabels.push({
      index: i,
      x: padX + (i / (sampledData.length - 1)) * plotW,
      label: formatTime(sampledData[i].time),
    });
  }

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
        <span style={{ fontSize: 12, fontWeight: 600, color: 'var(--text-primary)' }}>
          过去24小时趋势
        </span>
        <div style={{ display: 'flex', gap: 4 }}>
          {metrics.map(m => (
            <button
              key={m.key}
              onClick={() => setMetric(m.key)}
              style={{
                display: 'flex', alignItems: 'center', gap: 3,
                padding: '3px 8px', borderRadius: 6, border: 'none',
                cursor: 'pointer', fontSize: 10,
                background: metric === m.key ? `${m.color}20` : 'transparent',
                color: metric === m.key ? m.color : 'var(--text-tertiary)',
                fontWeight: metric === m.key ? 600 : 400,
                transition: 'all 0.2s',
              }}
            >
              <m.icon size={11} />
              {m.label}
            </button>
          ))}
        </div>
      </div>

      <div style={{
        background: 'var(--bg-secondary)', borderRadius: 10, padding: '10px 6px',
      }}>
        <svg viewBox={`0 0 ${chartW} ${chartH}`} width="100%" style={{ display: 'block' }}>
          {[0, 0.25, 0.5, 0.75, 1].map(ratio => {
            const y = padY + plotH * (1 - ratio);
            const val = minVal + range * ratio;
            return (
              <g key={ratio}>
                <line x1={padX} y1={y} x2={padX + plotW} y2={y}
                  stroke="var(--border-light)" strokeWidth={0.5} strokeDasharray="3,3" />
                <text x={padX - 6} y={y + 3} textAnchor="end"
                  fill="var(--text-tertiary)" fontSize={8}>
                  {Math.round(val)}{getUnit()}
                </text>
              </g>
            );
          })}

          <path d={areaPath} fill={`${activeColor}12`} />
          <path d={linePath} fill="none" stroke={activeColor} strokeWidth={2}
            strokeLinejoin="round" strokeLinecap="round" />

          {sampledData.map((_, i) => {
            const [x, y] = pointCoords[i];
            const isCurrent = i === sampledData.length - 1;
            return (
              <g key={i}>
                <circle cx={x} cy={y} r={isCurrent ? 4 : 2.5}
                  fill={isCurrent ? activeColor : 'var(--bg-primary)'}
                  stroke={activeColor} strokeWidth={isCurrent ? 2 : 1.2} />
                {isCurrent && (
                  <circle cx={x} cy={y} r={7} fill={`${activeColor}20`} />
                )}
              </g>
            );
          })}

          {xLabels.map(({ x, label }, idx) => (
            <text key={idx} x={x} y={chartH - 5} textAnchor="middle"
              fill="var(--text-tertiary)" fontSize={7.5}>
              {label}
            </text>
          ))}
        </svg>
      </div>

      <div style={{
        display: 'flex', gap: 10, padding: '2px 0',
      }}>
        <div style={{
          flex: 1, padding: '8px 10px', borderRadius: 8,
          background: 'var(--bg-secondary)', textAlign: 'center',
        }}>
          <div style={{ fontSize: 8, color: 'var(--text-tertiary)', marginBottom: 2 }}>平均</div>
          <div style={{ fontSize: 12, fontWeight: 600, color: 'var(--text-primary)' }}>
            {Math.round(allValues.reduce((a, b) => a + b, 0) / allValues.length)}{getUnit()}
          </div>
        </div>
        <div style={{
          flex: 1, padding: '8px 10px', borderRadius: 8,
          background: 'var(--bg-secondary)', textAlign: 'center',
        }}>
          <div style={{ fontSize: 8, color: 'var(--text-tertiary)', marginBottom: 2 }}>最高</div>
          <div style={{ fontSize: 12, fontWeight: 600, color: '#ef4444' }}>
            {maxVal}{getUnit()}
          </div>
        </div>
        <div style={{
          flex: 1, padding: '8px 10px', borderRadius: 8,
          background: 'var(--bg-secondary)', textAlign: 'center',
        }}>
          <div style={{ fontSize: 8, color: 'var(--text-tertiary)', marginBottom: 2 }}>最低</div>
          <div style={{ fontSize: 12, fontWeight: 600, color: '#3b82f6' }}>
            {minVal}{getUnit()}
          </div>
        </div>
      </div>
    </div>
  );
};

export default WeatherTrendChart;
