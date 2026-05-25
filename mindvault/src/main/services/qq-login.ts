// @ts-nocheck
/**
 * QQ 音乐登录服务 (主进程)
 * 弹出 QQ 音乐官方登录页面，用户扫码/密码登录后自动提取 Cookie
 */

const { BrowserWindow, session } = require('electron');

let loginWindow: any = null;
let loginResolve: ((cookie: string | null) => void) | null = null;
let loginResolved = false; // 防止重复 resolve

// QQ 音乐需要的关键 cookie 名称
const QQ_MUSIC_COOKIE_NAMES = [
  'uin', 'wxuin', 'openid', 'token', 'qqmusic_key',
  'qm_keyst', 'wxopenid', 'wxkey', 'refresh_token',
  'access_token', 'eas_sid', 'ftn_qq',
];

/**
 * 打开 QQ 音乐登录窗口
 * @returns {Promise<string | null>} 登录成功返回 cookie，用户关闭窗口返回 null
 */
function openLoginWindow(): Promise<string | null> {
  return new Promise(async (resolve) => {
    // 如果已有窗口，先关闭
    if (loginWindow && !loginWindow.isDestroyed()) {
      loginWindow.close();
    }

    loginResolve = resolve;
    loginResolved = false;

    // 清除旧的 QQ cookies
    await clearQQCookies();

    loginWindow = new BrowserWindow({
      width: 480,
      height: 680,
      title: 'QQ 音乐 - 登录',
      show: true,
      resizable: true,
      minimizable: true,
      maximizable: false,
      autoHideMenuBar: true,
      webPreferences: {
        nodeIntegration: false,
        contextIsolation: true,
        sandbox: true,
      },
    });

    // 加载 QQ 音乐登录页面
    loginWindow.loadURL('https://y.qq.com/');

    // 监听页面导航，检测是否登录成功
    loginWindow.webContents.on('did-navigate', async (event: any, url: string) => {
      console.log('[QQLogin] navigated to:', url);
      await checkLoginStatus();
    });

    loginWindow.webContents.on('did-navigate-in-page', async (event: any, url: string) => {
      console.log('[QQLogin] in-page navigate to:', url);
      await checkLoginStatus();
    });

    // 监听 cookies 变化
    session.defaultSession.cookies.on('changed', async (event: any, cookie: any, cause: any) => {
      // 只关注 QQ 域名的 cookie
      if (cookie.domain && (cookie.domain.includes('qq.com') || cookie.domain.includes('qq.cn'))) {
        console.log('[QQLogin] cookie changed:', cookie.name, '=', cookie.value ? cookie.value.substring(0, 10) + '...' : '(empty)', 'cause:', cause);
        // 延迟检查，等所有 cookie 写入完成
        setTimeout(() => checkLoginStatus(), 1000);
      }
    });

    // 窗口关闭 = 用户取消
    loginWindow.on('closed', () => {
      console.log('[QQLogin] 窗口关闭');
      loginWindow = null;
      loginResolved = true;
      const resolve = loginResolve;
      loginResolve = null;
      if (resolve) resolve(null);
    });

    // 初始加载后，注入一个"点击登录"的引导
    loginWindow.webContents.on('did-finish-load', () => {
      // 检查页面是否需要登录
      loginWindow.webContents.executeJavaScript(`
        // 尝试找到并点击登录按钮
        const loginBtn = document.querySelector('[data-eid="qd_login"]') ||
                         document.querySelector('.login_btn') ||
                         document.querySelector('.mod_login__btn') ||
                         document.querySelector('[class*="login"]');
        if (loginBtn) {
          loginBtn.click();
        }
      `).catch(() => {});
    });
  });
}

/**
 * 检查是否已登录成功（通过检测关键 cookie）
 */
async function checkLoginStatus() {
  if (!loginResolve || loginResolved) return;

  try {
    const cookies = await session.defaultSession.cookies.get({ domain: '.qq.com' });
    const cookieMap: Record<string, string> = {};
    for (const c of cookies) {
      cookieMap[c.name] = c.value;
    }

    // 检查是否有登录标识 cookie
    // QQ 音乐登录后会有 uin / wxuin / qqmusic_key 等
    const uin = cookieMap['uin'] || cookieMap['wxuin'] || '';
    const key = cookieMap['qqmusic_key'] || cookieMap['qm_keyst'] || '';

    if (uin && key) {
      console.log('[QQLogin] ✅ 检测到登录成功! uin=', uin, 'key=', key.substring(0, 10) + '...');

      // 构建完整 cookie 字符串
      const cookieStr = cookies
        .filter(c => c.domain.includes('qq.com'))
        .map(c => `${c.name}=${c.value}`)
        .join('; ');

      console.log('[QQLogin] Cookie 长度:', cookieStr.length);

      // 先 resolve，再关闭窗口（避免 closed 事件抢先置空 loginResolve）
      loginResolved = true;
      const resolve = loginResolve;
      loginResolve = null;
      if (typeof resolve === 'function') {
        resolve(cookieStr);
      } else {
        console.warn('[QQLogin] resolve is not a function, cookie not returned!');
      }

      // 关闭登录窗口（在 resolve 之后）
      if (loginWindow && !loginWindow.isDestroyed()) {
        loginWindow.close();
      }
    }
  } catch (e) {
    console.warn('[QQLogin] checkLoginStatus error:', e.message);
  }
}

/**
 * 清除 QQ 相关 cookies
 */
async function clearQQCookies() {
  try {
    const cookies = await session.defaultSession.cookies.get({});
    for (const c of cookies) {
      if (c.domain && (c.domain.includes('qq.com') || c.domain.includes('qq.cn'))) {
        try {
          const url = `https://${c.domain.startsWith('.') ? c.domain.substring(1) : c.domain}`;
          await session.defaultSession.cookies.remove(url, c.name);
        } catch {}
      }
    }
  } catch {}
}

/**
 * 获取当前登录窗口状态
 */
function getLoginWindowStatus() {
  if (!loginWindow || loginWindow.isDestroyed()) return 'closed';
  return 'open';
}

/**
 * 关闭登录窗口
 */
function closeLoginWindow() {
  if (loginWindow && !loginWindow.isDestroyed()) {
    loginWindow.close();
  }
  loginWindow = null;
  loginResolve = null;
}

module.exports = {
  openLoginWindow,
  closeLoginWindow,
  getLoginWindowStatus,
  clearQQCookies,
};
