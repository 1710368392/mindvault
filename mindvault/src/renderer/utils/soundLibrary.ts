import { Howl, Howler } from 'howler';

export type SoundName =
  | 'click'
  | 'save'
  | 'delete'
  | 'error'
  | 'navigate'
  | 'drop'
  | 'keyPress'
  | 'whoosh'
  | 'holyLight'
  | 'notification';

const SOUND_BASE = './sounds';

let soundsReady = false;
let loadErrors: string[] = [];

const soundConfigs: Record<SoundName, { file: string; volume: number; preload: boolean }> = {
  click:        { file: 'click.wav',        volume: 0.3,  preload: true },
  save:         { file: 'save.wav',         volume: 0.4,  preload: true },
  delete:       { file: 'delete.wav',       volume: 0.3,  preload: true },
  error:        { file: 'error.wav',        volume: 0.35, preload: true },
  navigate:     { file: 'navigate.wav',     volume: 0.2,  preload: true },
  drop:         { file: 'drop.wav',         volume: 0.3,  preload: true },
  keyPress:     { file: 'keyPress.wav',     volume: 0.15, preload: false },
  whoosh:       { file: 'whoosh.wav',       volume: 0.25, preload: true },
  holyLight:    { file: 'holyLight.wav',    volume: 0.35, preload: true },
  notification: { file: 'notification.wav', volume: 0.4,  preload: true },
};

const soundMap: Partial<Record<SoundName, Howl>> = {};

function initSounds(): void {
  if (soundsReady) return;

  for (const [name, config] of Object.entries(soundConfigs) as [SoundName, typeof soundConfigs[SoundName]][]) {
    try {
      soundMap[name] = new Howl({
        src: [`${SOUND_BASE}/${config.file}`],
        volume: config.volume,
        preload: config.preload,
        onloaderror: (_id, err) => {
          loadErrors.push(`${name}: ${String(err)}`);
        },
      });
    } catch (e) {
      loadErrors.push(`${name}: ${String(e)}`);
    }
  }

  soundsReady = true;
}

initSounds();

export function playUISound(name: SoundName, volume?: number): void {
  const sound = soundMap[name];
  if (!sound) return;

  try {
    if (volume !== undefined) {
      sound.volume(volume);
    }
    sound.play();
  } catch {
    // silent fallback
  }
}

export function setGlobalVolume(vol: number): void {
  Howler.volume(Math.max(0, Math.min(1, vol)));
}

export function muteAll(): void {
  Howler.mute(true);
}

export function unmuteAll(): void {
  Howler.mute(false);
}

export function getLoadErrors(): string[] {
  return [...loadErrors];
}

export function isSoundLoaded(name: SoundName): boolean {
  const sound = soundMap[name];
  return sound ? sound.state() === 'loaded' : false;
}
