// @ts-nocheck
/**
 * 技能服务
 * 管理 skills/ 目录下的技能 Markdown 文件
 * 支持技能的加载、搜索、创建、编辑、删除
 */

const fs = require('fs');
const path = require('path');
const { app } = require('electron');
const matter = require('gray-matter');

// ============================================================
// 路径配置
// ============================================================

/** skills 根目录 */
function getSkillsDir() {
  let skillsDir;
  if (app) {
    skillsDir = path.join(app.getAppPath(), 'skills');
  } else {
    skillsDir = path.join(__dirname, '../../skills');
  }
  console.log(`[SkillService] 技能目录: ${skillsDir}, 存在: ${fs.existsSync(skillsDir)}`);
  return skillsDir;
}

/** 技能状态存储文件（记录启用状态、使用次数等） */
function getSkillStateFile() {
  if (app) {
    return path.join(app.getPath('userData'), 'skill_state.json');
  }
  return path.join(__dirname, '../../skill_state.json');
}

// ============================================================
// 状态管理
// ============================================================

/** 技能运行时状态（启用/禁用、使用次数等） */
let skillState = {
  /** 技能启用状态 { skillId: boolean } */
  enabled: {} as Record<string, boolean>,
  /** 技能使用次数 { skillId: number } */
  useCount: {} as Record<string, number>,
  /** 自定义分类 { categoryName: { icon, description, order, isPreset } } */
  customCategories: {} as Record<string, { icon?: string; description?: string; order?: number; isPreset?: boolean }>,
};

/** 加载技能状态 */
function loadSkillState() {
  try {
    const stateFile = getSkillStateFile();
    if (fs.existsSync(stateFile)) {
      const data = fs.readFileSync(stateFile, 'utf-8');
      const parsed = JSON.parse(data);
      skillState = { ...skillState, ...parsed };
    }
  } catch (err) {
    console.error('[SkillService] 加载状态文件失败:', err.message);
  }
}

/** 保存技能状态 */
function saveSkillState() {
  try {
    const stateFile = getSkillStateFile();
    const dir = path.dirname(stateFile);
    if (!fs.existsSync(dir)) {
      fs.mkdirSync(dir, { recursive: true });
    }
    fs.writeFileSync(stateFile, JSON.stringify(skillState, null, 2), 'utf-8');
  } catch (err) {
    console.error('[SkillService] 保存状态文件失败:', err.message);
  }
}

// ============================================================
// 预置分类配置
// ============================================================

const PRESET_CATEGORIES = [
  { name: '文档处理', icon: '📄', description: 'PDF、Word、Excel、PPT 等文档操作', order: 1 },
  { name: '前端开发', icon: '💻', description: '前端界面设计、组件开发、性能优化', order: 2 },
  { name: '后端开发', icon: '🔧', description: '后端服务、API、数据库', order: 3 },
  { name: 'DevOps', icon: '🚀', description: '部署、运维、CI/CD、版本控制', order: 4 },
  { name: '安全', icon: '🔒', description: '安全审计、漏洞检测、安全方案', order: 5 },
  { name: '设计', icon: '🎨', description: 'UI 设计、视觉创作、品牌规范', order: 6 },
  { name: '产品管理', icon: '📋', description: '需求分析、产品规划、项目管理', order: 7 },
  { name: '测试', icon: '🧪', description: '软件测试、质量保证、自动化测试', order: 8 },
  { name: '写作', icon: '✍️', description: '技术文档、创意写作、内容创作', order: 9 },
  { name: '架构', icon: '🏛️', description: '系统架构设计、技术选型', order: 10 },
  { name: '性能优化', icon: '⚡', description: '性能分析、瓶颈定位、优化方案', order: 11 },
  { name: '代码质量', icon: '👁️', description: '代码审查、质量检查、最佳实践', order: 12 },
  { name: 'AI与自动化', icon: '🤖', description: 'AI 图像/视频生成、浏览器自动化', order: 13 },
  { name: '知识管理', icon: '📖', description: 'Notion、飞书等知识工具集成', order: 14 },
  { name: '视频分析', icon: '🎬', description: '视频内容分析、钩子分析、报告生成', order: 15 },
];

// ============================================================
// Markdown 解析
// ============================================================

/**
 * 解析技能 Markdown 文件
 * 提取 YAML frontmatter 和正文内容
 */
