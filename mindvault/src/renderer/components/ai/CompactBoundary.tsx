/**
 * CompactBoundary - 上下文压缩提示组件
 * 
 * 当对话上下文被压缩时显示提示信息
 */

import React from 'react';
import { motion } from 'framer-motion';
import { Minimize2, Clock, TrendingDown } from 'lucide-react';

interface CompactBoundaryProps {
  summary: string;
  preCompactTokens: number;
  postCompactTokens: number;
  timestamp?: number;
}

function formatTokenCount(tokens: number): string {
  if (tokens >= 1000) {
    return `${(tokens / 1000).toFixed(1)}k`;
  }
  return `${tokens}`;
}

const CompactBoundary: React.FC<CompactBoundaryProps> = ({
  summary,
  preCompactTokens,
  postCompactTokens,
  timestamp,
}) => {
  const savedTokens = preCompactTokens - postCompactTokens;
  const savedPercent = Math.round((savedTokens / preCompactTokens) * 100);

  return (
    <motion.div
      initial={{ opacity: 0, y: -5 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.3 }}
      style={{
        margin: '12px 16px',
        padding: '10px 14px',
        borderRadius: 10,
        background: 'linear-gradient(135deg, rgba(99, 102, 241, 0.06) 0%, rgba(168, 85, 247, 0.06) 100%)',
        border: '1px solid rgba(99, 102, 241, 0.15)',
        fontSize: 12,
      }}
    >
      {/* 标题行 */}
      <div style={{
        display: 'flex',
        alignItems: 'center',
        gap: 8,
        marginBottom: 6,
      }}>
        <Minimize2 size={14} style={{ color: '#6366f1' }} />
        <span style={{
          fontWeight: 600,
          color: '#6366f1',
          fontSize: 12,
        }}>
          上下文已压缩
        </span>
        <div style={{
          marginLeft: 'auto',
          display: 'flex',
          alignItems: 'center',
          gap: 4,
          color: 'var(--text-tertiary)',
          fontSize: 11,
        }}>
          <TrendingDown size={12} />
          <span>节省 {savedPercent}%</span>
        </div>
      </div>

      {/* Token 统计 */}
      <div style={{
        display: 'flex',
        alignItems: 'center',
        gap: 12,
        marginBottom: 6,
        fontSize: 11,
        color: 'var(--text-tertiary)',
      }}>
        <span>
          <span style={{ color: 'var(--text-secondary)' }}>{formatTokenCount(preCompactTokens)}</span> → <span style={{ color: '#6366f1', fontWeight: 600 }}>{formatTokenCount(postCompactTokens)}</span> tokens
        </span>
        {timestamp && (
          <span style={{ display: 'flex', alignItems: 'center', gap: 4 }}>
            <Clock size={10} />
            {new Date(timestamp).toLocaleTimeString('zh-CN', { hour: '2-digit', minute: '2-digit' })}
          </span>
        )}
      </div>

      {/* 摘要 */}
      {summary && (
        <div style={{
          padding: '6px 10px',
          borderRadius: 6,
          background: 'rgba(99, 102, 241, 0.05)',
          color: 'var(--text-secondary)',
          fontSize: 11,
          lineHeight: 1.6,
          maxHeight: 80,
          overflow: 'hidden',
          textOverflow: 'ellipsis',
        }}>
          {summary}
        </div>
      )}
    </motion.div>
  );
};

export default CompactBoundary;
