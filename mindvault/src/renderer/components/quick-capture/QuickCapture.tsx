import React, { useState, useEffect, useRef, useCallback } from 'react';
import { motion } from 'framer-motion';
import { X, Zap, Type, Image, Mic, Link, Video, Tag, Save, Paperclip, Lightbulb, RefreshCw, Square, Pause, Play, RotateCcw, Upload, Plus, FileText, Star, Heart } from 'lucide-react';
import type { Creativity } from '@shared/types';
import { CREATIVITY_TYPES, EMOJI_REACTIONS, STICKY_COLORS } from '@shared/constants';
import { getAllSubtypes, SUBTYPE_CONFIG, removeCustomSubtype, addCustomSubtype } from '@shared/types';
import EmojiIcon from '../common/EmojiIcon';
import { useUIStore } from '../../stores/uiStore';
import { useSettingsStore } from '../../stores/settingsStore';
import TagAutoComplete from '../common/TagAutoComplete';
import { Alert, Tooltip, Rate } from 'antd';
import { useAudioRecorder } from '../../hooks/useAudioRecorder';
import { api } from '../../utils/api';
import { toMediaUrl, registerMediaPaths } from '../../utils/media';
import VideoThumbnailImg from '../common/VideoThumbnailImg';
import MDEditor from '@uiw/react-md-editor';
import { useMarkdownWordCount } from '../../hooks/useMarkdownWordCount';

// ===== 类型定义 =====

// 灵感提示词列表
const INSPIRATION_PROMPTS = [
  '如果我可以改变世界的一件事...',
  '今天最让我意外的事情是...',
  '我最近学到的一个新概念是...',
  '如果我有无限资源，我会...',
  '这个世界上最被低估的事物是...',
  '如果时间可以倒流，我想...',
  '我理想中的工作日常是...',
  '最近让我印象深刻的一个设计是...',
  '如果我要写一本书，主题会是...',
  '下一个十年，我最想实现的目标是...',
  '如果我能和任何人共进晚餐，我会选择...',
  '最近让我感到好奇的一个问题是...',
  '如果我可以拥有一种超能力，我希望是...',
  '我最近在思考的一个有趣想法是...',
  '如果让我重新定义成功，我会说...',
];

/** 获取随机灵感提示词（排除当前显示的） */
function getRandomPrompt(currentPrompt?: string): string {
  const available = currentPrompt
    ? INSPIRATION_PROMPTS.filter(p => p !== currentPrompt)
    : INSPIRATION_PROMPTS;
  return available[Math.floor(Math.random() * available.length)];
}

interface QuickCaptureProps {
  isOpen: boolean;
  onClose: () => void;
  onSave: (data: {
    title: string;
    content: string;
    type: Creativity['type'];
    tags?: string[];
    emojiReaction?: string | null;
    mediaRef?: any;
    contentFormat?: 'plain' | 'markdown';
    mediaFiles?: any[];
    subtype?: string;
    cardStyle?: string | null;
    priority?: number;
    isFavorite?: boolean;
  }) => Promise<boolean>;
}

// ===== 组件 =====

