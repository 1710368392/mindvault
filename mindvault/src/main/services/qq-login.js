"use strict";
// @ts-nocheck
/**
 * QQ 扫码登录服务
 * 实现 QQ ptlogin2 二维码登录协议，用于 QQ 音乐 Cookie 获取
 *
 * 流程：
 * 1. 请求 xlogin 获取 pt_login_sig
 * 2. 请求 ptqrshow 获取二维码图片 + qrsig
 * 3. 用 hash33(qrsig) 计算 ptqrtoken
 * 4. 轮询 ptqrlogin 检查扫码状态
 * 5. 扫码成功后跟随重定向获取最终 Cookie
 */
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
var https = require('https');
var http = require('http');
var URL = require('url').URL;
// QQ 音乐 appid
var APPID = '716027609';
var DAID = '383';
// 存储当前登录会话
var loginSession = null;
/**
 * hash33 算法 - 用于从 qrsig 计算 ptqrtoken
 */
function hash33(str) {
    var hash = 0;
    for (var i = 0; i < str.length; i++) {
        hash += (hash << 5) + str.charCodeAt(i);
        hash = hash & 0x7fffffff; // 保持 32 位正整数
    }
    return hash;
}
/**
 * 发起 HTTPS/HTTP 请求，返回 { statusCode, headers, body, cookies }
 */
function request(urlStr, options) {
    if (options === void 0) { options = {}; }
    return new Promise(function (resolve, reject) {
        var url = new URL(urlStr);
        var isHttps = url.protocol === 'https:';
        var lib = isHttps ? https : http;
        var reqOptions = {
            hostname: url.hostname,
            port: url.port || (isHttps ? 443 : 80),
            path: url.pathname + url.search,
            method: options.method || 'GET',
            headers: options.headers || {},
            timeout: options.timeout || 15000,
        };
        // 自动带上 session cookies
        if (loginSession && loginSession.cookies) {
            var existingCookie = reqOptions.headers['Cookie'] || '';
            var sessionCookie = Object.entries(loginSession.cookies)
                .map(function (_a) {
                var k = _a[0], v = _a[1];
                return "".concat(k, "=").concat(v);
            })
                .join('; ');
            reqOptions.headers['Cookie'] = sessionCookie
                ? "".concat(sessionCookie, "; ").concat(existingCookie).replace(/; $/, '')
                : existingCookie;
        }
        var req = lib.request(reqOptions, function (res) {
            var chunks = [];
            res.on('data', function (chunk) { return chunks.push(chunk); });
            res.on('end', function () {
                var body = Buffer.concat(chunks);
                // 解析响应 cookies
                var setCookies = res.headers['set-cookie'] || [];
                var newCookies = {};
                for (var _i = 0, setCookies_1 = setCookies; _i < setCookies_1.length; _i++) {
                    var sc = setCookies_1[_i];
                    var match = sc.match(/^([^=]+)=([^;]*)/);
                    if (match) {
                        newCookies[match[1].trim()] = match[2].trim();
                    }
                }
                // 更新 session cookies
                if (loginSession) {
                    loginSession.cookies = __assign(__assign({}, loginSession.cookies), newCookies);
                }
                resolve({
                    statusCode: res.statusCode,
                    headers: res.headers,
                    body: body,
                    cookies: newCookies,
                });
            });
        });
        req.on('error', reject);
        req.on('timeout', function () {
            req.destroy();
            reject(new Error('请求超时'));
        });
        if (options.body) {
            req.write(options.body);
        }
        req.end();
    });
}
/**
 * 第一步：初始化登录，获取 pt_login_sig
 */
