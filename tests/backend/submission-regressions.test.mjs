// Offline regression checks: fake upstream responses, no database writes or real API keys.
import test, { afterEach, beforeEach } from 'node:test'
import assert from 'node:assert/strict'
import axios from 'axios'
import { searchLocation, getWalkingRoute } from '../../backend/services/oneMapService.js'
import { getCarparkDetails } from '../../backend/controllers/carparkController.js'
import { searchLocations, getWalkingRoute as walkingController } from '../../backend/controllers/locationController.js'
import { createFavourite } from '../../backend/controllers/favouriteController.js'
import { addRecentSearch } from '../../backend/controllers/recentSearchController.js'

const keys = ['ONEMAP_EMAIL', 'ONEMAP_PASSWORD', 'ONEMAP_TOKEN', 'LTA_API_KEY']
let savedEnvironment, savedFetch, savedAdapter
beforeEach(() => {
  savedEnvironment = Object.fromEntries(keys.map(key => [key, process.env[key]]))
  savedFetch = globalThis.fetch
  savedAdapter = axios.defaults.adapter
  keys.forEach(key => delete process.env[key])
  process.env.ONEMAP_TOKEN = 'test-only-token'
  globalThis.fetch = () => { throw new Error('Unexpected network request') }
})
afterEach(() => {
  globalThis.fetch = savedFetch
  axios.defaults.adapter = savedAdapter
  keys.forEach(key => {
    if (savedEnvironment[key] === undefined) delete process.env[key]
    else process.env[key] = savedEnvironment[key]
  })
})
function response() {
  return { code: 200, body: null, status(code) { this.code = code; return this }, json(body) { this.body = body; return this } }
}
const origin = { lat: 1.3, lng: 103.8 }
const destination = { lat: 1.301, lng: 103.801 }

test('blank destination queries are rejected without contacting OneMap', async () => {
  for (const q of [undefined, '', '  ', ['SMU']]) {
    const res = response()
    await searchLocations({ query: { q } }, res)
    assert.equal(res.code, 400)
  }
})

test('blank coordinates are rejected instead of becoming zero', async () => {
  const res = response()
  await walkingController({ query: { originLat: '', originLng: '103', destLat: '1.3', destLng: '103.8' } }, res, error => { throw error })
  assert.equal(res.code, 400)
  await assert.rejects(getWalkingRoute({ lat: null, lng: 103 }, destination), error => error.status === 400)
  await assert.rejects(getWalkingRoute(',103', destination), error => error.status === 400)
})

test('favourites and recents reject missing coordinates before touching the database', async () => {
  for (const controller of [createFavourite, addRecentSearch]) {
    for (const latitude of [null, '', '  ']) {
      const res = response()
      await controller({ body: { label: 'SMU', latitude, longitude: 103.8 }, user: { id: 'unused' } }, res, error => { throw error })
      assert.equal(res.code, 400)
    }
  }
})

test('invalid detail coordinates are rejected before fetching carpark data', async () => {
  for (const query of [{ destLat: '', destLng: '103' }, { destinationCoords: '1,103,4' }, { destLat: '100', destLng: '103' }]) {
    let captured
    await getCarparkDetails({ params: { id: 'TEST' }, query }, response(), error => { captured = error })
    assert.equal(captured.status, 400)
  }
})

test('incomplete walking summaries fail clearly instead of inventing zero distance', async () => {
  globalThis.fetch = async () => ({ ok: true, json: async () => ({ route_summary: { total_time: 60 } }) })
  await assert.rejects(getWalkingRoute(origin, destination), error => error.status === 502)
  globalThis.fetch = async () => ({ ok: true, json: async () => ({ route_summary: { total_distance: 0, total_time: 0 } }) })
  assert.equal((await getWalkingRoute(origin, origin)).walkingDistance, 0)
})

test('details keep availability and rates when walking routing is unavailable', async () => {
  process.env.LTA_API_KEY = 'test-only-key'
  globalThis.fetch = async url => {
    if (String(url).includes('routingsvc')) return { ok: false, status: 502, statusText: 'Unavailable' }
    if (String(url).includes('EVCBatch')) return { ok: true, json: async () => ({ value: [] }) }
    assert.ok(String(url).includes('CarParkAvailabilityv2'))
    return { ok: true, json: async () => ({ value: [{ CarParkID: 'TEST', Development: 'Test carpark', Location: '1.3 103.8', AvailableLots: 17, LotType: 'C', Agency: 'LTA' }] }) }
  }
  const res = response()
  await getCarparkDetails({ params: { id: 'TEST' }, query: { destLat: '1.301', destLng: '103.801', destinationName: 'SMU' } }, res, error => { throw error })
  assert.equal(res.code, 200)
  assert.equal(res.body.data.availableLots, 17)
  assert.ok(res.body.data.rate)
  assert.equal(res.body.data.walkingDistance, null)
  assert.match(res.body.data.routeError, /unavailable/)
  assert.equal(res.body.data.destination.name, 'SMU')
})

test('destination search has a timeout and returns safe errors without Axios headers', async () => {
  axios.defaults.adapter = async config => {
    assert.equal(config.timeout, 15000)
    throw Object.assign(new Error('private upstream details'), { config })
  }
  await assert.rejects(searchLocation('SMU'), error => error.status === 502 && !error.config && !error.message.includes('private'))
})

test('simultaneous requests share one token renewal and search retries a rejected token', async () => {
  process.env.ONEMAP_EMAIL = 'test@example.com'
  process.env.ONEMAP_PASSWORD = 'test-only-password'
  let renewals = 0, searches = 0
  globalThis.fetch = async url => {
    if (String(url).includes('getToken')) {
      renewals += 1
      return { ok: true, json: async () => ({ access_token: `test-token-${renewals}`, expiry_timestamp: Math.floor(Date.now() / 1000) + 3600 }) }
    }
    return { ok: true, json: async () => ({ route_summary: { total_distance: 100, total_time: 80 } }) }
  }
  await Promise.all([getWalkingRoute(origin, destination), getWalkingRoute(origin, destination), getWalkingRoute(origin, destination)])
  assert.equal(renewals, 1)
  axios.defaults.adapter = async config => {
    searches += 1
    if (searches === 1) throw Object.assign(new Error('expired'), { response: { status: 401 } })
    assert.equal(config.headers.Authorization, 'test-token-2')
    return { data: { results: [{ SEARCHVAL: 'SMU' }] }, status: 200, config }
  }
  assert.equal((await searchLocation('SMU')).results[0].SEARCHVAL, 'SMU')
  assert.equal(searches, 2)
  assert.equal(renewals, 2)
})