function parseSkillFile(filePath: string, relativePath: string) {
  try {
    const content = fs.readFileSync(filePath, 'utf-8');
    const { data, content: body } = matter(content);

    // 生成技能 ID
    const id = data.nameEn || path.basename(filePath, '.md');

    return {
      id,
      name: data.name || path.basename(filePath, '.md'),
      nameEn: data.nameEn || id,
      icon: data.icon || '🔧',
      category: data.category || '未分类',
      subcategory: data.subcategory,
      description: data.description || '',
      triggers: data.triggers || [],
      version: data.version || '1.0.0',
      isPreset: true, // 从文件加载的都是预置技能
      enabled: skillState.enabled[id] !== false, // 默认启用
      useCount: skillState.useCount[id] || 0,
      content: body.trim(),
      filePath: relativePath,
      createdAt: data.createdAt,
      updatedAt: data.updatedAt || new Date().toISOString(),
    };
  } catch (err) {
    console.error(`[SkillService] 解析技能文件失败 ${filePath}:`, err.message);
    return null;
  }
}

/**
 * 将技能数据序列化为 Markdown 文件内容
 */
function serializeSkillFile(skill: any) {
  const frontmatter = {
    name: skill.name,
    nameEn: skill.nameEn || skill.id,
    icon: skill.icon || '🔧',
    category: skill.category,
    ...(skill.subcategory && { subcategory: skill.subcategory }),
    description: skill.description,
    triggers: skill.triggers || [],
    version: skill.version || '1.0.0',
    createdAt: skill.createdAt || new Date().toISOString(),
    updatedAt: new Date().toISOString(),
  };

  const yamlStr = Object.entries(frontmatter)
    .map(([key, value]) => {
      if (Array.isArray(value)) {
        return `${key}: ${JSON.stringify(value)}`;
      }
      if (typeof value === 'string' && (value.includes(':') || value.includes('#') || value.includes('\n'))) {
        return `${key}: "${value.replace(/"/g, '\\"')}"`;
      }
      return `${key}: ${value}`;
    })
    .join('\n');

  return `---\n${yamlStr}\n---\n\n${skill.content || ''}`;
}

// ============================================================
// 文件系统操作
// ============================================================

/**
 * 递归扫描 skills/ 目录，加载所有技能文件
 */
function scanSkillFiles(dir: string, baseDir: string = dir): any[] {
  const skills: any[] = [];

  if (!fs.existsSync(dir)) {
    console.warn(`[SkillService] 技能目录不存在: ${dir}`);
    return skills;
  }

  const entries = fs.readdirSync(dir, { withFileTypes: true });

  for (const entry of entries) {
    const fullPath = path.join(dir, entry.name);
    const relativePath = path.relative(baseDir, fullPath);

    if (entry.isDirectory()) {
      // 跳过隐藏目录
      if (entry.name.startsWith('.')) continue;
      // 递归扫描子目录
      skills.push(...scanSkillFiles(fullPath, baseDir));
    } else if (entry.name.endsWith('.md')) {
      const skill = parseSkillFile(fullPath, relativePath);
      if (skill) {
        skills.push(skill);
      }
    }
  }

  return skills;
}

// ============================================================
// 核心服务方法
// ============================================================

/** 缓存所有已加载的技能 */
let cachedSkills: any[] | null = null;

/**
 * 加载所有技能
 */
function loadAllSkills() {
  const skillsDir = getSkillsDir();
  cachedSkills = scanSkillFiles(skillsDir);
  console.log(`[SkillService] 已加载 ${cachedSkills.length} 个技能`);
  return cachedSkills;
}

/**
 * 获取所有技能（带缓存）
 */
function getAllSkills() {
  if (!cachedSkills) {
    loadAllSkills();
  }
  return cachedSkills || [];
}

/**
 * 获取所有分类（预置 + 自定义）
 */
function getCategories() {
  const categories = [...PRESET_CATEGORIES];

  // 添加自定义分类
  for (const [name, config] of Object.entries(skillState.customCategories)) {
    if (!categories.find(c => c.name === name)) {
      categories.push({
        name,
        icon: config.icon || '📁',
        description: config.description,
        order: config.order || 999,
        isPreset: false,
      });
    }
  }

  // 按排序权重排序
  categories.sort((a, b) => (a.order || 999) - (b.order || 999));

  // 统计每个分类下的技能数量
  const skills = getAllSkills();
  for (const cat of categories) {
    cat.skillCount = skills.filter(s => s.category === cat.name).length;
  }

  return categories;
}

