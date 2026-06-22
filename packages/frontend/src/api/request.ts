import axios, { type AxiosError } from 'axios'
import { isElectron } from '../utils/electron'

/**
 * HTTP 请求客户端
 *
 * 基于 Axios 封装，统一配置 baseURL、超时、请求/响应拦截。
 * - Web 环境：通过 Vite proxy 将所有同源 API 请求转发到后端 (:3000)
 * - 桌面端环境：直接连接后端服务
 */

/**
 * 获取 API 基础 URL
 * - 桌面端：直接连接后端 http://localhost:10002
 * - Web 端：使用相对路径，通过 Vite proxy 转发
 */
function resolveBaseURL(): string {
    if (isElectron()) {
        // 桌面端直接连接后端，无需代理
        return 'http://localhost:10002'
    }
    // Web 端使用相对路径，由 Vite proxy 处理
    return '/'
}

const api = axios.create({
    baseURL: resolveBaseURL(),
    timeout: 60000, // 60 秒超时（长任务如翻译/克隆应通过轮询获取进度）
})

// 请求拦截器：附加公共头
api.interceptors.request.use(
    (config) => {
        // 可在此添加认证 Token
        return config
    },
    (error) => Promise.reject(error),
)

// 响应拦截器
api.interceptors.response.use(
    (response) => {
        return response
    },
    (error: AxiosError) => {
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

        ;(error as AxiosError & { userMessage: string }).userMessage = message
        return Promise.reject(error)
    },
)

export default api

/** 获取当前环境是否为桌面端 */
export const isDesktopEnvironment = (): boolean => isElectron()

/** 动态设置 API baseURL */
export const setBaseURL = (url: string) => { api.defaults.baseURL = url }

/** 获取当前 API baseURL */
export const getCurrentBaseURL = () => api.defaults.baseURL

/** @deprecated 请使用 getCurrentBaseURL */
export const getBaseURL = getCurrentBaseURL
