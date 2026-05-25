import React, { useState, useCallback, useEffect, useMemo, useRef } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import {
  FolderOpen,
  FolderPlus,
  ChevronRight,
  FileText,
  Image,
  Mic,
  Link as LinkIcon,
  Video,
  Edit3,
  Trash2,
  Copy,
  Tag,
  Clock,
  Layers,
  X,
  Check,
} from 'lucide-react';
import { Spin, Popconfirm, Segmented, Tooltip, Collapse } from 'antd';
import GradientSpinner from '../common/GradientSpinner';
import { useBoardStore } from '../../stores/boardStore';
import { useUIStore } from '../../stores/uiStore';
import { api } from '../../utils/api';
import { formatRelativeTime, truncateText } from '../../utils/formatters';
import type { BoardCustomFolder, Creativity } from '@shared/types';
import { SUBTYPE_CONFIG, getAllSubtypes } from '@shared/types';

// ===== 类型定义 =====

interface FolderViewProps {
  boardId: string;
  refreshKey?: number;
  onCardClick?: (creativity: any) => void;
  onCardContextMenu?: (e: React.MouseEvent, creativity: any) => void;
}

// ===== 分组类型 =====

type GroupMode = 'type' | 'tag' | 'time' | 'subtype';

interface GroupHeader {
  key: string;
  label: string;
  icon: any;
  color: string;
  count: number;
}

// ===== 类型信息映射 =====

const TYPE_INFO: Record<string, { label: string; icon: any; color: string }> = {
  text: { label: '文本创意', icon: FileText, color: '#6C63FF' },
  image: { label: '图片创意', icon: Image, color: '#42A5F5' },
  audio: { label: '音频创意', icon: Mic, color: '#66BB6A' },
  link: { label: '链接收藏', icon: LinkIcon, color: '#FF7043' },
  video: { label: '视频创意', icon: Video, color: '#EC407A' },
};

// ===== 文件夹颜色选项 =====

const FOLDER_COLORS = [
  '#6366f1', '#8b5cf6', '#ec4899', '#ef4444',
  '#f97316', '#eab308', '#22c55e', '#14b8a6',
  '#06b6d4', '#3b82f6',
];

// ===== 组件 =====

