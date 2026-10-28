/* IBRATV — Android bridge (phone / car / TV builds)
   Gives app.js the same window.ibratvNative interface the Windows version has.
   برمجة و تطوير ابراهيم الخزرجي */
(() => {
  "use strict";
  const N = window.IbraNative;
  const DEVICE_LABEL = {
    windows: "نسخة الويندوز",
    mobile: "نسخة الموبايل",
    car: "نسخة شاشات السيارة",
    tv: "نسخة التلفزيون والتيفي بوكس",
    ios: "نسخة الآيفون"
  };
  const CAP = window.Capacitor;
  const IOS = !!(CAP && CAP.getPlatform && CAP.getPlatform() === "ios");
  // ?dev=mobile|car|tv lets the web build preview each layout in a browser
  const qp = new URLSearchParams(location.search).get("dev");
  const device = IOS ? "ios" : N ? N.flavor() : (qp && DEVICE_LABEL[qp] ? qp : "windows");
  window.IBRATV_DEVICE = device;
  window.IBRATV_DEVICE_LABEL = DEVICE_LABEL[device] || "";
  // the iPhone build uses the phone layout
  document.documentElement.classList.add("dev-" + (device === "ios" ? "mobile" : device));
  if (device === "ios") document.documentElement.classList.add("ios");
  else if (N || qp) document.documentElement.classList.add("android");

  if (IOS) { setupIOS(); return; }
  if (!N) return;

  const REPO = "ibrata2/ibratv";
  const newer = (a, b) => {
    const pa = String(a).replace(/^v/, "").split(".").map(Number), pb = String(b).replace(/^v/, "").split(".").map(Number);
    for (let i = 0; i < 3; i++) { if ((pa[i] || 0) > (pb[i] || 0)) return true; if ((pa[i] || 0) < (pb[i] || 0)) return false; }
    return false;
  };
  let progressCb = null, doneCb = null;
  window.__ibraUpdate = (p) => progressCb && progressCb(p);
  window.__ibraUpdateDone = (ok, msg) => doneCb && doneCb(ok, msg);

  window.ibratvNative = {
    isDesktop: false,
    android: true,
    acrylic: false,
    platform: "android",
    device,

    async fetchText(url, { preferCache = false, maxAgeMs = 6 * 3600e3 } = {}) {
      const savedAt = N.cacheTime(url) || 0;
      if (preferCache && savedAt && Date.now() - savedAt < maxAgeMs) {
        const text = N.cacheRead(url);
        if (text) return { ok: true, text, fromCache: true, savedAt };
      }
      try {
        const res = await fetch(url, { cache: "no-store" });
        if (!res.ok) throw new Error("HTTP " + res.status);
        const text = await res.text();
        N.cacheWrite(url, text);
        return { ok: true, text, fromCache: false, savedAt: Date.now() };
      } catch (err) {
        const text = savedAt ? N.cacheRead(url) : null;
        if (text) return { ok: true, text, fromCache: true, offline: true, savedAt, error: String(err.message || err) };
        return { ok: false, error: String(err.message || err) };
      }
    },

    async setStreamHeaders({ userAgent = "", referrer = "" } = {}) { N.setHeaders(userAgent, referrer); return true; },
    async openExternal(url) { N.openExternal(url); },
    async appVersion() { return N.version(); },
    setFullscreen(on) { try { N.setFullscreen(!!on); } catch {} },
    exitApp() { N.exitApp(); },

    async checkUpdate() {
      const current = N.version();
      try {
        const res = await fetch(`https://api.github.com/repos/${REPO}/releases/latest`, { cache: "no-store", headers: { Accept: "application/vnd.github+json" } });
        if (res.status === 404) return { ok: true, available: false, current };
        if (!res.ok) throw new Error("HTTP " + res.status);
        const rel = await res.json();
        const version = String(rel.tag_name || "").replace(/^v/, "");
        const tag = { mobile: "Mobile", car: "Car", tv: "TV" }[device];
        const asset = (rel.assets || []).find((a) => new RegExp(`Android-${tag}\\.apk$`, "i").test(a.name));
        return { ok: true, current, version, available: !!asset && newer(version, current), notes: rel.body || "", page: rel.html_url, assetUrl: asset?.browser_download_url, assetName: asset?.name, size: asset?.size || 0 };
      } catch (err) {
        return { ok: false, error: String(err.message || err), current };
      }
    },
    downloadUpdate({ url, name }) {
      return new Promise((resolve, reject) => {
        doneCb = (ok, msg) => (ok ? resolve({ ok: true }) : reject(new Error(msg || "فشل التنزيل")));
        N.downloadUpdate(url, name || "");
      });
    },
    async installUpdate() {
      const r = N.installUpdate();
      if (r === "permission") throw new Error("اسمح لـ IBRATV بتثبيت التطبيقات من الإعدادات، ثم اضغط تثبيت مرة ثانية");
      if (r !== "ok") throw new Error(r);
      return true;
    },
    onUpdateProgress(cb) { progressCb = cb; },

    // official YouTube live streams (e.g. Alrabiaa) — fetched natively through the app's proxy
    async youtubeLive(handle) {
      if (!/^@[\w.\-]{2,60}$/.test(handle)) return { ok: false, reason: "bad-handle" };
      try {
        const res = await fetch(`https://www.youtube.com/${handle}/live`, { headers: { "X-Ibra-Proxy": "1" }, cache: "no-store" });
        const html = await res.text();
        const canon = html.match(/<link rel="canonical" href="https:\/\/www\.youtube\.com\/watch\?v=([\w-]{11})"/);
        if (canon && /"isLiveNow":true|"isLive":true/.test(html)) return { ok: true, id: canon[1] };
        return { ok: false, reason: "offline" };
      } catch { return { ok: false, reason: "network" }; }
    }
  };

  /* ================= iPhone / iPad (Capacitor iOS) ================= */
  function setupIOS() {
    const Http = CAP.Plugins && CAP.Plugins.CapacitorHttp;
    const App = CAP.Plugins && CAP.Plugins.App;
    // native HTTP (no CORS) for playlists, GitHub and YouTube pages
    async function get(url, headers = {}) {
      if (Http && Http.request) {
        const r = await Http.request({ url, method: "GET", headers, responseType: "text", connectTimeout: 20000, readTimeout: 60000 });
        return { ok: r.status >= 200 && r.status < 300, status: r.status, text: typeof r.data === "string" ? r.data : JSON.stringify(r.data) };
      }
      const r = await fetch(url, { headers, cache: "no-store" });
      return { ok: r.ok, status: r.status, text: await r.text() };
    }
    const cacheKey = (u) => "ibratv2:cache:" + u;
    const newer = (a, b) => {
      const pa = String(a).replace(/^v/, "").split(".").map(Number), pb = String(b).replace(/^v/, "").split(".").map(Number);
      for (let i = 0; i < 3; i++) { if ((pa[i] || 0) > (pb[i] || 0)) return true; if ((pa[i] || 0) < (pb[i] || 0)) return false; }
      return false;
    };
    let version = "";
    App?.getInfo?.().then((i) => { version = i.version; }).catch(() => {});
    const openUrl = (url) => { if (/^https?:\/\//i.test(url)) window.location.href = url; };   // Capacitor hands external links to Safari

    window.ibratvNative = {
      isDesktop: false, ios: true, acrylic: false, platform: "ios", device: "ios",
      async fetchText(url, { preferCache = false, maxAgeMs = 6 * 3600e3 } = {}) {
        let cached = null;
        try { cached = JSON.parse(localStorage.getItem(cacheKey(url)) || "null"); } catch {}
        if (preferCache && cached && Date.now() - cached.t < maxAgeMs) return { ok: true, text: cached.text, fromCache: true, savedAt: cached.t };
        try {
          const r = await get(url);
          if (!r.ok) throw new Error("HTTP " + r.status);
          try { if (r.text.length < 3.5e6) localStorage.setItem(cacheKey(url), JSON.stringify({ t: Date.now(), text: r.text })); } catch {}
          return { ok: true, text: r.text, fromCache: false, savedAt: Date.now() };
        } catch (err) {
          if (cached) return { ok: true, text: cached.text, fromCache: true, offline: true, savedAt: cached.t };
          return { ok: false, error: String(err.message || err) };
        }
      },
      async setStreamHeaders() { return true; },
      async openExternal(url) { openUrl(url); },
      async appVersion() { if (!version && App?.getInfo) { try { version = (await App.getInfo()).version; } catch {} } return version; },
      exitApp() {},
      async checkUpdate() {
        const current = await this.appVersion();
        try {
          const r = await get("https://api.github.com/repos/ibrata2/ibratv/releases/latest", { Accept: "application/vnd.github+json" });
          if (r.status === 404) return { ok: true, available: false, current };
          if (!r.ok) throw new Error("HTTP " + r.status);
          const rel = JSON.parse(r.text);
          const v = String(rel.tag_name || "").replace(/^v/, "");
          const asset = (rel.assets || []).find((a) => /iPhone\.ipa$/i.test(a.name));
          return { ok: true, current, version: v, available: !!asset && newer(v, current), notes: rel.body || "", page: rel.html_url, assetUrl: asset?.browser_download_url, assetName: asset?.name, size: asset?.size || 0 };
        } catch (err) { return { ok: false, error: String(err.message || err), current }; }
      },
      // iOS can't install apps from inside an app: open the download page instead
      async downloadUpdate({ url }) { openUrl(url); return { ok: true, external: true }; },
      async installUpdate() { return true; },
      onUpdateProgress() {},
      async youtubeLive(handle) {
        if (!/^@[\w.\-]{2,60}$/.test(handle)) return { ok: false, reason: "bad-handle" };
        try {
          const r = await get(`https://www.youtube.com/${handle}/live`, { "User-Agent": "Mozilla/5.0 (Macintosh; Intel Mac OS X 14_0) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/17.0 Safari/605.1.15", "Accept-Language": "ar,en;q=0.8", Cookie: "SOCS=CAI; CONSENT=YES+1" });
          const canon = r.text.match(/<link rel="canonical" href="https:\/\/www\.youtube\.com\/watch\?v=([\w-]{11})"/);
          if (canon && /"isLiveNow":true|"isLive":true/.test(r.text)) return { ok: true, id: canon[1] };
          return { ok: false, reason: "offline" };
        } catch { return { ok: false, reason: "network" }; }
      }
    };
  }
})();
