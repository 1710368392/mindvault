import React, { useState, useRef, useEffect, useCallback } from 'react';
import { Input, Select, Tooltip } from 'antd';
import { motion, AnimatePresence } from 'framer-motion';
import { Send, Square, X, Bot, Sparkles, Play, Plus, Globe, Trash2, Brain, Mic, MicOff, Volume2, VolumeX, Wrench, ImagePlus, Cpu, Maximize2 } from 'lucide-react';
import aiAssistantIcon from '../../assets/ai-assistant-icon.svg';
import ReactMarkdown from 'react-markdown';
import remarkGfm from 'remark-gfm';
import { createPortal } from 'react-dom';
import { useAIStore, isMusicRelated } from '../../stores/aiStore';
import { useSettingsStore } from '../../stores/settingsStore';
import { useMusicStore } from '../../stores/musicStore';
import { useUIStore } from '../../stores/uiStore';
import { useVoiceInput } from '../../hooks/useVoiceInput';
import { useEdgeTTS } from '../../hooks/useEdgeTTS';
import ThinkingSection from './ThinkingSection';
import CreativityRefCard from './CreativityRefCard';

const { TextArea } = Input;

function getToolLabel(name: string): string {
  const labels: Record<string, string> = {
    get_current_time: '获取时间', search_creativity: '搜索创意库', create_creativity: '创建创意',
    update_creativity: '更新创意', delete_creativity: '删除创意', get_creativity_detail: '创意详情',
    list_creativities: '列出创意', tag_creativity: '标签管理', link_creativities: '关联创意',
    create_board: '创建看板', add_to_board: '添加到看板', get_board_overview: '看板概览',
    create_tag: '创建标签', search_tags: '搜索标签', get_popular_tags: '热门标签',
    search_templates: '搜索模板', global_search: '全局搜索', search_by_date_range: '日期搜索',
    get_app_stats: '应用统计', get_recent_edits: '最近编辑', navigate_to_page: '页面导航',
    get_current_context: '界面上下文', show_notification: '显示通知', open_external_url: '打开链接',
    get_music_status: '音乐状态', search_music: '搜索音乐', calculate: '数学计算',
    web_search: '联网搜索', execute_code: '执行代码', read_file: '读取文件', list_directory: '浏览目录',
  };
  return labels[name] || name;
}

const QUICK_COMMANDS = [
  { label: '灵感', icon: '💡', prompt: '请给我一些创意灵感，帮助我拓展思路。' },
  { label: '续写', icon: '📝', prompt: '请根据上面的内容，帮我续写下去。' },
  { label: '摘要', icon: '📋', prompt: '请帮我总结一下上面对话的关键内容。' },
  { label: '改写', icon: '🔄', prompt: '请帮我用不同的方式重新表达上面的内容。' },
];

const MUSIC_QUICK_COMMANDS = [
  { label: '找歌', icon: '🎵', prompt: '我想听歌，请根据我本地音乐库中的歌曲，推荐一些适合当前心情的歌曲。如果没有特定心情，就推荐我最常听的歌曲。', isMusic: true },
  { label: '听歌报告', icon: '📊', prompt: '请帮我分析我的听歌习惯和偏好，生成一份听歌总结报告。', isMusic: true },
  { label: '情绪分类', icon: '🎭', prompt: '请帮我分析本地音乐库中的歌曲，为每首歌进行情绪分类，帮我整理出不同心情的歌单。', isMusic: true },
];

const AGENT_QUICK_COMMANDS = [
  { label: '📖 阅读', icon: '📖', prompt: '帮我阅读和查看创意库中的内容', isAgent: true },
  { label: '✏️ 编辑', icon: '✏️', prompt: '帮我编辑和修改创意内容', isAgent: true },
  { label: '💻 终端', icon: '💻', prompt: '帮我执行代码或脚本', isAgent: true },
  { label: '👁️ 预览', icon: '👁️', prompt: '帮我预览创意内容的渲染效果', isAgent: true },
  { label: '🔍 搜索', icon: '🔍', prompt: '帮我联网搜索相关资料', isAgent: true },
  { label: '整理创意', icon: '🗂️', prompt: '帮我整理一下创意库，自动分类归纳', isAgent: true },
  { label: '周报', icon: '📊', prompt: '生成本周创作总结', isAgent: true },
  { label: '拓展灵感', icon: '💡', prompt: '帮我拓展这个灵感，搜索相关资料', isAgent: true },
  { label: '批量标签', icon: '🏷️', prompt: '给最近的创意自动打标签', isAgent: true },
];

const MINI_WIDTH = 400;
const MINI_HEIGHT = 560;
const MINI_MIN_WIDTH = 340;
const MINI_MIN_HEIGHT = 400;

