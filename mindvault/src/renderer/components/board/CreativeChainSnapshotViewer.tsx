import React, { useState, useRef, useCallback, useEffect, useMemo } from 'react';
import {
  X,
  Move,
  Minus,
  Plus,
  RefreshCw,
  Type,
  Image,
  Mic,
  Link,
  Video,
  Trash2,
  Save,
  Play,
  FileText,
} from 'lucide-react';
import type { CreativeChainSnapshot, Creativity, ConnectorPosition, ConnectorSide, EdgeControlPoint } from '@shared/types';
import { SUBTYPE_CONFIG, getAllSubtypes } from '@shared/types';
import { api } from '@renderer/utils/api';
import { Tooltip } from 'antd';
import EmojiIcon from '../common/EmojiIcon';
import { toMediaUrl, toThumbnailUrl, isPureMediaContent, getFileNameFromPath } from '@renderer/utils/media';
import { useVideoThumbnail } from '@renderer/hooks/useVideoThumbnail';

const TYPE_ICONS: Record<string, React.ReactNode> = {
  text: <Type size={14} />,
  image: <Image size={14} />,
  audio: <Mic size={14} />,
  link: <Link size={14} />,
  video: <Video size={14} />,
};

const TYPE_LABELS: Record<string, string> = {
  text: '文本',
  image: '图片',
  audio: '音频',
  link: '链接',
  video: '视频',
};

const EDGE_COLORS: Record<string, string> = {
  related: '#9ca3af',
  derived: '#3b82f6',
  custom: '#22c55e',
  'chapter-order': '#6366F1',
  'character-relation': '#EC4899',
};

const TYPE_GRADIENTS: Record<string, string> = {
  text: 'linear-gradient(135deg, #667eea 0%, #764ba2 100%)',
  image: 'linear-gradient(135deg, #f093fb 0%, #f5576c 100%)',
  audio: 'linear-gradient(135deg, #4facfe 0%, #00f2fe 100%)',
  link: 'linear-gradient(135deg, #43e97b 0%, #38f9d7 100%)',
  video: 'linear-gradient(135deg, #fa709a 0%, #fee140 100%)',
  document: 'linear-gradient(135deg, #a18cd1 0%, #fbc2eb 100%)',
};

