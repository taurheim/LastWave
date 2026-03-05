import { useLastWaveStore } from '@/store/index';

export default function CustomizePanel() {
  const dataSourceOptions = useLastWaveStore((s) => s.dataSourceOptions);
  const rendererOptions = useLastWaveStore((s) => s.rendererOptions);
  const setDataSourceOption = useLastWaveStore((s) => s.setDataSourceOption);
  const setRendererOption = useLastWaveStore((s) => s.setRendererOption);

  const minPlays = dataSourceOptions.min_plays ?? '10';
  const useLocalStorage = dataSourceOptions.use_localstorage ?? true;

  const width = rendererOptions.width ?? '';
  const height = rendererOptions.height ?? '600';
  const offset = rendererOptions.offset ?? 'silhouette';
  const font = rendererOptions.font ?? 'DM Sans';
  const stroke = rendererOptions.stroke ?? true;
  const addLabels = rendererOptions.add_labels ?? true;
  const addMonths = rendererOptions.add_months ?? true;
  const addYears = rendererOptions.add_years ?? false;

  return (
    <div className="max-w-2xl mx-auto px-6 py-4">
      <div className="grid grid-cols-1 md:grid-cols-2 gap-8 bg-lw-surface/50 border border-lw-border rounded-xl p-6">
        {/* Appearance */}
        <div>
          <h3 className="text-xs tracking-widest uppercase text-lw-accent mb-4">Appearance</h3>
          <div className="space-y-3">
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

        {/* Size & Data */}
        <div>
          <h3 className="text-xs tracking-widest uppercase text-lw-accent mb-4">Size &amp; Data</h3>
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
              <label className="block text-xs text-lw-muted mb-1">Minimum plays</label>
              <input
                type="text"
                value={minPlays}
                onChange={(e) => setDataSourceOption('min_plays', e.target.value)}
                className="w-full bg-lw-bg border border-lw-border rounded-lg px-3 py-2 text-sm text-white focus:outline-none focus:border-lw-accent transition-all"
              />
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
      </div>
    </div>
  );
}
