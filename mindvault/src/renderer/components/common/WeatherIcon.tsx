import React, { useEffect } from 'react';
import { getWeatherCategory, type WeatherCategory } from '../../../shared/weather-constants';

interface WeatherIconProps {
  code: number;
  isDay: boolean;
  size?: number;
}

let keyframesInjected = false;

const injectKeyframes = () => {
  if (keyframesInjected) return;
  if (document.getElementById('weather-icon-keyframes')) return;
  const style = document.createElement('style');
  style.id = 'weather-icon-keyframes';
  style.textContent = `
@keyframes weatherSunPulse {
  0%, 100% { transform: scale(1); opacity: 0.3; }
  50% { transform: scale(1.3); opacity: 0.08; }
}
@keyframes weatherSunRotate {
  from { transform: rotate(0deg); }
  to { transform: rotate(360deg); }
}
@keyframes weatherStarTwinkle {
  0%, 100% { opacity: 0.3; transform: scale(0.7); }
  50% { opacity: 1; transform: scale(1.1); }
}
@keyframes weatherCloudDrift {
  0%, 100% { transform: translateX(0); }
  50% { transform: translateX(1.5px); }
}
@keyframes weatherRainDrop {
  0% { transform: translateY(0); opacity: 0.9; }
  100% { transform: translateY(8px); opacity: 0; }
}
@keyframes weatherSnowFall {
  0% { transform: translateY(0) translateX(0); opacity: 0.9; }
  50% { transform: translateY(5px) translateX(1px); }
  100% { transform: translateY(10px) translateX(-0.5px); opacity: 0.1; }
}
@keyframes weatherThunderFlash {
  0%, 80%, 100% { opacity: 0; }
  85% { opacity: 1; }
  90% { opacity: 0.1; }
  95% { opacity: 0.9; }
}
@keyframes weatherFogDrift {
  0%, 100% { transform: translateX(-1px); opacity: 0.4; }
  50% { transform: translateX(2px); opacity: 0.7; }
}`;
  document.head.appendChild(style);
  keyframesInjected = true;
};

const CloudShape: React.FC<{ color: string; x?: number; y?: number; scale?: number; style?: React.CSSProperties }> = ({
  color, x = 0, y = 0, scale = 1, style
}) => (
  <g transform={`translate(${x}, ${y}) scale(${scale})`} style={style}>
    <ellipse cx="20" cy="14" rx="8" ry="7" fill={color} />
    <ellipse cx="30" cy="10" rx="10" ry="9" fill={color} />
    <ellipse cx="40" cy="14" rx="7" ry="6" fill={color} />
    <rect x="12" y="14" width="28" height="8" rx="4" fill={color} />
  </g>
);

const RainDrops: React.FC<{ count: number; color?: string }> = ({ count, color = '#60a5fa' }) => (
  <>
    {Array.from({ length: count }).map((_, i) => (
      <line
        key={i}
        x1={18 + i * 8}
        y1={24}
        x2={16 + i * 8}
        y2={30}
        stroke={color}
        strokeWidth={1.5}
        strokeLinecap="round"
        style={{ animation: `weatherRainDrop 0.8s ease-in ${i * 0.15}s infinite` }}
      />
    ))}
  </>
);

const SnowFlakes: React.FC<{ count: number; color?: string }> = ({ count, color = '#e0e7ff' }) => (
  <>
    {Array.from({ length: count }).map((_, i) => (
      <circle
        key={i}
        cx={18 + i * 7}
        cy={26}
        r={1.5}
        fill={color}
        style={{ animation: `weatherSnowFall 1.5s ease-in ${i * 0.3}s infinite` }}
      />
    ))}
  </>
);

