import React, { useState, useEffect, useCallback } from 'react';
import { Input, Modal, Tooltip, message, Select } from 'antd';
import { motion, AnimatePresence } from 'framer-motion';
import {
  Plus, Edit3, Trash2, Zap, Plug, Unplug, Terminal,
  Globe, ChevronDown, ChevronRight, Activity, Clock,
  AlertCircle, CheckCircle2, XCircle, RefreshCw, Info,
  BarChart3, Server, Wrench, X,
} from 'lucide-react';
import { api } from '../../utils/api';

const { TextArea } = Input;

// ===== 类型定义 =====

interface MCPServer {
  id: string;
  name: string;
  transport: 'stdio' | 'streamableHttp';
  command?: string;
  args?: string[] | null;
  env?: Record<string, string> | null;
  url?: string;
  headers?: Record<string, string> | null;
  enabled: boolean;
  isPreset: boolean;
  description?: string;
  icon: string;
  category: string;
  apiKey?: string;
  quotaTotal?: number | null;
  quotaUsed?: number;
  quotaResetAt?: string | null;
  expiresAt?: string | null;
  createdAt: string;
  updatedAt: string;
  // 运行时状态（从 mcpServers prop 获取）
  status?: 'connected' | 'connecting' | 'disconnected' | 'error';
  toolCount?: number;
}

interface MCPTool {
  name: string;
  serverName?: string;
  serverId?: string;
  description?: string;
}

interface UsageSummary {
  serverId: string;
  totalCalls: number;
  successCalls: number;
  errorCalls: number;
  successRate: number;
  avgDurationMs: number;
  maxDurationMs: number;
  minDurationMs: number;
  uniqueTools: number;
  firstCall: string | null;
  lastCall: string | null;
}

interface MCPManagerProps {
  visible: boolean;
  mcpTools: any[];
  onRefresh: () => void;
}

// ===== 样式常量 =====

const iconBtnStyle: React.CSSProperties = {
  width: 32, height: 32, borderRadius: 8,
  border: '1px solid var(--border-light)', background: 'var(--bg-secondary)',
  color: 'var(--text-secondary)', cursor: 'pointer',
  display: 'flex', alignItems: 'center', justifyContent: 'center',
};

const chipStyle: React.CSSProperties = {
  padding: '4px 10px', borderRadius: 6, border: '1px solid var(--border-light)',
  background: 'var(--bg-secondary)', color: 'var(--text-secondary)',
  fontSize: 12, cursor: 'pointer', whiteSpace: 'nowrap',
};

const labelStyle: React.CSSProperties = {
  display: 'block', fontSize: 12, fontWeight: 500, color: 'var(--text-secondary)', marginBottom: 4,
};

const inputStyle: React.CSSProperties = {
  width: '100%', padding: '7px 10px', borderRadius: 6,
  border: '1px solid var(--border-light)', background: 'var(--bg-secondary)',
  color: 'var(--text-primary)', fontSize: 13, outline: 'none', boxSizing: 'border-box',
};

const modalBtnStyle: React.CSSProperties = {
  padding: '6px 16px', borderRadius: 6, border: '1px solid var(--border-light)',
  background: 'var(--bg-secondary)', color: 'var(--text-primary)',
  fontSize: 13, cursor: 'pointer',
};

// ===== 图标选项 =====

const ICON_OPTIONS = [
  '🔌', '⚡', '🌐', '🖥️', '🔧', '🛠️', '📊', '📡', '🗄️', '🔍',
  '🤖', '🧠', '💬', '📁', '🔒', '🔑', '🎨', '📱', '☁️', '🚀',
];

// ===== 主组件 =====

