import { useState, useCallback } from 'react';
import { useLastWaveStore } from '@/store/index';

const FALLBACK_FONTS = [
  'DM Sans', 'Roboto', 'Arial', 'Helvetica', 'Georgia', 'Times New Roman',
  'Verdana', 'Courier New', 'Trebuchet MS', 'Palatino', 'Garamond',
  'Comic Sans MS', 'Impact', 'Futura', 'Gill Sans',
];

function useLazyFontList() {
  const [fonts, setFonts] = useState<string[]>(FALLBACK_FONTS);
  const [fetched, setFetched] = useState(false);

  const fetchFonts = useCallback(() => {
    if (fetched) return;
    setFetched(true);
    if ('queryLocalFonts' in window) {
      (window as any).queryLocalFonts().then((localFonts: any[]) => {
        const families = [...new Set(localFonts.map((f: any) => f.family))].sort(
          (a, b) => a.localeCompare(b),
        );
        if (families.length > 0) setFonts(families);
      }).catch(() => {});
    }
  }, [fetched]);

  return { fonts, fetchFonts, fetched };
}

export default function CustomizePanel({ maxPlays }: { maxPlays: number }) {
  const dataSourceOptions = useLastWaveStore((s) => s.dataSourceOptions);
  const rendererOptions = useLastWaveStore((s) => s.rendererOptions);
  const setDataSourceOption = useLastWaveStore((s) => s.setDataSourceOption);
  const setRendererOption = useLastWaveStore((s) => s.setRendererOption);

  const minPlays = parseInt(dataSourceOptions.min_plays ?? '10', 10) || 1;

  const width = rendererOptions.width ?? '';
  const height = rendererOptions.height ?? '600';
  const offset = rendererOptions.offset ?? 'silhouette';
  const font = rendererOptions.font ?? 'DM Sans';
  const stroke = rendererOptions.stroke ?? true;
  const addLabels = rendererOptions.add_labels ?? true;
  const addMonths = rendererOptions.add_months ?? true;
  const addYears = rendererOptions.add_years ?? false;
  const showUsername = rendererOptions.show_username ?? false;
  const showWatermark = rendererOptions.show_watermark ?? true;

  const { fonts: fontList, fetchFonts, fetched: fontsLoaded } = useLazyFontList();
  const displayFonts = fontList.includes(font) ? fontList : [font, ...fontList];

  return (
    <div className="max-w-2xl mx-auto px-6 py-4">
      <div className="bg-lw-surface/50 border border-lw-border rounded-xl p-6 space-y-6">
        {/* Top controls — full width, stacked */}
        <div className="space-y-4">
          <div>
            <div className="flex items-baseline justify-between mb-2">
              <label className="text-sm text-lw-text font-medium">Minimum plays</label>
              <span className="text-lg font-semibold text-lw-accent tabular-nums">{minPlays}</span>
            </div>
            <div className="flex items-center gap-2">
              <button
                onClick={() => setDataSourceOption('min_plays', String(Math.max(1, minPlays - 1)))}
                disabled={minPlays <= 1}
                className="w-6 h-6 flex items-center justify-center rounded bg-lw-bg border border-lw-border text-lw-muted hover:text-lw-text hover:border-lw-accent disabled:opacity-30 disabled:cursor-not-allowed transition-all text-sm shrink-0"
              >
                −
              </button>
              <input
                type="range"
                min={1}
                max={maxPlays}
                value={minPlays}
                onChange={(e) => setDataSourceOption('min_plays', e.target.value)}
                className="w-full h-2 accent-lw-accent cursor-pointer"
              />
              <button
                onClick={() => setDataSourceOption('min_plays', String(Math.min(maxPlays, minPlays + 1)))}
                disabled={minPlays >= maxPlays}
                className="w-6 h-6 flex items-center justify-center rounded bg-lw-bg border border-lw-border text-lw-muted hover:text-lw-text hover:border-lw-accent disabled:opacity-30 disabled:cursor-not-allowed transition-all text-sm shrink-0"
              >
                +
              </button>
            </div>
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
          {/* Options */}
          <div>
            <h3 className="text-xs tracking-widest uppercase text-lw-accent mb-4">Options</h3>
            <div className="space-y-3">
              {[
                { label: 'Username', checked: showUsername, key: 'show_username' },
                { label: 'Ripple border', checked: stroke, key: 'stroke' },
                { label: 'Month names', checked: addMonths, key: 'add_months' },
                { label: 'Year names', checked: addYears, key: 'add_years' },
                { label: 'Watermark', checked: showWatermark, key: 'show_watermark' },
                { label: 'Artist / album / tag names', checked: addLabels, key: 'add_labels' },
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
                {fontsLoaded ? (
                  <select
                    value={font}
                    onChange={(e) => setRendererOption('font', e.target.value)}
                    className="w-full bg-lw-bg border border-lw-border rounded-lg px-3 py-2 text-sm text-lw-text focus:outline-none focus:border-lw-accent transition-all"
                  >
                    {displayFonts.map((f) => (
                      <option key={f} value={f} style={{ fontFamily: f }}>{f}</option>
                    ))}
                  </select>
                ) : (
                  <button
                    onClick={fetchFonts}
                    className="text-xs text-lw-accent hover:text-lw-text transition-colors"
                  >
                    Load available fonts
                  </button>
                )}
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
