import React, { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { X, Type, Image as ImageIcon, Mic, Link, Video, Clock, ExternalLink, Edit3, AlertCircle, Trash2, PenTool, FileText } from 'lucide-react';
import ReactMarkdown from 'react-markdown';
import remarkGfm from 'remark-gfm';
import FavoriteBadge from '../common/FavoriteBadge';
import type { Creativity } from '@shared/types';
import { getAllSubtypes } from '@shared/types';
import EmojiIcon from '../common/EmojiIcon';
import { formatRelativeTime, formatDate } from '../../utils/formatters';
import { toMediaUrl, getFileNameFromPath, registerMediaPaths } from '../../utils/media';
import { useVideoThumbnail } from '../../hooks/useVideoThumbnail';
import { api } from '../../utils/api';
import { Popconfirm, Tag, Tooltip, Image, Rate } from 'antd';
import ImageAnnotator from '../common/ImageAnnotator';

interface CardPreviewProps {
  creativity: Creativity;
  isOpen: boolean;
  onClose: () => void;
  onSave?: (data: any) => Promise<boolean>;
  onDelete?: () => void;
  relatedCreativities?: Creativity[];
  onRelatedClick?: (creativity: Creativity) => void;
  onEdit?: () => void;
}

const overlayVariants = {
  hidden: { opacity: 0 },
  visible: { opacity: 1, transition: { duration: 0.25 } },
  exit: { opacity: 0, transition: { duration: 0.2 } },
};

const modalVariants = {
  hidden: { opacity: 0, scale: 0.92, y: 30 },
  visible: {
    opacity: 1,
    scale: 1,
    y: 0,
    transition: { type: 'spring', damping: 28, stiffness: 340, mass: 0.8 },
  },
  exit: {
    opacity: 0,
    scale: 0.95,
    y: 20,
    transition: { duration: 0.18 },
  },
};

const TYPE_ICONS: Record<string, React.ReactNode> = {
  text: <Type size={16} />,
  image: <ImageIcon size={16} />,
  audio: <Mic size={16} />,
  link: <Link size={16} />,
  video: <Video size={16} />,
  document: <FileText size={16} />,
};

const TYPE_LABELS: Record<string, string> = {
  text: '文本',
  image: '图片',
  audio: '音频',
  link: '链接',
  video: '视频',
  document: '文档',
};

const CardPreview: React.FC<CardPreviewProps> = ({
  creativity,
  isOpen,
  onClose,
  onSave,
  onDelete,
  relatedCreativities = [],
  onRelatedClick,
  onEdit,
}) => {
  const previewCardColor = creativity.cardStyle ? (() => { try { const p = JSON.parse(creativity.cardStyle); return p.color || null; } catch { return null; } })() : null;

  const isMixedContent = React.useMemo(() => {
    const hasMedia = ['image', 'audio', 'video', 'document'].includes(creativity.type);
    const hasTextContent = creativity.content && creativity.content.trim().length > 0;
    return hasMedia && hasTextContent;
  }, [creativity.type, creativity.content]);

  const videoPosterUrl = useVideoThumbnail(creativity.type, creativity.mediaFilePath || creativity.content);

  useEffect(() => {
    if (isOpen && creativity.id) {
      api.media.listByCreativity(creativity.id).then((files: any[]) => {
        registerMediaPaths(files || []);
      }).catch(() => {});
    }
  }, [isOpen, creativity.id]);

  const [imgError, setImgError] = useState(false);
  const [audioError, setAudioError] = useState(false);
  const [videoError, setVideoError] = useState(false);
  const [showAnnotator, setShowAnnotator] = useState(false);

  useEffect(() => {
    if (!isOpen) return;
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose();
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [isOpen, onClose]);

  const typeGradients: Record<string, string> = {
    text: 'linear-gradient(135deg, #667eea 0%, #764ba2 100%)',
    image: 'linear-gradient(135deg, #f093fb 0%, #f5576c 100%)',
    audio: 'linear-gradient(135deg, #4facfe 0%, #00f2fe 100%)',
    link: 'linear-gradient(135deg, #43e97b 0%, #38f9d7 100%)',
    video: 'linear-gradient(135deg, #fa709a 0%, #fee140 100%)',
    document: 'linear-gradient(135deg, #a18cd1 0%, #fbc2eb 100%)',
  };

  const isUrl = (text: string) => {
    const trimmed = text.trim();
    if (/^https?:\/\//i.test(trimmed)) {
      try {
        new URL(trimmed);
        return true;
      } catch {
        return false;
      }
    }
    if (/^[\w-]+(\.[\w-]+)+/.test(trimmed)) {
      try {
        new URL('https://' + trimmed);
        return true;
      } catch {
        return false;
      }
    }
    return false;
  };

  const normalizeUrl = (text: string) => {
    const trimmed = text.trim();
    if (/^https?:\/\//i.test(trimmed)) return trimmed;
    return 'https://' + trimmed;
  };

  const handleImageError = () => {
    setImgError(true);
  };

  React.useEffect(() => {
    setImgError(false);
    setAudioError(false);
    setVideoError(false);
  }, [creativity.id, creativity.content]);

  return (
    <AnimatePresence>
      {isOpen && (
        <motion.div
          className="fixed inset-0 z-50 flex items-center justify-center p-4"
          variants={overlayVariants}
          initial="hidden"
          animate="visible"
          exit="exit"
        >
          <motion.div
            className="absolute inset-0"
            style={{
              background: 'radial-gradient(ellipse at center, rgba(0,0,0,0.3) 0%, rgba(0,0,0,0.55) 100%)',
              backdropFilter: 'blur(8px)',
              WebkitBackdropFilter: 'blur(8px)',
            }}
            onClick={onClose}
          />

          <motion.div
            className="relative flex flex-col overflow-hidden card-preview-modal"
            style={{
              width: 'min(680px, calc(100vw - 48px))',
              maxHeight: 'calc(100vh - 48px)',
              maxWidth: 'calc(100vw - 48px)',
              minWidth: 340,
              borderRadius: 20,
              backgroundColor: 'var(--bg-secondary)',
              border: '3px solid rgba(255,255,255,0.12)',
              boxShadow: '0 24px 80px -12px rgba(0,0,0,0.35), 0 0 0 1px rgba(255,255,255,0.05) inset, 0 0 12px rgba(255,255,255,0.06), 0 0 4px rgba(255,255,255,0.08) inset',
            }}
            variants={modalVariants}
            initial="hidden"
            animate="visible"
            exit="exit"
            onClick={(e) => e.stopPropagation()}
          >
            {/* 头部 */}
            <div className="card-preview-header" style={{
              display: 'flex',
              alignItems: 'flex-start',
              justifyContent: 'space-between',
              padding: '20px 24px 16px',
              borderBottom: '1px solid var(--border-light)',
              background: 'linear-gradient(180deg, var(--bg-tertiary) 0%, var(--bg-secondary) 100%)',
            }}>
              <div style={{ flex: 1, minWidth: 0 }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 6 }}>
                  <span style={{
                    display: 'inline-flex',
                    alignItems: 'center',
                    gap: 4,
                    padding: '2px 8px',
                    borderRadius: 6,
                    fontSize: 11,
                    fontWeight: 600,
                    background: previewCardColor || typeGradients[creativity.type] || 'var(--primary-color)',
                    color: 'white',
                    boxShadow: '0 1px 0 rgba(255,255,255,0.2) inset, 0 4px 8px rgba(0,0,0,0.25), 0 2px 3px rgba(0,0,0,0.15)',
                    border: '1px solid rgba(255,255,255,0.15)',
                    borderBottomWidth: 2,
                    borderBottomColor: 'rgba(0,0,0,0.15)',
                  }}>
                    {TYPE_ICONS[creativity.type]}
                    <span style={{ marginLeft: 2 }}>{TYPE_LABELS[creativity.type]}</span>
                  </span>
                  <>
                    {creativity.priority > 0 && (
                      <Rate disabled count={5} value={creativity.priority} style={{ fontSize: 10 }} />
                    )}
                    {(creativity.isFavorite || (creativity as any).is_favorite === 1) && (
                      <FavoriteBadge />
                    )}
                    {creativity.emojiReaction && (
                      <span style={{
                        boxShadow: '0 1px 0 rgba(255,255,255,0.15) inset, 0 3px 6px rgba(0,0,0,0.2)',
                        border: '1px solid rgba(255,255,255,0.1)',
                        borderBottomWidth: 2,
                        borderBottomColor: 'rgba(0,0,0,0.1)',
                        borderRadius: 6,
                        padding: '1px 4px',
                        background: 'rgba(255,255,255,0.08)',
                        display: 'inline-flex',
                        alignItems: 'center',
                      }}><EmojiIcon id={creativity.emojiReaction} size={16} /></span>
                    )}
                  </>
                </div>
                <h2 style={{
                  fontSize: 20,
                  fontWeight: 700,
                  color: 'var(--text-primary)',
                  overflow: 'hidden',
                  textOverflow: 'ellipsis',
                  whiteSpace: 'nowrap',
                  lineHeight: 1.3,
                }}>
                  {creativity.title}
                </h2>
              </div>
              <div style={{ display: 'flex', alignItems: 'center', gap: 6, marginLeft: 16 }}>
                <>
                  {onEdit && (
                    <Tooltip title="编辑">
                      <motion.button
                        onClick={() => onEdit()}
                        whileHover={{ scale: 1.08 }}
                        whileTap={{ scale: 0.92 }}
                        style={{
                          display: 'flex',
                          alignItems: 'center',
                          justifyContent: 'center',
                          width: 32,
                          height: 32,
                          borderRadius: 8,
                          border: 'none',
                          background: 'var(--bg-primary)',
                          color: 'var(--text-secondary)',
                          cursor: 'pointer',
                          borderWidth: '1px 1px 2px',
                          borderStyle: 'solid',
                          borderColor: 'rgba(255,255,255,0.12) rgba(0,0,0,0.06) rgba(0,0,0,0.1) rgba(255,255,255,0.08)',
                          boxShadow: 'rgba(0,0,0,0.06) 0px 2px 0px, rgba(255,255,255,0.08) 0px 1px 0px inset',
                        }}
                      >
                        <Edit3 size={15} />
                      </motion.button>
                    </Tooltip>
                  )}
                  <Popconfirm
                    title="确定要将此创意移入回收站吗？"
                    onConfirm={async () => {
                      try {
                        await api.creativity.delete(creativity.id);
                        onDelete?.();
                        onClose();
                      } catch (err) {
                        console.error('删除失败:', err);
                      }
                    }}
                    okText="移入回收站"
                    cancelText="取消"
                    okButtonProps={{ danger: true }}
                  >
                  <Tooltip title="移入回收站">
                  <motion.button
                    whileHover={{ scale: 1.08 }}
                    whileTap={{ scale: 0.92 }}
                    style={{
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'center',
                      width: 32,
                      height: 32,
                      borderRadius: 8,
                      border: 'none',
                      background: 'var(--bg-primary)',
                      color: 'var(--text-tertiary)',
                      cursor: 'pointer',
                      borderWidth: '1px 1px 2px',
                      borderStyle: 'solid',
                      borderColor: 'rgba(255,255,255,0.12) rgba(0,0,0,0.06) rgba(0,0,0,0.1) rgba(255,255,255,0.08)',
                      boxShadow: 'rgba(0,0,0,0.06) 0px 2px 0px, rgba(255,255,255,0.08) 0px 1px 0px inset',
                    }}
                  >
                    <Trash2 size={15} />
                  </motion.button>
                  </Tooltip>
                  </Popconfirm>
                  <motion.button
                    onClick={onClose}
                    whileHover={{ scale: 1.08 }}
                    whileTap={{ scale: 0.92 }}
                    style={{
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'center',
                      width: 32,
                      height: 32,
                      borderRadius: 8,
                      border: 'none',
                      background: 'var(--bg-primary)',
                      color: 'var(--text-tertiary)',
                      cursor: 'pointer',
                      borderWidth: '1px 1px 2px',
                      borderStyle: 'solid',
                      borderColor: 'rgba(255,255,255,0.12) rgba(0,0,0,0.06) rgba(0,0,0,0.1) rgba(255,255,255,0.08)',
                      boxShadow: 'rgba(0,0,0,0.06) 0px 2px 0px, rgba(255,255,255,0.08) 0px 1px 0px inset',
                    }}
                  >
                    <X size={16} />
                  </motion.button>
                </>
              </div>
            </div>

            {/* 内容区域 */}
            <div className="flex-1 overflow-y-auto px-6 py-5 space-y-5" style={{ minHeight: 0, scrollbarGutter: 'stable' }}>
              <>
                {/* 内容 - 根据类型差异化渲染 */}
                {/* 多媒体+文本混合内容：左右布局 */}
                {isMixedContent ? (
                  <div style={{ display: 'flex', gap: 16, height: '100%' }}>
                    {/* 左侧：多媒体内容 */}
                    <div style={{ flex: '0 0 45%', minWidth: 0 }}>
                      {creativity.type === 'image' ? (
                        imgError ? (
                          <div className="flex flex-col items-center justify-center gap-2 py-8 text-[var(--text-tertiary)]">
                            <AlertCircle size={32} />
                            <span className="text-sm">图片加载失败</span>
                          </div>
                        ) : (
                          <div className="relative group" style={{ marginBottom: 8 }}>
                            <Image
                              src={toMediaUrl(creativity.mediaFilePath || creativity.content)}
                              alt={creativity.title}
                              onError={handleImageError}
                              preview={{ zIndex: 100001 }}
                              style={{ width: '100%', maxHeight: 400, objectFit: 'contain', borderRadius: 8 }}
                            />
                            <Tooltip title="标注">
                              <button
                                onClick={() => setShowAnnotator(true)}
                                className="absolute top-2 right-2 p-1.5 rounded-lg bg-black/50 text-white opacity-0 group-hover:opacity-100 transition-opacity hover:bg-black/70"
                              >
                                <PenTool size={16} />
                              </button>
                            </Tooltip>
                          </div>
                        )
                      ) : creativity.type === 'audio' ? (
                        <div style={{ padding: '8px 0' }}>
                          <div style={{
                            display: 'flex', alignItems: 'center', gap: 12,
                            padding: '16px 20px', borderRadius: 12,
                            background: audioError
                              ? 'linear-gradient(135deg, #94a3b8 0%, #64748b 100%)'
                              : 'linear-gradient(135deg, #4facfe 0%, #00f2fe 100%)',
                            marginBottom: 12,
                          }}>
                            <Mic size={24} style={{ color: 'white' }} />
                            <div style={{ flex: 1 }}>
                              <div style={{ color: 'white', fontWeight: 600, fontSize: 14 }}>{creativity.title}</div>
                              <div style={{ color: 'rgba(255,255,255,0.7)', fontSize: 12 }}>
                                {audioError ? '音频文件无法播放' : (getFileNameFromPath(creativity.content) || '音频文件')}
                              </div>
                            </div>
                          </div>
                          {!audioError && (
                            <audio
                              controls
                              autoPlay
                              src={toMediaUrl(creativity.mediaFilePath || creativity.content)}
                              style={{ width: '100%' }}
                              onError={() => setAudioError(true)}
                            >
                              您的浏览器不支持音频播放
                            </audio>
                          )}
                        </div>
                      ) : creativity.type === 'video' ? (
                        <div style={{ padding: '8px 0' }}>
                          {videoError ? (
                            <div style={{
                              width: '100%', height: 200, borderRadius: 8,
                              display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', gap: 8,
                              background: 'linear-gradient(135deg, #94a3b8 0%, #64748b 100%)',
                            }}>
                              <Video size={32} style={{ color: 'rgba(255,255,255,0.7)' }} />
                              <span style={{ color: 'rgba(255,255,255,0.8)', fontSize: 13 }}>视频文件无法播放</span>
                            </div>
                          ) : (
                            <video
                              controls
                              autoPlay
                              src={toMediaUrl(creativity.mediaFilePath || creativity.content)}
                              style={{ width: '100%', maxHeight: 400, borderRadius: 8 }}
                              poster={videoPosterUrl || undefined}
                              onError={() => setVideoError(true)}
                            >
                              您的浏览器不支持视频播放
                            </video>
                          )}
                        </div>
                      ) : creativity.type === 'document' ? (
                        <div style={{ padding: '8px 0' }}>
                          <div style={{
                            display: 'flex', alignItems: 'center', gap: 12,
                            padding: '16px 20px', borderRadius: 12,
                            background: 'linear-gradient(135deg, #a18cd1 0%, #fbc2eb 100%)',
                            marginBottom: 12,
                          }}>
                            <FileText size={24} style={{ color: 'white' }} />
                            <div style={{ flex: 1 }}>
                              <div style={{ color: 'white', fontWeight: 600, fontSize: 14 }}>{creativity.title}</div>
                              <div style={{ color: 'rgba(255,255,255,0.7)', fontSize: 12 }}>
                                {getFileNameFromPath(creativity.content) || '文档文件'}
                              </div>
                            </div>
                          </div>
                          {creativity.content && /\.pdf$/i.test(creativity.content) && (
                            <iframe
                              src={toMediaUrl(creativity.mediaFilePath || creativity.content)}
                              style={{ width: '100%', height: 500, borderRadius: 8, border: '1px solid var(--border-color)' }}
                              title={creativity.title}
                            />
                          )}
                        </div>
                      ) : null}
                    </div>
                    
                    {/* 右侧：文本内容 */}
                    <div style={{ flex: 1, minWidth: 0 }}>
                      <div className="selectable">
                        {creativity.contentFormat === 'markdown' ? (
                          <div className="markdown-body" style={{
                            boxShadow: 'inset 0 2px 6px rgba(0,0,0,0.08), inset 0 1px 2px rgba(0,0,0,0.04)',
                            borderRadius: 8,
                            padding: '12px 14px',
                            background: 'rgba(0,0,0,0.02)',
                            minHeight: 200,
                          }}>
                            <ReactMarkdown remarkPlugins={[remarkGfm]}>
                              {creativity.content}
                            </ReactMarkdown>
                          </div>
                        ) : (
                          <p className="text-[var(--text-primary)] whitespace-pre-wrap leading-relaxed" style={{
                            boxShadow: 'inset 0 2px 6px rgba(0,0,0,0.08), inset 0 1px 2px rgba(0,0,0,0.04)',
                            borderRadius: 8,
                            padding: '12px 14px',
                            background: 'rgba(0,0,0,0.02)',
                            minHeight: 200,
                          }}>
                            {creativity.content}
                          </p>
                        )}
                      </div>
                    </div>
                  </div>
                ) : (
                /* 非混合内容，使用原有布局 */
                <div className="selectable">
                  {creativity.type === 'image' ? (
                    imgError ? (
                      <div className="flex flex-col items-center justify-center gap-2 py-8 text-[var(--text-tertiary)]">
                        <AlertCircle size={32} />
                        <span className="text-sm">图片加载失败</span>
                        <span className="text-xs text-[var(--text-tertiary)] opacity-60">
                          {getFileNameFromPath(creativity.content) || (creativity.content.length > 60 ? creativity.content.slice(0, 60) + '...' : creativity.content)}
                        </span>
                      </div>
                    ) : (
                      <div className="relative group" style={{ marginBottom: 8 }}>
                        <Image
                          src={toMediaUrl(creativity.mediaFilePath || creativity.content)}
                          alt={creativity.title}
                          onError={handleImageError}
                          preview={{
                            zIndex: 100001,
                          }}
                          style={{
                            width: '100%',
                            maxHeight: 400,
                            objectFit: 'contain',
                            borderRadius: 8,
                          }}
                        />
                        <Tooltip title="标注">
                          <button
                            onClick={() => setShowAnnotator(true)}
                            className="absolute top-2 right-2 p-1.5 rounded-lg bg-black/50 text-white opacity-0 group-hover:opacity-100 transition-opacity hover:bg-black/70"
                          >
                            <PenTool size={16} />
                          </button>
                        </Tooltip>
                      </div>
                    )
                  ) : creativity.type === 'audio' ? (
                    <div style={{ padding: '8px 0' }}>
                      <div style={{
                        display: 'flex', alignItems: 'center', gap: 12,
                        padding: '16px 20px', borderRadius: 12,
                        background: audioError
                          ? 'linear-gradient(135deg, #94a3b8 0%, #64748b 100%)'
                          : 'linear-gradient(135deg, #4facfe 0%, #00f2fe 100%)',
                        marginBottom: 12,
                      }}>
                        <Mic size={24} style={{ color: 'white' }} />
                        <div style={{ flex: 1 }}>
                          <div style={{ color: 'white', fontWeight: 600, fontSize: 14 }}>{creativity.title}</div>
                          <div style={{ color: 'rgba(255,255,255,0.7)', fontSize: 12 }}>
                            {audioError ? '音频文件无法播放' : (getFileNameFromPath(creativity.content) || '音频文件')}
                          </div>
                        </div>
                      </div>
                      {audioError ? (
                        <div className="flex flex-col items-center justify-center gap-2 py-4 text-[var(--text-tertiary)]">
                          <AlertCircle size={24} />
                          <span className="text-xs">音频文件可能已被移动或删除</span>
                        </div>
                      ) : (
                        <audio
                          controls
                          autoPlay
                          src={toMediaUrl(creativity.mediaFilePath || creativity.content)}
                          style={{ width: '100%' }}
                          onError={() => setAudioError(true)}
                        >
                          您的浏览器不支持音频播放
                        </audio>
                      )}
                    </div>
                  ) : creativity.type === 'video' ? (
                    <div style={{ padding: '8px 0' }}>
                      {videoError ? (
                        <div style={{
                          width: '100%', height: 200, borderRadius: 8,
                          display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', gap: 8,
                          background: 'linear-gradient(135deg, #94a3b8 0%, #64748b 100%)',
                        }}>
                          <Video size={32} style={{ color: 'rgba(255,255,255,0.7)' }} />
                          <span style={{ color: 'rgba(255,255,255,0.8)', fontSize: 13 }}>视频文件无法播放</span>
                          <span style={{ color: 'rgba(255,255,255,0.5)', fontSize: 11 }}>
                            {getFileNameFromPath(creativity.content) || '文件可能已被移动或删除'}
                          </span>
                        </div>
                      ) : (
                        <video
                          controls
                          autoPlay
                          src={toMediaUrl(creativity.mediaFilePath || creativity.content)}
                          style={{ width: '100%', maxHeight: 400, borderRadius: 8 }}
                          poster={videoPosterUrl || undefined}
                          onError={() => setVideoError(true)}
                        >
                          您的浏览器不支持视频播放
                        </video>
                      )}
                      <div style={{ marginTop: 6, fontSize: 11, color: 'var(--text-tertiary)' }}>
                        {getFileNameFromPath(creativity.content) || '视频文件'}
                      </div>
                    </div>
                  ) : creativity.type === 'document' ? (
                    <div style={{ padding: '8px 0' }}>
                      <div style={{
                        display: 'flex', alignItems: 'center', gap: 12,
                        padding: '16px 20px', borderRadius: 12,
                        background: 'linear-gradient(135deg, #a18cd1 0%, #fbc2eb 100%)',
                        marginBottom: 12,
                      }}>
                        <FileText size={24} style={{ color: 'white' }} />
                        <div style={{ flex: 1 }}>
                          <div style={{ color: 'white', fontWeight: 600, fontSize: 14 }}>{creativity.title}</div>
                          <div style={{ color: 'rgba(255,255,255,0.7)', fontSize: 12 }}>
                            {getFileNameFromPath(creativity.content) || '文档文件'}
                          </div>
                        </div>
                      </div>
                      {creativity.content && /\.pdf$/i.test(creativity.content) && (
                        <iframe
                          src={toMediaUrl(creativity.mediaFilePath || creativity.content)}
                          style={{ width: '100%', height: 500, borderRadius: 8, border: '1px solid var(--border-color)' }}
                          title={creativity.title}
                        />
                      )}
                    </div>
                  ) : creativity.type === 'link' && isUrl(creativity.content) ? (
                    <a
                      href={normalizeUrl(creativity.content)}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="flex items-center gap-2 px-4 py-3 rounded-lg border border-[var(--border-color)] bg-[var(--bg-primary)] text-[var(--primary-color)] hover:bg-[var(--bg-hover)] transition-colors"
                    >
                      <ExternalLink size={16} />
                      <span className="truncate">{creativity.content}</span>
                    </a>
                  ) : (
                    creativity.contentFormat === 'markdown' ? (
                      <div className="markdown-body" style={{
                        boxShadow: 'inset 0 2px 6px rgba(0,0,0,0.08), inset 0 1px 2px rgba(0,0,0,0.04)',
                        borderRadius: 8,
                        padding: '12px 14px',
                        background: 'rgba(0,0,0,0.02)',
                      }}>
                        <ReactMarkdown remarkPlugins={[remarkGfm]}>
                          {creativity.content}
                        </ReactMarkdown>
                      </div>
                    ) : (
                      <p className="text-[var(--text-primary)] whitespace-pre-wrap leading-relaxed" style={{
                        boxShadow: 'inset 0 2px 6px rgba(0,0,0,0.08), inset 0 1px 2px rgba(0,0,0,0.04)',
                        borderRadius: 8,
                        padding: '12px 14px',
                        background: 'rgba(0,0,0,0.02)',
                      }}>
                        {creativity.content}
                      </p>
                    )
                  )}
                </div>
                  )}

                {/* 子类型标签 */}
                {creativity.subtype && getAllSubtypes()[creativity.subtype] && (
                  <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                    <Tag
                      color={getAllSubtypes()[creativity.subtype].color}
                      icon={getAllSubtypes()[creativity.subtype].icon}
                    >
                      {getAllSubtypes()[creativity.subtype].label}
                    </Tag>
                  </div>
                )}

                {/* 时间信息 */}
                <div style={{
                  display: 'flex',
                  alignItems: 'center',
                  gap: 12,
                  fontSize: 11,
                  color: 'var(--text-tertiary)',
                  padding: '8px 0 0',
                  borderTop: '1px solid var(--border-light)',
                  marginTop: 4,
                  marginLeft: 20,
                }}>
                  <span style={{ display: 'flex', alignItems: 'center', gap: 4 }}>
                    <Clock size={11} />
                    创建于 {formatDate(creativity.createdAt)}
                  </span>
                  {creativity.updatedAt !== creativity.createdAt && (
                    <span style={{ display: 'flex', alignItems: 'center', gap: 4 }}>
                      更新于 {formatRelativeTime(creativity.updatedAt)}
                    </span>
                  )}
                  {(creativity.wordCount || 0) > 0 && (
                    <span style={{ marginLeft: 'auto' }}>
                      {creativity.wordCount} 字
                    </span>
                  )}
                </div>
              </>
            </div>
          </motion.div>

          <ImageAnnotator
            imageUrl={toMediaUrl(creativity.mediaFilePath || creativity.content)}
            visible={showAnnotator}
            onCancel={() => setShowAnnotator(false)}
            onSave={async (dataUrl) => {
              try {
                const result = await api.media.saveImage(dataUrl, creativity.id);
                if (result?.success && result.data) {
                  const newMedia = result.data;
                  if (newMedia.filePath || newMedia.filepath) {
                    if (onSave) {
                      const saveData: any = {
                        id: creativity.id,
                        title: creativity.title,
                        content: creativity.content || '',
                        type: 'image',
                      };
                      if ((creativity as any)._isCanvasLocal) {
                        saveData._isCanvasLocal = true;
                        saveData._canvasItemId = (creativity as any)._canvasItemId;
                      }
                      await onSave(saveData);
                    }
                  }
                  const files = await api.media.listByCreativity(creativity.id);
                  registerMediaPaths(files || []);
                }
              } catch (err) {
                console.error('保存标注图片失败:', err);
              }
              setShowAnnotator(false);
            }}
          />
        </motion.div>
      )}
    </AnimatePresence>
  );
};

export default CardPreview;
