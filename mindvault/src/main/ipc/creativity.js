"use strict";
// @ts-nocheck
/**
 * 创意相关 IPC 处理器
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
var fs = require('fs');
var repo = require('../db/repository');
function deleteCreativityMedia(db, creativityId) {
    var mediaRecords = db.prepare('SELECT id, filepath, thumbnail_path FROM media WHERE creativity_id = ?').all(creativityId);
    for (var _i = 0, mediaRecords_1 = mediaRecords; _i < mediaRecords_1.length; _i++) {
        var record = mediaRecords_1[_i];
        if (record.filepath && fs.existsSync(record.filepath)) {
            try {
                fs.unlinkSync(record.filepath);
            }
            catch (e) { }
        }
        if (record.thumbnail_path && fs.existsSync(record.thumbnail_path)) {
            try {
                fs.unlinkSync(record.thumbnail_path);
            }
            catch (e) { }
        }
    }
    if (mediaRecords.length > 0) {
        db.prepare('DELETE FROM media WHERE creativity_id = ?').run(creativityId);
    }
    db.prepare('DELETE FROM creativity_tags WHERE creativity_id = ?').run(creativityId);
    db.prepare('DELETE FROM creativities WHERE id = ?').run(creativityId);
}
function registerCreativityHandlers() {
    ipcMain.handle('creativity:create', function (event, data) {
        var creativity = {
            id: repo.generateId(),
            title: data.title || '',
            content: data.content || '',
            type: data.type || 'text',
            priority: data.priority || 0,
            emojiReaction: data.emojiReaction || null,
            status: 'active',
            templateId: data.templateId || null,
            boardId: data.boardId || null,
            positionX: data.positionX || null,
            positionY: data.positionY || null,
            cardStyle: data.cardStyle || null,
            createdAt: new Date().toISOString(),
            updatedAt: new Date().toISOString(),
            lastReviewedAt: null,
            isRead: false,
            isFavorite: data.isFavorite || false,
            subtype: data.subtype || null,
            contentFormat: data.contentFormat || 'plain',
            wordCount: data.wordCount || 0,
            tags: data.tags || [],
        };
        if (repo.db) {
            try {
                repo.db.prepare("INSERT INTO creativities (id, title, content, type, priority, emoji_reaction, status, template_id, board_id, position_x, position_y, card_style, created_at, updated_at, last_reviewed_at, is_read, is_favorite, subtype, content_format, word_count)\n          VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)").run(creativity.id, creativity.title, creativity.content, creativity.type, creativity.priority, creativity.emojiReaction, creativity.status, creativity.templateId, creativity.boardId, creativity.positionX, creativity.positionY, creativity.cardStyle, creativity.createdAt, creativity.updatedAt, creativity.lastReviewedAt, creativity.isRead ? 1 : 0, creativity.isFavorite ? 1 : 0, creativity.subtype || '', creativity.contentFormat || 'plain', creativity.wordCount || 0);
                if (data.tags && data.tags.length > 0) {
                    var insertTag = repo.db.prepare('INSERT OR IGNORE INTO creativity_tags (creativity_id, tag_id) VALUES (?, ?)');
                    for (var _i = 0, _a = data.tags; _i < _a.length; _i++) {
                        var tagItem = _a[_i];
                        var tagId = void 0;
                        if (typeof tagItem === 'string' && tagItem.length < 30) {
                            var existing = repo.db.prepare('SELECT id FROM tags WHERE id = ?').get(tagItem);
                            if (existing) {
                                tagId = tagItem;
                            }
                            else {
                                var byName = repo.db.prepare('SELECT id FROM tags WHERE name = ?').get(tagItem);
                                if (byName) {
                                    tagId = byName.id;
                                }
                                else {
                                    tagId = repo.generateId();
                                    repo.db.prepare('INSERT INTO tags (id, name, color, created_at) VALUES (?, ?, ?, ?)')
                                        .run(tagId, tagItem, '#6366f1', new Date().toISOString());
                                }
                            }
                        }
                        else if (tagItem && tagItem.id) {
                            tagId = tagItem.id;
                            var exists = repo.db.prepare('SELECT id FROM tags WHERE id = ?').get(tagId);
                            if (!exists) {
                                repo.db.prepare('INSERT OR IGNORE INTO tags (id, name, color, created_at) VALUES (?, ?, ?, ?)')
                                    .run(tagId, tagItem.name || tagId, tagItem.color || '#6366f1', new Date().toISOString());
                            }
                        }
                        if (tagId) {
                            insertTag.run(creativity.id, tagId);
                        }
                    }
                }
                var saved = repo.db.prepare('SELECT * FROM creativities WHERE id = ?').get(creativity.id);
                return repo.toCamelCase(saved);
            }
            catch (e) {
                console.error('[IPC] 创建创意失败:', e);
                return creativity;
            }
        }
        else {
            repo.JsonStore.get('creativities').push(creativity);
            repo.JsonStore.save();
            return creativity;
        }
    });
    ipcMain.handle('creativity:list', function (event, params) {
        var _a;
        if (params === void 0) { params = {}; }
        var _b = params.page, page = _b === void 0 ? 1 : _b, _c = params.pageSize, pageSize = _c === void 0 ? 20 : _c, _d = params.status, status = _d === void 0 ? 'active' : _d, boardId = params.boardId, type = params.type, sortBy = params.sortBy, sortOrder = params.sortOrder;
        var sortColumnMap = {
            createdAt: 'created_at',
            updatedAt: 'updated_at',
            title: 'title',
            priority: 'priority',
        };
        var sortColumn = sortColumnMap[sortBy] || 'updated_at';
        var sortDir = (sortOrder === 'asc' ? 'ASC' : 'DESC');
        if (repo.db) {
            try {
                var sql = 'SELECT * FROM creativities WHERE status = ?';
                var args = [status];
                if (boardId) {
                    sql += ' AND board_id = ?';
                    args.push(boardId);
                }
                if (type) {
                    sql += ' AND type = ?';
                    args.push(type);
                }
                sql += " ORDER BY ".concat(sortColumn, " ").concat(sortDir, " LIMIT ? OFFSET ?");
                args.push(pageSize, (page - 1) * pageSize);
                var items = (_a = repo.db.prepare(sql)).all.apply(_a, args);
                var countResult = repo.db.prepare('SELECT COUNT(*) as total FROM creativities WHERE status = ?').get(status);
                var mappedItems = repo.mapRows(items);
                for (var _i = 0, mappedItems_1 = mappedItems; _i < mappedItems_1.length; _i++) {
                    var item = mappedItems_1[_i];
                    if (['image', 'video', 'audio', 'document'].includes(item.type)) {
                        try {
                            var mediaRecord = repo.db.prepare('SELECT filepath FROM media WHERE creativity_id = ? ORDER BY sort_order ASC LIMIT 1').get(item.id);
                            if (mediaRecord) {
                                item.mediaFilePath = mediaRecord.filepath;
                            }
                        }
                        catch (_) { }
                    }
                    try {
                        var tagRows = repo.db.prepare('SELECT t.id, t.name, t.color FROM tags t INNER JOIN creativity_tags ct ON t.id = ct.tag_id WHERE ct.creativity_id = ?').all(item.id);
                        item.tags = tagRows.map(function (t) { return repo.toCamelCase(t); });
                    }
                    catch (_) { }
                }
                return { data: mappedItems, pagination: { page: page, pageSize: pageSize, total: countResult.total } };
            }
            catch (e) {
                console.error('[IPC] 列出创意失败:', e.code, e.message, e.stack);
                return { data: [], pagination: { page: page, pageSize: pageSize, total: 0 } };
            }
        }
        else {
            var items = repo.JsonStore.get('creativities').filter(function (c) { return c.status === (status || 'active'); });
            if (boardId)
                items = items.filter(function (c) { return c.boardId === boardId; });
            if (type)
                items = items.filter(function (c) { return c.type === type; });
            items.sort(function (a, b) {
                var cmp = 0;
                var field = sortBy || 'updatedAt';
                if (field === 'title') {
                    cmp = (a.title || '').localeCompare(b.title || '', 'zh-CN');
                }
                else if (field === 'priority') {
                    cmp = (a.priority || 0) - (b.priority || 0);
                }
                else {
                    cmp = new Date(a[field] || 0).getTime() - new Date(b[field] || 0).getTime();
                }
                return sortOrder === 'asc' ? cmp : -cmp;
            });
            var start = (page - 1) * pageSize;
            return {
                data: items.slice(start, start + pageSize),
                pagination: { page: page, pageSize: pageSize, total: items.length }
            };
        }
    });
    ipcMain.handle('creativity:read', function (event, id) {
        if (repo.db) {
            try {
                var result = repo.db.prepare('SELECT * FROM creativities WHERE id = ?').get(id);
                if (result) {
                    var camelResult = repo.toCamelCase(result);
                    if (['image', 'video', 'audio', 'document'].includes(camelResult.type)) {
                        try {
                            var mediaRecord = repo.db.prepare('SELECT filepath FROM media WHERE creativity_id = ? ORDER BY sort_order ASC LIMIT 1').get(id);
                            if (mediaRecord) {
                                camelResult.mediaFilePath = mediaRecord.filepath;
                            }
                        }
                        catch (mediaErr) {
                            console.warn('[IPC] 查询关联媒体失败:', mediaErr.message);
                        }
                    }
                    try {
                        var tagRows = repo.db.prepare('SELECT t.id, t.name, t.color FROM tags t INNER JOIN creativity_tags ct ON t.id = ct.tag_id WHERE ct.creativity_id = ?').all(id);
                        camelResult.tags = tagRows.map(function (t) { return repo.toCamelCase(t); });
                    }
                    catch (_) { }
                    return camelResult;
                }
                return null;
            }
            catch (e) {
                return null;
            }
        }
        else {
            var item = repo.JsonStore.get('creativities').find(function (c) { return c.id === id; }) || null;
            if (item && (item.type === 'image' || item.type === 'video' || item.type === 'audio') && !item.content) {
                try {
                    var mediaList = repo.JsonStore.get('media') || [];
                    var mediaRecord = mediaList.find(function (m) { return m.creativityId === id; });
                    if (mediaRecord && mediaRecord.filePath) {
                        item.content = mediaRecord.filePath;
                    }
                }
                catch (_) { }
            }
            return item;
        }
    });
    ipcMain.handle('creativity:update', function (event, id, data) {
        var _a;
        data.updatedAt = new Date().toISOString();
        var tagsData = data.tags;
        delete data.tags;
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
                if (fields.length > 0) {
                    values.push(id);
                    (_a = repo.db.prepare("UPDATE creativities SET ".concat(fields.join(', '), " WHERE id = ?"))).run.apply(_a, values);
                }
                if (tagsData !== undefined) {
                    repo.db.prepare('DELETE FROM creativity_tags WHERE creativity_id = ?').run(id);
                    if (Array.isArray(tagsData) && tagsData.length > 0) {
                        var insertTag = repo.db.prepare('INSERT OR IGNORE INTO creativity_tags (creativity_id, tag_id) VALUES (?, ?)');
                        for (var _d = 0, tagsData_1 = tagsData; _d < tagsData_1.length; _d++) {
                            var tagItem = tagsData_1[_d];
                            var tagId = void 0;
                            if (typeof tagItem === 'string' && tagItem.length < 30) {
                                var existing = repo.db.prepare('SELECT id FROM tags WHERE id = ?').get(tagItem);
                                if (existing) {
                                    tagId = tagItem;
                                }
                                else {
                                    var byName = repo.db.prepare('SELECT id FROM tags WHERE name = ?').get(tagItem);
                                    if (byName) {
                                        tagId = byName.id;
                                    }
                                    else {
                                        tagId = repo.generateId();
                                        repo.db.prepare('INSERT INTO tags (id, name, color, created_at) VALUES (?, ?, ?, ?)')
                                            .run(tagId, tagItem, '#6366f1', new Date().toISOString());
                                    }
                                }
                            }
                            else if (tagItem && tagItem.id) {
                                tagId = tagItem.id;
                                var exists = repo.db.prepare('SELECT id FROM tags WHERE id = ?').get(tagId);
                                if (!exists) {
                                    repo.db.prepare('INSERT OR IGNORE INTO tags (id, name, color, created_at) VALUES (?, ?, ?, ?)')
                                        .run(tagId, tagItem.name || tagId, tagItem.color || '#6366f1', new Date().toISOString());
                                }
                            }
                            if (tagId) {
                                insertTag.run(id, tagId);
                            }
                        }
                    }
                }
                var result = repo.db.prepare('SELECT * FROM creativities WHERE id = ?').get(id);
                var camelResult = repo.toCamelCase(result);
                if (camelResult) {
                    try {
                        var tagRows = repo.db.prepare('SELECT t.id, t.name, t.color FROM tags t INNER JOIN creativity_tags ct ON t.id = ct.tag_id WHERE ct.creativity_id = ?').all(id);
                        camelResult.tags = tagRows.map(function (t) { return repo.toCamelCase(t); });
                    }
                    catch (_) { }
                }
                return camelResult;
            }
            catch (e) {
                console.error('[IPC] 更新创意失败:', e);
                return null;
            }
        }
        else {
            var items = repo.JsonStore.get('creativities');
            var idx = items.findIndex(function (c) { return c.id === id; });
            if (idx >= 0) {
                items[idx] = __assign(__assign(__assign({}, items[idx]), data), { tags: tagsData || items[idx].tags });
                repo.JsonStore.save();
                return items[idx];
            }
            return null;
        }
    });
    ipcMain.handle('creativity:delete', function (event, id) {
        if (repo.db) {
            try {
                repo.db.prepare("UPDATE creativities SET status = 'trashed' WHERE id = ?").run(id);
                return true;
            }
            catch (e) {
                return false;
            }
        }
        else {
            var items = repo.JsonStore.get('creativities');
            var item = items.find(function (c) { return c.id === id; });
            if (item) {
                item.status = 'trashed';
                repo.JsonStore.save();
            }
            return true;
        }
    });
    ipcMain.handle('creativity:random', function () {
        if (repo.db) {
            try {
                var result = repo.db.prepare("SELECT * FROM creativities WHERE status = 'active' ORDER BY RANDOM() LIMIT 1").get();
                if (!result)
                    return null;
                var item = repo.toCamelCase(result);
                if (['image', 'video', 'audio', 'document'].includes(item.type)) {
                    try {
                        var mediaRecord = repo.db.prepare('SELECT filepath FROM media WHERE creativity_id = ? ORDER BY sort_order ASC LIMIT 1').get(item.id);
                        if (mediaRecord) {
                            item.mediaFilePath = mediaRecord.filepath;
                        }
                    }
                    catch (_) { }
                }
                return item;
            }
            catch (e) {
                return null;
            }
        }
        else {
            var items = repo.JsonStore.get('creativities').filter(function (c) { return c.status === 'active'; });
            return items.length > 0 ? items[Math.floor(Math.random() * items.length)] : null;
        }
    });
    ipcMain.handle('creativity:stats', function () {
        var _a;
        if (repo.db) {
            try {
                var total = repo.db.prepare("SELECT COUNT(*) as count FROM creativities WHERE status = 'active'").get().count;
                var today = repo.db.prepare("SELECT COUNT(*) as count FROM creativities WHERE status = 'active' AND date(created_at) = date('now')").get().count;
                var week = repo.db.prepare("SELECT COUNT(*) as count FROM creativities WHERE status = 'active' AND created_at >= datetime('now', '-7 days')").get().count;
                var tags = repo.db.prepare("SELECT COUNT(*) as count FROM tags").get().count;
                var typeRows = repo.db.prepare("SELECT type, COUNT(*) as count FROM creativities WHERE status = 'active' GROUP BY type").all();
                var typeDistribution = {};
                for (var _i = 0, typeRows_1 = typeRows; _i < typeRows_1.length; _i++) {
                    var row = typeRows_1[_i];
                    typeDistribution[row.type] = row.count;
                }
                var priorityRows = repo.db.prepare("SELECT priority, COUNT(*) as count FROM creativities WHERE status = 'active' GROUP BY priority").all();
                var priorityDistribution = {};
                for (var _b = 0, priorityRows_1 = priorityRows; _b < priorityRows_1.length; _b++) {
                    var row = priorityRows_1[_b];
                    priorityDistribution[String(row.priority)] = row.count;
                }
                var dailyTypeRows = repo.db.prepare("\n          SELECT date(created_at) as date, type, COUNT(*) as count\n          FROM creativities\n          WHERE status = 'active' AND created_at >= datetime('now', '-7 days')\n          GROUP BY date(created_at), type\n          ORDER BY date(created_at)\n        ").all();
                var dailyData = [];
                var _loop_1 = function (i) {
                    var d = new Date();
                    d.setDate(d.getDate() - i);
                    var dateStr = d.toISOString().split('T')[0];
                    var dayRows = dailyTypeRows.filter(function (r) { return r.date === dateStr; });
                    var types = {};
                    var count = 0;
                    for (var _j = 0, dayRows_1 = dayRows; _j < dayRows_1.length; _j++) {
                        var r = dayRows_1[_j];
                        types[r.type] = r.count;
                        count += r.count;
                    }
                    dailyData.push({ date: dateStr, count: count, types: types });
                };
                for (var i = 6; i >= 0; i--) {
                    _loop_1(i);
                }
                var recentTags = repo.db.prepare("\n          SELECT t.name, COUNT(ct.creativity_id) as count\n          FROM tags t\n          LEFT JOIN creativity_tags ct ON t.id = ct.tag_id\n          LEFT JOIN creativities c ON ct.creativity_id = c.id AND c.status = 'active'\n          GROUP BY t.id\n          ORDER BY count DESC\n          LIMIT 10\n        ").all();
                return {
                    total: total,
                    today: today,
                    thisWeek: week,
                    tags: tags,
                    totalCount: total, todayCount: today, weekCount: week,
                    typeDistribution: typeDistribution,
                    priorityDistribution: priorityDistribution,
                    dailyData: dailyData,
                    recentTags: recentTags,
                };
            }
            catch (e) {
                console.error('[IPC] 获取统计信息失败:', e.code, e.message);
                return {
                    total: 0, today: 0, thisWeek: 0, tags: 0,
                    totalCount: 0, todayCount: 0, weekCount: 0,
                    typeDistribution: {}, priorityDistribution: {},
                    dailyData: [], recentTags: [],
                };
            }
        }
        else {
            var items = repo.JsonStore.get('creativities').filter(function (c) { return c.status === 'active'; });
            var now = new Date();
            var todayStart_1 = new Date(now.getFullYear(), now.getMonth(), now.getDate()).toISOString();
            var weekAgo_1 = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000).toISOString();
            var typeDistribution = {};
            for (var _c = 0, items_1 = items; _c < items_1.length; _c++) {
                var item = items_1[_c];
                var t = item.type || 'text';
                typeDistribution[t] = (typeDistribution[t] || 0) + 1;
            }
            var priorityDistribution = {};
            for (var _d = 0, items_2 = items; _d < items_2.length; _d++) {
                var item = items_2[_d];
                var p = String((_a = item.priority) !== null && _a !== void 0 ? _a : 0);
                priorityDistribution[p] = (priorityDistribution[p] || 0) + 1;
            }
            var dailyData = [];
            var _loop_2 = function (i) {
                var d = new Date();
                d.setDate(d.getDate() - i);
                var dayStart = new Date(d.getFullYear(), d.getMonth(), d.getDate()).toISOString();
                var dayEnd = new Date(d.getFullYear(), d.getMonth(), d.getDate() + 1).toISOString();
                var dayItems = items.filter(function (c) { return c.createdAt >= dayStart && c.createdAt < dayEnd; });
                var types = {};
                for (var _k = 0, dayItems_1 = dayItems; _k < dayItems_1.length; _k++) {
                    var item = dayItems_1[_k];
                    var t = item.type || 'text';
                    types[t] = (types[t] || 0) + 1;
                }
                dailyData.push({ date: d.toISOString().split('T')[0], count: dayItems.length, types: types });
            };
            for (var i = 6; i >= 0; i--) {
                _loop_2(i);
            }
            var allTags = repo.JsonStore.get('tags');
            var tagCounts = {};
            for (var _e = 0, allTags_1 = allTags; _e < allTags_1.length; _e++) {
                var tag = allTags_1[_e];
                tagCounts[tag.name] = 0;
            }
            for (var _f = 0, items_3 = items; _f < items_3.length; _f++) {
                var item = items_3[_f];
                if (item.tags && Array.isArray(item.tags)) {
                    var _loop_3 = function (tagId) {
                        var tag = allTags.find(function (t) { return t.id === tagId; });
                        if (tag) {
                            tagCounts[tag.name] = (tagCounts[tag.name] || 0) + 1;
                        }
                    };
                    for (var _g = 0, _h = item.tags; _g < _h.length; _g++) {
                        var tagId = _h[_g];
                        _loop_3(tagId);
                    }
                }
            }
            var recentTags = Object.entries(tagCounts)
                .sort(function (a, b) { return b[1] - a[1]; })
                .slice(0, 10)
                .map(function (_a) {
                var name = _a[0], count = _a[1];
                return ({ name: name, count: count });
            });
            return {
                total: items.length,
                today: items.filter(function (c) { return c.createdAt >= todayStart_1; }).length,
                thisWeek: items.filter(function (c) { return c.createdAt >= weekAgo_1; }).length,
                tags: allTags.length,
                totalCount: items.length,
                todayCount: items.filter(function (c) { return c.createdAt >= todayStart_1; }).length,
                weekCount: items.filter(function (c) { return c.createdAt >= weekAgo_1; }).length,
                typeDistribution: typeDistribution,
                priorityDistribution: priorityDistribution,
                dailyData: dailyData,
                recentTags: recentTags,
            };
        }
    });
    ipcMain.handle('creativity:search', function (event, keyword, filters) {
        var _a;
        if (repo.db) {
            try {
                var sql = "SELECT * FROM creativities WHERE status = 'active'";
                var args = [];
                if (keyword) {
                    sql += " AND (title LIKE ? OR content LIKE ?)";
                    args.push("%".concat(keyword, "%"), "%".concat(keyword, "%"));
                }
                if (filters) {
                    if (filters.types && filters.types.length > 0) {
                        var placeholders = filters.types.map(function () { return '?'; }).join(',');
                        sql += " AND type IN (".concat(placeholders, ")");
                        args.push.apply(args, filters.types);
                    }
                    if (filters.priorityMin !== undefined && filters.priorityMin > 0) {
                        sql += " AND priority >= ?";
                        args.push(filters.priorityMin);
                    }
                    if (filters.tag) {
                        sql += " AND EXISTS (SELECT 1 FROM creativity_tags WHERE creativity_id = id AND tag_id = ?)";
                        args.push(filters.tag);
                    }
                    if (filters.boardId) {
                        sql += " AND (board_id = ? OR EXISTS (SELECT 1 FROM board_creativities WHERE board_id = ? AND creativity_id = id))";
                        args.push(filters.boardId, filters.boardId);
                    }
                }
                sql += " ORDER BY updated_at DESC LIMIT 50";
                var results = (_a = repo.db.prepare(sql)).all.apply(_a, args);
                var mappedResults = repo.mapRows(results);
                for (var _i = 0, mappedResults_1 = mappedResults; _i < mappedResults_1.length; _i++) {
                    var item = mappedResults_1[_i];
                    try {
                        var tagRows = repo.db.prepare('SELECT t.id, t.name, t.color FROM tags t INNER JOIN creativity_tags ct ON t.id = ct.tag_id WHERE ct.creativity_id = ?').all(item.id);
                        item.tags = tagRows.map(function (t) { return repo.toCamelCase(t); });
                    }
                    catch (_) { }
                }
                return mappedResults;
            }
            catch (e) {
                console.error('[IPC] 搜索失败:', e);
                return [];
            }
        }
        else {
            var kw_1 = keyword.toLowerCase();
            var items = repo.JsonStore.get('creativities').filter(function (c) {
                return c.status === 'active' &&
                    (!keyword || c.title.toLowerCase().includes(kw_1) || (c.content || '').toLowerCase().includes(kw_1));
            });
            if (filters) {
                if (filters.types && filters.types.length > 0)
                    items = items.filter(function (c) { return filters.types.includes(c.type); });
                if (filters.priorityMin !== undefined && filters.priorityMin > 0)
                    items = items.filter(function (c) { return c.priority >= filters.priorityMin; });
                if (filters.tag)
                    items = items.filter(function (c) { return c.tags && c.tags.includes(filters.tag); });
                if (filters.boardId)
                    items = items.filter(function (c) { return c.boardId === filters.boardId; });
            }
            return items;
        }
    });
    ipcMain.handle('creativity:permanent-delete', function (event, id) {
        if (repo.db) {
            try {
                deleteCreativityMedia(repo.db, id);
                return true;
            }
            catch (e) {
                console.error('[IPC] 永久删除创意失败:', e);
                return false;
            }
        }
        else {
            var items = repo.JsonStore.get('creativities').filter(function (c) { return c.id !== id; });
            repo.JsonStore.set('creativities', items);
            return true;
        }
    });
    ipcMain.handle('creativity:toggle-favorite', function (event, id) {
        if (repo.db) {
            try {
                var row = repo.db.prepare('SELECT is_favorite FROM creativities WHERE id = ?').get(id);
                if (!row)
                    return null;
                var newValue = row.is_favorite ? 0 : 1;
                var now = new Date().toISOString();
                repo.db.prepare('UPDATE creativities SET is_favorite = ?, updated_at = ? WHERE id = ?').run(newValue, now, id);
                var result = repo.db.prepare('SELECT * FROM creativities WHERE id = ?').get(id);
                return repo.toCamelCase(result);
            }
            catch (e) {
                console.error('[IPC] 切换收藏失败:', e);
                return null;
            }
        }
        else {
            var items = repo.JsonStore.get('creativities');
            var item = items.find(function (c) { return c.id === id; });
            if (item) {
                item.isFavorite = !item.isFavorite;
                repo.JsonStore.set('creativities', items);
                return item;
            }
            return null;
        }
    });
    ipcMain.handle('creativity:restore', function (event, id) {
        if (repo.db) {
            try {
                repo.db.prepare("UPDATE creativities SET status = 'active' WHERE id = ?").run(id);
                var result = repo.db.prepare('SELECT * FROM creativities WHERE id = ?').get(id);
                return repo.toCamelCase(result);
            }
            catch (e) {
                console.error('[IPC] 恢复创意失败:', e);
                return null;
            }
        }
        else {
            var items = repo.JsonStore.get('creativities');
            var item = items.find(function (c) { return c.id === id; });
            if (item) {
                item.status = 'active';
                repo.JsonStore.save();
                return item;
            }
            return null;
        }
    });
    // --- 导出相关 ---
    ipcMain.handle('export:json', function (event, ids) {
        var _a;
        var items = [];
        if (repo.db) {
            try {
                if (ids && ids.length > 0) {
                    var placeholders = ids.map(function () { return '?'; }).join(',');
                    items = (_a = repo.db.prepare("SELECT * FROM creativities WHERE id IN (".concat(placeholders, ")"))).all.apply(_a, ids);
                }
                else {
                    items = repo.db.prepare("SELECT * FROM creativities WHERE status = 'active'").all();
                }
            }
            catch (e) {
                items = [];
            }
        }
        else {
            var all = repo.JsonStore.get('creativities').filter(function (c) { return c.status === 'active'; });
            items = ids && ids.length > 0 ? all.filter(function (c) { return ids.includes(c.id); }) : all;
        }
        return JSON.stringify({ data: items }, null, 2);
    });
    ipcMain.handle('export:html', function (event, ids) {
        var _a;
        var items = [];
        if (repo.db) {
            try {
                if (ids && ids.length > 0) {
                    var placeholders = ids.map(function () { return '?'; }).join(',');
                    items = (_a = repo.db.prepare("SELECT * FROM creativities WHERE id IN (".concat(placeholders, ")"))).all.apply(_a, ids);
                }
                else {
                    items = repo.db.prepare("SELECT * FROM creativities WHERE status = 'active'").all();
                }
            }
            catch (e) {
                items = [];
            }
        }
        else {
            var all = repo.JsonStore.get('creativities').filter(function (c) { return c.status === 'active'; });
            items = ids && ids.length > 0 ? all.filter(function (c) { return ids.includes(c.id); }) : all;
        }
        var htmlItems = items.map(function (c) {
            var title = repo.escapeHtml(c.title || '');
            var content = repo.escapeHtml(c.content || '');
            var date = new Date(c.created_at || c.createdAt).toLocaleString('zh-CN');
            var type = c.type || 'text';
            return "<div style=\"border:1px solid #e5e7eb;border-radius:8px;padding:16px;margin-bottom:16px;background:#fff;\">\n        <h2 style=\"margin:0 0 8px;color:#1f2937;font-size:18px;\">".concat(title, "</h2>\n        <div style=\"color:#6b7280;font-size:12px;margin-bottom:8px;\">\u7C7B\u578B: ").concat(type, " | ").concat(date, "</div>\n        <div style=\"color:#374151;line-height:1.6;white-space:pre-wrap;\">").concat(content, "</div>\n      </div>");
        }).join('');
        return "<!DOCTYPE html>\n<html lang=\"zh-CN\">\n<head>\n  <meta charset=\"UTF-8\">\n  <meta name=\"viewport\" content=\"width=device-width, initial-scale=1.0\">\n  <title>\u8111\u6D1E\u96C6 - \u5BFC\u51FA\u6570\u636E</title>\n  <style>\n    body { font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, 'PingFang SC', 'Microsoft YaHei', sans-serif; max-width: 800px; margin: 0 auto; padding: 24px; background: #f9fafb; }\n    h1 { color: #111827; border-bottom: 2px solid #3b82f6; padding-bottom: 8px; }\n    .meta { color: #6b7280; font-size: 14px; margin-bottom: 24px; }\n  </style>\n</head>\n<body>\n  <h1>\u8111\u6D1E\u96C6 - \u5BFC\u51FA\u6570\u636E</h1>\n  <p class=\"meta\">\u5BFC\u51FA\u65F6\u95F4\uFF1A".concat(new Date().toLocaleString('zh-CN'), " | \u5171 ").concat(items.length, " \u6761\u521B\u610F</p>\n  ").concat(htmlItems, "\n</body>\n</html>");
    });
    ipcMain.handle('export:markdown', function (event, ids) {
        var _a;
        var items = [];
        if (repo.db) {
            try {
                if (ids && ids.length > 0) {
                    var placeholders = ids.map(function () { return '?'; }).join(',');
                    items = (_a = repo.db.prepare("SELECT * FROM creativities WHERE id IN (".concat(placeholders, ")"))).all.apply(_a, ids);
                }
                else {
                    items = repo.db.prepare("SELECT * FROM creativities WHERE status = 'active'").all();
                }
            }
            catch (e) {
                items = [];
            }
        }
        else {
            var all = repo.JsonStore.get('creativities').filter(function (c) { return c.status === 'active'; });
            items = ids && ids.length > 0 ? all.filter(function (c) { return ids.includes(c.id); }) : all;
        }
        var markdown = "# \u8111\u6D1E\u96C6 - \u5BFC\u51FA\u6570\u636E\n\n";
        markdown += "\u5BFC\u51FA\u65F6\u95F4\uFF1A".concat(new Date().toLocaleString('zh-CN'), " | \u5171 ").concat(items.length, " \u6761\u521B\u610F\n\n");
        markdown += "---\n\n";
        items.forEach(function (c) {
            var title = (c.title || '').replace(/\\/g, '\\\\').replace(/`/g, '\\`');
            var content = (c.content || '').replace(/\\/g, '\\\\').replace(/`/g, '\\`');
            var date = new Date(c.created_at || c.createdAt).toLocaleString('zh-CN');
            markdown += "## ".concat(title, "\n\n");
            markdown += "> \u7C7B\u578B: ".concat(c.type || 'text', " | ").concat(date, "\n\n");
            markdown += "".concat(content, "\n\n");
            markdown += "---\n\n";
        });
        return markdown;
    });
    ipcMain.handle('creativity:batch-update', function (event, ids, data) {
        if (!ids || !Array.isArray(ids) || ids.length === 0) {
            return { success: false, error: '请选择要更新的创意' };
        }
        var updatedAt = new Date().toISOString();
        var updatedCount = 0;
        if (repo.db) {
            try {
                var fields = [];
                var values_1 = [];
                for (var _i = 0, _a = Object.entries(data); _i < _a.length; _i++) {
                    var _b = _a[_i], key = _b[0], val = _b[1];
                    var col = key.replace(/([A-Z])/g, '_$1').toLowerCase();
                    fields.push("".concat(col, " = ?"));
                    values_1.push(val);
                }
                fields.push('updated_at = ?');
                values_1.push(updatedAt);
                var stmt_1 = repo.db.prepare("UPDATE creativities SET ".concat(fields.join(', '), " WHERE id = ?"));
                var transaction = repo.db.transaction(function () {
                    for (var _i = 0, ids_2 = ids; _i < ids_2.length; _i++) {
                        var id = ids_2[_i];
                        var result = stmt_1.run.apply(stmt_1, __spreadArray(__spreadArray([], values_1, false), [id], false));
                        if (result.changes > 0)
                            updatedCount++;
                    }
                });
                transaction();
                return { success: true, data: { updated_count: updatedCount } };
            }
            catch (e) {
                console.error('[IPC] 批量更新创意失败:', e);
                return { success: false, error: e.message };
            }
        }
        else {
            var items = repo.JsonStore.get('creativities');
            var _loop_4 = function (id) {
                var idx = items.findIndex(function (c) { return c.id === id; });
                if (idx >= 0) {
                    items[idx] = __assign(__assign(__assign({}, items[idx]), data), { updatedAt: updatedAt });
                    updatedCount++;
                }
            };
            for (var _c = 0, ids_1 = ids; _c < ids_1.length; _c++) {
                var id = ids_1[_c];
                _loop_4(id);
            }
            repo.JsonStore.save();
            return { success: true, data: { updated_count: updatedCount } };
        }
    });
    ipcMain.handle('creativity:batch-delete', function (event, ids, permanent) {
        if (permanent === void 0) { permanent = false; }
        if (!ids || !Array.isArray(ids) || ids.length === 0) {
            return { success: false, error: '请选择要删除的创意' };
        }
        var deletedCount = 0;
        if (repo.db) {
            try {
                if (permanent) {
                    for (var _i = 0, ids_3 = ids; _i < ids_3.length; _i++) {
                        var id = ids_3[_i];
                        try {
                            deleteCreativityMedia(repo.db, id);
                            deletedCount++;
                        }
                        catch (e) {
                            console.error('[IPC] 批量删除创意媒体失败:', e);
                        }
                    }
                }
                else {
                    var stmt_2 = repo.db.prepare("UPDATE creativities SET status = 'trashed' WHERE id = ?");
                    var transaction = repo.db.transaction(function () {
                        for (var _i = 0, ids_5 = ids; _i < ids_5.length; _i++) {
                            var id = ids_5[_i];
                            var result = stmt_2.run(id);
                            if (result.changes > 0)
                                deletedCount++;
                        }
                    });
                    transaction();
                }
                return { success: true, data: { deleted_count: deletedCount } };
            }
            catch (e) {
                console.error('[IPC] 批量删除创意失败:', e);
                return { success: false, error: e.message };
            }
        }
        else {
            var items = repo.JsonStore.get('creativities');
            var _loop_5 = function (id) {
                var idx = items.findIndex(function (c) { return c.id === id; });
                if (idx >= 0) {
                    if (permanent) {
                        items.splice(idx, 1);
                    }
                    else {
                        items[idx].status = 'trashed';
                    }
                    deletedCount++;
                }
            };
            for (var _a = 0, ids_4 = ids; _a < ids_4.length; _a++) {
                var id = ids_4[_a];
                _loop_5(id);
            }
            repo.JsonStore.save();
            return { success: true, data: { deleted_count: deletedCount } };
        }
    });
    // --- 创意关联处理 ---
    ipcMain.handle('link:add', function (event, sourceId, targetId, relationType) {
        if (relationType === void 0) { relationType = 'related'; }
        if (repo.db) {
            try {
                // 检查是否已存在关联
                var existing = repo.db.prepare('SELECT * FROM creativity_links WHERE source_id = ? AND target_id = ?').get(sourceId, targetId);
                if (existing) {
                    return { success: false, error: '关联已存在' };
                }
                var link = {
                    id: repo.generateId(),
                    source_id: sourceId,
                    target_id: targetId,
                    relation_type: relationType,
                    created_at: new Date().toISOString()
                };
                repo.db.prepare('INSERT INTO creativity_links (id, source_id, target_id, relation_type, created_at) VALUES (?, ?, ?, ?, ?)')
                    .run(link.id, link.source_id, link.target_id, link.relation_type, link.created_at);
                return { success: true, data: link };
            }
            catch (e) {
                console.error('[IPC] 添加创意关联失败:', e);
                return { success: false, error: e.message };
            }
        }
        else {
            return { success: false, error: 'JSON模式不支持关联功能' };
        }
    });
    ipcMain.handle('link:remove', function (event, sourceId, targetId) {
        if (repo.db) {
            try {
                var result = repo.db.prepare('DELETE FROM creativity_links WHERE source_id = ? AND target_id = ?').run(sourceId, targetId);
                return { success: result.changes > 0 };
            }
            catch (e) {
                console.error('[IPC] 移除创意关联失败:', e);
                return { success: false, error: e.message };
            }
        }
        else {
            return { success: false, error: 'JSON模式不支持关联功能' };
        }
    });
    ipcMain.handle('link:list', function (event, creativityId) {
        if (repo.db) {
            try {
                // 获取与该创意相关的所有关联
                var links = repo.db.prepare("\n          SELECT cl.*, \n                 c1.title as source_title, \n                 c2.title as target_title\n          FROM creativity_links cl\n          LEFT JOIN creativities c1 ON cl.source_id = c1.id\n          LEFT JOIN creativities c2 ON cl.target_id = c2.id\n          WHERE cl.source_id = ? OR cl.target_id = ?\n          ORDER BY cl.created_at DESC\n        ").all(creativityId, creativityId);
                return { success: true, data: links };
            }
            catch (e) {
                console.error('[IPC] 获取创意关联列表失败:', e);
                return { success: false, error: e.message };
            }
        }
        else {
            return { success: false, error: 'JSON模式不支持关联功能' };
        }
    });
    console.log('[IPC] 创意处理器已注册');
}
module.exports = { registerCreativityHandlers: registerCreativityHandlers, deleteCreativityMedia: deleteCreativityMedia };
