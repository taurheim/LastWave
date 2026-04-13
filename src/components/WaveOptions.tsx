import { useState, useEffect, useRef } from 'react';
import { useLastWaveStore, type ColorScheme, type DataSourceOptions, type RendererOptions, type ServiceType } from '@/store/index';
import SpotifyModal from './SpotifyModal';
import schemes from '@/core/config/schemes.json';
import easyDates from '@/core/config/easyDates.json';

interface WaveOptionsProps {
  onSubmit: (opts: {
    dataSourceOptions: DataSourceOptions;
    rendererOptions: RendererOptions;
  }) => void;
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
  const [serviceDropdownOpen, setServiceDropdownOpen] = useState(false);
  const [spotifyModalOpen, setSpotifyModalOpen] = useState(false);
  const serviceDropdownRef = useRef<HTMLDivElement>(null);

  const service: ServiceType = dataSourceOptions.service ?? 'lastfm';

  useEffect(() => {
    const saved = localStorage.getItem('lastwave:service') as ServiceType | null;
    if (saved === 'lastfm' || saved === 'listenbrainz') {
      setDataSourceOption('service', saved);
    }
  }, []);

  useEffect(() => {
    function handleClickOutside(e: MouseEvent) {
      if (serviceDropdownRef.current && !serviceDropdownRef.current.contains(e.target as Node)) {
        setServiceDropdownOpen(false);
      }
    }
    if (serviceDropdownOpen) {
      document.addEventListener('mousedown', handleClickOutside);
      return () => document.removeEventListener('mousedown', handleClickOutside);
    }
  }, [serviceDropdownOpen]);

  function handleServiceChange(s: ServiceType) {
    setDataSourceOption('service', s);
    localStorage.setItem('lastwave:service', s);
    setServiceDropdownOpen(false);
  }

  // Auto-detect slow devices and disable animations; set default color scheme
  useEffect(() => {
    if (rendererOptions.loading_animation !== undefined) return;
    const cores = navigator.hardwareConcurrency ?? 4;
    const memoryGB = (navigator as unknown as { deviceMemory?: number }).deviceMemory ?? 4; // Chrome/Edge only, defaults to 4
    if (cores <= 2 || memoryGB <= 2) {
      setRendererOption('loading_animation', false);
    }
  }, []);
  useEffect(() => {
    if (!rendererOptions.color_scheme) {
      setRendererOption('color_scheme', 'mosaic');
    }
  }, []);

  // Initialize defaults on first render if empty
  const username = dataSourceOptions.username ?? '';
  const datePreset = dataSourceOptions._datePreset ?? 'Last 3 months';
  const colorScheme = rendererOptions.color_scheme ?? 'mosaic';

  // Apply theme background color and decorative wave colors
  useEffect(() => {
    const schemeName = colorScheme as keyof typeof schemes;
    const scheme = (schemes as Record<string, ColorScheme>)[schemeName];
    if (!scheme) return;

    const bgColor = scheme.backgroundColorLight ?? scheme.backgroundColor;
    document.documentElement.style.setProperty('--lw-body-bg', bgColor);

    const waveSvg = document.getElementById('decorative-bg-waves');
    if (waveSvg && scheme.bgWaveColors) {
      const paths = waveSvg.querySelectorAll('path');
      scheme.bgWaveColors.forEach((color, i) => {
        if (paths[i]) paths[i].setAttribute('fill', color);
      });
    }
  }, [colorScheme]);

  // Data source advanced defaults
  const timeStart =
    dataSourceOptions.time_start instanceof Date && !isNaN(dataSourceOptions.time_start.getTime())
      ? dataSourceOptions.time_start.toISOString().slice(0, 10)
      : '';
  const timeEnd =
    dataSourceOptions.time_end instanceof Date && !isNaN(dataSourceOptions.time_end.getTime())
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
    if (!dataSourceOptions.time_start || !dataSourceOptions.time_end) {
      handleDatePresetChange(datePreset);
    }

    // Verify we have valid dates before submitting
    const store = useLastWaveStore.getState();
    const { time_start, time_end } = store.dataSourceOptions;
    const startValid = time_start instanceof Date && !isNaN(time_start.getTime());
    const endValid = time_end instanceof Date && !isNaN(time_end.getTime());
    if (!startValid || !endValid) {
      store.addToast('Please set both a start and end date.', 'warning');
      return;
    }

