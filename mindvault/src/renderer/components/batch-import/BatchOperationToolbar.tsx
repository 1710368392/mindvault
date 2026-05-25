/**
 * 批量操作工具栏组件
 */

import React, { useState } from 'react';
import { Space, Button, Tooltip, Input, Popover, Dropdown } from 'antd';
import {
  Check,
  X,
  FileText,
  Pencil,
  Plus,
  Sparkles,
  ChevronDown,
} from 'lucide-react';

interface BatchOperationToolbarProps {
  selectedCount: number;
  onBatchKeepTitle: () => void;
  onBatchClearTitle: () => void;
  onFindReplace: () => void;
  onAddPrefixSuffix: () => void;
  onBatchApplyText: (text: string) => void;
  aiFeatures?: boolean;
}

export const BatchOperationToolbar: React.FC<BatchOperationToolbarProps> = ({
  selectedCount,
  onBatchKeepTitle,
  onBatchClearTitle,
  onFindReplace,
  onAddPrefixSuffix,
  onBatchApplyText,
  aiFeatures,
}) => {
  const [additionalText, setAdditionalText] = useState('');
  const [textPopoverVisible, setTextPopoverVisible] = useState(false);

  const handleApplyText = () => {
    onBatchApplyText(additionalText);
    setTextPopoverVisible(false);
  };

  const moreMenuItems = [
    {
      key: 'findReplace',
      icon: <Pencil size={14} />,
      label: '查找替换',
      onClick: onFindReplace,
    },
    {
      key: 'prefixSuffix',
      icon: <Plus size={14} />,
      label: '添加前缀/后缀',
      onClick: onAddPrefixSuffix,
    },
  ];

  const textPopoverContent = (
    <div style={{ width: 300 }}>
      <Input.TextArea
        placeholder="输入要应用到所有项目的附加文本..."
        value={additionalText}
        onChange={(e) => setAdditionalText(e.target.value)}
        rows={4}
        style={{ marginBottom: 12 }}
      />
      <Space style={{ justifyContent: 'flex-end', width: '100%' }}>
        <Button size="small" onClick={() => setTextPopoverVisible(false)}>
          取消
        </Button>
        <Button type="primary" size="small" onClick={handleApplyText}>
          应用
        </Button>
      </Space>
    </div>
  );

  return (
    <div className="batch-operation-toolbar">
      <Space wrap>
        {/* 全选保留标题 */}
        <Tooltip title={selectedCount > 0 ? `应用到选中的 ${selectedCount} 项` : '应用到所有项目'}>
          <Button
            icon={<Check size={14} />}
            onClick={onBatchKeepTitle}
            size="small"
          >
            全选保留标题
          </Button>
        </Tooltip>

        {/* 全选清空标题 */}
        <Tooltip title={selectedCount > 0 ? `应用到选中的 ${selectedCount} 项` : '应用到所有项目'}>
          <Button
            icon={<X size={14} />}
            onClick={onBatchClearTitle}
            size="small"
          >
            全选清空标题
          </Button>
        </Tooltip>

        {/* 应用相同附加文本 */}
        <Popover
          content={textPopoverContent}
          title="应用相同附加文本"
          trigger="click"
          open={textPopoverVisible}
          onOpenChange={setTextPopoverVisible}
          placement="bottomLeft"
        >
          <Button icon={<FileText size={14} />} size="small">
            应用相同附加文本
          </Button>
        </Popover>

        {/* 更多操作 */}
        <Dropdown menu={{ items: moreMenuItems }} placement="bottomLeft">
          <Button size="small">
            更多操作 <ChevronDown size={14} />
          </Button>
        </Dropdown>

        {/* AI功能 */}
        {aiFeatures && (
          <Tooltip title="AI智能处理">
            <Button
              icon={<Sparkles size={14} />}
              size="small"
              type="primary"
              ghost
            >
              AI处理
            </Button>
          </Tooltip>
        )}
      </Space>

      {selectedCount > 0 && (
        <div className="selected-count">
          已选择 <strong>{selectedCount}</strong> 项
        </div>
      )}
    </div>
  );
};

export default BatchOperationToolbar;
