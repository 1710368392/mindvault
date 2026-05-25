import React, { useState, useRef, useCallback, useEffect, useMemo } from 'react';
import { motion } from 'framer-motion';
import {
  ZoomIn,
  ZoomOut,
  Maximize2,
  Move,
  MousePointer,
  Plus,
  Send,
  Trash2,
  Search,
  X,
  Type,
  Image,
  Mic,
  Link,
  Video,
  LayoutGrid,
  PackageOpen,
  RefreshCw,
  Play,
  Music,
  Pause,
  Volume2,
  VolumeX,
  AlertTriangle,
  Link2,
  Unlink,
  Copy,
  FileText,
} from 'lucide-react';
import { useBoardStore } from '../../stores/boardStore';
import { useCreativityStore } from '../../stores/creativityStore';
import { useUIStore } from '../../stores/uiStore';
import { useSettingsStore } from '../../stores/settingsStore';
import { api } from '../../utils/api';
import { Modal, Alert, Tooltip, Typography } from 'antd';
import { truncateText } from '../../utils/formatters';
import EmojiIcon from '../common/EmojiIcon';
import { toMediaUrl, inferTypeFromPath, registerMediaPaths, getFileNameFromPath } from '../../utils/media';
import { SUBTYPE_CONFIG, getAllSubtypes } from '@shared/types';
import type { BoardCanvasEdge, BoardCanvasItem, Creativity, ConnectorPosition, ConnectorSide } from '@shared/types';
import CanvasVideoPlayer from './CanvasVideoPlayer';

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

// ===== 类型定义 =====

interface CanvasViewProps {
  boardId: string;
  onCardClick?: (creativity: any) => void;
  onCardContextMenu?: (e: React.MouseEvent, creativity: any) => void;
}

// ===== 连接点拖拽状态 =====
interface DraggingConnector {
  edgeId: string;
  isSource: boolean; // 是否是源连接点
  itemId: string; // 所属卡片ID
}

// ===== 附着状态（用于连接点调整时附着到卡片上） =====
interface AttachedConnector {
  edgeId: string;
  isSource: boolean;
  itemId: string;
}

// ===== 类型图标映射 =====

const TYPE_ICONS: Record<string, React.ReactNode> = {
  text: <Type size={14} />,
  image: <Image size={14} />,
  audio: <Mic size={14} />,
  link: <Link size={14} />,
  video: <Video size={14} />,
  document: <FileText size={14} />,
};

const TYPE_LABELS: Record<string, string> = {
  text: '文本',
  image: '图片',
  audio: '音频',
  link: '链接',
  video: '视频',
  document: '文档',
};

// ===== 连线颜色映射 =====

const EDGE_COLORS: Record<string, string> = {
  related: '#9ca3af',
  derived: '#3b82f6',
  custom: '#22c55e',
  'chapter-order': '#6366F1',
  'character-relation': '#EC4899',
};

// ===== 贝塞尔曲线路径 =====

// ===== 根据连接点位置 => 坐标计算

function calculateConnectorPosition(
  itemX: number,
  itemY: number,
  connector?: ConnectorPosition | null,
  defaultSide: ConnectorSide = 'right',
  itemWidth: number = CARD_MIN_WIDTH,
  itemHeight: number = CARD_MIN_HEIGHT
): { x: number; y: number } {
  if (!connector) {
    if (defaultSide === 'right') return { x: itemX + itemWidth, y: itemY + itemHeight / 2 };
    if (defaultSide === 'left') return { x: itemX, y: itemY + itemHeight / 2 };
    if (defaultSide === 'top') return { x: itemX + itemWidth / 2, y: itemY };
    if (defaultSide === 'bottom') return { x: itemX + itemWidth / 2, y: itemY + itemHeight };
    return { x: itemX + itemWidth, y: itemY + itemHeight / 2 };
  }

  if (connector.relativeX !== undefined && connector.relativeY !== undefined) {
    return { x: itemX + connector.relativeX, y: itemY + connector.relativeY };
  }
  
  const { side, offset } = connector;
  if (side === 'left') return { x: itemX, y: itemY + offset * itemHeight };
  if (side === 'right') return { x: itemX + itemWidth, y: itemY + offset * itemHeight };
  if (side === 'top') return { x: itemX + offset * itemWidth, y: itemY };
  if (side === 'bottom') return { x: itemX + offset * itemWidth, y: itemY + itemHeight };
  return { x: itemX + itemWidth, y: itemY + itemHeight / 2 };
}

function getEdgePath(
  sourceX: number,
  sourceY: number,
  targetX: number,
  targetY: number,
  controlPoints?: { x: number; y: number }[] | null
): string {
  if (controlPoints && controlPoints.length > 0) {
    const points = [{ x: sourceX, y: sourceY }, ...controlPoints, { x: targetX, y: targetY }];
    let path = `M ${points[0].x} ${points[0].y}`;
    for (let i = 1; i < points.length; i++) {
      const prev = points[i - 1];
      const curr = points[i];
      const dx = Math.abs(curr.x - prev.x);
      const dy = Math.abs(curr.y - prev.y);
      const offset = Math.max(30, Math.max(dx, dy) * 0.3);
      const dirX = curr.x > prev.x ? 1 : -1;
      const dirY = curr.y > prev.y ? 1 : -1;
      path += ` C ${prev.x + offset * dirX} ${prev.y}, ${curr.x - offset * dirX} ${curr.y}, ${curr.x} ${curr.y}`;
    }
    return path;
  }
  const dx = Math.abs(targetX - sourceX);
  const dy = Math.abs(targetY - sourceY);
  const controlOffset = Math.max(50, Math.max(dx, dy) * 0.4);
  return `M ${sourceX} ${sourceY} C ${sourceX + controlOffset} ${sourceY}, ${targetX - controlOffset} ${targetY}, ${targetX} ${targetY}`;
}

// ===== 节点卡片常量 =====

const CARD_MIN_WIDTH = 240;
const CARD_MIN_HEIGHT = 140;
const CONNECTOR_SIZE = 12;

// ===== CreativityPicker 弹窗组件 =====

interface CreativityPickerProps {
  open: boolean;
  onClose: () => void;
  onSelect: (creativity: any) => void;
}

