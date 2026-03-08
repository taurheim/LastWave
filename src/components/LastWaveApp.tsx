import { useState, useRef, useEffect, useCallback, type ReactNode } from 'react';
import { useLastWaveStore } from '@/store/index';
import WaveOptions from '@/components/WaveOptions';
import StageLoadingBar from '@/components/StageLoadingBar';
import WaveVisualization from '@/components/WaveVisualization';
import ImageActions from '@/components/ImageActions';
import CustomizePanel from '@/components/CustomizePanel';
import { fetchWithRetry } from '@/core/fetchWithRetry';
import type { OverflowInfo } from '@/core/wave/overflowDetection';
import type SegmentData from '@/core/models/SegmentData';
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
} from '@/core/lastfm';

const LAST_FM_API_KEY= '27ca6b1a0750cf3fb3e1f0ec5b432b72';
const MAX_CONCURRENT = 10;

/** Minimum ms between renders while streaming segments during fetch */
const STREAM_RENDER_INTERVAL_MS = 600;
/** D3 transition duration for path morphing during animation (ms) */
const TRANSITION_DURATION_MS = 550;
/** Minimum total animation duration (ms) before showing final render */
const MIN_ANIMATION_DURATION_MS = 2500;
/** Minimum number of animation frames to show during streaming */
const MIN_ANIM_FRAMES = 50;

