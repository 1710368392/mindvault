import React, { useState, useEffect, useCallback, Component } from 'react';
import { useParams } from 'react-router-dom';
import { motion } from 'framer-motion';
import { useBoardStore } from '../stores/boardStore';
import { useCreativityStore } from '../stores/creativityStore';
import { useUIStore } from '../stores/uiStore';
import { api } from '../utils/api';
import BoardView from '../components/board/BoardView';
import CanvasView from '../components/board/CanvasView';
import FolderView from '../components/board/FolderView';
import OutlineView from '../components/board/OutlineView';
import ChatWritingView from '../components/board/ChatWritingView';
import CardPreview from '../components/card/CardPreview';
import CardEditor from '../components/card/CardEditor';
import CardContextMenu from '../components/card/CardContextMenu';
import type { Creativity } from '@shared/types';
import { Image as AntImage } from 'antd';
import { toMediaUrl, isPureMediaContent } from '../utils/media';

class CanvasErrorBoundary extends Component<{ children: React.ReactNode }, { hasError: boolean; error: Error | null }> {
  state = { hasError: false, error: null as Error | null };
  static getDerivedStateFromError(error: Error) {
    return { hasError: true, error };
  }
  componentDidCatch(error: Error, errorInfo: React.ErrorInfo) {
    console.error('[CanvasErrorBoundary] 画布渲染错误:', error, errorInfo);
  }
  render() {
    if (this.state.hasError) {
      return (
        <div style={{ padding: 40, textAlign: 'center', color: 'var(--text-secondary)' }}>
          <h3>画布加载失败</h3>
          <p style={{ fontSize: 13, color: 'var(--text-tertiary)', maxWidth: 500, margin: '8px auto', wordBreak: 'break-word' }}>
            {this.state.error?.message || '未知错误'}
          </p>
          {this.state.error?.stack && (
            <details style={{ marginTop: 12, textAlign: 'left', maxWidth: 600, margin: '12px auto' }}>
              <summary style={{ fontSize: 12, cursor: 'pointer', color: 'var(--text-tertiary)' }}>错误详情</summary>
              <pre style={{ fontSize: 11, color: 'var(--text-tertiary)', overflow: 'auto', maxHeight: 200, padding: 8, background: 'var(--bg-tertiary)', borderRadius: 6, marginTop: 4 }}>
                {this.state.error.stack}
              </pre>
            </details>
          )}
          <button onClick={() => this.setState({ hasError: false, error: null })} style={{ marginTop: 12, padding: '6px 16px', borderRadius: 6, border: '1px solid var(--border-color)', background: 'var(--bg-tertiary)', cursor: 'pointer' }}>
            重试
          </button>
        </div>
      );
    }
    return this.props.children;
  }
}

interface CanvasLocalItem {
  id: string;
  title: string;
  content: string;
  type: string;
  _canvasItemId: string;
  _isCanvasLocal: boolean;
}

