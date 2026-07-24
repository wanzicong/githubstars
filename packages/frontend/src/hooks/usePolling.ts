import { useRef, useCallback, useEffect, useState } from 'react'

/** 连续错误警告阈值 */
const CONSECUTIVE_ERROR_WARN_THRESHOLD = 5

/** 轮询回调可访问的控制句柄（避免在回调内闭包引用外部 polling 变量） */
export interface PollingControls {
    /** 停止轮询 */
    stop: () => void
}

/** 轮询回调签名 — 接收控制句柄，支持 async */
export type PollingCallback = (controls: PollingControls) => Promise<void> | void

/**
 * 执行一次轮询并处理连续错误计数
 */
async function executePolling(
    callback: PollingCallback,
    controls: PollingControls,
    onError: (prev: number) => number,
    onSuccess: () => void,
): Promise<void> {
    try {
        await callback(controls)
        onSuccess()
    } catch {
        onError(0)
    }
}

/**
 * 通用轮询 Hook — 管理 setInterval 生命周期，自动清理。
 *
 * 回调通过参数接收 `controls.stop()`，无需在回调内闭包引用
 * 外部 `polling` 变量，消除 "accessed before declared" 的
 * immutability 警告。
 *
 * @param callback  每次轮询执行的回调（支持 async），接收 PollingControls
 * @param interval  轮询间隔（毫秒），默认 2000
 * @returns { start, stop, isPolling, consecutiveErrors }
 *
 * @example
 * const polling = usePolling(async ({ stop }) => {
 *     const res = await fetchProgress(taskId)
 *     if (res.done) stop()
 * }, 2000)
 */
export function usePolling(callback: PollingCallback, interval = 2000) {
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

    // 控制句柄稳定引用，回调内使用避免闭包引用 polling 变量
    const controlsRef = useRef<PollingControls>({ stop })
    useEffect(() => {
        controlsRef.current = { stop }
    }, [stop])

    const tick = useCallback(() => {
        const onError = (prev: number) => {
            setConsecutiveErrors((current) => {
                const next = current + 1
                if (next === CONSECUTIVE_ERROR_WARN_THRESHOLD) {
                    // 仅在开发环境输出警告，生产环境由调用方处理 consecutiveErrors
                    if (import.meta.env.DEV) {
                        console.warn(`[usePolling] 连续 ${next} 次轮询失败，请检查网络连接`)
                    }
                }
                return next
            })
            return prev
        }
        const onSuccess = () => {
            setConsecutiveErrors(0)
        }
        executePolling(callbackRef.current, controlsRef.current, onError, onSuccess)
    }, [])

    const start = useCallback(() => {
        stop()
        setIsPolling(true)
        setConsecutiveErrors(0)
        timerRef.current = setInterval(() => {
            tick()
        }, interval)
    }, [interval, stop, tick])

    // 组件卸载时自动清理
    useEffect(() => {
        return () => stop()
    }, [stop])

    return { start, stop, isPolling, consecutiveErrors }
}
