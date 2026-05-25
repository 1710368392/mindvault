import React, { useId } from 'react';

interface GradientSpinnerProps {
  size?: number;
  style?: React.CSSProperties;
}

const GradientSpinner: React.FC<GradientSpinnerProps> = ({ size = 32, style }) => {
  const id = useId();
  const gradientId = `spin-gradient-${id.replace(/:/g, '')}`;

  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 50 50"
      style={{ animation: 'spin 1s linear infinite', ...style }}
    >
      <defs>
        <linearGradient id={gradientId} x1="0%" y1="0%" x2="100%" y2="0%">
          <stop offset="0%" stopColor="var(--primary-color)" />
          <stop offset="100%" stopColor="var(--primary-light)" />
        </linearGradient>
      </defs>
      <circle
        cx="25"
        cy="25"
        r="20"
        fill="none"
        stroke={`url(#${gradientId})`}
        strokeWidth="4"
        strokeLinecap="round"
        strokeDasharray="80 45"
      />
    </svg>
  );
};

export default GradientSpinner;
