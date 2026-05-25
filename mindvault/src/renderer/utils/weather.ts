interface WeatherData {
  temperature: number;
  apparentTemperature: number;
  weatherCode: number;
  windSpeed: number;
  humidity: number;
  pressure: number;
  isDay: boolean;
}

interface WeatherDisplay {
  icon: string;
  label: string;
  temperature: string;
  apparentTemperature: string;
  windSpeed: string;
  humidity: string;
  pressure: string;
  weatherCode: number;
  isDay: boolean;
  cityName?: string;
}

export interface City {
  name: string;
  latitude: number;
  longitude: number;
  fullName?: string;
  provinceCode?: string;
  cityCode?: string;
  districtCode?: string;
}

import { WEATHER_LABELS, WEATHER_ICON_MAP } from '../../shared/weather-constants';

export type WeatherMode = 'auto' | 'manual';

function getWeatherInfo(code: number, isDay: boolean): { icon: string; label: string } {
  const entry = WEATHER_ICON_MAP[code];
  if (entry) {
    return isDay ? entry.day : entry.night;
  }
  return { icon: '🌡️', label: WEATHER_LABELS[code] || '未知' };
}

let cachedWeather: { data: WeatherDisplay; timestamp: number } | null = null;
const CACHE_DURATION = 10 * 60 * 1000;

const MODE_KEY = 'mindvault-weather-mode';
const CITY_KEY = 'mindvault-weather-city';
const PRIVACY_KEY = 'mindvault-weather-privacy';

// 默认城市（定位失败时的 fallback）
const DEFAULT_CITY: City = {
  name: '北京',
  latitude: 39.9042,
  longitude: 116.4074,
};

// ========== 隐私设置 ==========

export interface WeatherPrivacySettings {
  showLocationName: boolean; // 是否显示定位地区名
}

/** 获取天气隐私设置 */
export function getWeatherPrivacy(): WeatherPrivacySettings {
  try {
    const saved = localStorage.getItem(PRIVACY_KEY);
    if (saved) return JSON.parse(saved);
  } catch { /* ignore */ }
  return { showLocationName: true };
}

/** 保存天气隐私设置 */
export function saveWeatherPrivacy(settings: WeatherPrivacySettings): void {
  try {
    localStorage.setItem(PRIVACY_KEY, JSON.stringify(settings));
  } catch { /* ignore */ }
}

// ========== 工具函数 ==========

/** 检查坐标是否有效 */
function isValidCoordinate(lat: number | undefined | null, lon: number | undefined | null): boolean {
  return typeof lat === 'number' && typeof lon === 'number' && 
         !isNaN(lat) && !isNaN(lon) && 
         lat !== 0 && lon !== 0;
}

// ========== 模式与城市持久化 ==========

/** 获取当前天气模式（默认 auto） */
export function getWeatherMode(): WeatherMode {
  try {
    const saved = localStorage.getItem(MODE_KEY);
    if (saved === 'manual') return 'manual';
  } catch { /* ignore */ }
  return 'auto';
}

/** 设置天气模式并清除缓存 */
export function setWeatherMode(mode: WeatherMode): void {
  try {
    if (mode === 'auto') {
      localStorage.removeItem(MODE_KEY);
      localStorage.removeItem(CITY_KEY);
    } else {
      localStorage.setItem(MODE_KEY, 'manual');
    }
    cachedWeather = null;
  } catch { /* ignore */ }
}

/** 获取手动设置的城市（仅 manual 模式下有意义） */
function getManualCity(): City | null {
  try {
    const saved = localStorage.getItem(CITY_KEY);
    if (saved) return JSON.parse(saved);
  } catch { /* ignore */ }
  return null;
}

/** 保存手动选择的城市 */
export function saveManualCity(city: City): void {
  try {
    localStorage.setItem(CITY_KEY, JSON.stringify(city));
    localStorage.setItem(MODE_KEY, 'manual');
    cachedWeather = null;
    console.log('[Weather] Saved manual city:', city.name, city.latitude, city.longitude);
  } catch { /* ignore */ }
}

/** 切换回自动定位 */
export function resetToAutoMode(): void {
  setWeatherMode('auto');
  console.log('[Weather] Reset to auto mode');
}

// ========== 天气获取 ==========

/** 根据坐标获取天气数据 */
async function fetchWeatherByCoords(
  latitude: number,
  longitude: number,
  cityName?: string
): Promise<WeatherDisplay | null> {
  try {
    const url = `https://api.open-meteo.com/v1/forecast?latitude=${latitude}&longitude=${longitude}&current=temperature_2m,apparent_temperature,weather_code,wind_speed_10m,relative_humidity_2m,surface_pressure,is_day&timezone=auto`;
    
    console.log('[Weather] Fetching weather for:', cityName || `${latitude},${longitude}`);
    
    const res = await fetch(url);
    if (!res.ok) {
      console.error('[Weather] API response not ok:', res.status);
      return null;
    }

    const json = await res.json();
    const current = json.current;
    if (!current) {
      console.error('[Weather] No current weather data in response');
      return null;
    }

    const data: WeatherData = {
      temperature: Math.round(current.temperature_2m),
      apparentTemperature: Math.round(current.apparent_temperature),
      weatherCode: current.weather_code,
      windSpeed: Math.round(current.wind_speed_10m),
      humidity: current.relative_humidity_2m,
      pressure: Math.round(current.surface_pressure),
      isDay: current.is_day === 1,
    };

    const info = getWeatherInfo(data.weatherCode, data.isDay);

    const display: WeatherDisplay = {
      icon: info.icon,
      label: info.label,
      temperature: `${data.temperature}°C`,
      apparentTemperature: `${data.apparentTemperature}°C`,
      windSpeed: `${data.windSpeed}km/h`,
      humidity: `${data.humidity}%`,
      pressure: `${data.pressure}hPa`,
      weatherCode: data.weatherCode,
      isDay: data.isDay,
      cityName,
    };

    console.log('[Weather] Got weather:', display.temperature, display.label, display.cityName);
    return display;
  } catch (error) {
    console.error('[Weather] Failed to fetch weather:', error);
    return null;
  }
}

