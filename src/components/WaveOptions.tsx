import { useState } from 'react';
import { useLastWaveStore } from '@/store/index';
import schemes from '@/core/config/schemes.json';
import easyDates from '@/core/config/easyDates.json';
import SchemePreview from './SchemePreview';

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
  const minPlays = dataSourceOptions.min_plays ?? '10';
  const method = dataSourceOptions.method ?? 'artist';
  const useLocalStorage = dataSourceOptions.use_localstorage ?? true;

  // Renderer advanced defaults
  const width = rendererOptions.width ?? '';
  const height = rendererOptions.height ?? '600';
  const offset = rendererOptions.offset ?? 'silhouette';
  const font = rendererOptions.font ?? 'DM Sans';
  const stroke = rendererOptions.stroke ?? true;
  const addLabels = rendererOptions.add_labels ?? true;
  const addMonths = rendererOptions.add_months ?? true;
  const addYears = rendererOptions.add_years ?? false;

  function applyDatePreset(presetName: string) {
    const entry = easyDateEntries.find(([name]) => name === presetName);
    if (!entry) return;
    const [, preset] = entry;
    const now = Date.now();
    const startDate = new Date(now - preset.offsets[0]);
    const endDate = new Date(now - preset.offsets[1]);

    setDataSourceOption('_datePreset', presetName);
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
      applyDatePreset(datePreset);
    }

    // Let the parent read options from the store
    const store = useLastWaveStore.getState();
    onSubmit({
      dataSourceOptions: store.dataSourceOptions,
      rendererOptions: store.rendererOptions,
    });
  }

  return (
    <form onSubmit={handleSubmit} className="max-w-2xl mx-auto px-6 py-8">
      {/* Main Options */}
      <div className="space-y-6 mb-8">
        {/* Username */}
        <div>
          <label className="block text-xs tracking-widest uppercase text-lw-muted mb-2">last.fm username</label>
          <input
            type="text"
            value={username}
            onChange={(e) => setDataSourceOption('username', e.target.value)}
            className="w-full bg-lw-surface border border-lw-border rounded-lg px-4 py-3 text-lg text-center text-white placeholder-lw-muted/50 focus:outline-none focus:border-lw-accent focus:ring-1 focus:ring-lw-accent/30 transition-all"
            placeholder="Enter your username"
          />
        </div>

        {/* Date Range Preset */}
        <div>
          <label className="block text-xs tracking-widest uppercase text-lw-muted mb-2">Date range</label>
          <select
            value={datePreset}
            onChange={(e) => applyDatePreset(e.target.value)}
            className="w-full bg-lw-surface border border-lw-border rounded-lg px-4 py-3 text-white focus:outline-none focus:border-lw-accent focus:ring-1 focus:ring-lw-accent/30 transition-all appearance-none cursor-pointer"
          >
            {easyDateEntries.map(([name]) => (
              <option key={name} value={name}>{name}</option>
            ))}
          </select>
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
                    <SchemePreview
                      colors={scheme.schemeColors}
                      bgColor={scheme.backgroundColor}
                      width={100}
                      height={40}
                    />
                  </div>
                  <span className={`text-xs capitalize ${isSelected ? 'text-lw-accent' : 'text-lw-muted group-hover:text-lw-text'}`}>{name}</span>
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
        <div className="grid grid-cols-1 md:grid-cols-2 gap-8 mb-8 bg-lw-surface/50 border border-lw-border rounded-xl p-6">
          {/* Data Source Options */}
          <div>
            <h3 className="text-xs tracking-widest uppercase text-lw-accent mb-4">Data Source</h3>
            <div className="space-y-3">
              <div>
                <label className="block text-xs text-lw-muted mb-1">Timespan start</label>
                <input
                  type="date"
                  value={timeStart}
                  onChange={(e) => setDataSourceOption('time_start', new Date(e.target.value))}
                  className="w-full bg-lw-bg border border-lw-border rounded-lg px-3 py-2 text-sm text-white focus:outline-none focus:border-lw-accent transition-all"
                />
              </div>
              <div>
                <label className="block text-xs text-lw-muted mb-1">Timespan end</label>
                <input
                  type="date"
                  value={timeEnd}
                  onChange={(e) => setDataSourceOption('time_end', new Date(e.target.value))}
                  className="w-full bg-lw-bg border border-lw-border rounded-lg px-3 py-2 text-sm text-white focus:outline-none focus:border-lw-accent transition-all"
                />
              </div>
              <div>
                <label className="block text-xs text-lw-muted mb-1">Group by</label>
                <select
                  value={groupBy}
                  onChange={(e) => setDataSourceOption('group_by', e.target.value)}
                  className="w-full bg-lw-bg border border-lw-border rounded-lg px-3 py-2 text-sm text-white focus:outline-none focus:border-lw-accent transition-all"
                >
                  {['week', 'month', 'day', 'year'].map((v) => (
                    <option key={v} value={v}>{v}</option>
                  ))}
                </select>
              </div>
              <div>
                <label className="block text-xs text-lw-muted mb-1">Minimum Plays</label>
                <input
                  type="text"
                  value={minPlays}
                  onChange={(e) => setDataSourceOption('min_plays', e.target.value)}
                  className="w-full bg-lw-bg border border-lw-border rounded-lg px-3 py-2 text-sm text-white focus:outline-none focus:border-lw-accent transition-all"
                />
              </div>
              <div>
                <label className="block text-xs text-lw-muted mb-1">Data set</label>
                <select
                  value={method}
                  onChange={(e) => setDataSourceOption('method', e.target.value)}
                  className="w-full bg-lw-bg border border-lw-border rounded-lg px-3 py-2 text-sm text-white focus:outline-none focus:border-lw-accent transition-all"
                >
                  {['artist', 'album', 'tag'].map((v) => (
                    <option key={v} value={v}>{v}</option>
                  ))}
                </select>
              </div>
              <label className="flex items-center gap-2.5 cursor-pointer group">
                <input
                  type="checkbox"
                  checked={useLocalStorage}
                  onChange={(e) => setDataSourceOption('use_localstorage', e.target.checked)}
                  className="rounded border-lw-border bg-lw-bg accent-lw-accent"
                />
                <span className="text-xs text-lw-muted group-hover:text-lw-text transition-colors">Cache last.fm tag responses</span>
              </label>
            </div>
          </div>

          {/* Renderer Options */}
          <div>
            <h3 className="text-xs tracking-widest uppercase text-lw-accent mb-4">Renderer</h3>
            <div className="space-y-3">
              <div>
                <label className="block text-xs text-lw-muted mb-1">Graph width</label>
                <input
                  type="text"
                  value={width}
                  onChange={(e) => setRendererOption('width', e.target.value)}
                  placeholder="auto"
                  className="w-full bg-lw-bg border border-lw-border rounded-lg px-3 py-2 text-sm text-white placeholder-lw-muted/40 focus:outline-none focus:border-lw-accent transition-all"
                />
              </div>
              <div>
                <label className="block text-xs text-lw-muted mb-1">Graph height</label>
                <input
                  type="text"
                  value={height}
                  onChange={(e) => setRendererOption('height', e.target.value)}
                  className="w-full bg-lw-bg border border-lw-border rounded-lg px-3 py-2 text-sm text-white focus:outline-none focus:border-lw-accent transition-all"
                />
              </div>
              <div>
                <label className="block text-xs text-lw-muted mb-1">Graph type</label>
                <select
                  value={offset}
                  onChange={(e) => setRendererOption('offset', e.target.value)}
                  className="w-full bg-lw-bg border border-lw-border rounded-lg px-3 py-2 text-sm text-white focus:outline-none focus:border-lw-accent transition-all"
                >
                  {['silhouette', 'wiggle', 'expand', 'zero'].map((v) => (
                    <option key={v} value={v}>{v}</option>
                  ))}
                </select>
              </div>
              <div>
                <label className="block text-xs text-lw-muted mb-1">Font</label>
                <input
                  type="text"
                  value={font}
                  onChange={(e) => setRendererOption('font', e.target.value)}
                  className="w-full bg-lw-bg border border-lw-border rounded-lg px-3 py-2 text-sm text-white focus:outline-none focus:border-lw-accent transition-all"
                />
              </div>
              {[
                { label: 'Ripple border', checked: stroke, key: 'stroke' },
                { label: 'Artist / album / tag names', checked: addLabels, key: 'add_labels' },
                { label: 'Month names', checked: addMonths, key: 'add_months' },
                { label: 'Year names', checked: addYears, key: 'add_years' },
              ].map((opt) => (
                <label key={opt.key} className="flex items-center gap-2.5 cursor-pointer group">
                  <input
                    type="checkbox"
                    checked={opt.checked}
                    onChange={(e) => setRendererOption(opt.key, e.target.checked)}
                    className="rounded border-lw-border bg-lw-bg accent-lw-accent"
                  />
                  <span className="text-xs text-lw-muted group-hover:text-lw-text transition-colors">{opt.label}</span>
                </label>
              ))}
            </div>
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
