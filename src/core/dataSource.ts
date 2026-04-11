import type SegmentData from '@/core/models/SegmentData';

export interface DataSource {
  fetchSegment(
    username: string,
    method: string,
    from: number,
    to: number,
  ): Promise<SegmentData[]>;
}
