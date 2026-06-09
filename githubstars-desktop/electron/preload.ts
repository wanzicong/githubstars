/// <reference types="electron" />
import { contextBridge, ipcRenderer } from 'electron';

declare const window: any;

// 注入 API URL
contextBridge.exposeInMainWorld('electronAPI', {
  getServerPort: () => ipcRenderer.invoke('get-server-port'),
  showSaveDialog: (options: { defaultPath?: string; filters?: { name: string; extensions: string[] }[] }) =>
    ipcRenderer.invoke('show-save-dialog', options),
  writeFile: (filePath: string, content: string) =>
    ipcRenderer.invoke('write-file', filePath, content),
});

// 设置 API URL（用于前端 axios 调用）
ipcRenderer.invoke('get-server-port').then((port: number) => {
  (window as any).__ELECTRON_API_URL__ = `http://localhost:${port}`;
});
