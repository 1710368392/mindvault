import React, { useState, useEffect, useCallback, useRef } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import {
  Search,
  Play,
  Music,
  AlertCircle,
  ChevronDown,
  ChevronLeft,
  ChevronRight,
  Loader2,
  Crown,
  Cookie,
  X,
  QrCode,
  ShieldCheck,
  Check,
  TrendingUp,
  Flame,
  Sparkles,
  Disc3,
  LogIn,
  Download,
  User,
  LogOut,
  Trash2,
  RefreshCw,
  Info,
  Layers,
  Settings2,
  ListMusic,
} from 'lucide-react';
import { useMusicStore, MusicTrack } from '../../stores/musicStore';
import { api } from '../../utils/api';
import TrackInfoSidebar from './TrackInfoSidebar';

// ============================================================
// Types (内联类型定义)
// ============================================================

/** QQ/网易云歌曲通用结构 */
interface QQSong {
  id: string;
  name: string;
  singer: string;
  album: string;
  albummid: string;
  coverUrl?: string;
  duration: number;
  pay: number;
}

/** 榜单信息 */
interface ChartInfo {
  id: string;
  name: string;
  coverUrl: string;
  description: string;
  updateFrequency: string;
  playCount: number;
  trackCount: number;
}

/** 榜单中的歌曲（简化版） */
interface ChartSong {
  id: string;
  name: string;
  singer: string;
  album: string;
  coverUrl: string;
  duration: number;
  pay: number;
}

/** 视图模式：首页 或 搜索结果 */
type ViewMode = 'home' | 'search';

/** 已保存的账号信息 */
interface SavedAccount {
  userId: number;
  nickname: string;
  avatarUrl: string;
  cookie: string;
  savedAt: number;
}

/** 当前登录用户信息 */
interface LoginUserInfo {
  userId: number;
  nickname: string;
  avatarUrl: string;
  vipType: number;
}

/** 下载状态映射 */
type DownloadStatus = 'idle' | 'downloading' | 'success' | 'error';

// ============================================================
// Helpers
// ============================================================

/** 格式化时长（秒 -> m:ss） */
function formatDuration(seconds: number): string {
  if (!seconds || seconds <= 0) return '0:00';
  const m = Math.floor(seconds / 60);
  const s = Math.floor(seconds % 60);
  return `${m}:${s.toString().padStart(2, '0')}`;
}

/** 获取歌曲封面 URL */
function getCoverUrl(song: QQSong | ChartSong): string {
  // 优先使用 API 返回的封面 URL
  if (song.coverUrl) return song.coverUrl;
  // QQ 音乐封面格式（兼容）
  if ('albummid' in song && song.albummid) {
    return `https://y.gtimg.cn/music/photo_new/T002R300x300M000${song.albummid}.jpg`;
  }
  return '';
}

/** 格式化播放次数 */
function formatPlayCount(count: number): string {
  if (!count) return '';
  if (count >= 100000000) return `${(count / 100000000).toFixed(1)}亿`;
  if (count >= 10000) return `${(count / 10000).toFixed(1)}万`;
  return String(count);
}

/** 格式化时间戳为可读日期 */
function formatSavedTime(timestamp: number): string {
  if (!timestamp) return '';
  const date = new Date(timestamp);
  const month = date.getMonth() + 1;
  const day = date.getDate();
  const hours = date.getHours().toString().padStart(2, '0');
  const minutes = date.getMinutes().toString().padStart(2, '0');
  return `${month}/${day} ${hours}:${minutes}`;
}

// ============================================================
// 网易云音乐登录组件
// ============================================================

type LoginStatus = 'idle' | 'logging' | 'success' | 'error';

/** 网易云音乐登录组件（弹出官方登录窗口） */
const NeteaseMusicLogin: React.FC<{
  onLoginSuccess: (cookie: string) => void;
  onOpenCookieModal: () => void;
}> = ({ onLoginSuccess, onOpenCookieModal }) => {
  const [status, setStatus] = useState<LoginStatus>('idle');
  const [errorMessage, setErrorMessage] = useState('');

  /** 处理网易云登录 */
  const handleNeteaseLogin = useCallback(async () => {
    setStatus('logging');
    setErrorMessage('');

    try {
      const res = await api.musicOnline.loginNetease();
      if (res.success && res.data?.cookie) {
        setStatus('success');
        onLoginSuccess(res.data.cookie);
      } else {
        // 用户关闭了窗口 = 取消登录
        setStatus('idle');
        if (res.error && !res.error.includes('取消')) {
          setErrorMessage(res.error);
        }
      }
    } catch {
      setStatus('error');
      setErrorMessage('登录过程出错');
    }
  }, [onLoginSuccess]);

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 16, padding: '16px 0', alignItems: 'center' }}>
      {/* 图标 */}
      <div style={{
        width: 64, height: 64, borderRadius: 16,
        background: 'linear-gradient(135deg, #C20C0C 0%, #9B1B1B 100%)',
        display: 'flex', alignItems: 'center', justifyContent: 'center',
        boxShadow: '0 4px 16px rgba(194, 12, 12, 0.3)',
      }}>
        <Disc3 size={32} color="white" />
      </div>

      {/* 标题 */}
      <div style={{ textAlign: 'center' }}>
        <div style={{ fontSize: 15, fontWeight: 600, color: 'var(--text-primary)', marginBottom: 4 }}>
          登录网易云音乐
        </div>
        <div style={{ fontSize: 12, color: 'var(--text-tertiary)', lineHeight: 1.6 }}>
          登录后即可畅享 VIP 曲库<br />
          VIP 用户可播放完整高品质音乐
        </div>
      </div>

      {/* 登录按钮 */}
      {status === 'idle' || status === 'error' ? (
        <motion.button
          whileHover={{ scale: 1.03 }}
          whileTap={{ scale: 0.97 }}
          onClick={handleNeteaseLogin}
          style={{
            display: 'flex',
            alignItems: 'center',
            gap: 8,
            padding: '12px 32px',
            borderRadius: 12,
            border: 'none',
            background: 'linear-gradient(135deg, #C20C0C 0%, #9B1B1B 100%)',
            color: 'white',
            cursor: 'pointer',
            fontSize: 14,
            fontWeight: 600,
            boxShadow: '0 4px 16px rgba(194, 12, 12, 0.3)',
          }}
        >
          <LogIn size={18} />
          网易云音乐登录
        </motion.button>
      ) : status === 'logging' ? (
        <div style={{
          display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 8,
          padding: '12px 32px',
        }}>
          <Loader2 size={20} style={{ color: '#C20C0C', animation: 'spin 1s linear infinite' }} />
          <span style={{ fontSize: 13, color: 'var(--text-secondary)' }}>
            等待登录中...
          </span>
          <span style={{ fontSize: 11, color: 'var(--text-tertiary)' }}>
            请在弹出的窗口中完成登录
          </span>
        </div>
      ) : status === 'success' ? (
        <div style={{
          display: 'flex', alignItems: 'center', gap: 8,
          padding: '12px 24px',
          borderRadius: 12,
          backgroundColor: 'rgba(34, 197, 94, 0.08)',
        }}>
          <motion.div
            initial={{ scale: 0 }}
            animate={{ scale: 1 }}
            transition={{ type: 'spring', stiffness: 200, damping: 15 }}
          >
            <ShieldCheck size={20} style={{ color: '#22c55e' }} />
          </motion.div>
          <span style={{ fontSize: 13, fontWeight: 500, color: '#22c55e' }}>登录成功</span>
        </div>
      ) : null}

      {/* 错误信息 */}
      {errorMessage && (
        <span style={{ fontSize: 12, color: '#ef4444' }}>{errorMessage}</span>
      )}

      {/* 分割线 */}
      <div style={{
        display: 'flex', alignItems: 'center', gap: 12,
        width: '80%', maxWidth: 280,
      }}>
        <div style={{ flex: 1, height: 1, backgroundColor: 'var(--border-light)' }} />
        <span style={{ fontSize: 11, color: 'var(--text-tertiary)' }}>或者</span>
        <div style={{ flex: 1, height: 1, backgroundColor: 'var(--border-light)' }} />
      </div>

      {/* 手动粘贴 Cookie */}
      <motion.button
        whileHover={{ scale: 1.02 }}
        whileTap={{ scale: 0.98 }}
        onClick={onOpenCookieModal}
        style={{
          display: 'flex',
          alignItems: 'center',
          gap: 6,
          padding: '8px 20px',
          borderRadius: 8,
          border: '1px solid var(--border-light)',
          backgroundColor: 'var(--bg-tertiary)',
          color: 'var(--text-secondary)',
          cursor: 'pointer',
          fontSize: 12,
          fontWeight: 500,
        }}
      >
        <Cookie size={13} />
        手动粘贴 Cookie
      </motion.button>

      {/* 安全提示 */}
      <div style={{
        display: 'flex',
        alignItems: 'center',
        gap: 4,
        padding: '4px 0 0',
      }}>
        <ShieldCheck size={10} style={{ color: 'var(--text-tertiary)', opacity: 0.5 }} />
        <span style={{ fontSize: 10, color: 'var(--text-tertiary)', opacity: 0.6 }}>
          登录凭证仅存储在本地，不会上传到任何服务器
        </span>
      </div>
    </div>
  );
};

// ============================================================
// QQ 音乐登录组件
// ============================================================

