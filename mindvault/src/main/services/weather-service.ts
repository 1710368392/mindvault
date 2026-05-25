/**
 * 主进程天气服务
 *
 * 直接在主进程中调用 Open-Meteo API 获取天气数据，
 * 供 tool-executor 使用，确保 AI 工具能返回真实数据。
 *
 * 同时通过 IPC 通知渲染进程弹出 UI 卡片。
 */

const https = require('https');
const { URL } = require('url');

// ============ 天气常量定义 ============
const WEATHER_LABELS: Record<number, string> = {
  0: '晴', 1: '大部晴', 2: '多云', 3: '阴',
  45: '雾', 48: '冻雾',
  51: '小毛毛雨', 53: '毛毛雨', 55: '大毛毛雨',
  61: '小雨', 63: '中雨', 65: '大雨',
  66: '冻雨', 67: '大冻雨',
  71: '小雪', 73: '中雪', 75: '大雪', 77: '雪粒',
  80: '小阵雨', 81: '中阵雨', 82: '大阵雨',
  85: '小阵雪', 86: '大阵雪',
  95: '雷暴', 96: '雷暴冰雹', 99: '强雷暴冰雹',
};

type WeatherAlertType = 'rain' | 'snow' | 'storm' | 'typhoon' | 'heat' | 'cold' | 'wind';
type WeatherAlertLevel = 'low' | 'medium' | 'high' | 'extreme';

interface WeatherAlertCodeInfo {
  type: WeatherAlertType;
  level: WeatherAlertLevel;
  keyword: string;
}

const WEATHER_ALERT_CODES: Record<number, WeatherAlertCodeInfo> = {
  95: { type: 'storm', level: 'high', keyword: '雷暴' },
  96: { type: 'storm', level: 'extreme', keyword: '雷暴冰雹' },
  99: { type: 'storm', level: 'extreme', keyword: '强雷暴冰雹' },
  65: { type: 'rain', level: 'high', keyword: '大雨' },
  82: { type: 'rain', level: 'high', keyword: '大阵雨' },
  63: { type: 'rain', level: 'medium', keyword: '中雨' },
  81: { type: 'rain', level: 'medium', keyword: '中阵雨' },
  75: { type: 'snow', level: 'high', keyword: '大雪' },
  86: { type: 'snow', level: 'high', keyword: '大阵雪' },
  73: { type: 'snow', level: 'medium', keyword: '中雪' },
  66: { type: 'rain', level: 'high', keyword: '冻雨' },
  67: { type: 'rain', level: 'extreme', keyword: '大冻雨' },
  45: { type: 'rain', level: 'low', keyword: '雾' },
  48: { type: 'rain', level: 'medium', keyword: '冻雾' },
};

// 类型定义
interface WeatherAlert {
  id: string;
  type: WeatherAlertType;
  level: WeatherAlertLevel;
  title: string;
  message: string;
  advice: string[];
  startTime: Date;
}

interface DailyForecast {
  date: string;
  maxTemp: number;
  minTemp: number;
  apparentMaxTemp: number;
  apparentMinTemp: number;
  weatherCode: number;
  weatherLabel: string;
  precipitationProbability: number;
  precipitationSum: number;
  windSpeed: number;
  uvIndex?: number;
  sunrise: string;
  sunset: string;
  visibilityMax: number;
}

interface HourlyForecast {
  time: string;
  temperature: number;
  apparentTemperature: number;
  weatherCode: number;
  precipitationProbability: number;
  windSpeed: number;
  humidity: number;
  uvIndex: number;
  isDay: boolean;
}

