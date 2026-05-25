import React, { useState, useEffect, useRef } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import {
  Brain, ChevronDown, ChevronUp, Sparkles, Search, Wrench,
  Lightbulb, RotateCcw, CheckCircle2, Clock,
} from 'lucide-react';
import type { AIReasoningStep } from '../../../shared/types';
import ToolCallItem from './ToolCallItem';

const stepTypeConfig: Record<AIReasoningStep['type'], { icon: React.ReactNode; label: string; color: string; bgColor: string }> = {
  thinking: { icon: <Brain size={14} />, label: '思考', color: '#3B82F6', bgColor: 'rgba(59,130,246,0.1)' },
  tool_call: { icon: <Wrench size={14} />, label: '调用工具', color: '#8B5CF6', bgColor: 'rgba(139,92,246,0.1)' },
  tool_result: { icon: <CheckCircle2 size={14} />, label: '工具返回', color: '#10B981', bgColor: 'rgba(16,185,129,0.1)' },
  analysis: { icon: <Search size={14} />, label: '分析', color: '#F59E0B', bgColor: 'rgba(245,158,11,0.1)' },
  planning: { icon: <Lightbulb size={14} />, label: '规划', color: '#EC4899', bgColor: 'rgba(236,72,153,0.1)' },
  reflection: { icon: <RotateCcw size={14} />, label: '反思', color: '#6B7280', bgColor: 'rgba(107,114,128,0.1)' },
};

function formatDuration(ms?: number): string {
  if (!ms) return '';
  if (ms < 1000) return `${ms}ms`;
  return `${(ms / 1000).toFixed(1)}s`;
}

function formatTime(ts: number): string {
  const d = new Date(ts);
  return `${d.getHours().toString().padStart(2, '0')}:${d.getMinutes().toString().padStart(2, '0')}:${d.getSeconds().toString().padStart(2, '0')}`;
}

const StreamingText: React.FC<{ text: string }> = ({ text }) => {
  const ref = useRef<HTMLDivElement>(null);
  useEffect(() => {
    if (ref.current) ref.current.scrollTop = ref.current.scrollHeight;
  }, [text]);
  if (!text) return null;
  return (
    <div ref={ref} style={{
      fontSize: 12, lineHeight: 1.6, color: 'var(--text-secondary)',
      whiteSpace: 'pre-wrap', wordBreak: 'break-word',
      maxHeight: 120, overflowY: 'auto', paddingRight: 4,
    }}>
      {text}
      <span style={{
        display: 'inline-block', width: 2, height: 13,
        background: 'var(--primary-color)', marginLeft: 2, verticalAlign: 'text-bottom',
        animation: 'rp-cursor-blink 1s step-end infinite',
      }} />
    </div>
  );
};

interface ReasoningPanelProps {
  steps: AIReasoningStep[];
  isThinking: boolean;
  collapsed?: boolean;
  onToggleCollapse?: () => void;
  autoCollapse?: boolean;
  variant?: 'default' | 'mini';
}