/** 尝试通过浏览器定位获取天气 */
async function fetchWeatherByGeolocation(forceRefresh = false): Promise<WeatherDisplay | null> {
  try {
    console.log('[Weather] Trying geolocation... forceRefresh=' + forceRefresh);
    
    // 检查浏览器是否支持定位
    if (!navigator.geolocation) {
      console.error('[Weather] Browser does not support geolocation');
      return null;
    }
    
    const pos = await new Promise<GeolocationPosition>((resolve, reject) => {
      navigator.geolocation.getCurrentPosition(resolve, reject, {
        timeout: 10000, // 增加超时时间到10秒
        maximumAge: forceRefresh ? 0 : CACHE_DURATION, // 强制刷新时不使用缓存
        enableHighAccuracy: true, // 请求高精度定位
      });
    });
    
    console.log('[Weather] Got geolocation:', pos.coords.latitude, pos.coords.longitude, 
                'accuracy:', pos.coords.accuracy, 'meters');
    
    // 检查坐标是否合理（中国范围大致：纬度18-54，经度73-135）
    const lat = pos.coords.latitude;
    const lon = pos.coords.longitude;
    if (lat < 18 || lat > 54 || lon < 73 || lon > 135) {
      console.warn('[Weather] Geolocation out of China range:', lat, lon);
    }
    
    return await fetchWeatherByCoords(lat, lon, '当前位置');
  } catch (error) {
    const err = error as GeolocationPositionError;
    const errorMessages: Record<number, string> = {
      1: '用户拒绝定位权限',
      2: '位置不可用',
      3: '定位超时',
    };
    const msg = errorMessages[err?.code] || err?.message || String(error);
    console.warn('[Weather] Geolocation failed: code=' + (err?.code ?? '?') + ' msg=' + msg);
    return null;
  }
}

/**
 * 获取天气数据
 * - manual 模式：使用手动选择的城市
 * - auto 模式：优先定位，定位失败 fallback 到默认城市
 */
export async function fetchWeather(forceRefresh = false): Promise<WeatherDisplay | null> {
  // 如果不是强制刷新，使用缓存
  if (!forceRefresh && cachedWeather && Date.now() - cachedWeather.timestamp < CACHE_DURATION) {
    console.log('[Weather] Using cached weather data');
    return cachedWeather.data;
  }

  const mode = getWeatherMode();

  if (mode === 'manual') {
    const manualCity = getManualCity();
    
    if (manualCity && isValidCoordinate(manualCity.latitude, manualCity.longitude)) {
      const weather = await fetchWeatherByCoords(
        manualCity.latitude,
        manualCity.longitude,
        manualCity.name
      );
      if (weather) {
        cachedWeather = { data: weather, timestamp: Date.now() };
        return weather;
      }
    }
  }

  // auto 模式（或 manual fallback）：尝试定位
  console.log('[Weather] Fetching weather with geolocation...');
  const geoWeather = await fetchWeatherByGeolocation(forceRefresh);
  if (geoWeather) {
    console.log('[Weather] Got weather from geolocation');
    cachedWeather = { data: geoWeather, timestamp: Date.now() };
    return geoWeather;
  }

  // 定位失败，使用默认坐标获取天气，但不显示具体城市名
  console.log('[Weather] Using default coordinates fallback');
  const defaultWeather = await fetchWeatherByCoords(
    DEFAULT_CITY.latitude,
    DEFAULT_CITY.longitude,
    undefined // 不传递城市名，UI 会显示"当前位置"
  );
  if (defaultWeather) {
    cachedWeather = { data: defaultWeather, timestamp: Date.now() };
    return defaultWeather;
  }

  return null;
}

/** 强制刷新天气（清除缓存并重新获取） */
export async function refreshWeather(): Promise<WeatherDisplay | null> {
  console.log('[Weather] Force refreshing weather...');
  clearWeatherCache();
  return fetchWeather(true);
}

/** 获取当前生效的城市信息（用于 UI 展示） */
export async function getCurrentCity(): Promise<{ city: City | null; mode: WeatherMode }> {
  const mode = getWeatherMode();
  if (mode === 'manual') {
    const manualCity = getManualCity();
    if (manualCity) return { city: manualCity, mode };
  }
  // auto 模式：尝试获取定位城市
  try {
    const pos = await new Promise<GeolocationPosition>((resolve, reject) => {
      navigator.geolocation.getCurrentPosition(resolve, reject, {
        timeout: 5000,
        maximumAge: CACHE_DURATION,
      });
    });
    return {
      city: { name: '当前位置', latitude: pos.coords.latitude, longitude: pos.coords.longitude },
      mode: 'auto',
    };
  } catch {
    // 定位失败，返回 null 表示没有具体城市信息
    // 使用默认坐标获取天气，但 UI 显示"当前位置"
    return { city: null, mode: 'auto' };
  }
}

/** 清除天气缓存 */
export function clearWeatherCache(): void {
  cachedWeather = null;
}
