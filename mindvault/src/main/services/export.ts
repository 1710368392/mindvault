/**
 * 导出服务
 * 支持将创意数据导出为PDF、图片、JSON格式
 */

import path from 'path';
import fs from 'fs';
import PDFDocument from 'pdfkit';
import { getMediaDir } from '../db/migration';
import { formatTimeLocal } from '../utils';

/** 导出格式类型 */
export type ExportFormat = 'json' | 'pdf' | 'image';

/** 导出选项 */
export interface ExportOptions {
  format: ExportFormat;
  outputPath: string;           // 导出文件路径
  creativityIds?: string[];     // 指定要导出的创意ID列表
  boardId?: string;             // 指定要导出的看板ID
  includeMedia?: boolean;       // 是否包含媒体文件
  includeTags?: boolean;        // 是否包含标签
}

/** 导出结果 */
export interface ExportResult {
  success: boolean;
  filePath?: string;
  fileSize?: number;
  error?: string;
}

// 创意仓库接口
interface CreativityRepository {
  findById(id: string): any;
  list(options: any): { items: any[] };
}

// 看板仓库接口
interface BoardRepository {
  findById(id: string): any;
}

export class ExportService {
  constructor(
    private creativityRepo: CreativityRepository,
    private boardRepo: BoardRepository,
    private userDataPath: string
  ) {}

  /**
   * 导出数据
   * @param options - 导出选项
   */
  async export(options: ExportOptions): Promise<ExportResult> {
    try {
      switch (options.format) {
        case 'json':
          return this.exportJSON(options);
        case 'pdf':
          return this.exportPDF(options);
        case 'image':
          return this.exportImage(options);
        default:
          return { success: false, error: `不支持的导出格式: ${options.format}` };
      }
    } catch (error: any) {
      return { success: false, error: error.message };
    }
  }

  /**
   * 导出为JSON格式
   * 将创意数据序列化为JSON文件
   */
  private async exportJSON(options: ExportOptions): Promise<ExportResult> {
    // 获取要导出的创意数据
    const creativities = this.getExportData(options);

    // 构建导出数据结构
    const exportData = {
      app: '脑洞集(MindVault)',
      version: '1.0.0',
      exported_at: formatTimeLocal(),
      data: creativities.map((c) => {
        const item: any = {
          id: c.id,
          title: c.title,
          content: c.content,
          content_type: c.content_type,
          category: c.category,
          priority: c.priority,
          color: c.color,
          created_at: c.created_at,
          updated_at: c.updated_at,
        };

        if (options.includeTags && c.tags) {
          item.tags = c.tags.map((t: any) => ({ name: t.name, color: t.color }));
        }

        if (options.includeMedia && c.media) {
          item.media = c.media.map((m: any) => ({
            filename: m.filename,
            mime_type: m.mime_type,
            file_size: m.file_size,
          }));
        }

        return item;
      }),
    };

    // 写入JSON文件
    const jsonContent = JSON.stringify(exportData, null, 2);
    fs.writeFileSync(options.outputPath, jsonContent, 'utf-8');

    const stats = fs.statSync(options.outputPath);
    return {
      success: true,
      filePath: options.outputPath,
      fileSize: stats.size,
    };
  }

