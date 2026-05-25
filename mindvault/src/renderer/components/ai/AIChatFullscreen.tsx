import React, { useState, useRef, useEffect, useCallback, useMemo } from 'react';
import { Select, Tooltip } from 'antd';
import { motion, AnimatePresence } from 'framer-motion';
import {
  Send, Square, X, Bot, Sparkles, Play, Plus, Globe, Trash2, Brain,
  Mic, MicOff, Volume2, VolumeX, Wrench, ImagePlus, Cpu, Eye,
  Minimize2, MessageSquare, GripHorizontal, Zap, Search, ChevronUp,
  ChevronDown, Share2, Copy, Download, Clock,
  Edit3, Pencil, Check, FileText, FileJson, File, Pin, MoreVertical, CheckSquare,
  PanelLeftClose, PanelLeftOpen, Circle, Archive, ArchiveRestore, BarChart3, Settings2,
  ThumbsUp, ThumbsDown, ClipboardList,
} from 'lucide-react';
import ReactMarkdown from 'react-markdown';
import remarkGfm from 'remark-gfm';
import html2canvas from 'html2canvas';
import { useAIStore, isMusicRelated } from '../../stores/aiStore';
import { useSettingsStore } from '../../stores/settingsStore';
import { useMusicStore } from '../../stores/musicStore';
import { useUIStore } from '../../stores/uiStore';
import { useVoiceInput } from '../../hooks/useVoiceInput';
import { useEdgeTTS } from '../../hooks/useEdgeTTS';
import ThinkingSection from './ThinkingSection';
import WorkflowEditor from './WorkflowEditor';
import AIUsageDashboard from './AIUsageDashboard';
import CreativityRefCard from './CreativityRefCard';
import SkillManager from './SkillManager';
import MCPManager from './MCPManager';
import aiAssistantIcon from '../../assets/ai-assistant-icon.svg';
import { api } from '../../utils/api';

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
  { label: '找歌', icon: '🎵', prompt: '我想听歌，请根据我本地音乐库中的歌曲，推荐一些适合当前心情的歌曲。', isMusic: true },
  { label: '听歌报告', icon: '📊', prompt: '请帮我分析我的听歌习惯和偏好，生成一份听歌总结报告。', isMusic: true },
  { label: '情绪分类', icon: '🎭', prompt: '请帮我分析本地音乐库中的歌曲，为每首歌进行情绪分类。', isMusic: true },
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

// ===== 辅助函数：日期格式化、消息内容提取、搜索高亮 =====

/** 格式化 token 数量 */
function formatTokenCount(count: number): string {
  if (count >= 1000000) return (count / 1000000).toFixed(1) + 'M';
  if (count >= 1000) return (count / 1000).toFixed(1) + 'K';
  return count.toString();
}

/** 格式化日期为分隔线文字 */
function formatDateLabel(timestamp: number): string {
  const now = new Date();
  const date = new Date(timestamp);
  const today = new Date(now.getFullYear(), now.getMonth(), now.getDate());
  const yesterday = new Date(today.getTime() - 86400000);
  const msgDay = new Date(date.getFullYear(), date.getMonth(), date.getDate());
  if (msgDay.getTime() === today.getTime()) return '今天';
  if (msgDay.getTime() === yesterday.getTime()) return '昨天';
  return `${date.getFullYear()}年${date.getMonth() + 1}月${date.getDate()}日`;
}

/** 格式化时间为 HH:MM */
function formatTime(timestamp: number): string {
  const d = new Date(timestamp);
  return `${String(d.getHours()).padStart(2, '0')}:${String(d.getMinutes()).padStart(2, '0')}`;
}

/** 安全提取消息文本内容 */
function extractTextContent(content: string | any): string {
  if (typeof content === 'string') return content;
  if (Array.isArray(content)) {
    return content
      .map((item: any) => {
        if (typeof item === 'string') return item;
        if (item.type === 'text') return item.text || '';
        return '';
      })
      .join('');
  }
  return String(content || '');
}

/** 将消息格式化为 Markdown */
function messageToMarkdown(msg: { role: string; content: string | any }, timestamp?: number): string {
  const text = extractTextContent(msg.content);
  const roleLabel = msg.role === 'user' ? '用户' : 'AI 助手';
  const timeStr = timestamp ? ` (${formatTime(timestamp)})` : '';
  return `**${roleLabel}${timeStr}:**\n\n${text}`;
}

/** 搜索高亮组件 */
const HighlightText: React.FC<{ text: string; keyword: string }> = ({ text, keyword }) => {
  if (!keyword.trim()) return <>{text}</>;
  const parts: React.ReactNode[] = [];
  const lowerText = text.toLowerCase();
  const lowerKeyword = keyword.toLowerCase();
  let lastIndex = 0;
  let idx = lowerText.indexOf(lowerKeyword, lastIndex);
  while (idx !== -1) {
    if (idx > lastIndex) parts.push(text.slice(lastIndex, idx));
    parts.push(
      <span key={idx} style={{ backgroundColor: 'rgba(250,204,21,0.35)', borderRadius: 2, padding: '0 1px' }}>
        {text.slice(idx, idx + keyword.length)}
      </span>
    );
    lastIndex = idx + keyword.length;
    idx = lowerText.indexOf(lowerKeyword, lastIndex);
  }
  if (lastIndex < text.length) parts.push(text.slice(lastIndex));
  return <>{parts}</>;
};

const DRAWER_HEIGHT_KEY = 'mindvault:aiDrawerHeight';
const MIN_DRAWER_HEIGHT = 300;

/** 获取用户首字母头像 */
function getUserAvatar(settings: any): string {
  const name = settings?.userName || settings?.nickname || '';
  if (name) return name.charAt(0).toUpperCase();
  return 'U';
}

/** 复制文本到剪贴板 */
async function copyTextToClipboard(text: string): Promise<boolean> {
  try {
    await navigator.clipboard.writeText(text);
    return true;
  } catch {
    try {
      const ta = document.createElement('textarea');
      ta.value = text;
      document.body.appendChild(ta);
      ta.select();
      document.execCommand('copy');
      document.body.removeChild(ta);
      return true;
    } catch {
      return false;
    }
  }
}

/** 截断长文本 */
function truncateText(text: string, maxLen: number = 300): string {
  if (text.length <= maxLen) return text;
  return text.slice(0, maxLen) + '...';
}

function getMaxDrawerHeight() {
  if (typeof window === 'undefined') return 800;
  return Math.max(MIN_DRAWER_HEIGHT, window.innerHeight - 120);
}

function getDefaultDrawerHeight() {
  if (typeof window === 'undefined') return 800;
  return Math.max(MIN_DRAWER_HEIGHT, window.innerHeight - 120);
}

