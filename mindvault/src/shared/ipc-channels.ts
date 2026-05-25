// IPC 通道名称常量
// 命名规范: domain:action

// 创意相关
export const IPC_CHANNELS = {
  // 创意 CRUD
  CREATIVITY_LIST: 'creativity:list',
  CREATIVITY_GET: 'creativity:get',
  CREATIVITY_CREATE: 'creativity:create',
  CREATIVITY_UPDATE: 'creativity:update',
  CREATIVITY_DELETE: 'creativity:delete',
  CREATIVITY_RESTORE: 'creativity:restore',
  CREATIVITY_SEARCH: 'creativity:search',
  CREATIVITY_RANDOM: 'creativity:random',
  CREATIVITY_COUNT: 'creativity:count',
  CREATIVITY_STATS: 'creativity:stats',

  // 标签
  TAG_LIST: 'tag:list',
  TAG_CREATE: 'tag:create',
  TAG_UPDATE: 'tag:update',
  TAG_DELETE: 'tag:delete',

  // 看板
  BOARD_LIST: 'board:list',
  BOARD_GET: 'board:get',
  BOARD_CREATE: 'board:create',
  BOARD_UPDATE: 'board:update',
  BOARD_DELETE: 'board:delete',

  // 媒体文件
  MEDIA_SAVE: 'media:save',
  MEDIA_DELETE: 'media:delete',
  MEDIA_GET: 'media:get',

  // 模板
  TEMPLATE_LIST: 'template:list',
  TEMPLATE_GET: 'template:get',
  TEMPLATE_CREATE: 'template:create',
  TEMPLATE_UPDATE: 'template:update',
  TEMPLATE_DELETE: 'template:delete',

  // 创意关联
  LINK_CREATE: 'link:create',
  LINK_DELETE: 'link:delete',
  LINK_LIST: 'link:list',

  // 设置
  SETTINGS_GET: 'settings:get',
  SETTINGS_SAVE: 'settings:save',
  SETTINGS_RESET: 'settings:reset',

  // 导出
  EXPORT_JSON: 'export:json',
  EXPORT_MARKDOWN: 'export:markdown',
  EXPORT_HTML: 'export:html',

  // 导入
  IMPORT_JSON: 'import:json',

  // 备份
  BACKUP_CREATE: 'backup:create',
  BACKUP_RESTORE: 'backup:restore',
  BACKUP_LIST: 'backup:list',

  // 文件操作
  FILE_OPEN: 'file:open',
  FILE_SAVE: 'file:save',
  FILE_SELECT: 'file:select',
  FILE_SELECT_FOLDER: 'file:select-folder',

  // 窗口操作
  WINDOW_MINIMIZE: 'window:minimize',
  WINDOW_MAXIMIZE: 'window:maximize',
  WINDOW_CLOSE: 'window:close',

  // 应用
  APP_GET_VERSION: 'app:get-version',
  APP_GET_PATH: 'app:get-path',

  // MCP
  MCP_LIST_SERVERS: 'mcp:list-servers',
  MCP_CONNECT_SERVER: 'mcp:connect-server',
  MCP_DISCONNECT_SERVER: 'mcp:disconnect-server',
  MCP_LIST_TOOLS: 'mcp:list-tools',
  MCP_CALL_TOOL: 'mcp:call-tool',
  MCP_GET_STATUS: 'mcp:get-status',
  MCP_ADD_SERVER: 'mcp:add-server',
  MCP_REMOVE_SERVER: 'mcp:remove-server',
  MCP_UPDATE_SERVER: 'mcp:update-server',

  // Agent
  AGENT_EXECUTE_TASK: 'agent:execute-task',
  AGENT_CANCEL_TASK: 'agent:cancel-task',
  AGENT_GET_TASK_STATUS: 'agent:get-task-status',
  AGENT_LIST_WORKFLOWS: 'agent:list-workflows',

  // UI Context
  UI_CONTEXT_UPDATE: 'ui:context-update',
  UI_CONTEXT_GET: 'ui:context-get',
  
  // AI Navigation
  AI_NAVIGATE: 'ai:navigate',
  AI_ACTION_UPDATE: 'ai:action-update',
} as const;

// IPC 通道类型
export type IpcChannel = (typeof IPC_CHANNELS)[keyof typeof IPC_CHANNELS];
