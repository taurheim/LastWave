import { useState, useEffect } from 'react';
import { useLastWaveStore } from '@/store/index';
import schemes from '@/core/config/schemes.json';
import easyDates from '@/core/config/easyDates.json';

interface WaveOptionsProps {
  onSubmit: (opts: { dataSourceOptions: Record<string, any>; rendererOptions: Record<string, any> }) => void;
}

const schemeNames = Object.keys(schemes);

const easyDateEntries = Object.entries(easyDates) as unknown as [
  string,
  { offsets: [number, number]; otherOptions: Record<string, string> },
][];

export default function WaveOptions({ onSubmit }: WaveOptionsProps) {
  const dataSourceOptions = useLastWaveStore((s) => s.dataSourceOptions);
  const rendererOptions = useLastWaveStore((s) => s.rendererOptions);
  const setDataSourceOption = useLastWaveStore((s) => s.setDataSourceOption);
  const setRendererOption = useLastWaveStore((s) => s.setRendererOption);

  const [showAdvanced, setShowAdvanced] = useState(false);

  // Auto-detect slow devices and disable animations
  useEffect(() => {
    if (rendererOptions.loading_animation !== undefined) return;
    const cores = navigator.hardwareConcurrency ?? 4;
    const memoryGB = (navigator as any).deviceMemory ?? 4; // Chrome/Edge only, defaults to 4
    if (cores <= 2 || memoryGB <= 2) {
      setRendererOption('loading_animation', false);
    }
  }, []);

  // Initialize defaults on first render if empty
  const username = dataSourceOptions.username ?? '';
  const datePreset = dataSourceOptions._datePreset ?? 'Last 3 months';
  const colorScheme = rendererOptions.color_scheme ?? 'lastwave';

  // Data source advanced defaults
  const timeStart = dataSourceOptions.time_start instanceof Date
    ? dataSourceOptions.time_start.toISOString().slice(0, 10)
    : '';
  const timeEnd = dataSourceOptions.time_end instanceof Date
    ? dataSourceOptions.time_end.toISOString().slice(0, 10)
    : '';
  const groupBy = dataSourceOptions.group_by ?? 'week';
  const method = dataSourceOptions.method ?? 'artist';
  const isCustomDate = datePreset === 'Custom';

  function handleDatePresetChange(presetName: string) {
    setDataSourceOption('_datePreset', presetName);
    if (presetName === 'Custom') return;

    const entry = easyDateEntries.find(([name]) => name === presetName);
    if (!entry) return;
    const [, preset] = entry;
    const now = Date.now();
    const startDate = new Date(now - preset.offsets[0]);
    const endDate = new Date(now - preset.offsets[1]);

    setDataSourceOption('time_start', startDate);
    setDataSourceOption('time_end', endDate);

    Object.entries(preset.otherOptions).forEach(([key, value]) => {
      setDataSourceOption(key, value);
    });
  }

  function handleSubmit(e: React.FormEvent) {
    e.preventDefault();

    // If dates haven't been set yet, apply the default preset
    if (!dataSourceOptions.time_start) {
      handleDatePresetChange(datePreset);
    }

    // Let the parent read options from the store
    const store = useLastWaveStore.getState();
    onSubmit({
      dataSourceOptions: store.dataSourceOptions,
      rendererOptions: store.rendererOptions,
    });
  }

  return (
    <form onSubmit={handleSubmit} className="max-w-2xl mx-auto px-6 py-3 lg:py-6">
      {/* Main Options */}
      <div className="space-y-4 lg:space-y-5 mb-6">
        {/* Username */}
        <div>
          <label className="block text-xs tracking-widest uppercase text-lw-muted mb-2">last.fm username</label>
          <input
            type="search"
            value={username}
            onChange={(e) => setDataSourceOption('username', e.target.value)}
            autoComplete="off"
            data-1p-ignore
            data-lpignore="true"
            data-bwignore
            className="w-full bg-lw-surface border border-lw-border rounded-lg px-4 py-3 text-lg text-center text-lw-text placeholder-lw-muted/50 focus:outline-none focus:border-lw-accent focus:ring-1 focus:ring-lw-accent/30 transition-all [&::-webkit-search-cancel-button]:hidden"
            placeholder="Enter your username"
          />
        </div>

        {/* Date Range + Data Set — sentence style */}
        <div>
          <div className="flex items-baseline justify-center gap-2 flex-wrap">
            <span className="text-lw-muted text-lg lg:text-xl">Graph my</span>
            <span className="relative inline-block">
              <select
                value={datePreset}
                onChange={(e) => handleDatePresetChange(e.target.value)}
                className="appearance-none bg-transparent border-b-2 border-lw-accent/40 text-lw-accent font-medium text-lg lg:text-xl pl-0.5 pr-6 py-0.5 cursor-pointer focus:outline-none focus:border-lw-accent hover:border-lw-accent transition-colors"
              >
                {easyDateEntries.map(([name]) => (
                  <option key={name} value={name} className="bg-lw-bg text-lw-text">{name}</option>
                ))}
                <option value="Custom" className="bg-lw-bg text-lw-text">Custom range</option>
              </select>
              <svg className="pointer-events-none absolute right-0 top-1/2 -translate-y-1/2 w-4 h-4 text-lw-accent/60" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.5}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M19 9l-7 7-7-7" />
              </svg>
            </span>
            <span className="text-lw-muted text-lg lg:text-xl">of</span>
            <span className="relative inline-block">
              <select
                value={method}
                onChange={(e) => setDataSourceOption('method', e.target.value)}
                className="appearance-none bg-transparent border-b-2 border-lw-accent/40 text-lw-accent font-medium text-lg lg:text-xl pl-0.5 pr-6 py-0.5 cursor-pointer focus:outline-none focus:border-lw-accent hover:border-lw-accent transition-colors"
              >
                <option value="artist" className="bg-lw-bg text-lw-text">Artists</option>
                <option value="album" className="bg-lw-bg text-lw-text">Albums</option>
                <option value="tag" className="bg-lw-bg text-lw-text">Genres</option>
              </select>
              <svg className="pointer-events-none absolute right-0 top-1/2 -translate-y-1/2 w-4 h-4 text-lw-accent/60" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.5}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M19 9l-7 7-7-7" />
              </svg>
            </span>
          </div>
          {method === 'tag' && (
            <p className="text-amber-500 text-sm mt-2 text-center">⚠️ Fetching genres is currently very slow due to rate limits. Be prepared to wait a few minutes!</p>
          )}
          {isCustomDate && (
            <div className="grid grid-cols-2 gap-3 mt-4 max-w-xs mx-auto">
              <div>
                <label className="block text-xs text-lw-muted mb-1">Start</label>
                <input
                  type="date"
                  value={timeStart}
                  onChange={(e) => setDataSourceOption('time_start', new Date(e.target.value))}
                  className="w-full bg-lw-surface border border-lw-border rounded-lg px-3 py-2 text-sm text-lw-text focus:outline-none focus:border-lw-accent focus:ring-1 focus:ring-lw-accent/30 transition-all"
                />
              </div>
              <div>
                <label className="block text-xs text-lw-muted mb-1">End</label>
                <input
                  type="date"
                  value={timeEnd}
                  onChange={(e) => setDataSourceOption('time_end', new Date(e.target.value))}
                  className="w-full bg-lw-surface border border-lw-border rounded-lg px-3 py-2 text-sm text-lw-text focus:outline-none focus:border-lw-accent focus:ring-1 focus:ring-lw-accent/30 transition-all"
                />
              </div>
            </div>
          )}
        </div>

        {/* Color Scheme */}
        <div>
          <label className="block text-xs tracking-widest uppercase text-lw-muted mb-3">Theme</label>
          <div className="flex flex-wrap justify-center gap-3">
            {schemeNames.map((name) => {
              const scheme = (schemes as Record<string, any>)[name];
              const isSelected = colorScheme === name;
              return (
                <button
                  key={name}
                  type="button"
                  onClick={() => setRendererOption('color_scheme', name)}
                  className={`group flex flex-col items-center p-2.5 rounded-lg border transition-all duration-200 ${
                    isSelected
                      ? 'border-lw-accent bg-lw-accent/10 shadow-[0_0_12px_rgba(39,170,225,0.15)]'
                      : 'border-lw-border hover:border-lw-muted/50 bg-lw-surface'
                  }`}
                >
                  <div className="rounded overflow-hidden mb-1.5">
                    <img
                      src={`/scheme-previews/${name}.png`}
                      alt={`${name} theme preview`}
                      width={140}
                      height={60}
                      className="block"
                    />
                  </div>
                  <span className={`text-xs ${isSelected ? 'text-lw-accent' : 'text-lw-muted group-hover:text-lw-text'}`}>{name === 'lastwave' ? 'LastWave' : name.charAt(0).toUpperCase() + name.slice(1)}</span>
                </button>
              );
            })}
          </div>
        </div>
      </div>

      {/* Advanced Options Toggle */}
      <div className="text-center mb-6">
        <button
          type="button"
          onClick={() => setShowAdvanced(!showAdvanced)}
          className="text-lw-muted hover:text-lw-accent text-xs tracking-widest uppercase transition-colors"
        >
          Advanced Options {showAdvanced ? '−' : '+'}
        </button>
      </div>

      {/* Advanced Options */}
      {showAdvanced && (
        <div className="mb-8 bg-lw-surface/50 border border-lw-border rounded-xl p-6 max-w-sm mx-auto">
          <div className="space-y-3">
            <div>
              <label className="block text-xs text-lw-muted mb-1">Group by</label>
              <select
                value={groupBy}
                onChange={(e) => setDataSourceOption('group_by', e.target.value)}
                className="w-full bg-lw-bg border border-lw-border rounded-lg px-3 py-2 text-sm text-lw-text focus:outline-none focus:border-lw-accent transition-all"
              >
                {['week', 'month', 'day', 'year'].map((v) => (
                  <option key={v} value={v} className="bg-lw-bg text-lw-text">{v}</option>
                ))}
              </select>
            </div>
            <label className="flex items-center gap-2.5 cursor-pointer group pt-1">
              <input
                type="checkbox"
                checked={rendererOptions.loading_animation ?? true}
                onChange={(e) => setRendererOption('loading_animation', e.target.checked)}
                className="rounded border-lw-border bg-lw-bg accent-lw-accent"
              />
              <span className="text-xs text-lw-muted group-hover:text-lw-text transition-colors">Loading animation</span>
            </label>
          </div>
        </div>
      )}

      {/* Submit */}
      <div className="text-center">
        <button
          type="submit"
          className="relative bg-gradient-to-r from-lw-accent to-lw-cyan text-lw-bg font-semibold rounded-lg px-12 py-3 text-sm tracking-wider uppercase transition-all hover:shadow-[0_0_24px_rgba(39,170,225,0.3)] hover:scale-[1.02] active:scale-[0.98]"
        >
          Generate
        </button>
      </div>
    </form>
  );
}