// ============ 天气预警工具函数 ============
function generateAlertsFromForecasts(forecasts: DailyForecast[]): WeatherAlert[] {
  const alerts: WeatherAlert[] = [];
  const dayNames = ['今天', '明天'];

  for (let i = 0; i < Math.min(forecasts.length, 2); i++) {
    const day = forecasts[i];
    const dateLabel = dayNames[i] || day.date;

    const alertInfo = WEATHER_ALERT_CODES[day.weatherCode];
    if (alertInfo) {
      alerts.push({
        id: `${day.date}-${alertInfo.type}`,
        type: alertInfo.type,
        level: alertInfo.level,
        title: `${dateLabel}${alertInfo.keyword}预警`,
        message: `${dateLabel}有${alertInfo.keyword}，气温 ${day.minTemp}°C ~ ${day.maxTemp}°C`,
        advice: getAlertAdvice(alertInfo.type, alertInfo.level),
        startTime: new Date(day.date),
      });
    }

    if (day.maxTemp >= 35) {
      alerts.push({
        id: `${day.date}-heat`,
        type: 'heat',
        level: day.maxTemp >= 38 ? 'extreme' : 'high',
        title: `${dateLabel}高温预警`,
        message: `${dateLabel}最高气温 ${day.maxTemp}°C，请注意防暑降温`,
        advice: ['避免在中午户外活动', '多喝水，补充电解质', '穿着透气浅色衣物'],
        startTime: new Date(day.date),
      });
    }

    if (day.minTemp <= 0) {
      alerts.push({
        id: `${day.date}-cold`,
        type: 'cold',
        level: day.minTemp <= -5 ? 'extreme' : 'high',
        title: `${dateLabel}低温预警`,
        message: `${dateLabel}最低气温 ${day.minTemp}°C，请注意保暖`,
        advice: ['穿厚外套注意保暖', '戴手套围巾', '老人小孩减少外出'],
        startTime: new Date(day.date),
      });
    }

    if (day.windSpeed >= 20) {
      alerts.push({
        id: `${day.date}-wind`,
        type: 'wind',
        level: day.windSpeed >= 30 ? 'extreme' : 'high',
        title: `${dateLabel}大风预警`,
        message: `${dateLabel}最大风速 ${day.windSpeed} km/h`,
        advice: ['避免在广告牌大树下停留', '关好门窗收好阳台物品', '减少不必要的外出'],
        startTime: new Date(day.date),
      });
    }
  }

  return alerts;
}

function getAlertAdvice(type: WeatherAlertType, level: WeatherAlertLevel): string[] {
  switch (type) {
    case 'rain':
      return ['出门记得带伞穿防滑鞋', '驾车保持车距减速慢行', ...(level === 'high' || level === 'extreme' ? ['避免前往低洼地带'] : [])];
    case 'snow':
      return ['穿防滑鞋注意脚下安全', '驾车安装防滑链保持低速', ...(level === 'high' || level === 'extreme' ? ['尽量减少外出'] : [])];
    case 'storm':
      return ['避免在空旷地带大树下停留', '关好门窗拔掉电器插头', '减少外出尽快到安全室内'];
    case 'heat':
      return ['避免在中午户外活动', '多喝水，补充电解质', '穿着透气浅色衣物'];
    case 'cold':
      return ['穿厚外套注意保暖', '戴手套围巾', '老人小孩减少外出'];
    case 'wind':
      return ['避免在广告牌大树下停留', '关好门窗收好阳台物品', '减少不必要的外出'];
    default:
      return ['请注意安全'];
  }
}

function getOutfitAdvice(forecast: DailyForecast): string {
  const temp = forecast.maxTemp;
  const code = forecast.weatherCode;
  if ([71, 73, 75, 77, 85, 86].includes(code)) return '今天有雪，建议穿羽绒服、雪地靴';
  if ([51, 53, 55, 61, 63, 65, 66, 67, 80, 81, 82].includes(code)) return '今天有雨，建议穿防水外套带伞';
  if (temp >= 35) return '今天高温炎热，建议穿轻薄透气衣物注意防晒';
  if (temp >= 28) return '今天较热，建议穿短袖短裤注意防晒';
  if (temp >= 20) return '今天温暖舒适，建议穿T恤薄外套';
  if (temp >= 10) return '今天凉爽，建议穿长袖薄毛衣';
  if (temp >= 0) return '今天较冷，建议穿毛衣厚外套';
  return '今天寒冷，建议穿羽绒服保暖内衣';
}

