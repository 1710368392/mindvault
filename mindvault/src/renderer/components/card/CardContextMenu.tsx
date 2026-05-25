import React, { useEffect, useRef } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import {
  Edit3, Copy, Trash2, Send,
} from 'lucide-react';
import { api } from '../../utils/api';
import CollectionIcon from '../common/CollectionIcon';
import { Modal, Menu, App as AntdApp } from 'antd';
import { useBoardStore } from '../../stores/boardStore';
import { useUIStore } from '../../stores/uiStore';
import { useCreativityStore } from '../../stores/creativityStore';
import type { Creativity } from '@shared/types';

interface CardContextMenuProps {
  x: number;
  y: number;
  creativity: Creativity;
  isOpen: boolean;
  onClose: () => void;
  onEdit?: (creativity: Creativity) => void;
  onCopy?: (creativity: Creativity) => void;
  onTrash?: (creativity: Creativity) => void;
}

const menuVariants = {
  hidden: { opacity: 0, scale: 0.9, y: -4 },
  visible: {
    opacity: 1,
    scale: 1,
    y: 0,
    transition: { duration: 0.15, ease: 'easeOut' },
  },
  exit: {
    opacity: 0,
    scale: 0.95,
    transition: { duration: 0.1 },
  },
};

const CardContextMenu: React.FC<CardContextMenuProps> = ({
  x,
  y,
  creativity,
  isOpen,
  onClose,
  onEdit,
  onCopy,
  onTrash,
}) => {
  const { modal } = AntdApp.useApp();
  const boards = useBoardStore((s) => s.boards);
  const menuRef = useRef<HTMLDivElement>(null);

  const handleSendToBoard = async (boardId: string) => {
    try {
      await api.board.canvas.addItem(boardId, creativity.id, 100 + Math.random() * 300, 100 + Math.random() * 300, undefined, undefined, null, null, null, true);
      await api.board.addCreativityRelation(boardId, creativity.id);
      const fetchBoards = useBoardStore.getState().fetchBoards;
      await fetchBoards();
      useUIStore.getState().showToast('success', '已发送至画布');
    } catch (error) {
      useUIStore.getState().showToast('error', '发送失败');
    }
    onClose();
  };

  // 构建菜单项
  const menuItems = [
    { key: 'edit', label: <span style={{ display: 'inline-flex', alignItems: 'center', gap: 8 }}><Edit3 size={14} />编辑</span> },
    { key: 'copy', label: <span style={{ display: 'inline-flex', alignItems: 'center', gap: 8 }}><Copy size={14} />复制</span> },
    { type: 'divider' as const },
  ];

  // 添加发送到画布子菜单（如果有画布）
  if (boards.length > 0) {
    menuItems.push({
      key: 'send-to-board',
      label: <span style={{ display: 'inline-flex', alignItems: 'center', gap: 8 }}><Send size={14} />发送至画布</span>,
      children: boards.map((board: any) => ({
        key: `board-${board.id}`,
        label: board.name,
        onClick: () => handleSendToBoard(board.id),
      })),
    });
    menuItems.push({ type: 'divider' as const });
  }

  menuItems.push(
    { key: 'favorite', label: <span style={{ display: 'inline-flex', alignItems: 'center', gap: 8 }}><CollectionIcon size={14} />{creativity.isFavorite ? '取消收藏' : '收藏'}</span> },
    { key: 'trash', label: <span style={{ display: 'inline-flex', alignItems: 'center', gap: 8 }}><Trash2 size={14} />移到回收站</span>, danger: true as const }
  );

  const handleMenuClick = async ({ key }: { key: string }) => {
    // 检查是否是画布菜单项（以 board- 开头）
    if (key.startsWith('board-')) {
      const boardId = key.replace('board-', '');
      handleSendToBoard(boardId);
      return;
    }
    
    if (key === 'edit') { onEdit?.(creativity); onClose(); }
    else if (key === 'copy') {
      navigator.clipboard.writeText(creativity.content).catch(() => {});
      onCopy?.(creativity);
      onClose();
    }
    else if (key === 'favorite') {
      const updated = await api.creativity.toggleFavorite(creativity.id);
      if (updated) {
        // 更新本地 store 中的收藏状态
        useCreativityStore.setState((state) => ({
          creativities: state.creativities.map(c => c.id === creativity.id ? { ...c, isFavorite: updated.isFavorite } : c),
        }));
      }
      onClose();
    }
    else if (key === 'trash') {
      modal.confirm({
        title: '移到回收站',
        content: `确定要将「${creativity.title || '此创意'}」移到回收站吗？`,
        okText: '移到回收站',
        cancelText: '取消',
        okButtonProps: { danger: true },
        onOk: () => {
          if (onTrash) {
            onTrash(creativity);
          } else {
            api.creativity.delete(creativity.id);
          }
          onClose();
        },
      });
    }
  };

  useEffect(() => {
    if (!isOpen) return;
    const handleClick = (e: MouseEvent) => {
      const target = e.target as HTMLElement;
      if (target.closest?.('.ant-menu')) return;
      if (menuRef.current && !menuRef.current.contains(e.target as Node)) {
        onClose();
      }
    };
    const handleEsc = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose();
    };
    const timer = setTimeout(() => {
      document.addEventListener('mousedown', handleClick);
      document.addEventListener('keydown', handleEsc);
    }, 0);
    return () => {
      clearTimeout(timer);
      document.removeEventListener('mousedown', handleClick);
      document.removeEventListener('keydown', handleEsc);
    };
  }, [isOpen, onClose]);

  // 调整菜单高度计算，因为子菜单可能更高
  const menuStyle = React.useMemo(() => {
    const menuWidth = 180;
    const menuHeight = boards.length > 0 ? 240 : 180;
    const adjustedX = x + menuWidth > window.innerWidth ? x - menuWidth : x;
    const adjustedY = y + menuHeight > window.innerHeight ? y - menuHeight : y;
    return { left: adjustedX, top: adjustedY };
  }, [x, y, boards.length]);

  return (
    <AnimatePresence>
      {isOpen && (
        <motion.div
          ref={menuRef}
          className="fixed z-[100] min-w-[180px] bg-[var(--bg-secondary)] border border-[var(--border-color)] rounded-xl shadow-lg overflow-hidden"
          style={menuStyle}
          variants={menuVariants}
          initial="hidden"
          animate="visible"
          exit="exit"
        >
          <Menu
            mode="vertical"
            onClick={handleMenuClick}
            style={{ border: 'none', background: 'transparent' }}
            items={menuItems}
          />
        </motion.div>
      )}
    </AnimatePresence>
  );
};

export default CardContextMenu;
