<script setup>
import {computed} from 'vue'
import {useRoute} from 'vue-router'
import {mockCarparks} from '../data/mockCarparks'
import { rankCarparks } from '../utils/ranking';

const route = useRoute()
const selectedIds = computed(()=>{
  const ids = route.query.ids
  if (!ids){
    return []
  }
  return ids.split(',')
})

const selectedCarparks = computed (()=>
  mockCarparks.filter(carpark => selectedIds.value.includes(carpark.id))
)
const ranked = computed (()=> rankCarparks(selectedCarparks.value))
</script>

<template>
    <p v-for="carpark in ranked" :key = 'carpark.id'>
      {{ carpark.rank }} {{ carpark.name }} - {{ carpark.score }}

    </p>
</template>

