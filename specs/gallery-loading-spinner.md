# Feature: Gallery Loading Spinner

## Description
Add a loading spinner to the gallery page that displays while gallery images are being fetched from Cloudinary. Currently the gallery shows an empty grid until images load, which feels broken.

## Acceptance Criteria

- GIVEN the user navigates to the gallery page
- WHEN the page is loading gallery images from Cloudinary
- THEN a centered loading spinner is visible
- AND the pagination buttons (Previous/Next) are NOT visible during loading
- AND the "Page X / Y" footer is NOT visible during loading

- GIVEN the gallery images have finished loading successfully
- WHEN the images are rendered in the grid
- THEN the loading spinner is no longer visible
- AND the pagination buttons appear
- AND the image grid shows thumbnails

- GIVEN the gallery image fetch fails
- WHEN the error state is displayed
- THEN the loading spinner is no longer visible
- AND the error message is shown instead

## Visual Expectations
- The spinner should be centered horizontally and vertically in the gallery content area
- Use a simple CSS animation (e.g., rotating ring) — no external spinner library
- Spinner color should use the existing theme accent color (`text-lw-accent`)
- The spinner should be a reasonable size (e.g., 40-48px) — not too large, not too small
- Smooth transition: spinner should disappear cleanly when images appear (no flash/flicker)

## Interaction Flow
1. User clicks "Gallery" in the navigation
2. Gallery page loads — spinner appears immediately (within first paint)
3. Cloudinary API call begins (`fetchWithRetry` to the image list endpoint)
4. While waiting: spinner is visible, pagination is hidden
5. On success: spinner disappears, image grid + pagination appear
6. On error: spinner disappears, error message appears

## Scope Boundaries
- **In scope:** `src/components/GalleryBrowser.tsx` (add loading state + spinner)
- **Out of scope:** `src/pages/gallery.astro`, `src/core/cloudinary/`, `src/core/fetchWithRetry.ts`, any other components

## Regression Indicators
- Gallery error state must still work (shows error message on fetch failure)
- Gallery pagination must still work (Previous/Next buttons, page counter)
- Gallery lightbox must still work (click image to view full size)
- Existing tests must pass: `tests/component/GalleryBrowser.test.tsx`, `tests/e2e/gallery.spec.ts`
