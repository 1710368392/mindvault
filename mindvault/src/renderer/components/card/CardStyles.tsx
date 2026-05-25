import React from 'react';
import { STICKY_COLORS } from '@shared/constants';

// ===== 类型定义 =====

interface CardStylesProps {
  selectedColor: string | null;
  onSelectColor: (color: string | null) => void;
}

// ===== 组件 =====

const CardStyles: React.FC<CardStylesProps> = ({
  selectedColor,
  onSelectColor,
}) => {
  return (
    <div className="grid grid-cols-4 gap-2">
      {STICKY_COLORS.map((color) => (
        <button
          key={color.value}
          onClick={() => onSelectColor(selectedColor === color.value ? null : color.value)}
          className={`group relative flex flex-col items-center gap-1 p-2 rounded-lg transition-all ${
            selectedColor === color.value
              ? 'bg-[var(--primary-bg)] ring-2 ring-[var(--primary-color)]'
              : 'hover:bg-[var(--bg-hover)]'
          }`}
          title={color.name}
        >
          {/* 颜色预览 */}
          <div
            className="w-10 h-10 rounded-lg shadow-sm transition-transform group-hover:scale-110"
            style={{
              background: `linear-gradient(135deg, ${color.value} 0%, ${color.shadow} 100%)`,
            }}
          />
          {/* 颜色名称 */}
          <span className="text-[10px] text-[var(--text-tertiary)] truncate w-full text-center">
            {color.name}
          </span>
          {/* 选中标记 */}
          {selectedColor === color.value && (
            <div className="absolute -top-1 -right-1 w-4 h-4 rounded-full bg-[var(--primary-color)] text-white flex items-center justify-center text-[10px]">
              ✓
            </div>
          )}
        </button>
      ))}
    </div>
  );
};

export default CardStyles;
