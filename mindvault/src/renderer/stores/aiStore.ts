import { create } from 'zustand';
import { api } from '../utils/api';
import { useSettingsStore } from './settingsStore';
import { useSkillStore } from './skillStore';
import type { AIChatMessage, AIProviderConfig, AIMemory, AIToolCallDisplay, AIReasoningStep, PromptTemplate, AICreativityRef, AIMultimodalContent } from '../../shared/types';

/** 默认系统提示词 */
const SYSTEM_PROMPT = `你是脑洞集AI助手，帮助用户进行创意思考、内容生成和灵感激发。请用中文回复。

【核心能力 - 你拥有完整的软件操作权限】
你绝不是只能"建议"的聊天机器人，你可以直接操作软件的所有功能：
- 创意管理：创建、编辑、删除、搜索创意（create_creativity、update_creativity、delete_creativity、search_creativity、list_creativities）
- 写作台：创建章节、删除重复章节（create_writing_chapter、delete_creativity）
- 音乐控制：停止播放、暂停、继续播放（control_music）
- 设置管理：更换音色、调整参数（change_tts_voice、update_settings）
- 看板/标签/模板管理

【铁律 - 违反将导致严重后果】
1. **绝对禁止说"我无法操作"、"我目前无法直接操作"、"建议你手动"**
2. **用户要求执行操作时，必须立即调用工具，绝不能只回复文本**
3. **不要询问"是否需要我帮你"，直接执行**
4. **如果不确定用哪个工具，先用 list_creativities/search_creativity 查询，再执行操作**

【操作流程 - 复杂任务必须遵循】
步骤1：先查询（如 list_creativities 获取章节列表）
步骤2：分析数据（找到需要删除的重复章节）
步骤3：执行操作（调用 delete_creativity 逐个删除）
步骤4：确认结果（告知用户删除了哪些内容）

【正确 vs 错误示例】
用户："关闭音乐，删除重复章节"
❌ 错误："我无法直接操作你的写作台，建议你手动删除" → 严重错误！
✅ 正确：调用 control_music(stop) → 调用 list_creativities → 分析重复 → 调用 delete_creativity 删除

用户："帮我写一章小说"
❌ 错误："好的，这是为你创作的章节内容..."（只输出文本不调用工具）
✅ 正确：调用 create_writing_chapter(title, content) 创建到写作台

用户："换个御姐音"
✅ 正确：调用 change_tts_voice(voiceType: "御姐")

记住：你是软件的操作者，不是旁观者。每一次用户请求操作，你都必须真正执行。

【技能系统 - 你拥有丰富的专业技能】
你内置了多个专业技能（如 PDF 处理、文档编辑、前端开发、安全审计等），当用户的需求与某个技能匹配时：
1. 如果系统已自动激活相关技能（会在上下文中注入技能指南），请严格参考技能指南执行
2. 如果用户明确提到某个技能名称或领域，主动应用对应的专业知识
3. 技能涵盖：文档处理(PDF/Word/Excel/PPT)、前端开发、后端开发、DevOps、安全、设计、产品管理、测试、写作、架构、性能优化、代码质量、AI与自动化等`;

/** 音乐增强版系统提示词 */
const MUSIC_SYSTEM_PROMPT = `你是脑洞集AI助手，帮助用户进行创意思考、内容生成和灵感激发。请用中文回复。

你还可以帮助用户管理音乐：
- 根据用户描述的心情、场景、风格推荐本地歌曲
- 分析用户的听歌习惯和偏好
- 为本地歌曲进行情绪分类
- 提供听歌总结和统计报告

当用户询问音乐相关问题时，你会收到当前音乐库和播放统计的上下文信息，请基于这些信息回答。

【重要】如果你的回复中推荐了歌曲，请使用以下格式来标记歌曲名称，以便前端可以将其渲染为可点击的播放按钮：
【歌曲:歌曲名-艺术家名】

例如：「我推荐你听【歌曲:Minecraft-C418】这首歌」
这样前端会将「Minecraft-C418」渲染为一个可点击的播放按钮，用户点击后可以立即播放这首歌。`;

const PROVIDER_LABELS: Record<string, string> = {
  openai: 'OpenAI',
  anthropic: 'Anthropic',
  deepseek: 'DeepSeek',
  custom: '自定义',
};

/** 音乐相关关键词列表，用于智能检测用户音乐意图 */
const MUSIC_KEYWORDS = [
  '找歌', '推荐歌', '听什么', '播放', '音乐', '歌曲', '歌手', '歌单',
  '听歌', '统计', '总结', '报告', '习惯', '偏好', '最爱', '情绪', '分类',
  '心情', '风格', '节奏', '旋律',
];

/** Agent 模式关键词列表，触发自动进入 Agent 执行模式 */
const AGENT_MODE_KEYWORDS = [
  // 创作类
  '写小说', '写故事', '写文章', '写章节', '创作', '续写', '帮我写', '写一', '写几',
  '写作台', '写稿', '写脚本', '写剧本', '写文案',
  // 多步骤操作
  '帮我整理', '帮我分类', '帮我整理', '帮我创建', '批量', '多个',
  '搜索并', '查找并', '整理并',
  // 内容生成
  '生成内容', '生成文章', '生成大纲', '生成故事', '生成创意',
  // 任务规划类
  '帮我规划', '制定计划', '安排任务',
  // 复杂查询
  '分析并', '整理并', '总结并', '推荐并',
];

// 任务复杂度检测正则
const AGENT_MODE_PATTERNS = [
  // 包含章节数量要求的创作任务
  /(\d+)\s*(章|集|篇|节|段|回)/i,
  // 包含多个操作的任务
  /(先|然后|再|接着|最后|首先|其次|最后)/,
  // 创作类任务
  /(写|创作|生成|续写)(一|几)?(部|篇|章|集|段|个)(小说|故事|文章|章节|内容|创意)/i,
  // 明确要求执行的任务
  /(帮我|给我|我要|请帮我)(写|创建|制作|生成|整理|分类)/i,
];

/**
 * 检测用户消息是否应该进入 Agent 模式执行
 * @param content 用户消息内容
 * @returns 是否应该进入 Agent 模式
 */
function shouldUseAgentMode(content: string): boolean {
  const lowerContent = content.toLowerCase();
  
  // 1. 检查关键词
  for (const keyword of AGENT_MODE_KEYWORDS) {
    if (lowerContent.includes(keyword.toLowerCase())) {
      return true;
    }
  }
  
  // 2. 检查正则模式
  for (const pattern of AGENT_MODE_PATTERNS) {
    if (pattern.test(content)) {
      return true;
    }
  }
  
  // 3. 检查是否包含多步骤指示（用逗号、分号分隔的多个操作）
  const separators = ['，然后', '，接着', '，再', '。然后', '。接着', '。再'];
  for (const sep of separators) {
    if (lowerContent.includes(sep)) {
      return true;
    }
  }
  
  // 4. 检查消息长度，超过 200 字符的创作类描述通常需要 Agent
  if (content.length > 200 && /[创作写生成].{0,20}(小说|故事|章节|文章|内容|剧本)/i.test(content)) {
    return true;
  }
  
  return false;
}

/** localStorage 键名 */
const STORAGE_KEY = 'ai_chat_windows';
const STORAGE_ACTIVE_WINDOW_KEY = 'ai_active_window_id';
const MIGRATION_DONE_KEY = 'ai_chat_migration_done';

// 消息数量提醒阈值
const MESSAGE_COUNT_WARNINGS = [50, 70, 100, 150, 200, 300, 500];

/**
 * 检测用户消息是否包含音乐相关意图
 * @param content 用户消息内容
 * @returns 是否为音乐相关消息
 */
function isMusicRelated(content: string): boolean {
  return MUSIC_KEYWORDS.some((keyword) => content.includes(keyword));
}

/** 聊天窗口接口 */
export interface ChatWindow {
  id: string;
  title: string;
  messages: AIChatMessage[];
  isPinned?: boolean;
  isArchived?: boolean;
  groupName?: string | null;
  createdAt: number;
  updatedAt: number;
}

/** AI 状态接口 */
interface AIState {
  // 多窗口状态
  chatWindows: ChatWindow[];
  activeWindowId: string | null;

  // 当前窗口状态（派生）
  messages: AIChatMessage[];
  isGenerating: boolean;
  streamingText: string;
  error: string | null;
  webSearchEnabled: boolean;

  // 记忆系统
  memories: AIMemory[];
  memoryEnabled: boolean;
  memoryStats: { total: number; today: number; thisWeek: number } | null;

  // RAG 知识库
  ragEnabled: boolean;
  ragStats: { total: number; byType: Record<string, number>; withEmbedding: number } | null;
  ragIndexing: boolean;
  indexAllCreativities: () => Promise<void>;
  loadRagStats: () => Promise<void>;

