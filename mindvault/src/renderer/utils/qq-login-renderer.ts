// @ts-nocheck
/**
 * QQ 扫码登录 - 渲染进程直接请求
 * 在渲染进程中使用 fetch 发起请求（Chromium 网络栈，不会被 TLS 指纹检测拦截）
 */

const APPID = '716027609';
const DAID = '383';
const UA = 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36';

// 会话状态（模块级）
let sessionCookies: Record<string, string> = {};
let sessionPtLoginSig = '';
let sessionPtqrtoken = 0;
let sessionStatus: string = 'none';

/**
 * hash33 算法
 */
function hash33(str: string): number {
  let hash = 0;
  for (let i = 0; i < str.length; i++) {
    hash += (hash << 5) + str.charCodeAt(i);
    hash = hash & 0x7fffffff;
  }
  return hash;
}

/**
 * 构建 cookie 字符串
 */
function buildCookie(): string {
  return Object.entries(sessionCookies)
    .map(([k, v]) => `${k}=${v}`)
    .join('; ');
}

/**
 * 发起 fetch 请求，自动管理 cookies
 */
async function qqFetch(url: string, init?: RequestInit): Promise<{ status: number; headers: Headers; body: ArrayBuffer; text: string }> {
  const headers: Record<string, string> = {
    'User-Agent': UA,
    ...(init?.headers as Record<string, string> || {}),
  };

  const cookieStr = buildCookie();
  if (cookieStr) {
    // fetch 在 Electron 渲染进程中会自动处理 cookie，但我们手动管理
    headers['Cookie'] = cookieStr;
  }

  const resp = await fetch(url, {
    ...init,
    headers,
    credentials: 'omit', // 我们手动管理 cookie
    redirect: 'manual', // 不跟随重定向
  });

  const body = await resp.arrayBuffer();
  const text = new TextDecoder().decode(body);

  // 从 set-cookie 头解析 cookies（fetch 不会自动暴露 set-cookie）
  // 在 Electron 渲染进程中，set-cookie 可能不直接暴露
  // 我们需要从响应头中提取
  const allHeaders = resp.headers;
  // 注意：fetch API 不直接暴露 Set-Cookie，需要用 getAllHeaders
  // 但在 Electron 中可以通过其他方式获取

  return { status: resp.status, headers: resp.headers, body, text };
}

/**
 * 使用 XMLHttpRequest 发请求（可以获取 set-cookie）
 */
function qqRequest(url: string, method = 'GET'): Promise<{ status: number; responseText: string; responseHeaders: Record<string, string>; responseArrayBuffer: ArrayBuffer }> {
  return new Promise((resolve, reject) => {
    const xhr = new XMLHttpRequest();
    xhr.open(method, url, true);
    xhr.timeout = 15000;
    xhr.responseType = 'arraybuffer';

    // 设置请求头
    xhr.setRequestHeader('User-Agent', UA);
    const cookieStr = buildCookie();
    if (cookieStr) {
      xhr.setRequestHeader('Cookie', cookieStr);
    }
    // 不设置 Accept 让浏览器自动处理

    xhr.onload = () => {
      const allHeaders: Record<string, string> = {};
      // getAllResponseHeaders 返回多行字符串
      const headerStr = xhr.getAllResponseHeaders();
      if (headerStr) {
        headerStr.split('\r\n').forEach(line => {
          const idx = line.indexOf(':');
          if (idx > 0) {
            const key = line.substring(0, idx).trim().toLowerCase();
            const val = line.substring(idx + 1).trim();
            allHeaders[key] = val;
          }
        });
      }

      // 解析 set-cookie
      const setCookieHeader = allHeaders['set-cookie'];
      if (setCookieHeader) {
        // 可能有多个 set-cookie，用逗号分隔（但不完全可靠）
        // 更好的方式：逐个解析
        setCookieHeader.split(/,(?=[^,]*=)/).forEach(sc => {
          const match = sc.match(/^([^=]+)=([^;]*)/);
          if (match) {
            sessionCookies[match[1].trim()] = match[2].trim();
          }
        });
      }

      resolve({
        status: xhr.status,
        responseText: new TextDecoder().decode(xhr.response),
        responseHeaders: allHeaders,
        responseArrayBuffer: xhr.response,
      });
    };

    xhr.onerror = () => reject(new Error('网络错误'));
    xhr.ontimeout = () => reject(new Error('请求超时'));
    xhr.send();
  });
}

/**
 * 第一步：初始化登录
 */
async function initLogin(): Promise<boolean> {
  sessionCookies = {};
  sessionPtLoginSig = '';
  sessionPtqrtoken = 0;
  sessionStatus = 'init';

  const params = new URLSearchParams({
    appid: APPID,
    daid: DAID,
    s_url: 'https://y.qq.com/',
    style: '33',
    low_login: '0',
    h: '1',
    g: '1',
  });

  try {
    const res = await qqRequest(
      `https://xui.ptlogin2.qq.com/cgi-bin/xlogin?${params.toString()}`
    );

    if (sessionCookies['pt_login_sig']) {
      sessionPtLoginSig = sessionCookies['pt_login_sig'];
    }

    console.log('[QQLogin-R] 初始化成功, pt_login_sig:', sessionPtLoginSig ? '已获取' : '未获取');
    console.log('[QQLogin-R] cookies:', Object.keys(sessionCookies).join(', '));
    return true;
  } catch (e) {
    console.error('[QQLogin-R] 初始化失败:', e.message);
    sessionStatus = 'error';
    return false;
  }
}