const CreativityPicker: React.FC<CreativityPickerProps> = ({ open, onClose, onSelect }) => {
  const [keyword, setKeyword] = useState('');
  const [results, setResults] = useState<any[]>([]);
  const [isSearching, setIsSearching] = useState(false);
  const inputRef = useRef<HTMLInputElement>(null);
  const timerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  // 加载所有创意的函数
  const loadAllCreativities = async () => {
    try {
      setIsSearching(true);
      const result = await api.creativity.list({ pageSize: 200 }); // 获取所有创意
      setResults((result as any)?.data || []);
    } catch {
      setResults([]);
    } finally {
      setIsSearching(false);
    }
  };

  useEffect(() => {
    if (open) {
      setKeyword('');
      // 打开时立即加载所有创意
      loadAllCreativities();
      setTimeout(() => inputRef.current?.focus(), 100);
    }
  }, [open]);

  const handleSearch = useCallback((value: string) => {
    setKeyword(value);
    if (timerRef.current) clearTimeout(timerRef.current);
    
    if (!value.trim()) {
      // 关键词为空时重新加载所有创意
      loadAllCreativities();
      return;
    }
    
    // 有搜索词时执行搜索
    setIsSearching(true);
    timerRef.current = setTimeout(async () => {
      try {
        const items = await api.creativity.search(value);
        setResults(items || []);
      } catch {
        setResults([]);
      } finally {
        setIsSearching(false);
      }
    }, 300);
  }, []);

  useEffect(() => {
    return () => {
      if (timerRef.current) clearTimeout(timerRef.current);
    };
  }, []);

  if (!open) return null;

  return (
    <div
      style={{
        position: 'fixed',
        inset: 0,
        zIndex: 1000,
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        backgroundColor: 'rgba(0,0,0,0.4)',
      }}
      onClick={onClose}
      onMouseDown={(e) => e.stopPropagation()}
    >
      <div
        style={{
          width: 480,
          maxHeight: 520,
          backgroundColor: 'var(--bg-secondary)',
          borderRadius: 12,
          boxShadow: '0 20px 60px rgba(0,0,0,0.3)',
          display: 'flex',
          flexDirection: 'column',
          overflow: 'hidden',
        }}
        onClick={(e) => e.stopPropagation()}
        onMouseDown={(e) => e.stopPropagation()}
      >
        {/* 头部 */}
        <div
          style={{
            display: 'flex',
            alignItems: 'center',
            padding: '16px 20px',
            borderBottom: '1px solid var(--border-color)',
            gap: 12,
          }}
        >
          <SearchIcon size={18} />
          <input
            ref={inputRef}
            value={keyword}
            onChange={(e) => handleSearch(e.target.value)}
            placeholder="搜索创意..."
            style={{
              flex: 1,
              border: 'none',
              outline: 'none',
              background: 'transparent',
              fontSize: 15,
              color: 'var(--text-primary)',
            }}
          />
          <button
            onClick={onClose}
            style={{
              padding: 4,
              borderRadius: 6,
              border: 'none',
              background: 'transparent',
              cursor: 'pointer',
              color: 'var(--text-tertiary)',
              display: 'flex',
              alignItems: 'center',
            }}
          >
            <X size={16} />
          </button>
        </div>

        {/* 结果列表 */}
        <div
          style={{
            flex: 1,
            overflowY: 'auto',
            padding: '8px 0',
          }}
        >
          {isSearching && (
            <div style={{ padding: '24px 20px', textAlign: 'center', color: 'var(--text-tertiary)', fontSize: 14 }}>
              搜索中...
            </div>
          )}
          {!isSearching && keyword && results.length === 0 && (
            <div style={{ padding: '24px 20px', textAlign: 'center', color: 'var(--text-tertiary)', fontSize: 14 }}>
              未找到匹配的创意
            </div>
          )}
          {!isSearching && results.map((item) => (
            <div
              key={item.id}
              onClick={() => onSelect(item)}
              style={{
                display: 'flex',
                alignItems: 'center',
                gap: 12,
                padding: '10px 20px',
                cursor: 'pointer',
                transition: 'background-color 0.15s',
              }}
              onMouseEnter={(e) => {
                (e.currentTarget as HTMLElement).style.backgroundColor = 'var(--bg-hover)';
              }}
              onMouseLeave={(e) => {
                (e.currentTarget as HTMLElement).style.backgroundColor = 'transparent';
              }}
            >
              <div
                style={{
                  width: 32,
                  height: 32,
                  borderRadius: 8,
                  backgroundColor: 'var(--bg-tertiary)',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  color: 'var(--text-tertiary)',
                  flexShrink: 0,
                }}
              >
                {TYPE_ICONS[item.type] || <Type size={14} />}
              </div>
              <div style={{ flex: 1, minWidth: 0 }}>
                <div
                  style={{
                    fontSize: 14,
                    fontWeight: 500,
                    color: 'var(--text-primary)',
                    overflow: 'hidden',
                    textOverflow: 'ellipsis',
                    whiteSpace: 'nowrap',
                  }}
                >
                  {item.emojiReaction && <span style={{ marginRight: 4, display: 'inline-flex', alignItems: 'center' }}><EmojiIcon id={item.emojiReaction} size={14} /></span>}
                  {item.title}
                </div>
                <div
                  style={{
                    display: 'flex',
                    alignItems: 'center',
                    gap: 6,
                    marginTop: 2,
                  }}
                >
                  <span style={{ fontSize: 12, color: 'var(--text-tertiary)' }}>
                    {TYPE_LABELS[item.type] || item.type}
                  </span>
                  <Typography.Text ellipsis style={{ fontSize: 12, color: 'var(--text-tertiary)' }}>
                    {item.content || ''}
                  </Typography.Text>
                </div>
              </div>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
};

// ===== 打包为创意链确认弹窗组件 =====

interface PackAsChainDialogProps {
  open: boolean;
  onClose: () => void;
  onConfirm: (name: string, description?: string) => void;
  selectedItems: BoardCanvasItem[];
  isLoading?: boolean;
}

const PackAsChainDialog: React.FC<PackAsChainDialogProps> = ({
  open,
  onClose,
  onConfirm,
  selectedItems,
  isLoading = false,
}) => {
  const [name, setName] = useState('未命名创意链');
  const [description, setDescription] = useState('');

  useEffect(() => {
    if (open) {
      setName('未命名创意链');
      setDescription('');
    }
  }, [open]);

  return (
    <Modal
      open={open}
      onCancel={onClose}
      title={`打包为创意链 (${selectedItems.length}个节点)`}
      onOk={() => onConfirm(name, description)}
      okText={isLoading ? '创建中...' : '创建并发送到看板'}
      cancelText="取消"
      okButtonProps={{ disabled: isLoading || !name.trim() }}
      centered
      width={460}
    >
      <div style={{ display: 'flex', flexDirection: 'column', gap: 16, padding: '8px 0' }}>
        <div>
          <label style={{ display: 'block', fontSize: 13, fontWeight: 600, color: 'var(--text-secondary)', marginBottom: 6 }}>
            创意链名称
          </label>
          <input
            type="text"
            value={name}
            onChange={(e) => setName(e.target.value)}
            placeholder="输入创意链名称"
            style={{
              width: '100%',
              padding: '10px 14px',
              fontSize: 14,
              borderRadius: 8,
              border: '1px solid var(--border-color)',
              backgroundColor: 'var(--bg-primary)',
              color: 'var(--text-primary)',
              outline: 'none',
            }}
          />
        </div>

        <div>
          <label style={{ display: 'block', fontSize: 13, fontWeight: 600, color: 'var(--text-secondary)', marginBottom: 6 }}>
            描述（可选）
          </label>
          <textarea
            value={description}
            onChange={(e) => setDescription(e.target.value)}
            placeholder="添加一些描述信息..."
            rows={3}
            style={{
              width: '100%',
              padding: '10px 14px',
              fontSize: 14,
              borderRadius: 8,
              border: '1px solid var(--border-color)',
              backgroundColor: 'var(--bg-primary)',
              color: 'var(--text-primary)',
              outline: 'none',
              resize: 'none',
            }}
          />
        </div>
      </div>
    </Modal>
  );
};

// ===== 导入确认弹窗（超过阈值时提示） =====

interface ImportConfirmDialogProps {
  open: boolean;
  onClose: () => void;
  onConfirm: (useSource: boolean) => void;
  creativityTitle: string;
  mediaSizeMB: number;
  thresholdMB: number;
}

const ImportConfirmDialog: React.FC<ImportConfirmDialogProps> = ({
  open,
  onClose,
  onConfirm,
  creativityTitle,
  mediaSizeMB,
  thresholdMB,
}) => {
  return (
    <Modal
      open={open}
      onCancel={onClose}
      title="导入内容较大"
      footer={
        <button
          onClick={onClose}
          style={{
            padding: '8px 16px',
            fontSize: 13,
            borderRadius: 8,
            border: 'none',
            backgroundColor: 'transparent',
            color: 'var(--text-secondary)',
            cursor: 'pointer',
          }}
        >
          取消
        </button>
      }
      centered
      width={460}
    >
      <div style={{ padding: '8px 0' }}>
        <Alert
          type="warning"
          message={`创意「${creativityTitle}」关联的媒体文件大小为 ${mediaSizeMB.toFixed(1)} MB，超过了设定阈值（${thresholdMB} MB）。`}
          showIcon
          style={{ marginBottom: 16 }}
        />
        <p style={{ fontSize: 13, color: 'var(--text-tertiary)', lineHeight: 1.6 }}>
          请选择导入方式：
        </p>
        <div style={{ marginTop: 16, display: 'flex', flexDirection: 'column', gap: 10 }}>
          <button
            onClick={() => onConfirm(false)}
            style={{
              display: 'flex',
              alignItems: 'center',
              gap: 10,
              padding: '12px 16px',
              borderRadius: 10,
              border: '2px solid var(--primary-color)',
              backgroundColor: 'rgba(var(--primary-color-rgb, 99,102,241), 0.08)',
              cursor: 'pointer',
              textAlign: 'left',
            }}
          >
            <Copy size={18} style={{ color: 'var(--primary-color)', flexShrink: 0 }} />
            <div>
              <div style={{ fontSize: 14, fontWeight: 600, color: 'var(--text-primary)' }}>独立复制</div>
              <div style={{ fontSize: 12, color: 'var(--text-tertiary)', marginTop: 2 }}>复制内容到画布，编辑时互不影响</div>
            </div>
          </button>
          <button
            onClick={() => onConfirm(true)}
            style={{
              display: 'flex',
              alignItems: 'center',
              gap: 10,
              padding: '12px 16px',
              borderRadius: 10,
              border: '1px solid var(--border-color)',
              backgroundColor: 'var(--bg-tertiary)',
              cursor: 'pointer',
              textAlign: 'left',
            }}
          >
            <Link size={18} style={{ color: '#3b82f6', flexShrink: 0 }} />
            <div>
              <div style={{ fontSize: 14, fontWeight: 600, color: 'var(--text-primary)' }}>使用源数据（互通）</div>
              <div style={{ fontSize: 12, color: 'var(--text-tertiary)', marginTop: 2 }}>与源创意共享数据，编辑会同步更新</div>
            </div>
          </button>
        </div>
      </div>
    </Modal>
  );
};

// ===== 右键菜单组件 =====

interface ContextMenuState {
  x: number;
  y: number;
  type: 'canvas' | 'node';
  itemId?: string;
}

const CanvasContextMenu: React.FC<{
  state: ContextMenuState;
  onClose: () => void;
  onAddCreativity: () => void;
  onAutoArrange: () => void;
  onDeleteNode?: () => void;
  onPackAsChain?: () => void;
  onToggleLinked?: () => void;
  isLinked?: boolean;
  selectedCount?: number;
}> = ({ state, onClose, onAddCreativity, onAutoArrange, onDeleteNode, onPackAsChain, onToggleLinked, isLinked, selectedCount }) => {
  useEffect(() => {
    const handler = () => onClose();
    document.addEventListener('click', handler);
    return () => document.removeEventListener('click', handler);
  }, [onClose]);

  if (!state) return null;

  const menuItems: Array<{
    label: string;
    icon: React.ReactNode;
    onClick: () => void;
    danger?: boolean;
  }> = [
    { label: '添加创意', icon: <Plus size={14} />, onClick: onAddCreativity },
    { label: '自动排列全部', icon: <LayoutGrid size={14} />, onClick: onAutoArrange },
  ];

  // 如果选中了多个节点，添加打包为创意链选项
  if (selectedCount && selectedCount > 1 && onPackAsChain) {
    menuItems.splice(1, 0, {
      label: `打包为创意链 (${selectedCount}个节点)`,
      icon: <PackageOpen size={14} />,
      onClick: onPackAsChain,
    });
  }

  if (state.type === 'node' && onDeleteNode) {
    if (onToggleLinked && isLinked !== undefined) {
      menuItems.push({
        label: isLinked ? '转为独立卡片' : '转为互通卡片',
        icon: isLinked ? <Unlink size={14} /> : <Link2 size={14} />,
        onClick: onToggleLinked,
      });
    }
    menuItems.push({
      label: '从画布移除卡片',
      icon: <Trash2 size={14} />,
      onClick: onDeleteNode,
      danger: true,
    });
  }

  return (
    <div
      className="canvas-toolbar"
      style={{
        position: 'fixed',
        left: state.x,
        top: state.y,
        zIndex: 900,
        backgroundColor: 'var(--bg-secondary)',
        borderRadius: 8,
        boxShadow: '0 8px 24px rgba(0,0,0,0.2)',
        border: '1px solid var(--border-color)',
        padding: '4px 0',
        minWidth: 160,
      }}
      onMouseDown={(e) => e.stopPropagation()}
    >
      {menuItems.map((item, idx) => (
        <button
          key={idx}
          onClick={() => {
            item.onClick();
            onClose();
          }}
          style={{
            display: 'flex',
            alignItems: 'center',
            gap: 8,
            width: '100%',
            padding: '8px 16px',
            border: 'none',
            background: 'transparent',
            cursor: 'pointer',
            fontSize: 13,
            color: item.danger ? 'var(--color-danger, #ef4444)' : 'var(--text-primary)',
            textAlign: 'left',
          }}
          onMouseEnter={(e) => {
            (e.currentTarget as HTMLElement).style.backgroundColor = 'var(--bg-hover)';
          }}
          onMouseLeave={(e) => {
            (e.currentTarget as HTMLElement).style.backgroundColor = 'transparent';
          }}
        >
          {item.icon}
          {item.label}
        </button>
      ))}
    </div>
  );
};

// ===== 主组件 CanvasView =====

const CanvasView: React.FC<CanvasViewProps> = ({
  boardId,
  onCardClick,
  onCardContextMenu,
}) => {
  // ===== Store =====
  const {
    canvasItems,
    canvasEdges,
    selectedCanvasItemIds,
    isCanvasConnecting,
    connectingFromItemId,
    canvasToolMode,
    setCanvasToolMode,
    canvasScale,
    canvasOffset,
    setCanvasScale,
    setCanvasOffset,
    fetchCanvasData,
    addCanvasItem,
    removeCanvasItem,
    updateCanvasItemPosition,
    batchUpdateCanvasItemPositions,
    syncCanvasItemPositions,
    updateCanvasItemSize,
    bringCanvasItemToFront,
    addCanvasEdge,
    removeCanvasEdge,
    updateCanvasEdgeConnector,
    updateCanvasEdgeLabel,
    updateCanvasEdgeControlPoints,
    toggleCanvasItemSelection,
    clearCanvasSelection,
    setCanvasConnecting,
    createChainAndSticky,
  } = useBoardStore();
  const currentBoard = useBoardStore((s) => s.currentBoard);

  // ===== 本地状态 =====
  const [scale, setScaleState] = useState(canvasScale);
  const [offset, setOffsetState] = useState(canvasOffset);
  const [isPanning, setIsPanning] = useState(false);
  const [panStart, setPanStart] = useState({ x: 0, y: 0 });

  // 拖拽节点
  const [draggingItemId, setDraggingItemId] = useState<string | null>(null);
  const [dragOffset, setDragOffset] = useState({ x: 0, y: 0 });

  const [resizingItemId, setResizingItemId] = useState<string | null>(null);
  const [resizeDirection, setResizeDirection] = useState<string | null>(null);
  const [resizeStart, setResizeStart] = useState({ x: 0, y: 0, width: 0, height: 0, positionX: 0, positionY: 0 });
  const [resizeAspectRatio, setResizeAspectRatio] = useState(1);
  const [hoveredResizeCursor, setHoveredResizeCursor] = useState<{ itemId: string; cursor: string } | null>(null);

  const [draggingControlPoint, setDraggingControlPoint] = useState<{ edgeId: string; cpId: string } | null>(null);
  const [edgeControlPointMenu, setEdgeControlPointMenu] = useState<{ x: number; y: number; edgeId: string; cpId: string } | null>(null);
  const [highlightedEdgeId, setHighlightedEdgeId] = useState<string | null>(null);

  const EDGE_THRESHOLD = 10;

  const detectResizeEdge = useCallback((e: React.MouseEvent, item: BoardCanvasItem): string | null => {
    const displayType = item.type || (item.creativity?.type) || 'text';
    if (displayType !== 'image' && displayType !== 'video') return null;
    if (canvasToolMode !== 'hand') return null;

    const el = e.currentTarget as HTMLElement;
    const rect = el.getBoundingClientRect();
    const x = e.clientX - rect.left;
    const y = e.clientY - rect.top;
    const w = rect.width;
    const h = el.firstElementChild ? (el.firstElementChild as HTMLElement).offsetHeight : el.scrollHeight;

    const nearTop = y < EDGE_THRESHOLD;
    const nearBottom = y > h - EDGE_THRESHOLD;
    const nearLeft = x < EDGE_THRESHOLD;
    const nearRight = x > w - EDGE_THRESHOLD;

    if (nearTop && nearLeft) return 'nw';
    if (nearTop && nearRight) return 'ne';
    if (nearBottom && nearLeft) return 'sw';
    if (nearBottom && nearRight) return 'se';
    if (nearTop) return 'n';
    if (nearBottom) return 's';
    if (nearLeft) return 'w';
    if (nearRight) return 'e';

    return null;
  }, [canvasToolMode]);

  const getResizeCursor = useCallback((direction: string | null): string => {
    if (!direction) return '';
    const map: Record<string, string> = {
      'n': 'n-resize', 's': 's-resize', 'e': 'e-resize', 'w': 'w-resize',
      'ne': 'ne-resize', 'nw': 'nw-resize', 'se': 'se-resize', 'sw': 'sw-resize',
    };
    return map[direction] || '';
  }, []);

  const findNonOverlappingPosition = useCallback((x: number, y: number, excludeId?: string) => {
    const OFFSET_STEP = 30;
    let newX = x;
    let newY = y;
    let attempts = 0;
    const maxAttempts = 20;

    while (attempts < maxAttempts) {
      const overlapping = canvasItems.some(item => {
        if (excludeId && item.id === excludeId) return false;
        const itemW = item.width || CARD_MIN_WIDTH;
        const itemH = item.height || CARD_MIN_HEIGHT;
        return Math.abs(newX - item.positionX) < itemW * 0.5 &&
               Math.abs(newY - item.positionY) < itemH * 0.5;
      });
      if (!overlapping) break;
      newX += OFFSET_STEP;
      newY += OFFSET_STEP;
      attempts++;
    }
    return { x: newX, y: newY };
  }, [canvasItems]);

  // 框选
  const [isSelecting, setIsSelecting] = useState(false);
  const [selectionStart, setSelectionStart] = useState({ x: 0, y: 0 });
  const [selectionEnd, setSelectionEnd] = useState({ x: 0, y: 0 });

  // 连线临时线
  const [tempLineEnd, setTempLineEnd] = useState<{ x: number; y: number } | null>(null);

  // 右键菜单
  const [contextMenu, setContextMenu] = useState<ContextMenuState | null>(null);

  // 连线右键菜单
  const [edgeContextMenu, setEdgeContextMenu] = useState<{ x: number; y: number; edgeId: string } | null>(null);

  // CreativityPicker 弹窗
  const [pickerOpen, setPickerOpen] = useState(false);

  // 打包为创意链弹窗
  const [packDialogOpen, setPackDialogOpen] = useState(false);
  const [packing, setPacking] = useState(false);

  // 导入确认弹窗（超过阈值时）
  const [importConfirmOpen, setImportConfirmOpen] = useState(false);
  const [importConfirmData, setImportConfirmData] = useState<{
    creativity: any;
    x: number;
    y: number;
    mediaSizeMB: number;
  } | null>(null);

  // 边标签编辑
  const [editingEdgeId, setEditingEdgeId] = useState<string | null>(null);
  const [editingEdgeLabel, setEditingEdgeLabel] = useState('');
  const [editingEdgePos, setEditingEdgePos] = useState({ x: 0, y: 0 });

  // 鼠标位置（用于连线临时线）
  const [mousePos, setMousePos] = useState({ x: 0, y: 0 });
  
  // 连线开始时的连接点位置
  const [connectionStartConnector, setConnectionStartConnector] = useState<ConnectorPosition | null>(null);
  
  // ===== 连接点拖拽状态
  const [draggingConnector, setDraggingConnector] = useState<DraggingConnector | null>(null);

  // ===== 附着状态（用于连接点调整时附着到卡片上）
  const [attachedConnector, setAttachedConnector] = useState<AttachedConnector | null>(null);

  const [isFileDragOver, setIsFileDragOver] = useState(false);
  const fileDragCounterRef = useRef(0);

  const canvasItemsRef = useRef(canvasItems);
  canvasItemsRef.current = canvasItems;

  const measureAndUpdateCard = useCallback((itemId: string) => {
    requestAnimationFrame(() => {
      const node = document.getElementById(`canvas-card-${itemId}`);
      if (node) {
        const w = Math.round(node.offsetWidth);
        const h = Math.round(node.offsetHeight);
        const item = canvasItemsRef.current.find(i => i.id === itemId);
        if (item) {
          const storedW = item.width || CARD_MIN_WIDTH;
          const storedH = item.height || CARD_MIN_HEIGHT;
          if (storedW !== w || storedH !== h) {
            updateCanvasItemSize(itemId, w, h);
          }
        }
      }
    });
  }, [updateCanvasItemSize]);

  const screenToCanvas = useCallback(
    (clientX: number, clientY: number) => {
      const container = containerRef.current;
      if (!container) return { x: 0, y: 0 };
      const rect = container.getBoundingClientRect();
      return {
        x: (clientX - rect.left - offset.x) / scale,
        y: (clientY - rect.top - offset.y) / scale,
      };
    },
    [offset, scale]
  );

  const handleFileDragOver = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    if (e.dataTransfer.types.includes('Files')) {
      e.dataTransfer.dropEffect = 'copy';
    }
  }, []);

  const handleFileDragEnter = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    if (!e.dataTransfer.types.includes('Files')) return;
    fileDragCounterRef.current++;
    setIsFileDragOver(true);
  }, []);

  const handleFileDragLeave = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    fileDragCounterRef.current--;
    if (fileDragCounterRef.current <= 0) {
      fileDragCounterRef.current = 0;
      setIsFileDragOver(false);
    }
  }, []);

  const handleFileDrop = useCallback(async (e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    fileDragCounterRef.current = 0;
    setIsFileDragOver(false);

    if (!e.dataTransfer.types.includes('Files')) return;
    const files = Array.from(e.dataTransfer.files);
    if (files.length === 0) return;

    const canvasPos = screenToCanvas(e.clientX, e.clientY);

    for (let i = 0; i < files.length; i++) {
      const file = files[i];
      const fileType = inferTypeFromPath(file.name);
      if (!fileType) continue;

      if (fileType === 'document') {
        const arrayBuffer = await file.arrayBuffer();
        const uint8 = new Uint8Array(arrayBuffer);

        const mediaResult = await api.media.save({
          fileData: uint8,
          fileName: file.name,
          fileType,
        });

        if (!mediaResult?.success || !mediaResult.data) continue;

        registerMediaPaths([mediaResult.data]);

        const creativityResult = await api.creativity.create({
          title: '',
          content: '',
          type: 'document',
          contentFormat: 'plain',
        });

        if (creativityResult?.id) {
          await api.media.linkToCreativity([mediaResult.data.id], creativityResult.id);
          await useCreativityStore.getState().fetchCreativities();
          const offsetX = i * (CARD_MIN_WIDTH + 20);
          await addCanvasItem(
            boardId,
            creativityResult.id,
            Math.round(canvasPos.x + offsetX),
            Math.round(canvasPos.y),
            undefined, undefined,
            creativityResult.title || null,
            creativityResult.content || null,
            creativityResult.type || null,
            true,
            creativityResult.subtype || null,
            creativityResult.cardStyle || null,
            creativityResult.priority || 0,
            creativityResult.emojiReaction || null,
            creativityResult.contentFormat || 'markdown'
          );
        }
        continue;
      }

      const arrayBuffer = await file.arrayBuffer();
      const uint8 = new Uint8Array(arrayBuffer);

      const mediaResult = await api.media.save({
        fileData: uint8,
        fileName: file.name,
        fileType,
      });

      if (!mediaResult?.success || !mediaResult.data) continue;

      registerMediaPaths([mediaResult.data]);

      const creativityResult = await api.creativity.create({
        title: '',
        content: '',
        type: fileType,
        contentFormat: 'plain',
      });

      if (creativityResult?.id) {
        await api.media.linkToCreativity([mediaResult.data.id], creativityResult.id);
        await useCreativityStore.getState().fetchCreativities();
        const offsetX = i * (CARD_MIN_WIDTH + 20);
        await addCanvasItem(
          boardId,
          creativityResult.id,
          Math.round(canvasPos.x + offsetX),
          Math.round(canvasPos.y),
          undefined, undefined,
          creativityResult.title || null,
          creativityResult.content || null,
          creativityResult.type || null,
          true,
          creativityResult.subtype || null,
          creativityResult.cardStyle || null,
          creativityResult.priority || 0,
          creativityResult.emojiReaction || null,
          creativityResult.contentFormat || 'markdown'
        );
      }
    }
  }, [boardId, screenToCanvas, addCanvasItem]);

  // ===== 交互状态跟踪 Ref（用于全局监听器） =====
  const interactionRef = useRef({
    isPanning: false,
    isSelecting: false,
    draggingItemId: null as string | null,
    draggingConnector: null as DraggingConnector | null,
    attachedConnector: null as AttachedConnector | null,
    selectionStart: { x: 0, y: 0 },
    selectionEnd: { x: 0, y: 0 },
    canvasItems: [] as BoardCanvasItem[],
  });

  // 同步状态到 Ref
  useEffect(() => {
    interactionRef.current.isPanning = isPanning;
    interactionRef.current.isSelecting = isSelecting;
    interactionRef.current.draggingItemId = draggingItemId;
    interactionRef.current.draggingConnector = draggingConnector;
    interactionRef.current.attachedConnector = attachedConnector;
    interactionRef.current.selectionStart = { ...selectionStart };
    interactionRef.current.selectionEnd = { ...selectionEnd };
    interactionRef.current.canvasItems = [...canvasItems];
  }, [isPanning, isSelecting, draggingItemId, draggingConnector, attachedConnector, selectionStart, selectionEnd, canvasItems, resizingItemId]);

  useEffect(() => {
    const handleWindowMouseUp = () => {
      if (draggingControlPoint) {
        setDraggingControlPoint(null);
      }
    };
    window.addEventListener('mouseup', handleWindowMouseUp);
    return () => window.removeEventListener('mouseup', handleWindowMouseUp);
  }, [draggingControlPoint]);

  // ===== 计算鼠标在卡片边框上的位置 =====
  const getItemVisualHeight = useCallback((item: BoardCanvasItem): number => {
    const displayType = item.type || (item.creativity?.type) || 'text';
    const isNaturalSizeMedia = displayType === 'image' || displayType === 'video';
    if (isNaturalSizeMedia) {
      const el = document.getElementById(`canvas-card-${item.id}`);
      if (el && el.firstElementChild) {
        const innerHeight = (el.firstElementChild as HTMLElement).offsetHeight;
        if (innerHeight > 0) {
          return innerHeight;
        }
      }
    }
    return item.height || CARD_MIN_HEIGHT;
  }, []);

  const calculateConnectorFromMouse = useCallback(
    (itemX: number, itemY: number, mouseCanvasX: number, mouseCanvasY: number, itemWidth: number = CARD_MIN_WIDTH, itemHeight: number = CARD_MIN_HEIGHT): ConnectorPosition => {
      const centerX = itemX + itemWidth / 2;
      const centerY = itemY + itemHeight / 2;
      const dx = mouseCanvasX - centerX;
      const dy = mouseCanvasY - centerY;

      const distLeft = Math.abs(mouseCanvasX - itemX);
      const distRight = Math.abs(mouseCanvasX - (itemX + itemWidth));
      const distTop = Math.abs(mouseCanvasY - itemY);
      const distBottom = Math.abs(mouseCanvasY - (itemY + itemHeight));

      const minDist = Math.min(distLeft, distRight, distTop, distBottom);

      let side: ConnectorSide;
      let offset: number;

      if (minDist === distLeft) {
        side = 'left';
        offset = Math.max(0, Math.min(1, (mouseCanvasY - itemY) / itemHeight));
      } else if (minDist === distRight) {
        side = 'right';
        offset = Math.max(0, Math.min(1, (mouseCanvasY - itemY) / itemHeight));
      } else if (minDist === distTop) {
        side = 'top';
        offset = Math.max(0, Math.min(1, (mouseCanvasX - itemX) / itemWidth));
      } else {
        side = 'bottom';
        offset = Math.max(0, Math.min(1, (mouseCanvasX - itemX) / itemWidth));
      }

      const relativeX = Math.max(0, Math.min(itemWidth, mouseCanvasX - itemX));
      const relativeY = Math.max(0, Math.min(itemHeight, mouseCanvasY - itemY));

      return { side, offset, relativeX, relativeY };
    },
    []
  );

  // ===== Refs =====
  const containerRef = useRef<HTMLDivElement>(null);
  const canvasRef = useRef<HTMLDivElement>(null);
  const longPressTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const pendingConnectorRef = useRef<DraggingConnector | null>(null);
  const justEndedConnectorDragRef = useRef(false);
  const justEndedNodeDragRef = useRef(false);
  const nodeDragStartPosRef = useRef<{ x: number; y: number } | null>(null);
  const dragStartPositionsRef = useRef<Map<string, { x: number; y: number }>>(new Map());
  const dragStartCanvasPosRef = useRef<{ x: number; y: number } | null>(null);
  const spaceLongPressTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const isSpaceLongPressRef = useRef(false);
  const originalCanvasModeRef = useRef<'hand' | 'pointer'>(canvasToolMode);

  // ===== 加载画布数据 =====
  useEffect(() => {
    if (boardId) {
      fetchCanvasData(boardId);
    }
  }, [boardId, fetchCanvasData]);

  // ===== ESC 键取消连线/关闭菜单 =====
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        // 取消连线
        if (isCanvasConnecting) {
          setCanvasConnecting(false);
          setTempLineEnd(null);
          setConnectionStartConnector(null);
        }
        // 关闭右键菜单
        if (contextMenu) {
          setContextMenu(null);
        }
        if (edgeContextMenu) {
          setEdgeContextMenu(null);
        }
        // 关闭标签编辑
        if (editingEdgeId) {
          setEditingEdgeId(null);
        }
        // 取消附着模式
        if (attachedConnector) {
          setAttachedConnector(null);
        }
        // 取消拖拽
        if (draggingConnector) {
          setDraggingConnector(null);
        }
      }
      if (e.key === ' ' && !e.repeat) {
        // 空格键处理
        e.preventDefault();
        isSpaceLongPressRef.current = false;
        originalCanvasModeRef.current = canvasToolMode;
        
        // 200ms 后如果还没松手，视为长按，临时切换模式
        spaceLongPressTimerRef.current = setTimeout(() => {
          isSpaceLongPressRef.current = true;
          // 临时切换到另一个模式
          setCanvasToolMode(canvasToolMode === 'pointer' ? 'hand' : 'pointer');
        }, 200);
      }
    };
    
    const handleKeyUp = (e: KeyboardEvent) => {
      if (e.key === ' ') {
        e.preventDefault();
        
        if (spaceLongPressTimerRef.current) {
          clearTimeout(spaceLongPressTimerRef.current);
          spaceLongPressTimerRef.current = null;
        }
        
        if (isSpaceLongPressRef.current) {
          // 长按结束，恢复原来的模式
          setCanvasToolMode(originalCanvasModeRef.current);
          isSpaceLongPressRef.current = false;
        } else {
          // 单击，切换模式
          setCanvasToolMode(canvasToolMode === 'pointer' ? 'hand' : 'pointer');
        }
      }
    };

    document.addEventListener('keydown', handleKeyDown);
    document.addEventListener('keyup', handleKeyUp);
    return () => {
      document.removeEventListener('keydown', handleKeyDown);
      document.removeEventListener('keyup', handleKeyUp);
      if (spaceLongPressTimerRef.current) {
        clearTimeout(spaceLongPressTimerRef.current);
      }
    };
  }, [isCanvasConnecting, contextMenu, edgeContextMenu, editingEdgeId, setCanvasConnecting, attachedConnector, draggingConnector, canvasToolMode, setCanvasToolMode]);
  
  // ===== 全局点击事件 =====
  useEffect(() => {
    const handleGlobalClick = (e: MouseEvent) => {
      // 优先处理右键菜单关闭
      if (contextMenu || edgeContextMenu) {
        const target = e.target as HTMLElement;
        if (!target.closest('.canvas-toolbar')) {
          // 点击的是菜单外，关闭菜单
          if (contextMenu) setContextMenu(null);
          if (edgeContextMenu) setEdgeContextMenu(null);
        }
        return;
      }
      
      // 处理附着模式
      if (attachedConnector) {
        const target = e.target as HTMLElement;
        if (!target.closest('.canvas-connector')) {
          // 点击的不是连接器，退出附着模式
          setAttachedConnector(null);
        }
      }
    };
    
    document.addEventListener('click', handleGlobalClick);
    return () => document.removeEventListener('click', handleGlobalClick);
  }, [contextMenu, edgeContextMenu, attachedConnector]);

  // ===== 安全的全局 mouseup 兜底监听器 =====
  useEffect(() => {
    const handleGlobalMouseUp = () => {
      const state = interactionRef.current;
      if (state.isPanning || state.isSelecting || state.draggingItemId || state.draggingConnector || state.attachedConnector || longPressTimerRef.current || pendingConnectorRef.current) {
        console.log('[CanvasView] Safety global mouseup triggered, cleaning up');
        
        if (longPressTimerRef.current) {
          clearTimeout(longPressTimerRef.current);
          longPressTimerRef.current = null;
        }
        pendingConnectorRef.current = null;
        
        // 使用函数式更新来确保清理所有状态
        if (state.draggingConnector) {
          setDraggingConnector(null);
          justEndedConnectorDragRef.current = true;
          requestAnimationFrame(() => {
            justEndedConnectorDragRef.current = false;
          });
        }
        if (state.attachedConnector) {
          setAttachedConnector(null);
          justEndedConnectorDragRef.current = true;
          requestAnimationFrame(() => {
            justEndedConnectorDragRef.current = false;
          });
        }
        setIsPanning(false);
        if (state.draggingItemId) {
          justEndedNodeDragRef.current = true;
          requestAnimationFrame(() => {
            justEndedNodeDragRef.current = false;
          });
          setDraggingItemId(null);
        }
        
        // 处理框选逻辑（只有在真正进行框选时）
        if (state.isSelecting) {
          setIsSelecting(false);
          
          const left = Math.min(state.selectionStart.x, state.selectionEnd.x);
          const top = Math.min(state.selectionStart.y, state.selectionEnd.y);
          const right = Math.max(state.selectionStart.x, state.selectionEnd.x);
          const bottom = Math.max(state.selectionStart.y, state.selectionEnd.y);

          if (right - left > 5 || bottom - top > 5) {
            state.canvasItems.forEach((item) => {
              const itemLeft = item.positionX;
              const itemTop = item.positionY;
              const itemRight = itemLeft + (item.width || CARD_MIN_WIDTH);
              const itemBottom = itemTop + (item.height || CARD_MIN_HEIGHT);

              if (
                itemLeft < right &&
                itemRight > left &&
                itemTop < bottom &&
                itemBottom > top
              ) {
                toggleCanvasItemSelection(item.id);
              }
            });
          }
        }
      }
    };
    
    window.addEventListener('mouseup', handleGlobalMouseUp);
    window.addEventListener('blur', handleGlobalMouseUp);
    return () => {
      window.removeEventListener('mouseup', handleGlobalMouseUp);
      window.removeEventListener('blur', handleGlobalMouseUp);
    };
  }, [toggleCanvasItemSelection]);

  // ===== 缩放 =====
  const handleWheel = useCallback(
    (e: WheelEvent) => {
      if (e.ctrlKey || e.metaKey) {
        e.preventDefault();
        const delta = e.deltaY > 0 ? -0.1 : 0.1;
        const newScale = Math.min(Math.max(scale + delta, 0.2), 3);
        setScaleState(newScale);
        setCanvasScale(newScale);
      }
    },
    [scale, setCanvasScale]
  );

  useEffect(() => {
    const el = containerRef.current;
    if (!el) return;
    el.addEventListener('wheel', handleWheel, { passive: false });
    return () => el.removeEventListener('wheel', handleWheel);
  }, [handleWheel]);

  // ===== 画布空白处 mousedown =====
  const handleCanvasMouseDown = useCallback(
    (e: React.MouseEvent) => {
      console.log('[CanvasView] Canvas mousedown:', { shiftKey: e.shiftKey, target: (e.target as HTMLElement).className });
      
      // 如果打包对话框或右键菜单打开，不处理
      if (packDialogOpen || contextMenu || edgeContextMenu) {
        return;
      }

      if (edgeContextMenu) {
        setEdgeContextMenu(null);
        setEdgeControlPointMenu(null);
        return;
      }

      // 如果点击在卡片或连接点上，不处理
      if ((e.target as HTMLElement).closest('.canvas-node-card')) return;
      if ((e.target as HTMLElement).closest('.canvas-connector')) return;
      if ((e.target as HTMLElement).closest('.canvas-toolbar')) return;

      // 如果是 shift+点击，不处理（可能是连线模式开始）
      if (e.shiftKey) return;

      // 如果处于连线模式，才取消连线
      if (isCanvasConnecting) {
        console.log('[CanvasView] Cancelling connection on canvas click');
        setCanvasConnecting(false);
        setTempLineEnd(null);
        return;
      }

      // 正常模式处理
      if (canvasToolMode === 'hand') {
        clearCanvasSelection();
        setHighlightedEdgeId(null);
        setIsPanning(true);
        setPanStart({ x: e.clientX - offset.x, y: e.clientY - offset.y });
        return;
      }

      if (canvasToolMode === 'pointer') {
        const canvasPos = screenToCanvas(e.clientX, e.clientY);
        setIsSelecting(true);
        setSelectionStart(canvasPos);
        setSelectionEnd(canvasPos);
        clearCanvasSelection();
        setHighlightedEdgeId(null);
      }
    },
    [offset, canvasToolMode, screenToCanvas, clearCanvasSelection, setCanvasConnecting, isCanvasConnecting, packDialogOpen, contextMenu, edgeContextMenu]
  );

  // ===== mousemove =====
  const handleMouseMove = useCallback(
    (e: React.MouseEvent) => {
      // 更新鼠标位置
      setMousePos({ x: e.clientX, y: e.clientY });

      // 如果长按定时器还在（鼠标按下但还没进入拖拽模式），鼠标移动时立即进入拖拽模式
      if (longPressTimerRef.current && !draggingConnector && !attachedConnector) {
        clearTimeout(longPressTimerRef.current);
        longPressTimerRef.current = null;
        const pending = pendingConnectorRef.current;
        if (pending) {
          setDraggingConnector(pending);
          pendingConnectorRef.current = null;
          // 立即处理拖拽
          const canvasPos = screenToCanvas(e.clientX, e.clientY);
          const item = canvasItems.find(i => i.id === pending.itemId);
          if (item) {
            const newConnector = calculateConnectorFromMouse(item.positionX, item.positionY, canvasPos.x, canvasPos.y, item.width || CARD_MIN_WIDTH, item.height || CARD_MIN_HEIGHT);
            updateCanvasEdgeConnector(pending.edgeId, pending.isSource, newConnector);
          }
          return;
        }
      }

      // 连接点拖拽
      if (draggingConnector) {
        const canvasPos = screenToCanvas(e.clientX, e.clientY);
        const item = canvasItems.find(i => i.id === draggingConnector.itemId);
        if (item) {
          const newConnector = calculateConnectorFromMouse(item.positionX, item.positionY, canvasPos.x, canvasPos.y, item.width || CARD_MIN_WIDTH, getItemVisualHeight(item));
          updateCanvasEdgeConnector(draggingConnector.edgeId, draggingConnector.isSource, newConnector);
        }
        return;
      }
      
      // 连接点附着跟随模式
      if (attachedConnector) {
        const canvasPos = screenToCanvas(e.clientX, e.clientY);
        const item = canvasItems.find(i => i.id === attachedConnector.itemId);
        if (item) {
          const newConnector = calculateConnectorFromMouse(item.positionX, item.positionY, canvasPos.x, canvasPos.y, item.width || CARD_MIN_WIDTH, getItemVisualHeight(item));
          updateCanvasEdgeConnector(attachedConnector.edgeId, attachedConnector.isSource, newConnector);
        }
        return;
      }

      // 平移
      if (isPanning) {
        const newOffset = {
          x: e.clientX - panStart.x,
          y: e.clientY - panStart.y,
        };
        setOffsetState(newOffset);
        setCanvasOffset(newOffset);
      }

      // 框选
      if (isSelecting) {
        const canvasPos = screenToCanvas(e.clientX, e.clientY);
        setSelectionEnd(canvasPos);
      }

      // 拖拽节点
      if (draggingItemId) {
        const canvasPos = screenToCanvas(e.clientX, e.clientY);

        if (dragStartPositionsRef.current.size > 0 && dragStartCanvasPosRef.current) {
          const totalDx = canvasPos.x - dragStartCanvasPosRef.current.x;
          const totalDy = canvasPos.y - dragStartCanvasPosRef.current.y;

          const updates: { id: string; x: number; y: number }[] = [];
          dragStartPositionsRef.current.forEach((startPos, id) => {
            updates.push({
              id,
              x: Math.round(startPos.x + totalDx),
              y: Math.round(startPos.y + totalDy),
            });
          });
          batchUpdateCanvasItemPositions(updates);
        } else {
          const x = canvasPos.x - dragOffset.x;
          const y = canvasPos.y - dragOffset.y;
          batchUpdateCanvasItemPositions([{ id: draggingItemId, x: Math.round(x), y: Math.round(y) }]);
        }
      }

      // 缩放节点
      if (resizingItemId && resizeDirection) {
        const dx = e.clientX - resizeStart.x;
        const dy = e.clientY - resizeStart.y;
        const dir = resizeDirection;
        const ar = resizeAspectRatio;

        let newW = resizeStart.width;
        let newH = resizeStart.height;

        if (dir === 'e' || dir === 'ne' || dir === 'se') {
          newW = Math.max(CARD_MIN_WIDTH, resizeStart.width + dx);
        }
        if (dir === 'w' || dir === 'nw' || dir === 'sw') {
          newW = Math.max(CARD_MIN_WIDTH, resizeStart.width - dx);
        }
        if (dir === 's' || dir === 'sw' || dir === 'se') {
          newH = Math.max(CARD_MIN_HEIGHT, resizeStart.height + dy);
        }
        if (dir === 'n' || dir === 'nw' || dir === 'ne') {
          newH = Math.max(CARD_MIN_HEIGHT, resizeStart.height - dy);
        }

        if (dir === 'n' || dir === 's') {
          newW = Math.max(CARD_MIN_WIDTH, Math.round(newH * ar));
        } else if (dir === 'e' || dir === 'w') {
          newH = Math.max(CARD_MIN_HEIGHT, Math.round(newW / ar));
        } else {
          const diagonal = Math.sqrt(dx * dx + dy * dy);
          const sign = (dir === 'ne' || dir === 'se') ? 1 : -1;
          const signY = (dir === 'nw' || dir === 'ne') ? -1 : 1;
          const effectiveDx = sign * diagonal * Math.cos(Math.atan(ar));
          const effectiveDy = signY * diagonal * Math.sin(Math.atan(ar));
          newW = Math.max(CARD_MIN_WIDTH, Math.round(resizeStart.width + effectiveDx));
          newH = Math.max(CARD_MIN_HEIGHT, Math.round(newW / ar));
        }

        updateCanvasItemSize(resizingItemId, newW, newH);

        let newX = resizeStart.positionX;
        let newY = resizeStart.positionY;
        if (dir === 'n' || dir === 'nw' || dir === 'ne') {
          newY = resizeStart.positionY + (resizeStart.height - newH);
        }
        if (dir === 'w' || dir === 'nw' || dir === 'sw') {
          newX = resizeStart.positionX + (resizeStart.width - newW);
        }
        if (newX !== resizeStart.positionX || newY !== resizeStart.positionY) {
          updateCanvasItemPosition(resizingItemId, newX, newY);
        }

        const relatedEdges = canvasEdges.filter(
          (edge) => edge.sourceItemId === resizingItemId || edge.targetItemId === resizingItemId
        );
        for (const edge of relatedEdges) {
          const isSource = edge.sourceItemId === resizingItemId;
          const connector = isSource ? edge.sourceConnector : edge.targetConnector;
          if (connector && connector.relativeX !== undefined && connector.relativeY !== undefined) {
            const clampedX = Math.min(connector.relativeX, newW);
            const clampedY = Math.min(connector.relativeY, newH);
            if (clampedX !== connector.relativeX || clampedY !== connector.relativeY) {
              const updatedConnector: ConnectorPosition = {
                ...connector,
                relativeX: clampedX,
                relativeY: clampedY,
              };
              updateCanvasEdgeConnector(edge.id, isSource ? 'source' : 'target', updatedConnector);
            }
          }
        }
      }

      // 连线临时线
      {
        const { isCanvasConnecting: connecting, connectingFromItemId: fromId } = useBoardStore.getState();
        if (connecting && fromId) {
          const canvasPos = screenToCanvas(e.clientX, e.clientY);
          setTempLineEnd(canvasPos);
        }
      }

      // 拖拽连线控制点
      if (draggingControlPoint) {
        const canvasPos = screenToCanvas(e.clientX, e.clientY);
        const edge = canvasEdges.find(ed => ed.id === draggingControlPoint.edgeId);
        if (edge && edge.controlPoints) {
          const updatedCps = edge.controlPoints.map(cp =>
            cp.id === draggingControlPoint.cpId ? { ...cp, x: Math.round(canvasPos.x), y: Math.round(canvasPos.y) } : cp
          );
          updateCanvasEdgeControlPoints(edge.id, updatedCps);
        }
      }
    },
    [isPanning, panStart, isSelecting, draggingItemId, dragOffset, screenToCanvas, batchUpdateCanvasItemPositions, canvasItems, selectedCanvasItemIds, draggingConnector, attachedConnector, calculateConnectorFromMouse, updateCanvasEdgeConnector, resizingItemId, resizeDirection, resizeStart, resizeAspectRatio, updateCanvasItemSize, updateCanvasItemPosition, canvasEdges, draggingControlPoint, updateCanvasEdgeControlPoints]
  );

  // ===== mouseup =====
  const handleMouseUp = useCallback(() => {
    console.log('[CanvasView] handleMouseUp called', {
      isPanning,
      isSelecting,
      draggingItemId,
      draggingConnector,
      attachedConnector,
    });
    
    // 先缓存需要用于框选逻辑的值
    const _isSelecting = isSelecting;
    const _selectionStart = { ...selectionStart };
    const _selectionEnd = { ...selectionEnd };
    const _canvasItems = [...canvasItems];
    
    // 立即清除所有拖拽/交互状态
    if (longPressTimerRef.current) {
      clearTimeout(longPressTimerRef.current);
      longPressTimerRef.current = null;
    }
    pendingConnectorRef.current = null;
    if (draggingConnector) {
      setDraggingConnector(null);
      justEndedConnectorDragRef.current = true;
      requestAnimationFrame(() => {
        justEndedConnectorDragRef.current = false;
      });
    }
    if (attachedConnector) {
      setAttachedConnector(null);
      justEndedConnectorDragRef.current = true;
      requestAnimationFrame(() => {
        justEndedConnectorDragRef.current = false;
      });
    }
    setIsPanning(false);
    if (draggingItemId) {
      if (dragStartPositionsRef.current.size > 0) {
        const updates: { id: string; x: number; y: number }[] = [];
        const currentItems = useBoardStore.getState().canvasItems;
        dragStartPositionsRef.current.forEach((_, id) => {
          const item = currentItems.find(i => i.id === id);
          if (item) {
            updates.push({ id, x: item.positionX, y: item.positionY });
          }
        });
        syncCanvasItemPositions(updates);
      }
      dragStartPositionsRef.current = new Map();
      dragStartCanvasPosRef.current = null;

      justEndedNodeDragRef.current = true;
      requestAnimationFrame(() => {
        justEndedNodeDragRef.current = false;
      });
      setDraggingItemId(null);
    }
    if (resizingItemId) {
      setResizingItemId(null);
      setResizeDirection(null);
      setHoveredResizeCursor(null);
    }
    if (draggingControlPoint) {
      setDraggingControlPoint(null);
    }
    setIsSelecting(false);

    // 然后再处理框选逻辑，使用缓存的值
    if (_isSelecting) {
      const left = Math.min(_selectionStart.x, _selectionEnd.x);
      const top = Math.min(_selectionStart.y, _selectionEnd.y);
      const right = Math.max(_selectionStart.x, _selectionEnd.x);
      const bottom = Math.max(_selectionStart.y, _selectionEnd.y);

      if (right - left > 5 || bottom - top > 5) {
        _canvasItems.forEach((item) => {
          const itemLeft = item.positionX;
          const itemTop = item.positionY;
          const itemRight = itemLeft + (item.width || CARD_MIN_WIDTH);
          const itemBottom = itemTop + (item.height || CARD_MIN_HEIGHT);

          if (
            itemLeft < right &&
            itemRight > left &&
            itemTop < bottom &&
            itemBottom > top
          ) {
            toggleCanvasItemSelection(item.id);
          }
        });
      }
    }
  }, [isPanning, isSelecting, selectionStart, selectionEnd, canvasItems, draggingItemId, draggingConnector, attachedConnector, toggleCanvasItemSelection, syncCanvasItemPositions]);

  // ===== 节点拖拽开始 =====
  const handleNodeDragStart = useCallback(
    (e: React.MouseEvent, item: BoardCanvasItem) => {
      if (contextMenu || edgeContextMenu) {
        return;
      }
      if (e.button !== 0) {
        return;
      }
      if (isCanvasConnecting || e.shiftKey) {
        return;
      }
      if (draggingControlPoint) {
        return;
      }

      bringCanvasItemToFront(item.id);
      setHighlightedEdgeId(null);

      nodeDragStartPosRef.current = { x: e.clientX, y: e.clientY };

      const edge = detectResizeEdge(e, item);
      if (edge) {
        e.stopPropagation();
        e.preventDefault();
        const itemW = item.width || CARD_MIN_WIDTH;
        const itemH = item.height || CARD_MIN_HEIGHT;
        setResizingItemId(item.id);
        setResizeDirection(edge);
        setResizeStart({ x: e.clientX, y: e.clientY, width: itemW, height: itemH, positionX: item.positionX, positionY: item.positionY });
        setResizeAspectRatio(itemW / itemH);
        return;
      }

      if (canvasToolMode === 'pointer') {
        return;
      }

      e.stopPropagation();
      e.preventDefault();
      const canvasPos = screenToCanvas(e.clientX, e.clientY);
      setDraggingItemId(item.id);
      setDragOffset({
        x: canvasPos.x - item.positionX,
        y: canvasPos.y - item.positionY,
      });
      if (!selectedCanvasItemIds.includes(item.id)) {
        clearCanvasSelection();
      }

      const currentSelectedIds = selectedCanvasItemIds.includes(item.id)
        ? selectedCanvasItemIds
        : [item.id];
      const positionsMap = new Map<string, { x: number; y: number }>();
      for (const id of currentSelectedIds) {
        const ci = canvasItems.find(i => i.id === id);
        if (ci) positionsMap.set(id, { x: ci.positionX, y: ci.positionY });
      }
      dragStartPositionsRef.current = positionsMap;
      dragStartCanvasPosRef.current = { x: canvasPos.x, y: canvasPos.y };
    },
    [screenToCanvas, canvasToolMode, selectedCanvasItemIds, clearCanvasSelection, isCanvasConnecting, contextMenu, edgeContextMenu, detectResizeEdge, canvasItems]
  );

  // ===== 节点点击 =====
  const handleNodeClick = useCallback(
    async (e: React.MouseEvent, item: BoardCanvasItem) => {
      e.stopPropagation();

      setHighlightedEdgeId(null);
      bringCanvasItemToFront(item.id);

      if (justEndedConnectorDragRef.current) {
        return;
      }

      if (justEndedNodeDragRef.current) {
        return;
      }

      if (nodeDragStartPosRef.current) {
        const dx = e.clientX - nodeDragStartPosRef.current.x;
        const dy = e.clientY - nodeDragStartPosRef.current.y;
        nodeDragStartPosRef.current = null;
        if (Math.sqrt(dx * dx + dy * dy) > 5) {
          return;
        }
      }
      nodeDragStartPosRef.current = null;

      // 优先处理连线模式
      if (e.shiftKey || isCanvasConnecting) {
        console.log('[CanvasView] Connection mode active');
        
        // 使用当前的 React 状态 isCanvasConnecting 和 connectingFromItemId
        if (isCanvasConnecting && connectingFromItemId && connectingFromItemId !== item.id) {
          // 完成连线
          console.log('[CanvasView] Completing connection:', connectingFromItemId, '->', item.id);
          try {
            // 计算目标连接点位置
            const targetCanvasPos = screenToCanvas(e.clientX, e.clientY);
            const targetConnector = calculateConnectorFromMouse(item.positionX, item.positionY, targetCanvasPos.x, targetCanvasPos.y, item.width || CARD_MIN_WIDTH, item.height || CARD_MIN_HEIGHT);
            
            const result = await addCanvasEdge(boardId, connectingFromItemId, item.id, 'custom', connectionStartConnector, targetConnector);
            console.log('[CanvasView] Connection result:', result);
          } catch (err) {
            console.error('[CanvasView] Connection failed:', err);
          }
          setCanvasConnecting(false);
          setTempLineEnd(null);
          setConnectionStartConnector(null);
        } else if (!isCanvasConnecting) {
          // 开始连线
          console.log('[CanvasView] Starting connection from:', item.id);
          // 计算源连接点位置
          const canvasPos = screenToCanvas(e.clientX, e.clientY);
          const connector = calculateConnectorFromMouse(item.positionX, item.positionY, canvasPos.x, canvasPos.y, item.width || CARD_MIN_WIDTH, item.height || CARD_MIN_HEIGHT);
          setConnectionStartConnector(connector);
          setCanvasConnecting(true, item.id);
        } else if (connectingFromItemId === item.id) {
          // 点击同一个卡片，取消连线
          console.log('[CanvasView] Cancelling connection (same card)');
          setCanvasConnecting(false);
          setTempLineEnd(null);
          setConnectionStartConnector(null);
        }
        return;
      }

      // 正常模式处理：抓手模式不能编辑卡片
      if (canvasToolMode === 'hand') {
        return;
      }
      
      if (e.ctrlKey || e.metaKey) {
        toggleCanvasItemSelection(item.id);
        return;
      }

      if (!selectedCanvasItemIds.includes(item.id)) {
        clearCanvasSelection();
      }

      if (item.isLinked && item.creativity && onCardClick) {
        const { creativities } = useCreativityStore.getState();
        const fullCreativity = creativities.find((c: any) => c.id === item.creativityId);
        onCardClick(fullCreativity || item.creativity);
      } else if (!item.isLinked) {
        onCardClick?.({
          id: item.creativityId,
          title: item.title || '',
          content: item.content || '',
          type: item.type || 'text',
          subtype: (item as any).subtype || undefined,
          cardStyle: (item as any).cardStyle || null,
          priority: (item as any).priority || 0,
          emojiReaction: (item as any).emojiReaction || null,
          contentFormat: (item as any).contentFormat || 'markdown',
          isFavorite: (item as any).isFavorite || false,
          tags: [],
          _canvasItemId: item.id,
          _isCanvasLocal: true,
        });
      }
    },
    [boardId, addCanvasEdge, setCanvasConnecting, toggleCanvasItemSelection, onCardClick, selectedCanvasItemIds, clearCanvasSelection, isCanvasConnecting, connectingFromItemId, screenToCanvas, calculateConnectorFromMouse, connectionStartConnector, canvasToolMode]
  );

  // ===== 连线右键菜单 =====
  const CanvasEdgeContextMenu = React.memo(({ state, onClose, onDeleteEdge }: {
    state: { x: number; y: number; edgeId: string } | null;
    onClose: () => void;
    onDeleteEdge: (edgeId: string) => Promise<void>;
  }) => {
    useEffect(() => {
      const handler = () => onClose();
      document.addEventListener('click', handler);
      return () => document.removeEventListener('click', handler);
    }, [onClose]);

    if (!state) return null;

    return (
      <div
        className="canvas-toolbar"
        style={{
          position: 'fixed',
          left: state.x,
          top: state.y,
          zIndex: 900,
          backgroundColor: 'var(--bg-secondary)',
          borderRadius: 8,
          boxShadow: '0 8px 24px rgba(0,0,0,0.2)',
          border: '1px solid var(--border-color)',
          padding: '4px 0',
          minWidth: 160,
        }}
        onMouseDown={(e) => e.stopPropagation()}
      >
        <button
          onClick={() => {
            onDeleteEdge(state.edgeId);
            onClose();
          }}
          style={{
            display: 'flex',
            alignItems: 'center',
            gap: 8,
            width: '100%',
            padding: '8px 16px',
            border: 'none',
            background: 'transparent',
            cursor: 'pointer',
            fontSize: 13,
            color: 'var(--color-danger, #ef4444)',
            textAlign: 'left',
          }}
          onMouseEnter={(e) => {
            (e.currentTarget as HTMLElement).style.backgroundColor = 'var(--bg-hover)';
          }}
          onMouseLeave={(e) => {
            (e.currentTarget as HTMLElement).style.backgroundColor = 'transparent';
          }}
        >
          <Trash2 size={14} />
          删除连线
        </button>
      </div>
    );
  });
  CanvasEdgeContextMenu.displayName = 'CanvasEdgeContextMenu';

  // ===== 节点右键菜单 =====
  const handleNodeContextMenu = useCallback(
    (e: React.MouseEvent, item: BoardCanvasItem) => {
      e.preventDefault();
      e.stopPropagation();
      // 只显示画布自己的右键菜单（包含删除节点），不触发父级的双重菜单
      setContextMenu({ x: e.clientX, y: e.clientY, type: 'node', itemId: item.id });
    },
    []
  );

  // ===== 连接点点击 =====
  const handleConnectorClick = useCallback(
    (e: React.MouseEvent, itemId: string) => {
      e.stopPropagation();
      const { isCanvasConnecting: connecting, connectingFromItemId: fromId } = useBoardStore.getState();
      if (connecting && fromId && fromId !== itemId) {
        addCanvasEdge(boardId, fromId, itemId, 'custom', null, null);
        setCanvasConnecting(false);
        setTempLineEnd(null);
      } else {
        setCanvasConnecting(true, itemId);
      }
    },
    [boardId, addCanvasEdge, setCanvasConnecting]
  );

  // ===== 自定义拖拽放入创意 =====
  const isDraggingItem = useUIStore((s) => s.isDraggingItem);
  const dragItem = useUIStore((s) => s.dragItem);
  const dragPosition = useUIStore((s) => s.dragPosition);
  const endDrag = useUIStore((s) => s.endDrag);
  const dragEnded = useUIStore((s) => s.dragEnded);

  const getCreativityMediaSizeMB = useCallback(async (creativityId: string): Promise<number> => {
    try {
      const mediaFiles = await api.media.listByCreativity(creativityId);
      if (!mediaFiles || !Array.isArray(mediaFiles)) return 0;
      let totalSize = 0;
      for (const file of mediaFiles) {
        if (file.filePath) {
          try {
            const stat = await (window as any).electronAPI?.media?.getFileSize?.(file.filePath);
            if (stat) totalSize += stat;
          } catch {}
        }
      }
      return totalSize / (1024 * 1024);
    } catch {
      return 0;
    }
  }, []);

  const addCreativityToCanvas = useCallback(async (creativity: any, x: number, y: number) => {
    const settings = useSettingsStore.getState().settings;
    const thresholdMB = settings?.canvasImportThreshold ?? 5;
    const overThresholdAction = settings?.canvasImportOverThresholdAction ?? 'prompt';

    let fullCreativity = creativity;
    if (!creativity.subtype && !creativity.cardStyle && !creativity.priority && !creativity.emojiReaction && !creativity.contentFormat && !creativity.content) {
      const { creativities } = useCreativityStore.getState();
      const found = creativities.find((c: any) => c.id === creativity.id);
      if (found) {
        fullCreativity = found;
      } else {
        try {
          const detail = await api.creativity.read(creativity.id);
          if (detail) fullCreativity = detail;
        } catch {}
      }
    }

    const resolvedContent = fullCreativity.mediaFilePath || fullCreativity.content;

    const mediaSizeMB = await getCreativityMediaSizeMB(fullCreativity.id);

    if (mediaSizeMB > thresholdMB) {
      if (overThresholdAction === 'prompt') {
        setImportConfirmData({ creativity: fullCreativity, x, y, mediaSizeMB });
        setImportConfirmOpen(true);
        return;
      } else if (overThresholdAction === 'link') {
        await addCanvasItem(
          boardId, fullCreativity.id, Math.round(x), Math.round(y),
          undefined, undefined,
          fullCreativity.title || null, fullCreativity.content || null, fullCreativity.type || null, true,
          fullCreativity.subtype || null, fullCreativity.cardStyle || null, fullCreativity.priority || 0,
          fullCreativity.emojiReaction || null, fullCreativity.contentFormat || 'markdown'
        );
        return;
      }
    }

    await addCanvasItem(
      boardId, fullCreativity.id, Math.round(x), Math.round(y),
      undefined, undefined,
      fullCreativity.title || null, resolvedContent || null, fullCreativity.type || null, false,
      fullCreativity.subtype || null, fullCreativity.cardStyle || null, fullCreativity.priority || 0,
      fullCreativity.emojiReaction || null, fullCreativity.contentFormat || 'markdown'
    );
  }, [boardId, addCanvasItem, getCreativityMediaSizeMB]);

  const handleImportConfirm = useCallback(async (useSource: boolean) => {
    if (!importConfirmData) return;
    const { creativity, x, y } = importConfirmData;
    setImportConfirmOpen(false);
    setImportConfirmData(null);
    const resolvedContent = !useSource ? (creativity.mediaFilePath || creativity.content) : creativity.content;
    await addCanvasItem(
      boardId, creativity.id, Math.round(x), Math.round(y),
      undefined, undefined,
      creativity.title || null, resolvedContent || null, creativity.type || null, useSource,
      creativity.subtype || null, creativity.cardStyle || null, creativity.priority || 0,
      creativity.emojiReaction || null, creativity.contentFormat || 'markdown'
    );
  }, [importConfirmData, boardId, addCanvasItem]);

  const handleCanvasDrop = useCallback(
    async (e: React.MouseEvent) => {
      if (!isDraggingItem || !dragItem || dragEnded) return;
      e.stopPropagation();
      try {
        const canvasPos = screenToCanvas(e.clientX, e.clientY);
        await addCreativityToCanvas(dragItem, canvasPos.x, canvasPos.y);
      } catch {
        // ignore
      }
      endDrag();
      document.body.style.userSelect = '';
      document.body.style.cursor = '';
    },
    [isDraggingItem, dragItem, screenToCanvas, addCreativityToCanvas, endDrag, dragEnded]
  );

  // ===== 右键菜单（空白处） =====
  const handleCanvasContextMenu = useCallback((e: React.MouseEvent) => {
    e.preventDefault();
    if ((e.target as HTMLElement).closest('.canvas-node-card')) return;
    if ((e.target as HTMLElement).closest('.canvas-connector')) return;
    if ((e.target as HTMLElement).closest('.canvas-toolbar')) return;
    setContextMenu({ x: e.clientX, y: e.clientY, type: 'canvas' });
  }, []);

  // ===== CreativityPicker 选择回调 =====
  const handlePickerSelect = useCallback(
    async (creativity: any) => {
      setPickerOpen(false);
      const centerX = (-offset.x + (containerRef.current?.clientWidth || 800) / 2) / scale;
      const centerY = (-offset.y + (containerRef.current?.clientHeight || 600) / 2) / scale;
      const pos = findNonOverlappingPosition(centerX, centerY);
      await addCreativityToCanvas(creativity, pos.x, pos.y);
    },
    [offset, scale, addCreativityToCanvas, findNonOverlappingPosition]
  );

  // ===== 打包为创意链 =====
  const handleSendToBoard = useCallback(() => {
    if (selectedCanvasItemIds.length < 2) {
      useUIStore.getState().showToast('warning', '请至少选择2个创意卡片来打包');
      return;
    }
    setPackDialogOpen(true);
  }, [selectedCanvasItemIds]);

  // ===== 删除选中 =====
  const handleDeleteSelected = useCallback(async () => {
    for (const itemId of selectedCanvasItemIds) {
      const item = canvasItems.find(i => i.id === itemId);
      if (item) {
        try {
          const relatedEdges = canvasEdges.filter(e => e.sourceItemId === itemId || e.targetItemId === itemId);
          const creativity = item.creativity;
          await api.trash.add({
            itemType: 'canvas-item',
            itemId,
            sourceBoardId: boardId,
            sourceBoardName: currentBoard?.name || '',
            snapshot: {
              creativityId: item.creativityId,
              creativityTitle: creativity?.title || item.title || '',
              positionX: item.positionX,
              positionY: item.positionY,
              width: item.width,
              height: item.height,
              title: item.title,
              content: item.content,
              type: item.type,
              isLinked: item.isLinked,
              edges: relatedEdges.map(e => ({
                sourceItemId: e.sourceItemId === itemId ? 'self' : e.sourceItemId,
                targetItemId: e.targetItemId,
                edgeType: e.edgeType,
                sourceConnector: e.sourceConnector,
                targetConnector: e.targetConnector,
              })),
            },
          });
        } catch {}
      }
      await removeCanvasItem(itemId);
    }
    clearCanvasSelection();
  }, [selectedCanvasItemIds, removeCanvasItem, clearCanvasSelection, canvasItems, canvasEdges, boardId, currentBoard]);

  const handleDeleteNode = useCallback(async () => {
    if (contextMenu?.itemId) {
      const item = canvasItems.find(i => i.id === contextMenu.itemId);
      if (item) {
        try {
          const relatedEdges = canvasEdges.filter(e => e.sourceItemId === contextMenu.itemId || e.targetItemId === contextMenu.itemId);
          const creativity = item.creativity;
          await api.trash.add({
            itemType: 'canvas-item',
            itemId: contextMenu.itemId,
            sourceBoardId: boardId,
            sourceBoardName: currentBoard?.name || '',
            snapshot: {
              creativityId: item.creativityId,
              creativityTitle: creativity?.title || item.title || '',
              positionX: item.positionX,
              positionY: item.positionY,
              width: item.width,
              height: item.height,
              title: item.title,
              content: item.content,
              type: item.type,
              isLinked: item.isLinked,
              mediaFilePath: creativity?.mediaFilePath || item.mediaFilePath,
              thumbnailPath: creativity?.thumbnailPath || item.thumbnailPath,
              edges: relatedEdges.map(e => ({
                sourceItemId: e.sourceItemId === contextMenu.itemId ? 'self' : e.sourceItemId,
                targetItemId: e.targetItemId,
                edgeType: e.edgeType,
                sourceConnector: e.sourceConnector,
                targetConnector: e.targetConnector,
              })),
            },
          });
        } catch {}
      }
      await removeCanvasItem(contextMenu.itemId);
    }
  }, [contextMenu, removeCanvasItem, canvasItems, canvasEdges, boardId, currentBoard]);

  const handleToggleLinked = useCallback(async () => {
    if (!contextMenu?.itemId) return;
    const item = canvasItems.find(i => i.id === contextMenu.itemId);
    if (!item) return;

    const { updateCanvasItemContent } = useBoardStore.getState();

    if (item.isLinked) {
      const creativity = item.creativity;
      const displayTitle = creativity?.title || item.title || '';
      const displayContent = creativity?.mediaFilePath || creativity?.content || item.content || '';
      const displayType = creativity?.type || item.type || 'text';
      const displaySubtype = creativity?.subtype || item.subtype || null;
      const displayCardStyle = creativity?.cardStyle || item.cardStyle || null;
      const displayPriority = creativity?.priority || item.priority || 0;
      const displayEmojiReaction = creativity?.emojiReaction || item.emojiReaction || null;

      try {
        await updateCanvasItemContent(item.id, {
          title: displayTitle,
          content: displayContent,
          type: displayType,
          subtype: displaySubtype,
          cardStyle: displayCardStyle,
          priority: displayPriority,
          emojiReaction: displayEmojiReaction,
          isFavorite: false,
          isLinked: false,
          creativityId: null,
        });
        useUIStore.getState().showToast('success', '已转为独立卡片');
      } catch (err) {
        console.error('[ToggleLinked] 互通→独立失败:', err);
        useUIStore.getState().showToast('error', '转换失败');
      }
    } else {
      const creativityId = item.creativityId;
      const hasOwnContent = !!(item.title || item.content || item.type);
      const creativity = item.creativity;

      if (creativityId && (!hasOwnContent || (creativity && item.title === (creativity.title || '') && item.content === (creativity.mediaFilePath || creativity.content || '') && item.type === (creativity.type || 'text')))) {
        try {
          await updateCanvasItemContent(item.id, { isLinked: true });
          await fetchCanvasData(boardId);
          useUIStore.getState().showToast('success', '已转为互通卡片');
        } catch (err) {
          console.error('[ToggleLinked] 独立→互通失败:', err);
          useUIStore.getState().showToast('error', '转换失败');
        }
      } else {
        Modal.confirm({
          title: creativityId ? '创意已被修改' : '无法直接互通',
          content: creativityId
            ? '该卡片在独立状态下已被修改，无法直接互通回原创意。是否将修改后的内容创建为新创意并互通？'
            : '该独立卡片已与原创意解除关联，无法直接互通回原创意。是否将当前内容创建为新创意并互通？',
          okText: '创建新创意并互通',
          cancelText: '取消',
          onOk: async () => {
            try {
              const itemType = item.type || 'text';
              const isMedia = itemType === 'image' || itemType === 'video' || itemType === 'audio' || itemType === 'document';
              const rawContent = item.content || '';
              const isFilePath = isMedia && rawContent && (
                /^[A-Za-z]:\\/.test(rawContent) ||
                rawContent.startsWith('/') ||
                rawContent.startsWith('local-media://') ||
                rawContent.startsWith('media://')
              );
              const creativityContent = isFilePath ? '' : rawContent;
              const fileName = isFilePath ? (rawContent.split(/[\\/]/).pop() || '') : '';
              
              const { setBatchImportProgress } = useUIStore.getState();
              const totalSteps = isFilePath ? 4 : 2;
              let currentStep = 0;
              
              const updateProgress = (step: number, msg: string) => {
                setBatchImportProgress({
                  visible: true,
                  current: step,
                  total: totalSteps,
                  fileName: msg
                });
              };
              
              try {
                updateProgress(++currentStep, '创建新创意...');
                const newCreativity = await api.creativity.create({
                  title: item.title || '',
                  content: creativityContent,
                  type: itemType,
                  subtype: item.subtype || null,
                  cardStyle: item.cardStyle || null,
                  priority: item.priority || 0,
                  emojiReaction: item.emojiReaction || null,
                  contentFormat: (item as any).contentFormat || 'plain',
                });
                
                if (newCreativity) {
                  if (isFilePath && rawContent) {
                    updateProgress(++currentStep, `正在处理: ${fileName}`);
                    try {
                      let mediaPath = rawContent;
                      if (mediaPath.startsWith('local-media://')) {
                        mediaPath = mediaPath.replace('local-media://', '');
                      } else if (mediaPath.startsWith('media://')) {
                        mediaPath = mediaPath.replace('media://', '');
                      }
                      const ext = mediaPath.includes('.') ? mediaPath.split('.').pop()!.toLowerCase() : '';
                      const fileTypeMap: Record<string, string> = { jpg: 'image', jpeg: 'image', png: 'image', gif: 'image', webp: 'image', bmp: 'image', svg: 'image', mp4: 'video', webm: 'video', avi: 'video', mov: 'video', mkv: 'video', mp3: 'audio', wav: 'audio', ogg: 'audio', flac: 'audio', pdf: 'document', doc: 'document', docx: 'document' };
                      const fileType = fileTypeMap[ext] || itemType;
                      
                      updateProgress(++currentStep, `导入媒体: ${fileName}`);
                      const mediaResult = await api.media.importFromPath(mediaPath, { fileType, fileName });
                      if (mediaResult && mediaResult.success !== false) {
                        const mediaData = mediaResult.data || mediaResult;
                        if (mediaData && mediaData.id) {
                          updateProgress(++currentStep, '关联媒体到创意...');
                          await api.media.linkToCreativity([mediaData.id], newCreativity.id);
                        }
                      }
                    } catch (mediaErr) {
                      console.error('[ToggleLinked] 媒体导入失败:', mediaErr);
                    }
                  } else {
                    updateProgress(++currentStep, '完成');
                  }
                  
                  updateProgress(totalSteps, '更新画布...');
                  await updateCanvasItemContent(item.id, {
                    isLinked: true,
                    creativityId: newCreativity.id,
                    title: null,
                    content: null,
                    type: null,
                    subtype: null,
                    cardStyle: null,
                    priority: 0,
                    emojiReaction: null,
                  });
                  await api.board.addCreativityRelation(boardId, newCreativity.id);
                  await fetchCanvasData(boardId);
                  const { fetchCreativities } = useCreativityStore.getState();
                  await fetchCreativities();
                  useUIStore.getState().showToast('success', '已创建新创意并互通');
                }
              } finally {
                setBatchImportProgress({ visible: false, current: 0, total: 0, fileName: '' });
              }
            } catch {
              useUIStore.getState().setBatchImportProgress({ visible: false, current: 0, total: 0, fileName: '' });
              useUIStore.getState().showToast('error', '转换失败');
            }
          },
        });
      }
    }
  }, [contextMenu, canvasItems, boardId, fetchCanvasData]);

  // ===== 删除连线（右键菜单） =====
  const handleDeleteEdge = useCallback(async (edgeId: string) => {
    await removeCanvasEdge(edgeId);
  }, [removeCanvasEdge]);

  // ===== 自动排列（按子类型分组，仅排列框选的卡片） =====
  const handleAutoArrange = useCallback(async () => {
    const itemsToArrange = selectedCanvasItemIds.length > 0
      ? canvasItems.filter((item) => selectedCanvasItemIds.includes(item.id))
      : canvasItems;

    if (itemsToArrange.length === 0) return;

    const groups: Record<string, BoardCanvasItem[]> = {};
    const noSubtype: BoardCanvasItem[] = [];

    for (const item of itemsToArrange) {
      const subtype = item.creativity?.subtype;
      if (subtype) {
        if (!groups[subtype]) groups[subtype] = [];
        groups[subtype].push(item);
      } else {
        noSubtype.push(item);
      }
    }

    const COL_GAP = 40;
    const ROW_GAP = 30;
    let colIndex = 0;

    const allSubtypes = Object.keys(groups);
    if (noSubtype.length > 0) allSubtypes.push('__none__');

    for (const subtype of allSubtypes) {
      const items = subtype === '__none__' ? noSubtype : groups[subtype];
      const x = 100 + colIndex * (CARD_MIN_WIDTH + COL_GAP);

      for (let row = 0; row < items.length; row++) {
        const y = 100 + row * (CARD_MIN_HEIGHT + ROW_GAP);
        await updateCanvasItemPosition(items[row].id, x, y);
      }

      colIndex++;
    }
  }, [canvasItems, selectedCanvasItemIds, updateCanvasItemPosition]);

  // ===== 打包为创意链 =====
  const handlePackAsChain = useCallback(async (name: string, description?: string) => {
    if (!boardId || selectedCanvasItemIds.length < 2) return;

    try {
      setPacking(true);

      // 1. 获取选中的项目及其位置
      const selectedItems = canvasItems.filter(item => selectedCanvasItemIds.includes(item.id));
      
      // 创建两个 map:
      // - canvas item id -> creativity id
      // - canvas item id -> 在 selectedItems 里的索引（关键！）
      const itemIdToCreativityId = selectedItems.reduce((map, item) => {
        map[item.id] = item.creativityId;
        return map;
      }, {} as Record<string, string>);
      
      const itemIdToIndex = selectedItems.reduce((map, item, index) => {
        map[item.id] = index;
        return map;
      }, {} as Record<string, number>);

      // 2. 获取相关的连线（仅连接两个选中节点的连线）
      const relevantEdges = canvasEdges.filter(edge => 
        selectedCanvasItemIds.includes(edge.sourceItemId) && 
        selectedCanvasItemIds.includes(edge.targetItemId)
      );

      // 3. 构建快照数据
      const snapshot = {
        items: selectedItems.map(item => ({
          creativityId: item.creativityId,
          positionX: item.positionX,
          positionY: item.positionY,
          width: item.width,
          height: item.height,
          videoLoopMode: item.videoLoopMode,
          videoFrozenTime: item.videoFrozenTime,
          creativitySnapshot: item.creativity ? {
            title: item.creativity.title || '',
            content: item.creativity.content || '',
            type: item.creativity.type || 'text',
            subtype: item.creativity.subtype || null,
            contentFormat: item.creativity.contentFormat || 'markdown',
            priority: item.creativity.priority || 0,
            emojiReaction: item.creativity.emojiReaction || null,
            cardStyle: item.creativity.cardStyle || null,
            isFavorite: item.creativity.isFavorite || false,
            mediaFilePath: item.creativity.mediaFilePath || undefined,
            tags: item.creativity.tags?.map(t => typeof t === 'string' ? t : t.name) || [],
          } : undefined,
        })),
        edges: relevantEdges.map(edge => ({
          sourceId: itemIdToCreativityId[edge.sourceItemId] || edge.sourceItemId,
          targetId: itemIdToCreativityId[edge.targetItemId] || edge.targetItemId,
          edgeType: edge.edgeType,
          label: edge.label,
          sourceConnector: edge.sourceConnector,
          targetConnector: edge.targetConnector,
          controlPoints: edge.controlPoints,
          sourceIdx: itemIdToIndex[edge.sourceItemId],
          targetIdx: itemIdToIndex[edge.targetItemId],
        })),
        canvasOffset: offset,
        canvasScale: scale,
      };

      // 4. 创建创意链和便签
      const chainCenterX = (-offset.x + (containerRef.current?.clientWidth || 800) / 2) / scale;
      const chainCenterY = (-offset.y + (containerRef.current?.clientHeight || 600) / 2) / scale;
      const chainPos = findNonOverlappingPosition(chainCenterX, chainCenterY);

      const result = await createChainAndSticky(
        boardId,
        { name, description, snapshot },
        { positionX: chainPos.x, positionY: chainPos.y }
      );

      if (result) {
        // 成功！关闭对话框并清除选择
        setPackDialogOpen(false);
        clearCanvasSelection();
      }

    } catch (error) {
      console.error('打包创意链失败:', error);
    } finally {
      setPacking(false);
    }
  }, [
    boardId,
    canvasItems,
    canvasEdges,
    selectedCanvasItemIds,
    offset,
    scale,
    createChainAndSticky,
    clearCanvasSelection
  ]);

  // ===== 缩放按钮 =====
  const zoomIn = () => {
    const newScale = Math.min(scale + 0.2, 3);
    setScaleState(newScale);
    setCanvasScale(newScale);
  };
  const zoomOut = () => {
    const newScale = Math.max(scale - 0.2, 0.2);
    setScaleState(newScale);
    setCanvasScale(newScale);
  };
  const resetView = () => {
    setScaleState(1);
    setOffsetState({ x: 0, y: 0 });
    setCanvasScale(1);
    setCanvasOffset({ x: 0, y: 0 });
  };

  // ===== 计算框选矩形（屏幕坐标） =====
  const selectionRect = useMemo(() => {
    if (!isSelecting) return null;
    const left = Math.min(selectionStart.x, selectionEnd.x);
    const top = Math.min(selectionStart.y, selectionEnd.y);
    const width = Math.abs(selectionEnd.x - selectionStart.x);
    const height = Math.abs(selectionEnd.y - selectionStart.y);
    return { left, top, width, height };
  }, [isSelecting, selectionStart, selectionEnd]);

  // ===== 连线临时线路径 =====
  const tempLinePath = useMemo(() => {
    if (!isCanvasConnecting || !connectingFromItemId || !tempLineEnd) return null;
    const fromItem = canvasItems.find((i) => i.id === connectingFromItemId);
    if (!fromItem) return null;
    const from = calculateConnectorPosition(fromItem.positionX, fromItem.positionY, connectionStartConnector, 'right', fromItem.width || CARD_MIN_WIDTH, fromItem.height || CARD_MIN_HEIGHT);
    return getEdgePath(from.x, from.y, tempLineEnd.x, tempLineEnd.y);
  }, [isCanvasConnecting, connectingFromItemId, tempLineEnd, canvasItems, connectionStartConnector]);

  // ===== 渲染 =====
  return (
    <div
      ref={containerRef}
      className={
        (canvasToolMode === 'hand' ? (isPanning ? 'cursor-grabbing' : 'cursor-grab') : '') +
        (isCanvasConnecting ? ' cursor-crosshair' : '')
      }
      style={{
        position: 'absolute',
        inset: 0,
        overflow: 'hidden',
        backgroundColor: 'var(--bg-primary)',
        cursor: isDraggingItem ? 'copy' : canvasToolMode === 'hand' ? (isPanning ? 'grabbing' : 'grab') : isCanvasConnecting ? 'crosshair' : 'default',
      }}
      onMouseDown={handleCanvasMouseDown}
      onMouseMove={handleMouseMove}
      onMouseUp={(e) => {
        if (isDraggingItem) {
          handleCanvasDrop(e);
        } else {
          handleMouseUp();
        }
      }}
      onMouseLeave={() => handleMouseUp()}
      onContextMenu={handleCanvasContextMenu}
      onDragOver={handleFileDragOver}
      onDragEnter={handleFileDragEnter}
      onDragLeave={handleFileDragLeave}
      onDrop={handleFileDrop}
    >
      {isFileDragOver && (
        <div style={{
          position: 'absolute', inset: 0, zIndex: 500,
          display: 'flex', alignItems: 'center', justifyContent: 'center',
          background: 'rgba(var(--primary-color-rgb, 99,102,241), 0.08)',
          border: '3px dashed var(--primary-color)',
          pointerEvents: 'none',
        }}>
          <div style={{
            padding: '24px 48px', borderRadius: 16,
            background: 'var(--bg-secondary)', boxShadow: '0 8px 32px rgba(0,0,0,0.15)',
            display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 8,
          }}>
            <Plus size={32} style={{ color: 'var(--primary-color)' }} />
            <span style={{ fontSize: 16, fontWeight: 600, color: 'var(--primary-color)' }}>释放以添加到画布</span>
            <span style={{ fontSize: 12, color: 'var(--text-tertiary)' }}>支持图片、音频、视频、文档文件</span>
          </div>
        </div>
      )}
      {/* ===== 选中操作浮动栏 ===== */}
      {selectedCanvasItemIds.length > 0 && (
        <div
          className="canvas-toolbar"
          onMouseDown={(e) => e.stopPropagation()}
          onClick={(e) => e.stopPropagation()}
          style={{
            position: 'absolute',
            top: 12,
            left: '50%',
            transform: 'translateX(-50%)',
            zIndex: 100,
            display: 'flex',
            alignItems: 'center',
            gap: 8,
            padding: '6px 12px',
            borderRadius: 10,
            backgroundColor: 'rgba(var(--bg-secondary-rgb, 255,255,255), 0.85)',
            backdropFilter: 'blur(12px)',
            border: '1px solid var(--border-color)',
            boxShadow: 'var(--shadow-md)',
          }}
        >
          <button
            onClick={handleAutoArrange}
            style={{
              display: 'flex',
              alignItems: 'center',
              gap: 4,
              padding: '6px 12px',
              borderRadius: 8,
              border: 'none',
              background: 'var(--bg-tertiary)',
              color: 'var(--text-primary)',
              cursor: 'pointer',
              fontSize: 13,
            }}
          >
            <LayoutGrid size={14} />
            排列选中({selectedCanvasItemIds.length})
          </button>
          <button
            onClick={handleSendToBoard}
            style={{
              display: 'flex',
              alignItems: 'center',
              gap: 4,
              padding: '6px 12px',
              borderRadius: 8,
              border: 'none',
              background: 'var(--bg-tertiary)',
              color: 'var(--text-primary)',
              cursor: 'pointer',
              fontSize: 13,
            }}
          >
            <Send size={14} />
            打包创意链
          </button>
          <button
            onClick={handleDeleteSelected}
            style={{
              display: 'flex',
              alignItems: 'center',
              gap: 4,
              padding: '6px 12px',
              borderRadius: 8,
              border: 'none',
              background: 'rgba(239,68,68,0.1)',
              color: '#ef4444',
              cursor: 'pointer',
              fontSize: 13,
            }}
          >
            <Trash2 size={14} />
            删除选中
          </button>
        </div>
      )}

      {/* ===== 画布层 ===== */}
      <div
        ref={canvasRef}
        style={{
          position: 'absolute',
          inset: 0,
          transform: `translate(${offset.x}px, ${offset.y}px) scale(${scale})`,
          transformOrigin: '0 0',
        }}
      >
        {/* 拖拽放置预览指示器 */}
        {isDraggingItem && dragPosition && (
          <div
            style={{
              position: 'absolute',
              left: (dragPosition.x - (containerRef.current?.getBoundingClientRect().left || 0) - offset.x) / scale - 80,
              top: (dragPosition.y - (containerRef.current?.getBoundingClientRect().top || 0) - offset.y) / scale - 30,
              width: 160,
              height: 60,
              borderRadius: 'var(--radius-md, 8px)',
              border: '2px dashed var(--primary-color, #6c63ff)',
              backgroundColor: 'rgba(108, 99, 255, 0.08)',
              pointerEvents: 'none',
              zIndex: 5,
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              fontSize: 12,
              color: 'var(--primary-color, #6c63ff)',
              fontWeight: 500,
              opacity: 0.7,
              transition: 'left 0.05s, top 0.05s',
            }}
          >
            放置到画布
          </div>
        )}
        {/* 点状网格背景 */}
        <div
          style={{
            position: 'absolute',
            inset: -5000,
            pointerEvents: 'none',
            backgroundImage:
              'radial-gradient(circle, var(--border-color) 1px, transparent 1px)',
            backgroundSize: '30px 30px',
          }}
        />

        {/* ===== SVG 连线层（下层：线段，在卡片下方） ===== */}
        <svg
          style={{
            position: 'absolute',
            top: 0,
            left: 0,
            right: 0,
            bottom: 0,
            width: '100%',
            height: '100%',
            pointerEvents: 'none',
            zIndex: 5,
            overflow: 'visible',
          }}
        >
          <defs>
            <marker
              id="arrowhead-related"
              markerWidth="8"
              markerHeight="6"
              refX="8"
              refY="3"
              orient="auto"
            >
              <polygon points="0 0, 8 3, 0 6" fill={EDGE_COLORS.related} />
            </marker>
            <marker
              id="arrowhead-derived"
              markerWidth="8"
              markerHeight="6"
              refX="8"
              refY="3"
              orient="auto"
            >
              <polygon points="0 0, 8 3, 0 6" fill={EDGE_COLORS.derived} />
            </marker>
            <marker
              id="arrowhead-custom"
              markerWidth="8"
              markerHeight="6"
              refX="8"
              refY="3"
              orient="auto"
            >
              <polygon points="0 0, 8 3, 0 6" fill={EDGE_COLORS.custom} />
            </marker>
            <marker
              id="arrowhead-chapter-order"
              markerWidth="8"
              markerHeight="6"
              refX="8"
              refY="3"
              orient="auto"
            >
              <polygon points="0 0, 8 3, 0 6" fill={EDGE_COLORS['chapter-order']} />
            </marker>
            <marker
              id="arrowhead-character-relation"
              markerWidth="8"
              markerHeight="6"
              refX="8"
              refY="3"
              orient="auto"
            >
              <polygon points="0 0, 8 3, 0 6" fill={EDGE_COLORS['character-relation']} />
            </marker>
          </defs>

          {/* 已有连线（非高亮） */}
          {canvasEdges.map((edge) => {
            if (highlightedEdgeId === edge.id) return null;
            const sourceItem = canvasItems.find((i) => i.id === edge.sourceItemId);
            const targetItem = canvasItems.find((i) => i.id === edge.targetItemId);
            if (!sourceItem || !targetItem) return null;
            
            const sourcePos = calculateConnectorPosition(sourceItem.positionX, sourceItem.positionY, edge.sourceConnector, 'right', sourceItem.width || CARD_MIN_WIDTH, sourceItem.height || CARD_MIN_HEIGHT);
            const targetPos = calculateConnectorPosition(targetItem.positionX, targetItem.positionY, edge.targetConnector, 'left', targetItem.width || CARD_MIN_WIDTH, targetItem.height || CARD_MIN_HEIGHT);
            const path = getEdgePath(sourcePos.x, sourcePos.y, targetPos.x, targetPos.y, edge.controlPoints);
            const color = EDGE_COLORS[edge.edgeType] || EDGE_COLORS.related;
            const markerId = `arrowhead-${edge.edgeType}`;

            return (
              <path
                key={edge.id}
                d={path}
                fill="none"
                stroke={color}
                strokeWidth={2}
                markerEnd={`url(#${markerId})`}
                style={{ pointerEvents: 'stroke', cursor: 'pointer' }}
                opacity={0.7}
                onClick={(e) => {
                  e.stopPropagation();
                  e.preventDefault();
                  setHighlightedEdgeId(edge.id);
                }}
                onContextMenu={(e) => {
                  e.preventDefault();
                  e.stopPropagation();
                  setHighlightedEdgeId(edge.id);
                  setEdgeContextMenu({ x: e.clientX, y: e.clientY, edgeId: edge.id });
                }}
              />
            );
          })}

          {/* 临时连线 */}
          {tempLinePath && (
            <path
              d={tempLinePath}
              fill="none"
              stroke={EDGE_COLORS.custom}
              strokeWidth={2}
              strokeDasharray="6 4"
              opacity={0.6}
              style={{ pointerEvents: 'none' }}
            />
          )}
        </svg>

        {/* ===== SVG 上层（控制点 + 高亮线段，在卡片上方） ===== */}
        <svg
          style={{
            position: 'absolute',
            top: 0,
            left: 0,
            right: 0,
            bottom: 0,
            width: '100%',
            height: '100%',
            pointerEvents: 'none',
            zIndex: 15,
            overflow: 'visible',
          }}
        >
          {/* 高亮线段 */}
          {highlightedEdgeId && canvasEdges.filter(edge => edge.id === highlightedEdgeId).map((edge) => {
            const sourceItem = canvasItems.find((i) => i.id === edge.sourceItemId);
            const targetItem = canvasItems.find((i) => i.id === edge.targetItemId);
            if (!sourceItem || !targetItem) return null;
            
            const sourcePos = calculateConnectorPosition(sourceItem.positionX, sourceItem.positionY, edge.sourceConnector, 'right', sourceItem.width || CARD_MIN_WIDTH, sourceItem.height || CARD_MIN_HEIGHT);
            const targetPos = calculateConnectorPosition(targetItem.positionX, targetItem.positionY, edge.targetConnector, 'left', targetItem.width || CARD_MIN_WIDTH, targetItem.height || CARD_MIN_HEIGHT);
            const path = getEdgePath(sourcePos.x, sourcePos.y, targetPos.x, targetPos.y, edge.controlPoints);
            const color = EDGE_COLORS[edge.edgeType] || EDGE_COLORS.related;

            return (
              <g key={edge.id}>
                <path
                  d={path}
                  fill="none"
                  stroke={color}
                  strokeWidth={4}
                  opacity={1}
                  style={{ pointerEvents: 'stroke', cursor: 'pointer', filter: 'drop-shadow(0 0 4px ' + color + ')' }}
                  onClick={(e) => {
                    e.stopPropagation();
                  }}
                  onContextMenu={(e) => {
                    e.preventDefault();
                    e.stopPropagation();
                    setEdgeContextMenu({ x: e.clientX, y: e.clientY, edgeId: edge.id });
                  }}
                />
                {edge.controlPoints?.map((cp) => (
                  <circle
                    key={cp.id}
                    cx={cp.x}
                    cy={cp.y}
                    r={5}
                    fill="white"
                    stroke={color}
                    strokeWidth={2}
                    style={{ cursor: 'move', pointerEvents: 'all' }}
                    onMouseDown={(e) => {
                      e.stopPropagation();
                      e.preventDefault();
                      setDraggingControlPoint({ edgeId: edge.id, cpId: cp.id });
                    }}
                    onContextMenu={(e) => {
                      e.preventDefault();
                      e.stopPropagation();
                      setEdgeControlPointMenu({ x: e.clientX, y: e.clientY, edgeId: edge.id, cpId: cp.id });
                    }}
                  />
                ))}
                {edge.label && editingEdgeId !== edge.id && (
                  <text
                    x={(sourcePos.x + targetPos.x) / 2}
                    y={(sourcePos.y + targetPos.y) / 2 - 8}
                    textAnchor="middle"
                    fontSize={11}
                    fill={color}
                    style={{ pointerEvents: 'all', cursor: 'pointer' }}
                    onMouseDown={(e) => e.stopPropagation()}
                    onDoubleClick={(e) => {
                      e.stopPropagation();
                      setEditingEdgeId(edge.id);
                      setEditingEdgeLabel(edge.label || '');
                      setEditingEdgePos({
                        x: (sourcePos.x + targetPos.x) / 2,
                        y: (sourcePos.y + targetPos.y) / 2 - 8,
                      });
                    }}
                  >
                    {edge.label}
                  </text>
                )}
              </g>
            );
          })}

          {/* 非高亮线段的控制点和标签 */}
          {canvasEdges.filter(edge => edge.id !== highlightedEdgeId).map((edge) => {
            const sourceItem = canvasItems.find((i) => i.id === edge.sourceItemId);
            const targetItem = canvasItems.find((i) => i.id === edge.targetItemId);
            if (!sourceItem || !targetItem) return null;
            
            const sourcePos = calculateConnectorPosition(sourceItem.positionX, sourceItem.positionY, edge.sourceConnector, 'right', sourceItem.width || CARD_MIN_WIDTH, sourceItem.height || CARD_MIN_HEIGHT);
            const targetPos = calculateConnectorPosition(targetItem.positionX, targetItem.positionY, edge.targetConnector, 'left', targetItem.width || CARD_MIN_WIDTH, targetItem.height || CARD_MIN_HEIGHT);
            const color = EDGE_COLORS[edge.edgeType] || EDGE_COLORS.related;

            return (
              <g key={edge.id}>
                {edge.controlPoints?.map((cp) => (
                  <circle
                    key={cp.id}
                    cx={cp.x}
                    cy={cp.y}
                    r={5}
                    fill="white"
                    stroke={color}
                    strokeWidth={2}
                    style={{ cursor: 'move', pointerEvents: 'all' }}
                    onMouseDown={(e) => {
                      e.stopPropagation();
                      e.preventDefault();
                      setDraggingControlPoint({ edgeId: edge.id, cpId: cp.id });
                    }}
                    onContextMenu={(e) => {
                      e.preventDefault();
                      e.stopPropagation();
                      setEdgeControlPointMenu({ x: e.clientX, y: e.clientY, edgeId: edge.id, cpId: cp.id });
                    }}
                  />
                ))}
                {edge.label && editingEdgeId !== edge.id && (
                  <text
                    x={(sourcePos.x + targetPos.x) / 2}
                    y={(sourcePos.y + targetPos.y) / 2 - 8}
                    textAnchor="middle"
                    fontSize={11}
                    fill={color}
                    style={{ pointerEvents: 'all', cursor: 'pointer' }}
                    onMouseDown={(e) => e.stopPropagation()}
                    onDoubleClick={(e) => {
                      e.stopPropagation();
                      setEditingEdgeId(edge.id);
                      setEditingEdgeLabel(edge.label || '');
                      setEditingEdgePos({
                        x: (sourcePos.x + targetPos.x) / 2,
                        y: (sourcePos.y + targetPos.y) / 2 - 8,
                      });
                    }}
                  >
                    {edge.label}
                  </text>
                )}
              </g>
            );
          })}
        </svg>

        {/* ===== 边标签编辑输入框 ===== */}
        {editingEdgeId && (
          <div
            style={{
              position: 'absolute',
              left: editingEdgePos.x - 50,
              top: editingEdgePos.y - 16,
              zIndex: 200,
            }}
          >
            <input
              autoFocus
              value={editingEdgeLabel}
              onChange={(e) => setEditingEdgeLabel(e.target.value)}
              onBlur={() => {
                // 保存标签到 store
                useBoardStore.setState((s) => ({
                  canvasEdges: s.canvasEdges.map((e) =>
                    e.id === editingEdgeId ? { ...e, label: editingEdgeLabel } : e
                  ),
                }));
                setEditingEdgeId(null);
              }}
              onKeyDown={(e) => {
                if (e.key === 'Enter') {
                  useBoardStore.setState((s) => ({
                    canvasEdges: s.canvasEdges.map((ed) =>
                      ed.id === editingEdgeId ? { ...ed, label: editingEdgeLabel } : ed
                    ),
                  }));
                  setEditingEdgeId(null);
                }
                if (e.key === 'Escape') {
                  setEditingEdgeId(null);
                }
              }}
              onMouseDown={(e) => e.stopPropagation()}
              style={{
                width: 100,
                padding: '2px 6px',
                fontSize: 11,
                border: '1px solid var(--primary-color)',
                borderRadius: 4,
                outline: 'none',
                backgroundColor: 'var(--bg-secondary)',
                color: 'var(--text-primary)',
                boxShadow: 'var(--shadow-md)',
              }}
            />
          </div>
        )}

        {/* ===== 节点卡片层 ===== */}
        {canvasItems.map((item) => {
          const isSelected = selectedCanvasItemIds.includes(item.id);
          const isConnectingFrom = isCanvasConnecting && connectingFromItemId === item.id;
          const isLinked = !!item.isLinked;
          const creativity = isLinked ? item.creativity : null;
          const displayTitle = isLinked ? creativity?.title : item.title;
          const displayContent = isLinked ? (creativity?.mediaFilePath || creativity?.content) : item.content;
          const displayType = isLinked ? creativity?.type : (item.type || 'text');
          const displaySubtype = isLinked ? creativity?.subtype : item.subtype;
          const displayEmoji = isLinked ? creativity?.emojiReaction : item.emojiReaction;
          const displayCardStyle = isLinked ? creativity?.cardStyle : item.cardStyle;
          const displayPriority = isLinked ? creativity?.priority : item.priority;
          const itemWidth = item.width || CARD_MIN_WIDTH;
          const itemHeight = item.height || CARD_MIN_HEIGHT;
          const isMediaType = displayType === 'image' || displayType === 'video' || displayType === 'audio' || displayType === 'document';
          const isNaturalSizeMedia = displayType === 'image' || displayType === 'video';
          const hasMediaPath = displayContent && (
            /^[A-Za-z]:\\/.test(displayContent) ||
            displayContent.startsWith('/') ||
            displayContent.startsWith('local-media://') ||
            displayContent.startsWith('media://') ||
            displayContent.startsWith('data:') ||
            displayContent.startsWith('http://') ||
            displayContent.startsWith('https://')
          );

          return (
            <div
              key={item.id}
              id={isNaturalSizeMedia ? `canvas-card-${item.id}` : undefined}
              className={
                "canvas-node-card " +
                (isCanvasConnecting ? "cursor-crosshair " : "")
              }
              style={{
                position: 'absolute',
                left: item.positionX,
                top: item.positionY,
                width: isNaturalSizeMedia ? (item.width ? item.width : 'fit-content') : itemWidth,
                height: isNaturalSizeMedia && item.height ? item.height : undefined,
                minWidth: isNaturalSizeMedia ? CARD_MIN_WIDTH : undefined,
                cursor: isCanvasConnecting ? 'crosshair' : (canvasToolMode === 'hand' && isNaturalSizeMedia) ? (hoveredResizeCursor?.itemId === item.id ? hoveredResizeCursor.cursor : 'grab') : canvasToolMode === 'hand' ? (draggingItemId === item.id ? 'grabbing' : 'grab') : 'pointer',
                zIndex: draggingItemId === item.id ? 100 : isSelected ? 50 : 10,
              }}
              onMouseDown={(e) => handleNodeDragStart(e, item)}
              onMouseMove={(e) => {
                if (canvasToolMode === 'hand' && isNaturalSizeMedia && !draggingItemId && !resizingItemId) {
                  const edge = detectResizeEdge(e, item);
                  const cursor = edge ? getResizeCursor(edge) : 'grab';
                  setHoveredResizeCursor({ itemId: item.id, cursor });
                }
              }}
              onMouseLeave={() => {
                if (canvasToolMode === 'hand' && isNaturalSizeMedia) {
                  setHoveredResizeCursor(null);
                }
              }}
              onClick={(e) => handleNodeClick(e, item)}
              onContextMenu={(e) => handleNodeContextMenu(e, item)}
            >
              <div
                style={{
                  width: '100%',
                  minHeight: CARD_MIN_HEIGHT,
                  borderRadius: 12,
                  backgroundColor: 'var(--bg-secondary)',
                  border: isSelected
                    ? '2px solid var(--primary-color)'
                    : isConnectingFrom
                    ? '2px solid var(--color-success, #22c55e)'
                    : '1px solid var(--border-color)',
                  boxShadow: isSelected
                    ? '0 0 0 3px rgba(var(--primary-color-rgb, 99,102,241), 0.2), var(--shadow-md)'
                    : 'var(--shadow-md)',
                  padding: 16,
                  display: 'flex',
                  flexDirection: 'column',
                  transition: 'border-color 0.2s, box-shadow 0.2s',
                  overflow: 'hidden',
                  position: 'relative',
                }}
              >
                {displaySubtype && getAllSubtypes()[displaySubtype] && (
                  <div
                    style={{
                      position: 'absolute',
                      top: 8,
                      right: 8,
                      width: 20,
                      height: 20,
                      borderRadius: '50%',
                      backgroundColor: getAllSubtypes()[displaySubtype].color,
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'center',
                      fontSize: 10,
                      zIndex: 5,
                    }}
                    title={getAllSubtypes()[displaySubtype].label}
                  >
                    {getAllSubtypes()[displaySubtype].icon}
                  </div>
                )}

                {/* 类型 + 标题行 */}
                <div style={{ display: 'flex', alignItems: 'center', gap: 6, marginBottom: 8 }}>
                  <div
                    style={{
                      width: 24,
                      height: 24,
                      borderRadius: 6,
                      backgroundColor: 'var(--bg-tertiary)',
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'center',
                      color: 'var(--text-tertiary)',
                      flexShrink: 0,
                    }}
                  >
                    {TYPE_ICONS[displayType as keyof typeof TYPE_ICONS] || <Type size={12} />}
                  </div>
                  <span style={{ fontSize: 11, color: 'var(--text-tertiary)', flexShrink: 0 }}>
                    {TYPE_LABELS[displayType as keyof typeof TYPE_LABELS] || '文本'}
                  </span>
                  {displayEmoji && (
                    <span style={{ marginLeft: 'auto', display: 'inline-flex', alignItems: 'center' }}><EmojiIcon id={displayEmoji} size={14} /></span>
                  )}
                </div>

                {/* 标题 */}
                <div
                  style={{
                    fontSize: 14,
                    fontWeight: 600,
                    color: 'var(--text-primary)',
                    lineHeight: 1.4,
                    marginBottom: 6,
                  }}
                >
                  {displayTitle}
                </div>

                {/* 多媒体内容渲染 */}
                {displayType === 'image' && hasMediaPath && (
                  <div style={{ marginTop: 4, borderRadius: 8, overflow: 'hidden' }}>
                    <img
                      src={toMediaUrl(displayContent!)}
                      alt={displayTitle || ''}
                      style={{ display: 'block', width: '100%' }}
                      onDoubleClick={(e) => { e.stopPropagation(); handleNodeClick(e, item); }}
                      onLoad={() => measureAndUpdateCard(item.id)}
                    />
                  </div>
                )}

                {displayType === 'video' && hasMediaPath && (
                  <div style={{ marginTop: 4, borderRadius: 8, overflow: 'hidden', position: 'relative' }}>
                    <CanvasVideoPlayer
                      src={toMediaUrl(displayContent!)}
                      loopMode={item.videoLoopMode || 0}
                      frozenTime={item.videoFrozenTime || 0}
                      onLoopModeChange={(mode) => {
                        const store = useBoardStore.getState();
                        const updateData: any = { videoLoopMode: mode };
                        if (mode === 0) updateData.videoFrozenTime = 0;
                        store.updateCanvasItemContent(item.id, updateData);
                      }}
                      onFrozenTimeChange={(time) => {
                        const store = useBoardStore.getState();
                        store.updateCanvasItemContent(item.id, { videoFrozenTime: time });
                      }}
                      onDoubleClick={(e) => { e.stopPropagation(); handleNodeClick(e, item); }}
                      onLoadedMetadata={() => measureAndUpdateCard(item.id)}
                    />
                  </div>
                )}

                {displayType === 'audio' && hasMediaPath && (
                  <div style={{
                    marginTop: 4, padding: '10px 12px', borderRadius: 8,
                    background: 'linear-gradient(135deg, #4facfe 0%, #00f2fe 100%)',
                    display: 'flex', alignItems: 'center', gap: 10,
                  }}>
                    <div style={{
                      width: 32, height: 32, borderRadius: 8,
                      background: 'rgba(255,255,255,0.25)', display: 'flex',
                      alignItems: 'center', justifyContent: 'center', flexShrink: 0,
                    }}>
                      <Music size={16} style={{ color: 'white' }} />
                    </div>
                    <div style={{ flex: 1, minWidth: 0 }}>
                      <Typography.Text ellipsis style={{ fontSize: 12, color: 'white', fontWeight: 600 }}>
                        {displayTitle || '音频'}
                      </Typography.Text>
                      <audio
                        src={toMediaUrl(displayContent!)}
                        controls
                        style={{ width: '100%', height: 28, marginTop: 4, filter: 'brightness(2)' }}
                      />
                    </div>
                  </div>
                )}

                {displayType === 'document' && hasMediaPath && (
                  <div style={{
                    marginTop: 4, padding: '10px 12px', borderRadius: 8,
                    background: 'linear-gradient(135deg, #a18cd1 0%, #fbc2eb 100%)',
                    display: 'flex', alignItems: 'center', gap: 10,
                  }}>
                    <div style={{
                      width: 32, height: 32, borderRadius: 8,
                      background: 'rgba(255,255,255,0.25)', display: 'flex',
                      alignItems: 'center', justifyContent: 'center', flexShrink: 0,
                    }}>
                      <FileText size={16} style={{ color: 'white' }} />
                    </div>
                    <div style={{ flex: 1, minWidth: 0 }}>
                      <Typography.Text ellipsis style={{ fontSize: 12, color: 'white', fontWeight: 600 }}>
                        {displayTitle || '文档'}
                      </Typography.Text>
                      <div style={{ fontSize: 10, color: 'rgba(255,255,255,0.7)' }}>
                        {getFileNameFromPath(displayContent || '') || '文档文件'}
                      </div>
                    </div>
                  </div>
                )}

                {/* 文本内容 - 完整显示 */}
                {(!isMediaType || !hasMediaPath) && displayContent && (
                  <div
                    style={{
                      fontSize: 12,
                      color: 'var(--text-secondary)',
                      lineHeight: 1.6,
                      maxHeight: 200,
                      overflowY: 'auto',
                      wordBreak: 'break-word',
                    }}
                  >
                    {displayContent}
                  </div>
                )}

                {!displayContent && !hasMediaPath && (
                  <div style={{ fontSize: 12, color: 'var(--text-tertiary)', fontStyle: 'italic' }}>
                    暂无内容
                  </div>
                )}

                {/* 互通卡片角标 */}
                {isLinked && (
                  <div
                    style={{
                      position: 'absolute',
                      bottom: 6,
                      left: 6,
                      display: 'flex',
                      alignItems: 'center',
                      gap: 3,
                      padding: '2px 6px',
                      borderRadius: 4,
                      backgroundColor: 'rgba(59, 130, 246, 0.12)',
                      fontSize: 10,
                      color: '#3b82f6',
                      fontWeight: 600,
                      zIndex: 5,
                    }}
                  >
                    <Link size={9} />
                    互通
                  </div>
                )}
              </div>

              {/* 连线使用的连接点（可拖拽） */}
              {canvasEdges.map((edge) => {
                let connectorPos: { x: number; y: number } | null = null;
                let isSource = false;
                
                if (edge.sourceItemId === item.id && edge.sourceConnector) {
                  connectorPos = calculateConnectorPosition(item.positionX, item.positionY, edge.sourceConnector, 'right', item.width || CARD_MIN_WIDTH, item.height || CARD_MIN_HEIGHT);
                  isSource = true;
                } else if (edge.targetItemId === item.id && edge.targetConnector) {
                  connectorPos = calculateConnectorPosition(item.positionX, item.positionY, edge.targetConnector, 'left', item.width || CARD_MIN_WIDTH, item.height || CARD_MIN_HEIGHT);
                  isSource = false;
                }
                
                if (!connectorPos) return null;
                
                // 计算相对位置
                const relX = connectorPos.x - item.positionX - CONNECTOR_SIZE / 2;
                const relY = connectorPos.y - item.positionY - CONNECTOR_SIZE / 2;
                
                return (
                  <div
                    key={`connector-${edge.id}-${isSource ? 'source' : 'target'}`}
                    className="canvas-connector"
                    onMouseDown={(e) => {
                      if (e.button !== 0) return;
                      
                      e.stopPropagation();
                      e.preventDefault();
                      
                      if (longPressTimerRef.current) {
                        clearTimeout(longPressTimerRef.current);
                        longPressTimerRef.current = null;
                      }
                      
                      pendingConnectorRef.current = {
                        edgeId: edge.id,
                        isSource,
                        itemId: item.id,
                      };
                      
                      longPressTimerRef.current = setTimeout(() => {
                        longPressTimerRef.current = null;
                        if (pendingConnectorRef.current) {
                          setDraggingConnector(pendingConnectorRef.current);
                          pendingConnectorRef.current = null;
                        }
                      }, 300);
                    }}
                    onMouseUp={(e) => {
                      if (e.button !== 0) return;
                      
                      e.stopPropagation();
                      
                      if (longPressTimerRef.current) {
                        clearTimeout(longPressTimerRef.current);
                        longPressTimerRef.current = null;
                      }
                      pendingConnectorRef.current = null;
                      
                      if (draggingConnector) return;
                        
                      setAttachedConnector({
                        edgeId: edge.id,
                        isSource,
                        itemId: item.id,
                      });
                    }}
                    onMouseLeave={(e) => {
                    }}
                    onContextMenu={(e) => {
                      e.preventDefault();
                      e.stopPropagation();
                      
                      if (longPressTimerRef.current) {
                        clearTimeout(longPressTimerRef.current);
                        longPressTimerRef.current = null;
                      }
                      pendingConnectorRef.current = null;
                      if (attachedConnector) setAttachedConnector(null);
                      if (draggingConnector) setDraggingConnector(null);
                      
                      setEdgeContextMenu({ x: e.clientX, y: e.clientY, edgeId: edge.id });
                    }}
                    style={{
                      position: 'absolute',
                      left: relX,
                      top: relY,
                      width: CONNECTOR_SIZE,
                      height: CONNECTOR_SIZE,
                      borderRadius: '50%',
                      backgroundColor: 'var(--primary-color)',
                      border: '2px solid var(--primary-color)',
                      cursor: 'grab',
                      zIndex: 25,
                      opacity: 1,
                      boxShadow: '0 0 8px rgba(var(--primary-color-rgb, 99,102,241), 0.5)',
                    }}
                  />
                );
              })}
            </div>
          );
        })}

        {/* ===== 框选矩形 ===== */}
        {selectionRect && (
          <svg
            style={{
              position: 'absolute',
              left: selectionRect.left,
              top: selectionRect.top,
              width: selectionRect.width,
              height: selectionRect.height,
              pointerEvents: 'none',
              zIndex: 200,
              overflow: 'visible',
            }}
          >
            <rect
              x="0"
              y="0"
              width={selectionRect.width}
              height={selectionRect.height}
              fill="var(--primary-bg)"
              stroke="var(--primary-color)"
              strokeWidth="1.5"
              strokeDasharray="4 4"
              strokeDashoffset="0"
            >
              <animate
                attributeName="stroke-dashoffset"
                from="0"
                to="8"
                dur="0.8s"
                repeatCount="indefinite"
              />
            </rect>
          </svg>
        )}

        {/* ===== 空白引导 ===== */}
        {canvasItems.length === 0 && !isSelecting && (
          <div
            style={{
              position: 'absolute',
              top: '50%',
              left: '50%',
              transform: 'translate(-50%, -50%)',
              textAlign: 'center',
              pointerEvents: 'none',
              zIndex: 1,
            }}
          >
            <div
              style={{
                width: 80,
                height: 80,
                borderRadius: 20,
                backgroundColor: 'var(--bg-tertiary)',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                margin: '0 auto 16px',
              }}
            >
              <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 1408 1024" width={61} height={61}>
                <path fill="var(--text-tertiary)" d="M1089.92 568.832V245.312c59.392 0 105.6-49.536 105.6-105.6 0-56.128-46.208-105.664-105.6-105.664-53.568 0-96.384 40.128-104.32 89.152h-338.112V34.048C644.224 14.208 631.04 1.024 611.2 1.024H33.472a33.088 33.088 0 0 0-32.96 33.024v356.48c0 19.84 13.184 33.024 32.96 33.024h581.056c19.84 0 32.96-13.184 32.96-32.96v-227.84h339.584c8 32.768 32.32 60.8 63.168 74.24v331.84h-257.472c-16.512 0-33.024 16.512-33.024 33.024v214.528H414.272a107.456 107.456 0 0 0-60.544-64.768v-252.16h105.6v-39.552h-270.72v39.616h125.44v244.224c-59.392 0-105.6 49.536-105.6 105.664s49.536 105.6 105.6 105.6c53.952 0 101.76-45.632 105.408-99.008h340.288v102.4c0 19.776 16.512 32.96 33.024 32.96h580.992a33.088 33.088 0 0 0 33.024-33.024v-356.48a33.088 33.088 0 0 0-33.024-33.024h-283.904z m-548.032-208h-439.04a38.144 38.144 0 0 1-39.68-39.616V103.36c0-23.104 16.576-39.616 39.68-39.616h439.04c23.104 0 39.616 16.512 39.616 39.616v217.856a38.144 38.144 0 0 1-39.68 39.68z m-227.84 551.296a62.72 62.72 0 0 1-62.72-62.72c0-36.288 26.432-62.72 62.72-62.72 36.352 0 62.72 26.432 62.72 62.72a62.72 62.72 0 0 1-62.72 62.72zM1027.2 139.648c0-36.288 26.432-62.72 62.72-62.72s62.72 26.432 62.72 62.72c0 36.352-26.368 62.72-62.72 62.72a62.72 62.72 0 0 1-62.72-62.72zM862.08 928.64a38.144 38.144 0 0 1-39.616-39.616v-217.856c0-23.104 16.512-39.68 39.616-39.68h439.04c23.104 0 39.68 16.576 39.68 39.68V892.48c0 23.104-13.248 36.16-36.352 36.16H862.08z"/>
                <path fill="var(--text-tertiary)" opacity=".5" d="M121.344 86.272h405.12a32 32 0 0 1 32 32v189.44a32 32 0 0 1-32 32h-405.12a32 32 0 0 1-32-32v-189.44a32 32 0 0 1 32-32z m165.76 809.408a53.376 53.376 0 1 0 53.376-92.48 53.376 53.376 0 0 0-53.376 92.48zM1089.92 670.208h405.12a32 32 0 0 1 32 32v189.44a32 32 0 0 1-32 32h-405.12a32 32 0 0 1-32-32v-189.44a32 32 0 0 1 32-32z"/>
              </svg>
            </div>
            <div style={{ fontSize: 16, fontWeight: 500, color: 'var(--text-secondary)', marginBottom: 8 }}>
              空白画布
            </div>
            <div style={{ fontSize: 13, color: 'var(--text-tertiary)', lineHeight: 1.6 }}>
              拖拽创意到此处 / 点击工具栏"添加创意" / 右键菜单添加
            </div>
          </div>
        )}
      </div>

      {/* ===== 缩放控制 ===== */}
      <div
        className="canvas-toolbar"
        style={{
          position: 'absolute',
          bottom: 16,
          right: 16,
          display: 'flex',
          alignItems: 'center',
          gap: 4,
          padding: 4,
          borderRadius: 10,
          backgroundColor: 'rgba(var(--bg-secondary-rgb, 255,255,255), 0.85)',
          backdropFilter: 'blur(12px)',
          border: '1px solid var(--border-color)',
          boxShadow: 'var(--shadow-lg)',
          zIndex: 100,
        }}
      >
        {/* 缩小按钮 */}
        <Tooltip title="缩小">
          <motion.button
            onClick={zoomOut}
            whileHover={{ 
              scale: 1.1, 
              backgroundColor: 'var(--bg-hover)',
            }}
            whileTap={{ scale: 0.9 }}
            style={{
              padding: 8,
              borderRadius: 8,
              color: 'var(--text-secondary)',
              display: 'flex',
              alignItems: 'center',
              border: 'none',
              background: 'transparent',
              cursor: 'pointer',
            }}
          >
            <motion.div
              whileTap={{ 
                scale: [1, 0.5, 1.3, 1],
                rotate: [0, -15, 15, 0],
              }}
              transition={{ duration: 0.4 }}
            >
              <ZoomOut size={16} />
            </motion.div>
          </motion.button>
        </Tooltip>
        
        <span
          style={{
            padding: '0 8px',
            fontSize: 12,
            color: 'var(--text-tertiary)',
            minWidth: 48,
            textAlign: 'center',
          }}
        >
          {Math.round(scale * 100)}%
        </span>
        
        {/* 放大按钮 */}
        <Tooltip title="放大">
          <motion.button
            onClick={zoomIn}
            whileHover={{ 
              scale: 1.1, 
              backgroundColor: 'var(--bg-hover)',
            }}
            whileTap={{ scale: 0.9 }}
            style={{
              padding: 8,
              borderRadius: 8,
              color: 'var(--text-secondary)',
              display: 'flex',
              alignItems: 'center',
              border: 'none',
              background: 'transparent',
              cursor: 'pointer',
            }}
          >
            <motion.div
              whileTap={{
                scale: [1, 1.4, 0.8, 1],
                rotate: [0, 10, -10, 0],
              }}
              transition={{ duration: 0.4 }}
            >
              <ZoomIn size={16} />
            </motion.div>
          </motion.button>
        </Tooltip>
        
        <div style={{ width: 1, height: 20, backgroundColor: 'var(--border-color)', margin: '0 2px' }} />
        
        {/* 工具模式切换按钮 */}
        <Tooltip title={canvasToolMode === 'pointer' ? '抓手模式' : '指针模式'}>
          <motion.button
            onClick={() => setCanvasToolMode(canvasToolMode === 'pointer' ? 'hand' : 'pointer')}
            whileHover={{ scale: 1.1, backgroundColor: 'var(--bg-hover)' }}
            whileTap={{ scale: 0.9 }}
            style={{
              padding: 8,
              borderRadius: 8,
              color: canvasToolMode === 'pointer' ? 'var(--primary)' : 'var(--text-secondary)',
              display: 'flex',
              alignItems: 'center',
              border: 'none',
              background: canvasToolMode === 'pointer' ? 'rgba(var(--primary-rgb), 0.1)' : 'transparent',
              cursor: 'pointer',
            }}
          >
            <motion.div
              key={canvasToolMode}
              initial={{ rotate: -180, opacity: 0 }}
              animate={{ rotate: 0, opacity: 1 }}
              transition={{ type: 'spring', stiffness: 400, damping: 15 }}
              whileTap={{ 
                scale: [1, 1.3, 0.8, 1],
                rotate: [0, canvasToolMode === 'pointer' ? 360 : -360, 0],
              }}
            >
              {canvasToolMode === 'pointer' ? <MousePointer size={16} /> : <Move size={16} />}
            </motion.div>
          </motion.button>
        </Tooltip>
        
        {/* 重置视图按钮 */}
        <Tooltip title="重置视图">
          <motion.button
            onClick={resetView}
            whileHover={{ scale: 1.1, backgroundColor: 'var(--bg-hover)' }}
            whileTap={{ scale: 0.9 }}
            style={{
              padding: 8,
              borderRadius: 8,
              color: 'var(--text-secondary)',
              display: 'flex',
              alignItems: 'center',
              border: 'none',
              background: 'transparent',
              cursor: 'pointer',
            }}
          >
            <motion.div
              whileTap={{ 
                scale: [1, 1.4, 0.8, 1],
                rotate: [0, 90, 180, 270, 360],
              }}
              transition={{ duration: 0.5 }}
            >
              <RefreshCw size={16} />
            </motion.div>
          </motion.button>
        </Tooltip>
      </div>

      {/* ===== 底部提示 ===== */}
      <div
        className="canvas-toolbar"
        style={{
          position: 'absolute',
          bottom: 16,
          left: 16,
          fontSize: 12,
          color: 'var(--text-tertiary)',
          display: 'flex',
          alignItems: 'center',
          gap: 4,
          zIndex: 100,
        }}
      >
        {isCanvasConnecting ? (
          <>
            <Link size={12} />
            连线模式：点击目标创意完成连线 | Esc 取消
          </>
        ) : canvasToolMode === 'pointer' ? (
          <>
            <MousePointer size={12} />
            指针模式：点选编辑 | 批量框选 | Shift+点击连线 | Ctrl+滚轮缩放
            <span style={{ marginLeft: '8px' }}>|</span>
            <kbd style={{ 
              display: 'inline-flex', 
              alignItems: 'center', 
              justifyContent: 'center', 
              minWidth: '24px', 
              height: '24px', 
              padding: '0px 6px', 
              borderRadius: 'var(--radius-sm)', 
              backgroundColor: 'var(--bg-tertiary)', 
              color: 'var(--text-secondary)', 
              fontSize: '11px', 
              fontWeight: '600', 
              fontFamily: 'var(--font-family)', 
              border: '1px solid var(--border-color)', 
              boxShadow: '0 1px 0 var(--border-color)', 
              lineHeight: '1',
              marginLeft: '8px'
            }}>Space</kbd>
            切换模式
          </>
        ) : (
          <>
            <Move size={12} />
            抓手模式：画布移动 | 卡片拖拽 | Shift+点击连线 | Ctrl+滚轮缩放
            <span style={{ marginLeft: '8px' }}>|</span>
            <kbd style={{ 
              display: 'inline-flex', 
              alignItems: 'center', 
              justifyContent: 'center', 
              minWidth: '24px', 
              height: '24px', 
              padding: '0px 6px', 
              borderRadius: 'var(--radius-sm)', 
              backgroundColor: 'var(--bg-tertiary)', 
              color: 'var(--text-secondary)', 
              fontSize: '11px', 
              fontWeight: '600', 
              fontFamily: 'var(--font-family)', 
              border: '1px solid var(--border-color)', 
              boxShadow: '0 1px 0 var(--border-color)', 
              lineHeight: '1',
              marginLeft: '8px'
            }}>Space</kbd>
            切换模式
          </>
        )}
      </div>

      {/* ===== 右键菜单 ===== */}
      {contextMenu && (
        <CanvasContextMenu
          state={contextMenu}
          onClose={() => setContextMenu(null)}
          onAddCreativity={() => setPickerOpen(true)}
          onAutoArrange={handleAutoArrange}
          onDeleteNode={handleDeleteNode}
          onToggleLinked={handleToggleLinked}
          isLinked={contextMenu.itemId ? canvasItems.find(i => i.id === contextMenu.itemId)?.isLinked : undefined}
          onPackAsChain={() => {
            setContextMenu(null);
            setPackDialogOpen(true);
          }}
          selectedCount={selectedCanvasItemIds.length}
        />
      )}

      {/* ===== 连线右键菜单 ===== */}
      {edgeContextMenu && (
        <div
          className="canvas-toolbar"
          style={{
            position: 'fixed',
            left: edgeContextMenu.x,
            top: edgeContextMenu.y,
            zIndex: 1000,
            backgroundColor: 'var(--bg-secondary)',
            borderRadius: 8,
            border: '1px solid var(--border-color)',
            boxShadow: 'var(--shadow-lg)',
            padding: 4,
            minWidth: 160,
          }}
          onClick={(e) => e.stopPropagation()}
          onMouseDown={(e) => e.stopPropagation()}
        >
          <div style={{ padding: '6px 12px', fontSize: 12, color: 'var(--text-tertiary)', fontWeight: 600 }}>连线样式</div>
          {Object.entries(EDGE_COLORS).map(([type, color]) => (
            <button
              key={type}
              onClick={() => {
                const newType = type as BoardCanvasEdge['edgeType'];
                useBoardStore.setState((s) => ({
                  canvasEdges: s.canvasEdges.map((e) =>
                    e.id === edgeContextMenu.edgeId ? { ...e, edgeType: newType } : e
                  ),
                }));
                api.board.canvas.updateEdgeType(edgeContextMenu.edgeId, type);
                setEdgeContextMenu(null);
              }}
              style={{
                display: 'flex',
                alignItems: 'center',
                gap: 8,
                width: '100%',
                padding: '6px 12px',
                border: 'none',
                background: 'none',
                cursor: 'pointer',
                fontSize: 13,
                color: 'var(--text-primary)',
                borderRadius: 4,
              }}
              onMouseEnter={(e) => { (e.currentTarget as HTMLElement).style.backgroundColor = 'var(--bg-hover)'; }}
              onMouseLeave={(e) => { (e.currentTarget as HTMLElement).style.backgroundColor = 'transparent'; }}
            >
              <div style={{ width: 16, height: 3, borderRadius: 2, backgroundColor: color }} />
              {type === 'related' ? '关联' : type === 'derived' ? '衍生' : type === 'custom' ? '自定义' : type === 'chapter-order' ? '章节顺序' : '人物关系'}
            </button>
          ))}
          <div style={{ height: 1, backgroundColor: 'var(--border-color)', margin: '4px 0' }} />
          <button
            onClick={async () => {
              const edge = canvasEdges.find((e) => e.id === edgeContextMenu.edgeId);
              if (edge) {
                await removeCanvasEdge(edge.id);
              }
              setEdgeContextMenu(null);
            }}
            style={{
              display: 'flex',
              alignItems: 'center',
              gap: 8,
              width: '100%',
              padding: '6px 12px',
              border: 'none',
              background: 'none',
              cursor: 'pointer',
              fontSize: 13,
              color: '#ef4444',
              borderRadius: 4,
            }}
            onMouseEnter={(e) => { (e.currentTarget as HTMLElement).style.backgroundColor = 'var(--bg-hover)'; }}
            onMouseLeave={(e) => { (e.currentTarget as HTMLElement).style.backgroundColor = 'transparent'; }}
          >
            <Trash2 size={14} />
            删除连线
          </button>
        </div>
      )}

      {edgeControlPointMenu && (
        <div
          className="canvas-toolbar"
          style={{
            position: 'fixed',
            left: edgeControlPointMenu.x,
            top: edgeControlPointMenu.y,
            zIndex: 1000,
            backgroundColor: 'var(--bg-secondary)',
            borderRadius: 8,
            border: '1px solid var(--border-color)',
            boxShadow: 'var(--shadow-lg)',
            padding: 4,
            minWidth: 120,
          }}
          onClick={(e) => e.stopPropagation()}
          onMouseDown={(e) => e.stopPropagation()}
        >
          <button
            onClick={async () => {
              const edge = canvasEdges.find((e) => e.id === edgeControlPointMenu.edgeId);
              if (edge && edge.controlPoints) {
                const updatedCps = edge.controlPoints.filter(cp => cp.id !== edgeControlPointMenu.cpId);
                updateCanvasEdgeControlPoints(edge.id, updatedCps.length > 0 ? updatedCps : null);
              }
              setEdgeControlPointMenu(null);
            }}
            style={{
              display: 'flex',
              alignItems: 'center',
              gap: 8,
              width: '100%',
              padding: '6px 12px',
              border: 'none',
              background: 'none',
              cursor: 'pointer',
              fontSize: 13,
              color: '#ef4444',
              borderRadius: 4,
            }}
            onMouseEnter={(e) => { (e.currentTarget as HTMLElement).style.backgroundColor = 'var(--bg-hover)'; }}
            onMouseLeave={(e) => { (e.currentTarget as HTMLElement).style.backgroundColor = 'transparent'; }}
          >
            <Trash2 size={14} />
            删除控制点
          </button>
        </div>
      )}

      {/* ===== CreativityPicker 弹窗 ===== */}
      <CreativityPicker
        open={pickerOpen}
        onClose={() => setPickerOpen(false)}
        onSelect={handlePickerSelect}
      />

      {/* ===== 打包为创意链弹窗 ===== */}
      <PackAsChainDialog
        open={packDialogOpen}
        onClose={() => setPackDialogOpen(false)}
        onConfirm={handlePackAsChain}
        selectedItems={canvasItems.filter(item => selectedCanvasItemIds.includes(item.id))}
        isLoading={packing}
      />

      {/* ===== 导入确认弹窗 ===== */}
      <ImportConfirmDialog
        open={importConfirmOpen}
        onClose={() => { setImportConfirmOpen(false); setImportConfirmData(null); }}
        onConfirm={handleImportConfirm}
        creativityTitle={importConfirmData?.creativity?.title || ''}
        mediaSizeMB={importConfirmData?.mediaSizeMB || 0}
        thresholdMB={useSettingsStore.getState().settings?.canvasImportThreshold ?? 5}
      />
    </div>
  );
};

export default CanvasView;
