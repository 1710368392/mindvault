// @ts-nocheck
import React, { useEffect, useState, useRef, useMemo } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import {
  Bot,
  CheckCircle,
  XCircle,
  Loader,
  ChevronRight,
  ChevronDown,
  Brain,
  Zap,
  ListChecks,
  Sparkles,
  AlertCircle,
} from 'lucide-react';
import { useAIStore } from '../../stores/aiStore';

/* ------------------------------------------------------------------ */
/*  Status configuration map                                          */
/* ------------------------------------------------------------------ */

const STATUS_CONFIG: Record<
  string,
  { label: string; icon: any; color: string; bg: string }
> = {
  thinking: {
    label: '思考中',
    icon: Brain,
    color: '#a78bfa',
    bg: 'rgba(167,139,250,0.12)',
  },
  planning: {
    label: '规划中',
    icon: ListChecks,
    color: '#60a5fa',
    bg: 'rgba(96,165,250,0.12)',
  },
  executing: {
    label: '执行中',
    icon: Sparkles,
    color: '#34d399',
    bg: 'rgba(52,211,153,0.12)',
  },
  reflecting: {
    label: '反思中',
    icon: Brain,
    color: '#fbbf24',
    bg: 'rgba(251,191,36,0.12)',
  },
  completed: {
    label: '已完成',
    icon: CheckCircle,
    color: '#22c55e',
    bg: 'rgba(34,197,94,0.12)',
  },
  failed: {
    label: '失败',
    icon: AlertCircle,
    color: '#ef4444',
    bg: 'rgba(239,68,68,0.12)',
  },
  cancelled: {
    label: '已取消',
    icon: XCircle,
    color: '#f97316',
    bg: 'rgba(249,115,22,0.12)',
  },
};

/* ------------------------------------------------------------------ */
/*  Step status config                                                */
/* ------------------------------------------------------------------ */

const STEP_STATUS: Record<
  string,
  { icon: any; color: string; spin?: boolean }
> = {
  pending: { icon: ChevronRight, color: '#666' },
  running: { icon: Loader, color: 'var(--primary-color, #6366f1)', spin: true },
  completed: { icon: CheckCircle, color: '#22c55e' },
  failed: { icon: XCircle, color: '#ef4444' },
  skipped: { icon: XCircle, color: '#666' },
};

/* ------------------------------------------------------------------ */
/*  Phase status dot color                                            */
/* ------------------------------------------------------------------ */

const PHASE_DOT_COLOR: Record<string, string> = {
  pending: '#444',
  running: 'var(--primary-color, #6366f1)',
  completed: '#22c55e',
  failed: '#ef4444',
};

/* ------------------------------------------------------------------ */
/*  CSS keyframes (injected once)                                     */
/* ------------------------------------------------------------------ */

const KEYFRAMES = `
@keyframes aoverlay-spin { to { transform: rotate(360deg); } }
@keyframes aoverlay-pulse-border {
  0%, 100% { border-color: rgba(99,102,241,0.25); }
  50% { border-color: rgba(99,102,241,0.7); }
}
@keyframes aoverlay-cursor-blink {
  0%, 100% { opacity: 1; }
  50% { opacity: 0; }
}
@keyframes aoverlay-fade-in {
  from { opacity: 0; transform: translateY(4px); }
  to { opacity: 1; transform: translateY(0); }
}
`;

let styleInjected = false;
function injectStyles() {
  if (styleInjected) return;
  styleInjected = true;
  const id = 'aoverlay-keyframes';
  if (document.getElementById(id)) return;
  const el = document.createElement('style');
  el.id = id;
  el.textContent = KEYFRAMES;
  document.head.appendChild(el);
}

/* ------------------------------------------------------------------ */
/*  ThinkingText - streaming typing animation                         */
/* ------------------------------------------------------------------ */

const ThinkingText: React.FC<{ text: string }> = ({ text }) => {
  const containerRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (containerRef.current) {
      containerRef.current.scrollTop = containerRef.current.scrollHeight;
    }
  }, [text]);

  if (!text) return null;

  return (
    <div
      ref={containerRef}
      style={{
        fontSize: 11,
        lineHeight: 1.6,
        color: 'var(--text-secondary, #aaa)',
        whiteSpace: 'pre-wrap',
        wordBreak: 'break-word',
        maxHeight: 120,
        overflowY: 'auto',
        paddingRight: 4,
      }}
    >
      {text}
      <span
        style={{
          display: 'inline-block',
          width: 2,
          height: 13,
          background: 'var(--primary-color, #6366f1)',
          marginLeft: 2,
          verticalAlign: 'text-bottom',
          animation: 'aoverlay-cursor-blink 1s step-end infinite',
        }}
      />
    </div>
  );
};

