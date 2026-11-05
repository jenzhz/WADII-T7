# CarparkCompare SG — WADII-T7

IS216 Web Application Development II · Singapore Management University · 2026–2027 Term 1

CarparkCompare SG helps drivers compare parking near a Singapore destination using current lot availability, walking routes, estimated parking costs and community experiences.

## Application and presentation links

| Item | Link / status |
| --- | --- |
| **Live application — start here** | **https://ccsg-frontend.vercel.app/** |
| Backend API health | https://ccsg-backend.vercel.app/api/health |
| API health through the website | https://ccsg-frontend.vercel.app/api/health |
| Source repository | https://github.com/jenzhz/WADII-T7 |
| Development / deployed branch | `dev` |
| Presentation video | **Pending — add the final public/unlisted YouTube URL before submission** |

The frontend entry file is `frontend/index.html`, served at the website's root URL. Signed-out visitors are directed to `/login`; signing in opens the search homepage. The backend is an API, so its bare `/` address is not a website homepage.

## Demo login

| Email | Password | Purpose |
| --- | --- | --- |
| `aisha@test.com` | `qwertyuiop` | Seeded demonstration account; also used by Playwright |

These demonstration credentials are defined in `backend/scripts/seedCommunity.js`, not database or API credentials. They work when the community seed has been loaded into the selected database. The login/search portion of the existing E2E journey was exercised with this account during this README review.

Alternatively, register with a name, an unused email and a password of at least eight characters. Registration signs the user in. Email verification is not implemented.

## Problem and solution

Drivers must balance cost, available lots and distance from their destination. Availability can change before arrival, while prices and lot counts do not explain narrow entrances, confusing signs or difficult parking layouts.

The application combines those decisions in one flow:

**Register / log in → choose destination and vehicle → find nearby carparks → compare options / explore the map → view a walking route → save places and contribute reviews.**

## Implemented features

| Feature | Current behaviour |
| --- | --- |
| Accounts | Register, log in and log out using MongoDB accounts, bcrypt password hashes and server-side cookie sessions. Protected pages require login. |
| Destination lookup | OneMap suggestions update while typing. Selecting one supplies the destination name/coordinates; Search is disabled until a result is selected. |
| Current location | Browser geolocation can supply the destination after permission is granted. A coordinate check rejects locations outside Singapore. |
| Vehicle types | Car (`C`), motorcycle (`Y`) and heavy vehicle (`H`), subject to LTA coverage. |
| Recent searches | Up to five named destinations saved to the user's MongoDB account. Reuse, remove or clear them. Current-location searches are not retained. |
| Nearby results | Radius choices from 250 m to 5 km, nearest/most-available sorting, EV filtering, availability refresh, community information, favourites and compare selection. Walking summaries load progressively. |
| Comparison | Compare two or three carparks; prioritise Closer, Available lots or Cheapest. Changing parking duration refreshes estimated costs. Recommended cards and best figures are highlighted. |
| Maps and routes | Leaflet destination/carpark markers, availability popups and walking routes. Map views retain relevant Results filters or comparison selections. |
| Carpark details | Available lots, rate schedules, walking distance/time, route map and directions when destination context is supplied. |
| Favourites | Separate saved destinations/carparks; select a destination for its top three nearby options, change vehicle/preference or remove saved items. |
| Community guide | Find reviewed carparks near a destination, filter parking difficulty, inspect vote distributions/category scores and view a beginner shortlist. |
| Reviews and replies | Overall stars, required difficulty/comment, optional space/access/signage/pricing scores, multiple reviews and replies, plus owner-only edit/delete. |
| Helpful votes | Mark another author's review helpful and undo the vote. Self-voting is blocked. |
| Profiles | Own/member review histories, reviewed-location minimaps, contributor points and badges, and a levels popup. Own author links open the personal profile. |

Contributor points come from helpful votes received: **10 points per vote**, not per review. Undoing a vote removes its points. The displayed helped-driver total counts votes across reviews, not necessarily unique people.

| Level | Helpful votes received | Points |
| --- | --- | --- |
| New Contributor | 0 | 0 |
| Helpful Contributor | 1–4 | 10–40 |
| Trusted Contributor | 5–9 | 50–90 |
| Community Champion | 10+ | 100+ |

## Live data, sample data and limitations

**The team's chosen deployment uses live lot availability and sample parking rates. These are independent settings.**

