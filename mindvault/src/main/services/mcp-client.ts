// @ts-nocheck
/**
 * MCP Client Manager
 * 管理多个 MCP Server 的连接、工具发现和工具调用
 * 运行在 Electron 主进程中
 */

const { Client } = require('@modelcontextprotocol/sdk/client/index.js');
const { StdioClientTransport } = require('@modelcontextprotocol/sdk/client/stdio.js');
const { StreamableHTTPClientTransport } = require('@modelcontextprotocol/sdk/client/streamableHttp.js');
const { EventEmitter } = require('events');

// ============================================================
// 常量配置
// ============================================================

/** 工具调用默认超时时间（毫秒） */
const DEFAULT_TOOL_CALL_TIMEOUT = 30000;

/** 自动重连基础延迟（毫秒） */
const RECONNECT_BASE_DELAY = 1000;

/** 自动重连最大延迟（毫秒） */
const RECONNECT_MAX_DELAY = 30000;

/** 自动重连最大次数 */
const RECONNECT_MAX_ATTEMPTS = 5;

// ============================================================
// 内部类型（避免跨 rootDir 引用 shared/types）
// ============================================================

/**
 * @typedef {Object} MCPServerConfig
 * @property {string} id
 * @property {string} name
 * @property {string} [command]
 * @property {string[]} [args]
 * @property {Record<string,string>} [env]
 * @property {boolean} enabled
 * @property {'stdio'|'streamableHttp'} [transport]
 * @property {string} [url]
 * @property {Record<string,string>} [headers]
 */

/**
 * @typedef {Object} MCPToolDefinition
 * @property {'function'} type
 * @property {{ name: string, description: string, parameters: { type: 'object', properties: Record<string,any>, required?: string[] }}} function
 */

/**
 * @typedef {Object} MCPServerStatus
 * @property {string} id
 * @property {string} name
 * @property {'connected'|'disconnected'|'error'} status
 * @property {number} toolCount
 * @property {MCPToolDefinition[]} tools
 * @property {string} [error]
 * @property {number} [lastConnected]
 */

/**
 * @typedef {Object} MCPConnectionEvent
 * @property {string} serverId
 * @property {'connected'|'disconnected'|'error'} status
 * @property {string} [error]
 */

// ============================================================
// 单个 MCP Server 连接的内部表示
// ============================================================

/**
 * @typedef {Object} ServerConnection
 * @property {MCPServerConfig} config
 * @property {import('@modelcontextprotocol/sdk/client/index.js').Client} client
 * @property {StdioClientTransport|StreamableHTTPClientTransport} transport
 * @property {MCPToolDefinition[]} tools
 * @property {'connected'|'disconnected'|'error'} status
 * @property {string} [error]
 * @property {number} [lastConnected]
 * @property {number} reconnectAttempts
 * @property {NodeJS.Timeout|null} reconnectTimer
 * @property {NodeJS.Timeout|null} connectTimeout
 * @property {'stdio'|'streamableHttp'} transportType
 */

// ============================================================
// MCPClientManager
// ============================================================

class MCPClientManager extends EventEmitter {
  constructor() {
    super();
    /** @type {Map<string, ServerConnection>} */
    this.connections = new Map();
  }

  // ----------------------------------------------------------
  // 连接管理
  // ----------------------------------------------------------

