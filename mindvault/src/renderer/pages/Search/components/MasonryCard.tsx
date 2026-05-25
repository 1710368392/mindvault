import React, { memo, useContext } from 'react';
import { motion } from 'framer-motion';
import {
  Type,
  Heart,
  CheckSquare,
  Play,
  Mic,
  Link as LinkIcon,
  FileText,
} from 'lucide-react';
import { BatchSelectionContext } from '../context';
import { SEARCH_TYPE_ICONS } from '../constants';
import { formatRelativeTime } from '../../../utils/formatters';
import { toMediaUrl, getFileNameFromPath } from '../../../utils/media';
import type { Creativity } from '@shared/types';

function highlightText(text: string, keyword: string): React.ReactNode {
  if (!keyword || !text) return text;
  try {
    const escaped = keyword.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
    const regex = new RegExp(`(${escaped})`, 'gi');
    const parts = text.split(regex);
    const lowerKeyword = keyword.toLowerCase();
    return parts.filter((part) => part !== '').map((part, i) =>
      part.toLowerCase() === lowerKeyword
        ? <mark key={i} style={{ background: 'rgba(250,204,21,0.35)', color: 'inherit', borderRadius: 2, padding: '0 1px' }}>{part}</mark>
        : part
    );
  } catch {
    return text;
  }
}

interface MasonryCardProps {
  creativity: Creativity;
  keyword: string;
  batchMode: boolean;
  onItemClick: (item: Creativity) => void;
  onContextMenu: (e: React.MouseEvent, item: Creativity) => void;
  onToggleSelect: (id: string) => void;
  justDraggedRef: React.MutableRefObject<boolean>;
}

