import Option from '@/models/Option';
var today = new Date();
var defaultStartDate = new Date();
defaultStartDate.setDate(today.getDate() - 1);
defaultStartDate.setMonth(today.getMonth() - 1);
// defaultStartDate.setFullYear(today.getFullYear() - 1);

export default [
  new Option(
    "last.fm username",
    "string",
    "Taurheim",
  ),
  new Option(
    "Timespan start",
    "date",
    defaultStartDate.toLocaleDateString("en-US"),
  ),
  new Option(
    "Timespan end",
    "date",
    today.toLocaleDateString("en-US"),
  ),
  new Option(
    "Group By",
    "dropdown",
    "week",
    [
      "week",
      "month",
    ]
  ),
  new Option(
    "Minimum Plays",
    "int",
    "10",
  ),
  new Option(
    "Data Set",
    "dropdown",
    "tag",
    [
      "tag",
      "artist",
      "album",
    ]
  ),
  new Option(
    "Cache last.fm responses",
    "toggle",
    "checked",
  )
]