const MCPManager: React.FC<MCPManagerProps> = ({ visible, mcpTools, onRefresh }) => {
  const mcpConfig = api.mcpConfig || {};

  // 本地状态
  const [loading, setLoading] = useState(false);
  const [configServers, setConfigServers] = useState<MCPServer[]>([]);
  const [expandedServers, setExpandedServers] = useState<Set<string>>(new Set());
  const [showTools, setShowTools] = useState(false);
  const [usageMap, setUsageMap] = useState<Record<string, UsageSummary>>({});
  const [connectingId, setConnectingId] = useState<string | null>(null);

  // 弹窗状态
  const [showServerModal, setShowServerModal] = useState(false);
  const [editingServer, setEditingServer] = useState<MCPServer | null>(null);

  // 表单状态
  const [formName, setFormName] = useState('');
  const [formTransport, setFormTransport] = useState<'stdio' | 'streamableHttp'>('stdio');
  const [formCommand, setFormCommand] = useState('');
  const [formArgs, setFormArgs] = useState('');
  const [formUrl, setFormUrl] = useState('');
  const [formHeaders, setFormHeaders] = useState('');
  const [formDescription, setFormDescription] = useState('');
  const [formIcon, setFormIcon] = useState('🔌');
  const [formApiKey, setFormApiKey] = useState('');
  const [formQuotaTotal, setFormQuotaTotal] = useState('');
  const [formExpiresAt, setFormExpiresAt] = useState('');

  // 初始化
  useEffect(() => {
    if (visible) {
      initializeAndLoad();
    }
  }, [visible]);

  const initializeAndLoad = async () => {
    setLoading(true);
    try {
      // 初始化预置服务器并连接所有已启用的服务器
      await mcpConfig.initializeAll?.();
      await loadServerList();
    } catch (err: any) {
      console.error('[MCPManager] 初始化失败:', err);
    } finally {
      setLoading(false);
    }
  };

  const loadServerList = async () => {
    try {
      const res = await mcpConfig.list?.();
      if (res?.success && res.data) {
        setConfigServers(res.data);
      }
    } catch (err) {
      console.error('[MCPManager] 加载服务器列表失败:', err);
    }
  };

  const refreshData = async () => {
    try {
      onRefresh?.();
      await loadServerList();
      // 加载每个服务器的用量摘要
      const summaries: Record<string, UsageSummary> = {};
      for (const server of configServers) {
        try {
          const res = await mcpConfig.usageSummary?.(server.id);
          if (res?.success && res.data) {
            summaries[server.id] = res.data;
          }
        } catch {
          // 忽略单个服务器的用量获取失败
        }
      }
      setUsageMap(summaries);
    } catch (err) {
      console.error('[MCPManager] 刷新数据失败:', err);
    }
  };

  // ===== 事件处理 =====

  const toggleServerExpand = (id: string) => {
    const next = new Set(expandedServers);
    if (next.has(id)) next.delete(id);
    else next.add(id);
    setExpandedServers(next);
  };

  const handleConnect = async (serverId: string) => {
    setConnectingId(serverId);
    try {
      const res = await mcpConfig.connect?.(serverId);
      if (res?.success) {
        message.success('服务器已连接');
        await refreshData();
      } else {
        message.error(res?.error || '连接失败');
      }
    } catch (err: any) {
      message.error(err?.message || '连接失败');
    } finally {
      setConnectingId(null);
    }
  };

  const handleDisconnect = async (serverId: string) => {
    try {
      const res = await mcpConfig.disconnect?.(serverId);
      if (res?.success) {
        message.success('服务器已断开');
        await refreshData();
      } else {
        message.error(res?.error || '断开失败');
      }
    } catch (err: any) {
      message.error(err?.message || '断开失败');
    }
  };

  const handleToggle = async (serverId: string) => {
    try {
      const res = await mcpConfig.toggle?.(serverId);
      if (res?.success) {
        await refreshData();
      }
    } catch (err: any) {
      message.error(err?.message || '操作失败');
    }
  };

  const handleDelete = (server: MCPServer) => {
    Modal.confirm({
      title: '删除服务器',
      content: `确定要删除 MCP 服务器"${server.name}"吗？此操作不可撤销。`,
      okText: '删除',
      okType: 'danger',
      cancelText: '取消',
      zIndex: 100000,
      onOk: async () => {
        try {
          const res = await mcpConfig.delete?.(server.id);
          if (res?.success) {
            message.success('服务器已删除');
            await refreshData();
          } else {
            message.error(res?.error || '删除失败');
          }
        } catch (err: any) {
          message.error(err?.message || '删除失败');
        }
      },
    });
  };

  // ===== 弹窗操作 =====

  const openCreateModal = () => {
    setFormName('');
    setFormTransport('stdio');
    setFormCommand('');
    setFormArgs('');
    setFormUrl('');
    setFormHeaders('');
    setFormDescription('');
    setFormIcon('🔌');
    setFormApiKey('');
    setFormQuotaTotal('');
    setFormExpiresAt('');
    setEditingServer(null);
    setShowServerModal(true);
  };

  const openEditModal = (server: MCPServer) => {
    setFormName(server.name);
    setFormTransport(server.transport);
    setFormCommand(server.command || '');
    setFormArgs(server.args ? server.args.join(' ') : '');
    setFormUrl(server.url || '');
    setFormHeaders(server.headers ? JSON.stringify(server.headers, null, 2) : '');
    setFormDescription(server.description || '');
    setFormIcon(server.icon);
    setFormApiKey(server.apiKey || '');
    setFormQuotaTotal(server.quotaTotal ? String(server.quotaTotal) : '');
    setFormExpiresAt(server.expiresAt ? server.expiresAt.slice(0, 10) : '');
    setEditingServer(server);
    setShowServerModal(true);
  };

  const handleSaveServer = async () => {
    if (!formName.trim()) {
      message.warning('请填写服务器名称');
      return;
    }

    if (formTransport === 'stdio' && !formCommand.trim()) {
      message.warning('请填写命令');
      return;
    }

    if (formTransport === 'streamableHttp' && !formUrl.trim()) {
      message.warning('请填写 URL');
      return;
    }

    const serverData: any = {
      name: formName.trim(),
      transport: formTransport,
      description: formDescription.trim() || undefined,
      icon: formIcon,
      apiKey: formApiKey.trim() || undefined,
      quotaTotal: formQuotaTotal ? parseInt(formQuotaTotal, 10) : undefined,
      expiresAt: formExpiresAt ? new Date(formExpiresAt).toISOString() : undefined,
    };

    if (formTransport === 'stdio') {
      serverData.command = formCommand.trim();
      serverData.args = formArgs.trim() ? formArgs.trim().split(/\s+/) : [];
    } else {
      serverData.url = formUrl.trim();
      if (formHeaders.trim()) {
        try {
          serverData.headers = JSON.parse(formHeaders.trim());
        } catch {
          message.warning('Headers 格式无效，请使用 JSON 格式');
          return;
        }
      }
    }

    try {
      if (editingServer) {
        const res = await mcpConfig.update?.(editingServer.id, serverData);
        if (res?.success) {
          message.success('服务器已更新');
          setShowServerModal(false);
          await refreshData();
        } else {
          message.error(res?.error || '更新失败');
        }
      } else {
        const res = await mcpConfig.create?.(serverData);
        if (res?.success) {
          message.success('服务器已创建');
          setShowServerModal(false);
          await refreshData();
        } else {
          message.error(res?.error || '创建失败');
        }
      }
    } catch (err: any) {
      message.error(err?.message || '操作失败');
    }
  };

  // ===== 工具函数 =====

  const getStatusColor = (status?: string) => {
    switch (status) {
      case 'connected': return '#52c41a';
      case 'connecting': return '#faad14';
      case 'error': return '#ff4d4f';
      default: return 'var(--text-quaternary)';
    }
  };

  const getStatusText = (status?: string) => {
    switch (status) {
      case 'connected': return '已连接';
      case 'connecting': return '连接中';
      case 'error': return '错误';
      default: return '已断开';
    }
  };

  const getTransportLabel = (transport: string) => {
    return transport === 'stdio' ? 'stdio' : 'HTTP';
  };

  const formatDate = (dateStr?: string | null) => {
    if (!dateStr) return '--';
    try {
      const d = new Date(dateStr);
      return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
    } catch {
      return '--';
    }
  };

  const isExpired = (expiresAt?: string | null) => {
    if (!expiresAt) return false;
    return new Date(expiresAt) < new Date();
  };

  // 按服务器分组的工具
  const toolsByServer = mcpTools.reduce<Record<string, MCPTool[]>>((acc, tool) => {
    const sid = tool.serverId || 'unknown';
    if (!acc[sid]) acc[sid] = [];
    acc[sid].push(tool);
    return acc;
  }, {});

  if (!visible) return null;

  return (
    <div style={{ flex: 1, overflowY: 'auto', padding: 16 }}>
      {/* 头部 */}
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 12 }}>
        <div>
          <div style={{ fontSize: 15, fontWeight: 600, color: 'var(--text-primary)', marginBottom: 2 }}>MCP 服务器管理</div>
          <div style={{ fontSize: 12, color: 'var(--text-tertiary)' }}>
            {configServers.length} 个服务器 · {mcpTools.length} 个工具 · 管理 Model Context Protocol 连接
          </div>
        </div>
        <div style={{ display: 'flex', gap: 6 }}>
          <Tooltip title="刷新状态">
            <button onClick={refreshData} style={iconBtnStyle}>
              <RefreshCw size={15} />
            </button>
          </Tooltip>
          <Tooltip title="添加服务器">
            <button onClick={openCreateModal} style={iconBtnStyle}>
              <Plus size={15} />
            </button>
          </Tooltip>
        </div>
      </div>

      {/* 服务器列表 */}
      {loading ? (
        <div style={{ textAlign: 'center', padding: 40, color: 'var(--text-tertiary)', fontSize: 13 }}>加载中...</div>
      ) : configServers.length === 0 ? (
        <div style={{ textAlign: 'center', padding: 40, color: 'var(--text-tertiary)', fontSize: 13 }}>
          <Server size={32} style={{ color: 'var(--border-color)', marginBottom: 8 }} />
          <div>暂无 MCP 服务器</div>
          <div style={{ fontSize: 11, marginTop: 4 }}>点击右上角 + 添加 MCP 服务器</div>
        </div>
      ) : (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 8, marginBottom: 16 }}>
          {configServers.map((server) => (
            <ServerCard
              key={server.id}
              server={server}
              expanded={expandedServers.has(server.id)}
              usage={usageMap[server.id]}
              tools={toolsByServer[server.id] || []}
              connecting={connectingId === server.id}
              onToggleExpand={() => toggleServerExpand(server.id)}
              onConnect={() => handleConnect(server.id)}
              onDisconnect={() => handleDisconnect(server.id)}
              onToggleEnabled={() => handleToggle(server.id)}
              onEdit={() => openEditModal(server)}
              onDelete={() => handleDelete(server)}
              getStatusColor={getStatusColor}
              getStatusText={getStatusText}
              getTransportLabel={getTransportLabel}
              formatDate={formatDate}
              isExpired={isExpired}
            />
          ))}
        </div>
      )}

      {/* MCP 工具网格 */}
      {mcpTools.length > 0 && (
        <div>
          <div
            onClick={() => setShowTools(!showTools)}
            style={{
              display: 'flex', alignItems: 'center', gap: 8,
              padding: '8px 0', cursor: 'pointer', userSelect: 'none',
              marginBottom: 8,
            }}
          >
            {showTools ? (
              <ChevronDown size={14} style={{ color: 'var(--text-tertiary)' }} />
            ) : (
              <ChevronRight size={14} style={{ color: 'var(--text-tertiary)' }} />
            )}
            <Wrench size={14} style={{ color: 'var(--text-secondary)' }} />
            <span style={{ fontSize: 13, fontWeight: 600, color: 'var(--text-primary)' }}>可用工具</span>
            <span style={{
              fontSize: 11, color: 'var(--text-tertiary)',
              background: 'var(--bg-tertiary)', padding: '2px 8px', borderRadius: 10,
            }}>
              {mcpTools.length} 个
            </span>
          </div>

          <AnimatePresence>
            {showTools && (
              <motion.div
                initial={{ height: 0, opacity: 0 }}
                animate={{ height: 'auto', opacity: 1 }}
                exit={{ height: 0, opacity: 0 }}
                transition={{ duration: 0.2 }}
                style={{ overflow: 'hidden' }}
              >
                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(200px, 1fr))', gap: 6 }}>
                  {mcpTools.map((tool) => (
                    <ToolCard key={tool.name} tool={tool} />
                  ))}
                </div>
              </motion.div>
            )}
          </AnimatePresence>
        </div>
      )}

      {/* 添加/编辑服务器弹窗 */}
      <Modal
        title={editingServer ? '编辑 MCP 服务器' : '添加 MCP 服务器'}
        open={showServerModal}
        onCancel={() => setShowServerModal(false)}
        onOk={handleSaveServer}
        okText={editingServer ? '保存' : '创建'}
        width={560}
        zIndex={100000}
        styles={{ body: { maxHeight: '65vh', overflowY: 'auto' } }}
      >
        <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
          {/* 名称 + 图标 */}
          <div style={{ display: 'flex', gap: 10 }}>
            <div style={{ flex: 1 }}>
              <label style={labelStyle}>服务器名称 *</label>
              <input
                value={formName}
                onChange={(e) => setFormName(e.target.value)}
                placeholder="如：文件搜索服务"
                style={inputStyle}
              />
            </div>
            <div style={{ width: 120 }}>
              <label style={labelStyle}>图标</label>
              <div style={{ display: 'flex', flexWrap: 'wrap', gap: 4 }}>
                {ICON_OPTIONS.map((emoji) => (
                  <button
                    key={emoji}
                    onClick={() => setFormIcon(emoji)}
                    style={{
                      width: 28, height: 28, borderRadius: 6,
                      border: formIcon === emoji ? '2px solid var(--primary-color)' : '1px solid var(--border-light)',
                      background: formIcon === emoji ? 'var(--primary-bg)' : 'var(--bg-secondary)',
                      cursor: 'pointer', fontSize: 14,
                      display: 'flex', alignItems: 'center', justifyContent: 'center',
                    }}
                  >
                    {emoji}
                  </button>
                ))}
              </div>
            </div>
          </div>

          {/* 传输类型 */}
          <div>
            <label style={labelStyle}>传输类型</label>
            <div style={{ display: 'flex', gap: 8 }}>
              <button
                onClick={() => setFormTransport('stdio')}
                style={{
                  ...chipStyle,
                  flex: 1,
                  textAlign: 'center',
                  background: formTransport === 'stdio' ? 'var(--primary-color)' : 'var(--bg-secondary)',
                  color: formTransport === 'stdio' ? '#fff' : 'var(--text-secondary)',
                  borderColor: formTransport === 'stdio' ? 'var(--primary-color)' : 'var(--border-light)',
                  display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 6,
                }}
              >
                <Terminal size={13} /> stdio
              </button>
              <button
                onClick={() => setFormTransport('streamableHttp')}
                style={{
                  ...chipStyle,
                  flex: 1,
                  textAlign: 'center',
                  background: formTransport === 'streamableHttp' ? 'var(--primary-color)' : 'var(--bg-secondary)',
                  color: formTransport === 'streamableHttp' ? '#fff' : 'var(--text-secondary)',
                  borderColor: formTransport === 'streamableHttp' ? 'var(--primary-color)' : 'var(--border-light)',
                  display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 6,
                }}
              >
                <Globe size={13} /> streamableHttp
              </button>
            </div>
          </div>

          {/* stdio 模式配置 */}
          {formTransport === 'stdio' && (
            <motion.div
              initial={{ opacity: 0, y: -8 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.15 }}
              style={{ display: 'flex', flexDirection: 'column', gap: 14 }}
            >
              <div>
                <label style={labelStyle}>命令 *</label>
                <input
                  value={formCommand}
                  onChange={(e) => setFormCommand(e.target.value)}
                  placeholder="如：npx、python、node"
                  style={inputStyle}
                />
              </div>
              <div>
                <label style={labelStyle}>参数（空格分隔）</label>
                <input
                  value={formArgs}
                  onChange={(e) => setFormArgs(e.target.value)}
                  placeholder="如：-y @modelcontextprotocol/server-filesystem /path"
                  style={inputStyle}
                />
              </div>
            </motion.div>
          )}

          {/* streamableHttp 模式配置 */}
          {formTransport === 'streamableHttp' && (
            <motion.div
              initial={{ opacity: 0, y: -8 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.15 }}
              style={{ display: 'flex', flexDirection: 'column', gap: 14 }}
            >
              <div>
                <label style={labelStyle}>URL *</label>
                <input
                  value={formUrl}
                  onChange={(e) => setFormUrl(e.target.value)}
                  placeholder="如：https://api.example.com/mcp"
                  style={inputStyle}
                />
              </div>
              <div>
                <label style={labelStyle}>
                  Headers
                  <span style={{ fontWeight: 400, color: 'var(--text-quaternary)', marginLeft: 4 }}>（JSON 格式，可选）</span>
                </label>
                <TextArea
                  value={formHeaders}
                  onChange={(e) => setFormHeaders(e.target.value)}
                  placeholder='{"Authorization": "Bearer xxx", "Content-Type": "application/json"}'
                  rows={3}
                  style={{ ...inputStyle, resize: 'vertical', fontFamily: 'monospace', fontSize: 12 }}
                />
              </div>
              <div>
                <label style={labelStyle}>API Key（可选）</label>
                <input
                  value={formApiKey}
                  onChange={(e) => setFormApiKey(e.target.value)}
                  placeholder="API 密钥"
                  type="password"
                  style={inputStyle}
                />
              </div>
            </motion.div>
          )}

          {/* 描述 */}
          <div>
            <label style={labelStyle}>描述</label>
            <input
              value={formDescription}
              onChange={(e) => setFormDescription(e.target.value)}
              placeholder="服务器用途描述"
              style={inputStyle}
            />
          </div>

          {/* 配额与到期 */}
          <div style={{ display: 'flex', gap: 10 }}>
            <div style={{ flex: 1 }}>
              <label style={labelStyle}>配额上限（可选）</label>
              <input
                value={formQuotaTotal}
                onChange={(e) => setFormQuotaTotal(e.target.value)}
                placeholder="如：1000"
                type="number"
                style={inputStyle}
              />
            </div>
            <div style={{ flex: 1 }}>
              <label style={labelStyle}>到期时间（可选）</label>
              <input
                value={formExpiresAt}
                onChange={(e) => setFormExpiresAt(e.target.value)}
                type="date"
                style={inputStyle}
              />
            </div>
          </div>
        </div>
      </Modal>
    </div>
  );
};

