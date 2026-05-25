/**
 * 天气预警与智能预报系统
 * 
 * 功能：
 * 1. 实时天气监测与异常预警
 * 2. 早晚天气播报生成
 * 3. 出行建议与温馨提示
 * 4. AI助手集成接口
 */

import { fetchWeather, getCurrentCity, type City, getWeatherMode } from './weather';
import {
  WEATHER_LABELS,
  WEATHER_ALERT_CODES,
  type WeatherAlertType,
  type WeatherAlertLevel,
  type WeatherAlert,
  type DailyBriefing,
  type UserWeatherPreference,
  type DailyForecast,
} from '../../shared/weather-constants';
import {
  generateAlertsFromForecasts as sharedGenerateAlerts,
  getOutfitAdvice as sharedGetOutfitAdvice,
  getActivityAdvice as sharedGetActivityAdvice,
  getHealthAdvice as sharedGetHealthAdvice,
} from '../../shared/weather-alert-utils';

export type WeatherForecast = DailyForecast;

export {
  type WeatherAlert,
  type DailyBriefing,
  type UserWeatherPreference,
  type WeatherAlertType,
  type WeatherAlertLevel,
};

const PREF_KEY = 'mindvault-weather-preference';

export function getUserPreference(): UserWeatherPreference {
  try {
    const saved = localStorage.getItem(PREF_KEY);
    if (saved) {
      return JSON.parse(saved);
    }
  } catch { /* ignore */ }
  
  // 默认设置
  return {
    enableAlerts: true,
    alertThreshold: 'medium',
    enableMorningBriefing: true,
    morningBriefingTime: '08:00',
    enableEveningBriefing: true,
    eveningBriefingTime: '21:00',
    lastMorningBriefing: '',
    lastEveningBriefing: '',
    dismissedAlerts: [],
  };
}

export function saveUserPreference(pref: UserWeatherPreference): void {
  try {
    localStorage.setItem(PREF_KEY, JSON.stringify(pref));
  } catch { /* ignore */ }
}

// ============ 预报数据获取 ============

export async function fetchWeatherForecast(city?: City): Promise<WeatherForecast[] | null> {
  try {
    let targetCity = city;
    if (!targetCity) {
      const { city: currentCity } = await getCurrentCity();
      targetCity = currentCity || { name: '北京', latitude: 39.9042, longitude: 116.4074 };
    }
    
    const url = `https://api.open-meteo.com/v1/forecast?latitude=${targetCity.latitude}&longitude=${targetCity.longitude}&daily=weather_code,temperature_2m_max,temperature_2m_min,apparent_temperature_max,apparent_temperature_min,precipitation_probability_max,precipitation_sum,wind_speed_10m_max,uv_index_max,sunrise,sunset,visibility_max&timezone=auto&forecast_days=7`;
    
    const res = await fetch(url);
    if (!res.ok) return null;
    
    const data = await res.json();
    const daily = data.daily;
    
    const forecasts: WeatherForecast[] = [];
    for (let i = 0; i < daily.time.length; i++) {
      forecasts.push({
        date: daily.time[i],
        maxTemp: Math.round(daily.temperature_2m_max[i]),
        minTemp: Math.round(daily.temperature_2m_min[i]),
        apparentMaxTemp: Math.round(daily.apparent_temperature_max[i]),
        apparentMinTemp: Math.round(daily.apparent_temperature_min[i]),
        weatherCode: daily.weather_code[i],
        weatherLabel: WEATHER_LABELS[daily.weather_code[i]] || '未知',
        precipitationProbability: daily.precipitation_probability_max[i] || 0,
        precipitationSum: daily.precipitation_sum?.[i] || 0,
        windSpeed: Math.round(daily.wind_speed_10m_max[i]),
        uvIndex: daily.uv_index_max?.[i],
        sunrise: daily.sunrise?.[i] || '',
        sunset: daily.sunset?.[i] || '',
        visibilityMax: daily.visibility_max?.[i] || 0,
      });
    }
    
    return forecasts;
  } catch (error) {
    console.error('[WeatherAlert] Failed to fetch forecast:', error);
    return null;
  }
}

// ============ 预警生成 ============

export function generateWeatherAlerts(forecasts: WeatherForecast[]): WeatherAlert[] {
  const pref = getUserPreference();
  if (!forecasts || forecasts.length === 0) return [];

  const allAlerts = sharedGenerateAlerts(forecasts);

  const levelPriority: Record<string, number> = { low: 1, medium: 2, high: 3, extreme: 4 };
  const thresholdPriority = levelPriority[pref.alertThreshold] || 1;

  return allAlerts.filter(alert => {
    const alertPriority = levelPriority[alert.level] || 1;
    return alertPriority >= thresholdPriority;
  });
}

// ============ 早晚播报生成 ============

