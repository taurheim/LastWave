import { useState } from 'react';
import { useLastWaveStore } from '@/store/index';
import WaveOptions from '@/components/WaveOptions';
import StageLoadingBar from '@/components/StageLoadingBar';
import WaveVisualization from '@/components/WaveVisualization';
import ImageActions from '@/components/ImageActions';
import OptionActions from '@/components/OptionActions';
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
  getTopTags,
} from '@/core/lastfm';
import type ArtistTags from '@/core/lastfm/models/ArtistTags';
import lastfmConfig from '@/core/lastfm/config.json';

const LAST_FM_API_KEY = '27ca6b1a0750cf3fb3e1f0ec5b432b72';

function delay(ms: number) {
  return new Promise((r) => setTimeout(r, ms));
}

export default function LastWaveApp() {
  const showOptions = useLastWaveStore((s) => s.showOptions);
  const showLoadingBar = useLastWaveStore((s) => s.showLoadingBar);
  const showVisualization = useLastWaveStore((s) => s.showVisualization);
  const showActions = useLastWaveStore((s) => s.showActions);
  const resetToOptions = useLastWaveStore((s) => s.resetToOptions);

  const [seriesData, setSeriesData] = useState<SeriesData[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [showFullSvg, setShowFullSvg] = useState(false);

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
      const minPlays = parseInt(dsOpts.min_plays ?? '10', 10);

      const timeSpan = new TimeSpan(startUnix, endUnix);
      const segments = splitTimeSpan(groupBy, timeSpan, store.log);

      // Start fetching stage
      store.startNextStage(segments.length);

      const fetchMethod = isTagMode ? 'artist' : method;
      const segmentData = [];

      for (const seg of segments) {
        const params = [
          new URLParameter('user', username),
          new URLParameter('from', String(seg.start)),
          new URLParameter('to', String(seg.end)),
        ];
        const url = api.getAPIRequestURL(fetchMethod, params);

        const response = await fetch(url);
        const json = await response.json();
        const parsed = api.parseResponseJSON(json);
        segmentData.push(parsed);

        store.progressCurrentStage();

        await delay(lastfmConfig.LAST_FM_API_CADENCE_MS);
      }

      // Join and clean data
      let data = joinSegments(segmentData, store.log);
      data = cleanByMinPlays(data, minPlays, store.log);

      // If tag mode, fetch tags for each artist
      if (isTagMode) {
        store.startNextStage(data.length);
        const tagData: Record<string, ArtistTags> = {};
        const useLocalStorage = dsOpts.use_localstorage ?? true;
        const cache = useLocalStorage ? localStorage : undefined;

        for (const series of data) {
          const artistTags = new (await import('@/core/lastfm/models/ArtistTags')).default(series.title);

          if (cache && artistTags.isInCache(cache as any)) {
            artistTags.loadFromCache(cache as any);
          } else {
            const tagParams = [new URLParameter('artist', series.title)];
            const tagUrl = api.getAPIRequestURL('tag', tagParams);

            try {
              const tagResponse = await fetch(tagUrl);
              const tagJson = await tagResponse.json();
              const tagParsed = api.parseResponseJSON(tagJson);
              const topTags = getTopTags(tagParsed);
              artistTags.setTags(topTags);
              if (cache) {
                artistTags.cache(cache as any);
              }
            } catch {
              // Skip this artist's tags on error
            }
          }

          tagData[series.title] = artistTags;
          store.progressCurrentStage();
          await delay(lastfmConfig.LAST_FM_API_CADENCE_MS);
        }

        data = combineArtistTags(data, tagData);
        data = cleanByMinPlays(data, minPlays, store.log);
      }

      // Rendering stage
      store.startNextStage(1);

      setSeriesData(data);

      store.progressCurrentStage();
      store.setShowLoadingBar(false);
      store.setShowActions(true);
      store.setShowVisualization(true);
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
              If this is unexpected, please let me know at niko@savas.ca
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

      {/* Actions */}
      {showActions && <OptionActions />}

      {/* Visualization */}
      {showVisualization && (
        <>
          <div className={`rounded-xl overflow-hidden mx-4 ${showFullSvg ? '' : 'max-w-full overflow-x-auto [&_svg]:w-full'}`}>
            <WaveVisualization seriesData={seriesData} />
          </div>
          <button
            onClick={() => setShowFullSvg(!showFullSvg)}
            className="text-lw-muted hover:text-lw-accent text-xs tracking-widest uppercase mt-3 mb-2 transition-colors"
          >
            {showFullSvg ? 'Fit to screen' : 'Full size'}
          </button>
        </>
      )}

      {/* Image Actions */}
      {showActions && <ImageActions />}
    </div>
  );
}