| Data | Source / interpretation |
| --- | --- |
| Destination lookup | OneMap Search, first results page; returns destination names, addresses and coordinates. |
| Parking availability | LTA DataMall `CarParkAvailabilityv2`, fetched in pages of 500. Cached up to 60 seconds per backend instance, so Refresh may return unchanged counts. Availability is not guaranteed at arrival. |
| Walking routes | OneMap pedestrian routing; metres and minutes, decoded route geometry and directions. Results fetches the first few summaries immediately and others as cards become visible. Failed routes can leave a dash. |
| Proximity | Haversine straight-line distance for radius and Results nearest sorting; this differs from actual walking-route distance. Comparison uses walking time when known, otherwise straight-line distance divided by 80 metres/minute. Full carparks are placed after available ones. |
| Most-available sorting | Results caps the effective radius at 1 km in this mode, even if a larger distance was selected. |
| **Sample rates** | `USE_MOCK_RATES=true` supplies sample rates for **all** carpark types, including time/day-dependent examples. It is not just a fallback for missing prices. Cheapest recommendations demonstrate the comparison logic and are not official charges. |
| Alternative rate mode | With full mock rates off, the code uses HDB rules and the included mall-rate CSV/JSON where available. `USE_MOCK_URA_RATES=true` separately enables sample URA rates. Missing rates do not mean free parking. |
| EV indicator | LTA `EVCBatch`, cached up to five minutes. Available charging points within **150 m** are associated with a carpark. This does not guarantee a charger inside that exact carpark, connector compatibility or availability on arrival. |
| Community data | Seeded fictional demonstration reviews/replies/votes alongside user submissions. Seeded content is not independently collected driver testimony. |
| Profile map | Only locations with valid coordinates can be plotted; reviews can remain listed without a marker. |

There are no reservations, payments, guaranteed spaces or driving navigation. Walking metrics require a destination; open details from Results/Map with the selected destination. An existing details-display limitation can render missing distance as `0 m`; this is not proof of a confirmed zero-length route.

## Technology, architecture and storage

| Layer | Technologies |
| --- | --- |
| Frontend | HTML, JavaScript, Vue 3, Vue Router, Vite, Axios |
| Styling | Bootstrap 5, custom CSS, grid/flex layouts, media queries |
| Maps | Leaflet, OpenStreetMap tiles, `@mapbox/polyline` route decoding |
| Backend | Node.js, Express 5, controllers/services, validation/error middleware |
| Authentication | bcrypt, `express-session`, MongoDB session store via `connect-mongo` |
| Database | MongoDB Atlas through Mongoose |
| Tests | Vitest, Vue Test Utils, jsdom, Playwright, Node's built-in test runner |
| Hosting | Two Vercel projects: frontend and backend |

Requests follow **Vue → shared Axios client → Express route → controller → service / Mongoose model → JSON response → reactive view update**. OneMap search uses Axios; backend token/routing and LTA services also use asynchronous Node `fetch`. External credentials stay on the backend.

### Where data is stored

- **MongoDB `User`:** name, email, password hash and recent searches.
- **MongoDB `Favourite`:** owner, type, label, coordinates and optional carpark ID.
- **MongoDB `Review`:** author, carpark ID, ratings, difficulty, comment, helpful-voter IDs and embedded replies.
- **MongoDB sessions:** server-side session data; browser authentication uses an HTTP-only cookie, secure over HTTPS in production. Login uses sessions, **not JWT login tokens**.
- **Browser localStorage:** cached public user details, current search/vehicle and last comparison. It is not shared storage or sufficient proof of authentication.
- **Backend memory:** temporary availability, charging, route and token caches; these can reset between Vercel instances/restarts.
- **Repository files:** rate schedules and sample data. Live lot counts are not saved into the user database.

### Dynamic interactions and responsive design

- `v-model` links inputs/filters to reactive data; `@input` triggers search requests; `v-for` renders suggestions/cards and `v-if` controls loading, error and empty states.
- Computed results/rankings react to preferences. `watch(duration, refreshCosts)` refreshes estimated costs while keeping comparison cards visible.
- Reusable components include `CarparkCard`, `FilterDropdown`, `StarRating`, `CarparkMap` and the levels dialog. Props/emitted events connect them to parent views.
- Results uses `col-12 col-md-6 col-lg-4`: one, two or three cards per row as width increases. The navbar collapses below the medium breakpoint; the homepage becomes one column below 575 px.
- Shared colours/typography, active navigation, focus/hover states, disabled controls and short transitions provide feedback. `prefers-reduced-motion` reduces animations.

