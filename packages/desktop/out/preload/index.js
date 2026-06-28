let electron = require("electron");
//#region src/preload/index.ts
/** IPC 通道列表，用于统一清理监听器 */
var UPDATE_CHANNELS = [
	"update:checking",
	"update:available",
	"update:not-available",
	"update:progress",
	"update:downloaded",
	"update:error"
];
electron.contextBridge.exposeInMainWorld("electronAPI", {
	app: {
		getVersion: () => electron.ipcRenderer.invoke("app:getVersion"),
		getName: () => electron.ipcRenderer.invoke("app:getName"),
		getPath: (name) => electron.ipcRenderer.invoke("app:getPath", name)
	},
	dialog: {
		openDirectory: (options) => electron.ipcRenderer.invoke("dialog:openDirectory", options),
		saveFile: (options) => electron.ipcRenderer.invoke("dialog:saveFile", options),
		showMessageBox: (options) => electron.ipcRenderer.invoke("dialog:showMessageBox", options)
	},
	shell: {
		openExternal: (url) => electron.ipcRenderer.invoke("shell:openExternal", url),
		showItemInFolder: (fullPath) => electron.ipcRenderer.invoke("shell:showItemInFolder", fullPath)
	},
	window: {
		minimize: () => electron.ipcRenderer.invoke("window:minimize"),
		maximize: () => electron.ipcRenderer.invoke("window:maximize"),
		close: () => electron.ipcRenderer.invoke("window:close"),
		isMaximized: () => electron.ipcRenderer.invoke("window:isMaximized")
	},
	system: { getInfo: () => electron.ipcRenderer.invoke("system:getInfo") },
	desktop: { getConfig: () => electron.ipcRenderer.invoke("desktop:getConfig") },
	update: {
		check: () => electron.ipcRenderer.invoke("update:check"),
		download: () => electron.ipcRenderer.invoke("update:download"),
		install: () => electron.ipcRenderer.invoke("update:install"),
		onChecking: (callback) => {
			electron.ipcRenderer.removeAllListeners("update:checking");
			electron.ipcRenderer.on("update:checking", callback);
		},
		onAvailable: (callback) => {
			electron.ipcRenderer.removeAllListeners("update:available");
			electron.ipcRenderer.on("update:available", (_, info) => callback(info));
		},
		onNotAvailable: (callback) => {
			electron.ipcRenderer.removeAllListeners("update:not-available");
			electron.ipcRenderer.on("update:not-available", (_, info) => callback(info));
		},
		onProgress: (callback) => {
			electron.ipcRenderer.removeAllListeners("update:progress");
			electron.ipcRenderer.on("update:progress", (_, progress) => callback(progress));
		},
		onDownloaded: (callback) => {
			electron.ipcRenderer.removeAllListeners("update:downloaded");
			electron.ipcRenderer.on("update:downloaded", (_, info) => callback(info));
		},
		onError: (callback) => {
			electron.ipcRenderer.removeAllListeners("update:error");
			electron.ipcRenderer.on("update:error", (_, error) => callback(error));
		},
		removeAllListeners: () => {
			UPDATE_CHANNELS.forEach((ch) => electron.ipcRenderer.removeAllListeners(ch));
		}
	}
});
//#endregion