/** QQ 音乐登录组件（弹出 QQ 音乐官方登录窗口） */
const QQMusicLogin: React.FC<{
  onLoginSuccess: (cookie: string) => void;
}> = ({ onLoginSuccess }) => {
  const [status, setStatus] = useState<LoginStatus>('idle');
  const [errorMessage, setErrorMessage] = useState('');

  /** 处理 QQ 音乐登录 */
  const handleQQLogin = useCallback(async () => {
    setStatus('logging');
    setErrorMessage('');

    try {
      const res = await api.musicOnline.loginOpen();
      if (res.success && res.data?.cookie) {
        setStatus('success');
        onLoginSuccess(res.data.cookie);
      } else {
        // 用户关闭了窗口 = 取消登录
        setStatus('idle');
        if (res.error && !res.error.includes('取消')) {
          setErrorMessage(res.error);
        }
      }
    } catch {
      setStatus('error');
      setErrorMessage('登录过程出错');
    }
  }, [onLoginSuccess]);

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 12, padding: '16px 0', alignItems: 'center' }}>
      {/* 图标 */}
      <div style={{
        width: 48, height: 48, borderRadius: 12,
        background: 'linear-gradient(135deg, #31C27C 0%, #1FAF6B 100%)',
        display: 'flex', alignItems: 'center', justifyContent: 'center',
        boxShadow: '0 4px 16px rgba(49, 194, 124, 0.3)',
      }}>
        <Music size={24} color="white" />
      </div>

      {/* 标题 */}
      <div style={{ textAlign: 'center' }}>
        <div style={{ fontSize: 14, fontWeight: 600, color: 'var(--text-primary)', marginBottom: 4 }}>
          登录QQ音乐
        </div>
        <div style={{ fontSize: 11, color: 'var(--text-tertiary)', lineHeight: 1.6 }}>
          使用QQ音乐账号登录
        </div>
      </div>

      {/* 登录按钮 */}
      {status === 'idle' || status === 'error' ? (
        <motion.button
          whileHover={{ scale: 1.03 }}
          whileTap={{ scale: 0.97 }}
          onClick={handleQQLogin}
          style={{
            display: 'flex',
            alignItems: 'center',
            gap: 8,
            padding: '10px 28px',
            borderRadius: 10,
            border: 'none',
            background: 'linear-gradient(135deg, #31C27C 0%, #1FAF6B 100%)',
            color: 'white',
            cursor: 'pointer',
            fontSize: 13,
            fontWeight: 600,
            boxShadow: '0 4px 16px rgba(49, 194, 124, 0.3)',
          }}
        >
          <LogIn size={16} />
          QQ音乐登录
        </motion.button>
      ) : status === 'logging' ? (
        <div style={{
          display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 8,
          padding: '10px 28px',
        }}>
          <Loader2 size={20} style={{ color: '#31C27C', animation: 'spin 1s linear infinite' }} />
          <span style={{ fontSize: 12, color: 'var(--text-secondary)' }}>
            等待登录中...
          </span>
          <span style={{ fontSize: 11, color: 'var(--text-tertiary)' }}>
            请在弹出的窗口中完成登录
          </span>
        </div>
      ) : status === 'success' ? (
        <div style={{
          display: 'flex', alignItems: 'center', gap: 8,
          padding: '10px 24px',
          borderRadius: 10,
          backgroundColor: 'rgba(34, 197, 94, 0.08)',
        }}>
          <motion.div
            initial={{ scale: 0 }}
            animate={{ scale: 1 }}
            transition={{ type: 'spring', stiffness: 200, damping: 15 }}
          >
            <ShieldCheck size={20} style={{ color: '#22c55e' }} />
          </motion.div>
          <span style={{ fontSize: 13, fontWeight: 500, color: '#22c55e' }}>登录成功</span>
        </div>
      ) : null}

      {/* 错误信息 */}
      {errorMessage && (
        <span style={{ fontSize: 12, color: '#ef4444' }}>{errorMessage}</span>
      )}
    </div>
  );
};

/** QQ 音乐紧凑登录按钮 */
const QQLoginButton: React.FC<{
  onLoginSuccess: (cookie: string) => void;
}> = ({ onLoginSuccess }) => {
  const [status, setStatus] = useState<LoginStatus>('idle');
  const [errorMessage, setErrorMessage] = useState('');

  const handleQQLogin = useCallback(async () => {
    setStatus('logging');
    setErrorMessage('');

    try {
      const res = await api.musicOnline.loginOpen();
      if (res.success && res.data?.cookie) {
        setStatus('success');
        onLoginSuccess(res.data.cookie);
      } else {
        setStatus('idle');
        if (res.error && !res.error.includes('取消')) {
          setErrorMessage(res.error);
        }
      }
    } catch {
      setStatus('error');
      setErrorMessage('登录过程出错');
    }
  }, [onLoginSuccess]);

  return (
    <>
      {status === 'idle' || status === 'error' ? (
        <motion.button
          whileHover={{ scale: 1.03 }}
          whileTap={{ scale: 0.97 }}
          onClick={handleQQLogin}
          style={{
            display: 'flex',
            alignItems: 'center',
            gap: 6,
            padding: '8px 20px',
            borderRadius: 8,
            border: 'none',
            background: 'linear-gradient(135deg, #31C27C 0%, #1FAF6B 100%)',
            color: 'white',
            cursor: 'pointer',
            fontSize: 12,
            fontWeight: 600,
            boxShadow: '0 2px 8px rgba(49, 194, 124, 0.3)',
          }}
        >
          <LogIn size={14} />
          QQ音乐登录
        </motion.button>
      ) : status === 'logging' ? (
        <div style={{
          display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 4,
        }}>
          <Loader2 size={16} style={{ color: '#31C27C', animation: 'spin 1s linear infinite' }} />
          <span style={{ fontSize: 10, color: 'var(--text-tertiary)' }}>
            等待登录中...
          </span>
        </div>
      ) : null}
      {errorMessage && (
        <span style={{ fontSize: 10, color: '#ef4444' }}>{errorMessage}</span>
      )}
    </>
  );
};

// ============================================================
// Cookie 输入弹窗
// ============================================================

/** Cookie 配置弹窗 */
const CookieModal: React.FC<{
  visible: boolean;
  onClose: () => void;
  onSave: (cookie: string) => void;
}> = ({ visible, onClose, onSave }) => {
  const [cookie, setCookie] = useState('');
  const [validating, setValidating] = useState(false);
  const [saving, setSaving] = useState(false);
  const [status, setStatus] = useState<'unknown' | 'valid' | 'invalid'>('unknown');

  if (!visible) return null;

  /** 验证 Cookie */
  const handleValidate = async () => {
    if (!cookie.trim()) return;
    setValidating(true);
    try {
      const res = await api.musicOnline.checkCookie(cookie.trim());
      setStatus(res.success && res.data?.valid ? 'valid' : 'invalid');
    } catch {
      setStatus('invalid');
    }
    setValidating(false);
  };

  /** 保存 Cookie */
  const handleSave = async () => {
    if (!cookie.trim()) return;
    setSaving(true);
    try {
      await api.musicOnline.setCookie(cookie.trim());
      onSave(cookie.trim());
      onClose();
    } catch {
      setStatus('invalid');
    }
    setSaving(false);
  };

  return (
    <div
      style={{
        position: 'fixed',
        top: 0,
        left: 0,
        right: 0,
        bottom: 0,
        backgroundColor: 'rgba(0,0,0,0.4)',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        zIndex: 1000,
      }}
      onClick={(e) => {
        if (e.target === e.currentTarget) onClose();
      }}
    >
      <motion.div
        initial={{ opacity: 0, scale: 0.95 }}
        animate={{ opacity: 1, scale: 1 }}
        exit={{ opacity: 0, scale: 0.95 }}
        style={{
          backgroundColor: 'var(--bg-primary)',
          borderRadius: 12,
          padding: 20,
          width: 400,
          maxWidth: '90vw',
          border: '1px solid var(--border-light)',
          boxShadow: '0 8px 32px rgba(0,0,0,0.12)',
        }}
      >
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 16 }}>
          <span style={{ fontSize: 14, fontWeight: 600, color: 'var(--text-primary)' }}>配置在线音乐 Cookie</span>
          <button
            onClick={onClose}
            style={{
              border: 'none',
              background: 'none',
              cursor: 'pointer',
              color: 'var(--text-tertiary)',
              padding: 4,
              display: 'flex',
            }}
          >
            <X size={16} />
          </button>
        </div>

        <textarea
          value={cookie}
          onChange={(e) => { setCookie(e.target.value); setStatus('unknown'); }}
          placeholder="在此粘贴音乐平台 Cookie..."
          rows={4}
          style={{
            width: '100%',
            padding: 10,
            borderRadius: 8,
            border: '1px solid var(--border-light)',
            backgroundColor: 'var(--bg-tertiary)',
            color: 'var(--text-primary)',
            fontSize: 11,
            fontFamily: 'monospace',
            resize: 'vertical',
            outline: 'none',
            marginBottom: 12,
            boxSizing: 'border-box',
          }}
        />

        {/* 验证状态反馈 */}
        {status === 'valid' && (
          <div style={{ display: 'flex', alignItems: 'center', gap: 4, marginBottom: 12 }}>
            <Check size={13} style={{ color: '#22c55e' }} />
            <span style={{ fontSize: 11, color: '#22c55e' }}>Cookie 有效</span>
          </div>
        )}
        {status === 'invalid' && (
          <div style={{ display: 'flex', alignItems: 'center', gap: 4, marginBottom: 12 }}>
            <AlertCircle size={13} style={{ color: '#ef4444' }} />
            <span style={{ fontSize: 11, color: '#ef4444' }}>Cookie 无效，请检查是否正确复制</span>
          </div>
        )}

        <div style={{ display: 'flex', justifyContent: 'flex-end', gap: 8 }}>
          <motion.button
            whileHover={{ scale: 1.02 }}
            whileTap={{ scale: 0.98 }}
            onClick={handleValidate}
            disabled={!cookie.trim() || validating}
            style={{
              padding: '6px 14px',
              borderRadius: 6,
              border: '1px solid var(--border-light)',
              backgroundColor: 'var(--bg-tertiary)',
              color: 'var(--text-primary)',
              cursor: !cookie.trim() || validating ? 'not-allowed' : 'pointer',
              fontSize: 12,
              opacity: !cookie.trim() || validating ? 0.6 : 1,
              display: 'flex',
              alignItems: 'center',
              gap: 4,
            }}
          >
            {validating ? <Loader2 size={12} style={{ animation: 'spin 1s linear infinite' }} /> : null}
            验证
          </motion.button>
          <motion.button
            whileHover={{ scale: 1.02 }}
            whileTap={{ scale: 0.98 }}
            onClick={handleSave}
            disabled={!cookie.trim() || saving}
            style={{
              padding: '6px 14px',
              borderRadius: 6,
              border: 'none',
              backgroundColor: 'var(--primary-color)',
              color: 'white',
              cursor: !cookie.trim() || saving ? 'not-allowed' : 'pointer',
              fontSize: 12,
              opacity: !cookie.trim() || saving ? 0.6 : 1,
              display: 'flex',
              alignItems: 'center',
              gap: 4,
            }}
          >
            {saving ? <Loader2 size={12} style={{ animation: 'spin 1s linear infinite' }} /> : null}
            保存
          </motion.button>
        </div>
      </motion.div>
    </div>
  );
};

