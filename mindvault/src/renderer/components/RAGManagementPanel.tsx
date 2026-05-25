/**
 * RAG 知识库管理面板
 * 管理向量索引、查看统计、重建索引等
 */

import React, { useState, useEffect, useCallback } from 'react';
import {
  Card,
  Table,
  Button,
  Space,
  Statistic,
  Row,
  Col,
  Typography,
  Tag,
  Tooltip,
  Modal,
  Progress,
  Empty,
  Spin,
  message,
  Divider,
  Alert,
} from 'antd';
import {
  ReloadOutlined,
  DeleteOutlined,
  HistoryOutlined,
  DatabaseOutlined,
  CloudOutlined,
  CheckCircleOutlined,
  ExclamationCircleOutlined,
  SyncOutlined,
  SettingOutlined,
} from '@ant-design/icons';
import { useSettingsStore } from '../stores/settingsStore';

const { Title, Text } = Typography;

interface RAGStats {
  total: number;
  withEmbedding: number;
  withoutEmbedding: number;
  byType: Record<string, number>;
  byModel: Record<string, number>;
}

interface RAGLog {
  id: string;
  action: string;
  source_type: string;
  source_id: string | null;
  chunks_count: number;
  status: string;
  error_message: string | null;
  embedding_model: string | null;
  created_at: string;
}

interface ModelInfo {
  name: string;
  key: string;
  dimension: number;
}

