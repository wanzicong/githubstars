import { useState, useEffect, useCallback, useMemo } from 'react'
import { isElectron } from '../utils/electron'

/**
 * 获取Electron API
 * 注意：仅在Electron环境中可用
 */
export function getElectronAPI() {
  if (!isElectron()) {
    throw new Error('Electron API is not available. This function can only be used in Electron environment.')
  }
  return window.electronAPI
}

/**
 * 桌面端配置Hook
 */
export function useDesktopConfig() {
  const [config, setConfig] = useState<{
    isDesktop: boolean
    platform: string
    userDataPath: string
    tempPath: string
    downloadsPath: string
  } | null>(null)

  useEffect(() => {
    if (isElectron()) {
      window.electronAPI.desktop.getConfig()
        .then(setConfig)
        .catch((err) => console.error('获取桌面配置失败:', err))
    }
  }, [])

  return config
}

/**
 * 窗口控制Hook
 */
export function useWindowControls() {
  const [isMaximized, setIsMaximized] = useState(false)

  useEffect(() => {
    if (isElectron()) {
      window.electronAPI.window.isMaximized().then(setIsMaximized)
    }
  }, [])

  const minimize = useCallback(async () => {
    if (isElectron()) {
      await window.electronAPI.window.minimize()
    }
  }, [])

  const maximize = useCallback(async () => {
    if (isElectron()) {
      await window.electronAPI.window.maximize()
      const maximized = await window.electronAPI.window.isMaximized()
      setIsMaximized(maximized)
    }
  }, [])

  const close = useCallback(async () => {
    if (isElectron()) {
      await window.electronAPI.window.close()
    }
  }, [])

  return { isMaximized, minimize, maximize, close }
}

/**
 * 文件夹选择Hook
 *
 * 在桌面端环境下使用原生对话框选择文件夹
 * 在Web环境下返回null，需要用户手动输入
 */
export function useDirectoryPicker() {
  const [isSupported] = useState(() => isElectron())

  /**
   * 打开目录选择对话框
   *
   * @param options 对话框选项
   * @returns 选择的目录路径，取消或不支持时返回null
   */
  const pickDirectory = useCallback(async (options?: { title?: string; defaultPath?: string }) => {
    if (!isElectron()) {
      // 非Electron环境返回null
      return null
    }
    return await window.electronAPI.dialog.openDirectory(options)
  }, [])

  return useMemo(() => ({
    pickDirectory,
    isSupported
  }), [pickDirectory, isSupported])
}

/**
 * 应用更新Hook
 */
export function useAppUpdate() {
  const [updateState, setUpdateState] = useState<{
    checking: boolean
    available: boolean
    downloaded: boolean
    version?: string
    progress?: number
    error?: string
  }>({
    checking: false,
    available: false,
    downloaded: false
  })

  useEffect(() => {
    if (!isElectron()) return

    const api = window.electronAPI.update

    api.onChecking(() => {
      setUpdateState(prev => ({ ...prev, checking: true, error: undefined }))
    })

    api.onAvailable((info) => {
      setUpdateState(prev => ({
        ...prev,
        checking: false,
        available: true,
        version: info.version
      }))
    })

    api.onNotAvailable(() => {
      setUpdateState(prev => ({
        ...prev,
        checking: false,
        available: false
      }))
    })

    api.onProgress((progress: { percent: number }) => {
      setUpdateState(prev => ({
        ...prev,
        progress: typeof progress?.percent === 'number' ? progress.percent : prev.progress
      }))
    })

    api.onDownloaded((info) => {
      setUpdateState(prev => ({
        ...prev,
        downloaded: true,
        version: info.version
      }))
    })

    api.onError((error) => {
      setUpdateState(prev => ({
        ...prev,
        checking: false,
        error: error.message
      }))
    })

    return () => {
      api.removeAllListeners()
    }
  }, [])

  const checkUpdate = useCallback(async () => {
    if (!isElectron()) return
    await window.electronAPI.update.check()
  }, [])

  const downloadUpdate = useCallback(async () => {
    if (!isElectron()) return
    await window.electronAPI.update.download()
  }, [])

  const installUpdate = useCallback(async () => {
    if (!isElectron()) return
    await window.electronAPI.update.install()
  }, [])

  return {
    ...updateState,
    checkUpdate,
    downloadUpdate,
    installUpdate
  }
}
