/**
 * 天气通知组件 - 半透明磨砂质感设计
 * 
 * 设计特点：
 * 1. 半透明磨砂玻璃效果 (backdrop-filter: blur)
 * 2. 预报通知8秒自动关闭，预警通知需手动关闭
 * 3. 弹性动画 (spring)
 * 4. 圆角卡片、图标+标题+内容排版
 */

import React, { useEffect, useState, useCallback } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { Cloud, Sun, CloudRain, CloudSnow, Wind, AlertTriangle, X, MapPin, Thermometer, Droplets } from 'lucide-react';
import type { WeatherForecast, WeatherAlert } from '../../utils/weatherAlert';

interface WeatherNotificationProps {
  type: 'forecast' | 'alert';
  forecast?: WeatherForecast;
  alert?: WeatherAlert;
  tip?: string;
  visible: boolean;
  onClose: () => void;
  onClick: () => void;
}

const AUTO_CLOSE_DELAY_FORECAST = 8000;
const AUTO_CLOSE_DELAY_ALERT = 5000;

// 天气图标映射
const getWeatherIcon = (weatherCode: number, size: number = 20) => {
  if ([51, 53, 55, 61, 63, 65, 66, 67, 80, 81, 82].includes(weatherCode)) {
    return <CloudRain size={size} />;
  }
  if ([71, 73, 75, 77, 85, 86].includes(weatherCode)) {
    return <CloudSnow size={size} />;
  }
  if ([95, 96, 99].includes(weatherCode)) {
    return <Wind size={size} />;
  }
  if ([2, 3, 45, 48].includes(weatherCode)) {
    return <Cloud size={size} />;
  }
  return <Sun size={size} />;
};

// 获取天气描述
const getWeatherDesc = (weatherCode: number) => {
  const labels: Record<number, string> = {
    0: '晴', 1: '大部晴', 2: '多云', 3: '阴',
    45: '雾', 48: '冻雾',
    51: '毛毛雨', 53: '毛毛雨', 55: '大毛毛雨',
    61: '小雨', 63: '中雨', 65: '大雨',
    66: '冻雨', 67: '大冻雨',
    71: '小雪', 73: '中雪', 75: '大雪', 77: '雪粒',
    80: '小阵雨', 81: '中阵雨', 82: '大阵雨',
    85: '小阵雪', 86: '大阵雪',
    95: '雷暴', 96: '雷暴冰雹', 99: '强雷暴冰雹',
  };
  return labels[weatherCode] || '多云';
};

// 判断是否为异常天气
const isAbnormalWeather = (weatherCode: number, maxTemp: number, minTemp: number, windSpeed: number) => {
  const abnormalCodes = [51, 53, 55, 61, 63, 65, 66, 67, 71, 73, 75, 77, 80, 81, 82, 85, 86, 95, 96, 99];
  if (abnormalCodes.includes(weatherCode)) return true;
  if (maxTemp >= 35) return true;
  if (minTemp <= 0) return true;
  if (windSpeed >= 20) return true;
  return false;
};

// 生成生活提示
const generateLifeTip = (forecast: WeatherForecast): string => {
  const { weatherCode, maxTemp, minTemp, windSpeed, precipitationProbability } = forecast;
  
  if ([51, 53, 55, 61, 63, 65, 66, 67, 80, 81, 82].includes(weatherCode)) {
    if (precipitationProbability > 70) return '明天雨势较大，记得带伞，出门穿防滑鞋哦~';
    return '明天有雨，出门记得带伞~';
  }
  if ([71, 73, 75, 77, 85, 86].includes(weatherCode)) {
    return '明天下雪啦，注意保暖，小心路滑~';
  }
  if ([95, 96, 99].includes(weatherCode)) {
    return '明天有雷暴，尽量减少外出，注意安全~';
  }
  if (maxTemp >= 35) return '明天天气炎热，注意防暑降温，多喝水~';
  if (minTemp <= 0) return '明天很冷哦，多穿点衣服，注意保暖~';
  if (windSpeed >= 20) return '明天风大，出门注意防风，小心高空坠物~';
  if (weatherCode === 0 || weatherCode === 1) {
    if (maxTemp >= 28) return '明天阳光明媚，注意防晒哦~';
    return '明天天气不错，适合外出活动~';
  }
  return '明天天气适宜，祝你有个好心情~';
};

// 弹性动画配置
const springAnimation = {
  type: 'spring',
  stiffness: 400,
  damping: 25,
  mass: 0.8,
};

