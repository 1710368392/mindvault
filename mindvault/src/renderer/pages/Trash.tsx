import React, { useEffect, useState, useCallback } from 'react';
import { AnimatePresence, motion } from 'framer-motion';
import {
  Trash2,
  RotateCcw,
  FileText,
  Image,
  Mic,
  Link as LinkIcon,
  Video,
  Clock,
  LucideProps,
  FolderOpen,
  StickyNote,
  BookOpen,
  Layers,
  Layout,
  ListChecks,
  CheckSquare,
  Square,
  X,
} from 'lucide-react';
import { Spin, Modal, Table, Empty, Checkbox, App as AntdApp } from 'antd';
import GradientSpinner from '../components/common/GradientSpinner';
import FavoriteBadge from '../components/common/FavoriteBadge';
import ListThumbnailCell from '../components/common/ListThumbnailCell';
import { api } from '../utils/api';
import { useUIStore } from '../stores/uiStore';
import { extractAndRegisterMediaFromSnapshot, registerMediaPaths } from '../utils/media';
import type { Creativity, TrashItem, TrashItemType } from '@shared/types';

const ToiletPaperIcon: React.FC<LucideProps> = ({ size = 28, color, ...props }) => (
  <svg viewBox="0 0 1024 1024" width={size} height={size} {...props}>
    <path d="M204.8 239.104c-39.936 0-73.728 51.2-73.728 119.296S162.304 477.696 204.8 477.696c39.936 0 73.728-51.2 73.728-119.296S244.736 239.104 204.8 239.104z m0 204.8c-19.968 0-39.936-36.864-39.936-85.504s19.968-85.504 39.936-85.504 39.936 36.864 39.936 85.504-19.968 85.504-39.936 85.504z" fill={color || 'currentColor'} />
    <path d="M819.2 0H204.8C91.136 0 0 156.672 0 358.4s91.136 358.4 204.8 358.4h170.496v290.304c0 8.704 8.704 16.896 16.896 16.896h614.4c8.704 0 16.896-8.704 16.896-16.896V358.4C1024 156.672 932.864 0 819.2 0zM375.296 682.496H292.864c36.864-34.304 65.536-76.8 82.432-124.928v124.928z m-170.496 0c-93.696 0-170.496-147.968-170.496-324.096S111.104 34.304 204.8 34.304 375.296 182.272 375.296 358.4s-76.8 324.096-170.496 324.096z m784.896-187.392H921.6c-8.704 0-16.896 8.704-16.896 16.896s8.704 16.896 16.896 16.896h68.096v460.8H409.6v-460.8h68.096c8.704 0 16.896-8.704 16.896-16.896s-8.704-16.896-16.896-16.896H409.6V358.4c0-144.896-48.128-267.264-116.736-324.096H819.2c93.696 0 170.496 147.968 170.496 324.096v136.704z" fill={color || 'currentColor'} />
    <path d="M648.704 495.104H563.2c-8.704 0-16.896 8.704-16.896 16.896 0 8.704 8.704 16.896 16.896 16.896h85.504c8.704 0 16.896-8.704 16.896-16.896s-8.704-16.896-16.896-16.896z m187.392 0h-85.504c-8.704 0-16.896 8.704-16.896 16.896 0 8.704 8.704 16.896 16.896 16.896h85.504c8.704 0 16.896-8.704 16.896-16.896s-8.192-16.896-16.896-16.896z" fill={color || 'currentColor'} />
  </svg>
);

const ToiletIcon: React.FC<LucideProps> = ({ size = 48, color, ...props }) => (
  <svg viewBox="0 0 1024 1024" width={size} height={size} {...props}>
    <path d="M512.2 771.4c-39.4 0-76.7-9.4-109.7-26L381.8 961.3c-1.4 14.4 10 27 24.6 27H502l47.6-219.8c-23.8 7.7-11.2 2.9-37.4 2.9z" fill={color || 'currentColor'} />
    <path d="M348.9 114H257c-13.6 0-24.7-11.1-24.7-24.7s11.1-24.7 24.7-24.7H405.4M536 441.3h-291.7c-6.6 0-11.9 5.4-11.9 11.9v25.4c0 4.2 2.1 7.9 5.4 10h286.9l11.3-47.3z" fill={color || 'currentColor'} />
    <path d="M305.9 236.3c0-46.3 16.5-89 43.8-122.4h-80.9v327.4h37l0.1-205z" fill={color || 'currentColor'} />
    <path d="M380 441.3v-205c0-66 53.6-119.7 119.7-119.7h24.7c31.5 0 60.1 12.2 81.6 32.1l18.6-78c-29.2-17.8-63.6-28-100.2-28h-24.7C393.2 42.7 306 129.8 306 236.3v205h230H380z" fill={color || 'currentColor'} />
  </svg>
);

