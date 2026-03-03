export type TimeRange = '1h' | '6h' | '24h' | '7d' | 'all';

export const TIME_RANGE_MS: Record<Exclude<TimeRange, 'all'>, number> = {
  '1h':  3_600_000,
  '6h':  21_600_000,
  '24h': 86_400_000,
  '7d':  604_800_000,
};

const RANGES: TimeRange[] = ['1h', '6h', '24h', '7d', 'all'];

interface TimeRangePickerProps {
  value: TimeRange;
  onChange: (range: TimeRange) => void;
}

export function TimeRangePicker({ value, onChange }: TimeRangePickerProps) {
  return (
    <div className="inline-flex items-center border border-gray-200 rounded-md overflow-hidden bg-white">
      {RANGES.map((r, i) => (
        <button
          key={r}
          onClick={() => onChange(r)}
          className={[
            'h-8 px-2.5 text-[11px] transition-colors',
            i > 0 ? 'border-l border-gray-200' : '',
            value === r
              ? 'bg-gray-900 text-white'
              : 'text-gray-500 hover:bg-gray-50 hover:text-gray-800',
          ].join(' ')}
        >
          {r}
        </button>
      ))}
    </div>
  );
}

/** Filter any list of timestamped items to the given time range */
export function filterByTimeRange<T extends { timestamp: string }>(
  items: T[],
  range: TimeRange,
): T[] {
  if (range === 'all') return items;
  const cutoff = Date.now() - TIME_RANGE_MS[range];
  return items.filter((item) => new Date(item.timestamp).getTime() >= cutoff);
}
