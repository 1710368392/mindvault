import React, { memo, useState, useCallback } from 'react';
import { motion } from 'framer-motion';
import {
  Play,
  Mic,
  Link as LinkIcon,
  FileText,
  Folder,
  LayoutDashboard,
  StickyNote,
  ChevronRight,
  Star,
} from 'lucide-react';
import { Rate, Tooltip, Popover, Tag } from 'antd';
import { SEARCH_TYPE_ICONS } from '../constants';
import { formatRelativeTime, getCreativityTypeLabel } from '../../../utils/formatters';
import { toMediaUrl } from '../../../utils/media';
import type { Creativity } from '@shared/types';

interface AssociationLocation {
  id: string;
  type: 'folder' | 'canvas' | 'board' | 'other';
  name: string;
  parentId?: string;
}

interface TableCardProps {
  creativity: Creativity;
  keyword: string;
  batchMode: boolean;
  isSelected: boolean;
  onItemClick: (item: Creativity) => void;
  onContextMenu: (e: React.MouseEvent, item: Creativity) => void;
  onToggleSelect: (id: string) => void;
  onNavigateToLocation?: (location: AssociationLocation) => void;
  style?: React.CSSProperties;
}

// 缩略图渲染
function renderThumbnail(c: Creativity) {
  if (c.type === 'image' && c.mediaFilePath) {
    return (
      <div style={{
        width: 40, height: 40, borderRadius: 8, overflow: 'hidden',
        flexShrink: 0, background: 'var(--bg-tertiary)',
      }}>
        <img
          src={toMediaUrl(c.mediaFilePath)}
          alt={c.title}
          draggable={false}
          loading="lazy"
          style={{ width: '100%', height: '100%', objectFit: 'cover' }}
        />
      </div>
    );
  }
  if (c.type === 'video') {
    // 优先使用缩略图，否则显示渐变背景
    if (c.thumbnailPath) {
      return (
        <div style={{
          width: 40, height: 40, borderRadius: 8, overflow: 'hidden',
          flexShrink: 0, background: 'var(--bg-tertiary)', position: 'relative',
        }}>
          <img
            src={toMediaUrl(c.thumbnailPath)}
            alt={c.title}
            draggable={false}
            loading="lazy"
            style={{ width: '100%', height: '100%', objectFit: 'cover' }}
          />
          <div style={{
            position: 'absolute', inset: 0,
            display: 'flex', alignItems: 'center', justifyContent: 'center',
            background: 'rgba(0,0,0,0.2)',
          }}>
            <Play size={14} style={{ color: 'white' }} />
          </div>
        </div>
      );
    }
    return (
      <div style={{
        width: 40, height: 40, borderRadius: 8, flexShrink: 0,
        display: 'flex', alignItems: 'center', justifyContent: 'center',
        background: 'linear-gradient(135deg, #fa709a 0%, #fee140 100%)',
      }}>
        <Play size={18} style={{ color: 'white', opacity: 0.9 }} />
      </div>
    );
  }
  if (c.type === 'audio') {
    return (
      <div style={{
        width: 40, height: 40, borderRadius: 8, flexShrink: 0,
        display: 'flex', alignItems: 'center', justifyContent: 'center',
        background: 'linear-gradient(135deg, #a8edea 0%, #fed6e3 100%)',
      }}>
        <Mic size={18} style={{ color: 'white', opacity: 0.9 }} />
      </div>
    );
  }
  if (c.type === 'link') {
    return (
      <div style={{
        width: 40, height: 40, borderRadius: 8, flexShrink: 0,
        display: 'flex', alignItems: 'center', justifyContent: 'center',
        background: 'linear-gradient(135deg, #667eea 0%, #764ba2 100%)',
      }}>
        <LinkIcon size={18} style={{ color: 'white', opacity: 0.9 }} />
      </div>
    );
  }
  if (c.type === 'document') {
    return (
      <div style={{
        width: 40, height: 40, borderRadius: 8, flexShrink: 0,
        display: 'flex', alignItems: 'center', justifyContent: 'center',
        background: 'linear-gradient(135deg, #f093fb 0%, #f5576c 100%)',
      }}>
        <FileText size={18} style={{ color: 'white', opacity: 0.9 }} />
      </div>
    );
  }
  // 文本类型：显示摘要预览
  if (c.type === 'text' && c.content) {
    const preview = c.content.slice(0, 30) + (c.content.length > 30 ? '...' : '');
    return (
      <div style={{
        width: 40, height: 40, borderRadius: 8, flexShrink: 0,
        background: 'var(--bg-secondary)',
        display: 'flex', alignItems: 'center', justifyContent: 'center',
        fontSize: 9, color: 'var(--text-tertiary)',
        padding: 4, textAlign: 'center',
        overflow: 'hidden', lineHeight: 1.2,
      }}>
        {preview}
      </div>
    );
  }
  // 默认
  return (
    <div style={{
      width: 40, height: 40, borderRadius: 8, flexShrink: 0,
      background: 'var(--bg-secondary)',
    }} />
  );
}