// ===== 子组件：服务器卡片 =====

interface ServerCardProps {
  server: MCPServer;
  expanded: boolean;
  usage: UsageSummary | undefined;
  tools: MCPTool[];
  connecting: boolean;
  onToggleExpand: () => void;
  onConnect: () => void;
  onDisconnect: () => void;
  onToggleEnabled: () => void;
  onEdit: () => void;
  onDelete: () => void;
  getStatusColor: (status?: string) => string;
  getStatusText: (status?: string) => string;
  getTransportLabel: (transport: string) => string;
  formatDate: (dateStr?: string | null) => string;
  isExpired: (expiresAt?: string | null) => boolean;
}

const ServerCard: React.FC<ServerCardProps> = ({
  server, expanded, usage, tools, connecting,
  onToggleExpand, onConnect, onDisconnect, onToggleEnabled, onEdit, onDelete,
  getStatusColor, getStatusText, getTransportLabel, formatDate, isExpired,
}) => {
  const expired = isExpired(server.expiresAt);
  const quotaPercent = server.quotaTotal ? Math.round((server.quotaUsed / server.quotaTotal) * 100) : 0;
  const quotaWarning = quotaPercent >= 80;

  return (
    <motion.div
      initial={{ opacity: 0, y: 8 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.15 }}
    >
      <div style={{
        borderRadius: 10,
        border: server.status === 'connected'
          ? '1px solid rgba(82,196,26,0.3)'
          : '1px solid var(--border-light)',
        background: 'var(--bg-secondary)',
        overflow: 'hidden',
        opacity: server.enabled ? 1 : 0.5,
        transition: 'all 0.15s ease',
      }}>
        {/* 卡片头部 */}
        <div
          onClick={onToggleExpand}
          style={{
            display: 'flex', alignItems: 'center', gap: 10,
            padding: '12px 14px', cursor: 'pointer',
          }}
        >
          {/* 展开箭头 */}
          {expanded ? (
            <ChevronDown size={14} style={{ color: 'var(--text-tertiary)', flexShrink: 0 }} />
          ) : (
            <ChevronRight size={14} style={{ color: 'var(--text-tertiary)', flexShrink: 0 }} />
          )}

          {/* 状态指示灯 */}
          <div style={{
            width: 8, height: 8, borderRadius: '50%',
            background: getStatusColor(server.status),
            flexShrink: 0,
            boxShadow: server.status === 'connected' ? '0 0 6px rgba(82,196,26,0.4)' : 'none',
          }} />

          {/* 图标 */}
          <span style={{ fontSize: 16, flexShrink: 0 }}>{server.icon}</span>

          {/* 名称和基本信息 */}
          <div style={{ flex: 1, minWidth: 0 }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
              <span style={{
                fontSize: 13, fontWeight: 600, color: 'var(--text-primary)',
                overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap',
              }}>
                {server.name}
              </span>
              {server.isPreset && (
                <span style={{
                  fontSize: 10, padding: '1px 6px', borderRadius: 4,
                  background: 'var(--primary-bg)', color: 'var(--primary-color)',
                  fontWeight: 500,
                }}>预置</span>
              )}
              {/* 传输类型标签 */}
              <span style={{
                fontSize: 10, padding: '1px 6px', borderRadius: 4,
                background: server.transport === 'stdio' ? 'rgba(96,165,250,0.1)' : 'rgba(250,173,20,0.1)',
                color: server.transport === 'stdio' ? '#60a5fa' : '#faad14',
                display: 'inline-flex', alignItems: 'center', gap: 3,
              }}>
                {server.transport === 'stdio' ? <Terminal size={9} /> : <Globe size={9} />}
                {getTransportLabel(server.transport)}
              </span>
            </div>
            <div style={{ fontSize: 11, color: 'var(--text-tertiary)', marginTop: 2 }}>
              {getStatusText(server.status)}
              {server.toolCount > 0 && ` · ${server.toolCount} 个工具`}
              {expired && (
                <span style={{ color: '#ff4d4f', marginLeft: 4 }}>· 已过期</span>
              )}
            </div>
          </div>

          {/* 操作按钮 */}
          <div style={{ display: 'flex', gap: 4, flexShrink: 0 }} onClick={(e) => e.stopPropagation()}>
            {server.status === 'connected' ? (
              <Tooltip title="断开连接">
                <button onClick={onDisconnect} style={iconBtnStyle}>
                  <Unplug size={14} />
                </button>
              </Tooltip>
            ) : (
              <Tooltip title="连接">
                <button onClick={onConnect} style={iconBtnStyle} disabled={connecting}>
                  <Plug size={14} />
                </button>
              </Tooltip>
            )}
            <>
              <Tooltip title="编辑">
                <button onClick={onEdit} style={iconBtnStyle}>
                  <Edit3 size={14} />
                </button>
              </Tooltip>
              <Tooltip title="删除">
                <button onClick={onDelete} style={{ ...iconBtnStyle, color: '#ff4d4f' }}>
                  <Trash2 size={14} />
                </button>
              </Tooltip>
            </>
          </div>
        </div>

        {/* 展开详情 */}
        <AnimatePresence>
          {expanded && (
            <motion.div
              initial={{ height: 0, opacity: 0 }}
              animate={{ height: 'auto', opacity: 1 }}
              exit={{ height: 0, opacity: 0 }}
              transition={{ duration: 0.2 }}
              style={{ overflow: 'hidden' }}
            >
              <div style={{
                padding: '0 14px 14px 14px',
                borderTop: '1px solid var(--border-light)',
                paddingTop: 12,
              }}>
                {/* 描述 */}
                {server.description && (
                  <div style={{ fontSize: 12, color: 'var(--text-secondary)', marginBottom: 12, lineHeight: 1.5 }}>
                    {server.description}
                  </div>
                )}

                {/* 用量统计 */}
                {usage && usage.totalCalls > 0 && (
                  <div style={{ marginBottom: 12 }}>
                    <div style={{
                      display: 'flex', alignItems: 'center', gap: 6,
                      fontSize: 12, fontWeight: 500, color: 'var(--text-secondary)', marginBottom: 8,
                    }}>
                      <Activity size={12} />
                      用量统计
                    </div>
                    <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: 8 }}>
                      <StatItem label="总调用" value={String(usage.totalCalls)} />
                      <StatItem label="成功率" value={`${usage.successRate}%`} color={usage.successRate >= 90 ? '#52c41a' : usage.successRate >= 70 ? '#faad14' : '#ff4d4f'} />
                      <StatItem label="平均耗时" value={`${usage.avgDurationMs}ms`} />
                    </div>
                  </div>
                )}

                {/* 配额进度条 */}
                {server.quotaTotal && server.quotaTotal > 0 && (
                  <div style={{ marginBottom: 12 }}>
                    <div style={{
                      display: 'flex', alignItems: 'center', justifyContent: 'space-between',
                      fontSize: 12, color: 'var(--text-secondary)', marginBottom: 6,
                    }}>
                      <span>配额使用</span>
                      <span style={{ color: quotaWarning ? '#ff4d4f' : 'var(--text-tertiary)' }}>
                        {server.quotaUsed} / {server.quotaTotal}
                        {quotaWarning && ' (即将用完)'}
                      </span>
                    </div>
                    <div style={{
                      width: '100%', height: 6, borderRadius: 3,
                      background: 'var(--bg-tertiary)', overflow: 'hidden',
                    }}>
                      <motion.div
                        initial={{ width: 0 }}
                        animate={{ width: `${Math.min(quotaPercent, 100)}%` }}
                        transition={{ duration: 0.4, ease: 'easeOut' }}
                        style={{
                          height: '100%', borderRadius: 3,
                          background: quotaWarning ? '#ff4d4f' : quotaPercent >= 60 ? '#faad14' : '#52c41a',
                        }}
                      />
                    </div>
                    {server.quotaResetAt && (
                      <div style={{ fontSize: 10, color: 'var(--text-quaternary)', marginTop: 4 }}>
                        重置时间：{formatDate(server.quotaResetAt)}
                      </div>
                    )}
                  </div>
                )}

                {/* 到期时间 */}
                {server.expiresAt && (
                  <div style={{
                    display: 'flex', alignItems: 'center', gap: 6,
                    padding: '8px 10px', borderRadius: 6,
                    background: expired ? 'rgba(255,77,79,0.08)' : 'var(--bg-tertiary)',
                    marginBottom: 12,
                  }}>
                    {expired ? (
                      <AlertCircle size={13} style={{ color: '#ff4d4f' }} />
                    ) : (
                      <Clock size={13} style={{ color: 'var(--text-tertiary)' }} />
                    )}
                    <span style={{
                      fontSize: 12,
                      color: expired ? '#ff4d4f' : 'var(--text-secondary)',
                    }}>
                      {expired ? '已过期' : '到期时间'}：{formatDate(server.expiresAt)}
                    </span>
                  </div>
                )}

                {/* 服务器工具列表 */}
                {tools.length > 0 && (
                  <div>
                    <div style={{
                      display: 'flex', alignItems: 'center', gap: 6,
                      fontSize: 12, fontWeight: 500, color: 'var(--text-secondary)', marginBottom: 8,
                    }}>
                      <Wrench size={12} />
                      工具列表 ({tools.length})
                    </div>
                    <div style={{ display: 'flex', flexWrap: 'wrap', gap: 4 }}>
                      {tools.map((tool) => (
                        <span key={tool.name} style={{
                          fontSize: 11, padding: '3px 8px', borderRadius: 4,
                          background: 'var(--bg-tertiary)', color: 'var(--text-secondary)',
                          border: '1px solid var(--border-light)',
                        }}>
                          {tool.name}
                        </span>
                      ))}
                    </div>
                  </div>
                )}

                {/* 连接信息 */}
                <div style={{ marginTop: 12, fontSize: 11, color: 'var(--text-quaternary)' }}>
                  {server.transport === 'stdio' ? (
                    <span>
                      <Terminal size={10} style={{ marginRight: 4, verticalAlign: 'middle' }} />
                      {server.command}{server.args?.length ? ` ${server.args.join(' ')}` : ''}
                    </span>
                  ) : (
                    <span>
                      <Globe size={10} style={{ marginRight: 4, verticalAlign: 'middle' }} />
                      {server.url}
                    </span>
                  )}
                </div>
              </div>
            </motion.div>
          )}
        </AnimatePresence>
      </div>
    </motion.div>
  );
};

