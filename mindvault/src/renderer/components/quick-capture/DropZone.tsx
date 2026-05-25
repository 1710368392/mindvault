import React, { useState, useEffect, useCallback } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { Upload, Image, Mic, Video, FileText, X } from 'lucide-react';
import type { Creativity } from '@shared/types';

// ===== 类型定义 =====

interface DropZoneProps {
  onFilesDrop: (files: File[]) => void;
  children?: React.ReactNode;
}

interface FileTypeInfo {
  icon: React.ReactNode;
  label: string;
  accept: string[];
  type: Creativity['type'];
}

// ===== 支持的文件类型 =====

const FILE_TYPES: FileTypeInfo[] = [
  {
    icon: <Image size={24} />,
    label: '图片',
    accept: ['image/png', 'image/jpeg', 'image/gif', 'image/webp', 'image/svg+xml'],
    type: 'image',
  },
  {
    icon: <Mic size={24} />,
    label: '音频',
    accept: ['audio/mpeg', 'audio/wav', 'audio/ogg', 'audio/mp4', 'audio/webm'],
    type: 'audio',
  },
  {
    icon: <Video size={24} />,
    label: '视频',
    accept: ['video/mp4', 'video/webm', 'video/quicktime', 'video/x-msvideo'],
    type: 'video',
  },
  {
    icon: <FileText size={24} />,
    label: '文本',
    accept: ['text/plain', 'text/markdown', 'application/json', 'text/csv'],
    type: 'text',
  },
  {
    icon: <FileText size={24} />,
    label: '文档',
    accept: ['application/pdf'],
    type: 'document',
  },
];

// ===== 动画配置 =====

const overlayVariants = {
  hidden: { opacity: 0 },
  visible: { opacity: 1 },
  exit: { opacity: 0 },
};

const contentVariants = {
  hidden: { opacity: 0, scale: 0.95 },
  visible: {
    opacity: 1,
    scale: 1,
    transition: { type: 'spring', damping: 25, stiffness: 300 },
  },
  exit: {
    opacity: 0,
    scale: 0.95,
    transition: { duration: 0.15 },
  },
};

// ===== 工具函数 =====

function getFileTypeInfo(file: File): FileTypeInfo | null {
  for (const ft of FILE_TYPES) {
    if (ft.accept.includes(file.type)) return ft;
  }
  // 按扩展名判断
  const ext = file.name.split('.').pop()?.toLowerCase();
  if (['png', 'jpg', 'jpeg', 'gif', 'webp', 'svg'].includes(ext || '')) {
    return FILE_TYPES[0];
  }
  if (['mp3', 'wav', 'ogg', 'm4a', 'webm'].includes(ext || '')) {
    return FILE_TYPES[1];
  }
  if (['mp4', 'webm', 'mov', 'avi'].includes(ext || '')) {
    return FILE_TYPES[2];
  }
  if (['txt', 'md', 'json', 'csv'].includes(ext || '')) {
    return FILE_TYPES[3];
  }
  if (['pdf'].includes(ext || '')) {
    return FILE_TYPES[4];
  }
  return null;
}

// ===== 组件 =====

