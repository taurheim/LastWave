import DateOption from '@/models/options/DateOption';
import StringOption from '@/models/options/StringOption';
import EasyDateOption from '@/models/options/EasyDateOption';
import StringChoiceOption from '@/models/options/StringChoiceOption';
import BooleanOption from '@/models/options/BooleanOption';

const fromDate = new DateOption(
  'Timespan start',
  'time_start',
  false,
);
const toDate = new DateOption(
  'Timespan end',
  'time_end',
  false,
);

export default [
  new StringOption(
    'last.fm username',
    'username',
    true,
    'Taurheim',
  ),
  new EasyDateOption(
    'Date range',
    'customrange',
    true,
    'Last 3 months',
    [
      fromDate, toDate,
    ],
  ),
  fromDate,
  toDate,
  new StringChoiceOption(
    'Group by',
    'group_by',
    false,
    'week',
    [
      'week',
      'month',
    ],
  ),
  // TODO make an IntegerOption
  new StringOption(
    'Minimum Plays',
    'min_plays',
    false,
    '10',
  ),
  new StringChoiceOption(
    'Data set',
    'method',
    false,
    'artist',
    [
      'artist',
      'album',
      'tag',
    ],
  ),
  new BooleanOption(
    'Cache last.fm tag responses',
    'use_localstorage',
    false,
    true,
  ),
];
