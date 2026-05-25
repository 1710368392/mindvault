// @ts-nocheck

const { ipcMain, dialog, protocol, net, app } = require('electron');
const path = require('path');
const fs = require('fs');
const { execFile } = require('child_process');
const repo = require('../db/repository');
const { extractThumbnail, isVideoFile, checkFfmpeg, getThumbnailsDir } = require('../utils/videoThumbnail');
const thumbUtil = require('../utils/imageThumbnail');

const IMAGE_EXTS = ['.png', '.jpg', '.jpeg', '.gif', '.bmp', '.webp', '.svg', '.ico'];
const AUDIO_EXTS = ['.mp3', '.wav', '.ogg', '.flac', '.aac', '.m4a', '.wma'];
const VIDEO_EXTS = ['.mp4', '.webm', '.avi', '.mov', '.mkv', '.wmv', '.flv'];
const DOCUMENT_EXTS = ['.pdf'];

function getMediaType(ext) {
  if (IMAGE_EXTS.includes(ext)) return 'image';
  if (AUDIO_EXTS.includes(ext)) return 'audio';
  if (VIDEO_EXTS.includes(ext)) return 'video';
  if (DOCUMENT_EXTS.includes(ext)) return 'document';
  return null;
}

function getMimeFromExt(ext) {
  const mimeMap = {
    '.png': 'image/png', '.jpg': 'image/jpeg', '.jpeg': 'image/jpeg',
    '.gif': 'image/gif', '.bmp': 'image/bmp', '.webp': 'image/webp',
    '.svg': 'image/svg+xml', '.ico': 'image/x-icon',
    '.mp3': 'audio/mpeg', '.wav': 'audio/wav', '.ogg': 'audio/ogg',
    '.flac': 'audio/flac', '.aac': 'audio/aac', '.m4a': 'audio/mp4',
    '.mp4': 'video/mp4', '.webm': 'video/webm', '.avi': 'video/x-msvideo',
    '.mov': 'video/quicktime', '.mkv': 'video/x-matroska',
    '.pdf': 'application/pdf',
  };
  return mimeMap[ext] || 'application/octet-stream';
}

function pathToFileUrl(filePath) {
  if (!filePath) return '';
  if (filePath.startsWith('data:') || filePath.startsWith('http://') || filePath.startsWith('https://') || filePath.startsWith('local-media://')) {
    return filePath;
  }
  const normalized = filePath.replace(/\\/g, '/');
  return 'local-media:///' + encodeURI(normalized);
}

