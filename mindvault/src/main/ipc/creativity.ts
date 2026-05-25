// @ts-nocheck
/**
 * 创意相关 IPC 处理器
 */

const { ipcMain } = require('electron');
const fs = require('fs');
const repo = require('../db/repository');
const { repairFts5, isCorruptVtabError } = require('../db/repository');
const dataSync = require('../services/data-sync');
const ragService = require('../services/rag-service');
const ragWatcher = require('../services/rag-watcher');

function withFts5Repair(fn) {
  return function (...args) {
    try {
      return fn(...args);
    } catch (e) {
      if (isCorruptVtabError(e) && repo.db) {
        console.warn('[IPC] 检测到FTS5损坏，尝试修复后重试...');
        if (repairFts5(repo.db)) {
          try {
            return fn(...args);
          } catch (retryErr) {
            console.error('[IPC] 修复后重试仍失败:', retryErr);
            throw retryErr;
          }
        }
      }
      throw e;
    }
  };
}

// 使用新的 RAG Watcher 进行自动索引
function scheduleRagReindex(sourceType, sourceId, action = 'reindex') {
  ragWatcher.queueIndexJob(sourceType, sourceId, action);
}

function deleteCreativityMedia(db, creativityId) {
  const mediaRecords = db.prepare('SELECT id, filepath, thumbnail_path FROM media WHERE creativity_id = ?').all(creativityId);
  for (const record of mediaRecords) {
    if (record.filepath && fs.existsSync(record.filepath)) {
      try { fs.unlinkSync(record.filepath); } catch (e) {}
    }
    if (record.thumbnail_path && fs.existsSync(record.thumbnail_path)) {
      try { fs.unlinkSync(record.thumbnail_path); } catch (e) {}
    }
  }
  if (mediaRecords.length > 0) {
    db.prepare('DELETE FROM media WHERE creativity_id = ?').run(creativityId);
  }
  db.prepare('DELETE FROM creativity_tags WHERE creativity_id = ?').run(creativityId);
  db.prepare('DELETE FROM creativities WHERE id = ?').run(creativityId);
}

