import React, { useRef, useEffect, useMemo, useCallback } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { LrcLine, findCurrentLineIndex } from '../../utils/lrc-parser';

interface LyricsDisplayProps {
  lines: LrcLine[];
  currentTime: number;
  onSeek?: (time: number) => void;
  compact?: boolean;
  style?: React.CSSProperties;
}

const LyricsDisplay: React.FC<LyricsDisplayProps> = ({
  lines,
  currentTime,
  onSeek,
  compact = false,
  style,
}) => {
  const containerRef = useRef<HTMLDivElement>(null);
  const lineRefs = useRef<Map<number, HTMLDivElement>>(new Map());

  const currentIndex = useMemo(
    () => findCurrentLineIndex(lines, currentTime),
    [lines, currentTime],
  );

  // Auto-scroll to current line in full mode
  useEffect(() => {
    if (compact || currentIndex < 0 || !containerRef.current) return;

    const lineEl = lineRefs.current.get(currentIndex);
    if (!lineEl) return;

    const container = containerRef.current;
    const containerRect = container.getBoundingClientRect();
    const lineRect = lineEl.getBoundingClientRect();

    // Calculate the offset to center the current line
    const targetScrollTop =
      lineEl.offsetTop - container.clientHeight / 2 + lineRect.height / 2;

    container.scrollTo({
      top: Math.max(0, targetScrollTop),
      behavior: 'smooth',
    });
  }, [currentIndex, compact]);

  const handleLineClick = useCallback(
    (line: LrcLine) => {
      if (onSeek) {
        onSeek(line.time);
      }
    },
    [onSeek],
  );

  // Empty state
  if (!lines || lines.length === 0) {
    return (
      <div
        style={{
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          height: '100%',
          width: '100%',
          ...style,
        }}
      >
        <span
          style={{
            fontSize: compact ? 9 : 12,
            color: 'var(--text-tertiary)',
            opacity: 0.4,
            whiteSpace: 'nowrap',
          }}
        >
          暂无歌词
        </span>
      </div>
    );
  }

  // Compact mode: show current line and next line
  if (compact) {
    const currentLine = currentIndex >= 0 ? lines[currentIndex] : null;
    const nextLine = currentIndex >= 0 && currentIndex + 1 < lines.length ? lines[currentIndex + 1] : null;

    return (
      <div
        style={{
          display: 'flex',
          flexDirection: 'column',
          alignItems: 'center',
          justifyContent: 'center',
          height: '100%',
          width: '100%',
          overflow: 'hidden',
          gap: 2,
          ...style,
        }}
      >
        <AnimatePresence mode="wait">
          <motion.div
            key={currentLine ? currentIndex : 'empty'}
            initial={{ y: 10, opacity: 0 }}
            animate={{ y: 0, opacity: 1 }}
            exit={{ y: -10, opacity: 0 }}
            transition={{ duration: 0.3, ease: 'easeOut' }}
            style={{
              fontSize: 10,
              fontWeight: 600,
              color: currentLine ? 'var(--primary-color)' : 'var(--text-tertiary)',
              whiteSpace: 'nowrap',
              overflow: 'hidden',
              textOverflow: 'ellipsis',
              maxWidth: '100%',
              textAlign: 'center',
              lineHeight: 1.3,
              cursor: currentLine && onSeek ? 'pointer' : 'default',
            }}
            onClick={() => currentLine && handleLineClick(currentLine)}
          >
            {currentLine ? currentLine.text : '暂无歌词'}
          </motion.div>
        </AnimatePresence>
        <AnimatePresence mode="wait">
          <motion.div
            key={nextLine ? currentIndex + 1 : 'empty-next'}
            initial={{ y: 10, opacity: 0 }}
            animate={{ y: 0, opacity: 0.5 }}
            exit={{ y: -10, opacity: 0 }}
            transition={{ duration: 0.3, ease: 'easeOut', delay: 0.05 }}
            style={{
              fontSize: 8,
              fontWeight: 400,
              color: 'var(--text-tertiary)',
              whiteSpace: 'nowrap',
              overflow: 'hidden',
              textOverflow: 'ellipsis',
              maxWidth: '100%',
              textAlign: 'center',
              lineHeight: 1.3,
              cursor: nextLine && onSeek ? 'pointer' : 'default',
            }}
            onClick={() => nextLine && handleLineClick(nextLine)}
          >
            {nextLine ? nextLine.text : ''}
          </motion.div>
        </AnimatePresence>
      </div>
    );
  }

  // Full mode: scrollable lyrics display
  return (
    <div
      ref={containerRef}
      style={{
        maxHeight: 200,
        overflow: 'hidden',
        position: 'relative',
        maskImage: 'linear-gradient(to bottom, transparent 0%, black 15%, black 85%, transparent 100%)',
        WebkitMaskImage: 'linear-gradient(to bottom, transparent 0%, black 15%, black 85%, transparent 100%)',
        ...style,
      }}
    >
      <div
        style={{
          display: 'flex',
          flexDirection: 'column',
          alignItems: 'center',
          padding: '60px 12px',
          gap: 6,
        }}
      >
        {lines.map((line, index) => {
          const isCurrent = index === currentIndex;
          const distance = Math.abs(index - currentIndex);
          const isPast = index < currentIndex;
          const isFuture = index > currentIndex;

          // Calculate opacity based on distance from current line
          let opacity = 1;
          if (distance === 0) {
            opacity = 1;
          } else if (distance === 1) {
            opacity = 0.6;
          } else if (distance === 2) {
            opacity = 0.4;
          } else if (distance === 3) {
            opacity = 0.25;
          } else {
            opacity = 0.12;
          }

          return (
            <motion.div
              key={`${index}-${line.time}`}
              ref={(el) => {
                if (el) {
                  lineRefs.current.set(index, el);
                } else {
                  lineRefs.current.delete(index);
                }
              }}
              animate={{
                scale: isCurrent ? 1.02 : 1,
                opacity,
              }}
              transition={{
                duration: 0.35,
                ease: 'easeOut',
              }}
              style={{
                fontSize: isCurrent ? 14 : 12,
                fontWeight: isCurrent ? 700 : 400,
                color: isCurrent
                  ? 'var(--primary-color)'
                  : isPast
                    ? 'var(--text-tertiary)'
                    : 'var(--text-secondary)',
                lineHeight: 1.6,
                textAlign: 'center',
                cursor: onSeek ? 'pointer' : 'default',
                whiteSpace: 'nowrap',
                overflow: 'hidden',
                textOverflow: 'ellipsis',
                maxWidth: '100%',
                userSelect: 'none',
                transition: 'color 0.3s ease',
              }}
              onClick={() => handleLineClick(line)}
            >
              {line.text}
              {line.translation && (
                <div
                  style={{
                    fontSize: isCurrent ? 11 : 10,
                    fontWeight: 400,
                    color: isCurrent
                      ? 'var(--primary-light)'
                      : 'var(--text-tertiary)',
                    opacity: isCurrent ? 0.8 : 0.6,
                    marginTop: 1,
                  }}
                >
                  {line.translation}
                </div>
              )}
            </motion.div>
          );
        })}
      </div>
    </div>
  );
};

export default LyricsDisplay;
