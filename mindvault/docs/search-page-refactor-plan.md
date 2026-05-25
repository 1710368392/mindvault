# 仓库页面（Search）重构执行文档

## 项目信息

| 项目 | 内容 |
|------|------|
| 目标页面 | 仓库页面 (Search.tsx) |
| 当前代码行数 | ~1500 行 |
| 预计工时 | 11-16 小时 |
| 执行人员 | 前端工程师 |
| 审核人员 | 代码审查专家 |
| 项目经理 | 项目经理 |

---

## 一、项目目标

将单文件 1500+ 行的 Search.tsx 重构为模块化、可维护、高性能的组件架构，同时保持功能完整性和向后兼容。

### 关键指标

- [ ] 单文件代码行数 < 300 行
- [ ] 组件可复用性提升
- [ ] 渲染性能优化（大数据量场景）
- [ ] 状态管理集中化

---

## 二、目录结构规划

```
src/renderer/pages/Search/
├── index.tsx                    # 主页面入口（~200行）
├── components/
│   ├── SearchBar.tsx            # 搜索栏组件
│   ├── FilterPanel.tsx          # 筛选面板
│   ├── SortDropdown.tsx         # 排序下拉
│   ├── ViewToggle.tsx           # 视图切换（表格/瀑布流）
│   ├── BatchToolbar.tsx         # 批量操作工具栏
│   ├── ResultList.tsx           # 结果列表容器
│   ├── MasonryCard.tsx          # 瀑布流卡片
│   ├── TableView.tsx            # 表格视图
│   └── EmptyState.tsx           # 空状态
├── hooks/
│   ├── useSearch.ts             # 搜索逻辑
│   ├── useFilter.ts             # 筛选逻辑
│   └── useBatchSelect.ts        # 批量选择逻辑
├── stores/
│   └── searchStore.ts           # 搜索状态管理
├── types.ts                     # 类型定义
├── constants.ts                 # 常量定义
└── utils.ts                     # 工具函数
```

---

## 三、阶段执行计划

### 阶段一：组件拆分（4-6小时）

#### 3.1.1 创建目录结构

**执行步骤：**

1. 创建目录
```bash
mkdir -p src/renderer/pages/Search/components
mkdir -p src/renderer/pages/Search/hooks
mkdir -p src/renderer/pages/Search/stores
touch src/renderer/pages/Search/types.ts
```

2. 迁移类型定义到 `types.ts`

```typescript
// types.ts
export interface FilterState {
  types: string[];
  minPriority: number;
  tags: string[];
  emojiReactions: string[];
  startDate?: string;
  endDate?: string;
}

export interface SortState {
  field: string;
  order: 'asc' | 'desc';
}

export interface SearchState {
  keyword: string;
  results: Creativity[];
  loading: boolean;
  pagination: {
    page: number;
    pageSize: number;
    total: number;
  };
}
```

3. 迁移常量到 `constants.ts`

```typescript
// constants.ts
export const SORT_OPTIONS = [
  { label: '更新时间', value: 'updatedAt' },
  { label: '创建时间', value: 'createdAt' },
  { label: '标题', value: 'title' },
  { label: '优先级', value: 'priority' },
] as const;

export const VIEW_MODES = ['table', 'masonry'] as const;

export const SEARCH_TYPE_ICONS: Record<string, React.FC<{ size?: number }>> = {
  text: FileText,
  image: ImageIcon,
  audio: Mic,
  link: LinkIcon,
  video: Video,
  doc: FileText,
};
```

#### 3.1.2 提取 SearchBar 组件

**文件**: `components/SearchBar.tsx`

```typescript
import React from 'react';
import { Input, Button } from 'antd';
import { Search as SearchIcon, X } from 'lucide-react';

interface SearchBarProps {
  keyword: string;
  onChange: (value: string) => void;
  onSearch: () => void;
  placeholder?: string;
}

export const SearchBar: React.FC<SearchBarProps> = ({
  keyword,
  onChange,
  onSearch,
  placeholder = '搜索创意、标签、内容...',
}) => {
  return (
    <div style={{ flex: 1, position: 'relative' }}>
      <SearchIcon
        size={18}
        style={{
          position: 'absolute',
          left: 14,
          top: '50%',
          transform: 'translateY(-50%)',
          color: 'var(--text-tertiary)',
          opacity: 0.6,
        }}
      />
      <Input
        placeholder={placeholder}
        value={keyword}
        onChange={(e) => onChange(e.target.value)}
        onPressEnter={onSearch}
        style={{
          paddingLeft: 42,
          height: 44,
          borderRadius: 10,
          background: 'var(--bg-primary)',
          border: '1px solid var(--border-color)',
        }}
      />
      {keyword && (
        <Button
          type="text"
          icon={<X size={16} />}
          onClick={() => onChange('')}
          style={{
            position: 'absolute',
            right: 8,
            top: '50%',
            transform: 'translateY(-50%)',
          }}
        />
      )}
    </div>
  );
};
```

