import React, { useState, useEffect, useRef, useCallback } from 'react';
import { createPortal } from 'react-dom';
import { HashRouter, Routes, Route, Outlet, useLocation, useNavigate } from 'react-router-dom';
import Sidebar from './components/layout/Sidebar';
import Header from './components/layout/Header';
import QuickCapture from './components/quick-capture/QuickCapture';
import FloatingEditorManager from './components/FloatingEditorManager';
import DetachedBoardManager from './components/DetachedBoardManager';
import AboutDialog from './components/AboutDialog';
import ShortcutGuide from './components/ShortcutGuide';
import SearchDialog from './components/SearchDialog';
import CardPreview from './components/card/CardPreview';
import Home from './pages/Home';
import Board from './pages/Board';
import Search from './pages/Search';
import Templates from './pages/Templates';
import Settings from './pages/Settings';
import Export from './pages/Export';
import Trash from './pages/Trash';

import { useUIStore } from './stores/uiStore';
import { useCreativityStore } from './stores/creativityStore';
import { useSettingsStore } from './stores/settingsStore';
import { useMusicStore } from './stores/musicStore';
import { api } from './utils/api';
import { registerMediaPaths } from './utils/media';
import { useGlobalShortcuts } from './hooks/useKeyboardShortcuts';
import { applyFontSettingsToDOM } from './hooks/useTheme';
import { AnimatePresence, motion } from 'framer-motion';
import { Progress, Drawer, App as AntdApp } from 'antd';
import { playSound } from './utils/sound';
import { Upload, XCircle } from 'lucide-react';
import PrivacyLock from './components/PrivacyLock';
import AIFloatingBall from './components/ai/AIFloatingBall';
import AIChatMiniWindow from './components/ai/AIChatMiniWindow';
import AIChatFullscreen from './components/ai/AIChatFullscreen';
import AISelectionToolbar from './components/ai/AISelectionToolbar';
import AIContextMenu from './components/ai/AIContextMenu';
import DragOverlay from './components/common/DragOverlay';
import CustomCursor from './components/common/CustomCursor';
import Login from './pages/Login';
import { WeatherProvider } from './contexts/WeatherContext';
import GlobalNotificationCenter from './components/common/GlobalNotificationCenter';
import { BatchImportConfirmModal, type UploadedFileInfo, type BatchImportItem } from './components/batch-import';

/** 页面切换动画包装 */
const PageTransition: React.FC<{ children: React.ReactNode }> = ({ children }) => (
  <motion.div
    initial={{ opacity: 0, y: 8 }}
    animate={{ opacity: 1, y: 0 }}
    exit={{ opacity: 0, y: -8 }}
    transition={{ duration: 0.2, ease: 'easeOut' }}
    style={{ height: '100%', display: 'flex', flexDirection: 'column' }}
  >
    {children}
  </motion.div>
);

/** 文件类型映射 */
function getFileType(fileName: string): 'image' | 'video' | 'audio' | 'text' | 'link' | 'other' {
  const ext = fileName.split('.').pop()?.toLowerCase() || '';
  if (['jpg', 'jpeg', 'png', 'gif', 'webp', 'bmp', 'svg'].includes(ext)) return 'image';
  if (['mp4', 'webm', 'mov', 'avi', 'mkv'].includes(ext)) return 'video';
  if (['mp3', 'wav', 'ogg', 'flac', 'aac', 'm4a'].includes(ext)) return 'audio';
  if (['txt', 'md', 'markdown', 'json', 'csv', 'xml', 'html', 'log'].includes(ext)) return 'text';
  return 'other';
}

