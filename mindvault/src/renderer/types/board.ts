// 看板相关类型
import type { Board } from '@shared/types';

export type BoardFormData = Omit<Board, 'id' | 'createdAt' | 'updatedAt'>;

export type BoardCreateInput = {
  name: string;
  description?: string | null;
  background?: string | null;
  theme?: string | null;
  layout?: Board['layout'];
};

export type BoardUpdateInput = Partial<BoardCreateInput> & {
  id: string;
  sortOrder?: number;
};

export type BoardListItem = Pick<
  Board,
  'id' | 'name' | 'description' | 'layout' | 'sortOrder' | 'createdAt' | 'updatedAt'
> & {
  creativityCount?: number;
};

export type BoardViewMode = 'board' | 'canvas' | 'graph' | 'folder';
