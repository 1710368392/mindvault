import { playUISound, isSoundLoaded } from './soundLibrary';
import type { SoundName } from './soundLibrary';

let audioCtx: AudioContext | null = null;

function getAudioContext(): AudioContext {
  if (!audioCtx) {
    audioCtx = new (window.AudioContext || (window as any).webkitAudioContext)();
  }
  return audioCtx;
}

export type SoundType = 'save' | 'delete' | 'navigate' | 'error' | 'drop' | 'click' | 'piano' | 'keyPress';

const howlerMap: Partial<Record<SoundType, SoundName>> = {
  save: 'save',
  delete: 'delete',
  navigate: 'navigate',
  error: 'error',
  drop: 'drop',
  click: 'click',
  keyPress: 'keyPress',
};

const synthConfigs: Record<SoundType, { freq: number[]; duration: number; type: OscillatorType; gain: number }> = {
  save:     { freq: [800, 1200], duration: 0.1,  type: 'sine',     gain: 0.3 },
  delete:   { freq: [400, 200],  duration: 0.15, type: 'sine',     gain: 0.25 },
  navigate: { freq: [600],       duration: 0.05, type: 'sine',     gain: 0.15 },
  error:    { freq: [200],       duration: 0.2,  type: 'triangle', gain: 0.3 },
  drop:     { freq: [500, 800, 500], duration: 0.12, type: 'sine', gain: 0.25 },
  click:    { freq: [1800, 900], duration: 0.04, type: 'square',   gain: 0.12 },
  piano:    { freq: [440],       duration: 0.5,  type: 'sine',     gain: 0.3 },
  keyPress: { freq: [3200, 1600], duration: 0.025, type: 'square', gain: 0.08 },
};

const PIANO_NOTES: { name: string; freq: number }[] = [
  { name: 'C4',  freq: 261.63 },
  { name: 'D4',  freq: 293.66 },
  { name: 'E4',  freq: 329.63 },
  { name: 'F4',  freq: 349.23 },
  { name: 'G4',  freq: 392.00 },
  { name: 'A4',  freq: 440.00 },
  { name: 'B4',  freq: 493.88 },
  { name: 'C5',  freq: 523.25 },
  { name: 'D5',  freq: 587.33 },
  { name: 'E5',  freq: 659.25 },
  { name: 'F5',  freq: 698.46 },
  { name: 'G5',  freq: 783.99 },
];

const NOTE_SYMBOLS = ['♩', '♪', '♫', '♬', '♭', '♯', '𝄞'];

function playSynthSound(type: SoundType, volume?: number): void {
  try {
    const ctx = getAudioContext();
    const config = synthConfigs[type];
    if (!config) return;

    const vol = volume ?? 0.5;
    if (vol <= 0) return;

    const oscillator = ctx.createOscillator();
    const gainNode = ctx.createGain();

    oscillator.type = config.type;
    oscillator.connect(gainNode);
    gainNode.connect(ctx.destination);

    const startTime = ctx.currentTime;
    const stepDuration = config.duration / config.freq.length;

    config.freq.forEach((freq, i) => {
      oscillator.frequency.setValueAtTime(freq, startTime + i * stepDuration);
    });

    gainNode.gain.setValueAtTime(vol * config.gain, startTime);
    gainNode.gain.exponentialRampToValueAtTime(0.001, startTime + config.duration);

    oscillator.start(startTime);
    oscillator.stop(startTime + config.duration + 0.05);
  } catch {
    // silent
  }
}

export function playSound(type: SoundType, volume?: number): void {
  const howlerName = howlerMap[type];
  if (howlerName && isSoundLoaded(howlerName)) {
    playUISound(howlerName, volume);
    return;
  }
  playSynthSound(type, volume);
}

export function playPianoNote(volume?: number): { noteName: string; symbol: string } {
  const noteIndex = Math.floor(Math.random() * PIANO_NOTES.length);
  const note = PIANO_NOTES[noteIndex];
  const symbol = NOTE_SYMBOLS[Math.floor(Math.random() * NOTE_SYMBOLS.length)];

  try {
    const ctx = getAudioContext();
    const vol = volume ?? 0.5;
    if (vol <= 0) return { noteName: note.name, symbol };

    const oscillator = ctx.createOscillator();
    const gainNode = ctx.createGain();
    const filter = ctx.createBiquadFilter();

    oscillator.type = 'sine';
    oscillator.frequency.setValueAtTime(note.freq, ctx.currentTime);

    filter.type = 'lowpass';
    filter.frequency.setValueAtTime(4000, ctx.currentTime);
    filter.Q.setValueAtTime(1, ctx.currentTime);

    oscillator.connect(filter);
    filter.connect(gainNode);
    gainNode.connect(ctx.destination);

    const startTime = ctx.currentTime;

    gainNode.gain.setValueAtTime(0, startTime);
    gainNode.gain.linearRampToValueAtTime(vol * 0.35, startTime + 0.01);
    gainNode.gain.exponentialRampToValueAtTime(vol * 0.15, startTime + 0.1);
    gainNode.gain.exponentialRampToValueAtTime(0.001, startTime + 0.8);

    const harmonic = ctx.createOscillator();
    const harmonicGain = ctx.createGain();
    harmonic.type = 'sine';
    harmonic.frequency.setValueAtTime(note.freq * 2, ctx.currentTime);
    harmonicGain.gain.setValueAtTime(vol * 0.08, startTime);
    harmonicGain.gain.exponentialRampToValueAtTime(0.001, startTime + 0.3);
    harmonic.connect(harmonicGain);
    harmonicGain.connect(ctx.destination);

    oscillator.start(startTime);
    oscillator.stop(startTime + 1);
    harmonic.start(startTime);
    harmonic.stop(startTime + 0.5);
  } catch (e) {
    // silent
  }

  return { noteName: note.name, symbol };
}