## Local setup from the submitted source

### 1. Prerequisites and source

- **Node.js 22.12+ within the 22.x line, or Node.js 24.x**, with npm. The installed Vitest version requires these supported lines; Node 20 is insufficient for the complete test suite.
- Google Chrome for browser/responsiveness checks.
- A reachable MongoDB database, a OneMap account and an LTA DataMall account key.

Extract the submission ZIP and open a terminal in the folder containing the root `package.json`. Alternatively, with repository access:

```bash
git clone --branch dev https://github.com/jenzhz/WADII-T7.git
cd WADII-T7
```

### 2. Install dependencies

From the repository root:

```bash
npm ci
```

This installs both npm workspaces using the root `package-lock.json`. Use npm consistently for this documented workflow.

### 3. Configure environment files

For a **fresh checkout only**:

```bash
cp backend/.env.example backend/.env
cp frontend/.env.example frontend/.env
```

Edit existing files instead of overwriting working credentials. Obtain credentials privately from the team or use your own accounts. No database passwords, API keys or session secrets are included here.

**`backend/.env`:**

| Variable | Local value / meaning |
| --- | --- |
| `PORT` | `3000` |
| `FRONTEND_URL` | `http://localhost:5173` |
| `MONGODB_URI` | MongoDB connection string with the intended database name/options |
| `SESSION_SECRET` | Long random secret; required for startup |
| `LTA_API_KEY` | DataMall account key |
| `ONEMAP_EMAIL` | OneMap account email |
| `ONEMAP_PASSWORD` | OneMap password; use this exact variable name |
| `ONEMAP_TOKEN` | Optional fixed-token fallback without email/password renewal; expires |
| `USE_MOCK_RATES` | **`true`** to reproduce the team's chosen sample-rate demonstration |
| `USE_MOCK_URA_RATES` | **`true`** for the team's configuration; full mock mode takes precedence |

The example file currently defaults `USE_MOCK_RATES` to `false`; explicitly set it to `true` for this demo. `ONEMAP_EMAIL_PASSWORD` is a legacy name not read by the current service. With email/password configured, OneMap tokens renew automatically.

Use the team's existing database for existing demo users/reviews. Changing the database name selects a different dataset. Atlas must allow connections from the machine/deployment running the backend.

To generate a new session secret locally if needed:

```bash
node -e "console.log(require('node:crypto').randomBytes(32).toString('hex'))"
```

**`frontend/.env`:**

```dotenv
VITE_API_BASE_URL=http://localhost:3000/api
VITE_CARPARK_DATA_MODE=live
```

Only public configuration belongs in `VITE_` variables, which are embedded in the browser bundle. Keep secrets on the backend. Leave `NODE_ENV` unset for local HTTP development; production secure cookies require HTTPS. Restart the relevant process after environment changes.

### 4. Run the app

```bash
npm run dev
```

- Website: http://localhost:5173/
- Backend health: http://localhost:3000/api/health

Keep the terminal running. Log in/register, search **SMU Connexion** or **Suntec City**, select a suggestion, choose a vehicle and press Search.

To run each side separately in two terminals:

```bash
npm run dev:backend
```

```bash
npm run dev:frontend
```

Use normal backend startup for database/authentication features. `backend/testSearchServer.js` is an earlier development helper and does not replace database startup.

### 5. Optional fresh-database demo data

Skip this for the already-populated team database. On a separate development database, with MongoDB/LTA credentials configured:

```bash
npm run seed:community --workspace backend
```

The script creates demo accounts, fictional reviews, replies and helpful votes using live LTA carpark IDs. It requires those configured IDs to exist in the feed. **Rerunning deletes/recreates records marked `isDemo`, including demo-user IDs.** Do not reseed the shared database during grading or while teammates use/record it. `seed:community:clear` also deletes demo records and is not a setup requirement.

For legacy databases only, `migrate:review-multiple` removes the former one-review-per-user/carpark index; `migrate:review-pricing` renames the former EV-rating field. These are database-owner maintenance tasks, not routine fresh-database startup steps.

## Build and preview

From the repository root:

```bash
npm run build
```

The build is written to `frontend/dist`. To preview it locally:

```bash
npm run preview --workspace frontend
```

