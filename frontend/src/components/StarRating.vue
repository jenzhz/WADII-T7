<script setup>
defineProps({
  modelValue: { type: [Number, String], default: '' },
  readonly: { type: Boolean, default: false },
  label: { type: String, default: 'Rating' },
})
defineEmits(['update:modelValue'])
</script>

<template>
  <span v-if="readonly" class="stars" :aria-label="`${label}: ${Number(modelValue || 0).toFixed(1)} out of 5`">
    <span v-for="star in 5" :key="star" :class="{ filled: star <= Math.round(Number(modelValue || 0)) }" aria-hidden="true">★</span>
  </span>
  <span v-else class="star-input" role="radiogroup" :aria-label="label">
    <button
      v-for="star in 5"
      :key="star"
      type="button"
      :class="{ filled: star <= Number(modelValue || 0) }"
      role="radio"
      :aria-checked="star === Number(modelValue)"
      :aria-label="`${star} star${star === 1 ? '' : 's'}`"
      @click="$emit('update:modelValue', star)"
    >★</button>
  </span>
</template>

<style scoped>
.stars, .star-input { display: inline-flex; gap: .08rem; color: #b7c2bd; }
.stars .filled, .star-input .filled { color: #f2a900; }
.star-input button { padding: 0 .08rem; border: 0; color: #b7c2bd; background: transparent; font-size: 1.55rem; line-height: 1; cursor: pointer; }
.star-input button:hover, .star-input button:focus-visible { color: #f2a900; transform: translateY(-1px); }
</style>
