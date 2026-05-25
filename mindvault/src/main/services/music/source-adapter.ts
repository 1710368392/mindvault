// @ts-nocheck

const MusicSourceAdapter = {
  name: '',
  displayName: '',

  async search(keyword, page, limit) {
    throw new Error('search not implemented');
  },

  async getSongUrl(songId, quality) {
    throw new Error('getSongUrl not implemented');
  },

  async getLyric(songId) {
    throw new Error('getLyric not implemented');
  },

  async getSongDetail(songId) {
    throw new Error('getSongDetail not implemented');
  },

  checkAuthStatus() {
    return { authenticated: false, user: null };
  },

  setAuth(cookie) {
  },
};

const SearchResult = {
  songs: [],
  total: 0,
};

const SongUrlResult = {
  success: false,
  url: null,
  quality: null,
  crossSource: null,
};

const LyricResult = {
  success: false,
  lrc: '',
  tlyric: '',
};

const SongDetail = {
  id: '',
  title: '',
  artist: '',
  album: '',
  duration: 0,
  coverUrl: '',
};

const AuthStatus = {
  authenticated: false,
  user: null,
  platform: '',
};

function createAdapter(impl) {
  return { ...MusicSourceAdapter, ...impl };
}

module.exports = {
  MusicSourceAdapter,
  SearchResult,
  SongUrlResult,
  LyricResult,
  SongDetail,
  AuthStatus,
  createAdapter,
};
