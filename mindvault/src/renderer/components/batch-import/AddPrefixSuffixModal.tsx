/**
 * 添加前缀/后缀模态框组件
 */

import React, { useState } from 'react';
import { Modal, Input, Space } from 'antd';
import { Plus } from 'lucide-react';

interface AddPrefixSuffixModalProps {
  visible: boolean;
  onCancel: () => void;
  onConfirm: (prefix: string, suffix: string) => void;
}

export const AddPrefixSuffixModal: React.FC<AddPrefixSuffixModalProps> = ({
  visible,
  onCancel,
  onConfirm,
}) => {
  const [prefix, setPrefix] = useState('');
  const [suffix, setSuffix] = useState('');

  const handleConfirm = () => {
    onConfirm(prefix.trim(), suffix.trim());
    // 重置状态
    setPrefix('');
    setSuffix('');
  };

  const handleCancel = () => {
    onCancel();
    // 重置状态
    setPrefix('');
    setSuffix('');
  };

  // 预览效果
  const previewTitle = '示例标题';
  const previewResult = `${prefix}${previewTitle}${suffix}`;

  return (
    <Modal
      title={
        <Space>
          <Plus size={18} />
          <span>添加前缀/后缀</span>
        </Space>
      }
      open={visible}
      onOk={handleConfirm}
      onCancel={handleCancel}
      okText="应用"
      cancelText="取消"
      okButtonProps={{ disabled: !prefix.trim() && !suffix.trim() }}
    >
      <Space direction="vertical" style={{ width: '100%' }} size="middle">
        <div>
          <label style={{ display: 'block', marginBottom: 8, fontWeight: 500 }}>
            前缀:
          </label>
          <Input
            placeholder="输入要添加的前缀"
            value={prefix}
            onChange={(e) => setPrefix(e.target.value)}
            onPressEnter={handleConfirm}
            prefix="⬅"
          />
        </div>

        <div>
          <label style={{ display: 'block', marginBottom: 8, fontWeight: 500 }}>
            后缀:
          </label>
          <Input
            placeholder="输入要添加的后缀"
            value={suffix}
            onChange={(e) => setSuffix(e.target.value)}
            onPressEnter={handleConfirm}
            suffix="➡"
          />
        </div>

        <div
          style={{
            padding: 12,
            backgroundColor: '#f5f5f5',
            borderRadius: 6,
            marginTop: 8,
          }}
        >
          <div style={{ fontSize: 12, color: '#8c8c8c', marginBottom: 4 }}>
            预览效果:
          </div>
          <div style={{ fontSize: 14 }}>
            <span style={{ textDecoration: 'line-through', color: '#8c8c8c' }}>
              {previewTitle}
            </span>
            <span style={{ margin: '0 8px' }}>→</span>
            <span style={{ color: '#52c41a', fontWeight: 500 }}>{previewResult}</span>
          </div>
        </div>
      </Space>
    </Modal>
  );
};

export default AddPrefixSuffixModal;