function registerMediaHandlers(mainWindow: any) {
  ipcMain.handle('media:list', () => {
    if (repo.db) {
      try {
        return repo.mapRows(repo.db.prepare('SELECT * FROM media ORDER BY sort_order ASC, created_at DESC').all());
      } catch (e) { return []; }
    } else {
      return repo.JsonStore.get('media') || [];
    }
  });

  ipcMain.handle('media:list-by-creativity', (event, creativityId) => {
    if (repo.db) {
      try {
        return repo.mapRows(repo.db.prepare('SELECT * FROM media WHERE creativity_id = ? ORDER BY sort_order ASC, created_at ASC').all(creativityId));
      } catch (e) { return []; }
    } else {
      return (repo.JsonStore.get('media') || []).filter(m => m.creativityId === creativityId);
    }
  });

  ipcMain.handle('media:save', async (event, data: any, creativityId?: string) => {
  try {
    console.log('[IPC] media:save 收到请求, fileName:', data?.fileName, 'fileType:', data?.fileType, 'dataSize:', data?.data?.length || data?.data?.byteLength || 'N/A');
    if (data && data.data && data.fileName) {
      let uint8;
      if (data.data instanceof Uint8Array) {
        uint8 = data.data;
      } else if (data.data instanceof ArrayBuffer) {
        uint8 = new Uint8Array(data.data);
      } else if (ArrayBuffer.isView(data.data)) {
        uint8 = new Uint8Array(data.data.buffer, data.data.byteOffset, data.data.byteLength);
      } else if (Array.isArray(data.data)) {
        uint8 = new Uint8Array(data.data);
      } else if (data.data && typeof data.data === 'object' && data.data.type === 'Buffer' && Array.isArray(data.data.data)) {
        uint8 = new Uint8Array(data.data.data);
      } else if (data.data && typeof data.data === 'object' && data.data.length !== undefined) {
        try {
          uint8 = new Uint8Array(Array.from(data.data));
        } catch (e) {
          console.error('[IPC] media:save 无法识别的数据格式:', typeof data.data, e);
          return { success: false, error: '无法识别的数据格式' };
        }
      } else {
        console.error('[IPC] media:save 无法识别的数据格式:', typeof data.data);
        return { success: false, error: '无法识别的数据格式' };
      }
      console.log('[IPC] media:save uint8 length:', uint8.length, 'mediaDir:', repo.mediaDir);
        const ext = path.extname(data.fileName).toLowerCase();
        const mediaType = data.fileType || getMediaType(ext) || 'image';
        const mimeType = getMimeFromExt(ext);
        const prefix = mediaType === 'video' ? 'vid' : mediaType === 'audio' ? 'aud' : mediaType === 'document' ? 'doc' : 'img';
        const filename = `${prefix}_${Date.now()}${ext}`;
        const filePath = path.join(repo.mediaDir, filename);

        fs.writeFileSync(filePath, Buffer.from(uint8));
        console.log('[IPC] media:save 文件已写入:', filePath, '大小:', fs.statSync(filePath).size);

        const mediaRecord = {
          id: repo.generateId(),
          creativityId: data.creativityId || null,
          type: mediaType,
          filename,
          originalName: data.fileName,
          filePath,
          mimeType,
          fileSize: fs.statSync(filePath).size,
          width: data.width || null,
          height: data.height || null,
          sortOrder: data.sortOrder || 0,
          createdAt: new Date().toISOString(),
        };

        if (repo.db) {
          repo.db.prepare('INSERT INTO media (id, creativity_id, filename, filepath, mime_type, file_size, width, height, thumbnail_path, sort_order, created_at) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)')
            .run(mediaRecord.id, mediaRecord.creativityId, mediaRecord.filename, mediaRecord.filePath, mediaRecord.mimeType, mediaRecord.fileSize, mediaRecord.width, mediaRecord.height, null, mediaRecord.sortOrder, mediaRecord.createdAt);
        } else {
          repo.JsonStore.get('media').push(mediaRecord);
          repo.JsonStore.save();
        }

        if (mediaType === 'image') {
          const thumbPath = thumbUtil.getThumbnailPath(repo.mediaDir, filename);
          thumbUtil.generateImageThumbnail(filePath, thumbPath).then((tp) => {
            if (tp && repo.db) {
              try {
                repo.db.prepare('UPDATE media SET thumbnail_path = ? WHERE id = ?').run(tp, mediaRecord.id);
              } catch (e) {
                console.error('[IPC] 更新缩略图路径失败:', e);
              }
            }
          }).catch((e) => {
            console.error('[IPC] 生成缩略图失败:', e);
          });
        }

        if (mediaType === 'video') {
          extractThumbnail(filePath).then((tp) => {
            if (tp && repo.db) {
              try {
                repo.db.prepare('UPDATE media SET thumbnail_path = ? WHERE id = ?').run(tp, mediaRecord.id);
              } catch (e) {
                console.error('[IPC] 更新视频缩略图路径失败:', e);
              }
            }
          }).catch((e) => {
            console.error('[IPC] 生成视频缩略图失败:', e);
          });
        }

        return { success: true, data: repo.toCamelCase ? repo.toCamelCase(mediaRecord) : mediaRecord };
      }

      if (typeof data === 'string' && data.startsWith('data:')) {
        const matches = data.match(/^data:([\w/+]+);base64,(.+)$/);
        if (!matches) return { success: false, error: '无法解析数据格式' };
        const mimeType = matches[1];
        const base64Data = matches[2];
        const mimeToExt = {
          'image/png': '.png', 'image/jpeg': '.jpg', 'image/gif': '.gif',
          'image/bmp': '.bmp', 'image/webp': '.webp', 'image/svg+xml': '.svg',
          'audio/mpeg': '.mp3', 'audio/wav': '.wav', 'audio/ogg': '.ogg',
          'audio/flac': '.flac', 'audio/aac': '.aac',
          'video/mp4': '.mp4', 'video/webm': '.webm',
        };
        const ext = mimeToExt[mimeType] || '.bin';
        const mediaType = mimeType.startsWith('image/') ? 'image' : mimeType.startsWith('audio/') ? 'audio' : mimeType.startsWith('video/') ? 'video' : 'image';
        const prefix = mediaType === 'video' ? 'vid' : mediaType === 'audio' ? 'aud' : 'img';
        const filename = `${prefix}_${Date.now()}${ext}`;
        const filePath = path.join(repo.mediaDir, filename);

        fs.writeFileSync(filePath, Buffer.from(base64Data, 'base64'));

        const mediaRecord = {
          id: repo.generateId(),
          creativityId: creativityId || null,
          type: mediaType,
          filename,
          originalName: filename,
          filePath,
          mimeType,
          fileSize: fs.statSync(filePath).size,
          sortOrder: 0,
          createdAt: new Date().toISOString(),
        };

        if (repo.db) {
          repo.db.prepare('INSERT INTO media (id, creativity_id, filename, filepath, mime_type, file_size, width, height, thumbnail_path, sort_order, created_at) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)')
            .run(mediaRecord.id, mediaRecord.creativityId, mediaRecord.filename, mediaRecord.filePath, mediaRecord.mimeType, mediaRecord.fileSize, null, null, null, mediaRecord.sortOrder, mediaRecord.createdAt);
        } else {
          repo.JsonStore.get('media').push(mediaRecord);
          repo.JsonStore.save();
        }

        if (mediaType === 'image') {
          const thumbPath = thumbUtil.getThumbnailPath(repo.mediaDir, filename);
          thumbUtil.generateImageThumbnail(filePath, thumbPath).then((tp) => {
            if (tp && repo.db) {
              try {
                repo.db.prepare('UPDATE media SET thumbnail_path = ? WHERE id = ?').run(tp, mediaRecord.id);
              } catch (e) {
                console.error('[IPC] 更新缩略图路径失败:', e);
              }
            }
          }).catch((e) => {
            console.error('[IPC] 生成缩略图失败:', e);
          });
        }

        if (mediaType === 'video') {
          extractThumbnail(filePath).then((tp) => {
            if (tp && repo.db) {
              try {
                repo.db.prepare('UPDATE media SET thumbnail_path = ? WHERE id = ?').run(tp, mediaRecord.id);
              } catch (e) {
                console.error('[IPC] 更新视频缩略图路径失败:', e);
              }
            }
          }).catch((e) => {
            console.error('[IPC] 生成视频缩略图失败:', e);
          });
        }

        return { success: true, data: repo.toCamelCase ? repo.toCamelCase(mediaRecord) : mediaRecord };
      }

      return { success: false, error: '不支持的数据格式' };
    } catch (e) {
      console.error('[IPC] 保存媒体失败:', e);
      return { success: false, error: e.message };
    }
  });

  ipcMain.handle('media:save-image', async (event, imageDataUrl, creativityId) => {
    if (!imageDataUrl.startsWith('data:image')) {
      return { success: false, error: '无效的图片数据' };
    }
    try {
      const matches = imageDataUrl.match(/^data:image\/(\w+);base64,(.+)$/);
      if (!matches) return { success: false, error: '无法解析图片格式' };
      const ext = matches[1];
      const base64Data = Buffer.from(matches[2], 'base64');
      const filename = `img_${Date.now()}.${ext}`;
      const filePath = path.join(repo.mediaDir, filename);

      fs.writeFileSync(filePath, base64Data);

      const mediaRecord = {
        id: repo.generateId(),
        creativityId: creativityId || null,
        type: 'image',
        filename,
        originalName: filename,
        filePath,
        mimeType: `image/${ext}`,
        fileSize: fs.statSync(filePath).size,
        sortOrder: 0,
        createdAt: new Date().toISOString(),
      };

      if (repo.db) {
        repo.db.prepare('INSERT INTO media (id, creativity_id, filename, filepath, mime_type, file_size, width, height, thumbnail_path, sort_order, created_at) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)')
          .run(mediaRecord.id, mediaRecord.creativityId, mediaRecord.filename, mediaRecord.filePath, mediaRecord.mimeType, mediaRecord.fileSize, null, null, null, mediaRecord.sortOrder, mediaRecord.createdAt);
      } else {
        repo.JsonStore.get('media').push(mediaRecord);
        repo.JsonStore.save();
      }

      const thumbPath = thumbUtil.getThumbnailPath(repo.mediaDir, filename);
      thumbUtil.generateImageThumbnail(filePath, thumbPath).then((tp) => {
        if (tp && repo.db) {
          try {
            repo.db.prepare('UPDATE media SET thumbnail_path = ? WHERE id = ?').run(tp, mediaRecord.id);
          } catch (e) {
            console.error('[IPC] 更新缩略图路径失败:', e);
          }
        }
      }).catch((e) => {
        console.error('[IPC] 生成缩略图失败:', e);
      });

      return { success: true, data: repo.toCamelCase ? repo.toCamelCase(mediaRecord) : mediaRecord };
    } catch (e) {
      console.error('[IPC] 保存图片失败:', e);
      return { success: false, error: e.message };
    }
  });

  ipcMain.handle('media:read', (event, idOrPath) => {
    try {
      let filePath = idOrPath;

      if (repo.db && idOrPath && !idOrPath.includes(path.sep) && !idOrPath.startsWith('data:') && !idOrPath.startsWith('http')) {
        const record = repo.db.prepare('SELECT * FROM media WHERE id = ?').get(idOrPath);
        if (record) {
          filePath = record.file_path || record.filePath;
        }
      }

      if (!filePath || filePath.startsWith('data:') || filePath.startsWith('http://') || filePath.startsWith('https://') || filePath.startsWith('file://')) {
        return filePath || null;
      }

      if (!fs.existsSync(filePath)) return null;

      return pathToFileUrl(filePath);
    } catch (e) {
      console.error('[IPC] 读取媒体失败:', e);
      return null;
    }
  });

  ipcMain.handle('media:read-file', (event, filePath) => {
    try {
      if (fs.existsSync(filePath)) {
        const ext = path.extname(filePath).toLowerCase();
        if (IMAGE_EXTS.includes(ext)) {
          const buffer = fs.readFileSync(filePath);
          return `data:image/${ext.replace('.', '')};base64,${buffer.toString('base64')}`;
        }
        return pathToFileUrl(filePath);
      }
      return null;
    } catch (e) {
      console.error('[IPC] 读取文件失败:', e);
      return null;
    }
  });

  ipcMain.handle('media:delete', (event, mediaId) => {
    if (repo.db) {
      try {
        const record = repo.db.prepare('SELECT * FROM media WHERE id = ?').get(mediaId);
        if (record && record.file_path && fs.existsSync(record.file_path)) {
          fs.unlinkSync(record.file_path);
        }
        if (record && record.thumbnail_path && fs.existsSync(record.thumbnail_path)) {
          fs.unlinkSync(record.thumbnail_path);
        }
        repo.db.prepare('DELETE FROM media WHERE id = ?').run(mediaId);
        return { success: true };
      } catch (e) {
        return { success: false, error: e.message };
      }
    } else {
      const mediaList = repo.JsonStore.get('media');
      const idx = mediaList.findIndex(m => m.id === mediaId);
      if (idx >= 0) {
        const record = mediaList[idx];
        if (record.filePath && fs.existsSync(record.filePath)) {
          fs.unlinkSync(record.filePath);
        }
        if (record.thumbnailPath && fs.existsSync(record.thumbnailPath)) {
          fs.unlinkSync(record.thumbnailPath);
        }
        mediaList.splice(idx, 1);
        repo.JsonStore.save();
        return { success: true };
      }
      return { success: false, error: '未找到媒体记录' };
    }
  });

  ipcMain.handle('media:select-file', async (event, options = {}) => {
    try {
      console.log('[IPC] media:select-file 被调用, options:', JSON.stringify(options));
      const result = await dialog.showOpenDialog(mainWindow, {
        properties: ['openFile', 'multiSelections'],
        filters: [
          { name: '所有文件', extensions: ['*'] },
          { name: '图片文件', extensions: ['jpg', 'jpeg', 'png', 'gif', 'webp', 'bmp', 'svg'] },
          { name: '视频文件', extensions: ['mp4', 'webm', 'avi', 'mov', 'mkv'] },
          { name: '音频文件', extensions: ['mp3', 'wav', 'ogg', 'flac', 'aac', 'm4a'] },
          { name: '文档文件', extensions: ['pdf'] },
        ],
      });
      if (result.canceled || result.filePaths.length === 0) {
        return { success: false, canceled: true };
      }

      const creativityId = options.creativityId || null;
      const savedFiles = [];

      for (let fi = 0; fi < result.filePaths.length; fi++) {
        const selectedPath = result.filePaths[fi];
        const ext = path.extname(selectedPath).toLowerCase();
        const mediaType = getMediaType(ext);
        if (!mediaType) continue;
        const mimeType = getMimeFromExt(ext);
        const prefix = mediaType === 'video' ? 'vid' : mediaType === 'audio' ? 'aud' : mediaType === 'document' ? 'doc' : 'img';
        const filename = `${prefix}_${Date.now()}_${fi}${ext}`;
        const destPath = path.join(repo.mediaDir, filename);
        fs.copyFileSync(selectedPath, destPath);

        const mediaRecord = {
          id: repo.generateId(),
          creativityId,
          type: mediaType,
          filename,
          originalName: path.basename(selectedPath),
          filePath: destPath,
          mimeType,
          fileSize: fs.statSync(destPath).size,
          sortOrder: fi,
          createdAt: new Date().toISOString(),
        };

        if (repo.db) {
          repo.db.prepare('INSERT INTO media (id, creativity_id, filename, filepath, mime_type, file_size, width, height, thumbnail_path, sort_order, created_at) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)')
            .run(mediaRecord.id, mediaRecord.creativityId, mediaRecord.filename, mediaRecord.filePath, mediaRecord.mimeType, mediaRecord.fileSize, null, null, null, mediaRecord.sortOrder, mediaRecord.createdAt);
        } else {
          repo.JsonStore.get('media').push(mediaRecord);
          repo.JsonStore.save();
        }

        if (mediaType === 'image') {
          const thumbPath = thumbUtil.getThumbnailPath(repo.mediaDir, filename);
          thumbUtil.generateImageThumbnail(destPath, thumbPath).then((tp) => {
            if (tp && repo.db) {
              try {
                repo.db.prepare('UPDATE media SET thumbnail_path = ? WHERE id = ?').run(tp, mediaRecord.id);
              } catch (e) {
                console.error('[IPC] 更新缩略图路径失败:', e);
              }
            }
          }).catch((e) => {
            console.error('[IPC] 生成缩略图失败:', e);
          });
        }

        if (mediaType === 'video') {
          extractThumbnail(destPath).then((tp) => {
            if (tp && repo.db) {
              try {
                repo.db.prepare('UPDATE media SET thumbnail_path = ? WHERE id = ?').run(tp, mediaRecord.id);
              } catch (e) {
                console.error('[IPC] 更新视频缩略图路径失败:', e);
              }
            }
          }).catch((e) => {
            console.error('[IPC] 生成视频缩略图失败:', e);
          });
        }

        savedFiles.push(repo.toCamelCase ? repo.toCamelCase(mediaRecord) : mediaRecord);
      }

      if (savedFiles.length === 0) {
        return { success: false, error: '不支持的文件类型' };
      }
      return { success: true, data: savedFiles };
    } catch (e) {
      console.error('[IPC] 选择文件失败:', e);
      return { success: false, error: e.message };
    }
  });

  ipcMain.handle('media:import-from-path', async (event, filePath, options = {}) => {
    try {
      if (!filePath || !fs.existsSync(filePath)) {
        return { success: false, error: '文件不存在: ' + filePath };
      }
      const ext = path.extname(filePath).toLowerCase();
      const mediaType = options.fileType || getMediaType(ext);
      if (!mediaType) {
        return { success: false, error: '不支持的文件类型: ' + ext };
      }
      const mimeType = getMimeFromExt(ext);
      const prefix = mediaType === 'video' ? 'vid' : mediaType === 'audio' ? 'aud' : mediaType === 'document' ? 'doc' : 'img';
      const filename = `${prefix}_${Date.now()}${ext}`;
      const destPath = path.join(repo.mediaDir, filename);
      fs.copyFileSync(filePath, destPath);

      const creativityId = options.creativityId || null;
      const mediaRecord = {
        id: repo.generateId(),
        creativityId,
        type: mediaType,
        filename,
        originalName: options.fileName || path.basename(filePath),
        filePath: destPath,
        mimeType,
        fileSize: fs.statSync(destPath).size,
        sortOrder: options.sortOrder || 0,
        createdAt: new Date().toISOString(),
      };

      if (repo.db) {
        repo.db.prepare('INSERT INTO media (id, creativity_id, filename, filepath, mime_type, file_size, width, height, thumbnail_path, sort_order, created_at) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)')
          .run(mediaRecord.id, mediaRecord.creativityId, mediaRecord.filename, mediaRecord.filePath, mediaRecord.mimeType, mediaRecord.fileSize, null, null, null, mediaRecord.sortOrder, mediaRecord.createdAt);
      } else {
        repo.JsonStore.get('media').push(mediaRecord);
        repo.JsonStore.save();
      }

      if (mediaType === 'image') {
        const thumbPath = thumbUtil.getThumbnailPath(repo.mediaDir, filename);
        thumbUtil.generateImageThumbnail(destPath, thumbPath).then((tp) => {
          if (tp && repo.db) {
            try {
              repo.db.prepare('UPDATE media SET thumbnail_path = ? WHERE id = ?').run(tp, mediaRecord.id);
            } catch (e) {
              console.error('[IPC] 更新缩略图路径失败:', e);
            }
          }
        }).catch((e) => {
          console.error('[IPC] 生成缩略图失败:', e);
        });
      }

      if (mediaType === 'video') {
        extractThumbnail(destPath).then((tp) => {
          if (tp && repo.db) {
            try {
              repo.db.prepare('UPDATE media SET thumbnail_path = ? WHERE id = ?').run(tp, mediaRecord.id);
            } catch (e) {
              console.error('[IPC] 更新视频缩略图路径失败:', e);
            }
          }
        }).catch((e) => {
          console.error('[IPC] 生成视频缩略图失败:', e);
        });
      }

      return { success: true, data: repo.toCamelCase ? repo.toCamelCase(mediaRecord) : mediaRecord };
    } catch (e) {
      console.error('[IPC] 从路径导入文件失败:', e);
      return { success: false, error: e.message };
    }
  });

  ipcMain.handle('media:thumbnail', (event, idOrPath, width, height) => {
    try {
      let filePath = idOrPath;

      if (repo.db && idOrPath && !idOrPath.includes(path.sep) && !idOrPath.startsWith('data:') && !idOrPath.startsWith('http') && !idOrPath.startsWith('file://')) {
        const record = repo.db.prepare('SELECT * FROM media WHERE id = ?').get(idOrPath);
        if (record) {
          filePath = record.file_path || record.filePath;
        }
      }

      if (!filePath || !fs.existsSync(filePath)) return null;

      const ext = path.extname(filePath).toLowerCase();
      if (IMAGE_EXTS.includes(ext)) {
        const buffer = fs.readFileSync(filePath);
        return `data:image/${ext.replace('.', '')};base64,${buffer.toString('base64')}`;
      }

      return pathToFileUrl(filePath);
    } catch (e) {
      console.error('[IPC] 获取缩略图失败:', e);
      return null;
    }
  });

  ipcMain.handle('media:get-thumbnail', (event, filePath, width, height) => {
    try {
      if (!fs.existsSync(filePath)) return null;
      const ext = path.extname(filePath).toLowerCase();
      if (IMAGE_EXTS.includes(ext)) {
        const buffer = fs.readFileSync(filePath);
        return `data:image/${ext.replace('.', '')};base64,${buffer.toString('base64')}`;
      }
      return pathToFileUrl(filePath);
    } catch (e) {
      console.error('[IPC] 获取缩略图失败:', e);
      return null;
    }
  });

  ipcMain.handle('media:get-url', (event, filePath) => {
    if (!filePath) return null;
    if (filePath.startsWith('data:') || filePath.startsWith('http://') || filePath.startsWith('https://') || filePath.startsWith('file://')) {
      return filePath;
    }
    try {
      if (fs.existsSync(filePath)) {
        return pathToFileUrl(filePath);
      }
    } catch (e) {}
    return pathToFileUrl(filePath);
  });

  ipcMain.handle('file:select', async (event, filters) => {
    try {
      const dialogFilters = filters || [
        { name: '图片文件', extensions: ['jpg', 'jpeg', 'png', 'gif', 'webp', 'bmp', 'svg'] },
        { name: '视频文件', extensions: ['mp4', 'webm', 'avi', 'mov', 'mkv'] },
        { name: '音频文件', extensions: ['mp3', 'wav', 'ogg', 'flac', 'aac', 'm4a'] },
        { name: '文档文件', extensions: ['pdf'] },
        { name: '所有文件', extensions: ['*'] },
      ];
      const result = await dialog.showOpenDialog(mainWindow, {
        properties: ['openFile'],
        filters: dialogFilters,
      });
      if (result.canceled || result.filePaths.length === 0) {
        return null;
      }
      return result.filePaths[0];
    } catch (e) {
      console.error('[IPC] 文件选择失败:', e);
      return null;
    }
  });

  ipcMain.handle('file:save', async (event, defaultPath, filters) => {
    try {
      const result = await dialog.showSaveDialog(mainWindow, {
        defaultPath,
        filters: filters || [{ name: '所有文件', extensions: ['*'] }],
      });
      if (result.canceled) return null;
      return result.filePath;
    } catch (e) {
      console.error('[IPC] 文件保存失败:', e);
      return null;
    }
  });

  ipcMain.handle('file:select-multiple', async (event, filters) => {
    try {
      const dialogFilters = filters || [
        { name: '字体文件', extensions: ['ttf', 'otf', 'woff', 'woff2', 'ttc'] },
        { name: '所有文件', extensions: ['*'] },
      ];
      const result = await dialog.showOpenDialog(mainWindow, {
        properties: ['openFile', 'multiSelections'],
        filters: dialogFilters,
      });
      if (result.canceled || result.filePaths.length === 0) {
        return [];
      }
      return result.filePaths;
    } catch (e) {
      console.error('[IPC] 多文件选择失败:', e);
      return [];
    }
  });

  ipcMain.handle('file:read-text', async (event, filePath: string) => {
    try {
      if (!filePath || !fs.existsSync(filePath)) return null;
      const resolvedPath = path.resolve(filePath);
      const allowedDirs = [app.getPath('userData'), app.getPath('documents'), app.getPath('home')];
      const isAllowed = allowedDirs.some(dir => resolvedPath.startsWith(dir));
      if (!isAllowed) return null;
      const content = fs.readFileSync(filePath, 'utf-8');
      return content.substring(0, 5000);
    } catch (e) {
      console.error('[IPC] 读取文本文件失败:', e);
      return null;
    }
  });

  ipcMain.handle('media:link-to-creativity', (event, mediaIds, creativityId) => {
    try {
      if (!Array.isArray(mediaIds) || !creativityId) return { success: false, error: '参数无效' };
      if (repo.db) {
        const stmt = repo.db.prepare('UPDATE media SET creativity_id = ? WHERE id = ?');
        for (const mediaId of mediaIds) {
          stmt.run(creativityId, mediaId);
        }
      } else {
        const mediaList = repo.JsonStore.get('media');
        for (const mediaId of mediaIds) {
          const item = mediaList.find((m: any) => m.id === mediaId);
          if (item) item.creativityId = creativityId;
        }
        repo.JsonStore.save();
      }
      return { success: true, updatedCount: mediaIds.length };
    } catch (e) {
      console.error('[IPC] 关联媒体失败:', e);
      return { success: false, error: e.message };
    }
  });

  ipcMain.handle('media:get-file-size', (event, filePath) => {
    try {
      if (!filePath || !fs.existsSync(filePath)) return 0;
      const stat = fs.statSync(filePath);
      return stat.size;
    } catch (e) {
      return 0;
    }
  });

  ipcMain.handle('media:get-thumbnail-url', async (event, idOrPath) => {
    try {
      if (!idOrPath) return null;

      let lookupValue = idOrPath;
      if (idOrPath.startsWith('media://')) {
        lookupValue = idOrPath.slice(8);
      }

      if (repo.db) {
        let record = null;
        if (!lookupValue.includes(path.sep) && !lookupValue.startsWith('data:') && !lookupValue.startsWith('http') && !lookupValue.startsWith('file://')) {
          record = repo.db.prepare('SELECT id, thumbnail_path, filepath FROM media WHERE id = ?').get(lookupValue);
        } else {
          record = repo.db.prepare('SELECT id, thumbnail_path, filepath FROM media WHERE filepath = ?').get(lookupValue);
        }
        if (record && record.thumbnail_path && fs.existsSync(record.thumbnail_path)) {
          return pathToFileUrl(record.thumbnail_path);
        }

        const videoPath = record ? record.filepath : (lookupValue.includes(path.sep) ? lookupValue : null);
        if (videoPath && fs.existsSync(videoPath) && isVideoFile(videoPath)) {
          const thumbPath = await extractThumbnail(videoPath);
          if (thumbPath) {
            if (record) {
              try {
                repo.db.prepare('UPDATE media SET thumbnail_path = ? WHERE id = ?').run(thumbPath, record.id);
              } catch (e) {
                console.error('[IPC] 更新视频缩略图路径失败:', e);
              }
            }
            return pathToFileUrl(thumbPath);
          }
        }
      }

      return null;
    } catch (e) {
      console.error('[IPC] 获取缩略图URL失败:', e);
      return null;
    }
  });

  ipcMain.handle('media:migrate-content-references', () => {
    if (!repo.db) return { migrated: 0, skipped: 0 };
    try {
      const mediaRows = repo.mapRows(repo.db.prepare('SELECT id, filepath FROM media').all());
      const pathToId = new Map();
      for (const row of mediaRows) {
        if (row.filepath) {
          pathToId.set(row.filepath, row.id);
        }
      }

      const creativities = repo.mapRows(
        repo.db.prepare("SELECT id, content, type FROM creativities WHERE type IN ('image', 'audio', 'video') AND status = 'active'").all()
      );

      let migrated = 0;
      let skipped = 0;
      const updateStmt = repo.db.prepare('UPDATE creativities SET content = ? WHERE id = ?');

      for (const c of creativities) {
        if (!c.content) { skipped++; continue; }
        if (c.content.startsWith('media://')) { skipped++; continue; }
        if (c.content.startsWith('data:') || c.content.startsWith('http://') || c.content.startsWith('https://')) { skipped++; continue; }

        const isFilePath = /^[A-Za-z]:\\/.test(c.content) || c.content.startsWith('/') || c.content.startsWith('.\\') || c.content.startsWith('./');
        if (!isFilePath) { skipped++; continue; }

        const mediaId = pathToId.get(c.content);
        if (mediaId) {
          updateStmt.run('media://' + mediaId, c.id);
          migrated++;
        } else {
          const likeRecords = repo.mapRows(
            repo.db.prepare('SELECT id FROM media WHERE creativity_id = ? LIMIT 1').all(c.id)
          );
          if (likeRecords.length > 0) {
            updateStmt.run('media://' + likeRecords[0].id, c.id);
            migrated++;
          } else {
            skipped++;
          }
        }
      }

      console.log('[IPC] content引用迁移完成: migrated=' + migrated + ', skipped=' + skipped);
      return { migrated, skipped };
    } catch (e) {
      console.error('[IPC] content引用迁移失败:', e);
      return { migrated: 0, skipped: 0, error: e.message };
    }
  });

  ipcMain.handle('media:load-all-paths', () => {
    if (!repo.db) return [];
    try {
      return repo.mapRows(repo.db.prepare('SELECT id, filepath FROM media').all());
    } catch (e) {
      console.error('[IPC] 加载媒体路径失败:', e);
      return [];
    }
  });

  // 获取文件信息（用于批量导入时获取文件大小和缩略图）
  ipcMain.handle('media:get-file-info', async (event, filePath: string) => {
    try {
      if (!filePath || !fs.existsSync(filePath)) {
        return null;
      }

      const stat = fs.statSync(filePath);
      const ext = path.extname(filePath).toLowerCase();
      const fileName = path.basename(filePath);

      // 判断文件类型
      let fileType = 'application/octet-stream';
      if (IMAGE_EXTS.includes(ext)) fileType = `image/${ext.replace('.', '')}`;
      else if (VIDEO_EXTS.includes(ext)) fileType = `video/${ext.replace('.', '')}`;
      else if (AUDIO_EXTS.includes(ext)) fileType = `audio/${ext.replace('.', '')}`;
      else if (ext === '.pdf') fileType = 'application/pdf';
      else if (ext === '.txt' || ext === '.md') fileType = 'text/plain';

      // 生成缩略图（图片直接返回 base64，视频截取第一帧）
      let thumbnailUrl: string | null = null;
      if (IMAGE_EXTS.includes(ext)) {
        try {
          const buffer = fs.readFileSync(filePath);
          thumbnailUrl = `data:image/${ext.replace('.', '')};base64,${buffer.toString('base64')}`;
        } catch (e) {
          console.error('[IPC] 生成图片缩略图失败:', e);
        }
      } else if (VIDEO_EXTS.includes(ext)) {
        // 视频截取第一帧作为缩略图，分辨率上限 2K (2048px)
        console.log('[IPC] 开始生成视频缩略图:', filePath);
        try {
          const ffmpeg = await checkFfmpeg();
          console.log('[IPC] ffmpeg 路径:', ffmpeg);
          if (ffmpeg) {
            const thumbDir = getThumbnailsDir();
            const videoBasename = path.basename(filePath, path.extname(filePath));
            const thumbFilename = `thumb_${videoBasename}_${Date.now()}.jpg`;
            const thumbPath = path.join(thumbDir, thumbFilename);
            console.log('[IPC] 缩略图路径:', thumbPath);

            const args = [
              '-i', filePath,
              '-ss', '00:00:00',  // 第一帧
              '-frames:v', '1',
              '-q:v', '2',
              '-vf', 'scale=min(2048,iw):-1',  // 宽度最大 2048px，保持比例
              '-y',
              thumbPath,
            ];
            console.log('[IPC] ffmpeg 参数:', args);

            await new Promise<void>((resolve, reject) => {
              execFile(ffmpeg, args, { timeout: 30000 }, (err, stdout, stderr) => {
                if (err) {
                  console.error('[IPC] ffmpeg 错误:', err.message);
                  console.error('[IPC] ffmpeg stderr:', stderr);
                  reject(err);
                } else {
                  console.log('[IPC] ffmpeg 成功');
                  resolve();
                }
              });
            });

            if (fs.existsSync(thumbPath) && fs.statSync(thumbPath).size > 0) {
              console.log('[IPC] 缩略图文件已生成:', thumbPath);
              const thumbBuffer = fs.readFileSync(thumbPath);
              thumbnailUrl = `data:image/jpeg;base64,${thumbBuffer.toString('base64')}`;
              console.log('[IPC] 缩略图 base64 长度:', thumbnailUrl.length);
              // 删除临时缩略图文件
              try { fs.unlinkSync(thumbPath); } catch (e) { /* ignore */ }
            } else {
              console.error('[IPC] 缩略图文件未生成或为空');
            }
          } else {
            console.error('[IPC] ffmpeg 不可用');
          }
        } catch (e) {
          console.error('[IPC] 生成视频缩略图失败:', e);
          thumbnailUrl = null;
        }
      }

      return {
        filePath,
        fileName,
        fileSize: stat.size,
        fileType,
        thumbnailUrl,
      };
    } catch (e) {
      console.error('[IPC] 获取文件信息失败:', e);
      return null;
    }
  });

  // 读取文件前 N 字节为 base64（用于视频缩略图等场景，避免加载整个大文件）
  ipcMain.handle('media:read-file-head', async (event, filePath: string, maxBytes: number = 5 * 1024 * 1024) => {
    try {
      if (!filePath || !fs.existsSync(filePath)) return null;
      const stat = fs.statSync(filePath);
      const bytesToRead = Math.min(stat.size, maxBytes);
      const buffer = fs.readFileSync(filePath, { length: bytesToRead });
      const ext = path.extname(filePath).toLowerCase();
      const mimeMap: Record<string, string> = {
        '.mp4': 'video/mp4', '.webm': 'video/webm', '.avi': 'video/x-msvideo',
        '.mov': 'video/quicktime', '.mkv': 'video/x-matroska', '.wmv': 'video/x-ms-wmv',
        '.flv': 'video/x-flv',
        '.png': 'image/png', '.jpg': 'image/jpeg', '.jpeg': 'image/jpeg',
        '.gif': 'image/gif', '.bmp': 'image/bmp', '.webp': 'image/webp',
      };
      const mimeType = mimeMap[ext] || 'application/octet-stream';
      return `data:${mimeType};base64,${buffer.toString('base64')}`;
    } catch (e) {
      console.error('[IPC] read-file-head error:', e);
      return null;
    }
  });

  // 读取整个文件为 base64（用于批量导入缩略图生成）
  ipcMain.handle('media:read-file-as-base64', async (event, filePath: string) => {
    try {
      if (!filePath || !fs.existsSync(filePath)) return null;
      const buffer = fs.readFileSync(filePath);
      const ext = path.extname(filePath).toLowerCase();
      const mimeMap: Record<string, string> = {
        '.mp4': 'video/mp4', '.webm': 'video/webm', '.avi': 'video/x-msvideo',
        '.mov': 'video/quicktime', '.mkv': 'video/x-matroska', '.wmv': 'video/x-ms-wmv',
        '.flv': 'video/x-flv',
        '.png': 'image/png', '.jpg': 'image/jpeg', '.jpeg': 'image/jpeg',
        '.gif': 'image/gif', '.bmp': 'image/bmp', '.webp': 'image/webp',
      };
      const mimeType = mimeMap[ext] || 'application/octet-stream';
      return { data: `data:${mimeType};base64,${buffer.toString('base64')}`, mimeType };
    } catch (e) {
      console.error('[IPC] read-file-as-base64 error:', e);
      return null;
    }
  });

  console.log('[IPC] 媒体处理器已注册');
}

module.exports = { registerMediaHandlers };
