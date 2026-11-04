// Week 10b: mount a parent with its real StarRating child.
// Only RouterLink is stubbed because navigation is not part of this test.
import { mount } from '@vue/test-utils'
import { describe, it, expect } from 'vitest'
import CommunityCarparkCard from '../CommunityCarparkCard.vue'

describe('CommunityCarparkCard and StarRating integration', () => {
  it('displays the carpark name and passes its rating to the real star component', () => {
    const wrapper = mount(CommunityCarparkCard, {
      props: {
        carpark: { name: 'Suntec City', community: { overallRating: 4, reviewCount: 2 } },
        to: { name: 'community' },
      },
      global: { stubs: { RouterLink: true } },
    })

    expect(wrapper.text()).toContain('Suntec City')
    expect(wrapper.find('.stars').attributes('aria-label')).toBe('Rating: 4.0 out of 5')
    wrapper.unmount()
  })

  it('updates the real child display when the parent receives a different rating', async () => {
    const wrapper = mount(CommunityCarparkCard, {
      props: {
        carpark: { name: 'Suntec City', community: { overallRating: 4, reviewCount: 2 } },
        to: { name: 'community' },
      },
      global: { stubs: { RouterLink: true } },
    })

    await wrapper.setProps({
      carpark: { name: 'Raffles City', community: { overallRating: 2, reviewCount: 1 } },
    })

    expect(wrapper.text()).toContain('Raffles City')
    expect(wrapper.find('.stars').attributes('aria-label')).toBe('Rating: 2.0 out of 5')
    wrapper.unmount()
  })

  it('shows the empty message when a carpark has no reviews', () => {
    const wrapper = mount(CommunityCarparkCard, {
      props: {
        carpark: { name: 'Suntec City' },
        to: { name: 'community' },
      },
      global: { stubs: { RouterLink: true } },
    })

    expect(wrapper.text()).toContain('No reviews yet')
    expect(wrapper.find('.stars').exists()).toBeFalsy()
    wrapper.unmount()
  })
})
