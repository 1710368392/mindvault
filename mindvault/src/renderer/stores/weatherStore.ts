import { create } from 'zustand';
import {
  fetchWeather,
  getCurrentCity,
  refreshWeather as utilRefreshWeather,
  saveManualCity,
  resetToAutoMode,
  setWeatherMode as utilSetWeatherMode,
  getWeatherPrivacy,
  saveWeatherPrivacy,
  type City,
  type WeatherMode,
} from '../utils/weather';
import {
  fetchWeatherForecast,
  generateWeatherAlerts,
  generateDailyBriefing,
  getUserPreference,
  saveUserPreference,
  shouldShowBriefing,
  markBriefingShown,
  dismissAlert as utilDismissAlert,
  type WeatherForecast,
  type WeatherAlert,
  type DailyBriefing,
  type UserWeatherPreference,
} from '../utils/weatherAlert';
import type { HourlyForecast } from '../../shared/weather-constants';

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

interface SavedCity extends City {
  addedAt: number;
}

interface AirQuality {
  aqi: number;
  level: string;
  color: string;
  pm25: number;
  pm10: number;
  o3: number;
  no2: number;
}

interface WeatherState {
  weather: WeatherDisplay | null;
  weatherLoading: boolean;
  currentCity: City | null;
  weatherMode: WeatherMode;
  locationFailed: boolean;
  forecast: WeatherForecast[] | null;
  hourlyForecast: HourlyForecast[] | null;
  airQuality: AirQuality | null;
  alerts: WeatherAlert[];
  unreadAlertCount: number;
  readAlertIds: string[];
  briefing: DailyBriefing | null;
  preferences: UserWeatherPreference;
  privacyEnabled: boolean;
  lastRefreshTime: number;
  savedCities: SavedCity[];
  weatherThemeEnabled: boolean;
  weatherThemeColor: string | null;

  initWeather: () => Promise<void>;
  refreshWeatherData: () => Promise<void>;
  updateWeatherMode: (mode: WeatherMode) => void;
  updateCurrentCity: (city: City | null) => void;
  updateWeather: (weather: WeatherDisplay | null) => void;
  loadForecast: () => Promise<void>;
  loadHourlyForecast: () => Promise<void>;
  loadAirQuality: () => Promise<void>;
  checkAlerts: () => Promise<void>;
  loadBriefing: (type: 'morning' | 'evening') => Promise<void>;
  dismissAlert: (alertId: string) => void;
  updatePreferences: (prefs: Partial<UserWeatherPreference>) => void;
  setPrivacyEnabled: (enabled: boolean) => void;
  addSavedCity: (city: City) => void;
  removeSavedCity: (cityName: string) => void;
  switchToCity: (city: City) => Promise<void>;
  setWeatherThemeEnabled: (enabled: boolean) => void;
  applyWeatherTheme: () => void;
  dismissLocationFail: () => void;
  readAlert: (alertId: string) => void;
}

let _initDone = false;
let _refreshTimer: ReturnType<typeof setInterval> | null = null;
const _notifiedAlertIds = new Set<string>();
const _readAlertIds = new Set<string>();

