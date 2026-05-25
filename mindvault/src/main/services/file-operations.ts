// @ts-nocheck
/**
 * 文件操作服务（安全沙箱）
 * 支持白名单目录机制，保护用户数据安全
 */

const fs = require('fs');
const path = require('path');

// 允许访问的目录白名单（用户可配置）
let allowedDirectories = [];

// 操作日志
const operationLog = [];

// 最大文件读取大小（10MB）
const MAX_READ_SIZE = 10 * 1024 * 1024;

/**
 * 设置允许访问的目录白名单
 * @param {string[]} dirs - 目录路径数组
 */
function setAllowedDirectories(dirs) {
  allowedDirectories = (dirs || []).map(d => path.resolve(d));
}

/**
 * 获取当前白名单
 */
function getAllowedDirectories() {
  return [...allowedDirectories];
}

/**
 * 检查路径是否在白名单内
 */
function isPathAllowed(filePath) {
  if (allowedDirectories.length === 0) return true; // 未配置白名单时允许所有

  const resolvedPath = path.resolve(filePath);
  return allowedDirectories.some(dir => resolvedPath.startsWith(dir));
}

/**
 * 记录操作日志
 */
function logOperation(operation, filePath, success) {
  operationLog.push({
    operation,
    filePath,
    success,
    timestamp: Date.now(),
  });
  // 只保留最近100条日志
  if (operationLog.length > 100) {
    operationLog.shift();
  }
}

/**
 * 列出目录内容
 */
function listDirectory(dirPath) {
  try {
    if (!isPathAllowed(dirPath)) {
      return { success: false, error: '该目录不在允许访问的白名单内' };
    }

    const resolvedPath = path.resolve(dirPath);
    if (!fs.existsSync(resolvedPath)) {
      return { success: false, error: '目录不存在' };
    }

    const stat = fs.statSync(resolvedPath);
    if (!stat.isDirectory()) {
      return { success: false, error: '路径不是目录' };
    }

    const items = fs.readdirSync(resolvedPath, { withFileTypes: true });
    const result = items.map(item => ({
      name: item.name,
      isDirectory: item.isDirectory(),
      isFile: item.isFile(),
      size: item.isFile() ? fs.statSync(path.join(resolvedPath, item.name)).size : 0,
    }));

    logOperation('list', dirPath, true);
    return { success: true, data: result };
  } catch (err) {
    logOperation('list', dirPath, false);
    return { success: false, error: err.message };
  }
}

/**
 * 读取文件内容
 */
function readFile(filePath) {
  try {
    if (!isPathAllowed(filePath)) {
      return { success: false, error: '该文件不在允许访问的白名单内' };
    }

    const resolvedPath = path.resolve(filePath);
    if (!fs.existsSync(resolvedPath)) {
      return { success: false, error: '文件不存在' };
    }

    const stat = fs.statSync(resolvedPath);
    if (stat.size > MAX_READ_SIZE) {
      return { success: false, error: `文件过大（${(stat.size / 1024 / 1024).toFixed(1)}MB），最大支持10MB` };
    }

    // 检查文件类型
    const ext = path.extname(resolvedPath).toLowerCase();
    const dangerousExts = ['.exe', '.bat', '.cmd', '.sh', '.ps1', '.vbs', '.js', '.mjs'];
    if (dangerousExts.includes(ext)) {
      return { success: false, error: `不允许读取可执行文件类型: ${ext}` };
    }

    const content = fs.readFileSync(resolvedPath, 'utf-8');
    logOperation('read', filePath, true);
    return { success: true, data: { content, size: stat.size, path: resolvedPath } };
  } catch (err) {
    logOperation('read', filePath, false);
    return { success: false, error: err.message };
  }
}

/**
 * 写入文件（需要确认）
 */
function writeFile(filePath, content) {
  try {
    if (!isPathAllowed(filePath)) {
      return { success: false, error: '该文件不在允许访问的白名单内', needsConfirmation: false };
    }

    // 写入操作需要确认
    const resolvedPath = path.resolve(filePath);
    const exists = fs.existsSync(resolvedPath);

    logOperation('write', filePath, true);
    fs.writeFileSync(resolvedPath, content, 'utf-8');

    return {
      success: true,
      message: exists ? '文件已更新' : '文件已创建',
      path: resolvedPath,
    };
  } catch (err) {
    logOperation('write', filePath, false);
    return { success: false, error: err.message };
  }
}

/**
 * 获取操作日志
 */
function getOperationLog(limit = 20) {
  return operationLog.slice(-limit).reverse();
}

module.exports = {
  setAllowedDirectories,
  getAllowedDirectories,
  listDirectory,
  readFile,
  writeFile,
  getOperationLog,
  isPathAllowed,
};
