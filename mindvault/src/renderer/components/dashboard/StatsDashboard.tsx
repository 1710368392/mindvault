import React, { useEffect, useRef, useMemo, useCallback } from 'react';
import { motion } from 'framer-motion';
import { TrendingUp, Lightbulb, Calendar, BarChart3, Inbox } from 'lucide-react';
import { Skeleton, Progress, Empty } from 'antd';
import type { CreativityStats } from '../../types/creativity';
import { formatNumber } from '../../utils/formatters';
import { useUIStore } from '../../stores/uiStore';

interface StatsDashboardProps {
  stats: CreativityStats | null;
  isLoading?: boolean;
}

const TYPE_LABELS: Record<string, string> = {
  text: '文本',
  image: '图片',
  audio: '音频',
  link: '链接',
  video: '视频',
};

const TYPE_COLORS: Record<string, string> = {
  text: '#FFB300',
  image: '#42A5F5',
  audio: '#66BB6A',
  link: '#FF7043',
  video: '#EC407A',
};

function getCSSVar(name: string): string {
  return getComputedStyle(document.documentElement).getPropertyValue(name).trim();
}

function hexToRgb(hex: string): string | null {
  const cleaned = hex.replace('#', '');
  if (cleaned.length !== 6) return null;
  const r = parseInt(cleaned.substring(0, 2), 16);
  const g = parseInt(cleaned.substring(2, 4), 16);
  const b = parseInt(cleaned.substring(4, 6), 16);
  if (isNaN(r) || isNaN(g) || isNaN(b)) return null;
  return `${r}, ${g}, ${b}`;
}

function hexToHsl(hex: string): [number, number, number] | null {
  const cleaned = hex.replace('#', '');
  if (cleaned.length !== 6) return null;
  let r = parseInt(cleaned.substring(0, 2), 16) / 255;
  let g = parseInt(cleaned.substring(2, 4), 16) / 255;
  let b = parseInt(cleaned.substring(4, 6), 16) / 255;
  if (isNaN(r) || isNaN(g) || isNaN(b)) return null;
  const max = Math.max(r, g, b), min = Math.min(r, g, b);
  let h = 0, s = 0, l = (max + min) / 2;
  if (max !== min) {
    const d = max - min;
    s = l > 0.5 ? d / (2 - max - min) : d / (max + min);
    switch (max) {
      case r: h = ((g - b) / d + (g < b ? 6 : 0)) / 6; break;
      case g: h = ((b - r) / d + 2) / 6; break;
      case b: h = ((r - g) / d + 4) / 6; break;
    }
  }
  return [Math.round(h * 360), Math.round(s * 100), Math.round(l * 100)];
}

function hslToHex(h: number, s: number, l: number): string {
  s /= 100;
  l /= 100;
  const a = s * Math.min(l, 1 - l);
  const f = (n: number) => {
    const k = (n + h / 30) % 12;
    const color = l - a * Math.max(Math.min(k - 3, 9 - k, 1), -1);
    return Math.round(255 * color).toString(16).padStart(2, '0');
  };
  return `#${f(0)}${f(8)}${f(4)}`;
}

function generateThemePieColors(primaryHex: string): Record<string, string> {
  const hsl = hexToHsl(primaryHex);
  if (!hsl) return TYPE_COLORS;
  const [h, s, l] = hsl;
  const offsets = [0, 45, 90, 180, 270];
  const types = ['text', 'image', 'audio', 'link', 'video'];
  const result: Record<string, string> = {};
  types.forEach((type, i) => {
    const hue = (h + offsets[i]) % 360;
    const sat = Math.min(s + 10, 85);
    const light = Math.max(Math.min(l, 55), 45);
    result[type] = hslToHex(hue, sat, light);
  });
  return result;
}

