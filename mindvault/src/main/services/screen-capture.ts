// @ts-nocheck
/**
 * 截屏服务
 * 使用 Electron desktopCapturer 截取应用窗口截图
 */

const { desktopCapturer } = require('electron');

/**
 * 截取当前应用窗口的截图
 * @returns {Promise<{success: boolean, data?: {imageBase64: string, width: number, height: number}, error?: string}>}
 */
async function captureWindow(windowId?: number): Promise<any> {
  try {
    const sources = await desktopCapturer.getSources({
      types: ['window'],
      thumbnailSize: { width: 1280, height: 720 },
    });

    // 查找目标窗口
    let targetSource = null;
    if (windowId) {
      targetSource = sources.find((s: any) => s.id === String(windowId));
    }

    // 如果没找到指定窗口，使用第一个窗口
    if (!targetSource && sources.length > 0) {
      targetSource = sources[0];
    }

    if (!targetSource) {
      return { success: false, error: '未找到可截取的窗口' };
    }

    // 将截图转换为 base64
    const thumbnail = targetSource.thumbnail;
    const imageBase64 = thumbnail.toDataURL('image/jpeg', 0.7).split(',')[1];

    return {
      success: true,
      data: {
        imageBase64,
        width: thumbnail.getSize().width,
        height: thumbnail.getSize().height,
        windowTitle: targetSource.name,
      },
    };
  } catch (err: any) {
    console.error('[ScreenCapture] 截屏失败:', err.message);
    return { success: false, error: err.message };
  }
}

/**
 * 截取指定区域的截图
 */
async function captureRegion(windowId: number, region: { x: number; y: number; width: number; height: number }): Promise<any> {
  try {
    const result = await captureWindow(windowId);
    if (!result.success) return result;

    // 注意：区域裁剪需要在渲染进程中使用 Canvas 完成
    // 这里返回完整截图和区域信息，由调用方处理裁剪
    return {
      ...result,
      region,
    };
  } catch (err: any) {
    return { success: false, error: err.message };
  }
}

module.exports = { captureWindow, captureRegion };