/* ------------------------------------------------------------------ */
/*  PhaseProgressBar                                                  */
/* ------------------------------------------------------------------ */

const PhaseProgressBar: React.FC<{ phases: any[] }> = ({ phases }) => {
  if (!phases.length) return null;

  return (
    <div style={{ padding: '8px 14px 4px' }}>
      <div
        style={{
          display: 'flex',
          alignItems: 'center',
          gap: 0,
          width: '100%',
        }}
      >
        {phases.map((phase, idx) => {
          const dotColor = PHASE_DOT_COLOR[phase.status] || '#444';
          const isRunning = phase.status === 'running';
          return (
            <React.Fragment key={idx}>
              {idx > 0 && (
                <div
                  style={{
                    flex: 1,
                    height: 2,
                    background:
                      phase.status === 'pending'
                        ? 'var(--border-color, rgba(255,255,255,0.1))'
                        : '#22c55e',
                    transition: 'background 0.4s',
                  }}
                />
              )}
              <motion.div
                initial={false}
                animate={isRunning ? { scale: [1, 1.3, 1] } : { scale: 1 }}
                transition={
                  isRunning
                    ? { duration: 1.5, repeat: Infinity, ease: 'easeInOut' }
                    : { duration: 0.2 }
                }
                style={{
                  width: 10,
                  height: 10,
                  borderRadius: '50%',
                  background: dotColor,
                  flexShrink: 0,
                  boxShadow: isRunning
                    ? `0 0 8px ${dotColor}`
                    : 'none',
                  transition: 'background 0.3s, box-shadow 0.3s',
                }}
                title={phase.name}
              />
            </React.Fragment>
          );
        })}
      </div>
      {/* Phase labels */}
      <div
        style={{
          display: 'flex',
          justifyContent: 'space-between',
          marginTop: 6,
        }}
      >
        {phases.map((phase, idx) => {
          const isRunning = phase.status === 'running';
          return (
            <span
              key={idx}
              style={{
                fontSize: 9,
                color: isRunning
                  ? 'var(--primary-color, #6366f1)'
                  : 'var(--text-tertiary, #666)',
                fontWeight: isRunning ? 600 : 400,
                transition: 'color 0.3s',
                textAlign: 'center',
                flex: 1,
              }}
            >
              {phase.name}
            </span>
          );
        })}
      </div>
    </div>
  );
};

/* ------------------------------------------------------------------ */
/*  StepItem                                                          */
/* ------------------------------------------------------------------ */

