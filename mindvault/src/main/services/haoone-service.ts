// @ts-nocheck
/**
 * haoone CLI 服务封装
 * 提供对 haoone-cli 命令的封装调用
 */

const execSync = require('child_process').execSync;
const path = require('path');

// 检查 haoone-cli 是否可用
function checkEnvironment() {
  const result = {
    cliAvailable: false,
    loggedIn: false,
    activated: false,
    hasModels: false,
    installedModels: [],
    config: null,
    message: '',
  };

  // 1. 检查 CLI 是否可用
  try {
    execSync('haoone-cli --version', { encoding: 'utf-8', stdio: 'pipe' });
    result.cliAvailable = true;
  } catch (e) {
    result.message = 'haoone-cli 未安装或不在 PATH 中。请先安装 haoone 软件并确保命令行工具已启动。';
    return result;
  }

  // 2. 检查配置和登录状态
  try {
    const configOutput = execSync('haoone-cli get-config', { encoding: 'utf-8', stdio: 'pipe' });
    result.config = parseConfigOutput(configOutput);

    // 从配置中判断登录和激活状态
    result.loggedIn = result.config['用户 token 状态'] === '已登录';
    result.activated = result.config['激活状态'] === '已激活';
  } catch (e) {
    result.message = '获取配置失败，请检查 haoone 是否正常运行';
    return result;
  }

  // 3. 检查已安装模型
  try {
    const modelsOutput = execSync('haoone-cli installed-models', { encoding: 'utf-8', stdio: 'pipe' });
    result.installedModels = parseModelsOutput(modelsOutput);
    result.hasModels = result.installedModels.length > 0;
  } catch (e) {
    result.hasModels = false;
  }

  // 4. 汇总状态
  if (!result.loggedIn) {
    result.message = '请先登录 haoone 账号';
  } else if (!result.activated) {
    result.message = '请先激活 haoone';
  } else if (!result.hasModels) {
    result.message = '请先下载至少一个转录模型';
  } else {
    result.message = '环境检查通过';
  }

  return result;
}

// 转录单个文件
function transcribe(filePath, options = {}) {
  const {
    outputDir = null,
    model = null,
    language = 'zh',
    timelineName = null,
    enableAiCorrection = false,
    maxSubtitleLength = 25,
  } = options;

  const args = [];

  // 文件路径（必填）
  args.push('-f', `"${filePath}"`);

  // 时间线名称
  if (timelineName) {
    args.push('-n', `"${timelineName}"`);
  }

  // 输出目录
  if (outputDir) {
    args.push('-o', `"${outputDir}"`);
  }

  // 模型
  if (model) {
    args.push('-m', `"${model}"`);
  }

  // 语言
  if (language) {
    args.push('-l', language);
  }

  // AI 智能拆行
  if (enableAiCorrection) {
    args.push('-a', 'true');
  }

  // 字幕最大长度
  if (maxSubtitleLength !== 25) {
    args.push('-s', String(maxSubtitleLength));
  }

  const cmd = `haoone-cli transcribe ${args.join(' ')}`;

  try {
    const output = execSync(cmd, { encoding: 'utf-8', maxBuffer: 50 * 1024 * 1024 });
    return {
      success: true,
      output: output,
      files: parseTranscribeOutput(output),
    };
  } catch (e) {
    const errorOutput = e.stdout ? e.stdout.toString() : (e.message || '');
    return {
      success: false,
      error: errorOutput || e.message,
      message: `转录失败: ${errorOutput || e.message}`,
    };
  }
}

// 批量转录
function batchTranscribe(filePaths, options = {}) {
  const {
    outputDir = null,
    model = null,
    language = 'zh',
    enableAiCorrection = true,
    maxSubtitleLength = 25,
  } = options;

  const args = [];

  // 文件路径（逗号分隔）
  const filesStr = filePaths.map(f => `"${f}"`).join(',');
  args.push('-f', filesStr);

  // 输出目录
  if (outputDir) {
    args.push('-o', `"${outputDir}"`);
  }

  // 模型
  if (model) {
    args.push('-m', `"${model}"`);
  }

  // 语言
  if (language) {
    args.push('-l', language);
  }

  // AI 智能拆行
  if (enableAiCorrection) {
    args.push('-a', 'true');
  }

  // 字幕最大长度
  if (maxSubtitleLength !== 25) {
    args.push('-s', String(maxSubtitleLength));
  }

  const cmd = `haoone-cli batch-transcribe ${args.join(' ')}`;

  try {
    const output = execSync(cmd, { encoding: 'utf-8', maxBuffer: 100 * 1024 * 1024 });
    return {
      success: true,
      output: output,
      files: parseBatchOutput(output),
    };
  } catch (e) {
    const errorOutput = e.stdout ? e.stdout.toString() : (e.message || '');
    return {
      success: false,
      error: errorOutput || e.message,
      message: `批量转录失败: ${errorOutput || e.message}`,
    };
  }
}

// 列出已安装模型
function listModels() {
  try {
    const output = execSync('haoone-cli installed-models', { encoding: 'utf-8', stdio: 'pipe' });
    return {
      success: true,
      models: parseModelsOutput(output),
      output: output,
    };
  } catch (e) {
    return {
      success: false,
      error: e.message,
      message: `获取模型列表失败: ${e.message}`,
    };
  }
}

// 获取配置信息
function getConfig() {
  try {
    const output = execSync('haoone-cli get-config', { encoding: 'utf-8', stdio: 'pipe' });
    return {
      success: true,
      config: parseConfigOutput(output),
      output: output,
    };
  } catch (e) {
    return {
      success: false,
      error: e.message,
      message: `获取配置失败: ${e.message}`,
    };
  }
}

