/**
 * 导出工具函数
 */

import type { Creativity } from '@shared/types';

/**
 * 导出为 JSON 文件（去除 id 字段）
 */
export function exportToJson(data: unknown, filename: string): void {
  // 去除每条记录的 id 字段，避免导入时冲突
  const cleaned = Array.isArray(data)
    ? data.map((item: any) => {
        const { id, ...rest } = item;
        return rest;
      })
    : (() => {
        const { id, ...rest } = data as any;
        return rest;
      })();
  const json = JSON.stringify(cleaned, null, 2);
  downloadFile(json, filename, 'application/json');
}

/**
 * 导出创意为 Markdown
 */
export function exportToMarkdown(creativities: Creativity[], filename: string): void {
  const md = creativities
    .map((c) => {
      let content = `# ${c.title}\n\n`;
      content += `> 创建时间: ${c.createdAt}\n`;
      content += `> 更新时间: ${c.updatedAt}\n`;
      if (c.type !== 'text') {
        content += `> 类型: ${c.type}\n`;
      }
      if (c.priority > 0) {
        content += `> 优先级: ${'★'.repeat(c.priority)}\n`;
      }
      if (c.emojiReaction) {
        content += `> 反应: ${c.emojiReaction}\n`;
      }
      if (c.tags && c.tags.length > 0) {
        content += `> 标签: ${c.tags.map((t) => `#${t.name}`).join(' ')}\n`;
      }
      content += `\n---\n\n${c.content}\n`;
      return content;
    })
    .join('\n\n---\n\n');

  downloadFile(md, filename, 'text/markdown');
}

/**
 * 导出创意为 HTML
 */
export function exportToHtml(creativities: Creativity[], filename: string): void {
  const html = `<!DOCTYPE html>
<html lang="zh-CN">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>脑洞集 - 导出</title>
  <style>
    * { margin: 0; padding: 0; box-sizing: border-box; }
    body {
      font-family: 'PingFang SC', 'Microsoft YaHei', sans-serif;
      max-width: 800px;
      margin: 0 auto;
      padding: 40px 20px;
      background: #f8f9fa;
      color: #1a1a2e;
    }
    h1 { font-size: 28px; margin-bottom: 8px; }
    .meta { color: #6b7280; font-size: 14px; margin-bottom: 16px; }
    .card {
      background: white;
      border-radius: 12px;
      padding: 24px;
      margin-bottom: 20px;
      box-shadow: 0 2px 8px rgba(0,0,0,0.06);
    }
    .card h2 { font-size: 20px; margin-bottom: 8px; }
    .card .tags { display: flex; gap: 6px; margin-bottom: 12px; flex-wrap: wrap; }
    .card .tag {
      background: #f0f1f3;
      padding: 2px 10px;
      border-radius: 12px;
      font-size: 12px;
      color: #6b7280;
    }
    .card .content { line-height: 1.8; color: #374151; }
    .card .date { font-size: 12px; color: #9ca3af; margin-top: 12px; }
    .card .meta-row { display: flex; align-items: center; gap: 12px; margin-bottom: 12px; flex-wrap: wrap; }
    .card .priority { font-size: 14px; color: #f59e0b; }
    .card .emoji { font-size: 18px; }
    .card .type-badge { padding: 2px 8px; border-radius: 6px; font-size: 11px; background: #f0f1f3; color: #6b7280; }
  </style>
</head>
<body>
  <h1>脑洞集 - 创意导出</h1>
  <p class="meta">导出时间: ${new Date().toLocaleString('zh-CN')} | 共 ${creativities.length} 条创意</p>
  ${creativities
    .map(
      (c) => `
  <div class="card">
    <h2>${escapeHtml(c.title)}</h2>
    <div class="meta-row">
      ${c.emojiReaction ? `<span class="emoji">${escapeHtml(c.emojiReaction)}</span>` : ''}
      ${c.priority > 0 ? `<span class="priority">${'★'.repeat(c.priority)}</span>` : ''}
      ${c.type && c.type !== 'text' ? `<span class="type-badge">${escapeHtml(c.type)}</span>` : ''}
    </div>
    <div class="tags">
      ${c.tags?.map((t) => `<span class="tag">#${escapeHtml(t.name)}</span>`).join('') || ''}
    </div>
    <div class="content">${escapeHtml(c.content).replace(/\n/g, '<br>')}</div>
    <div class="date">创建于 ${c.createdAt}</div>
  </div>`
    )
    .join('\n')}
</body>
</html>`;

  downloadFile(html, filename, 'text/html');
}

/**
 * 下载文件
 */
function downloadFile(content: string, filename: string, mimeType: string): void {
  const blob = new Blob([content], { type: mimeType });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  URL.revokeObjectURL(url);
}

/**
 * HTML 转义
 */
function escapeHtml(text: string): string {
  const div = document.createElement('div');
  div.textContent = text;
  return div.innerHTML;
}

/**
 * 从 JSON 文件导入
 */
export function parseImportJson(content: string): unknown {
  try {
    return JSON.parse(content);
  } catch {
    throw new Error('无效的 JSON 文件');
  }
}
