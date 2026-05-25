/**
 * Windows 拖放 IPC 处理
 * 
 * 由于 Windows UIPI 机制，管理员权限的 Electron 应用无法直接接收
 * 来自资源管理器的拖放事件。此模块通过主进程拦截拖放，
 * 然后通过 IPC 将文件信息传递给渲染进程。
 */

const { ipcMain, BrowserWindow } = require('electron');
const path = require('path');

// 存储每个窗口的拖放文件路径
const windowDropFiles = new Map();

/**
 * 注册拖放 IPC 处理器
 * @param {BrowserWindow} mainWindow - 主窗口实例
 */
function registerDragDropIPC(mainWindow) {
  // 处理渲染进程请求获取拖放的文件路径
  ipcMain.handle('get-dropped-files', async (event) => {
    const webContents = event.sender;
    const files = windowDropFiles.get(webContents.id);
    windowDropFiles.delete(webContents.id); // 获取后清除
    return files || [];
  });

  // 处理渲染进程通知拖放完成
  ipcMain.on('drag-drop-completed', (event, filePaths) => {
    console.log('[主进程] 拖放完成，文件:', filePaths);
  });
}

/**
 * 处理窗口的拖放事件
 * 注意：在 Windows 管理员模式下，这些事件可能不会被触发
 * @param {BrowserWindow} mainWindow - 主窗口实例
 */
function setupWindowDragDrop(mainWindow) {
  if (!mainWindow) return;

  // 尝试监听拖放事件（在 Windows 管理员模式下可能无效）
  mainWindow.webContents.on('drag-enter', (event) => {
    console.log('[主进程] drag-enter 事件');
  });

  mainWindow.webContents.on('drag-leave', (event) => {
    console.log('[主进程] drag-leave 事件');
  });

  mainWindow.webContents.on('drag-over', (event) => {
    // 这个事件在 Windows 管理员模式下通常不会被触发
  });

  mainWindow.webContents.on('drop', (event, filePaths) => {
    console.log('[主进程] drop 事件，文件:', filePaths);
    if (filePaths && filePaths.length > 0) {
      // 存储文件路径，等待渲染进程请求
      windowDropFiles.set(mainWindow.webContents.id, filePaths);
      
      // 通知渲染进程有新的拖放文件
      mainWindow.webContents.send('files-dropped', filePaths);
    }
  });

  // 监听 will-navigate 来捕获文件拖放（某些情况下）
  mainWindow.webContents.on('will-navigate', (event, navigationUrl) => {
    if (navigationUrl.startsWith('file://')) {
      event.preventDefault();
      const filePath = decodeURIComponent(navigationUrl.replace('file:///', '').replace('file://', ''));
      console.log('[主进程] 通过 will-navigate 捕获文件:', filePath);
      
      // Windows 路径处理
      const normalizedPath = filePath.replace(/\//g, '\\');
      windowDropFiles.set(mainWindow.webContents.id, [normalizedPath]);
      mainWindow.webContents.send('files-dropped', [normalizedPath]);
    }
  });
}

/**
 * 检查是否以管理员权限运行（Windows）
 */
function isRunningAsAdmin() {
  if (process.platform !== 'win32') return false;
  
  try {
    const { execSync } = require('child_process');
    execSync('net session', { stdio: ['pipe', 'pipe', 'ignore'] });
    return true;
  } catch (e) {
    return false;
  }
}

module.exports = {
  registerDragDropIPC,
  setupWindowDragDrop,
  isRunningAsAdmin
};
