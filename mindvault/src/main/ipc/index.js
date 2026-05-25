"use strict";
// @ts-nocheck
/**
 * IPC 处理器统一注册入口
 */
var registerCreativityHandlers = require('./creativity').registerCreativityHandlers;
var registerBoardHandlers = require('./board').registerBoardHandlers;
var registerTagHandlers = require('./tag').registerTagHandlers;
var registerTemplateHandlers = require('./template').registerTemplateHandlers;
var registerSettingsHandlers = require('./settings').registerSettingsHandlers;
var registerSearchHandlers = require('./search').registerSearchHandlers;
var registerMediaHandlers = require('./media').registerMediaHandlers;
var registerBackupHandlers = require('./backup').registerBackupHandlers;
var registerWindowHandlers = require('./window').registerWindowHandlers;
var registerTrashHandlers = require('./trash').registerTrashHandlers;
var registerShellHandlers = require('./shell').registerShellHandlers;
var registerUpdaterHandlers = require('./shell').registerUpdaterHandlers;
var registerAIHandlers = require('./ai').registerAIHandlers;
var registerMusicHandlers = require('./music').registerMusicHandlers;
var registerMusicOnlineHandlers = require('./music-online').registerMusicOnlineHandlers;
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
    console.log('[IPC] 所有处理器注册完成');
}
module.exports = { registerAllIpcHandlers: registerAllIpcHandlers };
