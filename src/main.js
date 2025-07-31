const { app, BrowserWindow, ipcMain, shell, dialog } = require("electron");
const path = require("path");
const axios = require("axios");
const fs = require("fs");
const AdmZip = require("adm-zip");
const { spawn } = require("child_process");
const { autoUpdater } = require("electron-updater");

const log = require("electron-log");
log.transports.file.resolvePathFn = () => path.join(app.getPath("userData"), "logs/main.log");
autoUpdater.logger = log;
autoUpdater.logger.transports.file.level = "info";

const GITHUB_API_URL = "https://api.github.com/repos/quirinklr/vibecraft/releases";
const GAME_INSTALL_DIR = path.join(app.getPath("userData"), "versions");

let mainWindow;

function launchApp() {
  if (mainWindow) {
    mainWindow.loadFile(path.join(__dirname, "index.html"));
  }
}

function createWindow() {
  mainWindow = new BrowserWindow({
    width: 1200,
    height: 800,
    minWidth: 940,
    minHeight: 600,
    icon: path.join(__dirname, "assets/icon.ico"),
    backgroundColor: "#111111",
    show: false,
    webPreferences: {
      preload: path.join(__dirname, "preload.js"),
    },
    title: "Vibecraft Launcher",
    autoHideMenuBar: true,
  });
}

ipcMain.once("renderer-is-ready", () => {
  if (mainWindow) {
    mainWindow.show();
  }
});

ipcMain.handle("get-app-version", () => {
  return app.getVersion();
});

autoUpdater.on("update-available", () => {
  if (!mainWindow.isVisible()) mainWindow.show();
  mainWindow.loadFile(path.join(__dirname, "updating.html"));
});

autoUpdater.on("update-not-available", () => {
  launchApp();
});

autoUpdater.on("update-downloaded", () => {
  autoUpdater.quitAndInstall();
});

autoUpdater.on("error", (err) => {
  if (err.message.includes("No published versions on GitHub")) {
    log.info("Keine Releases auf GitHub gefunden. Starte die App normal.");
  } else {
    log.error(err);
    dialog.showErrorBox("Update Error", "Could not check for updates.\n" + err.message);
  }

  launchApp();
});

app.whenReady().then(() => {
  createWindow();
  if (app.isPackaged) {
    autoUpdater.checkForUpdates();
  } else {
    log.info("Entwicklungsmodus: Update-Check wird übersprungen.");
    launchApp();
  }
  app.on("activate", () => {
    if (BrowserWindow.getAllWindows().length === 0) {
      createWindow();
    }
  });
});

app.on("window-all-closed", () => {
  if (process.platform !== "darwin") {
    app.quit();
  }
});

let gameProcess = null;
ipcMain.handle("get-releases", async () => {
  try {
    const response = await axios.get(GITHUB_API_URL, { timeout: 10000 });
    return { success: true, data: response.data };
  } catch (error) {
    log.error("Fehler beim Abrufen der Releases:", error.message);
    return { success: false, error: error.message || "Unknown error occurred" };
  }
});

ipcMain.on("launch-game", async (event, release) => {
  if (gameProcess) {
    return;
  }
  const versionPath = path.join(GAME_INSTALL_DIR, release.tag_name);
  const versionInfoPath = path.join(versionPath, "vibecraft_info.json");
  let needsUpdate = true;
  if (fs.existsSync(versionPath) && fs.existsSync(versionInfoPath)) {
    const info = JSON.parse(fs.readFileSync(versionInfoPath, "utf8"));
    if (release.assets.length > 0 && info.asset_id === release.assets[0].id) {
      needsUpdate = false;
    }
  }
  if (needsUpdate) {
    mainWindow.webContents.send("game-status-update", "Downloading...");
    if (fs.existsSync(versionPath)) fs.rmSync(versionPath, { recursive: true, force: true });
    fs.mkdirSync(versionPath, { recursive: true });
    const asset = release.assets.find((a) => a.name.endsWith(".zip"));
    if (!asset) {
      mainWindow.webContents.send("game-status-update", "Error: No ZIP found!");
      return;
    }
    const downloadUrl = asset.browser_download_url;
    const zipPath = path.join(versionPath, "download.zip");
    try {
      const response = await axios({ method: "get", url: downloadUrl, responseType: "stream" });
      const writer = fs.createWriteStream(zipPath);
      response.data.pipe(writer);
      await new Promise((resolve, reject) => {
        writer.on("finish", resolve);
        writer.on("error", reject);
      });
      mainWindow.webContents.send("game-status-update", "Extracting...");
      const zip = new AdmZip(zipPath);
      zip.extractAllTo(versionPath, true);
      fs.unlinkSync(zipPath);
      const versionInfo = { tag_name: release.tag_name, asset_id: asset.id, download_date: new Date().toISOString() };
      fs.writeFileSync(versionInfoPath, JSON.stringify(versionInfo, null, 2));
    } catch (error) {
      mainWindow.webContents.send("game-status-update", "Error during download!");
      return;
    }
  }
  try {
    let exePath = null;
    let searchPath = versionPath;
    const subDirs = fs.readdirSync(versionPath).filter((f) => fs.statSync(path.join(versionPath, f)).isDirectory());
    if (subDirs.length === 1) searchPath = path.join(versionPath, subDirs[0]);
    const exeFile = fs.readdirSync(searchPath).find((file) => file.endsWith(".exe"));
    if (exeFile) {
      exePath = path.join(searchPath, exeFile);
    } else {
      mainWindow.webContents.send("game-status-update", `Error: EXE not found in ${searchPath}`);
      return;
    }
    mainWindow.webContents.send("game-status-update", "Running");
    gameProcess = spawn(exePath, { cwd: path.dirname(exePath), detached: true, stdio: "ignore" });
    gameProcess.unref();
    gameProcess.on("exit", () => {
      gameProcess = null;
      if (mainWindow && !mainWindow.isDestroyed()) mainWindow.webContents.send("game-status-update", "Ready");
    });
    gameProcess.on("error", () => {
      gameProcess = null;
      if (mainWindow && !mainWindow.isDestroyed()) mainWindow.webContents.send("game-status-update", "Launch Error!");
    });
  } catch (err) {
    mainWindow.webContents.send("game-status-update", `Error: ${err.message}`);
  }
});

ipcMain.on("open-external-link", (event, url) => {
  shell.openExternal(url);
});
