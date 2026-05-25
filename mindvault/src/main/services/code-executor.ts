// @ts-nocheck
/**
 * 代码执行服务
 * 支持执行 JavaScript 代码（沙箱环境）
 */

const { exec } = require('child_process');
const path = require('path');

// 超时时间（毫秒）
const EXECUTION_TIMEOUT = 10000;
// 最大输出长度
const MAX_OUTPUT_LENGTH = 50000;

/**
 * 执行 JavaScript 代码
 * @param {string} code - JavaScript 代码
 * @returns {Promise<{success: boolean, output: string, error?: string}>}
 */
async function executeJavaScript(code) {
  return new Promise((resolve) => {
    try {
      // 安全检查
      const dangerousPatterns = [
        /require\s*\(/,
        /import\s+/,
        /process\./,
        /child_process/,
        /fs\./,
        /__dirname/,
        /__filename/,
        /global\./,
        /globalThis/,
        /module\./,
        /eval\s*\(/,
        /Function\s*\(/,
      ];

      for (const pattern of dangerousPatterns) {
        if (pattern.test(code)) {
          resolve({ success: false, output: '', error: '代码包含不允许的操作' });
          return;
        }
      }

      // 使用 Function 构造器创建沙箱
      const sandbox = {
        console: {
          log: (...args) => sandbox._outputs.push(args.map(a => typeof a === 'object' ? JSON.stringify(a, null, 2) : String(a)).join(' ')),
          error: (...args) => sandbox._outputs.push('[ERROR] ' + args.map(a => String(a)).join(' ')),
          warn: (...args) => sandbox._outputs.push('[WARN] ' + args.map(a => String(a)).join(' ')),
          info: (...args) => sandbox._outputs.push('[INFO] ' + args.map(a => String(a)).join(' ')),
        },
        _outputs: [],
        setTimeout: setTimeout,
        setInterval: setInterval,
        clearInterval: clearInterval,
        clearTimeout: clearTimeout,
        Math: Math,
        JSON: JSON,
        Date: Date,
        Array: Array,
        Object: Object,
        String: String,
        Number: Number,
        Boolean: Boolean,
        RegExp: RegExp,
        Map: Map,
        Set: Set,
        Promise: Promise,
        parseInt: parseInt,
        parseFloat: parseFloat,
        isNaN: isNaN,
        isFinite: isFinite,
        encodeURIComponent: encodeURIComponent,
        decodeURIComponent: decodeURIComponent,
      };

      const timer = setTimeout(() => {
        resolve({ success: false, output: sandbox._outputs.join('\n'), error: '执行超时（10秒限制）' });
      }, EXECUTION_TIMEOUT);

      try {
        const keys = Object.keys(sandbox).filter(k => k !== '_outputs');
        const values = keys.map(k => sandbox[k]);

        const fn = new Function(...keys, code);
        const result = fn(...values);

        // 如果返回 Promise，等待结果
        if (result && typeof result.then === 'function') {
          result
            .then((r) => {
              clearTimeout(timer);
              const output = sandbox._outputs.join('\n');
              const finalOutput = r !== undefined ? output + (output ? '\n' : '') + String(r) : output;
              resolve({ success: true, output: finalOutput.substring(0, MAX_OUTPUT_LENGTH) });
            })
            .catch((err) => {
              clearTimeout(timer);
              resolve({ success: false, output: sandbox._outputs.join('\n'), error: err.message });
            });
        } else {
          clearTimeout(timer);
          const output = sandbox._outputs.join('\n');
          const finalOutput = result !== undefined ? output + (output ? '\n' : '') + String(result) : output;
          resolve({ success: true, output: finalOutput.substring(0, MAX_OUTPUT_LENGTH) });
        }
      } catch (err) {
        clearTimeout(timer);
        resolve({ success: false, output: sandbox._outputs.join('\n'), error: err.message });
      }
    } catch (err) {
      resolve({ success: false, output: '', error: err.message });
    }
  });
}

/**
 * 执行 Python 代码（通过子进程）
 * @param {string} code - Python 代码
 * @returns {Promise<{success: boolean, output: string, error?: string}>}
 */
async function executePython(code) {
  return new Promise((resolve) => {
    // 安全检查
    const dangerousPatterns = [
      /import\s+os/,
      /import\s+subprocess/,
      /import\s+shutil/,
      /os\./,
      /subprocess\./,
      /shutil\./,
      /open\s*\(/,
      /exec\s*\(/,
      /eval\s*\(/,
      /__import__\s*\(/,
    ];

    for (const pattern of dangerousPatterns) {
      if (pattern.test(code)) {
        resolve({ success: false, output: '', error: '代码包含不允许的操作' });
        return;
      }
    }

    const timer = setTimeout(() => {
      resolve({ success: false, output: '', error: '执行超时（10秒限制）' });
    }, EXECUTION_TIMEOUT);

    exec('python -c ' + JSON.stringify(code), { timeout: EXECUTION_TIMEOUT, maxBuffer: MAX_OUTPUT_LENGTH }, (err, stdout, stderr) => {
      clearTimeout(timer);
      if (err && !stdout && !stderr) {
        resolve({ success: false, output: '', error: 'Python 未安装或执行失败' });
      } else {
        const output = (stdout || '') + (stderr ? '\n[STDERR] ' + stderr : '');
        resolve({
          success: !err,
          output: output.substring(0, MAX_OUTPUT_LENGTH),
          error: err ? err.message : undefined,
        });
      }
    });
  });
}

/**
 * 执行代码（自动检测语言）
 * @param {string} code - 代码
 * @param {string} language - 编程语言 ('javascript' | 'python')
 * @returns {Promise<{success: boolean, output: string, error?: string}>}
 */
async function executeCode(code, language = 'javascript') {
  if (!code || !code.trim()) {
    return { success: false, output: '', error: '代码不能为空' };
  }

  switch (language.toLowerCase()) {
    case 'javascript':
    case 'js':
      return executeJavaScript(code);
    case 'python':
    case 'py':
      return executePython(code);
    default:
      return { success: false, output: '', error: `不支持的语言: ${language}` };
  }
}

module.exports = { executeCode, executeJavaScript, executePython };
