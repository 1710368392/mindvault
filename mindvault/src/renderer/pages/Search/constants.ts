import React from 'react';
import {
  FileText,
  Image as ImageIcon,
  Mic,
  Link as LinkIcon,
  Video,
} from 'lucide-react';

export const SORT_OPTIONS = [
  { value: 'updatedAt', label: '最近更新' },
  { value: 'createdAt', label: '创建时间' },
  { value: 'title', label: '标题' },
] as const;

export const VIEW_MODES = [
  { value: 'table', label: '列表' },
  { value: 'masonry', label: '瀑布流' },
] as const;

export const SEARCH_TYPE_ICONS: Record<string, React.FC<{ size?: number }>> = {
  text: FileText,
  image: ImageIcon,
  audio: Mic,
  link: LinkIcon,
  video: Video,
  document: FileText,
};

export const CREATIVITY_TYPES = ['text', 'image', 'audio', 'link', 'video', 'document'] as const;

export const PRIORITY_LEVELS = [0, 1, 2, 3, 4, 5] as const;

export const HIDDEN_TAGS = ['Post', '待办动态确定', '5关键词'];
