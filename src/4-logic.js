  <!-- ================= GAME ENGINE ================= -->
  <script>
    const SAVE_KEY = 'il_rap_star_save';
    let state = null;

    // ---------- Helpers ----------
    const $ = id => document.getElementById(id);
    const rnd = (a, b) => Math.floor(Math.random() * (b - a + 1)) + a;
    const pick = arr => arr[Math.floor(Math.random() * arr.length)];
    const clamp = (v, a, b) => Math.max(a, Math.min(b, v));
    const fmt = n => Math.round(n).toLocaleString('en-US');
    const money = n => (n < 0 ? '-₪' : '₪') + fmt(Math.abs(n));
    const signed = n => (n >= 0 ? '+' : '-') + fmt(Math.abs(n));
    function esc(s) {
      return String(s).replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
    }
    function shortNum(n) {
      if (n >= 1e6) return (n / 1e6).toFixed(1).replace(/\.0$/, '') + 'M';
      if (n >= 1e3) return (n / 1e3).toFixed(1).replace(/\.0$/, '') + 'K';
      return fmt(n);
    }
    function randomTitle() {
      return Math.random() < 0.4 ? pick(TITLE_SOLO) : pick(TITLE_A) + ' ' + pick(TITLE_B);
    }

    // ---------- State ----------
    function newState(name, handle, city, perk) {
      const s = {
        version: 2,
        artistName: name, handle, city,
        money: 1500, baseEnergy: BASE_ENERGY, energy: BASE_ENERGY,
        week: 1, year: 2026, totalWeeks: 1,
        verified: false, listeners: 0, followers: 120, youtubeViews: 0,
        skills: { flow: 10, charisma: 10, viral: 5, video: 5 },
        started: true,
        songs: [], inventory: [], logs: [`ברוכים הבאים ל-IL Rap Star! ${esc(name)} מ${esc(city)} מתחיל את הדרך.`],
        relationship: null, tinderProfile: null, dateThisWeek: false,
        gigsThisWeek: [], socialThisWeek: {},
        achievements: [], beefs: [], recentEvents: [], comments: [],
        trend: null, chart: null,
        stats: { gigs: {}, beefWins: 0, feats: 0, featTop: -1, matches: 0, relWeeksMax: 0, bestChart: null },
      };
      if (perk === 'money') s.money += 2500;
      else if (perk === 'viral') s.skills.viral += 5;
      else if (perk) s.skills[perk] += 6;
      s.trend = newTrend(-1);
      s.chart = initChart();
      return s;
    }

    // Bring older saves (before version 2) up to date without losing progress
    function migrate(s) {
      const base = newState(s.artistName || 'MC IL', s.handle || 'artist_il', s.city || 'תל אביב', null);
      const out = Object.assign(base, s);
      out.stats = Object.assign(base.stats, s.stats || {});
      out.skills = Object.assign({ flow: 10, charisma: 10, viral: 5, video: 5 }, s.skills || {});
      out.inventory = (s.inventory || []).map(x => (SHOP.find(i => i.id === x || i.legacy === x) || {}).id).filter(Boolean);
      out.songs = (s.songs || []).map(song => Object.assign({
        base: song.streams * 0.1, lastWeek: 0, genre: GENRES[2], feat: null, prevPos: null, peak: null,
        releaseTotalWeek: song.releaseWeek || 1,
      }, song, { genre: GENRES.includes(song.genre) ? song.genre : GENRES[2] }));
      if (s.relationship && !s.relationship.trait) out.relationship = null;
      if (!out.trend) out.trend = newTrend(-1);
      if (!out.chart) out.chart = initChart();
      out.baseEnergy = BASE_ENERGY;
      out.version = 2;
      return out;
    }

    function loadState() {
      try {
        const raw = JSON.parse(localStorage.getItem(SAVE_KEY));
        if (!raw) return null;
        return migrate(raw);
      } catch (e) { return null; }
    }
    function saveState() {
      if (state.started === false) return; // placeholder behind the start screen
      try { localStorage.setItem(SAVE_KEY, JSON.stringify(state)); } catch (e) {}
    }

    // ---------- Derived values ----------
    function effect(key) {
      return state.inventory.reduce((sum, id) => {
        const it = SHOP.find(i => i.id === id);
        return sum + (it && it.eff && it.eff[key] && key !== 'rent' ? it.eff[key] : 0);
      }, 0);
    }
    function maxEnergy() { return state.baseEnergy + effect('energy'); }
    function weeklyRent() {
      if (state.inventory.includes('penthouse')) return 4000;
      if (state.inventory.includes('florentin')) return 250;
      return BASE_RENT;
    }
    function moneyScale() { return 1 + Math.sqrt(state.followers) / 40; }
    function skillCost(skill) { return SKILL_BASE_COST[skill] + (state.skills[skill] || 5) * 25; }
    function partnerTrait() { return state.relationship ? TRAITS.find(t => t.id === state.relationship.trait) : null; }
    function fameRank() {
      const f = state.followers;
      if (f > 100000) return 'S+';
      if (f > 50000) return 'A';
      if (f > 10000) return 'B';
      if (f > 2500) return 'C';
      if (f > 500) return 'D';
      return 'F';
    }
    function stageTitle() {
      return { 'F': `ראפר מתחיל מ${state.city}`, 'D': `כישרון מקומי מ${state.city}`, 'C': 'שם עולה בסצנה', 'B': 'ראפר מוכר', 'A': 'כוכב ראפ', 'S+': 'אגדת ראפ ישראלית' }[fameRank()];
    }
    function socialFatigue(kind) {
      const n = state.socialThisWeek[kind] || 0;
      state.socialThisWeek[kind] = n + 1;
      return 1 / ((n + 1) * (n + 1)); // 1, 1/4, 1/9...
    }
    function listenerBonus(v) {
      return Math.min(0.3, state.listeners / (Math.max(v.req, 300) * 25));
    }

    // ---------- Trend ----------
    function newTrend(prevHot) {
      let hot;
      do { hot = rnd(0, GENRES.length - 1); } while (hot === prevHot);
      let cold;
      do { cold = rnd(0, GENRES.length - 1); } while (cold === hot);
      return { hot, cold, weeksLeft: rnd(4, 8) };
    }
    function trendMult(genre) {
      const i = GENRES.indexOf(genre);
      return i === state.trend.hot ? 1.4 : i === state.trend.cold ? 0.7 : 1;
    }

    // ---------- Chart ----------
    function newChartEntry(st) {
      const r = pick(RAPPERS);
      return { a: r.n, s: randomTitle(), st, prev: null };
    }
    function initChart() {
      const arr = [];
      for (let i = 0; i < 50; i++) arr.push(newChartEntry(Math.floor(260000 * Math.pow(0.93, i) * (0.9 + Math.random() * 0.2))));
      arr.sort((a, b) => b.st - a.st);
      arr.forEach((e, i) => e.prev = i + 1);
      return arr;
    }
    function combinedChart() {
      const rows = state.chart.map(e => ({ ...e }));
      state.songs.forEach((s, idx) => {
        if (s.lastWeek > 0) rows.push({ a: state.artistName, s: s.title, st: s.lastWeek, me: true, idx, prev: s.prevPos });
      });
      rows.sort((a, b) => b.st - a.st);
      return rows;
    }
    function myChartPositions() {
      const rows = combinedChart();
      const pos = {};
      rows.forEach((r, i) => { if (r.me) pos[r.idx] = i + 1; });
      return pos;
    }
    function bestMyPos() {
      const p = Object.values(myChartPositions());
      return p.length ? Math.min(...p) : null;
    }
    function recordChartStats() {
      const pos = myChartPositions();
      Object.entries(pos).forEach(([idx, p]) => {
        const s = state.songs[idx];
        if (p <= 50 && (!s.peak || p < s.peak)) s.peak = p;
        if (p <= 50 && (!state.stats.bestChart || p < state.stats.bestChart)) state.stats.bestChart = p;
      });
    }
    function tickChart() {
      // Remember last week's positions for the arrows
      const full = combinedChart();
      full.forEach((r, i) => { if (r.me) state.songs[r.idx].prevPos = i + 1; });
      state.chart.forEach(e => {
        const i = full.findIndex(r => !r.me && r.a === e.a && r.s === e.s);
        e.prev = i >= 0 ? i + 1 : null;
      });
      state.chart.forEach(e => e.st = Math.floor(e.st * (0.84 + Math.random() * 0.2)));
      const newcomers = rnd(3, 6);
      for (let i = 0; i < newcomers; i++) state.chart.push(newChartEntry(Math.floor(5000 + 300000 * Math.pow(Math.random(), 2))));
      state.chart.sort((a, b) => b.st - a.st);
      state.chart = state.chart.slice(0, 50);
    }

    // ---------- Toast (queued so messages don't hide each other) ----------
    const toastQueue = [];
    let toastBusy = false;
    function showToast(msg, isSuccess = true) {
      toastQueue.push({ msg, isSuccess });
      if (toastQueue.length > 4) toastQueue.shift();
      if (!toastBusy) nextToast();
    }
    function nextToast() {
      const item = toastQueue.shift();
      const toast = $('toast');
      if (!item) { toastBusy = false; return; }
      toastBusy = true;
      $('toast-msg').innerText = item.msg;
      $('toast-icon').className = item.isSuccess ? 'fa-solid fa-circle-check text-spotifyGreen' : 'fa-solid fa-circle-xmark text-red-500';
      toast.classList.remove('opacity-0', 'pointer-events-none');
      setTimeout(() => {
        toast.classList.add('opacity-0', 'pointer-events-none');
        setTimeout(nextToast, 250);
      }, 1900);
    }

    // ---------- Generic modal ----------
    function showModal({ title, html, buttons }) {
      $('modal-generic-title').innerHTML = title;
      $('modal-generic-body').innerHTML = html;
      const box = $('modal-generic-buttons');
      box.innerHTML = '';
      (buttons || [{ t: 'סגור' }]).forEach(b => {
        const el = document.createElement('button');
        el.className = b.disabled
          ? 'w-full bg-gray-800 text-gray-500 text-xs font-bold py-2.5 rounded-xl cursor-not-allowed'
          : (b.primary === false
            ? 'w-full bg-gray-800 border border-gray-700 text-gray-200 text-xs font-bold py-2.5 rounded-xl hover:bg-gray-700 transition'
            : 'w-full bg-spotifyGreen text-black text-xs font-bold py-2.5 rounded-xl hover:bg-green-600 transition');
        el.innerHTML = b.t;
        el.disabled = !!b.disabled;
        el.onclick = () => { $('modal-generic').classList.add('hidden'); if (b.fn) b.fn(); };
        box.appendChild(el);
      });
      $('modal-generic').classList.remove('hidden');
    }
    function closeModal(id) { $(id).classList.add('hidden'); }

    // ---------- Comments ----------
    function genUser() {
      return pick(USER_BASE) + pick(USER_SUFFIX);
    }
    function fillTemplate(str, ctx) {
      return str.replace(/\{(\w+)\}/g, (m, k) => (ctx[k] !== undefined ? ctx[k] : m));
    }
    function addComments(kind, n, ctx = {}) {
      const base = {
        city: pick(CITIES), genre: GENRES[state.trend.hot], rapper: pick(RAPPERS).n, place: pick(PLACES),
        partner: state.relationship ? state.relationship.name : 'היא',
        song: state.songs.length ? state.songs[state.songs.length - 1].title : 'השיר', venue: 'ההופעה',
      };
      const c = Object.assign(base, ctx);
      for (let i = 0; i < n; i++) {
        let text = fillTemplate(pick(COMMENTS[kind]), c);
        if (Math.random() < 0.6) text += ' ' + pick(EMOJIS);
        state.comments.unshift({ u: genUser(), c: pick(USER_COLORS), t: text });
      }
      state.comments = state.comments.slice(0, 14);
    }

    // ---------- Actions ----------
    function needEnergy(n) {
      if (state.energy < n) { showToast('אין מספיק אנרגיה השבוע!', false); return false; }
      return true;
    }

    function doJob(id) {
      const job = JOBS.find(j => j.id === id);
      if (!needEnergy(job.e)) return;
      state.energy -= job.e;
      state.money += job.pay;
      state.logs.push(`עבדת כ${job.name} והרווחת ₪${fmt(job.pay)}.`);
      showToast(`עבדת בהצלחה! +₪${fmt(job.pay)}`);
      updateUI();
    }

    function upgradeSkill(skill) {
      const level = state.skills[skill] || 5;
      if (level >= SKILL_CAP[skill]) { showToast('המיומנות כבר במקסימום!', false); return; }
      const cost = skillCost(skill);
      const energy = SKILL_ENERGY[skill];
      if (state.money < cost || state.energy < energy) { showToast('אין מספיק כסף או אנרגיה!', false); return; }
      state.money -= cost;
      state.energy -= energy;
      state.skills[skill] = Math.min(SKILL_CAP[skill], level + 2);
      showToast(`${SKILL_SHORT[skill]} שודרג ל-${state.skills[skill]}!`);
      updateUI();
    }

    function performGig(id) {
      const v = VENUES.find(x => x.id === id);
      if (state.followers < v.req) { showToast(`נדרשים לפחות ${fmt(v.req)} עוקבים למועדון זה!`, false); return; }
      if (state.gigsThisWeek.includes(id)) { showToast(`כבר הופעת ב${v.name} השבוע!`, false); return; }
      if (!needEnergy(v.e)) return;
      state.gigsThisWeek.push(id);
      state.energy -= v.e;
      const perf = 0.6 + Math.min(state.skills.charisma, 50) / 50 * 0.6 + Math.random() * 0.2;
      const pay = Math.floor(v.pay * perf * (1 + listenerBonus(v)) * (1 + effect('gigPay')));
      const gain = Math.max(15, Math.floor(v.req * 0.05 * perf));
      state.money += pay;
      state.followers += gain;
      state.stats.gigs[id] = (state.stats.gigs[id] || 0) + 1;
      state.logs.push(`הופעת ב${v.name}! הרווחת ₪${fmt(pay)} ו-${fmt(gain)} עוקבים.`);
      addComments('gig', 2, { venue: v.name });
      showToast(`הופעה ב${v.name}! +₪${fmt(pay)}`);
      updateUI();
    }

    function buyItem(id) {
      const item = SHOP.find(i => i.id === id);
      if (state.inventory.includes(id)) { showToast('כבר רכשת פריט זה!', false); return; }
      if (state.money < item.cost) { showToast('אין מספיק בחשבון הבנק!', false); return; }
      state.money -= item.cost;
      state.inventory.push(id);
      const once = item.once || {};
      if (once.f) state.followers += once.f;
      Object.keys(SKILL_CAP).forEach(k => { if (once[k]) state.skills[k] = Math.min(SKILL_CAP[k], state.skills[k] + once[k]); });
      state.logs.push(`תתחדש! קנית ${item.name}.`);
      showToast(`תתחדש על ה${item.name}!`);
      updateUI();
    }

    // ---------- Studio ----------
    function availableFeats() {
      return RAPPERS.filter(r => state.followers >= FEAT_TIERS[r.t].req && !state.beefs.includes(r.n))
        .sort((a, b) => a.t - b.t || a.n.localeCompare(b.n));
    }
    function openNewSongModal() {
      if (state.energy < 10) { showToast('נדרשת לפחות 10 אנרגיה להקלטה!', false); return; }
      $('input-song-genre').innerHTML = GENRES.map((g, i) =>
        `<option value="${esc(g)}">${esc(g)}${i === state.trend.hot ? ' 🔥 בטרנד' : i === state.trend.cold ? ' ❄️ יורד' : ''}</option>`).join('');
      $('input-song-genre').value = GENRES[state.trend.hot];
      const feats = availableFeats();
      $('input-song-feat').innerHTML = '<option value="">ללא פיצ׳ר</option>' + FEAT_TIERS.map((tier, ti) => {
        const list = feats.filter(r => r.t === ti);
        if (!list.length) return `<optgroup label="${tier.name} (🔒 ${fmt(tier.req)} עוקבים)"></optgroup>`;
        return `<optgroup label="${tier.name} (₪${fmt(tier.cost)})">` +
          list.map(r => `<option value="${esc(r.n)}">${esc(r.n)} · ${esc(GENRES[r.g])}</option>`).join('') + '</optgroup>';
      }).join('');
      updateSongCost();
      $('modal-song').classList.remove('hidden');
    }
    function suggestTitle() { $('input-song-title').value = randomTitle(); }

    function songChoices() {
      const type = $('input-song-type').value;
      const genre = $('input-song-genre').value;
      const producer = $('input-song-producer').value;
      const clip = $('input-song-clip').value;
      const featName = $('input-song-feat').value;
      const feat = featName ? RAPPERS.find(r => r.n === featName) : null;
      const tier = feat ? FEAT_TIERS[feat.t] : null;
      const producerCost = producer === 'indie' ? 1500 : producer === 'top' ? 7000 : 0;
      const clipCost = clip === 'lyric' ? 400 : clip === 'pro' ? 5000 : 0;
      const featCost = tier ? tier.cost : 0;
      return { type, genre, producer, clip, feat, tier, cost: producerCost + clipCost + featCost, energy: type === 'album' ? 20 : 10 };
    }
    function updateSongCost() {
      const c = songChoices();
      const lines = [`עלות: <b class="text-white">₪${fmt(c.cost)}</b> | אנרגיה: <b class="text-white">${c.energy}</b>`];
      const tm = trendMult(c.genre);
      if (tm > 1) lines.push('🔥 הז׳אנר בטרנד: +40% השמעות');
      if (tm < 1) lines.push('❄️ הז׳אנר יוצא מהאופנה: -30% השמעות');
      if (c.feat) lines.push(`🤝 פיצ׳ר: +${Math.round(c.tier.boost * (c.feat.g === GENRES.indexOf(c.genre) ? 1.25 : 1) * 100)}% השמעות${c.feat.g === GENRES.indexOf(c.genre) ? ' (אותו ז׳אנר!)' : ''}`);
      if (state.socialThisWeek.release) lines.push(`<span class="text-accentOrange">כבר שחררת השבוע: השיר הזה יקבל ${Math.round(100 / (state.socialThisWeek.release + 1))}% מהתשומת לב</span>`);
      if (c.type === 'album' && state.songs.filter(s => !s.isAlbum).length < 3) lines.push('<span class="text-red-400">צריך לפחות 3 סינגלים לפני אלבום</span>');
      if (state.money < c.cost) lines.push('<span class="text-red-400">אין מספיק כסף</span>');
      $('song-cost-summary').innerHTML = lines.join('<br>');
    }

    function confirmCreateSong() {
      const c = songChoices();
      const title = $('input-song-title').value.trim().slice(0, 32);
      if (!title) { showToast('חובה להזין שם!', false); return; }
      if (c.type === 'album' && state.songs.filter(s => !s.isAlbum).length < 3) { showToast('צריך לפחות 3 סינגלים לפני אלבום!', false); return; }
      if (state.energy < c.energy) { showToast(`נדרשת ${c.energy} אנרגיה!`, false); return; }
      if (state.money < c.cost) { showToast('אין מספיק כסף להפקה!', false); return; }

      state.money -= c.cost;
      state.energy -= c.energy;

      let q = c.producer === 'top' ? 3.8 : c.producer === 'indie' ? 2.2 : 1.0;
      if (c.type === 'album') q *= 2.5;
      q *= 1 + effect('quality');
      const pt = partnerTrait();
      if (pt && pt.id === 'smart') q *= 1.05;
      const featBoost = c.tier ? c.tier.boost * (c.feat.g === GENRES.indexOf(c.genre) ? 1.25 : 1) : 0;
      const tm = trendMult(c.genre);
      const luck = Math.random() * 0.5 + 0.8;
      // Each extra release in the same week gets less attention (1, 1/2, 1/3...)
      const n = state.socialThisWeek.release || 0;
      state.socialThisWeek.release = n + 1;
      const releaseFatigue = 1 / (n + 1);
      const raw = (state.skills.flow * 120 + state.skills.charisma * 80 + state.followers * 0.15) * q * (1 + featBoost) * luck * releaseFatigue;
      const initial = Math.floor(raw * tm);

      let yt = 0;
      const clipMult = (1 + effect('clip')) * (pt && (pt.id === 'artist' || pt.id === 'influencer') ? 1.3 : 1);
      if (c.clip === 'lyric') yt = Math.floor(initial * 0.5 * clipMult);
      if (c.clip === 'pro') yt = Math.floor((initial * 2.0 + state.skills.video * 600) * clipMult);

      const song = {
        title, genre: c.genre, isAlbum: c.type === 'album', feat: c.feat ? c.feat.n : null, clip: c.clip,
        streams: initial, base: Math.floor(raw), lastWeek: initial, ytViews: yt,
        releaseWeek: state.week, releaseTotalWeek: state.totalWeeks, prevPos: null, peak: null,
      };
      state.songs.push(song);
      state.listeners += Math.floor(initial / 3.5);
      state.youtubeViews += yt;
      // One release can add at most ~3% (+300) followers, so spamming songs can't snowball
      const newFans = Math.floor(Math.min(initial / 15, state.followers * 0.03 + 300));
      state.followers += newFans;
      state.money += Math.floor(initial * ROYALTY_PER_STREAM);
      if (c.feat) { state.stats.feats++; state.stats.featTop = Math.max(state.stats.featTop, c.feat.t); }
      recordChartStats();

      // Fan reaction depends on how the song did relative to the artist's usual level
      const score = q * (1 + featBoost) * tm * luck;
      const kind = score >= 2.2 ? 'songGood' : score >= 1.1 ? 'songMid' : 'songBad';
      addComments(kind, 3, { song: title, genre: c.genre });

      const pos = myChartPositions()[state.songs.length - 1];
      const label = c.type === 'album' ? 'האלבום' : 'הסינגל';
      state.logs.push(`${label} "${esc(title)}"${c.feat ? ` (פיט׳ ${esc(c.feat.n)})` : ''} שוחרר! ${fmt(initial)} השמעות בשבוע הראשון.`);
      closeModal('modal-song');
      $('input-song-title').value = '';
      updateUI();
      showModal({
        title: `🎶 "${esc(title)}" בחוץ!`,
        html: `<div class="space-y-1.5">
          <div>🎧 <b>${fmt(initial)}</b> השמעות בשבוע הראשון</div>
          <div>💰 +₪${fmt(initial * ROYALTY_PER_STREAM)} תמלוגים</div>
          <div>👥 +${fmt(newFans)} עוקבים</div>
          ${yt ? `<div>▶️ ${fmt(yt)} צפיות ביוטיוב</div>` : ''}
          <div>📊 ${pos && pos <= 50 ? `נכנס למצעד במקום <b class="text-spotifyGreen">#${pos}</b>!` : 'עוד לא במצעד הטופ 50'}</div>
          <div class="text-gray-400 pt-1">${kind === 'songGood' ? '🔥 הקהל משתגע על השיר!' : kind === 'songMid' ? '👍 תגובות סבירות.' : '😬 הקהל לא התחבר...'}</div>
        </div>`,
        buttons: [{ t: 'סבבה' }],
      });
    }

    // ---------- Social ----------
    function postInstaStory() {
      if (!needEnergy(3)) return;
      state.energy -= 3;
      const gain = Math.floor((Math.random() * 40 + 20 + state.skills.charisma + Math.sqrt(state.followers) * 1.2) * socialFatigue('story') * (1 + effect('social')));
      state.followers += gain;
      if (Math.random() < 0.6) addComments('social', 1);
      showToast(`העלית סטורי! +${fmt(gain)} עוקבים`);
      updateUI();
    }

    function startBeef() {
      if (!needEnergy(5)) return;
      state.energy -= 5;
      const target = pick(RAPPERS.filter(r => !state.beefs.includes(r.n))) || pick(RAPPERS);
      const fatigue = socialFatigue('beef');
      if (Math.random() < 0.6 + state.skills.flow / 500) {
        const gain = Math.floor((Math.random() * 300 + 150 + Math.sqrt(state.followers) * 12) * fatigue * (1 + effect('social')));
        state.followers += gain;
        state.stats.beefWins++;
        state.logs.push(`העלית דיס חריף על ${target.n}! כל הרשת מדברת עליך (+${fmt(gain)} עוקבים).`);
        addComments('beefWin', 2, { rapper: target.n });
        showToast('הדיס הפך לוויראלי! 🔥');
      } else {
        let loss = Math.floor(Math.random() * 100 + 50 + Math.sqrt(state.followers) * 8);
        if (effect('beefShield')) loss = Math.floor(loss / 2);
        state.followers = Math.max(0, state.followers - loss);
        state.logs.push(`הדיס מול ${target.n} פגע בך בחזרה (-${fmt(loss)} עוקבים).`);
        addComments('beefLose', 2, { rapper: target.n });
        showToast('הדיס חזר אליך כבומרנג...', false);
      }
      if (!state.beefs.includes(target.n)) state.beefs.push(target.n);
      state.beefs = state.beefs.slice(-8);
      updateUI();
    }

    function tiktokChallenge() {
      if (!needEnergy(4)) return;
      state.energy -= 4;
      const boost = Math.floor((state.skills.viral * 8 + Math.sqrt(state.followers) * 3) * (Math.random() + 0.5) * socialFatigue('tiktok') * (1 + effect('social')));
      state.followers += boost;
      if (state.songs.length) state.songs[state.songs.length - 1].base *= 1.03;
      if (Math.random() < 0.6) addComments('social', 1);
      showToast(`אתגר הטיקטוק תפס! +${fmt(boost)} עוקבים 🎵`);
      updateUI();
    }

    // ---------- Tinder ----------
    function genProfile() {
      const tr = pick(TRAITS);
      return { name: pick(TINDER_NAMES), age: rnd(19, 31), city: pick(CITIES), bio: pick(tr.bios), icon: pick(TINDER_ICONS), bg: pick(TINDER_BG), trait: tr.id };
    }
    function matchChance(p) {
      let c = 0.3 + Math.min(0.35, Math.sqrt(state.followers) / 600) + (state.verified ? 0.1 : 0);
      if (p && p.trait === 'influencer' && !state.verified) c = 0.1;
      return Math.min(0.9, c);
    }
    function renderTinderCard() {
      $('tinder-matches-count').innerText = state.stats.matches;
      if (state.relationship) {
        const r = state.relationship;
        const tr = partnerTrait();
        $('tinder-card').classList.add('hidden');
        $('tinder-relationship-box').classList.remove('hidden');
        $('rel-partner-name').innerText = `${r.name}, ${r.age} (${r.city})`;
        $('rel-partner-trait').innerText = `✦ ${tr.name}`;
        $('rel-partner-loyalty').innerText = r.loyalty + '%';
        $('rel-loyalty-bar').style.width = clamp(r.loyalty, 0, 100) + '%';
        $('rel-partner-drama').innerText = DRAMA_LABELS[tr.drama];
        $('rel-weeks').innerText = r.weeks;
        $('rel-perk').innerText = `💡 ${tr.perk}`;
        $('rel-dates').innerHTML = DATES.map(d => {
          const cost = tr.id === 'rich' ? Math.floor(d.cost / 2) : d.cost;
          const dis = state.dateThisWeek || state.money < cost;
          return `<button onclick="goOnDate('${d.id}')" ${dis ? 'disabled' : ''} class="${dis ? 'bg-gray-800/50 text-gray-500 cursor-not-allowed' : 'bg-gray-800 text-gray-200 hover:bg-gray-700'} text-xs py-2 rounded-xl border border-gray-700">${d.name} (₪${fmt(cost)})</button>`;
        }).join('');
        $('rel-date-note').innerText = state.dateThisWeek ? 'כבר יצאתם לדייט השבוע' : 'דייט אחד בשבוע: מחזיר אנרגיה ומעלה נאמנות';
        return;
      }
      $('tinder-card').classList.remove('hidden');
      $('tinder-relationship-box').classList.add('hidden');
      if (!state.tinderProfile) state.tinderProfile = genProfile();
      const p = state.tinderProfile;
      const tr = TRAITS.find(t => t.id === p.trait);
      $('tinder-name').innerText = `${p.name}, ${p.age}`;
      $('tinder-bio').innerText = `"${p.bio}"`;
      $('tinder-age-loc').innerText = `${p.city}, ${p.age}`;
      $('tinder-trait').innerText = tr.name;
      $('tinder-avatar-icon').className = `fa-solid ${p.icon}`;
      $('tinder-avatar-bg').className = `w-full h-44 rounded-lg flex items-center justify-center text-5xl text-gray-300 relative overflow-hidden ${p.bg}`;
      $('tinder-chance').innerText = Math.round(matchChance(p) * 100) + '%';
    }
    function swipeTinder(isLike) {
      const p = state.tinderProfile;
      const card = $('tinder-card');
      card.classList.add(isLike ? 'anim-swipe-right' : 'anim-swipe-left');
      setTimeout(() => {
        card.classList.remove('anim-swipe-right', 'anim-swipe-left');
        if (isLike) {
          if (Math.random() < matchChance(p)) {
            const tr = TRAITS.find(t => t.id === p.trait);
            state.stats.matches++;
            state.relationship = Object.assign({}, p, { loyalty: tr.start + rnd(0, 15), weeks: 0 });
            state.logs.push(`מאצ׳ חדש! התחלת לצאת עם ${p.name} (${tr.name}).`);
            showToast(`Match! 🔥 יצאת לדרך עם ${p.name}`);
          } else {
            showToast('אין מאצ׳...', false);
          }
        }
        state.tinderProfile = genProfile();
        renderTinderCard();
        updateUI();
      }, 250);
    }
    function goOnDate(type) {
      const d = DATES.find(x => x.id === type);
      const tr = partnerTrait();
      const cost = tr.id === 'rich' ? Math.floor(d.cost / 2) : d.cost;
      if (state.dateThisWeek) { showToast('כבר יצאתם לדייט השבוע!', false); return; }
      if (state.money < cost) { showToast('אין מספיק כסף לדייט!', false); return; }
      state.money -= cost;
      state.dateThisWeek = true;
      const extra = tr.id === 'party' ? 3 : tr.id === 'calm' ? 2 : 0;
      state.energy = Math.min(maxEnergy(), state.energy + d.e + extra);
      state.relationship.loyalty = Math.min(100, state.relationship.loyalty + d.l);
      showToast(`יצאתם ל${d.name}! האנרגיה התחדשה 🍷`);
      updateUI();
    }
    function breakUp() {
      const r = state.relationship;
      const tr = partnerTrait();
      if (tr.drama >= 2) {
        const loss = Math.floor(state.followers * 0.02);
        state.followers -= loss;
        state.logs.push(`נפרדת מ${r.name}. היא העלתה סטורי נגדך (-${fmt(loss)} עוקבים).`);
      } else {
        state.logs.push(`נפרדת מ${r.name}.`);
      }
      state.relationship = null;
      showToast('נפרדתם... חזרת לשוק!', false);
      renderTinderCard();
      updateUI();
    }
    function tickRelationship(lines) {
      const r = state.relationship;
      if (!r) return;
      const tr = partnerTrait();
      r.weeks++;
      state.stats.relWeeksMax = Math.max(state.stats.relWeeksMax, r.weeks);
      r.loyalty -= tr.decay + rnd(0, 4);
      if (tr.id === 'influencer') {
        const gain = Math.floor(50 + Math.sqrt(state.followers) * 3);
        state.followers += gain;
        lines.push(`📸 ${r.name} תייגה אותך: +${fmt(gain)} עוקבים`);
      }
      if (r.loyalty <= 0) {
        lines.push(`💔 ${r.name} נפרדה ממך. הזנחת אותה.`);
        if (tr.drama >= 2) {
          const loss = Math.floor(state.followers * 0.02);
          state.followers -= loss;
          lines.push(`היא העלתה סטורי נגדך: -${fmt(loss)} עוקבים`);
        }
        state.logs.push(`💔 ${r.name} נפרדה ממך.`);
        state.relationship = null;
      } else if (r.loyalty < 25) {
        lines.push(`⚠️ ${r.name} מרגישה מוזנחת (נאמנות ${r.loyalty}%). צא איתה לדייט!`);
      }
    }

    // ---------- Random events ----------
    function eventPool() {
      return EVENTS.filter(e => (!e.c || e.c(state)) && !state.recentEvents.includes(e.id));
    }
    function makeCtx(ev) {
      const text = JSON.stringify(ev);
      const ctx = {};
      const used = new Set();
      const take = (pool, key) => { let v; do { v = pick(pool); } while (used.has(key + v) && pool.length > 1); used.add(key + v); return v; };
      if (text.includes('{rapper}')) ctx.rapper = ev.useBeef && state.beefs.length ? pick(state.beefs) : take(RAPPERS.map(r => r.n), 'r');
      if (text.includes('{media}')) ctx.media = pick(MEDIA);
      if (text.includes('{brand}')) ctx.brand = pick(BRANDS);
      if (text.includes('{city}')) ctx.city = pick(CITIES);
      if (text.includes('{place}')) ctx.place = pick(PLACES);
      if (text.includes('{friend}')) ctx.friend = pick(FRIENDS);
      if (text.includes('{producer}')) ctx.producer = pick(PRODUCERS);
      if (text.includes('{label}')) ctx.label = pick(LABELS);
      if (text.includes('{partner}') && state.relationship) ctx.partner = state.relationship.name;
      if (text.includes('{song}') && state.songs.length) {
        ctx.songIdx = Math.max(0, state.songs.length - rnd(1, Math.min(5, state.songs.length)));
        ctx.song = state.songs[ctx.songIdx].title;
      }
      return ctx;
    }
    function costText(cost) {
      if (!cost) return '';
      const parts = [];
      if (cost.e) parts.push(`-${cost.e} ⚡`);
      if (cost.m) parts.push(`-₪${fmt(cost.m)}`);
      if (cost.ms) parts.push(`-₪${fmt(cost.ms * moneyScale())}`);
      return parts.length ? ` <span class="opacity-70">(${parts.join(', ')})</span>` : '';
    }
    function canPay(cost) {
      if (!cost) return true;
      if (cost.e && state.energy < cost.e) return false;
      const m = (cost.m || 0) + (cost.ms ? Math.round(cost.ms * moneyScale()) : 0);
      return state.money >= m;
    }
    function payCost(cost) {
      if (!cost) return;
      if (cost.e) state.energy -= cost.e;
      if (cost.m) state.money -= cost.m;
      if (cost.ms) state.money -= Math.round(cost.ms * moneyScale());
    }
    function applyFx(fx, ctx) {
      const parts = [];
      if (!fx) return '';
      if (fx.f) {
        // Percentage part is capped so events help big artists without compounding forever
        let d = Math.round(Math.min(state.followers, 40000) * fx.f[0] + fx.f[1]);
        if (d !== 0) d = Math.round(d * (d > 0 ? 1 + effect('social') * 0.5 : 1));
        d = Math.max(-state.followers, d);
        state.followers += d;
        if (d) parts.push(`${signed(d)} עוקבים`);
      }
      if (fx.m) { state.money += fx.m; parts.push(`${fx.m >= 0 ? '+' : '-'}₪${fmt(Math.abs(fx.m))}`); }
      if (fx.ms) { const d = Math.round(fx.ms * moneyScale()); state.money += d; parts.push(`${d >= 0 ? '+' : '-'}₪${fmt(Math.abs(d))}`); }
      if (fx.e) { const before = state.energy; state.energy = clamp(state.energy + fx.e, 0, maxEnergy()); const d = state.energy - before; if (d) parts.push(`${signed(d)} ⚡`); }
      if (fx.l) { const d = Math.round(state.listeners * fx.l[0] + fx.l[1]); state.listeners = Math.max(0, state.listeners + d); parts.push(`${signed(d)} מאזינים`); }
      if (fx.sk) Object.entries(fx.sk).forEach(([k, v]) => {
        const before = state.skills[k];
        state.skills[k] = clamp(before + v, 1, SKILL_CAP[k]);
        if (state.skills[k] !== before) parts.push(`${signed(state.skills[k] - before)} ${SKILL_SHORT[k]}`);
      });
      if (fx.song && ctx.songIdx !== undefined) {
        const s = state.songs[ctx.songIdx];
        s.base *= 1 + fx.song;
        s.releaseTotalWeek = Math.max(s.releaseTotalWeek, state.totalWeeks - 2); // a revival also resets the fade a little
        parts.push(`בוסט ל"${esc(s.title)}"`);
      }
      if (fx.rel && state.relationship) {
        state.relationship.loyalty = clamp(state.relationship.loyalty + fx.rel, 0, 100);
        parts.push(`${signed(fx.rel)} נאמנות`);
      }
      if (fx.beef && ctx.rapper && !state.beefs.includes(ctx.rapper)) { state.beefs.push(ctx.rapper); state.beefs = state.beefs.slice(-8); }
      if (fx.unbeef && ctx.rapper) state.beefs = state.beefs.filter(b => b !== ctx.rapper);
      return parts.join(' · ');
    }
    function showEvent(ev, ctx, onDone) {
      const title = fillTemplate(ev.t, ctx);
      showModal({
        title: esc(title),
        html: `<div class="text-sm text-gray-200">${esc(fillTemplate(ev.d, ctx))}</div>`,
        buttons: ev.ch.map(ch => ({
          t: esc(fillTemplate(ch.t, ctx)) + costText(ch.cost) + (ch.p !== undefined ? ` <span class="opacity-70">🎲 ${Math.round(choiceChance(ch) * 100)}%</span>` : ''),
          disabled: !canPay(ch.cost),
          primary: ch === ev.ch[0],
          fn: () => resolveChoice(ev, ch, ctx, title, onDone),
        })),
      });
    }
    function choiceChance(ch) {
      return Math.min(0.9, ch.p + (ch.ps ? (state.skills[ch.ps] || 0) / 150 : 0));
    }
    function resolveChoice(ev, ch, ctx, title, onDone) {
      payCost(ch.cost);
      let out = ch;
      if (ch.p !== undefined) out = Math.random() < choiceChance(ch) ? ch.win : ch.lose;
      const fxText = applyFx(out.fx, ctx);
      const result = fillTemplate(out.r || '', ctx);
      state.logs.push(`⚡ ${esc(title)}: ${esc(result)}${fxText ? ` (${fxText})` : ''}`);
      updateUI();
      showModal({
        title: esc(title),
        html: `<div class="text-sm text-gray-200">${esc(result)}</div>${fxText ? `<div class="mt-2 text-spotifyGreen font-semibold">${fxText}</div>` : ''}`,
        buttons: [{ t: 'סבבה', fn: onDone }],
      });
    }
    function rollEvent() {
      if (Math.random() > 0.65) return null;
      const pool = eventPool();
      if (!pool.length) return null;
      const ev = pick(pool);
      state.recentEvents.push(ev.id);
      state.recentEvents = state.recentEvents.slice(-30);
      return { ev, ctx: makeCtx(ev) };
    }

    // ---------- Week ----------
    function nextWeek() {
      const lines = [];
      tickChart(); // stores last week's positions first

      state.totalWeeks = (state.totalWeeks || state.week) + 1;
      state.week++;
      if (state.week > 52) { state.week = 1; state.year++; }
      state.energy = maxEnergy();
      state.gigsThisWeek = [];
      state.socialThisWeek = {};
      state.dateThisWeek = false;

      let royalties = 0, newListeners = 0, totalWeekly = 0;
      state.songs.forEach(song => {
        const age = state.totalWeeks - (song.releaseTotalWeek || 1);
        const decay = Math.max(0.03, Math.pow(0.85, age));
        const weekly = Math.floor((song.base * 0.35 + state.followers * 0.4) * decay * trendMult(song.genre) * (0.85 + Math.random() * 0.3));
        const ytRate = song.clip === 'pro' ? 0.6 : song.clip === 'lyric' ? 0.2 : 0.03;
        const yt = Math.floor(weekly * ytRate);
        song.streams += weekly;
        song.lastWeek = weekly;
        song.ytViews += yt;
        state.youtubeViews += yt;
        totalWeekly += weekly;
        royalties += Math.floor(weekly * ROYALTY_PER_STREAM);
        newListeners += Math.floor(weekly * 0.18);
      });
      state.money += royalties;
      state.listeners = Math.floor(state.listeners * 0.88) + newListeners;
      state.followers += Math.floor(Math.min(totalWeekly * 0.01, state.followers * 0.015 + 200));
      const churn = Math.floor(state.followers * 0.01);
      state.followers -= churn;
      const rent = weeklyRent();
      state.money -= rent;

      recordChartStats();
      const best = bestMyPos();

      lines.push(`🎧 ${fmt(totalWeekly)} השמעות → <b class="text-spotifyGreen">+₪${fmt(royalties)}</b> תמלוגים`);
      lines.push(`🏠 הוצאות מחיה: <b class="text-red-400">-₪${fmt(rent)}</b>`);
      lines.push(`📊 ${best && best <= 50 ? `השיר הכי גבוה שלך במצעד: <b class="text-spotifyGreen">#${best}</b>` : 'אין לך שיר בטופ 50'}`);

      state.trend.weeksLeft--;
      if (state.trend.weeksLeft <= 0) {
        state.trend = newTrend(state.trend.hot);
        lines.push(`🔥 טרנד חדש: <b class="text-accentOrange">${GENRES[state.trend.hot]}</b> חם, ${GENRES[state.trend.cold]} יורד`);
        state.logs.push(`🔥 טרנד חדש בסצנה: ${GENRES[state.trend.hot]} הכי חם עכשיו.`);
      }

      tickRelationship(lines);
      if (state.money < 0) {
        lines.push(`<span class="text-red-400">⚠️ החשבון במינוס! צא לעבוד.</span>`);
        state.logs.push(`⚠️ החשבון במינוס (${money(state.money)}).`);
      }

      addComments(state.followers < 2000 ? 'small' : state.followers > 100000 ? 'big' : 'general', 1);
      if (state.relationship && Math.random() < 0.4) addComments('rel', 1);

      updateUI();
      const event = rollEvent();
      showModal({
        title: `📅 שבוע ${state.week}, ${state.year}`,
        html: `<div class="space-y-1.5">${lines.map(l => `<div>${l}</div>`).join('')}</div>`,
        buttons: [{ t: event ? 'המשך ⚡ יש אירוע!' : 'המשך', fn: () => { if (event) showEvent(event.ev, event.ctx); } }],
      });
    }

    // ---------- Achievements ----------
    function checkAchievements() {
      ACHIEVEMENTS.forEach(a => {
        if (state.achievements.includes(a.id) || !a.test(state)) return;
        state.achievements.push(a.id);
        const rw = [];
        if (a.rw.m) { state.money += a.rw.m; rw.push(`+₪${fmt(a.rw.m)}`); }
        if (a.rw.f) { state.followers += a.rw.f; rw.push(`+${fmt(a.rw.f)} עוקבים`); }
        state.logs.push(`🏆 הישג חדש: ${a.n}! (${rw.join(', ')})`);
        showToast(`🏆 הישג: ${a.n} ${rw.join(', ')}`);
      });
    }

    // ---------- Rendering ----------
    function updateUI() {
      checkAchievements();
      if (state.followers >= 10000 && !state.verified) {
        state.verified = true;
        showToast('מזל טוב! קיבלת וי כחול באינסטגרם!');
      }
      state.energy = Math.min(state.energy, maxEnergy());

      const moneyEl = $('top-money');
      moneyEl.innerText = money(state.money);
      moneyEl.classList.toggle('text-red-500', state.money < 0);
      moneyEl.classList.toggle('text-spotifyGreen', state.money >= 0);
      $('top-energy').innerHTML = `<i class="fa-solid fa-bolt text-xs ml-0.5"></i>${state.energy}/${maxEnergy()}`;
      $('top-date').innerText = `שבוע ${state.week}, ${state.year}`;
      $('top-fame').innerText = `Fame: ${fameRank()}`;

      $('dash-artist-name').innerText = state.artistName;
      $('dash-stage-title').innerText = stageTitle();
      $('dash-listeners').innerText = fmt(state.listeners);
      $('dash-insta-followers').innerText = fmt(state.followers) + ' עוקבים';
      $('dash-yt-views').innerText = fmt(state.youtubeViews) + ' צפיות';
      $('insta-followers-count').innerText = fmt(state.followers);
      $('insta-username').innerText = '@' + state.handle;
      $('dash-verified').classList.toggle('hidden', !state.verified);

      $('trend-hot').innerText = GENRES[state.trend.hot];
      $('trend-cold').innerText = GENRES[state.trend.cold];
      $('trend-weeks').innerText = `מתחלף בעוד ${state.trend.weeksLeft} שבועות`;

      renderSkills();
      renderSongs();
      renderChart();
      renderAchievements();
      renderJobsAndGigs();
      renderShop();
      renderComments();
      renderTinderCard();

      $('beef-list').innerText = state.beefs.length ? `🥊 בביף עם: ${state.beefs.join(', ')} (לא יעשו איתך פיצ׳ר)` : '';
      $('dash-logs').innerHTML = state.logs.slice(-6).reverse().map(l => `<li class="bg-gray-900/60 p-2.5 rounded-lg border border-gray-800">${l}</li>`).join('');
      state.logs = state.logs.slice(-40);
      saveState();
    }

    function renderSkills() {
      $('skills-list').innerHTML = Object.keys(SKILL_CAP).map(k => {
        const lvl = state.skills[k];
        const maxed = lvl >= SKILL_CAP[k];
        return `<div>
          <div class="flex justify-between text-xs mb-1">
            <span class="text-gray-200">${SKILL_NAMES[k]} (${lvl}/${SKILL_CAP[k]})</span>
            <button onclick="upgradeSkill('${k}')" class="${maxed ? 'text-gray-500' : 'text-spotifyGreen hover:underline'} font-semibold text-[11px]">${maxed ? 'מקסימום ✓' : `אימון (${SKILL_ENERGY[k]} <i class="fa-solid fa-bolt"></i> / ₪${fmt(skillCost(k))})`}</button>
          </div>
          <div class="w-full bg-gray-900 h-2.5 rounded-full overflow-hidden border border-gray-800">
            <div class="${SKILL_BAR[k]} h-full transition-all duration-300" style="width:${lvl / SKILL_CAP[k] * 100}%"></div>
          </div>
        </div>`;
      }).join('');
    }

    function renderSongs() {
      const container = $('studio-songs-list');
      if (!state.songs.length) {
        container.innerHTML = `<div class="bg-cardDark p-4 rounded-xl border border-gray-800 text-center text-xs text-gray-500 py-6">עדיין לא הקלטת שירים. לחץ על "יצירת יצירה" להתחלה.</div>`;
        return;
      }
      const pos = myChartPositions();
      container.innerHTML = state.songs.map((song, idx) => ({ song, idx })).reverse().map(({ song, idx }) => {
        const tm = trendMult(song.genre);
        const p = pos[idx];
        return `<div class="bg-cardDark p-3 rounded-xl border border-gray-800">
          <div class="flex justify-between items-start gap-2">
            <div class="min-w-0">
              <div class="text-xs font-bold text-white flex items-center gap-1.5 flex-wrap">
                <i class="fa-solid fa-music text-spotifyGreen"></i> ${esc(song.title)}
                <span class="text-[10px] bg-gray-800 px-1.5 py-0.5 rounded text-gray-400">${song.isAlbum ? 'אלבום' : 'סינגל'}</span>
                ${p && p <= 50 ? `<span class="text-[10px] bg-green-900/50 px-1.5 py-0.5 rounded text-spotifyGreen">#${p}</span>` : ''}
              </div>
              <div class="text-[10px] text-gray-400 mt-0.5">${esc(song.genre)}${tm > 1 ? ' 🔥' : tm < 1 ? ' ❄️' : ''}${song.feat ? ` · פיט׳ ${esc(song.feat)}` : ''}${song.peak ? ` · שיא: #${song.peak}` : ''}</div>
              <div class="text-[10px] text-gray-400 mt-0.5">
                <span class="text-spotifyGreen">${fmt(song.streams)} השמעות</span> (${shortNum(song.lastWeek)} בשבוע) |
                <span class="text-youtubeRed">${fmt(song.ytViews)} צפיות</span>
              </div>
            </div>
            <div class="text-xs font-bold text-spotifyGreen shrink-0">+₪${fmt(song.streams * ROYALTY_PER_STREAM)}</div>
          </div>
        </div>`;
      }).join('');
    }

    function chartRow(item, idx) {
      const pos = idx + 1;
      let arrow = '<span class="text-[9px] text-cyan-400 font-bold">חדש</span>';
      if (item.prev) {
        const d = item.prev - pos;
        arrow = d > 0 ? `<span class="text-[9px] text-spotifyGreen">▲${d}</span>` : d < 0 ? `<span class="text-[9px] text-red-400">▼${-d}</span>` : '<span class="text-[9px] text-gray-500">=</span>';
      }
      return `<div class="flex items-center justify-between bg-gray-900/60 p-2 rounded-xl text-xs ${item.me ? 'border border-spotifyGreen/50' : ''}">
        <div class="flex items-center space-x-2 space-x-reverse min-w-0">
          <span class="font-bold text-gray-400 w-5 text-center">${pos}</span>
          <span class="w-6 text-center">${arrow}</span>
          <div class="min-w-0">
            <div class="font-bold truncate ${item.me ? 'text-spotifyGreen' : 'text-white'}">${esc(item.s)}</div>
            <div class="text-[10px] text-gray-400 truncate">${esc(item.a)}</div>
          </div>
        </div>
        <div class="text-[11px] text-gray-300 font-medium shrink-0">${shortNum(item.st)}</div>
      </div>`;
    }
    function renderChart() {
      const rows = combinedChart();
      $('dash-chart-list').innerHTML = rows.slice(0, 5).map(chartRow).join('');
      const pos = myChartPositions();
      const entries = Object.entries(pos).sort((a, b) => a[1] - b[1]);
      if (!entries.length) {
        $('dash-my-chart').innerHTML = '🎤 עוד אין לך שירים. הקלט שיר כדי להיכנס למצעד.';
      } else {
        const [idx, p] = entries[0];
        const s = state.songs[idx];
        const need = rows[49] ? rows[49].st : 0;
        $('dash-my-chart').innerHTML = p <= 50
          ? `🎤 השיר הכי גבוה שלך: <b class="text-spotifyGreen">"${esc(s.title)}" במקום #${p}</b>${s.peak ? ` (שיא: #${s.peak})` : ''}`
          : `🎤 "${esc(s.title)}" במקום <b>#${p}</b>. צריך עוד ${fmt(need - s.lastWeek)} השמעות שבועיות כדי להיכנס לטופ 50.`;
      }
    }
    function openChartModal() {
      const rows = combinedChart().slice(0, 50);
      showModal({ title: '<i class="fa-brands fa-spotify text-spotifyGreen"></i> Top 50 ספוטיפיי ישראל', html: `<div class="text-[10px] text-gray-400 mb-2">השמעות בשבוע האחרון</div><div class="space-y-1.5">${rows.map(chartRow).join('')}</div>`, buttons: [{ t: 'סגור' }] });
    }

    function renderAchievements() {
      const done = state.achievements.length;
      $('ach-count').innerText = `${done}/${ACHIEVEMENTS.length}`;
      $('ach-bar').style.width = (done / ACHIEVEMENTS.length * 100) + '%';
      const next = ACHIEVEMENTS.filter(a => !state.achievements.includes(a.id)).slice(0, 3);
      $('ach-next').innerHTML = next.length ? next.map(a => `<div class="flex justify-between bg-gray-900/60 p-2 rounded-lg border border-gray-800">
        <span><i class="fa-solid fa-lock text-gray-600 ml-1"></i> <b class="text-gray-200">${a.n}</b> · <span class="text-gray-400">${a.d}</span></span>
        <span class="text-goldAccent text-[10px] shrink-0 mr-2">${rewardText(a.rw)}</span></div>`).join('')
        : '<div class="text-goldAccent">השלמת את כל ההישגים! 👑</div>';
    }
    function rewardText(rw) {
      return [rw.m ? `₪${shortNum(rw.m)}` : '', rw.f ? `${shortNum(rw.f)} עוקבים` : ''].filter(Boolean).join(' + ');
    }
    function openAchievementsModal() {
      showModal({
        title: '<i class="fa-solid fa-trophy text-goldAccent"></i> הישגים',
        html: `<div class="space-y-1.5">${ACHIEVEMENTS.map(a => {
          const ok = state.achievements.includes(a.id);
          return `<div class="flex justify-between p-2 rounded-lg border ${ok ? 'border-yellow-700/60 bg-yellow-900/20' : 'border-gray-800 bg-gray-900/60'}">
            <span>${ok ? '🏆' : '<i class="fa-solid fa-lock text-gray-600"></i>'} <b class="${ok ? 'text-goldAccent' : 'text-gray-300'}">${a.n}</b><br><span class="text-[10px] text-gray-400">${a.d}</span></span>
            <span class="text-[10px] text-gray-400 shrink-0 mr-2">${rewardText(a.rw)}</span></div>`;
        }).join('')}</div>`,
        buttons: [{ t: 'סגור' }],
      });
    }

    function renderJobsAndGigs() {
      $('jobs-list').innerHTML = JOBS.map(j => `<div class="bg-cardDark p-3 rounded-xl border border-gray-800 flex justify-between items-center">
        <div>
          <div class="text-xs font-bold text-white flex items-center gap-1.5"><i class="fa-solid ${j.icon}"></i> ${j.name}</div>
          <div class="text-[11px] text-gray-400">הכנסה: ₪${fmt(j.pay)} | עלות: ${j.e} אנרגיה</div>
        </div>
        <button onclick="doJob('${j.id}')" class="bg-spotifyGreen text-black text-xs font-bold px-3 py-1.5 rounded-xl hover:bg-green-600 transition">עבוד</button>
      </div>`).join('');

      const gigPay = effect('gigPay');
      $('gigs-list').innerHTML = VENUES.map(v => {
        const locked = state.followers < v.req;
        const done = state.gigsThisWeek.includes(v.id);
        const bonus = Math.round(listenerBonus(v) * 100);
        let btn;
        if (locked) btn = `<button disabled class="bg-gray-800 text-gray-500 text-xs font-bold px-3 py-1.5 rounded-xl cursor-not-allowed">🔒 נעול</button>`;
        else if (done) btn = `<button disabled class="bg-gray-800 text-spotifyGreen text-xs font-bold px-3 py-1.5 rounded-xl cursor-not-allowed">✓ הופעת השבוע</button>`;
        else btn = `<button onclick="performGig('${v.id}')" class="bg-spotifyGreen text-black text-xs font-bold px-3 py-1.5 rounded-xl hover:bg-green-600 transition">הופע (${v.e} <i class="fa-solid fa-bolt text-[9px]"></i>)</button>`;
        return `<div class="bg-cardDark p-3 rounded-xl border border-gray-800 flex justify-between items-center ${locked ? 'opacity-60' : ''}">
          <div>
            <div class="text-xs font-bold text-white">${v.name}</div>
            <div class="text-[11px] text-gray-400">דרישה: ${fmt(v.req)} עוקבים | רווח: עד ₪${fmt(v.pay * 1.4 * (1 + listenerBonus(v)) * (1 + gigPay))}</div>
            ${!locked && bonus ? `<div class="text-[10px] text-spotifyGreen">🎧 בונוס מאזינים: +${bonus}%</div>` : ''}
          </div>
          ${btn}
        </div>`;
      }).join('');
    }

    function renderShop() {
      $('shop-owned-items').innerHTML = state.inventory.length
        ? state.inventory.map(id => `<span class="bg-gray-800 px-2 py-1 rounded-lg border border-gray-700 text-spotifyGreen font-semibold">${SHOP.find(i => i.id === id).name}</span>`).join('')
        : '<span class="bg-gray-800 px-2 py-1 rounded-lg border border-gray-700 text-gray-500">אין רכוש עדיין</span>';
      $('shop-rent').innerText = `🏠 הוצאות מחיה שבועיות: ₪${fmt(weeklyRent())} | ⚡ אנרגיה שבועית: ${maxEnergy()}`;
      const cats = [...new Set(SHOP.map(i => i.cat))];
      $('shop-catalog').innerHTML = cats.map(cat => `<div class="space-y-2">
        <h3 class="text-xs font-bold text-gray-400 uppercase tracking-wider">${cat}</h3>
        ${SHOP.filter(i => i.cat === cat).map(i => {
          const own = state.inventory.includes(i.id);
          const afford = state.money >= i.cost;
          return `<div class="bg-cardDark p-3 rounded-xl border border-gray-800 flex justify-between items-center gap-2">
            <div class="min-w-0">
              <div class="text-xs font-bold text-white">${i.name}</div>
              <div class="text-[11px] text-spotifyGreen font-semibold">₪${fmt(i.cost)}</div>
              <div class="text-[10px] text-gray-400">${i.desc}</div>
            </div>
            ${own ? '<span class="text-[11px] text-spotifyGreen font-bold shrink-0">✓ שלך</span>'
              : `<button onclick="buyItem('${i.id}')" class="${afford ? 'bg-spotifyGreen text-black hover:bg-green-600' : 'bg-gray-800 text-gray-500'} text-xs font-bold px-3 py-1.5 rounded-xl transition shrink-0">קנה</button>`}
          </div>`;
        }).join('')}
      </div>`).join('');
    }

    function renderComments() {
      $('insta-comments-feed').innerHTML = state.comments.length
        ? state.comments.slice(0, 8).map(c => `<div class="bg-gray-900/60 p-2.5 rounded-xl border border-gray-800"><span class="font-bold ${c.c}" dir="ltr">@${esc(c.u)}:</span> ${esc(c.t)}</div>`).join('')
        : '<div class="text-gray-500">עוד אין תגובות. הקלט שיר או העלה סטורי!</div>';
    }

    // ---------- Navigation ----------
    function navTo(screen) {
      document.querySelectorAll('main > section').forEach(s => s.classList.add('hidden'));
      document.querySelectorAll('nav > button').forEach(b => { b.classList.remove('nav-active'); b.classList.add('text-gray-400'); });
      $(`screen-${screen}`).classList.remove('hidden');
      $(`nav-${screen}`).classList.add('nav-active');
      $('main-content').scrollTop = 0;
    }
    function switchSocialTab(sub) {
      const insta = sub === 'insta';
      $('subtab-insta').classList.toggle('hidden', !insta);
      $('subtab-tinder').classList.toggle('hidden', insta);
      $('btn-subtab-insta').className = `flex-1 py-1.5 text-xs font-bold rounded-lg transition ${insta ? 'bg-gray-800 text-white' : 'text-gray-400 hover:text-white'}`;
      $('btn-subtab-tinder').className = `flex-1 py-1.5 text-xs font-bold rounded-lg transition ${!insta ? 'bg-gray-800 text-white' : 'text-gray-400 hover:text-white'}`;
      if (!insta) renderTinderCard();
    }

    // ---------- Start / settings ----------
    function showStartScreen() {
      $('start-city').innerHTML = CITIES.map(c => `<option>${c}</option>`).join('');
      $('start-screen').classList.remove('hidden');
    }
    function startNewGame() {
      const name = $('start-name').value.trim().slice(0, 20) || 'MC IL';
      const handle = ($('start-handle').value.trim().replace(/[^a-zA-Z0-9_.]/g, '').slice(0, 20)) || 'artist_il';
      state = newState(name, handle, $('start-city').value, $('start-perk').value);
      addComments('small', 2);
      $('start-screen').classList.add('hidden');
      navTo('dashboard');
      updateUI();
    }
    function openSettings() {
      showModal({
        title: '⚙️ הגדרות',
        html: `<div class="space-y-1">
          <div>🎤 ${esc(state.artistName)} · <span dir="ltr">@${esc(state.handle)}</span> · ${esc(state.city)}</div>
          <div>📅 שבוע ${state.totalWeeks} בקריירה</div>
          <div>🏆 ${state.achievements.length}/${ACHIEVEMENTS.length} הישגים</div>
          <div class="text-gray-500 pt-2">המשחק נשמר אוטומטית בדפדפן.</div></div>`,
        buttons: [
          { t: 'משחק חדש', primary: false, fn: confirmNewGame },
          { t: 'סגור' },
        ],
      });
    }
    function confirmNewGame() {
      showModal({
        title: 'להתחיל משחק חדש?',
        html: 'כל ההתקדמות הנוכחית תימחק לצמיתות.',
        buttons: [
          { t: 'כן, מחק והתחל מחדש', fn: () => { try { localStorage.removeItem(SAVE_KEY); } catch (e) {} showStartScreen(); } },
          { t: 'ביטול', primary: false },
        ],
      });
    }

    window.onload = function () {
      state = loadState();
      if (!state) {
        state = newState('MC IL', 'artist_il', 'תל אביב', null);
        state.started = false;
        updateUI();
        showStartScreen();
      } else {
        updateUI();
      }
    };
  </script>
</body>
</html>
