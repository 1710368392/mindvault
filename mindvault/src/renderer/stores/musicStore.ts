import { create } from 'zustand';
import { api } from '../utils/api';
import { parseLrc, LrcLine, ParsedLrc, getExpectedLrcPath } from '../utils/lrc-parser';

// ============================================================
// Types
// ============================================================

export type PlayMode = 'sequential' | 'loop' | 'random';
export type TrackSource = 'local' | 'online' | 'preset';

export interface MusicTrack {
  id: string;
  title: string;
  artist: string;
  album?: string;
  src: string;
  duration?: number;
  coverUrl?: string;
  lrcPath?: string;
  source: TrackSource;
  addedAt: number;
}

// ============================================================
// Preset tracks
// ============================================================

export const PRESET_TRACKS: MusicTrack[] = [
  { id: 'preset-1', title: 'Minecraft', artist: 'C418', src: './audio/c418-minecraft.mp3', source: 'preset', addedAt: 0 },
  { id: 'preset-2', title: 'Moog City', artist: 'C418', src: './audio/moog-city.mp3', source: 'preset', addedAt: 0 },
  { id: 'preset-3', title: 'Wet Hands', artist: 'C418', src: './audio/wet-hands.mp3', source: 'preset', addedAt: 0 },
];

// ============================================================
// Module-level audio engine (persists outside store)
// ============================================================

let audioElement: HTMLAudioElement | null = null;
let audioContext: AudioContext | null = null;
let gainNode: GainNode | null = null;
let sourceNode: MediaElementAudioSourceNode | null = null;
let analyserNode: AnalyserNode | null = null;
let audioConnected = false;
let animFrameId = 0;
let seekVersion = 0;
let shuffledIndices: number[] = [];
let shuffledPosition = 0;
let eqNodes: BiquadFilterNode[] = [];
let _frequencyData: number[] = new Array(64).fill(0);

export function getFrequencyData(): number[] {
  return _frequencyData;
}

// ========== 播放历史记录相关模块变量 ==========
// 当前播放会话ID
let currentSessionId: string | null = null;
// 当前曲目播放开始时间（毫秒时间戳）
let playStartTime: number = 0;
// 上次记录的时间点（秒），用于增量记录
let lastRecordedTime: number = 0;
// 定期检查定时器
let playRecordInterval: ReturnType<typeof setInterval> | null = null;
// 当前会话的曲目信息缓存
let sessionTrackInfo: {
  trackId: string;
  trackTitle: string;
  trackArtist: string;
  trackAlbum: string;
  source: string;
} | null = null;

// ============================================================
// Internal helpers
// ============================================================

function formatTimeHelper(t: number): string {
  if (!isFinite(t) || t < 0) return '0:00';
  const minutes = Math.floor(t / 60);
  const seconds = Math.floor(t % 60);
  return `${minutes}:${seconds.toString().padStart(2, '0')}`;
}

function getPlayModeLabelHelper(mode: PlayMode): string {
  switch (mode) {
    case 'sequential':
      return '顺序播放';
    case 'loop':
      return '单曲循环';
    case 'random':
      return '随机播放';
    default:
      return '顺序播放';
  }
}

// ============================================================
// 播放历史记录辅助函数
// ============================================================

/**
 * 记录当前会话的播放数据（fire-and-forget）
 * 计算从 lastRecordedTime 到当前的播放时长并上报
 * @param isFinal - 是否为最终记录（歌曲结束或切换时）
 */