const MasonryCard = memo(({
  creativity: c,
  keyword,
  batchMode,
  onItemClick,
  onContextMenu,
  onToggleSelect,
  justDraggedRef,
}: MasonryCardProps) => {
  const { selectedIds } = useContext(BatchSelectionContext);
  const isSelected = selectedIds.has(c.id);
  const TypeIcon = SEARCH_TYPE_ICONS[c.type] || Type;
  return (
    <motion.div
      layout={false}
      className="masonry-card-hover"
      onClick={() => onItemClick(c)}
      onContextMenu={(e) => onContextMenu(e, c)}
      style={{
        background: 'var(--bg-primary)',
        borderRadius: 12,
        overflow: 'hidden',
        cursor: 'pointer',
        position: 'relative',
        boxShadow: '0 1px 3px rgba(0,0,0,0.04)',
        transition: 'box-shadow 0.2s ease, transform 0.2s ease',
      }}
    >
      {/* 批量选择复选框 */}
      {batchMode ? (
        <div
          onClick={(e) => {
            e.stopPropagation();
            onToggleSelect(c.id);
          }}
          style={{
            position: 'absolute',
            top: 8,
            left: 8,
            zIndex: 10,
            width: 20,
            height: 20,
            borderRadius: 4,
            background: isSelected ? 'var(--primary-color)' : 'rgba(255,255,255,0.9)',
            border: `2px solid ${isSelected ? 'var(--primary-color)' : 'var(--border-color)'}`,
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            cursor: 'pointer',
            boxShadow: '0 1px 3px rgba(0,0,0,0.1)',
          }}
        >
          {isSelected ? <CheckSquare size={14} style={{ color: 'white' }} /> : null}
        </div>
      ) : null}

      {/* 封面区域 */}
      {(() => {
        if (c.type === 'image' && c.mediaFilePath) {
          const imgSrc = toMediaUrl(c.mediaFilePath);
          return (
            <div style={{ padding: '0 16px', marginBottom: 8 }}>
              <div style={{
                width: '100%', borderRadius: 10,
                overflow: 'hidden', background: 'var(--bg-tertiary)',
              }}>
                <img
                  src={imgSrc}
                  alt={c.title}
                  draggable={false}
                  loading="eager"
                  decoding="async"
                  style={{ width: '100%', height: 'auto', display: 'block', imageRendering: 'high-quality' }}
                />
              </div>
            </div>
          );
        }
        if (c.type === 'video' && c.mediaFilePath) {
          const videoSrc = toMediaUrl(c.mediaFilePath);
          return (
            <div style={{ padding: '0 16px', marginBottom: 8 }}>
              <div style={{
                width: '100%', borderRadius: 10,
                overflow: 'hidden', background: 'var(--bg-tertiary)',
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
                      width: '100%', height: 'auto', display: 'block',
                      imageRendering: 'high-quality',
                    }}
                  />
                )}
              </div>
            </div>
          );
        }
        if (c.type === 'audio') {
          return (
            <div style={{ padding: '0 16px', marginBottom: 8 }}>
              <div style={{
                width: '100%', padding: '20px 0', borderRadius: 10,
                display: 'flex', alignItems: 'center', justifyContent: 'center',
                background: 'linear-gradient(135deg, #a8edea 0%, #fed6e3 100%)',
              }}>
                <Mic size={32} style={{ color: 'white', opacity: 0.8 }} />
              </div>
            </div>
          );
        }
        if (c.type === 'link') {
          return (
            <div style={{ padding: '0 16px', marginBottom: 8 }}>
              <div style={{
                width: '100%', padding: '16px 0', borderRadius: 10,
                display: 'flex', alignItems: 'center', justifyContent: 'center',
                background: 'linear-gradient(135deg, #667eea 0%, #764ba2 100%)',
              }}>
                <LinkIcon size={28} style={{ color: 'white', opacity: 0.8 }} />
              </div>
            </div>
          );
        }
        if (c.type === 'document') {
          return (
            <div style={{ padding: '0 16px', marginBottom: 8 }}>
              <div style={{
                width: '100%', padding: '16px 0', borderRadius: 10,
                display: 'flex', alignItems: 'center', justifyContent: 'center',
                background: 'linear-gradient(135deg, #f093fb 0%, #f5576c 100%)',
              }}>
                <FileText size={28} style={{ color: 'white', opacity: 0.8 }} />
              </div>
            </div>
          );
        }
        return null;
      })()}

      {/* 内容区域 */}
      <div style={{ padding: '0 16px 16px' }}>
        <div style={{
          fontSize: 15, fontWeight: 600, color: 'var(--text-primary)',
          marginBottom: 6, wordBreak: 'break-word', lineHeight: 1.4,
        }}>
          {highlightText(c.title || '无标题', keyword)}
        </div>
        <div style={{
          fontSize: 13, color: 'var(--text-secondary)',
          wordBreak: 'break-word', lineHeight: 1.5, marginBottom: 10,
        }}>
          {highlightText(c.content || '', keyword)}
        </div>
        <div style={{
          display: 'flex', alignItems: 'center', justifyContent: 'space-between',
          fontSize: 12, color: 'var(--text-tertiary)',
        }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
            <TypeIcon size={14} />
            <span>{formatRelativeTime(c.updatedAt)}</span>
          </div>
          {c.isFavorite ? (
            <Heart size={14} style={{ color: '#ff6b6b', fill: '#ff6b6b' }} />
          ) : null}
        </div>
      </div>
    </motion.div>
  );
}, (prevProps, nextProps) => {
  return (
    prevProps.creativity.id === nextProps.creativity.id &&
    prevProps.creativity.title === nextProps.creativity.title &&
    prevProps.creativity.content === nextProps.creativity.content &&
    prevProps.creativity.type === nextProps.creativity.type &&
    prevProps.creativity.updatedAt === nextProps.creativity.updatedAt &&
    prevProps.creativity.isFavorite === nextProps.creativity.isFavorite &&
    prevProps.creativity.mediaFilePath === nextProps.creativity.mediaFilePath &&
    prevProps.keyword === nextProps.keyword &&
    prevProps.batchMode === nextProps.batchMode
  );
});

export default MasonryCard;
