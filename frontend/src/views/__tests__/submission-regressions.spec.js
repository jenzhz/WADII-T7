import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { flushPromises, mount, RouterLinkStub } from '@vue/test-utils'
import HomeView from '../HomeView.vue'
import ResultsView from '../ResultsView.vue'
import FavouritesView from '../FavouritesView.vue'
import CompareView from '../CompareView.vue'
import CarparkDetails from '@/components/CarparkDetails.vue'
import FilterDropdown from '@/components/FilterDropdown.vue'
import CarparkCard from '@/components/CarparkCard.vue'
import api from '@/services/api'

const { route } = vi.hoisted(() => ({ route: { query: {} } }))
vi.mock('vue-router', () => ({ useRoute: () => route, useRouter: () => ({ push: vi.fn() }) }))
vi.mock('@/services/api', () => ({ default: { get: vi.fn(), post: vi.fn(), delete: vi.fn() } }))
vi.mock('@/services/auth', () => ({ getCurrentUser: () => null }))
vi.mock('@/services/reviews', () => ({ getCommunitySummaries: async () => ({ summaries: [] }) }))
vi.mock('@/services/recentSearches', () => ({ getRecentSearches: async () => [] }))

const pending = () => {
  let resolve, reject
  const promise = new Promise((yes, no) => { resolve = yes; reject = no })
  return { promise, resolve, reject }
}
const row = (id, name = id) => ({ id, name, latitude: 1.3, longitude: 103.8, lotType: 'C', distance: 100, availableLots: 10, hasEvCharger: true })
const wrappers = []
function render(component, props = {}) {
  const wrapper = mount(component, {
    props,
    global: { stubs: { RouterLink: RouterLinkStub, CarparkMap: true } },
  })
  wrappers.push(wrapper)
  return wrapper
}
beforeEach(() => {
  vi.clearAllMocks()
  route.query = { destination: 'SMU', latitude: '1.3', longitude: '103.8' }
  localStorage.clear()
})
afterEach(() => { wrappers.splice(0).forEach(wrapper => wrapper.unmount()) })

describe('destination search on slow or failed connections', () => {
  it('keeps the newest suggestions when responses arrive out of order', async () => {
    const old = pending(), latest = pending()
    api.get.mockImplementation((_url, options) => options.params.q === 's' ? old.promise : latest.promise)
    const wrapper = render(HomeView)
    await wrapper.get('#destination').setValue('s')
    await wrapper.get('#destination').setValue('smu')
    latest.resolve({ data: { results: [{ SEARCHVAL: 'SMU' }] } })
    await flushPromises()
    old.resolve({ data: { results: [{ SEARCHVAL: 'SUNTEC' }] } })
    await flushPromises()
    expect(wrapper.get('[aria-label="Destination suggestions"]').text()).toBe('SMU')
  })

  it('does not restore suggestions after the user clears the input', async () => {
    const request = pending()
    api.get.mockReturnValue(request.promise)
    const wrapper = render(HomeView)
    await wrapper.get('#destination').setValue('smu')
    await wrapper.get('.clear-button').trigger('click')
    request.resolve({ data: { results: [{ SEARCHVAL: 'SMU' }] } })
    await flushPromises()
    expect(wrapper.find('[aria-label="Destination suggestions"]').exists()).toBe(false)
    expect(wrapper.get('#destination').element.value).toBe('')
  })

  it('shows an actionable error and lets the next search recover', async () => {
    api.get.mockRejectedValueOnce(new Error('offline')).mockResolvedValueOnce({ data: { results: [{ SEARCHVAL: 'SMU' }] } })
    const wrapper = render(HomeView)
    await wrapper.get('#destination').setValue('s')
    await flushPromises()
    expect(wrapper.get('[role="alert"]').text()).toContain('try again')
    await wrapper.get('#destination').setValue('smu')
    await flushPromises()
    expect(wrapper.find('[role="alert"]').exists()).toBe(false)
    expect(wrapper.get('[aria-label="Destination suggestions"]').text()).toBe('SMU')
  })
})