export const useWeatherStore = create<WeatherState>((set, get) => ({
  weather: null,
  weatherLoading: true,
  currentCity: null,
  weatherMode: 'auto',
  locationFailed: false,
  forecast: null,
  hourlyForecast: null,
  airQuality: null,
  alerts: [],
  unreadAlertCount: 0,
  readAlertIds: [],
  briefing: null,
  preferences: getUserPreference(),
  privacyEnabled: getWeatherPrivacy(),
  lastRefreshTime: 0,
  savedCities: JSON.parse(localStorage.getItem('mindvault-saved-cities') || '[]'),
  weatherThemeEnabled: localStorage.getItem('mindvault-weather-theme') !== 'false',
  weatherThemeColor: null,

  initWeather: async () => {
    if (_initDone) return;
    _initDone = true;

    set({ weatherLoading: true });
    try {
      const { city, mode } = await getCurrentCity();
      const failed = mode === 'auto' && city === null;
      set({ currentCity: city, weatherMode: mode, locationFailed: failed });

      const weatherData = await fetchWeather();
      if (weatherData) {
        set({ weather: weatherData, lastRefreshTime: Date.now() });
        get().applyWeatherTheme();
      }
    } catch (err) {
      console.error('[WeatherStore] init error:', err);
      set({ locationFailed: true });
    } finally {
      set({ weatherLoading: false });
    }

    try {
      if (window.electronAPI?.weather?.saveSnapshot) {
        await window.electronAPI.weather.saveSnapshot();
      }
    } catch {}

    if (_refreshTimer) clearInterval(_refreshTimer);
    _refreshTimer = setInterval(async () => {
      const weatherData = await fetchWeather();
      if (weatherData) {
        set({ weather: weatherData, lastRefreshTime: Date.now() });
        get().applyWeatherTheme();
      }
    }, 10 * 60 * 1000);
  },

  refreshWeatherData: async () => {
    const weatherData = await utilRefreshWeather();
    if (weatherData) {
      set({ weather: weatherData, lastRefreshTime: Date.now() });
    }
  },

  updateWeatherMode: (mode: WeatherMode) => {
    set({ weatherMode: mode });
    utilSetWeatherMode(mode);
  },

  updateCurrentCity: (city: City | null) => {
    set({ currentCity: city });
    if (city) {
      saveManualCity(city);
      window.electronAPI?.weather?.updateCity({
        name: city.name,
        latitude: city.latitude,
        longitude: city.longitude,
      });
    }
  },

  updateWeather: (weather: WeatherDisplay | null) => {
    set({ weather });
  },

  loadForecast: async () => {
    try {
      const forecasts = await fetchWeatherForecast();
      if (forecasts) {
        set({ forecast: forecasts });
      }
    } catch (err) {
      console.error('[WeatherStore] loadForecast error:', err);
    }
  },

  loadHourlyForecast: async () => {
    try {
      const city = get().currentCity || { name: '北京', latitude: 39.9042, longitude: 116.4074 };
      const url = `https://api.open-meteo.com/v1/forecast?latitude=${city.latitude}&longitude=${city.longitude}&hourly=temperature_2m,apparent_temperature,weather_code,precipitation_probability,wind_speed_10m,relative_humidity_2m,uv_index,is_day&timezone=auto&forecast_hours=24`;
      const res = await fetch(url);
      if (!res.ok) return;
      const data = await res.json();
      const hourly = data.hourly;
      if (!hourly) return;

      const forecasts: HourlyForecast[] = [];
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
      set({ hourlyForecast: forecasts });
    } catch (err) {
      console.error('[WeatherStore] loadHourlyForecast error:', err);
    }
  },

  loadAirQuality: async () => {
    try {
      const city = get().currentCity || { name: '北京', latitude: 39.9042, longitude: 116.4074 };
      const url = `https://air-quality-api.open-meteo.com/v1/air-quality?latitude=${city.latitude}&longitude=${city.longitude}&current=european_aqi,pm10,pm2_5,ozone,nitrogen_dioxide&timezone=auto`;
      const res = await fetch(url);
      if (!res.ok) return;
      const data = await res.json();
      const current = data.current;
      if (!current) return;

      const aqi = current.european_aqi;
      let level = '优';
      let color = '#4ade80';
      if (aqi <= 20) { level = '优'; color = '#4ade80'; }
      else if (aqi <= 40) { level = '良'; color = '#a3e635'; }
      else if (aqi <= 60) { level = '中等'; color = '#facc15'; }
      else if (aqi <= 80) { level = '较差'; color = '#fb923c'; }
      else if (aqi <= 100) { level = '差'; color = '#ef4444'; }
      else { level = '很差'; color = '#a855f7'; }

      set({
        airQuality: {
          aqi: Math.round(aqi),
          level,
          color,
          pm25: Math.round(current.pm2_5 || 0),
          pm10: Math.round(current.pm10 || 0),
          o3: Math.round(current.ozone || 0),
          no2: Math.round(current.nitrogen_dioxide || 0),
        }
      });
    } catch (err) {
      console.error('[WeatherStore] loadAirQuality error:', err);
    }
  },

  checkAlerts: async () => {
    try {
      const forecasts = get().forecast || await (async () => {
        await get().loadForecast();
        return get().forecast;
      })();
      if (!forecasts) return [];

      const allAlerts = generateWeatherAlerts(forecasts);
      const pref = get().preferences;

      const activeAlerts = allAlerts.filter(a => !pref.dismissedAlerts.includes(a.id));
      const unreadCount = activeAlerts.filter(a => !_readAlertIds.has(a.id)).length;
      set({ alerts: activeAlerts, unreadAlertCount: unreadCount });

      const newOnes = activeAlerts.filter(a => !_notifiedAlertIds.has(a.id));
      newOnes.forEach(a => _notifiedAlertIds.add(a.id));

      return newOnes;
    } catch (err) {
      console.error('[WeatherStore] checkAlerts error:', err);
      return [];
    }
  },

  loadBriefing: async (type: 'morning' | 'evening') => {
    try {
      const briefing = await generateDailyBriefing(type);
      if (briefing) {
        set({ briefing });
        markBriefingShown(type);
      }
    } catch (err) {
      console.error('[WeatherStore] loadBriefing error:', err);
    }
  },

  dismissAlert: (alertId: string) => {
    utilDismissAlert(alertId);
    _notifiedAlertIds.add(alertId);
    _readAlertIds.add(alertId);
    set(state => {
      const newAlerts = state.alerts.filter(a => a.id !== alertId);
      const unreadCount = newAlerts.filter(a => !_readAlertIds.has(a.id)).length;
      return {
        alerts: newAlerts,
        unreadAlertCount: unreadCount,
        preferences: {
          ...state.preferences,
          dismissedAlerts: [...state.preferences.dismissedAlerts, alertId],
        },
      };
    });
  },

  updatePreferences: (prefs: Partial<UserWeatherPreference>) => {
    const updated = { ...get().preferences, ...prefs };
    saveUserPreference(updated);
    set({ preferences: updated });
  },

  setPrivacyEnabled: (enabled: boolean) => {
    saveWeatherPrivacy(enabled);
    set({ privacyEnabled: enabled });
  },

  addSavedCity: (city: City) => {
    const cities = get().savedCities;
    if (cities.length >= 5) return;
    if (cities.some(c => c.name === city.name)) return;
    const updated = [...cities, { ...city, addedAt: Date.now() }];
    localStorage.setItem('mindvault-saved-cities', JSON.stringify(updated));
    set({ savedCities: updated });
  },

  removeSavedCity: (cityName: string) => {
    const updated = get().savedCities.filter(c => c.name !== cityName);
    localStorage.setItem('mindvault-saved-cities', JSON.stringify(updated));
    set({ savedCities: updated });
  },

  switchToCity: async (city: City) => {
    set({ weatherMode: 'manual', locationFailed: false });
    saveManualCity(city);
    set({ currentCity: city });

    window.electronAPI?.weather?.updateCity({
      name: city.name,
      latitude: city.latitude,
      longitude: city.longitude,
    });

    try {
      const weatherData = await fetchWeather();
      if (weatherData) {
        set({ weather: weatherData, lastRefreshTime: Date.now(), forecast: null, hourlyForecast: null });
        get().applyWeatherTheme();
      }
    } catch {}
  },

  setWeatherThemeEnabled: (enabled: boolean) => {
    localStorage.setItem('mindvault-weather-theme', String(enabled));
    set({ weatherThemeEnabled: enabled });
    if (!enabled) {
      document.documentElement.style.removeProperty('--weather-accent');
      document.documentElement.style.removeProperty('--weather-accent-rgb');
      set({ weatherThemeColor: null });
    } else {
      get().applyWeatherTheme();
    }
  },

  applyWeatherTheme: () => {
    const weather = get().weather;
    const enabled = get().weatherThemeEnabled;
    if (!weather || !enabled) return;

    const code = weather.weatherCode;
    const isDay = weather.isDay;

    let accent = '#8b5cf6';
    let rgb = '139,92,246';

    if (code === 0 && isDay) { accent = '#f59e0b'; rgb = '245,158,11'; }
    else if (code === 0 || code === 1) { accent = '#6366f1'; rgb = '99,102,241'; }
    else if (code >= 2 && code <= 3) { accent = '#64748b'; rgb = '100,116,139'; }
    else if (code >= 51 && code <= 67) { accent = '#3b82f6'; rgb = '59,130,246'; }
    else if (code >= 71 && code <= 86) { accent = '#a5b4fc'; rgb = '165,180,252'; }
    else if (code >= 95 && code <= 99) { accent = '#7c3aed'; rgb = '124,58,237'; }
    else if (code >= 45 && code <= 48) { accent = '#94a3b8'; rgb = '148,163,184'; }

    document.documentElement.style.setProperty('--weather-accent', accent);
    document.documentElement.style.setProperty('--weather-accent-rgb', rgb);
    set({ weatherThemeColor: accent });
  },

  dismissLocationFail: () => {
    set({ locationFailed: false });
  },

  readAlert: (alertId: string) => {
    _readAlertIds.add(alertId);
    _notifiedAlertIds.add(alertId);
    set(state => {
      const newReadIds = [...state.readAlertIds, alertId];
      const unreadCount = state.alerts.filter(a => !_readAlertIds.has(a.id)).length;
      return { unreadAlertCount: unreadCount, readAlertIds: newReadIds };
    });
  },
}));
