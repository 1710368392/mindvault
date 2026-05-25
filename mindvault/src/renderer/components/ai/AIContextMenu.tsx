import React, { useState, useCallback, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { Sparkles, Languages, BookOpen, PenLine, Tags, FileText, MessageSquare, Search } from 'lucide-react';
import { useUIStore } from '../../stores/uiStore';
import { useAIStore } from '../../stores/aiStore';
import { useSettingsStore } from '../../stores/settingsStore';

interface AIContextMenuState {
  visible: boolean;
  x: number;
  y: number;
  type: 'creativity' | 'text' | 'board' | 'tag' | 'general';
  data: any;
}

const INITIAL_STATE: AIContextMenuState = {
  visible: false,
  x: 0,
  y: 0,
  type: 'general',
  data: null,
};

let _setAIContextMenu: React.Dispatch<React.SetStateAction<AIContextMenuState>> | null = null;

export function showAIContextMenu(e: React.MouseEvent | MouseEvent, type: AIContextMenuState['type'], data: any) {
  if (_setAIContextMenu) {
    _setAIContextMenu({
      visible: true,
      x: e.clientX,
      y: e.clientY,
      type,
      data,
    });
  }
}

export function hideAIContextMenu() {
  if (_setAIContextMenu) {
    _setAIContextMenu((prev) => ({ ...prev, visible: false }));
  }
}

interface MenuAction {
  label: string;
  icon: React.ReactNode;
  prompt: string;
  variant?: 'primary' | 'default';
  creativityRefs?: any[];
}

function getCreativityActions(data: any): MenuAction[] {
  const title = data?.title || '未命名创意';
  const type = data?.type || 'text';
  const ref = `[创意ID: ${data?.id || ''} | 标题: ${title} | 类型: ${type}]`;
  const creativityRef = {
    id: data?.id || '',
    title,
    type,
    content: data?.content || '',
    mediaFilePath: data?.mediaFilePath || data?.mediaUrl || '',
    tags: data?.tags || [],
  };
  const refs = [creativityRef];
  return [
    {
      label: '发送给 AI 讨论',
      icon: <MessageSquare size={13} />,
      prompt: `我想和你讨论一个创意 ${ref}，请先用 read_creativity_full 工具查看它的完整内容，然后帮我分析这个创意，给出你的看法和建议。`,
      variant: 'primary',
      creativityRefs: refs,
    },
    {
      label: 'AI 续写',
      icon: <PenLine size={13} />,
      prompt: `请帮我续写和拓展创意 ${ref}，先用 read_creativity_full 工具查看完整内容，再基于内容进行续写。`,
      creativityRefs: refs,
    },
    {
      label: 'AI 润色改写',
      icon: <FileText size={13} />,
      prompt: `请帮我润色和改写创意 ${ref}，先用 read_creativity_full 工具查看完整内容，然后润色使其表达更清晰、更有吸引力，最后用 update_creativity 工具保存修改。`,
      creativityRefs: refs,
    },
    {
      label: 'AI 生成标签',
      icon: <Tags size={13} />,
      prompt: `请为创意 ${ref} 生成合适的标签，先用 read_creativity_full 工具查看内容，然后用 create_tag 工具创建标签，再用 tag_creativity 工具给创意打上标签。`,
      creativityRefs: refs,
    },
    {
      label: 'AI 翻译',
      icon: <Languages size={13} />,
      prompt: `请将创意 ${ref} 的内容翻译为英文，先用 read_creativity_full 工具查看完整内容，然后进行翻译。`,
      creativityRefs: refs,
    },
    {
      label: 'AI 解释分析',
      icon: <BookOpen size={13} />,
      prompt: `请详细分析创意 ${ref} 的核心观点、逻辑结构和潜在价值，先用 read_creativity_full 工具查看完整内容，然后给出深度分析。`,
      creativityRefs: refs,
    },
    {
      label: '联网搜索相关',
      icon: <Search size={13} />,
      prompt: `请联网搜索与创意 ${ref} 相关的内容、资料和灵感，先用 read_creativity_full 工具查看创意内容，再进行搜索。`,
      creativityRefs: refs,
    },
  ];
}

function getTextActions(text: string): MenuAction[] {
  return [
    {
      label: 'AI 翻译',
      icon: <Languages size={13} />,
      prompt: `请将以下内容翻译为中文（如果原文是中文则翻译为英文）：\n\n${text}`,
      variant: 'primary',
    },
    {
      label: 'AI 解释',
      icon: <BookOpen size={13} />,
      prompt: `请详细解释以下内容的含义：\n\n${text}`,
    },
    {
      label: 'AI 润色',
      icon: <PenLine size={13} />,
      prompt: `请帮我润色改写以下内容，使其更清晰流畅：\n\n${text}`,
    },
    {
      label: '联网搜索',
      icon: <Search size={13} />,
      prompt: `请联网搜索以下内容的相关信息：\n\n${text}`,
    },
  ];
}

function getBoardActions(data: any): MenuAction[] {
  const name = data?.name || '此看板';
  return [
    {
      label: 'AI 分析看板',
      icon: <MessageSquare size={13} />,
      prompt: `请分析我的看板「${name}」中的创意，给出整理建议。使用 get_board_overview 工具获取看板内容。`,
      variant: 'primary',
    },
    {
      label: 'AI 整理归纳',
      icon: <Tags size={13} />,
      prompt: `请帮我整理看板「${name}」中的创意，自动分类归纳并打标签。使用 Agent 模式执行。`,
    },
  ];
}

const AIContextMenu: React.FC = () => {
  const [state, setState] = useState<AIContextMenuState>(INITIAL_STATE);
  const aiPanelMode = useUIStore((s) => s.aiPanelMode);
  const openAiMini = useUIStore((s) => s.openAiMini);
  const settings = useSettingsStore((s) => s.settings);
  const sendMessage = useAIStore((s) => s.sendMessage);
  const isGenerating = useAIStore((s) => s.isGenerating);

  useEffect(() => {
    _setAIContextMenu = setState;
    return () => { _setAIContextMenu = null; };
  }, []);

  const handleClickOutside = useCallback((e: MouseEvent) => {
    setState((prev) => ({ ...prev, visible: false }));
  }, []);

  useEffect(() => {
    if (state.visible) {
      setTimeout(() => window.addEventListener('mousedown', handleClickOutside), 10);
      return () => window.removeEventListener('mousedown', handleClickOutside);
    }
  }, [state.visible, handleClickOutside]);

  const handleAction = useCallback((prompt: string, creativityRefs?: any[]) => {
    if (isGenerating) return;
    if (aiPanelMode === 'closed') openAiMini();
    setTimeout(() => sendMessage(prompt, undefined, creativityRefs), 100);
    setState((prev) => ({ ...prev, visible: false }));
  }, [isGenerating, aiPanelMode, openAiMini, sendMessage]);

  const [actions, setActions] = useState<MenuAction[]>([]);

  useEffect(() => {
    if (!state.visible) { setActions([]); return; }
    let result: MenuAction[] = [];
    switch (state.type) {
      case 'creativity':
        result = getCreativityActions(state.data);
        break;
      case 'text':
        result = getTextActions(state.data?.text || '');
        break;
      case 'board':
        result = getBoardActions(state.data);
        break;
      default:
        result = getTextActions(state.data?.text || '');
    }
    setActions(result);
  }, [state.visible, state.type, state.data]);

  if (!settings.aiEnabled || !state.visible) return null;

  let adjustedY = state.y;
  let adjustedX = state.x;
  const menuHeight = actions.length * 36 + 40;
  const menuWidth = 220;
  if (adjustedY + menuHeight > window.innerHeight - 10) adjustedY = window.innerHeight - menuHeight - 10;
  if (adjustedX + menuWidth > window.innerWidth - 10) adjustedX = window.innerWidth - menuWidth - 10;
  if (adjustedY < 10) adjustedY = 10;
  if (adjustedX < 10) adjustedX = 10;

  return (
    <AnimatePresence>
      <motion.div
        initial={{ opacity: 0, scale: 0.95 }}
        animate={{ opacity: 1, scale: 1 }}
        exit={{ opacity: 0, scale: 0.95 }}
        transition={{ duration: 0.1 }}
        style={{
          position: 'fixed',
          left: adjustedX,
          top: adjustedY,
          zIndex: 10003,
          minWidth: menuWidth,
          maxWidth: 280,
          borderRadius: 10,
          background: 'var(--bg-primary)',
          border: '1px solid var(--border-light)',
          boxShadow: '0 8px 32px rgba(0,0,0,0.18), 0 2px 8px rgba(0,0,0,0.08)',
          overflow: 'hidden',
        }}
      >
        <div style={{
          display: 'flex', alignItems: 'center', gap: 6,
          padding: '8px 12px 4px',
          borderBottom: '1px solid var(--border-light)',
        }}>
          <Sparkles size={13} style={{ color: 'var(--primary-color)' }} />
          <span style={{ fontSize: 11, fontWeight: 600, color: 'var(--primary-color)' }}>AI 助手</span>
        </div>
        <div style={{ padding: '4px 4px' }}>
          {actions.map((action, idx) => (
            <button
              key={idx}
              onClick={() => handleAction(action.prompt, action.creativityRefs)}
              disabled={isGenerating}
              style={{
                display: 'flex',
                alignItems: 'center',
                gap: 8,
                width: '100%',
                padding: '7px 10px',
                borderRadius: 6,
                border: 'none',
                background: action.variant === 'primary' ? 'var(--primary-bg)' : 'transparent',
                color: action.variant === 'primary' ? 'var(--primary-color)' : 'var(--text-secondary)',
                fontSize: 12,
                fontWeight: action.variant === 'primary' ? 600 : 400,
                cursor: isGenerating ? 'not-allowed' : 'pointer',
                transition: 'all 0.1s ease',
                textAlign: 'left',
                opacity: isGenerating ? 0.5 : 1,
              }}
              onMouseEnter={(e) => {
                (e.currentTarget as HTMLElement).style.background = 'var(--primary-bg)';
                (e.currentTarget as HTMLElement).style.color = 'var(--primary-color)';
              }}
              onMouseLeave={(e) => {
                (e.currentTarget as HTMLElement).style.background = action.variant === 'primary' ? 'var(--primary-bg)' : 'transparent';
                (e.currentTarget as HTMLElement).style.color = action.variant === 'primary' ? 'var(--primary-color)' : 'var(--text-secondary)';
              }}
            >
              {action.icon}
              <span>{action.label}</span>
            </button>
          ))}
        </div>
      </motion.div>
    </AnimatePresence>
  );
};

export default AIContextMenu;
