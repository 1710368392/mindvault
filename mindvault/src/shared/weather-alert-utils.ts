import { WEATHER_ALERT_CODES, type WeatherAlert, type DailyForecast } from './weather-constants';

export function generateAlertsFromForecasts(forecasts: DailyForecast[]): WeatherAlert[] {
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

export function getAlertAdvice(type: string, level: string): string[] {
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

export function getOutfitAdvice(forecast: DailyForecast): string {
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

export function getActivityAdvice(forecast: DailyForecast, alerts: WeatherAlert[]): string {
  const hasStorm = alerts.some(a => a.type === 'storm');
  const hasHeavyRain = alerts.some(a => a.type === 'rain' && (a.level === 'high' || a.level === 'extreme'));
  if (hasStorm) return '今天有雷暴，建议留在室内';
  if (hasHeavyRain) return '今天有大雨，建议减少外出';
  if (forecast.precipitationProbability < 30 && forecast.maxTemp >= 15 && forecast.maxTemp <= 28) {
    return '今天天气不错，适合户外活动';
  }
  return '建议根据天气情况安排活动';
}

export function getHealthAdvice(forecast: DailyForecast, alerts: WeatherAlert[]): string {
  const hasStorm = alerts.some(a => a.type === 'storm');
  if (hasStorm) return '雷暴天气注意关好门窗拔掉电器插头';
  if (forecast.maxTemp >= 35) return '高温天气注意防暑降温多喝水';
  if (forecast.minTemp <= 0) return '寒冷天气注意保暖预防感冒';
  if (forecast.uvIndex != null && forecast.uvIndex >= 8) return '紫外线强，外出请涂抹防晒霜';
  return '天气适宜，保持良好作息适当运动';
}
