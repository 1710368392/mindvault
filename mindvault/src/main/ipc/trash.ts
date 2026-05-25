// @ts-nocheck
const { ipcMain } = require('electron');
const fs = require('fs');
const repo = require('../db/repository');
const { deleteCreativityMedia } = require('./creativity');

function registerTrashHandlers() {
  ipcMain.handle('trash:list', () => {
    if (repo.db) {
      try {
        const results = repo.db.prepare('SELECT * FROM trash_items ORDER BY deleted_at DESC').all();
        return repo.mapRows(results).map((item: any) => ({
          ...item,
          snapshot: JSON.parse(item.snapshot),
        }));
      } catch (e) { console.error('[IPC] 获取回收站列表失败:', e); return []; }
    } else {
      try {
        const items = repo.JsonStore.get('trashItems') || [];
        return items.map((item: any) => ({ ...item, snapshot: typeof item.snapshot === 'string' ? JSON.parse(item.snapshot) : item.snapshot }));
      } catch (e) { return []; }
    }
  });

  ipcMain.handle('trash:add', (event, data) => {
    const now = new Date().toISOString();
    const id = repo.generateId();
    const snapshot = typeof data.snapshot === 'string' ? data.snapshot : JSON.stringify(data.snapshot);

    if (repo.db) {
      try {
        repo.db.prepare('INSERT INTO trash_items (id, item_type, item_id, source_board_id, source_board_name, snapshot, deleted_at) VALUES (?, ?, ?, ?, ?, ?, ?)')
          .run(id, data.itemType, data.itemId, data.sourceBoardId || null, data.sourceBoardName || null, snapshot, now);
        return { id, itemType: data.itemType, itemId: data.itemId, sourceBoardId: data.sourceBoardId || null, sourceBoardName: data.sourceBoardName || null, snapshot: data.snapshot, deletedAt: now };
      } catch (e) { console.error('[IPC] 添加回收站项失败:', e); return null; }
    } else {
      const items = repo.JsonStore.get('trashItems') || [];
      const item = { id, itemType: data.itemType, itemId: data.itemId, sourceBoardId: data.sourceBoardId || null, sourceBoardName: data.sourceBoardName || null, snapshot: data.snapshot, deletedAt: now };
      items.push(item);
      repo.JsonStore.set('trashItems', items);
      repo.JsonStore.save();
      return item;
    }
  });

  ipcMain.handle('trash:restore', (event, trashItemId) => {
    if (repo.db) {
      try {
        const item = repo.db.prepare('SELECT * FROM trash_items WHERE id = ?').get(trashItemId);
        if (!item) return null;
        const parsed = repo.toCamelCase(item);
        parsed.snapshot = JSON.parse(parsed.snapshot);
        repo.db.prepare('DELETE FROM trash_items WHERE id = ?').run(trashItemId);
        return parsed;
      } catch (e) { console.error('[IPC] 恢复回收站项失败:', e); return null; }
    } else {
      const items = repo.JsonStore.get('trashItems') || [];
      const idx = items.findIndex((i: any) => i.id === trashItemId);
      if (idx === -1) return null;
      const item = items.splice(idx, 1)[0];
      item.snapshot = typeof item.snapshot === 'string' ? JSON.parse(item.snapshot) : item.snapshot;
      repo.JsonStore.set('trashItems', items);
      repo.JsonStore.save();
      return item;
    }
  });

  ipcMain.handle('trash:permanent-delete', (event, trashItemId) => {
    if (repo.db) {
      try {
        const item = repo.db.prepare('SELECT item_type, item_id FROM trash_items WHERE id = ?').get(trashItemId);
        if (item && item.item_type === 'creativity' && item.item_id) {
          try { deleteCreativityMedia(repo.db, item.item_id); } catch (e) { console.error('[IPC] 清理创意媒体失败:', e); }
        }
        repo.db.prepare('DELETE FROM trash_items WHERE id = ?').run(trashItemId);
        return true;
      } catch (e) { console.error('[IPC] 永久删除回收站项失败:', e); return false; }
    } else {
      const items = repo.JsonStore.get('trashItems') || [];
      repo.JsonStore.set('trashItems', items.filter((i: any) => i.id !== trashItemId));
      repo.JsonStore.save();
      return true;
    }
  });

  ipcMain.handle('trash:clear', () => {
    if (repo.db) {
      try {
        const creativityItems = repo.db.prepare("SELECT item_id FROM trash_items WHERE item_type IN ('creativity', 'chapter')").all();
        for (const item of creativityItems) {
          try { deleteCreativityMedia(repo.db, item.item_id); } catch (e) { console.error('[IPC] 清理创意媒体失败:', e); }
        }
        repo.db.prepare('DELETE FROM trash_items').run();
        return true;
      } catch (e) { console.error('[IPC] 清空回收站失败:', e); return false; }
    } else {
      repo.JsonStore.set('trashItems', []);
      repo.JsonStore.save();
      return true;
    }
  });

  ipcMain.handle('trash:check-board-exists', (event, boardId) => {
    if (repo.db) {
      try {
        const board = repo.db.prepare('SELECT id, name FROM boards WHERE id = ?').get(boardId);
        return board ? repo.toCamelCase(board) : null;
      } catch (e) { return null; }
    } else {
      const boards = repo.JsonStore.get('boards') || [];
      return boards.find((b: any) => b.id === boardId) || null;
    }
  });

  // ===== 新增功能 =====

  // 1. 搜索功能
  ipcMain.handle('trash:search', (event, keyword: string, filters?: any) => {
    if (repo.db) {
      try {
        let query = 'SELECT * FROM trash_items WHERE 1=1';
        const params: any[] = [];

        if (keyword) {
          query += ' AND (snapshot LIKE ? OR item_type LIKE ?)';
          const kw = `%${keyword}%`;
          params.push(kw, kw);
        }

        if (filters?.types && filters.types.length > 0) {
          query += ` AND item_type IN (${filters.types.map(() => '?').join(',')})`;
          params.push(...filters.types);
        }

        if (filters?.dateFrom) {
          query += ' AND deleted_at >= ?';
          params.push(filters.dateFrom);
        }

        if (filters?.dateTo) {
          query += ' AND deleted_at <= ?';
          params.push(filters.dateTo);
        }

        query += ' ORDER BY deleted_at DESC';

        const results = repo.db.prepare(query).all(...params);
        return repo.mapRows(results).map((item: any) => ({
          ...item,
          snapshot: JSON.parse(item.snapshot),
        }));
      } catch (e) { console.error('[IPC] 搜索回收站失败:', e); return []; }
    }
    return [];
  });

  // 2. 预览功能
  ipcMain.handle('trash:preview', (event, trashItemId: string) => {
    if (repo.db) {
      try {
        const item = repo.db.prepare('SELECT * FROM trash_items WHERE id = ?').get(trashItemId);
        if (!item) return null;

        // 更新访问次数
        const now = new Date().toISOString();
        repo.db.prepare('UPDATE trash_items SET access_count = access_count + 1, last_accessed = ? WHERE id = ?').run(now, trashItemId);

        const parsed = repo.toCamelCase(item);
        parsed.snapshot = JSON.parse(parsed.snapshot);
        return parsed;
      } catch (e) { console.error('[IPC] 获取预览失败:', e); return null; }
    }
    return null;
  });

  // 3. 智能恢复
  ipcMain.handle('trash:restoreSmart', (event, trashItemId: string, targetBoardId?: string) => {
    if (repo.db) {
      try {
        const item = repo.db.prepare('SELECT * FROM trash_items WHERE id = ?').get(trashItemId);
        if (!item) return { success: false, error: '项目不存在' };

        const sourceBoardId = item.source_board_id;
        let finalBoardId = targetBoardId || sourceBoardId;

        // 检查目标创意库是否存在
        if (finalBoardId) {
          const board = repo.db.prepare('SELECT id FROM boards WHERE id = ?').get(finalBoardId);
          if (!board) {
            // 创意库不存在，返回错误
            return { success: false, error: '目标创意库不存在', needSelectBoard: true };
          }
        }

        // 执行恢复逻辑（复用现有的恢复逻辑）
        const parsed = repo.toCamelCase(item);
        parsed.snapshot = JSON.parse(parsed.snapshot);
        repo.db.prepare('DELETE FROM trash_items WHERE id = ?').run(trashItemId);

        // 记录操作历史
        const historyId = repo.generateId();
        repo.db.prepare('INSERT INTO trash_history (id, action, trash_item_id, item_title, item_type, target_info, created_at) VALUES (?, ?, ?, ?, ?, ?, ?)')
          .run(historyId, 'restore', trashItemId, parsed.snapshot?.title || '未命名项目', parsed.item_type, JSON.stringify({ boardId: finalBoardId }), now);

        return { success: true, item: parsed, targetBoardId: finalBoardId };
      } catch (e) { console.error('[IPC] 智能恢复失败:', e); return { success: false, error: e.message }; }
    }
    return { success: false, error: '数据库不可用' };
  });

  // 4. 获取版本历史
  ipcMain.handle('trash:getVersions', (event, trashItemId: string) => {
    if (repo.db) {
      try {
        const results = repo.db.prepare('SELECT * FROM trash_versions WHERE trash_item_id = ? ORDER BY version_number DESC').all(trashItemId);
        return repo.mapRows(results).map((item: any) => ({
          ...item,
          versionData: JSON.parse(item.versionData),
        }));
      } catch (e) { console.error('[IPC] 获取版本历史失败:', e); return []; }
    }
    return [];
  });

  // 5. 恢复到特定版本
  ipcMain.handle('trash:restoreVersion', (event, versionId: string) => {
    if (repo.db) {
      try {
        const version = repo.db.prepare('SELECT * FROM trash_versions WHERE id = ?').get(versionId);
        if (!version) return { success: false, error: '版本不存在' };

        const parsed = repo.toCamelCase(version);
        parsed.versionData = JSON.parse(parsed.versionData);

        // 更新 trash_items 的 snapshot
        repo.db.prepare('UPDATE trash_items SET snapshot = ? WHERE id = ?').run(JSON.stringify(parsed.versionData), parsed.trashItemId);

        return { success: true, item: parsed };
      } catch (e) { console.error('[IPC] 恢复版本失败:', e); return { success: false, error: e.message }; }
    }
    return { success: false, error: '数据库不可用' };
  });

  // 6. 项目对比
  ipcMain.handle('trash:compare', (event, itemId1: string, itemId2: string) => {
    if (repo.db) {
      try {
        const item1 = repo.db.prepare('SELECT * FROM trash_items WHERE id = ?').get(itemId1);
        const item2 = repo.db.prepare('SELECT * FROM trash_items WHERE id = ?').get(itemId2);

        if (!item1 || !item2) return { success: false, error: '项目不存在' };

        const parsed1 = repo.toCamelCase(item1);
        const parsed2 = repo.toCamelCase(item2);
        parsed1.snapshot = JSON.parse(parsed1.snapshot);
        parsed2.snapshot = JSON.parse(parsed2.snapshot);

        const differences: any[] = [];

        // 比较基本字段
        const fieldsToCompare = ['itemType', 'sourceBoardId', 'sourceBoardName'];
        for (const field of fieldsToCompare) {
          if (parsed1[field] !== parsed2[field]) {
            differences.push({
              field,
              oldValue: parsed1[field],
              newValue: parsed2[field],
            });
          }
        }

        // 比较 snapshot 内容
        if (parsed1.snapshot?.title !== parsed2.snapshot?.title) {
          differences.push({ field: 'title', oldValue: parsed1.snapshot?.title, newValue: parsed2.snapshot?.title });
        }
        if (parsed1.snapshot?.content !== parsed2.snapshot?.content) {
          differences.push({ field: 'content', oldValue: parsed1.snapshot?.content, newValue: parsed2.snapshot?.content });
        }

        return {
          success: true,
          item1: parsed1,
          item2: parsed2,
          differences,
        };
      } catch (e) { console.error('[IPC] 项目对比失败:', e); return { success: false, error: e.message }; }
    }
    return { success: false, error: '数据库不可用' };
  });

  // 7. 统计信息
  ipcMain.handle('trash:getStats', () => {
    if (repo.db) {
      try {
        const items = repo.db.prepare('SELECT * FROM trash_items').all();
        const stats = {
          totalItems: items.length,
          byType: {} as Record<string, number>,
          byDays: {} as Record<string, number>,
          averageAge: 0,
          largestItem: null as { title: string; sizeMB: number } | null,
          oldestItem: null as { title: string; daysAgo: number } | null,
        };

        let totalDays = 0;
        let largestSize = 0;
        let oldestDate = new Date();

        for (const item of items) {
          // 按类型统计
          stats.byType[item.item_type] = (stats.byType[item.item_type] || 0) + 1;

          // 按天数统计
          const deletedAt = new Date(item.deleted_at);
          const daysAgo = Math.floor((Date.now() - deletedAt.getTime()) / (1000 * 60 * 60 * 24));
          const dayKey = deletedAt.toISOString().split('T')[0];
          stats.byDays[dayKey] = (stats.byDays[dayKey] || 0) + 1;

          totalDays += daysAgo;

          // 最大文件
          if (item.file_size > largestSize) {
            largestSize = item.file_size;
            const snapshot = JSON.parse(item.snapshot);
            stats.largestItem = { title: snapshot?.title || '未命名', sizeMB: largestSize / (1024 * 1024) };
          }

          // 最旧项目
          if (deletedAt < oldestDate) {
            oldestDate = deletedAt;
            const snapshot = JSON.parse(item.snapshot);
            stats.oldestItem = { title: snapshot?.title || '未命名', daysAgo };
          }
        }

        if (items.length > 0) {
          stats.averageAge = totalDays / items.length;
        }

        return stats;
      } catch (e) { console.error('[IPC] 获取统计信息失败:', e); return null; }
    }
    return null;
  });

  // 8. 容量信息
  ipcMain.handle('trash:getCapacity', () => {
    if (repo.db) {
      try {
        const items = repo.db.prepare('SELECT item_type, file_size FROM trash_items').all();
        const settings = repo.db.prepare("SELECT value FROM trash_settings WHERE key = 'maxCapacityMB'").get();
        const maxCapacityMB = settings ? parseInt(JSON.parse(settings.value)) : 500;

        let totalSize = 0;
        const byType: Record<string, { count: number; sizeMB: number }> = {};

        for (const item of items) {
          totalSize += item.file_size || 0;
          const type = item.item_type;
          if (!byType[type]) byType[type] = { count: 0, sizeMB: 0 };
          byType[type].count++;
          byType[type].sizeMB += (item.file_size || 0) / (1024 * 1024);
        }

        return {
          usedMB: totalSize / (1024 * 1024),
          totalMB: maxCapacityMB,
          usedPercent: (totalSize / (1024 * 1024) / maxCapacityMB) * 100,
          itemCount: items.length,
          byType,
        };
      } catch (e) { console.error('[IPC] 获取容量信息失败:', e); return null; }
    }
    return null;
  });

  // 9. 获取设置
  ipcMain.handle('trash:getSettings', () => {
    if (repo.db) {
      try {
        const settings: any = {
          autoCleanEnabled: false,
          autoCleanDays: 30,
          maxCapacityMB: 500,
          notificationEnabled: true,
          cloudSyncEnabled: false,
          cloudSyncProvider: null,
          lastCleanTime: null,
          smartCleanEnabled: false,
        };

        const rows = repo.db.prepare('SELECT key, value FROM trash_settings').all();
        for (const row of rows) {
          try {
            settings[row.key] = JSON.parse(row.value);
          } catch { settings[row.key] = row.value; }
        }

        return settings;
      } catch (e) { console.error('[IPC] 获取设置失败:', e); return null; }
    }
    return null;
  });

  // 10. 更新设置
  ipcMain.handle('trash:updateSettings', (event, settings: any) => {
    if (repo.db) {
      try {
        const now = new Date().toISOString();
        for (const [key, value] of Object.entries(settings)) {
          repo.db.prepare('INSERT OR REPLACE INTO trash_settings (key, value, updated_at) VALUES (?, ?, ?)')
            .run(key, JSON.stringify(value), now);
        }
        return true;
      } catch (e) { console.error('[IPC] 更新设置失败:', e); return false; }
    }
    return false;
  });

  // 11. 自动清理
  ipcMain.handle('trash:autoClean', () => {
    if (repo.db) {
      try {
        const settings = repo.db.prepare("SELECT value FROM trash_settings WHERE key = 'autoCleanEnabled'").get();
        const autoCleanEnabled = settings ? JSON.parse(settings.value) : false;

        if (!autoCleanEnabled) return { success: true, cleaned: 0, message: '自动清理未启用' };

        const daysSetting = repo.db.prepare("SELECT value FROM trash_settings WHERE key = 'autoCleanDays'").get();
        const days = daysSetting ? parseInt(JSON.parse(daysSetting.value)) : 30;

        const cutoffDate = new Date(Date.now() - days * 24 * 60 * 60 * 1000).toISOString();

        // 删除超过指定天数的项目
        const oldItems = repo.db.prepare('SELECT * FROM trash_items WHERE deleted_at < ?').all(cutoffDate);

        for (const item of oldItems) {
          if (item.item_type === 'creativity' && item.item_id) {
            try { deleteCreativityMedia(repo.db, item.item_id); } catch (e) { console.error('[IPC] 清理媒体失败:', e); }
          }
        }

        repo.db.prepare('DELETE FROM trash_items WHERE deleted_at < ?').run(cutoffDate);

        // 更新最后清理时间
        const now = new Date().toISOString();
        repo.db.prepare('INSERT OR REPLACE INTO trash_settings (key, value, updated_at) VALUES (?, ?, ?)')
          .run('lastCleanTime', JSON.stringify(now), now);

        // 记录操作历史
        const historyId = repo.generateId();
        repo.db.prepare('INSERT INTO trash_history (id, action, item_title, description, created_at) VALUES (?, ?, ?, ?, ?)')
          .run(historyId, 'auto_clean', `${oldItems.length} 个项目`, '自动清理', now);

        return { success: true, cleaned: oldItems.length, message: `清理了 ${oldItems.length} 个超过 ${days} 天的项目` };
      } catch (e) { console.error('[IPC] 自动清理失败:', e); return { success: false, error: e.message }; }
    }
    return { success: false, error: '数据库不可用' };
  });

  // 12. 获取关联关系
  ipcMain.handle('trash:getRelations', (event, trashItemId: string) => {
    if (repo.db) {
      try {
        const item = repo.db.prepare('SELECT * FROM trash_items WHERE id = ?').get(trashItemId);
        if (!item) return [];

        const snapshot = JSON.parse(item.snapshot);
        const relations: any[] = [];

        // 文件夹关联
        if (item.item_type === 'folder' && snapshot.creativityIds?.length > 0) {
          relations.push({
            type: 'folder-contents',
            totalCount: snapshot.creativityIds.length,
            relatedItems: snapshot.creativityIds.slice(0, 5).map((id: string) => ({ id, title: '创意', type: 'creativity' })),
          });
        }

        // 创意库关联
        if (item.item_type === 'board' && snapshot.creativityIds?.length > 0) {
          relations.push({
            type: 'board-contents',
            totalCount: snapshot.creativityIds.length,
            relatedItems: snapshot.creativityIds.slice(0, 5).map((id: string) => ({ id, title: '创意', type: 'creativity' })),
          });
        }

        return relations;
      } catch (e) { console.error('[IPC] 获取关联关系失败:', e); return []; }
    }
    return [];
  });

  // 13. 获取操作历史
  ipcMain.handle('trash:getHistory', (event, options?: any) => {
    if (repo.db) {
      try {
        let query = 'SELECT * FROM trash_history';
        const params: any[] = [];

        if (options?.limit) {
          query += ' ORDER BY created_at DESC LIMIT ?';
          params.push(options.limit);
        } else {
          query += ' ORDER BY created_at DESC LIMIT 50';
        }

        const results = repo.db.prepare(query).all(...params);
        return repo.mapRows(results).map((item: any) => ({
          ...item,
          targetInfo: item.targetInfo ? JSON.parse(item.targetInfo) : null,
        }));
      } catch (e) { console.error('[IPC] 获取操作历史失败:', e); return []; }
    }
    return [];
  });

  // 14. 记录操作历史
  ipcMain.handle('trash:addHistory', (event, record: any) => {
    if (repo.db) {
      try {
        const id = repo.generateId();
        const now = new Date().toISOString();
        repo.db.prepare('INSERT INTO trash_history (id, action, trash_item_id, item_title, item_type, target_info, operator, description, created_at) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)')
          .run(id, record.action, record.trashItemId || null, record.itemTitle, record.itemType || null, record.targetInfo ? JSON.stringify(record.targetInfo) : null, record.operator || null, record.description || null, now);
        return true;
      } catch (e) { console.error('[IPC] 记录操作历史失败:', e); return false; }
    }
    return false;
  });

  // 15. 生成智能标签
  ipcMain.handle('trash:generateSmartLabels', (event, trashItemId: string) => {
    if (repo.db) {
      try {
        const item = repo.db.prepare('SELECT * FROM trash_items WHERE id = ?').get(trashItemId);
        if (!item) return [];

        const labels: any[] = [];
        const deletedAt = new Date(item.deleted_at);
        const daysAgo = Math.floor((Date.now() - deletedAt.getTime()) / (1000 * 60 * 60 * 24));

        // 最近删除（7天内）
        if (daysAgo <= 7) {
          labels.push({ type: 'recent', label: '最近删除', color: '#10B981', description: `${daysAgo} 天前删除` });
        }

        // 大文件（>10MB）
        if ((item.file_size || 0) > 10 * 1024 * 1024) {
          labels.push({ type: 'large-file', label: '大文件', color: '#EF4444', description: `${(item.file_size / (1024 * 1024)).toFixed(1)} MB` });
        }

        // 频繁访问
        if ((item.access_count || 0) > 3) {
          labels.push({ type: 'frequent-access', label: '频繁访问', color: '#3B82F6', description: `访问 ${item.access_count} 次` });
        }

        // 重要项目（基于 metadata）
        const snapshot = JSON.parse(item.snapshot);
        if (snapshot?.priority >= 4) {
          labels.push({ type: 'important', label: '重要', color: '#F59E0B', description: '高优先级项目' });
        }

        // 大型文件夹
        if (item.item_type === 'folder' && snapshot?.creativityIds?.length > 10) {
          labels.push({ type: 'large-folder', label: '大型文件夹', color: '#8B5CF6', description: `包含 ${snapshot.creativityIds.length} 个项目` });
        }

        return labels;
      } catch (e) { console.error('[IPC] 生成智能标签失败:', e); return []; }
    }
    return [];
  });

  // 16. 获取删除影响评估
  ipcMain.handle('trash:getDeleteImpact', (event, trashItemId: string) => {
    if (repo.db) {
      try {
        const item = repo.db.prepare('SELECT * FROM trash_items WHERE id = ?').get(trashItemId);
        if (!item) return null;

        const snapshot = JSON.parse(item.snapshot);
        const versions = repo.db.prepare('SELECT COUNT(*) as count FROM trash_versions WHERE trash_item_id = ?').get(trashItemId);

        let relatedCount = 0;
        if (item.item_type === 'folder') relatedCount = snapshot?.creativityIds?.length || 0;
        if (item.item_type === 'board') relatedCount = snapshot?.creativityIds?.length || 0;

        return {
          itemId: trashItemId,
          itemTitle: snapshot?.title || '未命名项目',
          fileSize: item.file_size || 0,
          relatedCount,
          versionCount: versions?.count || 0,
          hasLinkedItems: relatedCount > 0,
        };
      } catch (e) { console.error('[IPC] 获取删除影响失败:', e); return null; }
    }
    return null;
  });

  // 17. 批量恢复
  ipcMain.handle('trash:batchRestore', (event, trashItemIds: string[], targetBoardId?: string) => {
    if (repo.db) {
      try {
        const now = new Date().toISOString();
        let restored = 0;

        for (const id of trashItemIds) {
          const item = repo.db.prepare('SELECT * FROM trash_items WHERE id = ?').get(id);
          if (item) {
            repo.db.prepare('DELETE FROM trash_items WHERE id = ?').run(id);
            restored++;

            // 记录操作历史
            const historyId = repo.generateId();
            const snapshot = JSON.parse(item.snapshot);
            repo.db.prepare('INSERT INTO trash_history (id, action, trash_item_id, item_title, item_type, target_info, created_at) VALUES (?, ?, ?, ?, ?, ?, ?)')
              .run(historyId, 'batch_restore', id, snapshot?.title || '未命名项目', item.item_type, JSON.stringify({ boardId: targetBoardId }), now);
          }
        }

        return { success: true, restored };
      } catch (e) { console.error('[IPC] 批量恢复失败:', e); return { success: false, error: e.message }; }
    }
    return { success: false, error: '数据库不可用' };
  });

  // 18. 批量永久删除
  ipcMain.handle('trash:batchPermanentDelete', (event, trashItemIds: string[]) => {
    if (repo.db) {
      try {
        let deleted = 0;

        for (const id of trashItemIds) {
          const item = repo.db.prepare('SELECT * FROM trash_items WHERE id = ?').get(id);
          if (item) {
            if (item.item_type === 'creativity' && item.item_id) {
              try { deleteCreativityMedia(repo.db, item.item_id); } catch (e) { console.error('[IPC] 清理媒体失败:', e); }
            }
            repo.db.prepare('DELETE FROM trash_items WHERE id = ?').run(id);
            deleted++;

            // 记录操作历史
            const historyId = repo.generateId();
            const now = new Date().toISOString();
            const snapshot = JSON.parse(item.snapshot);
            repo.db.prepare('INSERT INTO trash_history (id, action, trash_item_id, item_title, item_type, created_at) VALUES (?, ?, ?, ?, ?, ?)')
              .run(historyId, 'batch_delete', id, snapshot?.title || '未命名项目', item.item_type, now);
          }
        }

        return { success: true, deleted };
      } catch (e) { console.error('[IPC] 批量永久删除失败:', e); return { success: false, error: e.message }; }
    }
    return { success: false, error: '数据库不可用' };
  });

  // ===== 预留功能接口 =====

  // 19. AI 建议（预留）
  ipcMain.handle('trash:getAISuggestions', () => {
    // 预留接口，后续集成 AI 功能
    return [];
  });

  // 20. 云同步状态（预留）
  ipcMain.handle('trash:getCloudStatus', (event, trashItemId: string) => {
    if (repo.db) {
      try {
        const item = repo.db.prepare('SELECT cloud_status, cloud_id FROM trash_items WHERE id = ?').get(trashItemId);
        return item ? { status: item.cloud_status, cloudId: item.cloud_id } : null;
      } catch (e) { return null; }
    }
    return null;
  });

  // 21. 同步到云端（预留）
  ipcMain.handle('trash:syncToCloud', (event, trashItemId: string) => {
    // 预留接口，后续实现云同步功能
    return { success: false, error: '云同步功能尚未实现' };
  });

  // 22. 分享到团队（预留）
  ipcMain.handle('trash:shareToTeam', (event, trashItemId: string, teamId: string) => {
    // 预留接口，后续实现协作功能
    return { success: false, error: '团队协作功能尚未实现' };
  });
}

module.exports = { registerTrashHandlers };
