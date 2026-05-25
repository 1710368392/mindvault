/**
 * 批量导入确认弹窗主组件
 */

import React, { useState, useCallback, useMemo, useEffect, useRef } from 'react';
import { Modal, Button, Tabs, Tooltip, Space, Badge, message, Tag, Popover, Dropdown, Input } from 'antd';
import {
  CheckCircle,
  XCircle,
  Upload,
  Pencil,
  Undo,
  Redo,
  Trash2,
  FileText,
  Sparkles,
  Database,
  Clock,
  Check,
  X,
  Plus,
  ChevronDown,
} from 'lucide-react';
import type { BatchImportItem, Operation, BatchImportConfirmModalProps } from './types';
import {
  generateId,
  calculateStatistics,
  formatFileSize,
  formatEstimatedTime,
  createOperation,
  cloneItems,
  validateItems,
  batchFindReplaceTitles,
  batchAddPrefixSuffix,
  getFileTypeIcon,
} from './utils';
import { ImportItemTable } from './ImportItemTable';
import { OperationHistoryBar } from './OperationHistoryBar';
import { FindReplaceModal } from './FindReplaceModal';
import { AddPrefixSuffixModal } from './AddPrefixSuffixModal';
import { useNotificationStore } from '../../stores/notificationStore';
import { useUIStore } from '../../stores/uiStore';
import './styles.css';

const { TabPane } = Tabs;

