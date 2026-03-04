const { chromium } = require('playwright');
const fs = require('fs');
const path = require('path');

const schemes = JSON.parse(fs.readFileSync('src/core/config/schemes.json', 'utf8'));
const seriesData = JSON.parse(fs.readFileSync('tests/pixel-comparison/taurheim-series-data.json', 'utf8'));

(async () => {
  const browser = await chromium.launch();

  for (const [name, scheme] of Object.entries(schemes)) {
    const page = await browser.newPage({ viewport: { width: 400, height: 160 } });

    await page.setContent(`
      <!DOCTYPE html>
      <html><head>
        <meta charset="utf-8">
        <script src="https://cdn.jsdelivr.net/npm/d3@7/dist/d3.min.js"></script>
        <style>body { margin: 0; padding: 0; }</style>
      </head><body>
        <div id="chart"></div>
        <script>
          const seriesData = ${JSON.stringify(seriesData)};
          const scheme = ${JSON.stringify(scheme)};
          const numSegments = seriesData[0].counts.length;
          const width = 280;
          const height = 120;
          const keys = seriesData.map(s => s.title);
          const tableData = [];
          for (let i = 0; i < numSegments; i++) {
            const row = { index: i };
            seriesData.forEach(s => { row[s.title] = s.counts[i] || 0; });
            tableData.push(row);
          }
          const stack = d3.stack().keys(keys).offset(d3.stackOffsetSilhouette).order(d3.stackOrderNone);
          const stackedData = stack(tableData);
          const xScale = d3.scaleLinear().domain([0, numSegments - 1]).range([0, width]);
          const yMin = d3.min(stackedData, l => d3.min(l, d => d[0]));
          const yMax = d3.max(stackedData, l => d3.max(l, d => d[1]));
          const yScale = d3.scaleLinear().domain([yMin, yMax]).range([height, 0]);
          const area = d3.area()
            .x((d, i) => xScale(i))
            .y0(d => yScale(d[0]))
            .y1(d => yScale(d[1]))
            .curve(d3.curveMonotoneX);
          const svg = d3.select("#chart").append("svg")
            .attr("width", width).attr("height", height)
            .attr("viewBox", "0 0 " + width + " " + height);
          svg.append("rect").attr("width", width).attr("height", height).attr("fill", scheme.backgroundColor);
          svg.selectAll("path").data(stackedData).join("path")
            .attr("d", d => area(d))
            .attr("fill", (d, i) => scheme.schemeColors[i % scheme.schemeColors.length])
            .attr("stroke", scheme.backgroundColor).attr("stroke-width", 0.3);
        </script>
      </body></html>
    `);

    await page.waitForTimeout(1500);
    const chart = page.locator('#chart svg');
    await chart.screenshot({ path: path.join('public', 'scheme-previews', name + '.png') });
    console.log('Saved ' + name);
    await page.close();
  }

  await browser.close();
  console.log('Done');
})();
