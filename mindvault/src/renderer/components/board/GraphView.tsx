import React, { useState, useCallback, useRef, useEffect, useMemo } from 'react';
import {
  Plus,
  ZoomIn,
  ZoomOut,
  Maximize2,
  GitBranch,
  Trash2,
  Link2,
  Send,
  LayoutGrid,
  ArrowDown,
  ArrowRight,
  ChevronDown,
  RefreshCw,
  ChevronRight,
  MousePointer,
  Move,
} from 'lucide-react';
import Spinner from '../common/Spinner';
import { Tooltip, Empty } from 'antd';
import { useBoardStore } from '../../stores/boardStore';
import { useUIStore } from '../../stores/uiStore';
import { truncateText } from '../../utils/formatters';
import type { BoardGraphNode, BoardGraphEdge } from '@shared/types';

// ===== 类型定义 =====

interface GraphViewProps {
  boardId: string;
  onNodeClick?: (node: any) => void;
  onNodeContextMenu?: (e: React.MouseEvent, node: any) => void;
}

interface LayoutNode {
  id: string;
  x: number;
  y: number;
  width: number;
  height: number;
  node: BoardGraphNode;
  children: LayoutNode[];
  collapsed: boolean;
}

// ===== 布局常量 =====

const NODE_WIDTH = 160;
const NODE_HEIGHT = 48;
const ROOT_NODE_WIDTH = 200;
const ROOT_NODE_HEIGHT = 56;
const HORIZONTAL_GAP = 200;
const VERTICAL_GAP = 16;

// ===== 树形布局算法（纯函数） =====

function buildTree(nodes: BoardGraphNode[]): Map<string, BoardGraphNode[]> {
  const childrenMap = new Map<string, BoardGraphNode[]>();
  for (const node of nodes) {
    const parentId = node.parentId || '__root__';
    if (!childrenMap.has(parentId)) {
      childrenMap.set(parentId, []);
    }
    childrenMap.get(parentId)!.push(node);
  }
  return childrenMap;
}

function measureSubtreeHeight(node: LayoutNode): number {
  if (node.collapsed || node.children.length === 0) {
    return node.height;
  }
  const childrenHeight = node.children.reduce(
    (sum, child) => sum + measureSubtreeHeight(child),
    0
  );
  return Math.max(node.height, childrenHeight + (node.children.length - 1) * VERTICAL_GAP);
}

function layoutSubtree(
  node: LayoutNode,
  x: number,
  yStart: number,
  yEnd: number,
  direction: 'horizontal' | 'vertical'
): void {
  const totalHeight = yEnd - yStart;
  node.x = x;
  node.y = yStart + (totalHeight - node.height) / 2;

  if (node.collapsed || node.children.length === 0) return;

  const childX = direction === 'horizontal' ? x + node.width + HORIZONTAL_GAP : x;
  const totalChildrenHeight = node.children.reduce(
    (sum, child) => sum + measureSubtreeHeight(child),
    0
  );
  const gapSpace = (node.children.length - 1) * VERTICAL_GAP;
  const availableHeight = Math.max(totalHeight, totalChildrenHeight + gapSpace);
  let currentY = node.y + node.height / 2 - availableHeight / 2;

  for (const child of node.children) {
    const childHeight = measureSubtreeHeight(child);
    layoutSubtree(child, childX, currentY, currentY + childHeight, direction);
    currentY += childHeight + VERTICAL_GAP;
  }
}

function computeTreeLayout(
  nodes: BoardGraphNode[],
  collapsedSet: Set<string>,
  direction: 'horizontal' | 'vertical'
): LayoutNode[] {
  if (nodes.length === 0) return [];

  const childrenMap = buildTree(nodes);
  const rootNodes = childrenMap.get('__root__') || [];

  function toLayoutNode(node: BoardGraphNode): LayoutNode {
    const isRoot = !node.parentId;
    const children = (childrenMap.get(node.id) || []).map(toLayoutNode);
    return {
      id: node.id,
      x: 0,
      y: 0,
      width: isRoot ? ROOT_NODE_WIDTH : NODE_WIDTH,
      height: isRoot ? ROOT_NODE_HEIGHT : NODE_HEIGHT,
      node,
      children,
      collapsed: collapsedSet.has(node.id),
    };
  }

  const layoutRoots = rootNodes.map(toLayoutNode);

  // 计算总高度
  const totalHeight = layoutRoots.reduce(
    (sum, root) => sum + measureSubtreeHeight(root),
    0
  );
  const gapSpace = (layoutRoots.length - 1) * VERTICAL_GAP * 2;
  let currentY = 60; // 顶部留白

  for (const root of layoutRoots) {
    const rootHeight = measureSubtreeHeight(root);
    layoutSubtree(root, 60, currentY, currentY + rootHeight, direction);
    currentY += rootHeight + VERTICAL_GAP * 2;
  }

  // 展平为列表
  const flat: LayoutNode[] = [];
  function flatten(ln: LayoutNode) {
    flat.push(ln);
    if (!ln.collapsed) {
      ln.children.forEach(flatten);
    }
  }
  layoutRoots.forEach(flatten);
  return flat;
}

