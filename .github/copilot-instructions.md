# Copilot Instructions

## Spec-Driven Development

This repo uses **spec-driven development** with autonomous agent validation.

### Workflow
1. **Read the spec** in `specs/` before implementing any feature
2. **Implement** the feature based on the spec's acceptance criteria
3. **Self-check** with Playwright CLI (see below) — inspect DOM, check console, verify visual output
4. **Spawn a validation subagent** that independently validates the feature against the spec
5. **Write regression tests** after validation passes
6. **Run `npm run verify`** to confirm tests pass and build succeeds
7. **Save validation artifacts** to `.validation/` — screenshots and validation report from the subagent
8. **Commit and push**

### Feature Specs
- Specs live in `specs/` — read the relevant spec before starting work
- Template: `specs/_template.md`
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
