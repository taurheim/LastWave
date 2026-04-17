---
name: wave-text-tuning
description: Use when debugging or tuning deformed text placement — font sizing, centering, or overflow issues in the wave visualization. Symptoms include text too small/large for its band, text off-center from the peak bulge, or characters fading at edges.
---

# Wave Text Tuning

## Overview

The wave text pipeline has two stages: **findOptimalLabel** (bezierFit.ts) determines font size via binary search over a Bezier-bounded peak, then **computeDeformedText** (deformText.ts) places individual characters along a spline, scaling each to local band thickness. Tuning issues arise from the interaction between these stages.

## Key Files

| File | Role |
|------|------|
| `src/core/wave/bezierFit.ts` | Font size via inscribed rectangle search. `deformText` param enables relaxed height-check window for spiky peaks. |
| `src/core/wave/deformText.ts` | Per-character placement along spline. Centers text via binary search on the spline walk. |
| `src/core/wave/overflowDetection.ts` | Bezier-accurate band LUT for overflow checks |
| `src/core/wave/util.ts` | Text measurement, label index selection |
| `src/components/WaveVisualization.tsx` | Integration — calls both stages |

## Getting Started

Before tuning, you need to reproduce the issue by generating the exact graph the user is seeing.

### 1. Start the dev server

```bash
npx astro dev --port 4322
```

If port 4322 is taken, the server will auto-select a port — note which port it reports.

### 2. Open the app and generate the graph

```bash
npx playwright-cli open http://localhost:4322
npx playwright-cli eval "document.querySelector('astro-dev-toolbar')?.remove()"
```

Then fill in the username and click Generate:

```bash
npx playwright-cli snapshot  # find the searchbox and Generate button refs
npx playwright-cli fill <searchbox-ref> "<username>"
npx playwright-cli click <generate-ref>
```

Wait ~5 seconds for deformed text to finish rendering.

### 3. Adjust settings if needed

If the user specified non-default settings (e.g. minPlays, theme, offset), adjust them:

```bash
# Open the Customize panel (appears after graph is generated)
npx playwright-cli snapshot  # find the ⚙ Customize button ref
npx playwright-cli click <customize-ref>
npx playwright-cli snapshot  # find minPlays slider ref
npx playwright-cli run-code "async page => { await page.getByRole('slider', { name: 'Minimum plays Minimum plays' }).fill('<value>'); }"
```

### 4. Enable debug dots

Set `DEBUG_CENTER_DOTS = true` in `src/components/WaveVisualization.tsx` (line ~21). The graph will hot-reload via HMR — regenerate if dots don't appear.

### 5. Get the SVG dimensions

The `--width` for the diagnostic script must match the actual SVG. Get it with:

```bash
npx playwright-cli run-code "async page => { return await page.evaluate(() => { const svgs = Array.from(document.querySelectorAll('svg')); return svgs.map(s => s.getAttribute('viewBox') + ' dots=' + s.querySelectorAll('circle[fill=red]').length).join('\n'); }); }"
```

Look for the SVG with `dots > 0` — its viewBox width (third number) is what you pass to `--width`.

## Diagnostic Tools

### Offline: debug-text-placement.ts

Computes label placement from cached test fixtures without a browser:

```bash
# All artists for a user
npx tsx .github/skills/wave-text-tuning/debug-text-placement.ts --fixture ewarsaba --width 1950

# Specific artist
npx tsx .github/skills/wave-text-tuning/debug-text-placement.ts --fixture ewarsaba --artist "Nine Inch Nails" --width 1950

# With custom minPlays
npx tsx .github/skills/wave-text-tuning/debug-text-placement.ts --fixture Taurheim --artist "CunninLynguists" --minPlays 23
```

Outputs: font sizes (straight vs deform), debug center coordinates, band thickness profiles, character placement ranges, overflow fractions.

**Important:** The `--width` must match the actual SVG width (check `viewBox` attribute). The auto-computed `minPlays` may differ from the app's value.

### Live: Playwright CLI SVG inspection

Inspect the rendered SVG directly to get exact coordinates:

```bash
# Get SVG dimensions and debug dot count
npx playwright-cli run-code "async page => { return await page.evaluate(() => { const svgs = Array.from(document.querySelectorAll('svg')); return svgs.map(s => s.getAttribute('viewBox') + ' dots=' + s.querySelectorAll('circle[fill=red]').length).join('\n'); }); }"

# Get all debug dots with nearby text context
npx playwright-cli run-code "async page => { return await page.evaluate(() => { const svg = document.querySelectorAll('svg')[2]; const dots = Array.from(svg.querySelectorAll('circle[fill=red]')); const texts = Array.from(svg.querySelectorAll('text')); const td = texts.map(t => { const m = (t.getAttribute('transform')||'').match(/translate\(([^,]+),\s*([^)]+)\)/); return m ? {x:+m[1],y:+m[2],ch:t.textContent} : null; }).filter(Boolean); return dots.map(d => { const cx=+d.getAttribute('cx'), cy=+d.getAttribute('cy'); const near=td.filter(t=>Math.abs(t.x-cx)<150&&Math.abs(t.y-cy)<50).map(t=>t.ch).join(''); return cx.toFixed(0)+','+cy.toFixed(0)+' '+near.substring(0,30); }).join('\n'); }); }"
```

## Debug Center Dots

Red dots marking each label's computed center point. Controlled by `DEBUG_CENTER_DOTS` in `WaveVisualization.tsx`:

```typescript
// Set to true to enable, false to disable
const DEBUG_CENTER_DOTS = true;
```

**Enable at start of any tuning session. Disable before committing.**

