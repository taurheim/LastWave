import { useState, useRef, useEffect, useCallback, type ReactNode } from 'react';
import { useLastWaveStore } from '@/store/index';
import WaveOptions from '@/components/WaveOptions';
import WaveVisualization from '@/components/WaveVisualization';
import ImageActions from '@/components/ImageActions';
import CustomizePanel from '@/components/CustomizePanel';
import { fetchWithRetry } from '@/core/fetchWithRetry';
import type { OverflowInfo } from '@/core/wave/overflowDetection';
import type SegmentData from '@/core/models/SegmentData';
import type SeriesData from '@/core/models/SeriesData';
import LoadingStage from '@/core/models/LoadingStage';
import LastFmApi, { type LastFmResponse } from '@/core/lastfm/LastFmApi';
import TimeSpan from '@/core/lastfm/models/TimeSpan';
import URLParameter from '@/core/lastfm/models/URLParameter';
import {
  splitTimeSpan,
  joinSegments,
  cleanByMinPlays,
  combineArtistTags,
  findOptimalMinPlays,
  getAnimationSteps,
} from '@/core/lastfm/util';
import * as d3 from 'd3';
import { stackOrderSlopeBalanced } from '@/core/wave/stackOrder';
import schemes from '@/core/config/schemes.json';

// d3's .order() type expects (series: Series) => number[] but our ordering
// function takes Series[] (the full array). Cast once here to avoid repetition.
const balancedOrder = ((s: d3.Series<Record<string, number>, string>[]) =>
  stackOrderSlopeBalanced(s, 0.15)) as unknown as (series: d3.Series<Record<string, number>, string>) => number[];

const LAST_FM_API_KEY = '27ca6b1a0750cf3fb3e1f0ec5b432b72';
const MAX_CONCURRENT = 10;

/** Minimum ms between renders while streaming segments during fetch */
const STREAM_RENDER_INTERVAL_MS = 600;
/** D3 transition duration for path morphing during animation (ms) */
const _TRANSITION_DURATION_MS = 550;
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
  const results = new Array<T>(tasks.length);
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

