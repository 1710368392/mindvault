import React, { useRef, useState, useEffect, useCallback } from 'react';
import { useLocation, useNavigate } from 'react-router-dom';
import { motion, AnimatePresence } from 'framer-motion';
import { Carousel, Splitter, Modal, Tooltip, Segmented, Dropdown, Typography } from 'antd';
import {
  Search,
  LayoutGrid,
  LayoutDashboard,
  FolderOpen,
  ArrowLeft,
  List,
  User,
  Settings,
  HelpCircle,
  LogOut,
  Play,
  Pause,
  SkipBack,
  SkipForward,
  Sparkles,
  Clock,
  Minimize2,
  Maximize2,
  Music,
  Repeat,
  Shuffle,
  ArrowRight,
  Trash2,
  Upload,
  X,
  GripHorizontal,
  Music2,
  AlignJustify,
  Info,
  Keyboard,
  MessageSquare,
  MessageCircle,
  RefreshCw,
  Compass,
  Volume2,
  VolumeX,
  Bell,
} from 'lucide-react';
import { useUIStore } from '../../stores/uiStore';
import { useBoardStore } from '../../stores/boardStore';
import { useSettingsStore } from '../../stores/settingsStore';
import { useMusicStore } from '../../stores/musicStore';
import { playWhooshSound } from '../../utils/sound';
import { api } from '../../utils/api';
import ProfileDialog from '../ProfileDialog';
import UserAvatar from '../common/UserAvatar';
import MusicLibraryPanel from '../music/MusicLibraryPanel';
import LyricsDisplay from '../music/LyricsDisplay';
import AudioVisualizer from '../music/AudioVisualizer';
import TrackInfoSidebar from '../music/TrackInfoSidebar';
import { useAuth } from '../../hooks/useAuth';
import { isSupabaseConfigured } from '../../lib/supabase';
import { useNotificationStore } from '../../stores/notificationStore';
import { useWeatherStore } from '../../stores/weatherStore';

const NotificationBell: React.FC = () => {
  const unreadCount = useNotificationStore((s) => s.notifications.filter(n => !n.read).length);
  const weatherUnread = useWeatherStore((s) => s.unreadAlertCount);
  const totalUnread = unreadCount + weatherUnread;

  return (
    <motion.button
      whileHover={{ scale: 1.08 }}
      whileTap={{ scale: 0.92 }}
      onClick={() => useNotificationStore.getState().setCenterVisible(true)}
      style={{
        position: 'relative',
        width: 32, height: 32,
        borderRadius: 8,
        border: '1px solid var(--border-light)',
        background: 'var(--bg-tertiary)',
        color: 'var(--text-secondary)',
        cursor: 'pointer',
        display: 'flex', alignItems: 'center', justifyContent: 'center',
        boxShadow: '0 2px 8px rgba(0,0,0,0.08)',
      }}
      title="通知中心"
    >
      <Bell size={15} />
      {totalUnread > 0 && (
        <motion.span
          initial={{ scale: 0 }}
          animate={{ scale: 1 }}
          style={{
            position: 'absolute', top: -4, right: -4,
            minWidth: 16, height: 16,
            borderRadius: 8,
            background: '#ef4444',
            color: '#fff',
            fontSize: 10, fontWeight: 700,
            display: 'flex', alignItems: 'center', justifyContent: 'center',
            padding: '0 4px',
            boxShadow: '0 1px 4px rgba(239,68,68,0.4)',
          }}
        >
          {totalUnread > 99 ? '99+' : totalUnread}
        </motion.span>
      )}
    </motion.button>
  );
};

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

const StickyNoteIcon: React.FC<{ size?: number }> = ({ size = 13 }) => (
  <svg
    width={size}
    height={size}
    viewBox="0 0 24 24"
    fill="none"
  >
    <path fill="var(--bg-tertiary)" d="M2.913 2.913h18.174V20.13a.957.957 0 0 1-.957.957H2.913z"/>
    <path fill="var(--bg-tertiary)" d="M4.826 4.826H23v17.218a.956.956 0 0 1-.957.956H4.826z"/>
    <path stroke="currentColor" strokeLinecap="round" strokeLinejoin="round" d="M23 5.783v16.26a.956.956 0 0 1-.957.957H5.783"/>
    <path stroke="currentColor" strokeLinecap="round" strokeLinejoin="round" d="M21.087 2.913V20.13a.957.957 0 0 1-.957.957H2.913"/>
    <path fill="var(--bg-tertiary)" d="M19.174 15.348v2.87a.956.956 0 0 1-.957.956H1.957A.956.956 0 0 1 1 18.217v-2.87z"/>
    <path fill="var(--primary-light)" d="M19.174 1.957v13.39H1V1.958A.957.957 0 0 1 1.957 1h16.26a.956.956 0 0 1 .957.957"/>
    <path fill="var(--primary-bg)" d="M1.957 1A.957.957 0 0 0 1 1.957v13.39h.484L15.832 1z"/>
    <path stroke="currentColor" strokeLinecap="round" strokeLinejoin="round" d="M19.174 1.957v13.39H1V1.958A.957.957 0 0 1 1.957 1h16.26a.956.956 0 0 1 .957.957"/>
    <path fill="var(--success-color)" d="M16.782 15.348L13.384 8.55c-.236-.47-.62-.47-.856 0l-2.442 4.884L8.308 11.3a.638.638 0 0 0-1.103.085l-2.378 3.963z"/>
    <path fill="#ffef5e" d="M6.26 6.74a1.435 1.435 0 1 0 0-2.87a1.435 1.435 0 0 0 0 2.87"/>
    <path stroke="currentColor" strokeLinecap="round" strokeLinejoin="round" d="M19.174 15.348v2.87a.956.956 0 0 1-.957.956H1.957A.956.956 0 0 1 1 18.217v-2.87z"/>
    <path stroke="currentColor" strokeLinecap="round" strokeLinejoin="round" d="M16.782 15.348L13.384 8.55c-.236-.47-.62-.47-.856 0l-2.442 4.884L8.308 11.3a.638.638 0 0 0-1.103.085l-2.378 3.963zM6.26 6.74a1.435 1.435 0 1 0 0-2.87a1.435 1.435 0 0 0 0 2.87"/>
  </svg>
);

const CreativeIcon: React.FC<{ size?: number }> = ({ size = 13 }) => (
  <svg
    width={size}
    height={size}
    viewBox="0 0 1360 1024"
    fill="none"
  >
    <path fill="var(--primary-color)" d="M348.561 657.879c5.194 0 10.243-2.02 13.994-5.771 3.751-3.751 5.771-8.656 5.771-13.994V137.924c0-10.82-8.801-19.765-19.765-19.765-10.82 0-19.765 8.801-19.765 19.765v500.335c0 10.82 8.801 19.621 19.765 19.621z"/>
    <path fill="var(--primary-color)" d="M1071.939 946.279L994.465 790.754l.721-445.511 155.236.289-.577 445.511-77.907 155.236zm-39.242-138.501l30.441 61.027h17.89l31.451-60.883m8.656-17.601l2.164-5.627.577-412.617-102.144-.289-.577 412.617 3.463 5.627M1149.846 328.507l-154.082-.289.144-111.522 154.082.289-.144 111.522zm-127.392-26.69l100.99.144.144-58.43-100.846-.144-.289 58.43z"/>
    <path fill="var(--primary-color)" d="M1040.055 770.411l5.05-362.988 26.546.433-5.05 362.988-26.546-.433z"/>
    <path fill="var(--text-secondary)" d="M943.393 19.765c0-5.194-2.02-10.243-5.771-13.994-3.751-3.751-8.656-5.771-13.994-5.771H348.561c-86.419 0-133.884 47.61-133.884 133.884v677.356c-2.02 7.791-3.895 16.447-3.895 25.825 0 18.178 3.751 36.212 10.82 53.525l.144.433c.144.289.289.721.433 1.01l.144.144c6.204 17.89 14.86 31.307 27.844 43.714.866 2.02 2.164 4.04 3.751 5.627 7.214 7.214 16.591 12.263 26.979 15.437.577.144 1.154.433 1.731.577 10.243 3.029 21.641 4.616 34.048 4.616h470.633c5.194 0 10.243-2.02 13.994-5.771 3.751-3.751 5.771-8.656 5.771-13.994V19.765zM348.561 39.53h541.74v880.634H348.561c-10.243 0-19.329-1.154-27.263-3.318-6.926-1.876-12.696-4.904-17.313-8.945-.866-.866-1.587-1.731-2.308-2.741-9.231-10.821-14.86-26.258-14.86-44.725 0-6.493.866-12.696 2.453-18.466V134.024c0-70.558 32.462-94.498 95.939-94.498z"/>
    <path fill="var(--text-secondary)" d="M819.737 488.965H460.688c-10.82 0-19.765 8.801-19.765 19.765 0 10.82 8.801 19.765 19.765 19.765h359.049c10.82 0 19.765-8.801 19.765-19.765 0-10.965-8.945-19.765-19.765-19.765z"/>
    <path fill="var(--text-secondary)" d="M819.737 626.456H460.688c-10.82 0-19.765 8.801-19.765 19.765 0 10.82 8.801 19.765 19.765 19.765h359.049c10.82 0 19.765-8.801 19.765-19.765 0-10.965-8.945-19.765-19.765-19.765z"/>
    <path fill="var(--text-secondary)" d="M710.669 763.948H460.688c-10.82 0-19.765 8.801-19.765 19.765 0 10.82 8.801 19.765 19.765 19.765h249.981c10.82 0 19.765-8.801 19.765-19.765 0-10.965-8.945-19.765-19.765-19.765z"/>
    <path fill="var(--primary-bg)" d="M819.737 229.628H460.688c-10.82 0-19.765 8.801-19.765 19.765v119.647c0 10.82 8.801 19.765 19.765 19.765h359.049c10.82 0 19.765-8.801 19.765-19.765V249.393c0-10.965-8.945-19.765-19.765-19.765z"/>
  </svg>
);

