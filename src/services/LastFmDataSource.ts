import LastFm from '@toplast/lastfm';
import Bluebird, { delay } from 'bluebird';
import AggregatedSnapshot from 'models/AggregatedSnapshot';
import AggregationWindow from 'models/AggregationWindow';
import DataSource from 'models/DataSource';
import TimeSpan from 'models/TimeSpan';
import snapDateToUnixWeek from 'util/snapDateToUnixWeek';
import splitTimeSpan from 'util/splitTimeSpan';

const MaxConcurrentRequests = 1;
const RequestIntervalMs = 150;

export default class LastFmDataSource implements DataSource {
  private api: LastFm;

  private user: string;

  private apiKey = '27ca6b1a0750cf3fb3e1f0ec5b432b72';

  constructor(user: string) {
    this.api = new LastFm(this.apiKey);
    this.user = user;
  }

  async getDataForTimePeriod(
    timespan: TimeSpan,
    aggregationWindow: AggregationWindow
  ): Promise<AggregatedSnapshot[]> {
    const snappedStart = snapDateToUnixWeek(timespan.start);
    const snappedEnd = snapDateToUnixWeek(timespan.end);

    const segments = splitTimeSpan(aggregationWindow, { start: snappedStart, end: snappedEnd });

    return Bluebird.map(segments, this.getSnapshotForSegment.bind(this), {
      concurrency: MaxConcurrentRequests,
    });
  }

  private async getSnapshotForSegment(segment: TimeSpan): Promise<AggregatedSnapshot> {
    const apiResult = await this.api.user.getWeeklyArtistChart({
      user: this.user,
      from: (segment.start.getTime() / 1000).toString(),
      to: (segment.end.getTime() / 1000).toString(),
    });

    const snapshot: AggregatedSnapshot = {};
    apiResult.weeklyartistchart.artist.forEach((artist) => {
      if (artist.name)
        snapshot[artist.name] = artist.playcount ? parseInt(artist.playcount, 10) : 0;
    });

    await delay(RequestIntervalMs);
    return snapshot;
  }
}
