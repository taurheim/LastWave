/*
  If I could come up with a better name for this that would be awesome.
  This is one group of data associated with a single entity (e.g. if 
  RHCP had 12 weeks of plays, then count would have a length of 12 and title
  would be RHCP)
*/
export default interface SeriesData {
  title: string,
  counts: number[],
}