/**
 * 按分类获取技能
 */
function getSkillsByCategory(category: string) {
  return getAllSkills().filter(s => s.category === category);
}

/**
 * 获取单个技能
 */
function getSkill(skillId: string) {
  return getAllSkills().find(s => s.id === skillId) || null;
}

/**
 * 搜索技能（按名称、描述、触发关键词匹配）
 */
function searchSkills(query: string) {
  const skills = getAllSkills();
  const lowerQuery = query.toLowerCase();

  return skills.filter(s => {
    return (
      s.name.toLowerCase().includes(lowerQuery) ||
      s.nameEn.toLowerCase().includes(lowerQuery) ||
      s.description.toLowerCase().includes(lowerQuery) ||
      s.category.toLowerCase().includes(lowerQuery) ||
      s.triggers.some((t: string) => t.toLowerCase().includes(lowerQuery))
    );
  });
}

/**
 * 检测用户输入匹配的技能
 * 匹配策略：触发关键词精确匹配 + 技能名称匹配
 */
function detectSkills(input: string) {
  const skills = getAllSkills().filter(s => s.enabled);
  const lowerInput = input.toLowerCase();
  const results: any[] = [];

  for (const skill of skills) {
    let bestConfidence = 0;
    let bestType = '';
    let bestTrigger = '';

    // === 第1层：触发关键词匹配（权重最高） ===
    for (const trigger of skill.triggers) {
      const lowerTrigger = trigger.toLowerCase();
      if (lowerInput.includes(lowerTrigger)) {
        const confidence = Math.min(0.95, 0.5 + lowerTrigger.length / 15);
        if (confidence > bestConfidence) {
          bestConfidence = confidence;
          bestType = 'keyword';
          bestTrigger = trigger;
        }
      }
    }

    // === 第2层：技能名称匹配 ===
    const lowerName = skill.name.toLowerCase();
    const lowerNameEn = (skill.nameEn || '').toLowerCase();
    if (lowerName.length >= 2 && (lowerInput.includes(lowerName) || lowerName.includes(lowerInput))) {
      const confidence = 0.7;
      if (confidence > bestConfidence) {
        bestConfidence = confidence;
        bestType = 'name';
        bestTrigger = skill.name;
      }
    }
    if (lowerNameEn.length >= 2 && lowerInput.includes(lowerNameEn)) {
      const confidence = 0.75;
      if (confidence > bestConfidence) {
        bestConfidence = confidence;
        bestType = 'name';
        bestTrigger = skill.nameEn;
      }
    }

    if (bestConfidence >= 0.3) {
      results.push({
        skill: {
          id: skill.id,
          name: skill.name,
          nameEn: skill.nameEn,
          icon: skill.icon,
          category: skill.category,
          description: skill.description,
          triggers: skill.triggers,
        },
        matchType: bestType,
        confidence: bestConfidence,
        matchedTrigger: bestTrigger,
      });
    }
  }

  results.sort((a, b) => b.confidence - a.confidence);
  return results.slice(0, 3);
}

/**
 * 获取技能的完整 prompt 内容（用于注入 system prompt）
 * 包含技能描述和使用指南
 */
function getSkillPrompt(skillId: string) {
  const skill = getSkill(skillId);
  if (!skill) return null;

  return `## 技能：${skill.name} ${skill.icon}\n\n${skill.description}\n\n${skill.content}`;
}

/**
 * 创建新技能
 */
function createSkill(params: any) {
  const skillsDir = getSkillsDir();
  const categoryDir = path.join(skillsDir, params.category);

  // 确保分类目录存在
  if (!fs.existsSync(categoryDir)) {
    fs.mkdirSync(categoryDir, { recursive: true });
  }

  const id = params.nameEn || `skill_${Date.now()}`;
  const fileName = `${id}技能.md`;
  const filePath = path.join(categoryDir, fileName);
  const relativePath = path.relative(skillsDir, filePath);

  const skill = {
    id,
    name: params.name,
    nameEn: params.nameEn || id,
    icon: params.icon || '🔧',
    category: params.category,
    subcategory: params.subcategory,
    description: params.description,
    triggers: params.triggers || [],
    version: '1.0.0',
    isPreset: false,
    enabled: true,
    useCount: 0,
    content: params.content || '',
    filePath: relativePath,
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
  };

  // 写入文件
  const fileContent = serializeSkillFile(skill);
  fs.writeFileSync(filePath, fileContent, 'utf-8');

  // 更新缓存
  cachedSkills = null;

  console.log(`[SkillService] 创建技能: ${skill.name} -> ${filePath}`);
  return skill;
}