function initLogin() {
    return __awaiter(this, void 0, void 0, function () {
        var params, res, e_1;
        return __generator(this, function (_a) {
            switch (_a.label) {
                case 0:
                    // 重置 session
                    loginSession = {
                        cookies: {},
                        ptLoginSig: null,
                        qrsig: null,
                        ptqrtoken: null,
                        qrImageData: null,
                        status: 'init',
                    };
                    params = new URLSearchParams({
                        appid: APPID,
                        daid: DAID,
                        s_url: 'https://y.qq.com/',
                        style: 33,
                        low_login: '0',
                        h: 1,
                        g: 1,
                    });
                    _a.label = 1;
                case 1:
                    _a.trys.push([1, 3, , 4]);
                    return [4 /*yield*/, request("https://xui.ptlogin2.qq.com/cgi-bin/xlogin?".concat(params.toString()), {
                            headers: {
                                'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
                                Referer: 'https://y.qq.com/',
                            },
                        })];
                case 2:
                    res = _a.sent();
                    // pt_login_sig 会通过 Set-Cookie 返回
                    if (loginSession.cookies['pt_login_sig']) {
                        loginSession.ptLoginSig = loginSession.cookies['pt_login_sig'];
                    }
                    console.log('[QQLogin] 初始化成功, pt_login_sig:', loginSession.ptLoginSig ? '已获取' : '未获取');
                    return [2 /*return*/, true];
                case 3:
                    e_1 = _a.sent();
                    console.error('[QQLogin] 初始化失败:', e_1.message);
                    loginSession.status = 'error';
                    return [2 /*return*/, false];
                case 4: return [2 /*return*/];
            }
        });
    });
}
/**
 * 第二步：获取二维码图片
 * @returns {string} base64 编码的 PNG 图片 (data:image/png;base64,...)
 */
function getQRCode() {
    return __awaiter(this, void 0, void 0, function () {
        var t, params, res, contentType, e_2;
        return __generator(this, function (_a) {
            switch (_a.label) {
                case 0:
                    if (!(!loginSession || loginSession.status === 'error')) return [3 /*break*/, 2];
                    return [4 /*yield*/, initLogin()];
                case 1:
                    _a.sent();
                    _a.label = 2;
                case 2:
                    t = Math.random();
                    params = new URLSearchParams({
                        appid: APPID,
                        daid: DAID,
                        e: '2',
                        l: 'M',
                        s: '3',
                        d: '72',
                        v: '4',
                        t: t.toString(),
                        daid: DAID,
                        pt_3rd_aid: '0',
                    });
                    _a.label = 3;
                case 3:
                    _a.trys.push([3, 5, , 6]);
                    return [4 /*yield*/, request("https://ssl.ptlogin2.qq.com/ptqrshow?".concat(params.toString()), {
                            headers: {
                                'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
                            },
                        })];
                case 4:
                    res = _a.sent();
                    contentType = res.headers['content-type'] || '';
                    if (res.statusCode === 200 && contentType.includes('image')) {
                        loginSession.qrImageData = "data:image/png;base64,".concat(res.body.toString('base64'));
                        loginSession.ptqrtoken = hash33(loginSession.cookies['qrsig'] || '');
                        loginSession.status = 'waiting';
                        console.log('[QQLogin] 二维码获取成功, ptqrtoken:', loginSession.ptqrtoken);
                        return [2 /*return*/, loginSession.qrImageData];
                    }
                    else {
                        console.error('[QQLogin] 二维码获取失败, status:', res.statusCode, 'content-type:', contentType);
                        loginSession.status = 'error';
                        return [2 /*return*/, null];
                    }
                    return [3 /*break*/, 6];
                case 5:
                    e_2 = _a.sent();
                    console.error('[QQLogin] 二维码获取异常:', e_2.message);
                    loginSession.status = 'error';
                    return [2 /*return*/, null];
                case 6: return [2 /*return*/];
            }
        });
    });
}
/**
 * 第三步：轮询扫码状态
 * @returns {{ status: string, message: string, cookie?: string }}
 *   status: 'waiting' | 'scanned' | 'expired' | 'success' | 'error'
 */