const renderers: Record<WeatherCategory, () => React.ReactNode> = {
  sun: () => (
    <svg viewBox="0 0 48 48" width="40" height="40">
      <circle cx="24" cy="24" r="6" fill="#fbbf24" />
      <circle cx="24" cy="24" r="10" fill="#fbbf24" opacity={0.15} style={{ animation: 'weatherSunPulse 3s ease-in-out infinite' }} />
      <g style={{ animation: 'weatherSunRotate 20s linear infinite', transformOrigin: '24px 24px' }}>
        {[0, 45, 90, 135, 180, 225, 270, 315].map(angle => (
          <line
            key={angle}
            x1="24" y1="10" x2="24" y2="6"
            stroke="#fbbf24" strokeWidth={2} strokeLinecap="round"
            transform={`rotate(${angle} 24 24)`}
          />
        ))}
      </g>
    </svg>
  ),

  moon: () => (
    <svg viewBox="0 0 48 48" width="40" height="40">
      <circle cx="22" cy="20" r="10" fill="#fde68a" />
      <circle cx="26" cy="16" r="8" fill="#1e293b" />
      <circle cx="34" cy="12" r="1.5" fill="#fde68a" style={{ animation: 'weatherStarTwinkle 2s ease-in-out infinite' }} />
      <circle cx="36" cy="20" r="1" fill="#fde68a" style={{ animation: 'weatherStarTwinkle 2.5s ease-in-out infinite 0.5s' }} />
      <circle cx="32" cy="28" r="1" fill="#fde68a" style={{ animation: 'weatherStarTwinkle 3s ease-in-out infinite 1s' }} />
    </svg>
  ),

  cloud: () => (
    <svg viewBox="0 0 48 48" width="40" height="40">
      <circle cx="16" cy="14" r="5" fill="#fbbf24" opacity={0.6} />
      <g style={{ animation: 'weatherCloudDrift 4s ease-in-out infinite' }}>
        <CloudShape color="#cbd5e1" x={4} y={10} scale={0.8} />
        <CloudShape color="#e2e8f0" x={8} y={14} scale={1} />
      </g>
    </svg>
  ),

  overcast: () => (
    <svg viewBox="0 0 48 48" width="40" height="40">
      <g style={{ animation: 'weatherCloudDrift 5s ease-in-out infinite' }}>
        <CloudShape color="#94a3b8" x={2} y={8} scale={0.7} />
        <CloudShape color="#cbd5e1" x={6} y={14} scale={1} />
      </g>
    </svg>
  ),

  rain: () => (
    <svg viewBox="0 0 48 48" width="40" height="40">
      <g style={{ animation: 'weatherCloudDrift 4s ease-in-out infinite' }}>
        <CloudShape color="#94a3b8" x={6} y={8} scale={0.9} />
      </g>
      <RainDrops count={3} />
    </svg>
  ),

  heavyRain: () => (
    <svg viewBox="0 0 48 48" width="40" height="40">
      <g style={{ animation: 'weatherCloudDrift 4s ease-in-out infinite' }}>
        <CloudShape color="#64748b" x={6} y={6} scale={0.9} />
      </g>
      <RainDrops count={4} color="#3b82f6" />
    </svg>
  ),

  snow: () => (
    <svg viewBox="0 0 48 48" width="40" height="40">
      <g style={{ animation: 'weatherCloudDrift 4s ease-in-out infinite' }}>
        <CloudShape color="#94a3b8" x={6} y={8} scale={0.9} />
      </g>
      <SnowFlakes count={3} />
    </svg>
  ),

  thunder: () => (
    <svg viewBox="0 0 48 48" width="40" height="40">
      <g style={{ animation: 'weatherCloudDrift 4s ease-in-out infinite' }}>
        <CloudShape color="#475569" x={6} y={6} scale={0.9} />
      </g>
      <polygon points="22,22 18,30 23,30 19,38 28,28 23,28 27,22" fill="#fbbf24" style={{ animation: 'weatherThunderFlash 3s ease-in-out infinite' }} />
    </svg>
  ),

  fog: () => (
    <svg viewBox="0 0 48 48" width="40" height="40">
      {[0, 6, 12].map((offset, i) => (
        <line
          key={i}
          x1={8 + i * 2} y1={14 + offset}
          x2={38 - i * 2} y2={14 + offset}
          stroke="#94a3b8"
          strokeWidth={3}
          strokeLinecap="round"
          opacity={0.6 - i * 0.15}
          style={{ animation: `weatherFogDrift ${3 + i * 0.5}s ease-in-out infinite ${i * 0.5}s` }}
        />
      ))}
    </svg>
  ),

  sleet: () => (
    <svg viewBox="0 0 48 48" width="40" height="40">
      <g style={{ animation: 'weatherCloudDrift 4s ease-in-out infinite' }}>
        <CloudShape color="#94a3b8" x={6} y={8} scale={0.9} />
      </g>
      <RainDrops count={2} />
      <SnowFlakes count={2} />
    </svg>
  ),

  typhoon: () => (
    <svg viewBox="0 0 48 48" width="40" height="40">
      <g style={{ animation: 'weatherSunRotate 3s linear infinite', transformOrigin: '24px 24px' }}>
        <path d="M24 8c-8 0-14 5-16 12" stroke="#64748b" strokeWidth={3} fill="none" strokeLinecap="round" />
        <path d="M24 40c8 0 14-5 16-12" stroke="#64748b" strokeWidth={3} fill="none" strokeLinecap="round" />
        <path d="M8 24c0 8 5 14 12 16" stroke="#94a3b8" strokeWidth={3} fill="none" strokeLinecap="round" />
        <path d="M40 24c0-8-5-14-12-16" stroke="#94a3b8" strokeWidth={3} fill="none" strokeLinecap="round" />
      </g>
      <circle cx="24" cy="24" r="4" fill="#475569" />
    </svg>
  ),

  sunrise: () => (
    <svg viewBox="0 0 48 48" width="40" height="40">
      <line x1="24" y1="38" x2="24" y2="44" stroke="#94a3b8" strokeWidth={1.5} />
      <line x1="8" y1="38" x2="40" y2="38" stroke="#94a3b8" strokeWidth={1.5} />
      <circle cx="24" cy="28" r="6" fill="#fbbf24" />
      <g>
        {[0, 45, 90, 135, 180, 225, 270, 315].filter(a => a >= 180).map(angle => (
          <line
            key={angle}
            x1="24" y1="20" x2="24" y2="17"
            stroke="#fbbf24" strokeWidth={1.5} strokeLinecap="round"
            transform={`rotate(${angle} 24 28)`}
          />
        ))}
      </g>
      <path d="M16 38 L20 32 L24 36 L28 30 L32 38" fill="#fbbf24" opacity={0.3} />
    </svg>
  ),

  sunset: () => (
    <svg viewBox="0 0 48 48" width="40" height="40">
      <line x1="24" y1="38" x2="24" y2="44" stroke="#94a3b8" strokeWidth={1.5} />
      <line x1="8" y1="38" x2="40" y2="38" stroke="#94a3b8" strokeWidth={1.5} />
      <circle cx="24" cy="28" r="6" fill="#f97316" />
      <g>
        {[0, 45, 90, 135, 180, 225, 270, 315].filter(a => a >= 180).map(angle => (
          <line
            key={angle}
            x1="24" y1="20" x2="24" y2="17"
            stroke="#f97316" strokeWidth={1.5} strokeLinecap="round"
            transform={`rotate(${angle} 24 28)`}
          />
        ))}
      </g>
      <path d="M16 38 L20 34 L24 37 L28 33 L32 38" fill="#f97316" opacity={0.3} />
    </svg>
  ),

  nightClear: () => (
    <svg viewBox="0 0 48 48" width="40" height="40">
      <circle cx="20" cy="20" r="10" fill="#fde68a" />
      <circle cx="24" cy="16" r="8" fill="#1e293b" />
      <circle cx="34" cy="10" r="1.5" fill="#fde68a" style={{ animation: 'weatherStarTwinkle 2s ease-in-out infinite' }} />
      <circle cx="38" cy="18" r="1" fill="#fde68a" style={{ animation: 'weatherStarTwinkle 2.8s ease-in-out infinite 0.7s' }} />
      <circle cx="36" cy="28" r="1.2" fill="#fde68a" style={{ animation: 'weatherStarTwinkle 3.2s ease-in-out infinite 1.2s' }} />
      <circle cx="30" cy="34" r="0.8" fill="#fde68a" style={{ animation: 'weatherStarTwinkle 2.5s ease-in-out infinite 0.3s' }} />
    </svg>
  ),

  nightRain: () => (
    <svg viewBox="0 0 48 48" width="40" height="40">
      <circle cx="18" cy="12" r="6" fill="#fde68a" opacity={0.5} />
      <circle cx="21" cy="9" r="5" fill="#1e293b" opacity={0.5} />
      <g style={{ animation: 'weatherCloudDrift 4s ease-in-out infinite' }}>
        <CloudShape color="#475569" x={6} y={8} scale={0.9} />
      </g>
      <RainDrops count={3} color="#60a5fa" />
    </svg>
  ),

  nightHeavyRain: () => (
    <svg viewBox="0 0 48 48" width="40" height="40">
      <circle cx="18" cy="12" r="6" fill="#fde68a" opacity={0.4} />
      <circle cx="21" cy="9" r="5" fill="#1e293b" opacity={0.4} />
      <g style={{ animation: 'weatherCloudDrift 4s ease-in-out infinite' }}>
        <CloudShape color="#334155" x={6} y={6} scale={0.9} />
      </g>
      <RainDrops count={4} color="#3b82f6" />
    </svg>
  ),

  nightSnow: () => (
    <svg viewBox="0 0 48 48" width="40" height="40">
      <circle cx="18" cy="12" r="6" fill="#fde68a" opacity={0.5} />
      <circle cx="21" cy="9" r="5" fill="#1e293b" opacity={0.5} />
      <g style={{ animation: 'weatherCloudDrift 4s ease-in-out infinite' }}>
        <CloudShape color="#475569" x={6} y={8} scale={0.9} />
      </g>
      <SnowFlakes count={3} color="#c7d2fe" />
    </svg>
  ),

  nightFog: () => (
    <svg viewBox="0 0 48 48" width="40" height="40">
      <circle cx="18" cy="12" r="6" fill="#fde68a" opacity={0.4} />
      <circle cx="21" cy="9" r="5" fill="#1e293b" opacity={0.4} />
      {[0, 6, 12].map((offset, i) => (
        <line
          key={i}
          x1={8 + i * 2} y1={16 + offset}
          x2={38 - i * 2} y2={16 + offset}
          stroke="#64748b"
          strokeWidth={3}
          strokeLinecap="round"
          opacity={0.5 - i * 0.12}
          style={{ animation: `weatherFogDrift ${3 + i * 0.5}s ease-in-out infinite ${i * 0.5}s` }}
        />
      ))}
    </svg>
  ),

  rainbow: () => (
    <svg viewBox="0 0 48 48" width="40" height="40">
      <path d="M6 32 A18 18 0 0 1 42 32" fill="none" stroke="#ef4444" strokeWidth={2.5} />
      <path d="M9 32 A15 15 0 0 1 39 32" fill="none" stroke="#f97316" strokeWidth={2.5} />
      <path d="M12 32 A12 12 0 0 1 36 32" fill="none" stroke="#fbbf24" strokeWidth={2.5} />
      <path d="M15 32 A9 9 0 0 1 33 32" fill="none" stroke="#4ade80" strokeWidth={2.5} />
      <path d="M18 32 A6 6 0 0 1 30 32" fill="none" stroke="#60a5fa" strokeWidth={2.5} />
    </svg>
  ),
};

const WeatherIcon: React.FC<WeatherIconProps> = ({ code, isDay, size = 40 }) => {
  useEffect(() => {
    injectKeyframes();
  }, []);

  const category = getWeatherCategory(code, isDay);
  const renderer = renderers[category] || renderers.cloud;

  return (
    <div style={{ width: size, height: size, overflow: 'hidden' }}>
      <div style={{ width: 40, height: 40, transform: `scale(${size / 40})`, transformOrigin: 'top left' }}>
        {renderer()}
      </div>
    </div>
  );
};

export default WeatherIcon;