const QuickCapture: React.FC<QuickCaptureProps> = ({
  isOpen,
  onClose,
  onSave,
}) => {
  const [title, setTitle] = useState('');
  const [content, setContent] = useState('');
  const [type, setType] = useState<Creativity['type']>('text');
  const [tags, setTags] = useState<string[]>([]);
  const [tagInput, setTagInput] = useState('');
  const [emojiReaction, setEmojiReaction] = useState<string | null>(null);
  const [isSaving, setIsSaving] = useState(false);
  const [showEmojiPicker, setShowEmojiPicker] = useState(false);
  const [inspirationPrompt, setInspirationPrompt] = useState(() => getRandomPrompt());
  const [isPlayingAudio, setIsPlayingAudio] = useState(false);
  const audioPlaybackRef = useRef<HTMLAudioElement | null>(null);
  const [selectedMediaFiles, setSelectedMediaFiles] = useState<any[]>([]);
  const [cardColor, setCardColor] = useState<string | null>(null);
  const [subtype, setSubtype] = useState<string | undefined>(undefined);
  const [isAddingCustomSubtype, setIsAddingCustomSubtype] = useState(false);
  const [customSubtypeInput, setCustomSubtypeInput] = useState('');
  const [priority, setPriority] = useState(0);
  const [isFavorite, setIsFavorite] = useState(false);
  const [existingTags, setExistingTags] = useState<string[]>([]);
  const [showTagSuggestions, setShowTagSuggestions] = useState(false);

  useEffect(() => {
    if (isOpen) {
      api.tag.list().then((result) => {
        if (result) setExistingTags(result.map((t: any) => t.name || t));
      }).catch(() => {});
    }
  }, [isOpen]);

  // 字数统计
  const { wordCount, charCount } = useMarkdownWordCount(content);

  const {
    isRecording,
    isPaused,
    duration: recordingDuration,
    audioBlob,
    audioUrl,
    error: audioError,
    startRecording,
    stopRecording,
    pauseRecording,
    resumeRecording,
    resetRecording,
    volumeLevels, // 新增
    clearError, // 新增
  } = useAudioRecorder();
  
  // 获取设置中的音频设备
  const { settings } = useSettingsStore();

  // 包装录音开始函数，确保设置 type 为 audio
  const handleStartRecording = useCallback(async () => {
    setType('audio');
    setSelectedMediaFiles([]); // 开始录音时先清空之前的媒体文件
    await startRecording(settings.audioInputDeviceId);
  }, [startRecording, settings.audioInputDeviceId]);

  // 包装重置录音函数，确保清空媒体文件
  const handleResetRecording = useCallback(() => {
    resetRecording();
    setSelectedMediaFiles([]);
  }, [resetRecording]);

  const titleRef = useRef<HTMLInputElement>(null);
  const selectedTemplate = useUIStore((s) => s.selectedTemplate);
  const setSelectedTemplate = useUIStore((s) => s.setSelectedTemplate);
  const pendingFiles = useUIStore((s) => s.pendingFiles);
  const clearPendingFiles = useUIStore((s) => s.clearPendingFiles);

  // 根据文件名获取文件类型
  const getFileType = (fileName: string): string => {
    const ext = fileName.split('.').pop()?.toLowerCase() || '';
    if (['png', 'jpg', 'jpeg', 'gif', 'webp', 'bmp', 'svg'].includes(ext)) return 'image';
    if (['mp4', 'webm', 'mov', 'avi', 'mkv'].includes(ext)) return 'video';
    if (['mp3', 'wav', 'ogg', 'flac', 'aac', 'm4a'].includes(ext)) return 'audio';
    if (['txt', 'md', 'markdown', 'json', 'csv', 'xml', 'html', 'log'].includes(ext)) return 'text';
    return 'text';
  };

  // 打开时聚焦标题，如果有模板则预填；如果有拖拽文件则预填文件名
  useEffect(() => {
    if (isOpen) {
      // 每次打开弹窗时刷新灵感提示词
      setInspirationPrompt(getRandomPrompt());
      if (selectedTemplate) {
        setTitle(selectedTemplate.name || '');
        setContent(selectedTemplate.description || '');
        setType('text');
        setSelectedMediaFiles([]);
      } else if (pendingFiles.length > 0) {
        // 预填标题为第一个文件名（去掉扩展名）
        const firstFile = pendingFiles[0] as File;
        const firstName = firstFile.name.replace(/\.[^.]+$/, '');
        setTitle(firstName);
        setContent('');
        
        // 根据文件类型自动设置创意类型
        const fileType = getFileType(firstFile.name);
        setType(fileType as any);
        
        // 如果是媒体文件，先尝试读取并保存到媒体库，然后添加到 selectedMediaFiles
        (async () => {
          try {
            if (fileType === 'image' || fileType === 'video' || fileType === 'audio' || fileType === 'document') {
              let mediaResult: any = null;
              try {
                const filePath = api.file.getPathForFile(firstFile);
                if (filePath) {
                  mediaResult = await api.media.importFromPath(filePath, { fileType: fileType as any, fileName: firstFile.name });
                }
              } catch {}

              if (!mediaResult || mediaResult.success === false) {
                const arrayBuffer = await firstFile.arrayBuffer();
                const uint8Array = new Uint8Array(arrayBuffer);
                mediaResult = await api.media.save({
                  fileName: firstFile.name,
                  fileType: fileType as any,
                  data: uint8Array,
                });
              }

              if (mediaResult && mediaResult.success !== false) {
                const mediaData = mediaResult.data || mediaResult;
                if (mediaData) {
                  setSelectedMediaFiles([mediaData]);
                }
              }
            } else if (fileType === 'text') {
              // 对于文本文件，读取内容填入编辑器
              try {
                const textContent = await firstFile.text();
                setContent(textContent);
              } catch {
                // 读取失败就留空
              }
            }
          } catch (err) {
            console.error('[QuickCapture] 处理拖入文件失败:', err);
          }
        })();
      } else {
        setTitle('');
        setContent('');
        setType('text');
        setSelectedMediaFiles([]);
      }
      setTags([]);
      setTagInput('');
      setEmojiReaction(null);
      setCardColor(null);
      setSubtype(undefined);
      setIsAddingCustomSubtype(false);
      setCustomSubtypeInput('');
      setPriority(0);
      setIsFavorite(false);
      setShowTagSuggestions(false);
      setTimeout(() => titleRef.current?.focus(), 100);
    } else {
      setTitle('');
      setContent('');
      setType('text');
      setTags([]);
      setTagInput('');
      setEmojiReaction(null);
      setCardColor(null);
      setSubtype(undefined);
      setIsAddingCustomSubtype(false);
      setCustomSubtypeInput('');
      setPriority(0);
      setIsFavorite(false);
      setShowTagSuggestions(false);
      setSelectedMediaFiles([]);
      setSelectedTemplate(null);
      clearPendingFiles();
      resetRecording();
      clearError(); // 清除之前的错误
      setIsPlayingAudio(false);
      if (audioPlaybackRef.current) {
        audioPlaybackRef.current.pause();
        audioPlaybackRef.current = null;
      }
    }
  }, [isOpen, selectedTemplate, setSelectedTemplate, pendingFiles, clearPendingFiles, resetRecording, clearError]);

  // ESC 关闭
  useEffect(() => {
    const handleEsc = (e: KeyboardEvent) => {
      if (e.key === 'Escape' && isOpen) onClose();
    };
    document.addEventListener('keydown', handleEsc);
    return () => document.removeEventListener('keydown', handleEsc);
  }, [isOpen, onClose]);

  // 录音结束后自动保存到媒体库并添加到 selectedMediaFiles
  useEffect(() => {
    if (audioBlob && isOpen) {
      (async () => {
        try {
          console.log('[QuickCapture] Saving audio blob, size:', audioBlob.size, 'type:', audioBlob.type);
          
          // 使用从 MediaRecorder 获取的实际类型，如果没有则使用默认值
          const blobType = audioBlob.type || 'audio/webm';
          const file = new File([audioBlob], `recording-${Date.now()}.webm`, { type: blobType });
          const arrayBuffer = await file.arrayBuffer();
          const uint8Array = new Uint8Array(arrayBuffer);
          
          console.log('[QuickCapture] Calling api.media.save with file type: audio');
          const mediaResult = await api.media.save({
            fileName: file.name,
            fileType: 'audio',
            data: uint8Array,
          });
          
          console.log('[QuickCapture] api.media.save result:', mediaResult);
          
          if (mediaResult && mediaResult.success !== false) {
            let mediaData = mediaResult.data || mediaResult;
            if (mediaData) {
              // 确保音频文件有正确的 mimeType
              mediaData = {
                ...mediaData,
                mimeType: blobType,
              };
              setSelectedMediaFiles([mediaData]);
              registerMediaPaths([mediaData]);
            }
          }
        } catch (err) {
          console.error('[QuickCapture] Error saving recording:', err);
          useUIStore.getState().showToast('error', '录音保存失败');
        }
      })();
    }
  }, [audioBlob, isOpen]);

  useEffect(() => {
    if (!isOpen) return;
    const handlePaste = async (e: ClipboardEvent) => {
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
        });
        if (result && result.success !== false) {
          const mediaData = result.data || result;
          setType('image');
          if (mediaData) {
            setSelectedMediaFiles([mediaData]);
            registerMediaPaths([mediaData]);
          }
          if (!title.trim()) {
            setTitle('剪贴板图片');
          }
          useUIStore.getState().showToast('success', '图片已粘贴');
        }
      } catch {
        useUIStore.getState().showNotification('error', '粘贴图片失败', '请检查剪贴板中的图片数据');
      }
    };
    document.addEventListener('paste', handlePaste);
    return () => document.removeEventListener('paste', handlePaste);
  }, [isOpen, content, title]);

  // 添加标签
  const handleAddTag = useCallback(() => {
    const trimmed = tagInput.trim();
    if (trimmed && !tags.includes(trimmed)) {
      setTags([...tags, trimmed]);
      setTagInput('');
    }
  }, [tagInput, tags]);

  // 保存
  const handleSave = async () => {
    if (!title.trim() && !content.trim() && !audioBlob && selectedMediaFiles.length === 0) return;
    setIsSaving(true);
    try {
      let mediaRef: any = null;
      // 使用 selectedMediaFiles 中的媒体，避免重复保存录音
      if (selectedMediaFiles.length > 0) {
        mediaRef = selectedMediaFiles[0];
      }
      let saveContent = content.trim();

      const success = await onSave({
        title: title.trim(),
        content: saveContent,
        type,
        tags,
        emojiReaction,
        mediaRef,
        contentFormat: 'markdown',
        mediaFiles: selectedMediaFiles,
        subtype,
        cardStyle: cardColor ? JSON.stringify({ color: cardColor }) : null,
        priority,
        isFavorite,
      });
      if (success) {
        useUIStore.getState().showToast('success', '创意已保存');
        onClose();
      }
    } finally {
      setIsSaving(false);
    }
  };

  // Ctrl+Enter 保存
  const handleKeyDown = useCallback(
    (e: React.KeyboardEvent) => {
      if ((e.ctrlKey || e.metaKey) && e.key === 'Enter') {
        e.preventDefault();
        handleSave();
      }
    },
    [handleSave]
  );

  // 类型图标映射
  const typeIcons: Record<string, React.ReactNode> = {
    text: <Type size={14} />,
    image: <Image size={14} />,
    audio: <Mic size={14} />,
    link: <Link size={14} />,
    video: <Video size={14} />,
    document: <FileText size={14} />,
  };

  if (!isOpen) return null;

  return (
    <div
      style={{
        position: 'fixed',
        inset: 0,
        zIndex: 200,
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        padding: 16,
      }}
    >
      {/* 遮罩 */}
      <div
        style={{
          position: 'absolute',
          inset: 0,
          backgroundColor: 'rgba(0,0,0,0.3)',
          backdropFilter: 'blur(4px)',
        }}
        onClick={onClose}
      />

      {/* 弹窗主体 */}
      <motion.div
        initial={{ opacity: 0, scale: 0.9, y: 40 }}
        animate={{ opacity: 1, scale: 1, y: 0 }}
        exit={{ opacity: 0, scale: 0.95, y: 20 }}
        transition={{ type: 'spring', damping: 25, stiffness: 350 }}
        style={{
          position: 'relative',
          width: 'min(448px, calc(100vw - 32px))',
          maxHeight: 'calc(100vh - 32px)',
          backgroundColor: 'var(--bg-secondary)',
          borderRadius: 'var(--radius-xl)',
          borderTop: '1px solid rgba(255,255,255,0.06)',
          borderLeft: '1px solid rgba(0,0,0,0.06)',
          borderRight: '1px solid rgba(0,0,0,0.12)',
          borderBottom: '2px solid rgba(0,0,0,0.15)',
          boxShadow: '0 6px 0 0 rgba(0,0,0,0.1), 2px 6px 0 0 rgba(0,0,0,0.05), -2px 6px 0 0 rgba(0,0,0,0.05), 0 12px 40px rgba(0,0,0,0.25), inset 0 1px 0 rgba(255,255,255,0.06)',
          overflow: 'hidden',
          display: 'flex',
          flexDirection: 'column',
        }}
        onKeyDown={handleKeyDown}
      >
        {/* 头部 */}
        <div style={{
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          padding: '12px 20px',
          borderBottom: '1px solid var(--border-light)',
        }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
            <Zap size={18} color="var(--primary-color)" />
            <h2 style={{ fontSize: 15, fontWeight: 600, color: 'var(--text-primary)', margin: 0 }}>
              新建创意
            </h2>
          </div>
          <kbd
            tabIndex={0}
            onClick={onClose}
            style={{
              padding: '2px 8px',
              borderRadius: 4,
              backgroundColor: 'var(--bg-secondary)',
              color: 'var(--text-tertiary)',
              fontSize: 11,
              fontWeight: 600,
              fontFamily: 'monospace',
              flexShrink: 0,
              borderWidth: '1px 1px 2px',
              borderStyle: 'solid',
              borderColor: 'rgba(255,255,255,0.15) rgba(0,0,0,0.08) rgba(0,0,0,0.12) rgba(255,255,255,0.1)',
              boxShadow: 'rgba(0,0,0,0.08) 0px 2px 0px, rgba(255,255,255,0.1) 0px 1px 0px inset',
              display: 'inline-block',
              cursor: 'pointer',
            }}
          >
            ESC
          </kbd>
        </div>

        {/* 内容 */}
        <div style={{ padding: '16px 20px', display: 'flex', flexDirection: 'column', gap: 12, flex: 1, overflowY: 'auto', minHeight: 0 }}>
          {/* 灵感提示区域 */}
          <div
            onClick={() => setInspirationPrompt(getRandomPrompt(inspirationPrompt))}
            style={{
              display: 'flex',
              alignItems: 'center',
              gap: 10,
              padding: '10px 14px',
              borderRadius: 'var(--radius-md)',
              backgroundColor: 'var(--primary-bg)',
              border: '1px dashed var(--primary-color)',
              cursor: 'pointer',
              transition: 'background-color 0.15s ease',
            }}
          >
            <Lightbulb size={16} color="var(--primary-color)" style={{ flexShrink: 0 }} />
            <span style={{
              fontSize: 13,
              color: 'var(--primary-color)',
              fontWeight: 500,
              flex: 1,
              lineHeight: 1.4,
            }}>
              {inspirationPrompt}
            </span>
            <RefreshCw size={14} color="var(--primary-color)" style={{ flexShrink: 0, opacity: 0.6 }} />
          </div>

          {/* 标题 */}
          <input
            ref={titleRef}
            type="text"
            value={title}
            onChange={(e) => setTitle(e.target.value)}
            placeholder="创意标题（可选）"
            style={{
              width: '100%',
              padding: '8px 12px',
              borderRadius: 'var(--radius-md)',
              border: '1px solid var(--border-color)',
              borderTopColor: 'rgba(0,0,0,0.15)',
              borderLeftColor: 'rgba(0,0,0,0.1)',
              borderRightColor: 'rgba(255,255,255,0.08)',
              borderBottomColor: 'rgba(255,255,255,0.12)',
              backgroundColor: 'var(--bg-primary)',
              color: 'var(--text-primary)',
              fontSize: 14,
              outline: 'none',
              boxShadow: 'inset 0 2px 4px rgba(0,0,0,0.08), inset 0 1px 2px rgba(0,0,0,0.06)',
            }}
          />

          {/* 拖拽文件预览 */}
      {(pendingFiles.length > 0 || selectedMediaFiles.length > 0) && (
        <div style={{
          display: 'flex',
          flexDirection: 'column',
          gap: 8,
        }}>
          {selectedMediaFiles.length > 0 ? (
            <div style={{
              display: 'flex',
              gap: 8,
              flexWrap: 'wrap',
              padding: '8px',
              borderRadius: 'var(--radius-md)',
              backgroundColor: 'var(--primary-bg)',
            }}>
              {selectedMediaFiles.map((file: any, idx: number) => (
                <div key={idx} style={{
                  position: 'relative',
                  width: '100%',
                  maxWidth: 300,
                  borderRadius: 8,
                  overflow: 'hidden',
                  backgroundColor: 'var(--bg-tertiary)',
                }}>
                  {/* 图片预览 */}
                  {file.mimeType?.startsWith('image/') ? (
                    <img
                      src={toMediaUrl(file.filePath || file.file_path || '')}
                      alt={file.fileName || '图片'}
                      style={{
                        width: '100%',
                        height: 200,
                        objectFit: 'cover',
                      }}
                    />
                  ) : file.mimeType?.startsWith('video/') ? (
                    <VideoThumbnailImg
                      filePath={file.filePath || file.file_path || ''}
                      style={{ width: '100%', height: 200, objectFit: 'cover' }}
                      fallback={
                        <div style={{
                          width: '100%',
                          height: 200,
                          display: 'flex',
                          flexDirection: 'column',
                          alignItems: 'center',
                          justifyContent: 'center',
                          background: 'linear-gradient(135deg, #fa709a, #fee140)',
                        }}>
                          <Video size={36} style={{ color: 'white', marginBottom: 8 }} />
                          <span style={{ color: 'white', fontSize: 12 }}>
                            {file.fileName || '视频'}
                          </span>
                        </div>
                      }
                    />
                  ) : file.mimeType?.startsWith('audio/') ? (
                    <div style={{
                      width: '100%',
                      height: 120,
                      display: 'flex',
                      flexDirection: 'column',
                      alignItems: 'center',
                      justifyContent: 'center',
                      background: 'linear-gradient(135deg, #4facfe, #00f2fe)',
                    }}>
                      <Mic size={36} style={{ color: 'white', marginBottom: 8 }} />
                      <span style={{ color: 'white', fontSize: 12 }}>
                        {file.fileName || '音频'}
                      </span>
                    </div>
                  ) : (
                    <div style={{
                      width: '100%',
                      height: 100,
                      display: 'flex',
                      flexDirection: 'column',
                      alignItems: 'center',
                      justifyContent: 'center',
                      background: 'var(--bg-tertiary)',
                    }}>
                      <FileText size={36} style={{ color: 'var(--text-secondary)', marginBottom: 8 }} />
                      <span style={{ color: 'var(--text-secondary)', fontSize: 12 }}>
                        {file.fileName || '文件'}
                      </span>
                    </div>
                  )}
                </div>
              ))}
            </div>
          ) : (
            <div style={{
              display: 'flex',
              alignItems: 'center',
              gap: 6,
              padding: '6px 12px',
              borderRadius: 'var(--radius-md)',
              backgroundColor: 'var(--primary-bg)',
              fontSize: 12,
              color: 'var(--primary-color)',
            }}>
              <Paperclip size={14} />
              <span>已附加 {pendingFiles.length} 个文件</span>
              <span style={{ color: 'var(--text-tertiary)', marginLeft: 4 }}>
                ({pendingFiles.map((f: any) => f.name).join(', ')})
              </span>
            </div>
          )}
        </div>
      )}

          {/* 内容 */}
          <div style={{ width: '100%', borderRadius: 'var(--radius-md)', border: '1px solid var(--border-color)', borderTopColor: 'rgba(0,0,0,0.15)', borderLeftColor: 'rgba(0,0,0,0.1)', borderRightColor: 'rgba(255,255,255,0.08)', borderBottomColor: 'rgba(255,255,255,0.12)', overflow: 'hidden', boxShadow: 'inset 0 2px 4px rgba(0,0,0,0.08), inset 0 1px 2px rgba(0,0,0,0.06)' }}>
            <MDEditor
              value={content}
              onChange={(val) => setContent(val || '')}
              placeholder="记录你的灵感..."
              height={200}
              minHeight={150}
              maxHeight={350}
              preview="edit"
              visibleDragbar={false}
              hideToolbar={true}
              dataColorMode={document.documentElement.dataset.theme === 'dark' ? 'dark' : 'light'}
              style={{
                border: 'none',
                borderRadius: 0,
              }}
              textareaProps={{
                style: {
                  fontFamily: 'inherit',
                  fontSize: 14,
                },
              }}
            />
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '4px 12px', fontSize: 11, color: 'var(--text-tertiary)', borderTop: '1px solid var(--border-light)' }}>
              <span>字数: {wordCount} | 字符: {charCount}</span>
              {/* Emoji 按钮 */}
              <div style={{ position: 'relative' }}>
                <button
                  onClick={() => setShowEmojiPicker(!showEmojiPicker)}
                  style={{
                    padding: 4,
                    borderRadius: 'var(--radius-sm)',
                    border: 'none',
                    background: 'none',
                    cursor: 'pointer',
                    fontSize: 16,
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    width: 28,
                    height: 28,
                  }}
                >
                  {emojiReaction ? <EmojiIcon id={emojiReaction} size={20} /> : <EmojiIcon id="happy" size={20} style={{ opacity: 0.4 }} />}
                </button>
                {showEmojiPicker && (
                  <div style={{
                    position: 'absolute',
                    bottom: '100%',
                    right: 0,
                    marginBottom: 8,
                    padding: 8,
                    backgroundColor: 'var(--bg-secondary)',
                    border: '1px solid var(--border-color)',
                    borderRadius: 'var(--radius-lg)',
                    boxShadow: 'var(--shadow-lg)',
                    zIndex: 10,
                    display: 'grid',
                    gridTemplateColumns: 'repeat(6, 1fr)',
                    gap: 2,
                  }}>
                    {EMOJI_REACTIONS.map((emoji) => (
                      <button
                        key={emoji}
                        onClick={() => {
                          setEmojiReaction(emoji === emojiReaction ? null : emoji);
                          setShowEmojiPicker(false);
                        }}
                        style={{
                          width: 28,
                          height: 28,
                          display: 'flex',
                          alignItems: 'center',
                          justifyContent: 'center',
                          borderRadius: 'var(--radius-sm)',
                          border: 'none',
                          background: emoji === emojiReaction ? 'var(--primary-bg)' : 'none',
                          cursor: 'pointer',
                        }}
                      >
                        <EmojiIcon id={emoji} size={20} />
                      </button>
                    ))}
                  </div>
                )}
              </div>
            </div>
          </div>

          {/* 附件上传 + 音频录制 */}
          <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
            {selectedMediaFiles.length === 0 && !audioBlob && (
            <button
              onClick={async () => {
                const result = await api.media.selectFile({});
                if (result?.success && result.data) {
                  const newFiles = Array.isArray(result.data) ? result.data : [result.data];
                  const singleFile = newFiles[0] ? [newFiles[0]] : [];
                  const file = singleFile[0];
                  if (file) {
                    const mimeType = file.mimeType || file.mime_type || '';
                    let detectedType: Creativity['type'] = 'document';
                    if (mimeType.startsWith('image/')) detectedType = 'image';
                    else if (mimeType.startsWith('video/')) detectedType = 'video';
                    else if (mimeType.startsWith('audio/')) detectedType = 'audio';
                    setType(detectedType);
                    setSelectedMediaFiles(singleFile);
                    registerMediaPaths(singleFile);
                  }
                }
              }}
              style={{
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                gap: 6,
                padding: '8px 14px',
                borderRadius: 'var(--radius-sm)',
                border: '1.5px dashed var(--border-color)',
                background: 'transparent',
                color: 'var(--text-secondary)',
                fontSize: 12,
                cursor: 'pointer',
                transition: 'all 0.2s ease',
              }}
              onMouseEnter={(e) => {
                (e.currentTarget as HTMLElement).style.borderColor = 'var(--primary-color)';
                (e.currentTarget as HTMLElement).style.color = 'var(--primary-color)';
              }}
              onMouseLeave={(e) => {
                (e.currentTarget as HTMLElement).style.borderColor = 'var(--border-color)';
                (e.currentTarget as HTMLElement).style.color = 'var(--text-secondary)';
              }}
            >
              <Upload size={14} />
              添加附件
            </button>
            )}
            {selectedMediaFiles.length === 0 && !audioBlob && (
            <button
              onClick={handleStartRecording}
              style={{
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                gap: 6,
                padding: '8px 14px',
                borderRadius: 'var(--radius-sm)',
                border: '1.5px dashed var(--border-color)',
                background: 'transparent',
                color: 'var(--text-secondary)',
                fontSize: 12,
                cursor: 'pointer',
                transition: 'all 0.2s ease',
              }}
              onMouseEnter={(e) => {
                (e.currentTarget as HTMLElement).style.borderColor = 'var(--primary-color)';
                (e.currentTarget as HTMLElement).style.color = 'var(--primary-color)';
              }}
              onMouseLeave={(e) => {
                (e.currentTarget as HTMLElement).style.borderColor = 'var(--border-color)';
                (e.currentTarget as HTMLElement).style.color = 'var(--text-secondary)';
              }}
            >
              <Mic size={14} />
              录音
            </button>
            )}
            {selectedMediaFiles.length > 0 && (
              <div style={{ fontSize: 11, color: 'var(--text-tertiary)', display: 'flex', alignItems: 'center', gap: 4 }}>
                <span>已选择1个附件（最多1个）</span>
              </div>
            )}
          </div>

          {/* 已选文件预览 */}
          {selectedMediaFiles.length > 0 && (
            <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap' }}>
              {selectedMediaFiles.map((file: any, idx: number) => {
                const fileUrl = (file.filePath || file.filepath) ? toMediaUrl(file.filePath || file.filepath) : '';
                return (
                  <div key={file.id || idx} style={{ position: 'relative', width: 60, height: 60, borderRadius: 8, overflow: 'hidden', background: 'var(--bg-tertiary)' }}>
                    {file.mimeType?.startsWith('image/') ? (
                      <img src={fileUrl} alt="" style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
                    ) : file.mimeType?.startsWith('video/') ? (
                      <VideoThumbnailImg
                        filePath={file.filePath || file.file_path || ''}
                        style={{ width: '100%', height: '100%', objectFit: 'cover' }}
                        fallback={
                          <div style={{ width: '100%', height: '100%', display: 'flex', alignItems: 'center', justifyContent: 'center', background: 'linear-gradient(135deg, #fa709a, #fee140)' }}>
                            <Video size={18} style={{ color: 'white' }} />
                          </div>
                        }
                      />
                    ) : (
                      <div style={{ width: '100%', height: '100%', display: 'flex', alignItems: 'center', justifyContent: 'center', background: 'linear-gradient(135deg, #4facfe, #00f2fe)' }}>
                        <Mic size={18} style={{ color: 'white' }} />
                      </div>
                    )}
                    <button onClick={() => {
                      setSelectedMediaFiles([]);
                      setType('text');
                    }} style={{
                      position: 'absolute', top: 2, right: 2, width: 16, height: 16,
                      borderRadius: '50%', border: 'none', background: 'rgba(0,0,0,0.6)',
                      color: 'white', display: 'flex', alignItems: 'center', justifyContent: 'center',
                      cursor: 'pointer', fontSize: 8,
                    }}>
                      <X size={8} />
                    </button>
                  </div>
                );
              })}
            </div>
          )}

          {/* 音频录制面板 */}
          {type === 'audio' && !audioBlob && (
            <div style={{
              display: 'flex',
              flexDirection: 'column',
              gap: 10,
              padding: '12px 14px',
              borderRadius: 'var(--radius-md)',
              backgroundColor: 'var(--bg-tertiary)',
              border: '1px solid var(--border-light)',
            }}>
              {/* 录音错误提示 */}
              {audioError && (
                <Alert 
                  type="error" 
                  message={
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                      <span>{audioError}</span>
                      <button 
                        onClick={(e) => {
                          e.stopPropagation();
                          clearError();
                        }}
                        style={{
                          background: 'none',
                          border: 'none',
                          cursor: 'pointer',
                          padding: 0,
                          marginLeft: 8,
                          display: 'flex',
                          alignItems: 'center'
                        }}
                      >
                        <X size={14} color="var(--text-tertiary)" />
                      </button>
                    </div>
                  }
                  showIcon 
                  style={{ marginTop: 4 }} 
                />
              )}

              {/* 录音状态指示器 - 真实音量波形 */}
              <div style={{
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                gap: 2,
                height: 32,
              }}>
                {isRecording && !isPaused ? (
                  (volumeLevels.length > 0 ? volumeLevels : new Array(12).fill(0.1)).map((level, i) => (
                    <div
                      key={i}
                      style={{
                        width: 3,
                        height: Math.max(6, level * 30), // 最小6px，最大30px
                        borderRadius: 2,
                        backgroundColor: 'var(--danger-color, #ef4444)',
                        transition: 'height 0.05s ease-out',
                      }}
                    />
                  ))
                ) : isPaused ? (
                  Array.from({ length: 12 }).map((_, i) => (
                    <div
                      key={i}
                      style={{
                        width: 3,
                        height: 6,
                        borderRadius: 2,
                        backgroundColor: 'var(--text-tertiary)',
                      }}
                    />
                  ))
                ) : audioBlob ? (
                  Array.from({ length: 12 }).map((_, i) => (
                    <div
                      key={i}
                      style={{
                        width: 3,
                        height: 4 + Math.random() * 20,
                        borderRadius: 2,
                        backgroundColor: 'var(--primary-color)',
                        opacity: 0.6,
                      }}
                    />
                  ))
                ) : (
                  <Mic size={24} color="var(--text-tertiary)" />
                )}
              </div>

              {/* 录音时长 */}
              <div style={{
                textAlign: 'center',
                fontSize: 20,
                fontWeight: 600,
                color: isRecording ? 'var(--danger-color, #ef4444)' : 'var(--text-primary)',
                fontFamily: 'monospace',
                letterSpacing: 1,
              }}>
                {String(Math.floor(recordingDuration / 60)).padStart(2, '0')}:
                {String(recordingDuration % 60).padStart(2, '0')}
                {isRecording && !isPaused && (
                  <span style={{
                    display: 'inline-block',
                    width: 8,
                    height: 8,
                    borderRadius: '50%',
                    backgroundColor: 'var(--danger-color, #ef4444)',
                    marginLeft: 8,
                    verticalAlign: 'middle',
                    animation: 'pulse 1s ease-in-out infinite',
                  }} />
                )}
              </div>

              {/* 录音控制按钮 */}
              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 12 }}>
                {!isRecording && !audioBlob && (
                  <button
                    onClick={handleStartRecording}
                    style={{
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'center',
                      width: 48,
                      height: 48,
                      borderRadius: '50%',
                      border: 'none',
                      cursor: 'pointer',
                      backgroundColor: 'var(--danger-color, #ef4444)',
                      color: 'white',
                      boxShadow: '0 2px 12px rgba(239, 68, 68, 0.3)',
                    }}
                  >
                    <Mic size={20} />
                  </button>
                )}

                {isRecording && !isPaused && (
                  <>
                    <button
                      onClick={pauseRecording}
                      style={{
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'center',
                        width: 40,
                        height: 40,
                        borderRadius: '50%',
                        border: 'none',
                        cursor: 'pointer',
                        backgroundColor: 'var(--bg-secondary)',
                        color: 'var(--text-secondary)',
                      }}
                    >
                      <Pause size={20} />
                    </button>
                    <button
                      onClick={stopRecording}
                      style={{
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'center',
                        width: 48,
                        height: 48,
                        borderRadius: '50%',
                        border: 'none',
                        cursor: 'pointer',
                        backgroundColor: 'var(--danger-color, #ef4444)',
                        color: 'white',
                        boxShadow: '0 2px 12px rgba(239, 68, 68, 0.3)',
                      }}
                    >
                      <Square size={18} />
                    </button>
                  </>
                )}

                {isPaused && (
                  <>
                    <button
                      onClick={resumeRecording}
                      style={{
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'center',
                        width: 48,
                        height: 48,
                        borderRadius: '50%',
                        border: 'none',
                        cursor: 'pointer',
                        backgroundColor: 'var(--primary-color)',
                        color: 'white',
                      }}
                    >
                      <Play size={20} />
                    </button>
                    <button
                      onClick={stopRecording}
                      style={{
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'center',
                        width: 40,
                        height: 40,
                        borderRadius: '50%',
                        border: 'none',
                        cursor: 'pointer',
                        backgroundColor: 'var(--bg-secondary)',
                        color: 'var(--text-secondary)',
                      }}
                    >
                      <Square size={20} />
                    </button>
                  </>
                )}

                {audioBlob && !isRecording && (
                  <>
                    <button
                      onClick={() => {
                        if (audioUrl) {
                          if (audioPlaybackRef.current) {
                            audioPlaybackRef.current.pause();
                            audioPlaybackRef.current = null;
                            setIsPlayingAudio(false);
                          } else {
                            const audio = new Audio(audioUrl);
                            audio.onended = () => { setIsPlayingAudio(false); audioPlaybackRef.current = null; };
                            audioPlaybackRef.current = audio;
                            audio.play();
                            setIsPlayingAudio(true);
                          }
                        }
                      }}
                      style={{
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'center',
                        width: 48,
                        height: 48,
                        borderRadius: '50%',
                        border: 'none',
                        cursor: 'pointer',
                        backgroundColor: 'var(--primary-color)',
                        color: 'white',
                      }}
                    >
                      {isPlayingAudio ? <Pause size={20} /> : <Play size={20} />}
                    </button>
                    <Tooltip title="重新录制">
                      <button
                      onClick={() => {
                        if (audioPlaybackRef.current) {
                          audioPlaybackRef.current.pause();
                          audioPlaybackRef.current = null;
                          setIsPlayingAudio(false);
                        }
                        handleResetRecording();
                      }}
                      style={{
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'center',
                        width: 40,
                        height: 40,
                        borderRadius: '50%',
                        border: 'none',
                        cursor: 'pointer',
                        backgroundColor: 'var(--bg-secondary)',
                        color: 'var(--text-secondary)',
                      }}
                    >
                        <RotateCcw size={16} />
                    </button>
                    </Tooltip>
                  </>
                )}
              </div>

              {/* 录音完成后的时长显示 */}
              {audioBlob && !isRecording && (
                <div style={{
                  textAlign: 'center',
                  fontSize: 12,
                  color: 'var(--text-tertiary)',
                }}>
                  录音时长: {String(Math.floor(recordingDuration / 60)).padStart(2, '0')}:{String(recordingDuration % 60).padStart(2, '0')}
                </div>
              )}
            </div>
          )}

          {/* 标签 */}
          <div>
            <div style={{ display: 'flex', alignItems: 'center', gap: 6, marginBottom: 6 }}>
              <span style={{ fontSize: 11, fontWeight: 600, color: 'var(--text-tertiary)', textTransform: 'uppercase', letterSpacing: 0.8 }}>标签</span>
            </div>
            <div style={{ display: 'flex', flexWrap: 'wrap', gap: 4, marginBottom: 6 }}>
              {tags.map((tag) => (
                <span key={tag} style={{
                  display: 'inline-flex', alignItems: 'center', gap: 4,
                  padding: '2px 8px', borderRadius: 12, fontSize: 11,
                  background: 'var(--primary-bg)', color: 'var(--primary-color)',
                }}>
                  #{tag}
                  <button onClick={() => setTags(tags.filter(t => t !== tag))} style={{
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

          {/* 优先级和收藏 */}
          <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 4 }}>
              <span style={{ fontSize: 11, fontWeight: 600, color: 'var(--text-tertiary)', textTransform: 'uppercase', letterSpacing: 0.8, marginRight: 2 }}>优先级</span>
              <Rate count={5} value={priority} onChange={(val) => setPriority(val ?? 0)} allowClear />
            </div>
            <div style={{ width: 1, height: 16, background: 'var(--border-light)' }} />
            <button
              onClick={() => setIsFavorite(!isFavorite)}
              style={{
                display: 'flex', alignItems: 'center', gap: 4, padding: '3px 10px',
                borderRadius: 12, border: '1px solid', fontSize: 11, fontWeight: 500,
                cursor: 'pointer', transition: 'all 0.2s ease',
                borderColor: isFavorite ? '#EF4444' : 'var(--border-color)',
                color: isFavorite ? '#EF4444' : 'var(--text-tertiary)',
                background: isFavorite ? '#EF444412' : 'transparent',
              }}
            >
              <Heart size={11} fill={isFavorite ? '#EF4444' : 'none'} />
              收藏
            </button>
          </div>


        </div>

        {/* 底部 */}
        <div style={{
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          padding: '12px 20px',
          borderTop: '1px solid var(--border-light)',
        }}>
          <span style={{ fontSize: 11, color: 'var(--text-tertiary)' }}>
            Ctrl+Enter 快速录入 | ESC 关闭
          </span>
          <button
            onClick={handleSave}
            disabled={isSaving || (!title.trim() && !content.trim() && !audioBlob && selectedMediaFiles.length === 0)}
            style={{
              display: 'flex',
              alignItems: 'center',
              gap: 6,
              padding: '6px 16px',
              borderRadius: 'var(--radius-md)',
              fontSize: 14,
              fontWeight: 600,
              border: 'none',
              cursor: isSaving || (!title.trim() && !content.trim() && !audioBlob) ? 'not-allowed' : 'pointer',
              backgroundColor: 'var(--primary-color)',
              color: 'white',
              opacity: isSaving || (!title.trim() && !content.trim() && !audioBlob) ? 0.5 : 1,
            }}
          >
            <Save size={14} />
            {isSaving ? '录入中...' : '录入'}
          </button>
        </div>
      </motion.div>
    </div>
  );
};

export default QuickCapture;
