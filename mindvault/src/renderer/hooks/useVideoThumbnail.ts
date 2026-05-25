import { useState, useEffect, useRef } from 'react';
import { api } from '../utils/api';
import { toMediaUrl } from '../utils/media';
import { 
  useThumbnailCacheStore, 
  generateThumbnailCacheKey, 
  generateThumbnailPathCacheKey 
} from '../stores/thumbnailCacheStore';

function extractVideoFrameFromBrowser(videoSrc: string): Promise<string | null> {
  return new Promise((resolve) => {
    const video = document.createElement('video');
    video.crossOrigin = 'anonymous';
    video.preload = 'metadata';
    video.muted = true;
    video.playsInline = true;

    let currentSeekIndex = 0;
    const seekTimes = [0.5, 1.0, 2.0, 0.1]; // 尝试多个时间点
    let timeout: NodeJS.Timeout | null = null;

    const cleanup = () => {
      video.removeEventListener('loadeddata', onLoadedData);
      video.removeEventListener('seeked', onSeeked);
      video.removeEventListener('error', onError);
      if (timeout) {
        clearTimeout(timeout);
      }
      video.src = '';
      video.load();
    };

    const onError = () => {
      cleanup();
      resolve(null);
    };

    const tryNextSeek = () => {
      if (currentSeekIndex < seekTimes.length) {
        const nextSeek = Math.min(seekTimes[currentSeekIndex], video.duration - 0.1);
        currentSeekIndex++;
        try {
          video.currentTime = nextSeek;
        } catch (e) {
          tryNextSeek();
        }
      } else {
        cleanup();
        resolve(null);
      }
    };

    const onLoadedData = () => {
      tryNextSeek();
    };

    const onSeeked = () => {
      try {
        const canvas = document.createElement('canvas');
        canvas.width = video.videoWidth || 300;
        canvas.height = video.videoHeight || 200;
        const ctx = canvas.getContext('2d');
        if (!ctx) {
          tryNextSeek();
          return;
        }
        ctx.drawImage(video, 0, 0, canvas.width, canvas.height);
        const dataUrl = canvas.toDataURL('image/jpeg', 0.7);
        cleanup();
        resolve(dataUrl);
      } catch {
        tryNextSeek();
      }
    };

    video.addEventListener('loadeddata', onLoadedData);
    video.addEventListener('seeked', onSeeked);
    video.addEventListener('error', onError);
    video.src = videoSrc;

    timeout = setTimeout(() => {
      cleanup();
      resolve(null);
    }, 30000); // 延长超时时间到 30 秒

    const originalResolve = resolve;
    resolve = (value: string | null) => {
      if (timeout) {
        clearTimeout(timeout);
      }
      originalResolve(value);
    };
  });
}

/**
 * 将本地缩略图路径转换为 local-media:/// 协议 URL
 */
function toLocalMediaUrl(filePath: string): string {
  if (!filePath) return '';
  if (filePath.startsWith('local-media://') || filePath.startsWith('data:') || filePath.startsWith('http')) {
    return filePath;
  }
  const normalized = filePath.replace(/\\/g, '/');
  const encoded = encodeURI(normalized);
  return 'local-media:///' + encoded;
}

export function useVideoThumbnail(type: string, content: string | undefined | null): string | null {
  return useVideoThumbnailWithPath(type, content, undefined);
}

/**
 * 增强版视频缩略图 Hook，支持传入已缓存的 thumbnailPath
 * 优先级：全局内存缓存 > thumbnailPath（数据库缓存）> 视频帧提取
 */
