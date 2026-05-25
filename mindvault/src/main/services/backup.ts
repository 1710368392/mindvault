/**
 * 备份服务
 * 负责数据库备份的创建、恢复和自动备份管理
 */

import path from 'path';
import fs from 'fs';
import archiver from 'archiver';
import { getBackupDir, getDatabasePath, getMediaDir } from '../db/migration';
import { formatTime, ensureDir } from '../utils';

/** 自动备份配置 */
export interface AutoBackupConfig {
  enabled: boolean;
  interval_minutes: number;
  max_count: number;
}

/** 备份元数据 */
interface BackupMetadata {
  version: string;
  created_at: string;
  db_size: number;
  media_count: number;
  media_total_size: number;
}

export class BackupService {
  private backupDir: string;
  private autoBackupTimer: ReturnType<typeof setInterval> | null = null;

  constructor(private userDataPath: string) {
    this.backupDir = getBackupDir(userDataPath);
  }

  /**
   * 创建数据库备份
   * 将数据库文件和媒体目录打包为zip备份
   * @returns 备份文件路径
   */
  async createBackup(): Promise<string> {
    ensureDir(this.backupDir);

    const timestamp = formatTime()
      .replace(/[:.]/g, '-')
      .replace('T', '_')
      .substring(0, 19);
    const backupFileName = `mindvault_backup_${timestamp}.zip`;
    const backupPath = path.join(this.backupDir, backupFileName);

    // 获取数据库文件路径
    const dbPath = getDatabasePath(this.userDataPath);
    const mediaDir = getMediaDir(this.userDataPath);

    // 统计媒体文件信息
    const mediaCount = this.countMediaFiles(mediaDir);
    const mediaTotalSize = this.getMediaTotalSize(mediaDir);

    // 创建备份元数据
    const metadata: BackupMetadata = {
      version: '1.0.0',
      created_at: formatTime(),
      db_size: fs.existsSync(dbPath) ? fs.statSync(dbPath).size : 0,
      media_count: mediaCount,
      media_total_size: mediaTotalSize,
    };

    // 使用archiver创建zip备份
    await new Promise<void>((resolve, reject) => {
      const output = fs.createWriteStream(backupPath);
      const archive = archiver('zip', { zlib: { level: 9 } });

      output.on('close', () => {
        console.log(`[备份] ZIP备份已创建: ${backupPath} (${archive.pointer()} 字节)`);
        resolve();
      });

      archive.on('error', (err: Error) => {
        reject(err);
      });

      archive.pipe(output);

      // 添加数据库文件到zip
      if (fs.existsSync(dbPath)) {
        archive.file(dbPath, { name: 'mindvault.db' });
      }

      // 添加媒体目录到zip（递归）
      if (fs.existsSync(mediaDir)) {
        archive.directory(mediaDir, 'media');
      }

      // 添加元数据JSON到zip
      archive.append(JSON.stringify(metadata, null, 2), { name: 'metadata.json' });

      archive.finalize();
    });

    // 清理过期备份
    this.cleanOldBackups();

    return backupPath;
  }

  /**
   * 从备份恢复数据库
   * @param backupPath - 备份zip文件路径
   */
  async restoreBackup(backupPath: string): Promise<void> {
    if (!fs.existsSync(backupPath)) {
      throw new Error('备份文件不存在');
    }

    const dbPath = getDatabasePath(this.userDataPath);
    const mediaDir = getMediaDir(this.userDataPath);

    // 如果当前数据库存在，先创建一个恢复前的备份
    if (fs.existsSync(dbPath)) {
      const preRestoreTimestamp = formatTime().replace(/[:.]/g, '-').substring(0, 19);
      const preRestoreBackup = path.join(
        this.backupDir,
        `pre_restore_${preRestoreTimestamp}.zip`
      );
      await this.createQuickBackup(preRestoreBackup, dbPath, mediaDir);
      console.log(`[备份] 恢复前备份已创建: ${preRestoreBackup}`);
    }

    // 从zip包中解压恢复
    await new Promise<void>((resolve, reject) => {
      const extract = require('extract-zip');
      const tmpExtractDir = path.join(this.backupDir, `restore_tmp_${Date.now()}`);

      extract(backupPath, { dir: tmpExtractDir })
        .then(() => {
          try {
            // 恢复数据库文件
            const extractedDbPath = path.join(tmpExtractDir, 'mindvault.db');
            if (fs.existsSync(extractedDbPath)) {
              ensureDir(path.dirname(dbPath));
              fs.copyFileSync(extractedDbPath, dbPath);
              console.log(`[备份] 数据库已从备份恢复`);
            }

            // 恢复媒体目录
            const extractedMediaDir = path.join(tmpExtractDir, 'media');
            if (fs.existsSync(extractedMediaDir)) {
              ensureDir(path.dirname(mediaDir));
              if (fs.existsSync(mediaDir)) {
                fs.rmSync(mediaDir, { recursive: true, force: true });
              }
              fs.cpSync(extractedMediaDir, mediaDir, { recursive: true });
              console.log(`[备份] 媒体文件已从备份恢复`);
            }

            // 清理临时目录
            fs.rmSync(tmpExtractDir, { recursive: true, force: true });

            console.log(`[备份] 备份已恢复: ${backupPath}`);
            resolve();
          } catch (err) {
            // 清理临时目录
            fs.rmSync(tmpExtractDir, { recursive: true, force: true });
            reject(err);
          }
        })
        .catch(reject);
    });
  }

