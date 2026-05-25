// @ts-nocheck
/**
 * MCP Bridge
 * 将 MCP 工具转换为 OpenAI function calling 格式，并路由工具执行
 * 作为 MCPClientManager 和 AI 服务层之间的桥接层
 *
 * 使用单例模式，延迟初始化 MCPClientManager
 */

const { mcpClientManager } = require('./mcp-client');

// ============================================================
// MCPBridge 单例
// ============================================================

class MCPBridge {
  constructor() {
    /** @type {boolean} 是否已初始化 */
    this._initialized = false;

    /** @type {Map<string, string>} 工具名 -> 服务器 ID 的映射缓存 */
    this._toolServerMap = new Map();

    /** @type {MCPToolDefinition[]} 缓存的工具定义列表 */
    this._cachedTools = [];

    // 监听 MCP 连接状态变化，更新缓存
    mcpClientManager.on('connection', () => {
      this._invalidateCache();
    });
  }

  // ----------------------------------------------------------
  // 初始化
  // ----------------------------------------------------------

  /**
   * 初始化 MCP Bridge
   * 连接所有已配置的 MCP Server
   * @param {import('./mcp-client').MCPServerConfig[]} configs - MCP Server 配置数组
   * @returns {Promise<void>}
   */
  async initialize(configs) {
    if (this._initialized) {
      console.warn('[MCPBridge] 已经初始化，跳过重复初始化');
      return;
    }

    if (!configs || !Array.isArray(configs) || configs.length === 0) {
      console.log('[MCPBridge] 未配置 MCP Server，跳过初始化');
      this._initialized = true;
      return;
    }

    console.log(`[MCPBridge] 初始化，共 ${configs.length} 个 MCP Server 配置`);

    // 只连接已启用的服务器
    const enabledConfigs = configs.filter((c) => c.enabled);

    if (enabledConfigs.length === 0) {
      console.log('[MCPBridge] 没有已启用的 MCP Server');
      this._initialized = true;
      return;
    }

    // 并行连接所有已启用的服务器
    const connectPromises = enabledConfigs.map((config) => {
      return mcpClientManager
        .connectServer(config)
        .catch((err) => {
          console.error(
            `[MCPBridge] 连接 ${config.name} 失败:`,
            err.message
          );
          // 不抛出异常，允许其他服务器继续连接
        });
    });

    await Promise.allSettled(connectPromises);

    // 构建初始缓存
    this._rebuildCache();

    this._initialized = true;
    console.log(
      `[MCPBridge] 初始化完成，共发现 ${this._cachedTools.length} 个 MCP 工具`
    );
  }

  /**
   * 销毁 MCP Bridge
   * 断开所有 MCP Server 连接
   * @returns {Promise<void>}
   */
  async destroy() {
    await mcpClientManager.disconnectAll();
    this._toolServerMap.clear();
    this._cachedTools = [];
    this._initialized = false;
    console.log('[MCPBridge] 已销毁');
  }

  // ----------------------------------------------------------
  // 工具定义
  // ----------------------------------------------------------

  /**
   * 获取所有 MCP 工具定义（OpenAI function calling 格式）
   * @returns {MCPToolDefinition[]} 工具定义数组
   */
  getMCPToolDefinitions() {
    if (!this._initialized) {
      return [];
    }

    // 如果缓存为空，尝试重建
    if (this._cachedTools.length === 0) {
      this._rebuildCache();
    }

    return [...this._cachedTools];
  }

  // ----------------------------------------------------------
  // 工具执行
  // ----------------------------------------------------------

