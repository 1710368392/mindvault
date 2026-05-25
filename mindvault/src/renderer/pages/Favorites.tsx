import React, { useEffect, useState, useRef } from 'react';
import { AnimatePresence, motion } from 'framer-motion';
import {
  Edit, Copy, Trash2,
  FileText, Image, Mic, Link as LinkIcon, Video,
  Clock,
} from 'lucide-react';
import { useUIStore } from '../stores/uiStore';
import { formatRelativeTime, getCreativityTypeLabel } from '../utils/formatters';
import CardPreview from '../components/card/CardPreview';
import CardEditor from '../components/card/CardEditor';
import ShootingStar from '../components/common/ShootingStar';
import FavoriteBadge from '../components/common/FavoriteBadge';
import CollectionIcon from '../components/common/CollectionIcon';
import CreativityTag from '../components/common/CreativityTag';
import MasonryLayout from '../components/common/MasonryLayout';
import { Spin, Image as AntImage, Menu } from 'antd';
import { api } from '../utils/api';
import { toMediaUrl, isPureMediaContent } from '../utils/media';
import type { Creativity } from '@shared/types';
import GradientSpinner from '../components/common/GradientSpinner';

const typeIcons: Record<string, any> = {
  text: FileText, image: Image, audio: Mic, link: LinkIcon, video: Video, document: FileText,
};

const typeGradients: Record<string, string> = {
  text: 'linear-gradient(135deg, var(--primary-color), var(--primary-light))',
  image: 'linear-gradient(135deg, var(--info-color), var(--primary-light))',
  audio: 'linear-gradient(135deg, var(--success-color), var(--primary-light))',
  link: 'linear-gradient(135deg, var(--warning-color), var(--primary-light))',
  video: 'linear-gradient(135deg, var(--error-color), var(--primary-light))',
  document: 'linear-gradient(135deg, #a18cd1 0%, #fbc2eb 100%)',
};

const FavoriteCard: React.FC<{
  creativity: Creativity;
  index: number;
  onClick: () => void;
  onContextMenu: (e: React.MouseEvent) => void;
  onUnfavorite: () => void;
}> = ({ creativity, index, onClick, onContextMenu, onUnfavorite }) => {
  const Icon = typeIcons[creativity.type] || FileText;
  const gradient = typeGradients[creativity.type] || typeGradients.text;
  const [hovered, setHovered] = useState(false);

  return (
    <motion.div
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ delay: index * 0.04, duration: 0.3 }}
      onMouseEnter={() => setHovered(true)}
      onMouseLeave={() => setHovered(false)}
      onClick={onClick}
      onContextMenu={onContextMenu}
      style={{
        background: 'var(--bg-secondary)',
        borderRadius: '16px',
        border: `1px solid ${hovered ? 'var(--primary-color)' : 'var(--border-color)'}`,
        overflow: 'hidden',
        cursor: 'pointer',
        position: 'relative',
        boxShadow: hovered
          ? 'var(--card-hover-shadow)'
          : 'var(--card-shadow)',
        transition: 'border-color 0.2s, box-shadow 0.2s',
      }}
    >
      <div style={{ height: 4, background: gradient }} />

      <div style={{ padding: '14px 16px 0', display: 'flex', alignItems: 'center', gap: 12 }}>
        <div style={{
          width: 36, height: 36, borderRadius: '10px',
          background: gradient, opacity: 0.15,
          display: 'flex', alignItems: 'center', justifyContent: 'center',
          position: 'relative', flexShrink: 0,
        }}>
          <div style={{ position: 'absolute', inset: 0, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
            <Icon size={18} color="var(--primary-color)" />
          </div>
        </div>
        <div style={{ flex: 1, minWidth: 0 }}>
          <div style={{
            fontSize: 11, fontWeight: 600, color: 'var(--text-tertiary)',
            textTransform: 'uppercase', letterSpacing: '0.5px',
          }}>
            {getCreativityTypeLabel(creativity.type)}
          </div>
          <div style={{ display: 'flex', alignItems: 'center', gap: 6, marginTop: 2 }}>
            <Clock size={10} color="var(--text-tertiary)" />
            <span style={{ fontSize: 11, color: 'var(--text-tertiary)' }}>
              {formatRelativeTime(creativity.createdAt)}
            </span>
          </div>
        </div>
        <FavoriteBadge size={24} />
      </div>

      <div style={{ padding: '10px 16px 12px' }}>
        {creativity.title && (
          <h3 style={{
            margin: '0 0 6px 0', fontSize: 15, fontWeight: 600,
            color: 'var(--text-primary)', lineHeight: 1.3,
            display: '-webkit-box', WebkitLineClamp: 2,
            WebkitBoxOrient: 'vertical', overflow: 'hidden',
            fontFamily: 'var(--font-title)',
          }}>
            {creativity.title}
          </h3>
        )}
        {creativity.content && (
          <p style={{
            margin: 0, fontSize: 13, color: 'var(--text-secondary)',
            lineHeight: 1.6, wordBreak: 'break-word',
          }}>
            {creativity.content}
          </p>
        )}
      </div>

      {creativity.tags && creativity.tags.length > 0 && (
        <div style={{
          padding: '0 16px 12px', display: 'flex', flexWrap: 'wrap', gap: 6,
        }}>
          {creativity.tags.slice(0, 3).map((tag: any, idx: number) => (
            <CreativityTag key={idx} tag={tag} />
          ))}
          {creativity.tags.length > 3 && (
            <span style={{
              fontSize: 11, padding: '3px 10px', borderRadius: 99,
              background: 'var(--primary-bg)', color: 'var(--primary-color)', fontWeight: 500,
            }}>
              +{creativity.tags.length - 3}
            </span>
          )}
        </div>
      )}

      <div style={{
        height: 8,
        background: 'linear-gradient(to top, var(--bg-hover), transparent)',
      }} />
    </motion.div>
  );
};

