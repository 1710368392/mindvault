import React from 'react';
import { motion } from 'framer-motion';

export type FloatButtonType = 'default' | 'primary' | 'outline';
export type FloatButtonSize = 'small' | 'middle' | 'large';

interface FloatButtonProps {
  /** 按钮类型 */
  type?: FloatButtonType;
  /** 按钮大小 */
  size?: FloatButtonSize;
  /** 是否悬浮（阴影效果） */
  hoverable?: boolean;
  /** 禁用状态 */
  disabled?: boolean;
  /** 加载状态 */
  loading?: boolean;
  /** 点击事件 */
  onClick?: React.MouseEventHandler<HTMLButtonElement>;
  /** 按钮图标 */
  icon?: React.ReactNode;
  /** 自定义样式类名 */
  className?: string;
  /** 按钮内容 */
  children?: React.ReactNode;
  /** 按钮样式 */
  style?: React.CSSProperties;
  /** 位置固定 */
  fixed?: boolean;
  /** 固定位置的偏移 */
  offset?: [number, number];
}

const FloatButton: React.FC<FloatButtonProps> = ({
  type = 'primary',
  size = 'middle',
  hoverable = true,
  disabled = false,
  loading = false,
  onClick,
  icon,
  className = '',
  children,
  style,
  fixed = true,
  offset = [24, 24],
  ...restProps
}) => {
  const sizeMap = {
    small: { width: '40px', height: '40px', fontSize: '16px', borderRadius: '14px' },
    middle: { width: '56px', height: '56px', fontSize: '20px', borderRadius: '20px' },
    large: { width: '68px', height: '68px', fontSize: '24px', borderRadius: '24px' },
  };

  const typeStyles = {
    default: {
      background: 'var(--bg-secondary)',
      border: '1px solid var(--border-color)',
      color: 'var(--text-primary)',
      boxShadow: '0 4px 16px rgba(0, 0, 0, 0.12)',
    },
    primary: {
      background: 'linear-gradient(135deg, var(--primary-color), var(--primary-light))',
      border: '1px solid var(--primary-color)',
      color: 'white',
      boxShadow: '0 6px 20px rgba(108, 99, 255, 0.4)',
    },
    outline: {
      background: 'transparent',
      border: '2px solid var(--primary-color)',
      color: 'var(--primary-color)',
      boxShadow: 'none',
    },
  };

  const classes = [
    'ant-float-button',
    `ant-float-button-${type}`,
    `ant-float-button-${size}`,
    className,
  ].filter(Boolean).join(' ');

  const handleClick = (e: React.MouseEvent<HTMLButtonElement>) => {
    if (loading || disabled) return;
    onClick?.(e);
  };

  const currentStyle = {
    ...sizeMap[size],
    ...typeStyles[type],
    position: fixed ? 'fixed' : 'relative',
    right: offset[0],
    bottom: offset[1],
    zIndex: 999,
    display: 'inline-flex',
    alignItems: 'center',
    justifyContent: 'center',
    cursor: disabled ? 'not-allowed' : 'pointer',
    outline: 'none',
    userSelect: 'none',
    transition: 'all 0.2s cubic-bezier(0.4, 0, 0.2, 1)',
    opacity: disabled ? 0.5 : 1,
    ...style,
  };

  return (
    <motion.button
      type="button"
      className={classes}
      disabled={disabled}
      onClick={handleClick}
      style={currentStyle}
      whileHover={
        hoverable && !disabled && !loading
          ? { scale: 1.08, y: -4 }
          : {}
      }
      whileTap={
        !disabled && !loading
          ? { scale: 0.95, y: 0 }
          : {}
      }
      animate={
        loading
          ? {
              rotate: [0, 360],
              transition: { repeat: Infinity, duration: 1, ease: 'linear' },
            }
          : {}
      }
      {...restProps}
    >
      {icon || children}
    </motion.button>
  );
};

export default FloatButton;
