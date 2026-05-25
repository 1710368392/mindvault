import { create } from 'zustand';
import { api } from '../utils/api';
import { useCreativityStore } from './creativityStore';
import type {
  BoardCanvasItem,
  BoardCanvasEdge,
  BoardStickyNote,
  BoardGraphNode,
  BoardGraphEdge,
  BoardCustomFolder,
  ConnectorPosition,
  EdgeControlPoint,
  CreativeChain,
} from '@shared/types';

// ===== 类型定义 =====

export type BoardViewMode = 'board' | 'canvas' | 'graph' | 'folder' | 'outline' | 'chat';

interface BoardState {
  // 基础看板
  boards: any[];
  currentBoard: any | null;
  isLoading: boolean;

  // 画布数据
  canvasItems: BoardCanvasItem[];
  canvasEdges: BoardCanvasEdge[];

  // 便签数据
  stickyNotes: BoardStickyNote[];

  // 图谱数据
  graphNodes: BoardGraphNode[];
  graphEdges: BoardGraphEdge[];

  // 自定义文件夹
  customFolders: BoardCustomFolder[];

  // 创意链
  creativeChains: CreativeChain[];

  // per-board 视图模式
  viewMode: BoardViewMode;

  // 画布选中
  selectedCanvasItemIds: string[];

  // 连线模式
  isCanvasConnecting: boolean;
  connectingFromItemId: string | null;

  // 工具模式
  canvasToolMode: 'pointer' | 'hand';
  setCanvasToolMode: (mode: 'pointer' | 'hand') => void;

  // 画布视图状态（缩放和偏移）- 跨页面保持
  canvasScale: number;
  canvasOffset: { x: number; y: number };
  setCanvasScale: (scale: number) => void;
  setCanvasOffset: (offset: { x: number; y: number }) => void;

  // ===== 基础方法 =====
  fetchBoards: () => Promise<void>;
  fetchBoard: (id: string) => Promise<void>;
  createBoard: (data: any) => Promise<any | null>;
  updateBoard: (id: string, data: any) => Promise<boolean>;
  deleteBoard: (id: string) => Promise<boolean>;
  setCurrentBoard: (b: any | null) => void;

  // ===== 画布方法 =====
  fetchCanvasData: (boardId: string) => Promise<void>;
  addCanvasItem: (boardId: string, creativityId: string, x: number, y: number, width?: number, height?: number, title?: string | null, content?: string | null, type?: string | null, isLinked?: boolean) => Promise<BoardCanvasItem | null>;
  removeCanvasItem: (itemId: string) => Promise<boolean>;
  updateCanvasItemPosition: (itemId: string, x: number, y: number) => Promise<void>;
  batchUpdateCanvasItemPositions: (updates: { id: string; x: number; y: number }[]) => void;
  syncCanvasItemPositions: (updates: { id: string; x: number; y: number }[]) => Promise<void>;
  updateCanvasItemSize: (itemId: string, width: number, height: number) => Promise<void>;
  updateCanvasItemContent: (itemId: string, data: { title?: string | null; content?: string | null; type?: string | null; subtype?: string | null; cardStyle?: string | null; priority?: number; emojiReaction?: string | null; isFavorite?: boolean | number; contentFormat?: string; isLinked?: boolean; creativityId?: string }) => Promise<void>;
  addCanvasEdge: (boardId: string, sourceId: string, targetId: string, edgeType: string, sourceConnector?: ConnectorPosition | null, targetConnector?: ConnectorPosition | null) => Promise<BoardCanvasEdge | null>;
  removeCanvasEdge: (edgeId: string) => Promise<boolean>;
  updateCanvasEdgeConnector: (edgeId: string, isSource: boolean, connector: ConnectorPosition | null) => Promise<void>;
  updateCanvasEdgeControlPoints: (edgeId: string, controlPoints: EdgeControlPoint[] | null) => Promise<void>;
  updateCanvasEdgeLabel: (edgeId: string, label: string) => Promise<void>;

  // ===== 便签方法 =====
  fetchStickyNotes: (boardId: string) => Promise<void>;
  addStickyNote: (boardId: string, data: { title?: string; content?: string; color?: string; positionX?: number; positionY?: number }) => Promise<BoardStickyNote | null>;
  sendToBoard: (noteId: string) => Promise<boolean>;
  updateStickyNote: (noteId: string, data: any) => Promise<boolean>;
  removeStickyNote: (noteId: string) => Promise<boolean>;