function _recordCurrentSession(isFinal: boolean = false): void {
  if (!currentSessionId || !sessionTrackInfo || !audioElement) return;

  try {
    const currentTime = audioElement.currentTime || 0;
    const totalDuration = audioElement.duration || 0;
    // 计算本次增量播放时长
    const durationPlayed = Math.max(0, currentTime - lastRecordedTime);

    // 只有播放时长大于等于1秒才记录
    if (durationPlayed >= 1) {
      api.music.recordPlay({
        trackId: sessionTrackInfo.trackId,
        trackTitle: sessionTrackInfo.trackTitle,
        trackArtist: sessionTrackInfo.trackArtist,
        trackAlbum: sessionTrackInfo.trackAlbum,
        source: sessionTrackInfo.source,
        durationPlayed,
        totalDuration,
        playSessionId: currentSessionId,
      }).catch(() => {
        // fire-and-forget，忽略错误
      });
    }

    // 更新上次记录时间
    lastRecordedTime = currentTime;
  } catch (e) {
    // 记录失败不影响播放体验
    console.warn('[MusicStore] 记录播放数据失败:', e);
  }
}

/**
 * 结束当前播放会话并记录最终数据
 */
function _endCurrentSession(): void {
  if (!currentSessionId) return;

  // 记录最终数据
  _recordCurrentSession(true);

  // 清除定期检查定时器
  if (playRecordInterval) {
    clearInterval(playRecordInterval);
    playRecordInterval = null;
  }

  // 重置会话状态
  currentSessionId = null;
  sessionTrackInfo = null;
  playStartTime = 0;
  lastRecordedTime = 0;
}

/**
 * 开始新的播放会话
 * @param track - 当前播放的曲目信息
 */
function _startNewSession(track: {
  id: string;
  title: string;
  artist?: string;
  album?: string;
  source: string;
}): void {
  // 先结束上一个会话
  _endCurrentSession();

  // 生成新的会话ID
  currentSessionId = `${Date.now()}-${track.id}`;
  playStartTime = Date.now();
  lastRecordedTime = 0;

  // 缓存曲目信息
  sessionTrackInfo = {
    trackId: track.id,
    trackTitle: track.title || '',
    trackArtist: track.artist || '',
    trackAlbum: track.album || '',
    source: track.source || 'local',
  };

  // 启动定期检查（每10秒记录一次中间数据）
  if (playRecordInterval) {
    clearInterval(playRecordInterval);
  }
  playRecordInterval = setInterval(() => {
    if (audioElement && !audioElement.paused && currentSessionId) {
      _recordCurrentSession(false);
    }
  }, 10000);
}

// ============================================================
// rAF progress loop
// ============================================================

function _startProgressLoop(get: () => MusicStoreState) {
  cancelAnimationFrame(animFrameId);

  const tick = () => {
    const audio = audioElement;
    if (!audio || !get().isPlaying) return;

    if (seekVersion > 0) {
      seekVersion--;
      animFrameId = requestAnimationFrame(tick);
      return;
    }

    const current = audio.currentTime || 0;
    const dur = audio.duration || 0;
    const offset = get().lyricOffset;

    get().setCurrentTime(current + offset);
    get().setProgress(dur > 0 ? current / dur : 0);

    if (analyserNode) {
      const bufferLength = analyserNode.frequencyBinCount;
      const dataArray = new Uint8Array(bufferLength);
      analyserNode.getByteFrequencyData(dataArray);
      const sampled = new Array<number>(64).fill(0);
      const step = bufferLength / 64;
      for (let i = 0; i < 64; i++) {
        const idx = Math.floor(i * step);
        sampled[i] = dataArray[idx] ?? 0;
      }
      _frequencyData = sampled;
    }

    animFrameId = requestAnimationFrame(tick);
  };

  animFrameId = requestAnimationFrame(tick);
}

function _shuffleArray(arr: number[]): number[] {
  const shuffled = [...arr];
  for (let i = shuffled.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [shuffled[i], shuffled[j]] = [shuffled[j], shuffled[i]];
  }
  return shuffled;
}

function _ensureShuffledQueue(trackCount: number, currentIndex: number) {
  if (shuffledIndices.length !== trackCount) {
    const indices = Array.from({ length: trackCount }, (_, i) => i);
    shuffledIndices = _shuffleArray(indices);
    shuffledPosition = shuffledIndices.indexOf(currentIndex);
    if (shuffledPosition === -1) shuffledPosition = 0;
  }
}

// ============================================================
// Store types
// ============================================================

