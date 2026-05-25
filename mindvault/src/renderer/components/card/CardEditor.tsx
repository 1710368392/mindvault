import React, { useState, useEffect, useCallback, useRef, Suspense, useMemo } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import {
  X, Save, Type, Image, Mic, Link, Video, Smile,
  Sparkles, ChevronDown, Minus,
  Maximize2, Minimize2, FileText, Undo2, Redo2, Plus, Upload,
  Heart, Trash2
} from 'lucide-react';
import type { Creativity } from '@shared/types';
import { CREATIVITY_TYPES, EMOJI_REACTIONS, STICKY_COLORS } from '@shared/constants';
import EmojiIcon from '../common/EmojiIcon';
import ShootingStar from '../common/ShootingStar';
import TagAutoComplete from '../common/TagAutoComplete';
import type { CreativityCreateInput, CreativityUpdateInput } from '../../types/creativity';
import { useUIStore } from '../../stores/uiStore';
import { Tag, Tooltip, Popover, Rate, Typography, App as AntdApp, Popconfirm } from 'antd';
import { useCreativityStore } from '../../stores/creativityStore';
import { api } from '../../utils/api';
import { toMediaUrl, inferTypeFromPath, registerMediaPaths } from '../../utils/media';
import VideoThumbnailImg from '../common/VideoThumbnailImg';
import { useAutoSave } from '../../hooks/useAutoSave';
import { useMarkdownWordCount } from '../../hooks/useMarkdownWordCount';

const MDEditor = React.lazy(() => import('@uiw/react-md-editor'));

interface CardEditorProps {
  windowId: string;
  creativity: Creativity | null;
  onClose: () => void;
  onSave: (data: CreativityCreateInput | CreativityUpdateInput) => Promise<any>;
  zIndex?: number;
}

let windowCount = 0;