    onSubmit({
      dataSourceOptions: store.dataSourceOptions,
      rendererOptions: store.rendererOptions,
    });
  }

  return (
    <form onSubmit={handleSubmit} className="mx-auto max-w-2xl px-6 py-3 lg:py-6">
      {/* Main Options */}
      <div className="mb-6 space-y-4 lg:space-y-5">
        {/* Username */}
        <div>
          <div className="relative">
            <input
              type="search"
              value={username}
              onChange={(e) => setDataSourceOption('username', e.target.value)}
              autoComplete="off"
              data-1p-ignore
              data-lpignore="true"
              data-bwignore
              className="w-full rounded-lg border border-lw-border bg-lw-surface px-4 py-3 text-center text-lg text-lw-text placeholder-lw-muted/50 transition-all focus:border-lw-accent focus:outline-none focus:ring-1 focus:ring-lw-accent/30 [&::-webkit-search-cancel-button]:hidden"
              placeholder={service === 'listenbrainz' ? 'listenbrainz username' : 'last.fm username'}
            />
            <div className="absolute right-0 top-1/2 -translate-y-1/2 translate-x-[calc(100%+0.5rem)]" ref={serviceDropdownRef}>
              <button
                type="button"
                onClick={() => setServiceDropdownOpen(!serviceDropdownOpen)}
                className="flex shrink-0 items-center justify-center rounded-lg bg-transparent p-1 transition-colors hover:bg-lw-accent/10"
                title={`Data source: ${service === 'listenbrainz' ? 'ListenBrainz' : 'Last.fm'}`}
              >
                <img
                  src={service === 'listenbrainz' ? '/icons/listenbrainz.svg' : '/icons/lastfm.svg'}
                  alt=""
                  className="h-10 w-10"
                />
              </button>
              {serviceDropdownOpen && (
                <div className="absolute right-0 top-full z-50 mt-1 w-44 overflow-hidden rounded-lg border border-lw-border bg-lw-surface shadow-lg">
                  {([
                    { key: 'lastfm' as const, label: 'Last.fm', icon: '/icons/lastfm.svg' },
                    { key: 'listenbrainz' as const, label: 'ListenBrainz', icon: '/icons/listenbrainz.svg' },
                    { key: 'spotify' as const, label: 'Spotify', icon: '/icons/spotify.svg' },
                  ]).map((opt) => (
                    <button
                      key={opt.key}
                      type="button"
                      onClick={() => {
                        if (opt.key === 'spotify') {
                          setSpotifyModalOpen(true);
                          setServiceDropdownOpen(false);
                        } else {
                          handleServiceChange(opt.key);
                        }
                      }}
                      className={`flex w-full items-center gap-2.5 px-3 py-2 text-sm transition-colors ${
                        service === opt.key
                          ? 'bg-lw-accent/15 text-lw-accent'
                          : 'text-lw-text hover:bg-lw-accent/10'
                      }`}
                    >
                      <img src={opt.icon} alt="" className="h-4 w-4" />
                      {opt.label}
                    </button>
                  ))}
                </div>
              )}
            </div>
          </div>
        </div>

        {/* Date Range + Data Set — sentence style */}
        <div>
          <div className="flex flex-nowrap items-baseline justify-center gap-1.5 lg:gap-2">
            <span className="text-sm text-lw-muted sm:text-lg lg:text-xl">Graph my</span>
            <span className="relative inline-block">
              <select
                value={datePreset}
                onChange={(e) => handleDatePresetChange(e.target.value)}
                className="cursor-pointer appearance-none border-b-2 border-lw-accent/40 bg-transparent py-0.5 pl-0.5 pr-5 text-sm font-medium text-lw-accent transition-colors hover:border-lw-accent focus:border-lw-accent focus:outline-none sm:pr-6 sm:text-lg lg:text-xl"
              >
                {easyDateEntries.map(([name]) => (
                  <option key={name} value={name} className="bg-lw-bg text-lw-text">
                    {name}
                  </option>
                ))}
                <option value="Custom" className="bg-lw-bg text-lw-text">
                  Custom range
                </option>
              </select>
              <svg
                className="pointer-events-none absolute right-0 top-1/2 h-4 w-4 -translate-y-1/2 text-lw-accent/60"
                fill="none"
                viewBox="0 0 24 24"
                stroke="currentColor"
                strokeWidth={2.5}
              >
                <path strokeLinecap="round" strokeLinejoin="round" d="M19 9l-7 7-7-7" />
              </svg>
            </span>
            <span className="text-sm text-lw-muted sm:text-lg lg:text-xl">of</span>
            <span className="relative inline-block">
              <select
                value={method}
                onChange={(e) => setDataSourceOption('method', e.target.value)}
                className="cursor-pointer appearance-none border-b-2 border-lw-accent/40 bg-transparent py-0.5 pl-0.5 pr-5 text-sm font-medium text-lw-accent transition-colors hover:border-lw-accent focus:border-lw-accent focus:outline-none sm:pr-6 sm:text-lg lg:text-xl"
              >
                <option value="artist" className="bg-lw-bg text-lw-text">
                  Artists
                </option>
                <option value="album" className="bg-lw-bg text-lw-text">
                  Albums
                </option>
                <option value="tag" className="bg-lw-bg text-lw-text">
                  Genres
                </option>
              </select>
              <svg
                className="pointer-events-none absolute right-0 top-1/2 h-4 w-4 -translate-y-1/2 text-lw-accent/60"
                fill="none"
                viewBox="0 0 24 24"
                stroke="currentColor"
                strokeWidth={2.5}
              >
                <path strokeLinecap="round" strokeLinejoin="round" d="M19 9l-7 7-7-7" />
              </svg>
            </span>
          </div>
          {method === 'tag' && (
            <p className="mt-2 text-center text-sm text-amber-500">
              ⚠️ Fetching genres is currently very slow due to rate limits. Be prepared to wait a
              few minutes!
            </p>
          )}
          {isCustomDate && (
            <div className="mx-auto mt-4 grid max-w-xs grid-cols-2 gap-3">
              <div>
                <label className="mb-1 block text-xs text-lw-muted">Start</label>
                <input
                  type="date"
                  value={timeStart}
                  onChange={(e) => {
                    const d = new Date(e.target.value);
                    setDataSourceOption('time_start', isNaN(d.getTime()) ? undefined : d);
                  }}
                  className="w-full rounded-lg border border-lw-border bg-lw-surface px-3 py-2 text-sm text-lw-text transition-all focus:border-lw-accent focus:outline-none focus:ring-1 focus:ring-lw-accent/30"
                />
              </div>
              <div>
                <label className="mb-1 block text-xs text-lw-muted">End</label>
                <input
                  type="date"
                  value={timeEnd}
                  onChange={(e) => {
                    const d = new Date(e.target.value);
                    setDataSourceOption('time_end', isNaN(d.getTime()) ? undefined : d);
                  }}
                  className="w-full rounded-lg border border-lw-border bg-lw-surface px-3 py-2 text-sm text-lw-text transition-all focus:border-lw-accent focus:outline-none focus:ring-1 focus:ring-lw-accent/30"
                />
              </div>
            </div>
          )}
        </div>

        {/* Color Scheme */}
        <div>
          <label className="mb-3 block text-xs uppercase tracking-widest text-lw-muted">
            Theme
          </label>
          <div className="flex flex-wrap justify-center gap-3">
            {schemeNames.map((name) => {
              const isSelected = colorScheme === name;
              return (
                <button
                  key={name}
                  type="button"
                  onClick={() => setRendererOption('color_scheme', name)}
                  className={`group flex flex-col items-center rounded-lg border-2 p-2.5 shadow-md transition-all duration-200 ${
                    isSelected
                      ? 'border-lw-accent bg-lw-accent/15 shadow-lg ring-1 ring-lw-accent/30'
                      : 'border-lw-border bg-lw-surface hover:border-lw-muted/50'
                  }`}
                >
                  <div className="mb-1.5 overflow-hidden rounded">
                    <img
                      src={`/scheme-previews/${name}.png`}
                      alt={`${name} theme preview`}
                      width={140}
                      height={60}
                      className="block"
                    />
                  </div>
                  <span
                    className={`text-xs ${isSelected ? 'text-lw-accent' : 'text-lw-muted group-hover:text-lw-text'}`}
                  >
                    {name === 'lastwave'
                      ? 'LastWave'
                      : name.charAt(0).toUpperCase() + name.slice(1)}
                  </span>
                </button>
              );
            })}
          </div>
        </div>
      </div>

      {/* Advanced Options Toggle */}
      <div className="mb-6 text-center">
        <button
          type="button"
          onClick={() => setShowAdvanced(!showAdvanced)}
          className="text-xs uppercase tracking-widest text-lw-muted transition-colors hover:text-lw-accent"
        >
          Advanced Options {showAdvanced ? '−' : '+'}
        </button>
      </div>

      {/* Advanced Options */}
      {showAdvanced && (
        <div className="mx-auto mb-8 max-w-sm rounded-xl border border-lw-border bg-lw-surface/50 p-6">
          <div className="space-y-3">
            <div>
              <label className="mb-1 block text-xs text-lw-muted">Group by</label>
              <select
                value={groupBy}
                onChange={(e) => setDataSourceOption('group_by', e.target.value)}
                className="w-full rounded-lg border border-lw-border bg-lw-bg px-3 py-2 text-sm text-lw-text transition-all focus:border-lw-accent focus:outline-none"
              >
                {['day', 'week', 'month', 'year'].map((v) => (
                  <option key={v} value={v} className="bg-lw-bg text-lw-text">
                    {v}
                  </option>
                ))}
              </select>
            </div>
            <label className="group flex cursor-pointer items-center gap-2.5 pt-1">
              <input
                type="checkbox"
                checked={rendererOptions.loading_animation ?? true}
                onChange={(e) => setRendererOption('loading_animation', e.target.checked)}
                className="rounded border-lw-border bg-lw-bg accent-lw-accent"
              />
              <span className="text-xs text-lw-muted transition-colors group-hover:text-lw-text">
                Loading animation
              </span>
            </label>
          </div>
        </div>
      )}

      {/* Submit */}
      <div className="text-center">
        <button
          type="submit"
          className="relative rounded-lg bg-lw-accent px-12 py-3 text-sm font-semibold uppercase tracking-wider text-lw-bg transition-all hover:scale-[1.02] hover:bg-lw-accent-dim active:scale-[0.98]"
        >
          Generate
        </button>
      </div>
      <SpotifyModal open={spotifyModalOpen} onClose={() => setSpotifyModalOpen(false)} />
    </form>
  );
}