const FAVORITES_PAGE_SIZE = 20;

const Favorites: React.FC = () => {
  const [items, setItems] = useState<Creativity[]>([]);
  const [loading, setLoading] = useState(true);
  const [loadingMore, setLoadingMore] = useState(false);
  const [totalCount, setTotalCount] = useState(0);
  const [currentPage, setCurrentPage] = useState(1);
  const [previewItem, setPreviewItem] = useState<Creativity | null>(null);
  const [previewOpen, setPreviewOpen] = useState(false);
  const [directImagePreview, setDirectImagePreview] = useState<Creativity | null>(null);
  const [contextMenu, setContextMenu] = useState<{ x: number; y: number; item: Creativity } | null>(null);
  const [isDragOver, setIsDragOver] = useState(false);
  const contextMenuRef = useRef<HTMLDivElement>(null);

  const isDraggingItem = useUIStore((s) => s.isDraggingItem);
  const dragItem = useUIStore((s) => s.dragItem);
  const endDrag = useUIStore((s) => s.endDrag);
  const dragEnded = useUIStore((s) => s.dragEnded);

  const fetchFavorites = async (page: number = 1, append: boolean = false) => {
    if (append) {
      setLoadingMore(true);
    } else {
      setLoading(true);
    }
    try {
      const res = await api.creativity.list({ page: 1, pageSize: 1000, status: 'active' });
      const all = res.data || [];
      const favorites = all.filter((c: any) => c.isFavorite || c.is_favorite === 1);
      setTotalCount(favorites.length);
      const start = 0;
      const end = page * FAVORITES_PAGE_SIZE;
      const pageItems = favorites.slice(start, end);
      setItems(append ? [...items, ...pageItems.slice(items.length)] : pageItems);
      setCurrentPage(page);
    } catch (err) {
      console.error('加载收藏失败:', err);
    } finally {
      setLoading(false);
      setLoadingMore(false);
    }
  };

  const hasMore = items.length < totalCount;

  useEffect(() => { fetchFavorites(); }, []);

  useEffect(() => {
    if (!contextMenu) return;
    const handleClick = (e: MouseEvent) => {
      if (contextMenuRef.current && !contextMenuRef.current.contains(e.target as Node)) {
        setContextMenu(null);
      }
    };
    const handleEsc = (e: KeyboardEvent) => { if (e.key === 'Escape') setContextMenu(null); };
    const timer = setTimeout(() => {
      document.addEventListener('mousedown', handleClick);
      document.addEventListener('keydown', handleEsc);
    }, 0);
    return () => {
      clearTimeout(timer);
      document.removeEventListener('mousedown', handleClick);
      document.removeEventListener('keydown', handleEsc);
    };
  }, [contextMenu]);

  const handleContextMenu = (e: React.MouseEvent, item: Creativity) => {
    e.preventDefault();
    e.stopPropagation();
    setContextMenu({ x: e.clientX, y: e.clientY, item });
  };

  const handleToggleFavorite = async (id: string) => {
    await api.creativity.toggleFavorite(id);
    fetchFavorites(1, false);
  };

  const handleFavoritesMouseEnter = () => { if (isDraggingItem) setIsDragOver(true); };
  const handleFavoritesMouseLeave = () => { setIsDragOver(false); };
  const handleFavoritesMouseUp = async (e: React.MouseEvent) => {
    if (!isDraggingItem || !dragItem || dragEnded) return;
    e.stopPropagation();
    setIsDragOver(false);
    try {
      const detail = await api.creativity.read(dragItem.id);
      if (detail && (detail.isFavorite || detail.is_favorite === 1)) {
        useUIStore.getState().showToast('warning', '该创意已在收藏中');
      } else {
        await api.creativity.toggleFavorite(dragItem.id);
        useUIStore.getState().showToast('success', '已收藏');
        fetchFavorites(1, false);
      }
    } catch { /* ignore */ }
    endDrag();
    document.body.style.userSelect = '';
    document.body.style.cursor = '';
  };

  return (
    <div
      onMouseEnter={handleFavoritesMouseEnter}
      onMouseLeave={handleFavoritesMouseLeave}
      onMouseUp={handleFavoritesMouseUp}
      style={{
        padding: '32px 24px',
        height: '100%',
        border: isDragOver ? '2px dashed var(--warning-color)' : '2px solid transparent',
        borderRadius: isDragOver ? '16px' : 0,
        backgroundColor: isDragOver ? 'var(--primary-bg)' : 'transparent',
        transition: 'all 0.3s cubic-bezier(0.22, 1, 0.36, 1)',
      }}
    >
      <motion.div
        initial={{ opacity: 0, y: -20 }}
        animate={{ opacity: 1, y: 0 }}
        style={{
          display: 'flex', alignItems: 'center', justifyContent: 'center',
          gap: 16, marginBottom: 32, textAlign: 'center',
        }}
      >
        <div style={{
          width: 56, height: 56, borderRadius: '16px',
          background: 'linear-gradient(135deg, var(--warning-color), var(--primary-light))',
          display: 'flex', alignItems: 'center', justifyContent: 'center',
          boxShadow: '0 8px 24px var(--color-primary-glow)',
        }}>
          <ShootingStar size={28} color="white" fill="white" />
        </div>
        <div>
          <h1 style={{
            margin: 0, fontSize: 28, fontWeight: 700,
            color: 'var(--text-primary)', lineHeight: 1.2,
            fontFamily: 'var(--font-title)',
          }}>
            我的收藏
          </h1>
          {!loading && (
            <div style={{
              display: 'flex', alignItems: 'center', justifyContent: 'center',
              gap: 8, marginTop: 4,
            }}>
              <span style={{
                fontSize: 14, color: 'var(--text-tertiary)',
                backgroundColor: 'var(--bg-secondary)',
                padding: '4px 14px', borderRadius: 99, fontWeight: 500,
              }}>
                {items.length} 个灵感
              </span>
            </div>
          )}
        </div>
      </motion.div>

      <Spin spinning={loading} tip="加载收藏中..." indicator={<GradientSpinner />}>
        <div style={{ minHeight: 400 }}>
        {!loading && items.length === 0 && (
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.1 }}
          >
            <div style={{
              textAlign: 'center', padding: '64px 24px',
              border: '2px dashed var(--border-color)', borderRadius: '16px',
              background: 'var(--bg-secondary)',
            }}>
              <div style={{
                width: 96, height: 96, borderRadius: '24px',
                backgroundColor: 'var(--bg-tertiary)',
                display: 'flex', alignItems: 'center', justifyContent: 'center',
                margin: '0 auto 20px',
              }}>
                <ShootingStar size={40} color="var(--text-tertiary)" />
              </div>
              <h3 style={{
                fontSize: 18, fontWeight: 600, margin: '0 0 8px 0',
                color: 'var(--text-secondary)', fontFamily: 'var(--font-title)',
              }}>
                收藏夹是空的
              </h3>
              <p style={{
                fontSize: 14, color: 'var(--text-tertiary)',
                margin: '0 0 24px 0', maxWidth: 360,
                marginLeft: 'auto', marginRight: 'auto',
              }}>
                右键点击创意卡片，选择"收藏"即可添加到这里
              </p>
            </div>
          </motion.div>
        )}

        {!loading && items.length > 0 && (
          <>
          <MasonryLayout
            columns={items.length <= 2 ? 1 : items.length <= 4 ? 2 : 4}
            gap={16}
            minColumnWidth={250}
            items={items.map((item, index) => ({
              id: item.id,
              children: (
                <FavoriteCard
                  creativity={item}
                  index={index}
                  onClick={() => {
                    if (!item.isRead) {
                      api.creativity.update(item.id, { isRead: true });
                    }
                    if (item.type === 'image' && isPureMediaContent(item.content)) {
                      setDirectImagePreview(item);
                    } else {
                      setPreviewItem(item);
                      setPreviewOpen(true);
                    }
                  }}
                  onContextMenu={(e) => handleContextMenu(e, item)}
                  onUnfavorite={() => handleToggleFavorite(item.id)}
                />
              )
            }))}
          />
        {hasMore && (
          <div
            ref={(el) => {
              if (!el) return;
              const observer = new IntersectionObserver(
                (entries) => {
                  if (entries[0].isIntersecting && !loadingMore) {
                    fetchFavorites(currentPage + 1, true);
                  }
                },
                { rootMargin: '200px' }
              );
              observer.observe(el);
              return () => observer.disconnect();
            }}
            style={{
              display: 'flex', alignItems: 'center', justifyContent: 'center',
              padding: '24px 0 12px', gap: 8, minHeight: 48,
            }}
          >
            {loadingMore ? (
              <>
                <motion.div
                  animate={{ rotate: 360 }}
                  transition={{ duration: 1, repeat: Infinity, ease: 'linear' }}
                  style={{ width: 16, height: 16, border: '2px solid var(--border-light)', borderTopColor: 'var(--primary-color)', borderRadius: '50%' }}
                />
                <span style={{ fontSize: 13, color: 'var(--text-tertiary)' }}>正在加载...</span>
              </>
            ) : (
              <span style={{ fontSize: 13, color: 'var(--text-tertiary)' }}>
                ↓ 继续滚动加载更多（还有 {totalCount - items.length} 条）
              </span>
            )}
          </div>
        )}
         </>
        )}
      </div>
      </Spin>

      <AnimatePresence>
        {previewOpen && previewItem && (
          <CardPreview
            creativity={previewItem}
            isOpen={previewOpen}
            onClose={() => setPreviewOpen(false)}
            onDelete={() => fetchFavorites(1, false)}
            onEdit={() => {
              setPreviewOpen(false);
              useUIStore.getState().openEditor(previewItem);
            }}
          />
        )}
      </AnimatePresence>

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

      {contextMenu && (
        <div ref={contextMenuRef} style={{
          position: 'fixed', left: contextMenu.x, top: contextMenu.y,
          zIndex: 1000, minWidth: 180,
          backgroundColor: 'var(--bg-secondary)',
          borderRadius: 'var(--radius-md)',
          border: '1px solid var(--border-color)',
          boxShadow: 'var(--shadow-lg)',
          overflow: 'hidden',
        }}>
          <Menu
            mode="vertical"
            onClick={({ key }) => {
              if (key === 'edit') { useUIStore.getState().openEditor(contextMenu.item); }
              else if (key === 'copy') { navigator.clipboard.writeText(contextMenu.item.title); }
              else if (key === 'favorite') { handleToggleFavorite(contextMenu.item.id); }
              else if (key === 'trash') { api.creativity.delete(contextMenu.item.id).then(() => fetchFavorites(1, false)); }
              setContextMenu(null);
            }}
            style={{ border: 'none', background: 'transparent' }}
            items={[
              { key: 'edit', icon: <Edit size={14} />, label: '编辑' },
              { key: 'copy', icon: <Copy size={14} />, label: '复制标题' },
              { type: 'divider' },
              { key: 'favorite', icon: <CollectionIcon size={14} />, label: '取消收藏' },
              { key: 'trash', icon: <Trash2 size={14} />, label: '移到回收站', danger: true },
            ]}
          />
        </div>
      )}
    </div>
  );
};

export default Favorites;
