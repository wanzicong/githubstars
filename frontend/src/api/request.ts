import axios from 'axios'

const api = axios.create({
    baseURL: '/',
    timeout: 300000, // 5 分钟超时
})

api.interceptors.response.use(
    (response) => response,
    (error) => {
        console.error('API Error:', error)
        return Promise.reject(error)
    },
)

export default api
