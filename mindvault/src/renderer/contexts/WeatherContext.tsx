import React, { createContext, useContext, useEffect } from 'react';
import { useWeatherStore } from '../stores/weatherStore';
import type { City, WeatherMode } from '../utils/weather';

interface WeatherContextType {
  weather: any;
  weatherLoading: boolean;
  currentCity: City | null;
  weatherMode: WeatherMode;
  refreshWeatherData: () => Promise<void>;
  updateWeatherMode: (mode: WeatherMode) => void;
  updateCurrentCity: (city: City | null) => void;
  updateWeather: (weather: any) => void;
}

const WeatherContext = createContext<WeatherContextType | null>(null);

export const useWeather = () => {
  const context = useContext(WeatherContext);
  if (!context) {
    throw new Error('useWeather must be used within WeatherProvider');
  }
  return context;
};

export const WeatherProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const weather = useWeatherStore((s) => s.weather);
  const weatherLoading = useWeatherStore((s) => s.weatherLoading);
  const currentCity = useWeatherStore((s) => s.currentCity);
  const weatherMode = useWeatherStore((s) => s.weatherMode);
  const initWeather = useWeatherStore((s) => s.initWeather);
  const refreshWeatherData = useWeatherStore((s) => s.refreshWeatherData);
  const updateWeatherMode = useWeatherStore((s) => s.updateWeatherMode);
  const updateCurrentCity = useWeatherStore((s) => s.updateCurrentCity);
  const updateWeather = useWeatherStore((s) => s.updateWeather);

  useEffect(() => {
    initWeather();
  }, []);

  const value: WeatherContextType = {
    weather,
    weatherLoading,
    currentCity,
    weatherMode,
    refreshWeatherData,
    updateWeatherMode,
    updateCurrentCity,
    updateWeather,
  };

  return (
    <WeatherContext.Provider value={value}>
      {children}
    </WeatherContext.Provider>
  );
};

export default WeatherContext;
