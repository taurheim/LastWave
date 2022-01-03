/* eslint-disable @typescript-eslint/no-explicit-any */
import * as d3 from 'd3';
import React from 'react';
import { Route, Routes } from 'react-router-dom';
import LastFmDataSource from 'services/LastFmDataSource';
import './App.css';
import { areaLabel } from 'd3-area-label';
import Header from './Header';

// type d3ExampleDataType = {
//   time: number;
//   [key: string]: number;
// };

export default function App() {
  const start = new Date();
  start.setMonth(start.getMonth() - 2);
  const end = new Date();
  const lastwaveData = new LastFmDataSource('Taurheim');

  const run = async () => {
    const snapshots = await lastwaveData.getDataForTimePeriod({ start, end }, 'week');

    // Remove artists with < 20 plays
    snapshots.forEach((s) => {
      Object.keys(s).forEach((a) => {
        if (s[a] < 15) {
          // eslint-disable-next-line no-param-reassign
          delete s[a];
        }
      });
    });

    const allKeys: string[] = [];

    // Get all artists
    snapshots.forEach((s) => {
      Object.keys(s).forEach((artist) => {
        if (allKeys.indexOf(artist) === -1) {
          allKeys.push(artist);
        }
      });
    });

    // Add 0-ed out artists by week
    snapshots.forEach((s) => {
      allKeys.forEach((k) => {
        if (!s[k]) {
          // eslint-disable-next-line no-param-reassign
          s[k] = 0;
        }
      });
    });

    console.log(snapshots);

    const d3FormattedData = d3.range(snapshots.length).map((d, i) => {
      const row = { time: i, ...snapshots[d] };
      return row;
    });

    d3FormattedData.keys = allKeys as any;

    console.log(d3FormattedData);

    // Example from https://bl.ocks.org/curran/2793201c7025c416c471e30d30546c6b
    const svg = d3.select('svg');
    const width = +svg.attr('width');
    const height = +svg.attr('height');

    // d3.stackOffsetSilhouette or wiggle
    const stack = d3.stack().offset(d3.stackOffsetWiggle);
    const xValue = (d: { time: number }) => d.time;
    const xScale = d3.scaleLinear();
    const yScale = d3.scaleLinear();
    const colorScale = d3.scaleOrdinal().range(d3.schemeCategory10);

    const area = d3
      .area()
      .x((d: any) => xScale(xValue(d.data)))
      .y0((d) => yScale(d[0]))
      .y1((d) => yScale(d[1]))
      .curve(d3.curveBasis);

    const render = (data: any) => {
      stack.keys(data.keys);
      colorScale.domain(data.keys);
      const stacked = stack(data);

      xScale.domain(d3.extent(data, (d) => xValue(d as any)) as any).range([0, width]);

      yScale
        .domain([
          d3.min(stacked[0], (d) => d[0]),
          d3.max(stacked[stacked.length - 1], (d) => d[1]) as any,
        ] as any)
        .range([height, 0]);

      const transition = d3.transition().duration(1000);

      const paths = svg.selectAll('path').data(stacked);
      paths
        .enter()
        .append('path')
        .merge(paths as any)
        .attr('fill', (d) => colorScale(d.key) as any)
        .attr('stroke', (d) => colorScale(d.key) as any)
        .transition(transition as any)
        .attr('d', area as any);

      const labels = svg.selectAll('.area-label').data(stacked);
      labels
        .enter()
        .append('text')
        .attr('class', 'area-label')
        .merge(labels as any)
        .text((d) => d.key)
        .transition(transition as any)
        .attr('transform', areaLabel(area));
    };

    render(d3FormattedData);
  };

  return (
    <Routes>
      <Route path="/" element={<Header title="A" subtitle="B" />}>
        <Route
          index
          element={
            <div>
              <button type="button" onClick={run}>
                Click me
              </button>
              <svg width="960" height="500" />
            </div>
          }
        />
      </Route>
    </Routes>
  );
}
