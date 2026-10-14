<script setup>
import { ref } from 'vue';
import api from '@/services/api'


const destination = ref("")
const results = ref([])

const selectedDestination = ref(null)

const vehicleType = ref('C')


async function searchDestination() {
  selectedDestination.value = null

  if (destination.value.trim() === '') {
    results.value = []
    return
  }
  
  const response = await api.get('/locations/search', {
    params : {
      q : destination.value
    }
  })
  results.value = response.data.results
}


function selectDestination(item) {
  selectedDestination.value = item
  destination.value = item.SEARCHVAL
  results.value = []
  console.log(selectedDestination.value)
}

</script>



<template>
  <section class="row justify-content-center">
    <div class="col-xl-10">
      <div class="row g-4 align-items-start">
        <div class="col-lg-5">
          <p class="text-uppercase text-primary fw-semibold small mb-2">Find parking</p>
          <h1 class="h2 mb-3">Find parking near your destination</h1>
          <p class="text-secondary">
            Search for a destination and choose your vehicle type.
          </p>
        </div>

        <div class="col-lg-7">
          <div class="card shadow-sm">
            <div class="card-body">
              <h2 class="h4 mb-4">Destination search</h2>

              <div class="mb-3">
                <label class="form-label" for="destination">Destination</label>
                <div class="position-relative">
                  <input
                    id="destination"
                    v-model="destination"
                    class="form-control"
                    type="text"
                    name="destination"
                    placeholder="e.g. Suntec City or a postal code"
                    autocomplete="off"
                    @input="searchDestination"
                  />

                  <ul
                    v-if="results.length > 0"
                    class="dropdown-menu show w-100 top-100 start-0 shadow destination-suggestions"
                    aria-label="Destination suggestions"
                  >
                    <li v-for="(item, index) in results" :key="index">
                      <button
                        class="dropdown-item text-wrap"
                        type="button"
                        @click="selectDestination(item)"
                      >
                        {{ item.SEARCHVAL }}
                      </button>
                    </li>
                  </ul>
                </div>
                <div class="form-text">Choose a matching destination from the suggestions.</div>
              </div>

              <div class="mb-4">
                <label class="form-label" for="vehicle-type">Vehicle type</label>
                <select id="vehicle-type" v-model="vehicleType" class="form-select">
                  <option value="C">Car</option>
                  <option value="Y">Motorcycle</option>
                  <option value="H">Heavy Vehicle</option>
                </select>
              </div>

              <button class="btn btn-primary w-100" type="button" @click="searchDestination">
                Search
              </button>
            </div>
          </div>
        </div>
      </div>
    </div>
  </section>
</template>

<style scoped>
.destination-suggestions {
  max-height: 16rem;
  overflow-y: auto;
}
</style>