const DropZone: React.FC<DropZoneProps> = ({ onFilesDrop, children }) => {
  const [isDragging, setIsDragging] = useState(false);
  const [dragFiles, setDragFiles] = useState<File[]>([]);

  // 全局拖拽事件
  useEffect(() => {
    let dragCounter = 0;

    const handleDragEnter = (e: DragEvent) => {
      e.preventDefault();
      e.stopPropagation();
      dragCounter++;
      if (e.dataTransfer?.types.includes('Files')) {
        setIsDragging(true);
      }
    };

    const handleDragLeave = (e: DragEvent) => {
      e.preventDefault();
      e.stopPropagation();
      dragCounter--;
      if (dragCounter === 0) {
        setIsDragging(false);
        setDragFiles([]);
      }
    };

    const handleDragOver = (e: DragEvent) => {
      e.preventDefault();
      e.stopPropagation();
    };

    const handleDrop = (e: DragEvent) => {
      e.preventDefault();
      e.stopPropagation();
      dragCounter = 0;
      setIsDragging(false);

      const files = Array.from(e.dataTransfer?.files || []);
      if (files.length > 0) {
        setDragFiles(files);
      }
    };

    window.addEventListener('dragenter', handleDragEnter);
    window.addEventListener('dragleave', handleDragLeave);
    window.addEventListener('dragover', handleDragOver);
    window.addEventListener('drop', handleDrop);

    return () => {
      window.removeEventListener('dragenter', handleDragEnter);
      window.removeEventListener('dragleave', handleDragLeave);
      window.removeEventListener('dragover', handleDragOver);
      window.removeEventListener('drop', handleDrop);
    };
  }, []);

  // 确认导入
  const handleConfirm = useCallback(() => {
    if (dragFiles.length > 0) {
      onFilesDrop(dragFiles);
    }
    setDragFiles([]);
  }, [dragFiles, onFilesDrop]);

  // 取消
  const handleCancel = useCallback(() => {
    setDragFiles([]);
    setIsDragging(false);
  }, []);

  return (
    <>
      {children}

      {/* 拖拽覆盖层 */}
      <AnimatePresence>
        {isDragging && (
          <motion.div
            className="fixed inset-0 z-[200] flex items-center justify-center"
            variants={overlayVariants}
            initial="hidden"
            animate="visible"
            exit="exit"
          >
            {/* 背景 */}
            <motion.div
              className="absolute inset-0 bg-black/40 backdrop-blur-sm"
              variants={overlayVariants}
            />

            {/* 拖拽提示 */}
            <motion.div
              className="relative w-full max-w-md mx-4 p-8 bg-[var(--bg-secondary)] rounded-2xl shadow-2xl border-2 border-dashed border-[var(--primary-color)]"
              variants={contentVariants}
              initial="hidden"
              animate="visible"
              exit="exit"
            >
              {/* 关闭按钮 */}
              <button
                onClick={handleCancel}
                className="absolute top-3 right-3 p-1.5 rounded-lg hover:bg-[var(--bg-hover)] transition-colors text-[var(--text-secondary)]"
              >
                <X size={18} />
              </button>

              <div className="flex flex-col items-center text-center">
                <div className="w-16 h-16 rounded-2xl bg-[var(--primary-bg)] flex items-center justify-center mb-4">
                  <Upload size={32} className="text-[var(--primary-color)]" />
                </div>

                <h3 className="text-lg font-semibold text-[var(--text-primary)] mb-1">
                  释放以导入文件
                </h3>
                <p className="text-sm text-[var(--text-tertiary)] mb-4">
                  支持图片、音频、视频、文本和文档文件
                </p>

                {/* 文件列表 */}
                {dragFiles.length > 0 && (
                  <div className="w-full space-y-2 mb-4">
                    {dragFiles.map((file, i) => {
                      const info = getFileTypeInfo(file);
                      return (
                        <div
                          key={`${file.name}-${i}`}
                          className="flex items-center gap-3 px-3 py-2 rounded-lg bg-[var(--bg-primary)]"
                        >
                          <span className="text-[var(--text-secondary)]">
                            {info?.icon || <FileText size={18} />}
                          </span>
                          <div className="flex-1 min-w-0">
                            <p className="text-sm text-[var(--text-primary)] truncate">
                              {file.name}
                            </p>
                            <p className="text-[10px] text-[var(--text-tertiary)]">
                              {info?.label || '未知类型'} - {(file.size / 1024).toFixed(1)} KB
                            </p>
                          </div>
                        </div>
                      );
                    })}
                  </div>
                )}

                {/* 操作按钮 */}
                {dragFiles.length > 0 && (
                  <div className="flex items-center gap-2">
                    <button
                      onClick={handleCancel}
                      className="px-4 py-2 rounded-lg text-sm text-[var(--text-secondary)] hover:bg-[var(--bg-hover)] transition-colors"
                    >
                      取消
                    </button>
                    <button
                      onClick={handleConfirm}
                      className="px-4 py-2 rounded-lg text-sm bg-[var(--primary-color)] text-white hover:bg-[var(--primary-hover)] transition-colors"
                    >
                      导入 {dragFiles.length} 个文件
                    </button>
                  </div>
                )}
              </div>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>
    </>
  );
};

export default DropZone;
