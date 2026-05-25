import React from 'react';
import { Edit3, Heart, Trash2 } from 'lucide-react';
import type { Creativity } from '@shared/types';

interface ContextMenuProps {
  x: number;
  y: number;
  item: Creativity;
  onEdit: (item: Creativity) => void;
  onFavorite: (item: Creativity) => void;
  onDelete: (item: Creativity) => void;
  onClose: () => void;
}

const ContextMenu: React.FC<ContextMenuProps> = ({ x, y, item, onEdit, onFavorite, onDelete, onClose }) => {
  return (
    <div
      style={{
        position: 'fixed',
        top: y,
        left: x,
        zIndex: 1000,
        background: 'var(--bg-primary)',
        borderRadius: 8,
        boxShadow: '0 4px 12px rgba(0,0,0,0.15)',
        border: '1px solid var(--border-color)',
        padding: '4px 0',
      }}
      onClick={onClose}
    >
      <button
        onClick={() => onEdit(item)}
        style={{
          display: 'flex', alignItems: 'center', gap: 8,
          padding: '8px 16px', width: '100%', border: 'none',
          background: 'transparent', cursor: 'pointer',
          fontSize: 14, color: 'var(--text-primary)', textAlign: 'left',
        }}
      >
        <Edit3 size={16} />
        编辑
      </button>
      <button
        onClick={() => onFavorite(item)}
        style={{
          display: 'flex', alignItems: 'center', gap: 8,
          padding: '8px 16px', width: '100%', border: 'none',
          background: 'transparent', cursor: 'pointer',
          fontSize: 14, color: 'var(--text-primary)', textAlign: 'left',
        }}
      >
        <Heart size={16} style={item.isFavorite ? { fill: '#ff6b6b', color: '#ff6b6b' } : {}} />
        {item.isFavorite ? '取消收藏' : '收藏'}
      </button>
      <button
        onClick={() => onDelete(item)}
        style={{
          display: 'flex', alignItems: 'center', gap: 8,
          padding: '8px 16px', width: '100%', border: 'none',
          background: 'transparent', cursor: 'pointer',
          fontSize: 14, color: '#ff6b6b', textAlign: 'left',
        }}
      >
        <Trash2 size={16} />
        删除
      </button>
    </div>
  );
};

export default ContextMenu;
