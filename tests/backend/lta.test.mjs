import test from 'node:test'
import assert from 'node:assert/strict'
import { mapCarpark, distanceInMetres, getCarparkAvailability, getNearbyCarparks } from '../../backend/services/ltaService.js'
import { getNearbyCarparks as controller } from '../../backend/controllers/carparkController.js'

const fixture = { CarParkID: 'TEST', Development: 'Test development', Location: '1.293 103.857', AvailableLots: 8, LotType: 'C', Agency: 'LTA' }

test('official fields, unknown values and lot-type identity', () => {
  const row = mapCarpark(fixture)
  assert.equal(row.carparkId, 'TEST')
  assert.equal(row.name, fixture.Development)
  assert.equal(row.latitude, 1.293)
  assert.equal(row.longitude, 103.857)
  assert.equal(row.availableLots, 8)
  assert.equal(row.lotType, 'C')
  assert.notEqual(row.id, mapCarpark({ ...fixture, LotType: 'Y' }).id)
  assert.equal(mapCarpark({ ...fixture, Location: '', AvailableLots: '' }).latitude, null)
  assert.equal(mapCarpark({ ...fixture, AvailableLots: '' }).availableLots, null)
  assert.equal(row.walkingTime, null)
})

test('distance is metres and is zero for identical coordinates', () => {
  assert.equal(distanceInMetres(1, 103, 1, 103), 0)
  assert.ok(Math.abs(distanceInMetres(0, 0, 0, 1) - 111195) < 1)
})

test('pagination, cache, radius and vehicle filtering', async () => {
  const originalKey = process.env.LTA_API_KEY
  process.env.LTA_API_KEY = 'test-only'
  const originalFetch = globalThis.fetch
  const urls = []
  let evRequests = 0
  globalThis.fetch = async (url, options) => {
    assert.equal(options.headers.AccountKey, 'test-only')
    // EV discovery is a separate request, not an availability page.
    if (new URL(url).pathname.endsWith('/EVCBatch')) {
      evRequests += 1
      return { ok: true, json: async () => ({ value: [] }) }
    }
    assert.ok(new URL(url).pathname.endsWith('/CarParkAvailabilityv2'))
    urls.push(url)
    const rows = url.endsWith('=0')
      ? Array.from({ length: 500 }, (_, i) => ({ ...fixture, CarParkID: String(i) }))
      : [{ ...fixture, CarParkID: 'far', Location: '1.4 103.9' }, { ...fixture, LotType: 'Y' }, { ...fixture, CarParkID: 'missing', Location: '' }]
    return { ok: true, json: async () => ({ value: rows }) }
  }
  try {
    const all = await getCarparkAvailability()
    assert.equal(all.carparks.length, 503)
    assert.deepEqual(urls.map(x => x.split('=')[1]), ['0', '500'])
    assert.equal(evRequests, 1)
    const near = await getNearbyCarparks({ latitude: 1.293, longitude: 103.857, radius: 1000, vehicleType: 'C' })
    assert.equal(near.carparks.length, 500)
    assert.equal(urls.length, 2)
    assert.ok(near.carparks.every(row => row.distance === 0))
    assert.equal((await getNearbyCarparks({ latitude: 1.293, longitude: 103.857, radius: 1000, vehicleType: 'Y' })).carparks.length, 1)
    assert.equal(urls.length, 2)
    assert.equal(evRequests, 1)
  } finally {
    globalThis.fetch = originalFetch
    if (originalKey === undefined) delete process.env.LTA_API_KEY
    else process.env.LTA_API_KEY = originalKey
  }
})

test('missing key gives actionable error', async () => {
  await assert.rejects(getCarparkAvailability(), error => error.status === 503)
})

test('invalid query is rejected before calling upstream', async () => {
  for (const query of [{}, { latitude: '1', longitude: '103', radius: '-1' }, { latitude: '1', longitude: '103', vehicleType: 'M' }]) {
    let captured
    await controller({ query }, { json() { throw Error('Unexpected success') } }, e => { captured = e })
    assert.equal(captured.status, 400)
  }
})
