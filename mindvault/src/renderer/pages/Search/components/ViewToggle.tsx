import React from 'react';
import { VIEW_MODES } from '../constants';
import type { ViewMode } from '../types';

interface ViewToggleProps {
  viewMode: ViewMode;
  onChange: (mode: ViewMode) => void;
}

const ViewToggle: React.FC<ViewToggleProps> = ({ viewMode, onChange }) => {
  return (
    <div style={{
      display: 'flex',
      background: 'var(--bg-primary)',
      borderRadius: 10,
      padding: 4,
      border: '1px solid var(--border-color)',
    }}>
      {VIEW_MODES.map((mode) => (
        <button
          key={mode.value}
          onClick={() => {
            onChange(mode.value as ViewMode);
            localStorage.setItem('searchViewMode', mode.value);
          }}
          style={{
            padding: '8px 16px',
            borderRadius: 8,
            border: 'none',
            background: viewMode === mode.value ? 'var(--primary-color)' : 'transparent',
            color: viewMode === mode.value ? 'white' : 'var(--text-secondary)',
            cursor: 'pointer',
            fontSize: 13,
            fontWeight: 500,
            transition: 'all 0.2s ease',
          }}
        >
          {mode.label}
        </button>
      ))}
    </div>
  );
};

export default ViewToggle;
