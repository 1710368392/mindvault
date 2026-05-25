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
/**
 * AI IPC 处理器
 */
import { ipcMain, BrowserWindow } from 'electron';
import { chat, chatStream, stopGeneration, testConnection, listModels } from '../services/ai-service';
export function registerAIHandlers() {
    var _this = this;
    console.log('[IPC] AI处理器已注册');
    // 非流式对话
    ipcMain.handle('ai:chat', function (_event, messages, config) { return __awaiter(_this, void 0, void 0, function () {
        var result, err_1;
        return __generator(this, function (_a) {
            switch (_a.label) {
                case 0:
                    _a.trys.push([0, 2, , 3]);
                    return [4 /*yield*/, chat(config, messages)];
                case 1:
                    result = _a.sent();
                    return [2 /*return*/, { success: true, content: result }];
                case 2:
                    err_1 = _a.sent();
                    console.error('[IPC] AI对话失败:', err_1.message);
                    return [2 /*return*/, { success: false, error: err_1.message }];
                case 3: return [2 /*return*/];
            }
        });
    }); });
    // 流式对话
    ipcMain.handle('ai:chat-stream', function (event, messages, config) { return __awaiter(_this, void 0, void 0, function () {
        var win, fullText, err_2;
        return __generator(this, function (_a) {
            switch (_a.label) {
                case 0:
                    win = BrowserWindow.fromWebContents(event.sender);
                    if (!win)
                        return [2 /*return*/];
                    _a.label = 1;
                case 1:
                    _a.trys.push([1, 3, , 4]);
                    return [4 /*yield*/, chatStream(config, messages, function (token) {
                            // 通过 IPC 事件推送 token 到渲染进程
                            if (!win.isDestroyed()) {
                                win.webContents.send('ai:token', token);
                            }
                        })];
                case 2:
                    fullText = _a.sent();
                    // 流结束
                    if (!win.isDestroyed()) {
                        win.webContents.send('ai:stream-end', fullText);
                    }
                    return [2 /*return*/, { success: true }];
                case 3:
                    err_2 = _a.sent();
                    if (err_2.name === 'AbortError') {
                        if (!win.isDestroyed()) {
                            win.webContents.send('ai:stream-end', '');
                        }
                        return [2 /*return*/, { success: true, aborted: true }];
                    }
                    console.error('[IPC] AI流式对话失败:', err_2.message);
                    if (!win.isDestroyed()) {
                        win.webContents.send('ai:stream-error', err_2.message);
                    }
                    return [2 /*return*/, { success: false, error: err_2.message }];
                case 4: return [2 /*return*/];
            }
        });
    }); });
    // 中止生成
    ipcMain.handle('ai:stop-generation', function () { return __awaiter(_this, void 0, void 0, function () {
        return __generator(this, function (_a) {
            stopGeneration();
            return [2 /*return*/, { success: true }];
        });
    }); });
    // 测试连接
    ipcMain.handle('ai:test-connection', function (_event, config) { return __awaiter(_this, void 0, void 0, function () {
        return __generator(this, function (_a) {
            return [2 /*return*/, testConnection(config)];
        });
    }); });
    // 获取模型列表
    ipcMain.handle('ai:list-models', function (_event, config) { return __awaiter(_this, void 0, void 0, function () {
        var models, err_3;
        return __generator(this, function (_a) {
            switch (_a.label) {
                case 0:
                    _a.trys.push([0, 2, , 3]);
                    return [4 /*yield*/, listModels(config)];
                case 1:
                    models = _a.sent();
                    return [2 /*return*/, { success: true, models: models }];
                case 2:
                    err_3 = _a.sent();
                    console.error('[IPC] 获取模型列表失败:', err_3.message);
                    return [2 /*return*/, { success: false, error: err_3.message, models: [] }];
                case 3: return [2 /*return*/];
            }
        });
    }); });
}
