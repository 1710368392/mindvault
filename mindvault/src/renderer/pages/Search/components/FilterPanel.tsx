import React from 'react';
import { Button, Rate } from 'antd';
import { Type, Star, Hash, Smile, X } from 'lucide-react';
import { motion } from 'framer-motion';
import { SEARCH_TYPE_ICONS, CREATIVITY_TYPES, PRIORITY_LEVELS } from '../constants';
import { formatRelativeTime, getCreativityTypeLabel } from '../../../utils/formatters';
import { EMOJI_REACTIONS } from '@shared/constants';
import EmojiIcon from '../../../components/common/EmojiIcon';
import type { FilterState } from '../types';

interface FilterPanelProps {
  filter: FilterState;
  existingTags: string[];
  onToggleType: (type: string) => void;
  onSetMinPriority: (priority: number) => void;
  onToggleTag: (tag: string) => void;
  onToggleEmoji: (emoji: string) => void;
  onReset: () => void;
}

const FilterPanel: React.FC<FilterPanelProps> = ({
  filter,
  existingTags,
  onToggleType,
  onSetMinPriority,
  onToggleTag,
  onToggleEmoji,
  onReset,
}) => {
  return (
    <motion.div
      initial={{ opacity: 0, height: 0 }}
      animate={{ opacity: 1, height: 'auto' }}
      exit={{ opacity: 0, height: 0 }}
      style={{
        marginTop: 12,
        padding: 20,
        background: 'var(--bg-primary)',
        borderRadius: 10,
        border: '1px solid var(--border-color)',
        overflow: 'hidden',
      }}
    >
      {/* 类型筛选 */}
      <div style={{ marginBottom: 20 }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 6, marginBottom: 10, fontSize: 13, fontWeight: 600, color: 'var(--text-primary)' }}>
          <Type size={14} /> 创意类型
        </div>
        <div style={{ display: 'flex', flexWrap: 'wrap', gap: 8 }}>
          {CREATIVITY_TYPES.map((type) => {
            const Icon = SEARCH_TYPE_ICONS[type] || Type;
            const isActive = filter.types.includes(type);
            return (
              <button
                key={type}
                onClick={() => onToggleType(type)}
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  gap: 6,
                  padding: '6px 12px',
                  borderRadius: 8,
                  border: `1px solid ${isActive ? 'var(--primary-color)' : 'var(--border-color)'}`,
                  background: isActive ? 'var(--primary-bg)' : 'var(--bg-primary)',
                  color: isActive ? 'var(--primary-color)' : 'var(--text-secondary)',
                  cursor: 'pointer',
                  fontSize: 13,
                  transition: 'all 0.15s ease',
                }}
              >
                <Icon size={14} />
                {getCreativityTypeLabel(type)}
              </button>
            );
          })}
        </div>
      </div>

      {/* 优先级筛选 */}
      <div style={{ marginBottom: 20 }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 6, marginBottom: 10, fontSize: 13, fontWeight: 600, color: 'var(--text-primary)' }}>
          <Star size={14} /> 最低优先级
        </div>
        <div style={{ display: 'flex', gap: 8 }}>
          {PRIORITY_LEVELS.map((level) => (
            <button
              key={level}
              onClick={() => onSetMinPriority(level)}
              style={{
                padding: '6px 12px',
                borderRadius: 8,
                border: `1px solid ${filter.minPriority === level ? 'var(--primary-color)' : 'var(--border-color)'}`,
                background: filter.minPriority === level ? 'var(--primary-bg)' : 'var(--bg-primary)',
                color: filter.minPriority === level ? 'var(--primary-color)' : 'var(--text-secondary)',
                cursor: 'pointer',
                fontSize: 13,
                transition: 'all 0.15s ease',
              }}
            >
              {level === 0 ? '全部' : (
                <div style={{ display: 'flex', alignItems: 'center', gap: 4 }}>
                  <Rate count={5} value={level} disabled style={{ fontSize: 12 }} />
                  {level === 5 ? '最高' : level >= 4 ? '较高' : level >= 3 ? '中等' : '较低'}
                </div>
              )}
            </button>
          ))}
        </div>
      </div>

      {/* 标签筛选 */}
      {existingTags.length > 0 && (
        <div style={{ marginBottom: 20 }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 6, marginBottom: 10, fontSize: 13, fontWeight: 600, color: 'var(--text-primary)' }}>
            <Hash size={14} /> 标签
          </div>
          <div style={{ display: 'flex', flexWrap: 'wrap', gap: 8 }}>
            {existingTags.map((tag) => {
              const isActive = filter.tags.includes(tag);
              return (
                <button
                  key={tag}
                  onClick={() => onToggleTag(tag)}
                  style={{
                    padding: '4px 10px',
                    borderRadius: 6,
                    border: `1px solid ${isActive ? 'var(--primary-color)' : 'var(--border-color)'}`,
                    background: isActive ? 'var(--primary-bg)' : 'var(--bg-primary)',
                    color: isActive ? 'var(--primary-color)' : 'var(--text-secondary)',
                    cursor: 'pointer',
                    fontSize: 12,
                    transition: 'all 0.15s ease',
                  }}
                >
                  #{tag}
                </button>
              );
            })}
          </div>
        </div>
      )}

      {/* 表情筛选 */}
      <div>
        <div style={{ display: 'flex', alignItems: 'center', gap: 6, marginBottom: 10, fontSize: 13, fontWeight: 600, color: 'var(--text-primary)' }}>
          <Smile size={14} /> 表情
        </div>
        <div style={{ display: 'flex', flexWrap: 'wrap', gap: 8 }}>
          {EMOJI_REACTIONS.map((emoji) => {
            const isActive = filter.emojiReactions.includes(emoji);
            return (
              <button
                key={emoji}
                onClick={() => onToggleEmoji(emoji)}
                style={{
                  width: 36,
                  height: 36,
                  borderRadius: 8,
                  border: `2px solid ${isActive ? 'var(--primary-color)' : 'transparent'}`,
                  background: isActive ? 'var(--primary-bg)' : 'var(--bg-primary)',
                  cursor: 'pointer',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  transition: 'all 0.15s ease',
                }}
              >
                <EmojiIcon id={emoji} size={22} />
              </button>
            );
          })}
        </div>
      </div>

      {/* 重置按钮 */}
      <div style={{ marginTop: 16, display: 'flex', justifyContent: 'flex-end' }}>
        <Button onClick={onReset} icon={<X size={16} />}>
          重置筛选
        </Button>
      </div>
    </motion.div>
  );
};

export default FilterPanel;