const StepItem: React.FC<{
  step: any;
  stepThinking: string;
}> = ({ step, stepThinking }) => {
  const [showThinking, setShowThinking] = useState(false);
  const cfg = STEP_STATUS[step.status] || STEP_STATUS.pending;
  const Icon = cfg.icon;
  const isRunning = step.status === 'running';

  return (
    <motion.div
      initial={{ opacity: 0, y: 6 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.2 }}
      style={{
        display: 'flex',
        alignItems: 'flex-start',
        gap: 8,
        padding: '7px 8px',
        marginBottom: 2,
        borderRadius: 6,
        border: isRunning
          ? '1px solid rgba(99,102,241,0.35)'
          : '1px solid transparent',
        background: isRunning
          ? 'rgba(99,102,241,0.06)'
          : 'transparent',
        animation: isRunning
          ? 'aoverlay-pulse-border 2s ease-in-out infinite'
          : 'none',
        transition: 'border-color 0.3s, background 0.3s',
      }}
    >
      {/* Status icon */}
      <div style={{ marginTop: 1, flexShrink: 0 }}>
        <Icon
          size={13}
          style={{
            color: cfg.color,
            animation: cfg.spin ? 'aoverlay-spin 1s linear infinite' : 'none',
          }}
        />
      </div>

      {/* Content */}
      <div style={{ flex: 1, minWidth: 0 }}>
        {/* Goal line */}
        <div
          style={{
            display: 'flex',
            alignItems: 'center',
            gap: 4,
            fontSize: 12,
            color: 'var(--text-primary, #fff)',
            lineHeight: 1.4,
          }}
        >
          {step.canParallel && (
            <Zap
              size={11}
              style={{ color: '#fbbf24', flexShrink: 0 }}
              title="可并行执行"
            />
          )}
          <span style={{ overflow: 'hidden', textOverflow: 'ellipsis' }}>
            {step.goal}
          </span>
        </div>

        {/* Tool name */}
        {step.toolName && (
          <div
            style={{
              fontSize: 10,
              color: 'var(--text-tertiary, #888)',
              marginTop: 2,
            }}
          >
            {step.toolName}
          </div>
        )}

        {/* Result preview */}
        {step.result && (
          <div
            style={{
              fontSize: 11,
              color: 'var(--text-secondary, #aaa)',
              marginTop: 4,
              padding: '3px 7px',
              background: 'rgba(255,255,255,0.04)',
              borderRadius: 4,
              maxHeight: 48,
              overflow: 'hidden',
              textOverflow: 'ellipsis',
              whiteSpace: 'nowrap',
            }}
          >
            {step.result.length > 120
              ? step.result.substring(0, 120) + '...'
              : step.result}
          </div>
        )}

        {/* Error */}
        {step.error && (
          <div
            style={{
              fontSize: 11,
              color: '#ef4444',
              marginTop: 4,
            }}
          >
            {step.error}
          </div>
        )}

        {/* Step thinking (collapsible) */}
        {isRunning && stepThinking && (
          <div style={{ marginTop: 4 }}>
            <button
              onClick={() => setShowThinking((v) => !v)}
              style={{
                background: 'none',
                border: 'none',
                cursor: 'pointer',
                fontSize: 10,
                color: 'var(--primary-color, #6366f1)',
                padding: 0,
                display: 'flex',
                alignItems: 'center',
                gap: 3,
              }}
            >
              <Brain size={10} />
              {showThinking ? '收起思考' : '查看思考'}
              <ChevronDown
                size={10}
                style={{
                  transform: showThinking ? 'rotate(180deg)' : 'rotate(0)',
                  transition: 'transform 0.2s',
                }}
              />
            </button>
            <AnimatePresence>
              {showThinking && (
                <motion.div
                  initial={{ height: 0, opacity: 0 }}
                  animate={{ height: 'auto', opacity: 1 }}
                  exit={{ height: 0, opacity: 0 }}
                  transition={{ duration: 0.15 }}
                  style={{ overflow: 'hidden' }}
                >
                  <ThinkingText text={stepThinking} />
                </motion.div>
              )}
            </AnimatePresence>
          </div>
        )}
      </div>
    </motion.div>
  );
};

/* ------------------------------------------------------------------ */
/*  StepsGroupedByPhase                                               */
/* ------------------------------------------------------------------ */

const StepsGroupedByPhase: React.FC<{
  phases: any[];
  steps: any[];
  stepThinkingMap: Record<string, string>;
}> = ({ phases, steps, stepThinkingMap }) => {
  const scrollRef = useRef<HTMLDivElement>(null);

  // Group steps by phaseIndex
  const grouped = useMemo(() => {
    const map = new Map<number, any[]>();
    steps.forEach((s) => {
      const key = s.phaseIndex ?? 0;
      if (!map.has(key)) map.set(key, []);
      map.get(key)!.push(s);
    });
    return map;
  }, [steps]);

  // Auto-scroll to running step
  useEffect(() => {
    const running = steps.find((s) => s.status === 'running');
    if (running && scrollRef.current) {
      const el = scrollRef.current.querySelector(
        `[data-step-id="${running.id}"]`
      );
      if (el) {
        el.scrollIntoView({ behavior: 'smooth', block: 'nearest' });
      }
    }
  }, [steps]);

  if (!phases.length && !steps.length) return null;

  return (
    <div
      ref={scrollRef}
      style={{
        maxHeight: 260,
        overflowY: 'auto',
        padding: '4px 6px 8px',
        scrollbarWidth: 'thin',
        scrollbarColor: 'rgba(255,255,255,0.1) transparent',
      }}
    >
      {phases.map((phase, pIdx) => {
        const phaseSteps = grouped.get(pIdx) || [];
        if (phaseSteps.length === 0) return null;

        return (
          <div key={pIdx} style={{ marginBottom: 6 }}>
            {/* Phase header */}
            <div
              style={{
                fontSize: 10,
                fontWeight: 600,
                color:
                  phase.status === 'running'
                    ? 'var(--primary-color, #6366f1)'
                    : phase.status === 'completed'
                    ? '#22c55e'
                    : 'var(--text-tertiary, #666)',
                textTransform: 'uppercase',
                letterSpacing: 0.5,
                padding: '4px 8px 2px',
                transition: 'color 0.3s',
              }}
            >
              {phase.name}
            </div>
            {phaseSteps.map((step) => (
              <div key={step.id} data-step-id={step.id}>
                <StepItem
                  step={step}
                  stepThinking={stepThinkingMap[step.id] || ''}
                />
              </div>
            ))}
          </div>
        );
      })}

      {/* Steps without phases */}
      {phases.length === 0 &&
        steps.map((step) => (
          <div key={step.id} data-step-id={step.id}>
            <StepItem
              step={step}
              stepThinking={stepThinkingMap[step.id] || ''}
            />
          </div>
        ))}
    </div>
  );
};

