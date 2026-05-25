// 创意类型
export type WritingSubtype = string;

export const SUBTYPE_CONFIG: Record<string, { label: string; color: string; icon: string }> = {
  idea: { label: '灵感', color: '#F59E0B', icon: '💡' },
  outline: { label: '大纲', color: '#6366F1', icon: '📋' },
  character: { label: '人物', color: '#EC4899', icon: '👤' },
  scene: { label: '场景', color: '#10B981', icon: '🏔️' },
  dialogue: { label: '对话', color: '#8B5CF6', icon: '💬' },
  chapter: { label: '章节', color: '#3B82F6', icon: '📖' },
  worldbuilding: { label: '世界观', color: '#F97316', icon: '🌍' },
  plot: { label: '情节', color: '#EF4444', icon: '🎭' },
};

const CUSTOM_SUBTYPES_KEY = 'mindvault-custom-subtypes';

const CUSTOM_COLORS = ['#14B8A6', '#A855F7', '#F43F5E', '#84CC16', '#06B6D4', '#E11D48', '#8B5CF6', '#D946EF', '#0EA5E9', '#65A30D'];
const CUSTOM_ICONS = ['✨', '🎯', '🔮', '📝', '🎨', '🎵', '📷', '🔬', '💡', '🌟', '📌', '🔖', '🎪', '🧩', '🗝️'];

export function getCustomSubtypes(): Record<string, { label: string; color: string; icon: string }> {
  try {
    return JSON.parse(localStorage.getItem(CUSTOM_SUBTYPES_KEY) || '{}');
  } catch { return {}; }
}

export function getAllSubtypes(): Record<string, { label: string; color: string; icon: string }> {
  return { ...SUBTYPE_CONFIG, ...getCustomSubtypes() };
}

export function addCustomSubtype(key: string, label: string): void {
  const customs = getCustomSubtypes();
  const existingKeys = Object.keys({ ...SUBTYPE_CONFIG, ...customs });
  const colorIndex = existingKeys.length % CUSTOM_COLORS.length;
  const iconIndex = existingKeys.length % CUSTOM_ICONS.length;
  customs[key] = { label, color: CUSTOM_COLORS[colorIndex], icon: CUSTOM_ICONS[iconIndex] };
  localStorage.setItem(CUSTOM_SUBTYPES_KEY, JSON.stringify(customs));
}

export function removeCustomSubtype(key: string): void {
  const customs = getCustomSubtypes();
  delete customs[key];
  localStorage.setItem(CUSTOM_SUBTYPES_KEY, JSON.stringify(customs));
}

export interface Creativity {
  id: string;
  title: string;
  content: string;
  type: 'text' | 'image' | 'audio' | 'link' | 'video' | 'document' | 'other';
  subtype?: WritingSubtype;
  contentFormat?: 'plain' | 'markdown';
  wordCount?: number;
  priority: number; // 0=无, 1-5星
  emojiReaction: string | null;
  status: 'active' | 'archived' | 'trashed';
  templateId: string | null;
  boardId: string | null;
  positionX: number | null;
  positionY: number | null;
  cardStyle: string | null; // JSON string
  createdAt: string;
  updatedAt: string;
  lastReviewedAt: string | null;
  isRead: boolean;
  isFavorite?: boolean;
  mediaFilePath?: string;
  thumbnailPath?: string;
  tags?: Tag[];
  paraType?: string;
}

export interface Tag {
  id: string;
  name: string;
  color: string | null;
  icon: string | null;
  createdAt: string;
}

export interface Board {
  id: string;
  name: string;
  description: string | null;
  background: string | null;
  theme: string | null;
  layout: 'board' | 'canvas' | 'graph' | 'folder';
  sortOrder: number;
  createdAt: string;
  updatedAt: string;
  projectStatus?: string;
  icon?: string;  // 图标文件路径
}

export interface MediaFile {
  id: string;
  creativityId: string;
  fileType: 'image' | 'audio' | 'video' | 'document';
  filePath: string;
  thumbnailPath: string | null;
  metadata: string | null;
  createdAt: string;
}

