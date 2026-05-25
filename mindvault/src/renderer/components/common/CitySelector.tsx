import React, { useState, useEffect, useCallback, useRef } from 'react';
import { Modal, Button, Radio, Typography, Cascader, Input, Empty, Spin, Tooltip } from 'antd';
import { Navigation, MapPin, Search, ChevronDown, Star, StarOff, Plus, Trash2 } from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';
import { type City, type WeatherMode, saveManualCity, resetToAutoMode, getWeatherMode } from '../../utils/weather';
import cityData from '../../data/china_regions_full.json';

const { Text } = Typography;

// 收藏城市存储
const FAVORITE_CITIES_KEY = 'mindvault:favorite-cities';

const getFavoriteCities = (): City[] => {
  try {
    const stored = localStorage.getItem(FAVORITE_CITIES_KEY);
    return stored ? JSON.parse(stored) : [];
  } catch {
    return [];
  }
};

const saveFavoriteCities = (cities: City[]) => {
  localStorage.setItem(FAVORITE_CITIES_KEY, JSON.stringify(cities));
};

const addFavoriteCity = (city: City): boolean => {
  const favorites = getFavoriteCities();
  if (favorites.some(f => f.districtCode === city.districtCode)) {
    return false; // 已存在
  }
  favorites.unshift(city);
  saveFavoriteCities(favorites);
  return true;
};

const removeFavoriteCity = (districtCode: string) => {
  const favorites = getFavoriteCities().filter(f => f.districtCode !== districtCode);
  saveFavoriteCities(favorites);
};

const isFavoriteCity = (districtCode: string): boolean => {
  return getFavoriteCities().some(f => f.districtCode === districtCode);
};

interface CitySelectorProps {
  visible: boolean;
  onClose: () => void;
  onSelect: (result: { city: City | null; mode: WeatherMode }) => void;
  currentCity?: City | null;
}

interface CascaderOption {
  value: string;
  label: string;
  children?: CascaderOption[];
}

interface FlatDistrict {
  provinceCode: string;
  provinceName: string;
  cityCode: string;
  cityName: string;
  districtCode: string;
  districtName: string;
  fullName: string;
}

const cascaderOptions: CascaderOption[] = cityData.provinces.map(prov => {
  const provinceCities = cityData.cities.filter(c => c.provinceCode === prov.code);
  return {
    value: prov.code,
    label: prov.name,
    children: provinceCities.map(city => {
      const cityDistricts = cityData.districts.filter(d => d.cityCode === city.code);
      return {
        value: city.code,
        label: city.name,
        children: cityDistricts.map(district => ({
          value: district.code,
          label: district.name,
        })),
      };
    }),
  };
});

const cityMap = new Map(cityData.cities.map(c => [c.code, c.name]));
const provinceMap = new Map(cityData.provinces.map(p => [p.code, p.name]));

const flatDistricts: FlatDistrict[] = cityData.districts.map(d => {
  const provinceName = provinceMap.get(d.provinceCode) || '';
  const cityName = cityMap.get(d.cityCode) || '';
  return {
    provinceCode: d.provinceCode,
    provinceName,
    cityCode: d.cityCode,
    cityName,
    districtCode: d.code,
    districtName: d.name,
    fullName: `${provinceName} ${cityName} ${d.name}`,
  };
});

