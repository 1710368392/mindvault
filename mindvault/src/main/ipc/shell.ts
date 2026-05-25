// @ts-nocheck
/**
 * Shell 和更新检查 IPC 处理器
 */

const { ipcMain, shell, app } = require('electron');

const ALLOWED_PROTOCOLS = ['http:', 'https:', 'mailto:'];

function registerShellHandlers() {
  ipcMain.handle('shell:open-external', async (event, url) => {
    try {
      if (typeof url !== 'string' || !url.trim()) return false;
      const parsed = new URL(url);
      if (!ALLOWED_PROTOCOLS.includes(parsed.protocol)) {
        console.error('[Shell] 拒绝打开不安全的协议:', parsed.protocol);
        return false;
      }
      await shell.openExternal(url);
      return true;
    } catch (err) {
      console.error('[Shell] 打开外部链接失败:', err);
      return false;
    }
  });
}

function registerUpdaterHandlers() {
  ipcMain.handle('updater:check', async () => {
    const currentVersion = app.getVersion();
    return {
      hasUpdate: false,
      currentVersion,
      latestVersion: currentVersion,
    };
  });
}

module.exports = { registerShellHandlers, registerUpdaterHandlers };
