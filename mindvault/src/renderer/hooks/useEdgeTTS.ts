import { useState, useCallback, useRef, useEffect } from 'react';

// Edge TTS 支持的音色列表
export interface EdgeVoice {
  shortName: string;
  label: string;
  locale: string;
}

export const EDGE_VOICES: EdgeVoice[] = [
  // 中文音色
  { shortName: 'zh-CN-XiaoxiaoNeural', label: '晓晓（女声）', locale: 'zh-CN' },
  { shortName: 'zh-CN-XiaoyiNeural', label: '晓伊（女声）', locale: 'zh-CN' },
  { shortName: 'zh-CN-YunjianNeural', label: '云健（男声）', locale: 'zh-CN' },
  { shortName: 'zh-CN-YunxiNeural', label: '云希（男声）', locale: 'zh-CN' },
  { shortName: 'zh-CN-YunxiaNeural', label: '云夏（女声）', locale: 'zh-CN' },
  { shortName: 'zh-CN-YunyangNeural', label: '云扬（男声）', locale: 'zh-CN' },
  { shortName: 'zh-CN-XiaohanNeural', label: '晓韩（女声）', locale: 'zh-CN' },
  { shortName: 'zh-CN-XiaoruiNeural', label: '晓睿（女声）', locale: 'zh-CN' },
  { shortName: 'zh-CN-XiaoshuangNeural', label: '晓双（女声）', locale: 'zh-CN' },
  { shortName: 'zh-CN-XiaoxuanNeural', label: '晓萱（女声）', locale: 'zh-CN' },
  { shortName: 'zh-CN-XiaoyanNeural', label: '晓颜（女声）', locale: 'zh-CN' },
  { shortName: 'zh-CN-YunyeNeural', label: '云野（女声）', locale: 'zh-CN' },
  { shortName: 'zh-CN-YunzeiNeural', label: '云泽（男声）', locale: 'zh-CN' },
  { shortName: 'zh-CN-YunzhenNeural', label: '云臻（女声）', locale: 'zh-CN' },
  // 英文音色
  { shortName: 'en-US-JennyNeural', label: 'Jenny（英文女声）', locale: 'en-US' },
  { shortName: 'en-US-GuyNeural', label: 'Guy（英文男声）', locale: 'en-US' },
  { shortName: 'en-US-AriaNeural', label: 'Aria（英文女声）', locale: 'en-US' },
  { shortName: 'en-US-DavisNeural', label: 'Davis（英文男声）', locale: 'en-US' },
];

interface UseEdgeTTSOptions {
  voice?: string;
  rate?: number;  // -100 ~ 100，0 为正常语速
  pitch?: number; // -50 ~ 50，0 为正常音调
  volume?: number; // 0 ~ 100，100 为正常音量
}

interface UseEdgeTTSReturn {
  isSpeaking: boolean;
  isLoading: boolean;
  speak: (text: string) => Promise<void>;
  stop: () => void;
  toggle: (text: string) => Promise<void>;
  setVoice: (shortName: string) => void;
  currentVoice: string;
}

function generateRandomHex(): string {
  const randomBytes = new Uint8Array(16);
  window.crypto.getRandomValues(randomBytes);
  return Array.from(randomBytes)
    .map(b => b.toString(16).padStart(2, '0'))
    .join('');
}

function cleanMarkdown(text: string): string {
  return text
    .replace(/```[\s\S]*?```/g, '代码块')
    .replace(/`([^`]+)`/g, '$1')
    .replace(/\*\*([^*]+)\*\*/g, '$1')
    .replace(/\*([^*]+)\*/g, '$1')
    .replace(/#{1,6}\s/g, '')
    .replace(/\[([^\]]+)\]\([^)]+\)/g, '$1')
    .replace(/[-*+]\s/g, '')
    .replace(/>\s/g, '')
    .replace(/\n+/g, '。')
    .trim();
}

export function useEdgeTTS(options: UseEdgeTTSOptions = {}): UseEdgeTTSReturn {
  const [isSpeaking, setIsSpeaking] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const [currentVoice, setCurrentVoice] = useState(
    options.voice || EDGE_VOICES[0].shortName
  );
  const [rate, setRate] = useState(options.rate ?? 0);
  const [pitch, setPitch] = useState(options.pitch ?? 0);
  const [volume, setVolume] = useState(options.volume ?? 100);

  const audioRef = useRef<HTMLAudioElement | null>(null);
  const wsRef = useRef<WebSocket | null>(null);
  const blobsRef = useRef<Blob[]>([]);
  const abortRef = useRef(false);

  // 清理 markdown 并生成 SSML
  const buildSSML = useCallback((text: string): string => {
    const cleanText = cleanMarkdown(text);
    return `<speak xmlns="http://www.w3.org/2001/10/synthesis" xmlns:mstts="http://www.w3.org/2001/mstts" version="1.0" xml:lang="zh-CN">
  <voice name="${currentVoice}">
    <prosody rate="${rate}%" pitch="${pitch}%" volume="${volume}">
      ${cleanText}
    </prosody>
  </voice>
