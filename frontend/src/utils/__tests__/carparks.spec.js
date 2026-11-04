// Week 10a: test JavaScript functions with describe(), it() and expect().
import { describe, it, expect } from 'vitest'
import { formatDistance } from '../carparkResults'
import { rankCarparks } from '../ranking'

describe('formatDistance', () => {
  it('displays a distance below 1000 metres in metres', () => {
    expect(formatDistance(250)).toBe('250 m')
  })

  it('displays exactly 1000 metres as 1 kilometre', () => {
    expect(formatDistance(1000)).toBe('1.0 km')
  })

  it('displays zero metres correctly', () => {
    expect(formatDistance(0)).toBe('0 m')
  })

  it('displays Unavailable when the distance is missing', () => {
    expect(formatDistance(null)).toBe('Unavailable')
  })
})

describe('rankCarparks', () => {
  const carparks = [
    { name: 'Full carpark', availableLots: 0, distance: 50, estimatedCost: 1 },
    { name: 'Closer carpark', availableLots: 10, distance: 200, estimatedCost: 4 },
    { name: 'More lots carpark', availableLots: 50, distance: 800, estimatedCost: 2 },
  ]

  it('puts the nearest available carpark first when Closer is selected', () => {
    const results = rankCarparks(carparks, { lots: 0.3, walk: 0.7, mode: 'walk' })

    expect(results[0].name).toBe('Closer carpark')
  })

  it('puts the carpark with the most lots first when Available Lots is selected', () => {
    const results = rankCarparks(carparks, { lots: 0.7, walk: 0.3, mode: 'lots' })

    expect(results[0].name).toBe('More lots carpark')
  })

  it('puts the cheapest available carpark first when Cheapest is selected', () => {
    const results = rankCarparks(carparks, { lots: 0, walk: 0, mode: 'price' })

    expect(results[0].name).toBe('More lots carpark')
  })

  it('puts a full carpark after carparks that have available lots', () => {
    const results = rankCarparks(carparks, { lots: 0.3, walk: 0.7, mode: 'walk' })

    expect(results[2].name).toBe('Full carpark')
  })

  it('returns an empty list when there are no carparks', () => {
    const results = rankCarparks([], { lots: 0.3, walk: 0.7, mode: 'walk' })

    expect(results).toHaveLength(0)
  })
})