const FolderView: React.FC<FolderViewProps> = ({
  boardId,
  refreshKey,
  onCardClick,
  onCardContextMenu,
}) => {
  const {
    customFolders,
    fetchCustomFolders,
    createFolder,
    updateFolder,
    deleteFolder,
    addToFolder,
    removeFromFolder,
    applyFolderToBoard,
  } = useBoardStore();
  const currentBoard = useBoardStore((s) => s.currentBoard);

  const [boardCreativities, setBoardCreativities] = useState<Creativity[]>([]);
  const [loading, setLoading] = useState(true);
  const [hasMore, setHasMore] = useState(false);
  const [currentPage, setCurrentPage] = useState(1);
  const PAGE_SIZE = 100;
  const [isCreatingFolder, setIsCreatingFolder] = useState(false);
  const [newFolderName, setNewFolderName] = useState('');
  const [newFolderColor, setNewFolderColor] = useState(FOLDER_COLORS[0]);
  const newFolderInputRef = useRef<HTMLInputElement>(null);

  // 编辑文件夹状态
  const [editingFolderId, setEditingFolderId] = useState<string | null>(null);
  const [editFolderName, setEditFolderName] = useState('');
  const [editFolderColor, setEditFolderColor] = useState(FOLDER_COLORS[0]);
  const editFolderInputRef = useRef<HTMLInputElement>(null);

  // 分组状态
  const [groupMode, setGroupMode] = useState<GroupMode>('type');
  const [expandedGroups, setExpandedGroups] = useState<Set<string>>(new Set());
  const [expandedFolders, setExpandedFolders] = useState<Set<string>>(new Set());

  // 右键菜单状态
  const [folderContextMenu, setFolderContextMenu] = useState<{
    x: number; y: number; folder: BoardCustomFolder;
  } | null>(null);
  const [blankContextMenu, setBlankContextMenu] = useState<{
    x: number; y: number;
  } | null>(null);
  const [showBoardPicker, setShowBoardPicker] = useState(false);
  const [applyFolderId, setApplyFolderId] = useState<string | null>(null);
  const [otherBoards, setOtherBoards] = useState<any[]>([]);

  // 拖拽状态
  const [dragOverFolderId, setDragOverFolderId] = useState<string | null>(null);
  const [draggingCreativityId, setDraggingCreativityId] = useState<string | null>(null);

  useEffect(() => {
    const load = async () => {
      setLoading(true);
      setCurrentPage(1);
      await fetchCustomFolders(boardId);
      // 优化：限制加载数量，避免大数据量导致卡顿
      const result = await api.creativity.list({
        page: 1,
        pageSize: PAGE_SIZE,
        status: 'active',
      });
      setBoardCreativities(result?.data || []);
      setHasMore((result?.data || []).length >= PAGE_SIZE);
      setLoading(false);
    };
    load();
  }, [boardId, fetchCustomFolders, refreshKey]);

  // 加载更多数据
  const loadMore = async () => {
    if (loading || !hasMore) return;
    const nextPage = currentPage + 1;
    const result = await api.creativity.list({
      page: nextPage,
      pageSize: PAGE_SIZE,
      status: 'active',
    });
    const newData = result?.data || [];
    setBoardCreativities(prev => [...prev, ...newData]);
    setHasMore(newData.length >= PAGE_SIZE);
    setCurrentPage(nextPage);
  };

  useEffect(() => {
    const handleClick = () => {
      setFolderContextMenu(null);
      setBlankContextMenu(null);
    };
    document.addEventListener('click', handleClick);
    return () => document.removeEventListener('click', handleClick);
  }, []);

  useEffect(() => {
    if (isCreatingFolder) {
      setTimeout(() => newFolderInputRef.current?.focus(), 50);
    }
    if (editingFolderId) {
      setTimeout(() => editFolderInputRef.current?.focus(), 50);
    }
  }, [isCreatingFolder, editingFolderId]);

  // 构建文件夹内容映射
  const folderItemsMap = useMemo(() => {
    const map: Record<string, Creativity[]> = {};
    for (const folder of customFolders) {
      map[folder.id] = [];
    }
    for (const c of boardCreativities) {
      if (c.folderId) {
        if (map[c.folderId]) {
          map[c.folderId].push(c);
        }
      }
    }
    return map;
  }, [customFolders, boardCreativities]);

  // 构建自动分组
  const groups = useMemo(() => {
    const allCreativities = boardCreativities;
    const groupMap = new Map<string, Creativity[]>();
    const headers: GroupHeader[] = [];

    if (groupMode === 'type') {
      for (const [type, info] of Object.entries(TYPE_INFO)) {
        const items = allCreativities.filter((c) => c.type === type);
        if (items.length > 0) {
          groupMap.set(type, items);
          headers.push({ key: type, label: info.label, icon: info.icon, color: info.color, count: items.length });
        }
      }
    } else if (groupMode === 'subtype') {
      const subtypeMap = new Map<string, Creativity[]>();
      for (const c of allCreativities) {
        const sub = c.subtype || '__none__';
        if (!subtypeMap.has(sub)) subtypeMap.set(sub, []);
        subtypeMap.get(sub)!.push(c);
      }
      for (const [sub, items] of subtypeMap) {
        const config = sub === '__none__'
          ? { label: '未分类', icon: FileText, color: '#9ca3af' }
          : getAllSubtypes()[sub] || { label: sub, icon: FileText, color: '#999' };
        groupMap.set(sub, items);
        headers.push({ key: sub, label: config.label, icon: config.icon, color: config.color, count: items.length });
      }
    } else if (groupMode === 'time') {
      const now = Date.now();
      const day = 24 * 60 * 60 * 1000;
      const timeGroups: Record<string, { label: string; maxAge: number }> = {
        today: { label: '今天', maxAge: day },
        week: { label: '本周', maxAge: 7 * day },
        month: { label: '本月', maxAge: 30 * day },
        year: { label: '今年', maxAge: 365 * day },
        older: { label: '更早', maxAge: Infinity },
      };
      for (const [key, info] of Object.entries(timeGroups)) {
        const items = allCreativities.filter((c) => {
          const age = now - new Date(c.createdAt).getTime();
          if (key === 'older') return age >= timeGroups.year.maxAge;
          const prevKey = key === 'today' ? null : Object.keys(timeGroups)[Object.keys(timeGroups).indexOf(key) - 1];
          const prevMaxAge = prevKey ? timeGroups[prevKey].maxAge : 0;
          return age >= prevMaxAge && age < info.maxAge;
        });
        if (items.length > 0) {
          groupMap.set(key, items);
          headers.push({ key, label: info.label, icon: Clock, color: '#6C63FF', count: items.length });
        }
      }
    } else if (groupMode === 'tag') {
      const tagMap = new Map<string, Creativity[]>();
      const noTagKey = '__notag__';
      tagMap.set(noTagKey, []);
      for (const c of allCreativities) {
        const tags = c.tags || [];
        if (tags.length === 0) {
          tagMap.get(noTagKey)!.push(c);
        } else {
          for (const tag of tags) {
            if (!tagMap.has(tag.id || tag.name)) tagMap.set(tag.id || tag.name, []);
            tagMap.get(tag.id || tag.name)!.push(c);
          }
        }
      }
      for (const [key, items] of tagMap) {
        if (items.length > 0 || key !== noTagKey) {
          groupMap.set(key, items);
          if (key === noTagKey) {
            headers.push({ key, label: '未分类', icon: Tag, color: '#9ca3af', count: items.length });
          } else {
            headers.push({ key, label: items[0]?.tags?.find((t: any) => (t.id || t.name) === key)?.name || key, icon: Tag, color: '#6C63FF', count: items.length });
          }
        }
      }
    }

    return { headers, groupMap };
  }, [boardCreativities, groupMode]);

  const handleCreateFolder = async () => {
    if (!newFolderName.trim()) return;
    await createFolder(boardId, newFolderName.trim(), newFolderColor);
    setNewFolderName('');
    setIsCreatingFolder(false);
  };

  const startEditFolder = (folder: BoardCustomFolder) => {
    setEditingFolderId(folder.id);
    setEditFolderName(folder.name);
    setEditFolderColor(folder.color);
    setFolderContextMenu(null);
  };

  const saveEditFolder = async () => {
    if (!editFolderName.trim() || !editingFolderId) return;
    await updateFolder(editingFolderId, editFolderName.trim(), editFolderColor);
    setEditingFolderId(null);
  };

  const handleDeleteFolder = async (id: string) => {
    const folder = customFolders.find(f => f.id === id);
    if (folder) {
      try {
        const items = await api.board.folder.getItems(boardId, id);
        const creativityIds = (items || []).map((i: any) => i.id);
        await api.trash.add({
          itemType: 'folder',
          itemId: id,
          sourceBoardId: boardId,
          sourceBoardName: currentBoard?.name || '',
          snapshot: { name: folder.name, color: folder.color, creativityIds },
        });
      } catch {}
    }
    await deleteFolder(id);
    setFolderContextMenu(null);
  };

  const handleApplyToBoard = async (folderId: string) => {
    setApplyFolderId(folderId);
    setFolderContextMenu(null);
    const result = await api.board.list({ page: 1, pageSize: 50 });
    const boards = result?.data || [];
    setOtherBoards(boards.filter((b: any) => b.id !== boardId));
    setShowBoardPicker(true);
  };

  const confirmApplyToBoard = async (targetBoardId: string) => {
    if (applyFolderId) {
      await applyFolderToBoard(applyFolderId, targetBoardId);
    }
    setShowBoardPicker(false);
    setApplyFolderId(null);
  };

  // 拖拽处理
  const handleDragStart = (e: React.DragEvent, creativity: Creativity) => {
    setDraggingCreativityId(creativity.id);
    e.dataTransfer.setData('text/plain', creativity.id);
    e.dataTransfer.effectAllowed = 'move';
  };

  const handleDragOverFolder = (e: React.DragEvent, folderId: string) => {
    e.preventDefault();
    setDragOverFolderId(folderId);
    e.dataTransfer.dropEffect = 'move';
  };

  const handleDropOnFolder = async (e: React.DragEvent, folderId: string) => {
    e.preventDefault();
    setDragOverFolderId(null);
    const cid = e.dataTransfer.getData('text/plain');
    if (cid) {
      await addToFolder(cid, folderId);
    }
  };

  const handleRemoveFromFolder = async (folderId: string, creativityId: string) => {
    await removeFromFolder(creativityId, folderId);
  };

  const renderCreativityItem = (c: Creativity, idx: number, total: number) => {
    const isLast = idx === total - 1;
    const IconComponent = TYPE_INFO[c.type]?.icon || FileText;
    return (
      <button
        key={c.id}
        draggable
        onDragStart={(e) => handleDragStart(e, c)}
        onClick={() => onCardClick?.(c)}
        onContextMenu={(e) => onCardContextMenu?.(e, c)}
        style={{
          width: '100%',
          textAlign: 'left',
          padding: '12px 18px',
          backgroundColor: 'transparent',
          border: 'none',
          borderTop: idx === 0 ? 'none' : '1px solid var(--border-light)',
          cursor: 'pointer',
          display: 'flex',
          alignItems: 'center',
          gap: 12,
          transition: 'background-color 0.15s ease',
        }}
        onMouseEnter={(e) => { (e.currentTarget as HTMLElement).style.backgroundColor = 'var(--bg-hover)'; }}
        onMouseLeave={(e) => { (e.currentTarget as HTMLElement).style.backgroundColor = 'transparent'; }}
      >
        <div
          style={{
            width: 28,
            height: 28,
            borderRadius: 'var(--radius-md)',
            backgroundColor: (TYPE_INFO[c.type]?.color || '#6C63FF') + '15',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            flexShrink: 0,
          }}
        >
          <IconComponent size={16} color={TYPE_INFO[c.type]?.color || '#6C63FF'} />
        </div>
        <div style={{ flex: 1, minWidth: 0 }}>
          <div
            style={{
              fontSize: 13,
              fontWeight: 500,
              color: 'var(--text-primary)',
              whiteSpace: 'nowrap',
              overflow: 'hidden',
              textOverflow: 'ellipsis',
            }}
          >
            {c.title}
          </div>
          <div
            style={{
              fontSize: 11,
              color: 'var(--text-tertiary)',
              display: 'flex',
              alignItems: 'center',
              gap: 8,
              marginTop: 2,
            }}
          >
            <span>{formatRelativeTime(c.createdAt)}</span>
            {c.wordCount != null && c.wordCount > 0 && <span>· {c.wordCount.toLocaleString()} 字</span>}
          </div>
        </div>
        {c.folderId && (
          <Tooltip title="从文件夹中移除">
            <button
              onClick={(e) => { e.stopPropagation(); handleRemoveFromFolder(c.folderId!, c.id); }}
              style={{
                padding: '4px 6px',
                borderRadius: 4,
                backgroundColor: 'transparent',
                color: 'var(--text-tertiary)',
                border: 'none',
                cursor: 'pointer',
                transition: 'all 0.15s ease',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
              }}
              onMouseEnter={(e) => { (e.currentTarget as HTMLElement).style.backgroundColor = 'rgba(239,68,68,0.1)'; (e.currentTarget as HTMLElement).style.color = '#ef4444'; }}
              onMouseLeave={(e) => { (e.currentTarget as HTMLElement).style.backgroundColor = 'transparent'; (e.currentTarget as HTMLElement).style.color = 'var(--text-tertiary)'; }}
            >
              <X size={12} />
            </button>
          </Tooltip>
        )}
      </button>
    );
  };

  const allCreativities = boardCreativities;

  return (
    <Spin spinning={loading} tip="加载中..." indicator={<GradientSpinner />} style={{ height: '100%' }}>
    <motion.div
      initial={{ opacity: 0, y: 8 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.25, ease: 'easeOut' }}
      style={{
        flex: 1,
        overflowY: 'auto',
        padding: 24,
        backgroundColor: 'var(--bg-primary)',
        minHeight: '100%',
      }}
      onContextMenu={(e) => {
        // 只在空白区域触发右键菜单
        if ((e.target as HTMLElement).closest('button, input, [role="button"]')) return;
        e.preventDefault();
        setBlankContextMenu({ x: e.clientX, y: e.clientY });
      }}
    >
      <div style={{ maxWidth: 720, margin: '0 auto' }}>
        {/* ===== 上半部分：自动分组 ===== */}
        {allCreativities.length > 0 && (
          <motion.div
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.3, delay: 0.05 }}
            style={{ marginBottom: 32 }}
          >
            {/* 分组切换按钮 */}
            <div
              style={{
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'space-between',
                marginBottom: 16,
              }}
            >
              <h3
                style={{
                  fontSize: 15,
                  fontWeight: 600,
                  color: 'var(--text-primary)',
                  display: 'flex',
                  alignItems: 'center',
                  gap: 8,
                }}
              >
                <Layers size={16} color="var(--text-secondary)" />
                自动分组
              </h3>
              <Segmented
                value={groupMode}
                onChange={(val) => { setGroupMode(val as GroupMode); setExpandedGroups(new Set()); }}
                options={[
                  { label: '按类型', value: 'type' as GroupMode },
                  { label: '按标签', value: 'tag' as GroupMode },
                  { label: '按时间', value: 'time' as GroupMode },
                  { label: '按子类型', value: 'subtype' as GroupMode },
                ]}
              />
            </div>

            {/* 分组列表 */}
            <Collapse
              activeKey={Array.from(expandedGroups)}
              onChange={(keys) => setExpandedGroups(new Set(keys as string[]))}
              ghost
              expandIcon={({ isActive }) => <ChevronRight size={16} color="var(--text-tertiary)" style={{ transform: `rotate(${isActive ? 90 : 0}deg)`, transition: 'transform 0.2s' }} />}
              items={groups.headers.map((group) => {
                const items = groups.groupMap.get(group.key) || [];
                const GroupIcon = group.icon;
                return {
                  key: group.key,
                  label: (
                    <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
                      <div style={{ width: 36, height: 36, borderRadius: 'var(--radius-md)', backgroundColor: group.color + '15', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
                        {typeof GroupIcon === 'string' ? <span style={{ fontSize: 18 }}>{GroupIcon}</span> : <GroupIcon size={18} color={group.color} />}
                      </div>
                      <span style={{ flex: 1, fontSize: 14, fontWeight: 600 }}>{group.label}</span>
                      <span style={{ fontSize: 12, color: 'var(--text-tertiary)', backgroundColor: 'var(--bg-tertiary)', padding: '2px 10px', borderRadius: 999, fontWeight: 500 }}>{group.count}</span>
                    </div>
                  ),
                  children: (
                    <div style={{ borderTop: '1px solid var(--border-light)', maxHeight: 400, overflowY: 'auto' }}>
                      {items.map((c, idx) => renderCreativityItem(c, idx, items.length))}
                    </div>
                  ),
                };
              })}
            />

            {/* 加载更多 */}
            {hasMore && (
              <div style={{ textAlign: 'center', padding: '16px 0' }}>
                <motion.button
                  whileHover={{ scale: 1.02 }}
                  whileTap={{ scale: 0.98 }}
                  onClick={loadMore}
                  disabled={loading}
                  style={{
                    padding: '8px 24px',
                    borderRadius: 'var(--radius-md)',
                    backgroundColor: 'var(--bg-secondary)',
                    border: '1px solid var(--border-color)',
                    color: 'var(--text-primary)',
                    fontSize: 13,
                    cursor: loading ? 'not-allowed' : 'pointer',
                    opacity: loading ? 0.6 : 1,
                  }}
                >
                  {loading ? '加载中...' : '加载更多'}
                </motion.button>
              </div>
            )}
          </motion.div>
        )}

        {/* ===== 下半部分：自定义文件夹 ===== */}
        <motion.div
          initial={{ opacity: 0, y: 10 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.3, delay: 0.1 }}
        >
          {/* 标题和新建按钮 */}
          <div
            style={{
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'space-between',
              marginBottom: 16,
            }}
          >
            <h3
              style={{
                fontSize: 15,
                fontWeight: 600,
                color: 'var(--text-primary)',
                display: 'flex',
                alignItems: 'center',
                gap: 8,
              }}
            >
              <FolderOpen size={16} color="var(--text-secondary)" />
              自定义文件夹
            </h3>
            {!isCreatingFolder && (
              <div style={{ display: 'flex', gap: 8 }}>
                <motion.button
                  whileHover={{ scale: 1.05 }}
                  whileTap={{ scale: 0.95 }}
                  onClick={() => {
                    setIsCreatingFolder(true);
                    setTimeout(() => newFolderInputRef.current?.focus(), 50);
                  }}
                  style={{
                    display: 'flex',
                    alignItems: 'center',
                    gap: 4,
                    padding: '6px 12px',
                    borderRadius: 'var(--radius-md)',
                    backgroundColor: 'var(--primary-color)',
                    color: '#fff',
                    border: 'none',
                    cursor: 'pointer',
                    fontSize: 12,
                    fontWeight: 500,
                  }}
                >
                  <FolderPlus size={14} />
                  新建文件夹
                </motion.button>
                <motion.button
                  whileHover={{ scale: 1.05 }}
                  whileTap={{ scale: 0.95 }}
                  onClick={() => {
                    // 这里可以添加示例数据功能，暂时保留原逻辑
                  }}
                  style={{
                    display: 'flex',
                    alignItems: 'center',
                    gap: 4,
                    padding: '6px 12px',
                    borderRadius: 'var(--radius-md)',
                    backgroundColor: 'var(--bg-tertiary)',
                    color: 'var(--text-secondary)',
                    border: '1px solid var(--border-light)',
                    cursor: 'pointer',
                    fontSize: 12,
                    fontWeight: 500,
                  }}
                >
                  <Edit3 size={14} />
                  写作项目
                </motion.button>
              </div>
            )}
          </div>

          {/* 新建文件夹输入框 */}
          <AnimatePresence>
            {isCreatingFolder && (
              <motion.div
                initial={{ opacity: 0, scale: 0.95, y: -10 }}
                animate={{ opacity: 1, scale: 1, y: 0 }}
                exit={{ opacity: 0, scale: 0.95, y: -10 }}
                style={{
                  padding: 16,
                  borderRadius: 'var(--radius-lg)',
                  backgroundColor: 'var(--bg-secondary)',
                  border: '1px solid var(--border-light)',
                  marginBottom: 12,
                  display: 'flex',
                  flexDirection: 'column',
                  gap: 12,
                }}
              >
                <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                  <input
                    ref={newFolderInputRef}
                    value={newFolderName}
                    onChange={(e) => setNewFolderName(e.target.value)}
                    onKeyDown={(e) => {
                      if (e.key === 'Enter') handleCreateFolder();
                      if (e.key === 'Escape') setIsCreatingFolder(false);
                    }}
                    placeholder="文件夹名称"
                    style={{
                      flex: 1,
                      padding: '8px 12px',
                      borderRadius: 'var(--radius-md)',
                      border: '1px solid var(--border-color)',
                      backgroundColor: 'var(--bg-primary)',
                      color: 'var(--text-primary)',
                      fontSize: 13,
                      outline: 'none',
                    }}
                  />
                  <motion.button
                    whileHover={{ scale: 1.05 }}
                    whileTap={{ scale: 0.95 }}
                    onClick={handleCreateFolder}
                    disabled={!newFolderName.trim()}
                    style={{
                      padding: '8px 12px',
                      borderRadius: 'var(--radius-md)',
                      backgroundColor: 'var(--primary-color)',
                      color: '#fff',
                      border: 'none',
                      cursor: newFolderName.trim() ? 'pointer' : 'not-allowed',
                      opacity: newFolderName.trim() ? 1 : 0.5,
                      display: 'flex',
                      alignItems: 'center',
                    }}
                  >
                    <Check size={16} />
                  </motion.button>
                  <motion.button
                    whileHover={{ scale: 1.05 }}
                    whileTap={{ scale: 0.95 }}
                    onClick={() => setIsCreatingFolder(false)}
                    style={{
                      padding: '8px 12px',
                      borderRadius: 'var(--radius-md)',
                      backgroundColor: 'var(--bg-tertiary)',
                      color: 'var(--text-secondary)',
                      border: 'none',
                      cursor: 'pointer',
                      display: 'flex',
                      alignItems: 'center',
                    }}
                  >
                    <X size={16} />
                  </motion.button>
                </div>
                {/* 颜色选择 */}
                <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                  <span style={{ fontSize: 12, color: 'var(--text-tertiary)' }}>颜色：</span>
                  {FOLDER_COLORS.map((color, idx) => (
                    <motion.button
                      key={color}
                      initial={{ scale: 0, opacity: 0 }}
                      animate={{ scale: 1, opacity: 1 }}
                      transition={{ delay: idx * 0.03 }}
                      whileHover={{ scale: 1.15 }}
                      whileTap={{ scale: 0.9 }}
                      onClick={() => setNewFolderColor(color)}
                      style={{
                        width: 22,
                        height: 22,
                        borderRadius: '50%',
                        backgroundColor: color,
                        border:
                          newFolderColor === color
                            ? '2px solid var(--text-primary)'
                            : '2px solid transparent',
                        cursor: 'pointer',
                      }}
                    />
                  ))}
                </div>
              </motion.div>
            )}
          </AnimatePresence>

          {/* 文件夹列表 */}
          <Collapse
            activeKey={Array.from(expandedFolders).filter(id => editingFolderId !== id)}
            onChange={(keys) => setExpandedFolders(new Set(keys as string[]))}
            ghost
            expandIcon={({ isActive }) => <ChevronRight size={16} color="var(--text-tertiary)" style={{ transform: `rotate(${isActive ? 0 : -90}deg)`, transition: 'transform 0.2s' }} />}
            items={customFolders.map((folder, index) => {
              const isEditing = editingFolderId === folder.id;
              const isDragOver = dragOverFolderId === folder.id;
              const folderItems = folderItemsMap[folder.id] || [];
              return {
                key: folder.id,
                label: isEditing ? (
                  <div onClick={(e) => e.stopPropagation()} style={{ display: 'flex', flexDirection: 'column', gap: 8, width: '100%' }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                      <input
                        ref={editFolderInputRef}
                        value={editFolderName}
                        onChange={(e) => setEditFolderName(e.target.value)}
                        onKeyDown={(e) => {
                          if (e.key === 'Enter') saveEditFolder();
                          if (e.key === 'Escape') setEditingFolderId(null);
                        }}
                        style={{ flex: 1, padding: '6px 10px', borderRadius: 'var(--radius-sm)', border: '1px solid var(--border-color)', backgroundColor: 'var(--bg-primary)', color: 'var(--text-primary)', fontSize: 13, outline: 'none' }}
                      />
                      <motion.button whileHover={{ scale: 1.05 }} whileTap={{ scale: 0.95 }} onClick={saveEditFolder} style={{ padding: '6px 10px', borderRadius: 'var(--radius-sm)', backgroundColor: 'var(--primary-color)', color: '#fff', border: 'none', cursor: 'pointer', display: 'flex' }}>
                        <Check size={14} />
                      </motion.button>
                      <motion.button whileHover={{ scale: 1.05 }} whileTap={{ scale: 0.95 }} onClick={() => setEditingFolderId(null)} style={{ padding: '6px 10px', borderRadius: 'var(--radius-sm)', backgroundColor: 'var(--bg-tertiary)', color: 'var(--text-secondary)', border: 'none', cursor: 'pointer', display: 'flex' }}>
                        <X size={14} />
                      </motion.button>
                    </div>
                    <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                      <span style={{ fontSize: 12, color: 'var(--text-tertiary)' }}>颜色：</span>
                      {FOLDER_COLORS.map((color, idx) => (
                        <motion.button key={color} initial={{ scale: 0, opacity: 0 }} animate={{ scale: 1, opacity: 1 }} transition={{ delay: idx * 0.02 }} whileHover={{ scale: 1.15 }} whileTap={{ scale: 0.9 }} onClick={() => setEditFolderColor(color)} style={{ width: 20, height: 20, borderRadius: '50%', backgroundColor: color, border: editFolderColor === color ? '2px solid var(--text-primary)' : '2px solid transparent', cursor: 'pointer' }} />
                      ))}
                    </div>
                  </div>
                ) : (
                  <div
                    onContextMenu={(e) => { e.preventDefault(); e.stopPropagation(); setFolderContextMenu({ x: e.clientX, y: e.clientY, folder }); }}
                    onDragOver={(e) => handleDragOverFolder(e, folder.id)}
                    onDragLeave={() => setDragOverFolderId(null)}
                    onDrop={(e) => handleDropOnFolder(e, folder.id)}
                    style={{ display: 'flex', alignItems: 'center', gap: 12, width: '100%' }}
                  >
                    <div style={{ width: 12, height: 12, borderRadius: '50%', backgroundColor: folder.color, flexShrink: 0 }} />
                    <span style={{ flex: 1, fontSize: 14, fontWeight: 500 }}>{folder.name}</span>
                    <span style={{ fontSize: 12, color: 'var(--text-tertiary)', backgroundColor: 'var(--bg-tertiary)', padding: '2px 10px', borderRadius: 999 }}>
                      {folderItems.length} 条 · {folderItems.reduce((sum, c) => sum + (c.wordCount || 0), 0).toLocaleString()} 字
                    </span>
                  </div>
                ),
                children: isEditing ? null : (
                  <div
                    onDragOver={(e) => handleDragOverFolder(e, folder.id)}
                    onDragLeave={() => setDragOverFolderId(null)}
                    onDrop={(e) => handleDropOnFolder(e, folder.id)}
                    style={{ borderTop: '1px solid var(--border-light)', maxHeight: 400, overflowY: 'auto' }}
                  >
                    {folderItems.length > 0 ? (
                      folderItems.map((c, idx) => renderCreativityItem(c, idx, folderItems.length))
                    ) : (
                      <div style={{ padding: '24px 16px', textAlign: 'center', color: 'var(--text-tertiary)', fontSize: 13 }}>
                        拖拽创意到此处完成归类
                      </div>
                    )}
                  </div>
                ),
                style: isDragOver ? { border: '1px solid var(--primary-color)', boxShadow: '0 0 0 2px var(--primary-bg)' } : {},
              };
            })}
          />

          {customFolders.length === 0 && !isCreatingFolder && (
            <motion.div
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.25, delay: 0.1 }}
              style={{
                padding: '32px 16px',
                textAlign: 'center',
                color: 'var(--text-tertiary)',
                fontSize: 13,
                borderRadius: 'var(--radius-lg)',
                border: '1px dashed var(--border-color)',
              }}
            >
              点击"新建文件夹"创建自定义分类
            </motion.div>
          )}
        </motion.div>

      {/* 文件夹右键菜单 */}
      <AnimatePresence>
        {folderContextMenu && (
          <motion.div
            initial={{ opacity: 0, scale: 0.9, y: -10 }}
            animate={{ opacity: 1, scale: 1, y: 0 }}
            exit={{ opacity: 0, scale: 0.9, y: -10 }}
            transition={{ duration: 0.15 }}
            style={{
              position: 'fixed',
              left: folderContextMenu.x,
              top: folderContextMenu.y,
              zIndex: 1000,
              minWidth: 160,
              padding: '4px 0',
              borderRadius: 'var(--radius-md)',
              backgroundColor: 'var(--bg-secondary)',
              border: '1px solid var(--border-light)',
              boxShadow: 'var(--shadow-lg)',
            }}
          >
            <motion.button
              whileHover={{ backgroundColor: 'var(--bg-hover)' }}
              onClick={() => startEditFolder(folderContextMenu.folder)}
              style={{
                width: '100%',
                display: 'flex',
                alignItems: 'center',
                gap: 10,
                padding: '8px 14px',
                border: 'none',
                background: 'none',
                cursor: 'pointer',
                fontSize: 13,
                color: 'var(--text-primary)',
                textAlign: 'left',
              }}
            >
              <Edit3 size={14} color="var(--text-secondary)" />
              编辑
            </motion.button>

            <motion.button
              whileHover={{ backgroundColor: 'var(--bg-hover)' }}
              onClick={() => handleApplyToBoard(folderContextMenu.folder.id)}
              style={{
                width: '100%',
                display: 'flex',
                alignItems: 'center',
                gap: 10,
                padding: '8px 14px',
                border: 'none',
                background: 'none',
                cursor: 'pointer',
                fontSize: 13,
                color: 'var(--text-primary)',
                textAlign: 'left',
              }}
            >
              <Copy size={14} color="var(--text-secondary)" />
              应用到其他看板
            </motion.button>

            <div style={{ height: 1, backgroundColor: 'var(--border-light)', margin: '4px 0' }} />

            <Popconfirm
              title="确定要删除这个文件夹吗？"
              description="删除后可在回收站恢复"
              onConfirm={() => handleDeleteFolder(folderContextMenu.folder.id)}
              okText="删除"
              cancelText="取消"
              okButtonProps={{ danger: true }}
            >
            <motion.button
              whileHover={{ backgroundColor: 'rgba(239,68,68,0.08)' }}
              style={{
                width: '100%',
                display: 'flex',
                alignItems: 'center',
                gap: 10,
                padding: '8px 14px',
                border: 'none',
                background: 'none',
                cursor: 'pointer',
                fontSize: 13,
                color: '#ef4444',
                textAlign: 'left',
              }}
            >
              <Trash2 size={14} />
              删除
            </motion.button>
            </Popconfirm>
          </motion.div>
        )}
      </AnimatePresence>

      {/* 应用到其他看板对话框 */}
      <AnimatePresence>
        {showBoardPicker && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            style={{
              position: 'fixed',
              inset: 0,
              backgroundColor: 'rgba(0,0,0,0.4)',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              zIndex: 2000,
            }}
            onClick={() => {
              setShowBoardPicker(false);
              setApplyFolderId(null);
            }}
          >
            <motion.div
              initial={{ opacity: 0, scale: 0.9, y: -20 }}
              animate={{ opacity: 1, scale: 1, y: 0 }}
              exit={{ opacity: 0, scale: 0.9, y: -20 }}
              transition={{ duration: 0.2 }}
              style={{
                width: 400,
                maxHeight: 500,
                borderRadius: 'var(--radius-xl)',
                backgroundColor: 'var(--bg-secondary)',
                border: '1px solid var(--border-light)',
                boxShadow: 'var(--shadow-xl)',
                overflow: 'hidden',
              }}
              onClick={(e) => e.stopPropagation()}
            >
              <div
                style={{
                  padding: '16px 20px',
                  borderBottom: '1px solid var(--border-light)',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'space-between',
                }}
              >
                <h3
                  style={{
                    fontSize: 15,
                    fontWeight: 600,
                    color: 'var(--text-primary)',
                    margin: 0,
                  }}
                >
                  选择目标看板
                </h3>
                <button
                  onClick={() => {
                    setShowBoardPicker(false);
                    setApplyFolderId(null);
                  }}
                  style={{
                    width: 28,
                    height: 28,
                    borderRadius: 6,
                    border: 'none',
                    backgroundColor: 'transparent',
                    color: 'var(--text-tertiary)',
                    cursor: 'pointer',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    transition: 'all 0.15s ease',
                  }}
                  onMouseEnter={(e) => { (e.currentTarget as HTMLElement).style.backgroundColor = 'var(--bg-hover)'; }}
                  onMouseLeave={(e) => { (e.currentTarget as HTMLElement).style.backgroundColor = 'transparent'; }}
                >
                  <X size={16} />
                </button>
              </div>
              <div style={{ maxHeight: 400, overflowY: 'auto' }}>
                {otherBoards.length > 0 ? (
                  otherBoards.map((board) => (
                    <button
                      key={board.id}
                      onClick={() => confirmApplyToBoard(board.id)}
                      style={{
                        width: '100%',
                        display: 'flex',
                        alignItems: 'center',
                        gap: 10,
                        padding: '12px 20px',
                        border: 'none',
                        borderBottom: '1px solid var(--border-light)',
                        backgroundColor: 'transparent',
                        cursor: 'pointer',
                        textAlign: 'left',
                        transition: 'all 0.15s ease',
                      }}
                      onMouseEnter={(e) => { (e.currentTarget as HTMLElement).style.backgroundColor = 'var(--bg-hover)'; }}
                      onMouseLeave={(e) => { (e.currentTarget as HTMLElement).style.backgroundColor = 'transparent'; }}
                    >
                      <div
                        style={{
                          width: 32,
                          height: 32,
                          borderRadius: 'var(--radius-md)',
                          backgroundColor: (board.color || '#6C63FF') + '20',
                          display: 'flex',
                          alignItems: 'center',
                          justifyContent: 'center',
                          fontSize: 14,
                        }}
                      >
                        {board.emoji || '📝'}
                      </div>
                      <div style={{ flex: 1 }}>
                        <div
                          style={{
                            fontSize: 14,
                            fontWeight: 500,
                            color: 'var(--text-primary)',
                          }}
                        >
                          {board.name}
                        </div>
                        <div
                          style={{
                            fontSize: 11,
                            color: 'var(--text-tertiary)',
                            marginTop: 2,
                          }}
                        >
                          {formatRelativeTime(board.updatedAt || board.createdAt)} 更新
                        </div>
                      </div>
                    </button>
                  ))
                ) : (
                  <div
                    style={{
                      padding: 32,
                      textAlign: 'center',
                      color: 'var(--text-tertiary)',
                      fontSize: 13,
                    }}
                  >
                    没有其他看板可选
                  </div>
                )}
              </div>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* 空白区域右键菜单 */}
      <AnimatePresence>
        {blankContextMenu && (
          <motion.div
            initial={{ opacity: 0, scale: 0.9, y: -10 }}
            animate={{ opacity: 1, scale: 1, y: 0 }}
            exit={{ opacity: 0, scale: 0.9, y: -10 }}
            transition={{ duration: 0.15 }}
            style={{
              position: 'fixed',
              left: blankContextMenu.x,
              top: blankContextMenu.y,
              zIndex: 1000,
              minWidth: 160,
              padding: '4px 0',
              borderRadius: 'var(--radius-md)',
              backgroundColor: 'var(--bg-secondary)',
              border: '1px solid var(--border-light)',
              boxShadow: 'var(--shadow-lg)',
            }}
          >
            <motion.button
              whileHover={{ backgroundColor: 'var(--bg-hover)' }}
              onClick={() => {
                setBlankContextMenu(null);
                setIsCreatingFolder(true);
                setTimeout(() => newFolderInputRef.current?.focus(), 50);
              }}
              style={{
                width: '100%',
                display: 'flex',
                alignItems: 'center',
                gap: 10,
                padding: '8px 14px',
                border: 'none',
                background: 'none',
                cursor: 'pointer',
                fontSize: 13,
                color: 'var(--text-primary)',
                textAlign: 'left',
              }}
            >
              <FolderPlus size={14} color="var(--text-secondary)" />
              新建文件夹
            </motion.button>
          </motion.div>
        )}
      </AnimatePresence>
      </div>
    </motion.div>
    </Spin>
  );
};

export default FolderView;
