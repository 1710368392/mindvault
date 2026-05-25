import React, { useState, useCallback, useRef, useEffect, useMemo } from 'react';
import {
  Plus,
  ZoomIn,
  ZoomOut,
  Maximize2,
  Move,
  MousePointer,
  StickyNote,
  Edit3,
  Trash2,
  PackageOpen,
  Palette,
  RefreshCw,
  Eye,
} from 'lucide-react';
import { Spin, Tooltip, Popover, Empty, Badge } from 'antd';
import GradientSpinner from '../common/GradientSpinner';
import { motion, AnimatePresence } from 'framer-motion';
import { useBoardStore } from '../../stores/boardStore';
import { truncateText } from '../../utils/formatters';
import { SUBTYPE_CONFIG, getAllSubtypes } from '@shared/types';
import type { BoardStickyNote, CreativeChain, Creativity } from '@shared/types';
import { api } from '@renderer/utils/api';
import CreativeChainSnapshotViewer from './CreativeChainSnapshotViewer';

interface BoardViewProps {
  boardId: string;
  onStickyClick?: (note: any) => void;
  onStickyContextMenu?: (e: React.MouseEvent, note: any) => void;
}

const STICKY_COLORS = [
  '#FFF9C4',
  '#C8E6C9',
  '#BBDEFB',
  '#F8BBD0',
  '#D1C4E9',
  '#FFE0B2',
];

const DARK_STICKY_COLORS: Record<string, string> = {
  '#FFF9C4': '#5C5520',
  '#C8E6C9': '#2D4A2E',
  '#BBDEFB': '#2A3F55',
  '#F8BBD0': '#4A2A38',
  '#D1C4E9': '#3A2A4A',
  '#FFE0B2': '#4A3A20',
};

const NOTE_WIDTH = 200;
const NOTE_MIN_HEIGHT = 140;
const PIN_GRID_SIZE = 100; // 钉子网格间距

function getDarkColor(color: string): string {
  return DARK_STICKY_COLORS[color] || color;
}

function getNoteRotation(id: string): number {
  const hash = id.split('').reduce((acc, char) => acc + char.charCodeAt(0), 0);
  return ((hash % 600) - 300) / 100;
}

// 计算最近的钉子位置（针对便签顶部小圆点）
function snapToPinGrid(noteTopLeftX: number, noteTopLeftY: number): { x: number; y: number } {
  // 小圆点在便签的中心位置
  const dotOffsetX = NOTE_WIDTH / 2;
  const dotOffsetY = 4; // 小圆点中心点距离便签顶部的距离（top: -3, 高度14，中心在-3 + 7 = 4）
  
  // 计算小圆点的位置
  const dotX = noteTopLeftX + dotOffsetX;
  const dotY = noteTopLeftY + dotOffsetY;
  
  // 背景钉子的中心位置在 PIN_GRID_SIZE/2 + n*PIN_GRID_SIZE，例如 50, 150, 250...
  const halfGrid = PIN_GRID_SIZE / 2;
  const snappedDotX = Math.round((dotX - halfGrid) / PIN_GRID_SIZE) * PIN_GRID_SIZE + halfGrid;
  const snappedDotY = Math.round((dotY - halfGrid) / PIN_GRID_SIZE) * PIN_GRID_SIZE + halfGrid;
  
  // 计算便签左上角的新位置
  const snappedNoteX = snappedDotX - dotOffsetX;
  const snappedNoteY = snappedDotY - dotOffsetY;
  
  return { x: snappedNoteX, y: snappedNoteY };
}

