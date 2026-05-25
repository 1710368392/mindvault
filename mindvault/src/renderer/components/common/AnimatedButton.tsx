import React, { useState } from 'react';

type AnimationType = 
  | 'bounce'           // 弹跳
  | 'scale'            // 缩放
  | 'rotate'           // 旋转
  | 'shake'            // 摇晃
  | 'jump'             // 上跳
  | 'pulse'            // 脉冲
  | 'wobble';          // 摇晃变形

interface AnimatedButtonProps {
  children: React.ReactNode;
  onClick?: (e: React.MouseEvent) => void;
  animationType?: AnimationType;
  className?: string;
  style?: React.CSSProperties;
  disabled?: boolean;
}

const AnimatedButton: React.FC<AnimatedButtonProps> = ({ 
  children, 
  onClick, 
  animationType = 'bounce',
  className = '',
  style = {},
  disabled = false,
  ...rest 
}) => {
  const [isAnimating, setIsAnimating] = useState(false);

  const handleClick = (e: React.MouseEvent) => {
    if (disabled) return;
    
    setIsAnimating(true);
    
    setTimeout(() => {
      setIsAnimating(false);
    }, 400);
    
    if (onClick) {
      onClick(e);
    }
  };

  const getAnimationStyle = (): React.CSSProperties => {
    if (!isAnimating) return {};
    
    switch (animationType) {
      case 'bounce':
        return {
          animation: 'bounce 0.4s ease',
        };
      case 'scale':
        return {
          animation: 'scale 0.3s ease',
        };
      case 'rotate':
        return {
          animation: 'rotate 0.4s ease',
        };
      case 'shake':
        return {
          animation: 'shake 0.5s ease',
        };
      case 'jump':
        return {
          animation: 'jump 0.4s ease',
        };
      case 'pulse':
        return {
          animation: 'pulse 0.5s ease',
        };
      case 'wobble':
        return {
          animation: 'wobble 0.5s ease',
        };
      default:
        return {};
    }
  };

  return (
    <button
      onClick={handleClick}
      disabled={disabled}
      className={className}
      style={{
        ...style,
        ...getAnimationStyle(),
        cursor: disabled ? 'not-allowed' : 'pointer',
      }}
      {...rest}
    >
      {children}
      
      {/* 内联CSS动画定义 */}
      <style jsx>{`
        @keyframes bounce {
          0%, 100% { transform: translateY(0) scale(1); }
          30% { transform: translateY(-8px) scale(1.05); }
          50% { transform: translateY(-3px) scale(1.02); }
          70% { transform: translateY(-1px) scale(1); }
        }
        
        @keyframes scale {
          0%, 100% { transform: scale(1); }
          50% { transform: scale(1.15); }
        }
        
        @keyframes rotate {
          0% { transform: rotate(0deg) scale(1); }
          30% { transform: rotate(-10deg) scale(1.05); }
          60% { transform: rotate(10deg) scale(1.05); }
          100% { transform: rotate(360deg) scale(1); }
        }
        
        @keyframes shake {
          0%, 100% { transform: translateX(0); }
          10%, 30%, 50%, 70%, 90% { transform: translateX(-4px); }
          20%, 40%, 60%, 80% { transform: translateX(4px); }
        }
        
        @keyframes jump {
          0%, 100% { transform: translateY(0) rotate(0deg); }
          20% { transform: translateY(-10px) rotate(-3deg); }
          40% { transform: translateY(-5px) rotate(3deg); }
          60% { transform: translateY(-2px) rotate(-1deg); }
        }
        
        @keyframes pulse {
          0%, 100% { transform: scale(1); opacity: 1; }
          50% { transform: scale(1.1); opacity: 0.8; }
        }
        
        @keyframes wobble {
          0%, 100% { transform: translateX(0) rotate(0deg); }
          15% { transform: translateX(-25%) rotate(-5deg); }
          30% { transform: translateX(20%) rotate(3deg); }
          45% { transform: translateX(-15%) rotate(-3deg); }
          60% { transform: translateX(10%) rotate(2deg); }
          75% { transform: translateX(-5%) rotate(-1deg); }
        }
      `}</style>
    </button>
  );
};

export default AnimatedButton;
