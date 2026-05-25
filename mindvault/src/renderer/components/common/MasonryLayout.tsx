import React, { useMemo, useEffect, useState, useRef } from 'react';
import { motion } from 'framer-motion';

interface MasonryItemProps {
  id: string;
  children: React.ReactNode;
  height?: number;
}

interface MasonryLayoutProps {
  items: MasonryItemProps[];
  columns?: number;
  gap?: number;
  minColumnWidth?: number;
}

const MasonryLayout: React.FC<MasonryLayoutProps> = ({
  items,
  columns = 3,
  gap = 16,
  minColumnWidth = 250,
}) => {
  const containerRef = useRef<HTMLDivElement>(null);
  const [columnCount, setColumnCount] = useState(columns);
  const mountedRef = useRef(false);

  // 响应式列数
  useEffect(() => {
    const updateColumns = () => {
      if (containerRef.current) {
        const width = containerRef.current.clientWidth;
        const calculated = Math.max(1, Math.floor(width / minColumnWidth));
        setColumnCount(Math.min(calculated, columns));
      }
    };

    let timer: ReturnType<typeof setTimeout>;
    const debouncedUpdate = () => {
      clearTimeout(timer);
      timer = setTimeout(updateColumns, 150);
    };

    updateColumns();
    window.addEventListener('resize', debouncedUpdate);
    return () => { clearTimeout(timer); window.removeEventListener('resize', debouncedUpdate); };
  }, [minColumnWidth, columns]);

  // 计算每列的项目
  const columnsData = useMemo(() => {
    const colData: MasonryItemProps[][] = Array(columnCount).fill(null).map(() => []);
    const columnHeights = Array(columnCount).fill(0);

    items.forEach(item => {
      // 找到最矮的列
      const shortestIndex = columnHeights.indexOf(Math.min(...columnHeights));
      colData[shortestIndex].push(item);
      // 使用 id 哈希生成确定性估算高度，避免 Math.random() 导致布局抖动
      const hash = item.id.split('').reduce((acc, char) => acc + char.charCodeAt(0), 0);
      const itemHeight = item.height || (150 + (hash % 100));
      columnHeights[shortestIndex] += itemHeight + gap;
    });

    return colData;
  }, [items, columnCount, gap]);

  // 首次挂载后标记，后续不再播放列入场动画
  useEffect(() => {
    const timer = setTimeout(() => { mountedRef.current = true; }, 500);
    return () => clearTimeout(timer);
  }, []);

  return (
    <div
      ref={containerRef}
      style={{
        display: 'flex',
        gap: gap,
        width: '100%',
        alignItems: 'flex-start',
      }}
    >
      {columnsData.map((column, colIndex) => (
        <motion.div
          key={`col-${colIndex}`}
          initial={mountedRef.current ? false : { opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: mountedRef.current ? 0 : colIndex * 0.05 }}
          style={{
            display: 'flex',
            flexDirection: 'column',
            gap: gap,
            flex: 1,
            minWidth: 0,
          }}
        >
          {column.map((item) => (
            <div
              key={item.id}
              style={{ width: '100%' }}
            >
              {item.children}
            </div>
          ))}
        </motion.div>
      ))}
    </div>
  );
};

export default MasonryLayout;