Use the printed preview URL, normally port 4173. Keep the backend running; set its `FRONTEND_URL` to the preview origin and restart it. Root `npm start` runs **only the backend**, not the built frontend. Vercel hosts the frontend separately.

## Testing

### Automated tests and commands

Run commands from the repository root unless otherwise stated.

| Approach | Files | Coverage |
| --- | --- | --- |
| Unit — Vitest | `frontend/src/utils/__tests__/carparks.spec.js` | Distance formatting, preference ranking, full-carpark ordering and empty input |
| Component — Vue Test Utils / Vitest | `frontend/src/components/__tests__/StarRating.spec.js` | Stars, selected state, click events, hover and read-only mode |
| Integration — Vue Test Utils / Vitest | `frontend/src/components/__tests__/CommunityCarparkCard.integration.spec.js` | Real parent/child components, rating prop changes and empty state |
| E2E — Playwright | `frontend/tests/e2e/carpark-app.spec.js` | Invalid login, login/search/results/profile/levels journey, password-confirmation validation |
| Backend — Node test runner | `tests/backend/lta.test.mjs` | Mapping/distance, mocked pagination/cache/filtering, missing key and invalid queries |

**Unit/component/integration tests** need no servers, database or external credentials:

```bash
npm test --workspace frontend
```

**E2E:** install Playwright's browser once:

```bash
cd frontend
npm exec -- playwright install chromium
cd ..
```

Start `npm run dev` in one terminal, then in another:

```bash
npm run test:e2e --workspace frontend
```

E2E hardcodes `http://localhost:5173`; it does **not** automatically test the deployed URL. It needs the real backend/database/APIs and the seeded Aisha account. It uses roles/labels where available and automatic waiting. It creates a login session but does not create accounts/reviews/favourites or change helpful votes.

Open the HTML report:

```bash
cd frontend
npm exec -- playwright show-report
```

Generated reports are in `frontend/playwright-report`, failure artifacts in `frontend/test-results`; both are ignored by Git. See `tests/README.md` for class-style test explanations.

**Backend tests** mock HTTP calls and need no live API key:

```bash
node --test tests/backend/lta.test.mjs
```

### Verified status and outstanding test maintenance

Checks run on **5 November 2026** during this README update:

| Check | Observed result |
| --- | --- |
| Vitest | **17 passed** across three test files |
| Playwright with existing local servers | **2 passed, 1 failed** |
| Node backend tests | **4 passed, 1 failed** |
| Published website `/api/health` | HTTP 200, `success: true` |

The recorded E2E run stopped at Results because it expected the old **“Retrieved”** text instead of **“Updated”**, before reaching the profile/levels assertions. Commit `a45ac3d`, subsequently pulled from `dev`, fixes that assertion and configures Playwright to use Chrome; the suite has not been rerun since that change. The backend pagination test counts the newer `EVCBatch` request as an availability-page request, making its expected URL list outdated. Fix the backend expectation and rerun both suites before claiming an all-passing suite.

Automated coverage is selective, not exhaustive. Live API/database problems can also affect E2E independently of unit/component tests.

### Manual acceptance checks

Run on the deployed app in Chrome, including incognito. Check phone/tablet/desktop layouts, including a 375 px phone viewport and Bootstrap XL (1200 px or wider).

| ID | Action | Expected result |
| --- | --- | --- |
| M01 | Mismatched passwords; valid registration; duplicate email | Clear validation, successful sign-in, duplicate rejected |
| M02 | Logout, invalid login, correct login and reload | Errors shown; authenticated session survives reload; private routes require login |
| M03 | Type/select destination and change vehicle | Correct suggestions; chosen coordinates/vehicle reach Results |
| M04 | Reuse/remove/clear recent searches; reload or sign in elsewhere | Changes persist to the account; maximum five named searches |
| M05 | Allow/deny current-location access | Singapore location usable; denied/out-of-area cases have feedback |
| M06 | Change radius/sort/EV filter and refresh | Cards/count update; unknown availability differs from zero; cached counts may repeat |
| M07 | Compare 2–3 carparks; change preference/duration | Recommendation and sample estimates update; more than three selections prevent comparison |
| M08 | Map from Results/Compare; marker popup and route | Relevant filters/selected carparks retained; route shown when available |
| M09 | Details opened with destination context | Availability/rates and OneMap walking metrics/directions shown where available |
| M10 | Save destination/carpark, reload, select destination and remove item | Separate persisted sections, top-three options and removal reflected |
| M11 | Community search/difficulty filters | Relevant reviewed carparks, vote breakdown and beginner shortlist |
| M12 | Create/edit/delete disposable review/reply | Changes persist; ownership limits edit/delete |
| M13 | Helpful vote on another author; undo | Vote/points update; self-voting blocked |
| M14 | Own/other profile, reviewed-location pin and levels popup | Correct profile context, review links and contribution information |
| M15 | Resize, mobile menu, keyboard focus and nested-URL refresh | Usable stacked layouts, navigation/focus feedback and no route 404 |

