import React, { useMemo } from 'react';
import { motion } from 'framer-motion';
import { Type, Image, Mic, Link, Video, ExternalLink, FileText } from 'lucide-react';
import type { Creativity } from '@shared/types';
import { STICKY_COLORS } from '@shared/constants';
import EmojiIcon from '../common/EmojiIcon';
import CreativityTag from '../common/CreativityTag';
import { truncateText, formatRelativeTime } from '../../utils/formatters';
import { Rate } from 'antd';

// ===== 类型定义 =====

interface StickyCardProps {
  creativity: Creativity;
  onClick?: (creativity: Creativity) => void;
  onContextMenu?: (e: React.MouseEvent, creativity: Creativity) => void;
  isSelected?: boolean;
  style?: React.CSSProperties;
  index?: number;
}

// ===== 类型图标映射 =====

const TYPE_ICONS: Record<string, React.ReactNode> = {
  text: <Type size={14} />,
  image: <Image size={14} />,
  audio: <Mic size={14} />,
  link: <Link size={14} />,
  video: <Video size={14} />,
};

// ===== 颜色映射 =====

const COLOR_CLASS_MAP: Record<string, string> = {
  '#FFF9C4': 'sticky-yellow',
  '#C8E6C9': 'sticky-green',
  '#BBDEFB': 'sticky-blue',
  '#F8BBD0': 'sticky-pink',
  '#E1BEE7': 'sticky-purple',
  '#FFCCBC': 'sticky-orange',
  '#FFFFFF': 'sticky-white',
  '#D7CCC8': 'sticky-gray',
};

// ===== 动画配置 =====

const cardVariants = {
  hidden: { opacity: 0, y: 20, scale: 0.95 },
  visible: (i: number) => ({
    opacity: 1,
    y: 0,
    scale: 1,
    transition: {
      delay: i * 0.05,
      duration: 0.4,
      ease: [0.25, 0.46, 0.45, 0.94],
    },
  }),
};

// ===== 组件 =====

const StickyCard: React.FC<StickyCardProps> = ({
  creativity,
  onClick,
  onContextMenu,
  isSelected = false,
  style,
  index = 0,
}) => {
  // 解析卡片样式
  const cardColor = useMemo(() => {
    if (creativity.cardStyle) {
      try {
        const parsed = JSON.parse(creativity.cardStyle);
        return parsed.color || null;
      } catch {
        return null;
      }
    }
    return null;
  }, [creativity.cardStyle]);

  // 获取颜色类名
  const colorClass = useMemo(() => {
    if (cardColor) {
      return COLOR_CLASS_MAP[cardColor] || 'sticky-yellow';
    }
    // 默认根据类型分配颜色
    const typeColorMap: Record<string, string> = {
      text: 'sticky-yellow',
      image: 'sticky-blue',
      audio: 'sticky-green',
      link: 'sticky-orange',
      video: 'sticky-pink',
    };
    return typeColorMap[creativity.type] || 'sticky-yellow';
  }, [cardColor, creativity.type]);

  // 随机倾斜角度（基于id稳定生成）
  const randomRotate = useMemo(() => {
    const hash = creativity.id.split('').reduce((acc, char) => acc + char.charCodeAt(0), 0);
    return ((hash % 400) - 200) / 100; // -2 ~ 2 deg
  }, [creativity.id]);

  // 优先级星星
  const tags = creativity.tags || [];

  return (
    <motion.div
      className={`sticky-card ${colorClass} ${isSelected ? 'ring-2 ring-[var(--primary-color)]' : ''}`}
      style={{
        ...style,
        transform: `rotate(${randomRotate}deg)`,
      }}
      variants={cardVariants}
      initial="hidden"
      animate="visible"
      custom={index}
      whileHover={{
        scale: 1.03,
        rotate: 0,
        transition: { duration: 0.25 },
      }}
      whileTap={{ scale: 0.98 }}
      onClick={() => onClick?.(creativity)}
      onContextMenu={(e) => onContextMenu?.(e, creativity)}
      layout
    >
      {/* 优先级星星 */}
      {creativity.priority > 0 && (
        <div className="sticky-priority">
          <Rate disabled count={5} value={creativity.priority} style={{ fontSize: 10 }} />
        </div>
      )}

      {/* Emoji 反应 */}
      {creativity.emojiReaction && (
        <span className="sticky-emoji"><EmojiIcon id={creativity.emojiReaction} size={16} /></span>
      )}

      {/* 类型图标 */}
      <div className="flex items-center gap-1 mb-2 text-[var(--text-tertiary)]">
        {TYPE_ICONS[creativity.type]}
        <span className="text-xs">
          {creativity.type === 'text' ? '文本' :
           creativity.type === 'image' ? '图片' :
           creativity.type === 'audio' ? '音频' :
           creativity.type === 'link' ? '链接' : '视频'}
        </span>
      </div>

      {/* 标题 */}
      <h3 className="sticky-title">
        {truncateText(creativity.title, 40)}
      </h3>

      {/* 内容预览 - 根据类型差异化渲染 */}
      <div className="sticky-content truncate-2">
        {creativity.type === 'image' && creativity.content.startsWith('http') ? (
          <div style={{ marginBottom: 4 }}>
            <img
              src={creativity.content}
              alt={creativity.title}
              style={{
                width: '100%',
                maxHeight: 80,
                objectFit: 'cover',
                borderRadius: 4,
              }}
              loading="lazy"
            />
          </div>
        ) : creativity.type === 'image' ? (
          <div className="flex items-center gap-2 text-[var(--text-secondary)]">
            <Image size={14} />
            <span className="text-xs truncate">{creativity.content || '图片文件'}</span>
          </div>
        ) : creativity.type === 'audio' ? (
          <div className="flex items-center gap-2 text-[var(--text-secondary)]">
            <Mic size={14} />
            <span className="text-xs">音频文件</span>
          </div>
        ) : creativity.type === 'video' ? (
          <div className="flex items-center gap-2 text-[var(--text-secondary)]">
            <Video size={14} />
            <span className="text-xs">视频文件</span>
          </div>
        ) : creativity.type === 'link' && creativity.content.startsWith('http') ? (
          <a
            href={creativity.content}
            target="_blank"
            rel="noopener noreferrer"
            className="flex items-center gap-1 text-xs text-[var(--primary-color)] hover:underline truncate"
            onClick={(e) => e.stopPropagation()}
          >
            <ExternalLink size={12} />
            <span className="truncate">{creativity.content}</span>
          </a>
        ) : (
          <p className="truncate-2">{truncateText(creativity.content, 120)}</p>
        )}
      </div>

      {/* 标签 */}
      {tags.length > 0 && (
        <div className="sticky-tags">
          {tags.slice(0, 3).map((tag) => (
            <CreativityTag key={tag.id} tag={tag} />
          ))}
          {tags.length > 3 && (
            <span className="sticky-tag">+{tags.length - 3}</span>
          )}
        </div>
      )}

      {/* 底部元信息 */}
      <div className="sticky-meta">
        <span>{formatRelativeTime(creativity.createdAt)}</span>
      </div>
    </motion.div>
  );
};

export default StickyCard;
