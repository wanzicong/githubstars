import axios, { type AxiosError } from 'axios'

const api = axios.create({
    baseURL: '/',
    timeout: 300000, // 5 分钟超时
})

// 请求拦截器：附加公共头
api.interceptors.request.use(
    (config) => {
        // 可在此添加认证 Token
        return config
    },
    (error) => Promise.reject(error),
)

// 用于避免短时间内重复请求相同 URL 的简易缓存
const pendingRequests = new Map<string, Promise<unknown>>()

/** 清除指定 URL 的缓存（数据变更后调用） */
export function clearRequestCache(url?: string) {
    if (url) {
        pendingRequests.delete(url)
    } else {
        pendingRequests.clear()
    }
}

// 响应拦截器
api.interceptors.response.use(
    (response) => {
        // 请求完成后从 pending 中移除
        const key = response.config.url || ''
        pendingRequests.delete(key)
        return response
    },
    (error: AxiosError) => {
        const url = error.config?.url || ''

        // 标准化错误信息
        let message = '网络请求失败'
        if (error.response) {
            const status = error.response.status
            switch (status) {
                case 400:
                    message = '请求参数错误'
                    break
                case 401:
                    message = '未授权，请检查认证配置'
                    break
                case 403:
                    message = '访问被拒绝'
                    break
                case 404:
                    message = '请求的资源不存在'
                    break
                case 429:
                    message = '请求过于频繁，请稍后重试'
                    break
                case 500:
                    message = '服务器内部错误'
                    break
                case 502:
                case 503:
                    message = '服务暂时不可用'
                    break
                default:
                    message = `服务器错误 (${status})`
            }
        } else if (error.code === 'ECONNABORTED') {
            message = '请求超时，请检查网络连接'
        } else if (!navigator.onLine) {
            message = '网络已断开，请检查网络连接'
        }

        console.error(`[API Error] ${url}: ${message}`, error)
        ;(error as AxiosError & { userMessage: string }).userMessage = message
        return Promise.reject(error)
    },
)

export default api
