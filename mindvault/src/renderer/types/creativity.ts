// 创意相关类型
import type { Creativity, CreativityLink, MediaFile, SearchFilter, ListResult } from '@shared/types';

export type CreativityFormData = Omit<Creativity, 'id' | 'createdAt' | 'updatedAt' | 'lastReviewedAt' | 'tags'> & {
  tags?: string[];
};

export type CreativityCreateInput = {
  title: string;
  content: string;
  type: Creativity['type'];
  subtype?: string;
  contentFormat?: 'plain' | 'markdown';
  wordCount?: number;
  priority?: number;
  emojiReaction?: string | null;
  templateId?: string | null;
  boardId?: string | null;
  tags?: string[];
  cardStyle?: string | null;
};

export type CreativityUpdateInput = Partial<CreativityCreateInput> & {
  id: string;
};

export type CreativityListItem = Pick<
  Creativity,
  'id' | 'title' | 'content' | 'type' | 'priority' | 'emojiReaction' | 'status' | 'boardId' | 'createdAt' | 'updatedAt' | 'isRead' | 'cardStyle'
> & {
  tags?: Creativity['tags'];
  boardName?: string;
};

export type CreativityStats = {
  totalCount: number;
  todayCount: number;
  weekCount: number;
  typeDistribution: Record<string, number>;
  priorityDistribution: Record<number, number>;
  recentTags: { name: string; count: number }[];
  dailyData: { date: string; count: number; types: Record<string, number> }[];
};

export type CreativitySearchParams = SearchFilter & {
  page?: number;
  pageSize?: number;
  sortBy?: 'createdAt' | 'updatedAt' | 'priority' | 'title';
  sortOrder?: 'asc' | 'desc';
};

export type CreativitySearchResult = ListResult<CreativityListItem>;

export type MediaUploadInput = {
  creativityId: string;
  fileType: MediaFile['fileType'];
  filePath: string;
  thumbnailPath?: string | null;
  metadata?: string | null;
};

export type LinkCreateInput = {
  sourceId: string;
  targetId: string;
  relationType: CreativityLink['relationType'];
};
