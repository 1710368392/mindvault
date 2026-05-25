// @ts-nocheck
/**
 * useUIContext - 上报 UI 上下文到主进程
 */
import { useEffect, useCallback } from 'react';
import { useLocation } from 'react-router-dom';

export function useUIContext(selectedCreativityId?: string | null, activeBoardId?: string | null) {
  const location = useLocation();

  const reportContext = useCallback((partial: Record<string, any>) => {
    if (window.api?.send) {
      window.api.send('ui:context-update', partial);
    }
  }, []);

  // 监听路由变化
  useEffect(() => {
    const page = location.pathname.replace('/', '') || 'home';
    reportContext({ currentPage: page });
  }, [location.pathname, reportContext]);

  // 监听选中的创意变化
  useEffect(() => {
    reportContext({ selectedCreativityId: selectedCreativityId || null });
  }, [selectedCreativityId, reportContext]);

  // 监听活动看板变化
  useEffect(() => {
    reportContext({ activeBoardId: activeBoardId || null });
  }, [activeBoardId, reportContext]);

  return { reportContext };
}
