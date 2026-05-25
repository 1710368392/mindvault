// @ts-nocheck
/**
 * Electron主进程入口
 * 脑洞集(MindVault) - 创意记录与整理桌面软件
 *
 * 架构：index.ts (入口) → ipc/ (处理器) → db/repository.ts (数据层)
 * 设计原则：先显示窗口，再异步初始化数据库
 * 如果 better-sqlite3 不可用，降级为 JSON 文件存储
 */

const { app, BrowserWindow, shell, Menu, protocol, net, globalShortcut } = require('electron');
const path = require('path');
const fs = require('fs');
const repo = require('./db/repository');
const { registerAllIpcHandlers } = require('./ipc');
const { initSupabaseServer } = require('./lib/supabase-server');
const { registerDragDropIPC, setupWindowDragDrop, isRunningAsAdmin } = require('./drag-drop-ipc');

// Electron 33 的 app.isPackaged 在某些目录结构下会误判为 true
// 使用更可靠的检测：检查 exe 路径是否在 node_modules 内（开发模式）
const _exePath = app.getPath('exe');
const isDev = _exePath.includes('node_modules') || _exePath.includes('electron\\dist') || !app.isPackaged;
console.log('[主进程] isPackaged:', app.isPackaged, 'isDev:', isDev);
let mainWindow = null;

let logStream = null;
let logEnabled = false;
try {
  const devDataDir = isDev ? path.join(process.cwd(), '.dev-data') : null;
  const logDir = devDataDir || app.getPath('userData');
  if (devDataDir) { try { fs.mkdirSync(devDataDir, { recursive: true }); } catch(_) {} }
  const logPath = path.join(logDir, 'app.log');
  logStream = fs.createWriteStream(logPath, { flags: 'a' });
  logStream.on('error', () => { logEnabled = false; });
  logEnabled = true;
} catch (e) {
  logEnabled = false;
}
const origLog = console.log;
const origErr = console.error;
console.log = (...args) => { origLog(...args); if (logEnabled && logStream) { try { logStream.write(args.map(a => typeof a === 'object' ? JSON.stringify(a) : String(a)).join(' ') + '\n'); } catch(e){ logEnabled = false; } } };
console.error = (...args) => { origErr(...args); if (logEnabled && logStream) { try { logStream.write('[ERROR] ' + args.map(a => typeof a === 'object' ? JSON.stringify(a) : String(a)).join(' ') + '\n'); } catch(e){ logEnabled = false; } } };

protocol.registerSchemesAsPrivileged([
  { scheme: 'local-media', privileges: { bypassCSP: true, stream: true, supportFetchAPI: true, standard: true, secure: true, corsEnabled: true } },
  { scheme: 'music-stream', privileges: { bypassCSP: true, stream: true, supportFetchAPI: true, standard: true, secure: true, corsEnabled: true } },
]);

