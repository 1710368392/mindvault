/**
 * Screenshot and recording utilities for the visualizer.
 */

/** Take a screenshot from a canvas element and save via IPC */
export async function takeCanvasScreenshot(canvas: HTMLCanvasElement): Promise<{ success: boolean; filePath?: string; error?: string }> {
  try {
    const dataUrl = canvas.toDataURL('image/png');
    if (window.electronAPI?.window?.saveScreenshot) {
      return await window.electronAPI.window.saveScreenshot(dataUrl);
    }
    // Fallback: download directly
    const link = document.createElement('a');
    link.download = `visualizer-${Date.now()}.png`;
    link.href = dataUrl;
    link.click();
    return { success: true };
  } catch (err) {
    return { success: false, error: String(err) };
  }
}

/** Check if MediaRecorder and captureStream are available */
export function isRecordingSupported(): boolean {
  return typeof MediaRecorder !== 'undefined' &&
    typeof HTMLCanvasElement.prototype.captureStream === 'function';
}

/** Canvas recorder for recording visualizer to WebM video */
export class CanvasRecorder {
  private mediaRecorder: MediaRecorder | null = null;
  private chunks: Blob[] = [];
  private isRecording = false;

  /** Start recording from a canvas element */
  start(canvas: HTMLCanvasElement): boolean {
    if (this.isRecording) return false;
    if (!isRecordingSupported()) return false;

    try {
      const stream = (canvas as any).captureStream(30); // 30 fps
      this.chunks = [];

      // Try VP9 first, fall back to VP8, then default
      const mimeType = MediaRecorder.isTypeSupported('video/webm;codecs=vp9')
        ? 'video/webm;codecs=vp9'
        : MediaRecorder.isTypeSupported('video/webm;codecs=vp8')
          ? 'video/webm;codecs=vp8'
          : 'video/webm';

      this.mediaRecorder = new MediaRecorder(stream, {
        mimeType,
        videoBitsPerSecond: 5000000, // 5 Mbps
      });

      this.mediaRecorder.ondataavailable = (e) => {
        if (e.data.size > 0) {
          this.chunks.push(e.data);
        }
      };

      this.mediaRecorder.start(100); // Collect data every 100ms
      this.isRecording = true;
      return true;
    } catch {
      return false;
    }
  }

  /** Stop recording and save the video */
  async stop(): Promise<{ success: boolean; filePath?: string; error?: string }> {
    if (!this.isRecording || !this.mediaRecorder) {
      return { success: false, error: 'Not recording' };
    }

    return new Promise((resolve) => {
      this.mediaRecorder!.onstop = async () => {
        const blob = new Blob(this.chunks, { type: 'video/webm' });
        this.chunks = [];
        this.isRecording = false;

        try {
          const buffer = await blob.arrayBuffer();
          if (window.electronAPI?.window?.saveRecording) {
            const result = await window.electronAPI.window.saveRecording(Array.from(new Uint8Array(buffer)));
            resolve(result);
          } else {
            // Fallback: download directly
            const url = URL.createObjectURL(blob);
            const link = document.createElement('a');
            link.download = `visualizer-${Date.now()}.webm`;
            link.href = url;
            link.click();
            URL.revokeObjectURL(url);
            resolve({ success: true });
          }
        } catch (err) {
          resolve({ success: false, error: String(err) });
        }
      };

      this.mediaRecorder!.stop();
    });
  }

  /** Whether currently recording */
  get recording(): boolean {
    return this.isRecording;
  }
}