function getThemeColors() {
  const primary = getCSSVar('--primary-color') || '#6C63FF';
  const primaryRgb = hexToRgb(primary);
  return {
    primary,
    textPrimary: getCSSVar('--text-primary') || '#1a1a2e',
    textSecondary: getCSSVar('--text-secondary') || '#6b7280',
    textTertiary: getCSSVar('--text-tertiary') || '#9ca3af',
    borderColor: getCSSVar('--border-color') || '#e5e7eb',
    borderLight: getCSSVar('--border-light') || '#f3f4f6',
    bgSecondary: getCSSVar('--bg-secondary') || '#ffffff',
    areaStart: primaryRgb ? `rgba(${primaryRgb}, 0.2)` : 'rgba(108, 99, 255, 0.2)',
    areaEnd: primaryRgb ? `rgba(${primaryRgb}, 0.02)` : 'rgba(108, 99, 255, 0.02)',
    pieColors: generateThemePieColors(primary),
  };
}

const StatsDashboard: React.FC<StatsDashboardProps> = ({
  stats,
  isLoading = false,
}) => {
  const pieChartRef = useRef<HTMLDivElement>(null);
  const lineChartRef = useRef<HTMLDivElement>(null);
  const pieChartInstance = useRef<any>(null);
  const lineChartInstance = useRef<any>(null);
  const dashboardRef = useRef<HTMLDivElement>(null);
  const theme = useUIStore((s) => s.theme);

  useEffect(() => {
    const container = dashboardRef.current;
    if (!container) return;

    const getPill = (target: EventTarget | null): Element | null => {
      if (!target || !(target instanceof HTMLElement)) return null;
      return target.closest('.pill-hover-anim');
    };

    const handleMouseOver = (e: MouseEvent) => {
      const el = getPill(e.target);
      if (!el) return;
      if (el.getAttribute('data-hover-state') === 'pressing') return;
      el.setAttribute('data-hover-state', 'pressing');
      el.classList.remove('pill-hover-release');
      void el.offsetWidth;
      el.classList.add('pill-hover-press');
    };

    const handleMouseOut = (e: MouseEvent) => {
      const el = getPill(e.target);
      if (!el) return;
      if (el.contains(e.relatedTarget as HTMLElement)) return;
      el.setAttribute('data-hover-state', 'releasing');
      el.classList.remove('pill-hover-press');
      void el.offsetWidth;
      el.classList.add('pill-hover-release');
      const onEnd = () => {
        el.classList.remove('pill-hover-release');
        el.removeAttribute('data-hover-state');
        el.removeEventListener('animationend', onEnd);
      };
      el.addEventListener('animationend', onEnd);
    };

    container.addEventListener('mouseover', handleMouseOver);
    container.addEventListener('mouseout', handleMouseOut);

    return () => {
      container.removeEventListener('mouseover', handleMouseOver);
      container.removeEventListener('mouseout', handleMouseOut);
    };
  }, []);

  const statCards = useMemo(
    () => [
      {
        label: '创意总数',
        value: stats?.totalCount ?? 0,
        icon: <Lightbulb size={20} />,
        color: 'var(--primary-color)',
      },
      {
        label: '今日新增',
        value: stats?.todayCount ?? 0,
        icon: <TrendingUp size={20} />,
        color: 'var(--success-color)',
      },
      {
        label: '本周新增',
        value: stats?.weekCount ?? 0,
        icon: <Calendar size={20} />,
        color: 'var(--info-color)',
      },
      {
        label: '常用标签',
        value: stats?.recentTags?.length ?? 0,
        icon: <BarChart3 size={20} />,
        color: 'var(--warning-color)',
      },
    ],
    [stats]
  );

  const renderPieChart = useCallback(async () => {
    if (!pieChartRef.current || !stats?.typeDistribution) return;

    try {
      const echarts = await import('echarts');

      if (!pieChartInstance.current) {
        pieChartInstance.current = echarts.init(pieChartRef.current);
      }
      const chart = pieChartInstance.current;

      const colors = getThemeColors();
      const data = Object.entries(stats.typeDistribution).map(([type, count]) => ({
        name: TYPE_LABELS[type] || type,
        value: count,
        itemStyle: { color: colors.pieColors[type] || TYPE_COLORS[type] || '#999' },
      }));

      chart.setOption({
        tooltip: {
          trigger: 'item',
          formatter: '{b}: {c} ({d}%)',
        },
        series: [
          {
            type: 'pie',
            radius: ['45%', '70%'],
            center: ['50%', '50%'],
            avoidLabelOverlap: false,
            itemStyle: {
              borderRadius: 6,
              borderColor: colors.bgSecondary,
              borderWidth: 2,
              shadowBlur: 8,
              shadowOffsetX: 0,
              shadowOffsetY: 3,
              shadowColor: 'rgba(0, 0, 0, 0.2)',
            },
            emphasis: {
              scale: true,
              scaleSize: 8,
              focus: 'self',
              itemStyle: {
                shadowBlur: 21,
                shadowOffsetX: 0,
                shadowOffsetY: 7,
                shadowColor: 'rgba(0, 0, 0, 0.315)',
                borderWidth: 0,
              },
            },
            blur: {
              itemStyle: {
                opacity: 0.35,
              },
              label: {
                opacity: 0.35,
              },
            },
            animationType: 'scale',
            animationEasing: 'elasticOut',
            animationDurationUpdate: 200,
            animationEasingUpdate: 'cubicOut',
            label: {
              show: true,
              fontSize: 11,
              color: colors.textSecondary,
            },
            data,
          },
        ],
      }, true);
    } catch (error) {
      console.error('ECharts 初始化失败:', error);
    }
  }, [stats?.typeDistribution, theme]);

  const renderLineChart = useCallback(async () => {
    if (!lineChartRef.current) return;

    try {
      const echarts = await import('echarts');

      if (!lineChartInstance.current) {
        lineChartInstance.current = echarts.init(lineChartRef.current);
      }
      const chart = lineChartInstance.current;

      const colors = getThemeColors();
      const dailyData = stats?.dailyData;
      let chartOption: any;

      const allTypes = ['text', 'image', 'audio', 'link', 'video'];

      if (dailyData && Array.isArray(dailyData) && dailyData.length > 0) {
        const days = dailyData.map((d) => {
          const date = new Date(d.date);
          return `${date.getMonth() + 1}/${date.getDate()}`;
        });

        const barSeries = allTypes
          .filter((t) => dailyData.some((d) => d.types && d.types[t]))
          .map((type, typeIndex, filteredTypes) => {
            const baseColor = colors.pieColors[type] || TYPE_COLORS[type] || '#999';
            const isTop = typeIndex === filteredTypes.length - 1;

            return {
              name: TYPE_LABELS[type] || type,
              type: 'bar',
              stack: 'daily',
              barWidth: '55%',
              barGap: '30%',
              barCategoryGap: '20%',
              data: dailyData.map((d) => (d.types && d.types[type]) || 0),
              itemStyle: {
                color: baseColor,
                borderRadius: isTop ? [8, 8, 0, 0] : [0, 0, 0, 0],
              },
              emphasis: {
                itemStyle: {
                  color: baseColor,
                  shadowBlur: 10,
                  shadowColor: 'rgba(0, 0, 0, 0.2)',
                },
              },
            };
          });

        chartOption = {
          tooltip: {
            trigger: 'axis',
            axisPointer: { type: 'shadow' },
          },
          legend: {
            show: barSeries.length > 1,
            bottom: 0,
            itemWidth: 10,
            itemHeight: 10,
            textStyle: { fontSize: 10, color: colors.textTertiary },
          },
          grid: { left: '3%', right: '4%', bottom: barSeries.length > 1 ? '14%' : '3%', top: '5%', containLabel: true },
          xAxis: {
            type: 'category',
            data: days,
            axisLine: { lineStyle: { color: colors.borderColor } },
            axisLabel: { color: colors.textTertiary, fontSize: 11 },
            axisTick: { show: false },
          },
          yAxis: {
            type: 'value',
            minInterval: 1,
            axisLine: { show: false },
            splitLine: { lineStyle: { color: colors.borderLight, type: 'dashed' } },
            axisLabel: { color: colors.textTertiary, fontSize: 11 },
          },
          series: barSeries,
        };
      } else {
        const days: string[] = [];
        const totals: number[] = [];
        for (let i = 6; i >= 0; i--) {
          const d = new Date();
          d.setDate(d.getDate() - i);
          days.push(`${d.getMonth() + 1}/${d.getDate()}`);
          totals.push(0);
        }

        chartOption = {
          tooltip: { trigger: 'axis' },
          grid: { left: '3%', right: '4%', bottom: '3%', top: '5%', containLabel: true },
          xAxis: {
            type: 'category',
            data: days,
            axisLine: { lineStyle: { color: colors.borderColor } },
            axisLabel: { color: colors.textTertiary, fontSize: 11 },
            axisTick: { show: false },
          },
          yAxis: {
            type: 'value',
            minInterval: 1,
            axisLine: { show: false },
            splitLine: { lineStyle: { color: colors.borderLight, type: 'dashed' } },
            axisLabel: { color: colors.textTertiary, fontSize: 11 },
          },
          series: [],
        };
      }

      chart.setOption(chartOption, true);
    } catch (error) {
      console.error('ECharts 初始化失败:', error);
    }
  }, [stats, theme]);

  useEffect(() => {
    renderPieChart();
    const resizeHandler = () => pieChartInstance.current?.resize();
    window.addEventListener('resize', resizeHandler);
    return () => {
      window.removeEventListener('resize', resizeHandler);
      pieChartInstance.current?.dispose();
      pieChartInstance.current = null;
    };
  }, [renderPieChart]);

  useEffect(() => {
    renderLineChart();
    const resizeHandler = () => lineChartInstance.current?.resize();
    window.addEventListener('resize', resizeHandler);
    return () => {
      window.removeEventListener('resize', resizeHandler);
      lineChartInstance.current?.dispose();
      lineChartInstance.current = null;
    };
  }, [renderLineChart]);

  useEffect(() => {
    renderPieChart();
    renderLineChart();
    const timer = setTimeout(() => {
      pieChartInstance.current?.resize();
      lineChartInstance.current?.resize();
    }, 100);
    return () => clearTimeout(timer);
  }, [theme, renderPieChart, renderLineChart]);

  const isEmpty = !stats || (stats.totalCount === 0 && !(stats.typeDistribution && Object.keys(stats.typeDistribution).length > 0));

  if (isLoading) {
    return (
      <div style={{ padding: 24 }}>
        <Skeleton active paragraph={{ rows: 4 }} />
      </div>
    );
  }

  if (isEmpty) {
    return (
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', minHeight: '100%', width: '100%', padding: '40px 0' }}>
        <motion.div
          initial={{ opacity: 0, scale: 0.9 }}
          animate={{ opacity: 1, scale: 1 }}
          style={{ textAlign: 'center' }}
        >
          <div style={{ width: 64, height: 64, borderRadius: 16, backgroundColor: 'var(--primary-bg)', display: 'flex', alignItems: 'center', justifyContent: 'center', boxShadow: 'var(--shadow-raised)', margin: '0 auto' }}>
            <Inbox size={32} color="var(--primary-color)" />
          </div>
          <div style={{ marginTop: 16 }}>
            <div style={{ fontSize: 18, fontWeight: 500, color: 'var(--text-primary)', marginBottom: 4 }}>暂无创意数据</div>
            <div style={{ fontSize: 14, color: 'var(--text-tertiary)' }}>用数据说话！</div>
          </div>
        </motion.div>
      </div>
    );
  }

  return (
    <div ref={dashboardRef} className="space-y-4">
      {/* 图表区域 */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
        {/* 类型分布饼图 */}
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.3 }}
          whileHover={{ y: -2, transition: { duration: 0.2 } }}
          style={{
            padding: 20,
            borderRadius: 16,
            backgroundColor: 'var(--bg-secondary)',
            borderTop: '1px solid rgba(0,0,0,0.12)',
            borderLeft: '1px solid rgba(0,0,0,0.12)',
            borderRight: '1px solid rgba(255,255,255,0.06)',
            borderBottom: '1px solid rgba(255,255,255,0.06)',
            boxShadow: 'inset 0 2px 4px rgba(0,0,0,0.12), inset 0 1px 2px rgba(0,0,0,0.08), 0 1px 0 rgba(255,255,255,0.04)',
          }}
        >
          <h3
            className="pill-hover-anim"
            style={{
              fontSize: 14,
              fontWeight: 600,
              color: 'var(--text-primary)',
              marginBottom: 16,
              display: 'inline-block',
              padding: '2px 10px',
              borderRadius: 9999,
              borderWidth: '1px 1px 2px',
              borderStyle: 'solid',
              borderColor: 'rgba(255, 255, 255, 0.15) rgba(0, 0, 0, 0.08) rgba(0, 0, 0, 0.12) rgba(255, 255, 255, 0.1)',
              boxShadow: 'rgba(0, 0, 0, 0.08) 0px 2px 0px, rgba(255, 255, 255, 0.1) 0px 1px 0px inset',
            }}
          >
            类型分布
          </h3>
          <div ref={pieChartRef} style={{ width: '100%', height: 240, borderRadius: 6, backgroundColor: 'rgba(0,0,0,0.03)', borderTop: '1px solid rgba(0,0,0,0.1)', borderLeft: '1px solid rgba(0,0,0,0.1)', borderRight: '1px solid rgba(255,255,255,0.04)', borderBottom: '1px solid rgba(255,255,255,0.04)', boxShadow: 'inset 0 1px 3px rgba(0,0,0,0.1), inset 0 1px 1px rgba(0,0,0,0.06)' }} />
        </motion.div>

        {/* 每日趋势折线图 */}
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.4 }}
          whileHover={{ y: -2, transition: { duration: 0.2 } }}
          style={{
            padding: 20,
            borderRadius: 16,
            backgroundColor: 'var(--bg-secondary)',
            borderTop: '1px solid rgba(0,0,0,0.12)',
            borderLeft: '1px solid rgba(0,0,0,0.12)',
            borderRight: '1px solid rgba(255,255,255,0.06)',
            borderBottom: '1px solid rgba(255,255,255,0.06)',
            boxShadow: 'inset 0 2px 4px rgba(0,0,0,0.12), inset 0 1px 2px rgba(0,0,0,0.08), 0 1px 0 rgba(255,255,255,0.04)',
          }}
        >
          <h3
            className="pill-hover-anim"
            style={{
              fontSize: 14,
              fontWeight: 600,
              color: 'var(--text-primary)',
              marginBottom: 16,
              display: 'inline-block',
              padding: '2px 10px',
              borderRadius: 9999,
              borderWidth: '1px 1px 2px',
              borderStyle: 'solid',
              borderColor: 'rgba(255, 255, 255, 0.15) rgba(0, 0, 0, 0.08) rgba(0, 0, 0, 0.12) rgba(255, 255, 255, 0.1)',
              boxShadow: 'rgba(0, 0, 0, 0.08) 0px 2px 0px, rgba(255, 255, 255, 0.1) 0px 1px 0px inset',
            }}
          >
            每日趋势
          </h3>
          <div ref={lineChartRef} style={{ width: '100%', height: 240, borderRadius: 6, backgroundColor: 'rgba(0,0,0,0.03)', borderTop: '1px solid rgba(0,0,0,0.1)', borderLeft: '1px solid rgba(0,0,0,0.1)', borderRight: '1px solid rgba(255,255,255,0.04)', borderBottom: '1px solid rgba(255,255,255,0.04)', boxShadow: 'inset 0 1px 3px rgba(0,0,0,0.1), inset 0 1px 1px rgba(0,0,0,0.06)' }} />
        </motion.div>
      </div>


    </div>
  );
};

export default StatsDashboard;