export interface Template {
  id: string;
  name: string;
  description: string | null;
  category: string | null;
  config: string; // JSON
  isBuiltin: boolean;
  createdAt: string;
}

export interface CreativityLink {
  sourceId: string;
  targetId: string;
  relationType: 'related' | 'derived' | 'combined';
  createdAt: string;
}

// 搜索筛选条件
export interface SearchFilter {
  keyword?: string;
  tags?: string[];
  types?: string[];
  priorityMin?: number;
  priorityMax?: number;
  dateFrom?: string;
  dateTo?: string;
  boardId?: string;
  status?: string;
}

// 分页
export interface Pagination {
  page: number;
  pageSize: number;
  total: number;
}

// 列表结果
export interface ListResult<T> {
  data: T[];
  pagination: Pagination;
}

// 自定义主题配置
export interface CustomThemeConfig {
  primaryColor: string;
  primaryHover: string;
  primaryLight: string;
  primaryBg: string;
  bgPrimary: string;
  bgSecondary: string;
  bgTertiary: string;
  textPrimary: string;
  textSecondary: string;
  textTertiary: string;
  borderColor: string;
  borderLight: string;
  successColor: string;
  warningColor: string;
  errorColor: string;
  infoColor: string;
}

// 设置
export interface AppSettings {
  theme: 'light' | 'dark' | 'morandi-warm' | 'morandi-cool' | 'morandi-nature' | 'custom';
  customTheme: string | null; // JSON string of CustomThemeConfig
  language: string;
  fontSize: number;
  fontFamily: string;
  fontLineHeight: number;
  h1FontFamily: string;
  h2FontFamily: string;
  h3FontFamily: string;
  titleHighlightFontFamily: string;
  titleFontFamily: string;
  specialFontFamily: string;
  englishFontFamily: string;
  boardTitleFontFamily: string;
  boardBodyFontFamily: string;
  boardSpecialFontFamily: string;
  extensionFontFamily: string;
  customFonts: string;
  soundEnabled: boolean;
  soundVolume: number;
  keyPressSoundEnabled: boolean;
  autoBackup: boolean;
  autoBackupInterval: number;
  privacyLock: boolean;
  privacyPassword: string | null;
  privacyLockOnStartup: boolean;
  privacyLockOnMinimize: boolean;
  privacyAutoLockMinutes: number | null;
  privacyMaxAttempts: number;
  privacyLockoutMinutes: number;
  privacyShowHint: boolean;
  privacyHint: string | null;
  customCursor: boolean;
  canvasImportThreshold: number;
  canvasImportOverThresholdAction: 'prompt' | 'copy' | 'link';
  nickname: string;
  avatar: string | null;
  signature: string;
  exportIncludedFields: string[];

  // ===== AI 设置 =====
  aiEnabled: boolean;
  aiDefaultProvider: 'openai' | 'anthropic' | 'deepseek' | 'custom';
  aiDefaultModel: string;
  aiOpenaiApiKey: string;
  aiOpenaiBaseUrl: string;
  aiOpenaiModel: string;
  aiAnthropicApiKey: string;
  aiAnthropicModel: string;
  aiDeepseekApiKey: string;
  aiDeepseekModel: string;
  aiCustomApiKey: string;
  aiCustomBaseUrl: string;
  aiCustomModel: string;
  aiCustomProviderName: string;

  // 在线音乐设置 (QQ音乐)
  qqMusicCookie: string;
  // 在线音乐设置 (网易云)
  neteaseCookie: string;

  // TTS 朗读设置
  ttsVoice: string;
  ttsRate: number;
  ttsPitch: number;
  ttsVolume: number;

  // 音频设备设置
  audioInputDeviceId: string | null;
  audioOutputDeviceId: string | null;
}