interface MusicStoreState {
  // --- State ---
  isPlaying: boolean;
  currentTrackIndex: number;
  progress: number;
  currentTime: number;
  duration: number;
  volume: number;
  playMode: PlayMode;
  tracks: MusicTrack[];
  favorites: string[];
  showLyrics: boolean;
  showMusicManager: boolean;
  isPlayerMinimized: boolean;
  lyrics: LrcLine[];
  lyricOffset: number;
  urlRetryCount: number;
  eqPreset: string;
  eqBands: number[];
  playQueue: MusicTrack[];
  useQueueMode: boolean;

  // --- Internal setters (exposed for rAF loop) ---
  setIsPlaying: (v: boolean) => void;
  setCurrentTrackIndex: (v: number) => void;
  setProgress: (v: number) => void;
  setCurrentTime: (v: number) => void;
  setDuration: (v: number) => void;

  // --- Actions ---
  initAudio: () => void;
  ensureAudioContext: () => void;
  togglePlay: () => void;
  play: () => void;
  pause: () => void;
  loadTrack: (index: number, autoPlay?: boolean) => void;
  nextTrack: () => number;
  prevTrack: () => number;
  setVolume: (vol: number) => void;
  cyclePlayMode: () => void;
  seekTo: (time: number) => void;
  seekToRatio: (ratio: number) => void;
  addTracks: (newTracks: MusicTrack[]) => void;
  removeTrack: (id: string) => void;
  toggleFavorite: (id: string) => void;
  setShowLyrics: (v: boolean) => void;
  setShowMusicManager: (v: boolean) => void;
  setIsPlayerMinimized: (v: boolean) => void;
  updateFrequencyData: () => void;
  formatTime: (t: number) => string;
  getPlayModeLabel: () => string;
  getAudioElement: () => HTMLAudioElement | null;
  setEqPreset: (preset: string) => void;
  setEqBand: (index: number, value: number) => void;
  addToQueue: (tracks: MusicTrack | MusicTrack[]) => void;
  removeFromQueue: (trackId: string) => void;
  clearQueue: () => void;
  toggleQueueMode: () => void;
  playQueueNext: () => void;
  initGlobalShortcuts: () => void;
  loadLyrics: (track: MusicTrack) => void;
  setLyricOffset: (offset: number) => void;
  setUrlRetryCount: (count: number) => void;
  retryOnlineUrl: () => void;
  setEqPreset: (preset: string) => void;
  setEqBand: (index: number, value: number) => void;
}

// ============================================================
// Zustand store
// ============================================================

