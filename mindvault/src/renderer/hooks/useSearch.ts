import { useState, useCallback, useRef } from 'react';
import { api } from '../utils/api';
import type { Creativity } from '@shared/types';

export type SortField = 'updatedAt' | 'createdAt' | 'title' | 'priority';
export type SortDirection = 'asc' | 'desc';

export interface SearchFilter {
  types?: string[];
  priorities?: number[];
  tags?: string[];
  emojiReactions?: string[];
  cardColors?: string[];
  [key: string]: unknown;
}

interface UseSearchReturn {
  keyword: string;
  setKeyword: (keyword: string) => void;
  filter: SearchFilter;
  setFilter: (filter: SearchFilter) => void;
  results: Creativity[];
  isLoading: boolean;
  total: number;
  page: number;
  pageSize: number;
  setPage: (page: number) => void;
  setPageSize: (size: number) => void;
  search: () => Promise<void>;
  reset: () => void;
  sortField: SortField;
  sortDirection: SortDirection;
  setSort: (field: SortField, direction?: SortDirection) => void;
  toggleSortDirection: () => void;
}

function applyClientFilters(data: Creativity[], searchFilter: SearchFilter): Creativity[] {
  let filtered = data;

  if (searchFilter.types && searchFilter.types.length > 0) {
    filtered = filtered.filter((c) => searchFilter.types!.includes(c.type));
  }
  if (searchFilter.priorities && searchFilter.priorities.length > 0) {
    filtered = filtered.filter((c) => searchFilter.priorities!.includes(c.priority || 0));
  }
  if (searchFilter.tags && searchFilter.tags.length > 0) {
    filtered = filtered.filter((c) => {
      const itemTags = (c.tags || []).map((t: any) => t.name || t);
      return searchFilter.tags!.some((tag) => itemTags.includes(tag));
    });
  }
  if (searchFilter.emojiReactions && searchFilter.emojiReactions.length > 0) {
    filtered = filtered.filter((c) =>
      c.emojiReaction && searchFilter.emojiReactions!.includes(c.emojiReaction)
    );
  }
  if (searchFilter.cardColors && searchFilter.cardColors.length > 0) {
    filtered = filtered.filter((c) => {
      if (!c.cardStyle) return false;
      try {
        const style = JSON.parse(c.cardStyle);
        const bgColor = style.backgroundColor || style.background || '';
        return searchFilter.cardColors!.some((color) =>
          bgColor.toLowerCase().includes(color.toLowerCase())
        );
      } catch {
        return false;
      }
    });
  }

  return filtered;
}

