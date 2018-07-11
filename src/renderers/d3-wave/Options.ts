import Option from '@/models/Option';

const DEFAULT_GRAPH_HEIGHT = 600;
export default [
  new Option(
    "Color Scheme",
    "dropdown",
    "lastwave",
    [
      "lastwave",
    ],
  ),
  new Option(
    "Graph Width",
    "int",
  ),
  new Option(
    "Graph Height",
    "int",
    DEFAULT_GRAPH_HEIGHT.toString(),
  ),
  new Option(
    "Graph type",
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
    "toggle",
    "checked",
  ),
  new Option(
    "Font",
    "string",
    "Roboto",
  ),
  new Option(
    "Add labels",
    "toggle",
    "checked",
  ),
];
