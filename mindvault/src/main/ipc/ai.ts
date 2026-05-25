// @ts-nocheck
/**
 * AI IPC 处理器
 */
const { ipcMain, BrowserWindow, app } = require('electron');
const path = require('path');
const { chat, chatStream, chatStreamWithTools, stopGeneration, testConnection, listModels, webSearch } = require('../services/ai-service');
const { getToolDefinitions } = require('../services/tool-executor');
const aiUsageStats = require('../services/ai-usage-stats');
const musicLibrary = require('../services/music-library');
const musicOnline = require('../services/music-online');

// 新版查询服务
const { queryStream, getMemoryManager, searchMemories } = require('../services/query-service');

function registerAIHandlers() {
  console.log('[IPC] AI处理器已注册');

  // 非流式对话
  ipcMain.handle('ai:chat', async (_event, messages: AIChatMessage[], config: AIProviderConfig) => {
    try {
      const result = await chat(config, messages);
      return { success: true, content: result };
    } catch (err: any) {
      console.error('[IPC] AI对话失败:', err.message);
      return { success: false, error: err.message };
    }
  });

  // 流式对话
  ipcMain.handle('ai:chat-stream', async (event, messages: AIChatMessage[], config: AIProviderConfig) => {
    const win = BrowserWindow.fromWebContents(event.sender);
    if (!win) return;

    try {
      const fullText = await chatStream(
        config,
        messages,
        (token) => {
          // 通过 IPC 事件推送 token 到渲染进程
          if (!win.isDestroyed()) {
            win.webContents.send('ai:token', token);
          }
        },
      );
      // 流结束
      if (!win.isDestroyed()) {
        win.webContents.send('ai:stream-end', fullText);
      }
      return { success: true };
    } catch (err: any) {
      if (err.name === 'AbortError') {
        if (!win.isDestroyed()) {
          win.webContents.send('ai:stream-end', '');
        }
        return { success: true, aborted: true };
      }
      console.error('[IPC] AI流式对话失败:', err.message);
      if (!win.isDestroyed()) {
        win.webContents.send('ai:stream-error', err.message);
      }
      return { success: false, error: err.message };
    }
  });

  // 中止生成
  ipcMain.handle('ai:stop-generation', async () => {
    stopGeneration();
    return { success: true };
  });

  // 测试连接
  ipcMain.handle('ai:test-connection', async (_event, config: AIProviderConfig) => {
    return testConnection(config);
  });

  // 获取模型列表
  ipcMain.handle('ai:list-models', async (_event, config: AIProviderConfig) => {
    try {
      const models = await listModels(config);
      return { success: true, models };
    } catch (err: any) {
      console.error('[IPC] 获取模型列表失败:', err.message);
      return { success: false, error: err.message, models: [] };
    }
  });

  // 联网搜索
  ipcMain.handle('ai:web-search', async (_event, query: string) => {
    try {
      const results = await webSearch(query);
      return { success: true, results };
    } catch (err: any) {
      console.error('[IPC] 联网搜索失败:', err.message);
      return { success: false, error: err.message };
    }
  });

  // 获取今日实时用量统计
  ipcMain.handle('ai:realtime-stats', async () => {
    try {
      const data = aiUsageStats.getRealtimeStats();
      return { success: true, data };
    } catch (err: any) {
      return { success: false, error: err.message };
    }
  });

  // ========== Tool Calling IPC ==========

  // Tool Calling 流式对话
  ipcMain.handle('ai:chat-stream-with-tools', async (event, messages: AIChatMessage[], config: AIProviderConfig) => {
    const win = BrowserWindow.fromWebContents(event.sender);
    if (!win) return;

    try {
      const result = await chatStreamWithTools(
        config,
        messages,
        (token) => {
          // 通过 IPC 事件推送 token 到渲染进程
          if (!win.isDestroyed()) {
            win.webContents.send('ai:token', token);
          }
        },
        undefined,
        (toolName, args, result) => {
          // 通知前端工具调用状态
          if (!win.isDestroyed()) {
            win.webContents.send('ai:tool-call', { toolName, args, result });
          }
        },
      );
      // 流结束，发送包含 toolCalls 的事件
      if (!win.isDestroyed()) {
        win.webContents.send('ai:stream-end-with-tools', { text: result.text, toolCalls: result.toolCalls });
      }
      return { success: true };
    } catch (err: any) {
      if (err.name === 'AbortError') {
        if (!win.isDestroyed()) {
          win.webContents.send('ai:stream-end-with-tools', { text: '', toolCalls: [] });
        }
        return { success: true, aborted: true };
      }
      console.error('[IPC] AI Tool Calling 流式对话失败:', err.message);
      if (!win.isDestroyed()) {
        win.webContents.send('ai:stream-error', err.message);
      }
      return { success: false, error: err.message };
    }
  });

  // 获取工具定义列表
  ipcMain.handle('ai:get-tool-definitions', async () => {
    try {
      const tools = getToolDefinitions();
      return { success: true, tools };
    } catch (err: any) {
      console.error('[IPC] 获取工具定义失败:', err.message);
      return { success: false, error: err.message, tools: [] };
    }
  });

  // ========== AI 音乐工具 IPC ==========

  /**
   * AI 音乐搜索 - 搜索本地+在线歌曲
   * 参数：{ keyword: string, source?: 'local'|'online'|'all' }
   * 返回：{ success: boolean, localResults?: any[], onlineResults?: any[], error?: string }
   */
  ipcMain.handle('ai:music-search', async (_event, params: { keyword: string; source?: 'local' | 'online' | 'all' }) => {
    try {
      const { keyword, source = 'all' } = params;
      if (!keyword || !keyword.trim()) {
        return { success: false, error: '搜索关键词不能为空' };
      }

      const result: { localResults: any[]; onlineResults: any[] } = {
        localResults: [],
        onlineResults: [],
      };

      // 本地搜索
      if (source === 'local' || source === 'all') {
        try {
          const localTracks = musicLibrary.searchTracks(keyword);
          result.localResults = localTracks.map((t: any) => ({
            id: t.id,
            title: t.title,
            artist: t.artist,
            album: t.album || '',
            duration: t.duration || 0,
            source: 'local',
          }));
        } catch (err: any) {
          console.warn('[IPC] AI音乐搜索-本地搜索失败:', err.message);
        }
      }

      // 在线搜索
      if (source === 'online' || source === 'all') {
        try {
          const onlineResult = await musicOnline.searchSongs(keyword, 1, 10);
          result.onlineResults = (onlineResult.songs || []).map((s: any) => ({
            id: s.id || s.songid,
            title: s.name,
            artist: s.singer,
            album: s.album || '',
            duration: s.duration || 0,
            coverUrl: s.coverUrl || '',
            source: 'online',
          }));
        } catch (err: any) {
          console.warn('[IPC] AI音乐搜索-在线搜索失败:', err.message);
        }
      }

      return { success: true, ...result };
    } catch (err: any) {
      console.error('[IPC] AI音乐搜索失败:', err.message);
      return { success: false, error: err.message };
    }
  });

  /**
   * AI 情绪分类 - 使用 AI 为本地歌曲分类情绪标签
   * 参数：{ trackIds?: string[], config?: AIProviderConfig }
   * 返回：{ success: boolean, classifications?: any[], error?: string }
   */
  ipcMain.handle('ai:music-classify-emotion', async (_event, params: { trackIds?: string[]; config?: AIProviderConfig }) => {
    try {
      const { trackIds, config } = params;

      // 获取需要分类的曲目列表
      let tracks: any[] = [];
      if (trackIds && trackIds.length > 0) {
        // 按指定 ID 获取
        tracks = trackIds.map((id) => musicLibrary.getTrack(id)).filter(Boolean);
      } else {
        // 获取所有本地曲目
        tracks = musicLibrary.getAllTracks();
      }

      if (tracks.length === 0) {
        return { success: false, error: '本地音乐库为空，没有可分类的歌曲' };
      }

      // 限制最多分类 100 首，避免 token 超限
      const limitedTracks = tracks.slice(0, 100);

      // 构建曲目列表文本
      const trackListText = limitedTracks
        .map((t, i) => `${i + 1}. 《${t.title}》 - ${t.artist}${t.album ? ` (${t.album})` : ''}`)
        .join('\n');

      // 构建情绪分类提示词
      const classifyPrompt = `请为以下歌曲进行情绪分类。为每首歌分配 1-3 个情绪标签。

歌曲列表：
${trackListText}

请按以下 JSON 数组格式返回结果（不要包含其他文字）：
[
  {"index": 1, "title": "歌曲名", "emotions": ["情绪1", "情绪2"], "mood": "整体氛围描述（一句话）"},
  ...
]

可选的情绪标签参考：欢快、悲伤、激昂、温柔、忧郁、浪漫、热血、治愈、放松、怀旧、孤独、甜蜜、励志、暗黑、宁静、活力、思念、自由、神秘、温暖`;

      // 调用 AI 服务进行分类
      if (!config || !config.apiKey) {
        return { success: false, error: '未配置 AI 服务，无法进行情绪分类' };
      }

      const messages: AIChatMessage[] = [
        { role: 'system', content: '你是一个音乐情绪分析专家，擅长根据歌曲名和艺术家分析歌曲的情绪氛围。请严格按要求的 JSON 格式返回结果。' },
        { role: 'user', content: classifyPrompt },
      ];

      const result = await chat(config, messages);

      // 尝试解析 AI 返回的 JSON
      try {
        // 提取 JSON 数组部分（AI 可能在 JSON 前后添加了说明文字）
        const jsonMatch = result.match(/\[[\s\S]*\]/);
        if (jsonMatch) {
          const classifications = JSON.parse(jsonMatch[0]);
          return { success: true, classifications, total: limitedTracks.length, classified: classifications.length };
        }
        return { success: true, classifications: [], rawResult: result, total: limitedTracks.length, classified: 0 };
      } catch (parseErr: any) {
        console.warn('[IPC] AI情绪分类结果解析失败:', parseErr.message);
        return { success: true, classifications: [], rawResult: result, total: limitedTracks.length, classified: 0, parseError: parseErr.message };
      }
    } catch (err: any) {
      console.error('[IPC] AI情绪分类失败:', err.message);
      return { success: false, error: err.message };
    }
  });

  /**
   * AI 获取统计数据摘要 - 供 AI 参考的听歌统计
   * 返回：{ success: boolean, summary?: string, error?: string }
   */
  ipcMain.handle('ai:music-get-stats-summary', async () => {
    try {
      // 获取播放统计
      const stats = musicLibrary.getPlayStats({ period: 'all' });

      // 获取本地曲目总数
      const allTracks = musicLibrary.getAllTracks();
      const totalTracks = allTracks.length;

      // 构建格式化的统计摘要文本
      const summaryParts: string[] = [];

      summaryParts.push(`【音乐库概览】`);
      summaryParts.push(`本地歌曲总数：${totalTracks} 首`);

      if (stats && stats.totalPlays > 0) {
        summaryParts.push(`累计播放次数：${stats.totalPlays} 次`);
        summaryParts.push(`累计播放时长：${formatDuration(stats.totalDuration)}`);

        // 最常播放的歌曲
        if (stats.topTracks && stats.topTracks.length > 0) {
          summaryParts.push(`\n【最常播放 TOP 5】`);
          stats.topTracks.slice(0, 5).forEach((item: any, i: number) => {
            summaryParts.push(`${i + 1}. 《${item.title}》 - ${item.artist}（播放 ${item.playCount} 次，${formatDuration(item.totalDuration)}）`);
          });
        }

        // 最常播放的艺术家
        if (stats.topArtists && stats.topArtists.length > 0) {
          summaryParts.push(`\n【最常听的艺术家 TOP 5】`);
          stats.topArtists.slice(0, 5).forEach((item: any, i: number) => {
            summaryParts.push(`${i + 1}. ${item.artist}（${item.playCount} 次）`);
          });
        }

        // 播放时段分布
        if (stats.hourlyDistribution) {
          const peakHours = Object.entries(stats.hourlyDistribution)
            .sort(([, a]: any, [, b]: any) => b - a)
            .slice(0, 3)
            .map(([hour]: any) => `${hour}:00`);
          if (peakHours.length > 0) {
            summaryParts.push(`\n最常听歌时段：${peakHours.join('、')}`);
          }
        }
      } else {
        summaryParts.push(`暂无播放记录`);
      }

      // 本地曲目列表摘要（最多50首）
      if (allTracks.length > 0) {
        summaryParts.push(`\n【本地歌曲列表】`);
        const displayTracks = allTracks.slice(0, 50);
        displayTracks.forEach((t: any, i: number) => {
          summaryParts.push(`${i + 1}. 《${t.title}》 - ${t.artist}${t.album ? ` (${t.album})` : ''}`);
        });
        if (allTracks.length > 50) {
          summaryParts.push(`... 还有 ${allTracks.length - 50} 首歌曲未列出`);
        }
      }

      return { success: true, summary: summaryParts.join('\n'), totalTracks, stats };
    } catch (err: any) {
      console.error('[IPC] 获取音乐统计摘要失败:', err.message);
      return { success: false, error: err.message, summary: '获取音乐统计数据失败' };
    }
  });

  // ========== 代码执行与文件操作 IPC ==========

  // 代码执行
  ipcMain.handle('ai:execute-code', async (_event, params) => {
    try {
      const { code, language } = params;
      const codeExecutor = require('../services/code-executor');
      const result = await codeExecutor.executeCode(code, language || 'javascript');
      return result;
    } catch (err: any) {
      return { success: false, error: err.message };
    }
  });

  // 文件操作
  ipcMain.handle('ai:file-read', async (_event, filePath) => {
    try {
      if (!filePath || typeof filePath !== 'string') {
        return { success: false, error: 'Invalid file path' };
      }
      const resolvedPath = path.resolve(filePath);
      const allowedDirs = [app.getPath('userData'), app.getPath('documents'), app.getPath('home')];
      const isAllowed = allowedDirs.some(dir => resolvedPath.startsWith(dir));
      if (!isAllowed) {
        return { success: false, error: 'Access denied: path not in allowed directories' };
      }
      const fileOps = require('../services/file-operations');
      return fileOps.readFile(filePath);
    } catch (err: any) {
      return { success: false, error: err.message };
    }
  });

  ipcMain.handle('ai:file-list', async (_event, dirPath) => {
    try {
      if (!dirPath || typeof dirPath !== 'string') {
        return { success: false, error: 'Invalid directory path' };
      }
      const resolvedPath = path.resolve(dirPath);
      const allowedDirs = [app.getPath('userData'), app.getPath('documents'), app.getPath('home')];
      const isAllowed = allowedDirs.some(dir => resolvedPath.startsWith(dir));
      if (!isAllowed) {
        return { success: false, error: 'Access denied: path not in allowed directories' };
      }
      const fileOps = require('../services/file-operations');
      return fileOps.listDirectory(dirPath);
    } catch (err: any) {
      return { success: false, error: err.message };
    }
  });

  // ========== MCP IPC ==========

  // 获取 MCP 服务器状态列表
  ipcMain.handle('mcp:get-status', async () => {
    try {
      const mcpBridge = require('../services/mcp-bridge').mcpBridge;
      const statuses = mcpBridge.getServerStatuses();
      return { success: true, servers: statuses };
    } catch (err: any) {
      return { success: false, error: err.message, servers: [] };
    }
  });

  // 连接 MCP 服务器
  ipcMain.handle('mcp:connect-server', async (_event, config: any) => {
    try {
      const mcpBridge = require('../services/mcp-bridge').mcpBridge;
      await mcpBridge.connectServer(config);
      return { success: true };
    } catch (err: any) {
      console.error('[IPC] MCP 连接服务器失败:', err.message);
      return { success: false, error: err.message };
    }
  });

  // 断开 MCP 服务器
  ipcMain.handle('mcp:disconnect-server', async (_event, serverId: string) => {
    try {
      const mcpBridge = require('../services/mcp-bridge').mcpBridge;
      await mcpBridge.disconnectServer(serverId);
      return { success: true };
    } catch (err: any) {
      return { success: false, error: err.message };
    }
  });

  // 获取 MCP 工具列表
  ipcMain.handle('mcp:list-tools', async () => {
    try {
      const mcpBridge = require('../services/mcp-bridge').mcpBridge;
      const tools = mcpBridge.getMCPToolDefinitions();
      return { success: true, tools };
    } catch (err: any) {
      return { success: false, error: err.message, tools: [] };
    }
  });

  // 调用 MCP 工具
  ipcMain.handle('mcp:call-tool', async (_event, toolName: string, args: any) => {
    try {
      const mcpBridge = require('../services/mcp-bridge').mcpBridge;
      const result = await mcpBridge.executeMCPTool(toolName, args);
      return { success: true, result };
    } catch (err: any) {
      return { success: false, error: err.message };
    }
  });

  // ========== Agent IPC ==========

  // 执行 Agent 任务（v2：思考过程 + 阶段化执行）
  ipcMain.handle('agent:execute-task', async (event, instruction: string, config: AIProviderConfig) => {
    const win = BrowserWindow.fromWebContents(event.sender);
    if (!win) return { success: false, error: 'Window not found' };

    try {
      const agentExecutor = require('../services/agent-executor');
      const result = await agentExecutor.executeAgentTask(instruction, config, {
        // 思考过程
        onThinkingToken: (token: string) => {
          if (!win.isDestroyed()) win.webContents.send('agent:thinking-token', token);
        },
        onThinkingEnd: (fullThinking: string) => {
          if (!win.isDestroyed()) win.webContents.send('agent:thinking-end', fullThinking);
        },
        // 规划完成
        onPlanReady: (plan: any) => {
          if (!win.isDestroyed()) win.webContents.send('agent:plan-ready', plan);
        },
        // 状态变化
        onStatusChange: (status: string) => {
          if (!win.isDestroyed()) win.webContents.send('agent:status-change', status);
        },
        // 阶段
        onPhaseStart: (phase: any, index: number) => {
          if (!win.isDestroyed()) win.webContents.send('agent:phase-start', { phase, index });
        },
        onPhaseComplete: (phase: any, index: number) => {
          if (!win.isDestroyed()) win.webContents.send('agent:phase-complete', { phase, index });
        },
        // 步骤
        onStepStart: (step: any) => {
          if (!win.isDestroyed()) win.webContents.send('agent:step-start', step);
        },
        onStepComplete: (step: any) => {
          if (!win.isDestroyed()) win.webContents.send('agent:step-complete', step);
        },
        onStepError: (step: any, error: string) => {
          if (!win.isDestroyed()) win.webContents.send('agent:step-error', { step, error });
        },
        onStepThinking: (stepId: string, token: string) => {
          if (!win.isDestroyed()) win.webContents.send('agent:step-thinking', { stepId, token });
        },
        // 任务完成
        onTaskComplete: (result: any) => {
          if (!win.isDestroyed()) win.webContents.send('agent:task-complete', result);
        },
        onTaskError: (task: any, error: string) => {
          if (!win.isDestroyed()) win.webContents.send('agent:task-error', { task, error });
        },
      });
      return { success: true, result };
    } catch (err: any) {
      console.error('[IPC] Agent 任务执行失败:', err.message);
      return { success: false, error: err.message };
    }
  });

  // 取消 Agent 任务
  ipcMain.handle('agent:cancel-task', async () => {
    try {
      const agentExecutor = require('../services/agent-executor');
      agentExecutor.cancelCurrentTask();
      return { success: true };
    } catch (err: any) {
      return { success: false, error: err.message };
    }
  });

  // 获取预设工作流列表
  ipcMain.handle('agent:list-workflows', async () => {
    try {
      const workflows = require('../services/agent-workflows').getWorkflows();
      return { success: true, workflows };
    } catch (err: any) {
      return { success: false, error: err.message, workflows: [] };
    }
  });

  // ========== UI Context IPC ==========

  // 获取当前 UI 上下文
  ipcMain.handle('ui:context-get', async () => {
    try {
      const uiContext = require('../services/ui-context');
      return { success: true, context: uiContext.getCurrentContext() };
    } catch (err: any) {
      return { success: false, error: err.message };
    }
  });
}

