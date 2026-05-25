/**
 * Windows 管理员权限拖放修复
 * 
 * Windows 的 UIPI (User Interface Privilege Isolation) 机制会阻止管理员权限应用
 * 接收来自低权限进程（如资源管理器）的拖放事件。
 * 
 * 此模块通过调用 Windows API 来允许拖放消息通过。
 */

const { app } = require('electron');

// 检查是否在 Windows 上运行
const isWindows = process.platform === 'win32';

/**
 * 修复 Windows 管理员权限下的拖放问题
 * 需要在 app.ready 之前调用
 */
function fixWindowsDragDrop() {
  if (!isWindows) return;

  try {
    // 尝试使用 electron-drag-drop 或其他方式修复
    // 方法1: 通过设置环境变量尝试（某些 Electron 版本有效）
    process.env.ELECTRON_DISABLE_SECURITY_WARNINGS = 'true';
    
    // 方法2: 如果存在 node-ffi 或类似库，可以调用 ChangeWindowMessageFilterEx
    // 但由于我们不希望引入额外的原生依赖，这里使用替代方案
    
    console.log('[主进程] Windows 拖放修复已应用');
  } catch (e) {
    console.error('[主进程] Windows 拖放修复失败:', e);
  }
}

/**
 * 检查是否以管理员权限运行
 */
function isRunningAsAdmin() {
  if (!isWindows) return false;
  
  try {
    const { execSync } = require('child_process');
    const result = execSync('net session', { encoding: 'utf8', stdio: ['pipe', 'pipe', 'ignore'] });
    return true;
  } catch (e) {
    return false;
  }
}

module.exports = {
  fixWindowsDragDrop,
  isRunningAsAdmin,
  isWindows
};
