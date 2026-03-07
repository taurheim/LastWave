import { useState, useRef, useEffect, useCallback, type ReactNode } from 'react';
import { useLastWaveStore } from '@/store/index';
import WaveOptions from '@/components/WaveOptions';
import StageLoadingBar from '@/components/StageLoadingBar';
import WaveVisualization from '@/components/WaveVisualization';
import ImageActions from '@/components/ImageActions';
import CustomizePanel from '@/components/CustomizePanel';
import { fetchWithRetry } from '@/core/fetchWithRetry';
import type { OverflowInfo } from '@/core/wave/overflowDetection';
import type SeriesData from '@/core/models/SeriesData';
import LoadingStage from '@/core/models/LoadingStage';
import {
  LastFmApi,
  TimeSpan,
  URLParameter,
  splitTimeSpan,
  joinSegments,
  cleanByMinPlays,
  combineArtistTags,
  findOptimalMinPlays,
  getAnimationSteps,
  getTopTags,
} from '@/core/lastfm';
import type ArtistTags from '@/core/lastfm/models/ArtistTags';

const LAST_FM_API_KEY = '27ca6b1a0750cf3fb3e1f0ec5b432b72';
const MAX_CONCURRENT = 10;

/** Run async tasks with a concurrency cap, calling onProgress after each completes. */
async function pooled<T>(
  tasks: (() => Promise<T>)[],
  concurrency: number,
  onProgress?: () => void,
): Promise<T[]> {
  const results: T[] = new Array(tasks.length);
  let next = 0;

  async function worker() {
    while (next < tasks.length) {
      const idx = next++;
      results[idx] = await tasks[idx]();
      onProgress?.();
    }
  }

  const workers = Array.from({ length: Math.min(concurrency, tasks.length) }, () => worker());
  await Promise.all(workers);
  return results;
}

function ImageScaler({ showFullSvg, setShowFullSvg, onOverflowChange, children }: {
  showFullSvg: boolean;
  setShowFullSvg: (v: boolean) => void;
  onOverflowChange?: (overflowing: boolean) => void;
  children: ReactNode;
}) {
  const containerRef = useRef<HTMLDivElement>(null);
  const [isOverflowing, setIsOverflowing] = useState(false);

  const checkOverflow = useCallback(() => {
    if (showFullSvg) return;
    const el = containerRef.current;
    if (!el) return;
    const svg = el.querySelector('svg');
    if (!svg) return;
    const svgWidth = parseFloat(svg.getAttribute('width') ?? '0');
    const overflows = svgWidth > el.clientWidth;
    setIsOverflowing(overflows);
    onOverflowChange?.(overflows);
  }, [showFullSvg, onOverflowChange]);

  useEffect(() => {
    checkOverflow();
    window.addEventListener('resize', checkOverflow);
    const el = containerRef.current;
    let ro: ResizeObserver | undefined;
    if (el) {
      ro = new ResizeObserver(checkOverflow);
      ro.observe(el);
    }
    return () => {
      window.removeEventListener('resize', checkOverflow);
      ro?.disconnect();
    };
  }, [checkOverflow]);

  // Single DOM structure to avoid remounting children when switching modes
  const scaleDown = !showFullSvg && isOverflowing;
  return (
    <div
      ref={containerRef}
      className={`mx-4 ${showFullSvg ? 'overflow-x-auto [&_#svg-wrapper]:!overflow-visible' : ''}`}
    >
      <div
        className={scaleDown ? 'overflow-hidden [&_svg]:w-full [&_svg]:h-auto' : ''}
        style={showFullSvg ? { minWidth: 'max-content' } : undefined}
      >
        {children}
      </div>
    </div>
  );
}

