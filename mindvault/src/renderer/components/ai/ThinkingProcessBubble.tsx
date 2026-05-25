import React, { useRef, useEffect, useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { Brain, Wrench, Cpu, Loader, ChevronDown, ChevronRight, Zap, CheckCircle, XCircle } from 'lucide-react';

const STATUS_CONFIG: Record<string, { label: string; icon: any; color: string; bg: string }> = {
  thinking: { label: '思考中', icon: Brain, color: '#a78bfa', bg: 'rgba(167,139,250,0.12)' },
  planning: { label: '规划中', icon: Zap, color: '#60a5fa', bg: 'rgba(96,165,250,0.12)' },
  executing: { label: '执行中', icon: Cpu, color: '#34d399', bg: 'rgba(52,211,153,0.12)' },
  reflecting: { label: '总结中', icon: Brain, color: '#fbbf24', bg: 'rgba(251,191,36,0.12)' },
};

function getToolLabel(name: string): string {
  const labels: Record<string, string> = {
    get_current_time: '获取时间', search_creativity: '搜索创意库', create_creativity: '创建创意',
    update_creativity: '更新创意', delete_creativity: '删除创意', get_creativity_detail: '创意详情',
    list_creativities: '列出创意', tag_creativity: '标签管理', link_creativities: '关联创意',
    create_board: '创建看板', add_to_board: '添加到看板', get_board_overview: '看板概览',
    create_tag: '创建标签', search_tags: '搜索标签', get_popular_tags: '热门标签',
    search_templates: '搜索模板', global_search: '全局搜索', search_by_date_range: '日期搜索',
    get_app_stats: '应用统计', get_recent_edits: '最近编辑', navigate_to_page: '页面导航',
    get_current_context: '界面上下文', show_notification: '显示通知', open_external_url: '打开链接',
    get_music_status: '音乐状态', search_music: '搜索音乐', calculate: '数学计算',
    web_search: '联网搜索', execute_code: '执行代码', read_file: '读取文件', list_directory: '浏览目录',
  };
  return labels[name] || name;
}

const ThinkingText: React.FC<{ text: string; maxHeight?: number }> = ({ text, maxHeight = 120 }) => {
  const containerRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (containerRef.current) {
      containerRef.current.scrollTop = containerRef.current.scrollHeight;
    }
  }, [text]);

  if (!text) return null;

  return (
    <div ref={containerRef} style={{
      fontSize: 12, lineHeight: 1.6,
      color: 'var(--text-secondary)',
      whiteSpace: 'pre-wrap', wordBreak: 'break-word',
      maxHeight, overflowY: 'auto', paddingRight: 4,
    }}>
      {text}
      <span style={{
        display: 'inline-block', width: 2, height: 13,
        background: 'var(--primary-color)',
        marginLeft: 2, verticalAlign: 'text-bottom',
        animation: 'thinking-cursor-blink 1s step-end infinite',
      }} />
    </div>
  );
};

interface ThinkingProcessBubbleProps {
  agentStatus: string;
  agentThinking: string;
  agentSummary: string;
  agentIsRunning: boolean;
  agentModeEnabled: boolean;
  isGenerating: boolean;
  streamingText: string;
  activeToolCalls: Array<{ id: string; name: string; status?: string }>;
  completedToolCalls: Array<{ id: string; name: string; status: string; result?: string }>;
  variant?: 'mini' | 'fullscreen';
}

