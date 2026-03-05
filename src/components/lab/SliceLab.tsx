import { useState, useCallback } from 'react';
import SliceCard from './SliceCard';
import { sliceData } from './sliceData';

type LabelStatus = 'ok' | 'overflow' | 'hidden';

export default function SliceLab() {
  const [showStraightLines, setShowStraightLines] = useState(true);
  const [showBezier, setShowBezier] = useState(true);
  const [filter, setFilter] = useState<string>('all');
  const [statuses, setStatuses] = useState<Record<string, LabelStatus>>({});

  const handleStatus = useCallback((id: string, status: LabelStatus) => {
    setStatuses(prev => prev[id] === status ? prev : { ...prev, [id]: status });
  }, []);

  let filtered = sliceData;
  if (filter === 'overflow') {
    filtered = sliceData.filter(s => statuses[s.id] === 'overflow');
  } else if (filter === 'hidden') {
    filtered = sliceData.filter(s => statuses[s.id] === 'hidden');
  } else if (filter !== 'all') {
    filtered = sliceData.filter(s => s.id.startsWith(filter));
  }

  const overflowCount = Object.values(statuses).filter(s => s === 'overflow').length;
  const hiddenCount = Object.values(statuses).filter(s => s === 'hidden').length;

  return (
    <div className="max-w-[1400px] mx-auto px-4 py-6">
      {/* Controls */}
      <div className="flex flex-wrap items-center justify-between gap-4 mb-8 bg-lw-surface/50 border border-lw-border rounded-xl p-4">
        <div className="flex items-center gap-6">
          <label className="flex items-center gap-2 cursor-pointer group">
            <input
              type="checkbox"
              checked={showBezier}
              onChange={(e) => setShowBezier(e.target.checked)}
              className="rounded border-lw-border bg-lw-bg accent-lw-accent"
            />
            <span className="text-xs text-lw-muted group-hover:text-lw-text transition-colors">
              Bezier curves (actual)
            </span>
          </label>
          <label className="flex items-center gap-2 cursor-pointer group">
            <input
              type="checkbox"
              checked={showStraightLines}
              onChange={(e) => setShowStraightLines(e.target.checked)}
              className="rounded border-lw-border bg-lw-bg accent-lw-accent"
            />
            <span className="text-xs text-lw-muted group-hover:text-lw-text transition-colors">
              Straight lines (algorithm model)
            </span>
          </label>
        </div>

        <div className="flex items-center gap-2">
          <span className="text-xs text-lw-muted">Filter:</span>
          {[
            { value: 'all', label: 'All' },
            { value: 'overflow', label: `⚠ Overflow (${overflowCount})` },
            { value: 'hidden', label: `Hidden (${hiddenCount})` },
            { value: 'z', label: 'Z' },
            { value: 'w', label: 'W' },
            { value: 'x', label: 'X' },
            { value: 'y', label: 'Y' },
            { value: 'e', label: 'Edge' },
            { value: 'real', label: 'Real' },
            { value: 'scan', label: 'Scanned' },
          ].map(({ value, label }) => (
            <button
              key={value}
              onClick={() => setFilter(value)}
              className={`px-3 py-1 text-xs rounded-lg border transition-all ${
                filter === value
                  ? 'border-lw-accent text-lw-accent bg-lw-accent/10'
                  : 'border-lw-border text-lw-muted hover:text-lw-text hover:border-lw-muted'
              }`}
            >
              {label}
            </button>
          ))}
          <span className="text-xs text-lw-muted/50 ml-2">{filtered.length} slices</span>
        </div>
      </div>

      {/* Legend */}
      <div className="flex items-center gap-6 mb-6 text-[10px] text-lw-muted/60">
        <span>Dashed lines:</span>
        <span className="flex items-center gap-1">
          <span className="inline-block w-3 h-0.5 bg-red-400"></span> A (topLeft→top)
        </span>
        <span className="flex items-center gap-1">
          <span className="inline-block w-3 h-0.5 bg-amber-400"></span> B (top→topRight)
        </span>
        <span className="flex items-center gap-1">
          <span className="inline-block w-3 h-0.5 bg-green-400"></span> C (bottomLeft→bottom)
        </span>
        <span className="flex items-center gap-1">
          <span className="inline-block w-3 h-0.5 bg-violet-400"></span> D (bottom→bottomRight)
        </span>
      </div>

      {/* Grid */}
      <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-4">
        {filtered.map(slice => (
          <SliceCard
            key={slice.id}
            slice={slice}
            showStraightLines={showStraightLines}
            showBezier={showBezier}
            onStatus={handleStatus}
          />
        ))}
      </div>
    </div>
  );
}
