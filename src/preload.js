const { contextBridge, ipcRenderer } = require("electron");

contextBridge.exposeInMainWorld("electronAPI", {
  getReleases: () => ipcRenderer.invoke("get-releases"),
  launchGame: (release) => ipcRenderer.send("launch-game", release),
  onGameStatusUpdate: (callback) => ipcRenderer.on("game-status-update", (_event, value) => callback(value)),
  openExternalLink: (url) => ipcRenderer.send("open-external-link", url),
  signalReady: () => ipcRenderer.send("renderer-is-ready"),

  getAppVersion: () => ipcRenderer.invoke("get-app-version"),
});