  /**
   * 执行 MCP 工具
   * 根据工具名称自动查找所属的 MCP Server 并执行
   * @param {string} toolName - 工具名称
   * @param {any} args - 工具参数
   * @param {number} [timeout] - 超时时间（毫秒），默认 30000
   * @returns {Promise<string>} 工具执行结果文本
   */
  async executeMCPTool(toolName, args, timeout) {
    if (!this._initialized) {
      return JSON.stringify({
        error: 'MCP Bridge 未初始化',
      });
    }

    // 查找工具所属的服务器
    const serverId = this._findServerForTool(toolName);

    if (!serverId) {
      return JSON.stringify({
        error: `未找到 MCP 工具: ${toolName}`,
      });
    }

    // 通过 MCPClientManager 调用工具
    return mcpClientManager.callTool(serverId, toolName, args, timeout);
  }

  // ----------------------------------------------------------
  // 工具查询
  // ----------------------------------------------------------

  /**
   * 检查工具名称是否属于某个 MCP Server
   * @param {string} toolName - 工具名称
   * @returns {boolean}
   */
  isMCPTool(toolName) {
    if (!this._initialized) {
      return false;
    }

    // 优先从缓存查找
    if (this._toolServerMap.has(toolName)) {
      return true;
    }

    // 缓存未命中时，从 MCPClientManager 实时查找
    const serverId = mcpClientManager.findServerByTool(toolName);
    if (serverId) {
      this._toolServerMap.set(toolName, serverId);
      return true;
    }

    return false;
  }

  /**
   * 获取所有 MCP Server 的状态
   * @returns {import('./mcp-client').MCPServerStatus[]}
   */
  getServerStatuses() {
    return mcpClientManager.getServerStatuses();
  }

  /**
   * 动态连接一个新的 MCP Server
   * @param {import('./mcp-client').MCPServerConfig} config - 服务器配置
   * @returns {Promise<void>}
   */
  async connectServer(config) {
    await mcpClientManager.connectServer(config);
    this._invalidateCache();
  }

  /**
   * 断开指定的 MCP Server
   * @param {string} serverId - 服务器 ID
   * @returns {Promise<void>}
   */
  async disconnectServer(serverId) {
    await mcpClientManager.disconnectServer(serverId);
    this._invalidateCache();
  }

  // ----------------------------------------------------------
  // 内部方法
  // ----------------------------------------------------------

  /**
   * 查找工具所属的服务器
   * @param {string} toolName - 工具名称
   * @returns {string|null} 服务器 ID
   * @private
   */
  _findServerForTool(toolName) {
    // 优先从缓存查找
    if (this._toolServerMap.has(toolName)) {
      const cachedServerId = this._toolServerMap.get(toolName);
      // 验证服务器是否仍然连接
      if (mcpClientManager.isConnected(cachedServerId)) {
        return cachedServerId;
      }
      // 服务器已断开，移除缓存
      this._toolServerMap.delete(toolName);
    }

    // 从 MCPClientManager 实时查找
    const serverId = mcpClientManager.findServerByTool(toolName);
    if (serverId) {
      this._toolServerMap.set(toolName, serverId);
    }

    return serverId;
  }

  /**
   * 重建工具缓存
   * @private
   */
  _rebuildCache() {
    this._cachedTools = mcpClientManager.getAllTools();
    this._toolServerMap.clear();

    // 重建工具 -> 服务器的映射
    const statuses = mcpClientManager.getServerStatuses();
    for (const status of statuses) {
      if (status.status === 'connected') {
        for (const tool of status.tools) {
          this._toolServerMap.set(tool.function.name, status.id);
        }
      }
    }
  }

  /**
   * 使缓存失效
   * 延迟重建以避免频繁更新
   * @private
   */
  _invalidateCache() {
    // 使用 setImmediate 在当前事件循环结束后重建缓存
    // 避免在连接事件处理过程中频繁重建
    if (this._cacheInvalidationTimer) {
      clearTimeout(this._cacheInvalidationTimer);
    }

    this._cacheInvalidationTimer = setTimeout(() => {
      this._cacheInvalidationTimer = null;
      this._rebuildCache();
    }, 500);
  }
}

// ============================================================
// 导出单例
// ============================================================

const mcpBridge = new MCPBridge();

module.exports = {
  MCPBridge,
  mcpBridge,
};