Record actual results separately; this checklist is not an all-passed claim. Earlier `docs/` notes and `tests/manual/ui-test-cases.md` contain historical scaffold descriptions. This README/current source supersede those descriptions. The legacy Postman placeholder collection is not the current acceptance suite.

## Vercel deployment

Two projects use this repository's `dev` branch; MongoDB remains on Atlas.

| Setting | Backend | Frontend |
| --- | --- | --- |
| Project | `ccsg-backend` | `ccsg-frontend` |
| Root Directory | `backend` | `frontend` |
| Preset | Express | Vite |
| Build / output | Express defaults | `npm run build` / `dist` |
| Production branch | `dev` | `dev` |

1. Add backend variables privately in Vercel, including `NODE_ENV=production` and `FRONTEND_URL=https://ccsg-frontend.vercel.app` (no trailing slash). Keep both mock-rate flags `true` for the team's demo.
2. Configure Atlas network access for the hosting environment. A laptop-only IP entry is insufficient. Keep the database credentials private and use a restricted database user.
3. Deploy backend and check `/api/health`. Vercel loads `backend/app.js`, which connects to MongoDB and configures proxy trust for HTTPS cookies. Local startup remains in `backend/server.js`.
4. Add frontend variables `VITE_API_BASE_URL=/api` and `VITE_CARPARK_DATA_MODE=live`, then deploy.
5. `frontend/vercel.json` forwards `/api/:path*` to `https://ccsg-backend.vercel.app/api/:path*` before falling back to `/index.html` for Vue routes. Browser API requests use the website's origin.
6. Confirm production uses `dev`, not the old `main`. If a new project imports `main`, change **Settings → Environments → Production → Branch Tracking** to `dev` and create a deployment from `dev`.
7. Redeploy after environment changes. Vite variables are embedded at build time. Test login/refresh and core journeys on the public production URL without requiring a Vercel account.

The health check confirms startup/API forwarding, not every authenticated operation. Keep `FRONTEND_URL` in sync if the website domain changes.

## External APIs, credits and application endpoints

