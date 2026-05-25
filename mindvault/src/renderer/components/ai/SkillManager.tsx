import React, { useState, useEffect, useCallback, useMemo } from 'react';
import { Input, Modal, Tooltip, message } from 'antd';
import { motion, AnimatePresence } from 'framer-motion';
import {
  Search, Plus, Edit3, Trash2, ChevronRight, ChevronDown,
  FolderPlus, FolderOpen, MoreVertical, Check, X, ToggleLeft, ToggleRight,
  Zap, Wrench, GripHorizontal, Eye, EyeOff, Tag, BookOpen,
} from 'lucide-react';
import { useSkillStore } from '../../stores/skillStore';
import type { Skill, SkillCategory, SkillCreateParams } from '../../../shared/skill-types';

const { TextArea } = Input;

interface SkillManagerProps {
  visible: boolean;
  onUseSkill?: (skill: Skill) => void;
  disabled?: boolean;
}

/**
 * 技能管理组件
 * 替代 AIChatFullscreen 中硬编码的技能 Tab
 * 支持分类浏览、搜索、启用/禁用、编辑、新增、删除
 */
const SkillManager: React.FC<SkillManagerProps> = ({ visible, onUseSkill, disabled }) => {
  const {
    skills, categories, selectedCategory, searchQuery, loading,
    activeSkills, detectedSkills,
    loadSkills, loadCategories, setSelectedCategory, setSearchQuery,
    activateSkill, deactivateSkill, clearActiveSkills,
    createSkill, updateSkill, deleteSkill, toggleSkill,
    createCategory, updateCategory, deleteCategory,
    getFilteredSkills,
  } = useSkillStore();

  const [expandedCategories, setExpandedCategories] = useState<Set<string>>(new Set());
  const [showCreateSkill, setShowCreateSkill] = useState(false);
  const [showCreateCategory, setShowCreateCategory] = useState(false);
  const [editingSkill, setEditingSkill] = useState<Skill | null>(null);
  const [editingCategory, setEditingCategory] = useState<SkillCategory | null>(null);
  const [skillDetail, setSkillDetail] = useState<Skill | null>(null);
  const [contextMenu, setContextMenu] = useState<{ x: number; y: number; type: 'skill' | 'category'; item: any } | null>(null);

  // 新建/编辑技能的表单状态
  const [formName, setFormName] = useState('');
  const [formNameEn, setFormNameEn] = useState('');
  const [formIcon, setFormIcon] = useState('🔧');
  const [formCategory, setFormCategory] = useState('');
  const [formDescription, setFormDescription] = useState('');
  const [formTriggers, setFormTriggers] = useState('');
  const [formContent, setFormContent] = useState('');

  // 新建/编辑分类的表单状态
  const [catFormName, setCatFormName] = useState('');
  const [catFormIcon, setCatFormIcon] = useState('📁');
  const [catFormDesc, setCatFormDesc] = useState('');

  // 加载数据
  useEffect(() => {
    if (visible) {
      loadSkills();
      loadCategories();
    }
  }, [visible]);

  // 默认展开所有分类
  useEffect(() => {
    if (categories.length > 0 && expandedCategories.size === 0) {
      setExpandedCategories(new Set(categories.map(c => c.name)));
    }
  }, [categories]);

  // 获取过滤后的技能
  const filteredSkills = useMemo(() => getFilteredSkills(), [skills, selectedCategory, searchQuery]);

  // 按分类分组
  const groupedSkills = useMemo(() => {
    const groups: Record<string, Skill[]> = {};
    for (const skill of filteredSkills) {
      if (!groups[skill.category]) {
        groups[skill.category] = [];
      }
      groups[skill.category].push(skill);
    }
    return groups;
  }, [filteredSkills]);

  // ===== 事件处理 =====

  const toggleCategory = (name: string) => {
    const next = new Set(expandedCategories);
    if (next.has(name)) next.delete(name);
    else next.add(name);
    setExpandedCategories(next);
  };

  const handleUseSkill = (skill: Skill) => {
    if (disabled) return;
    activateSkill(skill.id);
    onUseSkill?.(skill);
  };

  const handleContextMenu = (e: React.MouseEvent, type: 'skill' | 'category', item: any) => {
    e.preventDefault();
    e.stopPropagation();
    setContextMenu({ x: e.clientX, y: e.clientY, type, item });
  };

  const closeContextMenu = () => setContextMenu(null);

  // 打开创建技能弹窗
  const openCreateSkill = (category?: string) => {
    setFormName('');
    setFormNameEn('');
    setFormIcon('🔧');
    setFormCategory(category || selectedCategory || categories[0]?.name || '');
    setFormDescription('');
    setFormTriggers('');
    setFormContent('');
    setEditingSkill(null);
    setShowCreateSkill(true);
  };

  // 打开编辑技能弹窗
  const openEditSkill = (skill: Skill) => {
    setFormName(skill.name);
    setFormNameEn(skill.nameEn);
    setFormIcon(skill.icon);
    setFormCategory(skill.category);
    setFormDescription(skill.description);
    setFormTriggers(skill.triggers.join(', '));
    setFormContent(skill.content);
    setEditingSkill(skill);
    setShowCreateSkill(true);
    closeContextMenu();
  };

  // 保存技能
  const handleSaveSkill = async () => {
    if (!formName.trim() || !formDescription.trim()) {
      message.warning('请填写技能名称和描述');
      return;
    }

    const params: SkillCreateParams = {
      name: formName.trim(),
      nameEn: formNameEn.trim() || undefined,
      icon: formIcon,
      category: formCategory,
      description: formDescription.trim(),
      triggers: formTriggers.split(/[,，]/).map(t => t.trim()).filter(Boolean),
      content: formContent,
    };

    if (editingSkill) {
      const success = await updateSkill(editingSkill.id, params);
      if (success) {
        message.success('技能已更新');
        setShowCreateSkill(false);
      }
    } else {
      const skill = await createSkill(params);
      if (skill) {
        message.success('技能已创建');
        setShowCreateSkill(false);
      }
    }
  };

  // 删除技能
  const handleDeleteSkill = async (skill: Skill) => {
    Modal.confirm({
      title: '删除技能',
      content: `确定要删除技能"${skill.name}"吗？此操作不可撤销。`,
      okText: '删除',
      okType: 'danger',
      cancelText: '取消',
      onOk: async () => {
        const success = await deleteSkill(skill.id);
        if (success) message.success('技能已删除');
      },
    });
    closeContextMenu();
  };

  // 切换技能启用状态
  const handleToggleSkill = async (skill: Skill) => {
    await toggleSkill(skill.id);
    closeContextMenu();
  };

  // 打开创建分类弹窗
  const openCreateCategory = () => {
    setCatFormName('');
    setCatFormIcon('📁');
    setCatFormDesc('');
    setEditingCategory(null);
    setShowCreateCategory(true);
  };

  // 打开编辑分类弹窗
  const openEditCategory = (cat: SkillCategory) => {
    setCatFormName(cat.name);
    setCatFormIcon(cat.icon);
    setCatFormDesc(cat.description || '');
    setEditingCategory(cat);
    setShowCreateCategory(true);
    closeContextMenu();
  };

  // 保存分类
  const handleSaveCategory = async () => {
    if (!catFormName.trim()) {
      message.warning('请填写分类名称');
      return;
    }

    if (editingCategory) {
      const success = await updateCategory(editingCategory.name, {
        name: catFormName.trim(),
        icon: catFormIcon,
        description: catFormDesc.trim(),
      });
      if (success) {
        message.success('分类已更新');
        setShowCreateCategory(false);
      }
    } else {
      const cat = await createCategory({
        name: catFormName.trim(),
        icon: catFormIcon,
        description: catFormDesc.trim(),
      });
      if (cat) {
        message.success('分类已创建');
        setShowCreateCategory(false);
      }
    }
  };

  // 删除分类
  const handleDeleteCategory = async (cat: SkillCategory) => {
    const skillsInCat = skills.filter(s => s.category === cat.name);
    if (skillsInCat.length > 0) {
      Modal.confirm({
        title: '删除分类',
        content: `分类"${cat.name}"下还有 ${skillsInCat.length} 个技能，删除后这些技能将移至"未分类"。确定要删除吗？`,
        okText: '删除',
        okType: 'danger',
        cancelText: '取消',
        onOk: async () => {
          const success = await deleteCategory(cat.name, '未分类');
          if (success) message.success('分类已删除');
        },
      });
    } else {
      const success = await deleteCategory(cat.name);
      if (success) message.success('分类已删除');
    }
    closeContextMenu();
  };

  // 常用 emoji 选择器
  const EMOJI_OPTIONS = ['🔧', '📄', '📝', '📊', '📽️', '💻', '🎨', '🧪', '🔒', '🚀', '📋', '📅', '🏛️', '⚡', '👁️', '🤖', '📖', '🎬', '🌐', '🖥️', '🎵', '💡', '🗂️', '🏷️', '🔍', '✅', '🧩', '🏗️', '📱', '🎭', '📁', '🔴', '🛡️', '磁场', '🌀'];

  if (!visible) return null;

  return (
    <div style={{ flex: 1, overflowY: 'auto', padding: 16, position: 'relative' }} onClick={closeContextMenu}>
      {/* 头部 */}
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 12 }}>
        <div>
          <div style={{ fontSize: 15, fontWeight: 600, color: 'var(--text-primary)', marginBottom: 2 }}>AI 技能库</div>
          <div style={{ fontSize: 12, color: 'var(--text-tertiary)' }}>
            {skills.length} 个技能 · {categories.length} 个分类 · 支持自然语言唤醒
          </div>
        </div>
        <div style={{ display: 'flex', gap: 6 }}>
          <Tooltip title="新建分类">
            <button onClick={openCreateCategory} style={iconBtnStyle}>
              <FolderPlus size={15} />
            </button>
          </Tooltip>
          <Tooltip title="新建技能">
            <button onClick={() => openCreateSkill()} style={iconBtnStyle}>
              <Plus size={15} />
            </button>
          </Tooltip>
        </div>
      </div>

      {/* 搜索栏 */}
      <div style={{ position: 'relative', marginBottom: 12 }}>
        <Search size={14} style={{ position: 'absolute', left: 10, top: '50%', transform: 'translateY(-50%)', color: 'var(--text-tertiary)' }} />
        <input
          placeholder="搜索技能..."
          value={searchQuery}
          onChange={(e) => setSearchQuery(e.target.value)}
          style={{
            width: '100%', padding: '8px 12px 8px 32px', borderRadius: 8,
            border: '1px solid var(--border-light)', background: 'var(--bg-secondary)',
            color: 'var(--text-primary)', fontSize: 13, outline: 'none',
            boxSizing: 'border-box',
          }}
        />
        {searchQuery && (
          <button onClick={() => setSearchQuery('')} style={{ position: 'absolute', right: 8, top: '50%', transform: 'translateY(-50%)', background: 'none', border: 'none', cursor: 'pointer', color: 'var(--text-tertiary)' }}>
            <X size={13} />
          </button>
        )}
      </div>

      {/* 分类筛选标签 */}
      <div style={{ display: 'flex', gap: 6, marginBottom: 14, flexWrap: 'wrap' }}>
        <button
          onClick={() => setSelectedCategory(null)}
          style={{
            ...chipStyle,
            background: !selectedCategory ? 'var(--primary-color)' : 'var(--bg-secondary)',
            color: !selectedCategory ? '#fff' : 'var(--text-secondary)',
            borderColor: !selectedCategory ? 'var(--primary-color)' : 'var(--border-light)',
          }}
        >
          全部 ({skills.length})
        </button>
        {categories.filter(c => c.skillCount && c.skillCount > 0).map(cat => (
          <button
            key={cat.name}
            onClick={() => setSelectedCategory(selectedCategory === cat.name ? null : cat.name)}
            style={{
              ...chipStyle,
              background: selectedCategory === cat.name ? 'var(--primary-color)' : 'var(--bg-secondary)',
              color: selectedCategory === cat.name ? '#fff' : 'var(--text-secondary)',
              borderColor: selectedCategory === cat.name ? 'var(--primary-color)' : 'var(--border-light)',
            }}
          >
            {cat.icon} {cat.name} ({cat.skillCount})
          </button>
        ))}
      </div>

      {/* 激活的技能提示 */}
      {activeSkills.length > 0 && (
        <div style={{
          marginBottom: 12, padding: '8px 12px', borderRadius: 8,
          background: 'var(--primary-bg)', border: '1px solid var(--primary-color)',
          display: 'flex', alignItems: 'center', gap: 8, flexWrap: 'wrap',
        }}>
          <Zap size={13} style={{ color: 'var(--primary-color)' }} />
          <span style={{ fontSize: 11, color: 'var(--primary-color)', fontWeight: 500 }}>已激活:</span>
          {activeSkills.map(id => {
            const skill = skills.find(s => s.id === id);
            if (!skill) return null;
            return (
              <span key={id} style={{
                fontSize: 11, padding: '2px 8px', borderRadius: 4,
                background: 'var(--primary-color)', color: '#fff',
                display: 'inline-flex', alignItems: 'center', gap: 4,
              }}>
                {skill.icon} {skill.name}
                <button onClick={() => deactivateSkill(id)} style={{ background: 'none', border: 'none', color: '#fff', cursor: 'pointer', padding: 0, lineHeight: 1 }}>
                  <X size={10} />
                </button>
              </span>
            );
          })}
          <button onClick={clearActiveSkills} style={{ fontSize: 11, color: 'var(--text-tertiary)', background: 'none', border: 'none', cursor: 'pointer', marginLeft: 'auto' }}>
            清除全部
          </button>
        </div>
      )}

      {/* 技能列表（按分类分组） */}
      {loading ? (
        <div style={{ textAlign: 'center', padding: 40, color: 'var(--text-tertiary)', fontSize: 13 }}>加载中...</div>
      ) : filteredSkills.length === 0 ? (
        <div style={{ textAlign: 'center', padding: 40, color: 'var(--text-tertiary)', fontSize: 13 }}>
          {searchQuery ? '没有找到匹配的技能' : '暂无技能'}
        </div>
      ) : !selectedCategory ? (
        // 分类分组视图
        <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
          {categories.filter(c => groupedSkills[c.name]?.length > 0).map(cat => (
            <div key={cat.name}>
              {/* 分类标题 */}
              <div
                onClick={() => toggleCategory(cat.name)}
                onContextMenu={(e) => handleContextMenu(e, 'category', cat)}
                style={{
                  display: 'flex', alignItems: 'center', gap: 8, padding: '6px 0',
                  cursor: 'pointer', userSelect: 'none',
                }}
              >
                {expandedCategories.has(cat.name) ? <ChevronDown size={14} style={{ color: 'var(--text-tertiary)' }} /> : <ChevronRight size={14} style={{ color: 'var(--text-tertiary)' }} />}
                <span style={{ fontSize: 14 }}>{cat.icon}</span>
                <span style={{ fontSize: 13, fontWeight: 600, color: 'var(--text-primary)' }}>{cat.name}</span>
                <span style={{ fontSize: 11, color: 'var(--text-tertiary)' }}>{groupedSkills[cat.name]?.length || 0}</span>
                <button
                  onClick={(e) => { e.stopPropagation(); openCreateSkill(cat.name); }}
                  style={{ marginLeft: 'auto', background: 'none', border: 'none', cursor: 'pointer', color: 'var(--text-tertiary)', opacity: 0.6 }}
                  title={`在"${cat.name}"下新建技能`}
                >
                  <Plus size={13} />
                </button>
              </div>

              {/* 分类下的技能 */}
              <AnimatePresence>
                {expandedCategories.has(cat.name) && (
                  <motion.div
                    initial={{ height: 0, opacity: 0 }}
                    animate={{ height: 'auto', opacity: 1 }}
                    exit={{ height: 0, opacity: 0 }}
                    transition={{ duration: 0.2 }}
                    style={{ overflow: 'hidden' }}
                  >
                    <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(200px, 1fr))', gap: 8, paddingLeft: 22 }}>
                      {(groupedSkills[cat.name] || []).map(skill => (
                        <SkillCard
                          key={skill.id}
                          skill={skill}
                          isActive={activeSkills.includes(skill.id)}
                          isDetected={detectedSkills.some(d => d.skill.id === skill.id)}
                          disabled={disabled}
                          onUse={() => handleUseSkill(skill)}
                          onContextMenu={(e) => handleContextMenu(e, 'skill', skill)}
                          onDetail={() => setSkillDetail(skill)}
                        />
                      ))}
                    </div>
                  </motion.div>
                )}
              </AnimatePresence>
            </div>
          ))}
        </div>
      ) : (
        // 单分类视图
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(200px, 1fr))', gap: 8 }}>
          {filteredSkills.map(skill => (
            <SkillCard
              key={skill.id}
              skill={skill}
              isActive={activeSkills.includes(skill.id)}
              isDetected={detectedSkills.some(d => d.skill.id === skill.id)}
              disabled={disabled}
              onUse={() => handleUseSkill(skill)}
              onContextMenu={(e) => handleContextMenu(e, 'skill', skill)}
              onDetail={() => setSkillDetail(skill)}
            />
          ))}
        </div>
      )}

      {/* 右键菜单 */}
      {contextMenu && (
        <div
          style={{
            position: 'fixed', left: contextMenu.x, top: contextMenu.y,
            background: 'var(--bg-elevated)', border: '1px solid var(--border-light)',
            borderRadius: 8, padding: '4px 0', minWidth: 160, zIndex: 1000,
            boxShadow: '0 4px 12px rgba(0,0,0,0.15)',
          }}
          onClick={(e) => e.stopPropagation()}
        >
          {contextMenu.type === 'skill' && (
            <>
              <ContextMenuItem icon={<Eye size={13} />} label="查看详情" onClick={() => { setSkillDetail(contextMenu.item); closeContextMenu(); }} />
              <ContextMenuItem icon={<Edit3 size={13} />} label="编辑技能" onClick={() => openEditSkill(contextMenu.item)} />
              <ContextMenuItem
                icon={contextMenu.item.enabled ? <ToggleRight size={13} /> : <ToggleLeft size={13} />}
                label={contextMenu.item.enabled ? '禁用技能' : '启用技能'}
                onClick={() => handleToggleSkill(contextMenu.item)}
              />
              <div style={{ height: 1, background: 'var(--border-light)', margin: '4px 0' }} />
              <ContextMenuItem icon={<Trash2 size={13} />} label="删除技能" danger onClick={() => handleDeleteSkill(contextMenu.item)} />
            </>
          )}
          {contextMenu.type === 'category' && (
            <>
              <ContextMenuItem icon={<Edit3 size={13} />} label="编辑分类" onClick={() => openEditCategory(contextMenu.item)} />
              {!contextMenu.item.isPreset && (
                <ContextMenuItem icon={<Trash2 size={13} />} label="删除分类" danger onClick={() => handleDeleteCategory(contextMenu.item)} />
              )}
            </>
          )}
        </div>
      )}

      {/* 创建/编辑技能弹窗 */}
      <Modal
        title={editingSkill ? '编辑技能' : '新建技能'}
        open={showCreateSkill}
        onCancel={() => setShowCreateSkill(false)}
        onOk={handleSaveSkill}
        okText={editingSkill ? '保存' : '创建'}
        width={560}
        styles={{ body: { maxHeight: '60vh', overflowY: 'auto' } }}
      >
        <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
          <div style={{ display: 'flex', gap: 10 }}>
            <div style={{ flex: 1 }}>
              <label style={labelStyle}>技能名称 *</label>
              <input value={formName} onChange={e => setFormName(e.target.value)} placeholder="如：PDF 专家" style={inputStyle} />
            </div>
            <div style={{ width: 100 }}>
              <label style={labelStyle}>图标</label>
              <div style={{ display: 'flex', flexWrap: 'wrap', gap: 4 }}>
                {EMOJI_OPTIONS.slice(0, 16).map(emoji => (
                  <button
                    key={emoji}
                    onClick={() => setFormIcon(emoji)}
                    style={{
                      width: 28, height: 28, borderRadius: 6, border: formIcon === emoji ? '2px solid var(--primary-color)' : '1px solid var(--border-light)',
                      background: formIcon === emoji ? 'var(--primary-bg)' : 'var(--bg-secondary)',
                      cursor: 'pointer', fontSize: 14, display: 'flex', alignItems: 'center', justifyContent: 'center',
                    }}
                  >{emoji}</button>
                ))}
              </div>
            </div>
          </div>
          <div>
            <label style={labelStyle}>英文名称（用于触发）</label>
            <input value={formNameEn} onChange={e => setFormNameEn(e.target.value)} placeholder="如：pdf" style={inputStyle} />
          </div>
          <div>
            <label style={labelStyle}>分类 *</label>
            <select value={formCategory} onChange={e => setFormCategory(e.target.value)} style={inputStyle}>
              {categories.map(cat => (
                <option key={cat.name} value={cat.name}>{cat.icon} {cat.name}</option>
              ))}
            </select>
          </div>
          <div>
            <label style={labelStyle}>描述 *</label>
            <input value={formDescription} onChange={e => setFormDescription(e.target.value)} placeholder="一句话描述技能用途" style={inputStyle} />
          </div>
          <div>
            <label style={labelStyle}>触发关键词（逗号分隔）</label>
            <input value={formTriggers} onChange={e => setFormTriggers(e.target.value)} placeholder="如：pdf, pdf文件, pdf文档" style={inputStyle} />
          </div>
          <div>
            <label style={labelStyle}>技能内容（使用指南）</label>
            <TextArea
              value={formContent}
              onChange={e => setFormContent(e.target.value)}
              placeholder="详细的使用指南和最佳实践..."
              rows={6}
              style={{ ...inputStyle, resize: 'vertical', fontFamily: 'inherit' }}
            />
          </div>
        </div>
      </Modal>

      {/* 创建/编辑分类弹窗 */}
      <Modal
        title={editingCategory ? '编辑分类' : '新建分类'}
        open={showCreateCategory}
        onCancel={() => setShowCreateCategory(false)}
        onOk={handleSaveCategory}
        okText={editingCategory ? '保存' : '创建'}
        width={400}
      >
        <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
          <div>
            <label style={labelStyle}>分类名称 *</label>
            <input value={catFormName} onChange={e => setCatFormName(e.target.value)} placeholder="如：前端开发" style={inputStyle} />
          </div>
          <div>
            <label style={labelStyle}>图标</label>
            <div style={{ display: 'flex', flexWrap: 'wrap', gap: 4 }}>
              {EMOJI_OPTIONS.map(emoji => (
                <button
                  key={emoji}
                  onClick={() => setCatFormIcon(emoji)}
                  style={{
                    width: 28, height: 28, borderRadius: 6, border: catFormIcon === emoji ? '2px solid var(--primary-color)' : '1px solid var(--border-light)',
                    background: catFormIcon === emoji ? 'var(--primary-bg)' : 'var(--bg-secondary)',
                    cursor: 'pointer', fontSize: 14, display: 'flex', alignItems: 'center', justifyContent: 'center',
                  }}
                >{emoji}</button>
              ))}
            </div>
          </div>
          <div>
            <label style={labelStyle}>描述</label>
            <input value={catFormDesc} onChange={e => setCatFormDesc(e.target.value)} placeholder="分类描述" style={inputStyle} />
          </div>
        </div>
      </Modal>

      {/* 技能详情弹窗 */}
      <Modal
        title={
          <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
            <span style={{ fontSize: 20 }}>{skillDetail?.icon}</span>
            <span>{skillDetail?.name}</span>
          </div>
        }
        open={!!skillDetail}
        onCancel={() => setSkillDetail(null)}
        footer={[
          <button key="close" onClick={() => setSkillDetail(null)} style={modalBtnStyle}>关闭</button>,
          skillDetail && (
            <button key="use" onClick={() => { handleUseSkill(skillDetail); setSkillDetail(null); }} style={{ ...modalBtnStyle, background: 'var(--primary-color)', color: '#fff' }}>
              使用此技能
            </button>
          ),
        ]}
        width={520}
        styles={{ body: { maxHeight: '50vh', overflowY: 'auto' } }}
      >
        {skillDetail && (
          <div>
            <div style={{ fontSize: 12, color: 'var(--text-tertiary)', marginBottom: 12 }}>
              {skillDetail.category} · v{skillDetail.version} · 使用 {skillDetail.useCount || 0} 次
            </div>
            <div style={{ fontSize: 13, color: 'var(--text-primary)', marginBottom: 12, lineHeight: 1.6 }}>
              {skillDetail.description}
            </div>
            {skillDetail.triggers.length > 0 && (
              <div style={{ marginBottom: 12 }}>
                <div style={{ fontSize: 12, fontWeight: 500, color: 'var(--text-secondary)', marginBottom: 6 }}>触发关键词</div>
                <div style={{ display: 'flex', flexWrap: 'wrap', gap: 4 }}>
                  {skillDetail.triggers.map(t => (
                    <span key={t} style={{ fontSize: 11, padding: '2px 8px', borderRadius: 4, background: 'var(--bg-tertiary)', color: 'var(--text-secondary)' }}>{t}</span>
                  ))}
                </div>
              </div>
            )}
            {skillDetail.content && (
              <div>
                <div style={{ fontSize: 12, fontWeight: 500, color: 'var(--text-secondary)', marginBottom: 6 }}>使用指南</div>
                <div style={{
                  fontSize: 12, color: 'var(--text-secondary)', lineHeight: 1.7,
                  padding: 12, borderRadius: 8, background: 'var(--bg-secondary)',
                  whiteSpace: 'pre-wrap',
                }}>
                  {skillDetail.content}
                </div>
              </div>
            )}
          </div>
        )}
      </Modal>
    </div>
  );
};