#### 3.1.3 提取 FilterPanel 组件

**文件**: `components/FilterPanel.tsx`

**功能**: 类型筛选、优先级筛选、标签筛选、日期筛选

**接口**:
```typescript
interface FilterPanelProps {
  filter: FilterState;
  onChange: (filter: FilterState) => void;
  existingTags: string[];
}
```

#### 3.1.4 提取 MasonryCard 组件

**文件**: `components/MasonryCard.tsx`

**注意**: 保持 React.memo 优化，使用 Context 传递选中状态

```typescript
import React, { memo, useContext } from 'react';
import { BatchSelectionContext } from '../index';

interface MasonryCardProps {
  creativity: Creativity;
  keyword: string;
  batchMode: boolean;
  onItemClick: (item: Creativity) => void;
  onContextMenu: (e: React.MouseEvent, item: Creativity) => void;
  onToggleSelect: (id: string) => void;
}

export const MasonryCard = memo<MasonryCardProps>(({
  creativity,
  keyword,
  batchMode,
  onItemClick,
  onContextMenu,
  onToggleSelect,
}) => {
  const { selectedIds } = useContext(BatchSelectionContext);
  const isSelected = selectedIds.has(creativity.id);
  
  // 卡片渲染逻辑...
});
```

#### 3.1.5 提取 BatchToolbar 组件

**文件**: `components/BatchToolbar.tsx`

**功能**: 批量选择、批量标签、批量收藏、批量删除

---

### 阶段二：状态管理重构（2-3小时）

#### 3.2.1 创建 Search Store

**文件**: `stores/searchStore.ts`

```typescript
import { create } from 'zustand';
import { api } from '../../utils/api';
import type { FilterState, SortState, SearchState } from '../types';

interface SearchStore extends SearchState {
  // Filter State
  filter: FilterState;
  sort: SortState;
  
  // Batch State
  batchMode: boolean;
  selectedIds: Set<string>;
  
  // Actions
  setKeyword: (keyword: string) => void;
  setFilter: (filter: Partial<FilterState>) => void;
  setSort: (sort: SortState) => void;
  search: () => Promise<void>;
  
  // Batch Actions
  toggleBatchMode: () => void;
  toggleSelect: (id: string) => void;
  selectAll: (ids: string[]) => void;
  clearSelection: () => void;
  
  // Batch Operations
  batchTag: (tagNames: string[]) => Promise<void>;
  batchFavorite: () => Promise<void>;
  batchDelete: () => Promise<void>;
}

export const useSearchStore = create<SearchStore>((set, get) => ({
  // Initial State
  keyword: '',
  results: [],
  loading: false,
  pagination: { page: 1, pageSize: 20, total: 0 },
  filter: { types: [], minPriority: 0, tags: [], emojiReactions: [] },
  sort: { field: 'updatedAt', order: 'desc' },
  batchMode: false,
  selectedIds: new Set(),
  
  // Actions
  setKeyword: (keyword) => set({ keyword }),
  
  setFilter: (partialFilter) => set((state) => ({
    filter: { ...state.filter, ...partialFilter },
  })),
  
  setSort: (sort) => set({ sort }),
  
  search: async () => {
    const { keyword, filter, sort, pagination } = get();
    set({ loading: true });
    
    try {
      const result = await api.creativity.search({
        keyword,
        page: pagination.page,
        pageSize: pagination.pageSize,
        ...filter,
        sortField: sort.field,
        sortOrder: sort.order,
      });
      
      set({
        results: result.items || [],
        pagination: { ...pagination, total: result.total },
        loading: false,
      });
    } catch (error) {
      console.error('搜索失败:', error);
      set({ loading: false });
    }
  },
  
  // Batch Actions
  toggleBatchMode: () => set((state) => ({
    batchMode: !state.batchMode,
    selectedIds: state.batchMode ? new Set() : state.selectedIds,
  })),
  
  toggleSelect: (id) => set((state) => {
    const newSelected = new Set(state.selectedIds);
    if (newSelected.has(id)) {
      newSelected.delete(id);
    } else {
      newSelected.add(id);
    }
    return { selectedIds: newSelected };
  }),
  
  selectAll: (ids) => set({ selectedIds: new Set(ids) }),
  
  clearSelection: () => set({ selectedIds: new Set() }),
  
  // Batch Operations
  batchTag: async (tagNames) => {
    const { selectedIds } = get();
    // 批量标签逻辑...
  },
  
  batchFavorite: async () => {
    const { selectedIds } = get();
    // 批量收藏逻辑...
  },
  
  batchDelete: async () => {
    const { selectedIds } = get();
    // 批量删除逻辑...
  },
}));
```

