"use strict";
// @ts-nocheck
/**
 * 窗口管理 IPC 处理器
 */
var _a = require('electron'), ipcMain = _a.ipcMain, BrowserWindow = _a.BrowserWindow;
var app = require('electron').app;
var path = require('path');
var mainWindow = null;
var editorWindows = [];
var musicPlayerWindow = null;
function setMainWindow(win) {
    mainWindow = win;
}
function registerWindowHandlers(mainWin) {
    mainWindow = mainWin;
    ipcMain.handle('window:minimize', function () {
        if (mainWindow)
            mainWindow.minimize();
    });
    ipcMain.handle('window:maximize', function () {
        if (mainWindow) {
            if (mainWindow.isMaximized()) {
                mainWindow.unmaximize();
            }
            else {
                mainWindow.maximize();
            }
        }
    });
    ipcMain.handle('window:close', function () {
        if (mainWindow)
            mainWindow.close();
    });
    ipcMain.handle('window:open-editor', function (event, options) {
        if (options === void 0) { options = {}; }
        var _a = options.creativityId, creativityId = _a === void 0 ? '' : _a, _b = options.initialContent, initialContent = _b === void 0 ? '' : _b;
        var existingEditor = editorWindows.find(function (w) { return w.creativityId === creativityId; });
        if (existingEditor) {
            existingEditor.focus();
            return { success: true, windowId: existingEditor.webContents.id };
        }
        var editorWindow = new BrowserWindow({
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
        editorWindow.once('ready-to-show', function () {
            editorWindow.show();
        });
        editorWindow.on('closed', function () {
            var idx = editorWindows.indexOf(editorWindow);
            if (idx > -1)
                editorWindows.splice(idx, 1);
        });
        if (!app.isPackaged) {
            editorWindow.loadURL("http://localhost:5173/editor.html?id=".concat(creativityId, "&content=").concat(encodeURIComponent(initialContent || '')));
        }
        else {
            editorWindow.loadFile(path.join(__dirname, '..', '..', 'renderer', 'editor.html'));
        }
        editorWindows.push(editorWindow);
        return { success: true, windowId: editorWindow.webContents.id };
    });
    ipcMain.handle('window:close-editor', function (event, windowId) {
        var targetWindow = editorWindows.find(function (w) { return w.webContents && w.webContents.id === windowId; });
        if (targetWindow) {
            targetWindow.close();
            return { success: true };
        }
        return { success: false, error: '未找到编辑器窗口' };
    });
    ipcMain.handle('window:get-all-editors', function () {
        return editorWindows.map(function (w) {
            var _a;
            return ({
                windowId: (_a = w.webContents) === null || _a === void 0 ? void 0 : _a.id,
                creativityId: w.creativityId,
                isFocused: w.isFocused(),
            });
        });
    });
    ipcMain.handle('window:focus-editor', function (event, windowId) {
        var targetWindow = editorWindows.find(function (w) { return w.webContents && w.webContents.id === windowId; });
        if (targetWindow) {
            targetWindow.focus();
            return { success: true };
        }
        return { success: false, error: '未找到编辑器窗口' };
    });
    ipcMain.handle('window:open-music-player', function () {
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
        musicPlayerWindow.once('ready-to-show', function () {
            musicPlayerWindow.show();
        });
        musicPlayerWindow.on('closed', function () {
            musicPlayerWindow = null;
        });
        var isDev = !app.isPackaged;
        if (isDev) {
            musicPlayerWindow.loadURL('http://localhost:5173/music-player.html');
        }
        else {
            musicPlayerWindow.loadFile(path.join(__dirname, '..', '..', 'renderer', 'music-player.html'));
        }
        return { success: true };
    });
    ipcMain.handle('window:close-music-player', function () {
        if (musicPlayerWindow && !musicPlayerWindow.isDestroyed()) {
            musicPlayerWindow.close();
            musicPlayerWindow = null;
            return { success: true };
        }
        return { success: false };
    });
    ipcMain.handle('window:is-music-player-open', function () {
        return musicPlayerWindow && !musicPlayerWindow.isDestroyed();
    });
    ipcMain.handle('window:set-title', function (event, title) {
        if (mainWindow)
            mainWindow.setTitle(title);
    });
    ipcMain.handle('window:get-bounds', function () {
        if (mainWindow)
            return mainWindow.getBounds();
        return null;
    });
    ipcMain.handle('window:set-bounds', function (event, bounds) {
        if (mainWindow)
            mainWindow.setBounds(bounds);
    });
    ipcMain.handle('window:is-maximized', function () {
        if (mainWindow)
            return mainWindow.isMaximized();
        return false;
    });
    ipcMain.handle('window:toggle-fullscreen', function () {
        if (mainWindow)
            mainWindow.setFullScreen(!mainWindow.isFullScreen());
    });
    console.log('[IPC] 窗口处理器已注册');
}
module.exports = { registerWindowHandlers: registerWindowHandlers, setMainWindow: setMainWindow, getMainWindow: function () { return mainWindow; } };