export const BatchImportConfirmModal: React.FC<BatchImportConfirmModalProps> = ({
  isOpen,
  onClose,
  onConfirm,
  onCancel,
  uploadedFiles,
  aiFeatures = false,
  maxHeight = '70vh',
}) => {
  // 状态管理
  const [items, setItems] = useState<BatchImportItem[]>([]);
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());
  const [operationHistory, setOperationHistory] = useState<Operation[]>([]);
  const [currentHistoryIndex, setCurrentHistoryIndex] = useState(-1);
  const [activeTab, setActiveTab] = useState('success');
  const [isConfirming, setIsConfirming] = useState(false);

  // 模态框状态
  const [findReplaceVisible, setFindReplaceVisible] = useState(false);
  const [prefixSuffixVisible, setPrefixSuffixVisible] = useState(false);
  const [textPopoverVisible, setTextPopoverVisible] = useState(false);
  const [additionalText, setAdditionalText] = useState('');

  // 初始化数据
  useEffect(() => {
    if (isOpen && uploadedFiles.length > 0) {
      const initialItems: BatchImportItem[] = uploadedFiles.map((fileInfo, index) => ({
        id: fileInfo.id || generateId(),
        file: fileInfo.file || (fileInfo.filePath ? undefined as any : undefined),
        fileName: fileInfo.fileName || (fileInfo.file?.name || ''),
        fileSize: fileInfo.fileSize || (fileInfo.file?.size || 0),
        fileType: fileInfo.fileType || (fileInfo.file?.type || ''),
        filePath: fileInfo.filePath,
        thumbnailUrl: fileInfo.thumbnailUrl,
        titleOption: 'keep', // 默认保留文件名
        customTitle: '',
        additionalText: '',
        status: fileInfo.status,
        uploadProgress: fileInfo.uploadProgress,
        errorMessage: fileInfo.errorMessage,
      }));
      setItems(initialItems);
      setSelectedIds(new Set());
      setOperationHistory([]);
      setCurrentHistoryIndex(-1);
      setActiveTab('success');
    }
  }, [isOpen, uploadedFiles]);

  // 计算统计信息
  const statistics = useMemo(() => calculateStatistics(items), [items]);

  // 分离成功和失败的项
  const successItems = useMemo(() => items.filter(i => i.status !== 'failed'), [items]);
  const failedItems = useMemo(() => items.filter(i => i.status === 'failed'), [items]);

  // 记录操作历史
  const recordOperation = useCallback((operation: Operation) => {
    setOperationHistory(prev => {
      // 删除当前索引之后的历史
      const newHistory = prev.slice(0, currentHistoryIndex + 1);
      newHistory.push(operation);
      // 限制历史记录数量
      if (newHistory.length > 50) {
        newHistory.shift();
      }
      return newHistory;
    });
    setCurrentHistoryIndex(prev => Math.min(prev + 1, 49));
  }, [currentHistoryIndex]);

  // 更新单个项目
  const updateItem = useCallback((id: string, updates: Partial<BatchImportItem>) => {
    const item = items.find(i => i.id === id);
    if (!item) return;

    const prevValues = { [id]: { titleOption: item.titleOption, customTitle: item.customTitle, additionalText: item.additionalText } };
    
    setItems(prev => prev.map(i => i.id === id ? { ...i, ...updates } : i));
    
    recordOperation(createOperation(
      'update_item',
      `更新项目: ${item.fileName}`,
      [id],
      prevValues,
      { [id]: updates }
    ));
  }, [items, recordOperation]);

  // 批量更新项目
  const batchUpdateItems = useCallback((updates: Partial<BatchImportItem>, targetIds?: string[]) => {
    const ids = targetIds || Array.from(selectedIds);
    if (ids.length === 0) {
      message.warning('请先选择项目');
      return;
    }

    const prevValues: Record<string, any> = {};
    ids.forEach(id => {
      const item = items.find(i => i.id === id);
      if (item) {
        prevValues[id] = { titleOption: item.titleOption, customTitle: item.customTitle, additionalText: item.additionalText };
      }
    });

    setItems(prev => prev.map(i => ids.includes(i.id) ? { ...i, ...updates } : i));
    
    recordOperation(createOperation(
      'update_item',
      `批量更新 ${ids.length} 个项目`,
      ids,
      prevValues,
      updates
    ));
  }, [items, selectedIds, recordOperation]);

  // 删除项目
  const deleteItems = useCallback((ids: string[]) => {
    const itemsToDelete = items.filter(i => ids.includes(i.id));
    
    setItems(prev => prev.filter(i => !ids.includes(i.id)));
    setSelectedIds(prev => {
      const newSet = new Set(prev);
      ids.forEach(id => newSet.delete(id));
      return newSet;
    });
    
    recordOperation(createOperation(
      'delete_items',
      `删除 ${ids.length} 个项目`,
      ids,
      { deletedItems: itemsToDelete },
      {}
    ));
  }, [items, recordOperation]);

  // 全选保留标题
  const batchKeepTitle = useCallback(() => {
    const ids = Array.from(selectedIds);
    if (ids.length === 0) {
      // 如果没有选择，应用到所有成功项目
      batchUpdateItems({ titleOption: 'keep' }, successItems.map(i => i.id));
    } else {
      batchUpdateItems({ titleOption: 'keep' });
    }
    message.success('已设置为保留文件名');
  }, [selectedIds, successItems, batchUpdateItems]);

  // 全选清空标题
  const batchClearTitle = useCallback(() => {
    const ids = Array.from(selectedIds);
    if (ids.length === 0) {
      batchUpdateItems({ titleOption: 'none', customTitle: '' }, successItems.map(i => i.id));
    } else {
      batchUpdateItems({ titleOption: 'none', customTitle: '' });
    }
    message.success('已设置为不保留标题');
  }, [selectedIds, successItems, batchUpdateItems]);

  // 查找替换
  const handleFindReplace = useCallback((options: { find: string; replace: string; caseSensitive: boolean; useRegex: boolean }) => {
    const newItems = batchFindReplaceTitles(items, options);
    const changedCount = newItems.filter((item, index) => 
      item.titleOption !== items[index].titleOption || 
      item.customTitle !== items[index].customTitle
    ).length;
    
    if (changedCount > 0) {
      setItems(newItems);
      recordOperation(createOperation(
        'batch_find_replace',
        `查找替换: "${options.find}" → "${options.replace}" (${changedCount} 项)`,
        undefined,
        { items: cloneItems(items) },
        { items: cloneItems(newItems) }
      ));
      message.success(`已替换 ${changedCount} 个标题`);
    } else {
      message.info('没有找到匹配的内容');
    }
    setFindReplaceVisible(false);
  }, [items, recordOperation]);

  // 添加前缀/后缀
  const handleAddPrefixSuffix = useCallback((prefix: string, suffix: string) => {
    const newItems = batchAddPrefixSuffix(items, prefix, suffix);
    const changedCount = newItems.filter((item, index) => 
      item.customTitle !== items[index].customTitle
    ).length;
    
    if (changedCount > 0) {
      setItems(newItems);
      recordOperation(createOperation(
        prefix ? 'batch_add_prefix' : 'batch_add_suffix',
        `${prefix ? '添加前缀' : '添加后缀'}: ${prefix || suffix} (${changedCount} 项)`,
        undefined,
        { items: cloneItems(items) },
        { items: cloneItems(newItems) }
      ));
      message.success(`已更新 ${changedCount} 个标题`);
    }
    setPrefixSuffixVisible(false);
  }, [items, recordOperation]);

  // 应用相同附加文本
  const batchApplyText = useCallback((text: string) => {
    batchUpdateItems({ additionalText: text });
    message.success('已应用附加文本');
  }, [batchUpdateItems]);

  // 撤销
  const undo = useCallback(() => {
    if (currentHistoryIndex < 0) return;
    
    const operation = operationHistory[currentHistoryIndex];
    if (operation.prevValues?.items) {
      setItems(operation.prevValues.items);
    } else if (operation.prevValues) {
      // 恢复单个项目
      Object.entries(operation.prevValues).forEach(([id, values]) => {
        if (id !== 'deletedItems') {
          setItems(prev => prev.map(i => i.id === id ? { ...i, ...values } : i));
        }
      });
    }
    
    setCurrentHistoryIndex(prev => prev - 1);
    message.success('已撤销');
  }, [currentHistoryIndex, operationHistory]);

  // 重做
  const redo = useCallback(() => {
    if (currentHistoryIndex >= operationHistory.length - 1) return;
    
    const operation = operationHistory[currentHistoryIndex + 1];
    if (operation.nextValues?.items) {
      setItems(operation.nextValues.items);
    } else if (operation.nextValues) {
      Object.entries(operation.nextValues).forEach(([id, values]) => {
        setItems(prev => prev.map(i => i.id === id ? { ...i, ...values } : i));
      });
    }
    
    setCurrentHistoryIndex(prev => prev + 1);
    message.success('已重做');
  }, [currentHistoryIndex, operationHistory]);

  // 确认导入
  const handleConfirm = useCallback(async () => {
    const validItems = items.filter(i => i.status !== 'failed');
    if (validItems.length === 0) {
      message.error('没有可导入的项目');
      return;
    }

    // 验证
    const validation = validateItems(validItems);
    if (!validation.valid) {
      message.warning(`发现 ${validation.errors.length} 个问题，请检查`);
      return;
    }

    setIsConfirming(true);
    try {
      await onConfirm(validItems);
      
      // 发送通知（同时保存到通知中心历史记录和显示浮层）
      const hasFailures = failedItems.length > 0;
      const addNotification = useNotificationStore.getState().addNotification;
      const showNotification = useUIStore.getState().showNotification;
      
      if (hasFailures) {
        addNotification({
          category: 'system',
          level: 'warning',
          title: '部分导入成功',
          message: `成功导入 ${validItems.length} 个创意，${failedItems.length} 个失败`,
        });
        showNotification(
          'warning',
          '部分导入成功',
          `成功导入 ${validItems.length} 个创意，${failedItems.length} 个失败`
        );
      } else {
        addNotification({
          category: 'system',
          level: 'success',
          title: '导入成功',
          message: `成功导入 ${validItems.length} 个创意`,
        });
        showNotification(
          'success',
          '导入成功',
          `成功导入 ${validItems.length} 个创意`
        );
      }
      
      // 关闭弹窗
      if (onCancel) onCancel();
      onClose();
    } catch (error) {
      message.error('导入失败: ' + (error as Error).message);
    } finally {
      setIsConfirming(false);
    }
  }, [items, failedItems, onConfirm, onCancel, onClose]);

  // 关闭并清理
  const handleClose = useCallback(() => {
    if (onCancel) onCancel();
    onClose();
  }, [onCancel, onClose]);

  // 键盘快捷键
  useEffect(() => {
    if (!isOpen) return;

    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.ctrlKey || e.metaKey) {
        switch (e.key.toLowerCase()) {
          case 'a':
            e.preventDefault();
            setSelectedIds(new Set(successItems.map(i => i.id)));
            break;
          case 'z':
            e.preventDefault();
            if (e.shiftKey) {
              redo();
            } else {
              undo();
            }
            break;
          case 'y':
            e.preventDefault();
            redo();
            break;
        }
      } else if (e.key === 'Delete') {
        if (selectedIds.size > 0) {
          deleteItems(Array.from(selectedIds));
        }
      } else if (e.key === 'Escape') {
        handleClose();
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [isOpen, successItems, selectedIds, undo, redo, deleteItems, handleClose]);

  // 获取当前操作描述
  const currentOperation = currentHistoryIndex >= 0 ? operationHistory[currentHistoryIndex] : null;

  return (
    <>
      <Modal
        title={
          <div className="modal-header">
            <div className="modal-title-left">
              <Upload size={18} />
              <span>批量导入确认</span>
            </div>
            <div className="modal-title-right">
              <Space size="middle">
                <Space>
                  <Database size={14} style={{ color: '#722ed1' }} />
                  <span>总计 <strong>{formatFileSize(statistics.totalSize)}</strong></span>
                </Space>
                <Space>
                  <Clock size={14} style={{ color: '#fa8c16' }} />
                  <span>预计 <strong>{formatEstimatedTime(statistics.estimatedTime)}</strong></span>
                </Space>
                {Object.entries(statistics.byType).slice(0, 4).map(([type, count]) => (
                  <Tag key={type} style={{ fontSize: 12, marginRight: 0 }}>
                    {getFileTypeIcon(type)} {count}
                  </Tag>
                ))}
              </Space>
            </div>
          </div>
        }
        open={isOpen}
        onCancel={handleClose}
        width="80%"
        style={{ maxWidth: 1200 }}
        className="batch-import-modal"
        styles={{ 
          body: { padding: 0, height: '70vh', maxHeight: '70vh', overflow: 'hidden' },
          header: { padding: '16px 24px', borderBottom: 'none' },
          footer: { display: 'none' }  // 隐藏默认 footer，移到 body 内
        }}
        footer={null}
      >
        <div className="batch-import-modal-content">

          {/* Tabs 和批量操作工具栏同一行 - 压缩高度 */}
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 6, minHeight: 28, padding: '0 20px' }}>
            {/* Tabs 靠左 - 压缩高度 */}
            <Tabs
              activeKey={activeTab}
              onChange={setActiveTab}
              className="batch-import-tabs-compact"
              style={{ marginBottom: 0 }}
              size="small"
            >
              <TabPane
                tab={
                  <span style={{ display: 'flex', alignItems: 'center', whiteSpace: 'nowrap', fontSize: 12, lineHeight: '20px' }}>
                    <CheckCircle size={12} style={{ color: '#52c41a', marginRight: 4 }} />
                    成功 ({successItems.length})
                  </span>
                }
                key="success"
              />
              {failedItems.length > 0 && (
                <TabPane
                  tab={
                    <span style={{ display: 'flex', alignItems: 'center', whiteSpace: 'nowrap', fontSize: 12, lineHeight: '20px' }}>
                      <XCircle size={12} style={{ color: '#ff4d4f', marginRight: 4 }} />
                      失败 ({failedItems.length})
                    </span>
                  }
                  key="failed"
                />
              )}
            </Tabs>

            {/* 批量操作工具栏靠右 - 使用更紧凑的按钮 */}
            {activeTab === 'success' && (
              <Space wrap size={4}>
                <Tooltip title={selectedIds.size > 0 ? `应用到选中的 ${selectedIds.size} 项` : '应用到所有项目'}>
                  <Button icon={<Check size={12} />} onClick={batchKeepTitle} size="small" style={{ fontSize: 12, height: 24, padding: '0 8px' }}>
                    保留标题
                  </Button>
                </Tooltip>
                <Tooltip title={selectedIds.size > 0 ? `应用到选中的 ${selectedIds.size} 项` : '应用到所有项目'}>
                  <Button icon={<X size={12} />} onClick={batchClearTitle} size="small" style={{ fontSize: 12, height: 24, padding: '0 8px' }}>
                    清空标题
                  </Button>
                </Tooltip>
                <Popover
                  content={(
                    <div style={{ width: 300 }}>
                      <Input.TextArea
                        placeholder="输入要应用到所有项目的附加文本..."
                        value={additionalText}
                        onChange={(e) => setAdditionalText(e.target.value)}
                        rows={4}
                        style={{ marginBottom: 12 }}
                      />
                      <Space style={{ justifyContent: 'flex-end', width: '100%' }}>
                        <Button size="small" onClick={() => setTextPopoverVisible(false)}>取消</Button>
                        <Button type="primary" size="small" onClick={() => { batchApplyText(additionalText); setTextPopoverVisible(false); }}>应用</Button>
                      </Space>
                    </div>
                  )}
                  title="应用相同附加文本"
                  trigger="click"
                  open={textPopoverVisible}
                  onOpenChange={setTextPopoverVisible}
                  placement="bottomLeft"
                >
                  <Button icon={<FileText size={12} />} size="small" style={{ fontSize: 12, height: 24, padding: '0 8px' }}>附加文本</Button>
                </Popover>
                <Dropdown menu={{ items: [
                  { key: 'findReplace', icon: <Pencil size={12} />, label: '查找替换', onClick: () => setFindReplaceVisible(true) },
                  { key: 'prefixSuffix', icon: <Plus size={12} />, label: '添加前缀/后缀', onClick: () => setPrefixSuffixVisible(true) },
                ] }} placement="bottomLeft">
                  <Button size="small" style={{ fontSize: 12, height: 24, padding: '0 8px' }}>更多 <ChevronDown size={12} /></Button>
                </Dropdown>
                {aiFeatures && (
                  <Tooltip title="AI智能处理">
                    <Button icon={<Sparkles size={12} />} size="small" type="primary" ghost style={{ fontSize: 12, height: 24, padding: '0 8px' }}>AI</Button>
                  </Tooltip>
                )}
              </Space>
            )}
          </div>

          {/* 表格区域 - 设置固定高度启用滚动 */}
          <div className="table-container" style={{ height: 'calc(70vh - 100px)', overflow: 'hidden' }}>
            <ImportItemTable
              items={activeTab === 'success' ? successItems : failedItems}
              selectedIds={selectedIds}
              onSelectChange={setSelectedIds}
              onUpdateItem={updateItem}
              onDeleteItem={(id) => deleteItems([id])}
              maxHeight="calc(70vh - 100px)"
              aiFeatures={aiFeatures}
              readOnly={activeTab === 'failed'}
            />
          </div>

          {/* 底部按钮栏 - 移入 body 内 */}
          <div style={{ padding: '12px 20px', borderTop: '1px solid var(--border-light)', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
            <Space>
              <Tooltip title="撤销 (Ctrl+Z)">
                <Button
                  icon={<Undo size={16} />}
                  onClick={undo}
                  disabled={currentHistoryIndex < 0}
                />
              </Tooltip>
              <Tooltip title="重做 (Ctrl+Y)">
                <Button
                  icon={<Redo size={16} />}
                  onClick={redo}
                  disabled={currentHistoryIndex >= operationHistory.length - 1}
                />
              </Tooltip>
            </Space>
            <Space>
              <Button onClick={handleClose}>取消</Button>
              <Button
                type="primary"
                icon={<CheckCircle size={16} />}
                onClick={handleConfirm}
                loading={isConfirming}
                disabled={successItems.length === 0}
              >
                确认导入 ({successItems.length})
              </Button>
            </Space>
          </div>

          {/* 操作历史栏 */}
          {currentOperation && (
            <OperationHistoryBar operation={currentOperation} />
          )}
        </div>
      </Modal>

      {/* 查找替换模态框 */}
      <FindReplaceModal
        visible={findReplaceVisible}
        onCancel={() => setFindReplaceVisible(false)}
        onConfirm={handleFindReplace}
      />

      {/* 添加前缀/后缀模态框 */}
      <AddPrefixSuffixModal
        visible={prefixSuffixVisible}
        onCancel={() => setPrefixSuffixVisible(false)}
        onConfirm={handleAddPrefixSuffix}
      />
    </>
  );
};

export default BatchImportConfirmModal;
