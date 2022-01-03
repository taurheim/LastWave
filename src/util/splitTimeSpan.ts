import AggregationWindow from 'models/AggregationWindow';
import TimeSpan from 'models/TimeSpan';
import { MonthInMs, WeekInMs, YearInMs } from './DateConstants';

const intervals: { [key in AggregationWindow]: number } = {
  week: WeekInMs,
  month: MonthInMs,
  year: YearInMs,
};

export default function splitTimeSpan(splitBy: AggregationWindow, timeSpan: TimeSpan): TimeSpan[] {
  const segments: TimeSpan[] = [];
  const interval = intervals[splitBy];
  for (let t = timeSpan.start; t < timeSpan.end; t = new Date(t.getTime() + interval)) {
    segments.push({
      start: t,
      end: new Date(t.getTime() + interval),
    });
  }

  return segments;
}
