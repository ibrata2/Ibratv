/* =========================================================================
   IBRA STORE — سلايد شو آخر البرامج والألعاب
   كود مستقل بدون مكتبات. يشتغل بنسخة الويندوز فقط.
   - الخط واللون والخلفية يورثها من التطبيق تلقائياً.
   - اللون الأساسي: متغيّر CSS ‎--ibra-accent‎، وإذا ماكو يستخدم ACCENT.
   - إذا فشل الجلب يختفي بهدوء ويبقى الشكل الأصلي.
   ========================================================================= */
(function () {
  "use strict";

  /* ---- إعدادات تگدر تغيّرها ---- */
  const ACCENT = "#ff2e4a";                          // اللون الأساسي الاحتياطي
  const SITE = "https://ibraprogram.netlify.app";
  const API = SITE + "/api/apps";
  const MAX = 10;                                     // آخر 10
  const INTERVAL = 4000;                              // تبديل كل 4 ثواني
  const MOUNT_ID = "ibra-store-slider";               // العنصر اللي ينحط بيه السلايد

  /* ---- بنسخة الويندوز فقط ---- */
  const N = window.ibratvNative;
  const isWindows = !!(N && N.isDesktop && N.platform === "win32") || /[?&]storeSlider=1\b/.test(location.search);
  if (!isWindows) return;

  const mount = document.getElementById(MOUNT_ID);
  if (!mount) return;

  /* ---- أدوات ---- */
  const abs = (u) => { try { return u ? new URL(u, SITE + "/").href : ""; } catch { return ""; } };
  const esc = (s) => String(s == null ? "" : s).replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c]));
  const openLink = (url) => {
    try { if (N && typeof N.openExternal === "function") return N.openExternal(url); } catch {}
    window.open(url, "_blank", "noopener");
  };
  function bgColor(el) {
    for (let e = el; e; e = e.parentElement) {
      const c = getComputedStyle(e).backgroundColor;
      if (c && c !== "transparent" && !/rgba\([^)]*,\s*0\)$/.test(c)) return c;
    }
    return "#000";
  }

  /* ---- الستايل (بادئة iss- حتى ما يتعارض ويه التطبيق) ---- */
  const css = `
  .iss{position:absolute;inset:0;overflow:hidden;font:inherit;color:inherit;border-radius:inherit;background:var(--iss-base);opacity:0;transition:opacity .45s ease;direction:rtl;
       --iss-acc:var(--ibra-accent, ${ACCENT});}
  .iss.on{opacity:1}
  .iss-slide{position:absolute;inset:0;opacity:0;visibility:hidden;transition:opacity .6s ease,visibility .6s;}
  .iss-slide.cur{opacity:1;visibility:visible}
  .iss-bg{position:absolute;inset:-4%;background-size:cover;background-position:center top;transform:scale(1.04);transition:transform 6s ease;}
  .iss-slide.cur .iss-bg{transform:scale(1)}
  .iss-bg.icon{filter:blur(28px) saturate(1.3);opacity:.6}
  .iss-shade{position:absolute;inset:0;background:linear-gradient(0deg,var(--iss-base) 6%,color-mix(in srgb,var(--iss-base) 70%,transparent) 42%,color-mix(in srgb,var(--iss-base) 15%,transparent) 100%);}
  .iss-body{position:absolute;inset-inline:0;bottom:0;padding:22px 26px 46px;display:flex;gap:16px;align-items:flex-end;}
  .iss .iss-ico{width:72px;height:72px;max-width:none;flex:none;margin:0;animation:none;filter:none;border-radius:18px;object-fit:cover;background:color-mix(in srgb,var(--iss-acc) 25%,transparent);
           box-shadow:0 8px 26px color-mix(in srgb,var(--iss-acc) 45%,transparent),0 0 0 1px color-mix(in srgb,currentColor 18%,transparent);}
  .iss-txt{flex:1;min-width:0;display:flex;flex-direction:column;gap:4px;}
  .iss-cat{align-self:flex-start;font-size:12px;font-weight:700;padding:2px 12px;border-radius:30px;background:var(--iss-acc);color:#fff;}
  .iss-name{font-size:26px;font-weight:800;line-height:1.25;margin:0;overflow:hidden;text-overflow:ellipsis;white-space:nowrap;}
  .iss-tag{font-size:14px;opacity:.85;margin:0;display:-webkit-box;-webkit-line-clamp:2;-webkit-box-orient:vertical;overflow:hidden;}
  .iss-go{flex:none;align-self:center;font:inherit;font-weight:700;font-size:14px;color:#fff;background:var(--iss-acc);border:0;border-radius:12px;padding:10px 18px;cursor:pointer;
          box-shadow:0 6px 20px color-mix(in srgb,var(--iss-acc) 50%,transparent);transition:transform .15s,filter .15s;}
  .iss-go:hover{transform:translateY(-1px);filter:brightness(1.1)}
  .iss-head{position:absolute;top:14px;inset-inline-start:16px;font-size:12px;font-weight:700;padding:4px 12px;border-radius:30px;
            background:color-mix(in srgb,var(--iss-base) 60%,transparent);backdrop-filter:blur(8px);}
  .iss-head b{color:var(--iss-acc)}
  .iss-arr{position:absolute;top:50%;transform:translateY(-50%);width:40px;height:40px;border-radius:50%;border:0;cursor:pointer;color:inherit;font:inherit;font-size:22px;line-height:1;
           background:color-mix(in srgb,var(--iss-base) 55%,transparent);backdrop-filter:blur(8px);opacity:.75;transition:opacity .2s,background .2s;}
  .iss-arr:hover{opacity:1;background:var(--iss-acc);color:#fff}
  .iss-prev{inset-inline-start:12px}.iss-next{inset-inline-end:12px}
  .iss-dots{position:absolute;bottom:16px;inset-inline:0;display:flex;justify-content:center;gap:7px;}
  .iss-dot{width:8px;height:8px;border-radius:8px;border:0;padding:0;cursor:pointer;background:currentColor;opacity:.35;transition:width .3s,opacity .3s,background .3s;}
  .iss-dot.cur{width:24px;opacity:1;background:var(--iss-acc)}
  .iss :focus-visible{outline:2px solid var(--iss-acc);outline-offset:2px}
  @media (prefers-reduced-motion:reduce){.iss,.iss-slide,.iss-bg,.iss-dot{transition:none}}
  `;

  /* ---- الجلب ---- */
  const ctl = typeof AbortController === "function" ? new AbortController() : null;
  const timer = setTimeout(() => ctl && ctl.abort(), 12000);
  fetch(API, { signal: ctl ? ctl.signal : undefined, cache: "no-store" })
    .then((r) => { if (!r.ok) throw new Error(r.status); return r.json(); })
    .then((data) => {
      clearTimeout(timer);
      const list = (Array.isArray(data) ? data : (data && (data.apps || data.items)) || [])
        .filter((a) => a && a.slug && a.name)
        .sort((a, b) => String(b.createdAt || b.updatedAt || "").localeCompare(String(a.createdAt || a.updatedAt || "")))
        .slice(0, MAX);
      if (list.length) build(list);
    })
    .catch(() => { clearTimeout(timer); /* يختفي بهدوء */ });

  /* ---- البناء ---- */
  function build(items) {
    if (!document.getElementById("iss-style")) {
      const st = document.createElement("style"); st.id = "iss-style"; st.textContent = css; document.head.appendChild(st);
    }
    const root = document.createElement("div");
    root.className = "iss";
    root.setAttribute("role", "region");
    root.setAttribute("aria-label", "آخر البرامج والألعاب من IBRA STORE");
    root.style.setProperty("--iss-base", bgColor(mount));

    const slides = items.map((a, i) => {
      const cat = (Array.isArray(a.categories) && a.categories[0]) || a.category || "";
      const shot = Array.isArray(a.screenshots) && a.screenshots[0];
      const bg = abs(shot || a.icon);
      const icon = abs(a.icon);
      const url = SITE + "/app/" + encodeURIComponent(a.slug);
      return `<div class="iss-slide${i === 0 ? " cur" : ""}" aria-hidden="${i !== 0}">
        <div class="iss-bg${shot ? "" : " icon"}" style="${bg ? `background-image:url('${esc(bg)}')` : ""}"></div>
        <div class="iss-shade"></div>
        <div class="iss-body">
          ${icon ? `<img class="iss-ico" src="${esc(icon)}" alt="" loading="lazy">` : ""}
          <div class="iss-txt">
            ${cat ? `<span class="iss-cat">${esc(cat)}</span>` : ""}
            <h3 class="iss-name">${esc(a.name)}</h3>
            ${a.tagline ? `<p class="iss-tag">${esc(a.tagline)}</p>` : ""}
          </div>
          <button class="iss-go" type="button" data-url="${esc(url)}">عرض البرنامج ←</button>
        </div>
      </div>`;
    }).join("");

    const many = items.length > 1;
    root.innerHTML = `${slides}
      <div class="iss-head">الجديد من <b>IBRA STORE</b></div>
      ${many ? `<button class="iss-arr iss-prev" type="button" aria-label="السابق">›</button>
      <button class="iss-arr iss-next" type="button" aria-label="التالي">‹</button>
      <div class="iss-dots">${items.map((_, i) => `<button class="iss-dot${i === 0 ? " cur" : ""}" type="button" aria-label="${i + 1}"></button>`).join("")}</div>` : ""}`;

    // صورة ما انفتحت؟ نخفيها بدون ما تخرب الشكل
    root.querySelectorAll(".iss-ico").forEach((img) => img.addEventListener("error", () => img.remove()));

    mount.appendChild(root);
    requestAnimationFrame(() => root.classList.add("on"));

    const sEls = [...root.querySelectorAll(".iss-slide")];
    const dEls = [...root.querySelectorAll(".iss-dot")];
    let cur = 0, hover = false, t = null;

    function go(n) {
      cur = (n + sEls.length) % sEls.length;
      sEls.forEach((s, i) => { s.classList.toggle("cur", i === cur); s.setAttribute("aria-hidden", String(i !== cur)); });
      dEls.forEach((d, i) => d.classList.toggle("cur", i === cur));
    }
    const visible = () => !document.hidden && root.offsetParent !== null;
    function restart() {
      clearInterval(t);
      if (!many) return;
      t = setInterval(() => { if (!hover && visible()) go(cur + 1); }, INTERVAL);
    }

    root.addEventListener("click", (e) => {
      const go1 = e.target.closest(".iss-go");
      if (go1) { e.preventDefault(); e.stopPropagation(); return openLink(go1.dataset.url); }
      if (e.target.closest(".iss-next")) { go(cur + 1); restart(); }
      else if (e.target.closest(".iss-prev")) { go(cur - 1); restart(); }
      else { const d = e.target.closest(".iss-dot"); if (d) { go(dEls.indexOf(d)); restart(); } }
    });
    root.addEventListener("mouseenter", () => { hover = true; });
    root.addEventListener("mouseleave", () => { hover = false; });
    restart();
  }
})();
