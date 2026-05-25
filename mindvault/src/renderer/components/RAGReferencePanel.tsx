/**
 * RAG 引用来源展示组件
 * 在聊天界面显示检索到的相关内容引用
 */

import React from 'react';
import { Tag, Tooltip, Collapse, Empty } from 'antd';
import { BookOutlined, FileTextOutlined, ProfileOutlined, TagOutlined, ReadOutlined } from '@ant-design/icons';

interface RAGReference {
  sourceType: string;
  sourceId: string;
  sourceTitle?: string;
  sourceStatus?: string;
  contentChunk: string;
  chunkIndex: number;
  score: number;
  embeddingModel?: string;
}

interface RAGReferencePanelProps {
  references: RAGReference[];
  onReferenceClick?: (ref: RAGReference) => void;
}

// 数据源类型图标和颜色
const SOURCE_TYPE_CONFIG: Record<string, { icon: React.ReactNode; color: string; label: string }> = {
  creativity: { icon: <FileTextOutlined />, color: 'blue', label: '创意' },
  chapter: { icon: <ReadOutlined />, color: 'green', label: '章节' },
  card: { icon: <ProfileOutlined />, color: 'purple', label: '卡片' },
  tag: { icon: <TagOutlined />, color: 'orange', label: '标签' },
  board: { icon: <ProfileOutlined />, color: 'cyan', label: '看板' },
};

const RAGReferencePanel: React.FC<RAGReferencePanelProps> = ({ references, onReferenceClick }) => {
  if (!references || references.length === 0) {
    return null;
  }

  const getTypeConfig = (type: string) => {
    return SOURCE_TYPE_CONFIG[type] || { icon: <FileTextOutlined />, color: 'default', label: type };
  };

  const getScoreColor = (score: number) => {
    if (score >= 0.8) return 'success';
    if (score >= 0.6) return 'processing';
    if (score >= 0.4) return 'warning';
    return 'default';
  };

  const items = references.map((ref, index) => {
    const typeConfig = getTypeConfig(ref.sourceType);
    const scorePercent = Math.round(ref.score * 100);

    return {
      key: index.toString(),
      label: (
        <div className="rag-reference-header" style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
          <Tag color={typeConfig.color} icon={typeConfig.icon}>
            {typeConfig.label}
          </Tag>
          <span className="rag-reference-title" style={{ flex: 1, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
            {ref.sourceTitle || `分块 ${ref.chunkIndex + 1}`}
          </span>
          <Tag color={getScoreColor(ref.score)} style={{ marginLeft: 'auto' }}>
            {scorePercent}% 相关
          </Tag>
          {ref.sourceStatus === 'trashed' && (
            <Tag color="red">已删除</Tag>
          )}
        </div>
      ),
      children: (
        <div 
          className="rag-reference-content"
          style={{ 
            padding: '8px 12px', 
            background: '#fafafa', 
            borderRadius: 4,
            cursor: onReferenceClick ? 'pointer' : 'default',
          }}
          onClick={() => onReferenceClick?.(ref)}
        >
          <div style={{ fontSize: 13, lineHeight: 1.6, color: '#333' }}>
            {ref.contentChunk}
          </div>
          {ref.embeddingModel && (
            <div style={{ marginTop: 8, fontSize: 12, color: '#999' }}>
              检索模型: {ref.embeddingModel === 'deepseek' ? 'DeepSeek' : ref.embeddingModel === 'openai' ? 'OpenAI' : '关键词匹配'}
            </div>
          )}
        </div>
      ),
    };
  });

  return (
    <div className="rag-reference-panel" style={{ margin: '12px 0' }}>
      <div style={{ marginBottom: 8, display: 'flex', alignItems: 'center', gap: 8 }}>
        <BookOutlined style={{ color: '#1890ff' }} />
        <span style={{ fontWeight: 500 }}>已检索到 {references.length} 条相关内容</span>
      </div>
      <Collapse
        items={items}
        size="small"
        bordered={false}
        style={{ background: '#fff' }}
      />
    </div>
  );
};

export default RAGReferencePanel;
export type { RAGReference, RAGReferencePanelProps };