export function useSearch(initialFilter?: SearchFilter): UseSearchReturn {
  const [keyword, setKeywordState] = useState('');
  const [filter, setFilterState] = useState<SearchFilter>(initialFilter || {});
  const [results, setResults] = useState<Creativity[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [total, setTotal] = useState(0);
  const [page, setPageState] = useState(1);
  const [pageSize, setPageSizeState] = useState(20);
  const [sortField, setSortField] = useState<SortField>('updatedAt');
  const [sortDirection, setSortDirection] = useState<SortDirection>('desc');
  const [allKeywordResults, setAllKeywordResults] = useState<Creativity[]>([]);

  const stateRef = useRef({ keyword: '', filter: {} as SearchFilter, page: 1, pageSize: 20, sortField: 'updatedAt' as SortField, sortDirection: 'desc' as SortDirection });
  stateRef.current = { keyword, filter, page, pageSize, sortField, sortDirection };

  const timerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const seqRef = useRef(0);

  const doSearch = useCallback(async (searchKeyword: string, searchFilter: SearchFilter, searchPage: number, searchPageSize: number, sField: SortField, sDir: SortDirection) => {
    const seq = ++seqRef.current;
    setIsLoading(true);
    try {
      let data: Creativity[];

      if (searchKeyword) {
        const keywordResults = await api.creativity.search(searchKeyword, searchFilter);
        data = keywordResults || [];

        data = applyClientFilters(data, searchFilter);

        data.sort((a, b) => {
          let cmp = 0;
          if (sField === 'title') {
            cmp = (a.title || '').localeCompare(b.title || '', 'zh-CN');
          } else if (sField === 'priority') {
            cmp = (a.priority || 0) - (b.priority || 0);
          } else {
            cmp = new Date(a[sField] || 0).getTime() - new Date(b[sField] || 0).getTime();
          }
          return sDir === 'asc' ? cmp : -cmp;
        });

        setAllKeywordResults(data);
        const start = (searchPage - 1) * searchPageSize;
        const end = start + searchPageSize;
        setResults(data.slice(start, end));
        setTotal(data.length);
      } else {
        const result = await api.creativity.list({
          ...searchFilter,
          page: searchPage,
          pageSize: searchPageSize,
          sortBy: sField,
          sortOrder: sDir,
        });
        data = result.data || [];

        data = applyClientFilters(data, searchFilter);

        setAllKeywordResults([]);
        setResults(data);
        setTotal(result.pagination?.total || 0);
      }

      if (seq !== seqRef.current) return;
    } catch (error) {
      console.error('搜索失败:', error);
      if (seq === seqRef.current) {
        setResults([]);
        setTotal(0);
      }
    } finally {
      if (seq === seqRef.current) {
        setIsLoading(false);
      }
    }
  }, []);

  const search = useCallback(async () => {
    const { keyword: kw, filter: f, page: p, pageSize: ps, sortField: sf, sortDirection: sd } = stateRef.current;
    await doSearch(kw, f, p, ps, sf, sd);
  }, [doSearch]);

  const setKeyword = useCallback((newKeyword: string) => {
    setKeywordState(newKeyword);
    if (timerRef.current) clearTimeout(timerRef.current);
    timerRef.current = setTimeout(() => {
      const { filter: f, pageSize: ps, sortField: sf, sortDirection: sd } = stateRef.current;
      setPageState(1);
      doSearch(newKeyword, f, 1, ps, sf, sd);
    }, 300);
  }, [doSearch]);

  const setFilter = useCallback((newFilter: SearchFilter) => {
    setFilterState(newFilter);
    setPageState(1);
    const { keyword: kw, pageSize: ps, sortField: sf, sortDirection: sd } = stateRef.current;
    doSearch(kw, newFilter, 1, ps, sf, sd);
  }, [doSearch]);

  const setPage = useCallback((newPage: number) => {
    setPageState(newPage);
    const { keyword: kw, filter: f, pageSize: ps, sortField: sf, sortDirection: sd } = stateRef.current;
    doSearch(kw, f, newPage, ps, sf, sd);
  }, [doSearch]);

  const setPageSize = useCallback((newSize: number) => {
    setPageSizeState(newSize);
    stateRef.current.pageSize = newSize;
    setPageState(1);
    const { keyword: kw, filter: f, sortField: sf, sortDirection: sd } = stateRef.current;
    doSearch(kw, f, 1, newSize, sf, sd);
  }, [doSearch]);

  const setSort = useCallback((newField: SortField, newDirection?: SortDirection) => {
    setSortField(newField);
    if (newDirection !== undefined) {
      setSortDirection(newDirection);
    }
    setPageState(1);
    const { keyword: kw, filter: f, pageSize: ps, sortDirection: currentDir } = stateRef.current;
    const dir = newDirection !== undefined ? newDirection : currentDir;
    doSearch(kw, f, 1, ps, newField, dir);
  }, [doSearch]);

  const toggleSortDirection = useCallback(() => {
    setSortDirection((prev) => {
      const newDir = prev === 'asc' ? 'desc' : 'asc';
      setPageState(1);
      const { keyword: kw, filter: f, pageSize: ps, sortField: sf } = stateRef.current;
      doSearch(kw, f, 1, ps, sf, newDir);
      return newDir;
    });
  }, [doSearch]);

  const reset = useCallback(() => {
    setKeywordState('');
    setFilterState({});
    setPageState(1);
    setAllKeywordResults([]);
    if (timerRef.current) clearTimeout(timerRef.current);
    const { filter: f, pageSize: ps, sortField: sf, sortDirection: sd } = stateRef.current;
    doSearch('', {}, 1, ps, sf, sd);
  }, [doSearch]);

  return {
    keyword, setKeyword,
    filter, setFilter,
    results, isLoading, total,
    page, pageSize, setPage, setPageSize,
    search, reset,
    sortField, sortDirection, setSort, toggleSortDirection,
  };
}
