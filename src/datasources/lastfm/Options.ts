import Option from '@/models/Option';
var today = new Date();
var defaultStartDate = new Date();
defaultStartDate.setDate(today.getDate() - 1);
defaultStartDate.setMonth(today.getMonth() - 1);
// defaultStartDate.setFullYear(today.getFullYear() - 1);

export default [
  new Option(
    "last.fm username",
    "username",
    "string",
    "Taurheim",
  ),
  new Option(
    "Timespan start",
    "time_start",
    "date",
    defaultStartDate.toLocaleDateString("en-US"),
  ),
  new Option(
    "Timespan end",
    "time_end",
    "date",
    today.toLocaleDateString("en-US"),
  ),
  new Option(
    "Group By",
    "group_by",
    "dropdown",
    "week",
    [
      "week",
      "month",
    ]
  ),
  new Option(
    "Minimum Plays",
    "min_plays",
    "int",
    "10",
  ),
  new Option(
    "Data Set",
    "method",
    "dropdown",
    "artist",
    [
      "artist",
      "album",
      "tag",
    ]
  ),
  new Option(
    "Cache last.fm responses",
    "use_localstorage",
    "toggle",
    "checked",
  )
]