</speak>`;
  }, [currentVoice, rate, pitch, volume]);

  // 发送 WebSocket 请求
  const sendReq = useCallback((ssml: string, connectionId: string) => {
    if (!wsRef.current) return;

    const configData = {
      context: {
        synthesis: {
          audio: {
            metadataoptions: {
              sentenceBoundaryEnabled: 'false',
              wordBoundaryEnabled: 'false',
            },
            outputFormat: 'audio-24khz-48kbitrate-mono-mp3',
          },
        },
      },
    };

    const configMessage =
      `X-Timestamp:${new Date().toUTCString()}\r\n` +
      'Content-Type:application/json; charset=utf-8\r\n' +
      'Path:speech.config\r\n\r\n' +
      JSON.stringify(configData);

    const ssmlMessage =
      `X-Timestamp:${new Date().toUTCString()}\r\n` +
      `X-RequestId:${connectionId}\r\n` +
      'Content-Type:application/ssml+xml\r\n' +
      'Path:ssml\r\n\r\n' +
      ssml;

    wsRef.current.send(configMessage);
    wsRef.current.send(ssmlMessage);
  }, []);

  // 连接到 Edge TTS WebSocket
  const connect = useCallback((ssml: string): Promise<string> => {
    return new Promise((resolve, reject) => {
      const connectionId = generateRandomHex();
      const url = `wss://speech.platform.bing.com/consumer/speech/synthesize/readaloud/edge/v1?TrustedClientToken=6A5AA1D4EAFF4E9FB37E23D68491D6F4&ConnectionId=${connectionId}`;

      abortRef.current = false;
      blobsRef.current = [];

      const ws = new WebSocket(url);
      wsRef.current = ws;

      ws.onopen = () => {
        sendReq(ssml, connectionId);
      };

      ws.onclose = (code, reason) => {
        wsRef.current = null;
        blobsRef.current = [];
      };

      ws.onmessage = (message) => {
        if (abortRef.current) return;

        if (!(message.data instanceof Blob)) {
          const data = message.data.toString();
          if (data.includes('Path:turn.end')) {
            // 结束传输，合并音频片段
            const audioChunks = blobsRef.current;
            if (audioChunks.length === 0) {
              reject(new Error('No audio data received'));
              return;
            }

            // 去掉每个音频块前面的 130 字节头，最后一个块去掉 105 字节
            const processedChunks = audioChunks.map((blob, i) => {
              const start = i === audioChunks.length - 1 ? 105 : 130;
              return blob.slice(start);
            });

            const resultBlob = new Blob(processedChunks, { type: 'audio/mp3' });
            const audioUrl = URL.createObjectURL(resultBlob);

            ws.close();
            resolve(audioUrl);
          }
        } else if (message.data instanceof Blob) {
          blobsRef.current.push(message.data);
        }
      };

      ws.onerror = (error) => {
        wsRef.current = null;
        reject(error);
      };
    });
  }, [sendReq]);

  const speak = useCallback(async (text: string) => {
    if (!text || isSpeaking) return;

    // 停止之前的播放
    stop();

    setIsLoading(true);
    setIsSpeaking(true);

    try {
      const ssml = buildSSML(text);
      const audioUrl = await connect(ssml);

      if (abortRef.current) {
        if (audioUrl) URL.revokeObjectURL(audioUrl);
        return;
      }

      // 创建音频元素并播放
      const audio = new Audio(audioUrl);
      audioRef.current = audio;

      audio.onended = () => {
        setIsSpeaking(false);
        setIsLoading(false);
        URL.revokeObjectURL(audioUrl);
      };

      audio.onerror = () => {
        setIsSpeaking(false);
        setIsLoading(false);
        URL.revokeObjectURL(audioUrl);
      };

      await audio.play();
    } catch (err) {
      console.error('[EdgeTTS] speak error:', err);
      setIsSpeaking(false);
    } finally {
      setIsLoading(false);
    }
  }, [isSpeaking, buildSSML, connect]);

  const stop = useCallback(() => {
    abortRef.current = true;

    if (wsRef.current) {
      wsRef.current.close();
      wsRef.current = null;
    }

    if (audioRef.current) {
      audioRef.current.pause();
      audioRef.current = null;
    }

    setIsSpeaking(false);
    setIsLoading(false);
  }, []);

  const toggle = useCallback(async (text: string) => {
    if (isSpeaking) {
      stop();
    } else {
      await speak(text);
    }
  }, [isSpeaking, stop, speak]);

  const setVoice = useCallback((shortName: string) => {
    setCurrentVoice(shortName);
  }, []);

  // 组件卸载时清理
  useEffect(() => {
    return () => {
      stop();
    };
  }, [stop]);

  return {
    isSpeaking,
    isLoading,
    speak,
    stop,
    toggle,
    setVoice,
    currentVoice,
  };
}