// 关联位置图标
const LOCATION_ICONS = {
  folder: Folder,
  canvas: LayoutDashboard,
  board: StickyNote,
  other: ChevronRight,
};

// 模拟获取关联位置（实际应从 API 获取）
function getAssociationLocations(c: Creativity): AssociationLocation[] {
  const locations: AssociationLocation[] = [];
  // 这里应该从 API 获取实际的关联位置
  // 目前返回空数组，后续实现 API 后填充
  return locations;
}

const TableCard = memo(({
  creativity: c,
  keyword,
  batchMode,
  isSelected,
  onItemClick,
  onContextMenu,
  onToggleSelect,
  onNavigateToLocation,
  style,
}: TableCardProps) => {
  const [showAllLocations, setShowAllLocations] = useState(false);
  const TypeIcon = SEARCH_TYPE_ICONS[c.type] || FileText;
  const locations = getAssociationLocations(c);
  const displayLocations = locations.slice(0, 3);
  const remainingCount = locations.length - 3;

  return (
    <div
      className="table-card-row"
      onClick={() => onItemClick(c)}
      onContextMenu={(e) => onContextMenu(e, c)}
      style={{
        display: 'grid',
        gridTemplateColumns: '32px 52px 1fr 80px 120px 100px 60px 80px 100px',
        alignItems: 'center',
        gap: 12,
        padding: '12px 16px',
        background: isSelected ? 'var(--primary-bg)' : 'var(--bg-primary)',
        borderBottom: '1px solid var(--border-light)',
        cursor: 'pointer',
        transition: 'background 0.15s ease',
        ...style,
      }}
    >
      {/* 批量选择 */}
      {batchMode ? (
        <div
          onClick={(e) => { e.stopPropagation(); onToggleSelect(c.id); }}
          style={{
            width: 18, height: 18, borderRadius: 4,
            background: isSelected ? 'var(--primary-color)' : 'var(--bg-secondary)',
            border: `2px solid ${isSelected ? 'var(---primary-color)' : 'var(--border-color)'}`,
            display: 'flex', alignItems: 'center', justifyContent: 'center',
            cursor: 'pointer',
          }}
        >
          {isSelected ? <div style={{ width: 8, height: 8, background: 'white', borderRadius: 2 }} /> : null}
        </div>
      ) : (
        <div />
      )}

      {/* 缩略图 */}
      {renderThumbnail(c)}

      {/* 标题/摘要 */}
      <div style={{ minWidth: 0, overflow: 'hidden' }}>
        <div style={{
          fontSize: 14, fontWeight: 600, color: 'var(--text-primary)',
          overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap',
        }}>
          {c.title || '无标题'}
        </div>
        <div style={{
          fontSize: 12, color: 'var(--text-secondary)',
          overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap',
          marginTop: 2,
        }}>
          {c.content?.slice(0, 50) || ''}
        </div>
      </div>

      {/* 类型 */}
      <div style={{ display: 'flex', alignItems: 'center', gap: 4 }}>
        <TypeIcon size={14} style={{ color: 'var(--text-tertiary)' }} />
        <span style={{ fontSize: 12, color: 'var(--text-secondary)' }}>
          {getCreativityTypeLabel(c.type)}
        </span>
      </div>

      {/* 关联位置 */}
      <div style={{ display: 'flex', alignItems: 'center', gap: 4 }}>
        {displayLocations.map((loc, i) => {
          const Icon = LOCATION_ICONS[loc.type] || ChevronRight;
          return (
            <Tooltip key={loc.id} title={loc.name}>
              <button
                onClick={(e) => { e.stopPropagation(); onNavigateToLocation?.(loc); }}
                style={{
                  width: 24, height: 24, borderRadius: 4,
                  border: 'none', background: 'var(--bg-secondary)',
                  display: 'flex', alignItems: 'center', justifyContent: 'center',
                  cursor: 'pointer', padding: 0,
                }}
              >
                <Icon size={12} style={{ color: 'var(--text-tertiary)' }} />
              </button>
            </Tooltip>
          );
        })}
        {remainingCount > 0 ? (
          <Popover
            open={showAllLocations}
            onOpenChange={setShowAllLocations}
            trigger="click"
            content={
              <div style={{ maxWidth: 200 }}>
                {locations.map((loc) => {
                  const Icon = LOCATION_ICONS[loc.type] || ChevronRight;
                  return (
                    <button
                      key={loc.id}
                      onClick={() => { onNavigateToLocation?.(loc); setShowAllLocations(false); }}
                      style={{
                        display: 'flex', alignItems: 'center', gap: 8,
                        width: '100%', padding: '8px 4px',
                        border: 'none', background: 'none',
                        cursor: 'pointer', textAlign: 'left',
                      }}
                    >
                      <Icon size={14} style={{ color: 'var(--text-tertiary)' }} />
                      <span style={{ fontSize: 12, color: 'var(--text-primary)' }}>{loc.name}</span>
                    </button>
                  );
                })}
              </div>
            }
          >
            <button
              onClick={(e) => e.stopPropagation()}
              style={{
                padding: '2px 6px', borderRadius: 4,
                border: 'none', background: 'var(--bg-secondary)',
                fontSize: 11, color: 'var(--text-tertiary)',
                cursor: 'pointer',
              }}
            >
              +{remainingCount}
            </button>
          </Popover>
        ) : null}
        {locations.length === 0 ? (
          <span style={{ fontSize: 11, color: 'var(--text-quaternary)' }}>-</span>
        ) : null}
      </div>

      {/* 标签 */}
      <div style={{ display: 'flex', gap: 4, overflow: 'hidden' }}>
        {Array.isArray(c.tags) && c.tags.length > 0 ? (
          <>
            {c.tags.slice(0, 2).map((tag, i) => {
              const tagName = typeof tag === 'string' ? tag : (tag as any).name || '';
              return (
                <Tag key={i} style={{ margin: 0, fontSize: 11, padding: '0 4px' }}>
                  #{tagName}
                </Tag>
              );
            })}
            {c.tags.length > 2 ? (
              <span style={{ fontSize: 11, color: 'var(--text-tertiary)' }}>+{c.tags.length - 2}</span>
            ) : null}
          </>
        ) : (
          <span style={{ fontSize: 11, color: 'var(--text-quaternary)' }}>-</span>
        )}
      </div>

      {/* 字数 */}
      <div style={{ fontSize: 12, color: 'var(--text-secondary)', textAlign: 'center' }}>
        {c.wordCount ? `${c.wordCount}字` : '-'}
      </div>

      {/* 优先级 */}
      <div style={{ display: 'flex', justifyContent: 'center' }}>
        {c.priority > 0 ? (
          <Rate count={5} value={c.priority} disabled style={{ fontSize: 10 }} />
        ) : (
          <span style={{ fontSize: 11, color: 'var(--text-quaternary)' }}>-</span>
        )}
      </div>

      {/* 创建时间 */}
      <div style={{ fontSize: 12, color: 'var(--text-secondary)', textAlign: 'right' }}>
        {formatRelativeTime(c.createdAt)}
      </div>
    </div>
  );
});

export default TableCard;
