import React, { useState, useEffect, useRef } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import {
  Bell, AlertTriangle, CloudSun, Monitor, RefreshCw, Sparkles, Info,
  Clock, Trash2, CheckCheck, X,
} from 'lucide-react';
import {
  useNotificationStore,
  type AppNotification,
  type NotificationCategory,
  type NotificationLevel,
} from '../../stores/notificationStore';
import { useWeatherStore } from '../../stores/weatherStore';

const CATEGORY_CONFIG: Record<NotificationCategory, { label: string; icon: React.FC<{ size?: number; style?: React.CSSProperties }>; color: string }> = {
  weather: { label: '天气', icon: CloudSun, color: '#6366f1' },
  system: { label: '系统', icon: Monitor, color: '#8b5cf6' },
  update: { label: '更新', icon: RefreshCw, color: '#10b981' },
  ai: { label: 'AI', icon: Sparkles, color: '#f59e0b' },
  general: { label: '通用', icon: Info, color: '#6b7280' },
};

const LEVEL_COLORS: Record<NotificationLevel, string> = {
  info: '#6366f1',
  warning: '#f59e0b',
  error: '#ef4444',
  success: '#10b981',
};

const LEVEL_LABELS: Record<NotificationLevel, string> = {
  info: '信息',
  warning: '警告',
  error: '错误',
  success: '成功',
};