/** 嵌套布局组件 */
const Layout: React.FC = () => {
  useGlobalShortcuts();
  const navigate = useNavigate();
  const sidebarOpen = useUIStore((s) => s.sidebarOpen);
  const focusMode = useUIStore((s) => s.focusMode);
  const quickCaptureOpen = useUIStore((s) => s.quickCaptureOpen);
  const setQuickCaptureOpen = useUIStore((s) => s.setQuickCaptureOpen);
  const aboutDialogOpen = useUIStore((s) => s.aboutDialogOpen);
  const shortcutGuideOpen = useUIStore((s) => s.shortcutGuideOpen);
  const quickSettingsOpen = useUIStore((s) => s.quickSettingsOpen);
  const setQuickSettingsOpen = useUIStore((s) => s.setQuickSettingsOpen);
  const theme = useUIStore((s) => s.theme);
  const searchDialogOpen = useUIStore((s) => s.searchDialogOpen);
  const setAboutDialogOpen = useUIStore((s) => s.setAboutDialogOpen);
  const setShortcutGuideOpen = useUIStore((s) => s.setShortcutGuideOpen);
  const setSearchDialogOpen = useUIStore((s) => s.setSearchDialogOpen);
  const createCreativity = useCreativityStore((s) => s.createCreativity);
  const fetchCreativities = useCreativityStore((s) => s.fetchCreativities);
  const settings = useSettingsStore((s) => s.settings);
  const location = useLocation();

  const setSidebarOpen = useUIStore((s) => s.setSidebarOpen);

  // 全局拖拽状态
  const [isDragging, setIsDragging] = useState(false);
  const [dragFileCount, setDragFileCount] = useState(0);
  const dragCounterRef = useRef(0);

  // 批量导入函数引用（用于解决 useEffect 中访问 useCallback 函数的时序问题）
  const batchImportConfirmRef = useRef<(items: BatchImportItem[]) => Promise<number>>();

  const batchImportProgress = useUIStore(s => s.batchImportProgress);
  const setBatchImportProgress = useUIStore(s => s.setBatchImportProgress);
  const batchImportCancelledRef = useRef(false);
  const [searchPreviewItem, setSearchPreviewItem] = useState<any>(null);
  const [searchPreviewOpen, setSearchPreviewOpen] = useState(false);

  // 批量导入确认弹窗状态
  const [batchImportModalOpen, setBatchImportModalOpen] = useState(false);
  const [uploadedFilesForConfirm, setUploadedFilesForConfirm] = useState<UploadedFileInfo[]>([]);

  // 路由变化时播放音效
  const prevPathRef = useRef(location.pathname);
  useEffect(() => {
    if (prevPathRef.current !== location.pathname) {
      if (settings.soundEnabled) {
        playSound('navigate', settings.soundVolume);
      }
      prevPathRef.current = location.pathname;
    }
  }, [location.pathname, settings.soundEnabled, settings.soundVolume]);

  // 全局拖拽处理
  useEffect(() => {
    const handleDragEnter = (e: DragEvent) => {
      // 始终阻止默认行为
      e.preventDefault();
      e.stopPropagation();
      
      console.log('[App] handleDragEnter', e.dataTransfer?.types);
      
      // 检查是否包含文件（Files）或文件路径（text/uri-list）
      const types = e.dataTransfer?.types || [];
      const hasFiles = types.includes('Files') || types.some(t => t.toLowerCase() === 'files');
      const hasUriList = types.includes('text/uri-list');
      const hasPlainText = types.includes('text/plain');
      
      console.log('[App] Drag types check:', { hasFiles, hasUriList, hasPlainText, allTypes: types });
      
      // 只有纯文本（没有文件）时不显示拖拽遮罩
      if (hasPlainText && !hasFiles && !hasUriList) return;
      
      dragCounterRef.current++;
      if (hasFiles || hasUriList) {
        console.log('[App] Setting isDragging to true');
        setIsDragging(true);
        setDragFileCount(e.dataTransfer?.items?.length || 1);
      }
    };

    const handleDragOver = (e: DragEvent) => {
      // 始终阻止默认行为，这是允许拖放的必要条件
      e.preventDefault();
      e.stopPropagation();
      
      // 检查是否包含文件（Files）或文件路径（text/uri-list）
      const types = e.dataTransfer?.types || [];
      const hasFiles = types.includes('Files') || types.some(t => t.toLowerCase() === 'files');
      const hasUriList = types.includes('text/uri-list');
      const hasPlainText = types.includes('text/plain');
      
      // 设置拖放效果：有文件时显示复制，否则显示无操作
      if (e.dataTransfer) {
        if (hasFiles || hasUriList) {
          e.dataTransfer.dropEffect = 'copy';
        } else if (hasPlainText) {
          e.dataTransfer.dropEffect = 'none';
        } else {
          // 对于未知类型，也允许复制（可能是某些浏览器的特殊格式）
          e.dataTransfer.dropEffect = 'copy';
        }
      }
    };

    const handleDragLeave = (e: DragEvent) => {
      // 始终阻止默认行为
      e.preventDefault();
      e.stopPropagation();
      
      // 检查是否包含文件（Files）或文件路径（text/uri-list）
      const types = e.dataTransfer?.types || [];
      const hasFiles = types.includes('Files') || types.some(t => t.toLowerCase() === 'files');
      const hasUriList = types.includes('text/uri-list');
      const hasPlainText = types.includes('text/plain');
      
      // 只有纯文本（没有文件）时不处理
      if (hasPlainText && !hasFiles && !hasUriList) return;
      
      dragCounterRef.current--;
      if (dragCounterRef.current <= 0) {
        dragCounterRef.current = 0;
        setIsDragging(false);
      }
    };

    const handleDrop = async (e: DragEvent) => {
      // 始终阻止默认行为
      e.preventDefault();
      e.stopPropagation();
      
      console.log('[App] handleDrop triggered', e.dataTransfer?.types, e.dataTransfer?.files);
      
      // 检查是否包含文件（Files）或文件路径（text/uri-list）
      const types = e.dataTransfer?.types || [];
      const hasFiles = types.includes('Files') || types.some(t => t.toLowerCase() === 'files');
      const hasUriList = types.includes('text/uri-list');
      const hasPlainText = types.includes('text/plain');
      
      console.log('[App] hasFiles:', hasFiles, 'hasUriList:', hasUriList, 'hasPlainText:', hasPlainText);
      
      // 只有纯文本（没有文件）时不处理
      if (hasPlainText && !hasFiles && !hasUriList) return;
      
      dragCounterRef.current = 0;
      setIsDragging(false);

      const dropTarget = e.target as HTMLElement;
      // 排除特定区域：卡片预览弹窗、编辑器区域、画布区域、侧边栏快速捕获按钮
      const isInCardPreview = dropTarget?.closest?.('.card-preview-modal');
      const isInCardEditor = dropTarget?.closest?.('.card-editor-area, .ql-editor, .md-editor, [contenteditable]');
      const isInCanvas = dropTarget?.closest?.('.canvas-container, .canvas-view');
      const isInSidebar = dropTarget?.closest?.('.sidebar-quick-capture, .sidebar-container');
      if (isInCardPreview || isInCardEditor || isInCanvas || isInSidebar) {
        console.log('[App] Drop in excluded area, skipping');
        return;
      }

      if (!hasFiles && !hasUriList) {
        console.log('[App] No files in drop, skipping');
        return;
      }

      const files = Array.from(e.dataTransfer?.files || []);
      console.log('[App] Dropped files:', files.length, files.map(f => f.name));
      if (files.length === 0) {
        console.log('[App] No files found, trying to get from dataTransfer data');
        // 尝试从 text/uri-list 获取文件路径
        const uriList = e.dataTransfer?.getData('text/uri-list');
        console.log('[App] uri-list:', uriList);
      }
      if (files.length === 0) return;

      if (settings.soundEnabled) {
        playSound('drop', settings.soundVolume);
      }

      const getFileType = (fileName: string): string => {
        const ext = fileName.split('.').pop()?.toLowerCase() || '';
        if (['png', 'jpg', 'jpeg', 'gif', 'webp', 'bmp', 'svg'].includes(ext)) return 'image';
        if (['mp4', 'webm', 'mov', 'avi', 'mkv'].includes(ext)) return 'video';
        if (['mp3', 'wav', 'ogg', 'flac', 'aac', 'm4a'].includes(ext)) return 'audio';
        if (['txt', 'md', 'markdown', 'json', 'csv', 'xml', 'html', 'log'].includes(ext)) return 'text';
        return 'text';
      };

      // 为图片/视频文件生成缩略图 URL
      const generateThumbnailUrl = async (file: File): Promise<string | undefined> => {
        // 图片直接返回 blob URL
        if (file.type.startsWith('image/')) {
          return URL.createObjectURL(file);
        }

        // 视频截取第一帧
        if (file.type.startsWith('video/')) {
          return new Promise((resolve) => {
            const video = document.createElement('video');
            video.preload = 'metadata';
            video.muted = true;
            video.playsInline = true;

            const timeout = setTimeout(() => {
              URL.revokeObjectURL(video.src);
              resolve(undefined);
            }, 5000);

            video.onloadeddata = () => {
              clearTimeout(timeout);
              try {
                // 跳转到第一帧
                video.currentTime = 0;
              } catch (e) {
                URL.revokeObjectURL(video.src);
                resolve(undefined);
              }
            };

            video.onseeked = () => {
              clearTimeout(timeout);
              try {
                // 创建 canvas 截取当前帧
                const canvas = document.createElement('canvas');
                const ctx = canvas.getContext('2d');
                if (!ctx) {
                  URL.revokeObjectURL(video.src);
                  resolve(undefined);
                  return;
                }

                // 限制缩略图尺寸（保持原始分辨率，最大 2048px）
                const maxSize = 2048;
                let width = video.videoWidth;
                let height = video.videoHeight;
                if (width > height) {
                  if (width > maxSize) {
                    height = Math.round((height / width) * maxSize);
                    width = maxSize;
                  }
                } else {
                  if (height > maxSize) {
                    width = Math.round((width / height) * maxSize);
                    height = maxSize;
                  }
                }

                canvas.width = width;
                canvas.height = height;
                ctx.drawImage(video, 0, 0, width, height);

                // 转换为 blob URL
                canvas.toBlob((blob) => {
                  URL.revokeObjectURL(video.src);
                  if (blob) {
                    resolve(URL.createObjectURL(blob));
                  } else {
                    resolve(undefined);
                  }
                }, 'image/jpeg', 0.8);
              } catch (e) {
                URL.revokeObjectURL(video.src);
                resolve(undefined);
              }
            };

            video.onerror = () => {
              clearTimeout(timeout);
              URL.revokeObjectURL(video.src);
              resolve(undefined);
            };

            video.src = URL.createObjectURL(file);
          });
        }

        return undefined;
      };

      // 准备上传文件信息（逐条生成缩略图，避免大批量卡顿），并进行去重
      setBatchImportProgress({ visible: true, current: 0, total: files.length, fileName: '准备中...' });
      batchImportCancelledRef.current = false;
      const uploadedFiles: UploadedFileInfo[] = [];
      const seenFiles = new Set<string>();
      const yieldToMain = () => new Promise(resolve => setTimeout(resolve, 0));

      for (let i = 0; i < files.length; i++) {
        if (batchImportCancelledRef.current) break;
        const file = files[i];
        
        // 去重：使用文件名+文件大小作为唯一标识
        const fileKey = `${file.name}-${file.size}`;
        if (seenFiles.has(fileKey)) {
          console.log('[App] 跳过重复文件:', file.name);
          continue;
        }
        seenFiles.add(fileKey);
        
        setBatchImportProgress({ visible: true, current: uploadedFiles.length + 1, total: files.length, fileName: file.name });
        await yieldToMain();

        uploadedFiles.push({
          id: `upload-${Date.now()}-${uploadedFiles.length}`,
          file,
          fileName: file.name,
          fileSize: file.size,
          fileType: file.type,
          status: 'completed',
          uploadProgress: 100,
          thumbnailUrl: await generateThumbnailUrl(file),
        });
      }

      setBatchImportProgress({ visible: false, current: 0, total: 0, fileName: '' });

      if (batchImportCancelledRef.current || uploadedFiles.length === 0) return;

      // 打开批量导入确认弹窗
      console.log('[App] Opening batch import confirm modal with', uploadedFiles.length, 'files');
      setUploadedFilesForConfirm(uploadedFiles);
      setBatchImportModalOpen(true);
    };

    // 全局粘贴事件：检测文件粘贴时打开批量导入确认弹窗
    const handlePaste = async (e: ClipboardEvent) => {
      const items = e.clipboardData?.items;
      if (!items) return;

      // 检查是否有文件类型的数据
      const fileItems: File[] = [];
      for (let i = 0; i < items.length; i++) {
        // 检查文件类型
        if (items[i].kind === 'file') {
          const file = items[i].getAsFile();
          if (file) fileItems.push(file);
        }
      }

      // 如果没有文件，不处理（让文本粘贴正常工作）
      if (fileItems.length === 0) return;

      // 检查是否在编辑器内（编辑器内的粘贴由各自组件处理）
      const activeEl = document.activeElement as HTMLElement;
      const isInEditor = activeEl?.closest?.('.card-editor-area, .ql-editor, .md-editor, [contenteditable], .ant-input, textarea');
      if (isInEditor) return;

      e.preventDefault();

      // 为图片/视频文件生成缩略图 URL
      const generateThumbnailUrl = async (file: File): Promise<string | undefined> => {
        // 图片直接返回 blob URL
        if (file.type.startsWith('image/')) {
          return URL.createObjectURL(file);
        }

        // 视频截取第一帧
        if (file.type.startsWith('video/')) {
          return new Promise((resolve) => {
            const video = document.createElement('video');
            video.preload = 'metadata';
            video.muted = true;
            video.playsInline = true;

            const timeout = setTimeout(() => {
              URL.revokeObjectURL(video.src);
              resolve(undefined);
            }, 5000);

            video.onloadeddata = () => {
              clearTimeout(timeout);
              try {
                video.currentTime = 0;
              } catch (e) {
                URL.revokeObjectURL(video.src);
                resolve(undefined);
              }
            };

            video.onseeked = () => {
              clearTimeout(timeout);
              try {
                const canvas = document.createElement('canvas');
                const ctx = canvas.getContext('2d');
                if (!ctx) {
                  URL.revokeObjectURL(video.src);
                  resolve(undefined);
                  return;
                }

                // 限制缩略图尺寸（保持原始分辨率，最大 2048px）
                const maxSize = 2048;
                let width = video.videoWidth;
                let height = video.videoHeight;
                if (width > height) {
                  if (width > maxSize) {
                    height = Math.round((height / width) * maxSize);
                    width = maxSize;
                  }
                } else {
                  if (height > maxSize) {
                    width = Math.round((width / height) * maxSize);
                    height = maxSize;
                  }
                }

                canvas.width = width;
                canvas.height = height;
                ctx.drawImage(video, 0, 0, width, height);

                canvas.toBlob((blob) => {
                  URL.revokeObjectURL(video.src);
                  if (blob) {
                    resolve(URL.createObjectURL(blob));
                  } else {
                    resolve(undefined);
                  }
                }, 'image/jpeg', 0.8);
              } catch (e) {
                URL.revokeObjectURL(video.src);
                resolve(undefined);
              }
            };

            video.onerror = () => {
              clearTimeout(timeout);
              URL.revokeObjectURL(video.src);
              resolve(undefined);
            };

            video.src = URL.createObjectURL(file);
          });
        }

        return undefined;
      };

      // 逐条生成缩略图，避免大批量卡顿，并进行去重
      setBatchImportProgress({ visible: true, current: 0, total: fileItems.length, fileName: '准备中...' });
      batchImportCancelledRef.current = false;
      const uploadedFiles: UploadedFileInfo[] = [];
      const seenFiles = new Set<string>();
      const yieldToMain = () => new Promise(resolve => setTimeout(resolve, 0));

      for (let i = 0; i < fileItems.length; i++) {
        if (batchImportCancelledRef.current) break;
        const file = fileItems[i];
        
        // 去重：使用文件名+文件大小作为唯一标识
        const fileKey = `${file.name}-${file.size}`;
        if (seenFiles.has(fileKey)) {
          console.log('[App] 跳过重复文件:', file.name);
          continue;
        }
        seenFiles.add(fileKey);
        
        setBatchImportProgress({ visible: true, current: uploadedFiles.length + 1, total: fileItems.length, fileName: file.name });
        await yieldToMain();

        uploadedFiles.push({
          id: `paste-${Date.now()}-${uploadedFiles.length}`,
          file,
          fileName: file.name,
          fileSize: file.size,
          fileType: file.type,
          status: 'completed',
          uploadProgress: 100,
          thumbnailUrl: await generateThumbnailUrl(file),
        });
      }

      setBatchImportProgress({ visible: false, current: 0, total: 0, fileName: '' });

      if (batchImportCancelledRef.current || uploadedFiles.length === 0) return;

      // 打开批量导入确认弹窗
      console.log('[App] Opening batch import confirm modal for pasted files');
      setUploadedFilesForConfirm(uploadedFiles);
      setBatchImportModalOpen(true);
    };

    // 在 window 级别添加事件监听器，确保能够捕获到所有拖放事件
    window.addEventListener('dragenter', handleDragEnter, true);
    window.addEventListener('dragover', handleDragOver, true);
    window.addEventListener('dragleave', handleDragLeave, true);
    window.addEventListener('drop', handleDrop, true);
    window.addEventListener('paste', handlePaste, true);

    // 监听来自其他组件的批量导入请求（如 Sidebar 右键导入）
    const handleBatchImportRequest = async (e: Event) => {
      const customEvent = e as CustomEvent<Array<{ path: string; name: string }>>;
      const filesWithInfo = customEvent.detail;
      if (!filesWithInfo || filesWithInfo.length === 0) return;

      console.log('[App] batch-import-request received, files:', filesWithInfo.length);

      const VIDEO_EXTS = ['.mp4', '.webm', '.avi', '.mov', '.mkv', '.wmv', '.flv'];
      const IMAGE_EXTS = ['.png', '.jpg', '.jpeg', '.gif', '.bmp', '.webp', '.svg', '.ico'];
      const AUDIO_EXTS = ['.mp3', '.wav', '.ogg', '.flac', '.aac', '.m4a'];
      const SUPPORTED_MEDIA_EXTS = [...VIDEO_EXTS, ...IMAGE_EXTS, ...AUDIO_EXTS];

      const getFileExt = (filePath: string) => {
        const dotIndex = filePath.lastIndexOf('.');
        return dotIndex >= 0 ? filePath.substring(dotIndex).toLowerCase() : '';
      };

      const getFileType = (ext: string) => {
        if (IMAGE_EXTS.includes(ext)) return `image/${ext.replace('.', '')}`;
        if (VIDEO_EXTS.includes(ext)) return `video/${ext.replace('.', '')}`;
        if (AUDIO_EXTS.includes(ext)) return `audio/${ext.replace('.', '')}`;
        if (ext === '.pdf') return 'application/pdf';
        return 'application/octet-stream';
      };

      // 判断是否为支持的媒体文件
      const isSupportedMedia = (ext: string) => SUPPORTED_MEDIA_EXTS.includes(ext);

      // 获取文件类型的显示名称
      const getFileTypeDisplay = (ext: string) => {
        if (IMAGE_EXTS.includes(ext)) return 'image';
        if (VIDEO_EXTS.includes(ext)) return 'video';
        if (AUDIO_EXTS.includes(ext)) return 'audio';
        if (ext === '.pdf') return 'pdf';
        return 'other';
      };

      // 视频缩略图生成：使用 local-media:// 完整文件流
      const generateVideoThumbnail = (src: string, fileName: string): Promise<string | undefined> => {
        return new Promise((resolve) => {
          const video = document.createElement('video');
          video.preload = 'metadata'; // 先只加载元数据，更快
          video.muted = true;
          video.playsInline = true;
          video.crossOrigin = 'anonymous';

          let resolved = false;
          const doResolve = (result: string | undefined) => {
            if (!resolved) { resolved = true; resolve(result); }
          };

          const timeout = setTimeout(() => doResolve(undefined), 30000); // 增加超时时间

          video.onloadedmetadata = () => {
            console.log('[App] Video metadata loaded for', fileName, 'duration:', video.duration, 'dimensions:', video.videoWidth, 'x', video.videoHeight);
            try {
              // 尝试多个不同的时间点，提高成功率
              const seekPositions = [0.1, 0.5, 1, 2, 0];
              let currentSeekIndex = 0;
              
              const trySeek = () => {
                if (currentSeekIndex >= seekPositions.length) {
                  // 所有尝试都失败了
                  doResolve(undefined);
                  return;
                }
                const position = seekPositions[currentSeekIndex];
                currentSeekIndex++;
                // 确保在视频时长范围内
                if (video.duration && !isNaN(video.duration)) {
                  const safePosition = Math.min(position, Math.max(0, video.duration - 0.1));
                  console.log('[App] Trying seek to', safePosition, 'for', fileName);
                  video.currentTime = safePosition;
                } else {
                  video.currentTime = position;
                }
              };
              
              video.onseeked = () => {
                clearTimeout(timeout);
                try {
                  // 检查视频尺寸是否有效
                  if ((!video.videoWidth || video.videoWidth <= 0) && (!video.videoHeight || video.videoHeight <= 0)) {
                    console.log('[App] Invalid video dimensions, trying next seek position');
                    trySeek();
                    return;
                  }
                  
                  const canvas = document.createElement('canvas');
                  const maxSize = 2048;
                  let w = video.videoWidth || 640;
                  let h = video.videoHeight || 360;
                  if (w > h) { if (w > maxSize) { h = Math.round((h / w) * maxSize); w = maxSize; } }
                  else { if (h > maxSize) { w = Math.round((w / h) * maxSize); h = maxSize; } }
                  canvas.width = w;
                  canvas.height = h;
                  const ctx = canvas.getContext('2d');
                  if (ctx) {
                    ctx.drawImage(video, 0, 0, w, h);
                  }
                  canvas.toBlob((blob) => {
                    if (blob && blob.size > 0) {
                      doResolve(URL.createObjectURL(blob));
                    } else {
                      console.log('[App] Canvas toBlob failed, trying next seek position');
                      trySeek();
                    }
                  }, 'image/jpeg', 0.85);
                } catch (e) {
                  console.error('[App] Error drawing video frame for', fileName, e);
                  trySeek();
                }
              };
              
              trySeek();
            } catch (e) {
              console.error('[App] Error in video onloadedmetadata for', fileName, e);
              doResolve(undefined);
            }
          };

          video.onerror = (e) => { 
            console.error('[App] Video error for', fileName, e);
            clearTimeout(timeout); 
            doResolve(undefined); 
          };
          video.src = src;
        });
      };

      // 图片缩略图生成
      const generateImageThumbnail = (src: string): Promise<string | undefined> => {
        return new Promise((resolve) => {
          const img = new Image();
          img.crossOrigin = 'anonymous';
          const timeout = setTimeout(() => {
            console.warn('[App] Image thumbnail timeout for', src);
            resolve(undefined);
          }, 15000);
          img.onload = () => {
            clearTimeout(timeout);
            try {
              console.log('[App] Image loaded successfully, dimensions:', img.naturalWidth, 'x', img.naturalHeight);
              const canvas = document.createElement('canvas');
              const maxSize = 2048;
              let w = img.naturalWidth || 640;
              let h = img.naturalHeight || 480;
              if (w <= 0) w = 640;
              if (h <= 0) h = 480;
              if (w > h) { if (w > maxSize) { h = Math.round((h / w) * maxSize); w = maxSize; } }
              else { if (h > maxSize) { w = Math.round((w / h) * maxSize); h = maxSize; } }
              canvas.width = w;
              canvas.height = h;
              const ctx = canvas.getContext('2d');
              if (ctx) {
                ctx.drawImage(img, 0, 0, w, h);
              }
              canvas.toBlob((blob) => {
                if (blob && blob.size > 0) {
                  resolve(URL.createObjectURL(blob));
                } else {
                  console.warn('[App] Image canvas toBlob failed');
                  resolve(undefined);
                }
              }, 'image/jpeg', 0.85);
            } catch (e) { 
              console.error('[App] Error generating image thumbnail', e);
              resolve(undefined); 
            }
          };
          img.onerror = (e) => { 
            console.error('[App] Image load error for', src, e);
            clearTimeout(timeout); 
            resolve(undefined); 
          };
          img.src = src;
        });
      };

      // 显示全局进度条
      console.log('[App] Showing progress bar for', filesWithInfo.length, 'files');
      setBatchImportProgress({
        visible: true,
        current: 0,
        total: filesWithInfo.length,
        fileName: '准备中...',
      });
      batchImportCancelledRef.current = false;
      console.log('[App] Progress bar state set to visible');

      // 逐个处理文件，避免并行卡顿，每处理完一个让出主线程，并进行去重
      const uploadedFiles: UploadedFileInfo[] = [];
      const seenFiles = new Set<string>();
      const yieldToMain = () => new Promise(resolve => setTimeout(resolve, 0));

      for (let i = 0; i < filesWithInfo.length; i++) {
        if (batchImportCancelledRef.current) break;
        const info = filesWithInfo[i];
        
        // 去重：使用文件路径作为唯一标识
        const fileKey = info.path;
        if (seenFiles.has(fileKey)) {
          console.log('[App] 跳过重复文件:', info.name);
          continue;
        }
        seenFiles.add(fileKey);
        
        const ext = getFileExt(info.path);
        let fileType = getFileType(ext);
        let fileSize = 0;
        let thumbnailUrl: string | undefined;

        // 更新进度
        setBatchImportProgress({
          visible: true,
          current: uploadedFiles.length + 1,
          total: filesWithInfo.length,
          fileName: info.name,
        });

        // 让出主线程，确保 UI 更新
        await yieldToMain();

        try {
          // 获取文件大小
          try {
            const fileInfo = await api.media.getFileInfo(info.path);
            if (fileInfo) fileSize = fileInfo.fileSize || 0;
          } catch (e) { /* ignore */ }

          // 检查是否为支持的媒体文件
          if (!isSupportedMedia(ext)) {
            console.log('[App] 跳过不支持的文件类型:', info.name, '类型:', getFileTypeDisplay(ext));
            // 对于不支持的文件，不生成缩略图，直接标记为 other 类型
            fileType = 'other';
          } else if (fileSize > 500 * 1024 * 1024) {
            // 跳过大于 500MB 的文件（避免内存溢出）
            console.log('[App] 跳过大文件:', info.name, '大小:', (fileSize / 1024 / 1024).toFixed(2), 'MB');
          } else {
            // 生成缩略图（仅对图片和视频）
            if (IMAGE_EXTS.includes(ext) || VIDEO_EXTS.includes(ext)) {
              // 方法 1：尝试用 base64 方式
              let success = false;
              try {
                console.log('[App] 尝试用 base64 方式读取:', info.name);
                const result = await api.media.readFileAsBase64(info.path);
                if (result && result.data) {
                  // base64 转 Blob
                  const [header, body] = result.data.split(',');
                  const mimeType = header.match(/:(.*?);/)?.[1] || 'application/octet-stream';
                  const binaryString = atob(body);
                  const bytes = new Uint8Array(binaryString.length);
                  for (let j = 0; j < binaryString.length; j++) {
                    bytes[j] = binaryString.charCodeAt(j);
                  }
                  const blob = new Blob([bytes], { type: mimeType });
                  const blobUrl = URL.createObjectURL(blob);

                  // 用和粘贴/拖拽完全一样的方式生成缩略图！
                  if (IMAGE_EXTS.includes(ext)) {
                    thumbnailUrl = await generateImageThumbnail(blobUrl);
                  } else if (VIDEO_EXTS.includes(ext)) {
                    thumbnailUrl = await generateVideoThumbnail(blobUrl, info.name);
                  }
                  success = !!thumbnailUrl;
                  console.log('[App] base64 方式结果:', info.name, 'success:', success);
                }
              } catch (err) {
                console.error('[App] base64 方式失败:', info.name, err);
              }

              // 方法 2：如果方法 1 失败，回退到原来的 local-media 方式
              if (!success) {
                try {
                  console.log('[App] 回退到 local-media 方式:', info.name);
                  const normalizedPath = info.path.replace(/\\/g, '/');
                  const mediaUrl = 'local-media:///' + encodeURI(normalizedPath) + '?allow=true';

                  if (IMAGE_EXTS.includes(ext)) {
                    thumbnailUrl = await generateImageThumbnail(mediaUrl);
                  } else if (VIDEO_EXTS.includes(ext)) {
                    thumbnailUrl = await generateVideoThumbnail(mediaUrl, info.name);
                  }
                  console.log('[App] local-media 方式结果:', info.name, 'success:', !!thumbnailUrl);
                } catch (err2) {
                  console.error('[App] local-media 方式也失败:', info.name, err2);
                }
              }
            }
          }
        } catch (err) {
          console.error('[App] Error processing file:', info.name, err);
        }

        uploadedFiles.push({
          id: `import-${Date.now()}-${uploadedFiles.length}`,
          filePath: info.path,
          fileName: info.name,
          fileSize,
          fileType,
          thumbnailUrl,
          status: 'completed' as const,
          uploadProgress: 100,
        });
      }

      // 隐藏进度条，打开弹窗
      setBatchImportProgress({ visible: false, current: 0, total: 0, fileName: '' });

      if (batchImportCancelledRef.current || uploadedFiles.length === 0) return;

      setUploadedFilesForConfirm(uploadedFiles);
      setBatchImportModalOpen(true);
    };

    // 监听来自 Sidebar 等组件的拖拽文件导入（File 对象）
    const handleBatchImportDrop = (e: Event) => {
      const customEvent = e as CustomEvent<File[]>;
      const files = customEvent.detail;
      if (!files || files.length === 0) return;
      
      // 去重：使用文件名+文件大小作为唯一标识
      const seenFiles = new Set<string>();
      const uploadedFiles: UploadedFileInfo[] = [];
      
      for (let i = 0; i < files.length; i++) {
        const file = files[i];
        const fileKey = `${file.name}-${file.size}`;
        if (seenFiles.has(fileKey)) {
          console.log('[App] 跳过重复文件:', file.name);
          continue;
        }
        seenFiles.add(fileKey);
        
        uploadedFiles.push({
          id: `drop-${Date.now()}-${uploadedFiles.length}`,
          file,
          fileName: file.name,
          fileSize: file.size,
          fileType: file.type,
          status: 'completed',
          uploadProgress: 100,
        });
      }
      
      if (uploadedFiles.length === 0) return;

      // 打开批量导入确认弹窗
      console.log('[App] Opening batch import confirm modal for component drop');
      setUploadedFilesForConfirm(uploadedFiles);
      setBatchImportModalOpen(true);
    };
    window.addEventListener('batch-import-request', handleBatchImportRequest);
    window.addEventListener('batch-import-drop', handleBatchImportDrop);

    // 监听来自主进程的 IPC 拖放事件（Windows 管理员权限修复）
    let unsubscribeDragDrop: (() => void) | null = null;
    if (window.electronAPI?.dragDrop?.onFilesDropped) {
      unsubscribeDragDrop = window.electronAPI.dragDrop.onFilesDropped((filePaths: string[]) => {
        console.log('[App] Received files from main process via IPC:', filePaths);
        if (filePaths && filePaths.length > 0) {
          // 去重：使用文件路径作为唯一标识
          const seenFiles = new Set<string>();
          const uploadedFiles: UploadedFileInfo[] = [];
          
          for (let i = 0; i < filePaths.length; i++) {
            const filePath = filePaths[i];
            if (seenFiles.has(filePath)) {
              console.log('[App] 跳过重复文件:', filePath);
              continue;
            }
            seenFiles.add(filePath);
            
            uploadedFiles.push({
              id: `ipc-drop-${Date.now()}-${uploadedFiles.length}`,
              file: undefined, // IPC 方式没有 File 对象
              fileName: filePath.split(/[\\/]/).pop() || filePath,
              fileSize: 0,
              fileType: '',
              filePath: filePath,
              status: 'completed',
              uploadProgress: 100,
            });
          }
          
          if (uploadedFiles.length === 0) return;

          // 打开批量导入确认弹窗
          console.log('[App] Opening batch import confirm modal for IPC drop');
          setUploadedFilesForConfirm(uploadedFiles);
          setBatchImportModalOpen(true);
        }
      });
    }

    return () => {
      window.removeEventListener('dragenter', handleDragEnter, true);
      window.removeEventListener('dragover', handleDragOver, true);
      window.removeEventListener('dragleave', handleDragLeave, true);
      window.removeEventListener('drop', handleDrop, true);
      window.removeEventListener('paste', handlePaste, true);
      window.removeEventListener('batch-import-request', handleBatchImportRequest);
      window.removeEventListener('batch-import-drop', handleBatchImportDrop);
      unsubscribeDragDrop?.();
    };
  }, [settings.soundEnabled, settings.soundVolume, setQuickCaptureOpen, createCreativity]);

  // 全局拖拽视觉反馈
  useEffect(() => {
    const handleDragStart = (e: DragEvent) => {
      const target = e.target as HTMLElement;
      if (target.closest('[draggable="true"]')) {
        target.setAttribute('data-dragging', 'true');
      }
    };
    const handleDragEnd = (e: DragEvent) => {
      const target = e.target as HTMLElement;
      target.removeAttribute('data-dragging');
      document.querySelectorAll('[data-dragging="true"]').forEach(el => el.removeAttribute('data-dragging'));
    };
    document.addEventListener('dragstart', handleDragStart);
    document.addEventListener('dragend', handleDragEnd);
    return () => {
      document.removeEventListener('dragstart', handleDragStart);
      document.removeEventListener('dragend', handleDragEnd);
    };
  }, []);

  // 自定义拖拽项时添加body样式
  const isDraggingItem = useUIStore((s) => s.isDraggingItem);
  const updateDragPosition = useUIStore((s) => s.updateDragPosition);
  useEffect(() => {
    if (isDraggingItem) {
      document.body.classList.add('is-dragging-item');
    } else {
      document.body.classList.remove('is-dragging-item');
    }
    return () => { document.body.classList.remove('is-dragging-item'); };
  }, [isDraggingItem]);

  useEffect(() => {
    if (!isDraggingItem) return;
    const handleMouseMove = (e: MouseEvent) => {
      updateDragPosition({ x: e.clientX, y: e.clientY });
    };
    document.addEventListener('mousemove', handleMouseMove);
    return () => document.removeEventListener('mousemove', handleMouseMove);
  }, [isDraggingItem, updateDragPosition]);

  // 安全网：全局mouseup确保拖拽状态不会卡住
  // 组件级的onMouseUp会先执行并调用endDrag，如果isDraggingItem仍为true说明没有组件处理
  useEffect(() => {
    const handleGlobalMouseUp = async () => {
      await new Promise(r => requestAnimationFrame(r));
      const state = useUIStore.getState();
      if (!state.isDraggingItem) return;
      const target = state.dragOverTarget;
      const item = state.dragItem;
      if (target && item) {
        try {
          const { api } = await import('./utils/api');
          if (target === '/favorites') {
            const detail = await api.creativity.read(item.id);
            if (detail && (detail.isFavorite || detail.is_favorite === 1)) {
              useUIStore.getState().showToast('warning', '该创意已在收藏中');
            } else {
              await api.creativity.toggleFavorite(item.id);
              useUIStore.getState().showToast('success', '已收藏');
            }
          } else if (target === '/trash') {
            await api.creativity.delete(item.id);
          } else if (target.startsWith('/board/')) {
            const { useBoardStore } = await import('./stores/boardStore');
            const boardId = target.replace('/board/', '');
            const boards = useBoardStore.getState().boards;
            const board = boards.find((b: any) => b.id === boardId);
            if (board?.folders?.length > 0) {
              await api.board.folder.addItems(board.folders[0].id, [item.id]);
            }
          }
        } catch (err) {
          console.error('Drop action failed:', err);
        }
      }
      state.endDrag();
      document.body.style.userSelect = '';
      document.body.style.cursor = '';
    };
    document.addEventListener('mouseup', handleGlobalMouseUp);
    return () => document.removeEventListener('mouseup', handleGlobalMouseUp);
  }, []);

  // ESC键取消拖拽
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape' && useUIStore.getState().isDraggingItem) {
        useUIStore.getState().endDrag();
        document.body.style.userSelect = '';
        document.body.style.cursor = '';
      }
    };
    document.addEventListener('keydown', handleKeyDown);
    return () => document.removeEventListener('keydown', handleKeyDown);
  }, []);

  // 菜单 IPC 事件监听
  useEffect(() => {
    if (!window.electronAPI?.onMenuEvent) return;

    const cleanups: Array<() => void> = [];

    cleanups.push(window.electronAPI.onMenuEvent('menu:new-creativity', () => {
      setQuickCaptureOpen(true);
    }));

    cleanups.push(window.electronAPI.onMenuEvent('menu:export', () => {
      navigate('/export');
    }));

    cleanups.push(window.electronAPI.onMenuEvent('menu:import', () => {
      navigate('/export');
    }));

    cleanups.push(window.electronAPI.onMenuEvent('menu:search', () => {
      setSearchDialogOpen(true);
    }));

    cleanups.push(window.electronAPI.onMenuEvent('menu:quick-capture', () => {
      setQuickCaptureOpen(true);
    }));

    cleanups.push(window.electronAPI.onMenuEvent('menu:shortcuts', () => {
      setShortcutGuideOpen(true);
    }));

    cleanups.push(window.electronAPI.onMenuEvent('menu:about', () => {
      setAboutDialogOpen(true);
    }));

    cleanups.push(window.electronAPI.onMenuEvent('menu:undo', () => {
      document.execCommand('undo');
    }));

    cleanups.push(window.electronAPI.onMenuEvent('menu:redo', () => {
      document.execCommand('redo');
    }));

    cleanups.push(window.electronAPI.onMenuEvent('menu:zoom-in', () => {
      const current = parseFloat(document.documentElement.style.zoom || '1');
      document.documentElement.style.zoom = String(Math.min(current + 0.1, 2));
    }));

    cleanups.push(window.electronAPI.onMenuEvent('menu:zoom-out', () => {
      const current = parseFloat(document.documentElement.style.zoom || '1');
      document.documentElement.style.zoom = String(Math.max(current - 0.1, 0.5));
    }));

    cleanups.push(window.electronAPI.onMenuEvent('menu:reset-zoom', () => {
      document.documentElement.style.zoom = '1';
    }));

    return () => {
      cleanups.forEach((cleanup) => cleanup());
    };
  }, [navigate, setQuickCaptureOpen, setSearchDialogOpen, setShortcutGuideOpen, setAboutDialogOpen]);

  // 监听 AI 导航指令
  useEffect(() => {
    const handleNavigate = (_event: any, command: { page: string; params?: Record<string, any> }) => {
      navigate(`/${command.page}`, { state: command.params });
    };

    const unsubNavigate = api.ai.onNavigate?.(handleNavigate);

    return () => {
      unsubNavigate?.();
    };
  }, [navigate]);

  // 快速录入保存处理（含拖拽文件）
  const handleSave = useCallback(async (data: any) => {
    useUIStore.getState().clearPendingFiles();

    const result = await createCreativity(data);
    
    if (result && result.id) {
      let mediaLinked = false;
      if (data.mediaRef) {
        const mediaData = data.mediaRef.data || data.mediaRef;
        if (mediaData && mediaData.id) {
          await api.media.linkToCreativity([mediaData.id], result.id);
          mediaLinked = true;
        }
      }
      if (data.mediaFiles && data.mediaFiles.length > 0) {
        const mediaIds = data.mediaFiles.map((f: any) => f.id).filter(Boolean);
        if (mediaIds.length > 0) {
          await api.media.linkToCreativity(mediaIds, result.id);
          mediaLinked = true;
        }
      }
      if (mediaLinked) {
        await fetchCreativities();
      }
    }
    
    setQuickCaptureOpen(false);
    return !!result;
  }, [createCreativity, setQuickCaptureOpen, fetchCreativities]);

  // 处理批量导入确认
  const handleBatchImportConfirm = useCallback(async (items: BatchImportItem[]) => {
    console.log('[App] handleBatchImportConfirm called with', items.length, 'items');
    const getFileType = (fileName: string): string => {
      const ext = fileName.split('.').pop()?.toLowerCase() || '';
      if (['png', 'jpg', 'jpeg', 'gif', 'webp', 'bmp', 'svg'].includes(ext)) return 'image';
      if (['mp4', 'webm', 'mov', 'avi', 'mkv'].includes(ext)) return 'video';
      if (['mp3', 'wav', 'ogg', 'flac', 'aac', 'm4a'].includes(ext)) return 'audio';
      if (['txt', 'md', 'markdown', 'json', 'csv', 'xml', 'html', 'log'].includes(ext)) return 'text';
      return 'other'; // 不支持的文件类型统一标记为"其他"
    };

    const isMediaType = (fileName: string): boolean => {
      const t = getFileType(fileName);
      return t === 'image' || t === 'video' || t === 'audio';
    };

    setBatchImportProgress({ visible: true, current: 0, total: items.length, fileName: '' });
    batchImportCancelledRef.current = false;
    let successCount = 0;

    for (let i = 0; i < items.length; i++) {
      if (batchImportCancelledRef.current) break;
      const item = items[i];
      setBatchImportProgress(prev => ({ ...prev, current: i + 1, fileName: item.fileName }));

      try {
        const fileType = getFileType(item.fileName) as 'image' | 'video' | 'audio' | 'text' | 'other';
        
        // 根据标题选项确定最终标题
        let title = '';
        if (item.titleOption === 'keep') {
          title = item.fileName;
        } else if (item.titleOption === 'custom' && item.customTitle) {
          title = item.customTitle;
        }

        let contentPath = '';
        let mediaResult: any = null;

        if (isMediaType(item.fileName)) {
          // 处理媒体文件
          try {
            // 优先使用文件路径（右键导入），其次使用 File 对象（拖拽/粘贴）
            const filePath = item.filePath || (item.file ? api.file.getPathForFile(item.file) : null);
            if (filePath) {
              mediaResult = await api.media.importFromPath(filePath, { fileType, fileName: item.fileName });
            }
          } catch {}

          if (!mediaResult || mediaResult.success === false) {
            if (item.file) {
              const arrayBuffer = await item.file.arrayBuffer();
              const uint8Array = new Uint8Array(arrayBuffer);
              mediaResult = await api.media.save({
                fileName: item.fileName,
                fileType,
                data: uint8Array,
              });
            }
          }

          if (mediaResult && mediaResult.success !== false) {
            const mediaData = mediaResult.data || mediaResult;
            registerMediaPaths([mediaData]);
          }
        } else if (fileType === 'other') {
          // 其他类型文件：不读取内容，文件作为附件导入
          try {
            const filePath = item.filePath || (item.file ? api.file.getPathForFile(item.file) : null);
            if (filePath) {
              mediaResult = await api.media.importFromPath(filePath, { fileType: 'document', fileName: item.fileName });
            }
          } catch {}

          if (!mediaResult || mediaResult.success === false) {
            if (item.file) {
              const arrayBuffer = await item.file.arrayBuffer();
              const uint8Array = new Uint8Array(arrayBuffer);
              mediaResult = await api.media.save({
                fileName: item.fileName,
                fileType: 'document',
                data: uint8Array,
              });
            }
          }

          if (mediaResult && mediaResult.success !== false) {
            const mediaData = mediaResult.data || mediaResult;
            registerMediaPaths([mediaData]);
          }
          contentPath = `[附件] ${item.fileName}`;
        } else {
          // 处理文本文件
          try {
            if (item.file) {
              const text = await item.file.text();
              contentPath = text.substring(0, 5000);
            } else if (item.filePath) {
              // 通过文件路径读取文本内容
              const textContent = await api.file.readTextFile(item.filePath);
              contentPath = (textContent || '').substring(0, 5000);
            }
          } catch {
            contentPath = item.fileName;
          }
        }

        // 合并附加文本到内容
        let finalContent = contentPath;
        if (item.additionalText) {
          if (finalContent) {
            finalContent = `${finalContent}\n\n${item.additionalText}`;
          } else {
            finalContent = item.additionalText;
          }
        }

        const result = await createCreativity({
          title,
          content: finalContent,
          type: fileType,
          tags: [],
          contentFormat: isMediaType(item.fileName) ? 'markdown' : 'plain',
        });

        if (result && result.id && mediaResult) {
          const mediaData = mediaResult.data || mediaResult;
          if (mediaData && mediaData.id) {
            await api.media.linkToCreativity([mediaData.id], result.id);
          }
        }
        successCount++;
      } catch (err) {
        console.error('[App] 批量导入创建失败:', err);
      }
    }

    setBatchImportProgress({ visible: false, current: 0, total: 0, fileName: '' });
    await fetchCreativities();
    return successCount;
  }, [createCreativity, fetchCreativities, setBatchImportProgress]);

  // 将批量导入函数保存到 ref，供 useEffect 中使用
  useEffect(() => {
    console.log('[App] Setting batchImportConfirmRef.current');
    batchImportConfirmRef.current = handleBatchImportConfirm;
  }, [handleBatchImportConfirm]);

  return (
    <div className="app-container">
      {!focusMode && <Sidebar />}
      <div className={`app-main ${sidebarOpen && !focusMode ? 'sidebar-open' : 'sidebar-closed'}`}>
        {!focusMode && <Header />}
        <main
          className="main-content"
          style={{
            flex: 1,
            minHeight: 0,
            overflow: 'auto',
            backgroundColor: 'var(--bg-primary)',
            position: 'relative',
          }}
        >
          <AnimatePresence mode="wait">
            <PageTransition key={location.pathname}>
              <Outlet />
            </PageTransition>
          </AnimatePresence>
        </main>
      </div>

      {/* 快速录入弹窗 */}
      <AnimatePresence>
        {quickCaptureOpen && (
          <QuickCapture
            isOpen={true}
            onClose={() => { setQuickCaptureOpen(false); useUIStore.getState().clearPendingFiles(); }}
            onSave={handleSave}
          />
        )}
      </AnimatePresence>

      {/* AI 悬浮球 + 小窗 */}
      <AIFloatingBall />
      <AIChatMiniWindow />
      <AIChatFullscreen />
      <AISelectionToolbar />
      <AIContextMenu />

      {/* 浮动编辑器窗口 */}
      <FloatingEditorManager />

      {/* 分离的看板窗口 */}
      <DetachedBoardManager />

      {/* 关于弹窗 */}
      <AnimatePresence>
        {aboutDialogOpen && (
          <AboutDialog onClose={() => setAboutDialogOpen(false)} />
        )}
      </AnimatePresence>

      {/* 快捷键速查弹窗 */}
      <AnimatePresence>
        {shortcutGuideOpen && (
          <ShortcutGuide onClose={() => setShortcutGuideOpen(false)} />
        )}
      </AnimatePresence>

      {/* 快速设置抽屉 */}
      <Drawer
        open={quickSettingsOpen}
        onClose={() => setQuickSettingsOpen(false)}
        placement="right"
        width={320}
        title="快速设置"
        mask={false}
      >
        <div style={{ display: 'flex', flexDirection: 'column', gap: 20 }}>
          <div>
            <div style={{ fontSize: 13, fontWeight: 600, color: 'var(--text-secondary)', marginBottom: 10 }}>
              主题模式
            </div>
            <div style={{ display: 'flex', gap: 8 }}>
              {(['light', 'dark'] as const).map((mode) => (
                <button
                  key={mode}
                  onClick={() => {
                    useUIStore.getState().setTheme(mode);
                  }}
                  style={{
                    flex: 1,
                    padding: '10px 12px',
                    borderRadius: 10,
                    border: theme === mode ? '2px solid var(--primary-color)' : '1px solid var(--border-color)',
                    backgroundColor: theme === mode ? 'var(--primary-bg)' : 'var(--bg-primary)',
                    color: 'var(--text-primary)',
                    fontSize: 13,
                    fontWeight: theme === mode ? 600 : 400,
                    cursor: 'pointer',
                    transition: 'all 0.15s ease',
                  }}
                >
                  {mode === 'light' ? '☀️ 浅色' : '🌙 深色'}
                </button>
              ))}
            </div>
          </div>

          <div>
            <div style={{ fontSize: 13, fontWeight: 600, color: 'var(--text-secondary)', marginBottom: 10 }}>
              音效
            </div>
            <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
              <button
                onClick={() => useSettingsStore.getState().save({ soundEnabled: !settings.soundEnabled })}
                style={{
                  padding: '8px 16px',
                  borderRadius: 8,
                  border: '1px solid var(--border-color)',
                  backgroundColor: settings.soundEnabled ? 'var(--primary-bg)' : 'var(--bg-primary)',
                  color: settings.soundEnabled ? 'var(--primary-color)' : 'var(--text-secondary)',
                  fontSize: 13,
                  fontWeight: 500,
                  cursor: 'pointer',
                  transition: 'all 0.15s ease',
                }}
              >
                {settings.soundEnabled ? '🔊 已开启' : '🔇 已关闭'}
              </button>
            </div>
          </div>

          <div>
            <div style={{ fontSize: 13, fontWeight: 600, color: 'var(--text-secondary)', marginBottom: 10 }}>
              快捷操作
            </div>
            <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
              {[
                { label: '快速录入', shortcut: 'Ctrl+N', action: () => useUIStore.getState().setQuickCaptureOpen(true) },
                { label: '全局搜索', shortcut: 'Ctrl+K', action: () => useUIStore.getState().setSearchDialogOpen(true) },
                { label: '快捷键指南', shortcut: 'Ctrl+/', action: () => useUIStore.getState().setShortcutGuideOpen(true) },
              ].map((item) => (
                <button
                  key={item.label}
                  onClick={() => { item.action(); setQuickSettingsOpen(false); }}
                  style={{
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'space-between',
                    padding: '10px 14px',
                    borderRadius: 8,
                    border: '1px solid var(--border-light)',
                    backgroundColor: 'var(--bg-primary)',
                    cursor: 'pointer',
                    transition: 'all 0.15s ease',
                    color: 'var(--text-primary)',
                    fontSize: 13,
                  }}
                  onMouseEnter={(e) => { e.currentTarget.style.backgroundColor = 'var(--bg-hover)'; }}
                  onMouseLeave={(e) => { e.currentTarget.style.backgroundColor = 'var(--bg-primary)'; }}
                >
                  <span>{item.label}</span>
                  <kbd style={{
                    padding: '2px 8px',
                    borderRadius: 4,
                    backgroundColor: 'var(--bg-tertiary)',
                    color: 'var(--text-tertiary)',
                    fontSize: 11,
                    fontFamily: 'monospace',
                    border: '1px solid var(--border-light)',
                  }}>
                    {item.shortcut}
                  </kbd>
                </button>
              ))}
            </div>
          </div>
        </div>
      </Drawer>

      {/* 搜索弹窗 */}
      <AnimatePresence>
        {searchDialogOpen && (
          <SearchDialog onClose={() => setSearchDialogOpen(false)} onSelect={(item) => { setSearchPreviewItem(item); setSearchPreviewOpen(true); }} />
        )}
      </AnimatePresence>

      {/* 批量导入进度条 */}
      {batchImportProgress.visible && createPortal(
        <div
          style={{
            position: 'fixed',
            bottom: 80,
            left: '50%',
            transform: 'translateX(-50%)',
            zIndex: 10000,
            backgroundColor: 'var(--bg-secondary)',
            borderRadius: 16,
            padding: '16px 24px',
            minWidth: 320,
            maxWidth: 480,
            boxShadow: '0 12px 40px rgba(0,0,0,0.15), 0 0 0 1px var(--border-color)',
            display: 'flex',
            flexDirection: 'column',
            gap: 10,
          }}
        >
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
            <span style={{ fontSize: 14, fontWeight: 600, color: 'var(--text-primary)' }}>
              批量录入中...
            </span>
            <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
              <span style={{ fontSize: 13, color: 'var(--primary-color)', fontWeight: 600, fontVariantNumeric: 'tabular-nums' }}>
                {batchImportProgress.current} / {batchImportProgress.total}
              </span>
              <button
                onClick={() => {
                  batchImportCancelledRef.current = true;
                  setBatchImportProgress({ visible: false, current: 0, total: 0, fileName: '' });
                }}
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  gap: 4,
                  padding: '4px 10px',
                  borderRadius: 6,
                  border: '1px solid var(--border-color)',
                  backgroundColor: 'var(--bg-tertiary)',
                  color: 'var(--text-secondary)',
                  fontSize: 12,
                  cursor: 'pointer',
                  transition: 'all 0.15s ease',
                }}
                onMouseEnter={(e) => {
                  e.currentTarget.style.backgroundColor = 'var(--error-color)';
                  e.currentTarget.style.color = '#fff';
                  e.currentTarget.style.borderColor = 'var(--error-color)';
                }}
                onMouseLeave={(e) => {
                  e.currentTarget.style.backgroundColor = 'var(--bg-tertiary)';
                  e.currentTarget.style.color = 'var(--text-secondary)';
                  e.currentTarget.style.borderColor = 'var(--border-color)';
                }}
              >
                <XCircle size={14} />
                取消
              </button>
            </div>
          </div>
          <Progress
            percent={Math.round((batchImportProgress.current / batchImportProgress.total) * 100)}
            status={batchImportProgress.current === batchImportProgress.total ? 'success' : 'active'}
            showInfo={false}
            size="small"
            strokeColor="var(--primary-color)"
          />
          <div style={{ fontSize: 12, color: 'var(--text-tertiary)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
            正在处理: {batchImportProgress.fileName}
          </div>
        </div>,
        document.body
      )}

      {/* 批量导入确认弹窗 */}
      <BatchImportConfirmModal
        isOpen={batchImportModalOpen}
        onClose={() => setBatchImportModalOpen(false)}
        onCancel={() => {
          uploadedFilesForConfirm.forEach(f => {
            if (f.thumbnailUrl && f.thumbnailUrl.startsWith('blob:')) {
              URL.revokeObjectURL(f.thumbnailUrl);
            }
          });
          setBatchImportModalOpen(false);
          setUploadedFilesForConfirm([]);
        }}
        onConfirm={async (items) => {
          // 先关闭弹窗，释放缩略图资源，再执行导入（让进度条显示在前面）
          uploadedFilesForConfirm.forEach(f => {
            if (f.thumbnailUrl && f.thumbnailUrl.startsWith('blob:')) {
              URL.revokeObjectURL(f.thumbnailUrl);
            }
          });
          setBatchImportModalOpen(false);
          setUploadedFilesForConfirm([]);
          // 延迟一下确保弹窗关闭动画完成，再开始导入
          await new Promise(resolve => setTimeout(resolve, 100));
          const successCount = await handleBatchImportConfirm(items);
          return successCount;
        }}
        uploadedFiles={uploadedFilesForConfirm}
        aiFeatures={false}
      />

      {/* 全局拖拽遮罩 */}
      <AnimatePresence>
        {isDragging && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            onDragEnter={(e) => {
              console.log('[App] Overlay drag-enter');
              e.preventDefault();
              e.stopPropagation();
            }}
            onDragOver={(e) => {
              e.preventDefault();
              e.stopPropagation();
            }}
            onDrop={(e) => {
              console.log('[App] Overlay drop - forwarding to window handler');
              e.preventDefault();
              e.stopPropagation();
              // 让事件冒泡到 window 处理
            }}
            style={{
              position: 'fixed',
              inset: 0,
              zIndex: 9999,
              backgroundColor: 'rgba(108, 99, 255, 0.08)',
              backdropFilter: 'blur(4px)',
              display: 'flex',
              flexDirection: 'column',
              alignItems: 'center',
              justifyContent: 'center',
              gap: 16,
              pointerEvents: 'auto',
            }}
          >
            <div style={{
              width: 80,
              height: 80,
              borderRadius: '50%',
              backgroundColor: 'var(--primary-bg)',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
            }}>
              <Upload size={36} color="var(--primary-color)" />
            </div>
            <div style={{
              fontSize: 18,
              fontWeight: 600,
              color: 'var(--primary-color)',
            }}>
              拖放文件以快速录入
            </div>
            <div style={{
              fontSize: 13,
              color: 'var(--text-secondary)',
            }}>
              支持图片、视频、音频、文本等任意文件
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* 自定义拖拽幽灵层 */}
      <DragOverlay />
    </div>
  );
};

