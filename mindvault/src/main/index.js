"use strict";
// @ts-nocheck
/**
 * Electron主进程入口
 * 脑洞集(MindVault) - 创意记录与整理桌面软件
 *
 * 架构：index.ts (入口) → ipc/ (处理器) → db/repository.ts (数据层)
 * 设计原则：先显示窗口，再异步初始化数据库
 * 如果 better-sqlite3 不可用，降级为 JSON 文件存储
 */
var _a = require('electron'), app = _a.app, BrowserWindow = _a.BrowserWindow, shell = _a.shell, Menu = _a.Menu, protocol = _a.protocol, net = _a.net, globalShortcut = _a.globalShortcut;
var path = require('path');
var fs = require('fs');
var repo = require('./db/repository');
var registerAllIpcHandlers = require('./ipc').registerAllIpcHandlers;
// Electron 33 的 app.isPackaged 在某些目录结构下会误判为 true
// 使用更可靠的检测：检查 exe 路径是否在 node_modules 内（开发模式）
var _exePath = app.getPath('exe');
var isDev = _exePath.includes('node_modules') || _exePath.includes('electron\\dist') || !app.isPackaged;
console.log('[主进程] isPackaged:', app.isPackaged, 'isDev:', isDev);
var mainWindow = null;
var logStream = null;
var logEnabled = false;
try {
    var devDataDir = isDev ? path.join(process.cwd(), '.dev-data') : null;
    var logDir = devDataDir || app.getPath('userData');
    if (devDataDir) {
        try {
            fs.mkdirSync(devDataDir, { recursive: true });
        }
        catch (_) { }
    }
    var logPath = path.join(logDir, 'app.log');
    logStream = fs.createWriteStream(logPath, { flags: 'a' });
    logStream.on('error', function () { logEnabled = false; });
    logEnabled = true;
}
catch (e) {
    logEnabled = false;
}
var origLog = console.log;
var origErr = console.error;
console.log = function () {
    var args = [];
    for (var _i = 0; _i < arguments.length; _i++) {
        args[_i] = arguments[_i];
    }
    origLog.apply(void 0, args);
    if (logEnabled && logStream) {
        try {
            logStream.write(args.map(function (a) { return typeof a === 'object' ? JSON.stringify(a) : String(a); }).join(' ') + '\n');
        }
        catch (e) {
            logEnabled = false;
        }
    }
};
console.error = function () {
    var args = [];
    for (var _i = 0; _i < arguments.length; _i++) {
        args[_i] = arguments[_i];
    }
    origErr.apply(void 0, args);
    if (logEnabled && logStream) {
        try {
            logStream.write('[ERROR] ' + args.map(function (a) { return typeof a === 'object' ? JSON.stringify(a) : String(a); }).join(' ') + '\n');
        }
        catch (e) {
            logEnabled = false;
        }
    }
};
protocol.registerSchemesAsPrivileged([
    { scheme: 'local-media', privileges: { bypassCSP: true, stream: true, supportFetchAPI: true, standard: true, secure: true, corsEnabled: true } },
]);
function createWindow() {
    var template = [
        {
            label: '文件',
            submenu: [
                { label: '新建创意', accelerator: 'CmdOrCtrl+N', click: function () { return mainWindow === null || mainWindow === void 0 ? void 0 : mainWindow.webContents.send('menu:new-creativity'); } },
                { type: 'separator' },
                { label: '导出数据', accelerator: 'CmdOrCtrl+E', click: function () { return mainWindow === null || mainWindow === void 0 ? void 0 : mainWindow.webContents.send('menu:export'); } },
                { label: '导入数据', accelerator: 'CmdOrCtrl+I', click: function () { return mainWindow === null || mainWindow === void 0 ? void 0 : mainWindow.webContents.send('menu:import'); } },
                { type: 'separator' },
                { role: 'quit', label: '退出' },
            ],
        },
        {
            label: '编辑',
            submenu: [
                { label: '撤销', accelerator: 'CmdOrCtrl+Z', click: function () { return mainWindow === null || mainWindow === void 0 ? void 0 : mainWindow.webContents.send('menu:undo'); } },
                { label: '重做', accelerator: 'CmdOrCtrl+Shift+Z', click: function () { return mainWindow === null || mainWindow === void 0 ? void 0 : mainWindow.webContents.send('menu:redo'); } },
                { type: 'separator' },
                { role: 'cut', label: '剪切' },
                { role: 'copy', label: '复制' },
                { role: 'paste', label: '粘贴' },
                { role: 'selectAll', label: '全选' },
            ],
        },
        {
            label: '视图',
            submenu: [
                { label: '搜索', accelerator: 'CmdOrCtrl+F', click: function () { return mainWindow === null || mainWindow === void 0 ? void 0 : mainWindow.webContents.send('menu:search'); } },
                { label: '快速录入', accelerator: 'CmdOrCtrl+Shift+N', click: function () { return mainWindow === null || mainWindow === void 0 ? void 0 : mainWindow.webContents.send('menu:quick-capture'); } },
                { type: 'separator' },
                { role: 'toggleDevTools', label: '开发者工具' },
                { role: 'togglefullscreen', label: '全屏' },
                { label: '放大', accelerator: 'CmdOrCtrl+Plus', click: function () { return mainWindow === null || mainWindow === void 0 ? void 0 : mainWindow.webContents.send('menu:zoom-in'); } },
                { label: '缩小', accelerator: 'CmdOrCtrl+-', click: function () { return mainWindow === null || mainWindow === void 0 ? void 0 : mainWindow.webContents.send('menu:zoom-out'); } },
                { label: '重置缩放', accelerator: 'CmdOrCtrl+0', click: function () { return mainWindow === null || mainWindow === void 0 ? void 0 : mainWindow.webContents.send('menu:reset-zoom'); } },
            ],
        },
        {
            label: '窗口',
            submenu: [
                { role: 'minimize', label: '最小化' },
                { role: 'zoom', label: '缩放' },
                { role: 'close', label: '关闭' },
            ],
        },
        {
            label: '帮助',
            submenu: [
                { label: '快捷键速查', accelerator: 'CmdOrCtrl+/', click: function () { return mainWindow === null || mainWindow === void 0 ? void 0 : mainWindow.webContents.send('menu:shortcuts'); } },
                { type: 'separator' },
                { label: '关于脑洞集', click: function () { return mainWindow === null || mainWindow === void 0 ? void 0 : mainWindow.webContents.send('menu:about'); } },
            ],
        },
    ];
    Menu.setApplicationMenu(Menu.buildFromTemplate(template));
    mainWindow = new BrowserWindow({
        width: 1200,
        height: 800,
        minWidth: 900,
        minHeight: 600,
        title: '脑洞集',
        backgroundColor: '#f9fafb',
        resizable: true,
        webPreferences: {
            nodeIntegration: false,
            contextIsolation: true,
            preload: path.join(__dirname, 'preload.js'),
            sandbox: false,
        },
        show: false,
    });
    mainWindow.webContents.session.setPermissionRequestHandler(function (webContents, permission, callback) {
        if (permission === 'media') {
            callback(true);
        }
        else {
            callback(false);
        }
    });
    // 禁用所有可能的导航行为，让渲染进程处理拖放
    mainWindow.webContents.on('will-navigate', function (event, navigationUrl) {
        // 只允许开发服务器和 devtools 的导航
        if (!navigationUrl.startsWith('http://localhost') &&
            !navigationUrl.startsWith('devtools://') &&
            !navigationUrl.startsWith('chrome-extension://')) {
            event.preventDefault();
            console.log('[主进程] 阻止了导航:', navigationUrl);
        }
    });
    // 处理拖放文件到窗口的事件
    mainWindow.webContents.on('did-start-navigation', function (event, url, isInPlace, isMainFrame, frameProcessId, frameRoutingId) {
        // 阻止文件拖放导致的导航
        if (url.startsWith('file://')) {
            event.preventDefault();
            console.log('[主进程] 阻止了文件拖放导航:', url);
        }
    });
    // 处理拖放事件 - 阻止默认的文件打开行为
    mainWindow.webContents.on('drag-enter', function (event) {
        console.log('[主进程] drag-enter event');
    });
    mainWindow.webContents.on('drag-over', function (event) {
        console.log('[主进程] drag-over event');
    });
    mainWindow.webContents.on('new-window', function (event) {
        event.preventDefault();
    });
    mainWindow.once('ready-to-show', function () {
        mainWindow.show();
        console.log('[主进程] 窗口已显示');
    });
    if (isDev) {
        mainWindow.loadURL('http://localhost:5173');
        mainWindow.webContents.openDevTools();
    }
    else {
        var possiblePaths = [
            path.join(__dirname, '..', 'renderer', 'index.html'),
            path.join(__dirname, 'renderer', 'index.html'),
            path.join(process.resourcesPath, 'app.asar', 'renderer', 'index.html'),
        ];
        var loaded = false;
        for (var _i = 0, possiblePaths_1 = possiblePaths; _i < possiblePaths_1.length; _i++) {
            var p = possiblePaths_1[_i];
            if (fs.existsSync(p)) {
                console.log('[主进程] 加载页面:', p);
                mainWindow.loadFile(p).catch(function (e) { return console.error('[主进程] 加载失败:', e); });
                loaded = true;
                break;
            }
        }
        if (!loaded) {
            console.log('[主进程] 尝试从asar加载...');
            mainWindow.loadFile(path.join(__dirname, '..', 'renderer', 'index.html')).catch(function (e) {
                console.error('[主进程] 所有路径加载失败，显示错误页面');
                mainWindow.loadURL("data:text/html;charset=utf-8,".concat(encodeURIComponent("\n          <html><body style=\"display:flex;align-items:center;justify-content:center;height:100vh;font-family:sans-serif;background:#f9fafb;color:#333\">\n          <div style=\"text-align:center\"><h1>\u8111\u6D1E\u96C6</h1><p>\u9875\u9762\u52A0\u8F7D\u5931\u8D25</p><p style=\"color:#999;font-size:12px\">\u8BF7\u5C1D\u8BD5\u91CD\u65B0\u542F\u52A8\u5E94\u7528</p></div>\n          </body></html>\n        ")));
            });
        }
    }
    mainWindow.webContents.setWindowOpenHandler(function (_a) {
        var url = _a.url;
        shell.openExternal(url);
        return { action: 'deny' };
    });
    mainWindow.webContents.on('did-fail-load', function (event, errorCode, errorDescription) {
        console.error('[主进程] 页面加载失败:', errorCode, errorDescription);
    });
    mainWindow.webContents.on('console-message', function (event, level, message, line, sourceId) {
        var levelStr = ['verbose', 'info', 'warning', 'error'][level] || 'unknown';
        if (level >= 2) {
            console.error("[\u6E32\u67D3\u8FDB\u7A0B:".concat(levelStr, "] ").concat(message, " (").concat(sourceId, ":").concat(line, ")"));
        }
    });
    mainWindow.on('closed', function () {
        mainWindow = null;
    });
}
app.whenReady().then(function () {
    console.log('[主进程] 应用启动中...');
    protocol.handle('local-media', function (request) {
        try {
            var url = new URL(request.url);
            var filePath = decodeURIComponent(url.pathname);
            if (filePath.startsWith('/') && filePath.length > 2 && filePath.charAt(2) === ':') {
                filePath = filePath.substring(1);
            }
            if (!fs.existsSync(filePath.replace(/\//g, path.sep))) {
                var hostPart = url.hostname;
                if (hostPart && hostPart.length === 1 && /^[a-zA-Z]$/.test(hostPart)) {
                    var oldStylePath = hostPart.toUpperCase() + ':' + filePath;
                    var candidate = oldStylePath.replace(/\//g, path.sep);
                    if (fs.existsSync(candidate)) {
                        filePath = oldStylePath;
                    }
                }
            }
            filePath = filePath.replace(/\//g, path.sep);
            if (!fs.existsSync(filePath)) {
                return new Response('File not found', { status: 404 });
            }
            var ext = path.extname(filePath).toLowerCase();
            var mimeMap = {
                '.png': 'image/png', '.jpg': 'image/jpeg', '.jpeg': 'image/jpeg',
                '.gif': 'image/gif', '.bmp': 'image/bmp', '.webp': 'image/webp',
                '.svg': 'image/svg+xml', '.ico': 'image/x-icon',
                '.mp3': 'audio/mpeg', '.wav': 'audio/wav', '.ogg': 'audio/ogg',
                '.flac': 'audio/flac', '.aac': 'audio/aac', '.m4a': 'audio/mp4',
                '.mp4': 'video/mp4', '.webm': 'video/webm', '.avi': 'video/x-msvideo',
                '.mov': 'video/quicktime', '.mkv': 'video/x-matroska',
                '.pdf': 'application/pdf',
            };
            var mimeType = mimeMap[ext] || 'application/octet-stream';
            var stat = fs.statSync(filePath);
            var fileSize = stat.size;
            var videoExts = new Set(['.mp4', '.webm', '.avi', '.mov', '.mkv']);
            var isVideo = videoExts.has(ext);
            var rangeHeader = request.headers.get('Range') || request.headers.get('range');
            if (rangeHeader && rangeHeader.startsWith('bytes=')) {
                var rangePart = rangeHeader.slice(6);
                var match = rangePart.match(/^(\d*)-(\d*)$/);
                if (!match) {
                    return new Response('Invalid Range', { status: 416, headers: { 'Content-Range': "bytes */".concat(fileSize) } });
                }
                var start = void 0;
                var end = void 0;
                if (match[1] === '' && match[2] !== '') {
                    var suffix = parseInt(match[2], 10);
                    start = Math.max(0, fileSize - suffix);
                    end = fileSize - 1;
                }
                else if (match[1] !== '' && match[2] === '') {
                    start = parseInt(match[1], 10);
                    end = fileSize - 1;
                }
                else {
                    start = parseInt(match[1], 10);
                    end = parseInt(match[2], 10);
                }
                if (start >= fileSize || end >= fileSize || start > end) {
                    return new Response('Range Not Satisfiable', { status: 416, headers: { 'Content-Range': "bytes */".concat(fileSize) } });
                }
                var contentLength = end - start + 1;
                var headers_1 = {
                    'Content-Type': mimeType,
                    'Content-Length': String(contentLength),
                    'Content-Range': "bytes ".concat(start, "-").concat(end, "/").concat(fileSize),
                    'Accept-Ranges': 'bytes',
                };
                if (isVideo) {
                    headers_1['Content-Disposition'] = 'inline';
                }
                var nodeStream_1 = fs.createReadStream(filePath, { start: start, end: end });
                var webStream_1 = new ReadableStream({
                    start: function (controller) {
                        nodeStream_1.on('data', function (chunk) { return controller.enqueue(new Uint8Array(chunk)); });
                        nodeStream_1.on('end', function () { return controller.close(); });
                        nodeStream_1.on('error', function (err) { return controller.error(err); });
                    },
                    cancel: function () {
                        nodeStream_1.destroy();
                    },
                });
                return new Response(webStream_1, { status: 206, headers: headers_1 });
            }
            var headers = {
                'Content-Type': mimeType,
                'Content-Length': String(fileSize),
                'Accept-Ranges': 'bytes',
            };
            if (isVideo) {
                headers['Content-Disposition'] = 'inline';
            }
            var nodeStream_2 = fs.createReadStream(filePath);
            var webStream = new ReadableStream({
                start: function (controller) {
                    nodeStream_2.on('data', function (chunk) { return controller.enqueue(new Uint8Array(chunk)); });
                    nodeStream_2.on('end', function () { return controller.close(); });
                    nodeStream_2.on('error', function (err) { return controller.error(err); });
                },
                cancel: function () {
                    nodeStream_2.destroy();
                },
            });
            return new Response(webStream, { status: 200, headers: headers });
        }
        catch (e) {
            return new Response('Error', { status: 500 });
        }
    });
    var userDataPath;
    if (isDev) {
        userDataPath = path.join(process.cwd(), '.dev-data');
        app.setPath('userData', userDataPath);
    }
    else {
        userDataPath = app.getPath('userData');
    }
    var mediaDir = path.join(userDataPath, 'media');
    var backupDir = path.join(userDataPath, 'backups');
    repo.setPaths(userDataPath, mediaDir, backupDir);
    repo.ensureDir(userDataPath);
    repo.ensureDir(mediaDir);
    repo.ensureDir(backupDir);
    console.log('[主进程] 数据存储目录:', userDataPath);
    try {
        var useSqlite = repo.initDatabase();
        if (useSqlite) {
            console.log('[主进程] 使用SQLite数据库');
        }
        else {
            repo.JsonStore.init();
            console.log('[主进程] 使用JSON文件存储（降级模式）');
        }
    }
    catch (e) {
        console.error('[主进程] 数据库初始化异常，使用降级模式:', e);
        repo.JsonStore.init();
    }
    registerAllIpcHandlers(mainWindow);
    createWindow();
    // 注册全局媒体快捷键（仅在生产环境注册，避免开发模式冲突）
    if (!isDev) {
        globalShortcut.register('MediaPlayPause', function () {
            var windows = BrowserWindow.getAllWindows();
            windows.forEach(function (win) {
                win.webContents.send('music:global-toggle-play');
            });
        });
        globalShortcut.register('MediaNextTrack', function () {
            var windows = BrowserWindow.getAllWindows();
            windows.forEach(function (win) {
                win.webContents.send('music:global-next-track');
            });
        });
        globalShortcut.register('MediaPreviousTrack', function () {
            var windows = BrowserWindow.getAllWindows();
            windows.forEach(function (win) {
                win.webContents.send('music:global-prev-track');
            });
        });
        console.log('[主进程] 全局媒体快捷键已注册');
    }
    console.log('[主进程] 应用启动完成');
});
app.on('window-all-closed', function () {
    if (process.platform !== 'darwin') {
        app.quit();
    }
});
app.on('activate', function () {
    if (BrowserWindow.getAllWindows().length === 0) {
        createWindow();
    }
});
process.on('uncaughtException', function (error) {
    console.error('[主进程] 未捕获异常:', error);
});
process.on('unhandledRejection', function (reason) {
    console.error('[主进程] 未处理的Promise拒绝:', reason);
});
