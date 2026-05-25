import React, { useState, useRef } from 'react';
import { motion } from 'framer-motion';
import {
  Download,
  FileJson,
  FileText,
  Globe,
  Upload,
  Settings,
} from 'lucide-react';
import { useCreativityStore } from '../stores/creativityStore';
import { useUIStore } from '../stores/uiStore';
import { useSettingsStore } from '../stores/settingsStore';
import { api } from '../utils/api';
import { exportToJson, exportToMarkdown, exportToHtml, parseImportJson } from '../utils/exporters';
import type { Creativity } from '@shared/types';

const Export: React.FC = () => {
  const { creativities } = useCreativityStore();
  const { showToast } = useUIStore();
  const settings = useSettingsStore((s) => s.settings);
  const [exporting, setExporting] = useState<string | null>(null);
  const [importing, setImporting] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const includedFields = settings.exportIncludedFields || ['title', 'content', 'tags', 'timestamps'];

  const exportFormats = [
    {
      id: 'json',
      label: 'JSON 格式',
      description: '导出为 JSON 文件，可用于备份和迁移数据',
      icon: FileJson,
      color: '#F59E0B',
      action: () => handleExport('json'),
    },
    {
      id: 'markdown',
      label: 'Markdown 格式',
      description: '导出为 Markdown 文件，适合阅读和分享',
      icon: FileText,
      color: '#10B981',
      action: () => handleExport('markdown'),
    },
    {
      id: 'html',
      label: 'HTML 格式',
      description: '导出为 HTML 文件，可在浏览器中直接打开',
      icon: Globe,
      color: '#3B82F6',
      action: () => handleExport('html'),
    },
  ];

  const filterFields = (data: Creativity[]): any[] => {
    return data.map((item: any) => {
      const output: any = {};
      if (includedFields.includes('title')) output.title = item.title;
      if (includedFields.includes('content')) output.content = item.content;
      if (includedFields.includes('tags')) output.tags = item.tags;
      if (includedFields.includes('priority')) output.priority = item.priority;
      if (includedFields.includes('emoji')) output.emojiReactions = item.emojiReactions;
      if (includedFields.includes('timestamps')) {
        output.createdAt = item.createdAt;
        output.updatedAt = item.updatedAt;
      }
      if (includedFields.includes('media')) output.media = item.media;
      if (includedFields.includes('links')) output.links = item.links;
      if (!output.title && !output.content) {
        output.title = item.title;
        output.content = item.content;
      }
      return output;
    });
  };

  const handleExport = async (format: string) => {
    if (includedFields.length === 0) {
      showToast('warning', '请先在设置中勾选导出内容');
      return;
    }

    setExporting(format);
    try {
      const data: Creativity[] = await api.creativity.listAll() || creativities as unknown as Creativity[];

      if (data.length === 0) {
        showToast('warning', '没有可导出的创意');
        setExporting(null);
        return;
      }

      const filtered = filterFields(data);
      const timestamp = new Date().toISOString().slice(0, 10);
      switch (format) {
        case 'json':
          exportToJson(filtered, `脑洞集_备份_${timestamp}.json`);
          break;
        case 'markdown':
          exportToMarkdown(filtered, `脑洞集_导出_${timestamp}.md`);
          break;
        case 'html':
          exportToHtml(filtered, `脑洞集_导出_${timestamp}.html`);
          break;
      }
      showToast('success', '导出成功');
    } catch (error) {
      console.error('导出失败:', error);
      useUIStore.getState().showNotification('error', '导出失败', '请检查文件权限或磁盘空间');
    } finally {
      setExporting(null);
    }
  };

  const handleImport = async () => {
    if (fileInputRef.current) {
      fileInputRef.current.click();
    }
  };

  const handleFileChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    e.target.value = '';

    setImporting(true);
    try {
      const content = await file.text();

      if (content) {
        const data = parseImportJson(content);

        const items = Array.isArray(data) ? data : [data];

        const validItems = items.filter(
          (item: any) => item && (item.title || item.content)
        );

        if (validItems.length === 0) {
          showToast('warning', '未找到有效的导入数据（需要 title 或 content 字段）');
          setImporting(false);
          return;
        }

        let successCount = 0;
        let failCount = 0;
        for (const item of validItems) {
          try {
            const { id, ...rest } = item as any;
            const result = await api.creativity.create(rest);
            if (result) {
              successCount++;
            } else {
              failCount++;
            }
          } catch {
            failCount++;
          }
        }

        if (successCount > 0) {
          useUIStore.getState().showNotification('success', '数据导入完成', `成功导入 ${successCount} 条创意${failCount > 0 ? `，${failCount} 条失败` : ''}`);
        } else {
          useUIStore.getState().showNotification('error', '导入失败', '所有数据均导入失败，请检查文件格式');
        }
      }
    } catch (error) {
      console.error('导入失败:', error);
      useUIStore.getState().showNotification('error', '导入失败', '请检查文件格式是否正确');
    } finally {
      setImporting(false);
    }
  };

  const fieldLabels: Record<string, string> = {
    title: '标题', content: '内容', tags: '标签', priority: '优先级',
    emoji: 'Emoji', timestamps: '时间', media: '媒体', links: '关联',
  };

  return (
    <div style={{ padding: 24, maxWidth: 800, margin: '0 auto' }}>
      <input
        ref={fileInputRef}
        type="file"
        accept=".json"
        style={{ display: 'none' }}
        onChange={handleFileChange}
      />

      <motion.div
        initial={{ opacity: 0, y: -10 }}
        animate={{ opacity: 1, y: 0 }}
        style={{ marginBottom: 32 }}
      >
        <h2 style={{ fontSize: 22, fontWeight: 700, color: 'var(--text-primary)', marginBottom: 6 }}>
          导出与导入
        </h2>
        <p style={{ fontSize: 14, color: 'var(--text-secondary)' }}>
          导出你的创意数据，或从备份文件中恢复
        </p>
      </motion.div>

      {/* 当前导出设置提示 */}
      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        style={{ marginBottom: 24 }}
      >
        <div style={{
          backgroundColor: 'var(--bg-secondary)',
          borderRadius: 'var(--radius-lg)',
          padding: '14px 20px',
          border: '1px solid var(--border-light)',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
        }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
            <Settings size={16} color="var(--text-tertiary)" />
            <span style={{ fontSize: 13, color: 'var(--text-secondary)' }}>
              导出内容：{includedFields.length > 0 ? includedFields.map(f => fieldLabels[f] || f).join('、') : '未选择'}
            </span>
          </div>
          <button
            onClick={() => window.location.hash = '#/settings'}
            style={{
              fontSize: 13, color: 'var(--primary-color)', background: 'none',
              border: 'none', cursor: 'pointer', fontWeight: 500,
            }}
          >
            修改设置
          </button>
        </div>
      </motion.div>

      {/* 导出格式 */}
      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ delay: 0.1 }}
        style={{ marginBottom: 32 }}
      >
        <h3
          style={{
            fontSize: 16,
            fontWeight: 600,
            color: 'var(--text-primary)',
            marginBottom: 16,
            display: 'flex',
            alignItems: 'center',
            gap: 8,
          }}
        >
          <Download size={18} />
          导出数据
        </h3>
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: 16 }}>
          {exportFormats.map((format) => (
            <button
              key={format.id}
              onClick={format.action}
              disabled={exporting !== null}
              style={{
                display: 'flex',
                flexDirection: 'column',
                alignItems: 'center',
                gap: 12,
                padding: 24,
                backgroundColor: 'var(--bg-secondary)',
                borderRadius: 'var(--radius-lg)',
                border: '1px solid var(--border-light)',
                cursor: exporting !== null ? 'not-allowed' : 'pointer',
                opacity: exporting === format.id ? 0.7 : 1,
                transition: 'transform 0.15s ease, box-shadow 0.15s ease',
              }}
              onMouseEnter={(e) => {
                if (exporting === null) {
                  (e.currentTarget as HTMLElement).style.transform = 'translateY(-4px)';
                  (e.currentTarget as HTMLElement).style.boxShadow = 'var(--shadow-lg)';
                }
              }}
              onMouseLeave={(e) => {
                (e.currentTarget as HTMLElement).style.transform = 'translateY(0)';
                (e.currentTarget as HTMLElement).style.boxShadow = 'none';
              }}
            >
              <div
                style={{
                  width: 52,
                  height: 52,
                  borderRadius: 'var(--radius-lg)',
                  background: `${format.color}15`,
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                }}
              >
                {exporting === format.id ? (
                  <motion.div
                    animate={{ rotate: 360 }}
                    transition={{ duration: 1, repeat: Infinity, ease: 'linear' }}
                  >
                    <Download size={24} color={format.color} />
                  </motion.div>
                ) : (
                  <format.icon size={24} color={format.color} />
                )}
              </div>
              <div style={{ textAlign: 'center' }}>
                <div
                  style={{
                    fontSize: 14,
                    fontWeight: 600,
                    color: 'var(--text-primary)',
                    marginBottom: 4,
                  }}
                >
                  {format.label}
                </div>
                <div
                  style={{
                    fontSize: 12,
                    color: 'var(--text-tertiary)',
                    lineHeight: 1.5,
                  }}
                >
                  {format.description}
                </div>
              </div>
            </button>
          ))}
        </div>
      </motion.div>

      {/* 导入 */}
      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ delay: 0.2 }}
      >
        <h3
          style={{
            fontSize: 16,
            fontWeight: 600,
            color: 'var(--text-primary)',
            marginBottom: 16,
            display: 'flex',
            alignItems: 'center',
            gap: 8,
          }}
        >
          <Upload size={18} />
          导入数据
        </h3>
        <motion.div
          onClick={handleImport}
          disabled={importing}
          style={{
            display: 'flex',
            flexDirection: 'column',
            alignItems: 'center',
            justifyContent: 'center',
            gap: 12,
            padding: 40,
            backgroundColor: 'var(--bg-secondary)',
            borderRadius: 'var(--radius-lg)',
            border: '2px dashed var(--border-color)',
            cursor: importing ? 'not-allowed' : 'pointer',
            transition: 'border-color 0.2s ease',
          }}
          onMouseEnter={(e) => {
            if (!importing) {
              (e.currentTarget as HTMLElement).style.borderColor = 'var(--primary-color)';
            }
          }}
          onMouseLeave={(e) => {
            (e.currentTarget as HTMLElement).style.borderColor = 'var(--border-color)';
          }}
        >
          {importing ? (
            <motion.div
              animate={{ rotate: 360 }}
              transition={{ duration: 1, repeat: Infinity, ease: 'linear' }}
            >
              <Upload size={32} color="var(--primary-color)" />
            </motion.div>
          ) : (
            <Upload size={32} color="var(--text-tertiary)" />
          )}
          <div style={{ textAlign: 'center' }}>
            <div style={{ fontSize: 14, fontWeight: 500, color: 'var(--text-primary)' }}>
              {importing ? '导入中...' : '点击选择 JSON 文件导入'}
            </div>
            <div style={{ fontSize: 12, color: 'var(--text-tertiary)', marginTop: 4 }}>
              支持从脑洞集导出的 JSON 备份文件
            </div>
          </div>
        </motion.div>
      </motion.div>
    </div>
  );
};

export default Export;
