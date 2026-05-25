import React, { useState, useMemo } from 'react';
import { Type, Image, Mic, Link as LinkIcon, Video, FileText, Play } from 'lucide-react';
import { useVideoThumbnailWithPath } from '../../hooks/useVideoThumbnail';
import { useImageThumbnail } from '../../hooks/useVideoThumbnail';
import { toMediaUrl, toMediaUrlFromSnapshot, toThumbnailUrlFromSnapshot, toLocalMediaUrl } from '../../utils/media';

const TYPE_ICONS: Record<string, React.FC<{ size?: number; color?: string }>> = {
  text: Type,
  image: Image,
  audio: Mic,
  link: LinkIcon,
  video: Video,
  document: FileText,
};

const TYPE_GRADIENTS: Record<string, string> = {
  text: 'linear-gradient(135deg, #667eea 0%, #764ba2 100%)',
  image: 'linear-gradient(135deg, #f093fb 0%, #f5576c 100%)',
  audio: 'linear-gradient(135deg, #4facfe 0%, #00f2fe 100%)',
  link: 'linear-gradient(135deg, #43e97b 0%, #38f9d7 100%)',
  video: 'linear-gradient(135deg, #fa709a 0%, #fee140 100%)',
  document: 'linear-gradient(135deg, #a18cd1 0%, #fbc2eb 100%)',
};

interface ListThumbnailCellProps {
  type: string;
  content?: string | null;
  mediaFilePath?: string | null;
  thumbnailPath?: string | null;
  size?: number;
  snapshot?: { mediaFilePath?: string; thumbnailPath?: string } | null;
}

function toLocalMediaUrlSafe(filePath: string | undefined | null): string {
  if (!filePath) return '';
  return toLocalMediaUrl(filePath);
}

export default function ListThumbnailCell({
  type,
  content,
  mediaFilePath,
  thumbnailPath,
  size = 40,
  snapshot,
}: ListThumbnailCellProps) {
  const [imgError, setImgError] = useState(false);

  const resolvedContent = mediaFilePath || content;
  
  const effectiveMediaFilePath = snapshot?.mediaFilePath || mediaFilePath;
  const effectiveThumbnailPath = snapshot?.thumbnailPath || thumbnailPath;
  
  const videoThumb = useVideoThumbnailWithPath(type, resolvedContent, effectiveThumbnailPath);
  const imageThumb = useImageThumbnail(resolvedContent, effectiveThumbnailPath);

  const snapshotThumbnailUrl = useMemo(() => {
    if (effectiveThumbnailPath) {
      return toLocalMediaUrlSafe(effectiveThumbnailPath);
    }
    if (effectiveMediaFilePath) {
      return toLocalMediaUrlSafe(effectiveMediaFilePath);
    }
    return '';
  }, [effectiveThumbnailPath, effectiveMediaFilePath]);

  const snapshotMediaUrl = useMemo(() => {
    if (effectiveMediaFilePath) {
      return toLocalMediaUrlSafe(effectiveMediaFilePath);
    }
    if (effectiveThumbnailPath) {
      return toLocalMediaUrlSafe(effectiveThumbnailPath);
    }
    return '';
  }, [effectiveMediaFilePath, effectiveThumbnailPath]);

  if (type === 'video' && !imgError) {
    const thumbUrl = videoThumb || snapshotThumbnailUrl || toThumbnailUrlFromSnapshot(resolvedContent, snapshot);
    if (thumbUrl) {
      return (
        <div
          style={{
            width: size,
            height: size,
            borderRadius: 6,
            overflow: 'hidden',
            flexShrink: 0,
            position: 'relative',
            background: 'var(--bg-tertiary)',
          }}
        >
          <img
            src={thumbUrl}
            alt=""
            draggable={false}
            loading="lazy"
            decoding="async"
            onError={() => setImgError(true)}
            style={{
              width: '100%',
              height: '100%',
              objectFit: 'cover',
              display: 'block',
            }}
          />
          <div
            style={{
              position: 'absolute',
              inset: 0,
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              background: 'rgba(0,0,0,0.25)',
            }}
          >
            <Play size={12} color="#fff" fill="#fff" style={{ marginLeft: 1 }} />
          </div>
        </div>
      );
    }
  }

  if (type === 'image' && !imgError) {
    const thumbSrc = imageThumb || snapshotMediaUrl || toMediaUrlFromSnapshot(resolvedContent, snapshot) || toMediaUrl(resolvedContent);
    if (thumbSrc) {
      return (
        <div
          style={{
            width: size,
            height: size,
            borderRadius: 6,
            overflow: 'hidden',
            flexShrink: 0,
            background: 'var(--bg-tertiary)',
          }}
        >
          <img
            src={thumbSrc}
            alt=""
            draggable={false}
            loading="lazy"
            decoding="async"
            onError={() => setImgError(true)}
            style={{
              width: '100%',
              height: '100%',
              objectFit: 'cover',
              display: 'block',
            }}
          />
        </div>
      );
    }
  }

  const IconComponent = TYPE_ICONS[type] || Type;
  const gradient = TYPE_GRADIENTS[type] || TYPE_GRADIENTS.text;

  return (
    <div
      style={{
        width: size,
        height: size,
        borderRadius: 6,
        background: gradient,
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        flexShrink: 0,
      }}
    >
      <IconComponent size={16} color="rgba(255,255,255,0.85)" />
    </div>
  );
}
