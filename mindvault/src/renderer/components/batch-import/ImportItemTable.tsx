/**
 * 导入项目表格组件
 */

import React, { useState, useCallback } from 'react';
import { Table, Checkbox, Radio, Input, Button, Space, Tooltip, Image, Tag } from 'antd';
import {
  Trash2,
  Eye,
  ChevronDown,
  ChevronUp,
  Sparkles,
} from 'lucide-react';
import type { BatchImportItem, TitleOption } from './types';
import { formatFileSize, getFileTypeIcon, getFileType, getFileTypeLabel, getFileTypeColor } from './utils';

interface ImportItemTableProps {
  items: BatchImportItem[];
  selectedIds: Set<string>;
  onSelectChange: (selectedIds: Set<string>) => void;
  onUpdateItem: (id: string, updates: Partial<BatchImportItem>) => void;
  onDeleteItem: (id: string) => void;
  maxHeight?: string;
  aiFeatures?: boolean;
  readOnly?: boolean;
}

export const ImportItemTable: React.FC<ImportItemTableProps> = ({
  items,
  selectedIds,
  onSelectChange,
  onUpdateItem,
  onDeleteItem,
  maxHeight = '400px',
  aiFeatures,
  readOnly,
}) => {
  const [expandedRows, setExpandedRows] = useState<Set<string>>(new Set());

  // 切换行展开状态
  const toggleExpand = useCallback((id: string) => {
    setExpandedRows(prev => {
      const newSet = new Set(prev);
      if (newSet.has(id)) {
        newSet.delete(id);
      } else {
        newSet.add(id);
      }
      return newSet;
    });
  }, []);

  // 处理选择
  const handleSelect = useCallback((id: string, checked: boolean) => {
    const newSet = new Set(selectedIds);
    if (checked) {
      newSet.add(id);
    } else {
      newSet.delete(id);
    }
    onSelectChange(newSet);
  }, [selectedIds, onSelectChange]);

  // 全选
  const handleSelectAll = useCallback((checked: boolean) => {
    if (checked) {
      onSelectChange(new Set(items.map(i => i.id)));
    } else {
      onSelectChange(new Set());
    }
  }, [items, onSelectChange]);

  // AI生成标题
  const handleAIGenerateTitle = useCallback((item: BatchImportItem) => {
    // TODO: 调用AI服务生成标题
    const suggestedTitle = `AI生成的标题 - ${item.fileName}`;
    onUpdateItem(item.id, {
      titleOption: 'custom',
      customTitle: suggestedTitle,
      aiSuggestedTitle: suggestedTitle,
    });
  }, [onUpdateItem]);

  // AI提取文本
  const handleAIExtractText = useCallback((item: BatchImportItem) => {
    // TODO: 调用AI服务提取文本
    const extractedText = `AI从 ${item.fileName} 提取的内容...`;
    onUpdateItem(item.id, {
      additionalText: extractedText,
      aiExtractedText: extractedText,
    });
  }, [onUpdateItem]);

  // 表格列定义
  const columns = [
    {
      title: (
        <Checkbox
          checked={items.length > 0 && selectedIds.size === items.length}
          indeterminate={selectedIds.size > 0 && selectedIds.size < items.length}
          onChange={(e) => handleSelectAll(e.target.checked)}
        />
      ),
      key: 'selection',
      width: 50,
      fixed: 'left' as const,
      render: (_: any, item: BatchImportItem) => (
        <Checkbox
          checked={selectedIds.has(item.id)}
          onChange={(e) => handleSelect(item.id, e.target.checked)}
        />
      ),
    },
    {
      title: '序号',
      key: 'index',
      width: 60,
      render: (_: any, __: BatchImportItem, index: number) => index + 1,
    },
    {
      title: '缩略图',
      key: 'thumbnail',
      width: 80,
      render: (_: any, item: BatchImportItem) => (
        <div className="thumbnail-cell">
          {item.thumbnailUrl ? (
            <Image
              src={item.thumbnailUrl}
              alt={item.fileName}
              width={50}
              height={50}
              style={{ objectFit: 'cover', borderRadius: 4 }}
              preview={{ mask: <Eye size={16} /> }}
            />
          ) : (
            <div className="file-icon">{getFileTypeIcon(item.fileName)}</div>
          )}
        </div>
      ),
    },
    {
      title: '类型',
      key: 'fileType',
      width: 90,
      render: (_: any, item: BatchImportItem) => {
        const type = item.fileType || getFileType(item.fileName);
        return (
          <Tag color={getFileTypeColor(type)} style={{ margin: 0 }}>
            {getFileTypeIcon(type)} {getFileTypeLabel(type)}
          </Tag>
        );
      },
    },
    {
      title: '文件名',
      key: 'fileName',
      width: 200,
      ellipsis: true,
      render: (_: any, item: BatchImportItem) => (
        <Tooltip title={item.fileName}>
          <span>{item.fileName}</span>
        </Tooltip>
      ),
    },
    {
      title: '大小',
      key: 'size',
      width: 80,
      render: (_: any, item: BatchImportItem) => formatFileSize(item.fileSize),
    },
    {
      title: '标题设置',
      key: 'title',
      width: 300,
      render: (_: any, item: BatchImportItem) => (
        <div className="title-setting-cell">
          <Radio.Group
            value={item.titleOption}
            onChange={(e) => onUpdateItem(item.id, { titleOption: e.target.value })}
            disabled={readOnly}
            size="small"
          >
            <Space direction="vertical" size={0}>
              <Radio value="keep">
                <span className="radio-label">保留</span>
                <span className="file-name-preview">{item.fileName}</span>
              </Radio>
              <Radio value="none">
                <span className="radio-label">空白</span>
              </Radio>
              <Radio value="custom">
                <span className="radio-label">自定义</span>
                <Input
                  size="small"
                  value={item.customTitle}
                  onChange={(e) => onUpdateItem(item.id, { customTitle: e.target.value })}
                  placeholder="输入自定义标题"
                  disabled={item.titleOption !== 'custom'}
                  style={{ width: 150 }}
                />
                {aiFeatures && (
                  <Tooltip title="AI生成标题">
                    <Button
                      size="small"
                      type="link"
                      icon={<Sparkles size={16} />}
                      onClick={() => handleAIGenerateTitle(item)}
                      disabled={item.titleOption !== 'custom'}
                    />
                  </Tooltip>
                )}
              </Radio>
            </Space>
          </Radio.Group>
        </div>
      ),
    },
    {
      title: '附加文本',
      key: 'additionalText',
      width: 120,
      render: (_: any, item: BatchImportItem) => (
        <Button
          size="small"
          icon={expandedRows.has(item.id) ? <ChevronUp size={14} /> : <ChevronDown size={14} />}
          onClick={() => toggleExpand(item.id)}
          disabled={readOnly}
        >
          {expandedRows.has(item.id) ? '收起' : (item.additionalText ? '已编辑' : '展开')}
        </Button>
      ),
    },
    {
      title: '操作',
      key: 'action',
      width: 100,
      fixed: 'right' as const,
      render: (_: any, item: BatchImportItem) => (
        <Space size="small">
          {!readOnly && (
            <Tooltip title="删除">
              <Button
                size="small"
                danger
                icon={<Trash2 size={14} />}
                onClick={() => onDeleteItem(item.id)}
              />
            </Tooltip>
          )}
        </Space>
      ),
    },
  ];

  // 展开的行内容
  const expandedRowRender = (item: BatchImportItem) => {
    return (
      <Input.TextArea
        value={item.additionalText}
        onChange={(e) => onUpdateItem(item.id, { additionalText: e.target.value })}
        placeholder="输入附加文本内容"
        rows={3}
        disabled={readOnly}
        style={{ margin: '8px 12px', width: 'calc(100% - 24px)' }}
      />
    );
  };

  // 计算表格内容区域高度（减去表头高度和底部按钮栏）
  const tableScrollHeight = 'calc(70vh - 140px)';

  return (
    <div className="import-item-table" style={{ height: '100%', display: 'flex', flexDirection: 'column' }}>
      <Table
        columns={columns}
        dataSource={items}
        rowKey="id"
        pagination={false}
        size="small"
        scroll={{ x: 1090, y: tableScrollHeight }}
        locale={{ emptyText: '暂无数据' }}
        style={{ flex: 1 }}
        expandable={{
          expandedRowRender,
          expandRowByClick: false,
          expandedRowKeys: Array.from(expandedRows),
          onExpand: (expanded, record) => {
            toggleExpand(record.id);
          },
          expandIcon: () => null, // 隐藏默认的展开图标
        }}
      />
    </div>
  );
};

export default ImportItemTable;