  // 工作流
  workflows: any[];
  workflowsLoaded: boolean;
  loadWorkflows: () => Promise<void>;
  createWorkflow: (workflow: any) => Promise<any>;
  deleteWorkflow: (id: string) => Promise<void>;
  runWorkflow: (id: string) => Promise<void>;

  // AI 使用统计
  aiUsageStats: any;
  aiUsageStatsPeriod: string;
  loadAIUsageStats: (period?: string) => Promise<void>;

  // 对话导出
  exportChatAsMarkdown: (windowId?: string) => string;
  exportChatAsPDF: (windowId?: string) => void;

  // Tool Calling
  toolCallsEnabled: boolean;
  activeToolCalls: AIToolCallDisplay[];
  completedToolCalls: AIToolCallDisplay[];

  // Agent 模式
  agentModeEnabled: boolean;
  agentTask: any | null;
  agentSteps: any[];
  agentPhases: any[];
  agentIsRunning: boolean;
  agentStatus: string; // thinking | planning | executing | reflecting | completed | failed | cancelled
  agentThinking: string; // 思考过程累积文本
  agentSummary: string; // 任务摘要
  agentStepThinking: Record<string, string>; // stepId -> thinking text

  // 推理过程可视化
  currentReasoningSteps: AIReasoningStep[];
  isReasoning: boolean;
  addReasoningStep: (step: Omit<AIReasoningStep, 'id' | 'timestamp'>) => void;
  clearReasoningSteps: () => void;
  toggleMessageReasoning: (messageIndex: number) => void;

  // Prompt 模板
  promptTemplates: PromptTemplate[];
  loadPromptTemplates: (category?: string) => Promise<void>;
  usePromptTemplate: (templateId: string, variables?: Record<string, string>) => Promise<string | null>;
  createPromptTemplate: (template: Partial<PromptTemplate>) => Promise<void>;
  deletePromptTemplate: (templateId: string) => Promise<void>;

  // 窗口管理
  createWindow: (title?: string) => string;
  switchWindow: (windowId: string) => void;
  closeWindow: (windowId: string) => void;
  updateWindowTitle: (windowId: string, title: string) => void;
  pinWindow: (windowId: string, pinned: boolean) => void;
  archiveWindow: (windowId: string, archived: boolean) => void;

  // 消息操作
  sendMessage: (content: string | AIMultimodalContent[], config?: Partial<AIProviderConfig>, creativityRefs?: AICreativityRef[]) => Promise<void>;
  sendMusicMessage: (content: string, config?: Partial<AIProviderConfig>) => Promise<void>;
  stopGeneration: () => void;
  clearMessages: () => void;
  clearAllWindows: () => void;

  // 联网搜索
  toggleWebSearch: () => void;
  setWebSearchEnabled: (enabled: boolean) => void;

  // 记忆系统
  setMemoryEnabled: (enabled: boolean) => void;
  loadMemories: () => Promise<void>;
  extractMemories: (windowId: string) => Promise<void>;
  deleteMemory: (id: string) => Promise<void>;

  // Tool Calling
  setToolCallsEnabled: (enabled: boolean) => void;

  // Agent 模式
  setAgentModeEnabled: (enabled: boolean) => void;
  executeAgentTask: (instruction: string | AIMultimodalContent[], config?: Partial<AIProviderConfig>, creativityRefs?: AICreativityRef[]) => Promise<void>;
  cancelAgentTask: () => void;

  // 实时跟随模式
  followMode: boolean;
  setFollowMode: (enabled: boolean) => void;

  // MCP 工具
  mcpServers: Array<{ id: string; name: string; status: string; toolCount: number }>;
  mcpTools: Array<{ name: string; description: string; serverName: string }>;
  loadMcpStatus: () => Promise<void>;

  // 持久化
  saveToStorage: () => void;
  loadFromStorage: () => void;
}

