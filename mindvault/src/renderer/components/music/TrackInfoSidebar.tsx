import React, { useState, useEffect, useCallback } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { X, Loader2, Pencil, Check, RotateCcw } from 'lucide-react';
import { Input, message } from 'antd';
import { api } from '../../utils/api';

/**
 * 侧边栏组件 Props 接口
 */
interface TrackInfoSidebarProps {
  /** 是否显示侧边栏 */
  visible: boolean;
  /** 曲目 ID */
  trackId: string | null;
  /** 曲目来源：本地或在线 */
  trackSource: 'local' | 'online';
  /** 关闭侧边栏回调 */
  onClose: () => void;
  /** 更新成功后的回调 */
  onUpdated?: () => void;
  /** 是否以编辑模式打开 */
  initialEditMode?: boolean;
}

/**
 * 本地曲目详情结构
 */
interface LocalTrackDetail {
  id: string;
  title: string;
  artist: string;
  album: string;
  src: string;
  duration: number;
  coverUrl: string;
  source: string;
  addedAt: number;
  lyricsFile?: string;
  tags?: string[];
  playlists?: string[];
}

/**
 * 在线曲目详情结构
 */
interface OnlineTrackDetail {
  id: string;
  name: string;
  singer: string;
  album: string;
  albumId?: string;
  coverUrl: string;
  duration: number;
  pay: number;
  quality?: string;
  publishTime?: string;
}

/**
 * 曲目信息侧边栏组件
 * 附着在音乐管理器左侧，支持本地歌曲和在线歌曲的详情查看与编辑
 */
