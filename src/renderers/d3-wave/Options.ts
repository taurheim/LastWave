import Option from '@/models/Option';
import StringOption from '@/models/options/StringOption';
import ImageChoiceOption from '@/models/options/ImageChoiceOption';
import Image from '@/models/options/Image';
import StringChoiceOption from '@/models/options/StringChoiceOption';
import BooleanOption from '@/models/options/BooleanOption';

const DEFAULT_GRAPH_HEIGHT = 600;

const COLOR_SCHEMES = [
  new Image(
    'Lastwave',
    'lastwave',
    'https://savas.ca/lastwave/images/examples/lastwave.png',
  ),
];

export default [
  new ImageChoiceOption(
    'Color Scheme',
    'color_scheme',
    true,
    'lastwave',
    COLOR_SCHEMES,
  ),
  // TODO need an IntegerOption
  new StringOption(
    'Graph width',
    'width',
    false,
  ),
  new StringOption(
    'Graph Height',
    'height',
    false,
    DEFAULT_GRAPH_HEIGHT.toString(),
  ),
  // TODO this should be an ImageChoiceOption tbh
  new StringChoiceOption(
    'Graph type',
    'offset',
    false,
    'silhouette',
    [
      'silhouette',
      'wiggle',
      'expand',
      'zero',
    ],
  ),
  new StringOption(
    'Font',
    'font',
    false,
    'Roboto',
  ),
  new BooleanOption(
    'Ripple border',
    'stroke',
    false,
    true,
  ),
  new BooleanOption(
    'Add labels',
    'add_labels',
    false,
    true,
  ),
];