const Board: React.FC = () => {
  const { id } = useParams<{ id: string }>();
  const currentBoard = useBoardStore((s) => s.currentBoard);
  const fetchBoard = useBoardStore((s) => s.fetchBoard);
  const viewMode = useBoardStore((s) => s.viewMode);
  const setViewMode = useBoardStore((s) => s.setViewMode);
  const fetchCanvasData = useBoardStore((s) => s.fetchCanvasData);
  const { creativities, fetchCreativities, isLoading, updateCreativity, deleteCreativity } = useCreativityStore();

  // 卡片交互状态
  const [selectedCard, setSelectedCard] = useState<Creativity | null>(null);
  const [isPreviewOpen, setIsPreviewOpen] = useState(false);
  const [directImagePreview, setDirectImagePreview] = useState<Creativity | null>(null);
  const [refreshKey, setRefreshKey] = useState(0);
  const [contextMenu, setContextMenu] = useState<{
    x: number;
    y: number;
    creativity: Creativity;
  } | null>(null);
  const [isDragOver, setIsDragOver] = useState(false);

  // 自定义拖拽状态
  const isDraggingItem = useUIStore((s) => s.isDraggingItem);
  const dragItem = useUIStore((s) => s.dragItem);
  const endDrag = useUIStore((s) => s.endDrag);
  const dragEnded = useUIStore((s) => s.dragEnded);

  useEffect(() => {
    if (id) {
      fetchBoard(id);
      fetchCanvasData(id);
    }
    fetchCreativities({ page: 1, pageSize: 50, boardId: id });
  }, [id, fetchBoard, fetchCanvasData, fetchCreativities]);

  const boardName = currentBoard?.name || '初号机';
  const boardDesc = currentBoard?.description;

  // 卡片点击 - 打开预览
  const handleCardClick = useCallback((creativity: Creativity | CanvasLocalItem) => {
    const c = creativity as Creativity;
    if (!c.isRead) {
      api.creativity.update(c.id, { isRead: true });
    }
    if (c.type === 'image' && isPureMediaContent(c.content)) {
      setDirectImagePreview(c);
    } else {
      setSelectedCard(c);
      setIsPreviewOpen(true);
    }
  }, []);

  // 卡片右键 - 直接进入编辑模式
  const handleContextEdit = useCallback((creativity: Creativity) => {
    setContextMenu(null);
    useUIStore.getState().openEditor(creativity);
  }, []);

  // 关闭预览
  const handleClosePreview = useCallback(() => {
    setIsPreviewOpen(false);
  }, []);

  // 保存编辑
  const handleSaveCreativity = useCallback(async (data: any) => {
    try {
      if (data._isCanvasLocal && data._canvasItemId) {
        const updateCanvasItemContent = useBoardStore.getState().updateCanvasItemContent;
        const updateData: any = {
          title: data.title,
          content: data.content,
          type: data.type,
        };
        if (data.subtype !== undefined) updateData.subtype = data.subtype;
        if (data.cardStyle !== undefined) updateData.cardStyle = data.cardStyle;
        if (data.priority !== undefined) updateData.priority = data.priority;
        if (data.emojiReaction !== undefined) updateData.emojiReaction = data.emojiReaction;
        if (data.contentFormat !== undefined) updateData.contentFormat = data.contentFormat;
        if (data.isFavorite !== undefined) updateData.isFavorite = data.isFavorite;
        await updateCanvasItemContent(data._canvasItemId, updateData);
        const updatedItem = useBoardStore.getState().canvasItems.find(i => i.id === data._canvasItemId);
        setSelectedCard((prev) => {
          if (!prev) return prev;
          if (updatedItem) {
            return {
              ...prev,
              title: updatedItem.title || '',
              content: updatedItem.content || '',
              type: updatedItem.type || 'text',
              subtype: (updatedItem as any).subtype,
              cardStyle: (updatedItem as any).cardStyle,
              priority: (updatedItem as any).priority,
              emojiReaction: (updatedItem as any).emojiReaction,
              contentFormat: (updatedItem as any).contentFormat,
              isFavorite: (updatedItem as any).isFavorite,
            };
          }
          return { ...prev, ...updateData };
        });
        return true;
      }
      const success = await updateCreativity(data.id, {
        title: data.title,
        content: data.content,
        type: data.type,
        subtype: data.subtype,
        contentFormat: data.contentFormat,
        wordCount: data.wordCount,
        priority: data.priority,
        emojiReaction: data.emojiReaction,
        tags: data.tags,
        cardStyle: data.cardStyle,
        isFavorite: data.isFavorite,
      });
      if (success) {
        const { creativities } = useCreativityStore.getState();
        const updated = creativities.find((c: any) => c.id === data.id);
        if (updated) {
          setSelectedCard(updated);
        } else {
          setSelectedCard((prev) => {
            if (!prev) return prev;
            return { ...prev, ...data };
          });
        }
      }
      return success;
    } catch (error) {
      console.error('保存失败:', error);
      return false;
    }
  }, [updateCreativity]);

  // 右键菜单
  const handleCardContextMenu = useCallback((e: React.MouseEvent, creativity: Creativity) => {
    e.preventDefault();
    e.stopPropagation();
    setContextMenu({ x: e.clientX, y: e.clientY, creativity });
  }, []);

  const handleCloseContextMenu = useCallback(() => {
    setContextMenu(null);
  }, []);



  const handleContextCopy = useCallback((creativity: Creativity) => {
    // 复制标题和内容到剪贴板
    const text = `${creativity.title}\n${creativity.content}`;
    navigator.clipboard.writeText(text).catch(() => {});
  }, []);

  const handleContextTrash = useCallback(async (creativity: Creativity) => {
    // 使用 api.creativity.delete 而不是 updateCreativity，确保数据进入回收站
    await api.creativity.delete(creativity.id, {
      boardId: id,
      boardName: currentBoard?.name
    });
    // 刷新创意列表
    fetchCreativities();
    setRefreshKey(k => k + 1);
  }, [id, currentBoard?.name, fetchCreativities]);

  const boardId = id || '';

  // 拖放处理 - 接收外部创意到看板
  const addCanvasItem = useBoardStore((s) => s.addCanvasItem);

  const handleBoardDragOver = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    e.dataTransfer.dropEffect = 'copy';
    setIsDragOver(true);
  }, []);

  const handleBoardDragLeave = useCallback((e: React.DragEvent) => {
    if (e.currentTarget === e.target) {
      setIsDragOver(false);
    }
  }, []);

  const handleBoardDrop = useCallback(async (e: React.DragEvent) => {
    e.preventDefault();
    setIsDragOver(false);
    try {
      const data = e.dataTransfer.getData('application/json');
      if (data) {
        const parsed = JSON.parse(data);
        if (parsed.id && boardId) {
          const { creativities } = useCreativityStore.getState();
          const full = creativities.find((c: any) => c.id === parsed.id);
          const c = full || parsed;
          const resolvedContent = c.mediaFilePath || c.content;
          await addCanvasItem(
            boardId, c.id, 100 + Math.random() * 300, 100 + Math.random() * 300,
            undefined, undefined,
            c.title || null, resolvedContent || null, c.type || null, false,
            c.subtype || null, c.cardStyle || null, c.priority || 0,
            c.emojiReaction || null, c.contentFormat || 'markdown'
          );
          await api.board.addCreativityRelation(boardId, parsed.id);
        }
      }
    } catch {
      // ignore
    }
  }, [boardId, addCanvasItem]);

  // 自定义拖拽：鼠标进入Board区域时显示拖放提示
  const handleBoardMouseEnter = useCallback(() => {
    if (isDraggingItem) setIsDragOver(true);
  }, [isDraggingItem]);

  const handleBoardMouseLeave = useCallback(() => {
    setIsDragOver(false);
  }, []);

  // 自定义拖拽：在Board区域松手时添加创意到画布
  const handleBoardMouseUp = useCallback(async (e: React.MouseEvent) => {
    if (!isDraggingItem || !dragItem || !boardId || dragEnded) return;
    e.stopPropagation();
    setIsDragOver(false);
    // canvas 视图模式下，完全交给 CanvasView 内部处理，避免重复添加
    if (viewMode === 'canvas') {
      return;
    }
    try {
      await api.board.addCreativityRelation(boardId, dragItem.id);
    } catch { /* ignore */ }
    endDrag();
    document.body.style.userSelect = '';
    document.body.style.cursor = '';
  }, [isDraggingItem, dragItem, boardId, viewMode, endDrag, dragEnded]);

  // 点击空白区域关闭右键菜单
  useEffect(() => {
    const handleClick = () => setContextMenu(null);
    if (contextMenu) {
      document.addEventListener('click', handleClick);
      return () => document.removeEventListener('click', handleClick);
    }
  }, [contextMenu]);



  const renderView = () => {
    switch (viewMode) {
      case 'board':
        return (
          <BoardView
            boardId={boardId}
            onStickyClick={(note: any) => {
              if (note.sourceCreativityIds && note.sourceCreativityIds.length > 0) {
                const c = creativities.find((cr: any) => cr.id === note.sourceCreativityIds[0]);
                if (c) {
                  setSelectedCard(c);
                  setIsPreviewOpen(true);
                }
              }
            }}
            onStickyContextMenu={(e: React.MouseEvent, note: any) => {}}
          />
        );
      case 'canvas':
        return (
          <CanvasErrorBoundary>
            <CanvasView
              boardId={boardId}
              onCardClick={handleCardClick}
              onCardContextMenu={handleCardContextMenu}
            />
          </CanvasErrorBoundary>
        );
      case 'folder':
        return (
          <FolderView
            boardId={boardId}
            refreshKey={refreshKey}
            onCardClick={handleCardClick}
            onCardContextMenu={handleCardContextMenu}
          />
        );
      case 'outline':
        return (
          <OutlineView
            boardId={boardId}
            onCardClick={handleCardClick}
            selectedId={selectedCard?.id}
          />
        );
      case 'chat':
        return (
          <ChatWritingView boardId={boardId} />
        );
      default:
        return (
          <BoardView
            boardId={boardId}
            onStickyClick={(note: any) => {
              if (note.sourceCreativityIds && note.sourceCreativityIds.length > 0) {
                const c = creativities.find((cr: any) => cr.id === note.sourceCreativityIds[0]);
                if (c) {
                  setSelectedCard(c);
                  setIsPreviewOpen(true);
                }
              }
            }}
            onStickyContextMenu={(e: React.MouseEvent, note: any) => {}}
          />
        );
    }
  };

  const showDragOverBorder = isDragOver && viewMode === 'canvas';

  return (
    <div style={{
      flex: 1,
      display: 'flex',
      flexDirection: 'column',
      overflow: 'hidden',
      minHeight: 0,
    }}>
      {/* 视图内容 - 用 position: relative 包裹，子组件用 absolute 填满 */}
      <div
        onDragOver={handleBoardDragOver}
        onDragLeave={handleBoardDragLeave}
        onDrop={handleBoardDrop}
        onMouseEnter={handleBoardMouseEnter}
        onMouseLeave={handleBoardMouseLeave}
        onMouseUp={handleBoardMouseUp}
        style={{
        flex: 1,
        position: 'relative',
        minHeight: 0,
        overflow: 'hidden',
        border: showDragOverBorder ? '2px dashed var(--primary-color)' : '2px solid transparent',
        borderRadius: showDragOverBorder ? 'var(--radius-lg)' : 0,
        backgroundColor: showDragOverBorder ? 'rgba(108, 99, 255, 0.04)' : 'transparent',
        transition: 'all 0.2s ease',
      }}>
        {renderView()}
      </div>

      {/* 卡片预览弹窗 */}
      {selectedCard && (
        <CardPreview
          creativity={selectedCard}
          isOpen={isPreviewOpen}
          onClose={handleClosePreview}
          onSave={handleSaveCreativity}
          onDelete={() => { fetchCreativities(); setRefreshKey(k => k + 1); }}
          onEdit={() => {
            setIsPreviewOpen(false);
            useUIStore.getState().openEditor(selectedCard);
          }}
        />
      )}

      {directImagePreview && (
        <AntImage
          style={{ display: 'none' }}
          src={toMediaUrl(directImagePreview.mediaFilePath || directImagePreview.content)}
          preview={{
            visible: true,
            zIndex: 60,
            onVisibleChange: (visible: boolean) => { if (!visible) setDirectImagePreview(null); },
          }}
        />
      )}

      {/* 右键菜单 */}
      {contextMenu && (
        <CardContextMenu
          x={contextMenu.x}
          y={contextMenu.y}
          creativity={contextMenu.creativity}
          isOpen={!!contextMenu}
          onClose={handleCloseContextMenu}
          onEdit={handleContextEdit}
          onCopy={handleContextCopy}
          onTrash={handleContextTrash}
        />
      )}
    </div>
  );
};

export default Board;