const CitySelector: React.FC<CitySelectorProps> = ({
  visible,
  onClose,
  onSelect,
  currentCity,
}) => {
  const [useLocation, setUseLocation] = useState(true);
  const [isLoadingCoords, setIsLoadingCoords] = useState(false);

  const [searchText, setSearchText] = useState('');
  const [searchResults, setSearchResults] = useState<FlatDistrict[]>([]);
  const [isSearching, setIsSearching] = useState(false);
  const [selectedDistrict, setSelectedDistrict] = useState<FlatDistrict | null>(null);
  const [selectedPath, setSelectedPath] = useState<string[]>([]);
  const [showSearchDropdown, setShowSearchDropdown] = useState(false);
  const [showCascader, setShowCascader] = useState(false);
  const searchTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  
  // 收藏城市
  const [favoriteCities, setFavoriteCities] = useState<City[]>([]);
  const [showAddFavorite, setShowAddFavorite] = useState(false);

  // 加载收藏城市
  useEffect(() => {
    if (visible) {
      setFavoriteCities(getFavoriteCities());
    }
  }, [visible]);

  useEffect(() => {
    if (visible) {
      const mode = getWeatherMode();
      if (mode === 'manual' && currentCity) {
        setUseLocation(false);
        const district = flatDistricts.find(d => d.districtName === currentCity.name || d.districtCode === currentCity.districtCode);
        if (district) {
          setSelectedDistrict(district);
          setSearchText(district.fullName);
          setSelectedPath([district.provinceCode, district.cityCode, district.districtCode]);
        }
      } else {
        setUseLocation(true);
        setSelectedDistrict(null);
        setSearchText('');
        setSelectedPath([]);
      }
      setSearchResults([]);
      setShowSearchDropdown(false);
      setShowCascader(false);
    }
  }, [visible, currentCity]);

  const doSearch = useCallback((text: string) => {
    const trimmed = text.trim();
    if (!trimmed) {
      setSearchResults([]);
      setIsSearching(false);
      return;
    }
    const lower = trimmed.toLowerCase();
    const results: FlatDistrict[] = [];
    for (let i = 0; i < flatDistricts.length && results.length < 50; i++) {
      const d = flatDistricts[i];
      if (
        d.districtName.toLowerCase().includes(lower) ||
        d.cityName.toLowerCase().includes(lower) ||
        d.provinceName.toLowerCase().includes(lower) ||
        d.fullName.toLowerCase().includes(lower)
      ) {
        results.push(d);
      }
    }
    setSearchResults(results);
    setIsSearching(false);
  }, []);

  const handleSearchChange = useCallback((e: React.ChangeEvent<HTMLInputElement>) => {
    const value = e.target.value;
    setSearchText(value);
    setSelectedDistrict(null);
    if (searchTimerRef.current) clearTimeout(searchTimerRef.current);
    if (!value.trim()) {
      setSearchResults([]);
      setShowSearchDropdown(false);
      return;
    }
    setIsSearching(true);
    setShowSearchDropdown(true);
    setShowCascader(false);
    searchTimerRef.current = setTimeout(() => doSearch(value), 200);
  }, [doSearch]);

  const handleSelectFromSearch = useCallback((district: FlatDistrict) => {
    setSelectedDistrict(district);
    setSearchText(district.fullName);
    setSearchResults([]);
    setShowSearchDropdown(false);
    setSelectedPath([district.provinceCode, district.cityCode, district.districtCode]);
  }, []);

  const handleCascaderChange = (value: string[]) => {
    setSelectedPath(value);
    if (value.length === 3) {
      const district = flatDistricts.find(d => d.districtCode === value[2]);
      if (district) {
        setSelectedDistrict(district);
        setSearchText(district.fullName);
      }
    } else {
      setSelectedDistrict(null);
    }
    setShowCascader(false);
  };

  const handleInputClick = (e: React.MouseEvent) => {
    e.stopPropagation();
    setShowSearchDropdown(true);
    setShowCascader(false);
    if (searchText.trim() && searchResults.length === 0 && !isSearching) {
      doSearch(searchText);
    }
  };

  const handleDropdownClick = (e: React.MouseEvent) => {
    e.stopPropagation();
    setShowCascader(true);
    setShowSearchDropdown(false);
  };

  const handleUseLocation = () => {
    setUseLocation(true);
    setSelectedDistrict(null);
    setSearchText('');
    setSearchResults([]);
    setSelectedPath([]);
    setShowSearchDropdown(false);
    setShowCascader(false);
  };

  const handleManualMode = () => {
    setUseLocation(false);
  };

  const fetchDistrictCoordinates = async (district: FlatDistrict): Promise<{ lat: number; lon: number } | null> => {
    const cached = localStorage.getItem(`mindvault:city-coords-${district.districtCode}`);
    if (cached) {
      try {
        const parsed = JSON.parse(cached);
        if (parsed.lat && parsed.lon) return parsed;
      } catch {}
    }

    const shortName = district.districtName.replace(/(区|县|市|旗|自治县|自治旗|特别行政区)$/g, '');

    try {
      const response = await fetch(
        `https://geocoding-api.open-meteo.com/v1/search?name=${encodeURIComponent(shortName)}&count=5&language=zh&format=json`
      );
      const data = await response.json();

      if (data.results && data.results.length > 0) {
        const chinaResult = data.results.find((r: any) => r.country_code === 'CN') || data.results[0];
        const coords = { lat: chinaResult.latitude, lon: chinaResult.longitude };
        localStorage.setItem(`mindvault:city-coords-${district.districtCode}`, JSON.stringify(coords));
        return coords;
      }

      const cityShortName = district.cityName.replace(/(市|地区|自治州|盟)$/g, '');
      const cityResponse = await fetch(
        `https://geocoding-api.open-meteo.com/v1/search?name=${encodeURIComponent(cityShortName)}&count=5&language=zh&format=json`
      );
      const cityDataResp = await cityResponse.json();
      if (cityDataResp.results && cityDataResp.results.length > 0) {
        const chinaResult = cityDataResp.results.find((r: any) => r.country_code === 'CN') || cityDataResp.results[0];
        const coords = { lat: chinaResult.latitude, lon: chinaResult.longitude };
        localStorage.setItem(`mindvault:city-coords-${district.districtCode}`, JSON.stringify(coords));
        return coords;
      }
    } catch (error) {
      console.error('[CitySelector] Failed to fetch coordinates:', error);
    }

    return null;
  };

  const handleConfirm = async () => {
    if (useLocation) {
      resetToAutoMode();
      onSelect({ city: null, mode: 'auto' });
      onClose();
    } else if (selectedDistrict) {
      setIsLoadingCoords(true);
      const coords = await fetchDistrictCoordinates(selectedDistrict);

      if (!coords) {
        setIsLoadingCoords(false);
        return;
      }

      const city: City = {
        name: selectedDistrict.districtName,
        latitude: coords.lat,
        longitude: coords.lon,
        fullName: selectedDistrict.fullName,
        provinceCode: selectedDistrict.provinceCode,
        cityCode: selectedDistrict.cityCode,
        districtCode: selectedDistrict.districtCode,
      };

      saveManualCity(city);
      onSelect({ city, mode: 'manual' });
      setIsLoadingCoords(false);
      onClose();
    }
  };

  return (
    <Modal
      title={null}
      open={visible}
      onCancel={onClose}
      footer={null}
      width={480}
      centered
      zIndex={10002}
      mask={false}
      maskClosable={false}
      styles={{
        content: {
          borderRadius: '20px',
          overflow: 'hidden',
        },
        body: {
          padding: '16px 20px',
        },
      }}
      closable={false}
    >
      <div style={{
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'space-between',
        marginBottom: '12px',
        padding: '0 4px'
      }}>
        <Text style={{ fontSize: '18px', fontWeight: 600 }}>选择城市</Text>
        <Button
          type="text"
          size="small"
          onClick={onClose}
          style={{ color: '#999', fontSize: '20px', padding: '0 4px' }}
        >
          ✕
        </Button>
      </div>

      <motion.div
        initial={{ opacity: 0, y: -8 }}
        animate={{ opacity: 1, y: 0 }}
        onClick={handleUseLocation}
        style={{
          display: 'flex',
          alignItems: 'center',
          gap: '10px',
          padding: '12px 14px',
          borderRadius: '14px',
          cursor: 'pointer',
          backgroundColor: useLocation ? 'var(--primary-bg, #e6f7ff)' : '#f8f8f8',
          border: `2px solid ${useLocation ? 'var(--primary-color, #1890ff)' : 'transparent'}`,
          marginBottom: '10px',
          transition: 'all 0.2s',
        }}
      >
        <Radio checked={useLocation} />
        <Navigation size={18} style={{ color: useLocation ? 'var(--primary-color, #1890ff)' : '#999' }} />
        <div style={{ flex: 1 }}>
          <Text style={{ fontWeight: 500, fontSize: '14px' }}>自动定位</Text>
          <Text type="secondary" style={{ fontSize: '12px', marginLeft: '8px' }}>
            使用当前位置
          </Text>
        </div>
      </motion.div>

      {/* 收藏城市 */}
      <AnimatePresence>
        {favoriteCities.length > 0 && (
          <motion.div
            initial={{ opacity: 0, height: 0 }}
            animate={{ opacity: 1, height: 'auto' }}
            exit={{ opacity: 0, height: 0 }}
            style={{ marginBottom: '10px', overflow: 'hidden' }}
          >
            <div style={{
              padding: '10px 14px',
              borderRadius: '14px',
              backgroundColor: '#f8f8f8',
              border: '1px solid var(--border-color, #e8e8e8)',
            }}>
              <div style={{
                display: 'flex',
                alignItems: 'center',
                gap: 6,
                marginBottom: 8,
                color: 'var(--text-secondary)',
                fontSize: 12,
              }}>
                <Star size={12} fill="var(--primary-color)" style={{ color: 'var(--primary-color)' }} />
                <span>收藏的城市</span>
              </div>
              <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6 }}>
                {favoriteCities.map((city) => (
                  <div
                    key={city.districtCode}
                    onClick={() => {
                      // 选择收藏的城市
                      const district = flatDistricts.find(d => d.districtCode === city.districtCode);
                      if (district) {
                        setSelectedDistrict(district);
                        setSearchText(district.fullName);
                        setSelectedPath([district.provinceCode, district.cityCode, district.districtCode]);
                        setUseLocation(false);
                      }
                    }}
                    style={{
                      display: 'flex',
                      alignItems: 'center',
                      gap: 4,
                      padding: '4px 10px',
                      borderRadius: 16,
                      backgroundColor: selectedDistrict?.districtCode === city.districtCode
                        ? 'var(--primary-color, #1890ff)'
                        : 'var(--bg-primary, #fff)',
                      color: selectedDistrict?.districtCode === city.districtCode
                        ? '#fff'
                        : 'var(--text-primary)',
                      fontSize: 13,
                      cursor: 'pointer',
                      border: '1px solid var(--border-color, #e8e8e8)',
                      transition: 'all 0.2s',
                    }}
                  >
                    <span>{city.name}</span>
                    <Tooltip title="移除收藏">
                      <Trash2
                        size={12}
                        style={{ opacity: 0.5 }}
                        onClick={(e) => {
                          e.stopPropagation();
                          removeFavoriteCity(city.districtCode || '');
                          setFavoriteCities(getFavoriteCities());
                        }}
                      />
                    </Tooltip>
                  </div>
                ))}
              </div>
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      <motion.div
        initial={{ opacity: 0, y: -8 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ delay: 0.05 }}
        onClick={handleManualMode}
        style={{
          display: 'flex',
          flexDirection: 'column',
          gap: '10px',
          padding: '12px 14px',
          borderRadius: '14px',
          cursor: 'pointer',
          backgroundColor: !useLocation ? 'var(--primary-bg, #e6f7ff)' : '#f8f8f8',
          border: `2px solid ${!useLocation ? 'var(--primary-color, #1890ff)' : 'transparent'}`,
          transition: 'all 0.2s',
        }}
      >
        <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
          <Radio checked={!useLocation} />
          <MapPin size={18} style={{ color: !useLocation ? 'var(--primary-color, #1890ff)' : '#999' }} />
          <div style={{ flex: 1 }}>
            <Text style={{ fontWeight: 500, fontSize: '14px' }}>手动选择</Text>
            <Text type="secondary" style={{ fontSize: '12px', marginLeft: '8px' }}>
              精确到区/县
            </Text>
          </div>
        </div>

        {!useLocation && (
          <motion.div
            initial={{ opacity: 0, height: 0 }}
            animate={{ opacity: 1, height: 'auto' }}
            style={{ marginTop: '6px', marginLeft: '28px', position: 'relative' }}
            onClick={(e) => e.stopPropagation()}
          >
            <div style={{ display: 'flex', alignItems: 'center', position: 'relative' }}>
              <Input
                value={searchText}
                onChange={handleSearchChange}
                onClick={handleInputClick}
                placeholder="输入城市或区县名称搜索，或点击右侧选择..."
                prefix={<Search size={14} style={{ color: 'var(--text-tertiary)' }} />}
                suffix={
                  <div
                    onClick={handleDropdownClick}
                    style={{
                      display: 'flex',
                      alignItems: 'center',
                      cursor: 'pointer',
                      padding: '0 4px',
                      borderLeft: '1px solid var(--border-color)',
                      marginLeft: 8,
                      paddingLeft: 8,
                    }}
                  >
                    <ChevronDown size={14} style={{ color: 'var(--text-tertiary)' }} />
                  </div>
                }
                allowClear
                autoFocus
                style={{ borderRadius: 8 }}
              />

              {showSearchDropdown && (
                <div style={{
                  position: 'absolute',
                  top: '100%',
                  left: 0,
                  right: 0,
                  zIndex: 10001,
                  maxHeight: 240,
                  overflowY: 'auto',
                  backgroundColor: 'var(--bg-primary, #fff)',
                  borderRadius: 8,
                  border: '1px solid var(--border-color, #e8e8e8)',
                  boxShadow: '0 4px 12px rgba(0,0,0,0.12)',
                  marginTop: 4,
                }}>
                  {isSearching ? (
                    <div style={{ padding: '12px', textAlign: 'center' }}>
                      <Spin size="small" />
                    </div>
                  ) : searchResults.length > 0 ? (
                    searchResults.map((d) => (
                      <div
                        key={d.districtCode}
                        onClick={() => handleSelectFromSearch(d)}
                        style={{
                          padding: '8px 12px',
                          cursor: 'pointer',
                          fontSize: 13,
                          color: 'var(--text-primary)',
                          backgroundColor: selectedDistrict?.districtCode === d.districtCode
                            ? 'var(--primary-bg, #e6f7ff)'
                            : 'transparent',
                          transition: 'background-color 0.15s',
                        }}
                        onMouseEnter={(e) => {
                          if (selectedDistrict?.districtCode !== d.districtCode) {
                            e.currentTarget.style.backgroundColor = 'var(--bg-hover, #f5f5f5)';
                          }
                        }}
                        onMouseLeave={(e) => {
                          if (selectedDistrict?.districtCode !== d.districtCode) {
                            e.currentTarget.style.backgroundColor = 'transparent';
                          }
                        }}
                      >
                        <span style={{ fontWeight: 500 }}>{d.districtName}</span>
                        <span style={{ color: 'var(--text-tertiary)', fontSize: 12, marginLeft: 8 }}>
                          {d.cityName} · {d.provinceName}
                        </span>
                      </div>
                    ))
                  ) : searchText.trim() ? (
                    <Empty description="未找到匹配的城市" image={Empty.PRESENTED_IMAGE_SIMPLE} style={{ padding: '12px 0', margin: 0 }} />
                  ) : null}
                </div>
              )}

              {showCascader && (
                <div style={{
                  position: 'absolute',
                  top: '100%',
                  left: 0,
                  right: 0,
                  zIndex: 10001,
                  backgroundColor: 'var(--bg-primary, #fff)',
                  borderRadius: 8,
                  border: '1px solid var(--border-color, #e8e8e8)',
                  boxShadow: '0 4px 12px rgba(0,0,0,0.12)',
                  marginTop: 4,
                  padding: 8,
                }}>
                  <Cascader
                    options={cascaderOptions}
                    value={selectedPath}
                    onChange={handleCascaderChange}
                    placeholder="请选择省 / 市 / 区"
                    style={{ width: '100%' }}
                    changeOnSelect={false}
                    expandTrigger="hover"
                    displayRender={(labels) => labels.join(' / ')}
                    autoFocus
                  />
                </div>
              )}
            </div>

            {selectedDistrict && (
              <div style={{
                marginTop: 8,
                padding: '6px 10px',
                borderRadius: 8,
                backgroundColor: 'var(--primary-bg, #e6f7ff)',
                fontSize: 13,
                color: 'var(--primary-color, #1890ff)',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'space-between',
              }}>
                <span>已选择：{selectedDistrict.fullName}</span>
                {!isFavoriteCity(selectedDistrict.districtCode) && (
                  <Tooltip title="添加到收藏">
                    <Button
                      type="text"
                      size="small"
                      icon={<Star size={14} />}
                      onClick={(e) => {
                        e.stopPropagation();
                        const newCity: City = {
                          name: selectedDistrict.districtName,
                          latitude: 0,
                          longitude: 0,
                          fullName: selectedDistrict.fullName,
                          provinceCode: selectedDistrict.provinceCode,
                          cityCode: selectedDistrict.cityCode,
                          districtCode: selectedDistrict.districtCode,
                        };
                        addFavoriteCity(newCity);
                        setFavoriteCities(getFavoriteCities());
                      }}
                      style={{ color: 'var(--primary-color)', padding: '0 4px' }}
                    />
                  </Tooltip>
                )}
              </div>
            )}
          </motion.div>
        )}
      </motion.div>

      <div style={{
        display: 'flex',
        justifyContent: 'flex-end',
        gap: '10px',
        marginTop: '16px',
        padding: '0 4px'
      }}>
        <Button onClick={onClose}>取消</Button>
        <Button
          type="primary"
          onClick={handleConfirm}
          disabled={!useLocation && !selectedDistrict}
          loading={isLoadingCoords}
          style={{ borderRadius: '8px', minWidth: '80px' }}
        >
          确定
        </Button>
      </div>
    </Modal>
  );
};

export default CitySelector;
