import type { Creativity } from '@shared/types';

export interface FilterState {
  types: string[];
  minPriority: number;
  tags: string[];
  emojiReactions: string[];
  hasAttachments?: boolean;
}

export interface SortState {
  field: string;
  order: 'asc' | 'desc';
}

export interface PaginationState {
  page: number;
  pageSize: number;
  total: number;
}

export interface ContextMenuState {
  x: number;
  y: number;
  item: Creativity;
}

export type ViewMode = 'table' | 'masonry';
