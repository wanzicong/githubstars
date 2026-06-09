// Electron 桌面端类型声明
interface Window {
  __ELECTRON_API_URL__?: string;
  electronAPI?: {
    getServerPort: () => Promise<number>;
    showSaveDialog: (options: {
      defaultPath?: string;
      filters?: { name: string; extensions: string[] }[];
    }) => Promise<{ canceled: boolean; filePath?: string }>;
    writeFile: (filePath: string, content: string) => Promise<{ success: boolean; error?: string }>;
  };
}
