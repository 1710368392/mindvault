import React, { useState, useEffect, useMemo, useCallback } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import {
  Search,
  Heart,
  Trash2,
  Upload,
  ArrowUpDown,
  Music,
  ListFilter,
  Star,
  Globe,
  Play,
  Info,
  ListMusic,
  Plus,
  ChevronRight,
  X,
  Pencil,
  ChevronDown,
  BarChart3,
  SlidersHorizontal,
} from 'lucide-react';
import { useMusicStore, MusicTrack } from '../../stores/musicStore';
import { api } from '../../utils/api';
import OnlineSearchPanel from './OnlineSearchPanel';
import PlayStatsPanel from './PlayStatsPanel';
import EqualizerPanel from './EqualizerPanel';
import PlayQueuePanel from './PlayQueuePanel';

interface MusicLibraryPanelProps {
  compact?: boolean;
  onOpenTrackInfo?: (trackId: string, source: 'local' | 'online', editMode?: boolean) => void;
}

type SortKey = 'name' | 'artist' | 'addedAt' | 'duration';
type ViewTab = 'all' | 'favorites' | 'online' | 'queue' | 'eq' | 'stats';

// 歌单类型
interface Playlist {
  id: string;
  name: string;
  description: string;
  coverUrl: string;
  createdAt: number;
  updatedAt: number;
  sortOrder: number;
}

const SORT_OPTIONS: { key: SortKey; label: string }[] = [
  { key: 'name', label: '名称' },
  { key: 'artist', label: '艺术家' },
  { key: 'addedAt', label: '添加时间' },
  { key: 'duration', label: '时长' },
];

