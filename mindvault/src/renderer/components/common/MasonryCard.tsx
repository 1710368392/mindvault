import React, { useState } from 'react';
import { motion } from 'framer-motion';
import {
  FileText, Image, Mic, Link as LinkIcon, Video,
  Clock, Play, Music, Package
} from 'lucide-react';
import { formatRelativeTime, getCreativityTypeLabel } from '../../utils/formatters';
import { toMediaUrl, toThumbnailUrl, getFileNameFromPath } from '../../utils/media';
import FavoriteBadge from './FavoriteBadge';
import CreativityTag from './CreativityTag';
import type { Creativity } from '@shared/types';
import { Typography } from 'antd';

interface MasonryCardProps {
  creativity: Creativity;
  onClick: () => void;
  onContextMenu: (e: React.MouseEvent) => void;
}

const typeIcons = {
  text: FileText,
  image: Image,
  audio: Mic,
  link: LinkIcon,
  video: Video,
  document: FileText,
  other: Package,
};

const MasonryCard: React.FC<MasonryCardProps> = ({ creativity, onClick, onContextMenu }) => {
  const Icon = typeIcons[creativity.type] || FileText;
  const [imgError, setImgError] = useState(false);
  const [thumbError, setThumbError] = useState(false);

  const isMediaContent = creativity.type === 'image' || creativity.type === 'audio' || creativity.type === 'video' || creativity.type === 'document';
  const hasMediaPath = (creativity.mediaFilePath || creativity.content) && (
    /^[A-Za-z]:\\/.test(creativity.mediaFilePath || creativity.content) ||
    (creativity.mediaFilePath || creativity.content).startsWith('/') ||
    (creativity.mediaFilePath || creativity.content).startsWith('local-media://') ||
    (creativity.mediaFilePath || creativity.content).startsWith('media://') ||
    (creativity.mediaFilePath || creativity.content).startsWith('data:') ||
    (creativity.mediaFilePath || creativity.content).startsWith('http://') ||
    (creativity.mediaFilePath || creativity.content).startsWith('https://')
  );

  const renderMediaPreview = () => {
    if (!isMediaContent || !hasMediaPath) return null;

    if (creativity.type === 'image' && !imgError) {
      // 直接使用原图，不使用低分辨率缩略图
      const imgSrc = toMediaUrl(creativity.mediaFilePath || creativity.content);
      return (
        <div style={{ padding: '0 16px', marginBottom: 8 }}>
          <div style={{
            width: '100%', aspectRatio: '4/3', borderRadius: 10,
            overflow: 'hidden', background: 'var(--bg-tertiary)',
          }}>
            <img
                src={imgSrc}
                alt={creativity.title}
                draggable={false}
                onError={() => setImgError(true)}
                loading="eager"
                decoding="async"
                style={{ 
                  width: '100%', height: '100%', objectFit: 'cover',
                  imageRendering: 'high-quality',
                }}
              />
          </div>
        </div>
      );
    }

    if (creativity.type === 'image' && imgError) {
      return (
        <div style={{ padding: '0 16px', marginBottom: 8 }}>
          <div style={{
            width: '100%', height: 80, borderRadius: 10,
            display: 'flex', alignItems: 'center', justifyContent: 'center',
            background: 'linear-gradient(135deg, #f093fb 0%, #f5576c 100%)',
          }}>
            <Image size={28} style={{ color: 'rgba(255,255,255,0.7)' }} />
          </div>
        </div>
      );
    }

    if (creativity.type === 'video') {
      const videoSrc = toMediaUrl(creativity.mediaFilePath || creativity.content);
      return (
        <div style={{ padding: '0 16px', marginBottom: 8 }}>
          <div style={{
            width: '100%', height: 140, borderRadius: 10,
            display: 'flex', alignItems: 'center', justifyContent: 'center',
            background: 'linear-gradient(135deg, #fa709a 0%, #fee140 100%)',
            position: 'relative', overflow: 'hidden',
          }}>
            {videoSrc && (
              <video
                src={videoSrc}
                autoPlay
                loop
                muted
                playsInline
                draggable={false}
                preload="auto"
                style={{
                  width: '100%', height: '100%', objectFit: 'cover',
                  position: 'absolute', top: 0, left: 0,
                  imageRendering: 'high-quality',
                }}
              />
            )}
            <div style={{
              width: 44, height: 44, borderRadius: '50%',
              background: 'rgba(0,0,0,0.35)', backdropFilter: 'blur(4px)',
              display: 'flex', alignItems: 'center', justifyContent: 'center',
              position: 'relative', zIndex: 1,
            }}>
              <Play size={22} style={{ color: 'white', marginLeft: 2 }} />
            </div>
            <div style={{
              position: 'absolute', bottom: 6, left: 10, right: 10,
              fontSize: 10, color: 'rgba(255,255,255,0.8)',
              overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap',
              zIndex: 1,
              textShadow: '0 1px 3px rgba(0,0,0,0.5)',
            }}>
              {getFileNameFromPath(creativity.content) || '视频文件'}
            </div>
          </div>
        </div>
      );
    }

    if (creativity.type === 'audio') {
      return (
        <div style={{ padding: '0 16px', marginBottom: 8 }}>
          <div style={{
            width: '100%', padding: '12px 14px', borderRadius: 10,
            display: 'flex', alignItems: 'center', gap: 10,
            background: 'linear-gradient(135deg, #4facfe 0%, #00f2fe 100%)',
          }}>
            <div style={{
              width: 32, height: 32, borderRadius: 8,
              background: 'rgba(255,255,255,0.25)', backdropFilter: 'blur(4px)',
              display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0,
            }}>
              <Music size={16} style={{ color: 'white' }} />
            </div>
            <div style={{ flex: 1, minWidth: 0 }}>
              <Typography.Text ellipsis style={{ fontSize: 12, color: 'white', fontWeight: 600 }}>
                {creativity.title}
              </Typography.Text>
              <div style={{ fontSize: 10, color: 'rgba(255,255,255,0.7)' }}>
                {getFileNameFromPath(creativity.content) || '音频文件'}
              </div>
            </div>
          </div>
        </div>
      );
    }

    if (creativity.type === 'document') {
      return (
        <div style={{ padding: '0 16px', marginBottom: 8 }}>
          <div style={{
            width: '100%', padding: '12px 14px', borderRadius: 10,
            display: 'flex', alignItems: 'center', gap: 10,
            background: 'linear-gradient(135deg, #a18cd1 0%, #fbc2eb 100%)',
          }}>
            <div style={{
              width: 32, height: 32, borderRadius: 8,
              background: 'rgba(255,255,255,0.25)', backdropFilter: 'blur(4px)',
              display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0,
            }}>
              <FileText size={16} style={{ color: 'white' }} />
            </div>
            <div style={{ flex: 1, minWidth: 0 }}>
              <Typography.Text ellipsis style={{ fontSize: 12, color: 'white', fontWeight: 600 }}>
                {creativity.title}
              </Typography.Text>
              <div style={{ fontSize: 10, color: 'rgba(255,255,255,0.7)' }}>
                {getFileNameFromPath(creativity.content) || '文档文件'}
              </div>
            </div>
          </div>
        </div>
      );
    }

    return null;
  };

  return (
    <motion.div
      whileHover={{ y: -6, scale: 1.01 }}
      style={{
        background: 'var(--bg-secondary)',
        borderRadius: '16px',
        border: '1px solid var(--border-color)',
        overflow: 'hidden',
        cursor: 'pointer',
        position: 'relative',
        boxShadow: '0 2px 8px rgba(0,0,0,0.04)',
      }}
      onClick={onClick}
      onContextMenu={onContextMenu}
    >
      {!creativity.isRead && (
        <div style={{
          position: 'absolute', top: 8, right: 8,
          width: 8, height: 8, borderRadius: '50%',
          backgroundColor: 'var(--primary-color)',
          boxShadow: '0 0 0 2px var(--bg-secondary)',
          zIndex: 3,
        }} />
      )}
      {/* 装饰性渐变顶部 */}
      <div style={{
        height: '4px',
        background: creativity.type === 'image' 
          ? 'linear-gradient(90deg, #3B82F6, #60A5FA)'
          : creativity.type === 'audio' 
          ? 'linear-gradient(90deg, #10B981, #34D399)' 
          : creativity.type === 'video' 
          ? 'linear-gradient(90deg, #EF4444, #F87171)'
          : creativity.type === 'document'
          ? 'linear-gradient(90deg, #8B5CF6, #A78BFA)'
          : 'linear-gradient(90deg, #6C63FF, #8B85FF)',
      }} />
      
      {/* 卡片头部 */}
      <div style={{
        padding: '16px',
        display: 'flex',
        alignItems: 'center',
        gap: '12px',
      }}>
        <div style={{
          width: '40px',
          height: '40px',
          borderRadius: '12px',
          background: 'var(--primary-bg)',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          flexShrink: 0,
        }}>
          <Icon size={20} color="var(--primary-color)" />
        </div>
        <div style={{ flex: 1, minWidth: 0 }}>
          <div style={{
            fontSize: '13px',
            fontWeight: 600,
            color: 'var(--text-secondary)',
            textTransform: 'uppercase',
            letterSpacing: '0.5px',
          }}>
            {getCreativityTypeLabel(creativity.type)}
          </div>
          <div style={{
            display: 'flex',
            alignItems: 'center',
            gap: '8px',
            marginTop: '4px',
          }}>
            <span style={{
              fontSize: '12px',
              color: 'var(--text-tertiary)',
              display: 'flex',
              alignItems: 'center',
              gap: '4px',
            }}>
              <Clock size={12} />
              {formatRelativeTime(creativity.createdAt)}
            </span>
            {creativity.isFavorite && (
              <FavoriteBadge size={18} />
            )}
          </div>
        </div>
      </div>

      {/* 媒体预览 - 优先展示 */}
      {renderMediaPreview()}
      
      {/* 卡片内容 */}
      <div style={{
        padding: '0 16px 16px',
      }}>
        {creativity.title && (
          <h3 style={{
            margin: '0 0 8px 0',
            fontSize: '16px',
            fontWeight: 600,
            color: 'var(--text-primary)',
            lineHeight: '1.3',
            display: '-webkit-box',
            WebkitLineClamp: 2,
            WebkitBoxOrient: 'vertical',
            overflow: 'hidden',
          }}>
            {creativity.title}
          </h3>
        )}
        
        {creativity.content && !isMediaContent && (
          <p style={{
            margin: 0,
            fontSize: '13px',
            color: 'var(--text-secondary)',
            lineHeight: '1.6',
            wordBreak: 'break-word',
          }}>
            {creativity.content}
          </p>
        )}

        {isMediaContent && hasMediaPath && creativity.type !== 'image' && creativity.type !== 'document' && creativity.content && !creativity.content.startsWith('media://') && creativity.content !== creativity.mediaFilePath && (
          <p style={{
            margin: 0,
            fontSize: '11px',
            color: 'var(--text-tertiary)',
            overflow: 'hidden',
            textOverflow: 'ellipsis',
            whiteSpace: 'nowrap',
          }}>
            {getFileNameFromPath(creativity.content)}
          </p>
        )}
      </div>
      
      {/* 标签区域 */}
      {creativity.tags && creativity.tags.length > 0 && (
        <div style={{
          padding: '0 16px 16px',
          display: 'flex',
          flexWrap: 'wrap',
          gap: '6px',
        }}>
          {creativity.tags.slice(0, 3).map((tag: any, idx: number) => (
            <CreativityTag key={tag.id || idx} tag={tag} />
          ))}
          {creativity.tags.length > 3 && (
            <span style={{
              fontSize: '11px',
              padding: '4px 10px',
              borderRadius: '999px',
              background: 'var(--primary-bg)',
              color: 'var(--primary-color)',
              fontWeight: 500,
            }}>
              +{creativity.tags.length - 3}
            </span>
          )}
        </div>
      )}
      
      {/* 卡片底部装饰 */}
      <div style={{
        height: '12px',
        background: 'linear-gradient(to top, rgba(0,0,0,0.02), transparent)',
      }} />
    </motion.div>
  );
};

export default MasonryCard;
