import SeriesData from '@/models/SeriesData';
import { RickshawRippleData } from 'rickshaw';
import Rickshaw from 'rickshaw';
import jQuery from 'jquery';
import d3 from 'd3';

export function convertSeriesToRickshawFormat(seriesData: SeriesData[], schemeColors: string[]) {
  // Parse ripple data into rickshaw format
  /*
    [{
      color: "#ffffff",
      data: [{
        x: <int, which time segment?>
        y: <int, count in that time segment>
      }],
      name: "Caribou"
    }]
  */
  const rickshawData: RickshawRippleData[] = [];
  const colorCount = schemeColors.length;
  let currentColor = 0;
  seriesData.forEach((dataPoint: SeriesData) => {
    const title = dataPoint.title;
    const color = schemeColors[currentColor++ % colorCount];

    const counts = dataPoint.counts;
    const rickshawSeriesData = [];
    for (let j = 0; j < counts.length; j++) {
      rickshawSeriesData.push({
        x: j,
        y: counts[j],
      });
    }

    rickshawData.push({
      name: title,
      data: rickshawSeriesData,
      color,
    });
  });

  return rickshawData;
}

export function drawRickshawGraph(
  rickshawData: RickshawRippleData[],
  element: HTMLElement,
  width: number,
  height: number,
  renderer: string,
  offset: string,
  stroke: string,
  backgroundColor: string,
): Rickshaw.Graph {
  // Clear the space
  jQuery(element).empty();

  // Draw the graph
  const graph = new Rickshaw.Graph({
    element,
    width,
    height,
    renderer,
    offset,
    stroke,
    preserve: true,
    series: rickshawData,
  });
  graph.render();

  // Add the background rect
  const backgroundDiv = d3.select(graph.element).select('svg').insert('g', ':first-child');
  backgroundDiv.append('rect')
    .attr('width', '100%')
    .attr('height', '100%')
    .attr('fill', backgroundColor);

  return graph;
}
