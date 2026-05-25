import React, { useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { ChevronDown, ChevronRight, Wrench, CheckCircle, XCircle, Loader, Clock } from 'lucide-react';
import type { AIReasoningStep } from '../../../shared/types';

const TOOL_LABELS: Record<string, string> = {
  get_current_time: '获取时间', search_creativity: '搜索创意库', create_creativity: '创建创意',
  update_creativity: '更新创意', delete_creativity: '删除创意', get_creativity_detail: '创意详情',
  read_creativity_full: '查看创意全文', read_creativities: '批量查看创意', scan_creativity_library: '扫描创意库',
  list_creativities: '列出创意', tag_creativity: '标签管理', link_creativities: '关联创意',
  create_board: '创建看板', add_to_board: '添加到看板', get_board_overview: '看板概览',
  create_tag: '创建标签', search_tags: '搜索标签', get_popular_tags: '热门标签',
  batch_create_creativities: '批量创建', smart_edit_creativity: '智能编辑', organize_creativities: '整理创意',
  search_templates: '搜索模板', global_search: '全局搜索', search_by_date_range: '日期搜索',
  get_app_stats: '应用统计', get_recent_edits: '最近编辑', navigate_to_page: '页面导航',
  get_current_context: '界面上下文', show_notification: '显示通知', open_external_url: '打开链接',
  get_music_status: '音乐状态', search_music: '搜索音乐', calculate: '数学计算',
  web_search: '联网搜索', execute_code: '执行代码', read_file: '读取文件', list_directory: '浏览目录',
  run_script: '运行脚本', data_transform: '数据转换', preview_creativity: '预览创意',
  preview_markdown: '预览Markdown', generate_and_preview: '生成并预览', search_and_save: '搜索保存',
  deep_research: '深度研究',
};

function formatDuration(ms?: number): string {
  if (!ms) return '';
  if (ms < 1000) return `${ms}ms`;
  return `${(ms / 1000).toFixed(1)}s`;
}

function truncateJson(obj: any, maxLen = 500): string {
  const str = typeof obj === 'string' ? obj : JSON.stringify(obj, null, 2);
  return str.length > maxLen ? str.substring(0, maxLen) + '...' : str;
}

interface Props {
  step: AIReasoningStep;
  resultStep?: AIReasoningStep;
  isLast?: boolean;
}

const ToolCallItem: React.FC<Props> = ({ step, resultStep, isLast }) => {
  const [inputExpanded, setInputExpanded] = useState(false);
  const [outputExpanded, setOutputExpanded] = useState(false);

  const toolLabel = TOOL_LABELS[step.toolName || ''] || step.toolName || '工具';
  const status = step.toolStatus || 'running';
  const isRunning = status === 'running';
  const isError = status === 'error';

  const StatusIcon = isError ? XCircle : isRunning ? Loader : CheckCircle;
  const statusColor = isError ? '#ef4444' : isRunning ? 'var(--primary-color)' : '#22c55e';

  return (
    <div style={{ display: 'flex', gap: 10, position: 'relative' }}>
      <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', width: 22, flexShrink: 0 }}>
        <div style={{
          width: 22, height: 22, borderRadius: '50%',
          background: isError ? 'rgba(239,68,68,0.1)' : isRunning ? 'rgba(99,102,241,0.1)' : 'rgba(34,197,94,0.1)',
          border: `2px solid ${statusColor}`,
          display: 'flex', alignItems: 'center', justifyContent: 'center',
          color: statusColor, fontSize: 11, zIndex: 1,
        }}>
          <StatusIcon size={11} style={isRunning ? { animation: 'tc-spin 1s linear infinite' } : undefined} />
        </div>
        {!isLast && <div style={{ width: 2, flex: 1, background: 'var(--border-light)', marginTop: 4 }} />}
      </div>

      <div style={{ flex: 1, minWidth: 0, paddingTop: 1, paddingBottom: 6 }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 6, marginBottom: 2 }}>
          <Wrench size={11} style={{ color: '#8B5CF6', flexShrink: 0 }} />
          <span style={{ fontSize: 11, fontWeight: 600, color: '#8B5CF6' }}>{toolLabel}</span>
          {step.duration != null && (
            <span style={{ fontSize: 10, color: 'var(--text-tertiary)', display: 'flex', alignItems: 'center', gap: 2 }}>
              <Clock size={9} />{formatDuration(step.duration)}
            </span>
          )}
          {isRunning && (
            <span style={{ fontSize: 10, color: 'var(--primary-color)' }}>执行中...</span>
          )}
        </div>

        {step.toolInput && Object.keys(step.toolInput).length > 0 && (
          <div style={{ marginTop: 3 }}>
            <button onClick={() => setInputExpanded(!inputExpanded)} style={{
              background: 'none', border: 'none', cursor: 'pointer', fontSize: 10,
              color: 'var(--text-tertiary)', padding: 0, display: 'flex', alignItems: 'center', gap: 3,
            }}>
              {inputExpanded ? <ChevronDown size={10} /> : <ChevronRight size={10} />}
              输入参数
            </button>
            <AnimatePresence>
              {inputExpanded && (
                <motion.div initial={{ height: 0, opacity: 0 }} animate={{ height: 'auto', opacity: 1 }}
                  exit={{ height: 0, opacity: 0 }} transition={{ duration: 0.15 }} style={{ overflow: 'hidden' }}>
                  <pre style={{
                    margin: '4px 0 0', padding: '4px 8px', background: 'var(--bg-tertiary)',
                    borderRadius: 4, fontSize: 10, lineHeight: 1.5, color: 'var(--text-secondary)',
                    overflow: 'auto', maxHeight: 120, whiteSpace: 'pre-wrap', wordBreak: 'break-all',
                  }}>
                    {truncateJson(step.toolInput)}
                  </pre>
                </motion.div>
              )}
            </AnimatePresence>
          </div>
        )}

        {resultStep && (
          <div style={{ marginTop: 3 }}>
            <button onClick={() => setOutputExpanded(!outputExpanded)} style={{
              background: 'none', border: 'none', cursor: 'pointer', fontSize: 10,
              color: resultStep.toolStatus === 'error' ? '#ef4444' : 'var(--text-tertiary)',
              padding: 0, display: 'flex', alignItems: 'center', gap: 3,
            }}>
              {outputExpanded ? <ChevronDown size={10} /> : <ChevronRight size={10} />}
              {resultStep.toolStatus === 'error' ? '错误信息' : '输出结果'}
            </button>
            <AnimatePresence>
              {outputExpanded && (
                <motion.div initial={{ height: 0, opacity: 0 }} animate={{ height: 'auto', opacity: 1 }}
                  exit={{ height: 0, opacity: 0 }} transition={{ duration: 0.15 }} style={{ overflow: 'hidden' }}>
                  <pre style={{
                    margin: '4px 0 0', padding: '4px 8px',
                    background: resultStep.toolStatus === 'error' ? 'rgba(239,68,68,0.06)' : 'var(--bg-tertiary)',
                    borderRadius: 4, fontSize: 10, lineHeight: 1.5,
                    color: resultStep.toolStatus === 'error' ? '#ef4444' : 'var(--text-secondary)',
                    overflow: 'auto', maxHeight: 120, whiteSpace: 'pre-wrap', wordBreak: 'break-all',
                  }}>
                    {truncateJson(resultStep.toolOutput || resultStep.content)}
                  </pre>
                </motion.div>
              )}
            </AnimatePresence>
          </div>
        )}
      </div>

      <style>{`@keyframes tc-spin { to { transform: rotate(360deg); } }`}</style>
    </div>
  );
};

export default ToolCallItem;