describe('results navigation and favourites', () => {
  beforeEach(() => {
    api.get.mockImplementation(async url => ({ data: url === '/carparks/nearby' ? { carparks: [row('A'), row('B')] } : { favourites: [] } }))
  })
  it('preserves distance and EV filters from the URL and removes EV from outgoing links when switched off', async () => {
    route.query = { ...route.query, radius: '500', ev: '1' }
    const wrapper = render(ResultsView)
    await flushPromises()
    expect(wrapper.get('#distance').text()).toContain('500 m')
    expect(wrapper.get('.chip-ev').attributes('aria-pressed')).toBe('true')
    await wrapper.get('.chip-ev').trigger('click')
    const link = wrapper.findAllComponents(RouterLinkStub).find(link => link.props('to').name === 'map')
    expect(link.props('to').query.radius).toBe('500')
    expect(link.props('to').query.ev).toBeUndefined()
    wrapper.findAllComponents(FilterDropdown).find(dropdown => dropdown.props('id') === 'distance').vm.$emit('update:modelValue', '5000')
    wrapper.findAllComponents(FilterDropdown).find(dropdown => dropdown.props('id') === 'sort').vm.$emit('update:modelValue', 'lots')
    await flushPromises()
    // Availability ranking is limited to 1 km; the map must show that same area.
    expect(link.props('to').query.radius).toBe('1000')
  })

  it('keeps both hearts saved when two different favourites finish together', async () => {
    const first = pending(), second = pending()
    api.post.mockImplementation((_url, body) => body.carparkId === 'A' ? first.promise : second.promise)
    const wrapper = render(ResultsView)
    await flushPromises()
    const cards = wrapper.findAllComponents(CarparkCard)
    cards[0].vm.$emit('toggle-favourite', row('A'))
    cards[1].vm.$emit('toggle-favourite', row('B'))
    second.resolve({ data: { favourite: { id: 'saved-B' } } })
    await flushPromises()
    first.resolve({ data: { favourite: { id: 'saved-A' } } })
    await flushPromises()
    expect(wrapper.findAllComponents(CarparkCard).map(card => card.props('favourite'))).toEqual([true, true])
  })
})

it('shows carparks for the latest favourite destination even when the first response is slower', async () => {
  const first = pending(), second = pending()
  api.get.mockImplementation(url => url === '/favourites'
    ? Promise.resolve({ data: { favourites: [
      { id: '1', type: 'destination', label: 'First', latitude: 1.3, longitude: 103.8 },
      { id: '2', type: 'destination', label: 'Second', latitude: 1.4, longitude: 103.9 },
    ] } })
    : (api.get.mock.calls.filter(call => call[0] === '/carparks/nearby').length === 1 ? first.promise : second.promise))
  const wrapper = render(FavouritesView)
  await flushPromises()
  await wrapper.findAll('.destination-select')[0].trigger('click')
  await wrapper.findAll('.destination-select')[1].trigger('click')
  second.resolve({ data: { carparks: [row('B', 'Second carpark')] } })
  await flushPromises()
  first.resolve({ data: { carparks: [row('A', 'First carpark')] } })
  await flushPromises()
  const results = wrapper.get('[aria-label="Nearby carparks for selected destination"]')
  expect(results.text()).toContain('Second carpark')
  expect(results.text()).not.toContain('First carpark')
})

describe('missing walking metrics', () => {
  it('shows unavailable metrics instead of zero when opened without a destination', async () => {
    api.get.mockResolvedValue({ data: { data: { carparkName: 'Suntec', availableLots: 20, walkingDistance: null, walkingTime: null, destination: null } } })
    const wrapper = render(CarparkDetails)
    await flushPromises()
    expect(wrapper.text()).not.toContain('0 m')
    expect(wrapper.text()).not.toContain('0s pedestrian walk')
    expect(wrapper.text()).toContain('Choose a destination')
  })
  it('still displays a genuine zero-distance route', async () => {
    api.get.mockResolvedValue({ data: { data: { walkingDistance: 0, walkingTime: 0, totalTimeSeconds: 0, destination: { name: 'Suntec' } } } })
    const wrapper = render(CarparkDetails)
    await flushPromises()
    expect(wrapper.text()).toContain('0 m')
    expect(wrapper.text()).toContain('0s pedestrian walk')
  })
})

it('does not show the old parking estimate under a new duration after a failed cost refresh', async () => {
  route.query.ids = 'A,B'
  let nearbyCalls = 0
  api.get.mockImplementation(async url => {
    if (url === '/locations/walking-route') return { data: { walkingDistance: 100, walkingTime: 2 } }
    if (++nearbyCalls > 1) throw new Error('offline')
    return { data: { carparks: [row('A'), row('B')].map(carpark => ({ ...carpark, estimatedCost: 2.4 })) } }
  })
  const wrapper = render(CompareView)
  await flushPromises()
  expect(wrapper.text()).toContain('$2.40')
  wrapper.getComponent(FilterDropdown).vm.$emit('update:modelValue', 240)
  await flushPromises()
  expect(wrapper.get('[role="alert"]').text()).toContain('Could not update parking costs')
  expect(wrapper.text()).not.toContain('$2.40')
  expect(wrapper.text()).toContain('Unavailable')
})
