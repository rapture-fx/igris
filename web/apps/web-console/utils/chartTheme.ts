import { useTheme } from 'next-themes';

export const useChartTheme = () => {
  const { resolvedTheme, theme } = useTheme();
  const activeTheme = resolvedTheme ?? theme;

  return {
    grid: activeTheme === 'dark' ? '#2d2a24' : '#e5e7eb',
    axis: activeTheme === 'dark' ? '#9CA3AF' : '#6b7280',
    tooltip: {
      bg: activeTheme === 'dark' ? '#25231e' : '#f6f6f4',
      border: activeTheme === 'dark' ? '#2d2a24' : '#e5e1d8',
      text: activeTheme === 'dark' ? '#f6f6f4' : '#1F1F1F',
    },
    line: activeTheme === 'dark' ? '#93c5fd' : '#111827',
  };
};
