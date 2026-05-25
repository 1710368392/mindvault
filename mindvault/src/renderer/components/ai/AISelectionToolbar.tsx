import React, { useEffect, useRef, useState, useCallback } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { Languages, BookOpen, Search, Sparkles } from 'lucide-react';
import { useUIStore } from '../../stores/uiStore';
import { useAIStore } from '../../stores/aiStore';
import { useSettingsStore } from '../../stores/settingsStore';

interface SelectionAction {
  label: string;
  icon: React.ReactNode;
  prompt: string;
}

const AISelectionToolbar: React.FC = () => {
  const aiPanelMode = useUIStore((s) => s.aiPanelMode);
  const openAiMini = useUIStore((s) => s.openAiMini);
  const settings = useSettingsStore((s) => s.settings);
  const sendMessage = useAIStore((s) => s.sendMessage);
  const isGenerating = useAIStore((s) => s.isGenerating);

  const [visible, setVisible] = useState(false);
  const [position, setPosition] = useState({ x: 0, y: 0 });
  const [selectedText, setSelectedText] = useState('');
  const toolbarRef = useRef<HTMLDivElement>(null);
  const hideTimerRef = useRef<number | null>(null);

  const isAiEnabled = settings.aiEnabled;

  const handleSelectionChange = useCallback(() => {
    if (hideTimerRef.current) {
      clearTimeout(hideTimerRef.current);
      hideTimerRef.current = null;
    }

    const selection = window.getSelection();
    if (!selection || selection.isCollapsed || !selection.toString().trim()) {
      hideTimerRef.current = window.setTimeout(() => setVisible(false), 200);
      return;
    }

    const text = selection.toString().trim();
    if (text.length < 2 || text.length > 2000) {
      hideTimerRef.current = window.setTimeout(() => setVisible(false), 200);
      return;
    }

    const range = selection.getRangeAt(0);
    const rect = range.getBoundingClientRect();

    if (rect.width === 0 || rect.height === 0) {
      hideTimerRef.current = window.setTimeout(() => setVisible(false), 200);
      return;
    }

    const toolbarWidth = 260;
    const toolbarHeight = 44;
    let x = rect.left + rect.width / 2 - toolbarWidth / 2;
    let y = rect.top - toolbarHeight - 10;

    if (y < 10) y = rect.bottom + 10;
    if (x < 10) x = 10;
    if (x + toolbarWidth > window.innerWidth - 10) x = window.innerWidth - toolbarWidth - 10;

    setSelectedText(text);
    setPosition({ x, y });
    setVisible(true);
  }, []);

  const handleMouseDown = useCallback((e: MouseEvent) => {
    if (toolbarRef.current && toolbarRef.current.contains(e.target as Node)) return;
    if (hideTimerRef.current) clearTimeout(hideTimerRef.current);
    hideTimerRef.current = window.setTimeout(() => setVisible(false), 300);
  }, []);

  useEffect(() => {
    document.addEventListener('selectionchange', handleSelectionChange);
    document.addEventListener('mousedown', handleMouseDown);
    return () => {
      document.removeEventListener('selectionchange', handleSelectionChange);
      document.removeEventListener('mousedown', handleMouseDown);
      if (hideTimerRef.current) clearTimeout(hideTimerRef.current);
    };
  }, [handleSelectionChange, handleMouseDown]);

  const handleAction = useCallback((prompt: string) => {
    if (!selectedText || isGenerating) return;
    const fullPrompt = prompt.replace('{text}', selectedText);
    if (aiPanelMode === 'closed') openAiMini();
    setTimeout(() => {
      sendMessage(fullPrompt);
    }, 100);
    setVisible(false);
    window.getSelection()?.removeAllRanges();
  }, [selectedText, isGenerating, aiPanelMode, openAiMini, sendMessage]);

  if (!isAiEnabled || !visible || !selectedText) return null;

  const actions: SelectionAction[] = [
    {
      label: '翻译',
      icon: <Languages size={14} />,
      prompt: '请将以下内容翻译为中文（如果原文是中文则翻译为英文）：\n\n{text}',
    },
    {
      label: '解释',
      icon: <BookOpen size={14} />,
      prompt: '请详细解释以下内容的含义：\n\n{text}',
    },
    {
      label: '搜索',
      icon: <Search size={14} />,
      prompt: '请联网搜索以下内容的相关信息：\n\n{text}',
    },
    {
      label: 'AI',
      icon: <Sparkles size={14} />,
      prompt: '{text}',
    },
  ];

  return (
    <AnimatePresence>
      <motion.div
        ref={toolbarRef}
        initial={{ opacity: 0, y: 6, scale: 0.95 }}
        animate={{ opacity: 1, y: 0, scale: 1 }}
        exit={{ opacity: 0, y: 6, scale: 0.95 }}
        transition={{ duration: 0.15 }}
        style={{
          position: 'fixed',
          left: position.x,
          top: position.y,
          zIndex: 10002,
          display: 'flex',
          alignItems: 'center',
          gap: 2,
          padding: '4px 6px',
          borderRadius: 10,
          background: 'var(--bg-primary)',
          border: '1px solid var(--border-light)',
          boxShadow: '0 6px 24px rgba(0,0,0,0.15), 0 2px 6px rgba(0,0,0,0.08)',
        }}
      >
        {actions.map((action) => (
          <button
            key={action.label}
            onClick={() => handleAction(action.prompt)}
            disabled={isGenerating}
            style={{
              display: 'flex',
              alignItems: 'center',
              gap: 4,
              padding: '6px 10px',
              borderRadius: 7,
              border: 'none',
              background: 'transparent',
              color: 'var(--text-secondary)',
              fontSize: 12,
              fontWeight: 500,
              cursor: isGenerating ? 'not-allowed' : 'pointer',
              transition: 'all 0.12s ease',
              whiteSpace: 'nowrap',
            }}
            onMouseEnter={(e) => {
              (e.currentTarget as HTMLElement).style.background = 'var(--primary-bg)';
              (e.currentTarget as HTMLElement).style.color = 'var(--primary-color)';
            }}
            onMouseLeave={(e) => {
              (e.currentTarget as HTMLElement).style.background = 'transparent';
              (e.currentTarget as HTMLElement).style.color = 'var(--text-secondary)';
            }}
          >
            {action.icon}
            <span>{action.label}</span>
          </button>
        ))}
      </motion.div>
    </AnimatePresence>
  );
};

export default AISelectionToolbar;