function registerCreativityHandlers() {
  ipcMain.handle('creativity:create', (event, data) => {
    const creativity = {
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
        return withFts5Repair(() => {
          repo.db.prepare(`INSERT INTO creativities (id, title, content, type, priority, emoji_reaction, status, template_id, board_id, position_x, position_y, card_style, created_at, updated_at, last_reviewed_at, is_read, is_favorite, subtype, content_format, word_count)
          VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`).run(
          creativity.id, creativity.title, creativity.content, creativity.type,
          creativity.priority, creativity.emojiReaction, creativity.status,
          creativity.templateId, creativity.boardId, creativity.positionX,
          creativity.positionY, creativity.cardStyle, creativity.createdAt,
          creativity.updatedAt, creativity.lastReviewedAt,
          creativity.isRead ? 1 : 0, creativity.isFavorite ? 1 : 0,
          creativity.subtype || '', creativity.contentFormat || 'plain', creativity.wordCount || 0
        );
        if (data.tags && data.tags.length > 0) {
          const insertTag = repo.db.prepare('INSERT OR IGNORE INTO creativity_tags (creativity_id, tag_id) VALUES (?, ?)');
          for (const tagItem of data.tags) {
            let tagId;
            if (typeof tagItem === 'string' && tagItem.length < 30) {
              const existing = repo.db.prepare('SELECT id FROM tags WHERE id = ?').get(tagItem);
              if (existing) {
                tagId = tagItem;
              } else {
                const byName = repo.db.prepare('SELECT id FROM tags WHERE name = ?').get(tagItem);
                if (byName) {
                  tagId = byName.id;
                } else {
                  tagId = repo.generateId();
                  repo.db.prepare('INSERT INTO tags (id, name, color, created_at) VALUES (?, ?, ?, ?)')
                    .run(tagId, tagItem, '#6366f1', new Date().toISOString());
                }
              }
            } else if (tagItem && tagItem.id) {
              tagId = tagItem.id;
              const exists = repo.db.prepare('SELECT id FROM tags WHERE id = ?').get(tagId);
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
        const saved = repo.db.prepare('SELECT * FROM creativities WHERE id = ?').get(creativity.id);
        dataSync.uploadCreativity(creativity).catch(() => {});
        scheduleRagReindex('creativity', creativity.id);
        return repo.toCamelCase(saved);
        })();
      } catch (e) {
        console.error('[IPC] 创建创意失败:', e);
        return null;
      }
    } else {
      repo.JsonStore.get('creativities').push(creativity);
      repo.JsonStore.save();
      return creativity;
    }
  });

  ipcMain.handle('creativity:list', (event, params = {}) => {
    const { page = 1, pageSize = 20, status = 'active', boardId, type, sortBy, sortOrder } = params;

    const sortColumnMap = {
      createdAt: 'created_at',
      updatedAt: 'updated_at',
      title: 'title',
      priority: 'priority',
    };
    const sortColumn = sortColumnMap[sortBy] || 'updated_at';
    const sortDir = (sortOrder === 'asc' ? 'ASC' : 'DESC');

    if (repo.db) {
      try {
        let sql = 'SELECT * FROM creativities WHERE status = ?';
        const args = [status];
        if (boardId) { sql += ' AND board_id = ?'; args.push(boardId); }
        if (type) { sql += ' AND type = ?'; args.push(type); }
        sql += ` ORDER BY ${sortColumn} ${sortDir} LIMIT ? OFFSET ?`;
        args.push(pageSize, (page - 1) * pageSize);

        const items = repo.db.prepare(sql).all(...args);
        const countResult = repo.db.prepare('SELECT COUNT(*) as total FROM creativities WHERE status = ?').get(status);
        const mappedItems = repo.mapRows(items);
        for (const item of mappedItems) {
          if (['image', 'video', 'audio', 'document'].includes(item.type)) {
            try {
              const mediaRecord = repo.db.prepare('SELECT filepath, thumbnail_path FROM media WHERE creativity_id = ? ORDER BY sort_order ASC LIMIT 1').get(item.id);
              if (mediaRecord) {
                item.mediaFilePath = mediaRecord.filepath;
                if (mediaRecord.thumbnail_path) {
                  item.thumbnailPath = mediaRecord.thumbnail_path;
                }
              }
            } catch (_) {}
          }
          try {
            const tagRows = repo.db.prepare(
              'SELECT t.id, t.name, t.color FROM tags t INNER JOIN creativity_tags ct ON t.id = ct.tag_id WHERE ct.creativity_id = ?'
            ).all(item.id);
            item.tags = tagRows.map(t => repo.toCamelCase(t));
          } catch (_) {}
        }
        return { data: mappedItems, pagination: { page, pageSize, total: countResult.total } };
      } catch (e) {
        console.error('[IPC] 列出创意失败:', e.code, e.message, e.stack);
        return { data: [], pagination: { page, pageSize, total: 0 } };
      }
    } else {
      let items = repo.JsonStore.get('creativities').filter(c => c.status === (status || 'active'));
      if (boardId) items = items.filter(c => c.boardId === boardId);
      if (type) items = items.filter(c => c.type === type);
      items.sort((a, b) => {
        let cmp = 0;
        const field = sortBy || 'updatedAt';
        if (field === 'title') {
          cmp = (a.title || '').localeCompare(b.title || '', 'zh-CN');
        } else if (field === 'priority') {
          cmp = (a.priority || 0) - (b.priority || 0);
        } else {
          cmp = new Date(a[field] || 0).getTime() - new Date(b[field] || 0).getTime();
        }
        return sortOrder === 'asc' ? cmp : -cmp;
      });
      const start = (page - 1) * pageSize;
      return {
        data: items.slice(start, start + pageSize),
        pagination: { page, pageSize, total: items.length }
      };
    }
  });

  ipcMain.handle('creativity:read', (event, id) => {
    if (repo.db) {
      try {
        const result = repo.db.prepare('SELECT * FROM creativities WHERE id = ?').get(id);
        if (result) {
          const camelResult = repo.toCamelCase(result);
          if (['image', 'video', 'audio', 'document'].includes(camelResult.type)) {
            try {
              const mediaRecord = repo.db.prepare('SELECT filepath, thumbnail_path FROM media WHERE creativity_id = ? ORDER BY sort_order ASC LIMIT 1').get(id);
              if (mediaRecord) {
                camelResult.mediaFilePath = mediaRecord.filepath;
                if (mediaRecord.thumbnail_path) {
                  camelResult.thumbnailPath = mediaRecord.thumbnail_path;
                }
              }
            } catch (mediaErr) {
              console.warn('[IPC] 查询关联媒体失败:', mediaErr.message);
            }
          }
          try {
            const tagRows = repo.db.prepare(
              'SELECT t.id, t.name, t.color FROM tags t INNER JOIN creativity_tags ct ON t.id = ct.tag_id WHERE ct.creativity_id = ?'
            ).all(id);
            camelResult.tags = tagRows.map(t => repo.toCamelCase(t));
          } catch (_) {}
          return camelResult;
        }
        return null;
      } catch (e) { return null; }
    } else {
      const item = repo.JsonStore.get('creativities').find(c => c.id === id) || null;
      if (item && (item.type === 'image' || item.type === 'video' || item.type === 'audio') && !item.content) {
        try {
          const mediaList = repo.JsonStore.get('media') || [];
          const mediaRecord = mediaList.find(m => m.creativityId === id);
          if (mediaRecord && mediaRecord.filePath) {
            item.content = mediaRecord.filePath;
          }
        } catch (_) {}
      }
      return item;
    }
  });

  ipcMain.handle('creativity:update', (event, id, data) => {
    data.updatedAt = new Date().toISOString();
    const tagsData = data.tags;
    delete data.tags;
    if (repo.db) {
      try {
        return withFts5Repair(() => {
        const updateData = { ...data };
        if (updateData.isFavorite !== undefined) {
          updateData.isFavorite = updateData.isFavorite ? 1 : 0;
        }
        const result = repo.safeBuildUpdate('creativities', updateData);
        if (result) {
          result.values.push(id);
          repo.db.prepare(result.sql).run(...result.values);
        }
        if (tagsData !== undefined) {
          repo.db.prepare('DELETE FROM creativity_tags WHERE creativity_id = ?').run(id);
          if (Array.isArray(tagsData) && tagsData.length > 0) {
            const insertTag = repo.db.prepare('INSERT OR IGNORE INTO creativity_tags (creativity_id, tag_id) VALUES (?, ?)');
            for (const tagItem of tagsData) {
              let tagId;
              if (typeof tagItem === 'string' && tagItem.length < 30) {
                const existing = repo.db.prepare('SELECT id FROM tags WHERE id = ?').get(tagItem);
                if (existing) {
                  tagId = tagItem;
                } else {
                  const byName = repo.db.prepare('SELECT id FROM tags WHERE name = ?').get(tagItem);
                  if (byName) {
                    tagId = byName.id;
                  } else {
                    tagId = repo.generateId();
                    repo.db.prepare('INSERT INTO tags (id, name, color, created_at) VALUES (?, ?, ?, ?)')
                      .run(tagId, tagItem, '#6366f1', new Date().toISOString());
                  }
                }
              } else if (tagItem && tagItem.id) {
                tagId = tagItem.id;
                const exists = repo.db.prepare('SELECT id FROM tags WHERE id = ?').get(tagId);
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
        const selectResult = repo.db.prepare('SELECT * FROM creativities WHERE id = ?').get(id);
        const camelResult = repo.toCamelCase(selectResult);
        if (camelResult) {
          try {
            const tagRows = repo.db.prepare(
              'SELECT t.id, t.name, t.color FROM tags t INNER JOIN creativity_tags ct ON t.id = ct.tag_id WHERE ct.creativity_id = ?'
            ).all(id);
            camelResult.tags = tagRows.map(t => repo.toCamelCase(t));
          } catch (_) {}
        }
        dataSync.uploadCreativity(camelResult).catch(() => {});
        scheduleRagReindex('creativity', id);
        return camelResult;
        })();
      } catch (e) { console.error('[IPC] 更新创意失败:', e); return null; }
    } else {
      const items = repo.JsonStore.get('creativities');
      const idx = items.findIndex(c => c.id === id);
      if (idx >= 0) { items[idx] = { ...items[idx], ...data, tags: tagsData || items[idx].tags }; repo.JsonStore.save(); return items[idx]; }
      return null;
    }
  });

  ipcMain.handle('creativity:delete', (event, id, options = {}) => {
    const opts = options || {};
    const { boardId, boardName, skipTrash = false } = opts;
    
    if (repo.db) {
      try {
        return withFts5Repair(() => {
          const creativity = repo.db.prepare('SELECT * FROM creativities WHERE id = ?').get(id);
          if (!creativity) return false;
          
          if (creativity.status === 'trashed') return true;
          
          const tagRows = repo.db.prepare(
            'SELECT t.id, t.name, t.color FROM tags t INNER JOIN creativity_tags ct ON t.id = ct.tag_id WHERE ct.creativity_id = ?'
          ).all(id);
          
          // 获取媒体信息用于缩略图显示
          let mediaFilePath = null;
          let thumbnailPath = null;
          try {
            const mediaRow = repo.db.prepare('SELECT filepath, thumbnail_path FROM media WHERE creativity_id = ? ORDER BY sort_order ASC LIMIT 1').get(id);
            if (mediaRow) {
              mediaFilePath = mediaRow.filepath;
              thumbnailPath = mediaRow.thumbnail_path;
            }
          } catch (e) {
            console.warn('[IPC] 获取创意媒体信息失败:', e);
          }
          
          const snapshot = repo.toCamelCase(creativity);
          snapshot.tags = tagRows.map(t => repo.toCamelCase(t));
          // 添加媒体路径到快照中，用于回收站缩略图显示
          snapshot.mediaFilePath = mediaFilePath;
          snapshot.thumbnailPath = thumbnailPath;
          
          if (!skipTrash) {
            const trashId = repo.generateId();
            const now = new Date().toISOString();
            const isChapter = creativity.subtype === 'chapter';
            const itemType = isChapter ? 'chapter' : 'creativity';
            
            // 计算文件大小
            let fileSize = 0;
            if (mediaFilePath && fs.existsSync(mediaFilePath)) {
              try {
                fileSize = fs.statSync(mediaFilePath).size;
              } catch (e) {}
            }
            
            // 保存到回收站，包含扩展字段
            repo.db.prepare(
              'INSERT INTO trash_items (id, item_type, item_id, source_board_id, source_board_name, snapshot, deleted_at, file_size, original_created_at) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)'
            ).run(
              trashId,
              itemType,
              id,
              boardId || creativity.board_id || null,
              boardName || null,
              JSON.stringify(snapshot),
              now,
              fileSize,
              creativity.created_at
            );
          }
          
          repo.db.prepare("UPDATE creativities SET status = 'trashed', updated_at = ? WHERE id = ?").run(new Date().toISOString(), id);
          dataSync.uploadCreativity({ id, status: 'trashed' }).catch(() => {});
          scheduleRagReindex('creativity', id, 'update-status');
          return true;
        })();
      } catch (e) { 
        console.error('[IPC] 删除创意失败:', e);
        return false; 
      }
    } else {
      const items = repo.JsonStore.get('creativities');
      const item = items.find(c => c.id === id);
      if (item) { 
        item.status = 'trashed'; 
        item.updatedAt = new Date().toISOString();
        
        if (!skipTrash) {
          const trashItems = repo.JsonStore.get('trashItems') || [];
          const isChapter = item.subtype === 'chapter';
          const trashItem = {
            id: repo.generateId(),
            itemType: isChapter ? 'chapter' : 'creativity',
            itemId: id,
            sourceBoardId: boardId || item.boardId || null,
            sourceBoardName: boardName || null,
            snapshot: item,
            deletedAt: new Date().toISOString()
          };
          trashItems.push(trashItem);
          repo.JsonStore.set('trashItems', trashItems);
        }
        
        repo.JsonStore.save(); 
      }
      return true;
    }
  });

  ipcMain.handle('creativity:random', () => {
    if (repo.db) {
      try {
        // 排除写作台章节（subtype = 'chapter'），这些不应出现在灵感闪回中
        const result = repo.db.prepare("SELECT * FROM creativities WHERE status = 'active' AND (subtype IS NULL OR subtype != 'chapter') ORDER BY RANDOM() LIMIT 1").get();
        if (!result) return null;
        const item = repo.toCamelCase(result);
        if (['image', 'video', 'audio', 'document'].includes(item.type)) {
          try {
            const mediaRecord = repo.db.prepare('SELECT filepath, thumbnail_path FROM media WHERE creativity_id = ? ORDER BY sort_order ASC LIMIT 1').get(item.id);
            if (mediaRecord) {
              item.mediaFilePath = mediaRecord.filepath;
              if (mediaRecord.thumbnail_path) {
                item.thumbnailPath = mediaRecord.thumbnail_path;
              }
            }
          } catch (_) {}
        }
        return item;
      } catch (e) { return null; }
    } else {
      // 排除写作台章节（subtype = 'chapter'）
      const items = repo.JsonStore.get('creativities').filter(c => c.status === 'active' && c.subtype !== 'chapter');
      return items.length > 0 ? items[Math.floor(Math.random() * items.length)] : null;
    }
  });

  ipcMain.handle('creativity:stats', () => {
    if (repo.db) {
      try {
        const total = repo.db.prepare("SELECT COUNT(*) as count FROM creativities WHERE status = 'active'").get().count;
        const today = repo.db.prepare("SELECT COUNT(*) as count FROM creativities WHERE status = 'active' AND date(created_at) = date('now')").get().count;
        const week = repo.db.prepare("SELECT COUNT(*) as count FROM creativities WHERE status = 'active' AND created_at >= datetime('now', '-7 days')").get().count;
        const tags = repo.db.prepare("SELECT COUNT(*) as count FROM tags").get().count;

        const typeRows = repo.db.prepare("SELECT type, COUNT(*) as count FROM creativities WHERE status = 'active' GROUP BY type").all();
        const typeDistribution = {};
        for (const row of typeRows) { typeDistribution[row.type] = row.count; }

        const priorityRows = repo.db.prepare("SELECT priority, COUNT(*) as count FROM creativities WHERE status = 'active' GROUP BY priority").all();
        const priorityDistribution = {};
        for (const row of priorityRows) { priorityDistribution[String(row.priority)] = row.count; }

        const dailyTypeRows = repo.db.prepare(`
          SELECT date(created_at) as date, type, COUNT(*) as count
          FROM creativities
          WHERE status = 'active' AND created_at >= datetime('now', '-7 days')
          GROUP BY date(created_at), type
          ORDER BY date(created_at)
        `).all();
        const dailyData = [];
        for (let i = 6; i >= 0; i--) {
          const d = new Date();
          d.setDate(d.getDate() - i);
          const dateStr = d.toISOString().split('T')[0];
          const dayRows = dailyTypeRows.filter((r) => r.date === dateStr);
          const types = {};
          let count = 0;
          for (const r of dayRows) {
            types[r.type] = r.count;
            count += r.count;
          }
          dailyData.push({ date: dateStr, count, types });
        }

        const recentTags = repo.db.prepare(`
          SELECT t.name, COUNT(ct.creativity_id) as count
          FROM tags t
          LEFT JOIN creativity_tags ct ON t.id = ct.tag_id
          LEFT JOIN creativities c ON ct.creativity_id = c.id AND c.status = 'active'
          GROUP BY t.id
          ORDER BY count DESC
          LIMIT 10
        `).all();

        return {
          total, today, thisWeek: week, tags,
          totalCount: total, todayCount: today, weekCount: week,
          typeDistribution, priorityDistribution, dailyData, recentTags,
        };
      } catch (e) {
        console.error('[IPC] 获取统计信息失败:', e.code, e.message);
        return {
          total: 0, today: 0, thisWeek: 0, tags: 0,
          totalCount: 0, todayCount: 0, weekCount: 0,
          typeDistribution: {}, priorityDistribution: {},
          dailyData: [], recentTags: [],
        };
      }
    } else {
      const items = repo.JsonStore.get('creativities').filter(c => c.status === 'active');
      const now = new Date();
      const todayStart = new Date(now.getFullYear(), now.getMonth(), now.getDate()).toISOString();
      const weekAgo = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000).toISOString();

      const typeDistribution = {};
      for (const item of items) {
        const t = item.type || 'text';
        typeDistribution[t] = (typeDistribution[t] || 0) + 1;
      }

      const priorityDistribution = {};
      for (const item of items) {
        const p = String(item.priority ?? 0);
        priorityDistribution[p] = (priorityDistribution[p] || 0) + 1;
      }

      const dailyData = [];
      for (let i = 6; i >= 0; i--) {
        const d = new Date();
        d.setDate(d.getDate() - i);
        const dayStart = new Date(d.getFullYear(), d.getMonth(), d.getDate()).toISOString();
        const dayEnd = new Date(d.getFullYear(), d.getMonth(), d.getDate() + 1).toISOString();
        const dayItems = items.filter(c => c.createdAt >= dayStart && c.createdAt < dayEnd);
        const types = {};
        for (const item of dayItems) {
          const t = item.type || 'text';
          types[t] = (types[t] || 0) + 1;
        }
        dailyData.push({ date: d.toISOString().split('T')[0], count: dayItems.length, types });
      }

      const allTags = repo.JsonStore.get('tags');
      const tagCounts = {};
      for (const tag of allTags) { tagCounts[tag.name] = 0; }
      for (const item of items) {
        if (item.tags && Array.isArray(item.tags)) {
          for (const tagId of item.tags) {
            const tag = allTags.find((t) => t.id === tagId);
            if (tag) { tagCounts[tag.name] = (tagCounts[tag.name] || 0) + 1; }
          }
        }
      }
      const recentTags = Object.entries(tagCounts)
        .sort((a, b) => b[1] - a[1])
        .slice(0, 10)
        .map(([name, count]) => ({ name, count }));

      return {
        total: items.length,
        today: items.filter(c => c.createdAt >= todayStart).length,
        thisWeek: items.filter(c => c.createdAt >= weekAgo).length,
        tags: allTags.length,
        totalCount: items.length,
        todayCount: items.filter(c => c.createdAt >= todayStart).length,
        weekCount: items.filter(c => c.createdAt >= weekAgo).length,
        typeDistribution, priorityDistribution, dailyData, recentTags,
      };
    }
  });

  ipcMain.handle('creativity:search', (event, keyword, filters) => {
    if (repo.db) {
      try {
        let sql = "SELECT * FROM creativities WHERE status = 'active'";
        const args = [];
        if (keyword) {
          sql += " AND (title LIKE ? OR content LIKE ?)";
          args.push(`%${keyword}%`, `%${keyword}%`);
        }
        if (filters) {
          if (filters.types && filters.types.length > 0) {
            const placeholders = filters.types.map(() => '?').join(',');
            sql += ` AND type IN (${placeholders})`;
            args.push(...filters.types);
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
        const results = repo.db.prepare(sql).all(...args);
        const mappedResults = repo.mapRows(results);
        for (const item of mappedResults) {
          // 获取媒体文件的 thumbnailPath
          if (['image', 'video', 'audio', 'document'].includes(item.type)) {
            try {
              const mediaRecord = repo.db.prepare('SELECT filepath, thumbnail_path FROM media WHERE creativity_id = ? ORDER BY sort_order ASC LIMIT 1').get(item.id);
              if (mediaRecord) {
                item.mediaFilePath = mediaRecord.filepath;
                if (mediaRecord.thumbnail_path) {
                  item.thumbnailPath = mediaRecord.thumbnail_path;
                }
              }
            } catch (_) {}
          }
          try {
            const tagRows = repo.db.prepare(
              'SELECT t.id, t.name, t.color FROM tags t INNER JOIN creativity_tags ct ON t.id = ct.tag_id WHERE ct.creativity_id = ?'
            ).all(item.id);
            item.tags = tagRows.map(t => repo.toCamelCase(t));
          } catch (_) {}
        }
        return mappedResults;
      } catch (e) { 
        console.error('[IPC] 搜索失败:', e);
        return []; 
      }
    } else {
      const kw = keyword.toLowerCase();
      let items = repo.JsonStore.get('creativities').filter(c =>
        c.status === 'active' && 
        (!keyword || c.title.toLowerCase().includes(kw) || (c.content || '').toLowerCase().includes(kw))
      );
      if (filters) {
        if (filters.types && filters.types.length > 0) items = items.filter(c => filters.types.includes(c.type));
        if (filters.priorityMin !== undefined && filters.priorityMin > 0) items = items.filter(c => c.priority >= filters.priorityMin);
        if (filters.tag) items = items.filter(c => c.tags && c.tags.includes(filters.tag));
        if (filters.boardId) items = items.filter(c => c.boardId === filters.boardId);
      }
      return items;
    }
  });

  ipcMain.handle('creativity:permanent-delete', (event, id, trashItemId) => {
    if (repo.db) {
      try {
        return withFts5Repair(() => {
        deleteCreativityMedia(repo.db, id);
        
        if (trashItemId) {
          repo.db.prepare('DELETE FROM trash_items WHERE id = ?').run(trashItemId);
        } else {
          repo.db.prepare("DELETE FROM trash_items WHERE item_id = ? AND item_type IN ('creativity', 'chapter')").run(id);
        }
        
        return true;
        })();
      } catch (e) {
        console.error('[IPC] 永久删除创意失败:', e);
        return false;
      }
    } else {
      const items = repo.JsonStore.get('creativities').filter(c => c.id !== id);
      repo.JsonStore.set('creativities', items);
      
      // 从 trashItems 中移除
      const trashItems = repo.JsonStore.get('trashItems') || [];
      const filteredTrash = trashItems.filter(t => {
        if (trashItemId) return t.id !== trashItemId;
        return !(t.itemId === id && ['creativity', 'chapter'].includes(t.itemType));
      });
      repo.JsonStore.set('trashItems', filteredTrash);
      repo.JsonStore.save();
      
      return true;
    }
  });

  ipcMain.handle('creativity:toggle-favorite', (event, id) => {
    if (repo.db) {
      try {
        return withFts5Repair(() => {
        const row = repo.db.prepare('SELECT is_favorite FROM creativities WHERE id = ?').get(id);
        if (!row) return null;
        const newValue = row.is_favorite ? 0 : 1;
        const now = new Date().toISOString();
        repo.db.prepare('UPDATE creativities SET is_favorite = ?, updated_at = ? WHERE id = ?').run(newValue, now, id);
        const result = repo.db.prepare('SELECT * FROM creativities WHERE id = ?').get(id);
        return repo.toCamelCase(result);
        })();
      } catch (e) {
        console.error('[IPC] 切换收藏失败:', e);
        return null;
      }
    } else {
      const items = repo.JsonStore.get('creativities');
      const item = items.find((c) => c.id === id);
      if (item) {
        item.isFavorite = !item.isFavorite;
        repo.JsonStore.set('creativities', items);
        return item;
      }
      return null;
    }
  });

  ipcMain.handle('creativity:restore', (event, id, trashItemId) => {
    if (repo.db) {
      try {
        return withFts5Repair(() => {
        repo.db.prepare("UPDATE creativities SET status = 'active', updated_at = ? WHERE id = ?").run(new Date().toISOString(), id);
        
        if (trashItemId) {
          repo.db.prepare('DELETE FROM trash_items WHERE id = ?').run(trashItemId);
        } else {
          repo.db.prepare("DELETE FROM trash_items WHERE item_id = ? AND item_type IN ('creativity', 'chapter')").run(id);
        }
        
        const result = repo.db.prepare('SELECT * FROM creativities WHERE id = ?').get(id);
        const restored = repo.toCamelCase(result);
        
        try {
          const tagRows = repo.db.prepare(
            'SELECT t.id, t.name, t.color FROM tags t INNER JOIN creativity_tags ct ON t.id = ct.tag_id WHERE ct.creativity_id = ?'
          ).all(id);
          restored.tags = tagRows.map(t => repo.toCamelCase(t));
        } catch (_) {}
        
        dataSync.uploadCreativity(restored).catch(() => {});
        scheduleRagReindex('creativity', id);
        return restored;
        })();
      } catch (e) {
        console.error('[IPC] 恢复创意失败:', e);
        return null;
      }
    } else {
      const items = repo.JsonStore.get('creativities');
      const item = items.find(c => c.id === id);
      if (item) {
        item.status = 'active';
        item.updatedAt = new Date().toISOString();
        repo.JsonStore.save();
        
        // 从 trashItems 中移除
        const trashItems = repo.JsonStore.get('trashItems') || [];
        const filteredTrash = trashItems.filter(t => {
          if (trashItemId) return t.id !== trashItemId;
          return !(t.itemId === id && ['creativity', 'chapter'].includes(t.itemType));
        });
        repo.JsonStore.set('trashItems', filteredTrash);
        repo.JsonStore.save();
        
        return item;
      }
      return null;
    }
  });

  // --- 导出相关 ---
  ipcMain.handle('export:json', (event, ids) => {
    let items = [];
    if (repo.db) {
      try {
        if (ids && ids.length > 0) {
          const placeholders = ids.map(() => '?').join(',');
          items = repo.db.prepare(`SELECT * FROM creativities WHERE id IN (${placeholders})`).all(...ids);
        } else {
          items = repo.db.prepare("SELECT * FROM creativities WHERE status = 'active'").all();
        }
      } catch (e) { items = []; }
    } else {
      let all = repo.JsonStore.get('creativities').filter(c => c.status === 'active');
      items = ids && ids.length > 0 ? all.filter(c => ids.includes(c.id)) : all;
    }
    return JSON.stringify({ data: items }, null, 2);
  });

  ipcMain.handle('export:html', (event, ids) => {
    let items = [];
    if (repo.db) {
      try {
        if (ids && ids.length > 0) {
          const placeholders = ids.map(() => '?').join(',');
          items = repo.db.prepare(`SELECT * FROM creativities WHERE id IN (${placeholders})`).all(...ids);
        } else {
          items = repo.db.prepare("SELECT * FROM creativities WHERE status = 'active'").all();
        }
      } catch (e) { items = []; }
    } else {
      let all = repo.JsonStore.get('creativities').filter(c => c.status === 'active');
      items = ids && ids.length > 0 ? all.filter(c => ids.includes(c.id)) : all;
    }

    const htmlItems = items.map(c => {
      const title = repo.escapeHtml(c.title || '');
      const content = repo.escapeHtml(c.content || '');
      const date = new Date(c.created_at || c.createdAt).toLocaleString('zh-CN');
      const type = c.type || 'text';
      return `<div style="border:1px solid #e5e7eb;border-radius:8px;padding:16px;margin-bottom:16px;background:#fff;">
        <h2 style="margin:0 0 8px;color:#1f2937;font-size:18px;">${title}</h2>
        <div style="color:#6b7280;font-size:12px;margin-bottom:8px;">类型: ${type} | ${date}</div>
        <div style="color:#374151;line-height:1.6;white-space:pre-wrap;">${content}</div>
      </div>`;
    }).join('');

    return `<!DOCTYPE html>
<html lang="zh-CN">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>脑洞集 - 导出数据</title>
  <style>
    body { font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, 'PingFang SC', 'Microsoft YaHei', sans-serif; max-width: 800px; margin: 0 auto; padding: 24px; background: #f9fafb; }
    h1 { color: #111827; border-bottom: 2px solid #3b82f6; padding-bottom: 8px; }
    .meta { color: #6b7280; font-size: 14px; margin-bottom: 24px; }
  </style>
</head>
<body>
  <h1>脑洞集 - 导出数据</h1>
  <p class="meta">导出时间：${new Date().toLocaleString('zh-CN')} | 共 ${items.length} 条创意</p>
  ${htmlItems}
</body>
</html>`;
  });

  ipcMain.handle('export:markdown', (event, ids) => {
    let items = [];
    if (repo.db) {
      try {
        if (ids && ids.length > 0) {
          const placeholders = ids.map(() => '?').join(',');
          items = repo.db.prepare(`SELECT * FROM creativities WHERE id IN (${placeholders})`).all(...ids);
        } else {
          items = repo.db.prepare("SELECT * FROM creativities WHERE status = 'active'").all();
        }
      } catch (e) { items = []; }
    } else {
      let all = repo.JsonStore.get('creativities').filter(c => c.status === 'active');
      items = ids && ids.length > 0 ? all.filter(c => ids.includes(c.id)) : all;
    }

    let markdown = `# 脑洞集 - 导出数据\n\n`;
    markdown += `导出时间：${new Date().toLocaleString('zh-CN')} | 共 ${items.length} 条创意\n\n`;
    markdown += `---\n\n`;

    items.forEach(c => {
      const title = (c.title || '').replace(/\\/g, '\\\\').replace(/`/g, '\\`');
      const content = (c.content || '').replace(/\\/g, '\\\\').replace(/`/g, '\\`');
      const date = new Date(c.created_at || c.createdAt).toLocaleString('zh-CN');
      markdown += `## ${title}\n\n`;
      markdown += `> 类型: ${c.type || 'text'} | ${date}\n\n`;
      markdown += `${content}\n\n`;
      markdown += `---\n\n`;
    });

    return markdown;
  });

  ipcMain.handle('creativity:batch-update', (event, ids, data) => {
    if (!ids || !Array.isArray(ids) || ids.length === 0) {
      return { success: false, error: '请选择要更新的创意' };
    }
    const updatedAt = new Date().toISOString();
    let updatedCount = 0;

    if (repo.db) {
      try {
        return withFts5Repair(() => {
        const updateData = { ...data, updatedAt };
        const result = repo.safeBuildUpdate('creativities', updateData);
        if (!result) return { success: false, error: 'No valid fields to update' };
        const stmt = repo.db.prepare(result.sql);
        const transaction = repo.db.transaction(() => {
          for (const id of ids) {
            const r = stmt.run(...result.values, id);
            if (r.changes > 0) updatedCount++;
          }
        });
        transaction();
        return { success: true, data: { updated_count: updatedCount } };
        })();
      } catch (e) {
        console.error('[IPC] 批量更新创意失败:', e);
        return { success: false, error: e.message };
      }
    } else {
      const items = repo.JsonStore.get('creativities');
      for (const id of ids) {
        const idx = items.findIndex((c) => c.id === id);
        if (idx >= 0) {
          items[idx] = { ...items[idx], ...data, updatedAt };
          updatedCount++;
        }
      }
      repo.JsonStore.save();
      return { success: true, data: { updated_count: updatedCount } };
    }
  });

  ipcMain.handle('creativity:batch-delete', (event, ids, permanent = false, options = {}) => {
    if (!ids || !Array.isArray(ids) || ids.length === 0) {
      return { success: false, error: '请选择要删除的创意' };
    }
    const { boardId, boardName } = options;
    let deletedCount = 0;

    if (repo.db) {
      try {
        if (permanent) {
          return withFts5Repair(() => {
          for (const id of ids) {
            try { 
              deleteCreativityMedia(repo.db, id); 
              repo.db.prepare("DELETE FROM trash_items WHERE item_id = ? AND item_type IN ('creativity', 'chapter')").run(id);
              deletedCount++; 
            } catch (e) { console.error('[IPC] 批量删除创意媒体失败:', e); }
          }
          return { success: true, data: { deleted_count: deletedCount } };
          })();
        } else {
          return withFts5Repair(() => {
          const now = new Date().toISOString();
          const trashStmt = repo.db.prepare(
            'INSERT INTO trash_items (id, item_type, item_id, source_board_id, source_board_name, snapshot, deleted_at) VALUES (?, ?, ?, ?, ?, ?, ?)'
          );
          const updateStmt = repo.db.prepare("UPDATE creativities SET status = 'trashed', updated_at = ? WHERE id = ?");
          
          const transaction = repo.db.transaction(() => {
            for (const id of ids) {
              const creativity = repo.db.prepare('SELECT * FROM creativities WHERE id = ?').get(id);
              if (!creativity) continue;
              
              const tagRows = repo.db.prepare(
                'SELECT t.id, t.name, t.color FROM tags t INNER JOIN creativity_tags ct ON t.id = ct.tag_id WHERE ct.creativity_id = ?'
              ).all(id);
              
              const snapshot = repo.toCamelCase(creativity);
              snapshot.tags = tagRows.map(t => repo.toCamelCase(t));
              
              const isChapter = creativity.subtype === 'chapter';
              const itemType = isChapter ? 'chapter' : 'creativity';
              
              // 获取 board name
              let sourceBoardId = boardId || creativity.board_id || null;
              let sourceBoardName = boardName || null;
              if (sourceBoardId) {
                const board = repo.db.prepare('SELECT name FROM boards WHERE id = ?').get(sourceBoardId);
                if (board) sourceBoardName = board.name;
              }
              
              trashStmt.run(
                repo.generateId(),
                itemType,
                id,
                sourceBoardId,
                sourceBoardName,
                JSON.stringify(snapshot),
                now
              );
              
              const result = updateStmt.run(now, id);
              if (result.changes > 0) deletedCount++;
              
              dataSync.uploadCreativity({ id, status: 'trashed' }).catch(() => {});
              scheduleRagReindex('creativity', id);
            }
          });
          transaction();
          return { success: true, data: { deleted_count: deletedCount } };
          })();
        }
      } catch (e) {
        console.error('[IPC] 批量删除创意失败:', e);
        return { success: false, error: e.message };
      }
    } else {
      const items = repo.JsonStore.get('creativities');
      const trashItems = repo.JsonStore.get('trashItems') || [];
      
      for (const id of ids) {
        const idx = items.findIndex((c) => c.id === id);
        if (idx >= 0) {
          if (permanent) {
            items.splice(idx, 1);
            // 从 trashItems 中移除
            const filteredTrash = trashItems.filter(t => !(t.itemId === id && ['creativity', 'chapter'].includes(t.itemType)));
            repo.JsonStore.set('trashItems', filteredTrash);
          } else {
            const item = items[idx];
            item.status = 'trashed';
            item.updatedAt = new Date().toISOString();
            
            // 添加到 trashItems
            const isChapter = item.subtype === 'chapter';
            // 获取 board name
            let sourceBoardId = boardId || item.boardId || null;
            let sourceBoardName = boardName || null;
            if (sourceBoardId) {
              const boards = repo.JsonStore.get('boards') || [];
              const board = boards.find((b) => b.id === sourceBoardId);
              if (board) sourceBoardName = board.name;
            }
            const trashItem = {
              id: repo.generateId(),
              itemType: isChapter ? 'chapter' : 'creativity',
              itemId: id,
              sourceBoardId,
              sourceBoardName,
              snapshot: item,
              deletedAt: new Date().toISOString()
            };
            trashItems.push(trashItem);
          }
          deletedCount++;
        }
      }
      repo.JsonStore.save();
      return { success: true, data: { deleted_count: deletedCount } };
    }
  });

  // --- 创意关联处理 ---
  ipcMain.handle('link:add', (event, sourceId, targetId, relationType = 'related') => {
    if (repo.db) {
      try {
        // 检查是否已存在关联
        const existing = repo.db.prepare('SELECT * FROM creativity_links WHERE source_id = ? AND target_id = ?').get(sourceId, targetId);
        if (existing) {
          return { success: false, error: '关联已存在' };
        }
        
        const link = {
          id: repo.generateId(),
          source_id: sourceId,
          target_id: targetId,
          relation_type: relationType,
          created_at: new Date().toISOString()
        };
        
        repo.db.prepare('INSERT INTO creativity_links (id, source_id, target_id, relation_type, created_at) VALUES (?, ?, ?, ?, ?)')
          .run(link.id, link.source_id, link.target_id, link.relation_type, link.created_at);
        
        return { success: true, data: link };
      } catch (e) {
        console.error('[IPC] 添加创意关联失败:', e);
        return { success: false, error: e.message };
      }
    } else {
      return { success: false, error: 'JSON模式不支持关联功能' };
    }
  });

  ipcMain.handle('link:remove', (event, sourceId, targetId) => {
    if (repo.db) {
      try {
        const result = repo.db.prepare('DELETE FROM creativity_links WHERE source_id = ? AND target_id = ?').run(sourceId, targetId);
        return { success: result.changes > 0 };
      } catch (e) {
        console.error('[IPC] 移除创意关联失败:', e);
        return { success: false, error: e.message };
      }
    } else {
      return { success: false, error: 'JSON模式不支持关联功能' };
    }
  });

  ipcMain.handle('link:list', (event, creativityId) => {
    if (repo.db) {
      try {
        // 获取与该创意相关的所有关联
        const links = repo.db.prepare(`
          SELECT cl.*, 
                 c1.title as source_title, 
                 c2.title as target_title
          FROM creativity_links cl
          LEFT JOIN creativities c1 ON cl.source_id = c1.id
          LEFT JOIN creativities c2 ON cl.target_id = c2.id
          WHERE cl.source_id = ? OR cl.target_id = ?
          ORDER BY cl.created_at DESC
        `).all(creativityId, creativityId);
        
        return { success: true, data: links };
      } catch (e) {
        console.error('[IPC] 获取创意关联列表失败:', e);
        return { success: false, error: e.message };
      }
    } else {
      return { success: false, error: 'JSON模式不支持关联功能' };
    }
  });

  console.log('[IPC] 创意处理器已注册');
}

module.exports = { registerCreativityHandlers, deleteCreativityMedia };
