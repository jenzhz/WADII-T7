# CarparkCompare SG

Starter scaffold for an IS216 university web application that will help users compare nearby Singapore carparks using live lot availability and walking distance.

This repository intentionally contains only structure, configuration, example MongoDB models, and placeholder endpoints. LTA DataMall integration, OneMap integration, authentication, carpark ranking, and other core business logic are not implemented.

## Technology stack

- Vue 3 and Vite
- Vue Router
- Axios
- Bootstrap 5
- Leaflet
- Node.js and Express
- MongoDB and Mongoose
- Postman for REST API checks

## Structure

```text
carparkcompare/
|-- frontend/
|   |-- src/
|   |   |-- assets/                  Global styles and static assets
|   |   |-- components/              Reusable Vue components
|   |   |-- data/mockCarparks.js     Shared development-only sample data
|   |   |-- utils/ranking.js         Future ranking function stubs
|   |   |-- views/                   Route-level Vue pages
|   |   |-- router/                  Vue Router configuration
|   |   |-- services/api.js          Shared Axios instance
|   |   |-- App.vue
|   |   `-- main.js
|   |-- .env.example
|   |-- index.html
|   |-- package.json
|   `-- vite.config.js
|-- backend/
|   |-- models/                      Mongoose schemas
|   |-- controllers/                 HTTP request handlers
|   |-- routes/                      Express REST route definitions
|   |-- services/                    LTA and OneMap adapters (placeholders)
|   |-- middleware/                  Shared Express middleware
|   |-- config/db.js                 MongoDB connection
|   |-- .env.example
|   |-- app.js                       Express application configuration
|   |-- server.js                    Database connection and server startup
|   `-- package.json
|-- tests/postman/                   Importable Postman collection
|-- docs/architecture.md
|-- package.json                     Workspace scripts
`-- README.md
```

## Frontend pages

| Page | Route | Vue file |
|---|---|---|
| Login / Register | `/login` | `AuthView.vue` |
| Local mock-account manager | `/mock-accounts` | `MockAccountsView.vue` |
| Home / Destination Search | `/` | `HomeView.vue` |
| Nearby Carparks Results | `/results` | `ResultsView.vue` |
| Map Explorer | `/map` | `MapView.vue` |
| Individual Carpark Details | `/carparks/:id` | `CarparkDetailsView.vue` |
| Compare Carparks | `/compare` | `CompareView.vue` |
| Favourites / Saved Places | `/favourites` | `FavouritesView.vue` |

## Local setup

Prerequisites: Node.js 20.19+ (or 22.12+) and MongoDB running locally or through MongoDB Atlas.

From the repository root:

```bash
npm install
```

Copy `frontend/.env.example` to `frontend/.env` and `backend/.env.example` to `backend/.env`. Set `MONGODB_URI` to a local MongoDB or MongoDB Atlas connection string and choose a strong `JWT_SECRET`. Leave external API credentials empty until those integrations begin.

Start both applications:

```bash
npm run dev
```

- Vue frontend: `http://localhost:5173`
- Express backend: `http://localhost:3000`
- Health endpoint: `http://localhost:3000/api/health`

Run either side separately with `npm run dev:frontend` or `npm run dev:backend`.

## Build

```bash
npm run build
```

The generated frontend is written to `frontend/dist`.

## Postman

1. Start MongoDB and the backend.
2. Import `tests/postman/carparkcompare-api.postman_collection.json` into Postman.
3. Run it with the default `baseUrl` of `http://localhost:3000`.

The health request expects HTTP 200. Placeholder feature requests expect HTTP 501 until implemented.

The collection contains every planned endpoint. Set its `baseUrl` collection variable if the backend is not running at `http://localhost:3000`; request bodies and IDs are starter examples for manual testing.

## Environment and secrets

- Never commit `.env` files or hardcode API credentials.
- Only variables beginning with `VITE_` are exposed to frontend code.
- LTA DataMall and OneMap credentials belong in the backend environment only.

Backend variables: `PORT`, `MONGODB_URI`, `LTA_API_KEY`, `ONEMAP_TOKEN`, and `JWT_SECRET`.

Frontend variable: `VITE_API_BASE_URL` (normally `http://localhost:3000/api`).

## Mock-data workflow

Import `mockCarparks` and `mockDestination` from `frontend/src/data/mockCarparks.js` while building pages. This lets each screen be developed without OneMap, LTA DataMall, or ranking logic. Replace mock imports at the page boundary when real backend endpoints are ready; do not put live LTA availability in MongoDB.

The login/register page currently uses `frontend/src/services/mockAuth.js`. Accounts and the current mock session are stored only in the browser's `localStorage`; password values are salted and hashed before storage. Register a test account at `/login`, then open `/mock-accounts` to inspect or clear local test accounts. This is development scaffolding, not production authentication, and should be replaced with calls through `services/api.js` when the backend authentication work begins.

## Backend architecture

Requests flow from Vue through the shared Axios client to an Express route, then a controller and service. Future LTA and OneMap HTTP calls belong only in `backend/services`. Mongoose models represent persistent user-owned data; live availability remains transient.

## Team ownership

- Jennifer Burns — Home / Destination Search; `HomeView.vue`; future OneMap destination search
- Huang Yongxiang — Nearby Carparks Results; `ResultsView.vue`; `CarparkCard.vue`; future LTA DataMall integration
- Marco Editia Husin — Map Explorer; `MapView.vue`; `CarparkMap.vue`; Leaflet
- Mudit Gupta — Individual Carpark Details / Walking Route; `CarparkDetailsView.vue`; future OneMap walking routing
- Dong Zicheng — Compare Carparks / Ranking; `CompareView.vue`; `ranking.js`
- Tan Jun Wei Zenden — Login / Register and Favourites / Saved Places; `AuthView.vue`; `FavouritesView.vue`; user and favourite backend layers

## Team workflow

The seven views are independent placeholders so members can own separate pages. Agree on REST request/response formats before implementation. Keep external API access inside `backend/services`, database access through Mongoose models, and HTTP responses inside controllers.

## AI usage declaration

The initial folder structure and generic boilerplate were created with OpenAI Codex assistance. The team must document further AI usage and independently implement core business logic in accordance with the project brief.

