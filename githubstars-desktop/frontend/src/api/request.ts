import axios from 'axios'

// Electron 桌面端：通过 preload 注入的 API URL
const baseURL = (window as any).__ELECTRON_API_URL__ || '/'

const api = axios.create({
  baseURL,
  timeout: 30000,
})

api.interceptors.response.use(
  (response) => response,
  (error) => {
    console.error('API Error:', error)
    return Promise.reject(error)
  }
)

export default api
