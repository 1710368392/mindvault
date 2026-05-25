"use strict";
// @ts-nocheck
/**
 * 看板相关 IPC 处理器
 * 包含：看板CRUD、画布、便签、图谱、文件夹
 */
var __assign = (this && this.__assign) || function () {
    __assign = Object.assign || function(t) {
        for (var s, i = 1, n = arguments.length; i < n; i++) {
            s = arguments[i];
            for (var p in s) if (Object.prototype.hasOwnProperty.call(s, p))
                t[p] = s[p];
        }
        return t;
    };
    return __assign.apply(this, arguments);
};
var __spreadArray = (this && this.__spreadArray) || function (to, from, pack) {
    if (pack || arguments.length === 2) for (var i = 0, l = from.length, ar; i < l; i++) {
        if (ar || !(i in from)) {
            if (!ar) ar = Array.prototype.slice.call(from, 0, i);
            ar[i] = from[i];
        }
    }
    return to.concat(ar || Array.prototype.slice.call(from));
};
var ipcMain = require('electron').ipcMain;
var repo = require('../db/repository');
function registerBoardHandlers() {
    ipcMain.handle('board:list', function () {
        if (repo.db) {
            try {
                var results = repo.db.prepare('SELECT * FROM boards ORDER BY sort_order ASC').all();
                return repo.mapRows(results);
            }
            catch (e) {
                return [];
            }
        }
        else {
            return repo.JsonStore.get('boards') || [];
        }
    });
    ipcMain.handle('board:create', function (event, data) {
        var board = {
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
                var saved = repo.db.prepare('SELECT * FROM boards WHERE id = ?').get(board.id);
                return repo.toCamelCase(saved);
            }
            catch (e) {
                console.error('[IPC] 创建看板失败:', e);
                return null;
            }
        }
        else {
            repo.JsonStore.get('boards').push(board);
            repo.JsonStore.save();
            return board;
        }
    });
    ipcMain.handle('board:read', function (event, id) {
        if (repo.db) {
            try {
                var result = repo.db.prepare('SELECT * FROM boards WHERE id = ?').get(id);
                return repo.toCamelCase(result);
            }
            catch (e) {
                return null;
            }
        }
        else {
            return repo.JsonStore.get('boards').find(function (b) { return b.id === id; }) || null;
        }
    });
    ipcMain.handle('board:update', function (event, id, data) {
        var _a;
        data.updatedAt = new Date().toISOString();
        if (repo.db) {
            try {
                var fields = [];
                var values = [];
                for (var _i = 0, _b = Object.entries(data); _i < _b.length; _i++) {
                    var _c = _b[_i], key = _c[0], val = _c[1];
                    var col = key.replace(/([A-Z])/g, '_$1').toLowerCase();
                    fields.push("".concat(col, " = ?"));
                    values.push(val);
                }
                values.push(id);
                (_a = repo.db.prepare("UPDATE boards SET ".concat(fields.join(', '), " WHERE id = ?"))).run.apply(_a, values);
                var result = repo.db.prepare('SELECT * FROM boards WHERE id = ?').get(id);
                return repo.toCamelCase(result);
            }
            catch (e) {
                console.error('[IPC] 更新看板失败:', e);
                return null;
            }
        }
        else {
            var items = repo.JsonStore.get('boards');
            var idx = items.findIndex(function (b) { return b.id === id; });
            if (idx >= 0) {
                items[idx] = __assign(__assign({}, items[idx]), data);
                repo.JsonStore.save();
                return items[idx];
            }
            return null;
        }
    });
    ipcMain.handle('board:delete', function (event, id) {
        if (repo.db) {
            try {
                repo.db.prepare('DELETE FROM boards WHERE id = ?').run(id);
                return true;
            }
            catch (e) {
                return false;
            }
        }
        else {
            var items = repo.JsonStore.get('boards').filter(function (b) { return b.id !== id; });
            repo.JsonStore.set('boards', items);
            return true;
        }
    });
    ipcMain.handle('board:add-creativity', function (event, boardId, creativityId) {
        if (repo.db) {
            try {
                repo.db.prepare('INSERT OR IGNORE INTO board_creativities (board_id, creativity_id) VALUES (?, ?)').run(boardId, creativityId);
                return true;
            }
            catch (e) {
                return false;
            }
        }
        else {
            return true;
        }
    });
    ipcMain.handle('board:remove-creativity', function (event, boardId, creativityId) {
        if (repo.db) {
            try {
                repo.db.prepare('DELETE FROM board_creativities WHERE board_id = ? AND creativity_id = ?').run(boardId, creativityId);
                return true;
            }
            catch (e) {
                return false;
            }
        }
        else {
            return true;
        }
    });
    ipcMain.handle('board:list-creativities', function (event, boardId) {
        if (repo.db) {
            try {
                var results = repo.db.prepare("\n          SELECT c.* FROM creativities c\n          INNER JOIN board_creativities bc ON c.id = bc.creativity_id\n          WHERE bc.board_id = ?\n        ").all(boardId);
                return repo.mapRows(results);
            }
            catch (e) {
                return [];
            }
        }
        else {
            return [];
        }
    });
    ipcMain.handle('board:add-creativity-relation', function (event, boardId, creativityId, relatedId) {
        if (repo.db) {
            try {
                var id = repo.generateId();
                repo.db.prepare('INSERT OR IGNORE INTO board_creativities (board_id, creativity_id) VALUES (?, ?)').run(boardId, creativityId);
                repo.db.prepare('INSERT OR IGNORE INTO board_creativities (board_id, creativity_id) VALUES (?, ?)').run(boardId, relatedId);
                return true;
            }
            catch (e) {
                return false;
            }
        }
        else {
            return true;
        }
    });
    ipcMain.handle('board:remove-creativity-relation', function (event, boardId, creativityId, relatedId) {
        return true;
    });
    ipcMain.handle('board:canvas-items', function (event, boardId) {
        if (repo.db) {
            try {
                var results = repo.db.prepare("\n          SELECT bci.*, c.title as c_title, c.content as c_content, c.type as c_type,\n                 c.subtype as c_subtype, c.emoji_reaction as c_emoji_reaction,\n                 c.priority as c_priority, c.content_format as c_content_format,\n                 c.status as c_status, c.board_id as c_board_id,\n                 c.position_x as c_position_x, c.position_y as c_position_y,\n                 c.card_style as c_card_style, c.created_at as c_created_at,\n                 c.updated_at as c_updated_at, c.last_reviewed_at as c_last_reviewed_at,\n                 c.is_read as c_is_read, c.is_favorite as c_is_favorite,\n                 c.template_id as c_template_id, c.word_count as c_word_count,\n                 m.filepath as c_media_filepath\n          FROM board_canvas_items bci\n          LEFT JOIN creativities c ON bci.creativity_id = c.id\n          LEFT JOIN media m ON m.creativity_id = c.id AND m.sort_order = 0\n          WHERE bci.board_id = ?\n        ").all(boardId);
                var items = results.map(function (row) {
                    var item = repo.toCamelCase(row);
                    var isLinked = !!item.isLinked;
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
                            mediaFilePath: item.cMediaFilepath || undefined,
                        };
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
                    delete item.cMediaFilepath;
                    return item;
                });
                console.log('[IPC] 画布项列表加载:', items.length, '项, 非linked项字段示例:', items.filter(function (i) { return !i.isLinked; }).slice(0, 1).map(function (i) { return ({
                    id: i.id, title: i.title, subtype: i.subtype, cardStyle: i.cardStyle,
                    priority: i.priority, isFavorite: i.isFavorite, contentFormat: i.contentFormat
                }); }));
                return items;
            }
            catch (e) {
                console.error('[IPC] 加载画布项失败:', e);
                return [];
            }
        }
        else {
            var board = repo.JsonStore.get('boards').find(function (b) { return b.id === boardId; });
            return (board && board.canvasItems) || [];
        }
    });
    ipcMain.handle('board:canvas-item-create', function (event, boardId, data) {
        var item = {
            id: repo.generateId(),
            boardId: boardId,
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
                var saved = repo.db.prepare('SELECT * FROM board_canvas_items WHERE id = ?').get(item.id);
                return repo.toCamelCase(saved);
            }
            catch (e) {
                console.error('[IPC] 创建画布项失败:', e);
                return null;
            }
        }
        else {
            return item;
        }
    });
    ipcMain.handle('board:canvas-item-update', function (event, boardId, itemId, data) {
        var _a;
        if (repo.db) {
            try {
                var fields = [];
                var values = [];
                for (var _i = 0, _b = Object.entries(data); _i < _b.length; _i++) {
                    var _c = _b[_i], key = _c[0], val = _c[1];
                    var col = key.replace(/([A-Z])/g, '_$1').toLowerCase();
                    fields.push("".concat(col, " = ?"));
                    if (key === 'isFavorite') {
                        values.push(val ? 1 : 0);
                    }
                    else {
                        values.push(val);
                    }
                }
                values.push(itemId);
                var sql = "UPDATE board_canvas_items SET ".concat(fields.join(', '), " WHERE id = ?");
                console.log('[IPC] 画布项更新SQL:', sql);
                console.log('[IPC] 画布项更新值:', JSON.stringify(values));
                var info = (_a = repo.db.prepare(sql)).run.apply(_a, values);
                console.log('[IPC] 画布项更新结果: changes=', info.changes);
                if (info.changes === 0) {
                    console.error('[IPC] 更新画布项内容失败: 未找到匹配行', { itemId: itemId, data: data });
                    return null;
                }
                var result = repo.db.prepare('SELECT * FROM board_canvas_items WHERE id = ?').get(itemId);
                console.log('[IPC] 画布项更新后数据:', JSON.stringify(repo.toCamelCase(result)));
                return repo.toCamelCase(result);
            }
            catch (e) {
                console.error('[IPC] 更新画布项内容失败:', e, { itemId: itemId, data: data });
                return null;
            }
        }
        else {
            return null;
        }
    });
    ipcMain.handle('board:canvas-item-delete', function (event, boardId, itemId) {
        if (repo.db) {
            try {
                if (boardId) {
                    repo.db.prepare('DELETE FROM board_canvas_items WHERE id = ? AND board_id = ?').run(itemId, boardId);
                }
                else {
                    repo.db.prepare('DELETE FROM board_canvas_items WHERE id = ?').run(itemId);
                }
                return true;
            }
            catch (e) {
                return false;
            }
        }
        else {
            return true;
        }
    });
    ipcMain.handle('board:canvas-update-position', function (event, itemId, x, y) {
        if (repo.db) {
            try {
                repo.db.prepare('UPDATE board_canvas_items SET position_x = ?, position_y = ? WHERE id = ?').run(x, y, itemId);
                return true;
            }
            catch (e) {
                console.error('[IPC] 更新画布项位置失败:', e);
                return false;
            }
        }
        else {
            var boards = repo.JsonStore.get('boards') || [];
            for (var _i = 0, boards_1 = boards; _i < boards_1.length; _i++) {
                var board = boards_1[_i];
                var items = board.canvasItems || [];
                var item = items.find(function (i) { return i.id === itemId; });
                if (item) {
                    item.positionX = x;
                    item.positionY = y;
                    repo.JsonStore.save();
                    return true;
                }
            }
            return false;
        }
    });
    ipcMain.handle('board:graph-update-position', function (event, nodeId, x, y) {
        if (repo.db) {
            try {
                repo.db.prepare('UPDATE board_graph_nodes SET position_x = ?, position_y = ? WHERE id = ?').run(x, y, nodeId);
                return true;
            }
            catch (e) {
                console.error('[IPC] 更新图谱节点位置失败:', e);
                return false;
            }
        }
        else {
            return false;
        }
    });
    ipcMain.handle('board:canvas-edges', function (event, boardId) {
        if (repo.db) {
            try {
                var results = repo.db.prepare('SELECT * FROM board_canvas_edges WHERE board_id = ?').all(boardId);
                return repo.mapRows(results).map(function (edge) { return (__assign(__assign({}, edge), { sourceConnector: edge.sourceConnector ? JSON.parse(edge.sourceConnector) : null, targetConnector: edge.targetConnector ? JSON.parse(edge.targetConnector) : null })); });
            }
            catch (e) {
                return [];
            }
        }
        else {
            return [];
        }
    });
    ipcMain.handle('board:canvas-edge-create', function (event, boardId, data) {
        var sourceConnectorJson = data.sourceConnector ? JSON.stringify(data.sourceConnector) : null;
        var targetConnectorJson = data.targetConnector ? JSON.stringify(data.targetConnector) : null;
        var edge = {
            id: repo.generateId(),
            boardId: boardId,
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
            }
            catch (e) {
                console.error('[IPC] 创建画布边失败:', e);
                return null;
            }
        }
        else {
            return edge;
        }
    });
    ipcMain.handle('board:canvas-edge-update-connector', function (event, edgeId, isSource, connector) {
        if (repo.db) {
            try {
                var connectorJson = connector ? JSON.stringify(connector) : null;
                var column = isSource ? 'source_connector' : 'target_connector';
                repo.db.prepare("UPDATE board_canvas_edges SET ".concat(column, " = ? WHERE id = ?")).run(connectorJson, edgeId);
                return true;
            }
            catch (e) {
                console.error('[IPC] 更新连线连接点失败:', e);
                return false;
            }
        }
        else {
            return true;
        }
    });
    ipcMain.handle('board:canvas-edge-update-control-points', function (event, edgeId, controlPoints) {
        if (repo.db) {
            try {
                var cpJson = controlPoints ? JSON.stringify(controlPoints) : null;
                repo.db.prepare('UPDATE board_canvas_edges SET control_points = ? WHERE id = ?').run(cpJson, edgeId);
                return true;
            }
            catch (e) {
                console.error('[IPC] 更新连线控制点失败:', e);
                return false;
            }
        }
        else {
            return true;
        }
    });
    ipcMain.handle('board:canvas-edge-update-label', function (event, edgeId, label) {
        if (repo.db) {
            try {
                repo.db.prepare('UPDATE board_canvas_edges SET label = ? WHERE id = ?').run(label, edgeId);
                return true;
            }
            catch (e) {
                console.error('[IPC] 更新连线标签失败:', e);
                return false;
            }
        }
        else {
            return true;
        }
    });
    ipcMain.handle('board:canvas-edge-update-type', function (event, edgeId, edgeType) {
        if (repo.db) {
            try {
                repo.db.prepare('UPDATE board_canvas_edges SET edge_type = ? WHERE id = ?').run(edgeType, edgeId);
                return true;
            }
            catch (e) {
                console.error('[IPC] 更新连线类型失败:', e);
                return false;
            }
        }
        else {
            return true;
        }
    });
    ipcMain.handle('board:canvas-edge-delete', function (event, boardId, edgeId) {
        if (repo.db) {
            try {
                if (boardId) {
                    repo.db.prepare('DELETE FROM board_canvas_edges WHERE id = ? AND board_id = ?').run(edgeId, boardId);
                }
                else {
                    repo.db.prepare('DELETE FROM board_canvas_edges WHERE id = ?').run(edgeId);
                }
                return true;
            }
            catch (e) {
                return false;
            }
        }
        else {
            return true;
        }
    });
    ipcMain.handle('board:sticky-notes', function (event, boardId) {
        if (repo.db) {
            try {
                var results = repo.db.prepare('SELECT * FROM board_sticky_notes WHERE board_id = ?').all(boardId);
                return repo.mapRows(results).map(function (note) { return (__assign(__assign({}, note), { sourceCreativityIds: note.sourceCreativityIds ? JSON.parse(note.sourceCreativityIds) : null, tags: note.tags ? JSON.parse(note.tags) : null })); });
            }
            catch (e) {
                return [];
            }
        }
        else {
            var board = repo.JsonStore.get('boards').find(function (b) { return b.id === boardId; });
            return (board && board.stickyNotes) || [];
        }
    });
    ipcMain.handle('board:sticky-note-create', function (event, boardId, data) {
        var now = new Date().toISOString();
        var sourceCreativityIds = data.sourceCreativityIds ? JSON.stringify(data.sourceCreativityIds) : null;
        var tags = data.tags ? JSON.stringify(data.tags) : null;
        var note = {
            id: repo.generateId(),
            boardId: boardId,
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
                repo.db.prepare("INSERT INTO board_sticky_notes\n          (id, board_id, title, content, color, position_x, position_y, width, height,\n           source_creativity_ids, sort_order, type, creative_chain_id, subtype, tags, created_at, updated_at)\n          VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)")
                    .run(note.id, note.boardId, note.title, note.content, note.color, note.positionX, note.positionY, note.width, note.height, sourceCreativityIds, note.sortOrder, note.type, note.creativeChainId, note.subtype, tags, note.createdAt, note.updatedAt);
                var saved = repo.db.prepare('SELECT * FROM board_sticky_notes WHERE id = ?').get(note.id);
                var result = repo.toCamelCase(saved);
                return __assign(__assign({}, result), { sourceCreativityIds: result.sourceCreativityIds ? JSON.parse(result.sourceCreativityIds) : null, tags: result.tags ? JSON.parse(result.tags) : null });
            }
            catch (e) {
                console.error('[IPC] 创建便签失败:', e);
                return null;
            }
        }
        else {
            return note;
        }
    });
    ipcMain.handle('board:sticky-note-update', function (event, boardId, noteId, data) {
        var _a;
        if (repo.db) {
            try {
                var fields = [];
                var values = [];
                for (var _i = 0, _b = Object.entries(data); _i < _b.length; _i++) {
                    var _c = _b[_i], key = _c[0], val = _c[1];
                    var col = key.replace(/([A-Z])/g, '_$1').toLowerCase();
                    fields.push("".concat(col, " = ?"));
                    if ((key === 'sourceCreativityIds' || key === 'tags') && val !== null && val !== undefined) {
                        values.push(JSON.stringify(val));
                    }
                    else {
                        values.push(val);
                    }
                }
                fields.push('updated_at = ?');
                values.push(new Date().toISOString());
                values.push(noteId);
                (_a = repo.db.prepare("UPDATE board_sticky_notes SET ".concat(fields.join(', '), " WHERE id = ?"))).run.apply(_a, values);
                var saved = repo.db.prepare('SELECT * FROM board_sticky_notes WHERE id = ?').get(noteId);
                var result = repo.toCamelCase(saved);
                return __assign(__assign({}, result), { sourceCreativityIds: result.sourceCreativityIds ? JSON.parse(result.sourceCreativityIds) : null, tags: result.tags ? JSON.parse(result.tags) : null });
            }
            catch (e) {
                return null;
            }
        }
        else {
            return null;
        }
    });
    ipcMain.handle('board:sticky-note-delete', function (event, boardId, noteId) {
        if (repo.db) {
            try {
                repo.db.prepare('DELETE FROM board_sticky_notes WHERE id = ? AND board_id = ?').run(noteId, boardId);
                return true;
            }
            catch (e) {
                return false;
            }
        }
        else {
            return true;
        }
    });
    ipcMain.handle('board:graph-nodes', function (event, boardId) {
        if (repo.db) {
            try {
                return repo.db.prepare('SELECT * FROM board_graph_nodes WHERE board_id = ?').all(boardId);
            }
            catch (e) {
                return [];
            }
        }
        else {
            return [];
        }
    });
    ipcMain.handle('board:graph-node-create', function (event, boardId, data) {
        var node = {
            id: repo.generateId(),
            boardId: boardId,
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
            }
            catch (e) {
                console.error('[IPC] 创建图谱节点失败:', e);
                return null;
            }
        }
        else {
            return node;
        }
    });
    ipcMain.handle('board:graph-node-update', function (event, boardId, nodeId, data) {
        var _a;
        if (repo.db) {
            try {
                var fields = [];
                var values = [];
                for (var _i = 0, _b = Object.entries(data); _i < _b.length; _i++) {
                    var _c = _b[_i], key = _c[0], val = _c[1];
                    var col = key.replace(/([A-Z])/g, '_$1').toLowerCase();
                    fields.push("".concat(col, " = ?"));
                    values.push(val);
                }
                values.push(nodeId);
                (_a = repo.db.prepare("UPDATE board_graph_nodes SET ".concat(fields.join(', '), " WHERE id = ?"))).run.apply(_a, values);
                return repo.db.prepare('SELECT * FROM board_graph_nodes WHERE id = ?').get(nodeId);
            }
            catch (e) {
                return null;
            }
        }
        else {
            return null;
        }
    });
    ipcMain.handle('board:graph-node-delete', function (event, boardId, nodeId) {
        if (repo.db) {
            try {
                repo.db.prepare('DELETE FROM board_graph_nodes WHERE id = ? AND board_id = ?').run(nodeId, boardId);
                return true;
            }
            catch (e) {
                return false;
            }
        }
        else {
            return true;
        }
    });
    ipcMain.handle('board:graph-edges', function (event, boardId) {
        if (repo.db) {
            try {
                return repo.db.prepare('SELECT * FROM board_graph_edges WHERE board_id = ?').all(boardId);
            }
            catch (e) {
                return [];
            }
        }
        else {
            return [];
        }
    });
    ipcMain.handle('board:graph-edge-create', function (event, boardId, data) {
        var edge = {
            id: repo.generateId(),
            boardId: boardId,
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
            }
            catch (e) {
                console.error('[IPC] 创建图谱边失败:', e);
                return null;
            }
        }
        else {
            return edge;
        }
    });
    ipcMain.handle('board:graph-edge-delete', function (event, boardId, edgeId) {
        if (repo.db) {
            try {
                if (boardId) {
                    repo.db.prepare('DELETE FROM board_graph_edges WHERE id = ? AND board_id = ?').run(edgeId, boardId);
                }
                else {
                    repo.db.prepare('DELETE FROM board_graph_edges WHERE id = ?').run(edgeId);
                }
                return true;
            }
            catch (e) {
                return false;
            }
        }
        else {
            return true;
        }
    });
    ipcMain.handle('board:graph-get-subtree', function (event, nodeId) {
        if (repo.db) {
            try {
                var collectDescendants_1 = function (parentId) {
                    var children = repo.db.prepare('SELECT * FROM board_graph_nodes WHERE parent_id = ?').all(parentId);
                    var result = [];
                    for (var _i = 0, children_1 = children; _i < children_1.length; _i++) {
                        var child = children_1[_i];
                        result.push(child);
                        result = result.concat(collectDescendants_1(child.id));
                    }
                    return result;
                };
                var rootNode = repo.db.prepare('SELECT * FROM board_graph_nodes WHERE id = ?').get(nodeId);
                if (!rootNode)
                    return [];
                return __spreadArray([rootNode], collectDescendants_1(nodeId), true);
            }
            catch (e) {
                return [];
            }
        }
        else {
            return [];
        }
    });
    ipcMain.handle('board:folders', function (event, boardId) {
        if (repo.db) {
            try {
                return repo.db.prepare('SELECT * FROM board_custom_folders WHERE board_id = ? ORDER BY sort_order ASC').all(boardId);
            }
            catch (e) {
                return [];
            }
        }
        else {
            var board = repo.JsonStore.get('boards').find(function (b) { return b.id === boardId; });
            return (board && board.folders) || [];
        }
    });
    ipcMain.handle('board:folder-create', function (event, boardId, data) {
        var folder = {
            id: repo.generateId(),
            boardId: boardId,
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
            }
            catch (e) {
                console.error('[IPC] 创建文件夹失败:', e);
                return null;
            }
        }
        else {
            return folder;
        }
    });
    ipcMain.handle('board:folder-update', function (event, boardId, folderId, data) {
        var _a;
        if (repo.db) {
            try {
                var fields = [];
                var values = [];
                for (var _i = 0, _b = Object.entries(data); _i < _b.length; _i++) {
                    var _c = _b[_i], key = _c[0], val = _c[1];
                    var col = key.replace(/([A-Z])/g, '_$1').toLowerCase();
                    fields.push("".concat(col, " = ?"));
                    values.push(val);
                }
                values.push(folderId);
                (_a = repo.db.prepare("UPDATE board_custom_folders SET ".concat(fields.join(', '), " WHERE id = ?"))).run.apply(_a, values);
                return repo.db.prepare('SELECT * FROM board_custom_folders WHERE id = ?').get(folderId);
            }
            catch (e) {
                return null;
            }
        }
        else {
            return null;
        }
    });
    ipcMain.handle('board:folder-delete', function (event, boardId, folderId) {
        if (repo.db) {
            try {
                repo.db.prepare('DELETE FROM board_folder_items WHERE folder_id = ?').run(folderId);
                repo.db.prepare('DELETE FROM board_custom_folders WHERE id = ? AND board_id = ?').run(folderId, boardId);
                return true;
            }
            catch (e) {
                return false;
            }
        }
        else {
            return true;
        }
    });
    ipcMain.handle('board:folder-items', function (event, boardId, folderId) {
        if (repo.db) {
            try {
                return repo.db.prepare("\n          SELECT c.* FROM creativities c\n          INNER JOIN board_folder_items bfi ON c.id = bfi.creativity_id\n          WHERE bfi.folder_id = ?\n        ").all(folderId);
            }
            catch (e) {
                return [];
            }
        }
        else {
            return [];
        }
    });
    ipcMain.handle('board:folder-add-item', function (event, boardId, folderId, creativityId) {
        if (repo.db) {
            try {
                repo.db.prepare('INSERT OR IGNORE INTO board_folder_items (folder_id, creativity_id) VALUES (?, ?)').run(folderId, creativityId);
                return true;
            }
            catch (e) {
                return false;
            }
        }
        else {
            return true;
        }
    });
    ipcMain.handle('board:folder-remove-item', function (event, boardId, folderId, creativityId) {
        if (repo.db) {
            try {
                repo.db.prepare('DELETE FROM board_folder_items WHERE folder_id = ? AND creativity_id = ?').run(folderId, creativityId);
                return true;
            }
            catch (e) {
                return false;
            }
        }
        else {
            return true;
        }
    });
    // --- 创意链管理 ---
    ipcMain.handle('creativeChain:list', function (event, boardId) {
        if (repo.db) {
            try {
                var rows = repo.db.prepare('SELECT * FROM creative_chains WHERE board_id = ? ORDER BY created_at DESC').all(boardId);
                return rows.map(function (r) { return (__assign(__assign({}, r), { tags: r.tags ? JSON.parse(r.tags) : [], snapshot: JSON.parse(r.snapshot) })); });
            }
            catch (e) {
                console.error('[IPC] 获取创意链列表失败:', e);
                return [];
            }
        }
        else {
            return [];
        }
    });
    ipcMain.handle('creativeChain:create', function (event, boardId, data) {
        var id = repo.generateId();
        var now = new Date().toISOString();
        var chain = {
            id: id,
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
                repo.db.prepare("INSERT INTO creative_chains \n            (id, board_id, name, description, tags, color, snapshot, created_at, updated_at) \n            VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)").run(chain.id, chain.board_id, chain.name, chain.description, chain.tags, chain.color, chain.snapshot, chain.created_at, chain.updated_at);
                return __assign(__assign({}, chain), { tags: data.tags || [], snapshot: data.snapshot || { items: [], edges: [] } });
            }
            catch (e) {
                console.error('[IPC] 创建创意链失败:', e);
                return null;
            }
        }
        else {
            return null;
        }
    });
    ipcMain.handle('creativeChain:read', function (event, boardId, chainId) {
        if (repo.db) {
            try {
                var r = repo.db.prepare('SELECT * FROM creative_chains WHERE id = ? AND board_id = ?').get(chainId, boardId);
                if (!r)
                    return null;
                return __assign(__assign({}, r), { tags: r.tags ? JSON.parse(r.tags) : [], snapshot: JSON.parse(r.snapshot) });
            }
            catch (e) {
                console.error('[IPC] 读取创意链失败:', e);
                return null;
            }
        }
        else {
            return null;
        }
    });
    ipcMain.handle('creativeChain:update', function (event, boardId, chainId, data) {
        var _a;
        var now = new Date().toISOString();
        if (repo.db) {
            try {
                var fields = [];
                var values = [];
                for (var _i = 0, _b = Object.entries(data); _i < _b.length; _i++) {
                    var _c = _b[_i], key = _c[0], val = _c[1];
                    if (key === 'snapshot' || key === 'tags') {
                        fields.push("".concat(key.replace(/([A-Z])/g, '_$1').toLowerCase(), " = ?"));
                        values.push(JSON.stringify(val));
                    }
                    else if (key !== 'id' && key !== 'boardId' && key !== 'board_id') {
                        var col = key.replace(/([A-Z])/g, '_$1').toLowerCase();
                        fields.push("".concat(col, " = ?"));
                        values.push(val);
                    }
                }
                fields.push('updated_at = ?');
                values.push(now);
                values.push(chainId);
                values.push(boardId);
                (_a = repo.db.prepare("UPDATE creative_chains SET ".concat(fields.join(', '), " WHERE id = ? AND board_id = ?"))).run.apply(_a, values);
                var r = repo.db.prepare('SELECT * FROM creative_chains WHERE id = ? AND board_id = ?').get(chainId, boardId);
                if (!r)
                    return null;
                return __assign(__assign({}, r), { tags: r.tags ? JSON.parse(r.tags) : [], snapshot: JSON.parse(r.snapshot) });
            }
            catch (e) {
                console.error('[IPC] 更新创意链失败:', e);
                return null;
            }
        }
        else {
            return null;
        }
    });
    ipcMain.handle('creativeChain:delete', function (event, boardId, chainId) {
        if (repo.db) {
            try {
                repo.db.prepare('DELETE FROM creative_chains WHERE id = ? AND board_id = ?').run(chainId, boardId);
                return true;
            }
            catch (e) {
                console.error('[IPC] 删除创意链失败:', e);
                return false;
            }
        }
        else {
            return true;
        }
    });
    console.log('[IPC] 看板处理器已注册');
}
;
module.exports = { registerBoardHandlers: registerBoardHandlers };