const AIChatMiniWindow: React.FC = () => {
  const aiPanelMode = useUIStore((s) => s.aiPanelMode);
  const openAiFullscreen = useUIStore((s) => s.openAiFullscreen);
  const closeAiPanel = useUIStore((s) => s.closeAiPanel);

  // 使用选择器模式避免高频重渲染（streamingText 等每 token 都会更新）
  const chatWindows = useAIStore((s) => s.chatWindows);
  const activeWindowId = useAIStore((s) => s.activeWindowId);
  const messages = useAIStore((s) => s.messages);
  const isGenerating = useAIStore((s) => s.isGenerating);
  const streamingText = useAIStore((s) => s.streamingText);
  const error = useAIStore((s) => s.error);
  const webSearchEnabled = useAIStore((s) => s.webSearchEnabled);
  const sendMessage = useAIStore((s) => s.sendMessage);
  const sendMusicMessage = useAIStore((s) => s.sendMusicMessage);
  const stopGeneration = useAIStore((s) => s.stopGeneration);
  const createWindow = useAIStore((s) => s.createWindow);
  const switchWindow = useAIStore((s) => s.switchWindow);
  const closeWindow = useAIStore((s) => s.closeWindow);
  const clearAllWindows = useAIStore((s) => s.clearAllWindows);
  const toggleWebSearch = useAIStore((s) => s.toggleWebSearch);
  const loadFromStorage = useAIStore((s) => s.loadFromStorage);
  const settings = useSettingsStore((s) => s.settings);
  const saveSettings = useSettingsStore((s) => s.saveSettings);
  const loadTrack = useMusicStore((s) => s.loadTrack);
  const tracks = useMusicStore((s) => s.tracks);
  const [inputValue, setInputValue] = useState('');
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const hasLoadedRef = useRef(false); // 防止重复加载
  const inputRef = useRef<any>(null);
  const [showClearConfirm, setShowClearConfirm] = useState(false);
  const imageInputRef = useRef<HTMLInputElement>(null);
  const [pendingImage, setPendingImage] = useState<string | null>(null);

  const { isListening, isSupported: isVoiceSupported, toggleListening } = useVoiceInput({
    onResult: (text) => setInputValue(text),
  });
  // 从设置读取 TTS 参数
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

  const memoryEnabled = useAIStore((s) => s.memoryEnabled);
  const toolCallsEnabled = useAIStore((s) => s.toolCallsEnabled);
  const activeToolCalls = useAIStore((s) => s.activeToolCalls);
  const completedToolCalls = useAIStore((s) => s.completedToolCalls);
  const setMemoryEnabled = useAIStore((s) => s.setMemoryEnabled);
  const setToolCallsEnabled = useAIStore((s) => s.setToolCallsEnabled);
  const agentModeEnabled = useAIStore((s) => s.agentModeEnabled);
  const agentIsRunning = useAIStore((s) => s.agentIsRunning);
  const agentStatus = useAIStore((s) => s.agentStatus);
  const agentThinking = useAIStore((s) => s.agentThinking);
  const currentReasoningSteps = useAIStore((s) => s.currentReasoningSteps);
  const agentSummary = useAIStore((s) => s.agentSummary);
  const setAgentModeEnabled = useAIStore((s) => s.setAgentModeEnabled);
  const executeAgentTask = useAIStore((s) => s.executeAgentTask);
  const cancelAgentTask = useAIStore((s) => s.cancelAgentTask);

  const currentProvider = settings.aiDefaultProvider;
  const currentModel = settings.aiDefaultModel;

  const [windowPos, setWindowPos] = useState({ x: window.innerWidth - MINI_WIDTH - 30, y: 80 });
  const [windowSize, setWindowSize] = useState({ width: MINI_WIDTH, height: MINI_HEIGHT });
  const [isDraggingWin, setIsDraggingWin] = useState(false);
  const [isResizing, setIsResizing] = useState(false);
  const [dragWinStart, setDragWinStart] = useState({ x: 0, y: 0 });
  const [posWinStart, setPosWinStart] = useState({ x: 0, y: 0 });
  const [resizeStart, setResizeStart] = useState({ x: 0, y: 0, w: 0, h: 0 });
  // 使用 ref 保存最新 windowSize，避免闭包问题
  const windowSizeRef = useRef(windowSize);
  useEffect(() => { windowSizeRef.current = windowSize; }, [windowSize]);

  const getModelOptions = useCallback(() => {
    const models: Record<string, string[]> = {
      openai: ['gpt-5.5', 'gpt-5.5-pro', 'gpt-5.5-instant', 'gpt-5', 'o3', 'o3-mini', 'o4-mini'],
      anthropic: ['claude-opus-4-7', 'claude-sonnet-4-6', 'claude-haiku-4'],
      deepseek: ['deepseek-v4-pro', 'deepseek-v4-flash', 'deepseek-v4', 'deepseek-chat', 'deepseek-reasoner'],
      custom: [],
    };
    return (models[currentProvider] || []).map((m) => ({ label: m, value: m }));
  }, [currentProvider]);

  const hasApiKey = useCallback(() => {
    switch (currentProvider) {
      case 'openai': return !!settings.aiOpenaiApiKey;
      case 'anthropic': return !!settings.aiAnthropicApiKey;
      case 'deepseek': return !!settings.aiDeepseekApiKey;
      case 'custom': return !!settings.aiCustomApiKey;
      default: return false;
    }
  }, [currentProvider, settings]);

  const scrollToBottom = useCallback(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, []);

  const parseSongMentions = useCallback((content: string): Array<{ title: string; artist: string }> => {
    // 安全检查：确保 content 是字符串
    if (typeof content !== 'string') {
      return [];
    }
    const songMentions: Array<{ title: string; artist: string }> = [];
    const regex = /【歌曲:([^】]+)】/g;
    let match;
    while ((match = regex.exec(content)) !== null) {
      const songInfo = match[1];
      const parts = songInfo.split('-');
      if (parts.length >= 2) {
        songMentions.push({ title: parts[0].trim(), artist: parts.slice(1).join('-').trim() });
      } else {
        songMentions.push({ title: songInfo.trim(), artist: '' });
      }
    }
    return songMentions;
  }, []);

  const handlePlayRecommendedSong = useCallback(
    (title: string, artist: string) => {
      const storeIndex = tracks.findIndex(
        (t) => t.title.toLowerCase().includes(title.toLowerCase()) &&
          (!artist || t.artist.toLowerCase().includes(artist.toLowerCase()))
      );
      if (storeIndex >= 0) loadTrack(storeIndex, true);
    },
    [tracks, loadTrack]
  );

  const extractAndRemoveSongMarks = useCallback((content: string): { cleanContent: string; songs: Array<{ title: string; artist: string }> } => {
    // 安全检查：确保 content 是字符串
    const safeContent = typeof content === 'string' ? content : '';
    const songs = parseSongMentions(safeContent);
    const cleanContent = safeContent.replace(/【歌曲:([^】]+)】/g, '$1');
    return { cleanContent, songs };
  }, [parseSongMentions]);

  const handleImageUpload = useCallback((e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    if (file.size > 10 * 1024 * 1024) return;
    const reader = new FileReader();
    reader.onload = () => setPendingImage(reader.result as string);
    reader.readAsDataURL(file);
    e.target.value = '';
  }, []);

  useEffect(() => { 
    if (aiPanelMode === 'mini' && !hasLoadedRef.current) {
      hasLoadedRef.current = true;
      useAIStore.getState().loadFromStorage(); 
    }
    if (aiPanelMode !== 'mini') {
      hasLoadedRef.current = false;
    }
  }, [aiPanelMode]);
  useEffect(() => { scrollToBottom(); }, [messages, streamingText, scrollToBottom]);
  useEffect(() => { if (aiPanelMode === 'mini') setTimeout(() => inputRef.current?.focus(), 300); }, [aiPanelMode]);

  const handleSend = useCallback(async () => {
    const text = inputValue.trim();
    if ((!text && !pendingImage) || isGenerating || agentIsRunning) return;
    let content: string;
    if (pendingImage && text) { content = `[图片] ${text}`; setPendingImage(null); }
    else if (pendingImage) { content = '[图片] 请描述这张图片'; setPendingImage(null); }
    else { content = text; }
    setInputValue('');
    if (agentModeEnabled) { await executeAgentTask(content); return; }
    if (isMusicRelated(content)) { await sendMusicMessage(content); }
    else { await sendMessage(content); }
  }, [inputValue, isGenerating, agentIsRunning, agentModeEnabled, pendingImage, sendMessage, sendMusicMessage, executeAgentTask]);

  const handleKeyDown = useCallback((e: React.KeyboardEvent) => {
    if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); handleSend(); }
  }, [handleSend]);

  const handleQuickCommand = useCallback(
    (prompt: string, isMusic?: boolean, isAgent?: boolean) => {
      if (isGenerating || agentIsRunning) return;
      setInputValue('');
      if (isAgent || agentModeEnabled) executeAgentTask(prompt);
      else if (isMusic) sendMusicMessage(prompt);
      else sendMessage(prompt);
    },
    [isGenerating, agentIsRunning, agentModeEnabled, sendMessage, sendMusicMessage, executeAgentTask]
  );

  const handleNewWindow = useCallback(() => createWindow(), [createWindow]);
  const handleClearAll = useCallback(() => { clearAllWindows(); setShowClearConfirm(false); }, [clearAllWindows]);

  // 窗口拖拽
  const handleTitleMouseDown = useCallback((e: React.MouseEvent) => {
    e.preventDefault();
    setIsDraggingWin(true);
    setDragWinStart({ x: e.clientX, y: e.clientY });
    setPosWinStart({ x: windowPos.x, y: windowPos.y });
  }, [windowPos]);

  useEffect(() => {
    if (!isDraggingWin) return;
    const onMove = (e: MouseEvent) => {
      const dx = e.clientX - dragWinStart.x;
      const dy = e.clientY - dragWinStart.y;
      // 允许拖到屏幕外，不做边界限制
      setWindowPos({
        x: posWinStart.x + dx,
        y: posWinStart.y + dy,
      });
    };
    const onUp = (e: MouseEvent) => {
      setIsDraggingWin(false);
      // 检测整个电脑屏幕边缘进行吸附
      const snapThreshold = 50;
      const hideOffset = 20; // 半隐藏时露出多少像素
      const size = windowSizeRef.current;
      
      // 获取整个屏幕尺寸
      const screenWidth = window.screen.width;
      const screenHeight = window.screen.height;
      
      // 获取窗口相对屏幕的位置
      const screenX = e.screenX - (e.clientX - posWinStart.x);
      const screenY = e.screenY - (e.clientY - posWinStart.y);
      
      const currentPos = {
        x: Math.max(0, Math.min(posWinStart.x + (e.clientX - dragWinStart.x), screenWidth - 100)),
        y: Math.max(0, Math.min(posWinStart.y + (e.clientY - dragWinStart.y), screenHeight - 60)),
      };
      let newX = currentPos.x;
      let newY = currentPos.y;

      // 左侧吸附
      if (currentPos.x < snapThreshold) {
        newX = 0;
      }
      // 右侧吸附
      else if (currentPos.x + size.width > screenWidth - snapThreshold) {
        newX = screenWidth - size.width;
      }
      // 顶部吸附
      else if (currentPos.y < snapThreshold) {
        newY = 0;
      }
      // 底部吸附
      else if (currentPos.y + size.height > screenHeight - snapThreshold) {
        newY = screenHeight - size.height;
      }

      if (newX !== currentPos.x || newY !== currentPos.y) {
        setWindowPos({ x: newX, y: newY });
      }
    };
    window.addEventListener('mousemove', onMove);
    window.addEventListener('mouseup', onUp);
    return () => { window.removeEventListener('mousemove', onMove); window.removeEventListener('mouseup', onUp); };
  }, [isDraggingWin, dragWinStart, posWinStart]);

  // 窗口缩放
  const handleResizeMouseDown = useCallback((e: React.MouseEvent) => {
    e.preventDefault();
    e.stopPropagation();
    setIsResizing(true);
    setResizeStart({ x: e.clientX, y: e.clientY, w: windowSize.width, h: windowSize.height });
  }, [windowSize]);

  useEffect(() => {
    if (!isResizing) return;
    const onMove = (e: MouseEvent) => {
      const newW = Math.max(MINI_MIN_WIDTH, resizeStart.w + (e.clientX - resizeStart.x));
      const newH = Math.max(MINI_MIN_HEIGHT, resizeStart.h + (e.clientY - resizeStart.y));
      setWindowSize({ width: newW, height: newH });
    };
    const onUp = () => setIsResizing(false);
    window.addEventListener('mousemove', onMove);
    window.addEventListener('mouseup', onUp);
    return () => { window.removeEventListener('mousemove', onMove); window.removeEventListener('mouseup', onUp); };
  }, [isResizing, resizeStart]);

  // Esc 键关闭迷你窗口
  useEffect(() => {
    if (aiPanelMode !== 'mini') return;
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        e.preventDefault();
        closeAiPanel();
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [aiPanelMode, closeAiPanel]);

  const renderMessage = (msg: { role: string; content: string; creativityRefs?: any[] }, index: number) => {
    if (!msg || typeof msg !== 'object') {
      console.warn('[AIChatMiniWindow] 无效的消息对象:', msg);
      return null;
    }
    const isUser = msg.role === 'user';
    const content = msg.content || '';
    const { cleanContent, songs } = isUser ? { cleanContent: content, songs: [] } : extractAndRemoveSongMarks(content);
    const hasCreativityRefs = isUser && msg.creativityRefs && msg.creativityRefs.length > 0;

    return (
      <motion.div
        key={index}
        initial={{ opacity: 0, y: 10 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.2 }}
        style={{ display: 'flex', justifyContent: isUser ? 'flex-end' : 'flex-start', marginBottom: 12, padding: '0 10px' }}
      >
        {!isUser && (
          <div style={{
            width: 26, height: 26, borderRadius: '50%', background: 'var(--primary-bg)',
            display: 'flex', alignItems: 'center', justifyContent: 'center', marginRight: 6, flexShrink: 0, marginTop: 2,
          }}>
            <Bot size={14} style={{ color: 'var(--primary-color)' }} />
          </div>
        )}
        <div style={{
          maxWidth: isUser ? '80%' : '85%', padding: '8px 12px',
          borderRadius: isUser ? '14px 14px 4px 14px' : '14px 14px 14px 4px',
          background: isUser ? 'var(--primary-color)' : 'var(--bg-secondary)',
          color: isUser ? '#fff' : 'var(--text-primary)',
          fontSize: 13, lineHeight: 1.7, wordBreak: 'break-word', boxShadow: 'var(--shadow-sm)',
        }}>
          {isUser ? (
            hasCreativityRefs ? (
              <div>
                <span style={{ whiteSpace: 'pre-wrap', display: 'block', marginBottom: 6 }}>{msg.content}</span>
                <div style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
                  {msg.creativityRefs!.map((ref: any) => (
                    <CreativityRefCard key={ref.id} ref={ref} />
                  ))}
                </div>
              </div>
            ) : (
              <span style={{ whiteSpace: 'pre-wrap' }}>{msg.content}</span>
            )
          ) : (
            <>
              {(() => {
                const steps = (msg as any).reasoningSteps;
                const isAgentTag = steps && steps.length === 1 && steps[0].id === 'agent_tag';
                const hasRealSteps = steps && steps.length > 0 && !isAgentTag;
                return hasRealSteps ? (
                  <ThinkingSection
                    steps={steps}
                    isThinking={false}
                    collapsed={(msg as any).reasoningCollapsed ?? true}
                    variant="mini"
                  />
                ) : null;
              })()}
              <div className="ai-markdown-body"><ReactMarkdown remarkPlugins={[remarkGfm]}>{cleanContent}</ReactMarkdown></div>
              {completedToolCalls.length > 0 && (
                <div style={{ marginTop: 6, display: 'flex', flexDirection: 'column', gap: 3 }}>
                  {completedToolCalls.map((tc) => (
                    <div key={tc.id} style={{ padding: '4px 8px', borderRadius: 5, background: 'var(--bg-tertiary)', border: '1px solid var(--border-light)', fontSize: 11 }}>
                      <div style={{ display: 'flex', alignItems: 'center', gap: 4, color: 'var(--text-secondary)' }}>
                        <Wrench size={10} />
                        <span style={{ fontWeight: 500 }}>{getToolLabel(tc.name)}</span>
                        <span style={{ color: tc.status === 'error' ? '#ff4d4f' : 'var(--text-tertiary)' }}>
                          {tc.status === 'completed' ? '✓' : tc.status === 'error' ? '✗' : '...'}
                        </span>
                      </div>
                    </div>
                  ))}
                </div>
              )}
              {isTTSSupported && (
                <div style={{ display: 'flex', justifyContent: 'flex-end', marginTop: 3 }}>
                  <button onClick={() => toggleTTS(typeof msg.content === 'string' ? msg.content : '')}
                    style={{ background: 'none', border: 'none', cursor: 'pointer', color: 'var(--text-tertiary)', padding: 2, opacity: 0.6 }}
                    title={isSpeaking ? '停止朗读' : '朗读此消息'}>
                    {isSpeaking ? <VolumeX size={11} /> : <Volume2 size={11} />}
                  </button>
                </div>
              )}
              {songs.length > 0 && (
                <div style={{ marginTop: 8, padding: '8px 10px', borderRadius: 6, backgroundColor: 'var(--bg-tertiary)', border: '1px solid var(--border-light)' }}>
                  <div style={{ fontSize: 10, fontWeight: 500, color: 'var(--text-secondary)', marginBottom: 6 }}>推荐歌曲</div>
                  <div style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
                    {songs.map((song, idx) => {
                      const exists = tracks.some(t => t.title.toLowerCase().includes(song.title.toLowerCase()) && (!song.artist || t.artist.toLowerCase().includes(song.artist.toLowerCase())));
                      return (
                        <div key={idx} style={{ display: 'flex', alignItems: 'center', gap: 6, padding: '4px 6px', borderRadius: 4, backgroundColor: 'var(--bg-secondary)' }}>
                          <div style={{ flex: 1, minWidth: 0 }}>
                            <div style={{ fontSize: 11, fontWeight: 500, color: 'var(--text-primary)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{song.title}</div>
                            {song.artist && <div style={{ fontSize: 9, color: 'var(--text-tertiary)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{song.artist}</div>}
                          </div>
                          <motion.button whileHover={{ scale: 1.1 }} whileTap={{ scale: 0.9 }}
                            onClick={() => handlePlayRecommendedSong(song.title, song.artist)} disabled={!exists}
                            style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', width: 24, height: 24, borderRadius: '50%', border: 'none', backgroundColor: exists ? 'var(--primary-color)' : 'var(--bg-tertiary)', color: exists ? '#fff' : 'var(--text-tertiary)', cursor: exists ? 'pointer' : 'not-allowed', opacity: exists ? 1 : 0.5, flexShrink: 0 }}>
                            <Play size={10} fill={exists ? '#fff' : 'none'} />
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

  if (aiPanelMode !== 'mini') return null;

  return createPortal(
    <>
      <style>{`
        .ai-markdown-body { font-size: 13px; line-height: 1.7; color: var(--text-primary); }
        .ai-markdown-body p { margin: 0 0 6px 0; }
        .ai-markdown-body p:last-child { margin-bottom: 0; }
        .ai-markdown-body ul, .ai-markdown-body ol { margin: 4px 0; padding-left: 18px; }
        .ai-markdown-body li { margin: 2px 0; }
        .ai-markdown-body code { background: var(--bg-tertiary); padding: 1px 4px; border-radius: 3px; font-size: 12px; font-family: 'Consolas', 'Monaco', monospace; }
        .ai-markdown-body pre { background: var(--bg-tertiary); padding: 8px 10px; border-radius: 6px; overflow-x: auto; margin: 6px 0; }
        .ai-markdown-body pre code { background: none; padding: 0; font-size: 12px; }
        .ai-markdown-body blockquote { border-left: 3px solid var(--primary-color); margin: 6px 0; padding: 3px 10px; color: var(--text-secondary); }
        .ai-markdown-body h1, .ai-markdown-body h2, .ai-markdown-body h3 { margin: 8px 0 4px 0; font-weight: 600; }
        .ai-markdown-body h1 { font-size: 16px; } .ai-markdown-body h2 { font-size: 14px; } .ai-markdown-body h3 { font-size: 13px; }
        .ai-markdown-body table { border-collapse: collapse; width: 100%; margin: 6px 0; font-size: 12px; }
        .ai-markdown-body th, .ai-markdown-body td { border: 1px solid var(--border-light); padding: 4px 8px; text-align: left; }
        .ai-markdown-body th { background: var(--bg-tertiary); font-weight: 600; }
        .ai-markdown-body a { color: var(--primary-color); text-decoration: none; }
        .ai-markdown-body a:hover { text-decoration: underline; }
        .ai-markdown-body hr { border: none; border-top: 1px solid var(--border-light); margin: 8px 0; }
        .ai-markdown-body strong { font-weight: 600; }
        .ai-cursor-blink { display: inline-block; width: 2px; height: 1em; background: var(--primary-color); margin-left: 2px; vertical-align: text-bottom; animation: ai-cursor-blink 0.8s ease-in-out infinite; }
        @keyframes ai-cursor-blink { 0%, 100% { opacity: 1; } 50% { opacity: 0; } }
        @keyframes blink { 0%, 100% { opacity: 1; } 50% { opacity: 0; } }
        .chat-window-tab { transition: all 0.2s ease; }
        .chat-window-tab:hover { background: var(--bg-tertiary); }
        .chat-window-tab.active { background: var(--primary-bg); color: var(--primary-color); border-bottom: 2px solid var(--primary-color); }
      `}</style>

      <AnimatePresence>
        <motion.div
          initial={{ opacity: 0, scale: 0.85, y: 20 }}
          animate={{ opacity: 1, scale: 1, y: 0 }}
          exit={{ opacity: 0, scale: 0.85, y: 20 }}
          transition={{ type: 'spring', damping: 25, stiffness: 350 }}
          onMouseEnter={() => {
            // 鼠标进入时，如果处于半隐藏状态则恢复
            if (
              windowPos.x < 0 ||
              windowPos.x + windowSize.width > window.screen.width - 20 ||
              windowPos.y < 0 ||
              windowPos.y + windowSize.height > window.screen.height - 20
            ) {
              // 恢复到最后一次正常位置（屏幕中央偏右）
              setWindowPos({ x: window.screen.width - windowSize.width - 30, y: 80 });
            }
          }}
          style={{
            position: 'fixed',
            left: windowPos.x,
            top: windowPos.y,
            width: windowSize.width,
            height: windowSize.height,
            background: 'var(--bg-primary)',
            borderRadius: 16,
            border: '1px solid var(--border-light)',
            boxShadow: '0 12px 48px rgba(0,0,0,0.18), 0 2px 8px rgba(0,0,0,0.08)',
            zIndex: 10001,
            display: 'flex',
            flexDirection: 'column',
            overflow: 'hidden',
          }}
        >
          {/* 标题栏 - 可拖拽 */}
          <div
            onMouseDown={handleTitleMouseDown}
            style={{
              display: 'flex', alignItems: 'center', justifyContent: 'space-between',
              padding: '10px 14px', borderBottom: '1px solid var(--border-light)',
              flexShrink: 0, cursor: isDraggingWin ? 'grabbing' : 'grab',
              background: 'var(--bg-secondary)',
            }}
          >
            <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
              <div style={{
                width: 28, height: 28, borderRadius: '50%',
                background: 'transparent',
                display: 'flex', alignItems: 'center', justifyContent: 'center',
                overflow: 'hidden',
              }}>
                <img src={aiAssistantIcon} alt="AI" draggable={false} style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
              </div>
              <span style={{ fontWeight: 600, fontSize: 14, color: 'var(--text-primary)' }}>AI 助手</span>
            </div>
            <div style={{ display: 'flex', alignItems: 'center', gap: 2 }}>
              {/* 功能开关 */}
              <Tooltip title={webSearchEnabled ? '联网搜索已开启' : '联网搜索已关闭'}>
                <button onClick={toggleWebSearch} style={{
                  background: webSearchEnabled ? 'var(--primary-bg)' : 'none', border: 'none', cursor: 'pointer',
                  color: webSearchEnabled ? 'var(--primary-color)' : 'var(--text-tertiary)', padding: 4, borderRadius: 5,
                  display: 'flex', alignItems: 'center', transition: 'all 0.15s ease',
                }}><Globe size={14} /></button>
              </Tooltip>
              <Tooltip title={toolCallsEnabled ? '工具调用已开启' : '工具调用已关闭'}>
                <button onClick={() => setToolCallsEnabled(!toolCallsEnabled)} style={{
                  background: toolCallsEnabled ? 'var(--primary-bg)' : 'none', border: 'none', cursor: 'pointer',
                  color: toolCallsEnabled ? 'var(--primary-color)' : 'var(--text-tertiary)', padding: 4, borderRadius: 5,
                  display: 'flex', alignItems: 'center', transition: 'all 0.15s ease',
                }}><Wrench size={14} /></button>
              </Tooltip>
              {/* Agent 模式按钮已隐藏 - AI 自动检测 */}
              <Tooltip title={memoryEnabled ? 'AI记忆已开启' : 'AI记忆已关闭'}>
                <button onClick={() => setMemoryEnabled(!memoryEnabled)} style={{
                  background: memoryEnabled ? 'var(--primary-bg)' : 'none', border: 'none', cursor: 'pointer',
                  color: memoryEnabled ? 'var(--primary-color)' : 'var(--text-tertiary)', padding: 4, borderRadius: 5,
                  display: 'flex', alignItems: 'center', transition: 'all 0.15s ease',
                }}><Brain size={14} /></button>
              </Tooltip>

              <div style={{ width: 1, height: 16, background: 'var(--border-light)', margin: '0 4px' }} />

              {/* 全屏按钮 */}
              <Tooltip title="全屏模式">
                <button onClick={openAiFullscreen} style={{
                  background: 'none', border: 'none', cursor: 'pointer', color: 'var(--text-tertiary)',
                  padding: 4, borderRadius: 5, display: 'flex', alignItems: 'center',
                  transition: 'color 0.15s ease',
                }}
                  onMouseEnter={(e) => { (e.currentTarget as HTMLElement).style.color = 'var(--primary-color)'; }}
                  onMouseLeave={(e) => { (e.currentTarget as HTMLElement).style.color = 'var(--text-tertiary)'; }}
                ><Maximize2 size={15} /></button>
              </Tooltip>
              {/* 关闭按钮 */}
              <button onClick={closeAiPanel} style={{
                background: 'none', border: 'none', cursor: 'pointer', color: 'var(--text-tertiary)',
                padding: 4, borderRadius: 5, display: 'flex', alignItems: 'center',
                transition: 'color 0.15s ease',
              }}
                onMouseEnter={(e) => { (e.currentTarget as HTMLElement).style.color = '#ff4d4f'; }}
                onMouseLeave={(e) => { (e.currentTarget as HTMLElement).style.color = 'var(--text-tertiary)'; }}
              ><X size={16} /></button>
            </div>
          </div>

          {/* 窗口标签栏 */}
          <div style={{
            display: 'flex', alignItems: 'center', gap: 3, padding: '6px 10px',
            borderBottom: '1px solid var(--border-light)', flexShrink: 0, background: 'var(--bg-tertiary)', overflowX: 'auto',
          }}>
            {chatWindows.map((w) => (
              <div key={w.id} className={`chat-window-tab ${activeWindowId === w.id ? 'active' : ''}`}
                onClick={() => switchWindow(w.id)}
                style={{
                  display: 'flex', alignItems: 'center', gap: 4, padding: '4px 8px', borderRadius: 5,
                  cursor: 'pointer', fontSize: 11,
                  color: activeWindowId === w.id ? 'var(--primary-color)' : 'var(--text-secondary)',
                  background: activeWindowId === w.id ? 'var(--primary-bg)' : 'transparent',
                  borderBottom: activeWindowId === w.id ? '2px solid var(--primary-color)' : '2px solid transparent',
                  whiteSpace: 'nowrap', maxWidth: 100,
                }}>
                <span style={{ overflow: 'hidden', textOverflow: 'ellipsis' }}>{w.title}</span>
                {chatWindows.length > 1 && (
                  <button onClick={(e) => { e.stopPropagation(); closeWindow(w.id); }}
                    style={{ background: 'none', border: 'none', cursor: 'pointer', color: 'inherit', padding: 0, display: 'flex', alignItems: 'center', opacity: 0.6 }}>
                    <X size={10} />
                  </button>
                )}
              </div>
            ))}
            <Tooltip title="新建对话">
              <button onClick={handleNewWindow} style={{
                display: 'flex', alignItems: 'center', justifyContent: 'center', width: 24, height: 24,
                borderRadius: 5, border: '1px dashed var(--border-color)', background: 'transparent',
                color: 'var(--text-tertiary)', cursor: 'pointer', flexShrink: 0,
              }}><Plus size={12} /></button>
            </Tooltip>
          </div>

          {/* 提供商 + 模型 */}
          <div style={{
            display: 'flex', alignItems: 'center', gap: 6, padding: '6px 10px',
            borderBottom: '1px solid var(--border-light)', flexShrink: 0, background: 'var(--bg-tertiary)',
          }}>
            <Select value={currentProvider} onChange={(val) => saveSettings({ aiDefaultProvider: val as any, aiDefaultModel: '' })}
              size="small" style={{ width: 90 }}
              options={[
                { label: 'OpenAI', value: 'openai' }, { label: 'Anthropic', value: 'anthropic' },
                { label: 'DeepSeek', value: 'deepseek' }, { label: '自定义', value: 'custom' },
              ]} popupMatchSelectWidth={false} />
            <Select value={currentModel} onChange={(val) => saveSettings({ aiDefaultModel: val })}
              size="small" style={{ flex: 1, minWidth: 0 }} options={getModelOptions()}
              showSearch placeholder="选择模型" notFoundContent={null} popupMatchSelectWidth={false} />
            {!hasApiKey() && <span style={{ fontSize: 10, color: 'var(--text-tertiary)', whiteSpace: 'nowrap' }}>未配置Key</span>}
          </div>

          {/* 消息列表 */}
          <div className="selectable" style={{ flex: 1, overflowY: 'auto', padding: '10px 0' }}>
            {messages.length === 0 && !isGenerating && (
              <div style={{
                display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center',
                height: '100%', color: 'var(--text-tertiary)', fontSize: 13, gap: 10,
              }}>
                <Bot size={36} style={{ color: 'var(--border-color)' }} />
                <span>你好，我是脑洞集AI助手</span>
                <span style={{ fontSize: 11 }}>有什么可以帮你的吗？</span>
              </div>
            )}
            {messages.map((msg, idx) => renderMessage(msg, idx))}

            {currentReasoningSteps.length > 0 && isGenerating && (
              <div style={{ margin: '4px 8px' }}>
                <ThinkingSection
                  steps={currentReasoningSteps}
                  isThinking={true}
                  variant="mini"
                />
              </div>
            )}

            {isGenerating && streamingText && typeof streamingText === 'string' && (() => {
              const { cleanContent, songs } = extractAndRemoveSongMarks(streamingText);
              return (
                <motion.div initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }}
                  style={{ display: 'flex', justifyContent: 'flex-start', marginBottom: 12, padding: '0 10px' }}>
                  <div style={{ width: 26, height: 26, borderRadius: '50%', background: 'var(--primary-bg)', display: 'flex', alignItems: 'center', justifyContent: 'center', marginRight: 6, flexShrink: 0, marginTop: 2 }}>
                    <Bot size={14} style={{ color: 'var(--primary-color)' }} />
                  </div>
                  <div style={{ maxWidth: '85%', padding: '8px 12px', borderRadius: '14px 14px 14px 4px', background: 'var(--bg-secondary)', color: 'var(--text-primary)', fontSize: 13, lineHeight: 1.7, wordBreak: 'break-word', boxShadow: 'var(--shadow-sm)' }}>
                    <div className="ai-markdown-body"><ReactMarkdown remarkPlugins={[remarkGfm]}>{cleanContent}</ReactMarkdown></div>
                    <span className="ai-cursor-blink" />
                  </div>
                </motion.div>
              );
            })()}

            {error && (
              <motion.div initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }}
                style={{ margin: '0 10px 12px', padding: '8px 12px', borderRadius: 6, background: 'rgba(255,77,79,0.1)', color: '#ff4d4f', fontSize: 12, border: '1px solid rgba(255,77,79,0.2)' }}>
                {error}
              </motion.div>
            )}
            <div ref={messagesEndRef} />
          </div>

          {/* 快捷指令 - 合并为一行可滚动标签 */}
          <div style={{ display: 'flex', gap: 3, padding: '6px 10px', borderTop: '1px solid var(--border-light)', flexShrink: 0, overflowX: 'auto', scrollbarWidth: 'none' }}>
            {[
              ...QUICK_COMMANDS.map((cmd) => ({ ...cmd, type: 'normal' as const })),
              ...MUSIC_QUICK_COMMANDS.map((cmd) => ({ ...cmd, type: 'music' as const })),
              ...AGENT_QUICK_COMMANDS.map((cmd) => ({ ...cmd, type: 'agent' as const })),
            ].map((cmd) => (
              <button key={cmd.label}
                onClick={() => handleQuickCommand(cmd.prompt, cmd.type === 'music', cmd.type === 'agent')}
                disabled={isGenerating || (cmd.type === 'agent' && agentIsRunning)}
                style={{
                  display: 'flex', alignItems: 'center', gap: 2, padding: '3px 7px',
                  border: cmd.type === 'agent' ? '1px solid var(--primary-color)' : '1px solid var(--border-light)',
                  borderRadius: 8,
                  background: cmd.type === 'agent' ? 'var(--primary-bg)' : cmd.type === 'music' ? 'rgba(139,92,246,0.06)' : 'var(--bg-secondary)',
                  color: cmd.type === 'agent' ? 'var(--primary-color)' : cmd.type === 'music' ? '#8b5cf6' : 'var(--text-secondary)',
                  fontSize: 10, cursor: isGenerating || (cmd.type === 'agent' && agentIsRunning) ? 'not-allowed' : 'pointer',
                  opacity: isGenerating || (cmd.type === 'agent' && agentIsRunning) ? 0.5 : 1,
                  transition: 'all 0.15s ease', whiteSpace: 'nowrap', flexShrink: 0,
                }}
                onMouseEnter={(e) => { if (!isGenerating && !(cmd.type === 'agent' && agentIsRunning)) { (e.currentTarget as HTMLElement).style.borderColor = 'var(--primary-color)'; (e.currentTarget as HTMLElement).style.color = 'var(--primary-color)'; } }}
                onMouseLeave={(e) => { (e.currentTarget as HTMLElement).style.borderColor = cmd.type === 'agent' ? 'var(--primary-color)' : 'var(--border-light)'; (e.currentTarget as HTMLElement).style.color = cmd.type === 'agent' ? 'var(--primary-color)' : cmd.type === 'music' ? '#8b5cf6' : 'var(--text-secondary)'; }}
              ><span style={{ fontSize: 11 }}>{cmd.icon}</span><span>{cmd.label}</span></button>
            ))}
          </div>

          {/* 输入区域 */}
          <div style={{ padding: '10px', borderTop: '1px solid var(--border-light)', flexShrink: 0 }}>
            {pendingImage && (
              <div style={{ padding: '0 8px 6px', display: 'flex', gap: 6, alignItems: 'center' }}>
                <img src={pendingImage} alt="待发送图片" style={{ width: 50, height: 50, borderRadius: 6, objectFit: 'cover' }} />
                <button onClick={() => setPendingImage(null)} style={{
                  background: 'var(--bg-tertiary)', border: 'none', cursor: 'pointer', color: 'var(--text-secondary)',
                  width: 20, height: 20, borderRadius: '50%', display: 'flex', alignItems: 'center', justifyContent: 'center',
                }}><X size={12} /></button>
              </div>
            )}
            <div style={{ display: 'flex', gap: 6, alignItems: 'flex-end' }}>
              <TextArea ref={inputRef} value={inputValue} onChange={(e) => setInputValue(e.target.value)}
                onKeyDown={handleKeyDown}
                placeholder={agentModeEnabled ? "Agent 指令..." : webSearchEnabled ? "消息 (联网搜索)..." : "消息 (Enter 发送)"}
                autoSize={{ minRows: 1, maxRows: 3 }} disabled={isGenerating}
                style={{ flex: 1, resize: 'none', background: 'var(--bg-secondary)', borderColor: 'var(--border-color)', color: 'var(--text-primary)', borderRadius: 10, padding: '6px 12px', fontSize: 13 }}
              />
              {isVoiceSupported && (
                <button onClick={toggleListening} title={isListening ? '停止语音输入' : '语音输入'}
                  style={{ width: 32, height: 32, borderRadius: 8, border: 'none', background: isListening ? '#ff4d4f' : 'var(--bg-secondary)', color: isListening ? '#fff' : 'var(--text-secondary)', cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
                  {isListening ? <MicOff size={14} /> : <Mic size={14} />}
                </button>
              )}
              <button onClick={() => imageInputRef.current?.click()} title="上传图片"
                style={{ width: 32, height: 32, borderRadius: 8, border: '1px solid var(--border-color)', background: 'var(--bg-secondary)', color: 'var(--text-secondary)', cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
                <ImagePlus size={14} />
              </button>
              <input ref={imageInputRef} type="file" accept="image/*" style={{ display: 'none' }} onChange={handleImageUpload} />
              {isGenerating || agentIsRunning ? (
                <button onClick={agentIsRunning ? cancelAgentTask : stopGeneration}
                  style={{ width: 32, height: 32, borderRadius: 8, border: '1px solid var(--border-color)', background: 'var(--bg-secondary)', color: 'var(--text-secondary)', cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
                  <Square size={14} />
                </button>
              ) : (
                <button onClick={handleSend} disabled={!inputValue.trim()}
                  style={{ width: 32, height: 32, borderRadius: 8, border: 'none', background: inputValue.trim() ? 'var(--primary-color)' : 'var(--bg-tertiary)', color: inputValue.trim() ? '#fff' : 'var(--text-tertiary)', cursor: inputValue.trim() ? 'pointer' : 'not-allowed', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
                  <Send size={14} />
                </button>
              )}
            </div>
          </div>

          {/* 缩放手柄 */}
          <div
            onMouseDown={handleResizeMouseDown}
            style={{
              position: 'absolute', right: 0, bottom: 0, width: 16, height: 16,
              cursor: 'se-resize', zIndex: 1,
            }}
          >
            <svg width="16" height="16" viewBox="0 0 16 16" style={{ opacity: 0.3 }}>
              <line x1="12" y1="4" x2="4" y2="12" stroke="var(--text-tertiary)" strokeWidth="1.5" />
              <line x1="14" y1="8" x2="8" y2="14" stroke="var(--text-tertiary)" strokeWidth="1.5" />
            </svg>
          </div>
        </motion.div>
      </AnimatePresence>
    </>,
    typeof document !== 'undefined' && document.body ? document.body : null
  );
};

export default AIChatMiniWindow;
