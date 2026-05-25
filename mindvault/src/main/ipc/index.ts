// @ts-nocheck
/**
 * IPC 处理器统一注册入口
 */

const { registerCreativityHandlers } = require('./creativity');
const { registerBoardHandlers } = require('./board');
const { registerTagHandlers } = require('./tag');
const { registerTemplateHandlers } = require('./template');
const { registerSettingsHandlers } = require('./settings');
const { registerSearchHandlers } = require('./search');
const { registerMediaHandlers } = require('./media');
const { registerBackupHandlers } = require('./backup');
const { registerWindowHandlers } = require('./window');
const { registerTrashHandlers } = require('./trash');
const { registerShellHandlers } = require('./shell');
const { registerUpdaterHandlers } = require('./shell');
const { registerAIHandlers } = require('./ai');
const { registerMusicHandlers } = require('./music');
const { registerMusicOnlineHandlers } = require('./music-online');
const { registerAuthHandlers } = require('./auth');
const { registerAIRulesHandlers } = require('./ai-rules');
const { registerLxMusicApiHandlers } = require('./lx-music-api');
const { registerMusicUnifiedHandlers } = require('./music-unified');
const { registerWritingHandlers } = require('./writing');
const { registerChatRoomHandlers } = require('./chat-room');
const { registerChatHistoryHandlers } = require('./chat-history');
const { registerPromptTemplateHandlers } = require('./prompt-template');
const { registerRAGHandlers } = require('./rag');
const { registerWeatherIpc } = require('./weather');
const { registerWorkflowHandlers } = require('./workflow');
const { registerAIUsageStatsHandlers } = require('./ai-usage-stats');
const { registerSkillHandlers } = require('./skill');
const { registerHaooneHandlers } = require('./haoone');
let registerMCPConfigHandlers: any = () => {};
try { ({ registerMCPConfigHandlers } = require('./mcp-config')); } catch (_) {}

function registerAllIpcHandlers(mainWindow) {
  registerCreativityHandlers();
  registerBoardHandlers();
  registerTagHandlers();
  registerTemplateHandlers();
  registerSettingsHandlers();
  registerSearchHandlers();
  registerMediaHandlers(mainWindow);
  registerBackupHandlers();
  registerWindowHandlers(mainWindow);
  registerTrashHandlers();
  registerShellHandlers();
  registerUpdaterHandlers();
  registerAIHandlers();
  registerMusicHandlers();
  registerMusicOnlineHandlers();
  registerAuthHandlers();
  registerAIRulesHandlers();
  registerLxMusicApiHandlers();
  registerMusicUnifiedHandlers();
  registerWritingHandlers();
  registerChatRoomHandlers();
  registerChatHistoryHandlers();
  registerPromptTemplateHandlers();
  registerMCPConfigHandlers();
  registerRAGHandlers();
  registerWeatherIpc();
  registerWorkflowHandlers();
  registerAIUsageStatsHandlers();
  registerSkillHandlers();
  registerHaooneHandlers();
  console.log('[IPC] 所有处理器注册完成');
}

module.exports = { registerAllIpcHandlers };