const AlertNotificationContent: React.FC<{
  alert: WeatherAlert;
  progress: number;
  onClose: () => void;
  onClick: () => void;
}> = ({ alert, progress, onClose, onClick }) => {
  return (
    <motion.div
      initial={{ opacity: 0, x: 100, scale: 0.8, y: -20 }}
      animate={{ opacity: 1, x: 0, scale: 1, y: 0 }}
      exit={{ opacity: 0, x: 100, scale: 0.8, y: -20 }}
      transition={springAnimation}
      onClick={onClick}
      style={{
        position: 'fixed',
        top: '90px',
        right: '24px',
        zIndex: 1000,
        cursor: 'pointer',
      }}
    >
      <div
        style={{
          background: 'rgba(255, 255, 255, 0.85)',
          backdropFilter: 'blur(20px) saturate(180%)',
          WebkitBackdropFilter: 'blur(20px) saturate(180%)',
          borderRadius: '20px',
          padding: '0',
          width: '340px',
          boxShadow: '0 25px 50px -12px rgba(0,0,0,0.15), 0 0 0 1px rgba(255,255,255,0.5) inset',
          overflow: 'hidden',
          border: '1px solid rgba(255,255,255,0.6)',
        }}
      >
        <div style={{
          height: '4px',
          background: alert.level === 'extreme' || alert.level === 'high' 
            ? 'linear-gradient(90deg, #ff6b6b, #ff8e8e)' 
            : 'linear-gradient(90deg, #ffa502, #ffc107)',
        }} />

        {/* 进度条 */}
        <div style={{
          height: '2px',
          background: 'rgba(0,0,0,0.05)',
        }}>
          <div style={{
            height: '100%',
            width: `${progress}%`,
            background: alert.level === 'extreme' || alert.level === 'high' 
              ? 'linear-gradient(90deg, #ff6b6b, #ff8e8e)' 
              : 'linear-gradient(90deg, #ffa502, #ffc107)',
            transition: 'width 0.1s linear',
          }} />
        </div>

        <div style={{ padding: '16px 20px' }}>
          <div style={{ display: 'flex', alignItems: 'flex-start', gap: '12px', marginBottom: '12px' }}>
            <div style={{
              width: '40px',
              height: '40px',
              borderRadius: '12px',
              background: alert.level === 'extreme' || alert.level === 'high' 
                ? 'linear-gradient(135deg, #ff6b6b, #ff8e8e)' 
                : 'linear-gradient(135deg, #ffa502, #ffc107)',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              flexShrink: 0,
              color: '#fff',
            }}>
              <AlertTriangle size={20} strokeWidth={2.5} />
            </div>
            <div style={{ flex: 1, minWidth: 0 }}>
              <div style={{ 
                fontWeight: 700, 
                fontSize: '15px', 
                color: '#1f2937',
                marginBottom: '4px',
              }}>
                {alert.title}
              </div>
              <div style={{ 
                fontSize: '13px', 
                color: '#6b7280',
                lineHeight: '1.5',
              }}>
                {alert.message}
              </div>
            </div>
            <button
              onClick={(e) => { e.stopPropagation(); onClose(); }}
              style={{
                background: 'rgba(0,0,0,0.06)',
                border: 'none',
                borderRadius: '8px',
                width: '28px',
                height: '28px',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                cursor: 'pointer',
                color: '#9ca3af',
                flexShrink: 0,
                transition: 'all 0.15s ease',
              }}
              onMouseEnter={(e) => {
                e.currentTarget.style.background = 'rgba(0,0,0,0.1)';
                e.currentTarget.style.color = '#6b7280';
              }}
              onMouseLeave={(e) => {
                e.currentTarget.style.background = 'rgba(0,0,0,0.06)';
                e.currentTarget.style.color = '#9ca3af';
              }}
            >
              <X size={14} />
            </button>
          </div>

          {alert.advice && alert.advice.length > 0 && (
            <div style={{ 
              fontSize: '12px', 
              color: '#4b5563',
              lineHeight: '1.6',
              padding: '10px 12px',
              background: 'rgba(0,0,0,0.03)',
              borderRadius: '10px',
              marginBottom: '12px',
            }}>
              <span style={{ marginRight: '6px' }}>💡</span>
              {alert.advice[0]}
            </div>
          )}

          <div style={{ 
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
          }}>
            <span style={{ 
              fontSize: '11px', 
              color: '#9ca3af',
              fontWeight: 500,
            }}>
              {alert.level === 'extreme' ? '极端预警' : alert.level === 'high' ? '高危预警' : alert.level === 'medium' ? '中等预警' : '一般提醒'}
            </span>
            <button
              onClick={(e) => { e.stopPropagation(); onClick(); }}
              style={{
                background: 'rgba(0,0,0,0.05)',
                border: 'none',
                borderRadius: '8px',
                padding: '6px 12px',
                fontSize: '12px',
                color: '#6b7280',
                cursor: 'pointer',
                fontWeight: 500,
              }}
            >
              查看详情
            </button>
          </div>
        </div>
      </div>
    </motion.div>
  );
};