  /**
   * 连接到一个 MCP Server
   * 根据 config.transport 选择 stdio 或 streamableHttp 传输方式
   * @param {MCPServerConfig} config - MCP Server 配置
   * @returns {Promise<void>}
   */
  async connectServer(config) {
    // 如果已有连接，先断开
    if (this.connections.has(config.id)) {
      await this.disconnectServer(config.id);
    }

    const client = new Client(
      { name: 'mindvault', version: '1.0.0' },
      { capabilities: {} }
    );

    const transportType = config.transport || 'stdio';

    /** @type {StdioClientTransport|StreamableHTTPClientTransport} */
    let transport;

    if (transportType === 'streamableHttp') {
      if (!config.url) {
        throw new Error(`streamableHttp 传输需要配置 url 字段 (服务器: ${config.name})`);
      }
      transport = new StreamableHTTPClientTransport(new URL(config.url), {
        requestInit: {
          headers: config.headers || {},
        },
      });
    } else {
      // 默认使用 stdio 传输
      const env = {
        ...(process.env),
        ...(config.env || {}),
      };
      transport = new StdioClientTransport({
        command: config.command,
        args: config.args,
        env,
      });
    }

    /** @type {ServerConnection} */
    const connection = {
      config,
      client,
      transport,
      tools: [],
      status: 'disconnected',
      error: undefined,
      lastConnected: undefined,
      reconnectAttempts: 0,
      reconnectTimer: null,
      connectTimeout: null,
      transportType,
    };

    this.connections.set(config.id, connection);

    try {
      // 连接 transport
      await transport.start();

      // 连接 client
      await client.connect(transport);

      connection.status = 'connected';
      connection.lastConnected = Date.now();
      connection.reconnectAttempts = 0;

      // 获取工具列表
      try {
        const toolsResult = await client.listTools();
        connection.tools = (toolsResult.tools || []).map((tool) =>
          this._convertToolToOpenAIFormat(tool)
        );
      } catch (toolErr) {
        console.warn(
          `[MCPClient] 获取 ${config.name} 工具列表失败:`,
          toolErr.message
        );
        connection.tools = [];
      }

      // 监听连接关闭事件，触发自动重连
      transport.onclose = () => {
        if (connection.status === 'connected') {
          console.warn(`[MCPClient] ${config.name} 连接已关闭`);
          connection.status = 'disconnected';
          this.emit('connection', {
            serverId: config.id,
            status: 'disconnected',
          });
          this._attemptReconnect(config.id);
        }
      };

      transport.onerror = (err) => {
        console.error(`[MCPClient] ${config.name} transport 错误:`, err.message);
        connection.status = 'error';
        connection.error = err.message;
        this.emit('connection', {
          serverId: config.id,
          status: 'error',
          error: err.message,
        });
      };

      console.log(
        `[MCPClient] 已连接到 ${config.name}，发现 ${connection.tools.length} 个工具`
      );

      this.emit('connection', {
        serverId: config.id,
        status: 'connected',
      });
    } catch (err) {
      connection.status = 'error';
      connection.error = err.message;
      console.error(`[MCPClient] 连接 ${config.name} 失败:`, err.message);

      this.emit('connection', {
        serverId: config.id,
        status: 'error',
        error: err.message,
      });

      // 尝试自动重连
      this._attemptReconnect(config.id);
    }
  }

  /**
   * 断开与 MCP Server 的连接
   * @param {string} serverId - 服务器 ID
   * @returns {Promise<void>}
   */
  async disconnectServer(serverId) {
    const connection = this.connections.get(serverId);
    if (!connection) {
      return;
    }

    // 清除重连定时器
    if (connection.reconnectTimer) {
      clearTimeout(connection.reconnectTimer);
      connection.reconnectTimer = null;
    }

    // 清除连接超时定时器
    if (connection.connectTimeout) {
      clearTimeout(connection.connectTimeout);
      connection.connectTimeout = null;
    }

    try {
      await connection.client.close();
    } catch (err) {
      console.warn(
        `[MCPClient] 关闭 ${connection.config.name} 客户端时出错:`,
        err.message
      );
    }

    try {
      await connection.transport.close();
    } catch (err) {
      console.warn(
        `[MCPClient] 关闭 ${connection.config.name} transport 时出错:`,
        err.message
      );
    }

    const previousStatus = connection.status;
    connection.status = 'disconnected';
    connection.tools = [];
    connection.error = undefined;

    this.connections.delete(serverId);

    if (previousStatus === 'connected') {
      this.emit('connection', {
        serverId,
        status: 'disconnected',
      });
    }

    console.log(`[MCPClient] 已断开与 ${connection.config.name} 的连接`);
  }

  /**
   * 断开所有 MCP Server 连接
   * @returns {Promise<void>}
   */
  async disconnectAll() {
    const serverIds = Array.from(this.connections.keys());
    await Promise.allSettled(
      serverIds.map((id) => this.disconnectServer(id))
    );
  }

  // ----------------------------------------------------------
  // 工具管理
  // ----------------------------------------------------------

  /**
   * 获取指定服务器的工具列表
   * @param {string} serverId - 服务器 ID
   * @returns {MCPToolDefinition[]} 工具定义数组
   */
  listTools(serverId) {
    const connection = this.connections.get(serverId);
    if (!connection || connection.status !== 'connected') {
      return [];
    }
    return [...connection.tools];
  }

  /**
   * 获取所有已连接服务器的全部工具
   * @returns {MCPToolDefinition[]} 所有工具定义数组
   */
  getAllTools() {
    const allTools = [];
    for (const connection of this.connections.values()) {
      if (connection.status === 'connected') {
        allTools.push(...connection.tools);
      }
    }
    return allTools;
  }

