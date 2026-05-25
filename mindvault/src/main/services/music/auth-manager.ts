// @ts-nocheck

const repo = require('../db/repository');
const neteaseAdapter = require('./adapters/netease');
const qqAdapter = require('./adapters/qq');

const authState = {
  netease: { cookie: '', user: null },
  qq: { cookie: '', user: null },
};

function init() {
  try {
    const neteaseCookie = repo.getSetting('neteaseCookie');
    if (neteaseCookie) {
      authState.netease.cookie = neteaseCookie;
      neteaseAdapter.setAuth(neteaseCookie);
    }
  } catch {}

  try {
    const qqCookie = repo.getSetting('qqMusicCookie');
    if (qqCookie) {
      authState.qq.cookie = qqCookie;
      qqAdapter.setAuth(qqCookie);
    }
  } catch {}
}

function setAuth(platform, cookie) {
  if (!authState[platform]) return;
  authState[platform].cookie = cookie;

  const settingKey = platform === 'netease' ? 'neteaseCookie' : 'qqMusicCookie';
  try { repo.setSetting(settingKey, cookie); } catch {}

  const adapter = platform === 'netease' ? neteaseAdapter : qqAdapter;
  adapter.setAuth(cookie);
}

function getAuth(platform) {
  return authState[platform] || { cookie: '', user: null };
}

function checkAuth(platform) {
  const adapter = platform === 'netease' ? neteaseAdapter : qqAdapter;
  return adapter.checkAuthStatus();
}

function clearAuth(platform) {
  setAuth(platform, '');
  authState[platform].user = null;
}

module.exports = {
  init,
  setAuth,
  getAuth,
  checkAuth,
  clearAuth,
};
