import React, { useState } from 'react';
import { motion } from 'framer-motion';
import { Type, Image, Mic, Link, Video, Tag, Play, Music, FileText, Package } from 'lucide-react';
import type { Creativity } from '@shared/types';
import { formatRelativeTime } from '../../utils/formatters';
import { toMediaUrl, toThumbnailUrl, getFileNameFromPath } from '../../utils/media';
import FavoriteBadge from '../common/FavoriteBadge';
import CreativityTag from '../common/CreativityTag';
import { Rate } from 'antd';
import { useVideoThumbnailWithPath } from '../../hooks/useVideoThumbnail';

// ===== 类型定义 =====

interface CardItemProps {
  creativity: Creativity;
  onClick: () => void;
  onContextMenu: (e: React.MouseEvent) => void;
}

// ===== 类型图标映射 =====

const TYPE_ICONS: Record<string, React.ReactNode> = {
  text: <Type size={14} />,
  image: <Image size={14} />,
  audio: <Mic size={14} />,
  link: <Link size={14} />,
  video: <Video size={14} />,
  document: <FileText size={14} />,
  other: <Package size={14} />,
};

const TYPE_LABELS: Record<string, string> = {
  text: '文本',
  image: '图片',
  audio: '音频',
  link: '链接',
  video: '视频',
  document: '文档',
  other: '其他',
};

// ===== 组件 =====

