/**
 * AI关联推荐服务
 * 基于标签和关键词的简单相似度算法，为创意推荐相关联的其他创意
 */

import { tokenize } from '../utils';

/** 推荐结果 */
export interface Recommendation {
  creativity_id: string;
  title: string;
  score: number;       // 相似度分数 (0-1)
  matched_tags: string[];  // 匹配的标签
  matched_keywords: string[];  // 匹配的关键词
}

/** 推荐选项 */
export interface RecommendOptions {
  limit?: number;        // 返回结果数量限制
  min_score?: number;    // 最低相似度阈值
  exclude_ids?: string[]; // 要排除的创意ID列表
}

// 创意仓库接口
interface CreativityRepository {
  findById(id: string): any;
  getAllTagsAndKeywords(): any[];
}

export class AIRecommendService {
  constructor(private creativityRepo: CreativityRepository) {}

  /**
   * 获取与指定创意相关的推荐列表
   * @param creativityId - 目标创意ID
   * @param options - 推荐选项
   * @returns 推荐结果列表，按相似度降序排列
   */
  getRecommendations(creativityId: string, options: RecommendOptions = {}): Recommendation[] {
    const limit = options.limit || 10;
    const minScore = options.min_score || 0.1;
    const excludeIds = new Set(options.exclude_ids || [creativityId]);

    // 获取目标创意
    const target = this.creativityRepo.findById(creativityId);
    if (!target) return [];

    // 获取所有活跃创意的标签和关键词
    const allCreativities = this.creativityRepo.getAllTagsAndKeywords();

    // 计算目标创意的关键词集合
    const targetKeywords = tokenize(`${target.title} ${target.content}`);
    const targetTags = new Set((target.tags || []).map((t: any) => t.name.toLowerCase()));

    // 计算每个创意与目标创意的相似度
    const recommendations: Recommendation[] = [];

    for (const rawItem of allCreativities) {
      const item = rawItem as Record<string, any>;
      // 排除自身和指定排除的ID
      if (excludeIds.has(item.id as string)) continue;

      // 标签匹配
      const itemTags = new Set(((item.tags as string) || '').toLowerCase().split(',').filter(Boolean));
      const matchedTags: string[] = [];
      targetTags.forEach((t: string) => {
        if (itemTags.has(t)) matchedTags.push(t);
      });

      // 关键词匹配
      const itemKeywords = tokenize(`${(item.title as string) || ''} ${(item.content as string) || ''}`);
      const matchedKeywords: string[] = [];
      targetKeywords.forEach((k) => {
        if (itemKeywords.has(k)) matchedKeywords.push(k);
      });

      // 计算综合相似度分数
      const tagScore = targetTags.size > 0 ? matchedTags.length / targetTags.size : 0;
      const keywordScore = targetKeywords.size > 0
        ? matchedKeywords.length / Math.min(targetKeywords.size, itemKeywords.size)
        : 0;

      // 加权计算综合分数（标签权重0.4，关键词权重0.6）
      const score = tagScore * 0.4 + keywordScore * 0.6;

      if (score >= minScore && (matchedTags.length > 0 || matchedKeywords.length > 0)) {
        recommendations.push({
          creativity_id: item.id as string,
          title: item.title as string,
          score: Math.round(score * 100) / 100,
          matched_tags: matchedTags,
          matched_keywords: matchedKeywords.slice(0, 10), // 限制显示的关键词数量
        });
      }
    }

    // 按相似度降序排列，取前N个
    recommendations.sort((a, b) => b.score - a.score);
    return recommendations.slice(0, limit);
  }

  /**
   * 批量获取多个创意的推荐
   * @param creativityIds - 创意ID列表
   * @param options - 推荐选项
   * @returns 以创意ID为键的推荐结果映射
   */
  getBatchRecommendations(
    creativityIds: string[],
    options: RecommendOptions = {}
  ): Record<string, Recommendation[]> {
    const results: Record<string, Recommendation[]> = {};

    for (const id of creativityIds) {
      results[id] = this.getRecommendations(id, {
        ...options,
        exclude_ids: [...(options.exclude_ids || []), ...creativityIds],
      });
    }

    return results;
  }

  /**
   * 获取热门标签推荐
   * 基于当前创意的标签，推荐可能相关的其他标签
   * @param creativityId - 目标创意ID
   * @param limit - 返回数量
   */
  getTagSuggestions(creativityId: string, limit: number = 5): string[] {
    const creativity = this.creativityRepo.findById(creativityId);
    if (!creativity) return [];

    const currentTags = new Set((creativity.tags || []).map((t: any) => t.name.toLowerCase()));

    // 获取所有创意的标签共现关系
    const allCreativities = this.creativityRepo.getAllTagsAndKeywords();
    const tagCoOccurrence: Record<string, number> = {};

    for (const item of allCreativities) {
      if (item.id === creativityId) continue;

      const itemTags = item.tags.toLowerCase().split(',').filter(Boolean);
      const hasOverlap = itemTags.some((t: string) => currentTags.has(t));

      if (hasOverlap) {
        for (const tag of itemTags) {
          if (!currentTags.has(tag)) {
            tagCoOccurrence[tag] = (tagCoOccurrence[tag] || 0) + 1;
          }
        }
      }
    }

    // 按共现频率排序
    return Object.entries(tagCoOccurrence)
      .sort(([, a], [, b]) => b - a)
      .slice(0, limit)
      .map(([tag]) => tag);
  }
}