  /**
   * 导出为PDF格式
   * 使用pdfkit生成包含创意内容的PDF文档
   */
  private async exportPDF(options: ExportOptions): Promise<ExportResult> {
    const creativities = this.getExportData(options);

    if (creativities.length === 0) {
      return { success: false, error: '没有可导出的创意' };
    }

    // 确保输出路径以.pdf结尾
    const outputPath = options.outputPath.replace(/\.html$/, '.pdf');
    if (!outputPath.endsWith('.pdf')) {
      return { success: false, error: 'PDF导出路径必须以.pdf结尾' };
    }

    return new Promise<ExportResult>((resolve, reject) => {
      try {
        const doc = new PDFDocument({
          size: 'A4',
          margins: { top: 50, bottom: 50, left: 50, right: 50 },
          info: {
            Title: '脑洞集 - 创意导出',
            Author: 'MindVault',
            Creator: 'MindVault',
            CreationDate: new Date(),
          },
        });

        const stream = fs.createWriteStream(outputPath);
        doc.pipe(stream);

        // 尝试加载中文字体
        const chineseFontPaths = [
          '/usr/share/fonts/truetype/noto/NotoSansCJK-Regular.ttc',
          '/usr/share/fonts/opentype/noto/NotoSansCJK-Regular.ttc',
          '/usr/share/fonts/truetype/wqy/wqy-zenhei.ttc',
          '/usr/share/fonts/truetype/wqy/wqy-microhei.ttc',
          '/usr/share/fonts/truetype/droid/DroidSansFallbackFull.ttf',
          '/System/Library/Fonts/PingFang.ttc',
          '/System/Library/Fonts/STHeiti Light.ttc',
          'C:\\Windows\\Fonts\\msyh.ttc',
          'C:\\Windows\\Fonts\\simhei.ttf',
        ];

        let fontLoaded = false;
        for (const fontPath of chineseFontPaths) {
          if (fs.existsSync(fontPath)) {
            doc.font(fontPath);
            fontLoaded = true;
            console.log(`[导出] 使用中文字体: ${fontPath}`);
            break;
          }
        }

        if (!fontLoaded) {
          console.warn('[导出] 未找到中文字体，使用默认字体（中文可能无法正常显示）');
        }

        // 页面尺寸
        const pageWidth = doc.page.width - doc.page.margins.left - doc.page.margins.right;

        // 标题页
        doc.fontSize(28).text('脑洞集 - 创意导出', { align: 'center' });
        doc.moveDown(0.5);
        doc.fontSize(12).fillColor('#666666')
          .text(`导出时间：${formatTimeLocal()}`, { align: 'center' })
          .text(`共 ${creativities.length} 条创意`, { align: 'center' });
        doc.moveDown(1);

        // 分隔线
        doc.moveTo(doc.page.margins.left, doc.y)
          .lineTo(doc.page.width - doc.page.margins.right, doc.y)
          .strokeColor('#3b82f6')
          .lineWidth(2)
          .stroke();
        doc.moveDown(1);

        // 类型标签映射
        const typeLabels: Record<string, string> = {
          text: '文本',
          image: '图片',
          link: '链接',
          file: '文件',
          mixed: '混合',
        };

        // 遍历每个创意
        for (let i = 0; i < creativities.length; i++) {
          const c = creativities[i];

          // 检查是否需要新页面（留出足够空间）
          const estimatedHeight = 120 + (c.content ? c.content.length * 0.5 : 0);
          if (doc.y + estimatedHeight > doc.page.height - doc.page.margins.bottom) {
            doc.addPage();
          }

          // 标题
          doc.fillColor('#111827').fontSize(18).text(c.title || '', {
            width: pageWidth,
          });
          doc.moveDown(0.3);

          // 类型标签和日期
          const typeLabel = typeLabels[c.content_type] || c.content_type || '未知';
          const dateStr = c.created_at ? new Date(c.created_at).toLocaleString('zh-CN') : '';
          doc.fillColor('#6b7280').fontSize(10)
            .text(`${typeLabel} | ${c.category || '未分类'} | ${dateStr}`, {
              width: pageWidth,
            });
          doc.moveDown(0.5);

          // 内容
          if (c.content) {
            doc.fillColor('#374151').fontSize(12).text(c.content, {
              width: pageWidth,
              lineGap: 4,
            });
            doc.moveDown(0.5);
          }

          // 标签
          if (options.includeTags && c.tags && c.tags.length > 0) {
            const tagNames = c.tags.map((t: any) => t.name).join(', ');
            doc.fillColor('#3b82f6').fontSize(10).text(`标签: ${tagNames}`, {
              width: pageWidth,
            });
            doc.moveDown(0.3);
          }

          // 分隔线（非最后一个）
          if (i < creativities.length - 1) {
            doc.moveDown(0.3);
            doc.moveTo(doc.page.margins.left, doc.y)
              .lineTo(doc.page.width - doc.page.margins.right, doc.y)
              .strokeColor('#e5e7eb')
              .lineWidth(0.5)
              .stroke();
            doc.moveDown(0.5);
          }
        }

        // 页脚
        const pageCount = doc.bufferedPageRange().count;
        for (let i = 0; i < pageCount; i++) {
          doc.switchToPage(i);
          doc.fillColor('#9ca3af').fontSize(8)
            .text(
              `第 ${i + 1} 页 / 共 ${pageCount} 页`,
              doc.page.margins.left,
              doc.page.height - 30,
              { align: 'center', width: pageWidth }
            );
        }

        doc.end();

        stream.on('finish', () => {
          try {
            const stats = fs.statSync(outputPath);
            resolve({
              success: true,
              filePath: outputPath,
              fileSize: stats.size,
            });
          } catch (err: any) {
            reject(err);
          }
        });

        stream.on('error', (err: Error) => {
          reject(err);
        });
      } catch (err: any) {
        reject(err);
      }
    });
  }

