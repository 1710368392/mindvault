import React, { useState, useEffect, useRef, useCallback } from 'react';
import { Pen, Highlighter, Type, Eraser, Undo2, Redo2, Save, X } from 'lucide-react';
import { Tooltip } from 'antd';

type Tool = 'pen' | 'text' | 'highlight' | 'eraser';

interface ImageAnnotatorProps {
  imageUrl: string;
  onSave: (annotatedImageDataUrl: string) => void;
  onCancel: () => void;
  visible: boolean;
}

const MAX_HISTORY = 20;

const ImageAnnotator: React.FC<ImageAnnotatorProps> = ({ imageUrl, onSave, onCancel, visible }) => {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const containerRef = useRef<HTMLDivElement>(null);
  const imageRef = useRef<HTMLImageElement | null>(null);
  const isDrawingRef = useRef(false);
  const lastPosRef = useRef<{ x: number; y: number } | null>(null);
  const textInputRef = useRef<HTMLInputElement | null>(null);

  const [tool, setTool] = useState<Tool>('pen');
  const [color, setColor] = useState('#ff0000');
  const [lineWidth, setLineWidth] = useState(3);
  const [history, setHistory] = useState<ImageData[]>([]);
  const [historyIndex, setHistoryIndex] = useState(-1);
  const [canvasSize, setCanvasSize] = useState({ width: 800, height: 600 });
  const [imageLoaded, setImageLoaded] = useState(false);
  const [textInput, setTextInput] = useState<{ x: number; y: number; visible: boolean } | null>(null);
  const [textValue, setTextValue] = useState('');

  const getToolWidth = useCallback(() => {
    if (tool === 'highlight') return 20;
    if (tool === 'eraser') return 20;
    return lineWidth;
  }, [tool, lineWidth]);

  const pushHistory = useCallback(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;
    const imageData = ctx.getImageData(0, 0, canvas.width, canvas.height);
    setHistory(prev => {
      const newHistory = prev.slice(0, historyIndex + 1);
      newHistory.push(imageData);
      if (newHistory.length > MAX_HISTORY) newHistory.shift();
      return newHistory;
    });
    setHistoryIndex(prev => {
      const newIdx = prev + 1;
      return newIdx >= MAX_HISTORY ? MAX_HISTORY - 1 : newIdx;
    });
  }, [historyIndex]);

  const loadImage = useCallback(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    const img = new Image();
    img.crossOrigin = 'anonymous';
    img.onload = () => {
      imageRef.current = img;

      const maxW = window.innerWidth - 48;
      const maxH = window.innerHeight - 120;
      let w = img.naturalWidth;
      let h = img.naturalHeight;

      if (w > maxW) { h = h * (maxW / w); w = maxW; }
      if (h > maxH) { w = w * (maxH / h); h = maxH; }

      w = Math.round(w);
      h = Math.round(h);

      canvas.width = w;
      canvas.height = h;
      setCanvasSize({ width: w, height: h });

      ctx.drawImage(img, 0, 0, w, h);
      setImageLoaded(true);

      const imageData = ctx.getImageData(0, 0, w, h);
      setHistory([imageData]);
      setHistoryIndex(0);
    };
    img.onerror = () => {
      setImageLoaded(false);
    };
    img.src = imageUrl;
  }, [imageUrl]);

  useEffect(() => {
    if (visible) {
      loadImage();
    }
  }, [visible, loadImage]);

  useEffect(() => {
    if (!visible) return;
    const handleResize = () => {
      if (imageRef.current) {
        const canvas = canvasRef.current;
        if (!canvas) return;
        const ctx = canvas.getContext('2d');
        if (!ctx) return;

        const img = imageRef.current;
        const maxW = window.innerWidth - 48;
        const maxH = window.innerHeight - 120;
        let w = img.naturalWidth;
        let h = img.naturalHeight;

        if (w > maxW) { h = h * (maxW / w); w = maxW; }
        if (h > maxH) { w = w * (maxH / h); h = maxH; }

        w = Math.round(w);
        h = Math.round(h);

        const tempCanvas = document.createElement('canvas');
        tempCanvas.width = canvas.width;
        tempCanvas.height = canvas.height;
        const tempCtx = tempCanvas.getContext('2d');
        if (tempCtx) tempCtx.drawImage(canvas, 0, 0);

        canvas.width = w;
        canvas.height = h;
        setCanvasSize({ width: w, height: h });

        ctx.drawImage(img, 0, 0, w, h);

        const imageData = ctx.getImageData(0, 0, w, h);
        setHistory([imageData]);
        setHistoryIndex(0);
      }
    };
    window.addEventListener('resize', handleResize);
    return () => window.removeEventListener('resize', handleResize);
  }, [visible]);

  const getCanvasPos = useCallback((e: React.MouseEvent<HTMLCanvasElement>) => {
    const canvas = canvasRef.current;
    if (!canvas) return { x: 0, y: 0 };
    const rect = canvas.getBoundingClientRect();
    return {
      x: (e.clientX - rect.left) * (canvas.width / rect.width),
      y: (e.clientY - rect.top) * (canvas.height / rect.height),
    };
  }, []);

  const startDrawing = useCallback((e: React.MouseEvent<HTMLCanvasElement>) => {
    if (tool === 'text') {
      const pos = getCanvasPos(e);
      setTextInput({ x: pos.x, y: pos.y, visible: true });
      setTextValue('');
      return;
    }

    isDrawingRef.current = true;
    const pos = getCanvasPos(e);
    lastPosRef.current = pos;

    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    ctx.beginPath();
    ctx.moveTo(pos.x, pos.y);

    if (tool === 'eraser') {
      ctx.globalCompositeOperation = 'destination-out';
      ctx.lineWidth = getToolWidth();
      ctx.lineCap = 'round';
      ctx.lineJoin = 'round';
    } else if (tool === 'highlight') {
      ctx.globalCompositeOperation = 'source-over';
      ctx.strokeStyle = color + '4D';
      ctx.lineWidth = getToolWidth();
      ctx.lineCap = 'round';
      ctx.lineJoin = 'round';
    } else {
      ctx.globalCompositeOperation = 'source-over';
      ctx.strokeStyle = color;
      ctx.lineWidth = getToolWidth();
      ctx.lineCap = 'round';
      ctx.lineJoin = 'round';
    }

    ctx.lineTo(pos.x + 0.1, pos.y + 0.1);
    ctx.stroke();
  }, [tool, color, getToolWidth, getCanvasPos]);

  const draw = useCallback((e: React.MouseEvent<HTMLCanvasElement>) => {
    if (!isDrawingRef.current) return;
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    const pos = getCanvasPos(e);

    ctx.beginPath();
    ctx.moveTo(lastPosRef.current?.x ?? pos.x, lastPosRef.current?.y ?? pos.y);
    ctx.lineTo(pos.x, pos.y);
    ctx.stroke();

    lastPosRef.current = pos;
  }, [getCanvasPos]);

  const stopDrawing = useCallback(() => {
    if (isDrawingRef.current) {
      isDrawingRef.current = false;
      lastPosRef.current = null;
      const canvas = canvasRef.current;
      if (canvas) {
        const ctx = canvas.getContext('2d');
        if (ctx) ctx.globalCompositeOperation = 'source-over';
      }
      pushHistory();
    }
  }, [pushHistory]);

  const handleUndo = useCallback(() => {
    if (historyIndex <= 0) return;
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    const newIdx = historyIndex - 1;
    ctx.putImageData(history[newIdx], 0, 0);
    setHistoryIndex(newIdx);
  }, [history, historyIndex]);

  const handleRedo = useCallback(() => {
    if (historyIndex >= history.length - 1) return;
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    const newIdx = historyIndex + 1;
    ctx.putImageData(history[newIdx], 0, 0);
    setHistoryIndex(newIdx);
  }, [history, historyIndex]);

  const handleSave = useCallback(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const dataUrl = canvas.toDataURL('image/png');
    onSave(dataUrl);
  }, [onSave]);

  const handleTextSubmit = useCallback(() => {
    if (!textInput || !textValue.trim()) {
      setTextInput(null);
      return;
    }

    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    ctx.globalCompositeOperation = 'source-over';
    ctx.fillStyle = color;
    ctx.font = `${Math.max(16, lineWidth * 5)}px sans-serif`;
    ctx.textBaseline = 'top';
    ctx.fillText(textValue, textInput.x, textInput.y);

    setTextInput(null);
    setTextValue('');
    pushHistory();
  }, [textInput, textValue, color, lineWidth, pushHistory]);

  useEffect(() => {
    if (textInput?.visible && textInputRef.current) {
      textInputRef.current.focus();
    }
  }, [textInput]);

  useEffect(() => {
    if (!visible) return;
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.ctrlKey && e.key === 'z') {
        e.preventDefault();
        handleUndo();
      } else if (e.ctrlKey && e.key === 'y') {
        e.preventDefault();
        handleRedo();
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [visible, handleUndo, handleRedo]);

  if (!visible) return null;

  const tools: { key: Tool; icon: React.ReactNode; label: string }[] = [
    { key: 'pen', icon: <Pen size={18} />, label: '画笔' },
    { key: 'highlight', icon: <Highlighter size={18} />, label: '高亮' },
    { key: 'text', icon: <Type size={18} />, label: '文字' },
    { key: 'eraser', icon: <Eraser size={18} />, label: '橡皮' },
  ];

  const canvasRect = canvasRef.current?.getBoundingClientRect();
  const textInputStyle: React.CSSProperties = textInput && canvasRect
    ? {
        position: 'absolute',
        left: canvasRect.left + (textInput.x / canvasSize.width) * canvasRect.width,
        top: canvasRect.top + (textInput.y / canvasSize.height) * canvasRect.height,
        zIndex: 60,
        fontSize: Math.max(16, lineWidth * 5),
        color: color,
        background: 'rgba(255,255,255,0.9)',
        border: `2px solid ${color}`,
        borderRadius: 4,
        padding: '2px 4px',
        outline: 'none',
        fontFamily: 'sans-serif',
        minWidth: 100,
      }
    : { display: 'none' };

  return (
    <div className="fixed inset-0 z-[70] flex flex-col bg-black/90">
      <div className="flex items-center gap-2 px-4 py-2 bg-white/10 backdrop-blur-sm">
        {tools.map(t => (
          <button
            key={t.key}
            onClick={() => setTool(t.key)}
            className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-sm font-medium transition-colors ${
              tool === t.key
                ? 'bg-blue-500 text-white'
                : 'bg-white/10 text-white/70 hover:bg-white/20 hover:text-white'
            }`}
            title={t.label}
          >
            {t.icon}
            <span className="hidden sm:inline">{t.label}</span>
          </button>
        ))}

        <div className="w-px h-6 bg-white/20 mx-1" />

        <Tooltip title="颜色">
          <input
            type="color"
            value={color}
            onChange={e => setColor(e.target.value)}
            className="w-8 h-8 rounded cursor-pointer border-0 bg-transparent"
          />
        </Tooltip>

        {(tool === 'pen' || tool === 'text') && (
          <div className="flex items-center gap-2 ml-1">
            <span className="text-white/50 text-xs">粗细</span>
            <input
              type="range"
              min={1}
              max={10}
              value={lineWidth}
              onChange={e => setLineWidth(Number(e.target.value))}
              className="w-20 accent-blue-500"
            />
            <span className="text-white/50 text-xs w-4">{lineWidth}</span>
          </div>
        )}

        <div className="w-px h-6 bg-white/20 mx-1" />

        <Tooltip title="撤销 (Ctrl+Z)">
          <button
            onClick={handleUndo}
            disabled={historyIndex <= 0}
            className="p-1.5 rounded-lg text-white/70 hover:bg-white/20 hover:text-white disabled:opacity-30 disabled:cursor-not-allowed transition-colors"
          >
            <Undo2 size={18} />
          </button>
        </Tooltip>
        <Tooltip title="重做 (Ctrl+Y)">
          <button
            onClick={handleRedo}
            disabled={historyIndex >= history.length - 1}
            className="p-1.5 rounded-lg text-white/70 hover:bg-white/20 hover:text-white disabled:opacity-30 disabled:cursor-not-allowed transition-colors"
          >
            <Redo2 size={18} />
          </button>
        </Tooltip>

        <div className="flex-1" />

        <Tooltip title="保存">
          <button
            onClick={handleSave}
            disabled={!imageLoaded}
            className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-green-500 text-white text-sm font-medium hover:bg-green-600 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
          >
            <Save size={16} />
            <span>保存</span>
          </button>
        </Tooltip>
        <Tooltip title="取消">
          <button
            onClick={onCancel}
            className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-white/10 text-white/70 text-sm font-medium hover:bg-white/20 hover:text-white transition-colors"
          >
          <X size={16} />
          <span>取消</span>
        </button>
        </Tooltip>
      </div>

      <div ref={containerRef} className="flex-1 flex items-center justify-center p-6 overflow-hidden">
        <canvas
          ref={canvasRef}
          onMouseDown={startDrawing}
          onMouseMove={draw}
          onMouseUp={stopDrawing}
          onMouseLeave={stopDrawing}
          style={{
            maxWidth: '100%',
            maxHeight: '100%',
            cursor: tool === 'text' ? 'text' : tool === 'eraser' ? 'crosshair' : 'crosshair',
            borderRadius: 4,
            boxShadow: '0 4px 24px rgba(0,0,0,0.4)',
          }}
        />
        {textInput?.visible && (
          <input
            ref={textInputRef}
            type="text"
            value={textValue}
            onChange={e => setTextValue(e.target.value)}
            onKeyDown={e => {
              if (e.key === 'Enter') {
                e.preventDefault();
                handleTextSubmit();
              } else if (e.key === 'Escape') {
                setTextInput(null);
                setTextValue('');
              }
            }}
            onBlur={handleTextSubmit}
            style={textInputStyle}
            placeholder="输入文字..."
          />
        )}
      </div>
    </div>
  );
};

export default ImageAnnotator;
