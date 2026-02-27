# LastWave

Graph your music listening history!

![An Example Graph](http://i.imgur.com/jMQoqg6.png)

## What does it do?

LastWave is a web app that takes data from your [last.fm](https://last.fm) profile and creates a beautiful wave graph (streamgraph) that represents your music listening trends by artist, album, or tag. The artists you listen to more at a given time have a larger area on the graph.

## Tech Stack

- **[Astro](https://astro.build/)** — Static site generation with islands architecture
- **[React](https://react.dev/)** — Interactive UI components
- **[D3.js v7](https://d3js.org/)** — Streamgraph visualization
- **[Tailwind CSS](https://tailwindcss.com/)** — Utility-first styling
- **[Zustand](https://zustand.docs.pmnd.rs/)** — Lightweight state management
- **[TypeScript](https://www.typescriptlang.org/)** — Type safety throughout
- **[Vitest](https://vitest.dev/)** + **[React Testing Library](https://testing-library.com/react)** — Unit & component tests
- **[Playwright](https://playwright.dev/)** — End-to-end tests

## How does it work?

The wave graph is rendered entirely in the browser as SVG using D3.js. Text placement on the wave peaks uses custom algorithms (W/X/Y/Z wave types) detailed in [this blog post](http://savas.ca/blog/lastwave-1-text-placement/). LastWave supports exporting as SVG, PNG, or sharing via Cloudinary.

## Getting Started

```bash
# Clone the repo
git clone https://github.com/taurheim/LastWave.git
cd LastWave

# Install dependencies
npm install

# Start dev server
npm run dev

# Open in browser
open http://localhost:4321
```

## Scripts

| Command | Description |
|---------|-------------|
| `npm run dev` | Start development server |
| `npm run build` | Build for production |
| `npm run preview` | Preview production build |
| `npm test` | Run unit & component tests |
| `npm run test:watch` | Run tests in watch mode |
| `npm run test:e2e` | Run Playwright E2E tests |

## Project Structure

```
src/
├── core/           # Framework-agnostic business logic
│   ├── models/     # Data models (Point, Peak, Label, SeriesData, etc.)
│   ├── lastfm/     # Last.fm API client & data processing
│   ├── wave/       # Text placement algorithms (W/X/Y/Z types)
│   ├── config/     # Color schemes, date presets
│   └── cloudinary/ # Image upload API
├── components/     # React components
├── layouts/        # Astro layouts
├── pages/          # Astro pages (/, /about, /gallery)
└── store/          # Zustand state management
tests/
├── unit/           # Unit tests for core logic
├── component/      # React component tests
├── e2e/            # Playwright E2E tests
└── fixtures/       # Test data fixtures
```

## How to Contribute

LastWave is always looking for contributors! Check out the [issues](https://github.com/taurheim/LastWave/issues) section to see what needs doing. Questions? Contact niko@savas.ca.
