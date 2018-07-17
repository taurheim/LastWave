import Option from '@/models/Option';

const DEFAULT_GRAPH_HEIGHT = 600;
export default [
  new Option(
    "Color Scheme",
    "color_scheme",
    "dropdown",
    "lastwave",
    [
      "lastwave",
    ],
  ),
  new Option(
    "Graph Width",
    "width",
    "int",
  ),
  new Option(
    "Graph Height",
    "height",
    "int",
    DEFAULT_GRAPH_HEIGHT.toString(),
  ),
  new Option(
    "Graph type",
    "offset",
    "dropdown",
    "silhouette",
    [
      "silhouette",
      "wiggle",
      "expand",
      "zero",
    ],
  ),
  new Option(
    "Ripple border",
    "stroke",
    "toggle",
    "checked",
  ),
  new Option(
    "Font",
    "font",
    "string",
    "Roboto",
  ),
  new Option(
    "Add labels",
    "add_labels",
    "toggle",
    "checked",
  ),
];