  /**
   * 导出为图片格式
   * 将创意卡片渲染为图片
   * 注意：实际图片生成需要集成图片处理库
   */
  private async exportImage(options: ExportOptions): Promise<ExportResult> {
    const creativities = this.getExportData(options);

    if (creativities.length === 0) {
      return { success: false, error: '没有可导出的创意' };
    }

    // 当前为框架实现
    // TODO: 集成sharp或canvas进行图片渲染
    const info = {
      message: '图片导出功能需要集成图片处理库',
      creativity_count: creativities.length,
    };

    const jsonPath = options.outputPath.replace(/\.(png|jpg|jpeg|webp)$/, '.json');
    fs.writeFileSync(jsonPath, JSON.stringify(info, null, 2), 'utf-8');

    const stats = fs.statSync(jsonPath);
    return {
      success: true,
      filePath: jsonPath,
      fileSize: stats.size,
    };
  }

  /**
   * 获取要导出的创意数据
   */
  private getExportData(options: ExportOptions) {
    // 如果指定了看板ID，导出看板中的创意
    if (options.boardId) {
      const board = this.boardRepo.findById(options.boardId);
      if (board && board.creativities) {
        return board.creativities;
      }
    }

    // 如果指定了创意ID列表
    if (options.creativityIds && options.creativityIds.length > 0) {
      return options.creativityIds
        .map((id) => this.creativityRepo.findById(id))
        .filter((c): c is NonNullable<typeof c> => c !== undefined);
    }

    // 默认导出所有活跃创意
    const result = this.creativityRepo.list({ status: 'active', limit: 1000 });
    return result.items;
  }

  /**
   * 构建导出用的HTML内容
   */
  private buildExportHTML(creativities: any[], options: ExportOptions): string {
    const items = creativities
      .map((c) => {
        let html = `<div class="creativity-card" style="border:1px solid #e5e7eb;border-radius:8px;padding:16px;margin-bottom:16px;">`;
        html += `<h2 style="margin:0 0 8px;color:#1f2937;">${this.escapeHtml(c.title)}</h2>`;
        html += `<div style="color:#6b7280;font-size:12px;margin-bottom:8px;">${c.category} | ${c.created_at}</div>`;
        html += `<div style="color:#374151;line-height:1.6;">${this.escapeHtml(c.content)}</div>`;

        if (options.includeTags && c.tags && c.tags.length > 0) {
          html += `<div style="margin-top:8px;">`;
          c.tags.forEach((t: any) => {
            html += `<span style="display:inline-block;background:${t.color};color:white;padding:2px 8px;border-radius:12px;font-size:12px;margin-right:4px;">${this.escapeHtml(t.name)}</span>`;
          });
          html += `</div>`;
        }

        html += `</div>`;
        return html;
      })
      .join('\n');

    return `<!DOCTYPE html>
<html lang="zh-CN">
<head>
  <meta charset="UTF-8">
  <title>脑洞集 - 导出数据</title>
  <style>
    body { font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif; max-width: 800px; margin: 0 auto; padding: 24px; background: #f9fafb; }
    h1 { color: #111827; border-bottom: 2px solid #3b82f6; padding-bottom: 8px; }
    .meta { color: #6b7280; font-size: 14px; }
  </style>
</head>
<body>
  <h1>脑洞集 - 导出数据</h1>
  <p class="meta">导出时间：${formatTimeLocal()} | 共 ${creativities.length} 条创意</p>
  ${items}
</body>
</html>`;
  }

  /**
   * HTML转义，防止XSS
   */
  private escapeHtml(text: string): string {
    return text
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;')
      .replace(/'/g, '&#039;');
  }
}
