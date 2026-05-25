import React, { useEffect } from 'react';
import StatsDashboard from '../components/dashboard/StatsDashboard';
import { useCreativityStore } from '../stores/creativityStore';

const StatsPage: React.FC = () => {
  const stats = useCreativityStore((s) => s.stats);
  const fetchStats = useCreativityStore((s) => s.fetchStats);

  useEffect(() => {
    fetchStats();
  }, [fetchStats]);

  return <StatsDashboard stats={stats} isLoading={!stats} />;
};

export default StatsPage;