const RAGManagementPanel: React.FC = () => {
  const { settings } = useSettingsStore();
  const [stats, setStats] = useState<RAGStats | null>(null);
  const [logs, setLogs] = useState<RAGLog[]>([]);
  const [modelInfo, setModelInfo] = useState<ModelInfo | null>(null);
  const [loading, setLoading] = useState(false);
  const [rebuilding, setRebuilding] = useState(false);
  const [rebuildProgress, setRebuildProgress] = useState(0);

  // 构建 AI 配置对象
  const buildAIConfig = useCallback(() => {
    const provider = settings.aiDefaultProvider || 'openai';
    const config: Record<string, any> = { provider };

    // 根据当前提供商添加对应配置
    if (provider === 'deepseek' && settings.aiDeepseekApiKey) {
      config.deepseekApiKey = settings.aiDeepseekApiKey;
    }
    if (provider === 'openai' && settings.aiOpenaiApiKey) {
      config.openaiApiKey = settings.aiOpenaiApiKey;
      config.openaiBaseUrl = settings.aiOpenaiBaseUrl;
    }
    if (provider === 'anthropic' && settings.aiAnthropicApiKey) {
      // Anthropic 不支持 Embedding，但可以尝试 OpenAI 作为备选
      if (settings.aiOpenaiApiKey) {
        config.openaiApiKey = settings.aiOpenaiApiKey;
        config.openaiBaseUrl = settings.aiOpenaiBaseUrl;
      }
    }
    if (provider === 'custom' && settings.aiCustomApiKey) {
      config.openaiApiKey = settings.aiCustomApiKey;
      config.openaiBaseUrl = settings.aiCustomBaseUrl;
    }

    // 如果当前提供商没有配置，尝试其他提供商作为备选
    if (!config.deepseekApiKey && !config.openaiApiKey) {
      if (settings.aiDeepseekApiKey) {
        config.deepseekApiKey = settings.aiDeepseekApiKey;
      } else if (settings.aiOpenaiApiKey) {
        config.openaiApiKey = settings.aiOpenaiApiKey;
        config.openaiBaseUrl = settings.aiOpenaiBaseUrl;
      }
    }

    return config;
  }, [settings]);

  // 加载统计数据
  const loadStats = useCallback(async () => {
    setLoading(true);
    const aiConfig = buildAIConfig();
    
    try {
      // 使用正确的 electronAPI 调用方式
      const statsResult = await window.electronAPI.rag.stats().catch(() => null);
      if (statsResult?.success) setStats(statsResult.data);

      // 注意：preload.js 中没有暴露 logs 和 model-info，需要添加或使用现有 API
      // 暂时使用空数据
      setLogs([]);
      
      // 模型信息从配置推断
      const hasDeepseek = !!settings.aiDeepseekApiKey;
      const hasOpenai = !!settings.aiOpenaiApiKey;
      if (hasDeepseek) {
        setModelInfo({ name: 'DeepSeek Embedding', key: 'deepseek', dimension: 1536 });
      } else if (hasOpenai) {
        setModelInfo({ name: 'OpenAI text-embedding-3-small', key: 'openai', dimension: 1536 });
      } else {
        setModelInfo({ name: '关键词匹配', key: 'keyword', dimension: 0 });
      }
    } catch (err) {
      console.error('加载 RAG 统计失败:', err);
    } finally {
      setLoading(false);
    }
  }, [buildAIConfig, settings]);

  useEffect(() => {
    loadStats();
  }, [loadStats]);

  // 重建全部索引
  const handleRebuildAll = async () => {
    const aiConfig = buildAIConfig();
    const hasEmbedding = aiConfig.deepseekApiKey || aiConfig.openaiApiKey;

    Modal.confirm({
      title: '重建全部索引',
      content: hasEmbedding
        ? '这将删除所有现有索引并重新生成。此操作可能需要较长时间，确定继续吗？'
        : '未配置 Embedding API Key，将使用关键词匹配模式进行索引（无需网络，但检索精度较低）。确定继续吗？',
      okText: '确定',
      cancelText: '取消',
      onOk: async () => {
        setRebuilding(true);
        setRebuildProgress(0);
        try {
          const progressInterval = setInterval(() => {
            setRebuildProgress(prev => Math.min(prev + 10, 90));
          }, 500);

          const result = await window.electronAPI.rag.rebuildAll(aiConfig, { includeTrashed: false });
          
          clearInterval(progressInterval);
          setRebuildProgress(100);

          if (result?.success) {
            message.success(`重建完成，共索引 ${result.data?.indexed || 0} 个分块`);
            loadStats();
          } else {
            message.error(result?.error || '重建失败');
          }
        } catch (err) {
          console.error('重建索引失败:', err);
          message.error('重建索引失败');
        } finally {
          setTimeout(() => {
            setRebuilding(false);
            setRebuildProgress(0);
          }, 1000);
        }
      },
    });
  };

  // 清空全部索引
  const handleClearAll = async () => {
    Modal.confirm({
      title: '清空全部索引',
      content: '这将删除所有向量索引数据。确定继续吗？',
      okText: '确定',
      cancelText: '取消',
      okButtonProps: { danger: true },
      onOk: async () => {
        try {
          const result = await window.electronAPI.rag.clearAll();
          if (result?.success) {
            message.success(`已清空 ${result.count || 0} 条索引`);
            loadStats();
          } else {
            message.error(result?.error || '清空失败');
          }
        } catch (err) {
          console.error('清空索引失败:', err);
          message.error('清空索引失败');
        }
      },
    });
  };

  // 索引特定类型
  const handleIndexType = async (type: 'creativities' | 'chapters' | 'cards') => {
    const aiConfig = buildAIConfig();

    setLoading(true);
    try {
      let result;
      if (type === 'creativities') {
        result = await window.electronAPI.rag.indexAllCreativities(aiConfig, {});
      } else if (type === 'chapters') {
        result = await window.electronAPI.rag.indexAllChapters(aiConfig, {});
      } else {
        result = await window.electronAPI.rag.indexAllCards(aiConfig, {});
      }
      
      if (result?.success) {
        const hasEmbedding = aiConfig.deepseekApiKey || aiConfig.openaiApiKey;
        message.success(
          `索引完成，共 ${result.data?.indexed || 0} 个分块` +
          (hasEmbedding ? '' : '（关键词匹配模式）')
        );
        loadStats();
      } else {
        message.error(result?.error || '索引失败');
      }
    } catch (err) {
      console.error('索引失败:', err);
      message.error('索引失败');
    } finally {
      setLoading(false);
    }
  };

  // 日志表格列定义
  const logColumns = [
    {
      title: '时间',
      dataIndex: 'created_at',
      key: 'created_at',
      width: 150,
      render: (text: string) => new Date(text).toLocaleString('zh-CN'),
    },
    {
      title: '操作',
      dataIndex: 'action',
      key: 'action',
      width: 80,
      render: (action: string) => {
        const colors: Record<string, string> = {
          index: 'blue',
          delete: 'red',
          rebuild: 'green',
          clear: 'orange',
        };
        const labels: Record<string, string> = {
          index: '索引',
          delete: '删除',
          rebuild: '重建',
          clear: '清空',
        };
        return <Tag color={colors[action] || 'default'}>{labels[action] || action}</Tag>;
      },
    },
    {
      title: '数据源',
      dataIndex: 'source_type',
      key: 'source_type',
      width: 80,
      render: (type: string) => {
        const labels: Record<string, string> = {
          creativity: '创意',
          chapter: '章节',
          card: '卡片',
          tag: '标签',
        };
        return labels[type] || type;
      },
    },
    {
      title: '分块数',
      dataIndex: 'chunks_count',
      key: 'chunks_count',
      width: 80,
    },
    {
      title: '状态',
      dataIndex: 'status',
      key: 'status',
      width: 80,
      render: (status: string) => {
        if (status === 'success') {
          return <Tag icon={<CheckCircleOutlined />} color="success">成功</Tag>;
        }
        return <Tag icon={<ExclamationCircleOutlined />} color="error">失败</Tag>;
      },
    },
    {
      title: '模型',
      dataIndex: 'embedding_model',
      key: 'embedding_model',
      width: 100,
      render: (model: string) => {
        if (!model) return '-';
        const labels: Record<string, string> = {
          deepseek: 'DeepSeek',
          openai: 'OpenAI',
          keyword: '关键词',
        };
        return labels[model] || model;
      },
    },
  ];

  // 类型统计表格数据
  const typeStatsData = stats?.byType 
    ? Object.entries(stats.byType).map(([type, count]) => ({
        key: type,
        type,
        count,
        percentage: stats.total > 0 ? Math.round((count / stats.total) * 100) : 0,
      }))
    : [];

  // 检查是否配置了 API Key
  const hasApiKey = settings.aiDeepseekApiKey || settings.aiOpenaiApiKey;

  return (
    <div className="rag-management-panel" style={{ padding: 16 }}>
      <Title level={4} style={{ marginBottom: 16 }}>
        <DatabaseOutlined style={{ marginRight: 8 }} />
        RAG 知识库管理
      </Title>

      {/* 未配置 API Key 提示 */}
      {!hasApiKey && (
        <Alert
          type="info"
          showIcon
          message="当前使用关键词匹配模式"
          description={
            <span>
              未检测到 DeepSeek 或 OpenAI 的 API Key。索引和检索功能仍可正常使用，但采用关键词匹配而非语义向量。
              配置 API Key 后可自动切换为 <strong>语义向量检索</strong>，精度更高。
            </span>
          }
          style={{ marginBottom: 16 }}
        />
      )}

      {/* 模型信息 */}
      <Card size="small" style={{ marginBottom: 16 }}>
        <Row gutter={16} align="middle">
          <Col>
            <CloudOutlined style={{ fontSize: 24, color: hasApiKey ? '#1890ff' : '#faad14' }} />
          </Col>
          <Col>
            <Text strong>Embedding 模型：</Text>
            <Tag color={hasApiKey ? 'blue' : 'warning'} style={{ marginLeft: 8 }}>
              {hasApiKey ? (modelInfo?.name || '检测中...') : '未配置'}
            </Tag>
            {modelInfo?.dimension && hasApiKey && (
              <Text type="secondary" style={{ marginLeft: 8 }}>
                向量维度: {modelInfo.dimension}
              </Text>
            )}
            {!hasApiKey && (
              <Text type="secondary" style={{ marginLeft: 8 }}>
                请配置 DeepSeek 或 OpenAI API Key
              </Text>
            )}
          </Col>
        </Row>
      </Card>

      {/* 统计卡片 */}
      <Row gutter={16} style={{ marginBottom: 16 }}>
        <Col span={6}>
          <Card>
            <Statistic
              title="总索引数"
              value={stats?.total || 0}
              prefix={<DatabaseOutlined />}
            />
          </Card>
        </Col>
        <Col span={6}>
          <Card>
            <Statistic
              title="已向量化"
              value={stats?.withEmbedding || 0}
              valueStyle={{ color: '#3f8600' }}
              prefix={<CheckCircleOutlined />}
            />
          </Card>
        </Col>
        <Col span={6}>
          <Card>
            <Statistic
              title="待向量化"
              value={stats?.withoutEmbedding || 0}
              valueStyle={{ color: '#faad14' }}
            />
          </Card>
        </Col>
        <Col span={6}>
          <Card>
            <Statistic
              title="向量覆盖率"
              value={stats?.total ? Math.round((stats.withEmbedding / stats.total) * 100) : 0}
              suffix="%"
            />
          </Card>
        </Col>
      </Row>

      {/* 类型分布 */}
      <Card title="索引分布" size="small" style={{ marginBottom: 16 }}>
        {typeStatsData.length > 0 ? (
          <Table
            dataSource={typeStatsData}
            columns={[
              { title: '数据类型', dataIndex: 'type', key: 'type', render: (t: string) => {
                const labels: Record<string, string> = { creativity: '创意', chapter: '章节', card: '卡片', tag: '标签' };
                return labels[t] || t;
              }},
              { title: '索引数量', dataIndex: 'count', key: 'count' },
              { title: '占比', dataIndex: 'percentage', key: 'percentage', render: (p: number) => `${p}%` },
            ]}
            pagination={false}
            size="small"
          />
        ) : (
          <Empty description="暂无数据" />
        )}
      </Card>

      {/* 操作按钮 */}
      <Card title="操作" size="small" style={{ marginBottom: 16 }}>
        <Space wrap>
          <Button 
            icon={<SyncOutlined spin={rebuilding} />} 
            onClick={handleRebuildAll}
            loading={rebuilding}
            type="primary"
          >
            重建全部索引
          </Button>
          <Button onClick={() => handleIndexType('creativities')}>
            索引创意
          </Button>
          <Button onClick={() => handleIndexType('chapters')}>
            索引章节
          </Button>
          <Button onClick={() => handleIndexType('cards')}>
            索引卡片
          </Button>
          <Button 
            icon={<ReloadOutlined />} 
            onClick={loadStats}
            loading={loading}
          >
            刷新统计
          </Button>
          <Button 
            icon={<DeleteOutlined />} 
            danger
            onClick={handleClearAll}
          >
            清空索引
          </Button>
        </Space>

        {/* 重建进度 */}
        {rebuilding && (
          <div style={{ marginTop: 16 }}>
            <Progress percent={rebuildProgress} status="active" />
            <Text type="secondary">正在重建索引，请稍候...</Text>
          </div>
        )}
      </Card>

      <Divider />

      {/* 索引日志 */}
      <Card 
        title={
          <span>
            <HistoryOutlined style={{ marginRight: 8 }} />
            索引日志（最近10条）
          </span>
        } 
        size="small"
      >
        <Table
          dataSource={logs}
          columns={logColumns}
          pagination={false}
          size="small"
          rowKey="id"
          locale={{ emptyText: '暂无日志' }}
        />
      </Card>
    </div>
  );
};

export default RAGManagementPanel;