const formatTime = (ts: number) => {
  const d = new Date(ts);
  const now = new Date();
  const isToday = d.toDateString() === now.toDateString();
  if (isToday) {
    return d.toLocaleTimeString('zh-CN', { hour: '2-digit', minute: '2-digit' });
  }
  return d.toLocaleDateString('zh-CN', { month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit' });
};

const getWeatherLevelColor = (level?: string) => {
  switch (level) {
    case 'extreme': return '#ef4444';
    case 'high': return '#f97316';
    case 'medium': return '#eab308';
    default: return '#6b7280';
  }
};

const getWeatherLevelLabel = (level?: string) => {
  switch (level) {
    case 'extreme': return '极端';
    case 'high': return '高危';
    case 'medium': return '中等';
    default: return '一般';
  }
};

const NotificationItem = React.forwardRef<HTMLDivElement, {
  notification: AppNotification;
  onRead: () => void;
  onDelete: () => void;
  highlight?: boolean;
}>(({ notification, onRead, onDelete, highlight }, ref) => {
  const catConfig = CATEGORY_CONFIG[notification.category];
  const CatIcon = catConfig.icon;
  const levelColor = LEVEL_COLORS[notification.level];
  const weatherLevel = notification.extra?.weatherLevel as string | undefined;

  const [flashCount, setFlashCount] = useState(0);

  useEffect(() => {
    if (highlight) {
      setFlashCount(1);
    }
  }, [highlight]);

  useEffect(() => {
    if (flashCount > 0 && flashCount < 6) {
      const timer = setTimeout(() => {
        setFlashCount(flashCount + 1);
      }, 300);
      return () => clearTimeout(timer);
    }
  }, [flashCount]);

  const isFlashing = highlight && flashCount > 0 && flashCount < 6;

  return (
    <motion.div
      ref={ref}
      initial={{ opacity: 0, x: -10 }}
      animate={{ opacity: 1, x: 0 }}
      style={{
        padding: '10px 20px',
        display: 'flex', alignItems: 'flex-start', gap: 10,
        background: isFlashing 
          ? (flashCount % 2 === 1 ? `color-mix(in srgb, ${catConfig.color} 15%, transparent)` 
            : (notification.read ? 'transparent' : `color-mix(in srgb, ${catConfig.color} 4%, transparent)`))
          : (notification.read ? 'transparent' : `color-mix(in srgb, ${catConfig.color} 4%, transparent)`),
        borderBottom: '1px solid var(--border-light)',
        transition: 'background 0.2s ease',
        boxShadow: highlight ? `0 0 0 2px ${catConfig.color}` : 'none',
      }}
    >
      <div style={{
        width: 32, height: 32, borderRadius: 8,
        background: `color-mix(in srgb, ${catConfig.color} 12%, transparent)`,
        display: 'flex', alignItems: 'center', justifyContent: 'center',
        flexShrink: 0,
      }}>
        <CatIcon size={16} style={{ color: catConfig.color }} />
      </div>
      <div style={{ flex: 1, minWidth: 0 }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
          <span style={{
            fontSize: 13, fontWeight: 600, color: 'var(--text-primary)',
            overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap',
          }}>
            {notification.title}
          </span>
          {weatherLevel && (
            <span style={{
              fontSize: 10, fontWeight: 600, color: '#fff',
              background: getWeatherLevelColor(weatherLevel),
              borderRadius: 4, padding: '0 5px', lineHeight: '16px',
            }}>
              {getWeatherLevelLabel(weatherLevel)}
            </span>
          )}
          {notification.level === 'warning' && !weatherLevel && (
            <span style={{
              fontSize: 10, fontWeight: 600, color: '#fff',
              background: levelColor, borderRadius: 4, padding: '0 5px', lineHeight: '16px',
            }}>
              {LEVEL_LABELS[notification.level]}
            </span>
          )}
          {notification.level === 'error' && (
            <span style={{
              fontSize: 10, fontWeight: 600, color: '#fff',
              background: levelColor, borderRadius: 4, padding: '0 5px', lineHeight: '16px',
            }}>
              {LEVEL_LABELS[notification.level]}
            </span>
          )}
          {!notification.read && (
            <span style={{
              width: 6, height: 6, borderRadius: '50%',
              background: catConfig.color, flexShrink: 0,
            }} />
          )}
        </div>
        <p style={{
          fontSize: 12, color: 'var(--text-secondary)', margin: '2px 0 0',
          lineHeight: 1.5, overflow: 'hidden', textOverflow: 'ellipsis',
          whiteSpace: 'nowrap',
        }}>
          {notification.message}
        </p>
        <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginTop: 2 }}>
          <span style={{ fontSize: 11, color: 'var(--text-tertiary)' }}>
            {formatTime(notification.timestamp)}
          </span>
          <span style={{
            fontSize: 10, color: catConfig.color, fontWeight: 500,
            background: `color-mix(in srgb, ${catConfig.color} 10%, transparent)`,
            borderRadius: 4, padding: '0 5px', lineHeight: '16px',
          }}>
            {catConfig.label}
          </span>
        </div>
      </div>
      <div style={{ display: 'flex', flexDirection: 'column', gap: 4, flexShrink: 0 }}>
        {!notification.read && (
          <button
            onClick={onRead}
            style={{
              background: 'none', border: 'none', cursor: 'pointer',
              color: 'var(--primary-color)', padding: 2, fontSize: 11, fontWeight: 500,
            }}
          >
            已读
          </button>
        )}
        <button
          onClick={onDelete}
          style={{
            background: 'none', border: 'none', cursor: 'pointer',
            color: 'var(--text-tertiary)', padding: 2, opacity: 0.5,
            transition: 'opacity 0.15s',
          }}
          onMouseEnter={(e) => { e.currentTarget.style.opacity = '1'; }}
          onMouseLeave={(e) => { e.currentTarget.style.opacity = '0.5'; }}
        >
          <Trash2 size={12} />
        </button>
      </div>
    </motion.div>
  );
});

const GlobalNotificationCenter: React.FC = () => {
  const visible = useNotificationStore((s) => s.centerVisible);
  const setCenterVisible = useNotificationStore((s) => s.setCenterVisible);
  const notifications = useNotificationStore((s) => s.notifications);
  const markRead = useNotificationStore((s) => s.markRead);
  const markAllRead = useNotificationStore((s) => s.markAllRead);
  const deleteNotification = useNotificationStore((s) => s.deleteNotification);
  const clearAll = useNotificationStore((s) => s.clearAll);
  const activeTab = useNotificationStore((s) => s.activeTab);
  const setActiveTab = useNotificationStore((s) => s.setActiveTab);
  const highlightNotificationId = useNotificationStore((s) => s.highlightNotificationId);
  const setHighlightNotificationId = useNotificationStore((s) => s.setHighlightNotificationId);

  const alerts = useWeatherStore((s) => s.alerts);
  const readAlertIds = useWeatherStore((s) => s.readAlertIds);
  const readAlert = useWeatherStore((s) => s.readAlert);

  const scrollContainerRef = useRef<HTMLDivElement>(null);
  const notificationRefs = useRef<Record<string, HTMLDivElement | null>>({});

  const unreadCount = notifications.filter(n => !n.read).length;

  const filteredNotifications = activeTab === 'all'
    ? notifications
    : notifications.filter(n => n.category === activeTab);

  useEffect(() => {
    if (visible && highlightNotificationId && scrollContainerRef.current) {
      // 等待DOM更新
      setTimeout(() => {
        const targetElement = notificationRefs.current[highlightNotificationId];
        if (targetElement && scrollContainerRef.current) {
          // 滚动到目标元素
          targetElement.scrollIntoView({ 
            behavior: 'smooth', 
            block: 'center' 
          });
        }
        // 一段时间后清除高亮
        setTimeout(() => {
          setHighlightNotificationId(null);
        }, 3000);
      }, 100);
    }
  }, [visible, highlightNotificationId, setHighlightNotificationId]);

  const categoryCounts = notifications.reduce((acc, n) => {
    acc[n.category] = (acc[n.category] || 0) + 1;
    return acc;
  }, {} as Record<string, number>);

  const tabs: { key: NotificationCategory | 'all'; label: string }[] = [
    { key: 'all', label: `全部${notifications.length > 0 ? ` (${notifications.length})` : ''}` },
    ...Object.entries(CATEGORY_CONFIG)
      .filter(([key]) => categoryCounts[key])
      .map(([key, config]) => ({
        key: key as NotificationCategory,
        label: `${config.label} (${categoryCounts[key]})`,
      })),
  ];

  return (
    <AnimatePresence>
      {visible && (
        <motion.div
          key="global-notification-center"
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          transition={{ duration: 0.15 }}
          style={{
            position: 'fixed', top: 0, left: 0, right: 0, bottom: 0,
            background: 'rgba(0,0,0,0.4)', zIndex: 10000,
            display: 'flex', alignItems: 'center', justifyContent: 'center',
          }}
          onClick={() => setCenterVisible(false)}
        >
          <motion.div
            initial={{ scale: 0.92, opacity: 0, y: 20 }}
            animate={{ scale: 1, opacity: 1, y: 0 }}
            exit={{ scale: 0.92, opacity: 0, y: 20 }}
            transition={{ type: 'spring', damping: 25, stiffness: 300 }}
            onClick={(e) => e.stopPropagation()}
            style={{
              width: 480, maxHeight: '75vh',
              background: 'var(--bg-primary)', borderRadius: 16,
              boxShadow: '0 20px 60px rgba(0,0,0,0.3)',
              border: '1px solid var(--border-light)',
              display: 'flex', flexDirection: 'column',
              overflow: 'hidden',
            }}
          >
            <div style={{
              padding: '16px 20px',
              borderBottom: '1px solid var(--border-light)',
              display: 'flex', alignItems: 'center', justifyContent: 'space-between',
              flexShrink: 0,
            }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                <Bell size={18} style={{ color: 'var(--primary-color)' }} />
                <span style={{ fontSize: 15, fontWeight: 700, color: 'var(--text-primary)' }}>
                  通知中心
                </span>
                {unreadCount > 0 && (
                  <span style={{
                    fontSize: 11, fontWeight: 600, color: '#fff',
                    background: 'var(--primary-color)', borderRadius: 10,
                    padding: '1px 7px', minWidth: 18, textAlign: 'center',
                  }}>
                    {unreadCount}
                  </span>
                )}
              </div>
              <div style={{ display: 'flex', gap: 8 }}>
                {unreadCount > 0 && (
                  <button
                    onClick={markAllRead}
                    style={{
                      background: 'none', border: 'none', cursor: 'pointer',
                      fontSize: 12, color: 'var(--primary-color)', fontWeight: 500,
                      display: 'flex', alignItems: 'center', gap: 4,
                    }}
                  >
                    <CheckCheck size={14} />
                    全部已读
                  </button>
                )}
                {notifications.length > 0 && (
                  <button
                    onClick={clearAll}
                    style={{
                      background: 'none', border: 'none', cursor: 'pointer',
                      fontSize: 12, color: 'var(--text-tertiary)', fontWeight: 500,
                    }}
                  >
                    清空
                  </button>
                )}
                <button
                  onClick={() => setCenterVisible(false)}
                  style={{
                    background: 'var(--bg-tertiary)', border: 'none', borderRadius: 6,
                    cursor: 'pointer', padding: 4, display: 'flex', color: 'var(--text-tertiary)',
                  }}
                >
                  <X size={14} />
                </button>
              </div>
            </div>

            {alerts.length > 0 && (
              <div style={{
                padding: '10px 20px',
                background: 'rgba(239, 68, 68, 0.06)',
                borderBottom: '1px solid rgba(239, 68, 68, 0.12)',
                flexShrink: 0,
              }}>
                <div style={{ fontSize: 11, fontWeight: 600, color: '#ef4444', marginBottom: 6, display: 'flex', alignItems: 'center', gap: 4 }}>
                  <AlertTriangle size={12} />
                  当前活跃预警
                </div>
                {alerts.map(alert => {
                  const isRead = readAlertIds.includes(alert.id);
                  return (
                    <div
                      key={alert.id}
                      style={{
                        display: 'flex', alignItems: 'center', gap: 8,
                        padding: '6px 0',
                        opacity: isRead ? 0.5 : 1,
                        transition: 'opacity 0.2s ease',
                      }}
                    >
                      <AlertTriangle size={14} style={{ color: getWeatherLevelColor(alert.level), flexShrink: 0 }} />
                      <span style={{ fontSize: 12, color: 'var(--text-primary)', flex: 1, minWidth: 0, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                        {alert.title}
                      </span>
                      {!isRead && (
                        <span style={{
                          width: 6, height: 6, borderRadius: '50%',
                          background: '#ef4444', flexShrink: 0,
                        }} />
                      )}
                      <button
                        onClick={() => readAlert(alert.id)}
                        style={{
                          background: 'none', border: 'none', cursor: 'pointer',
                          fontSize: 11, color: isRead ? 'var(--text-tertiary)' : 'var(--primary-color)',
                          flexShrink: 0, fontWeight: 500,
                        }}
                      >
                        {isRead ? '已读' : '标记已读'}
                      </button>
                    </div>
                  );
                })}
              </div>
            )}

            {tabs.length > 1 && (
              <div style={{
                display: 'flex', gap: 4, padding: '8px 20px',
                borderBottom: '1px solid var(--border-light)',
                flexShrink: 0, overflowX: 'auto',
              }}>
                {tabs.map(tab => (
                  <button
                    key={tab.key}
                    onClick={() => setActiveTab(tab.key)}
                    style={{
                      padding: '4px 10px', borderRadius: 6,
                      border: 'none', cursor: 'pointer',
                      fontSize: 12, fontWeight: 500,
                      background: activeTab === tab.key ? 'var(--primary-color)' : 'var(--bg-tertiary)',
                      color: activeTab === tab.key ? '#fff' : 'var(--text-secondary)',
                      transition: 'all 0.15s ease',
                      whiteSpace: 'nowrap',
                    }}
                  >
                    {tab.label}
                  </button>
                ))}
              </div>
            )}

            <div 
              ref={scrollContainerRef}
              style={{ flex: 1, overflowY: 'auto', padding: '8px 0' }} 
              className="hide-scrollbar"
            >
              {filteredNotifications.length === 0 ? (
                <div style={{
                  display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center',
                  padding: '60px 20px', textAlign: 'center',
                  color: 'var(--text-tertiary)', fontSize: 13,
                  minHeight: '200px',
                }}>
                  <Clock size={32} style={{ marginBottom: 10, opacity: 0.4 }} />
                  <p style={{ margin: 0 }}>暂无通知记录</p>
                </div>
              ) : (
                filteredNotifications.map(n => (
                  <NotificationItem
                    key={n.id}
                    ref={(el) => {
                      notificationRefs.current[n.id] = el;
                    }}
                    notification={n}
                    highlight={highlightNotificationId === n.id}
                    onRead={() => markRead(n.id)}
                    onDelete={() => deleteNotification(n.id)}
                  />
                ))
              )}
            </div>
          </motion.div>
        </motion.div>
      )}
    </AnimatePresence>
  );
};

export default GlobalNotificationCenter;