function checkQRStatus() {
    return __awaiter(this, void 0, void 0, function () {
        var timestamp, action, params, res, text, match, code, message, redirectUrl, _a, cookieStr, updatedCookie, e_3, e_4;
        return __generator(this, function (_b) {
            switch (_b.label) {
                case 0:
                    if (!loginSession || !loginSession.ptqrtoken) {
                        return [2 /*return*/, { status: 'error', message: '请先获取二维码' }];
                    }
                    if (loginSession.status === 'success') {
                        return [2 /*return*/, { status: 'success', message: '登录成功', cookie: loginSession.cookie }];
                    }
                    if (loginSession.status === 'expired' || loginSession.status === 'error') {
                        return [2 /*return*/, { status: loginSession.status, message: loginSession.status === 'expired' ? '二维码已过期' : '登录出错' }];
                    }
                    timestamp = Date.now();
                    action = "0-0-".concat(timestamp);
                    params = new URLSearchParams({
                        u1: 'https://y.qq.com/',
                        ptqrtoken: loginSession.ptqrtoken.toString(),
                        ptredirect: '0',
                        h: '1',
                        t: '1',
                        g: '1',
                        from_ui: '1',
                        ptlang: '2052',
                        action: action,
                        js_ver: '24112717',
                        js_type: '1',
                        login_sig: loginSession.ptLoginSig || '',
                        pt_uistyle: '40',
                        aid: APPID,
                        daid: DAID,
                        pt_3rd_aid: '0',
                    });
                    _b.label = 1;
                case 1:
                    _b.trys.push([1, 13, , 14]);
                    return [4 /*yield*/, request("https://ssl.ptlogin2.qq.com/ptqrlogin?".concat(params.toString()), {
                            headers: {
                                'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
                                Referer: 'https://xui.ptlogin2.qq.com/',
                            },
                        })];
                case 2:
                    res = _b.sent();
                    text = res.body.toString('utf-8');
                    console.log('[QQLogin] 轮询响应:', text);
                    match = text.match(/ptuiCB\('(\d+)','(\d+)','(\d+)','(\d+)','([^']*)','([^']*)'\)/);
                    if (!match) {
                        return [2 /*return*/, { status: 'error', message: '解析响应失败' }];
                    }
                    code = match[1];
                    message = match[5];
                    redirectUrl = match[6];
                    _a = code;
                    switch (_a) {
                        case '0': return [3 /*break*/, 3];
                        case '65': return [3 /*break*/, 8];
                        case '66': return [3 /*break*/, 9];
                        case '67': return [3 /*break*/, 10];
                    }
                    return [3 /*break*/, 11];
                case 3:
                    // 登录成功！需要跟随重定向获取完整 cookies
                    loginSession.status = 'success';
                    cookieStr = Object.entries(loginSession.cookies)
                        .map(function (_a) {
                        var k = _a[0], v = _a[1];
                        return "".concat(k, "=").concat(v);
                    })
                        .join('; ');
                    loginSession.cookie = cookieStr;
                    console.log('[QQLogin] 登录成功! Cookie 长度:', cookieStr.length);
                    if (!(redirectUrl && redirectUrl.startsWith('http'))) return [3 /*break*/, 7];
                    _b.label = 4;
                case 4:
                    _b.trys.push([4, 6, , 7]);
                    return [4 /*yield*/, request(redirectUrl, {
                            headers: {
                                'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
                                Referer: 'https://xui.ptlogin2.qq.com/',
                            },
                        })];
                case 5:
                    _b.sent();
                    updatedCookie = Object.entries(loginSession.cookies)
                        .map(function (_a) {
                        var k = _a[0], v = _a[1];
                        return "".concat(k, "=").concat(v);
                    })
                        .join('; ');
                    loginSession.cookie = updatedCookie;
                    console.log('[QQLogin] 跟随重定向后 Cookie 长度:', updatedCookie.length);
                    return [3 /*break*/, 7];
                case 6:
                    e_3 = _b.sent();
                    console.warn('[QQLogin] 跟随重定向失败:', e_3.message);
                    return [3 /*break*/, 7];
                case 7: return [2 /*return*/, {
                        status: 'success',
                        message: '登录成功',
                        cookie: loginSession.cookie,
                    }];
                case 8:
                    loginSession.status = 'scanned';
                    return [2 /*return*/, { status: 'scanned', message: '二维码认证中，请稍候...' }];
                case 9: return [2 /*return*/, { status: 'waiting', message: '请使用手机 QQ 扫描二维码' }];
                case 10:
                    loginSession.status = 'expired';
                    return [2 /*return*/, { status: 'expired', message: '二维码已过期，请刷新' }];
                case 11: return [2 /*return*/, { status: 'error', message: message || '未知错误' }];
                case 12: return [3 /*break*/, 14];
                case 13:
                    e_4 = _b.sent();
                    console.error('[QQLogin] 轮询异常:', e_4.message);
                    return [2 /*return*/, { status: 'error', message: '网络请求失败' }];
                case 14: return [2 /*return*/];
            }
        });
    });
}
/**
 * 重置登录会话
 */
function resetLogin() {
    loginSession = null;
}
/**
 * 获取当前登录状态
 */
function getLoginStatus() {
    if (!loginSession)
        return { status: 'none', message: '' };
    return {
        status: loginSession.status,
        message: '',
        hasQR: !!loginSession.qrImageData,
    };
}
module.exports = {
    initLogin: initLogin,
    getQRCode: getQRCode,
    checkQRStatus: checkQRStatus,
    resetLogin: resetLogin,
    getLoginStatus: getLoginStatus,
};