export async function generateDailyBriefing(type: 'morning' | 'evening'): Promise<DailyBriefing | null> {
  const forecasts = await fetchWeatherForecast();
  if (!forecasts || forecasts.length < 2) return null;
  
  const today = forecasts[0];
  const tomorrow = forecasts[1];
  const alerts = generateWeatherAlerts(forecasts);
  
  const { city } = await getCurrentCity();
  const cityName = city?.name || '当前位置';
  
  // 生成问候语
  const now = new Date();
  const hour = now.getHours();
  let greeting = '';
  
  if (type === 'morning') {
    if (hour < 9) greeting = '早上好';
    else if (hour < 12) greeting = '上午好';
    else greeting = '中午好';
  } else {
    if (hour < 18) greeting = '下午好';
    else if (hour < 22) greeting = '晚上好';
    else greeting = '夜深了';
  }
  
  // 生成天气描述
  const currentWeather = `${cityName}今天${today.weatherLabel}，气温 ${today.minTemp}°C ~ ${today.maxTemp}°C`;
  const todayForecast = `今天${today.weatherLabel}，最高 ${today.maxTemp}°C，最低 ${today.minTemp}°C，降水概率 ${today.precipitationProbability}%`;
  const tomorrowForecast = `明天${tomorrow.weatherLabel}，最高 ${tomorrow.maxTemp}°C，最低 ${tomorrow.minTemp}°C，降水概率 ${tomorrow.precipitationProbability}%`;
  
  // 生成穿衣建议
  const outfitAdvice = sharedGetOutfitAdvice(today);
  
  // 生成活动建议
  const activityAdvice = sharedGetActivityAdvice(today, alerts);
  
  // 生成健康建议
  const healthAdvice = sharedGetHealthAdvice(today, alerts);
  
  return {
    type,
    greeting: `${greeting}！`,
    currentWeather,
    todayForecast,
    tomorrowForecast: type === 'evening' ? tomorrowForecast : undefined,
    alerts: alerts.filter(a => !getUserPreference().dismissedAlerts.includes(a.id)),
    outfitAdvice,
    activityAdvice,
    healthAdvice,
  };
}

// ============ 检查是否需要播报 ============

export function shouldShowBriefing(type: 'morning' | 'evening'): boolean {
  const pref = getUserPreference();
  const now = new Date();
  const currentTime = `${String(now.getHours()).padStart(2, '0')}:${String(now.getMinutes()).padStart(2, '0')}`;
  const today = now.toISOString().split('T')[0];
  
  if (type === 'morning') {
    if (!pref.enableMorningBriefing) return false;
    if (pref.lastMorningBriefing === today) return false;
    return currentTime >= pref.morningBriefingTime;
  } else {
    if (!pref.enableEveningBriefing) return false;
    if (pref.lastEveningBriefing === today) return false;
    return currentTime >= pref.eveningBriefingTime;
  }
}

export function markBriefingShown(type: 'morning' | 'evening'): void {
  const pref = getUserPreference();
  const today = new Date().toISOString().split('T')[0];
  
  if (type === 'morning') {
    pref.lastMorningBriefing = today;
  } else {
    pref.lastEveningBriefing = today;
  }
  
  saveUserPreference(pref);
}

// ============ 预警检查（定时调用） ============

export async function checkWeatherAlerts(): Promise<WeatherAlert[]> {
  const pref = getUserPreference();
  if (!pref.enableAlerts) return [];
  
  const forecasts = await fetchWeatherForecast();
  if (!forecasts) return [];
  
  const alerts = generateWeatherAlerts(forecasts);
  return alerts.filter(a => !pref.dismissedAlerts.includes(a.id));
}

export function dismissAlert(alertId: string): void {
  const pref = getUserPreference();
  if (!pref.dismissedAlerts.includes(alertId)) {
    pref.dismissedAlerts.push(alertId);
    saveUserPreference(pref);
  }
}

// ============ AI助手接口 ============

export interface WeatherCommand {
  action: 'query' | 'set_city' | 'toggle_alerts' | 'set_briefing_time' | 'get_forecast';
  params?: Record<string, any>;
}

export async function handleWeatherCommand(command: WeatherCommand): Promise<string> {
  switch (command.action) {
    case 'query':
      const current = await fetchWeather();
      if (!current) return '抱歉，暂时无法获取天气信息';
      return `当前天气：${current.cityName || '当前位置'} ${current.temperature} ${current.label}`;
    
    case 'get_forecast':
      const forecast = await fetchWeatherForecast();
      if (!forecast) return '抱歉，暂时无法获取预报信息';
      const today = forecast[0];
      const tomorrow = forecast[1];
      return `今天：${today.weatherLabel}，${today.minTemp}°C~${today.maxTemp}°C\n明天：${tomorrow.weatherLabel}，${tomorrow.minTemp}°C~${tomorrow.maxTemp}°C`;
    
    case 'toggle_alerts':
      const pref = getUserPreference();
      pref.enableAlerts = !pref.enableAlerts;
      saveUserPreference(pref);
      return `天气预警已${pref.enableAlerts ? '开启' : '关闭'}`;
    
    case 'set_briefing_time':
      const { type, time } = command.params || {};
      if (!type || !time) return '请指定播报类型和时间，例如：设置早上播报时间为08:00';
      const p = getUserPreference();
      if (type === 'morning') {
        p.morningBriefingTime = time;
      } else {
        p.eveningBriefingTime = time;
      }
      saveUserPreference(p);
      return `已设置${type === 'morning' ? '早上' : '晚上'}播报时间为${time}`;
    
    default:
      return '暂不支持该操作';
  }
}