  // ===== 图谱方法 =====
  fetchGraphData: (boardId: string) => Promise<void>;
  addGraphNode: (boardId: string, data: { creativityId?: string; parentId?: string; positionX?: number; positionY?: number; nodeType?: string; label?: string }) => Promise<BoardGraphNode | null>;
  updateGraphNodePosition: (nodeId: string, x: number, y: number) => Promise<void>;
  removeGraphNode: (nodeId: string) => Promise<boolean>;
  addGraphEdge: (boardId: string, sourceId: string, targetId: string, edgeType: string) => Promise<BoardGraphEdge | null>;
  removeGraphEdge: (edgeId: string) => Promise<boolean>;
  sendSubtreeToCanvas: (nodeId: string) => Promise<boolean>;

  // ===== 文件夹方法 =====
  fetchCustomFolders: (boardId: string) => Promise<void>;
  createFolder: (boardId: string, name: string, color?: string) => Promise<BoardCustomFolder | null>;
  updateFolder: (folderId: string, data: any) => Promise<boolean>;
  deleteFolder: (folderId: string) => Promise<boolean>;
  addToFolder: (folderId: string, creativityIds: string[]) => Promise<boolean>;
  removeFromFolder: (folderId: string, creativityIds: string[]) => Promise<boolean>;
  applyFolderToBoard: (folderId: string) => Promise<boolean>;

  // ===== 创意链方法 =====
  fetchCreativeChains: (boardId: string) => Promise<void>;
  createCreativeChain: (boardId: string, data: any) => Promise<CreativeChain | null>;
  updateCreativeChain: (boardId: string, chainId: string, data: any) => Promise<boolean>;
  deleteCreativeChain: (boardId: string, chainId: string) => Promise<boolean>;
  createChainAndSticky: (boardId: string, data: any, stickyData?: any) => Promise<{ chain: CreativeChain; sticky: BoardStickyNote } | null>;

  // ===== 选中方法 =====
  toggleCanvasItemSelection: (itemId: string) => void;
  clearCanvasSelection: () => void;
  setCanvasConnecting: (connecting: boolean, fromItemId?: string | null) => void;

  // ===== 视图模式 =====
  setViewMode: (mode: BoardViewMode) => void;

  // ===== 清理 =====
  clearBoardData: () => void;
}

