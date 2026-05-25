/**
 * Electron预加载脚本
 * 在渲染进程中安全地暴露主进程功能
 */
const { contextBridge, ipcRenderer, webUtils } = require('electron');

// 向渲染进程暴露安全的API
contextBridge.exposeInMainWorld('electronAPI', {
  // 创意管理
  creativity: {
    create: (data) => ipcRenderer.invoke('creativity:create', data),
    read: (id) => ipcRenderer.invoke('creativity:read', id),
    update: (id, data) => ipcRenderer.invoke('creativity:update', id, data),
    delete: (id, options) => ipcRenderer.invoke('creativity:delete', id, options),
    list: (params) => ipcRenderer.invoke('creativity:list', params),
    search: (keyword, filters) => ipcRenderer.invoke('creativity:search', keyword, filters),
    batchUpdate: (ids, data) => ipcRenderer.invoke('creativity:batch-update', ids, data),
    batchDelete: (ids, permanent, options) => ipcRenderer.invoke('creativity:batch-delete', ids, permanent, options),
    random: () => ipcRenderer.invoke('creativity:random'),
    stats: () => ipcRenderer.invoke('creativity:stats'),
    permanentDelete: (id, trashItemId) => ipcRenderer.invoke('creativity:permanent-delete', id, trashItemId),
    toggleFavorite: (id) => ipcRenderer.invoke('creativity:toggle-favorite', id),
    restore: (id, trashItemId) => ipcRenderer.invoke('creativity:restore', id, trashItemId),
  },

  // 看板管理
  board: {
    create: (data) => ipcRenderer.invoke('board:create', data),
    read: (id) => ipcRenderer.invoke('board:read', id),
    update: (id, data) => ipcRenderer.invoke('board:update', id, data),
    delete: (id) => ipcRenderer.invoke('board:delete', id),
    list: () => ipcRenderer.invoke('board:list'),
    addCreativity: (boardId, creativityId) => ipcRenderer.invoke('board:add-creativity', boardId, creativityId),
    removeCreativity: (boardId, creativityId) => ipcRenderer.invoke('board:remove-creativity', boardId, creativityId),
    canvas: {
      listItems: (boardId) => ipcRenderer.invoke('board:canvas-items', boardId),
      addItem: (boardId, creativityId, x, y, width, height, title, content, type, isLinked, subtype, cardStyle, priority, emojiReaction, contentFormat) => ipcRenderer.invoke('board:canvas-item-create', boardId, { creativityId, positionX: x, positionY: y, width, height, title, content, type, isLinked, subtype, cardStyle, priority, emojiReaction, contentFormat }),
      updatePosition: (itemId, x, y) => ipcRenderer.invoke('board:canvas-update-position', itemId, x, y),
      updateSize: (itemId, width, height) => ipcRenderer.invoke('board:canvas-item-update', null, itemId, { width, height }),
      updateContent: (itemId, data) => ipcRenderer.invoke('board:canvas-item-update', null, itemId, data),
      removeItem: (itemId) => ipcRenderer.invoke('board:canvas-item-delete', null, itemId),
      listEdges: (boardId) => ipcRenderer.invoke('board:canvas-edges', boardId),
      addEdge: (boardId, sourceId, targetId, edgeType, sourceConnector, targetConnector) => ipcRenderer.invoke('board:canvas-edge-create', boardId, { sourceItemId: sourceId, targetItemId: targetId, edgeType, sourceConnector, targetConnector }),
      removeEdge: (edgeId) => ipcRenderer.invoke('board:canvas-edge-delete', null, edgeId),
      updateConnector: (edgeId, isSource, connector) => ipcRenderer.invoke('board:canvas-edge-update-connector', edgeId, isSource, connector),
      updateControlPoints: (edgeId, controlPoints) => ipcRenderer.invoke('board:canvas-edge-update-control-points', edgeId, controlPoints),
      updateEdgeLabel: (edgeId, label) => ipcRenderer.invoke('board:canvas-edge-update-label', edgeId, label),
      updateEdgeType: (edgeId, edgeType) => ipcRenderer.invoke('board:canvas-edge-update-type', edgeId, edgeType),
    },
    sticky: {
      list: (boardId) => ipcRenderer.invoke('board:sticky-notes', boardId),
      add: (boardId, data) => ipcRenderer.invoke('board:sticky-note-create', boardId, data),
      update: (boardId, noteId, data) => ipcRenderer.invoke('board:sticky-note-update', boardId, noteId, data),
      remove: (boardId, noteId) => ipcRenderer.invoke('board:sticky-note-delete', boardId, noteId),
    },
    graph: {
      listNodes: (boardId) => ipcRenderer.invoke('board:graph-nodes', boardId),
      addNode: (boardId, data) => ipcRenderer.invoke('board:graph-node-create', boardId, data),
      updatePosition: (nodeId, x, y) => ipcRenderer.invoke('board:graph-update-position', nodeId, x, y),
      removeNode: (nodeId) => ipcRenderer.invoke('board:graph-node-delete', null, nodeId),
      listEdges: (boardId) => ipcRenderer.invoke('board:graph-edges', boardId),
      addEdge: (boardId, sourceId, targetId, edgeType) => ipcRenderer.invoke('board:graph-edge-create', boardId, { sourceNodeId: sourceId, targetNodeId: targetId, edgeType }),
      removeEdge: (edgeId) => ipcRenderer.invoke('board:graph-edge-delete', null, edgeId),
      getSubtree: (nodeId) => ipcRenderer.invoke('board:graph-get-subtree', nodeId),
    },
    folder: {
      list: (boardId) => ipcRenderer.invoke('board:folders', boardId),
      create: (boardId, data) => ipcRenderer.invoke('board:folder-create', boardId, data),
      update: (boardId, folderId, data) => ipcRenderer.invoke('board:folder-update', boardId, folderId, data),
      delete: (boardId, folderId) => ipcRenderer.invoke('board:folder-delete', boardId, folderId),
      addItems: (boardId, folderId, creativityId) => ipcRenderer.invoke('board:folder-add-item', boardId, folderId, creativityId),
      removeItems: (boardId, folderId, creativityId) => ipcRenderer.invoke('board:folder-remove-item', boardId, folderId, creativityId),
      getItems: (boardId, folderId) => ipcRenderer.invoke('board:folder-items', boardId, folderId),
    },
    creativeChain: {
      list: (boardId) => ipcRenderer.invoke('creativeChain:list', boardId),
      create: (boardId, data) => ipcRenderer.invoke('creativeChain:create', boardId, data),
      read: (boardId, chainId) => ipcRenderer.invoke('creativeChain:read', boardId, chainId),
      update: (boardId, chainId, data) => ipcRenderer.invoke('creativeChain:update', boardId, chainId, data),
      delete: (boardId, chainId) => ipcRenderer.invoke('creativeChain:delete', boardId, chainId),
    },
    listCreativities: (boardId) => ipcRenderer.invoke('board:list-creativities', boardId),
    addCreativityRelation: (boardId, creativityId) => ipcRenderer.invoke('board:add-creativity-relation', boardId, creativityId),
    removeCreativityRelation: (boardId, creativityId) => ipcRenderer.invoke('board:remove-creativity-relation', boardId, creativityId),
    updateIcon: (boardId, iconPath) => ipcRenderer.invoke('board:update-icon', boardId, iconPath),
    uploadIcon: (boardId, imageData) => ipcRenderer.invoke('board:upload-icon', boardId, imageData),
    deleteIcon: (boardId) => ipcRenderer.invoke('board:delete-icon', boardId),
  },

  // 标签管理
  tag: {
    create: (data) => ipcRenderer.invoke('tag:create', data),
    read: (id) => ipcRenderer.invoke('tag:read', id),
    update: (id, data) => ipcRenderer.invoke('tag:update', id, data),
    delete: (id) => ipcRenderer.invoke('tag:delete', id),
    list: () => ipcRenderer.invoke('tag:list'),
    assign: (creativityId, tagId) => ipcRenderer.invoke('tag:assign', creativityId, tagId),
    unassign: (creativityId, tagId) => ipcRenderer.invoke('tag:unassign', creativityId, tagId),
  },

  // 媒体文件
  media: {
    list: () => ipcRenderer.invoke('media:list'),
    listByCreativity: (creativityId) => ipcRenderer.invoke('media:list-by-creativity', creativityId),
    save: (data, creativityId) => ipcRenderer.invoke('media:save', data, creativityId),
    saveImage: (imageDataUrl, creativityId) => ipcRenderer.invoke('media:save-image', imageDataUrl, creativityId),
    read: (id) => ipcRenderer.invoke('media:read', id),
    delete: (id) => ipcRenderer.invoke('media:delete', id),
    thumbnail: (id) => ipcRenderer.invoke('media:thumbnail', id),
    getUrl: (filePath) => ipcRenderer.invoke('media:get-url', filePath),
    selectFile: (options) => ipcRenderer.invoke('media:select-file', options),
    linkToCreativity: (mediaIds, creativityId) => ipcRenderer.invoke('media:link-to-creativity', mediaIds, creativityId),
    getFileSize: (filePath) => ipcRenderer.invoke('media:get-file-size', filePath),
    getFileInfo: (filePath) => ipcRenderer.invoke('media:get-file-info', filePath),
    getThumbnailUrl: (mediaId) => ipcRenderer.invoke('media:get-thumbnail-url', mediaId),
    // 读取文件前 N 字节为 base64（用于视频缩略图等场景）
    readFileHead: (filePath, maxBytes) => ipcRenderer.invoke('media:read-file-head', filePath, maxBytes),
    // 读取整个文件为 base64（用于批量导入缩略图生成）
    readFileAsBase64: (filePath) => ipcRenderer.invoke('media:read-file-as-base64', filePath),
    migrateContentReferences: () => ipcRenderer.invoke('media:migrate-content-references'),
    loadAllPaths: () => ipcRenderer.invoke('media:load-all-paths'),
    importFromPath: (filePath, options) => ipcRenderer.invoke('media:import-from-path', filePath, options),
  },

  // 搜索
  search: {
    fulltext: (keyword) => ipcRenderer.invoke('search:fulltext', keyword),
    filter: (filters) => ipcRenderer.invoke('search:filter', filters),
  },

  // 模板
  template: {
    list: () => ipcRenderer.invoke('template:list'),
    get: (id) => ipcRenderer.invoke('template:get', id),
    create: (data) => ipcRenderer.invoke('template:create', data),
    update: (id, data) => ipcRenderer.invoke('template:update', id, data),
    delete: (id) => ipcRenderer.invoke('template:delete', id),
  },

  // 设置
  settings: {
    get: (key) => ipcRenderer.invoke('settings:get', key),
    set: (key, value) => ipcRenderer.invoke('settings:set', key, value),
    onUpdate: (callback) => {
      const handler = (_event, data) => callback(data);
      ipcRenderer.on('settings:update', handler);
      return () => ipcRenderer.removeListener('settings:update', handler);
    },
  },

  // 备份
  backup: {
    create: () => ipcRenderer.invoke('backup:create'),
    restore: () => ipcRenderer.invoke('backup:restore'),
    auto: () => ipcRenderer.invoke('backup:auto'),
  },

  // 导出
  export: {
    json: (ids) => ipcRenderer.invoke('export:json', ids),
    html: (ids) => ipcRenderer.invoke('export:html', ids),
    markdown: (ids) => ipcRenderer.invoke('export:markdown', ids),
  },

  // 文件操作
  file: {
    select: (filters) => ipcRenderer.invoke('file:select', filters),
    selectMultiple: (filters) => ipcRenderer.invoke('file:select-multiple', filters),
    save: (defaultPath, filters) => ipcRenderer.invoke('file:save', defaultPath, filters),
    getPathForFile: (file) => webUtils.getPathForFile(file),
    readTextFile: (filePath) => ipcRenderer.invoke('file:read-text', filePath),
  },

  // 窗口控制
  window: {
    minimize: () => ipcRenderer.invoke('window:minimize'),
    maximize: () => ipcRenderer.invoke('window:maximize'),
    close: () => ipcRenderer.invoke('window:close'),
    openMusicPlayer: () => ipcRenderer.invoke('window:open-music-player'),
    closeMusicPlayer: () => ipcRenderer.invoke('window:close-music-player'),
    isMusicPlayerOpen: () => ipcRenderer.invoke('window:is-music-player-open'),
    openVisualizerFullscreen: () => ipcRenderer.invoke('window:open-visualizer-fullscreen'),
    closeVisualizerFullscreen: () => ipcRenderer.invoke('window:close-visualizer-fullscreen'),
    isVisualizerFullscreenOpen: () => ipcRenderer.invoke('window:is-visualizer-fullscreen-open'),
    saveScreenshot: (dataUrl) => ipcRenderer.invoke('visualizer:save-screenshot', dataUrl),
    saveRecording: (bufferData) => ipcRenderer.invoke('visualizer:save-recording', bufferData),
    onFrequencyData: (callback) => {
      const handler = (_event, data) => callback(data);
      ipcRenderer.on('visualizer:frequency-data', handler);
      return () => ipcRenderer.removeListener('visualizer:frequency-data', handler);
    },
    onFullscreenClosed: (callback) => {
      const handler = () => callback();
      ipcRenderer.on('visualizer:fullscreen-closed', handler);
      return () => ipcRenderer.removeListener('visualizer:fullscreen-closed', handler);
    },
  },

  // 天气
  weather: {
    updateCity: (city) => ipcRenderer.send('weather:update-city', city),
    saveSnapshot: () => ipcRenderer.invoke('weather:save-snapshot'),
    getHistory: (days) => ipcRenderer.invoke('weather:get-history', days),
  },

  // 回收站
  trash: {
    list: () => ipcRenderer.invoke('trash:list'),
    add: (data) => ipcRenderer.invoke('trash:add', data),
    restore: (trashItemId) => ipcRenderer.invoke('trash:restore', trashItemId),
    permanentDelete: (trashItemId) => ipcRenderer.invoke('trash:permanent-delete', trashItemId),
    clear: () => ipcRenderer.invoke('trash:clear'),
    checkBoardExists: (boardId) => ipcRenderer.invoke('trash:check-board-exists', boardId),
  },

  // Shell 操作
  shell: {
    openExternal: (url) => ipcRenderer.invoke('shell:open-external', url),
  },

  // 更新检查
  updater: {
    check: () => ipcRenderer.invoke('updater:check'),
  },

  // 音乐库
  music: {
    importFiles: (filePaths) => ipcRenderer.invoke('music:import-files', filePaths),
    getAllTracks: () => ipcRenderer.invoke('music:get-all-tracks'),
    getTrack: (id) => ipcRenderer.invoke('music:get-track', id),
    deleteTrack: (id) => ipcRenderer.invoke('music:delete-track', id),
    searchTracks: (query) => ipcRenderer.invoke('music:search-tracks', query),
    toggleFavorite: (id) => ipcRenderer.invoke('music:toggle-favorite', id),
    getFavorites: () => ipcRenderer.invoke('music:get-favorites'),
    updateTrack: (id, updates) => ipcRenderer.invoke('music:update-track', id, updates),
    readMetadata: (filePath) => ipcRenderer.invoke('music:read-metadata', filePath),
    // 歌单相关
    createPlaylist: (name, description) => ipcRenderer.invoke('music:create-playlist', name, description),
    getAllPlaylists: () => ipcRenderer.invoke('music:get-all-playlists'),
    getPlaylist: (id) => ipcRenderer.invoke('music:get-playlist', id),
    updatePlaylist: (id, updates) => ipcRenderer.invoke('music:update-playlist', id, updates),
    deletePlaylist: (id) => ipcRenderer.invoke('music:delete-playlist', id),
    addTrackToPlaylist: (playlistId, trackId) => ipcRenderer.invoke('music:add-track-to-playlist', playlistId, trackId),
    removeTrackFromPlaylist: (playlistId, trackId) => ipcRenderer.invoke('music:remove-track-from-playlist', playlistId, trackId),
    getPlaylistTracks: (playlistId) => ipcRenderer.invoke('music:get-playlist-tracks', playlistId),
    reorderPlaylistTracks: (playlistId, trackIds) => ipcRenderer.invoke('music:reorder-playlist-tracks', playlistId, trackIds),
    // 播放历史统计
    recordPlay: (params) => ipcRenderer.invoke('music:record-play', params),
    getPlayStats: (options) => ipcRenderer.invoke('music:get-play-stats', options),
    // 多源音乐搜索
    aggregateSearch: (options, cookie) => ipcRenderer.invoke('music:aggregate-search', options, cookie),
    searchNetease: (keyword, limit, cookie) => ipcRenderer.invoke('music:search-netease', keyword, limit, cookie),
    searchQQ: (keyword, limit) => ipcRenderer.invoke('music:search-qq', keyword, limit),
    searchKugou: (keyword, limit) => ipcRenderer.invoke('music:search-kugou', keyword, limit),
    searchMigu: (keyword, limit) => ipcRenderer.invoke('music:search-migu', keyword, limit),
    searchBaidu: (keyword, limit) => ipcRenderer.invoke('music:search-baidu', keyword, limit),
    searchKuwo: (keyword, limit) => ipcRenderer.invoke('music:search-kuwo', keyword, limit),
    getMultiSourceUrl: (song, cookie) => ipcRenderer.invoke('music:get-multi-source-url', song, cookie),
    getMultiSourceLyric: (song) => ipcRenderer.invoke('music:get-multi-source-lyric', song),
    onMusicGlobalTogglePlay: (callback) => {
      const handler = () => callback();
      ipcRenderer.on('music:global-toggle-play', handler);
      return () => ipcRenderer.removeListener('music:global-toggle-play', handler);
    },
    onMusicGlobalNextTrack: (callback) => {
      const handler = () => callback();
      ipcRenderer.on('music:global-next-track', handler);
      return () => ipcRenderer.removeListener('music:global-next-track', handler);
    },
    onMusicGlobalPrevTrack: (callback) => {
      const handler = () => callback();
      ipcRenderer.on('music:global-prev-track', handler);
      return () => ipcRenderer.removeListener('music:global-prev-track', handler);
    },
  },

  // 在线音乐
  musicOnline: {
    search: (params) => ipcRenderer.invoke('music-online:search', params),
    getUrl: (params) => ipcRenderer.invoke('music-online:get-url', params),
    getLyric: (songmid) => ipcRenderer.invoke('music-online:get-lyric', songmid),
    getDetail: (songmids) => ipcRenderer.invoke('music-online:get-detail', songmids),
    setCookie: (cookie) => ipcRenderer.invoke('music-online:set-cookie', cookie),
    getCookie: () => ipcRenderer.invoke('music-online:get-cookie'),
    checkCookie: (cookie) => ipcRenderer.invoke('music-online:check-cookie', cookie),
    // QQ 登录
    loginOpen: () => ipcRenderer.invoke('music-online:login-open'),
    loginStatus: () => ipcRenderer.invoke('music-online:login-status'),
    loginClose: () => ipcRenderer.invoke('music-online:login-close'),
    // 网易云登录（需求7）
    loginNetease: () => ipcRenderer.invoke('music-online:login-netease'),
    loginNeteaseStatus: () => ipcRenderer.invoke('music-online:login-netease-status'),
    loginNeteaseClose: () => ipcRenderer.invoke('music-online:login-netease-close'),
    // 榜单功能（需求8）
    getCharts: () => ipcRenderer.invoke('music-online:get-charts'),
    getChartSongs: (params) => ipcRenderer.invoke('music-online:get-chart-songs', params),
    // 账号管理（需求9）
    getNeteaseUser: () => ipcRenderer.invoke('music-online:get-netease-user'),
    checkNeteaseLogin: () => ipcRenderer.invoke('music-online:check-netease-login'),
    saveAccount: (params) => ipcRenderer.invoke('music-online:save-account', params),
    getSavedAccounts: (platform) => ipcRenderer.invoke('music-online:get-saved-accounts', platform),
    deleteAccount: (params) => ipcRenderer.invoke('music-online:delete-account', params),
    switchAccount: (params) => ipcRenderer.invoke('music-online:switch-account', params),
    logoutNetease: () => ipcRenderer.invoke('music-online:logout-netease'),
    // 在线歌曲下载（需求10）
    downloadSong: (songInfo) => ipcRenderer.invoke('music-online:download-song', songInfo),
  },

  // lx-music-api 音源服务
  lxMusic: {
    checkStatus: () => ipcRenderer.invoke('lx-music:check-status'),
    getUrl: (params) => ipcRenderer.invoke('lx-music:get-url', params),
    getInfo: (params) => ipcRenderer.invoke('lx-music:get-info', params),
    getLyric: (params) => ipcRenderer.invoke('lx-music:get-lyric', params),
    setApiUrl: (url) => ipcRenderer.invoke('lx-music:set-api-url', url),
    getApiUrl: () => ipcRenderer.invoke('lx-music:get-api-url'),
    getSources: () => ipcRenderer.invoke('lx-music:get-sources'),
    syncQQCredentials: (cookie) => ipcRenderer.invoke('lx-music:sync-qq-credentials', cookie),
  },

  // 统一音乐服务 (QQ + 网易云)
  musicUnified: {
    searchQQ: (params) => ipcRenderer.invoke('music-unified:search-qq', params),
    searchNetease: (params) => ipcRenderer.invoke('music-unified:search-netease', params),
    searchAll: (params) => ipcRenderer.invoke('music-unified:search-all', params),
    getQQUrl: (params) => ipcRenderer.invoke('music-unified:get-qq-url', params),
    getNeteaseUrl: (params) => ipcRenderer.invoke('music-unified:get-netease-url', params),
    getQQLyric: (params) => ipcRenderer.invoke('music-unified:get-qq-lyric', params),
    getNeteaseLyric: (params) => ipcRenderer.invoke('music-unified:get-netease-lyric', params),
    getQQToplist: () => ipcRenderer.invoke('music-unified:get-qq-toplist'),
    getQQTopDetail: (params) => ipcRenderer.invoke('music-unified:get-qq-top-detail', params),
    getQQSonglist: (params) => ipcRenderer.invoke('music-unified:get-qq-songlist', params),
    setQQCookie: (cookie) => ipcRenderer.invoke('music-unified:set-qq-cookie', cookie),
    getQQCookie: () => ipcRenderer.invoke('music-unified:get-qq-cookie'),
    setNeteaseCookie: (cookie) => ipcRenderer.invoke('music-unified:set-netease-cookie', cookie),
    refreshQQLogin: () => ipcRenderer.invoke('music-unified:refresh-qq-login'),
    getQQUserInfo: () => ipcRenderer.invoke('music-unified:get-qq-user-info'),
  },

  // 菜单事件监听
  onMenuEvent: (channel, callback) => {
    ipcRenderer.on(channel, (_event, ...args) => callback(...args));
    return () => ipcRenderer.removeAllListeners(channel);
  },

  onCreativityChanged: (callback) => {
    const handler = () => callback();
    ipcRenderer.on('creativity:changed', handler);
    return () => ipcRenderer.removeListener('creativity:changed', handler);
  },

  onPreviewCreativity: (callback) => {
    const handler = (_event, data) => callback(data);
    ipcRenderer.on('preview:creativity', handler);
    return () => ipcRenderer.removeListener('preview:creativity', handler);
  },

  onPreviewMarkdown: (callback) => {
    const handler = (_event, data) => callback(data);
    ipcRenderer.on('preview:markdown', handler);
    return () => ipcRenderer.removeListener('preview:markdown', handler);
  },

  // AI 大模型
  ai: {
    chat: (messages, config) => ipcRenderer.invoke('ai:chat', messages, config),
    chatStream: (messages, config) => ipcRenderer.invoke('ai:chat-stream', messages, config),
    stopGeneration: () => ipcRenderer.invoke('ai:stop-generation'),
    listModels: (config) => ipcRenderer.invoke('ai:list-models', config),
    testConnection: (config) => ipcRenderer.invoke('ai:test-connection', config),
    onToken: (callback) => {
      const handler = (_event, token) => callback(token);
      ipcRenderer.on('ai:token', handler);
      return () => ipcRenderer.removeListener('ai:token', handler);
    },
    onStreamEnd: (callback) => {
      const handler = (_event, fullText) => callback(fullText);
      ipcRenderer.on('ai:stream-end', handler);
      return () => ipcRenderer.removeListener('ai:stream-end', handler);
    },
    onStreamError: (callback) => {
      const handler = (_event, error) => callback(error);
      ipcRenderer.on('ai:stream-error', handler);
      return () => ipcRenderer.removeListener('ai:stream-error', handler);
    },
    // AI 音乐工具
    musicSearch: (params) => ipcRenderer.invoke('ai:music-search', params),
    musicClassifyEmotion: (params) => ipcRenderer.invoke('ai:music-classify-emotion', params),
    musicGetStatsSummary: () => ipcRenderer.invoke('ai:music-get-stats-summary'),
    // 联网搜索
    webSearch: (query) => ipcRenderer.invoke('ai:web-search', query),
    // 今日实时用量统计
    getRealtimeStats: () => ipcRenderer.invoke('ai:realtime-stats'),
    // Tool Calling
    chatStreamWithTools: (messages, config) => ipcRenderer.invoke('ai:chat-stream-with-tools', messages, config),
    getToolDefinitions: () => ipcRenderer.invoke('ai:get-tool-definitions'),
    onToolCall: (callback) => {
      const handler = (_event, data) => callback(data);
      ipcRenderer.on('ai:tool-call', handler);
      return () => ipcRenderer.removeListener('ai:tool-call', handler);
    },
    onStreamEndWithTools: (callback) => {
      const handler = (_event, data) => callback(data);
      ipcRenderer.on('ai:stream-end-with-tools', handler);
      return () => ipcRenderer.removeListener('ai:stream-end-with-tools', handler);
    },
    // AI 记忆系统
    memory: {
      add: (memory) => ipcRenderer.invoke('ai:memory:add', memory),
      list: (options) => ipcRenderer.invoke('ai:memory:list', options),
      search: (query) => ipcRenderer.invoke('ai:memory:search', query),
      delete: (id) => ipcRenderer.invoke('ai:memory:delete', id),
      update: (id, updates) => ipcRenderer.invoke('ai:memory:update', id, updates),
      extract: (params) => ipcRenderer.invoke('ai:memory:extract', params),
      relevant: (params) => ipcRenderer.invoke('ai:memory:relevant', params),
      clear: () => ipcRenderer.invoke('ai:memory:clear'),
      stats: () => ipcRenderer.invoke('ai:memory:stats'),
    },
    // 代码执行
    executeCode: (params) => ipcRenderer.invoke('ai:execute-code', params),
    // 文件操作
    fileRead: (filePath) => ipcRenderer.invoke('ai:file-read', filePath),
    fileList: (dirPath) => ipcRenderer.invoke('ai:file-list', dirPath),
    // Agent 模式
    agentExecuteTask: (instruction, config) => ipcRenderer.invoke('agent:execute-task', instruction, config),
    agentCancelTask: () => ipcRenderer.invoke('agent:cancel-task'),
    // 思考过程
    onThinkingToken: (callback) => {
      const handler = (_event, token) => callback(token);
      ipcRenderer.on('agent:thinking-token', handler);
      return () => ipcRenderer.removeListener('agent:thinking-token', handler);
    },
    onThinkingEnd: (callback) => {
      const handler = (_event, text) => callback(text);
      ipcRenderer.on('agent:thinking-end', handler);
      return () => ipcRenderer.removeListener('agent:thinking-end', handler);
    },
    // 规划
    onPlanReady: (callback) => {
      const handler = (_event, plan) => callback(plan);
      ipcRenderer.on('agent:plan-ready', handler);
      return () => ipcRenderer.removeListener('agent:plan-ready', handler);
    },
    // 状态变化
    onStatusChange: (callback) => {
      const handler = (_event, status) => callback(status);
      ipcRenderer.on('agent:status-change', handler);
      return () => ipcRenderer.removeListener('agent:status-change', handler);
    },
    // 阶段
    onPhaseStart: (callback) => {
      const handler = (_event, data) => callback(data);
      ipcRenderer.on('agent:phase-start', handler);
      return () => ipcRenderer.removeListener('agent:phase-start', handler);
    },
    onPhaseComplete: (callback) => {
      const handler = (_event, data) => callback(data);
      ipcRenderer.on('agent:phase-complete', handler);
      return () => ipcRenderer.removeListener('agent:phase-complete', handler);
    },
    // 步骤
    onAgentStepStart: (callback) => {
      const handler = (_event, step) => callback(step);
      ipcRenderer.on('agent:step-start', handler);
      return () => ipcRenderer.removeListener('agent:step-start', handler);
    },
    onAgentStepComplete: (callback) => {
      const handler = (_event, step) => callback(step);
      ipcRenderer.on('agent:step-complete', handler);
      return () => ipcRenderer.removeListener('agent:step-complete', handler);
    },
    onAgentStepError: (callback) => {
      const handler = (_event, data) => callback(data);
      ipcRenderer.on('agent:step-error', handler);
      return () => ipcRenderer.removeListener('agent:step-error', handler);
    },
    onStepThinking: (callback) => {
      const handler = (_event, data) => callback(data);
      ipcRenderer.on('agent:step-thinking', handler);
      return () => ipcRenderer.removeListener('agent:step-thinking', handler);
    },
    // 任务完成
    onAgentTaskComplete: (callback) => {
      const handler = (_event, task) => callback(task);
      ipcRenderer.on('agent:task-complete', handler);
      return () => ipcRenderer.removeListener('agent:task-complete', handler);
    },
    onAgentTaskError: (callback) => {
      const handler = (_event, data) => callback(data);
      ipcRenderer.on('agent:task-error', handler);
      return () => ipcRenderer.removeListener('agent:task-error', handler);
    },
    // AI 导航
    onNavigate: (callback) => {
      const handler = (_event, command) => callback(command);
      ipcRenderer.on('ai:navigate', handler);
      return () => ipcRenderer.removeListener('ai:navigate', handler);
    },
    // ========== 新版 Query Engine API ==========
    queryStream: (messages, config, options) => ipcRenderer.invoke('ai:query-stream', messages, config, options),
    searchMemories: (query) => ipcRenderer.invoke('ai:search-memories', query),
    getMemories: () => ipcRenderer.invoke('ai:get-memories'),
    addMemory: (memory) => ipcRenderer.invoke('ai:add-memory', memory),
    deleteMemory: (id) => ipcRenderer.invoke('ai:delete-memory', id),
    onUsage: (callback) => {
      const handler = (_event, usage) => callback(usage);
      ipcRenderer.on('ai:usage', handler);
      return () => ipcRenderer.removeListener('ai:usage', handler);
    },
    // MCP
    mcpGetStatus: () => ipcRenderer.invoke('mcp:get-status'),
    mcpConnectServer: (config) => ipcRenderer.invoke('mcp:connect-server', config),
    mcpDisconnectServer: (serverId) => ipcRenderer.invoke('mcp:disconnect-server', serverId),
    mcpListTools: () => ipcRenderer.invoke('mcp:list-tools'),
    mcpCallTool: (toolName, args) => ipcRenderer.invoke('mcp:call-tool', toolName, args),
  },

  // MCP 配置管理
  mcpConfig: {
    initPresets: () => ipcRenderer.invoke('mcp-config:init-presets'),
    list: () => ipcRenderer.invoke('mcp-config:list'),
    get: (serverId) => ipcRenderer.invoke('mcp-config:get', serverId),
    create: (server) => ipcRenderer.invoke('mcp-config:create', server),
    update: (serverId, updates) => ipcRenderer.invoke('mcp-config:update', serverId, updates),
    delete: (serverId) => ipcRenderer.invoke('mcp-config:delete', serverId),
    toggle: (serverId) => ipcRenderer.invoke('mcp-config:toggle', serverId),
    connect: (serverId) => ipcRenderer.invoke('mcp-config:connect', serverId),
    disconnect: (serverId) => ipcRenderer.invoke('mcp-config:disconnect', serverId),
    usageStats: (serverId, days) => ipcRenderer.invoke('mcp-config:usage-stats', serverId, days),
    usageSummary: (serverId) => ipcRenderer.invoke('mcp-config:usage-summary', serverId),
    initializeAll: () => ipcRenderer.invoke('mcp-config:initialize-all'),
  },

  // 云同步认证
  auth: {
    syncSession: (accessToken) => ipcRenderer.invoke('auth:sync-session', accessToken),
    downloadAll: () => ipcRenderer.invoke('auth:download-all'),
    uploadAll: () => ipcRenderer.invoke('auth:upload-all'),
    getSyncStatus: () => ipcRenderer.invoke('auth:sync-status'),
  },

  // 写作台（独立存储，与创意库分离）
  writing: {
    // 卷管理
    listVolumes: (boardId) => ipcRenderer.invoke('writing:list-volumes', boardId),
    createVolume: (data) => ipcRenderer.invoke('writing:create-volume', data),
    updateVolume: (id, data) => ipcRenderer.invoke('writing:update-volume', id, data),
    deleteVolume: (id) => ipcRenderer.invoke('writing:delete-volume', id),
    // 章节管理
    listChapters: (volumeId, boardId) => ipcRenderer.invoke('writing:list-chapters', volumeId, boardId),
    getChapter: (id) => ipcRenderer.invoke('writing:get-chapter', id),
    createChapter: (data) => ipcRenderer.invoke('writing:create-chapter', data),
    updateChapter: (id, data) => ipcRenderer.invoke('writing:update-chapter', id, data),
    deleteChapter: (id) => ipcRenderer.invoke('writing:delete-chapter', id),
    // 备份管理
    listBackups: (chapterId) => ipcRenderer.invoke('writing:list-backups', chapterId),
    restoreBackup: (backupId) => ipcRenderer.invoke('writing:restore-backup', backupId),
    createBackup: (chapterId) => ipcRenderer.invoke('writing:create-backup', chapterId),
    // 数据迁移
    migrateFromCreativities: () => ipcRenderer.invoke('writing:migrate-from-creativities'),
    // 统计
    getStats: (boardId) => ipcRenderer.invoke('writing:get-stats', boardId),
  },

  // 聊天室写作模式
  chatRoom: {
    characters: {
      list: (boardId) => ipcRenderer.invoke('chat-room:list-characters', boardId),
      create: (data) => ipcRenderer.invoke('chat-room:create-character', data),
      update: (id, data) => ipcRenderer.invoke('chat-room:update-character', id, data),
      delete: (id) => ipcRenderer.invoke('chat-room:delete-character', id),
    },
    relations: {
      list: (boardId) => ipcRenderer.invoke('chat-room:list-relations', boardId),
      create: (data) => ipcRenderer.invoke('chat-room:create-relation', data),
      update: (id, data) => ipcRenderer.invoke('chat-room:update-relation', id, data),
      delete: (id) => ipcRenderer.invoke('chat-room:delete-relation', id),
    },
    messages: {
      list: (volumeId, chapterId) => ipcRenderer.invoke('chat-room:list-messages', volumeId, chapterId),
      create: (data) => ipcRenderer.invoke('chat-room:create-message', data),
      update: (id, data) => ipcRenderer.invoke('chat-room:update-message', id, data),
      delete: (id) => ipcRenderer.invoke('chat-room:delete-message', id),
      reorder: (volumeId, messageIds) => ipcRenderer.invoke('chat-room:reorder-messages', volumeId, messageIds),
    },
    scenes: {
      list: (volumeId) => ipcRenderer.invoke('chat-room:list-scenes', volumeId),
      create: (data) => ipcRenderer.invoke('chat-room:create-scene', data),
      update: (id, data) => ipcRenderer.invoke('chat-room:update-scene', id, data),
      delete: (id) => ipcRenderer.invoke('chat-room:delete-scene', id),
    },
  },

  // AI 聊天记录
  chatHistory: {
    createWindow: (title) => ipcRenderer.invoke('chat:create-window', title),
    listWindows: (options) => ipcRenderer.invoke('chat:list-windows', options),
    getWindow: (windowId) => ipcRenderer.invoke('chat:get-window', windowId),
    updateWindow: (windowId, updates) => ipcRenderer.invoke('chat:update-window', windowId, updates),
    deleteWindow: (windowId) => ipcRenderer.invoke('chat:delete-window', windowId),
    addMessage: (windowId, message) => ipcRenderer.invoke('chat:add-message', windowId, message),
    addMessages: (windowId, messages) => ipcRenderer.invoke('chat:add-messages', windowId, messages),
    getMessages: (windowId, options) => ipcRenderer.invoke('chat:get-messages', windowId, options),
    deleteMessage: (messageId) => ipcRenderer.invoke('chat:delete-message', messageId),
    clearMessages: (windowId) => ipcRenderer.invoke('chat:clear-messages', windowId),
    searchMessages: (query, options) => ipcRenderer.invoke('chat:search-messages', query, options),
    replaceWindowMessages: (windowId, messages) => ipcRenderer.invoke('chat:replace-window-messages', windowId, messages),
    migrateFromLocalStorage: (windowsData) => ipcRenderer.invoke('chat:migrate-from-local-storage', windowsData),
    getStats: () => ipcRenderer.invoke('chat:get-stats'),
  },

  // Prompt 模板
  promptTemplate: {
    list: (category) => ipcRenderer.invoke('prompt-template:list', category),
    get: (templateId) => ipcRenderer.invoke('prompt-template:get', templateId),
    create: (template) => ipcRenderer.invoke('prompt-template:create', template),
    update: (templateId, updates) => ipcRenderer.invoke('prompt-template:update', templateId, updates),
    delete: (templateId) => ipcRenderer.invoke('prompt-template:delete', templateId),
    render: (templateId, variables) => ipcRenderer.invoke('prompt-template:render', templateId, variables),
    categories: () => ipcRenderer.invoke('prompt-template:categories'),
    initPresets: () => ipcRenderer.invoke('prompt-template:init-presets'),
  },

  // 技能系统
  skill: {
    loadAll: () => ipcRenderer.invoke('skill:load-all'),
    list: () => ipcRenderer.invoke('skill:list'),
    categories: () => ipcRenderer.invoke('skill:categories'),
    listByCategory: (category) => ipcRenderer.invoke('skill:list-by-category', category),
    get: (skillId) => ipcRenderer.invoke('skill:get', skillId),
    search: (query) => ipcRenderer.invoke('skill:search', query),
    detect: (input) => ipcRenderer.invoke('skill:detect', input),
    getPrompt: (skillId) => ipcRenderer.invoke('skill:get-prompt', skillId),
    create: (params) => ipcRenderer.invoke('skill:create', params),
    update: (skillId, updates) => ipcRenderer.invoke('skill:update', skillId, updates),
    delete: (skillId) => ipcRenderer.invoke('skill:delete', skillId),
    toggle: (skillId) => ipcRenderer.invoke('skill:toggle', skillId),
    incrementUse: (skillId) => ipcRenderer.invoke('skill:increment-use', skillId),
    createCategory: (params) => ipcRenderer.invoke('skill:create-category', params),
    updateCategory: (oldName, updates) => ipcRenderer.invoke('skill:update-category', oldName, updates),
    deleteCategory: (name, moveToCategory) => ipcRenderer.invoke('skill:delete-category', name, moveToCategory),
  },

  // haoone 音视频转录
  haoone: {
    checkEnvironment: () => ipcRenderer.invoke('haoone:check-environment'),
    transcribe: (params) => ipcRenderer.invoke('haoone:transcribe', params),
    batchTranscribe: (params) => ipcRenderer.invoke('haoone:batch-transcribe', params),
    listModels: () => ipcRenderer.invoke('haoone:list-models'),
    getConfig: () => ipcRenderer.invoke('haoone:get-config'),
    createProject: (projectName) => ipcRenderer.invoke('haoone:create-project', projectName),
    deleteProject: (projectName) => ipcRenderer.invoke('haoone:delete-project', projectName),
    formatDraft: (filePath) => ipcRenderer.invoke('haoone:format-draft', filePath),
    getProjectList: () => ipcRenderer.invoke('haoone:get-project-list'),
    getHotwords: () => ipcRenderer.invoke('haoone:get-hotwords'),
  },

  // RAG 知识库
  rag: {
    indexContent: (sourceType, sourceId, content, config, options) => ipcRenderer.invoke('rag:index-content', sourceType, sourceId, content, config, options),
    search: (query, config, options) => ipcRenderer.invoke('rag:search', query, config, options),
    deleteIndex: (sourceType, sourceId) => ipcRenderer.invoke('rag:delete-index', sourceType, sourceId),
    stats: () => ipcRenderer.invoke('rag:stats'),
    logs: (limit) => ipcRenderer.invoke('rag:logs', limit),
    modelInfo: (config) => ipcRenderer.invoke('rag:model-info', config),
    indexAllCreativities: (config, options) => ipcRenderer.invoke('rag:index-all-creativities', config, options),
    indexAllChapters: (config, options) => ipcRenderer.invoke('rag:index-all-chapters', config, options),
    indexAllCards: (config, options) => ipcRenderer.invoke('rag:index-all-cards', config, options),
    rebuildAll: (config, options) => ipcRenderer.invoke('rag:rebuild-all', config, options),
    clearAll: () => ipcRenderer.invoke('rag:clear-all'),
    setConfig: (config) => ipcRenderer.invoke('rag:set-config', config),
  },

  // 工作流
  workflow: {
    initPresets: () => ipcRenderer.invoke('workflow:init-presets'),
    list: () => ipcRenderer.invoke('workflow:list'),
    get: (id) => ipcRenderer.invoke('workflow:get', id),
    create: (workflow) => ipcRenderer.invoke('workflow:create', workflow),
    update: (id, updates) => ipcRenderer.invoke('workflow:update', id, updates),
    delete: (id) => ipcRenderer.invoke('workflow:delete', id),
    recordRun: (id) => ipcRenderer.invoke('workflow:record-run', id),
  },

  // AI 使用统计
  aiStats: {
    record: (data) => ipcRenderer.invoke('ai-stats:record', data),
    get: (period) => ipcRenderer.invoke('ai-stats:get', period),
    topTools: (limit) => ipcRenderer.invoke('ai-stats:top-tools', limit),
    clear: () => ipcRenderer.invoke('ai-stats:clear'),
  },

  // 拖放文件处理（Windows 管理员权限修复）
  dragDrop: {
    // 监听主进程发送的拖放文件
    onFilesDropped: (callback) => {
      const handler = (_event, filePaths) => callback(filePaths);
      ipcRenderer.on('files-dropped', handler);
      return () => ipcRenderer.removeListener('files-dropped', handler);
    },
    // 获取拖放的文件路径
    getDroppedFiles: () => ipcRenderer.invoke('get-dropped-files'),
  },
});