function ImageScaler({
  showFullSvg,
  setShowFullSvg: _setShowFullSvg,
  onOverflowChange,
  minChartHeight,
  children,
}: {
  showFullSvg: boolean;
  setShowFullSvg: (v: boolean) => void;
  onOverflowChange?: (overflowing: boolean) => void;
  minChartHeight?: number;
  children: ReactNode;
}) {
  const containerRef = useRef<HTMLDivElement>(null);
  const [isOverflowing, setIsOverflowing] = useState(false);
  const [zoomScale, setZoomScale] = useState(1);

  const checkOverflow = useCallback(() => {
    if (showFullSvg) return;
    const el = containerRef.current;
    if (!el) return;
    const svg = el.querySelector('svg');
    if (!svg) return;
    const svgWidth = parseFloat(svg.getAttribute('width') ?? '0');
    const svgHeight = parseFloat(svg.getAttribute('height') ?? '0');
    const containerWidth = el.clientWidth;
    const overflows = svgWidth > containerWidth;
    setIsOverflowing(overflows);
    onOverflowChange?.(overflows);

    // Compute zoom scale for minChartHeight
    if (minChartHeight && overflows && svgWidth > 0 && svgHeight > 0) {
      const naturalHeight = svgHeight * (containerWidth / svgWidth);
      setZoomScale(naturalHeight < minChartHeight ? minChartHeight / naturalHeight : 1);
    } else {
      setZoomScale(1);
    }
  }, [showFullSvg, onOverflowChange, minChartHeight]);

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

  const scaleDown = !showFullSvg && isOverflowing;
  const needsZoom = scaleDown && zoomScale > 1;
  return (
    <div
      ref={containerRef}
      className={`mx-4 ${showFullSvg ? 'overflow-x-auto [&_#svg-wrapper]:!overflow-visible' : ''}`}
    >
      <div
        className={scaleDown ? 'overflow-hidden' : ''}
        style={
          showFullSvg
            ? { minWidth: 'max-content' }
            : needsZoom
              ? { height: `${minChartHeight}px`, overflow: 'hidden' }
              : undefined
        }
      >
        <div
          className={scaleDown ? '[&_svg]:h-auto [&_svg]:w-full' : ''}
          style={
            needsZoom
              ? { transform: `scale(${zoomScale})`, transformOrigin: 'top left' }
              : undefined
          }
        >
          {children}
        </div>
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
  const fullReset = useLastWaveStore((s) => s.fullReset);

  const [seriesData, setSeriesData] = useState<SeriesData[]>([]);
  const rawSeriesDataRef = useRef<SeriesData[]>([]);
  const [maxPlaysInDataset, setMaxPlaysInDataset] = useState(100);
  const [error, setError] = useState<string | null>(null);
  const [showFullSvg, setShowFullSvg] = useState(false);
  const [showCustomize, setShowCustomize] = useState(false);
  const customizePanelRef = useRef<HTMLDivElement>(null);
  const customizeToggleRef = useRef<HTMLButtonElement>(null);
  const [overflows, setOverflows] = useState<OverflowInfo[]>([]);
  const [highlightOverflows, setHighlightOverflows] = useState(false);
  const [imageOverflows, setImageOverflows] = useState(false);
  const [suppressLabels, setSuppressLabels] = useState(false);
  const [drawingStatus, setDrawingStatus] = useState('');
  const prevCoreRef = useRef<{ sd: SeriesData[] | null; key: string }>({ sd: null, key: '' });
  const renderCompleteResolveRef = useRef<(() => void) | null>(null);
  const labelTimerRef = useRef<ReturnType<typeof setTimeout>>();
  const isAnimatingRef = useRef(false);
  const streamSegmentsRef = useRef<(SegmentData[] | undefined)[]>([]);
  const streamTimerRef = useRef<ReturnType<typeof setTimeout>>();
  const streamMinPlaysRef = useRef<number>(Infinity);
  const sweepBandCapRef = useRef<number>(Infinity);
  const streamTagDataRef = useRef<Record<string, { tags: string[] }>>({});
  const revealFrontierRef = useRef(0);
  const animFrameTimerRef = useRef<ReturnType<typeof setInterval>>();
  const animFrameCountRef = useRef(0);
  const animDoneResolveRef = useRef<(() => void) | null>(null);
  const animBuildupStepsRef = useRef<number[]>([]);
  const lockedYDomainRef = useRef<[number, number] | null>(null);
  const [lockedYDomain, setLockedYDomain] = useState<[number, number] | undefined>(undefined);
  const [lockedColorMap, setLockedColorMap] = useState<Map<string, string> | undefined>(undefined);
  const lockedColorMapRef = useRef<Map<string, string> | null>(null);

  const showFullSizeBtn = showFullSvg || imageOverflows;

  // Close customize panel when clicking outside (desktop only, ≥ 1024px)
  useEffect(() => {
    if (!showCustomize) return;
    const handleMouseDown = (e: MouseEvent) => {
      if (window.innerWidth < 1024) return;
      if (
        customizePanelRef.current?.contains(e.target as Node) ||
        customizeToggleRef.current?.contains(e.target as Node)
      )
        return;
      setShowCustomize(false);
    };
    document.addEventListener('mousedown', handleMouseDown);
    return () => document.removeEventListener('mousedown', handleMouseDown);
  }, [showCustomize]);

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
  if (
    seriesData.length > 0 &&
    deformText &&
    (seriesData !== prevCoreRef.current.sd || coreKey !== prevCoreRef.current.key)
  ) {
    setDrawingStatus('Drawing…');
  }
  prevCoreRef.current = { sd: seriesData, key: coreKey };

  const _loadingAnimEnabled = rOpts.loading_animation ?? true;
  const loadingStages = useLastWaveStore((s) => s.stages);
  const loadingStageIndex = useLastWaveStore((s) => s.currentStage);

  const loadingStatusText = (() => {
    if (loadingStageIndex < 0 || !loadingStages[loadingStageIndex]) return 'Loading…';
    const isRenderStage = loadingStageIndex === loadingStages.length - 1;
    if (isRenderStage) return drawingStatus || 'Drawing…';
    const stage = loadingStages[loadingStageIndex];
    const sub = stage.subText ? ` (${stage.subText})` : '';
    return `${stage.stageName} ${stage.currentSegment}/${stage.stageSegments}${sub}…`;
  })();

  // Clean up animation timer on unmount
  useEffect(
    () => () => {
      clearTimeout(streamTimerRef.current);
      clearTimeout(animFrameTimerRef.current);
    },
    [],
  );

  // Reset to input page if we lost chart data (e.g. navigated away and back)
  useEffect(() => {
    if (showVisualization && seriesData.length === 0 && rawSeriesDataRef.current.length === 0) {
      resetToOptions();
    }
  }, []);

  // Slurp decorative background waves as soon as we leave the options screen
  useEffect(() => {
    const el = document.getElementById('decorative-bg-waves');
    if (!el) return;
    if (!showOptions) {
      el.classList.add('slurp');
    } else {
      el.classList.remove('slurp');
    }
  }, [showOptions]);

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

  // Reset store before Astro view transitions to prevent hydration mismatches
  useEffect(() => {
    const handleBeforeSwap = () => fullReset();
    document.addEventListener('astro:before-swap', handleBeforeSwap);
    return () => document.removeEventListener('astro:before-swap', handleBeforeSwap);
  }, [fullReset]);

  // Swap nav "Home" link to "← New graph" when graph is visible
  useEffect(() => {
    const link = document.getElementById('nav-home-link') as HTMLAnchorElement | null;
    if (!link) return;
    if (showActions) {
      link.textContent = '← New graph';
      const handler = (e: Event) => {
        e.preventDefault();
        resetToOptions();
      };
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
    return () => {
      footer.style.display = '';
    };
  }, [showActions]);

  function renderStreamFrame() {
    const allSegments = streamSegmentsRef.current;
    const frontier = revealFrontierRef.current;
    const RAMP_WIDTH = 5;

    // Join all arrived segments
    const joined = joinSegments(allSegments);
    if (joined.length === 0) return;

    // Defer sweep threshold + y-domain lock until 30% of segments have arrived.
    // This gives a reliable estimate of the data distribution. Before that,
    // render nothing (the sweep frontier advances but no bands are shown).
    const totalSegments = allSegments.length;
    const arrivedCount = allSegments.filter((s) => s !== undefined).length;
    const enoughData = arrivedCount > 0 && arrivedCount / totalSegments >= 0.5;

    if (streamMinPlaysRef.current === Infinity && enoughData) {
      // Estimate sweep threshold using artist-pool growth ratio.
      // At 50% data, findOptimalMinPlays underestimates the full threshold
      // because unseen segments will bring new artists and higher peaks.
      // Scale by growthRatio (full artist count / partial artist count) to
      // compensate. Also store the estimated final band count as a hard cap
      // so the sweep never shows more bands than the final chart.
      const partialMinPlays = findOptimalMinPlays(joined, 30);
      const partialArtistCount = joined.filter((s) => s.counts.some((c) => c > 0)).length;
      const fullArtistEstimate = Math.round(partialArtistCount * (totalSegments / arrivedCount));
      const growthRatio = fullArtistEstimate / Math.max(1, partialArtistCount);
      const estThreshold = Math.max(5, Math.round(partialMinPlays * Math.sqrt(growthRatio)));

      // Estimated final band count = bands surviving the estimated threshold
      const estFinalBands = joined.filter((s) => Math.max(...s.counts) >= estThreshold).length;
      sweepBandCapRef.current = Math.max(3, estFinalBands);

      // Sweep threshold targets ~half the estimated final bands
      const targetSweepBands = Math.max(3, Math.ceil(estFinalBands / 2));
      const peaksSorted = joined
        .map((s) => Math.max(...s.counts))
        .filter((p) => p >= estThreshold)
        .sort((a, b) => b - a);
      streamMinPlaysRef.current =
        peaksSorted[Math.min(targetSweepBands - 1, peaksSorted.length - 1)] || estThreshold;

      // Reset frame counter so the full animation budget (50 frames / 2.5s)
      // starts from when we actually have enough data to show something.
      animFrameCountRef.current = 0;

      // Phase 1 color assignment: assign colors to sweep artists in STACKING
      // ORDER so adjacent bands never share a color. This runs once at 50% data.
      //
      // HARD INVARIANT: This color map persists through sweep, buildup, AND
      // final render. It must never be cleared or recomputed between animation
      // and the final labeled render. See specs/animation-smoothing.md.
      if (!lockedColorMapRef.current) {
        const store = useLastWaveStore.getState();
        const schemeName = (store.rendererOptions.color_scheme ?? 'lastwave') as keyof typeof schemes;
        const scheme = (schemes as Record<string, { schemeColors: string[] }>)[schemeName] ?? schemes.lastwave;
        const palette = scheme.schemeColors;
        const nColors = palette.length;

        // Compute stacking order for the sweep set using d3.stack
        const sweepCleaned = cleanByMinPlays(joined, streamMinPlaysRef.current);
        const sweepKeys = sweepCleaned.map((s) => s.title);
        const sweepTable: Record<string, number>[] = [];
        const numSeg = sweepCleaned[0]?.counts.length ?? 0;
        for (let i = 0; i < numSeg; i++) {
          const row: Record<string, number> = { index: i };
          sweepCleaned.forEach((s) => { row[s.title] = s.counts[i] ?? 0; });
          sweepTable.push(row);
        }
        if (sweepKeys.length > 0 && numSeg > 0) {
          const sweepStack = d3
            .stack<Record<string, number>>()
            .keys(sweepKeys)
            .offset(d3.stackOffsetSilhouette)
            .order(balancedOrder);
          const stacked = sweepStack(sweepTable);
          // Assign evenly-spaced colors in visual stacking order
          const cmap = new Map<string, string>();
          for (let i = 0; i < stacked.length; i++) {
            cmap.set(stacked[i].key, palette[i % nColors]);
          }
          lockedColorMapRef.current = cmap;
          setLockedColorMap(cmap);
        }
      }
    }

    if (!lockedYDomainRef.current && enoughData) {
      const targetMinPlays = findOptimalMinPlays(joined, 30);
      const finalCleaned = cleanByMinPlays(joined, targetMinPlays);
      if (finalCleaned.length > 0 && finalCleaned[0].counts.length > 0) {
        const estKeys = finalCleaned.map((s) => s.title);
        const numSeg = finalCleaned[0].counts.length;
        const estTable: Record<string, number>[] = [];
        for (let i = 0; i < numSeg; i++) {
          const row: Record<string, number> = { index: i };
          finalCleaned.forEach((s) => { row[s.title] = s.counts[i] ?? 0; });
          estTable.push(row);
        }
        const estStack = d3
          .stack<Record<string, number>>()
          .keys(estKeys)
          .offset(d3.stackOffsetSilhouette)
          .order(balancedOrder);
        const stacked = estStack(estTable);
        const yMin = d3.min(stacked, (layer) => d3.min(layer, (d) => d[0])) ?? 0;
        const yMax = d3.max(stacked, (layer) => d3.max(layer, (d) => d[1])) ?? 0;
        lockedYDomainRef.current = [yMin, yMax];
        setLockedYDomain([yMin, yMax]);
      }
    }

    // Before enough data, don't render (sweep frontier advances but nothing shows)
    if (streamMinPlaysRef.current === Infinity) return;

    // Filter by UNMASKED peaks first (stable artist set throughout sweep),
    // then apply the frontier mask for the left-to-right reveal.
    // Cap to estimated final band count so sweep never shows more than final.
    let cleaned = cleanByMinPlays(joined, streamMinPlaysRef.current);
    if (cleaned.length > sweepBandCapRef.current) {
      cleaned = cleaned
        .sort((a, b) => Math.max(...b.counts) - Math.max(...a.counts))
        .slice(0, sweepBandCapRef.current);
    }
    // Incremental color assignment: artists that crossed the threshold after
    // the initial 50%-data color assignment need colors before they render,
    // otherwise they fall back to colors[0] (red for mosaic).
    if (lockedColorMapRef.current) {
      const cmap = lockedColorMapRef.current;
      const newArtists = cleaned.filter((s) => !cmap.has(s.title));
      if (newArtists.length > 0) {
        const store = useLastWaveStore.getState();
        const schemeName = (store.rendererOptions.color_scheme ?? 'lastwave') as keyof typeof schemes;
        const scheme = (schemes as Record<string, { schemeColors: string[] }>)[schemeName] ?? schemes.lastwave;
        const palette = scheme.schemeColors;
        const nColors = palette.length;

        // Compute current stacking order to pick neighbor-safe colors
        const sweepKeys = cleaned.map((s) => s.title);
        const numSeg = cleaned[0]?.counts.length ?? 0;
        const sweepTable: Record<string, number>[] = [];
        for (let i = 0; i < numSeg; i++) {
          const row: Record<string, number> = { index: i };
          cleaned.forEach((s) => { row[s.title] = s.counts[i] ?? 0; });
          sweepTable.push(row);
        }
        const sweepStack = d3
          .stack<Record<string, number>>()
          .keys(sweepKeys)
          .offset(d3.stackOffsetSilhouette)
          .order(balancedOrder);
        const stacked = sweepStack(sweepTable);
        const orderedKeys = stacked.map((layer) => layer.key);

        for (let i = 0; i < orderedKeys.length; i++) {
          if (cmap.has(orderedKeys[i])) continue;
          const prevColor = i > 0 ? cmap.get(orderedKeys[i - 1]) : undefined;
          const nextColor = i < orderedKeys.length - 1 ? cmap.get(orderedKeys[i + 1]) : undefined;
          let chosen = palette[i % nColors];
          if (chosen === prevColor || chosen === nextColor) {
            for (let offset = 1; offset < nColors; offset++) {
              const candidate = palette[(i + offset) % nColors];
              if (candidate !== prevColor && candidate !== nextColor) {
                chosen = candidate;
                break;
              }
            }
          }
          cmap.set(orderedKeys[i], chosen);
        }
        setLockedColorMap(new Map(cmap));
      }
    }

    const masked = cleaned.map((series) => ({
      ...series,
      counts: series.counts.map((count, i) => {
        const scale = Math.max(0, Math.min(1, (frontier - i) / RAMP_WIDTH));
        return Math.round(count * scale);
      }),
    }));
    setSeriesData(masked);

    // Reveal the visualization container on the very first rendered frame
    if (!useLastWaveStore.getState().showVisualization) {
      useLastWaveStore.getState().setShowVisualization(true);
    }
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
    lockedYDomainRef.current = null;
    setLockedYDomain(undefined);
    lockedColorMapRef.current = null;
    setLockedColorMap(undefined);
    store.setShowOptions(false);
    store.setShowLoadingBar(true);

    const method = dsOpts.method ?? 'artist';
    const isTagMode = method === 'tag';
    const groupBy = dsOpts.group_by ?? 'week';
    const groupLabel =
      groupBy === 'day'
        ? 'days'
        : groupBy === 'month'
          ? 'months'
          : groupBy === 'year'
            ? 'years'
            : 'weeks';

    // Set up loading stages
    const stages = [new LoadingStage(`Loading ${groupLabel}`, isTagMode ? 40 : 80)];
    if (isTagMode) {
      stages.push(new LoadingStage('Loading genres', 40));
    }
    stages.push(new LoadingStage('Rendering', 20));
    store.setStages(stages);

    try {
      const api = new LastFmApi(LAST_FM_API_KEY);

      // Build time span
      const startDate =
        dsOpts.time_start instanceof Date ? dsOpts.time_start : new Date(dsOpts.time_start);
      const endDate = dsOpts.time_end instanceof Date ? dsOpts.time_end : new Date(dsOpts.time_end);
      const startUnix = Math.floor(startDate.getTime() / 1000);
      const endUnix = Math.floor(endDate.getTime() / 1000);

      if (isNaN(startUnix) || isNaN(endUnix)) {
        store.addToast('Invalid date range. Please go back and set valid dates.', 'error');
        store.resetToOptions();
        return;
      }
      const groupBy = dsOpts.group_by ?? 'week';

      const timeSpan = new TimeSpan(startUnix, endUnix);
      const segments = splitTimeSpan(groupBy, timeSpan, store.log);

      // Start fetching stage
      store.startNextStage(segments.length);

      const loadingAnim = rOpts.loading_animation ?? true;

      // Initialize streaming state
      clearTimeout(animFrameTimerRef.current);
      animFrameTimerRef.current = undefined;
      streamSegmentsRef.current = new Array<SegmentData[] | undefined>(segments.length).fill(
        undefined,
      );
      streamMinPlaysRef.current = Infinity;
      revealFrontierRef.current = 0;
      animFrameCountRef.current = 0;

      // Visualization is revealed later, on first rendered frame (see renderStreamFrame)

      if (loadingAnim) {
        setSuppressLabels(true);
        isAnimatingRef.current = true;
      }

      // In tag mode, skip the sweep animation on raw artist data — genres are what we animate.
      // In artist/album mode, run the normal sweep + buildup animation.
      const animDone = new Promise<void>((resolve) => {
        animDoneResolveRef.current = resolve;
      });
      if (loadingAnim && !isTagMode) {
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
            const hasData = streamSegmentsRef.current.some((s) => s !== undefined);
            if (hasData) {
              const framesLeft = Math.max(MIN_ANIM_FRAMES - animFrameCountRef.current, 1);
              const revealFrames = Math.max(Math.ceil(framesLeft / 2), 1);
              const remaining = frontierEnd - frontier;
              const advance = Math.max(1, remaining / revealFrames);

              // Don't sweep past what's arrived (for slow connections)
              const lastArrived = streamSegmentsRef.current.reduce(
                (max, seg, i) => (seg !== undefined ? i : max),
                -1,
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

              // Phase 2 color assignment: assign colors to NEW artists (not in
              // sweep) based on the final stacking order. Walk the full order and
              // pick colors that don't collide with neighbors. Sweep artists keep
              // their existing colors.
              if (lockedColorMapRef.current) {
                const store = useLastWaveStore.getState();
                const schemeName = (store.rendererOptions.color_scheme ?? 'lastwave') as keyof typeof schemes;
                const scheme = (schemes as Record<string, { schemeColors: string[] }>)[schemeName] ?? schemes.lastwave;
                const palette = scheme.schemeColors;
                const nColors = palette.length;

                const finalCleaned = cleanByMinPlays(joined, finalMinPlays);
                const finalKeys = finalCleaned.map((s) => s.title);
                const finalTable: Record<string, number>[] = [];
                const numSeg = finalCleaned[0]?.counts.length ?? 0;
                for (let i = 0; i < numSeg; i++) {
                  const row: Record<string, number> = { index: i };
                  finalCleaned.forEach((s) => { row[s.title] = s.counts[i] ?? 0; });
                  finalTable.push(row);
                }
                if (finalKeys.length > 0 && numSeg > 0) {
                  const finalStack = d3
                    .stack<Record<string, number>>()
                    .keys(finalKeys)
                    .offset(d3.stackOffsetSilhouette)
                    .order(balancedOrder);
                  const stacked = finalStack(finalTable);
                  const cmap = lockedColorMapRef.current;
                  const orderedKeys = stacked.map((layer) => layer.key);

                  for (let i = 0; i < orderedKeys.length; i++) {
                    if (cmap.has(orderedKeys[i])) continue; // sweep artist — keep color

                    // New artist: pick a color that doesn't match neighbors
                    const prevColor = i > 0 ? cmap.get(orderedKeys[i - 1]) : undefined;
                    const nextColor = i < orderedKeys.length - 1 ? cmap.get(orderedKeys[i + 1]) : undefined;

                    // Try evenly-spaced first, then scan for non-conflicting
                    let chosen = palette[i % nColors];
                    if (chosen === prevColor || chosen === nextColor) {
                      for (let offset = 1; offset < nColors; offset++) {
                        const candidate = palette[(i + offset) % nColors];
                        if (candidate !== prevColor && candidate !== nextColor) {
                          chosen = candidate;
                          break;
                        }
                      }
                    }
                    cmap.set(orderedKeys[i], chosen);
                  }
                  setLockedColorMap(new Map(cmap));
                }
              }
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
            setDrawingStatus(`Drawing wave ${animFrameCountRef.current}/${MIN_ANIM_FRAMES}…`);
          }

          // Done when sweep finished, buildup exhausted, and all data arrived
          const nothingLeftToRender =
            sweepDone && animBuildupStepsRef.current.length === 0 && allArrived;
          if (nothingLeftToRender) {
            animFrameTimerRef.current = undefined;
            animDoneResolveRef.current?.();
            return;
          }

          // Wait for the browser to paint, THEN schedule the next tick
          if (rendered) {
            requestAnimationFrame(() => {
              animFrameTimerRef.current = setTimeout(tick, frameInterval);
            });
          } else {
            // Nothing to render yet (waiting for data) — just wait and retry
            animFrameTimerRef.current = setTimeout(tick, frameInterval);
          }
        };

        // Start first tick
        animFrameTimerRef.current = setTimeout(tick, frameInterval);
      }

      const fetchMethod = isTagMode ? 'artist' : method;

      const segmentTasks = segments.map((seg) => async () => {
        const params = [
          new URLParameter('user', username),
          new URLParameter('from', String(seg.start)),
          new URLParameter('to', String(seg.end)),
        ];
        const url = api.getAPIRequestURL(fetchMethod, params);
        const response = await fetchWithRetry(url);
        const json = (await response.json()) as LastFmResponse;
        return api.parseResponseJSON(json);
      });

      const segmentData = await pooled(
        segmentTasks,
        MAX_CONCURRENT,
        () => store.progressCurrentStage(),
        loadingAnim
          ? (index, result) => {
              streamSegmentsRef.current[index] = result;
            }
          : undefined,
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
        const artistNames = data.map((s) => s.title);

        // Reset streaming state for genre phase
        streamMinPlaysRef.current = Infinity;
        streamTagDataRef.current = {};

        const result = await lookupGenres(
          artistNames,
          LAST_FM_API_KEY,
          (name, genreList) => {
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
          (resolved, total, currentArtist) => {
            const stages = useLastWaveStore.getState().stages;
            const stageIdx = useLastWaveStore.getState().currentStage;
            const current = stages[stageIdx];
            if (current) {
              const newStages = [...stages];
              newStages[stageIdx] = {
                ...current,
                currentSegment: resolved,
                subText: currentArtist,
              };
              useLastWaveStore.setState({ stages: newStages });
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
          store.log?.(
            `Genre lookup: ${result.cachedCount} cached, ${result.wikidataCount} Wikidata, ${result.musicbrainzCount} MusicBrainz, ${result.missing.length} not found`,
          );
        }

        data = combineArtistTags(data, tagData);
        rawData = data;
        minPlays = findOptimalMinPlays(rawData, 30, store.log);
        store.setDataSourceOption('min_plays', String(minPlays));
        data = cleanByMinPlays(data, minPlays, store.log);

        // Genre streaming is done — resolve animation promise (no sweep in tag mode)
        animDoneResolveRef.current?.();
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
      setDrawingStatus('Placing text…');
      lockedYDomainRef.current = null;
      setLockedYDomain(undefined);
      // HARD INVARIANT: Do NOT clear lockedColorMap here. Colors assigned
      // during animation must persist identically into the final render.
      // See specs/animation-smoothing.md.
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
    } catch (e: unknown) {
      store.log(String(e));
      setError(e instanceof Error ? e.message : String(e));
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
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 backdrop-blur-sm">
          <div className="mx-4 w-full max-w-md rounded-xl border border-lw-border bg-lw-surface p-8 shadow-2xl">
            <h3 className="mb-3 font-display text-xl text-red-400">Something went wrong</h3>
            <p className="mb-4 break-words font-mono text-sm text-lw-muted">{error}</p>
            <p className="mb-6 text-xs text-lw-muted/60">
              If this is unexpected, please{' '}
              <a href="mailto:niko@savas.ca" className="text-lw-accent hover:underline">
                email niko@savas.ca
              </a>{' '}
              or{' '}
              <a
                href="https://github.com/nikosavas/LastWave/issues/new"
                target="_blank"
                rel="noopener noreferrer"
                className="text-lw-accent hover:underline"
              >
                open a GitHub issue
              </a>
              .
            </p>
            <button
              onClick={handleErrorDismiss}
              className="rounded-lg bg-lw-accent px-6 py-2 text-sm font-medium text-lw-bg transition-all hover:bg-lw-accent-dim"
            >
              Ok
            </button>
          </div>
        </div>
      )}

      {/* Options */}
      {showOptions && <WaveOptions onSubmit={() => void handleSubmit()} />}

      {/* Loading status shown before visualization renders (over decorative waves) */}
      {!showOptions && !showVisualization && showLoadingBar && (
        <div className="py-32 text-center">
          <span className="animate-pulse text-sm font-medium uppercase tracking-wider text-lw-muted">
            {loadingStatusText}
          </span>
        </div>
      )}

      {/* Desktop layout */}
      <div className="hidden lg:block">
        {showVisualization && (
          <div className="relative">
            <div
              className={`relative ${!imageOverflows && !showFullSvg ? 'mx-auto w-fit max-w-full' : ''}`}
            >
              {(showLoadingBar || drawingStatus) && (
                <div className="absolute inset-x-0 top-3 z-20 text-center">
                  <span className="animate-pulse text-sm font-medium uppercase tracking-wider text-lw-muted">
                    {drawingStatus && !showLoadingBar ? drawingStatus : loadingStatusText}
                  </span>
                </div>
              )}
              <ImageScaler
                showFullSvg={showFullSvg}
                setShowFullSvg={setShowFullSvg}
                onOverflowChange={setImageOverflows}
              >
                <WaveVisualization
                  seriesData={seriesData}
                  onOverflowsDetected={setOverflows}
                  onRenderComplete={handleRenderComplete}
                  onDrawingProgress={handleDrawingProgress}
                  lockedYDomain={lockedYDomain}
                  lockedColorMap={lockedColorMap}
                  suppressLabels={suppressLabels}
                />
              </ImageScaler>
              {showActions && (
                <>
                  {showFullSizeBtn && (
                    <div className="absolute left-6 top-2 z-10">
                      <button
                        onClick={() => setShowFullSvg(!showFullSvg)}
                        className="rounded-lg border border-lw-border bg-lw-surface/80 px-4 py-1.5 text-xs font-medium uppercase tracking-wider text-lw-text backdrop-blur-sm transition-all hover:border-lw-accent hover:text-lw-accent"
                      >
                        {showFullSvg ? '⤡ Fit to width' : '⤢ Full size'}
                      </button>
                    </div>
                  )}
                  <div className="absolute right-6 top-2 z-10 flex gap-2">
                    <button
                      ref={customizeToggleRef}
                      onClick={() => setShowCustomize(!showCustomize)}
                      className={`rounded-lg px-4 py-1.5 text-xs font-medium uppercase tracking-wider backdrop-blur-sm transition-all ${
                        showCustomize
                          ? 'bg-lw-accent text-lw-bg opacity-80 hover:opacity-100'
                          : 'border border-lw-border bg-lw-surface/80 text-lw-text hover:border-lw-accent hover:text-lw-accent'
                      }`}
                    >
                      {showCustomize ? '✕ Hide customize' : '⚙ Customize'}
                    </button>
                  </div>
                </>
              )}
            </div>
            {showActions && showCustomize && (
              <div
                ref={customizePanelRef}
                className="absolute right-6 top-12 z-30 max-h-[calc(100vh-8rem)] w-[min(420px,40%)] overflow-y-auto rounded-xl border border-lw-border bg-lw-bg/95 shadow-lg backdrop-blur-sm"
              >
                <CustomizePanel maxPlays={maxPlaysInDataset} />
              </div>
            )}
          </div>
        )}
      </div>

      {/* Mobile layout — single WaveVisualization instance to avoid remount flash */}
      <div
        className={`lg:hidden ${
          showVisualization
            ? 'flex min-h-[calc(100svh-10rem)] flex-col justify-center max-lg:landscape:min-h-[calc(100svh-8rem)]'
            : ''
        }`}
      >
        {showVisualization && (
          <div className="relative">
            {(showLoadingBar || drawingStatus) && (
              <div className="absolute inset-x-0 top-3 z-20 text-center">
                <span className="animate-pulse text-sm font-medium uppercase tracking-wider text-lw-muted">
                  {drawingStatus && !showLoadingBar ? drawingStatus : loadingStatusText}
                </span>
              </div>
            )}
            <ImageScaler
              showFullSvg={false}
              setShowFullSvg={setShowFullSvg}
              minChartHeight={showCustomize ? 150 : undefined}
            >
              <WaveVisualization
                seriesData={seriesData}
                onOverflowsDetected={setOverflows}
                onRenderComplete={handleRenderComplete}
                onDrawingProgress={handleDrawingProgress}
                lockedYDomain={lockedYDomain}
                lockedColorMap={lockedColorMap}
                suppressLabels={suppressLabels}
              />
            </ImageScaler>
            {showActions && (
              <>
                <div className="absolute right-6 top-2 z-10">
                  <button
                    onClick={() => setShowCustomize(!showCustomize)}
                    className={`rounded-lg px-4 py-1.5 text-xs font-medium uppercase tracking-wider backdrop-blur-sm transition-all ${
                      showCustomize
                        ? 'bg-lw-accent text-lw-bg opacity-80 hover:opacity-100'
                        : 'border border-lw-border bg-lw-surface/80 text-lw-text hover:border-lw-accent hover:text-lw-accent'
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
          <div className="max-lg:landscape:max-h-[calc(100svh-5.25rem)] max-lg:landscape:overflow-y-auto">
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
                `**Date Range:** ${dsOpts._datePreset ?? 'Custom'} (${String(dsOpts.time_start ?? '')} – ${String(dsOpts.time_end ?? '')})`,
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
            className="flex items-center gap-2 rounded-lg border border-orange-500/50 bg-orange-500/10 px-4 py-2 text-xs text-orange-400 transition-all hover:border-orange-400 hover:bg-orange-500/20 hover:text-orange-300"
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
        <div className="fixed bottom-0 left-0 right-0 z-40 border-t border-lw-border bg-lw-bg/90 backdrop-blur-sm lg:relative lg:z-auto lg:border-t-0 lg:bg-transparent lg:backdrop-blur-none">
          <ImageActions />
        </div>
      )}

      {/* Spacer so fixed mobile bar doesn't cover content */}
      {showActions && (
        <div
          className={`lg:hidden ${showCustomize ? 'h-20 max-lg:landscape:h-0' : 'h-20 max-lg:landscape:h-10'}`}
        />
      )}

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