export function shouldPlaySound(soundEnabled: boolean): boolean {
  return soundEnabled;
}

export function playKeyPressSound(volume?: number): void {
  if (isSoundLoaded('keyPress')) {
    playUISound('keyPress', volume);
    return;
  }
  try {
    const ctx = getAudioContext();
    const vol = volume ?? 0.5;
    if (vol <= 0) return;

    const bufferSize = ctx.sampleRate * 0.03;
    const buffer = ctx.createBuffer(1, bufferSize, ctx.sampleRate);
    const data = buffer.getChannelData(0);
    for (let i = 0; i < bufferSize; i++) {
      data[i] = (Math.random() * 2 - 1) * 0.6;
    }

    const noise = ctx.createBufferSource();
    noise.buffer = buffer;

    const filter = ctx.createBiquadFilter();
    filter.type = 'bandpass';
    filter.frequency.setValueAtTime(3500, ctx.currentTime);
    filter.Q.setValueAtTime(2, ctx.currentTime);

    const gainNode = ctx.createGain();
    const startTime = ctx.currentTime;
    gainNode.gain.setValueAtTime(vol * 0.25, startTime);
    gainNode.gain.exponentialRampToValueAtTime(0.001, startTime + 0.035);

    noise.connect(filter);
    filter.connect(gainNode);
    gainNode.connect(ctx.destination);

    noise.start(startTime);
    noise.stop(startTime + 0.05);

    const clickOsc = ctx.createOscillator();
    const clickGain = ctx.createGain();
    clickOsc.type = 'square';
    clickOsc.frequency.setValueAtTime(2800, startTime);
    clickOsc.frequency.exponentialRampToValueAtTime(800, startTime + 0.015);
    clickGain.gain.setValueAtTime(vol * 0.1, startTime);
    clickGain.gain.exponentialRampToValueAtTime(0.001, startTime + 0.02);
    clickOsc.connect(clickGain);
    clickGain.connect(ctx.destination);
    clickOsc.start(startTime);
    clickOsc.stop(startTime + 0.03);
  } catch (e) {
    // silent
  }
}

export function playWhooshSound(volume?: number): void {
  if (isSoundLoaded('whoosh')) {
    playUISound('whoosh', volume);
    return;
  }
  try {
    const ctx = getAudioContext();
    const vol = volume ?? 0.5;
    if (vol <= 0) return;

    const startTime = ctx.currentTime;

    const bufferSize = ctx.sampleRate * 0.25;
    const buffer = ctx.createBuffer(1, bufferSize, ctx.sampleRate);
    const data = buffer.getChannelData(0);
    for (let i = 0; i < bufferSize; i++) {
      data[i] = (Math.random() * 2 - 1);
    }

    const noise = ctx.createBufferSource();
    noise.buffer = buffer;

    const bandpass = ctx.createBiquadFilter();
    bandpass.type = 'bandpass';
    bandpass.frequency.setValueAtTime(800, startTime);
    bandpass.frequency.exponentialRampToValueAtTime(3000, startTime + 0.06);
    bandpass.frequency.exponentialRampToValueAtTime(400, startTime + 0.2);
    bandpass.Q.setValueAtTime(1.5, startTime);

    const highpass = ctx.createBiquadFilter();
    highpass.type = 'highpass';
    highpass.frequency.setValueAtTime(200, startTime);

    const gainNode = ctx.createGain();
    gainNode.gain.setValueAtTime(0.001, startTime);
    gainNode.gain.linearRampToValueAtTime(vol * 0.2, startTime + 0.03);
    gainNode.gain.exponentialRampToValueAtTime(vol * 0.08, startTime + 0.08);
    gainNode.gain.exponentialRampToValueAtTime(0.001, startTime + 0.22);

    noise.connect(bandpass);
    bandpass.connect(highpass);
    highpass.connect(gainNode);
    gainNode.connect(ctx.destination);

    noise.start(startTime);
    noise.stop(startTime + 0.25);

    const sweepOsc = ctx.createOscillator();
    const sweepGain = ctx.createGain();
    sweepOsc.type = 'sine';
    sweepOsc.frequency.setValueAtTime(600, startTime);
    sweepOsc.frequency.exponentialRampToValueAtTime(1800, startTime + 0.05);
    sweepOsc.frequency.exponentialRampToValueAtTime(200, startTime + 0.18);
    sweepGain.gain.setValueAtTime(0.001, startTime);
    sweepGain.gain.linearRampToValueAtTime(vol * 0.06, startTime + 0.03);
    sweepGain.gain.exponentialRampToValueAtTime(0.001, startTime + 0.18);
    sweepOsc.connect(sweepGain);
    sweepGain.connect(ctx.destination);
    sweepOsc.start(startTime);
    sweepOsc.stop(startTime + 0.2);
  } catch (e) {
    // silent
  }
}

