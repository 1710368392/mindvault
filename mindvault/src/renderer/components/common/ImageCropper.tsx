import React, { useState, useRef, useCallback, useEffect } from 'react';
import { Modal, Button, Tooltip } from 'antd';
import { Circle, Square } from 'lucide-react';

interface ImageCropperProps {
  image: string | File;
  aspectRatio?: number;
  onCrop: (croppedImage: string) => void;
  onCancel: () => void;
  open: boolean;
}

type CropShape = 'circle' | 'square';

const ImageCropper: React.FC<ImageCropperProps> = ({
  image,
  aspectRatio = 1,
  onCrop,
  onCancel,
  open,
}) => {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const containerRef = useRef<HTMLDivElement>(null);
  const [imageObj, setImageObj] = useState<HTMLImageElement | null>(null);
  
  // 画布状态：缩放和位置
  const [canvasScale, setCanvasScale] = useState(1);
  const [canvasPosition, setCanvasPosition] = useState({ x: 0, y: 0 });
  
  // 拖拽状态
  const [isDragging, setIsDragging] = useState(false);
  const [dragStart, setDragStart] = useState({ x: 0, y: 0 });
  
  // 选择器形状
  const [cropShape, setCropShape] = useState<CropShape>('circle');
  
  // 容器尺寸
  const [containerSize] = useState({ width: 400, height: 400 });
  // 选择器尺寸（固定居中）
  const selectorSize = 256;

  // 加载图片
  useEffect(() => {
    if (!open) return;

    const img = new Image();
    img.onload = () => {
      setImageObj(img);
      
      // 初始化：让图片居中显示在选择器内
      // 计算初始缩放，使图片至少填满选择器区域
      const minScale = Math.max(
        selectorSize / img.width,
        selectorSize / img.height
      );
      const initialScale = Math.max(minScale, 1); // 至少1倍，不放大太小的图片
      
      setCanvasScale(initialScale);
      
      // 画布居中：让图片中心对准选择器中心
      const scaledWidth = img.width * initialScale;
      const scaledHeight = img.height * initialScale;
      setCanvasPosition({
        x: (containerSize.width - scaledWidth) / 2,
        y: (containerSize.height - scaledHeight) / 2,
      });
    };

    if (image instanceof File) {
      const reader = new FileReader();
      reader.onload = (e) => {
        img.src = e.target?.result as string;
      };
      reader.readAsDataURL(image);
    } else {
      img.src = image;
    }
  }, [image, open]);

  // 处理拖拽开始
  const handleMouseDown = useCallback((e: React.MouseEvent) => {
    e.preventDefault();
    setIsDragging(true);
    setDragStart({ x: e.clientX - canvasPosition.x, y: e.clientY - canvasPosition.y });
  }, [canvasPosition]);

  // 处理拖拽移动
  const handleMouseMove = useCallback((e: React.MouseEvent) => {
    if (!isDragging) return;
    e.preventDefault();
    setCanvasPosition({
      x: e.clientX - dragStart.x,
      y: e.clientY - dragStart.y,
    });
  }, [isDragging, dragStart]);

  // 处理拖拽结束
  const handleMouseUp = useCallback(() => {
    setIsDragging(false);
  }, []);

  // 处理触摸事件
  const handleTouchStart = useCallback((e: React.TouchEvent) => {
    const touch = e.touches[0];
    setIsDragging(true);
    setDragStart({ x: touch.clientX - canvasPosition.x, y: touch.clientY - canvasPosition.y });
  }, [canvasPosition]);

  const handleTouchMove = useCallback((e: React.TouchEvent) => {
    if (!isDragging) return;
    const touch = e.touches[0];
    setCanvasPosition({
      x: touch.clientX - dragStart.x,
      y: touch.clientY - dragStart.y,
    });
  }, [isDragging, dragStart]);

  const handleTouchEnd = useCallback(() => {
    setIsDragging(false);
  }, []);

  // 滚轮缩放处理 - 以选择器中心为基准缩放画布
  const handleWheel = useCallback((e: React.WheelEvent) => {
    e.preventDefault();
    if (!imageObj) return;
    
    // 根据滚轮方向调整缩放
    const delta = e.deltaY > 0 ? 0.9 : 1.1;
    const newScale = canvasScale * delta;
    
    // 选择器中心
    const selectorCenterX = containerSize.width / 2;
    const selectorCenterY = containerSize.height / 2;
    
    // 计算选择器中心在画布上的位置（相对于画布左上角）
    const relativeX = selectorCenterX - canvasPosition.x;
    const relativeY = selectorCenterY - canvasPosition.y;
    
    // 缩放后，保持选择器中心对应的画布点不变
    const newRelativeX = relativeX * delta;
    const newRelativeY = relativeY * delta;
    
    // 计算新的画布位置
    setCanvasPosition({
      x: selectorCenterX - newRelativeX,
      y: selectorCenterY - newRelativeY,
    });
    setCanvasScale(newScale);
  }, [canvasScale, canvasPosition, containerSize, imageObj]);

  // 执行裁剪
  const handleCrop = useCallback(() => {
    if (!canvasRef.current || !imageObj) return;

    const canvas = canvasRef.current;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    const outputSize = 256;
    canvas.width = outputSize;
    canvas.height = outputSize;

    // 清空画布（透明背景）
    ctx.clearRect(0, 0, outputSize, outputSize);

    // 创建裁剪路径
    ctx.beginPath();
    if (cropShape === 'circle') {
      ctx.arc(outputSize / 2, outputSize / 2, outputSize / 2, 0, Math.PI * 2);
    } else {
      ctx.rect(0, 0, outputSize, outputSize);
    }
    ctx.closePath();
    ctx.clip();

    // 选择器中心在容器中的位置
    const selectorCenterX = containerSize.width / 2;
    const selectorCenterY = containerSize.height / 2;
    
    // 选择器中心在画布上的位置（相对于画布左上角）
    const relativeX = selectorCenterX - canvasPosition.x;
    const relativeY = selectorCenterY - canvasPosition.y;
    
    // 计算绘制位置：让选择器中心对应到输出画布中心
    const drawX = outputSize / 2 - relativeX;
    const drawY = outputSize / 2 - relativeY;

    // 绘制图片
    ctx.drawImage(
      imageObj,
      drawX,
      drawY,
      imageObj.width * canvasScale,
      imageObj.height * canvasScale
    );

    // 转换为 base64
    const croppedImage = canvas.toDataURL('image/png');
    onCrop(croppedImage);
  }, [imageObj, canvasPosition, canvasScale, containerSize, cropShape, onCrop]);

  if (!imageObj) {
    return (
      <Modal
        open={open}
        onCancel={onCancel}
        title="裁剪图标"
        footer={null}
      >
        <div style={{ textAlign: 'center', padding: '40px' }}>加载中...</div>
      </Modal>
    );
  }

  // 计算选择器的位置（固定居中）
  const selectorLeft = (containerSize.width - selectorSize) / 2;
  const selectorTop = (containerSize.height - selectorSize) / 2;

  return (
    <Modal
      open={open}
      onCancel={onCancel}
      title="裁剪图标"
      footer={
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
          {/* 形状切换按钮 */}
          <Tooltip title={cropShape === 'circle' ? '切换为正方形' : '切换为圆形'}>
            <Button 
              type="text"
              icon={cropShape === 'circle' ? <Circle size={18} /> : <Square size={18} />}
              onClick={() => setCropShape(cropShape === 'circle' ? 'square' : 'circle')}
              style={{ 
                display: 'flex', 
                alignItems: 'center', 
                justifyContent: 'center',
                color: 'var(--text-primary)',
              }}
            />
          </Tooltip>
          {/* 操作按钮 */}
          <div style={{ display: 'flex', gap: '8px' }}>
            <Button onClick={onCancel}>取消</Button>
            <Button type="primary" onClick={handleCrop}>确认</Button>
          </div>
        </div>
      }
      width={containerSize.width + 80}
      styles={{ body: { padding: '24px' } }}
    >
      <div style={{ display: 'flex', flexDirection: 'column', gap: '16px', alignItems: 'center' }}>
        {/* 裁剪区域 */}
        <div
          ref={containerRef}
          style={{
            width: containerSize.width,
            height: containerSize.height,
            overflow: 'hidden',
            position: 'relative',
            backgroundColor: 'rgba(0, 0, 0, 0.05)',
            borderRadius: '8px',
            cursor: isDragging ? 'grabbing' : 'grab',
          }}
          onMouseDown={handleMouseDown}
          onMouseMove={handleMouseMove}
          onMouseUp={handleMouseUp}
          onMouseLeave={handleMouseUp}
          onTouchStart={handleTouchStart}
          onTouchMove={handleTouchMove}
          onTouchEnd={handleTouchEnd}
          onWheel={handleWheel}
        >
          {/* 画布 - 包含图片 */}
          <div
            style={{
              position: 'absolute',
              left: canvasPosition.x,
              top: canvasPosition.y,
              width: imageObj.width * canvasScale,
              height: imageObj.height * canvasScale,
            }}
          >
            <img
              src={imageObj.src}
              alt="Crop"
              style={{
                width: '100%',
                height: '100%',
                userSelect: 'none',
                pointerEvents: 'none',
                display: 'block',
              }}
              draggable={false}
            />
          </div>
          
          {/* 选择器边框 - 固定在中心 */}
          <div
            style={{
              position: 'absolute',
              left: selectorLeft,
              top: selectorTop,
              width: selectorSize,
              height: selectorSize,
              border: '2px dashed rgba(255, 255, 255, 0.9)',
              borderRadius: cropShape === 'circle' ? '50%' : '8px',
              pointerEvents: 'none',
              boxShadow: `
                0 0 0 9999px rgba(0, 0, 0, 0.3),
                inset 0 0 0 1px rgba(0, 0, 0, 0.1)
              `,
            }}
          />
        </div>

        {/* 提示文字 */}
        <div style={{ fontSize: '12px', color: '#999', textAlign: 'center' }}>
          拖拽移动画布，滚动鼠标滚轮缩放，选择器固定在中心
        </div>
      </div>

      {/* 隐藏的 canvas 用于生成裁剪结果 */}
      <canvas ref={canvasRef} style={{ display: 'none' }} />
    </Modal>
  );
};

export default ImageCropper;