#### 3.2.2 创建自定义 Hooks

**文件**: `hooks/useSearch.ts`

```typescript
import { useEffect, useCallback } from 'react';
import { useSearchStore } from '../stores/searchStore';

export const useSearch = () => {
  const {
    keyword,
    results,
    loading,
    pagination,
    setKeyword,
    search,
  } = useSearchStore();
  
  const handleSearch = useCallback(() => {
    search();
  }, [search]);
  
  // 防抖搜索
  useEffect(() => {
    const timer = setTimeout(() => {
      search();
    }, 300);
    return () => clearTimeout(timer);
  }, [keyword, search]);
  
  return {
    keyword,
    results,
    loading,
    pagination,
    setKeyword,
    handleSearch,
  };
};
```

**文件**: `hooks/useFilter.ts`

```typescript
import { useCallback } from 'react';
import { useSearchStore } from '../stores/searchStore';

export const useFilter = () => {
  const { filter, setFilter, search } = useSearchStore();
  
  const toggleType = useCallback((type: string) => {
    setFilter({
      types: filter.types.includes(type)
        ? filter.types.filter((t) => t !== type)
        : [...filter.types, type],
    });
    search();
  }, [filter.types, setFilter, search]);
  
  // 其他筛选操作...
  
  return {
    filter,
    toggleType,
    // ...
  };
};
```

---

### 阶段三：性能优化（3-4小时）

#### 3.3.1 虚拟滚动实现

**文件**: `components/VirtualMasonry.tsx`

```typescript
import React, { useRef, useEffect, useState, useMemo } from 'react';
import { useVirtualizer } from '@tanstack/react-virtual';

interface VirtualMasonryProps {
  items: Array<{ id: string; children: React.ReactNode }>;
  columnWidth: number;
  gap: number;
}

export const VirtualMasonry: React.FC<VirtualMasonryProps> = ({
  items,
  columnWidth,
  gap,
}) => {
  const parentRef = useRef<HTMLDivElement>(null);
  
  const virtualizer = useVirtualizer({
    count: items.length,
    getScrollElement: () => parentRef.current,
    estimateSize: () => 200, // 预估高度
    overscan: 5, // 预渲染数量
  });
  
  // 虚拟滚动实现...
};
```

#### 3.3.2 图片懒加载

```typescript
// 使用 Intersection Observer
const useLazyImage = (src: string) => {
  const [shouldLoad, setShouldLoad] = useState(false);
  const imgRef = useRef<HTMLImageElement>(null);
  
  useEffect(() => {
    const observer = new IntersectionObserver(
      ([entry]) => {
        if (entry.isIntersecting) {
          setShouldLoad(true);
          observer.disconnect();
        }
      },
      { rootMargin: '50px' }
    );
    
    if (imgRef.current) {
      observer.observe(imgRef.current);
    }
    
    return () => observer.disconnect();
  }, []);
  
  return { imgRef, shouldLoad };
};
```

#### 3.3.3 搜索防抖

已在 `useSearch` hook 中实现 300ms 防抖。

---

### 阶段四：主页面重构（2-3小时）

#### 3.4.1 新 Search 页面入口

**文件**: `index.tsx`