export function playHolyLightSound(volume?: number): void {
  if (isSoundLoaded('holyLight')) {
    playUISound('holyLight', volume);
    return;
  }
  try {
    const ctx = getAudioContext();
    const vol = volume ?? 0.5;
    if (vol <= 0) return;

    const startTime = ctx.currentTime;

    const base = ctx.createOscillator();
    base.type = 'sine';
    base.frequency.setValueAtTime(110, startTime);

    const baseGain = ctx.createGain();
    baseGain.gain.setValueAtTime(0.001, startTime);
    baseGain.gain.linearRampToValueAtTime(vol * 0.3, startTime + 0.15);
    baseGain.gain.setValueAtTime(vol * 0.3, startTime + 0.4);
    baseGain.gain.exponentialRampToValueAtTime(0.001, startTime + 1.2);

    base.connect(baseGain);
    baseGain.connect(ctx.destination);
    base.start(startTime);
    base.stop(startTime + 1.3);

    const overtone2 = ctx.createOscillator();
    overtone2.type = 'sine';
    overtone2.frequency.setValueAtTime(220, startTime);

    const ot2Gain = ctx.createGain();
    ot2Gain.gain.setValueAtTime(0.001, startTime);
    ot2Gain.gain.linearRampToValueAtTime(vol * 0.15, startTime + 0.12);
    ot2Gain.gain.setValueAtTime(vol * 0.15, startTime + 0.35);
    ot2Gain.gain.exponentialRampToValueAtTime(0.001, startTime + 1.0);

    overtone2.connect(ot2Gain);
    ot2Gain.connect(ctx.destination);
    overtone2.start(startTime);
    overtone2.stop(startTime + 1.1);

    const overtone3 = ctx.createOscillator();
    overtone3.type = 'sine';
    overtone3.frequency.setValueAtTime(330, startTime);

    const ot3Gain = ctx.createGain();
    ot3Gain.gain.setValueAtTime(0.001, startTime);
    ot3Gain.gain.linearRampToValueAtTime(vol * 0.08, startTime + 0.1);
    ot3Gain.gain.exponentialRampToValueAtTime(0.001, startTime + 0.7);

    overtone3.connect(ot3Gain);
    ot3Gain.connect(ctx.destination);
    overtone3.start(startTime);
    overtone3.stop(startTime + 0.8);

    const overtone5 = ctx.createOscillator();
    overtone5.type = 'sine';
    overtone5.frequency.setValueAtTime(550, startTime);

    const ot5Gain = ctx.createGain();
    ot5Gain.gain.setValueAtTime(0.001, startTime);
    ot5Gain.gain.linearRampToValueAtTime(vol * 0.04, startTime + 0.08);
    ot5Gain.gain.exponentialRampToValueAtTime(0.001, startTime + 0.5);

    overtone5.connect(ot5Gain);
    ot5Gain.connect(ctx.destination);
    overtone5.start(startTime);
    overtone5.stop(startTime + 0.6);

    const vibrato = ctx.createOscillator();
    vibrato.type = 'sine';
    vibrato.frequency.setValueAtTime(4, startTime);

    const vibratoGain = ctx.createGain();
    vibratoGain.gain.setValueAtTime(2, startTime);

    vibrato.connect(vibratoGain);
    vibratoGain.connect(base.frequency);
    vibrato.start(startTime);
    vibrato.stop(startTime + 1.3);

    const bufferSize = ctx.sampleRate * 1.2;
    const buffer = ctx.createBuffer(1, bufferSize, ctx.sampleRate);
    const data = buffer.getChannelData(0);
    for (let i = 0; i < bufferSize; i++) {
      data[i] = (Math.random() * 2 - 1);
    }
    const noise = ctx.createBufferSource();
    noise.buffer = buffer;

    const lpf = ctx.createBiquadFilter();
    lpf.type = 'lowpass';
    lpf.frequency.setValueAtTime(200, startTime);
    lpf.frequency.linearRampToValueAtTime(400, startTime + 0.2);
    lpf.frequency.exponentialRampToValueAtTime(100, startTime + 1.0);
    lpf.Q.setValueAtTime(5, startTime);

    const noiseGain = ctx.createGain();
    noiseGain.gain.setValueAtTime(0.001, startTime);
    noiseGain.gain.linearRampToValueAtTime(vol * 0.12, startTime + 0.15);
    noiseGain.gain.exponentialRampToValueAtTime(0.001, startTime + 1.0);

    noise.connect(lpf);
    lpf.connect(noiseGain);
    noiseGain.connect(ctx.destination);
    noise.start(startTime);
    noise.stop(startTime + 1.1);
  } catch (e) {
    // silent
  }
}