/**
 * 更新技能
 */
function updateSkill(skillId: string, updates: any) {
  const skill = getSkill(skillId);
  if (!skill) throw new Error(`技能不存在: ${skillId}`);

  const skillsDir = getSkillsDir();
  const oldFilePath = path.join(skillsDir, skill.filePath);

  // 合并更新
  const updatedSkill = { ...skill, ...updates, updatedAt: new Date().toISOString() };

  // 如果分类变了，需要移动文件
  if (updates.category && updates.category !== skill.category) {
    const newCategoryDir = path.join(skillsDir, updates.category);
    if (!fs.existsSync(newCategoryDir)) {
      fs.mkdirSync(newCategoryDir, { recursive: true });
    }
    const newFileName = `${updatedSkill.id}技能.md`;
    const newFilePath = path.join(newCategoryDir, newFileName);

    // 删除旧文件
    if (fs.existsSync(oldFilePath)) {
      fs.unlinkSync(oldFilePath);
    }

    // 写入新文件
    updatedSkill.filePath = path.relative(skillsDir, newFilePath);
    fs.writeFileSync(newFilePath, serializeSkillFile(updatedSkill), 'utf-8');
  } else {
    // 原地更新
    if (fs.existsSync(oldFilePath)) {
      fs.writeFileSync(oldFilePath, serializeSkillFile(updatedSkill), 'utf-8');
    }
  }

  // 更新启用状态
  if (updates.enabled !== undefined) {
    skillState.enabled[skillId] = updates.enabled;
    saveSkillState();
  }

  // 清除缓存
  cachedSkills = null;

  console.log(`[SkillService] 更新技能: ${updatedSkill.name}`);
  return updatedSkill;
}

/**
 * 删除技能
 */
function deleteSkill(skillId: string) {
  const skill = getSkill(skillId);
  if (!skill) throw new Error(`技能不存在: ${skillId}`);

  const skillsDir = getSkillsDir();
  const filePath = path.join(skillsDir, skill.filePath);

  if (fs.existsSync(filePath)) {
    fs.unlinkSync(filePath);
  }

  // 清理状态
  delete skillState.enabled[skillId];
  delete skillState.useCount[skillId];
  saveSkillState();

  // 清除缓存
  cachedSkills = null;

  console.log(`[SkillService] 删除技能: ${skill.name}`);
  return true;
}

/**
 * 切换技能启用状态
 */
function toggleSkill(skillId: string) {
  const skill = getSkill(skillId);
  if (!skill) throw new Error(`技能不存在: ${skillId}`);

  const newState = !skill.enabled;
  skillState.enabled[skillId] = newState;
  saveSkillState();

  // 清除缓存以反映新状态
  cachedSkills = null;

  console.log(`[SkillService] 技能 ${skill.name} 已${newState ? '启用' : '禁用'}`);
  return newState;
}

/**
 * 增加技能使用次数
 */
function incrementUseCount(skillId: string) {
  skillState.useCount[skillId] = (skillState.useCount[skillId] || 0) + 1;
  saveSkillState();

  // 更新缓存中的使用次数
  if (cachedSkills) {
    const skill = cachedSkills.find(s => s.id === skillId);
    if (skill) {
      skill.useCount = skillState.useCount[skillId];
    }
  }
}

// ============================================================
// 分类管理
// ============================================================

/**
 * 创建自定义分类
 */
function createCategory(params: any) {
  const categories = getCategories();
  if (categories.find(c => c.name === params.name)) {
    throw new Error(`分类已存在: ${params.name}`);
  }

  skillState.customCategories[params.name] = {
    icon: params.icon || '📁',
    description: params.description,
    order: params.order || 999,
    isPreset: false,
  };
  saveSkillState();

  // 创建对应的目录
  const skillsDir = getSkillsDir();
  const categoryDir = path.join(skillsDir, params.name);
  if (!fs.existsSync(categoryDir)) {
    fs.mkdirSync(categoryDir, { recursive: true });
  }

  console.log(`[SkillService] 创建分类: ${params.name}`);
  return {
    name: params.name,
    icon: params.icon || '📁',
    description: params.description,
    order: params.order || 999,
    isPreset: false,
    skillCount: 0,
  };
}