// ===== AI 相关类型 =====
export interface AIProviderConfig {
  provider: 'openai' | 'anthropic' | 'deepseek' | 'custom';
  apiKey: string;
  baseUrl?: string;
  model: string;
}

// ===== AI 多模态内容类型 =====

export interface AIMultimodalContent {
  type: 'text' | 'image_url';
  text?: string;
  image_url?: { url: string };
}

export interface AICreativityRef {
  id: string;
  title: string;
  type: string;
  content?: string;
  mediaFilePath?: string;
  tags?: Array<{ id: string; name: string; color?: string | null }>;
}

export interface AIChatMessage {
  role: 'system' | 'user' | 'assistant';
  content: string | AIMultimodalContent[];
  reasoningSteps?: AIReasoningStep[];
  reasoningCollapsed?: boolean;
  creativityRefs?: AICreativityRef[];
  // 新版 QueryEngine 消息类型
  type?: 'text' | 'tool_call' | 'tool_result' | 'compact_boundary' | 'permission_request';
  toolCallId?: string;
  toolName?: string;
  toolInput?: Record<string, any>;
  toolResult?: string;
  toolError?: boolean;
  compactSummary?: string;
  compactPreTokens?: number;
  compactPostTokens?: number;
  permissionToolName?: string;
  permissionReason?: string;
  permissionDecision?: 'allow' | 'deny';
}

export interface AIReasoningStep {
  id: string;
  type: 'thinking' | 'tool_call' | 'tool_result' | 'analysis' | 'planning' | 'reflection';
  content: string;
  timestamp: number;
  metadata?: Record<string, any>;
  duration?: number;
  toolName?: string;
  toolInput?: Record<string, any>;
  toolOutput?: string;
  toolStatus?: 'running' | 'success' | 'error';
  isStreaming?: boolean;
  parentStepId?: string;
}

// ========== QueryEngine 相关类型 ==========

export interface QueryEngineMessage {
  type: 'user' | 'assistant' | 'system' | 'tool_result' | 'compact_boundary';
  uuid: string;
  timestamp: number;
  content?: string;
  toolUseResult?: string;
  toolUseId?: string;
  toolName?: string;
  isCompactSummary?: boolean;
  compactMetadata?: {
    preCompactTokenCount: number;
    postCompactTokenCount: number;
    summary: string;
  };
  usage?: {
    inputTokens: number;
    outputTokens: number;
  };
}

export interface PermissionRequest {
  toolName: string;
  input: Record<string, any>;
  reason: string;
  resolve: (decision: 'allow' | 'deny') => void;
}

// ========== 看板创意库相关类型 ==========

export interface BoardCanvasItem {
  id: string;
  boardId: string;
  creativityId: string;
  positionX: number;
  positionY: number;
  width: number | null;
  height: number | null;
  title: string | null;
  content: string | null;
  type: string | null;
  subtype?: string | null;
  cardStyle?: string | null;
  priority?: number;
  emojiReaction?: string | null;
  isFavorite?: boolean;
  contentFormat?: string;
  isLinked: boolean;
  creativity?: Creativity;
  videoLoopMode?: number;
  videoFrozenTime?: number;
  createdAt: string;
}

// 连接点位置类型
export type ConnectorSide = 'left' | 'right' | 'top' | 'bottom';

export interface ConnectorPosition {
  side: ConnectorSide;
  offset: number;
  relativeX?: number;
  relativeY?: number;
}

export interface EdgeControlPoint {
  id: string;
  x: number;
  y: number;
}

export interface BoardCanvasEdge {
  id: string;
  boardId: string;
  sourceItemId: string;
  targetItemId: string;
  edgeType: 'related' | 'derived' | 'custom' | 'chapter-order' | 'character-relation';
  label: string | null;
  sourceConnector?: ConnectorPosition | null; // 源连接点位置
  targetConnector?: ConnectorPosition | null; // 目标连接点位置
  controlPoints?: EdgeControlPoint[] | null;
  createdAt: string;
}