// 预报通知内容组件
const ForecastNotificationContent: React.FC<{
  forecast: WeatherForecast;
  progress: number;
  onClose: () => void;
  onClick: () => void;
}> = ({ forecast, progress, onClose, onClick }) => {
  const hasAbnormal = isAbnormalWeather(forecast.weatherCode, forecast.maxTemp, forecast.minTemp, forecast.windSpeed);
  const lifeTip = generateLifeTip(forecast);
  
  return (
    <motion.div
      initial={{ opacity: 0, x: 100, scale: 0.8, y: -20 }}
      animate={{ opacity: 1, x: 0, scale: 1, y: 0 }}
      exit={{ opacity: 0, x: 100, scale: 0.8, y: -20 }}
      transition={springAnimation}
      onClick={onClick}
      style={{
        position: 'fixed',
        top: '90px',
        right: '24px',
        zIndex: 1000,
        cursor: 'pointer',
      }}
    >
      {/* 磨砂玻璃卡片 */}
      <div
        style={{
          background: 'rgba(255, 255, 255, 0.85)',
          backdropFilter: 'blur(20px) saturate(180%)',
          WebkitBackdropFilter: 'blur(20px) saturate(180%)',
          borderRadius: '20px',
          padding: '0',
          width: '340px',
          boxShadow: '0 25px 50px -12px rgba(0,0,0,0.15), 0 0 0 1px rgba(255,255,255,0.5) inset',
          overflow: 'hidden',
          border: '1px solid rgba(255,255,255,0.6)',
        }}
      >
        {/* 顶部渐变条 - 根据天气变色 */}
        <div style={{
          height: '4px',
          background: hasAbnormal 
            ? 'linear-gradient(90deg, #f093fb, #f5576c)' 
            : 'linear-gradient(90deg, #4facfe, #00f2fe)',
        }} />

        {/* 进度条 */}
        <div style={{
          height: '2px',
          background: 'rgba(0,0,0,0.05)',
        }}>
          <div style={{
            height: '100%',
            width: `${progress}%`,
            background: hasAbnormal 
              ? 'linear-gradient(90deg, #f093fb, #f5576c)' 
              : 'linear-gradient(90deg, #4facfe, #00f2fe)',
            transition: 'width 0.1s linear',
          }} />
        </div>

        {/* 内容区 */}
        <div style={{ padding: '16px 20px' }}>
          {/* 头部 - 大图标和天气 */}
          <div style={{ display: 'flex', alignItems: 'center', gap: '16px', marginBottom: '16px' }}>
            <div style={{
              width: '56px',
              height: '56px',
              borderRadius: '16px',
              background: 'linear-gradient(135deg, #667eea, #764ba2)',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              flexShrink: 0,
              color: '#fff',
              boxShadow: '0 8px 20px rgba(102, 126, 234, 0.3)',
            }}>
              {getWeatherIcon(forecast.weatherCode, 28)}
            </div>
            <div>
              <div style={{ 
                fontWeight: 700, 
                fontSize: '16px', 
                color: '#1f2937',
                marginBottom: '2px',
              }}>
                明日{getWeatherDesc(forecast.weatherCode)}
              </div>
              <div style={{ 
                fontSize: '28px', 
                fontWeight: 800,
                color: '#1f2937',
                letterSpacing: '-1px',
              }}>
                {forecast.minTemp}° <span style={{ color: '#9ca3af', fontWeight: 400 }}>/</span> {forecast.maxTemp}°
              </div>
            </div>
          </div>

          {/* 天气详情标签 */}
          <div style={{ 
            display: 'flex',
            gap: '8px',
            marginBottom: '14px',
            flexWrap: 'wrap',
          }}>
            {forecast.precipitationProbability > 0 && (
              <div style={{
                display: 'flex',
                alignItems: 'center',
                gap: '4px',
                fontSize: '12px',
                padding: '6px 10px',
                background: 'rgba(79, 172, 254, 0.1)',
                borderRadius: '20px',
                color: '#4facfe',
                fontWeight: 500,
              }}>
                <Droplets size={12} />
                降水 {forecast.precipitationProbability}%
              </div>
            )}
            <div style={{
              display: 'flex',
              alignItems: 'center',
              gap: '4px',
              fontSize: '12px',
              padding: '6px 10px',
              background: 'rgba(0,0,0,0.04)',
              borderRadius: '20px',
              color: '#6b7280',
              fontWeight: 500,
            }}>
              <Wind size={12} />
              风速 {forecast.windSpeed}km/h
            </div>
          </div>

          {/* 生活提示 */}
          <div style={{ 
            fontSize: '13px', 
            color: '#4b5563',
            lineHeight: '1.6',
            padding: '12px 14px',
            background: 'rgba(0,0,0,0.03)',
            borderRadius: '12px',
            marginBottom: '14px',
          }}>
            <span style={{ marginRight: '6px' }}>💡</span>
            {lifeTip}
          </div>

          {/* 底部 */}
          <div style={{ 
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
          }}>
            <span style={{ 
              fontSize: '11px', 
              color: '#9ca3af',
              fontWeight: 500,
            }}>
              {hasAbnormal ? '天气有变化，请注意' : '天气不错，祝您愉快'}
            </span>
            <button
              onClick={(e) => { e.stopPropagation(); onClick(); }}
              style={{
                background: 'linear-gradient(135deg, #667eea, #764ba2)',
                border: 'none',
                borderRadius: '10px',
                padding: '8px 16px',
                fontSize: '12px',
                color: '#fff',
                cursor: 'pointer',
                fontWeight: 600,
                boxShadow: '0 4px 12px rgba(102, 126, 234, 0.3)',
              }}
            >
              完整预报
            </button>
          </div>
        </div>
      </div>
    </motion.div>
  );
};