| Source | Integration |
| --- | --- |
| [OneMap](https://www.onemap.gov.sg/apidocs/) | Backend token authentication; `/api/common/elastic/search` for destinations and `/api/public/routingsvc/route` with `routeType=walk` for routes |
| [LTA DataMall](https://datamall.lta.gov.sg/) | Backend `AccountKey` header; `CarParkAvailabilityv2` and `EVCBatch` |
| [OpenStreetMap](https://www.openstreetmap.org/copyright) | Leaflet base-map tiles with attribution retained; separate from OneMap routing |

Useful backend routes, relative to `/api`:

| Route | Purpose |
| --- | --- |
| `GET /health` | Public startup check |
| `POST /users/register`, `POST /users/login`, `POST /users/logout`, `GET /users/profile` | Account/session flow |
| `GET/POST/DELETE /users/recent-searches`, `DELETE /users/recent-searches/:id` | Signed-in user's history |
| `GET /locations/search?q=Suntec` | Destination lookup |
| `GET /carparks/nearby?latitude=1.29558&longitude=103.84933&radius=1000&vehicleType=C` | Nearby availability; radius in metres, optional duration in minutes |
| `GET /locations/walking-route?originLat=...&originLng=...&destLat=...&destLng=...` | Walking summary |
| `GET /carpark-details?carparkId=...&latitude=...&longitude=...&vehicleType=C` | Destination-aware details |
| `GET/POST /favourites`, `DELETE /favourites/:id` | Signed-in user's saved places |
| `GET /reviews/community`, `GET /reviews/carpark/:carparkId` | Public summaries/reviews |
| `GET /reviews/mine`, `GET /reviews/user/:userId` | Signed-in own/member review profiles |
| `POST /reviews`, `PUT/DELETE /reviews/:reviewId` | Create/owner-edit/owner-delete |
| `PUT /reviews/:reviewId/helpful` | Toggle helpful vote on another author's review |
| `POST /reviews/:reviewId/replies`, `PUT/DELETE /reviews/:reviewId/replies/:replyId` | Reply creation and owner edit/delete |

Libraries are credited in package manifests and are not team-authored frameworks. Fonts loaded through Google Fonts are Inter and Plus Jakarta Sans. The parking marker is the included `parking-location-svgrepo-com.svg`; preserve its original asset attribution/licensing information when redistributing. Rate-source references appear in service files. Identify sample rates and seeded community content as demonstration data in the presentation.

## Pages and source layout

| Route | View / access |
| --- | --- |
| `/login` | `AuthView.vue` — login/register |
| `/` | `HomeView.vue` — signed-in homepage |
| `/results`, `/map`, `/compare` | `ResultsView.vue`, `MapView.vue`, `CompareView.vue` — signed in |
| `/carparks/:id` | `CarparkDetailsView.vue` — public reading; write actions require login |
| `/favourites` | `FavouritesView.vue` — signed in |
| `/community` | `CommunityView.vue` — publicly readable |
| `/profile`, `/profile/:userId` | `ProfileView.vue` — signed-in own/member views |

```text
WADII-T7/
├── frontend/
│   ├── src/assets/           Styles, motion and icons
│   ├── src/components/       Shared cards, maps, reviews, stars and controls
│   ├── src/views/            Route-level pages
│   ├── src/router/           Routes and session guards
│   ├── src/services/         Axios/auth/review/recent-search clients
│   ├── src/utils/            Ranking, formatting and difficulty helpers
│   ├── src/data/             Explicit sample availability
│   ├── src/**/__tests__/     Vitest tests
│   ├── tests/e2e/            Playwright tests
│   ├── index.html            Frontend entry
│   └── vercel.json           API proxy and Vue route fallback
├── backend/
│   ├── config/              Database connection
│   ├── routes/              Express endpoints
│   ├── controllers/         Request handling and validation
│   ├── services/            OneMap, LTA and rate adapters
│   ├── models/              User, Favourite and Review schemas
│   ├── middleware/          Auth/error handling
│   ├── data/                Rate CSV and generated JSON
│   ├── scripts/             Optional seeds/migrations/rate utilities
│   ├── app.js               Express application / Vercel entry
│   └── server.js            Local database and HTTP startup
├── tests/backend/           Node tests
├── docs/                    Earlier design/integration notes
├── package.json             Root npm workspace scripts
├── package-lock.json        Locked workspace dependencies
└── README.md                Current project documentation
```

`MockAccountsView.vue` and `services/mockAuth.js` are legacy files. `/mock-accounts` is not a current route; active authentication uses the backend.

## Troubleshooting

| Symptom | Check |
| --- | --- |
| Backend exits | `MONGODB_URI` and `SESSION_SECRET` are required; verify database credentials/network access. |
| Local connection refused | Run the backend on port 3000; `npm run dev` starts both processes. |
| Deployed login/session problems | Check deployed `dev`, HTTPS cookie/proxy settings, frontend `/api` rewrite and backend `FRONTEND_URL`. |
| OneMap token expires/rejected | Use `ONEMAP_EMAIL` and `ONEMAP_PASSWORD` exactly; a fixed token alone expires. Restart/redeploy after changes. |
| LTA discovery fails | Check backend-only `LTA_API_KEY` and API connectivity. Sample rates do not replace missing live availability. |
| Missing walking data | Supply destination context and valid coordinates; check OneMap. Some card routes load only as they become visible. |
| Empty EV filter | No available points may be matched within 150 m, or charging data may be unavailable; this is not proof that no charger exists. |
| No demo account/community data | Check which database the URI selects; register or deliberately seed a separate development database. |
| Nested Vercel URL gives 404 | Ensure deployed `dev` includes `frontend/vercel.json`. |
| Chromium cannot launch | Install the Playwright browser and run in an environment allowed to launch browser processes. |


## AI usage declaration

- Initial structure
- Explanations of Vue/JavaScript/API/Git concepts
- Debugging guidance
- Help with styling, responsive styling, animations
- Test inputs and sample/mock-data assistance.
- Deployment configuration
- README/documentation

