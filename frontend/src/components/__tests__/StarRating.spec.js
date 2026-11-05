import { mount } from '@vue/test-utils'
import { describe, it, expect } from 'vitest'
import StarRating from '../StarRating.vue'

describe('StarRating', () => {
  it('displays five rating buttons', () => {
    const wrapper = mount(StarRating)

    expect(wrapper.findAll('button')).toHaveLength(5)
    wrapper.unmount()
  })

  it('highlights three stars when the selected rating is 3', () => {
    const wrapper = mount(StarRating, {
      props: { modelValue: 3 },
    })

    expect(wrapper.findAll('.filled')).toHaveLength(3)
    wrapper.unmount()
  })

  it('emits the selected rating when the fourth star is clicked', async () => {
    const wrapper = mount(StarRating)

    await wrapper.findAll('button')[3].trigger('click')

    expect(wrapper.emitted('update:modelValue')[0]).toEqual([4])
    wrapper.unmount()
  })

  it('previews all five stars on hover and restores the saved rating afterwards', async () => {
    const wrapper = mount(StarRating, {
      props: { modelValue: 2 },
    })

    await wrapper.findAll('button')[4].trigger('mouseenter')
    expect(wrapper.findAll('.filled')).toHaveLength(5)

    await wrapper.find('.star-input').trigger('mouseleave')
    expect(wrapper.findAll('.filled')).toHaveLength(2)
    wrapper.unmount()
  })

  it('does not display rating buttons when the rating is read-only', () => {
    const wrapper = mount(StarRating, {
      props: { modelValue: 4, readonly: true },
    })

    expect(wrapper.findAll('button')).toHaveLength(0)
    expect(wrapper.attributes('aria-label')).toBe('Rating: 4.0 out of 5')
    wrapper.unmount()
  })
})
