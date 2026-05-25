import React from 'react';

interface CollectionIconProps {
  size?: number;
  color?: string;
  style?: React.CSSProperties;
}

const CollectionIcon: React.FC<CollectionIconProps> = ({ size = 14, color, style }) => (
  <svg
    xmlns="http://www.w3.org/2000/svg"
    width={size}
    height={size}
    viewBox="0 0 48 48"
    fill="none"
    style={style}
  >
    <path
      fill={color || 'var(--primary-color)'}
      stroke={color || 'var(--primary-color)'}
      strokeWidth="3"
      strokeLinecap="round"
      strokeLinejoin="round"
      d="M8 44V4H31L40 14.5V44H8Z"
    />
    <path
      fill="white"
      stroke="white"
      strokeWidth="2.5"
      strokeLinecap="round"
      strokeLinejoin="round"
      d="M24 15L27.0841 21.7551L34.4616 22.6008L28.9902 27.6214L30.4656 34.8992L24 31.247L17.5344 34.8992L19.0098 27.6214L13.5384 22.6008L20.9159 21.7551L24 15Z"
    />
  </svg>
);

export default CollectionIcon;
