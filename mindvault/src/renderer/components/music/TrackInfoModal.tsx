import React, { useState, useEffect, useCallback } from 'react';
import { Modal, Input, message } from 'antd';
import { api } from '../../utils/api';

interface TrackInfoModalProps {
  visible: boolean;
  trackId: string | null;
  onClose: () => void;
  onUpdated?: () => void;
}

interface TrackDetail {
  id: string;
  title: string;
  artist: string;
  album: string;
  src: string;
  duration: number;
  coverUrl: string;
  source: string;
  addedAt: number;
}

/**
 * 曲目信息查看/编辑弹窗
 * 支持查看曲目详细信息，并编辑标题、艺术家、专辑
 */
const TrackInfoModal: React.FC<TrackInfoModalProps> = ({
  visible,
  trackId,
  onClose,
  onUpdated,
}) => {
  const [loading, setLoading] = useState(false);
  const [saving, setSaving] = useState(false);
  const [track, setTrack] = useState<TrackDetail | null>(null);

  // 可编辑字段
  const [editTitle, setEditTitle] = useState('');
  const [editArtist, setEditArtist] = useState('');
  const [editAlbum, setEditAlbum] = useState('');

  // 加载曲目详情
  const loadTrackDetail = useCallback(async () => {
    if (!trackId) return;
    setLoading(true);
    try {
      const res = await api.music.getTrack(trackId);
      const data = res?.data || res;
      if (data) {
        setTrack(data);
        setEditTitle(data.title || '');
        setEditArtist(data.artist || '');
        setEditAlbum(data.album || '');
      }
    } catch (err) {
      console.warn('[TrackInfoModal] 加载曲目详情失败:', err);
      message.error('加载曲目详情失败');
    } finally {
      setLoading(false);
    }
  }, [trackId]);

  useEffect(() => {
    if (visible && trackId) {
      loadTrackDetail();
    } else {
      setTrack(null);
      setEditTitle('');
      setEditArtist('');
      setEditAlbum('');
    }
  }, [visible, trackId, loadTrackDetail]);

  // 保存编辑
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
      onClose();
    } catch (err) {
      console.warn('[TrackInfoModal] 保存失败:', err);
      message.error('保存失败');
    } finally {
      setSaving(false);
    }
  }, [trackId, editTitle, editArtist, editAlbum, onUpdated, onClose]);

  // 格式化时长
  const formatDuration = (seconds: number) => {
    if (!seconds || seconds <= 0) return '--:--';
    const m = Math.floor(seconds / 60);
    const s = Math.floor(seconds % 60);
    return `${m}:${s.toString().padStart(2, '0')}`;
  };

  // 格式化时间戳
  const formatTimestamp = (ts: number) => {
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

  // 信息行组件
  const InfoRow: React.FC<{ label: string; value: string }> = ({ label, value }) => (
    <div
      style={{
        display: 'flex',
        gap: 12,
        padding: '8px 0',
        borderBottom: '1px solid var(--border-light)',
      }}
    >
      <span
        style={{
          fontSize: 12,
          color: 'var(--text-tertiary)',
          width: 70,
          flexShrink: 0,
          lineHeight: '22px',
        }}
      >
        {label}
      </span>
      <span
        style={{
          fontSize: 12,
          color: 'var(--text-primary)',
          lineHeight: '22px',
          wordBreak: 'break-all',
        }}
      >
        {value || '--'}
      </span>
    </div>
  );

  // 编辑行组件
  const EditRow: React.FC<{
    label: string;
    value: string;
    onChange: (val: string) => void;
  }> = ({ label, value, onChange }) => (
    <div
      style={{
        display: 'flex',
        gap: 12,
        padding: '8px 0',
        alignItems: 'center',
      }}
    >
      <span
        style={{
          fontSize: 12,
          color: 'var(--text-tertiary)',
          width: 70,
          flexShrink: 0,
          lineHeight: '32px',
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
          fontSize: 12,
        }}
      />
    </div>
  );

  return (
    <Modal
      open={visible}
      title="曲目信息"
      onCancel={onClose}
      onOk={handleSave}
      okText="保存"
      cancelText="取消"
      confirmLoading={saving}
      width={440}
      centered
      styles={{
        mask: { backgroundColor: 'rgba(0,0,0,0.5)' },
        content: {
          backgroundColor: 'var(--bg-secondary)',
          color: 'var(--text-primary)',
        },
        header: {
          backgroundColor: 'var(--bg-secondary)',
          color: 'var(--text-primary)',
        },
      }}
    >
      {loading ? (
        <div
          style={{
            display: 'flex',
            justifyContent: 'center',
            alignItems: 'center',
            padding: '40px 0',
            color: 'var(--text-tertiary)',
            fontSize: 12,
          }}
        >
          加载中...
        </div>
      ) : track ? (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
          {/* 封面 */}
          {track.coverUrl && (
            <div
              style={{
                display: 'flex',
                justifyContent: 'center',
                marginBottom: 8,
              }}
            >
              <img
                src={track.coverUrl}
                alt="封面"
                style={{
                  width: 120,
                  height: 120,
                  borderRadius: 8,
                  objectFit: 'cover',
                  boxShadow: '0 4px 12px rgba(0,0,0,0.2)',
                }}
              />
            </div>
          )}

          {/* 可编辑字段 */}
          <div
            style={{
              padding: '8px 12px',
              borderRadius: 8,
              backgroundColor: 'var(--bg-tertiary)',
              marginBottom: 4,
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
              可编辑信息
            </div>
            <EditRow label="标题" value={editTitle} onChange={setEditTitle} />
            <EditRow label="艺术家" value={editArtist} onChange={setEditArtist} />
            <EditRow label="专辑" value={editAlbum} onChange={setEditAlbum} />
          </div>

          {/* 只读信息 */}
          <div
            style={{
              padding: '8px 12px',
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
            <InfoRow
              label="时长"
              value={formatDuration(track.duration)}
            />
            <InfoRow label="来源" value={track.source || 'local'} />
            <InfoRow label="文件路径" value={track.src} />
            <InfoRow
              label="添加时间"
              value={formatTimestamp(track.addedAt)}
            />
            {track.coverUrl && (
              <InfoRow label="封面URL" value={track.coverUrl} />
            )}
          </div>
        </div>
      ) : (
        <div
          style={{
            display: 'flex',
            justifyContent: 'center',
            alignItems: 'center',
            padding: '40px 0',
            color: 'var(--text-tertiary)',
            fontSize: 12,
          }}
        >
          未找到曲目信息
        </div>
      )}
    </Modal>
  );
};

export default TrackInfoModal;