export function useVideoThumbnailWithPath(
  type: string,
  content: string | undefined | null,
  thumbnailPath: string | undefined | null,
): string | null {
  const [thumbUrl, setThumbUrl] = useState<string | null>(null);
  const { getCachedThumbnail, setCachedThumbnail } = useThumbnailCacheStore();
  const isMountedRef = useRef(true);

  useEffect(() => {
    isMountedRef.current = true;
    
    if (type !== 'video' || !content) {
      setThumbUrl(null);
      return;
    }

    // 生成缓存 key
    const contentCacheKey = generateThumbnailCacheKey(type, content);
    const thumbnailPathCacheKey = thumbnailPath ? generateThumbnailPathCacheKey(thumbnailPath) : null;

    // 1. 优先检查全局内存缓存
    if (thumbnailPathCacheKey) {
      const cachedUrl = getCachedThumbnail(thumbnailPathCacheKey);
      if (cachedUrl) {
        setThumbUrl(cachedUrl);
        return;
      }
    }
    
    if (contentCacheKey) {
      const cachedUrl = getCachedThumbnail(contentCacheKey);
      if (cachedUrl) {
        setThumbUrl(cachedUrl);
        return;
      }
    }

    // 2. 其次使用 thumbnailPath（数据库缓存）
    if (thumbnailPath) {
      const url = toLocalMediaUrl(thumbnailPath);
      if (url) {
        // 写入全局缓存
        if (thumbnailPathCacheKey) {
          setCachedThumbnail(thumbnailPathCacheKey, url);
        }
        setThumbUrl(url);
        return;
      }
    }

    const isLocalPath = /^[A-Za-z]:\\/.test(content) || content.startsWith('/') || content.startsWith('media://');
    if (!isLocalPath) {
      setThumbUrl(null);
      return;
    }

    setThumbUrl(null);

    let cancelled = false;

    // 3. 最后执行昂贵的视频帧提取
    (async () => {
      try {
        // 方式 1：先尝试用 base64 读取文件，然后转成 blob URL 处理
        const base64Result = await api.media.readFileAsBase64(content);
        if (cancelled || !isMountedRef.current) return;
        if (base64Result && base64Result.data) {
          const [header, body] = base64Result.data.split(',');
          const mimeType = header.match(/:(.*?);/)?.[1] || 'video/mp4';
          const binaryString = atob(body);
          const bytes = new Uint8Array(binaryString.length);
          for (let j = 0; j < binaryString.length; j++) {
            bytes[j] = binaryString.charCodeAt(j);
          }
          const blob = new Blob([bytes], { type: mimeType });
          const blobUrl = URL.createObjectURL(blob);
          
          // 用 blob URL 来提取视频帧
          const frameUrl = await extractVideoFrameFromBrowser(blobUrl);
          URL.revokeObjectURL(blobUrl); // 释放 blob URL
          
          if (cancelled || !isMountedRef.current) return;
          if (frameUrl) {
            // 写入全局缓存
            if (contentCacheKey) {
              setCachedThumbnail(contentCacheKey, frameUrl);
            }
            setThumbUrl(frameUrl);
            return;
          }
        }
      } catch (err) {
        // base64 方式失败，继续尝试其他方式
      }

      try {
        // 方式 2：尝试获取缩略图 URL
        const url = await api.media.getThumbnailUrl(content);
        if (cancelled || !isMountedRef.current) return;
        if (url) {
          // 写入全局缓存
          if (contentCacheKey) {
            setCachedThumbnail(contentCacheKey, url);
          }
          setThumbUrl(url);
          return;
        }

        // 方式 3：尝试用 local-media:// 协议直接加载
        const videoSrc = toMediaUrl(content);
        if (videoSrc) {
          const frameUrl = await extractVideoFrameFromBrowser(videoSrc);
          if (cancelled || !isMountedRef.current) return;
          if (frameUrl) {
            // 写入全局缓存
            if (contentCacheKey) {
              setCachedThumbnail(contentCacheKey, frameUrl);
            }
            setThumbUrl(frameUrl);
            return;
          }
        }
      } catch (err) {
        // 其他方式失败
      }
    })();

    return () => {
      cancelled = true;
      isMountedRef.current = false;
    };
  }, [type, content, thumbnailPath, getCachedThumbnail, setCachedThumbnail]);

  return thumbUrl;
}

/**
 * 获取图片缩略图 URL（带缓存）
 * 优先使用 thumbnailPath，其次计算缩略图路径
 */
export function useImageThumbnail(
  content: string | undefined | null,
  thumbnailPath: string | undefined | null,
): string | null {
  const { getCachedThumbnail, setCachedThumbnail } = useThumbnailCacheStore();
  
  // 优先使用 thumbnailPath
  if (thumbnailPath) {
    const cacheKey = generateThumbnailPathCacheKey(thumbnailPath);
    const cached = getCachedThumbnail(cacheKey);
    if (cached) return cached;
    
    const url = toLocalMediaUrl(thumbnailPath);
    if (url) {
      return url;
    }
  }
  
  // 其次使用 content 计算缩略图路径
  if (content) {
    const cacheKey = generateThumbnailCacheKey('image', content);
    const cached = getCachedThumbnail(cacheKey);
    if (cached) return cached;
    
    // 计算缩略图路径
    const thumbUrl = computeImageThumbnailUrl(content);
    if (thumbUrl) {
      return thumbUrl;
    }
  }
  
  return null;
}

/**
 * 计算图片缩略图 URL（纯函数，不涉及缓存）
 */
function computeImageThumbnailUrl(content: string | undefined | null): string | null {
  if (!content) return null;
  
  if (content.startsWith('data:') || content.startsWith('http://') || content.startsWith('https://')) {
    return null;
  }

  let filePath = content;
  if (content.startsWith('local-media:///')) {
    filePath = decodeURIComponent(content.replace('local-media:///', ''));
  }

  if (!/^[A-Za-z]:\\/.test(filePath) && !filePath.startsWith('/') && !filePath.startsWith('.\\') && !filePath.startsWith('./')) {
    return null;
  }

  const IMAGE_EXTS = ['.png', '.jpg', '.jpeg', '.gif', '.bmp', '.webp'];
  const ext = filePath.substring(filePath.lastIndexOf('.')).toLowerCase();
  if (!IMAGE_EXTS.includes(ext)) {
    return null;
  }

  const normalized = filePath.replace(/\\/g, '/');
  const lastSlash = normalized.lastIndexOf('/');
  const dir = lastSlash >= 0 ? normalized.substring(0, lastSlash) : '';
  const fileName = lastSlash >= 0 ? normalized.substring(lastSlash + 1) : normalized;

  const thumbPath = dir + '/thumbnails/thumb_' + fileName + '.jpg';
  const encoded = encodeURI(thumbPath);
  return 'local-media:///' + encoded;
}