function getActivityAdvice(forecast: DailyForecast, alerts: WeatherAlert[]): string {
  const hasStorm = alerts.some(a => a.type === 'storm');
  const hasHeavyRain = alerts.some(a => a.type === 'rain' && (a.level === 'high' || a.level === 'extreme'));
  if (hasStorm) return '今天有雷暴，建议留在室内';
  if (hasHeavyRain) return '今天有大雨，建议减少外出';
  if (forecast.precipitationProbability < 30 && forecast.maxTemp >= 15 && forecast.maxTemp <= 28) {
    return '今天天气不错，适合户外活动';
  }
  return '建议根据天气情况安排活动';
}

function getHealthAdvice(forecast: DailyForecast, alerts: WeatherAlert[]): string {
  const hasStorm = alerts.some(a => a.type === 'storm');
  if (hasStorm) return '雷暴天气注意关好门窗拔掉电器插头';
  if (forecast.maxTemp >= 35) return '高温天气注意防暑降温多喝水';
  if (forecast.minTemp <= 0) return '寒冷天气注意保暖预防感冒';
  if (forecast.uvIndex != null && forecast.uvIndex >= 8) return '紫外线强，外出请涂抹防晒霜';
  return '天气适宜，保持良好作息适当运动';
}

// ============ HTTP 请求封装 ============

function httpGet(urlStr: string): Promise<any> {
  return new Promise((resolve, reject) => {
    const url = new URL(urlStr);
    const options = {
      hostname: url.hostname,
      path: url.pathname + url.search,
      method: 'GET',
      timeout: 10000,
      headers: { 'User-Agent': 'MindVault/1.0' },
    };

    const req = https.request(options, (res: any) => {
      let data = '';
      res.on('data', (chunk: any) => { data += chunk; });
      res.on('end', () => {
        try {
          resolve(JSON.parse(data));
        } catch (e) {
          reject(new Error('JSON 解析失败'));
        }
      });
    });

    req.on('error', reject);
    req.on('timeout', () => { req.destroy(); reject(new Error('请求超时')); });
    req.end();
  });
}

// ============ 获取用户当前城市坐标 ============

let _cachedCity: { name: string; latitude: number; longitude: number } | null = null;
let _cityCacheTime = 0;
const CITY_CACHE_DURATION = 30 * 60 * 1000;

export function updateCachedCity(city: { name: string; latitude: number; longitude: number }) {
  _cachedCity = city;
  _cityCacheTime = Date.now();
  console.log(`[WeatherService] 城市更新: ${city.name} (${city.latitude}, ${city.longitude})`);
}

async function getCurrentCityCoords(): Promise<{ name: string; latitude: number; longitude: number }> {
  if (_cachedCity && Date.now() - _cityCacheTime < CITY_CACHE_DURATION) {
    return _cachedCity;
  }

  const defaultCity = { name: '北京', latitude: 39.9042, longitude: 116.4074 };

  try {
    const { getMainWindow } = require('../ipc/window');
    const mainWindow = getMainWindow?.();
    if (!mainWindow || mainWindow.isDestroyed()) {
      return _cachedCity || defaultCity;
    }

    const result = await mainWindow.webContents.executeJavaScript(`
      (function() {
        const mode = localStorage.getItem('mindvault-weather-mode');
        const cityStr = localStorage.getItem('mindvault-weather-city');
        if (mode === 'manual' && cityStr) {
          try { return JSON.parse(cityStr); } catch(e) {}
        }
        return null;
      })()
    `);

    if (result && result.latitude && result.longitude) {
      _cachedCity = { name: result.name, latitude: result.latitude, longitude: result.longitude };
      _cityCacheTime = Date.now();
      return _cachedCity;
    }
  } catch (err: any) {
    console.error('[WeatherService] 获取城市坐标失败:', err.message);
  }

  return _cachedCity || defaultCity;
}

