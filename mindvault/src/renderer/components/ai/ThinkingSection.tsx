import React from 'react';
import { ReasoningPanel } from './ReasoningPanel';
import type { AIReasoningStep } from '../../../shared/types';

interface ThinkingSectionProps {
  steps: AIReasoningStep[];
  isThinking: boolean;
  collapsed?: boolean;
  onToggleCollapse?: () => void;
  variant?: 'default' | 'mini';
}

const ThinkingSection: React.FC<ThinkingSectionProps> = ({
  steps, isThinking, collapsed, onToggleCollapse, variant = 'default',
}) => {
  if (steps.length === 0 && !isThinking) return null;
  return (
    <ReasoningPanel
      steps={steps}
      isThinking={isThinking}
      collapsed={collapsed}
      onToggleCollapse={onToggleCollapse}
      autoCollapse={true}
      variant={variant}
    />
  );
};

export default ThinkingSection;