export interface BoardStickyNote {
  id: string;
  boardId: string;
  title: string;
  content: string;
  color: string;
  positionX: number;
  positionY: number;
  sourceCreativityIds: string[] | null;
  sortOrder: number;
  subtype?: string;
  // 新增：创意链类型支持
  type: 'note' | 'creative-chain';
  creativeChainId?: string;
  tags?: string[];
  createdAt: string;
  updatedAt: string;
}

// ========== 创意链相关类型 ==========

export interface CreativeChainSnapshotItem {
  creativityId: string;
  positionX: number;
  positionY: number;
  width?: number | null;
  height?: number | null;
  videoLoopMode?: number;
  videoFrozenTime?: number;
  creativitySnapshot?: {
    title: string;
    content: string;
    type: string;
    subtype?: string | null;
    contentFormat?: string;
    priority?: number;
    emojiReaction?: string | null;
    cardStyle?: string | null;
    isFavorite?: boolean;
    mediaFilePath?: string;
    tags?: string[];
  };
}

export interface CreativeChainSnapshotEdge {
  sourceId: string;
  targetId: string;
  edgeType: string;
  label?: string | null;
  sourceConnector?: ConnectorPosition | null;
  targetConnector?: ConnectorPosition | null;
  controlPoints?: EdgeControlPoint[] | null;
  sourceIdx?: number;
  targetIdx?: number;
}

export interface CreativeChainSnapshot {
  items: CreativeChainSnapshotItem[];
  edges: CreativeChainSnapshotEdge[];
  canvasOffset?: { x: number; y: number };
  canvasScale?: number;
}

export interface CreativeChain {
  id: string;
  boardId: string;
  name: string;
  description?: string;
  tags?: string[];
  color?: string;
  // 核心：保存当时的画布状态
  snapshot: CreativeChainSnapshot;
  createdAt: string;
  updatedAt: string;
}

// ========== 看板文件夹相关类型 ==========

export interface BoardFolder {
  id: string;
  boardId: string;
  name: string;
  parentId?: string;
  color?: string;
  icon?: string;
  creativityIds: string[];
  sortOrder: number;
  createdAt: string;
  updatedAt: string;
}

export interface BoardGraphNode {
  id: string;
  boardId: string;
  creativityId: string | null;
  parentId: string | null;
  positionX: number | null;
  positionY: number | null;
  nodeType: 'creativity' | 'group' | 'custom';
  label: string | null;
  creativity?: Creativity;
  children?: BoardGraphNode[];
  createdAt: string;
}

export interface BoardGraphEdge {
  id: string;
  boardId: string;
  sourceNodeId: string;
  targetNodeId: string;
  edgeType: 'child' | 'related' | 'cross-link';
  createdAt: string;
}

export interface BoardCustomFolder {
  id: string;
  boardId: string;
  name: string;
  color: string;
  icon: string | null;
  sortOrder: number;
  createdAt: string;
  itemCount?: number;
}

// ========== 回收站相关类型 ==========

export type TrashItemType = 'creativity' | 'folder' | 'canvas-item' | 'board-sticky' | 'chapter' | 'volume' | 'board';

// 智能标签类型
export type SmartLabelType = 'recent' | 'large-file' | 'frequent-access' | 'important' | 'large-folder';

export interface SmartLabel {
  type: SmartLabelType;
  label: string;
  color: string;
  description: string;
}

export interface TrashItem {
  id: string;
  itemType: TrashItemType;
  itemId: string;
  sourceBoardId: string | null;
  sourceBoardName: string | null;
  snapshot: string;
  deletedAt: string;
  // 扩展字段
  fileSize?: number;
  versionCount?: number;
  tags?: string[];
  smartLabels?: SmartLabel[];
  metadata?: TrashItemMetadata;
  cloudStatus?: 'local' | 'syncing' | 'synced' | 'error';
  cloudId?: string;
  accessCount?: number;
  lastAccessed?: string;
  originalCreatedAt?: string;
  notes?: string;
}

