/* IBRATV — السينما
   Opens movie / series sites inside the app (Windows: <webview>, Android: native WebView overlay,
   iPhone: native WKWebView overlay, browser preview: sandboxed iframe), with ad & popup blocking.
   برمجة و تطوير ابراهيم الخزرجي */
(() => {
  "use strict";
  const $ = (id) => document.getElementById(id);
  const root = document.documentElement;
  const native = window.ibratvNative || null;
  const toast = (m, e) => (window.IBRATV_toast ? window.IBRATV_toast(m, e) : console.log(m));
  const esc = (s) => String(s ?? "").replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c]));
  const K = "ibratv2:cinema:";
  const load = (k, d) => { try { const v = JSON.parse(localStorage.getItem(K + k)); return v ?? d; } catch { return d; } };
  const save = (k, v) => { try { localStorage.setItem(K + k, JSON.stringify(v)); } catch {} };

  /* ================= sites ================= */
  // the user's list first, then legal / official platforms
  const DEFAULT_SITES = [
    { id: "cinemana", name: "سينمانا", url: "https://cinemana.shabakaty.com/home", desc: "أفلام ومسلسلات — شبكتي" },
    { id: "shahid", name: "شاهد", url: "https://shahid.mbc.net/ar", desc: "MBC — مسلسلات وبرامج عربية" },
    { id: "egybest", name: "إيجي بست", url: "https://www.egybest.co.in/", desc: "أفلام ومسلسلات" },
    { id: "mycima", name: "ماي سيما", url: "https://mycima.locker/", desc: "أفلام ومسلسلات" },
    { id: "cima4u", name: "سيما فور يو", url: "https://a.cima4u.cam/", desc: "أفلام ومسلسلات" },
    { id: "streamimdb", name: "StreamIMDb", url: "https://streamimdb.ru/", desc: "أفلام ومسلسلات" },
    { id: "plex", name: "Plex", url: "https://watch.plex.tv/", desc: "أفلام ومسلسلات مجانية رسمية" },
    { id: "topcinema", name: "توب سينما", url: "https://topcinemaa.vip/", desc: "أفلام ومسلسلات" },
    { id: "moviz", name: "موفيز لاند", url: "https://www.moviz.land/", desc: "أفلام ومسلسلات" },
    { id: "ytstv", name: "YTS TV", url: "https://ytstv.bz/", desc: "أفلام ومسلسلات" },
    { id: "weyyak", name: "وياك", url: "https://weyyak.com/ar", desc: "مسلسلات وأفلام عربية مجانية" },
    { id: "watchit", name: "WATCH IT", url: "https://www.watchit.com/", desc: "دراما وأفلام مصرية" },
    { id: "osnplus", name: "OSN+", url: "https://osnplus.com/ar", desc: "أفلام ومسلسلات عالمية" },
    { id: "tod", name: "TOD", url: "https://www.tod.tv/ar", desc: "رياضة وأفلام — beIN" },
    { id: "viu", name: "Viu", url: "https://www.viu.com/", desc: "دراما عربية وآسيوية" },
    { id: "yango", name: "Yango Play", url: "https://play.yango.com/", desc: "أفلام ومسلسلات" },
    { id: "pluto", name: "Pluto TV", url: "https://pluto.tv/", desc: "قنوات وأفلام مجانية رسمية" },
    { id: "viki", name: "Rakuten Viki", url: "https://www.viki.com/", desc: "دراما كورية وآسيوية مترجمة" },
    { id: "crunchyroll", name: "Crunchyroll", url: "https://www.crunchyroll.com/ar", desc: "أنمي مترجم" },
    { id: "archive", name: "أرشيف الأفلام", url: "https://archive.org/details/feature_films", desc: "أفلام كلاسيكية مجانية — Internet Archive" }
  ];
  const state = {
    custom: load("custom", []),
    hidden: load("hidden", []),
    mode: load("mode", "tv"),
    site: null,
    loading: false,
    canBack: false,
    blocked: 0,
    query: ""
  };
  const sites = () => DEFAULT_SITES.filter((s) => !state.hidden.includes(s.id)).concat(state.custom);
  const hostOf = (u) => { try { return new URL(u).hostname.replace(/^www\./, ""); } catch { return ""; } };
  const logoUrl = (s) => s.logo || `https://www.google.com/s2/favicons?domain=${encodeURIComponent(hostOf(s.url))}&sz=128`;
  const initials = (n) => (n || "?").trim().split(/\s+/).slice(0, 2).map((w) => w[0]).join("").toUpperCase();

  /* ================= engine adapters ================= */
  const CAP = window.Capacitor;
  const IOS = !!(CAP && CAP.getPlatform && CAP.getPlatform() === "ios");
  const ANDROID = !!window.IbraCinema;
  const ELECTRON = !!(native && native.isDesktop);
  let engine;

  function onState(st) {
    if (!state.site) return;
    if (typeof st.loading === "boolean") state.loading = st.loading;
    if (typeof st.canBack === "boolean") state.canBack = st.canBack;
    if (typeof st.blocked === "number") state.blocked = st.blocked;
    if (st.error) toast("تعذّر فتح الموقع: " + st.error, true);
    renderBar();
  }
  window.__ibraCinema = onState;          // Android / iOS push their state here

  // rectangle of the viewer in CSS px (corrected for the car / TV page zoom)
  function viewRect() {
    const el = $("cine-view");
    const r = el.getBoundingClientRect();
    const z = parseFloat(root.style.zoom) || 1;
    let f = 1;
    if (z !== 1) {
      const p = document.createElement("div");
      p.style.cssText = "position:fixed;left:0;top:0;width:100px;height:10px;visibility:hidden";
      document.body.appendChild(p);
      const w = p.getBoundingClientRect().width;
      p.remove();
      f = Math.abs(w - 100 * z) < 1 ? 1 : z;     // some engines report unzoomed values
    }
    return { x: r.left * f, y: r.top * f, w: r.width * f, h: r.height * f };
  }

  const engines = {
    electron() {
      let wv = null, blocked = 0;
      native.onCinemaBlocked?.((n) => { blocked += n; onState({ blocked }); });
      return {
        open(url) {
          blocked = 0;
          if (!wv) {
            wv = document.createElement("webview");
            wv.setAttribute("partition", "persist:cinema");
            wv.setAttribute("webpreferences", "contextIsolation=yes, nativeWindowOpen=yes");
            wv.className = "cine-webview";
            $("cine-view").appendChild(wv);
            const upd = () => { try { onState({ canBack: wv.canGoBack() }); } catch {} };
            wv.addEventListener("did-start-loading", () => onState({ loading: true }));
            wv.addEventListener("did-stop-loading", () => { onState({ loading: false }); upd(); });
            wv.addEventListener("did-navigate", upd);
            wv.addEventListener("did-navigate-in-page", upd);
            wv.addEventListener("did-fail-load", (e) => { if (e.isMainFrame && e.errorCode !== -3) onState({ loading: false, error: e.errorDescription }); });
          }
          wv.setAttribute("src", url);
          try { wv.loadURL(url); } catch {}
          onState({ blocked: 0, loading: true });
        },
        back() { if (wv && wv.canGoBack()) { wv.goBack(); return true; } return false; },
        forward() { if (wv && wv.canGoForward()) wv.goForward(); },
        reload() { wv && wv.reload(); },
        close() { if (wv) { try { wv.stop(); } catch {} wv.remove(); wv = null; } },
        setVisible() {}, bounds() {}
      };
    },
    android() {
      const N = window.IbraCinema;
      return {
        open(url) { const r = viewRect(); N.open(url, r.x, r.y, r.w, r.h); },
        back() { return !!N.back(); },
        forward() { N.forward(); },
        reload() { N.reload(); },
        close() { N.close(); },
        setVisible(v) { N.setVisible(!!v); },
        bounds() { const r = viewRect(); N.setBounds(r.x, r.y, r.w, r.h); }
      };
    },
    ios() {
      const P = CAP.registerPlugin("Cinema");
      P.addListener("state", (st) => onState(st));
      let canBack = false;
      P.addListener("state", (st) => { if (typeof st.canBack === "boolean") canBack = st.canBack; });
      return {
        open(url) { const r = viewRect(); P.open({ url, x: r.x, y: r.y, w: r.w, h: r.h }); },
        back() { if (canBack) { P.back(); return true; } return false; },
        forward() { P.forward(); },
        reload() { P.reload(); },
        close() { P.close(); },
        setVisible(v) { P.setVisible({ visible: !!v }); },
        bounds() { const r = viewRect(); P.setBounds({ x: r.x, y: r.y, w: r.w, h: r.h }); }
      };
    },
    web() {
      let fr = null;
      return {
        open(url) {
          if (!fr) {
            fr = document.createElement("iframe");
            fr.className = "cine-webview";
            // no allow-popups / allow-top-navigation: pop-under ads and frame-busting can't escape
            fr.setAttribute("sandbox", "allow-scripts allow-same-origin allow-forms allow-presentation");
            fr.setAttribute("allow", "autoplay; fullscreen; encrypted-media; picture-in-picture");
            fr.setAttribute("referrerpolicy", "no-referrer");
            fr.addEventListener("load", () => onState({ loading: false }));
            $("cine-view").appendChild(fr);
          }
          fr.src = url;
          onState({ loading: true });
        },
        back() { return false; }, forward() {}, reload() { if (fr) fr.src = fr.src; },
        close() { if (fr) { fr.remove(); fr = null; } }, setVisible() {}, bounds() {}
      };
    }
  };
  engine = ELECTRON ? engines.electron() : ANDROID ? engines.android() : IOS ? engines.ios() : engines.web();
  const NATIVE_OVERLAY = ANDROID || IOS;

  /* ================= UI ================= */
  function renderGrid() {
    const q = state.query.trim().toLowerCase();
    const list = sites().filter((s) => !q || (s.name + " " + s.url + " " + (s.desc || "")).toLowerCase().includes(q));
    $("cine-grid").innerHTML = list.map((s) => `
      <div class="cine-card" data-site="${esc(s.id)}" tabindex="0" role="button" title="${esc(s.name)}">
        <div class="cine-logo" data-ini="${esc(initials(s.name))}"><img src="${esc(logoUrl(s))}" alt="" loading="lazy" referrerpolicy="no-referrer"></div>
        <div class="cine-txt"><b>${esc(s.name)}</b><small>${esc(s.desc || hostOf(s.url))}</small></div>
        <button class="cine-del" data-del-site="${esc(s.id)}" title="حذف من القائمة" tabindex="-1">×</button>
      </div>`).join("") + `
      <div class="cine-card add" id="cine-add-card" tabindex="0" role="button"><div class="cine-logo plus">＋</div><div class="cine-txt"><b>إضافة موقع</b><small>أي موقع أفلام أو مسلسلات</small></div></div>`;
    $("cine-count").textContent = `${list.length.toLocaleString("ar-IQ")} موقع`;
    $("cine-restore").classList.toggle("hidden", !state.hidden.length);
  }
  document.addEventListener("error", (e) => {
    const img = e.target;
    if (img.tagName === "IMG" && img.parentElement && img.parentElement.classList.contains("cine-logo")) {
      const box = img.parentElement; box.classList.add("ph"); box.textContent = box.dataset.ini || "?";
    }
  }, true);

  function renderBar() {
    const s = state.site;
    if (!s) return;
    $("cine-site-name").textContent = s.name;
    const lg = $("cine-site-logo");
    lg.dataset.ini = initials(s.name);
    lg.classList.remove("ph");
    lg.innerHTML = `<img src="${esc(logoUrl(s))}" alt="" referrerpolicy="no-referrer">`;
    $("cine-progress").classList.toggle("on", state.loading);
    $("cine-back").disabled = !state.canBack && !NATIVE_OVERLAY;
    $("cine-shield").textContent = state.blocked ? `🛡️ ${state.blocked.toLocaleString("ar-IQ")}` : "🛡️";
    $("cine-shield").title = state.blocked ? `تم حظر ${state.blocked} إعلان/نافذة منبثقة` : "مانع الإعلانات يعمل";
  }

  function openSite(s) {
    state.site = s; state.blocked = 0; state.canBack = false; state.loading = true;
    $("cine-home").classList.add("hidden");
    $("cine-site").classList.remove("hidden");
    renderBar();
    save("last", s.id);
    requestAnimationFrame(() => requestAnimationFrame(() => { engine.open(s.url); syncOverlay(); }));
    if (window.ibratvNative?.setStreamHeaders) { /* TV headers don't apply to the cinema session */ }
  }
  function closeSite() {
    engine.close();
    state.site = null;
    $("cine-site").classList.add("hidden");
    $("cine-home").classList.remove("hidden");
    renderGrid();
    focusFirstCard();
  }
  function focusFirstCard() { if (root.classList.contains("spatial")) setTimeout(() => document.querySelector(".cine-card")?.focus(), 60); }

  function setMode(mode) {
    state.mode = mode === "cinema" ? "cinema" : "tv";
    save("mode", state.mode);
    root.classList.toggle("mode-cinema", state.mode === "cinema");
    $("cinema").classList.toggle("hidden", state.mode !== "cinema");
    document.querySelectorAll("[data-mode]").forEach((b) => b.classList.toggle("on", b.dataset.mode === state.mode));
    window.dispatchEvent(new CustomEvent("ibratv:mode", { detail: state.mode }));
    if (state.mode === "cinema") { renderGrid(); if (!state.site) focusFirstCard(); }
    syncOverlay();
  }

  // native overlays sit above the page: hide them while a dialog / drawer / other mode is showing
  function syncOverlay() {
    if (!NATIVE_OVERLAY || !state.site) return;
    const blocked = state.mode !== "cinema" || !!document.querySelector(".modal:not(.hidden)") || !!document.querySelector(".groups.open") || !$("notice").classList.contains("hidden");
    engine.setVisible(!blocked);
    if (!blocked) engine.bounds();
  }
  new MutationObserver(syncOverlay).observe(document.body, { subtree: true, attributes: true, attributeFilter: ["class"] });
  addEventListener("resize", () => setTimeout(syncOverlay, 60));
  if (window.ResizeObserver) new ResizeObserver(() => syncOverlay()).observe($("cine-view"));

  /* ================= events ================= */
  document.addEventListener("click", (e) => {
    const m = e.target.closest("[data-mode]");
    if (m) { setMode(m.dataset.mode); return; }
    const del = e.target.closest("[data-del-site]");
    if (del) {
      e.stopPropagation();
      const id = del.dataset.delSite;
      const s = sites().find((x) => x.id === id);
      if (state.custom.some((c) => c.id === id)) state.custom = state.custom.filter((c) => c.id !== id);
      else state.hidden.push(id);
      save("custom", state.custom); save("hidden", state.hidden);
      renderGrid(); toast(`أُزيل «${s ? s.name : ""}» من القائمة`);
      return;
    }
    const card = e.target.closest("[data-site]");
    if (card) { const s = sites().find((x) => x.id === card.dataset.site); if (s) openSite(s); return; }
    if (e.target.closest("#cine-add-card")) { $("cine-form").classList.remove("hidden"); $("cine-new-name").focus(); return; }
  });
  document.addEventListener("keydown", (e) => {
    if (e.key === "Enter" && document.activeElement?.matches?.(".cine-card")) { e.preventDefault(); document.activeElement.click(); }
  });
  $("cine-search").addEventListener("input", (e) => { state.query = e.target.value; renderGrid(); });
  $("cine-form-cancel").addEventListener("click", () => $("cine-form").classList.add("hidden"));
  $("cine-form-save").addEventListener("click", () => {
    const name = $("cine-new-name").value.trim();
    let url = $("cine-new-url").value.trim();
    if (url && !/^https?:\/\//i.test(url)) url = "https://" + url;
    if (!name || !hostOf(url)) { toast("اكتب اسم الموقع ورابطه", true); return; }
    state.custom.push({ id: "c" + Date.now().toString(36), name, url, desc: hostOf(url) });
    save("custom", state.custom);
    $("cine-new-name").value = ""; $("cine-new-url").value = "";
    $("cine-form").classList.add("hidden");
    renderGrid(); toast(`➕ أُضيف «${name}»`);
  });
  $("cine-restore").addEventListener("click", () => { state.hidden = []; save("hidden", []); renderGrid(); toast("رجعت المواقع المحذوفة"); });
  $("cine-close").addEventListener("click", closeSite);
  $("cine-back").addEventListener("click", () => { if (!engine.back()) closeSite(); });
  $("cine-forward").addEventListener("click", () => engine.forward());
  $("cine-reload").addEventListener("click", () => engine.reload());
  $("cine-external").addEventListener("click", () => {
    if (!state.site) return;
    if (native?.openExternal) native.openExternal(state.site.url); else window.open(state.site.url, "_blank", "noopener");
  });

  // Android back button / Esc: page back → close site → back to TV
  window.IBRATV_cinemaBack = () => {
    if (state.mode !== "cinema") return false;
    if (state.site) { if (!engine.back()) closeSite(); return true; }
    if (!$("cine-form").classList.contains("hidden")) { $("cine-form").classList.add("hidden"); return true; }
    setMode("tv");
    return true;
  };

  setMode(state.mode);
})();
