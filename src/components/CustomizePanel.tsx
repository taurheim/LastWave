import { useState, useCallback } from 'react';
import { useLastWaveStore } from '@/store/index';

const FALLBACK_FONTS = [
  'DM Sans',
  'Roboto',
  'Arial',
  'Helvetica',
  'Georgia',
  'Times New Roman',
  'Verdana',
  'Courier New',
  'Trebuchet MS',
  'Palatino',
  'Garamond',
  'Comic Sans MS',
  'Impact',
  'Futura',
  'Gill Sans',
];

function useLazyFontList() {
  const [fonts, setFonts] = useState<string[]>(FALLBACK_FONTS);
  const [fetched, setFetched] = useState(false);

  const fetchFonts = useCallback(() => {
    if (fetched) return;
    setFetched(true);
    if ('queryLocalFonts' in window) {
      const queryLocalFonts = (
        window as Window & { queryLocalFonts: () => Promise<Array<{ family: string }>> }
      ).queryLocalFonts;
      queryLocalFonts()
        .then((localFonts) => {
          const families = [...new Set(localFonts.map((f) => f.family))].sort((a, b) =>
            a.localeCompare(b),
          );
          if (families.length > 0) setFonts(families);
        })
        .catch(() => {});
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
  const height = rendererOptions.height ?? '550';
  const offset = rendererOptions.offset ?? 'silhouette';
  const font = rendererOptions.font ?? 'DM Sans';
  const addLabels = rendererOptions.add_labels ?? true;
  const addMonths = rendererOptions.add_months ?? true;
  const addYears = rendererOptions.add_years ?? false;
  const showUsername = rendererOptions.show_username ?? false;
  const showWatermark = rendererOptions.show_watermark ?? true;
  const deformText = rendererOptions.deform_text ?? true;
  const jitterText = rendererOptions.jitter_text ?? true;

  const { fonts: fontList, fetchFonts, fetched: fontsLoaded } = useLazyFontList();
  const displayFonts = fontList.includes(font) ? fontList : [font, ...fontList];

  return (
    <div className="px-6 py-4 sm:px-3 sm:py-2 lg:px-6 lg:py-4">
      <div className="space-y-6 rounded-xl border border-lw-border bg-lw-surface/50 p-6 sm:space-y-4 sm:p-4 lg:space-y-6 lg:p-6">
        {/* Top controls */}
        <div className="space-y-4 sm:space-y-3 lg:space-y-4">
          <div>
            <div className="mb-2 flex items-baseline justify-between sm:mb-1 lg:mb-2">
              <label htmlFor="min-plays" className="text-sm font-medium text-lw-text">
                Minimum plays
              </label>
              <span className="text-lg font-semibold tabular-nums text-lw-accent sm:text-base lg:text-lg">
                {minPlays}
              </span>
            </div>
            <div className="flex items-center gap-2">
              <button
                onClick={() => setDataSourceOption('min_plays', String(Math.max(1, minPlays - 1)))}
                disabled={minPlays <= 1}
                className="flex h-6 w-6 shrink-0 items-center justify-center rounded border border-lw-border bg-lw-bg text-sm text-lw-muted transition-all hover:border-lw-accent hover:text-lw-text disabled:cursor-not-allowed disabled:opacity-30"
              >
                −
              </button>
              <input
                id="min-plays"
                type="range"
                min={1}
                max={maxPlays}
                value={minPlays}
                onChange={(e) => setDataSourceOption('min_plays', e.target.value)}
                className="h-2 w-full cursor-pointer accent-lw-accent"
              />
              <button
                onClick={() =>
                  setDataSourceOption('min_plays', String(Math.min(maxPlays, minPlays + 1)))
                }
                disabled={minPlays >= maxPlays}
                className="flex h-6 w-6 shrink-0 items-center justify-center rounded border border-lw-border bg-lw-bg text-sm text-lw-muted transition-all hover:border-lw-accent hover:text-lw-text disabled:cursor-not-allowed disabled:opacity-30"
              >
                +
              </button>
            </div>
          </div>
          <div>
            <label
              htmlFor="graph-type"
              className="mb-2 block text-sm font-medium text-lw-text sm:mb-1 lg:mb-2"
            >
              Graph type
            </label>
            <select
              id="graph-type"
              value={offset}
              onChange={(e) => setRendererOption('offset', e.target.value)}
              className="w-full rounded-lg border border-lw-border bg-lw-bg px-3 py-2 text-sm text-lw-text transition-all focus:border-lw-accent focus:outline-none sm:py-1.5 lg:py-2"
            >
              {['silhouette', 'wiggle', 'expand', 'zero'].map((v) => (
                <option key={v} value={v}>
                  {v}
                </option>
              ))}
            </select>
          </div>
        </div>

        <div className="h-px w-full bg-lw-border" />

        <div className="grid grid-cols-1 gap-8 sm:gap-4 lg:grid-cols-2 lg:gap-8">
          {/* Options */}
          <div>
            <h3 className="mb-4 text-xs uppercase tracking-widest text-lw-accent sm:mb-2 lg:mb-4">
              Options
            </h3>
            <div className="space-y-3 sm:space-y-1.5 lg:space-y-3">
              {[
                { label: 'Deform text', checked: deformText, key: 'deform_text' },
                { label: 'Jitter text', checked: jitterText, key: 'jitter_text' },
                { label: 'Username', checked: showUsername, key: 'show_username' },
                { label: 'Month names', checked: addMonths, key: 'add_months' },
                { label: 'Year names', checked: addYears, key: 'add_years' },
                { label: 'Watermark', checked: showWatermark, key: 'show_watermark' },
                { label: 'Artist / album / tag names', checked: addLabels, key: 'add_labels' },
              ].map((opt) => (
                <label key={opt.key} className="group flex cursor-pointer items-center gap-2.5">
                  <input
                    type="checkbox"
                    checked={opt.checked}
                    onChange={(e) => setRendererOption(opt.key, e.target.checked)}
                    className="rounded border-lw-border bg-lw-bg accent-lw-accent"
                  />
                  <span className="text-xs text-lw-muted transition-colors group-hover:text-lw-text">
                    {opt.label}
                  </span>
                </label>
              ))}
            </div>
          </div>

          {/* Image */}
          <div>
            <h3 className="mb-4 text-xs uppercase tracking-widest text-lw-accent sm:mb-2 lg:mb-4">
              Image
            </h3>
            <div className="space-y-3 sm:space-y-2 lg:space-y-3">
              <div>
                <label htmlFor="img-width" className="mb-1 block text-xs text-lw-muted">
                  Width
                </label>
                <input
                  id="img-width"
                  type="text"
                  value={width}
                  onChange={(e) => setRendererOption('width', e.target.value)}
                  placeholder="auto"
                  className="w-full rounded-lg border border-lw-border bg-lw-bg px-3 py-2 text-sm text-lw-text placeholder-lw-muted/40 transition-all focus:border-lw-accent focus:outline-none sm:py-1.5 lg:py-2"
                />
              </div>
              <div>
                <label htmlFor="img-height" className="mb-1 block text-xs text-lw-muted">
                  Height
                </label>
                <input
                  id="img-height"
                  type="text"
                  value={height}
                  onChange={(e) => setRendererOption('height', e.target.value)}
                  className="w-full rounded-lg border border-lw-border bg-lw-bg px-3 py-2 text-sm text-lw-text transition-all focus:border-lw-accent focus:outline-none sm:py-1.5 lg:py-2"
                />
              </div>
              <div>
                <label htmlFor="font-picker" className="mb-1 block text-xs text-lw-muted">
                  Font
                </label>
                {fontsLoaded ? (
                  <select
                    value={font}
                    onChange={(e) => setRendererOption('font', e.target.value)}
                    className="w-full rounded-lg border border-lw-border bg-lw-bg px-3 py-2 text-sm text-lw-text transition-all focus:border-lw-accent focus:outline-none sm:py-1.5 lg:py-2"
                  >
                    {displayFonts.map((f) => (
                      <option key={f} value={f} style={{ fontFamily: f }}>
                        {f}
                      </option>
                    ))}
                  </select>
                ) : (
                  <button
                    onClick={fetchFonts}
                    className="text-xs text-lw-accent transition-colors hover:text-lw-text"
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
