/**
 * 批量导入确认弹窗工具函数
 */

import type { BatchImportItem, ImportStatistics, FindReplaceOptions, Operation } from './types';

/**
 * 生成唯一ID
 */
export function generateId(): string {
  return `${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;
}

/**
 * 格式化文件大小
 */
export function formatFileSize(bytes: number): string {
  if (bytes === 0) return '0 B';
  const k = 1024;
  const sizes = ['B', 'KB', 'MB', 'GB', 'TB'];
  const i = Math.floor(Math.log(bytes) / Math.log(k));
  return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + ' ' + sizes[i];
}

/**
 * 格式化预计时间
 */
export function formatEstimatedTime(seconds: number): string {
  if (seconds < 60) return `${Math.ceil(seconds)}秒`;
  if (seconds < 3600) return `${Math.ceil(seconds / 60)}分钟`;
  return `${Math.ceil(seconds / 3600)}小时`;
}

/**
 * 获取文件类型
 */
export function getFileType(fileName: string): string {
  const ext = fileName.split('.').pop()?.toLowerCase() || '';
  
  const typeMap: Record<string, string> = {
    // 图片
    jpg: 'image', jpeg: 'image', png: 'image', gif: 'image', 
    webp: 'image', bmp: 'image', svg: 'image', ico: 'image',
    // 视频
    mp4: 'video', webm: 'video', mov: 'video', avi: 'video', 
    mkv: 'video', flv: 'video', m4v: 'video',
    // 音频
    mp3: 'audio', wav: 'audio', ogg: 'audio', flac: 'audio', 
    aac: 'audio', m4a: 'audio', wma: 'audio',
    // 文档
    pdf: 'document', doc: 'document', docx: 'document', 
    xls: 'document', xlsx: 'document', ppt: 'document', pptx: 'document',
    // 文本
    txt: 'text', md: 'text', markdown: 'text', json: 'text', 
    csv: 'text', xml: 'text', html: 'text', htm: 'text', log: 'text',
    // 代码
    js: 'code', ts: 'code', jsx: 'code', tsx: 'code', 
    py: 'code', java: 'code', cpp: 'code', c: 'code', go: 'code', rs: 'code',
    // 压缩包
    zip: 'archive', rar: 'archive', '7z': 'archive', tar: 'archive', gz: 'archive',
  };
  
  return typeMap[ext] || 'other';
}

/**
 * 获取文件类型图标
 */
export function getFileTypeIcon(fileType: string): string {
  const iconMap: Record<string, string> = {
    image: '🖼️',
    video: '🎬',
    audio: '🎵',
    document: '📄',
    text: '📝',
    code: '💻',
    archive: '📦',
    other: '📎',
  };
  return iconMap[fileType] || '📎';
}

/**
 * 获取文件类型中文标签
 */
export function getFileTypeLabel(fileType: string): string {
  const labelMap: Record<string, string> = {
    image: '图片',
    video: '视频',
    audio: '音频',
    document: '文档',
    text: '文本',
    code: '代码',
    archive: '压缩包',
    other: '其他',
  };
  return labelMap[fileType] || '其他';
}

/**
 * 获取文件类型对应的Tag颜色
 */
export function getFileTypeColor(fileType: string): string {
  const colorMap: Record<string, string> = {
    image: 'blue',
    video: 'purple',
    audio: 'cyan',
    document: 'orange',
    text: 'green',
    code: 'geekblue',
    archive: 'gold',
    other: 'default',
  };
  return colorMap[fileType] || 'default';
}

/**
 * 计算统计信息
 */
export function calculateStatistics(items: BatchImportItem[]): ImportStatistics {
  const completed = items.filter(i => i.status === 'completed').length;
  const failed = items.filter(i => i.status === 'failed').length;
  const totalSize = items.reduce((sum, i) => sum + i.fileSize, 0);
  
  const byType: Record<string, number> = {};
  items.forEach(item => {
    const type = getFileType(item.fileName);
    byType[type] = (byType[type] || 0) + 1;
  });
  
  // 估算处理时间：每个文件约2秒 + 基础10秒
  const estimatedTime = items.length * 2 + 10;
  
  return {
    total: items.length,
    completed,
    failed,
    totalSize,
    byType,
    estimatedTime,
  };
}

/**
 * 查找替换文本
 */
export function findReplaceText(
  text: string, 
  options: FindReplaceOptions
): string {
  let { find, replace, caseSensitive, useRegex } = options;
  
  if (!find) return text;
  
  if (useRegex) {
    try {
      const flags = caseSensitive ? 'g' : 'gi';
      const regex = new RegExp(find, flags);
      return text.replace(regex, replace);
    } catch {
      // 正则表达式无效，返回原文本
      return text;
    }
  }
  
  if (caseSensitive) {
    return text.split(find).join(replace);
  }
  
  // 不区分大小写的替换
  const regex = new RegExp(find.replace(/[.*+?^${}()|[\]\\]/g, '\\$&'), 'gi');
  return text.replace(regex, replace);
}

/**
 * 批量查找替换标题
 */
export function batchFindReplaceTitles(
  items: BatchImportItem[],
  options: FindReplaceOptions
): BatchImportItem[] {
  return items.map(item => {
    let title = '';
    if (item.titleOption === 'keep') {
      title = item.fileName;
    } else if (item.titleOption === 'custom' && item.customTitle) {
      title = item.customTitle;
    }
    
    if (title) {
      const newTitle = findReplaceText(title, options);
      if (newTitle !== title) {
        return {
          ...item,
          titleOption: 'custom',
          customTitle: newTitle,
        };
      }
    }
    return item;
  });
}

/**
 * 批量添加前缀/后缀
 */
export function batchAddPrefixSuffix(
  items: BatchImportItem[],
  prefix?: string,
  suffix?: string
): BatchImportItem[] {
  if (!prefix && !suffix) return items;
  
  return items.map(item => {
    let title = '';
    if (item.titleOption === 'keep') {
      title = item.fileName;
    } else if (item.titleOption === 'custom' && item.customTitle) {
      title = item.customTitle;
    }
    
    if (title) {
      const newTitle = `${prefix || ''}${title}${suffix || ''}`;
      return {
        ...item,
        titleOption: 'custom',
        customTitle: newTitle,
      };
    }
    return item;
  });
}

/**
 * 创建操作记录
 */
export function createOperation(
  type: Operation['type'],
  description: string,
  itemIds?: string[],
  prevValues?: Record<string, any>,
  nextValues?: Record<string, any>
): Operation {
  return {
    id: generateId(),
    type,
    timestamp: Date.now(),
    description,
    itemIds,
    prevValues,
    nextValues,
  };
}

/**
 * 深拷贝导入项
 */
export function cloneItems(items: BatchImportItem[]): BatchImportItem[] {
  return items.map(item => ({ ...item }));
}

/**
 * 验证导入项
 */
export function validateItems(items: BatchImportItem[]): { valid: boolean; errors: string[] } {
  const errors: string[] = [];
  
  // 检查是否有标题冲突
  const titles = new Map<string, string[]>();
  items.forEach(item => {
    let title = '';
    if (item.titleOption === 'keep') {
      title = item.fileName;
    } else if (item.titleOption === 'custom' && item.customTitle) {
      title = item.customTitle;
    }
    
    if (title) {
      if (!titles.has(title)) {
        titles.set(title, []);
      }
      titles.get(title)!.push(item.id);
    }
  });
  
  titles.forEach((ids, title) => {
    if (ids.length > 1) {
      errors.push(`标题 "${title}" 被 ${ids.length} 个创意使用`);
    }
  });
  
  return { valid: errors.length === 0, errors };
}

/**
 * 敏感词检测（简单示例）
 */
export function checkSensitiveWords(text: string): string[] {
  // 这里应该使用更完善的敏感词库
  const sensitiveWords = ['敏感词1', '敏感词2', '暴力', '色情'];
  const found: string[] = [];
  
  sensitiveWords.forEach(word => {
    if (text.includes(word)) {
      found.push(word);
    }
  });
  
  return found;
}

/**
 * 生成缩略图（使用FileReader）
 */
export function generateThumbnail(file: File): Promise<string | null> {
  return new Promise((resolve) => {
    if (!file.type.startsWith('image/')) {
      resolve(null);
      return;
    }
    
    const reader = new FileReader();
    reader.onload = (e) => {
      const img = new Image();
      img.onload = () => {
        const canvas = document.createElement('canvas');
        const ctx = canvas.getContext('2d');
        if (!ctx) {
          resolve(null);
          return;
        }
        
        // 生成小缩略图
        const maxSize = 100;
        const scale = Math.min(maxSize / img.width, maxSize / img.height);
        canvas.width = img.width * scale;
        canvas.height = img.height * scale;
        
        ctx.drawImage(img, 0, 0, canvas.width, canvas.height);
        resolve(canvas.toDataURL('image/jpeg', 0.7));
      };
      img.onerror = () => resolve(null);
      img.src = e.target?.result as string;
    };
    reader.onerror = () => resolve(null);
    reader.readAsDataURL(file);
  });
}

/**
 * 防抖函数
 */
export function debounce<T extends (...args: any[]) => void>(
  func: T,
  wait: number
): (...args: Parameters<T>) => void {
  let timeout: NodeJS.Timeout;
  return (...args: Parameters<T>) => {
    clearTimeout(timeout);
    timeout = setTimeout(() => func(...args), wait);
  };
}

/**
 * 节流函数
 */
export function throttle<T extends (...args: any[]) => void>(
  func: T,
  limit: number
): (...args: Parameters<T>) => void {
  let inThrottle = false;
  return (...args: Parameters<T>) => {
    if (!inThrottle) {
      func(...args);
      inThrottle = true;
      setTimeout(() => (inThrottle = false), limit);
    }
  };
}
