import { useCallback, useRef, useState, useEffect } from 'react';

export interface AudioRecorderState {
  isRecording: boolean;
  isPaused: boolean;
  duration: number;
  audioBlob: Blob | null;
  audioUrl: string | null;
  error: string | null;
  volumeLevels: number[];
}

export interface AudioRecorderControls {
  startRecording: (deviceId?: string) => Promise<void>;
  stopRecording: () => void;
  pauseRecording: () => void;
  resumeRecording: () => void;
  resetRecording: () => void;
  clearError: () => void;
}

/**
 * 语音录制 Hook（使用 MediaRecorder API）
 */
export function useAudioRecorder(): AudioRecorderState & AudioRecorderControls {
  const [state, setState] = useState<AudioRecorderState>({
    isRecording: false,
    isPaused: false,
    duration: 0,
    audioBlob: null,
    audioUrl: null,
    error: null,
    volumeLevels: [],
  });

  const mediaRecorderRef = useRef<MediaRecorder | null>(null);
  const chunksRef = useRef<Blob[]>([]);
  const timerRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const startTimeRef = useRef<number>(0);
  const streamRef = useRef<MediaStream | null>(null);
  const audioContextRef = useRef<AudioContext | null>(null);
  const analyserRef = useRef<AnalyserNode | null>(null);
  const dataArrayRef = useRef<Uint8Array | null>(null);
  const animationFrameRef = useRef<number | null>(null);
  const volumeLevelsRef = useRef<number[]>([]);
  const mimeTypeRef = useRef<string>('');

  // 强制清理所有资源
  const forceCleanup = useCallback(() => {
    console.log('[useAudioRecorder] 强制清理所有资源');
    
    // 1. 清理动画帧
    if (animationFrameRef.current) {
      cancelAnimationFrame(animationFrameRef.current);
      animationFrameRef.current = null;
    }

    // 2. 清理音频上下文
    if (audioContextRef.current) {
      try {
        audioContextRef.current.close();
      } catch (e) {
        console.error('[useAudioRecorder] 关闭AudioContext失败:', e);
      }
      audioContextRef.current = null;
    }
    analyserRef.current = null;
    dataArrayRef.current = null;

    // 3. 清理计时器
    if (timerRef.current) {
      clearInterval(timerRef.current);
      timerRef.current = null;
    }

    // 4. 清理MediaRecorder
    if (mediaRecorderRef.current) {
      try {
        if (mediaRecorderRef.current.state === 'recording') {
          mediaRecorderRef.current.stop();
        }
      } catch (e) {
        console.error('[useAudioRecorder] 停止MediaRecorder失败:', e);
      }
      mediaRecorderRef.current.ondataavailable = null;
      mediaRecorderRef.current.onstop = null;
      mediaRecorderRef.current.onerror = null;
      mediaRecorderRef.current = null;
    }

    // 5. 清理MediaStream（这是最重要的！）
    if (streamRef.current) {
      const tracks = streamRef.current.getTracks();
      console.log('[useAudioRecorder] 停止', tracks.length, '个MediaStream轨道');
      tracks.forEach(track => {
        try {
          track.stop();
          console.log('[useAudioRecorder] 停止轨道:', track.kind, track.id);
        } catch (e) {
          console.error('[useAudioRecorder] 停止轨道失败:', e);
        }
      });
      streamRef.current = null;
    }

    // 6. 清理URL
    if (state.audioUrl) {
      try {
        URL.revokeObjectURL(state.audioUrl);
      } catch (e) {
        console.error('[useAudioRecorder] 撤销URL失败:', e);
      }
    }

    chunksRef.current = [];
    volumeLevelsRef.current = [];
  }, [state.audioUrl]);

  // 初始化音量可视化
  const initVolumeAnalyzer = useCallback((stream: MediaStream) => {
    try {
      const AudioContextClass = (window as any).AudioContext || (window as any).webkitAudioContext;
      if (!AudioContextClass) return;

      const audioContext = new AudioContextClass();
      audioContextRef.current = audioContext;

      const analyser = audioContext.createAnalyser();
      analyser.fftSize = 256;
      analyserRef.current = analyser;

      const bufferLength = analyser.frequencyBinCount;
      const dataArray = new Uint8Array(bufferLength);
      dataArrayRef.current = dataArray;

      const source = audioContext.createMediaStreamSource(stream);
      source.connect(analyser);

      volumeLevelsRef.current = new Array(12).fill(0.1);

      const animate = () => {
        if (!analyserRef.current || !dataArrayRef.current) {
          return;
        }

        analyserRef.current.getByteFrequencyData(dataArrayRef.current);
        
        let sum = 0;
        for (let i = 0; i < bufferLength; i++) {
          sum += dataArrayRef.current[i];
        }
        const average = sum / bufferLength;
        const normalizedVolume = Math.max(0.1, average / 256);

        volumeLevelsRef.current.shift();
        volumeLevelsRef.current.push(normalizedVolume);

        setState(prev => ({
          ...prev,
          volumeLevels: [...volumeLevelsRef.current],
        }));

        animationFrameRef.current = requestAnimationFrame(animate);
      };

      animationFrameRef.current = requestAnimationFrame(animate);
      console.log('[useAudioRecorder] 音量分析器初始化成功');
    } catch (error) {
      console.error('[useAudioRecorder] 初始化音频分析器失败:', error);
    }
  }, []);

  const startRecording = useCallback(async (deviceId?: string) => {
    console.log('[useAudioRecorder] 开始录音, deviceId:', deviceId);
    
    try {
      // 先清理之前的资源
      forceCleanup();
      
      // 最简单的音频约束
      const constraints: MediaStreamConstraints = {
        audio: deviceId 
          ? { deviceId: { exact: deviceId } }
          : true
      };

      console.log('[useAudioRecorder] 请求MediaStream, 约束:', constraints);

      let stream: MediaStream;
      try {
        stream = await navigator.mediaDevices.getUserMedia(constraints);
        console.log('[useAudioRecorder] 获取MediaStream成功, 轨道数:', stream.getTracks().length);
        stream.getTracks().forEach(track => {
          console.log('[useAudioRecorder] 轨道:', track.kind, track.id, track.enabled);
        });
      } catch (permissionError: any) {
        console.error('[useAudioRecorder] 获取麦克风权限失败:', permissionError);
        
        let errorMessage = '无法访问麦克风';
        if (permissionError.name === 'NotAllowedError') {
          errorMessage = '麦克风访问被拒绝，请在系统设置中允许访问麦克风';
        } else if (permissionError.name === 'NotFoundError') {
          errorMessage = '未找到可用的麦克风设备';
        } else if (permissionError.name === 'NotReadableError') {
          errorMessage = '麦克风被其他应用占用';
        } else if (permissionError.name === 'OverconstrainedError') {
          errorMessage = '无法满足音频设备约束，请尝试选择其他设备';
        }
        
        setState(prev => ({ ...prev, error: errorMessage }));
        return;
      }

      streamRef.current = stream;

      // 初始化音量分析
      initVolumeAnalyzer(stream);

      // 选择合适的编码格式
      let mimeType = '';
      const types = [
        'audio/webm;codecs=opus',
        'audio/webm',
        'audio/ogg;codecs=opus',
        'audio/ogg'
      ];
      
      for (const type of types) {
        if (MediaRecorder.isTypeSupported(type)) {
          mimeType = type;
          break;
        }
      }
      mimeTypeRef.current = mimeType;
      console.log('[useAudioRecorder] 使用编码:', mimeType);
      
      const options = mimeType ? { mimeType } : undefined;
      const mediaRecorder = new MediaRecorder(stream, options);
      mediaRecorderRef.current = mediaRecorder;
      
      chunksRef.current = [];

      mediaRecorder.ondataavailable = (event) => {
        console.log('[useAudioRecorder] 收到数据块, 大小:', event.data.size);
        if (event.data && event.data.size > 0) {
          chunksRef.current.push(event.data);
        }
      };

      mediaRecorder.onstop = () => {
        console.log('[useAudioRecorder] MediaRecorder onstop触发');
        console.log('[useAudioRecorder] 收集到的块数:', chunksRef.current.length);
        
        try {
          const blobType = mimeTypeRef.current || 'audio/webm';
          const blob = new Blob(chunksRef.current, { type: blobType });
          
          console.log('[useAudioRecorder] 生成Blob, 大小:', blob.size, '类型:', blob.type);
          
          // 这里不立即清理资源，先保存结果
          // 等设置完状态后再清理
          
          const url = URL.createObjectURL(blob);
          
          setState(prev => ({
            ...prev,
            isRecording: false,
            isPaused: false,
            audioBlob: blob,
            audioUrl: url,
            error: null,
          }));
          
          // 延迟清理，确保状态更新完成
          setTimeout(() => {
            forceCleanup();
          }, 100);
          
        } catch (error) {
          console.error('[useAudioRecorder] 处理录音数据失败:', error);
          setState(prev => ({
            ...prev,
            isRecording: false,
            isPaused: false,
            error: '处理录音数据失败',
          }));
          forceCleanup();
        }
      };

      mediaRecorder.onerror = (event: any) => {
        console.error('[useAudioRecorder] MediaRecorder错误:', event);
        setState(prev => ({
          ...prev,
          isRecording: false,
          error: event.error?.message || '录音过程中发生错误',
        }));
        forceCleanup();
      };

      // 使用100ms的timeslice确保数据及时收集
      mediaRecorder.start(100);
      console.log('[useAudioRecorder] MediaRecorder已启动');

      startTimeRef.current = Date.now();
      timerRef.current = setInterval(() => {
        setState(prev => ({
          ...prev,
          duration: Math.floor((Date.now() - startTimeRef.current) / 1000),
        }));
      }, 1000);

      setState(prev => ({
        ...prev,
        isRecording: true,
        isPaused: false,
        error: null,
        audioBlob: null,
        audioUrl: null,
        duration: 0,
        volumeLevels: new Array(12).fill(0.1),
      }));
      
      console.log('[useAudioRecorder] 录音启动完成');
      
    } catch (error: any) {
      console.error('[useAudioRecorder] 启动录音失败:', error);
      forceCleanup();
      setState(prev => ({
        ...prev,
        error: error?.message || '启动录音失败',
      }));
    }
  }, [forceCleanup, initVolumeAnalyzer]);

  const stopRecording = useCallback(() => {
    console.log('[useAudioRecorder] 停止录音被调用');
    
    if (mediaRecorderRef.current && mediaRecorderRef.current.state !== 'inactive') {
      try {
        console.log('[useAudioRecorder] 调用MediaRecorder.stop()');
        mediaRecorderRef.current.stop();
      } catch (error) {
        console.error('[useAudioRecorder] 停止录音失败:', error);
        forceCleanup();
        setState(prev => ({
          ...prev,
          isRecording: false,
        }));
      }
    } else {
      console.log('[useAudioRecorder] MediaRecorder未激活，直接清理');
      forceCleanup();
      setState(prev => ({
        ...prev,
        isRecording: false,
      }));
    }
    
    if (timerRef.current) {
      clearInterval(timerRef.current);
      timerRef.current = null;
    }
  }, [forceCleanup]);

  const pauseRecording = useCallback(() => {
    if (mediaRecorderRef.current && mediaRecorderRef.current.state === 'recording') {
      mediaRecorderRef.current.pause();
      if (timerRef.current) {
        clearInterval(timerRef.current);
        timerRef.current = null;
      }
      setState(prev => ({ ...prev, isPaused: true }));
    }
  }, []);

  const resumeRecording = useCallback(() => {
    if (mediaRecorderRef.current && mediaRecorderRef.current.state === 'paused') {
      mediaRecorderRef.current.resume();
      startTimeRef.current = Date.now() - state.duration * 1000;
      timerRef.current = setInterval(() => {
        setState(prev => ({
          ...prev,
          duration: Math.floor((Date.now() - startTimeRef.current) / 1000),
        }));
      }, 1000);
      setState(prev => ({ ...prev, isPaused: false }));
    }
  }, [state.duration]);

  const resetRecording = useCallback(() => {
    console.log('[useAudioRecorder] 重置录音');
    forceCleanup();
    setState({
      isRecording: false,
      isPaused: false,
      duration: 0,
      audioBlob: null,
      audioUrl: null,
      error: null,
      volumeLevels: [],
    });
  }, [forceCleanup]);
  
  const clearError = useCallback(() => {
    setState(prev => ({ ...prev, error: null }));
  }, []);

  // 组件卸载时强制清理
  useEffect(() => {
    return () => {
      console.log('[useAudioRecorder] Hook卸载，清理资源');
      forceCleanup();
    };
  }, [forceCleanup]);

  return {
    ...state,
    startRecording,
    stopRecording,
    pauseRecording,
    resumeRecording,
    resetRecording,
    clearError,
  };
}
