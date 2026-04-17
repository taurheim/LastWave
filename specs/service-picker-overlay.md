# Service Picker Overlay Design

## Problem

The service picker (last.fm / ListenBrainz / Spotify icons) currently floats outside the username input to the right, requiring the input to have `mr-14` margin on mobile. This wastes horizontal space and creates an awkward disconnected layout.

## Proposed Design

Move the service picker icons **inside** the username input, anchored at its right edge. When expanded, labels appear to the right of the icons (overflowing past the input boundary). On mobile portrait, the input shrinks from the right to make room for the labels.

## Layout States

### Collapsed (all breakpoints)
- Icon column sits inside the input at `right: 8px`, vertically centered
- Input has right padding (~52px) so typed text doesn't overlap the icons
- Active service icon is larger (current 40px vs 24px behavior preserved)
- Inactive icons are smaller and faded (current behavior preserved)
- No labels visible

### Expanded — Desktop (sm+)
- Icons stay in the exact same position (right edge of input)
- Labels appear to the right of each icon using absolute positioning (`left: 100%`)
- Labels overflow past the input's right border — they do NOT affect icon position
- Input width does not change on desktop
- The existing ServiceWheel animation (3D perspective tilt, opacity transitions) is preserved

### Expanded — Mobile Portrait (<sm)
- Input shrinks from the right (adds right margin or reduces width) to make room for labels
- Icons stay anchored at the right edge of the (now narrower) input
- Labels extend into the freed space
- Transition is animated (smooth width/margin change, ~300ms)

## Interaction

- Click the icon column to toggle dropdown open/closed (current behavior)
- Selecting a service auto-closes the dropdown (current behavior)
- Clicking outside closes the dropdown (current behavior)
- Clicking Spotify opens the Spotify setup modal (current behavior)

## Implementation Approach

### ServiceWheel.tsx changes
- Labels use `position: absolute; left: 100%` instead of the current approach (which was recently changed to inline flex). This ensures icons never shift when labels appear.
- The `flex-row-reverse sm:flex-row` approach from the recent change should be replaced since labels no longer need to swap sides — they always go right.

### WaveOptions.tsx changes
- Remove the `translate-x-[calc(100%+0.5rem)]` positioning that places the wheel outside the input
- Position the ServiceWheel inside the input container with `absolute right-2 top-1/2 -translate-y-1/2`
- Remove the `mr-14` mobile margin on the input wrapper
- Add `pr-14` (or similar) padding to the input so text doesn't overlap icons
- When `serviceDropdownOpen` is true on mobile (<sm), add a transition that shrinks the input from the right (e.g., `pr-28` or similar) to make room for labels

### What stays the same
- ServiceWheel component API (props unchanged)
- All click handlers and state management
- Auto-close on selection
- Click-outside detection
- Spotify modal integration
- Icon sizing and opacity transitions
- 3D perspective effects on inactive icons

## Acceptance Criteria

1. Collapsed: icons visible inside the input at the far right edge
2. Expanded desktop: icons don't move, labels appear to their right, overflowing past input
3. Expanded mobile: input shrinks from right, icons stay at input's right edge, labels have room
4. All transitions are smooth (~300ms)
5. Clicking a service selects it and auto-closes
6. Click outside closes dropdown
7. Spotify click opens modal
8. Typed username text doesn't overlap icons
9. No layout shift when toggling — icons stay in place
