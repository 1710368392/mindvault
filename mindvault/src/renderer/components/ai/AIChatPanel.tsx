import React, { useState, useRef, useEffect, useCallback, useMemo } from 'react';
import { Input, Select, Tooltip } from 'antd';
import { motion, AnimatePresence } from 'framer-motion';
import { Send, Square, X, Bot, Sparkles, Play, Plus, Trash2, Mic, MicOff, Volume2, VolumeX, Wrench, ImagePlus, Loader, PanelLeftClose, PanelLeftOpen, Download, BarChart3, Settings2 } from 'lucide-react';
import ReactMarkdown from 'react-markdown';
import remarkGfm from 'remark-gfm';
import { useAIStore, isMusicRelated, ChatWindow } from '../../stores/aiStore';
import { useSettingsStore } from '../../stores/settingsStore';
import { useMusicStore } from '../../stores/musicStore';
import { useVoiceInput } from '../../hooks/useVoiceInput';
import PermissionDialog from './PermissionDialog';
import CompactBoundary from './CompactBoundary';
import type { PermissionRequest } from '@shared/types';
import { ChatListSidebar } from './ChatListSidebar';
import { PromptTemplateLibrary } from './PromptTemplateLibrary';
import WorkflowEditor from './WorkflowEditor';
import AIUsageDashboard from './AIUsageDashboard';
import CreativityRefCard from './CreativityRefCard';
import ThinkingSection from './ThinkingSection';
import { useEdgeTTS } from '../../hooks/useEdgeTTS';
import type { AIToolCallDisplay } from '../../../shared/types';

const { TextArea } = Input;

/** 工具标签映射 */
function getToolLabel(name: string): string {
  const labels: Record<string, string> = {
    get_current_time: '获取时间',
    search_creativity: '搜索创意库',
    create_creativity: '创建创意',
    update_creativity: '更新创意',
    delete_creativity: '删除创意',
    get_creativity_detail: '创意详情',
    list_creativities: '列出创意',
    tag_creativity: '标签管理',
    link_creativities: '关联创意',
    create_board: '创建看板',
    add_to_board: '添加到看板',
    get_board_overview: '看板概览',
    create_tag: '创建标签',
    search_tags: '搜索标签',
    get_popular_tags: '热门标签',
    search_templates: '搜索模板',
    global_search: '全局搜索',
    search_by_date_range: '日期搜索',
    get_app_stats: '应用统计',
    get_recent_edits: '最近编辑',
    navigate_to_page: '页面导航',
    get_current_context: '界面上下文',
    show_notification: '显示通知',
    open_external_url: '打开链接',
    get_music_status: '音乐状态',
    search_music: '搜索音乐',
    calculate: '数学计算',
    web_search: '联网搜索',
    execute_code: '执行代码',
    read_file: '读取文件',
    list_directory: '浏览目录',
  };
  return labels[name] || name;
}

/** 快捷指令预设 */
const QUICK_COMMANDS = [
  { label: '灵感', icon: '💡', prompt: '请给我一些创意灵感，帮助我拓展思路。' },
  { label: '续写', icon: '📝', prompt: '请根据上面的内容，帮我续写下去。' },
  { label: '摘要', icon: '📋', prompt: '请帮我总结一下上面对话的关键内容。' },
  { label: '改写', icon: '🔄', prompt: '请帮我用不同的方式重新表达上面的内容。' },
];

/** 音乐快捷指令预设 */
const MUSIC_QUICK_COMMANDS = [
  { label: '找歌', icon: '🎵', prompt: '我想听歌，请根据我本地音乐库中的歌曲，推荐一些适合当前心情的歌曲。如果没有特定心情，就推荐我最常听的歌曲。', isMusic: true },
  { label: '听歌报告', icon: '📊', prompt: '请帮我分析我的听歌习惯和偏好，生成一份听歌总结报告。', isMusic: true },
  { label: '情绪分类', icon: '🎭', prompt: '请帮我分析本地音乐库中的歌曲，为每首歌进行情绪分类，帮我整理出不同心情的歌单。', isMusic: true },
];

/** Agent 快捷指令预设 */
const AGENT_QUICK_COMMANDS = [
  { label: '整理创意', icon: '🗂️', prompt: '帮我整理一下创意库，自动分类归纳', isAgent: true },
  { label: '周报', icon: '📊', prompt: '生成本周创作总结', isAgent: true },
  { label: '拓展灵感', icon: '💡', prompt: '帮我拓展这个灵感，搜索相关资料', isAgent: true },
  { label: '批量标签', icon: '🏷️', prompt: '给最近的创意自动打标签', isAgent: true },
];

interface AIChatPanelProps {
  visible: boolean;
  onClose: () => void;
}

