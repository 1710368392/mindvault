// @ts-nocheck

const neteaseAdapter = require('./adapters/netease');
const qqAdapter = require('./adapters/qq');
const urlResolver = require('./url-resolver');
const authManager = require('./auth-manager');

function initMusicServices() {
  authManager.init();
  console.log('[MusicServices] 音乐服务已初始化');
}

module.exports = {
  initMusicServices,
  neteaseAdapter,
  qqAdapter,
  urlResolver,
  authManager,
};
