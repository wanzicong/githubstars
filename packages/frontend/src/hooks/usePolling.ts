import { useRef, useCallback, useEffect, useState } from 'react'

/**
 * 通用轮询 Hook — 管理 setInterval 生命周期，自动清理
 *
 * @param callback  每次轮询执行的回调（支持 async）
 * @param interval  轮询间隔（毫秒），默认 2000
 * @returns { start, stop, isPolling }
 */
export function usePolling(callback: () => Promise<void> | void, interval = 2000) {
    const timerRef = useRef<ReturnType<typeof setInterval> | null>(null)
    const [isPolling, setIsPolling] = useState(false)
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
        timerRef.current = setInterval(() => {
            void (async () => {
                try {
                    await callbackRef.current()
                } catch {
                    /* intentionally ignore polling errors */
                }
            })()
        }, interval)
    }, [interval, stop])

    // 组件卸载时自动清理
    useEffect(() => {
        return () => stop()
    }, [stop])

    return { start, stop, isPolling }
}