The dots show where the algorithm places the center of each deformed text label. Compare the dot position to where the text visually sits and where it *should* sit.

## Collaborative Tuning Workflow

Text placement tuning requires visual judgment that only the user can provide. Use this iterative workflow:

### 1. Setup
- Enable `DEBUG_CENTER_DOTS = true` in WaveVisualization.tsx
- Start the dev server (`npx astro dev`)
- Ask the user to generate the wave for the target user/settings
- The user sees changes via Vite HMR — no page reload needed between parameter tweaks

### 2. Identify the problem
Ask the user to describe what looks wrong:
- **Text too small**: "X artist text is tiny but the band is big" → font sizing issue (bezierFit.ts)
- **Text off-center**: "the dot is in the wrong spot" or "text is in a thin area with empty space nearby" → centering issue (deformText.ts)
- **Text fading at edges**: "the start/end characters are tiny and faded" → font too large for the peak shape

### 3. Get coordinates
Ask the user for the debug dot's SVG element (right-click → Inspect in browser):
```
<circle cx="289.3" cy="392.9" r="5" fill="red" opacity="0.9">
```

Or use Playwright CLI to read all dots with nearby text context (see Diagnostic Tools section).

### 4. Make incremental changes
Make **one parameter change at a time** and ask the user to report the result. The user can see HMR updates instantly. Good patterns:

**For font sizing (bezierFit.ts deformWindowFrac):**
- "How does NIN look now? Too big or too small?"
- "Does CunninLynguists still look good?"
- Always check both the target artist AND other artists that were previously fine

**For centering (deformText.ts):**
- "Where is the dot relative to the center of the word?"
- "Which character is on the dot?"
- The middle character of the text should align with the dot

### 5. Run offline diagnostic
Use `.github/skills/wave-text-tuning/debug-text-placement.ts` to get exact numbers:
```bash
npx tsx .github/skills/wave-text-tuning/debug-text-placement.ts --fixture USERNAME --artist "ARTIST" --width WIDTH
```
**Match `--width` to the SVG's viewBox width** (check via Playwright or browser inspector).

### 6. Verify at end
- Run `npm run test:accuracy` and compare stats before/after
- Check multiple users/artists, not just the one being tuned
- Set `DEBUG_CENTER_DOTS = false` before committing

## Tuning Parameters

### Font size (bezierFit.ts)

The `deformText` mode in `findOptimalLabel` relaxes the rectangular fit for spiky peaks:

- **`thickFraction`**: Fraction of span where band height ≥ 50% of peak. Controls which peaks get boosted.
- **Threshold** (currently `< 0.6`): Only peaks with thin thick-fraction qualify for boost
- **`deformWindowFrac`**: Height-check window as fraction of span. Lower = more boost. Formula: `max(floor, thickFraction * multiplier)`
- **Floor** (currently `0.16`): Minimum window fraction
- **Multiplier** (currently `0.52`): Scales thickFraction to window fraction

To make text **bigger**: lower floor or multiplier. To make text **smaller**: raise them.

### Centering (deformText.ts)

Text centering uses a **spline-based binary search** that matches the actual rendering walk:

- `splineMiddleCharX(startX)`: walks the spline from startX and returns the x-position of the middle character
- Binary search finds startX such that the middle character lands at `thickCenterX`
- `midCharIdx = floor(text.length / 2) - 1`: targets one char before geometric center to compensate for text-anchor:middle rendering offset
- `thickCenterX`: the x-position of maximum band thickness in the viable region

### Viable region (deformText.ts)

- `MAX_VIABLE_RADIUS = 4`: segments searched outward from peak
- `VIABLE_FRAC = 0.20`: minimum thickness ratio to include in viable region
- `VALLEY_RISE = 1.5`, `VALLEY_DIP = 0.7`: valley detection to avoid spanning across separate humps

## Common Issues

### Text too small for its band
**Symptom:** Band has lots of vertical space but text is tiny.
**Cause:** Peak is very spiky — band drops sharply from center. The rectangular fit constrains font to what fits across the full text width.
**Fix:** The `deformWindowFrac` mechanism handles this. If the boost isn't enough, lower the floor or multiplier. Verify with the diagnostic: compare `Straight fontSize` vs `Deform fontSize`.

### Text too large / characters fading at edges
**Symptom:** Center characters are fine but start/end chars are tiny or invisible.
**Cause:** Deform boost is too aggressive for this peak shape.
**Fix:** Raise the thickFraction threshold or multiplier so broader peaks get less boost.

### Text off-center from the bulge
**Symptom:** Text is placed in a thin area with empty space in the thick area.
**Cause:** `thickCenterX` is at the wrong position, or the centering binary search converges poorly.
**Fix:** Check that `thickCenterX` uses max-thickness-point (not centroid, which gets pulled by thin tails). Use debug dots to compare the red dot position vs where the text should visually sit.

### Centering walk doesn't match rendering
**Symptom:** Middle character doesn't land on the debug dot.
**Cause:** The centering walk must use the same spline-based arc-length stepping as the rendering (Pass 2/3). x-based walks don't match.
**Fix:** Use `splineMiddleCharX()` which walks via `lengthAtX` + `getPointAtLength`, matching the rendering.

## Quick Reference

1. Enable `DEBUG_CENTER_DOTS = true`
2. Ask user to describe the problem and give dot coordinates
3. Run `scripts/debug-text-placement.ts` for offline numbers
4. Make one change at a time, ask user for feedback via HMR
5. Always verify: target artist fixed AND other artists not broken
6. Run `npm run test:accuracy` at the end
7. Set `DEBUG_CENTER_DOTS = false` before committing
