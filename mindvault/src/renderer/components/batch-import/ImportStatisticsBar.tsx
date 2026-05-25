/**
 * 导入统计信息栏组件
 */

import React from 'react';
import { Space, Tag, Progress } from 'antd';
import {
  Database,
  Clock,
} from 'lucide-react';
import type { ImportStatistics } from './types';
import { formatFileSize, formatEstimatedTime, getFileTypeIcon } from './utils';

interface ImportStatisticsBarProps {
  statistics: ImportStatistics;
}

export const ImportStatisticsBar: React.FC<ImportStatisticsBarProps> = ({ statistics }) => {
  const { total, completed, failed, totalSize, byType, estimatedTime } = statistics;
  
  const successRate = total > 0 ? Math.round((completed / total) * 100) : 0;
  
  // 获取文件类型统计，按数量排序
  const typeStats = Object.entries(byType)
    .sort((a, b) => b[1] - a[1])
    .slice(0, 4); // 只显示前4种类型

  return (
    <div className="import-statistics-bar">
      <Space size="large" wrap>
        {/* 总大小 */}
        <Space>
          <Database size={16} style={{ color: '#722ed1' }} />
          <span>总计 <strong>{formatFileSize(totalSize)}</strong></span>
        </Space>

        {/* 预计时间 */}
        <Space>
          <Clock size={16} style={{ color: '#fa8c16' }} />
          <span>预计 <strong>{formatEstimatedTime(estimatedTime)}</strong></span>
        </Space>

        {/* 文件类型分布 */}
        <Space size="small">
          {typeStats.map(([type, count]) => (
            <Tag key={type} color="default" style={{ fontSize: 12 }}>
              {getFileTypeIcon(type)} {type}: {count}
            </Tag>
          ))}
        </Space>
      </Space>

      {/* 进度条 */}
      <div style={{ marginTop: 12 }}>
        <Progress
          percent={successRate}
          size="small"
          status={failed > 0 ? 'exception' : 'success'}
          format={() => `${completed}/${total}`}
        />
      </div>
    </div>
  );
};

export default ImportStatisticsBar;