```typescript
import React, { createContext } from 'react';
import { SearchBar } from './components/SearchBar';
import { FilterPanel } from './components/FilterPanel';
import { SortDropdown } from './components/SortDropdown';
import { ViewToggle } from './components/ViewToggle';
import { BatchToolbar } from './components/BatchToolbar';
import { ResultList } from './components/ResultList';
import { EmptyState } from './components/EmptyState';
import { useSearch } from './hooks/useSearch';
import { useFilter } from './hooks/useFilter';
import { useSearchStore } from './stores/searchStore';

// 批量选择 Context
export const BatchSelectionContext = createContext({
  selectedIds: new Set<string>(),
  toggleSelect: (id: string) => {},
});

const Search: React.FC = () => {
  const {
    keyword,
    results,
    loading,
    batchMode,
    selectedIds,
    setKeyword,
    toggleBatchMode,
    toggleSelect,
  } = useSearchStore();
  
  const { handleSearch } = useSearch();
  const { filter, existingTags } = useFilter();
  
  return (
    <BatchSelectionContext.Provider value={{ selectedIds, toggleSelect }}>
      <div style={{ padding: 24, maxWidth: 1200, margin: '0 auto' }}>
        {/* 搜索栏 */}
        <div style={{ display: 'flex', gap: 12, marginBottom: 20 }}>
          <SearchBar
            keyword={keyword}
            onChange={setKeyword}
            onSearch={handleSearch}
          />
          <SortDropdown />
          <ViewToggle />
        </div>
        
        {/* 筛选面板 */}
        <FilterPanel filter={filter} existingTags={existingTags} />
        
        {/* 批量操作工具栏 */}
        {batchMode && <BatchToolbar />}
        
        {/* 结果列表 */}
        {results.length === 0 && !loading ? (
          <EmptyState />
        ) : (
          <ResultList loading={loading} />
        )}
      </div>
    </BatchSelectionContext.Provider>
  );
};

export default Search;
```

---

## 四、迁移检查清单

### 功能完整性检查

- [ ] 搜索功能正常
- [ ] 关键词高亮显示
- [ ] 筛选功能（类型、优先级、标签、日期）
- [ ] 排序功能
- [ ] 视图切换（表格/瀑布流）
- [ ] 卡片右键菜单
- [ ] 批量选择模式
- [ ] 批量操作（标签、收藏、删除）
- [ ] 卡片预览
- [ ] 分页加载

### 性能检查

- [ ] 大数据量场景下滚动流畅
- [ ] 搜索防抖生效
- [ ] 图片懒加载生效
- [ ] 批量选择不触发全列表重渲染

### 代码质量检查

- [ ] 无 TypeScript 类型错误
- [ ] 无 ESLint 警告
- [ ] 组件 Props 类型定义完整
- [ ] 无 console.log 残留

---

## 五、回滚方案

如重构过程中出现严重问题，按以下步骤回滚：

1. 保留原 `Search.tsx` 文件备份
2. 删除 `Search/` 目录
3. 恢复 `Search.tsx` 到原位置
4. 更新路由导入

---

## 六、时间规划

| 日期 | 任务 | 负责人 | 产出物 |
|------|------|--------|--------|
| Day 1 AM | 阶段一：组件拆分 | 前端工程师 | 目录结构 + 基础组件 |
| Day 1 PM | 阶段二：状态管理 | 前端工程师 | Search Store + Hooks |
| Day 2 AM | 阶段三：性能优化 | 前端工程师 | 虚拟滚动 + 懒加载 |
| Day 2 PM | 阶段四：整合测试 | 前端工程师 | 完整重构版本 |
| Day 3 | 代码审查 | 代码审查专家 | 审查报告 |
| Day 4 | 修复 + 上线 | 前端工程师 | 生产版本 |

---

## 七、风险评估

| 风险 | 概率 | 影响 | 应对措施 |
|------|------|------|----------|
| 功能遗漏 | 中 | 高 | 完整的功能检查清单 |
| 性能下降 | 低 | 高 | 分阶段测试，及时回滚 |
| 进度延期 | 中 | 中 | 预留缓冲时间，分阶段交付 |
| 兼容性问题 | 低 | 中 | 保持 API 接口不变 |

---

**文档版本**: v1.0  
**创建日期**: 2025-05-23  
**最后更新**: 2025-05-23  
**审核状态**: 待审核