// ============ 天气数据获取 ============

/**
 * 获取当前天气
 */
export async function fetchCurrentWeather() {
  try {
    const city = await getCurrentCityCoords();
    const url = `https://api.open-meteo.com/v1/forecast?latitude=${city.latitude}&longitude=${city.longitude}&current=temperature_2m,apparent_temperature,weather_code,wind_speed_10m,relative_humidity_2m,surface_pressure,is_day&timezone=auto`;
    const data = await httpGet(url);
    const current = data.current;
    if (!current) return null;

    return {
      city: city.name,
      temperature: Math.round(current.temperature_2m),
      apparentTemperature: Math.round(current.apparent_temperature),
      weatherCode: current.weather_code,
      weatherLabel: WEATHER_LABELS[current.weather_code] || '未知',
      windSpeed: Math.round(current.wind_speed_10m),
      humidity: current.relative_humidity_2m,
      pressure: Math.round(current.surface_pressure),
      isDay: current.is_day === 1,
    };
  } catch (err: any) {
    console.error('[WeatherService] fetchCurrentWeather error:', err.message);
    return null;
  }
}

/**
 * 获取天气预报
 */
export async function fetchForecast(days: number = 7) {
  try {
    const city = await getCurrentCityCoords();
    const url = `https://api.open-meteo.com/v1/forecast?latitude=${city.latitude}&longitude=${city.longitude}&daily=weather_code,temperature_2m_max,temperature_2m_min,apparent_temperature_max,apparent_temperature_min,precipitation_probability_max,precipitation_sum,wind_speed_10m_max,uv_index_max,sunrise,sunset,visibility_max&timezone=auto&forecast_days=${days}`;
    const data = await httpGet(url);
    const daily = data.daily;
    if (!daily) return null;

    const forecasts = [];
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
    return { city: city.name, forecasts };
  } catch (err: any) {
    console.error('[WeatherService] fetchForecast error:', err.message);
    return null;
  }
}

export async function fetchHourlyForecast(hours: number = 24) {
  try {
    const city = await getCurrentCityCoords();
    const url = `https://api.open-meteo.com/v1/forecast?latitude=${city.latitude}&longitude=${city.longitude}&hourly=temperature_2m,apparent_temperature,weather_code,precipitation_probability,wind_speed_10m,relative_humidity_2m,uv_index,is_day&timezone=auto&forecast_hours=${hours}`;
    const data = await httpGet(url);
    const hourly = data.hourly;
    if (!hourly) return null;

    const forecasts = [];
    for (let i = 0; i < hourly.time.length; i++) {
      forecasts.push({
        time: hourly.time[i],
        temperature: Math.round(hourly.temperature_2m[i]),
        apparentTemperature: Math.round(hourly.apparent_temperature[i]),
        weatherCode: hourly.weather_code[i],
        precipitationProbability: hourly.precipitation_probability[i] || 0,
        windSpeed: Math.round(hourly.wind_speed_10m[i]),
        humidity: hourly.relative_humidity_2m[i],
        uvIndex: hourly.uv_index?.[i] || 0,
        isDay: hourly.is_day?.[i] === 1,
      });
    }
    return { city: city.name, forecasts };
  } catch (err: any) {
    console.error('[WeatherService] fetchHourlyForecast error:', err.message);
    return null;
  }
}

/**
 * 获取空气质量数据
 */
