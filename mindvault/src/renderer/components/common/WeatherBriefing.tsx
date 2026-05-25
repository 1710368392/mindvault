import React, { useState, useEffect } from 'react';
import { Modal, Button, Card, Tag, List, Switch, TimePicker, Space, Typography, Divider, Badge } from 'antd';
import { Bell, Sun, Moon, Umbrella, Wind, Thermometer, Shirt, Activity, Heart, Settings, X } from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';
import dayjs from 'dayjs';
import type { DailyBriefing, WeatherAlert, UserWeatherPreference } from '../../utils/weatherAlert';
import { 
  generateDailyBriefing, 
  shouldShowBriefing, 
  markBriefingShown,
  getUserPreference,
  saveUserPreference,
  dismissAlert,
} from '../../utils/weatherAlert';

const { Text, Title } = Typography;

interface WeatherBriefingProps {
  visible: boolean;
  onClose: () => void;
  type?: 'morning' | 'evening' | 'alert';
  alert?: WeatherAlert;
  briefing?: DailyBriefing;
}

const WeatherBriefing: React.FC<WeatherBriefingProps> = ({ 
  visible, 
  onClose, 
  type = 'morning',
  alert,
  briefing: externalBriefing,
}) => {
  const [internalBriefing, setInternalBriefing] = useState<DailyBriefing | null>(null);
  const [loading, setLoading] = useState(false);
  const [showSettings, setShowSettings] = useState(false);
  const [prefs, setPrefs] = useState<UserWeatherPreference>(getUserPreference());

  // 使用外部传入的 briefing 或内部加载的 briefing
  const briefing = externalBriefing || internalBriefing;

  useEffect(() => {
    if (visible && !alert && !externalBriefing) {
      loadBriefing();
    }
  }, [visible, externalBriefing]);

  const loadBriefing = async () => {
    setLoading(true);
    const data = await generateDailyBriefing(type === 'alert' ? 'morning' : type);
    setInternalBriefing(data);
    setLoading(false);
    
    // 标记已播报
    if (type === 'morning' || type === 'evening') {
      markBriefingShown(type);
    }
  };

  const handleDismissAlert = (alertId: string) => {
    dismissAlert(alertId);
    if (internalBriefing) {
      setInternalBriefing({
        ...internalBriefing,
        alerts: internalBriefing.alerts.filter(a => a.id !== alertId),
      });
    }
  };

  const handleSavePrefs = () => {
    saveUserPreference(prefs);
    setShowSettings(false);
  };

  const getAlertIcon = (type: WeatherAlert['type']) => {
    switch (type) {
      case 'rain': return <Umbrella size={20} />;
      case 'snow': return <Wind size={20} />;
      case 'storm': return <Wind size={20} />;
      case 'heat': return <Thermometer size={20} />;
      case 'cold': return <Thermometer size={20} />;
      case 'wind': return <Wind size={20} />;
      default: return <Bell size={20} />;
    }
  };

  const getAlertColor = (level: WeatherAlert['level']) => {
    switch (level) {
      case 'extreme': return 'red';
      case 'high': return 'orange';
      case 'medium': return 'yellow';
      case 'low': return 'blue';
    }
  };

  // 预警详情弹窗
  if (alert) {
    return (
      <Modal
        open={visible}
        onCancel={onClose}
        footer={null}
        width={420}
        centered
        closable={false}
        styles={{
          content: { borderRadius: '20px', overflow: 'hidden' },
          body: { padding: '20px' },
        }}
      >
        <div style={{ textAlign: 'center', marginBottom: '16px' }}>
          <Badge status="processing" color={getAlertColor(alert.level)} />
          <Title level={4} style={{ margin: '8px 0', color: getAlertColor(alert.level) }}>
            {getAlertIcon(alert.type)} {alert.title}
          </Title>
          <Text type="secondary">{alert.message}</Text>
        </div>
        
        <Card size="small" style={{ background: '#fff7e6', borderRadius: '12px', marginBottom: '16px' }}>
          <Text strong style={{ display: 'block', marginBottom: '8px' }}>
            <Activity size={16} style={{ marginRight: '4px' }} />
            出行建议
          </Text>
          <List
            size="small"
            dataSource={alert.advice}
            renderItem={(item, index) => (
              <List.Item style={{ padding: '4px 0', border: 'none' }}>
                <Text style={{ fontSize: '13px' }}>{index + 1}. {item}</Text>
              </List.Item>
            )}
          />
        </Card>

        <div style={{ display: 'flex', gap: '12px' }}>
          <Button block onClick={() => handleDismissAlert(alert.id)}>
            我知道了
          </Button>
          <Button type="primary" block onClick={onClose}>
            查看详情
          </Button>
        </div>
      </Modal>
    );
  }

  // 设置面板
  if (showSettings) {
    return (
      <Modal
        title="天气播报设置"
        open={visible}
        onCancel={() => setShowSettings(false)}
        footer={[
          <Button key="cancel" onClick={() => setShowSettings(false)}>取消</Button>,
          <Button key="save" type="primary" onClick={handleSavePrefs}>保存</Button>,
        ]}
        width={480}
        centered
        styles={{
          content: { borderRadius: '16px' },
        }}
      >
        <Space direction="vertical" style={{ width: '100%' }} size="large">
          <div>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '8px' }}>
              <Text strong>天气预警</Text>
              <Switch 
                checked={prefs.enableAlerts} 
                onChange={(v) => setPrefs({ ...prefs, enableAlerts: v })}
              />
            </div>
            <Text type="secondary" style={{ fontSize: '12px' }}>
              当检测到异常天气时自动弹出提醒
            </Text>
          </div>

          <div>
            <Text strong style={{ display: 'block', marginBottom: '8px' }}>预警阈值</Text>
            <Space>
              {(['low', 'medium', 'high'] as const).map((level) => (
                <Tag 
                  key={level}
                  color={prefs.alertThreshold === level ? 'blue' : 'default'}
                  style={{ cursor: 'pointer' }}
                  onClick={() => setPrefs({ ...prefs, alertThreshold: level })}
                >
                  {level === 'low' ? '所有预警' : level === 'medium' ? '中等及以上' : '严重预警'}
                </Tag>
              ))}
            </Space>
          </div>

          <Divider style={{ margin: '12px 0' }} />

          <div>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '8px' }}>
              <Text strong><Sun size={16} style={{ marginRight: '4px' }} />早上播报</Text>
              <Switch 
                checked={prefs.enableMorningBriefing} 
                onChange={(v) => setPrefs({ ...prefs, enableMorningBriefing: v })}
              />
            </div>
            {prefs.enableMorningBriefing && (
              <TimePicker
                value={dayjs(prefs.morningBriefingTime, 'HH:mm')}
                onChange={(t) => setPrefs({ ...prefs, morningBriefingTime: t?.format('HH:mm') || '08:00' })}
                format="HH:mm"
                style={{ width: '120px' }}
              />
            )}
          </div>

          <div>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '8px' }}>
              <Text strong><Moon size={16} style={{ marginRight: '4px' }} />晚上播报</Text>
              <Switch 
                checked={prefs.enableEveningBriefing} 
                onChange={(v) => setPrefs({ ...prefs, enableEveningBriefing: v })}
              />
            </div>
            {prefs.enableEveningBriefing && (
              <TimePicker
                value={dayjs(prefs.eveningBriefingTime, 'HH:mm')}
                onChange={(t) => setPrefs({ ...prefs, eveningBriefingTime: t?.format('HH:mm') || '21:00' })}
                format="HH:mm"
                style={{ width: '120px' }}
              />
            )}
          </div>
        </Space>
      </Modal>
    );
  }

  // 早晚播报弹窗
  return (
    <Modal
      open={visible}
      onCancel={onClose}
      footer={null}
      width={520}
      centered
      closable={false}
      styles={{
        content: { borderRadius: '20px', overflow: 'hidden', padding: 0 },
        body: { padding: 0 },
      }}
    >
      {briefing && (
        <div>
          {/* 头部 */}
          <div style={{ 
            background: type === 'morning' ? 'linear-gradient(135deg, #667eea 0%, #764ba2 100%)' : 'linear-gradient(135deg, #f093fb 0%, #f5576c 100%)',
            padding: '24px',
            color: 'white',
          }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
              <div>
                <motion.div
                  initial={{ opacity: 0, y: -10 }}
                  animate={{ opacity: 1, y: 0 }}
                >
                  <Text style={{ color: 'rgba(255,255,255,0.8)', fontSize: '14px' }}>
                    {type === 'morning' ? <Sun size={16} style={{ marginRight: '4px' }} /> : <Moon size={16} style={{ marginRight: '4px' }} />}
                    {type === 'morning' ? '早上好' : '晚上好'}
                  </Text>
                  <Title level={3} style={{ color: 'white', margin: '8px 0 4px' }}>
                    {briefing.greeting}
                  </Title>
                  <Text style={{ color: 'rgba(255,255,255,0.9)' }}>
                    {briefing.currentWeather}
                  </Text>
                </motion.div>
              </div>
              <Button 
                type="text" 
                icon={<Settings size={18} color="white" />}
                onClick={() => setShowSettings(true)}
                style={{ color: 'white' }}
              />
            </div>
          </div>

          {/* 内容 */}
          <div style={{ padding: '20px' }}>
            {/* 预警 */}
            {briefing.alerts.length > 0 && (
              <motion.div
                initial={{ opacity: 0, height: 0 }}
                animate={{ opacity: 1, height: 'auto' }}
                style={{ marginBottom: '16px' }}
              >
                <Card 
                  size="small" 
                  style={{ background: '#fff2f0', borderRadius: '12px', border: '1px solid #ffccc7' }}
                >
                  <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '8px' }}>
                    <Bell size={18} color="#ff4d4f" />
                    <Text strong style={{ color: '#ff4d4f' }}>
                      天气预警 ({briefing.alerts.length})
                    </Text>
                  </div>
                  <Space direction="vertical" style={{ width: '100%' }}>
                    {briefing.alerts.slice(0, 2).map((alert) => (
                      <div key={alert.id} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                        <Tag color={getAlertColor(alert.level)}>{alert.title}</Tag>
                        <Button type="link" size="small" onClick={() => handleDismissAlert(alert.id)}>
                          忽略
                        </Button>
                      </div>
                    ))}
                  </Space>
                </Card>
              </motion.div>
            )}

            {/* 预报 */}
            <Card size="small" style={{ borderRadius: '12px', marginBottom: '16px' }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                <div>
                  <Text type="secondary" style={{ fontSize: '12px' }}>今日</Text>
                  <div style={{ fontSize: '16px', fontWeight: 500 }}>{briefing.todayForecast}</div>
                </div>
                {briefing.tomorrowForecast && (
                  <div style={{ textAlign: 'right' }}>
                    <Text type="secondary" style={{ fontSize: '12px' }}>明日</Text>
                    <div style={{ fontSize: '14px' }}>{briefing.tomorrowForecast}</div>
                  </div>
                )}
              </div>
            </Card>

            {/* 建议 */}
            <Space direction="vertical" style={{ width: '100%' }} size="middle">
              <Card size="small" style={{ borderRadius: '12px', background: '#f6ffed' }}>
                <div style={{ display: 'flex', gap: '12px' }}>
                  <Shirt size={20} color="#52c41a" />
                  <div>
                    <Text strong style={{ display: 'block', marginBottom: '4px' }}>穿衣建议</Text>
                    <Text style={{ fontSize: '13px' }}>{briefing.outfitAdvice}</Text>
                  </div>
                </div>
              </Card>

              <Card size="small" style={{ borderRadius: '12px', background: '#e6f7ff' }}>
                <div style={{ display: 'flex', gap: '12px' }}>
                  <Activity size={20} color="#1890ff" />
                  <div>
                    <Text strong style={{ display: 'block', marginBottom: '4px' }}>活动建议</Text>
                    <Text style={{ fontSize: '13px' }}>{briefing.activityAdvice}</Text>
                  </div>
                </div>
              </Card>

              <Card size="small" style={{ borderRadius: '12px', background: '#fff7e6' }}>
                <div style={{ display: 'flex', gap: '12px' }}>
                  <Heart size={20} color="#fa8c16" />
                  <div>
                    <Text strong style={{ display: 'block', marginBottom: '4px' }}>健康提示</Text>
                    <Text style={{ fontSize: '13px' }}>{briefing.healthAdvice}</Text>
                  </div>
                </div>
              </Card>
            </Space>

            {/* 底部按钮 */}
            <div style={{ marginTop: '20px', textAlign: 'center' }}>
              <Button type="primary" size="large" onClick={onClose} style={{ borderRadius: '20px', minWidth: '120px' }}>
                知道了
              </Button>
            </div>
          </div>
        </div>
      )}
    </Modal>
  );
};

export default WeatherBriefing;
