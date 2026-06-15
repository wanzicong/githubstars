import { useRef, useCallback, useEffect } from 'react'

interface UsePollingOptions {
    /** 轮询间隔（毫秒），默认 2000 */
    intervalMs?: number
    /** 最大轮询时间（毫秒），超时后自动停止。默认不限制 */
    maxDurationMs?: number
    /** 连续失败次数上限，超限后停止轮询。默认 5 */
    maxConsecutiveFailures?: number
    /** 是否立即执行一次回调，默认 false */
    immediate?: boolean
}

interface UsePollingReturn {
    /** 手动触发一次轮询（不影响定时器） */
    refresh: () => void
    /** 停止轮询 */
    stop: () => void
    /** 是否正在轮询中 */
    isPolling: boolean
}

/**
 * 通用轮询 Hook — 统一替代各处手写的 setInterval 轮询逻辑。
 *
 * @param callback  轮询回调，支持 async。返回 false 或 reject 计为失败。
 * @param enabled   是否启用轮询（false 时停止）
 * @param options   配置项
 *
 * @example
 * const { stop, refresh } = usePolling(
 *   async () => { const res = await fetchStatus(); if (res.done) stop(); },
 *   taskId !== null,
 *   { intervalMs: 3000 }
 * )
 */
export function usePolling(
    callback: () => Promise<void | boolean> | void,
    enabled: boolean,
    options: UsePollingOptions = {},
): UsePollingReturn {
    const { intervalMs = 2000, maxDurationMs, maxConsecutiveFailures = 5, immediate = false } = options

    const timerRef = useRef<ReturnType<typeof setInterval> | null>(null)
    const startTimeRef = useRef<number>(0)
    const failureCountRef = useRef(0)
    const callbackRef = useRef(callback)
    const enabledRef = useRef(enabled)
    callbackRef.current = callback
    enabledRef.current = enabled

    const stop = useCallback(() => {
        if (timerRef.current) {
            clearInterval(timerRef.current)
            timerRef.current = null
        }
    }, [])

    const refresh = useCallback(async () => {
        try {
            const result = await callbackRef.current()
            failureCountRef.current = 0
            // 回调返回 false 视为失败
            if (result === false) {
                failureCountRef.current++
            }

            // 超时检查
            if (maxDurationMs && startTimeRef.current > 0) {
                if (Date.now() - startTimeRef.current >= maxDurationMs) {
                    stop()
                    return
                }
            }
        } catch {
            failureCountRef.current++
            if (failureCountRef.current >= maxConsecutiveFailures) {
                stop()
            }
        }
    }, [stop, maxDurationMs, maxConsecutiveFailures])

    useEffect(() => {
        if (!enabled) {
            stop()
            return
        }

        startTimeRef.current = Date.now()
        failureCountRef.current = 0

        if (immediate) {
            refresh()
        }

        timerRef.current = setInterval(refresh, intervalMs)

        return () => {
            stop()
        }
    }, [enabled, intervalMs, immediate, refresh, stop])

    return { refresh, stop, isPolling: timerRef.current !== null }
}

export default usePolling
