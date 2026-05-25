// MCP (Model Context Protocol) 类型定义
// 在主进程和渲染进程之间共享

// MCP Server 配置
export interface MCPServerConfig {
  id: string;
  name: string;
  command: string;
  args: string[];
  env?: Record<string, string>;
  enabled: boolean;
}

// MCP 工具定义（转换为 OpenAI function calling 格式）
export interface MCPToolDefinition {
  type: 'function';
  function: {
    name: string;
    description: string;
    parameters: {
      type: 'object';
      properties: Record<string, any>;
      required?: string[];
    };
  };
}

// MCP 工具调用结果
export interface MCPToolResult {
  content: Array<{
    type: 'text' | 'image' | 'resource';
    text?: string;
    data?: string;
    mimeType?: string;
  }>;
  isError?: boolean;
}

// MCP Server 状态
export interface MCPServerStatus {
  id: string;
  name: string;
  status: 'connected' | 'disconnected' | 'error';
  toolCount: number;
  tools: MCPToolDefinition[];
  error?: string;
  lastConnected?: number;
}

// MCP 连接事件
export interface MCPConnectionEvent {
  serverId: string;
  status: 'connected' | 'disconnected' | 'error';
  error?: string;
}
