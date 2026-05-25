import React from 'react';
import { EMOJI_SVG_MAP } from '@shared/constants';

const EmojiIcon: React.FC<{
  id: string | null | undefined;
  size?: number;
  style?: React.CSSProperties;
}> = ({ id, size = 16, style }) => {
  if (!id) return null;
  const svgUrl = EMOJI_SVG_MAP[id];
  if (!svgUrl) return null;
  return (
    <img
      src={svgUrl}
      alt={id}
      style={{
        width: size,
        height: size,
        objectFit: 'contain',
        display: 'inline-block',
        verticalAlign: 'middle',
        ...style,
      }}
    />
  );
};

export default EmojiIcon;
