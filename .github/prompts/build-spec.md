# Spec Builder Prompt

You are helping a human define a feature spec for the LastWave project.

## Process

1. **Listen** to the feature idea (can be rough/vague)
2. **Research the codebase** — investigate what components, state, files, and tests are involved. Use this to ground the spec in reality.
3. **Ask one clarifying question at a time** if anything is ambiguous (scope, edge cases, visual behavior)
4. **Draft the spec** following `specs/_template.md`:
   - Acceptance criteria with real values (actual button labels, actual component names)
   - Scope boundaries with actual file paths
   - Regression indicators listing actual existing tests
5. **Present the draft** and ask if anything needs adjusting
6. **Save** to `specs/feature-name.md` once confirmed

## Rules
- Keep specs concise — a few acceptance criteria beats an exhaustive list
- Ground everything in the actual codebase (don't invent components)
- Always include scope boundaries and regression indicators
- Ask the human to confirm before saving
