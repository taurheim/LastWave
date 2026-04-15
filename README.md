# LastWave

Graph your music listening history!

![An Example Graph](https://raw.githubusercontent.com/taurheim/LastWave/v4/public/LastWave_Taurheim_12-27-2024_3-27-2025.png)

## What does it do?

LastWave is a free web app that turns your [Last.fm](https://last.fm) or [ListenBrainz](https://listenbrainz.org) listening history into a beautiful wave graph (streamgraph). Group by artist, album, or genre — the more you listen to something, the larger its wave on the graph. Finished graphs can be exported as SVG or PNG.

## How does it work?

The wave graph is rendered entirely in the browser as SVG using D3.js. Artist labels are placed along the wave contours using Bezier curve fitting and spline-based deformed text rendering.

## Getting Started

```bash
git clone https://github.com/taurheim/LastWave.git
cd LastWave
npm install
npm run dev
# Open http://localhost:4321
```

## Development

See [DEVELOPMENT.md](DEVELOPMENT.md) for the full development workflow, commands, spec-driven process, and validation details.

## How to Contribute

LastWave is always looking for contributors! Check out the [issues](https://github.com/taurheim/LastWave/issues) section to see what needs doing. Questions? Contact niko@savas.ca.