export const useMusicStore = create<MusicStoreState>((set, get) => ({
  // --- State ---
  isPlaying: false,
  currentTrackIndex: 0,
  progress: 0,
  currentTime: 0,
  duration: 0,
  volume: 60,
  playMode: 'sequential' as PlayMode,
  tracks: [...PRESET_TRACKS],
  favorites: [],
  showLyrics: false,
  showMusicManager: false,
  isPlayerMinimized: false,
  lyrics: [],
  lyricOffset: 0,
  urlRetryCount: 0,
  eqPreset: 'flat',
  eqBands: [0, 0, 0, 0, 0],
  playQueue: (() => { try { return JSON.parse(localStorage.getItem('mindvault_play_queue') || '[]'); } catch { return []; } })(),
  useQueueMode: false,

  // --- Internal setters ---
  setIsPlaying: (v) => set({ isPlaying: v }),
  setCurrentTrackIndex: (v) => set({ currentTrackIndex: v }),
  setProgress: (v) => set({ progress: v }),
  setCurrentTime: (v) => set({ currentTime: v }),
  setDuration: (v) => set({ duration: v }),

  // --- Actions ---

  initAudio: () => {
    if (audioElement) return;

    const audio = new Audio();
    audio.preload = 'metadata';
    audio.volume = 1;
    audioElement = audio;

    audio.addEventListener('loadedmetadata', () => {
      if (audio.duration && isFinite(audio.duration)) {
        set({ duration: audio.duration });
      }
    });

    audio.addEventListener('ended', () => {
      _recordCurrentSession(true);

      const state = get();
      const mode = state.playMode;

      if (mode === 'loop') {
        _endCurrentSession();
        const track = state.tracks[state.currentTrackIndex];
        if (track) {
          _startNewSession(track);
        }
        audio.currentTime = 0;
        get().play();
      } else {
        _endCurrentSession();
        const nextIndex = get().nextTrack();
        get().loadTrack(nextIndex, true);
      }
    });

    audio.addEventListener('error', () => {
      const track = get().tracks[get().currentTrackIndex];
      if (!track || track.source === 'local' || track.source === 'preset') return;

      const retryCount = get().urlRetryCount;
      if (retryCount < 3) {
        console.warn(`[MusicStore] 在线歌曲播放失败，第 ${retryCount + 1} 次重试...`);
        get().retryOnlineUrl();
      } else {
        console.error('[MusicStore] 在线歌曲播放失败，已达到最大重试次数');
        set({ isPlaying: false, urlRetryCount: 0 });
        const nextIndex = get().nextTrack();
        if (nextIndex !== get().currentTrackIndex) {
          get().loadTrack(nextIndex, true);
        }
      }
    });

    // Load first preset track metadata
    if (get().tracks.length > 0) {
      audio.src = get().tracks[0].src;
      audio.load();
    }
  },

  ensureAudioContext: () => {
    // If AudioContext is already running, nothing to do
    if (audioContext && audioContext.state === 'running') return;
    
    // If AudioContext exists but is suspended, just resume it
    if (audioContext && audioContext.state === 'suspended') {
      audioContext.resume().then(() => {
        console.log('[MusicStore] AudioContext resumed');
      }).catch((err) => {
        console.warn('[MusicStore] Failed to resume AudioContext:', err);
      });
      return;
    }

    // Otherwise, create and initialize a new AudioContext
    try {
      const ctx = new AudioContext();

      const source = ctx.createMediaElementSource(audioElement!);
      sourceNode = source;

      const analyser = ctx.createAnalyser();
      analyser.fftSize = 256; // 提供 128 个频率数据点，更精细的可视化
      analyser.smoothingTimeConstant = 0.75; // 稍微降低平滑度以获得更灵敏的响应
      analyser.minDecibels = -90;
      analyser.maxDecibels = -10;
      analyserNode = analyser;

      const gain = ctx.createGain();
      gain.gain.value = get().volume / 100;
      gainNode = gain;

      const eqBands = get().eqBands;
      const eqFreqs = [60, 230, 910, 4000, 14000];
      const eqTypes: BiquadFilterType[] = ['lowshelf', 'peaking', 'peaking', 'peaking', 'highshelf'];
      eqNodes = eqFreqs.map((freq, i) => {
        const filter = ctx.createBiquadFilter();
        filter.type = eqTypes[i];
        filter.frequency.value = freq;
        filter.gain.value = eqBands[i];
        if (eqTypes[i] === 'peaking') filter.Q.value = 1.0;
        return filter;
      });

      source.connect(analyser);
      let lastNode: AudioNode = analyser;
      for (const eq of eqNodes) {
        lastNode.connect(eq);
        lastNode = eq;
      }
      lastNode.connect(gain);
      gain.connect(ctx.destination);

      audioContext = ctx;
      audioConnected = true;
      
      // Resume the context after connecting (required by browsers)
      if (ctx.state === 'suspended') {
        ctx.resume();
      }
    } catch (err) {
      console.warn('[MusicStore] Failed to init AudioContext:', err);
    }
  },

  togglePlay: () => {
    const audio = audioElement;
    if (!audio) return;

    if (get().isPlaying) {
      audio.pause();
      set({ isPlaying: false });
      cancelAnimationFrame(animFrameId);
    } else {
      audio.play().catch((err) => {
        console.warn('[MusicStore] play() failed:', err);
      });
      get().ensureAudioContext();
      set({ isPlaying: true });
      _startProgressLoop(get);
    }
  },

  play: () => {
    const audio = audioElement;
    if (!audio) return;

    audio.play().catch((err) => {
      console.warn('[MusicStore] play() failed:', err);
    });
    get().ensureAudioContext();
    set({ isPlaying: true });
    _startProgressLoop(get);
  },

  pause: () => {
    const audio = audioElement;
    if (!audio) return;

    // 暂停时更新上次记录时间，但不立即记录（用户可能只是暂停一下）
    if (currentSessionId && audioElement) {
      lastRecordedTime = audioElement.currentTime || 0;
    }

    audio.pause();
    set({ isPlaying: false });
    cancelAnimationFrame(animFrameId);
  },

  loadTrack: (index: number, autoPlay?: boolean) => {
    const tracks = get().tracks;
    if (index < 0 || index >= tracks.length) return;

    // 切换曲目前，结束上一个播放会话并记录数据
    _endCurrentSession();

    cancelAnimationFrame(animFrameId);

    const audio = audioElement;
    if (audio) {
      audio.pause();
      audio.src = tracks[index].src;
      audio.load();
    }

    set({
      currentTrackIndex: index,
      progress: 0,
      currentTime: 0,
      duration: 0,
      isPlaying: false,
      lyrics: [],
      lyricOffset: 0,
      urlRetryCount: 0,
    });

    get().loadLyrics(tracks[index]);

    if (autoPlay && audio) {
      // 自动播放时，开始新的播放会话
      _startNewSession(tracks[index]);

      audio.play().catch((err) => {
        console.warn('[MusicStore] autoplay failed:', err);
      });
      get().ensureAudioContext();
      set({ isPlaying: true });
      _startProgressLoop(get);
    }
  },

  nextTrack: () => {
    const { currentTrackIndex, tracks, playMode } = get();
    if (tracks.length === 0) return 0;

    if (playMode === 'random') {
      _ensureShuffledQueue(tracks.length, currentTrackIndex);
      shuffledPosition = (shuffledPosition + 1) % shuffledIndices.length;
      return shuffledIndices[shuffledPosition];
    }

    return (currentTrackIndex + 1) % tracks.length;
  },

  prevTrack: () => {
    const { currentTrackIndex, tracks, currentTime } = get();
    if (tracks.length === 0) return 0;

    // If played more than 3 seconds, restart current track
    if (currentTime > 3) {
      const audio = audioElement;
      if (audio) {
        audio.currentTime = 0;
        set({ currentTime: 0, progress: 0 });
      }
      return currentTrackIndex;
    }

    return (currentTrackIndex - 1 + tracks.length) % tracks.length;
  },

  setVolume: (vol: number) => {
    const clamped = Math.max(0, Math.min(200, vol));
    set({ volume: clamped });

    if (gainNode) {
      gainNode.gain.value = clamped / 100;
    }

    // Also update raw audio volume as fallback
    if (audioElement) {
      audioElement.volume = Math.min(clamped / 100, 1);
    }
  },

  cyclePlayMode: () => {
    const current = get().playMode;
    const modes: PlayMode[] = ['sequential', 'loop', 'random'];
    const idx = modes.indexOf(current);
    const next = modes[(idx + 1) % modes.length];
    set({ playMode: next });
  },

  seekTo: (time: number) => {
    const audio = audioElement;
    if (!audio) return;

    const dur = get().duration;
    const clamped = Math.max(0, Math.min(time, dur || 0));
    audio.currentTime = clamped;
    seekVersion = 3;
    set({ currentTime: clamped, progress: dur > 0 ? clamped / dur : 0 });
  },

  seekToRatio: (ratio: number) => {
    const dur = get().duration;
    if (dur > 0) {
      get().seekTo(ratio * dur);
    }
  },

  addTracks: (newTracks: MusicTrack[]) => {
    shuffledIndices = [];
    shuffledPosition = 0;
    set({ tracks: [...get().tracks, ...newTracks] });
  },

  removeTrack: (id: string) => {
    const { tracks, currentTrackIndex } = get();
    const idx = tracks.findIndex((t) => t.id === id);
    if (idx === -1) return;

    const newTracks = tracks.filter((t) => t.id !== id);
    let newIndex = currentTrackIndex;

    if (newTracks.length === 0) {
      newIndex = 0;
    } else if (idx < currentTrackIndex) {
      newIndex = currentTrackIndex - 1;
    } else if (idx === currentTrackIndex) {
      newIndex = Math.min(currentTrackIndex, newTracks.length - 1);
    }

    set({ tracks: newTracks, currentTrackIndex: newIndex });
  },

  toggleFavorite: (id: string) => {
    const { favorites } = get();
    if (favorites.includes(id)) {
      set({ favorites: favorites.filter((f) => f !== id) });
    } else {
      set({ favorites: [...favorites, id] });
    }
  },

  setShowLyrics: (v: boolean) => set({ showLyrics: v }),
  setShowMusicManager: (v: boolean) => set({ showMusicManager: v }),
  setIsPlayerMinimized: (v: boolean) => set({ isPlayerMinimized: v }),

  updateFrequencyData: () => {
    if (!analyserNode) return;

    const bufferLength = analyserNode.frequencyBinCount;
    const dataArray = new Uint8Array(bufferLength);
    analyserNode.getByteFrequencyData(dataArray);

    const sampled = new Array<number>(64).fill(0);
    const step = bufferLength / 64;
    for (let i = 0; i < 64; i++) {
      const idx = Math.floor(i * step);
      sampled[i] = dataArray[idx] ?? 0;
    }
    _frequencyData = sampled;
  },

  formatTime: (t: number) => formatTimeHelper(t),

  getPlayModeLabel: () => getPlayModeLabelHelper(get().playMode),

  getAudioElement: () => audioElement,

  loadLyrics: (track: MusicTrack) => {
    if (!track) return;

    if (track.source === 'local') {
      const lrcPath = track.lrcPath || getExpectedLrcPath(track.src);
      if (!lrcPath) return;

      if (window.electronAPI?.file?.readText) {
        window.electronAPI.file.readText(lrcPath).then((content: string | null) => {
          if (content) {
            const parsed = parseLrc(content);
            set({ lyrics: parsed.lines });
          }
        }).catch(() => {});
      }
      return;
    }

    if (track.source === 'online' && track.id) {
      const sourceMap: Record<string, string> = {
        netease: 'netease',
        qq: 'qq',
        kugou: 'kugou',
        kuwo: 'kuwo',
        migu: 'migu',
      };
      const sourceName = Object.keys(sourceMap).find(k => track.id.includes(k)) || '';
      const songId = track.id.replace(/^(netease|qq|kugou|kuwo|migu)_/, '');

      api.music.getMultiSourceLyric({ source: sourceName || 'netease', songId, songName: track.title, singer: track.artist }).then((result: any) => {
        if (result?.lyric) {
          const parsed = parseLrc(result.lyric);
          set({ lyrics: parsed.lines });
        }
      }).catch(() => {});
    }
  },

  setLyricOffset: (offset: number) => set({ lyricOffset: offset }),

  setUrlRetryCount: (count: number) => set({ urlRetryCount: count }),

  retryOnlineUrl: () => {
    const track = get().tracks[get().currentTrackIndex];
    if (!track || track.source !== 'online') return;

    const retryCount = get().urlRetryCount + 1;
    set({ urlRetryCount: retryCount });

    api.music.getMultiSourceUrl({
      source: track.id.includes('qq') ? 'qq' : 'netease',
      songId: track.id.replace(/^(netease|qq|kugou|kuwo|migu)_/, ''),
      songName: track.title,
      singer: track.artist,
    }).then((result: any) => {
      if (result?.url) {
        const newTracks = [...get().tracks];
        newTracks[get().currentTrackIndex] = { ...track, src: result.url };
        set({ tracks: newTracks });

        const audio = audioElement;
        if (audio) {
          audio.src = result.url;
          audio.load();
          audio.play().catch(() => {});
          set({ isPlaying: true, urlRetryCount: 0 });
          _startProgressLoop(get);
        }
      }
    }).catch(() => {
      if (retryCount >= 3) {
        set({ isPlaying: false, urlRetryCount: 0 });
      }
    });
  },

  setEqPreset: (preset: string) => {
    const presets: Record<string, number[]> = {
      flat: [0, 0, 0, 0, 0],
      pop: [1, 3, 4, 3, 1],
      rock: [4, 2, -1, 3, 4],
      classical: [3, 1, 0, 2, 4],
      jazz: [2, 1, -1, 1, 3],
      electronic: [5, 3, 0, 2, 4],
      vocal: [-1, 1, 5, 3, 0],
      bass: [6, 4, 0, 0, 0],
    };
    const bands = presets[preset] || presets.flat;
    set({ eqPreset: preset, eqBands: bands });
    bands.forEach((val, i) => {
      if (eqNodes[i]) eqNodes[i].gain.value = val;
    });
  },

  setEqBand: (index: number, value: number) => {
    const bands = [...get().eqBands];
    bands[index] = value;
    set({ eqBands: bands, eqPreset: 'custom' });
    if (eqNodes[index]) eqNodes[index].gain.value = value;
  },

  addToQueue: (tracks: MusicTrack | MusicTrack[]) => {
    const items = Array.isArray(tracks) ? tracks : [tracks];
    const queue = [...get().playQueue, ...items];
    set({ playQueue: queue });
    try { localStorage.setItem('mindvault_play_queue', JSON.stringify(queue)); } catch {}
  },

  removeFromQueue: (trackId: string) => {
    const queue = get().playQueue.filter(t => t.id !== trackId);
    set({ playQueue: queue });
    try { localStorage.setItem('mindvault_play_queue', JSON.stringify(queue)); } catch {}
  },

  clearQueue: () => {
    set({ playQueue: [] });
    try { localStorage.removeItem('mindvault_play_queue'); } catch {}
  },

  toggleQueueMode: () => {
    const mode = !get().useQueueMode;
    set({ useQueueMode: mode });
    if (mode && get().playQueue.length === 0) {
      set({ playQueue: [...get().tracks] });
      try { localStorage.setItem('mindvault_play_queue', JSON.stringify([...get().tracks])); } catch {}
    }
  },

  playQueueNext: () => {
    const { playQueue, useQueueMode, currentTrackIndex, tracks } = get();
    if (useQueueMode && playQueue.length > 0) {
      const currentQueueIdx = playQueue.findIndex(t => tracks[currentTrackIndex]?.id === t.id);
      const nextQueueIdx = (currentQueueIdx + 1) % playQueue.length;
      const nextTrack = playQueue[nextQueueIdx];
      if (nextTrack) {
        const trackIdx = tracks.findIndex(t => t.id === nextTrack.id);
        if (trackIdx >= 0) {
          get().loadTrack(trackIdx, true);
        } else {
          get().addTracks([nextTrack]);
          get().loadTrack(tracks.length, true);
        }
      }
    } else {
      const idx = get().nextTrack();
      get().loadTrack(idx, true);
    }
  },

  initGlobalShortcuts: () => {
    if (typeof window !== 'undefined' && window.electronAPI) {
      // 监听来自主进程的全局媒体键事件
      window.electronAPI.onMusicGlobalTogglePlay?.(() => {
        get().togglePlay();
      });
      window.electronAPI.onMusicGlobalNextTrack?.(() => {
        const idx = get().nextTrack();
        get().loadTrack(idx, true);
      });
      window.electronAPI.onMusicGlobalPrevTrack?.(() => {
        const idx = get().prevTrack();
        if (idx !== get().currentTrackIndex) {
          get().loadTrack(idx, get().isPlaying);
        }
      });
    }
  },
}));
