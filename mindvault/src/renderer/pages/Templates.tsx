import React, { useEffect, useState, useCallback } from 'react';
import { motion } from 'framer-motion';
import {
  BookOpen,
  FileText,
  GraduationCap,
  Package,
  PenLine,
  Plane,
  Zap,
  BookOpenCheck,
  Plus,
  X,
  Pencil,
  Trash2,
} from 'lucide-react';
import { api } from '../utils/api';
import { useUIStore } from '../stores/uiStore';
import { Popconfirm } from 'antd';
import type { Template } from '@shared/types';

const Templates: React.FC = () => {
  const [templates, setTemplates] = useState<Template[]>([]);
  const [selectedCategory, setSelectedCategory] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const toggleQuickCapture = useUIStore((s) => s.toggleQuickCapture);

  // 创建模板相关状态
  const [showCreateForm, setShowCreateForm] = useState(false);
  const [newTemplateName, setNewTemplateName] = useState('');
  const [newTemplateDesc, setNewTemplateDesc] = useState('');
  const [newTemplateCategory, setNewTemplateCategory] = useState('产品');
  const [creating, setCreating] = useState(false);

  // 编辑模板相关状态
  const [editingTemplate, setEditingTemplate] = useState<Template | null>(null);
  const [editTemplateName, setEditTemplateName] = useState('');
  const [editTemplateDesc, setEditTemplateDesc] = useState('');
  const [editTemplateCategory, setEditTemplateCategory] = useState('产品');
  const [updating, setUpdating] = useState(false);

  // 右键菜单状态
  const [contextMenu, setContextMenu] = useState<{
    x: number;
    y: number;
    template: Template;
  } | null>(null);

  useEffect(() => {
    loadTemplates();
  }, []);

  const loadTemplates = async () => {
    setIsLoading(true);
    try {
      const result = await api.template.list();
      setTemplates(result || []);
    } catch (error) {
      console.error('加载模板失败:', error);
      setTemplates(getBuiltinTemplates());
    } finally {
      setIsLoading(false);
    }
  };

  const categories = [
    { value: null, label: '全部', icon: BookOpen },
    { value: '产品', label: '产品', icon: Package },
    { value: '写作', label: '写作', icon: PenLine },
    { value: '旅行', label: '旅行', icon: Plane },
    { value: '学习', label: '学习', icon: GraduationCap },
    { value: '效率', label: '效率', icon: Zap },
    { value: '阅读', label: '阅读', icon: BookOpenCheck },
  ];

  // 分类友好名称映射
  const categoryLabelMap: Record<string, string> = {
    '产品': '产品',
    '写作': '写作',
    '旅行': '旅行',
    '学习': '学习',
    '效率': '效率',
    '阅读': '阅读',
  };

  const filteredTemplates = selectedCategory
    ? templates.filter((t) => t.category === selectedCategory)
    : templates;

  const handleTemplateClick = (template: Template) => {
    // 点击模板后设置选中模板并打开 QuickCapture 弹窗
    useUIStore.getState().setSelectedTemplate(template);
    toggleQuickCapture();
  };

  const handleCreateTemplate = async () => {
    const name = newTemplateName.trim();
    if (!name) return;
    setCreating(true);
    try {
      await api.template.create({
        name,
        description: newTemplateDesc.trim() || undefined,
        category: newTemplateCategory,
      });
      setNewTemplateName('');
      setNewTemplateDesc('');
      setNewTemplateCategory('产品');
      setShowCreateForm(false);
      await loadTemplates();
    } catch (error) {
      console.error('创建模板失败:', error);
    } finally {
      setCreating(false);
    }
  };

  // 右键菜单处理
  const handleContextMenu = useCallback((e: React.MouseEvent, template: Template) => {
    e.preventDefault();
    e.stopPropagation();
    setContextMenu({ x: e.clientX, y: e.clientY, template });
  }, []);

  const closeContextMenu = useCallback(() => {
    setContextMenu(null);
  }, []);

  // 点击其他区域关闭右键菜单
  useEffect(() => {
    const handleClick = () => closeContextMenu();
    if (contextMenu) {
      document.addEventListener('click', handleClick);
      return () => document.removeEventListener('click', handleClick);
    }
  }, [contextMenu, closeContextMenu]);

  // 编辑模板
  const handleEditTemplate = () => {
    if (!contextMenu) return;
    const t = contextMenu.template;
    setEditingTemplate(t);
    setEditTemplateName(t.name);
    setEditTemplateDesc(t.description || '');
    setEditTemplateCategory(t.category || '产品');
    closeContextMenu();
  };

  const handleUpdateTemplate = async () => {
    if (!editingTemplate || !editTemplateName.trim()) return;
    setUpdating(true);
    try {
      await api.template.update(editingTemplate.id, {
        name: editTemplateName.trim(),
        description: editTemplateDesc.trim() || undefined,
        category: editTemplateCategory,
      });
      setEditingTemplate(null);
      await loadTemplates();
      useUIStore.getState().showToast('success', '模板已更新');
    } catch (error) {
      console.error('更新模板失败:', error);
    } finally {
      setUpdating(false);
    }
  };

  // 删除模板
  const handleDeleteTemplate = async () => {
    if (!contextMenu) return;
    const t = contextMenu.template;
    if (t.isBuiltin) {
      useUIStore.getState().showToast('warning', '内置模板不可删除');
      closeContextMenu();
      return;
    }
    try {
      await api.template.delete(t.id);
      await loadTemplates();
      useUIStore.getState().showToast('success', '模板已删除');
    } catch (error) {
      console.error('删除模板失败:', error);
    }
    closeContextMenu();
  };

  return (
    <div style={{ padding: 24, maxWidth: 1200, margin: '0 auto' }}>
      {/* 标题 */}
      <motion.div
        initial={{ opacity: 0, y: -10 }}
        animate={{ opacity: 1, y: 0 }}
        style={{ marginBottom: 24, display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between' }}
      >
        <div>
          <h2 style={{ fontSize: 22, fontWeight: 700, color: 'var(--text-primary)', marginBottom: 6 }}>
            模板库
          </h2>
          <p style={{ fontSize: 14, color: 'var(--text-secondary)' }}>
            使用预设模板快速创建结构化创意
          </p>
        </div>
        <button
          onClick={() => setShowCreateForm(!showCreateForm)}
          style={{
            display: 'flex',
            alignItems: 'center',
            gap: 6,
            padding: '8px 16px',
            borderRadius: 'var(--radius-md)',
            backgroundColor: showCreateForm ? 'var(--bg-tertiary)' : 'var(--success-color)',
            color: showCreateForm ? 'var(--text-secondary)' : 'white',
            fontWeight: 500,
            fontSize: 13,
            cursor: 'pointer',
            border: 'none',
            transition: 'opacity 0.15s ease',
            flexShrink: 0,
          }}
          onMouseEnter={(e) => { (e.currentTarget as HTMLElement).style.opacity = '0.85'; }}
          onMouseLeave={(e) => { (e.currentTarget as HTMLElement).style.opacity = '1'; }}
        >
          {showCreateForm ? <X size={14} /> : <Plus size={14} />}
          {showCreateForm ? '取消' : '创建模板'}
        </button>
      </motion.div>

      {/* 创建模板内联表单 */}
      {showCreateForm && (
        <motion.div
          initial={{ opacity: 0, height: 0 }}
          animate={{ opacity: 1, height: 'auto' }}
          exit={{ opacity: 0, height: 0 }}
          style={{
            marginBottom: 24,
            padding: 20,
            backgroundColor: 'var(--bg-secondary)',
            borderRadius: 'var(--radius-lg)',
            border: '1px solid var(--border-light)',
          }}
        >
          <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
            <div>
              <label style={{ fontSize: 13, fontWeight: 500, color: 'var(--text-primary)', marginBottom: 6, display: 'block' }}>
                模板名称
              </label>
              <input
                type="text"
                value={newTemplateName}
                onChange={(e) => setNewTemplateName(e.target.value)}
                onKeyDown={(e) => { if (e.key === 'Enter') handleCreateTemplate(); }}
                placeholder="输入模板名称..."
                style={{
                  width: '100%',
                  padding: '8px 12px',
                  borderRadius: 'var(--radius-md)',
                  border: '1px solid var(--border-color)',
                  backgroundColor: 'var(--bg-primary)',
                  color: 'var(--text-primary)',
                  fontSize: 14,
                  outline: 'none',
                  boxSizing: 'border-box',
                }}
              />
            </div>
            <div>
              <label style={{ fontSize: 13, fontWeight: 500, color: 'var(--text-primary)', marginBottom: 6, display: 'block' }}>
                描述
              </label>
              <input
                type="text"
                value={newTemplateDesc}
                onChange={(e) => setNewTemplateDesc(e.target.value)}
                onKeyDown={(e) => { if (e.key === 'Enter') handleCreateTemplate(); }}
                placeholder="输入模板描述..."
                style={{
                  width: '100%',
                  padding: '8px 12px',
                  borderRadius: 'var(--radius-md)',
                  border: '1px solid var(--border-color)',
                  backgroundColor: 'var(--bg-primary)',
                  color: 'var(--text-primary)',
                  fontSize: 14,
                  outline: 'none',
                  boxSizing: 'border-box',
                }}
              />
            </div>
            <div>
              <label style={{ fontSize: 13, fontWeight: 500, color: 'var(--text-primary)', marginBottom: 6, display: 'block' }}>
                分类
              </label>
              <select
                value={newTemplateCategory}
                onChange={(e) => setNewTemplateCategory(e.target.value)}
                style={{
                  width: '100%',
                  padding: '8px 12px',
                  borderRadius: 'var(--radius-md)',
                  border: '1px solid var(--border-color)',
                  backgroundColor: 'var(--bg-primary)',
                  color: 'var(--text-primary)',
                  fontSize: 14,
                  outline: 'none',
                  cursor: 'pointer',
                  boxSizing: 'border-box',
                }}
              >
                <option value="产品">产品</option>
                <option value="写作">写作</option>
                <option value="旅行">旅行</option>
                <option value="学习">学习</option>
                <option value="效率">效率</option>
                <option value="阅读">阅读</option>
              </select>
            </div>
            <div style={{ display: 'flex', justifyContent: 'flex-end', gap: 8 }}>
              <button
                onClick={() => { setShowCreateForm(false); setNewTemplateName(''); setNewTemplateDesc(''); }}
                style={{
                  padding: '8px 16px',
                  borderRadius: 'var(--radius-md)',
                  border: '1px solid var(--border-color)',
                  backgroundColor: 'transparent',
                  color: 'var(--text-secondary)',
                  fontSize: 13,
                  cursor: 'pointer',
                }}
              >
                取消
              </button>
              <button
                onClick={handleCreateTemplate}
                disabled={creating || !newTemplateName.trim()}
                style={{
                  padding: '8px 16px',
                  borderRadius: 'var(--radius-md)',
                  border: 'none',
                  backgroundColor: 'var(--success-color)',
                  color: 'white',
                  fontSize: 13,
                  fontWeight: 500,
                  cursor: creating || !newTemplateName.trim() ? 'not-allowed' : 'pointer',
                  opacity: creating || !newTemplateName.trim() ? 0.5 : 1,
                }}
              >
                {creating ? '创建中...' : '创建'}
              </button>
            </div>
          </div>
        </motion.div>
      )}

      {/* 分类标签 */}
      <div style={{ display: 'flex', gap: 8, marginBottom: 24, flexWrap: 'wrap' }}>
        {categories.map((cat) => (
          <button
            key={cat.value || 'all'}
            onClick={() => setSelectedCategory(cat.value)}
            style={{
              display: 'flex',
              alignItems: 'center',
              gap: 6,
              padding: '8px 16px',
              borderRadius: 'var(--radius-full)',
              fontSize: 13,
              fontWeight: selectedCategory === cat.value ? 600 : 400,
              cursor: 'pointer',
              border: '1px solid',
              backgroundColor:
                selectedCategory === cat.value ? 'var(--primary-bg)' : 'transparent',
              borderColor:
                selectedCategory === cat.value ? 'var(--primary-color)' : 'var(--border-color)',
              color:
                selectedCategory === cat.value
                  ? 'var(--primary-color)'
                  : 'var(--text-secondary)',
              transition: 'all 0.15s ease',
            }}
            onMouseEnter={(e) => {
              if (selectedCategory !== cat.value) {
                (e.currentTarget as HTMLElement).style.borderColor = 'var(--text-tertiary)';
              }
            }}
            onMouseLeave={(e) => {
              if (selectedCategory !== cat.value) {
                (e.currentTarget as HTMLElement).style.borderColor = 'var(--border-color)';
              }
            }}
          >
            <cat.icon size={14} />
            {cat.label}
          </button>
        ))}
      </div>

      {/* 模板网格 */}
      {isLoading ? (
        <div
          style={{
            display: 'grid',
            gridTemplateColumns: 'repeat(auto-fill, minmax(280px, 1fr))',
            gap: 16,
          }}
        >
          {Array.from({ length: 6 }).map((_, i) => (
            <div
              key={i}
              className="skeleton"
              style={{ height: 200, borderRadius: 'var(--radius-lg)' }}
            />
          ))}
        </div>
      ) : filteredTemplates.length > 0 ? (
        <div
          style={{
            display: 'grid',
            gridTemplateColumns: 'repeat(auto-fill, minmax(280px, 1fr))',
            gap: 16,
          }}
        >
          {filteredTemplates.map((template, index) => (
            <motion.div
              key={template.id}
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: index * 0.05 }}
              onClick={() => handleTemplateClick(template)}
              onContextMenu={(e) => handleContextMenu(e, template)}
              style={{
                backgroundColor: 'var(--bg-secondary)',
                borderRadius: 'var(--radius-lg)',
                padding: 24,
                border: '1px solid var(--border-light)',
                cursor: 'pointer',
                transition: 'transform 0.2s ease, box-shadow 0.2s ease',
              }}
              onMouseEnter={(e) => {
                (e.currentTarget as HTMLElement).style.transform = 'translateY(-4px)';
                (e.currentTarget as HTMLElement).style.boxShadow = 'var(--shadow-lg)';
              }}
              onMouseLeave={(e) => {
                (e.currentTarget as HTMLElement).style.transform = 'translateY(0)';
                (e.currentTarget as HTMLElement).style.boxShadow = 'none';
              }}
            >
              <div
                style={{
                  width: 44,
                  height: 44,
                  borderRadius: 'var(--radius-md)',
                  background: 'var(--primary-bg)',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  marginBottom: 14,
                }}
              >
                <FileText size={22} color="var(--primary-color)" />
              </div>
              <h3
                style={{
                  fontSize: 16,
                  fontWeight: 600,
                  color: 'var(--text-primary)',
                  marginBottom: 6,
                }}
              >
                {template.name}
              </h3>
              <p
                style={{
                  fontSize: 13,
                  color: 'var(--text-secondary)',
                  lineHeight: 1.5,
                  marginBottom: 16,
                }}
              >
                {template.description || '暂无描述'}
              </p>
              <div
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'space-between',
                }}
              >
                {template.category && (
                  <span
                    style={{
                      fontSize: 12,
                      padding: '3px 10px',
                      borderRadius: 'var(--radius-full)',
                      backgroundColor: 'var(--bg-tertiary)',
                      color: 'var(--text-tertiary)',
                    }}
                  >
                    {categoryLabelMap[template.category] || template.category}
                  </span>
                )}
                {template.isBuiltin && (
                  <span
                    style={{
                      fontSize: 11,
                      color: 'var(--primary-color)',
                      fontWeight: 500,
                    }}
                  >
                    内置
                  </span>
                )}
              </div>
            </motion.div>
          ))}
        </div>
      ) : (
        <div
          style={{
            display: 'flex',
            flexDirection: 'column',
            alignItems: 'center',
            justifyContent: 'center',
            padding: 80,
            color: 'var(--text-tertiary)',
          }}
        >
          <BookOpen size={48} strokeWidth={1} style={{ marginBottom: 12 }} />
          <p style={{ fontSize: 15 }}>暂无模板</p>
        </div>
      )}

      {/* 右键菜单 */}
      {contextMenu && (
        <div
          style={{
            position: 'fixed',
            left: contextMenu.x,
            top: contextMenu.y,
            zIndex: 10000,
            backgroundColor: 'var(--bg-secondary)',
            border: '1px solid var(--border-color)',
            borderRadius: 'var(--radius-md)',
            boxShadow: 'var(--shadow-lg)',
            padding: '4px 0',
            minWidth: 140,
          }}
        >
          <button
            onClick={handleEditTemplate}
            style={{
              display: 'flex',
              alignItems: 'center',
              gap: 8,
              width: '100%',
              padding: '8px 14px',
              border: 'none',
              background: 'transparent',
              color: 'var(--text-primary)',
              fontSize: 13,
              cursor: 'pointer',
              textAlign: 'left',
            }}
            onMouseEnter={(e) => {
              (e.currentTarget as HTMLElement).style.backgroundColor = 'var(--bg-hover)';
            }}
            onMouseLeave={(e) => {
              (e.currentTarget as HTMLElement).style.backgroundColor = 'transparent';
            }}
          >
            <Pencil size={14} />
            编辑
          </button>
          <Popconfirm
            title={`确定删除模板「${contextMenu.template.name}」吗？`}
            onConfirm={handleDeleteTemplate}
            okText="删除"
            cancelText="取消"
            okButtonProps={{ danger: true }}
          >
          <button
            disabled={contextMenu.template.isBuiltin}
            style={{
              display: 'flex',
              alignItems: 'center',
              gap: 8,
              width: '100%',
              padding: '8px 14px',
              border: 'none',
              background: 'transparent',
              color: contextMenu.template.isBuiltin ? 'var(--text-tertiary)' : '#ef4444',
              fontSize: 13,
              cursor: contextMenu.template.isBuiltin ? 'not-allowed' : 'pointer',
              textAlign: 'left',
              opacity: contextMenu.template.isBuiltin ? 0.5 : 1,
            }}
            onMouseEnter={(e) => {
              if (!contextMenu.template.isBuiltin) {
                (e.currentTarget as HTMLElement).style.backgroundColor = 'rgba(239, 68, 68, 0.08)';
              }
            }}
            onMouseLeave={(e) => {
              (e.currentTarget as HTMLElement).style.backgroundColor = 'transparent';
            }}
          >
            <Trash2 size={14} />
            删除
          </button>
          </Popconfirm>
        </div>
      )}

      {/* 编辑模板对话框 */}
      {editingTemplate && (
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          onClick={() => setEditingTemplate(null)}
          style={{
            position: 'fixed',
            inset: 0,
            zIndex: 9000,
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            backgroundColor: 'rgba(0, 0, 0, 0.3)',
            backdropFilter: 'blur(8px)',
          }}
        >
          <motion.div
            initial={{ opacity: 0, scale: 0.95 }}
            animate={{ opacity: 1, scale: 1 }}
            onClick={(e) => e.stopPropagation()}
            style={{
              width: 420,
              padding: 24,
              backgroundColor: 'var(--bg-secondary)',
              borderRadius: 'var(--radius-xl)',
              boxShadow: 'var(--shadow-xl)',
              border: '1px solid var(--border-light)',
            }}
          >
            <h3 style={{ fontSize: 18, fontWeight: 600, color: 'var(--text-primary)', marginBottom: 20 }}>
              编辑模板
            </h3>
            <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
              <div>
                <label style={{ fontSize: 13, fontWeight: 500, color: 'var(--text-primary)', marginBottom: 6, display: 'block' }}>
                  模板名称
                </label>
                <input
                  type="text"
                  value={editTemplateName}
                  onChange={(e) => setEditTemplateName(e.target.value)}
                  onKeyDown={(e) => { if (e.key === 'Enter') handleUpdateTemplate(); }}
                  style={{
                    width: '100%',
                    padding: '8px 12px',
                    borderRadius: 'var(--radius-md)',
                    border: '1px solid var(--border-color)',
                    backgroundColor: 'var(--bg-primary)',
                    color: 'var(--text-primary)',
                    fontSize: 14,
                    outline: 'none',
                    boxSizing: 'border-box',
                  }}
                />
              </div>
              <div>
                <label style={{ fontSize: 13, fontWeight: 500, color: 'var(--text-primary)', marginBottom: 6, display: 'block' }}>
                  描述
                </label>
                <input
                  type="text"
                  value={editTemplateDesc}
                  onChange={(e) => setEditTemplateDesc(e.target.value)}
                  onKeyDown={(e) => { if (e.key === 'Enter') handleUpdateTemplate(); }}
                  style={{
                    width: '100%',
                    padding: '8px 12px',
                    borderRadius: 'var(--radius-md)',
                    border: '1px solid var(--border-color)',
                    backgroundColor: 'var(--bg-primary)',
                    color: 'var(--text-primary)',
                    fontSize: 14,
                    outline: 'none',
                    boxSizing: 'border-box',
                  }}
                />
              </div>
              <div>
                <label style={{ fontSize: 13, fontWeight: 500, color: 'var(--text-primary)', marginBottom: 6, display: 'block' }}>
                  分类
                </label>
                <select
                  value={editTemplateCategory}
                  onChange={(e) => setEditTemplateCategory(e.target.value)}
                  style={{
                    width: '100%',
                    padding: '8px 12px',
                    borderRadius: 'var(--radius-md)',
                    border: '1px solid var(--border-color)',
                    backgroundColor: 'var(--bg-primary)',
                    color: 'var(--text-primary)',
                    fontSize: 14,
                    outline: 'none',
                    cursor: 'pointer',
                    boxSizing: 'border-box',
                  }}
                >
                  <option value="产品">产品</option>
                  <option value="写作">写作</option>
                  <option value="旅行">旅行</option>
                  <option value="学习">学习</option>
                  <option value="效率">效率</option>
                  <option value="阅读">阅读</option>
                </select>
              </div>
              <div style={{ display: 'flex', justifyContent: 'flex-end', gap: 8, marginTop: 4 }}>
                <button
                  onClick={() => setEditingTemplate(null)}
                  style={{
                    padding: '8px 16px',
                    borderRadius: 'var(--radius-md)',
                    border: '1px solid var(--border-color)',
                    backgroundColor: 'transparent',
                    color: 'var(--text-secondary)',
                    fontSize: 13,
                    cursor: 'pointer',
                  }}
                >
                  取消
                </button>
                <button
                  onClick={handleUpdateTemplate}
                  disabled={updating || !editTemplateName.trim()}
                  style={{
                    padding: '8px 16px',
                    borderRadius: 'var(--radius-md)',
                    border: 'none',
                    backgroundColor: 'var(--primary-color)',
                    color: 'white',
                    fontSize: 13,
                    fontWeight: 500,
                    cursor: updating || !editTemplateName.trim() ? 'not-allowed' : 'pointer',
                    opacity: updating || !editTemplateName.trim() ? 0.5 : 1,
                  }}
                >
                  {updating ? '保存中...' : '保存'}
                </button>
              </div>
            </div>
          </motion.div>
        </motion.div>
      )}
    </div>
  );
};

