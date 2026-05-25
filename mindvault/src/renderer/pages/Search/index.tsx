import React, { useState, useEffect, useCallback, useMemo, useRef } from 'react';
import { useSearchParams } from 'react-router-dom';
import { Button, Rate, Pagination, Empty, Spin } from 'antd';
import { motion, AnimatePresence } from 'framer-motion';
import { Filter, CheckSquare, Play, Mic, Link as LinkIcon, FileText, ArrowUp, ArrowDown } from 'lucide-react';

import SearchBar from './components/SearchBar';
import SortDropdown from './components/SortDropdown';
import ViewToggle from './components/ViewToggle';
import FilterPanel from './components/FilterPanel';
import BatchToolbar from './components/BatchToolbar';
import MasonryCard from './components/MasonryCard';
import TableCard from './components/TableCard';
import ContextMenu from './components/ContextMenu';
import { BatchSelectionContext } from './context';
import { SEARCH_TYPE_ICONS } from './constants';
import { useSearchStore } from './stores/searchStore';
import { useSearch } from './hooks/useSearch';

import MasonryLayout from '../../components/common/MasonryLayout';
import { api } from '../../utils/api';
import { formatRelativeTime, getCreativityTypeLabel } from '../../utils/formatters';
import { toMediaUrl } from '../../utils/media';
import CardPreview from '../../components/card/CardPreview';
import EmojiIcon from '../../components/common/EmojiIcon';
import type { Creativity } from '@shared/types';
import type { ViewMode, ContextMenuState } from './types';
import { HIDDEN_TAGS } from './constants';

