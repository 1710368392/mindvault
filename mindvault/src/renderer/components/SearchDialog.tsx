import React, { useState, useEffect, useRef, useCallback } from 'react';
import { createPortal } from 'react-dom';
import { motion, AnimatePresence } from 'framer-motion';
import { Search, X, Type, Image, Mic, Link, Video, FileText, ArrowRight, Trash2, Send, Play, Package, Pencil, Bookmark, MessageSquare, Sparkles, Wand2, Tags, Languages } from 'lucide-react';
import { api } from '../utils/api';
import { toMediaUrl, toThumbnailUrl, isPureMediaContent, getFileNameFromPath } from '../utils/media';
import { Skeleton, Image as AntImage, Empty, Menu } from 'antd';
import { formatRelativeTime } from '../utils/formatters';
import { useUIStore } from '../stores/uiStore';
import { useBoardStore } from '../stores/boardStore';
import { useVideoThumbnail } from '../hooks/useVideoThumbnail';
import CardPreview from './card/CardPreview';
import CardEditor from './card/CardEditor';
import FavoriteBadge from './common/FavoriteBadge';
import type { Creativity } from '@shared/types';

const SearchIcon: React.FC<{ size?: number; style?: React.CSSProperties }> = ({ size = 18, style }) => (
  <svg
    xmlns="http://www.w3.org/2000/svg"
    width={size}
    height={size}
    viewBox="0 0 24 24"
    style={style}
  >
    <g stroke="var(--text-tertiary)" stroke-linecap="round" stroke-linejoin="round" stroke-width="2">
      <path fill="var(--text-tertiary)" fill-opacity="0" stroke-dasharray="40" d="M10.76 13.24c-2.34 -2.34 -2.34 -6.14 0 -8.49c2.34 -2.34 6.14 -2.34 8.49 0c2.34 2.34 2.34 6.14 0 8.49c-2.34 2.34 -6.14 2.34 -8.49 0Z">
        <animate fill="freeze" attributeName="stroke-dashoffset" dur="0.5s" values="40;0"/>
        <animate fill="freeze" attributeName="fill-opacity" begin="0.7s" dur="0.15s" to=".3"/>
      </path>
      <path fill="none" stroke-dasharray="14" stroke-dashoffset="14" d="M10.5 13.5l-7.5 7.5">
        <animate fill="freeze" attributeName="stroke-dashoffset" begin="0.5s" dur="0.2s" to="0"/>
      </path>
    </g>
  </svg>
);

interface SearchDialogProps {
  onClose: () => void;
  onSelect?: (item: Creativity) => void;
}

/** 关键词高亮工具函数（复用 Search.tsx 逻辑） */
function highlightText(text: string, keyword: string): React.ReactNode {
  if (!keyword || !text) return text;
  const escaped = keyword.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
  const regex = new RegExp(`(${escaped})`, 'gi');
  const parts = text.split(regex);
  if (parts.length <= 1) return text;
  return parts.map((part, i) =>
    regex.test(part) ? (
      <span key={i} style={{ backgroundColor: 'var(--primary-bg)', color: 'var(--primary-color)', borderRadius: 2, padding: '0 1px' }}>
        {part}
      </span>
    ) : (
      part
    )
  );
}

/** 类型图标映射 */
const typeIcons: Record<string, React.FC<{ size?: number; color?: string }>> = {
  text: Type,
  image: Image,
  audio: Mic,
  link: Link,
  video: Video,
  document: FileText,
  other: Package,
};

const typeGradients: Record<string, string> = {
  text: 'linear-gradient(135deg, #667eea 0%, #764ba2 100%)',
  image: 'linear-gradient(135deg, #f093fb 0%, #f5576c 100%)',
  audio: 'linear-gradient(135deg, #4facfe 0%, #00f2fe 100%)',
  link: 'linear-gradient(135deg, #43e97b 0%, #38f9d7 100%)',
  video: 'linear-gradient(135deg, #fa709a 0%, #fee140 100%)',
  document: 'linear-gradient(135deg, #a18cd1 0%, #fbc2eb 100%)',
  other: 'linear-gradient(135deg, #94a3b8 0%, #64748b 100%)',
};