// 内置模板数据（备用）
function getBuiltinTemplates(): Template[] {
  return [
    {
      id: 'builtin-1',
      name: '灵感闪现',
      description: '快速记录突发的灵感想法，包含标题、详细描述和后续行动',
      category: 'general',
      config: JSON.stringify({ fields: ['title', 'content', 'action'] }),
      isBuiltin: true,
      createdAt: new Date().toISOString(),
    },
    {
      id: 'builtin-2',
      name: '会议纪要',
      description: '记录会议要点、决议事项和待办任务',
      category: 'work',
      config: JSON.stringify({ fields: ['title', 'attendees', 'keyPoints', 'actionItems'] }),
      isBuiltin: true,
      createdAt: new Date().toISOString(),
    },
    {
      id: 'builtin-3',
      name: '读书笔记',
      description: '记录阅读心得、金句摘录和思考',
      category: 'study',
      config: JSON.stringify({ fields: ['title', 'bookName', 'quotes', 'thoughts'] }),
      isBuiltin: true,
      createdAt: new Date().toISOString(),
    },
    {
      id: 'builtin-4',
      name: '项目构思',
      description: '记录项目想法、技术方案和实施计划',
      category: 'tech',
      config: JSON.stringify({ fields: ['title', 'problem', 'solution', 'techStack', 'timeline'] }),
      isBuiltin: true,
      createdAt: new Date().toISOString(),
    },
    {
      id: 'builtin-5',
      name: '设计灵感',
      description: '收集设计参考、配色方案和排版灵感',
      category: 'creative',
      config: JSON.stringify({ fields: ['title', 'reference', 'colors', 'typography'] }),
      isBuiltin: true,
      createdAt: new Date().toISOString(),
    },
    {
      id: 'builtin-6',
      name: '生活感悟',
      description: '记录日常生活中的感悟和思考',
      category: 'life',
      config: JSON.stringify({ fields: ['title', 'content', 'mood'] }),
      isBuiltin: true,
      createdAt: new Date().toISOString(),
    },
  ];
}

export default Templates;