const CardItem: React.FC<CardItemProps> = ({
  creativity,
  onClick,
  onContextMenu,
}) => {
  const tags = creativity.tags || [];
  const [imgError, setImgError] = useState(false);
  const [thumbError, setThumbError] = useState(false);
  const videoThumbUrl = useVideoThumbnailWithPath(creativity.type, creativity.content, creativity.thumbnailPath);

  const displayContent = creativity.content;

  const renderMediaPreview = () => {
    if (creativity.type === 'image' && !imgError) {
      // 优先使用数据库中已缓存的 thumbnailPath
      let imgSrc = '';
      if (creativity.thumbnailPath && !thumbError) {
        const normalized = creativity.thumbnailPath.replace(/\\/g, '/');
        imgSrc = 'local-media:///' + encodeURI(normalized);
      }
      if (!imgSrc) {
        const thumbUrl = toThumbnailUrl(creativity.mediaFilePath || creativity.content);
        imgSrc = thumbUrl && !thumbError ? thumbUrl : toMediaUrl(creativity.mediaFilePath || creativity.content);
      }
      return (
        <div style={{
          width: '100%', height: 120, borderRadius: 8, overflow: 'hidden',
          marginBottom: 8, position: 'relative',
        }}>
          <img
            src={imgSrc}
            alt={creativity.title}
            draggable={false}
            onError={() => {
              if (!thumbError && thumbUrl) {
                setThumbError(true);
              } else {
                setImgError(true);
              }
            }}
            style={{
              width: '100%', height: '100%', objectFit: 'cover',
            }}
          />
        </div>
      );
    }

    if (creativity.type === 'image' && imgError) {
      return (
        <div style={{
          width: '100%', height: 80, borderRadius: 8, overflow: 'hidden',
          marginBottom: 8, display: 'flex', alignItems: 'center', justifyContent: 'center',
          background: 'linear-gradient(135deg, #f093fb 0%, #f5576c 100%)',
        }}>
          <Image size={28} style={{ color: 'rgba(255,255,255,0.7)' }} />
        </div>
      );
    }

    if (creativity.type === 'video') {
      return (
        <div style={{
          width: '100%', height: 120, borderRadius: 8, overflow: 'hidden',
          marginBottom: 8, display: 'flex', alignItems: 'center', justifyContent: 'center',
          background: videoThumbUrl ? 'transparent' : 'linear-gradient(135deg, #fa709a 0%, #fee140 100%)',
          position: 'relative',
        }}>
          {videoThumbUrl && (
            <img
              src={videoThumbUrl}
              alt={creativity.title}
              draggable={false}
              style={{
                width: '100%', height: '100%', objectFit: 'cover',
                position: 'absolute', top: 0, left: 0,
              }}
            />
          )}
          <div style={{
            width: 40, height: 40, borderRadius: '50%',
            background: 'rgba(0,0,0,0.35)', backdropFilter: 'blur(4px)',
            display: 'flex', alignItems: 'center', justifyContent: 'center',
            position: 'relative', zIndex: 1,
          }}>
            <Play size={20} style={{ color: 'white', marginLeft: 2 }} />
          </div>
          <div style={{
            position: 'absolute', bottom: 6, left: 8, right: 8,
            fontSize: 10, color: 'rgba(255,255,255,0.8)',
            overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap',
            zIndex: 1,
            textShadow: videoThumbUrl ? '0 1px 3px rgba(0,0,0,0.5)' : 'none',
          }}>
            {getFileNameFromPath(creativity.content) || '视频文件'}
          </div>
        </div>
      );
    }

    if (creativity.type === 'audio') {
      return (
        <div style={{
          width: '100%', padding: '12px 16px', borderRadius: 8, overflow: 'hidden',
          marginBottom: 8, display: 'flex', alignItems: 'center', gap: 10,
          background: 'linear-gradient(135deg, #4facfe 0%, #00f2fe 100%)',
        }}>
          <Music size={20} style={{ color: 'rgba(255,255,255,0.9)' }} />
          <div style={{ flex: 1, overflow: 'hidden' }}>
            <div style={{ fontSize: 12, color: 'white', fontWeight: 600, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
              {creativity.title}
            </div>
            <div style={{ fontSize: 10, color: 'rgba(255,255,255,0.7)' }}>
              {getFileNameFromPath(creativity.content) || '音频文件'}
            </div>
          </div>
        </div>
      );
    }

    if (creativity.type === 'document') {
      return (
        <div style={{
          width: '100%', padding: '12px 16px', borderRadius: 8, overflow: 'hidden',
          marginBottom: 8, display: 'flex', alignItems: 'center', gap: 10,
          background: 'linear-gradient(135deg, #667eea 0%, #764ba2 100%)',
        }}>
          <FileText size={20} style={{ color: 'rgba(255,255,255,0.9)' }} />
          <div style={{ flex: 1, overflow: 'hidden' }}>
            <div style={{ fontSize: 12, color: 'white', fontWeight: 600, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
              {creativity.title}
            </div>
            <div style={{ fontSize: 10, color: 'rgba(255,255,255,0.7)' }}>
              {getFileNameFromPath(creativity.content) || '文档文件'}
            </div>
          </div>
        </div>
      );
    }

    return null;
  };

  return (
    <motion.div
      className="bg-[var(--bg-primary)] rounded-xl border border-[var(--border-color)] p-4 hover:shadow-md transition-all cursor-pointer"
      whileHover={{ y: -2, boxShadow: '0 4px 12px rgba(0, 0, 0, 0.1)' }}
      whileTap={{ scale: 0.98 }}
      onClick={onClick}
      onContextMenu={onContextMenu}
      style={{
        minHeight: 120,
        display: 'flex',
        flexDirection: 'column',
        position: 'relative',
        overflow: 'hidden',
      }}
    >
      {!creativity.isRead && (
        <div style={{
          position: 'absolute', top: 8, right: 8,
          width: 8, height: 8, borderRadius: '50%',
          backgroundColor: 'var(--primary-color)',
          boxShadow: '0 0 0 2px var(--bg-primary)',
          zIndex: 3,
        }} />
      )}
      {/* 媒体预览 - 优先展示 */}
      {renderMediaPreview()}

      {/* 头部 */}
      <div className="flex items-start justify-between mb-3">
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2 mb-2">
            <span className="flex items-center gap-1 text-xs text-[var(--text-tertiary)]">
              {TYPE_ICONS[creativity.type]}
              {TYPE_LABELS[creativity.type]}
            </span>
            {creativity.priority > 0 && (
              <Rate disabled count={5} value={creativity.priority} style={{ fontSize: 10 }} />
            )}
          </div>
          <h3 className="text-sm font-semibold text-[var(--text-primary)] truncate mb-1">
            {creativity.title}
          </h3>
        </div>
      </div>

      {/* 内容 */}
      <div className="flex-1 min-h-0 mb-3">
        {creativity.type === 'text' || creativity.type === 'link' ? (
          <p className="text-xs text-[var(--text-secondary)] leading-relaxed" style={{ wordBreak: 'break-word' }}>
            {displayContent}
          </p>
        ) : (
          <p className="text-xs text-[var(--text-tertiary)] leading-relaxed" style={{ wordBreak: 'break-word' }}>
            {getFileNameFromPath(creativity.content) || displayContent}
          </p>
        )}
      </div>

      {/* 底部 */}
      <div className="flex items-center justify-between">
        {/* 标签 */}
        {tags.length > 0 && (
          <div className="flex items-center gap-1">
            {tags.slice(0, 2).map((tag) => (
              <CreativityTag key={tag.id} tag={tag} />
            ))}
            {tags.length > 2 && (
              <span className="text-xs text-[var(--text-tertiary)]">+{tags.length - 2}</span>
            )}
          </div>
        )}

        {/* 时间 */}
        <span className="text-xs text-[var(--text-tertiary)]">
          {formatRelativeTime(creativity.updatedAt || creativity.createdAt)}
        </span>
      </div>
      {(creativity.isFavorite || (creativity as any).is_favorite === 1) && <FavoriteBadge size={24} />}
    </motion.div>
  );
};

export default CardItem;