const MusicLibraryPanel: React.FC<MusicLibraryPanelProps> = ({ compact = false, onOpenTrackInfo }) => {
  // Store
  const tracks = useMusicStore((s) => s.tracks);
  const currentTrackIndex = useMusicStore((s) => s.currentTrackIndex);
  const isPlaying = useMusicStore((s) => s.isPlaying);
  const favorites = useMusicStore((s) => s.favorites);
  const loadTrack = useMusicStore((s) => s.loadTrack);
  const toggleFavoriteStore = useMusicStore((s) => s.toggleFavorite);
  const addTracks = useMusicStore((s) => s.addTracks);
  const addToQueue = useMusicStore((s) => s.addToQueue);
  const removeTrack = useMusicStore((s) => s.removeTrack);
  const formatTime = useMusicStore((s) => s.formatTime);

  // Local state
  const [searchQuery, setSearchQuery] = useState('');
  const [activeTab, setActiveTab] = useState<ViewTab>('all');
  const [sortKey, setSortKey] = useState<SortKey>('addedAt');
  const [sortAsc, setSortAsc] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const [showSortMenu, setShowSortMenu] = useState(false);
  const [deleteConfirmId, setDeleteConfirmId] = useState<string | null>(null);

  // 右键菜单状态
  const [contextMenu, setContextMenu] = useState<{
    x: number;
    y: number;
    visible: boolean;
    trackId: string | null;
  }>({ x: 0, y: 0, visible: false, trackId: null });

  // 歌单相关状态
  const [playlists, setPlaylists] = useState<Playlist[]>([]);
  const [selectedPlaylistId, setSelectedPlaylistId] = useState<string | null>(null);
  const [playlistTracks, setPlaylistTracks] = useState<MusicTrack[]>([]);
  const [showCreatePlaylist, setShowCreatePlaylist] = useState(false);
  const [newPlaylistName, setNewPlaylistName] = useState('');
  const [playlistMenuTrackId, setPlaylistMenuTrackId] = useState<string | null>(null);
  const [showRenamePlaylist, setShowRenamePlaylist] = useState(false);
  const [renamePlaylistId, setRenamePlaylistId] = useState<string | null>(null);
  const [renamePlaylistName, setRenamePlaylistName] = useState('');
  // 歌单折叠面板状态（只在本地 tab 显示）
  const [playlistCollapsed, setPlaylistCollapsed] = useState(true);
  // 删除歌单确认 tooltip 状态
  const [deleteConfirmPlaylistId, setDeleteConfirmPlaylistId] = useState<string | null>(null);
  const [deleteConfirmPosition, setDeleteConfirmPosition] = useState<{ x: number; y: number }>({ x: 0, y: 0 });

  // 加载歌单列表
  const loadPlaylists = useCallback(async () => {
    try {
      const res = await api.music.getAllPlaylists();
      const data = res?.data || res || [];
      setPlaylists(Array.isArray(data) ? data : []);
    } catch (err) {
      console.warn('[MusicLibraryPanel] 加载歌单失败:', err);
    }
  }, []);

  // 加载歌单曲目
  const loadPlaylistTracks = useCallback(async (playlistId: string) => {
    try {
      const res = await api.music.getPlaylistTracks(playlistId);
      const data = res?.data || res || [];
      const mapped = (Array.isArray(data) ? data : []).map((t: any) => ({
        id: t.id,
        title: t.title || '未知曲目',
        artist: t.artist || '未知艺术家',
        album: t.album || '',
        src: t.filePath || t.src || '',
        duration: t.duration || 0,
        coverUrl: t.coverUrl,
        source: t.source || 'local',
        addedAt: t.addedAt || Date.now(),
      }));
      setPlaylistTracks(mapped);
    } catch (err) {
      console.warn('[MusicLibraryPanel] 加载歌单曲目失败:', err);
      setPlaylistTracks([]);
    }
  }, []);

  // 初始化加载
  useEffect(() => {
    const loadFromDb = async () => {
      setIsLoading(true);
      try {
        const dbTracks = await api.music.getAllTracks();
        if (dbTracks && dbTracks.length > 0) {
          // 合并已有曲目，按 id 去重
          const existingIds = new Set(tracks.map((t) => t.id));
          const newTracks = dbTracks.filter((t: any) => !existingIds.has(t.id));
          if (newTracks.length > 0) {
            addTracks(
              newTracks.map((t: any) => ({
                id: t.id,
                title: t.title || '未知曲目',
                artist: t.artist || '未知艺术家',
                album: t.album || '',
                src: t.filePath || t.src || '',
                duration: t.duration || 0,
                coverUrl: t.coverUrl,
                source: t.source || 'local',
                addedAt: t.addedAt || Date.now(),
              }))
            );
          }
        }
      } catch (err) {
        console.warn('[MusicLibraryPanel] 从数据库加载曲目失败:', err);
      } finally {
        setIsLoading(false);
      }
    };
    loadFromDb();
    loadPlaylists();
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  // 当选中歌单变化时加载歌单曲目
  useEffect(() => {
    if (selectedPlaylistId) {
      loadPlaylistTracks(selectedPlaylistId);
    } else {
      setPlaylistTracks([]);
    }
  }, [selectedPlaylistId, loadPlaylistTracks]);

  // 判断当前是否在歌单视图
  const isPlaylistView = selectedPlaylistId !== null;

  // 当前显示的曲目列表
  const displayTracks = useMemo(() => {
    // 如果在歌单视图，使用歌单曲目
    if (isPlaylistView) {
      let filtered = [...playlistTracks];

      // 搜索过滤
      if (searchQuery.trim()) {
        const q = searchQuery.toLowerCase().trim();
        filtered = filtered.filter(
          (t) =>
            t.title.toLowerCase().includes(q) ||
            t.artist.toLowerCase().includes(q) ||
            (t.album && t.album.toLowerCase().includes(q))
        );
      }

      return filtered;
    }

    let filtered: MusicTrack[] = [...tracks];

    // Tab 过滤
    if (activeTab === 'favorites') {
      filtered = filtered.filter((t) => favorites.includes(t.id));
    }

    // 搜索过滤
    if (searchQuery.trim()) {
      const q = searchQuery.toLowerCase().trim();
      filtered = filtered.filter(
        (t) =>
          t.title.toLowerCase().includes(q) ||
          t.artist.toLowerCase().includes(q) ||
          (t.album && t.album.toLowerCase().includes(q))
      );
    }

    // 排序（歌单视图不排序，保持歌单内顺序）
    filtered.sort((a, b) => {
      let cmp = 0;
      switch (sortKey) {
        case 'name':
          cmp = a.title.localeCompare(b.title, 'zh-CN');
          break;
        case 'artist':
          cmp = a.artist.localeCompare(b.artist, 'zh-CN');
          break;
        case 'addedAt':
          cmp = a.addedAt - b.addedAt;
          break;
        case 'duration':
          cmp = (a.duration || 0) - (b.duration || 0);
          break;
      }
      return sortAsc ? cmp : -cmp;
    });

    return filtered;
  }, [tracks, activeTab, searchQuery, sortKey, sortAsc, favorites, isPlaylistView, playlistTracks]);

  // 导入文件
  const handleImport = useCallback(async () => {
    try {
      const files: any[] = await api.file.selectMultiple([
        { name: '音频文件', extensions: ['mp3', 'wav', 'ogg', 'flac', 'aac', 'm4a'] },
      ]);
      if (!files || files.length === 0) return;

      const filePaths = files.map((f: any) => f.filePath || f.path).filter(Boolean);
      if (filePaths.length === 0) return;

      setIsLoading(true);
      const imported = await api.music.importFiles(filePaths);
      if (imported && imported.length > 0) {
        addTracks(
          imported.map((t: any) => ({
            id: t.id,
            title: t.title || '未知曲目',
            artist: t.artist || '未知艺术家',
            album: t.album || '',
            src: t.filePath || t.src || '',
            duration: t.duration || 0,
            coverUrl: t.coverUrl,
            source: t.source || 'local',
            addedAt: t.addedAt || Date.now(),
          }))
        );
      }
    } catch (err) {
      console.warn('[MusicLibraryPanel] 导入失败:', err);
    } finally {
      setIsLoading(false);
    }
  }, [addTracks]);

  // 切换收藏
  const handleToggleFavorite = useCallback(
    async (id: string, e?: React.MouseEvent) => {
      if (e) e.stopPropagation();
      try {
        await api.music.toggleFavorite(id);
      } catch (err) {
        console.warn('[MusicLibraryPanel] 切换收藏失败:', err);
      }
      toggleFavoriteStore(id);
    },
    [toggleFavoriteStore]
  );

  // 删除曲目
  const handleDelete = useCallback(
    async (id: string, e?: React.MouseEvent) => {
      if (e) e.stopPropagation();
      if (deleteConfirmId === id) {
        // 确认删除
        try {
          await api.music.deleteTrack(id);
        } catch (err) {
          console.warn('[MusicLibraryPanel] 删除失败:', err);
        }
        removeTrack(id);
        setDeleteConfirmId(null);
      } else {
        // 第一次点击 - 显示确认
        setDeleteConfirmId(id);
        setTimeout(() => setDeleteConfirmId(null), 3000);
      }
    },
    [deleteConfirmId, removeTrack]
  );

  // 排序
  const handleSort = useCallback(
    (key: SortKey) => {
      if (sortKey === key) {
        setSortAsc(!sortAsc);
      } else {
        setSortKey(key);
        setSortAsc(false);
      }
      setShowSortMenu(false);
    },
    [sortKey, sortAsc]
  );

  // 点击外部关闭排序菜单
  useEffect(() => {
    if (!showSortMenu) return;
    const handler = (e: MouseEvent) => {
      const target = e.target as HTMLElement;
      if (!target.closest('.sort-menu-container')) {
        setShowSortMenu(false);
      }
    };
    document.addEventListener('mousedown', handler);
    return () => document.removeEventListener('mousedown', handler);
  }, [showSortMenu]);

  // 点击外部关闭右键菜单
  useEffect(() => {
    if (!contextMenu.visible) return;
    const handler = () => {
      setContextMenu((prev) => ({ ...prev, visible: false }));
    };
    // 使用 setTimeout 避免右键事件本身触发关闭
    const timer = setTimeout(() => {
      document.addEventListener('mousedown', handler);
    }, 0);
    return () => {
      clearTimeout(timer);
      document.removeEventListener('mousedown', handler);
    };
  }, [contextMenu.visible]);

  // 点击外部关闭删除歌单确认框
  useEffect(() => {
    if (!deleteConfirmPlaylistId) return;
    const handler = (e: MouseEvent) => {
      const target = e.target as HTMLElement;
      // 如果点击的是确认框内部，则不关闭
      if (target.closest('.delete-confirm-tooltip')) return;
      setDeleteConfirmPlaylistId(null);
    };
    document.addEventListener('mousedown', handler);
    return () => document.removeEventListener('mousedown', handler);
  }, [deleteConfirmPlaylistId]);

  // 右键菜单事件
  const handleContextMenu = useCallback(
    (e: React.MouseEvent, trackId: string) => {
      e.preventDefault();
      e.stopPropagation();
      setContextMenu({
        x: e.clientX,
        y: e.clientY,
        visible: true,
        trackId,
      });
    },
    []
  );

  // 右键菜单 - 播放
  const handleCtxPlay = useCallback(
    (trackId: string) => {
      const storeIndex = tracks.findIndex((t) => t.id === trackId);
      if (storeIndex >= 0) loadTrack(storeIndex, true);
      setContextMenu((prev) => ({ ...prev, visible: false }));
    },
    [tracks, loadTrack]
  );

  // 右键菜单 - 查看信息
  const handleCtxInfo = useCallback(
    (trackId: string) => {
      if (onOpenTrackInfo) {
        onOpenTrackInfo(trackId, 'local', false);
      }
      setContextMenu((prev) => ({ ...prev, visible: false }));
    },
    [onOpenTrackInfo]
  );

  // 右键菜单 - 编辑信息
  const handleCtxEdit = useCallback(
    (trackId: string) => {
      if (onOpenTrackInfo) {
        onOpenTrackInfo(trackId, 'local', true);
      }
      setContextMenu((prev) => ({ ...prev, visible: false }));
    },
    [onOpenTrackInfo]
  );

  // 右键菜单 - 收藏/取消收藏
  const handleCtxFavorite = useCallback(
    (trackId: string) => {
      handleToggleFavorite(trackId);
      setContextMenu((prev) => ({ ...prev, visible: false }));
    },
    [handleToggleFavorite]
  );

  // 右键菜单 - 删除
  const handleCtxDelete = useCallback(
    (trackId: string) => {
      handleDelete(trackId);
      setContextMenu((prev) => ({ ...prev, visible: false }));
    },
    [handleDelete]
  );

  // 右键菜单 - 添加到歌单（直接添加，不再显示子菜单）
  const handleCtxAddToPlaylist = useCallback(
    async (playlistId: string) => {
      if (!playlistMenuTrackId) return;
      try {
        await api.music.addTrackToPlaylist(playlistId, playlistMenuTrackId);
      } catch (err) {
        console.warn('[MusicLibraryPanel] 添加到歌单失败:', err);
      }
      setContextMenu((prev) => ({ ...prev, visible: false }));
      // 如果当前正在查看该歌单，刷新曲目
      if (selectedPlaylistId === playlistId) {
        loadPlaylistTracks(playlistId);
      }
    },
    [playlistMenuTrackId, selectedPlaylistId, loadPlaylistTracks]
  );

  // 创建歌单
  const handleCreatePlaylist = useCallback(async () => {
    const name = newPlaylistName.trim();
    if (!name) return;
    try {
      await api.music.createPlaylist(name);
      setNewPlaylistName('');
      setShowCreatePlaylist(false);
      loadPlaylists();
    } catch (err) {
      console.warn('[MusicLibraryPanel] 创建歌单失败:', err);
    }
  }, [newPlaylistName, loadPlaylists]);

  // 删除歌单
  const handleDeletePlaylist = useCallback(
    async (playlistId: string) => {
      try {
        await api.music.deletePlaylist(playlistId);
        if (selectedPlaylistId === playlistId) {
          setSelectedPlaylistId(null);
        }
        loadPlaylists();
      } catch (err) {
        console.warn('[MusicLibraryPanel] 删除歌单失败:', err);
      }
    },
    [selectedPlaylistId, loadPlaylists]
  );

  // 重命名歌单
  const handleRenamePlaylist = useCallback(async () => {
    if (!renamePlaylistId || !renamePlaylistName.trim()) return;
    try {
      await api.music.updatePlaylist(renamePlaylistId, { name: renamePlaylistName.trim() });
      setShowRenamePlaylist(false);
      setRenamePlaylistId(null);
      setRenamePlaylistName('');
      loadPlaylists();
    } catch (err) {
      console.warn('[MusicLibraryPanel] 重命名歌单失败:', err);
    }
  }, [renamePlaylistId, renamePlaylistName, loadPlaylists]);

  // 查找 store 中的曲目索引
  const getStoreIndex = useCallback(
    (trackId: string) => {
      return tracks.findIndex((t) => t.id === trackId);
    },
    [tracks]
  );

  // 右键菜单样式
  const contextMenuStyle: React.CSSProperties = {
    position: 'fixed',
    left: contextMenu.x,
    top: contextMenu.y,
    zIndex: 200,
    backgroundColor: 'var(--bg-secondary)',
    borderRadius: 8,
    border: '1px solid var(--border-light)',
    boxShadow: '0 8px 24px rgba(0,0,0,0.3)',
    padding: '4px 0',
    minWidth: 140,
  };

  // 菜单项样式
  const menuItemStyle = (isDanger = false): React.CSSProperties => ({
    width: '100%',
    padding: '6px 12px',
    border: 'none',
    backgroundColor: 'transparent',
    color: isDanger ? '#ef4444' : 'var(--text-primary)',
    cursor: 'pointer',
    fontSize: compact ? 10 : 11,
    textAlign: 'left',
    display: 'flex',
    alignItems: 'center',
    gap: 8,
  });

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
      {/* 搜索栏 + 导入按钮（本地 tab 时显示） */}
      {activeTab !== 'online' && (
      <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
        <div
          style={{
            flex: 1,
            display: 'flex',
            alignItems: 'center',
            gap: 6,
            padding: '5px 10px',
            borderRadius: 6,
            backgroundColor: 'var(--bg-tertiary)',
            border: '1px solid var(--border-light)',
          }}
        >
          <Search size={12} style={{ color: 'var(--text-tertiary)', flexShrink: 0 }} />
          <input
            type="text"
            placeholder="搜索曲目、艺术家、专辑..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            style={{
              flex: 1,
              border: 'none',
              background: 'none',
              outline: 'none',
              fontSize: compact ? 10 : 11,
              color: 'var(--text-primary)',
              minWidth: 0,
            }}
          />
          {searchQuery && (
            <motion.button
              initial={{ opacity: 0, scale: 0.8 }}
              animate={{ opacity: 1, scale: 1 }}
              onClick={() => setSearchQuery('')}
              style={{
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                border: 'none',
                background: 'none',
                cursor: 'pointer',
                color: 'var(--text-tertiary)',
                padding: 0,
              }}
            >
              <span style={{ fontSize: 12, lineHeight: 1 }}>&times;</span>
            </motion.button>
          )}
        </div>

        {/* 排序按钮 */}
        <div style={{ position: 'relative' }} className="sort-menu-container">
          <motion.button
            whileHover={{ scale: 1.05 }}
            whileTap={{ scale: 0.95 }}
            onClick={() => setShowSortMenu(!showSortMenu)}
            style={{
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              width: 28,
              height: 28,
              borderRadius: 6,
              border: '1px solid var(--border-light)',
              backgroundColor: 'var(--bg-tertiary)',
              cursor: 'pointer',
              color: 'var(--text-tertiary)',
              flexShrink: 0,
            }}
            title="排序"
          >
            <ArrowUpDown size={12} />
          </motion.button>

          <AnimatePresence>
            {showSortMenu && (
              <motion.div
                initial={{ opacity: 0, scale: 0.9, y: -4 }}
                animate={{ opacity: 1, scale: 1, y: 0 }}
                exit={{ opacity: 0, scale: 0.9, y: -4 }}
                style={{
                  position: 'absolute',
                  top: '100%',
                  right: 0,
                  marginTop: 4,
                  zIndex: 100,
                  backgroundColor: 'var(--bg-secondary)',
                  borderRadius: 8,
                  border: '1px solid var(--border-light)',
                  boxShadow: '0 8px 24px rgba(0,0,0,0.2)',
                  padding: '4px 0',
                  minWidth: 120,
                }}
              >
                {SORT_OPTIONS.map((opt) => (
                  <button
                    key={opt.key}
                    onClick={() => handleSort(opt.key)}
                    style={{
                      width: '100%',
                      padding: '6px 12px',
                      border: 'none',
                      backgroundColor:
                        sortKey === opt.key ? 'var(--bg-hover)' : 'transparent',
                      color:
                        sortKey === opt.key
                          ? 'var(--primary-color)'
                          : 'var(--text-primary)',
                      cursor: 'pointer',
                      fontSize: 11,
                      textAlign: 'left',
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'space-between',
                      gap: 8,
                    }}
                  >
                    <span>{opt.label}</span>
                    {sortKey === opt.key && (
                      <span style={{ fontSize: 9, opacity: 0.6 }}>
                        {sortAsc ? '↑' : '↓'}
                      </span>
                    )}
                  </button>
                ))}
              </motion.div>
            )}
          </AnimatePresence>
        </div>

        {/* 创建歌单按钮 */}
        <motion.button
          whileHover={{ scale: 1.05 }}
          whileTap={{ scale: 0.95 }}
          onClick={() => setShowCreatePlaylist(true)}
          style={{
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            width: 28,
            height: 28,
            borderRadius: 6,
            border: '1px solid var(--border-light)',
            backgroundColor: 'var(--bg-tertiary)',
            cursor: 'pointer',
            color: 'var(--text-tertiary)',
            flexShrink: 0,
          }}
          title="创建歌单"
        >
          <Plus size={12} />
        </motion.button>

        {/* 导入按钮 */}
        <motion.button
          whileHover={{ scale: 1.05 }}
          whileTap={{ scale: 0.95 }}
          onClick={handleImport}
          disabled={isLoading}
          style={{
            display: 'flex',
            alignItems: 'center',
            gap: 4,
            padding: '5px 10px',
            borderRadius: 6,
            backgroundColor: 'var(--primary-color)',
            color: 'white',
            border: 'none',
            cursor: isLoading ? 'wait' : 'pointer',
            fontSize: compact ? 10 : 11,
            fontWeight: 500,
            flexShrink: 0,
            opacity: isLoading ? 0.7 : 1,
          }}
        >
          <Upload size={10} />
          {compact ? '导入' : '导入文件'}
        </motion.button>
      </div>
      )}

      {/* 创建歌单弹窗 */}
      <AnimatePresence>
        {showCreatePlaylist && (
          <motion.div
            initial={{ opacity: 0, y: -8 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -8 }}
            style={{
              display: 'flex',
              alignItems: 'center',
              gap: 6,
              padding: '6px 10px',
              borderRadius: 8,
              backgroundColor: 'var(--bg-tertiary)',
              border: '1px solid var(--border-light)',
            }}
          >
            <ListMusic size={12} style={{ color: 'var(--text-tertiary)', flexShrink: 0 }} />
            <input
              type="text"
              placeholder="输入歌单名称..."
              value={newPlaylistName}
              onChange={(e) => setNewPlaylistName(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === 'Enter') handleCreatePlaylist();
                if (e.key === 'Escape') setShowCreatePlaylist(false);
              }}
              autoFocus
              style={{
                flex: 1,
                border: 'none',
                background: 'none',
                outline: 'none',
                fontSize: compact ? 10 : 11,
                color: 'var(--text-primary)',
                minWidth: 0,
              }}
            />
            <motion.button
              whileHover={{ scale: 1.1 }}
              whileTap={{ scale: 0.9 }}
              onClick={handleCreatePlaylist}
              style={{
                padding: '2px 8px',
                borderRadius: 4,
                border: 'none',
                backgroundColor: 'var(--primary-color)',
                color: 'white',
                cursor: 'pointer',
                fontSize: compact ? 9 : 10,
                flexShrink: 0,
              }}
            >
              创建
            </motion.button>
            <motion.button
              whileHover={{ scale: 1.1 }}
              whileTap={{ scale: 0.9 }}
              onClick={() => {
                setShowCreatePlaylist(false);
                setNewPlaylistName('');
              }}
              style={{
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                border: 'none',
                background: 'none',
                cursor: 'pointer',
                color: 'var(--text-tertiary)',
                padding: 0,
                flexShrink: 0,
              }}
            >
              <X size={12} />
            </motion.button>
          </motion.div>
        )}
      </AnimatePresence>

      {/* 重命名歌单弹窗 */}
      <AnimatePresence>
        {showRenamePlaylist && (
          <motion.div
            initial={{ opacity: 0, y: -8 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -8 }}
            style={{
              display: 'flex',
              alignItems: 'center',
              gap: 6,
              padding: '6px 10px',
              borderRadius: 8,
              backgroundColor: 'var(--bg-tertiary)',
              border: '1px solid var(--border-light)',
            }}
          >
            <Pencil size={12} style={{ color: 'var(--text-tertiary)', flexShrink: 0 }} />
            <input
              type="text"
              placeholder="输入新名称..."
              value={renamePlaylistName}
              onChange={(e) => setRenamePlaylistName(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === 'Enter') handleRenamePlaylist();
                if (e.key === 'Escape') {
                  setShowRenamePlaylist(false);
                  setRenamePlaylistId(null);
                  setRenamePlaylistName('');
                }
              }}
              autoFocus
              style={{
                flex: 1,
                border: 'none',
                background: 'none',
                outline: 'none',
                fontSize: compact ? 10 : 11,
                color: 'var(--text-primary)',
                minWidth: 0,
              }}
            />
            <motion.button
              whileHover={{ scale: 1.1 }}
              whileTap={{ scale: 0.9 }}
              onClick={handleRenamePlaylist}
              style={{
                padding: '2px 8px',
                borderRadius: 4,
                border: 'none',
                backgroundColor: 'var(--primary-color)',
                color: 'white',
                cursor: 'pointer',
                fontSize: compact ? 9 : 10,
                flexShrink: 0,
              }}
            >
              保存
            </motion.button>
            <motion.button
              whileHover={{ scale: 1.1 }}
              whileTap={{ scale: 0.9 }}
              onClick={() => {
                setShowRenamePlaylist(false);
                setRenamePlaylistId(null);
                setRenamePlaylistName('');
              }}
              style={{
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                border: 'none',
                background: 'none',
                cursor: 'pointer',
                color: 'var(--text-tertiary)',
                padding: 0,
                flexShrink: 0,
              }}
            >
              <X size={12} />
            </motion.button>
          </motion.div>
        )}
      </AnimatePresence>

      {/* View tabs */}
      <div
        style={{
          display: 'flex',
          alignItems: 'center',
          gap: 2,
          padding: '2px',
          borderRadius: 6,
          backgroundColor: 'var(--bg-tertiary)',
        }}
      >
        {[
          { key: 'all' as ViewTab, label: '本地', icon: ListFilter },
          { key: 'favorites' as ViewTab, label: '收藏', icon: Star },
          { key: 'online' as ViewTab, label: '在线', icon: Globe },
          { key: 'queue' as ViewTab, label: '队列', icon: ListMusic },
          { key: 'eq' as ViewTab, label: '均衡器', icon: SlidersHorizontal },
          { key: 'stats' as ViewTab, label: '统计', icon: BarChart3 },
        ].map((tab) => (
          <button
            key={tab.key}
            onClick={() => {
              setActiveTab(tab.key);
              // 切换 tab 时清空歌单选择和折叠状态
              if (tab.key !== 'all') {
                setSelectedPlaylistId(null);
                setPlaylistCollapsed(true);
              }
            }}
            style={{
              flex: 1,
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              gap: 4,
              padding: '4px 8px',
              borderRadius: 5,
              border: 'none',
              backgroundColor:
                activeTab === tab.key && !isPlaylistView ? 'var(--bg-secondary)' : 'transparent',
              color:
                activeTab === tab.key && !isPlaylistView
                  ? 'var(--primary-color)'
                  : 'var(--text-tertiary)',
              cursor: 'pointer',
              fontSize: compact ? 10 : 11,
              fontWeight: activeTab === tab.key && !isPlaylistView ? 600 : 400,
              boxShadow:
                activeTab === tab.key && !isPlaylistView
                  ? '0 1px 3px rgba(0,0,0,0.1)'
                  : 'none',
              transition: 'all 0.15s ease',
            }}
          >
            <tab.icon size={compact ? 10 : 11} />
            {tab.label}
          </button>
        ))}
      </div>

      {/* 在线搜索面板 / 统计面板 */}
      {activeTab === 'online' ? (
        <OnlineSearchPanel />
      ) : activeTab === 'queue' ? (
        <div style={{ flex: 1, overflow: 'auto' }}>
          <PlayQueuePanel />
        </div>
      ) : activeTab === 'eq' ? (
        <div style={{ flex: 1, overflow: 'auto' }}>
          <EqualizerPanel />
        </div>
      ) : activeTab === 'stats' ? (
        <div style={{ flex: 1, overflow: 'auto' }}>
          <PlayStatsPanel />
        </div>
      ) : (
        <>
          {/* 歌单折叠面板（只在本地 tab 显示） */}
          <AnimatePresence>
            {activeTab === 'all' && playlists.length > 0 && (
              <motion.div
                initial={{ opacity: 0, height: 0 }}
                animate={{ opacity: 1, height: 'auto' }}
                exit={{ opacity: 0, height: 0 }}
                style={{ overflow: 'hidden' }}
              >
                {/* 歌单折叠面板头部 */}
                <motion.div
                  whileHover={{ backgroundColor: 'var(--bg-hover)' }}
                  onClick={() => setPlaylistCollapsed(!playlistCollapsed)}
                  style={{
                    display: 'flex',
                    alignItems: 'center',
                    gap: 6,
                    padding: '6px 8px',
                    borderRadius: 6,
                    cursor: 'pointer',
                    backgroundColor: 'var(--bg-tertiary)',
                    marginBottom: 4,
                  }}
                >
                  <motion.div
                    animate={{ rotate: playlistCollapsed ? 0 : 90 }}
                    transition={{ duration: 0.2 }}
                  >
                    <ChevronRight size={12} style={{ color: 'var(--text-tertiary)' }} />
                  </motion.div>
                  <ListMusic size={12} style={{ color: 'var(--text-secondary)' }} />
                  <span style={{ fontSize: 11, fontWeight: 500, color: 'var(--text-primary)', flex: 1 }}>
                    歌单
                  </span>
                  <span style={{ fontSize: 10, color: 'var(--text-tertiary)' }}>
                    {playlists.length} 个
                  </span>
                </motion.div>

                {/* 歌单列表 */}
                <AnimatePresence>
                  {!playlistCollapsed && (
                    <motion.div
                      initial={{ opacity: 0, height: 0 }}
                      animate={{ opacity: 1, height: 'auto' }}
                      exit={{ opacity: 0, height: 0 }}
                      style={{
                        display: 'flex',
                        flexWrap: 'wrap',
                        gap: 6,
                        padding: '0 4px 6px',
                        overflow: 'hidden',
                      }}
                    >
                      {/* 创建歌单按钮 */}
                      <motion.button
                        whileHover={{ scale: 1.03 }}
                        whileTap={{ scale: 0.97 }}
                        onClick={() => setShowCreatePlaylist(true)}
                        style={{
                          display: 'flex',
                          alignItems: 'center',
                          gap: 4,
                          padding: '5px 10px',
                          borderRadius: 8,
                          border: '1px dashed var(--border-light)',
                          backgroundColor: 'transparent',
                          cursor: 'pointer',
                          color: 'var(--text-tertiary)',
                          fontSize: 10,
                        }}
                      >
                        <Plus size={10} />
                        创建歌单
                      </motion.button>

                      {/* 歌单列表 */}
                      {playlists.map((pl) => (
                        <div key={pl.id} style={{ position: 'relative' }}>
                          <motion.button
                            whileHover={{ scale: 1.02 }}
                            whileTap={{ scale: 0.98 }}
                            onClick={() => setSelectedPlaylistId(pl.id)}
                            onContextMenu={(e) => {
                              e.preventDefault();
                              // 显示删除确认 tooltip
                              setDeleteConfirmPosition({ x: e.clientX, y: e.clientY });
                              setDeleteConfirmPlaylistId(pl.id);
                            }}
                            style={{
                              display: 'flex',
                              alignItems: 'center',
                              gap: 4,
                              padding: '5px 10px',
                              borderRadius: 8,
                              border: selectedPlaylistId === pl.id
                                ? '1px solid var(--primary-color)'
                                : '1px solid var(--border-light)',
                              backgroundColor: selectedPlaylistId === pl.id
                                ? 'rgba(124, 58, 237, 0.08)'
                                : 'var(--bg-tertiary)',
                              color: selectedPlaylistId === pl.id
                                ? 'var(--primary-color)'
                                : 'var(--text-primary)',
                              cursor: 'pointer',
                              fontSize: 10,
                              fontWeight: selectedPlaylistId === pl.id ? 500 : 400,
                              transition: 'all 0.15s ease',
                            }}
                          >
                            <ListMusic size={10} />
                            <span
                              style={{
                                maxWidth: 80,
                                overflow: 'hidden',
                                textOverflow: 'ellipsis',
                                whiteSpace: 'nowrap',
                              }}
                            >
                              {pl.name}
                            </span>
                          </motion.button>

                          {/* 删除歌单确认 Tooltip */}
                          <AnimatePresence>
                            {deleteConfirmPlaylistId === pl.id && (
                              <motion.div
                                className="delete-confirm-tooltip"
                                initial={{ opacity: 0, scale: 0.9 }}
                                animate={{ opacity: 1, scale: 1 }}
                                exit={{ opacity: 0, scale: 0.9 }}
                                style={{
                                  position: 'fixed',
                                  left: deleteConfirmPosition.x,
                                  top: deleteConfirmPosition.y,
                                  background: 'var(--bg-primary)',
                                  border: '1px solid var(--border-light)',
                                  borderRadius: 8,
                                  padding: '8px 12px',
                                  boxShadow: '0 4px 12px rgba(0,0,0,0.15)',
                                  zIndex: 1000,
                                  display: 'flex',
                                  flexDirection: 'column',
                                  gap: 8,
                                  minWidth: 180,
                                }}
                              >
                                <span style={{ fontSize: 12, color: 'var(--text-primary)' }}>
                                  确定删除歌单"{pl.name}"？
                                </span>
                                <div style={{ display: 'flex', gap: 8, justifyContent: 'flex-end' }}>
                                  <button
                                    onClick={() => setDeleteConfirmPlaylistId(null)}
                                    style={{
                                      padding: '4px 10px',
                                      borderRadius: 4,
                                      border: '1px solid var(--border-light)',
                                      backgroundColor: 'transparent',
                                      color: 'var(--text-secondary)',
                                      cursor: 'pointer',
                                      fontSize: 11,
                                    }}
                                  >
                                    取消
                                  </button>
                                  <button
                                    onClick={() => {
                                      handleDeletePlaylist(pl.id);
                                      setDeleteConfirmPlaylistId(null);
                                    }}
                                    style={{
                                      padding: '4px 10px',
                                      borderRadius: 4,
                                      border: 'none',
                                      backgroundColor: '#ef4444',
                                      color: 'white',
                                      cursor: 'pointer',
                                      fontSize: 11,
                                    }}
                                  >
                                    删除
                                  </button>
                                </div>
                              </motion.div>
                            )}
                          </AnimatePresence>
                        </div>
                      ))}
                    </motion.div>
                  )}
                </AnimatePresence>
              </motion.div>
            )}
          </AnimatePresence>


        </>
      )}

      {/* 曲目数量 */}
      <div
        style={{
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          padding: '0 2px',
        }}
      >
        <span style={{ fontSize: 10, color: 'var(--text-tertiary)' }}>
          {isPlaylistView
            ? `${playlists.find((p) => p.id === selectedPlaylistId)?.name || '歌单'} - ${displayTracks.length} 首曲目`
            : `${displayTracks.length} 首曲目`}
        </span>
        {searchQuery && (
          <span style={{ fontSize: 10, color: 'var(--text-tertiary)' }}>
            搜索: &quot;{searchQuery}&quot;
          </span>
        )}
      </div>

      {/* 曲目列表 */}
      <div
        style={{
          display: 'flex',
          flexDirection: 'column',
          gap: 1,
          maxHeight: compact ? 180 : 320,
          overflow: 'auto',
          overflowX: 'hidden',
        }}
      >
        {isLoading && displayTracks.length === 0 ? (
          <div
            style={{
              display: 'flex',
              flexDirection: 'column',
              alignItems: 'center',
              justifyContent: 'center',
              padding: '24px 0',
              gap: 8,
            }}
          >
            <motion.div
              animate={{ rotate: 360 }}
              transition={{ duration: 1.5, repeat: Infinity, ease: 'linear' }}
            >
              <Music size={20} style={{ color: 'var(--text-tertiary)' }} />
            </motion.div>
            <span style={{ fontSize: 11, color: 'var(--text-tertiary)' }}>
              加载中...
            </span>
          </div>
        ) : displayTracks.length === 0 ? (
          <div
            style={{
              display: 'flex',
              flexDirection: 'column',
              alignItems: 'center',
              justifyContent: 'center',
              padding: '24px 0',
              gap: 8,
            }}
          >
            <Music size={20} style={{ color: 'var(--text-tertiary)', opacity: 0.4 }} />
            <span style={{ fontSize: 11, color: 'var(--text-tertiary)' }}>
              {isPlaylistView
                ? '歌单为空，右键曲目可添加到歌单'
                : activeTab === 'favorites'
                  ? '暂无收藏曲目'
                  : searchQuery
                    ? '未找到匹配曲目'
                    : '暂无曲目，点击导入'}
            </span>
          </div>
        ) : (
          displayTracks.map((track, idx) => {
            const storeIndex = getStoreIndex(track.id);
            const isActive = storeIndex === currentTrackIndex;
            const isFav = favorites.includes(track.id);
            const isDeleteConfirm = deleteConfirmId === track.id;

            if (compact) {
              // 紧凑布局：单行
              return (
                <motion.div
                  key={track.id}
                  whileHover={{ backgroundColor: 'var(--bg-hover)' }}
                  onClick={() => {
                    if (storeIndex >= 0) loadTrack(storeIndex, true);
                  }}
                  onContextMenu={(e) => handleContextMenu(e, track.id)}
                  style={{
                    display: 'flex',
                    alignItems: 'center',
                    gap: 6,
                    padding: '5px 8px',
                    borderRadius: 6,
                    cursor: 'pointer',
                    backgroundColor: isActive
                      ? 'var(--bg-tertiary)'
                      : 'transparent',
                    border: isActive
                      ? '1px solid var(--primary-color)'
                      : '1px solid transparent',
                    transition: 'border-color 0.15s ease',
                  }}
                >
                  {/* 曲目序号 / 播放指示器 */}
                  <span
                    style={{
                      fontSize: 10,
                      fontWeight: isActive ? 700 : 400,
                      color: isActive
                        ? 'var(--primary-color)'
                        : 'var(--text-tertiary)',
                      width: 16,
                      textAlign: 'center',
                      flexShrink: 0,
                    }}
                  >
                    {isActive && isPlaying ? '\u266A' : idx + 1}
                  </span>

                  {/* 标题 - 艺术家 */}
                  <div style={{ flex: 1, minWidth: 0 }}>
                    <span
                      style={{
                        fontSize: 11,
                        fontWeight: isActive ? 600 : 400,
                        color: isActive
                          ? 'var(--primary-color)'
                          : 'var(--text-primary)',
                        overflow: 'hidden',
                        textOverflow: 'ellipsis',
                        whiteSpace: 'nowrap',
                        display: 'block',
                      }}
                    >
                      {track.title}
                      {track.artist && (
                        <span style={{ color: 'var(--text-tertiary)', fontWeight: 400 }}>
                          {' - '}{track.artist}
                        </span>
                      )}
                    </span>
                  </div>

                  {/* 时长 */}
                  {track.duration != null && track.duration > 0 && (
                    <span
                      style={{
                        fontSize: 9,
                        color: 'var(--text-tertiary)',
                        fontVariantNumeric: 'tabular-nums',
                        flexShrink: 0,
                        marginRight: 2,
                      }}
                    >
                      {formatTime(track.duration)}
                    </span>
                  )}

                  {/* 收藏按钮 */}
                  <motion.button
                    whileHover={{ scale: 1.2 }}
                    whileTap={{ scale: 0.9 }}
                    onClick={(e) => handleToggleFavorite(track.id, e)}
                    style={{
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'center',
                      border: 'none',
                      background: 'none',
                      cursor: 'pointer',
                      color: isFav
                        ? 'var(--primary-color)'
                        : 'var(--text-tertiary)',
                      padding: 0,
                      flexShrink: 0,
                      opacity: isFav ? 1 : 0.5,
                    }}
                  >
                    <Heart
                      size={11}
                      fill={isFav ? 'var(--primary-color)' : 'none'}
                    />
                  </motion.button>

                  {/* 删除按钮 */}
                  <motion.button
                    whileHover={{ scale: 1.2 }}
                    whileTap={{ scale: 0.9 }}
                    onClick={(e) => handleDelete(track.id, e)}
                    style={{
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'center',
                      border: 'none',
                      background: 'none',
                      cursor: 'pointer',
                      color: isDeleteConfirm
                        ? '#ef4444'
                        : 'var(--text-tertiary)',
                      padding: 0,
                      flexShrink: 0,
                      opacity: isDeleteConfirm ? 1 : 0.4,
                    }}
                    title={isDeleteConfirm ? '再次点击确认删除' : '删除'}
                  >
                    <Trash2 size={11} />
                  </motion.button>
                </motion.div>
              );
            }

            // 完整布局：双行
            return (
              <motion.div
                key={track.id}
                whileHover={{ backgroundColor: 'var(--bg-hover)' }}
                onClick={() => {
                  if (storeIndex >= 0) loadTrack(storeIndex, true);
                }}
                onContextMenu={(e) => handleContextMenu(e, track.id)}
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  gap: 8,
                  padding: '8px 10px',
                  borderRadius: 8,
                  cursor: 'pointer',
                  backgroundColor: isActive
                    ? 'var(--bg-tertiary)'
                    : 'transparent',
                  border: isActive
                    ? '1px solid var(--primary-color)'
                    : '1px solid transparent',
                  transition: 'border-color 0.15s ease',
                }}
              >
                {/* 曲目序号 / 播放指示器 */}
                <span
                  style={{
                    fontSize: 11,
                    fontWeight: isActive ? 700 : 400,
                    color: isActive
                      ? 'var(--primary-color)'
                      : 'var(--text-tertiary)',
                    width: 20,
                    textAlign: 'center',
                    flexShrink: 0,
                    paddingTop: 2,
                  }}
                >
                  {isActive && isPlaying ? '\u266A' : idx + 1}
                </span>

                {/* 标题 + 艺术家/专辑 */}
                <div style={{ flex: 1, minWidth: 0 }}>
                  <div
                    style={{
                      fontSize: 12,
                      fontWeight: isActive ? 600 : 500,
                      color: isActive
                        ? 'var(--primary-color)'
                        : 'var(--text-primary)',
                      overflow: 'hidden',
                      textOverflow: 'ellipsis',
                      whiteSpace: 'nowrap',
                    }}
                  >
                    {track.title}
                  </div>
                  <div
                    style={{
                      fontSize: 10,
                      color: 'var(--text-tertiary)',
                      overflow: 'hidden',
                      textOverflow: 'ellipsis',
                      whiteSpace: 'nowrap',
                      marginTop: 1,
                    }}
                  >
                    {[track.artist, track.album].filter(Boolean).join(' - ')}
                  </div>
                </div>

                {/* 时长 */}
                {track.duration != null && track.duration > 0 && (
                  <span
                    style={{
                      fontSize: 10,
                      color: 'var(--text-tertiary)',
                      fontVariantNumeric: 'tabular-nums',
                      flexShrink: 0,
                      marginRight: 4,
                    }}
                  >
                    {formatTime(track.duration)}
                  </span>
                )}

                {/* 收藏按钮 */}
                <motion.button
                  whileHover={{ scale: 1.2 }}
                  whileTap={{ scale: 0.9 }}
                  onClick={(e) => handleToggleFavorite(track.id, e)}
                  style={{
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    border: 'none',
                    background: 'none',
                    cursor: 'pointer',
                    color: isFav
                      ? 'var(--primary-color)'
                      : 'var(--text-tertiary)',
                    padding: 2,
                    flexShrink: 0,
                    opacity: isFav ? 1 : 0.5,
                  }}
                >
                  <Heart
                    size={13}
                    fill={isFav ? 'var(--primary-color)' : 'none'}
                  />
                </motion.button>

                {/* 删除按钮 */}
                <motion.button
                  whileHover={{ scale: 1.2 }}
                  whileTap={{ scale: 0.9 }}
                  onClick={(e) => handleDelete(track.id, e)}
                  style={{
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    border: 'none',
                    background: 'none',
                    cursor: 'pointer',
                    color: isDeleteConfirm
                      ? '#ef4444'
                      : 'var(--text-tertiary)',
                    padding: 2,
                    flexShrink: 0,
                    opacity: isDeleteConfirm ? 1 : 0.4,
                  }}
                  title={isDeleteConfirm ? '再次点击确认删除' : '删除'}
                >
                  <Trash2 size={13} />
                </motion.button>
              </motion.div>
            );
          })
        )}
      </div>

      {/* 右键菜单 */}
      <AnimatePresence>
        {contextMenu.visible && contextMenu.trackId && (
          <motion.div
            initial={{ opacity: 0, scale: 0.9 }}
            animate={{ opacity: 1, scale: 1 }}
            exit={{ opacity: 0, scale: 0.9 }}
            style={contextMenuStyle}
          >
            {/* 播放 */}
            <button
              onClick={() => handleCtxPlay(contextMenu.trackId!)}
              style={menuItemStyle()}
              onMouseEnter={(e) => {
                (e.currentTarget as HTMLElement).style.backgroundColor = 'var(--bg-hover)';
              }}
              onMouseLeave={(e) => {
                (e.currentTarget as HTMLElement).style.backgroundColor = 'transparent';
              }}
            >
              <Play size={12} />
              播放
            </button>

            {/* 查看信息 */}
            <button
              onClick={() => handleCtxInfo(contextMenu.trackId!)}
              style={menuItemStyle()}
              onMouseEnter={(e) => {
                (e.currentTarget as HTMLElement).style.backgroundColor = 'var(--bg-hover)';
              }}
              onMouseLeave={(e) => {
                (e.currentTarget as HTMLElement).style.backgroundColor = 'transparent';
              }}
            >
              <Info size={12} />
              查看信息
            </button>

            {/* 编辑信息 */}
            <button
              onClick={() => handleCtxEdit(contextMenu.trackId!)}
              style={menuItemStyle()}
              onMouseEnter={(e) => {
                (e.currentTarget as HTMLElement).style.backgroundColor = 'var(--bg-hover)';
              }}
              onMouseLeave={(e) => {
                (e.currentTarget as HTMLElement).style.backgroundColor = 'transparent';
              }}
            >
              <Pencil size={12} />
              编辑信息
            </button>

            {/* 收藏/取消收藏 */}
            <button
              onClick={() => handleCtxFavorite(contextMenu.trackId!)}
              style={menuItemStyle()}
              onMouseEnter={(e) => {
                (e.currentTarget as HTMLElement).style.backgroundColor = 'var(--bg-hover)';
              }}
              onMouseLeave={(e) => {
                (e.currentTarget as HTMLElement).style.backgroundColor = 'transparent';
              }}
            >
              <Heart
                size={12}
                fill={favorites.includes(contextMenu.trackId!) ? 'var(--primary-color)' : 'none'}
              />
              {favorites.includes(contextMenu.trackId!) ? '取消收藏' : '收藏'}
            </button>

            <button
              onClick={() => {
                const track = tracks.find(t => t.id === contextMenu.trackId);
                if (track) addToQueue(track);
                setContextMenu((prev) => ({ ...prev, visible: false }));
              }}
              style={menuItemStyle()}
              onMouseEnter={(e) => {
                (e.currentTarget as HTMLElement).style.backgroundColor = 'var(--bg-hover)';
              }}
              onMouseLeave={(e) => {
                (e.currentTarget as HTMLElement).style.backgroundColor = 'transparent';
              }}
            >
              <ListMusic size={12} />
              加入队列
            </button>

            {/* 添加到歌单（直接显示歌单列表） */}
            {playlists.length > 0 && (
              <>
                {playlists.map((pl) => (
                  <button
                    key={pl.id}
                    onClick={() => {
                      // 设置当前要添加到的曲目 ID，然后调用添加函数
                      setPlaylistMenuTrackId(contextMenu.trackId);
                      handleCtxAddToPlaylist(pl.id);
                    }}
                    style={menuItemStyle()}
                    onMouseEnter={(e) => {
                      (e.currentTarget as HTMLElement).style.backgroundColor = 'var(--bg-hover)';
                    }}
                    onMouseLeave={(e) => {
                      (e.currentTarget as HTMLElement).style.backgroundColor = 'transparent';
                    }}
                  >
                    <ListMusic size={12} />
                    添加到 {pl.name}
                  </button>
                ))}
              </>
            )}

            {/* 分隔线 */}
            <div
              style={{
                height: 1,
                backgroundColor: 'var(--border-light)',
                margin: '4px 8px',
              }}
            />

            {/* 删除 */}
            <button
              onClick={() => handleCtxDelete(contextMenu.trackId!)}
              style={menuItemStyle(true)}
              onMouseEnter={(e) => {
                (e.currentTarget as HTMLElement).style.backgroundColor = 'rgba(239,68,68,0.1)';
              }}
              onMouseLeave={(e) => {
                (e.currentTarget as HTMLElement).style.backgroundColor = 'transparent';
              }}
            >
              <Trash2 size={12} />
              删除
            </button>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
};

export default MusicLibraryPanel;
