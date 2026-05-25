import React, { useState, useEffect, useRef } from 'react';
import { AnimatePresence, motion } from 'framer-motion';
import { X, Minus, Maximize2, Minimize2 } from 'lucide-react';
import BoardView from './BoardView';

interface DetachedBoardWindowProps {
  windowId: string;
  boardId?: string;
  onClose: () => void;
  zIndex?: number;
}

let windowCount = 0;

const DetachedBoardWindow: React.FC<DetachedBoardWindowProps> = ({
  windowId,
  boardId,
  onClose,
  zIndex = 1000,
}) => {
  const [pos, setPos] = useState(() => {
    const offset = (windowCount % 10) * 30;
    windowCount++;
    const cx = Math.max(60, (window.innerWidth - 900) / 2 + offset);
    const cy = Math.max(40, (window.innerHeight - 600) / 2 + offset);
    return { x: cx, y: cy };
  });
  const [size, setSize] = useState({ width: 900, height: 600 });
  const [isMinimized, setIsMinimized] = useState(false);
  const [isDragging, setIsDragging] = useState(false);
  const [isResizing, setIsResizing] = useState(false);
  const [isEntering, setIsEntering] = useState(true);
  const [isFocused, setIsFocused] = useState(false);
  const [isFullscreen, setIsFullscreen] = useState(false);

  const windowRef = useRef<HTMLDivElement>(null);
  const dragStateRef = useRef<{ startX: number; startY: number; startPosX: number; startPosY: number } | null>(null);
  const resizeStateRef = useRef<{ startX: number; startY: number; startW: number; startH: number } | null>(null);

  useEffect(() => {
    const timer = setTimeout(() => setIsEntering(false), 200);
    return () => clearTimeout(timer);
  }, []);

  const handleMouseDown = (e: React.MouseEvent) => {
    if (e.target !== e.currentTarget && !(e.target as HTMLElement).closest('.drag-handle')) return;
    
    setIsDragging(true);
    setIsFocused(true);
    dragStateRef.current = {
      startX: e.clientX,
      startY: e.clientY,
      startPosX: pos.x,
      startPosY: pos.y,
    };
  };

  useEffect(() => {
    const handleMouseMove = (e: MouseEvent) => {
      if (isDragging && dragStateRef.current) {
        const dx = e.clientX - dragStateRef.current.startX;
        const dy = e.clientY - dragStateRef.current.startY;
        setPos({
          x: dragStateRef.current.startPosX + dx,
          y: dragStateRef.current.startPosY + dy,
        });
      }
      if (isResizing && resizeStateRef.current) {
        const dx = e.clientX - resizeStateRef.current.startX;
        const dy = e.clientY - resizeStateRef.current.startY;
        setSize({
          width: Math.max(400, resizeStateRef.current.startW + dx),
          height: Math.max(300, resizeStateRef.current.startH + dy),
        });
      }
    };

    const handleMouseUp = () => {
      if (isDragging) {
        setIsDragging(false);
        dragStateRef.current = null;
      }
      if (isResizing) {
        setIsResizing(false);
        resizeStateRef.current = null;
      }
    };

    window.addEventListener('mousemove', handleMouseMove as any);
    window.addEventListener('mouseup', handleMouseUp);
    return () => {
      window.removeEventListener('mousemove', handleMouseMove as any);
      window.removeEventListener('mouseup', handleMouseUp);
    };
  }, [isDragging, isResizing, pos.x, pos.y, size.width, size.height]);

  const handleResizeMouseDown = (e: React.MouseEvent) => {
    e.stopPropagation();
    setIsResizing(true);
    resizeStateRef.current = {
      startX: e.clientX,
      startY: e.clientY,
      startW: size.width,
      startH: size.height,
    };
  };

  const toggleMinimize = () => {
    setIsMinimized(!isMinimized);
  };

  const toggleFullscreen = () => {
    setIsFullscreen(!isFullscreen);
  };

  return (
    <AnimatePresence>
      <motion.div
        ref={windowRef}
        key={windowId}
        initial={{ opacity: 0, scale: 0.9, y: -20 }}
        animate={{
          opacity: 1,
          scale: isMinimized ? 0 : 1,
          y: isMinimized ? -100 : 0,
          left: isFullscreen ? 0 : pos.x,
          top: isFullscreen ? 0 : pos.y,
          width: isFullscreen ? '100vw' : size.width,
          height: isFullscreen ? '100vh' : size.height,
          zIndex,
        }}
        exit={{ opacity: 0, scale: 0.9, y: 20 }}
        transition={{ type: 'spring', stiffness: 300, damping: 25 }}
        onClick={() => setIsFocused(true)}
        style={{
          position: 'fixed',
          backgroundColor: 'var(--bg-secondary)',
          borderRadius: 'var(--radius-lg)',
          boxShadow: isFocused
            ? '0 20px 40px -10px rgba(0, 0, 0, 0.3), 0 10px 20px -15px rgba(0, 0, 0, 0.2)'
            : '0 10px 30px -10px rgba(0, 0, 0, 0.2)',
          border: '1px solid var(--border-color)',
          overflow: 'hidden',
          display: 'flex',
          flexDirection: 'column',
        }}
      >
        {/* 标题栏 */}
        <div
          className="drag-handle"
          onMouseDown={handleMouseDown}
          style={{
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
            padding: '10px 16px',
            backgroundColor: 'var(--bg-tertiary)',
            borderBottom: '1px solid var(--border-color)',
            cursor: 'grab',
            userSelect: 'none',
          }}
        >
          <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
            <StickyNoteIcon size={16} />
            <span style={{ fontWeight: 600, fontSize: 14, color: 'var(--text-primary)' }}>看板</span>
          </div>
          
          <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
            <button
              onClick={toggleMinimize}
              style={{
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                width: 24,
                height: 24,
                borderRadius: '50%',
                border: 'none',
                backgroundColor: 'transparent',
                color: 'var(--text-tertiary)',
                cursor: 'pointer',
                transition: 'all 0.15s ease',
              }}
              onMouseEnter={(e) => {
                e.currentTarget.style.backgroundColor = 'var(--bg-hover)';
                e.currentTarget.style.color = 'var(--text-secondary)';
              }}
              onMouseLeave={(e) => {
                e.currentTarget.style.backgroundColor = 'transparent';
                e.currentTarget.style.color = 'var(--text-tertiary)';
              }}
            >
              <Minus size={14} />
            </button>
            
            <button
              onClick={toggleFullscreen}
              style={{
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                width: 24,
                height: 24,
                borderRadius: '50%',
                border: 'none',
                backgroundColor: 'transparent',
                color: 'var(--text-tertiary)',
                cursor: 'pointer',
                transition: 'all 0.15s ease',
              }}
              onMouseEnter={(e) => {
                e.currentTarget.style.backgroundColor = 'var(--bg-hover)';
                e.currentTarget.style.color = 'var(--text-secondary)';
              }}
              onMouseLeave={(e) => {
                e.currentTarget.style.backgroundColor = 'transparent';
                e.currentTarget.style.color = 'var(--text-tertiary)';
              }}
            >
              {isFullscreen ? <Minimize2 size={14} /> : <Maximize2 size={14} />}
            </button>
            
            <button
              onClick={onClose}
              style={{
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                width: 24,
                height: 24,
                borderRadius: '50%',
                border: 'none',
                backgroundColor: 'transparent',
                color: 'var(--text-tertiary)',
                cursor: 'pointer',
                transition: 'all 0.15s ease',
              }}
              onMouseEnter={(e) => {
                e.currentTarget.style.backgroundColor = 'var(--error-color)';
                e.currentTarget.style.color = 'white';
              }}
              onMouseLeave={(e) => {
                e.currentTarget.style.backgroundColor = 'transparent';
                e.currentTarget.style.color = 'var(--text-tertiary)';
              }}
            >
              <X size={14} />
            </button>
          </div>
        </div>

        {/* 内容区域 */}
        <div style={{ flex: 1, overflow: 'hidden', position: 'relative' }}>
          <BoardView />
        </div>

        {/* 右下角调整大小手柄 */}
        {!isFullscreen && (
          <div
            onMouseDown={handleResizeMouseDown}
            style={{
              position: 'absolute',
              bottom: 0,
              right: 0,
              width: 20,
              height: 20,
              cursor: 'se-resize',
            }}
          />
        )}
      </motion.div>
    </AnimatePresence>
  );
};

function StickyNoteIcon({ size }: { size: number }) {
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
      strokeLinecap="round"
      strokeLinejoin="round"
    >
      <path d="M4 4h12v7l-7 7H4a2 2 0 0 1-2-2V6a2 2 0 0 1 2-2z" />
      <path d="M16 4v7l-7 7" />
    </svg>
  );
}

export default DetachedBoardWindow;
