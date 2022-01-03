import AggregatedSnapshot from './AggregatedSnapshot';
import AggregationWindow from './AggregationWindow';
import TimeSpan from './TimeSpan';

interface DataSource {
  getDataForTimePeriod(
    span: TimeSpan,
    aggregationWindow: AggregationWindow
  ): Promise<AggregatedSnapshot[]>;
}

export default DataSource;
