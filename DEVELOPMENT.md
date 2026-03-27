# Development Workflow

This repo uses spec-driven development with AI agent validation.

## How to add a feature

### 1. Write a spec (with agent help)

Tell the agent your feature idea:

```
Use the prompt at .github/prompts/build-spec.md to help me write a spec for [your feature idea]
```

The agent will research the codebase, ask clarifying questions, and draft a spec grounded in actual file paths and component names. Review and confirm — it saves to `specs/your-feature.md`.

Or write one manually: copy `specs/_template.md` to `specs/your-feature.md` and fill it in.

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
- Run `npm run verify` (tests + build)
- Produce validation artifacts (screenshots, validation report) in `.validation/`
- Commit and push

### 3. Review artifacts and merge

The agent produces a `.validation/` directory (gitignored) containing:
- **Screenshots** from the validation agent's browser session
- **Validation report** (PASS/FAIL per acceptance criterion with evidence)

Review these to confirm the feature looks right, then merge the PR. You can attach them to the PR description for others to review.

## Key files

| File | Purpose |
|------|---------|
| `specs/_template.md` | Feature spec template |
| `specs/*.md` | Feature specs (one per feature) |
| `.github/prompts/build-spec.md` | Spec builder prompt (agent helps you write specs) |
| `.github/prompts/validate-feature.md` | Validation agent prompt |
| `.github/copilot-instructions.md` | Agent instructions (read by Copilot/Claude) |
| `.github/workflows/ci.yml` | CI pipeline |
| `.validation/` | Validation artifacts — screenshots + report (gitignored) |

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