/**
 * 第二步：获取二维码
 */
async function getQRCode(): Promise<string | null> {
  if (sessionStatus === 'error') {
    await initLogin();
  }

  const t = Math.random();
  const params = new URLSearchParams({
    appid: APPID,
    daid: DAID,
    e: '2',
    l: 'M',
    s: '3',
    d: '72',
    v: '4',
    t: t.toString(),
    pt_3rd_aid: '0',
  });

  try {
    const res = await qqRequest(
      `https://ssl.ptlogin2.qq.com/ptqrshow?${params.toString()}`
    );

    const data = new Uint8Array(res.responseArrayBuffer);
    const isPng = data.length > 8 && data[0] === 0x89 && data[1] === 0x50 && data[2] === 0x4e && data[3] === 0x47;

    console.log('[QQLogin-R] ptqrshow: status=', res.status, 'len=', data.length, 'png=', isPng);

    if (res.status === 200 && isPng) {
      const base64 = btoa(String.fromCharCode(...data));
      sessionPtqrtoken = hash33(sessionCookies['qrsig'] || '');
      sessionStatus = 'waiting';
      console.log('[QQLogin-R] 二维码获取成功, ptqrtoken:', sessionPtqrtoken);
      console.log('[QQLogin-R] qrsig:', sessionCookies['qrsig'] ? sessionCookies['qrsig'].substring(0, 20) + '...' : 'MISSING');
      return `data:image/png;base64,${base64}`;
    } else {
      console.error('[QQLogin-R] 二维码获取失败, body:', res.responseText.substring(0, 200));
      sessionStatus = 'error';
      return null;
    }
  } catch (e) {
    console.error('[QQLogin-R] 二维码获取异常:', e.message);
    sessionStatus = 'error';
    return null;
  }
}

/**
 * 第三步：轮询扫码状态
 */
async function checkQRStatus(): Promise<{ status: string; message: string; cookie?: string }> {
  if (!sessionPtqrtoken) {
    return { status: 'error', message: '请先获取二维码' };
  }

  if (sessionStatus === 'success') {
    return { status: 'success', message: '登录成功', cookie: buildCookie() };
  }

  if (sessionStatus === 'expired' || sessionStatus === 'error') {
    return { status: sessionStatus, message: sessionStatus === 'expired' ? '二维码已过期' : '登录出错' };
  }

  const timestamp = Date.now();
  const action = `0-0-${timestamp}`;

  const params = new URLSearchParams({
    u1: 'https://y.qq.com/',
    ptqrtoken: sessionPtqrtoken.toString(),
    ptredirect: '0',
    h: '1',
    t: '1',
    g: '1',
    from_ui: '1',
    ptlang: '2052',
    action: action,
    js_ver: '24112717',
    js_type: '1',
    login_sig: sessionPtLoginSig || '',
    pt_uistyle: '40',
    aid: APPID,
    daid: DAID,
    pt_3rd_aid: '0',
  });

  try {
    const res = await qqRequest(
      `https://ssl.ptlogin2.qq.com/ptqrlogin?${params.toString()}`
    );

    console.log('[QQLogin-R] 轮询: status=', res.status, 'body=', res.responseText.substring(0, 200));

    if (res.status !== 200 || !res.responseText) {
      return { status: 'error', message: `请求失败 (${res.status})` };
    }

    const match = res.responseText.match(/ptuiCB\('(\d+)','(\d+)','(\d+)','(\d+)','([^']*)','([^']*)'\)/);

    if (!match) {
      return { status: 'error', message: '解析响应失败' };
    }

    const code = match[1];
    const message = match[5];
    const redirectUrl = match[6];

    switch (code) {
      case '0': {
        sessionStatus = 'success';

        // 跟随重定向获取更多 cookies
        if (redirectUrl && redirectUrl.startsWith('http')) {
          try {
            await qqRequest(redirectUrl);
            console.log('[QQLogin-R] 跟随重定向成功');
          } catch (e) {
            console.warn('[QQLogin-R] 跟随重定向失败:', e.message);
          }
        }

        const cookieStr = buildCookie();
        console.log('[QQLogin-R] 登录成功! Cookie 长度:', cookieStr.length);
        return { status: 'success', message: '登录成功', cookie: cookieStr };
      }

      case '65':
        sessionStatus = 'scanned';
        return { status: 'scanned', message: '二维码认证中，请稍候...' };

      case '66':
        return { status: 'waiting', message: '请使用手机 QQ 扫描二维码' };

      case '67':
        sessionStatus = 'expired';
        return { status: 'expired', message: '二维码已过期，请刷新' };

      default:
        return { status: 'error', message: message || '未知错误' };
    }
  } catch (e) {
    console.error('[QQLogin-R] 轮询异常:', e.message);
    return { status: 'error', message: '网络请求失败' };
  }
}

/**
 * 重置会话
 */
function resetLoginSession() {
  sessionCookies = {};
  sessionPtLoginSig = '';
  sessionPtqrtoken = 0;
  sessionStatus = 'none';
}

export const qqLoginRenderer = {
  initLogin,
  getQRCode,
  checkQRStatus,
  resetLogin: resetLoginSession,
};
