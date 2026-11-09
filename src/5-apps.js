  <!-- ================= IN-GAME APPS =================
       Tapping an app on the home screen opens a full-screen page styled like that platform.
  -->
  <script>
    let currentApp = null;
    let currentSub = null;
    const SPOTIFY_SHARE = 0.7; // share of streams shown on Spotify; the rest on Apple Music

    const APPS = [
      { id: 'spotify', name: 'Spotify', icon: 'fa-brands fa-spotify text-[#1DB954]', bg: 'bg-[#191414]' },
      { id: 'apple', name: 'Music', icon: 'fa-solid fa-music text-white', bg: 'bg-gradient-to-b from-[#fb5c74] to-[#fa233b]' },
      { id: 'youtube', name: 'YouTube', icon: 'fa-brands fa-youtube text-[#FF0000]', bg: 'bg-white' },
      { id: 'instagram', name: 'Instagram', icon: 'fa-brands fa-instagram text-white', bg: 'bg-gradient-to-tr from-[#feda75] via-[#d62976] to-[#4f5bd5]' },
      { id: 'tiktok', name: 'TikTok', icon: 'fa-brands fa-tiktok text-white tt-shadow', bg: 'bg-black border border-gray-700' },
      { id: 'tinder', name: 'Tinder', icon: 'fa-solid fa-fire text-white', bg: 'bg-gradient-to-tr from-[#FD267A] to-[#FF6036]' },
      { id: 'whatsapp', name: 'WhatsApp', icon: 'fa-brands fa-whatsapp text-white', bg: 'bg-[#25D366]' },
      { id: 'chart', name: 'מצעד', icon: 'fa-solid fa-ranking-star text-black', bg: 'bg-goldAccent' },
    ];

    function renderAppGrid() {
      const badge = id => {
        if (id === 'whatsapp') { const n = unreadCount(); return n ? `<span class="app-badge">${n}</span>` : ''; }
        if (id === 'tinder' && state.relationship && state.relationship.loyalty < 25) return '<span class="app-badge">!</span>';
        return '';
      };
      $('app-grid').innerHTML = APPS.map(a => `<button onclick="openApp('${a.id === 'chart' ? 'spotify' : a.id}'${a.id === 'chart' ? ", 'chart'" : ''})" class="flex flex-col items-center gap-1 active:scale-95 transition">
        <div class="app-icon ${a.bg}"><i class="${a.icon}"></i>${badge(a.id)}</div>
        <span class="text-[10px] text-gray-300">${a.name}</span>
      </button>`).join('');
    }

    function openApp(id, sub) {
      currentApp = id;
      currentSub = sub || null;
      $('app-overlay').classList.remove('hidden');
      $('app-body').scrollTop = 0;
      renderApp();
      $('app-body').firstElementChild && $('app-body').firstElementChild.classList.add('anim-app');
    }
    function closeApp() {
      currentApp = null;
      currentSub = null;
      $('app-overlay').classList.add('hidden');
      if (state) renderAppGrid();
    }
    function appSub(sub) {
      currentSub = sub;
      $('app-body').scrollTop = 0;
      renderApp();
    }
    function renderApp() {
      const r = { spotify: appSpotify, apple: appApple, youtube: appYouTube, instagram: appInstagram, tiktok: appTikTok, tinder: appTinder, whatsapp: appWhatsApp }[currentApp];
      if (r) $('app-body').innerHTML = r();
    }
    // Back button: in a right-to-left layout "back" points right
    function backBtn(onclick, color) {
      return `<button onclick="${onclick}" class="w-9 h-9 rounded-full flex items-center justify-center ${color || 'text-white'} hover:bg-white/10"><i class="fa-solid fa-chevron-right"></i></button>`;
    }
    function weeksAgo(w) {
      const d = state.totalWeeks - w;
      return d <= 0 ? 'השבוע' : d === 1 ? 'לפני שבוע' : `לפני ${d} שבועות`;
    }
    function songsByStreams() { return state.songs.map((s, i) => ({ s, i })).sort((a, b) => b.s.streams - a.s.streams); }

    // ---------- Spotify ----------
    function appSpotify() {
      $('app-overlay').className = 'absolute inset-0 z-40 flex flex-col bg-[#121212]';
      if (currentSub === 'chart') return spotifyChart();
      const top = songsByStreams().slice(0, 5);
      const pos = myChartPositions();
      const albums = state.albums.filter(a => a.released);
      const singles = state.songs.filter(s => !s.albumId).slice(-6).reverse();
      return `<div class="min-h-full text-white">
        <div class="relative bg-gradient-to-b from-[#1e5a3a] to-[#121212] px-4 pt-3 pb-5">
          <div class="flex items-center justify-between">${backBtn('closeApp()')}<i class="fa-brands fa-spotify text-2xl text-[#1DB954]"></i></div>
          <div class="mt-10">
            ${state.verified ? '<div class="text-xs flex items-center gap-1 mb-1"><i class="fa-solid fa-circle-check text-[#3d91f4]"></i> אמן מאומת</div>' : ''}
            <div class="text-5xl font-black leading-tight break-words">${esc(state.artistName)}</div>
            <div class="text-sm text-gray-300 mt-2">${fmt(state.listeners)} מאזינים חודשיים</div>
          </div>
          <div class="flex items-center justify-between mt-4">
            <div class="flex items-center gap-4 text-gray-300">
              <span class="border border-gray-400 rounded-full px-3 py-1 text-xs font-bold">עוקבים ${shortNum(state.followers * 0.4)}</span>
              <i class="fa-solid fa-ellipsis"></i>
            </div>
            <div class="w-14 h-14 rounded-full bg-[#1DB954] flex items-center justify-center text-black text-xl shadow-lg"><i class="fa-solid fa-play mr-[-3px]"></i></div>
          </div>
        </div>
        <div class="px-4 pb-8">
          <div class="text-lg font-bold mb-2">פופולרי</div>
          ${top.length ? top.map(({ s, i }, n) => `<div class="flex items-center gap-3 py-2">
            <span class="w-4 text-gray-400 text-sm">${n + 1}</span>
            <div class="w-11 h-11 rounded bg-gradient-to-br from-emerald-500 to-gray-900 flex items-center justify-center shrink-0"><i class="fa-solid fa-music text-white/70 text-sm"></i></div>
            <div class="flex-1 min-w-0">
              <div class="text-sm truncate ${pos[i] && pos[i] <= 50 ? 'text-[#1DB954]' : ''}">${esc(s.title)}</div>
              <div class="text-xs text-gray-400 flex items-center gap-1">${s.explicit ? '<span class="bg-gray-400 text-black text-[9px] px-1 rounded-sm font-bold">E</span>' : ''}${fmt(s.streams * SPOTIFY_SHARE)}</div>
            </div>
            <i class="fa-solid fa-ellipsis-vertical text-gray-400"></i>
          </div>`).join('') : '<div class="text-sm text-gray-400 py-3">עוד אין שירים. הקלט שיר באולפן.</div>'}

          <div class="text-lg font-bold mt-6 mb-3">דיסקוגרפיה</div>
          <div class="flex gap-3 overflow-x-auto pb-2">
            ${albums.concat(singles).length ? albums.map(a => `<div class="w-32 shrink-0">
                <div class="w-32 h-32 rounded bg-gradient-to-br from-goldAccent to-orange-900 flex items-center justify-center"><i class="fa-solid fa-compact-disc text-4xl text-black/50"></i></div>
                <div class="text-sm mt-1 truncate">${esc(a.name)}</div><div class="text-xs text-gray-400">אלבום · ${state.year}</div></div>`).join('')
              + singles.map(s => `<div class="w-32 shrink-0">
                <div class="w-32 h-32 rounded bg-gradient-to-br from-emerald-600 to-gray-900 flex items-center justify-center"><i class="fa-solid fa-music text-3xl text-white/40"></i></div>
                <div class="text-sm mt-1 truncate">${esc(s.title)}</div><div class="text-xs text-gray-400">סינגל</div></div>`).join('')
              : '<div class="text-sm text-gray-400">עוד אין שחרורים</div>'}
          </div>

          <div class="text-lg font-bold mt-6 mb-3">מאזינים חודשיים</div>
          <div class="h-28">${lineChart(state.history.map(x => x.l), '#1DB954')}</div>

          <div class="text-lg font-bold mt-6 mb-3">פלייליסטים</div>
          <button onclick="appSub('chart')" class="flex items-center gap-3 w-full text-right">
            <div class="w-16 h-16 rounded bg-gradient-to-br from-[#1DB954] to-[#0b3d20] flex flex-col items-center justify-center text-[10px] font-black leading-none"><span class="text-lg">50</span>TOP</div>
            <div><div class="text-sm font-bold">Top 50 - ישראל</div><div class="text-xs text-gray-400">השירים הכי מושמעים השבוע${bestMyPos() && bestMyPos() <= 50 ? ` · אתה במקום #${bestMyPos()}` : ''}</div></div>
          </button>
        </div>
      </div>`;
    }
    function spotifyChart() {
      const rows = combinedChart().slice(0, 50);
      return `<div class="min-h-full text-white">
        <div class="bg-gradient-to-b from-[#1DB954]/70 to-[#121212] px-4 pt-3 pb-5">
          <div class="flex items-center justify-between">${backBtn("appSub(null)")}<i class="fa-brands fa-spotify text-2xl text-white"></i></div>
          <div class="w-40 h-40 mx-auto mt-4 rounded shadow-2xl bg-gradient-to-br from-[#1DB954] to-[#0b3d20] flex flex-col items-center justify-center font-black leading-none"><span class="text-6xl">50</span><span class="text-sm tracking-widest">TOP · ISRAEL</span></div>
          <div class="text-2xl font-black mt-4">Top 50 - ישראל</div>
          <div class="text-xs text-gray-300 mt-1">מתעדכן כל שבוע · השמעות בשבוע האחרון</div>
        </div>
        <div class="px-2 pb-8">${rows.map(chartRow).join('')}</div>
      </div>`;
    }

    // ---------- Apple Music ----------
    function appApple() {
      $('app-overlay').className = 'absolute inset-0 z-40 flex flex-col bg-black';
      const top = songsByStreams().slice(0, 6);
      const albums = state.albums.filter(a => a.released);
      return `<div class="min-h-full text-white">
        <div class="px-4 pt-3 flex items-center justify-between">${backBtn('closeApp()', 'text-[#fa2d48]')}<span class="text-sm font-semibold flex items-center gap-1"><i class="fa-brands fa-apple"></i>Music</span></div>
        <div class="flex flex-col items-center mt-4 px-4">
          <div class="w-40 h-40 rounded-full bg-gradient-to-br from-[#fb5c74] to-[#5b0f1c] flex items-center justify-center text-6xl text-white/80 shadow-2xl"><i class="fa-solid fa-microphone-lines"></i></div>
          <div class="text-3xl font-bold mt-4">${esc(state.artistName)}</div>
          <div class="text-sm text-gray-400 mt-1">${fmt(state.listeners * 0.35)} מאזינים · ${esc(GENRES[state.trend.hot])}</div>
          <div class="flex gap-3 mt-4 w-full">
            <div class="flex-1 bg-[#1c1c1e] rounded-xl py-2.5 text-center text-[#fa2d48] font-semibold text-sm"><i class="fa-solid fa-play ml-1"></i> נגן</div>
            <div class="flex-1 bg-[#1c1c1e] rounded-xl py-2.5 text-center text-[#fa2d48] font-semibold text-sm"><i class="fa-solid fa-shuffle ml-1"></i> ערבב</div>
          </div>
        </div>
        <div class="px-4 mt-6 pb-8">
          <div class="text-xl font-bold mb-2 flex items-center justify-between">שירים מובילים <i class="fa-solid fa-chevron-left text-gray-500 text-sm"></i></div>
          ${top.length ? top.map(({ s }) => `<div class="flex items-center gap-3 py-2 border-b border-[#2c2c2e]">
            <div class="w-12 h-12 rounded-md bg-gradient-to-br from-[#fb5c74] to-[#3a0a12] flex items-center justify-center shrink-0"><i class="fa-solid fa-music text-white/60"></i></div>
            <div class="flex-1 min-w-0"><div class="text-sm truncate">${esc(s.title)} ${s.explicit ? '<span class="bg-gray-500 text-black text-[9px] px-1 rounded-sm font-bold">E</span>' : ''}</div>
              <div class="text-xs text-gray-400">${esc(s.genre)} · ${fmt(s.streams * (1 - SPOTIFY_SHARE))} השמעות</div></div>
            <i class="fa-solid fa-ellipsis text-[#fa2d48]"></i>
          </div>`).join('') : '<div class="text-sm text-gray-500 py-3">אין עדיין שירים</div>'}
          <div class="text-xl font-bold mt-6 mb-3">אלבומים</div>
          <div class="grid grid-cols-2 gap-3">
            ${albums.length ? albums.map(a => `<div><div class="aspect-square rounded-lg bg-gradient-to-br from-[#fa2d48] to-[#2a0710] flex items-center justify-center"><i class="fa-solid fa-compact-disc text-5xl text-white/40"></i></div>
              <div class="text-sm mt-1 truncate">${esc(a.name)}</div><div class="text-xs text-gray-400">${albumTracks(a.id).length} שירים</div></div>`).join('')
              : '<div class="text-sm text-gray-500 col-span-2">עוד לא שחררת אלבום</div>'}
          </div>
        </div>
      </div>`;
    }

    // ---------- YouTube ----------
    function appYouTube() {
      $('app-overlay').className = 'absolute inset-0 z-40 flex flex-col bg-[#0f0f0f]';
      const vids = state.songs.map((s, i) => ({ s, i })).filter(x => x.s.ytViews > 0).reverse();
      const thumb = ['from-red-700 to-gray-900', 'from-purple-700 to-gray-900', 'from-blue-700 to-gray-900', 'from-amber-600 to-gray-900', 'from-emerald-700 to-gray-900'];
      return `<div class="min-h-full text-white">
        <div class="px-3 pt-3 flex items-center justify-between">
          <div class="flex items-center gap-1">${backBtn('closeApp()')}<span class="flex items-center gap-1 font-bold tracking-tight" dir="ltr"><i class="fa-brands fa-youtube text-[#FF0000] text-2xl"></i>YouTube</span></div>
          <div class="flex gap-4 text-gray-200"><i class="fa-solid fa-magnifying-glass"></i><i class="fa-regular fa-bell"></i></div>
        </div>
        <div class="h-24 mx-3 mt-3 rounded-xl bg-gradient-to-l from-red-900 via-gray-900 to-black flex items-center justify-center text-2xl font-black tracking-widest text-white/20">${esc(state.artistName)}</div>
        <div class="px-4 mt-3 flex items-center gap-3">
          <div class="w-16 h-16 rounded-full bg-gray-700 flex items-center justify-center text-2xl text-white/80 shrink-0"><i class="fa-solid fa-microphone-lines"></i></div>
          <div class="min-w-0">
            <div class="text-xl font-bold flex items-center gap-1">${esc(state.artistName)} ${state.verified ? '<i class="fa-solid fa-circle-check text-gray-400 text-sm"></i>' : ''}</div>
            <div class="text-xs text-gray-400"><span dir="ltr">@${esc(state.handle)}</span> · ${shortNum(state.ytSubs)} מנויים · ${vids.length} סרטונים</div>
          </div>
        </div>
        <div class="px-4 mt-3"><div class="bg-white text-black text-center rounded-full py-2 text-sm font-semibold">התאם אישית את הערוץ</div></div>
        <div class="flex gap-6 px-4 mt-4 border-b border-gray-800 text-sm"><span class="pb-2 border-b-2 border-white font-semibold">סרטונים</span><span class="pb-2 text-gray-400">פלייליסטים</span><span class="pb-2 text-gray-400">קהילה</span></div>
        <div class="px-4 py-3 space-y-4 pb-8">
          ${vids.length ? vids.map(({ s }, n) => `<div class="flex gap-3">
            <div class="w-40 aspect-video rounded-lg bg-gradient-to-br ${thumb[n % thumb.length]} relative shrink-0 flex items-center justify-center">
              <i class="fa-solid fa-play text-white/40 text-xl"></i>
              <span class="absolute bottom-1 left-1 bg-black/80 text-[10px] px-1 rounded" dir="ltr">${rnd(2, 3)}:${String(rnd(0, 59)).padStart(2, '0')}</span>
            </div>
            <div class="min-w-0">
              <div class="text-sm leading-snug line-clamp-2">${esc(state.artistName)} - ${esc(s.title)}${s.feat ? ` (פיט׳ ${esc(s.feat)})` : ''} | ${s.clip === 'pro' ? 'קליפ רשמי' : 'קליפ מילים'}</div>
              <div class="text-xs text-gray-400 mt-1">${shortNum(s.ytViews)} צפיות · ${weeksAgo(s.releaseTotalWeek)}</div>
            </div>
          </div>`).join('') : '<div class="text-sm text-gray-400 text-center py-8">עוד אין סרטונים בערוץ.<br>בחר קליפ כשאתה מקליט שיר.</div>'}
        </div>
      </div>`;
    }

    // ---------- Instagram ----------
    const POST_STYLE = {
      song: ['from-emerald-600 to-gray-900', 'fa-music'], gig: ['from-orange-600 to-purple-900', 'fa-microphone'],
      beef: ['from-red-700 to-black', 'fa-fire'], item: ['from-yellow-500 to-amber-900', 'fa-gem'], rel: ['from-pink-500 to-rose-900', 'fa-heart'],
    };
    function appInstagram() {
      $('app-overlay').className = 'absolute inset-0 z-40 flex flex-col bg-black';
      const following = 180 + Math.floor(state.totalWeeks * 3);
      return `<div class="min-h-full text-white">
        <div class="px-3 pt-3 flex items-center justify-between">
          <div class="flex items-center gap-1">${backBtn('closeApp()')}<span class="font-bold text-lg flex items-center gap-1" dir="ltr">${esc(state.handle)} ${state.verified ? '<i class="fa-solid fa-circle-check text-[#3797f0] text-sm"></i>' : ''}</span></div>
          <div class="flex gap-5 text-xl"><i class="fa-regular fa-square-plus"></i><i class="fa-solid fa-bars"></i></div>
        </div>
        <div class="px-4 mt-4 flex items-center gap-6">
          <div class="w-20 h-20 rounded-full ig-ring p-[3px] shrink-0"><div class="w-full h-full rounded-full bg-black p-[3px]"><div class="w-full h-full rounded-full bg-gray-800 flex items-center justify-center text-2xl"><i class="fa-solid fa-microphone-lines"></i></div></div></div>
          <div class="flex-1 grid grid-cols-3 text-center">
            <div><div class="font-bold">${state.posts.length}</div><div class="text-xs">פוסטים</div></div>
            <div><div class="font-bold">${shortNum(state.followers)}</div><div class="text-xs">עוקבים</div></div>
            <div><div class="font-bold">${shortNum(following)}</div><div class="text-xs">במעקב</div></div>
          </div>
        </div>
        <div class="px-4 mt-3 text-sm">
          <div class="font-semibold">${esc(state.artistName)}</div>
          <div class="text-gray-400 text-xs">אמן</div>
          <div>🎤 ראפר מ${esc(state.city)} | ${esc(stageTitle())}</div>
          ${state.songs.length ? `<div class="text-[#e0f1ff]">🎧 "${esc(state.songs[state.songs.length - 1].title)}" בחוץ עכשיו</div>` : ''}
        </div>
        <div class="px-4 mt-3 grid grid-cols-3 gap-1.5 text-xs font-semibold">
          <button onclick="postInstaStory()" class="bg-[#363636] rounded-lg py-2">סטורי (3 ⚡)</button>
          <button onclick="startBeef()" class="bg-[#363636] rounded-lg py-2 text-red-300">דיס 🔥 (5 ⚡)</button>
          <button onclick="appSub(currentSub === 'comments' ? null : 'comments')" class="bg-[#363636] rounded-lg py-2">תגובות</button>
        </div>
        ${state.beefs.length ? `<div class="px-4 mt-2 text-[10px] text-gray-500">🥊 בביף עם: ${state.beefs.map(esc).join(', ')} (לא יעשו איתך פיצ׳ר)</div>` : ''}
        <div class="flex justify-around mt-4 border-t border-gray-800 text-lg">
          <span class="py-2 flex-1 text-center ${currentSub !== 'comments' ? 'border-t border-white' : 'text-gray-500'}"><i class="fa-solid fa-table-cells"></i></span>
          <span class="py-2 flex-1 text-center ${currentSub === 'comments' ? 'border-t border-white' : 'text-gray-500'}"><i class="fa-regular fa-comment"></i></span>
        </div>
        ${currentSub === 'comments' ? `<div class="px-4 py-2 space-y-3 pb-8">${state.comments.length ? state.comments.map(c => `<div class="flex gap-2 text-sm">
            <div class="w-8 h-8 rounded-full bg-gray-700 shrink-0 flex items-center justify-center text-xs">${esc(c.u[0].toUpperCase())}</div>
            <div><span class="font-semibold" dir="ltr">${esc(c.u)}</span> <span class="text-gray-200">${esc(c.t)}</span>
              <div class="text-[11px] text-gray-500 mt-0.5">${rnd(1, 23)} שע׳ · ${rnd(1, 300)} לייקים · השב</div></div>
          </div>`).join('') : '<div class="text-gray-500 text-sm text-center py-6">אין עדיין תגובות</div>'}</div>`
        : `<div class="grid grid-cols-3 gap-0.5 pb-8">${state.posts.length ? state.posts.map(p => {
            const st = POST_STYLE[p.type] || POST_STYLE.song;
            return `<div class="aspect-square bg-gradient-to-br ${st[0]} relative flex items-center justify-center p-2">
              <i class="fa-solid ${st[1]} text-2xl text-white/40"></i>
              <div class="absolute bottom-1 right-1 text-[10px] font-bold flex items-center gap-1"><i class="fa-solid fa-heart"></i>${shortNum(p.likes)}</div>
            </div>`;
          }).join('') : '<div class="col-span-3 text-center text-gray-500 text-sm py-8">אין עדיין פוסטים.<br>פוסטים עולים אוטומטית כשאתה משחרר שיר, מופיע או קונה משהו.</div>'}</div>`}
      </div>`;
    }

    // ---------- TikTok ----------
    function appTikTok() {
      $('app-overlay').className = 'absolute inset-0 z-40 flex flex-col bg-black';
      const likes = state.tiktoks.reduce((a, v) => a + v.l, 0);
      return `<div class="min-h-full text-white">
        <div class="px-3 pt-3 flex items-center justify-between">${backBtn('closeApp()')}<span class="font-bold flex items-center gap-1">${esc(state.artistName)} <i class="fa-solid fa-chevron-down text-xs"></i></span><i class="fa-solid fa-bars text-lg"></i></div>
        <div class="flex flex-col items-center mt-4">
          <div class="w-24 h-24 rounded-full bg-gray-800 flex items-center justify-center text-4xl"><i class="fa-solid fa-microphone-lines"></i></div>
          <div class="font-semibold mt-2" dir="ltr">@${esc(state.handle)}</div>
          <div class="flex gap-8 mt-3 text-center">
            <div><div class="font-bold">${shortNum(120 + state.totalWeeks)}</div><div class="text-xs text-gray-400">נעקבים</div></div>
            <div><div class="font-bold">${shortNum(state.tiktokFollowers)}</div><div class="text-xs text-gray-400">עוקבים</div></div>
            <div><div class="font-bold">${shortNum(likes)}</div><div class="text-xs text-gray-400">לייקים</div></div>
          </div>
          <button onclick="tiktokChallenge()" class="mt-4 bg-[#FE2C55] text-white font-semibold text-sm px-10 py-2.5 rounded">אתגר חדש (4 ⚡)</button>
          <div class="text-xs text-gray-400 mt-2 px-6 text-center">🎤 ראפר | ${esc(state.city)} | השיר החדש בלינק 👇</div>
        </div>
        <div class="flex justify-around mt-4 border-b border-gray-800 text-lg"><span class="py-2 flex-1 text-center border-b-2 border-white"><i class="fa-solid fa-table-cells"></i></span><span class="py-2 flex-1 text-center text-gray-500"><i class="fa-solid fa-lock"></i></span><span class="py-2 flex-1 text-center text-gray-500"><i class="fa-regular fa-heart"></i></span></div>
        <div class="grid grid-cols-3 gap-0.5 pb-8">
          ${state.tiktoks.length ? state.tiktoks.map((v, n) => `<div class="aspect-[3/4] bg-gradient-to-b ${n % 3 === 0 ? 'from-cyan-900' : n % 3 === 1 ? 'from-pink-900' : 'from-gray-700'} to-black relative p-1.5">
            <div class="text-[10px] font-semibold leading-tight">${esc(v.t)}</div>
            <div class="absolute bottom-1 right-1.5 text-[11px] font-semibold flex items-center gap-1"><i class="fa-solid fa-play text-[9px]"></i>${shortNum(v.v)}</div>
          </div>`).join('') : '<div class="col-span-3 text-center text-gray-500 text-sm py-8">אין עדיין סרטונים.<br>לחץ על "אתגר חדש" כדי להעלות את הראשון.</div>'}
        </div>
      </div>`;
    }

    // ---------- Tinder ----------
    function appTinder() {
      $('app-overlay').className = 'absolute inset-0 z-40 flex flex-col bg-[#111418]';
      const header = `<div class="px-3 pt-3 flex items-center justify-between">${backBtn('closeApp()')}
        <span class="text-2xl font-black bg-gradient-to-r from-[#FD267A] to-[#FF6036] bg-clip-text text-transparent flex items-center gap-1"><i class="fa-solid fa-fire text-[#FD267A]"></i>tinder</span>
        <span class="text-xs text-gray-400">מאצ׳ים: <b class="text-white">${state.stats.matches}</b></span></div>`;
      if (state.relationship) {
        const r = state.relationship, tr = partnerTrait();
        return `<div class="min-h-full text-white">${header}
          <div class="px-4 mt-4 space-y-3 pb-8">
            <div class="rounded-2xl overflow-hidden bg-gray-800 h-72 relative"><div class="absolute inset-0">${profilePicture(r)}</div>
              <div class="absolute bottom-0 inset-x-0 bg-gradient-to-t from-black/90 to-transparent p-4 text-right">
                <div class="text-2xl font-bold">${esc(r.name)} <span class="font-normal">${r.age}</span></div>
                <div class="text-xs text-gray-300"><i class="fa-solid fa-location-dot ml-1"></i>${esc(r.city)} · ביחד ${r.weeks} שבועות</div>
              </div>
            </div>
            <div class="flex gap-2 text-xs"><span class="bg-[#FD267A]/20 text-[#FD267A] px-2 py-1 rounded-full font-bold">✦ ${tr.name}</span><span class="bg-gray-800 px-2 py-1 rounded-full">דרמה: ${DRAMA_LABELS[tr.drama]}</span></div>
            <div><div class="flex justify-between text-xs text-gray-400 mb-1"><span>נאמנות</span><span>${r.loyalty}%</span></div>
              <div class="w-full bg-gray-800 h-2.5 rounded-full overflow-hidden"><div class="bg-gradient-to-l from-[#FD267A] to-[#FF6036] h-full" style="width:${clamp(r.loyalty, 0, 100)}%"></div></div></div>
            <div class="text-xs text-gray-400">💡 ${tr.perk}</div>
            <div class="text-sm font-bold pt-2">לצאת לדייט</div>
            <div class="grid grid-cols-2 gap-2">${DATES.map(d => {
              const cost = tr.id === 'rich' ? Math.floor(d.cost / 2) : d.cost;
              const dis = state.dateThisWeek || state.money < cost;
              return `<button onclick="goOnDate('${d.id}')" ${dis ? 'disabled' : ''} class="${dis ? 'bg-gray-800/50 text-gray-500' : 'bg-gray-800 text-white hover:bg-gray-700'} text-xs py-2.5 rounded-xl">${d.name}<br><span class="text-gray-400">₪${fmt(cost)} · +${d.e} ⚡</span></button>`;
            }).join('')}</div>
            <div class="text-[10px] text-gray-500 text-center">${state.dateThisWeek ? 'כבר יצאתם לדייט השבוע' : 'דייט אחד בשבוע: מחזיר אנרגיה ומעלה נאמנות'}</div>
            <button onclick="breakUp()" class="w-full text-red-400 text-xs font-bold py-2">להיפרד</button>
          </div></div>`;
      }
      if (!state.tinderProfile) state.tinderProfile = genProfile();
      const p = state.tinderProfile, tr = TRAITS.find(t => t.id === p.trait);
      return `<div class="min-h-full text-white">${header}
        <div class="px-4 mt-4 pb-8">
          <div id="tinder-card" class="rounded-2xl overflow-hidden bg-gray-800 h-[420px] relative shadow-2xl">
            <div class="absolute inset-0">${profilePicture(p)}</div>
            <div class="absolute top-3 left-3 bg-black/60 px-2.5 py-1 rounded-full text-[11px] text-[#FD267A] font-bold">${tr.name}</div>
            <div class="absolute bottom-0 inset-x-0 bg-gradient-to-t from-black via-black/70 to-transparent p-4 text-right">
              <div class="text-3xl font-bold">${esc(p.name)} <span class="font-normal text-2xl">${p.age}</span></div>
              <div class="text-xs text-gray-300 mt-1"><i class="fa-solid fa-location-dot ml-1"></i>${esc(p.city)}</div>
              <div class="text-sm mt-2">${esc(p.bio)}</div>
            </div>
          </div>
          <div class="flex justify-center gap-8 mt-5">
            <button onclick="swipeTinder(false)" class="w-16 h-16 rounded-full border-2 border-[#ff4458] text-[#ff4458] text-2xl flex items-center justify-center active:scale-90 transition"><i class="fa-solid fa-xmark"></i></button>
            <button onclick="swipeTinder(true)" class="w-16 h-16 rounded-full border-2 border-[#1be4a1] text-[#1be4a1] text-2xl flex items-center justify-center active:scale-90 transition"><i class="fa-solid fa-heart"></i></button>
          </div>
          <div class="text-center text-xs text-gray-500 mt-3">סיכוי למאצ׳: ${Math.round(matchChance(p) * 100)}%</div>
        </div></div>`;
    }

    // ---------- WhatsApp (inbox) ----------
    const WA_COLORS = ['bg-teal-700', 'bg-indigo-700', 'bg-rose-700', 'bg-amber-700', 'bg-sky-700', 'bg-purple-700', 'bg-emerald-700'];
    function waColor(name) { let h = 0; for (const ch of name) h = (h * 31 + ch.charCodeAt(0)) >>> 0; return WA_COLORS[h % WA_COLORS.length]; }
    function inboxPreview(m) {
      if (m.kind === 'msg') return m.text;
      const ev = EVENTS.find(e => e.id === m.evId);
      return m.done ? (m.reply ? `את/ה: ${m.reply}` : m.result) : fillTemplate(ev.d, m.ctx);
    }
    function appWhatsApp() {
      $('app-overlay').className = 'absolute inset-0 z-40 flex flex-col bg-[#111b21]';
      if (currentSub) return waChat(currentSub);
      return `<div class="min-h-full text-white">
        <div class="bg-[#202c33] px-3 pt-3 pb-3 flex items-center justify-between">
          <div class="flex items-center gap-1">${backBtn('closeApp()')}<span class="text-xl font-semibold">WhatsApp</span></div>
          <div class="flex gap-5 text-gray-300"><i class="fa-solid fa-camera"></i><i class="fa-solid fa-ellipsis-vertical"></i></div>
        </div>
        <div class="px-3 py-2"><div class="bg-[#202c33] rounded-full px-4 py-2 text-sm text-gray-400"><i class="fa-solid fa-magnifying-glass ml-2"></i>חיפוש</div></div>
        <div class="pb-8">${state.inbox.length ? state.inbox.map(m => {
          const pending = m.kind === 'event' && !m.done;
          return `<button onclick="openChat('${m.id}')" class="w-full flex items-center gap-3 px-3 py-3 hover:bg-[#202c33] text-right">
            <div class="w-12 h-12 rounded-full ${waColor(m.from)} flex items-center justify-center text-lg font-bold shrink-0">${esc(m.from.replace(/["״]/g, '')[0] || '?')}</div>
            <div class="flex-1 min-w-0 border-b border-[#222d34] pb-3">
              <div class="flex justify-between items-center"><span class="font-semibold truncate">${esc(m.from)}</span><span class="text-[11px] ${!m.read ? 'text-[#25D366]' : 'text-gray-500'} shrink-0 mr-2">${weeksAgo(m.w)}</span></div>
              <div class="flex justify-between items-center mt-0.5"><span class="text-sm text-gray-400 truncate">${esc(inboxPreview(m))}</span>
                ${!m.read ? '<span class="bg-[#25D366] text-black text-[11px] font-bold rounded-full min-w-[20px] h-5 px-1.5 flex items-center justify-center shrink-0 mr-2">1</span>' : pending ? '<span class="text-[#25D366] text-[11px] shrink-0 mr-2">מחכה לתשובה</span>' : ''}</div>
            </div>
          </button>`;
        }).join('') : '<div class="text-center text-gray-500 text-sm py-10">אין הודעות עדיין</div>'}</div>
      </div>`;
    }
    function openChat(id) {
      const m = state.inbox.find(x => x.id === id);
      if (m) m.read = true;
      appSub(id);
      renderAppGrid();
      saveState();
    }
    function waChat(id) {
      const m = state.inbox.find(x => x.id === id);
      if (!m) { currentSub = null; return appWhatsApp(); }
      const bubbleIn = (html) => `<div class="flex justify-start"><div class="bg-[#202c33] rounded-lg rounded-tr-none px-3 py-2 max-w-[85%] text-sm">${html}<div class="text-[10px] text-gray-400 text-left mt-1">${weeksAgo(m.w)}</div></div></div>`;
      const bubbleOut = (html) => `<div class="flex justify-end"><div class="bg-[#005c4b] rounded-lg rounded-tl-none px-3 py-2 max-w-[85%] text-sm">${html}<div class="text-[10px] text-gray-300 text-left mt-1">✓✓</div></div></div>`;
      let body = '', actions = '';
      if (m.kind === 'msg') {
        body = bubbleIn(esc(m.text));
      } else {
        const ev = EVENTS.find(e => e.id === m.evId);
        body = bubbleIn(`<div class="font-semibold mb-1">${esc(fillTemplate(ev.t, m.ctx))}</div>${esc(fillTemplate(ev.d, m.ctx))}`);
        if (m.done) {
          if (m.reply) body += bubbleOut(esc(m.reply));
          body += bubbleIn(`${esc(m.result)}${m.fxText ? `<div class="mt-1 text-[#25D366] font-semibold text-xs">${m.fxText}</div>` : ''}`);
        } else {
          const left = INBOX_EXPIRY - (state.totalWeeks - m.w);
          actions = `<div class="bg-[#202c33] p-3 space-y-2">
            <div class="text-[11px] text-gray-400 text-center">בחר תשובה · ${left <= 1 ? 'פג תוקף בסוף השבוע!' : `נשארו ${left} שבועות לענות`}</div>
            ${ev.ch.map((ch, i) => {
              const ok = canPay(ch.cost);
              return `<button ${ok ? `onclick="answerInbox('${m.id}', ${i})"` : 'disabled'} class="w-full ${ok ? 'bg-[#005c4b] hover:bg-[#00705c] text-white' : 'bg-gray-700/50 text-gray-500'} rounded-full py-2.5 px-4 text-sm text-right">
                ${esc(fillTemplate(ch.t, m.ctx))}${costText(ch.cost)}${ch.p !== undefined ? ` <span class="opacity-70">🎲 ${Math.round(choiceChance(ch) * 100)}%</span>` : ''}</button>`;
            }).join('')}
          </div>`;
        }
      }
      return `<div class="min-h-full flex flex-col text-white">
        <div class="bg-[#202c33] px-3 py-2.5 flex items-center gap-2 sticky top-0 z-10">
          ${backBtn('appSub(null)')}
          <div class="w-10 h-10 rounded-full ${waColor(m.from)} flex items-center justify-center font-bold">${esc(m.from.replace(/["״]/g, '')[0] || '?')}</div>
          <div class="flex-1 min-w-0"><div class="font-semibold truncate">${esc(m.from)}</div><div class="text-[11px] text-gray-400">מחובר/ת</div></div>
          <div class="flex gap-5 text-gray-300"><i class="fa-solid fa-video"></i><i class="fa-solid fa-phone"></i></div>
        </div>
        <div class="flex-1 wa-bg px-3 py-4 space-y-2">${body}</div>
        ${actions}
      </div>`;
    }
  </script>