const typeIconMap: Record<string, any> = {
  text: FileText, image: Image, audio: Mic, link: LinkIcon, video: Video,
};

const typeLabelMap: Record<string, string> = {
  text: '文本', image: '图片', audio: '音频', link: '链接', video: '视频',
};

const trashTypeConfig: Record<TrashItemType, { icon: any; label: string; color: string }> = {
  creativity: { icon: FileText, label: '创意卡片', color: '#6C63FF' },
  folder: { icon: FolderOpen, label: '文件夹', color: '#F59E0B' },
  'canvas-item': { icon: StickyNote, label: '画布便签', color: '#10B981' },
  'board-sticky': { icon: StickyNote, label: '看板便签', color: '#EC4899' },
  chapter: { icon: BookOpen, label: '章节', color: '#3B82F6' },
  volume: { icon: Layers, label: '卷', color: '#8B5CF6' },
  board: { icon: Layout, label: '创意库', color: '#EF4444' },
};

function formatTime(dateStr: string): string {
  const d = new Date(dateStr);
  const now = new Date();
  const diff = now.getTime() - d.getTime();
  const minutes = Math.floor(diff / 60000);
  const hours = Math.floor(diff / 3600000);
  const days = Math.floor(diff / 86400000);
  if (minutes < 1) return '刚刚';
  if (minutes < 60) return `${minutes} 分钟前`;
  if (hours < 24) return `${hours} 小时前`;
  if (days < 30) return `${days} 天前`;
  return d.toLocaleDateString('zh-CN', { year: 'numeric', month: '2-digit', day: '2-digit' });
}

function truncateText(text: string, maxLen: number): string {
  if (!text) return '';
  const clean = text.replace(/\n/g, ' ').trim();
  if (clean.length <= maxLen) return clean;
  return clean.slice(0, maxLen) + '...';
}

