/* IBRATV 2.0 — مشغل تلفزيون مباشر
   برمجة و تطوير ابراهيم الخزرجي */
(() => {
  "use strict";

  /* ================= constants ================= */
  const IPTV = "https://iptv-org.github.io/iptv/";
  const native = window.ibratvNative || null;
  const $ = (id) => document.getElementById(id);
  const P = "ibratv2:";
  const coll = new Intl.Collator(["ar", "en"], { sensitivity: "base", numeric: true });
  let regionNames = null;
  try { regionNames = new Intl.DisplayNames(["ar"], { type: "region" }); } catch {}

  const ARAB = ["iq", "sa", "ae", "kw", "qa", "bh", "om", "ye", "jo", "lb", "sy", "ps", "eg", "sd", "ly", "tn", "dz", "ma", "mr", "so", "dj", "km"];

  const CAT = {
    news: ["أخبار", "📰"], movies: ["أفلام", "🎬"], series: ["مسلسلات", "🎞️"], sports: ["رياضة", "⚽"],
    kids: ["أطفال", "🧸"], animation: ["رسوم متحركة", "🎨"], music: ["موسيقى", "🎵"], religious: ["دينية", "🕌"],
    documentary: ["وثائقي", "🌍"], entertainment: ["ترفيه", "🎭"], general: ["عامة", "📺"], comedy: ["كوميديا", "😂"],
    cooking: ["طبخ", "🍳"], education: ["تعليم", "🎓"], business: ["اقتصاد", "💼"], culture: ["ثقافة", "🏛️"],
    auto: ["سيارات", "🚗"], lifestyle: ["لايف ستايل", "✨"], travel: ["سفر", "✈️"], weather: ["طقس", "⛅"],
    shop: ["تسوّق", "🛍️"], classic: ["كلاسيك", "📼"], family: ["عائلي", "👨‍👩‍👧"], outdoor: ["طبيعة", "🌲"],
    science: ["علوم", "🔬"], legislative: ["برلمانية", "⚖️"], public: ["حكومية", "🏢"], relax: ["استرخاء", "🧘"],
    interactive: ["تفاعلية", "🎮"], undefined: ["غير مصنّفة", "❔"]
  };

  const countryName = (cc) => {
    if (!cc) return "بدون دولة";
    try { return (regionNames && regionNames.of(cc.toUpperCase())) || cc.toUpperCase(); } catch { return cc.toUpperCase(); }
  };
  const flagUrl = (cc) => `https://flagcdn.com/w40/${cc}.png`;

  /* ================= playlist library ================= */
  const LIBRARY = [
    { title: "المختارات والعراق", items: [
      { id: "picks", name: "مختارات المشاهد العربي", sub: "العراقية، MBC، الأخبار، الرياضة", urls: [IPTV + "countries/iq.m3u", IPTV + "languages/ara.m3u", IPTV + "regions/arab.m3u", IPTV + "categories/sports.m3u"], icon: "⭐" },
      { id: "iq", name: "قنوات العراق", url: IPTV + "countries/iq.m3u", flag: "iq" }
    ] },
    { title: "عربي", items: [
      { id: "ara", name: "القنوات العربية", sub: "كل القنوات الناطقة بالعربية", url: IPTV + "languages/ara.m3u", icon: "ض" },
      { id: "arab", name: "الوطن العربي", url: IPTV + "regions/arab.m3u", icon: "🌙" },
      { id: "gcc", name: "دول الخليج", url: IPTV + "regions/gcc.m3u", icon: "🏝️" },
      { id: "mena", name: "الشرق الأوسط وشمال أفريقيا", url: IPTV + "regions/mena.m3u", icon: "🧭" }
    ] },
    { title: "الدول العربية والجوار", items: ["sa", "ae", "kw", "qa", "bh", "om", "eg", "jo", "lb", "sy", "ps", "ye", "ly", "tn", "dz", "ma", "sd", "tr", "ir"]
      .map((cc) => ({ id: cc, name: countryName(cc), url: IPTV + `countries/${cc}.m3u`, flag: cc })) },
    { title: "عالمي", items: [
      { id: "all", name: "كل قنوات العالم", sub: "+11,000 قناة", url: IPTV + "index.m3u", icon: "🌐" },
      { id: "eng", name: "قنوات إنكليزية", url: IPTV + "languages/eng.m3u", icon: "🇬🇧" },
      { id: "ww", name: "قنوات عالمية (Worldwide)", url: IPTV + "regions/ww.m3u", icon: "🛰️" },
      { id: "eur", name: "أوروبا", url: IPTV + "regions/eur.m3u", icon: "🇪🇺" },
      { id: "us", name: countryName("us"), url: IPTV + "countries/us.m3u", flag: "us" },
      { id: "gb", name: countryName("gb"), url: IPTV + "countries/uk.m3u", flag: "gb" },
      { id: "fr", name: countryName("fr"), url: IPTV + "countries/fr.m3u", flag: "fr" },
      { id: "in", name: countryName("in"), url: IPTV + "countries/in.m3u", flag: "in" }
    ] },
    { title: "حسب النوع (من كل العالم)", items: ["news", "sports", "movies", "series", "kids", "animation", "documentary", "music", "religious", "entertainment", "comedy", "cooking", "education", "science", "travel"]
      .map((c) => ({ id: "cat-" + c, name: CAT[c][0], url: IPTV + `categories/${c}.m3u`, icon: CAT[c][1] })) }
  ];
  const DEFAULT_PINS = ["picks", "iq", "ara", "arab", "all", "cat-news", "cat-sports", "cat-movies", "cat-series", "cat-kids"];

  /* ================= Arab viewer picks (مختارات المشاهد العربي) =================
     matched by tvg-id so links stay fresh with every playlist update.
     "id@feed" pins a specific feed (e.g. Al Jazeera Arabic, not English). */
  const PICKS = [
    { key: "mine", name: "قنواتي المضافة", icon: "➕", mine: true },
    { key: "iraq", name: "القنوات العراقية", flag: "iq", ids: ["AlIraqia.iq", "AlIraqiaNews.iq", "AlIraqiaSport.iq", "Alrabiaa.iq", "AlSharqiya.iq", "AlSharqiyaNews.iq", "MBCIraq.iq", "UTV.iq", "DijlahTV.iq", "INews.iq", "AlRasheedTV.iq", "ShamsTV.iq", "IraqFuture.iq", "AlawlaTV.iq", "SamarraTV.iq", "AlghadeerTV.iq", "AnwarTV2.iq", "AlJanoubTV.iq", "RudawTV.iq", "Kurdistan24.iq", "Kurdsat.iq"] },
    { key: "mbc", name: "مجموعة MBC", icon: "📺", ids: ["MBC1.ae", "MBCIraq.iq", "MBCDrama.ae", "MBC4.ae", "MBC5.ae", "MBCMasr.eg", "MBCMasr2.eg", "MBCMasrDrama.sa", "MBC1Egypt.eg", "MBCPlusDrama.sa", "MBCBollywood.ae", "MBC3USA.us", "MBCDramaUSA.us", "MBCFM.ae"] },
    { key: "news", name: "الأخبار العربية", icon: "📰", ids: ["AlJazeera.qa@arabic", "AlJazeeraMubasher.qa", "Alarabiya.ae", "SkyNewsArabia.ae@hd", "AsharqNews.sa", "AlIraqiaNews.iq", "AlSharqiyaNews.iq", "BBCArabic.uk", "France24.fr@arabic", "AlEkhbariya.sa", "TRTArabi.tr", "AlGhadTV.eg", "AlMayadeenTV.lb", "CNBCArabiya.ae", "AlArabiyaBusiness.ae", "CGTNArabic.cn", "Medi1TVArabic.ma"] },
    { key: "variety", name: "منوعات ودراما عربية", icon: "🎭", ids: ["DubaiTVInternational.ae", "RoyaTV.jo", "QatarTelevision.qa", "LBCInternational.lb", "MTVLebanon.lb", "AlJadeed.lb", "Maraya.sa", "AlSharqiyaMinKabla.ae", "RotanaDrama.sa", "RotanaCinemaKSA.sa", "RotanaCinemaEgypt.eg", "RotanaComedy.sa", "RotanaClassic.sa", "RotanaKhalijia.sa", "NileDrama.eg", "iFilmArabic.ir", "2M.ma", "ElWatania1.tn", "AsharqDocumentary.sa", "AlJazeeraDocumentary.qa"] },
    { key: "sports", name: "الرياضة", icon: "⚽", ids: ["AlIraqiaSport.iq", "Alrabiaa.iq", "beINSPORTSXTRA.us", "SharjahSports.ae", "JordanSport.jo", "OmanSportsTV.om", "BahrainSports1.bh", "BahrainSports2.bh", "Prime.sy"], rule: (ch) => ch.cats.includes("sports") && ARAB.includes(ch.cc) },
    { key: "kids", name: "أطفال", icon: "🧸", ids: ["SpacetoonArabic.ae", "CartoonNetworkArabic.ae", "MBC3USA.us", "AfarinBaxcha.iq"] },
    { key: "religious", name: "دينية", icon: "🕌", ids: ["Alquran.iq", "QatarTVTheHolyQuran.qa", "ImamHusseinTV1.iq", "AlabbassiaTV.iq", "KarbalaDocumentary.iq", "IqraaArabic.sa", "AlResalah.sa"] }
  ].map((p) => ({ ...p, ids: (p.ids || []).map((x) => x.toLowerCase()) }));
  // ready-made favourites for a new Arab viewer (first launch)
  const SEED_FAVORITES = ["AlIraqia.iq", "AlIraqiaNews.iq", "AlIraqiaSport.iq", "Alrabiaa.iq", "AlSharqiya.iq", "MBCIraq.iq", "UTV.iq", "MBC1.ae", "MBCDrama.ae", "MBC4.ae", "MBCMasr.eg", "AlJazeera.qa@arabic", "Alarabiya.ae", "SkyNewsArabia.ae@hd", "DubaiTVInternational.ae", "SpacetoonArabic.ae", "beINSPORTSXTRA.us", "SharjahSports.ae"].map((x) => x.toLowerCase());
  // channels not in the free M3U lists: official YouTube live streams
  const BUILTIN_EXTRA = [
    { key: "youtube:@alrabiaatv", url: "youtube:@alrabiaatv", name: "الرابعة Alrabiaa", tid: "alrabiaa.iq", feed: "", logo: "", cc: "iq", cats: ["general", "sports"], height: 0, interlaced: false, rc: "", geo: false, not247: false, ua: "", ref: "", yt: true, idx: -1 }
  ];
  const EXTRA_SOURCES = ["picks", "iq", "ara", "arab", "mena", "all", "cat-sports"];

  /* ================= state ================= */
  const load = (k, d) => { try { const v = JSON.parse(localStorage.getItem(P + k)); return v ?? d; } catch { return d; } };
  const save = (k, v) => { try { localStorage.setItem(P + k, JSON.stringify(v)); } catch {} };

  const state = {
    sourceId: load("v21", false) ? load("source", "picks") : "picks",
    mine: load("mine", []),
    custom: load("custom", []),
    pins: (() => { const p = load("pins", DEFAULT_PINS); if (!load("v21", false) && !p.includes("picks")) p.unshift("picks"); return p; })(),
    channels: [],
    byUrl: new Map(),
    groupBy: load("groupBy", "country"),
    group: null,                 // {type:'special'|'country'|'category'|'name', key}
    res: "all",
    hideLimited: load("hideLimited", false),
    sort: load("sort", "name"),
    query: "",
    list: [],
    rendered: 0,
    sel: -1,
    favorites: load("favorites", []),   // channel snapshots
    recent: load("recent", []),
    current: null,
    engine: null,
    loadToken: 0,
    settings: Object.assign({ glass: 0.55, resumeLast: true, autoRefresh: true, notifyChannels: true }, load("settings", {}))
  };

  function allSources() {
    const custom = { title: "قوائمي الخاصة", items: state.custom.map((c) => ({ ...c, icon: "★", custom: true })) };
    return state.custom.length ? [custom, ...LIBRARY] : LIBRARY;
  }
  function findSource(id) {
    for (const s of allSources()) for (const it of s.items) if (it.id === id) return it;
    return null;
  }

  const DEVICE = window.IBRATV_DEVICE || "windows";
  const SPATIAL = DEVICE === "tv" || DEVICE === "car";   // remote / D-pad / steering-wheel keys

  /* ================= helpers ================= */
  const esc = (s) => String(s ?? "").replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c]));
  const fmt = (n) => Number(n).toLocaleString("ar-IQ");
  function toast(msg, err) {
    const el = document.createElement("div");
    el.className = "toast" + (err ? " err" : "");
    el.textContent = msg;
    $("toasts").appendChild(el);
    setTimeout(() => el.remove(), 3800);
  }
  function status(text, kind) {
    $("status-text").textContent = text;
    $("status-dot").className = "dot " + (kind || "");
  }
  function resClass(h) { return h >= 2160 ? "4k" : h >= 1080 ? "fhd" : h >= 720 ? "hd" : h > 0 ? "sd" : ""; }
  const RES_LABEL = { "4k": "4K", fhd: "FHD", hd: "HD", sd: "SD" };
  function logoHTML(ch, cls = "logo") {
    const initials = esc((ch.name || "TV").replace(/[^\p{L}\p{N}]+/gu, " ").trim().split(" ").slice(0, 2).map((w) => w[0]).join("").toUpperCase() || "TV");
    if (ch.logo) return `<div class="${cls}" data-ini="${initials}"><img src="${esc(ch.logo)}" loading="lazy" decoding="async" referrerpolicy="no-referrer" alt=""></div>`;
    return `<div class="${cls} ph">${initials}</div>`;
  }
  // broken logo → initials placeholder (CSP blocks inline onerror)
  document.addEventListener("error", (e) => {
    const img = e.target;
    if (img.tagName !== "IMG") return;
    const box = img.parentElement;
    if (box && (box.classList.contains("logo") || box.classList.contains("now-logo")) && box.dataset.ini !== undefined) {
      box.classList.add("ph"); box.textContent = box.dataset.ini;
    } else if (img.closest(".gico, .li-ico, .sub, .src, .now-meta")) img.remove();
  }, true);

  /* ================= M3U parser ================= */
  function parseM3U(text) {
    const out = [];
    const seen = new Set();
    let cur = null;
    const lines = text.replace(/^﻿/, "").split(/\r?\n/);
    for (let raw of lines) {
      const line = raw.trim();
      if (!line) continue;
      if (line.startsWith("#EXTINF")) {
        const comma = findNameComma(line);
        const meta = line.slice(0, comma);
        const title = line.slice(comma + 1).trim();
        const a = {};
        meta.replace(/([\w-]+)="([^"]*)"/g, (_, k, v) => { a[k.toLowerCase()] = v; return ""; });
        cur = { title, id: a["tvg-id"] || "", logo: a["tvg-logo"] || "", group: a["group-title"] || "", ua: a["http-user-agent"] || "", ref: a["http-referrer"] || a["http-referer"] || "", country: (a["tvg-country"] || "").toLowerCase() };
      } else if (line.startsWith("#EXTVLCOPT")) {
        if (!cur) continue;
        const m = line.match(/^#EXTVLCOPT:http-(user-agent|referrer|referer)=(.*)$/i);
        if (m) { if (/agent/i.test(m[1])) cur.ua = cur.ua || m[2].trim(); else cur.ref = cur.ref || m[2].trim(); }
      } else if (line.startsWith("#EXTGRP:")) {
        if (cur && !cur.group) cur.group = line.slice(8).trim();
      } else if (!line.startsWith("#")) {
        if (!/^(https?|rtmp|rtsp):\/\//i.test(line)) { cur = null; continue; }
        if (seen.has(line)) { cur = null; continue; }
        const ch = buildChannel(cur || { title: line }, line, out.length);
        if (ch) { seen.add(line); out.push(ch); }
        cur = null;
      }
    }
    return out;
  }
  function findNameComma(line) {
    // the name comes after the last comma that is outside quotes
    let q = false, pos = -1;
    for (let i = 0; i < line.length; i++) {
      const c = line[i];
      if (c === '"') q = !q;
      else if (c === "," && !q) pos = i;
    }
    return pos < 0 ? line.length : pos;
  }
  function buildChannel(m, url, idx) {
    let name = m.title || "";
    let height = 0, interlaced = false;
    const r = name.match(/\((\d{3,4})([pi])\)/i);
    if (r) { height = +r[1]; interlaced = r[2].toLowerCase() === "i"; }
    const geo = /\[geo-?blocked\]/i.test(name);
    const not247 = /\[not 24\/7\]/i.test(name);
    name = name.replace(/\(\d{3,4}[pi]\)/gi, "").replace(/\[[^\]]*\]/g, "").replace(/\s{2,}/g, " ").trim() || "قناة";
    let cc = m.country && /^[a-z]{2}$/.test(m.country) ? m.country : "";
    const idm = (m.id || "").match(/\.([a-z]{2})(?:@|$)/i);
    if (idm) cc = idm[1].toLowerCase();
    if (cc === "uk") cc = "gb";
    const cats = (m.group || "Undefined").split(";").map((s) => s.trim().toLowerCase()).filter(Boolean);
    if (cats.includes("xxx")) return null;
    const [tid, feed = ""] = (m.id || "").toLowerCase().split("@");
    return {
      key: url, url, name, tid, feed, logo: /^https?:\/\//i.test(m.logo) ? m.logo : "",
      cc, cats: cats.length ? cats : ["undefined"], height, interlaced, rc: resClass(height),
      geo, not247, ua: m.ua || "", ref: m.ref || "", idx
    };
  }

  /* ================= loading playlists ================= */
  async function fetchPlaylist(url, force) {
    if (native) {
      const preferCache = !force;
      const maxAgeMs = state.settings.autoRefresh ? 6 * 3600e3 : 365 * 24 * 3600e3;
      const r = await native.fetchText(url, { preferCache, maxAgeMs });
      if (!r.ok) throw new Error(r.error || "تعذّر التحميل");
      return r;
    }
    const res = await fetch(url, { cache: force ? "no-store" : "default" });
    if (!res.ok) throw new Error("HTTP " + res.status);
    return { ok: true, text: await res.text(), fromCache: false };
  }

  async function fetchMany(urls, force) {
    const res = await Promise.allSettled(urls.map((u) => fetchPlaylist(u, force)));
    const ok = res.filter((x) => x.status === "fulfilled").map((x) => x.value);
    if (!ok.length) throw new Error(res[0].reason?.message || "تعذّر التحميل");
    return { ok: true, text: ok.map((r) => r.text).join("\n"), fromCache: ok.every((r) => r.fromCache), offline: ok.some((r) => r.offline), savedAt: Math.min(...ok.map((r) => r.savedAt || Date.now())) };
  }
  function withExtras(chans, src) {
    const have = new Set(chans.map((c) => c.key));
    const extra = [];
    if (EXTRA_SOURCES.includes(src.id)) BUILTIN_EXTRA.forEach((c) => { if (!have.has(c.key)) extra.push({ ...c }); });
    state.mine.forEach((c) => { if (!have.has(c.key)) extra.push({ ...c }); });
    extra.forEach((c, i) => { c.idx = chans.length + i; });
    return chans.concat(extra);
  }

  /* ---- picks ---- */
  const pickId = (ch) => (ch.tid || "") ;
  function pickRank(sec, ch) {
    if (sec.mine) return ch.mine ? 0 : -1;
    let i = sec.ids.indexOf(pickId(ch) + "@" + (ch.feed || ""));
    if (i < 0) { i = sec.ids.indexOf(pickId(ch)); if (i >= 0 && sec.ids.some((x) => x.startsWith(pickId(ch) + "@"))) i = -1; }
    if (i >= 0) return i;
    if (sec.rule && sec.rule(ch)) return 500;
    return -1;
  }
  function pickList(key) {
    const sec = PICKS.find((p) => p.key === key);
    if (!sec) return [];
    const best = new Map();
    for (const ch of state.channels) {
      const r = pickRank(sec, ch);
      if (r < 0) continue;
      const id = ch.mine || !ch.tid ? ch.key : ch.tid;
      const cur = best.get(id);
      const score = (c) => (c.geo ? 0 : 100000) + (c.not247 ? 0 : 50000) + (c.height || 0);
      if (!cur || score(ch) > score(cur.ch)) best.set(id, { ch, r });
    }
    return [...best.values()].sort((a, b) => a.r - b.r || coll.compare(a.ch.name, b.ch.name)).map((x) => x.ch);
  }
  function seedFavorites() {
    if (load("seededFav", false)) return;
    const found = [];
    for (const id of SEED_FAVORITES) {
      const [t, f] = id.split("@");
      const cands = state.channels.filter((c) => c.tid === t && (!f || c.feed === f));
      if (!cands.length) continue;
      cands.sort((a, b) => (a.geo - b.geo) || (b.height - a.height));
      found.push(cands[0]);
    }
    if (found.length < 5) return;          // wait for a playlist that has them
    const have = new Set(state.favorites.map((f) => f.key));
    state.favorites = state.favorites.concat(found.filter((c) => !have.has(c.key)).map(snapshot));
    save("favorites", state.favorites); save("seededFav", true);
  }

  async function openSource(id, { force = false, keepGroup = false } = {}) {
    const src = findSource(id) || findSource("all");
    const token = ++state.loadToken;
    state.sourceId = src.id; save("source", src.id);
    renderQuickSources();
    status(`جارٍ تحميل «${src.name}»…`, "busy");
    $("source-label").textContent = src.name;
    if (!state.channels.length) $("ch-list").innerHTML = `<div class="empty"><div class="ring" style="margin:0 auto 14px"></div><b>جارٍ تحميل القنوات…</b>${esc(src.name)}</div>`;
    try {
      const r = src.text ? { text: src.text, fromCache: true } : src.urls ? await fetchMany(src.urls, force) : await fetchPlaylist(src.url, force);
      if (token !== state.loadToken) return;
      const chans = withExtras(parseM3U(r.text), src);
      if (!chans.length) throw new Error("القائمة لا تحتوي قنوات صالحة");
      state.channels = chans;
      state.byUrl = new Map(chans.map((c) => [c.key, c]));
      if (!keepGroup) {
        state.group = { type: "special", key: "all" };
        if (state.groupBy === "country" && chans.some((c) => c.cc === "iq") && new Set(chans.map((c) => c.cc)).size > 1) state.group = { type: "country", key: "iq" };
        if (src.id === "picks") state.group = { type: "pick", key: "iraq" };
      }
      const when = r.savedAt ? new Date(r.savedAt).toLocaleString("ar-IQ", { dateStyle: "short", timeStyle: "short" }) : "";
      status(`${fmt(chans.length)} قناة${r.offline ? " — بدون إنترنت، نسخة محفوظة" : r.fromCache ? " — من النسخة المحفوظة" : ""}`, r.offline ? "err" : "ok");
      $("cache-info").textContent = when ? `آخر تحديث: ${when}` : "—";
      seedFavorites();
      renderGroups(); renderList(true);
      if (force) toast(`تم تحديث «${src.name}»`);
      afterSourceLoaded(src, r, chans, token);
    } catch (err) {
      if (token !== state.loadToken) return;
      status(`فشل تحميل «${src.name}»: ${err.message}`, "err");
      toast(`تعذّر تحميل القائمة — تأكد من الإنترنت`, true);
      if (!state.channels.length) $("ch-list").innerHTML = `<div class="empty"><b>تعذّر تحميل القائمة</b>${esc(err.message)}<br><br><button class="btn ghost" data-retry-source>إعادة المحاولة</button></div>`;
    }
  }

  /* ================= quick sources bar ================= */
  function srcIcon(it) {
    if (it.flag) return `<img src="${flagUrl(it.flag)}" alt="">`;
    return `<span>${esc(it.icon || "•")}</span>`;
  }
  function renderQuickSources() {
    const ids = [...state.pins];
    if (!ids.includes(state.sourceId)) ids.push(state.sourceId);
    $("quick-sources").innerHTML = ids.map(findSource).filter(Boolean)
      .map((it) => `<button class="src ${it.id === state.sourceId ? "on" : ""}" data-source="${esc(it.id)}" title="${esc(it.sub || it.name)}">${srcIcon(it)}${esc(shortName(it))}</button>`).join("");
  }
  const shortName = (it) => ({ iq: "العراق", ara: "العربية", arab: "الوطن العربي", all: "العالم", gcc: "الخليج" }[it.id] || it.name);

  function renderLibrary() {
    const mineHtml = state.mine.length ? `<div class="lib-sec"><h4>قنواتي المضافة</h4><div class="lib-grid">${state.mine.map((c) => `<div class="lib-item"><span class="li-ico">${c.yt ? "▶️" : "📡"}</span><span class="li-txt"><b>${esc(c.name)}</b><small dir="ltr">${esc(c.url.slice(0, 38))}</small></span><span class="del" data-delmine="${esc(c.key)}" title="حذف">🗑</span></div>`).join("")}</div></div>` : "";
    $("library-body").innerHTML = mineHtml + allSources().map((sec) => `
      <div class="lib-sec"><h4>${esc(sec.title)}</h4><div class="lib-grid">
      ${sec.items.map((it) => `<button class="lib-item ${it.id === state.sourceId ? "on" : ""}" data-source="${esc(it.id)}">
          <span class="li-ico">${srcIcon(it)}</span>
          <span class="li-txt"><b>${esc(it.name)}</b><small>${esc(it.sub || (it.custom ? "قائمة خاصة" : "IPTV-org"))}</small></span>
          <span class="pin ${state.pins.includes(it.id) ? "on" : ""}" data-pin="${esc(it.id)}" title="تثبيت في الشريط العلوي">★</span>
          ${it.custom ? `<span class="del" data-del="${esc(it.id)}" title="حذف">🗑</span>` : ""}
        </button>`).join("")}
      </div></div>`).join("");
  }

  /* ================= groups ================= */
  function groupKeysOf(ch) {
    if (state.groupBy === "country") return [ch.cc || "--"];
    if (state.groupBy === "category") return ch.cats;
    return [letterOf(ch.name)];
  }
  function letterOf(name) {
    const c = (name || "#").trim().charAt(0);
    if (/[0-9]/.test(c)) return "#";
    if (/[a-z]/i.test(c)) return c.toUpperCase();
    if (/[؀-ۿ]/.test(c)) return c.replace(/[أإآ]/, "ا");
    return c.toUpperCase() || "#";
  }

  function renderPicks() {
    const rows = PICKS.map((p) => ({ p, n: pickList(p.key).length })).filter((x) => x.n > 0);
    $("picks-groups").innerHTML = rows.length ? `<div class="grp-section picks-title">⭐ مختارات المشاهد العربي</div>` + rows.map(({ p, n }) => {
      const on = state.group?.type === "pick" && state.group.key === p.key;
      const ico = p.flag ? `<span class="gico"><img src="${flagUrl(p.flag)}" alt=""></span>` : `<span class="gico">${p.icon}</span>`;
      return `<button class="grp pick ${on ? "on" : ""}" data-pick="${p.key}">${ico}<span class="gname">${esc(p.name)}</span><b>${fmt(n)}</b></button>`;
    }).join("") : "";
  }
  function renderGroups() {
    const counts = new Map();
    for (const ch of state.channels) for (const k of groupKeysOf(ch)) counts.set(k, (counts.get(k) || 0) + 1);
    const f = $("group-filter").value.trim().toLowerCase();
    const label = (k) => state.groupBy === "country" ? countryName(k === "--" ? "" : k) : state.groupBy === "category" ? (CAT[k] ? CAT[k][0] : k) : (k === "#" ? "أرقام ورموز" : `يبدأ بحرف ${k}`);
    let entries = [...counts.entries()].filter(([k]) => !f || label(k).toLowerCase().includes(f) || k.includes(f));
    const isOn = (k) => state.group && state.group.type === state.groupBy && state.group.key === k;
    const item = (k, n) => {
      let ico;
      if (state.groupBy === "country") ico = k === "--" ? `<span class="gico">🏳️</span>` : `<span class="gico"><img src="${flagUrl(k)}" alt=""></span>`;
      else if (state.groupBy === "category") ico = `<span class="gico">${CAT[k] ? CAT[k][1] : "📺"}</span>`;
      else ico = `<span class="gico letter">${esc(k)}</span>`;
      return `<button class="grp ${isOn(k) ? "on" : ""}" data-group="${esc(k)}">${ico}<span class="gname">${esc(label(k))}</span><b>${fmt(n)}</b></button>`;
    };
    renderPicks();
    let html = "";
    if (state.groupBy === "country") {
      const iq = entries.filter(([k]) => k === "iq");
      const arab = entries.filter(([k]) => k !== "iq" && ARAB.includes(k)).sort((a, b) => coll.compare(label(a[0]), label(b[0])));
      const rest = entries.filter(([k]) => !ARAB.includes(k)).sort((a, b) => (a[0] === "--") - (b[0] === "--") || coll.compare(label(a[0]), label(b[0])));
      if (iq.length) html += iq.map(([k, n]) => item(k, n)).join("");
      if (arab.length) html += `<div class="grp-section">الدول العربية</div>` + arab.map(([k, n]) => item(k, n)).join("");
      if (rest.length) html += `<div class="grp-section">دول العالم</div>` + rest.map(([k, n]) => item(k, n)).join("");
    } else if (state.groupBy === "category") {
      entries.sort((a, b) => (a[0] === "undefined") - (b[0] === "undefined") || b[1] - a[1]);
      html = entries.map(([k, n]) => item(k, n)).join("");
    } else {
      const order = (k) => (k === "#" ? 0 : /[A-Z]/.test(k) ? 1 : /[؀-ۿ]/.test(k) ? 2 : 3);
      entries.sort((a, b) => order(a[0]) - order(b[0]) || coll.compare(a[0], b[0]));
      html = entries.map(([k, n]) => item(k, n)).join("");
    }
    $("group-list").innerHTML = html || `<div class="empty" style="padding:20px">لا توجد مجموعات</div>`;
    document.querySelectorAll("[data-special]").forEach((b) => b.classList.toggle("on", state.group?.type === "special" && state.group.key === b.dataset.special));
    document.querySelectorAll("[data-groupby]").forEach((b) => b.classList.toggle("on", b.dataset.groupby === state.groupBy));
    $("cnt-all").textContent = fmt(state.channels.length);
    $("cnt-fav").textContent = fmt(state.favorites.length);
    $("cnt-recent").textContent = fmt(state.recent.length);
  }

  /* ================= channel list ================= */
  const isFav = (key) => state.favorites.some((f) => f.key === key);
  function snapshot(ch) {
    const { key, url, name, tid, feed, logo, cc, cats, height, interlaced, rc, geo, not247, ua, ref, yt, mine } = ch;
    return { key, url, name, tid, feed, logo, cc, cats, height, interlaced, rc, geo, not247, ua, ref, yt, mine };
  }

  function computeList() {
    const g = state.group || { type: "special", key: "all" };
    let list;
    if (g.type === "pick") list = pickList(g.key);
    else if (g.type === "special" && g.key === "fav") list = state.favorites.map((f) => state.byUrl.get(f.key) || f);
    else if (g.type === "special" && g.key === "recent") list = state.recent.map((f) => state.byUrl.get(f.key) || f);
    else if (g.type === "special") list = state.channels.slice();
    else {
      const prev = state.groupBy; state.groupBy = g.type;
      list = state.channels.filter((ch) => groupKeysOf(ch).includes(g.key));
      state.groupBy = prev;
    }
    const q = state.query.trim().toLowerCase();
    if (q) {
      // search always covers the whole playlist + favorites
      const base = g.type === "special" && g.key !== "all" ? list : state.channels;
      list = base.filter((ch) => (ch.name + " " + countryName(ch.cc) + " " + ch.cats.map((c) => (CAT[c] ? CAT[c][0] + " " + c : c)).join(" ")).toLowerCase().includes(q));
    }
    if (state.res !== "all") list = list.filter((ch) => ch.rc === state.res);
    if (state.hideLimited) list = list.filter((ch) => !ch.geo && !ch.not247);
    const keepOrder = (g.type === "special" && (g.key === "recent" || g.key === "fav") && state.sort === "playlist") || (g.type === "pick" && state.sort !== "quality" && !q);
    if (!keepOrder) {
      if (state.sort === "name") list.sort((a, b) => coll.compare(a.name, b.name));
      else if (state.sort === "quality") list.sort((a, b) => b.height - a.height || coll.compare(a.name, b.name));
      else if (g.type !== "special" || g.key === "all") list.sort((a, b) => (a.idx ?? 0) - (b.idx ?? 0));
    }
    return list;
  }

  function groupTitle() {
    const g = state.group || { type: "special", key: "all" };
    if (state.query) return `نتائج «${state.query}»`;
    if (g.type === "special") return { all: "كل القنوات", fav: "المفضلة", recent: "شاهدتها مؤخراً" }[g.key];
    if (g.type === "pick") return PICKS.find((p) => p.key === g.key)?.name || "المختارات";
    if (g.type === "country") return countryName(g.key === "--" ? "" : g.key);
    if (g.type === "category") return CAT[g.key] ? CAT[g.key][0] : g.key;
    return `حرف ${g.key}`;
  }

  const PAGE = 250;
  function rowHTML(ch, i) {
    const cats = ch.cats.filter((c) => c !== "undefined").slice(0, 2).map((c) => (CAT[c] ? CAT[c][0] : c)).join("، ");
    const flag = ch.cc ? `<img src="${flagUrl(ch.cc)}" alt="">${esc(countryName(ch.cc))}` : "";
    const warn = ch.geo ? `<span class="warn" title="قد تكون محجوبة في بعض الدول">⛔ محجوبة جغرافياً</span>` : ch.not247 ? `<span class="warn" title="لا تبث على مدار الساعة">◔ غير مستمرة</span>` : "";
    const playing = state.current && state.current.key === ch.key;
    return `<div class="ch ${playing ? "playing" : ""} ${i === state.sel ? "sel" : ""}" data-i="${i}" tabindex="-1">
      <span class="num">${playing ? "▶" : i + 1}</span>
      ${logoHTML(ch)}
      <div class="info"><div class="nm" title="${esc(ch.name)}">${esc(ch.name)}</div><div class="sub">${flag}${flag && cats ? " · " : ""}${esc(cats)} ${warn}</div></div>
      ${ch.yt ? `<span class="badge yt" title="بث مباشر رسمي على يوتيوب">YouTube</span>` : `<span class="badge ${ch.rc === "4k" ? "r4k" : ch.rc || "none"}" title="${ch.rc ? RES_LABEL[ch.rc] : "الدقة غير معروفة"}">${ch.rc ? ch.height + (ch.interlaced ? "i" : "p") : "—"}</span>`}
      <button class="star-btn ${isFav(ch.key) ? "on" : ""}" data-fav="${i}" title="المفضلة">★</button>
    </div>`;
  }

  function renderList(resetScroll) {
    state.list = computeList();
    state.rendered = Math.min(PAGE, state.list.length);
    if (resetScroll) state.sel = state.list.findIndex((c) => state.current && c.key === state.current.key);
    $("list-title").textContent = groupTitle();
    $("list-count").textContent = `${fmt(state.list.length)} قناة`;
    const box = $("ch-list");
    if (!state.list.length) {
      const g = state.group || {};
      box.innerHTML = `<div class="empty"><b>${g.key === "fav" ? "لا توجد قنوات مفضلة بعد" : g.key === "recent" ? "لم تشاهد أي قناة بعد" : "ما لقينا قنوات"}</b>${g.key === "fav" ? "اضغط ★ بجانب أي قناة لإضافتها" : "جرّب تغيير الفلاتر أو البحث"}</div>`;
    } else {
      const note = state.group?.type === "pick" && state.group.key === "sports" && !state.query
        ? `<div class="info-row">⚽ beIN SPORTS العربية قنوات مدفوعة ومشفّرة وما موجودة بالقوائم المجانية — الموجود هنا beIN SPORTS XTRA المجانية. إذا عندك اشتراك أضف رابطك من «القوائم ← إضافة قناة».</div>` : "";
      box.innerHTML = note + state.list.slice(0, state.rendered).map(rowHTML).join("") + moreHint();
    }
    if (resetScroll) box.scrollTop = 0;
    renderGroupsCountsOnly();
  }
  const moreHint = () => (state.rendered < state.list.length ? `<div class="more-hint" id="more-hint">مرّر للأسفل لعرض المزيد…</div>` : "");
  function renderMore() {
    if (state.rendered >= state.list.length) return;
    const from = state.rendered;
    state.rendered = Math.min(state.rendered + PAGE, state.list.length);
    $("more-hint")?.remove();
    $("ch-list").insertAdjacentHTML("beforeend", state.list.slice(from, state.rendered).map((c, j) => rowHTML(c, from + j)).join("") + moreHint());
  }
  function renderGroupsCountsOnly() {
    $("cnt-fav").textContent = fmt(state.favorites.length);
    $("cnt-recent").textContent = fmt(state.recent.length);
  }
  function refreshRow(i) {
    const el = document.querySelector(`.ch[data-i="${i}"]`);
    if (el && state.list[i]) el.outerHTML = rowHTML(state.list[i], i);
  }
  function refreshPlayingRows() {
    document.querySelectorAll(".ch.playing").forEach((el) => refreshRow(+el.dataset.i));
    const i = state.list.findIndex((c) => state.current && c.key === state.current.key);
    if (i >= 0) refreshRow(i);
  }
  function select(i, scroll = true) {
    if (!state.list.length) return;
    i = Math.max(0, Math.min(state.list.length - 1, i));
    while (i >= state.rendered) renderMore();
    const old = state.sel;
    state.sel = i;
    document.querySelector(`.ch[data-i="${old}"]`)?.classList.remove("sel");
    const el = document.querySelector(`.ch[data-i="${i}"]`);
    el?.classList.add("sel");
    if (scroll) el?.scrollIntoView({ block: "nearest" });
  }

  /* ================= favorites / recent ================= */
  function toggleFav(ch) {
    if (!ch) return;
    if (isFav(ch.key)) { state.favorites = state.favorites.filter((f) => f.key !== ch.key); toast("أُزيلت من المفضلة"); }
    else { state.favorites.unshift(snapshot(ch)); toast(`★ أُضيفت «${ch.name}» للمفضلة`); }
    save("favorites", state.favorites);
    if (state.group?.key === "fav") renderList(false);
    else { const i = state.list.findIndex((c) => c.key === ch.key); if (i >= 0) refreshRow(i); }
    renderGroupsCountsOnly();
    updateNowFav();
  }
  function pushRecent(ch) {
    state.recent = [snapshot(ch), ...state.recent.filter((r) => r.key !== ch.key)].slice(0, 60);
    save("recent", state.recent);
    renderGroupsCountsOnly();
  }

  /* ================= player ================= */
  const video = $("video");
  let stallTimer = null;

  function destroyEngine() {
    clearTimeout(stallTimer);
    const e = state.engine;
    state.engine = null;
    try {
      if (e?.type === "hls") e.obj.destroy();
      else if (e?.type === "mpegts") { e.obj.pause(); e.obj.unload(); e.obj.detachMediaElement(); e.obj.destroy(); }
      else if (e?.type === "dash") e.obj.reset();
    } catch {}
    video.removeAttribute("src");
    try { video.load(); } catch {}
    const f = $("yt"); if (f && !f.classList.contains("hidden")) { f.src = "about:blank"; f.classList.add("hidden"); }
    $("quality").classList.add("hidden");
    $("res-now").textContent = "";
  }

  function showMsg(text, isError) {
    const box = $("screen-msg");
    box.classList.remove("hidden");
    box.classList.toggle("error", !!isError);
    $("screen-msg-text").textContent = text;
    $("retry").classList.toggle("hidden", !isError);
    if (isError) { $("live-tag").classList.add("hidden"); status(text, "err"); }
  }
  const hideMsg = () => $("screen-msg").classList.add("hidden");

  function fail(ch, reason) {
    if (state.current !== ch) return;
    const hint = ch.geo ? " — هذه القناة محجوبة جغرافياً وقد لا تعمل في العراق." : ch.not247 ? " — هذه القناة لا تبث على مدار الساعة." : "";
    showMsg((reason || "تعذّر تشغيل البث، قد يكون الرابط متوقفاً حالياً") + hint, true);
  }

  async function play(ch, { osd = true } = {}) {
    if (!ch) return;
    state.current = ch;
    destroyEngine();
    $("screen-idle").classList.add("hidden");
    showMsg("جارٍ الاتصال بالبث…");
    updateNowPlaying(ch);
    refreshPlayingRows();
    pushRecent(ch);
    save("last", snapshot(ch));
    if (osd) showOSD(ch);
    status(`تشغيل: ${ch.name}`, "busy");

    if (native) { try { await native.setStreamHeaders({ url: ch.url, userAgent: ch.ua, referrer: ch.ref }); } catch {} }
    if (state.current !== ch) return;

    if (ch.url.startsWith("youtube:")) { playYouTube(ch); return; }
    // iPhone: Apple's own player handles HLS natively (no CORS limits, best battery)
    if (native?.ios && !/\.(mpd|flv)(\?|$)/i.test(ch.url)) { playNative(ch); return; }
    const url = ch.url;
    const path = url.split("?")[0].toLowerCase();
    stallTimer = setTimeout(() => { if (state.current === ch && video.readyState < 2) fail(ch, "انتهت مهلة الاتصال بالبث"); }, 25000);

    try {
      if (path.endsWith(".mpd") && window.dashjs) {
        const p = dashjs.MediaPlayer().create();
        p.initialize(video, url, true);
        p.on(dashjs.MediaPlayer.events.ERROR, () => fail(ch));
        state.engine = { type: "dash", obj: p };
      } else if (/\.(ts|flv)$/.test(path) && window.mpegts && mpegts.isSupported()) {
        const p = mpegts.createPlayer({ type: path.endsWith(".flv") ? "flv" : "mpegts", isLive: true, url });
        p.attachMediaElement(video); p.load(); p.play()?.catch?.(() => {});
        p.on(mpegts.Events.ERROR, () => fail(ch));
        state.engine = { type: "mpegts", obj: p };
      } else if (window.Hls && Hls.isSupported() && !/\.(mp4|webm|ogg|mp3|aac)$/.test(path)) {
        const hls = new Hls({ enableWorker: true, lowLatencyMode: false, backBufferLength: 30, manifestLoadingMaxRetry: 2, levelLoadingMaxRetry: 3, fragLoadingMaxRetry: 4 });
        let recovered = 0;
        hls.on(Hls.Events.MANIFEST_PARSED, (_e, d) => {
          video.play().catch(() => showMsg("اضغط ▶ للتشغيل"));
          buildQuality(hls, d.levels);
        });
        hls.on(Hls.Events.LEVEL_SWITCHED, () => updateResNow());
        hls.on(Hls.Events.ERROR, (_e, d) => {
          if (!d.fatal) return;
          if (d.type === Hls.ErrorTypes.MEDIA_ERROR && recovered < 2) { recovered++; hls.recoverMediaError(); return; }
          if (d.type === Hls.ErrorTypes.NETWORK_ERROR && d.details !== Hls.ErrorDetails.MANIFEST_LOAD_ERROR && recovered < 2) { recovered++; hls.startLoad(); return; }
          if (d.details === Hls.ErrorDetails.MANIFEST_PARSING_ERROR) { destroyEngine(); playNative(ch); return; }
          fail(ch, d.response && d.response.code ? `الخادم رفض البث (خطأ ${d.response.code})` : null);
        });
        hls.loadSource(url);
        hls.attachMedia(video);
        state.engine = { type: "hls", obj: hls };
      } else {
        playNative(ch);
      }
    } catch (err) {
      fail(ch, "خطأ في المشغّل: " + err.message);
    }
  }
  async function playYouTube(ch) {
    const target = ch.url.slice(8);
    let id = target.startsWith("v=") ? target.slice(2) : "";
    if (!id) {
      if (!native?.youtubeLive) { fail(ch, "قنوات يوتيوب المباشرة تعمل في نسخة الويندوز"); return; }
      showMsg("جارٍ البحث عن البث المباشر على يوتيوب…");
      const r = await native.youtubeLive(target).catch(() => ({ ok: false }));
      if (state.current !== ch) return;
      if (!r.ok) { fail(ch, r.reason === "offline" ? "القناة لا تبث مباشر على يوتيوب الآن — جرّب بعد شوي" : "تعذّر الوصول لبث يوتيوب"); return; }
      id = r.id;
    }
    clearTimeout(stallTimer);
    state.engine = { type: "youtube" };
    const f = $("yt");
    f.src = `https://www.youtube.com/embed/${id}?autoplay=1&rel=0&modestbranding=1&playsinline=1&hl=ar`;
    f.classList.remove("hidden");
    hideMsg();
    $("live-tag").classList.remove("hidden");
    $("res-now").textContent = "YouTube Live";
    status(`يعمل الآن: ${ch.name} (يوتيوب)`, "ok");
  }
  function playNative(ch) {
    state.engine = { type: "native" };
    video.src = ch.url;
    video.play().catch(() => {});
  }

  function buildQuality(hls, levels) {
    const sel = $("quality");
    const uniq = [];
    levels.forEach((l, i) => { if (l.height && !uniq.some((u) => u.h === l.height)) uniq.push({ h: l.height, i }); });
    if (uniq.length < 2) { sel.classList.add("hidden"); return; }
    uniq.sort((a, b) => b.h - a.h);
    sel.innerHTML = `<option value="-1">الجودة: تلقائي</option>` + uniq.map((u) => `<option value="${u.i}">${u.h}p${u.h >= 2160 ? " 4K" : u.h >= 1080 ? " FHD" : u.h >= 720 ? " HD" : ""}</option>`).join("");
    sel.value = "-1";
    sel.classList.remove("hidden");
  }
  function updateResNow() {
    const h = video.videoHeight;
    $("res-now").textContent = h ? `${h}p${h >= 2160 ? " • 4K" : h >= 1080 ? " • FHD" : h >= 720 ? " • HD" : " • SD"}` : "";
  }

  video.addEventListener("playing", () => {
    clearTimeout(stallTimer);
    hideMsg();
    $("live-tag").classList.remove("hidden");
    if (state.current) status(`يعمل الآن: ${state.current.name}`, "ok");
    setPP(true);
    updateResNow();
  });
  video.addEventListener("waiting", () => { if (state.current) showMsg("جارٍ التخزين المؤقت…"); });
  video.addEventListener("pause", () => setPP(false));
  video.addEventListener("resize", updateResNow);
  video.addEventListener("error", () => { if (state.engine?.type === "native" && state.current) fail(state.current); });

  function setPP(playing) {
    $("pp-icon").innerHTML = playing ? '<path d="M7 5h3.5v14H7zM13.5 5H17v14h-3.5z"/>' : '<path d="M8 5v14l11-7z"/>';
  }

  function updateNowPlaying(ch) {
    const box = $("now-logo");
    box.className = "now-logo";
    box.dataset.ini = (ch.name || "TV").slice(0, 2).toUpperCase();
    box.innerHTML = ch.logo ? `<img src="${esc(ch.logo)}" referrerpolicy="no-referrer" alt="">` : "";
    if (!ch.logo) { box.classList.add("ph"); box.textContent = box.dataset.ini; }
    $("now-name").textContent = ch.name;
    const parts = [];
    if (ch.cc) parts.push(`<img src="${flagUrl(ch.cc)}" alt=""><span>${esc(countryName(ch.cc))}</span>`);
    ch.cats.filter((c) => c !== "undefined").forEach((c) => parts.push(`<span class="pill">${CAT[c] ? CAT[c][1] + " " + CAT[c][0] : esc(c)}</span>`));
    if (ch.rc) parts.push(`<span class="badge ${ch.rc === "4k" ? "r4k" : ch.rc}">${ch.height}${ch.interlaced ? "i" : "p"} ${RES_LABEL[ch.rc]}</span>`);
    if (ch.geo) parts.push(`<span class="pill">⛔ محجوبة جغرافياً</span>`);
    if (ch.not247) parts.push(`<span class="pill">◔ غير مستمرة</span>`);
    $("now-meta").innerHTML = parts.join("");
    $("now-fav").disabled = false;
    updateNowFav();
    document.title = `${ch.name} — IBRATV`;
  }
  function updateNowFav() {
    const on = state.current && isFav(state.current.key);
    $("now-fav").classList.toggle("on", !!on);
    $("now-fav").textContent = on ? "★" : "☆";
  }
  function showOSD(ch) {
    const i = state.list.findIndex((c) => c.key === ch.key);
    const osd = $("osd");
    osd.classList.remove("hidden");
    osd.innerHTML = `${i >= 0 ? `<span class="n">${i + 1}</span>` : ""}${logoHTML(ch)}<span>${esc(ch.name)}</span>`;
    osd.style.animation = "none"; void osd.offsetWidth; osd.style.animation = "";
  }

  function step(delta) {
    if (!state.list.length) return;
    let i = state.current ? state.list.findIndex((c) => c.key === state.current.key) : state.sel;
    i = i < 0 ? 0 : (i + delta + state.list.length) % state.list.length;
    select(i);
    play(state.list[i]);
  }

  /* ================= events ================= */
  // quick sources + library
  document.addEventListener("click", (e) => {
    const pin = e.target.closest("[data-pin]");
    if (pin) {
      e.stopPropagation();
      const id = pin.dataset.pin;
      state.pins = state.pins.includes(id) ? state.pins.filter((p) => p !== id) : [...state.pins, id];
      save("pins", state.pins); renderLibrary(); renderQuickSources(); return;
    }
    const del = e.target.closest("[data-del]");
    if (del) {
      e.stopPropagation();
      const id = del.dataset.del;
      state.custom = state.custom.filter((c) => c.id !== id); state.pins = state.pins.filter((p) => p !== id);
      save("custom", state.custom); save("pins", state.pins);
      renderLibrary(); renderQuickSources(); return;
    }
    const src = e.target.closest("[data-source]");
    if (src) { closeModals(); if (src.dataset.source !== state.sourceId || !state.channels.length) openSource(src.dataset.source); return; }
    if (e.target.closest("[data-retry-source]")) { openSource(state.sourceId, { force: true }); return; }
    if (e.target.closest("[data-close]") || e.target.classList.contains("modal")) { closeModals(); return; }

    const gb = e.target.closest("[data-groupby]");
    if (gb) {
      state.groupBy = gb.dataset.groupby; save("groupBy", state.groupBy);
      if (state.group?.type !== "special") state.group = { type: "special", key: "all" };
      $("group-filter").value = "";
      renderGroups(); renderList(true); return;
    }
    if (e.target.closest("[data-pick], [data-group], [data-special]")) closeDrawer();
    const pk = e.target.closest("[data-pick]");
    if (pk) { state.group = { type: "pick", key: pk.dataset.pick }; clearSearch(); renderGroups(); renderList(true); return; }
    const dm = e.target.closest("[data-delmine]");
    if (dm) {
      e.stopPropagation();
      state.mine = state.mine.filter((c) => c.key !== dm.dataset.delmine); save("mine", state.mine);
      state.channels = state.channels.filter((c) => !(c.mine && c.key === dm.dataset.delmine));
      state.byUrl.delete(dm.dataset.delmine);
      renderLibrary(); renderGroups(); renderList(false); toast("تم حذف القناة"); return;
    }
    const sp = e.target.closest("[data-special]");
    if (sp) { state.group = { type: "special", key: sp.dataset.special }; clearSearch(); renderGroups(); renderList(true); return; }
    const gr = e.target.closest("[data-group]");
    if (gr) { state.group = { type: state.groupBy, key: gr.dataset.group }; clearSearch(); renderGroups(); renderList(true); return; }

    const fav = e.target.closest("[data-fav]");
    if (fav) { e.stopPropagation(); toggleFav(state.list[+fav.dataset.fav]); return; }
    const row = e.target.closest(".ch");
    if (row) { const i = +row.dataset.i; select(i, false); play(state.list[i]); return; }

    const rc = e.target.closest("[data-res]");
    if (rc) {
      state.res = rc.dataset.res;
      document.querySelectorAll("[data-res]").forEach((b) => b.classList.toggle("on", b === rc));
      renderList(true);
    }
  });

  $("ch-list").addEventListener("scroll", (e) => {
    const el = e.currentTarget;
    if (el.scrollTop + el.clientHeight > el.scrollHeight - 600) renderMore();
  });
  $("ch-list").addEventListener("dblclick", (e) => { if (e.target.closest(".ch")) toggleFullscreen(); });

  let searchTimer;
  $("search").addEventListener("input", (e) => {
    clearTimeout(searchTimer);
    searchTimer = setTimeout(() => { state.query = e.target.value; renderList(true); }, 160);
  });
  function clearSearch() { if (state.query) { state.query = ""; $("search").value = ""; } }
  $("group-filter").addEventListener("input", renderGroups);
  $("sort").value = state.sort;
  $("sort").addEventListener("change", (e) => { state.sort = e.target.value; save("sort", state.sort); renderList(true); });
  $("hide-limited").checked = state.hideLimited;
  $("hide-limited").addEventListener("change", (e) => { state.hideLimited = e.target.checked; save("hideLimited", state.hideLimited); renderList(true); });

  // player controls
  $("prev").addEventListener("click", () => step(-1));
  $("next").addEventListener("click", () => step(1));
  $("playpause").addEventListener("click", togglePlay);
  $("retry").addEventListener("click", () => state.current && play(state.current, { osd: false }));
  $("now-fav").addEventListener("click", () => state.current && toggleFav(state.byUrl.get(state.current.key) || state.current));
  $("fullscreen").addEventListener("click", toggleFullscreen);
  $("screen").addEventListener("dblclick", toggleFullscreen);
  $("screen").addEventListener("click", (e) => { if (e.target === video) togglePlay(); });
  $("pip").addEventListener("click", async () => {
    try {
      if (native?.ios && video.webkitSetPresentationMode) { video.webkitSetPresentationMode(video.webkitPresentationMode === "picture-in-picture" ? "inline" : "picture-in-picture"); return; }
      if (document.pictureInPictureElement) await document.exitPictureInPicture(); else await video.requestPictureInPicture();
    } catch { toast("صورة داخل صورة غير متاحة الآن", true); }
  });
  $("copy-link").addEventListener("click", async () => {
    if (!state.current) return;
    try { await navigator.clipboard.writeText(state.current.url); toast("تم نسخ رابط البث"); } catch { toast("تعذّر النسخ", true); }
  });
  $("quality").addEventListener("change", (e) => {
    if (state.engine?.type === "hls") { state.engine.obj.currentLevel = +e.target.value; toast(e.target.value === "-1" ? "الجودة: تلقائي" : "تم تغيير الجودة"); }
  });
  const vol = load("volume", 1);
  video.volume = vol; $("volume").value = vol;
  $("volume").addEventListener("input", (e) => { video.volume = +e.target.value; video.muted = false; save("volume", video.volume); updateMute(); });
  $("mute").addEventListener("click", () => { video.muted = !video.muted; updateMute(); });
  function updateMute() { $("vol-wave").style.display = video.muted || video.volume === 0 ? "none" : ""; }

  function togglePlay() {
    if (!state.current) { if (state.list.length) { select(Math.max(0, state.sel)); play(state.list[Math.max(0, state.sel)]); } return; }
    if (video.paused) video.play().catch(() => {}); else video.pause();
  }
  function toggleFullscreen() {
    if (native?.ios && state.engine?.type !== "youtube") { try { video.webkitEnterFullscreen ? video.webkitEnterFullscreen() : video.requestFullscreen(); } catch {} return; }
    if (state.engine?.type === "youtube" && !document.fullscreenElement) { $("screen").requestFullscreen?.().catch(() => {}); return; }
    if (document.fullscreenElement) document.exitFullscreen?.();
    else $("screen").requestFullscreen?.().catch(() => {});
  }

  // keyboard (works with TV remotes / keyboards)
  document.addEventListener("keydown", (e) => {
    const typing = /^(INPUT|SELECT|TEXTAREA)$/.test(document.activeElement?.tagName) && document.activeElement.type !== "range" && document.activeElement.type !== "checkbox";
    if (e.key === "Escape") {
      if (!document.querySelector(".modal:not(.hidden)")) { if (typing) { document.activeElement.blur(); } }
      closeModals(); return;
    }
    if (typing) {
      if (e.key === "Enter" && document.activeElement.id === "search" && state.list.length) { select(0); play(state.list[0]); document.activeElement.blur(); }
      if (e.key === "ArrowDown" && document.activeElement.id === "search") { document.activeElement.blur(); select(0); e.preventDefault(); }
      return;
    }
    if (document.querySelector(".modal:not(.hidden)")) return;
    switch (e.key) {
      case "ArrowDown": if (SPATIAL) return; e.preventDefault(); select(state.sel + 1); break;
      case "ArrowUp": if (SPATIAL) return; e.preventDefault(); select(state.sel - 1); break;
      case "Enter": if (SPATIAL) return; if (state.sel >= 0) play(state.list[state.sel]); break;
      case "PageDown": case "ChannelDown": case "MediaTrackNext": e.preventDefault(); step(1); break;
      case "PageUp": case "ChannelUp": case "MediaTrackPrevious": e.preventDefault(); step(-1); break;
      case " ": case "MediaPlayPause": e.preventDefault(); togglePlay(); break;
      case "f": case "F": case "ب": toggleFullscreen(); break;
      case "m": case "M": case "ة": video.muted = !video.muted; updateMute(); break;
      case "/": e.preventDefault(); $("search").focus(); break;
      case "s": case "S": case "س": if (state.current) toggleFav(state.byUrl.get(state.current.key) || state.current); break;
    }
  });

  /* ================= modals & settings ================= */
  function closeModals() { document.querySelectorAll(".modal").forEach((m) => m.classList.add("hidden")); }
  $("open-library").addEventListener("click", () => { renderLibrary(); $("library").classList.remove("hidden"); });
  $("open-settings").addEventListener("click", () => $("settings").classList.remove("hidden"));

  $("custom-save").addEventListener("click", () => {
    const url = $("custom-url").value.trim();
    const name = $("custom-name").value.trim() || "قائمتي";
    if (!/^https?:\/\//i.test(url)) { toast("أدخل رابط صحيح يبدأ بـ http", true); return; }
    const id = "c-" + Date.now().toString(36);
    state.custom.push({ id, name, url }); state.pins.push(id);
    save("custom", state.custom); save("pins", state.pins);
    $("custom-url").value = ""; $("custom-name").value = "";
    closeModals(); openSource(id);
  });
  function normalizeChannelUrl(u) {
    u = u.trim();
    let m = u.match(/youtube\.com\/(@[\w.\-]+)/i);
    if (m) return "youtube:" + m[1];
    m = u.match(/(?:youtube\.com\/(?:watch\?v=|live\/|embed\/)|youtu\.be\/)([\w-]{11})/i);
    if (m) return "youtube:v=" + m[1];
    return u;
  }
  $("mine-save").addEventListener("click", () => {
    const name = $("mine-name").value.trim();
    const url = normalizeChannelUrl($("mine-url").value);
    const logo = $("mine-logo").value.trim();
    if (!name) { toast("اكتب اسم القناة", true); return; }
    if (!/^(https?|rtmp|rtsp):\/\//i.test(url) && !url.startsWith("youtube:")) { toast("الرابط لازم يبدأ بـ http أو يكون رابط يوتيوب", true); return; }
    const ch = { key: url, url, name, tid: "mine." + Date.now().toString(36), feed: "", logo: /^https?:\/\//i.test(logo) ? logo : "", cc: "", cats: ["undefined"], height: 0, interlaced: false, rc: "", geo: false, not247: false, ua: "", ref: "", yt: url.startsWith("youtube:"), mine: true, idx: state.channels.length };
    state.mine = state.mine.filter((c) => c.key !== ch.key).concat(ch); save("mine", state.mine);
    if (!state.byUrl.has(ch.key)) { state.channels.push(ch); state.byUrl.set(ch.key, ch); }
    if (!isFav(ch.key)) { state.favorites.unshift(snapshot(ch)); save("favorites", state.favorites); }
    ["mine-name", "mine-url", "mine-logo"].forEach((id) => ($(id).value = ""));
    closeModals();
    state.group = { type: "pick", key: "mine" }; clearSearch();
    renderGroups(); renderList(true);
    toast(`➕ أُضيفت «${name}» إلى قنواتك والمفضلة`);
    play(ch);
  });
  $("m3u-file").addEventListener("change", async (e) => {
    const file = e.target.files[0];
    if (!file) return;
    const text = await file.text();
    const id = "f-" + Date.now().toString(36);
    const name = file.name.replace(/\.(m3u8?|txt)$/i, "");
    // local files are kept for this session only (large files would not fit in storage)
    LIBRARY[0].items.push({ id, name: "📁 " + name, sub: "ملف من الحاسبة", text, icon: "📁" });
    e.target.value = "";
    closeModals(); openSource(id);
  });

  function applySettings() {
    document.documentElement.style.setProperty("--ga", state.settings.glass);
    $("glass-level").value = state.settings.glass;
    $("resume-last").checked = state.settings.resumeLast;
    $("auto-refresh").checked = state.settings.autoRefresh;
    $("notify-channels").checked = state.settings.notifyChannels;
  }
  const saveSettings = () => save("settings", state.settings);
  $("glass-level").addEventListener("input", (e) => { state.settings.glass = +e.target.value; document.documentElement.style.setProperty("--ga", state.settings.glass); saveSettings(); });
  $("resume-last").addEventListener("change", (e) => { state.settings.resumeLast = e.target.checked; saveSettings(); });
  $("auto-refresh").addEventListener("change", (e) => { state.settings.autoRefresh = e.target.checked; saveSettings(); });
  $("refresh-now").addEventListener("click", () => { closeModals(); openSource(state.sourceId, { force: true, keepGroup: true }); });
  $("clear-data").addEventListener("click", () => {
    if (!confirm("مسح المفضلة وسجل المشاهدة؟")) return;
    state.favorites = []; state.recent = []; save("favorites", []); save("recent", []);
    renderGroups(); renderList(false); toast("تم المسح");
  });
  document.querySelectorAll('.about a').forEach((a) => a.addEventListener("click", (e) => { if (native) { e.preventDefault(); native.openExternal(a.href); } }));

  /* ================= update notifications ================= */
  // one notification card; app updates take priority over channel updates
  let noticeKind = null;
  function showNotice({ kind, icon = "⬆", title, text = "", goLabel = "تحديث الآن", onGo, laterLabel = "لاحقاً", progress = false }) {
    if (noticeKind === "app" && kind !== "app") return;   // don't hide an app update behind a channel notice
    noticeKind = kind;
    $("notice-ico").textContent = icon;
    $("notice-title").textContent = title;
    $("notice-text").textContent = text;
    $("notice-progress").classList.toggle("hidden", !progress);
    $("notice-go").textContent = goLabel;
    $("notice-go").classList.toggle("hidden", !onGo);
    $("notice-go").disabled = false;
    $("notice-go").onclick = onGo || null;
    $("notice-later").textContent = laterLabel;
    $("notice").classList.remove("hidden");
  }
  function hideNotice() { $("notice").classList.add("hidden"); noticeKind = null; }
  $("notice-later").addEventListener("click", hideNotice);

  /* ---- channels ---- */
  function afterSourceLoaded(src, r, chans, token) {
    if (!src.url) return;
    const key = "cnt:" + src.id;
    const prev = load(key, 0);
    if (!r.fromCache) {
      save(key, chans.length);
      if (prev && prev !== chans.length && state.settings.notifyChannels) {
        const diff = chans.length - prev;
        toast(`📡 تم تحديث قنوات «${src.name}»: ${diff > 0 ? "+" + fmt(diff) + " قناة جديدة" : fmt(-diff) + " قناة أُزيلت"}`);
      }
    } else if (!r.offline && state.settings.notifyChannels) {
      setTimeout(() => checkChannelUpdate(src, token), 5000);
    }
  }
  async function checkChannelUpdate(src, token, manual) {
    if (token !== state.loadToken || !src.url) return;
    try {
      const r = native ? await native.fetchText(src.url, { preferCache: false }) : { ok: true, text: await (await fetch(src.url, { cache: "no-store" })).text() };
      if (!r.ok || r.offline || token !== state.loadToken) return;
      const fresh = parseM3U(r.text);
      if (!fresh.length) return;
      save("cnt:" + src.id, fresh.length);
      const oldKeys = new Set(state.channels.map((c) => c.key));
      const newKeys = new Set(fresh.map((c) => c.key));
      const added = fresh.filter((c) => !oldKeys.has(c.key));
      const removed = state.channels.filter((c) => !newKeys.has(c.key)).length;
      if (!added.length && !removed) { if (manual) toast("القنوات محدّثة ✓"); return; }
      const sample = added.slice(0, 4).map((c) => c.name).join("، ");
      showNotice({
        kind: "channels", icon: "📡",
        title: `تحديث للقنوات — ${src.name}`,
        text: [added.length ? `${fmt(added.length)} قناة جديدة${sample ? ": " + sample + (added.length > 4 ? "…" : "") : ""}` : "", removed ? `${fmt(removed)} قناة متوقفة أُزيلت` : ""].filter(Boolean).join("\n"),
        goLabel: "تحديث القنوات",
        onGo: () => {
          if (token !== state.loadToken) { hideNotice(); return; }
          state.channels = fresh;
          state.byUrl = new Map(fresh.map((c) => [c.key, c]));
          renderGroups(); renderList(false);
          status(`${fmt(fresh.length)} قناة — محدّثة`, "ok");
          $("cache-info").textContent = "آخر تحديث: الآن";
          hideNotice(); toast("✓ تم تحديث القنوات");
        }
      });
    } catch {}
  }
  setInterval(() => { const src = findSource(state.sourceId); if (src && state.settings.notifyChannels) checkChannelUpdate(src, state.loadToken); }, 6 * 3600e3);
  $("notify-channels").addEventListener("change", (e) => { state.settings.notifyChannels = e.target.checked; saveSettings(); });

  /* ---- app (internal updater, GitHub Releases) ---- */
  let pendingUpdate = null;
  async function checkAppUpdate(manual) {
    if (!native?.checkUpdate) { if (manual) toast("التحديث الداخلي متاح في نسخة الويندوز فقط"); return; }
    if (manual) { $("check-update").disabled = true; $("check-update").textContent = "جارٍ الفحص…"; }
    const r = await native.checkUpdate().catch((e) => ({ ok: false, error: e.message }));
    if (manual) { $("check-update").disabled = false; $("check-update").textContent = "فحص التحديثات"; }
    if (!r.ok) { if (manual) toast("تعذّر فحص التحديثات — تأكد من الإنترنت", true); return; }
    if (!r.available) { if (manual) toast(`أنت على آخر إصدار (${r.current}) ✓`); return; }
    pendingUpdate = r;
    $("upd-chip").classList.remove("hidden");
    $("upd-chip").textContent = `⬆ تحديث ${r.version}`;
    if (manual || load("skipVer", "") !== r.version) presentAppUpdate();
  }
  function presentAppUpdate() {
    const r = pendingUpdate;
    if (!r) return;
    closeModals();
    const notes = (r.notes || "").replace(/[#*`>_]/g, "").trim().slice(0, 260);
    const sizeMb = r.size ? ` • ${(r.size / 1048576).toFixed(1)} MB` : "";
    showNotice({
      kind: "app", icon: "⬆",
      title: `تحديث جديد لـ IBRATV — الإصدار ${r.version}`,
      text: (notes || "تحسينات وإصلاحات جديدة.") + `\nإصدارك الحالي ${r.current}${sizeMb}`,
      goLabel: native?.ios ? "تنزيل التحديث" : "تحديث الآن",
      onGo: native?.ios ? () => { native.downloadUpdate({ url: r.assetUrl }); hideNotice(); toast("نزّل ملف IPA الجديد ووقّعه بنفس طريقتك"); } : downloadAndInstall,
      laterLabel: "لاحقاً"
    });
    $("notice-later").onclick = () => { save("skipVer", r.version); hideNotice(); };
  }
  async function downloadAndInstall() {
    const r = pendingUpdate;
    $("notice-go").disabled = true;
    $("notice-go").textContent = "جارٍ التنزيل…";
    $("notice-progress").classList.remove("hidden");
    $("notice-bar").style.width = "0%";
    try {
      await native.downloadUpdate({ url: r.assetUrl, name: r.assetName });
      showNotice({
        kind: "app", icon: "✓",
        title: "التحديث جاهز للتثبيت",
        text: `سيُغلق IBRATV ويبدأ تثبيت الإصدار ${r.version}، وبعدها افتحه من جديد.`,
        goLabel: "تثبيت وإعادة التشغيل",
        onGo: () => { $("notice-go").disabled = true; native.installUpdate().catch((e) => toast("تعذّر بدء التثبيت: " + e.message, true)); }
      });
      $("notice-later").onclick = hideNotice;
    } catch (e) {
      $("notice-go").disabled = false;
      $("notice-go").textContent = "إعادة المحاولة";
      $("notice-progress").classList.add("hidden");
      toast("فشل تنزيل التحديث: " + (e.message || e), true);
    }
  }
  if (native?.onUpdateProgress) native.onUpdateProgress(({ got, total }) => {
    const pct = total ? Math.round((got / total) * 100) : 0;
    $("notice-bar").style.width = pct + "%";
    $("notice-text").textContent = `جارٍ تنزيل التحديث… ${pct}% (${(got / 1048576).toFixed(1)} من ${(total / 1048576).toFixed(1)} MB)`;
  });
  $("upd-chip").addEventListener("click", presentAppUpdate);
  $("check-update").addEventListener("click", () => checkAppUpdate(true));
  if (native?.appVersion) native.appVersion().then((v) => { $("app-ver").textContent = `الإصدار الحالي ${v}`; $("about-ver").textContent = `IBRATV ${v}`; });
  else $("app-ver").textContent = "نسخة المتصفح";
  setTimeout(() => checkAppUpdate(false), 4000);
  setInterval(() => checkAppUpdate(false), 6 * 3600e3);
  document.querySelectorAll(".statusbar .tg").forEach((a) => a.addEventListener("click", (e) => { if (native) { e.preventDefault(); native.openExternal(a.href); } }));

  /* ================= device modes (Android phone / car / TV) ================= */
  const root = document.documentElement;
  $("dev-badge").textContent = window.IBRATV_DEVICE_LABEL || "";
  native?.appVersion?.().then((v) => { $("about-ver").textContent = `IBRATV ${v} — ${window.IBRATV_DEVICE_LABEL || ""}`; });

  // TV and car screens come in every size: scale the whole layout to the screen
  function fitScreen() {
    let z = 1;
    if (DEVICE === "tv") z = Math.max(0.5, Math.min(1.6, innerWidth / 1360));
    else if (DEVICE === "car") z = Math.max(0.62, Math.min(1.7, Math.min(innerHeight / 600, innerWidth / 980)));
    root.style.zoom = z === 1 ? "" : String(z);
  }
  if (DEVICE === "tv" || DEVICE === "car") { fitScreen(); addEventListener("resize", fitScreen); }

  // groups drawer (phone + car)
  function openDrawer() { document.querySelector(".groups").classList.add("open"); $("drawer-shade").classList.remove("hidden"); }
  function closeDrawer() { document.querySelector(".groups").classList.remove("open"); $("drawer-shade").classList.add("hidden"); }
  $("groups-toggle").addEventListener("click", () => (document.querySelector(".groups").classList.contains("open") ? closeDrawer() : openDrawer()));
  $("drawer-shade").addEventListener("click", closeDrawer);

  // phone: rotate to landscape in fullscreen
  document.addEventListener("fullscreenchange", () => {
    const on = !!document.fullscreenElement;
    native?.setFullscreen?.(on);
    root.classList.toggle("is-fs", on);
  });

  /* ---- spatial (D-pad) navigation for TV remotes & car steering keys ---- */
  const FOCUSABLE = "button:not([disabled]), select, input, [tabindex]";
  function visible(el) {
    if (el.closest(".hidden")) return false;
    const r = el.getBoundingClientRect();
    return r.width > 0 && r.height > 0;
  }
  function scope() {
    const m = document.querySelector(".modal:not(.hidden)");
    if (m) return m;
    if (document.querySelector(".groups.open")) return document.querySelector(".groups");
    if (!$("notice").classList.contains("hidden") && document.activeElement?.closest("#notice")) return $("notice");
    return document;
  }
  function moveFocus(dir) {
    const sc = scope();
    const cur = document.activeElement && document.activeElement !== document.body && sc.contains(document.activeElement) ? document.activeElement : null;
    const items = [...sc.querySelectorAll(FOCUSABLE)].filter((el) => el !== cur && !el.disabled && el.tabIndex !== -2 && visible(el) && !el.matches("input[type=file], input[type=checkbox]"));
    if (!cur) { (sc.querySelector(".ch.playing") || sc.querySelector(".ch") || items[0])?.focus(); return; }
    const a = cur.getBoundingClientRect();
    const ax = a.left + a.width / 2, ay = a.top + a.height / 2;
    let best = null, bestScore = Infinity;
    for (const el of items) {
      const b = el.getBoundingClientRect();
      const bx = b.left + b.width / 2, by = b.top + b.height / 2;
      let main, cross;
      if (dir === "down") { if (b.top < a.bottom - 2 && by <= ay + 2) continue; main = by - ay; cross = Math.abs(bx - ax); }
      else if (dir === "up") { if (b.bottom > a.top + 2 && by >= ay - 2) continue; main = ay - by; cross = Math.abs(bx - ax); }
      else if (dir === "right") { if (b.left < a.right - 2 && bx <= ax + 2) continue; main = bx - ax; cross = Math.abs(by - ay); }
      else { if (b.right > a.left + 2 && bx >= ax - 2) continue; main = ax - bx; cross = Math.abs(by - ay); }
      if (main <= 0) continue;
      const score = main + cross * 3;
      if (score < bestScore) { bestScore = score; best = el; }
    }
    if (best) {
      best.focus({ preventScroll: false });
      best.scrollIntoView({ block: "nearest", inline: "nearest" });
      if (best.classList.contains("ch")) {
        const i = +best.dataset.i;
        if (i > state.rendered - 15) renderMore();
        state.sel = i;
      }
    }
  }
  if (SPATIAL) {
    root.classList.add("spatial");
    $("screen").tabIndex = -1;
    document.addEventListener("keydown", (e) => {
      const map = { ArrowDown: "down", ArrowUp: "up", ArrowLeft: "left", ArrowRight: "right" };
      const el = document.activeElement;
      if (document.fullscreenElement) {
        if (e.key === "ArrowUp" || e.key === "ChannelUp") { e.preventDefault(); e.stopImmediatePropagation(); step(-1); return; }
        if (e.key === "ArrowDown" || e.key === "ChannelDown") { e.preventDefault(); e.stopImmediatePropagation(); step(1); return; }
        if (e.key === "Enter") { e.preventDefault(); e.stopImmediatePropagation(); if (state.current) showOSD(state.current); return; }
        return;
      }
      if (map[e.key]) {
        const typing = el && el.tagName === "INPUT" && !["range", "checkbox"].includes(el.type);
        if (typing && (e.key === "ArrowLeft" || e.key === "ArrowRight")) return;     // move the text caret
        if (el && el.type === "range" && (e.key === "ArrowLeft" || e.key === "ArrowRight")) return;
        if (el && el.tagName === "SELECT" && (e.key === "ArrowUp" || e.key === "ArrowDown")) return;
        e.preventDefault(); e.stopImmediatePropagation();
        moveFocus(map[e.key]);
        return;
      }
      if (e.key === "Enter" && el) {
        if (el.classList.contains("ch")) { e.preventDefault(); e.stopImmediatePropagation(); el.click(); return; }
        if (el.id === "screen") { e.preventDefault(); e.stopImmediatePropagation(); toggleFullscreen(); return; }
      }
    }, true);
    // keep a focus on screen at all times
    setTimeout(() => { if (!document.activeElement || document.activeElement === document.body) moveFocus("down"); }, 1500);
  }

  /* ---- Android back button ---- */
  let lastBack = 0;
  function handleBack() {
    if (document.fullscreenElement) { document.exitFullscreen?.(); return; }
    if (document.querySelector(".modal:not(.hidden)")) { closeModals(); return; }
    if (document.querySelector(".groups.open")) { closeDrawer(); return; }
    if (!$("notice").classList.contains("hidden")) { hideNotice(); return; }
    if (document.activeElement?.id === "search") { document.activeElement.blur(); return; }
    if (Date.now() - lastBack < 2200) { native?.exitApp?.(); return; }
    lastBack = Date.now();
    toast("اضغط رجوع مرة ثانية للخروج");
  }
  const capApp = window.Capacitor?.Plugins?.App;
  if (capApp?.addListener) capApp.addListener("backButton", handleBack);

  /* ================= start ================= */
  save("v21", true); save("pins", state.pins);
  if (native) document.body.classList.add("desktop");
  if (native?.acrylic) document.body.classList.add("acrylic");
  applySettings();
  renderQuickSources();
  if (!findSource(state.sourceId)) state.sourceId = "all";
  openSource(state.sourceId).then(() => {
    const last = load("last", null);
    if (state.settings.resumeLast && last) {
      const ch = state.byUrl.get(last.key) || last;
      const i = state.list.findIndex((c) => c.key === ch.key);
      if (i >= 0) select(i);
      updateNowPlaying(ch);
      state.current = ch; refreshPlayingRows();
      play(ch, { osd: true });
    }
  });
})();