const SearchResultCover: React.FC<{
  item: Creativity;
  isSelected: boolean;
}> = ({ item, isSelected }) => {
  const [imgError, setImgError] = useState(false);
  const [base64Thumb, setBase64Thumb] = useState<string | null>(null);
  const [loadingBase64, setLoadingBase64] = useState(false);
  
  const videoThumbUrl = useVideoThumbnail(item.type, item.mediaFilePath || item.content);
  const filePath = item.mediaFilePath || item.content;

  const TypeIcon = typeIcons[item.type] || FileText;
  const iconColor = isSelected ? 'var(--primary-color)' : 'var(--text-secondary)';
  const size = 40;
  const borderRadius = 'var(--radius-sm)';

  // 对于图片类型，直接尝试用 base64 方式读取，这样最可靠
  useEffect(() => {
    if (item.type !== 'image') return;
    if (!filePath) return;
    
    const isLocalPath = /^[A-Za-z]:\\/.test(filePath) || filePath.startsWith('/') || filePath.startsWith('.\\') || filePath.startsWith('media://');
    if (isLocalPath && !loadingBase64 && !base64Thumb) {
      setLoadingBase64(true);
      api.media.readFileAsBase64(filePath).then((result) => {
        if (result && result.data) {
          setBase64Thumb(result.data);
        }
      }).catch(() => {
        // 如果 base64 读取失败，尝试用原来的方式
        setImgError(true);
      }).finally(() => {
        setLoadingBase64(false);
      });
    }
  }, [item.type, filePath, loadingBase64, base64Thumb]);

  if (item.type === 'image') {
    // 小尺寸显示优先使用缩略图，节省带宽和内存
    if (!imgError) {
      const thumbSrc = toThumbnailUrl(filePath) || toMediaUrl(filePath);
      return (
        <div style={{
          width: size, height: size, borderRadius, overflow: 'hidden', flexShrink: 0,
          border: isSelected ? '1.5px solid var(--primary-color)' : '1px solid var(--border-light)',
        }}>
          <img
            src={thumbSrc}
            alt=""
            draggable={false}
            onError={() => setImgError(true)}
            style={{ width: '100%', height: '100%', objectFit: 'cover' }}
          />
        </div>
      );
    }
  }

  if (item.type === 'video') {
    return (
      <div style={{
        width: size, height: size, borderRadius, overflow: 'hidden', flexShrink: 0,
        background: videoThumbUrl ? '#000' : (typeGradients.video),
        border: isSelected ? '1.5px solid var(--primary-color)' : '1px solid var(--border-light)',
        display: 'flex', alignItems: 'center', justifyContent: 'center',
        position: 'relative',
      }}>
        {videoThumbUrl && (
          <img
            src={videoThumbUrl}
            alt=""
            draggable={false}
            style={{ width: '100%', height: '100%', objectFit: 'cover', position: 'absolute', top: 0, left: 0 }}
          />
        )}
        <div style={{
          width: 20, height: 20, borderRadius: '50%',
          background: 'rgba(0,0,0,0.4)', backdropFilter: 'blur(2px)',
          display: 'flex', alignItems: 'center', justifyContent: 'center',
          position: 'relative', zIndex: 1,
        }}>
          <Play size={10} style={{ color: 'white', marginLeft: 1 }} />
        </div>
      </div>
    );
  }

  if (item.type === 'audio') {
    return (
      <div style={{
        width: size, height: size, borderRadius, flexShrink: 0,
        background: typeGradients.audio,
        display: 'flex', alignItems: 'center', justifyContent: 'center',
        border: isSelected ? '1.5px solid var(--primary-color)' : '1px solid var(--border-light)',
      }}>
        <TypeIcon size={16} color="rgba(255,255,255,0.85)" />
      </div>
    );
  }

  if (item.type === 'document') {
    return (
      <div style={{
        width: size, height: size, borderRadius, flexShrink: 0,
        background: typeGradients.document,
        display: 'flex', alignItems: 'center', justifyContent: 'center',
        border: isSelected ? '1.5px solid var(--primary-color)' : '1px solid var(--border-light)',
      }}>
        <TypeIcon size={16} color="rgba(255,255,255,0.85)" />
      </div>
    );
  }

  return (
    <div style={{
      width: size, height: size, borderRadius,
      background: isSelected ? 'rgba(108, 99, 255, 0.12)' : 'var(--bg-tertiary)',
      display: 'flex', alignItems: 'center', justifyContent: 'center',
      flexShrink: 0,
      borderTop: '1px solid rgba(0,0,0,0.1)',
      borderLeft: '1px solid rgba(0,0,0,0.1)',
      borderRight: '1px solid rgba(255,255,255,0.04)',
      borderBottom: '1px solid rgba(255,255,255,0.04)',
      boxShadow: 'inset 0 2px 4px rgba(0,0,0,0.1), inset 0 1px 2px rgba(0,0,0,0.06)',
    }}>
      <TypeIcon size={18} color={iconColor} />
    </div>
  );
};

