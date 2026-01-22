import { useTheme } from 'next-themes';

export const useChartTheme = () => {
  const { theme } = useTheme();

  return {
    grid: theme === 'dark' ? '#2d2a24' : '#e5e7eb',
    axis: theme === 'dark' ? '#9CA3AF' : '#6b7280',
    tooltip: {
      bg: theme === 'dark' ? '#25231e' : '#f6f6f4',
      border: theme === 'dark' ? '#2d2a24' : '#e5e1d8',
      text: theme === 'dark' ? '#f6f6f4' : '#1F1F1F',
    },
    line: theme === 'dark' ? '#3b82f6' : '#000000',
  };
};