// 回收站项元数据
export interface TrashItemMetadata {
  priority?: number;
  itemCount?: number;
  creativityCount?: number;
  wordCount?: number;
  originalBoardId?: string;
  [key: string]: any;
}

// 版本快照
export interface TrashVersion {
  id: string;
  trashItemId: string;
  versionData: any;
  versionNumber: number;
  createdAt: string;
  changeDescription?: string;
  createdBy?: string;
}

// 操作历史记录
export type TrashActionType = 'restore' | 'delete' | 'permanent_delete' | 'move' | 'batch_restore' | 'batch_delete' | 'auto_clean';

export interface TrashHistoryRecord {
  id: string;
  action: TrashActionType;
  trashItemId?: string;
  itemTitle: string;
  itemType?: TrashItemType;
  operator?: string;
  targetInfo?: TrashHistoryTargetInfo;
  createdAt: string;
  cloudSynced?: 'pending' | 'synced' | 'error';
  description?: string;
  metadata?: any;
}

export interface TrashHistoryTargetInfo {
  boardId?: string;
  boardName?: string;
  position?: number;
}

// 回收站设置
export interface TrashSettings {
  autoCleanEnabled: boolean;
  autoCleanDays: number;
  maxCapacityMB: number;
  notificationEnabled: boolean;
  cloudSyncEnabled: boolean;
  cloudSyncProvider?: 'dropbox' | 'onedrive' | 'google-drive';
  lastCleanTime?: string;
  smartCleanEnabled?: boolean;
}

// 容量信息
export interface TrashCapacity {
  usedMB: number;
  totalMB: number;
  usedPercent: number;
  itemCount: number;
  byType: Record<TrashItemType, { count: number; sizeMB: number }>;
}

// 统计数据
export interface TrashStats {
  totalItems: number;
  byType: Record<TrashItemType, number>;
  byDays: Record<string, number>;
  averageAge: number;
  largestItem?: { title: string; sizeMB: number };
  oldestItem?: { title: string; daysAgo: number };
}

// 搜索过滤器
export interface TrashSearchFilters {
  keyword?: string;
  types?: TrashItemType[];
  dateFrom?: string;
  dateTo?: string;
  minSize?: number;
  maxSize?: number;
  tags?: string[];
}

// AI 建议类型
export type AISuggestionType = 'restore-suggestion' | 'clean-suggestion' | 'organize-suggestion';

export interface TrashAISuggestion {
  type: AISuggestionType;
  title: string;
  description: string;
  itemIds: string[];
  reason: string;
  confidence: number;
  action?: {
    type: 'restore' | 'delete' | 'archive';
    targetBoardId?: string;
  };
}

// 项目关联关系
export interface TrashItemRelation {
  type: 'folder-contents' | 'board-contents' | 'linked-creativities';
  relatedItems: TrashRelatedItem[];
  totalCount: number;
}

export interface TrashRelatedItem {
  id: string;
  title: string;
  type: TrashItemType;
}

// 项目对比结果
export interface TrashCompareResult {
  item1: TrashVersion;
  item2: TrashVersion;
  differences: TrashDiffItem[];
}

export interface TrashDiffItem {
  field: string;
  oldValue: any;
  newValue: any;
}

// 删除影响评估
export interface TrashDeleteImpact {
  itemId: string;
  itemTitle: string;
  fileSize: number;
  relatedCount: number;
  versionCount: number;
  hasLinkedItems: boolean;
}

// ===== AI 记忆系统类型 =====

export interface AIMemory {
  id: string;
  type: 'fact' | 'preference' | 'style' | 'goal' | 'context';
  content: string;
  category: string;
  importance: number;
  createdAt: number;
  lastAccessed: number;
  accessCount: number;
  source: string;
}

// ===== AI Tool Calling 类型 =====

export interface AIToolCall {
  name: string;
  args: Record<string, any>;
  result: string;
}

export interface AIToolCallDisplay {
  id: string;
  name: string;
  args: Record<string, any>;
  result: string;
  status: 'calling' | 'completed' | 'error';
  timestamp: number;
}