export const ReasoningPanel: React.FC<ReasoningPanelProps> = ({
  steps, isThinking, collapsed: initialCollapsed = false,
  onToggleCollapse, autoCollapse = true, variant = 'default',
}) => {
  const [isCollapsed, setIsCollapsed] = useState(initialCollapsed);
  const [hasAutoCollapsed, setHasAutoCollapsed] = useState(false);
  const isMini = variant === 'mini';

  useEffect(() => {
    if (autoCollapse && !isThinking && steps.length > 0 && !hasAutoCollapsed) {
      setIsCollapsed(true);
      setHasAutoCollapsed(true);
    }
  }, [isThinking, steps.length, autoCollapse, hasAutoCollapsed]);

  useEffect(() => {
    if (isThinking) { setHasAutoCollapsed(false); setIsCollapsed(false); }
  }, [isThinking]);

  const handleToggle = () => {
    setIsCollapsed(!isCollapsed);
    onToggleCollapse?.();
  };

  if (steps.length === 0) return null;

  const totalDuration = steps.reduce((sum, s) => sum + (s.duration || 0), 0);
  const nonToolResultSteps = steps.filter((s) => s.type !== 'tool_result');
  const toolResultMap = new Map<string, AIReasoningStep>();
  steps.filter((s) => s.type === 'tool_result').forEach((s) => {
    const parent = steps.find((p) => p.type === 'tool_call' && p.toolStatus !== 'running');
    if (parent) toolResultMap.set(parent.id, s);
  });

  return (
    <>
      <style>{`@keyframes rp-cursor-blink { 0%,100%{opacity:1} 50%{opacity:0} }`}</style>
      <div style={{
        margin: isMini ? '4px 0' : '8px 0', borderRadius: isMini ? 8 : 10,
        border: '1px solid var(--border-light)', background: 'var(--bg-secondary)', overflow: 'hidden',
      }}>
        <button onClick={handleToggle} style={{
          width: '100%', padding: isMini ? '7px 10px' : '10px 14px',
          display: 'flex', alignItems: 'center', justifyContent: 'space-between',
          border: 'none', background: 'transparent', cursor: 'pointer', color: 'var(--text-primary)',
        }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
            <div style={{
              width: isMini ? 20 : 24, height: isMini ? 20 : 24, borderRadius: 6,
              background: isThinking ? 'rgba(59,130,246,0.15)' : 'rgba(16,185,129,0.15)',
              display: 'flex', alignItems: 'center', justifyContent: 'center',
              color: isThinking ? '#3B82F6' : '#10B981',
            }}>
              {isThinking ? (
                <motion.div animate={{ rotate: 360 }} transition={{ duration: 2, repeat: Infinity, ease: 'linear' }}>
                  <Sparkles size={isMini ? 12 : 14} />
                </motion.div>
              ) : <CheckCircle2 size={isMini ? 12 : 14} />}
            </div>
            <span style={{ fontSize: isMini ? 11 : 13, fontWeight: 500 }}>
              {isThinking ? '正在思考...' : `思考过程 (${steps.length}步)`}
            </span>
            {totalDuration > 0 && (
              <span style={{ fontSize: 10, color: 'var(--text-tertiary)' }}>· {formatDuration(totalDuration)}</span>
            )}
            {isThinking && (
              <motion.span animate={{ opacity: [0.5, 1, 0.5] }} transition={{ duration: 1.5, repeat: Infinity }}
                style={{ fontSize: 11, color: 'var(--text-tertiary)', marginLeft: 4 }}>●</motion.span>
            )}
          </div>
          <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
            <span style={{ fontSize: 10, color: 'var(--text-tertiary)' }}>{isCollapsed ? '展开' : '收起'}</span>
            {isCollapsed ? <ChevronDown size={14} color="var(--text-tertiary)" /> : <ChevronUp size={14} color="var(--text-tertiary)" />}
          </div>
        </button>

        <AnimatePresence>
          {!isCollapsed && (
            <motion.div initial={{ height: 0, opacity: 0 }} animate={{ height: 'auto', opacity: 1 }}
              exit={{ height: 0, opacity: 0 }} transition={{ duration: 0.2 }} style={{ overflow: 'hidden' }}>
              <div style={{ padding: isMini ? '0 10px 8px' : '0 14px 14px', display: 'flex', flexDirection: 'column', gap: 6 }}>
                {nonToolResultSteps.map((step, index) => {
                  if (step.type === 'tool_call') {
                    const resultStep = toolResultMap.get(step.id);
                    return (
                      <ToolCallItem key={step.id} step={step} resultStep={resultStep}
                        isLast={index === nonToolResultSteps.length - 1} />
                    );
                  }

                  const config = stepTypeConfig[step.type];
                  const isLast = index === nonToolResultSteps.length - 1;

                  return (
                    <motion.div key={step.id} initial={{ opacity: 0, x: -10 }} animate={{ opacity: 1, x: 0 }}
                      transition={{ delay: index * 0.03 }} style={{ display: 'flex', gap: 10, position: 'relative' }}>
                      <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', width: 22, flexShrink: 0 }}>
                        <div style={{
                          width: 22, height: 22, borderRadius: '50%', background: config.bgColor,
                          border: `2px solid ${config.color}`, display: 'flex', alignItems: 'center',
                          justifyContent: 'center', color: config.color, fontSize: 11, zIndex: 1,
                        }}>{config.icon}</div>
                        {!isLast && <div style={{ width: 2, flex: 1, background: 'var(--border-light)', marginTop: 4 }} />}
                      </div>
                      <div style={{ flex: 1, minWidth: 0, paddingTop: 2, paddingBottom: 4 }}>
                        <div style={{ display: 'flex', alignItems: 'center', gap: 6, marginBottom: 3 }}>
                          <span style={{ fontSize: 11, fontWeight: 600, color: config.color }}>{config.label}</span>
                          <span style={{ fontSize: 10, color: 'var(--text-tertiary)', display: 'flex', alignItems: 'center', gap: 2 }}>
                            <Clock size={9} />{formatTime(step.timestamp)}
                          </span>
                          {step.duration != null && step.duration > 0 && (
                            <span style={{ fontSize: 10, color: 'var(--text-tertiary)' }}>{formatDuration(step.duration)}</span>
                          )}
                        </div>
                        {step.isStreaming ? (
                          <StreamingText text={step.content} />
                        ) : (
                          <div style={{
                            fontSize: 12, color: 'var(--text-secondary)', lineHeight: 1.5,
                            whiteSpace: 'pre-wrap', wordBreak: 'break-word',
                            maxHeight: 120, overflow: 'hidden',
                          }}>{step.content}</div>
                        )}
                      </div>
                    </motion.div>
                  );
                })}

                {isThinking && (
                  <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }}
                    style={{ display: 'flex', alignItems: 'center', gap: 8, padding: '6px 0', color: 'var(--text-tertiary)', fontSize: 12 }}>
                    <motion.div animate={{ scale: [1, 1.2, 1] }} transition={{ duration: 1, repeat: Infinity }}>
                      <Sparkles size={14} />
                    </motion.div>
                    <span>继续思考中...</span>
                  </motion.div>
                )}
              </div>
            </motion.div>
          )}
        </AnimatePresence>
      </div>
    </>
  );
};

export default ReasoningPanel;
