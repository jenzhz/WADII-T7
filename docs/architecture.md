# CarparkCompare SG architecture

## Request flow

```text
Vue view
  -> reusable Axios client
  -> Express route
  -> controller
  -> Mongoose model / MongoDB
  -> external service adapter (LTA DataMall or OneMap, when implemented)
```

## MVC mapping

- **Models:** `backend/models` contains MongoDB/Mongoose data structures.
- **Views:** `frontend/src/views` and `frontend/src/components` contain the Vue interface.
- **Controllers:** `backend/controllers` handles REST requests and responses.
- **Routes:** `backend/routes` maps HTTP methods and paths to controllers.
- **Services:** `backend/services` will isolate third-party API requests and response normalization.

Vite proxies `/api` requests to Express, avoiding hardcoded backend URLs in Vue components.

The scaffold does not contain carpark ranking, live lot retrieval, walking-distance calculation, authentication, or favourite persistence logic.