// ============================================================
// 账号切换下拉菜单（需求9.6）
// ============================================================

/** 账号切换下拉菜单组件 */
const AccountSwitchMenu: React.FC<{
  visible: boolean;
  accounts: SavedAccount[];
  currentUserId: number | null;
  onSwitch: (userId: number) => void;
  onDelete: (userId: number) => void;
  onAddNew: () => void;
  onClose: () => void;
}> = ({ visible, accounts, currentUserId, onSwitch, onDelete, onAddNew, onClose }) => {
  const menuRef = useRef<HTMLDivElement>(null);

  // 点击外部关闭菜单
  useEffect(() => {
    if (!visible) return;
    const handleClickOutside = (e: MouseEvent) => {
      if (menuRef.current && !menuRef.current.contains(e.target as Node)) {
        onClose();
      }
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, [visible, onClose]);

  if (!visible) return null;

  return (
    <div
      ref={menuRef}
      style={{
        position: 'absolute',
        top: '100%',
        right: 0,
        marginTop: 4,
        width: 240,
        maxHeight: 300,
        overflow: 'auto',
        backgroundColor: 'var(--bg-primary)',
        border: '1px solid var(--border-light)',
        borderRadius: 8,
        boxShadow: '0 8px 24px rgba(0,0,0,0.12)',
        zIndex: 100,
        padding: '4px 0',
      }}
    >
      {/* 账号列表 */}
      {accounts.length === 0 ? (
        <div style={{
          padding: '16px 0',
          textAlign: 'center',
          fontSize: 11,
          color: 'var(--text-tertiary)',
        }}>
          暂无已保存的账号
        </div>
      ) : (
        accounts.map((account) => {
          const isCurrent = String(account.userId) === String(currentUserId);
          return (
            <div
              key={account.userId}
              style={{
                display: 'flex',
                alignItems: 'center',
                gap: 8,
                padding: '8px 12px',
                backgroundColor: isCurrent ? 'rgba(194, 12, 12, 0.06)' : 'transparent',
                cursor: 'default',
              }}
            >
              {/* 头像 */}
              {account.avatarUrl ? (
                <img
                  src={account.avatarUrl}
                  alt=""
                  style={{
                    width: 28, height: 28, borderRadius: '50%',
                    objectFit: 'cover', flexShrink: 0,
                  }}
                  loading="lazy"
                />
              ) : (
                <div style={{
                  width: 28, height: 28, borderRadius: '50%',
                  backgroundColor: 'var(--bg-tertiary)',
                  display: 'flex', alignItems: 'center', justifyContent: 'center',
                  flexShrink: 0,
                }}>
                  <User size={12} style={{ color: 'var(--text-tertiary)' }} />
                </div>
              )}

              {/* 账号信息 */}
              <div style={{ flex: 1, minWidth: 0 }}>
                <div style={{
                  fontSize: 12, fontWeight: 500,
                  color: 'var(--text-primary)',
                  overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap',
                  display: 'flex', alignItems: 'center', gap: 4,
                }}>
                  {account.nickname || `用户${account.userId}`}
                  {isCurrent && (
                    <span style={{
                      fontSize: 9, color: '#C20C0C',
                      backgroundColor: 'rgba(194, 12, 12, 0.08)',
                      padding: '0 4px', borderRadius: 3,
                    }}>
                      当前
                    </span>
                  )}
                </div>
                <div style={{ fontSize: 10, color: 'var(--text-tertiary)' }}>
                  {formatSavedTime(account.savedAt)}
                </div>
              </div>

              {/* 操作按钮 */}
              <div style={{ display: 'flex', gap: 2, flexShrink: 0 }}>
                {!isCurrent && (
                  <motion.button
                    whileHover={{ scale: 1.1 }}
                    whileTap={{ scale: 0.9 }}
                    onClick={() => onSwitch(account.userId)}
                    title="切换到此账号"
                    style={{
                      display: 'flex', alignItems: 'center', justifyContent: 'center',
                      width: 24, height: 24, borderRadius: 4,
                      border: 'none', background: 'none',
                      cursor: 'pointer', color: 'var(--text-tertiary)',
                    }}
                  >
                    <RefreshCw size={11} />
                  </motion.button>
                )}
                <motion.button
                  whileHover={{ scale: 1.1 }}
                  whileTap={{ scale: 0.9 }}
                  onClick={() => onDelete(account.userId)}
                  title="删除此账号"
                  style={{
                    display: 'flex', alignItems: 'center', justifyContent: 'center',
                    width: 24, height: 24, borderRadius: 4,
                    border: 'none', background: 'none',
                    cursor: 'pointer', color: 'var(--text-tertiary)',
                  }}
                >
                  <Trash2 size={11} />
                </motion.button>
              </div>
            </div>
          );
        })
      )}

      {/* 分割线 */}
      {accounts.length > 0 && (
        <div style={{ height: 1, backgroundColor: 'var(--border-light)', margin: '4px 0' }} />
      )}

      {/* 添加新账号按钮 */}
      <motion.button
        whileHover={{ backgroundColor: 'var(--bg-hover)' }}
        onClick={onAddNew}
        style={{
          display: 'flex', alignItems: 'center', gap: 6,
          padding: '8px 12px', width: '100%', boxSizing: 'border-box',
          border: 'none', background: 'none',
          cursor: 'pointer', color: 'var(--text-secondary)',
          fontSize: 11,
        }}
      >
        <LogIn size={12} />
        添加新账号
      </motion.button>
    </div>
  );
};

// ============================================================
// 平台选择器组件
// ============================================================

type MusicSource = 'netease' | 'qq';

interface SourceConfig {
  id: MusicSource;
  name: string;
  color: string;
  icon: string;
}

const SOURCE_CONFIG: SourceConfig[] = [
  { id: 'netease', name: '网易云', color: '#C20C0C', icon: '🎵' },
  { id: 'qq', name: 'QQ音乐', color: '#31C27C', icon: '🎶' },
];

/** 平台选择器组件 */
const SourceSelector: React.FC<{
  selectedSources: MusicSource[];
  onChange: (sources: MusicSource[]) => void;
  isAggregate: boolean;
  onAggregateChange: (aggregate: boolean) => void;
}> = ({ selectedSources, onChange, isAggregate, onAggregateChange }) => {
  const toggleSource = (sourceId: MusicSource) => {
    if (selectedSources.includes(sourceId)) {
      // 至少保留一个平台
      if (selectedSources.length > 1) {
        onChange(selectedSources.filter(s => s !== sourceId));
      }
    } else {
      onChange([...selectedSources, sourceId]);
    }
  };

  return (
    <div style={{ display: 'flex', alignItems: 'center', gap: 8, padding: '8px 12px' }}>
      {/* 聚合搜索开关 */}
      <button
        onClick={() => onAggregateChange(!isAggregate)}
        style={{
          display: 'flex',
          alignItems: 'center',
          gap: 4,
          padding: '4px 10px',
          borderRadius: 6,
          border: 'none',
          backgroundColor: isAggregate ? 'var(--primary-color)' : 'var(--bg-tertiary)',
          color: isAggregate ? 'white' : 'var(--text-secondary)',
          cursor: 'pointer',
          fontSize: 12,
          fontWeight: 500,
          transition: 'all 0.2s ease',
        }}
        title={isAggregate ? '聚合搜索：同时搜索所有选中平台' : '单平台搜索'}
      >
        <Layers size={14} />
        {isAggregate ? '聚合' : '单平台'}
      </button>

      <div style={{ width: 1, height: 16, backgroundColor: 'var(--border-light)' }} />

      {/* 平台选择按钮 */}
      <div style={{ display: 'flex', gap: 6 }}>
        {SOURCE_CONFIG.map(source => {
          const isSelected = selectedSources.includes(source.id);
          return (
            <button
              key={source.id}
              onClick={() => toggleSource(source.id)}
              style={{
                display: 'flex',
                alignItems: 'center',
                gap: 3,
                padding: '3px 8px',
                borderRadius: 4,
                border: `1px solid ${isSelected ? source.color : 'var(--border-light)'}`,
                backgroundColor: isSelected ? `${source.color}15` : 'var(--bg-tertiary)',
                color: isSelected ? source.color : 'var(--text-tertiary)',
                cursor: 'pointer',
                fontSize: 11,
                fontWeight: isSelected ? 600 : 400,
                transition: 'all 0.15s ease',
                opacity: isSelected ? 1 : 0.6,
              }}
              title={source.name}
            >
              <span style={{ fontSize: 10 }}>{source.icon}</span>
              {source.name}
            </button>
          );
        })}
      </div>
    </div>
  );
};

// ============================================================
// 榜单走马灯组件（需求8）
// ============================================================

/** 榜单走马灯 - 自动轮播各榜单 */
const ChartCarousel: React.FC<{
  charts: ChartInfo[];
  chartSongsMap: Record<string, ChartSong[]>;
  onPlaySong: (song: ChartSong) => void;
  loading: boolean;
}> = ({ charts, chartSongsMap, onPlaySong, loading }) => {
  const [currentIndex, setCurrentIndex] = useState(0);
  const [isPaused, setIsPaused] = useState(false);
  const timerRef = useRef<NodeJS.Timeout | null>(null);
  const carouselRef = useRef<any>(null);

  // 自动轮播，间隔5秒
  useEffect(() => {
    if (isPaused || charts.length <= 1 || loading) return;

    timerRef.current = setInterval(() => {
      setCurrentIndex(prev => (prev + 1) % charts.length);
    }, 5000);

    return () => {
      if (timerRef.current) clearInterval(timerRef.current);
    };
  }, [isPaused, charts.length, loading]);

  /** 切换到上一个榜单 */
  const goToPrev = useCallback(() => {
    setCurrentIndex(prev => (prev - 1 + charts.length) % charts.length);
  }, [charts.length]);

  /** 切换到下一个榜单 */
  const goToNext = useCallback(() => {
    setCurrentIndex(prev => (prev + 1) % charts.length);
  }, [charts.length]);

  if (loading) {
    return (
      <div style={{
        display: 'flex', flexDirection: 'column', alignItems: 'center',
        justifyContent: 'center', padding: '40px 0', gap: 12,
      }}>
        <Loader2 size={20} style={{ color: 'var(--text-tertiary)', animation: 'spin 1s linear infinite' }} />
        <span style={{ fontSize: 12, color: 'var(--text-tertiary)' }}>加载榜单中...</span>
      </div>
    );
  }

  if (charts.length === 0) {
    return (
      <div style={{
        display: 'flex', flexDirection: 'column', alignItems: 'center',
        justifyContent: 'center', padding: '40px 0', gap: 8,
      }}>
        <TrendingUp size={20} style={{ color: 'var(--text-tertiary)', opacity: 0.4 }} />
        <span style={{ fontSize: 11, color: 'var(--text-tertiary)' }}>暂无榜单数据</span>
      </div>
    );
  }

  const currentChart = charts[currentIndex];
  const currentSongs = chartSongsMap[currentChart.id] || [];

  return (
    <div
      style={{ display: 'flex', flexDirection: 'column', gap: 10 }}
      onMouseEnter={() => setIsPaused(true)}
      onMouseLeave={() => setIsPaused(false)}
    >
      {/* 榜单标题栏 */}
      <div style={{
        display: 'flex', alignItems: 'center', justifyContent: 'space-between',
        padding: '0 2px',
      }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
          {/* 榜单封面 */}
          {currentChart.coverUrl && (
            <img
              src={currentChart.coverUrl}
              alt=""
              style={{
                width: 28, height: 28, borderRadius: 6,
                objectFit: 'cover', flexShrink: 0,
              }}
              loading="lazy"
            />
          )}
          <div>
            <div style={{
              fontSize: 13, fontWeight: 600, color: 'var(--text-primary)',
              display: 'flex', alignItems: 'center', gap: 4,
            }}>
              {currentChart.name}
              {currentChart.updateFrequency && (
                <span style={{
                  fontSize: 9, color: 'var(--text-tertiary)',
                  fontWeight: 400,
                }}>
                  {currentChart.updateFrequency}
                </span>
              )}
            </div>
            {currentChart.playCount > 0 && (
              <span style={{ fontSize: 10, color: 'var(--text-tertiary)' }}>
                {formatPlayCount(currentChart.playCount)} 次播放
              </span>
            )}
          </div>
        </div>

        {/* 左右切换按钮 */}
        <div style={{ display: 'flex', alignItems: 'center', gap: 4 }}>
          <motion.button
            whileHover={{ scale: 1.1 }}
            whileTap={{ scale: 0.9 }}
            onClick={goToPrev}
            style={{
              display: 'flex', alignItems: 'center', justifyContent: 'center',
              width: 24, height: 24, borderRadius: 6,
              border: '1px solid var(--border-light)',
              backgroundColor: 'var(--bg-tertiary)',
              color: 'var(--text-secondary)',
              cursor: 'pointer',
            }}
          >
            <ChevronLeft size={12} />
          </motion.button>
          <motion.button
            whileHover={{ scale: 1.1 }}
            whileTap={{ scale: 0.9 }}
            onClick={goToNext}
            style={{
              display: 'flex', alignItems: 'center', justifyContent: 'center',
              width: 24, height: 24, borderRadius: 6,
              border: '1px solid var(--border-light)',
              backgroundColor: 'var(--bg-tertiary)',
              color: 'var(--text-secondary)',
              cursor: 'pointer',
            }}
          >
            <ChevronRight size={12} />
          </motion.button>
        </div>
      </div>

      {/* 榜单歌曲列表 */}
      <AnimatePresence mode="wait">
        <motion.div
          key={currentChart.id}
          initial={{ opacity: 0, x: 20 }}
          animate={{ opacity: 1, x: 0 }}
          exit={{ opacity: 0, x: -20 }}
          transition={{ duration: 0.25 }}
          style={{
            display: 'flex',
            flexDirection: 'column',
            gap: 1,
            borderRadius: 8,
            overflow: 'hidden',
            border: '1px solid var(--border-light)',
            backgroundColor: 'var(--bg-secondary)',
          }}
        >
          {currentSongs.length === 0 ? (
            <div style={{
              padding: '20px 0', textAlign: 'center',
              fontSize: 11, color: 'var(--text-tertiary)',
            }}>
              暂无歌曲数据
            </div>
          ) : (
            currentSongs.map((song, index) => (
              <motion.div
                key={song.id}
                whileHover={{ backgroundColor: 'var(--bg-hover)' }}
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  gap: 8,
                  padding: '6px 10px',
                  cursor: 'pointer',
                  transition: 'background-color 0.15s ease',
                }}
                onClick={() => onPlaySong(song)}
              >
                {/* 序号 */}
                <span style={{
                  width: 18, textAlign: 'center',
                  fontSize: 11, fontWeight: 600,
                  color: index < 3 ? '#C20C0C' : 'var(--text-tertiary)',
                  flexShrink: 0,
                }}>
                  {index + 1}
                </span>

                {/* 歌曲信息 */}
                <div style={{ flex: 1, minWidth: 0 }}>
                  <div style={{
                    fontSize: 12, fontWeight: 500, color: 'var(--text-primary)',
                    overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap',
                    display: 'flex', alignItems: 'center', gap: 4,
                  }}>
                    {song.name}
                    {song.pay > 0 && (
                      <Crown size={10} style={{ color: '#f59e0b', flexShrink: 0 }} title="VIP 歌曲" />
                    )}
                  </div>
                  <div style={{
                    fontSize: 10, color: 'var(--text-tertiary)',
                    overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap',
                    marginTop: 1,
                  }}>
                    {song.singer}
                  </div>
                </div>

                {/* 播放按钮 */}
                <motion.button
                  whileHover={{ scale: 1.2 }}
                  whileTap={{ scale: 0.9 }}
                  onClick={(e) => { e.stopPropagation(); onPlaySong(song); }}
                  style={{
                    display: 'flex', alignItems: 'center', justifyContent: 'center',
                    border: 'none', background: 'none',
                    cursor: 'pointer', color: 'var(--text-tertiary)',
                    padding: 2, flexShrink: 0, opacity: 0.5,
                  }}
                >
                  <Play size={12} />
                </motion.button>
              </motion.div>
            ))
          )}
        </motion.div>
      </AnimatePresence>

      {/* 榜单切换标签（替代小圆点指示器） */}
      {charts.length > 1 && (
        <div style={{
          display: 'flex',
          gap: 8,
          justifyContent: 'center',
          flexWrap: 'wrap',
          marginBottom: 4,
        }}>
          {charts.map((chart, idx) => (
            <motion.button
              key={chart.id}
              whileHover={{ scale: 1.05 }}
              onClick={() => {
                setCurrentIndex(idx);
                if (carouselRef.current) {
                  carouselRef.current.goTo(idx);
                }
              }}
              style={{
                padding: '4px 12px',
                borderRadius: 16,
                border: currentIndex === idx ? 'none' : '1px solid var(--border-light)',
                background: currentIndex === idx
                  ? 'linear-gradient(135deg, #C20C0C 0%, #9B1B1B 100%)'
                  : 'var(--bg-tertiary)',
                color: currentIndex === idx ? 'white' : 'var(--text-secondary)',
                cursor: 'pointer',
                fontSize: 11,
                fontWeight: currentIndex === idx ? 600 : 400,
                boxShadow: currentIndex === idx ? '0 2px 8px rgba(194, 12, 12, 0.4)' : 'none',
                transition: 'all 0.2s ease',
              }}
            >
              {chart.name}
            </motion.button>
          ))}
        </div>
      )}
    </div>
  );
};

// ============================================================
// 主组件
// ============================================================

const OnlineSearchPanel: React.FC = () => {
  const addTracks = useMusicStore((s) => s.addTracks);
  const addToQueue = useMusicStore((s) => s.addToQueue);
  const loadTrack = useMusicStore((s) => s.loadTrack);
  const tracks = useMusicStore((s) => s.tracks);

  // Cookie 状态
  const [cookie, setCookie] = useState('');
  const [hasCookie] = useState(true);
  const [showCookieModal, setShowCookieModal] = useState(false);

  // 账号管理状态（需求9）
  const [userInfo, setUserInfo] = useState<LoginUserInfo | null>(null);
  const [savedAccounts, setSavedAccounts] = useState<SavedAccount[]>([]);
  const [showAccountMenu, setShowAccountMenu] = useState(false);
  const [loginExpired, setLoginExpired] = useState(false);
  const [checkingLogin, setCheckingLogin] = useState(false);

  // 下载状态（需求10）
  const [downloadingIds, setDownloadingIds] = useState<Set<string>>(new Set());
  const [downloadedIds, setDownloadedIds] = useState<Set<string>>(new Set());
  const [downloadErrorIds, setDownloadErrorIds] = useState<Record<string, string>>({});

  // 视图模式：首页 或 搜索结果
  const [viewMode, setViewMode] = useState<ViewMode>('home');

  // 搜索状态
  const [searchKeyword, setSearchKeyword] = useState('');
  const [results, setResults] = useState<QQSong[]>([]);
  const [total, setTotal] = useState(0);
  const [page, setPage] = useState(1);
  const [searching, setSearching] = useState(false);
  const [searched, setSearched] = useState(false);

  // 播放状态
  const [playingId, setPlayingId] = useState<string | null>(null);
  const [gettingUrlId, setGettingUrlId] = useState<string | null>(null);

  // 错误信息
  const [error, setError] = useState<string | null>(null);
  // VIP 播放失败标记
  const [vipPlayFailed, setVipPlayFailed] = useState(false);

  // 榜单数据（需求8）
  const [charts, setCharts] = useState<ChartInfo[]>([]);
  const [chartSongsMap, setChartSongsMap] = useState<Record<string, ChartSong[]>>({});
  const [chartsLoading, setChartsLoading] = useState(false);

  // 曲目信息侧边栏状态（在线歌曲）
  const [showTrackInfoSidebar, setShowTrackInfoSidebar] = useState(false);
  const [trackInfoSongId, setTrackInfoSongId] = useState<string | null>(null);

  // 多源搜索状态
  const [selectedSources, setSelectedSources] = useState<MusicSource[]>(['netease', 'qq']);
  const [isAggregateMode, setIsAggregateMode] = useState(true);
  const [searchResultsBySource, setSearchResultsBySource] = useState<Record<string, number>>({});

  // QQ 音乐登录状态
  const [qqCookie, setQQCookie] = useState('');
  const [qqLoggedIn, setQQLoggedIn] = useState(false);
  const [qqUserInfo, setQQUserInfo] = useState<{ userId: string; nickname: string; avatarUrl: string; vipType: number } | null>(null);

  // 搜索输入框引用
  const searchInputRef = useRef<HTMLInputElement>(null);

  // 组件挂载时加载 cookie 和检查登录状态
  useEffect(() => {
    api.musicOnline.getCookie().then(res => {
      if (res.success && res.data?.cookie) {
        setCookie(res.data.cookie);
        checkLoginAndLoadUser(res.data.cookie);
      }
    });
    loadSavedAccounts();
    api.musicUnified.getQQCookie().then(res => {
      console.log('[OnlineSearchPanel] 初始化读取QQ cookie:', res);
      if (res.success && res.data?.cookie) {
        setQQCookie(res.data.cookie);
        setQQLoggedIn(true);
        api.musicUnified.setQQCookie(res.data.cookie);
        api.musicUnified.getQQUserInfo().then(userRes => {
          console.log('[OnlineSearchPanel] 初始化获取QQ用户信息:', userRes);
          if (userRes.success && userRes.data) {
            setQQUserInfo(userRes.data);
          }
        });
      }
    });
  }, []);

  /** 检查登录状态并加载用户信息 */
  const checkLoginAndLoadUser = useCallback(async (cookieStr?: string) => {
    const cookieToCheck = cookieStr || cookie;
    if (!cookieToCheck) return;

    setCheckingLogin(true);
    try {
      // 检查登录状态
      const loginRes = await api.musicOnline.checkNeteaseLogin();
      if (loginRes.success && loginRes.data?.loggedIn) {
        setLoginExpired(false);
        // 获取用户信息
        const userRes = await api.musicOnline.getNeteaseUser();
        if (userRes.success && userRes.data) {
          setUserInfo(userRes.data);
        }
      } else {
        // Cookie 已失效
        setLoginExpired(true);
        setUserInfo(null);
      }
    } catch {
      // 静默降级，不阻塞其他功能
      console.warn('[OnlineSearchPanel] 检查登录状态失败');
    } finally {
      setCheckingLogin(false);
    }
  }, [cookie]);

  /** 加载已保存的账号列表 */
  const loadSavedAccounts = useCallback(async () => {
    try {
      const res = await api.musicOnline.getSavedAccounts('netease');
      if (res.success && res.data?.accounts) {
        setSavedAccounts(res.data.accounts);
      }
    } catch {
      // 静默处理
    }
  }, []);

  // 首页视图：组件挂载时自动加载榜单数据
  useEffect(() => {
    if (viewMode !== 'home') return;

    loadCharts();
  }, [viewMode]);

  /** 主要榜单名称列表（只显示这10个） */
  const MAIN_CHART_NAMES = [
    '热歌榜',
    '新歌榜',
    '飙升榜',
    '原创榜',
    '说唱榜',
    '古典榜',
    '电音榜',
    'ACG榜',
    '欧美榜',
    '韩国榜',
  ];

  /** 加载榜单列表和各榜单歌曲 */
  const loadCharts = useCallback(async () => {
    setChartsLoading(true);
    try {
      // 获取榜单列表
      const chartsRes = await api.musicOnline.getCharts();
      if (!chartsRes.success || !chartsRes.data?.charts) {
        setChartsLoading(false);
        return;
      }

      // 只筛选主要榜单（10个）
      const chartList = chartsRes.data.charts.filter((chart: ChartInfo) =>
        MAIN_CHART_NAMES.some(name => chart.name.includes(name))
      );
      setCharts(chartList);

      // 并行加载各榜单的前5首歌曲
      const songsMap: Record<string, ChartSong[]> = {};
      const promises = chartList.map(async (chart: ChartInfo) => {
        try {
          const songsRes = await api.musicOnline.getChartSongs({ chartId: chart.id, limit: 5 });
          if (songsRes.success && songsRes.data?.songs) {
            songsMap[chart.id] = songsRes.data.songs;
          }
        } catch {
          // 单个榜单加载失败不影响其他
        }
      });

      await Promise.all(promises);
      setChartSongsMap(songsMap);
    } catch {
      // 榜单加载失败，静默处理
    } finally {
      setChartsLoading(false);
    }
  }, []);

  /** 处理搜索 */
  const handleSearch = useCallback(async (newKeyword?: string, pageNum?: number) => {
    const kw = newKeyword !== undefined ? newKeyword : searchKeyword;
    const pg = pageNum !== undefined ? pageNum : 1;

    if (!kw || !kw.trim()) return;

    setSearching(true);
    setError(null);
    setVipPlayFailed(false);
    setViewMode('search');

    try {
      if (isAggregateMode) {
        const res = await api.musicUnified.searchAll({ keyword: kw.trim(), page: pg, limit: 30 });
        if (res.success && res.data) {
          setResults(res.data);
          setTotal(res.data.length);
          setSearchResultsBySource({ qq: res.data.filter(s => s.source === 'qq').length, netease: res.data.filter(s => s.source === 'netease').length });
          setPage(1);
          setSearched(true);
        } else {
          setResults([]);
          setTotal(0);
          setError(`搜索失败: ${res.error || '请检查网络连接'}`);
        }
      } else {
        const source = selectedSources[0] || 'qq';
        let res;
        if (source === 'qq') {
          res = await api.musicUnified.searchQQ({ keyword: kw.trim(), page: pg, limit: 30 });
        } else {
          res = await api.musicUnified.searchNetease({ keyword: kw.trim(), page: pg, limit: 30 });
        }
        if (res.success && res.data) {
          setResults(res.data);
          setTotal(res.data.length);
          setSearchResultsBySource({ [source]: res.data.length });
          setPage(1);
          setSearched(true);
        } else {
          setResults([]);
          setTotal(0);
          setError(`搜索失败: ${res.error || '请检查网络连接'}`);
        }
      }
    } catch (err) {
      console.error('[OnlineSearchPanel] 搜索失败:', err);
      setError(`搜索失败: ${err?.message || '未知错误'}`);
    } finally {
      setSearching(false);
    }
  }, [searchKeyword, isAggregateMode, selectedSources, cookie]);

  /** 处理播放（通用，支持多源歌曲） */
  const handlePlay = useCallback(async (song: any) => {
    if (playingId === song.id) return;

    setGettingUrlId(song.id);
    setError(null);
    setVipPlayFailed(false);

    try {
      let url: string | null = null;

      // 判断是否为多源歌曲
      if (song.source === 'qq' && song.originalId) {
        const res = await api.musicUnified.getQQUrl({ songmid: song.originalId, quality: '320' });
        if (res.success && res.url) {
          url = res.url;
        }
      } else if (song.source === 'netease' && song.originalId) {
        const res = await api.musicUnified.getNeteaseUrl({ songId: String(song.originalId), cookie });
        if (res.success && res.url) {
          url = res.url;
        }
      }
      if (!url && song.source === 'qq' && song.originalId) {
        const res = await api.musicOnline.getUrl({ songmid: song.originalId });
        if (res.success) {
          url = res.data?.url;
        }
      }
      if (!url && song.source === 'netease' && song.originalId) {
        const res = await api.musicOnline.getUrl({ songmid: song.originalId });
        if (res.success) {
          url = res.data?.url;
        }
      }

      if (url) {
        const trackId = song.id;
        const coverUrl = getCoverUrl(song);

        const newTrack: MusicTrack = {
          id: trackId,
          title: song.name,
          artist: song.singer,
          album: song.album,
          src: url,
          duration: song.duration,
          coverUrl: coverUrl || undefined,
          source: 'online' as const,
          addedAt: Date.now(),
        };

        const store = useMusicStore.getState();
        const existingIndex = store.tracks.findIndex(t => t.id === trackId);

        if (existingIndex >= 0) {
          loadTrack(existingIndex, true);
        } else {
          addTracks([newTrack]);
          setTimeout(() => {
            const updatedTracks = useMusicStore.getState().tracks;
            const idx = updatedTracks.findIndex(t => t.id === trackId);
            if (idx >= 0) {
              loadTrack(idx, true);
            }
          }, 50);
        }

        setPlayingId(song.id);
      } else {
        // 播放链接获取失败
        if (song.pay > 0) {
          setVipPlayFailed(true);
          setError('该歌曲需要 VIP，请先登录对应平台账号');
        } else {
          setError('无法获取播放链接，该歌曲可能已下架或需要登录');
        }
      }
    } catch (err) {
      console.error('[OnlineSearchPanel] 播放失败:', err);
      setError('获取播放链接失败');
    } finally {
      setGettingUrlId(null);
    }
  }, [playingId, addTracks, loadTrack, cookie]);

  /** 处理加载更多 */
  const handleLoadMore = useCallback(() => {
    handleSearch(undefined, page + 1);
  }, [handleSearch, page]);

  /** 处理键盘回车 */
  const handleKeyPress = useCallback((e: React.KeyboardEvent) => {
    if (e.key === 'Enter') {
      handleSearch(searchKeyword, 1);
    }
  }, [searchKeyword, handleSearch]);

  /** 处理清空搜索，回到首页 */
  const handleClearSearch = useCallback(() => {
    setSearchKeyword('');
    setResults([]);
    setSearched(false);
    setTotal(0);
    setError(null);
    setVipPlayFailed(false);
    setViewMode('home');
    searchInputRef.current?.focus();
  }, []);

  /** 处理网易云登录成功 */
  const handleCookieSaved = useCallback(async (newCookie: string) => {
    setCookie(newCookie);
    // 同步 cookie 到主进程
    await api.musicOnline.setCookie(newCookie);
    // 登录成功后清除 VIP 失败标记
    setVipPlayFailed(false);
    setError(null);
    setLoginExpired(false);

    // 获取用户信息并保存账号
    try {
      const userRes = await api.musicOnline.getNeteaseUser();
      if (userRes.success && userRes.data) {
        setUserInfo(userRes.data);
        // 自动保存账号信息
        await api.musicOnline.saveAccount({
          platform: 'netease',
          accountInfo: {
            userId: userRes.data.userId,
            nickname: userRes.data.nickname,
            avatarUrl: userRes.data.avatarUrl,
            cookie: newCookie,
          },
        });
        // 刷新已保存账号列表
        loadSavedAccounts();
      }
    } catch {
      // 获取用户信息失败，静默处理
    }
  }, [loadSavedAccounts]);

  /** 处理打开网易云登录窗口（从 VIP 提示中） */
  const handleOpenNeteaseLogin = useCallback(async () => {
    try {
      const res = await api.musicOnline.loginNetease();
      if (res.success && res.data?.cookie) {
        handleCookieSaved(res.data.cookie);
      }
    } catch {
      // 登录失败，静默处理
    }
  }, [handleCookieSaved]);

  /** 处理 QQ 音乐登录成功 */
  const handleQQCookieSaved = useCallback(async (newCookie: string) => {
    console.log('[OnlineSearchPanel] QQ登录成功，cookie:', newCookie ? '有' : '无');
    await api.musicOnline.setCookie(newCookie);
    await api.musicUnified.setQQCookie(newCookie);
    setQQCookie(newCookie);
    setQQLoggedIn(true);
    try {
      console.log('[OnlineSearchPanel] 正在获取QQ用户信息...');
      const userRes = await api.musicUnified.getQQUserInfo();
      console.log('[OnlineSearchPanel] QQ用户信息获取结果:', userRes);
      if (userRes.success && userRes.data) {
        setQQUserInfo(userRes.data);
        console.log('[OnlineSearchPanel] QQ用户信息已设置:', userRes.data);
      } else {
        console.warn('[OnlineSearchPanel] QQ用户信息获取失败:', userRes.error);
      }
    } catch (e) {
      console.error('[OnlineSearchPanel] 获取QQ用户信息出错:', e);
    }
    console.log('[OnlineSearchPanel] QQ 音乐登录成功，cookie 已同步到统一音乐服务');
  }, []);

  /** 处理下载歌曲（需求10，支持多源歌曲） */
  const handleDownloadSong = useCallback(async (song: any) => {
    if (downloadingIds.has(song.id)) return;

    // 设置下载中状态
    setDownloadingIds(prev => new Set(prev).add(song.id));
    setDownloadErrorIds(prev => {
      const next = { ...prev };
      delete next[song.id];
      return next;
    });

    try {
      let downloadUrl: string | null = null;

      if (song.originalData) {
        // 多源歌曲：先获取播放链接
        const res = await api.music.getMultiSourceUrl(song.originalData, cookie);
        if (res.success && res.data) {
          downloadUrl = res.data;
        }
      } else {
        // 原有网易云歌曲：获取播放链接
        const res = await api.musicOnline.getUrl({ songmid: song.id });
        if (res.success && res.data?.url) {
          downloadUrl = res.data.url;
        }
      }

      if (!downloadUrl) {
        setDownloadErrorIds(prev => ({
          ...prev,
          [song.id]: '无法获取下载链接',
        }));
        return;
      }

      const songInfo = {
        id: song.originalId || song.id,
        name: song.name,
        singer: song.singer,
        coverUrl: getCoverUrl(song),
        duration: song.duration,
      };

      const res = await api.musicOnline.downloadSong(songInfo);

      if (res.success) {
        // 下载成功
        setDownloadedIds(prev => new Set(prev).add(song.id));
        // 3秒后清除"已下载"标记
        setTimeout(() => {
          setDownloadedIds(prev => {
            const next = new Set(prev);
            next.delete(song.id);
            return next;
          });
        }, 3000);
        // 刷新本地音乐列表
        try {
          const tracksRes = await api.music.getAllTracks();
          if (tracksRes) {
            const store = useMusicStore.getState();
            const existingIds = new Set(store.tracks.map(t => t.id));
            const newTracks = tracksRes.filter((t: any) => !existingIds.has(t.id));
            if (newTracks.length > 0 && store.addTracks) {
              store.addTracks(newTracks);
            }
          }
        } catch {
          // 刷新失败，不影响下载结果
        }
      } else if (res.cancelled) {
        // 用户取消了目录选择，不做处理
      } else {
        // 下载失败
        setDownloadErrorIds(prev => ({
          ...prev,
          [song.id]: res.error || '下载失败',
        }));
      }
    } catch {
      setDownloadErrorIds(prev => ({
        ...prev,
        [song.id]: '下载过程出错',
      }));
    } finally {
      // 清除下载中状态
      setDownloadingIds(prev => {
        const next = new Set(prev);
        next.delete(song.id);
        return next;
      });
    }
  }, [downloadingIds, cookie]);

  /** 处理切换账号 */
  const handleSwitchAccount = useCallback(async (userId: number) => {
    try {
      const res = await api.musicOnline.switchAccount({ platform: 'netease', userId });
      if (res.success && res.data) {
        // 更新当前用户信息
        setUserInfo({
          userId: res.data.userId,
          nickname: res.data.nickname,
          avatarUrl: res.data.avatarUrl,
          vipType: 0,
        });
        setCookie(res.data.cookie);
        setLoginExpired(false);
        setShowAccountMenu(false);
      }
    } catch {
      // 切换失败，静默处理
    }
  }, []);

  /** 处理删除账号 */
  const handleDeleteAccount = useCallback(async (userId: number) => {
    try {
      await api.musicOnline.deleteAccount({ platform: 'netease', userId });
      // 刷新账号列表
      loadSavedAccounts();
      // 如果删除的是当前账号，清除用户信息
      if (userInfo && String(userInfo.userId) === String(userId)) {
        setUserInfo(null);
        setCookie('');
      }
    } catch {
      // 删除失败，静默处理
    }
  }, [userInfo, loadSavedAccounts]);

  /** 处理登出当前账号 */
  const handleLogout = useCallback(async () => {
    try {
      await api.musicOnline.logoutNetease();
      setUserInfo(null);
      setCookie('');
      setLoginExpired(false);
      setShowAccountMenu(false);
    } catch {
      // 登出失败，静默处理
    }
  }, []);

  // ============================================================
  // 渲染
  // ============================================================

  // Cookie 状态栏已移除，直接渲染主内容

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
      {/* 搜索栏 */}
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
            ref={searchInputRef}
            type="text"
            placeholder="搜索你喜欢的音乐..."
            value={searchKeyword}
            onChange={(e) => setSearchKeyword(e.target.value)}
            onKeyDown={handleKeyPress}
            onFocus={() => {
              // 如果在首页且输入框聚焦，不切换视图
            }}
            style={{
              flex: 1,
              border: 'none',
              background: 'none',
              outline: 'none',
              fontSize: 11,
              color: 'var(--text-primary)',
              minWidth: 0,
            }}
          />
          {searchKeyword && (
            <motion.button
              initial={{ opacity: 0, scale: 0.8 }}
              animate={{ opacity: 1, scale: 1 }}
              onClick={handleClearSearch}
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

        {/* 搜索按钮 */}
        <motion.button
          whileHover={{ scale: 1.05 }}
          whileTap={{ scale: 0.95 }}
          onClick={() => handleSearch(searchKeyword, 1)}
          disabled={searching || !searchKeyword.trim()}
          style={{
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            gap: 4,
            padding: '5px 12px',
            borderRadius: 6,
            backgroundColor: 'var(--primary-color)',
            color: 'white',
            border: 'none',
            cursor: searching || !searchKeyword.trim() ? 'wait' : 'pointer',
            fontSize: 11,
            fontWeight: 500,
            flexShrink: 0,
            opacity: searching || !searchKeyword.trim() ? 0.7 : 1,
          }}
        >
          {searching ? (
            <motion.div animate={{ rotate: 360 }} transition={{ duration: 1, repeat: Infinity, ease: 'linear' }}>
              <Loader2 size={11} />
            </motion.div>
          ) : (
            <Search size={11} />
          )}
          搜索
        </motion.button>
      </div>

      {/* 平台选择器 */}
      <SourceSelector
        selectedSources={selectedSources}
        onChange={setSelectedSources}
        isAggregate={isAggregateMode}
        onAggregateChange={setIsAggregateMode}
      />

      {/* 错误信息 */}
      <AnimatePresence>
        {error && (
          <motion.div
            initial={{ opacity: 0, height: 0 }}
            animate={{ opacity: 1, height: 'auto' }}
            exit={{ opacity: 0, height: 0 }}
            style={{
              display: 'flex',
              alignItems: 'center',
              gap: 6,
              padding: '6px 10px',
              borderRadius: 6,
              backgroundColor: vipPlayFailed ? 'rgba(245, 158, 11, 0.06)' : 'rgba(239, 68, 68, 0.06)',
              border: vipPlayFailed ? '1px solid rgba(245, 158, 11, 0.1)' : '1px solid rgba(239, 68, 68, 0.1)',
              fontSize: 10,
              color: vipPlayFailed ? '#f59e0b' : '#ef4444',
            }}
          >
            <AlertCircle size={11} style={{ flexShrink: 0 }} />
            <span style={{ flex: 1 }}>{error}</span>
            <button
              onClick={() => { setError(null); setVipPlayFailed(false); }}
              style={{
                border: 'none',
                background: 'none',
                cursor: 'pointer',
                color: vipPlayFailed ? '#f59e0b' : '#ef4444',
                padding: 0,
                fontSize: 12,
                flexShrink: 0,
              }}
            >
              &times;
            </button>
          </motion.div>
        )}
      </AnimatePresence>

      {/* ============================================================ */}
      {/* 首页视图 - 榜单走马灯（需求8） */}
      {/* ============================================================ */}
      {viewMode === 'home' && (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
          {/* 标题 */}
          <div style={{
            display: 'flex', alignItems: 'center', gap: 6, padding: '4px 2px',
          }}>
            <Flame size={14} style={{ color: '#C20C0C' }} />
            <span style={{ fontSize: 13, fontWeight: 600, color: 'var(--text-primary)' }}>
              音乐榜单
            </span>
            <span style={{ fontSize: 10, color: 'var(--text-tertiary)' }}>
              热门推荐
            </span>
          </div>

          {/* 走马灯 */}
          <ChartCarousel
            charts={charts}
            chartSongsMap={chartSongsMap}
            onPlaySong={handlePlay}
            loading={chartsLoading}
          />

          {/* 账号登录区域 */}
          <div style={{
            borderRadius: 10,
            border: '1px solid var(--border-light)',
            backgroundColor: 'var(--bg-secondary)',
            overflow: 'hidden',
          }}>
            <div style={{
              display: 'flex', alignItems: 'center', gap: 6,
              padding: '8px 12px',
              borderBottom: '1px solid var(--border-light)',
              backgroundColor: 'var(--bg-tertiary)',
            }}>
              <User size={12} style={{ color: 'var(--text-tertiary)' }} />
              <span style={{ fontSize: 12, fontWeight: 600, color: 'var(--text-primary)' }}>
                账号登录
              </span>
              <span style={{ fontSize: 10, color: 'var(--text-tertiary)' }}>
                登录后畅享 VIP 曲库
              </span>
            </div>

            <div style={{ display: 'flex', gap: 0 }}>
              {/* 网易云音乐登录 */}
              <div style={{
                flex: 1,
                padding: '12px',
                display: 'flex',
                flexDirection: 'column',
                alignItems: 'center',
                gap: 8,
                borderRight: '1px solid var(--border-light)',
              }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                  <div style={{
                    width: 24, height: 24, borderRadius: 6,
                    background: 'linear-gradient(135deg, #C20C0C 0%, #9B1B1B 100%)',
                    display: 'flex', alignItems: 'center', justifyContent: 'center',
                  }}>
                    <Disc3 size={12} color="white" />
                  </div>
                  <span style={{ fontSize: 12, fontWeight: 600, color: 'var(--text-primary)' }}>
                    网易云音乐
                  </span>
                </div>

                {userInfo ? (
                  <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 6, width: '100%' }}>
                    <div style={{
                      display: 'flex', alignItems: 'center', gap: 8,
                      padding: '8px 12px',
                      borderRadius: 10,
                      backgroundColor: 'rgba(34, 197, 94, 0.06)',
                      border: '1px solid rgba(34, 197, 94, 0.12)',
                      width: '100%',
                      boxSizing: 'border-box',
                    }}>
                      {userInfo.avatarUrl ? (
                        <img
                          src={userInfo.avatarUrl}
                          alt=""
                          style={{
                            width: 32, height: 32, borderRadius: '50%',
                            objectFit: 'cover', flexShrink: 0,
                            border: '2px solid rgba(34, 197, 94, 0.3)',
                          }}
                          loading="lazy"
                        />
                      ) : (
                        <div style={{
                          width: 32, height: 32, borderRadius: '50%',
                          background: 'linear-gradient(135deg, #C20C0C 0%, #9B1B1B 100%)',
                          display: 'flex', alignItems: 'center', justifyContent: 'center',
                          flexShrink: 0,
                        }}>
                          <User size={14} color="white" />
                        </div>
                      )}
                      <div style={{ flex: 1, minWidth: 0 }}>
                        <div style={{
                          fontSize: 12, fontWeight: 600, color: 'var(--text-primary)',
                          overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap',
                        }}>
                          {userInfo.nickname || '未知用户'}
                        </div>
                        <div style={{
                          fontSize: 10, color: 'var(--text-tertiary)',
                          display: 'flex', alignItems: 'center', gap: 3, marginTop: 1,
                        }}>
                          <span>ID: {userInfo.userId}</span>
                          {userInfo.vipType > 0 && (
                            <span style={{
                              fontSize: 9, color: '#f59e0b',
                              backgroundColor: 'rgba(245, 158, 11, 0.1)',
                              padding: '0 3px', borderRadius: 2,
                            }}>
                              VIP
                            </span>
                          )}
                        </div>
                      </div>
                      <button
                        onClick={handleLogout}
                        style={{
                          border: 'none', background: 'none', cursor: 'pointer',
                          color: 'var(--text-tertiary)', padding: 2,
                          display: 'flex', alignItems: 'center',
                          flexShrink: 0,
                        }}
                        title="退出登录"
                      >
                        <LogOut size={12} />
                      </button>
                    </div>
                  </div>
                ) : (
                  <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 6, width: '100%' }}>
                    {loginExpired && (
                      <span style={{ fontSize: 10, color: '#f59e0b' }}>登录已过期，请重新登录</span>
                    )}
                    <motion.button
                      whileHover={{ scale: 1.03 }}
                      whileTap={{ scale: 0.97 }}
                      onClick={handleOpenNeteaseLogin}
                      style={{
                        display: 'flex',
                        alignItems: 'center',
                        gap: 6,
                        padding: '8px 20px',
                        borderRadius: 8,
                        border: 'none',
                        background: 'linear-gradient(135deg, #C20C0C 0%, #9B1B1B 100%)',
                        color: 'white',
                        cursor: 'pointer',
                        fontSize: 12,
                        fontWeight: 600,
                        boxShadow: '0 2px 8px rgba(194, 12, 12, 0.3)',
                      }}
                    >
                      <LogIn size={14} />
                      网易云登录
                    </motion.button>
                    <button
                      onClick={() => setShowCookieModal(true)}
                      style={{
                        display: 'flex', alignItems: 'center', gap: 4,
                        padding: '4px 10px',
                        borderRadius: 4,
                        border: '1px solid var(--border-light)',
                        backgroundColor: 'var(--bg-tertiary)',
                        color: 'var(--text-tertiary)',
                        cursor: 'pointer',
                        fontSize: 10,
                      }}
                    >
                      <Cookie size={10} />
                      手动粘贴Cookie
                    </button>
                  </div>
                )}
              </div>

              {/* QQ 音乐登录 */}
              <div style={{
                flex: 1,
                padding: '12px',
                display: 'flex',
                flexDirection: 'column',
                alignItems: 'center',
                gap: 8,
              }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                  <div style={{
                    width: 24, height: 24, borderRadius: 6,
                    background: 'linear-gradient(135deg, #31C27C 0%, #1FAF6B 100%)',
                    display: 'flex', alignItems: 'center', justifyContent: 'center',
                  }}>
                    <Music size={12} color="white" />
                  </div>
                  <span style={{ fontSize: 12, fontWeight: 600, color: 'var(--text-primary)' }}>
                    QQ音乐
                  </span>
                </div>

                {qqLoggedIn ? (
                  <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 6, width: '100%' }}>
                    <div style={{
                      display: 'flex', alignItems: 'center', gap: 8,
                      padding: '8px 12px',
                      borderRadius: 10,
                      backgroundColor: 'rgba(34, 197, 94, 0.06)',
                      border: '1px solid rgba(34, 197, 94, 0.12)',
                      width: '100%',
                      boxSizing: 'border-box',
                    }}>
                      {qqUserInfo?.avatarUrl ? (
                        <img
                          src={qqUserInfo.avatarUrl}
                          alt=""
                          style={{
                            width: 32, height: 32, borderRadius: '50%',
                            objectFit: 'cover', flexShrink: 0,
                            border: '2px solid rgba(34, 197, 94, 0.3)',
                          }}
                          loading="lazy"
                        />
                      ) : (
                        <div style={{
                          width: 32, height: 32, borderRadius: '50%',
                          background: 'linear-gradient(135deg, #31C27C 0%, #1FAF6B 100%)',
                          display: 'flex', alignItems: 'center', justifyContent: 'center',
                          flexShrink: 0,
                        }}>
                          <User size={14} color="white" />
                        </div>
                      )}
                      <div style={{ flex: 1, minWidth: 0 }}>
                        <div style={{
                          fontSize: 12, fontWeight: 600, color: 'var(--text-primary)',
                          overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap',
                        }}>
                          {qqUserInfo?.nickname || 'QQ音乐用户'}
                        </div>
                        <div style={{
                          fontSize: 10, color: 'var(--text-tertiary)',
                          display: 'flex', alignItems: 'center', gap: 3, marginTop: 1,
                        }}>
                          <span>ID: {qqUserInfo?.userId || '已登录'}</span>
                          {qqUserInfo?.vipType > 0 && (
                            <span style={{
                              fontSize: 9, color: '#f59e0b',
                              backgroundColor: 'rgba(245, 158, 11, 0.1)',
                              padding: '0 3px', borderRadius: 2,
                            }}>
                              VIP
                            </span>
                          )}
                        </div>
                      </div>
                      <button
                        onClick={() => { setQQCookie(''); setQQLoggedIn(false); setQQUserInfo(null); }}
                        style={{
                          border: 'none', background: 'none', cursor: 'pointer',
                          color: 'var(--text-tertiary)', padding: 2,
                          display: 'flex', alignItems: 'center',
                          flexShrink: 0,
                        }}
                        title="退出登录"
                      >
                        <LogOut size={12} />
                      </button>
                    </div>
                  </div>
                ) : (
                  <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 6, width: '100%' }}>
                    <QQLoginButton onLoginSuccess={handleQQCookieSaved} />
                  </div>
                )}
              </div>
            </div>
          </div>

          {/* 多源搜索提示 */}
          <div style={{
            padding: '20px 0',
            textAlign: 'center',
          }}>
            <div style={{
              display: 'inline-flex',
              alignItems: 'center',
              gap: 8,
              padding: '10px 20px',
              borderRadius: 10,
              backgroundColor: 'var(--bg-tertiary)',
              border: '1px solid var(--border-light)',
            }}>
              <Sparkles size={16} style={{ color: 'var(--primary-color)' }} />
              <span style={{ fontSize: 13, color: 'var(--text-secondary)' }}>
                支持网易云、QQ音乐双平台搜索
              </span>
            </div>
          </div>
        </div>
      )}

      {/* ============================================================ */}
      {/* 搜索结果视图 */}
      {/* ============================================================ */}
      {viewMode === 'search' && (
        <>
          {/* 搜索结果数量 */}
          {searched && results.length > 0 && (
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '0 2px' }}>
              <span style={{ fontSize: 10, color: 'var(--text-tertiary)' }}>
                找到 {total} 首歌曲
                {total > 30 && ` (已加载 ${results.length})`}
              </span>
            </div>
          )}

          {/* 搜索结果统计 */}
          {Object.keys(searchResultsBySource).length > 0 && (
            <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
              {Object.entries(searchResultsBySource).map(([source, count]) => {
                const config = SOURCE_CONFIG.find(s => s.id === source);
                if (!config || count === 0) return null;
                return (
                  <span
                    key={source}
                    style={{
                      fontSize: 11,
                      padding: '2px 8px',
                      borderRadius: 4,
                      backgroundColor: config.color + '15',
                      color: config.color,
                      display: 'flex',
                      alignItems: 'center',
                      gap: 4,
                    }}
                  >
                    <span>{config.icon}</span>
                    {config.name}: {count}首
                  </span>
                );
              })}
            </div>
          )}

          {/* 搜索结果列表 */}
          <div
            style={{
              display: 'flex',
              flexDirection: 'column',
              gap: 1,
              maxHeight: 320,
              overflow: 'auto',
              overflowX: 'hidden',
            }}
          >
            {/* 无结果 */}
            {searched && results.length === 0 && !searching && (
              <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', padding: '32px 0', gap: 8 }}>
                <Music size={20} style={{ color: 'var(--text-tertiary)', opacity: 0.4 }} />
                <span style={{ fontSize: 11, color: 'var(--text-tertiary)' }}>未找到匹配的歌曲</span>
              </div>
            )}

            {/* 歌曲列表项 */}
            {results.map((song) => {
              const isPlayingThis = playingId === song.id;
              const isLoadingThis = gettingUrlId === song.id;
              const coverUrl = getCoverUrl(song);

              return (
                <motion.div
                  key={song.id}
                  whileHover={{ backgroundColor: 'var(--bg-hover)' }}
                  style={{
                    display: 'flex',
                    alignItems: 'center',
                    gap: 8,
                    padding: '7px 10px',
                    borderRadius: 8,
                    cursor: 'pointer',
                    backgroundColor: isPlayingThis ? 'var(--bg-tertiary)' : 'transparent',
                    border: isPlayingThis ? '1px solid var(--primary-color)' : '1px solid transparent',
                    transition: 'border-color 0.15s ease',
                  }}
                  onClick={() => handlePlay(song)}
                  onContextMenu={(e) => {
                    e.preventDefault();
                    e.stopPropagation();
                    setTrackInfoSongId(song.id);
                    setShowTrackInfoSidebar(true);
                  }}
                >
                  {/* 封面缩略图 */}
                  {coverUrl ? (
                    <img
                      src={coverUrl}
                      alt=""
                      style={{
                        width: 32,
                        height: 32,
                        borderRadius: 4,
                        objectFit: 'cover',
                        flexShrink: 0,
                      }}
                      loading="lazy"
                    />
                  ) : (
                    <div
                      style={{
                        width: 32,
                        height: 32,
                        borderRadius: 4,
                        backgroundColor: 'var(--bg-tertiary)',
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'center',
                        flexShrink: 0,
                      }}
                    >
                      <Music size={14} style={{ color: 'var(--text-tertiary)', opacity: 0.4 }} />
                    </div>
                  )}

                  {/* 歌曲信息 */}
                  <div style={{ flex: 1, minWidth: 0 }}>
                    <div
                      style={{
                        fontSize: 12,
                        fontWeight: isPlayingThis ? 600 : 500,
                        color: isPlayingThis ? 'var(--primary-color)' : 'var(--text-primary)',
                        overflow: 'hidden',
                        textOverflow: 'ellipsis',
                        whiteSpace: 'nowrap',
                        display: 'flex',
                        alignItems: 'center',
                        gap: 4,
                      }}
                    >
                      <span style={{ fontWeight: 500, color: 'var(--text-primary)' }}>
                        {song.name}
                      </span>
                      {song.source && (
                        <span
                          style={{
                            fontSize: 10,
                            padding: '1px 5px',
                            borderRadius: 3,
                            backgroundColor: SOURCE_CONFIG.find(s => s.id === song.source)?.color + '20' || '#66666620',
                            color: SOURCE_CONFIG.find(s => s.id === song.source)?.color || '#666',
                            fontWeight: 500,
                          }}
                        >
                          {SOURCE_CONFIG.find(s => s.id === song.source)?.name || song.source}
                        </span>
                      )}
                      {song.pay > 0 && (
                        <Crown size={10} style={{ color: '#f59e0b', flexShrink: 0 }} title="VIP 歌曲" />
                      )}
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
                      {song.singer}
                      {song.album ? ` - ${song.album}` : ''}
                    </div>
                  </div>

                  {/* 时长 */}
                  <span
                    style={{
                      fontSize: 10,
                      color: 'var(--text-tertiary)',
                      fontVariantNumeric: 'tabular-nums',
                      flexShrink: 0,
                      marginRight: 2,
                    }}
                  >
                    {formatDuration(song.duration)}
                  </span>

                  {/* VIP 标记 */}
                  {song.pay > 0 && (
                    <span
                      style={{
                        fontSize: 9,
                        fontWeight: 600,
                        color: '#f59e0b',
                        backgroundColor: 'rgba(245, 158, 11, 0.1)',
                        padding: '1px 5px',
                        borderRadius: 3,
                        flexShrink: 0,
                      }}
                    >
                      VIP
                    </span>
                  )}

                  {/* 播放按钮 */}
                  <motion.button
                    whileHover={{ scale: 1.2 }}
                    whileTap={{ scale: 0.9 }}
                    onClick={(e) => {
                      e.stopPropagation();
                      handlePlay(song);
                    }}
                    disabled={isLoadingThis}
                    style={{
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'center',
                      border: 'none',
                      background: 'none',
                      cursor: isLoadingThis ? 'wait' : 'pointer',
                      color: isPlayingThis ? 'var(--primary-color)' : 'var(--text-tertiary)',
                      padding: 2,
                      flexShrink: 0,
                      opacity: isPlayingThis ? 1 : 0.5,
                    }}
                    title="播放"
                  >
                    {isLoadingThis ? (
                      <motion.div animate={{ rotate: 360 }} transition={{ duration: 1, repeat: Infinity, ease: 'linear' }}>
                        <Loader2 size={12} />
                      </motion.div>
                    ) : (
                      <Play size={12} fill={isPlayingThis ? 'var(--primary-color)' : 'none'} />
                    )}
                  </motion.button>

                  <motion.button
                    whileHover={{ scale: 1.2 }}
                    whileTap={{ scale: 0.9 }}
                    onClick={(e) => {
                      e.stopPropagation();
                      addToQueue({
                        id: song.id,
                        title: song.name,
                        artist: song.singer,
                        album: song.album || '',
                        src: '',
                        source: 'online',
                        addedAt: Date.now(),
                        coverUrl: song.coverUrl || '',
                        duration: song.duration || 0,
                      });
                    }}
                    style={{
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'center',
                      border: 'none',
                      background: 'none',
                      cursor: 'pointer',
                      color: 'var(--text-tertiary)',
                      padding: 2,
                      flexShrink: 0,
                      opacity: 0.5,
                    }}
                    title="加入队列"
                  >
                    <ListMusic size={12} />
                  </motion.button>

                  {/* 下载按钮（需求10） */}
                  {(() => {
                    const isDownloading = downloadingIds.has(song.id);
                    const isDownloaded = downloadedIds.has(song.id);
                    const downloadError = downloadErrorIds[song.id];

                    if (isDownloading) {
                      return (
                        <motion.div
                          animate={{ rotate: 360 }}
                          transition={{ duration: 1, repeat: Infinity, ease: 'linear' }}
                          style={{ flexShrink: 0, padding: 2 }}
                          title="下载中..."
                        >
                          <Loader2 size={12} style={{ color: 'var(--primary-color)' }} />
                        </motion.div>
                      );
                    }

                    if (isDownloaded) {
                      return (
                        <div
                          style={{
                            display: 'flex', alignItems: 'center', gap: 2,
                            flexShrink: 0, padding: '2px 4px',
                          }}
                          title="已下载"
                        >
                          <Check size={11} style={{ color: '#22c55e' }} />
                          <span style={{ fontSize: 9, color: '#22c55e' }}>已下载</span>
                        </div>
                      );
                    }

                    return (
                      <motion.button
                        whileHover={{ scale: 1.2 }}
                        whileTap={{ scale: 0.9 }}
                        onClick={(e) => {
                          e.stopPropagation();
                          handleDownloadSong(song);
                        }}
                        style={{
                          display: 'flex',
                          alignItems: 'center',
                          justifyContent: 'center',
                          border: 'none',
                          background: 'none',
                          cursor: 'pointer',
                          color: downloadError ? '#ef4444' : 'var(--text-tertiary)',
                          padding: 2,
                          flexShrink: 0,
                          opacity: 0.5,
                        }}
                        title={downloadError || '下载到本地'}
                      >
                        <Download size={12} />
                      </motion.button>
                    );
                  })()}
                </motion.div>
              );
            })}
          </div>

          {/* 加载更多 */}
          {results.length > 0 && results.length < total && (
            <motion.button
              whileHover={{ scale: 1.01 }}
              whileTap={{ scale: 0.99 }}
              onClick={handleLoadMore}
              disabled={searching}
              style={{
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                gap: 6,
                padding: '8px 16px',
                borderRadius: 8,
                border: '1px solid var(--border-light)',
                backgroundColor: 'var(--bg-tertiary)',
                color: 'var(--text-primary)',
                cursor: searching ? 'wait' : 'pointer',
                fontSize: 11,
                fontWeight: 500,
                opacity: searching ? 0.7 : 1,
              }}
            >
              {searching ? (
                <motion.div animate={{ rotate: 360 }} transition={{ duration: 1, repeat: Infinity, ease: 'linear' }}>
                  <Loader2 size={12} />
                </motion.div>
              ) : (
                <ChevronDown size={12} />
              )}
              {searching ? '加载中...' : '加载更多'}
            </motion.button>
          )}
        </>
      )}

      {/* Cookie 配置弹窗 */}
      <CookieModal
        visible={showCookieModal}
        onClose={() => setShowCookieModal(false)}
        onSave={handleCookieSaved}
      />

      {/* 曲目信息侧边栏（在线歌曲） */}
      <TrackInfoSidebar
        visible={showTrackInfoSidebar}
        trackId={trackInfoSongId}
        trackSource="online"
        onClose={() => {
          setShowTrackInfoSidebar(false);
          setTrackInfoSongId(null);
        }}
        onUpdated={() => {
          // 在线歌曲信息更新后不需要刷新，因为数据来自 API
        }}
      />
    </div>
  );
};

export default OnlineSearchPanel;
