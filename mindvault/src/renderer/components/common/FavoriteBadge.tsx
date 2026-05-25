import React from 'react';

interface FavoriteBadgeProps {
  size?: number;
  style?: React.CSSProperties;
}

const FavoriteBadge: React.FC<FavoriteBadgeProps> = ({ size = 32, style }) => (
  <svg
    viewBox="0 0 1187 1024"
    width={size}
    height={size * (1024 / 1187)}
    style={{ position: 'absolute', top: 0, right: 0, filter: 'drop-shadow(1px 2px 2px rgba(0,0,0,0.2))', ...style }}
  >
    <defs>
      <filter id="favorite-emboss" x="-10%" y="-10%" width="120%" height="120%">
        <feGaussianBlur in="SourceAlpha" stdDeviation="8" result="blur" />
        <feSpecularLighting in="blur" surfaceScale="6" specularConstant="0.8" specularExponent="25" result="specular">
          <fePointLight x="400" y="200" z="300" />
        </feSpecularLighting>
        <feComposite in="specular" in2="SourceAlpha" operator="in" result="specClipped" />
        <feComposite in="SourceGraphic" in2="specClipped" operator="arithmetic" k1="0" k2="1" k3="0.6" k4="0" />
      </filter>
    </defs>
    <path d="M0 0l1187.84 1024V0H0z" fill="var(--primary-color, #6C63FF)" filter="url(#favorite-emboss)" />
    <path
      d="M880.64 143.36l-53.8624 96.4608L716.8 260.7104l76.5952 80.4864-13.9264 109.3632L880.64 403.6608 982.016 450.56l-13.9264-109.3632L1044.48 260.7104l-109.7728-20.8896L880.64 143.36"
      fill="white"
      style={{ filter: 'drop-shadow(0 1px 1px rgba(0,0,0,0.15))' }}
    />
  </svg>
);

export default FavoriteBadge;