export default function LastWaveApp() {
  const showOptions = useLastWaveStore((s) => s.showOptions);
  const showLoadingBar = useLastWaveStore((s) => s.showLoadingBar);
  const showVisualization = useLastWaveStore((s) => s.showVisualization);
  const showActions = useLastWaveStore((s) => s.showActions);
  const resetToOptions = useLastWaveStore((s) => s.resetToOptions);

  const [seriesData, setSeriesData] = useState<SeriesData[]>([]);
  const rawSeriesDataRef = useRef<SeriesData[]>([]);
  const [maxPlaysInDataset, setMaxPlaysInDataset] = useState(100);
  const [error, setError] = useState<string | null>(null);
  const [showFullSvg, setShowFullSvg] = useState(false);
  const [showCustomize, setShowCustomize] = useState(false);
  const [overflows, setOverflows] = useState<OverflowInfo[]>([]);
  const [highlightOverflows, setHighlightOverflows] = useState(false);
  const [imageOverflows, setImageOverflows] = useState(false);
  const [suppressLabels, setSuppressLabels] = useState(false);
  const labelTimerRef = useRef<ReturnType<typeof setTimeout>>();
  const animTimerRef = useRef<ReturnType<typeof setTimeout>>();
  const isAnimatingRef = useRef(false);

  const showFullSizeBtn = showFullSvg || imageOverflows;

  const minPlays = useLastWaveStore((s) => s.dataSourceOptions.min_plays ?? '10');
  const dsOpts = useLastWaveStore((s) => s.dataSourceOptions);
  const rOpts = useLastWaveStore((s) => s.rendererOptions);

  // Clean up animation timer on unmount
  useEffect(() => () => clearTimeout(animTimerRef.current), []);

  // Reset to input page if we lost chart data (e.g. navigated away and back)
  useEffect(() => {
    if (showVisualization && seriesData.length === 0 && rawSeriesDataRef.current.length === 0) {
      resetToOptions();
    }
  }, []);

  // Re-filter data when minPlays changes — suppress labels during rapid changes
  useEffect(() => {
    if (rawSeriesDataRef.current.length === 0) return;
    if (isAnimatingRef.current) return;
    const mp = parseInt(minPlays, 10);
    if (isNaN(mp)) return;
    setSuppressLabels(true);
    setSeriesData(cleanByMinPlays(rawSeriesDataRef.current, mp));
    clearTimeout(labelTimerRef.current);
    labelTimerRef.current = setTimeout(() => setSuppressLabels(false), 400);
    return () => clearTimeout(labelTimerRef.current);
  }, [minPlays]);

  // Swap nav "Home" link to "← New graph" when graph is visible
  useEffect(() => {
    const link = document.getElementById('nav-home-link') as HTMLAnchorElement | null;
    if (!link) return;
    if (showActions) {
      link.textContent = '← New graph';
      const handler = (e: Event) => { e.preventDefault(); resetToOptions(); };
      link.addEventListener('click', handler);
      return () => {
        link.textContent = 'Home';
        link.removeEventListener('click', handler);
      };
    } else {
      link.textContent = 'Home';
    }
  }, [showActions, resetToOptions]);

  // Hide footer when visualization is showing
  useEffect(() => {
    const footer = document.getElementById('site-footer');
    if (!footer) return;
    footer.style.display = showActions ? 'none' : '';
    return () => { footer.style.display = ''; };
  }, [showActions]);

  async function handleSubmit() {
    const store = useLastWaveStore.getState();
    const dsOpts = store.dataSourceOptions;
    const rOpts = store.rendererOptions;

    const username = dsOpts.username;
    if (!username) {
      setError('Please enter a last.fm username');
      return;
    }

    setError(null);

    // Hide options, show loading bar
    store.setShowOptions(false);
    store.setShowLoadingBar(true);

    const method = dsOpts.method ?? 'artist';
    const isTagMode = method === 'tag';

    // Set up loading stages
    const stages = [
      new LoadingStage('Getting data...', isTagMode ? 40 : 80),
    ];
    if (isTagMode) {
      stages.push(new LoadingStage('Getting tags...', 40));
    }
    stages.push(new LoadingStage('Rendering...', 20));
    store.setStages(stages);

    try {
      const api = new LastFmApi(LAST_FM_API_KEY);

      // Build time span
      const startDate = dsOpts.time_start instanceof Date ? dsOpts.time_start : new Date(dsOpts.time_start);
      const endDate = dsOpts.time_end instanceof Date ? dsOpts.time_end : new Date(dsOpts.time_end);
      const startUnix = Math.floor(startDate.getTime() / 1000);
      const endUnix = Math.floor(endDate.getTime() / 1000);
      const groupBy = dsOpts.group_by ?? 'week';

      const timeSpan = new TimeSpan(startUnix, endUnix);
      const segments = splitTimeSpan(groupBy, timeSpan, store.log);

      // Start fetching stage
      store.startNextStage(segments.length);

      const fetchMethod = isTagMode ? 'artist' : method;

      const segmentTasks = segments.map((seg) => async () => {
        const params = [
          new URLParameter('user', username),
          new URLParameter('from', String(seg.start)),
          new URLParameter('to', String(seg.end)),
        ];
        const url = api.getAPIRequestURL(fetchMethod, params);
        const response = await fetchWithRetry(url);
        const json = await response.json();
        return api.parseResponseJSON(json);
      });

      const segmentData = await pooled(segmentTasks, MAX_CONCURRENT, () => store.progressCurrentStage());

      // Join and clean data
      let data = joinSegments(segmentData, store.log);
      let rawData = data;
      let minPlays = findOptimalMinPlays(rawData, 30, store.log);
      store.setDataSourceOption('min_plays', String(minPlays));
      data = cleanByMinPlays(data, minPlays, store.log);

      // If tag mode, fetch tags for each artist
      if (isTagMode) {
        store.startNextStage(data.length);
        const cache = localStorage;
        const ArtistTagsClass = (await import('@/core/lastfm/models/ArtistTags')).default;

        const tagTasks = data.map((series) => async () => {
          const artistTags = new ArtistTagsClass(series.title);

          if (cache && artistTags.isInCache(cache as any)) {
            artistTags.loadFromCache(cache as any);
          } else {
            const tagParams = [new URLParameter('artist', series.title)];
            const tagUrl = api.getAPIRequestURL('tag', tagParams);

            try {
              const tagResponse = await fetchWithRetry(tagUrl);
              const tagJson = await tagResponse.json();
              const tagParsed = api.parseResponseJSON(tagJson);
              const topTags = getTopTags(tagParsed);
              artistTags.setTags(topTags);
              if (cache) {
                artistTags.cache(cache as any);
              }
            } catch {
              store.addToast(`Could not load tags for "${series.title}" — skipping`, 'warning');
            }
          }

          return { title: series.title, tags: artistTags };
        });

        const tagResults = await pooled(tagTasks, MAX_CONCURRENT, () => store.progressCurrentStage());
        const tagData: Record<string, ArtistTags> = {};
        for (const { title, tags } of tagResults) {
          tagData[title] = tags;
        }

        data = combineArtistTags(data, tagData);
        rawData = data;
        minPlays = findOptimalMinPlays(rawData, 30, store.log);
        store.setDataSourceOption('min_plays', String(minPlays));
        data = cleanByMinPlays(data, minPlays, store.log);
      }

      // Rendering stage
      store.startNextStage(1);

      rawSeriesDataRef.current = rawData;
      // Compute the highest peak play count across all series for the slider max
      let datasetMax = 1;
      for (const series of rawData) {
        for (const c of series.counts) {
          if (c > datasetMax) datasetMax = c;
        }
      }
      setMaxPlaysInDataset(datasetMax);

      store.progressCurrentStage();
      store.setShowLoadingBar(false);
      store.setShowActions(true);
      store.setShowVisualization(true);

      // Animate the graph "building up" from few artists to the final count
      clearTimeout(animTimerRef.current);
      const loadingAnim = rOpts.loading_animation ?? true;
      const steps = loadingAnim ? getAnimationSteps(rawData, minPlays) : [];

      if (steps.length > 1) {
        isAnimatingRef.current = true;
        setSuppressLabels(true);
        let i = 0;
        const runStep = () => {
          if (i < steps.length - 1) {
            // Intermediate frames: render without labels
            setSeriesData(cleanByMinPlays(rawData, steps[i]));
            i++;
            animTimerRef.current = setTimeout(runStep, 60);
          } else {
            // Final frame: render the target data with labels
            isAnimatingRef.current = false;
            setSeriesData(data);
            setSuppressLabels(false);
          }
        };
        runStep();
      } else {
        setSeriesData(data);
      }
    } catch (e: any) {
      store.log(String(e));
      setError(String(e?.message ?? e));
      store.setShowLoadingBar(false);
      store.setShowOptions(true);
    }
  }

  function handleErrorDismiss() {
    setError(null);
    resetToOptions();
  }

  return (
    <div className="text-center">
      {/* Error Dialog */}
      {error && (
        <div className="fixed inset-0 bg-black/70 backdrop-blur-sm flex items-center justify-center z-50">
          <div className="bg-lw-surface border border-lw-border rounded-xl p-8 max-w-md w-full mx-4 shadow-2xl">
            <h3 className="font-display text-xl text-red-400 mb-3">Something went wrong</h3>
            <p className="text-sm text-lw-muted font-mono mb-4 break-words">{error}</p>
            <p className="text-xs text-lw-muted/60 mb-6">
              If this is unexpected, please{' '}
              <a href="mailto:niko@savas.ca" className="text-lw-accent hover:underline">email niko@savas.ca</a>
              {' '}or{' '}
              <a href="https://github.com/nikosavas/LastWave/issues/new" target="_blank" rel="noopener noreferrer" className="text-lw-accent hover:underline">open a GitHub issue</a>.
            </p>
            <button
              onClick={handleErrorDismiss}
              className="bg-lw-accent hover:bg-lw-accent-dim text-lw-bg rounded-lg px-6 py-2 text-sm font-medium transition-all"
            >
              Ok
            </button>
          </div>
        </div>
      )}

      {/* Options */}
      {showOptions && <WaveOptions onSubmit={handleSubmit} />}

      {/* Loading Bar */}
      {showLoadingBar && <StageLoadingBar />}

      {/* Desktop layout */}
      <div className="hidden lg:block">
        {showVisualization && (
          <div className={showActions && showCustomize ? 'flex items-start gap-4' : ''}>
            <div className={`relative ${showCustomize ? 'flex-[3] min-w-0' : !imageOverflows && !showFullSvg ? 'w-fit mx-auto max-w-full' : ''}`}>
              <ImageScaler showFullSvg={showFullSvg} setShowFullSvg={setShowFullSvg} onOverflowChange={setImageOverflows}>
                <WaveVisualization seriesData={seriesData} onOverflowsDetected={setOverflows} suppressLabels={suppressLabels} />
              </ImageScaler>
              {showActions && (
                <>
                  {showFullSizeBtn && (
                    <div className="absolute top-2 left-6 z-10">
                      <button
                        onClick={() => setShowFullSvg(!showFullSvg)}
                        className="rounded-lg px-4 py-1.5 text-xs tracking-wider uppercase font-medium transition-all backdrop-blur-sm bg-lw-surface/80 border border-lw-border text-lw-text hover:text-lw-accent hover:border-lw-accent"
                      >
                        {showFullSvg ? '⤡ Fit to width' : '⤢ Full size'}
                      </button>
                    </div>
                  )}
                  <div className="absolute top-2 right-6 z-10">
                    <button
                      onClick={() => setShowCustomize(!showCustomize)}
                      className={`rounded-lg px-4 py-1.5 text-xs tracking-wider uppercase font-medium transition-all backdrop-blur-sm ${
                        showCustomize
                          ? 'bg-lw-accent text-lw-bg opacity-80 hover:opacity-100'
                          : 'bg-lw-surface/80 border border-lw-border hover:border-lw-accent text-lw-text hover:text-lw-accent'
                      }`}
                    >
                      {showCustomize ? '✕ Hide customize' : '⚙ Customize'}
                    </button>
                  </div>
                </>
              )}
            </div>
            {showActions && showCustomize && (
              <div className="flex-[2] min-w-0">
                <CustomizePanel maxPlays={maxPlaysInDataset} />
              </div>
            )}
          </div>
        )}
      </div>

      {/* Mobile layout — single WaveVisualization instance to avoid remount flash */}
      <div className={`lg:hidden ${
        showVisualization && !showCustomize && !showFullSvg
          ? 'min-h-[calc(100svh-10rem)] max-lg:landscape:min-h-[calc(100svh-8rem)] flex flex-col justify-center'
          : showVisualization && showCustomize
            ? 'max-lg:landscape:flex max-lg:landscape:flex-row max-lg:landscape:items-stretch max-lg:landscape:h-[calc(100svh-5.25rem)]'
            : ''
      }`}>
        {showVisualization && (
          <div
            className={`relative ${showCustomize ? 'max-lg:landscape:flex-1 max-lg:landscape:min-w-0 max-lg:landscape:[&>div]:mr-0 max-lg:landscape:flex max-lg:landscape:items-center max-lg:landscape:pb-14' : ''}`}
          >
            <ImageScaler
              showFullSvg={showCustomize ? false : showFullSvg}
              setShowFullSvg={setShowFullSvg}
            >
              <WaveVisualization seriesData={seriesData} onOverflowsDetected={setOverflows} suppressLabels={suppressLabels} />
            </ImageScaler>
            {showActions && (
              <>
                {showFullSizeBtn && (
                  <div className="absolute top-2 left-6 z-10">
                    <button
                      onClick={() => setShowFullSvg(!showFullSvg)}
                      className="rounded-lg px-4 py-1.5 text-xs tracking-wider uppercase font-medium transition-all backdrop-blur-sm bg-lw-surface/80 border border-lw-border text-lw-text hover:text-lw-accent hover:border-lw-accent"
                    >
                      {showFullSvg ? '⤡ Fit to width' : '⤢ Full size'}
                    </button>
                  </div>
                )}
                <div className="absolute top-2 right-6 z-10">
                  <button
                    onClick={() => setShowCustomize(!showCustomize)}
                    className={`rounded-lg px-4 py-1.5 text-xs tracking-wider uppercase font-medium transition-all backdrop-blur-sm ${
                      showCustomize
                        ? 'bg-lw-accent text-lw-bg opacity-80 hover:opacity-100'
                        : 'bg-lw-surface/80 border border-lw-border hover:border-lw-accent text-lw-text hover:text-lw-accent'
                    }`}
                  >
                    {showCustomize ? '✕ Hide customize' : '⚙ Customize'}
                  </button>
                </div>
              </>
            )}
          </div>
        )}
        {showActions && showCustomize && (
          <div className="max-lg:landscape:flex-1 max-lg:landscape:min-w-0 max-lg:landscape:overflow-y-auto max-lg:landscape:max-h-[calc(100svh-5.25rem)]">
            <CustomizePanel maxPlays={maxPlaysInDataset} />
          </div>
        )}
      </div>

      {/* Misaligned labels warning — always below the image */}
      {showActions && overflows.length > 0 && (
        <div className="flex justify-center py-2">
          <a
            href={(() => {
              const labels = overflows.map((o) => o.artist).join(', ');
              const title = `Misaligned label: ${labels}`;
              const body = [
                '## Misaligned Label Report',
                '',
                `**Last.fm Username:** ${dsOpts.username ?? ''}`,
                `**Misaligned Labels:** ${labels}`,
                `**Minimum Plays:** ${dsOpts.min_plays ?? '10'}`,
                `**Date Range:** ${dsOpts._datePreset ?? 'Custom'} (${dsOpts.time_start ?? ''} – ${dsOpts.time_end ?? ''})`,
                `**Color Scheme:** ${rOpts.color_scheme ?? 'lastwave'}`,
                `**Graph Type:** ${rOpts.offset ?? 'silhouette'}`,
                `**Group By:** ${dsOpts.group_by ?? 'week'}`,
                `**Data Set:** ${dsOpts.method ?? 'artist'}`,
                '',
                '## Screenshot',
                'Please paste a screenshot of the chart showing the misaligned label(s):',
                '',
                '',
                '## Additional Context',
                '',
              ].join('\n');
              return `https://github.com/taurheim/LastWave/issues/new?title=${encodeURIComponent(title)}&body=${encodeURIComponent(body)}&labels=bug,label-alignment`;
            })()}
            target="_blank"
            rel="noopener noreferrer"
            onMouseEnter={() => setHighlightOverflows(true)}
            onMouseLeave={() => setHighlightOverflows(false)}
            className="flex items-center gap-2 text-xs text-orange-400 hover:text-orange-300 border border-orange-500/50 hover:border-orange-400 bg-orange-500/10 hover:bg-orange-500/20 rounded-lg px-4 py-2 transition-all"
          >
            <span>⚠</span>
            <span>
              {overflows.length === 1
                ? '1 label may be misaligned'
                : `${overflows.length} labels may be misaligned`}
              {' — '}Report issue
            </span>
          </a>
        </div>
      )}

      {/* Image Actions (download/share) — sticky on mobile */}
      {showActions && (
        <div className="lg:relative fixed bottom-0 left-0 right-0 z-40 lg:z-auto bg-lw-bg/90 backdrop-blur-sm lg:bg-transparent lg:backdrop-blur-none border-t border-lw-border lg:border-t-0">
          <ImageActions />
        </div>
      )}

      {/* Spacer so fixed mobile bar doesn't cover content */}
      {showActions && <div className={`lg:hidden ${showCustomize ? 'h-20 max-lg:landscape:h-0' : 'h-20 max-lg:landscape:h-10'}`} />}

      {/* Highlight overflowing labels when hovering the bug report button */}
      {highlightOverflows && (
        <style>{`
          #svg-wrapper svg text[data-overflow="true"] {
            fill: #ffffff !important;
            stroke: #000000;
            stroke-width: 3px;
            paint-order: stroke fill;
            filter: drop-shadow(0 0 8px #f97316) drop-shadow(0 0 16px #f97316);
          }
        `}</style>
      )}
    </div>
  );
}
