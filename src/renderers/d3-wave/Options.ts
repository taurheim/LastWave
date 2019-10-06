import Option from '@/models/Option';
import StringOption from '@/models/options/StringOption';
import ImageChoiceOption from '@/models/options/ImageChoiceOption';
import Image from '@/models/options/Image';
import StringChoiceOption from '@/models/options/StringChoiceOption';
import BooleanOption from '@/models/options/BooleanOption';

/*
  https://stackoverflow.com/a/42441396
*/
const LastWaveSchemeImagePath = require('@/assets/lastwave-scheme.png'); // tslint:disable-line
const CarpetSchemeImagePath = require('@/assets/carpet-scheme.png'); // tslint:disable-line
const PastelSchemeImagePath = require('@/assets/pastel-scheme.png'); // tslint:disable-line
const GorgeousSchemeImagePath = require('@/assets/gorgeous-scheme.png'); // tslint:disable-line
const ElegantSchemeImagePath = require('@/assets/elegant-scheme.png'); // tslint:disable-line
const EarthtonesSchemeImagePath = require('@/assets/earthtones-scheme.png'); // tslint:disable-line

const DEFAULT_GRAPH_HEIGHT = 600;

const COLOR_SCHEMES = [
  new Image(
    'Lastwave',
    'lastwave',
    LastWaveSchemeImagePath,
  ),
  new Image(
    'Carpet',
    'carpet',
    CarpetSchemeImagePath,
  ),
  new Image(
    'Pastel',
    'pastel',
    PastelSchemeImagePath,
  ),
  new Image(
    'Gorgeous',
    'gorgeous',
    GorgeousSchemeImagePath,
  ),
  new Image(
    'Elegant',
    'elegant',
    ElegantSchemeImagePath,
  ),
  new Image(
    'Earthtones',
    'earthtones',
    EarthtonesSchemeImagePath,
  ),
];

export default [
  new ImageChoiceOption(
    'theme',
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
  new BooleanOption(
    'Ripple border',
    'stroke',
    false,
    true,
  ),
  new BooleanOption(
    'Add artist/album/tag names',
    'add_labels',
    false,
    true,
  ),
  new BooleanOption(
    'Add month names',
    'add_months',
    false,
    true,
  ),
];
