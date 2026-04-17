# Feature: Click Outside to Close Customize Panel (Desktop)

## Description
On desktop, clicking outside the customize panel should close it. Currently the panel can only be closed by clicking the "Hide customize" button. This is a common UI pattern for floating panels.

## Acceptance Criteria

- GIVEN the customize panel is open on desktop (viewport ≥ 1024px)
- WHEN the user clicks on the visualization area (outside the panel)
- THEN the customize panel closes

- GIVEN the customize panel is open on desktop
- WHEN the user clicks inside the customize panel (on a control, checkbox, dropdown, etc.)
- THEN the customize panel remains open

- GIVEN the customize panel is open on desktop
- WHEN the user clicks the "Hide customize" button
- THEN the customize panel closes (existing behavior preserved)

- GIVEN the customize panel is open on desktop
- WHEN the user clicks the "Customize" toggle button that opened it
- THEN the customize panel closes (existing toggle behavior preserved)

- GIVEN the app is in mobile layout (viewport < 1024px)
- WHEN the customize panel is open
- THEN click-outside behavior is NOT active (panel is inline, not floating)

## Visual Expectations
- No visual changes — this is purely a behavioral change
- Panel should close immediately on outside click, no animation delay

## Interaction Flow
1. User generates a wave chart
2. User clicks "Customize" button — panel appears floating on the right
3. User adjusts settings (clicks checkboxes, changes dropdowns) — panel stays open
4. User clicks on the wave chart area — panel closes
5. User can reopen by clicking "Customize" again

## Scope Boundaries
- **In scope:** `src/components/LastWaveApp.tsx` (add click-outside handler for desktop layout)
- **Out of scope:** `src/components/CustomizePanel.tsx`, `src/components/OptionActions.tsx`, store, mobile layout

## Regression Indicators
- Customize panel must still open/close via the toggle button
- Panel must still work on mobile (inline, no click-outside)
- All panel controls must remain interactive (clicking inside panel must NOT close it)
- Existing tests must pass