function createWindow() {
  const template = [
    {
      label: '文件',
      submenu: [
        { label: '新建创意', accelerator: 'CmdOrCtrl+N', click: () => mainWindow?.webContents.send('menu:new-creativity') },
        { type: 'separator' },
        { label: '导出数据', accelerator: 'CmdOrCtrl+E', click: () => mainWindow?.webContents.send('menu:export') },
        { label: '导入数据', accelerator: 'CmdOrCtrl+I', click: () => mainWindow?.webContents.send('menu:import') },
        { type: 'separator' },
        { role: 'quit', label: '退出' },
      ],
    },
    {
      label: '编辑',
      submenu: [
        { label: '撤销', accelerator: 'CmdOrCtrl+Z', click: () => mainWindow?.webContents.send('menu:undo') },
        { label: '重做', accelerator: 'CmdOrCtrl+Shift+Z', click: () => mainWindow?.webContents.send('menu:redo') },
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
        { label: '搜索', accelerator: 'CmdOrCtrl+F', click: () => mainWindow?.webContents.send('menu:search') },
        { label: '快速录入', accelerator: 'CmdOrCtrl+Shift+N', click: () => mainWindow?.webContents.send('menu:quick-capture') },
        { type: 'separator' },
        { role: 'toggleDevTools', label: '开发者工具' },
        { role: 'togglefullscreen', label: '全屏' },
        { label: '放大', accelerator: 'CmdOrCtrl+Plus', click: () => mainWindow?.webContents.send('menu:zoom-in') },
        { label: '缩小', accelerator: 'CmdOrCtrl+-', click: () => mainWindow?.webContents.send('menu:zoom-out') },
        { label: '重置缩放', accelerator: 'CmdOrCtrl+0', click: () => mainWindow?.webContents.send('menu:reset-zoom') },
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
        { label: '快捷键速查', accelerator: 'CmdOrCtrl+/', click: () => mainWindow?.webContents.send('menu:shortcuts') },
        { type: 'separator' },
        { label: '关于脑洞集', click: () => mainWindow?.webContents.send('menu:about') },
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

  mainWindow.webContents.session.setPermissionRequestHandler((webContents, permission, callback) => {
    if (permission === 'media' || permission === 'geolocation' || permission === 'notifications') {
      callback(true);
    } else {
      callback(false);
    }
  });

  // 主动检查并授权 geolocation 权限（Electron 需要显式授权）
  mainWindow.webContents.session.setPermissionCheckHandler((webContents, permission, requestingOrigin) => {
    if (permission === 'geolocation') {
      return true;
    }
    return false;
  });

  // 为 QQ 音乐 CDN 请求设置正确的 Referer，否则音频无法播放
  mainWindow.webContents.session.webRequest.onBeforeSendHeaders((details, callback) => {
    const url = details.url;
    if (url.includes('qq.com') || url.includes('qq.cn') || url.includes('tc.qq.com') || url.includes('dl.stream.qqmusic.qq.com')) {
      details.requestHeaders['Referer'] = 'https://y.qq.com/';
      details.requestHeaders['Origin'] = 'https://y.qq.com';
    }
    callback({ requestHeaders: details.requestHeaders });
  });

  // 禁用所有可能的导航行为，让渲染进程处理拖放
  mainWindow.webContents.on('will-navigate', (event, navigationUrl) => {
    // 阻止文件拖放导致的导航（file:// 协议）
    if (navigationUrl.startsWith('file://')) {
      event.preventDefault();
      console.log('[主进程] 阻止了文件拖放导航:', navigationUrl);
      return;
    }
    // 只允许开发服务器和 devtools 的导航
    if (!navigationUrl.startsWith('http://localhost') &&
        !navigationUrl.startsWith('devtools://') &&
        !navigationUrl.startsWith('chrome-extension://')) {
      event.preventDefault();
      console.log('[主进程] 阻止了导航:', navigationUrl);
    }
  });

  // 处理拖放文件到窗口的事件 - Windows 需要特殊处理
  mainWindow.webContents.on('did-start-navigation', (event, url, isInPlace, isMainFrame, frameProcessId, frameRoutingId) => {
    // 阻止文件拖放导致的导航
    if (url.startsWith('file://')) {
      event.preventDefault();
      console.log('[主进程] 阻止了文件拖放导航:', url);
    }
  });

  // 设置 Windows 拖放处理（处理管理员权限下的 UIPI 问题）
  setupWindowDragDrop(mainWindow);
  
  // 检查是否以管理员权限运行并记录
  if (isRunningAsAdmin()) {
    console.log('[主进程] 警告：应用以管理员权限运行，Windows 拖放功能可能受限');
    console.log('[主进程] 建议：开发时请以普通用户权限运行 Electron');
  }

  mainWindow.webContents.on('new-window', (event) => {
    event.preventDefault();
  });

  mainWindow.once('ready-to-show', () => {
    mainWindow.show();
    console.log('[主进程] 窗口已显示');
  });

  if (isDev) {
    mainWindow.loadURL('http://localhost:5173');
    mainWindow.webContents.openDevTools();
  } else {
    const possiblePaths = [
      path.join(__dirname, '..', 'renderer', 'index.html'),
      path.join(__dirname, 'renderer', 'index.html'),
      path.join(process.resourcesPath, 'app.asar', 'renderer', 'index.html'),
    ];

    let loaded = false;
    for (const p of possiblePaths) {
      if (fs.existsSync(p)) {
        console.log('[主进程] 加载页面:', p);
        mainWindow.loadFile(p).catch(e => console.error('[主进程] 加载失败:', e));
        loaded = true;
        break;
      }
    }

    if (!loaded) {
      console.log('[主进程] 尝试从asar加载...');
      mainWindow.loadFile(path.join(__dirname, '..', 'renderer', 'index.html')).catch(e => {
        console.error('[主进程] 所有路径加载失败，显示错误页面');
        mainWindow.loadURL(`data:text/html;charset=utf-8,${encodeURIComponent(`
          <html><body style="display:flex;align-items:center;justify-content:center;height:100vh;font-family:sans-serif;background:#f9fafb;color:#333">
          <div style="text-align:center"><h1>脑洞集</h1><p>页面加载失败</p><p style="color:#999;font-size:12px">请尝试重新启动应用</p></div>
          </body></html>
        `)}`);
      });
    }
  }

  mainWindow.webContents.setWindowOpenHandler(({ url }) => {
    shell.openExternal(url);
    return { action: 'deny' };
  });

  mainWindow.webContents.on('did-fail-load', (event, errorCode, errorDescription) => {
    console.error('[主进程] 页面加载失败:', errorCode, errorDescription);
  });

  mainWindow.webContents.on('console-message', (event, level, message, line, sourceId) => {
    const levelStr = ['verbose', 'info', 'warning', 'error'][level] || 'unknown';
    if (level >= 2) {
      console.error(`[渲染进程:${levelStr}] ${message} (${sourceId}:${line})`);
    }
  });

  mainWindow.on('closed', () => {
    mainWindow = null;
  });
}

app.whenReady().then(() => {
  console.log('[主进程] 应用启动中...');

  // 先定义数据目录，供 protocol handler 使用
  let userDataPath;
  if (isDev) {
    userDataPath = path.join(process.cwd(), '.dev-data');
    app.setPath('userData', userDataPath);
  } else {
    userDataPath = app.getPath('userData');
  }
  const mediaDir = path.join(userDataPath, 'media');

  protocol.handle('local-media', (request) => {
    try {
      const url = new URL(request.url);
      let filePath = decodeURIComponent(url.pathname);

      console.log('[local-media] 请求路径:', filePath);

      if (filePath.startsWith('/') && filePath.length > 2 && filePath.charAt(2) === ':') {
        filePath = filePath.substring(1);
      }

      if (!fs.existsSync(filePath.replace(/\//g, path.sep))) {
        const hostPart = url.hostname;
        if (hostPart && hostPart.length === 1 && /^[a-zA-Z]$/.test(hostPart)) {
          const oldStylePath = hostPart.toUpperCase() + ':' + filePath;
          const candidate = oldStylePath.replace(/\//g, path.sep);
          if (fs.existsSync(candidate)) {
            filePath = oldStylePath;
          }
        }
      }

      filePath = filePath.replace(/\//g, path.sep);

      const resolvedPath = path.resolve(filePath);
      // 通过 ?allow=true 查询参数绕过目录限制（用于批量导入等场景）
      const urlObj = new URL(request.url);
      const allowExternal = urlObj.searchParams.get('allow') === 'true';
      if (!allowExternal) {
        const allowedDirs = [mediaDir, userDataPath];
        const isAllowed = allowedDirs.some(dir => {
          const normalizedDir = path.resolve(dir);
          return resolvedPath.startsWith(normalizedDir + path.sep) || resolvedPath === normalizedDir;
        });
        if (!isAllowed) {
          console.warn('[local-media] 访问被拒绝，路径不在允许目录中:', resolvedPath);
          console.warn('[local-media] 允许的目录:', allowedDirs);
          return new Response('Forbidden', { status: 403 });
        }
      }

      if (!fs.existsSync(filePath)) {
        console.warn('[local-media] 文件不存在:', filePath);
        return new Response('File not found', { status: 404 });
      }

      console.log('[local-media] 文件访问成功:', filePath);

      const ext = path.extname(filePath).toLowerCase();
      const mimeMap = {
        '.png': 'image/png', '.jpg': 'image/jpeg', '.jpeg': 'image/jpeg',
        '.gif': 'image/gif', '.bmp': 'image/bmp', '.webp': 'image/webp',
        '.svg': 'image/svg+xml', '.ico': 'image/x-icon',
        '.mp3': 'audio/mpeg', '.wav': 'audio/wav', '.ogg': 'audio/ogg',
        '.flac': 'audio/flac', '.aac': 'audio/aac', '.m4a': 'audio/mp4',
        '.mp4': 'video/mp4', '.webm': 'video/webm', '.avi': 'video/x-msvideo',
        '.mov': 'video/quicktime', '.mkv': 'video/x-matroska',
        '.pdf': 'application/pdf',
      };
      const mimeType = mimeMap[ext] || 'application/octet-stream';
      const stat = fs.statSync(filePath);
      const fileSize = stat.size;
      const videoExts = new Set(['.mp4', '.webm', '.avi', '.mov', '.mkv']);
      const isVideo = videoExts.has(ext);

      const rangeHeader = request.headers.get('Range') || request.headers.get('range');

      if (rangeHeader && rangeHeader.startsWith('bytes=')) {
        const rangePart = rangeHeader.slice(6);
        const match = rangePart.match(/^(\d*)-(\d*)$/);
        if (!match) {
          return new Response('Invalid Range', { status: 416, headers: { 'Content-Range': `bytes */${fileSize}` } });
        }

        let start: number;
        let end: number;

        if (match[1] === '' && match[2] !== '') {
          const suffix = parseInt(match[2], 10);
          start = Math.max(0, fileSize - suffix);
          end = fileSize - 1;
        } else if (match[1] !== '' && match[2] === '') {
          start = parseInt(match[1], 10);
          end = fileSize - 1;
        } else {
          start = parseInt(match[1], 10);
          end = parseInt(match[2], 10);
        }

        if (start >= fileSize || end >= fileSize || start > end) {
          return new Response('Range Not Satisfiable', { status: 416, headers: { 'Content-Range': `bytes */${fileSize}` } });
        }

        const contentLength = end - start + 1;
        const headers: Record<string, string> = {
          'Content-Type': mimeType,
          'Content-Length': String(contentLength),
          'Content-Range': `bytes ${start}-${end}/${fileSize}`,
          'Accept-Ranges': 'bytes',
        };
        if (isVideo) {
          headers['Content-Disposition'] = 'inline';
        }

        const nodeStream = fs.createReadStream(filePath, { start, end });
        const webStream = new ReadableStream({
          start(controller) {
            nodeStream.on('data', (chunk: Buffer) => controller.enqueue(new Uint8Array(chunk)));
            nodeStream.on('end', () => controller.close());
            nodeStream.on('error', (err: Error) => controller.error(err));
          },
          cancel() {
            nodeStream.destroy();
          },
        });

        return new Response(webStream, { status: 206, headers });
      }

      const headers: Record<string, string> = {
        'Content-Type': mimeType,
        'Content-Length': String(fileSize),
        'Accept-Ranges': 'bytes',
      };
      if (isVideo) {
        headers['Content-Disposition'] = 'inline';
      }

      const nodeStream = fs.createReadStream(filePath);
      const webStream = new ReadableStream({
        start(controller) {
          nodeStream.on('data', (chunk: Buffer) => controller.enqueue(new Uint8Array(chunk)));
          nodeStream.on('end', () => controller.close());
          nodeStream.on('error', (err: Error) => controller.error(err));
        },
        cancel() {
          nodeStream.destroy();
        },
      });

      return new Response(webStream, { status: 200, headers });
    } catch (e) {
      return new Response('Error', { status: 500 });
    }
  });

  // 音乐流代理协议：将远程音频 URL 通过本地协议代理，避免 CORS/Referer 问题
  protocol.handle('music-stream', (request) => {
    try {
      const url = new URL(request.url);
      const originalUrl = url.searchParams.get('url');
      const referer = url.searchParams.get('referer') || '';

      if (!originalUrl) {
        return new Response('Missing url parameter', { status: 400 });
      }

      let parsedUrl;
      try {
        parsedUrl = new URL(originalUrl);
      } catch {
        return new Response('Invalid URL', { status: 400 });
      }
      if (!['http:', 'https:'].includes(parsedUrl.protocol)) {
        return new Response('Protocol not allowed', { status: 400 });
      }
      const hostname = parsedUrl.hostname;
      const blockedPatterns = [
        /^127\./, /^10\./, /^172\.(1[6-9]|2[0-9]|3[01])\./, /^192\.168\./,
        /^0\./, /^localhost$/i, /^::1$/, /^fd/i, /^fe80:/i,
      ];
      const allowedMusicHosts = ['localhost:9292', '127.0.0.1:9292'];
      const hostPort = hostname + ':' + parsedUrl.port;
      if (!allowedMusicHosts.includes(hostPort) && blockedPatterns.some(p => p.test(hostname))) {
        return new Response('Private network not allowed', { status: 403 });
      }

      const httpModule = originalUrl.startsWith('https') ? require('https') : require('http');

      return new Promise((resolve) => {
        const headers: Record<string, string> = {
          'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
        };
        if (referer) {
          headers['Referer'] = referer;
        }

        httpModule.get(originalUrl, { headers }, (res) => {
          if (res.statusCode !== 200) {
            res.destroy();
            resolve(new Response(`Upstream error: ${res.statusCode}`, { status: res.statusCode }));
            return;
          }

          const contentType = res.headers['content-type'] || 'audio/mpeg';
          const contentLength = res.headers['content-length'];

          const respHeaders: Record<string, string> = {
            'Content-Type': contentType,
            'Accept-Ranges': 'bytes',
          };
          if (contentLength) {
            respHeaders['Content-Length'] = contentLength;
          }

          const webStream = new ReadableStream({
            start(controller) {
              res.on('data', (chunk: Buffer) => controller.enqueue(new Uint8Array(chunk)));
              res.on('end', () => controller.close());
              res.on('error', (err: Error) => controller.error(err));
            },
            cancel() {
              res.destroy();
            },
          });

          resolve(new Response(webStream, { status: 200, headers: respHeaders }));
        }).on('error', (e: Error) => {
          resolve(new Response(`Network error: ${e.message}`, { status: 502 }));
        });
      });
    } catch (e) {
      return new Response('Error', { status: 500 });
    }
  });

  const backupDir = path.join(userDataPath, 'backups');
  repo.setPaths(userDataPath, mediaDir, backupDir);
  repo.ensureDir(userDataPath);
  repo.ensureDir(mediaDir);
  repo.ensureDir(backupDir);
  console.log('[主进程] 数据存储目录:', userDataPath);

  try {
    const useSqlite = repo.initDatabase();
    if (useSqlite) {
      console.log('[主进程] 使用SQLite数据库');
    } else {
      repo.JsonStore.init();
      console.log('[主进程] 使用JSON文件存储（降级模式）');
    }
  } catch (e) {
    console.error('[主进程] 数据库初始化异常，使用降级模式:', e);
    repo.JsonStore.init();
  }

  registerAllIpcHandlers(mainWindow);
  registerDragDropIPC(mainWindow);

  // 初始化 RAG Watcher（数据变更自动索引）
  try {
    const ragWatcher = require('./services/rag-watcher');
    ragWatcher.setupRagWatcher();
    console.log('[主进程] RAG Watcher 已启动');
  } catch (e) {
    console.warn('[主进程] RAG Watcher 初始化失败:', e.message);
  }

  // 初始化 MCP 预置服务器并连接已启用的服务
  try {
    const mcpConfigService = require('./services/mcp-config-service');
    mcpConfigService.initPresetServers();
    console.log('[主进程] MCP 预置服务器初始化完成');
  } catch (e) {
    console.warn('[主进程] MCP 预置服务器初始化失败:', e.message);
  }

  initSupabaseServer();

  (async () => {
    try {
      const lxMusicApi = require('./services/lx-music-api');
      const status = await lxMusicApi.checkStatus();
      if (status.online) {
        console.log('[主进程] lx-music-api-server 已连接:', lxMusicApi.getApiUrl());
      } else {
        console.log('[主进程] lx-music-api-server 未运行，在线音乐播放URL获取将使用旧逻辑');
      }
    } catch (e) {
      console.log('[主进程] lx-music-api-server 检测失败:', e.message);
    }
  })();

  createWindow();

  // 注册全局媒体快捷键（仅在生产环境注册，避免开发模式冲突）
  if (!isDev) {
    globalShortcut.register('MediaPlayPause', () => {
      const windows = BrowserWindow.getAllWindows();
      windows.forEach(win => {
        win.webContents.send('music:global-toggle-play');
      });
    });

    globalShortcut.register('MediaNextTrack', () => {
      const windows = BrowserWindow.getAllWindows();
      windows.forEach(win => {
        win.webContents.send('music:global-next-track');
      });
    });

    globalShortcut.register('MediaPreviousTrack', () => {
      const windows = BrowserWindow.getAllWindows();
      windows.forEach(win => {
        win.webContents.send('music:global-prev-track');
      });
    });

    console.log('[主进程] 全局媒体快捷键已注册');
  }

  console.log('[主进程] 应用启动完成');
});

app.on('window-all-closed', () => {
  if (process.platform !== 'darwin') {
    app.quit();
  }
});

app.on('activate', () => {
  if (BrowserWindow.getAllWindows().length === 0) {
    createWindow();
  }
});

process.on('uncaughtException', (error) => {
  console.error('[主进程] 未捕获异常:', error);
});

process.on('unhandledRejection', (reason) => {
  console.error('[主进程] 未处理的Promise拒绝:', reason);
});