const SnapshotMediaContent: React.FC<{ creativity: Creativity | undefined }> = ({ creativity }) => {
  const [imgError, setImgError] = useState(false);
  const videoThumbUrl = useVideoThumbnail(creativity?.type || 'text', creativity?.mediaFilePath || creativity?.content);

  if (!creativity) return <div style={{ fontSize: 12, color: 'var(--text-tertiary)', fontStyle: 'italic' }}>暂无内容</div>;

  const mediaPath = creativity.mediaFilePath || creativity.content;
  const hasMediaPath = mediaPath && (
    /^[A-Za-z]:\\/.test(mediaPath) || mediaPath.startsWith('/') ||
    mediaPath.startsWith('local-media://') || mediaPath.startsWith('media://') ||
    mediaPath.startsWith('data:') || mediaPath.startsWith('http://') ||
    mediaPath.startsWith('https://')
  );

  if (creativity.type === 'image' && hasMediaPath && !imgError) {
    return (
      <div style={{ marginTop: 4, borderRadius: 8, overflow: 'hidden' }}>
        <img
          src={toMediaUrl(mediaPath)}
          alt={creativity.title || ''}
          draggable={false}
          onError={() => setImgError(true)}
          style={{ display: 'block', width: '100%' }}
        />
      </div>
    );
  }

  if (creativity.type === 'image' && imgError) {
    return (
      <div style={{
        marginTop: 4, height: 60, borderRadius: 8, overflow: 'hidden',
        display: 'flex', alignItems: 'center', justifyContent: 'center',
        background: TYPE_GRADIENTS.image,
      }}>
        <Image size={20} style={{ color: 'rgba(255,255,255,0.7)' }} />
      </div>
    );
  }

  if (creativity.type === 'video' && hasMediaPath) {
    return (
      <div style={{
        marginTop: 4, borderRadius: 8, overflow: 'hidden', position: 'relative',
        background: videoThumbUrl ? '#000' : TYPE_GRADIENTS.video,
      }}>
        {videoThumbUrl && (
          <img
            src={videoThumbUrl}
            alt=""
            draggable={false}
            style={{ display: 'block', width: '100%' }}
          />
        )}
        <div style={{
          position: 'absolute', top: '50%', left: '50%', transform: 'translate(-50%, -50%)',
          width: 36, height: 36, borderRadius: '50%',
          background: 'rgba(0,0,0,0.45)', backdropFilter: 'blur(2px)',
          display: 'flex', alignItems: 'center', justifyContent: 'center',
        }}>
          <Play size={16} style={{ color: 'white', marginLeft: 2 }} />
        </div>
      </div>
    );
  }

  if (creativity.type === 'audio' && hasMediaPath) {
    return (
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
          <Mic size={16} style={{ color: 'white' }} />
        </div>
        <div style={{ flex: 1, minWidth: 0 }}>
          <div style={{ fontSize: 12, color: 'white', fontWeight: 600, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
            {creativity.title || '音频'}
          </div>
          <audio src={toMediaUrl(mediaPath)} controls style={{ width: '100%', height: 28, marginTop: 4, filter: 'brightness(2)' }} />
        </div>
      </div>
    );
  }

  if (creativity.type === 'document' && hasMediaPath) {
    return (
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
          <div style={{ fontSize: 12, color: 'white', fontWeight: 600, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
            {creativity.title || '文档'}
          </div>
          <div style={{ fontSize: 10, color: 'rgba(255,255,255,0.7)' }}>
            {getFileNameFromPath(mediaPath) || '文档文件'}
          </div>
        </div>
      </div>
    );
  }

  if (!hasMediaPath && creativity.content && !isPureMediaContent(creativity.content)) {
    return (
      <div style={{
        fontSize: 12, color: 'var(--text-secondary)', lineHeight: 1.6,
        maxHeight: 200, overflowY: 'auto', wordBreak: 'break-word',
      }}>
        {creativity.content}
      </div>
    );
  }

  if (!creativity.content && !hasMediaPath) {
    return <div style={{ fontSize: 12, color: 'var(--text-tertiary)', fontStyle: 'italic' }}>暂无内容</div>;
  }

  return null;
};

const CARD_WIDTH = 240;
const CARD_HEIGHT = 140;
const CONNECTOR_SIZE = 12;

function calculateConnectorPosition(
  itemX: number,
  itemY: number,
  itemWidth: number,
  itemHeight: number,
  connector?: ConnectorPosition | null,
  defaultSide: ConnectorSide = 'right'
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
  controlPoints?: EdgeControlPoint[] | null
): string {
  if (!controlPoints || controlPoints.length === 0) {
    const dx = Math.abs(targetX - sourceX);
    const dy = Math.abs(targetY - sourceY);
    const controlOffset = Math.max(50, Math.max(dx, dy) * 0.4);
    return `M ${sourceX} ${sourceY} C ${sourceX + controlOffset} ${sourceY}, ${targetX - controlOffset} ${targetY}, ${targetX} ${targetY}`;
  }
  const points = [{ x: sourceX, y: sourceY }, ...controlPoints.map(cp => ({ x: cp.x, y: cp.y })), { x: targetX, y: targetY }];
  let path = `M ${sourceX} ${sourceY}`;
  for (let i = 1; i < points.length; i++) {
    const prev = points[i - 1];
    const curr = points[i];
    const dx = Math.abs(curr.x - prev.x);
    const dy = Math.abs(curr.y - prev.y);
    const offset = Math.max(30, Math.max(dx, dy) * 0.3);
    if (prev.x < curr.x) {
      path += ` C ${prev.x + offset} ${prev.y}, ${curr.x - offset} ${curr.y}, ${curr.x} ${curr.y}`;
    } else {
      path += ` C ${prev.x - offset} ${prev.y}, ${curr.x + offset} ${curr.y}, ${curr.x} ${curr.y}`;
    }
  }
  return path;
}

const truncateText = (text: string, maxLength: number): string => {
  if (text.length <= maxLength) return text;
  return text.slice(0, maxLength - 3) + '...';
};

interface LocalCanvasItem {
  id: string;
  creativityId: string;
  positionX: number;
  positionY: number;
  width: number;
  height: number;
  videoLoopMode?: number;
  videoFrozenTime?: number;
}

interface LocalCanvasEdge {
  id: string;
  sourceItemId: string;
  targetItemId: string;
  edgeType: string;
  label: string | null;
  sourceConnector: ConnectorPosition | null;
  targetConnector: ConnectorPosition | null;
  controlPoints?: EdgeControlPoint[] | null;
}

interface CreativeChainSnapshotViewerProps {
  open: boolean;
  onClose: () => void;
  snapshot: CreativeChainSnapshot;
  title: string;
  description?: string;
  creativityMap: Record<string, Creativity>;
  boardId: string;
  creativeChainId: string;
  onSave?: (snapshot: CreativeChainSnapshot) => void;
}

const CreativeChainSnapshotViewer: React.FC<CreativeChainSnapshotViewerProps> = ({
  open,
  onClose,
  snapshot,
  title,
  description,
  creativityMap,
  boardId,
  creativeChainId,
  onSave,
}) => {
  const [scale, setScale] = useState(1);
  const [offset, setOffset] = useState({ x: 0, y: 0 });
  const [isPanning, setIsPanning] = useState(false);
  const [panStart, setPanStart] = useState({ x: 0, y: 0 });

  const [items, setItems] = useState<LocalCanvasItem[]>([]);
  const [edges, setEdges] = useState<LocalCanvasEdge[]>([]);

  const [draggingItemId, setDraggingItemId] = useState<string | null>(null);
  const [dragOffset, setDragOffset] = useState({ x: 0, y: 0 });

  const [selectedItemIds, setSelectedItemIds] = useState<string[]>([]);
  const [isSelecting, setIsSelecting] = useState(false);
  const [selectionStart, setSelectionStart] = useState({ x: 0, y: 0 });
  const [selectionEnd, setSelectionEnd] = useState({ x: 0, y: 0 });

  const [isConnecting, setIsConnecting] = useState(false);
  const [connectingFromId, setConnectingFromId] = useState<string | null>(null);
  const [connectionStartConnector, setConnectionStartConnector] = useState<ConnectorPosition | null>(null);
  const [tempLineEnd, setTempLineEnd] = useState<{ x: number; y: number } | null>(null);

  const [contextMenu, setContextMenu] = useState<{ x: number; y: number; itemId?: string } | null>(null);
  const [edgeContextMenu, setEdgeContextMenu] = useState<{ x: number; y: number; edgeId: string } | null>(null);
  const [editingEdgeId, setEditingEdgeId] = useState<string | null>(null);
  const [editingEdgeLabel, setEditingEdgeLabel] = useState('');
  const [editingEdgePos, setEditingEdgePos] = useState({ x: 0, y: 0 });

  const [canvasToolMode, setCanvasToolMode] = useState<'hand' | 'pointer'>('hand');
  const [saving, setSaving] = useState(false);

  const containerRef = useRef<HTMLDivElement>(null);
  const spaceLongPressTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const isSpaceLongPressRef = useRef(false);
  const originalCanvasModeRef = useRef<'hand' | 'pointer'>(canvasToolMode);

  // ===== 从 snapshot 还原数据 =====
  useEffect(() => {
    if (open && snapshot) {
      const restoredItems: LocalCanvasItem[] = snapshot.items.map((item, idx) => ({
        id: `item-${idx}`,
        creativityId: item.creativityId,
        positionX: item.positionX,
        positionY: item.positionY,
        width: item.width || CARD_WIDTH,
        height: item.height || CARD_HEIGHT,
        videoLoopMode: item.videoLoopMode,
        videoFrozenTime: item.videoFrozenTime,
      }));

      const creativityIdToItemId: Record<string, string> = {};
      snapshot.items.forEach((item, idx) => {
        const key = `${item.creativityId}-${idx}`;
        creativityIdToItemId[key] = `item-${idx}`;
      });

      const restoredEdges: LocalCanvasEdge[] = snapshot.edges.map((edge, idx) => {
        // 优先使用 snapshot.edges 里的 sourceIdx/targetIdx（绝对可靠！）
        let sourceItemId: string;
        let targetItemId: string;
        
        if (edge.sourceIdx !== undefined && edge.sourceIdx >= 0 && edge.sourceIdx < snapshot.items.length) {
          sourceItemId = `item-${edge.sourceIdx}`;
        } else {
          const sourceIdx = snapshot.items.findIndex(i => i.creativityId === edge.sourceId);
          sourceItemId = sourceIdx >= 0 ? `item-${sourceIdx}` : edge.sourceId;
        }
        
        if (edge.targetIdx !== undefined && edge.targetIdx >= 0 && edge.targetIdx < snapshot.items.length) {
          targetItemId = `item-${edge.targetIdx}`;
        } else {
          const targetIdx = snapshot.items.findIndex(i => i.creativityId === edge.targetId);
          targetItemId = targetIdx >= 0 ? `item-${targetIdx}` : edge.targetId;
        }
        
        return {
          id: `edge-${idx}`,
          sourceItemId,
          targetItemId,
          edgeType: edge.edgeType,
          label: edge.label || null,
          sourceConnector: edge.sourceConnector || null,
          targetConnector: edge.targetConnector || null,
          controlPoints: edge.controlPoints || null,
        };
      });

      setItems(restoredItems);
      setEdges(restoredEdges);
      setSelectedItemIds([]);

      if (snapshot.canvasOffset) {
        setOffset(snapshot.canvasOffset);
      } else if (restoredItems.length > 0) {
        const minX = Math.min(...restoredItems.map(i => i.positionX));
        const maxX = Math.max(...restoredItems.map(i => i.positionX + CARD_WIDTH));
        const minY = Math.min(...restoredItems.map(i => i.positionY));
        const maxY = Math.max(...restoredItems.map(i => i.positionY + CARD_HEIGHT));
        const centerX = (minX + maxX) / 2;
        const centerY = (minY + maxY) / 2;
        setOffset({ x: 600 - centerX * 0.75, y: 400 - centerY * 0.75 });
      }

      setScale(snapshot.canvasScale || 0.75);
    }
  }, [open, snapshot]);

  // ===== 坐标转换 =====
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

  // ===== 计算鼠标在卡片边框上的位置 =====
  const calculateConnectorFromMouse = useCallback(
    (itemX: number, itemY: number, itemWidth: number, itemHeight: number, mouseCanvasX: number, mouseCanvasY: number): ConnectorPosition => {
      const relativeX = Math.max(0, Math.min(itemWidth, mouseCanvasX - itemX));
      const relativeY = Math.max(0, Math.min(itemHeight, mouseCanvasY - itemY));

      const distLeft = Math.abs(mouseCanvasX - itemX);
      const distRight = Math.abs(mouseCanvasX - (itemX + itemWidth));
      const distTop = Math.abs(mouseCanvasY - itemY);
      const distBottom = Math.abs(mouseCanvasY - (itemY + itemHeight));
      const minDist = Math.min(distLeft, distRight, distTop, distBottom);

      let side: ConnectorSide;
      let offsetVal: number;

      if (minDist === distLeft) {
        side = 'left';
        offsetVal = Math.max(0, Math.min(1, (mouseCanvasY - itemY) / itemHeight));
      } else if (minDist === distRight) {
        side = 'right';
        offsetVal = Math.max(0, Math.min(1, (mouseCanvasY - itemY) / itemHeight));
      } else if (minDist === distTop) {
        side = 'top';
        offsetVal = Math.max(0, Math.min(1, (mouseCanvasX - itemX) / itemWidth));
      } else {
        side = 'bottom';
        offsetVal = Math.max(0, Math.min(1, (mouseCanvasX - itemX) / itemWidth));
      }

      return { side, offset: offsetVal, relativeX, relativeY };
    },
    []
  );

  // ===== 鼠标平移 =====
  const handleCanvasMouseDown = useCallback(
    (e: React.MouseEvent) => {
      if ((e.target as HTMLElement).closest('.canvas-node-card')) return;
      if ((e.target as HTMLElement).closest('.canvas-connector')) return;
      if ((e.target as HTMLElement).closest('.snapshot-toolbar')) return;

      if (contextMenu || edgeContextMenu) {
        setContextMenu(null);
        setEdgeContextMenu(null);
        return;
      }

      if (isConnecting) {
        setIsConnecting(false);
        setTempLineEnd(null);
        setConnectionStartConnector(null);
        return;
      }

      if (canvasToolMode === 'hand') {
        setSelectedItemIds([]);
        setIsPanning(true);
        setPanStart({ x: e.clientX - offset.x, y: e.clientY - offset.y });
      } else if (canvasToolMode === 'pointer') {
        const canvasPos = screenToCanvas(e.clientX, e.clientY);
        setIsSelecting(true);
        setSelectionStart(canvasPos);
        setSelectionEnd(canvasPos);
        setSelectedItemIds([]);
      }
    },
    [offset, canvasToolMode, screenToCanvas, isConnecting, contextMenu, edgeContextMenu]
  );

  // ===== mousemove =====
  const handleMouseMove = useCallback(
    (e: React.MouseEvent) => {
      if (isPanning) {
        setOffset({ x: e.clientX - panStart.x, y: e.clientY - panStart.y });
      }

      if (isSelecting) {
        const canvasPos = screenToCanvas(e.clientX, e.clientY);
        setSelectionEnd(canvasPos);
      }

      if (draggingItemId) {
        const canvasPos = screenToCanvas(e.clientX, e.clientY);
        const dx = canvasPos.x - dragOffset.x - (items.find(i => i.id === draggingItemId)?.positionX || 0);
        const dy = canvasPos.y - dragOffset.y - (items.find(i => i.id === draggingItemId)?.positionY || 0);

        if (selectedItemIds.length > 1 && selectedItemIds.includes(draggingItemId)) {
          setItems(prev => prev.map(item => {
            if (selectedItemIds.includes(item.id)) {
              return { ...item, positionX: Math.round(item.positionX + dx), positionY: Math.round(item.positionY + dy) };
            }
            return item;
          }));
        } else {
          const x = canvasPos.x - dragOffset.x;
          const y = canvasPos.y - dragOffset.y;
          setItems(prev => prev.map(item =>
            item.id === draggingItemId ? { ...item, positionX: Math.round(x), positionY: Math.round(y) } : item
          ));
        }
      }

      if (isConnecting && connectingFromId) {
        const canvasPos = screenToCanvas(e.clientX, e.clientY);
        setTempLineEnd(canvasPos);
      }
    },
    [isPanning, panStart, isSelecting, draggingItemId, dragOffset, screenToCanvas, items, selectedItemIds, isConnecting, connectingFromId]
  );

  // ===== mouseup =====
  const handleMouseUp = useCallback(() => {
    if (isSelecting) {
      const left = Math.min(selectionStart.x, selectionEnd.x);
      const top = Math.min(selectionStart.y, selectionEnd.y);
      const right = Math.max(selectionStart.x, selectionEnd.x);
      const bottom = Math.max(selectionStart.y, selectionEnd.y);

      if (right - left > 5 || bottom - top > 5) {
        const newSelected: string[] = [];
        items.forEach(item => {
          if (item.positionX < right && item.positionX + CARD_WIDTH > left &&
              item.positionY < bottom && item.positionY + CARD_HEIGHT > top) {
            newSelected.push(item.id);
          }
        });
        setSelectedItemIds(newSelected);
      }
    }

    setIsPanning(false);
    setDraggingItemId(null);
    setIsSelecting(false);
  }, [isSelecting, selectionStart, selectionEnd, items]);

  // ===== 滚轮缩放 =====
  useEffect(() => {
    const el = containerRef.current;
    if (!el) return;
    const handler = (e: WheelEvent) => {
      e.preventDefault();
      const delta = e.deltaY > 0 ? -0.1 : 0.1;
      setScale(s => Math.max(0.2, Math.min(3, s + delta)));
    };
    el.addEventListener('wheel', handler, { passive: false });
    return () => el.removeEventListener('wheel', handler);
  }, [open]);

  // ===== 节点拖拽开始 =====
  const handleNodeDragStart = useCallback(
    (e: React.MouseEvent, item: LocalCanvasItem) => {
      if (contextMenu || edgeContextMenu) return;
      if (e.button !== 0) return;
      if (isConnecting || e.shiftKey) return;
      if (canvasToolMode === 'pointer') return;

      e.stopPropagation();
      e.preventDefault();
      const canvasPos = screenToCanvas(e.clientX, e.clientY);
      setDraggingItemId(item.id);
      setDragOffset({ x: canvasPos.x - item.positionX, y: canvasPos.y - item.positionY });

      if (!selectedItemIds.includes(item.id)) {
        setSelectedItemIds([item.id]);
      }
    },
    [screenToCanvas, canvasToolMode, selectedItemIds, isConnecting, contextMenu, edgeContextMenu]
  );

  // ===== 节点点击 =====
  const handleNodeClick = useCallback(
    (e: React.MouseEvent, item: LocalCanvasItem) => {
      e.stopPropagation();

      if (e.shiftKey || isConnecting) {
        if (isConnecting && connectingFromId && connectingFromId !== item.id) {
          const targetCanvasPos = screenToCanvas(e.clientX, e.clientY);
          const targetConnector = calculateConnectorFromMouse(item.positionX, item.positionY, item.width, item.height, targetCanvasPos.x, targetCanvasPos.y);
          const newEdge: LocalCanvasEdge = {
            id: `edge-${Date.now()}`,
            sourceItemId: connectingFromId,
            targetItemId: item.id,
            edgeType: 'custom',
            label: null,
            sourceConnector: connectionStartConnector,
            targetConnector,
          };
          setEdges(prev => [...prev, newEdge]);
          setIsConnecting(false);
          setTempLineEnd(null);
          setConnectionStartConnector(null);
        } else if (!isConnecting) {
          const canvasPos = screenToCanvas(e.clientX, e.clientY);
          const connector = calculateConnectorFromMouse(item.positionX, item.positionY, item.width, item.height, canvasPos.x, canvasPos.y);
          setConnectionStartConnector(connector);
          setIsConnecting(true);
          setConnectingFromId(item.id);
        } else if (connectingFromId === item.id) {
          setIsConnecting(false);
          setTempLineEnd(null);
          setConnectionStartConnector(null);
        }
        return;
      }

      if (canvasToolMode === 'hand') return;

      if (e.ctrlKey || e.metaKey) {
        setSelectedItemIds(prev =>
          prev.includes(item.id) ? prev.filter(id => id !== item.id) : [...prev, item.id]
        );
      } else {
        setSelectedItemIds([item.id]);
      }
    },
    [isConnecting, connectingFromId, screenToCanvas, calculateConnectorFromMouse, connectionStartConnector, canvasToolMode]
  );

  // ===== 节点右键菜单 =====
  const handleNodeContextMenu = useCallback((e: React.MouseEvent, item: LocalCanvasItem) => {
    e.preventDefault();
    e.stopPropagation();
    setContextMenu({ x: e.clientX, y: e.clientY, itemId: item.id });
  }, []);

  // ===== 连线右键菜单 =====
  const handleEdgeContextMenu = useCallback((e: React.MouseEvent, edgeId: string) => {
    e.preventDefault();
    e.stopPropagation();
    setEdgeContextMenu({ x: e.clientX, y: e.clientY, edgeId });
  }, []);

  // ===== 删除节点 =====
  const handleDeleteNode = useCallback((itemId: string) => {
    setItems(prev => prev.filter(i => i.id !== itemId));
    setEdges(prev => prev.filter(e => e.sourceItemId !== itemId && e.targetItemId !== itemId));
    setSelectedItemIds(prev => prev.filter(id => id !== itemId));
    setContextMenu(null);
  }, []);

  // ===== 删除连线 =====
  const handleDeleteEdge = useCallback((edgeId: string) => {
    setEdges(prev => prev.filter(e => e.id !== edgeId));
    setEdgeContextMenu(null);
  }, []);

  // ===== 修改连线标签 =====
  const handleEdgeLabelSubmit = useCallback(() => {
    if (editingEdgeId) {
      setEdges(prev => prev.map(e =>
        e.id === editingEdgeId ? { ...e, label: editingEdgeLabel || null } : e
      ));
      setEditingEdgeId(null);
    }
  }, [editingEdgeId, editingEdgeLabel]);

  // ===== ESC 键 =====
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        if (isConnecting) {
          setIsConnecting(false);
          setTempLineEnd(null);
          setConnectionStartConnector(null);
        }
        if (contextMenu) setContextMenu(null);
        if (edgeContextMenu) setEdgeContextMenu(null);
        if (editingEdgeId) setEditingEdgeId(null);
      }
      if (e.key === 'Delete' || e.key === 'Backspace') {
        if (editingEdgeId) return;
        if (selectedItemIds.length > 0) {
          setItems(prev => prev.filter(i => !selectedItemIds.includes(i.id)));
          setEdges(prev => prev.filter(e =>
            !selectedItemIds.includes(e.sourceItemId) && !selectedItemIds.includes(e.targetItemId)
          ));
          setSelectedItemIds([]);
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
  }, [isConnecting, contextMenu, edgeContextMenu, editingEdgeId, selectedItemIds, canvasToolMode, setCanvasToolMode]);

  // ===== 点击空白处关闭菜单 =====
  useEffect(() => {
    if (contextMenu || edgeContextMenu) {
      const handler = () => {
        setContextMenu(null);
        setEdgeContextMenu(null);
      };
      document.addEventListener('click', handler);
      return () => document.removeEventListener('click', handler);
    }
  }, [contextMenu, edgeContextMenu]);

  // ===== 保存快照 =====
  const handleSave = useCallback(async () => {
    try {
      setSaving(true);

      const itemIdToCreativityId: Record<string, string> = {};
      const itemIdToIndex: Record<string, number> = {}; // 关键！
      items.forEach((item, index) => {
        itemIdToCreativityId[item.id] = item.creativityId;
        itemIdToIndex[item.id] = index;
      });

      const newSnapshot: CreativeChainSnapshot = {
        items: items.map(item => ({
          creativityId: item.creativityId,
          positionX: item.positionX,
          positionY: item.positionY,
          width: item.width,
          height: item.height,
          videoLoopMode: item.videoLoopMode,
          videoFrozenTime: item.videoFrozenTime,
        })),
        edges: edges.map(edge => ({
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

      await api.board.creativeChain.update(boardId, creativeChainId, { snapshot: newSnapshot });
      onSave?.(newSnapshot);
    } catch (error) {
      console.error('保存快照失败:', error);
    } finally {
      setSaving(false);
    }
  }, [items, edges, offset, scale, boardId, creativeChainId, onSave]);

  // ===== 缩放函数 =====
  const zoomIn = useCallback(() => setScale(s => Math.min(s + 0.1, 3)), []);
  const zoomOut = useCallback(() => setScale(s => Math.max(s - 0.1, 0.2)), []);
  const resetView = useCallback(() => {
    if (items.length > 0) {
      const minX = Math.min(...items.map(i => i.positionX));
      const maxX = Math.max(...items.map(i => i.positionX + CARD_WIDTH));
      const minY = Math.min(...items.map(i => i.positionY));
      const maxY = Math.max(...items.map(i => i.positionY + CARD_HEIGHT));
      const centerX = (minX + maxX) / 2;
      const centerY = (minY + maxY) / 2;
      setScale(0.75);
      setOffset({ x: 600 - centerX * 0.75, y: 400 - centerY * 0.75 });
    }
  }, [items]);

  // ===== 连接点位置计算 =====
  const getConnectorPositions = useCallback((item: LocalCanvasItem) => {
    const positions: Array<{ edgeId: string; isSource: boolean; connector: ConnectorPosition }> = [];
    edges.forEach(edge => {
      if (edge.sourceItemId === item.id && edge.sourceConnector) {
        positions.push({ edgeId: edge.id, isSource: true, connector: edge.sourceConnector });
      }
      if (edge.targetItemId === item.id && edge.targetConnector) {
        positions.push({ edgeId: edge.id, isSource: false, connector: edge.targetConnector });
      }
    });
    return positions;
  }, [edges]);

  if (!open) return null;

  return (
    <div
      style={{
        position: 'fixed',
        inset: 0,
        zIndex: 9999,
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        backgroundColor: 'rgba(0,0,0,0.6)',
        backdropFilter: 'blur(4px)',
      }}
      onClick={onClose}
    >
      <div
        style={{
          backgroundColor: 'var(--bg-secondary)',
          borderRadius: 16,
          boxShadow: '0 20px 60px rgba(0,0,0,0.4)',
          border: '1px solid var(--border-color)',
          width: 1200,
          maxWidth: '95vw',
          height: 800,
          overflow: 'hidden',
          display: 'flex',
          flexDirection: 'column',
        }}
        onClick={(e) => e.stopPropagation()}
      >
        {/* ===== 顶部栏 ===== */}
        <div
          style={{
            padding: '12px 20px',
            borderBottom: '1px solid var(--border-light)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
            flexShrink: 0,
            backgroundColor: 'var(--bg-secondary)',
          }}
        >
          <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
            <div
              style={{
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                width: 32,
                height: 32,
                borderRadius: 8,
                background: 'var(--primary-color)',
                color: 'white',
              }}
            >
              <Move size={16} />
            </div>
            <div>
              <h2 style={{ fontSize: 16, fontWeight: 600, color: 'var(--text-primary)', margin: 0 }}>
                {title}
              </h2>
              {description && (
                <p style={{ fontSize: 12, color: 'var(--text-tertiary)', margin: '2px 0 0 0' }}>
                  {description}
                </p>
              )}
            </div>
          </div>
          <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
            <button
              onClick={handleSave}
              disabled={saving}
              style={{
                display: 'flex',
                alignItems: 'center',
                gap: 6,
                padding: '6px 14px',
                borderRadius: 8,
                border: 'none',
                background: saving ? 'var(--border-color)' : 'var(--primary-color)',
                color: saving ? 'var(--text-tertiary)' : 'white',
                cursor: saving ? 'not-allowed' : 'pointer',
                fontSize: 13,
                fontWeight: 500,
                transition: 'all 0.15s',
              }}
            >
              <Save size={14} />
              {saving ? '保存中...' : '保存'}
            </button>
            <button
              onClick={onClose}
              style={{
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                width: 32,
                height: 32,
                borderRadius: 8,
                border: 'none',
                background: 'transparent',
                color: 'var(--text-secondary)',
                cursor: 'pointer',
                transition: 'all 0.15s',
              }}
              onMouseEnter={(e) => {
                e.currentTarget.style.background = 'var(--bg-tertiary)';
                e.currentTarget.style.color = 'var(--text-primary)';
              }}
              onMouseLeave={(e) => {
                e.currentTarget.style.background = 'transparent';
                e.currentTarget.style.color = 'var(--text-secondary)';
              }}
            >
              <X size={18} />
            </button>
          </div>
        </div>

        {/* ===== 工具栏 ===== */}
        <div
          className="snapshot-toolbar"
          style={{
            padding: '8px 20px',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
            gap: 8,
            borderBottom: '1px solid var(--border-light)',
            flexShrink: 0,
            backgroundColor: 'var(--bg-secondary)',
          }}
        >
          <div style={{ display: 'flex', alignItems: 'center', gap: 4 }}>
            <Tooltip title="缩小"><button onClick={zoomOut} style={{ width: 30, height: 30, borderRadius: 6, display: 'flex', alignItems: 'center', justifyContent: 'center', border: '1px solid var(--border-color)', background: 'var(--bg-tertiary)', color: 'var(--text-primary)', cursor: 'pointer' }}><Minus size={14} /></button></Tooltip>
            <div style={{ padding: '4px 10px', fontSize: 12, color: 'var(--text-secondary)', backgroundColor: 'var(--bg-tertiary)', borderRadius: 6, minWidth: 46, textAlign: 'center' }}>{Math.round(scale * 100)}%</div>
            <Tooltip title="放大"><button onClick={zoomIn} style={{ width: 30, height: 30, borderRadius: 6, display: 'flex', alignItems: 'center', justifyContent: 'center', border: '1px solid var(--border-color)', background: 'var(--bg-tertiary)', color: 'var(--text-primary)', cursor: 'pointer' }}><Plus size={14} /></button></Tooltip>
            <div style={{ width: 1, height: 20, backgroundColor: 'var(--border-color)', margin: '0 4px' }} />
            <Tooltip title="重置视图"><button onClick={resetView} style={{ width: 30, height: 30, borderRadius: 6, display: 'flex', alignItems: 'center', justifyContent: 'center', border: '1px solid var(--border-color)', background: 'var(--bg-tertiary)', color: 'var(--text-primary)', cursor: 'pointer' }}><RefreshCw size={14} /></button></Tooltip>
            <div style={{ width: 1, height: 20, backgroundColor: 'var(--border-color)', margin: '0 4px' }} />
            <Tooltip title={canvasToolMode === 'pointer' ? '切换到抓手模式' : '切换到指针模式'}>
            <button
              onClick={() => setCanvasToolMode(canvasToolMode === 'pointer' ? 'hand' : 'pointer')}
              style={{
                width: 30, height: 30, borderRadius: 6, display: 'flex', alignItems: 'center', justifyContent: 'center',
                border: '1px solid var(--border-color)',
                background: canvasToolMode === 'pointer' ? 'rgba(108,99,255,0.15)' : 'var(--bg-tertiary)',
                color: canvasToolMode === 'pointer' ? 'var(--primary-color)' : 'var(--text-primary)',
                cursor: 'pointer',
              }}
            >
              {canvasToolMode === 'pointer' ? '🖱️' : '✋'}
            </button>
            </Tooltip>
          </div>

          <div style={{ fontSize: 12, color: 'var(--text-tertiary)', display: 'flex', alignItems: 'center', gap: 6 }}>
            <span>💡 Shift+点击连线 | 滚轮缩放 | Delete删除选中</span>
          </div>
        </div>

        {/* ===== 画布区域 ===== */}
        <div
          ref={containerRef}
          style={{
            flex: 1,
            overflow: 'hidden',
            position: 'relative',
            cursor: isPanning ? 'grabbing' : canvasToolMode === 'hand' ? 'grab' : 'default',
            background: 'var(--bg-primary)',
          }}
          onMouseDown={handleCanvasMouseDown}
          onMouseMove={handleMouseMove}
          onMouseUp={handleMouseUp}
          onMouseLeave={handleMouseUp}
        >
          {/* ===== 画布层（带 transform） ===== */}
          <div
            style={{
              position: 'absolute',
              inset: 0,
              transform: `translate(${offset.x}px, ${offset.y}px) scale(${scale})`,
              transformOrigin: '0 0',
            }}
          >
            {/* 点状网格背景 */}
            <div
              style={{
                position: 'absolute',
                inset: -5000,
                pointerEvents: 'none',
                backgroundImage: 'radial-gradient(circle, var(--border-color) 1px, transparent 1px)',
                backgroundSize: '30px 30px',
              }}
            />

            {/* ===== SVG 连线层 ===== */}
            <svg
              style={{
                position: 'absolute',
                top: 0,
                left: 0,
                width: '100%',
                height: '100%',
                pointerEvents: 'none',
                zIndex: 8,
                overflow: 'visible',
              }}
            >
              <defs>
                {Object.entries(EDGE_COLORS).map(([type, color]) => (
                  <marker key={type} id={`snapshot-arrow-${type}`} markerWidth={8} markerHeight={6} refX={8} refY={3} orient="auto">
                    <polygon points="0 0, 8 3, 0 6" fill={color} />
                  </marker>
                ))}
              </defs>

              {/* 绘制连线 */}
              {edges.map((edge) => {
                const sourceItem = items.find((i) => i.id === edge.sourceItemId);
                const targetItem = items.find((i) => i.id === edge.targetItemId);
                if (!sourceItem || !targetItem) return null;

                const sourcePos = calculateConnectorPosition(sourceItem.positionX, sourceItem.positionY, sourceItem.width, sourceItem.height, edge.sourceConnector, 'right');
                const targetPos = calculateConnectorPosition(targetItem.positionX, targetItem.positionY, targetItem.width, targetItem.height, edge.targetConnector, 'left');
                const path = getEdgePath(sourcePos.x, sourcePos.y, targetPos.x, targetPos.y, edge.controlPoints);
                const color = EDGE_COLORS[edge.edgeType] || EDGE_COLORS.related;
                const markerId = `snapshot-arrow-${edge.edgeType}`;

                return (
                  <g key={edge.id}>
                    <path
                      d={path}
                      fill="none"
                      stroke={color}
                      strokeWidth={2}
                      markerEnd={`url(#${markerId})`}
                      opacity={0.7}
                      style={{ pointerEvents: 'stroke', cursor: 'context-menu' }}
                      onClick={(e) => handleEdgeContextMenu(e as any, edge.id)}
                    />
                    {edge.controlPoints?.map(cp => (
                      <circle
                        key={cp.id}
                        cx={cp.x}
                        cy={cp.y}
                        r={4}
                        fill="white"
                        stroke={color}
                        strokeWidth={2}
                        style={{ pointerEvents: 'all', cursor: 'move' }}
                      />
                    ))}
                    {edge.label && (
                      <text
                        x={(sourcePos.x + targetPos.x) / 2}
                        y={(sourcePos.y + targetPos.y) / 2 - 8}
                        textAnchor="middle"
                        fontSize={11}
                        fill={color}
                        style={{ pointerEvents: 'none' }}
                      >
                        {edge.label}
                      </text>
                    )}
                  </g>
                );
              })}

              {/* 连线临时线 */}
              {isConnecting && connectingFromId && tempLineEnd && (() => {
                const fromItem = items.find(i => i.id === connectingFromId);
                if (!fromItem) return null;
                const fromPos = calculateConnectorPosition(fromItem.positionX, fromItem.positionY, fromItem.width, fromItem.height, connectionStartConnector, 'right');
                const path = getEdgePath(fromPos.x, fromPos.y, tempLineEnd.x, tempLineEnd.y);
                return (
                  <path
                    d={path}
                    fill="none"
                    stroke="var(--primary-color)"
                    strokeWidth={2}
                    strokeDasharray="6 4"
                    opacity={0.6}
                    style={{ pointerEvents: 'none' }}
                  />
                );
              })()}
            </svg>

            {/* ===== 框选矩形 ===== */}
            {isSelecting && (() => {
              const left = Math.min(selectionStart.x, selectionEnd.x);
              const top = Math.min(selectionStart.y, selectionEnd.y);
              const width = Math.abs(selectionEnd.x - selectionStart.x);
              const height = Math.abs(selectionEnd.y - selectionStart.y);
              return (
                <div
                  style={{
                    position: 'absolute',
                    left,
                    top,
                    width,
                    height,
                    border: '2px dashed var(--primary-color)',
                    backgroundColor: 'rgba(108,99,255,0.08)',
                    pointerEvents: 'none',
                    zIndex: 50,
                  }}
                />
              );
            })()}

            {/* ===== 节点卡片层 ===== */}
            {items.map((item) => {
              const creativity = creativityMap[item.creativityId];
              const isSelected = selectedItemIds.includes(item.id);
              const connectors = getConnectorPositions(item);
              const displayType = creativity?.type || 'text';
              const isNaturalSizeMedia = displayType === 'image' || displayType === 'video';
              const displayCardStyle = creativity?.cardStyle;
              let cardBgColor = 'var(--bg-secondary)';
              let cardBorderColor = isSelected ? 'var(--primary-color)' : 'var(--border-color)';
              if (displayCardStyle) {
                try {
                  const style = typeof displayCardStyle === 'string' ? JSON.parse(displayCardStyle) : displayCardStyle;
                  if (style.backgroundColor) cardBgColor = style.backgroundColor;
                  if (style.borderColor && !isSelected) cardBorderColor = style.borderColor;
                } catch {}
              }

              return (
                <div
                  key={item.id}
                  className="canvas-node-card"
                  style={{
                    position: 'absolute',
                    left: item.positionX,
                    top: item.positionY,
                    width: isNaturalSizeMedia ? (item.width ? item.width : 'fit-content') : (item.width || CARD_WIDTH),
                    height: isNaturalSizeMedia && item.height ? item.height : undefined,
                    minWidth: isNaturalSizeMedia ? CARD_WIDTH : undefined,
                    cursor: canvasToolMode === 'hand' ? 'grab' : 'pointer',
                    zIndex: isSelected ? 50 : 10,
                  }}
                  onMouseDown={(e) => handleNodeDragStart(e, item)}
                  onClick={(e) => handleNodeClick(e, item)}
                  onContextMenu={(e) => handleNodeContextMenu(e, item)}
                >
                  <div
                    style={{
                      width: '100%',
                      minHeight: CARD_HEIGHT,
                      borderRadius: 12,
                      backgroundColor: cardBgColor,
                      border: isSelected ? '2px solid var(--primary-color)' : `1px solid ${cardBorderColor}`,
                      boxShadow: isSelected
                        ? '0 0 0 3px rgba(var(--primary-color-rgb, 99,102,241), 0.2), var(--shadow-md)'
                        : 'var(--shadow-md)',
                      padding: 16,
                      display: 'flex',
                      flexDirection: 'column',
                      overflow: 'hidden',
                      position: 'relative',
                      transition: 'border-color 0.2s, box-shadow 0.2s',
                    }}
                  >
                    {creativity?.subtype && getAllSubtypes()[creativity.subtype] && (
                      <div
                        style={{
                          position: 'absolute',
                          top: 8,
                          right: 8,
                          width: 20,
                          height: 20,
                          borderRadius: '50%',
                          backgroundColor: getAllSubtypes()[creativity.subtype].color,
                          display: 'flex',
                          alignItems: 'center',
                          justifyContent: 'center',
                          fontSize: 10,
                          zIndex: 5,
                        }}
                        title={getAllSubtypes()[creativity.subtype].label}
                      >
                        {getAllSubtypes()[creativity.subtype].icon}
                      </div>
                    )}

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
                        {TYPE_ICONS[creativity?.type || 'text'] || <Type size={12} />}
                      </div>
                      <span style={{ fontSize: 11, color: 'var(--text-tertiary)', flexShrink: 0 }}>
                        {TYPE_LABELS[creativity?.type || 'text'] || '文本'}
                      </span>
                      {creativity?.emojiReaction && (
                        <span style={{ marginLeft: 'auto', display: 'inline-flex', alignItems: 'center' }}><EmojiIcon id={creativity.emojiReaction} size={14} /></span>
                      )}
                    </div>

                    <div
                      style={{
                        fontSize: 14,
                        fontWeight: 600,
                        color: 'var(--text-primary)',
                        lineHeight: 1.4,
                        marginBottom: 6,
                      }}
                    >
                      {creativity?.title}
                    </div>

                    <SnapshotMediaContent creativity={creativity} />
                  </div>

                  {/* 连接点 */}
                  {connectors.map(({ edgeId, connector }) => {
                    const pos = calculateConnectorPosition(item.positionX, item.positionY, item.width, item.height, connector);
                    const relX = pos.x - item.positionX - CONNECTOR_SIZE / 2;
                    const relY = pos.y - item.positionY - CONNECTOR_SIZE / 2;
                    return (
                      <div
                        key={edgeId}
                        className="canvas-connector"
                        style={{
                          position: 'absolute',
                          left: relX,
                          top: relY,
                          width: CONNECTOR_SIZE,
                          height: CONNECTOR_SIZE,
                          borderRadius: '50%',
                          backgroundColor: 'var(--border-color)',
                          border: '2px solid var(--bg-secondary)',
                          pointerEvents: 'none',
                          zIndex: 15,
                        }}
                      />
                    );
                  })}
                </div>
              );
            })}
          </div>
        </div>
      </div>

      {/* ===== 右键菜单（节点） ===== */}
      {contextMenu && (
        <div
          className="snapshot-toolbar"
          style={{
            position: 'fixed',
            left: contextMenu.x,
            top: contextMenu.y,
            zIndex: 10000,
            backgroundColor: 'var(--bg-secondary)',
            borderRadius: 8,
            boxShadow: '0 8px 24px rgba(0,0,0,0.2)',
            border: '1px solid var(--border-color)',
            padding: '4px 0',
            minWidth: 140,
          }}
        >
          {contextMenu.itemId && (
            <button
              onClick={() => handleDeleteNode(contextMenu.itemId!)}
              style={{
                display: 'flex', alignItems: 'center', gap: 8, width: '100%',
                padding: '8px 16px', border: 'none', background: 'transparent',
                cursor: 'pointer', fontSize: 13, color: '#ef4444', textAlign: 'left',
              }}
              onMouseEnter={(e) => { (e.currentTarget as HTMLElement).style.backgroundColor = 'var(--bg-hover)'; }}
              onMouseLeave={(e) => { (e.currentTarget as HTMLElement).style.backgroundColor = 'transparent'; }}
            >
              <Trash2 size={14} /> 从画布移除
            </button>
          )}
        </div>
      )}

      {/* ===== 右键菜单（连线） ===== */}
      {edgeContextMenu && (
        <div
          className="snapshot-toolbar"
          style={{
            position: 'fixed',
            left: edgeContextMenu.x,
            top: edgeContextMenu.y,
            zIndex: 10000,
            backgroundColor: 'var(--bg-secondary)',
            borderRadius: 8,
            boxShadow: '0 8px 24px rgba(0,0,0,0.2)',
            border: '1px solid var(--border-color)',
            padding: '4px 0',
            minWidth: 140,
          }}
        >
          <button
            onClick={() => handleDeleteEdge(edgeContextMenu.edgeId)}
            style={{
              display: 'flex', alignItems: 'center', gap: 8, width: '100%',
              padding: '8px 16px', border: 'none', background: 'transparent',
              cursor: 'pointer', fontSize: 13, color: '#ef4444', textAlign: 'left',
            }}
            onMouseEnter={(e) => { (e.currentTarget as HTMLElement).style.backgroundColor = 'var(--bg-hover)'; }}
            onMouseLeave={(e) => { (e.currentTarget as HTMLElement).style.backgroundColor = 'transparent'; }}
          >
            <Trash2 size={14} /> 删除连线
          </button>
          <button
            onClick={() => {
              const edge = edges.find(e => e.id === edgeContextMenu.edgeId);
              if (edge) {
                const sourceItem = items.find(i => i.id === edge.sourceItemId);
                const targetItem = items.find(i => i.id === edge.targetItemId);
                if (sourceItem && targetItem) {
                  const sourcePos = calculateConnectorPosition(sourceItem.positionX, sourceItem.positionY, sourceItem.width, sourceItem.height, edge.sourceConnector, 'right');
                  const targetPos = calculateConnectorPosition(targetItem.positionX, targetItem.positionY, targetItem.width, targetItem.height, edge.targetConnector, 'left');
                  const midX = (sourcePos.x + targetPos.x) / 2;
                  const midY = (sourcePos.y + targetPos.y) / 2;
                  setEditingEdgePos({ x: midX, y: midY });
                  setEditingEdgeLabel(edge.label || '');
                  setEditingEdgeId(edge.id);
                }
              }
              setEdgeContextMenu(null);
            }}
            style={{
              display: 'flex', alignItems: 'center', gap: 8, width: '100%',
              padding: '8px 16px', border: 'none', background: 'transparent',
              cursor: 'pointer', fontSize: 13, color: 'var(--text-primary)', textAlign: 'left',
            }}
            onMouseEnter={(e) => { (e.currentTarget as HTMLElement).style.backgroundColor = 'var(--bg-hover)'; }}
            onMouseLeave={(e) => { (e.currentTarget as HTMLElement).style.backgroundColor = 'transparent'; }}
          >
            ✏️ 编辑标签
          </button>
        </div>
      )}

      {/* ===== 边标签编辑弹窗 ===== */}
      {editingEdgeId && (
        <div
          style={{
            position: 'fixed',
            left: offset.x + editingEdgePos.x * scale,
            top: offset.y + editingEdgePos.y * scale - 30,
            zIndex: 10001,
            display: 'flex',
            gap: 4,
          }}
        >
          <input
            autoFocus
            value={editingEdgeLabel}
            onChange={(e) => setEditingEdgeLabel(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === 'Enter') handleEdgeLabelSubmit();
              if (e.key === 'Escape') setEditingEdgeId(null);
            }}
            onBlur={handleEdgeLabelSubmit}
            style={{
              padding: '4px 8px',
              fontSize: 12,
              borderRadius: 4,
              border: '1px solid var(--primary-color)',
              backgroundColor: 'var(--bg-secondary)',
              color: 'var(--text-primary)',
              outline: 'none',
              width: 120,
            }}
          />
        </div>
      )}
    </div>
  );
};

export default CreativeChainSnapshotViewer;
