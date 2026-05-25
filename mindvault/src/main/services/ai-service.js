var __assign = (this && this.__assign) || function () {
    __assign = Object.assign || function(t) {
        for (var s, i = 1, n = arguments.length; i < n; i++) {
            s = arguments[i];
            for (var p in s) if (Object.prototype.hasOwnProperty.call(s, p))
                t[p] = s[p];
        }
        return t;
    };
    return __assign.apply(this, arguments);
};
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
var __asyncValues = (this && this.__asyncValues) || function (o) {
    if (!Symbol.asyncIterator) throw new TypeError("Symbol.asyncIterator is not defined.");
    var m = o[Symbol.asyncIterator], i;
    return m ? m.call(o) : (o = typeof __values === "function" ? __values(o) : o[Symbol.iterator](), i = {}, verb("next"), verb("throw"), verb("return"), i[Symbol.asyncIterator] = function () { return this; }, i);
    function verb(n) { i[n] = o[n] && function (v) { return new Promise(function (resolve, reject) { v = o[n](v), settle(resolve, reject, v.done, v.value); }); }; }
    function settle(resolve, reject, d, v) { Promise.resolve(v).then(function(v) { resolve({ value: v, done: d }); }, reject); }
};
/**
 * AI 统一服务层
 * 支持 OpenAI / Anthropic / 自定义 OpenAI 兼容 API
 */
import OpenAI from 'openai';
import Anthropic from '@anthropic-ai/sdk';
// 当前活跃的流式请求控制器，用于中止生成
var currentAbortController = null;
export function stopGeneration() {
    if (currentAbortController) {
        currentAbortController.abort();
        currentAbortController = null;
    }
}
/**
 * 非流式对话
 */
export function chat(config, messages) {
    return __awaiter(this, void 0, void 0, function () {
        return __generator(this, function (_a) {
            if (config.provider === 'anthropic') {
                return [2 /*return*/, chatAnthropic(config, messages)];
            }
            return [2 /*return*/, chatOpenAICompatible(withProviderDefaults(config), messages)];
        });
    });
}
/**
 * 流式对话 - 通过回调返回 token
 * 返回完整文本
 */
export function chatStream(config, messages, onToken, signal) {
    return __awaiter(this, void 0, void 0, function () {
        return __generator(this, function (_a) {
            if (config.provider === 'anthropic') {
                return [2 /*return*/, streamAnthropic(config, messages, onToken, signal)];
            }
            return [2 /*return*/, streamOpenAICompatible(withProviderDefaults(config), messages, onToken, signal)];
        });
    });
}
/**
 * 测试连接
 */
export function testConnection(config) {
    return __awaiter(this, void 0, void 0, function () {
        var start, messages, latency, err_1, latency;
        return __generator(this, function (_a) {
            switch (_a.label) {
                case 0:
                    start = Date.now();
                    _a.label = 1;
                case 1:
                    _a.trys.push([1, 3, , 4]);
                    messages = [{ role: 'user', content: 'Hi' }];
                    return [4 /*yield*/, chat(config, messages)];
                case 2:
                    _a.sent();
                    latency = Date.now() - start;
                    return [2 /*return*/, { success: true, latency: latency }];
                case 3:
                    err_1 = _a.sent();
                    latency = Date.now() - start;
                    return [2 /*return*/, { success: false, latency: latency, error: err_1.message || String(err_1) }];
                case 4: return [2 /*return*/];
            }
        });
    });
}
/**
 * 获取模型列表（仅 OpenAI 兼容）
 */
