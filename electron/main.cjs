// IBRATV — Electron main process
// برمجة و تطوير ابراهيم الخزرجي
const { app, BrowserWindow, shell, ipcMain, net, session } = require("electron");
const path = require("node:path");
const fs = require("node:fs");
const os = require("node:os");
const crypto = require("node:crypto");

const isWin11 = process.platform === "win32" && Number((os.release().split(".")[2]) || 0) >= 22000;
const DEFAULT_UA = "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/134.0.0.0 Safari/537.36";

// Headers a channel needs (from #EXTVLCOPT / http-user-agent / http-referrer)
let activeHeaders = { userAgent: "", referrer: "", hosts: new Set() };

function cacheDir() {
  const dir = path.join(app.getPath("userData"), "playlist-cache");
  fs.mkdirSync(dir, { recursive: true });
  return dir;
}
function cacheFile(url) {
  return path.join(cacheDir(), crypto.createHash("sha1").update(url).digest("hex") + ".m3u");
}

// Download a playlist from the main process (no CORS), keep an offline copy.
ipcMain.handle("ibratv:fetch-text", async (_e, url, { preferCache = false, maxAgeMs = 6 * 3600e3 } = {}) => {
  const file = cacheFile(url);
  const cached = fs.existsSync(file) ? { text: fs.readFileSync(file, "utf8"), mtime: fs.statSync(file).mtimeMs } : null;
  if (preferCache && cached && Date.now() - cached.mtime < maxAgeMs) {
    return { ok: true, text: cached.text, fromCache: true, savedAt: cached.mtime };
  }
  try {
    const res = await net.fetch(url, { headers: { "User-Agent": DEFAULT_UA }, cache: "no-store" });
    if (!res.ok) throw new Error("HTTP " + res.status);
    const text = await res.text();
    fs.writeFileSync(file, text, "utf8");
    return { ok: true, text, fromCache: false, savedAt: Date.now() };
  } catch (err) {
    if (cached) return { ok: true, text: cached.text, fromCache: true, offline: true, savedAt: cached.mtime, error: String(err.message || err) };
    return { ok: false, error: String(err.message || err) };
  }
});

ipcMain.handle("ibratv:set-stream-headers", (_e, { url, userAgent = "", referrer = "" } = {}) => {
  const hosts = new Set();
  try { hosts.add(new URL(url).host); } catch {}
  activeHeaders = { userAgent, referrer, hosts };
  return true;
});

/* ---------- in-app updater (GitHub Releases of ibrata2/ibratv) ---------- */
const REPO = "ibrata2/ibratv";
const newer = (a, b) => {
  const pa = String(a).replace(/^v/, "").split(".").map(Number), pb = String(b).replace(/^v/, "").split(".").map(Number);
  for (let i = 0; i < 3; i++) { if ((pa[i] || 0) > (pb[i] || 0)) return true; if ((pa[i] || 0) < (pb[i] || 0)) return false; }
  return false;
};
let downloadedInstaller = null;

ipcMain.handle("ibratv:app-version", () => app.getVersion());

ipcMain.handle("ibratv:check-update", async () => {
  try {
    const res = await net.fetch(`https://api.github.com/repos/${REPO}/releases/latest`, {
      headers: { "User-Agent": "IBRATV-Updater", Accept: "application/vnd.github+json" }, cache: "no-store"
    });
    if (res.status === 404) return { ok: true, available: false, current: app.getVersion() };
    if (!res.ok) throw new Error("HTTP " + res.status);
    const rel = await res.json();
    const version = String(rel.tag_name || "").replace(/^v/, "");
    const asset = (rel.assets || []).find((a) => /setup.*\.exe$/i.test(a.name)) || (rel.assets || []).find((a) => /\.exe$/i.test(a.name));
    return {
      ok: true, current: app.getVersion(), version, available: !!version && newer(version, app.getVersion()) && !!asset,
      notes: rel.body || "", page: rel.html_url, assetUrl: asset?.browser_download_url, assetName: asset?.name, size: asset?.size || 0
    };
  } catch (err) {
    return { ok: false, error: String(err.message || err), current: app.getVersion() };
  }
});

