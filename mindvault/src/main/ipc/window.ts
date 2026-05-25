// @ts-nocheck
/**
 * 窗口管理 IPC 处理器
 */

const { ipcMain, BrowserWindow } = require('electron');
const { app } = require('electron');
const path = require('path');

let mainWindow = null;
let editorWindows = [];
let musicPlayerWindow = null;

function setMainWindow(win) {
  mainWindow = win;
}

function registerWindowHandlers(mainWin) {
  mainWindow = mainWin;

  ipcMain.handle('window:minimize', () => {
    if (mainWindow) mainWindow.minimize();
  });

  ipcMain.handle('window:maximize', () => {
    if (mainWindow) {
      if (mainWindow.isMaximized()) {
        mainWindow.unmaximize();
      } else {
        mainWindow.maximize();
      }
    }
  });

  ipcMain.handle('window:close', () => {
    if (mainWindow) mainWindow.close();
  });

  ipcMain.handle('window:open-editor', (event, options = {}) => {
    const { creativityId = '', initialContent = '' } = options;
    const existingEditor = editorWindows.find(w => w.creativityId === creativityId);
    if (existingEditor) {
      existingEditor.focus();
      return { success: true, windowId: existingEditor.webContents.id };
    }

    const editorWindow = new BrowserWindow({
      parent: mainWindow,
      modal: false,
      width: 900,
      height: 700,
      minWidth: 600,
      minHeight: 400,
      frame: false,
      transparent: false,
      backgroundColor: '#ffffff',
      webPreferences: {
        preload: path.join(__dirname, '..', 'preload.js'),
        contextIsolation: true,
        nodeIntegration: false,
      },
      show: false,
    });

    editorWindow.creativityId = creativityId;
    editorWindow.once('ready-to-show', () => {
      editorWindow.show();
    });

    editorWindow.on('closed', () => {
      const idx = editorWindows.indexOf(editorWindow);
      if (idx > -1) editorWindows.splice(idx, 1);
    });

    if (!app.isPackaged) {
      editorWindow.loadURL(`http://localhost:5173/editor.html?id=${creativityId}&content=${encodeURIComponent(initialContent || '')}`);
    } else {
      editorWindow.loadFile(path.join(__dirname, '..', '..', 'renderer', 'editor.html'));
    }

    editorWindows.push(editorWindow);
    return { success: true, windowId: editorWindow.webContents.id };
  });

  ipcMain.handle('window:close-editor', (event, windowId) => {
    const targetWindow = editorWindows.find(w => w.webContents && w.webContents.id === windowId);
    if (targetWindow) {
      targetWindow.close();
      return { success: true };
    }
    return { success: false, error: '未找到编辑器窗口' };
  });

  ipcMain.handle('window:get-all-editors', () => {
    return editorWindows.map(w => ({
      windowId: w.webContents?.id,
      creativityId: w.creativityId,
      isFocused: w.isFocused(),
    }));
  });

  ipcMain.handle('window:focus-editor', (event, windowId) => {
    const targetWindow = editorWindows.find(w => w.webContents && w.webContents.id === windowId);
    if (targetWindow) {
      targetWindow.focus();
      return { success: true };
    }
    return { success: false, error: '未找到编辑器窗口' };
  });

  ipcMain.handle('window:open-music-player', () => {
    if (musicPlayerWindow && !musicPlayerWindow.isDestroyed()) {
      musicPlayerWindow.focus();
      return { success: true };
    }

    musicPlayerWindow = new BrowserWindow({
      width: 400,
      height: 180,
      minWidth: 360,
      minHeight: 140,
      frame: false,
      transparent: false,
      resizable: true,
      backgroundColor: '#1a1a2e',
      alwaysOnTop: true,
      skipTaskbar: true,
      webPreferences: {
        preload: path.join(__dirname, '..', 'preload.js'),
        contextIsolation: true,
        nodeIntegration: false,
      },
      show: false,
    });

    musicPlayerWindow.once('ready-to-show', () => {
      musicPlayerWindow.show();
    });

    musicPlayerWindow.on('closed', () => {
      musicPlayerWindow = null;
    });

    const isDev = !app.isPackaged;
    if (isDev) {
      musicPlayerWindow.loadURL('http://localhost:5173/music-player.html');
    } else {
      musicPlayerWindow.loadFile(path.join(__dirname, '..', '..', 'renderer', 'music-player.html'));
    }

    return { success: true };
  });

  ipcMain.handle('window:close-music-player', () => {
    if (musicPlayerWindow && !musicPlayerWindow.isDestroyed()) {
      musicPlayerWindow.close();
      musicPlayerWindow = null;
      return { success: true };
    }
    return { success: false };
  });

  ipcMain.handle('window:is-music-player-open', () => {
    return musicPlayerWindow && !musicPlayerWindow.isDestroyed();
  });

  ipcMain.handle('window:set-title', (event, title) => {
    if (mainWindow) mainWindow.setTitle(title);
  });

  ipcMain.handle('window:get-bounds', () => {
    if (mainWindow) return mainWindow.getBounds();
    return null;
  });

  ipcMain.handle('window:set-bounds', (event, bounds) => {
    if (mainWindow) mainWindow.setBounds(bounds);
  });

  ipcMain.handle('window:is-maximized', () => {
    if (mainWindow) return mainWindow.isMaximized();
    return false;
  });

  ipcMain.handle('window:toggle-fullscreen', () => {
    if (mainWindow) mainWindow.setFullScreen(!mainWindow.isFullScreen());
  });

  ipcMain.handle('window:open-visualizer-fullscreen', () => {
    if (fullscreenVisualizerWindow && !fullscreenVisualizerWindow.isDestroyed()) {
      fullscreenVisualizerWindow.focus();
      return { success: true };
    }

    fullscreenVisualizerWindow = new BrowserWindow({
      width: 1280,
      height: 800,
      frame: false,
      transparent: false,
      resizable: true,
      backgroundColor: '#000000',
      fullscreen: true,
      webPreferences: {
        preload: path.join(__dirname, '..', 'preload.js'),
        contextIsolation: true,
        nodeIntegration: false,
      },
      show: false,
    });

    fullscreenVisualizerWindow.once('ready-to-show', () => {
      fullscreenVisualizerWindow.show();
    });

    fullscreenVisualizerWindow.on('closed', () => {
      fullscreenVisualizerWindow = null;
      // Notify main window that fullscreen was closed
      if (mainWindow && !mainWindow.isDestroyed()) {
        mainWindow.webContents.send('visualizer:fullscreen-closed');
      }
    });

    const isDev = !app.isPackaged;
    if (isDev) {
      fullscreenVisualizerWindow.loadURL('http://localhost:5173/fullscreen-visualizer.html');
    } else {
      fullscreenVisualizerWindow.loadFile(path.join(__dirname, '..', '..', 'renderer', 'fullscreen-visualizer.html'));
    }

    return { success: true };
  });

  ipcMain.handle('window:close-visualizer-fullscreen', () => {
    if (fullscreenVisualizerWindow && !fullscreenVisualizerWindow.isDestroyed()) {
      fullscreenVisualizerWindow.close();
      fullscreenVisualizerWindow = null;
      return { success: true };
    }
    return { success: false };
  });

  ipcMain.handle('window:is-visualizer-fullscreen-open', () => {
    return fullscreenVisualizerWindow && !fullscreenVisualizerWindow.isDestroyed();
  });

  ipcMain.handle('visualizer:save-screenshot', async (event, dataUrl) => {
    const { dialog } = require('electron');
    const fs = require('fs');
    const result = await dialog.showSaveDialog({
      title: '保存可视化截图',
      defaultPath: `visualizer-${Date.now()}.png`,
      filters: [{ name: 'PNG 图片', extensions: ['png'] }],
    });
    if (result.canceled || !result.filePath) return { success: false };
    try {
      const base64Data = dataUrl.replace(/^data:image\/png;base64,/, '');
      fs.writeFileSync(result.filePath, Buffer.from(base64Data, 'base64'));
      return { success: true, filePath: result.filePath };
    } catch (err) {
      return { success: false, error: err.message };
    }
  });

  ipcMain.handle('visualizer:save-recording', async (event, bufferData) => {
    const { dialog } = require('electron');
    const fs = require('fs');
    const result = await dialog.showSaveDialog({
      title: '保存可视化录制',
      defaultPath: `visualizer-${Date.now()}.webm`,
      filters: [{ name: 'WebM 视频', extensions: ['webm'] }],
    });
    if (result.canceled || !result.filePath) return { success: false };
    try {
      fs.writeFileSync(result.filePath, Buffer.from(bufferData));
      return { success: true, filePath: result.filePath };
    } catch (err) {
      return { success: false, error: err.message };
    }
  });

  console.log('[IPC] 窗口处理器已注册');
}

let fullscreenVisualizerWindow = null;

function broadcastFrequencyData(data) {
  if (fullscreenVisualizerWindow && !fullscreenVisualizerWindow.isDestroyed()) {
    fullscreenVisualizerWindow.webContents.send('visualizer:frequency-data', data);
  }
}

module.exports = { registerWindowHandlers, setMainWindow, getMainWindow: () => mainWindow, broadcastFrequencyData };
