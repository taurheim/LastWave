const OneWeekInMs = 604800000;
export default function snapDateToUnixWeek(date: Date) {
  return new Date(date.getTime() - (date.getTime() % OneWeekInMs));
}
