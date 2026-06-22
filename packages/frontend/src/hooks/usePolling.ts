import { useRef, useCallback, useEffect, useState } from 'react'

/** 连续错误警告阈值 */
const CONSECUTIVE_ERROR_WARN_THRESHOLD = 5

/**
 * 通用轮询 Hook — 管理 setInterval 生命周期，自动清理
 *
 * @param callback  每次轮询执行的回调（支持 async）
 * @param interval  轮询间隔（毫秒），默认 2000
 * @returns { start, stop, isPolling, consecutiveErrors }
 */
export function usePolling(callback: () => Promise<void> | void, interval = 2000) {
    const timerRef = useRef<ReturnType<typeof setInterval> | null>(null)
    const [isPolling, setIsPolling] = useState(false)
    const [consecutiveErrors, setConsecutiveErrors] = useState(0)
    const callbackRef = useRef(callback)

    // 保持回调引用最新，避免闭包过期
    useEffect(() => {
        callbackRef.current = callback
    }, [callback])

    const stop = useCallback(() => {
        if (timerRef.current) {
            clearInterval(timerRef.current)
            timerRef.current = null
        }
        setIsPolling(false)
    }, [])

    const start = useCallback(() => {
        stop()
        setIsPolling(true)
        setConsecutiveErrors(0)
        timerRef.current = setInterval(() => {
            void (async () => {
                try {
                    await callbackRef.current()
                    setConsecutiveErrors(0)
                } catch {
                    setConsecutiveErrors((prev) => {
                        const next = prev + 1
                        if (next === CONSECUTIVE_ERROR_WARN_THRESHOLD) {
                            // 仅在开发环境输出警告，生产环境由调用方处理 consecutiveErrors
                            if (import.meta.env.DEV) {
                                console.warn(`[usePolling] 连续 ${next} 次轮询失败，请检查网络连接`)
                            }
                        }
                        return next
                    })
                }
            })()
        }, interval)
    }, [interval, stop])

    // 组件卸载时自动清理
    useEffect(() => {
        return () => stop()
    }, [stop])

    return { start, stop, isPolling, consecutiveErrors }
}