/** 生成唯一 ID */
function generateId(): string {
  return `window_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
}

/** 获取窗口标题（基于第一条用户消息） */
function getWindowTitle(messages: AIChatMessage[]): string {
  const firstUserMessage = messages.find((m) => m.role === 'user');
  if (firstUserMessage) {
    const content = typeof firstUserMessage.content === 'string' ? firstUserMessage.content : '';
    const title = content.slice(0, 20);
    return title.length < content.length ? `${title}...` : title;
  }
  return '新对话';
}

/** 从 settingsStore 构建当前 AI 提供商配置 */
function buildProviderConfig(): AIProviderConfig {
  const { settings } = useSettingsStore.getState();
  const provider = settings.aiDefaultProvider;

  switch (provider) {
    case 'anthropic':
      return {
        provider: 'anthropic',
        apiKey: settings.aiAnthropicApiKey,
        model: settings.aiAnthropicModel,
      };
    case 'deepseek':
      return {
        provider: 'deepseek',
        apiKey: settings.aiDeepseekApiKey,
        model: settings.aiDeepseekModel,
      };
    case 'custom':
      return {
        provider: 'custom',
        apiKey: settings.aiCustomApiKey,
        baseUrl: settings.aiCustomBaseUrl || undefined,
        model: settings.aiCustomModel,
      };
    case 'openai':
    default:
      return {
        provider: 'openai',
        apiKey: settings.aiOpenaiApiKey,
        baseUrl: settings.aiOpenaiBaseUrl || undefined,
        model: settings.aiOpenaiModel,
      };
  }
}

/**
 * 获取音乐上下文信息（当前播放状态 + 统计数据 + 曲目列表）
 * 用于注入到 AI 系统提示词中
 */
async function getMusicContext(): Promise<string> {
  const contextParts: string[] = [];

  // 1. 获取当前播放状态（从 musicStore 获取）
  try {
    // 动态导入 musicStore 避免循环依赖
    const { useMusicStore } = await import('./musicStore');
    const musicState = useMusicStore.getState();
    const currentTrack = musicState.tracks[musicState.currentTrackIndex];

    if (currentTrack) {
      contextParts.push(`【当前播放状态】`);
      contextParts.push(`正在播放：《${currentTrack.title}》 - ${currentTrack.artist || '未知艺术家'}`);
      contextParts.push(`播放状态：${musicState.isPlaying ? '播放中' : '已暂停'}`);
      contextParts.push(`播放模式：${musicState.getPlayModeLabel()}`);
      contextParts.push(`播放列表中共 ${musicState.tracks.length} 首歌曲`);
    } else {
      contextParts.push(`【当前播放状态】`);
      contextParts.push(`当前没有正在播放的歌曲`);
      contextParts.push(`播放列表中共 ${musicState.tracks.length} 首歌曲`);
    }

    // 获取本地曲目列表（最多 20 首，减少 token 消耗）
    const localTracks = musicState.tracks
      .filter((t) => t.source === 'local' || t.source === 'preset')
      .slice(0, 20);

    if (localTracks.length > 0) {
      contextParts.push(`\n【本地歌曲库】（共 ${localTracks.length} 首，显示前 ${Math.min(localTracks.length, 20)} 首）：`);
      localTracks.forEach((track) => {
        const sourceLabel = track.source === 'preset' ? '[内置]' : '';
        contextParts.push(`- ${track.title} - ${track.artist || '未知艺术家'} ${sourceLabel}`);
      });
      if (localTracks.length >= 20) {
        contextParts.push(`...（还有更多歌曲）`);
      }
    }
  } catch (err) {
    console.warn('[AIStore] 获取当前播放状态失败:', err);
  }

  // 2. 获取统计数据摘要
  try {
    const statsResult = await api.ai.musicGetStatsSummary();
    if (statsResult.success && statsResult.summary) {
      contextParts.push(statsResult.summary);
    }
  } catch (err) {
    console.warn('[AIStore] 获取音乐统计摘要失败:', err);
  }

  return contextParts.join('\n');
}

/**
 * 执行联网搜索
 */
async function performWebSearch(query: string): Promise<string> {
  try {
    const result = await api.ai.webSearch(query);
    if (result.success && result.results) {
      return result.results;
    }
    return '';
  } catch (err) {
    console.warn('[AIStore] 联网搜索失败:', err);
    return '';
  }
}

export const useAIStore = create<AIState>((set, get) => ({
  // 初始状态
  chatWindows: [],
  activeWindowId: null,
  messages: [],
  isGenerating: false,
  streamingText: '',
  error: null,
  webSearchEnabled: true,
  memories: [],
  memoryEnabled: true,
  memoryStats: null,
  ragEnabled: true,
  ragStats: null,
  ragIndexing: false,
  workflows: [],
  workflowsLoaded: false,
  aiUsageStats: null,
  aiUsageStatsPeriod: '7d',
  toolCallsEnabled: true,
  activeToolCalls: [],
  completedToolCalls: [],
  promptTemplates: [],
  agentModeEnabled: true,
  agentTask: null,
  agentSteps: [],
  agentPhases: [],
  agentIsRunning: false,
  agentStatus: '',
  agentThinking: '',
  agentSummary: '',
  agentStepThinking: {},

  // 推理过程可视化初始状态
  currentReasoningSteps: [],
  isReasoning: false,

  followMode: false,

  mcpServers: [] as Array<{ id: string; name: string; status: string; toolCount: number }>,
  mcpTools: [] as Array<{ name: string; description: string; serverName: string }>,
  loadMcpStatus: async () => {
    try {
      const result = await api.mcp.getStatus();
      if (result.success) {
        set({ mcpServers: (result.servers || []).map((s: any) => ({ id: s.id, name: s.name, status: s.status, toolCount: s.toolCount || 0 })) });
      }
      const toolsResult = await api.mcp.listTools();
      if (toolsResult.success) {
        set({ mcpTools: (toolsResult.tools || []).map((t: any) => ({ name: t.function?.name || t.name, description: t.function?.description || t.description || '', serverName: t.serverName || 'MCP' })) });
      }
    } catch { /* ignore */ }
  },

  // 创建新窗口
  createWindow: (title?: string) => {
    const newWindow: ChatWindow = {
      id: generateId(),
      title: title || '新对话',
      messages: [],
      isPinned: false,
      isArchived: false,
      groupName: null,
      createdAt: Date.now(),
      updatedAt: Date.now(),
    };

    set((state) => ({
      chatWindows: [...state.chatWindows, newWindow],
      activeWindowId: newWindow.id,
      messages: [],
      streamingText: '',
      error: null,
    }));

    // 保存到 SQLite
    api.chatHistory.createWindow(title || '新对话').then((result: any) => {
      if (result.success && result.data) {
        set((state) => ({
          chatWindows: state.chatWindows.map((w) =>
            w.id === newWindow.id ? { ...w, id: result.data.id } : w
          ),
          activeWindowId: state.activeWindowId === newWindow.id ? result.data.id : state.activeWindowId,
        }));
      }
    }).catch(() => {});

    return newWindow.id;
  },

  // 切换窗口
  switchWindow: (windowId: string) => {
    const { chatWindows } = get();
    const window = chatWindows.find((w) => w.id === windowId);
    if (window) {
      set({
        activeWindowId: windowId,
        messages: window.messages,
        streamingText: '',
        error: null,
      });
      localStorage.setItem(STORAGE_ACTIVE_WINDOW_KEY, windowId);

      // 懒加载：如果窗口消息为空，从 SQLite 加载
      if (window.messages.length === 0) {
        api.chatHistory.getWindow(windowId).then((result: any) => {
          if (result.success && result.data && result.data.messages && result.data.messages.length > 0) {
            const messages = result.data.messages.map((m: any) => ({
              role: m.role as 'user' | 'assistant' | 'system',
              content: m.content,
              reasoningSteps: m.reasoningContent
                ? (() => {
                    try {
                      const parsed = JSON.parse(m.reasoningContent);
                      if (parsed.version === 2 && Array.isArray(parsed.steps)) return parsed.steps;
                    } catch {}
                    return [{ id: `rs_${Date.now()}`, type: 'thinking' as const, content: m.reasoningContent, timestamp: Date.now() }];
                  })()
                : undefined,
              reasoningCollapsed: m.reasoningCollapsed || false,
            }));
            set((state) => ({
              chatWindows: state.chatWindows.map((w) =>
                w.id === windowId ? { ...w, messages } : w
              ),
              messages: state.activeWindowId === windowId ? messages : state.messages,
            }));
          }
        }).catch(() => {});
      }
    }
  },

  // 关闭窗口
  closeWindow: (windowId: string) => {
    const { chatWindows, activeWindowId } = get();
    const newWindows = chatWindows.filter((w) => w.id !== windowId);

    // 从 SQLite 删除
    api.chatHistory.deleteWindow(windowId).catch(() => {});

    if (newWindows.length === 0) {
      // 如果关闭后没有窗口了，创建一个新窗口
      const newId = get().createWindow();
      set({ chatWindows: newWindows.filter(w => w.id !== newId) });
    } else {
      // 如果关闭的是当前活动窗口，切换到其他窗口
      if (activeWindowId === windowId) {
        const newActiveId = newWindows[newWindows.length - 1].id;
        const newActiveWindow = newWindows.find((w) => w.id === newActiveId);
        set({
          chatWindows: newWindows,
          activeWindowId: newActiveId,
          messages: newActiveWindow?.messages || [],
          streamingText: '',
          error: null,
        });
        localStorage.setItem(STORAGE_ACTIVE_WINDOW_KEY, newActiveId);
      } else {
        set({ chatWindows: newWindows });
      }
    }
  },

  // 更新窗口标题
  updateWindowTitle: (windowId: string, title: string) => {
    set((state) => ({
      chatWindows: state.chatWindows.map((w) =>
        w.id === windowId ? { ...w, title, updatedAt: Date.now() } : w
      ),
    }));
    api.chatHistory.updateWindow(windowId, { title }).catch(() => {});
  },

  // 置顶窗口
  pinWindow: (windowId: string, pinned: boolean) => {
    set((state) => ({
      chatWindows: state.chatWindows.map((w) =>
        w.id === windowId ? { ...w, isPinned: pinned, updatedAt: Date.now() } : w
      ),
    }));
    api.chatHistory.updateWindow(windowId, { isPinned: pinned ? 1 : 0 }).catch(() => {});
  },

  // 归档窗口
  archiveWindow: (windowId: string, archived: boolean) => {
    set((state) => ({
      chatWindows: state.chatWindows.map((w) =>
        w.id === windowId ? { ...w, isArchived: archived, updatedAt: Date.now() } : w
      ),
    }));
    api.chatHistory.updateWindow(windowId, { isArchived: archived ? 1 : 0 }).catch(() => {});
  },

  // 切换联网搜索
  toggleWebSearch: () => {
    set((state) => ({ webSearchEnabled: !state.webSearchEnabled }));
  },

  // 设置联网搜索状态
  setWebSearchEnabled: (enabled: boolean) => {
    set({ webSearchEnabled: enabled });
  },

  // 保存到 SQLite（异步）
  saveToStorage: () => {
    try {
      const { chatWindows, activeWindowId } = get();
      for (const win of chatWindows) {
        const messages = win.messages.map((m) => ({
          role: m.role,
          content: typeof m.content === 'string' ? m.content : JSON.stringify(m.content),
          reasoningContent: m.reasoningSteps
            ? JSON.stringify({ version: 2, steps: m.reasoningSteps })
            : undefined,
          reasoningCollapsed: m.reasoningCollapsed || false,
        }));
        api.chatHistory.replaceWindowMessages(win.id, messages).catch((err: any) => {
          console.warn('[AIStore] 保存窗口消息到 SQLite 失败:', err);
        });
        api.chatHistory.updateWindow(win.id, { title: win.title, isPinned: win.isPinned ? 1 : 0, isArchived: win.isArchived ? 1 : 0, groupName: win.groupName || null }).catch(() => {});
      }
      if (activeWindowId) {
        localStorage.setItem(STORAGE_ACTIVE_WINDOW_KEY, activeWindowId);
      }
    } catch (err) {
      console.warn('[AIStore] 保存到 storage 失败:', err);
    }
  },

  // 从 SQLite 加载
  loadFromStorage: async () => {
    try {
      // 检查是否需要迁移 localStorage 数据
      const migrationDone = localStorage.getItem(MIGRATION_DONE_KEY);
      if (!migrationDone) {
        const saved = localStorage.getItem(STORAGE_KEY);
        if (saved) {
          try {
            const parsed = JSON.parse(saved);
            if (Array.isArray(parsed) && parsed.length > 0) {
              const migrateResult = await api.chatHistory.migrateFromLocalStorage(parsed);
              if (migrateResult.success) {
                console.log('[AIStore] localStorage 数据迁移成功:', migrateResult);
                localStorage.removeItem(STORAGE_KEY);
              }
            }
          } catch (e) {
            console.warn('[AIStore] localStorage 数据迁移失败:', e);
          }
          localStorage.setItem(MIGRATION_DONE_KEY, '1');
        }
      }

      // 从 SQLite 加载窗口列表
      const result = await api.chatHistory.listWindows({});
      if (result.success && result.data && result.data.length > 0) {
        const windows = result.data;
        const savedActiveId = localStorage.getItem(STORAGE_ACTIVE_WINDOW_KEY);
        const activeId = savedActiveId && windows.find((w: any) => w.id === savedActiveId)
          ? savedActiveId
          : windows[0].id;

        // 加载活动窗口的消息
        const activeWindowResult = await api.chatHistory.getWindow(activeId);
        const activeMessages = activeWindowResult.success && activeWindowResult.data
          ? (activeWindowResult.data.messages || []).map((m: any) => ({
              role: m.role as 'user' | 'assistant' | 'system',
              content: m.content,
              reasoningSteps: m.reasoningContent
                ? (() => {
                    try {
                      const parsed = JSON.parse(m.reasoningContent);
                      if (parsed.version === 2 && Array.isArray(parsed.steps)) return parsed.steps;
                    } catch {}
                    return [{ id: `rs_${Date.now()}`, type: 'thinking' as const, content: m.reasoningContent, timestamp: Date.now() }];
                  })()
                : undefined,
              reasoningCollapsed: m.reasoningCollapsed || false,
            }))
          : [];

        // 为非活动窗口设置空消息（懒加载）
        const chatWindows = windows.map((w: any) => ({
          id: w.id,
          title: w.title,
          messages: w.id === activeId ? activeMessages : [],
          isPinned: w.isPinned === 1,
          isArchived: w.isArchived === 1,
          groupName: w.groupName,
          createdAt: new Date(w.createdAt).getTime(),
          updatedAt: new Date(w.updatedAt).getTime(),
        }));

        set({
          chatWindows,
          activeWindowId: activeId,
          messages: activeMessages,
        });
        return;
      }

      // 如果没有数据，创建一个默认窗口
      get().createWindow('新对话');
    } catch (err) {
      console.warn('[AIStore] 从 SQLite 加载失败:', err);
      get().createWindow('新对话');
    }

    // 加载模板
    get().loadPromptTemplates().catch(() => {});
    get().loadRagStats().catch(() => {});
    get().loadWorkflows().catch(() => {});
    get().loadAIUsageStats().catch(() => {});
  },

  // 发送消息（使用新版 QueryEngine）
  sendMessage: async (content: string | AIMultimodalContent[], config?: Partial<AIProviderConfig>, creativityRefs?: AICreativityRef[]) => {
    const { isGenerating, activeWindowId, chatWindows, messages, webSearchEnabled, memoryEnabled, toolCallsEnabled } = get();
    if (isGenerating) return;

    const previewText = typeof content === 'string' ? content : '[多模态消息]';
    console.log('[AIStore] 使用新版 QueryEngine 处理消息:', previewText.slice(0, 50));

    // 检查 AI 是否启用
    const { settings } = useSettingsStore.getState();
    if (!settings.aiEnabled) {
      set({ error: '请先在设置中开启 AI 功能' });
      return;
    }

    // 如果没有活动窗口，创建一个
    let currentWindowId = activeWindowId;
    if (!currentWindowId) {
      currentWindowId = get().createWindow();
    }

    // 合并配置
    const baseConfig = buildProviderConfig();
    const finalConfig: AIProviderConfig = { ...baseConfig, ...config };

    // 检查 API Key 是否存在
    if (!finalConfig.apiKey) {
      set({ error: `请先在设置中配置 ${PROVIDER_LABELS[finalConfig.provider] || finalConfig.provider} 的 API Key` });
      return;
    }

    // 构建增强的系统提示词
    let enhancedSystemPrompt = SYSTEM_PROMPT;

    // 如果需要联网搜索，先执行搜索
    let searchResults = '';
    if (webSearchEnabled) {
      try {
        searchResults = await performWebSearch(typeof content === 'string' ? content : '');
        if (searchResults) {
          enhancedSystemPrompt += `\n\n【联网搜索结果】\n${searchResults}\n\n请基于以上搜索结果回答用户问题。`;
        }
      } catch (err) {
        console.warn('[AIStore] 联网搜索失败:', err);
      }
    }

    // RAG 上下文注入
    try {
      const ragResults = await api.rag.search(typeof content === 'string' ? content : '', finalConfig, { limit: 3, minScore: 0.3 });
      if (ragResults.success && ragResults.data && ragResults.data.length > 0) {
        const ragContext = ragResults.data
          .map((r: any, i: number) => `[${i + 1}] (相关度: ${(r.score * 100).toFixed(0)}%) ${r.contentChunk}`)
          .join('\n\n');
        enhancedSystemPrompt += `\n\n【用户创意库相关内容】\n${ragContext}\n\n你可以参考以上创意库内容来回答用户问题。`;
      }
    } catch (err) {
      console.warn('[AIStore] RAG检索失败:', err);
    }

    // 技能上下文注入（按需加载模式：只注入本次匹配到的技能描述，不累积）
    try {
      const skillStore = useSkillStore.getState();
      const detectedSkills = await skillStore.detectSkills(typeof content === 'string' ? content : '');

      if (detectedSkills.length > 0) {
        // 只注入本次检测到的技能，不使用累积的 activeSkills
        const skillSummaries: string[] = [];
        for (const detection of detectedSkills) {
          const skill = detection.skill;
          skillSummaries.push(
            `- ${skill.icon} **${skill.name}**（${skill.category}）：${skill.description}`
          );
          // 记录使用次数但不累积到 activeSkills
          api.skill.incrementUse(skill.id).catch(() => {});
        }

        if (skillSummaries.length > 0) {
          enhancedSystemPrompt += `\n\n【可用技能】\n以下技能与当前任务相关，如果你认为需要使用某个技能的详细指南，请在回复中说明并参考其指引：\n${skillSummaries.join('\n')}\n\n提示：你可以通过工具调用 get_skill_prompt(skill_id) 获取技能的完整操作指南。`;
        }

        console.log('[AIStore] 检测到匹配技能:', detectedSkills.map(d => d.skill.name));
      }
    } catch (err) {
      console.warn('[AIStore] 技能注入失败:', err);
    }

    const userMessage: AIChatMessage = {
      role: 'user',
      content,
      ...(creativityRefs && creativityRefs.length > 0 ? { creativityRefs } : {}),
    };
    const newMessages = [...messages, userMessage];

    // 更新当前窗口消息
    const updatedWindows = chatWindows.map((w) =>
      w.id === currentWindowId
        ? { ...w, messages: newMessages, updatedAt: Date.now() }
        : w
    );

    // 如果是第一条用户消息，更新窗口标题
    const currentWindow = chatWindows.find((w) => w.id === currentWindowId);
    if (currentWindow && currentWindow.messages.filter((m) => m.role === 'user').length === 0) {
      const newTitle = (typeof content === 'string' ? content : '新对话').slice(0, 20) + ((typeof content === 'string' ? content : '').length > 20 ? '...' : '');
      updatedWindows.forEach((w) => {
        if (w.id === currentWindowId) w.title = newTitle;
      });
    }

    set({
      chatWindows: updatedWindows,
      messages: newMessages,
      isGenerating: true,
      streamingText: '',
      error: null,
      currentReasoningSteps: [],
      isReasoning: true,
      activeToolCalls: [],
      completedToolCalls: [],
    });

    // 添加推理步骤
    get().addReasoningStep({ type: 'thinking', content: `分析用户请求：${previewText.slice(0, 80)}` });

    // 注册流式回调
    const unsubToken = api.ai.onToken((token: string) => {
      set((state) => ({ streamingText: state.streamingText + token }));
    });

    const unsubToolCall = api.ai.onToolCall((data: { name: string; args: any; result: string }) => {
      const toolCall: AIToolCallDisplay = {
        id: `tool_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
        name: data.name,
        args: data.args,
        result: data.result,
        status: 'completed',
        timestamp: Date.now(),
      };
      set((state) => ({
        completedToolCalls: [...state.completedToolCalls, toolCall],
      }));
      get().addReasoningStep({ type: 'action', content: `执行工具：${data.name}` });
    });

    const unsubUsage = api.ai.onUsage((usage: { inputTokens: number; outputTokens: number }) => {
      console.log('[AIStore] Token 使用量:', usage);
    });

    const unsubEnd = api.ai.onStreamEnd((fullText: string) => {
      const reasoningSteps = get().currentReasoningSteps;
      const assistantMessage: AIChatMessage = {
        role: 'assistant',
        content: fullText,
        reasoningSteps: reasoningSteps.length > 0 ? [...reasoningSteps] : undefined,
        reasoningCollapsed: reasoningSteps.length > 0,
      };
      const finalMessages = [...newMessages, assistantMessage];

      set((state) => {
        const finalWindows = state.chatWindows.map((w) =>
          w.id === currentWindowId
            ? { ...w, messages: finalMessages, updatedAt: Date.now() }
            : w
        );
        return {
          chatWindows: finalWindows,
          messages: finalMessages,
          isGenerating: false,
          streamingText: '',
          currentReasoningSteps: [],
          isReasoning: false,
        };
      });

      setTimeout(() => get().saveToStorage(), 500);

      // 检查消息数量，在达到阈值时提醒用户
      const msgCount = finalMessages.length;
      const warningThreshold = MESSAGE_COUNT_WARNINGS.find(t => msgCount >= t && finalMessages.length - 1 < t);
      if (warningThreshold) {
        console.warn(`[AIStore] 当前对话已有 ${msgCount} 条消息，消息过多可能导致界面卡顿`);
      }

      unsubToken();
      unsubToolCall();
      unsubUsage();
      unsubEnd();
      unsubError();
    });

    const unsubError = api.ai.onStreamError((errorMsg: string) => {
      set({
        isGenerating: false,
        streamingText: '',
        error: errorMsg,
      });
      unsubToken();
      unsubToolCall();
      unsubUsage();
      unsubEnd();
      unsubError();
    });

    try {
      // 使用新版 QueryEngine 发送流式请求
      const allMessages = [{ role: 'system', content: enhancedSystemPrompt }, ...newMessages];
      await api.ai.queryStream(allMessages, finalConfig, {
        systemPrompt: enhancedSystemPrompt,
        permissionMode: toolCallsEnabled ? 'default' : 'read-only',
        maxTurns: 10,
      });
    } catch (err: any) {
      set({
        isGenerating: false,
        streamingText: '',
        error: err?.message || '发送消息失败',
      });
      unsubToken();
      unsubToolCall();
      unsubUsage();
      unsubEnd();
      unsubError();
    }
  },

  /**
   * 发送音乐相关消息
   */
  sendMusicMessage: async (content: string, config?: Partial<AIProviderConfig>) => {
    const { messages, isGenerating, activeWindowId, chatWindows, webSearchEnabled } = get();
    if (isGenerating) return;

    // 检查 AI 是否启用
    const { settings } = useSettingsStore.getState();
    if (!settings.aiEnabled) {
      set({ error: '请先在设置中开启 AI 功能' });
      return;
    }

    // 如果没有活动窗口，创建一个
    let currentWindowId = activeWindowId;
    if (!currentWindowId) {
      currentWindowId = get().createWindow();
    }

    // 合并配置
    const baseConfig = buildProviderConfig();
    const finalConfig: AIProviderConfig = { ...baseConfig, ...config };

    // 检查 API Key 是否存在
    if (!finalConfig.apiKey) {
      set({ error: `请先在设置中配置 ${PROVIDER_LABELS[finalConfig.provider] || finalConfig.provider} 的 API Key` });
      return;
    }

    // 异步获取音乐上下文
    let musicContext = '';
    try {
      musicContext = await getMusicContext();
    } catch (err) {
      console.warn('[AIStore] 获取音乐上下文失败，将使用无上下文模式:', err);
    }

    // 如果需要联网搜索，先执行搜索
    let searchResults = '';
    if (webSearchEnabled) {
      try {
        searchResults = await performWebSearch(content);
      } catch (err) {
        console.warn('[AIStore] 联网搜索失败:', err);
      }
    }

    // 构建增强的系统提示词
    const baseSystemPrompt = musicContext ? MUSIC_SYSTEM_PROMPT : SYSTEM_PROMPT;
    let enhancedSystemPrompt = musicContext
      ? `${baseSystemPrompt}\n\n以下是当前用户的音乐数据上下文：\n${musicContext}`
      : baseSystemPrompt;

    if (searchResults) {
      enhancedSystemPrompt += `\n\n【联网搜索结果】\n${searchResults}\n\n请基于以上搜索结果回答用户问题。`;
    }

    // RAG 上下文注入：检索与用户问题相关的创意数据
    try {
      const ragResults = await api.rag.search(content, finalConfig, { limit: 3, minScore: 0.3 });
      if (ragResults.success && ragResults.data && ragResults.data.length > 0) {
        const ragContext = ragResults.data
          .map((r: any, i: number) => `[${i + 1}] (相关度: ${(r.score * 100).toFixed(0)}%) ${r.contentChunk}`)
          .join('\n\n');
        enhancedSystemPrompt += `\n\n【用户创意库相关内容】\n${ragContext}\n\n你可以参考以上创意库内容来回答用户问题，但不要直接暴露原始数据。`;
      }
    } catch (err) {
      console.warn('[AIStore] RAG检索失败:', err);
    }

    // ===== 技能上下文注入 =====
    // 1. 自动检测用户输入匹配的技能
    try {
      const skillStore = useSkillStore.getState();
      const detectedSkills = await skillStore.detectSkills(content);
      if (detectedSkills.length > 0) {
        console.log('[AIStore] 检测到匹配技能:', detectedSkills.map(d => d.skill.name));
        // 自动激活检测到的技能
        for (const detection of detectedSkills) {
          if (!skillStore.activeSkills.includes(detection.skill.id)) {
            skillStore.activateSkill(detection.skill.id);
          }
        }
      }

      // 2. 注入所有激活技能的 prompt
      const activeSkillIds = useSkillStore.getState().activeSkills;
      if (activeSkillIds.length > 0) {
        const skillPrompts: string[] = [];
        for (const skillId of activeSkillIds) {
          const prompt = await skillStore.getSkillPrompt(skillId);
          if (prompt) {
            skillPrompts.push(prompt);
          }
        }
        if (skillPrompts.length > 0) {
          enhancedSystemPrompt += `\n\n【已激活的技能 - 请参考以下技能指南来完成任务】\n${skillPrompts.join('\n\n---\n\n')}\n\n请根据以上激活的技能指南来辅助完成任务。如果用户的需求与某个技能高度匹配，请优先使用该技能的方法和建议。`;
        }
      }
    } catch (err) {
      console.warn('[AIStore] 技能注入失败:', err);
    }

    const systemMessage: AIChatMessage = { role: 'system', content: enhancedSystemPrompt };
    const userMessage: AIChatMessage = {
      role: 'user',
      content,
      ...(creativityRefs && creativityRefs.length > 0 ? { creativityRefs } : {}),
    };
    const newMessages = [...messages, userMessage];

    // 更新当前窗口消息
    const updatedWindows = chatWindows.map((w) =>
      w.id === currentWindowId
        ? { ...w, messages: newMessages, updatedAt: Date.now() }
        : w
    );

    // 如果是第一条用户消息，更新窗口标题
    const currentWindow = chatWindows.find((w) => w.id === currentWindowId);
    if (currentWindow && currentWindow.messages.filter((m) => m.role === 'user').length === 0) {
      const newTitle = content.slice(0, 20) + (content.length > 20 ? '...' : '');
      updatedWindows.forEach((w) => {
        if (w.id === currentWindowId) {
          w.title = newTitle;
        }
      });
    }

    set({
      chatWindows: updatedWindows,
      messages: newMessages,
      isGenerating: true,
      streamingText: '',
      error: null,
      currentReasoningSteps: [],
      isReasoning: true,
    });

    // 添加推理步骤
    get().addReasoningStep({ type: 'thinking', content: `分析音乐相关问题：${content.slice(0, 80)}` });
    if (musicContext) {
      get().addReasoningStep({ type: 'analysis', content: '已加载用户音乐库数据' });
    }
    get().addReasoningStep({ type: 'planning', content: '开始生成音乐推荐...' });

    // 注册流式回调
    const unsubToken = api.ai.onToken((token: string) => {
      set((state) => ({ streamingText: state.streamingText + token }));
    });

    const unsubEnd = api.ai.onStreamEnd((fullText: string) => {
      // 将当前推理步骤保存到 assistant 消息中
      const reasoningSteps = get().currentReasoningSteps;
      const assistantMessage: AIChatMessage = {
        role: 'assistant',
        content: fullText,
        reasoningSteps: reasoningSteps.length > 0 ? [...reasoningSteps] : undefined,
        reasoningCollapsed: reasoningSteps.length > 0, // 有推理步骤时默认折叠
      };
      const finalMessages = [...newMessages, assistantMessage];

      set((state) => {
        const finalWindows = state.chatWindows.map((w) =>
          w.id === currentWindowId
            ? { ...w, messages: finalMessages, updatedAt: Date.now() }
            : w
        );
        return {
          chatWindows: finalWindows,
          messages: finalMessages,
          isGenerating: false,
          streamingText: '',
          currentReasoningSteps: [],
          isReasoning: false,
        };
      });

      // 保存到 storage（防抖）
      setTimeout(() => get().saveToStorage(), 500);

      unsubToken();
      unsubEnd();
      unsubError();
    });

    const unsubError = api.ai.onStreamError((errorMsg: string) => {
      set({
        isGenerating: false,
        streamingText: '',
        error: errorMsg,
      });
      unsubToken();
      unsubEnd();
      unsubError();
    });

    try {
      // 发送流式请求
      const allMessages = [systemMessage, ...newMessages];
      await api.ai.chatStream(allMessages, finalConfig);
    } catch (err: any) {
      set({
        isGenerating: false,
        streamingText: '',
        error: err?.message || '发送消息失败',
      });
      unsubToken();
      unsubEnd();
      unsubError();
    }
  },

  stopGeneration: () => {
    const { messages, streamingText, activeWindowId, chatWindows } = get();
    api.ai.stopGeneration();

    // 如果有已接收的流式文本，保存为一条 assistant 消息
    if (streamingText && activeWindowId) {
      const reasoningSteps = get().currentReasoningSteps;
      const assistantMessage: AIChatMessage = {
        role: 'assistant',
        content: streamingText,
        reasoningSteps: reasoningSteps.length > 0 ? [...reasoningSteps] : undefined,
        reasoningCollapsed: reasoningSteps.length > 0,
      };
      const finalMessages = [...messages, assistantMessage];

      const updatedWindows = chatWindows.map((w) =>
        w.id === activeWindowId
          ? { ...w, messages: finalMessages, updatedAt: Date.now() }
          : w
      );

      set({
        chatWindows: updatedWindows,
        messages: finalMessages,
        isGenerating: false,
        streamingText: '',
        currentReasoningSteps: [],
        isReasoning: false,
      });

      // 保存到 storage（防抖）
      setTimeout(() => get().saveToStorage(), 500);
    } else {
      set({ isGenerating: false, streamingText: '' });
    }
  },

  clearMessages: () => {
    const { activeWindowId, chatWindows } = get();
    if (!activeWindowId) return;

    const updatedWindows = chatWindows.map((w) =>
      w.id === activeWindowId
        ? { ...w, messages: [], title: '新对话', updatedAt: Date.now() }
        : w
    );

    set({
      chatWindows: updatedWindows,
      messages: [],
      streamingText: '',
      error: null,
    });

    api.chatHistory.clearMessages(activeWindowId).catch(() => {});
  },

  // 记忆系统 actions
  setMemoryEnabled: (enabled: boolean) => {
    set({ memoryEnabled: enabled });
  },

  loadMemories: async () => {
    try {
      const result = await api.ai.memoryList();
      if (result.success && result.data) {
        set({ memories: result.data });
      }
      // 加载记忆统计
      const statsResult = await api.ai.memoryStats();
      if (statsResult.success && statsResult.data) {
        set({ memoryStats: statsResult.data });
      }
    } catch (err) {
      console.warn('[AIStore] 加载记忆失败:', err);
    }
  },

  extractMemories: async (windowId: string) => {
    try {
      const { chatWindows } = get();
      const targetWindow = chatWindows.find((w) => w.id === windowId);
      if (!targetWindow || targetWindow.messages.length === 0) return;

      // 获取最近的对话消息用于提取记忆
      const recentMessages = targetWindow.messages.slice(-10).map((m) => ({
        role: m.role,
        content: typeof m.content === 'string' ? m.content : JSON.stringify(m.content),
      }));

      const config = buildProviderConfig();
      await api.ai.memoryExtract({ messages: recentMessages, config });

      // 提取完成后刷新记忆列表
      get().loadMemories().catch(() => {});
    } catch (err) {
      // 静默失败，不影响用户体验
      console.warn('[AIStore] 自动记忆提取失败:', err);
    }
  },

  deleteMemory: async (id: string) => {
    try {
      await api.ai.memoryDelete(id);
      get().loadMemories().catch(() => {});
    } catch (err) {
      console.warn('[AIStore] 删除记忆失败:', err);
    }
  },

  // RAG 知识库 actions
  loadRagStats: async () => {
    try {
      const result = await api.rag.stats();
      if (result.success && result.data) {
        set({ ragStats: result.data });
      }
    } catch (err) {
      console.warn('[AIStore] 加载RAG统计失败:', err);
    }
  },

  indexAllCreativities: async () => {
    const { ragIndexing } = get();
    if (ragIndexing) return;

    set({ ragIndexing: true });
    try {
      const config = buildProviderConfig();
      const result = await api.rag.indexAllCreativities(config);
      if (result.success && result.data) {
        console.log(`[AIStore] RAG索引完成: ${result.data.indexed}/${result.data.total} 条创意`);
      }
      get().loadRagStats().catch(() => {});
    } catch (err) {
      console.warn('[AIStore] RAG全量索引失败:', err);
    } finally {
      set({ ragIndexing: false });
    }
  },

  // 工作流 actions
  loadWorkflows: async () => {
    try {
      await api.workflow.initPresets();
      const result = await api.workflow.list();
      if (result.success && result.data) {
        set({ workflows: result.data, workflowsLoaded: true });
      }
    } catch (err) {
      console.warn('[AIStore] 加载工作流失败:', err);
    }
  },

  createWorkflow: async (workflow: any) => {
    try {
      const result = await api.workflow.create(workflow);
      if (result.success) {
        get().loadWorkflows();
      }
      return result;
    } catch (err) {
      console.warn('[AIStore] 创建工作流失败:', err);
      return { success: false, error: err };
    }
  },

  deleteWorkflow: async (id: string) => {
    try {
      await api.workflow.delete(id);
      get().loadWorkflows();
    } catch (err) {
      console.warn('[AIStore] 删除工作流失败:', err);
    }
  },

  runWorkflow: async (id: string) => {
    const { workflows } = get();
    const workflow = workflows.find((w: any) => w.id === id);
    if (!workflow) return;

    await api.workflow.recordRun(id);

    const stepsDesc = workflow.steps
      .map((s: any, i: number) => `${i + 1}. ${s.name}: ${s.goal}`)
      .join('\n');

    const prompt = `请按以下工作流步骤执行「${workflow.name}」：\n\n${stepsDesc}`;
    get().executeAgentTask(prompt);
  },

  // AI 使用统计 actions
  loadAIUsageStats: async (period?: string) => {
    try {
      const p = period || get().aiUsageStatsPeriod;
      const result = await api.aiStats.get(p);
      if (result.success && result.data) {
        set({ aiUsageStats: result.data, aiUsageStatsPeriod: p });
      }
    } catch (err) {
      console.warn('[AIStore] 加载AI统计失败:', err);
    }
  },

  // 对话导出
  exportChatAsMarkdown: (windowId?: string) => {
    const { windows, activeWindowId } = get();
    const wid = windowId || activeWindowId;
    const win = windows.find((w: any) => w.id === wid);
    if (!win) return '';

    const now = new Date();
    const dateStr = now.toLocaleString('zh-CN');
    const lines: string[] = [
      `# ${win.title || 'AI 对话'}`,
      '',
      `> 导出时间：${dateStr}`,
      `> 对话ID：${win.id}`,
      '',
      '---',
      '',
    ];

    for (const msg of win.messages) {
      const roleLabel = msg.role === 'user' ? '👤 用户' : msg.role === 'assistant' ? '🤖 AI' : '📝 系统';
      const time = msg.timestamp ? new Date(msg.timestamp).toLocaleTimeString('zh-CN') : '';
      lines.push(`### ${roleLabel}${time ? ` · ${time}` : ''}`);
      lines.push('');
      lines.push(msg.content || '');
      lines.push('');
      lines.push('---');
      lines.push('');
    }

    const md = lines.join('\n');

    const blob = new Blob([md], { type: 'text/markdown;charset=utf-8' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `${win.title || 'AI对话'}_${now.toISOString().split('T')[0]}.md`;
    a.click();
    URL.revokeObjectURL(url);

    return md;
  },

  exportChatAsPDF: (windowId?: string) => {
    const md = get().exportChatAsMarkdown(windowId);
    if (!md) return;

    const printWindow = window.open('', '_blank');
    if (!printWindow) return;

    const htmlContent = md
      .replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;')
      .replace(/^### (.+)$/gm, '<h3>$1</h3>')
      .replace(/^## (.+)$/gm, '<h2>$1</h2>')
      .replace(/^# (.+)$/gm, '<h1>$1</h1>')
      .replace(/^> (.+)$/gm, '<blockquote>$1</blockquote>')
      .replace(/^---$/gm, '<hr/>')
      .replace(/\n\n/g, '<br/><br/>')
      .replace(/\n/g, '<br/>');

    printWindow.document.write(`
      <!DOCTYPE html><html><head><meta charset="utf-8">
      <title>AI 对话导出</title>
      <style>
        body { font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif; max-width: 800px; margin: 0 auto; padding: 40px 20px; line-height: 1.6; color: #333; }
        h1 { font-size: 24px; border-bottom: 2px solid #eee; padding-bottom: 10px; }
        h2 { font-size: 20px; color: #555; }
        h3 { font-size: 16px; color: #666; margin-top: 20px; }
        blockquote { border-left: 3px solid #ddd; padding-left: 12px; color: #888; font-size: 13px; }
        hr { border: none; border-top: 1px solid #eee; margin: 16px 0; }
        code { background: #f5f5f5; padding: 2px 6px; border-radius: 3px; font-size: 13px; }
        pre { background: #f5f5f5; padding: 12px; border-radius: 6px; overflow-x: auto; }
      </style></head><body>${htmlContent}</body></html>
    `);
    printWindow.document.close();
    setTimeout(() => { printWindow.print(); }, 500);
  },

  // Tool Calling actions
  setToolCallsEnabled: (enabled: boolean) => {
    set({ toolCallsEnabled: enabled });
  },

  loadPromptTemplates: async (category?: string) => {
    try {
      await api.promptTemplate.initPresets();
      const result = await api.promptTemplate.list(category);
      if (result.success && result.data) {
        set({ promptTemplates: result.data });
      }
    } catch (err) {
      console.warn('[AIStore] 加载模板失败:', err);
    }
  },

  usePromptTemplate: async (templateId: string, variables?: Record<string, string>) => {
    try {
      const result = await api.promptTemplate.render(templateId, variables);
      if (result.success && result.data) {
        return result.data as string;
      }
      return null;
    } catch (err) {
      console.warn('[AIStore] 使用模板失败:', err);
      return null;
    }
  },

  createPromptTemplate: async (template: Partial<PromptTemplate>) => {
    try {
      const result = await api.promptTemplate.create(template);
      if (result.success) {
        await get().loadPromptTemplates();
      }
    } catch (err) {
      console.warn('[AIStore] 创建模板失败:', err);
    }
  },

  deletePromptTemplate: async (templateId: string) => {
    try {
      await api.promptTemplate.delete(templateId);
      await get().loadPromptTemplates();
    } catch (err) {
      console.warn('[AIStore] 删除模板失败:', err);
    }
  },

  // 推理过程可视化方法
  addReasoningStep: (step: Omit<AIReasoningStep, 'id' | 'timestamp'>) => {
    const newStep: AIReasoningStep = {
      ...step,
      id: `step_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
      timestamp: Date.now(),
    };
    set((state) => ({
      currentReasoningSteps: [...state.currentReasoningSteps, newStep],
      isReasoning: true,
    }));
  },

  clearReasoningSteps: () => {
    set({ currentReasoningSteps: [], isReasoning: false });
  },

  toggleMessageReasoning: (messageIndex: number) => {
    const { chatWindows, activeWindowId } = get();
    if (!activeWindowId) return;

    const windowIndex = chatWindows.findIndex((w) => w.id === activeWindowId);
    if (windowIndex === -1) return;

    const window = chatWindows[windowIndex];
    const message = window.messages[messageIndex];
    if (!message || message.role !== 'assistant') return;

    const newWindows = [...chatWindows];
    newWindows[windowIndex] = {
      ...window,
      messages: window.messages.map((m, idx) =>
        idx === messageIndex
          ? { ...m, reasoningCollapsed: !m.reasoningCollapsed }
          : m
      ),
    };

    set({ chatWindows: newWindows });
    setTimeout(() => get().saveToStorage(), 500);
  },

  // Agent 模式 actions
  setAgentModeEnabled: (enabled: boolean) => {
    set({ agentModeEnabled: enabled });
  },

  // 实时跟随模式
  setFollowMode: (enabled: boolean) => {
    set({ followMode: enabled });
  },

  executeAgentTask: async (instruction: string | AIMultimodalContent[], config?: Partial<AIProviderConfig>, creativityRefs?: AICreativityRef[]) => {
    const { messages, activeWindowId, chatWindows, memoryEnabled } = get();
    const { settings } = useSettingsStore.getState();
    if (!settings.aiEnabled) {
      set({ error: '请先在设置中开启 AI 功能' });
      return;
    }

    const baseConfig = buildProviderConfig();
    const finalConfig = { ...baseConfig, ...config };
    if (!finalConfig.apiKey) {
      set({ error: '请先配置 API Key' });
      return;
    }

    let currentWindowId = activeWindowId;
    if (!currentWindowId) {
      currentWindowId = get().createWindow();
    }

    // 提取文本内容用于技能检测和日志
    const instructionText = typeof instruction === 'string'
      ? instruction
      : instruction.filter((item) => item.type === 'text').map((item) => item.text || '').join(' ') || '[图片]';

    // ===== 技能检测：自动匹配用户需求与技能库（按需加载，不累积） =====
    let detectedSkillNames: string[] = [];
    try {
      const skillStore = useSkillStore.getState();
      const detections = await skillStore.detectSkills(instructionText);
      if (detections.length > 0) {
        detectedSkillNames = detections.map(d => d.skill.name);
        console.log('[AIStore] Agent模式检测到匹配技能:', detectedSkillNames);
        // 只记录使用次数，不累积到 activeSkills
        for (const detection of detections) {
          api.skill.incrementUse(detection.skill.id).catch(() => {});
        }
      }
    } catch (err) {
      console.warn('[AIStore] 技能检测失败:', err);
    }

    // Add user message (用元数据标记 Agent 模式，不在内容中显示前缀)
    const userMessage: AIChatMessage = {
      role: 'user',
      content: instruction,
      reasoningSteps: [{ id: 'agent_tag', type: 'planning', content: 'Agent 模式任务', timestamp: Date.now() }],
      ...(creativityRefs && creativityRefs.length > 0 ? { creativityRefs } : {}),
    };
    const newMessages = [...messages, userMessage];
    const updatedWindows = chatWindows.map((w) =>
      w.id === currentWindowId ? { ...w, messages: newMessages, updatedAt: Date.now() } : w
    );
    set({
      chatWindows: updatedWindows,
      messages: newMessages,
      agentIsRunning: true,
      agentTask: null,
      agentSteps: [],
      agentPhases: [],
      agentStatus: 'thinking',
      agentThinking: '',
      agentSummary: '',
      agentStepThinking: {},
      error: null,
      currentReasoningSteps: [],
      isReasoning: true,
    });

    // 添加推理步骤：开始分析
    get().addReasoningStep({ type: 'thinking', content: `分析用户需求：${instructionText.slice(0, 100)}${instructionText.length > 100 ? '...' : ''}` });
    if (detectedSkillNames.length > 0) {
      get().addReasoningStep({ type: 'analysis', content: `检测到匹配的技能：${detectedSkillNames.join(', ')}` });
    }

    try {
      let thinkingStepId = '';
      let thinkingStartTime = 0;

      const unsubThinking = api.ai.onThinkingToken?.((token: string) => {
        set((state) => {
          const updatedThinking = state.agentThinking + token;
          let updatedSteps = [...state.currentReasoningSteps];
          if (!thinkingStepId) {
            thinkingStepId = `thinking_${Date.now()}`;
            thinkingStartTime = Date.now();
            updatedSteps.push({
              id: thinkingStepId,
              type: 'thinking',
              content: token,
              timestamp: thinkingStartTime,
              isStreaming: true,
            });
          } else {
            updatedSteps = updatedSteps.map((s) =>
              s.id === thinkingStepId ? { ...s, content: s.content + token } : s
            );
          }
          return { agentThinking: updatedThinking, currentReasoningSteps: updatedSteps };
        });
      });

      const unsubThinkingEnd = api.ai.onThinkingEnd?.((fullThinking: string) => {
        set((state) => {
          const updatedSteps = state.currentReasoningSteps.map((s) =>
            s.id === thinkingStepId
              ? { ...s, content: fullThinking, isStreaming: false, duration: Date.now() - thinkingStartTime }
              : s
          );
          return { agentThinking: fullThinking, currentReasoningSteps: updatedSteps };
        });
        thinkingStepId = '';
      });

      const unsubPlanReady = api.ai.onPlanReady?.((plan: any) => {
        set((state) => {
          const planStep: AIReasoningStep = {
            id: `plan_${Date.now()}`,
            type: 'planning',
            content: plan.summary || '任务规划完成',
            timestamp: Date.now(),
            metadata: { phases: plan.phases?.length, steps: plan.steps?.length },
          };
          return {
            agentPhases: plan.phases || [],
            agentSteps: plan.steps || [],
            agentSummary: plan.summary || '',
            currentReasoningSteps: [...state.currentReasoningSteps, planStep],
          };
        });
      });

      // Listen for status changes
      const unsubStatus = api.ai.onStatusChange?.((status: string) => {
        set({ agentStatus: status });
      });

      // Listen for phase events
      const unsubPhaseStart = api.ai.onPhaseStart?.((data: any) => {
        set((state) => ({
          agentPhases: state.agentPhases.map((p: any, i: number) =>
            i === data.index ? { ...p, status: 'running' } : p
          ),
        }));
      });

      const unsubPhaseComplete = api.ai.onPhaseComplete?.((data: any) => {
        set((state) => ({
          agentPhases: state.agentPhases.map((p: any, i: number) =>
            i === data.index ? { ...p, status: data.phase.status } : p
          ),
        }));
      });

      // Listen for step events
      const unsubStepStart = api.ai.onAgentStepStart?.((step: any) => {
        set((state) => {
          const toolCallStep: AIReasoningStep = {
            id: `tool_call_${step.id || Date.now()}`,
            type: 'tool_call',
            content: step.goal || `调用 ${step.toolName || '工具'}`,
            timestamp: Date.now(),
            toolName: step.toolName,
            toolInput: step.toolArgs || step.toolInput,
            toolStatus: 'running',
            isStreaming: true,
          };
          return {
            agentSteps: state.agentSteps.map((s: any) =>
              s.id === step.id ? { ...s, status: 'running' } : s
            ),
            currentReasoningSteps: [...state.currentReasoningSteps, toolCallStep],
          };
        });
      });

      const unsubStepComplete = api.ai.onAgentStepComplete?.((step: any) => {
        set((state) => {
          const resultStep: AIReasoningStep = {
            id: `tool_result_${step.id || Date.now()}`,
            type: 'tool_result',
            content: step.result ? (step.result.length > 200 ? step.result.substring(0, 200) + '...' : step.result) : '工具执行完成',
            timestamp: Date.now(),
            toolOutput: step.result || '',
            toolStatus: 'success',
            duration: step.duration,
          };
          const updatedSteps = state.currentReasoningSteps.map((s) =>
            s.type === 'tool_call' && s.toolStatus === 'running'
              ? { ...s, toolStatus: 'success' as const, isStreaming: false, duration: step.duration }
              : s
          );
          return {
            agentSteps: state.agentSteps.map((s: any) =>
              s.id === step.id ? { ...s, status: 'completed', result: step.result } : s
            ),
            currentReasoningSteps: [...updatedSteps, resultStep],
          };
        });
      });

      const unsubStepError = api.ai.onAgentStepError?.((data: any) => {
        set((state) => {
          const errorStep: AIReasoningStep = {
            id: `tool_error_${data.step?.id || Date.now()}`,
            type: 'tool_result',
            content: data.error || '工具执行失败',
            timestamp: Date.now(),
            toolStatus: 'error',
            duration: data.duration,
          };
          const updatedSteps = state.currentReasoningSteps.map((s) =>
            s.type === 'tool_call' && s.toolStatus === 'running'
              ? { ...s, toolStatus: 'error' as const, isStreaming: false }
              : s
          );
          return {
            agentSteps: state.agentSteps.map((s: any) =>
              s.id === data.step?.id ? { ...s, status: 'failed', error: data.error } : s
            ),
            currentReasoningSteps: [...updatedSteps, errorStep],
          };
        });
      });

      // Listen for step thinking
      const unsubStepThinking = api.ai.onStepThinking?.((data: any) => {
        set((state) => ({
          agentStepThinking: {
            ...state.agentStepThinking,
            [data.stepId]: (state.agentStepThinking[data.stepId] || '') + data.token,
          },
        }));
      });

      // Listen for task complete
      const unsubTaskComplete = api.ai.onAgentTaskComplete?.((task: any) => {
        const reasoningSteps = get().currentReasoningSteps.filter(
          (s) => !(s.type === 'thinking' && s.id === 'agent_tag')
        );
        const assistantMessage: AIChatMessage = {
          role: 'assistant',
          content: task.finalResult || '任务已完成',
          reasoningSteps: reasoningSteps.length > 0 ? reasoningSteps : undefined,
          reasoningCollapsed: true,
        };
        const finalMessages = [...newMessages, assistantMessage];
        set((state) => {
          const finalWindows = state.chatWindows.map((w) =>
            w.id === currentWindowId ? { ...w, messages: finalMessages, updatedAt: Date.now() } : w
          );
          return {
            chatWindows: finalWindows,
            messages: finalMessages,
            agentIsRunning: false,
            agentStatus: task.status,
            agentTask: task,
          };
        });
        setTimeout(() => get().saveToStorage(), 500);

        // ===== 自动记忆提取：对话结束后自动蒸馏记忆 =====
        if (memoryEnabled) {
          get().addReasoningStep({ type: 'reflection', content: '正在提取对话记忆...' });
          get().extractMemories(currentWindowId).then(() => {
            get().addReasoningStep({ type: 'reflection', content: '记忆提取完成' });
          }).catch(() => {
            // 静默处理记忆提取失败
          });
        }

        // Cleanup all subscriptions
        unsubThinking?.();
        unsubThinkingEnd?.();
        unsubPlanReady?.();
        unsubStatus?.();
        unsubPhaseStart?.();
        unsubPhaseComplete?.();
        unsubStepStart?.();
        unsubStepComplete?.();
        unsubStepError?.();
        unsubStepThinking?.();
        unsubTaskComplete?.();
        unsubTaskError?.();
      });

      // Listen for task error
      const unsubTaskError = api.ai.onAgentTaskError?.((data: any) => {
        const errorMessage = data?.error || '任务执行失败';
        const assistantMessage: AIChatMessage = {
          role: 'assistant',
          content: `❌ 任务执行失败：${errorMessage}`,
        };
        const finalMessages = [...newMessages, assistantMessage];
        set((state) => {
          const finalWindows = state.chatWindows.map((w) =>
            w.id === currentWindowId ? { ...w, messages: finalMessages, updatedAt: Date.now() } : w
          );
          return {
            chatWindows: finalWindows,
            messages: finalMessages,
            agentIsRunning: false,
            agentStatus: 'failed',
            agentTask: data?.task || null,
          };
        });
        setTimeout(() => get().saveToStorage(), 500);
        // Cleanup all subscriptions
        unsubThinking?.();
        unsubThinkingEnd?.();
        unsubPlanReady?.();
        unsubStatus?.();
        unsubPhaseStart?.();
        unsubPhaseComplete?.();
        unsubStepStart?.();
        unsubStepComplete?.();
        unsubStepError?.();
        unsubStepThinking?.();
        unsubTaskComplete?.();
        unsubTaskError?.();
      });

      let finalInstruction: string | AIMultimodalContent[] = instruction;

      // RAG 上下文注入到 Agent 指令
      try {
        const ragResults = await api.rag.search(instructionText, finalConfig, { limit: 3, minScore: 0.3 });
        if (ragResults.success && ragResults.data && ragResults.data.length > 0) {
          const ragContext = ragResults.data
            .map((r: any, i: number) => `[${i + 1}] (相关度: ${(r.score * 100).toFixed(0)}%) ${r.contentChunk}`)
            .join('\n\n');
          if (typeof finalInstruction === 'string') {
            finalInstruction += `\n\n【用户创意库相关内容】\n${ragContext}`;
          } else {
            // 多模态：追加到文本部分
            finalInstruction = finalInstruction.map((item) =>
              item.type === 'text' ? { ...item, text: item.text + `\n\n【用户创意库相关内容】\n${ragContext}` } : item
            );
          }
        }
      } catch (err) {
        console.warn('[AIStore] Agent RAG检索失败:', err);
      }

      // 技能上下文注入到 Agent 指令（按需加载：只注入描述摘要，不注入完整内容）
      try {
        const skillStore = useSkillStore.getState();
        const detections = await skillStore.detectSkills(
          typeof finalInstruction === 'string' ? finalInstruction : finalInstruction.filter(i => i.type === 'text').map(i => i.text).join(' ')
        );
        if (detections.length > 0) {
          const skillSummaries = detections.map(d =>
            `- ${d.skill.icon} ${d.skill.name}（${d.skill.category}）：${d.skill.description} [ID: ${d.skill.id}]`
          );
          const skillHint = `\n\n【可用技能】\n以下技能可能与当前任务相关，如需使用请先调用 get_skill_prompt(skill_id) 获取完整指南：\n${skillSummaries.join('\n')}`;
          if (typeof finalInstruction === 'string') {
            finalInstruction += skillHint;
          } else {
            finalInstruction = finalInstruction.map((item) =>
              item.type === 'text' ? { ...item, text: item.text + skillHint } : item
            );
          }
        }
      } catch (err) {
        console.warn('[AIStore] Agent 技能注入失败:', err);
      }

      await api.ai.agentExecuteTask(finalInstruction, finalConfig);
    } catch (err: any) {
      // 向聊天窗口添加失败消息
      const errorMessage = err?.message || 'Agent 任务执行失败';
      const assistantMessage: AIChatMessage = {
        role: 'assistant',
        content: `❌ 任务执行失败：${errorMessage}`,
      };
      const finalMessages = [...newMessages, assistantMessage];
      const finalWindows = chatWindows.map((w) =>
        w.id === currentWindowId ? { ...w, messages: finalMessages, updatedAt: Date.now() } : w
      );
      set({
        chatWindows: finalWindows,
        messages: finalMessages,
        agentIsRunning: false,
        agentStatus: 'failed',
        error: errorMessage,
      });
      setTimeout(() => get().saveToStorage(), 500);
    }
  },

  cancelAgentTask: () => {
    api.ai.agentCancelTask?.();
    set({ agentIsRunning: false });
  },

  clearAllWindows: () => {
    const { chatWindows } = get();
    // 从 SQLite 删除所有窗口
    for (const win of chatWindows) {
      api.chatHistory.deleteWindow(win.id).catch(() => {});
    }
    localStorage.removeItem(STORAGE_ACTIVE_WINDOW_KEY);
    set({
      chatWindows: [],
      activeWindowId: null,
      messages: [],
      streamingText: '',
      error: null,
    });
    get().createWindow();
  },
}));

/** 导出音乐意图检测函数，供组件使用 */
export { isMusicRelated };
