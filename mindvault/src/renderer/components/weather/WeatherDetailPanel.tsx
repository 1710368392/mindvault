import React, { useEffect, useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { X, Droplets, Wind, Eye, Gauge, Thermometer, Sun, Sunrise, Sunset, ChevronRight, Cloud } from 'lucide-react';
import { useWeatherStore } from '../../stores/weatherStore';
import { WEATHER_LABELS, WEATHER_ICON_MAP } from '../../../shared/weather-constants';
import WeatherIcon from '../common/WeatherIcon';
import WeatherTrendChart from './WeatherTrendChart';
import CityManager from './CityManager';

const WeatherDetailPanel: React.FC = () => {
  const weather = useWeatherStore((s) => s.weather);
  const forecast = useWeatherStore((s) => s.forecast);
  const hourlyForecast = useWeatherStore((s) => s.hourlyForecast);
  const airQuality = useWeatherStore((s) => s.airQuality);
  const loadForecast = useWeatherStore((s) => s.loadForecast);
  const loadHourlyForecast = useWeatherStore((s) => s.loadHourlyForecast);
  const loadAirQuality = useWeatherStore((s) => s.loadAirQuality);

  useEffect(() => {
    if (!forecast) loadForecast();
    if (!hourlyForecast) loadHourlyForecast();
    if (!airQuality) loadAirQuality();
  }, []);

  if (!weather) return null;

  const today = forecast?.[0];
  const sunrise = today?.sunrise ? new Date(today.sunrise) : null;
  const sunset = today?.sunset ? new Date(today.sunset) : null;

  const formatTime = (date: Date) =>
    `${date.getHours().toString().padStart(2, '0')}:${date.getMinutes().toString().padStart(2, '0')}`;

  const getDayLabel = (dateStr: string, idx: number) => {
    if (idx === 0) return '今天';
    if (idx === 1) return '明天';
    const d = new Date(dateStr);
    const weekdays = ['周日', '周一', '周二', '周三', '周四', '周五', '周六'];
    return weekdays[d.getDay()];
  };

  const getHourLabel = (timeStr: string) => {
    const d = new Date(timeStr);
    return `${d.getHours().toString().padStart(2, '0')}:00`;
  };

  const getUvLevel = (uv: number) => {
    if (uv <= 2) return { label: '低', color: '#4ade80' };
    if (uv <= 5) return { label: '中等', color: '#facc15' };
    if (uv <= 7) return { label: '高', color: '#fb923c' };
    if (uv <= 10) return { label: '很高', color: '#ef4444' };
    return { label: '极高', color: '#a855f7' };
  };

  const uvInfo = today?.uvIndex != null ? getUvLevel(today.uvIndex) : null;

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 16, padding: '8px 0' }}>

      {/* 当前天气大卡片 */}
      <div style={{
        background: 'linear-gradient(135deg, rgba(var(--primary-rgb, 139,92,246), 0.12) 0%, rgba(var(--primary-rgb, 139,92,246), 0.04) 100%)',
        borderRadius: 12,
        padding: '16px 20px',
        display: 'flex',
        flexDirection: 'column',
        gap: 12,
      }}>
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
            <WeatherIcon code={weather.weatherCode} isDay={weather.isDay} size={48} />
            <div>
              <div style={{ fontSize: 32, fontWeight: 700, color: 'var(--text-primary)', lineHeight: 1.1 }}>
                {weather.temperature}
              </div>
              <div style={{ fontSize: 14, color: 'var(--text-secondary)', marginTop: 4 }}>
                {weather.label}
                {today && (
                  <span style={{ marginLeft: 8, color: 'var(--text-tertiary)' }}>
                    {today.maxTemp}° / {today.minTemp}°
                  </span>
                )}
              </div>
            </div>
          </div>
          {weather.cityName && (
            <div style={{ fontSize: 13, color: 'var(--text-tertiary)' }}>
              📍 {weather.cityName}
            </div>
          )}
        </div>

        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: 8 }}>
          {[
            { icon: Thermometer, label: '体感', value: weather.apparentTemperature, color: '#f97316' },
            { icon: Droplets, label: '湿度', value: weather.humidity, color: '#3b82f6' },
            { icon: Wind, label: '风速', value: weather.windSpeed, color: '#06b6d4' },
            { icon: Gauge, label: '气压', value: weather.pressure, color: '#8b5cf6' },
          ].map(item => (
            <div key={item.label} style={{
              display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 4,
              padding: '8px 0', borderRadius: 8, background: 'rgba(255,255,255,0.04)',
            }}>
              <item.icon size={16} style={{ color: item.color }} />
              <span style={{ fontSize: 11, color: 'var(--text-tertiary)' }}>{item.label}</span>
              <span style={{ fontSize: 13, fontWeight: 600, color: 'var(--text-primary)' }}>{item.value}</span>
            </div>
          ))}
        </div>

        {(uvInfo || airQuality) && (
          <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
            {uvInfo && (
              <div style={{ display: 'flex', alignItems: 'center', gap: 8, padding: '6px 12px', borderRadius: 6, background: 'rgba(255,255,255,0.04)' }}>
                <Sun size={14} style={{ color: uvInfo.color }} />
                <span style={{ fontSize: 11, color: 'var(--text-tertiary)' }}>UV指数</span>
                <span style={{ fontSize: 12, fontWeight: 600, color: uvInfo.color }}>{today!.uvIndex}</span>
                <span style={{ fontSize: 11, color: uvInfo.color }}>{uvInfo.label}</span>
              </div>
            )}
            {airQuality && (
              <div style={{ display: 'flex', alignItems: 'center', gap: 8, padding: '6px 12px', borderRadius: 6, background: 'rgba(255,255,255,0.04)' }}>
                <Cloud size={14} style={{ color: airQuality.color }} />
                <span style={{ fontSize: 11, color: 'var(--text-tertiary)' }}>空气</span>
                <span style={{ fontSize: 12, fontWeight: 600, color: airQuality.color }}>{airQuality.aqi}</span>
                <span style={{ fontSize: 11, color: airQuality.color }}>{airQuality.level}</span>
              </div>
            )}
          </div>
        )}
      </div>

      {/* 日出日落时间线 */}
      {sunrise && sunset && (
        <div style={{
          padding: '12px 16px', borderRadius: 10, background: 'var(--bg-secondary)',
          display: 'flex', alignItems: 'center', justifyContent: 'space-around',
        }}>
          <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 4 }}>
            <Sunrise size={18} style={{ color: '#f59e0b' }} />
            <span style={{ fontSize: 9, color: 'var(--text-tertiary)' }}>日出</span>
            <span style={{ fontSize: 13, fontWeight: 600, color: 'var(--text-primary)' }}>{formatTime(sunrise)}</span>
          </div>
          <div style={{
            flex: 1, height: 2, margin: '0 12px',
            background: 'linear-gradient(90deg, #f59e0b, #8b5cf6, #3b82f6)',
            borderRadius: 1, position: 'relative',
          }}>
            <div style={{
              position: 'absolute', top: -4,
              left: `${Math.min(100, Math.max(0, (() => {
                const now = new Date();
                const dayMs = sunset.getTime() - sunrise.getTime();
                if (dayMs <= 0) return 50;
                const elapsed = now.getTime() - sunrise.getTime();
                return (elapsed / dayMs) * 100;
              })()))}%`,
              transform: 'translateX(-50%)',
              width: 10, height: 10, borderRadius: '50%',
              background: '#fbbf24', boxShadow: '0 0 6px rgba(251,191,36,0.6)',
            }} />
          </div>
          <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 4 }}>
            <Sunset size={18} style={{ color: '#6366f1' }} />
            <span style={{ fontSize: 9, color: 'var(--text-tertiary)' }}>日落</span>
            <span style={{ fontSize: 13, fontWeight: 600, color: 'var(--text-primary)' }}>{formatTime(sunset)}</span>
          </div>
        </div>
      )}

      {/* 24小时逐时预报 */}
      {hourlyForecast && hourlyForecast.length > 0 && (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
          <div style={{ fontSize: 12, fontWeight: 600, color: 'var(--text-primary)', paddingLeft: 4 }}>
            24小时预报
          </div>
          <div style={{
            display: 'flex', gap: 6, overflowX: 'auto', paddingBottom: 4,
            scrollbarWidth: 'thin',
          }}>
            {hourlyForecast.map((h, idx) => {
              const iconInfo = WEATHER_ICON_MAP[h.weatherCode];
              const emoji = iconInfo ? (h.isDay ? iconInfo.day.emoji : iconInfo.night.emoji) : '🌡️';
              return (
                <div key={h.time} style={{
                  display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 4,
                  padding: '8px 6px', borderRadius: 8, minWidth: 52,
                  background: idx === 0 ? 'rgba(var(--primary-rgb, 139,92,246), 0.1)' : 'var(--bg-secondary)',
                  border: idx === 0 ? '1px solid rgba(var(--primary-rgb, 139,92,246), 0.2)' : '1px solid transparent',
                }}>
                  <span style={{ fontSize: 9, color: idx === 0 ? 'var(--primary-color)' : 'var(--text-tertiary)' }}>
                    {idx === 0 ? '现在' : getHourLabel(h.time)}
                  </span>
                  <span style={{ fontSize: 16 }}>{emoji}</span>
                  <span style={{ fontSize: 11, fontWeight: 600, color: 'var(--text-primary)' }}>{h.temperature}°</span>
                  {h.precipitationProbability > 0 && (
                    <span style={{ fontSize: 8, color: '#3b82f6' }}>{h.precipitationProbability}%</span>
                  )}
                </div>
              );
            })}
          </div>
        </div>
      )}

      {/* 7天预报 */}
      {forecast && forecast.length > 0 && (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
          <div style={{ fontSize: 12, fontWeight: 600, color: 'var(--text-primary)', paddingLeft: 4 }}>
            7天预报
          </div>
          {forecast.map((day, idx) => {
            const iconInfo = WEATHER_ICON_MAP[day.weatherCode];
            const emoji = iconInfo ? iconInfo.day.emoji : '🌡️';
            const tempRange = day.maxTemp - day.minTemp;
            const maxAll = Math.max(...forecast.map(d => d.maxTemp));
            const minAll = Math.min(...forecast.map(d => d.minTemp));
            const range = maxAll - minAll || 1;
            const barLeft = ((day.minTemp - minAll) / range) * 100;
            const barWidth = Math.max(8, (tempRange / range) * 100);

            return (
              <div key={day.date} style={{
                display: 'flex', alignItems: 'center', gap: 8,
                padding: '6px 10px', borderRadius: 6,
                background: idx === 0 ? 'rgba(var(--primary-rgb, 139,92,246), 0.06)' : 'transparent',
              }}>
                <span style={{ fontSize: 10, color: idx === 0 ? 'var(--primary-color)' : 'var(--text-secondary)', width: 32, flexShrink: 0 }}>
                  {getDayLabel(day.date, idx)}
                </span>
                <span style={{ fontSize: 14, flexShrink: 0 }}>{emoji}</span>
                {day.precipitationProbability > 20 && (
                  <span style={{ fontSize: 8, color: '#3b82f6', width: 24, flexShrink: 0 }}>
                    {day.precipitationProbability}%
                  </span>
                )}
                {day.precipitationProbability <= 20 && <span style={{ width: 24, flexShrink: 0 }} />}
                <span style={{ fontSize: 10, color: 'var(--text-tertiary)', width: 24, textAlign: 'right', flexShrink: 0 }}>
                  {day.minTemp}°
                </span>
                <div style={{ flex: 1, height: 4, borderRadius: 2, background: 'var(--bg-tertiary)', position: 'relative', margin: '0 4px' }}>
                  <div style={{
                    position: 'absolute', top: 0, height: '100%', borderRadius: 2,
                    left: `${barLeft}%`, width: `${barWidth}%`,
                    background: `linear-gradient(90deg, #3b82f6, #8b5cf6, #f97316)`,
                  }} />
                </div>
                <span style={{ fontSize: 10, color: 'var(--text-primary)', width: 24, flexShrink: 0, fontWeight: 600 }}>
                  {day.maxTemp}°
                </span>
              </div>
            );
          })}
        </div>
      )}

      {/* 能见度 */}
      {today && today.visibilityMax > 0 && (
        <div style={{
          padding: '10px 16px', borderRadius: 10, background: 'var(--bg-secondary)',
          display: 'flex', alignItems: 'center', gap: 8,
        }}>
          <Eye size={14} style={{ color: '#06b6d4' }} />
          <span style={{ fontSize: 10, color: 'var(--text-tertiary)' }}>能见度</span>
          <span style={{ fontSize: 11, fontWeight: 600, color: 'var(--text-primary)' }}>
            {today.visibilityMax >= 1000 ? `${(today.visibilityMax / 1000).toFixed(1)}km` : `${today.visibilityMax}m`}
          </span>
        </div>
      )}

      {/* 天气趋势图 */}
      <WeatherTrendChart />

      {/* 多城市管理 */}
      <CityManager />
    </div>
  );
};

export default WeatherDetailPanel;
