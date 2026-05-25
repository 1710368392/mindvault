// @ts-nocheck
/**
 * AI 规则管理面板
 * 用户自定义提示词规则，在对话时自动注入到 System Prompt
 */

import React, { useState, useEffect, useCallback } from 'react';
import {
  Button,
  List,
  Switch,
  Tag,
  Divider,
  Alert,
  Tooltip,
  Modal,
  Input,
  Select,
  Spin,
  message,
  Empty,
} from 'antd';
import {
  PlusOutlined,
  EditOutlined,
  DeleteOutlined,
  InfoCircleOutlined,
  BookOutlined,
} from '@ant-design/icons';

const { TextArea } = Input;
const { confirm } = Modal;

interface Rule {
  id: string;
  name: string;
  content: string;
  type: 'global' | 'project';
  applyMode: 'always' | 'manual';
  description?: string;
  enabled: boolean;
  sortOrder: number;
  createdAt: string;
  updatedAt: string;
}

export const AIRulesPanel: React.FC = () => {
  const [rules, setRules] = useState<Rule[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [editorOpen, setEditorOpen] = useState(false);
  const [editingRule, setEditingRule] = useState<Rule | null>(null);
  const [deleteRule, setDeleteRule] = useState<Rule | null>(null);

  // 表单状态
  const [formName, setFormName] = useState('');
  const [formContent, setFormContent] = useState('');
  const [formApplyMode, setFormApplyMode] = useState<'always' | 'manual'>('always');
  const [formDescription, setFormDescription] = useState('');

  // 加载规则列表
  const loadRules = useCallback(async () => {
    try {
      setLoading(true);
      setError(null);
      const result = await window.electron.ipcRenderer.invoke('ai:rules:list', {
        type: 'global',
      });
      if (result.success) {
        setRules(result.data || []);
      } else {
        setError(result.error || '加载规则失败');
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : '加载规则失败');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    loadRules();
  }, [loadRules]);

  // 切换规则启用状态
  const handleToggle = async (rule: Rule) => {
    try {
      const result = await window.electron.ipcRenderer.invoke(
        'ai:rules:toggle',
        rule.id
      );
      if (result.success) {
        setRules((prev) =>
          prev.map((r) =>
            r.id === rule.id ? { ...r, enabled: !r.enabled } : r
          )
        );
        message.success(rule.enabled ? '规则已禁用' : '规则已启用');
      }
    } catch (err) {
      message.error('操作失败');
    }
  };

  // 打开新建对话框
  const handleAdd = () => {
    setEditingRule(null);
    setFormName('');
    setFormContent('');
    setFormApplyMode('always');
    setFormDescription('');
    setEditorOpen(true);
  };

  // 打开编辑对话框
  const handleEdit = (rule: Rule) => {
    setEditingRule(rule);
    setFormName(rule.name);
    setFormContent(rule.content);
    setFormApplyMode(rule.applyMode);
    setFormDescription(rule.description || '');
    setEditorOpen(true);
  };

  // 保存规则
  const handleSave = async () => {
    if (!formName.trim()) {
      message.error('规则名称不能为空');
      return;
    }
    if (!formContent.trim()) {
      message.error('规则内容不能为空');
      return;
    }

    try {
      let result;
      if (editingRule?.id) {
        // 更新
        result = await window.electron.ipcRenderer.invoke(
          'ai:rules:update',
          editingRule.id,
          {
            name: formName.trim(),
            content: formContent.trim(),
            applyMode: formApplyMode,
            description: formDescription.trim() || undefined,
          }
        );
      } else {
        // 创建
        result = await window.electron.ipcRenderer.invoke(
          'ai:rules:create',
          {
            name: formName.trim(),
            content: formContent.trim(),
            type: 'global',
            applyMode: formApplyMode,
            description: formDescription.trim() || undefined,
          }
        );
      }

      if (result.success) {
        message.success(editingRule ? '规则已更新' : '规则已创建');
        await loadRules();
        setEditorOpen(false);
      } else {
        message.error(result.error || '保存失败');
      }
    } catch (err) {
      message.error(err instanceof Error ? err.message : '保存失败');
    }
  };

  // 删除规则
  const handleDelete = async () => {
    if (!deleteRule) return;

    try {
      const result = await window.electron.ipcRenderer.invoke(
        'ai:rules:delete',
        deleteRule.id
      );
      if (result.success) {
        message.success('规则已删除');
        await loadRules();
        setDeleteRule(null);
      } else {
        message.error(result.error || '删除失败');
      }
    } catch (err) {
      message.error('删除失败');
    }
  };

  // 确认删除
  const confirmDelete = (rule: Rule) => {
    confirm({
      title: '确认删除',
      content: `确定要删除规则 "${rule.name}" 吗？此操作不可恢复。`,
      okText: '删除',
      okType: 'danger',
      cancelText: '取消',
      onOk() {
        setDeleteRule(rule);
        handleDelete();
      },
    });
  };

  if (loading) {
    return (
      <div style={{ display: 'flex', justifyContent: 'center', alignItems: 'center', height: 200 }}>
        <Spin tip="加载中..." />
      </div>
    );
  }

  return (
    <div style={{ padding: 16 }}>
      {/* 标题栏 */}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 16 }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
          <BookOutlined style={{ fontSize: 18 }} />
          <span style={{ fontSize: 16, fontWeight: 500 }}>AI 规则管理</span>
          <Tooltip title="规则会在每次 AI 对话时自动注入到 System Prompt 中，让 AI 的输出更符合你的偏好">
            <InfoCircleOutlined style={{ color: '#999' }} />
          </Tooltip>
        </div>
        <Button type="primary" icon={<PlusOutlined />} onClick={handleAdd}>
          新建规则
        </Button>
      </div>

      {/* 提示信息 */}
      <Alert
        message="规则会在每次 AI 对话时自动注入到 System Prompt 中。始终生效的规则会自动应用，手动触发的规则需要在对话中输入 #规则名 引用。"
        type="info"
        showIcon
        style={{ marginBottom: 16 }}
      />

      {error && (
        <Alert message={error} type="error" style={{ marginBottom: 16 }} />
      )}

      {/* 规则列表 */}
      {rules.length === 0 ? (
        <Empty
          description="暂无规则"
          style={{ padding: '40px 0' }}
          image={Empty.PRESENTED_IMAGE_SIMPLE}
        >
          <Button type="primary" onClick={handleAdd}>
            创建第一条规则
          </Button>
        </Empty>
      ) : (
        <List
          dataSource={rules}
          renderItem={(rule) => (
            <List.Item
              actions={[
                <Switch
                  key="switch"
                  checked={rule.enabled}
                  onChange={() => handleToggle(rule)}
                  checkedChildren="启用"
                  unCheckedChildren="禁用"
                />,
                <Button
                  key="edit"
                  type="text"
                  icon={<EditOutlined />}
                  onClick={() => handleEdit(rule)}
                />,
                <Button
                  key="delete"
                  type="text"
                  danger
                  icon={<DeleteOutlined />}
                  onClick={() => confirmDelete(rule)}
                />,
              ]}
              style={{
                backgroundColor: rule.enabled ? 'transparent' : '#fafafa',
                borderRadius: 8,
                padding: '12px 16px',
                marginBottom: 8,
              }}
            >
              <List.Item.Meta
                title={
                  <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                    <span style={{ textDecoration: rule.enabled ? 'none' : 'line-through', color: rule.enabled ? 'inherit' : '#999' }}>
                      {rule.name}
                    </span>
                    <Tag color={rule.applyMode === 'always' ? 'blue' : 'default'}>
                      {rule.applyMode === 'always' ? '始终生效' : '手动触发'}
                    </Tag>
                  </div>
                }
                description={
                  <div>
                    {rule.description && (
                      <div style={{ marginBottom: 4, color: '#666' }}>{rule.description}</div>
                    )}
                    <div style={{ color: '#999', fontSize: 12, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', maxWidth: 400 }}>
                      {rule.content}
                    </div>
                  </div>
                }
              />
            </List.Item>
          )}
        />
      )}

      {/* 统计信息 */}
      {rules.length > 0 && (
        <div style={{ marginTop: 16, paddingTop: 16, borderTop: '1px solid #f0f0f0', color: '#999', fontSize: 12 }}>
          总规则数: {rules.length} | 已启用: {rules.filter((r) => r.enabled).length} | 始终生效: {rules.filter((r) => r.applyMode === 'always' && r.enabled).length}
        </div>
      )}

      {/* 规则编辑器对话框 */}
      <Modal
        title={editingRule ? '编辑规则' : '新建规则'}
        open={editorOpen}
        onCancel={() => setEditorOpen(false)}
        onOk={handleSave}
        okText="保存"
        cancelText="取消"
        width={600}
      >
        <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
          <div>
            <div style={{ marginBottom: 4, fontWeight: 500 }}>规则名称 <span style={{ color: 'red' }}>*</span></div>
            <Input
              value={formName}
              onChange={(e) => setFormName(e.target.value)}
              placeholder="给规则起个名字，方便识别"
            />
          </div>

          <div>
            <div style={{ marginBottom: 4, fontWeight: 500 }}>生效方式</div>
            <Select
              value={formApplyMode}
              onChange={(v) => setFormApplyMode(v)}
              style={{ width: '100%' }}
              options={[
                { value: 'always', label: '始终生效 - 每次对话都会自动应用此规则' },
                { value: 'manual', label: '手动触发 - 在对话中输入 #规则名 引用时才生效' },
              ]}
            />
          </div>

          <div>
            <div style={{ marginBottom: 4, fontWeight: 500 }}>规则描述（可选）</div>
            <Input
              value={formDescription}
              onChange={(e) => setFormDescription(e.target.value)}
              placeholder="简要说明这条规则的用途"
            />
          </div>

          <div>
            <div style={{ marginBottom: 4, fontWeight: 500 }}>规则内容 <span style={{ color: 'red' }}>*</span></div>
            <TextArea
              value={formContent}
              onChange={(e) => setFormContent(e.target.value)}
              placeholder={`支持 Markdown 格式。例如：
- 所有回答使用中文
- 写小说时使用第三人称
- 讨论代码时给出详细注释`}
              rows={8}
            />
          </div>
        </div>
      </Modal>
    </div>
  );
};

export default AIRulesPanel;