export const useBoardStore = create<BoardState>((set, get) => ({
  // ===== 基础状态 =====
  boards: [],
  currentBoard: null,
  isLoading: false,

  // ===== 画布状态 =====
  canvasItems: [],
  canvasEdges: [],

  // ===== 便签状态 =====
  stickyNotes: [],

  // ===== 图谱状态 =====
  graphNodes: [],
  graphEdges: [],

  // ===== 文件夹状态 =====
  customFolders: [],

  // ===== 创意链状态 =====
  creativeChains: [],

  // ===== 视图模式 =====
  viewMode: 'board',

  // ===== 画布选中 =====
  selectedCanvasItemIds: [],

  // ===== 连线模式 =====
  isCanvasConnecting: false,
  connectingFromItemId: null,

  // ===== 工具模式 =====
  canvasToolMode: 'pointer',

  // ===== 画布视图状态 =====
  canvasScale: 1,
  canvasOffset: { x: 0, y: 0 },

  // ========================================
  // 基础方法
  // ========================================

  fetchBoards: async () => {
    set({ isLoading: true });
    try {
      const result = await api.board.list();
      set({ boards: result || [] });
    } catch (error) {
      console.error('获取看板列表失败:', error);
    } finally {
      set({ isLoading: false });
    }
  },

  fetchBoard: async (id) => {
    set({ isLoading: true });
    try {
      const result = await api.board.read(id);
      if (result) set({ currentBoard: result });
    } catch (error) {
      console.error('获取看板详情失败:', error);
    } finally {
      set({ isLoading: false });
    }
  },

  createBoard: async (data) => {
    set({ isLoading: true });
    try {
      const result = await api.board.create(data);
      if (result) {
        await get().fetchBoards();
        return result;
      }
      return null;
    } catch (error) {
      console.error('创建看板失败:', error);
      return null;
    } finally {
      set({ isLoading: false });
    }
  },

  updateBoard: async (id, data) => {
    try {
      const result = await api.board.update(id, data);
      if (result) {
        // 立即更新 currentBoard（如果是当前看板）
        set((s) => ({
          currentBoard: s.currentBoard?.id === id ? { ...s.currentBoard, ...data } : s.currentBoard,
          // 同时更新 boards 数组
          boards: s.boards.map((b) => (b.id === id ? { ...b, ...data } : b)),
        }));
      }
      return result;
    } catch (error) {
      console.error('更新看板失败:', error);
      return false;
    }
  },

  deleteBoard: async (id) => {
    try {
      await api.board.delete(id);
      await get().fetchBoards();
      if (get().currentBoard?.id === id) set({ currentBoard: null });
      return true;
    } catch (error) {
      console.error('删除看板失败:', error);
      return false;
    }
  },

  setCurrentBoard: (b) => set({ currentBoard: b }),

  // ========================================
  // 画布方法
  // ========================================

  fetchCanvasData: async (boardId) => {
    try {
      const [items, edges] = await Promise.all([
        api.board.canvas.listItems(boardId),
        api.board.canvas.listEdges(boardId),
      ]);
      set({
        canvasItems: (items as BoardCanvasItem[]) || [],
        canvasEdges: (edges as BoardCanvasEdge[]) || [],
      });
    } catch (error) {
      console.error('获取画布数据失败:', error);
    }
  },

  addCanvasItem: async (boardId, creativityId, x, y, width?, height?, title?, content?, type?, isLinked?, subtype?, cardStyle?, priority?, emojiReaction?, contentFormat?) => {
    try {
      const result = await api.board.canvas.addItem(boardId, creativityId, x, y, width, height, title, content, type, isLinked, subtype, cardStyle, priority, emojiReaction, contentFormat);
      const item = result as BoardCanvasItem;
      if (item) {
        if (isLinked && creativityId) {
          const { creativities } = useCreativityStore.getState();
          const creativity = creativities.find((c: any) => c.id === creativityId);
          if (creativity) {
            item.creativity = creativity;
          } else if (title || content || type) {
            item.creativity = {
              id: creativityId,
              title: title || '',
              content: content || '',
              type: type || 'text',
            } as any;
          }
        }
        set((s) => ({ canvasItems: [...s.canvasItems, item] }));
        return item;
      }
      return null;
    } catch (error) {
      console.error('添加画布项失败:', error);
      return null;
    }
  },

  removeCanvasItem: async (itemId) => {
    try {
      const result = await api.board.canvas.removeItem(itemId);
      if (result) {
        set((s) => ({
          canvasItems: s.canvasItems.filter((i) => i.id !== itemId),
          canvasEdges: s.canvasEdges.filter(
            (e) => e.sourceItemId !== itemId && e.targetItemId !== itemId
          ),
          selectedCanvasItemIds: s.selectedCanvasItemIds.filter((id) => id !== itemId),
        }));
        return true;
      }
      return false;
    } catch (error) {
      console.error('移除画布项失败:', error);
      return false;
    }
  },

  updateCanvasItemPosition: async (itemId, x, y) => {
    try {
      await api.board.canvas.updatePosition(itemId, x, y);
      set((s) => ({
        canvasItems: s.canvasItems.map((i) =>
          i.id === itemId ? { ...i, positionX: x, positionY: y } : i
        ),
      }));
    } catch (error) {
      console.error('更新画布项位置失败:', error);
    }
  },

  batchUpdateCanvasItemPositions: (updates) => {
    set((s) => ({
      canvasItems: s.canvasItems.map((item) => {
        const update = updates.find(u => u.id === item.id);
        if (update) return { ...item, positionX: update.x, positionY: update.y };
        return item;
      }),
    }));
  },

  syncCanvasItemPositions: async (updates) => {
    try {
      for (const update of updates) {
        await api.board.canvas.updatePosition(update.id, update.x, update.y);
      }
    } catch (error) {
      console.error('同步画布项位置失败:', error);
    }
  },

  updateCanvasItemSize: async (itemId, width, height) => {
    try {
      await api.board.canvas.updateSize(itemId, width, height);
      set((s) => ({
        canvasItems: s.canvasItems.map((i) =>
          i.id === itemId ? { ...i, width, height } : i
        ),
      }));
    } catch (error) {
      console.error('更新画布项尺寸失败:', error);
    }
  },

  bringCanvasItemToFront: (itemId: string) => {
    set((s) => {
      const item = s.canvasItems.find(i => i.id === itemId);
      if (!item) return s;
      const others = s.canvasItems.filter(i => i.id !== itemId);
      return { canvasItems: [...others, item] };
    });
  },

  updateCanvasItemContent: async (itemId, data) => {
    try {
      const result = await api.board.canvas.updateContent(itemId, data);
      if (!result) {
        throw new Error('更新画布项内容失败: IPC返回null');
      }
      set((s) => ({
        canvasItems: s.canvasItems.map((i) =>
          i.id === itemId ? { ...i, ...result } : i
        ),
      }));
    } catch (error) {
      console.error('更新画布项内容失败:', error);
      throw error;
    }
  },

  addCanvasEdge: async (boardId, sourceId, targetId, edgeType, sourceConnector, targetConnector) => {
    try {
      const sc = sourceConnector || { side: 'right', offset: 0.5 };
      const tc = targetConnector || { side: 'left', offset: 0.5 };
      const result = await api.board.canvas.addEdge(boardId, sourceId, targetId, edgeType, sc, tc);
      const edge = result as BoardCanvasEdge;
      if (edge) {
        const edgeWithConnectors: BoardCanvasEdge = {
          ...edge,
          sourceConnector: edge.sourceConnector || sc,
          targetConnector: edge.targetConnector || tc,
        };
        set((s) => {
          return { canvasEdges: [...s.canvasEdges, edgeWithConnectors] };
        });
        return edgeWithConnectors;
      }
      return null;
    } catch (error) {
      console.error('添加画布连线失败:', error);
      return null;
    }
  },

  removeCanvasEdge: async (edgeId) => {
    try {
      const result = await api.board.canvas.removeEdge(edgeId);
      if (result) {
        set((s) => ({
          canvasEdges: s.canvasEdges.filter((e) => e.id !== edgeId),
        }));
        return true;
      }
      return false;
    } catch (error) {
      console.error('移除画布连线失败:', error);
      return false;
    }
  },

  updateCanvasEdgeConnector: async (edgeId, isSource, connector) => {
    try {
      set((s) => ({
        canvasEdges: s.canvasEdges.map((e) => {
          if (e.id === edgeId) {
            return isSource
              ? { ...e, sourceConnector: connector }
              : { ...e, targetConnector: connector };
          }
          return e;
        }),
      }));
      await api.board.canvas.updateConnector(edgeId, isSource, connector);
    } catch (error) {
      console.error('更新连线连接点失败:', error);
    }
  },

  updateCanvasEdgeControlPoints: async (edgeId, controlPoints) => {
    try {
      set((s) => ({
        canvasEdges: s.canvasEdges.map((e) => {
          if (e.id === edgeId) {
            return { ...e, controlPoints };
          }
          return e;
        }),
      }));
      await api.board.canvas.updateControlPoints(edgeId, controlPoints);
    } catch (error) {
      console.error('更新连线控制点失败:', error);
    }
  },

  updateCanvasEdgeLabel: async (edgeId, label) => {
    try {
      set((s) => ({
        canvasEdges: s.canvasEdges.map((e) => {
          if (e.id === edgeId) {
            return { ...e, label };
          }
          return e;
        }),
      }));
      await api.board.canvas.updateEdgeLabel(edgeId, label);
    } catch (error) {
      console.error('更新连线标签失败:', error);
    }
  },

  // ========================================
  // 便签方法
  // ========================================

  fetchStickyNotes: async (boardId) => {
    try {
      const result = await api.board.sticky.list(boardId);
      set({ stickyNotes: (result as BoardStickyNote[]) || [] });
    } catch (error) {
      console.error('获取便签列表失败:', error);
    }
  },

  addStickyNote: async (boardId, data) => {
    try {
      const result = await api.board.sticky.add(boardId, data);
      const note = result as BoardStickyNote;
      if (note) {
        set((s) => ({ stickyNotes: [...s.stickyNotes, note] }));
        return note;
      }
      return null;
    } catch (error) {
      console.error('添加便签失败:', error);
      return null;
    }
  },

  sendToBoard: async (noteId) => {
    try {
      const note = get().stickyNotes.find((n) => n.id === noteId);
      if (!note || !note.sourceCreativityIds) return false;
      const boardId = note.boardId;
      // 将便签关联的创意添加到看板
      for (const creativityId of note.sourceCreativityIds) {
        await api.board.addCreativityRelation(boardId, creativityId);
      }
      return true;
    } catch (error) {
      console.error('发送便签到看板失败:', error);
      return false;
    }
  },

  updateStickyNote: async (noteId, data) => {
    try {
      const result = await api.board.sticky.update(noteId, data);
      if (result) {
        set((s) => ({
          stickyNotes: s.stickyNotes.map((n) =>
            n.id === noteId ? { ...n, ...data, updatedAt: new Date().toISOString() } : n
          ),
        }));
        return true;
      }
      return false;
    } catch (error) {
      console.error('更新便签失败:', error);
      return false;
    }
  },

  removeStickyNote: async (noteId) => {
    try {
      const result = await api.board.sticky.remove(noteId);
      if (result) {
        set((s) => ({
          stickyNotes: s.stickyNotes.filter((n) => n.id !== noteId),
        }));
        return true;
      }
      return false;
    } catch (error) {
      console.error('移除便签失败:', error);
      return false;
    }
  },

  // ========================================
  // 图谱方法
  // ========================================

  fetchGraphData: async (boardId) => {
    try {
      const [nodes, edges] = await Promise.all([
        api.board.graph.listNodes(boardId),
        api.board.graph.listEdges(boardId),
      ]);
      set({
        graphNodes: (nodes as BoardGraphNode[]) || [],
        graphEdges: (edges as BoardGraphEdge[]) || [],
      });
    } catch (error) {
      console.error('获取图谱数据失败:', error);
    }
  },

  addGraphNode: async (boardId, data) => {
    try {
      const result = await api.board.graph.addNode(boardId, data);
      const node = result as BoardGraphNode;
      if (node) {
        set((s) => ({ graphNodes: [...s.graphNodes, node] }));
        return node;
      }
      return null;
    } catch (error) {
      console.error('添加图谱节点失败:', error);
      return null;
    }
  },

  updateGraphNodePosition: async (nodeId, x, y) => {
    try {
      await api.board.graph.updatePosition(nodeId, x, y);
      set((s) => ({
        graphNodes: s.graphNodes.map((n) =>
          n.id === nodeId ? { ...n, positionX: x, positionY: y } : n
        ),
      }));
    } catch (error) {
      console.error('更新图谱节点位置失败:', error);
    }
  },

  removeGraphNode: async (nodeId) => {
    try {
      const result = await api.board.graph.removeNode(nodeId);
      if (result) {
        set((s) => ({
          graphNodes: s.graphNodes.filter((n) => n.id !== nodeId),
          graphEdges: s.graphEdges.filter(
            (e) => e.sourceNodeId !== nodeId && e.targetNodeId !== nodeId
          ),
        }));
        return true;
      }
      return false;
    } catch (error) {
      console.error('移除图谱节点失败:', error);
      return false;
    }
  },

  addGraphEdge: async (boardId, sourceId, targetId, edgeType) => {
    try {
      const result = await api.board.graph.addEdge(boardId, sourceId, targetId, edgeType);
      const edge = result as BoardGraphEdge;
      if (edge) {
        set((s) => ({ graphEdges: [...s.graphEdges, edge] }));
        return edge;
      }
      return null;
    } catch (error) {
      console.error('添加图谱连线失败:', error);
      return null;
    }
  },

  removeGraphEdge: async (edgeId) => {
    try {
      const result = await api.board.graph.removeEdge(edgeId);
      if (result) {
        set((s) => ({
          graphEdges: s.graphEdges.filter((e) => e.id !== edgeId),
        }));
        return true;
      }
      return false;
    } catch (error) {
      console.error('移除图谱连线失败:', error);
      return false;
    }
  },

  sendSubtreeToCanvas: async (nodeId) => {
    try {
      const subtree = await api.board.graph.getSubtree(nodeId);
      if (!subtree || !Array.isArray(subtree) || subtree.length === 0) return false;

      const boardId = get().currentBoard?.id;
      if (!boardId) return false;

      const { creativities } = useCreativityStore.getState();

      let subtreeOffset = 0;
      for (const node of subtree) {
        const graphNode = node as BoardGraphNode;
        if (graphNode.creativityId) {
          const full = creativities.find((c: any) => c.id === graphNode.creativityId);
          const c = full || ({} as any);
          const resolvedContent = c.mediaFilePath || c.content;
          const existingItems = get().canvasItems;
          let posX = graphNode.positionX || 100 + Math.random() * 400;
          let posY = graphNode.positionY || 100 + Math.random() * 400;
          posX += subtreeOffset;
          posY += subtreeOffset;
          const overlapping = existingItems.some(item => {
            const itemW = item.width || 240;
            const itemH = item.height || 140;
            return Math.abs(posX - item.positionX) < itemW * 0.5 &&
                   Math.abs(posY - item.positionY) < itemH * 0.5;
          });
          if (overlapping) {
            posX += 30;
            posY += 30;
          }
          subtreeOffset += 30;
          await get().addCanvasItem(
            boardId,
            graphNode.creativityId,
            posX,
            posY,
            undefined, undefined,
            c.title || null, resolvedContent || null, c.type || null, false,
            c.subtype || null, c.cardStyle || null, c.priority || 0,
            c.emojiReaction || null, c.contentFormat || 'markdown'
          );
        }
      }
      return true;
    } catch (error) {
      console.error('发送子树到画布失败:', error);
      return false;
    }
  },

  // ========================================
  // 文件夹方法
  // ========================================

  fetchCustomFolders: async (boardId) => {
    try {
      const result = await api.board.folder.list(boardId);
      set({ customFolders: (result as BoardCustomFolder[]) || [] });
    } catch (error) {
      console.error('获取文件夹列表失败:', error);
    }
  },

  createFolder: async (boardId, name, color) => {
    try {
      const result = await api.board.folder.create(boardId, name, color);
      const folder = result as BoardCustomFolder;
      if (folder) {
        set((s) => ({ customFolders: [...s.customFolders, folder] }));
        return folder;
      }
      return null;
    } catch (error) {
      console.error('创建文件夹失败:', error);
      return null;
    }
  },

  updateFolder: async (folderId, data) => {
    try {
      const result = await api.board.folder.update(folderId, data);
      if (result) {
        set((s) => ({
          customFolders: s.customFolders.map((f) =>
            f.id === folderId ? { ...f, ...data } : f
          ),
        }));
        return true;
      }
      return false;
    } catch (error) {
      console.error('更新文件夹失败:', error);
      return false;
    }
  },

  deleteFolder: async (folderId) => {
    try {
      const result = await api.board.folder.delete(folderId);
      if (result) {
        set((s) => ({
          customFolders: s.customFolders.filter((f) => f.id !== folderId),
        }));
        return true;
      }
      return false;
    } catch (error) {
      console.error('删除文件夹失败:', error);
      return false;
    }
  },

  addToFolder: async (folderId, creativityIds) => {
    try {
      const result = await api.board.folder.addItems(folderId, creativityIds);
      if (result) {
        // 更新文件夹的 itemCount
        set((s) => ({
          customFolders: s.customFolders.map((f) =>
            f.id === folderId
              ? { ...f, itemCount: (f.itemCount || 0) + creativityIds.length }
              : f
          ),
        }));
        return true;
      }
      return false;
    } catch (error) {
      console.error('添加到文件夹失败:', error);
      return false;
    }
  },

  removeFromFolder: async (folderId, creativityIds) => {
    try {
      const result = await api.board.folder.removeItems(folderId, creativityIds);
      if (result) {
        set((s) => ({
          customFolders: s.customFolders.map((f) =>
            f.id === folderId
              ? { ...f, itemCount: Math.max(0, (f.itemCount || 0) - creativityIds.length) }
              : f
          ),
        }));
        return true;
      }
      return false;
    } catch (error) {
      console.error('从文件夹移除失败:', error);
      return false;
    }
  },

  applyFolderToBoard: async (folderId) => {
    try {
      const boardId = get().currentBoard?.id;
      if (!boardId) return false;

      const folder = get().customFolders.find((f) => f.id === folderId);
      if (!folder) return false;

      const items = await api.board.folder.getItems(folderId);
      if (!items || !Array.isArray(items) || items.length === 0) return false;

      // 将文件夹中的创意关联到看板
      for (const item of items) {
        const creativityId = (item as any).creativityId || (item as any).id;
        if (creativityId) {
          await api.board.addCreativityRelation(boardId, creativityId);
        }
      }
      return true;
    } catch (error) {
      console.error('应用文件夹到看板失败:', error);
      return false;
    }
  },

  // ========================================
  // 创意链方法
  // ========================================

  fetchCreativeChains: async (boardId) => {
    try {
      const result = await api.board.creativeChain.list(boardId);
      set({ creativeChains: (result as CreativeChain[]) || [] });
    } catch (error) {
      console.error('获取创意链列表失败:', error);
    }
  },

  createCreativeChain: async (boardId, data) => {
    try {
      const result = await api.board.creativeChain.create(boardId, data);
      const chain = result as CreativeChain;
      if (chain) {
        set((s) => ({ creativeChains: [...s.creativeChains, chain] }));
        return chain;
      }
      return null;
    } catch (error) {
      console.error('创建创意链失败:', error);
      return null;
    }
  },

  updateCreativeChain: async (boardId, chainId, data) => {
    try {
      const result = await api.board.creativeChain.update(boardId, chainId, data);
      if (result) {
        set((s) => ({
          creativeChains: s.creativeChains.map((c) =>
            c.id === chainId ? { ...c, ...data, updatedAt: new Date().toISOString() } : c
          ),
        }));
        return true;
      }
      return false;
    } catch (error) {
      console.error('更新创意链失败:', error);
      return false;
    }
  },

  deleteCreativeChain: async (boardId, chainId) => {
    try {
      const result = await api.board.creativeChain.delete(boardId, chainId);
      if (result) {
        set((s) => ({
          creativeChains: s.creativeChains.filter((c) => c.id !== chainId),
        }));
        return true;
      }
      return false;
    } catch (error) {
      console.error('删除创意链失败:', error);
      return false;
    }
  },

  createChainAndSticky: async (boardId, data, stickyData) => {
    try {
      // 首先创建创意链
      const chain = await get().createCreativeChain(boardId, data);
      if (!chain) return null;

      // 创建便签默认数据
      const defaultStickyData = {
        title: chain.name || '未命名创意链',
        content: chain.description || '',
        color: chain.color || '#FFE082',
        positionX: stickyData?.positionX || 100 + Math.random() * 200,
        positionY: stickyData?.positionY || 100 + Math.random() * 200,
        type: 'creative-chain',
        creativeChainId: chain.id,
        sourceCreativityIds: chain.snapshot?.items?.map((item: any) => item.creativityId),
      };

      const sticky = await get().addStickyNote(boardId, defaultStickyData);
      if (!sticky) return null;

      return { chain, sticky };
    } catch (error) {
      console.error('创建创意链和便签失败:', error);
      return null;
    }
  },

  // ========================================
  // 选中方法
  // ========================================

  toggleCanvasItemSelection: (itemId) => {
    set((s) => {
      const exists = s.selectedCanvasItemIds.includes(itemId);
      return {
        selectedCanvasItemIds: exists
          ? s.selectedCanvasItemIds.filter((id) => id !== itemId)
          : [...s.selectedCanvasItemIds, itemId],
      };
    });
  },

  clearCanvasSelection: () => {
    set({ selectedCanvasItemIds: [] });
  },

  setCanvasConnecting: (connecting, fromItemId = null) => {
    console.log('[boardStore] setCanvasConnecting:', { connecting, fromItemId });
    set({
      isCanvasConnecting: connecting,
      connectingFromItemId: connecting ? fromItemId : null,
    });
  },

  // ========================================
  // 视图模式
  // ========================================

  setViewMode: (mode) => set({ viewMode: mode }),

  // ========================================
  // 工具模式
  // ========================================

  setCanvasToolMode: (mode) => set({ canvasToolMode: mode }),

  // ========================================
  // 画布视图状态
  // ========================================

  setCanvasScale: (scale) => set({ canvasScale: scale }),
  setCanvasOffset: (offset) => set({ canvasOffset: offset }),

  // ========================================
  // 清理
  // ========================================

  clearBoardData: () => {
    set({
      canvasItems: [],
      canvasEdges: [],
      stickyNotes: [],
      graphNodes: [],
      graphEdges: [],
      customFolders: [],
      creativeChains: [],
      selectedCanvasItemIds: [],
      isCanvasConnecting: false,
      connectingFromItemId: null,
      canvasToolMode: 'pointer',
    });
  },
}));
