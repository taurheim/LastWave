# Copilot Instructions

## Testing

After implementing features or fixing bugs, always verify changes using the **Playwright CLI** in headless mode.

### How to test

Write a `.cjs` script (the project uses `"type": "module"`) that launches a headless browser, navigates to the dev server, and validates the expected behavior:

```js
const { chromium } = require('playwright');
(async () => {
  const browser = await chromium.launch(); // headless by default
  const page = await browser.newPage();
  page.on('console', msg => console.log('BROWSER:', msg.text()));
  page.on('pageerror', err => console.log('PAGE ERROR:', err.message));

  await page.goto('http://localhost:4322');
  // ... interact and assert ...
  await browser.close();
})();
```

Run with `node test-script.cjs` and clean up the script afterward.

**Do NOT use `--headed` mode.** Always run headless.

### References

- Playwright CLI docs: https://playwright.dev/docs/cli
- Playwright test library: https://playwright.dev/docs/library

### Unit / component tests

- Run all tests: `npx vitest run`
- Run accuracy tests: `npm run test:accuracy`
- Run e2e tests: `npm run test:e2e`

## Import conventions

- Import the Zustand store as `@/store/index` (not `@/store`) — a legacy `src/store.ts` file shadows the directory import.
