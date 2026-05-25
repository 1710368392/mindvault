/**
 * 导出服务
 * 支持将创意数据导出为PDF、图片、JSON格式
 */
var __awaiter = (this && this.__awaiter) || function (thisArg, _arguments, P, generator) {
    function adopt(value) { return value instanceof P ? value : new P(function (resolve) { resolve(value); }); }
    return new (P || (P = Promise))(function (resolve, reject) {
        function fulfilled(value) { try { step(generator.next(value)); } catch (e) { reject(e); } }
        function rejected(value) { try { step(generator["throw"](value)); } catch (e) { reject(e); } }
        function step(result) { result.done ? resolve(result.value) : adopt(result.value).then(fulfilled, rejected); }
        step((generator = generator.apply(thisArg, _arguments || [])).next());
    });
};
var __generator = (this && this.__generator) || function (thisArg, body) {
    var _ = { label: 0, sent: function() { if (t[0] & 1) throw t[1]; return t[1]; }, trys: [], ops: [] }, f, y, t, g = Object.create((typeof Iterator === "function" ? Iterator : Object).prototype);
    return g.next = verb(0), g["throw"] = verb(1), g["return"] = verb(2), typeof Symbol === "function" && (g[Symbol.iterator] = function() { return this; }), g;
    function verb(n) { return function (v) { return step([n, v]); }; }
    function step(op) {
        if (f) throw new TypeError("Generator is already executing.");
        while (g && (g = 0, op[0] && (_ = 0)), _) try {
            if (f = 1, y && (t = op[0] & 2 ? y["return"] : op[0] ? y["throw"] || ((t = y["return"]) && t.call(y), 0) : y.next) && !(t = t.call(y, op[1])).done) return t;
            if (y = 0, t) op = [op[0] & 2, t.value];
            switch (op[0]) {
                case 0: case 1: t = op; break;
                case 4: _.label++; return { value: op[1], done: false };
                case 5: _.label++; y = op[1]; op = [0]; continue;
                case 7: op = _.ops.pop(); _.trys.pop(); continue;
                default:
                    if (!(t = _.trys, t = t.length > 0 && t[t.length - 1]) && (op[0] === 6 || op[0] === 2)) { _ = 0; continue; }
                    if (op[0] === 3 && (!t || (op[1] > t[0] && op[1] < t[3]))) { _.label = op[1]; break; }
                    if (op[0] === 6 && _.label < t[1]) { _.label = t[1]; t = op; break; }
                    if (t && _.label < t[2]) { _.label = t[2]; _.ops.push(op); break; }
                    if (t[2]) _.ops.pop();
                    _.trys.pop(); continue;
            }
            op = body.call(thisArg, _);
        } catch (e) { op = [6, e]; y = 0; } finally { f = t = 0; }
        if (op[0] & 5) throw op[1]; return { value: op[0] ? op[1] : void 0, done: true };
    }
};
import fs from 'fs';
import PDFDocument from 'pdfkit';
import { formatTimeLocal } from '../utils';
var ExportService = /** @class */ (function () {
    function ExportService(creativityRepo, boardRepo, userDataPath) {
        this.creativityRepo = creativityRepo;
        this.boardRepo = boardRepo;
        this.userDataPath = userDataPath;
    }
    /**
     * 导出数据
     * @param options - 导出选项
     */
    ExportService.prototype.export = function (options) {
        return __awaiter(this, void 0, void 0, function () {
            return __generator(this, function (_a) {
                try {
                    switch (options.format) {
                        case 'json':
                            return [2 /*return*/, this.exportJSON(options)];
                        case 'pdf':
                            return [2 /*return*/, this.exportPDF(options)];
                        case 'image':
                            return [2 /*return*/, this.exportImage(options)];
                        default:
                            return [2 /*return*/, { success: false, error: "\u4E0D\u652F\u6301\u7684\u5BFC\u51FA\u683C\u5F0F: ".concat(options.format) }];
                    }
                }
                catch (error) {
                    return [2 /*return*/, { success: false, error: error.message }];
                }
                return [2 /*return*/];
            });
        });
    };
    /**
     * 导出为JSON格式
     * 将创意数据序列化为JSON文件
     */
    ExportService.prototype.exportJSON = function (options) {
        return __awaiter(this, void 0, void 0, function () {
            var creativities, exportData, jsonContent, stats;
            return __generator(this, function (_a) {
                creativities = this.getExportData(options);
                exportData = {
                    app: '脑洞集(MindVault)',
                    version: '1.0.0',
                    exported_at: formatTimeLocal(),
                    data: creativities.map(function (c) {
                        var item = {
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
                            item.tags = c.tags.map(function (t) { return ({ name: t.name, color: t.color }); });
                        }
                        if (options.includeMedia && c.media) {
                            item.media = c.media.map(function (m) { return ({
                                filename: m.filename,
                                mime_type: m.mime_type,
                                file_size: m.file_size,
                            }); });
                        }
                        return item;
                    }),
                };
                jsonContent = JSON.stringify(exportData, null, 2);
                fs.writeFileSync(options.outputPath, jsonContent, 'utf-8');
                stats = fs.statSync(options.outputPath);
                return [2 /*return*/, {
                        success: true,
                        filePath: options.outputPath,
                        fileSize: stats.size,
                    }];
            });
        });
    };
    /**
     * 导出为PDF格式
     * 使用pdfkit生成包含创意内容的PDF文档
     */
    ExportService.prototype.exportPDF = function (options) {
        return __awaiter(this, void 0, void 0, function () {
            var creativities, outputPath;
            return __generator(this, function (_a) {
                creativities = this.getExportData(options);
                if (creativities.length === 0) {
                    return [2 /*return*/, { success: false, error: '没有可导出的创意' }];
                }
                outputPath = options.outputPath.replace(/\.html$/, '.pdf');
                if (!outputPath.endsWith('.pdf')) {
                    return [2 /*return*/, { success: false, error: 'PDF导出路径必须以.pdf结尾' }];
                }
                return [2 /*return*/, new Promise(function (resolve, reject) {
                        try {
                            var doc = new PDFDocument({
                                size: 'A4',
                                margins: { top: 50, bottom: 50, left: 50, right: 50 },
                                info: {
                                    Title: '脑洞集 - 创意导出',
                                    Author: 'MindVault',
                                    Creator: 'MindVault',
                                    CreationDate: new Date(),
                                },
                            });
                            var stream = fs.createWriteStream(outputPath);
                            doc.pipe(stream);
                            // 尝试加载中文字体
                            var chineseFontPaths = [
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
                            var fontLoaded = false;
                            for (var _i = 0, chineseFontPaths_1 = chineseFontPaths; _i < chineseFontPaths_1.length; _i++) {
                                var fontPath = chineseFontPaths_1[_i];
                                if (fs.existsSync(fontPath)) {
                                    doc.font(fontPath);
                                    fontLoaded = true;
                                    console.log("[\u5BFC\u51FA] \u4F7F\u7528\u4E2D\u6587\u5B57\u4F53: ".concat(fontPath));
                                    break;
                                }
                            }
                            if (!fontLoaded) {
                                console.warn('[导出] 未找到中文字体，使用默认字体（中文可能无法正常显示）');
                            }
                            // 页面尺寸
                            var pageWidth = doc.page.width - doc.page.margins.left - doc.page.margins.right;
                            // 标题页
                            doc.fontSize(28).text('脑洞集 - 创意导出', { align: 'center' });
                            doc.moveDown(0.5);
                            doc.fontSize(12).fillColor('#666666')
                                .text("\u5BFC\u51FA\u65F6\u95F4\uFF1A".concat(formatTimeLocal()), { align: 'center' })
                                .text("\u5171 ".concat(creativities.length, " \u6761\u521B\u610F"), { align: 'center' });
                            doc.moveDown(1);
                            // 分隔线
                            doc.moveTo(doc.page.margins.left, doc.y)
                                .lineTo(doc.page.width - doc.page.margins.right, doc.y)
                                .strokeColor('#3b82f6')
                                .lineWidth(2)
                                .stroke();
                            doc.moveDown(1);
                            // 类型标签映射
                            var typeLabels = {
                                text: '文本',
                                image: '图片',
                                link: '链接',
                                file: '文件',
                                mixed: '混合',
                            };
                            // 遍历每个创意
                            for (var i = 0; i < creativities.length; i++) {
                                var c = creativities[i];
                                // 检查是否需要新页面（留出足够空间）
                                var estimatedHeight = 120 + (c.content ? c.content.length * 0.5 : 0);
                                if (doc.y + estimatedHeight > doc.page.height - doc.page.margins.bottom) {
                                    doc.addPage();
                                }
                                // 标题
                                doc.fillColor('#111827').fontSize(18).text(c.title || '', {
                                    width: pageWidth,
                                });
                                doc.moveDown(0.3);
                                // 类型标签和日期
                                var typeLabel = typeLabels[c.content_type] || c.content_type || '未知';
                                var dateStr = c.created_at ? new Date(c.created_at).toLocaleString('zh-CN') : '';
                                doc.fillColor('#6b7280').fontSize(10)
                                    .text("".concat(typeLabel, " | ").concat(c.category || '未分类', " | ").concat(dateStr), {
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
                                    var tagNames = c.tags.map(function (t) { return t.name; }).join(', ');
                                    doc.fillColor('#3b82f6').fontSize(10).text("\u6807\u7B7E: ".concat(tagNames), {
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
                            var pageCount = doc.bufferedPageRange().count;
                            for (var i = 0; i < pageCount; i++) {
                                doc.switchToPage(i);
                                doc.fillColor('#9ca3af').fontSize(8)
                                    .text("\u7B2C ".concat(i + 1, " \u9875 / \u5171 ").concat(pageCount, " \u9875"), doc.page.margins.left, doc.page.height - 30, { align: 'center', width: pageWidth });
                            }
                            doc.end();
                            stream.on('finish', function () {
                                try {
                                    var stats = fs.statSync(outputPath);
                                    resolve({
                                        success: true,
                                        filePath: outputPath,
                                        fileSize: stats.size,
                                    });
                                }
                                catch (err) {
                                    reject(err);
                                }
                            });
                            stream.on('error', function (err) {
                                reject(err);
                            });
                        }
                        catch (err) {
                            reject(err);
                        }
                    })];
            });
        });
    };
    /**
     * 导出为图片格式
     * 将创意卡片渲染为图片
     * 注意：实际图片生成需要集成图片处理库
     */
    ExportService.prototype.exportImage = function (options) {
        return __awaiter(this, void 0, void 0, function () {
            var creativities, info, jsonPath, stats;
            return __generator(this, function (_a) {
                creativities = this.getExportData(options);
                if (creativities.length === 0) {
                    return [2 /*return*/, { success: false, error: '没有可导出的创意' }];
                }
                info = {
                    message: '图片导出功能需要集成图片处理库',
                    creativity_count: creativities.length,
                };
                jsonPath = options.outputPath.replace(/\.(png|jpg|jpeg|webp)$/, '.json');
                fs.writeFileSync(jsonPath, JSON.stringify(info, null, 2), 'utf-8');
                stats = fs.statSync(jsonPath);
                return [2 /*return*/, {
                        success: true,
                        filePath: jsonPath,
                        fileSize: stats.size,
                    }];
            });
        });
    };
    /**
     * 获取要导出的创意数据
     */
    ExportService.prototype.getExportData = function (options) {
        var _this = this;
        // 如果指定了看板ID，导出看板中的创意
        if (options.boardId) {
            var board = this.boardRepo.findById(options.boardId);
            if (board && board.creativities) {
                return board.creativities;
            }
        }
        // 如果指定了创意ID列表
        if (options.creativityIds && options.creativityIds.length > 0) {
            return options.creativityIds
                .map(function (id) { return _this.creativityRepo.findById(id); })
                .filter(function (c) { return c !== undefined; });
        }
        // 默认导出所有活跃创意
        var result = this.creativityRepo.list({ status: 'active', limit: 1000 });
        return result.items;
    };
    /**
     * 构建导出用的HTML内容
     */
    ExportService.prototype.buildExportHTML = function (creativities, options) {
        var _this = this;
        var items = creativities
            .map(function (c) {
            var html = "<div class=\"creativity-card\" style=\"border:1px solid #e5e7eb;border-radius:8px;padding:16px;margin-bottom:16px;\">";
            html += "<h2 style=\"margin:0 0 8px;color:#1f2937;\">".concat(_this.escapeHtml(c.title), "</h2>");
            html += "<div style=\"color:#6b7280;font-size:12px;margin-bottom:8px;\">".concat(c.category, " | ").concat(c.created_at, "</div>");
            html += "<div style=\"color:#374151;line-height:1.6;\">".concat(_this.escapeHtml(c.content), "</div>");
            if (options.includeTags && c.tags && c.tags.length > 0) {
                html += "<div style=\"margin-top:8px;\">";
                c.tags.forEach(function (t) {
                    html += "<span style=\"display:inline-block;background:".concat(t.color, ";color:white;padding:2px 8px;border-radius:12px;font-size:12px;margin-right:4px;\">").concat(_this.escapeHtml(t.name), "</span>");
                });
                html += "</div>";
            }
            html += "</div>";
            return html;
        })
            .join('\n');
        return "<!DOCTYPE html>\n<html lang=\"zh-CN\">\n<head>\n  <meta charset=\"UTF-8\">\n  <title>\u8111\u6D1E\u96C6 - \u5BFC\u51FA\u6570\u636E</title>\n  <style>\n    body { font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif; max-width: 800px; margin: 0 auto; padding: 24px; background: #f9fafb; }\n    h1 { color: #111827; border-bottom: 2px solid #3b82f6; padding-bottom: 8px; }\n    .meta { color: #6b7280; font-size: 14px; }\n  </style>\n</head>\n<body>\n  <h1>\u8111\u6D1E\u96C6 - \u5BFC\u51FA\u6570\u636E</h1>\n  <p class=\"meta\">\u5BFC\u51FA\u65F6\u95F4\uFF1A".concat(formatTimeLocal(), " | \u5171 ").concat(creativities.length, " \u6761\u521B\u610F</p>\n  ").concat(items, "\n</body>\n</html>");
    };
    /**
     * HTML转义，防止XSS
     */
    ExportService.prototype.escapeHtml = function (text) {
        return text
            .replace(/&/g, '&amp;')
            .replace(/</g, '&lt;')
            .replace(/>/g, '&gt;')
            .replace(/"/g, '&quot;')
            .replace(/'/g, '&#039;');
    };
    return ExportService;
}());
export { ExportService };
