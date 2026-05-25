import React, { useState } from 'react';
import { FileText, Image, Video, Music, Link, File, Tag, ExternalLink } from 'lucide-react';
import { toMediaUrl } from '../../utils/media';
import { useVideoThumbnail } from '../../hooks/useVideoThumbnail';
import type { AICreativityRef } from '../../../shared/types';

const TYPE_ICONS: Record<string, React.FC<any>> = {
  text: FileText,
  image: Image,
  video: Video,
  audio: Music,
  link: Link,
  document: File,
};

const TYPE_LABELS: Record<string, string> = {
  text: '文本',
  image: '图片',
  video: '视频',
  audio: '音频',
  link: '链接',
  document: '文档',
};

interface Props {
  ref: AICreativityRef;
}

const CreativityRefCard: React.FC<Props> = ({ ref: creativityRef }) => {
  const [thumbError, setThumbError] = useState(false);

  // 安全检查：如果 ref 不存在，返回 null
  if (!creativityRef) {
    return null;
  }

  const resolvedContent = creativityRef.mediaFilePath || creativityRef.content || '';
  const videoThumb = useVideoThumbnail(creativityRef.type, resolvedContent);

  const IconComponent = TYPE_ICONS[creativityRef.type] || FileText;
  const typeLabel = TYPE_LABELS[creativityRef.type] || creativityRef.type;

  const hasMedia = ['image', 'video', 'audio'].includes(creativityRef.type) && resolvedContent;
  let thumbUrl = '';
  if (creativityRef.type === 'image' && !thumbError && resolvedContent) {
    try { thumbUrl = toMediaUrl(resolvedContent); } catch { thumbUrl = ''; }
  }

  const contentPreview = creativityRef.content || '';
  const displayContent = contentPreview.length > 120
    ? contentPreview.substring(0, 120) + '...'
    : contentPreview;

  const handleClick = () => {
    // 通过事件通知外部打开创意预览
    window.dispatchEvent(new CustomEvent('open-creativity-preview', { detail: { id: creativityRef.id } }));
  };

  return (
    <div
      onClick={handleClick}
      style={{
        borderRadius: 10,
        border: '1px solid var(--border-light)',
        background: 'var(--bg-secondary)',
        overflow: 'hidden',
        maxWidth: 280,
        transition: 'border-color 0.15s ease, box-shadow 0.15s ease',
        cursor: 'pointer',
      }}
      onMouseEnter={(e) => {
        (e.currentTarget as HTMLElement).style.borderColor = 'var(--primary-color)';
        (e.currentTarget as HTMLElement).style.boxShadow = '0 2px 8px rgba(0,0,0,0.08)';
      }}
      onMouseLeave={(e) => {
        (e.currentTarget as HTMLElement).style.borderColor = 'var(--border-light)';
        (e.currentTarget as HTMLElement).style.boxShadow = 'none';
      }}
    >
      {(thumbUrl || videoThumb) && (
        <div style={{
          width: '100%',
          height: 120,
          overflow: 'hidden',
          position: 'relative',
          background: 'var(--bg-tertiary)',
        }}>
          <img
            src={videoThumb || thumbUrl}
            alt=""
            draggable={false}
            onError={() => setThumbError(true)}
            style={{ width: '100%', height: '100%', objectFit: 'cover', display: 'block' }}
          />
          {creativityRef.type === 'video' && (
            <div style={{
              position: 'absolute', inset: 0,
              display: 'flex', alignItems: 'center', justifyContent: 'center',
              background: 'rgba(0,0,0,0.25)',
            }}>
              <Video size={24} color="#fff" />
            </div>
          )}
          {creativityRef.type === 'audio' && (
            <div style={{
              position: 'absolute', inset: 0,
              display: 'flex', alignItems: 'center', justifyContent: 'center',
              background: 'linear-gradient(135deg, rgba(99,102,241,0.15), rgba(139,92,246,0.15))',
            }}>
              <Music size={24} style={{ color: 'var(--primary-color)' }} />
            </div>
          )}
        </div>
      )}

      <div style={{ padding: '10px 12px' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 6, marginBottom: 4 }}>
          <div style={{
            width: 22, height: 22, borderRadius: 5,
            background: 'var(--primary-bg)',
            display: 'flex', alignItems: 'center', justifyContent: 'center',
            flexShrink: 0,
          }}>
            <IconComponent size={12} style={{ color: 'var(--primary-color)' }} />
          </div>
          <div style={{
            flex: 1, fontSize: 13, fontWeight: 600,
            color: 'var(--text-primary)',
            overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap',
          }}>
            {creativityRef.title || '未命名创意'}
          </div>
          <span style={{
            fontSize: 10, color: 'var(--text-tertiary)',
            background: 'var(--bg-tertiary)', padding: '1px 6px', borderRadius: 4,
            flexShrink: 0,
          }}>
            {typeLabel}
          </span>
        </div>

        {displayContent && !hasMedia && (
          <div style={{
            fontSize: 12, color: 'var(--text-secondary)', lineHeight: 1.5,
            maxHeight: 60, overflow: 'hidden',
            marginTop: 4,
          }}>
            {displayContent}
          </div>
        )}

        {creativityRef.tags && creativityRef.tags.length > 0 && (
          <div style={{ display: 'flex', gap: 4, flexWrap: 'wrap', marginTop: 6 }}>
            {creativityRef.tags.slice(0, 5).map((tag) => (
              <span key={tag.id} style={{
                fontSize: 10, padding: '1px 6px', borderRadius: 4,
                background: tag.color ? `${tag.color}18` : 'var(--bg-tertiary)',
                color: tag.color || 'var(--text-tertiary)',
                border: `1px solid ${tag.color ? `${tag.color}30` : 'var(--border-light)'}`,
              }}>
                {tag.name}
              </span>
            ))}
            {creativityRef.tags.length > 5 && (
              <span style={{ fontSize: 10, color: 'var(--text-tertiary)' }}>
                +{creativityRef.tags.length - 5}
              </span>
            )}
          </div>
        )}

        <div style={{
          fontSize: 10, color: 'var(--text-tertiary)', marginTop: 6,
          display: 'flex', alignItems: 'center', justifyContent: 'space-between',
        }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 3 }}>
            <Tag size={9} />
            <span>ID: {creativityRef.id.slice(0, 8)}...</span>
          </div>
          <div style={{ display: 'flex', alignItems: 'center', gap: 3, color: 'var(--primary-color)' }}>
            <ExternalLink size={9} />
            <span>查看</span>
          </div>
        </div>
      </div>
    </div>
  );
};

export default CreativityRefCard;