const BoardView: React.FC<BoardViewProps> = ({
  boardId,
  onStickyClick,
  onStickyContextMenu,
}) => {
  const {
    stickyNotes,
    isLoading: stickyLoading,
    canvasToolMode,
    setCanvasToolMode,
    fetchStickyNotes,
    addStickyNote,
    updateStickyNote,
    removeStickyNote,
  } = useBoardStore();
  const currentBoard = useBoardStore((s) => s.currentBoard);
  const [scale, setScale] = useState(1);
  const [offset, setOffset] = useState({ x: 0, y: 0 });
  const [isPanning, setIsPanning] = useState(false);
  const [panStart, setPanStart] = useState({ x: 0, y: 0 });

  const [draggingNote, setDraggingNote] = useState<string | null>(null);
  const [dragOffset, setDragOffset] = useState({ x: 0, y: 0 });

  const [zOrder, setZOrder] = useState<string[]>([]);
  const [lastMovedNote, setLastMovedNote] = useState<string | null>(null);

  const [contextMenu, setContextMenu] = useState<{
    x: number;
    y: number;
    note: BoardStickyNote;
  } | null>(null);

  const [editingNote, setEditingNote] = useState<string | null>(null);
  const [editTitle, setEditTitle] = useState('');
  const [editContent, setEditContent] = useState('');

  const [selectedNoteId, setSelectedNoteId] = useState<string | null>(null);

  // 查看创意链快照
  const [snapshotViewer, setSnapshotViewer] = useState<{
    open: boolean;
    creativeChain: CreativeChain | null;
    creativityMap: Record<string, Creativity>;
  }>({
    open: false,
    creativeChain: null,
    creativityMap: {},
  });

  const [velocity, setVelocity] = useState({ x: 0, y: 0 });
  const lastDragPos = useRef({ x: 0, y: 0, t: 0 });
  const [targetPinPosition, setTargetPinPosition] = useState<{ x: number; y: number } | null>(null);

  const [isDark, setIsDark] = useState(false);

  const containerRef = useRef<HTMLDivElement>(null);
  const canvasRef = useRef<HTMLDivElement>(null);
  const editTitleRef = useRef<HTMLInputElement>(null);
  const editContentRef = useRef<HTMLTextAreaElement>(null);

  // ===== 空格键处理 Refs =====
  const spaceLongPressTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const isSpaceLongPressRef = useRef(false);
  const originalCanvasModeRef = useRef<'hand' | 'pointer'>(canvasToolMode);

  useEffect(() => {
    const check = () => {
      setIsDark(document.documentElement.getAttribute('data-theme') === 'dark');
    };
    check();
    const observer = new MutationObserver(check);
    observer.observe(document.documentElement, { attributes: true, attributeFilter: ['data-theme'] });
    return () => observer.disconnect();
  }, []);

  useEffect(() => {
    if (boardId) {
      fetchStickyNotes(boardId);
    }
  }, [boardId, fetchStickyNotes]);

  useEffect(() => {
    setZOrder(stickyNotes.map((n) => n.id));
  }, [stickyNotes.length]);

  const getNoteZIndex = useCallback((noteId: string, isDragging: boolean) => {
    if (isDragging) return 100;
    if (noteId === lastMovedNote) return 50;
    const idx = zOrder.indexOf(noteId);
    return 10 + (idx >= 0 ? idx : 0);
  }, [zOrder, lastMovedNote]);

  const bringToTop = useCallback((noteId: string) => {
    setZOrder((prev) => [...prev.filter((id) => id !== noteId), noteId]);
    setLastMovedNote(noteId);
  }, []);

  const handleWheel = useCallback((e: WheelEvent) => {
    if (e.ctrlKey || e.metaKey) {
      e.preventDefault();
      const delta = e.deltaY > 0 ? -0.1 : 0.1;
      setScale((prev) => Math.min(Math.max(prev + delta, 0.2), 3));
    }
  }, []);

  useEffect(() => {
    const el = containerRef.current;
    if (!el) return;
    el.addEventListener('wheel', handleWheel, { passive: false });
    return () => el.removeEventListener('wheel', handleWheel);
  }, [handleWheel]);

  const handleCanvasMouseDown = useCallback(
    (e: React.MouseEvent) => {
      if ((e.target as HTMLElement).closest('.sticky-note-card')) return;
      if (canvasToolMode !== 'hand') return;
      setIsPanning(true);
      setPanStart({ x: e.clientX - offset.x, y: e.clientY - offset.y });
      setContextMenu(null);
      setColorPickerNote(null);
    },
    [offset, canvasToolMode]
  );

  const handleMouseMove = useCallback(
    (e: React.MouseEvent) => {
      if (isPanning) {
        setOffset({
          x: e.clientX - panStart.x,
          y: e.clientY - panStart.y,
        });
      }
      if (draggingNote) {
        const canvas = canvasRef.current;
        if (!canvas) return;
        const rect = canvas.getBoundingClientRect();
        const x = (e.clientX - rect.left - offset.x - dragOffset.x) / scale;
        const y = (e.clientY - rect.top - offset.y - dragOffset.y) / scale;

        const now = Date.now();
        const dt = Math.max(now - lastDragPos.current.t, 1);
        setVelocity({
          x: (e.clientX - lastDragPos.current.x) / dt * 16,
          y: (e.clientY - lastDragPos.current.y) / dt * 16,
        });
        lastDragPos.current = { x: e.clientX, y: e.clientY, t: now };

        // 更新目标钉子位置用于高亮（小圆点会吸附到的位置）
        const dotOffsetX = NOTE_WIDTH / 2;
        const dotOffsetY = 4; // 小圆点中心点距离便签顶部的距离
        const dotX = x + dotOffsetX;
        const dotY = y + dotOffsetY;
        
        // 背景钉子的中心位置在 PIN_GRID_SIZE/2 + n*PIN_GRID_SIZE，例如 50, 150, 250...
        const halfGrid = PIN_GRID_SIZE / 2;
        const snappedDotX = Math.round((dotX - halfGrid) / PIN_GRID_SIZE) * PIN_GRID_SIZE + halfGrid;
        const snappedDotY = Math.round((dotY - halfGrid) / PIN_GRID_SIZE) * PIN_GRID_SIZE + halfGrid;
        setTargetPinPosition({ x: snappedDotX, y: snappedDotY });

        useBoardStore.setState((s) => ({
          stickyNotes: s.stickyNotes.map((n) =>
            n.id === draggingNote ? { ...n, positionX: x, positionY: y } : n
          ),
        }));
      }
    },
    [isPanning, panStart, draggingNote, dragOffset, scale, offset]
  );

  const handleMouseUp = useCallback(() => {
    if (draggingNote) {
      const note = useBoardStore.getState().stickyNotes.find((n) => n.id === draggingNote);
      if (note) {
        const inertiaX = velocity.x * 0.3;
        const inertiaY = velocity.y * 0.3;
        const finalX = note.positionX + inertiaX;
        const finalY = note.positionY + inertiaY;
        // 吸附到最近的钉子
        const snapped = snapToPinGrid(finalX, finalY);
        updateStickyNote(draggingNote, {
          positionX: snapped.x,
          positionY: snapped.y,
        });
      }
      bringToTop(draggingNote);
      setVelocity({ x: 0, y: 0 });
      setTargetPinPosition(null);
    }
    setIsPanning(false);
    setDraggingNote(null);
  }, [draggingNote, updateStickyNote, velocity, bringToTop]);

  const handleNoteDragStart = useCallback(
    (e: React.MouseEvent, note: BoardStickyNote) => {
      e.stopPropagation();
      // 如果有右键菜单或颜色选择器打开，禁止拖拽
      if (contextMenu) {
        return;
      }
      if (canvasToolMode !== 'hand') return;
      const canvas = canvasRef.current;
      if (!canvas) return;
      const rect = canvas.getBoundingClientRect();
      const cardX = note.positionX * scale + offset.x + rect.left;
      const cardY = note.positionY * scale + offset.y + rect.top;
      setDraggingNote(note.id);
      setDragOffset({
        x: e.clientX - cardX,
        y: e.clientY - cardY,
      });
      setContextMenu(null);
      setColorPickerNote(null);
      bringToTop(note.id);
      lastDragPos.current = { x: e.clientX, y: e.clientY, t: Date.now() };
    },
    [scale, offset, canvasToolMode, bringToTop, contextMenu]
  );

  const handleNoteContextMenu = useCallback(
    (e: React.MouseEvent, note: BoardStickyNote) => {
      e.preventDefault();
      e.stopPropagation();
      setContextMenu({ x: e.clientX, y: e.clientY, note });
      setColorPickerNote(null);
      setSelectedNoteId(note.id);
    },
    []
  );

  const startEditing = useCallback((note: BoardStickyNote) => {
    setEditingNote(note.id);
    setEditTitle(note.title);
    setEditContent(note.content);
    setContextMenu(null);
    setColorPickerNote(null);
    setTimeout(() => editTitleRef.current?.focus(), 50);
  }, []);

  const saveEdit = useCallback(() => {
    if (editingNote) {
      updateStickyNote(editingNote, { title: editTitle, content: editContent });
      setEditingNote(null);
    }
  }, [editingNote, editTitle, editContent, updateStickyNote]);

  const handleColorChange = useCallback(
    (noteId: string, color: string) => {
      updateStickyNote(noteId, { color });
      setColorPickerNote(null);
      setContextMenu(null);
    },
    [updateStickyNote]
  );

  const handleDelete = useCallback(
    async (noteId: string) => {
      const note = stickyNotes.find(n => n.id === noteId);
      if (note) {
        try {
          await api.trash.add({
            itemType: 'board-sticky',
            itemId: noteId,
            sourceBoardId: boardId,
            sourceBoardName: currentBoard?.name || '',
            snapshot: {
              title: note.title, content: note.content, color: note.color,
              positionX: note.positionX, positionY: note.positionY,
              width: note.width, height: note.height,
              sourceCreativityIds: note.sourceCreativityIds,
              sortOrder: note.sortOrder, type: note.type,
              creativeChainId: note.creativeChainId, tags: note.tags,
            },
          });
        } catch {}
      }
      removeStickyNote(noteId);
      setContextMenu(null);
      setColorPickerNote(null);
    },
    [removeStickyNote, stickyNotes, boardId, currentBoard]
  );

  const handleUnpack = useCallback(
    (note: BoardStickyNote) => {
      if (note.sourceCreativityIds && note.sourceCreativityIds.length > 0) {
        removeStickyNote(note.id);
      }
      setContextMenu(null);
    },
    [removeStickyNote]
  );

  const handleViewSnapshot = useCallback(async (note: BoardStickyNote) => {
    if (note.type !== 'creative-chain' || !note.creativeChainId) return;
    try {
      const chain = await api.board.creativeChain.read(note.boardId, note.creativeChainId);
      if (!chain) return;

      const creativityMap: Record<string, Creativity> = {};
      for (const item of chain.snapshot.items) {
        if (item.creativitySnapshot) {
          const snap = item.creativitySnapshot;
          creativityMap[item.creativityId] = {
            id: item.creativityId,
            title: snap.title,
            content: snap.content,
            type: snap.type as Creativity['type'],
            subtype: snap.subtype as Creativity['subtype'],
            contentFormat: snap.contentFormat as Creativity['contentFormat'],
            priority: snap.priority || 0,
            emojiReaction: snap.emojiReaction || null,
            cardStyle: snap.cardStyle || null,
            isFavorite: snap.isFavorite,
            mediaFilePath: snap.mediaFilePath,
            tags: (snap.tags || []).map((t: string, i: number) => ({ id: `tag-${i}`, name: t, color: null, icon: null, createdAt: '' })),
            status: 'active',
            templateId: null,
            boardId: null,
            positionX: null,
            positionY: null,
            createdAt: '',
            updatedAt: '',
            lastReviewedAt: null,
            isRead: true,
            wordCount: 0,
          };
        } else {
          try {
            const creativity = await api.creativity.read(item.creativityId);
            if (creativity) {
              creativityMap[item.creativityId] = creativity;
            }
          } catch {
            // ignore
          }
        }
      }

      setSnapshotViewer({
        open: true,
        creativeChain: chain,
        creativityMap,
      });
    } catch (error) {
      console.error('获取创意链失败:', error);
    }
    setContextMenu(null);
  }, []);

  const handleAddNote = useCallback(async () => {
    const canvas = canvasRef.current;
    const container = containerRef.current;
    if (!canvas || !container) return;
    const containerRect = container.getBoundingClientRect();
    const centerX = (containerRect.width / 2 - offset.x) / scale;
    const centerY = (containerRect.height / 2 - offset.y) / scale;

    // 让便签的小圆点对齐中心附近的钉子
    const dotOffsetX = NOTE_WIDTH / 2;
    const dotOffsetY = 4; // 小圆点中心点距离便签顶部的距离
    const desiredDotX = centerX;
    const desiredDotY = centerY - NOTE_MIN_HEIGHT / 2 + dotOffsetY;
    
    // 背景钉子的中心位置在 PIN_GRID_SIZE/2 + n*PIN_GRID_SIZE，例如 50, 150, 250...
    const halfGrid = PIN_GRID_SIZE / 2;
    const snappedDotX = Math.round((desiredDotX - halfGrid) / PIN_GRID_SIZE) * PIN_GRID_SIZE + halfGrid;
    const snappedDotY = Math.round((desiredDotY - halfGrid) / PIN_GRID_SIZE) * PIN_GRID_SIZE + halfGrid;
    
    // 计算便签左上角位置
    const snappedNoteX = snappedDotX - dotOffsetX;
    const snappedNoteY = snappedDotY - dotOffsetY;

    await addStickyNote(boardId, {
      title: '新便签',
      content: '',
      color: STICKY_COLORS[Math.floor(Math.random() * STICKY_COLORS.length)],
      positionX: snappedNoteX,
      positionY: snappedNoteY,
      sourceCreativityIds: null,
    });
  }, [boardId, addStickyNote, offset, scale]);

  const zoomIn = () => setScale((prev) => Math.min(prev + 0.2, 3));
  const zoomOut = () => setScale((prev) => Math.max(prev - 0.2, 0.2));
  const resetView = () => {
    setScale(1);
    setOffset({ x: 0, y: 0 });
  };

  useEffect(() => {
    const handleClick = () => {
      setContextMenu(null);
      setSelectedNoteId(null);
    };
    if (contextMenu) {
      document.addEventListener('click', handleClick);
      return () => document.removeEventListener('click', handleClick);
    }
  }, [contextMenu]);

  // ===== 空格键处理 =====
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        setContextMenu(null);
        setColorPickerNote(null);
        setSelectedNoteId(null);
      }
      if ((e.key === 'Delete' || e.key === 'Backspace') && selectedNoteId) {
        // 只有在指针模式或有选中便签时才删除
        if (canvasToolMode === 'pointer' || contextMenu?.note?.id === selectedNoteId) {
          handleDelete(selectedNoteId);
        }
      }
      if (e.key === ' ' && !e.repeat) {
        // 空格键处理
        e.preventDefault();
        isSpaceLongPressRef.current = false;
        originalCanvasModeRef.current = canvasToolMode;
        
        // 200ms 后如果还没松手，视为长按，临时切换模式
        spaceLongPressTimerRef.current = setTimeout(() => {
          isSpaceLongPressRef.current = true;
          // 临时切换到另一个模式
          setCanvasToolMode(canvasToolMode === 'pointer' ? 'hand' : 'pointer');
        }, 200);
      }
    };
    
    const handleKeyUp = (e: KeyboardEvent) => {
      if (e.key === ' ') {
        e.preventDefault();
        
        if (spaceLongPressTimerRef.current) {
          clearTimeout(spaceLongPressTimerRef.current);
          spaceLongPressTimerRef.current = null;
        }
        
        if (isSpaceLongPressRef.current) {
          // 长按结束，恢复原来的模式
          setCanvasToolMode(originalCanvasModeRef.current);
          isSpaceLongPressRef.current = false;
        } else {
          // 单击，切换模式
          setCanvasToolMode(canvasToolMode === 'pointer' ? 'hand' : 'pointer');
        }
      }
    };

    document.addEventListener('keydown', handleKeyDown);
    document.addEventListener('keyup', handleKeyUp);
    return () => {
      document.removeEventListener('keydown', handleKeyDown);
      document.removeEventListener('keyup', handleKeyUp);
      if (spaceLongPressTimerRef.current) {
        clearTimeout(spaceLongPressTimerRef.current);
      }
    };
  }, [selectedNoteId, canvasToolMode, contextMenu, setCanvasToolMode]);

  return (
    <div
      ref={containerRef}
      className={
        canvasToolMode === 'hand' ? (isPanning ? 'cursor-grabbing' : 'cursor-grab') : ''
      }
      style={{
        position: 'absolute',
        inset: 0,
        overflow: 'hidden',
        backgroundColor: 'var(--bg-primary)',
        cursor: canvasToolMode === 'hand' ? (isPanning ? 'grabbing' : 'grab') : 'default',
      }}
      onMouseDown={handleCanvasMouseDown}
      onMouseMove={handleMouseMove}
      onMouseUp={handleMouseUp}
      onMouseLeave={handleMouseUp}
    >
      <Spin spinning={stickyLoading} tip="加载便签中..." indicator={<GradientSpinner />} style={{ height: '100%' }}>
        <div style={{ minHeight: '100%', position: 'relative' }}>
        {!stickyLoading && stickyNotes.length === 0 ? (
          <div style={{ 
            width: '100%', 
            height: '100%', 
            display: 'flex', 
            flexDirection: 'column', 
            alignItems: 'center', 
            justifyContent: 'center',
            paddingTop: 40
          }}>
            <div style={{ width: 80, height: 80, borderRadius: 'var(--radius-xl)', backgroundColor: 'var(--bg-tertiary)', display: 'flex', alignItems: 'center', justifyContent: 'center', marginBottom: 16 }}>
              <StickyNote size={36} color="var(--text-tertiary)" />
            </div>
            <div style={{ textAlign: 'center' }}>
              <div style={{ fontSize: 18, fontWeight: 500, color: 'var(--text-primary)', marginBottom: 4 }}>还没有便签</div>
              <div style={{ fontSize: 14, color: 'var(--text-tertiary)' }}>从画布发送创意到这里</div>
            </div>
          </div>
        ) : (
    <div
        ref={canvasRef}
        style={{
          position: 'absolute',
          inset: 0,
          transform: `translate(${offset.x}px, ${offset.y}px) scale(${scale})`,
          transformOrigin: '0 0',
        }}
      >
        {/* 钉子网格 */}
        <div style={{
          position: 'absolute',
          inset: -2500, // 扩展范围
          pointerEvents: 'none',
          backgroundImage: `
            radial-gradient(circle at 50% 50%, 
              ${isDark ? 'rgba(80,80,80,0.35)' : 'rgba(150,150,150,0.25)'} 0%, 
              ${isDark ? 'rgba(80,80,80,0.35)' : 'rgba(150,150,150,0.25)'} 4px, 
              transparent 5px
            )
          `,
          backgroundSize: `${PIN_GRID_SIZE}px ${PIN_GRID_SIZE}px`,
        }} />

        {/* 目标钉子高亮 */}
        {targetPinPosition && (
          <div style={{
            position: 'absolute',
            left: targetPinPosition.x - 20,
            top: targetPinPosition.y - 20,
            width: 40,
            height: 40,
            borderRadius: '50%',
            background: `radial-gradient(circle, 
              rgba(108,99,255,0.3) 0%, 
              rgba(108,99,255,0.1) 40%, 
              transparent 70%
            )`,
            border: `2px solid var(--primary-color)`,
            boxShadow: '0 0 15px rgba(108,99,255,0.5)',
            pointerEvents: 'none',
            zIndex: 5,
            animation: 'pulse 1s ease-in-out infinite',
          }} />
        )}

        <AnimatePresence>
          {stickyNotes.map((note, index) => {
            const isEditing = editingNote === note.id;
            const isDragging = draggingNote === note.id;
            const sourceCount = note.sourceCreativityIds?.length || 0;
            const subtypeCfg = note.subtype ? getAllSubtypes()[note.subtype] : null;
            const rotation = getNoteRotation(note.id);
            const noteColor = isDark ? getDarkColor(note.color) : note.color;
            const textColor = isDark ? '#e0e0e0' : '#333';
            const subTextColor = isDark ? '#b0b0b0' : '#555';
            const metaColor = isDark ? '#888' : '#999';
            const pinColor = isDark ? 'rgba(255,255,255,0.25)' : 'rgba(0,0,0,0.12)';

            return (
              <motion.div
                key={note.id}
                className={
                  "sticky-note-card " +
                  (canvasToolMode === 'hand' ? (isDragging ? 'cursor-grabbing' : 'cursor-grab') : 'cursor-pointer')
                }
                initial={{ opacity: 0, scale: 0.7, rotate: rotation - 5 }}
                animate={{
                  opacity: 1,
                  scale: isDragging ? 1.06 : 1,
                  rotate: isDragging ? 0 : rotation,
                  x: 0,
                  y: 0,
                }}
                exit={{ opacity: 0, scale: 0.5, rotate: rotation + 10 }}
                transition={{
                  type: 'spring',
                  stiffness: isDragging ? 500 : 300,
                  damping: isDragging ? 30 : 25,
                  mass: 0.8,
                }}
                whileHover={!isDragging ? { scale: 1.04, rotate: 0, zIndex: 60 } : {}}
                style={{
                  position: 'absolute',
                  left: note.positionX,
                  top: note.positionY,
                  width: NOTE_WIDTH,
                  minHeight: NOTE_MIN_HEIGHT,
                  cursor: canvasToolMode === 'hand' ? (isDragging ? 'grabbing' : 'grab') : 'pointer',
                  zIndex: getNoteZIndex(note.id, isDragging),
                  padding: '14px 14px 10px',
                  display: 'flex',
                  flexDirection: 'column',
                  userSelect: isEditing ? 'text' : 'none',
                  originX: 0.5,
                  originY: 0.5,
                }}
                onMouseDown={(e) => handleNoteDragStart(e, note)}
                onClick={(e) => {
                  e.stopPropagation();
                  if (isEditing || isDragging) return;
                  if (canvasToolMode === 'hand') return; // 抓手模式下不触发
                  setSelectedNoteId(note.id);
                  if (note.type === 'creative-chain' && note.creativeChainId) {
                    handleViewSnapshot(note);
                  } else {
                    onStickyClick?.(note);
                  }
                }}
                onDoubleClick={(e) => {
                  e.stopPropagation();
                  if (isDragging) return;
                  startEditing(note);
                }}
                onContextMenu={(e) => handleNoteContextMenu(e, note)}
              >
                <div style={{
                  position: 'absolute',
                  inset: 0,
                  borderRadius: 'var(--radius-md)',
                  backgroundColor: noteColor,
                  border: selectedNoteId === note.id 
                    ? '2px solid var(--primary-color)' 
                    : subtypeCfg ? `3px solid ${subtypeCfg.color}` : undefined,
                  boxShadow: isDragging
                    ? '0 16px 40px rgba(0,0,0,0.2), 0 4px 12px rgba(0,0,0,0.12)'
                    : '0 3px 8px rgba(0,0,0,0.1), 0 1px 3px rgba(0,0,0,0.06)',
                  transition: 'box-shadow 0.25s ease',
                  overflow: 'hidden',
                }}>
                  <div style={{
                    position: 'absolute', inset: 0,
                    background: isDark
                      ? 'linear-gradient(135deg, rgba(255,255,255,0.03) 0%, transparent 60%)'
                      : 'linear-gradient(135deg, rgba(255,255,255,0.4) 0%, rgba(255,255,255,0.1) 30%, transparent 60%)',
                    pointerEvents: 'none',
                  }} />
                  <div style={{
                    position: 'absolute', bottom: 0, right: 0,
                    width: 24, height: 24,
                    background: isDark
                      ? 'linear-gradient(225deg, transparent 50%, rgba(0,0,0,0.15) 50%)'
                      : 'linear-gradient(225deg, transparent 50%, rgba(0,0,0,0.04) 50%)',
                    borderRadius: '0 0 var(--radius-md) 0',
                    pointerEvents: 'none',
                  }} />
                  <div style={{
                    position: 'absolute', top: -3, left: '50%',
                    transform: `translateX(-50%) rotate(${(index % 3 - 1) * 3}deg)`,
                    width: 36, height: 14,
                    background: `linear-gradient(180deg, ${pinColor} 0%, ${isDark ? 'rgba(255,255,255,0.12)' : 'rgba(0,0,0,0.06)'} 100%)`,
                    borderRadius: 2,
                    boxShadow: '0 1px 2px rgba(0,0,0,0.1)',
                    zIndex: 3,
                    pointerEvents: 'none',
                  }} />
                  <div style={{
                    position: 'absolute', top: 4, left: '50%',
                    transform: `translateX(-50%) rotate(${(index % 3 - 1) * 3}deg)`,
                    width: 10, height: 10, borderRadius: '50%',
                    background: isDark
                      ? 'radial-gradient(circle at 40% 40%, rgba(255,255,255,0.2), rgba(255,255,255,0.05))'
                      : 'radial-gradient(circle at 40% 40%, rgba(200,200,200,0.6), rgba(150,150,150,0.3))',
                    boxShadow: '0 1px 3px rgba(0,0,0,0.15)',
                    zIndex: 4,
                    pointerEvents: 'none',
                  }} />
                </div>

                <Badge count={sourceCount} size="small" offset={[-8, -4]} style={{ position: 'absolute', top: -12, right: -8, zIndex: 5 }}>
                <div style={{ position: 'relative', zIndex: 2, display: 'flex', flexDirection: 'column', flex: 1 }}>
                  {subtypeCfg && (
                    <div
                      style={{ position: 'absolute', top: -4, left: -2, fontSize: 12, zIndex: 2, opacity: 0.8 }}
                      title={subtypeCfg.label}
                    >
                      {subtypeCfg.icon}
                    </div>
                  )}

                  {isEditing ? (
                    <input
                      ref={editTitleRef}
                      value={editTitle}
                      onChange={(e) => setEditTitle(e.target.value)}
                      onBlur={saveEdit}
                      onKeyDown={(e) => {
                        if (e.key === 'Enter') { e.preventDefault(); editContentRef.current?.focus(); }
                        if (e.key === 'Escape') saveEdit();
                      }}
                      onMouseDown={(e) => e.stopPropagation()}
                      style={{
                        border: 'none',
                        background: isDark ? 'rgba(255,255,255,0.08)' : 'rgba(0,0,0,0.05)',
                        borderRadius: 'var(--radius-sm)',
                        padding: '4px 6px', fontSize: 14, fontWeight: 600,
                        color: textColor, outline: 'none', marginBottom: 6,
                      }}
                    />
                  ) : (
                    <div style={{
                      fontSize: 14, fontWeight: 600, color: textColor,
                      marginBottom: 6, lineHeight: 1.3,
                      overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap',
                    }}>
                      {note.title}
                    </div>
                  )}

                  {isEditing ? (
                    <textarea
                      ref={editContentRef}
                      value={editContent}
                      onChange={(e) => setEditContent(e.target.value)}
                      onBlur={saveEdit}
                      onKeyDown={(e) => { if (e.key === 'Escape') saveEdit(); }}
                      onMouseDown={(e) => e.stopPropagation()}
                      style={{
                        flex: 1, border: 'none',
                        background: isDark ? 'rgba(255,255,255,0.08)' : 'rgba(0,0,0,0.05)',
                        borderRadius: 'var(--radius-sm)',
                        padding: '4px 6px', fontSize: 12, color: subTextColor,
                        outline: 'none', resize: 'none', minHeight: 60,
                        lineHeight: 1.5, fontFamily: 'inherit',
                      }}
                    />
                  ) : (
                    <div style={{
                      flex: 1, fontSize: 12, color: subTextColor, lineHeight: 1.5,
                      overflow: 'hidden', wordBreak: 'break-word',
                    }}>
                      {note.content ? truncateText(note.content, 120) : (
                        <span style={{ fontStyle: 'italic', color: metaColor }}>双击编辑...</span>
                      )}
                    </div>
                  )}

                  {!isEditing && (
                    <div style={{
                      fontSize: 10, color: metaColor, marginTop: 8, textAlign: 'right',
                    }}>
                      {new Date(note.updatedAt).toLocaleDateString('zh-CN')}
                    </div>
                  )}
                </div>
                </Badge>
              </motion.div>
            );
          })}
        </AnimatePresence>
      </div>
        )}
        </div>
      </Spin>

      <div style={{
        position: 'absolute', bottom: 16, right: 16,
        display: 'flex', alignItems: 'center', justifyContent: 'space-between',
        zIndex: 20, pointerEvents: 'none',
      }}>
        <div style={{
          pointerEvents: 'auto',
          display: 'flex', alignItems: 'center', gap: 4, padding: 4,
          borderRadius: 'var(--radius-lg)',
          backgroundColor: 'var(--bg-secondary)',
          border: '1px solid var(--border-color)',
          boxShadow: 'var(--shadow-lg)',
        }}>
          <Tooltip title="缩小"><button onClick={zoomOut} style={{ padding: 8, borderRadius: 'var(--radius-md)', color: 'var(--text-secondary)', display: 'flex', alignItems: 'center', background: 'none', border: 'none', cursor: 'pointer' }}><ZoomOut size={16} /></button></Tooltip>
          <span style={{ padding: '0 8px', fontSize: 12, color: 'var(--text-tertiary)', minWidth: 48, textAlign: 'center' }}>{Math.round(scale * 100)}%</span>
          <Tooltip title="放大"><button onClick={zoomIn} style={{ padding: 8, borderRadius: 'var(--radius-md)', color: 'var(--text-secondary)', display: 'flex', alignItems: 'center', background: 'none', border: 'none', cursor: 'pointer' }}><ZoomIn size={16} /></button></Tooltip>
          <div style={{ width: 1, height: 20, backgroundColor: 'var(--border-color)', margin: '0 2px' }} />
          <Tooltip title={canvasToolMode === 'pointer' ? '切换到抓手模式' : '切换到指针模式'}>
          <button
            onClick={() => useBoardStore.getState().setCanvasToolMode(canvasToolMode === 'pointer' ? 'hand' : 'pointer')}
            className="canvas-toolbar"
            style={{
              padding: 8, borderRadius: 'var(--radius-md)',
              color: canvasToolMode === 'pointer' ? 'var(--primary)' : 'var(--text-secondary)',
              display: 'flex', alignItems: 'center',
              border: 'none',
              background: canvasToolMode === 'pointer' ? 'rgba(var(--primary-rgb), 0.1)' : 'none',
              cursor: 'pointer',
            }}
          >
            {canvasToolMode === 'pointer' ? <MousePointer size={16} /> : <Move size={16} />}
          </button>
          </Tooltip>
          <Tooltip title="重置视图"><button onClick={resetView} style={{ padding: 8, borderRadius: 'var(--radius-md)', color: 'var(--text-secondary)', display: 'flex', alignItems: 'center', background: 'none', border: 'none', cursor: 'pointer' }}><RefreshCw size={16} /></button></Tooltip>
        </div>
      </div>

      <div style={{
        position: 'absolute', bottom: 16, left: 16,
        fontSize: 12, color: 'var(--text-tertiary)',
        display: 'flex', alignItems: 'center', gap: 4, zIndex: 10,
      }}>
        {canvasToolMode === 'pointer' ? (
          <>
            <MousePointer size={12} />
            指针模式：点击选择 | 双击编辑 | Ctrl+滚轮缩放
          </>
        ) : (
          <>
            <Move size={12} />
            抓手模式：拖拽平移 | 拖动便签移动 | Ctrl+滚轮缩放
          </>
        )}
      </div>

      {contextMenu && (
        <div style={{
          position: 'fixed', left: contextMenu.x, top: contextMenu.y,
          zIndex: 1000, minWidth: 160, padding: '4px 0',
          borderRadius: 'var(--radius-md)',
          backgroundColor: 'var(--bg-secondary)',
          border: '1px solid var(--border-light)',
          boxShadow: 'var(--shadow-lg)',
        }}>
          <button onClick={() => startEditing(contextMenu.note)} style={{ width: '100%', display: 'flex', alignItems: 'center', gap: 10, padding: '8px 14px', border: 'none', background: 'none', cursor: 'pointer', fontSize: 13, color: 'var(--text-primary)', textAlign: 'left' }} onMouseEnter={(e) => { (e.currentTarget as HTMLElement).style.backgroundColor = 'var(--bg-hover)'; }} onMouseLeave={(e) => { (e.currentTarget as HTMLElement).style.backgroundColor = 'transparent'; }}><Edit3 size={14} color="var(--text-secondary)" />编辑</button>
          {contextMenu.note.type === 'creative-chain' && contextMenu.note.creativeChainId && (
            <button onClick={() => handleViewSnapshot(contextMenu.note)} style={{ width: '100%', display: 'flex', alignItems: 'center', gap: 10, padding: '8px 14px', border: 'none', background: 'none', cursor: 'pointer', fontSize: 13, color: 'var(--text-primary)', textAlign: 'left' }} onMouseEnter={(e) => { (e.currentTarget as HTMLElement).style.backgroundColor = 'var(--bg-hover)'; }} onMouseLeave={(e) => { (e.currentTarget as HTMLElement).style.backgroundColor = 'transparent'; }}><Eye size={14} color="var(--text-secondary)" />查看快照</button>
          )}
          <Popover
            trigger="click"
            placement="rightTop"
            content={
              <div style={{ display: 'flex', gap: 8 }}>
                {STICKY_COLORS.map((color) => (
                  <motion.button
                    key={color}
                    onClick={() => { handleColorChange(contextMenu.note.id, color); setContextMenu(null); }}
                    whileHover={{ scale: 1.2 }}
                    whileTap={{ scale: 0.9 }}
                    style={{
                      width: 28, height: 28, borderRadius: '50%',
                      backgroundColor: isDark ? getDarkColor(color) : color,
                      border: '2px solid var(--border-color)', cursor: 'pointer',
                    }}
                  />
                ))}
              </div>
            }
          >
            <button onClick={(e) => e.stopPropagation()} style={{ width: '100%', display: 'flex', alignItems: 'center', gap: 10, padding: '8px 14px', border: 'none', background: 'none', cursor: 'pointer', fontSize: 13, color: 'var(--text-primary)', textAlign: 'left' }} onMouseEnter={(e) => { (e.currentTarget as HTMLElement).style.backgroundColor = 'var(--bg-hover)'; }} onMouseLeave={(e) => { (e.currentTarget as HTMLElement).style.backgroundColor = 'transparent'; }}><Palette size={14} color="var(--text-secondary)" />更换颜色</button>
          </Popover>
          {contextMenu.note.sourceCreativityIds && contextMenu.note.sourceCreativityIds.length > 0 && (
            <button onClick={() => handleUnpack(contextMenu.note)} style={{ width: '100%', display: 'flex', alignItems: 'center', gap: 10, padding: '8px 14px', border: 'none', background: 'none', cursor: 'pointer', fontSize: 13, color: 'var(--text-primary)', textAlign: 'left' }} onMouseEnter={(e) => { (e.currentTarget as HTMLElement).style.backgroundColor = 'var(--bg-hover)'; }} onMouseLeave={(e) => { (e.currentTarget as HTMLElement).style.backgroundColor = 'transparent'; }}><PackageOpen size={14} color="var(--text-secondary)" />拆包</button>
          )}
          <div style={{ height: 1, backgroundColor: 'var(--border-light)', margin: '4px 0' }} />
          <button onClick={() => handleDelete(contextMenu.note.id)} style={{ width: '100%', display: 'flex', alignItems: 'center', gap: 10, padding: '8px 14px', border: 'none', background: 'none', cursor: 'pointer', fontSize: 13, color: '#ef4444', textAlign: 'left' }} onMouseEnter={(e) => { (e.currentTarget as HTMLElement).style.backgroundColor = 'rgba(239,68,68,0.08)'; }} onMouseLeave={(e) => { (e.currentTarget as HTMLElement).style.backgroundColor = 'transparent'; }}><Trash2 size={14} />删除</button>
        </div>
      )}

      {/* 动画样式 */}
      <style dangerouslySetInnerHTML={{ __html: `
        @keyframes pulse {
          0%, 100% { transform: scale(1); opacity: 1; }
          50% { transform: scale(1.15); opacity: 0.7; }
        }
      ` }} />

      {/* 创意链快照查看器 */}
      {snapshotViewer.open && snapshotViewer.creativeChain && (
        <CreativeChainSnapshotViewer
          open={snapshotViewer.open}
          onClose={() => setSnapshotViewer({ ...snapshotViewer, open: false })}
          snapshot={snapshotViewer.creativeChain.snapshot}
          title={snapshotViewer.creativeChain.name}
          description={snapshotViewer.creativeChain.description}
          creativityMap={snapshotViewer.creativityMap}
          boardId={boardId}
          creativeChainId={snapshotViewer.creativeChain.id}
        />
      )}
    </div>
  );
};

export default BoardView;
