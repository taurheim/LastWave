# Copilot Instructions

## Development Workflow

This repo supports two modes of development:

### Mode 1: Spec-driven (features)
For new features or significant changes, use a spec from `specs/`. The human writes (or collaboratively builds) a spec first, then says "implement this spec."

### Mode 2: Direct prompt (bugfixes, small changes)
For bugfixes and small changes, the human just describes what they want in a sentence or two. No spec file needed.

**For bugfixes specifically:** Before writing any fix, first reproduce the bug:
1. Try to reproduce it with Playwright CLI (open the app, follow the steps, observe the broken behavior)
2. Or write a failing test that captures the bug
3. Use what you learn to understand the root cause
4. Then fix it, and confirm the reproduction steps now show correct behavior

### What to do in both modes
Regardless of mode, always:
1. **Implement** the change
2. **Self-check with Playwright CLI** — start the dev server, open the browser, verify the change works visually
3. **Spawn a validation subagent** to independently verify (use `/agent validate-feature` or the agent definition at `.github/agents/validate-feature.agent.md` — for direct prompts, pass the user's description as the acceptance criteria instead of a spec file)
4. **Fix issues** if the validator finds any (up to 3 rounds)
5. **Write regression tests** if the change is testable
6. **Run `npm run verify`** to confirm tests pass and build succeeds
7. **Save validation artifacts** to `.validation/` — screenshots and report
8. **Commit**

### Feature Specs
- Specs live in `specs/` — template at `specs/_template.md`
- Use `/agent build-spec` to collaboratively write specs with the human
- Each spec defines: acceptance criteria, visual expectations, interaction flow, scope boundaries

## Browser Interaction (Playwright CLI)

Use `@playwright/cli` for **live browser interaction** during development. This is preferred over writing test scripts.

### Quick reference
```bash
npx playwright-cli open http://localhost:4321   # open browser
npx playwright-cli snapshot                      # get element refs
npx playwright-cli click <ref>                   # click element
npx playwright-cli type "text"                   # type text
npx playwright-cli fill <ref> "text"             # fill input
npx playwright-cli press Enter                   # press key
npx playwright-cli screenshot                    # take screenshot
npx playwright-cli console                       # view console messages
npx playwright-cli network                       # view network requests
npx playwright-cli goto <url>                    # navigate
```

### How it works
Each command returns a snapshot of the page state with element references (e.g., `e5`, `e12`). Read the snapshot, decide your next action, issue the next command. This is live, iterative interaction — no script writing needed.

### Validation subagent
When spawning a validation subagent, use the agent at `.github/agents/validate-feature.agent.md` (invoked via `/agent validate-feature`). The subagent:
- Has NOT seen the implementation code
- Reads only the spec + interacts with the running app
- Reports PASS/FAIL per acceptance criterion
- Saves screenshots and report to `.validation/`

## Testing

### Quick verification (run before pushing)
- `npm run verify` — runs unit tests + build

### Individual checks
- Run all tests: `npx vitest run`
- Run accuracy tests: `npm run test:accuracy`
- Run e2e tests: `npm run test:e2e`
- Typecheck: `npm run typecheck` (has pre-existing errors — non-blocking)

### Wave algorithm changes
When modifying any wave text placement or deformed text code (`src/core/wave/`), always compare `npm run test:accuracy` stats **before** and **after** the change. Record the before/after numbers (Labels, Overflow, Deform Coverage, Straight Coverage, Font Fill) to confirm the change doesn't regress accuracy.

**Note:** The accuracy test currently only covers the non-deformed label placement pipeline (bezierFit, waveW/X/Y/Z). It does NOT test the deformed text computation (`deformTextOptB.ts`). For deformed text changes, visual verification with Playwright CLI is essential.

## Import conventions

- Import the Zustand store as `@/store/index` (not `@/store`) — a legacy `src/store.ts` file shadows the directory import.

## Animation Hard Invariants

When modifying animation code (`LastWaveApp.tsx`, `WaveVisualization.tsx`, `stackOrder.ts`), these invariants must NEVER be violated:

1. **Color continuity:** An artist's color must be identical in the sweep, buildup, AND final render. The `lockedColorMap` is computed once during animation and persists through all phases including the final labeled render. Never clear or recompute it between animation end and final render.

2. **Order continuity:** The stacking order must be identical in the buildup and final render. The same jitter value and ordering algorithm must be used for both. Never switch ordering parameters between the last animation frame and the final render.

Breaking either invariant causes visible color flashing or band jumping on the animation→final transition, which is the most jarring visual artifact in the system. See `specs/animation-smoothing.md` for full context.
