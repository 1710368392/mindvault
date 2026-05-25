import React, { useState, useRef, useEffect, useCallback } from 'react';
import { Tooltip } from 'antd';
import { motion, AnimatePresence } from 'framer-motion';
import {
  Search, Plus, Pin, PinOff, Archive, ArchiveRestore,
  Trash2, Edit3, Check, X, MessageSquare, MoreVertical,
} from 'lucide-react';
import { useAIStore, ChatWindow } from '../../stores/aiStore';

interface ChatListSidebarProps {
  collapsed: boolean;
  onToggleCollapse: () => void;
  width?: number;
}

export const ChatListSidebar: React.FC<ChatListSidebarProps> = ({
  collapsed,
  onToggleCollapse,
  width = 220,
}) => {
  const chatWindows = useAIStore((s) => s.chatWindows);
  const activeWindowId = useAIStore((s) => s.activeWindowId);
  const switchWindow = useAIStore((s) => s.switchWindow);
  const createWindow = useAIStore((s) => s.createWindow);
  const closeWindow = useAIStore((s) => s.closeWindow);
  const updateWindowTitle = useAIStore((s) => s.updateWindowTitle);
  const pinWindow = useAIStore((s) => s.pinWindow);
  const archiveWindow = useAIStore((s) => s.archiveWindow);

  const [searchQuery, setSearchQuery] = useState('');
  const [showArchived, setShowArchived] = useState(false);
  const [renamingId, setRenamingId] = useState<string | null>(null);
  const [renameValue, setRenameValue] = useState('');
  const [contextMenu, setContextMenu] = useState<{
    windowId: string;
    x: number;
    y: number;
  } | null>(null);
  const renameInputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (renamingId && renameInputRef.current) {
      renameInputRef.current.focus();
      renameInputRef.current.select();
    }
  }, [renamingId]);

  useEffect(() => {
    const handleClick = () => setContextMenu(null);
    if (contextMenu) {
      document.addEventListener('click', handleClick);
      return () => document.removeEventListener('click', handleClick);
    }
  }, [contextMenu]);

  const filteredWindows = chatWindows
    .filter((w) => {
      if (!showArchived && w.isArchived) return false;
      if (showArchived && !w.isArchived) return false;
      if (searchQuery) {
        const q = searchQuery.toLowerCase();
        const titleMatch = w.title.toLowerCase().includes(q);
        const contentMatch = w.messages.some((m) =>
          typeof m.content === 'string' && m.content.toLowerCase().includes(q)
        );
        return titleMatch || contentMatch;
      }
      return true;
    })
    .sort((a, b) => {
      if (a.isPinned && !b.isPinned) return -1;
      if (!a.isPinned && b.isPinned) return 1;
      return b.updatedAt - a.updatedAt;
    });

  const handleContextMenu = useCallback((e: React.MouseEvent, windowId: string) => {
    e.preventDefault();
    e.stopPropagation();
    setContextMenu({ windowId, x: e.clientX, y: e.clientY });
  }, []);

  const handleStartRename = useCallback((windowId: string) => {
    const win = chatWindows.find((w) => w.id === windowId);
    if (win) {
      setRenamingId(windowId);
      setRenameValue(win.title);
    }
    setContextMenu(null);
  }, [chatWindows]);

  const handleConfirmRename = useCallback(() => {
    if (renamingId && renameValue.trim()) {
      updateWindowTitle(renamingId, renameValue.trim());
    }
    setRenamingId(null);
    setRenameValue('');
  }, [renamingId, renameValue, updateWindowTitle]);

  const handleDelete = useCallback((windowId: string) => {
    closeWindow(windowId);
    setContextMenu(null);
  }, [closeWindow]);

  const handleTogglePin = useCallback((windowId: string) => {
    const win = chatWindows.find((w) => w.id === windowId);
    if (win) {
      pinWindow(windowId, !win.isPinned);
    }
    setContextMenu(null);
  }, [chatWindows, pinWindow]);

  const handleToggleArchive = useCallback((windowId: string) => {
    const win = chatWindows.find((w) => w.id === windowId);
    if (win) {
      archiveWindow(windowId, !win.isArchived);
    }
    setContextMenu(null);
  }, [chatWindows, archiveWindow]);

  const handleNewChat = useCallback(() => {
    createWindow();
  }, [createWindow]);

  const formatDateLabel = (timestamp: number): string => {
    const now = new Date();
    const date = new Date(timestamp);
    const diffDays = Math.floor((now.getTime() - date.getTime()) / (1000 * 60 * 60 * 24));

    if (diffDays === 0) return '今天';
    if (diffDays === 1) return '昨天';
    if (diffDays < 7) return `${diffDays}天前`;
    if (diffDays < 30) return `${Math.floor(diffDays / 7)}周前`;
    return `${date.getMonth() + 1}月${date.getDate()}日`;
  };

  const formatTime = (timestamp: number): string => {
    const date = new Date(timestamp);
    return `${String(date.getHours()).padStart(2, '0')}:${String(date.getMinutes()).padStart(2, '0')}`;
  };

  if (collapsed) {
    return (
      <div
        style={{
          width: 44,
          flexShrink: 0,
          borderRight: '1px solid var(--border-light)',
          background: 'var(--bg-secondary)',
          display: 'flex',
          flexDirection: 'column',
          alignItems: 'center',
          paddingTop: 12,
          gap: 8,
        }}
      >
        <Tooltip title="新建对话" placement="right">
          <button
            onClick={handleNewChat}
            style={{
              width: 32,
              height: 32,
              borderRadius: 8,
              border: 'none',
              background: 'var(--primary-color)',
              color: '#fff',
              cursor: 'pointer',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
            }}
          >
            <Plus size={16} />
          </button>
        </Tooltip>
        <Tooltip title="展开侧栏" placement="right">
          <button
            onClick={onToggleCollapse}
            style={{
              width: 32,
              height: 32,
              borderRadius: 8,
              border: 'none',
              background: 'transparent',
              color: 'var(--text-tertiary)',
              cursor: 'pointer',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
            }}
          >
            <MessageSquare size={16} />
          </button>
        </Tooltip>
      </div>
    );
  }

  const dateGroups: { date: string; dateLabel: string; windows: ChatWindow[] }[] = [];
  filteredWindows.forEach((win) => {
    const date = new Date(win.updatedAt);
    const dateStr = `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}-${String(date.getDate()).padStart(2, '0')}`;
    const dateLabel = formatDateLabel(win.updatedAt);

    const existingGroup = dateGroups.find((g) => g.date === dateStr);
    if (existingGroup) {
      existingGroup.windows.push(win);
    } else {
      dateGroups.push({ date: dateStr, dateLabel, windows: [win] });
    }
  });

  return (
    <motion.div
      initial={{ width: 0, opacity: 0 }}
      animate={{ width, opacity: 1 }}
      exit={{ width: 0, opacity: 0 }}
      transition={{ duration: 0.2, ease: 'easeInOut' }}
      style={{
        width,
        flexShrink: 0,
        borderRight: '1px solid var(--border-light)',
        background: 'var(--bg-secondary)',
        display: 'flex',
        flexDirection: 'column',
        overflow: 'hidden',
        position: 'relative',
      }}
    >
      {/* 头部 */}
      <div style={{
        padding: '10px 12px',
        borderBottom: '1px solid var(--border-light)',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'space-between',
        flexShrink: 0,
      }}>
        <span style={{ fontSize: 13, fontWeight: 600, color: 'var(--text-primary)' }}>
          对话
        </span>
        <div style={{ display: 'flex', gap: 4 }}>
          <Tooltip title="新建对话">
            <button
              onClick={handleNewChat}
              style={{
                width: 26,
                height: 26,
                borderRadius: 6,
                border: 'none',
                background: 'var(--primary-bg)',
                color: 'var(--primary-color)',
                cursor: 'pointer',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
              }}
            >
              <Plus size={14} />
            </button>
          </Tooltip>
          <Tooltip title={showArchived ? '显示活跃对话' : '显示归档对话'}>
            <button
              onClick={() => setShowArchived(!showArchived)}
              style={{
                width: 26,
                height: 26,
                borderRadius: 6,
                border: 'none',
                background: showArchived ? 'var(--primary-bg)' : 'transparent',
                color: showArchived ? 'var(--primary-color)' : 'var(--text-tertiary)',
                cursor: 'pointer',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
              }}
            >
              <Archive size={14} />
            </button>
          </Tooltip>
        </div>
      </div>

      {/* 搜索框 */}
      <div style={{ padding: '8px 10px', flexShrink: 0 }}>
        <div style={{
          display: 'flex',
          alignItems: 'center',
          gap: 6,
          background: 'var(--bg-tertiary)',
          borderRadius: 8,
          padding: '6px 10px',
          border: '1px solid var(--border-light)',
        }}>
          <Search size={14} style={{ color: 'var(--text-tertiary)', flexShrink: 0 }} />
          <input
            type="text"
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            placeholder="搜索对话..."
            style={{
              border: 'none',
              background: 'transparent',
              outline: 'none',
              fontSize: 12,
              color: 'var(--text-primary)',
              width: '100%',
            }}
          />
          {searchQuery && (
            <button
              onClick={() => setSearchQuery('')}
              style={{
                border: 'none',
                background: 'none',
                cursor: 'pointer',
                color: 'var(--text-tertiary)',
                padding: 0,
                display: 'flex',
              }}
            >
              <X size={12} />
            </button>
          )}
        </div>
      </div>

      {/* 对话列表 */}
      <div style={{ flex: 1, overflowY: 'auto', padding: '4px 0' }}>
        {dateGroups.length === 0 && (
          <div style={{
            padding: '20px 12px',
            textAlign: 'center',
            color: 'var(--text-tertiary)',
            fontSize: 12,
          }}>
            {showArchived ? '没有归档的对话' : searchQuery ? '没有找到匹配的对话' : '暂无对话'}
          </div>
        )}

        {dateGroups.map((group) => (
          <div key={group.date} style={{ marginBottom: 4 }}>
            <div style={{
              padding: '6px 12px',
              fontSize: 10,
              fontWeight: 600,
              color: 'var(--text-tertiary)',
              background: 'var(--bg-tertiary)',
              position: 'sticky',
              top: 0,
              zIndex: 1,
              textTransform: 'uppercase',
              letterSpacing: 0.5,
            }}>
              {group.dateLabel}
            </div>

            {group.windows.map((win) => {
              const isActive = activeWindowId === win.id;
              const isRenaming = renamingId === win.id;

              return (
                <div
                  key={win.id}
                  onClick={() => !isRenaming && switchWindow(win.id)}
                  onContextMenu={(e) => handleContextMenu(e, win.id)}
                  style={{
                    padding: '8px 12px',
                    cursor: isRenaming ? 'default' : 'pointer',
                    background: isActive ? 'var(--primary-bg)' : 'transparent',
                    borderLeft: isActive ? '3px solid var(--primary-color)' : '3px solid transparent',
                    transition: 'background 0.15s ease',
                    position: 'relative',
                  }}
                  onMouseEnter={(e) => {
                    if (!isActive) (e.currentTarget as HTMLElement).style.background = 'var(--bg-tertiary)';
                  }}
                  onMouseLeave={(e) => {
                    if (!isActive) (e.currentTarget as HTMLElement).style.background = 'transparent';
                  }}
                >
                  <div style={{
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'space-between',
                    gap: 4,
                  }}>
                    {isRenaming ? (
                      <div style={{ display: 'flex', alignItems: 'center', gap: 4, flex: 1 }}>
                        <input
                          ref={renameInputRef}
                          type="text"
                          value={renameValue}
                          onChange={(e) => setRenameValue(e.target.value)}
                          onKeyDown={(e) => {
                            if (e.key === 'Enter') handleConfirmRename();
                            if (e.key === 'Escape') setRenamingId(null);
                          }}
                          onClick={(e) => e.stopPropagation()}
                          style={{
                            border: '1px solid var(--primary-color)',
                            borderRadius: 4,
                            padding: '2px 6px',
                            fontSize: 12,
                            background: 'var(--bg-primary)',
                            color: 'var(--text-primary)',
                            outline: 'none',
                            width: '100%',
                          }}
                        />
                        <button
                          onClick={(e) => { e.stopPropagation(); handleConfirmRename(); }}
                          style={{ border: 'none', background: 'none', cursor: 'pointer', color: 'var(--primary-color)', padding: 2, display: 'flex' }}
                        >
                          <Check size={12} />
                        </button>
                        <button
                          onClick={(e) => { e.stopPropagation(); setRenamingId(null); }}
                          style={{ border: 'none', background: 'none', cursor: 'pointer', color: 'var(--text-tertiary)', padding: 2, display: 'flex' }}
                        >
                          <X size={12} />
                        </button>
                      </div>
                    ) : (
                      <>
                        <div style={{ display: 'flex', alignItems: 'center', gap: 4, flex: 1, minWidth: 0 }}>
                          {win.isPinned && <Pin size={10} style={{ color: 'var(--primary-color)', flexShrink: 0, transform: 'rotate(45deg)' }} />}
                          <span style={{
                            fontSize: 12,
                            fontWeight: isActive ? 600 : 400,
                            color: isActive ? 'var(--primary-color)' : 'var(--text-primary)',
                            overflow: 'hidden',
                            textOverflow: 'ellipsis',
                            whiteSpace: 'nowrap',
                          }}>
                            {win.title}
                          </span>
                        </div>
                        <span style={{
                          fontSize: 10,
                          color: 'var(--text-tertiary)',
                          flexShrink: 0,
                        }}>
                          {formatTime(win.updatedAt)}
                        </span>
                      </>
                    )}
                  </div>

                  {!isRenaming && (
                    <div style={{
                      fontSize: 10,
                      color: 'var(--text-tertiary)',
                      marginTop: 2,
                      overflow: 'hidden',
                      textOverflow: 'ellipsis',
                      whiteSpace: 'nowrap',
                    }}>
                      {win.messages.length > 0
                        ? `${win.messages.length} 条消息`
                        : '空对话'}
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        ))}
      </div>

      {/* 右键菜单 */}
      <AnimatePresence>
        {contextMenu && (
          <motion.div
            initial={{ opacity: 0, scale: 0.9 }}
            animate={{ opacity: 1, scale: 1 }}
            exit={{ opacity: 0, scale: 0.9 }}
            transition={{ duration: 0.1 }}
            style={{
              position: 'fixed',
              left: contextMenu.x,
              top: contextMenu.y,
              background: 'var(--bg-primary)',
              border: '1px solid var(--border-light)',
              borderRadius: 8,
              boxShadow: '0 4px 16px rgba(0,0,0,0.12)',
              padding: '4px 0',
              minWidth: 150,
              zIndex: 1000,
            }}
          >
            <ContextMenuButton
              icon={<Edit3 size={14} />}
              label="重命名"
              onClick={() => handleStartRename(contextMenu.windowId)}
            />
            <ContextMenuButton
              icon={chatWindows.find((w) => w.id === contextMenu.windowId)?.isPinned ? <PinOff size={14} /> : <Pin size={14} />}
              label={chatWindows.find((w) => w.id === contextMenu.windowId)?.isPinned ? '取消置顶' : '置顶'}
              onClick={() => handleTogglePin(contextMenu.windowId)}
            />
            <ContextMenuButton
              icon={chatWindows.find((w) => w.id === contextMenu.windowId)?.isArchived ? <ArchiveRestore size={14} /> : <Archive size={14} />}
              label={chatWindows.find((w) => w.id === contextMenu.windowId)?.isArchived ? '取消归档' : '归档'}
              onClick={() => handleToggleArchive(contextMenu.windowId)}
            />
            <div style={{ height: 1, background: 'var(--border-light)', margin: '4px 0' }} />
            <ContextMenuButton
              icon={<Trash2 size={14} />}
              label="删除"
              onClick={() => handleDelete(contextMenu.windowId)}
              danger
            />
          </motion.div>
        )}
      </AnimatePresence>
    </motion.div>
  );
};

const ContextMenuButton: React.FC<{
  icon: React.ReactNode;
  label: string;
  onClick: () => void;
  danger?: boolean;
}> = ({ icon, label, onClick, danger }) => (
  <button
    onClick={(e) => { e.stopPropagation(); onClick(); }}
    style={{
      display: 'flex',
      alignItems: 'center',
      gap: 8,
      width: '100%',
      padding: '8px 14px',
      border: 'none',
      background: 'none',
      color: danger ? '#ff4d4f' : 'var(--text-primary)',
      fontSize: 13,
      cursor: 'pointer',
    }}
    onMouseEnter={(e) => {
      (e.currentTarget as HTMLElement).style.background = danger ? 'rgba(255,77,79,0.08)' : 'var(--bg-tertiary)';
    }}
    onMouseLeave={(e) => {
      (e.currentTarget as HTMLElement).style.background = 'none';
    }}
  >
    <span style={{ color: danger ? '#ff4d4f' : 'var(--text-secondary)', display: 'flex' }}>{icon}</span>
    <span>{label}</span>
  </button>
);

export default ChatListSidebar;
