import { ipcMain } from 'electron';
import { updateCachedCity, fetchCurrentWeather, fetchAirQuality, fetchHourlyForecast } from '../services/weather-service';
import { getDb } from '../db/repository';

function ensureTable() {
  const db = getDb();
  if (!db) return null;
  db.exec(`
    CREATE TABLE IF NOT EXISTS weather_snapshots (
      id              INTEGER PRIMARY KEY AUTOINCREMENT,
      city            TEXT NOT NULL,
      latitude        REAL NOT NULL,
      longitude       REAL NOT NULL,
      temperature     INTEGER NOT NULL,
      apparent_temp   INTEGER,
      weather_code    INTEGER NOT NULL,
      humidity        INTEGER,
      wind_speed      INTEGER,
      pressure        INTEGER,
      is_day          INTEGER DEFAULT 1,
      snapshot_date   TEXT NOT NULL,
      created_at      TEXT NOT NULL
    );
    CREATE INDEX IF NOT EXISTS idx_weather_snapshots_date ON weather_snapshots(snapshot_date);
    CREATE INDEX IF NOT EXISTS idx_weather_snapshots_city ON weather_snapshots(city);
  `);
  return db;
}

export function registerWeatherIpc() {
  ipcMain.on('weather:update-city', (_event, city: { name: string; latitude: number; longitude: number }) => {
    if (city && city.latitude && city.longitude) {
      updateCachedCity(city);
    }
  });

  ipcMain.handle('weather:save-snapshot', async () => {
    try {
      const db = ensureTable();
      if (!db) return { success: false };

      const weather = await fetchCurrentWeather();
      if (!weather) return { success: false };

      const now = new Date();
      const dateStr = now.toISOString().split('T')[0];

      const existing = db.prepare(
        'SELECT id FROM weather_snapshots WHERE city = ? AND snapshot_date = ?'
      ).get(weather.city, dateStr);

      if (existing) {
        db.prepare(
          `UPDATE weather_snapshots SET temperature = ?, apparent_temp = ?, weather_code = ?, humidity = ?, wind_speed = ?, pressure = ?, is_day = ?, created_at = ?
           WHERE id = ?`
        ).run(
          weather.temperature, weather.apparentTemperature, weather.weatherCode,
          weather.humidity, weather.windSpeed, weather.pressure,
          weather.isDay ? 1 : 0, now.toISOString(), existing.id
        );
      } else {
        db.prepare(
          `INSERT INTO weather_snapshots (city, latitude, longitude, temperature, apparent_temp, weather_code, humidity, wind_speed, pressure, is_day, snapshot_date, created_at)
           VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`
        ).run(
          weather.city, 0, 0,
          weather.temperature, weather.apparentTemperature, weather.weatherCode,
          weather.humidity, weather.windSpeed, weather.pressure,
          weather.isDay ? 1 : 0, dateStr, now.toISOString()
        );
      }

      return { success: true };
    } catch (err) {
      console.error('[WeatherIPC] save-snapshot error:', err.message);
      return { success: false };
    }
  });

  ipcMain.handle('weather:get-history', async (_event, days: number = 30) => {
    try {
      const db = ensureTable();
      if (!db) return [];

      const rows = db.prepare(
        'SELECT * FROM weather_snapshots ORDER BY snapshot_date DESC LIMIT ?'
      ).all(days);

      return rows || [];
    } catch (err) {
      console.error('[WeatherIPC] get-history error:', err.message);
      return [];
    }
  });

  ipcMain.handle('weather:air-quality', async () => {
    try {
      const result = await fetchAirQuality();
      return result;
    } catch (err) {
      console.error('[WeatherIPC] air-quality error:', err.message);
      return null;
    }
  });

  ipcMain.handle('weather:fetch-hourly-forecast', async (_event, hours: number = 24) => {
    try {
      const result = await fetchHourlyForecast(hours);
      return result;
    } catch (err) {
      console.error('[WeatherIPC] fetch-hourly-forecast error:', err.message);
      return null;
    }
  });
}