/**
 * 更新分类
 */
function updateCategory(oldName: string, updates: any) {
  const categories = getCategories();
  const category = categories.find(c => c.name === oldName);
  if (!category) throw new Error(`分类不存在: ${oldName}`);

  const newName = updates.name || oldName;

  // 如果是预置分类，存入自定义状态
  if (category.isPreset) {
    skillState.customCategories[oldName] = {
      ...(skillState.customCategories[oldName] || {}),
      icon: updates.icon || category.icon,
      description: updates.description || category.description,
      order: updates.order || category.order,
      isPreset: true,
    };
  } else {
    // 自定义分类：如果改名，需要重命名目录和状态
    if (updates.name && updates.name !== oldName) {
      delete skillState.customCategories[oldName];
      skillState.customCategories[newName] = {
        icon: updates.icon || category.icon,
        description: updates.description || category.description,
        order: updates.order || category.order,
        isPreset: false,
      };

      // 重命名目录
      const skillsDir = getSkillsDir();
      const oldDir = path.join(skillsDir, oldName);
      const newDir = path.join(skillsDir, newName);
      if (fs.existsSync(oldDir)) {
        fs.renameSync(oldDir, newDir);
      }

      // 更新该分类下所有技能的 category 字段
      const skills = getAllSkills();
      for (const skill of skills) {
        if (skill.category === oldName) {
          updateSkill(skill.id, { category: newName });
        }
      }
    } else {
      skillState.customCategories[oldName] = {
        ...(skillState.customCategories[oldName] || {}),
        ...(updates.icon && { icon: updates.icon }),
        ...(updates.description && { description: updates.description }),
        ...(updates.order !== undefined && { order: updates.order }),
      };
    }
  }

  saveSkillState();
  console.log(`[SkillService] 更新分类: ${oldName} -> ${newName}`);
  return getCategories().find(c => c.name === newName);
}

/**
 * 删除分类
 * 预置分类不可删除，只能删除自定义分类
 * 删除前需将该分类下的技能移动到其他分类
 */
function deleteCategory(name: string, moveToCategory?: string) {
  const categories = getCategories();
  const category = categories.find(c => c.name === name);
  if (!category) throw new Error(`分类不存在: ${name}`);
  if (category.isPreset) throw new Error(`预置分类不可删除: ${name}`);

  // 检查分类下是否还有技能
  const skillsInCategory = getAllSkills().filter(s => s.category === name);
  if (skillsInCategory.length > 0 && !moveToCategory) {
    throw new Error(`分类 "${name}" 下还有 ${skillsInCategory.length} 个技能，请指定目标分类`);
  }

  // 移动技能到目标分类
  if (moveToCategory) {
    for (const skill of skillsInCategory) {
      updateSkill(skill.id, { category: moveToCategory });
    }
  }

  // 删除自定义分类状态
  delete skillState.customCategories[name];
  saveSkillState();

  // 删除目录（如果为空）
  const skillsDir = getSkillsDir();
  const categoryDir = path.join(skillsDir, name);
  if (fs.existsSync(categoryDir)) {
    try {
      const remaining = fs.readdirSync(categoryDir);
      if (remaining.length === 0) {
        fs.rmdirSync(categoryDir);
      }
    } catch (err) {
      console.warn(`[SkillService] 删除分类目录失败:`, err.message);
    }
  }

  console.log(`[SkillService] 删除分类: ${name}`);
  return true;
}

// ============================================================
// 初始化
// ============================================================

/**
 * 初始化技能服务
 */
function init() {
  loadSkillState();
  loadAllSkills();
  console.log('[SkillService] 技能服务初始化完成');
}

module.exports = {
  init,
  loadAllSkills,
  getAllSkills,
  getCategories,
  getSkillsByCategory,
  getSkill,
  searchSkills,
  detectSkills,
  getSkillPrompt,
  createSkill,
  updateSkill,
  deleteSkill,
  toggleSkill,
  incrementUseCount,
  createCategory,
  updateCategory,
  deleteCategory,
};
