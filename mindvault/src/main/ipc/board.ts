// @ts-nocheck
/**
 * 看板相关 IPC 处理器
 * 包含：看板CRUD、画布、便签、图谱、文件夹
 */

const { ipcMain } = require('electron');
const repo = require('../db/repository');
const dataSync = require('../services/data-sync');
const { app } = require('electron');
const path = require('path');
const fs = require('fs');

function registerBoardHandlers() {
  ipcMain.handle('board:list', () => {
    if (repo.db) {
      try {
        const results = repo.db.prepare('SELECT * FROM boards ORDER BY sort_order ASC').all();
        return repo.mapRows(results);
      } catch (e) { return []; }
    } else {
      return repo.JsonStore.get('boards') || [];
    }
  });

  ipcMain.handle('board:create', (event, data) => {
    const board = {
      id: repo.generateId(),
      name: data.name || '新看板',
      description: data.description || '',
      background: data.background || null,
      theme: data.theme || null,
      layout: data.layout || 'board',
      sortOrder: data.sortOrder || 0,
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    };

    if (repo.db) {
      try {
        repo.db.prepare('INSERT INTO boards (id, name, description, background, theme, layout, sort_order, created_at, updated_at) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)')
          .run(board.id, board.name, board.description, board.background, board.theme, board.layout, board.sortOrder, board.createdAt, board.updatedAt);
        const saved = repo.db.prepare('SELECT * FROM boards WHERE id = ?').get(board.id);
        dataSync.uploadBoard(board).catch(() => {});
        return repo.toCamelCase(saved);
      } catch (e) { console.error('[IPC] 创建看板失败:', e); return null; }
    } else {
      repo.JsonStore.get('boards').push(board);
      repo.JsonStore.save();
      return board;
    }
  });

  ipcMain.handle('board:read', (event, id) => {
    if (repo.db) {
      try {
        const result = repo.db.prepare('SELECT * FROM boards WHERE id = ?').get(id);
        return repo.toCamelCase(result);
      } catch (e) { return null; }
    } else {
      return repo.JsonStore.get('boards').find(b => b.id === id) || null;
    }
  });

  ipcMain.handle('board:update', (event, id, data) => {
    data.updatedAt = new Date().toISOString();
    if (repo.db) {
      try {
        const result = repo.safeBuildUpdate('boards', data);
        if (result) {
          result.values.push(id);
          repo.db.prepare(result.sql).run(...result.values);
        }
        const row = repo.db.prepare('SELECT * FROM boards WHERE id = ?').get(id);
        return repo.toCamelCase(row);
      } catch (e) { console.error('[IPC] 更新看板失败:', e); return null; }
    } else {
      const items = repo.JsonStore.get('boards');
      const idx = items.findIndex(b => b.id === id);
      if (idx >= 0) { items[idx] = { ...items[idx], ...data }; repo.JsonStore.save(); return items[idx]; }
      return null;
    }
  });

  ipcMain.handle('board:delete', (event, id) => {
    if (repo.db) {
      try {
        repo.db.prepare('DELETE FROM boards WHERE id = ?').run(id);
        dataSync.deleteBoard(id).catch(() => {});
        return true;
      } catch (e) { return false; }
    } else {
      const items = repo.JsonStore.get('boards').filter(b => b.id !== id);
      repo.JsonStore.set('boards', items);
      return true;
    }
  });

  ipcMain.handle('board:add-creativity', (event, boardId, creativityId) => {
    if (repo.db) {
      try {
        repo.db.prepare('INSERT OR IGNORE INTO board_creativities (board_id, creativity_id) VALUES (?, ?)').run(boardId, creativityId);
        return true;
      } catch (e) { return false; }
    } else {
      return true;
    }
  });

  ipcMain.handle('board:remove-creativity', (event, boardId, creativityId) => {
    if (repo.db) {
      try {
        repo.db.prepare('DELETE FROM board_creativities WHERE board_id = ? AND creativity_id = ?').run(boardId, creativityId);
        return true;
      } catch (e) { return false; }
    } else {
      return true;
    }
  });

  ipcMain.handle('board:list-creativities', (event, boardId) => {
    if (repo.db) {
      try {
        const results = repo.db.prepare(`
          SELECT c.* FROM creativities c
          INNER JOIN board_creativities bc ON c.id = bc.creativity_id
          WHERE bc.board_id = ?
        `).all(boardId);
        return repo.mapRows(results);
      } catch (e) { return []; }
    } else {
      return [];
    }
  });

  ipcMain.handle('board:add-creativity-relation', (event, boardId, creativityId, relatedId) => {
    if (repo.db) {
      try {
        const id = repo.generateId();
        repo.db.prepare('INSERT OR IGNORE INTO board_creativities (board_id, creativity_id) VALUES (?, ?)').run(boardId, creativityId);
        repo.db.prepare('INSERT OR IGNORE INTO board_creativities (board_id, creativity_id) VALUES (?, ?)').run(boardId, relatedId);
        return true;
      } catch (e) { return false; }
    } else {
      return true;
    }
  });

  ipcMain.handle('board:remove-creativity-relation', (event, boardId, creativityId, relatedId) => {
    return true;
  });

  ipcMain.handle('board:canvas-items', (event, boardId) => {
    if (repo.db) {
      try {
        const results = repo.db.prepare(`
          SELECT bci.*, c.title as c_title, c.content as c_content, c.type as c_type,
                 c.subtype as c_subtype, c.emoji_reaction as c_emoji_reaction,
                 c.priority as c_priority, c.content_format as c_content_format,
                 c.status as c_status, c.board_id as c_board_id,
                 c.position_x as c_position_x, c.position_y as c_position_y,
                 c.card_style as c_card_style, c.created_at as c_created_at,
                 c.updated_at as c_updated_at, c.last_reviewed_at as c_last_reviewed_at,
                 c.is_read as c_is_read, c.is_favorite as c_is_favorite,
                 c.template_id as c_template_id, c.word_count as c_word_count,
                 c.media_file_path as c_media_file_path,
                 c.thumbnail_path as c_thumbnail_path
          FROM board_canvas_items bci
          LEFT JOIN creativities c ON bci.creativity_id = c.id
          WHERE bci.board_id = ?
        `).all(boardId);
        const items = results.map((row: any) => {
          const item = repo.toCamelCase(row);
          let isLinked = !!item.isLinked;
          if (isLinked && item.cTitle !== null) {
            item.creativity = {
              id: item.creativityId,
              title: item.cTitle,
              content: item.cContent,
              type: item.cType,
              subtype: item.cSubtype,
              emojiReaction: item.cEmojiReaction,
              priority: item.cPriority,
              contentFormat: item.cContentFormat,
              status: item.cStatus,
              boardId: item.cBoardId,
              positionX: item.cPositionX,
              positionY: item.cPositionY,
              cardStyle: item.cCardStyle,
              createdAt: item.cCreatedAt,
              updatedAt: item.cUpdatedAt,
              lastReviewedAt: item.cLastReviewedAt,
              isRead: !!item.cIsRead,
              isFavorite: !!item.cIsFavorite,
              templateId: item.cTemplateId,
              wordCount: item.cWordCount,
              mediaFilePath: item.cMediaFilePath || undefined,
              thumbnailPath: item.cThumbnailPath || undefined,
            };
          } else if (isLinked && (item.cTitle === null || item.creativityId === null)) {
            isLinked = false;
            item.isLinked = false;
          }
          delete item.cTitle;
          delete item.cContent;
          delete item.cType;
          delete item.cSubtype;
          delete item.cEmojiReaction;
          delete item.cPriority;
          delete item.cContentFormat;
          delete item.cStatus;
          delete item.cBoardId;
          delete item.cPositionX;
          delete item.cPositionY;
          delete item.cCardStyle;
          delete item.cCreatedAt;
          delete item.cUpdatedAt;
          delete item.cLastReviewedAt;
          delete item.cIsRead;
          delete item.cIsFavorite;
          delete item.cTemplateId;
          delete item.cWordCount;
          delete item.cMediaFilePath;
          delete item.cThumbnailPath;
          return item;
        });
        console.log('[IPC] 画布项列表加载:', items.length, '项, 非linked项字段示例:',
          items.filter(i => !i.isLinked).slice(0, 1).map(i => ({
            id: i.id, title: i.title, subtype: i.subtype, cardStyle: i.cardStyle,
            priority: i.priority, isFavorite: i.isFavorite, contentFormat: i.contentFormat
          }))
        );
        return items;
      } catch (e) { console.error('[IPC] 加载画布项失败:', e); return []; }
    } else {
      const board = repo.JsonStore.get('boards').find(b => b.id === boardId);
      return (board && board.canvasItems) || [];
    }
  });

  ipcMain.handle('board:canvas-item-create', (event, boardId, data) => {
    const item = {
      id: repo.generateId(),
      boardId,
      creativityId: data.creativityId || null,
      positionX: data.positionX || 0,
      positionY: data.positionY || 0,
      width: data.width || 200,
      height: data.height || 150,
      title: data.title || null,
      content: data.content || null,
      type: data.type || null,
      subtype: data.subtype || null,
      cardStyle: data.cardStyle || null,
      priority: data.priority || 0,
      emojiReaction: data.emojiReaction || null,
      isFavorite: data.isFavorite ? 1 : 0,
      contentFormat: data.contentFormat || 'markdown',
      isLinked: data.isLinked ? 1 : 0,
      createdAt: new Date().toISOString(),
    };

    if (repo.db) {
      try {
        repo.db.prepare('INSERT INTO board_canvas_items (id, board_id, creativity_id, position_x, position_y, width, height, title, content, type, subtype, card_style, priority, emoji_reaction, is_favorite, content_format, is_linked, created_at) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)')
          .run(item.id, item.boardId, item.creativityId, item.positionX, item.positionY, item.width, item.height, item.title, item.content, item.type, item.subtype, item.cardStyle, item.priority, item.emojiReaction, item.isFavorite, item.contentFormat, item.isLinked, item.createdAt);
        const saved = repo.db.prepare('SELECT * FROM board_canvas_items WHERE id = ?').get(item.id);
        return repo.toCamelCase(saved);
      } catch (e) { console.error('[IPC] 创建画布项失败:', e); return null; }
    } else {
      return item;
    }
  });

  ipcMain.handle('board:canvas-item-update', (event, boardId, itemId, data) => {
    if (repo.db) {
      try {
        const updateData = { ...data };
        if (updateData.isFavorite !== undefined) {
          updateData.isFavorite = updateData.isFavorite ? 1 : 0;
        }
        if (updateData.isLinked !== undefined) {
          updateData.isLinked = updateData.isLinked ? 1 : 0;
        }
        const result = repo.safeBuildUpdate('board_canvas_items', updateData);
        if (!result) return null;
        result.values.push(itemId);
        const info = repo.db.prepare(result.sql).run(...result.values);
        if (info.changes === 0) {
          console.error('[IPC] 更新画布项内容失败: 未找到匹配行', { itemId, data });
          return null;
        }
        const row = repo.db.prepare('SELECT * FROM board_canvas_items WHERE id = ?').get(itemId);
        return repo.toCamelCase(row);
      } catch (e) { console.error('[IPC] 更新画布项内容失败:', e, { itemId, data }); return null; }
    } else {
      return null;
    }
  });

  ipcMain.handle('board:canvas-item-delete', (event, boardId, itemId) => {
    if (repo.db) {
      try {
        if (boardId) {
          repo.db.prepare('DELETE FROM board_canvas_items WHERE id = ? AND board_id = ?').run(itemId, boardId);
        } else {
          repo.db.prepare('DELETE FROM board_canvas_items WHERE id = ?').run(itemId);
        }
        return true;
      } catch (e) { return false; }
    } else {
      return true;
    }
  });

  ipcMain.handle('board:canvas-update-position', (event, itemId, x, y) => {
    if (repo.db) {
      try {
        repo.db.prepare('UPDATE board_canvas_items SET position_x = ?, position_y = ? WHERE id = ?').run(x, y, itemId);
        return true;
      } catch (e) { console.error('[IPC] 更新画布项位置失败:', e); return false; }
    } else {
      const boards = repo.JsonStore.get('boards') || [];
      for (const board of boards) {
        const items = board.canvasItems || [];
        const item = items.find((i: any) => i.id === itemId);
        if (item) { item.positionX = x; item.positionY = y; repo.JsonStore.save(); return true; }
      }
      return false;
    }
  });

  ipcMain.handle('board:graph-update-position', (event, nodeId, x, y) => {
    if (repo.db) {
      try {
        repo.db.prepare('UPDATE board_graph_nodes SET position_x = ?, position_y = ? WHERE id = ?').run(x, y, nodeId);
        return true;
      } catch (e) { console.error('[IPC] 更新图谱节点位置失败:', e); return false; }
    } else {
      return false;
    }
  });

  ipcMain.handle('board:canvas-edges', (event, boardId) => {
    if (repo.db) {
      try {
        const results = repo.db.prepare('SELECT * FROM board_canvas_edges WHERE board_id = ?').all(boardId);
        return repo.mapRows(results).map((edge: any) => ({
          ...edge,
          sourceConnector: edge.sourceConnector ? JSON.parse(edge.sourceConnector) : null,
          targetConnector: edge.targetConnector ? JSON.parse(edge.targetConnector) : null,
        }));
      } catch (e) { return []; }
    } else {
      return [];
    }
  });

  ipcMain.handle('board:canvas-edge-create', (event, boardId, data) => {
    const sourceConnectorJson = data.sourceConnector ? JSON.stringify(data.sourceConnector) : null;
    const targetConnectorJson = data.targetConnector ? JSON.stringify(data.targetConnector) : null;
    const edge = {
      id: repo.generateId(),
      boardId,
      sourceItemId: data.sourceItemId,
      targetItemId: data.targetItemId,
      edgeType: data.edgeType || 'related',
      label: data.label || '',
      sourceConnector: data.sourceConnector || null,
      targetConnector: data.targetConnector || null,
      createdAt: new Date().toISOString(),
    };

    if (repo.db) {
      try {
        repo.db.prepare('INSERT INTO board_canvas_edges (id, board_id, source_item_id, target_item_id, edge_type, label, source_connector, target_connector, created_at) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)')
          .run(edge.id, edge.boardId, edge.sourceItemId, edge.targetItemId, edge.edgeType, edge.label, sourceConnectorJson, targetConnectorJson, edge.createdAt);
        return edge;
      } catch (e) { console.error('[IPC] 创建画布边失败:', e); return null; }
    } else {
      return edge;
    }
  });

  ipcMain.handle('board:canvas-edge-update-connector', (event, edgeId, isSource, connector) => {
    if (repo.db) {
      try {
        const connectorJson = connector ? JSON.stringify(connector) : null;
        const column = isSource ? 'source_connector' : 'target_connector';
        repo.db.prepare(`UPDATE board_canvas_edges SET ${column} = ? WHERE id = ?`).run(connectorJson, edgeId);
        return true;
      } catch (e) { console.error('[IPC] 更新连线连接点失败:', e); return false; }
    } else {
      return true;
    }
  });

  ipcMain.handle('board:canvas-edge-update-control-points', (event, edgeId, controlPoints) => {
    if (repo.db) {
      try {
        const cpJson = controlPoints ? JSON.stringify(controlPoints) : null;
        repo.db.prepare('UPDATE board_canvas_edges SET control_points = ? WHERE id = ?').run(cpJson, edgeId);
        return true;
      } catch (e) { console.error('[IPC] 更新连线控制点失败:', e); return false; }
    } else {
      return true;
    }
  });

  ipcMain.handle('board:canvas-edge-update-label', (event, edgeId, label) => {
    if (repo.db) {
      try {
        repo.db.prepare('UPDATE board_canvas_edges SET label = ? WHERE id = ?').run(label, edgeId);
        return true;
      } catch (e) { console.error('[IPC] 更新连线标签失败:', e); return false; }
    } else {
      return true;
    }
  });

  ipcMain.handle('board:canvas-edge-update-type', (event, edgeId, edgeType) => {
    if (repo.db) {
      try {
        repo.db.prepare('UPDATE board_canvas_edges SET edge_type = ? WHERE id = ?').run(edgeType, edgeId);
        return true;
      } catch (e) { console.error('[IPC] 更新连线类型失败:', e); return false; }
    } else {
      return true;
    }
  });

  ipcMain.handle('board:canvas-edge-delete', (event, boardId, edgeId) => {
    if (repo.db) {
      try {
        if (boardId) {
          repo.db.prepare('DELETE FROM board_canvas_edges WHERE id = ? AND board_id = ?').run(edgeId, boardId);
        } else {
          repo.db.prepare('DELETE FROM board_canvas_edges WHERE id = ?').run(edgeId);
        }
        return true;
      } catch (e) { return false; }
    } else {
      return true;
    }
  });

  ipcMain.handle('board:sticky-notes', (event, boardId) => {
    if (repo.db) {
      try {
        const results = repo.db.prepare('SELECT * FROM board_sticky_notes WHERE board_id = ?').all(boardId);
        return repo.mapRows(results).map((note: any) => ({
          ...note,
          sourceCreativityIds: note.sourceCreativityIds ? JSON.parse(note.sourceCreativityIds) : null,
          tags: note.tags ? JSON.parse(note.tags) : null,
        }));
      } catch (e) { return []; }
    } else {
      const board = repo.JsonStore.get('boards').find(b => b.id === boardId);
      return (board && board.stickyNotes) || [];
    }
  });

  ipcMain.handle('board:sticky-note-create', (event, boardId, data) => {
    const now = new Date().toISOString();
    const sourceCreativityIds = data.sourceCreativityIds ? JSON.stringify(data.sourceCreativityIds) : null;
    const tags = data.tags ? JSON.stringify(data.tags) : null;
    const note = {
      id: repo.generateId(),
      boardId,
      title: data.title || '',
      content: data.content || '',
      color: data.color || '#FEF3C7',
      positionX: data.positionX || 0,
      positionY: data.positionY || 0,
      width: data.width || 200,
      height: data.height || 150,
      sourceCreativityIds: data.sourceCreativityIds || null,
      sortOrder: data.sortOrder || 0,
      type: data.type || 'note',
      creativeChainId: data.creativeChainId || null,
      subtype: data.subtype || null,
      tags: data.tags || null,
      createdAt: now,
      updatedAt: now,
    };

    if (repo.db) {
      try {
        repo.db.prepare(`INSERT INTO board_sticky_notes
          (id, board_id, title, content, color, position_x, position_y, width, height,
           source_creativity_ids, sort_order, type, creative_chain_id, subtype, tags, created_at, updated_at)
          VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`)
          .run(note.id, note.boardId, note.title, note.content, note.color,
               note.positionX, note.positionY, note.width, note.height,
               sourceCreativityIds, note.sortOrder, note.type, note.creativeChainId,
               note.subtype, tags, note.createdAt, note.updatedAt);
        const saved = repo.db.prepare('SELECT * FROM board_sticky_notes WHERE id = ?').get(note.id);
        const result = repo.toCamelCase(saved);
        return {
          ...result,
          sourceCreativityIds: result.sourceCreativityIds ? JSON.parse(result.sourceCreativityIds) : null,
          tags: result.tags ? JSON.parse(result.tags) : null,
        };
      } catch (e) { console.error('[IPC] 创建便签失败:', e); return null; }
    } else {
      return note;
    }
  });

  ipcMain.handle('board:sticky-note-update', (event, boardId, noteId, data) => {
    if (repo.db) {
      try {
        const updateData = { ...data };
        if ((updateData.sourceCreativityIds !== undefined && updateData.sourceCreativityIds !== null)) {
          updateData.sourceCreativityIds = JSON.stringify(updateData.sourceCreativityIds);
        }
        if (updateData.tags !== undefined && updateData.tags !== null) {
          updateData.tags = JSON.stringify(updateData.tags);
        }
        updateData.updatedAt = new Date().toISOString();
        const result = repo.safeBuildUpdate('board_sticky_notes', updateData);
        if (result) {
          result.values.push(noteId);
          repo.db.prepare(result.sql).run(...result.values);
        }
        const saved = repo.db.prepare('SELECT * FROM board_sticky_notes WHERE id = ?').get(noteId);
        const row = repo.toCamelCase(saved);
        return {
          ...row,
          sourceCreativityIds: row.sourceCreativityIds ? JSON.parse(row.sourceCreativityIds) : null,
          tags: row.tags ? JSON.parse(row.tags) : null,
        };
      } catch (e) { return null; }
    } else {
      return null;
    }
  });

  ipcMain.handle('board:sticky-note-delete', (event, boardId, noteId) => {
    if (repo.db) {
      try {
        repo.db.prepare('DELETE FROM board_sticky_notes WHERE id = ? AND board_id = ?').run(noteId, boardId);
        return true;
      } catch (e) { return false; }
    } else {
      return true;
    }
  });

  ipcMain.handle('board:graph-nodes', (event, boardId) => {
    if (repo.db) {
      try {
        return repo.db.prepare('SELECT * FROM board_graph_nodes WHERE board_id = ?').all(boardId);
      } catch (e) { return []; }
    } else {
      return [];
    }
  });

  ipcMain.handle('board:graph-node-create', (event, boardId, data) => {
    const node = {
      id: repo.generateId(),
      boardId,
      creativityId: data.creativityId || null,
      parentId: data.parentId || null,
      label: data.label || '',
      positionX: data.positionX || 0,
      positionY: data.positionY || 0,
      createdAt: new Date().toISOString(),
    };

    if (repo.db) {
      try {
        repo.db.prepare('INSERT INTO board_graph_nodes (id, board_id, creativity_id, parent_id, label, position_x, position_y, created_at) VALUES (?, ?, ?, ?, ?, ?, ?, ?)')
          .run(node.id, node.boardId, node.creativityId, node.parentId, node.label, node.positionX, node.positionY, node.createdAt);
        return node;
      } catch (e) { console.error('[IPC] 创建图谱节点失败:', e); return null; }
    } else {
      return node;
    }
  });

  ipcMain.handle('board:graph-node-update', (event, boardId, nodeId, data) => {
    if (repo.db) {
      try {
        const result = repo.safeBuildUpdate('board_graph_nodes', data);
        if (result) {
          result.values.push(nodeId);
          repo.db.prepare(result.sql).run(...result.values);
        }
        return repo.db.prepare('SELECT * FROM board_graph_nodes WHERE id = ?').get(nodeId);
      } catch (e) { return null; }
    } else {
      return null;
    }
  });

  ipcMain.handle('board:graph-node-delete', (event, boardId, nodeId) => {
    if (repo.db) {
      try {
        repo.db.prepare('DELETE FROM board_graph_nodes WHERE id = ? AND board_id = ?').run(nodeId, boardId);
        return true;
      } catch (e) { return false; }
    } else {
      return true;
    }
  });

  ipcMain.handle('board:graph-edges', (event, boardId) => {
    if (repo.db) {
      try {
        return repo.db.prepare('SELECT * FROM board_graph_edges WHERE board_id = ?').all(boardId);
      } catch (e) { return []; }
    } else {
      return [];
    }
  });

  ipcMain.handle('board:graph-edge-create', (event, boardId, data) => {
    const edge = {
      id: repo.generateId(),
      boardId,
      sourceNodeId: data.sourceNodeId,
      targetNodeId: data.targetNodeId,
      edgeType: data.edgeType || 'child',
      label: data.label || '',
      createdAt: new Date().toISOString(),
    };

    if (repo.db) {
      try {
        repo.db.prepare('INSERT INTO board_graph_edges (id, board_id, source_node_id, target_node_id, edge_type, label, created_at) VALUES (?, ?, ?, ?, ?, ?, ?)')
          .run(edge.id, edge.boardId, edge.sourceNodeId, edge.targetNodeId, edge.edgeType, edge.label, edge.createdAt);
        return edge;
      } catch (e) { console.error('[IPC] 创建图谱边失败:', e); return null; }
    } else {
      return edge;
    }
  });

  ipcMain.handle('board:graph-edge-delete', (event, boardId, edgeId) => {
    if (repo.db) {
      try {
        if (boardId) {
          repo.db.prepare('DELETE FROM board_graph_edges WHERE id = ? AND board_id = ?').run(edgeId, boardId);
        } else {
          repo.db.prepare('DELETE FROM board_graph_edges WHERE id = ?').run(edgeId);
        }
        return true;
      } catch (e) { return false; }
    } else {
      return true;
    }
  });

  ipcMain.handle('board:graph-get-subtree', (event, nodeId) => {
    if (repo.db) {
      try {
        const collectDescendants = (parentId: string): any[] => {
          const children = repo.db.prepare('SELECT * FROM board_graph_nodes WHERE parent_id = ?').all(parentId);
          let result: any[] = [];
          for (const child of children) {
            result.push(child);
            result = result.concat(collectDescendants(child.id));
          }
          return result;
        };
        const rootNode = repo.db.prepare('SELECT * FROM board_graph_nodes WHERE id = ?').get(nodeId);
        if (!rootNode) return [];
        return [rootNode, ...collectDescendants(nodeId)];
      } catch (e) { return []; }
    } else {
      return [];
    }
  });

  ipcMain.handle('board:folders', (event, boardId) => {
    if (repo.db) {
      try {
        return repo.db.prepare('SELECT * FROM board_custom_folders WHERE board_id = ? ORDER BY sort_order ASC').all(boardId);
      } catch (e) { return []; }
    } else {
      const board = repo.JsonStore.get('boards').find(b => b.id === boardId);
      return (board && board.folders) || [];
    }
  });

  ipcMain.handle('board:folder-create', (event, boardId, data) => {
    const folder = {
      id: repo.generateId(),
      boardId,
      name: data.name || '新文件夹',
      color: data.color || '#3B82F6',
      sortOrder: data.sortOrder || 0,
      createdAt: new Date().toISOString(),
    };

    if (repo.db) {
      try {
        repo.db.prepare('INSERT INTO board_custom_folders (id, board_id, name, color, sort_order, created_at) VALUES (?, ?, ?, ?, ?, ?)')
          .run(folder.id, folder.boardId, folder.name, folder.color, folder.sortOrder, folder.createdAt);
        return folder;
      } catch (e) { console.error('[IPC] 创建文件夹失败:', e); return null; }
    } else {
      return folder;
    }
  });

  ipcMain.handle('board:folder-update', (event, boardId, folderId, data) => {
    if (repo.db) {
      try {
        const result = repo.safeBuildUpdate('board_custom_folders', data);
        if (result) {
          result.values.push(folderId);
          repo.db.prepare(result.sql).run(...result.values);
        }
        return repo.db.prepare('SELECT * FROM board_custom_folders WHERE id = ?').get(folderId);
      } catch (e) { return null; }
    } else {
      return null;
    }
  });

  ipcMain.handle('board:folder-delete', (event, boardId, folderId) => {
    if (repo.db) {
      try {
        repo.db.prepare('DELETE FROM board_folder_items WHERE folder_id = ?').run(folderId);
        repo.db.prepare('DELETE FROM board_custom_folders WHERE id = ? AND board_id = ?').run(folderId, boardId);
        return true;
      } catch (e) { return false; }
    } else {
      return true;
    }
  });

  ipcMain.handle('board:folder-items', (event, boardId, folderId) => {
    if (repo.db) {
      try {
        return repo.db.prepare(`
          SELECT c.* FROM creativities c
          INNER JOIN board_folder_items bfi ON c.id = bfi.creativity_id
          WHERE bfi.folder_id = ?
        `).all(folderId);
      } catch (e) { return []; }
    } else {
      return [];
    }
  });

  ipcMain.handle('board:folder-add-item', (event, boardId, folderId, creativityId) => {
    if (repo.db) {
      try {
        repo.db.prepare('INSERT OR IGNORE INTO board_folder_items (folder_id, creativity_id) VALUES (?, ?)').run(folderId, creativityId);
        return true;
      } catch (e) { return false; }
    } else {
      return true;
    }
  });

  ipcMain.handle('board:folder-remove-item', (event, boardId, folderId, creativityId) => {
    if (repo.db) {
      try {
        repo.db.prepare('DELETE FROM board_folder_items WHERE folder_id = ? AND creativity_id = ?').run(folderId, creativityId);
        return true;
      } catch (e) { return false; }
    } else {
      return true;
    }
  });

  // --- 创意链管理 ---
    ipcMain.handle('creativeChain:list', (event, boardId) => {
      if (repo.db) {
        try {
          const rows = repo.db.prepare('SELECT * FROM creative_chains WHERE board_id = ? ORDER BY created_at DESC').all(boardId);
          return rows.map(r => ({
            ...r,
            tags: r.tags ? JSON.parse(r.tags) : [],
            snapshot: JSON.parse(r.snapshot)
          }));
        } catch (e) {
          console.error('[IPC] 获取创意链列表失败:', e);
          return [];
        }
      } else {
        return [];
      }
    });

    ipcMain.handle('creativeChain:create', (event, boardId, data) => {
      const id = repo.generateId();
      const now = new Date().toISOString();
      const chain = {
        id,
        board_id: boardId,
        name: data.name || '未命名创意链',
        description: data.description || '',
        tags: data.tags ? JSON.stringify(data.tags) : null,
        color: data.color || null,
        snapshot: JSON.stringify(data.snapshot || { items: [], edges: [] }),
        created_at: now,
        updated_at: now
      };

      if (repo.db) {
        try {
          repo.db.prepare(`INSERT INTO creative_chains 
            (id, board_id, name, description, tags, color, snapshot, created_at, updated_at) 
            VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`).run(
            chain.id, chain.board_id, chain.name, chain.description, 
            chain.tags, chain.color, chain.snapshot, chain.created_at, chain.updated_at
          );
          return { ...chain, tags: data.tags || [], snapshot: data.snapshot || { items: [], edges: [] } };
        } catch (e) {
          console.error('[IPC] 创建创意链失败:', e);
          return null;
        }
      } else {
        return null;
      }
    });

    ipcMain.handle('creativeChain:read', (event, boardId, chainId) => {
      if (repo.db) {
        try {
          const r = repo.db.prepare('SELECT * FROM creative_chains WHERE id = ? AND board_id = ?').get(chainId, boardId);
          if (!r) return null;
          return {
            ...r,
            tags: r.tags ? JSON.parse(r.tags) : [],
            snapshot: JSON.parse(r.snapshot)
          };
        } catch (e) {
          console.error('[IPC] 读取创意链失败:', e);
          return null;
        }
      } else {
        return null;
      }
    });

    ipcMain.handle('creativeChain:update', (event, boardId, chainId, data) => {
      const now = new Date().toISOString();
      
      if (repo.db) {
        try {
          const updateData = {};
          for (const [key, val] of Object.entries(data)) {
            if (key === 'snapshot' || key === 'tags') {
              updateData[key] = JSON.stringify(val);
            } else if (key !== 'id' && key !== 'boardId' && key !== 'board_id') {
              updateData[key] = val;
            }
          }
          updateData.updatedAt = now;
          const result = repo.safeBuildUpdate('creative_chains', updateData);
          if (result) {
            result.values.push(chainId);
            result.values.push(boardId);
            repo.db.prepare(result.sql.replace('WHERE id = ?', 'WHERE id = ? AND board_id = ?')).run(...result.values);
          }
          
          const r = repo.db.prepare('SELECT * FROM creative_chains WHERE id = ? AND board_id = ?').get(chainId, boardId);
          if (!r) return null;
          return {
            ...r,
            tags: r.tags ? JSON.parse(r.tags) : [],
            snapshot: JSON.parse(r.snapshot)
          };
        } catch (e) {
          console.error('[IPC] 更新创意链失败:', e);
          return null;
        }
      } else {
        return null;
      }
    });

    ipcMain.handle('creativeChain:delete', (event, boardId, chainId) => {
      if (repo.db) {
        try {
          repo.db.prepare('DELETE FROM creative_chains WHERE id = ? AND board_id = ?').run(chainId, boardId);
          return true;
        } catch (e) {
          console.error('[IPC] 删除创意链失败:', e);
          return false;
        }
      } else {
        return true;
      }
    });

    console.log('[IPC] 看板处理器已注册');

  // --- 看板图标管理 ---

  // 更新看板图标路径
  ipcMain.handle('board:update-icon', (event, boardId, iconPath) => {
    console.log('[IPC] 更新看板图标:', { boardId, iconPath });
    if (repo.db) {
      try {
        repo.db.prepare('UPDATE boards SET icon = ? WHERE id = ?').run(iconPath, boardId);
        console.log('[IPC] 看板图标更新成功');
        return true;
      } catch (e) {
        console.error('[IPC] 更新看板图标失败:', e);
        return false;
      }
    } else {
      const items = repo.JsonStore.get('boards');
      const idx = items.findIndex(b => b.id === boardId);
      if (idx >= 0) {
        items[idx].icon = iconPath;
        repo.JsonStore.save();
        return true;
      }
      return false;
    }
  });

  // 上传图标文件
  ipcMain.handle('board:upload-icon', async (event, boardId, imageData) => {
    try {
      const userDataPath = app.getPath('userData');
      const iconsDir = path.join(userDataPath, 'board-icons');
      
      console.log('[IPC] 上传图标:', { boardId, userDataPath, iconsDir });
      
      // 确保目录存在
      if (!fs.existsSync(iconsDir)) {
        fs.mkdirSync(iconsDir, { recursive: true });
      }
      
      // 解析 base64 数据
      const base64Data = imageData.replace(/^data:image\/\w+;base64,/, '');
      const buffer = Buffer.from(base64Data, 'base64');
      
      // 保存文件
      const fileName = `${boardId}.png`;
      const filePath = path.join(iconsDir, fileName);
      fs.writeFileSync(filePath, buffer);
      
      console.log('[IPC] 图标保存成功:', filePath);
      return filePath;
    } catch (e) {
      console.error('[IPC] 上传图标失败:', e);
      return null;
    }
  });

  // 删除图标
  ipcMain.handle('board:delete-icon', (event, boardId) => {
    try {
      // 删除文件
      const userDataPath = app.getPath('userData');
      const iconsDir = path.join(userDataPath, 'board-icons');
      const filePath = path.join(iconsDir, `${boardId}.png`);
      
      if (fs.existsSync(filePath)) {
        fs.unlinkSync(filePath);
      }
      
      // 清空数据库字段
      if (repo.db) {
        repo.db.prepare('UPDATE boards SET icon = NULL WHERE id = ?').run(boardId);
      } else {
        const items = repo.JsonStore.get('boards');
        const idx = items.findIndex(b => b.id === boardId);
        if (idx >= 0) {
          delete items[idx].icon;
          repo.JsonStore.save();
        }
      }
      
      return true;
    } catch (e) {
      console.error('[IPC] 删除图标失败:', e);
      return false;
    }
  });
  };

  module.exports = { registerBoardHandlers };