/* ------------------------------------------------------------------ */
/*  ToolCallItem (kept for non-agent mode)                            */
/* ------------------------------------------------------------------ */

const ToolCallItem: React.FC<{ toolCall: any }> = ({ toolCall }) => {
  const isCompleted = toolCall.status === 'completed';
  const isError = toolCall.status === 'error';

  return (
    <div
      style={{
        display: 'flex',
        alignItems: 'flex-start',
        gap: 8,
        padding: '6px 0',
        borderBottom:
          '1px solid var(--border-color, rgba(255,255,255,0.04))',
      }}
    >
      <div style={{ marginTop: 2 }}>
        {isCompleted ? (
          <CheckCircle size={14} style={{ color: '#22c55e' }} />
        ) : isError ? (
          <XCircle size={14} style={{ color: '#ef4444' }} />
        ) : (
          <Loader
            size={14}
            style={{
              color: '#6366f1',
              animation: 'aoverlay-spin 1s linear infinite',
            }}
          />
        )}
      </div>
      <div style={{ flex: 1, minWidth: 0 }}>
        <div
          style={{ fontSize: 12, color: 'var(--text-primary, #fff)' }}
        >
          {toolCall.name}
        </div>
        {toolCall.result && (
          <div
            style={{
              fontSize: 11,
              color: 'var(--text-secondary, #aaa)',
              marginTop: 2,
              maxHeight: 40,
              overflow: 'hidden',
              textOverflow: 'ellipsis',
            }}
          >
            {toolCall.result.substring(0, 100)}
            {toolCall.result.length > 100 ? '...' : ''}
          </div>
        )}
      </div>
    </div>
  );
};

/* ------------------------------------------------------------------ */
/*  AIActionOverlay - main component                                  */
/* ------------------------------------------------------------------ */