const CardEditor: React.FC<CardEditorProps> = ({
  windowId,
  creativity,
  onClose,
  onSave,
  zIndex = 1000,
}) => {
  const isEditing = !!creativity;

  const [pos, setPos] = useState(() => {
    const offset = (windowCount % 10) * 30;
    windowCount++;
    const cx = Math.max(60, (window.innerWidth - 580) / 2 + offset);
    const cy = Math.max(40, (window.innerHeight - 640) / 2 + offset);
    return { x: cx, y: cy };
  });
  const [size, setSize] = useState({ width: 580, height: 'auto' as number | string });
  const [isMinimized, setIsMinimized] = useState(false);
  const [isDragging, setIsDragging] = useState(false);
  const [isResizing, setIsResizing] = useState(false);
  const [isEntering, setIsEntering] = useState(true);
  const [isFocused, setIsFocused] = useState(false);

  const [title, setTitle] = useState('');
  const [content, setContent] = useState('');
  const [type, setType] = useState<Creativity['type']>('text');
  const [contentFormat, setContentFormat] = useState<'plain' | 'markdown'>('markdown');
  const [priority, setPriority] = useState(0);
  const [tags, setTags] = useState<string[]>([]);
  const [tagInput, setTagInput] = useState('');
  const [existingTags, setExistingTags] = useState<string[]>([]);
  const [emojiReaction, setEmojiReaction] = useState<string | null>(null);
  const [isSaving, setIsSaving] = useState(false);
  const [dirty, setDirty] = useState(false);
  const [isFullscreen, setIsFullscreen] = useState(false);
  const [mediaFiles, setMediaFiles] = useState<any[]>([]);
  const [pendingMediaDeletions, setPendingMediaDeletions] = useState<string[]>([]);
  const [isDragOver, setIsDragOver] = useState(false);
  const [showConfirmCancel, setShowConfirmCancel] = useState(false);
  const [isFavorite, setIsFavorite] = useState(false);
  const dragOverCounterRef = useRef(0);
  
  const handleDragOverEditor = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    if (e.dataTransfer.types.includes('Files')) {
      e.dataTransfer.dropEffect = 'copy';
    }
  }, []);

  const handleDragEnterEditor = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    if (!e.dataTransfer.types.includes('Files')) return;
    dragOverCounterRef.current++;
    setIsDragOver(true);
  }, []);

  const handleDragLeaveEditor = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    dragOverCounterRef.current--;
    if (dragOverCounterRef.current <= 0) {
      dragOverCounterRef.current = 0;
      setIsDragOver(false);
    }
  }, []);

  const handleDropOnEditor = useCallback(async (e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    dragOverCounterRef.current = 0;
    setIsDragOver(false);

    const files = Array.from(e.dataTransfer.files);
    if (files.length === 0) return;

    for (const file of files) {
      const fileType = inferTypeFromPath(file.name);
      if (!fileType) continue;

      const arrayBuffer = await file.arrayBuffer();
      const uint8 = new Uint8Array(arrayBuffer);

      const result = await api.media.save(
        { fileData: uint8, fileName: file.name, fileType },
        creativity?.id || undefined
      );

      if (result?.success && result.data) {
        if (creativity?.id) {
          const files = await api.media.listByCreativity(creativity.id);
          setMediaFiles(files || []);
          registerMediaPaths(files || []);
        } else {
          setMediaFiles(prev => [...prev, result.data]);
          registerMediaPaths([result.data]);
          if (result.data.id) {
            useUIStore.getState().addPendingMediaId(result.data.id);
          }
        }
        setType(fileType as Creativity['type']);
      }
    }
  }, [creativity, content]);

  // 历史记录状态
  const [contentHistory, setContentHistory] = useState<string[]>([]);
  const [historyIndex, setHistoryIndex] = useState(-1);
  // 输入法组合状态
  const isComposingRef = useRef(false);

  const { wordCount, charCount } = useMarkdownWordCount(content);

  const { save: autoSave } = useAutoSave(content, 30000, () => {
    if (dirty && content.trim()) handleSave();
  });

  const windowRef = useRef<HTMLDivElement>(null);
  const dragStateRef = useRef<{ startX: number; startY: number; startPosX: number; startPosY: number } | null>(null);
  const resizeStateRef = useRef<{ startX: number; startY: number; startW: number; startH: number } | null>(null);
  const editorContainerRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const timer = setTimeout(() => setIsEntering(false), 200);
    return () => clearTimeout(timer);
  }, []);

  useEffect(() => {
    api.tag.list().then((result) => {
      if (result) setExistingTags(result.map((t: any) => t.name || t));
    }).catch(() => {});
  }, []);

  // 初始化或重置历史记录
  useEffect(() => {
    if (creativity) {
      setTitle(creativity.title);
      setContent(creativity.content);
      setType(creativity.type);
      setContentFormat(creativity.contentFormat || 'plain');
      setPriority(creativity.priority);
      setTags(creativity.tags?.map((t) => t.name) || []);
      setEmojiReaction(creativity.emojiReaction);
      setContentHistory([creativity.content]);
      setHistoryIndex(0);
      setIsFavorite(!!creativity.isFavorite || !!(creativity as any).is_favorite);
      if (creativity.id) {
        api.media.listByCreativity(creativity.id).then((files: any[]) => {
          setMediaFiles(files || []);
          registerMediaPaths(files || []);
        }).catch(() => setMediaFiles([]));
      }
    } else {
      setTitle(''); setContent(''); setType('text');
      setContentFormat('markdown'); setPriority(0); setTags([]);
      setTagInput(''); setEmojiReaction(null);
      setContentHistory(['']);
      setHistoryIndex(0);
      setMediaFiles([]);
      setIsFavorite(false);
    }
    setDirty(false);
  }, [creativity]);

  const lastSaveTimeRef = useRef<number>(Date.now());
  const lastContentRef = useRef<string>('');

  // 保存内容到历史记录
  const saveToHistory = useCallback((newContent: string) => {
    // 如果正在输入法组合中，不保存历史记录
    if (isComposingRef.current) return;
    
    const now = Date.now();
    // 防抖：距离上次保存至少 500ms，或者内容确实发生了有意义的变化
    const hasSignificantChange = Math.abs(newContent.length - lastContentRef.current.length) > 3;
    if (now - lastSaveTimeRef.current >= 500 || hasSignificantChange) {
      setContentHistory(prev => {
        // 裁剪历史记录到当前索引位置
        const trimmedHistory = prev.slice(0, historyIndex + 1);
        // 只有当内容真正发生变化时才添加
        if (trimmedHistory[trimmedHistory.length - 1] === newContent) {
          return prev;
        }
        // 添加新内容
        const newHistory = [...trimmedHistory, newContent];
        // 限制历史记录长度为 50
        if (newHistory.length > 50) {
          newHistory.shift();
          setHistoryIndex(49);
        } else {
          setHistoryIndex(trimmedHistory.length);
        }
        lastSaveTimeRef.current = now;
        lastContentRef.current = newContent;
        return newHistory;
      });
    }
  }, [historyIndex]);

  // Undo 函数
  const handleUndo = useCallback(() => {
    if (historyIndex > 0) {
      const newIndex = historyIndex - 1;
      setHistoryIndex(newIndex);
      const newContent = contentHistory[newIndex];
      setContent(newContent);
      lastContentRef.current = newContent;
      setDirty(true);
    }
  }, [historyIndex, contentHistory]);

  // Redo 函数
  const handleRedo = useCallback(() => {
    if (historyIndex < contentHistory.length - 1) {
      const newIndex = historyIndex + 1;
      setHistoryIndex(newIndex);
      const newContent = contentHistory[newIndex];
      setContent(newContent);
      lastContentRef.current = newContent;
      setDirty(true);
    }
  }, [historyIndex, contentHistory]);

  // 内容变化时的处理
  const handleContentChange = useCallback((newContent: string) => {
    setContent(newContent);
    setDirty(true);
    // 由 saveToHistory 内部自己判断是否应该保存到历史记录
    // 它会检查 isComposingRef.current 来决定是否保存
    saveToHistory(newContent);
  }, [saveToHistory]);

  const handleClose = useCallback(() => {
    if (dirty) {
      setShowConfirmCancel(true);
      return;
    }
    onClose();
  }, [dirty, onClose]);

  useEffect(() => {
    const handleEsc = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        if (isFullscreen) {
          const target = e.target as HTMLElement;
          if (!target.closest('.w-md-editor')) { e.preventDefault(); setIsFullscreen(false); return; }
        }
        if (isFocused) handleClose();
      }
    };
    window.addEventListener('keydown', handleEsc);
    return () => window.removeEventListener('keydown', handleEsc);
  }, [isFocused, handleClose, isFullscreen]);

  // 监听编辑器容器内的输入法事件
  useEffect(() => {
    const container = editorContainerRef.current;
    if (!container || contentFormat !== 'markdown') return;

    const handleCompositionStart = () => {
      isComposingRef.current = true;
    };

    const handleCompositionEnd = () => {
      isComposingRef.current = false;
      // 组合结束后保存最终结果到历史
      saveToHistory(content);
    };

    // 监听容器内的所有 composition 事件
    container.addEventListener('compositionstart', handleCompositionStart, true);
    container.addEventListener('compositionend', handleCompositionEnd, true);

    return () => {
      container.removeEventListener('compositionstart', handleCompositionStart, true);
      container.removeEventListener('compositionend', handleCompositionEnd, true);
    };
  }, [contentFormat, content, saveToHistory]);

  useEffect(() => {
    const handlePaste = async (e: ClipboardEvent) => {
      if (!isFocused) return;
      const items = e.clipboardData?.items;
      if (!items) return;
      let imageItem: DataTransferItem | null = null;
      for (let i = 0; i < items.length; i++) {
        if (items[i].type.startsWith('image/')) {
          imageItem = items[i];
          break;
        }
      }
      if (!imageItem) return;
      e.preventDefault();
      const file = imageItem.getAsFile();
      if (!file) return;
      try {
        const arrayBuffer = await file.arrayBuffer();
        const uint8Array = new Uint8Array(arrayBuffer);
        const ext = file.type === 'image/jpeg' ? '.jpg' : '.png';
        const fileName = `clipboard_${Date.now()}${ext}`;
        const result = await api.media.save({
          fileName,
          fileType: 'image',
          data: uint8Array,
          creativityId: creativity?.id,
        });
        if (result && result.success !== false) {
          const mediaData = result.data || result;
          if (creativity?.id) {
            const files = await api.media.listByCreativity(creativity.id);
            setMediaFiles(files || []);
            registerMediaPaths(files || []);
          } else {
            if (mediaData) {
              setMediaFiles(prev => [...prev, mediaData]);
              registerMediaPaths([mediaData]);
              if (mediaData.id) useUIStore.getState().addPendingMediaId(mediaData.id);
            }
          }
          if (type !== 'image') {
            setType('image');
          }
          if (!content.trim() && mediaData && mediaData.id) {
            setDirty(true);
          }
          useUIStore.getState().showToast('success', '图片已粘贴');
        }
      } catch {
        useUIStore.getState().showNotification('error', '粘贴图片失败', '请检查剪贴板中的图片数据');
      }
    };
    document.addEventListener('paste', handlePaste);
    return () => document.removeEventListener('paste', handlePaste);
  }, [isFocused, creativity?.id, type, content]);

  useEffect(() => {
    const handleF11 = (e: KeyboardEvent) => {
      if (e.key === 'F11' && isFocused) { e.preventDefault(); setIsFullscreen((prev) => !prev); }
    };
    window.addEventListener('keydown', handleF11);
    return () => window.removeEventListener('keydown', handleF11);
  }, [isFocused]);

  const handleMouseDown = useCallback(() => { setIsFocused(true); }, []);

  useEffect(() => {
    const handleClickOutside = (e: MouseEvent) => {
      if (windowRef.current && !windowRef.current.contains(e.target as Node)) setIsFocused(false);
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  const handleDragStart = useCallback((e: React.MouseEvent) => {
    if ((e.target as HTMLElement).closest('button')) return;
    e.preventDefault();
    dragStateRef.current = { startX: e.clientX, startY: e.clientY, startPosX: pos.x, startPosY: pos.y };
    setIsDragging(true);
    const handleMouseMove = (ev: MouseEvent) => {
      if (!dragStateRef.current) return;
      setPos({
        x: dragStateRef.current.startPosX + ev.clientX - dragStateRef.current.startX,
        y: Math.max(0, dragStateRef.current.startPosY + ev.clientY - dragStateRef.current.startY),
      });
    };
    const handleMouseUp = () => { dragStateRef.current = null; setIsDragging(false); document.removeEventListener('mousemove', handleMouseMove); document.removeEventListener('mouseup', handleMouseUp); };
    document.addEventListener('mousemove', handleMouseMove);
    document.addEventListener('mouseup', handleMouseUp);
  }, [pos]);

  const handleResizeStart = useCallback((e: React.MouseEvent) => {
    e.preventDefault(); e.stopPropagation();
    const currentW = windowRef.current?.offsetWidth || 580;
    const currentH = windowRef.current?.offsetHeight || 640;
    resizeStateRef.current = { startX: e.clientX, startY: e.clientY, startW: currentW, startH: currentH };
    setIsResizing(true);
    const handleMouseMove = (ev: MouseEvent) => {
      if (!resizeStateRef.current) return;
      setSize({ width: Math.max(420, resizeStateRef.current.startW + ev.clientX - resizeStateRef.current.startX), height: Math.max(300, resizeStateRef.current.startH + ev.clientY - resizeStateRef.current.startY) });
    };
    const handleMouseUp = () => { resizeStateRef.current = null; setIsResizing(false); document.removeEventListener('mousemove', handleMouseMove); document.removeEventListener('mouseup', handleMouseUp); };
    document.addEventListener('mousemove', handleMouseMove);
    document.addEventListener('mouseup', handleMouseUp);
  }, []);

  const handleAddTag = useCallback(() => {
    const trimmed = tagInput.trim();
    if (trimmed && !tags.includes(trimmed)) { setTags([...tags, trimmed]); setTagInput(''); }
  }, [tagInput, tags]);

  const handleRemoveTag = useCallback((tag: string) => { setTags(tags.filter((t) => t !== tag)); }, [tags]);

  const canSave = title.trim() || content.trim() || mediaFiles.length > 0 || (isEditing && ['image', 'video', 'audio', 'document'].includes(type));

  const handleSave = async () => {
    if (!canSave) return;
    setIsSaving(true);
    try {
      const data = isEditing
        ? { id: creativity!.id, title: title.trim(), content: content.trim(), type, contentFormat, wordCount, priority, emojiReaction, tags, isFavorite, ...((creativity as any)._isCanvasLocal ? { _isCanvasLocal: true, _canvasItemId: (creativity as any)._canvasItemId } : {}) } as CreativityUpdateInput
        : { title: title.trim(), content: content.trim(), type, contentFormat, wordCount, priority, emojiReaction, tags, isFavorite } as CreativityCreateInput;
      const result = await onSave(data);
      if (result) {
        // 保存成功后，执行待删除的附件清理
        for (const mediaId of pendingMediaDeletions) {
          try { await api.media.delete(mediaId); } catch (e) { console.error('[CardEditor] 删除附件失败:', e); }
        }
        if (!isEditing) {
          const creativityId = typeof result === 'object' && result?.id ? result.id : null;
          if (creativityId) {
            const pendingMediaIds = useUIStore.getState().pendingMediaIds || [];
            if (pendingMediaIds.length > 0) {
              await api.media.linkToCreativity(pendingMediaIds, creativityId);
              useUIStore.getState().clearPendingMediaIds();
              await useCreativityStore.getState().fetchCreativities();
            }
          }
        }
        setDirty(false);
        useUIStore.getState().showToast('success', '创意已保存');
        onClose();
      }
    } finally { setIsSaving(false); }
  };

  const typeIcons: Record<string, React.ReactNode> = {
    text: <Type size={14} />, image: <Image size={14} />, audio: <Mic size={14} />, link: <Link size={14} />, video: <Video size={14} />, document: <FileText size={14} />,
  };

  const typeGradients: Record<string, string> = {
    text: 'linear-gradient(135deg, #667eea 0%, #764ba2 100%)',
    image: 'linear-gradient(135deg, #f093fb 0%, #f5576c 100%)',
    audio: 'linear-gradient(135deg, #4facfe 0%, #00f2fe 100%)',
    link: 'linear-gradient(135deg, #43e97b 0%, #38f9d7 100%)',
    video: 'linear-gradient(135deg, #fa709a 0%, #fee140 100%)',
    document: 'linear-gradient(135deg, #a18cd1 0%, #fbc2eb 100%)',
  };

  const toggleFullscreen = useCallback(() => { setIsFullscreen((prev) => !prev); }, []);

  const headerBtnStyle = (hoverColor = 'var(--bg-hover)'): React.CSSProperties => ({
    width: 30, height: 30, borderRadius: 8,
    border: 'none', background: 'transparent',
    color: 'var(--text-tertiary)', cursor: 'pointer',
    display: 'flex', alignItems: 'center', justifyContent: 'center',
    transition: 'all 0.15s ease',
  });

  return (
    <div
      ref={windowRef}
      onMouseDown={handleMouseDown}
      style={{
        position: 'fixed',
        left: isFullscreen ? 0 : pos.x,
        top: isFullscreen ? 0 : pos.y,
        width: isFullscreen ? '100vw' : (typeof size.width === 'number' ? size.width : 580),
        height: isFullscreen ? '100vh' : (isMinimized ? 'auto' : (typeof size.height === 'number' ? size.height : 'auto')),
        maxHeight: isFullscreen ? '100vh' : (isMinimized ? 'none' : '85vh'),
        zIndex: isFullscreen ? 9999 : zIndex,
        borderRadius: isFullscreen ? 0 : 16,
        border: isFullscreen ? 'none' : `1.5px solid ${isFocused ? 'var(--primary-color)' : 'var(--border-color)'}`,
        background: 'var(--bg-secondary)',
        boxShadow: isFullscreen ? 'none' : isDragging
          ? '0 20px 60px rgba(0,0,0,0.3), 0 0 0 1px var(--primary-color)'
          : isFocused
            ? '0 12px 40px rgba(0,0,0,0.18), 0 0 0 1px var(--primary-color)'
            : '0 4px 20px rgba(0,0,0,0.1)',
        display: 'flex',
        flexDirection: 'column',
        overflow: 'hidden',
        opacity: isEntering ? 0 : isDragging ? 0.95 : 1,
        transform: isEntering ? 'scale(0.96) translateY(8px)' : isDragging ? 'scale(1.01)' : 'scale(1)',
        transition: isDragging
          ? 'box-shadow 0.15s ease, opacity 0.15s ease'
          : 'all 0.25s cubic-bezier(0.4, 0, 0.2, 1)',
        minWidth: isFullscreen ? '100vw' : 420,
        minHeight: isFullscreen ? '100vh' : (isMinimized ? 'auto' : 300),
      }}
    >
      {/* ===== 顶部渐变装饰线 ===== */}
      {!isFullscreen && (
        <div style={{
          width: '100%',
          boxSizing: 'border-box',
          height: 3,
          background: isEditing
            ? 'linear-gradient(90deg, var(--primary-color), var(--primary-hover), #a78bfa)'
            : 'linear-gradient(90deg, #10b981, #34d399, #6ee7b7)',
          flexShrink: 0,
          borderRadius: '16px 16px 0 0',
        }} />
      )}

      {/* ===== 窗口头部 ===== */}
      {isFullscreen ? (
        <div style={{
          display: 'flex', alignItems: 'center', gap: 12, height: 52,
          padding: '0 24px', background: 'var(--bg-tertiary)',
          borderBottom: '1px solid var(--border-color)', flexShrink: 0,
        }}>
          <div style={{ width: 28, height: 28, borderRadius: 8, background: 'linear-gradient(135deg, var(--primary-color), var(--primary-hover))', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
            <Sparkles size={14} color="white" />
          </div>
          <input
            type="text" value={title}
            onChange={(e) => { setTitle(e.target.value); setDirty(true); }}
            placeholder="给创意起个名字..."
            style={{
              flex: 1, padding: '8px 14px', borderRadius: 10,
              border: '1.5px solid var(--border-color)', background: 'var(--bg-primary)',
              fontSize: 16, fontWeight: 600, color: 'var(--text-primary)', outline: 'none',
            }}
          />
          {subtype && getAllSubtypes()[subtype] && (
            <Tag
              color={getAllSubtypes()[subtype].color}
              icon={getAllSubtypes()[subtype].icon}
              style={{ flexShrink: 0 }}
            >
              {getAllSubtypes()[subtype].label}
            </Tag>
          )}
          <span style={{ fontSize: 12, color: 'var(--text-tertiary)', flexShrink: 0 }}>{wordCount} 字</span>
          <button onClick={handleSave} disabled={!canSave || isSaving} style={{
            display: 'flex', alignItems: 'center', gap: 6, padding: '7px 18px', borderRadius: 10,
            border: 'none', background: !canSave || isSaving ? 'var(--text-tertiary)' : 'linear-gradient(135deg, var(--primary-color), var(--primary-hover))',
            color: 'white', fontSize: 13, fontWeight: 600, cursor: !canSave || isSaving ? 'not-allowed' : 'pointer',
            boxShadow: !canSave || isSaving ? 'none' : '0 2px 10px rgba(var(--primary-rgb, 99,102,241), 0.3)',
            flexShrink: 0,
          }}>
            <Save size={14} />{isSaving ? '保存中...' : '保存'}
          </button>
          <button onClick={toggleFullscreen} style={headerBtnStyle()} onMouseEnter={(e) => { (e.currentTarget as HTMLElement).style.background = 'var(--bg-hover)'; (e.currentTarget as HTMLElement).style.color = 'var(--text-primary)'; }} onMouseLeave={(e) => { (e.currentTarget as HTMLElement).style.background = 'transparent'; (e.currentTarget as HTMLElement).style.color = 'var(--text-tertiary)'; }}>
            <Minimize2 size={16} />
          </button>
          <button onClick={(e) => { e.stopPropagation(); handleClose(); }} style={headerBtnStyle()} onMouseEnter={(e) => { (e.currentTarget as HTMLElement).style.background = '#ef4444'; (e.currentTarget as HTMLElement).style.color = 'white'; }} onMouseLeave={(e) => { (e.currentTarget as HTMLElement).style.background = 'transparent'; (e.currentTarget as HTMLElement).style.color = 'var(--text-tertiary)'; }}>
            <X size={16} />
          </button>
        </div>
      ) : (
        <div
          onMouseDown={handleDragStart}
          style={{
            display: 'flex', alignItems: 'center', justifyContent: 'space-between',
            height: 44, padding: '0 14px', background: 'var(--bg-tertiary)',
            cursor: isDragging ? 'grabbing' : 'grab', flexShrink: 0, userSelect: 'none',
            borderRadius: isFullscreen ? 0 : '16px 16px 0 0',
          }}
        >
          <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
            <div style={{
              width: 24, height: 24, borderRadius: 7,
              background: isEditing ? 'linear-gradient(135deg, var(--primary-color), var(--primary-hover))' : 'linear-gradient(135deg, #10b981, #059669)',
              display: 'flex', alignItems: 'center', justifyContent: 'center',
            }}>
              <Sparkles size={12} color="white" />
            </div>
            <Typography.Text ellipsis style={{ fontSize: 13, fontWeight: 600, color: 'var(--text-primary)', maxWidth: 300 }}>
              {isEditing ? '编辑创意' : '新建创意'}
            </Typography.Text>
            <button onClick={(e) => { e.stopPropagation(); setIsFavorite(!isFavorite); setDirty(true); }} style={{
              border: 'none', background: 'transparent', cursor: 'pointer',
              display: 'flex', alignItems: 'center', justifyContent: 'center',
              padding: 0, color: isFavorite ? '#ef4444' : 'var(--text-tertiary)',
              transition: 'all 0.2s ease',
            }}>
              <Heart size={16} fill={isFavorite ? '#ef4444' : 'none'} />
            </button>
            {dirty && <Tooltip title="有未保存的更改"><span style={{ width: 7, height: 7, borderRadius: '50%', background: '#f59e0b', flexShrink: 0 }} /></Tooltip>}
          </div>
          <div style={{ display: 'flex', alignItems: 'center', gap: 2 }}>
            <button onClick={(e) => { e.stopPropagation(); toggleFullscreen(); }} style={headerBtnStyle()} onMouseEnter={(e) => { (e.currentTarget as HTMLElement).style.background = 'var(--bg-hover)'; (e.currentTarget as HTMLElement).style.color = 'var(--text-primary)'; }} onMouseLeave={(e) => { (e.currentTarget as HTMLElement).style.background = 'transparent'; (e.currentTarget as HTMLElement).style.color = 'var(--text-tertiary)'; }}>
              <Maximize2 size={14} />
            </button>
            <button onClick={(e) => { e.stopPropagation(); setIsMinimized(!isMinimized); }} style={headerBtnStyle()} onMouseEnter={(e) => { (e.currentTarget as HTMLElement).style.background = 'var(--bg-hover)'; (e.currentTarget as HTMLElement).style.color = 'var(--text-primary)'; }} onMouseLeave={(e) => { (e.currentTarget as HTMLElement).style.background = 'transparent'; (e.currentTarget as HTMLElement).style.color = 'var(--text-tertiary)'; }}>
              <Minus size={14} />
            </button>
            <button onClick={(e) => { e.stopPropagation(); handleClose(); }} style={headerBtnStyle()} onMouseEnter={(e) => { (e.currentTarget as HTMLElement).style.background = '#ef4444'; (e.currentTarget as HTMLElement).style.color = 'white'; }} onMouseLeave={(e) => { (e.currentTarget as HTMLElement).style.background = 'transparent'; (e.currentTarget as HTMLElement).style.color = 'var(--text-tertiary)'; }}>
              <X size={14} />
            </button>
          </div>
        </div>
      )}

      {/* ===== 窗口内容 ===== */}
      {!isMinimized && (
        <div
          onDragOver={handleDragOverEditor}
          onDragEnter={handleDragEnterEditor}
          onDragLeave={handleDragLeaveEditor}
          onDrop={handleDropOnEditor}
          style={{ flex: 1, display: 'flex', flexDirection: 'column', overflow: 'hidden', minHeight: 0, position: 'relative', borderRadius: isFullscreen ? 0 : '0 0 16px 16px' }}
        >
          {isDragOver && (
            <div style={{
              position: 'absolute', inset: 0, zIndex: 50,
              display: 'flex', alignItems: 'center', justifyContent: 'center',
              background: 'rgba(var(--primary-color-rgb, 99,102,241), 0.08)',
              border: '2px dashed var(--primary-color)',
              borderRadius: 12, margin: 8,
              pointerEvents: 'none',
            }}>
              <span style={{ fontSize: 16, fontWeight: 600, color: 'var(--primary-color)' }}>释放以添加文件</span>
            </div>
          )}
          <div style={{
            flex: 1, overflowY: 'auto', padding: isFullscreen ? '20px 64px' : '20px 24px',
            display: 'flex', flexDirection: 'column', gap: 18, minHeight: 0,
          }}>
            {/* 标题输入 */}
            {!isFullscreen && (
              <input
                type="text" value={title}
                onChange={(e) => { setTitle(e.target.value); setDirty(true); }}
                placeholder="给创意起个名字..."
                autoFocus
                style={{
                  width: '100%', padding: '12px 0', border: 'none', borderBottom: '2px solid var(--border-light)',
                  background: 'transparent', fontSize: 22, fontWeight: 700, color: 'var(--text-primary)',
                  outline: 'none', transition: 'border-color 0.2s ease', letterSpacing: 0.2,
                }}
                onFocus={(e) => { (e.target as HTMLElement).style.borderBottomColor = 'var(--primary-color)'; }}
                onBlur={(e) => { (e.target as HTMLElement).style.borderBottomColor = 'var(--border-light)'; }}
              />
            )}

            {/* 内容编辑器 */}
            <div>
              <div style={{ display: 'flex', alignItems: 'center', gap: 6, marginBottom: 8 }}>
                <FileText size={13} style={{ color: 'var(--text-tertiary)' }} />
                <span style={{ fontSize: 12, fontWeight: 600, color: 'var(--text-tertiary)', textTransform: 'uppercase', letterSpacing: 0.8 }}>内容</span>
                <span style={{ marginLeft: 'auto', fontSize: 11, color: 'var(--text-tertiary)' }}>{wordCount} 字 · {charCount} 字符</span>
              </div>
              <Suspense fallback={<div style={{ minHeight: 200, display: 'flex', alignItems: 'center', justifyContent: 'center', color: 'var(--text-tertiary)', borderRadius: 12, border: '1px dashed var(--border-color)' }}>加载编辑器...</div>}>
                <div data-color-mode={document.documentElement.dataset.theme === 'dark' ? 'dark' : 'light'} ref={editorContainerRef}>
                  {contentFormat === 'plain' ? (
                    <>
                      {/* 纯文本模式工具栏 */}
                      <div style={{ 
                        display: 'flex', alignItems: 'center', gap: '4px', 
                        marginBottom: '8px', padding: '6px 10px',
                        background: 'var(--bg-tertiary)', borderRadius: '8px' 
                      }}>
                          <Tooltip title="撤销 (Ctrl+Z)">
                            <button
                              onClick={handleUndo}
                              disabled={historyIndex <= 0}
                              style={{
                                display: 'flex', alignItems: 'center', justifyContent: 'center',
                                padding: '4px 8px', borderRadius: '6px', border: 'none',
                                background: 'transparent', color: historyIndex <= 0 ? 'var(--text-tertiary)' : 'var(--text-primary)',
                                cursor: historyIndex <= 0 ? 'not-allowed' : 'pointer',
                                fontSize: '12px', transition: 'all 0.15s ease'
                              }}
                              onMouseEnter={(e) => {
                                if (historyIndex > 0) {
                                  (e.currentTarget as HTMLElement).style.background = 'var(--bg-hover)';
                                }
                              }}
                              onMouseLeave={(e) => {
                                (e.currentTarget as HTMLElement).style.background = 'transparent';
                              }}
                            >
                              <Undo2 size={14} />
                            </button>
                          </Tooltip>
                          <Tooltip title="重做 (Ctrl+Y)">
                            <button
                              onClick={handleRedo}
                              disabled={historyIndex >= contentHistory.length - 1}
                              style={{
                                display: 'flex', alignItems: 'center', justifyContent: 'center',
                                padding: '4px 8px', borderRadius: '6px', border: 'none',
                                background: 'transparent', color: historyIndex >= contentHistory.length - 1 ? 'var(--text-tertiary)' : 'var(--text-primary)',
                                cursor: historyIndex >= contentHistory.length - 1 ? 'not-allowed' : 'pointer',
                                fontSize: '12px', transition: 'all 0.15s ease'
                              }}
                              onMouseEnter={(e) => {
                                if (historyIndex < contentHistory.length - 1) {
                              (e.currentTarget as HTMLElement).style.background = 'var(--bg-hover)';
                            }
                          }}
                          onMouseLeave={(e) => {
                            (e.currentTarget as HTMLElement).style.background = 'transparent';
                          }}
                        >
                            <Redo2 size={14} />
                            </button>
                          </Tooltip>
                        </div>
                      <textarea
                        value={content}
                        onChange={(e) => handleContentChange(e.target.value)}
                        onKeyDown={(e) => {
                          // 处理 Ctrl+Z 和 Ctrl+Y 快捷键
                          if ((e.ctrlKey || e.metaKey) && e.key === 'z') {
                            e.preventDefault();
                            if (e.shiftKey) {
                              handleRedo();
                            } else {
                              handleUndo();
                            }
                          } else if ((e.ctrlKey || e.metaKey) && (e.key === 'y' || (e.shiftKey && e.key === 'z'))) {
                            e.preventDefault();
                            handleRedo();
                          }
                        }}
                        // 处理输入法组合事件
                        onCompositionStart={() => {
                          isComposingRef.current = true;
                        }}
                        onCompositionUpdate={() => {
                          // 组合过程中更新内容，但不保存到历史
                          // 内容仍然会显示在输入框中
                        }}
                        onCompositionEnd={(e) => {
                          isComposingRef.current = false;
                          // 组合结束后，保存最终结果到历史
                          saveToHistory(e.currentTarget.value);
                        }}
                        placeholder="在这里写下你的灵感..."
                        style={{
                          width: '100%', minHeight: isFullscreen ? 400 : 200,
                          maxHeight: isFullscreen ? 800 : 400,
                          padding: '14px 16px', borderRadius: 12,
                          border: '1px solid var(--border-color)',
                          background: 'var(--bg-primary)',
                          color: 'var(--text-primary)',
                          fontSize: 14, lineHeight: 1.7,
                          fontFamily: 'inherit', outline: 'none',
                          resize: 'vertical',
                        }}
                      />
                    </>
                  ) : (
                    <MDEditor
                      value={content}
                      onChange={(val) => handleContentChange(val || '')}
                      height={isFullscreen ? 500 : 220}
                      minHeight={isFullscreen ? 400 : 180}
                      maxHeight={isFullscreen ? 800 : 400}
                      preview="live"
                      visibleDragBar={false}
                      commands={[
                        { name: 'undo', keyCommand: 'undo', buttonProps: { title: '撤销 (Ctrl+Z)' }, icon: <Undo2 size={14} /> },
                        { name: 'redo', keyCommand: 'redo', buttonProps: { title: '重做 (Ctrl+Y)' }, icon: <Redo2 size={14} /> },
                        { name: 'bold', keyCommand: 'bold', buttonProps: { title: '加粗 (Ctrl+B)' }, icon: <span style={{ fontSize: 13, fontWeight: 700 }}>B</span> },
                        { name: 'italic', keyCommand: 'italic', buttonProps: { title: '斜体 (Ctrl+I)' }, icon: <span style={{ fontSize: 13, fontStyle: 'italic' }}>I</span> },
                        { name: 'strikeThrough', keyCommand: 'strikeThrough', buttonProps: { title: '删除线' }, icon: <span style={{ fontSize: 13, textDecoration: 'line-through' }}>S</span> },
                        { name: 'title', keyCommand: 'title', buttonProps: { title: '标题' }, icon: <span style={{ fontSize: 13, fontWeight: 700 }}>H</span> },
                        { name: 'quote', keyCommand: 'quote', buttonProps: { title: '引用' }, icon: <span style={{ fontSize: 14 }}>❝</span> },
                        { name: 'code', keyCommand: 'code', buttonProps: { title: '行内代码' }, icon: <span style={{ fontSize: 12, fontFamily: 'monospace' }}>&lt;/&gt;</span> },
                        { name: 'link', keyCommand: 'link', buttonProps: { title: '插入链接' }, icon: <span style={{ fontSize: 13 }}>🔗</span> },
                        { name: 'unorderedList', keyCommand: 'unorderedList', buttonProps: { title: '无序列表' }, icon: <span style={{ fontSize: 13 }}>• 列表</span> },
                        { name: 'orderedList', keyCommand: 'orderedList', buttonProps: { title: '有序列表' }, icon: <span style={{ fontSize: 13 }}>1. 列表</span> },
                        { name: 'check', keyCommand: 'check', buttonProps: { title: '待办事项' }, icon: <span style={{ fontSize: 13 }}>☑ 待办</span> },
                      ]}
                      extraCommands={[
                        { name: 'fullscreen', keyCommand: 'fullscreen', buttonProps: { title: '全屏' } },
                      ]}
                      dataColorMode={document.documentElement.dataset.theme === 'dark' ? 'dark' : 'light'}
                      style={{ border: '1px solid var(--border-color)', borderRadius: 12, overflow: 'hidden' }}
                      textareaProps={{ style: { fontFamily: 'inherit', fontSize: 14 } }}
                    />
                  )}
                  <div style={{
                    display: 'flex', alignItems: 'center', justifyContent: 'space-between',
                    marginTop: 8, padding: '0 4px',
                  }}>
                    <div style={{ display: 'flex', gap: 4 }}>
                      <button
                        onClick={() => { setContentFormat('plain'); setDirty(true); }}
                        style={{
                          padding: '3px 10px', borderRadius: 6, border: 'none',
                          background: contentFormat === 'plain' ? 'var(--primary-color)' : 'var(--bg-tertiary)',
                          color: contentFormat === 'plain' ? 'white' : 'var(--text-secondary)',
                          fontSize: 11, fontWeight: 500, cursor: 'pointer',
                        }}
                      >纯文本</button>
                      <button
                        onClick={() => { setContentFormat('markdown'); setDirty(true); }}
                        style={{
                          padding: '3px 10px', borderRadius: 6, border: 'none',
                          background: contentFormat === 'markdown' ? 'var(--primary-color)' : 'var(--bg-tertiary)',
                          color: contentFormat === 'markdown' ? 'white' : 'var(--text-secondary)',
                          fontSize: 11, fontWeight: 500, cursor: 'pointer',
                        }}
                      >Markdown</button>
                    </div>
                    {contentFormat === 'markdown' && (
                      <span style={{ fontSize: 11, color: 'var(--text-tertiary)' }}>
                        左侧写 Markdown 语法，右侧实时预览效果
                      </span>
                    )}
                  </div>
                </div>
              </Suspense>
            </div>



            {/* 标签 */}
            <div>
              <div style={{ display: 'flex', alignItems: 'center', gap: 6, marginBottom: 8 }}>
                <span style={{ fontSize: 12, fontWeight: 600, color: 'var(--text-tertiary)', textTransform: 'uppercase', letterSpacing: 0.8 }}>标签</span>
              </div>
              <div style={{ display: 'flex', flexWrap: 'wrap', gap: 4, marginBottom: 6 }}>
                {tags.map((tag) => (
                  <span key={tag} style={{
                    display: 'inline-flex', alignItems: 'center', gap: 4,
                    padding: '2px 8px', borderRadius: 12, fontSize: 11,
                    background: 'var(--primary-bg)', color: 'var(--primary-color)',
                  }}>
                    #{tag}
                    <button onClick={() => handleRemoveTag(tag)} style={{
                      border: 'none', background: 'none', cursor: 'pointer',
                      color: 'var(--primary-color)', fontSize: 10, padding: 0, lineHeight: 1,
                    }}>×</button>
                  </span>
                ))}
              </div>
              <TagAutoComplete
                value={tagInput}
                onChange={setTagInput}
                onSelect={(tag) => {
                  if (!tags.includes(tag)) setTags([...tags, tag]);
                  setTagInput('');
                }}
                existingTags={existingTags}
                placeholder="输入标签..."
                onKeyDown={(e) => { if (e.key === 'Enter') { e.preventDefault(); handleAddTag(); } }}
                style={{ width: '100%' }}
              />
            </div>

            {/* 附件上传 + 表情 + 优先级 */}
            <div style={{ display: 'flex', gap: 16, alignItems: 'start' }}>
              {/* 附件上传 */}
              <div style={{ flex: 1 }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: 6, marginBottom: 8 }}>
                  <Upload size={13} style={{ color: 'var(--text-tertiary)' }} />
                  <span style={{ fontSize: 12, fontWeight: 600, color: 'var(--text-tertiary)', textTransform: 'uppercase', letterSpacing: 0.8 }}>附件</span>
                  <span style={{ fontSize: 11, color: 'var(--text-tertiary)', marginLeft: 4 }}>（最多1个）</span>
                </div>
                <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
                  {mediaFiles.map((file: any) => {
                    const fileUrl = (file.filePath || file.filepath) ? toMediaUrl(file.filePath || file.filepath) : '';
                    return (
                      <div key={file.id} style={{ position: 'relative', width: 80, height: 80, borderRadius: 8, overflow: 'hidden', background: 'var(--bg-tertiary)' }}>
                        {file.mimeType?.startsWith('image/') ? (
                          <img src={fileUrl} alt="" style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
                        ) : file.mimeType?.startsWith('video/') ? (
                          <VideoThumbnailImg
                            filePath={file.filePath || file.filepath || ''}
                            style={{ width: '100%', height: '100%', objectFit: 'cover' }}
                            fallback={
                              <div style={{ width: '100%', height: '100%', display: 'flex', alignItems: 'center', justifyContent: 'center', background: 'linear-gradient(135deg, #fa709a, #fee140)' }}>
                                <Video size={24} style={{ color: 'white' }} />
                              </div>
                            }
                          />
                        ) : (
                          <div style={{ width: '100%', height: '100%', display: 'flex', alignItems: 'center', justifyContent: 'center', background: 'linear-gradient(135deg, #4facfe, #00f2fe)' }}>
                            <Mic size={24} style={{ color: 'white' }} />
                          </div>
                        )}
                        <button onClick={() => {
                          setPendingMediaDeletions(prev => [...prev, file.id]);
                          setMediaFiles(prev => prev.filter(f => f.id !== file.id));
                          setDirty(true);
                          setType('text');
                        }} style={{
                          position: 'absolute', top: 2, right: 2, width: 20, height: 20,
                          borderRadius: '50%', border: 'none', background: 'rgba(0,0,0,0.6)',
                          color: 'white', display: 'flex', alignItems: 'center', justifyContent: 'center',
                          cursor: 'pointer', fontSize: 10,
                        }}>
                          <X size={10} />
                        </button>
                      </div>
                    );
                  })}
                  {mediaFiles.length === 0 && (
                  <button onClick={async () => {
                    const result = await api.media.selectFile({ creativityId: creativity?.id });
                    if (result?.success) {
                      if (creativity?.id) {
                        const files = await api.media.listByCreativity(creativity.id);
                        setMediaFiles(files || []);
                        registerMediaPaths(files || []);
                        if (files && files.length > 0) {
                          const mimeType = files[0].mimeType || files[0].mime_type || '';
                          let detectedType: Creativity['type'] = 'document';
                          if (mimeType.startsWith('image/')) detectedType = 'image';
                          else if (mimeType.startsWith('video/')) detectedType = 'video';
                          else if (mimeType.startsWith('audio/')) detectedType = 'audio';
                          setType(detectedType);
                        }
                      } else {
                        if (result.data && Array.isArray(result.data)) {
                          const singleFile = result.data[0] ? [result.data[0]] : [];
                          const file = singleFile[0];
                          setMediaFiles(singleFile);
                          registerMediaPaths(singleFile);
                          for (const f of singleFile) {
                            if (f.id) useUIStore.getState().addPendingMediaId(f.id);
                          }
                          if (file) {
                            const mimeType = file.mimeType || file.mime_type || '';
                            let detectedType: Creativity['type'] = 'document';
                            if (mimeType.startsWith('image/')) detectedType = 'image';
                            else if (mimeType.startsWith('video/')) detectedType = 'video';
                            else if (mimeType.startsWith('audio/')) detectedType = 'audio';
                            setType(detectedType);
                          }
                        }
                      }
                      if (result.data && Array.isArray(result.data) && result.data.length > 0) {
                        const firstFile = result.data[0];
                        if (!content.trim() && firstFile.id) {
                          setDirty(true);
                        }
                      }
                    }
                  }} style={{
                    width: 80, height: 80, borderRadius: 8, border: '2px dashed var(--border-color)',
                    display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center',
                    gap: 4, cursor: 'pointer', background: 'transparent', color: 'var(--text-tertiary)',
                    transition: 'all 0.2s ease',
                  }}
                  onMouseEnter={(e) => { (e.currentTarget as HTMLElement).style.borderColor = 'var(--primary-color)'; (e.currentTarget as HTMLElement).style.color = 'var(--primary-color)'; }}
                  onMouseLeave={(e) => { (e.currentTarget as HTMLElement).style.borderColor = 'var(--border-color)'; (e.currentTarget as HTMLElement).style.color = 'var(--text-tertiary)'; }}
                  >
                    <Plus size={20} />
                    <span style={{ fontSize: 10 }}>添加</span>
                  </button>
                  )}
                </div>
              </div>

              {/* Emoji */}
              <div>
                <Popover
                  trigger="click"
                  placement="bottomLeft"
                  content={
                    <div style={{ display: 'grid', gridTemplateColumns: 'repeat(6, 1fr)', gap: 2 }}>
                      {EMOJI_REACTIONS.map((emoji) => (
                        <button key={emoji} onClick={() => { setEmojiReaction(emoji === emojiReaction ? null : emoji); }} style={{
                          width: 32, height: 32, display: 'flex', alignItems: 'center', justifyContent: 'center',
                          borderRadius: 6, border: 'none', background: emoji === emojiReaction ? 'var(--primary-bg)' : 'transparent',
                          cursor: 'pointer', transition: 'all 0.1s ease',
                        }} onMouseEnter={(e) => { if (emoji !== emojiReaction) (e.currentTarget as HTMLElement).style.background = 'var(--bg-hover)'; }} onMouseLeave={(e) => { if (emoji !== emojiReaction) (e.currentTarget as HTMLElement).style.background = 'transparent'; }}>
                          <EmojiIcon id={emoji} size={22} />
                        </button>
                      ))}
                    </div>
                  }
                >
                  <button style={{
                    display: 'flex', alignItems: 'center', gap: 8, width: '100%',
                    padding: '7px 12px', borderRadius: 8, border: '1px solid var(--border-color)',
                    background: 'var(--bg-primary)', color: emojiReaction ? 'var(--text-primary)' : 'var(--text-tertiary)',
                    fontSize: 14, cursor: 'pointer', transition: 'all 0.15s ease',
                  }}>
                    {emojiReaction ? <EmojiIcon id={emojiReaction} size={18} /> : <><Smile size={14} style={{ opacity: 0.4 }} /><span style={{ fontSize: 13 }}>选择表情</span></>}
                    <ChevronDown size={12} style={{ marginLeft: 'auto', opacity: 0.4 }} />
                  </button>
                </Popover>
              </div>

              {/* 优先级 */}
              <div>
                <div style={{ display: 'flex', alignItems: 'center', gap: 6, marginBottom: 8 }}>
                  <ShootingStar size={13} style={{ color: 'var(--text-tertiary)' }} />
                  <span style={{ fontSize: 12, fontWeight: 600, color: 'var(--text-tertiary)', textTransform: 'uppercase', letterSpacing: 0.8 }}>优先级</span>
                </div>
                <Rate count={5} value={priority} onChange={(val) => setPriority(val ?? 0)} allowClear />
              </div>
            </div>
          </div>

          {/* ===== 底部操作栏 ===== */}
          {!isFullscreen && (
            <div style={{
              display: 'flex', alignItems: 'center', justifyContent: 'space-between',
              padding: '12px 24px', borderTop: '1px solid var(--border-light)',
              background: 'var(--bg-primary)', flexShrink: 0,
            }}>
              {isEditing && (
                <Popconfirm
                  title="确定删除此创意？"
                  description="删除后无法恢复"
                  onConfirm={async () => {
                    try {
                      await api.creativity.delete(creativity!.id);
                      onClose();
                    } catch (e) {
                      console.error('[CardEditor] 删除失败:', e);
                    }
                  }}
                  okText="确定删除"
                  cancelText="取消"
                  okButtonProps={{ danger: true }}
                >
                  <button style={{
                    display: 'flex', alignItems: 'center', gap: 6, padding: '7px 14px', borderRadius: 8,
                    border: 'none', background: 'transparent', color: 'var(--text-tertiary)',
                    fontSize: 13, fontWeight: 500, cursor: 'pointer', transition: 'all 0.15s ease',
                  }} onMouseEnter={(e) => { (e.currentTarget as HTMLElement).style.color = '#ef4444'; (e.currentTarget as HTMLElement).style.background = 'rgba(239,68,68,0.08)'; }} onMouseLeave={(e) => { (e.currentTarget as HTMLElement).style.color = 'var(--text-tertiary)'; (e.currentTarget as HTMLElement).style.background = 'transparent'; }}>
                    <Trash2 size={14} />删除
                  </button>
                </Popconfirm>
              )}
              {!isEditing && <div />}
              <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                <button onClick={handleClose} style={{
                  padding: '8px 18px', borderRadius: 10, border: '1px solid var(--border-color)',
                  background: 'transparent', color: 'var(--text-secondary)', fontSize: 13,
                  fontWeight: 500, cursor: 'pointer', transition: 'all 0.15s ease',
                }} onMouseEnter={(e) => { const el = e.currentTarget as HTMLElement; el.style.background = 'var(--bg-hover)'; }} onMouseLeave={(e) => { const el = e.currentTarget as HTMLElement; el.style.background = 'transparent'; }}>
                  取消
                </button>
                <button onClick={handleSave} disabled={!canSave || isSaving} style={{
                  display: 'flex', alignItems: 'center', gap: 7, padding: '8px 22px', borderRadius: 10,
                  border: 'none', background: !canSave || isSaving ? 'var(--text-tertiary)' : 'linear-gradient(135deg, var(--primary-color), var(--primary-hover))',
                  color: 'white', fontSize: 13, fontWeight: 600, cursor: !canSave || isSaving ? 'not-allowed' : 'pointer',
                  boxShadow: !canSave || isSaving ? 'none' : '0 2px 12px rgba(var(--primary-rgb, 99,102,241), 0.3)',
                  transition: 'all 0.2s ease', letterSpacing: 0.3,
                }} onMouseEnter={(e) => { if (canSave && !isSaving) { (e.currentTarget as HTMLElement).style.transform = 'translateY(-1px)'; (e.currentTarget as HTMLElement).style.boxShadow = '0 4px 16px rgba(var(--primary-rgb, 99,102,241), 0.4)'; } }} onMouseLeave={(e) => { (e.currentTarget as HTMLElement).style.transform = 'translateY(0)'; (e.currentTarget as HTMLElement).style.boxShadow = '0 2px 12px rgba(var(--primary-rgb, 99,102,241), 0.3)'; }}>
                  <Save size={14} />{isSaving ? '保存中...' : '保存创意'}
                </button>
              </div>
            </div>
          )}
        </div>
      )}

      {/* 调整大小手柄 */}
      {!isMinimized && !isFullscreen && (
        <div onMouseDown={handleResizeStart} style={{
          position: 'absolute', right: 0, bottom: 0, width: 18, height: 18,
          cursor: 'nwse-resize', zIndex: 10,
        }} />
      )}

      {/* 内联确认取消对话框 - 渲染在 CardEditor 内部以避免层叠上下文问题 */}
      <AnimatePresence>
        {showConfirmCancel && (
          <>
            {/* 半透明遮罩 - 不使用 backdrop-filter 避免毛玻璃效果 */}
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              transition={{ duration: 0.15 }}
              onClick={() => setShowConfirmCancel(false)}
              style={{
                position: 'fixed',
                inset: 0,
                zIndex: 100,
                background: 'rgba(0, 0, 0, 0.25)',
              }}
            />
            {/* 确认对话框 - 使用 fixed 定位确保在视口居中 */}
            <motion.div
              initial={{ opacity: 0, scale: 0.95, y: 8 }}
              animate={{ opacity: 1, scale: 1, y: 0 }}
              exit={{ opacity: 0, scale: 0.95, y: 8 }}
              transition={{ duration: 0.15 }}
              style={{
                position: 'fixed',
                top: '50%',
                left: '50%',
                transform: 'translate(-50%, -50%)',
                zIndex: 101,
                background: 'var(--bg-secondary)',
                borderRadius: 16,
                padding: '24px 28px',
                boxShadow: '0 20px 60px rgba(0,0,0,0.3), 0 0 0 1px var(--border-color)',
                minWidth: 320,
                maxWidth: 400,
              }}
            >
              <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 12 }}>
                <div style={{
                  width: 32, height: 32, borderRadius: 10,
                  background: 'linear-gradient(135deg, #f59e0b, #f97316)',
                  display: 'flex', alignItems: 'center', justifyContent: 'center',
                  flexShrink: 0,
                }}>
                  <span style={{ fontSize: 16 }}>⚠</span>
                </div>
                <span style={{ fontSize: 15, fontWeight: 600, color: 'var(--text-primary)' }}>未保存的更改</span>
              </div>
              <p style={{ fontSize: 13, color: 'var(--text-secondary)', margin: '0 0 20px 0', lineHeight: 1.6 }}>
                有未保存的更改，确定关闭吗？
              </p>
              <div style={{ display: 'flex', justifyContent: 'flex-end', gap: 10 }}>
                <button
                  onClick={() => setShowConfirmCancel(false)}
                  style={{
                    padding: '7px 18px', borderRadius: 10,
                    border: '1px solid var(--border-color)',
                    background: 'transparent', color: 'var(--text-secondary)',
                    fontSize: 13, fontWeight: 500, cursor: 'pointer',
                    transition: 'all 0.15s ease',
                  }}
                  onMouseEnter={(e) => { (e.currentTarget as HTMLElement).style.background = 'var(--bg-hover)'; }}
                  onMouseLeave={(e) => { (e.currentTarget as HTMLElement).style.background = 'transparent'; }}
                >
                  继续编辑
                </button>
                <button
                  onClick={() => { setShowConfirmCancel(false); onClose(); }}
                  style={{
                    padding: '7px 18px', borderRadius: 10,
                    border: 'none',
                    background: '#ef4444', color: 'white',
                    fontSize: 13, fontWeight: 600, cursor: 'pointer',
                    boxShadow: '0 2px 10px rgba(239,68,68,0.3)',
                    transition: 'all 0.15s ease',
                  }}
                  onMouseEnter={(e) => { (e.currentTarget as HTMLElement).style.background = '#dc2626'; }}
                  onMouseLeave={(e) => { (e.currentTarget as HTMLElement).style.background = '#ef4444'; }}
                >
                  确定关闭
                </button>
              </div>
            </motion.div>
          </>
        )}
      </AnimatePresence>
    </div>
  );
};

export default CardEditor;
