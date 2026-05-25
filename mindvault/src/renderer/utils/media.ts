const isElectron = typeof window !== 'undefined' && !!(window as any).electronAPI;

const mediaPathCache = new Map<string, string>();

export function registerMediaPath(mediaId: string, filePath: string) {
  mediaPathCache.set(mediaId, filePath);
}

export function registerMediaPaths(records: Array<{ id: string; filePath?: string; filepath?: string }>) {
  for (const record of records) {
    const fp = record.filePath || record.filepath;
    if (record.id && fp) {
      mediaPathCache.set(record.id, fp);
    }
  }
}

export function clearMediaPathCache() {
  mediaPathCache.clear();
}

export function isMediaReference(content: string | undefined | null): boolean {
  if (!content) return false;
  return content.startsWith('media://');
}

export function extractMediaId(content: string): string | null {
  if (!content.startsWith('media://')) return null;
  return content.slice(8) || null;
}

export function resolveMediaContent(content: string | undefined | null): string {
  if (!content) return '';
  if (content.startsWith('media://')) {
    const mediaId = extractMediaId(content);
    if (mediaId) {
      const filePath = mediaPathCache.get(mediaId);
      if (filePath) return filePath;
    }
    return '';
  }
  return content;
}

export function toMediaUrl(content: string | undefined | null): string {
  if (!content) return '';

  if (content.startsWith('media://')) {
    const mediaId = extractMediaId(content);
    if (mediaId) {
      const filePath = mediaPathCache.get(mediaId);
      if (filePath) {
        const normalized = filePath.replace(/\\/g, '/');
        const encoded = encodeURI(normalized);
        return 'local-media:///' + encoded;
      }
    }
    console.warn('[toMediaUrl] media:// ref but no cache:', content);
    return '';
  }

  if (
    content.startsWith('data:') ||
    content.startsWith('http://') ||
    content.startsWith('https://') ||
    content.startsWith('local-media://')
  ) {
    return content;
  }

  if (/^[A-Za-z]:\\/.test(content) || content.startsWith('/') || content.startsWith('.\\') || content.startsWith('./')) {
    const normalized = content.replace(/\\/g, '/');
    const encoded = encodeURI(normalized);
    return 'local-media:///' + encoded;
  }

  return content;
}

const IMAGE_EXTS = ['.png', '.jpg', '.jpeg', '.gif', '.bmp', '.webp'];

export function toThumbnailUrl(content: string | undefined | null): string {
  if (!content) return '';

  if (content.startsWith('data:') || content.startsWith('http://') || content.startsWith('https://')) {
    return '';
  }

  if (content.startsWith('media://')) {
    const filePath = resolveMediaContent(content);
    if (!filePath) return '';
    return toThumbnailUrl(filePath);
  }

  let filePath = content;
  if (content.startsWith('local-media:///')) {
    filePath = decodeURIComponent(content.replace('local-media:///', ''));
  }

  if (!/^[A-Za-z]:\\/.test(filePath) && !filePath.startsWith('/') && !filePath.startsWith('.\\') && !filePath.startsWith('./')) {
    return '';
  }

  const ext = getFileExtension(filePath);
  if (!IMAGE_EXTS.includes(ext)) {
    return '';
  }

  const normalized = filePath.replace(/\\/g, '/');
  const lastSlash = normalized.lastIndexOf('/');
  const dir = lastSlash >= 0 ? normalized.substring(0, lastSlash) : '';
  const fileName = lastSlash >= 0 ? normalized.substring(lastSlash + 1) : normalized;

  const thumbPath = dir + '/thumbnails/thumb_' + fileName + '.jpg';
  const encoded = encodeURI(thumbPath);
  return 'local-media:///' + encoded;
}

export function isLocalFilePath(content: string | undefined | null): boolean {
  if (!content) return false;
  if (content.startsWith('media://')) return true;
  return /^[A-Za-z]:\\/.test(content) || content.startsWith('/') || content.startsWith('.\\') || content.startsWith('./');
}

export function toLocalMediaUrl(filePath: string): string {
  const normalized = filePath.replace(/\\/g, '/');
  const encoded = encodeURI(normalized);
  return 'local-media:///' + encoded;
}

export function isDataUrl(content: string | undefined | null): boolean {
  if (!content) return false;
  return content.startsWith('data:');
}

export function isWebUrl(content: string | undefined | null): boolean {
  if (!content) return false;
  return content.startsWith('http://') || content.startsWith('https://');
}

export function getMediaSource(content: string | undefined | null): 'data' | 'web' | 'local' | 'none' {
  if (!content) return 'none';
  if (isDataUrl(content)) return 'data';
  if (isWebUrl(content)) return 'web';
  if (isLocalFilePath(content) || content.startsWith('local-media://')) return 'local';
  return 'none';
}

export function getFileNameFromPath(filePath: string): string {
  if (!filePath) return '';
  if (filePath.startsWith('media://')) {
    const resolved = resolveMediaContent(filePath);
    return getFileNameFromPath(resolved);
  }
  const normalized = filePath.replace(/\\/g, '/');
  const parts = normalized.split('/');
  return parts[parts.length - 1] || '';
}

export function getFileExtension(filePath: string): string {
  const name = getFileNameFromPath(filePath);
  const dotIndex = name.lastIndexOf('.');
  return dotIndex >= 0 ? name.substring(dotIndex).toLowerCase() : '';
}