// 主组件 - 使用 AnimatePresence 包裹
export const WeatherNotification: React.FC<WeatherNotificationProps> = ({
  type,
  forecast,
  alert,
  tip,
  visible,
  onClose,
  onClick,
}) => {
  const [progress, setProgress] = useState(100);
  const [isClosing, setIsClosing] = useState(false);

  const autoCloseDelay = type === 'alert' ? AUTO_CLOSE_DELAY_ALERT : AUTO_CLOSE_DELAY_FORECAST;
  const shouldAutoClose = autoCloseDelay > 0;

  useEffect(() => {
    if (!visible) {
      setProgress(shouldAutoClose ? 100 : 0);
      setIsClosing(false);
      return;
    }

    setProgress(shouldAutoClose ? 100 : 0);
    setIsClosing(false);

    if (!shouldAutoClose) return;

    const startTime = Date.now();
    let animationFrameId: number;
    
    const updateProgress = () => {
      const elapsed = Date.now() - startTime;
      const remaining = Math.max(0, autoCloseDelay - elapsed);
      const newProgress = (remaining / autoCloseDelay) * 100;
      setProgress(newProgress);
      
      if (remaining > 0 && !isClosing) {
        animationFrameId = requestAnimationFrame(updateProgress);
      }
    };
    
    animationFrameId = requestAnimationFrame(updateProgress);
    
    const timer = setTimeout(() => {
      if (!isClosing) {
        setIsClosing(true);
        onClose();
      }
    }, autoCloseDelay);

    return () => {
      clearTimeout(timer);
      if (animationFrameId) {
        cancelAnimationFrame(animationFrameId);
      }
    };
  }, [visible, onClose, isClosing, shouldAutoClose, autoCloseDelay]);

  // 使用 AnimatePresence 包裹，确保退场动画正常执行
  return (
    <AnimatePresence mode="wait">
      {visible && type === 'alert' && alert && (
        <AlertNotificationContent
          key="alert"
          alert={alert}
          progress={progress}
          onClose={onClose}
          onClick={onClick}
        />
      )}
      {visible && type === 'forecast' && forecast && (
        <ForecastNotificationContent
          key="forecast"
          forecast={forecast}
          progress={progress}
          onClose={onClose}
          onClick={onClick}
        />
      )}
    </AnimatePresence>
  );
};

export default WeatherNotification;
