import { useState, useEffect } from 'react';
import { useLastWaveStore } from '@/store/index';

const FALLBACK_FONTS = [
  'DM Sans', 'Roboto', 'Arial', 'Helvetica', 'Georgia', 'Times New Roman',
  'Verdana', 'Courier New', 'Trebuchet MS', 'Palatino', 'Garamond',
  'Comic Sans MS', 'Impact', 'Futura', 'Gill Sans',
];

function useFontList() {
  const [fonts, setFonts] = useState<string[]>(FALLBACK_FONTS);

  useEffect(() => {
    if ('queryLocalFonts' in window) {
      (window as any).queryLocalFonts().then((localFonts: any[]) => {
        const families = [...new Set(localFonts.map((f: any) => f.family))].sort(
          (a, b) => a.localeCompare(b),
        );
        if (families.length > 0) setFonts(families);
      }).catch(() => {});
    }
  }, []);

  return fonts;
}

export default function CustomizePanel({ maxPlays }: { maxPlays: number }) {
  const dataSourceOptions = useLastWaveStore((s) => s.dataSourceOptions);
  const rendererOptions = useLastWaveStore((s) => s.rendererOptions);
  const setDataSourceOption = useLastWaveStore((s) => s.setDataSourceOption);
  const setRendererOption = useLastWaveStore((s) => s.setRendererOption);

  const minPlays = parseInt(dataSourceOptions.min_plays ?? '10', 10) || 1;
  const useLocalStorage = dataSourceOptions.use_localstorage ?? true;

  const width = rendererOptions.width ?? '';
  const height = rendererOptions.height ?? '600';
  const offset = rendererOptions.offset ?? 'silhouette';
  const font = rendererOptions.font ?? 'DM Sans';
  const stroke = rendererOptions.stroke ?? true;
  const addLabels = rendererOptions.add_labels ?? true;
  const addMonths = rendererOptions.add_months ?? true;
  const addYears = rendererOptions.add_years ?? false;
  const showUsername = rendererOptions.show_username ?? true;

  const fontList = useFontList();
  const [customFont, setCustomFont] = useState(!fontList.includes(font));

  return (
    <div className="max-w-2xl mx-auto px-6 py-4">
      <div className="bg-lw-surface/50 border border-lw-border rounded-xl p-6 space-y-6">
        {/* Top controls — full width */}
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <div>
            <div className="flex items-baseline justify-between mb-2">
              <label className="text-sm text-lw-text font-medium">Minimum plays</label>
              <span className="text-lg font-semibold text-lw-accent tabular-nums">{minPlays}</span>
            </div>
            <input
              type="range"
              min={1}
              max={maxPlays}
              value={minPlays}
              onChange={(e) => setDataSourceOption('min_plays', e.target.value)}
              className="w-full h-2 accent-lw-accent cursor-pointer"
            />
          </div>
          <div>
            <label className="block text-sm text-lw-text font-medium mb-2">Graph type</label>
            <select
              value={offset}
              onChange={(e) => setRendererOption('offset', e.target.value)}
              className="w-full bg-lw-bg border border-lw-border rounded-lg px-3 py-2 text-sm text-lw-text focus:outline-none focus:border-lw-accent transition-all"
            >
              {['silhouette', 'wiggle', 'expand', 'zero'].map((v) => (
                <option key={v} value={v}>{v}</option>
              ))}
            </select>
          </div>
        </div>

        <div className="w-full h-px bg-lw-border" />

        <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
          {/* Labels */}
          <div>
            <h3 className="text-xs tracking-widest uppercase text-lw-accent mb-4">Labels</h3>
            <div className="space-y-3">
              {[
                { label: 'Artist / album / tag names', checked: addLabels, key: 'add_labels' },
                { label: 'Month names', checked: addMonths, key: 'add_months' },
                { label: 'Year names', checked: addYears, key: 'add_years' },
                { label: 'Username', checked: showUsername, key: 'show_username' },
                { label: 'Ripple border', checked: stroke, key: 'stroke' },
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

          {/* Image */}
          <div>
            <h3 className="text-xs tracking-widest uppercase text-lw-accent mb-4">Image</h3>
            <div className="space-y-3">
              <div>
                <label className="block text-xs text-lw-muted mb-1">Width</label>
                <input
                  type="text"
                  value={width}
                  onChange={(e) => setRendererOption('width', e.target.value)}
                  placeholder="auto"
                  className="w-full bg-lw-bg border border-lw-border rounded-lg px-3 py-2 text-sm text-lw-text placeholder-lw-muted/40 focus:outline-none focus:border-lw-accent transition-all"
                />
              </div>
              <div>
                <label className="block text-xs text-lw-muted mb-1">Height</label>
                <input
                  type="text"
                  value={height}
                  onChange={(e) => setRendererOption('height', e.target.value)}
                  className="w-full bg-lw-bg border border-lw-border rounded-lg px-3 py-2 text-sm text-lw-text focus:outline-none focus:border-lw-accent transition-all"
                />
              </div>
              <div>
                <label className="block text-xs text-lw-muted mb-1">Font</label>
                {customFont ? (
                  <div className="flex gap-2">
                    <input
                      type="text"
                      value={font}
                      onChange={(e) => setRendererOption('font', e.target.value)}
                      placeholder="Font family name"
                      className="flex-1 bg-lw-bg border border-lw-border rounded-lg px-3 py-2 text-sm text-lw-text placeholder-lw-muted/40 focus:outline-none focus:border-lw-accent transition-all"
                    />
                    <button
                      onClick={() => { setCustomFont(false); setRendererOption('font', fontList[0]); }}
                      className="text-xs text-lw-muted hover:text-lw-accent transition-colors px-2"
                      title="Switch to font picker"
                    >
                      ← List
                    </button>
                  </div>
                ) : (
                  <div className="flex gap-2">
                    <select
                      value={fontList.includes(font) ? font : ''}
                      onChange={(e) => setRendererOption('font', e.target.value)}
                      className="flex-1 bg-lw-bg border border-lw-border rounded-lg px-3 py-2 text-sm text-lw-text focus:outline-none focus:border-lw-accent transition-all"
                    >
                      {fontList.map((f) => (
                        <option key={f} value={f} style={{ fontFamily: f }}>{f}</option>
                      ))}
                    </select>
                    <button
                      onClick={() => setCustomFont(true)}
                      className="text-xs text-lw-muted hover:text-lw-accent transition-colors px-2"
                      title="Type a custom font name"
                    >
                      Custom
                    </button>
                  </div>
                )}
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
