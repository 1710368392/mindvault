import React, { useState, useCallback, useEffect, useRef } from 'react';
import { createPortal } from 'react-dom';
import { motion, AnimatePresence } from 'framer-motion';
import aiAssistantIcon from '../../assets/ai-assistant-icon.svg';
import { useUIStore } from '../../stores/uiStore';
import { useSettingsStore } from '../../stores/settingsStore';

const BALL_SIZE = 48;
const EDGE_THRESHOLD = 20;
const HIDE_RATIO = 0.55;
const STORAGE_KEY = 'mindvault:aiBallPosition';

function loadBallPosition(): { x: number; y: number } {
  try {
    const stored = localStorage.getItem(STORAGE_KEY);
    if (stored) return JSON.parse(stored);
  } catch { /* ignore */ }
  return { x: window.innerWidth - 70, y: Math.round(window.innerHeight / 2) };
}

function saveBallPosition(pos: { x: number; y: number }) {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(pos));
  } catch { /* ignore */ }
}

function isNearEdge(x: number): boolean {
  return x < EDGE_THRESHOLD || x > window.innerWidth - BALL_SIZE - EDGE_THRESHOLD;
}

const AIFloatingBall: React.FC = () => {
  const aiPanelMode = useUIStore((s) => s.aiPanelMode);
  const openAiMini = useUIStore((s) => s.openAiMini);
  const settings = useSettingsStore((s) => s.settings);

  const isAiEnabled = settings.aiEnabled;

  const [restPosition, setRestPosition] = useState(loadBallPosition);
  const [isAtEdge, setIsAtEdge] = useState(() => {
    const pos = loadBallPosition();
    return pos.x <= EDGE_THRESHOLD || pos.x >= window.innerWidth - BALL_SIZE - EDGE_THRESHOLD;
  });
  const [isDragging, setIsDragging] = useState(false);
  // 拖拽过程中的实时位置（仅拖拽时使用，驱动渲染）
  const [dragPos, setDragPos] = useState<{ x: number; y: number } | null>(null);

  const ballRef = useRef<HTMLDivElement>(null);
  const dragStateRef = useRef({
    active: false,
    hasMoved: false,
    startMouseX: 0,
    startMouseY: 0,
    startBallX: 0,
    startBallY: 0,
    // 用 ref 存储拖拽实时位置，避免 useEffect 依赖 dragPos 导致频繁重建
    currentX: 0,
    currentY: 0,
  });

  const handleMouseDown = useCallback((e: React.MouseEvent) => {
    if (aiPanelMode !== 'closed') return;
    e.preventDefault();
    const ds = dragStateRef.current;
    ds.active = true;
    ds.hasMoved = false;
    ds.startMouseX = e.clientX;
    ds.startMouseY = e.clientY;
    ds.startBallX = restPosition.x;
    ds.startBallY = restPosition.y;
    ds.currentX = restPosition.x;
    ds.currentY = restPosition.y;
    setIsDragging(true);
    setDragPos({ x: restPosition.x, y: restPosition.y });
  }, [aiPanelMode, restPosition]);

  // openAiMini ref，避免 useEffect 依赖变化
  const openAiMiniRef = useRef(openAiMini);
  openAiMiniRef.current = openAiMini;

  useEffect(() => {
    const handleMouseMove = (e: MouseEvent) => {
      const ds = dragStateRef.current;
      if (!ds.active) return;
      const dx = e.clientX - ds.startMouseX;
      const dy = e.clientY - ds.startMouseY;
      if (Math.abs(dx) > 3 || Math.abs(dy) > 3) ds.hasMoved = true;
      // 允许拖到屏幕外，不做边界限制
      const newX = ds.startBallX + dx;
      const newY = ds.startBallY + dy;
      ds.currentX = newX;
      ds.currentY = newY;
      setDragPos({ x: newX, y: newY });
    };

    const handleMouseUp = () => {
      const ds = dragStateRef.current;
      if (!ds.active) return;
      ds.active = false;
      setIsDragging(false);

      if (ds.hasMoved) {
        // 使用屏幕边缘进行吸附
        const snapThreshold = 50;
        const finalX = ds.currentX;
        const finalY = ds.currentY;
        
        let snapX = finalX;
        let snapY = finalY;
        
        // 左侧吸附
        if (finalX < snapThreshold) {
          snapX = 0;
        }
        // 右侧吸附
        else if (finalX > window.screen.width - BALL_SIZE - snapThreshold) {
          snapX = window.screen.width - BALL_SIZE;
        }
        // 顶部吸附
        if (finalY < snapThreshold) {
          snapY = 0;
        }
        // 底部吸附
        else if (finalY > window.screen.height - BALL_SIZE - snapThreshold) {
          snapY = window.screen.height - BALL_SIZE;
        }
        
        const finalPos = { x: snapX, y: snapY };
        setRestPosition(finalPos);
        saveBallPosition(finalPos);
        setIsAtEdge(false); // 简化处理，不再使用边缘状态
      } else {
        openAiMiniRef.current();
      }
      setDragPos(null);
    };

    window.addEventListener('mousemove', handleMouseMove);
    window.addEventListener('mouseup', handleMouseUp);
    return () => {
      window.removeEventListener('mousemove', handleMouseMove);
      window.removeEventListener('mouseup', handleMouseUp);
    };
  }, []); // 空依赖，监听器只注册一次

  useEffect(() => {
    const handleResize = () => {
      setRestPosition((prev) => {
        const x = Math.min(prev.x, window.innerWidth - BALL_SIZE);
        const y = Math.min(prev.y, window.innerHeight - BALL_SIZE);
        const nearEdge = isNearEdge(x);
        const finalPos = nearEdge
          ? { x: x < EDGE_THRESHOLD ? 0 : window.innerWidth - BALL_SIZE, y }
          : { x, y };
        saveBallPosition(finalPos);
        setIsAtEdge(nearEdge);
        return finalPos;
      });
    };
    window.addEventListener('resize', handleResize);
    return () => window.removeEventListener('resize', handleResize);
  }, []);

  if (aiPanelMode !== 'closed') return null;
  if (!isAiEnabled) return null;

  // 拖拽时使用 dragPos，否则使用 restPosition
  const displayPos = isDragging && dragPos ? dragPos : restPosition;

  const translateX = isAtEdge && !isDragging
    ? (restPosition.x <= EDGE_THRESHOLD ? -(BALL_SIZE * HIDE_RATIO) : BALL_SIZE * HIDE_RATIO)
    : 0;

  return createPortal(
    <AnimatePresence>
      <motion.div
        ref={ballRef}
        initial={{ scale: 0, opacity: 0 }}
        animate={{
          scale: 1,
          opacity: 1,
        }}
        exit={{ scale: 0, opacity: 0 }}
        transition={{
          type: 'spring',
          damping: 25,
          stiffness: 300,
        }}
        onMouseDown={handleMouseDown}
        style={{
          position: 'fixed',
          width: BALL_SIZE,
          height: BALL_SIZE,
          borderRadius: '50%',
          background: 'transparent',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          cursor: isDragging ? 'grabbing' : 'pointer',
          zIndex: 10000,
          boxShadow: 'none',
          border: 'none',
          userSelect: 'none',
          touchAction: 'none',
          left: displayPos.x,
          top: displayPos.y,
          transform: `translateX(${translateX}px)`,
          transition: isDragging ? 'none' : 'left 0.3s ease, top 0.3s ease, transform 0.3s ease',
          willChange: isDragging ? 'left, top, transform' : 'auto',
          overflow: 'hidden',
        }}
        whileHover={!isDragging ? { scale: 1.1 } : {}}
        whileTap={!isDragging ? { scale: 0.95 } : {}}
      >
        <img src={aiAssistantIcon} alt="AI" draggable={false} style={{ width: '100%', height: '100%', objectFit: 'cover', pointerEvents: 'none' }} />
      </motion.div>
    </AnimatePresence>,
    document.body
  );
};

export default AIFloatingBall;