export function isPureMediaContent(content: string | undefined | null): boolean {
  if (!content) return true;
  const trimmed = content.trim();
  if (!trimmed) return true;
  if (isLocalFilePath(trimmed)) return true;
  if (isDataUrl(trimmed)) return true;
  if (isWebUrl(trimmed)) return true;
  if (trimmed.startsWith('local-media://')) return true;
  return false;
}

const MEDIA_EXT_MAP: Record<string, string> = {
  '.png': 'image', '.jpg': 'image', '.jpeg': 'image', '.gif': 'image',
  '.bmp': 'image', '.webp': 'image', '.svg': 'image', '.ico': 'image',
  '.mp3': 'audio', '.wav': 'audio', '.ogg': 'audio', '.flac': 'audio',
  '.aac': 'audio', '.m4a': 'audio', '.wma': 'audio',
  '.mp4': 'video', '.webm': 'video', '.avi': 'video', '.mov': 'video',
  '.mkv': 'video', '.wmv': 'video', '.flv': 'video',
  '.pdf': 'document',
};

export function inferTypeFromPath(filePath: string): 'image' | 'audio' | 'video' | 'document' | null {
  const ext = getFileExtension(filePath);
  return (MEDIA_EXT_MAP[ext] as 'image' | 'audio' | 'video' | 'document' | null) || null;
}

/**
 * 从快照对象中提取媒体路径并注册到缓存
 * 支持快照中的 mediaFilePath, thumbnailPath, content 字段
 */
export function extractAndRegisterMediaFromSnapshot(snapshot: any): void {
  if (!snapshot) return;
  
  const mediaRecords: Array<{ id: string; filePath?: string; filepath?: string }> = [];
  
  // 优先处理 content 中的 media:// 引用（用于 content=media://xxx 的情况）
  if (snapshot.content && typeof snapshot.content === 'string' && snapshot.content.startsWith('media://')) {
    const mediaId = extractMediaId(snapshot.content);
    if (mediaId && snapshot.mediaFilePath) {
      mediaRecords.push({ id: mediaId, filePath: snapshot.mediaFilePath });
    }
  }
  
  // 提取 mediaFilePath（用于 content 为空或非 media:// 引用的图片/视频创意）
  if (snapshot.mediaFilePath && isLocalFilePath(snapshot.mediaFilePath) && !snapshot.mediaFilePath.startsWith('media://')) {
    // 只有当 content 不是 media:// 引用时，才使用临时ID
    const contentIsMediaRef = snapshot.content && typeof snapshot.content === 'string' && snapshot.content.startsWith('media://');
    if (!contentIsMediaRef) {
      const tempId = 'snapshot_' + Math.random().toString(36).substr(2, 9);
      mediaRecords.push({ id: tempId, filePath: snapshot.mediaFilePath });
    }
  }
  
  // 提取 thumbnailPath
  if (snapshot.thumbnailPath && isLocalFilePath(snapshot.thumbnailPath) && !snapshot.thumbnailPath.startsWith('media://')) {
    const tempId = 'thumb_' + Math.random().toString(36).substr(2, 9);
    mediaRecords.push({ id: tempId, filePath: snapshot.thumbnailPath });
  }
  
  if (mediaRecords.length > 0) {
    registerMediaPaths(mediaRecords);
  }
}

/**
 * 从快照中解析媒体URL，优先使用快照中的完整路径
 */
export function toMediaUrlFromSnapshot(
  content: string | undefined | null,
  snapshot?: { mediaFilePath?: string; thumbnailPath?: string } | null
): string {
  // 先尝试正常解析
  const normalResult = toMediaUrl(content);
  if (normalResult && normalResult !== content) {
    return normalResult;
  }
  
  // 如果有快照，尝试使用快照中的路径
  if (snapshot) {
    if (snapshot.mediaFilePath && isLocalFilePath(snapshot.mediaFilePath)) {
      const normalized = snapshot.mediaFilePath.replace(/\\/g, '/');
      const encoded = encodeURI(normalized);
      return 'local-media:///' + encoded;
    }
    if (snapshot.thumbnailPath && isLocalFilePath(snapshot.thumbnailPath)) {
      const normalized = snapshot.thumbnailPath.replace(/\\/g, '/');
      const encoded = encodeURI(normalized);
      return 'local-media:///' + encoded;
    }
  }
  
  return content || '';
}

/**
 * 从快照中解析缩略图URL
 */
export function toThumbnailUrlFromSnapshot(
  content: string | undefined | null,
  snapshot?: { mediaFilePath?: string; thumbnailPath?: string } | null
): string {
  // 先尝试正常解析
  const normalResult = toThumbnailUrl(content);
  if (normalResult) {
    return normalResult;
  }
  
  // 如果有快照，尝试使用快照中的缩略图路径
  if (snapshot?.thumbnailPath && isLocalFilePath(snapshot.thumbnailPath)) {
    const normalized = snapshot.thumbnailPath.replace(/\\/g, '/');
    const encoded = encodeURI(normalized);
    return 'local-media:///' + encoded;
  }
  
  // 尝试用 mediaFilePath 生成缩略图
  if (snapshot?.mediaFilePath) {
    return toThumbnailUrl(snapshot.mediaFilePath);
  }
  
  return '';
}