/**
 * 格式化时长（秒 -> 可读字符串）
 */
function formatDuration(seconds: number): string {
  if (!seconds || seconds <= 0) return '0分钟';
  const hours = Math.floor(seconds / 3600);
  const minutes = Math.floor((seconds % 3600) / 60);
  if (hours > 0) {
    return `${hours}小时${minutes}分钟`;
  }
  return `${minutes}分钟`;
}

// ========== 新版 Query Engine IPC ==========

/**
 * 流式查询（基于 QueryEngine）
 * 支持 AsyncGenerator 流式输出、工具调用、上下文压缩、权限控制
 */
ipcMain.handle('ai:query-stream', async (event, messages: any[], config: AIProviderConfig, options?: any) => {
  const win = BrowserWindow.fromWebContents(event.sender);
  if (!win) return { success: false, error: '窗口不存在' };

  try {
    const generator = queryStream({
      config,
      messages,
      systemPrompt: options?.systemPrompt,
      permissionMode: options?.permissionMode || 'default',
      maxTurns: options?.maxTurns || 10,
    });

    for await (const chunk of generator) {
      if (win.isDestroyed()) break;

      if (typeof chunk === 'string') {
        // 文本 token
        win.webContents.send('ai:token', chunk);
      } else if (chunk.type === 'tool_call') {
        // 工具调用
        win.webContents.send('ai:tool-call', {
          name: chunk.name,
          args: chunk.args,
          result: chunk.result,
        });
      } else if (chunk.type === 'usage') {
        // 使用量
        win.webContents.send('ai:usage', {
          inputTokens: chunk.input,
          outputTokens: chunk.output,
        });
      }
    }

    if (!win.isDestroyed()) {
      win.webContents.send('ai:stream-end', '');
    }
    return { success: true };
  } catch (err: any) {
    console.error('[IPC] AI查询失败:', err.message);
    if (!win.isDestroyed()) {
      win.webContents.send('ai:stream-error', err.message);
    }
    return { success: false, error: err.message };
  }
});

/**
 * 搜索记忆
 */
ipcMain.handle('ai:search-memories', async (_event, query: string) => {
  try {
    const results = await searchMemories(query);
    return { success: true, results };
  } catch (err: any) {
    return { success: false, error: err.message };
  }
});

/**
 * 获取记忆管理器
 */
ipcMain.handle('ai:get-memories', async () => {
  try {
    const manager = getMemoryManager();
    const memories = manager.getAllMemories();
    return { success: true, memories };
  } catch (err: any) {
    return { success: false, error: err.message };
  }
});

/**
 * 添加记忆
 */
ipcMain.handle('ai:add-memory', async (_event, memory: any) => {
  try {
    const manager = getMemoryManager();
    const newMemory = manager.addMemory(memory);
    return { success: true, memory: newMemory };
  } catch (err: any) {
    return { success: false, error: err.message };
  }
});

/**
 * 删除记忆
 */
ipcMain.handle('ai:delete-memory', async (_event, id: string) => {
  try {
    const manager = getMemoryManager();
    const success = manager.deleteMemory(id);
    return { success };
  } catch (err: any) {
    return { success: false, error: err.message };
  }
});

module.exports = { registerAIHandlers };