// ===== 子组件：统计项 =====

const StatItem: React.FC<{
  label: string;
  value: string;
  color?: string;
}> = ({ label, value, color }) => (
  <div style={{
    padding: '8px 10px', borderRadius: 6,
    background: 'var(--bg-tertiary)',
  }}>
    <div style={{ fontSize: 10, color: 'var(--text-tertiary)', marginBottom: 2 }}>{label}</div>
    <div style={{ fontSize: 14, fontWeight: 600, color: color || 'var(--text-primary)' }}>{value}</div>
  </div>
);

// ===== 子组件：工具卡片 =====

const ToolCard: React.FC<{ tool: MCPTool }> = ({ tool }) => (
  <motion.div whileHover={{ scale: 1.02 }} whileTap={{ scale: 0.98 }}>
    <div style={{
      padding: '10px 12px', borderRadius: 8,
      border: '1px solid var(--border-light)',
      background: 'var(--bg-secondary)',
      cursor: 'default',
    }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: 6, marginBottom: 4 }}>
        <Zap size={12} style={{ color: '#60a5fa', flexShrink: 0 }} />
        <span style={{
          fontSize: 12, fontWeight: 500, color: 'var(--text-primary)',
          overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap',
        }}>
          {tool.name}
        </span>
      </div>
      {tool.serverName && (
        <div style={{ fontSize: 10, color: 'var(--text-quaternary)' }}>
          {tool.serverName}
        </div>
      )}
    </div>
  </motion.div>
);

export default MCPManager;
