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
    tv: "نسخة التلفزيون والتيفي بوكس"
  };
  // ?dev=mobile|car|tv lets the web build preview each layout in a browser
  const qp = new URLSearchParams(location.search).get("dev");
  const device = N ? N.flavor() : (qp && DEVICE_LABEL[qp] ? qp : (window.ibratvNative ? "windows" : "windows"));
  window.IBRATV_DEVICE = device;
  window.IBRATV_DEVICE_LABEL = DEVICE_LABEL[device] || "";
  document.documentElement.classList.add("dev-" + device);
  if (N || qp) document.documentElement.classList.add("android");

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
})();