/** Run async tasks with a concurrency cap, calling onProgress after each completes. */
async function pooled<T>(
  tasks: (() => Promise<T>)[],
  concurrency: number,
  onProgress?: () => void,
  onResult?: (index: number, result: T) => void,
): Promise<T[]> {
  const results: T[] = new Array(tasks.length);
  let next = 0;

  async function worker() {
    while (next < tasks.length) {
      const idx = next++;
      results[idx] = await tasks[idx]();
      onResult?.(idx, results[idx]);
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
  const [drawingStatus, setDrawingStatus] = useState('');
  const prevCoreRef = useRef<{ sd: any; key: string }>({ sd: null, key: '' });
  const renderCompleteResolveRef = useRef<(() => void) | null>(null);
  const labelTimerRef = useRef<ReturnType<typeof setTimeout>>();
  const isAnimatingRef = useRef(false);
  const streamSegmentsRef = useRef<(SegmentData[] | undefined)[]>([]);
  const streamTimerRef = useRef<ReturnType<typeof setTimeout>>();
  const streamMinPlaysRef = useRef<number>(Infinity);
  const streamTagDataRef = useRef<Record<string, { tags: string[] }>>({});
  const revealFrontierRef = useRef(0);
  const animFrameTimerRef = useRef<ReturnType<typeof setInterval>>();
  const animFrameCountRef = useRef(0);
  const animDoneResolveRef = useRef<(() => void) | null>(null);
  const animBuildupStepsRef = useRef<number[]>([]);

  const showFullSizeBtn= showFullSvg || imageOverflows;

  const handleRenderComplete = useCallback(() => {
    setDrawingStatus('');
    if (renderCompleteResolveRef.current) {
      renderCompleteResolveRef.current();
      renderCompleteResolveRef.current = null;
    }
  }, []);

  const handleDrawingProgress = useCallback((status: string) => {
    setDrawingStatus(status);
  }, []);

  const minPlays = useLastWaveStore((s) => s.dataSourceOptions.min_plays ?? '10');
  const dsOpts = useLastWaveStore((s) => s.dataSourceOptions);
  const rOpts = useLastWaveStore((s) => s.rendererOptions);
  const deformText = rOpts.deform_text ?? true;

  // Show "Drawing…" whenever the core effect will re-run with deform text on.
  // Track the same deps as WaveVisualization's core useEffect so the indicator
  // appears on the same render — before any useEffect or paint.
  const coreKey = `${rOpts.color_scheme}|${rOpts.font}|${rOpts.offset}|${rOpts.width}|${rOpts.height}|${rOpts.add_labels}|${deformText}|${suppressLabels}`;
  if (seriesData.length > 0 && deformText &&
      (seriesData !== prevCoreRef.current.sd || coreKey !== prevCoreRef.current.key) &&
      !drawingStatus) {
    setDrawingStatus('Drawing…');
  }
  prevCoreRef.current = { sd: seriesData, key: coreKey };

  const loadingAnimEnabled = rOpts.loading_animation ?? true;
  const loadingStages = useLastWaveStore((s) => s.stages);
  const loadingStageIndex = useLastWaveStore((s) => s.currentStage);

  const loadingStatusText = (() => {
    if (loadingStageIndex < 0 || !loadingStages[loadingStageIndex]) return 'Loading…';
    const isRenderStage = loadingStageIndex === loadingStages.length - 1;
    if (isRenderStage) return drawingStatus || 'Drawing…';
    const stage = loadingStages[loadingStageIndex];
    return `Loading Data ${stage.currentSegment}/${stage.stageSegments}…`;
  })();

  // Clean up animation timer on unmount
  useEffect(() => () => {
    clearTimeout(streamTimerRef.current);
    clearTimeout(animFrameTimerRef.current);
  }, []);

  // Reset to input page if we lost chart data (e.g. navigated away and back)
  useEffect(() => {
    if (showVisualization && seriesData.length === 0 && rawSeriesDataRef.current.length === 0) {
      resetToOptions();
    }
  }, []);

  const renderTimeRef = useRef(50); // adaptive render time estimate (ms)

  // Re-filter data when minPlays changes — suppress labels during rapid changes
  useEffect(() => {
    if (rawSeriesDataRef.current.length === 0) return;
    if (isAnimatingRef.current) return;
    const mp = parseInt(minPlays, 10);
    if (isNaN(mp)) return;
    setSuppressLabels(true);
    const t0 = performance.now();
    setSeriesData(cleanByMinPlays(rawSeriesDataRef.current, mp));
    // Measure after React commits (next microtask)
    requestAnimationFrame(() => {
      const elapsed = performance.now() - t0;
      // Exponential moving average of render time
      renderTimeRef.current = renderTimeRef.current * 0.5 + elapsed * 0.5;
    });
    clearTimeout(labelTimerRef.current);
    // Adaptive debounce: slow machines get longer delay before label computation
    const debounce = Math.max(400, renderTimeRef.current * 3);
    labelTimerRef.current = setTimeout(() => setSuppressLabels(false), debounce);
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

  function renderStreamFrame() {
    const allSegments = streamSegmentsRef.current;
    const frontier = revealFrontierRef.current;
    const RAMP_WIDTH = 5;

    // Join all arrived segments
    const joined = joinSegments(allSegments);
    if (joined.length === 0) return;

    // Apply progressive mask: full left of frontier, fading at frontier edge, zero right of it
    const masked = joined.map(series => ({
      ...series,
      counts: series.counts.map((count, i) => {
        const scale = Math.max(0, Math.min(1, (frontier - i) / RAMP_WIDTH));
        return Math.round(count * scale);
      }),
    }));

    // Compute minPlays on full arrived data for stable prediction
    const totalSegments = allSegments.length;
    const arrivedCount = allSegments.filter(s => s !== undefined).length;
    const partialMinPlays = findOptimalMinPlays(joined, 30);
    const predictedMinPlays = Math.max(5, Math.round(partialMinPlays * Math.sqrt(totalSegments / arrivedCount)));

    // Scale threshold based on sweep progress: start high (big artists first),
    // taper to predicted value as frontier completes
    const sweepProgress = Math.min(1, frontier / (totalSegments + RAMP_WIDTH));
    const startThreshold = predictedMinPlays * 3;
    const sweepThreshold = Math.round(startThreshold + (predictedMinPlays - startThreshold) * sweepProgress);
    const effectiveMinPlays = Math.max(sweepThreshold, predictedMinPlays);

    streamMinPlaysRef.current = Math.min(streamMinPlaysRef.current, effectiveMinPlays);
    const cleaned = cleanByMinPlays(masked, streamMinPlaysRef.current);
    setSeriesData(cleaned);
  }

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

    // Clear previous graph data
    setSeriesData([]);
    rawSeriesDataRef.current = [];

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

      const loadingAnim = rOpts.loading_animation ?? true;

      // Initialize streaming state
      clearTimeout(animFrameTimerRef.current);
      animFrameTimerRef.current = undefined;
      streamSegmentsRef.current = new Array(segments.length).fill(undefined);
      streamMinPlaysRef.current = Infinity;
      revealFrontierRef.current = 0;
      animFrameCountRef.current = 0;

      // Show empty chart immediately
      store.setShowVisualization(true);

      if (loadingAnim) {
        setSuppressLabels(true);
        isAnimatingRef.current = true;
      }

      // Start frame timer: two phases
      // Phase 1: sweep frontier left-to-right (progressive reveal)
      // Phase 2: all segments revealed, step through decreasing minPlays thresholds
      const animDone = new Promise<void>((resolve) => {
        animDoneResolveRef.current = resolve;
      });
      if (loadingAnim) {
        animBuildupStepsRef.current = [];
        const frameInterval = MIN_ANIMATION_DURATION_MS / MIN_ANIM_FRAMES;
        const totalSegments = segments.length;
        const RAMP_WIDTH = 5;
        const frontierEnd = totalSegments + RAMP_WIDTH;

        const tick = () => {
          const allArrived = streamSegmentsRef.current.every((s) => s !== undefined);
          const frontier = revealFrontierRef.current;
          const sweepDone = frontier >= frontierEnd;
          let rendered = false;

          if (!sweepDone) {
            // Phase 1: advance frontier — pace it so sweep uses half the remaining frames
            const hasData = streamSegmentsRef.current.some(s => s !== undefined);
            if (hasData) {
              const framesLeft = Math.max(MIN_ANIM_FRAMES - animFrameCountRef.current, 1);
              const revealFrames = Math.max(Math.ceil(framesLeft / 2), 1);
              const remaining = frontierEnd - frontier;
              const advance = Math.max(1, remaining / revealFrames);

              // Don't sweep past what's arrived (for slow connections)
              const lastArrived = streamSegmentsRef.current.reduce(
                (max, seg, i) => seg !== undefined ? i : max, -1
              );
              const maxFrontier = lastArrived + 1 + RAMP_WIDTH;
              revealFrontierRef.current = Math.min(frontier + advance, maxFrontier, frontierEnd);

              renderStreamFrame();
              rendered = true;
            }

            // After sweep completes, compute buildup steps
            if (revealFrontierRef.current >= frontierEnd) {
              const joined = joinSegments(streamSegmentsRef.current);
              const finalMinPlays = findOptimalMinPlays(joined, 30);
              const remainingFrames = Math.max(MIN_ANIM_FRAMES - animFrameCountRef.current, 4);
              const steps = getAnimationSteps(joined, finalMinPlays, 3, remainingFrames);
              const currentThreshold = streamMinPlaysRef.current;
              animBuildupStepsRef.current = steps.filter((s) => s < currentThreshold);
            }
          } else if (animBuildupStepsRef.current.length > 0) {
            // Phase 2: step through decreasing minPlays thresholds
            const step = animBuildupStepsRef.current.shift()!;
            streamMinPlaysRef.current = step;
            const joined = joinSegments(streamSegmentsRef.current);
            const cleaned = cleanByMinPlays(joined, step);
            setSeriesData(cleaned);
            rendered = true;
          }

          if (rendered) {
            animFrameCountRef.current++;
            setDrawingStatus(`Drawing Wave ${animFrameCountRef.current}/${MIN_ANIM_FRAMES}…`);
          }

          // Done when sweep finished, buildup exhausted, and all data arrived
          const nothingLeftToRender = sweepDone && animBuildupStepsRef.current.length === 0 && allArrived;
          if (nothingLeftToRender) {
            animFrameTimerRef.current = undefined;
            animDoneResolveRef.current?.();
            return;
          }

          // Wait for the browser to paint, THEN schedule the next tick
          if (rendered) {
            requestAnimationFrame(() => {
              animFrameTimerRef.current = setTimeout(tick, frameInterval) as any;
            });
          } else {
            // Nothing to render yet (waiting for data) — just wait and retry
            animFrameTimerRef.current = setTimeout(tick, frameInterval) as any;
          }
        };

        // Start first tick
        animFrameTimerRef.current = setTimeout(tick, frameInterval) as any;
      }

      const fetchMethod= isTagMode ? 'artist' : method;

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

      const segmentData = await pooled(
        segmentTasks,
        MAX_CONCURRENT,
        () => store.progressCurrentStage(),
        loadingAnim ? (index, result) => {
          streamSegmentsRef.current[index] = result;
        } : undefined,
      );

      // Join and clean data
      let data = joinSegments(segmentData, store.log);
      let rawData = data;
      let minPlays = findOptimalMinPlays(rawData, 30, store.log);
      store.setDataSourceOption('min_plays', String(minPlays));
      data = cleanByMinPlays(data, minPlays, store.log);

      // If tag mode, look up genres for each artist
      if (isTagMode) {
        store.startNextStage(data.length);
        const { lookupGenres } = await import('@/core/genres/genreLookup');
        const artistNames = data.map(s => s.title);

        // Reset streaming state for genre phase
        streamMinPlaysRef.current = Infinity;
        streamTagDataRef.current = {};

        const result = await lookupGenres(
          artistNames,
          LAST_FM_API_KEY,
          (name, genreList) => {
            store.progressCurrentStage();
            if (loadingAnim) {
              streamTagDataRef.current[name] = { tags: genreList };
              if (!streamTimerRef.current) {
                streamTimerRef.current = setTimeout(() => {
                  streamTimerRef.current = undefined;
                  const combined = combineArtistTags(data, streamTagDataRef.current);
                  const newMinPlays = findOptimalMinPlays(combined, 30);
                  streamMinPlaysRef.current = Math.min(streamMinPlaysRef.current, newMinPlays);
                  setSeriesData(cleanByMinPlays(combined, streamMinPlaysRef.current));
                }, STREAM_RENDER_INTERVAL_MS);
              }
            }
          },
        );

        // Clean up streaming timer
        clearTimeout(streamTimerRef.current);
        streamTimerRef.current = undefined;

        // Build tagData from genre results
        const tagData: Record<string, { tags: string[] }> = {};
        for (const [name, genreList] of Object.entries(result.genres)) {
          tagData[name] = { tags: genreList };
        }

        if (result.missing.length > 0) {
          store.log?.(`Genre lookup: ${result.cachedCount} cached, ${result.wikidataCount} Wikidata, ${result.musicbrainzCount} MusicBrainz, ${result.missing.length} not found`);
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
      store.setShowActions(true);
      store.setShowVisualization(true);

      // Wait for frame timer to finish revealing all segments
      if (loadingAnim) {
        await animDone;
      }

      // First: render the final frame without labels (fast path)
      isAnimatingRef.current = false;
      setSeriesData(data);

      // Yield two frames so the browser paints the final wave shapes
      await new Promise((resolve) => requestAnimationFrame(() => requestAnimationFrame(resolve)));

      // Now enable labels — triggers the expensive text placement as a separate render
      setSuppressLabels(false);

      // Wait for WaveVisualization to signal render complete (handles async deformed text)
      await new Promise<void>((resolve) => {
        renderCompleteResolveRef.current = resolve;
        // Fallback timeout in case onRenderComplete doesn't fire (e.g. no labels)
        setTimeout(resolve, 10000);
      });

      store.setShowLoadingBar(false);
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

      {/* Desktop layout */}
      <div className="hidden lg:block">
        {showVisualization && (
          <div className={showActions && showCustomize ? 'flex items-start gap-4' : ''}>
            <div className={`relative ${showCustomize ? 'flex-[3] min-w-0' : !imageOverflows && !showFullSvg ? 'w-fit mx-auto max-w-full' : ''}`}>
              {showLoadingBar && !loadingAnimEnabled && (
                <div className="absolute inset-x-0 top-0 z-20">
                  <StageLoadingBar />
                </div>
              )}
              {(showLoadingBar && loadingAnimEnabled || drawingStatus) && (
                <div className="absolute inset-x-0 top-3 z-20 text-center">
                  <span className="text-sm font-medium tracking-wider uppercase text-lw-muted animate-pulse">
                    {drawingStatus && !showLoadingBar ? drawingStatus : loadingStatusText}
                  </span>
                </div>
              )}
              <ImageScaler showFullSvg={showFullSvg} setShowFullSvg={setShowFullSvg} onOverflowChange={setImageOverflows}>
                <WaveVisualization seriesData={seriesData} onOverflowsDetected={setOverflows} onRenderComplete={handleRenderComplete} onDrawingProgress={handleDrawingProgress} suppressLabels={suppressLabels} />
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
                  <div className="absolute top-2 right-6 z-10 flex gap-2">
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
            {showLoadingBar && !loadingAnimEnabled && (
              <div className="absolute inset-x-0 top-0 z-20">
                <StageLoadingBar />
              </div>
            )}
            {(showLoadingBar && loadingAnimEnabled || drawingStatus) && (
              <div className="absolute inset-x-0 top-3 z-20 text-center">
                <span className="text-sm font-medium tracking-wider uppercase text-lw-muted animate-pulse">
                  {drawingStatus && !showLoadingBar ? drawingStatus : loadingStatusText}
                </span>
              </div>
            )}
            <ImageScaler
              showFullSvg={showCustomize ? false : showFullSvg}
              setShowFullSvg={setShowFullSvg}
            >
              <WaveVisualization seriesData={seriesData} onOverflowsDetected={setOverflows} onRenderComplete={handleRenderComplete} onDrawingProgress={handleDrawingProgress} suppressLabels={suppressLabels} />
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