// ===== 子组件 =====

/** 技能卡片 */
const SkillCard: React.FC<{
  skill: Skill;
  isActive: boolean;
  isDetected: boolean;
  disabled?: boolean;
  onUse: () => void;
  onContextMenu: (e: React.MouseEvent) => void;
  onDetail: () => void;
}> = ({ skill, isActive, isDetected, disabled, onUse, onContextMenu, onDetail }) => (
  <motion.div
    whileHover={{ scale: 1.02 }}
    whileTap={{ scale: 0.98 }}
  >
    <div
      style={{
        display: 'flex', flexDirection: 'column', gap: 6,
        padding: '12px 14px', borderRadius: 10,
        border: isActive ? '1px solid var(--primary-color)' : '1px solid var(--border-light)',
        background: isActive ? 'var(--primary-bg)' : 'var(--bg-secondary)',
        cursor: disabled ? 'not-allowed' : 'pointer',
        opacity: !skill.enabled ? 0.45 : (disabled ? 0.5 : 1),
        transition: 'all 0.15s ease',
        position: 'relative',
      }}
      onClick={onUse}
      onContextMenu={onContextMenu}
      onDoubleClick={onDetail}
    >
      {/* 状态指示 */}
      {isDetected && (
        <div style={{
          position: 'absolute', top: 6, right: 6,
          width: 6, height: 6, borderRadius: '50%',
          background: '#f59e0b',
          boxShadow: '0 0 6px rgba(245,158,11,0.5)',
        }} title="AI 检测到匹配" />
      )}

      <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
        <span style={{ fontSize: 18 }}>{skill.icon}</span>
        <span style={{ fontSize: 13, fontWeight: 600, color: 'var(--text-primary)', flex: 1, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
          {skill.name}
        </span>
        {!skill.enabled && <EyeOff size={11} style={{ color: 'var(--text-tertiary)', flexShrink: 0 }} />}
      </div>
      <span style={{ fontSize: 11, color: 'var(--text-tertiary)', lineHeight: 1.4, display: '-webkit-box', WebkitLineClamp: 2, WebkitBoxOrient: 'vertical', overflow: 'hidden' }}>
        {skill.description}
      </span>
      {skill.useCount > 0 && (
        <div style={{ fontSize: 10, color: 'var(--text-quaternary)', marginTop: 'auto' }}>
          使用 {skill.useCount} 次
        </div>
      )}
    </div>
  </motion.div>
);

/** 右键菜单项 */
const ContextMenuItem: React.FC<{
  icon: React.ReactNode;
  label: string;
  danger?: boolean;
  onClick: () => void;
}> = ({ icon, label, danger, onClick }) => (
  <button
    onClick={onClick}
    style={{
      display: 'flex', alignItems: 'center', gap: 8, width: '100%',
      padding: '7px 14px', border: 'none', background: 'none',
      color: danger ? '#ef4444' : 'var(--text-primary)',
      fontSize: 13, cursor: 'pointer', textAlign: 'left',
    }}
    onMouseEnter={(e) => { (e.target as HTMLElement).style.background = 'var(--bg-tertiary)'; }}
    onMouseLeave={(e) => { (e.target as HTMLElement).style.background = 'none'; }}
  >
    {icon}
    {label}
  </button>
);

// ===== 样式 =====

const iconBtnStyle: React.CSSProperties = {
  width: 32, height: 32, borderRadius: 8,
  border: '1px solid var(--border-light)', background: 'var(--bg-secondary)',
  color: 'var(--text-secondary)', cursor: 'pointer',
  display: 'flex', alignItems: 'center', justifyContent: 'center',
};

const chipStyle: React.CSSProperties = {
  padding: '4px 10px', borderRadius: 6, border: '1px solid var(--border-light)',
  background: 'var(--bg-secondary)', color: 'var(--text-secondary)',
  fontSize: 12, cursor: 'pointer', whiteSpace: 'nowrap',
};

const labelStyle: React.CSSProperties = {
  display: 'block', fontSize: 12, fontWeight: 500, color: 'var(--text-secondary)', marginBottom: 4,
};

const inputStyle: React.CSSProperties = {
  width: '100%', padding: '7px 10px', borderRadius: 6,
  border: '1px solid var(--border-light)', background: 'var(--bg-secondary)',
  color: 'var(--text-primary)', fontSize: 13, outline: 'none', boxSizing: 'border-box',
};

const modalBtnStyle: React.CSSProperties = {
  padding: '6px 16px', borderRadius: 6, border: '1px solid var(--border-light)',
  background: 'var(--bg-secondary)', color: 'var(--text-primary)',
  fontSize: 13, cursor: 'pointer',
};

export default SkillManager;
