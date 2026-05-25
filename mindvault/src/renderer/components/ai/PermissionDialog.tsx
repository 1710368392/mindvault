/**
 * PermissionDialog - 权限确认对话框
 * 
 * 当 AI 请求执行需要确认的工具时弹出
 * 基于 Claude Code 的权限审核 UI
 */

import React, { useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { Shield, AlertTriangle, CheckCircle, XCircle, ChevronDown, ChevronUp, Info } from 'lucide-react';

interface PermissionDialogProps {
  visible: boolean;
  toolName: string;
  input: Record<string, any>;
  reason: string;
  riskLevel?: 'safe' | 'moderate' | 'dangerous';
  onDecision: (decision: 'allow' | 'deny') => void;
}

const TOOL_LABELS: Record<string, string> = {
  create_creativity: '创建创意',
  update_creativity: '更新创意',
  delete_creativity: '删除创意',
  tag_creativity: '添加标签',
  toggle_favorite: '收藏/取消收藏',
  create_board: '创建看板',
  update_board: '更新看板',
  delete_board: '删除看板',
  add_to_board: '添加到看板',
  remove_from_board: '从看板移除',
  create_tag: '创建标签',
  delete_tag: '删除标签',
  control_music: '控制音乐',
  update_settings: '更新设置',
  execute_code: '执行代码',
  web_search: '联网搜索',
  read_file: '读取文件',
  permanent_delete_creativity: '永久删除',
  batch_delete_creativities: '批量删除',
  clear_trash: '清空回收站',
};

const RISK_CONFIG = {
  safe: {
    color: '#52c41a',
    bg: 'rgba(82, 196, 26, 0.1)',
    border: 'rgba(82, 196, 26, 0.3)',
    label: '安全',
    icon: CheckCircle,
  },
  moderate: {
    color: '#faad14',
    bg: 'rgba(250, 173, 20, 0.1)',
    border: 'rgba(250, 173, 20, 0.3)',
    label: '需要确认',
    icon: AlertTriangle,
  },
  dangerous: {
    color: '#ff4d4f',
    bg: 'rgba(255, 77, 79, 0.1)',
    border: 'rgba(255, 77, 79, 0.3)',
    label: '危险操作',
    icon: XCircle,
  },
};

const PermissionDialog: React.FC<PermissionDialogProps> = ({
  visible,
  toolName,
  input,
  reason,
  riskLevel = 'moderate',
  onDecision,
}) => {
  const [showDetails, setShowDetails] = useState(false);
  const [isProcessing, setIsProcessing] = useState(false);

  if (!visible) return null;

  const config = RISK_CONFIG[riskLevel];
  const RiskIcon = config.icon;
  const toolLabel = TOOL_LABELS[toolName] || toolName;

  const handleDecision = (decision: 'allow' | 'deny') => {
    setIsProcessing(true);
    setTimeout(() => {
      onDecision(decision);
      setIsProcessing(false);
      setShowDetails(false);
    }, 100);
  };

  return (
    <AnimatePresence>
      {visible && (
        <motion.div
          initial={{ opacity: 0, y: 20, scale: 0.95 }}
          animate={{ opacity: 1, y: 0, scale: 1 }}
          exit={{ opacity: 0, y: 10, scale: 0.95 }}
          transition={{ duration: 0.2, ease: 'easeOut' }}
          style={{
            margin: '8px 16px',
            padding: 16,
            borderRadius: 12,
            background: 'var(--bg-primary)',
            border: `1px solid ${config.border}`,
            boxShadow: `0 4px 16px rgba(0,0,0,0.08), 0 0 0 1px ${config.border}`,
          }}
        >
          {/* 头部 */}
          <div style={{
            display: 'flex',
            alignItems: 'center',
            gap: 10,
            marginBottom: 12,
          }}>
            <div style={{
              width: 36, height: 36, borderRadius: 10,
              background: config.bg,
              display: 'flex', alignItems: 'center', justifyContent: 'center',
            }}>
              <RiskIcon size={20} style={{ color: config.color }} />
            </div>
            <div style={{ flex: 1 }}>
              <div style={{
                fontSize: 14, fontWeight: 600,
                color: 'var(--text-primary)',
                display: 'flex', alignItems: 'center', gap: 8,
              }}>
                <Shield size={14} style={{ color: config.color }} />
                AI 请求执行操作
              </div>
              <div style={{
                fontSize: 12, color: config.color,
                fontWeight: 500, marginTop: 2,
              }}>
                {config.label}
              </div>
            </div>
          </div>

          {/* 工具信息 */}
          <div style={{
            padding: '10px 12px',
            borderRadius: 8,
            background: 'var(--bg-secondary)',
            marginBottom: 10,
          }}>
            <div style={{
              fontSize: 13, fontWeight: 600,
              color: 'var(--text-primary)',
              marginBottom: 4,
            }}>
              {toolLabel}
            </div>
            <div style={{
              fontSize: 12, color: 'var(--text-secondary)',
              lineHeight: 1.5,
            }}>
              {reason}
            </div>
          </div>

          {/* 参数详情（可折叠） */}
          <div style={{ marginBottom: 12 }}>
            <button
              onClick={() => setShowDetails(!showDetails)}
              style={{
                display: 'flex', alignItems: 'center', gap: 6,
                padding: '6px 0',
                border: 'none', background: 'transparent',
                cursor: 'pointer', fontSize: 12,
                color: 'var(--text-tertiary)',
              }}
            >
              <Info size={12} />
              <span>查看参数详情</span>
              {showDetails ? <ChevronUp size={12} /> : <ChevronDown size={12} />}
            </button>
            <AnimatePresence>
              {showDetails && (
                <motion.div
                  initial={{ height: 0, opacity: 0 }}
                  animate={{ height: 'auto', opacity: 1 }}
                  exit={{ height: 0, opacity: 0 }}
                  transition={{ duration: 0.15 }}
                  style={{ overflow: 'hidden' }}
                >
                  <pre style={{
                    padding: 10,
                    borderRadius: 8,
                    background: 'var(--bg-tertiary)',
                    fontSize: 11,
                    color: 'var(--text-secondary)',
                    fontFamily: 'monospace',
                    maxHeight: 200,
                    overflow: 'auto',
                    whiteSpace: 'pre-wrap',
                    wordBreak: 'break-all',
                  }}>
                    {JSON.stringify(input, null, 2)}
                  </pre>
                </motion.div>
              )}
            </AnimatePresence>
          </div>

          {/* 操作按钮 */}
          <div style={{
            display: 'flex', gap: 8, justifyContent: 'flex-end',
          }}>
            <button
              onClick={() => handleDecision('deny')}
              disabled={isProcessing}
              style={{
                padding: '8px 16px',
                borderRadius: 8,
                border: '1px solid var(--border-color)',
                background: 'var(--bg-primary)',
                color: 'var(--text-secondary)',
                cursor: isProcessing ? 'not-allowed' : 'pointer',
                fontSize: 13, fontWeight: 500,
                transition: 'all 0.15s ease',
                opacity: isProcessing ? 0.5 : 1,
              }}
            >
              拒绝
            </button>
            <button
              onClick={() => handleDecision('allow')}
              disabled={isProcessing}
              style={{
                padding: '8px 16px',
                borderRadius: 8,
                border: 'none',
                background: config.color,
                color: 'white',
                cursor: isProcessing ? 'not-allowed' : 'pointer',
                fontSize: 13, fontWeight: 500,
                transition: 'all 0.15s ease',
                opacity: isProcessing ? 0.5 : 1,
              }}
            >
              允许
            </button>
          </div>
        </motion.div>
      )}
    </AnimatePresence>
  );
};

export default PermissionDialog;