ipcMain.handle("ibratv:download-update", async (e, { url, name }) => {
  if (!/^https:\/\/github\.com\/ibrata2\/ibratv\/releases\/download\//i.test(url)) throw new Error("رابط تحديث غير موثوق");
  const res = await net.fetch(url, { headers: { "User-Agent": "IBRATV-Updater" } });
  if (!res.ok || !res.body) throw new Error("HTTP " + res.status);
  const total = Number(res.headers.get("content-length")) || 0;
  const file = path.join(app.getPath("temp"), (name || "IBRATV-Setup.exe").replace(/[^\w.\-]/g, "_"));
  const out = fs.createWriteStream(file);
  const reader = res.body.getReader();
  let got = 0, lastSent = 0;
  for (;;) {
    const { done, value } = await reader.read();
    if (done) break;
    got += value.length;
    if (!out.write(Buffer.from(value))) await new Promise((r) => out.once("drain", r));
    if (Date.now() - lastSent > 150) { lastSent = Date.now(); e.sender.send("ibratv:update-progress", { got, total }); }
  }
  await new Promise((r, j) => out.end((err) => (err ? j(err) : r())));
  e.sender.send("ibratv:update-progress", { got, total: total || got });
  downloadedInstaller = file;
  return { ok: true, file };
});

ipcMain.handle("ibratv:install-update", () => {
  if (!downloadedInstaller || !fs.existsSync(downloadedInstaller)) throw new Error("لم يتم تنزيل التحديث");
  const { spawn } = require("node:child_process");
  spawn(downloadedInstaller, [], { detached: true, stdio: "ignore" }).unref();
  setTimeout(() => app.quit(), 400);
  return true;
});

ipcMain.handle("ibratv:open-external", (_e, url) => {
  if (/^https?:\/\//i.test(url)) shell.openExternal(url);
});

// Official YouTube live streams (e.g. Alrabiaa): find the current live video of a channel handle
ipcMain.handle("ibratv:youtube-live", async (_e, handle) => {
  if (!/^@[\w.\-]{2,60}$/.test(handle)) return { ok: false, reason: "bad-handle" };
  try {
    const res = await net.fetch(`https://www.youtube.com/${handle}/live`, {
      headers: { "User-Agent": DEFAULT_UA, "Accept-Language": "ar,en;q=0.8", Cookie: "SOCS=CAI; CONSENT=YES+1" }, cache: "no-store"
    });
    const html = await res.text();
    const canon = html.match(/<link rel="canonical" href="https:\/\/www\.youtube\.com\/watch\?v=([\w-]{11})"/);
    const live = /"isLiveNow":true|"isLive":true/.test(html);
    if (canon && live) return { ok: true, id: canon[1] };
    return { ok: false, reason: "offline" };
  } catch (err) {
    return { ok: false, reason: "network", error: String(err.message || err) };
  }
});

const GOOGLE = /^https:\/\/([^/]*\.)?(youtube\.com|youtube-nocookie\.com|googlevideo\.com|ytimg\.com|google\.com|gstatic\.com|googleapis\.com|doubleclick\.net|ggpht\.com)\//i;

function installNetworkRules() {
  const ses = session.defaultSession;
  const mediaTypes = new Set(["xhr", "media", "other", "fetch"]);

  // Apply channel-specific User-Agent / Referer to stream requests
  ses.webRequest.onBeforeSendHeaders((details, cb) => {
    const headers = details.requestHeaders;
    if (GOOGLE.test(details.url)) {
      // YouTube embeds refuse to play without a referrer (error 153) when the app runs from file://
      if (details.resourceType === "subFrame" && /youtube(-nocookie)?\.com\/embed\//.test(details.url)) headers["Referer"] = "https://github.com/ibrata2/ibratv";
      return cb({ requestHeaders: headers });
    }
    // Only stream traffic (playlists/segments), never logos or app files
    if (!details.url.startsWith("file:") && mediaTypes.has(details.resourceType) && !/iptv-org\.github\.io/.test(details.url)) {
      if (activeHeaders.userAgent) headers["User-Agent"] = activeHeaders.userAgent;
      if (activeHeaders.referrer) {
        headers["Referer"] = activeHeaders.referrer;
        try { headers["Origin"] = new URL(activeHeaders.referrer).origin; } catch {}
      }
    }
    cb({ requestHeaders: headers });
  });

  // Streams rarely send CORS headers — allow them inside the app only.
  ses.webRequest.onHeadersReceived((details, cb) => {
    if (details.url.startsWith("file:") || GOOGLE.test(details.url)) return cb({});
    const h = details.responseHeaders || {};
    for (const k of Object.keys(h)) {
      if (/^access-control-allow-(origin|headers|methods)$/i.test(k)) delete h[k];
    }
    h["Access-Control-Allow-Origin"] = ["*"];
    h["Access-Control-Allow-Headers"] = ["*"];
    h["Access-Control-Allow-Methods"] = ["GET, HEAD, OPTIONS"];
    cb({ responseHeaders: h });
  });
}

function createWindow() {
  const win = new BrowserWindow({
    width: 1480,
    height: 920,
    minWidth: 1040,
    minHeight: 640,
    title: "IBRATV",
    icon: path.join(__dirname, "..", "build", "icon.png"),
    backgroundColor: isWin11 ? "#00000000" : "#0b0507",
    backgroundMaterial: isWin11 ? "acrylic" : undefined,
    titleBarStyle: "hidden",
    titleBarOverlay: { color: "#00000000", symbolColor: "#ffd9de", height: 44 },
    autoHideMenuBar: true,
    show: false,
    webPreferences: {
      preload: path.join(__dirname, "preload.cjs"),
      contextIsolation: true,
      nodeIntegration: false,
      sandbox: true,
      autoplayPolicy: "no-user-gesture-required",
      additionalArguments: [isWin11 ? "--ibratv-acrylic" : "--ibratv-solid"]
    }
  });

  win.once("ready-to-show", () => win.show());
  win.loadFile(path.join(__dirname, "..", "index.html"));

  win.webContents.setWindowOpenHandler(({ url }) => {
    if (/^https?:\/\//i.test(url)) shell.openExternal(url);
    return { action: "deny" };
  });
  win.webContents.on("will-navigate", (e, url) => {
    if (!url.startsWith("file:")) { e.preventDefault(); shell.openExternal(url); }
  });
}

app.whenReady().then(() => {
  installNetworkRules();
  createWindow();
  app.on("activate", () => {
    if (BrowserWindow.getAllWindows().length === 0) createWindow();
  });
});

app.on("window-all-closed", () => {
  if (process.platform !== "darwin") app.quit();
});
