/**
 * 技能系统类型定义
 * 定义 AI 助手技能库的数据结构
 */

/** 技能元数据（从 Markdown frontmatter 解析） */
export interface SkillMeta {
  /** 技能唯一标识（使用 nameEn 或自动生成） */
  id: string;
  /** 技能显示名称 */
  name: string;
  /** 技能英文名称 */
  nameEn: string;
  /** 技能图标（emoji） */
  icon: string;
  /** 所属分类 */
  category: string;
  /** 子分类（可选） */
  subcategory?: string;
  /** 技能描述（一句话） */
  description: string;
  /** 触发关键词列表 */
  triggers: string[];
  /** 技能版本 */
  version: string;
  /** 是否为预置技能（不可删除，但可编辑） */
  isPreset?: boolean;
  /** 是否启用 */
  enabled?: boolean;
  /** 使用次数 */
  useCount?: number;
  /** 创建时间 */
  createdAt?: string;
  /** 最后修改时间 */
  updatedAt?: string;
}

/** 技能完整数据（含 Markdown 正文内容） */
export interface Skill extends SkillMeta {
  /** Markdown 正文内容（frontmatter 之后的全部内容） */
  content: string;
  /** 技能文件路径（相对于 skills/ 目录） */
  filePath: string;
}

/** 技能分类 */
export interface SkillCategory {
  /** 分类名称 */
  name: string;
  /** 分类图标（emoji） */
  icon: string;
  /** 分类描述 */
  description?: string;
  /** 分类下的技能数量 */
  skillCount?: number;
  /** 排序权重（越小越靠前） */
  order?: number;
  /** 是否为预置分类 */
  isPreset?: boolean;
}

/** 技能使用记录 */
export interface SkillUsageRecord {
  skillId: string;
  skillName: string;
  usedAt: string;
  triggeredBy: 'manual' | 'keyword' | 'ai_inference';
  context?: string;
}

/** 技能检测结果 */
export interface SkillDetectionResult {
  skill: SkillMeta;
  matchType: 'keyword' | 'semantic';
  confidence: number;
  matchedTrigger?: string;
}

/** 创建/更新技能的参数 */
export interface SkillCreateParams {
  name: string;
  nameEn?: string;
  icon?: string;
  category: string;
  subcategory?: string;
  description: string;
  triggers?: string[];
  content: string;
}

/** 更新技能的参数 */
export interface SkillUpdateParams {
  name?: string;
  nameEn?: string;
  icon?: string;
  category?: string;
  subcategory?: string;
  description?: string;
  triggers?: string[];
  content?: string;
  enabled?: boolean;
}

/** 创建/更新分类的参数 */
export interface CategoryCreateParams {
  name: string;
  icon?: string;
  description?: string;
  order?: number;
}

/** 技能服务 API 接口 */
export interface SkillServiceAPI {
  /** 加载所有技能 */
  loadAllSkills(): Promise<Skill[]>;
  /** 获取所有分类 */
  getCategories(): SkillCategory[];
  /** 按分类获取技能 */
  getSkillsByCategory(category: string): Promise<Skill[]>;
  /** 获取单个技能 */
  getSkill(skillId: string): Promise<Skill | null>;
  /** 搜索技能 */
  searchSkills(query: string): Promise<Skill[]>;
  /** 检测用户输入匹配的技能 */
  detectSkills(input: string): SkillDetectionResult[];
  /** 创建技能 */
  createSkill(params: SkillCreateParams): Promise<Skill>;
  /** 更新技能 */
  updateSkill(skillId: string, updates: SkillUpdateParams): Promise<Skill>;
  /** 删除技能 */
  deleteSkill(skillId: string): Promise<boolean>;
  /** 切换技能启用状态 */
  toggleSkill(skillId: string): Promise<boolean>;
  /** 增加使用次数 */
  incrementUseCount(skillId: string): Promise<void>;
  /** 创建分类 */
  createCategory(params: CategoryCreateParams): Promise<SkillCategory>;
  /** 更新分类 */
  updateCategory(oldName: string, updates: Partial<CategoryCreateParams>): Promise<SkillCategory>;
  /** 删除分类（需先移动该分类下的技能） */
  deleteCategory(name: string, moveToCategory?: string): Promise<boolean>;
  /** 获取技能的完整 Markdown 内容（用于注入 system prompt） */
  getSkillPrompt(skillId: string): Promise<string | null>;
}
