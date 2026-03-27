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
3. **Spawn a validation subagent** to independently verify (use `.github/prompts/validate-feature.md` as a guide — for direct prompts, pass the user's description as the acceptance criteria instead of a spec file)
4. **Fix issues** if the validator finds any (up to 3 rounds)
5. **Write regression tests** if the change is testable
6. **Run `npm run verify`** to confirm tests pass and build succeeds
7. **Save validation artifacts** to `.validation/` — screenshots and report
8. **Commit**

### Feature Specs
- Specs live in `specs/` — template at `specs/_template.md`
- Use `.github/prompts/build-spec.md` to collaboratively write specs with the human
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
When spawning a validation subagent, use the prompt template at `.github/prompts/validate-feature.md`. The subagent:
- Has NOT seen the implementation code
- Reads only the spec + interacts with the running app
- Reports PASS/FAIL per acceptance criterion

## Testing

### Quick verification (run before pushing)
- `npm run verify` — runs unit tests + build

### Individual checks
- Run all tests: `npx vitest run`
- Run accuracy tests: `npm run test:accuracy`
- Run e2e tests: `npm run test:e2e`
- Typecheck: `npm run typecheck` (has pre-existing errors — non-blocking)

## Import conventions

- Import the Zustand store as `@/store/index` (not `@/store`) — a legacy `src/store.ts` file shadows the directory import.
