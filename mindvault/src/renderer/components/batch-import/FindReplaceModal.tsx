/**
 * 查找替换模态框组件
 */

import React, { useState } from 'react';
import { Modal, Input, Checkbox, Space, Alert } from 'antd';
import { Search, ArrowLeftRight } from 'lucide-react';

interface FindReplaceModalProps {
  visible: boolean;
  onCancel: () => void;
  onConfirm: (options: {
    find: string;
    replace: string;
    caseSensitive: boolean;
    useRegex: boolean;
  }) => void;
}

export const FindReplaceModal: React.FC<FindReplaceModalProps> = ({
  visible,
  onCancel,
  onConfirm,
}) => {
  const [find, setFind] = useState('');
  const [replace, setReplace] = useState('');
  const [caseSensitive, setCaseSensitive] = useState(false);
  const [useRegex, setUseRegex] = useState(false);

  const handleConfirm = () => {
    if (!find.trim()) {
      return;
    }
    onConfirm({
      find: find.trim(),
      replace: replace.trim(),
      caseSensitive,
      useRegex,
    });
    // 重置状态
    setFind('');
    setReplace('');
    setCaseSensitive(false);
    setUseRegex(false);
  };

  const handleCancel = () => {
    onCancel();
    // 重置状态
    setFind('');
    setReplace('');
    setCaseSensitive(false);
    setUseRegex(false);
  };

  return (
    <Modal
      title={
        <Space>
          <Search size={18} />
          <span>查找替换</span>
        </Space>
      }
      open={visible}
      onOk={handleConfirm}
      onCancel={handleCancel}
      okText="替换"
      cancelText="取消"
      okButtonProps={{ disabled: !find.trim() }}
    >
      <Space direction="vertical" style={{ width: '100%' }} size="middle">
        <div>
          <label style={{ display: 'block', marginBottom: 8, fontWeight: 500 }}>
            查找内容:
          </label>
          <Input
            placeholder="输入要查找的文本"
            value={find}
            onChange={(e) => setFind(e.target.value)}
            onPressEnter={handleConfirm}
            autoFocus
          />
        </div>

        <div>
          <label style={{ display: 'block', marginBottom: 8, fontWeight: 500 }}>
            <ArrowLeftRight size={16} style={{ marginRight: 4 }} />
            替换为:
          </label>
          <Input
            placeholder="输入替换后的文本"
            value={replace}
            onChange={(e) => setReplace(e.target.value)}
            onPressEnter={handleConfirm}
          />
        </div>

        <Space>
          <Checkbox
            checked={caseSensitive}
            onChange={(e) => setCaseSensitive(e.target.checked)}
          >
            区分大小写
          </Checkbox>
          <Checkbox
            checked={useRegex}
            onChange={(e) => setUseRegex(e.target.checked)}
          >
            使用正则表达式
          </Checkbox>
        </Space>

        {useRegex && (
          <Alert
            message="正则表达式提示"
            description={
              <ul style={{ margin: 0, paddingLeft: 16 }}>
                <li>. 匹配任意字符</li>
                <li>* 匹配0个或多个</li>
                <li>^ 匹配开头，$ 匹配结尾</li>
                <li>() 用于分组捕获</li>
              </ul>
            }
            type="info"
            showIcon
            style={{ fontSize: 12 }}
          />
        )}
      </Space>
    </Modal>
  );
};

export default FindReplaceModal;