// ===== 贝塞尔曲线路径 =====

function getEdgePath(
  sx: number,
  sy: number,
  sw: number,
  sh: number,
  tx: number,
  ty: number,
  tw: number,
  th: number,
  direction: 'horizontal' | 'vertical'
): string {
  if (direction === 'horizontal') {
    const startX = sx + sw;
    const startY = sy + sh / 2;
    const endX = tx;
    const endY = ty + th / 2;
    const cpOffset = Math.abs(endX - startX) * 0.5;
    return `M ${startX} ${startY} C ${startX + cpOffset} ${startY}, ${endX - cpOffset} ${endY}, ${endX} ${endY}`;
  } else {
    const startX = sx + sw / 2;
    const startY = sy + sh;
    const endX = tx + tw / 2;
    const endY = ty;
    const cpOffset = Math.abs(endY - startY) * 0.5;
    return `M ${startX} ${startY} C ${startX} ${startY + cpOffset}, ${endX} ${endY - cpOffset}, ${endX} ${endY}`;
  }
}

// ===== 组件 =====

const GraphView: React.FC<GraphViewProps> = ({
  boardId,
  onNodeClick,
  onNodeContextMenu,
}) => {
  const {
    graphNodes,
    graphEdges,
    isLoading: graphLoading,
    canvasToolMode,
    fetchGraphData,
    addGraphNode,
    updateGraphNodePosition,
    removeGraphNode,
    addGraphEdge,
    addCanvasItem,
  } = useBoardStore();

  // 视图状态
  const [scale, setScale] = useState(1);
  const [offset, setOffset] = useState({ x: 0, y: 0 });
  const [isPanning, setIsPanning] = useState(false);
  const [panStart, setPanStart] = useState({ x: 0, y: 0 });
  const [direction, setDirection] = useState<'horizontal' | 'vertical'>('horizontal');

  // 节点交互
  const [hoveredNode, setHoveredNode] = useState<string | null>(null);
  const [selectedNode, setSelectedNode] = useState<string | null>(null);
  const [draggingNode, setDraggingNode] = useState<string | null>(null);
  const [dragOffset, setDragOffset] = useState({ x: 0, y: 0 });

  // 折叠状态
  const [collapsedSet, setCollapsedSet] = useState<Set<string>>(new Set());

  // 连线模式
  const [linkingMode, setLinkingMode] = useState<string | null>(null);

  // 右键菜单
  const [contextMenu, setContextMenu] = useState<{
    x: number;
    y: number;
    node: BoardGraphNode;
  } | null>(null);

  const containerRef = useRef<HTMLDivElement>(null);
  const svgRef = useRef<SVGSVGElement>(null);

  // ===== 数据加载 =====

  useEffect(() => {
    if (boardId) {
      fetchGraphData(boardId);
    }
  }, [boardId, fetchGraphData]);

  // ===== 布局计算 =====

  const layoutNodes = useMemo(
    () => computeTreeLayout(graphNodes, collapsedSet, direction),
    [graphNodes, collapsedSet, direction]
  );

  const layoutMap = useMemo(() => {
    const map = new Map<string, LayoutNode>();
    for (const ln of layoutNodes) {
      map.set(ln.id, ln);
    }
    return map;
  }, [layoutNodes]);

  // ===== 缩放 =====

  const handleWheel = useCallback((e: WheelEvent) => {
    if (e.ctrlKey || e.metaKey) {
      e.preventDefault();
      const delta = e.deltaY > 0 ? -0.1 : 0.1;
      setScale((prev) => Math.min(Math.max(prev + delta, 0.2), 3));
    }
  }, []);

  useEffect(() => {
    const el = containerRef.current;
    if (!el) return;
    el.addEventListener('wheel', handleWheel, { passive: false });
    return () => el.removeEventListener('wheel', handleWheel);
  }, [handleWheel]);

  // ===== 平移 =====

  const handleCanvasMouseDown = useCallback(
    (e: React.MouseEvent) => {
      if ((e.target as HTMLElement).closest('.graph-node')) return;
      // 指针模式下禁止平移画布
      if (canvasToolMode !== 'hand') return;
      setIsPanning(true);
      setPanStart({ x: e.clientX - offset.x, y: e.clientY - offset.y });
      setContextMenu(null);
      setLinkingMode(null);
      setSelectedNode(null);
    },
    [offset, canvasToolMode]
  );

  const handleMouseMove = useCallback(
    (e: React.MouseEvent) => {
      if (isPanning) {
        setOffset({
          x: e.clientX - panStart.x,
          y: e.clientY - panStart.y,
        });
      }
      if (draggingNode) {
        const ln = layoutMap.get(draggingNode);
        if (!ln) return;
        const newX = (e.clientX - offset.x - dragOffset.x) / scale;
        const newY = (e.clientY - offset.y - dragOffset.y) / scale;
        // 即时更新位置
        useBoardStore.setState((s) => ({
          graphNodes: s.graphNodes.map((n) =>
            n.id === draggingNode ? { ...n, positionX: newX, positionY: newY } : n
          ),
        }));
      }
    },
    [isPanning, panStart, draggingNode, dragOffset, scale, offset, layoutMap]
  );

  const handleMouseUp = useCallback(() => {
    if (draggingNode) {
      const node = useBoardStore.getState().graphNodes.find((n) => n.id === draggingNode);
      if (node && node.positionX != null && node.positionY != null) {
        updateGraphNodePosition(draggingNode, Math.round(node.positionX), Math.round(node.positionY));
      }
    }
    setIsPanning(false);
    setDraggingNode(null);
  }, [draggingNode, updateGraphNodePosition]);

  // ===== 节点交互 =====

  const handleNodeMouseDown = useCallback(
    (e: React.MouseEvent, nodeId: string) => {
      e.stopPropagation();
      const ln = layoutMap.get(nodeId);
      if (!ln) return;

      // 如果在连线模式，完成连线
      if (linkingMode && linkingMode !== nodeId) {
        addGraphEdge(boardId, linkingMode, nodeId, 'child');
        setLinkingMode(null);
        return;
      }

      // 只有在抓手模式下才允许拖拽节点
      if (canvasToolMode === 'hand') {
        // 开始拖拽
        setDraggingNode(nodeId);
        setDragOffset({
          x: e.clientX - offset.x - ln.x * scale,
          y: e.clientY - offset.y - ln.y * scale,
        });
      }
      setSelectedNode(nodeId);
      setContextMenu(null);
    },
    [layoutMap, linkingMode, addGraphEdge, boardId, offset, scale, canvasToolMode]
  );

  // ===== 折叠/展开 =====

  const toggleCollapse = useCallback((nodeId: string) => {
    setCollapsedSet((prev) => {
      const next = new Set(prev);
      if (next.has(nodeId)) next.delete(nodeId);
      else next.add(nodeId);
      return next;
    });
  }, []);

  // ===== 右键菜单 =====

  const handleNodeContextMenu = useCallback(
    (e: React.MouseEvent, node: BoardGraphNode) => {
      e.preventDefault();
      e.stopPropagation();
      setContextMenu({ x: e.clientX, y: e.clientY, node });
      setLinkingMode(null);
    },
    []
  );

  // ===== 添加子节点 =====

  const handleAddChild = useCallback(
    async (parentNode: BoardGraphNode) => {
      const ln = layoutMap.get(parentNode.id);
      const childX = ln ? ln.x + (direction === 'horizontal' ? HORIZONTAL_GAP + NODE_WIDTH : 0) : 0;
      const childY = ln ? ln.y + NODE_HEIGHT + VERTICAL_GAP : 0;

      await addGraphNode(boardId, {
        parentId: parentNode.id,
        positionX: childX,
        positionY: childY,
        nodeType: 'custom',
        label: '新节点',
        creativityId: null,
      });
      setContextMenu(null);
    },
    [boardId, addGraphNode, layoutMap, direction]
  );

  // ===== 添加根节点 =====

  const handleAddRoot = useCallback(async () => {
    const maxX = layoutNodes.reduce((max, ln) => Math.max(max, ln.x), 0);
    const maxY = layoutNodes.reduce((max, ln) => Math.max(max, ln.y), 0);

    await addGraphNode(boardId, {
      parentId: null,
      positionX: maxX + HORIZONTAL_GAP + ROOT_NODE_WIDTH,
      positionY: maxY + ROOT_NODE_HEIGHT + VERTICAL_GAP,
      nodeType: 'custom',
      label: '根节点',
      creativityId: null,
    });
  }, [boardId, addGraphNode, layoutNodes]);

  // ===== 自动布局 =====

  const handleAutoLayout = useCallback(() => {
    // 清除手动位置，重新使用树形布局
    setCollapsedSet(new Set());
    setOffset({ x: 0, y: 0 });
    setScale(1);
  }, []);

  // ===== 删除节点 =====

  const handleDeleteNode = useCallback(
    (nodeId: string) => {
      removeGraphNode(nodeId);
      setContextMenu(null);
      if (selectedNode === nodeId) setSelectedNode(null);
    },
    [removeGraphNode, selectedNode]
  );

  // ===== 连线模式 =====

  const handleStartLinking = useCallback(
    (nodeId: string) => {
      setLinkingMode(nodeId);
      setContextMenu(null);
    },
    []
  );

  // ===== 发送子树到画布 =====

  const handleSendSubtreeToCanvas = useCallback(
    async (startNode: BoardGraphNode) => {
      // 1. 递归收集所有后代节点 ID
      const descendantIds: string[] = [];
      function collectDescendants(nodeId: string) {
        descendantIds.push(nodeId);
        const children = graphNodes.filter((n) => n.parentId === nodeId);
        for (const child of children) {
          collectDescendants(child.id);
        }
      }
      collectDescendants(startNode.id);

      // 2. 获取每个节点的 creativity 数据，添加到画布
      let addedCount = 0;
      const COLS = 4;
      const CARD_W = 260;
      const CARD_H = 180;
      const GAP = 20;

      for (let i = 0; i < descendantIds.length; i++) {
        const node = graphNodes.find((n) => n.id === descendantIds[i]);
        if (node?.creativityId) {
          const col = i % COLS;
          const row = Math.floor(i / COLS);
          const x = 100 + col * (CARD_W + GAP);
          const y = 100 + row * (CARD_H + GAP);
          await addCanvasItem(boardId, node.creativityId, x, y);
          addedCount++;
        }
      }

      // 3. 显示 toast
      useUIStore.getState().showToast('success', `已发送 ${addedCount} 个节点到画布`);

      // 4. 关闭右键菜单
      setContextMenu(null);
    },
    [graphNodes, boardId, addCanvasItem]
  );

  // ===== 缩放控制 =====

  const zoomIn = () => setScale((prev) => Math.min(prev + 0.2, 3));
  const zoomOut = () => setScale((prev) => Math.max(prev - 0.2, 0.2));
  const resetView = () => {
    setScale(1);
    setOffset({ x: 0, y: 0 });
  };

  // ===== 点击空白关闭菜单 =====

  useEffect(() => {
    const handleClick = () => setContextMenu(null);
    if (contextMenu) {
      document.addEventListener('click', handleClick);
      return () => document.removeEventListener('click', handleClick);
    }
  }, [contextMenu]);

  // ===== 渲染 =====

  // 加载状态
  if (graphLoading) {
    return (
      <div
        style={{
          position: 'absolute',
          inset: 0,
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          backgroundColor: 'var(--bg-primary)',
        }}
      >
        <Spinner size={24} color="var(--primary-color)" />
        <span style={{ marginLeft: 8, fontSize: 14, color: 'var(--text-secondary)' }}>加载图谱中...</span>
      </div>
    );
  }

  // 空状态
  if (graphNodes.length === 0) {
    return (
      <div
        style={{
          position: 'absolute',
          inset: 0,
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          backgroundColor: 'var(--bg-primary)',
        }}
      >
        <Empty
          image={<div style={{ width: 80, height: 80, borderRadius: 'var(--radius-xl)', backgroundColor: 'var(--bg-tertiary)', display: 'flex', alignItems: 'center', justifyContent: 'center' }}><GitBranch size={36} color="var(--text-tertiary)" /></div>}
          description={<><span style={{ fontSize: 18, fontWeight: 500, color: 'var(--text-primary)' }}>还没有节点</span><br/><span style={{ fontSize: 14, color: 'var(--text-tertiary)' }}>点击上方按钮添加根节点开始创作</span></>}
        >
          <button
            onClick={handleAddRoot}
            style={{
              display: 'flex',
              alignItems: 'center',
              gap: 6,
              padding: '8px 16px',
              borderRadius: 'var(--radius-md)',
              backgroundColor: 'var(--primary-color)',
              color: '#fff',
              border: 'none',
              cursor: 'pointer',
              fontSize: 13,
              fontWeight: 500,
            }}
          >
            <Plus size={16} />
            添加根节点
          </button>
        </Empty>
      </div>
    );
  }

  // 计算画布尺寸
  const canvasWidth = layoutNodes.length > 0
    ? Math.max(2000, ...layoutNodes.map((ln) => ln.x + ln.width + 200))
    : 2000;
  const canvasHeight = layoutNodes.length > 0
    ? Math.max(1500, ...layoutNodes.map((ln) => ln.y + ln.height + 200))
    : 1500;

  // 收集父子边
  const parentChildEdges = graphEdges.filter((e) => e.edgeType === 'child');
  // 收集交叉关联边
  const crossEdges = graphEdges.filter((e) => e.edgeType !== 'child');

  return (
    <div
      ref={containerRef}
      style={{
        position: 'absolute',
        inset: 0,
        overflow: 'hidden',
        backgroundColor: 'var(--bg-primary)',
        cursor: linkingMode ? 'crosshair' : canvasToolMode === 'hand' ? (isPanning ? 'grabbing' : 'grab') : 'default',
      }}
      onMouseDown={handleCanvasMouseDown}
      onMouseMove={handleMouseMove}
      onMouseUp={handleMouseUp}
      onMouseLeave={handleMouseUp}
    >
      {/* 画布 */}
      <div
        style={{
          position: 'absolute',
          transform: `translate(${offset.x}px, ${offset.y}px) scale(${scale})`,
          transformOrigin: '0 0',
        }}
      >
        <svg
          ref={svgRef}
          width={canvasWidth}
          height={canvasHeight}
          style={{ display: 'block', position: 'absolute', top: 0, left: 0 }}
        >
          {/* 父子连线（实线贝塞尔曲线） */}
          {parentChildEdges.map((edge) => {
            const sourceLn = layoutMap.get(edge.sourceNodeId);
            const targetLn = layoutMap.get(edge.targetNodeId);
            if (!sourceLn || !targetLn) return null;
            const isHighlighted =
              hoveredNode === edge.sourceNodeId || hoveredNode === edge.targetNodeId;
            return (
              <path
                key={edge.id}
                d={getEdgePath(
                  sourceLn.x, sourceLn.y, sourceLn.width, sourceLn.height,
                  targetLn.x, targetLn.y, targetLn.width, targetLn.height,
                  direction
                )}
                fill="none"
                stroke={isHighlighted ? 'var(--primary-color)' : 'var(--border-color)'}
                strokeWidth={isHighlighted ? 2.5 : 1.5}
                opacity={isHighlighted ? 0.9 : 0.5}
              />
            );
          })}

          {/* 交叉关联连线（虚线） */}
          {crossEdges.map((edge) => {
            const sourceLn = layoutMap.get(edge.sourceNodeId);
            const targetLn = layoutMap.get(edge.targetNodeId);
            if (!sourceLn || !targetLn) return null;
            const isHighlighted =
              hoveredNode === edge.sourceNodeId || hoveredNode === edge.targetNodeId;
            return (
              <path
                key={edge.id}
                d={getEdgePath(
                  sourceLn.x, sourceLn.y, sourceLn.width, sourceLn.height,
                  targetLn.x, targetLn.y, targetLn.width, targetLn.height,
                  direction
                )}
                fill="none"
                stroke={isHighlighted ? 'var(--primary-color)' : '#9DBAD5'}
                strokeWidth={isHighlighted ? 2 : 1.5}
                strokeDasharray="6 4"
                opacity={isHighlighted ? 0.8 : 0.4}
              />
            );
          })}
        </svg>

        {/* 节点渲染 */}
        {layoutNodes.map((ln) => {
          const node = ln.node;
          const isRoot = !node.parentId;
          const isHovered = hoveredNode === node.id;
          const isSelected = selectedNode === node.id;
          const isLinking = linkingMode === node.id;
          const hasChildren = graphNodes.some((n) => n.parentId === node.id);

          const label = node.creativity
            ? truncateText(node.creativity.title, 12)
            : node.label || '未命名';
          const sublabel = node.creativity
            ? truncateText(node.creativity.content, 20)
            : '';

          return (
            <div
              key={node.id}
              className="graph-node"
              style={{
                position: 'absolute',
                left: ln.x,
                top: ln.y,
                width: ln.width,
                height: ln.height,
                borderRadius: isRoot ? 'var(--radius-lg)' : 'var(--radius-md)',
                backgroundColor: 'var(--bg-secondary)',
                border: `2px solid ${
                  isRoot
                    ? 'var(--primary-color)'
                    : isSelected
                    ? 'var(--primary-color)'
                    : isHovered
                    ? 'var(--border-color)'
                    : 'var(--border-light)'
                }`,
                boxShadow: isSelected
                  ? '0 0 0 3px var(--primary-bg), var(--shadow-md)'
                  : isHovered
                  ? 'var(--shadow-md)'
                  : 'var(--shadow-sm)',
                display: 'flex',
                alignItems: 'center',
                cursor: linkingMode ? 'crosshair' : canvasToolMode === 'hand' ? (draggingNode === node.id ? 'grabbing' : 'grab') : 'default',
                zIndex: draggingNode === node.id ? 100 : isSelected ? 50 : 1,
                transition: 'box-shadow 0.15s ease, border-color 0.15s ease',
                overflow: 'hidden',
              }}
              onMouseDown={(e) => handleNodeMouseDown(e, node.id)}
              onMouseEnter={() => setHoveredNode(node.id)}
              onMouseLeave={() => setHoveredNode(null)}
              onClick={(e) => {
                e.stopPropagation();
                // Shift+点击：开始/完成连线（任意模式可用）
                if (e.shiftKey) {
                  if (linkingMode && linkingMode !== node.id) {
                    addGraphEdge(boardId, linkingMode, node.id, 'child');
                    setLinkingMode(null);
                  } else if (!linkingMode) {
                    setLinkingMode(node.id);
                  }
                  return;
                }
                if (canvasToolMode === 'hand') return;
                onNodeClick?.(node);
              }}
              onContextMenu={(e) => handleNodeContextMenu(e, node)}
            >
              {/* 折叠/展开按钮（左侧） */}
              {hasChildren && (
                <button
                  onClick={(e) => {
                    e.stopPropagation();
                    toggleCollapse(node.id);
                  }}
                  style={{
                    position: 'absolute',
                    left: -12,
                    top: '50%',
                    transform: 'translateY(-50%)',
                    width: 24,
                    height: 24,
                    borderRadius: '50%',
                    backgroundColor: 'var(--bg-tertiary)',
                    border: '1px solid var(--border-color)',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    cursor: 'pointer',
                    zIndex: 10,
                    color: 'var(--text-secondary)',
                    padding: 0,
                  }}
                  title={collapsedSet.has(node.id) ? '展开' : '折叠'}
                >
                  {collapsedSet.has(node.id) ? (
                    <ChevronRight size={12} />
                  ) : (
                    <ChevronDown size={12} />
                  )}
                </button>
              )}

              {/* 节点内容 */}
              <div
                style={{
                  flex: 1,
                  minWidth: 0,
                  padding: '8px 12px',
                  display: 'flex',
                  flexDirection: 'column',
                  justifyContent: 'center',
                }}
              >
                <div
                  style={{
                    fontSize: isRoot ? 14 : 13,
                    fontWeight: isRoot ? 700 : 500,
                    color: 'var(--text-primary)',
                    overflow: 'hidden',
                    textOverflow: 'ellipsis',
                    whiteSpace: 'nowrap',
                  }}
                >
                  {label}
                </div>
                {sublabel && !isRoot && (
                  <div
                    style={{
                      fontSize: 11,
                      color: 'var(--text-tertiary)',
                      overflow: 'hidden',
                      textOverflow: 'ellipsis',
                      whiteSpace: 'nowrap',
                      marginTop: 2,
                    }}
                  >
                    {sublabel}
                  </div>
                )}
              </div>

              {/* 连接点（右侧小圆点，悬停显示） */}
              {(isHovered || isLinking) && (
                <Tooltip title="点击开始连线">
                  <div
                    style={{
                      position: 'absolute',
                      right: -6,
                      top: '50%',
                      transform: 'translateY(-50%)',
                      width: 12,
                      height: 12,
                      borderRadius: '50%',
                      backgroundColor: isLinking
                        ? 'var(--primary-color)'
                        : 'var(--primary-color)',
                      border: '2px solid var(--bg-secondary)',
                      cursor: 'pointer',
                      zIndex: 10,
                    }}
                    onClick={(e) => {
                      e.stopPropagation();
                      if (!isLinking) {
                        handleStartLinking(node.id);
                      }
                    }}
                  />
                </Tooltip>
              )}

              {/* 根节点主题色标识 */}
              {isRoot && (
                <div
                  style={{
                    position: 'absolute',
                    left: 0,
                    top: 0,
                    bottom: 0,
                    width: 4,
                    borderRadius: 'var(--radius-lg) 0 0 var(--radius-lg)',
                    backgroundColor: 'var(--primary-color)',
                  }}
                />
              )}
            </div>
          );
        })}
      </div>

      {/* 连线模式提示 */}
      {linkingMode && (
        <div
          style={{
            position: 'absolute',
            top: 56,
            left: '50%',
            transform: 'translateX(-50%)',
            padding: '8px 16px',
            borderRadius: 'var(--radius-md)',
            backgroundColor: 'var(--primary-bg)',
            border: '1px solid var(--primary-color)',
            color: 'var(--primary-color)',
            fontSize: 13,
            fontWeight: 500,
            zIndex: 30,
            display: 'flex',
            alignItems: 'center',
            gap: 8,
          }}
        >
          <Link2 size={14} />
          连线模式：点击目标节点完成连线
          <button
            onClick={() => setLinkingMode(null)}
            style={{
              marginLeft: 8,
              padding: '2px 8px',
              borderRadius: 'var(--radius-sm)',
              backgroundColor: 'var(--primary-color)',
              color: '#fff',
              border: 'none',
              cursor: 'pointer',
              fontSize: 12,
            }}
          >
            取消
          </button>
        </div>
      )}

      {/* 顶部工具栏 */}
      <div
        style={{
          position: 'absolute',
          top: 12,
          left: 12,
          right: 12,
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          zIndex: 20,
          pointerEvents: 'none',
        }}
      >
        {/* 左侧工具 */}
        <div
          style={{
            pointerEvents: 'auto',
            display: 'flex',
            alignItems: 'center',
            gap: 4,
            padding: 4,
            borderRadius: 'var(--radius-lg)',
            backgroundColor: 'var(--bg-secondary)',
            border: '1px solid var(--border-color)',
            boxShadow: 'var(--shadow-lg)',
          }}
        >
          <Tooltip title="添加根节点">
            <button
              onClick={handleAddRoot}
              style={{
                padding: 8,
                borderRadius: 'var(--radius-md)',
                color: 'var(--text-secondary)',
                display: 'flex',
                alignItems: 'center',
                background: 'none',
                border: 'none',
                cursor: 'pointer',
              }}
            >
              <Plus size={16} />
            </button>
          </Tooltip>
          <div style={{ width: 1, height: 20, backgroundColor: 'var(--border-color)' }} />
          <Tooltip title="自动布局">
            <button
              onClick={handleAutoLayout}
              style={{
                padding: 8,
                borderRadius: 'var(--radius-md)',
                color: 'var(--text-secondary)',
                display: 'flex',
                alignItems: 'center',
                background: 'none',
                border: 'none',
                cursor: 'pointer',
              }}
            >
              <LayoutGrid size={16} />
            </button>
          </Tooltip>
          <Tooltip title="切换布局方向">
            <button
              onClick={() => setDirection(direction === 'horizontal' ? 'vertical' : 'horizontal')}
              style={{
                padding: 8,
                borderRadius: 'var(--radius-md)',
                color: 'var(--text-secondary)',
                display: 'flex',
                alignItems: 'center',
                background: 'none',
                border: 'none',
                cursor: 'pointer',
              }}
            >
              {direction === 'horizontal' ? <ArrowDown size={16} /> : <ArrowRight size={16} />}
            </button>
          </Tooltip>
        </div>

        {/* 右侧缩放控制 */}
        <div
          style={{
            pointerEvents: 'auto',
            display: 'flex',
            alignItems: 'center',
            gap: 4,
            padding: 4,
            borderRadius: 'var(--radius-lg)',
            backgroundColor: 'var(--bg-secondary)',
            border: '1px solid var(--border-color)',
            boxShadow: 'var(--shadow-lg)',
          }}
        >
          <Tooltip title="缩小">
            <button
              onClick={zoomOut}
              style={{
                padding: 8,
                borderRadius: 'var(--radius-md)',
                color: 'var(--text-secondary)',
                display: 'flex',
                alignItems: 'center',
                background: 'none',
                border: 'none',
                cursor: 'pointer',
              }}
            >
              <ZoomOut size={16} />
            </button>
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
          <Tooltip title="放大">
            <button
              onClick={zoomIn}
              style={{
                padding: 8,
                borderRadius: 'var(--radius-md)',
                color: 'var(--text-secondary)',
                display: 'flex',
                alignItems: 'center',
                background: 'none',
                border: 'none',
                cursor: 'pointer',
              }}
            >
              <ZoomIn size={16} />
            </button>
          </Tooltip>
          <div style={{ width: 1, height: 20, backgroundColor: 'var(--border-color)', margin: '0 2px' }} />
          <Tooltip title={canvasToolMode === 'pointer' ? '切换到抓手模式' : '切换到指针模式'}>
              <button
                onClick={() => useBoardStore.getState().setCanvasToolMode(canvasToolMode === 'pointer' ? 'hand' : 'pointer')}
                className="canvas-toolbar"
                style={{
                  padding: 8,
                  borderRadius: 'var(--radius-md)',
                  color: canvasToolMode === 'pointer' ? 'var(--primary)' : 'var(--text-secondary)',
                  display: 'flex',
                  alignItems: 'center',
                  border: 'none',
                  background: canvasToolMode === 'pointer' ? 'rgba(var(--primary-rgb), 0.1)' : 'none',
                  cursor: 'pointer',
                }}
              >
                {canvasToolMode === 'pointer' ? <MousePointer size={16} /> : <Move size={16} />}
              </button>
            </Tooltip>
          <Tooltip title="重置视图">
              <button
                onClick={resetView}
                style={{
                  padding: 8,
                  borderRadius: 'var(--radius-md)',
                  color: 'var(--text-secondary)',
                  display: 'flex',
                  alignItems: 'center',
                  background: 'none',
                  border: 'none',
                  cursor: 'pointer',
                }}
              >
                <RefreshCw size={16} />
              </button>
            </Tooltip>
        </div>
      </div>

      {/* 右键菜单 */}
      {contextMenu && (
        <div
          style={{
            position: 'fixed',
            left: contextMenu.x,
            top: contextMenu.y,
            zIndex: 1000,
            minWidth: 160,
            padding: '4px 0',
            borderRadius: 'var(--radius-md)',
            backgroundColor: 'var(--bg-secondary)',
            border: '1px solid var(--border-light)',
            boxShadow: 'var(--shadow-lg)',
          }}
        >
          <button
            onClick={() => handleAddChild(contextMenu.node)}
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
            onMouseEnter={(e) => {
              (e.currentTarget as HTMLElement).style.backgroundColor = 'var(--bg-hover)';
            }}
            onMouseLeave={(e) => {
              (e.currentTarget as HTMLElement).style.backgroundColor = 'transparent';
            }}
          >
            <Plus size={14} color="var(--text-secondary)" />
            添加子节点
          </button>

          <button
            onClick={() => handleStartLinking(contextMenu.node.id)}
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
            onMouseEnter={(e) => {
              (e.currentTarget as HTMLElement).style.backgroundColor = 'var(--bg-hover)';
            }}
            onMouseLeave={(e) => {
              (e.currentTarget as HTMLElement).style.backgroundColor = 'transparent';
            }}
          >
            <Link2 size={14} color="var(--text-secondary)" />
            连接到节点
          </button>

          <button
            onClick={() => handleSendSubtreeToCanvas(contextMenu.node)}
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
            onMouseEnter={(e) => {
              (e.currentTarget as HTMLElement).style.backgroundColor = 'var(--bg-hover)';
            }}
            onMouseLeave={(e) => {
              (e.currentTarget as HTMLElement).style.backgroundColor = 'transparent';
            }}
          >
            <Send size={14} color="var(--text-secondary)" />
            发送子树到画布
          </button>

          <div style={{ height: 1, backgroundColor: 'var(--border-light)', margin: '4px 0' }} />

          <button
            onClick={() => handleDeleteNode(contextMenu.node.id)}
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
            onMouseEnter={(e) => {
              (e.currentTarget as HTMLElement).style.backgroundColor = 'rgba(239,68,68,0.08)';
            }}
            onMouseLeave={(e) => {
              (e.currentTarget as HTMLElement).style.backgroundColor = 'transparent';
            }}
          >
            <Trash2 size={14} />
            删除节点
          </button>
        </div>
      )}
    </div>
  );
};

export default GraphView;
