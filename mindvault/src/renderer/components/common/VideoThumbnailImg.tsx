import React from 'react';
import { useVideoThumbnail } from '../../hooks/useVideoThumbnail';

type VideoThumbnailImgProps = {
  filePath: string;
  style?: React.CSSProperties;
  className?: string;
  fallback: React.ReactNode;
};

export default function VideoThumbnailImg({ filePath, style, className, fallback }: VideoThumbnailImgProps) {
  const thumbUrl = useVideoThumbnail('video', filePath);

  if (thumbUrl) {
    return <img src={thumbUrl} alt="" style={style} className={className} />;
  }

  return <>{fallback}</>;
}
