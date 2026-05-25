import React, { useEffect, useState, useRef } from 'react';
import { AnimatePresence, motion } from 'framer-motion';

interface FlipDigitProps {
  digit: number;
}

const FlipDigit: React.FC<FlipDigitProps> = ({ digit }) => {
  const prevDigitRef = useRef(digit);
  const [prevDigit, setPrevDigit] = useState(digit);
  const [isAnimating, setIsAnimating] = useState(false);

  useEffect(() => {
    if (digit !== prevDigitRef.current) {
      setPrevDigit(prevDigitRef.current);
      prevDigitRef.current = digit;
      setIsAnimating(true);
      const timer = setTimeout(() => setIsAnimating(false), 250);
      return () => clearTimeout(timer);
    }
  }, [digit]);

  return (
    <div
      style={{
        position: 'relative',
        width: 44,
        height: 56,
        background: 'linear-gradient(180deg, rgba(255,255,255,0.22) 0%, rgba(255,255,255,0.08) 100%)',
        borderRadius: 10,
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        borderTop: '1.5px solid rgba(255,255,255,0.5)',
        borderLeft: '1.5px solid rgba(255,255,255,0.4)',
        borderRight: '1px solid rgba(255,255,255,0.12)',
        borderBottom: '1px solid rgba(255,255,255,0.08)',
        boxShadow: '0 6px 18px rgba(0,0,0,0.2), inset 0 2px 0 rgba(255,255,255,0.32), inset 0 -1px 0 rgba(0,0,0,0.06)',
        overflow: 'hidden',
      }}
    >
      {/* 微妙的内部光效 */}
      <div style={{
        position: 'absolute',
        top: 0,
        left: 0,
        right: 0,
        height: '40%',
        background: 'linear-gradient(180deg, rgba(255,255,255,0.15) 0%, transparent 100%)',
        pointerEvents: 'none',
      }} />

      <AnimatePresence mode="popLayout">
        <motion.span
          key={digit}
          initial={{ opacity: 0, y: -8, scale: 0.92 }}
          animate={{ opacity: 1, y: 0, scale: 1 }}
          exit={{ opacity: 0, y: 8, scale: 0.92 }}
          transition={{ duration: 0.2, ease: [0.34, 1.56, 0.64, 1] }}
          style={{
            fontSize: 40,
            fontWeight: 900,
            fontFamily: "'Impact', 'Arial Black', 'DIN Condensed', sans-serif",
            color: '#fff',
            textShadow: '0 0 6px rgba(255,255,255,0.25), 0 0 12px rgba(255,255,255,0.12)',
            lineHeight: 1,
            userSelect: 'none',
            zIndex: 1,
          }}
        >
          {digit}
        </motion.span>
      </AnimatePresence>
    </div>
  );
};

export default FlipDigit;