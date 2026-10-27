(() => {
  'use strict';
  const DEFAULT_PLAYLIST = 'https://iptv-org.github.io/iptv/index.m3u';
  const $ = (id) => document.getElementById(id);
  const state = { channels: [], filtered: [], activeView: 'home', activeFilter: 'all', category: '', favorites: new Set(readJSON('ibratv:favorites', [])), recent: readJSON('ibratv:recent', []), current: null, hls: null, visibleLimit: 80, loading: false, playlistUrl: localStorage.getItem('ibratv:playlistUrl') || DEFAULT_PLAYLIST };
  const categories = [
    {label:'عربية', match:/arab|ar-|arabic|العراق|العربية|عربي/i}, {label:'رياضة', match:/sport|bein|espn|football|sports|رياضة/i},
    {label:'أخبار', match:/news|خبر|اخبار|أخبار/i}, {label:'أفلام', match:/movie|cinema|film|أفلام|افلام/i},
    {label:'مسلسلات', match:/series|drama|مسلسل|مسلسلات/i}, {label:'أطفال', match:/kids|children|cartoon|طفل|أطفال/i},
    {label:'موسيقى', match:/music|موسيقى/i}, {label:'وثائقي', match:/documentary|وثائقي/i}
  ];
  function readJSON(key, fallback) { try { const v = JSON.parse(localStorage.getItem(key)); return v ?? fallback; } catch { return fallback; } }
  function persist() { localStorage.setItem('ibratv:favorites', JSON.stringify([...state.favorites])); localStorage.setItem('ibratv:recent', JSON.stringify(state.recent.slice(0,50))); }
  function esc(value) { return String(value ?? '').replace(/[&<>"']/g, c => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c])); }
  function stableId(ch) { return ch.id || `${ch.name.toLowerCase()}|${ch.url}`; }
  function channelCategory(ch) { const group = ch.group || ''; const text = `${group} ${ch.name}`; const found = categories.find(c => c.match.test(text)); return found ? found.label : (group || 'غير مصنّف'); }
  function parseM3U(text) {
    const lines = text.replace(/^\uFEFF/, '').split(/\r?\n/); const result = []; let pending = null;
    for (const raw of lines) {
      const line = raw.trim(); if (!line) continue;
      if (line.startsWith('#EXTINF')) {
        const comma = line.lastIndexOf(','); const meta = comma >= 0 ? line.slice(0, comma) : line; const trailingName = comma >= 0 ? line.slice(comma + 1).trim() : '';
        const attr = (key) => { const re = new RegExp('(?:^|\\s)' + key.replace(/[.*+?^${}()|[\]\\]/g, '\\$&') + '="([^"]*)"', 'i'); return (meta.match(re) || [])[1] || ''; };
        pending = { name: attr('tvg-name') || trailingName || 'قناة بدون اسم', logo: attr('tvg-logo'), id: attr('tvg-id'), group: attr('group-title') || '', language: attr('tvg-language'), country: attr('tvg-country'), url: '' };
      } else if (line.startsWith('#EXTVLCOPT') || line.startsWith('#EXTGRP') || line.startsWith('#KODIPROP')) {
        if (pending && line.startsWith('#EXTGRP')) pending.group = line.slice(8).trim() || pending.group;
      } else if (!line.startsWith('#')) {
        if (pending) { pending.url = line; pending.name = pending.name || line; result.push(pending); pending = null; }
        else if (/^https?:\/\//i.test(line)) result.push({ name: line, logo: '', id: '', group: '', language: '', country: '', url: line });
      }
    }
    const seen = new Set();
    return result.filter(ch => { if (!ch.url || !/^https?:\/\//i.test(ch.url)) return false; const key = `${ch.name.toLowerCase()}|${ch.url}`; if (seen.has(key)) return false; seen.add(key); ch.key = stableId(ch); ch.category = channelCategory(ch); return true; });
  }
  function toast(message, type='') { const el = document.createElement('div'); el.className = `toast ${type}`; el.textContent = message; $('toast-region').appendChild(el); setTimeout(() => el.remove(), 4300); }
  function setLoading(on, message='الاتصال بمصدر القائمة...') { state.loading = on; $('loading-modal').classList.toggle('hidden', !on); $('loading-message').textContent = message; ['hero-load','empty-load','list-load','save-load-url','refresh-btn'].forEach(id => { const el=$(id); if(el) el.disabled=on; }); }
  async function loadPlaylist(url = state.playlistUrl) {
    if (state.loading) return; const clean = (url || '').trim(); if (!/^https?:\/\//i.test(clean)) { toast('أدخل رابطاً صحيحاً يبدأ بـ http:// أو https://', 'error'); return; }
    setLoading(true); $('loading-message').textContent = 'جارٍ تنزيل ملف القنوات...';
    try {
      const response = await fetch(clean, {cache:'no-store', redirect:'follow'});
      if (!response.ok) throw new Error(`تعذّر تحميل القائمة (HTTP ${response.status})`);
      const text = await response.text(); if (!text.trim().startsWith('#EXTM3U') && !text.includes('#EXTINF')) throw new Error('الملف المستلم لا يبدو كقائمة M3U صحيحة.');
      $('loading-message').textContent = 'جارٍ تحليل القنوات...';
      const channels = parseM3U(text); if (!channels.length) throw new Error('لم يتم العثور على قنوات صالحة في القائمة.');
      state.channels = channels; state.playlistUrl = clean; localStorage.setItem('ibratv:playlistUrl', clean); $('playlist-url').value = clean;
      $('connection-label').textContent = `تم تحميل ${channels.length.toLocaleString('ar-IQ')} قناة`; $('stat-status').textContent = 'متصلة'; $('stat-status').style.color = 'var(--green)';
      $('stat-total').textContent = channels.length.toLocaleString('ar-IQ'); $('nav-count').textContent = channels.length.toLocaleString('ar-IQ');
      renderCategories(); renderAll(); toast(`تم تحميل ${channels.length.toLocaleString('ar-IQ')} قناة بنجاح.`); setView('home');
    } catch (err) {
      const corsHint = err instanceof TypeError ? ' قد يكون السبب قيود CORS في المصدر أو انقطاع الاتصال. جرّب رابطاً آخر أو شغّل التطبيق عبر استضافة تسمح بالوصول للمصدر.' : '';
      toast((err.message || 'حدث خطأ أثناء تحميل القائمة.') + corsHint, 'error'); $('connection-label').textContent = 'فشل تحميل القائمة'; $('stat-status').textContent = 'تعذّر الاتصال'; $('stat-status').style.color = 'var(--red2)';
    } finally { setLoading(false); }
  }
  function logoMarkup(ch, large=false) {
    const initial = esc((ch.name || 'TV').trim().slice(0,3).toUpperCase());
    const img = ch.logo && /^https?:\/\//i.test(ch.logo) ? `<img src="${esc(ch.logo)}" loading="lazy" referrerpolicy="no-referrer" alt="" onerror="this.remove()">` : '';
    return `<div class="channel-logo${large?' large':''}">${img}${initial}</div>`;
  }
  function favoriteButton(ch) { const fav=state.favorites.has(ch.key); return `<button class="favorite-button ${fav?'is-favorite':''}" data-favorite="${esc(ch.key)}" aria-label="${fav?'إزالة من المفضلة':'إضافة للمفضلة'}" title="${fav?'إزالة من المفضلة':'إضافة للمفضلة'}">${fav?'♥':'♡'}</button>`; }
  function renderFeatured() {
    const target=$('featured-grid'); const list=state.channels.filter(ch=>state.favorites.has(ch.key)).slice(0,4); const picks=(list.length?list:state.channels.slice(0,4));
    if (!picks.length) { target.innerHTML=`<div class="empty-card glass-panel"><span class="empty-symbol">▤</span><h3>قنواتك بانتظارك</h3><p>حمّل قائمة IPTV حتى تظهر القنوات المتاحة هنا.</p><button class="primary-button" id="empty-load">تحميل القائمة الآن</button></div>`; $('empty-load').addEventListener('click',()=>loadPlaylist()); return; }
    target.innerHTML=picks.map(ch=>`<article class="featured-card glass-panel" data-play="${esc(ch.key)}"><div class="featured-top">${logoMarkup(ch)}${favoriteButton(ch)}</div><h3>${esc(ch.name)}</h3><p>${esc(ch.group || ch.category || 'قناة تلفزيونية')}</p><div class="featured-play"><span>▶</span> تشغيل القناة</div></article>`).join('');
  }
  function renderCategories() {
    const counts=new Map(); state.channels.forEach(ch=>{ const cat=ch.category || 'غير مصنّف'; counts.set(cat,(counts.get(cat)||0)+1); });
    const items=[...counts.entries()].sort((a,b)=>b[1]-a[1]).slice(0,12);
    $('sidebar-categories').innerHTML=items.length?items.map(([cat,count])=>`<button class="nav-item ${state.category===cat?'active':''}" data-category="${esc(cat)}"><span>◈</span><span style="flex:1">${esc(cat)}</span><b>${count.toLocaleString('ar-IQ')}</b></button>`).join(''):'<div class="nav-placeholder">حمّل قائمة القنوات لعرض التصنيفات</div>';
  }
  function getFiltered() {
    const query=$('channel-search').value.trim().toLocaleLowerCase(); let list=state.channels.slice();
    if (state.activeView==='favorites'||state.activeFilter==='favorites') list=list.filter(ch=>state.favorites.has(ch.key));
    if (state.activeView==='recent'||state.activeFilter==='recent') list=list.filter(ch=>state.recent.includes(ch.key)).sort((a,b)=>state.recent.indexOf(a.key)-state.recent.indexOf(b.key));
    if (state.category) list=list.filter(ch=>ch.category===state.category || ch.group===state.category);
    if (query) list=list.filter(ch=>`${ch.name} ${ch.group} ${ch.country} ${ch.language} ${ch.category}`.toLocaleLowerCase().includes(query));
    const sort=$('sort-select').value; if(sort==='name') list.sort((a,b)=>a.name.localeCompare(b.name)); if(sort==='favorites') list.sort((a,b)=>Number(state.favorites.has(b.key))-Number(state.favorites.has(a.key)));
    return list;
  }
  function renderList() {
    const list=getFiltered(); state.filtered=list; const shown=list.slice(0,state.visibleLimit);
    $('list-heading').textContent=state.category || (state.activeView==='favorites'?'القنوات المفضلة':state.activeView==='recent'?'شوهدت مؤخراً':'كل القنوات');
    if (!state.channels.length) { $('channel-list').innerHTML=`<div class="list-empty glass-panel"><div class="spinner-ring"></div><h3>قائمة القنوات غير محمّلة</h3><p>اضغط «تحميل قائمة القنوات» لقراءة ملف M3U.</p><button class="primary-button" id="list-load">تحميل قائمة القنوات</button></div>`; $('list-load').addEventListener('click',()=>loadPlaylist()); }
    else if (!shown.length) $('channel-list').innerHTML=`<div class="list-empty glass-panel"><h3>ما لقينا قنوات مطابقة</h3><p>جرّب كلمة بحث ثانية أو غيّر التصنيف.</p><button class="secondary-button" id="reset-filters">مسح عوامل التصفية</button></div>`;
    else $('channel-list').innerHTML=shown.map(ch=>`<article class="channel-row"><div class="channel-main" data-play="${esc(ch.key)}">${logoMarkup(ch)}<div class="channel-details"><strong>${esc(ch.name)}</strong><small>${esc([ch.country,ch.language,ch.group].filter(Boolean).join(' · ') || 'قناة تلفزيونية')}</small></div></div><span class="channel-badge">${esc(ch.category || 'قناة')}</span>${favoriteButton(ch)}</article>`).join('');
    $('visible-count').textContent=list.length?`عرض ${Math.min(shown.length,list.length).toLocaleString('ar-IQ')} من ${list.length.toLocaleString('ar-IQ')} قناة`:'لا توجد قنوات معروضة'; $('load-more').classList.toggle('hidden',list.length<=state.visibleLimit); updateSummaries();
  }
  function renderAll(){renderFeatured();renderList();renderCategories();updateSummaries();}
  function updateSummaries(){ $('stat-favorites').textContent=state.favorites.size.toLocaleString('ar-IQ'); $('stat-recent').textContent=state.recent.length.toLocaleString('ar-IQ'); $('favorite-summary').textContent=`${state.favorites.size.toLocaleString('ar-IQ')} قناة`; $('history-summary').textContent=`${state.recent.length.toLocaleString('ar-IQ')} قناة`; }
  function setView(view) {
    state.activeView=view; if(view!=='channels'&&view!=='favorites'&&view!=='recent') state.activeFilter='all'; state.category='';
    document.querySelectorAll('.nav-item[data-view]').forEach(el=>el.classList.toggle('active',el.dataset.view===view));
    $('settings-section').classList.toggle('hidden',view!=='settings'); $('featured-section').classList.toggle('hidden',view==='settings'); $('channels-section').classList.toggle('hidden',view==='settings');
    $('hero').classList.toggle('hidden',view!=='home'); $('stats-grid'); document.querySelector('.stats-grid').classList.toggle('hidden',view!=='home');
    const titles={home:'الرئيسية',channels:'كل القنوات',favorites:'المفضلة',recent:'شوهدت مؤخراً',settings:'الإعدادات'}; $('page-title').textContent=titles[view]||'الرئيسية'; $('channel-search').value=''; state.visibleLimit=80; renderList(); document.querySelectorAll('.nav-item[data-view]').forEach(el=>el.classList.toggle('active',el.dataset.view===view)); $('sidebar').classList.remove('open');
    if(view==='channels'||view==='favorites'||view==='recent') $('channels-section').scrollIntoView({behavior:'smooth',block:'start'}); else window.scrollTo({top:0,behavior:'smooth'});
  }
  function toggleFavorite(key) { const ch=state.channels.find(c=>c.key===key); if(!ch)return; if(state.favorites.has(key)){state.favorites.delete(key);toast('تمت إزالة القناة من المفضلة.');}else{state.favorites.add(key);toast('تمت إضافة القناة للمفضلة.');}persist();renderAll(); }
  function openPlayer(key) {
    const ch=state.channels.find(c=>c.key===key); if(!ch)return; state.current=ch; state.recent=[key,...state.recent.filter(x=>x!==key)].slice(0,50); persist();
    $('player-title').textContent=ch.name; $('player-subtitle').textContent=ch.group || ch.category || 'بث مباشر'; $('player-logo').innerHTML=''; $('player-logo').className='channel-logo large'; $('player-logo').textContent=(ch.name||'TV').slice(0,3).toUpperCase(); if(ch.logo){const img=new Image();img.src=ch.logo;img.alt='';img.onload=()=>{$('player-logo').innerHTML='';$('player-logo').appendChild(img)};}
    $('player-favorite').textContent=state.favorites.has(key)?'♥ ضمن المفضلة':'♡ إضافة للمفضلة'; $('player-modal').classList.remove('hidden'); $('player-status').textContent='جارٍ الاتصال بالبث...'; $('player-overlay').classList.remove('hidden'); $('player-message').textContent='جارٍ الاتصال بالبث...'; $('retry-stream').classList.add('hidden'); renderList(); updateSummaries(); startStream(ch);
  }
  function stopStream(){const video=$('video-player'); if(state.hls){state.hls.destroy();state.hls=null;} video.pause(); video.removeAttribute('src'); video.load();}
  function startStream(ch){stopStream();const video=$('video-player');$('player-overlay').classList.remove('hidden');$('player-message').textContent='جارٍ الاتصال بالبث...';$('retry-stream').classList.add('hidden');$('player-status').textContent='جارٍ الاتصال بالبث...';const url=ch.url;const isHls=/\.m3u8(?:$|\?)/i.test(url);
    const fail=(message)=>{$('player-message').textContent=message;$('retry-stream').classList.remove('hidden');$('player-status').textContent='تعذّر تشغيل البث';};
    video.onplaying=()=>{$('player-overlay').classList.add('hidden');$('player-status').textContent='يعمل الآن';}; video.onerror=()=>fail('تعذّر تشغيل هذا البث. قد يكون الرابط متوقفاً أو الصيغة غير مدعومة.');
    if(isHls && window.Hls && Hls.isSupported()){state.hls=new Hls({enableWorker:true,lowLatencyMode:true});state.hls.loadSource(url);state.hls.attachMedia(video);state.hls.on(Hls.Events.MANIFEST_PARSED,()=>video.play().catch(()=>{$('player-message').textContent='اضغط تشغيل لبدء البث.';$('retry-stream').classList.remove('hidden');}));state.hls.on(Hls.Events.ERROR,(_event,data)=>{if(data.fatal)fail('فشل تحميل البث. تحقق من الرابط أو جرّب قناة أخرى.');});}
    else if(video.canPlayType('application/vnd.apple.mpegurl') || !isHls){video.src=url;video.play().catch(()=>{$('player-message').textContent='اضغط تشغيل لبدء البث، أو جرّب قناة أخرى.';$('retry-stream').classList.remove('hidden');});}
    else fail('هذا المتصفح لا يدعم صيغة البث المطلوبة.');
  }
  function closePlayer(){stopStream();$('player-modal').classList.add('hidden');state.current=null;}
  function playRelative(delta){if(!state.current||!state.channels.length)return;let list=state.filtered.length?state.filtered:state.channels;let i=list.findIndex(c=>c.key===state.current.key);if(i<0)i=state.channels.findIndex(c=>c.key===state.current.key);const next=list[(i+delta+list.length)%list.length];if(next)openPlayer(next.key);}
  document.addEventListener('click',e=>{
    const fav=e.target.closest('[data-favorite]'); if(fav){e.stopPropagation();toggleFavorite(fav.dataset.favorite);return;}
    const play=e.target.closest('[data-play]'); if(play){openPlayer(play.dataset.play);return;}
    const view=e.target.closest('[data-view]'); if(view){setView(view.dataset.view);return;}
    const cat=e.target.closest('[data-category]'); if(cat){state.category=cat.dataset.category;state.activeView='channels';document.querySelectorAll('.nav-item[data-view]').forEach(el=>el.classList.toggle('active',el.dataset.view==='channels'));$('hero').classList.add('hidden');document.querySelector('.stats-grid').classList.add('hidden');$('featured-section').classList.add('hidden');$('settings-section').classList.add('hidden');$('channels-section').classList.remove('hidden');$('page-title').textContent=state.category;$('channel-search').value='';renderList();$('sidebar').classList.remove('open');$('channels-section').scrollIntoView({behavior:'smooth'});return;}
    const filter=e.target.closest('[data-filter]'); if(filter){state.activeFilter=filter.dataset.filter;state.category='';document.querySelectorAll('[data-filter]').forEach(el=>el.classList.toggle('active',el===filter));renderList();}
    if(e.target.id==='reset-filters'){state.category='';state.activeFilter='all';$('channel-search').value='';renderList();}
  });
  ['hero-load','empty-load','list-load'].forEach(id=>$(id)?.addEventListener('click',()=>loadPlaylist()));
  $('browse-btn').addEventListener('click',()=>setView('channels')); $('refresh-btn').addEventListener('click',()=>loadPlaylist()); $('mobile-menu').addEventListener('click',()=>$('sidebar').classList.toggle('open')); $('settings-shortcut').addEventListener('click',()=>setView('settings'));
  $('top-search-btn').addEventListener('click',()=>{setView('channels');$('channel-search').focus();}); $('channel-search').addEventListener('input',()=>{state.visibleLimit=80;renderList();}); $('sort-select').addEventListener('change',renderList); $('load-more').addEventListener('click',()=>{state.visibleLimit+=80;renderList();});
  $('save-load-url').addEventListener('click',()=>loadPlaylist($('playlist-url').value)); $('restore-default').addEventListener('click',()=>{$('playlist-url').value=DEFAULT_PLAYLIST;loadPlaylist(DEFAULT_PLAYLIST);});
  $('close-player').addEventListener('click',closePlayer); $('player-modal').addEventListener('click',e=>{if(e.target===$('player-modal'))closePlayer();}); $('retry-stream').addEventListener('click',()=>state.current&&startStream(state.current)); $('player-favorite').addEventListener('click',()=>state.current&&toggleFavorite(state.current.key)); $('prev-channel').addEventListener('click',()=>playRelative(-1)); $('next-channel').addEventListener('click',()=>playRelative(1)); $('player-fullscreen').addEventListener('click',()=>{const wrap=$('video-wrap');if(document.fullscreenElement)document.exitFullscreen?.();else wrap.requestFullscreen?.();});
  $('clear-history').addEventListener('click',()=>{state.recent=[];persist();renderAll();toast('تم مسح سجل المشاهدة.');}); $('clear-favorites').addEventListener('click',()=>{state.favorites.clear();persist();renderAll();toast('تم مسح المفضلة.');});
  document.querySelectorAll('[data-theme]').forEach(btn=>btn.addEventListener('click',()=>{document.querySelectorAll('[data-theme]').forEach(b=>b.classList.toggle('selected',b===btn));document.body.classList.remove('light-theme','dark-theme');if(btn.dataset.theme==='light')document.body.classList.add('light-theme');if(btn.dataset.theme==='dark')document.body.classList.add('dark-theme');localStorage.setItem('ibratv:theme',btn.dataset.theme);}));
  $('remember-last').checked=localStorage.getItem('ibratv:rememberLast')!=='false';$('remember-last').addEventListener('change',e=>localStorage.setItem('ibratv:rememberLast',String(e.target.checked)));
  document.addEventListener('keydown',e=>{if((e.metaKey||e.ctrlKey)&&e.key.toLowerCase()==='k'){e.preventDefault();setView('channels');$('channel-search').focus();}if(e.key==='Escape'){if(!$('player-modal').classList.contains('hidden'))closePlayer();$('sidebar').classList.remove('open');}});
  $('playlist-url').value=state.playlistUrl;const savedTheme=localStorage.getItem('ibratv:theme');if(savedTheme){const btn=document.querySelector(`[data-theme="${savedTheme}"]`);if(btn)btn.click();}
  renderAll();
  // Load automatically on first visit; if remote access is blocked, the settings page allows another URL.
  if(localStorage.getItem('ibratv:autoLoad')!=='false') { localStorage.setItem('ibratv:autoLoad','false'); setTimeout(()=>loadPlaylist(state.playlistUrl),350); }
})();