const Search: React.FC = () => {
  const [searchParams] = useSearchParams();
  const store = useSearchStore();
  const {
    keyword, results, loading, page, pageSize, total,
    filter, sortField, sortOrder,
    batchMode, selectedIds, batchTagInput,
    setKeyword, setPage, setFilter, setSort,
    handleSearch,
  } = useSearch();

  const [filterOpen, setFilterOpen] = useState(false);
  const [viewMode, setViewMode] = useState<ViewMode>(
    (localStorage.getItem('searchViewMode') as ViewMode) || 'table'
  );
  const [previewOpen, setPreviewOpen] = useState(false);
  const [previewItem, setPreviewItem] = useState<Creativity | null>(null);
  const [startInEditMode, setStartInEditMode] = useState(false);
  const [editItem, setEditItem] = useState<Creativity | null>(null);
  const [editWindowId, setEditWindowId] = useState('');
  const [contextMenu, setContextMenu] = useState<ContextMenuState | null>(null);
  const [existingTags, setExistingTags] = useState<string[]>([]);
  const justDraggedRef = useRef(false);

  // 加载标签列表
  useEffect(() => {
    api.tag.list().then((result) => {
      if (result) {
        setExistingTags(result.map((t: any) => t.name || t).filter((name: string) => !HIDDEN_TAGS.includes(name)));
      }
    }).catch(() => {});
  }, []);

  // 从 URL 参数恢复筛选状态
  useEffect(() => {
    const types = searchParams.getAll('type');
    const minPriority = parseInt(searchParams.get('minPriority') || '0', 10);
    const tags = searchParams.getAll('tag');
    const emojis = searchParams.getAll('emoji');
    const hasAttachments = searchParams.get('hasAttachments');
    const sort = searchParams.get('sort') || 'updatedAt';
    const order = (searchParams.get('order') as 'asc' | 'desc') || 'desc';

    setFilter({
      types,
      minPriority,
      tags,
      emojiReactions: emojis,
      hasAttachments: hasAttachments === 'true' ? true : hasAttachments === 'false' ? false : undefined,
    });
    setSort(sort, order);
  }, [searchParams, setFilter, setSort]);

  // 更新 URL 参数
  const updateSearchParams = useCallback((updates: Record<string, string | string[] | null>) => {
    const newParams = new URLSearchParams(searchParams.toString());
    Object.entries(updates).forEach(([key, value]) => {
      newParams.delete(key);
      if (value !== null) {
        if (Array.isArray(value)) {
          value.forEach((v) => newParams.append(key, v));
        } else {
          newParams.set(key, value);
        }
      }
    });
    window.history.replaceState(null, '', `#/search?${newParams.toString()}`);
  }, [searchParams]);

  // 筛选操作
  const toggleTypeFilter = useCallback((type: string) => {
    const newTypes = filter.types.includes(type)
      ? filter.types.filter((t) => t !== type)
      : [...filter.types, type];
    updateSearchParams({ type: newTypes.length > 0 ? newTypes : null });
    setFilter({ types: newTypes });
  }, [filter.types, updateSearchParams, setFilter]);

  const setMinPriorityFilter = useCallback((priority: number) => {
    updateSearchParams({ minPriority: priority > 0 ? String(priority) : null });
    setFilter({ minPriority: priority });
  }, [updateSearchParams, setFilter]);

  const toggleTagFilter = useCallback((tag: string) => {
    const newTags = filter.tags.includes(tag)
      ? filter.tags.filter((t) => t !== tag)
      : [...filter.tags, tag];
    updateSearchParams({ tag: newTags.length > 0 ? newTags : null });
    setFilter({ tags: newTags });
  }, [filter.tags, updateSearchParams, setFilter]);

  const toggleEmojiFilter = useCallback((emoji: string) => {
    const newEmojis = filter.emojiReactions.includes(emoji)
      ? filter.emojiReactions.filter((e) => e !== emoji)
      : [...filter.emojiReactions, emoji];
    updateSearchParams({ emoji: newEmojis.length > 0 ? newEmojis : null });
    setFilter({ emojiReactions: newEmojis });
  }, [filter.emojiReactions, updateSearchParams, setFilter]);

  const resetFilters = useCallback(() => {
    updateSearchParams({ type: null, minPriority: null, tag: null, emoji: null });
    setFilter({ types: [], minPriority: 0, tags: [], emojiReactions: [] });
  }, [updateSearchParams, setFilter]);

  const handleSort = useCallback((field: string) => {
    if (sortField === field) {
      const newOrder = sortOrder === 'asc' ? 'desc' : 'asc';
      updateSearchParams({ order: newOrder });
      setSort(field, newOrder);
    } else {
      updateSearchParams({ sort: field, order: 'desc' });
      setSort(field, 'desc');
    }
  }, [sortField, sortOrder, updateSearchParams, setSort]);

  // 项目操作
  const handleItemClick = useCallback((item: Creativity) => {
    if (batchMode) {
      store.toggleSelectItem(item.id);
      return;
    }
    if (justDraggedRef.current) {
      justDraggedRef.current = false;
      return;
    }
    setPreviewItem(item);
    setStartInEditMode(false);
    setPreviewOpen(true);
  }, [batchMode, store]);

  const handleContextMenu = useCallback((e: React.MouseEvent, item: Creativity) => {
    e.preventDefault();
    setContextMenu({ x: e.clientX, y: e.clientY, item });
  }, []);

  const handleContextAction = useCallback((key: string, item: Creativity) => {
    if (key === 'edit') {
      setPreviewOpen(false);
      setEditItem(item);
      setEditWindowId(`search-edit-${item.id}-${Date.now()}`);
    } else if (key === 'favorite') {
      store.toggleFavorite(item);
      setContextMenu(null);
    } else if (key === 'delete') {
      store.deleteItem(item);
      setContextMenu(null);
    }
  }, [store]);

  // 瀑布流 items
  const masonryItems = useMemo(() => results.map((c) => ({
    id: c.id,
    children: (
      <MasonryCard
        creativity={c}
        keyword={keyword}
        batchMode={batchMode}
        onItemClick={handleItemClick}
        onContextMenu={handleContextMenu}
        onToggleSelect={store.toggleSelectItem}
        justDraggedRef={justDraggedRef}
      />
    ),
  })), [results, batchMode, handleItemClick, handleContextMenu, store.toggleSelectItem]);

  return (
    <div style={{ padding: 24, maxWidth: viewMode === 'masonry' ? 1200 : 1000, width: '100%', margin: '0 auto', height: '100%', display: 'flex', flexDirection: 'column', boxSizing: 'border-box', transition: 'max-width 0.3s ease' }}>
      {/* 搜索栏 */}
      <div style={{ marginBottom: 20, width: '100%' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
          <SearchBar keyword={keyword} onChange={setKeyword} onSearch={handleSearch} />
          <SortDropdown sortField={sortField} sortOrder={sortOrder} onSort={handleSort} />
          <Button icon={<Filter size={16} />} onClick={() => setFilterOpen(!filterOpen)} type={filterOpen ? 'primary' : 'default'} style={{ height: 44, borderRadius: 10 }}>
            筛选
          </Button>
          <Button icon={<CheckSquare size={16} />} onClick={store.toggleBatchMode} type={batchMode ? 'primary' : 'default'} style={{ height: 44, borderRadius: 10 }}>
            批量
          </Button>
          <ViewToggle viewMode={viewMode} onChange={setViewMode} />
        </div>

        {/* 批量操作栏 */}
        <AnimatePresence>
          {batchMode && (
            <BatchToolbar
              selectedCount={selectedIds.size}
              totalCount={results.length}
              batchTagInput={batchTagInput}
              onBatchTagInputChange={store.setBatchTagInput}
              onSelectAll={store.toggleSelectAll}
              onBatchAddTags={store.batchAddTags}
              onBatchFavorite={store.batchFavorite}
              onBatchDelete={store.batchDelete}
              onExit={store.toggleBatchMode}
            />
          )}
        </AnimatePresence>

        {/* 筛选面板 */}
        <AnimatePresence>
          {filterOpen && (
            <FilterPanel
              filter={filter}
              existingTags={existingTags}
              onToggleType={toggleTypeFilter}
              onSetMinPriority={setMinPriorityFilter}
              onToggleTag={toggleTagFilter}
              onToggleEmoji={toggleEmojiFilter}
              onReset={resetFilters}
            />
          )}
        </AnimatePresence>
      </div>

      {/* 结果列表 */}
      {loading ? (
        <div style={{ flex: 1, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
          <Spin size="large" />
        </div>
      ) : results.length === 0 ? (
        <div style={{ flex: 1, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
          <Empty description={keyword ? '没有找到匹配的创意' : '暂无创意，快去创建吧'} />
        </div>
      ) : (
        <>
          <div style={{ flex: 1, overflow: 'auto' }}>
            {viewMode === 'table' ? (
              <BatchSelectionContext.Provider value={{ selectedIds, toggleSelect: store.toggleSelectItem }}>
                {/* 表头 */}
                <div style={{
                  display: 'grid',
                  gridTemplateColumns: '32px 52px 1fr 80px 120px 100px 60px 80px 100px',
                  alignItems: 'center',
                  gap: 12,
                  padding: '8px 16px',
                  background: 'var(--bg-secondary)',
                  borderBottom: '1px solid var(--border-light)',
                  fontSize: 12,
                  color: 'var(--text-tertiary)',
                  fontWeight: 500,
                  position: 'sticky',
                  top: 0,
                  zIndex: 10,
                }}>
                  <div /> {/* 批量选择占位 */}
                  <div /> {/* 缩略图占位 */}
                  <div style={{ display: 'flex', alignItems: 'center', gap: 4, cursor: 'pointer' }} onClick={() => store.setSort('title', sortField === 'title' && sortOrder === 'asc' ? 'desc' : 'asc')}>
                    标题/摘要
                    {sortField === 'title' ? (sortOrder === 'asc' ? <ArrowUp size={12} /> : <ArrowDown size={12} />) : null}
                  </div>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 4, cursor: 'pointer' }} onClick={() => store.setSort('type', sortField === 'type' && sortOrder === 'asc' ? 'desc' : 'asc')}>
                    类型
                    {sortField === 'type' ? (sortOrder === 'asc' ? <ArrowUp size={12} /> : <ArrowDown size={12} />) : null}
                  </div>
                  <div>关联位置</div>
                  <div>标签</div>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 4, cursor: 'pointer' }} onClick={() => store.setSort('wordCount', sortField === 'wordCount' && sortOrder === 'asc' ? 'desc' : 'asc')}>
                    字数
                    {sortField === 'wordCount' ? (sortOrder === 'asc' ? <ArrowUp size={12} /> : <ArrowDown size={12} />) : null}
                  </div>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 4, cursor: 'pointer' }} onClick={() => store.setSort('priority', sortField === 'priority' && sortOrder === 'asc' ? 'desc' : 'asc')}>
                    优先级
                    {sortField === 'priority' ? (sortOrder === 'asc' ? <ArrowUp size={12} /> : <ArrowDown size={12} />) : null}
                  </div>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 4, cursor: 'pointer' }} onClick={() => store.setSort('createdAt', sortField === 'createdAt' && sortOrder === 'asc' ? 'desc' : 'asc')}>
                    创建时间
                    {sortField === 'createdAt' ? (sortOrder === 'asc' ? <ArrowUp size={12} /> : <ArrowDown size={12} />) : null}
                  </div>
                </div>
                {/* 表格内容 */}
                <div style={{ height: 'calc(100vh - 280px)', overflow: 'auto' }}>
                  {results.length > 0 ? (
                    results.map((c) => (
                      <TableCard
                        key={c.id}
                        creativity={c}
                        keyword={keyword}
                        batchMode={batchMode}
                        isSelected={selectedIds.has(c.id)}
                        onItemClick={handleItemClick}
                        onContextMenu={handleContextMenu}
                        onToggleSelect={store.toggleSelectItem}
                      />
                    ))
                  ) : (
                    <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', height: '100%', color: 'var(--text-tertiary)' }}>
                      暂无数据
                    </div>
                  )}
                </div>
              </BatchSelectionContext.Provider>
            ) : (
              <BatchSelectionContext.Provider value={{ selectedIds, toggleSelect: store.toggleSelectItem }}>
                <MasonryLayout columns={4} gap={16} minColumnWidth={250} items={masonryItems} />
              </BatchSelectionContext.Provider>
            )}
            {total > pageSize && (
              <div style={{ display: 'flex', justifyContent: 'center', padding: '20px 0 8px' }}>
                <Pagination current={page} pageSize={pageSize} total={total} onChange={(p) => setPage(p)} showSizeChanger={false} />
              </div>
            )}
          </div>
        </>
      )}

      {/* 右键菜单 */}
      {contextMenu && (
        <ContextMenu
          x={contextMenu.x}
          y={contextMenu.y}
          item={contextMenu.item}
          onEdit={(item) => handleContextAction('edit', item)}
          onFavorite={(item) => handleContextAction('favorite', item)}
          onDelete={(item) => handleContextAction('delete', item)}
          onClose={() => setContextMenu(null)}
        />
      )}

      {/* 预览弹窗 */}
      {previewItem && (
        <CardPreview
          creativity={previewItem}
          isOpen={previewOpen}
          onClose={() => { setPreviewOpen(false); setPreviewItem(null); }}
          onSave={async (data) => {
            try {
              await api.creativity.update(previewItem.id, data);
              handleSearch();
              return true;
            } catch { return false; }
          }}
          startInEditMode={startInEditMode}
          onEdit={() => {
            const item = previewItem;
            setPreviewOpen(false);
            setPreviewItem(null);
            setEditItem(item);
            setEditWindowId(`search-edit-${item.id}-${Date.now()}`);
          }}
        />
      )}

      {/* 浮动编辑器 */}
      {editItem && (
        <CardPreview
          creativity={editItem}
          isOpen={true}
          floating={true}
          windowId={editWindowId}
          zIndex={10001}
          onClose={() => { setEditItem(null); setEditWindowId(''); }}
          onSave={async (data) => {
            try {
              await api.creativity.update(editItem.id, { ...data, id: editItem.id });
              return true;
            } catch { return false; }
          }}
          startInEditMode={true}
        />
      )}
    </div>
  );
};

export default Search;