export const AIChatPanel: React.FC<AIChatPanelProps> = ({ visible, onClose }) => {
  const {
    chatWindows,
    activeWindowId,
    messages,
    isGenerating,
    streamingText,
    error,
    sendMessage,
    sendMusicMessage,
    stopGeneration,
    clearMessages,
    createWindow,
    switchWindow,
    closeWindow,
    clearAllWindows,
    loadFromStorage,
    exportChatAsMarkdown,
    exportChatAsPDF,
    toggleMessageReasoning,
  } = useAIStore();
  const settings = useSettingsStore((s) => s.settings);
  const saveSettings = useSettingsStore((s) => s.saveSettings);
  const loadTrack = useMusicStore((s) => s.loadTrack);
  const tracks = useMusicStore((s) => s.tracks);
  const [inputValue, setInputValue] = useState('');
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<any>(null);
  const [showClearConfirm, setShowClearConfirm] = useState(false);
  const imageInputRef = useRef<HTMLInputElement>(null);
  const [pendingImage, setPendingImage] = useState<string | null>(null);
  const [sidebarCollapsed, setSidebarCollapsed] = useState(false);
  const [showTemplateLibrary, setShowTemplateLibrary] = useState(false);
  const [showWorkflowEditor, setShowWorkflowEditor] = useState(false);
  const [showUsageDashboard, setShowUsageDashboard] = useState(false);
  const [showExportMenu, setShowExportMenu] = useState(false);
  const [pendingPermission, setPendingPermission] = useState<{
    toolName: string;
    input: Record<string, any>;
    reason: string;
    riskLevel?: 'safe' | 'moderate' | 'dangerous';
    resolve: (decision: 'allow' | 'deny') => void;
  } | null>(null);

  // 语音输入
  const { isListening, isSupported: isVoiceSupported, toggleListening } = useVoiceInput({
    onResult: (text) => setInputValue(text),
  });

  // 语音输出
  const ttsVoice = useSettingsStore((s) => s.settings.ttsVoice);
  const ttsRate = useSettingsStore((s) => s.settings.ttsRate);
  const ttsPitch = useSettingsStore((s) => s.settings.ttsPitch);
  const ttsVolume = useSettingsStore((s) => s.settings.ttsVolume);
  const { isSpeaking, toggle: toggleTTS, stop: stopTTS } = useEdgeTTS({
    voice: ttsVoice,
    rate: ttsRate,
    pitch: ttsPitch,
    volume: ttsVolume,
  });
  const isTTSSupported = true; // Edge TTS 始终可用

  // 从 aiStore 获取新状态
  const memoryEnabled = useAIStore((s) => s.memoryEnabled);
  const toolCallsEnabled = useAIStore((s) => s.toolCallsEnabled);
  const activeToolCalls = useAIStore((s) => s.activeToolCalls);
  const completedToolCalls = useAIStore((s) => s.completedToolCalls);
  const setMemoryEnabled = useAIStore((s) => s.setMemoryEnabled);
  const setToolCallsEnabled = useAIStore((s) => s.setToolCallsEnabled);
  const agentModeEnabled = useAIStore((s) => s.agentModeEnabled);
  const agentIsRunning = useAIStore((s) => s.agentIsRunning);
  const agentSteps = useAIStore((s) => s.agentSteps);
  const agentPhases = useAIStore((s) => s.agentPhases);
  const agentStatus = useAIStore((s) => s.agentStatus);
  const agentThinking = useAIStore((s) => s.agentThinking);
  const currentReasoningSteps = useAIStore((s) => s.currentReasoningSteps);
  const agentSummary = useAIStore((s) => s.agentSummary);
  const setAgentModeEnabled = useAIStore((s) => s.setAgentModeEnabled);
  const executeAgentTask = useAIStore((s) => s.executeAgentTask);
  const cancelAgentTask = useAIStore((s) => s.cancelAgentTask);
  const usePromptTemplate = useAIStore((s) => s.usePromptTemplate);

  /** 当前选中的提供商和模型 */
  const currentProvider = settings.aiDefaultProvider;
  const currentModel = settings.aiDefaultModel;

  /** 获取当前提供商的模型列表 */
  const getModelOptions = useCallback(() => {
    const models: Record<string, string[]> = {
      openai: ['gpt-5.5', 'gpt-5.5-pro', 'gpt-5.5-instant', 'gpt-5', 'o3', 'o3-mini', 'o4-mini'],
      anthropic: ['claude-opus-4-7', 'claude-sonnet-4-6', 'claude-haiku-4'],
      deepseek: ['deepseek-v4-pro', 'deepseek-v4-flash', 'deepseek-v4', 'deepseek-chat', 'deepseek-reasoner'],
      custom: [],
    };
    return (models[currentProvider] || []).map((m) => ({ label: m, value: m }));
  }, [currentProvider]);

  /** 获取当前提供商的 API Key 是否已配置 */
  const hasApiKey = useCallback(() => {
    switch (currentProvider) {
      case 'openai': return !!settings.aiOpenaiApiKey;
      case 'anthropic': return !!settings.aiAnthropicApiKey;
      case 'deepseek': return !!settings.aiDeepseekApiKey;
      case 'custom': return !!settings.aiCustomApiKey;
      default: return false;
    }
  }, [currentProvider, settings]);

  /** 自动滚动到底部 */
  const scrollToBottom = useCallback(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, []);

  // 解析 AI 回复中的歌曲推荐
  // 格式：【歌曲:歌曲名-艺术家名】
  const parseSongMentions = useCallback((content: string): Array<{ title: string; artist: string }> => {
    const songMentions: Array<{ title: string; artist: string }> = [];
    const regex = /【歌曲:([^】]+)】/g;
    let match;

    while ((match = regex.exec(content)) !== null) {
      const songInfo = match[1];
      // 尝试解析 "歌曲名-艺术家名" 格式
      const parts = songInfo.split('-');
      if (parts.length >= 2) {
        songMentions.push({
          title: parts[0].trim(),
          artist: parts.slice(1).join('-').trim(), // 艺术家名可能包含中划线
        });
      } else {
        songMentions.push({
          title: songInfo.trim(),
          artist: '',
        });
      }
    }

    return songMentions;
  }, []);

  // 播放推荐歌曲
  const handlePlayRecommendedSong = useCallback(
    (title: string, artist: string) => {
      // 在 tracks 中查找匹配的歌曲
      const storeIndex = tracks.findIndex(
        (t) =>
          t.title.toLowerCase().includes(title.toLowerCase()) &&
          (!artist || t.artist.toLowerCase().includes(artist.toLowerCase()))
      );

      if (storeIndex >= 0) {
        loadTrack(storeIndex, true);
      } else {
        console.warn('[AIChatPanel] 未找到推荐歌曲:', title, artist);
      }
    },
    [tracks, loadTrack]
  );

  // 提取歌曲信息并从消息中移除标记
  const extractAndRemoveSongMarks = useCallback((content: string): { cleanContent: string; songs: Array<{ title: string; artist: string }> } => {
    const songs = parseSongMentions(content);
    const cleanContent = content.replace(/【歌曲:([^】]+)】/g, '$1');
    return { cleanContent, songs };
  }, [parseSongMentions]);

  // 图片上传处理
  const handleImageUpload = useCallback((e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    if (file.size > 10 * 1024 * 1024) {
      // 10MB限制
      return;
    }

    const reader = new FileReader();
    reader.onload = () => {
      setPendingImage(reader.result as string);
    };
    reader.readAsDataURL(file);

    // 重置input
    e.target.value = '';
  }, []);

  // 页面加载时从 storage 恢复
  useEffect(() => {
    if (visible) {
      loadFromStorage();
    }
  }, [visible, loadFromStorage]);

  useEffect(() => {
    scrollToBottom();
  }, [messages, streamingText, scrollToBottom]);

  /** 面板打开时聚焦输入框 */
  useEffect(() => {
    if (visible) {
      setTimeout(() => inputRef.current?.focus(), 300);
    }
  }, [visible]);

  /** 发送消息（智能检测音乐意图） */
  const handleSend = useCallback(async () => {
    const text = inputValue.trim();
    if ((!text && !pendingImage) || isGenerating || agentIsRunning) return;

    let content: string;
    if (pendingImage && text) {
      content = `[图片] ${text}`;
      setPendingImage(null);
    } else if (pendingImage) {
      content = '[图片] 请描述这张图片';
      setPendingImage(null);
    } else {
      content = text;
    }

    setInputValue('');

    // 自动判断是否需要使用 Agent 模式
    const agentKeywords = ['整理', '分类', '总结', '搜索', '查找', '分析', '生成报告', '批量', '自动'];
    const shouldUseAgent = agentKeywords.some(keyword => content.includes(keyword));
    
    if (shouldUseAgent) {
      await executeAgentTask(content);
      return;
    }

    // 检测是否为音乐相关消息，自动使用 sendMusicMessage 注入音乐上下文
    if (isMusicRelated(content)) {
      await sendMusicMessage(content);
    } else {
      await sendMessage(content);
    }
  }, [inputValue, isGenerating, agentIsRunning, pendingImage, sendMessage, sendMusicMessage, executeAgentTask]);

  /** 键盘事件：Enter 发送，Shift+Enter 换行 */
  const handleKeyDown = useCallback(
    (e: React.KeyboardEvent) => {
      if (e.key === 'Enter' && !e.shiftKey) {
        e.preventDefault();
        handleSend();
      }
    },
    [handleSend]
  );

  /** 快捷指令点击（支持音乐/Agent指令） */
  const handleQuickCommand = useCallback(
    (prompt: string, isMusic?: boolean, isAgent?: boolean) => {
      if (isGenerating || agentIsRunning) return;
      setInputValue('');
      if (isAgent) {
        // Agent 模式指令
        executeAgentTask(prompt);
      } else if (isMusic) {
        // 音乐相关指令使用 sendMusicMessage 注入音乐上下文
        sendMusicMessage(prompt);
      } else {
        sendMessage(prompt);
      }
    },
    [isGenerating, agentIsRunning, sendMessage, sendMusicMessage, executeAgentTask]
  );

  /** 处理新建窗口 */
  const handleNewWindow = useCallback(() => {
    createWindow();
  }, [createWindow]);

  /** 处理清空所有对话 */
  const handleClearAll = useCallback(() => {
    clearAllWindows();
    setShowClearConfirm(false);
  }, [clearAllWindows]);

  /** 渲染单条消息 */
  const renderMessage = (msg: { role: string; content: string; creativityRefs?: any[]; reasoningSteps?: any[]; reasoningCollapsed?: boolean }, index: number) => {
    const isUser = msg.role === 'user';

    const { cleanContent, songs } = isUser ? { cleanContent: msg.content, songs: [] } : extractAndRemoveSongMarks(msg.content);

    const hasCreativityRefs = isUser && msg.creativityRefs && msg.creativityRefs.length > 0;
    const hasReasoningSteps = !isUser && msg.reasoningSteps && msg.reasoningSteps.length > 0
      && !(msg.reasoningSteps.length === 1 && msg.reasoningSteps[0].id === 'agent_tag');

    return (
      <motion.div
        key={index}
        initial={{ opacity: 0, y: 10 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.2 }}
        style={{
          display: 'flex',
          justifyContent: isUser ? 'flex-end' : 'flex-start',
          marginBottom: 16,
          padding: '0 12px',
        }}
      >
        {!isUser && (
          <div
            style={{
              width: 28,
              height: 28,
              borderRadius: '50%',
              background: 'var(--primary-bg)',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              marginRight: 8,
              flexShrink: 0,
              marginTop: 2,
            }}
          >
            <Bot size={16} style={{ color: 'var(--primary-color)' }} />
          </div>
        )}
        <div
          style={{
            maxWidth: isUser ? '80%' : '85%',
            padding: '10px 14px',
            borderRadius: isUser ? '16px 16px 4px 16px' : '16px 16px 16px 4px',
            background: isUser ? 'var(--primary-color)' : 'var(--bg-secondary)',
            color: isUser ? '#fff' : 'var(--text-primary)',
            fontSize: 13,
            lineHeight: 1.7,
            wordBreak: 'break-word',
            boxShadow: 'var(--shadow-sm)',
          }}
        >
          {isUser ? (
            hasCreativityRefs ? (
              <div>
                <span style={{ whiteSpace: 'pre-wrap', display: 'block', marginBottom: 8 }}>{msg.content}</span>
                <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
                  {msg.creativityRefs.map((ref: any) => (
                    <CreativityRefCard key={ref.id} ref={ref} />
                  ))}
                </div>
              </div>
            ) : (
              <span style={{ whiteSpace: 'pre-wrap' }}>{msg.content}</span>
            )
          ) : (
            <>
              {hasReasoningSteps && (
                <ThinkingSection
                  steps={msg.reasoningSteps!}
                  isThinking={false}
                  collapsed={msg.reasoningCollapsed ?? true}
                  onToggleCollapse={() => toggleMessageReasoning?.(index)}
                  variant="mini"
                />
              )}
              <div className="ai-markdown-body">
                <ReactMarkdown remarkPlugins={[remarkGfm]}>{cleanContent}</ReactMarkdown>
              </div>

              {/* 工具调用展示 */}
              {completedToolCalls.length > 0 && (
                <div style={{ marginTop: 8, display: 'flex', flexDirection: 'column', gap: 4 }}>
                  {completedToolCalls.map((tc) => (
                    <div key={tc.id} style={{
                      padding: '6px 10px', borderRadius: 6,
                      background: 'var(--bg-tertiary)',
                      border: '1px solid var(--border-light)',
                      fontSize: 11,
                    }}>
                      <div style={{ display: 'flex', alignItems: 'center', gap: 4, color: 'var(--text-secondary)' }}>
                        <Wrench size={10} />
                        <span style={{ fontWeight: 500 }}>{getToolLabel(tc.name)}</span>
                        <span style={{ color: tc.status === 'error' ? '#ff4d4f' : 'var(--text-tertiary)' }}>
                          {tc.status === 'completed' ? '\u2713' : tc.status === 'error' ? '\u2717' : '...'}
                        </span>
                      </div>
                      {tc.result && (
                        <div style={{ marginTop: 4, color: 'var(--text-tertiary)', maxHeight: 60, overflow: 'hidden', textOverflow: 'ellipsis' }}>
                          {tc.result.substring(0, 150)}{tc.result.length > 150 ? '...' : ''}
                        </div>
                      )}
                    </div>
                  ))}
                </div>
              )}

              {/* 语音播放按钮 */}
              {isTTSSupported && (
                <div style={{ display: 'flex', justifyContent: 'flex-end', marginTop: 4 }}>
                  <button
                    onClick={() => toggleTTS(typeof msg.content === 'string' ? msg.content : '')}
                    style={{
                      background: 'none', border: 'none', cursor: 'pointer',
                      color: 'var(--text-tertiary)', padding: 2,
                      opacity: 0.6,
                    }}
                    title={isSpeaking ? '停止朗读' : '朗读此消息'}
                  >
                    {isSpeaking ? <VolumeX size={12} /> : <Volume2 size={12} />}
                  </button>
                </div>
              )}

              {/* 推荐歌曲播放卡片 */}
              {songs.length > 0 && (
                <div
                  style={{
                    marginTop: 12,
                    padding: '10px 12px',
                    borderRadius: 8,
                    backgroundColor: 'var(--bg-tertiary)',
                    border: '1px solid var(--border-light)',
                  }}
                >
                  <div
                    style={{
                      fontSize: 11,
                      fontWeight: 500,
                      color: 'var(--text-secondary)',
                      marginBottom: 8,
                    }}
                  >
                    推荐歌曲
                  </div>
                  <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
                    {songs.map((song, idx) => {
                      // 检查歌曲是否在曲库中
                      const exists = tracks.some(
                        (t) =>
                          t.title.toLowerCase().includes(song.title.toLowerCase()) &&
                          (!song.artist || t.artist.toLowerCase().includes(song.artist.toLowerCase()))
                      );

                      return (
                        <div
                          key={idx}
                          style={{
                            display: 'flex',
                            alignItems: 'center',
                            gap: 8,
                            padding: '6px 8px',
                            borderRadius: 6,
                            backgroundColor: 'var(--bg-secondary)',
                          }}
                        >
                          <div style={{ flex: 1, minWidth: 0 }}>
                            <div
                              style={{
                                fontSize: 12,
                                fontWeight: 500,
                                color: 'var(--text-primary)',
                                overflow: 'hidden',
                                textOverflow: 'ellipsis',
                                whiteSpace: 'nowrap',
                              }}
                            >
                              {song.title}
                            </div>
                            {song.artist && (
                              <div
                                style={{
                                  fontSize: 10,
                                  color: 'var(--text-tertiary)',
                                  overflow: 'hidden',
                                  textOverflow: 'ellipsis',
                                  whiteSpace: 'nowrap',
                                }}
                              >
                                {song.artist}
                              </div>
                            )}
                          </div>
                          <motion.button
                            whileHover={{ scale: 1.1 }}
                            whileTap={{ scale: 0.9 }}
                            onClick={() => handlePlayRecommendedSong(song.title, song.artist)}
                            disabled={!exists}
                            style={{
                              display: 'flex',
                              alignItems: 'center',
                              justifyContent: 'center',
                              width: 28,
                              height: 28,
                              borderRadius: '50%',
                              border: 'none',
                              backgroundColor: exists ? 'var(--primary-color)' : 'var(--bg-tertiary)',
                              color: exists ? '#fff' : 'var(--text-tertiary)',
                              cursor: exists ? 'pointer' : 'not-allowed',
                              opacity: exists ? 1 : 0.5,
                              flexShrink: 0,
                            }}
                            title={exists ? '点击播放' : '歌曲不在曲库中'}
                          >
                            <Play size={12} fill={exists ? '#fff' : 'none'} />
                          </motion.button>
                        </div>
                      );
                    })}
                  </div>
                </div>
              )}
            </>
          )}
        </div>
      </motion.div>
    );
  };

  return (
    <>
      {/* Markdown 样式 */}
      <style>{`
        .ai-markdown-body {
          font-size: 13px;
          line-height: 1.7;
          color: var(--text-primary);
        }
        .ai-markdown-body p {
          margin: 0 0 8px 0;
        }
        .ai-markdown-body p:last-child {
          margin-bottom: 0;
        }
        .ai-markdown-body ul, .ai-markdown-body ol {
          margin: 4px 0;
          padding-left: 20px;
        }
        .ai-markdown-body li {
          margin: 2px 0;
        }
        .ai-markdown-body code {
          background: var(--bg-tertiary);
          padding: 1px 5px;
          border-radius: 4px;
          font-size: 12px;
          font-family: 'Consolas', 'Monaco', monospace;
        }
        .ai-markdown-body pre {
          background: var(--bg-tertiary);
          padding: 10px 12px;
          border-radius: 8px;
          overflow-x: auto;
          margin: 8px 0;
        }
        .ai-markdown-body pre code {
          background: none;
          padding: 0;
          font-size: 12px;
        }
        .ai-markdown-body blockquote {
          border-left: 3px solid var(--primary-color);
          margin: 8px 0;
          padding: 4px 12px;
          color: var(--text-secondary);
        }
        .ai-markdown-body h1, .ai-markdown-body h2, .ai-markdown-body h3,
        .ai-markdown-body h4, .ai-markdown-body h5, .ai-markdown-body h6 {
          margin: 12px 0 6px 0;
          font-weight: 600;
        }
        .ai-markdown-body h1 { font-size: 18px; }
        .ai-markdown-body h2 { font-size: 16px; }
        .ai-markdown-body h3 { font-size: 14px; }
        .ai-markdown-body table {
          border-collapse: collapse;
          width: 100%;
          margin: 8px 0;
          font-size: 12px;
        }
        .ai-markdown-body th, .ai-markdown-body td {
          border: 1px solid var(--border-light);
          padding: 6px 10px;
          text-align: left;
        }
        .ai-markdown-body th {
          background: var(--bg-tertiary);
          font-weight: 600;
        }
        .ai-markdown-body a {
          color: var(--primary-color);
          text-decoration: none;
        }
        .ai-markdown-body a:hover {
          text-decoration: underline;
        }
        .ai-markdown-body hr {
          border: none;
          border-top: 1px solid var(--border-light);
          margin: 12px 0;
        }
        .ai-markdown-body strong {
          font-weight: 600;
        }
        .ai-cursor-blink {
          display: inline-block;
          width: 2px;
          height: 1em;
          background: var(--primary-color);
          margin-left: 2px;
          vertical-align: text-bottom;
          animation: ai-cursor-blink 0.8s ease-in-out infinite;
        }
        @keyframes ai-cursor-blink {
          0%, 100% { opacity: 1; }
          50% { opacity: 0; }
        }
        @keyframes blink {
          0%, 100% { opacity: 1; }
          50% { opacity: 0; }
        }
        .chat-window-tab {
          transition: all 0.2s ease;
        }
        .chat-window-tab:hover {
          background: var(--bg-tertiary);
        }
        .chat-window-tab.active {
          background: var(--primary-bg);
          color: var(--primary-color);
          border-bottom: 2px solid var(--primary-color);
        }
      `}</style>

      {/* 遮罩层 */}
      <AnimatePresence>
        {visible && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            transition={{ duration: 0.2 }}
            onClick={onClose}
            style={{
              position: 'fixed',
              top: 0,
              left: 0,
              right: 0,
              bottom: 0,
              background: 'rgba(0, 0, 0, 0.2)',
              zIndex: 998,
            }}
          />
        )}
      </AnimatePresence>

      {/* 面板主体 */}
      <AnimatePresence>
        {visible && (
          <motion.div
            initial={{ x: '100%' }}
            animate={{ x: 0 }}
            exit={{ x: '100%' }}
            transition={{ type: 'spring', damping: 25, stiffness: 300 }}
            style={{
              position: 'fixed',
              top: 0,
              right: 0,
              width: 380,
              height: '100%',
              background: 'var(--bg-primary)',
              borderLeft: '1px solid var(--border-light)',
              boxShadow: 'var(--shadow-md)',
              zIndex: 999,
              display: 'flex',
              flexDirection: 'column',
            }}
          >
            {/* 顶部标题栏 */}
            <div
              style={{
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'space-between',
                padding: '14px 16px',
                borderBottom: '1px solid var(--border-light)',
                flexShrink: 0,
              }}
            >
              <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                <Sparkles size={18} style={{ color: 'var(--primary-color)' }} />
                <span style={{ fontWeight: 600, fontSize: 15, color: 'var(--text-primary)' }}>
                  AI 助手
                </span>
              </div>
              <div style={{ display: 'flex', alignItems: 'center', gap: 4 }}>

                {/* 工作流 */}
                <Tooltip title="自定义工作流">
                  <button
                    onClick={() => setShowWorkflowEditor(true)}
                    style={{
                      background: 'none',
                      border: 'none',
                      cursor: 'pointer',
                      color: 'var(--text-tertiary)',
                      padding: 6,
                      borderRadius: 6,
                      display: 'flex',
                      alignItems: 'center',
                      transition: 'all 0.15s ease',
                    }}
                    onMouseEnter={(e) => { (e.currentTarget as HTMLElement).style.color = 'var(--primary-color)'; }}
                    onMouseLeave={(e) => { (e.currentTarget as HTMLElement).style.color = 'var(--text-tertiary)'; }}
                  >
                    <Settings2 size={16} />
                  </button>
                </Tooltip>

                {/* 使用统计 */}
                <Tooltip title="AI 使用统计">
                  <button
                    onClick={() => setShowUsageDashboard(true)}
                    style={{
                      background: 'none',
                      border: 'none',
                      cursor: 'pointer',
                      color: 'var(--text-tertiary)',
                      padding: 6,
                      borderRadius: 6,
                      display: 'flex',
                      alignItems: 'center',
                      transition: 'all 0.15s ease',
                    }}
                    onMouseEnter={(e) => { (e.currentTarget as HTMLElement).style.color = 'var(--primary-color)'; }}
                    onMouseLeave={(e) => { (e.currentTarget as HTMLElement).style.color = 'var(--text-tertiary)'; }}
                  >
                    <BarChart3 size={16} />
                  </button>
                </Tooltip>

                {/* 导出 */}
                <div style={{ position: 'relative' }}>
                  <Tooltip title="导出对话">
                    <button
                      onClick={() => setShowExportMenu(!showExportMenu)}
                      style={{
                        background: showExportMenu ? 'var(--primary-bg)' : 'none',
                        border: 'none',
                        cursor: 'pointer',
                        color: showExportMenu ? 'var(--primary-color)' : 'var(--text-tertiary)',
                        padding: 6,
                        borderRadius: 6,
                        display: 'flex',
                        alignItems: 'center',
                        transition: 'all 0.15s ease',
                      }}
                    >
                      <Download size={16} />
                    </button>
                  </Tooltip>
                  {showExportMenu && (
                    <div style={{
                      position: 'absolute', top: '100%', right: 0, zIndex: 10001,
                      background: 'var(--bg-primary)', border: '1px solid var(--border-light)',
                      borderRadius: 8, boxShadow: '0 4px 12px rgba(0,0,0,0.15)', padding: 4, minWidth: 140,
                    }}>
                      <button onClick={() => { exportChatAsMarkdown(); setShowExportMenu(false); }}
                        style={{ display: 'block', width: '100%', padding: '8px 12px', border: 'none', background: 'none', cursor: 'pointer', textAlign: 'left', fontSize: 12, color: 'var(--text-primary)', borderRadius: 6 }}>
                        📄 导出为 Markdown
                      </button>
                      <button onClick={() => { exportChatAsPDF(); setShowExportMenu(false); }}
                        style={{ display: 'block', width: '100%', padding: '8px 12px', border: 'none', background: 'none', cursor: 'pointer', textAlign: 'left', fontSize: 12, color: 'var(--text-primary)', borderRadius: 6 }}>
                        📑 导出为 PDF
                      </button>
                    </div>
                  )}
                </div>

                {/* 清空所有对话 */}
                {chatWindows.length > 0 && (
                  <>
                    {showClearConfirm ? (
                      <div style={{ display: 'flex', alignItems: 'center', gap: 4 }}>
                        <span style={{ fontSize: 11, color: 'var(--text-secondary)' }}>确定?</span>
                        <button
                          onClick={handleClearAll}
                          style={{
                            background: '#ff4d4f',
                            border: 'none',
                            cursor: 'pointer',
                            color: '#fff',
                            padding: '4px 8px',
                            borderRadius: 4,
                            fontSize: 11,
                          }}
                        >
                          是
                        </button>
                        <button
                          onClick={() => setShowClearConfirm(false)}
                          style={{
                            background: 'var(--bg-tertiary)',
                            border: 'none',
                            cursor: 'pointer',
                            color: 'var(--text-secondary)',
                            padding: '4px 8px',
                            borderRadius: 4,
                            fontSize: 11,
                          }}
                        >
                          否
                        </button>
                      </div>
                    ) : (
                      <Tooltip title="清空所有对话">
                        <button
                          onClick={() => setShowClearConfirm(true)}
                          style={{
                            background: 'none',
                            border: 'none',
                            cursor: 'pointer',
                            color: 'var(--text-tertiary)',
                            padding: 6,
                            borderRadius: 6,
                            display: 'flex',
                            alignItems: 'center',
                          }}
                        >
                          <Trash2 size={16} />
                        </button>
                      </Tooltip>
                    )}
                  </>
                )}

                <button
                  onClick={onClose}
                  style={{
                    background: 'none',
                    border: 'none',
                    cursor: 'pointer',
                    color: 'var(--text-tertiary)',
                    padding: 4,
                    borderRadius: 6,
                    display: 'flex',
                    alignItems: 'center',
                  }}
                >
                  <X size={18} />
                </button>
              </div>
            </div>

            {/* 侧边栏切换按钮 */}
            <div style={{ display: 'flex', alignItems: 'center', gap: 4, marginLeft: 4 }}>
              <Tooltip title={sidebarCollapsed ? '展开对话列表' : '收起对话列表'}>
                <button
                  onClick={() => setSidebarCollapsed(!sidebarCollapsed)}
                  style={{
                    background: 'none',
                    border: 'none',
                    cursor: 'pointer',
                    color: 'var(--text-tertiary)',
                    padding: 4,
                    borderRadius: 6,
                    display: 'flex',
                    alignItems: 'center',
                  }}
                >
                  {sidebarCollapsed ? <PanelLeftOpen size={16} /> : <PanelLeftClose size={16} />}
                </button>
              </Tooltip>
            </div>

            {/* 主内容区域：侧边栏 + 聊天 */}
            <div style={{ flex: 1, display: 'flex', minHeight: 0 }}>
              {/* 对话列表侧边栏 */}
              <ChatListSidebar
                collapsed={sidebarCollapsed}
                onToggleCollapse={() => setSidebarCollapsed(!sidebarCollapsed)}
                width={180}
              />

              {/* 聊天主区域 */}
              <div style={{ flex: 1, display: 'flex', flexDirection: 'column', minWidth: 0 }}>
            {/* 提供商 + 模型选择 */}
            <div style={{
              display: 'flex',
              alignItems: 'center',
              gap: 8,
              padding: '8px 16px',
              borderBottom: '1px solid var(--border-light)',
              flexShrink: 0,
              background: 'var(--bg-tertiary)',
            }}>
              <Select
                value={currentProvider}
                onChange={(val) => saveSettings({ aiDefaultProvider: val as any, aiDefaultModel: '' })}
                size="small"
                style={{ width: 100 }}
                options={[
                  { label: 'OpenAI', value: 'openai' },
                  { label: 'Anthropic', value: 'anthropic' },
                  { label: 'DeepSeek', value: 'deepseek' },
                  { label: '自定义', value: 'custom' },
                ]}
                popupMatchSelectWidth={false}
              />
              <Select
                value={currentModel}
                onChange={(val) => {
                  // 根据当前提供商保存到对应的模型字段
                  switch (currentProvider) {
                    case 'openai':
                      saveSettings({ aiOpenaiModel: val });
                      break;
                    case 'anthropic':
                      saveSettings({ aiAnthropicModel: val });
                      break;
                    case 'deepseek':
                      saveSettings({ aiDeepseekModel: val });
                      break;
                    case 'custom':
                      saveSettings({ aiCustomModel: val });
                      break;
                  }
                  // 同时更新默认模型
                  saveSettings({ aiDefaultModel: val });
                }}
                size="small"
                style={{ flex: 1, minWidth: 0 }}
                options={getModelOptions()}
                showSearch
                placeholder="选择模型"
                notFoundContent={null}
                popupMatchSelectWidth={false}
              />
              {!hasApiKey() && (
                <span style={{ fontSize: 11, color: 'var(--text-tertiary)', whiteSpace: 'nowrap' }}>
                  未配置Key
                </span>
              )}
            </div>

            {/* 消息列表 */}
            <div
              className="selectable"
              style={{
                flex: 1,
                overflowY: 'auto',
                padding: '12px 0',
              }}
            >
              {messages.length === 0 && !isGenerating && (
                <div
                  style={{
                    display: 'flex',
                    flexDirection: 'column',
                    alignItems: 'center',
                    justifyContent: 'center',
                    height: '100%',
                    color: 'var(--text-tertiary)',
                    fontSize: 13,
                    gap: 12,
                  }}
                >
                  <Bot size={40} style={{ color: 'var(--border-color)' }} />
                  <span>你好，我是脑洞集AI助手</span>
                  <span style={{ fontSize: 12 }}>有什么可以帮你的吗？</span>
                  {webSearchEnabled && (
                    <span style={{ fontSize: 11, color: 'var(--primary-color)' }}>
                      联网搜索已开启
                    </span>
                  )}
                </div>
              )}

              {messages.map((msg, idx) => {
                // 渲染压缩边界
                if (msg.type === 'compact_boundary') {
                  return (
                    <CompactBoundary
                      key={`compact-${idx}`}
                      summary={msg.compactSummary || ''}
                      preCompactTokens={msg.compactPreTokens || 0}
                      postCompactTokens={msg.compactPostTokens || 0}
                    />
                  );
                }
                // 渲染权限请求（已处理的历史记录）
                if (msg.type === 'permission_request') {
                  return (
                    <div key={`perm-${idx}`} style={{ margin: '4px 16px', fontSize: 11, color: 'var(--text-tertiary)', display: 'flex', alignItems: 'center', gap: 6 }}>
                      <span>🔒</span>
                      <span>工具 {msg.permissionToolName} 已{msg.permissionDecision === 'allow' ? '允许' : '拒绝'}</span>
                    </div>
                  );
                }
                // 渲染工具结果消息
                if (msg.type === 'tool_result') {
                  return null; // 工具结果已通过 reasoningSteps 展示
                }
                return renderMessage(msg, idx);
              })}

              {/* Agent 思考过程面板 */}
              {agentModeEnabled && agentIsRunning && currentReasoningSteps.length > 0 && (
                <div style={{ margin: '4px 12px' }}>
                  <ThinkingSection
                    steps={currentReasoningSteps}
                    isThinking={true}
                    variant="mini"
                  />
                </div>
              )}

              {/* 流式输出中的消息 */}
              {isGenerating && streamingText && (() => {
                const { cleanContent, songs } = extractAndRemoveSongMarks(streamingText);
                return (
                  <motion.div
                    initial={{ opacity: 0, y: 10 }}
                    animate={{ opacity: 1, y: 0 }}
                    style={{
                      display: 'flex',
                      justifyContent: 'flex-start',
                      marginBottom: 16,
                      padding: '0 12px',
                    }}
                  >
                    <div
                      style={{
                        width: 28,
                        height: 28,
                        borderRadius: '50%',
                        background: 'var(--primary-bg)',
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'center',
                        marginRight: 8,
                        flexShrink: 0,
                        marginTop: 2,
                      }}
                    >
                      <Bot size={16} style={{ color: 'var(--primary-color)' }} />
                    </div>
                    <div
                      style={{
                        maxWidth: '85%',
                        padding: '10px 14px',
                        borderRadius: '16px 16px 16px 4px',
                        background: 'var(--bg-secondary)',
                        color: 'var(--text-primary)',
                        fontSize: 13,
                        lineHeight: 1.7,
                        wordBreak: 'break-word',
                        boxShadow: 'var(--shadow-sm)',
                      }}
                    >
                      <div className="ai-markdown-body">
                        <ReactMarkdown remarkPlugins={[remarkGfm]}>{cleanContent}</ReactMarkdown>
                      </div>
                      <span className="ai-cursor-blink" />

                      {/* 流式输出中的推荐歌曲（仅显示已完整出现的歌曲） */}
                      {songs.length > 0 && (
                        <div
                          style={{
                            marginTop: 12,
                            padding: '10px 12px',
                            borderRadius: 8,
                            backgroundColor: 'var(--bg-tertiary)',
                            border: '1px solid var(--border-light)',
                          }}
                        >
                          <div
                            style={{
                              fontSize: 11,
                              fontWeight: 500,
                              color: 'var(--text-secondary)',
                              marginBottom: 8,
                            }}
                          >
                            推荐歌曲
                          </div>
                          <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
                            {songs.map((song, idx) => {
                              const exists = tracks.some(
                                (t) =>
                                  t.title.toLowerCase().includes(song.title.toLowerCase()) &&
                                  (!song.artist || t.artist.toLowerCase().includes(song.artist.toLowerCase()))
                              );
                              return (
                                <div
                                  key={idx}
                                  style={{
                                    display: 'flex',
                                    alignItems: 'center',
                                    gap: 8,
                                    padding: '6px 8px',
                                    borderRadius: 6,
                                    backgroundColor: 'var(--bg-secondary)',
                                  }}
                                >
                                  <div style={{ flex: 1, minWidth: 0 }}>
                                    <div
                                      style={{
                                        fontSize: 12,
                                        fontWeight: 500,
                                        color: 'var(--text-primary)',
                                        overflow: 'hidden',
                                        textOverflow: 'ellipsis',
                                        whiteSpace: 'nowrap',
                                      }}
                                    >
                                      {song.title}
                                    </div>
                                    {song.artist && (
                                      <div
                                        style={{
                                          fontSize: 10,
                                          color: 'var(--text-tertiary)',
                                          overflow: 'hidden',
                                          textOverflow: 'ellipsis',
                                          whiteSpace: 'nowrap',
                                        }}
                                      >
                                        {song.artist}
                                      </div>
                                    )}
                                  </div>
                                  <motion.button
                                    whileHover={{ scale: 1.1 }}
                                    whileTap={{ scale: 0.9 }}
                                    onClick={() => handlePlayRecommendedSong(song.title, song.artist)}
                                    disabled={!exists}
                                    style={{
                                      display: 'flex',
                                      alignItems: 'center',
                                      justifyContent: 'center',
                                      width: 28,
                                      height: 28,
                                      borderRadius: '50%',
                                      border: 'none',
                                      backgroundColor: exists ? 'var(--primary-color)' : 'var(--bg-tertiary)',
                                      color: exists ? '#fff' : 'var(--text-tertiary)',
                                      cursor: exists ? 'pointer' : 'not-allowed',
                                      opacity: exists ? 1 : 0.5,
                                      flexShrink: 0,
                                    }}
                                    title={exists ? '点击播放' : '歌曲不在曲库中'}
                                  >
                                    <Play size={12} fill={exists ? '#fff' : 'none'} />
                                  </motion.button>
                                </div>
                              );
                            })}
                          </div>
                        </div>
                      )}
                    </div>
                  </motion.div>
                );
              })()}

              {/* 等待响应中（无文本） */}
              {isGenerating && !streamingText && (
                <motion.div
                  initial={{ opacity: 0 }}
                  animate={{ opacity: 1 }}
                  style={{
                    display: 'flex',
                    justifyContent: 'flex-start',
                    marginBottom: 16,
                    padding: '0 12px',
                  }}
                >
                  <div
                    style={{
                      width: 28,
                      height: 28,
                      borderRadius: '50%',
                      background: 'var(--primary-bg)',
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'center',
                      marginRight: 8,
                      flexShrink: 0,
                    }}
                  >
                    <Bot size={16} style={{ color: 'var(--primary-color)' }} />
                  </div>
                  <div
                    style={{
                      padding: '10px 14px',
                      borderRadius: '16px 16px 16px 4px',
                      background: 'var(--bg-secondary)',
                      color: 'var(--text-tertiary)',
                      fontSize: 13,
                    }}
                  >
                    思考中...
                    {/* 活跃工具调用 */}
                    {activeToolCalls.length > 0 && (
                      <motion.div
                        initial={{ opacity: 0 }}
                        animate={{ opacity: 1 }}
                        style={{ marginTop: 8, display: 'flex', flexDirection: 'column', gap: 4 }}
                      >
                        {activeToolCalls.map((tc) => (
                          <div key={tc.id} style={{ display: 'flex', alignItems: 'center', gap: 6, fontSize: 12, color: 'var(--text-secondary)' }}>
                            <Wrench size={12} />
                            <span>{getToolLabel(tc.name)}...</span>
                            <span className="ai-cursor-blink" />
                          </div>
                        ))}
                      </motion.div>
                    )}
                  </div>
                </motion.div>
              )}

              {/* 错误提示 */}
              {error && (
                <motion.div
                  initial={{ opacity: 0, y: 10 }}
                  animate={{ opacity: 1, y: 0 }}
                  style={{
                    margin: '0 12px 16px',
                    padding: '10px 14px',
                    borderRadius: 8,
                    background: 'rgba(255, 77, 79, 0.1)',
                    color: '#ff4d4f',
                    fontSize: 12,
                    border: '1px solid rgba(255, 77, 79, 0.2)',
                  }}
                >
                  {error}
                </motion.div>
              )}

              {/* 权限确认对话框 */}
              <PermissionDialog
                visible={!!pendingPermission}
                toolName={pendingPermission?.toolName || ''}
                input={pendingPermission?.input || {}}
                reason={pendingPermission?.reason || ''}
                riskLevel={pendingPermission?.riskLevel || 'moderate'}
                onDecision={(decision) => {
                  if (pendingPermission?.resolve) {
                    pendingPermission.resolve(decision);
                  }
                  setPendingPermission(null);
                }}
              />

              <div ref={messagesEndRef} />
            </div>

            {/* 快捷指令 - 合并为一行可滚动标签 */}
            <div
              style={{
                display: 'flex',
                gap: 4,
                padding: '6px 12px',
                borderTop: '1px solid var(--border-light)',
                flexShrink: 0,
                overflowX: 'auto',
                scrollbarWidth: 'none',
              }}
            >
              {[
                ...QUICK_COMMANDS.map((cmd) => ({ ...cmd, type: 'normal' as const })),
                ...MUSIC_QUICK_COMMANDS.map((cmd) => ({ ...cmd, type: 'music' as const })),
                ...(agentModeEnabled ? AGENT_QUICK_COMMANDS.map((cmd) => ({ ...cmd, type: 'agent' as const })) : []),
              ].map((cmd) => (
                <button
                  key={cmd.label}
                  onClick={() => handleQuickCommand(cmd.prompt, cmd.type === 'music', cmd.type === 'agent')}
                  disabled={isGenerating || (cmd.type === 'agent' && agentIsRunning)}
                  style={{
                    display: 'flex',
                    alignItems: 'center',
                    gap: 3,
                    padding: '4px 8px',
                    border: cmd.type === 'agent' ? '1px solid var(--primary-color)' : '1px solid var(--border-light)',
                    borderRadius: 10,
                    background: cmd.type === 'agent' ? 'var(--primary-bg)' : cmd.type === 'music' ? 'rgba(139,92,246,0.06)' : 'var(--bg-secondary)',
                    color: cmd.type === 'agent' ? 'var(--primary-color)' : cmd.type === 'music' ? '#8b5cf6' : 'var(--text-secondary)',
                    fontSize: 11,
                    cursor: isGenerating || (cmd.type === 'agent' && agentIsRunning) ? 'not-allowed' : 'pointer',
                    opacity: isGenerating || (cmd.type === 'agent' && agentIsRunning) ? 0.5 : 1,
                    transition: 'all 0.15s ease',
                    whiteSpace: 'nowrap',
                    flexShrink: 0,
                  }}
                  onMouseEnter={(e) => {
                    if (!isGenerating && !(cmd.type === 'agent' && agentIsRunning)) {
                      (e.currentTarget as HTMLElement).style.borderColor = 'var(--primary-color)';
                      (e.currentTarget as HTMLElement).style.color = 'var(--primary-color)';
                    }
                  }}
                  onMouseLeave={(e) => {
                    (e.currentTarget as HTMLElement).style.borderColor = cmd.type === 'agent' ? 'var(--primary-color)' : 'var(--border-light)';
                    (e.currentTarget as HTMLElement).style.color = cmd.type === 'agent' ? 'var(--primary-color)' : cmd.type === 'music' ? '#8b5cf6' : 'var(--text-secondary)';
                  }}
                >
                  <span style={{ fontSize: 12 }}>{cmd.icon}</span>
                  <span>{cmd.label}</span>
                </button>
              ))}
            </div>

            {/* 底部输入区域 */}
            <div
              style={{
                padding: '12px',
                borderTop: '1px solid var(--border-light)',
                flexShrink: 0,
              }}
            >
              {/* 待发送图片预览 */}
              {pendingImage && (
                <div style={{ padding: '4px 12px 8px', display: 'flex', gap: 8, alignItems: 'center' }}>
                  <img src={pendingImage} alt="待发送图片" style={{ width: 60, height: 60, borderRadius: 8, objectFit: 'cover' }} />
                  <button
                    onClick={() => setPendingImage(null)}
                    style={{
                      background: 'var(--bg-tertiary)',
                      border: 'none',
                      cursor: 'pointer',
                      color: 'var(--text-secondary)',
                      width: 24,
                      height: 24,
                      borderRadius: '50%',
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'center',
                    }}
                  >
                    <X size={14} />
                  </button>
                </div>
              )}
              <div style={{ display: 'flex', gap: 8, alignItems: 'flex-end' }}>
                <TextArea
                  ref={inputRef}
                  value={inputValue}
                  onChange={(e) => setInputValue(e.target.value)}
                  onKeyDown={handleKeyDown}
                  placeholder="输入消息... (Enter 发送)"
                  autoSize={{ minRows: 1, maxRows: 4 }}
                  disabled={isGenerating}
                  style={{
                    flex: 1,
                    resize: 'none',
                    background: 'var(--bg-secondary)',
                    borderColor: 'var(--border-color)',
                    color: 'var(--text-primary)',
                    borderRadius: 12,
                    padding: '8px 14px',
                    fontSize: 13,
                  }}
                />
                {/* 语音输入按钮 */}
                {isVoiceSupported && (
                  <button
                    onClick={toggleListening}
                    title={isListening ? '停止语音输入' : '语音输入'}
                    style={{
                      width: 36, height: 36, borderRadius: 10,
                      border: 'none',
                      background: isListening ? '#ff4d4f' : 'var(--bg-secondary)',
                      color: isListening ? '#fff' : 'var(--text-secondary)',
                      cursor: 'pointer',
                      display: 'flex', alignItems: 'center', justifyContent: 'center',
                      flexShrink: 0,
                      transition: 'all 0.15s ease',
                    }}
                  >
                    {isListening ? <MicOff size={16} /> : <Mic size={16} />}
                  </button>
                )}
                {/* 图片上传按钮 */}
                <button
                  onClick={() => imageInputRef.current?.click()}
                  title="上传图片"
                  style={{
                    width: 36, height: 36, borderRadius: 10,
                    border: '1px solid var(--border-color)',
                    background: 'var(--bg-secondary)',
                    color: 'var(--text-secondary)',
                    cursor: 'pointer',
                    display: 'flex', alignItems: 'center', justifyContent: 'center',
                    flexShrink: 0,
                  }}
                >
                  <ImagePlus size={16} />
                </button>
                {/* Prompt 模板按钮 */}
                <div style={{ position: 'relative' }}>
                  <button
                    onClick={() => { setShowTemplateLibrary(!showTemplateLibrary); }}
                    title="Prompt 模板"
                    style={{
                      width: 36, height: 36, borderRadius: 10,
                      border: '1px solid var(--border-color)',
                      background: showTemplateLibrary ? 'var(--primary-bg)' : 'var(--bg-secondary)',
                      color: showTemplateLibrary ? 'var(--primary-color)' : 'var(--text-secondary)',
                      cursor: 'pointer',
                      display: 'flex', alignItems: 'center', justifyContent: 'center',
                      flexShrink: 0,
                    }}
                  >
                    <Sparkles size={16} />
                  </button>
                  <PromptTemplateLibrary
                    visible={showTemplateLibrary}
                    onClose={() => setShowTemplateLibrary(false)}
                    onSelect={(prompt) => {
                      setInputValue(prompt);
                      setShowTemplateLibrary(false);
                      setTimeout(() => inputRef.current?.focus(), 100);
                    }}
                  />
                </div>
                <input
                  ref={imageInputRef}
                  type="file"
                  accept="image/*"
                  style={{ display: 'none' }}
                  onChange={handleImageUpload}
                />
                {isGenerating || agentIsRunning ? (
                  <button
                    onClick={agentIsRunning ? cancelAgentTask : stopGeneration}
                    title={agentIsRunning ? '取消 Agent 任务' : '停止生成'}
                    style={{
                      width: 36,
                      height: 36,
                      borderRadius: 10,
                      border: '1px solid var(--border-color)',
                      background: 'var(--bg-secondary)',
                      color: 'var(--text-secondary)',
                      cursor: 'pointer',
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'center',
                      flexShrink: 0,
                      transition: 'all 0.15s ease',
                    }}
                    onMouseEnter={(e) => {
                      (e.currentTarget as HTMLElement).style.borderColor = '#ff4d4f';
                      (e.currentTarget as HTMLElement).style.color = '#ff4d4f';
                    }}
                    onMouseLeave={(e) => {
                      (e.currentTarget as HTMLElement).style.borderColor = 'var(--border-color)';
                      (e.currentTarget as HTMLElement).style.color = 'var(--text-secondary)';
                    }}
                  >
                    <Square size={16} />
                  </button>
                ) : (
                  <button
                    onClick={handleSend}
                    disabled={!inputValue.trim()}
                    title="发送"
                    style={{
                      width: 36,
                      height: 36,
                      borderRadius: 10,
                      border: 'none',
                      background: inputValue.trim() ? 'var(--primary-color)' : 'var(--bg-tertiary)',
                      color: inputValue.trim() ? '#fff' : 'var(--text-tertiary)',
                      cursor: inputValue.trim() ? 'pointer' : 'not-allowed',
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'center',
                      flexShrink: 0,
                      transition: 'all 0.15s ease',
                    }}
                  >
                    <Send size={16} />
                  </button>
                )}
              </div>
            </div>
            </div>
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      {showWorkflowEditor && <WorkflowEditor onClose={() => setShowWorkflowEditor(false)} />}
      {showUsageDashboard && <AIUsageDashboard onClose={() => setShowUsageDashboard(false)} />}
    </>
  );
};
