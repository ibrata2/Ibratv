const { contextBridge, ipcRenderer } = require("electron");

const acrylic = process.argv.includes("--ibratv-acrylic");

contextBridge.exposeInMainWorld("ibratvNative", {
  isDesktop: true,
  acrylic,
  platform: process.platform,
  fetchText: (url, opts) => ipcRenderer.invoke("ibratv:fetch-text", url, opts),
  setStreamHeaders: (info) => ipcRenderer.invoke("ibratv:set-stream-headers", info),
  openExternal: (url) => ipcRenderer.invoke("ibratv:open-external", url),
  appVersion: () => ipcRenderer.invoke("ibratv:app-version"),
  checkUpdate: () => ipcRenderer.invoke("ibratv:check-update"),
  downloadUpdate: (info) => ipcRenderer.invoke("ibratv:download-update", info),
  installUpdate: () => ipcRenderer.invoke("ibratv:install-update"),
  youtubeLive: (handle) => ipcRenderer.invoke("ibratv:youtube-live", handle),
  onUpdateProgress: (cb) => ipcRenderer.on("ibratv:update-progress", (_e, p) => cb(p))
});
