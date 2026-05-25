import React from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { FileText, Image, Mic, Link as LinkIcon, Video, LucideIcon } from 'lucide-react';
import { useUIStore } from '../../stores/uiStore';

const typeIcons: Record<string, LucideIcon> = {
  text: FileText,
  image: Image,
  audio: Mic,
  link: LinkIcon,
  video: Video,
  document: FileText,
};

const DragOverlay: React.FC = () => {
  const isDraggingItem = useUIStore((s) => s.isDraggingItem);
  const dragItem = useUIStore((s) => s.dragItem);
  const dragPosition = useUIStore((s) => s.dragPosition);
  const dragOverTarget = useUIStore((s) => s.dragOverTarget);

  if (!isDraggingItem || !dragItem || !dragPosition) return null;

  const isOverTrash = dragOverTarget === '/trash';

  if (isOverTrash) {
    const IconComponent = typeIcons[dragItem.type] || FileText;
    return (
      <AnimatePresence>
        <motion.div
          key="poop-overlay"
          initial={{ opacity: 0, scale: 0.5 }}
          animate={{ opacity: 1, scale: 1.15 }}
          exit={{ opacity: 0, scale: 0.5 }}
          transition={{ duration: 0.2, type: 'spring', stiffness: 400, damping: 15 }}
          style={{
            position: 'fixed',
            left: dragPosition.x - 24,
            top: dragPosition.y - 24,
            zIndex: 99998,
            pointerEvents: 'none',
            display: 'flex',
            alignItems: 'center',
            gap: 8,
            padding: '8px 14px',
            borderRadius: 16,
            background: 'linear-gradient(135deg, #fff8e1, #ffe0b2)',
            border: '2px solid #e65100',
            boxShadow: '0 8px 24px rgba(230, 81, 0, 0.35), 0 2px 8px rgba(0,0,0,0.12), inset 0 1px 0 rgba(255,255,255,0.5)',
            maxWidth: 240,
            whiteSpace: 'nowrap',
            overflow: 'hidden',
            textOverflow: 'ellipsis',
          }}
        >
          <span style={{ fontSize: 28, lineHeight: 1, display: 'inline-block' }}>💩</span>
          <span style={{
            overflow: 'hidden',
            textOverflow: 'ellipsis',
            fontSize: 13,
            fontWeight: 700,
            color: '#bf360c',
            whiteSpace: 'nowrap',
          }}>{dragItem.title}</span>
        </motion.div>
      </AnimatePresence>
    );
  }

  const IconComponent = typeIcons[dragItem.type] || FileText;

  return (
    <AnimatePresence>
      {isDraggingItem && dragItem && dragPosition && (
        <motion.div
          initial={{ opacity: 0, scale: 0.8 }}
          animate={{ opacity: 1, scale: 1 }}
          exit={{ opacity: 0, scale: 0.8 }}
          transition={{ duration: 0.15 }}
          style={{
            position: 'fixed',
            left: dragPosition.x - 12,
            top: dragPosition.y - 12,
            zIndex: 99998,
            pointerEvents: 'none',
            display: 'flex',
            alignItems: 'center',
            gap: 8,
            padding: '6px 12px',
            borderRadius: 'var(--radius-md, 8px)',
            backgroundColor: 'var(--bg-secondary, #fff)',
            border: '1px solid var(--primary-color, #6c63ff)',
            boxShadow: '0 8px 24px rgba(108, 99, 255, 0.25), 0 2px 8px rgba(0,0,0,0.1)',
            maxWidth: 220,
            whiteSpace: 'nowrap',
            overflow: 'hidden',
            textOverflow: 'ellipsis',
            fontSize: 13,
            fontWeight: 500,
            color: 'var(--text-primary, #333)',
            transform: 'rotate(-2deg)',
          }}
        >
          <IconComponent size={14} color="var(--primary-color, #6c63ff)" style={{ flexShrink: 0 }} />
          <span style={{ overflow: 'hidden', textOverflow: 'ellipsis' }}>{dragItem.title}</span>
        </motion.div>
      )}
    </AnimatePresence>
  );
};

export default DragOverlay;
