/**
 * AI关联推荐服务
 * 基于标签和关键词的简单相似度算法，为创意推荐相关联的其他创意
 */
var __assign = (this && this.__assign) || function () {
    __assign = Object.assign || function(t) {
        for (var s, i = 1, n = arguments.length; i < n; i++) {
            s = arguments[i];
            for (var p in s) if (Object.prototype.hasOwnProperty.call(s, p))
                t[p] = s[p];
        }
        return t;
    };
    return __assign.apply(this, arguments);
};
var __spreadArray = (this && this.__spreadArray) || function (to, from, pack) {
    if (pack || arguments.length === 2) for (var i = 0, l = from.length, ar; i < l; i++) {
        if (ar || !(i in from)) {
            if (!ar) ar = Array.prototype.slice.call(from, 0, i);
            ar[i] = from[i];
        }
    }
    return to.concat(ar || Array.prototype.slice.call(from));
};
import { tokenize } from '../utils';
var AIRecommendService = /** @class */ (function () {
    function AIRecommendService(creativityRepo) {
        this.creativityRepo = creativityRepo;
    }
    /**
     * 获取与指定创意相关的推荐列表
     * @param creativityId - 目标创意ID
     * @param options - 推荐选项
     * @returns 推荐结果列表，按相似度降序排列
     */
    AIRecommendService.prototype.getRecommendations = function (creativityId, options) {
        if (options === void 0) { options = {}; }
        var limit = options.limit || 10;
        var minScore = options.min_score || 0.1;
        var excludeIds = new Set(options.exclude_ids || [creativityId]);
        // 获取目标创意
        var target = this.creativityRepo.findById(creativityId);
        if (!target)
            return [];
        // 获取所有活跃创意的标签和关键词
        var allCreativities = this.creativityRepo.getAllTagsAndKeywords();
        // 计算目标创意的关键词集合
        var targetKeywords = tokenize("".concat(target.title, " ").concat(target.content));
        var targetTags = new Set((target.tags || []).map(function (t) { return t.name.toLowerCase(); }));
        // 计算每个创意与目标创意的相似度
        var recommendations = [];
        var _loop_1 = function (rawItem) {
            var item = rawItem;
            // 排除自身和指定排除的ID
            if (excludeIds.has(item.id))
                return "continue";
            // 标签匹配
            var itemTags = new Set((item.tags || '').toLowerCase().split(',').filter(Boolean));
            var matchedTags = [];
            targetTags.forEach(function (t) {
                if (itemTags.has(t))
                    matchedTags.push(t);
            });
            // 关键词匹配
            var itemKeywords = tokenize("".concat(item.title || '', " ").concat(item.content || ''));
            var matchedKeywords = [];
            targetKeywords.forEach(function (k) {
                if (itemKeywords.has(k))
                    matchedKeywords.push(k);
            });
            // 计算综合相似度分数
            var tagScore = targetTags.size > 0 ? matchedTags.length / targetTags.size : 0;
            var keywordScore = targetKeywords.size > 0
                ? matchedKeywords.length / Math.min(targetKeywords.size, itemKeywords.size)
                : 0;
            // 加权计算综合分数（标签权重0.4，关键词权重0.6）
            var score = tagScore * 0.4 + keywordScore * 0.6;
            if (score >= minScore && (matchedTags.length > 0 || matchedKeywords.length > 0)) {
                recommendations.push({
                    creativity_id: item.id,
                    title: item.title,
                    score: Math.round(score * 100) / 100,
                    matched_tags: matchedTags,
                    matched_keywords: matchedKeywords.slice(0, 10), // 限制显示的关键词数量
                });
            }
        };
        for (var _i = 0, allCreativities_1 = allCreativities; _i < allCreativities_1.length; _i++) {
            var rawItem = allCreativities_1[_i];
            _loop_1(rawItem);
        }
        // 按相似度降序排列，取前N个
        recommendations.sort(function (a, b) { return b.score - a.score; });
        return recommendations.slice(0, limit);
    };
    /**
     * 批量获取多个创意的推荐
     * @param creativityIds - 创意ID列表
     * @param options - 推荐选项
     * @returns 以创意ID为键的推荐结果映射
     */
    AIRecommendService.prototype.getBatchRecommendations = function (creativityIds, options) {
        if (options === void 0) { options = {}; }
        var results = {};
        for (var _i = 0, creativityIds_1 = creativityIds; _i < creativityIds_1.length; _i++) {
            var id = creativityIds_1[_i];
            results[id] = this.getRecommendations(id, __assign(__assign({}, options), { exclude_ids: __spreadArray(__spreadArray([], (options.exclude_ids || []), true), creativityIds, true) }));
        }
        return results;
    };
    /**
     * 获取热门标签推荐
     * 基于当前创意的标签，推荐可能相关的其他标签
     * @param creativityId - 目标创意ID
     * @param limit - 返回数量
     */
    AIRecommendService.prototype.getTagSuggestions = function (creativityId, limit) {
        if (limit === void 0) { limit = 5; }
        var creativity = this.creativityRepo.findById(creativityId);
        if (!creativity)
            return [];
        var currentTags = new Set((creativity.tags || []).map(function (t) { return t.name.toLowerCase(); }));
        // 获取所有创意的标签共现关系
        var allCreativities = this.creativityRepo.getAllTagsAndKeywords();
        var tagCoOccurrence = {};
        for (var _i = 0, allCreativities_2 = allCreativities; _i < allCreativities_2.length; _i++) {
            var item = allCreativities_2[_i];
            if (item.id === creativityId)
                continue;
            var itemTags = item.tags.toLowerCase().split(',').filter(Boolean);
            var hasOverlap = itemTags.some(function (t) { return currentTags.has(t); });
            if (hasOverlap) {
                for (var _a = 0, itemTags_1 = itemTags; _a < itemTags_1.length; _a++) {
                    var tag = itemTags_1[_a];
                    if (!currentTags.has(tag)) {
                        tagCoOccurrence[tag] = (tagCoOccurrence[tag] || 0) + 1;
                    }
                }
            }
        }
        // 按共现频率排序
        return Object.entries(tagCoOccurrence)
            .sort(function (_a, _b) {
            var a = _a[1];
            var b = _b[1];
            return b - a;
        })
            .slice(0, limit)
            .map(function (_a) {
            var tag = _a[0];
            return tag;
        });
    };
    return AIRecommendService;
}());
export { AIRecommendService };