  /**
   * 调用指定服务器上的工具
   * @param {string} serverId - 服务器 ID
   * @param {string} toolName - 工具名称
   * @param {any} args - 工具参数
   * @param {number} [timeout] - 超时时间（毫秒），默认 30000
   * @returns {Promise<string>} 工具执行结果文本
   */
  async callTool(serverId, toolName, args, timeout = DEFAULT_TOOL_CALL_TIMEOUT) {
    const connection = this.connections.get(serverId);
    if (!connection) {
      return JSON.stringify({ error: `未找到服务器: ${serverId}` });
    }

    if (connection.status !== 'connected') {
      return JSON.stringify({
        error: `服务器 ${connection.config.name} 未连接 (状态: ${connection.status})`,
      });
    }

    try {
      // 使用 Promise.race 实现超时控制
      const result = await Promise.race([
        connection.client.callTool({ name: toolName, arguments: args || {} }),
        new Promise((_, reject) =>
          setTimeout(
            () => reject(new Error(`工具调用超时 (${timeout}ms)`)),
            timeout
          )
        ),
      ]);

      // 将 MCPToolResult 转换为文本
      return this._formatToolResult(result);
    } catch (err) {
      console.error(
        `[MCPClient] 调用工具 ${toolName} 失败 (服务器: ${connection.config.name}):`,
        err.message
      );
      return JSON.stringify({
        error: `调用工具 ${toolName} 失败: ${err.message}`,
      });
    }
  }

  // ----------------------------------------------------------
  // 状态查询
  // ----------------------------------------------------------

  /**
   * 获取所有服务器的状态
   * @returns {MCPServerStatus[]} 服务器状态数组
   */
  getServerStatuses() {
    const statuses = [];
    for (const connection of this.connections.values()) {
      statuses.push({
        id: connection.config.id,
        name: connection.config.name,
        status: connection.status,
        toolCount: connection.tools.length,
        tools: [...connection.tools],
        error: connection.error,
        lastConnected: connection.lastConnected,
      });
    }
    return statuses;
  }

  /**
   * 检查指定服务器是否已连接
   * @param {string} serverId - 服务器 ID
   * @returns {boolean}
   */
  isConnected(serverId) {
    const connection = this.connections.get(serverId);
    return connection ? connection.status === 'connected' : false;
  }

  /**
   * 根据工具名称查找所属的服务器 ID
   * @param {string} toolName - 工具名称
   * @returns {string|null} 服务器 ID，未找到返回 null
   */
  findServerByTool(toolName) {
    for (const connection of this.connections.values()) {
      if (connection.status === 'connected') {
        const found = connection.tools.find(
          (t) => t.function.name === toolName
        );
        if (found) {
          return connection.config.id;
        }
      }
    }
    return null;
  }

  // ----------------------------------------------------------
  // 内部方法
  // ----------------------------------------------------------

  /**
   * 将 MCP SDK 返回的工具格式转换为 OpenAI function calling 格式
   * @param {any} tool - MCP SDK 工具对象
   * @returns {MCPToolDefinition}
   * @private
   */
  _convertToolToOpenAIFormat(tool) {
    return {
      type: 'function',
      function: {
        name: tool.name || 'unknown',
        description: tool.description || '',
        parameters: {
          type: 'object',
          properties: (tool.inputSchema && tool.inputSchema.properties) || {},
          required: (tool.inputSchema && tool.inputSchema.required) || [],
        },
      },
    };
  }

  /**
   * 将 MCP 工具调用结果格式化为文本
   * @param {any} result - MCP callTool 返回结果
   * @returns {string}
   * @private
   */
  _formatToolResult(result) {
    if (!result) {
      return JSON.stringify({ error: '工具返回了空结果' });
    }

    // MCP 标准结果格式: { content: Array<{type, text, data, mimeType}>, isError }
    if (result.isError) {
      const errorText = (result.content || [])
        .filter((c) => c.type === 'text')
        .map((c) => c.text)
        .join('\n');
      return JSON.stringify({
        error: errorText || '工具执行出错',
        isError: true,
      });
    }

    const content = result.content || [];

    // 提取所有文本内容
    const textParts = content
      .filter((c) => c.type === 'text')
      .map((c) => c.text)
      .filter(Boolean);

    // 提取所有图片内容（返回 base64 描述）
    const imageParts = content
      .filter((c) => c.type === 'image')
      .map(
        (c) =>
          `[图片: ${c.mimeType || 'unknown'}, 数据长度: ${(c.data || '').length}]`
      );

    // 提取所有资源内容
    const resourceParts = content
      .filter((c) => c.type === 'resource')
      .map((c) => {
        if (c.text) return c.text;
        if (c.data) return `[资源: ${c.mimeType || 'unknown'}, 数据长度: ${c.data.length}]`;
        return '[资源: 无内容]';
      });

    const allParts = [...textParts, ...imageParts, ...resourceParts];

    if (allParts.length === 0) {
      return '工具执行成功，但未返回内容';
    }

    return allParts.join('\n');
  }