const SearchDialog: React.FC<SearchDialogProps> = ({ onClose }) => {
  const [keyword, setKeyword] = useState('');
  const [results, setResults] = useState<Creativity[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [selectedIndex, setSelectedIndex] = useState(0);
  const [hasSearched, setHasSearched] = useState(false);
  const [listReady, setListReady] = useState(false);
  const [previewItem, setPreviewItem] = useState<Creativity | null>(null);
  const [previewOpen, setPreviewOpen] = useState(false);
  const [directImagePreview, setDirectImagePreview] = useState<Creativity | null>(null);
  const [bubbleMenu, setBubbleMenu] = useState<{ x: number; y: number; item: Creativity } | null>(null);
  
  // 右键菜单状态
  const [contextMenu, setContextMenu] = useState<{ x: number; y: number; item: Creativity } | null>(null);
  const contextMenuRef = useRef<HTMLDivElement>(null);

  const boards = useBoardStore((s) => s.boards);

  const inputRef = useRef<HTMLInputElement>(null);
  const listRef = useRef<HTMLDivElement>(null);
  const debounceTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const justDraggedRef = useRef(false);
  const bubbleMenuRef = useRef<HTMLDivElement>(null);

  // 点击外部关闭右键菜单
  useEffect(() => {
    const handleClickOutside = (e: MouseEvent) => {
      const target = e.target as HTMLElement;
      if (target.closest?.('.ant-menu')) return;
      if (contextMenuRef.current && !contextMenuRef.current.contains(e.target as Node)) {
        setContextMenu(null);
      }
      if (bubbleMenuRef.current && !bubbleMenuRef.current.contains(e.target as Node)) {
        setBubbleMenu(null);
      }
    };
    if (contextMenu || bubbleMenu) {
      document.addEventListener('mousedown', handleClickOutside);
      return () => document.removeEventListener('mousedown', handleClickOutside);
    }
  }, [contextMenu, bubbleMenu]);

  const handleSendToBoard = useCallback(async (boardId: string) => {
    if (!bubbleMenu) return;
    const item = bubbleMenu.item;
    try {
      await api.board.canvas.addItem(boardId, item.id, 100 + Math.random() * 300, 100 + Math.random() * 300, undefined, undefined, null, null, null, true);
      await api.board.addCreativityRelation(boardId, item.id);
      useUIStore.getState().showToast('success', '已发送至画布');
    } catch {
      useUIStore.getState().showToast('error', '发送失败');
    }
    setBubbleMenu(null);
  }, [bubbleMenu]);

  const handlePreview = useCallback((item: Creativity) => {
    if (!item.isRead) {
      api.creativity.update(item.id, { isRead: true });
    }
    if (item.type === 'image' && isPureMediaContent(item.content)) {
      setDirectImagePreview(item);
    } else {
      setPreviewItem(item);
      setPreviewOpen(true);
    }
  }, []);

  const handleContextAction = useCallback((key: string) => {
    if (!contextMenu) return;
    const item = contextMenu.item;

    if (key === 'edit') {
      setPreviewOpen(false);
      useUIStore.getState().openEditor(item);
    } else if (key === 'favorite') {
      api.creativity.update(item.id, { isFavorite: !item.isFavorite }).then(() => {
        setResults(prev => prev.map(r => r.id === item.id ? { ...r, isFavorite: !r.isFavorite } : r));
        useUIStore.getState().showToast('success', item.isFavorite ? '已取消收藏' : '已收藏');
      });
    } else if (key === 'trash') {
      api.creativity.update(item.id, { status: 'deleted' }).then(() => {
        setResults(prev => prev.filter(r => r.id !== item.id));
        useUIStore.getState().showToast('success', '已移到回收站');
      });
    } else if (key.startsWith('board-')) {
      const boardId = key.replace('board-', '');
      api.board.canvas.addItem(boardId, item.id, 100 + Math.random() * 300, 100 + Math.random() * 300, undefined, undefined, null, null, null, true).then(() => {
        return api.board.addCreativityRelation(boardId, item.id);
      }).then(() => {
        return useBoardStore.getState().fetchBoards();
      }).then(() => {
        useUIStore.getState().showToast('success', '已发送至画布');
      }).catch(() => {
        useUIStore.getState().showToast('error', '发送失败');
      });
    } else if (key === 'ai-chat') {
      // 发送给 AI 讨论
      useUIStore.getState().setAIChatOpen(true);
      // 将创意内容发送到 AI 聊天
      setTimeout(() => {
        const event = new CustomEvent('ai-chat-send-message', { 
          detail: { 
            content: `我想讨论这个创意：\n\n标题：${item.title}\n内容：${item.content}`,
            creativityId: item.id 
          } 
        });
        window.dispatchEvent(event);
      }, 300);
      onClose();
    } else if (key === 'ai-continue') {
      // AI 续写
      useUIStore.getState().setAIChatOpen(true);
      setTimeout(() => {
        const event = new CustomEvent('ai-chat-send-message', { 
          detail: { 
            content: `请帮我续写这个创意：\n\n标题：${item.title}\n内容：${item.content}\n\n请基于以上内容进行续写。`,
            creativityId: item.id 
          } 
        });
        window.dispatchEvent(event);
      }, 300);
      onClose();
    } else if (key === 'ai-polish') {
      // AI 润色改写
      useUIStore.getState().setAIChatOpen(true);
      setTimeout(() => {
        const event = new CustomEvent('ai-chat-send-message', { 
          detail: { 
            content: `请帮我润色改写这个创意：\n\n标题：${item.title}\n内容：${item.content}\n\n请保持原意，但让表达更加流畅、生动。`,
            creativityId: item.id 
          } 
        });
        window.dispatchEvent(event);
      }, 300);
      onClose();
    } else if (key === 'ai-tags') {
      // AI 生成标签
      useUIStore.getState().setAIChatOpen(true);
      setTimeout(() => {
        const event = new CustomEvent('ai-chat-send-message', { 
          detail: { 
            content: `请为这个创意生成合适的标签：\n\n标题：${item.title}\n内容：${item.content}\n\n请生成 3-5 个标签，用逗号分隔。`,
            creativityId: item.id 
          } 
        });
        window.dispatchEvent(event);
      }, 300);
      onClose();
    } else if (key === 'ai-translate') {
      // AI 翻译
      useUIStore.getState().setAIChatOpen(true);
      setTimeout(() => {
        const event = new CustomEvent('ai-chat-send-message', { 
          detail: { 
            content: `请翻译这个创意为英文：\n\n标题：${item.title}\n内容：${item.content}`,
            creativityId: item.id 
          } 
        });
        window.dispatchEvent(event);
      }, 300);
      onClose();
    }
    setContextMenu(null);
  }, [contextMenu, onClose]);

  // 加载全部创意
  const loadAll = useCallback(async () => {
    setListReady(false);
    setIsLoading(true);
    try {
      const data = await api.creativity.list();
      setResults((data as { data: Creativity[] }).data || []);
      setSelectedIndex(0);
    } catch {
      setResults([]);
    } finally {
      setIsLoading(false);
      setListReady(true);
    }
  }, []);

  // 自动聚焦 + 初始加载全部
  useEffect(() => {
    // 延迟聚焦以确保动画完成
    const timer = setTimeout(() => {
      inputRef.current?.focus();
    }, 100);
    loadAll();
    return () => clearTimeout(timer);
  }, [loadAll]);

  // ESC 关闭
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        e.preventDefault();
        onClose();
      }
    };
    document.addEventListener('keydown', handleKeyDown);
    return () => document.removeEventListener('keydown', handleKeyDown);
  }, [onClose]);

  // 搜索函数
  const doSearch = useCallback(async (kw: string) => {
    if (!kw.trim()) {
      loadAll();
      return;
    }
    setListReady(false);
    setIsLoading(true);
    setHasSearched(true);
    try {
      const data = await api.creativity.search(kw);
      setResults((data as Creativity[]) || []);
      setSelectedIndex(0);
    } catch {
      setResults([]);
    } finally {
      setIsLoading(false);
      setListReady(true);
    }
  }, [loadAll]);

  // 输入变化时防抖搜索
  useEffect(() => {
    if (debounceTimerRef.current) {
      clearTimeout(debounceTimerRef.current);
    }
    debounceTimerRef.current = setTimeout(() => {
      doSearch(keyword);
    }, 300);
    return () => {
      if (debounceTimerRef.current) {
        clearTimeout(debounceTimerRef.current);
      }
    };
  }, [keyword, doSearch]);

  // 键盘导航
  const handleKeyDown = useCallback((e: React.KeyboardEvent) => {
    if (e.key === 'ArrowDown') {
      e.preventDefault();
      setSelectedIndex((prev) => Math.min(prev + 1, results.length - 1));
    } else if (e.key === 'ArrowUp') {
      e.preventDefault();
      setSelectedIndex((prev) => Math.max(prev - 1, 0));
    } else if (e.key === 'Enter' && results.length > 0 && selectedIndex >= 0) {
      e.preventDefault();
      handlePreview(results[selectedIndex]);
    }
  }, [results, selectedIndex, handlePreview]);

  // 滚动选中项到可见区域
  useEffect(() => {
    if (listRef.current) {
      const selectedEl = listRef.current.querySelector(`[data-index="${selectedIndex}"]`);
      if (selectedEl) {
        selectedEl.scrollIntoView({ block: 'nearest' });
      }
    }
  }, [selectedIndex]);


  return (
    <motion.div
      data-search-dialog
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0 }}
      transition={{ duration: 0.2 }}
      onClick={onClose}
      style={{
        position: 'fixed',
        inset: 0,
        zIndex: 999,
        display: 'flex',
        alignItems: 'flex-start',
        justifyContent: 'center',
        paddingTop: '15vh',
        backgroundColor: 'rgba(0, 0, 0, 0.3)',
        backdropFilter: 'blur(8px)',
        WebkitBackdropFilter: 'blur(8px)',
      }}
    >
      <motion.div
        initial={{ opacity: 0, scale: 0.95, y: -10 }}
        animate={{ opacity: 1, scale: 1, y: 0 }}
        exit={{ opacity: 0, scale: 0.95, y: -10 }}
        transition={{ duration: 0.25, ease: [0.19, 1, 0.22, 1] }}
        onClick={(e) => e.stopPropagation()}
        style={{
          width: 640,
          maxWidth: '90vw',
          maxHeight: '70vh',
          backgroundColor: 'var(--bg-secondary)',
          borderRadius: 'var(--radius-xl)',
          boxShadow: 'var(--shadow-xl)',
          overflow: 'hidden',
          display: 'flex',
          flexDirection: 'column',
        }}
      >
        {/* 搜索输入框 */}
        <div style={{
          display: 'flex',
          alignItems: 'center',
          gap: 12,
          padding: '16px 20px',
          borderBottom: '1px solid var(--border-light)',
          flexShrink: 0,
        }}>
          <motion.div
            whileHover={{ y: 2, scale: 0.92 }}
            whileTap={{ y: 3, scale: 0.88 }}
            transition={{ type: 'spring', stiffness: 500, damping: 15, mass: 0.3 }}
          >
            <SearchIcon size={20} style={{ flexShrink: 0 }} />
          </motion.div>
          <input
            ref={inputRef}
            type="text"
            value={keyword}
            onChange={(e) => setKeyword(e.target.value)}
            onKeyDown={handleKeyDown}
            placeholder="搜索创意、标签、内容..."
            style={{
              flex: 1,
              border: 'none',
              background: 'none',
              fontSize: 15,
              color: 'var(--text-primary)',
              outline: 'none',
            }}
          />
          {keyword && (
            <button
              onClick={() => setKeyword('')}
              style={{
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                width: 28,
                height: 28,
                borderRadius: 'var(--radius-full)',
                background: 'var(--bg-tertiary)',
                color: 'var(--text-secondary)',
                cursor: 'pointer',
                border: 'none',
                flexShrink: 0,
              }}
            >
              <X size={14} />
            </button>
          )}
          <motion.kbd
            onClick={onClose}
            whileHover={{ y: 2, scale: 0.95, borderBottomWidth: '1px' }}
            whileTap={{ y: 3, scale: 0.9 }}
            transition={{ type: 'spring', stiffness: 500, damping: 15, mass: 0.3 }}
            style={{
            padding: '2px 8px',
            borderRadius: 4,
            backgroundColor: 'var(--bg-secondary)',
            color: 'var(--text-tertiary)',
            fontSize: 11,
            fontWeight: 600,
            fontFamily: 'monospace',
            flexShrink: 0,
            borderTop: '1px solid rgba(255,255,255,0.15)',
            borderLeft: '1px solid rgba(255,255,255,0.1)',
            borderRight: '1px solid rgba(0,0,0,0.08)',
            borderBottom: '2px solid rgba(0,0,0,0.12)',
            boxShadow: '0 2px 0 rgba(0,0,0,0.08), inset 0 1px 0 rgba(255,255,255,0.1)',
            display: 'inline-block',
            cursor: 'pointer',
          }}>
            ESC
          </motion.kbd>
        </div>

        {/* 搜索结果列表 */}
        <AnimatePresence>
        {listReady && (
          <motion.div
            ref={listRef}
            initial={{ height: 0, opacity: 0 }}
            animate={{ height: 'auto', opacity: 1 }}
            exit={{ height: 0, opacity: 0 }}
            transition={{ duration: 0.3, ease: [0.25, 0.46, 0.45, 0.94] }}
            style={{
              flex: 1,
              overflow: 'auto',
              padding: '8px 8px',
              backgroundColor: 'rgba(0,0,0,0.03)',
              borderTop: '1px solid rgba(0,0,0,0.1)',
              borderLeft: '1px solid rgba(0,0,0,0.1)',
              borderRight: '1px solid rgba(255,255,255,0.04)',
              borderBottom: '1px solid rgba(255,255,255,0.04)',
              boxShadow: 'inset 0 2px 4px rgba(0,0,0,0.1), inset 0 1px 2px rgba(0,0,0,0.06)',
            }}
          >
          {isLoading ? (
            <div style={{ display: 'flex', flexDirection: 'column', gap: 6, padding: '8px 12px' }}>
              {Array.from({ length: 4 }).map((_, i) => (
                <Skeleton key={i} active avatar paragraph={{ rows: 1 }} title={{ width: '50%' }} />
              ))}
            </div>
          ) : results.length > 0 ? (
            <div style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
              {results.map((item, index) => {
                const isSelected = index === selectedIndex;
                return (
                  <motion.div
                    key={item.id}
                    data-index={index}
                    data-creativity-id={item.id}
                    onClick={() => {
                      if (justDraggedRef.current) {
                        justDraggedRef.current = false;
                        return;
                      }
                      handlePreview(item);
                    }}
                    onMouseEnter={() => setSelectedIndex(index)}
                    onContextMenu={(e) => {
                      e.preventDefault();
                      e.stopPropagation();
                      setContextMenu({ x: e.clientX, y: e.clientY, item });
                    }}
                    onMouseDown={(e) => {
                      if (e.button !== 0) return;
                      const startX = e.clientX;
                      const startY = e.clientY;
                      let dragged = false;
                      const handleMouseMove = (me: MouseEvent) => {
                        const dx = me.clientX - startX;
                        const dy = me.clientY - startY;
                        if (!dragged && (Math.abs(dx) > 4 || Math.abs(dy) > 4)) {
                          dragged = true;
                          justDraggedRef.current = true;
                          useUIStore.getState().startDrag(
                            { id: item.id, title: item.title, type: item.type },
                            { x: me.clientX, y: me.clientY }
                          );
                          document.body.style.userSelect = 'none';
                          document.body.style.cursor = 'grabbing';
                          onClose();
                        }
                        if (dragged) {
                          useUIStore.getState().updateDragPosition({ x: me.clientX, y: me.clientY });
                        }
                      };
                      const handleMouseUp = () => {
                        document.removeEventListener('mousemove', handleMouseMove);
                        document.removeEventListener('mouseup', handleMouseUp);
                        if (dragged) {
                          useUIStore.getState().endDrag();
                          setTimeout(() => { justDraggedRef.current = false; }, 50);
                        }
                        document.body.style.userSelect = '';
                        document.body.style.cursor = '';
                      };
                      document.addEventListener('mousemove', handleMouseMove);
                      document.addEventListener('mouseup', handleMouseUp);
                    }}
                    whileHover={{ x: 6, transition: { type: 'spring', stiffness: 300, damping: 20 } }}
                    whileTap={{ x: 0, transition: { duration: 0.15 } }}
                    style={{
                      display: 'flex',
                      alignItems: 'center',
                      gap: 14,
                      padding: '12px 14px',
                      borderRadius: 'var(--radius-md)',
                      cursor: 'grab',
                      backgroundColor: isSelected ? 'var(--primary-bg)' : 'var(--bg-secondary)',
                      transition: 'background-color 0.1s ease',
                      borderTop: '1px solid rgba(255,255,255,0.15)',
                      borderLeft: '1px solid rgba(255,255,255,0.1)',
                      borderRight: '1px solid rgba(0,0,0,0.08)',
                      borderBottom: '2px solid rgba(0,0,0,0.12)',
                      boxShadow: '0 2px 0 rgba(0,0,0,0.08), inset 0 1px 0 rgba(255,255,255,0.1)',
                    }}
                  >
                    {/* 封面 */}
                    <SearchResultCover item={item} isSelected={isSelected} />

                    {/* 标题和摘要 */}
                    <div style={{ flex: 1, minWidth: 0 }}>
                      <div style={{
                        fontSize: 14,
                        fontWeight: 500,
                        color: 'var(--text-primary)',
                        marginBottom: 3,
                        overflow: 'hidden',
                        textOverflow: 'ellipsis',
                        whiteSpace: 'nowrap',
                      }}>
                        {highlightText(item.title, keyword)}
                      </div>
                      <div style={{
                        fontSize: 13,
                        color: 'var(--text-secondary)',
                        overflow: 'hidden',
                        textOverflow: 'ellipsis',
                        whiteSpace: 'nowrap',
                      }}>
                        {highlightText(item.content, keyword)}
                      </div>
                    </div>

                    {/* 时间 */}
                    <div style={{
                      display: 'flex',
                      alignItems: 'center',
                      gap: 8,
                      flexShrink: 0,
                    }}>
                      <span style={{
                        fontSize: 12,
                        color: 'var(--text-tertiary)',
                        whiteSpace: 'nowrap',
                      }}>
                        {formatRelativeTime(item.updatedAt)}
                      </span>
                      {isSelected && (
                        <motion.div
                          initial={{ x: -12, opacity: 0 }}
                          animate={{ x: 0, opacity: 1 }}
                          transition={{ type: 'spring', stiffness: 400, damping: 18 }}
                          whileHover={{
                            x: [0, 4, 0, 4, 0],
                            transition: { duration: 0.4, ease: 'easeOut' },
                          }}
                          style={{ display: 'inline-flex' }}
                        >
                          <ArrowRight size={14} color="var(--primary-color)" />
                        </motion.div>
                      )}
                    </div>
                  </motion.div>
                );
              })}
            </div>
          ) : hasSearched && keyword.trim() ? (
            /* 空状态 */
            <Empty
              image={<div style={{ width: 56, height: 56, borderRadius: 'var(--radius-lg)', backgroundColor: 'var(--bg-tertiary)', display: 'flex', alignItems: 'center', justifyContent: 'center' }}><SearchIcon size={24} /></div>}
              description={<><span style={{ fontSize: 14, fontWeight: 500, color: 'var(--text-primary)' }}>未找到相关创意</span><br/><span style={{ fontSize: 13, color: 'var(--text-tertiary)' }}>试试其他关键词</span></>}
            />
          ) : (
            /* 初始状态，没有搜索但加载全部 */
            !keyword.trim() ? (
              /* 全部创意已加载（已有loadAll()调用了） */
              <></>
            ) : (
              /* 无结果提示 */
              <div style={{
                display: 'flex',
                flexDirection: 'column',
                alignItems: 'center',
                justifyContent: 'center',
                padding: '48px 24px',
                color: 'var(--text-tertiary)',
              }}>
                <div style={{
                  width: 56,
                  height: 56,
                  borderRadius: 'var(--radius-lg)',
                  backgroundColor: 'var(--bg-tertiary)',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  marginBottom: 14,
                }}>
                  <SearchIcon size={24} />
                </div>
                <p style={{ fontSize: 13 }}>输入关键词开始搜索</p>
              </div>
            )
          )}
        </motion.div>
        )}
        </AnimatePresence>

        {/* 底部提示 */}
        {results.length > 0 && (
          <div style={{
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
            padding: '10px 20px',
            borderTop: '1px solid var(--border-light)',
            flexShrink: 0,
          }}>
            <span style={{ fontSize: 12, color: 'var(--text-tertiary)' }}>
              共 {results.length} 条结果
            </span>
            <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
              <span style={{ fontSize: 12, color: 'var(--text-tertiary)', display: 'flex', alignItems: 'center', gap: 4 }}>
                <motion.kbd
                  whileHover={{ y: 2, scale: 0.95, borderBottomWidth: '1px' }}
                  whileTap={{ y: 3, scale: 0.9 }}
                  transition={{ type: 'spring', stiffness: 500, damping: 15, mass: 0.3 }}
                  style={{
                  padding: '1px 5px',
                  borderRadius: 4,
                  backgroundColor: 'var(--bg-secondary)',
                  color: 'var(--text-tertiary)',
                  fontSize: 10,
                  fontWeight: 600,
                  fontFamily: 'monospace',
                  borderTop: '1px solid rgba(255,255,255,0.15)',
                  borderLeft: '1px solid rgba(255,255,255,0.1)',
                  borderRight: '1px solid rgba(0,0,0,0.08)',
                  borderBottom: '2px solid rgba(0,0,0,0.12)',
                  boxShadow: '0 2px 0 rgba(0,0,0,0.08), inset 0 1px 0 rgba(255,255,255,0.1)',
                  display: 'inline-block',
                }}>
                  <span>&uarr;</span><span>&darr;</span>
                </motion.kbd>
                导航
              </span>
              <span style={{ fontSize: 12, color: 'var(--text-tertiary)', display: 'flex', alignItems: 'center', gap: 4 }}>
                <motion.kbd
                  whileHover={{ y: 2, scale: 0.95, borderBottomWidth: '1px' }}
                  whileTap={{ y: 3, scale: 0.9 }}
                  transition={{ type: 'spring', stiffness: 500, damping: 15, mass: 0.3 }}
                  style={{
                  padding: '1px 5px',
                  borderRadius: 4,
                  backgroundColor: 'var(--bg-secondary)',
                  color: 'var(--text-tertiary)',
                  fontSize: 10,
                  fontWeight: 600,
                  fontFamily: 'monospace',
                  borderTop: '1px solid rgba(255,255,255,0.15)',
                  borderLeft: '1px solid rgba(255,255,255,0.1)',
                  borderRight: '1px solid rgba(0,0,0,0.08)',
                  borderBottom: '2px solid rgba(0,0,0,0.12)',
                  boxShadow: '0 2px 0 rgba(0,0,0,0.08), inset 0 1px 0 rgba(255,255,255,0.1)',
                  display: 'inline-block',
                }}>
                  Enter
                </motion.kbd>
                打开
              </span>
              <span style={{ fontSize: 12, color: 'var(--text-tertiary)', display: 'flex', alignItems: 'center', gap: 4 }}>
                <motion.kbd
                  onClick={onClose}
                  whileHover={{ y: 2, scale: 0.95, borderBottomWidth: '1px' }}
                  whileTap={{ y: 3, scale: 0.9 }}
                  transition={{ type: 'spring', stiffness: 500, damping: 15, mass: 0.3 }}
                  style={{
                  padding: '1px 5px',
                  borderRadius: 4,
                  backgroundColor: 'var(--bg-secondary)',
                  color: 'var(--text-tertiary)',
                  fontSize: 10,
                  fontWeight: 600,
                  fontFamily: 'monospace',
                  borderTop: '1px solid rgba(255,255,255,0.15)',
                  borderLeft: '1px solid rgba(255,255,255,0.1)',
                  borderRight: '1px solid rgba(0,0,0,0.08)',
                  borderBottom: '2px solid rgba(0,0,0,0.12)',
                  boxShadow: '0 2px 0 rgba(0,0,0,0.08), inset 0 1px 0 rgba(255,255,255,0.1)',
                  display: 'inline-block',
                  cursor: 'pointer',
                }}>
                  Esc
                </motion.kbd>
                关闭
              </span>
            </div>
          </div>
        )}
      </motion.div>

      {/* 气泡菜单 */}
      {bubbleMenu && (
        <div
          ref={bubbleMenuRef}
          style={{
            position: 'fixed',
            left: bubbleMenu.x,
            top: bubbleMenu.y,
            zIndex: 1000,
            minWidth: '180px',
          }}
          onClick={(e) => e.stopPropagation()}
        >
          <div style={{
            backgroundColor: 'var(--bg-secondary)',
            borderRadius: 'var(--radius-md)',
            border: '1px solid var(--border-color)',
            boxShadow: 'var(--shadow-lg)',
            padding: '2px 0',
            overflow: 'hidden',
          }}>
            <button
              onClick={async () => {
                await api.creativity.delete(bubbleMenu.item.id);
                useUIStore.getState().showToast('success', '已移至回收站');
                doSearch(keyword);
                setBubbleMenu(null);
              }}
              style={{
                display: 'flex',
                alignItems: 'center',
                gap: '10px',
                justifyContent: 'flex-start',
                width: '100%',
                padding: '6px 14px',
                border: 'none',
                background: 'none',
                cursor: 'pointer',
                fontSize: 13,
                color: 'var(--error-color)',
              }}
            >
              <Trash2 size={14} />
              发送至回收站
            </button>
            {boards.length > 0 && (
              <>
                <div style={{ height: 1, backgroundColor: 'var(--border-color)', margin: '2px 0' }} />
                <div style={{ padding: '4px 14px 2px', fontSize: 11, color: 'var(--text-tertiary)', fontWeight: 600 }}>发送至画布</div>
                {boards.map((board: any) => (
                  <button
                    key={board.id}
                    onClick={() => handleSendToBoard(board.id)}
                    style={{
                      display: 'flex',
                      alignItems: 'center',
                      gap: '10px',
                      justifyContent: 'flex-start',
                      width: '100%',
                      padding: '6px 14px',
                      border: 'none',
                      background: 'none',
                      cursor: 'pointer',
                      fontSize: 13,
                      color: 'var(--text-primary)',
                    }}
                  >
                    <Send size={14} />
                    <span style={{ overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{board.name}</span>
                  </button>
                ))}
              </>
            )}
          </div>
        </div>
      )}

      {/* 预览 */}
      {previewOpen && previewItem && (
        <CardPreview
          creativity={previewItem}
          isOpen={previewOpen}
          onClose={() => { setPreviewOpen(false); setPreviewItem(null); }}
          onSave={async (data: any) => {
            try {
              await api.creativity.update(previewItem.id, data);
              // 更新本地 previewItem 以反映最新更改
              setPreviewItem(prev => prev ? { ...prev, ...data } : null);
              doSearch(keyword);
              return true;
            } catch { return false; }
          }}
          onDelete={() => doSearch(keyword)}
          onEdit={() => {
            setPreviewOpen(false);
            useUIStore.getState().openEditor(previewItem);
          }}
        />
      )}

      {directImagePreview && (
        <div
          onClick={(e) => e.stopPropagation()}
          onMouseDown={(e) => e.stopPropagation()}
        >
          <AntImage
            style={{ display: 'none' }}
            src={toMediaUrl(directImagePreview.mediaFilePath || directImagePreview.content)}
            preview={{
              visible: true,
              zIndex: 100002,
              onVisibleChange: (visible: boolean) => { if (!visible) setDirectImagePreview(null); },
              onCancel: () => setDirectImagePreview(null),
            }}
          />
        </div>
      )}

      {/* 右键菜单 - 使用 Portal 渲染到 body */}
      {contextMenu && createPortal(
        <div
          ref={contextMenuRef}
          data-context-menu
          style={{
            position: 'fixed',
            left: contextMenu.x,
            top: contextMenu.y,
            zIndex: 10000,
            backgroundColor: 'var(--bg-secondary)',
            borderRadius: 'var(--radius-md)',
            border: '1px solid var(--border-color)',
            boxShadow: 'var(--shadow-lg)',
            overflow: 'hidden',
            minWidth: 160,
          }}
        >
          <Menu
            mode="vertical"
            onClick={({ key }) => handleContextAction(key)}
            style={{ border: 'none', background: 'transparent' }}
            items={[
              { key: 'edit', label: <span style={{ display: 'inline-flex', alignItems: 'center', gap: 8 }}><Pencil size={14} />编辑</span> },
              { type: 'divider' },
              { key: 'favorite', label: <span style={{ display: 'inline-flex', alignItems: 'center', gap: 8 }}><Bookmark size={14} />{(contextMenu.item.isFavorite || (contextMenu.item as any).is_favorite === 1) ? '取消收藏' : '收藏'}</span> },
              // 添加发送到画布子菜单（如果有画布）
              ...(boards.length > 0 ? [
                { 
                  key: 'send-to-board', 
                  label: <span style={{ display: 'inline-flex', alignItems: 'center', gap: 8 }}><Send size={14} />发送至画布</span>, 
                  children: boards.map((board: any) => ({
                    key: `board-${board.id}`,
                    label: board.name,
                  })),
                },
              ] : []),
              { type: 'divider' },
              { key: 'ai-chat', label: <span style={{ display: 'inline-flex', alignItems: 'center', gap: 8 }}><MessageSquare size={14} />发送给 AI 讨论</span> },
              { key: 'ai-continue', label: <span style={{ display: 'inline-flex', alignItems: 'center', gap: 8 }}><Sparkles size={14} />AI 续写</span> },
              { key: 'ai-polish', label: <span style={{ display: 'inline-flex', alignItems: 'center', gap: 8 }}><Wand2 size={14} />AI 润色改写</span> },
              { key: 'ai-tags', label: <span style={{ display: 'inline-flex', alignItems: 'center', gap: 8 }}><Tags size={14} />AI 生成标签</span> },
              { key: 'ai-translate', label: <span style={{ display: 'inline-flex', alignItems: 'center', gap: 8 }}><Languages size={14} />AI 翻译</span> },
              { type: 'divider' },
              { key: 'trash', label: <span style={{ display: 'inline-flex', alignItems: 'center', gap: 8 }}><Trash2 size={14} />移到回收站</span>, danger: true },
            ]}
          />
        </div>,
        document.body
      )}
    </motion.div>
  );
};

export default SearchDialog;
