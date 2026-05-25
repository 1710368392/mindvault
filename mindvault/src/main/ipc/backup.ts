// @ts-nocheck
/**
 * 备份相关 IPC 处理器
 */

const { ipcMain, dialog } = require('electron');
const path = require('path');
const fs = require('fs');
const archiver = require('archiver');
const extractZip = require('extract-zip');
const repo = require('../db/repository');

function registerBackupHandlers() {
  ipcMain.handle('backup:create', async () => {
    try {
      const timestamp = new Date().toISOString().replace(/[:.]/g, '-').replace('T', '_').split('+')[0];
      const backupFilename = `mindvault_backup_${timestamp}.zip`;
      const backupFilePath = path.join(repo.backupDir, backupFilename);
      repo.ensureDir(repo.backupDir);

      const output = fs.createWriteStream(backupFilePath);
      const archive = archiver('zip', { zlib: { level: 9 } });
      archive.pipe(output);

      const dataDir = repo.userDataPath;
      if (fs.existsSync(dataDir)) {
        archive.directory(dataDir, 'data');
      }

      await archive.finalize();

      const backupRecord = {
        id: repo.generateId(),
        filename: backupFilename,
        filePath: backupFilePath,
        size: fs.statSync(backupFilePath).size,
        createdAt: new Date().toISOString(),
      };

      if (repo.db) {
        repo.db.prepare('INSERT INTO backups (id, filename, file_path, size, created_at) VALUES (?, ?, ?, ?, ?)')
          .run(backupRecord.id, backupRecord.filename, backupRecord.filePath, backupRecord.size, backupRecord.createdAt);
      }

      return { success: true, data: backupRecord };
    } catch (e) {
      console.error('[IPC] 创建备份失败:', e);
      return { success: false, error: e.message };
    }
  });

  ipcMain.handle('backup:list', () => {
    if (repo.db) {
      try {
        return repo.db.prepare('SELECT * FROM backups ORDER BY created_at DESC').all();
      } catch (e) { return []; }
    } else {
      return [];
    }
  });

  ipcMain.handle('backup:restore', async (event, backupId) => {
    try {
      let backupPath = '';
      if (repo.db) {
        const record = repo.db.prepare('SELECT file_path FROM backups WHERE id = ?').get(backupId);
        if (!record) throw new Error('备份记录不存在');
        backupPath = record.file_path;
      } else {
        throw new Error('JSON模式不支持恢复');
      }

      if (!fs.existsSync(backupPath)) throw new Error('备份文件不存在');

      const tempRestoreDir = path.join(repo.backupDir, 'temp_restore_' + Date.now());
      repo.ensureDir(tempRestoreDir);
      await extractZip(backupPath, { dir: tempRestoreDir });

      const sourceDataDir = path.join(tempRestoreDir, 'data');
      if (!fs.existsSync(sourceDataDir)) throw new Error('备份数据格式不正确');

      const targetDataDir = repo.userDataPath;
      repo.ensureDir(targetDataDir);

      function copyRecursive(src, dest) {
        const stat = fs.statSync(src);
        if (stat.isDirectory()) {
          fs.mkdirSync(dest, { recursive: true });
          for (const entry of fs.readdirSync(src)) {
            copyRecursive(path.join(src, entry), path.join(dest, entry));
          }
        } else {
          fs.copyFileSync(src, dest);
        }
      }
      copyRecursive(sourceDataDir, targetDataDir);

      fs.rmSync(tempRestoreDir, { recursive: true, force: true });

      return { success: true, message: '数据已成功恢复，请重启应用' };
    } catch (e) {
      console.error('[IPC] 恢复备份失败:', e);
      return { success: false, error: e.message };
    }
  });

  ipcMain.handle('backup:export-to-file', async (event, format = 'json') => {
    try {
      const result = await dialog.showSaveDialog({
        defaultPath: `mindvault_export.${format}`,
        filters: [
          { name: 'JSON 文件', extensions: ['json'] },
          { name: 'CSV 文件', extensions: ['csv'] },
          { name: '所有文件', extensions: ['*'] },
        ],
      });
      if (result.canceled) return { success: false, canceled: true };

      const exportPath = result.filePath;
      if (format === 'json') {
        const exportData = {};
        if (repo.db) {
          exportData.creativities = repo.db.prepare("SELECT * FROM creativities WHERE status != 'trashed'").all();
          exportData.tags = repo.db.prepare('SELECT * FROM tags').all();
          exportData.boards = repo.db.prepare('SELECT * FROM boards').all();
          exportData.templates = repo.db.prepare('SELECT * FROM templates').all();
          exportData.exportedAt = new Date().toISOString();
        } else {
          exportData.creativities = repo.JsonStore.get('creativities').filter(c => c.status !== 'trashed');
          exportData.tags = repo.JsonStore.get('tags');
          exportData.boards = repo.JsonStore.get('boards');
          exportData.templates = repo.JsonStore.get('templates');
          exportData.exportedAt = new Date().toISOString();
        }
        fs.writeFileSync(exportPath, JSON.stringify(exportData, null, 2));
      } else if (format === 'csv') {
        let csvContent = 'ID,标题,内容,类型,状态,优先级,标签,创建时间\n';
        if (repo.db) {
          const rows = repo.db.prepare("SELECT * FROM creativities WHERE status != 'trashed'").all();
          for (const row of rows) {
            csvContent += `${row.id},"${(row.title || '').replace(/"/g, '""')}","${((row.content || '').substring(0, 100)).replace(/"/g, '""')}",${row.type},${row.status},${row.priority || 0},,${row.created_at}\n`;
          }
        } else {
          const items = repo.JsonStore.get('creativities').filter(c => c.status !== 'trashed');
          for (const item of items) {
            csvContent += `${item.id},"${(item.title || '').replace(/"/g, '""')}","${((item.content || '').substring(0, 100)).replace(/"/g, '""')}",${item.type},${item.status},${item.priority || 0},,${item.createdAt}\n`;
          }
        }
        fs.writeFileSync(exportPath, '\uFEFF' + csvContent);
      }

      return { success: true, message: `导出成功: ${exportPath}` };
    } catch (e) {
      console.error('[IPC] 导出失败:', e);
      return { success: false, error: e.message };
    }
  });

  ipcMain.handle('backup:import-from-file', async () => {
    try {
      const result = await dialog.showOpenDialog({
        properties: ['openFile'],
        filters: [
          { name: 'JSON 文件', extensions: ['json'] },
          { name: '所有文件', extensions: ['*'] },
        ],
      });
      if (result.canceled || result.filePaths.length === 0) {
        return { success: false, canceled: true };
      }

      const importPath = result.filePaths[0];
      const rawData = fs.readFileSync(importPath, 'utf-8');
      const importData = JSON.parse(rawData);
      let importedCount = 0;

      if (repo.db) {
        if (Array.isArray(importData.creativities)) {
          for (const item of importData.creativities) {
            const newId = repo.generateId();
            const now = new Date().toISOString();
            repo.db.prepare(`INSERT INTO creativities (id, title, content, type, priority, emoji_reaction, status, template_id, board_id, position_x, position_y, card_style, created_at, updated_at, is_read)
              VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`).run(
              newId, item.title || '导入的创意', item.content || '', item.type || 'text',
              item.priority || 0, item.emojiReaction || null, 'active',
              item.templateId || null, item.boardId || null,
              item.positionX || null, item.positionY || null,
              item.cardStyle || null, item.createdAt || now, now, 0
            );
            importedCount++;
          }
        }
      } else {
        if (Array.isArray(importData.creativities)) {
          for (const item of importData.creativities) {
            const newItem = {
              ...item,
              id: repo.generateId(),
              status: 'active',
              createdAt: item.createdAt || new Date().toISOString(),
              updatedAt: new Date().toISOString(),
            };
            delete newItem.is_favorite;
            repo.JsonStore.get('creativities').push(newItem);
            importedCount++;
          }
          repo.JsonStore.save();
        }
      }

      return { success: true, data: { imported_count: importedCount }, message: `成功导入 ${importedCount} 条创意` };
    } catch (e) {
      console.error('[IPC] 导入失败:', e);
      return { success: false, error: e.message };
    }
  });

  ipcMain.handle('backup:delete', (event, backupId) => {
    if (repo.db) {
      try {
        const record = repo.db.prepare('SELECT file_path FROM backups WHERE id = ?').get(backupId);
        if (record && record.file_path && fs.existsSync(record.file_path)) {
          fs.unlinkSync(record.file_path);
        }
        repo.db.prepare('DELETE FROM backups WHERE id = ?').run(backupId);
        return { success: true };
      } catch (e) {
        return { success: false, error: e.message };
      }
    } else {
      return { success: false, error: 'JSON模式不支持删除备份' };
    }
  });

  ipcMain.handle('backup:auto', (event, config) => {
    if (config) {
      // 设置自动备份配置 - 单位统一为分钟（前端显示分钟，后端用分钟）
      const configPath = path.join(repo.backupDir, 'auto_backup_config.json');
      try {
        fs.writeFileSync(configPath, JSON.stringify(config, null, 2), 'utf-8');
        return { success: true, data: config };
      } catch (e) {
        console.error('[IPC] 保存自动备份配置失败:', e);
        return { success: false, error: e.message };
      }
    } else {
      // 获取当前自动备份配置 - 默认间隔30分钟
      const configPath = path.join(repo.backupDir, 'auto_backup_config.json');
      try {
        if (fs.existsSync(configPath)) {
          const content = fs.readFileSync(configPath, 'utf-8');
          const data = JSON.parse(content);
          // 确保单位统一
          return { success: true, data: {
            enabled: data.enabled ?? false,
            interval_minutes: data.interval_minutes ?? data.interval_hours ?? 30,
            max_count: data.max_count ?? 10
          }};
        } else {
          // 默认配置
          return { success: true, data: {
            enabled: false,
            interval_minutes: 30,
            max_count: 10
          }};
        }
      } catch (e) {
        console.error('[IPC] 读取自动备份配置失败:', e);
        return { success: false, error: e.message };
      }
    }
  });

  console.log('[IPC] 备份处理器已注册');
}

module.exports = { registerBackupHandlers };
