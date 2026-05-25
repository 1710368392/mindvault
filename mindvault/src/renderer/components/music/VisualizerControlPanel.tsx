/**
 * VisualizerControlPanel - UI for controlling visualization effects, themes, and parameters.
 */

import React, { useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import {
  BarChart3, Activity, Circle, Sparkles, Box,
  Maximize2, Camera, Video, VideoOff, ChevronDown, ChevronUp,
  Sun, Moon, Palette, Sliders, X,
} from 'lucide-react';
import { useVisualizerStore } from '../../stores/visualizerStore';
import type { VisualizationMode } from './effects/types';
import { presetThemes } from './themes';
import { isRecordingSupported } from './utils/recording';

interface VisualizerControlPanelProps {
  /** Whether the panel is in fullscreen mode (larger layout) */
  isFullscreen?: boolean;
  /** Callback for taking a screenshot */
  onScreenshot?: () => void;
  /** Callback for toggling recording */
  onToggleRecording?: () => void;
  /** Whether currently recording */
  isRecording?: boolean;
  /** Callback for exiting fullscreen */
  onExitFullscreen?: () => void;
}

const modeOptions: { id: VisualizationMode; name: string; icon: React.ReactNode }[] = [
  { id: 'bars', name: '柱状频谱', icon: <BarChart3 size={16} /> },
  { id: 'wave', name: '波形图', icon: <Activity size={16} /> },
  { id: 'circular', name: '环形频谱', icon: <Circle size={16} /> },
  { id: 'particles', name: '粒子效果', icon: <Sparkles size={16} /> },
  { id: 'cube3d', name: '3D 立方体', icon: <Box size={16} /> },
];

const VisualizerControlPanel: React.FC<VisualizerControlPanelProps> = ({
  isFullscreen = false,
  onScreenshot,
  onToggleRecording,
  isRecording = false,
  onExitFullscreen,
}) => {
  const [isExpanded, setIsExpanded] = useState(true);
  const [showThemePicker, setShowThemePicker] = useState(false);

  const currentMode = useVisualizerStore((s) => s.currentMode);
  const currentThemeId = useVisualizerStore((s) => s.currentThemeId);
  const config = useVisualizerStore((s) => s.config);
  const setMode = useVisualizerStore((s) => s.setMode);
  const setTheme = useVisualizerStore((s) => s.setTheme);
  const updateConfig = useVisualizerStore((s) => s.updateConfig);
  const toggleFullscreen = useVisualizerStore((s) => s.toggleFullscreen);

  const currentTheme = presetThemes.find((t) => t.id === currentThemeId);

  const panelStyle: React.CSSProperties = isFullscreen
    ? {
        position: 'fixed',
        bottom: 20,
        right: 20,
        width: 280,
        background: 'rgba(0, 0, 0, 0.75)',
        backdropFilter: 'blur(20px)',
        borderRadius: 16,
        border: '1px solid rgba(255, 255, 255, 0.1)',
        color: '#fff',
        zIndex: 100,
        overflow: 'hidden',
      }
    : {
        background: 'rgba(0, 0, 0, 0.6)',
        backdropFilter: 'blur(12px)',
        borderRadius: 12,
        border: '1px solid rgba(255, 255, 255, 0.08)',
        color: '#fff',
        overflow: 'hidden',
      };

  return (
    <div style={panelStyle}>
      {/* Header */}
      <div
        style={{
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          padding: '8px 12px',
          cursor: 'pointer',
        }}
        onClick={() => setIsExpanded(!isExpanded)}
      >
        <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
          <Palette size={14} style={{ opacity: 0.7 }} />
          <span style={{ fontSize: 12, fontWeight: 600 }}>可视化控制</span>
        </div>
        <div style={{ display: 'flex', alignItems: 'center', gap: 4 }}>
          {isFullscreen && onExitFullscreen && (
            <motion.button
              whileHover={{ scale: 1.1 }}
              whileTap={{ scale: 0.9 }}
              onClick={(e) => { e.stopPropagation(); onExitFullscreen(); }}
              style={{
                display: 'flex', alignItems: 'center', justifyContent: 'center',
                border: 'none', background: 'none', cursor: 'pointer', color: 'rgba(255,255,255,0.6)',
                padding: 2,
              }}
              title="退出全屏"
            >
              <X size={14} />
            </motion.button>
          )}
          {isExpanded ? <ChevronDown size={14} /> : <ChevronUp size={14} />}
        </div>
      </div>

      <AnimatePresence>
        {isExpanded && (
          <motion.div
            initial={{ height: 0, opacity: 0 }}
            animate={{ height: 'auto', opacity: 1 }}
            exit={{ height: 0, opacity: 0 }}
            transition={{ duration: 0.2 }}
            style={{ overflow: 'hidden' }}
          >
            <div style={{ padding: '0 12px 12px' }}>
              {/* Effect Mode Switcher */}
              <div style={{ marginBottom: 10 }}>
                <div style={{ fontSize: 10, color: 'rgba(255,255,255,0.5)', marginBottom: 6 }}>效果模式</div>
                <div style={{ display: 'flex', gap: 4, flexWrap: 'wrap' }}>
                  {modeOptions.map((opt) => (
                    <motion.button
                      key={opt.id}
                      whileHover={{ scale: 1.05 }}
                      whileTap={{ scale: 0.95 }}
                      onClick={() => setMode(opt.id)}
                      style={{
                        display: 'flex',
                        alignItems: 'center',
                        gap: 4,
                        padding: '4px 8px',
                        borderRadius: 6,
                        border: 'none',
                        cursor: 'pointer',
                        fontSize: 11,
                        fontWeight: 500,
                        background: currentMode === opt.id
                          ? 'rgba(255,255,255,0.2)'
                          : 'rgba(255,255,255,0.05)',
                        color: currentMode === opt.id ? '#fff' : 'rgba(255,255,255,0.6)',
                        transition: 'all 0.15s',
                      }}
                      title={opt.name}
                    >
                      {opt.icon}
                      {isFullscreen && <span>{opt.name}</span>}
                    </motion.button>
                  ))}
                </div>
              </div>

              {/* Theme Picker */}
              <div style={{ marginBottom: 10 }}>
                <div
                  style={{
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'space-between',
                    marginBottom: 6,
                    cursor: 'pointer',
                  }}
                  onClick={() => setShowThemePicker(!showThemePicker)}
                >
                  <div style={{ fontSize: 10, color: 'rgba(255,255,255,0.5)' }}>
                    主题: {currentTheme?.name || '自定义'}
                  </div>
                  {showThemePicker ? <ChevronDown size={10} /> : <ChevronUp size={10} />}
                </div>
                <AnimatePresence>
                  {showThemePicker && (
                    <motion.div
                      initial={{ height: 0, opacity: 0 }}
                      animate={{ height: 'auto', opacity: 1 }}
                      exit={{ height: 0, opacity: 0 }}
                      style={{ overflow: 'hidden' }}
                    >
                      <div style={{ display: 'flex', gap: 4, flexWrap: 'wrap' }}>
                        {presetThemes.map((theme) => (
                          <motion.button
                            key={theme.id}
                            whileHover={{ scale: 1.1 }}
                            whileTap={{ scale: 0.9 }}
                            onClick={() => setTheme(theme.id)}
                            title={theme.name}
                            style={{
                              width: 24,
                              height: 24,
                              borderRadius: 6,
                              border: currentThemeId === theme.id
                                ? '2px solid #fff'
                                : '2px solid transparent',
                              cursor: 'pointer',
                              background: `linear-gradient(135deg, ${theme.colors.primary}, ${theme.colors.secondary})`,
                              transition: 'border 0.15s',
                            }}
                          />
                        ))}
                      </div>
                    </motion.div>
                  )}
                </AnimatePresence>
              </div>

              {/* Parameter Sliders */}
              {isFullscreen && (
                <div style={{ marginBottom: 10 }}>
                  <div style={{ fontSize: 10, color: 'rgba(255,255,255,0.5)', marginBottom: 6 }}>
                    <Sliders size={10} style={{ display: 'inline', marginRight: 4 }} />
                    参数调节
                  </div>
                  <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
                    {[
                      { key: 'sensitivity' as const, label: '灵敏度', min: 0, max: 2, step: 0.1 },
                      { key: 'speed' as const, label: '速度', min: 0.5, max: 3, step: 0.1 },
                      { key: 'intensity' as const, label: '强度', min: 0, max: 1, step: 0.05 },
                      { key: 'glowIntensity' as const, label: '发光', min: 0, max: 1, step: 0.05 },
                    ].map(({ key, label, min, max, step }) => (
                      <div key={key} style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                        <span style={{ fontSize: 10, color: 'rgba(255,255,255,0.5)', width: 36, flexShrink: 0 }}>{label}</span>
                        <input
                          type="range"
                          min={min}
                          max={max}
                          step={step}
                          value={config[key]}
                          onChange={(e) => updateConfig({ [key]: parseFloat(e.target.value) })}
                          style={{
                            flex: 1,
                            height: 3,
                            appearance: 'none',
                            background: 'rgba(255,255,255,0.15)',
                            borderRadius: 2,
                            outline: 'none',
                            cursor: 'pointer',
                          }}
                        />
                        <span style={{ fontSize: 9, color: 'rgba(255,255,255,0.4)', width: 28, textAlign: 'right' }}>
                          {config[key].toFixed(1)}
                        </span>
                      </div>
                    ))}
                    {/* Toggle switches */}
                    <div style={{ display: 'flex', gap: 12 }}>
                      {[
                        { key: 'mirror' as const, label: '镜像' },
                        { key: 'glow' as const, label: '发光' },
                      ].map(({ key, label }) => (
                        <label
                          key={key}
                          style={{
                            display: 'flex',
                            alignItems: 'center',
                            gap: 4,
                            fontSize: 10,
                            color: 'rgba(255,255,255,0.5)',
                            cursor: 'pointer',
                          }}
                        >
                          <input
                            type="checkbox"
                            checked={config[key]}
                            onChange={(e) => updateConfig({ [key]: e.target.checked })}
                            style={{ cursor: 'pointer' }}
                          />
                          {label}
                        </label>
                      ))}
                    </div>
                  </div>
                </div>
              )}

              {/* Action Buttons */}
              <div style={{ display: 'flex', gap: 4, flexWrap: 'wrap' }}>
                {!isFullscreen && (
                  <motion.button
                    whileHover={{ scale: 1.05 }}
                    whileTap={{ scale: 0.95 }}
                    onClick={toggleFullscreen}
                    style={{
                      display: 'flex', alignItems: 'center', gap: 4,
                      padding: '4px 10px', borderRadius: 6,
                      border: 'none', cursor: 'pointer',
                      fontSize: 11, fontWeight: 500,
                      background: 'rgba(255,255,255,0.1)',
                      color: 'rgba(255,255,255,0.8)',
                    }}
                    title="全屏可视化"
                  >
                    <Maximize2 size={14} />
                    全屏
                  </motion.button>
                )}
                {onScreenshot && (
                  <motion.button
                    whileHover={{ scale: 1.05 }}
                    whileTap={{ scale: 0.95 }}
                    onClick={onScreenshot}
                    style={{
                      display: 'flex', alignItems: 'center', gap: 4,
                      padding: '4px 10px', borderRadius: 6,
                      border: 'none', cursor: 'pointer',
                      fontSize: 11, fontWeight: 500,
                      background: 'rgba(255,255,255,0.1)',
                      color: 'rgba(255,255,255,0.8)',
                    }}
                    title="截图"
                  >
                    <Camera size={14} />
                    截图
                  </motion.button>
                )}
                {onToggleRecording && isRecordingSupported() && (
                  <motion.button
                    whileHover={{ scale: 1.05 }}
                    whileTap={{ scale: 0.95 }}
                    onClick={onToggleRecording}
                    style={{
                      display: 'flex', alignItems: 'center', gap: 4,
                      padding: '4px 10px', borderRadius: 6,
                      border: 'none', cursor: 'pointer',
                      fontSize: 11, fontWeight: 500,
                      background: isRecording ? 'rgba(239, 68, 68, 0.3)' : 'rgba(255,255,255,0.1)',
                      color: isRecording ? '#EF4444' : 'rgba(255,255,255,0.8)',
                    }}
                    title={isRecording ? '停止录制' : '开始录制'}
                  >
                    {isRecording ? <VideoOff size={14} /> : <Video size={14} />}
                    {isRecording ? '停止' : '录制'}
                  </motion.button>
                )}
              </div>
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
};

export default VisualizerControlPanel;