export async function fetchAirQuality() {
  try {
    const city = await getCurrentCityCoords();
    const url = `https://air-quality-api.open-meteo.com/v1/air-quality?latitude=${city.latitude}&longitude=${city.longitude}&current=european_aqi,pm10,pm2_5,carbon_monoxide,nitrogen_dioxide,sulphur_dioxide,ozone&timezone=auto`;
    const data = await httpGet(url);
    const current = data.current;
    if (!current) return null;

    const aqi = current.european_aqi;
    let level = '优';
    let color = '#4ade80';
    if (aqi <= 20) { level = '优'; color = '#4ade80'; }
    else if (aqi <= 40) { level = '良'; color = '#a3e635'; }
    else if (aqi <= 60) { level = '中等'; color = '#facc15'; }
    else if (aqi <= 80) { level = '较差'; color = '#fb923c'; }
    else if (aqi <= 100) { level = '差'; color = '#ef4444'; }
    else { level = '很差'; color = '#a855f7'; }

    return {
      city: city.name,
      aqi: Math.round(aqi),
      level,
      color,
      pm25: Math.round(current.pm2_5 || 0),
      pm10: Math.round(current.pm10 || 0),
      o3: Math.round(current.ozone || 0),
      no2: Math.round(current.nitrogen_dioxide || 0),
    };
  } catch (err: any) {
    console.error('[WeatherService] fetchAirQuality error:', err.message);
    return null;
  }
}

/**
 * 生成天气预警
 */
export async function fetchWeatherAlerts() {
  try {
    const result = await fetchForecast(2);
    if (!result || result.forecasts.length < 2) return { city: '未知', alerts: [] };

    const alerts = generateAlertsFromForecasts(result.forecasts);
    return { city: result.city, alerts };
  } catch (err: any) {
    console.error('[WeatherService] fetchWeatherAlerts error:', err.message);
    return { city: '未知', alerts: [] };
  }
}

/**
 * 生成每日播报
 */
export async function fetchDailyBriefing(type: 'morning' | 'evening' = 'morning') {
  try {
    const forecastResult = await fetchForecast(2);
    if (!forecastResult || forecastResult.forecasts.length < 2) return null;

    const { city, forecasts } = forecastResult;
    const today = forecasts[0];
    const tomorrow = forecasts[1];
    const alertResult = await fetchWeatherAlerts();

    const now = new Date();
    const hour = now.getHours();
    let greeting = type === 'morning'
      ? (hour < 9 ? '早上好' : hour < 12 ? '上午好' : '中午好')
      : (hour < 18 ? '下午好' : hour < 22 ? '晚上好' : '夜深了');

    const outfitAdvice = getOutfitAdvice(today);
    const activityAdvice = getActivityAdvice(today, alertResult.alerts);
    const healthAdvice = getHealthAdvice(today, alertResult.alerts);

    return {
      city,
      greeting: `${greeting}！`,
      today: `${today.weatherLabel}，${today.minTemp}°C ~ ${today.maxTemp}°C，降水概率 ${today.precipitationProbability}%`,
      tomorrow: type === 'evening'
        ? `明天${tomorrow.weatherLabel}，${tomorrow.minTemp}°C ~ ${tomorrow.maxTemp}°C，降水概率 ${tomorrow.precipitationProbability}%`
        : undefined,
      alerts: alertResult.alerts,
      outfitAdvice,
      activityAdvice,
      healthAdvice,
    };
  } catch (err: any) {
    console.error('[WeatherService] fetchDailyBriefing error:', err.message);
    return null;
  }
}

// ============ 辅助函数 ============

export function notifyRenderer(channel: string, data?: any) {
  try {
    const { getMainWindow } = require('../ipc/window');
    const mainWindow = getMainWindow?.();
    if (mainWindow && !mainWindow.isDestroyed()) {
      mainWindow.webContents.send(channel, data);
    }
  } catch (err: any) {
    console.error('[WeatherService] notifyRenderer error:', err.message);
  }
}

/**
 * 清除城市缓存（切换城市后调用）
 */
export function clearCityCache() {
  _cachedCity = null;
  _cityCacheTime = 0;
}
