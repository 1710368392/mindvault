import React from 'react';
import { Tag } from 'antd';

type CreativityTagProps = {
  tag: { name: string; color?: string | null; id?: string } | string;
  closable?: boolean;
  onClose?: (e: React.MouseEvent) => void;
  onClick?: (e: React.MouseEvent) => void;
  onDoubleClick?: (e: React.MouseEvent) => void;
  checked?: boolean;
  checkable?: boolean;
  onChange?: (checked: boolean) => void;
  style?: React.CSSProperties;
  className?: string;
};

export default function CreativityTag({
  tag,
  closable,
  onClose,
  onClick,
  onDoubleClick,
  checked,
  checkable,
  onChange,
  style,
  className,
}: CreativityTagProps) {
  const name = typeof tag === 'string' ? tag : tag.name;
  const color = typeof tag === 'string' ? undefined : (tag.color || undefined);

  if (checkable) {
    return (
      <Tag.CheckableTag
        checked={checked}
        onChange={onChange}
        style={style}
        className={className}
      >
        {name}
      </Tag.CheckableTag>
    );
  }

  return (
    <Tag
      color={color}
      closable={closable}
      onClose={onClose}
      onClick={onClick}
      onDoubleClick={onDoubleClick}
      style={style}
      className={className}
    >
      {name}
    </Tag>
  );
}
