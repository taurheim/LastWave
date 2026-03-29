# Animation Smoothing Spec

## Original Design Intent (from prior sessions)

The animation was designed to serve as a visual loading indicator that replaces the loading bar. Key requirements from the original design:

1. **Build the graph while data loads** — animate during fetching, not after. The visualization IS the progress indicator.
2. **Start with the biggest artists** — show ~3 big waves first, progressively add smaller ones by lowering the minPlays threshold. "Big blocks placed early, filled in later."
3. **Left-to-right sweep** — "like a boat in an ocean." Data for time segments arrives and the graph should appear to grow rightward. The original "interleave" idea: if segments 1-5 have arrived, show 70% of 1, 60% of 2, 50% of 3, etc., so it tapers toward the frontier.
4. **Avoid removing artists** — threshold should only decrease (add artists), never increase (remove them). "We should try to avoid removing artists if possible."
5. **Color stability** — "if there was a big bulge at the start it would stay yellow throughout the animation." Hash-based colors must never change for any artist.
6. **Text placement only at the end** — labels/deformed text calculated on the final frame only. "Avoid running the text placement algorithm until the very end."
7. **Minimum frame count & duration** — at least 50 frames over ~2.5 seconds. On slow CPUs, degrade gracefully.
8. **No D3 path transitions** — tried and rejected. "It looked better before we added the animations." Individual path interpolation causes gaps between adjacent bands.
9. **Smooth final transition** — "I'd like the chart to finish animating THEN just have the text appear." No freeze or jump between animation end and label rendering.

## Current Problems

Despite the above intentions, the current implementation has several visual issues:

1. **Big bands thrash/jump** — during the sweep, the silhouette offset recenters every frame as data changes, causing NIN, Aphex Twin, etc. to visibly oscillate
2. **Threshold steps cause jumps** — buildup phase snaps the threshold down, instantly adding batches of artists which shifts the entire graph
3. **Color flashing** — stacking order changes between frames cause color instability
4. **Last animation frame → final render jump** — any difference in offset, ordering, or data between the last animation frame and the final render creates a visible discontinuity

## Goal

Every consecutive pair of frames should have **minimal visual delta** — including the transition from the last animation frame to the final render. The animation should feel like a smooth, organic reveal of the wave.

## Constraint

- The **final render** (labels, deformed text, overflow detection) must NOT be changed
- Silhouette centering must be used throughout — no fixed-baseline tricks that create a jump at the end
- The animation should have a clear **left-to-right sweep** character

## Design

### Core Principle: Frame Interpolation

Since data arrives in batches but we render across many frames, we always know the "current state" and the "target state". Instead of snapping to the target, we **interpolate the raw count data** over N frames so each frame changes smoothly.

This is done at the data level (interpolating `SeriesData.counts[]`), NOT at the SVG/path level. This means the d3 stack, silhouette offset, and area generator all receive gradually-changing input, producing gradually-changing output with no gaps between bands.

### Phase 1: Sweep (left-to-right reveal)

**Visual:** The wave grows from the left edge rightward. Behind the frontier, artists have their real data. At and beyond the frontier, all values are zero. The frontier advances smoothly.

**Data approach:**
- Maintain a `currentCounts[][]` buffer (one array per artist, one value per segment)
- Each frame, advance the frontier by a fractional amount
- For segments left of the frontier: lerp toward the real count values
- For segments at/beyond the frontier: stay at zero
- The ramp at the frontier edge should be smooth (several segments wide)

**Threshold:** Hold at a high initial value during sweep so only the biggest ~3-5 artists show. The artist set is stable during this entire phase.

### Phase 2: Buildup (add artists progressively)

**Visual:** After the sweep completes, new artists gradually fade in. Each new batch is spread over several frames by interpolating counts from zero to their real values.

**Data approach:**
- Compute the sequence of threshold steps (existing `getAnimationSteps`)
- For each step, identify the newly-added artists
- Instead of instantly setting their counts, lerp their counts from 0 → real over ~5-8 frames
- The `currentCounts` buffer is the single source of truth for what gets rendered

### Phase 3: Final convergence

**Visual:** The last few animation frames smoothly converge to exactly the final render data.

**Data approach:**
- The last animation frame should use the exact same `seriesData`, offset, and ordering as the final render
- To achieve this: once buildup is complete, the interpolation target IS the final data. The lerp naturally converges.
- The final render uses `suppressLabels=false` which triggers the label pass, but the wave paths should be identical to the last animation frame

### Ordering Stability

- During animation: use `jitter=1.0` (pure hash ordering) so band positions are completely data-independent
- On final render: use the user's jitter setting (default 0.12) which blends peak-based centrality
- **Problem:** this creates a reordering jump on the last frame
- **Fix:** on the very last animation frame (when buildup is exhausted and all data has arrived), switch to the final jitter value. Since this is also the frame where the data has fully converged, the visual change is just a smooth reordering with identical data — minimal jump.

### Color Stability

- In balanced mode, skip adjacency fixing entirely (already implemented)
- Hash-based color assignment is per-key stable and never changes
- No color changes at any point during animation or on final render

### SVG Rendering

- Use incremental D3 data joins (already implemented) — no full SVG teardown
- Paths snap to new positions each frame (no D3 transitions, which cause inter-band gaps)
- The data interpolation provides the smoothness, not SVG-level animation

## Acceptance Criteria

1. No visible jumps between any consecutive frames (including last anim → final)
2. Clear left-to-right sweep character during phase 1
3. New artists appear gradually during phase 2, not in batches
4. Big artists (NIN, Aphex Twin for ewarsaba) stay visually stable throughout
5. Colors never change for any artist during animation
6. Final render (labels, overflow, deformed text) is identical to current behavior
7. Animation completes in ~2.5-4 seconds total

## Lessons Learned (from prior implementation attempts)

These were tried and failed — avoid repeating:

1. **D3 path transitions between frames** — each path interpolates its `d` attribute independently, but stacked bands share boundaries (`y1[i] = y0[i+1]`). Mid-transition, bands are at different interpolation points → visible gaps between bands, "looks like a bunch of strings."
2. **Opacity fade-in for new bands** — 400ms fade with 50ms frame interval means bands only reach ~12% opacity before the next frame resets. Result: entire graph appears perpetually faded.
3. **Zero-baseline during animation, silhouette on final** — eliminates thrashing during animation but creates a massive single jump on the last frame.
4. **SVG teardown + rebuild every frame** (`svg.selectAll('*').remove()`) — wasteful and prevents any DOM-level continuity. Use keyed D3 data joins instead.
5. **Recalculating minPlays threshold every frame** — `predictedMinPlays` changes as data arrives, causing the artist set to churn. Hold threshold fixed during sweep, only lower during buildup.
6. **Running text placement on animation frames** — expensive and unnecessary. Only calculate labels on the final frame.

## Scope Boundaries

- **In scope:** Animation rendering, data interpolation, sweep/buildup timing
- **Out of scope:** Final render path, label placement, overflow detection, accuracy tests, data fetching pipeline
