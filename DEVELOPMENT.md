# Development Workflow

This repo uses spec-driven development with AI agent validation.

## How to add a feature

### 1. Write a spec

Copy `specs/_template.md` to `specs/your-feature.md` and fill it in:
- **Acceptance criteria** — Given/When/Then statements
- **Visual expectations** — what the user should see
- **Scope boundaries** — what files to touch (and not touch)

Keep it short. The spec is the only thing you write by hand.

### 2. Tell the agent to implement it

```
Implement the feature described in specs/your-feature.md
```

The agent will:
- Read the spec
- Implement the feature
- Self-check using Playwright CLI (live browser interaction)
- Spawn a validation subagent to independently verify it works
- Fix any issues the validator finds (up to 3 rounds)
- Write regression tests after validation passes

### 3. Verify and push

```bash
npm run verify    # runs tests + build
```

Push and open a PR. CI runs automatically (typecheck, unit tests, accuracy tests, build, e2e).

## Key files

| File | Purpose |
|------|---------|
| `specs/_template.md` | Feature spec template |
| `specs/*.md` | Feature specs (one per feature) |
| `.github/prompts/validate-feature.md` | Validation agent prompt |
| `.github/copilot-instructions.md` | Agent instructions (read by Copilot/Claude) |
| `.github/workflows/ci.yml` | CI pipeline |

## How validation works

The implementation agent and validation agent are **separate sessions** with different context:

- **Implementation agent** — sees the code, uses browser to self-check
- **Validation agent** (subagent) — has NOT seen the code, only reads the spec and interacts with the running app via browser

This separation ensures the validator independently confirms the feature works as a real user would experience it.

## Commands

```bash
npm run dev           # start dev server (localhost:4321)
npm run verify        # quick check: tests + build
npm run test          # unit + component tests
npm run test:accuracy # wave algorithm accuracy
npm run test:e2e      # playwright e2e tests
npm run typecheck     # typescript (has pre-existing errors)
```