export const AIActionOverlay: React.FC = () => {
  const {
    isGenerating,
    activeToolCalls,
    completedToolCalls,
    agentIsRunning,
    agentSteps,
    agentPhases,
    agentModeEnabled,
    agentStatus,
    agentThinking,
    agentSummary,
    agentStepThinking,
    cancelAgentTask,
  } = useAIStore();

  const [isVisible, setIsVisible] = useState(false);
  const [expanded, setExpanded] = useState(true);
  const [thinkingOpen, setThinkingOpen] = useState(true);

  // Inject keyframes on first render
  useEffect(() => {
    injectStyles();
  }, []);

  // Show overlay when there are active operations
  useEffect(() => {
    const hasActive = activeToolCalls.length > 0 || agentIsRunning;
    setIsVisible(hasActive);
  }, [activeToolCalls.length, agentIsRunning]);

  // Auto-hide completed operations after 3s
  useEffect(() => {
    if (!isGenerating && !agentIsRunning && completedToolCalls.length > 0) {
      const timer = setTimeout(() => setIsVisible(false), 3000);
      return () => clearTimeout(timer);
    }
  }, [isGenerating, agentIsRunning, completedToolCalls.length]);

  if (!isVisible) return null;

  const isAgent = agentModeEnabled && agentIsRunning;
  const statusCfg = STATUS_CONFIG[agentStatus] || STATUS_CONFIG.thinking;
  const StatusIcon = statusCfg.icon;
  const completedCount = agentSteps.filter(
    (s: any) => s.status === 'completed'
  ).length;

  return (
    <AnimatePresence>
      <motion.div
        initial={{ opacity: 0, x: 40, scale: 0.95 }}
        animate={{ opacity: 1, x: 0, scale: 1 }}
        exit={{ opacity: 0, x: 40, scale: 0.95 }}
        transition={{ duration: 0.25, ease: 'easeOut' }}
        style={{
          position: 'fixed',
          top: 60,
          right: 16,
          zIndex: 1000,
          width: 360,
          maxHeight: '70vh',
          display: 'flex',
          flexDirection: 'column',
          background: 'var(--bg-secondary, #1a1a2e)',
          borderRadius: 12,
          border: '1px solid var(--border-color, rgba(255,255,255,0.1))',
          boxShadow:
            '0 8px 32px rgba(0,0,0,0.35), 0 0 0 1px rgba(255,255,255,0.03)',
          overflow: 'hidden',
        }}
      >
        {/* ---------- Header ---------- */}
        <div
          style={{
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
            padding: '10px 14px',
            borderBottom:
              '1px solid var(--border-color, rgba(255,255,255,0.08))',
            cursor: 'pointer',
            flexShrink: 0,
          }}
          onClick={() => setExpanded((v) => !v)}
        >
          <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
            <Bot
              size={16}
              style={{ color: 'var(--primary-color, #6366f1)' }}
            />
            <span
              style={{
                fontSize: 13,
                fontWeight: 600,
                color: 'var(--text-primary, #fff)',
              }}
            >
              {isAgent ? 'Agent 执行中' : 'AI 正在操作'}
            </span>

            {/* Agent status badge */}
            {isAgent && agentStatus && (
              <motion.span
                key={agentStatus}
                initial={{ opacity: 0, scale: 0.8 }}
                animate={{ opacity: 1, scale: 1 }}
                style={{
                  display: 'inline-flex',
                  alignItems: 'center',
                  gap: 4,
                  fontSize: 10,
                  fontWeight: 500,
                  color: statusCfg.color,
                  background: statusCfg.bg,
                  padding: '2px 7px',
                  borderRadius: 10,
                }}
              >
                <StatusIcon
                  size={10}
                  style={{
                    animation:
                      agentStatus === 'thinking' ||
                      agentStatus === 'executing'
                        ? 'aoverlay-spin 1.2s linear infinite'
                        : 'none',
                  }}
                />
                {statusCfg.label}
              </motion.span>
            )}

            {/* Spinner for non-agent generating */}
            {!isAgent && isGenerating && (
              <Loader
                size={14}
                style={{
                  color: 'var(--primary-color, #6366f1)',
                  animation: 'aoverlay-spin 1s linear infinite',
                }}
              />
            )}
          </div>

          <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
            {/* Cancel button */}
            {isAgent && (
              <motion.button
                whileHover={{ scale: 1.08 }}
                whileTap={{ scale: 0.92 }}
                onClick={(e) => {
                  e.stopPropagation();
                  cancelAgentTask();
                }}
                style={{
                  background: 'rgba(239,68,68,0.15)',
                  border: '1px solid rgba(239,68,68,0.3)',
                  borderRadius: 6,
                  padding: '3px 10px',
                  cursor: 'pointer',
                  color: '#ef4444',
                  fontSize: 11,
                  fontWeight: 500,
                  transition: 'background 0.2s',
                }}
              >
                取消任务
              </motion.button>
            )}
            <ChevronRight
              size={14}
              style={{
                color: 'var(--text-tertiary, #888)',
                transform: expanded
                  ? 'rotate(90deg)'
                  : 'rotate(0deg)',
                transition: 'transform 0.2s',
              }}
            />
          </div>
        </div>

        {/* ---------- Body ---------- */}
        <AnimatePresence>
          {expanded && (
            <motion.div
              initial={{ height: 0, opacity: 0 }}
              animate={{ height: 'auto', opacity: 1 }}
              exit={{ height: 0, opacity: 0 }}
              transition={{ duration: 0.2 }}
              style={{ overflow: 'hidden', flex: 1, minHeight: 0 }}
            >
              {/* ---- Agent mode content ---- */}
              {isAgent && (
                <div
                  style={{
                    display: 'flex',
                    flexDirection: 'column',
                    overflow: 'hidden',
                    flex: 1,
                  }}
                >
                  {/* Task summary */}
                  {agentSummary && (
                    <div
                      style={{
                        padding: '8px 14px',
                        fontSize: 12,
                        color: 'var(--text-secondary, #aaa)',
                        borderBottom:
                          '1px solid var(--border-color, rgba(255,255,255,0.06))',
                        lineHeight: 1.5,
                      }}
                    >
                      {agentSummary}
                    </div>
                  )}

                  {/* Thinking section */}
                  <AnimatePresence>
                    {agentStatus === 'thinking' && agentThinking && (
                      <motion.div
                        initial={{ height: 0, opacity: 0 }}
                        animate={{ height: 'auto', opacity: 1 }}
                        exit={{ height: 0, opacity: 0 }}
                        transition={{ duration: 0.2 }}
                        style={{ overflow: 'hidden' }}
                      >
                        <div
                          style={{
                            margin: '6px 10px',
                            borderRadius: 8,
                            background:
                              'linear-gradient(135deg, rgba(99,102,241,0.08) 0%, rgba(139,92,246,0.05) 100%)',
                            border:
                              '1px solid rgba(99,102,241,0.12)',
                            overflow: 'hidden',
                          }}
                        >
                          {/* Thinking header */}
                          <button
                            onClick={() =>
                              setThinkingOpen((v) => !v)
                            }
                            style={{
                              display: 'flex',
                              alignItems: 'center',
                              gap: 6,
                              width: '100%',
                              padding: '6px 10px',
                              background: 'none',
                              border: 'none',
                              cursor: 'pointer',
                              color: 'var(--primary-color, #6366f1)',
                              fontSize: 11,
                              fontWeight: 500,
                            }}
                          >
                            <Brain size={12} />
                            思考过程
                            <ChevronDown
                              size={10}
                              style={{
                                marginLeft: 'auto',
                                transform: thinkingOpen
                                  ? 'rotate(180deg)'
                                  : 'rotate(0)',
                                transition:
                                  'transform 0.2s',
                              }}
                            />
                          </button>
                          {/* Thinking body */}
                          <AnimatePresence>
                            {thinkingOpen && (
                              <motion.div
                                initial={{
                                  height: 0,
                                  opacity: 0,
                                }}
                                animate={{
                                  height: 'auto',
                                  opacity: 1,
                                }}
                                exit={{
                                  height: 0,
                                  opacity: 0,
                                }}
                                transition={{
                                  duration: 0.15,
                                }}
                                style={{
                                  overflow: 'hidden',
                                  padding: '0 10px 8px',
                                }}
                              >
                                <ThinkingText
                                  text={agentThinking}
                                />
                              </motion.div>
                            )}
                          </AnimatePresence>
                        </div>
                      </motion.div>
                    )}
                  </AnimatePresence>

                  {/* Phase progress bar */}
                  {agentPhases.length > 0 && (
                    <PhaseProgressBar phases={agentPhases} />
                  )}

                  {/* Steps counter */}
                  {agentSteps.length > 0 && (
                    <div
                      style={{
                        padding: '6px 14px 2px',
                        fontSize: 10,
                        color: 'var(--text-tertiary, #666)',
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'space-between',
                      }}
                    >
                      <span>
                        步骤进度 {completedCount}/{agentSteps.length}
                      </span>
                      {agentSteps.some((s: any) => s.canParallel) && (
                        <span
                          style={{
                            display: 'flex',
                            alignItems: 'center',
                            gap: 3,
                            color: '#fbbf24',
                          }}
                        >
                          <Zap size={10} />
                          含并行步骤
                        </span>
                      )}
                    </div>
                  )}

                  {/* Steps grouped by phase */}
                  <StepsGroupedByPhase
                    phases={agentPhases}
                    steps={agentSteps}
                    stepThinkingMap={agentStepThinking}
                  />
                </div>
              )}

              {/* ---- Non-agent tool calls ---- */}
              {!isAgent && (
                <div style={{ padding: '8px 14px' }}>
                  <div
                    style={{
                      fontSize: 11,
                      color: 'var(--text-tertiary, #888)',
                      marginBottom: 6,
                    }}
                  >
                    工具调用
                  </div>
                  {[...activeToolCalls, ...completedToolCalls.slice(-5)].map(
                    (tc: any) => (
                      <ToolCallItem key={tc.id} toolCall={tc} />
                    )
                  )}
                </div>
              )}
            </motion.div>
          )}
        </AnimatePresence>
      </motion.div>
    </AnimatePresence>
  );
};

export default AIActionOverlay;