  /**
   * 创建快速备份（用于恢复前的安全备份）
   */
  private async createQuickBackup(backupPath: string, dbPath: string, mediaDir: string): Promise<void> {
    await new Promise<void>((resolve, reject) => {
      const output = fs.createWriteStream(backupPath);
      const archive = archiver('zip', { zlib: { level: 9 } });

      output.on('close', resolve);
      archive.on('error', reject);
      archive.pipe(output);

      if (fs.existsSync(dbPath)) {
        archive.file(dbPath, { name: 'mindvault.db' });
      }
      if (fs.existsSync(mediaDir)) {
        archive.directory(mediaDir, 'media');
      }

      archive.finalize();
    });
  }

  /**
   * 设置自动备份
   * @param config - 自动备份配置
   */
  setAutoBackup(config: AutoBackupConfig): void {
    // 清除现有的定时器
    if (this.autoBackupTimer) {
      clearInterval(this.autoBackupTimer);
      this.autoBackupTimer = null;
    }

    // 保存配置
    const configPath = path.join(this.backupDir, 'auto_backup_config.json');
    fs.writeFileSync(configPath, JSON.stringify(config, null, 2), 'utf-8');

    // 如果启用自动备份，设置定时器
    if (config.enabled) {
      const intervalMs = config.interval_minutes * 60 * 1000;
      this.autoBackupTimer = setInterval(async () => {
        try {
          await this.createBackup();
        } catch (error) {
          console.error('[备份] 自动备份失败:', error);
        }
      }, intervalMs);

      console.log(`[备份] 自动备份已启用，间隔: ${config.interval_minutes}分钟`);
    }
  }

  /**
   * 获取当前自动备份配置
   */
  getAutoBackupConfig(): AutoBackupConfig {
    const configPath = path.join(this.backupDir, 'auto_backup_config.json');
    if (fs.existsSync(configPath)) {
      const content = fs.readFileSync(configPath, 'utf-8');
      return JSON.parse(content) as AutoBackupConfig;
    }
    // 返回默认配置
    return {
      enabled: false,
      interval_minutes: 30,
      max_count: 10,
    };
  }

  /**
   * 获取备份列表
   */
  listBackups(): Array<{ path: string; size: number; created_at: string }> {
    if (!fs.existsSync(this.backupDir)) return [];

    return fs.readdirSync(this.backupDir)
      .filter((file) => file.startsWith('mindvault_backup_') && file.endsWith('.zip'))
      .map((file) => {
        const filePath = path.join(this.backupDir, file);
        const stats = fs.statSync(filePath);
        return {
          path: filePath,
          size: stats.size,
          created_at: stats.birthtime.toISOString(),
        };
      })
      .sort((a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime());
  }

  /**
   * 清理过期备份，保留最新的N个
   */
  private cleanOldBackups(): void {
    const config = this.getAutoBackupConfig();
    const backups = this.listBackups();

    if (backups.length > config.max_count) {
      const toDelete = backups.slice(config.max_count);
      for (const backup of toDelete) {
        try {
          fs.unlinkSync(backup.path);
          console.log(`[备份] 已清理过期备份: ${backup.path}`);
        } catch (error) {
          console.error(`[备份] 清理备份失败: ${backup.path}`, error);
        }
      }
    }
  }

  /**
   * 统计媒体文件数量
   */
  private countMediaFiles(mediaDir: string): number {
    if (!fs.existsSync(mediaDir)) return 0;
    return fs.readdirSync(mediaDir).length;
  }

  /**
   * 计算媒体文件总大小
   */
  private getMediaTotalSize(mediaDir: string): number {
    if (!fs.existsSync(mediaDir)) return 0;
    let totalSize = 0;
    const entries = fs.readdirSync(mediaDir, { withFileTypes: true });
    for (const entry of entries) {
      const fullPath = path.join(mediaDir, entry.name);
      if (entry.isFile()) {
        totalSize += fs.statSync(fullPath).size;
      } else if (entry.isDirectory()) {
        totalSize += this.getMediaTotalSize(fullPath);
      }
    }
    return totalSize;
  }

  /**
   * 停止自动备份
   */
  stopAutoBackup(): void {
    if (this.autoBackupTimer) {
      clearInterval(this.autoBackupTimer);
      this.autoBackupTimer = null;
      console.log('[备份] 自动备份已停止');
    }
  }
}