// ===== AI 用户画像类型 =====

export interface AIUserProfile {
  writingStyle: string;
  preferredTopics: string[];
  expertiseAreas: string[];
  responseLength: 'concise' | 'detailed' | 'balanced';
  tone: 'formal' | 'casual' | 'friendly' | 'professional';
  languageStyle: string;
  creativePreferences: {
    genres: string[];
    themes: string[];
  };
}

export interface PromptTemplate {
  id: string;
  name: string;
  description: string;
  category: 'creative' | 'writing' | 'analysis' | 'organize' | 'coding' | 'custom';
  template: string;
  variables?: Record<string, { type: 'text' | 'select'; default?: string; options?: string[] }>;
  isPreset?: boolean;
  useCount?: number;
  createdAt?: string;
}

// ===== MCP 相关类型 =====

export interface MCPServerConfig {
  id: string;
  name: string;
  command: string;
  args: string[];
  env?: Record<string, string>;
  enabled: boolean;
}

export interface MCPServerStatus {
  id: string;
  name: string;
  status: 'connected' | 'disconnected' | 'error';
  toolCount: number;
  error?: string;
}

// ===== Agent 相关类型 =====

export interface AgentTaskStep {
  id: string;
  index: number;
  goal: string;
  toolName?: string;
  toolArgs?: Record<string, any>;
  expectedResult?: string;
  status: 'pending' | 'running' | 'completed' | 'failed' | 'skipped';
  result?: string;
  error?: string;
  startedAt?: number;
  completedAt?: number;
  retryCount: number;
}

export interface AgentTask {
  id: string;
  userInstruction: string;
  steps: AgentTaskStep[];
  status: 'planning' | 'executing' | 'reflecting' | 'completed' | 'failed' | 'cancelled';
  currentStepIndex: number;
  createdAt: number;
  updatedAt: number;
  finalResult?: string;
  error?: string;
}

export interface AgentWorkflow {
  id: string;
  name: string;
  description: string;
  triggerKeywords: string[];
  steps: Omit<AgentTaskStep, 'id' | 'status' | 'startedAt' | 'completedAt' | 'retryCount' | 'result' | 'error'>[];
}

// ===== UI 上下文类型 =====

export interface UIContext {
  currentPage: string;
  selectedCreativityId?: string;
  activeBoardId?: string;
  focusedElement?: string;
  visibleCreativities: string[];
  userAction: string;
  timestamp: number;
}

// ===== AI 导航指令 =====

export interface AINavigationCommand {
  page: string;
  params?: Record<string, any>;
  timestamp: number;
}

// ===== AI 操作可视化 =====

export interface AIAction {
  id: string;
  type: 'tool_call' | 'navigation' | 'creation' | 'modification' | 'deletion';
  description: string;
  status: 'pending' | 'executing' | 'completed' | 'failed';
  targetElement?: string;
  timestamp: number;
  result?: string;
}

// ========== 聊天室写作模式类型 ==========

// 聊天室人物
export interface ChatCharacter {
  id: string;
  boardId: string;
  name: string;
  avatar: string;
  personality: string;
  speechStyle: string;
  color: string;
  creativityId?: string;
  sortOrder: number;
  createdAt: string;
}

// 人物关系
export interface ChatCharacterRelation {
  id: string;
  boardId: string;
  characterAId: string;
  characterBId: string;
  relationType: string;
  description: string;
}

// 聊天室消息
export interface ChatMessage {
  id: string;
  boardId: string;
  volumeId: string;
  chapterId?: string;
  type: 'dialogue' | 'narration' | 'system';
  characterId?: string;
  content: string;
  mediaUrl?: string;
  mediaType?: string;
  sortOrder: number;
  createdAt: string;
}

// 聊天室场景
export interface ChatScene {
  id: string;
  boardId: string;
  volumeId: string;
  name: string;
  description: string;
  characters: string[];
  sortOrder: number;
}
