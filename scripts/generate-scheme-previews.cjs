/**
 * Generate scheme preview PNGs for the theme picker.
 *
 * HOW TO REGENERATE:
 *   1. Fetch data: pick a Last.fm username with interesting listening data
 *      and run the inline fetch below (or replace the data source).
 *      The data file should be an array of { title, counts: number[] }.
 *      Aim for ~2 months (9 weekly segments) so the wave shape is compact.
 *
 *        node -e "
 *          const API_KEY = '27ca6b1a0750cf3fb3e1f0ec5b432b72';
 *          const API_BASE = 'https://ws.audioscrobbler.com/2.0/';
 *          const fs = require('fs');
 *          async function main() {
 *            const USER = '<pick_a_username>';
 *            const listRes = await fetch(API_BASE + '?method=user.getweeklychartlist&api_key=' + API_KEY + '&format=json&user=' + USER);
 *            const charts = (await listRes.json()).weeklychartlist.chart.slice(-9);
 *            const map = {};
 *            for (const seg of charts) {
 *              const res = await fetch(API_BASE + '?method=user.getweeklyartistchart&api_key=' + API_KEY + '&format=json&user=' + USER + '&from=' + seg.from + '&to=' + seg.to);
 *              const artists = (await res.json()).weeklyartistchart?.artist || [];
 *              for (const a of artists) { if (!map[a.name]) map[a.name] = { title: a.name, counts: [] }; }
 *              for (const name in map) { const f = artists.find(a => a.name === name); map[name].counts.push(f ? parseInt(f.playcount) : 0); }
 *              await new Promise(r => setTimeout(r, 200));
 *            }
 *            fs.writeFileSync('scripts/morganpog-data.json', JSON.stringify(Object.values(map)));
 *            console.log('Saved', Object.keys(map).length, 'artists');
 *          }
 *          main();
 *        "
 *
 *   2. Run this script:  node scripts/generate-scheme-previews.cjs
 *
 *   3. Delete the temp data file:  del scripts/morganpog-data.json
 *
 * DESIGN NOTES:
 *   - Schemes with a "backgroundColorLight" in schemes.json get transparent
 *     backgrounds so the preview blends with whatever the page bg is.
 *   - Schemes without "backgroundColorLight" (e.g. budapest) keep their
 *     opaque background color since it's the same in light and dark mode.
 *   - No stroke between bands — this keeps the preview clean.
 *   - Top 15 artists by total plays, rendered as a silhouette streamgraph.
 */

const { chromium } = require('playwright');
const fs = require('fs');
const path = require('path');

const schemes = JSON.parse(fs.readFileSync('src/core/config/schemes.json', 'utf8'));

// Load data — prefer the fetched data file, fall back to test fixtures
let seriesData;
const morganpogPath = 'scripts/morganpog-data.json';
if (fs.existsSync(morganpogPath)) {
  seriesData = JSON.parse(fs.readFileSync(morganpogPath, 'utf8'));
  console.log('Using fetched data from', morganpogPath);
} else {
  const fixtureDir = 'tests/fixtures/wave-accuracy';
  const fixtureFile = fs.readdirSync(fixtureDir)[0];
  const fixture = JSON.parse(fs.readFileSync(path.join(fixtureDir, fixtureFile), 'utf8'));
  seriesData = fixture.artists;
  console.log('Warning: No fetched data found, falling back to test fixture:', fixtureFile);
}

(async () => {
  const browser = await chromium.launch();

  for (const [name, scheme] of Object.entries(schemes)) {
    const useTransparentBg = !!scheme.backgroundColorLight;
    const page = await browser.newPage({ viewport: { width: 400, height: 160 } });

    await page.setContent(`
      <!DOCTYPE html>
      <html><head>
        <meta charset="utf-8">
        <script src="https://cdn.jsdelivr.net/npm/d3@7/dist/d3.min.js"></script>
        <style>body { margin: 0; padding: 0; background: transparent; }</style>
      </head><body>
        <div id="chart"></div>
        <script>
          const seriesData = ${JSON.stringify(seriesData)};
          const scheme = ${JSON.stringify(scheme)};
          const useTransparentBg = ${useTransparentBg};
          const sorted = seriesData.map(s => ({
            ...s,
            total: s.counts.reduce((a, b) => a + b, 0)
          })).sort((a, b) => b.total - a.total).slice(0, 15);
          const numSegments = sorted[0].counts.length;
          const width = 280;
          const height = 120;
          const keys = sorted.map(s => s.title);
          const tableData = [];
          for (let i = 0; i < numSegments; i++) {
            const row = { index: i };
            sorted.forEach(s => { row[s.title] = s.counts[i] || 0; });
            tableData.push(row);
          }
          const stack = d3.stack().keys(keys).offset(d3.stackOffsetSilhouette).order(d3.stackOrderNone);
          const stackedData = stack(tableData);
          const xScale = d3.scaleLinear().domain([0, numSegments - 1]).range([0, width]);
          const yMin = d3.min(stackedData, l => d3.min(l, d => d[0]));
          const yMax = d3.max(stackedData, l => d3.max(l, d => d[1]));
          const yPad = (yMax - yMin) * 0.08;
          const yScale = d3.scaleLinear().domain([yMin - yPad, yMax + yPad]).range([height, 0]);
          const area = d3.area()
            .x((d, i) => xScale(i))
            .y0(d => yScale(d[0]))
            .y1(d => yScale(d[1]))
            .curve(d3.curveMonotoneX);
          const svg = d3.select("#chart").append("svg")
            .attr("width", width).attr("height", height)
            .attr("viewBox", "0 0 " + width + " " + height);
          if (!useTransparentBg) {
            svg.append("rect").attr("width", width).attr("height", height).attr("fill", scheme.backgroundColor);
          }
          svg.selectAll("path").data(stackedData).join("path")
            .attr("d", d => area(d))
            .attr("fill", (d, i) => scheme.schemeColors[i % scheme.schemeColors.length]);
        </script>
      </body></html>
    `);

    await page.waitForTimeout(1500);
    const chart = page.locator('#chart svg');
    await chart.screenshot({
      path: path.join('public', 'scheme-previews', name + '.png'),
      omitBackground: useTransparentBg,
    });
    console.log('Saved ' + name + (useTransparentBg ? ' (transparent)' : ' (opaque)'));
    await page.close();
  }

  await browser.close();
  console.log('Done');
})();
