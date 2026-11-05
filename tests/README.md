# Basic tests from the Week 10 lessons

These tests use the same tools and structure as the class examples. All files are JavaScript.

The lecture examples use pnpm. This project uses npm workspaces, so the commands below use npm to run the same Vitest and Playwright tools.

| Class lesson | Test file | What it checks |
| --- | --- | --- |
| Week 10a: Unit testing | `frontend/src/utils/__tests__/carparks.spec.js` | Distance formatting and carpark ranking |
| Week 10b: Component testing | `frontend/src/components/__tests__/StarRating.spec.js` | Rating display, clicks, hover and read-only mode |
| Week 10b: Integration testing | `frontend/src/components/__tests__/CommunityCarparkCard.integration.spec.js` | A real community card passes its rating to the real StarRating child |
| Week 10c: E2E testing | `frontend/tests/e2e/carpark-app.spec.js` | Incorrect login, login/search/profile flow and registration validation |
| Additional bug regressions | `frontend/src/views/__tests__/submission-regressions.spec.js` | Slow responses, search errors, saved filters/favourites, missing walking metrics and failed cost updates |
| Additional backend regressions | `tests/backend/submission-regressions.test.mjs` | Input validation, routing failures, search timeouts and token renewal |

## 1. Run the Vitest tests

Open a terminal in the project root:

```bash
cd frontend
npm test
```

To run only one file, like the examples in class:

```bash
npm test -- src/components/__tests__/StarRating.spec.js
```

To rerun tests automatically when you save changes:

```bash
npm exec -- vitest
```

Press `q` to quit watch mode. The Vitest tests use small sample objects and do not need the servers or database to run.

## 2. Run the Playwright tests

Start the app from the project root in a separate terminal:

```bash
npm run dev
```

The app should be on `http://localhost:5173`, with the backend on port 3000. E2E tests use the real backend, MongoDB, OneMap and LTA. The successful login test uses the existing demo account `aisha@test.com` with password `qwertyuiop`, defined in `backend/scripts/seedCommunity.js`. That account must already exist. If it is not in your database, replace those two demo values with a dedicated test account you created. Do not use a personal account password in committed test code.

Install Google Chrome if it is not already installed. `frontend/playwright.config.js` uses `channel: 'chrome'`, so these tests run in an isolated Chrome profile and do not require Playwright's bundled Chromium.

Then run:

```bash
npm run test:e2e
```

Open the HTML test report, as taught in class:

```bash
npm exec -- playwright show-report
```

These tests do not create reviews, vote, change favourites or create an account. The successful journey creates a normal login session and updates that demo account's recent searches. The destination button is selected within the suggestions list to distinguish it from recent-search buttons. External API or database failures can cause E2E tests to fail even when the Vitest tests pass.

## Understanding the code

- `describe()` groups related tests.
- `it()` defines one Vitest test case.
- `expect(actual).toBe(expected)` checks a simple value.
- `toEqual()` checks array or object contents.
- `toHaveLength()` checks how many items are present.
- `mount()` displays a Vue component in the test environment.
- `props` provide sample input to the component.
- `await wrapper.find(...).trigger(...)` simulates a component interaction.
- `wrapper.unmount()` removes that mounted component afterwards.
- The integration test mounts the actual parent and StarRating child. Its RouterLink is a simple stub because navigation is covered by the E2E test.
- Playwright's `page.goto()`, `fill()` and `click()` perform browser actions.
- `await expect(...).toBeVisible()` checks the result of a user action.

The original class-example tests use automatic waiting rather than fixed delays. The additional regression files use mocked API responses and controlled promises to reproduce slow connections and failures without changing real accounts. They use the existing Vitest and Node test tools.

Run all backend checks from the project root with `node --test tests/backend/*.test.mjs`. No servers or real API credentials are needed for those checks.
