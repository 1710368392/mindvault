export const WEATHER_LABELS: Record<number, string> = {
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

export type WeatherAlertType = 'rain' | 'snow' | 'storm' | 'typhoon' | 'heat' | 'cold' | 'wind';
export type WeatherAlertLevel = 'low' | 'medium' | 'high' | 'extreme';

export interface WeatherAlertCodeInfo {
  type: WeatherAlertType;
  level: WeatherAlertLevel;
  keyword: string;
}

export const WEATHER_ALERT_CODES: Record<number, WeatherAlertCodeInfo> = {
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

export type WeatherCategory =
  | 'sun' | 'moon' | 'cloud' | 'overcast'
  | 'rain' | 'heavyRain' | 'snow' | 'thunder'
  | 'fog' | 'sleet' | 'typhoon'
  | 'sunrise' | 'sunset'
  | 'nightClear' | 'nightRain' | 'nightHeavyRain'
  | 'nightSnow' | 'nightFog' | 'rainbow';

export function getWeatherCategory(code: number, isDay: boolean): WeatherCategory {
  if (code === 100) return 'overcast';
  if (code === 200) return 'sleet';
  if (code === 300) return 'typhoon';
  if (code === 400) return 'sunrise';
  if (code === 500) return 'sunset';
  if (code === 600) return 'rainbow';

  if (code === 0 && isDay) return 'sun';
  if ((code === 0 || code === 1) && !isDay) return 'moon';
  if (code >= 1 && code <= 3 && isDay) return 'cloud';
  if (code === 2 && !isDay) return 'nightClear';
  if ((code >= 51 && code <= 57) || (code >= 80 && code <= 81)) return 'rain';
  if ((code >= 61 && code <= 67) || code === 82) return 'heavyRain';
  if ((code >= 71 && code <= 77) || (code >= 85 && code <= 86)) return 'snow';
  if (code >= 95 && code <= 99) return 'thunder';
  if (code >= 45 && code <= 48) return 'fog';

  if (!isDay && code >= 51 && code <= 57) return 'nightRain';
  if (!isDay && code >= 61 && code <= 67) return 'nightHeavyRain';
  if (!isDay && ((code >= 71 && code <= 77) || (code >= 85 && code <= 86))) return 'nightSnow';
  if (!isDay && code >= 45 && code <= 48) return 'nightFog';

  return 'cloud';
}

export interface WeatherIconInfo {
  emoji: string;
  label: string;
}

export const WEATHER_ICON_MAP: Record<number, { day: WeatherIconInfo; night: WeatherIconInfo }> = {
  0: { day: { emoji: '☀️', label: '晴' }, night: { emoji: '🌙', label: '晴' } },
  1: { day: { emoji: '🌤️', label: '大部晴' }, night: { emoji: '🌙', label: '大部晴' } },
  2: { day: { emoji: '⛅', label: '多云' }, night: { emoji: '☁️', label: '多云' } },
  3: { day: { emoji: '☁️', label: '阴' }, night: { emoji: '☁️', label: '阴' } },
  45: { day: { emoji: '🌫️', label: '雾' }, night: { emoji: '🌫️', label: '雾' } },
  48: { day: { emoji: '🌫️', label: '冻雾' }, night: { emoji: '🌫️', label: '冻雾' } },
  51: { day: { emoji: '🌦️', label: '小毛毛雨' }, night: { emoji: '🌧️', label: '小毛毛雨' } },
  53: { day: { emoji: '🌦️', label: '毛毛雨' }, night: { emoji: '🌧️', label: '毛毛雨' } },
  55: { day: { emoji: '🌦️', label: '大毛毛雨' }, night: { emoji: '🌧️', label: '大毛毛雨' } },
  61: { day: { emoji: '🌧️', label: '小雨' }, night: { emoji: '🌧️', label: '小雨' } },
  63: { day: { emoji: '🌧️', label: '中雨' }, night: { emoji: '🌧️', label: '中雨' } },
  65: { day: { emoji: '🌧️', label: '大雨' }, night: { emoji: '🌧️', label: '大雨' } },
  66: { day: { emoji: '🌧️', label: '冻雨' }, night: { emoji: '🌧️', label: '冻雨' } },
  67: { day: { emoji: '🌧️', label: '大冻雨' }, night: { emoji: '🌧️', label: '大冻雨' } },
  71: { day: { emoji: '🌨️', label: '小雪' }, night: { emoji: '🌨️', label: '小雪' } },
  73: { day: { emoji: '🌨️', label: '中雪' }, night: { emoji: '🌨️', label: '中雪' } },
  75: { day: { emoji: '❄️', label: '大雪' }, night: { emoji: '❄️', label: '大雪' } },
  77: { day: { emoji: '🌨️', label: '雪粒' }, night: { emoji: '🌨️', label: '雪粒' } },
  80: { day: { emoji: '🌦️', label: '小阵雨' }, night: { emoji: '🌧️', label: '小阵雨' } },
  81: { day: { emoji: '🌧️', label: '中阵雨' }, night: { emoji: '🌧️', label: '中阵雨' } },
  82: { day: { emoji: '🌧️', label: '大阵雨' }, night: { emoji: '🌧️', label: '大阵雨' } },
  85: { day: { emoji: '🌨️', label: '小阵雪' }, night: { emoji: '🌨️', label: '小阵雪' } },
  86: { day: { emoji: '❄️', label: '大阵雪' }, night: { emoji: '❄️', label: '大阵雪' } },
  95: { day: { emoji: '⛈️', label: '雷暴' }, night: { emoji: '⛈️', label: '雷暴' } },
  96: { day: { emoji: '⛈️', label: '雷暴冰雹' }, night: { emoji: '⛈️', label: '雷暴冰雹' } },
  99: { day: { emoji: '⛈️', label: '强雷暴冰雹' }, night: { emoji: '⛈️', label: '强雷暴冰雹' } },
};

export interface HourlyForecast {
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

export interface DailyForecast {
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
  uvIndex: number;
  sunrise: string;
  sunset: string;
  visibilityMax: number;
}

export interface WeatherAlert {
  id: string;
  type: WeatherAlertType;
  level: WeatherAlertLevel;
  title: string;
  message: string;
  advice: string[];
  startTime: Date;
  endTime?: Date;
}

export interface DailyBriefing {
  type: 'morning' | 'evening';
  greeting: string;
  currentWeather: string;
  todayForecast: string;
  tomorrowForecast?: string;
  alerts: WeatherAlert[];
  outfitAdvice: string;
  activityAdvice: string;
  healthAdvice: string;
}

export interface UserWeatherPreference {
  enableAlerts: boolean;
  alertThreshold: WeatherAlertLevel;
  enableMorningBriefing: boolean;
  morningBriefingTime: string;
  enableEveningBriefing: boolean;
  eveningBriefingTime: string;
  lastMorningBriefing: string;
  lastEveningBriefing: string;
  dismissedAlerts: string[];
}
