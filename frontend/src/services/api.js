import axios from 'axios'

// Import with: import api from '@/services/api'
// Example (once endpoints are implemented): const { data } = await api.get('/carparks')
const api = axios.create({
  baseURL: import.meta.env.VITE_API_BASE_URL || 'http://localhost:3000/api',
  timeout: 30_000,
  headers: {
    'Content-Type': 'application/json',
  },
})

export default api

