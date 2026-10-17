# Nearby carpark results — LTA integration

## Run locally

Use Node.js 20.19+ (or a supported newer version).

1. From the project root, run `npm install`.
2. Copy `backend/.env.example` to `backend/.env` and enter your account key:

   ```env
   PORT=3000
   LTA_API_KEY=your_actual_account_key
   MONGODB_URI=
   ```

   Keep this key in backend/.env only; never in Vue, a VITE_ variable or Git.
   Request an account key through the LTA DataMall portal if you do not have one.
3. Copy `frontend/.env.example` to `frontend/.env`. Keep `VITE_CARPARK_DATA_MODE=live`.
4. Run `npm run dev` from the project root. MongoDB is optional for public carpark
   endpoints; authentication and saved places still need MongoDB configured.
5. Until the homepage search is ready, open this explicit destination URL:

   http://localhost:5173/results?destination=Suntec%20Convention%20Centre&latitude=1.293&longitude=103.857&vehicleType=C

Restart the relevant server after editing environment files. To preview without
an LTA key, explicitly set `VITE_CARPARK_DATA_MODE=sample` and restart Vite.
Sample data is labelled and is never substituted automatically for API failures.

## Requirement mapping

| Requirement | LTA field | Returned application field |
|---|---|---|
| Official carpark ID | CarParkID | carparkId |
| Development/address | Development | development and name |
| Coordinates | Location (latitude longitude string) | latitude, longitude |
| Current available lots | AvailableLots | availableLots |
| Lot type | LotType | lotType: C=car, Y=motorcycle, H=heavy vehicle |

The display shows all five fields. `id` is an internal composite key containing
agency, official ID and lot type to distinguish rows; `carparkId` preserves the
official LTA identifier. Development is the supplied landmark/address, not a
separately geocoded street address.

## Data flow

Vue ResultsView -> Express /api/carparks/nearby -> LTA CarParkAvailabilityv2.
Only Express sends the AccountKey header. The backend retrieves pages of 500
with $skip, validates the response, maps fields and uses the Haversine formula
to calculate straight-line distances. Invalid/missing coordinates are excluded
from nearby searches; unknown availability stays null rather than zero.
Requests share a 60-second cache and an in-progress fetch. Failures return clear
errors without returning stale data as fresh. `fetchedAt` is the retrieval time,
not a timestamp supplied by LTA. Data can change before the driver arrives.

## Endpoints

- GET /api/carparks: mapped availability for all retrieved records.
- GET /api/carparks/nearby?latitude=1.293&longitude=103.857&radius=1000&vehicleType=C
- Radius is metres, defaults to 1000, and accepts 100–5000.
- Vehicle types: C, Y, H. Invalid query parameters return 400.
- Missing/rejected key returns 503. Upstream failures return 502.

Response envelope: `{ success, carparks, fetchedAt, source, radius, distanceType }`.
Each nearby record contains the mapped fields above plus `id`, `agency`,
`distance` (metres), `walkingDistance: null`, `walkingTime: null`.

The results page requests a 5 km pool and filters the selected radius locally,
initially 1 km. It supports nearest-first/most-lots sorting, available-only filter,
vehicle selection, refresh, error/empty/loading states and compare selection.

## Homepage integration — Jen

```js
router.push({
  name: 'results',
  query: {
    destination: selectedDestination.name,
    latitude: selectedDestination.latitude,
    longitude: selectedDestination.longitude,
    vehicleType: 'C',
  },
})
```

To filter around the driver's current location, the caller can pass those
coordinates and label the destination accordingly. This implementation does not
request browser geolocation itself.

## Other teammates

Details/map links carry search context. Compare accepts comma-separated internal
IDs in `route.query.ids`; these now include agency and lot type. Owners should
resolve them against returned records, using `carparkId` for the official ID.
Map, details, compare and homepage screens remain their existing placeholders.

LTA does NOT supply walking distance/time. Live cards show a dash for estimated
walk; nearby distance is explicitly labelled straight-line. A separate walking
routing API must populate walking fields later. Balanced ranking is also outside
this change. Sample mode retains clearly labelled sample walking times.

## Files to copy to your own branch

- backend/services/ltaService.js
- backend/controllers/carparkController.js
- backend/server.js
- frontend/src/views/ResultsView.vue
- frontend/src/components/CarparkCard.vue
- frontend/src/utils/carparkResults.js
- frontend/src/services/api.js
- frontend/.env.example
- tests/backend/lta.test.mjs
- docs/nearby-results.md

Copy these files into your existing checkout; retain your existing Git folder
and local .env files. No real credentials are included in the ZIP.

## Verification

`node --test tests/backend/lta.test.mjs` tests field mapping, missing values,
pagination, cache reuse, nearby distance, vehicle filtering, missing key and
invalid queries using simulated upstream responses. `npm run build` compiles Vue.
A real LTA request requires your valid account key and network access. Visual
browser checks have not been completed in this environment.

Official documentation (section 2.12, and pagination/authentication pages):
https://datamall.lta.gov.sg/content/dam/datamall/datasets/LTA_DataMall_API_User_Guide.pdf