  /**
   * 尝试自动重连
   * 使用指数退避策略
   * @param {string} serverId - 服务器 ID
   * @private
   */
  _attemptReconnect(serverId) {
    const connection = this.connections.get(serverId);
    if (!connection) {
      return;
    }

    if (connection.reconnectAttempts >= RECONNECT_MAX_ATTEMPTS) {
      console.warn(
        `[MCPClient] ${connection.config.name} 已达到最大重连次数 (${RECONNECT_MAX_ATTEMPTS})，停止重连`
      );
      return;
    }

    // 指数退避计算延迟
    const delay = Math.min(
      RECONNECT_BASE_DELAY * Math.pow(2, connection.reconnectAttempts),
      RECONNECT_MAX_DELAY
    );

    // 加上随机抖动 (0 ~ 500ms)
    const jitter = Math.floor(Math.random() * 500);
    const totalDelay = delay + jitter;

    connection.reconnectAttempts++;

    console.log(
      `[MCPClient] 将在 ${totalDelay}ms 后尝试重连 ${connection.config.name} (第 ${connection.reconnectAttempts} 次)`
    );

    connection.reconnectTimer = setTimeout(async () => {
      connection.reconnectTimer = null;

      // 检查连接是否已被手动断开
      if (!this.connections.has(serverId)) {
        return;
      }

      console.log(
        `[MCPClient] 正在重连 ${connection.config.name} (第 ${connection.reconnectAttempts} 次)...`
      );

      try {
        // 清理旧的 transport
        try {
          await connection.transport.close();
        } catch (e) {
          // 忽略关闭错误
        }

        // 根据传输类型创建新的 transport
        /** @type {StdioClientTransport|StreamableHTTPClientTransport} */
        let newTransport;

        if (connection.transportType === 'streamableHttp') {
          newTransport = new StreamableHTTPClientTransport(
            new URL(connection.config.url),
            {
              requestInit: {
                headers: connection.config.headers || {},
              },
            }
          );
        } else {
          const env = {
            ...(process.env),
            ...(connection.config.env || {}),
          };
          newTransport = new StdioClientTransport({
            command: connection.config.command,
            args: connection.config.args,
            env,
          });
        }

        connection.transport = newTransport;

        // 监听新 transport 的事件
        newTransport.onclose = () => {
          if (connection.status === 'connected') {
            console.warn(
              `[MCPClient] ${connection.config.name} 连接已关闭`
            );
            connection.status = 'disconnected';
            this.emit('connection', {
              serverId: connection.config.id,
              status: 'disconnected',
            });
            this._attemptReconnect(serverId);
          }
        };

        newTransport.onerror = (err) => {
          console.error(
            `[MCPClient] ${connection.config.name} transport 错误:`,
            err.message
          );
          connection.status = 'error';
          connection.error = err.message;
          this.emit('connection', {
            serverId: connection.config.id,
            status: 'error',
            error: err.message,
          });
        };

        // 连接
        await newTransport.start();
        await connection.client.connect(newTransport);

        connection.status = 'connected';
        connection.lastConnected = Date.now();
        connection.error = undefined;
        connection.reconnectAttempts = 0;

        // 重新获取工具列表
        try {
          const toolsResult = await connection.client.listTools();
          connection.tools = (toolsResult.tools || []).map((tool) =>
            this._convertToolToOpenAIFormat(tool)
          );
        } catch (toolErr) {
          console.warn(
            `[MCPClient] 重连后获取 ${connection.config.name} 工具列表失败:`,
            toolErr.message
          );
          connection.tools = [];
        }

        console.log(
          `[MCPClient] 重连 ${connection.config.name} 成功，发现 ${connection.tools.length} 个工具`
        );

        this.emit('connection', {
          serverId: connection.config.id,
          status: 'connected',
        });
      } catch (err) {
        connection.status = 'error';
        connection.error = err.message;
        console.error(
          `[MCPClient] 重连 ${connection.config.name} 失败:`,
          err.message
        );

        this.emit('connection', {
          serverId: connection.config.id,
          status: 'error',
          error: err.message,
        });

        // 继续尝试重连
        this._attemptReconnect(serverId);
      }
    }, totalDelay);
  }
}

// ============================================================
// 导出单例
// ============================================================

const mcpClientManager = new MCPClientManager();

module.exports = {
  MCPClientManager,
  mcpClientManager,
};
