import React, { useMemo, useRef, useEffect, useState } from 'react';
import { getFrequencyData } from '../../stores/musicStore';
import { useMusicStore } from '../../stores/musicStore';
import { resolveColor, lightenHex, darkenHex, hexToRgb } from './utils/color';
import { getFrequencyBands } from './utils/audio-analysis';

interface DynamicBackgroundProps {
  style?: React.CSSProperties;
  children?: React.ReactNode;
  intensity?: number;
}

const DynamicBackground: React.FC<DynamicBackgroundProps> = ({
  style,
  children,
  intensity = 0.5,
}) => {
  const isPlaying = useMusicStore((s) => s.isPlaying);
  const [bgStyle, setBgStyle] = useState<React.CSSProperties>({});

  useEffect(() => {
    let rafId: number;
    let lastUpdate = 0;
    const THROTTLE_MS = 66;

    const tick = () => {
      const now = performance.now();
      if (now - lastUpdate >= THROTTLE_MS) {
        lastUpdate = now;
        const data = getFrequencyData();
        const { bass, mid, overall } = getFrequencyBands(
          data.length > 0 ? data : new Array(64).fill(0)
        );

        const primary = resolveColor('var(--primary-color)', '#8B5CF6');
        const primaryLight = lightenHex(primary, 0.5);
        const primaryDark = darkenHex(primary, 0.3);

        if (!isPlaying || overall < 0.01) {
          setBgStyle({
            background: `radial-gradient(ellipse at 30% 50%, ${primary}08 0%, transparent 60%), radial-gradient(ellipse at 70% 50%, ${primaryLight}06 0%, transparent 60%)`,
            opacity: 1,
            transition: 'all 1s ease-out',
          });
        } else {
          const angle = bass * 180 * intensity;
          const midShift = mid * intensity;
          const glowOpacity = 0.05 + overall * 0.1 * intensity;
          const bassGlowOpacity = 0.03 + bass * 0.12 * intensity;
          const pulseScale = 1 + bass * 0.05 * intensity;

          const color1 = midShift > 0.3 ? primaryLight : primary;
          const color2 = primaryDark;

          setBgStyle({
            background: `
              radial-gradient(ellipse at ${30 + angle * 0.2}% ${40 + bass * 20}%, ${color1}${Math.round(glowOpacity * 255).toString(16).padStart(2, '0')} 0%, transparent 55%),
              radial-gradient(ellipse at ${70 - angle * 0.15}% ${60 - bass * 15}%, ${color2}${Math.round(bassGlowOpacity * 255).toString(16).padStart(2, '0')} 0%, transparent 50%),
              radial-gradient(ellipse at 50% 50%, ${primaryLight}${Math.round((glowOpacity * 0.5) * 255).toString(16).padStart(2, '0')} 0%, transparent 70%)
            `.trim(),
            transform: `scale(${pulseScale})`,
            opacity: 0.8 + overall * 0.2,
            transition: 'background 0.3s ease-out, transform 0.15s ease-out, opacity 0.3s ease-out',
          });
        }
      }
      rafId = requestAnimationFrame(tick);
    };

    rafId = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(rafId);
  }, [isPlaying, intensity]);

  return (
    <div
      style={{
        position: 'relative',
        overflow: 'hidden',
        ...style,
      }}
    >
      <div
        style={{
          position: 'absolute',
          top: '-20%',
          left: '-20%',
          right: '-20%',
          bottom: '-20%',
          pointerEvents: 'none',
          zIndex: 0,
          ...bgStyle,
        }}
      />
      <div style={{ position: 'relative', zIndex: 1 }}>
        {children}
      </div>
    </div>
  );
};

export default DynamicBackground;
