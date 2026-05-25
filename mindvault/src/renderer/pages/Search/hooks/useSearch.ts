import { useEffect, useCallback } from 'react';
import { useSearchStore } from '../stores/searchStore';

export const useSearch = () => {
  const {
    keyword,
    results,
    loading,
    page,
    pageSize,
    total,
    filter,
    sortField,
    sortOrder,
    batchMode,
    selectedIds,
    setKeyword,
    setPage,
    setFilter,
    setSort,
    search,
  } = useSearchStore();

  const handleSearch = useCallback(() => {
    search();
  }, [search]);

  // 搜索防抖
  useEffect(() => {
    const timer = setTimeout(() => {
      search();
    }, 300);
    return () => clearTimeout(timer);
  }, [keyword, page, pageSize, filter, sortField, sortOrder, search]);

  return {
    keyword,
    results,
    loading,
    page,
    pageSize,
    total,
    filter,
    sortField,
    sortOrder,
    batchMode,
    selectedIds,
    setKeyword,
    setPage,
    setFilter,
    setSort,
    handleSearch,
  };
};