const TrackInfoSidebar: React.FC<TrackInfoSidebarProps> = ({
  visible,
  trackId,
  trackSource,
  onClose,
  onUpdated,
  initialEditMode = false,
}) => {
  const [loading, setLoading] = useState(false);
  const [saving, setSaving] = useState(false);
  const [localTrack, setLocalTrack] = useState<LocalTrackDetail | null>(null);
  const [onlineTrack, setOnlineTrack] = useState<OnlineTrackDetail | null>(null);
  const [isEditing, setIsEditing] = useState(initialEditMode);

  // 本地歌曲可编辑字段
  const [editTitle, setEditTitle] = useState('');
  const [editArtist, setEditArtist] = useState('');
  const [editAlbum, setEditAlbum] = useState('');

  /**
   * 加载本地曲目详情
   */
  const loadLocalTrackDetail = useCallback(async () => {
    if (!trackId) return;
    setLoading(true);
    try {
      const res = await api.music.getTrack(trackId);
      const data = res?.data || res;
      if (data) {
        setLocalTrack(data);
        setEditTitle(data.title || '');
        setEditArtist(data.artist || '');
        setEditAlbum(data.album || '');
      }
    } catch (err) {
      console.warn('[TrackInfoSidebar] 加载本地曲目详情失败:', err);
      message.error('加载曲目详情失败');
    } finally {
      setLoading(false);
    }
  }, [trackId]);

  /**
   * 加载在线曲目详情
   */
  const loadOnlineTrackDetail = useCallback(async () => {
    if (!trackId) return;
    setLoading(true);
    try {
      const res = await api.musicOnline.getFullDetail(trackId);
      const data = res?.data || res;
      if (data) {
        setOnlineTrack(data);
      }
    } catch (err) {
      console.warn('[TrackInfoSidebar] 加载在线曲目详情失败:', err);
      message.error('加载曲目详情失败');
    } finally {
      setLoading(false);
    }
  }, [trackId]);

  // 根据来源加载曲目详情
  useEffect(() => {
    if (visible && trackId) {
      if (trackSource === 'local') {
        loadLocalTrackDetail();
      } else {
        loadOnlineTrackDetail();
      }
    } else {
      // 关闭时重置状态
      setLocalTrack(null);
      setOnlineTrack(null);
      setEditTitle('');
      setEditArtist('');
      setEditAlbum('');
      setIsEditing(false);
    }
  }, [visible, trackId, trackSource, loadLocalTrackDetail, loadOnlineTrackDetail]);

  // 当初始编辑模式变化时更新
  useEffect(() => {
    if (visible) {
      setIsEditing(initialEditMode);
    }
  }, [initialEditMode, visible]);

  /**
   * 保存本地曲目编辑
   */
  const handleSave = useCallback(async () => {
    if (!trackId) return;
    setSaving(true);
    try {
      await api.music.updateTrack(trackId, {
        title: editTitle,
        artist: editArtist,
        album: editAlbum,
      });
      message.success('保存成功');
      onUpdated?.();
      // 重新加载数据
      await loadLocalTrackDetail();
      setIsEditing(false);
    } catch (err) {
      console.warn('[TrackInfoSidebar] 保存失败:', err);
      message.error('保存失败');
    } finally {
      setSaving(false);
    }
  }, [trackId, editTitle, editArtist, editAlbum, onUpdated, loadLocalTrackDetail]);

  /**
   * 取消编辑
   */
  const handleCancelEdit = useCallback(() => {
    if (localTrack) {
      setEditTitle(localTrack.title || '');
      setEditArtist(localTrack.artist || '');
      setEditAlbum(localTrack.album || '');
    }
    setIsEditing(false);
  }, [localTrack]);

  /**
   * 进入编辑模式
   */
  const handleEnterEdit = useCallback(() => {
    setIsEditing(true);
  }, []);

  /**
   * 格式化时长（秒 -> m:ss）
   */
  const formatDuration = (seconds: number): string => {
    if (!seconds || seconds <= 0) return '--:--';
    const m = Math.floor(seconds / 60);
    const s = Math.floor(seconds % 60);
    return `${m}:${s.toString().padStart(2, '0')}`;
  };

  /**
   * 格式化时间戳为可读日期
   */
  const formatTimestamp = (ts: number): string => {
    if (!ts) return '--';
    const d = new Date(ts);
    return d.toLocaleString('zh-CN', {
      year: 'numeric',
      month: '2-digit',
      day: '2-digit',
      hour: '2-digit',
      minute: '2-digit',
    });
  };

  /**
   * 获取音质描述
   */
  const getQualityLabel = (pay: number): string => {
    if (pay === 1) return 'VIP';
    if (pay === 4) return 'SQ';
    if (pay === 8) return '免费';
    return '普通';
  };

  /**
   * 信息行组件（只读）
   */
  const InfoRow: React.FC<{ label: string; value: string | number | undefined }> = ({
    label,
    value,
  }) => (
    <div
      style={{
        display: 'flex',
        gap: 12,
        padding: '6px 0',
        borderBottom: '1px solid var(--border-light)',
      }}
    >
      <span
        style={{
          fontSize: 11,
          color: 'var(--text-tertiary)',
          width: 64,
          flexShrink: 0,
          lineHeight: '20px',
        }}
      >
        {label}
      </span>
      <span
        style={{
          fontSize: 11,
          color: 'var(--text-primary)',
          lineHeight: '20px',
          wordBreak: 'break-all',
          flex: 1,
        }}
      >
        {value || '--'}
      </span>
    </div>
  );

  /**
   * 编辑行组件
   */
  const EditRow: React.FC<{
    label: string;
    value: string;
    onChange: (val: string) => void;
  }> = ({ label, value, onChange }) => (
    <div
      style={{
        display: 'flex',
        gap: 12,
        padding: '6px 0',
        alignItems: 'center',
      }}
    >
      <span
        style={{
          fontSize: 11,
          color: 'var(--text-tertiary)',
          width: 64,
          flexShrink: 0,
          lineHeight: '28px',
        }}
      >
        {label}
      </span>
      <Input
        value={value}
        onChange={(e) => onChange(e.target.value)}
        size="small"
        style={{
          flex: 1,
          backgroundColor: 'var(--bg-tertiary)',
          borderColor: 'var(--border-light)',
          color: 'var(--text-primary)',
          fontSize: 11,
        }}
      />
    </div>
  );

  /**
   * 阻止事件冒泡，防止触发拖动
   */
  const stopPropagation = useCallback((e: React.MouseEvent) => {
    e.stopPropagation();
  }, []);

  return (
    <AnimatePresence>
      {visible && (
        <motion.div
          initial={{ x: -280, opacity: 0 }}
          animate={{ x: 0, opacity: 1 }}
          exit={{ x: -280, opacity: 0 }}
          transition={{ type: 'spring', damping: 25, stiffness: 200 }}
          onMouseDown={stopPropagation}
          style={{
            position: 'absolute',
            top: 0,
            right: '100%',
            width: 280,
            height: '100%',
            marginRight: 8,
            backgroundColor: 'var(--bg-secondary)',
            borderRadius: 12,
            border: '1px solid var(--border-color)',
            boxShadow: '0 16px 48px rgba(0,0,0,0.3)',
            zIndex: 1,
            display: 'flex',
            flexDirection: 'column',
            overflow: 'hidden',
          }}
        >
          {/* 顶部标题栏 */}
          <div
            style={{
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'space-between',
              padding: '12px 16px',
              borderBottom: '1px solid var(--border-light)',
              flexShrink: 0,
            }}
          >
            <span
              style={{
                fontSize: 13,
                fontWeight: 600,
                color: 'var(--text-primary)',
              }}
            >
              曲目信息
              {trackSource === 'online' && (
                <span
                  style={{
                    fontSize: 10,
                    fontWeight: 400,
                    color: 'var(--text-tertiary)',
                    marginLeft: 6,
                  }}
                >
                  (在线)
                </span>
              )}
            </span>
            <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
              {/* 编辑/保存按钮组 */}
              {trackSource === 'local' && localTrack && (
                <>
                  {isEditing ? (
                    <>
                      {/* 保存按钮 */}
                      <motion.button
                        whileHover={{ scale: 1.1 }}
                        whileTap={{ scale: 0.9 }}
                        onClick={handleSave}
                        disabled={saving}
                        style={{
                          display: 'flex',
                          alignItems: 'center',
                          justifyContent: 'center',
                          width: 24,
                          height: 24,
                          borderRadius: 6,
                          border: 'none',
                          backgroundColor: 'var(--primary-color)',
                          cursor: saving ? 'wait' : 'pointer',
                          color: 'white',
                        }}
                        title="保存"
                      >
                        {saving ? (
                          <Loader2 size={12} style={{ animation: 'spin 1s linear infinite' }} />
                        ) : (
                          <Check size={12} />
                        )}
                      </motion.button>
                      {/* 取消按钮 */}
                      <motion.button
                        whileHover={{ scale: 1.1 }}
                        whileTap={{ scale: 0.9 }}
                        onClick={handleCancelEdit}
                        disabled={saving}
                        style={{
                          display: 'flex',
                          alignItems: 'center',
                          justifyContent: 'center',
                          width: 24,
                          height: 24,
                          borderRadius: 6,
                          border: 'none',
                          backgroundColor: 'var(--bg-tertiary)',
                          cursor: saving ? 'not-allowed' : 'pointer',
                          color: 'var(--text-tertiary)',
                        }}
                        title="取消"
                      >
                        <RotateCcw size={12} />
                      </motion.button>
                    </>
                  ) : (
                    /* 编辑按钮 */
                    <motion.button
                      whileHover={{ scale: 1.1 }}
                      whileTap={{ scale: 0.9 }}
                      onClick={handleEnterEdit}
                      style={{
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'center',
                        width: 24,
                        height: 24,
                        borderRadius: 6,
                        border: 'none',
                        backgroundColor: 'var(--bg-tertiary)',
                        cursor: 'pointer',
                        color: 'var(--text-tertiary)',
                      }}
                      title="编辑信息"
                    >
                      <Pencil size={12} />
                    </motion.button>
                  )}
                </>
              )}
              {/* 关闭按钮 */}
              <motion.button
                whileHover={{ scale: 1.1 }}
                whileTap={{ scale: 0.9 }}
                onClick={onClose}
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  width: 24,
                  height: 24,
                  borderRadius: 6,
                  border: 'none',
                  backgroundColor: 'var(--bg-tertiary)',
                  cursor: 'pointer',
                  color: 'var(--text-tertiary)',
                }}
                title="关闭"
              >
                <X size={14} />
              </motion.button>
            </div>
          </div>

          {/* 内容区域 */}
          <div
            style={{
              flex: 1,
              overflow: 'auto',
              padding: '12px 16px',
            }}
          >
            {loading ? (
              /* 加载状态 */
              <div
                style={{
                  display: 'flex',
                  flexDirection: 'column',
                  alignItems: 'center',
                  justifyContent: 'center',
                  padding: '48px 0',
                  gap: 8,
                }}
              >
                <Loader2
                  size={20}
                  style={{ color: 'var(--text-tertiary)', animation: 'spin 1s linear infinite' }}
                />
                <span style={{ fontSize: 11, color: 'var(--text-tertiary)' }}>
                  加载中...
                </span>
              </div>
            ) : trackSource === 'local' && localTrack ? (
              /* 本地曲目详情 */
              <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
                {/* 封面图 */}
                {localTrack.coverUrl && (
                  <div
                    style={{
                      display: 'flex',
                      justifyContent: 'center',
                      marginBottom: 4,
                    }}
                  >
                    <img
                      src={localTrack.coverUrl}
                      alt="封面"
                      style={{
                        width: 140,
                        height: 140,
                        borderRadius: 8,
                        objectFit: 'cover',
                        boxShadow: '0 4px 12px rgba(0,0,0,0.2)',
                      }}
                      onError={(e) => {
                        (e.target as HTMLImageElement).style.display = 'none';
                      }}
                    />
                  </div>
                )}

                {/* 可编辑字段 */}
                <div
                  style={{
                    padding: '10px 12px',
                    borderRadius: 8,
                    backgroundColor: 'var(--bg-tertiary)',
                  }}
                >
                  <div
                    style={{
                      fontSize: 10,
                      color: 'var(--text-tertiary)',
                      marginBottom: 4,
                      fontWeight: 500,
                    }}
                  >
                    {isEditing ? '编辑信息' : '基本信息'}
                  </div>
                  {isEditing ? (
                    <>
                      <EditRow label="标题" value={editTitle} onChange={setEditTitle} />
                      <EditRow label="艺术家" value={editArtist} onChange={setEditArtist} />
                      <EditRow label="专辑" value={editAlbum} onChange={setEditAlbum} />
                    </>
                  ) : (
                    <>
                      <InfoRow label="标题" value={localTrack.title} />
                      <InfoRow label="艺术家" value={localTrack.artist} />
                      <InfoRow label="专辑" value={localTrack.album} />
                    </>
                  )}
                </div>

                {/* 详细信息 */}
                <div
                  style={{
                    padding: '10px 12px',
                    borderRadius: 8,
                    backgroundColor: 'var(--bg-tertiary)',
                  }}
                >
                  <div
                    style={{
                      fontSize: 10,
                      color: 'var(--text-tertiary)',
                      marginBottom: 4,
                      fontWeight: 500,
                    }}
                  >
                    详细信息
                  </div>
                  <InfoRow label="时长" value={formatDuration(localTrack.duration)} />
                  <InfoRow label="来源" value={localTrack.source || 'local'} />
                  <InfoRow label="文件路径" value={localTrack.src} />
                  <InfoRow label="添加时间" value={formatTimestamp(localTrack.addedAt)} />
                  {localTrack.coverUrl && (
                    <InfoRow label="封面URL" value={localTrack.coverUrl} />
                  )}
                  {localTrack.lyricsFile && (
                    <InfoRow label="歌词文件" value={localTrack.lyricsFile} />
                  )}
                </div>

                {/* 标签/歌单归属 */}
                {localTrack.tags && localTrack.tags.length > 0 && (
                  <div
                    style={{
                      padding: '10px 12px',
                      borderRadius: 8,
                      backgroundColor: 'var(--bg-tertiary)',
                    }}
                  >
                    <div
                      style={{
                        fontSize: 10,
                        color: 'var(--text-tertiary)',
                        marginBottom: 6,
                        fontWeight: 500,
                      }}
                    >
                      标签
                    </div>
                    <div style={{ display: 'flex', flexWrap: 'wrap', gap: 4 }}>
                      {localTrack.tags.map((tag, idx) => (
                        <span
                          key={idx}
                          style={{
                            fontSize: 10,
                            color: 'var(--primary-color)',
                            backgroundColor: 'rgba(var(--primary-color-rgb), 0.1)',
                            padding: '2px 8px',
                            borderRadius: 10,
                          }}
                        >
                          {tag}
                        </span>
                      ))}
                    </div>
                  </div>
                )}

                {localTrack.playlists && localTrack.playlists.length > 0 && (
                  <div
                    style={{
                      padding: '10px 12px',
                      borderRadius: 8,
                      backgroundColor: 'var(--bg-tertiary)',
                    }}
                  >
                    <div
                      style={{
                        fontSize: 10,
                        color: 'var(--text-tertiary)',
                        marginBottom: 6,
                        fontWeight: 500,
                      }}
                    >
                      所属歌单
                    </div>
                    <div style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
                      {localTrack.playlists.map((pl, idx) => (
                        <span
                          key={idx}
                          style={{
                            fontSize: 11,
                            color: 'var(--text-primary)',
                          }}
                        >
                          {pl}
                        </span>
                      ))}
                    </div>
                  </div>
                )}
              </div>
            ) : trackSource === 'online' && onlineTrack ? (
              /* 在线曲目详情 */
              <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
                {/* 封面图 */}
                {onlineTrack.coverUrl && (
                  <div
                    style={{
                      display: 'flex',
                      justifyContent: 'center',
                      marginBottom: 4,
                    }}
                  >
                    <img
                      src={onlineTrack.coverUrl}
                      alt="封面"
                      style={{
                        width: 140,
                        height: 140,
                        borderRadius: 8,
                        objectFit: 'cover',
                        boxShadow: '0 4px 12px rgba(0,0,0,0.2)',
                      }}
                      onError={(e) => {
                        (e.target as HTMLImageElement).style.display = 'none';
                      }}
                    />
                  </div>
                )}

                {/* 歌曲名称 */}
                <div
                  style={{
                    padding: '10px 12px',
                    borderRadius: 8,
                    backgroundColor: 'var(--bg-tertiary)',
                  }}
                >
                  <div
                    style={{
                      fontSize: 12,
                      fontWeight: 600,
                      color: 'var(--text-primary)',
                      wordBreak: 'break-all',
                    }}
                  >
                    {onlineTrack.name}
                  </div>
                </div>

                {/* 详细信息 */}
                <div
                  style={{
                    padding: '10px 12px',
                    borderRadius: 8,
                    backgroundColor: 'var(--bg-tertiary)',
                  }}
                >
                  <div
                    style={{
                      fontSize: 10,
                      color: 'var(--text-tertiary)',
                      marginBottom: 4,
                      fontWeight: 500,
                    }}
                  >
                    详细信息
                  </div>
                  <InfoRow label="歌手" value={onlineTrack.singer} />
                  <InfoRow label="专辑" value={onlineTrack.album} />
                  <InfoRow label="时长" value={formatDuration(onlineTrack.duration)} />
                  <InfoRow
                    label="音质"
                    value={`${getQualityLabel(onlineTrack.pay)}${
                      onlineTrack.quality ? ` / ${onlineTrack.quality}` : ''
                    }`}
                  />
                  {onlineTrack.publishTime && (
                    <InfoRow label="发行时间" value={onlineTrack.publishTime} />
                  )}
                  <InfoRow label="歌曲ID" value={onlineTrack.id} />
                  {onlineTrack.albumId && (
                    <InfoRow label="专辑ID" value={onlineTrack.albumId} />
                  )}
                </div>

                {/* VIP 提示 */}
                {onlineTrack.pay === 1 && (
                  <div
                    style={{
                      padding: '10px 12px',
                      borderRadius: 8,
                      backgroundColor: 'rgba(245, 158, 11, 0.08)',
                      border: '1px solid rgba(245, 158, 11, 0.2)',
                    }}
                  >
                    <span style={{ fontSize: 11, color: '#f59e0b' }}>
                      此歌曲为 VIP 歌曲，登录后可播放完整高品质音乐
                    </span>
                  </div>
                )}
              </div>
            ) : (
              /* 无数据状态 */
              <div
                style={{
                  display: 'flex',
                  flexDirection: 'column',
                  alignItems: 'center',
                  justifyContent: 'center',
                  padding: '48px 0',
                  gap: 8,
                }}
              >
                <span style={{ fontSize: 11, color: 'var(--text-tertiary)' }}>
                  未找到曲目信息
                </span>
              </div>
            )}
          </div>
        </motion.div>
      )}
    </AnimatePresence>
  );
};

export default TrackInfoSidebar;
