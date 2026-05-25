import React, { useState, useMemo } from 'react';
import { Tooltip, Modal } from 'antd';
import { motion, AnimatePresence } from 'framer-motion';
import { X, Plus, Trash2, Sparkles, PenLine, BarChart3, FolderOpen, Code, ChevronRight, Search } from 'lucide-react';
import { useAIStore } from '../../stores/aiStore';
import type { PromptTemplate } from '../../../shared/types';

interface PromptTemplateLibraryProps {
  visible: boolean;
  onClose: () => void;
  onSelect: (prompt: string) => void;
}

const CATEGORY_CONFIG: Record<string, { label: string; icon: React.ReactNode; color: string }> = {
  creative: { label: '创意', icon: <Sparkles size={14} />, color: '#f59e0b' },
  writing: { label: '写作', icon: <PenLine size={14} />, color: '#3b82f6' },
  analysis: { label: '分析', icon: <BarChart3 size={14} />, color: '#10b981' },
  organize: { label: '整理', icon: <FolderOpen size={14} />, color: '#8b5cf6' },
  coding: { label: '编程', icon: <Code size={14} />, color: '#ef4444' },
  custom: { label: '自定义', icon: <Plus size={14} />, color: '#6b7280' },
};

export const PromptTemplateLibrary: React.FC<PromptTemplateLibraryProps> = ({ visible, onClose, onSelect }) => {
  const promptTemplates = useAIStore((s) => s.promptTemplates);
  const createPromptTemplate = useAIStore((s) => s.createPromptTemplate);
  const deletePromptTemplate = useAIStore((s) => s.deletePromptTemplate);
  const usePromptTemplate = useAIStore((s) => s.usePromptTemplate);

  const [selectedCategory, setSelectedCategory] = useState<string | null>(null);
  const [searchQuery, setSearchQuery] = useState('');
  const [showCreateModal, setShowCreateModal] = useState(false);
  const [newName, setNewName] = useState('');
  const [newDescription, setNewDescription] = useState('');
  const [newCategory, setNewCategory] = useState<string>('custom');
  const [newTemplate, setNewTemplate] = useState('');
  const [newVariables, setNewVariables] = useState('');
  const [variableValues, setVariableValues] = useState<Record<string, string>>({});
  const [activeTemplateId, setActiveTemplateId] = useState<string | null>(null);

  const filteredTemplates = useMemo(() => {
    let templates = promptTemplates;
    if (selectedCategory) {
      templates = templates.filter((t) => t.category === selectedCategory);
    }
    if (searchQuery) {
      const q = searchQuery.toLowerCase();
      templates = templates.filter(
        (t) => t.name.toLowerCase().includes(q) || t.description?.toLowerCase().includes(q)
      );
    }
    return templates;
  }, [promptTemplates, selectedCategory, searchQuery]);

  const categories = useMemo(() => {
    const cats = new Set(promptTemplates.map((t) => t.category));
    return Array.from(cats);
  }, [promptTemplates]);

  const handleUseTemplate = async (template: PromptTemplate) => {
    if (template.variables && Object.keys(template.variables).length > 0) {
      setActiveTemplateId(template.id);
      setVariableValues(
        Object.fromEntries(
          Object.entries(template.variables).map(([key, config]) => [key, (config as any).default || ''])
        )
      );
    } else {
      const rendered = await usePromptTemplate(template.id);
      if (rendered) {
        onSelect(rendered);
        onClose();
      }
    }
  };

  const handleConfirmVariables = async () => {
    if (!activeTemplateId) return;
    const rendered = await usePromptTemplate(activeTemplateId, variableValues);
    if (rendered) {
      onSelect(rendered);
      onClose();
    }
    setActiveTemplateId(null);
    setVariableValues({});
  };

  const handleCreate = () => {
    if (!newName.trim() || !newTemplate.trim()) return;
    let variables = null;
    if (newVariables.trim()) {
      try {
        const parsed = JSON.parse(newVariables);
        variables = parsed;
      } catch {
        variables = null;
      }
    }
    createPromptTemplate({
      name: newName.trim(),
      description: newDescription.trim(),
      category: newCategory,
      template: newTemplate.trim(),
      variables,
    });
    setShowCreateModal(false);
    setNewName('');
    setNewDescription('');
    setNewCategory('custom');
    setNewTemplate('');
    setNewVariables('');
  };

  if (!visible) return null;

  return (
    <>
      <motion.div
        initial={{ opacity: 0, y: -10 }}
        animate={{ opacity: 1, y: 0 }}
        exit={{ opacity: 0, y: -10 }}
        transition={{ duration: 0.15 }}
        style={{
          position: 'absolute',
          bottom: '100%',
          left: 0,
          marginBottom: 4,
          background: 'var(--bg-primary)',
          border: '1px solid var(--border-light)',
          borderRadius: 12,
          boxShadow: '0 -8px 32px rgba(0,0,0,0.15)',
          width: 340,
          maxHeight: 400,
          zIndex: 100,
          display: 'flex',
          flexDirection: 'column',
          overflow: 'hidden',
        }}
        onClick={(e) => e.stopPropagation()}
      >
        {/* 头部 */}
        <div style={{
          padding: '10px 12px',
          borderBottom: '1px solid var(--border-light)',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          flexShrink: 0,
        }}>
          <span style={{ fontSize: 13, fontWeight: 600, color: 'var(--text-primary)' }}>Prompt 模板</span>
          <div style={{ display: 'flex', gap: 4 }}>
            <Tooltip title="创建模板">
              <button
                onClick={() => setShowCreateModal(true)}
                style={{
                  width: 24, height: 24, borderRadius: 6,
                  border: 'none', background: 'var(--primary-bg)',
                  color: 'var(--primary-color)', cursor: 'pointer',
                  display: 'flex', alignItems: 'center', justifyContent: 'center',
                }}
              >
                <Plus size={14} />
              </button>
            </Tooltip>
            <button
              onClick={onClose}
              style={{
                width: 24, height: 24, borderRadius: 6,
                border: 'none', background: 'transparent',
                color: 'var(--text-tertiary)', cursor: 'pointer',
                display: 'flex', alignItems: 'center', justifyContent: 'center',
              }}
            >
              <X size={14} />
            </button>
          </div>
        </div>

        {/* 搜索 */}
        <div style={{ padding: '6px 10px', flexShrink: 0 }}>
          <div style={{
            display: 'flex', alignItems: 'center', gap: 6,
            background: 'var(--bg-tertiary)', borderRadius: 6, padding: '4px 8px',
          }}>
            <Search size={13} style={{ color: 'var(--text-tertiary)', flexShrink: 0 }} />
            <input
              type="text"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              placeholder="搜索模板..."
              style={{ border: 'none', background: 'transparent', outline: 'none', fontSize: 12, color: 'var(--text-primary)', width: '100%' }}
            />
          </div>
        </div>

        {/* 分类标签 */}
        <div style={{ display: 'flex', gap: 4, padding: '4px 10px', flexShrink: 0, overflowX: 'auto' }}>
          <button
            onClick={() => setSelectedCategory(null)}
            style={{
              padding: '3px 8px', borderRadius: 10, border: 'none',
              background: !selectedCategory ? 'var(--primary-color)' : 'transparent',
              color: !selectedCategory ? '#fff' : 'var(--text-secondary)',
              fontSize: 11, cursor: 'pointer', whiteSpace: 'nowrap',
            }}
          >
            全部
          </button>
          {categories.map((cat) => {
            const config = CATEGORY_CONFIG[cat] || CATEGORY_CONFIG.custom;
            return (
              <button
                key={cat}
                onClick={() => setSelectedCategory(selectedCategory === cat ? null : cat)}
                style={{
                  padding: '3px 8px', borderRadius: 10, border: 'none',
                  background: selectedCategory === cat ? config.color + '20' : 'transparent',
                  color: selectedCategory === cat ? config.color : 'var(--text-secondary)',
                  fontSize: 11, cursor: 'pointer', whiteSpace: 'nowrap',
                  display: 'flex', alignItems: 'center', gap: 3,
                }}
              >
                {config.icon}
                {config.label}
              </button>
            );
          })}
        </div>

        {/* 模板列表 */}
        <div style={{ flex: 1, overflowY: 'auto', padding: '4px 6px' }}>
          {filteredTemplates.length === 0 && (
            <div style={{ padding: 20, textAlign: 'center', color: 'var(--text-tertiary)', fontSize: 12 }}>
              暂无模板
            </div>
          )}
          {filteredTemplates.map((template) => {
            const config = CATEGORY_CONFIG[template.category] || CATEGORY_CONFIG.custom;
            return (
              <div
                key={template.id}
                onClick={() => handleUseTemplate(template)}
                style={{
                  padding: '8px 10px',
                  borderRadius: 8,
                  cursor: 'pointer',
                  transition: 'background 0.15s ease',
                  marginBottom: 2,
                }}
                onMouseEnter={(e) => { (e.currentTarget as HTMLElement).style.background = 'var(--bg-tertiary)'; }}
                onMouseLeave={(e) => { (e.currentTarget as HTMLElement).style.background = 'transparent'; }}
              >
                <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 6, flex: 1, minWidth: 0 }}>
                    <span style={{ color: config.color, display: 'flex' }}>{config.icon}</span>
                    <span style={{ fontSize: 12, fontWeight: 500, color: 'var(--text-primary)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                      {template.name}
                    </span>
                  </div>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 4 }}>
                    {!template.isPreset && (
                      <button
                        onClick={(e) => { e.stopPropagation(); deletePromptTemplate(template.id); }}
                        style={{ border: 'none', background: 'none', cursor: 'pointer', color: 'var(--text-tertiary)', padding: 2, display: 'flex', opacity: 0.4 }}
                        onMouseEnter={(e) => { (e.currentTarget as HTMLElement).style.opacity = '1'; (e.currentTarget as HTMLElement).style.color = '#ff4d4f'; }}
                        onMouseLeave={(e) => { (e.currentTarget as HTMLElement).style.opacity = '0.4'; (e.currentTarget as HTMLElement).style.color = 'var(--text-tertiary)'; }}
                      >
                        <Trash2 size={11} />
                      </button>
                    )}
                    <ChevronRight size={12} style={{ color: 'var(--text-tertiary)' }} />
                  </div>
                </div>
                {template.description && (
                  <div style={{ fontSize: 10, color: 'var(--text-tertiary)', marginTop: 2, paddingLeft: 20, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                    {template.description}
                  </div>
                )}
              </div>
            );
          })}
        </div>
      </motion.div>

      {/* 变量填写弹窗 */}
      <Modal
        title="填写模板变量"
        open={!!activeTemplateId}
        onOk={handleConfirmVariables}
        onCancel={() => { setActiveTemplateId(null); setVariableValues({}); }}
        okText="使用"
        cancelText="取消"
        width={400}
      >
        {activeTemplateId && (() => {
          const template = promptTemplates.find((t) => t.id === activeTemplateId);
          if (!template?.variables) return null;
          return (
            <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
              {Object.entries(template.variables).map(([key, config]) => (
                <div key={key}>
                  <label style={{ fontSize: 12, color: 'var(--text-secondary)', marginBottom: 4, display: 'block' }}>
                    {key} {(config as any).default ? '' : '*'}
                  </label>
                  <input
                    type="text"
                    value={variableValues[key] || ''}
                    onChange={(e) => setVariableValues({ ...variableValues, [key]: e.target.value })}
                    placeholder={`请输入${key}`}
                    style={{
                      width: '100%', padding: '6px 10px', borderRadius: 6,
                      border: '1px solid var(--border-light)', fontSize: 13,
                      background: 'var(--bg-secondary)', color: 'var(--text-primary)', outline: 'none',
                    }}
                  />
                </div>
              ))}
            </div>
          );
        })()}
      </Modal>

      {/* 创建模板弹窗 */}
      <Modal
        title="创建自定义模板"
        open={showCreateModal}
        onOk={handleCreate}
        onCancel={() => setShowCreateModal(false)}
        okText="创建"
        cancelText="取消"
        okButtonProps={{ disabled: !newName.trim() || !newTemplate.trim() }}
        width={520}
      >
        <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
          <div>
            <label style={{ fontSize: 12, color: 'var(--text-secondary)', marginBottom: 4, display: 'block' }}>名称 *</label>
            <input
              type="text"
              value={newName}
              onChange={(e) => setNewName(e.target.value)}
              placeholder="如：灵感拓展"
              style={{ width: '100%', padding: '6px 10px', borderRadius: 6, border: '1px solid var(--border-light)', fontSize: 13, background: 'var(--bg-secondary)', color: 'var(--text-primary)', outline: 'none' }}
            />
          </div>
          <div>
            <label style={{ fontSize: 12, color: 'var(--text-secondary)', marginBottom: 4, display: 'block' }}>描述</label>
            <input
              type="text"
              value={newDescription}
              onChange={(e) => setNewDescription(e.target.value)}
              placeholder="简要描述这个模板的用途"
              style={{ width: '100%', padding: '6px 10px', borderRadius: 6, border: '1px solid var(--border-light)', fontSize: 13, background: 'var(--bg-secondary)', color: 'var(--text-primary)', outline: 'none' }}
            />
          </div>
          <div>
            <label style={{ fontSize: 12, color: 'var(--text-secondary)', marginBottom: 4, display: 'block' }}>分类</label>
            <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap' }}>
              {Object.entries(CATEGORY_CONFIG).map(([key, config]) => (
                <button
                  key={key}
                  onClick={() => setNewCategory(key)}
                  style={{
                    padding: '4px 10px', borderRadius: 10, border: 'none',
                    background: newCategory === key ? config.color + '20' : 'transparent',
                    color: newCategory === key ? config.color : 'var(--text-secondary)',
                    fontSize: 12, cursor: 'pointer', display: 'flex', alignItems: 'center', gap: 4,
                  }}
                >
                  {config.icon}
                  {config.label}
                </button>
              ))}
            </div>
          </div>
          <div>
            <label style={{ fontSize: 12, color: 'var(--text-secondary)', marginBottom: 4, display: 'block' }}>模板内容 *</label>
            <textarea
              value={newTemplate}
              onChange={(e) => setNewTemplate(e.target.value)}
              placeholder="输入模板内容，用 {{变量名}} 表示可替换的变量&#10;例如：请帮我分析 {{主题}} 的 {{维度}}"
              rows={5}
              style={{ width: '100%', padding: '8px 10px', borderRadius: 6, border: '1px solid var(--border-light)', fontSize: 12, background: 'var(--bg-secondary)', color: 'var(--text-primary)', outline: 'none', resize: 'vertical', fontFamily: 'inherit' }}
            />
          </div>
          <div>
            <label style={{ fontSize: 12, color: 'var(--text-secondary)', marginBottom: 4, display: 'block' }}>
              变量定义（JSON，可选）
            </label>
            <textarea
              value={newVariables}
              onChange={(e) => setNewVariables(e.target.value)}
              placeholder={'{"主题": {"type": "text", "default": ""}, "维度": {"type": "text", "default": "优缺点"}}'}
              rows={3}
              style={{ width: '100%', padding: '8px 10px', borderRadius: 6, border: '1px solid var(--border-light)', fontSize: 11, background: 'var(--bg-secondary)', color: 'var(--text-primary)', outline: 'none', resize: 'vertical', fontFamily: 'monospace' }}
            />
          </div>
        </div>
      </Modal>
    </>
  );
};

export default PromptTemplateLibrary;
