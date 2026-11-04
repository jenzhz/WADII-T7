<script setup>
// Bootstrap Dropdown (https://getbootstrap.com/docs/5.3/components/dropdowns/)
// used as a nicer-looking replacement for a native <select>. Works with v-model.
// Opening/closing is handled by Bootstrap's JS (bootstrap.bundle is loaded in main.js).
import { computed } from 'vue'

const props = defineProps({
  id: { type: String, required: true },
  label: { type: String, required: true },
  modelValue: { type: [String, Number], default: null },
  // [{ value, label, icon? }]
  options: { type: Array, required: true },
  // Optional class for the label, so each page can keep its own label style
  labelClass: { type: [String, Array, Object], default: 'form-label' },
})
const emit = defineEmits(['update:modelValue', 'change'])

const selected = computed(() => props.options.find(option => String(option.value) === String(props.modelValue)))

function choose(option) {
  if (String(option.value) === String(props.modelValue)) return
  emit('update:modelValue', option.value)
  emit('change', option.value)
}
</script>

<template>
  <div class="filter-dropdown">
    <label :for="id" class="d-block" :class="labelClass">{{ label }}</label>
    <div class="dropdown">
      <button
        :id="id"
        class="btn dropdown-toggle filter-dropdown-toggle"
        type="button"
        data-bs-toggle="dropdown"
        aria-expanded="false"
      >
        <span class="toggle-text">
          <span v-if="selected?.icon" class="option-icon" aria-hidden="true">{{ selected.icon }}</span>
          {{ selected?.label ?? 'Select' }}
        </span>
      </button>
      <ul class="dropdown-menu filter-dropdown-menu" :aria-labelledby="id">
        <li v-for="option in options" :key="option.value">
          <button
            type="button"
            class="dropdown-item"
            :class="{ active: String(option.value) === String(modelValue) }"
            :aria-current="String(option.value) === String(modelValue) ? 'true' : undefined"
            @click="choose(option)"
          >
            <span v-if="option.icon" class="option-icon" aria-hidden="true">{{ option.icon }}</span>
            <span class="flex-grow-1">{{ option.label }}</span>
            <span v-if="String(option.value) === String(modelValue)" class="option-check" aria-hidden="true">✓</span>
          </button>
        </li>
      </ul>
    </div>
  </div>
</template>

<style scoped>
.filter-dropdown-toggle {
  display: flex;
  width: 100%;
  min-height: 3.2rem;
  align-items: center;
  justify-content: space-between;
  gap: .5rem;
  padding: .7rem 1rem;
  border: 1.5px solid #174f40;
  border-radius: .8rem;
  color: #10243a;
  background: white;
  font-weight: 600;
  text-align: left;
}
.filter-dropdown-toggle:hover { border-color: #0a9e70; background: #f6fbf9; }
.filter-dropdown-toggle:focus-visible,
.filter-dropdown-toggle.show { border-color: #0a9e70; box-shadow: 0 0 0 .2rem #2cd79030; background: white; }
.filter-dropdown-toggle::after { margin-left: auto; color: #174f40; transition: transform .15s; }
.filter-dropdown-toggle.show::after { transform: rotate(180deg); }
.toggle-text { display: inline-flex; align-items: center; gap: .5rem; overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }

.filter-dropdown-menu {
  width: 100%;
  margin-top: .35rem !important;
  padding: .35rem;
  border: 1.5px solid #174f40;
  border-radius: .9rem;
  box-shadow: 0 12px 28px #073f321f;
}
.filter-dropdown-menu .dropdown-item {
  display: flex;
  align-items: center;
  gap: .55rem;
  padding: .6rem .75rem;
  border-radius: .6rem;
  color: #173e30;
  font-weight: 600;
}
.filter-dropdown-menu .dropdown-item:hover,
.filter-dropdown-menu .dropdown-item:focus { background: #e7f8f0; color: #06271f; }
.filter-dropdown-menu .dropdown-item.active { background: #2cd790; color: #06271f; }
.option-icon { width: 1.25rem; text-align: center; }
.option-check { font-weight: 800; }
</style>