const Trash: React.FC = () => {
  const { modal } = AntdApp.useApp();
  const [trashItems, setTrashItems] = useState<TrashItem[]>([]);
  const [creativities, setCreativities] = useState<Creativity[]>([]);
  const [loading, setLoading] = useState(true);
  const [restoringId, setRestoringId] = useState<string | null>(null);
  const [deletingId, setDeletingId] = useState<string | null>(null);
  const [isDragOver, setIsDragOver] = useState(false);
  const [activeTab, setActiveTab] = useState<TrashItemType | 'all'>('all');
  const [batchMode, setBatchMode] = useState(false);
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());

  const fetchTrashData = useCallback(async () => {
    setLoading(true);
    try {
      // 统一从 trash_items 表获取所有已删除项目
      const trashRes = await api.trash.list();
      const trashData = (trashRes as TrashItem[]) || [];
      setTrashItems(trashData);
      // 清空旧的 creativities 数据源（现在所有数据都在 trash_items 中）
      setCreativities([]);
      
      // 先获取并注册所有媒体记录，确保 media:// 引用能解析
      try {
        const mediaList = await api.media.list();
        if (mediaList && Array.isArray(mediaList)) {
          registerMediaPaths(mediaList);
        }
      } catch (e) {
        console.warn('[Trash] 获取媒体列表失败:', e);
      }
      
      // 然后注册所有回收站项目的媒体路径
      for (const item of trashData) {
        if (item.snapshot) {
          extractAndRegisterMediaFromSnapshot(item.snapshot);
        }
      }
    } catch (err) {
      console.error('加载回收站失败:', err);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { fetchTrashData(); }, [fetchTrashData]);

  const allItems = [
    ...creativities.map((c) => {
      const isChapter = (c as any).subtype === 'chapter';
      const chapterType: TrashItemType = isChapter ? 'chapter' : 'creativity';
      const chapterCfg = trashTypeConfig[chapterType];
      return {
        id: `creativity-${c.id}`,
        trashId: null,
        itemType: chapterType,
        itemId: c.id,
        sourceBoardId: (c as any).boardId || null,
        sourceBoardName: null,
        snapshot: c,
        deletedAt: c.updatedAt,
        title: c.title || '',
        subtitle: isChapter ? '写作台章节' : truncateText(c.content, 80),
        typeLabel: isChapter ? (chapterCfg?.label || '章节') : (typeLabelMap[c.type] || c.type),
      };
    }),
    ...trashItems.map((t) => {
      const snap = t.snapshot as any;
      const cfg = trashTypeConfig[t.itemType];
      let title = '';
      let subtitle = '';
      if (t.itemType === 'creativity') { title = snap.title || ''; subtitle = truncateText(snap.content, 80); }
      else if (t.itemType === 'folder') { title = snap.name || '未命名文件夹'; subtitle = `${snap.creativityIds?.length || 0} 个创意`; }
      else if (t.itemType === 'canvas-item') { title = snap.creativityTitle || snap.title || '画布便签'; subtitle = snap.content ? truncateText(snap.content, 60) : `来自: ${t.sourceBoardName || '未知'}`; }
      else if (t.itemType === 'board-sticky') { title = snap.title || '看板便签'; subtitle = snap.content ? truncateText(snap.content, 60) : `来自: ${t.sourceBoardName || '未知'}`; }
      else if (t.itemType === 'chapter') { title = snap.title || '未命名章节'; subtitle = `来自: ${t.sourceBoardName || '未知'}`; }
      else if (t.itemType === 'volume') { title = snap.title || '未命名卷'; subtitle = `来自: ${t.sourceBoardName || '未知'}`; }
      else if (t.itemType === 'board') { title = snap.name || '未命名创意库'; subtitle = `${snap.creativityCount || 0} 个创意`; }
      return {
        id: t.id,
        trashId: t.id,
        itemType: t.itemType,
        itemId: t.itemId,
        sourceBoardId: t.sourceBoardId,
        sourceBoardName: t.sourceBoardName,
        snapshot: t.snapshot,
        deletedAt: t.deletedAt,
        title,
        subtitle,
        typeLabel: cfg?.label || t.itemType,
      };
    }),
  ];

  const filteredItems = activeTab === 'all' ? allItems : allItems.filter((i) => i.itemType === activeTab);

  const trashColumns = [
    {
      title: '',
      key: 'thumbnail',
      width: 56,
      render: (_: any, record: any) => {
        const snap = record.snapshot as any;
        // 检查是否有媒体内容需要显示缩略图（不再限制仅 creativity/chapter 类型）
        const hasMedia = snap?.type === 'image' || snap?.type === 'video' ||
                         snap?.mediaFilePath || snap?.thumbnailPath;

        if (hasMedia) {
          return (
            <ListThumbnailCell
              type={snap?.type || 'text'}
              content={snap?.content}
              mediaFilePath={snap?.mediaFilePath}
              thumbnailPath={snap?.thumbnailPath}
              size={36}
              snapshot={snap}
            />
          );
        }
        const cfg = trashTypeConfig[record.itemType as TrashItemType];
        const Icon = cfg?.icon || FileText;
        const gradient = record.itemType === 'folder'
          ? 'linear-gradient(135deg, #F59E0B 0%, #D97706 100%)'
          : record.itemType === 'canvas-item'
            ? 'linear-gradient(135deg, #10B981 0%, #059669 100%)'
            : record.itemType === 'board-sticky'
              ? 'linear-gradient(135deg, #8B5CF6 0%, #7C3AED 100%)'
              : record.itemType === 'volume'
                ? 'linear-gradient(135deg, #3B82F6 0%, #2563EB 100%)'
                : record.itemType === 'board'
                  ? 'linear-gradient(135deg, #EC4899 0%, #DB2777 100%)'
                  : 'linear-gradient(135deg, #667eea 0%, #764ba2 100%)';
        return (
          <div
            style={{
              width: 36,
              height: 36,
              borderRadius: 6,
              background: gradient,
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              flexShrink: 0,
            }}
          >
            <Icon size={16} color="rgba(255,255,255,0.85)" />
          </div>
        );
      },
    },
    {
      title: '类型',
      dataIndex: 'itemType',
      key: 'itemType',
      width: 100,
      filters: Object.entries(trashTypeConfig).map(([key, cfg]) => ({ text: cfg.label, value: key })),
      onFilter: (value: any, record: any) => record.itemType === value,
      render: (itemType: TrashItemType, record: any) => {
        const cfg = trashTypeConfig[itemType];
        const TypeIcon = itemType === 'creativity' ? (typeIconMap[(record.snapshot as Creativity)?.type] || FileText) : (cfg?.icon || FileText);
        const iconColor = itemType === 'creativity' ? 'var(--primary-color)' : (cfg?.color || 'var(--primary-color)');
        return (
          <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
            <div style={{
              width: 28, height: 28, borderRadius: 6,
              backgroundColor: `${iconColor}15`, display: 'flex', alignItems: 'center',
              justifyContent: 'center', flexShrink: 0,
            }}>
              <TypeIcon size={14} color={iconColor} />
            </div>
            <span style={{ fontSize: 12, color: iconColor }}>{record.typeLabel}</span>
          </div>
        );
      },
    },
    {
      title: '标题',
      dataIndex: 'title',
      key: 'title',
      sorter: (a: any, b: any) => (a.title || '').localeCompare(b.title || '', 'zh-CN'),
      render: (title: string, record: any) => (
        <div>
          <div style={{ fontSize: 13, fontWeight: 500, color: 'var(--text-primary)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
            {title}
          </div>
          {record.subtitle && (
            <div style={{ fontSize: 12, color: 'var(--text-tertiary)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', marginTop: 2 }}>
              {record.subtitle}
            </div>
          )}
        </div>
      ),
    },
    {
      title: '来源',
      dataIndex: 'sourceBoardName',
      key: 'sourceBoardName',
      width: 120,
      render: (name: string) => (
        <span style={{ fontSize: 12, color: name ? 'var(--text-secondary)' : 'var(--text-tertiary)' }}>
          {name || '-'}
        </span>
      ),
    },
    {
      title: '删除时间',
      dataIndex: 'deletedAt',
      key: 'deletedAt',
      width: 140,
      sorter: (a: any, b: any) => new Date(a.deletedAt || 0).getTime() - new Date(b.deletedAt || 0).getTime(),
      render: (date: string) => (
        <span style={{ fontSize: 12, color: 'var(--text-tertiary)', whiteSpace: 'nowrap' }}>
          {formatTime(date)}
        </span>
      ),
    },
    {
      title: '操作',
      key: 'action',
      width: 100,
      fixed: 'right' as const,
      render: (_: any, record: any) => (
        <div style={{ display: 'flex', gap: 4 }}>
          <button
            onClick={() => handleRestore(record)}
            disabled={restoringId === record.id}
            style={{
              padding: '4px 8px', borderRadius: 4, border: 'none',
              background: 'transparent', color: 'var(--text-tertiary)',
              cursor: restoringId === record.id ? 'wait' : 'pointer', fontSize: 12,
              opacity: restoringId === record.id ? 0.5 : 1,
            }}
          >
            <RotateCcw size={14} />
          </button>
          <button
            onClick={() => modal.confirm({
              title: '永久删除',
              content: '此操作不可撤销，确定要永久删除吗？',
              okText: '永久删除',
              cancelText: '取消',
              okButtonProps: { danger: true },
              onOk: () => handlePermanentDelete(record),
            })}
            disabled={deletingId === record.id}
            style={{
              padding: '4px 8px', borderRadius: 4, border: 'none',
              background: 'transparent', color: 'var(--text-tertiary)',
              cursor: deletingId === record.id ? 'wait' : 'pointer', fontSize: 12,
              opacity: deletingId === record.id ? 0.5 : 1,
            }}
          >
            <Trash2 size={14} />
          </button>
        </div>
      ),
    },
  ];

  const typeCounts: Record<string, number> = {};
  for (const item of allItems) { typeCounts[item.itemType] = (typeCounts[item.itemType] || 0) + 1; }

  const handleRestore = async (item: typeof allItems[0]) => {
    setRestoringId(item.id);
    try {
      if (item.itemType === 'creativity' || item.itemType === 'chapter') {
        // 使用新的恢复接口，传入 trashId
        await api.creativity.restore(item.itemId, item.trashId);
      } else {
        const trashItem = trashItems.find((t) => t.id === item.trashId);
        if (!trashItem) return;
        const boardExists = item.sourceBoardId ? await api.trash.checkBoardExists(item.sourceBoardId) : null;
        if (item.sourceBoardId && !boardExists) {
          const boards = await api.board.list();
          const boardList = (boards as any[]) || [];
          if (boardList.length === 0) {
            useUIStore.getState().showToast('error', '没有可用的创意库，无法恢复');
            setRestoringId(null);
            return;
          }
          const boardName = boardList.map((b: any, i: number) => `${i + 1}. ${b.name}`).join('\n');
          const choice = prompt(`来源创意库"${item.sourceBoardName || ''}"已丢失！请选择目标创意库（输入编号）：\n${boardName}`);
          if (!choice) { setRestoringId(null); return; }
          const idx = parseInt(choice) - 1;
          if (idx < 0 || idx >= boardList.length) { useUIStore.getState().showToast('error', '无效选择'); setRestoringId(null); return; }
          const targetBoard = boardList[idx];
          await restoreTrashItemToBoard(trashItem, targetBoard.id, targetBoard.name);
        } else {
          await restoreTrashItemToBoard(trashItem, item.sourceBoardId!, item.sourceBoardName || '');
        }
      }
      fetchTrashData();
    } catch (err) {
      console.error('恢复失败:', err);
    } finally {
      setRestoringId(null);
    }
  };

  const restoreTrashItemToBoard = async (trashItem: TrashItem, boardId: string, boardName: string) => {
    const snap = trashItem.snapshot as any;
    switch (trashItem.itemType) {
      case 'folder': {
        const newFolder = await api.board.folder.create(boardId, snap.name, snap.color);
        if (newFolder && snap.creativityIds?.length) {
          await api.board.folder.addItems((newFolder as any).id, snap.creativityIds);
        }
        break;
      }
      case 'canvas-item': {
        const newItem = await api.board.canvas.addItem(boardId, snap.creativityId, snap.positionX, snap.positionY, snap.width, snap.height, snap.title, snap.content, snap.type, snap.isLinked ?? false);
        if (newItem && snap.edges?.length) {
          for (const edge of snap.edges) {
            await api.board.canvas.addEdge(boardId, edge.sourceItemId, (newItem as any).id, edge.edgeType, edge.sourceConnector, edge.targetConnector);
          }
        }
        break;
      }
      case 'board-sticky': {
        await api.board.sticky.add(boardId, {
          title: snap.title, content: snap.content, color: snap.color,
          positionX: snap.positionX, positionY: snap.positionY,
          width: snap.width, height: snap.height,
          sourceCreativityIds: snap.sourceCreativityIds,
          sortOrder: snap.sortOrder, type: snap.type || 'note',
          creativeChainId: snap.creativeChainId, tags: snap.tags,
        });
        break;
      }
      case 'chapter': {
        await api.creativity.update(trashItem.itemId, { status: 'active' });
        break;
      }
      case 'volume': {
        const volumesStr = localStorage.getItem('mindvault_volumes_' + boardId);
        const volumes = volumesStr ? JSON.parse(volumesStr) : [];
        if (!volumes.find((v: any) => v.id === snap.id)) {
          volumes.push({ id: snap.id, title: snap.title, createdAt: snap.createdAt });
          localStorage.setItem('mindvault_volumes_' + boardId, JSON.stringify(volumes));
        }
        break;
      }
      case 'board': {
        const newBoard = await api.board.create({ name: snap.name, description: snap.description, layout: snap.layout });
        if (newBoard && snap.creativityIds?.length) {
          for (const cId of snap.creativityIds) {
            await api.board.addCreativityRelation((newBoard as any).id, cId);
          }
        }
        break;
      }
    }
    await api.trash.restore(trashItem.id);
  };

  const handlePermanentDelete = async (item: typeof allItems[0]) => {
    setDeletingId(item.id);
    try {
      if (item.itemType === 'creativity' || item.itemType === 'chapter') {
        // 使用新的永久删除接口，传入 trashId
        await api.creativity.permanentDelete(item.itemId, item.trashId);
      } else if (item.trashId) {
        await api.trash.permanentDelete(item.trashId);
      }
      fetchTrashData();
    } catch (err) {
      console.error('永久删除失败:', err);
    } finally {
      setDeletingId(null);
    }
  };

  const handleClearAll = async () => {
    try {
      // 永久删除所有创意/章节类型的回收站项目
      for (const item of allItems) {
        if (item.itemType === 'creativity' || item.itemType === 'chapter') {
          try {
            await api.creativity.permanentDelete(item.itemId, item.trashId);
          } catch (e) {
            console.error('[清空回收站] 永久删除创意失败:', item.itemId, e);
          }
        }
      }
      // 清空所有回收站项目（包括文件夹、画布便签等）
      try {
        await api.trash.clear();
      } catch (e) {
        console.error('[清空回收站] trash.clear 失败:', e);
      }
      setTrashItems([]);
      setCreativities([]);
      useUIStore.getState().showNotification('success', '回收站已清空', '所有项目已永久删除');
    } catch (err) {
      console.error('清空回收站失败:', err);
      useUIStore.getState().showNotification('error', '清空失败', '请稍后重试');
    }
  };

  const toggleSelect = (id: string) => {
    setSelectedIds((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id); else next.add(id);
      return next;
    });
  };

  const toggleSelectAll = () => {
    if (selectedIds.size === filteredItems.length) {
      setSelectedIds(new Set());
    } else {
      setSelectedIds(new Set(filteredItems.map((i) => i.id)));
    }
  };

  const exitBatchMode = () => {
    setBatchMode(false);
    setSelectedIds(new Set());
  };

  const handleBatchRestore = async () => {
    const items = filteredItems.filter((i) => selectedIds.has(i.id));
    for (const item of items) {
      try {
        await handleRestore(item);
      } catch (err) {
        console.error('批量恢复失败:', item.id, err);
      }
    }
    setSelectedIds(new Set());
    setBatchMode(false);
  };

  const handleBatchDelete = async () => {
    const items = filteredItems.filter((i) => selectedIds.has(i.id));
    for (const item of items) {
      try {
        await handlePermanentDelete(item);
      } catch (err) {
        console.error('批量删除失败:', item.id, err);
      }
    }
    setSelectedIds(new Set());
    setBatchMode(false);
  };

  const isDraggingItem = useUIStore((s) => s.isDraggingItem);
  const dragItem = useUIStore((s) => s.dragItem);
  const endDrag = useUIStore((s) => s.endDrag);
  const dragEnded = useUIStore((s) => s.dragEnded);
  const setDragOverTarget = useUIStore((s) => s.setDragOverTarget);

  const handleDragOver = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    e.dataTransfer.dropEffect = 'move';
    setIsDragOver(true);
  }, []);

  const handleDragLeave = useCallback((e: React.DragEvent) => {
    if (e.currentTarget === e.target) setIsDragOver(false);
  }, []);

  const handleDrop = useCallback(async (e: React.DragEvent) => {
    e.preventDefault();
    setIsDragOver(false);
    try {
      const data = e.dataTransfer.getData('application/json');
      if (data) {
        const parsed = JSON.parse(data);
        if (parsed.id) {
          await api.creativity.delete(parsed.id);
          fetchTrashData();
        }
      }
    } catch {}
  }, [fetchTrashData]);

  const handleTrashMouseEnter = useCallback(() => {
    if (isDraggingItem) { setIsDragOver(true); setDragOverTarget('/trash'); }
  }, [isDraggingItem, setDragOverTarget]);

  const handleTrashMouseLeave = useCallback(() => {
    setIsDragOver(false); setDragOverTarget(null);
  }, [setDragOverTarget]);

  const handleTrashMouseUp = useCallback(async (e: React.MouseEvent) => {
    if (!isDraggingItem || !dragItem || dragEnded) return;
    e.stopPropagation();
    setIsDragOver(false);
    try {
      await api.creativity.delete(dragItem.id);
      fetchTrashData();
    } catch {}
    endDrag();
    document.body.style.userSelect = '';
    document.body.style.cursor = '';
  }, [isDraggingItem, dragItem, fetchTrashData, endDrag, dragEnded]);

  const tabs: Array<{ key: TrashItemType | 'all'; label: string }> = [
    { key: 'all', label: '全部' },
    { key: 'creativity', label: '创意' },
    { key: 'folder', label: '文件夹' },
    { key: 'canvas-item', label: '画布' },
    { key: 'board-sticky', label: '看板便签' },
    { key: 'chapter', label: '章节' },
    { key: 'volume', label: '卷' },
    { key: 'board', label: '创意库' },
  ];

  return (
    <div
      onDragOver={handleDragOver} onDragLeave={handleDragLeave} onDrop={handleDrop}
      onMouseEnter={handleTrashMouseEnter} onMouseLeave={handleTrashMouseLeave} onMouseUp={handleTrashMouseUp}
      style={{
        maxWidth: 1000, margin: '0 auto', height: '100%',
        border: isDragOver ? '2px dashed var(--color-danger)' : '2px solid transparent',
        borderRadius: isDragOver ? 'var(--radius-lg)' : 0,
        backgroundColor: isDragOver ? 'var(--primary-bg)' : 'transparent',
        transition: 'all 0.2s ease', padding: '32px 24px',
      }}
    >
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', marginBottom: 20, position: 'relative' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
          <ToiletPaperIcon size={28} color="var(--text-primary)" />
          <h1 style={{ margin: 0, fontSize: 24, fontWeight: 700, color: 'var(--text-primary)' }}>回收站</h1>
          {!loading && allItems.length > 0 && (
            <span style={{ fontSize: 13, color: 'var(--text-tertiary)', backgroundColor: 'var(--bg-secondary)', padding: '2px 10px', borderRadius: 99 }}>
              {allItems.length} 项
            </span>
          )}
        </div>
        {allItems.length > 0 && (
          <div style={{ position: 'absolute', right: 0, top: '50%', transform: 'translateY(-50%)', display: 'flex', alignItems: 'center', gap: 8 }}>
            <button onClick={() => { setBatchMode(!batchMode); setSelectedIds(new Set()); }} style={{
              display: 'flex', alignItems: 'center', gap: 6, padding: '8px 16px',
              borderRadius: 'var(--radius-md, 8px)', border: 'none',
              backgroundColor: batchMode ? 'var(--primary-bg)' : 'transparent',
              color: batchMode ? 'var(--primary-color)' : 'var(--text-secondary)',
              fontSize: 13, cursor: 'pointer', transition: 'all 0.15s ease',
              boxShadow: 'var(--shadow-raised)',
            }}>
              <ListChecks size={14} /> 批量
            </button>
            <button onClick={() => modal.confirm({
              title: '清空回收站',
              content: `确定要清空回收站中的 ${allItems.length} 项吗？此操作不可撤销。`,
              okText: '确认清空',
              cancelText: '取消',
              okButtonProps: { danger: true },
              onOk: handleClearAll,
            })} style={{
              display: 'flex', alignItems: 'center', gap: 6, padding: '8px 16px',
              borderRadius: 'var(--radius-md, 8px)', border: '1px solid var(--border-light, #e5e7eb)',
              backgroundColor: 'transparent', color: 'var(--text-secondary)', fontSize: 13, cursor: 'pointer',
            }}
            onMouseEnter={(e) => { (e.currentTarget as HTMLElement).style.backgroundColor = 'var(--primary-bg)'; (e.currentTarget as HTMLElement).style.borderColor = 'var(--color-danger)'; (e.currentTarget as HTMLElement).style.color = 'var(--color-danger)'; }}
            onMouseLeave={(e) => { (e.currentTarget as HTMLElement).style.backgroundColor = 'transparent'; (e.currentTarget as HTMLElement).style.borderColor = 'var(--border-light)'; (e.currentTarget as HTMLElement).style.color = 'var(--text-secondary)'; }}
            >
              <Trash2 size={14} /> 清空回收站
            </button>
          </div>
        )}
      </div>

      <div style={{ display: 'flex', gap: 4, marginBottom: 20, overflowX: 'auto', paddingBottom: 4 }}>
        {tabs.map((tab) => {
          const count = tab.key === 'all' ? allItems.length : (typeCounts[tab.key] || 0);
          if (tab.key !== 'all' && count === 0) return null;
          const isActive = activeTab === tab.key;
          return (
            <button key={tab.key} onClick={() => setActiveTab(tab.key)} style={{
              display: 'flex', alignItems: 'center', gap: 4, padding: '6px 12px',
              borderRadius: 'var(--radius-md, 8px)', border: 'none',
              backgroundColor: isActive ? 'var(--primary-color)' : 'transparent',
              color: isActive ? 'white' : 'var(--text-secondary)', fontSize: 12,
              cursor: 'pointer', whiteSpace: 'nowrap', transition: 'all 0.15s ease',
            }}>
              {tab.label}
              {count > 0 && <span style={{ fontSize: 10, opacity: 0.8, marginLeft: 2 }}>{count}</span>}
            </button>
          );
        })}
      </div>

      {batchMode && filteredItems.length > 0 && (
        <div style={{
          display: 'flex', alignItems: 'center', gap: 12, marginBottom: 16,
          padding: '10px 16px', borderRadius: 'var(--radius-md)',
          backgroundColor: 'var(--bg-secondary)', border: '1px solid var(--border-color)',
        }}>
          <Checkbox
            indeterminate={selectedIds.size > 0 && selectedIds.size < filteredItems.length}
            checked={selectedIds.size > 0 && selectedIds.size === filteredItems.length}
            onChange={() => toggleSelectAll()}
          >
            {selectedIds.size === filteredItems.length && selectedIds.size > 0 ? '取消全选' : '全选'}
          </Checkbox>
          <span style={{ fontSize: 12, color: 'var(--text-tertiary)' }}>
            已选 {selectedIds.size} / {filteredItems.length} 项
          </span>
          <div style={{ flex: 1 }} />
          {selectedIds.size > 0 && (
            <>
              <button onClick={handleBatchRestore} style={{
                display: 'flex', alignItems: 'center', gap: 4, padding: '6px 14px',
                borderRadius: 'var(--radius-sm)', border: 'none',
                backgroundColor: 'var(--color-success)', color: 'white',
                fontSize: 12, cursor: 'pointer', fontWeight: 500,
              }}>
                <RotateCcw size={13} /> 恢复选中
              </button>
              <button onClick={() => modal.confirm({
                title: '批量永久删除',
                content: `确定要永久删除选中的 ${selectedIds.size} 项吗？此操作不可撤销。`,
                okText: '永久删除',
                cancelText: '取消',
                okButtonProps: { danger: true },
                onOk: handleBatchDelete,
              })} style={{
                display: 'flex', alignItems: 'center', gap: 4, padding: '6px 14px',
                borderRadius: 'var(--radius-sm)', border: 'none',
                backgroundColor: 'var(--color-danger)', color: 'white',
                fontSize: 12, cursor: 'pointer', fontWeight: 500,
              }}>
                <Trash2 size={13} /> 永久删除选中
              </button>
            </>
          )}
          <button onClick={exitBatchMode} style={{
            display: 'flex', alignItems: 'center', justifyContent: 'center',
            width: 28, height: 28, borderRadius: 'var(--radius-sm)',
            border: 'none', backgroundColor: 'var(--bg-tertiary)',
            color: 'var(--text-tertiary)', cursor: 'pointer',
          }}>
            <X size={14} />
          </button>
        </div>
      )}

      <Spin spinning={loading} tip="加载中..." indicator={<GradientSpinner />}>
        <div style={{ minHeight: 400 }}>
        {!loading && allItems.length === 0 && (
          <motion.div 
            initial={{ opacity: 0, y: 12 }} 
            animate={{ opacity: 1, y: 0 }} 
            style={{ 
              width: '100%', 
              display: 'flex', 
              flexDirection: 'column', 
              alignItems: 'center', 
              justifyContent: 'center',
              minHeight: 'calc(100vh - 400px)',
              paddingTop: 40
            }}
          >
            <div style={{ width: 72, height: 72, borderRadius: '50%', backgroundColor: 'var(--bg-secondary)', display: 'flex', alignItems: 'center', justifyContent: 'center', boxShadow: 'var(--shadow-raised)', marginBottom: 16 }}>
              <ToiletIcon size={48} color="var(--text-tertiary)" />
            </div>
            <div style={{ textAlign: 'center' }}>
              <div style={{ fontSize: 16, fontWeight: 500, color: 'var(--text-secondary)', marginBottom: 4 }}>客官速来一泡奇思妙想啊~</div>
              <div style={{ fontSize: 13, color: 'var(--text-tertiary)' }}>拖拽创意到此处，让它随波逐流</div>
            </div>
          </motion.div>
        )}

        {!loading && filteredItems.length > 0 && (
        <Table
          columns={trashColumns}
          dataSource={filteredItems}
          rowKey="id"
          size="small"
          pagination={{ pageSize: 20, showSizeChanger: false, showTotal: (t) => `共 ${t} 条` }}
          scroll={{ x: 'max-content' }}
          rowSelection={batchMode ? {
            selectedRowKeys: Array.from(selectedIds),
            onChange: (keys) => setSelectedIds(new Set(keys as string[])),
          } : undefined}
        />
      )}
      </div>
      </Spin>

    </div>
  );
};

export default Trash;