const AntdContextHolder: React.FC = () => {
  const { message: msgApi, notification: notifyApi, modal: modalApi } = AntdApp.useApp();
  const setAntdContext = useUIStore((s) => s.setAntdContext);
  useEffect(() => {
    setAntdContext(msgApi, notifyApi, modalApi);
  }, [msgApi, notifyApi, modalApi, setAntdContext]);
  return null;
};

const App: React.FC = () => {
  const loadSettings = useSettingsStore((s) => s.loadSettings);
  const settings = useSettingsStore((s) => s.settings);
  const isLocked = useUIStore((s) => s.isLocked);
  const unlockScreen = useUIStore((s) => s.unlockScreen);
  const initGlobalShortcuts = useMusicStore((s) => s.initGlobalShortcuts);
  const [isUnlocked, setIsUnlocked] = useState(false);
  const [settingsLoaded, setSettingsLoaded] = useState(false);

  // 初始化全局媒体快捷键监听
  useEffect(() => {
    initGlobalShortcuts();
  }, [initGlobalShortcuts]);

  // 应用启动时加载设置
  useEffect(() => {
    loadSettings().then(async () => {
      try {
        await api.media.migrateContentReferences();
      } catch (err) {
        console.error('[App] 迁移失败:', err);
      }
      try {
        const mediaList = await api.media.list();
        if (mediaList && Array.isArray(mediaList)) {
          registerMediaPaths(mediaList);
        }
      } catch (err) {
        console.error('[App] 加载媒体路径失败:', err);
      }
      setSettingsLoaded(true);
    });
  }, [loadSettings]);

  // 监听 AI 触发的设置更新（如更换音色）
  useEffect(() => {
    if (!window.electronAPI?.settings?.onUpdate) return;
    
    const unsubscribe = window.electronAPI.settings.onUpdate(({ key, value }: { key: string; value: any }) => {
      console.log('[App] 收到设置更新:', key, value);
      useSettingsStore.getState().save({ [key]: value });
    });
    
    return unsubscribe;
  }, []);

  // 监听 AI 触发的音乐控制（停止/暂停/继续）
  useEffect(() => {
    if (!window.electronAPI?.onMenuEvent) return;

    const handler = (data: { action: string }) => {
      console.log('[App] 收到音乐控制:', data.action);
      const musicStore = useMusicStore.getState();
      if (data.action === 'stop') {
        musicStore.pause();
        musicStore.clearQueue?.();
      } else if (data.action === 'pause') {
        musicStore.pause();
      } else if (data.action === 'resume') {
        musicStore.resume?.();
      }
    };

    window.electronAPI.onMenuEvent('music:control', handler);
    // onMenuEvent 的 removeAllListeners 会清理，无需手动 unsubscribe
  }, []);

  // AI 实时跟随：工具调用时自动跳转到对应页面
  useEffect(() => {
    if (!window.electronAPI?.ai?.onToolCall) return;

    const handler = (_event: any, toolCall: { name: string; arguments: string }) => {
      const followMode = useAIStore.getState().followMode;
      if (!followMode) return;

      let targetPath = '';
      const toolName = toolCall.name;

      // 根据工具类型决定跳转目标
      if (toolName.includes('creativity') || toolName.includes('chapter') || toolName.includes('writing')) {
        targetPath = '/home';
      } else if (toolName.includes('board') || toolName.includes('canvas') || toolName.includes('sticky') || toolName.includes('graph') || toolName.includes('folder')) {
        targetPath = '/boards';
      } else if (toolName.includes('tag')) {
        targetPath = '/tags';
      } else if (toolName.includes('template')) {
        targetPath = '/templates';
      } else if (toolName.includes('trash')) {
        targetPath = '/trash';
      } else if (toolName.includes('music') || toolName.includes('track')) {
        // 音乐操作不跳转，只显示通知
        return;
      } else if (toolName.includes('settings') || toolName.includes('tts_voice')) {
        targetPath = '/settings';
      }

      if (targetPath) {
        // 使用 react-router 导航
        const currentPath = window.location.hash.replace('#', '');
        if (currentPath !== targetPath) {
          window.location.hash = targetPath;
        }
      }
    };

    const unsubscribe = window.electronAPI.ai.onToolCall(handler);
    return unsubscribe;
  }, []);

  // AI 工具调用后刷新创意列表
  useEffect(() => {
    if (!window.electronAPI?.onCreativityChanged) return;
    const handler = () => {
      useCreativityStore.getState().fetchCreativities();
    };
    const unsubscribe = window.electronAPI.onCreativityChanged(handler);
    return unsubscribe;
  }, []);

  // AI 预览事件监听
  useEffect(() => {
    if (!window.electronAPI?.onPreviewCreativity) return;
    const handler = (data: any) => {
      const { navigateToCreativity } = useCreativityStore.getState() as any;
      if (navigateToCreativity) {
        navigateToCreativity(data.id);
      }
    };
    const unsubscribe = window.electronAPI.onPreviewCreativity(handler);
    return unsubscribe;
  }, []);

  // 设置加载后应用字体和自定义指针
  useEffect(() => {
    if (settingsLoaded) {
      applyFontSettingsToDOM(settings);
      // 应用自定义指针设置
      document.documentElement.setAttribute('data-custom-cursor', settings.customCursor ? 'true' : 'false');
      localStorage.setItem('mindvault-custom-cursor', String(settings.customCursor));
    }
  }, [settingsLoaded, settings.fontFamily, settings.titleFontFamily, settings.h1FontFamily, settings.h2FontFamily, settings.h3FontFamily, settings.titleHighlightFontFamily, settings.specialFontFamily, settings.englishFontFamily, settings.boardTitleFontFamily, settings.boardBodyFontFamily, settings.boardSpecialFontFamily, settings.extensionFontFamily, settings.fontSize, settings.fontLineHeight, settings.customCursor]);

  // 隐私锁检查：如果未开启隐私锁，直接视为已解锁
  useEffect(() => {
    if (settingsLoaded && !settings.privacyLock) {
      setIsUnlocked(true);
    }
  }, [settingsLoaded, settings.privacyLock]);

  // 设置未加载完成时显示加载状态
  if (!settingsLoaded) {
    return (
      <div
        style={{
          position: 'fixed',
          inset: 0,
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          backgroundColor: 'var(--bg-primary, #f5f5f5)',
          color: 'var(--text-secondary, #999)',
          fontSize: 14,
        }}
      >
        正在加载...
      </div>
    );
  }

  // 隐私锁未解锁时显示锁定界面
  if (settings.privacyLock && !isUnlocked) {
    return <PrivacyLock onUnlock={() => setIsUnlocked(true)} />;
  }

  // 主动锁屏（退出登录触发）
  if (isLocked) {
    return (
      <PrivacyLock
        onUnlock={() => unlockScreen()}
        noPassword={!settings.privacyLock}
      />
    );
  }

  return (
    <AntdApp
      message={{
        duration: 5, // 5秒后自动关闭
      }}
    >
      <AntdContextHolder />
      <WeatherProvider>
        <HashRouter>
          <Routes>
            <Route path="/login" element={<Login />} />
            <Route element={<Layout />}>
              <Route path="/" element={<Home />} />
              <Route path="/board/:id" element={<Board />} />
              <Route path="/search" element={<Search />} />
              <Route path="/templates" element={<Templates />} />
              <Route path="/settings" element={<Settings />} />
              <Route path="/export" element={<Export />} />
              <Route path="/trash" element={<Trash />} />
            </Route>
          </Routes>
          {settings.customCursor && <CustomCursor />}
          <GlobalNotificationCenter />
        </HashRouter>
      </WeatherProvider>
    </AntdApp>
  );
};

export default App;