export function listModels(config) {
    return __awaiter(this, void 0, void 0, function () {
        var baseUrl, response, data, models, err_2;
        return __generator(this, function (_a) {
            switch (_a.label) {
                case 0:
                    _a.trys.push([0, 3, , 4]);
                    if (config.provider === 'anthropic') {
                        // Anthropic 不提供公开的模型列表 API，返回预设
                        return [2 /*return*/, [
                                'claude-opus-4-7',
                                'claude-sonnet-4-6',
                                'claude-haiku-4',
                            ]];
                    }
                    baseUrl = config.baseUrl || 'https://api.openai.com/v1';
                    return [4 /*yield*/, fetch("".concat(baseUrl, "/models"), {
                            headers: {
                                'Authorization': "Bearer ".concat(config.apiKey),
                                'Content-Type': 'application/json',
                            },
                            signal: AbortSignal.timeout(10000),
                        })];
                case 1:
                    response = _a.sent();
                    if (!response.ok) {
                        throw new Error("HTTP ".concat(response.status, ": ").concat(response.statusText));
                    }
                    return [4 /*yield*/, response.json()];
                case 2:
                    data = _a.sent();
                    models = (data.data || [])
                        .map(function (m) { return m.id; })
                        .sort();
                    return [2 /*return*/, models];
                case 3:
                    err_2 = _a.sent();
                    console.error('[AI] 获取模型列表失败:', err_2);
                    throw err_2;
                case 4: return [2 /*return*/];
            }
        });
    });
}
// ===== OpenAI 兼容实现 =====
function chatOpenAICompatible(config, messages) {
    return __awaiter(this, void 0, void 0, function () {
        var client, response;
        var _a, _b;
        return __generator(this, function (_c) {
            switch (_c.label) {
                case 0:
                    client = createOpenAIClient(config);
                    return [4 /*yield*/, client.chat.completions.create({
                            model: config.model,
                            messages: messages.map(function (m) { return ({ role: m.role, content: m.content }); }),
                            max_tokens: 4096,
                        })];
                case 1:
                    response = _c.sent();
                    return [2 /*return*/, ((_b = (_a = response.choices[0]) === null || _a === void 0 ? void 0 : _a.message) === null || _b === void 0 ? void 0 : _b.content) || ''];
            }
        });
    });
}
function streamOpenAICompatible(config, messages, onToken, signal) {
    return __awaiter(this, void 0, void 0, function () {
        var controller, client, fullText, stream, _a, _b, _c, chunk, delta, e_1_1;
        var _d, e_1, _e, _f;
        var _g, _h;
        return __generator(this, function (_j) {
            switch (_j.label) {
                case 0:
                    controller = new AbortController();
                    currentAbortController = controller;
                    // 如果外部 signal 触发，也中止内部 controller
                    if (signal) {
                        signal.addEventListener('abort', function () { return controller.abort(); });
                    }
                    client = createOpenAIClient(config);
                    fullText = '';
                    _j.label = 1;
                case 1:
                    _j.trys.push([1, , 15, 16]);
                    return [4 /*yield*/, client.chat.completions.create({
                            model: config.model,
                            messages: messages.map(function (m) { return ({ role: m.role, content: m.content }); }),
                            max_tokens: 4096,
                            stream: true,
                        }, { signal: controller.signal })];
                case 2:
                    stream = _j.sent();
                    _j.label = 3;
                case 3:
                    _j.trys.push([3, 8, 9, 14]);
                    _a = true, _b = __asyncValues(stream);
                    _j.label = 4;
                case 4: return [4 /*yield*/, _b.next()];
                case 5:
                    if (!(_c = _j.sent(), _d = _c.done, !_d)) return [3 /*break*/, 7];
                    _f = _c.value;
                    _a = false;
                    chunk = _f;
                    delta = (_h = (_g = chunk.choices[0]) === null || _g === void 0 ? void 0 : _g.delta) === null || _h === void 0 ? void 0 : _h.content;
                    if (delta) {
                        fullText += delta;
                        onToken(delta);
                    }
                    _j.label = 6;
                case 6:
                    _a = true;
                    return [3 /*break*/, 4];
                case 7: return [3 /*break*/, 14];
                case 8:
                    e_1_1 = _j.sent();
                    e_1 = { error: e_1_1 };
                    return [3 /*break*/, 14];
                case 9:
                    _j.trys.push([9, , 12, 13]);
                    if (!(!_a && !_d && (_e = _b.return))) return [3 /*break*/, 11];
                    return [4 /*yield*/, _e.call(_b)];
                case 10:
                    _j.sent();
                    _j.label = 11;
                case 11: return [3 /*break*/, 13];
                case 12:
                    if (e_1) throw e_1.error;
                    return [7 /*endfinally*/];
                case 13: return [7 /*endfinally*/];
                case 14: return [3 /*break*/, 16];
                case 15:
                    currentAbortController = null;
                    return [7 /*endfinally*/];
                case 16: return [2 /*return*/, fullText];
            }
        });
    });
}
// ===== Provider 默认配置 =====
var PROVIDER_DEFAULTS = {
    deepseek: {
        baseUrl: 'https://api.deepseek.com/v1',
    },
};
function withProviderDefaults(config) {
    var defaults = PROVIDER_DEFAULTS[config.provider];
    if (!defaults)
        return config;
    return __assign(__assign({}, config), { baseUrl: config.baseUrl || defaults.baseUrl });
}
function createOpenAIClient(config) {
    return new OpenAI({
        apiKey: config.apiKey,
        baseURL: config.baseUrl || undefined,
    });
}
// ===== Anthropic 实现 =====
function chatAnthropic(config, messages) {
    return __awaiter(this, void 0, void 0, function () {
        var client, _a, system, anthropicMessages, response;
        return __generator(this, function (_b) {
            switch (_b.label) {
                case 0:
                    client = new Anthropic({ apiKey: config.apiKey });
                    _a = convertToAnthropicMessages(messages), system = _a.system, anthropicMessages = _a.anthropicMessages;
                    return [4 /*yield*/, client.messages.create({
                            model: config.model,
                            max_tokens: 4096,
                            system: system || undefined,
                            messages: anthropicMessages,
                        })];
                case 1:
                    response = _b.sent();
                    return [2 /*return*/, response.content
                            .filter(function (block) { return block.type === 'text'; })
                            .map(function (block) { return block.text; })
                            .join('')];
            }
        });
    });
}
function streamAnthropic(config, messages, onToken, signal) {
    return __awaiter(this, void 0, void 0, function () {
        var controller, client, _a, system, anthropicMessages, fullText, stream, _b, _c, _d, event_1, text, e_2_1;
        var _e, e_2, _f, _g;
        var _h;
        return __generator(this, function (_j) {
            switch (_j.label) {
                case 0:
                    controller = new AbortController();
                    currentAbortController = controller;
                    if (signal) {
                        signal.addEventListener('abort', function () { return controller.abort(); });
                    }
                    client = new Anthropic({
                        apiKey: config.apiKey,
                    });
                    _a = convertToAnthropicMessages(messages), system = _a.system, anthropicMessages = _a.anthropicMessages;
                    fullText = '';
                    _j.label = 1;
                case 1:
                    _j.trys.push([1, , 15, 16]);
                    return [4 /*yield*/, client.messages.stream({
                            model: config.model,
                            max_tokens: 4096,
                            system: system || undefined,
                            messages: anthropicMessages,
                        }, { signal: controller.signal })];
                case 2:
                    stream = _j.sent();
                    _j.label = 3;
                case 3:
                    _j.trys.push([3, 8, 9, 14]);
                    _b = true, _c = __asyncValues(stream);
                    _j.label = 4;
                case 4: return [4 /*yield*/, _c.next()];
                case 5:
                    if (!(_d = _j.sent(), _e = _d.done, !_e)) return [3 /*break*/, 7];
                    _g = _d.value;
                    _b = false;
                    event_1 = _g;
                    if (event_1.type === 'content_block_delta' && ((_h = event_1.delta) === null || _h === void 0 ? void 0 : _h.type) === 'text_delta') {
                        text = event_1.delta.text;
                        if (text) {
                            fullText += text;
                            onToken(text);
                        }
                    }
                    _j.label = 6;
                case 6:
                    _b = true;
                    return [3 /*break*/, 4];
                case 7: return [3 /*break*/, 14];
                case 8:
                    e_2_1 = _j.sent();
                    e_2 = { error: e_2_1 };
                    return [3 /*break*/, 14];
                case 9:
                    _j.trys.push([9, , 12, 13]);
                    if (!(!_b && !_e && (_f = _c.return))) return [3 /*break*/, 11];
                    return [4 /*yield*/, _f.call(_c)];
                case 10:
                    _j.sent();
                    _j.label = 11;
                case 11: return [3 /*break*/, 13];
                case 12:
                    if (e_2) throw e_2.error;
                    return [7 /*endfinally*/];
                case 13: return [7 /*endfinally*/];
                case 14: return [3 /*break*/, 16];
                case 15:
                    currentAbortController = null;
                    return [7 /*endfinally*/];
                case 16: return [2 /*return*/, fullText];
            }
        });
    });
}
/**
 * 将通用消息格式转换为 Anthropic 格式
 * Anthropic 的 system 是独立参数，不在 messages 中
 */
function convertToAnthropicMessages(messages) {
    var system = '';
    var anthropicMessages = [];
    for (var _i = 0, messages_1 = messages; _i < messages_1.length; _i++) {
        var msg = messages_1[_i];
        if (msg.role === 'system') {
            system += (system ? '\n' : '') + msg.content;
        }
        else if (msg.role === 'user' || msg.role === 'assistant') {
            anthropicMessages.push({ role: msg.role, content: msg.content });
        }
    }
    return { system: system, anthropicMessages: anthropicMessages };
}
