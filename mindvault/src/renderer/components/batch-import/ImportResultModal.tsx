/**
 * 导入结果模态框组件
 */

import React from 'react';
import { Modal, Button, Space, List, Tag, Result } from 'antd';
import {
  CheckCircle,
  XCircle,
  Eye,
  Upload,
  X,
} from 'lucide-react';
import type { BatchImportItem } from './types';

interface ImportResultModalProps {
  visible: boolean;
  onClose: () => void;
  successCount: number;
  failedCount: number;
  failedItems: { item: BatchImportItem; reason: string }[];
}

export const ImportResultModal: React.FC<ImportResultModalProps> = ({
  visible,
  onClose,
  successCount,
  failedCount,
  failedItems,
}) => {
  const hasFailures = failedCount > 0;

  return (
    <Modal
      title={
        <Space>
          <CheckCircle size={18} style={{ color: '#52c41a' }} />
          <span>导入结果</span>
        </Space>
      }
      open={visible}
      onCancel={onClose}
      footer={
        <Space style={{ justifyContent: 'flex-end', width: '100%' }}>
          <Button onClick={onClose} icon={<X size={16} />}>
            关闭
          </Button>
          <Button type="primary" icon={<Eye size={16} />} onClick={onClose}>
            查看创意
          </Button>
        </Space>
      }
      width={600}
    >
      <Result
        status={hasFailures ? 'warning' : 'success'}
        title={hasFailures ? '部分导入成功' : '导入成功'}
        subTitle={`成功导入 ${successCount} 个创意${hasFailures ? `，${failedCount} 个失败` : ''}`}
        icon={
          hasFailures ? (
            <CheckCircle size={48} style={{ color: '#faad14' }} />
          ) : (
            <CheckCircle size={48} style={{ color: '#52c41a' }} />
          )
        }
      />

      {hasFailures && (
        <div style={{ marginTop: 16 }}>
          <h4 style={{ marginBottom: 12 }}>
            <XCircle size={18} style={{ color: '#ff4d4f', marginRight: 8 }} />
            失败详情:
          </h4>
          <List
            size="small"
            bordered
            dataSource={failedItems}
            renderItem={({ item, reason }) => (
              <List.Item>
                <Space>
                  <span style={{ fontWeight: 500 }}>{item.fileName}</span>
                  <Tag color="error" size="small">
                    {reason}
                  </Tag>
                </Space>
              </List.Item>
            )}
            style={{ maxHeight: 200, overflow: 'auto' }}
          />
        </div>
      )}
    </Modal>
  );
};

export default ImportResultModal;