const ThinkingProcessBubble: React.FC<ThinkingProcessBubbleProps> = ({
  agentStatus,
  agentThinking,
  agentSummary,
  agentIsRunning,
  agentModeEnabled,
  isGenerating,
  streamingText,
  activeToolCalls,
  completedToolCalls,
  variant = 'mini',
}) => {
  const [thinkingExpanded, setThinkingExpanded] = useState(true);
  const [toolsExpanded, setToolsExpanded] = useState(true);

  const isMini = variant === 'mini';
  const config = STATUS_CONFIG[agentStatus] || STATUS_CONFIG.thinking;
  const StatusIcon = config.icon;

  const isAgentThinking = agentModeEnabled && agentIsRunning;
  const isRegularThinking = isGenerating && !streamingText && !agentModeEnabled;
  const hasActiveTools = activeToolCalls.length > 0;
  const hasCompletedTools = completedToolCalls.length > 0;
  const hasAnyTools = hasActiveTools || hasCompletedTools;

  if (!isAgentThinking && !isRegularThinking && !hasAnyTools) return null;

  return (
    <>
      <style>{`
        @keyframes thinking-cursor-blink {
          0%, 100% { opacity: 1; }
          50% { opacity: 0; }
        }
        @keyframes thinking-pulse {
          0%, 100% { opacity: 0.6; }
          50% { opacity: 1; }
        }
        @keyframes thinking-dot {
          0%, 20% { opacity: 0.2; }
          50% { opacity: 1; }
          80%, 100% { opacity: 0.2; }
        }
      `}</style>

      <motion.div
        initial={{ opacity: 0, y: 8 }}
        animate={{ opacity: 1, y: 0 }}
        exit={{ opacity: 0, y: -8 }}
        transition={{ duration: 0.2 }}
        style={{
          margin: isMini ? '6px 10px' : '8px 16px',
          borderRadius: isMini ? 10 : 12,
          border: '1px solid',
          borderColor: isAgentThinking ? `${config.color}30` : 'var(--border-light)',
          background: isAgentThinking
            ? `linear-gradient(135deg, ${config.bg}, ${config.bg.replace('0.12', '0.06')})`
            : 'var(--bg-secondary)',
          overflow: 'hidden',
        }}
      >
        {/* Agent 思考状态 */}
        {isAgentThinking && (
          <>
            <div
              onClick={() => setThinkingExpanded(!thinkingExpanded)}
              style={{
                display: 'flex', alignItems: 'center', gap: 6,
                padding: isMini ? '8px 10px' : '10px 14px',
                cursor: 'pointer', userSelect: 'none',
              }}
            >
              <StatusIcon
                size={isMini ? 13 : 15}
                style={{ color: config.color, animation: 'thinking-pulse 2s ease-in-out infinite', flexShrink: 0 }}
              />
              <span style={{
                fontSize: isMini ? 11 : 13, fontWeight: 600, color: config.color, flex: 1,
              }}>
                {config.label}
              </span>
              {agentSummary && (
                <span style={{
                  fontSize: isMini ? 10 : 11, color: 'var(--text-secondary)',
                  overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap',
                  maxWidth: isMini ? 120 : 200,
                }}>
                  📋 {agentSummary}
                </span>
              )}
              {thinkingExpanded
                ? <ChevronDown size={14} style={{ color: 'var(--text-tertiary)', flexShrink: 0 }} />
                : <ChevronRight size={14} style={{ color: 'var(--text-tertiary)', flexShrink: 0 }} />
              }
            </div>

            <AnimatePresence>
              {thinkingExpanded && agentThinking && (
                <motion.div
                  initial={{ height: 0, opacity: 0 }}
                  animate={{ height: 'auto', opacity: 1 }}
                  exit={{ height: 0, opacity: 0 }}
                  transition={{ duration: 0.2 }}
                  style={{ overflow: 'hidden' }}
                >
                  <div style={{
                    padding: isMini ? '0 10px 8px' : '0 14px 10px',
                    borderTop: `1px solid ${config.color}15`,
                  }}>
                    <ThinkingText text={agentThinking} maxHeight={isMini ? 80 : 150} />
                  </div>
                </motion.div>
              )}
            </AnimatePresence>
          </>
        )}

        {/* 普通聊天思考状态 */}
        {isRegularThinking && (
          <div style={{
            display: 'flex', alignItems: 'center', gap: 8,
            padding: isMini ? '8px 10px' : '10px 14px',
          }}>
            <Brain size={isMini ? 13 : 15} style={{
              color: 'var(--primary-color)',
              animation: 'thinking-pulse 2s ease-in-out infinite',
              flexShrink: 0,
            }} />
            <span style={{
              fontSize: isMini ? 11 : 13, fontWeight: 500, color: 'var(--text-secondary)',
            }}>
              思考中
            </span>
            <div style={{ display: 'flex', gap: 3, marginLeft: 2 }}>
              {[0, 1, 2].map((i) => (
                <div key={i} style={{
                  width: 4, height: 4, borderRadius: '50%',
                  background: 'var(--primary-color)',
                  animation: `thinking-dot 1.4s ease-in-out ${i * 0.2}s infinite`,
                }} />
              ))}
            </div>
          </div>
        )}

        {/* 工具调用可视化 */}
        {hasAnyTools && (
          <div style={{
            borderTop: isAgentThinking ? `1px solid ${config.color}15` : '1px solid var(--border-light)',
          }}>
            <div
              onClick={() => setToolsExpanded(!toolsExpanded)}
              style={{
                display: 'flex', alignItems: 'center', gap: 6,
                padding: isMini ? '6px 10px' : '8px 14px',
                cursor: 'pointer', userSelect: 'none',
              }}
            >
              <Wrench size={isMini ? 11 : 13} style={{ color: 'var(--text-secondary)', flexShrink: 0 }} />
              <span style={{
                fontSize: isMini ? 10 : 12, fontWeight: 500, color: 'var(--text-secondary)', flex: 1,
              }}>
                工具调用 ({activeToolCalls.length + completedToolCalls.length})
              </span>
              {toolsExpanded
                ? <ChevronDown size={12} style={{ color: 'var(--text-tertiary)', flexShrink: 0 }} />
                : <ChevronRight size={12} style={{ color: 'var(--text-tertiary)', flexShrink: 0 }} />
              }
            </div>

            <AnimatePresence>
              {toolsExpanded && (
                <motion.div
                  initial={{ height: 0, opacity: 0 }}
                  animate={{ height: 'auto', opacity: 1 }}
                  exit={{ height: 0, opacity: 0 }}
                  transition={{ duration: 0.15 }}
                  style={{ overflow: 'hidden' }}
                >
                  <div style={{
                    padding: isMini ? '0 10px 8px' : '0 14px 10px',
                    display: 'flex', flexDirection: 'column', gap: 3,
                  }}>
                    {activeToolCalls.map((tc) => (
                      <div key={tc.id} style={{
                        display: 'flex', alignItems: 'center', gap: 5,
                        padding: isMini ? '3px 6px' : '4px 8px',
                        borderRadius: 5, background: 'var(--bg-tertiary)',
                        fontSize: isMini ? 10 : 11,
                      }}>
                        <Loader size={10} style={{
                          color: 'var(--primary-color)',
                          animation: 'thinking-pulse 1.5s ease-in-out infinite',
                          flexShrink: 0,
                        }} />
                        <span style={{ color: 'var(--text-secondary)', fontWeight: 500 }}>
                          {getToolLabel(tc.name)}
                        </span>
                        <span style={{ color: 'var(--text-tertiary)' }}>执行中...</span>
                      </div>
                    ))}
                    {completedToolCalls.map((tc) => (
                      <div key={tc.id} style={{
                        display: 'flex', alignItems: 'center', gap: 5,
                        padding: isMini ? '3px 6px' : '4px 8px',
                        borderRadius: 5, background: 'var(--bg-tertiary)',
                        fontSize: isMini ? 10 : 11,
                      }}>
                        {tc.status === 'error'
                          ? <XCircle size={10} style={{ color: '#ff4d4f', flexShrink: 0 }} />
                          : <CheckCircle size={10} style={{ color: '#52c41a', flexShrink: 0 }} />
                        }
                        <span style={{ color: 'var(--text-secondary)', fontWeight: 500 }}>
                          {getToolLabel(tc.name)}
                        </span>
                        <span style={{ color: tc.status === 'error' ? '#ff4d4f' : 'var(--text-tertiary)' }}>
                          {tc.status === 'completed' ? '完成' : tc.status === 'error' ? '失败' : tc.status}
                        </span>
                      </div>
                    ))}
                  </div>
                </motion.div>
              )}
            </AnimatePresence>
          </div>
        )}
      </motion.div>
    </>
  );
};

export default ThinkingProcessBubble;
