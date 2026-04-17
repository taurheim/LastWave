# Retro Redesign — Warm 70s Theme

## Problem
The current LastWave UI uses a cool blue/teal tech aesthetic with Roboto/DM Sans, light/dark modes, and subtle gradient backgrounds. We want a bold, warm, retro 70s-inspired design inspired by a reference mockup featuring:
- Super Arena display font for the title
- Warm cream/maroon/gold color palette
- Decorative flowing wave bands in the background
- No subtitle, no dark mode

## Approach
**CSS Variable Swap + Inline SVG Wave (Approach 1)**: Keep the existing `--lw-*` CSS variable system, update all values to warm retro palette, add a static inline SVG for background waves, self-host the Super Arena font. Minimal structural changes — existing Tailwind classes keep working.

## Scope
- All pages (home, gallery, about) via `BaseLayout.astro`
- No dark mode — single warm retro theme
- Remove theme toggle button and scripts

---

## 1. Color Palette

Update CSS variables in `BaseLayout.astro`:

| Variable | New Value (RGB triplet) | Hex | Role |
|----------|------------------------|-----|------|
| `--lw-bg` | `245 223 197` | #F5DFC5 | Warm cream background |
| `--lw-surface` | `255 255 255` | #FFFFFF | Cards, inputs (stays white) |
| `--lw-border` | `61 12 17` | #3D0C11 | Dark maroon borders |
| `--lw-accent` | `196 40 40` | #C62828 | Primary accent (buttons, CTAs) |
| `--lw-accent-dim` | `163 33 33` | #A32121 | Hover/pressed states |
| `--lw-teal` | `212 168 67` | #D4A843 | Gold secondary accent |
| `--lw-cyan` | `139 107 139` | #8B6B8B | Mauve tertiary accent |
| `--lw-muted` | `139 115 85` | #8B7355 | Muted/secondary text |
| `--lw-text` | `61 28 30` | #3D1C1E | Body text (dark brown) |
| `--lw-heading` | `45 10 16` | #2D0A10 | Headings (deep maroon) |
| `--lw-body-bg` | — | #F5DFC5 | Body background solid |

Remove: `.dark { ... }` block entirely, `--lw-glow-a`, `--lw-glow-b`, gradient background on body.

## 2. Typography

### Title Font: Super Arena
- **Source**: https://www.dafont.com/super-arena.font (100% free for personal & commercial use)
- **File**: Download `Super Arena.ttf`, place at `public/fonts/SuperArena.ttf`
- **@font-face**: Add declaration in `BaseLayout.astro` inline `<style>`
- **Tailwind**: Update `fontFamily.display` to `['Super Arena', 'system-ui', 'sans-serif']`

### Title Rendering
- Apply `font-display` class to `<h1>` with Super Arena
- Remove the `<span class="text-lw-accent">` split — render "LastWave" as a single element in `text-lw-heading` (deep maroon), matching the reference
- Remove `font-thin` class — Super Arena is inherently bold/display

### Subtitle
- Remove the `<p>Graph your music listening history!</p>` element entirely

### Body Font
- Keep DM Sans as the body font — it pairs well with the retro display font

## 3. Background Decorative Waves

### Implementation
- Static inline SVG element in `BaseLayout.astro`
- Positioned with `position: fixed; inset: 0; z-index: 0; pointer-events: none`
- All page content wrapped with `position: relative; z-index: 1`

### Wave Design
- 4-5 flowing bezier-curve bands sweeping diagonally from bottom-left to upper-right
- Matching the reference image layout: waves flow behind the content area
- SVG uses `viewBox` with `preserveAspectRatio="none"` to fill viewport

### Wave Colors
| Band | Color | Hex |
|------|-------|-----|
| Orange | Warm orange | #E8842A |
| Red | Crimson/brick | #C13B2A |
| Green | Olive/forest | #6B8E3B |
| Blue | Medium blue | #2E6DB4 |

Bands have some width/overlap to create the flowing ribbon effect from the reference.

## 4. Cleanup

### Remove Dark Mode
- Delete `.dark { ... }` CSS variable block from `BaseLayout.astro`
- Delete `darkMode: 'class'` from `tailwind.config.mjs`
- Delete theme toggle button (`#theme-toggle`) and both SVG icons
- Delete theme initialization script in `<head>` (the IIFE that reads localStorage)
- Delete `astro:before-swap` theme persistence script
- Delete `astro:page-load` toggle handler script
- Remove localStorage `lw-theme` references

### Remove Gradient Background
- Replace the `background-image: radial-gradient(...)` body style with solid `--lw-body-bg`

## 5. Files to Modify

| File | Changes |
|------|---------|
| `src/layouts/BaseLayout.astro` | Color vars, font, title, subtitle, toggle, scripts, SVG wave |
| `tailwind.config.mjs` | Font family update, remove darkMode |
| `public/fonts/SuperArena.ttf` | New file — self-hosted font |
| `src/pages/index.astro` | Update page title (remove subtitle text) |

## 6. What Does NOT Change

- DM Sans body font
- Tailwind class names (`text-lw-accent`, `bg-lw-surface`, etc.) — all keep working
- Component structure (WaveOptions, WaveVisualization, etc.)
- Wave visualization color schemes (these are separate from the UI theme)
- Navigation structure (Home | Gallery | About)
- Footer content and layout

## Acceptance Criteria

1. Title "LastWave" renders in Super Arena font, single dark maroon color, no subtitle below
2. Background is warm cream (#F5DFC5) with 4-5 decorative wave bands visible behind content
3. All interactive elements (buttons, links) use the warm retro palette (red accent, gold secondary)
4. No dark mode toggle visible; no dark mode functionality
5. Consistent look across home, gallery, and about pages
6. No visual regressions in the wave visualization itself
7. `npm run verify` passes (tests + build)
