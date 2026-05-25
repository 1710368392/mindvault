/**
 * 工具函数模块
 * 提供UUID生成、时间格式化、文件路径处理等通用工具
 */

import { randomUUID } from 'crypto';
import path from 'path';
import fs from 'fs';

/**
 * 生成UUID
 * 使用crypto模块生成标准的UUID v4
 */
export function generateUUID(): string {
  return randomUUID();
}

/**
 * 生成短ID（用于显示）
 * 取UUID前8位作为短标识
 */
export function generateShortId(): string {
  return generateUUID().replace(/-/g, '').substring(0, 8);
}

/**
 * 格式化时间为ISO字符串
 * @param date - 日期对象，默认为当前时间
 */
export function formatTime(date: Date = new Date()): string {
  return date.toISOString();
}

/**
 * 格式化时间为本地可读字符串
 * @param date - 日期对象，默认为当前时间
 */
export function formatTimeLocal(date: Date = new Date()): string {
  return date.toLocaleString('zh-CN', {
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
    second: '2-digit',
  });
}

/**
 * 将ISO时间字符串转换为本地时间字符串
 */
export function isoToLocal(isoString: string): string {
  return new Date(isoString).toLocaleString('zh-CN');
}

/**
 * 确保目录存在，不存在则创建
 * @param dirPath - 目录路径
 */
export function ensureDir(dirPath: string): void {
  if (!fs.existsSync(dirPath)) {
    fs.mkdirSync(dirPath, { recursive: true });
  }
}

/**
 * 获取文件扩展名
 * @param filename - 文件名
 */
export function getFileExtension(filename: string): string {
  return path.extname(filename).toLowerCase();
}

/**
 * 根据MIME类型获取文件扩展名
 * @param mimeType - MIME类型字符串
 */
export function getExtensionFromMime(mimeType: string): string {
  const mimeMap: Record<string, string> = {
    'image/jpeg': '.jpg',
    'image/png': '.png',
    'image/gif': '.gif',
    'image/webp': '.webp',
    'image/svg+xml': '.svg',
    'image/bmp': '.bmp',
    'image/avif': '.avif',
    'video/mp4': '.mp4',
    'video/webm': '.webm',
    'audio/mpeg': '.mp3',
    'audio/wav': '.wav',
    'audio/ogg': '.ogg',
    'application/pdf': '.pdf',
    'application/json': '.json',
    'text/plain': '.txt',
    'text/markdown': '.md',
  };
  return mimeMap[mimeType] || '';
}

/**
 * 判断是否为图片类型
 * @param mimeType - MIME类型字符串
 */
export function isImageType(mimeType: string): boolean {
  return mimeType.startsWith('image/');
}

/**
 * 判断是否为视频类型
 * @param mimeType - MIME类型字符串
 */
export function isVideoType(mimeType: string): boolean {
  return mimeType.startsWith('video/');
}

/**
 * 判断是否为音频类型
 * @param mimeType - MIME类型字符串
 */
export function isAudioType(mimeType: string): boolean {
  return mimeType.startsWith('audio/');
}

/**
 * 安全地解析JSON字符串
 * @param str - JSON字符串
 * @param defaultValue - 解析失败时的默认值
 */
export function safeJsonParse<T>(str: string, defaultValue: T): T {
  try {
    return JSON.parse(str) as T;
  } catch {
    return defaultValue;
  }
}

/**
 * 截断文本到指定长度
 * @param text - 原始文本
 * @param maxLength - 最大长度
 */
export function truncateText(text: string, maxLength: number): string {
  if (text.length <= maxLength) return text;
  return text.substring(0, maxLength) + '...';
}

/**
 * 计算两个字符串的相似度（基于Jaccard相似度）
 * 用于创意关联推荐
 * @param a - 字符串A
 * @param b - 字符串B
 */
export function similarity(a: string, b: string): number {
  const setA = new Set(a.toLowerCase().split(''));
  const setB = new Set(b.toLowerCase().split(''));
  const intersection = new Set([...setA].filter((x) => setB.has(x)));
  const union = new Set([...setA, ...setB]);
  return union.size === 0 ? 0 : intersection.size / union.size;
}

/**
 * 分词（简易中文+英文分词）
 * 将文本拆分为关键词集合
 * @param text - 输入文本
 */
export function tokenize(text: string): Set<string> {
  // 英文按空格分词，中文按单字分词
  const tokens = new Set<string>();
  // 提取英文单词（2个字符以上）
  const englishWords = text.match(/[a-zA-Z]{2,}/g);
  if (englishWords) {
    englishWords.forEach((w) => tokens.add(w.toLowerCase()));
  }
  // 提取中文单字和连续中文词组
  const chineseChars = text.match(/[\u4e00-\u9fa5]+/g);
  if (chineseChars) {
    chineseChars.forEach((segment) => {
      // 添加连续中文片段
      if (segment.length <= 4) {
        tokens.add(segment);
      }
      // 添加单字
      for (const char of segment) {
        tokens.add(char);
      }
      // 添加双字组合
      for (let i = 0; i < segment.length - 1; i++) {
        tokens.add(segment.substring(i, i + 2));
      }
    });
  }
  return tokens;
}

/**
 * 延迟指定毫秒数
 * @param ms - 毫秒数
 */
export function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

/**
 * 格式化文件大小
 * @param bytes - 字节数
 */
export function formatFileSize(bytes: number): string {
  if (bytes === 0) return '0 B';
  const units = ['B', 'KB', 'MB', 'GB'];
  const k = 1024;
  const i = Math.floor(Math.log(bytes) / Math.log(k));
  return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + ' ' + units[i];
}