/** 自定义画布图标 */
const CanvasIcon: React.FC<{ size?: number }> = ({ size = 13 }) => (
  <svg
    width={size}
    height={size}
    viewBox="0 0 24 24"
    fill="none"
    stroke="currentColor"
    strokeWidth="2"
    strokeLinecap="round"
    strokeLinejoin="round"
  >
    {/* 画框 */}
    <rect x="3" y="3" width="18" height="18" rx="2" />
    {/* 画布内容 */}
    <circle cx="9" cy="9" r="2" />
    <path d="M17 9l-4 4-2-2-4 4" />
  </svg>
);

const Header: React.FC = () => {
  const location = useLocation();
  const navigate = useNavigate();
  const setSearchDialogOpen = useUIStore((s) => s.setSearchDialogOpen);
  const viewMode = useBoardStore((s) => s.viewMode);
  const setViewMode = useBoardStore((s) => s.setViewMode);
  const currentBoard = useBoardStore((s) => s.currentBoard);
  const updateBoard = useBoardStore((s) => s.updateBoard);
  const openDetachedBoard = useUIStore((s) => s.openDetachedBoard);
  const setAboutDialogOpen = useUIStore((s) => s.setAboutDialogOpen);
  const setShortcutGuideOpen = useUIStore((s) => s.setShortcutGuideOpen);
  const lockScreen = useUIStore((s) => s.lockScreen);
  const showToast = useUIStore((s) => s.showToast);
  const nickname = useSettingsStore((s) => s.settings.nickname);
  const privacyLock = useSettingsStore((s) => s.settings.privacyLock);
  const { user: cloudUser, isAuthenticated: isCloudAuth, signOut: cloudSignOut } = useAuth();

  const [profileDialogOpen, setProfileDialogOpen] = useState(false);
  const [feedbackDialogOpen, setFeedbackDialogOpen] = useState(false);

  const [isEditingTitle, setIsEditingTitle] = useState(false);
  const [editTitle, setEditTitle] = useState('');

  const titleInputRef = useRef<HTMLInputElement>(null);

  const [isVolumeHovered, setIsVolumeHovered] = useState(false);
  // 音量弹出面板显示状态
  const [isVolumePopupVisible, setIsVolumePopupVisible] = useState(false);
  // 音量滑块隐藏定时器（用于延迟隐藏，避免鼠标移出时立即消失）
  const [volumeHideTimer, setVolumeHideTimer] = useState<NodeJS.Timeout | null>(null);
  // 静音前的音量值（用于恢复）
  const [volumeBeforeMute, setVolumeBeforeMute] = useState(100);
  const [isDraggingProgress, setIsDraggingProgress] = useState(false);
  const [isProgressHovered, setIsProgressHovered] = useState(false);
  const [musicManagerPos, setMusicManagerPos] = useState({ x: 200, y: 100 });
  const [isDraggingMusicManager, setIsDraggingMusicManager] = useState(false);
  const [musicPlayerContextMenu, setMusicPlayerContextMenu] = useState<{ x: number; y: number; visible: boolean }>({ x: 0, y: 0, visible: false });

  // 曲目信息侧边栏状态
  const [showTrackInfoSidebar, setShowTrackInfoSidebar] = useState(false);
  const [trackInfoTrackId, setTrackInfoTrackId] = useState<string | null>(null);
  const [trackInfoSource, setTrackInfoSource] = useState<'local' | 'online'>('local');
  const [trackInfoEditMode, setTrackInfoEditMode] = useState(false);
  const musicManagerOffsetRef = useRef({ x: 0, y: 0 });
  const progressBarRef = useRef<HTMLDivElement | null>(null);
  const dragBarRef = useRef<HTMLElement | null>(null);
  const carouselRef = useRef<any>(null);

  // 网易云登录状态
  const [neteaseUser, setNeteaseUser] = useState<{ nickname: string; avatarUrl: string; vipType: number } | null>(null);
  // QQ 音乐登录状态
  const [qqMusicLoggedIn, setQqMusicLoggedIn] = useState(false);

  // Music store
  const musicIsPlaying = useMusicStore((s) => s.isPlaying);
  const musicCurrentTrackIndex = useMusicStore((s) => s.currentTrackIndex);
  const musicProgress = useMusicStore((s) => s.progress);
  const musicDuration = useMusicStore((s) => s.duration);
  const musicCurrentTime = useMusicStore((s) => s.currentTime);
  const musicVolume = useMusicStore((s) => s.volume);
  const musicPlayMode = useMusicStore((s) => s.playMode);
  const musicTracks = useMusicStore((s) => s.tracks);
  const musicShowLyrics = useMusicStore((s) => s.showLyrics);
  const musicLyrics = useMusicStore((s) => s.lyrics);
  const musicIsPlayerMinimized = useMusicStore((s) => s.isPlayerMinimized);
  const musicShowMusicManager = useMusicStore((s) => s.showMusicManager);
  const musicFormatTime = useMusicStore((s) => s.formatTime);
  const musicPlayModeLabel = useMusicStore((s) => s.getPlayModeLabel());
  const musicTogglePlay = useMusicStore((s) => s.togglePlay);
  const musicLoadTrack = useMusicStore((s) => s.loadTrack);
  const musicNextTrack = useMusicStore((s) => s.nextTrack);
  const musicPrevTrack = useMusicStore((s) => s.prevTrack);
  const musicSetVolume = useMusicStore((s) => s.setVolume);
  const musicCyclePlayMode = useMusicStore((s) => s.cyclePlayMode);
  const musicSeekToRatio = useMusicStore((s) => s.seekToRatio);
  const musicSetShowLyrics = useMusicStore((s) => s.setShowLyrics);
  const musicSetShowMusicManager = useMusicStore((s) => s.setShowMusicManager);
  const musicSetIsPlayerMinimized = useMusicStore((s) => s.setIsPlayerMinimized);
  const musicInitAudio = useMusicStore((s) => s.initAudio);

  // 看板按钮状态
  const [boardButtonContextMenu, setBoardButtonContextMenu] = useState<{ x: number; y: number; visible: boolean }>({ x: 0, y: 0, visible: false });
  const [isBoardButtonDetaching, setIsBoardButtonDetaching] = useState(false);
  const [boardButtonShakeIntensity, setBoardButtonShakeIntensity] = useState(0);
  const [particles, setParticles] = useState<Array<{ id: number; x: number; y: number; size: number; color: string; vx: number; vy: number; life: number }>>([]);
  const longPressTimerRef = useRef<NodeJS.Timeout | null>(null);
  const shakeIntensityTimerRef = useRef<NodeJS.Timeout | null>(null);

  useEffect(() => {
    if (isEditingTitle && titleInputRef.current) {
      titleInputRef.current.focus();
      titleInputRef.current.select();
    }
  }, [isEditingTitle]);

  const handleSaveTitle = async () => {
    if (!editTitle.trim() || !currentBoard) {
      setIsEditingTitle(false);
      setEditTitle(currentBoard?.name || '');
      return;
    }
    if (editTitle === currentBoard.name) {
      setIsEditingTitle(false);
      return;
    }
    try {
      await updateBoard(currentBoard.id, { name: editTitle.trim() });
    } catch (error) {
      console.error('更新看板失败:', error);
    } finally {
      setIsEditingTitle(false);
    }
  };

  const handleDoubleClickTitle = (e: React.MouseEvent) => {
    if (!currentBoard) return;
    setEditTitle(currentBoard.name);
    setIsEditingTitle(true);
  };

  const handleTitleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter') handleSaveTitle();
    if (e.key === 'Escape') {
      setIsEditingTitle(false);
      setEditTitle(currentBoard?.name || '');
    }
  };

  // Init audio on mount
  useEffect(() => {
    musicInitAudio();
  }, [musicInitAudio]);

  const handleVolumeWheel = useCallback((e: React.WheelEvent) => {
    e.preventDefault();
    e.stopPropagation();
    useMusicStore.getState().ensureAudioContext();
    const delta = e.deltaY < 0 ? 5 : -5;
    musicSetVolume(Math.max(0, Math.min(200, musicVolume + delta)));
  }, [musicVolume, musicSetVolume]);

  // 组件卸载时清理定时器
  useEffect(() => {
    return () => {
      if (volumeHideTimer) {
        clearTimeout(volumeHideTimer);
      }
    };
  }, [volumeHideTimer]);

  // 延迟隐藏音量滑块的定时器处理函数
  const scheduleHideVolumePopup = useCallback(() => {
    // 清除之前的定时器
    if (volumeHideTimer) {
      clearTimeout(volumeHideTimer);
    }
    // 设置新的定时器，200ms 后隐藏
    const timer = setTimeout(() => {
      setIsVolumePopupVisible(false);
    }, 200);
    setVolumeHideTimer(timer);
  }, [volumeHideTimer]);

  // 取消延迟隐藏（鼠标进入时调用）
  const cancelHideVolumePopup = useCallback(() => {
    if (volumeHideTimer) {
      clearTimeout(volumeHideTimer);
      setVolumeHideTimer(null);
    }
  }, [volumeHideTimer]);

  useEffect(() => {
    if (!isDraggingMusicManager) return;
    const handleMouseMove = (e: MouseEvent) => {
      setMusicManagerPos({
        x: e.clientX - musicManagerOffsetRef.current.x,
        y: e.clientY - musicManagerOffsetRef.current.y,
      });
    };
    const handleMouseUp = () => setIsDraggingMusicManager(false);
    window.addEventListener('mousemove', handleMouseMove);
    window.addEventListener('mouseup', handleMouseUp);
    return () => {
      window.removeEventListener('mousemove', handleMouseMove);
      window.removeEventListener('mouseup', handleMouseUp);
    };
  }, [isDraggingMusicManager]);

  const handleMusicManagerDragStart = useCallback((e: React.MouseEvent) => {
    e.preventDefault();
    musicManagerOffsetRef.current = {
      x: e.clientX - musicManagerPos.x,
      y: e.clientY - musicManagerPos.y,
    };
    setIsDraggingMusicManager(true);
  }, [musicManagerPos]);

  useEffect(() => {
    if (!musicPlayerContextMenu.visible) return;
    const handleClick = (e: MouseEvent) => {
      const target = e.target as HTMLElement;
      if (!target.closest('.music-player-context-menu')) {
        setMusicPlayerContextMenu(prev => ({ ...prev, visible: false }));
      }
    };
    document.addEventListener('mousedown', handleClick);
    return () => document.removeEventListener('mousedown', handleClick);
  }, [musicPlayerContextMenu.visible]);

  const handleProgressMouseDown = useCallback((e: React.MouseEvent) => {
    e.preventDefault();
    e.stopPropagation();
    const bar = e.currentTarget as HTMLElement;
    dragBarRef.current = bar;
    const dur = useMusicStore.getState().duration;
    if (!dur || !isFinite(dur) || dur <= 0) return;
    const barWidth = bar.offsetWidth;
    if (!barWidth || barWidth <= 0) return;
    const x = Math.max(0, Math.min(e.nativeEvent.offsetX, barWidth));
    const ratio = Math.max(0, Math.min(x / barWidth, 1));
    musicSeekToRatio(ratio);
    setIsDraggingProgress(true);
  }, [musicSeekToRatio]);

  useEffect(() => {
    if (!isDraggingProgress) return;
    const handleMouseMove = (e: MouseEvent) => {
      const bar = dragBarRef.current;
      if (!bar) return;
      const dur = useMusicStore.getState().duration;
      if (!dur || !isFinite(dur) || dur <= 0) return;
      const barWidth = bar.offsetWidth;
      if (!barWidth || barWidth <= 0) return;
      const barRect = bar.getBoundingClientRect();
      const x = Math.max(0, Math.min(e.clientX - barRect.left, barWidth));
      const ratio = Math.max(0, Math.min(x / barWidth, 1));
      musicSeekToRatio(ratio);
    };
    const handleMouseUp = () => {
      setIsDraggingProgress(false);
      dragBarRef.current = null;
    };
    window.addEventListener('mousemove', handleMouseMove);
    window.addEventListener('mouseup', handleMouseUp);
    return () => {
      window.removeEventListener('mousemove', handleMouseMove);
      window.removeEventListener('mouseup', handleMouseUp);
    };
  }, [isDraggingProgress, musicSeekToRatio]);

  const isBoardPage = location.pathname.startsWith('/board/');

  const HOME_SPLITTER_KEY = 'mindvault:homeSplitterSizes';
  const BOARD_SPLITTER_KEY = 'mindvault:boardSplitterSizes';
  const [homeSplitterSizes, setHomeSplitterSizes] = useState<number[]>(() => {
    try { const s = localStorage.getItem(HOME_SPLITTER_KEY); return s ? JSON.parse(s) : [5, 75, 20]; } catch { return [5, 75, 20]; }
  });
  const [boardSplitterSizes, setBoardSplitterSizes] = useState<number[]>(() => {
    try { const s = localStorage.getItem(BOARD_SPLITTER_KEY); return s ? JSON.parse(s) : [5, 30, 65]; } catch { return [5, 30, 65]; }
  });
  const currentSplitterSizes = isBoardPage ? boardSplitterSizes : homeSplitterSizes;
  const handleSplitterResize = useCallback((sizes: number[]) => {
    if (isBoardPage) {
      setBoardSplitterSizes(sizes);
      localStorage.setItem(BOARD_SPLITTER_KEY, JSON.stringify(sizes));
    } else {
      setHomeSplitterSizes(sizes);
      localStorage.setItem(HOME_SPLITTER_KEY, JSON.stringify(sizes));
    }
  }, [isBoardPage]);

  const getPageTitle = (): string => {
    if (location.pathname === '/') return '首页';
    if (location.pathname.startsWith('/board/')) return currentBoard?.name || '看板';
    if (location.pathname === '/search') return '仓库';
    if (location.pathname === '/templates') return '模板库';
    if (location.pathname === '/settings') return '设置';
    if (location.pathname === '/export') return '导出';
    return '脑洞集';
  };

  const viewModes = [
    { value: 'folder' as const, icon: FolderOpen, label: '文件夹' },
    { value: 'canvas' as const, icon: CanvasIcon, label: '画布' },
    { value: 'board' as const, icon: StickyNoteIcon, label: '看板' },
    { value: 'outline' as const, icon: CreativeIcon, label: '写作台' },
    { value: 'chat' as const, icon: MessageCircle, label: '聊天室' },
  ];

  // 粒子动画
  useEffect(() => {
    if (particles.length === 0) return;
    
    const interval = setInterval(() => {
      setParticles(prev => prev
        .map(p => ({
          ...p,
          x: p.x + p.vx,
          y: p.y + p.vy,
          vy: p.vy + 0.3,
          life: p.life - 0.02,
        }))
        .filter(p => p.life > 0)
      );
    }, 16);

    return () => clearInterval(interval);
  }, [particles]);

  // 右键菜单：点击外部关闭
  useEffect(() => {
    if (!boardButtonContextMenu.visible) return;
    const handleClick = (e: MouseEvent) => {
      const target = e.target as HTMLElement;
      if (!target.closest('.board-button-context-menu')) {
        setBoardButtonContextMenu(prev => ({ ...prev, visible: false }));
      }
    };
    document.addEventListener('mousedown', handleClick);
    return () => document.removeEventListener('mousedown', handleClick);
  }, [boardButtonContextMenu.visible]);

  // 启动分离效果（摇摆 + 碎屑）
  const startDetachEffect = (buttonRect: DOMRect) => {
    setIsBoardButtonDetaching(true);
    
    // 安全超时：确保 isBoardButtonDetaching 不会卡住
    setTimeout(() => {
      setIsBoardButtonDetaching(false);
      setBoardButtonShakeIntensity(0);
    }, 3000);
    
    // 生成碎屑粒子
    const colors = ['#8B5CF6', '#A78BFA', '#DDD6FE', '#C4B5FD', '#E9D5FF'];
    const newParticles: typeof particles = [];
    const centerX = buttonRect.left + buttonRect.width / 2;
    const centerY = buttonRect.top + buttonRect.height / 2;
    
    for (let i = 0; i < 20; i++) {
      newParticles.push({
        id: Date.now() + i,
        x: centerX + (Math.random() - 0.5) * 30,
        y: centerY + (Math.random() - 0.5) * 20,
        size: 3 + Math.random() * 6,
        color: colors[Math.floor(Math.random() * colors.length)],
        vx: (Math.random() - 0.5) * 12,
        vy: -5 - Math.random() * 10,
        life: 1,
      });
    }
    setParticles(newParticles);
    
    // 逐渐增强摇摆
    let intensity = 0;
    const increaseIntensity = () => {
      intensity = Math.min(1, intensity + 0.1);
      setBoardButtonShakeIntensity(intensity);
      
      if (intensity < 1) {
        shakeIntensityTimerRef.current = setTimeout(increaseIntensity, 50);
      } else {
        // 摇摆到最大强度后，执行分离
        setTimeout(() => {
          openDetachedBoard(currentBoard?.id);
          setIsBoardButtonDetaching(false);
          setBoardButtonShakeIntensity(0);
        }, 400);
      }
    };
    increaseIntensity();
  };

  // 处理长按开始
  const handleBoardButtonMouseDown = (e: React.MouseEvent) => {
    const rect = (e.target as HTMLElement).closest('button')?.getBoundingClientRect();
    if (!rect) return;
    
    longPressTimerRef.current = setTimeout(() => {
      startDetachEffect(rect);
    }, 800);
  };

  // 处理长按结束
  const handleBoardButtonMouseUp = () => {
    if (longPressTimerRef.current) {
      clearTimeout(longPressTimerRef.current);
      longPressTimerRef.current = null;
    }
  };

  // 处理右键菜单
  const handleBoardButtonRightClick = (e: React.MouseEvent) => {
    e.preventDefault();
    e.stopPropagation();
    setBoardButtonContextMenu({ x: e.clientX, y: e.clientY, visible: true });
  };

  // 右键菜单：点击"脱落"
  const handleDetachFromMenu = () => {
    const boardButton = document.querySelector('[data-board-button]');
    if (boardButton) {
      const rect = boardButton.getBoundingClientRect();
      startDetachEffect(rect);
    }
    setBoardButtonContextMenu(prev => ({ ...prev, visible: false }));
  };

  // 清理
  useEffect(() => {
    return () => {
      if (longPressTimerRef.current) clearTimeout(longPressTimerRef.current);
      if (shakeIntensityTimerRef.current) clearTimeout(shakeIntensityTimerRef.current);
    };
  }, []);

  // 加载网易云登录状态和 QQ 音乐 cookie 状态
  useEffect(() => {
    const loadLoginStatus = async () => {
      try {
        console.log('[Header] 开始获取网易云用户信息...');
        const res = await api.musicOnline.getNeteaseUser();
        console.log('[Header] 获取网易云用户信息结果:', res);
        if (res.success && res.data) {
          setNeteaseUser(res.data);
          console.log('[Header] 已设置网易云用户信息:', res.data.nickname);
        } else {
          console.log('[Header] 未获取到网易云用户信息:', res.error || '未知原因');
        }
      } catch (err) {
        console.warn('[Header] 获取网易云用户信息失败:', err);
      }

      // 检查 QQ 音乐 cookie 是否存在
      try {
        const cookieRes = await api.musicOnline.getCookie();
        if (cookieRes.success && cookieRes.data?.cookie) {
          setQqMusicLoggedIn(true);
        }
      } catch (err) {
        console.warn('[Header] 获取 QQ 音乐 cookie 状态失败:', err);
      }
    };
    loadLoginStatus();
  }, []);

  return (
    <>
      <header
        style={{
          height: 'var(--header-height)',
          minHeight: 'var(--header-height)',
          backgroundColor: 'var(--header-bg)',
          backdropFilter: 'blur(12px)',
          borderBottom: '1px solid var(--border-light)',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          padding: '0 16px',
          zIndex: 50,
          gap: 12,
        }}
      >
      <Splitter
        style={{ flex: 1, height: '100%' }}
        onResize={handleSplitterResize}
        styles={{
          bar: {
            background: 'transparent',
            width: 6,
            cursor: 'col-resize',
            transition: 'background 0.2s',
          },
          dragger: {
            opacity: 0,
            transition: 'opacity 0.2s',
          },
        }}
      >
        <Splitter.Panel size={`${currentSplitterSizes[0]}%`} min={60}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 8, minWidth: 0, height: '100%' }}>
            {isBoardPage && (
              <motion.button
                onClick={() => navigate('/')}
                whileHover={{ scale: 1.05, backgroundColor: 'var(--bg-hover)' }}
                whileTap={{ scale: 0.95 }}
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  width: 28,
                  height: 28,
                  borderRadius: 'var(--radius-sm)',
                  color: 'var(--text-secondary)',
                  cursor: 'pointer',
                  border: 'none',
                  background: 'none',
                  flexShrink: 0,
                }}
              >
                <motion.div
                  whileHover={{ x: -3 }}
                  whileTap={{ 
                    x: [-3, -6, -2, 0 ],
                    scale: 1.2,
                  }}
                  transition={{ type: 'spring', stiffness: 500, damping: 12 }}
                >
                  <ArrowLeft size={16} />
                </motion.div>
              </motion.button>
            )}
            {isBoardPage && isEditingTitle ? (
              <input
                ref={titleInputRef}
                type="text"
                value={editTitle}
                onChange={(e) => setEditTitle(e.target.value)}
                onBlur={handleSaveTitle}
                onKeyDown={handleTitleKeyDown}
                style={{
                  fontSize: 14,
                  fontWeight: 600,
                  color: 'var(--text-primary)',
                  margin: 0,
                  border: '1px solid var(--primary-color)',
                  borderRadius: 6,
                  padding: '4px 8px',
                  backgroundColor: 'var(--bg-secondary)',
                  outline: 'none',
                  minWidth: 100,
                  maxWidth: 300,
                }}
              />
            ) : (
              <h1
                onDoubleClick={isBoardPage ? handleDoubleClickTitle : undefined}
                style={{
                  fontSize: 14,
                  fontWeight: 600,
                  color: 'var(--text-primary)',
                  margin: 0,
                  whiteSpace: 'nowrap',
                  overflow: 'hidden',
                  textOverflow: 'ellipsis',
                  cursor: isBoardPage ? 'text' : 'default',
                }}
              >
                {getPageTitle()}
              </h1>
            )}
          </div>
        </Splitter.Panel>

        <Splitter.Panel size={`${currentSplitterSizes[1]}%`} min={200}>
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', minWidth: 0, overflow: 'hidden', height: '100%' }}>
            <div 
              style={{
                borderRadius: 20,
                overflow: 'hidden',
                width: musicIsPlayerMinimized ? 'auto' : '100%',
                height: 36,
                backgroundColor: 'var(--bg-tertiary)',
                border: '1.5px solid',
                borderColor: 'rgba(0,0,0,0.25) rgba(0,0,0,0.12) rgba(255,255,255,0.15) rgba(0,0,0,0.12)',
                boxShadow: 'inset 0 2px 6px rgba(0,0,0,0.35), inset 0 -1px 3px rgba(255,255,255,0.06), inset 1px 0 3px rgba(0,0,0,0.2), inset -1px 0 3px rgba(0,0,0,0.1), 0 1px 0 rgba(255,255,255,0.08)',
                transition: 'width 0.3s ease',
              }}
              onContextMenu={(e) => {
                e.preventDefault();
                setMusicPlayerContextMenu({ x: e.clientX, y: e.clientY, visible: true });
              }}
            >
          <Carousel
            ref={carouselRef}
            dots={false}
            autoplay={false}
            style={{ height: 36 }}
          >
            <div key="music-player" style={{ height: 36, display: 'flex', alignItems: 'center', justifyContent: 'center', padding: musicIsPlayerMinimized ? '0 10px' : '0 8px' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 6, width: '100%', height: '100%' }}>
                <motion.button
                  onClick={() => { const idx = musicPrevTrack(); if (idx !== musicCurrentTrackIndex) musicLoadTrack(idx, true); }}
                  whileHover={{ scale: 1.15 }}
                  whileTap={{ scale: 0.9 }}
                  style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', border: 'none', background: 'none', cursor: 'pointer', color: 'var(--text-tertiary)', padding: 2 }}
                >
                  <SkipBack size={12} />
                </motion.button>
                <motion.button
                  onClick={musicTogglePlay}
                  whileHover={{ scale: 1.1 }}
                  whileTap={{ scale: 0.9 }}
                  style={{
                    display: 'flex', alignItems: 'center', justifyContent: 'center',
                    width: 24, height: 24, borderRadius: '50%',
                    background: 'linear-gradient(135deg, var(--primary-color), var(--primary-light))',
                    border: 'none', cursor: 'pointer', color: 'white',
                    boxShadow: '0 2px 6px color-mix(in srgb, var(--primary-color) 25%, transparent)',
                  }}
                >
                  {musicIsPlaying ? <Pause size={11} /> : <Play size={11} style={{ marginLeft: 1 }} />}
                </motion.button>
                <motion.button
                  onClick={() => { const idx = musicNextTrack(); musicLoadTrack(idx, musicIsPlaying); }}
                  whileHover={{ scale: 1.15 }}
                  whileTap={{ scale: 0.9 }}
                  style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', border: 'none', background: 'none', cursor: 'pointer', color: 'var(--text-tertiary)', padding: 2 }}
                >
                  <SkipForward size={12} />
                </motion.button>

                {!musicIsPlayerMinimized && (
                  <>
                    <div style={{ width: 1, height: '60%', backgroundColor: 'rgba(0,0,0,0.1)', borderRadius: 0.5 }} />

                    <div style={{ flex: musicShowLyrics ? 1 : 2, display: 'flex', flexDirection: 'column', minWidth: 0, overflow: 'hidden', justifyContent: 'center', height: '100%', paddingRight: 4 }}>
                      <div style={{ display: 'flex', alignItems: 'center', gap: 4, overflow: 'hidden', marginBottom: 2 }}>
                        {/* 封面小图标 - 有封面则显示，否则不显示 */}
                        {musicTracks[musicCurrentTrackIndex]?.coverUrl && (
                          <img
                            src={musicTracks[musicCurrentTrackIndex].coverUrl}
                            alt=""
                            style={{ width: 24, height: 24, borderRadius: 4, objectFit: 'cover', flexShrink: 0 }}
                          />
                        )}
                        <Typography.Text ellipsis style={{ fontSize: 10, fontWeight: 600, color: 'var(--primary-color)' }}>
                          {musicTracks[musicCurrentTrackIndex].title}
                        </Typography.Text>
                        <span style={{ fontSize: 9, color: 'var(--text-tertiary)', opacity: 0.6, flexShrink: 0 }}>
                          {musicTracks[musicCurrentTrackIndex].artist}
                        </span>
                      </div>
                      <div style={{ display: 'flex', alignItems: 'center', gap: 4 }}>
                        <div
                          ref={progressBarRef}
                          onMouseDown={handleProgressMouseDown}
                          onMouseEnter={() => setIsProgressHovered(true)}
                          onMouseLeave={() => setIsProgressHovered(false)}
                          style={{
                            flex: 1,
                            height: isDraggingProgress ? 5 : isProgressHovered ? 4 : 3,
                            borderRadius: 2,
                            backgroundColor: 'var(--bg-secondary)',
                            overflow: 'visible',
                            position: 'relative',
                            cursor: 'pointer',
                            transition: 'height 0.15s ease',
                          }}
                        >
                          <div
                            style={{
                              height: '100%',
                              borderRadius: 2,
                              background: 'linear-gradient(90deg, var(--primary-color), var(--primary-light))',
                              position: 'relative',
                              width: `${musicProgress * 100}%`,
                              transition: isDraggingProgress ? 'none' : 'width 0.3s linear',
                            }}
                          >
                            {(isDraggingProgress || isProgressHovered) && (
                              <div style={{
                                position: 'absolute',
                                right: -4,
                                top: '50%',
                                transform: isDraggingProgress ? 'translateY(-50%) scale(1.3)' : 'translateY(-50%) scale(1)',
                                width: 8,
                                height: 8,
                                borderRadius: '50%',
                                backgroundColor: 'var(--primary-color)',
                                boxShadow: '0 0 4px color-mix(in srgb, var(--primary-color) 50%, transparent)',
                                transition: 'transform 0.1s ease',
                              }} />
                            )}
                          </div>
                        </div>
                        <span style={{ fontSize: 8, color: 'var(--text-tertiary)', opacity: 0.5, flexShrink: 0, fontVariantNumeric: 'tabular-nums' }}>
                          {musicFormatTime(musicCurrentTime)}
                        </span>
                      </div>
                    </div>

                    {musicShowLyrics && (
                      <div style={{
                        flex: 1,
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'center',
                        overflow: 'hidden',
                        height: '100%',
                        paddingLeft: 4,
                        borderLeft: '1px solid rgba(255,255,255,0.05)',
                      }}>
                        <LyricsDisplay
                          lines={musicLyrics}
                          currentTime={musicCurrentTime}
                          compact
                        />
                      </div>
                    )}

                    {/* 音量控制 - 喇叭按钮 + 悬浮弹出垂直滑块（紧凑版） */}
                    <div
                      style={{ position: 'relative', display: 'flex', alignItems: 'center', flexShrink: 0 }}
                      onMouseEnter={() => {
                        cancelHideVolumePopup();
                        setIsVolumePopupVisible(true);
                      }}
                      onMouseLeave={() => scheduleHideVolumePopup()}
                    >
                      <motion.button
                        onClick={() => {
                          if (musicVolume > 0) {
                            setVolumeBeforeMute(musicVolume);
                            musicSetVolume(0);
                          } else {
                            musicSetVolume(volumeBeforeMute);
                          }
                        }}
                        whileHover={{ scale: 1.1 }}
                        whileTap={{ scale: 0.9 }}
                        style={{
                          display: 'flex', alignItems: 'center', justifyContent: 'center',
                          border: 'none', background: 'none', cursor: 'pointer',
                          color: 'var(--text-tertiary)', padding: 2,
                        }}
                        title={musicVolume === 0 ? '取消静音' : '静音'}
                      >
                        {musicVolume === 0 ? <VolumeX size={12} /> : <Volume2 size={12} />}
                      </motion.button>
                      {/* 弹出的垂直音量滑块（紧凑版）- 自定义样式 */}
                      {isVolumePopupVisible && (
                        <div
                          style={{
                            position: 'absolute',
                            bottom: '100%',
                            left: '50%',
                            transform: 'translateX(-50%)',
                            marginBottom: 6,
                            background: 'var(--bg-primary)',
                            border: '1px solid var(--border-light)',
                            borderRadius: 6,
                            padding: '5px 4px',
                            boxShadow: '0 4px 12px rgba(0,0,0,0.15)',
                            display: 'flex',
                            alignItems: 'center',
                            justifyContent: 'center',
                            zIndex: 100,
                          }}
                          onMouseEnter={() => cancelHideVolumePopup()}
                          onMouseLeave={() => scheduleHideVolumePopup()}
                        >
                          {/* 自定义垂直滑块容器 */}
                          <div
                            style={{
                              width: 10,
                              height: 40,
                              backgroundColor: 'var(--bg-tertiary)',
                              borderRadius: 5,
                              position: 'relative',
                              cursor: 'pointer',
                              overflow: 'hidden',
                            }}
                            onMouseDown={(e) => {
                              e.preventDefault();
                              useMusicStore.getState().ensureAudioContext();
                              const rect = e.currentTarget.getBoundingClientRect();
                              const y = e.clientY - rect.top;
                              const ratio = 1 - Math.max(0, Math.min(y / rect.height, 1));
                              musicSetVolume(Math.round(ratio * 200));

                              const handleMouseMove = (moveEvent: MouseEvent) => {
                                const moveY = moveEvent.clientY - rect.top;
                                const moveRatio = 1 - Math.max(0, Math.min(moveY / rect.height, 1));
                                musicSetVolume(Math.round(moveRatio * 200));
                              };
                              const handleMouseUp = () => {
                                window.removeEventListener('mousemove', handleMouseMove);
                                window.removeEventListener('mouseup', handleMouseUp);
                              };
                              window.addEventListener('mousemove', handleMouseMove);
                              window.addEventListener('mouseup', handleMouseUp);
                            }}
                          >
                            {/* 填充部分（从底部开始） */}
                            <div style={{
                              position: 'absolute',
                              bottom: 0,
                              left: 0,
                              right: 0,
                              height: `${(musicVolume / 200) * 100}%`,
                              background: 'linear-gradient(to top, var(--primary-color), var(--primary-light))',
                              borderRadius: 5,
                            }} />
                            {/* 滑块把手 */}
                            <div style={{
                              position: 'absolute',
                              left: '50%',
                              transform: 'translateX(-50%)',
                              bottom: `${(musicVolume / 200) * 100}%`,
                              width: 8,
                              height: 8,
                              borderRadius: '50%',
                              background: 'white',
                              boxShadow: '0 2px 4px rgba(0,0,0,0.2)',
                              marginBottom: -4,
                            }} />
                          </div>
                        </div>
                      )}
                    </div>
                  </>
                )}
              </div>
            </div>
            <div key="placeholder-1" style={{ height: 36, display: 'flex', alignItems: 'center', justifyContent: 'center', padding: '0 16px' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 6, color: 'var(--text-tertiary)', fontSize: 12 }}>
                <Sparkles size={12} style={{ opacity: 0.5 }} />
                <span style={{ opacity: 0.4 }}>即将推出...</span>
              </div>
            </div>
            <div key="placeholder-2" style={{ height: 36, display: 'flex', alignItems: 'center', justifyContent: 'center', padding: '0 16px' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 6, color: 'var(--text-tertiary)', fontSize: 12 }}>
                <Clock size={12} style={{ opacity: 0.5 }} />
                <span style={{ opacity: 0.4 }}>敬请期待...</span>
              </div>
            </div>
          </Carousel>
            </div>
          </div>
        </Splitter.Panel>

        <Splitter.Panel size={`${currentSplitterSizes[2]}%`} min={190}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 6, height: '100%' }}>
            {isBoardPage && (
              <Segmented
                value={viewMode}
                onChange={(val) => {
                  if (!isBoardButtonDetaching) {
                    const { settings } = useSettingsStore.getState();
                    if (settings.soundEnabled && settings.keyPressSoundEnabled) {
                      playWhooshSound(settings.soundVolume);
                    }
                    setViewMode(val as any);
                  }
                }}
                options={viewModes.map((mode) => ({
                  label: (
                    <span style={{ display: 'flex', alignItems: 'center', gap: 4 }}>
                      <mode.icon size={13} />
                      {mode.label}
                    </span>
                  ),
                  value: mode.value,
                }))}
              />
            )}

            <div style={{ display: 'flex', alignItems: 'center', gap: 6, marginLeft: 'auto' }}>
              <Dropdown
          menu={{
            items: [
              {
                key: 'profile',
                label: '个人资料',
                icon: <User size={14} />,
              },
              {
                key: 'settings',
                label: '设置',
                icon: <Settings size={14} />,
              },
              { type: 'divider' },
              {
                key: 'about',
                label: '关于',
                icon: <Info size={14} />,
              },
              {
                key: 'shortcuts',
                label: '快捷键参考',
                icon: <Keyboard size={14} />,
              },
              {
                key: 'feedback',
                label: '反馈',
                icon: <MessageSquare size={14} />,
              },
              {
                key: 'update',
                label: '检查更新',
                icon: <RefreshCw size={14} />,
              },
              { type: 'divider' },
              ...(isSupabaseConfigured ? [
                isCloudAuth
                  ? {
                      key: 'cloud-logout',
                      label: '退出云账号',
                      icon: <LogOut size={14} />,
                      danger: true,
                    }
                  : {
                      key: 'cloud-login',
                      label: '登录云账号',
                    },
                { type: 'divider' as const },
              ] : []),
              {
                key: 'logout',
                label: '退出登录（暂用锁屏）',
                icon: <LogOut size={14} />,
                danger: true,
              },
            ],
            onClick: ({ key }) => {
              switch (key) {
                case 'profile':
                  setProfileDialogOpen(true);
                  break;
                case 'settings':
                  navigate('/settings');
                  break;
                case 'about':
                  setAboutDialogOpen(true);
                  break;
                case 'shortcuts':
                  setShortcutGuideOpen(true);
                  break;
                case 'feedback':
                  setFeedbackDialogOpen(true);
                  break;
                case 'update':
                  showToast('info', '抱歉，暂未开发客户端');
                  break;
                case 'cloud-login':
                  navigate('/login');
                  break;
                case 'cloud-logout':
                  cloudSignOut();
                  showToast('success', '已退出云账号');
                  break;
                case 'logout':
                  lockScreen();
                  break;
              }
            },
          }}
          trigger={['click']}
          placement="bottomRight"
        >
          <motion.button
            whileHover={{ scale: 1.05 }}
            whileTap={{ scale: 0.95 }}
            style={{
              display: 'flex',
              alignItems: 'center',
              gap: 6,
              padding: '4px 8px 4px 4px',
              borderRadius: 'var(--radius-md)',
              backgroundColor: 'var(--bg-tertiary)',
              cursor: 'pointer',
              border: '1px solid var(--border-light)',
              boxShadow: '0 2px 8px rgba(0,0,0,0.08)',
            }}
          >
            <motion.div
              whileHover={{ y: -3, scale: 1.08 }}
              whileTap={{ y: 1, scale: 0.95 }}
              transition={{ type: 'spring', stiffness: 500, damping: 15, mass: 0.3 }}
              style={{
                width: 24,
                height: 24,
                borderRadius: '50%',
                overflow: 'hidden',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                flexShrink: 0,
              }}
            >
              <UserAvatar size={24} />
            </motion.div>
            <span style={{
              fontSize: 12,
              color: 'var(--text-secondary)',
              fontWeight: 500,
              maxWidth: 60,
              overflow: 'hidden',
              textOverflow: 'ellipsis',
              whiteSpace: 'nowrap',
            }}>
              {isCloudAuth && cloudUser?.nickname ? cloudUser.nickname : (nickname || '用户')}
            </span>
            {isCloudAuth && (
              <span title="已登录云账号" style={{
                fontSize: 10,
                color: '#52c41a',
              }}>
                ☁️
              </span>
            )}
          </motion.button>
        </Dropdown>

        <NotificationBell />

        <motion.button
          id="tour-search"
          onClick={() => setSearchDialogOpen(true)}
          whileHover={{ 
            scale: 1.02, 
          }}
          whileTap={{ scale: 0.98 }}
          style={{
            display: 'flex',
            alignItems: 'center',
            gap: 4,
            padding: '5px 10px',
            borderRadius: 'var(--radius-md)',
            backgroundColor: 'var(--bg-tertiary)',
            color: 'var(--text-secondary)',
            fontSize: 12,
            cursor: 'pointer',
            borderTop: '1px solid rgba(0,0,0,0.1)',
            borderLeft: '1px solid rgba(0,0,0,0.08)',
            borderRight: '1px solid rgba(255,255,255,0.1)',
            borderBottom: '1px solid rgba(255,255,255,0.12)',
            boxShadow: 'inset 0 2px 6px rgba(0,0,0,0.1), inset 0 1px 0 rgba(255,255,255,0.08)',
            whiteSpace: 'nowrap',
          }}
        >
          {/* 搜索图标动画 */}
          <motion.div
            whileHover={{ rotate: 90, scale: 1.1 }}
            whileTap={{ 
              scale: [1, 1.3, 0.9, 1],
              rotate: [0, 45, 90, 0],
            }}
            transition={{
              type: 'spring',
              stiffness: 400,
              damping: 15,
            }}
          >
            <SearchIcon size={13} />
          </motion.div>
          
          <span>搜索</span>
          <motion.kbd
            whileHover={{ y: 2, scale: 0.95, borderBottomWidth: '1px' }}
            whileTap={{ y: 3, scale: 0.9 }}
            transition={{ type: 'spring', stiffness: 500, damping: 15, mass: 0.3 }}
            style={{
            fontSize: 10,
            padding: '1px 6px',
            borderRadius: 4,
            backgroundColor: 'var(--bg-secondary)',
            color: 'var(--text-tertiary)',
            fontFamily: 'monospace',
            borderTop: '1px solid rgba(255,255,255,0.15)',
            borderLeft: '1px solid rgba(255,255,255,0.1)',
            borderRight: '1px solid rgba(0,0,0,0.08)',
            borderBottom: '2px solid rgba(0,0,0,0.12)',
            boxShadow: '0 2px 0 rgba(0,0,0,0.08), inset 0 1px 0 rgba(255,255,255,0.1)',
            display: 'inline-block',
          }}>
            Ctrl+F
          </motion.kbd>
        </motion.button>
            </div>
          </div>
        </Splitter.Panel>
      </Splitter>
    </header>

    {/* 粒子效果 */}
    {particles.map(p => (
      <motion.div
        key={p.id}
        initial={{ opacity: 1, scale: 1 }}
        style={{
          position: 'fixed',
          left: p.x,
          top: p.y,
          width: p.size,
          height: p.size,
          borderRadius: '50%',
          backgroundColor: p.color,
          pointerEvents: 'none',
          zIndex: 9999,
          opacity: p.life,
          transform: `scale(${0.5 + p.life * 0.5})`,
        }}
      />
    ))}

    {/* 看板按钮右键菜单 */}
    <AnimatePresence>
      {boardButtonContextMenu.visible && (
        <motion.div
          initial={{ opacity: 0, scale: 0.9, y: -10 }}
          animate={{ opacity: 1, scale: 1, y: 0 }}
          exit={{ opacity: 0, scale: 0.9, y: -10 }}
          className="board-button-context-menu"
          style={{
            position: 'fixed',
            left: boardButtonContextMenu.x,
            top: boardButtonContextMenu.y,
            zIndex: 9999,
            backgroundColor: 'var(--bg-secondary)',
            borderRadius: 'var(--radius-md)',
            boxShadow: '0 10px 40px -10px rgba(0, 0, 0, 0.3)',
            border: '1px solid var(--border-color)',
            padding: '4px 0',
            minWidth: 150,
          }}
        >
          <button
            onClick={handleDetachFromMenu}
            style={{
              width: '100%',
              padding: '10px 16px',
              border: 'none',
              backgroundColor: 'transparent',
              color: 'var(--text-primary)',
              cursor: 'pointer',
              fontSize: 14,
              fontWeight: 500,
              textAlign: 'left',
              display: 'flex',
              alignItems: 'center',
              gap: 8,
              transition: 'all 0.15s ease',
            }}
            onMouseEnter={(e) => {
              e.currentTarget.style.backgroundColor = 'var(--bg-hover)';
            }}
            onMouseLeave={(e) => {
              e.currentTarget.style.backgroundColor = 'transparent';
            }}
          >
            <StickyNoteIcon size={16} />
            脱落
          </button>
        </motion.div>
      )}
    </AnimatePresence>

    {musicShowMusicManager && (
      <div
        style={{
          position: 'fixed',
          left: musicManagerPos.x,
          top: musicManagerPos.y,
          zIndex: 10001,
        }}
      >
        {/* 外层容器 - 用于包裹侧边栏和主面板 */}
        <div
          style={{
            position: 'relative',
            display: 'flex',
            alignItems: 'flex-start',
          }}
        >
          {/* 曲目信息侧边栏 - 放在左侧 */}
          <TrackInfoSidebar
            visible={showTrackInfoSidebar}
            trackId={trackInfoTrackId}
            trackSource={trackInfoSource}
            initialEditMode={trackInfoEditMode}
            onClose={() => {
              setShowTrackInfoSidebar(false);
              setTrackInfoTrackId(null);
              setTrackInfoEditMode(false);
            }}
            onUpdated={() => {
              // 刷新曲目列表
              // 通过 MusicLibraryPanel 内部处理
            }}
          />

          {/* 音乐管理器主面板 */}
          <div
            style={{
              width: 420,
              maxHeight: 520,
              backgroundColor: 'var(--bg-secondary)',
              borderRadius: 12,
              border: '1px solid var(--border-color)',
              boxShadow: '0 16px 48px rgba(0,0,0,0.3)',
              overflow: 'hidden',
              display: 'flex',
              flexDirection: 'column',
              opacity: isDraggingMusicManager ? 0.9 : 1,
              transition: isDraggingMusicManager ? 'none' : 'opacity 0.15s ease',
            }}
          >
            <div
              onMouseDown={handleMusicManagerDragStart}
              style={{
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'space-between',
                padding: '10px 14px',
                backgroundColor: 'var(--bg-tertiary)',
                borderBottom: '1px solid var(--border-light)',
                cursor: isDraggingMusicManager ? 'grabbing' : 'grab',
              }}
            >
            <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
              <GripHorizontal size={14} style={{ color: 'var(--text-tertiary)', opacity: 0.5 }} />
              <AlignJustify size={14} style={{ color: 'var(--primary-color)' }} />
              <span style={{ fontSize: 13, fontWeight: 600, color: 'var(--text-primary)' }}>音乐管理</span>
            </div>
            <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
              <motion.button
                onClick={() => musicSetShowMusicManager(false)}
                whileHover={{ scale: 1.1 }}
                whileTap={{ scale: 0.9 }}
                style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', border: 'none', background: 'none', cursor: 'pointer', color: 'var(--text-tertiary)', padding: 0 }}
              >
                <X size={14} />
              </motion.button>
            </div>
          </div>

          <div style={{ padding: '12px 14px', display: 'flex', flexDirection: 'column', gap: 12, flex: 1, overflow: 'auto' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
              {/* 封面 - 有封面则显示图片，否则显示默认渐变色+Music图标 */}
              {musicTracks[musicCurrentTrackIndex]?.coverUrl ? (
                <img
                  src={musicTracks[musicCurrentTrackIndex].coverUrl}
                  alt=""
                  style={{
                    width: 44, height: 44, borderRadius: 8,
                    objectFit: 'cover', flexShrink: 0,
                  }}
                />
              ) : (
                <div style={{
                  width: 44, height: 44, borderRadius: 8,
                  background: 'linear-gradient(135deg, var(--primary-color), var(--primary-light))',
                  display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0,
                }}>
                  <Music size={20} style={{ color: 'white' }} />
                </div>
              )}
              <div style={{ flex: 1, minWidth: 0 }}>
                <Typography.Text ellipsis style={{ fontSize: 13, fontWeight: 600, color: 'var(--primary-color)' }}>
                  {musicTracks[musicCurrentTrackIndex].title}
                </Typography.Text>
                <div style={{ fontSize: 11, color: 'var(--text-tertiary)' }}>
                  {musicTracks[musicCurrentTrackIndex].artist}
                </div>
              </div>
            </div>

            <div style={{ display: 'flex', justifyContent: 'center', padding: '0 14px' }}>
              <AudioVisualizer
                width={360}
                height={24}
                mode="bars"
                barCount={32}
                gap={2}
                borderRadius={2}
                opacity={musicIsPlaying ? 0.6 : 0.2}
              />
            </div>

            <div style={{ display: 'flex', alignItems: 'center', gap: 4 }}>
              <span style={{ fontSize: 9, color: 'var(--text-tertiary)', fontVariantNumeric: 'tabular-nums' }}>{musicFormatTime(musicCurrentTime)}</span>
              <div
                onMouseDown={(e) => {
                  e.preventDefault();
                  const bar = e.currentTarget as HTMLElement;
                  const dur = useMusicStore.getState().duration;
                  if (!dur || !isFinite(dur)) return;
                  const rect = bar.getBoundingClientRect();
                  const ratio = Math.max(0, Math.min((e.clientX - rect.left) / rect.width, 1));
                  musicSeekToRatio(ratio);
                }}
                style={{
                  flex: 1,
                  height: 5,
                  borderRadius: 3,
                  backgroundColor: 'var(--bg-tertiary)',
                  cursor: 'pointer',
                  position: 'relative',
                }}
              >
                <div style={{
                  height: '100%',
                  borderRadius: 3,
                  background: 'linear-gradient(90deg, var(--primary-color), var(--primary-light))',
                  width: `${musicProgress * 100}%`,
                  position: 'relative',
                }}>
                  <div style={{
                    position: 'absolute',
                    right: -5,
                    top: '50%',
                    transform: 'translateY(-50%)',
                    width: 10,
                    height: 10,
                    borderRadius: '50%',
                    backgroundColor: 'var(--primary-color)',
                    boxShadow: '0 0 4px color-mix(in srgb, var(--primary-color) 50%, transparent)',
                  }} />
                </div>
              </div>
              <span style={{ fontSize: 9, color: 'var(--text-tertiary)', fontVariantNumeric: 'tabular-nums' }}>{musicFormatTime(musicDuration)}</span>
            </div>

            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 10 }}>
              <motion.button onClick={() => { const idx = musicPrevTrack(); if (idx !== musicCurrentTrackIndex) musicLoadTrack(idx, true); }} whileHover={{ scale: 1.1 }} whileTap={{ scale: 0.9 }} style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', border: 'none', background: 'none', cursor: 'pointer', color: 'var(--text-tertiary)', padding: 2 }}>
                <SkipBack size={16} />
              </motion.button>
              <motion.button onClick={musicTogglePlay} whileHover={{ scale: 1.1 }} whileTap={{ scale: 0.9 }} style={{
                display: 'flex', alignItems: 'center', justifyContent: 'center',
                width: 36, height: 36, borderRadius: '50%',
                background: 'linear-gradient(135deg, var(--primary-color), var(--primary-light))',
                border: 'none', cursor: 'pointer', color: 'white',
                boxShadow: '0 2px 8px color-mix(in srgb, var(--primary-color) 30%, transparent)',
              }}>
                {musicIsPlaying ? <Pause size={16} /> : <Play size={16} style={{ marginLeft: 2 }} />}
              </motion.button>
              <motion.button onClick={() => { const idx = musicNextTrack(); musicLoadTrack(idx, musicIsPlaying); }} whileHover={{ scale: 1.1 }} whileTap={{ scale: 0.9 }} style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', border: 'none', background: 'none', cursor: 'pointer', color: 'var(--text-tertiary)', padding: 2 }}>
                <SkipForward size={16} />
              </motion.button>
              <div style={{ width: 1, height: 20, backgroundColor: 'var(--border-light)' }} />
              <motion.button onClick={musicCyclePlayMode} whileHover={{ scale: 1.1 }} whileTap={{ scale: 0.9 }} style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', border: 'none', background: 'none', cursor: 'pointer', color: musicPlayMode !== 'sequential' ? 'var(--primary-color)' : 'var(--text-tertiary)', padding: 2 }} title={musicPlayModeLabel}>
                {musicPlayMode === 'random' ? <Shuffle size={14} /> : musicPlayMode === 'loop' ? (
                  <span style={{ position: 'relative', display: 'inline-flex', alignItems: 'center', justifyContent: 'center' }}>
                    <Repeat size={14} />
                    <span style={{ position: 'absolute', fontSize: 7, fontWeight: 800, lineHeight: 1, top: '50%', left: '50%', transform: 'translate(-50%, -50%)' }}>1</span>
                  </span>
                ) : <Repeat size={14} />}
              </motion.button>
              <span style={{ fontSize: 9, color: 'var(--text-tertiary)', minWidth: 40 }}>{musicPlayModeLabel}</span>
              {/* 音量控制 - 喇叭按钮 + 悬浮弹出垂直滑块 */}
              <div
                style={{ position: 'relative', display: 'flex', alignItems: 'center' }}
                onMouseEnter={() => {
                  cancelHideVolumePopup();
                  setIsVolumePopupVisible(true);
                }}
                onMouseLeave={() => scheduleHideVolumePopup()}
              >
                <motion.button
                  onClick={() => {
                    if (musicVolume > 0) {
                      setVolumeBeforeMute(musicVolume);
                      musicSetVolume(0);
                    } else {
                      musicSetVolume(volumeBeforeMute);
                    }
                  }}
                  whileHover={{ scale: 1.1 }}
                  whileTap={{ scale: 0.9 }}
                  style={{
                    display: 'flex', alignItems: 'center', justifyContent: 'center',
                    border: 'none', background: 'none', cursor: 'pointer',
                    color: musicVolume === 0 ? 'var(--text-tertiary)' : 'var(--text-tertiary)',
                    padding: 2,
                  }}
                  title={musicVolume === 0 ? '取消静音' : '静音'}
                >
                  {musicVolume === 0 ? <VolumeX size={14} /> : <Volume2 size={14} />}
                </motion.button>
                {/* 弹出的垂直音量滑块 - 自定义样式 */}
                {isVolumePopupVisible && (
                  <div
                    style={{
                      position: 'absolute',
                      bottom: '100%',
                      left: '50%',
                      transform: 'translateX(-50%)',
                      marginBottom: 8,
                      background: 'var(--bg-primary)',
                      border: '1px solid var(--border-light)',
                      borderRadius: 8,
                      padding: '6px 5px',
                      boxShadow: '0 4px 12px rgba(0,0,0,0.15)',
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'center',
                      zIndex: 100,
                    }}
                    onMouseEnter={() => cancelHideVolumePopup()}
                    onMouseLeave={() => scheduleHideVolumePopup()}
                  >
                    {/* 自定义垂直滑块容器 */}
                    <div
                      style={{
                        width: 12,
                        height: 50,
                        backgroundColor: 'var(--bg-tertiary)',
                        borderRadius: 6,
                        position: 'relative',
                        cursor: 'pointer',
                        overflow: 'hidden',
                      }}
                      onMouseDown={(e) => {
                        e.preventDefault();
                        useMusicStore.getState().ensureAudioContext();
                        const rect = e.currentTarget.getBoundingClientRect();
                        const y = e.clientY - rect.top;
                        const ratio = 1 - Math.max(0, Math.min(y / rect.height, 1));
                        musicSetVolume(Math.round(ratio * 200));

                        const handleMouseMove = (moveEvent: MouseEvent) => {
                          const moveY = moveEvent.clientY - rect.top;
                          const moveRatio = 1 - Math.max(0, Math.min(moveY / rect.height, 1));
                          musicSetVolume(Math.round(moveRatio * 200));
                        };
                        const handleMouseUp = () => {
                          window.removeEventListener('mousemove', handleMouseMove);
                          window.removeEventListener('mouseup', handleMouseUp);
                        };
                        window.addEventListener('mousemove', handleMouseMove);
                        window.addEventListener('mouseup', handleMouseUp);
                      }}
                    >
                      {/* 填充部分（从底部开始） */}
                      <div style={{
                        position: 'absolute',
                        bottom: 0,
                        left: 0,
                        right: 0,
                        height: `${(musicVolume / 200) * 100}%`,
                        background: 'linear-gradient(to top, var(--primary-color), var(--primary-light))',
                        borderRadius: 6,
                      }} />
                      {/* 滑块把手 */}
                      <div style={{
                        position: 'absolute',
                        left: '50%',
                        transform: 'translateX(-50%)',
                        bottom: `${(musicVolume / 200) * 100}%`,
                        width: 10,
                        height: 10,
                        borderRadius: '50%',
                        background: 'white',
                        boxShadow: '0 2px 6px rgba(0,0,0,0.2)',
                        marginBottom: -5,
                      }} />
                    </div>
                  </div>
                )}
              </div>
            </div>

            <MusicLibraryPanel
              compact
              onOpenTrackInfo={(trackId, source, editMode = false) => {
                setTrackInfoTrackId(trackId);
                setTrackInfoSource(source);
                setTrackInfoEditMode(editMode);
                setShowTrackInfoSidebar(true);
              }}
            />
          </div>
        </div>
      </div>
      </div>
    )}

    <AnimatePresence>
      {musicPlayerContextMenu.visible && (
        <motion.div
          initial={{ opacity: 0, scale: 0.9, y: -10 }}
          animate={{ opacity: 1, scale: 1, y: 0 }}
          exit={{ opacity: 0, scale: 0.9, y: -10 }}
          className="music-player-context-menu"
          style={{
            position: 'fixed',
            left: musicPlayerContextMenu.x,
            top: musicPlayerContextMenu.y,
            zIndex: 9999,
            backgroundColor: 'var(--bg-secondary)',
            borderRadius: 'var(--radius-md)',
            boxShadow: '0 10px 40px -10px rgba(0, 0, 0, 0.3)',
            border: '1px solid var(--border-color)',
            padding: '4px 0',
            minWidth: 160,
          }}
        >
          <button
            onClick={() => {
              musicSetShowMusicManager(true);
              setMusicPlayerContextMenu(prev => ({ ...prev, visible: false }));
            }}
            style={{
              width: '100%',
              padding: '8px 14px',
              border: 'none',
              backgroundColor: 'transparent',
              color: 'var(--text-primary)',
              cursor: 'pointer',
              fontSize: 13,
              fontWeight: 500,
              textAlign: 'left',
              display: 'flex',
              alignItems: 'center',
              gap: 8,
              transition: 'all 0.15s ease',
            }}
            onMouseEnter={(e) => { e.currentTarget.style.backgroundColor = 'var(--bg-hover)'; }}
            onMouseLeave={(e) => { e.currentTarget.style.backgroundColor = 'transparent'; }}
          >
            <Music size={14} />
            音乐管理
          </button>
          <div style={{ height: 1, backgroundColor: 'var(--border-light)', margin: '4px 0' }} />
          <button
            onClick={() => {
              musicSetShowLyrics(!musicShowLyrics);
              setMusicPlayerContextMenu(prev => ({ ...prev, visible: false }));
            }}
            style={{
              width: '100%',
              padding: '8px 14px',
              border: 'none',
              backgroundColor: 'transparent',
              color: 'var(--text-primary)',
              cursor: 'pointer',
              fontSize: 13,
              fontWeight: 500,
              textAlign: 'left',
              display: 'flex',
              alignItems: 'center',
              gap: 8,
              transition: 'all 0.15s ease',
            }}
            onMouseEnter={(e) => { e.currentTarget.style.backgroundColor = 'var(--bg-hover)'; }}
            onMouseLeave={(e) => { e.currentTarget.style.backgroundColor = 'transparent'; }}
          >
            <AlignJustify size={14} />
            {musicShowLyrics ? '收起歌词' : '显示歌词'}
          </button>
        </motion.div>
      )}
    </AnimatePresence>

    {profileDialogOpen && <ProfileDialog onClose={() => setProfileDialogOpen(false)} />}
    <Modal
      open={feedbackDialogOpen}
      onCancel={() => setFeedbackDialogOpen(false)}
      title="帮助与反馈"
      footer={null}
      centered
      width={400}
    >
      <div style={{
        padding: '8px 0',
        display: 'flex',
        flexDirection: 'column',
        alignItems: 'center',
        gap: 20,
      }}>
        <div style={{
          fontSize: 13,
          color: 'var(--text-secondary)',
          textAlign: 'center',
          lineHeight: 1.6,
        }}>
          如有任何建议或问题，欢迎通过 QQ 邮箱联系我们
        </div>
        <div style={{
          width: '100%',
          padding: '12px 16px',
          backgroundColor: 'var(--bg-primary)',
          borderRadius: 'var(--radius-md)',
          border: '1px solid var(--border-light)',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          gap: 12,
        }}>
          <span style={{
            fontSize: 14,
            color: 'var(--primary-color)',
            fontWeight: 600,
            fontFamily: 'monospace',
          }}>
            1710368392@qq.com
          </span>
          <motion.button
            whileHover={{ scale: 1.05 }}
            whileTap={{ scale: 0.95 }}
            onClick={() => {
              navigator.clipboard.writeText('1710368392@qq.com');
              showToast('success', '邮箱已复制');
            }}
            style={{
              padding: '4px 12px',
              borderRadius: 'var(--radius-md)',
              border: 'none',
              backgroundColor: 'var(--primary-bg)',
              color: 'var(--primary-color)',
              fontSize: 12,
              fontWeight: 600,
              cursor: 'pointer',
              whiteSpace: 'nowrap',
            }}
          >
            复制
          </motion.button>
        </div>
        <div style={{
          display: 'flex',
          gap: 10,
          width: '100%',
        }}>
          <motion.button
            whileHover={{ scale: 1.02 }}
            whileTap={{ scale: 0.98 }}
            onClick={() => setFeedbackDialogOpen(false)}
            style={{
              flex: 1,
              height: 40,
              borderRadius: 'var(--radius-md)',
              border: '1px solid var(--border-light)',
              backgroundColor: 'var(--bg-tertiary)',
              color: 'var(--text-secondary)',
              fontSize: 14,
              fontWeight: 500,
              cursor: 'pointer',
            }}
          >
            关闭
          </motion.button>
          <motion.button
            whileHover={{ scale: 1.02 }}
            whileTap={{ scale: 0.98 }}
            onClick={() => {
              navigator.clipboard.writeText('1710368392@qq.com');
              window.open('https://mail.qq.com/', '_blank');
              setFeedbackDialogOpen(false);
            }}
            style={{
              flex: 1,
              height: 40,
              borderRadius: 'var(--radius-md)',
              border: 'none',
              background: 'linear-gradient(135deg, var(--primary-color), var(--primary-light))',
              color: '#fff',
              fontSize: 14,
              fontWeight: 600,
              cursor: 'pointer',
              boxShadow: '0 4px 12px rgba(108, 99, 255, 0.3)',
            }}
          >
            复制并打开邮箱
          </motion.button>
        </div>
      </div>
    </Modal>
    </>
  );
};

export default Header;
