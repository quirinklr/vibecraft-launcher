const { app, BrowserWindow, ipcMain, shell } = require("electron");
const path = require("path");
const axios = require("axios");
const fs = require("fs");
const AdmZip = require("adm-zip");
const { spawn } = require("child_process");

const GITHUB_API_URL = "https://api.github.com/repos/quirinklr/vibecraft/releases";
const GAME_INSTALL_DIR = path.join(app.getPath("userData"), "versions");

let mainWindow;
let gameProcess = null;

function createWindow() {
  mainWindow = new BrowserWindow({
    width: 1200,
    height: 800,
    minWidth: 940,
    minHeight: 600,
    webPreferences: {
      preload: path.join(__dirname, "preload.js"),
      contextIsolation: true,
      nodeIntegration: false,
    },
    title: "Vibecraft Launcher",
    autoHideMenuBar: true,
  });

  mainWindow.on("closed", () => {
    if (gameProcess) {
      gameProcess.kill();
    }
    mainWindow = null;
  });

  mainWindow.loadFile(path.join(__dirname, "index.html"));
}

app.whenReady().then(() => {
  if (!fs.existsSync(GAME_INSTALL_DIR)) {
    fs.mkdirSync(GAME_INSTALL_DIR, { recursive: true });
  }
  createWindow();

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

ipcMain.handle("get-releases", async () => {
  try {
    const response = await axios.get(GITHUB_API_URL, { timeout: 10000 });
    return { success: true, data: response.data };
  } catch (error) {
    console.error("Fehler beim Abrufen der Releases:", error.message);
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
    if (fs.existsSync(versionPath)) {
      fs.rmSync(versionPath, { recursive: true, force: true });
    }
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
      console.error("Download/Extraktions-Fehler:", error);
      mainWindow.webContents.send("game-status-update", "Error during download!");
      return;
    }
  }

  try {
    let exePath = null;
    let searchPath = versionPath;
    const filesInVersionPath = fs.readdirSync(versionPath);
    const subDirs = filesInVersionPath.filter((f) => fs.statSync(path.join(versionPath, f)).isDirectory());
    if (subDirs.length === 1) {
      searchPath = path.join(versionPath, subDirs[0]);
    }
    const filesInLaunchDir = fs.readdirSync(searchPath);
    const exeFile = filesInLaunchDir.find((file) => file.endsWith(".exe"));
    if (exeFile) {
      exePath = path.join(searchPath, exeFile);
    } else {
      mainWindow.webContents.send("game-status-update", `Error: EXE not found in ${searchPath}`);
      return;
    }

    mainWindow.webContents.send("game-status-update", "Running");

    gameProcess = spawn(exePath, {
      cwd: path.dirname(exePath),
      detached: true,
      stdio: "ignore",
    });

    gameProcess.unref();

    gameProcess.on("exit", (code) => {
      console.log(`Spielprozess wurde mit Code ${code} beendet.`);
      gameProcess = null;
      if (mainWindow && !mainWindow.isDestroyed()) {
        mainWindow.webContents.send("game-status-update", "Ready");
      }
    });

    gameProcess.on("error", (err) => {
      console.error("Fehler beim Starten des Spiels:", err);
      gameProcess = null;
      if (mainWindow && !mainWindow.isDestroyed()) {
        mainWindow.webContents.send("game-status-update", "Launch Error!");
      }
    });
  } catch (err) {
    console.error("Fehler beim Starten:", err);
    mainWindow.webContents.send("game-status-update", `Error: ${err.message}`);
  }
});

ipcMain.on("open-external-link", (event, url) => {
  shell.openExternal(url);
});
