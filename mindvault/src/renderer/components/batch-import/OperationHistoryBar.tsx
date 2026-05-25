/**
 * 操作历史栏组件
 */

import React from 'react';
import { Tag, Tooltip } from 'antd';
import { History } from 'lucide-react';
import type { Operation } from './types';

interface OperationHistoryBarProps {
  operation: Operation;
}

export const OperationHistoryBar: React.FC<OperationHistoryBarProps> = ({ operation }) => {
  const getOperationIcon = (type: Operation['type']) => {
    switch (type) {
      case 'batch_keep_title':
        return '✓';
      case 'batch_clear_title':
        return '✗';
      case 'batch_add_prefix':
        return '＋';
      case 'batch_add_suffix':
        return '＋';
      case 'batch_find_replace':
        return '⇄';
      case 'batch_apply_text':
        return '📝';
      case 'update_item':
        return '✎';
      case 'delete_items':
        return '🗑';
      case 'reorder':
        return '⇅';
      default:
        return '•';
    }
  };

  const formatTime = (timestamp: number) => {
    const date = new Date(timestamp);
    return date.toLocaleTimeString('zh-CN', { 
      hour: '2-digit', 
      minute: '2-digit', 
      second: '2-digit' 
    });
  };

  return (
    <div className="operation-history-bar">
      <History size={16} style={{ marginRight: 8, color: '#8c8c8c' }} />
      <span className="history-label">最近操作:</span>
      <Tooltip title={formatTime(operation.timestamp)}>
        <Tag size="small" className="operation-tag">
          <span className="operation-icon">{getOperationIcon(operation.type)}</span>
          <span className="operation-desc">{operation.description}</span>
        </Tag>
      </Tooltip>
    </div>
  );
};

export default OperationHistoryBar;