// 获取热词配置
function getHotwords() {
  try {
    const output = execSync('haoone-cli get-hotwords', { encoding: 'utf-8', stdio: 'pipe' });
    return {
      success: true,
      output: output,
    };
  } catch (e) {
    return {
      success: false,
      error: e.message,
      message: `获取热词失败: ${e.message}`,
    };
  }
}

// 获取项目列表
function getProjectList() {
  try {
    const output = execSync('haoone-cli get-project-list', { encoding: 'utf-8', stdio: 'pipe' });
    return {
      success: true,
      output: output,
    };
  } catch (e) {
    return {
      success: false,
      error: e.message,
      message: `获取项目列表失败: ${e.message}`,
    };
  }
}

// 创建项目
function createProject(projectName) {
  try {
    const output = execSync(`haoone-cli create-project -n "${projectName}"`, { encoding: 'utf-8', stdio: 'pipe' });
    return {
      success: true,
      output: output,
      message: `项目 "${projectName}" 创建成功`,
    };
  } catch (e) {
    const errorOutput = e.stdout ? e.stdout.toString() : (e.message || '');
    return {
      success: false,
      error: errorOutput || e.message,
      message: `创建项目失败: ${errorOutput || e.message}`,
    };
  }
}

// 删除项目
function deleteProject(projectName) {
  const cmd = projectName
    ? `haoone-cli delete-project -n "${projectName}"`
    : 'haoone-cli delete-project';

  try {
    const output = execSync(cmd, { encoding: 'utf-8', stdio: 'pipe' });
    return {
      success: true,
      output: output,
      message: projectName ? `项目 "${projectName}" 已删除` : '当前项目已删除',
    };
  } catch (e) {
    const errorOutput = e.stdout ? e.stdout.toString() : (e.message || '');
    return {
      success: false,
      error: errorOutput || e.message,
      message: `删除项目失败: ${errorOutput || e.message}`,
    };
  }
}

// 文稿格式化
function formatDraft(filePath) {
  try {
    const output = execSync(`haoone-cli format-draft -p "${filePath}"`, { encoding: 'utf-8', stdio: 'pipe' });
    return {
      success: true,
      output: output,
    };
  } catch (e) {
    const errorOutput = e.stdout ? e.stdout.toString() : (e.message || '');
    return {
      success: false,
      error: errorOutput || e.message,
      message: `文稿格式化失败: ${errorOutput || e.message}`,
    };
  }
}

// ============ 解析工具函数 ============

// 解析转录输出，提取文件路径
function parseTranscribeOutput(output) {
  const result = { srtFile: null, jsonFile: null, mediaPath: null };
  const lines = output.split('\n');

  for (const line of lines) {
    const trimmed = line.trim();
    if (trimmed.startsWith('srt_file_path=')) {
      result.srtFile = trimmed.substring('srt_file_path='.length).trim();
    } else if (trimmed.startsWith('json_file_path=')) {
      result.jsonFile = trimmed.substring('json_file_path='.length).trim();
    } else if (trimmed.startsWith('media_path=')) {
      result.mediaPath = trimmed.substring('media_path='.length).trim();
    }
  }

  return result;
}

// 解析批量转录输出
function parseBatchOutput(output) {
  const files = [];
  const lines = output.split('\n');

  for (const line of lines) {
    const trimmed = line.trim();
    if (trimmed.startsWith('srt_file_path=') || trimmed.startsWith('json_file_path=')) {
      const [key, value] = trimmed.split('=');
      const existing = files.find(f => f.mediaName === path.basename(value, path.extname(value)));
      if (existing) {
        if (key === 'srt_file_path=') existing.srtFile = value.trim();
        if (key === 'json_file_path=') existing.jsonFile = value.trim();
      } else {
        files.push({
          mediaName: path.basename(value, path.extname(value)),
          [key === 'srt_file_path=' ? 'srtFile' : 'jsonFile']: value.trim(),
        });
      }
    }
  }

  return files;
}

// 解析模型列表输出
function parseModelsOutput(output) {
  const models = [];
  const lines = output.split('\n');

  // 跳过表头，找到模型行
  let inTable = false;
  for (const line of lines) {
    const trimmed = line.trim();

    // 检测表格开始
    if (trimmed.includes('---') || trimmed.includes('模型名称') || trimmed.includes('Model Name')) {
      inTable = true;
      continue;
    }

    // 跳过表头和空行
    if (!inTable || !trimmed || trimmed.startsWith('模型名称') || trimmed.startsWith('Model')) {
      continue;
    }

    // 解析表格行（用 | 分隔）
    const cells = trimmed.split('|').filter(c => c.trim());
    if (cells.length >= 2) {
      const modelName = cells[0].trim();
      const modelType = cells[1].trim();
      if (modelName && modelName !== '---') {
        models.push({ name: modelName, type: modelType });
      }
    }

    // 如果只有一列且不为空，也当作模型名
    if (cells.length === 1 && cells[0].trim() && !cells[0].includes('---')) {
      const name = cells[0].trim();
      if (!name.includes('已安装') && !name.includes('Installed')) {
        models.push({ name: name, type: '' });
      }
    }
  }

  return models;
}

// 解析配置输出
function parseConfigOutput(output) {
  const config = {};
  const lines = output.split('\n');

  for (const line of lines) {
    const trimmed = line.trim();
    const cells = trimmed.split('|').filter(c => c.trim());

    if (cells.length >= 2) {
      const key = cells[0].trim();
      const value = cells.slice(1).join(' | ').trim();
      if (key && value && !key.includes('---')) {
        config[key] = value;
      }
    }
  }

  return config;
}

module.exports = {
  checkEnvironment,
  transcribe,
  batchTranscribe,
  listModels,
  getConfig,
  getHotwords,
  getProjectList,
  createProject,
  deleteProject,
  formatDraft,
};
