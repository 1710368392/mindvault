import React from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { MapPin, Plus, X, Star, Navigation } from 'lucide-react';
import { useWeatherStore } from '../../stores/weatherStore';
import type { City } from '../../utils/weather';

const CityManager: React.FC = () => {
  const savedCities = useWeatherStore((s) => s.savedCities);
  const currentCity = useWeatherStore((s) => s.currentCity);
  const weatherMode = useWeatherStore((s) => s.weatherMode);
  const addSavedCity = useWeatherStore((s) => s.addSavedCity);
  const removeSavedCity = useWeatherStore((s) => s.removeSavedCity);
  const switchToCity = useWeatherStore((s) => s.switchToCity);
  const updateWeatherMode = useWeatherStore((s) => s.updateWeatherMode);
  const updateCurrentCity = useWeatherStore((s) => s.updateCurrentCity);

  const handleAddCurrent = () => {
    if (currentCity) {
      addSavedCity(currentCity);
    }
  };

  const handleSwitch = async (city: City) => {
    await switchToCity(city);
  };

  const handleAutoMode = () => {
    updateWeatherMode('auto');
    resetToAutoMode();
  };

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
          <MapPin size={12} style={{ color: 'var(--primary-color)' }} />
          <span style={{ fontSize: 12, fontWeight: 600, color: 'var(--text-primary)' }}>城市管理</span>
          <span style={{ fontSize: 9, color: 'var(--text-tertiary)' }}>({savedCities.length}/5)</span>
        </div>
        <div style={{ display: 'flex', gap: 4 }}>
          {weatherMode === 'manual' && (
            <motion.button
              whileHover={{ scale: 1.05 }}
              whileTap={{ scale: 0.95 }}
              onClick={handleAutoMode}
              style={{
                display: 'flex', alignItems: 'center', gap: 3,
                padding: '2px 6px', borderRadius: 4, border: 'none',
                cursor: 'pointer', fontSize: 9,
                background: 'rgba(var(--primary-rgb, 139,92,246), 0.08)',
                color: 'var(--primary-color)',
              }}
            >
              <Navigation size={8} />
              自动定位
            </motion.button>
          )}
          {currentCity && savedCities.length < 5 && !savedCities.some(c => c.name === currentCity.name) && (
            <motion.button
              whileHover={{ scale: 1.05 }}
              whileTap={{ scale: 0.95 }}
              onClick={handleAddCurrent}
              style={{
                display: 'flex', alignItems: 'center', gap: 3,
                padding: '2px 6px', borderRadius: 4, border: 'none',
                cursor: 'pointer', fontSize: 9,
                background: 'var(--bg-tertiary)',
                color: 'var(--text-secondary)',
              }}
            >
              <Plus size={8} />
              收藏当前
            </motion.button>
          )}
        </div>
      </div>

      {weatherMode === 'auto' && (
        <div style={{
          padding: '6px 8px', borderRadius: 6,
          background: 'rgba(var(--primary-rgb, 139,92,246), 0.06)',
          border: '1px solid rgba(var(--primary-rgb, 139,92,246), 0.1)',
          display: 'flex', alignItems: 'center', gap: 4,
        }}>
          <Navigation size={10} style={{ color: 'var(--primary-color)' }} />
          <span style={{ fontSize: 9, color: 'var(--text-secondary)' }}>
            当前为自动定位模式 · {currentCity?.name || '定位中...'}
          </span>
        </div>
      )}

      <AnimatePresence>
        {savedCities.map((city) => {
          const isActive = currentCity?.name === city.name && weatherMode === 'manual';

          return (
            <motion.div
              key={city.name}
              initial={{ opacity: 0, y: -5 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, x: 20 }}
              style={{
                display: 'flex', alignItems: 'center', gap: 8,
                padding: '8px 10px', borderRadius: 8,
                background: isActive
                  ? 'rgba(var(--primary-rgb, 139,92,246), 0.08)'
                  : 'var(--bg-secondary)',
                border: isActive
                  ? '1px solid rgba(var(--primary-rgb, 139,92,246), 0.2)'
                  : '1px solid transparent',
                cursor: 'pointer',
              }}
              onClick={() => handleSwitch(city)}
            >
              <Star
                size={12}
                style={{
                  color: isActive ? 'var(--primary-color)' : 'var(--text-tertiary)',
                  fill: isActive ? 'var(--primary-color)' : 'none',
                }}
              />
              <div style={{ flex: 1, minWidth: 0 }}>
                <div style={{
                  fontSize: 11, fontWeight: isActive ? 600 : 400,
                  color: isActive ? 'var(--primary-color)' : 'var(--text-primary)',
                  overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap',
                }}>
                  {city.name}
                </div>
                <div style={{ fontSize: 8, color: 'var(--text-tertiary)' }}>
                  {city.latitude.toFixed(2)}°N, {city.longitude.toFixed(2)}°E
                </div>
              </div>

              <motion.button
                whileHover={{ scale: 1.2 }}
                whileTap={{ scale: 0.9 }}
                onClick={(e) => {
                  e.stopPropagation();
                  removeSavedCity(city.name);
                }}
                style={{
                  display: 'flex', alignItems: 'center', justifyContent: 'center',
                  border: 'none', background: 'none', cursor: 'pointer',
                  color: 'var(--text-tertiary)', padding: 2, opacity: 0.5,
                }}
              >
                <X size={10} />
              </motion.button>
            </motion.div>
          );
        })}
      </AnimatePresence>

      {savedCities.length === 0 && (
        <div style={{
          padding: '12px 0', textAlign: 'center',
        }}>
          <span style={{ fontSize: 9, color: 'var(--text-tertiary)' }}>
            点击"收藏当前"添加城市，最多5个
          </span>
        </div>
      )}
    </div>
  );
};

export default CityManager;
