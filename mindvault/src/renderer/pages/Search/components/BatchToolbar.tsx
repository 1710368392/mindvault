import React from 'react';
import { Button, Input } from 'antd';
import { CheckSquare, Square, Heart, Trash2 } from 'lucide-react';
import { motion } from 'framer-motion';

interface BatchToolbarProps {
  selectedCount: number;
  totalCount: number;
  batchTagInput: string;
  onBatchTagInputChange: (value: string) => void;
  onSelectAll: () => void;
  onBatchAddTags: () => void;
  onBatchFavorite: () => void;
  onBatchDelete: () => void;
  onExit: () => void;
}

const BatchToolbar: React.FC<BatchToolbarProps> = ({
  selectedCount,
  totalCount,
  batchTagInput,
  onBatchTagInputChange,
  onSelectAll,
  onBatchAddTags,
  onBatchFavorite,
  onBatchDelete,
  onExit,
}) => {
  return (
    <motion.div
      initial={{ opacity: 0, height: 0 }}
      animate={{ opacity: 1, height: 'auto' }}
      exit={{ opacity: 0, height: 0 }}
      style={{
        marginTop: 12,
        padding: 16,
        background: 'var(--bg-primary)',
        borderRadius: 10,
        border: '1px solid var(--border-color)',
      }}
    >
      <div style={{ display: 'flex', alignItems: 'center', gap: 12, flexWrap: 'wrap' }}>
        <Button
          icon={selectedCount === totalCount ? <CheckSquare size={16} /> : <Square size={16} />}
          onClick={onSelectAll}
        >
          全选 ({selectedCount}/{totalCount})
        </Button>

        <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
          <Input
            placeholder="输入标签，用逗号分隔"
            value={batchTagInput}
            onChange={(e) => onBatchTagInputChange(e.target.value)}
            style={{ width: 200 }}
          />
          <Button onClick={onBatchAddTags} disabled={!batchTagInput.trim()}>
            添加标签
          </Button>
        </div>

        <Button icon={<Heart size={16} />} onClick={onBatchFavorite} disabled={selectedCount === 0}>
          收藏
        </Button>

        <Button
          icon={<Trash2 size={16} />}
          danger
          onClick={onBatchDelete}
          disabled={selectedCount === 0}
        >
          删除
        </Button>

        <Button onClick={onExit}>退出批量</Button>
      </div>
    </motion.div>
  );
};

export default BatchToolbar;
