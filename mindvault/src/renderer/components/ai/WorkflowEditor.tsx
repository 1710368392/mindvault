import React, { useState, useEffect } from 'react';
import { X, Play, Plus, Trash2, GripVertical, ChevronDown, ChevronUp } from 'lucide-react';
import { useAIStore } from '../../stores/aiStore';

interface Props {
  onClose: () => void;
}

const STEP_TYPES = [
  { value: 'ai', label: 'AI 生成', icon: '🤖' },
  { value: 'tool', label: '工具调用', icon: '🔧' },
];

const TOOL_OPTIONS = [
  'web_search', 'read_creativities', 'read_creativity_full', 'scan_creativity_library',
  'create_creativity', 'batch_create_creativities', 'smart_edit_creativity',
  'organize_creativities', 'update_creativity', 'delete_creativity',
  'search_and_save', 'deep_research', 'preview_creativity', 'preview_markdown',
  'generate_and_preview', 'execute_code', 'run_script', 'data_transform',
];

const WorkflowEditor: React.FC<Props> = ({ onClose }) => {
  const workflows = useAIStore((s) => s.workflows);
  const loadWorkflows = useAIStore((s) => s.loadWorkflows);
  const createWorkflow = useAIStore((s) => s.createWorkflow);
  const deleteWorkflow = useAIStore((s) => s.deleteWorkflow);
  const runWorkflow = useAIStore((s) => s.runWorkflow);
  const agentIsRunning = useAIStore((s) => s.agentIsRunning);

  const [editingId, setEditingId] = useState<string | null>(null);
  const [showCreate, setShowCreate] = useState(false);
  const [newName, setNewName] = useState('');
  const [newDesc, setNewDesc] = useState('');
  const [newIcon, setNewIcon] = useState('⚙️');
  const [newSteps, setNewSteps] = useState<any[]>([]);

  useEffect(() => { loadWorkflows(); }, []);

  const handleCreate = async () => {
    if (!newName.trim()) return;
    await createWorkflow({
      name: newName.trim(),
      description: newDesc.trim(),
      icon: newIcon,
      steps: newSteps,
    });
    setNewName(''); setNewDesc(''); setNewIcon('⚙️'); setNewSteps([]);
    setShowCreate(false);
  };

  const addStep = (isCreate: boolean) => {
    const step = { id: `s${Date.now()}`, name: '新步骤', type: 'ai', goal: '', toolName: '', toolArgs: {} };
    if (isCreate) {
      setNewSteps([...newSteps, step]);
    }
  };

  const updateStep = (steps: any[], index: number, updates: any) => {
    const newSteps = [...steps];
    newSteps[index] = { ...newSteps[index], ...updates };
    return newSteps;
  };

  const removeStep = (steps: any[], index: number) => {
    return steps.filter((_, i) => i !== index);
  };

  return (
    <div style={{ position: 'fixed', inset: 0, zIndex: 10000, display: 'flex', alignItems: 'center', justifyContent: 'center', background: 'rgba(0,0,0,0.4)' }}>
      <div style={{ width: 560, maxHeight: '80vh', background: 'var(--bg-primary)', borderRadius: 16, boxShadow: '0 20px 60px rgba(0,0,0,0.3)', display: 'flex', flexDirection: 'column', overflow: 'hidden' }}>
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '16px 20px', borderBottom: '1px solid var(--border-light)' }}>
          <div style={{ fontSize: 16, fontWeight: 700, color: 'var(--text-primary)' }}>⚙️ 自定义工作流</div>
          <button onClick={onClose} style={{ background: 'none', border: 'none', cursor: 'pointer', color: 'var(--text-tertiary)' }}><X size={18} /></button>
        </div>

        <div style={{ flex: 1, overflowY: 'auto', padding: 16 }}>
          {workflows.map((wf: any) => (
            <div key={wf.id} style={{ marginBottom: 10, borderRadius: 10, border: '1px solid var(--border-light)', background: 'var(--bg-secondary)', overflow: 'hidden' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 10, padding: '12px 14px' }}>
                <span style={{ fontSize: 22 }}>{wf.icon}</span>
                <div style={{ flex: 1 }}>
                  <div style={{ fontSize: 14, fontWeight: 600, color: 'var(--text-primary)' }}>{wf.name}</div>
                  <div style={{ fontSize: 11, color: 'var(--text-tertiary)' }}>{wf.description || '暂无描述'} · {wf.steps?.length || 0} 步 · 运行 {wf.runCount || 0} 次</div>
                </div>
                <button onClick={() => runWorkflow(wf.id)} disabled={agentIsRunning}
                  style={{ display: 'flex', alignItems: 'center', gap: 4, padding: '6px 12px', borderRadius: 8, border: 'none', background: 'var(--primary-color)', color: '#fff', cursor: agentIsRunning ? 'not-allowed' : 'pointer', fontSize: 12, fontWeight: 600, opacity: agentIsRunning ? 0.5 : 1 }}>
                  <Play size={12} /> 运行
                </button>
                {!wf.isPreset && (
                  <button onClick={() => deleteWorkflow(wf.id)} style={{ background: 'none', border: 'none', cursor: 'pointer', color: 'var(--text-tertiary)' }}><Trash2 size={14} /></button>
                )}
              </div>
              {wf.steps?.length > 0 && (
                <div style={{ padding: '0 14px 10px', display: 'flex', gap: 6, flexWrap: 'wrap' }}>
                  {wf.steps.map((step: any, i: number) => (
                    <div key={step.id} style={{ display: 'flex', alignItems: 'center', gap: 4, padding: '3px 8px', borderRadius: 6, background: step.type === 'tool' ? 'rgba(59,130,246,0.08)' : 'rgba(139,92,246,0.08)', fontSize: 11 }}>
                      <span>{step.type === 'tool' ? '🔧' : '🤖'}</span>
                      <span style={{ color: 'var(--text-secondary)' }}>{step.name}</span>
                      {i < wf.steps.length - 1 && <span style={{ color: 'var(--text-tertiary)' }}>→</span>}
                    </div>
                  ))}
                </div>
              )}
            </div>
          ))}

          {showCreate && (
            <div style={{ marginTop: 12, padding: 16, borderRadius: 10, border: '1px dashed var(--primary-color)', background: 'var(--primary-bg)' }}>
              <div style={{ display: 'flex', gap: 8, marginBottom: 10 }}>
                <select value={newIcon} onChange={(e) => setNewIcon(e.target.value)}
                  style={{ width: 48, height: 36, borderRadius: 8, border: '1px solid var(--border-light)', textAlign: 'center', fontSize: 18, background: 'var(--bg-primary)' }}>
                  {['⚙️', '💡', '📋', '🔬', '✨', '🎨', '📝', '🔍', '📊'].map(icon => <option key={icon} value={icon}>{icon}</option>)}
                </select>
                <input value={newName} onChange={(e) => setNewName(e.target.value)} placeholder="工作流名称"
                  style={{ flex: 1, height: 36, borderRadius: 8, border: '1px solid var(--border-light)', padding: '0 10px', fontSize: 13, background: 'var(--bg-primary)', color: 'var(--text-primary)' }} />
              </div>
              <input value={newDesc} onChange={(e) => setNewDesc(e.target.value)} placeholder="描述（可选）"
                style={{ width: '100%', height: 32, borderRadius: 8, border: '1px solid var(--border-light)', padding: '0 10px', fontSize: 12, marginBottom: 10, background: 'var(--bg-primary)', color: 'var(--text-primary)' }} />

              <div style={{ fontSize: 12, fontWeight: 600, color: 'var(--text-secondary)', marginBottom: 8 }}>步骤列表</div>
              {newSteps.map((step, i) => (
                <div key={step.id} style={{ display: 'flex', gap: 6, alignItems: 'center', marginBottom: 6 }}>
                  <span style={{ fontSize: 11, color: 'var(--text-tertiary)', width: 20 }}>{i + 1}.</span>
                  <select value={step.type} onChange={(e) => setNewSteps(updateStep(newSteps, i, { type: e.target.value }))}
                    style={{ width: 80, height: 28, borderRadius: 6, border: '1px solid var(--border-light)', fontSize: 11, background: 'var(--bg-primary)' }}>
                    {STEP_TYPES.map(t => <option key={t.value} value={t.value}>{t.icon} {t.label}</option>)}
                  </select>
                  <input value={step.name} onChange={(e) => setNewSteps(updateStep(newSteps, i, { name: e.target.value }))}
                    placeholder="步骤名称" style={{ width: 90, height: 28, borderRadius: 6, border: '1px solid var(--border-light)', padding: '0 6px', fontSize: 11, background: 'var(--bg-primary)', color: 'var(--text-primary)' }} />
                  {step.type === 'tool' && (
                    <select value={step.toolName || ''} onChange={(e) => setNewSteps(updateStep(newSteps, i, { toolName: e.target.value }))}
                      style={{ flex: 1, height: 28, borderRadius: 6, border: '1px solid var(--border-light)', fontSize: 11, background: 'var(--bg-primary)' }}>
                      <option value="">选择工具</option>
                      {TOOL_OPTIONS.map(t => <option key={t} value={t}>{t}</option>)}
                    </select>
                  )}
                  {step.type === 'ai' && (
                    <input value={step.goal || ''} onChange={(e) => setNewSteps(updateStep(newSteps, i, { goal: e.target.value }))}
                      placeholder="AI 目标" style={{ flex: 1, height: 28, borderRadius: 6, border: '1px solid var(--border-light)', padding: '0 6px', fontSize: 11, background: 'var(--bg-primary)', color: 'var(--text-primary)' }} />
                  )}
                  <button onClick={() => setNewSteps(removeStep(newSteps, i))} style={{ background: 'none', border: 'none', cursor: 'pointer', color: '#ef4444' }}><Trash2 size={12} /></button>
                </div>
              ))}
              <button onClick={() => addStep(true)} style={{ display: 'flex', alignItems: 'center', gap: 4, padding: '4px 10px', borderRadius: 6, border: '1px dashed var(--border-light)', background: 'none', cursor: 'pointer', fontSize: 11, color: 'var(--text-tertiary)' }}>
                <Plus size={12} /> 添加步骤
              </button>

              <div style={{ display: 'flex', gap: 8, marginTop: 12, justifyContent: 'flex-end' }}>
                <button onClick={() => setShowCreate(false)} style={{ padding: '6px 14px', borderRadius: 8, border: '1px solid var(--border-light)', background: 'var(--bg-primary)', cursor: 'pointer', fontSize: 12 }}>取消</button>
                <button onClick={handleCreate} style={{ padding: '6px 14px', borderRadius: 8, border: 'none', background: 'var(--primary-color)', color: '#fff', cursor: 'pointer', fontSize: 12, fontWeight: 600 }}>创建</button>
              </div>
            </div>
          )}
        </div>

        <div style={{ padding: '12px 16px', borderTop: '1px solid var(--border-light)', display: 'flex', justifyContent: 'space-between' }}>
          <button onClick={() => setShowCreate(true)} style={{ display: 'flex', alignItems: 'center', gap: 4, padding: '6px 14px', borderRadius: 8, border: 'none', background: 'var(--primary-color)', color: '#fff', cursor: 'pointer', fontSize: 12, fontWeight: 600 }}>
            <Plus size={14} /> 新建工作流
          </button>
          <button onClick={onClose} style={{ padding: '6px 14px', borderRadius: 8, border: '1px solid var(--border-light)', background: 'var(--bg-primary)', cursor: 'pointer', fontSize: 12 }}>关闭</button>
        </div>
      </div>
    </div>
  );
};

export default WorkflowEditor;