const AIChatFullscreen: React.FC = () => {
  const aiPanelMode = useUIStore((s) => s.aiPanelMode);
  const openAiMini = useUIStore((s) => s.openAiMini);
  const closeAiPanel = useUIStore((s) => s.closeAiPanel);

  const {
    chatWindows, activeWindowId, messages, isGenerating, streamingText, error,
    webSearchEnabled, sendMessage, sendMusicMessage, stopGeneration,
    createWindow, switchWindow, closeWindow, toggleWebSearch, loadFromStorage,
    updateWindowTitle, pinWindow, archiveWindow,
    exportChatAsMarkdown, exportChatAsPDF,
  } = useAIStore();
  const settings = useSettingsStore((s) => s.settings);
  const saveSettings = useSettingsStore((s) => s.saveSettings);
  const loadTrack = useMusicStore((s) => s.loadTrack);
  const tracks = useMusicStore((s) => s.tracks);
  const [inputValue, setInputValue] = useState('');
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const hasLoadedRef = useRef(false); // 防止重复加载
  const inputRef = useRef<any>(null);
  const imageInputRef = useRef<HTMLInputElement>(null);
  const messagesContainerRef = useRef<HTMLDivElement>(null);
  const nodeAxisRef = useRef<HTMLDivElement>(null);
  const [pendingImage, setPendingImage] = useState<string | null>(null);
  // 历史消息懒加载：初始只显示最近 N 条，往上滚动时加载更多
  const INITIAL_VISIBLE_MESSAGES = 30;
  const LOAD_MORE_COUNT = 20;
  const [visibleCount, setVisibleCount] = useState(INITIAL_VISIBLE_MESSAGES);
  const [activeTab, setActiveTab] = useState('chat');

  // ===== 搜索功能 state =====
  const [searchVisible, setSearchVisible] = useState(false);
  const [searchKeyword, setSearchKeyword] = useState('');
  const [currentMatchIndex, setCurrentMatchIndex] = useState(0);
  const messageRefs = useRef<Map<number, HTMLDivElement>>(new Map());

  // ===== 分享功能 state =====
  const [shareMenuIndex, setShareMenuIndex] = useState<number | null>(null);

  // ===== 多选模式 state =====
  const [multiSelectMode, setMultiSelectMode] = useState(false);
  const [selectedMessageIndices, setSelectedMessageIndices] = useState<Set<number>>(new Set());
  const [multiShareMenuVisible, setMultiShareMenuVisible] = useState(false);

  // ===== 跨对话窗口选择 state =====
  // selectedMessages: Map<windowsId, Set<messageIndex>>
  const [selectedMessages, setSelectedMessages] = useState<Map<string, Set<number>>>(new Map());
  const [crossWindowShareMenuVisible, setCrossWindowShareMenuVisible] = useState(false);

  // ===== 消息编辑/删除 state =====
  const [editingMessageIndex, setEditingMessageIndex] = useState<number | null>(null);
  const [editingContent, setEditingContent] = useState('');
  const [deleteConfirmIndex, setDeleteConfirmIndex] = useState<number | null>(null);

  // ===== 窗口管理 state =====
  const [windowManageMenuVisible, setWindowManageMenuVisible] = useState(false);
  const [renameWindowId, setRenameWindowId] = useState<string | null>(null);
  const [renameInput, setRenameInput] = useState('');

  // ===== 左侧面板折叠 state =====
  const [sidebarCollapsed, setSidebarCollapsed] = useState(false);
  const [sidebarSearchVisible, setSidebarSearchVisible] = useState(false);
  const [sidebarSearchQuery, setSidebarSearchQuery] = useState('');
  const [sidebarContextMenu, setSidebarContextMenu] = useState<{ windowId: string; x: number; y: number } | null>(null);

  // ===== 节点轴悬停 state =====
  const [hoveredNodeIndex, setHoveredNodeIndex] = useState<number | null>(null);

  const [showWorkflowEditor, setShowWorkflowEditor] = useState(false);
  const [showUsageDashboard, setShowUsageDashboard] = useState(false);
  const [showExportMenu, setShowExportMenu] = useState(false);
  const [realtimeStats, setRealtimeStats] = useState<any>(null);
  const [showTemplateLibrary, setShowTemplateLibrary] = useState(false);
  const [expandedToolCalls, setExpandedToolCalls] = useState<Set<string>>(new Set());
  const [copiedMessageIndex, setCopiedMessageIndex] = useState<number | null>(null);
  const [messageFeedback, setMessageFeedback] = useState<Map<number, 'up' | 'down'>>(new Map());

  // ===== 时间轴：为消息生成模拟时间戳 =====
  const messageTimestamps = useMemo(() => {
    const currentWindow = chatWindows.find(w => w.id === activeWindowId);
    const createdAt = currentWindow?.createdAt || Date.now();
    return messages.map((_, idx) => {
      // 基于窗口创建时间 + 每条消息间隔 1~3 分钟模拟时间戳
      return createdAt + idx * (60000 + Math.floor(Math.random() * 120000));
    });
  }, [messages, chatWindows, activeWindowId]);

  // ===== 节点轴：将消息按「用户提问 + AI 回复」配对分组 =====
  const chatNodes = useMemo(() => {
    const nodes: Array<{
      nodeIndex: number;
      userMsgIndex: number | null;
      aiMsgIndex: number | null;
      userPreview: string;
      aiPreview: string;
      timestamp: number;
    }> = [];
    let i = 0;
    let nodeIdx = 0;
    while (i < messages.length) {
      const msg = messages[i];
      if (msg.role === 'user') {
        const userMsgIndex = i;
        const userText = extractTextContent(msg.content);
        let aiMsgIndex: number | null = null;
        let aiText = '';
        // 查看下一条是否是 AI 回复
        if (i + 1 < messages.length && messages[i + 1].role === 'assistant') {
          aiMsgIndex = i + 1;
          aiText = extractTextContent(messages[i + 1].content);
          i += 2;
        } else {
          i += 1;
        }
        nodes.push({
          nodeIndex: nodeIdx++,
          userMsgIndex,
          aiMsgIndex,
          userPreview: userText.slice(0, 60) + (userText.length > 60 ? '...' : ''),
          aiPreview: aiText.slice(0, 80) + (aiText.length > 80 ? '...' : ''),
          timestamp: messageTimestamps[userMsgIndex] || Date.now(),
        });
      } else {
        // 独立的 AI 消息（无对应用户消息），也作为一个节点
        const aiText = extractTextContent(msg.content);
        nodes.push({
          nodeIndex: nodeIdx++,
          userMsgIndex: null,
          aiMsgIndex: i,
          userPreview: '',
          aiPreview: aiText.slice(0, 80) + (aiText.length > 80 ? '...' : ''),
          timestamp: messageTimestamps[i] || Date.now(),
        });
        i += 1;
      }
    }
    return nodes;
  }, [messages, messageTimestamps]);

  // 为每条消息找到它所属的节点索引
  const messageToNodeMap = useMemo(() => {
    const map = new Map<number, number>();
    chatNodes.forEach(node => {
      if (node.userMsgIndex !== null) map.set(node.userMsgIndex, node.nodeIndex);
      if (node.aiMsgIndex !== null) map.set(node.aiMsgIndex, node.nodeIndex);
    });
    return map;
  }, [chatNodes]);

  const { isListening, isSupported: isVoiceSupported, toggleListening } = useVoiceInput({
    onResult: (text) => setInputValue(text),
  });
  // 从设置读取 TTS 参数
  const ttsVoice = useSettingsStore((s) => s.settings.ttsVoice);
  const ttsRate = useSettingsStore((s) => s.settings.ttsRate);
  const ttsPitch = useSettingsStore((s) => s.settings.ttsPitch);
  const ttsVolume = useSettingsStore((s) => s.settings.ttsVolume);
  const { isSpeaking, toggle: toggleTTS } = useEdgeTTS({
    voice: ttsVoice,
    rate: ttsRate,
    pitch: ttsPitch,
    volume: ttsVolume,
  });
  const isTTSSupported = true; // Edge TTS 始终可用

  // 记忆系统已替换为规则系统，移除记忆相关变量
  // const memoryEnabled = useAIStore((s) => s.memoryEnabled);
  const toolCallsEnabled = useAIStore((s) => s.toolCallsEnabled);
  const activeToolCalls = useAIStore((s) => s.activeToolCalls);
  const completedToolCalls = useAIStore((s) => s.completedToolCalls);
  // const setMemoryEnabled = useAIStore((s) => s.setMemoryEnabled);
  const setToolCallsEnabled = useAIStore((s) => s.setToolCallsEnabled);
  const agentModeEnabled = useAIStore((s) => s.agentModeEnabled);
  const agentIsRunning = useAIStore((s) => s.agentIsRunning);
  const agentStatus = useAIStore((s) => s.agentStatus);
  const agentThinking = useAIStore((s) => s.agentThinking);
  const agentSummary = useAIStore((s) => s.agentSummary);
  const setAgentModeEnabled = useAIStore((s) => s.setAgentModeEnabled);
  const followMode = useAIStore((s) => s.followMode);
  const setFollowMode = useAIStore((s) => s.setFollowMode);
  const executeAgentTask = useAIStore((s) => s.executeAgentTask);
  const cancelAgentTask = useAIStore((s) => s.cancelAgentTask);
  const toggleMessageReasoning = useAIStore((s) => s.toggleMessageReasoning);
  const currentReasoningSteps = useAIStore((s) => s.currentReasoningSteps);
  const isReasoning = useAIStore((s) => s.isReasoning);
  // 记忆系统已替换为规则系统
  // const memories = useAIStore((s) => s.memories);
  // const memoryStats = useAIStore((s) => s.memoryStats);
  // const loadMemories = useAIStore((s) => s.loadMemories);
  // const deleteMemory = useAIStore((s) => s.deleteMemory);
  const mcpServers = useAIStore((s) => s.mcpServers);
  const mcpTools = useAIStore((s) => s.mcpTools);
  const loadMcpStatus = useAIStore((s) => s.loadMcpStatus);

  // ===== 节点点击跳转处理 =====
  const handleNodeClick = useCallback((node: typeof chatNodes[0]) => {
    const targetIdx = node.userMsgIndex ?? node.aiMsgIndex;
    if (targetIdx === null) return;
    
    // 获取对应的消息元素并滚动到视图
    const el = messageRefs.current.get(targetIdx);
    if (el) {
      el.scrollIntoView({ behavior: 'smooth', block: 'center' });
    }
  }, []);

  const currentProvider = settings.aiDefaultProvider;
  const currentModel = settings.aiDefaultModel;

  const [drawerHeight, setDrawerHeight] = useState(() => {
    try {
      const stored = localStorage.getItem(DRAWER_HEIGHT_KEY);
      if (stored) {
        const parsed = parseInt(stored, 10);
        const maxH = getMaxDrawerHeight();
        return Math.max(MIN_DRAWER_HEIGHT, Math.min(parsed, maxH));
      }
    } catch { /* ignore */ }
    return getDefaultDrawerHeight();
  });

  const isResizingRef = useRef(false);
  const resizeStartRef = useRef({ y: 0, h: 0 });

  const handleResizeStart = useCallback((e: React.MouseEvent) => {
    e.preventDefault();
    isResizingRef.current = true;
    resizeStartRef.current = { y: e.clientY, h: drawerHeight };
    document.body.style.cursor = 'ns-resize';
    document.body.style.userSelect = 'none';
  }, [drawerHeight]);

  useEffect(() => {
    const handleMouseMove = (e: MouseEvent) => {
      if (!isResizingRef.current) return;
      const delta = resizeStartRef.current.y - e.clientY;
      const newH = Math.max(MIN_DRAWER_HEIGHT, Math.min(getMaxDrawerHeight(), resizeStartRef.current.h + delta));
      setDrawerHeight(newH);
    };
    const handleMouseUp = () => {
      if (!isResizingRef.current) return;
      isResizingRef.current = false;
      document.body.style.cursor = '';
      document.body.style.userSelect = '';
      try { localStorage.setItem(DRAWER_HEIGHT_KEY, String(drawerHeight)); } catch { /* ignore */ }
    };
    window.addEventListener('mousemove', handleMouseMove);
    window.addEventListener('mouseup', handleMouseUp);
    return () => {
      window.removeEventListener('mousemove', handleMouseMove);
      window.removeEventListener('mouseup', handleMouseUp);
    };
  }, [drawerHeight]);

  // 窗口大小变化时，确保抽屉不超出可视区域
  useEffect(() => {
    const handleResize = () => {
      const maxH = getMaxDrawerHeight();
      setDrawerHeight((prev) => Math.min(prev, maxH));
    };
    window.addEventListener('resize', handleResize);
    return () => window.removeEventListener('resize', handleResize);
  }, []);

  const getModelOptions = useCallback(() => {
    const models: Record<string, string[]> = {
      openai: ['gpt-5.5', 'gpt-5.5-pro', 'gpt-5.5-instant', 'gpt-5', 'o3', 'o3-mini', 'o4-mini'],
      anthropic: ['claude-opus-4-7', 'claude-sonnet-4-6', 'claude-haiku-4'],
      deepseek: ['deepseek-v4-pro', 'deepseek-v4-flash', 'deepseek-v4', 'deepseek-chat', 'deepseek-reasoner'],
      custom: [],
    };
    return (models[currentProvider] || []).map((m) => ({ label: m, value: m }));
  }, [currentProvider]);

  const scrollToBottom = useCallback(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, []);

  const parseSongMentions = useCallback((content: string) => {
    const songs: Array<{ title: string; artist: string }> = [];
    const regex = /【歌曲:([^】]+)】/g;
    let match;
    while ((match = regex.exec(content)) !== null) {
      const parts = match[1].split('-');
      if (parts.length >= 2) songs.push({ title: parts[0].trim(), artist: parts.slice(1).join('-').trim() });
      else songs.push({ title: match[1].trim(), artist: '' });
    }
    return songs;
  }, []);

  const handlePlayRecommendedSong = useCallback((title: string, artist: string) => {
    const idx = tracks.findIndex(t => t.title.toLowerCase().includes(title.toLowerCase()) && (!artist || t.artist.toLowerCase().includes(artist.toLowerCase())));
    if (idx >= 0) loadTrack(idx, true);
  }, [tracks, loadTrack]);

  const extractAndRemoveSongMarks = useCallback((content: string) => {
    const songs = parseSongMentions(content);
    return { cleanContent: content.replace(/【歌曲:([^】]+)】/g, '$1'), songs };
  }, [parseSongMentions]);

  const handleImageUpload = useCallback((e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file || file.size > 10 * 1024 * 1024) return;
    const reader = new FileReader();
    reader.onload = () => setPendingImage(reader.result as string);
    reader.readAsDataURL(file);
    e.target.value = '';
  }, []);

  // 加载今日实时用量统计
  useEffect(() => {
    const loadStats = async () => {
      try {
        const result = await api.ai.getRealtimeStats();
        if (result?.success) setRealtimeStats(result.data);
      } catch {}
    };
    loadStats();
    const interval = setInterval(loadStats, 30000);
    return () => clearInterval(interval);
  }, []);

  useEffect(() => {
    if (aiPanelMode === 'fullscreen' && !hasLoadedRef.current) {
      hasLoadedRef.current = true;
      loadFromStorage(); 
      // loadMemories(); // 记忆系统已移除
      loadMcpStatus(); 
    }
    if (aiPanelMode !== 'fullscreen') {
      hasLoadedRef.current = false;
    }
  }, [aiPanelMode, loadFromStorage, loadMcpStatus]);
  useEffect(() => { scrollToBottom(); }, [messages, streamingText, scrollToBottom]);
  // 切换窗口时重置可见消息数
  useEffect(() => { setVisibleCount(INITIAL_VISIBLE_MESSAGES); }, [activeWindowId]);
  useEffect(() => { if (aiPanelMode === 'fullscreen') setTimeout(() => inputRef.current?.focus(), 300); }, [aiPanelMode]);

  const handleSend = useCallback(async () => {
    const text = inputValue.trim();
    if ((!text && !pendingImage) || isGenerating || agentIsRunning) return;

    // 如果有待发送的图片，构建多模态消息内容
    if (pendingImage) {
      const multimodalContent: Array<{ type: 'image_url' | 'text'; image_url?: { url: string }; text?: string }> = [];
      multimodalContent.push({ type: 'image_url', image_url: { url: pendingImage } });
      if (text) {
        multimodalContent.push({ type: 'text', text });
      } else {
        multimodalContent.push({ type: 'text', text: '请描述这张图片' });
      }
      setPendingImage(null);
      setInputValue('');
      if (agentModeEnabled) { await executeAgentTask(multimodalContent); return; }
      await sendMessage(multimodalContent);
      return;
    }

    const content = text;
    setInputValue('');
    if (agentModeEnabled) { await executeAgentTask(content); return; }
    if (isMusicRelated(content)) await sendMusicMessage(content);
    else await sendMessage(content);
  }, [inputValue, isGenerating, agentIsRunning, agentModeEnabled, pendingImage, sendMessage, sendMusicMessage, executeAgentTask]);

  const handleKeyDown = useCallback((e: React.KeyboardEvent) => {
    const isMac = navigator.platform.toUpperCase().indexOf('MAC') >= 0;
    const cmdKey = isMac ? e.metaKey : e.ctrlKey;
    
    // Ctrl/Cmd + Enter：换行（默认行为，不做处理）
    // Enter：发送消息
    if (e.key === 'Enter' && !e.shiftKey && !cmdKey) {
      e.preventDefault();
      handleSend();
    }
    // Ctrl/Cmd + Enter：在 TextArea 中插入换行（默认行为）
  }, [handleSend]);

  // ===== 消息复制 =====
  const handleCopyMessage = useCallback(async (content: string, index: number) => {
    const text = extractTextContent(content);
    const success = await copyTextToClipboard(text);
    if (success) {
      setCopiedMessageIndex(index);
      setTimeout(() => setCopiedMessageIndex(null), 2000);
    }
  }, []);

  // ===== 消息反馈 =====
  const handleMessageFeedback = useCallback((index: number, type: 'up' | 'down') => {
    setMessageFeedback(prev => {
      const newMap = new Map(prev);
      if (newMap.get(index) === type) {
        newMap.delete(index);
      } else {
        newMap.set(index, type);
      }
      return newMap;
    });
  }, []);

  // ===== 工具调用展开/折叠 =====
  const toggleToolCallExpand = useCallback((id: string) => {
    setExpandedToolCalls(prev => {
      const newSet = new Set(prev);
      if (newSet.has(id)) newSet.delete(id);
      else newSet.add(id);
      return newSet;
    });
  }, []);

  const handleQuickCommand = useCallback((prompt: string, isMusic?: boolean, isAgent?: boolean) => {
    if (isGenerating || agentIsRunning) return;
    setInputValue('');
    if (isAgent || agentModeEnabled) executeAgentTask(prompt);
    else if (isMusic) sendMusicMessage(prompt);
    else sendMessage(prompt);
  }, [isGenerating, agentIsRunning, agentModeEnabled, sendMessage, sendMusicMessage, executeAgentTask]);

  // ===== 搜索功能 =====
  const searchMatches = useMemo(() => {
    if (!searchKeyword.trim()) return [] as number[];
    const kw = searchKeyword.toLowerCase();
    return messages.reduce((acc: number[], msg, idx) => {
      if (extractTextContent(msg.content).toLowerCase().includes(kw)) acc.push(idx);
      return acc;
    }, []);
  }, [messages, searchKeyword]);

  const handleSearchKeyDown = useCallback((e: React.KeyboardEvent) => {
    if (e.key === 'Escape') {
      setSearchKeyword('');
      setCurrentMatchIndex(0);
      setSearchVisible(false);
      return;
    }
    if (searchMatches.length === 0) return;
    if (e.key === 'ArrowDown' || (e.key === 'Enter' && !e.shiftKey)) {
      e.preventDefault();
      setCurrentMatchIndex(prev => (prev + 1) % searchMatches.length);
    } else if (e.key === 'ArrowUp') {
      e.preventDefault();
      setCurrentMatchIndex(prev => (prev - 1 + searchMatches.length) % searchMatches.length);
    }
  }, [searchMatches.length]);

  // 跳转到当前匹配项
  useEffect(() => {
    if (searchMatches.length > 0) {
      const targetIdx = searchMatches[currentMatchIndex];
      const el = messageRefs.current.get(targetIdx);
      if (el) {
        el.scrollIntoView({ behavior: 'smooth', block: 'center' });
      }
    }
  }, [currentMatchIndex, searchMatches]);

  // ===== 分享功能 =====
  const handleCopyMarkdown = useCallback(async (msg: { role: string; content: string | any }, index: number) => {
    const timestamp = messageTimestamps[index];
    const md = messageToMarkdown(msg, timestamp);
    try {
      await navigator.clipboard.writeText(md);
    } catch {
      // fallback
      const ta = document.createElement('textarea');
      ta.value = md;
      document.body.appendChild(ta);
      ta.select();
      document.execCommand('copy');
      document.body.removeChild(ta);
    }
    setShareMenuIndex(null);
  }, [messageTimestamps]);

  const handleExportImage = useCallback(async (msgIndex: number) => {
    const el = messageRefs.current.get(msgIndex);
    if (!el) return;
    setShareMenuIndex(null);
    try {
      const canvas = await html2canvas(el, {
        backgroundColor: getComputedStyle(document.documentElement).getPropertyValue('--bg-primary').trim() || '#ffffff',
        scale: 2,
        useCORS: true,
      });
      const link = document.createElement('a');
      link.download = `ai-chat-${msgIndex}-${Date.now()}.png`;
      link.href = canvas.toDataURL('image/png');
      link.click();
    } catch (err) {
      console.error('导出图片失败:', err);
    }
  }, []);

  // 点击空白处关闭分享菜单
  useEffect(() => {
    const handler = () => setShareMenuIndex(null);
    if (shareMenuIndex !== null) {
      setTimeout(() => document.addEventListener('click', handler), 0);
      return () => document.removeEventListener('click', handler);
    }
  }, [shareMenuIndex]);

  // ===== 消息编辑/删除功能 =====
  const handleStartEditMessage = useCallback((index: number) => {
    const msg = messages[index];
    if (!msg || msg.role !== 'user') return;
    setEditingMessageIndex(index);
    setEditingContent(extractTextContent(msg.content));
  }, [messages]);

  const handleSaveEditMessage = useCallback(() => {
    if (editingMessageIndex === null || !editingContent.trim()) return;
    // 由于 aiStore 没有提供编辑消息的 API，这里需要直接操作
    // 我们可以通过重新发送消息来模拟编辑效果
    // 实际实现需要扩展 aiStore
    setEditingMessageIndex(null);
    setEditingContent('');
  }, [editingMessageIndex, editingContent]);

  const handleCancelEdit = useCallback(() => {
    setEditingMessageIndex(null);
    setEditingContent('');
  }, []);

  const handleDeleteMessage = useCallback((index: number) => {
    // 由于 aiStore 没有提供删除单条消息的 API，这里需要扩展
    // 暂时使用确认对话框
    setDeleteConfirmIndex(index);
  }, []);

  const confirmDeleteMessage = useCallback(() => {
    if (deleteConfirmIndex === null) return;
    // 实际删除逻辑需要扩展 aiStore
    setDeleteConfirmIndex(null);
  }, [deleteConfirmIndex]);

  // ===== 多选模式功能 =====
  const toggleMessageSelection = useCallback((index: number) => {
    setSelectedMessageIndices(prev => {
      const newSet = new Set(prev);
      if (newSet.has(index)) {
        newSet.delete(index);
      } else {
        newSet.add(index);
      }
      return newSet;
    });
  }, []);

  const selectAllMessages = useCallback(() => {
    setSelectedMessageIndices(new Set(messages.map((_, idx) => idx)));
  }, [messages]);

  const clearSelection = useCallback(() => {
    setSelectedMessageIndices(new Set());
  }, []);

  const exitMultiSelectMode = useCallback(() => {
    setMultiSelectMode(false);
    setSelectedMessageIndices(new Set());
    setMultiShareMenuVisible(false);
    setSelectedMessages(new Map());
    setCrossWindowShareMenuVisible(false);
  }, []);

  // ===== 跨对话窗口选择功能 =====
  const toggleCrossWindowMessageSelection = useCallback((windowId: string, messageIndex: number) => {
    setSelectedMessages(prev => {
      const newMap = new Map(prev);
      const windowSet = newMap.get(windowId) || new Set();
      if (windowSet.has(messageIndex)) {
        windowSet.delete(messageIndex);
      } else {
        windowSet.add(messageIndex);
      }
      if (windowSet.size === 0) {
        newMap.delete(windowId);
      } else {
        newMap.set(windowId, windowSet);
      }
      return newMap;
    });
  }, []);

  const selectAllInWindow = useCallback((windowId: string) => {
    const win = chatWindows.find(w => w.id === windowId);
    if (!win) return;
    setSelectedMessages(prev => {
      const newMap = new Map(prev);
      newMap.set(windowId, new Set(win.messages.map((_, idx) => idx)));
      return newMap;
    });
  }, [chatWindows]);

  const clearWindowSelection = useCallback((windowId: string) => {
    setSelectedMessages(prev => {
      const newMap = new Map(prev);
      newMap.delete(windowId);
      return newMap;
    });
  }, []);

  const clearAllSelections = useCallback(() => {
    setSelectedMessages(new Map());
  }, []);

  // 计算所有选中的消息总数
  const totalSelectedCount = useMemo(() => {
    let count = 0;
    selectedMessages.forEach(set => count += set.size);
    return count;
  }, [selectedMessages]);

  // 跨窗口分享：复制为 Markdown
  const handleCrossWindowCopyMarkdown = useCallback(async () => {
    const markdownParts: string[] = [];
    
    // 按窗口顺序处理
    chatWindows.forEach(win => {
      const selectedIndices = selectedMessages.get(win.id);
      if (!selectedIndices || selectedIndices.size === 0) return;
      
      const sortedIndices = Array.from(selectedIndices).sort((a, b) => a - b);
      const windowParts = sortedIndices.map(idx => {
        const msg = win.messages[idx];
        if (!msg) return '';
        // 使用窗口创建时间 + 消息索引模拟时间戳
        const timestamp = win.createdAt + idx * 60000;
        return messageToMarkdown(msg, timestamp);
      }).filter(Boolean);
      
      if (windowParts.length > 0) {
        markdownParts.push(`## ${win.title}\n\n${windowParts.join('\n\n---\n\n')}`);
      }
    });
    
    const fullMarkdown = markdownParts.join('\n\n---\n\n---\n\n');
    try {
      await navigator.clipboard.writeText(fullMarkdown);
    } catch {
      const ta = document.createElement('textarea');
      ta.value = fullMarkdown;
      document.body.appendChild(ta);
      ta.select();
      document.execCommand('copy');
      document.body.removeChild(ta);
    }
    setCrossWindowShareMenuVisible(false);
  }, [selectedMessages, chatWindows]);

  // 跨窗口分享：导出为图片
  const handleCrossWindowExportImage = useCallback(async () => {
    const container = document.createElement('div');
    container.style.cssText = 'position: absolute; left: -9999px; top: 0; padding: 20px; background: var(--bg-primary); max-width: 800px;';
    document.body.appendChild(container);

    chatWindows.forEach(win => {
      const selectedIndices = selectedMessages.get(win.id);
      if (!selectedIndices || selectedIndices.size === 0) return;
      
      // 添加窗口标题
      const titleEl = document.createElement('div');
      titleEl.style.cssText = 'font-size: 16px; font-weight: 600; color: var(--text-primary); margin-bottom: 12px; padding-bottom: 8px; border-bottom: 1px solid var(--border-light);';
      titleEl.textContent = win.title;
      container.appendChild(titleEl);
      
      const sortedIndices = Array.from(selectedIndices).sort((a, b) => a - b);
      sortedIndices.forEach(idx => {
        const msg = win.messages[idx];
        if (!msg) return;
        
        const msgEl = document.createElement('div');
        msgEl.style.cssText = 'padding: 10px 14px; margin-bottom: 10px; border-radius: 8px; background: var(--bg-secondary);';
        
        const roleEl = document.createElement('div');
        roleEl.style.cssText = 'font-size: 12px; color: var(--text-tertiary); margin-bottom: 4px;';
        roleEl.textContent = msg.role === 'user' ? '👤 用户' : '🤖 AI';
        msgEl.appendChild(roleEl);
        
        const contentEl = document.createElement('div');
        contentEl.style.cssText = 'font-size: 14px; color: var(--text-primary); line-height: 1.6;';
        contentEl.textContent = extractTextContent(msg.content);
        msgEl.appendChild(contentEl);
        
        container.appendChild(msgEl);
      });
      
      // 添加分隔线
      const divider = document.createElement('div');
      divider.style.cssText = 'height: 1px; background: var(--border-light); margin: 16px 0;';
      container.appendChild(divider);
    });

    try {
      const canvas = await html2canvas(container, {
        backgroundColor: getComputedStyle(document.documentElement).getPropertyValue('--bg-primary').trim() || '#ffffff',
        scale: 2,
        useCORS: true,
      });
      const link = document.createElement('a');
      link.download = `ai-chat-multi-window-${Date.now()}.png`;
      link.href = canvas.toDataURL('image/png');
      link.click();
    } catch (err) {
      console.error('导出图片失败:', err);
    } finally {
      document.body.removeChild(container);
    }
    setCrossWindowShareMenuVisible(false);
  }, [selectedMessages, chatWindows]);

  // 多选分享：复制为 Markdown
  const handleMultiCopyMarkdown = useCallback(async () => {
    const sortedIndices = Array.from(selectedMessageIndices).sort((a, b) => a - b);
    const markdownParts = sortedIndices.map(idx => {
      const msg = messages[idx];
      const timestamp = messageTimestamps[idx];
      return messageToMarkdown(msg, timestamp);
    });
    const fullMarkdown = markdownParts.join('\n\n---\n\n');
    try {
      await navigator.clipboard.writeText(fullMarkdown);
    } catch {
      const ta = document.createElement('textarea');
      ta.value = fullMarkdown;
      document.body.appendChild(ta);
      ta.select();
      document.execCommand('copy');
      document.body.removeChild(ta);
    }
    setMultiShareMenuVisible(false);
  }, [selectedMessageIndices, messages, messageTimestamps]);

  // 多选分享：导出为图片
  const handleMultiExportImage = useCallback(async () => {
    // 创建一个临时容器来渲染选中的消息
    const container = document.createElement('div');
    container.style.cssText = 'position: absolute; left: -9999px; top: 0; padding: 20px; background: var(--bg-primary); max-width: 800px;';
    document.body.appendChild(container);

    const sortedIndices = Array.from(selectedMessageIndices).sort((a, b) => a - b);
    sortedIndices.forEach(idx => {
      const el = messageRefs.current.get(idx);
      if (el) {
        const clone = el.cloneNode(true) as HTMLElement;
        clone.style.marginBottom = '14px';
        container.appendChild(clone);
      }
    });

    try {
      const canvas = await html2canvas(container, {
        backgroundColor: getComputedStyle(document.documentElement).getPropertyValue('--bg-primary').trim() || '#ffffff',
        scale: 2,
        useCORS: true,
      });
      const link = document.createElement('a');
      link.download = `ai-chat-multi-${Date.now()}.png`;
      link.href = canvas.toDataURL('image/png');
      link.click();
    } catch (err) {
      console.error('导出图片失败:', err);
    } finally {
      document.body.removeChild(container);
    }
    setMultiShareMenuVisible(false);
  }, [selectedMessageIndices]);

  // ===== 窗口管理功能 =====
  const handleRenameWindow = useCallback((windowId: string) => {
    const win = chatWindows.find(w => w.id === windowId);
    if (!win) return;
    setRenameWindowId(windowId);
    setRenameInput(win.title);
    setWindowManageMenuVisible(false);
  }, [chatWindows]);

  const handleSaveRename = useCallback(() => {
    if (!renameWindowId || !renameInput.trim()) return;
    updateWindowTitle(renameWindowId, renameInput.trim());
    setRenameWindowId(null);
    setRenameInput('');
  }, [renameWindowId, renameInput, updateWindowTitle]);

  const handleDeleteWindow = useCallback((windowId: string) => {
    if (chatWindows.length <= 1) return; // 至少保留一个窗口
    closeWindow(windowId);
    setWindowManageMenuVisible(false);
  }, [chatWindows, closeWindow]);

  const handlePinWindow = useCallback((_windowId: string) => {
    // 置顶功能需要在 aiStore 中扩展，这里暂时只显示提示
    setWindowManageMenuVisible(false);
  }, []);

  // ===== 导出整个对话 =====
  const handleExportMarkdown = useCallback(() => {
    const markdownParts = messages.map((msg, idx) => {
      const timestamp = messageTimestamps[idx];
      return messageToMarkdown(msg, timestamp);
    });
    const currentWindow = chatWindows.find(w => w.id === activeWindowId);
    const title = currentWindow?.title || 'AI对话';
    const fullMarkdown = `# ${title}\n\n导出时间: ${new Date().toLocaleString()}\n\n---\n\n${markdownParts.join('\n\n---\n\n')}`;
    
    const blob = new Blob([fullMarkdown], { type: 'text/markdown;charset=utf-8' });
    const link = document.createElement('a');
    link.download = `${title}-${Date.now()}.md`;
    link.href = URL.createObjectURL(blob);
    link.click();
    URL.revokeObjectURL(link.href);
    setWindowManageMenuVisible(false);
  }, [messages, messageTimestamps, chatWindows, activeWindowId]);

  const handleExportJSON = useCallback(() => {
    const currentWindow = chatWindows.find(w => w.id === activeWindowId);
    const exportData = {
      title: currentWindow?.title || 'AI对话',
      exportedAt: new Date().toISOString(),
      windowId: activeWindowId,
      messages: messages.map((msg, idx) => ({
        ...msg,
        timestamp: messageTimestamps[idx],
      })),
    };
    const jsonStr = JSON.stringify(exportData, null, 2);
    const blob = new Blob([jsonStr], { type: 'application/json;charset=utf-8' });
    const link = document.createElement('a');
    link.download = `${currentWindow?.title || 'AI对话'}-${Date.now()}.json`;
    link.href = URL.createObjectURL(blob);
    link.click();
    URL.revokeObjectURL(link.href);
    setWindowManageMenuVisible(false);
  }, [messages, messageTimestamps, chatWindows, activeWindowId]);

  const handleExportPDF = useCallback(async () => {
    // 使用 html2canvas 将消息列表渲染为图片，然后生成 PDF
    const messagesContainer = document.querySelector('.selectable') as HTMLElement;
    if (!messagesContainer) return;
    
    try {
      const canvas = await html2canvas(messagesContainer, {
        backgroundColor: getComputedStyle(document.documentElement).getPropertyValue('--bg-primary').trim() || '#ffffff',
        scale: 2,
        useCORS: true,
      });
      
      // 创建一个简单的 HTML 页面包含图片
      const imgData = canvas.toDataURL('image/png');
      const currentWindow = chatWindows.find(w => w.id === activeWindowId);
      const title = currentWindow?.title || 'AI对话';
      
      // 使用 window.print() 或创建简单的 PDF
      const printWindow = window.open('', '_blank');
      if (printWindow) {
        printWindow.document.write(`
          <!DOCTYPE html>
          <html>
          <head><title>${title}</title></head>
          <body style="margin:0;padding:20px;">
            <h1 style="font-family:sans-serif;">${title}</h1>
            <p style="font-family:sans-serif;color:#666;">导出时间: ${new Date().toLocaleString()}</p>
            <img src="${imgData}" style="max-width:100%;" />
          </body>
          </html>
        `);
        printWindow.document.close();
        printWindow.print();
      }
    } catch (err) {
      console.error('导出 PDF 失败:', err);
    }
    setWindowManageMenuVisible(false);
  }, [chatWindows, activeWindowId]);

  // ===== 快捷键支持 =====
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      const isMac = navigator.platform.toUpperCase().indexOf('MAC') >= 0;
      const cmdKey = isMac ? e.metaKey : e.ctrlKey;

      // Ctrl/Cmd + F：打开搜索
      if (cmdKey && e.key === 'f') {
        e.preventDefault();
        setSearchVisible(true);
      }
      
      // Ctrl/Cmd + N：新建对话
      if (cmdKey && e.key === 'n' && !e.shiftKey) {
        e.preventDefault();
        createWindow();
      }
      
      // Ctrl/Cmd + Shift + N：新建对话窗口
      if (cmdKey && e.shiftKey && e.key === 'N') {
        e.preventDefault();
        createWindow();
      }
      
      // Escape：关闭搜索/多选模式/面板
      if (e.key === 'Escape') {
        if (searchVisible) {
          setSearchVisible(false);
          setSearchKeyword('');
          setCurrentMatchIndex(0);
        } else if (multiSelectMode) {
          exitMultiSelectMode();
        } else if (renameWindowId) {
          setRenameWindowId(null);
          setRenameInput('');
        } else if (windowManageMenuVisible) {
          setWindowManageMenuVisible(false);
        } else if (editingMessageIndex !== null) {
          handleCancelEdit();
        } else if (sidebarSearchVisible) {
          setSidebarSearchVisible(false);
          setSidebarSearchQuery('');
        } else if (sidebarContextMenu) {
          setSidebarContextMenu(null);
        } else {
          openAiMini();
        }
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [searchVisible, multiSelectMode, renameWindowId, windowManageMenuVisible, editingMessageIndex, sidebarSearchVisible, sidebarContextMenu, createWindow, exitMultiSelectMode, handleCancelEdit, openAiMini]);

  // 点击空白处关闭窗口管理菜单
  useEffect(() => {
    const handler = () => setWindowManageMenuVisible(false);
    if (windowManageMenuVisible) {
      setTimeout(() => document.addEventListener('click', handler), 0);
      return () => document.removeEventListener('click', handler);
    }
  }, [windowManageMenuVisible]);

  // 点击空白处关闭侧边栏右键菜单
  useEffect(() => {
    const handler = () => setSidebarContextMenu(null);
    if (sidebarContextMenu) {
      setTimeout(() => document.addEventListener('click', handler), 0);
      return () => document.removeEventListener('click', handler);
    }
  }, [sidebarContextMenu]);

  // 点击空白处关闭多选分享菜单
  useEffect(() => {
    const handler = () => setMultiShareMenuVisible(false);
    if (multiShareMenuVisible) {
      setTimeout(() => document.addEventListener('click', handler), 0);
      return () => document.removeEventListener('click', handler);
    }
  }, [multiShareMenuVisible]);

  // 点击空白处关闭跨窗口分享菜单
  useEffect(() => {
    const handler = () => setCrossWindowShareMenuVisible(false);
    if (crossWindowShareMenuVisible) {
      setTimeout(() => document.addEventListener('click', handler), 0);
      return () => document.removeEventListener('click', handler);
    }
  }, [crossWindowShareMenuVisible]);

  const renderMessage = (msg: { role: string; content: string | any; creativityRefs?: any[] }, index: number) => {
    const isUser = msg.role === 'user';
    const contentText = extractTextContent(msg.content);
    const { cleanContent, songs } = isUser ? { cleanContent: contentText, songs: [] } : extractAndRemoveSongMarks(contentText);
    const timestamp = messageTimestamps[index] || Date.now();
    const isCurrentMatch = searchMatches.length > 0 && searchMatches[currentMatchIndex] === index;
    const isShareOpen = shareMenuIndex === index;
    const isEditing = editingMessageIndex === index;
    const isSelected = selectedMessageIndices.has(index);
    const hasCreativityRefs = isUser && msg.creativityRefs && msg.creativityRefs.length > 0;
    const userAvatarLetter = getUserAvatar(settings);

    return (
      <motion.div
        key={index}
        ref={(el) => { if (el) messageRefs.current.set(index, el); else messageRefs.current.delete(index); }}
        initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.15 }}
        className="message-row"
        style={{
          display: 'flex', justifyContent: isUser ? 'flex-end' : 'flex-start',
          marginBottom: 14, padding: '0 16px',
          position: 'relative',
          outline: isCurrentMatch ? '2px solid rgba(250,204,21,0.6)' : isSelected ? '2px solid var(--primary-color)' : 'none',
          outlineOffset: 2, borderRadius: 8,
        }}
      >
        {/* 多选模式勾选框 */}
        {multiSelectMode && (
          <div style={{
            display: 'flex', alignItems: 'center', marginRight: 8, flexShrink: 0,
          }}>
            <button
              onClick={() => toggleMessageSelection(index)}
              style={{
                width: 20, height: 20, borderRadius: 4,
                border: isSelected ? 'none' : '2px solid var(--border-color)',
                background: isSelected ? 'var(--primary-color)' : 'transparent',
                cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center',
                transition: 'all 0.15s ease',
              }}
            >
              {isSelected && <Check size={14} color="#fff" />}
            </button>
          </div>
        )}
        {!isUser && (
          <div style={{
            width: 30, height: 30, borderRadius: '50%',
            background: 'linear-gradient(135deg, var(--primary-color), #8b5cf6)',
            display: 'flex', alignItems: 'center', justifyContent: 'center',
            marginRight: 8, flexShrink: 0, marginTop: 2,
            boxShadow: '0 2px 8px rgba(99,102,241,0.3)',
          }}>
            <Bot size={16} style={{ color: '#fff' }} />
          </div>
        )}
        <div className="selectable message-bubble-wrapper" style={{
          maxWidth: isUser ? '70%' : '80%', position: 'relative',
        }}>
        <div className="message-bubble" style={{
          padding: '10px 14px',
          borderRadius: isUser ? '16px 16px 4px 16px' : '16px 16px 16px 4px',
          background: isUser ? 'var(--primary-color)' : 'var(--bg-secondary)',
          color: isUser ? '#fff' : 'var(--text-primary)',
          fontSize: 14, lineHeight: 1.7, wordBreak: 'break-word',
          boxShadow: isUser
            ? '0 2px 12px rgba(0,0,0,0.15), 0 1px 3px rgba(0,0,0,0.1)'
            : 'var(--shadow-sm)',
          position: 'relative',
        }}>
          {/* 时间戳 + Agent 标记 */}
          <div style={{
            fontSize: 10, color: isUser ? 'rgba(255,255,255,0.5)' : 'var(--text-tertiary)',
            marginBottom: 4, display: 'flex', alignItems: 'center', gap: 3,
          }}>
            {/* Agent 模式图标标记 */}
            {(msg as any).reasoningSteps?.length === 1 && (msg as any).reasoningSteps[0].id === 'agent_tag' && (
              <span style={{ display: 'inline-flex', alignItems: 'center', gap: 2, marginRight: 4, padding: '1px 5px', borderRadius: 4, background: 'rgba(139,92,246,0.3)', fontSize: 9 }}>
                <Cpu size={9} /> Agent
              </span>
            )}
            <Clock size={10} />
            <span>{formatTime(timestamp)}</span>
          </div>

          {/* 编辑模式 */}
          {isEditing ? (
            <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
              <textarea
                value={editingContent}
                onChange={(e) => setEditingContent(e.target.value)}
                style={{
                  width: '100%', minHeight: 60, padding: 8,
                  border: '1px solid var(--border-color)', borderRadius: 8,
                  background: 'var(--bg-primary)', color: 'var(--text-primary)',
                  fontSize: 14, resize: 'vertical', fontFamily: 'inherit',
                }}
                autoFocus
              />
              <div style={{ display: 'flex', gap: 8, justifyContent: 'flex-end' }}>
                <button
                  onClick={handleCancelEdit}
                  style={{
                    padding: '4px 12px', borderRadius: 6,
                    border: '1px solid var(--border-light)', background: 'transparent',
                    color: 'var(--text-secondary)', cursor: 'pointer', fontSize: 12,
                  }}
                >
                  取消
                </button>
                <button
                  onClick={handleSaveEditMessage}
                  style={{
                    padding: '4px 12px', borderRadius: 6,
                    border: 'none', background: 'var(--primary-color)',
                    color: '#fff', cursor: 'pointer', fontSize: 12,
                  }}
                >
                  保存
                </button>
              </div>
            </div>
          ) : isUser ? (
            hasCreativityRefs ? (
              <div>
                <span style={{ whiteSpace: 'pre-wrap', display: 'block', marginBottom: 8 }}>
                  {searchKeyword.trim() ? <HighlightText text={contentText} keyword={searchKeyword} /> : contentText}
                </span>
                <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
                  {msg.creativityRefs!.map((ref: any) => (
                    <CreativityRefCard key={ref.id} ref={ref} />
                  ))}
                </div>
              </div>
            ) : Array.isArray(msg.content) ? (
              <div>
                {msg.content.map((item: any, i: number) => {
                  if (item.type === 'image_url' && item.image_url?.url) {
                    return (
                      <div key={i} style={{ marginBottom: 8 }}>
                        <img
                          src={item.image_url.url}
                          alt="用户图片"
                          style={{
                            maxWidth: '100%', maxHeight: 200, borderRadius: 8,
                            objectFit: 'cover',
                          }}
                        />
                      </div>
                    );
                  }
                  if (item.type === 'text' && item.text) {
                    return <span key={i} style={{ whiteSpace: 'pre-wrap' }}>{item.text}</span>;
                  }
                  return null;
                })}
              </div>
            ) : (
              <span style={{ whiteSpace: 'pre-wrap' }}>
                {searchKeyword.trim() ? <HighlightText text={contentText} keyword={searchKeyword} /> : contentText}
              </span>
            )
          ) : (
            <>
              {/* 推理过程面板（排除 Agent 标记） */}
              {(() => {
                const steps = (msg as any).reasoningSteps;
                const isAgentTag = steps && steps.length === 1 && steps[0].id === 'agent_tag';
                const hasRealSteps = steps && steps.length > 0 && !isAgentTag;
                return hasRealSteps ? (
                  <ThinkingSection
                    steps={steps}
                    isThinking={false}
                    collapsed={(msg as any).reasoningCollapsed ?? true}
                    onToggleCollapse={() => toggleMessageReasoning?.(index)}
                    variant="default"
                  />
                ) : null;
              })()}
              {searchKeyword.trim() ? (
                <div className="ai-markdown-body">
                  <HighlightText text={cleanContent} keyword={searchKeyword} />
                </div>
              ) : (
                <div className="ai-markdown-body">
                  <ReactMarkdown
                    remarkPlugins={[remarkGfm]}
                    components={{
                      code: ({ node, inline, className, children, ...props }: any) => {
                        const match = /language-(\w+)/.exec(className || '');
                        const language = match ? match[1] : '';

                        if (!inline && (className || children?.toString()?.includes('\n'))) {
                          return (
                            <div style={{ position: 'relative', margin: '8px 0', borderRadius: 8, overflow: 'hidden', background: '#1e1e2e' }}>
                              {language && (
                                <div style={{
                                  padding: '4px 12px', fontSize: 11, color: '#a6adc8',
                                  background: '#181825', borderBottom: '1px solid #313244',
                                  display: 'flex', justifyContent: 'space-between', alignItems: 'center',
                                }}>
                                  <span>{language}</span>
                                  <button
                                    onClick={() => navigator.clipboard.writeText(children?.toString())}
                                    style={{
                                      background: 'none', border: 'none', color: '#a6adc8',
                                      cursor: 'pointer', fontSize: 11, padding: '2px 6px', borderRadius: 4,
                                    }}
                                    onMouseEnter={(e: any) => (e.target as HTMLElement).style.color = '#cdd6f4'}
                                    onMouseLeave={(e: any) => (e.target as HTMLElement).style.color = '#a6adc8'}
                                  >
                                    复制
                                  </button>
                                </div>
                              )}
                              <pre style={{ margin: 0, padding: '12px 16px', overflowX: 'auto', fontSize: 13, lineHeight: 1.6 }}>
                                <code className={className} style={{ background: 'transparent', fontSize: 'inherit' }} {...props}>
                                  {children}
                                </code>
                              </pre>
                            </div>
                          );
                        }
                        return (
                          <code
                            style={{
                              background: 'rgba(0,0,0,0.06)', padding: '2px 6px', borderRadius: 4,
                              fontSize: '0.9em', fontFamily: 'Menlo, Monaco, Consolas, monospace',
                            }}
                            {...props}
                          >
                            {children}
                          </code>
                        );
                      },
                      img: ({ src, alt, ...props }: any) => (
                        <img
                          src={src}
                          alt={alt || ''}
                          style={{ maxWidth: '100%', borderRadius: 8, marginTop: 8, marginBottom: 8, cursor: 'pointer' }}
                          onClick={() => window.open(src, '_blank')}
                          {...props}
                        />
                      ),
                    }}
                  >
                    {cleanContent}
                  </ReactMarkdown>
                </div>
              )}
              {/* 工具调用展示 - 折叠卡片样式 */}
              {completedToolCalls.length > 0 && (
                <div style={{ marginTop: 8, display: 'flex', flexDirection: 'column', gap: 6 }}>
                  {completedToolCalls.map((tc) => {
                    const isExpanded = expandedToolCalls.has(tc.id);
                    const inputStr = typeof tc.input === 'string' ? tc.input : JSON.stringify(tc.input, null, 2);
                    const outputStr = typeof tc.output === 'string' ? tc.output : JSON.stringify(tc.output, null, 2);
                    const isSuccess = tc.status === 'completed';
                    const isError = tc.status === 'error';
                    return (
                      <div key={tc.id} style={{
                        borderRadius: 8,
                        border: '1px solid var(--border-light)',
                        background: 'var(--bg-tertiary)',
                        overflow: 'hidden',
                      }}>
                        {/* 工具调用头部 */}
                        <div
                          onClick={() => toggleToolCallExpand(tc.id)}
                          style={{
                            padding: '8px 12px',
                            display: 'flex', alignItems: 'center', gap: 8,
                            cursor: 'pointer',
                            transition: 'background 0.15s ease',
                          }}
                          onMouseEnter={(e) => { (e.currentTarget as HTMLElement).style.background = 'var(--bg-secondary)'; }}
                          onMouseLeave={(e) => { (e.currentTarget as HTMLElement).style.background = 'var(--bg-tertiary)'; }}
                        >
                          <Wrench size={13} style={{ color: 'var(--text-secondary)', flexShrink: 0 }} />
                          <span style={{ flex: 1, fontSize: 12, fontWeight: 500, color: 'var(--text-primary)' }}>
                            {getToolLabel(tc.name)}
                          </span>
                          <span style={{
                            fontSize: 11, padding: '1px 6px', borderRadius: 4,
                            background: isError ? 'rgba(255,77,79,0.1)' : 'rgba(34,197,94,0.1)',
                            color: isError ? '#ff4d4f' : '#22c55e',
                          }}>
                            {isSuccess ? '✓ 成功' : isError ? '✗ 失败' : '... 执行中'}
                          </span>
                          <ChevronDown size={13} style={{
                            color: 'var(--text-tertiary)', flexShrink: 0,
                            transform: isExpanded ? 'rotate(180deg)' : 'rotate(0deg)',
                            transition: 'transform 0.2s ease',
                          }} />
                        </div>
                        {/* 展开详情 */}
                        {isExpanded && (
                          <div style={{
                            borderTop: '1px solid var(--border-light)',
                            padding: '10px 12px',
                            display: 'flex', flexDirection: 'column', gap: 8,
                          }}>
                            {/* 输入参数 */}
                            <div>
                              <div style={{ fontSize: 11, fontWeight: 500, color: 'var(--text-tertiary)', marginBottom: 4 }}>输入参数</div>
                              <pre style={{
                                margin: 0, padding: '8px 10px', borderRadius: 6,
                                background: 'var(--bg-primary)', fontSize: 11,
                                color: 'var(--text-secondary)', overflowX: 'auto',
                                maxHeight: 120, overflowY: 'auto',
                                fontFamily: "'Consolas', 'Monaco', monospace",
                                lineHeight: 1.5,
                              }}>{inputStr}</pre>
                            </div>
                            {/* 输出结果 */}
                            {outputStr && (
                              <div>
                                <div style={{ fontSize: 11, fontWeight: 500, color: 'var(--text-tertiary)', marginBottom: 4 }}>输出结果</div>
                                <pre style={{
                                  margin: 0, padding: '8px 10px', borderRadius: 6,
                                  background: 'var(--bg-primary)', fontSize: 11,
                                  color: 'var(--text-secondary)', overflowX: 'auto',
                                  maxHeight: 160, overflowY: 'auto',
                                  fontFamily: "'Consolas', 'Monaco', monospace",
                                  lineHeight: 1.5,
                                  whiteSpace: 'pre-wrap', wordBreak: 'break-all',
                                }}>{truncateText(outputStr, 500)}</pre>
                                {outputStr.length > 500 && (
                                  <button
                                    onClick={(e) => { e.stopPropagation(); copyTextToClipboard(outputStr); }}
                                    style={{
                                      marginTop: 4, background: 'none', border: 'none',
                                      color: 'var(--primary-color)', cursor: 'pointer', fontSize: 11,
                                      padding: 0,
                                    }}
                                  >
                                    结果已截断，点击复制完整内容
                                  </button>
                                )}
                              </div>
                            )}
                          </div>
                        )}
                      </div>
                    );
                  })}
                </div>
              )}
              {isTTSSupported && (
                <div style={{ display: 'flex', justifyContent: 'flex-end', marginTop: 4 }}>
                  <button onClick={() => toggleTTS(typeof msg.content === 'string' ? msg.content : '')}
                    style={{ background: 'none', border: 'none', cursor: 'pointer', color: 'var(--text-tertiary)', padding: 2, opacity: 0.6 }}
                    title={isSpeaking ? '停止朗读' : '朗读此消息'}>
                    {isSpeaking ? <VolumeX size={12} /> : <Volume2 size={12} />}
                  </button>
                </div>
              )}
              {songs.length > 0 && (
                <div style={{ marginTop: 10, padding: '10px 12px', borderRadius: 8, backgroundColor: 'var(--bg-tertiary)', border: '1px solid var(--border-light)' }}>
                  <div style={{ fontSize: 12, fontWeight: 500, color: 'var(--text-secondary)', marginBottom: 8 }}>推荐歌曲</div>
                  <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
                    {songs.map((song, idx) => {
                      const exists = tracks.some(t => t.title.toLowerCase().includes(song.title.toLowerCase()) && (!song.artist || t.artist.toLowerCase().includes(song.artist.toLowerCase())));
                      return (
                        <div key={idx} style={{ display: 'flex', alignItems: 'center', gap: 8, padding: '6px 8px', borderRadius: 6, backgroundColor: 'var(--bg-secondary)' }}>
                          <div style={{ flex: 1, minWidth: 0 }}>
                            <div style={{ fontSize: 13, fontWeight: 500, color: 'var(--text-primary)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{song.title}</div>
                            {song.artist && <div style={{ fontSize: 11, color: 'var(--text-tertiary)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{song.artist}</div>}
                          </div>
                          <motion.button whileHover={{ scale: 1.1 }} whileTap={{ scale: 0.9 }}
                            onClick={() => handlePlayRecommendedSong(song.title, song.artist)} disabled={!exists}
                            style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', width: 30, height: 30, borderRadius: '50%', border: 'none', backgroundColor: exists ? 'var(--primary-color)' : 'var(--bg-tertiary)', color: exists ? '#fff' : 'var(--text-tertiary)', cursor: exists ? 'pointer' : 'not-allowed', opacity: exists ? 1 : 0.5, flexShrink: 0 }}>
                            <Play size={13} fill={exists ? '#fff' : 'none'} />
                          </motion.button>
                        </div>
                      );
                    })}
                  </div>
                </div>
              )}
            </>
          )}

          {/* 操作按钮区域（hover 时显示） */}
          {!isEditing && !multiSelectMode && (
            <div
              className="message-hover-actions"
              style={{
                position: 'absolute', top: 4, right: 4,
                opacity: 0, transition: 'opacity 0.15s ease',
                display: 'flex', gap: 2,
              }}
              onMouseEnter={(e) => { (e.currentTarget as HTMLElement).style.opacity = '1'; }}
              onMouseLeave={(e) => { if (!isShareOpen) (e.currentTarget as HTMLElement).style.opacity = '0'; }}
            >
              {/* 编辑按钮（仅用户消息） */}
              {isUser && (
                <button
                  onClick={(e) => { e.stopPropagation(); handleStartEditMessage(index); }}
                  style={{
                    background: 'rgba(255,255,255,0.2)',
                    border: 'none', cursor: 'pointer',
                    color: '#fff',
                    padding: 3, borderRadius: 4, display: 'flex', alignItems: 'center',
                  }}
                  title="编辑消息"
                >
                  <Pencil size={13} />
                </button>
              )}
              {/* 删除按钮 */}
              <button
                onClick={(e) => { e.stopPropagation(); handleDeleteMessage(index); }}
                style={{
                  background: isUser ? 'rgba(255,255,255,0.2)' : 'var(--bg-tertiary)',
                  border: 'none', cursor: 'pointer',
                  color: isUser ? '#fff' : 'var(--text-secondary)',
                  padding: 3, borderRadius: 4, display: 'flex', alignItems: 'center',
                }}
                title="删除消息"
              >
                <Trash2 size={13} />
              </button>
              {/* 分享按钮 */}
              <button
                onClick={(e) => { e.stopPropagation(); setShareMenuIndex(isShareOpen ? null : index); }}
                style={{
                  background: isUser ? 'rgba(255,255,255,0.2)' : 'var(--bg-tertiary)',
                  border: 'none', cursor: 'pointer',
                  color: isUser ? '#fff' : 'var(--text-secondary)',
                  padding: 3, borderRadius: 4, display: 'flex', alignItems: 'center',
                }}
                title="分享"
              >
                <Share2 size={13} />
              </button>
              {/* 分享菜单 */}
              <AnimatePresence>
                {isShareOpen && (
                  <motion.div
                    initial={{ opacity: 0, scale: 0.9, y: -4 }}
                    animate={{ opacity: 1, scale: 1, y: 0 }}
                    exit={{ opacity: 0, scale: 0.9, y: -4 }}
                    transition={{ duration: 0.1 }}
                    onClick={(e) => e.stopPropagation()}
                    style={{
                      position: 'absolute', top: '100%', right: 0, marginTop: 4,
                      background: 'var(--bg-primary)', border: '1px solid var(--border-light)',
                      borderRadius: 8, boxShadow: '0 4px 16px rgba(0,0,0,0.12)',
                      padding: '4px 0', minWidth: 140, zIndex: 100,
                    }}
                  >
                    <button
                      onClick={() => handleCopyMarkdown(msg, index)}
                      style={{
                        display: 'flex', alignItems: 'center', gap: 8, width: '100%',
                        padding: '8px 14px', border: 'none', background: 'none',
                        color: 'var(--text-primary)', fontSize: 13, cursor: 'pointer',
                        transition: 'background 0.1s ease',
                      }}
                      onMouseEnter={(e) => { (e.currentTarget as HTMLElement).style.background = 'var(--bg-secondary)'; }}
                      onMouseLeave={(e) => { (e.currentTarget as HTMLElement).style.background = 'none'; }}
                    >
                      <Copy size={14} style={{ color: 'var(--text-secondary)' }} />
                      <span>复制为 Markdown</span>
                    </button>
                    <button
                      onClick={() => handleExportImage(index)}
                      style={{
                        display: 'flex', alignItems: 'center', gap: 8, width: '100%',
                        padding: '8px 14px', border: 'none', background: 'none',
                        color: 'var(--text-primary)', fontSize: 13, cursor: 'pointer',
                        transition: 'background 0.1s ease',
                      }}
                      onMouseEnter={(e) => { (e.currentTarget as HTMLElement).style.background = 'var(--bg-secondary)'; }}
                      onMouseLeave={(e) => { (e.currentTarget as HTMLElement).style.background = 'none'; }}
                    >
                      <Download size={14} style={{ color: 'var(--text-secondary)' }} />
                      <span>导出为图片</span>
                    </button>
                  </motion.div>
                )}
              </AnimatePresence>
            </div>
          )}
        </div>

        {/* AI 消息操作按钮行（hover 时显示） */}
        {!isUser && !isEditing && !multiSelectMode && (
          <div className="message-actions-bar" style={{
            display: 'flex', gap: 2, marginTop: 6, paddingLeft: 4,
            opacity: 0, transition: 'opacity 0.2s ease',
          }}>
            <button
              onClick={() => handleCopyMessage(msg.content, index)}
              style={{
                background: 'none', border: 'none', cursor: 'pointer',
                color: copiedMessageIndex === index ? 'var(--primary-color)' : 'var(--text-tertiary)',
                padding: '3px 6px', borderRadius: 4, display: 'flex', alignItems: 'center', gap: 3,
                fontSize: 11, transition: 'color 0.15s ease',
              }}
              title="复制"
            >
              <Copy size={13} />
              {copiedMessageIndex === index && <span>已复制</span>}
            </button>
            <button
              onClick={() => handleMessageFeedback(index, 'up')}
              style={{
                background: 'none', border: 'none', cursor: 'pointer',
                color: messageFeedback.get(index) === 'up' ? 'var(--primary-color)' : 'var(--text-tertiary)',
                padding: '3px 6px', borderRadius: 4, display: 'flex', alignItems: 'center',
                transition: 'color 0.15s ease',
              }}
              title="有帮助"
            >
              <ThumbsUp size={13} />
            </button>
            <button
              onClick={() => handleMessageFeedback(index, 'down')}
              style={{
                background: 'none', border: 'none', cursor: 'pointer',
                color: messageFeedback.get(index) === 'down' ? '#ff4d4f' : 'var(--text-tertiary)',
                padding: '3px 6px', borderRadius: 4, display: 'flex', alignItems: 'center',
                transition: 'color 0.15s ease',
              }}
              title="无帮助"
            >
              <ThumbsDown size={13} />
            </button>
          </div>
        )}

        {/* 用户消息发送时间戳（右下角） */}
        {isUser && !isEditing && (
          <div style={{
            textAlign: 'right', marginTop: 4, paddingRight: 4,
          }}>
            <span style={{
              fontSize: 10, color: 'var(--text-tertiary)', opacity: 0.7,
            }}>
              {formatTime(timestamp)}
            </span>
          </div>
        )}
        </div>

        {/* 用户头像 */}
        {isUser && (
          <div style={{
            width: 30, height: 30, borderRadius: '50%',
            background: 'linear-gradient(135deg, #f59e0b, #ef4444)',
            display: 'flex', alignItems: 'center', justifyContent: 'center',
            marginLeft: 8, flexShrink: 0, marginTop: 2,
            color: '#fff', fontSize: 13, fontWeight: 600,
            boxShadow: '0 2px 8px rgba(245,158,11,0.3)',
          }}>
            {userAvatarLetter}
          </div>
        )}

        {/* 删除确认对话框 */}
        {deleteConfirmIndex === index && (
          <div style={{
            position: 'fixed', top: 0, left: 0, right: 0, bottom: 0,
            background: 'rgba(0,0,0,0.5)', display: 'flex',
            alignItems: 'center', justifyContent: 'center', zIndex: 10000,
          }} onClick={() => setDeleteConfirmIndex(null)}>
            <div style={{
              background: 'var(--bg-primary)', padding: 20, borderRadius: 12,
              maxWidth: 300, boxShadow: '0 8px 32px rgba(0,0,0,0.2)',
            }} onClick={(e) => e.stopPropagation()}>
              <div style={{ fontSize: 15, fontWeight: 600, marginBottom: 8, color: 'var(--text-primary)' }}>
                确认删除
              </div>
              <div style={{ fontSize: 13, color: 'var(--text-secondary)', marginBottom: 16 }}>
                确定要删除这条消息吗？此操作无法撤销。
              </div>
              <div style={{ display: 'flex', gap: 8, justifyContent: 'flex-end' }}>
                <button
                  onClick={() => setDeleteConfirmIndex(null)}
                  style={{
                    padding: '6px 16px', borderRadius: 6,
                    border: '1px solid var(--border-light)', background: 'transparent',
                    color: 'var(--text-secondary)', cursor: 'pointer', fontSize: 13,
                  }}
                >
                  取消
                </button>
                <button
                  onClick={confirmDeleteMessage}
                  style={{
                    padding: '6px 16px', borderRadius: 6,
                    border: 'none', background: '#ff4d4f',
                    color: '#fff', cursor: 'pointer', fontSize: 13,
                  }}
                >
                  删除
                </button>
              </div>
            </div>
          </div>
        )}
      </motion.div>
    );
  };

  if (aiPanelMode !== 'fullscreen') return null;

  return (
    <>
      <style>{`
        .ai-markdown-body { font-size: 14px; line-height: 1.8; color: var(--text-primary); }
        .ai-markdown-body p { margin: 0 0 8px 0; }
        .ai-markdown-body p:last-child { margin-bottom: 0; }
        .ai-markdown-body ul, .ai-markdown-body ol { margin: 4px 0; padding-left: 22px; }
        .ai-markdown-body li { margin: 2px 0; }
        .ai-markdown-body code { background: var(--bg-tertiary); padding: 2px 6px; border-radius: 4px; font-size: 13px; font-family: 'Consolas', 'Monaco', monospace; }
        .ai-markdown-body pre { background: var(--bg-tertiary); padding: 12px 14px; border-radius: 8px; overflow-x: auto; margin: 8px 0; }
        .ai-markdown-body pre code { background: none; padding: 0; font-size: 13px; }
        .ai-markdown-body blockquote { border-left: 3px solid var(--primary-color); margin: 8px 0; padding: 4px 14px; color: var(--text-secondary); }
        .ai-markdown-body h1, .ai-markdown-body h2, .ai-markdown-body h3 { margin: 12px 0 6px 0; font-weight: 600; }
        .ai-markdown-body h1 { font-size: 20px; } .ai-markdown-body h2 { font-size: 17px; } .ai-markdown-body h3 { font-size: 15px; }
        .ai-markdown-body table { border-collapse: collapse; width: 100%; margin: 8px 0; font-size: 13px; }
        .ai-markdown-body th, .ai-markdown-body td { border: 1px solid var(--border-light); padding: 6px 10px; text-align: left; }
        .ai-markdown-body th { background: var(--bg-tertiary); font-weight: 600; }
        .ai-markdown-body a { color: var(--primary-color); text-decoration: none; }
        .ai-markdown-body a:hover { text-decoration: underline; }
        .ai-markdown-body hr { border: none; border-top: 1px solid var(--border-light); margin: 12px 0; }
        .ai-markdown-body strong { font-weight: 600; }
        .ai-cursor-blink { display: inline-block; width: 2px; height: 1em; background: var(--primary-color); margin-left: 2px; vertical-align: text-bottom; animation: ai-cursor-blink 0.8s ease-in-out infinite; }
        @keyframes ai-cursor-blink { 0%, 100% { opacity: 1; } 50% { opacity: 0; } }

        /* 消息行 hover 时显示操作按钮 */
        .message-row:hover .message-hover-actions,
        .message-row:hover .message-actions-bar {
          opacity: 1 !important;
        }
        .message-row:hover .message-bubble {
          box-shadow: 0 2px 12px rgba(0,0,0,0.12), 0 1px 3px rgba(0,0,0,0.08) !important;
        }
      `}</style>

      <AnimatePresence>
        <motion.div
          initial={{ y: '100%' }}
          animate={{ y: 0 }}
          exit={{ y: '100%' }}
          transition={{ type: 'spring', damping: 30, stiffness: 400 }}
          style={{
            position: 'fixed',
            left: 0,
            right: 0,
            bottom: 0,
            height: drawerHeight,
            zIndex: 10001,
            display: 'flex',
            flexDirection: 'column',
            background: 'var(--bg-primary)',
            borderTop: '1px solid var(--border-light)',
            borderRadius: '16px 16px 0 0',
            boxShadow: '0 -8px 40px rgba(0,0,0,0.15), 0 -2px 8px rgba(0,0,0,0.05)',
            overflow: 'hidden',
          }}
        >
          {/* 拖拽手柄 */}
          <div
            onMouseDown={handleResizeStart}
            style={{
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              padding: '6px 0 2px',
              cursor: 'ns-resize',
              flexShrink: 0,
            }}
          >
            <div style={{
              width: 40, height: 4, borderRadius: 2,
              background: 'var(--border-color)',
              opacity: 0.6,
            }} />
          </div>

          {/* 标题栏 */}
          <div style={{
            display: 'flex', alignItems: 'center', justifyContent: 'space-between',
            padding: '4px 16px 8px', borderBottom: '1px solid var(--border-light)',
            flexShrink: 0, background: 'var(--bg-secondary)',
          }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
              <div style={{
                width: 32, height: 32, borderRadius: '50%',
                background: 'transparent',
                display: 'flex', alignItems: 'center', justifyContent: 'center',
                overflow: 'hidden',
              }}>
                <img src={aiAssistantIcon} alt="AI" draggable={false} style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
              </div>
              <span style={{ fontWeight: 700, fontSize: 16, color: 'var(--text-primary)' }}>AI 助手</span>
              <span style={{ fontSize: 11, color: 'var(--text-tertiary)', background: 'var(--bg-tertiary)', padding: '2px 8px', borderRadius: 10 }}>全屏</span>
            </div>
            <div style={{ display: 'flex', alignItems: 'center', gap: 4, flexShrink: 0 }}>
              <Tooltip title={webSearchEnabled ? '联网搜索已开启' : '联网搜索已关闭'}>
                <button onClick={toggleWebSearch} style={{
                  background: webSearchEnabled ? 'var(--primary-bg)' : 'none', border: 'none', cursor: 'pointer',
                  color: webSearchEnabled ? 'var(--primary-color)' : 'var(--text-tertiary)', padding: 5, borderRadius: 6,
                  display: 'flex', alignItems: 'center', gap: 4, transition: 'all 0.15s ease', fontSize: 12,
                }}><Globe size={15} />{webSearchEnabled && <span>联网</span>}</button>
              </Tooltip>
              <Tooltip title={toolCallsEnabled ? '工具调用已开启' : '工具调用已关闭'}>
                <button onClick={() => setToolCallsEnabled(!toolCallsEnabled)} style={{
                  background: toolCallsEnabled ? 'var(--primary-bg)' : 'none', border: 'none', cursor: 'pointer',
                  color: toolCallsEnabled ? 'var(--primary-color)' : 'var(--text-tertiary)', padding: 5, borderRadius: 6,
                  display: 'flex', alignItems: 'center', transition: 'all 0.15s ease',
                }}><Wrench size={15} /></button>
              </Tooltip>
              <Tooltip title={followMode ? '实时跟随已开启 - AI操作时自动跳转' : '实时跟随已关闭'}>
                <button onClick={() => setFollowMode(!followMode)} style={{
                  background: followMode ? 'var(--primary-bg)' : 'none',
                  border: followMode ? '1px solid var(--primary-color)' : '1px solid transparent',
                  cursor: 'pointer', color: followMode ? 'var(--primary-color)' : 'var(--text-tertiary)',
                  padding: '4px 8px', borderRadius: 6, display: 'flex', alignItems: 'center', gap: 4,
                  transition: 'all 0.15s ease', fontSize: 12, fontWeight: followMode ? 600 : 400,
                }}><Eye size={14} /><span>跟随</span></button>
              </Tooltip>
              <Tooltip title="自定义工作流">
                <button onClick={() => setShowWorkflowEditor(true)} style={{
                  background: 'none', border: 'none', cursor: 'pointer', color: 'var(--text-tertiary)',
                  padding: 5, borderRadius: 6, display: 'flex', alignItems: 'center', transition: 'all 0.15s ease',
                }}
                  onMouseEnter={(e) => { (e.currentTarget as HTMLElement).style.color = 'var(--primary-color)'; }}
                  onMouseLeave={(e) => { (e.currentTarget as HTMLElement).style.color = 'var(--text-tertiary)'; }}
                ><Settings2 size={15} /></button>
              </Tooltip>
              <Tooltip title="AI 使用统计">
                <button onClick={() => setShowUsageDashboard(true)} style={{
                  background: 'none', border: 'none', cursor: 'pointer', color: 'var(--text-tertiary)',
                  padding: 5, borderRadius: 6, display: 'flex', alignItems: 'center', transition: 'all 0.15s ease',
                }}
                  onMouseEnter={(e) => { (e.currentTarget as HTMLElement).style.color = 'var(--primary-color)'; }}
                  onMouseLeave={(e) => { (e.currentTarget as HTMLElement).style.color = 'var(--text-tertiary)'; }}
                ><BarChart3 size={15} /></button>
              </Tooltip>
              <div style={{ position: 'relative' }}>
                <Tooltip title="导出对话">
                  <button onClick={() => setShowExportMenu(!showExportMenu)} style={{
                    background: showExportMenu ? 'var(--primary-bg)' : 'none', border: 'none', cursor: 'pointer',
                    color: showExportMenu ? 'var(--primary-color)' : 'var(--text-tertiary)', padding: 5, borderRadius: 6,
                    display: 'flex', alignItems: 'center', transition: 'all 0.15s ease',
                  }}><Download size={15} /></button>
                </Tooltip>
                {showExportMenu && (
                  <div style={{
                    position: 'absolute', top: '100%', right: 0, zIndex: 10001,
                    background: 'var(--bg-primary)', border: '1px solid var(--border-light)',
                    borderRadius: 8, boxShadow: '0 4px 12px rgba(0,0,0,0.15)', padding: 4, minWidth: 160,
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
              <div style={{ width: 1, height: 20, background: 'var(--border-light)', margin: '0 6px' }} />
              <Tooltip title="缩小为小窗 (Esc)">
                <button onClick={openAiMini} style={{
                  background: 'none', border: 'none', cursor: 'pointer', color: 'var(--text-tertiary)',
                  padding: 5, borderRadius: 6, display: 'flex', alignItems: 'center', transition: 'color 0.15s ease',
                }}
                  onMouseEnter={(e) => { (e.currentTarget as HTMLElement).style.color = 'var(--primary-color)'; }}
                  onMouseLeave={(e) => { (e.currentTarget as HTMLElement).style.color = 'var(--text-tertiary)'; }}
                ><Minimize2 size={16} /></button>
              </Tooltip>
              <Tooltip title="关闭 (Esc)">
                <button onClick={closeAiPanel} style={{
                  background: 'none', border: 'none', cursor: 'pointer', color: 'var(--text-tertiary)',
                  padding: 5, borderRadius: 6, display: 'flex', alignItems: 'center', transition: 'color 0.15s ease',
                }}
                  onMouseEnter={(e) => { (e.currentTarget as HTMLElement).style.color = '#ff4d4f'; }}
                  onMouseLeave={(e) => { (e.currentTarget as HTMLElement).style.color = 'var(--text-tertiary)'; }}
                ><X size={18} /></button>
              </Tooltip>
            </div>
          </div>

          {/* Tab 栏 + 窗口标签 + 模型选择 */}
          <div style={{ display: 'flex', alignItems: 'center', borderBottom: '1px solid var(--border-light)', flexShrink: 0, background: 'var(--bg-secondary)' }}>
            {[
              { key: 'chat', label: '对话', icon: <MessageSquare size={14} /> },
              { key: 'skills', label: '技能', icon: <Zap size={14} /> },
              { key: 'tools', label: '工具', icon: <Wrench size={14} /> },
            ].map((tab) => (
              <button key={tab.key} onClick={() => setActiveTab(tab.key)} style={{
                display: 'flex', alignItems: 'center', gap: 5, padding: '8px 16px',
                border: 'none', borderBottom: activeTab === tab.key ? '2px solid var(--primary-color)' : '2px solid transparent',
                background: activeTab === tab.key ? 'var(--primary-bg)' : 'transparent',
                color: activeTab === tab.key ? 'var(--primary-color)' : 'var(--text-secondary)',
                cursor: 'pointer', fontSize: 13, fontWeight: activeTab === tab.key ? 600 : 400,
                transition: 'all 0.15s ease',
              }}>
                {tab.icon}<span>{tab.label}</span>
              </button>
            ))}
            <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginLeft: 12, flex: 1 }}>
              {/* 当前对话标题 */}
              {activeWindowId && (
                <div style={{
                  display: 'flex',
                  alignItems: 'center',
                  gap: 6,
                  padding: '4px 10px',
                  borderRadius: 6,
                  background: 'var(--bg-tertiary)',
                  maxWidth: 200,
                }}>
                  <MessageSquare size={12} style={{ color: 'var(--primary-color)', flexShrink: 0 }} />
                  <span style={{
                    fontSize: 12,
                    color: 'var(--text-primary)',
                    overflow: 'hidden',
                    textOverflow: 'ellipsis',
                    whiteSpace: 'nowrap',
                  }}>
                    {chatWindows.find(w => w.id === activeWindowId)?.title || '对话'}
                  </span>
                  <span style={{
                    fontSize: 10,
                    color: 'var(--text-tertiary)',
                    flexShrink: 0,
                  }}>
                    ({messages.length})
                  </span>
                </div>
              )}
              
              {/* 窗口管理按钮 */}
              {activeWindowId && (
                <div style={{ position: 'relative' }}>
                  <Tooltip title="对话管理">
                    <button
                      onClick={(e) => { e.stopPropagation(); setWindowManageMenuVisible(!windowManageMenuVisible); }}
                      style={{
                        display: 'flex', alignItems: 'center', justifyContent: 'center', width: 26, height: 26,
                        borderRadius: 5, border: '1px solid var(--border-light)', background: 'transparent',
                        color: 'var(--text-tertiary)', cursor: 'pointer', flexShrink: 0,
                      }}
                    >
                      <MoreVertical size={13} />
                    </button>
                  </Tooltip>
                  
                  {/* 窗口管理菜单 */}
                  <AnimatePresence>
                    {windowManageMenuVisible && (
                      <motion.div
                        initial={{ opacity: 0, scale: 0.9, y: -4 }}
                        animate={{ opacity: 1, scale: 1, y: 0 }}
                        exit={{ opacity: 0, scale: 0.9, y: -4 }}
                        transition={{ duration: 0.1 }}
                        onClick={(e) => e.stopPropagation()}
                        style={{
                          position: 'absolute', top: '100%', left: 0, marginTop: 4,
                          background: 'var(--bg-primary)', border: '1px solid var(--border-light)',
                          borderRadius: 8, boxShadow: '0 4px 16px rgba(0,0,0,0.12)',
                          padding: '4px 0', minWidth: 160, zIndex: 100,
                        }}
                      >
                        <button
                          onClick={() => activeWindowId && handleRenameWindow(activeWindowId)}
                          style={{
                            display: 'flex', alignItems: 'center', gap: 8, width: '100%',
                            padding: '8px 14px', border: 'none', background: 'none',
                            color: 'var(--text-primary)', fontSize: 13, cursor: 'pointer',
                            transition: 'background 0.1s ease',
                          }}
                          onMouseEnter={(e) => { (e.currentTarget as HTMLElement).style.background = 'var(--bg-secondary)'; }}
                          onMouseLeave={(e) => { (e.currentTarget as HTMLElement).style.background = 'none'; }}
                        >
                          <Pencil size={14} style={{ color: 'var(--text-secondary)' }} />
                          <span>重命名</span>
                        </button>
                        <button
                          onClick={() => activeWindowId && handlePinWindow(activeWindowId)}
                          style={{
                            display: 'flex', alignItems: 'center', gap: 8, width: '100%',
                            padding: '8px 14px', border: 'none', background: 'none',
                            color: 'var(--text-primary)', fontSize: 13, cursor: 'pointer',
                            transition: 'background 0.1s ease',
                          }}
                          onMouseEnter={(e) => { (e.currentTarget as HTMLElement).style.background = 'var(--bg-secondary)'; }}
                          onMouseLeave={(e) => { (e.currentTarget as HTMLElement).style.background = 'none'; }}
                        >
                          <Pin size={14} style={{ color: 'var(--text-secondary)' }} />
                          <span>置顶</span>
                        </button>
                        <div style={{ height: 1, background: 'var(--border-light)', margin: '4px 0' }} />
                        <button
                          onClick={() => activeWindowId && handleDeleteWindow(activeWindowId)}
                          disabled={chatWindows.length <= 1}
                          style={{
                            display: 'flex', alignItems: 'center', gap: 8, width: '100%',
                            padding: '8px 14px', border: 'none', background: 'none',
                            color: chatWindows.length > 1 ? '#ff4d4f' : 'var(--text-tertiary)',
                            fontSize: 13, cursor: chatWindows.length > 1 ? 'pointer' : 'not-allowed',
                            transition: 'background 0.1s ease',
                          }}
                          onMouseEnter={(e) => { if (chatWindows.length > 1) (e.currentTarget as HTMLElement).style.background = 'rgba(255,77,79,0.1)'; }}
                          onMouseLeave={(e) => { (e.currentTarget as HTMLElement).style.background = 'none'; }}
                        >
                          <Trash2 size={14} />
                          <span>删除窗口</span>
                        </button>
                        <div style={{ height: 1, background: 'var(--border-light)', margin: '4px 0' }} />
                        <div style={{
                          padding: '6px 14px',
                          color: 'var(--text-tertiary)', fontSize: 11,
                          fontWeight: 500,
                        }}>
                          导出对话
                        </div>
                        <button
                          onClick={handleExportMarkdown}
                          style={{
                            display: 'flex', alignItems: 'center', gap: 8, width: '100%',
                            padding: '8px 14px', border: 'none', background: 'none',
                            color: 'var(--text-primary)', fontSize: 13, cursor: 'pointer',
                            transition: 'background 0.1s ease',
                          }}
                          onMouseEnter={(e) => { (e.currentTarget as HTMLElement).style.background = 'var(--bg-secondary)'; }}
                          onMouseLeave={(e) => { (e.currentTarget as HTMLElement).style.background = 'none'; }}
                        >
                          <FileText size={14} style={{ color: 'var(--text-secondary)' }} />
                          <span>导出为 Markdown</span>
                        </button>
                        <button
                          onClick={handleExportJSON}
                          style={{
                            display: 'flex', alignItems: 'center', gap: 8, width: '100%',
                            padding: '8px 14px', border: 'none', background: 'none',
                            color: 'var(--text-primary)', fontSize: 13, cursor: 'pointer',
                            transition: 'background 0.1s ease',
                          }}
                          onMouseEnter={(e) => { (e.currentTarget as HTMLElement).style.background = 'var(--bg-secondary)'; }}
                          onMouseLeave={(e) => { (e.currentTarget as HTMLElement).style.background = 'none'; }}
                        >
                          <FileJson size={14} style={{ color: 'var(--text-secondary)' }} />
                          <span>导出为 JSON</span>
                        </button>
                        <button
                          onClick={handleExportPDF}
                          style={{
                            display: 'flex', alignItems: 'center', gap: 8, width: '100%',
                            padding: '8px 14px', border: 'none', background: 'none',
                            color: 'var(--text-primary)', fontSize: 13, cursor: 'pointer',
                            transition: 'background 0.1s ease',
                          }}
                          onMouseEnter={(e) => { (e.currentTarget as HTMLElement).style.background = 'var(--bg-secondary)'; }}
                          onMouseLeave={(e) => { (e.currentTarget as HTMLElement).style.background = 'none'; }}
                        >
                          <File size={14} style={{ color: 'var(--text-secondary)' }} />
                          <span>导出为 PDF</span>
                        </button>
                      </motion.div>
                    )}
                  </AnimatePresence>
                </div>
              )}
              
              {/* 重命名对话框 */}
              {renameWindowId && (
                <div style={{
                  position: 'fixed', top: 0, left: 0, right: 0, bottom: 0,
                  background: 'rgba(0,0,0,0.5)', display: 'flex',
                  alignItems: 'center', justifyContent: 'center', zIndex: 10002,
                }} onClick={() => { setRenameWindowId(null); setRenameInput(''); }}>
                  <div style={{
                    background: 'var(--bg-primary)', padding: 20, borderRadius: 12,
                    maxWidth: 320, width: '100%', boxShadow: '0 8px 32px rgba(0,0,0,0.2)',
                  }} onClick={(e) => e.stopPropagation()}>
                    <div style={{ fontSize: 15, fontWeight: 600, marginBottom: 12, color: 'var(--text-primary)' }}>
                      重命名对话窗口
                    </div>
                    <input
                      type="text"
                      value={renameInput}
                      onChange={(e) => setRenameInput(e.target.value)}
                      onKeyDown={(e) => { if (e.key === 'Enter') handleSaveRename(); if (e.key === 'Escape') { setRenameWindowId(null); setRenameInput(''); } }}
                      placeholder="输入新名称..."
                      autoFocus
                      style={{
                        width: '100%', padding: '8px 12px',
                        border: '1px solid var(--border-color)', borderRadius: 8,
                        background: 'var(--bg-secondary)', color: 'var(--text-primary)',
                        fontSize: 14, outline: 'none',
                      }}
                    />
                    <div style={{ display: 'flex', gap: 8, justifyContent: 'flex-end', marginTop: 16 }}>
                      <button
                        onClick={() => { setRenameWindowId(null); setRenameInput(''); }}
                        style={{
                          padding: '6px 16px', borderRadius: 6,
                          border: '1px solid var(--border-light)', background: 'transparent',
                          color: 'var(--text-secondary)', cursor: 'pointer', fontSize: 13,
                        }}
                      >
                        取消
                      </button>
                      <button
                        onClick={handleSaveRename}
                        style={{
                          padding: '6px 16px', borderRadius: 6,
                          border: 'none', background: 'var(--primary-color)',
                          color: '#fff', cursor: 'pointer', fontSize: 13,
                        }}
                      >
                        保存
                      </button>
                    </div>
                  </div>
                </div>
              )}
            </div>
            <div style={{ display: 'flex', alignItems: 'center', gap: 6, padding: '4px 12px', flexShrink: 0 }}>
              <Select value={currentProvider} onChange={(val) => saveSettings({ aiDefaultProvider: val as any, aiDefaultModel: '' })}
                size="small" style={{ width: 100 }}
                options={[
                  { label: 'OpenAI', value: 'openai' }, { label: 'Anthropic', value: 'anthropic' },
                  { label: 'DeepSeek', value: 'deepseek' }, { label: '自定义', value: 'custom' },
                ]} popupMatchSelectWidth={false} />
              <Select value={currentModel} onChange={(val) => saveSettings({ aiDefaultModel: val })}
                size="small" style={{ width: 140 }} options={getModelOptions()}
                showSearch placeholder="选择模型" notFoundContent={null} popupMatchSelectWidth={false} />
              {realtimeStats && (
                <Tooltip title={`今日: ${realtimeStats.total_tokens} tokens · ${realtimeStats.total_requests} 次请求 · ${realtimeStats.cache_hits} 次缓存命中`}>
                  <div style={{
                    display: 'flex', alignItems: 'center', gap: 6,
                    padding: '4px 10px', borderRadius: 6,
                    background: 'var(--bg-tertiary)', fontSize: 11,
                    color: 'var(--text-tertiary)', cursor: 'default',
                  }}>
                    <span>🔥 {formatTokenCount(realtimeStats.total_tokens)}</span>
                    <span style={{ width: 1, height: 12, background: 'var(--border-light)' }} />
                    <span>💬 {realtimeStats.total_requests}</span>
                    {realtimeStats.cache_hits > 0 && (
                      <>
                        <span style={{ width: 1, height: 12, background: 'var(--border-light)' }} />
                        <span style={{ color: '#52c41a' }}>⚡ {realtimeStats.cache_hits}</span>
                      </>
                    )}
                  </div>
                </Tooltip>
              )}
            </div>
          </div>

          {/* 内容区域 */}
          {activeTab === 'chat' ? (
            <div style={{ flex: 1, display: 'flex', flexDirection: 'column', minHeight: 0 }}>
              {/* 搜索框（可折叠） */}
              <AnimatePresence>
                {searchVisible && (
                  <motion.div
                    initial={{ height: 0, opacity: 0 }}
                    animate={{ height: 'auto', opacity: 1 }}
                    exit={{ height: 0, opacity: 0 }}
                    transition={{ duration: 0.15 }}
                    style={{ overflow: 'hidden', borderBottom: '1px solid var(--border-light)', flexShrink: 0 }}
                  >
                    <div style={{ display: 'flex', alignItems: 'center', gap: 8, padding: '8px 12px', background: 'var(--bg-secondary)' }}>
                      <div style={{ position: 'relative', flex: 1 }}>
                        <Search size={14} style={{ position: 'absolute', left: 10, top: '50%', transform: 'translateY(-50%)', color: 'var(--text-tertiary)' }} />
                        <input
                          type="text"
                          value={searchKeyword}
                          onChange={(e) => { setSearchKeyword(e.target.value); setCurrentMatchIndex(0); }}
                          onKeyDown={handleSearchKeyDown}
                          placeholder="搜索对话内容..."
                          autoFocus
                          style={{
                            width: '100%', padding: '6px 10px 6px 32px',
                            border: '1px solid var(--border-color)', borderRadius: 8,
                            background: 'var(--bg-primary)', color: 'var(--text-primary)',
                            fontSize: 13, outline: 'none',
                          }}
                        />
                      </div>
                      {searchKeyword.trim() && (
                        <span style={{ fontSize: 12, color: 'var(--text-tertiary)', whiteSpace: 'nowrap', minWidth: 80, textAlign: 'center' }}>
                          {searchMatches.length > 0
                            ? `${currentMatchIndex + 1} / ${searchMatches.length}`
                            : '无匹配'}
                        </span>
                      )}
                      <div style={{ display: 'flex', gap: 2 }}>
                        <button
                          onClick={() => setCurrentMatchIndex(prev => (prev - 1 + searchMatches.length) % searchMatches.length)}
                          disabled={searchMatches.length === 0}
                          style={{
                            background: 'none', border: '1px solid var(--border-light)', cursor: searchMatches.length > 0 ? 'pointer' : 'not-allowed',
                            color: 'var(--text-secondary)', padding: 4, borderRadius: 4, display: 'flex', alignItems: 'center',
                            opacity: searchMatches.length > 0 ? 1 : 0.4,
                          }}
                          title="上一个匹配"
                        >
                          <ChevronUp size={14} />
                        </button>
                        <button
                          onClick={() => setCurrentMatchIndex(prev => (prev + 1) % searchMatches.length)}
                          disabled={searchMatches.length === 0}
                          style={{
                            background: 'none', border: '1px solid var(--border-light)', cursor: searchMatches.length > 0 ? 'pointer' : 'not-allowed',
                            color: 'var(--text-secondary)', padding: 4, borderRadius: 4, display: 'flex', alignItems: 'center',
                            opacity: searchMatches.length > 0 ? 1 : 0.4,
                          }}
                          title="下一个匹配"
                        >
                          <ChevronDown size={14} />
                        </button>
                      </div>
                      <button
                        onClick={() => { setSearchVisible(false); setSearchKeyword(''); setCurrentMatchIndex(0); }}
                        style={{
                          background: 'none', border: 'none', cursor: 'pointer',
                          color: 'var(--text-tertiary)', padding: 4, borderRadius: 4, display: 'flex', alignItems: 'center',
                        }}
                        title="关闭搜索"
                      >
                        <X size={14} />
                      </button>
                    </div>

                    {/* 右键菜单 */}
                    <AnimatePresence>
                      {sidebarContextMenu && (
                        <motion.div
                          initial={{ opacity: 0, scale: 0.9 }}
                          animate={{ opacity: 1, scale: 1 }}
                          exit={{ opacity: 0, scale: 0.9 }}
                          transition={{ duration: 0.1 }}
                          onClick={() => setSidebarContextMenu(null)}
                          style={{
                            position: 'fixed',
                            left: sidebarContextMenu.x,
                            top: sidebarContextMenu.y,
                            background: 'var(--bg-primary)',
                            border: '1px solid var(--border-light)',
                            borderRadius: 8,
                            boxShadow: '0 4px 16px rgba(0,0,0,0.12)',
                            padding: '4px 0',
                            minWidth: 150,
                            zIndex: 1000,
                          }}
                        >
                          <button
                            onClick={() => {
                              const win = chatWindows.find(w => w.id === sidebarContextMenu.windowId);
                              if (win) pinWindow(win.id, !win.isPinned);
                              setSidebarContextMenu(null);
                            }}
                            style={{
                              display: 'flex', alignItems: 'center', gap: 8, width: '100%',
                              padding: '8px 14px', border: 'none', background: 'none',
                              color: 'var(--text-primary)', fontSize: 13, cursor: 'pointer',
                            }}
                            onMouseEnter={(e) => { (e.currentTarget as HTMLElement).style.background = 'var(--bg-tertiary)'; }}
                            onMouseLeave={(e) => { (e.currentTarget as HTMLElement).style.background = 'none'; }}
                          >
                            <Pin size={14} style={{ color: 'var(--text-secondary)' }} />
                            <span>{chatWindows.find(w => w.id === sidebarContextMenu?.windowId)?.isPinned ? '取消置顶' : '置顶'}</span>
                          </button>
                          <button
                            onClick={() => {
                              const win = chatWindows.find(w => w.id === sidebarContextMenu.windowId);
                              if (win) archiveWindow(win.id, !win.isArchived);
                              setSidebarContextMenu(null);
                            }}
                            style={{
                              display: 'flex', alignItems: 'center', gap: 8, width: '100%',
                              padding: '8px 14px', border: 'none', background: 'none',
                              color: 'var(--text-primary)', fontSize: 13, cursor: 'pointer',
                            }}
                            onMouseEnter={(e) => { (e.currentTarget as HTMLElement).style.background = 'var(--bg-tertiary)'; }}
                            onMouseLeave={(e) => { (e.currentTarget as HTMLElement).style.background = 'none'; }}
                          >
                            <Archive size={14} style={{ color: 'var(--text-secondary)' }} />
                            <span>{chatWindows.find(w => w.id === sidebarContextMenu?.windowId)?.isArchived ? '取消归档' : '归档'}</span>
                          </button>
                          <div style={{ height: 1, background: 'var(--border-light)', margin: '4px 0' }} />
                          <button
                            onClick={() => {
                              closeWindow(sidebarContextMenu.windowId);
                              setSidebarContextMenu(null);
                            }}
                            style={{
                              display: 'flex', alignItems: 'center', gap: 8, width: '100%',
                              padding: '8px 14px', border: 'none', background: 'none',
                              color: '#ff4d4f', fontSize: 13, cursor: 'pointer',
                            }}
                            onMouseEnter={(e) => { (e.currentTarget as HTMLElement).style.background = 'rgba(255,77,79,0.08)'; }}
                            onMouseLeave={(e) => { (e.currentTarget as HTMLElement).style.background = 'none'; }}
                          >
                            <Trash2 size={14} />
                            <span>删除</span>
                          </button>
                        </motion.div>
                      )}
                    </AnimatePresence>
                  </motion.div>
                )}
              </AnimatePresence>

              {/* 搜索触发按钮（搜索框关闭时显示） */}
              {!searchVisible && messages.length > 0 && (
                <div style={{ display: 'flex', justifyContent: 'flex-end', gap: 8, padding: '4px 12px 0', flexShrink: 0 }}>
                  <button
                    onClick={() => setMultiSelectMode(!multiSelectMode)}
                    style={{
                      background: multiSelectMode ? 'var(--primary-bg)' : 'none',
                      border: multiSelectMode ? '1px solid var(--primary-color)' : '1px solid var(--border-light)',
                      cursor: 'pointer',
                      color: multiSelectMode ? 'var(--primary-color)' : 'var(--text-tertiary)',
                      padding: '3px 8px', borderRadius: 6,
                      display: 'flex', alignItems: 'center', gap: 4, fontSize: 12,
                      transition: 'all 0.15s ease',
                    }}
                    title="跨对话多选模式 - 可选择多个对话的消息进行整合分享"
                  >
                    <CheckSquare size={13} />
                    <span>{multiSelectMode ? '退出多选' : '多选分享'}</span>
                  </button>
                  <button
                    onClick={() => setSearchVisible(true)}
                    style={{
                      background: 'none', border: '1px solid var(--border-light)', cursor: 'pointer',
                      color: 'var(--text-tertiary)', padding: '3px 8px', borderRadius: 6,
                      display: 'flex', alignItems: 'center', gap: 4, fontSize: 12,
                      transition: 'all 0.15s ease',
                    }}
                    onMouseEnter={(e) => { (e.currentTarget as HTMLElement).style.color = 'var(--primary-color)'; (e.currentTarget as HTMLElement).style.borderColor = 'var(--primary-color)'; }}
                    onMouseLeave={(e) => { (e.currentTarget as HTMLElement).style.color = 'var(--text-tertiary)'; (e.currentTarget as HTMLElement).style.borderColor = 'var(--border-light)'; }}
                    title="搜索对话内容 (Ctrl+F)"
                  >
                    <Search size={13} />
                    <span>搜索</span>
                  </button>
                </div>
              )}

              {/* 消息列表区域（带时间轴） */}
              <div style={{ flex: 1, display: 'flex', minHeight: 0, position: 'relative' }}>
                {/* 左侧面板 - 可折叠的对话历史 + 节点轴 */}
                <AnimatePresence mode="wait">
                {!sidebarCollapsed ? (
                  <motion.div
                    key="expanded"
                    initial={{ width: 0, opacity: 0 }}
                    animate={{ width: 200, opacity: 1 }}
                    exit={{ width: 0, opacity: 0 }}
                    transition={{ duration: 0.2, ease: 'easeInOut' }}
                    style={{
                      flexShrink: 0,
                      borderRight: '1px solid var(--border-light)',
                      background: 'var(--bg-secondary)',
                      display: 'flex', flexDirection: 'column',
                      overflow: 'hidden',
                    }}
                  >
                    {/* 时间轴头部 */}
                    <div style={{
                      padding: '10px 12px',
                      borderBottom: '1px solid var(--border-light)',
                      display: 'flex', alignItems: 'center',
                      justifyContent: 'space-between',
                      flexShrink: 0,
                    }}>
                      <span style={{ fontSize: 13, fontWeight: 600, color: 'var(--text-primary)' }}>
                        对话历史
                      </span>
                      <div style={{ display: 'flex', alignItems: 'center', gap: 4 }}>
                        <Tooltip title="搜索对话">
                          <button
                            onClick={() => setSidebarSearchVisible(!sidebarSearchVisible)}
                            style={{
                              width: 24, height: 24, borderRadius: 6,
                              border: 'none', background: sidebarSearchVisible ? 'var(--primary-bg)' : 'transparent',
                              color: sidebarSearchVisible ? 'var(--primary-color)' : 'var(--text-tertiary)',
                              cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center',
                            }}
                          >
                            <Search size={13} />
                          </button>
                        </Tooltip>
                        {multiSelectMode && totalSelectedCount > 0 && (
                        <div style={{ position: 'relative' }}>
                          <button
                            onClick={(e) => { e.stopPropagation(); setCrossWindowShareMenuVisible(!crossWindowShareMenuVisible); }}
                            style={{
                              padding: '3px 8px', borderRadius: 6,
                              border: 'none', background: 'var(--primary-color)',
                              color: '#fff', cursor: 'pointer', fontSize: 11,
                              display: 'flex', alignItems: 'center', gap: 4,
                            }}
                          >
                            <Share2 size={12} />
                            分享 ({totalSelectedCount})
                          </button>
                          <AnimatePresence>
                            {crossWindowShareMenuVisible && (
                              <motion.div
                                initial={{ opacity: 0, scale: 0.9, y: -4 }}
                                animate={{ opacity: 1, scale: 1, y: 0 }}
                                exit={{ opacity: 0, scale: 0.9, y: -4 }}
                                transition={{ duration: 0.1 }}
                                onClick={(e) => e.stopPropagation()}
                                style={{
                                  position: 'absolute', top: '100%', right: 0, marginTop: 4,
                                  background: 'var(--bg-primary)', border: '1px solid var(--border-light)',
                                  borderRadius: 8, boxShadow: '0 4px 16px rgba(0,0,0,0.12)',
                                  padding: '4px 0', minWidth: 160, zIndex: 100,
                                }}
                              >
                                <button
                                  onClick={handleCrossWindowCopyMarkdown}
                                  style={{
                                    display: 'flex', alignItems: 'center', gap: 8, width: '100%',
                                    padding: '8px 14px', border: 'none', background: 'none',
                                    color: 'var(--text-primary)', fontSize: 13, cursor: 'pointer',
                                  }}
                                >
                                  <Copy size={14} style={{ color: 'var(--text-secondary)' }} />
                                  <span>复制为 Markdown</span>
                                </button>
                                <button
                                  onClick={handleCrossWindowExportImage}
                                  style={{
                                    display: 'flex', alignItems: 'center', gap: 8, width: '100%',
                                    padding: '8px 14px', border: 'none', background: 'none',
                                    color: 'var(--text-primary)', fontSize: 13, cursor: 'pointer',
                                  }}
                                >
                                  <Download size={14} style={{ color: 'var(--text-secondary)' }} />
                                  <span>导出为图片</span>
                                </button>
                              </motion.div>
                            )}
                          </AnimatePresence>
                        </div>
                      )}
                      </div>
                    </div>

                    {/* 搜索框 */}
                    <AnimatePresence>
                      {sidebarSearchVisible && (
                        <motion.div
                          initial={{ height: 0, opacity: 0 }}
                          animate={{ height: 'auto', opacity: 1 }}
                          exit={{ height: 0, opacity: 0 }}
                          transition={{ duration: 0.15 }}
                          style={{ overflow: 'hidden', borderBottom: '1px solid var(--border-light)' }}
                        >
                          <div style={{ padding: '6px 10px', display: 'flex', alignItems: 'center', gap: 6, background: 'var(--bg-tertiary)' }}>
                            <Search size={13} style={{ color: 'var(--text-tertiary)', flexShrink: 0 }} />
                            <input
                              type="text"
                              value={sidebarSearchQuery}
                              onChange={(e) => setSidebarSearchQuery(e.target.value)}
                              placeholder="搜索对话..."
                              autoFocus
                              style={{
                                border: 'none', background: 'transparent', outline: 'none',
                                fontSize: 12, color: 'var(--text-primary)', width: '100%',
                              }}
                            />
                            {sidebarSearchQuery && (
                              <button
                                onClick={() => setSidebarSearchQuery('')}
                                style={{ border: 'none', background: 'none', cursor: 'pointer', color: 'var(--text-tertiary)', padding: 0, display: 'flex' }}
                              >
                                <X size={12} />
                              </button>
                            )}
                          </div>
                        </motion.div>
                      )}
                    </AnimatePresence>
                    
                    {/* 时间轴内容 */}
                    <div style={{ flex: 1, overflowY: 'auto', padding: '8px 0' }}>
                      {(() => {
                        // 按日期分组窗口
                        const dateGroups: { date: string; dateLabel: string; windows: ChatWindow[] }[] = [];
                        const sortedWindows = [...chatWindows]
                          .filter(win => {
                            if (!sidebarSearchQuery) return true;
                            const q = sidebarSearchQuery.toLowerCase();
                            return win.title.toLowerCase().includes(q) || win.messages.some(m => typeof m.content === 'string' && m.content.toLowerCase().includes(q));
                          })
                          .sort((a, b) => {
                            if (a.isPinned && !b.isPinned) return -1;
                            if (!a.isPinned && b.isPinned) return 1;
                            return b.updatedAt - a.updatedAt;
                          });
                        
                        sortedWindows.forEach(win => {
                          const date = new Date(win.updatedAt);
                          const dateStr = `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}-${String(date.getDate()).padStart(2, '0')}`;
                          const dateLabel = formatDateLabel(win.updatedAt);
                          
                          const existingGroup = dateGroups.find(g => g.date === dateStr);
                          if (existingGroup) {
                            existingGroup.windows.push(win);
                          } else {
                            dateGroups.push({ date: dateStr, dateLabel, windows: [win] });
                          }
                        });
                        
                        return dateGroups.map((group) => (
                          <div key={group.date} style={{ marginBottom: 8 }}>
                            {/* 日期标题 */}
                            <div style={{
                              padding: '6px 12px',
                              fontSize: 11,
                              fontWeight: 600,
                              color: 'var(--text-tertiary)',
                              background: 'var(--bg-tertiary)',
                              position: 'sticky',
                              top: 0,
                              zIndex: 1,
                            }}>
                              {group.dateLabel}
                            </div>
                            
                            {/* 该日期下的对话窗口 */}
                            {group.windows.map((win) => {
                              const isActive = activeWindowId === win.id;
                              const selectedInWindow = selectedMessages.get(win.id);
                              const selectedCount = selectedInWindow?.size || 0;
                              
                              return (
                                <div key={win.id}>
                                  {/* 对话窗口项 */}
                                  <div
                                    onClick={() => switchWindow(win.id)}
                                    onContextMenu={(e) => {
                                      e.preventDefault();
                                      setSidebarContextMenu({ windowId: win.id, x: e.clientX, y: e.clientY });
                                    }}
                                    style={{
                                      padding: '8px 12px',
                                      cursor: 'pointer',
                                      background: isActive ? 'var(--primary-bg)' : 'transparent',
                                      borderLeft: isActive ? '3px solid var(--primary-color)' : '3px solid transparent',
                                      transition: 'all 0.15s ease',
                                    }}
                                  >
                                    <div style={{
                                      display: 'flex',
                                      alignItems: 'center',
                                      justifyContent: 'space-between',
                                      marginBottom: 4,
                                    }}>
                                      <div style={{ display: 'flex', alignItems: 'center', gap: 4, flex: 1, minWidth: 0 }}>
                                        {win.isPinned && <Pin size={10} style={{ color: 'var(--primary-color)', flexShrink: 0, transform: 'rotate(45deg)' }} />}
                                        <span style={{
                                          fontSize: 12,
                                          fontWeight: isActive ? 600 : 400,
                                          color: isActive ? 'var(--primary-color)' : 'var(--text-primary)',
                                          overflow: 'hidden',
                                          textOverflow: 'ellipsis',
                                          whiteSpace: 'nowrap',
                                        }}>
                                          {win.title}
                                        </span>
                                      </div>
                                      <span style={{
                                        fontSize: 10,
                                        color: 'var(--text-tertiary)',
                                        flexShrink: 0,
                                        marginLeft: 4,
                                      }}>
                                        {formatTime(win.updatedAt)}
                                      </span>
                                    </div>
                                    <div style={{
                                      display: 'flex',
                                      alignItems: 'center',
                                      justifyContent: 'space-between',
                                    }}>
                                      <span style={{
                                        fontSize: 10,
                                        color: 'var(--text-tertiary)',
                                      }}>
                                        {win.messages.length} 条消息
                                      </span>
                                      {selectedCount > 0 && (
                                        <span style={{
                                          fontSize: 10,
                                          color: 'var(--primary-color)',
                                          background: 'var(--primary-bg)',
                                          padding: '1px 6px',
                                          borderRadius: 8,
                                        }}>
                                          已选 {selectedCount}
                                        </span>
                                      )}
                                    </div>
                                  </div>
                                  
                                  {/* 多选模式下展开消息列表 */}
                                  {multiSelectMode && win.messages.length > 0 && (
                                    <div style={{
                                      padding: '4px 12px 8px 20px',
                                      background: isActive ? 'var(--primary-bg)' : 'var(--bg-tertiary)',
                                    }}>
                                      {/* 全选/取消按钮 */}
                                      <div style={{
                                        display: 'flex',
                                        gap: 4,
                                        marginBottom: 6,
                                      }}>
                                        <button
                                          onClick={(e) => { e.stopPropagation(); selectAllInWindow(win.id); }}
                                          style={{
                                            fontSize: 10,
                                            padding: '2px 6px',
                                            border: '1px solid var(--border-light)',
                                            borderRadius: 4,
                                            background: 'transparent',
                                            color: 'var(--text-secondary)',
                                            cursor: 'pointer',
                                          }}
                                        >
                                          全选
                                        </button>
                                        {selectedCount > 0 && (
                                          <button
                                            onClick={(e) => { e.stopPropagation(); clearWindowSelection(win.id); }}
                                            style={{
                                              fontSize: 10,
                                              padding: '2px 6px',
                                              border: '1px solid var(--border-light)',
                                              borderRadius: 4,
                                              background: 'transparent',
                                              color: 'var(--text-secondary)',
                                              cursor: 'pointer',
                                            }}
                                          >
                                            取消
                                          </button>
                                        )}
                                      </div>
                                      
                                      {/* 消息列表 */}
                                      {win.messages.slice(-5).map((msg, idx) => {
                                        const realIdx = win.messages.length - 5 + idx;
                                        const isSelected = selectedInWindow?.has(realIdx);
                                        const contentPreview = extractTextContent(msg.content).slice(0, 30);
                                        
                                        return (
                                          <div
                                            key={realIdx}
                                            onClick={(e) => { e.stopPropagation(); toggleCrossWindowMessageSelection(win.id, realIdx); }}
                                            style={{
                                              display: 'flex',
                                              alignItems: 'center',
                                              gap: 6,
                                              padding: '4px 6px',
                                              marginBottom: 2,
                                              borderRadius: 4,
                                              cursor: 'pointer',
                                              background: isSelected ? 'var(--primary-bg)' : 'transparent',
                                              transition: 'all 0.1s ease',
                                            }}
                                          >
                                            {/* 勾选框 */}
                                            <div style={{
                                              width: 14,
                                              height: 14,
                                              borderRadius: 3,
                                              border: isSelected ? 'none' : '1px solid var(--border-color)',
                                              background: isSelected ? 'var(--primary-color)' : 'transparent',
                                              display: 'flex',
                                              alignItems: 'center',
                                              justifyContent: 'center',
                                              flexShrink: 0,
                                            }}>
                                              {isSelected && <Check size={10} color="#fff" />}
                                            </div>
                                            
                                            {/* 消息预览 */}
                                            <div style={{
                                              flex: 1,
                                              minWidth: 0,
                                              display: 'flex',
                                              alignItems: 'center',
                                              gap: 4,
                                            }}>
                                              <span style={{
                                                fontSize: 9,
                                                color: msg.role === 'user' ? 'var(--primary-color)' : 'var(--text-secondary)',
                                                flexShrink: 0,
                                              }}>
                                                {msg.role === 'user' ? '👤' : '🤖'}
                                              </span>
                                              <span style={{
                                                fontSize: 10,
                                                color: 'var(--text-secondary)',
                                                overflow: 'hidden',
                                                textOverflow: 'ellipsis',
                                                whiteSpace: 'nowrap',
                                              }}>
                                                {contentPreview || '...'}
                                              </span>
                                            </div>
                                          </div>
                                        );
                                      })}
                                      
                                      {win.messages.length > 5 && (
                                        <div style={{
                                          fontSize: 10,
                                          color: 'var(--text-tertiary)',
                                          padding: '4px 6px',
                                        }}>
                                          还有 {win.messages.length - 5} 条消息...
                                        </div>
                                      )}
                                    </div>
                                  )}
                                </div>
                              );
                            })}
                          </div>
                        ));
                      })()}
                    </div>
                    
                    {/* 新建对话按钮 */}
                    <div style={{
                      padding: '8px 12px',
                      borderTop: '1px solid var(--border-light)',
                      flexShrink: 0,
                    }}>
                      <button
                        onClick={() => createWindow()}
                        style={{
                          width: '100%',
                          padding: '8px 12px',
                          borderRadius: 8,
                          border: '1px dashed var(--border-color)',
                          background: 'transparent',
                          color: 'var(--text-secondary)',
                          cursor: 'pointer',
                          fontSize: 12,
                          display: 'flex',
                          alignItems: 'center',
                          justifyContent: 'center',
                          gap: 4,
                          transition: 'all 0.15s ease',
                        }}
                      >
                        <Plus size={14} />
                        新建对话
                      </button>
                    </div>
                  </motion.div>
                ) : (
                  <motion.div
                    key="collapsed"
                    initial={{ width: 0, opacity: 0 }}
                    animate={{ width: 36, opacity: 1 }}
                    exit={{ width: 0, opacity: 0 }}
                    transition={{ duration: 0.2, ease: 'easeInOut' }}
                    style={{
                      flexShrink: 0,
                      borderRight: '1px solid var(--border-light)',
                      background: 'var(--bg-secondary)',
                      display: 'flex',
                      flexDirection: 'column',
                      alignItems: 'center',
                      paddingTop: 8,
                      gap: 4,
                      overflow: 'hidden',
                    }}
                  >
                    {/* 折叠状态：显示对话窗口图标列表 */}
                    {chatWindows.map((win) => {
                      const isActive = activeWindowId === win.id;
                      return (
                        <Tooltip key={win.id} title={win.title} placement="right">
                          <button
                            onClick={() => switchWindow(win.id)}
                            style={{
                              width: 28,
                              height: 28,
                              borderRadius: 6,
                              border: 'none',
                              background: isActive ? 'var(--primary-bg)' : 'transparent',
                              color: isActive ? 'var(--primary-color)' : 'var(--text-tertiary)',
                              cursor: 'pointer',
                              display: 'flex',
                              alignItems: 'center',
                              justifyContent: 'center',
                              transition: 'all 0.15s ease',
                            }}
                          >
                            <MessageSquare size={14} />
                          </button>
                        </Tooltip>
                      );
                    })}
                    <Tooltip title="新建对话" placement="right">
                      <button
                        onClick={() => createWindow()}
                        style={{
                          width: 28,
                          height: 28,
                          borderRadius: 6,
                          border: '1px dashed var(--border-color)',
                          background: 'transparent',
                          color: 'var(--text-tertiary)',
                          cursor: 'pointer',
                          display: 'flex',
                          alignItems: 'center',
                          justifyContent: 'center',
                        }}
                      >
                        <Plus size={14} />
                      </button>
                    </Tooltip>
                  </motion.div>
                )}
                </AnimatePresence>

                {/* 折叠/展开切换按钮 */}
                <div style={{
                  position: 'absolute',
                  left: sidebarCollapsed ? 36 : 200,
                  top: '50%',
                  transform: 'translateY(-50%)',
                  zIndex: 10,
                  transition: 'left 0.2s ease',
                }}>
                  <button
                    onClick={() => setSidebarCollapsed(!sidebarCollapsed)}
                    style={{
                      width: 20,
                      height: 48,
                      borderRadius: '0 6px 6px 0',
                      border: '1px solid var(--border-light)',
                      borderLeft: 'none',
                      background: 'var(--bg-secondary)',
                      color: 'var(--text-tertiary)',
                      cursor: 'pointer',
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'center',
                      padding: 0,
                      transition: 'all 0.15s ease',
                    }}
                    onMouseEnter={(e) => { (e.currentTarget as HTMLElement).style.color = 'var(--primary-color)'; (e.currentTarget as HTMLElement).style.background = 'var(--primary-bg)'; }}
                    onMouseLeave={(e) => { (e.currentTarget as HTMLElement).style.color = 'var(--text-tertiary)'; (e.currentTarget as HTMLElement).style.background = 'var(--bg-secondary)'; }}
                  >
                    {sidebarCollapsed ? <PanelLeftOpen size={12} /> : <PanelLeftClose size={12} />}
                  </button>
                </div>

                {/* 消息内容区域（带节点轴） */}
                <div style={{ flex: 1, display: 'flex', minHeight: 0 }}>
                  {/* 节点轴 - 独立滚动区域 */}
                  {chatNodes.length > 0 && (
                    <div 
                      ref={nodeAxisRef}
                      style={{
                        width: 44,
                        flexShrink: 0,
                        overflowY: 'auto',
                        overflowX: 'hidden',
                        borderRight: '1px solid var(--border-light)',
                        background: 'var(--bg-secondary)',
                      }}
                    >
                      <div style={{
                        display: 'flex',
                        flexDirection: 'column',
                        alignItems: 'center',
                        paddingTop: 20,
                        paddingBottom: 20,
                        minHeight: '100%',
                        position: 'relative',
                      }}>
                        {/* 竖线 */}
                        <div style={{
                          position: 'absolute',
                          top: 28,
                          bottom: 28,
                          left: '50%',
                          width: 2,
                          background: 'var(--border-light)',
                          transform: 'translateX(-50%)',
                        }} />
                        {/* 节点圆点 - 按节点渲染 */}
                        {chatNodes.map((node) => {
                          const isHovered = hoveredNodeIndex === node.nodeIndex;
                          return (
                            <Tooltip
                              key={`node-${node.nodeIndex}`}
                              title={
                                <div style={{ maxWidth: 260 }}>
                                  {node.userPreview && (
                                    <div style={{ marginBottom: 6, fontSize: 12 }}>
                                      <div style={{ fontWeight: 600, color: 'var(--primary-color)', marginBottom: 2, fontSize: 11 }}>👤 用户</div>
                                      <div style={{ color: 'var(--text-primary)', lineHeight: 1.4 }}>{node.userPreview}</div>
                                    </div>
                                  )}
                                  {node.aiPreview && (
                                    <div style={{ fontSize: 12 }}>
                                      <div style={{ fontWeight: 600, color: '#8b5cf6', marginBottom: 2, fontSize: 11 }}>🤖 AI</div>
                                      <div style={{ color: 'var(--text-primary)', lineHeight: 1.4 }}>{node.aiPreview}</div>
                                    </div>
                                  )}
                                  <div style={{ fontSize: 10, color: 'var(--text-tertiary)', marginTop: 4, borderTop: '1px solid var(--border-light)', paddingTop: 4 }}>
                                    {formatTime(node.timestamp)}
                                  </div>
                                </div>
                              }
                              placement="right"
                              overlayStyle={{ maxWidth: 300 }}
                            >
                              <button
                                onClick={() => handleNodeClick(node)}
                                onMouseEnter={() => setHoveredNodeIndex(node.nodeIndex)}
                                onMouseLeave={() => setHoveredNodeIndex(null)}
                                style={{
                                  width: isHovered ? 16 : 12,
                                  height: isHovered ? 16 : 12,
                                  borderRadius: '50%',
                                  border: isHovered ? 'none' : '2px solid var(--border-color)',
                                  background: isHovered ? 'var(--primary-color)' : 'var(--bg-primary)',
                                  cursor: 'pointer',
                                  margin: '10px 0',
                                  display: 'flex',
                                  alignItems: 'center',
                                  justifyContent: 'center',
                                  transition: 'all 0.15s ease',
                                  position: 'relative',
                                  zIndex: 1,
                                  flexShrink: 0,
                                  padding: 0,
                                }}
                              >
                                {isHovered && <div style={{ width: 6, height: 6, borderRadius: '50%', background: '#fff' }} />}
                              </button>
                            </Tooltip>
                          );
                        })}
                      </div>
                    </div>
                  )}

                  <div className="selectable" ref={messagesContainerRef} style={{ flex: 1, overflowY: 'auto', padding: '12px 0' }}>
                {messages.length === 0 && !isGenerating && (
                  <div style={{
                    display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center',
                    height: '100%', padding: 40,
                  }}>
                    <div style={{
                      width: 72, height: 72, borderRadius: '50%',
                      background: 'linear-gradient(135deg, var(--primary-color), #8b5cf6)',
                      display: 'flex', alignItems: 'center', justifyContent: 'center',
                      marginBottom: 16,
                      boxShadow: '0 8px 32px rgba(99,102,241,0.3)',
                    }}>
                      <Bot size={36} style={{ color: '#fff' }} />
                    </div>
                    <div style={{ fontSize: 20, fontWeight: 600, color: 'var(--text-primary)', marginBottom: 8 }}>
                      脑洞集 AI 助手
                    </div>
                    <div style={{
                      fontSize: 13, color: 'var(--text-tertiary)', marginBottom: 32,
                      textAlign: 'center', maxWidth: 400, lineHeight: 1.6,
                    }}>
                      我可以帮你管理创意、写作、搜索资料、分析数据，<br/>还能调用各种工具完成复杂任务
                    </div>
                    <div style={{
                      display: 'grid', gridTemplateColumns: 'repeat(2, 1fr)',
                      gap: 12, maxWidth: 500, width: '100%',
                    }}>
                      {[
                        { icon: '💡', title: '创意灵感', desc: '帮我头脑风暴一些创意' },
                        { icon: '📝', title: '内容写作', desc: '帮我写一篇文章' },
                        { icon: '🔍', title: '联网搜索', desc: '搜索最新的 AI 新闻' },
                        { icon: '📊', title: '数据分析', desc: '分析我的创作数据' },
                      ].map(item => (
                        <motion.div
                          key={item.title}
                          whileHover={{ scale: 1.02, borderColor: 'var(--primary-color)' }}
                          whileTap={{ scale: 0.98 }}
                          onClick={() => { setInputValue(item.desc); setTimeout(() => inputRef.current?.focus(), 100); }}
                          style={{
                            padding: 16, borderRadius: 12,
                            border: '1px solid var(--border-light)',
                            background: 'var(--bg-secondary)',
                            cursor: 'pointer', textAlign: 'left',
                            transition: 'border-color 0.15s ease',
                          }}
                        >
                          <div style={{ fontSize: 20, marginBottom: 8 }}>{item.icon}</div>
                          <div style={{ fontSize: 13, fontWeight: 500, color: 'var(--text-primary)', marginBottom: 4 }}>{item.title}</div>
                          <div style={{ fontSize: 11, color: 'var(--text-tertiary)' }}>{item.desc}</div>
                        </motion.div>
                      ))}
                    </div>
                    {webSearchEnabled && (
                      <div style={{ marginTop: 20, fontSize: 11, color: 'var(--primary-color)', display: 'flex', alignItems: 'center', gap: 4 }}>
                        <Globe size={12} />
                        <span>联网搜索已开启</span>
                      </div>
                    )}
                  </div>
                )}
                {/* 历史消息懒加载：隐藏旧消息，显示"查看更多"按钮 */}
                {messages.length > visibleCount && (
                  <div style={{
                    display: 'flex', flexDirection: 'column', alignItems: 'center',
                    padding: '16px 0 8px', gap: 8,
                  }}>
                    <div style={{
                      padding: '8px 20px', borderRadius: 20,
                      background: 'var(--bg-tertiary)', color: 'var(--text-secondary)',
                      fontSize: 12, cursor: 'pointer', border: '1px solid var(--border-light)',
                      transition: 'all 0.15s ease',
                    }}
                      onClick={() => setVisibleCount(prev => prev + LOAD_MORE_COUNT)}
                      onMouseEnter={(e) => {
                        (e.currentTarget as HTMLElement).style.borderColor = 'var(--primary-color)';
                        (e.currentTarget as HTMLElement).style.color = 'var(--primary-color)';
                      }}
                      onMouseLeave={(e) => {
                        (e.currentTarget as HTMLElement).style.borderColor = 'var(--border-light)';
                        (e.currentTarget as HTMLElement).style.color = 'var(--text-secondary)';
                      }}
                    >
                      查看更早的消息（还有 {messages.length - visibleCount} 条）
                    </div>
                    <span style={{ fontSize: 11, color: 'var(--text-quaternary)' }}>
                      为保证流畅度，较早的消息已折叠
                    </span>
                  </div>
                )}
                {messages.slice(Math.max(0, messages.length - visibleCount)).map((msg, idx) => {
                  const originalIdx = messages.length - visibleCount + idx;
                  const elements: React.ReactNode[] = [];
                  // 日期分隔线：如果与前一条消息日期不同，插入分隔线
                  if (idx === 0 || (messageTimestamps[originalIdx] && messageTimestamps[originalIdx - 1] && formatDateLabel(messageTimestamps[originalIdx]) !== formatDateLabel(messageTimestamps[originalIdx - 1]))) {
                    elements.push(
                      <div key={`date-${idx}`} style={{
                        display: 'flex', alignItems: 'center', gap: 12,
                        margin: '8px 16px 12px', color: 'var(--text-tertiary)', fontSize: 12,
                      }}>
                        <div style={{ flex: 1, height: 1, background: 'var(--border-light)' }} />
                        <span style={{ display: 'flex', alignItems: 'center', gap: 4, whiteSpace: 'nowrap' }}>
                          <Clock size={11} />
                          {formatDateLabel(messageTimestamps[originalIdx] || Date.now())}
                        </span>
                        <div style={{ flex: 1, height: 1, background: 'var(--border-light)' }} />
                      </div>
                    );
                  }
                  elements.push(renderMessage(msg, originalIdx));
                  return elements;
                })}

                {/* AI 思考过程时间线 */}
                {(agentIsRunning || isGenerating) && (
                  <div style={{ margin: '0 16px 8px', display: 'flex', alignItems: 'center', gap: 8 }}>
                    <div style={{ width: 6, height: 6, borderRadius: '50%', background: agentIsRunning ? '#a78bfa' : 'var(--primary-color)', animation: 'ai-cursor-blink 1s ease-in-out infinite' }} />
                    <span style={{ fontSize: 11, color: 'var(--text-tertiary)', display: 'flex', alignItems: 'center', gap: 4 }}>
                      <Clock size={10} />
                      {formatTime(Date.now())}
                      {' - '}
                      {agentIsRunning ? (agentStatus === 'thinking' ? '思考中' : agentStatus === 'planning' ? '规划中' : agentStatus === 'executing' ? '执行中' : agentStatus === 'reflecting' ? '总结中' : '处理中') : '生成中'}
                    </span>
                  </div>
                )}
                <ThinkingSection
                  steps={currentReasoningSteps}
                  isThinking={isGenerating}
                  variant="default"
                />

                {isGenerating && streamingText && (() => {
                  const { cleanContent } = extractAndRemoveSongMarks(streamingText);
                  return (
                    <motion.div initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }}
                      style={{ display: 'flex', justifyContent: 'flex-start', marginBottom: 14, padding: '0 16px' }}>
                      <div style={{ width: 30, height: 30, borderRadius: '50%',
                        background: 'linear-gradient(135deg, var(--primary-color), #8b5cf6)',
                        display: 'flex', alignItems: 'center', justifyContent: 'center',
                        marginRight: 8, flexShrink: 0, marginTop: 2,
                        boxShadow: '0 2px 8px rgba(99,102,241,0.3)',
                      }}>
                        <Bot size={16} style={{ color: '#fff' }} />
                      </div>
                      <div style={{ maxWidth: '80%', padding: '10px 14px', borderRadius: '16px 16px 16px 4px', background: 'var(--bg-secondary)', color: 'var(--text-primary)', fontSize: 14, lineHeight: 1.7, wordBreak: 'break-word', boxShadow: 'var(--shadow-sm)' }}>
                        {/* 当前推理过程面板 */}
                        <ThinkingSection
                          steps={currentReasoningSteps}
                          isThinking={isGenerating}
                          variant="default"
                        />
                        <div className="ai-markdown-body">
                          <ReactMarkdown
                            remarkPlugins={[remarkGfm]}
                            components={{
                              code: ({ node, inline, className, children, ...props }: any) => {
                                const match = /language-(\w+)/.exec(className || '');
                                const language = match ? match[1] : '';

                                if (!inline && (className || children?.toString()?.includes('\n'))) {
                                  return (
                                    <div style={{ position: 'relative', margin: '8px 0', borderRadius: 8, overflow: 'hidden', background: '#1e1e2e' }}>
                                      {language && (
                                        <div style={{
                                          padding: '4px 12px', fontSize: 11, color: '#a6adc8',
                                          background: '#181825', borderBottom: '1px solid #313244',
                                          display: 'flex', justifyContent: 'space-between', alignItems: 'center',
                                        }}>
                                          <span>{language}</span>
                                          <button
                                            onClick={() => navigator.clipboard.writeText(children?.toString())}
                                            style={{
                                              background: 'none', border: 'none', color: '#a6adc8',
                                              cursor: 'pointer', fontSize: 11, padding: '2px 6px', borderRadius: 4,
                                            }}
                                            onMouseEnter={(e: any) => (e.target as HTMLElement).style.color = '#cdd6f4'}
                                            onMouseLeave={(e: any) => (e.target as HTMLElement).style.color = '#a6adc8'}
                                          >
                                            复制
                                          </button>
                                        </div>
                                      )}
                                      <pre style={{ margin: 0, padding: '12px 16px', overflowX: 'auto', fontSize: 13, lineHeight: 1.6 }}>
                                        <code className={className} style={{ background: 'transparent', fontSize: 'inherit' }} {...props}>
                                          {children}
                                        </code>
                                      </pre>
                                    </div>
                                  );
                                }
                                return (
                                  <code
                                    style={{
                                      background: 'rgba(0,0,0,0.06)', padding: '2px 6px', borderRadius: 4,
                                      fontSize: '0.9em', fontFamily: 'Menlo, Monaco, Consolas, monospace',
                                    }}
                                    {...props}
                                  >
                                    {children}
                                  </code>
                                );
                              },
                              img: ({ src, alt, ...props }: any) => (
                                <img
                                  src={src}
                                  alt={alt || ''}
                                  style={{ maxWidth: '100%', borderRadius: 8, marginTop: 8, marginBottom: 8, cursor: 'pointer' }}
                                  onClick={() => window.open(src, '_blank')}
                                  {...props}
                                />
                              ),
                            }}
                          >
                            {cleanContent}
                          </ReactMarkdown>
                        </div>
                        <span className="ai-cursor-blink" />
                      </div>
                    </motion.div>
                  );
                })()}

                {error && (
                  <motion.div initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }}
                    style={{ margin: '0 16px 14px', padding: '10px 14px', borderRadius: 8, background: 'rgba(255,77,79,0.1)', color: '#ff4d4f', fontSize: 13, border: '1px solid rgba(255,77,79,0.2)' }}>
                    {error}
                  </motion.div>
                )}
                <div ref={messagesEndRef} />
              </div>
              </div>
              </div>

              {/* 多选模式底部工具栏 */}
              {multiSelectMode && (
                <div style={{
                  display: 'flex', alignItems: 'center', justifyContent: 'space-between',
                  padding: '8px 16px', background: 'var(--bg-secondary)',
                  borderTop: '1px solid var(--border-light)', flexShrink: 0,
                }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                    <span style={{ fontSize: 13, color: 'var(--text-secondary)' }}>
                      已选择 {selectedMessageIndices.size} 条消息
                    </span>
                  </div>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                    <button
                      onClick={selectAllMessages}
                      style={{
                        padding: '4px 12px', borderRadius: 6,
                        border: '1px solid var(--border-light)', background: 'transparent',
                        color: 'var(--text-secondary)', cursor: 'pointer', fontSize: 12,
                      }}
                    >
                      全选
                    </button>
                    <button
                      onClick={clearSelection}
                      style={{
                        padding: '4px 12px', borderRadius: 6,
                        border: '1px solid var(--border-light)', background: 'transparent',
                        color: 'var(--text-secondary)', cursor: 'pointer', fontSize: 12,
                      }}
                    >
                      取消
                    </button>
                    <div style={{ position: 'relative' }}>
                      <button
                        onClick={(e) => { e.stopPropagation(); setMultiShareMenuVisible(!multiShareMenuVisible); }}
                        disabled={selectedMessageIndices.size === 0}
                        style={{
                          padding: '4px 12px', borderRadius: 6,
                          border: 'none', background: selectedMessageIndices.size > 0 ? 'var(--primary-color)' : 'var(--bg-tertiary)',
                          color: selectedMessageIndices.size > 0 ? '#fff' : 'var(--text-tertiary)',
                          cursor: selectedMessageIndices.size > 0 ? 'pointer' : 'not-allowed',
                          fontSize: 12, display: 'flex', alignItems: 'center', gap: 4,
                        }}
                      >
                        <Share2 size={14} />
                        分享
                      </button>
                      <AnimatePresence>
                        {multiShareMenuVisible && selectedMessageIndices.size > 0 && (
                          <motion.div
                            initial={{ opacity: 0, scale: 0.9, y: -4 }}
                            animate={{ opacity: 1, scale: 1, y: 0 }}
                            exit={{ opacity: 0, scale: 0.9, y: -4 }}
                            transition={{ duration: 0.1 }}
                            onClick={(e) => e.stopPropagation()}
                            style={{
                              position: 'absolute', bottom: '100%', right: 0, marginBottom: 4,
                              background: 'var(--bg-primary)', border: '1px solid var(--border-light)',
                              borderRadius: 8, boxShadow: '0 4px 16px rgba(0,0,0,0.12)',
                              padding: '4px 0', minWidth: 160, zIndex: 100,
                            }}
                          >
                            <button
                              onClick={handleMultiCopyMarkdown}
                              style={{
                                display: 'flex', alignItems: 'center', gap: 8, width: '100%',
                                padding: '8px 14px', border: 'none', background: 'none',
                                color: 'var(--text-primary)', fontSize: 13, cursor: 'pointer',
                                transition: 'background 0.1s ease',
                              }}
                              onMouseEnter={(e) => { (e.currentTarget as HTMLElement).style.background = 'var(--bg-secondary)'; }}
                              onMouseLeave={(e) => { (e.currentTarget as HTMLElement).style.background = 'none'; }}
                            >
                              <Copy size={14} style={{ color: 'var(--text-secondary)' }} />
                              <span>复制为 Markdown</span>
                            </button>
                            <button
                              onClick={handleMultiExportImage}
                              style={{
                                display: 'flex', alignItems: 'center', gap: 8, width: '100%',
                                padding: '8px 14px', border: 'none', background: 'none',
                                color: 'var(--text-primary)', fontSize: 13, cursor: 'pointer',
                                transition: 'background 0.1s ease',
                              }}
                              onMouseEnter={(e) => { (e.currentTarget as HTMLElement).style.background = 'var(--bg-secondary)'; }}
                              onMouseLeave={(e) => { (e.currentTarget as HTMLElement).style.background = 'none'; }}
                            >
                              <Download size={14} style={{ color: 'var(--text-secondary)' }} />
                              <span>导出为图片</span>
                            </button>
                          </motion.div>
                        )}
                      </AnimatePresence>
                    </div>
                    <button
                      onClick={exitMultiSelectMode}
                      style={{
                        padding: '4px 8px', borderRadius: 6,
                        border: 'none', background: 'var(--bg-tertiary)',
                        color: 'var(--text-secondary)', cursor: 'pointer', fontSize: 12,
                        display: 'flex', alignItems: 'center',
                      }}
                    >
                      <X size={14} />
                    </button>
                  </div>
                </div>
              )}

              {/* 快捷指令 - 合并为一行可滚动标签 */}
              <div style={{ display: 'flex', gap: 4, padding: '6px 16px', borderTop: '1px solid var(--border-light)', flexShrink: 0, overflowX: 'auto', scrollbarWidth: 'none' }}>
                {[
                  ...QUICK_COMMANDS.map((cmd) => ({ ...cmd, type: 'normal' as const })),
                  ...MUSIC_QUICK_COMMANDS.map((cmd) => ({ ...cmd, type: 'music' as const })),
                  ...AGENT_QUICK_COMMANDS.map((cmd) => ({ ...cmd, type: 'agent' as const })),
                ].map((cmd) => (
                  <button key={cmd.label}
                    onClick={() => handleQuickCommand(cmd.prompt, cmd.type === 'music', cmd.type === 'agent')}
                    disabled={isGenerating || (cmd.type === 'agent' && agentIsRunning)}
                    style={{
                      display: 'flex', alignItems: 'center', gap: 3, padding: '4px 10px',
                      border: cmd.type === 'agent' ? '1px solid var(--primary-color)' : '1px solid var(--border-light)',
                      borderRadius: 10,
                      background: cmd.type === 'agent' ? 'var(--primary-bg)' : cmd.type === 'music' ? 'rgba(139,92,246,0.06)' : 'var(--bg-secondary)',
                      color: cmd.type === 'agent' ? 'var(--primary-color)' : cmd.type === 'music' ? '#8b5cf6' : 'var(--text-secondary)',
                      fontSize: 12, cursor: isGenerating || (cmd.type === 'agent' && agentIsRunning) ? 'not-allowed' : 'pointer',
                      opacity: isGenerating || (cmd.type === 'agent' && agentIsRunning) ? 0.5 : 1,
                      transition: 'all 0.15s ease', whiteSpace: 'nowrap', flexShrink: 0,
                    }}
                    onMouseEnter={(e) => { if (!isGenerating && !(cmd.type === 'agent' && agentIsRunning)) { (e.currentTarget as HTMLElement).style.borderColor = 'var(--primary-color)'; (e.currentTarget as HTMLElement).style.color = 'var(--primary-color)'; } }}
                    onMouseLeave={(e) => { (e.currentTarget as HTMLElement).style.borderColor = cmd.type === 'agent' ? 'var(--primary-color)' : 'var(--border-light)'; (e.currentTarget as HTMLElement).style.color = cmd.type === 'agent' ? 'var(--primary-color)' : cmd.type === 'music' ? '#8b5cf6' : 'var(--text-secondary)'; }}
                  ><span style={{ fontSize: 13 }}>{cmd.icon}</span><span>{cmd.label}</span></button>
                ))}
              </div>

              {/* 输入区域 */}
              <div style={{ padding: '12px 16px', borderTop: '1px solid var(--border-light)', flexShrink: 0 }}>
                {pendingImage && (
                  <div style={{ padding: '0 0 8px', display: 'flex', gap: 8, alignItems: 'center' }}>
                    <img src={pendingImage} alt="待发送图片" style={{ width: 60, height: 60, borderRadius: 8, objectFit: 'cover' }} />
                    <button onClick={() => setPendingImage(null)} style={{
                      background: 'var(--bg-tertiary)', border: 'none', cursor: 'pointer', color: 'var(--text-secondary)',
                      width: 24, height: 24, borderRadius: '50%', display: 'flex', alignItems: 'center', justifyContent: 'center',
                    }}><X size={14} /></button>
                  </div>
                )}
                <div style={{ display: 'flex', gap: 8, alignItems: 'flex-end', position: 'relative' }}>
                  <div style={{ flex: 1, position: 'relative' }}>
                    <textarea
                      ref={inputRef as any}
                      value={inputValue}
                      onChange={(e) => {
                        setInputValue(e.target.value);
                        // 自适应高度
                        const ta = e.target;
                        ta.style.height = 'auto';
                        const newHeight = Math.min(Math.max(ta.scrollHeight, 44), 200);
                        ta.style.height = `${newHeight}px`;
                      }}
                      onKeyDown={handleKeyDown}
                      placeholder={agentModeEnabled ? "Agent 指令... (AI 将自主规划并执行)" : webSearchEnabled ? "输入消息... (联网搜索已开启)" : "输入消息... (Enter 发送, Shift+Enter 换行)"}
                      disabled={isGenerating}
                      rows={1}
                      style={{
                        width: '100%', minHeight: 44, maxHeight: 200,
                        resize: 'none', background: 'var(--bg-secondary)',
                        borderColor: 'var(--border-color)', color: 'var(--text-primary)',
                        borderRadius: 12, padding: '10px 14px', fontSize: 14,
                        lineHeight: 1.5, fontFamily: 'inherit',
                        overflowY: 'auto',
                        outline: 'none',
                        border: '1px solid var(--border-color)',
                        transition: 'border-color 0.15s ease',
                      }}
                      onFocus={(e) => { (e.target as HTMLElement).style.borderColor = 'var(--primary-color)'; }}
                      onBlur={(e) => { (e.target as HTMLElement).style.borderColor = 'var(--border-color)'; }}
                    />
                    {/* 字符计数器 */}
                    {inputValue.length > 0 && (
                      <div style={{
                        position: 'absolute', bottom: 6, right: 10,
                        fontSize: 10, color: 'var(--text-tertiary)', opacity: 0.6,
                        pointerEvents: 'none',
                      }}>
                        {inputValue.length}
                      </div>
                    )}
                  </div>
                  {isVoiceSupported && (
                    <button onClick={toggleListening} title={isListening ? '停止语音输入' : '语音输入'}
                      style={{ width: 38, height: 38, borderRadius: 10, border: 'none', background: isListening ? '#ff4d4f' : 'var(--bg-secondary)', color: isListening ? '#fff' : 'var(--text-secondary)', cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
                      {isListening ? <MicOff size={16} /> : <Mic size={16} />}
                    </button>
                  )}
                  <button onClick={() => imageInputRef.current?.click()} title="上传图片"
                    style={{ width: 38, height: 38, borderRadius: 10, border: '1px solid var(--border-color)', background: 'var(--bg-secondary)', color: 'var(--text-secondary)', cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
                    <ImagePlus size={16} />
                  </button>
                  <input ref={imageInputRef} type="file" accept="image/*" style={{ display: 'none' }} onChange={handleImageUpload} />
                  {isGenerating || agentIsRunning ? (
                    <button onClick={agentIsRunning ? cancelAgentTask : stopGeneration}
                      style={{ width: 38, height: 38, borderRadius: 10, border: '1px solid var(--border-color)', background: 'var(--bg-secondary)', color: 'var(--text-secondary)', cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
                      <Square size={16} />
                    </button>
                  ) : (
                    <button onClick={handleSend} disabled={!inputValue.trim()}
                      style={{ width: 38, height: 38, borderRadius: 10, border: 'none', background: inputValue.trim() ? 'var(--primary-color)' : 'var(--bg-tertiary)', color: inputValue.trim() ? '#fff' : 'var(--text-tertiary)', cursor: inputValue.trim() ? 'pointer' : 'not-allowed', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
                      <Send size={16} />
                    </button>
                  )}
                </div>
              </div>
            </div>
          ) : activeTab === 'skills' ? (
            /* Skills Tab - 动态技能管理 */
            <SkillManager
              visible={true}
              disabled={isGenerating || agentIsRunning}
              onUseSkill={(skill) => {
                // 使用技能：将技能描述作为 prompt 发送
                const prompt = `请使用"${skill.name}"技能来帮我完成任务。${skill.description}`;
                handleQuickCommand(prompt, false, true);
              }}
            />
          ) : (
            /* 工具管理 Tab */
            <div style={{ flex: 1, overflowY: 'auto', padding: 16 }}>
              <div style={{ marginBottom: 16 }}>
                <div style={{ fontSize: 15, fontWeight: 600, color: 'var(--text-primary)', marginBottom: 4 }}>工具管理</div>
                <div style={{ fontSize: 12, color: 'var(--text-tertiary)' }}>管理 AI 可使用的内置工具和 MCP 外部工具</div>
              </div>

              {/* 内置工具 */}
              <div style={{ marginBottom: 20 }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 10 }}>
                  <Wrench size={15} style={{ color: 'var(--primary-color)' }} />
                  <span style={{ fontSize: 14, fontWeight: 600, color: 'var(--text-primary)' }}>内置工具</span>
                  <span style={{ fontSize: 11, color: 'var(--text-tertiary)', background: 'var(--bg-tertiary)', padding: '2px 8px', borderRadius: 10 }}>32 个</span>
                </div>
                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(180px, 1fr))', gap: 6 }}>
                  {[
                    { name: '搜索创意库', desc: '搜索和列出创意', group: '数据' },
                    { name: '创建创意', desc: '创建新创意记录', group: '数据' },
                    { name: '更新创意', desc: '更新创意内容', group: '数据' },
                    { name: '删除创意', desc: '软删除创意', group: '数据' },
                    { name: '创意详情', desc: '获取创意完整信息', group: '数据' },
                    { name: '列出创意', desc: '批量列出创意', group: '数据' },
                    { name: '标签管理', desc: '添加/管理标签', group: '数据' },
                    { name: '关联创意', desc: '建立创意关联', group: '数据' },
                    { name: '创建看板', desc: '创建新看板', group: '看板' },
                    { name: '添加到看板', desc: '创意添加到看板', group: '看板' },
                    { name: '看板概览', desc: '查看看板内容', group: '看板' },
                    { name: '创建标签', desc: '创建新标签', group: '标签' },
                    { name: '搜索标签', desc: '搜索标签', group: '标签' },
                    { name: '热门标签', desc: '获取热门标签', group: '标签' },
                    { name: '全局搜索', desc: '全局搜索内容', group: '搜索' },
                    { name: '联网搜索', desc: '搜索互联网', group: '搜索' },
                    { name: '日期搜索', desc: '按日期范围搜索', group: '搜索' },
                    { name: '搜索模板', desc: '搜索内容模板', group: '搜索' },
                    { name: '应用统计', desc: '获取应用数据', group: '系统' },
                    { name: '最近编辑', desc: '获取最近编辑记录', group: '系统' },
                    { name: '页面导航', desc: '导航到指定页面', group: '系统' },
                    { name: '界面上下文', desc: '获取当前界面信息', group: '系统' },
                    { name: '显示通知', desc: '弹出系统通知', group: '系统' },
                    { name: '打开链接', desc: '打开外部链接', group: '系统' },
                    { name: '获取时间', desc: '获取当前时间', group: '系统' },
                    { name: '数学计算', desc: '数学表达式计算', group: '工具' },
                    { name: '代码执行', desc: '运行代码片段', group: '高级' },
                    { name: '文件读取', desc: '读取本地文件', group: '文件' },
                    { name: '浏览目录', desc: '列出目录内容', group: '文件' },
                    { name: '音乐状态', desc: '获取音乐播放状态', group: '音乐' },
                    { name: '搜索音乐', desc: '搜索在线音乐', group: '音乐' },
                  ].map((tool) => (
                    <div key={tool.name} style={{
                      padding: '8px 12px', borderRadius: 8,
                      border: '1px solid var(--border-light)',
                      background: 'var(--bg-secondary)',
                      display: 'flex', alignItems: 'center', gap: 8,
                    }}>
                      <div style={{
                        width: 6, height: 6, borderRadius: '50%',
                        background: 'var(--primary-color)', flexShrink: 0,
                      }} />
                      <div style={{ flex: 1, minWidth: 0 }}>
                        <div style={{ fontSize: 12, fontWeight: 500, color: 'var(--text-primary)' }}>{tool.name}</div>
                        <div style={{ fontSize: 10, color: 'var(--text-tertiary)' }}>{tool.desc}</div>
                      </div>
                      <span style={{ fontSize: 9, padding: '1px 4px', borderRadius: 3, background: 'var(--bg-tertiary)', color: 'var(--text-tertiary)' }}>{tool.group}</span>
                    </div>
                  ))}
                </div>
              </div>

              {/* MCP 外部工具管理 */}
              <MCPManager
                visible={true}
                mcpTools={mcpTools}
                onRefresh={() => {
                  try {
                    (window as any).api?.mcp?.getStatus?.();
                  } catch (e) {}
                }}
              />
            </div>
          )}
        </motion.div>
      </AnimatePresence>

      {showWorkflowEditor && <WorkflowEditor onClose={() => setShowWorkflowEditor(false)} />}
      {showUsageDashboard && <AIUsageDashboard onClose={() => setShowUsageDashboard(false)} />}
    </>
  );
};

export default AIChatFullscreen;
