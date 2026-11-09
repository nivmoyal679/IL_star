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
        version: 3,
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
        albums: [], job: null, jobOffers: null, investments: {}, invLast: {}, teams: {},
        inbox: [], history: [], income: {}, weekIncome: 0, lastWeekIncome: 0,
        tiktokFollowers: 40, ytSubs: 10, posts: [], tiktoks: [],
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
        releaseTotalWeek: song.releaseWeek || 1, explicit: true, albumId: null,
      }, song, { genre: GENRES.includes(song.genre) ? song.genre : GENRES[2] }));
      if (s.relationship && !s.relationship.trait) out.relationship = null;
      if (!out.trend) out.trend = newTrend(-1);
      if (!out.chart) out.chart = initChart();
      out.baseEnergy = BASE_ENERGY;
      if (!out.history.length) out.history = [{ w: out.totalWeeks, l: out.listeners, f: out.followers }];
      out.version = 3;
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

    // ---------- Money tracking ----------
    // Every income goes through earn() so the money screen can show yearly and weekly income
    function earn(amount) {
      state.money += amount;
      if (amount > 0) {
        state.income[state.year] = (state.income[state.year] || 0) + amount;
        state.weekIncome += amount;
      }
    }

    // ---------- Actions ----------
    function needEnergy(n) {
      if (state.energy < n) { showToast('אין מספיק אנרגיה השבוע!', false); return false; }
      return true;
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
      const gain = Math.max(15, Math.floor(Math.min(v.req * 0.05, Math.sqrt(v.req) * 15) * perf));
      earn(pay);
      state.followers += gain;
      state.stats.gigs[id] = (state.stats.gigs[id] || 0) + 1;
      state.logs.push(`הופעת ב${v.name}! הרווחת ₪${fmt(pay)} ו-${fmt(gain)} עוקבים.`);
      addComments('gig', 2, { venue: v.name });
      addPost('gig', `לילה מטורף ב${v.name} 🎤`);
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
      addPost('item', `תתחדש עליי: ${item.name} ✨`);
      showToast(`תתחדש על ה${item.name}!`);
      updateUI();
    }

    // ---------- Job contracts ----------
    function jobEligible(j) {
      const r = j.req || {};
      if (r.followers && state.followers < r.followers) return false;
      return Object.keys(SKILL_CAP).every(k => !r[k] || state.skills[k] >= r[k]);
    }
    function genJobOffers() {
      const pool = JOBS.filter(jobEligible);
      const offers = [];
      while (offers.length < 3 && offers.length < pool.length) {
        const j = pick(pool);
        if (offers.some(o => o.id === j.id)) continue;
        offers.push({ id: j.id, pay: Math.round(j.pay * (0.9 + Math.random() * 0.2) / 10) * 10, weeks: rnd(4, 12) });
      }
      return { week: state.totalWeeks, offers };
    }
    function openJobOffers() {
      if (!state.jobOffers || state.jobOffers.week !== state.totalWeeks) state.jobOffers = genJobOffers();
      const html = state.jobOffers.offers.map((o, i) => {
        const j = JOBS.find(x => x.id === o.id);
        const perk = j.perk ? ` · משפר ${Object.keys(j.perk).map(k => SKILL_SHORT[k]).join(', ')}` : '';
        return `<div class="bg-gray-900/60 border border-gray-800 rounded-xl p-3 mb-2">
          <div class="font-bold text-white text-sm"><i class="fa-solid ${j.icon} ml-1"></i>${j.name}</div>
          <div class="text-gray-400 mt-1">₪${fmt(o.pay)} לשבוע · ${j.e} אנרגיה בשבוע · חוזה ל-${o.weeks} שבועות${perk}</div>
        </div>`;
      }).join('') + '<div class="text-[10px] text-gray-500">הצעות חדשות מגיעות כל שבוע. אפשר להתפטר בכל רגע.</div>';
      showModal({
        title: '💼 הצעות עבודה',
        html,
        buttons: state.jobOffers.offers.map((o, i) => ({ t: `קבל: ${JOBS.find(x => x.id === o.id).name}`, primary: i === 0, fn: () => acceptJob(i) }))
          .concat([{ t: 'סגור', primary: false }]),
      });
    }
    function acceptJob(i) {
      const o = state.jobOffers.offers[i];
      const j = JOBS.find(x => x.id === o.id);
      state.job = { id: o.id, pay: o.pay, weeksLeft: o.weeks };
      state.stats.jobs = (state.stats.jobs || 0) + 1;
      state.jobOffers.offers.splice(i, 1);
      // The first week's energy is taken right away
      state.energy = Math.max(0, state.energy - j.e);
      state.logs.push(`התחלת לעבוד כ${j.name}: ₪${fmt(o.pay)} לשבוע, ${o.weeks} שבועות.`);
      showToast(`התחלת לעבוד כ${j.name}!`);
      updateUI();
    }
    function quitJob() {
      if (!state.job) return;
      const j = JOBS.find(x => x.id === state.job.id);
      state.logs.push(`התפטרת מהעבודה כ${j.name}.`);
      state.job = null;
      showToast('התפטרת. עכשיו רק מוזיקה!');
      updateUI();
    }
    function jobEnergy() {
      return state.job ? JOBS.find(x => x.id === state.job.id).e : 0;
    }

    // ---------- Investments & teams ----------
    function gauss() {
      let u = 0, v = 0;
      while (u === 0) u = Math.random();
      while (v === 0) v = Math.random();
      return Math.sqrt(-2 * Math.log(u)) * Math.cos(2 * Math.PI * v);
    }
    function invest(id, amount) {
      if (amount === 'all') amount = Math.max(0, state.money);
      if (amount <= 0 || state.money < amount) { showToast('אין מספיק כסף!', false); return; }
      state.money -= amount;
      state.investments[id] = (state.investments[id] || 0) + amount;
      showToast(`השקעת ₪${fmt(amount)}`);
      updateUI();
    }
    function sellInvestment(id) {
      const v = Math.floor(state.investments[id] || 0);
      if (!v) return;
      state.money += v;
      delete state.investments[id];
      showToast(`מכרת ב-₪${fmt(v)}`);
      updateUI();
    }
    function buyTeam(id) {
      const t = TEAMS.find(x => x.id === id);
      if (state.teams[id]) return;
      if (state.money < t.cost) { showToast('אין מספיק כסף!', false); return; }
      state.money -= t.cost;
      state.teams[id] = { value: t.cost, last: null };
      state.logs.push(`🏟️ קנית את ${t.name}!`);
      addPost('item', `גאה להיות הבעלים החדשים של ${t.name} ⚽`);
      showToast(`קנית את ${t.name}!`);
      updateUI();
    }
    function sellTeam(id) {
      const t = TEAMS.find(x => x.id === id);
      const v = Math.floor(state.teams[id].value * 0.95);
      state.money += v;
      delete state.teams[id];
      state.logs.push(`מכרת את ${t.name} ב-₪${fmt(v)}.`);
      updateUI();
    }
    function tickInvestments(lines) {
      state.invLast = {};
      INVESTMENTS.forEach(inv => {
        if (!state.investments[inv.id]) return;
        const r = inv.mu + inv.vol * gauss();
        const before = state.investments[inv.id];
        state.investments[inv.id] = Math.max(0, before * (1 + r));
        state.invLast[inv.id] = r;
      });
      const invDelta = INVESTMENTS.reduce((a, inv) => a + (state.investments[inv.id] ? state.investments[inv.id] * state.invLast[inv.id] / (1 + state.invLast[inv.id]) : 0), 0);
      if (Math.abs(invDelta) >= 1) lines.push(`📈 השקעות: <b class="${invDelta >= 0 ? 'text-spotifyGreen' : 'text-red-400'}">${invDelta >= 0 ? '+' : '-'}₪${fmt(Math.abs(invDelta))}</b>`);
      TEAMS.forEach(t => {
        const own = state.teams[t.id];
        if (!own) return;
        const roll = Math.random();
        const res = roll < 0.4 ? 'win' : roll < 0.65 ? 'draw' : 'loss';
        const inc = Math.round(t.income * (res === 'win' ? 1.6 : res === 'draw' ? 0.6 : -0.7));
        if (inc >= 0) earn(inc); else state.money += inc;
        own.value = Math.max(t.cost * 0.4, own.value * (1 + (res === 'win' ? 0.012 : res === 'loss' ? -0.01 : 0.002) + 0.01 * gauss()));
        own.last = res;
        state.followers += t.fans * (res === 'win' ? 2 : 1);
        lines.push(`${res === 'win' ? '🏆' : res === 'draw' ? '🤝' : '😞'} ${t.name}: ${res === 'win' ? 'ניצחון' : res === 'draw' ? 'תיקו' : 'הפסד'} (${inc >= 0 ? '+' : '-'}₪${fmt(Math.abs(inc))})`);
      });
    }
    function netWorth() {
      const inv = Object.values(state.investments).reduce((a, b) => a + b, 0);
      const teams = Object.values(state.teams).reduce((a, b) => a + b.value, 0);
      const items = state.inventory.reduce((a, id) => a + SHOP.find(i => i.id === id).cost * 0.5, 0);
      return { total: state.money + inv + teams + items, inv, teams, items };
    }

    // ---------- Studio ----------
    function availableFeats() {
      return RAPPERS.filter(r => state.followers >= FEAT_TIERS[r.t].req && !state.beefs.includes(r.n))
        .sort((a, b) => a.t - b.t || a.n.localeCompare(b.n));
    }
    function homeStudioLevel() { return 10 + effect('studio'); }
    function writerLevel(w) { return w.id === 'self' ? state.skills.flow : w.lvl; }
    function studioLevel(s) { return s.id === 'home' ? homeStudioLevel() : s.lvl; }
    function componentOptions(list, levelFn) {
      return list.map(x => {
        const locked = state.followers < x.req;
        return `<option value="${x.id}" ${locked ? 'disabled' : ''}>${x.name} · רמה ${levelFn(x)} · ${x.cost ? '₪' + fmt(x.cost) : 'חינם'}${locked ? ` (🔒 ${fmt(x.req)} עוקבים)` : ''}</option>`;
      }).join('');
    }
    let songExplicit = true;
    function setExplicit(v) { songExplicit = v; updateSongCost(); }
    function openNewSongModal() {
      if (state.energy < 10) { showToast('נדרשת לפחות 10 אנרגיה להקלטה!', false); return; }
      $('input-song-genre').innerHTML = GENRES.map((g, i) =>
        `<option value="${esc(g)}">${esc(g)}${i === state.trend.hot ? ' 🔥 בטרנד' : i === state.trend.cold ? ' ❄️ יורד' : ''}</option>`).join('');
      $('input-song-genre').value = GENRES[state.trend.hot];
      $('input-song-album').innerHTML = '<option value="">סינגל (בלי אלבום)</option>' +
        state.albums.filter(a => !a.released).map(a => `<option value="${a.id}">אלבום: ${esc(a.name)} (${albumTracks(a.id).length} שירים)</option>`).join('') +
        '<option value="new">+ אלבום חדש</option>';
      $('input-song-writer').innerHTML = componentOptions(WRITERS, writerLevel);
      $('input-song-producer').innerHTML = componentOptions(PRODUCER_TIERS, x => x.lvl);
      $('input-song-studio').innerHTML = componentOptions(STUDIOS, studioLevel);
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
      const genre = $('input-song-genre').value;
      const writer = WRITERS.find(x => x.id === $('input-song-writer').value) || WRITERS[0];
      const producer = PRODUCER_TIERS.find(x => x.id === $('input-song-producer').value) || PRODUCER_TIERS[0];
      const studio = STUDIOS.find(x => x.id === $('input-song-studio').value) || STUDIOS[0];
      const clip = $('input-song-clip').value;
      const album = $('input-song-album').value;
      const featName = $('input-song-feat').value;
      const feat = featName ? RAPPERS.find(r => r.n === featName) : null;
      const tier = feat ? FEAT_TIERS[feat.t] : null;
      const clipCost = clip === 'lyric' ? 400 : clip === 'pro' ? 5000 : 0;
      const cost = writer.cost + producer.cost + studio.cost + clipCost + (tier ? tier.cost : 0);
      // Quality multiplier from the three components
      const qm = 0.3 + (writerLevel(writer) * 1.2 + producer.lvl + studioLevel(studio) * 0.8) / 45;
      return { genre, writer, producer, studio, clip, album, feat, tier, cost, qm, explicit: songExplicit };
    }
    function updateSongCost() {
      const c = songChoices();
      $('input-album-name').classList.toggle('hidden', c.album !== 'new');
      $('song-perform-line').innerHTML = `🎤 ביצוע: אתה (פלוואו ${state.skills.flow}, כריזמה ${state.skills.charisma})`;
      const on = 'bg-spotifyGreen text-black border-spotifyGreen', off = 'bg-gray-900 text-gray-400 border-gray-700';
      $('btn-clean').className = `py-2 rounded-xl font-bold border ${!c.explicit ? on : off}`;
      $('btn-explicit').className = `py-2 rounded-xl font-bold border ${c.explicit ? 'bg-red-500 text-white border-red-500' : off}`;
      $('btn-clean').innerText = 'גרסה נקייה';
      $('btn-explicit').innerHTML = 'בוטה 🅴';
      $('explicit-note').innerText = c.explicit ? 'בוטה: +10% השמעות ועוקבים, אבל לא ייכנס לרדיו' : 'נקייה: +40% מאזינים חודשיים מהרדיו';
      const lines = [`עלות: <b class="text-white">₪${fmt(c.cost)}</b> | אנרגיה: <b class="text-white">10</b>`];
      const tm = trendMult(c.genre);
      if (tm > 1) lines.push('🔥 הז׳אנר בטרנד: +40% השמעות');
      if (tm < 1) lines.push('❄️ הז׳אנר יוצא מהאופנה: -30% השמעות');
      if (c.feat) lines.push(`🤝 פיצ׳ר: +${Math.round(c.tier.boost * (c.feat.g === GENRES.indexOf(c.genre) ? 1.25 : 1) * 100)}% השמעות${c.feat.g === GENRES.indexOf(c.genre) ? ' (אותו ז׳אנר!)' : ''}`);
      if (state.socialThisWeek.release) lines.push(`<span class="text-accentOrange">כבר שחררת השבוע: השיר הזה יקבל ${Math.round(100 / (state.socialThisWeek.release + 1))}% מתשומת הלב</span>`);
      if (state.money < c.cost) lines.push('<span class="text-red-400">אין מספיק כסף</span>');
      $('song-cost-summary').innerHTML = lines.join('<br>');
    }

    function confirmCreateSong() {
      const c = songChoices();
      const title = $('input-song-title').value.trim().slice(0, 32);
      if (!title) { showToast('חובה להזין שם!', false); return; }
      let albumId = c.album || null;
      if (c.album === 'new') {
        const name = $('input-album-name').value.trim().slice(0, 28);
        if (!name) { showToast('תן שם לאלבום החדש!', false); return; }
        albumId = null; // created below, once the song is paid for
      }
      if (state.energy < 10) { showToast('נדרשת 10 אנרגיה!', false); return; }
      if (state.money < c.cost) { showToast('אין מספיק כסף להפקה!', false); return; }

      state.money -= c.cost;
      state.energy -= 10;
      if (c.album === 'new') {
        const a = { id: 'a' + state.totalWeeks + '_' + state.albums.length, name: $('input-album-name').value.trim().slice(0, 28), released: false };
        state.albums.push(a);
        albumId = a.id;
        $('input-album-name').value = '';
      }

      let q = c.qm;
      const pt = partnerTrait();
      if (pt && pt.id === 'smart') q *= 1.05;
      const featBoost = c.tier ? c.tier.boost * (c.feat.g === GENRES.indexOf(c.genre) ? 1.25 : 1) : 0;
      const tm = trendMult(c.genre);
      const luck = Math.random() * 0.5 + 0.8;
      // Each extra release in the same week gets less attention (1, 1/2, 1/3...)
      const n = state.socialThisWeek.release || 0;
      state.socialThisWeek.release = n + 1;
      const releaseFatigue = 1 / (n + 1);
      const explicitMult = c.explicit ? 1.1 : 1;
      const raw = (state.skills.flow * 120 + state.skills.charisma * 80 + state.followers * 0.15) * q * (1 + featBoost) * luck * releaseFatigue * explicitMult;
      const initial = Math.floor(raw * tm);

      let yt = 0;
      const clipMult = (1 + effect('clip')) * (pt && (pt.id === 'artist' || pt.id === 'influencer') ? 1.3 : 1);
      if (c.clip === 'lyric') yt = Math.floor(initial * 0.5 * clipMult);
      if (c.clip === 'pro') yt = Math.floor((initial * 2.0 + state.skills.video * 600) * clipMult);

      const song = {
        title, genre: c.genre, isAlbum: false, albumId, feat: c.feat ? c.feat.n : null, clip: c.clip, explicit: c.explicit,
        writer: c.writer.name, producer: c.producer.name, studio: c.studio.name,
        streams: initial, base: Math.floor(raw), lastWeek: initial, ytViews: yt,
        releaseWeek: state.week, releaseTotalWeek: state.totalWeeks, prevPos: null, peak: null,
      };
      state.songs.push(song);
      state.listeners += Math.floor(initial / 3.5 * (c.explicit ? 1 : 1.4));
      state.youtubeViews += yt;
      // New fans from a release grow with sqrt(followers), so big artists can't snowball forever
      const newFans = Math.floor(Math.min(initial / 15, Math.sqrt(state.followers) * 8 + 300) * explicitMult);
      state.followers += newFans;
      earn(Math.floor(initial * ROYALTY_PER_STREAM));
      if (c.feat) { state.stats.feats++; state.stats.featTop = Math.max(state.stats.featTop, c.feat.t); }
      recordChartStats();

      // Fan reaction depends on how the song did relative to the artist's usual level
      const score = q * (1 + featBoost) * tm * luck;
      const kind = score >= 2.2 ? 'songGood' : score >= 1.1 ? 'songMid' : 'songBad';
      addComments(kind, 3, { song: title, genre: c.genre });
      addPost('song', `"${title}" בחוץ עכשיו בכל הפלטפורמות 🎶`);

      const pos = myChartPositions()[state.songs.length - 1];
      const album = albumId ? state.albums.find(a => a.id === albumId) : null;
      state.logs.push(`השיר "${esc(title)}"${c.feat ? ` (פיט׳ ${esc(c.feat.n)})` : ''} שוחרר! ${fmt(initial)} השמעות בשבוע הראשון.`);
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
          ${album ? `<div>💿 נוסף לאלבום "${esc(album.name)}" (${albumTracks(album.id).length} שירים)</div>` : ''}
          <div>📊 ${pos && pos <= 50 ? `נכנס למצעד במקום <b class="text-spotifyGreen">#${pos}</b>!` : 'עוד לא במצעד הטופ 50'}</div>
          <div class="text-gray-400 pt-1">${kind === 'songGood' ? '🔥 הקהל משתגע על השיר!' : kind === 'songMid' ? '👍 תגובות סבירות.' : '😬 הקהל לא התחבר...'}</div>
        </div>`,
        buttons: [{ t: 'סבבה' }],
      });
    }

    // ---------- Albums ----------
    const ALBUM_MIN_TRACKS = 4;
    function albumTracks(id) { return state.songs.filter(s => s.albumId === id); }
    function releaseAlbum(id) {
      const a = state.albums.find(x => x.id === id);
      const tracks = albumTracks(id);
      if (tracks.length < ALBUM_MIN_TRACKS) { showToast(`צריך לפחות ${ALBUM_MIN_TRACKS} שירים באלבום!`, false); return; }
      if (!needEnergy(10)) return;
      state.energy -= 10;
      // Album release revives every track and sells copies
      tracks.forEach(s => { s.base *= 1.5; s.releaseTotalWeek = Math.max(s.releaseTotalWeek, state.totalWeeks - 1); });
      const sales = Math.floor(tracks.reduce((x, s) => x + s.base, 0) * 0.03);
      const fans = Math.floor(Math.min(Math.sqrt(state.followers) * 15 + 500, tracks.reduce((x, s) => x + s.base, 0) / 20));
      earn(sales);
      state.followers += fans;
      a.released = true;
      a.week = state.totalWeeks;
      a.sales = sales;
      state.logs.push(`💿 האלבום "${esc(a.name)}" יצא! ${tracks.length} שירים, ₪${fmt(sales)} ממכירות.`);
      addPost('song', `האלבום "${a.name}" בחוץ 💿 תודה לכל מי שהיה איתי בדרך`);
      addComments('songGood', 3, { song: a.name });
      updateUI();
      showModal({ title: `💿 "${esc(a.name)}" יצא!`, html: `<div class="space-y-1.5"><div>💰 +₪${fmt(sales)} ממכירות</div><div>👥 +${fmt(fans)} עוקבים</div><div>🎧 כל ${tracks.length} השירים באלבום קיבלו בוסט של 50% להשמעות</div></div>`, buttons: [{ t: 'יאללה!' }] });
    }

    // ---------- Social ----------
    function addPost(type, text) {
      const likes = Math.floor(state.followers * (0.04 + Math.random() * 0.1) + rnd(3, 20));
      state.posts.unshift({ type, text, likes, w: state.totalWeeks });
      state.posts = state.posts.slice(0, 30);
    }
    function postInstaStory() {
      if (!needEnergy(3)) return;
      state.energy -= 3;
      const gain = Math.floor((Math.random() * 40 + 20 + state.skills.charisma + Math.sqrt(state.followers) * 1.2) * socialFatigue('story') * (1 + effect('social')));
      state.followers += gain;
      state.stats.stories = (state.stats.stories || 0) + 1;
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
        addPost('beef', `${target.n}, תקשיב טוב 🔥`);
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
      state.tiktokFollowers += Math.floor(boost * 2.5);
      const song = state.songs.length ? state.songs[state.songs.length - 1] : null;
      if (song) song.base *= 1.03;
      const views = Math.floor(boost * rnd(15, 60));
      state.tiktoks.unshift({ t: song ? `אתגר "${song.title}"` : pick(['פריסטייל במטבח', 'ביט על שולחן', 'יום באולפן', 'לפני ההופעה']), v: views, l: Math.floor(views * (0.05 + Math.random() * 0.1)) });
      state.tiktoks = state.tiktoks.slice(0, 24);
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
    function swipeTinder(isLike) {
      const p = state.tinderProfile;
      const card = $('tinder-card');
      if (card) card.classList.add(isLike ? 'anim-swipe-right' : 'anim-swipe-left');
      setTimeout(() => {
        if (isLike) {
          if (Math.random() < matchChance(p)) {
            const tr = TRAITS.find(t => t.id === p.trait);
            state.stats.matches++;
            state.relationship = Object.assign({}, p, { loyalty: tr.start + rnd(0, 15), weeks: 0 });
            state.logs.push(`מאצ׳ חדש! התחלת לצאת עם ${p.name} (${tr.name}).`);
            addPost('rel', `❤️`);
            showToast(`Match! 🔥 יצאת לדרך עם ${p.name}`);
          } else {
            showToast('אין מאצ׳...', false);
          }
        }
        state.tinderProfile = genProfile();
        updateUI();
      }, card ? 250 : 0);
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
        addInboxMessage(r.name, `אני לא יכולה ככה יותר. אתה לא שם לב אליי בכלל. נגמר. 💔`);
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
      if (fx.m) { earn(fx.m); parts.push(`${fx.m >= 0 ? '+' : '-'}₪${fmt(Math.abs(fx.m))}`); }
      if (fx.ms) { const d = Math.round(fx.ms * moneyScale()); earn(d); parts.push(`${d >= 0 ? '+' : '-'}₪${fmt(Math.abs(d))}`); }
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
    function choiceChance(ch) {
      return Math.min(0.9, ch.p + (ch.ps ? (state.skills[ch.ps] || 0) / 150 : 0));
    }

    // ---------- Inbox (WhatsApp) ----------
    // Events arrive as chats; you answer them whenever you want (within 3 weeks)
    const INBOX_EXPIRY = 3;
    function eventSender(ev, ctx) {
      return ctx.partner || ctx.rapper || ctx.producer || ctx.media || ctx.brand || ctx.label || ctx.friend || 'הסוכן שלך';
    }
    function rollEvent() {
      if (Math.random() > 0.65) return null;
      const pool = eventPool();
      if (!pool.length) return null;
      const ev = pick(pool);
      state.recentEvents.push(ev.id);
      state.recentEvents = state.recentEvents.slice(-30);
      const ctx = makeCtx(ev);
      const item = { id: 'm' + state.totalWeeks + '_' + rnd(0, 99999), kind: 'event', evId: ev.id, ctx, from: eventSender(ev, ctx), w: state.totalWeeks, read: false, done: false };
      state.inbox.unshift(item);
      state.inbox = state.inbox.slice(0, 40);
      return item;
    }
    function addInboxMessage(from, text) {
      state.inbox.unshift({ id: 'm' + state.totalWeeks + '_' + rnd(0, 99999), kind: 'msg', from, text, w: state.totalWeeks, read: false, done: true });
      state.inbox = state.inbox.slice(0, 40);
    }
    function unreadCount() { return state.inbox.filter(m => !m.read).length; }
    function pendingCount() { return state.inbox.filter(m => m.kind === 'event' && !m.done).length; }
    function expireInbox() {
      state.inbox.forEach(m => {
        if (m.kind === 'event' && !m.done && state.totalWeeks - m.w >= INBOX_EXPIRY) {
          m.done = true;
          m.expired = true;
          m.result = 'לא ענית בזמן. ההזדמנות עברה.';
        }
      });
    }
    function answerInbox(id, choiceIdx) {
      const m = state.inbox.find(x => x.id === id);
      if (!m || m.done) return;
      const ev = EVENTS.find(e => e.id === m.evId);
      const ch = ev.ch[choiceIdx];
      if (!canPay(ch.cost)) { showToast('אין מספיק כסף או אנרגיה!', false); return; }
      payCost(ch.cost);
      let out = ch;
      if (ch.p !== undefined) out = Math.random() < choiceChance(ch) ? ch.win : ch.lose;
      const fxText = applyFx(out.fx, m.ctx);
      const result = fillTemplate(out.r || '', m.ctx);
      m.done = true;
      state.stats.answered = (state.stats.answered || 0) + 1;
      m.reply = fillTemplate(ch.t, m.ctx);
      m.result = result;
      m.fxText = fxText;
      state.logs.push(`⚡ ${esc(fillTemplate(ev.t, m.ctx))}: ${esc(result)}${fxText ? ` (${fxText})` : ''}`);
      updateUI();
    }

    // ---------- Week ----------
    function nextWeek() {
      const lines = [];
      tickChart(); // stores last week's positions first

      state.totalWeeks = (state.totalWeeks || state.week) + 1;
      state.week++;
      if (state.week > 52) { state.week = 1; state.year++; }
      state.lastWeekIncome = state.weekIncome;
      state.weekIncome = 0;
      state.gigsThisWeek = [];
      state.socialThisWeek = {};
      state.dateThisWeek = false;

      let royalties = 0, newListeners = 0, totalWeekly = 0, ytWeek = 0;
      state.songs.forEach(song => {
        const age = state.totalWeeks - (song.releaseTotalWeek || 1);
        const decay = Math.max(0.03, Math.pow(0.85, age));
        const weekly = Math.floor((song.base * 0.35 + state.followers * 0.4) * decay * trendMult(song.genre) * (0.85 + Math.random() * 0.3));
        const ytRate = song.clip === 'pro' ? 0.6 : song.clip === 'lyric' ? 0.2 : 0.03;
        const yt = Math.floor(weekly * ytRate);
        song.streams += weekly;
        song.lastWeek = weekly;
        song.ytViews += yt;
        ytWeek += yt;
        totalWeekly += weekly;
        royalties += Math.floor(weekly * ROYALTY_PER_STREAM);
        newListeners += Math.floor(weekly * 0.18 * (song.explicit === false ? 1.4 : 1));
      });
      earn(royalties);
      state.youtubeViews += ytWeek;
      state.ytSubs += Math.floor(ytWeek * 0.004);
      state.tiktokFollowers -= Math.floor(state.tiktokFollowers * 0.01);
      state.listeners = Math.floor(state.listeners * 0.88) + newListeners;
      state.followers += Math.floor(Math.min(totalWeekly * 0.01, state.followers * 0.015 + 200));
      state.followers -= Math.floor(state.followers * 0.01);
      const rent = weeklyRent();
      state.money -= rent;

      lines.push(`🎧 ${fmt(totalWeekly)} השמעות → <b class="text-spotifyGreen">+₪${fmt(royalties)}</b> תמלוגים`);

      // Job contract: pay for the week that just ended, take this week's energy
      let energy = maxEnergy();
      if (state.job) {
        const j = JOBS.find(x => x.id === state.job.id);
        earn(state.job.pay);
        lines.push(`💼 משכורת מ${j.name}: <b class="text-spotifyGreen">+₪${fmt(state.job.pay)}</b>`);
        if (j.perk) Object.entries(j.perk).forEach(([k, chance]) => {
          if (Math.random() < chance && state.skills[k] < SKILL_CAP[k]) { state.skills[k]++; lines.push(`📚 למדת בעבודה: +1 ${SKILL_SHORT[k]}`); }
        });
        state.job.weeksLeft--;
        if (state.job.weeksLeft <= 0) {
          lines.push(`📄 החוזה ב${j.name} הסתיים.`);
          addInboxMessage('הבוס', `החוזה שלך הסתיים. תודה על העבודה! אם תרצה לחזור, תחפש אותנו בהצעות העבודה.`);
          state.logs.push(`החוזה כ${j.name} הסתיים.`);
          state.job = null;
        } else {
          energy -= j.e;
        }
      }
      state.energy = Math.max(0, energy);
      lines.push(`🏠 הוצאות מחיה: <b class="text-red-400">-₪${fmt(rent)}</b>`);

      tickInvestments(lines);
      recordChartStats();
      const best = bestMyPos();
      lines.push(`📊 ${best && best <= 50 ? `השיר הכי גבוה שלך במצעד: <b class="text-spotifyGreen">#${best}</b>` : 'אין לך שיר בטופ 50'}`);

      state.trend.weeksLeft--;
      if (state.trend.weeksLeft <= 0) {
        state.trend = newTrend(state.trend.hot);
        lines.push(`🔥 טרנד חדש: <b class="text-accentOrange">${GENRES[state.trend.hot]}</b> חם, ${GENRES[state.trend.cold]} יורד`);
        state.logs.push(`🔥 טרנד חדש בסצנה: ${GENRES[state.trend.hot]} הכי חם עכשיו.`);
      }

      tickRelationship(lines);
      if (state.money < 0) {
        lines.push(`<span class="text-red-400">⚠️ החשבון במינוס! תמצא עבודה.</span>`);
        state.logs.push(`⚠️ החשבון במינוס (${money(state.money)}).`);
      }

      addComments(state.followers < 2000 ? 'small' : state.followers > 100000 ? 'big' : 'general', 1);
      if (state.relationship && Math.random() < 0.4) addComments('rel', 1);

      expireInbox();
      const event = rollEvent();
      if (event) lines.push(`📩 <b class="text-[#25D366]">הודעה חדשה ב-WhatsApp מ${esc(event.from)}</b>`);
      const pending = pendingCount();

      state.history.push({ w: state.totalWeeks, l: state.listeners, f: state.followers });
      state.history = state.history.slice(-30);

      updateUI();
      showModal({
        title: `📅 שבוע ${state.week}, ${state.year}`,
        html: `<div class="space-y-1.5">${lines.map(l => `<div>${l}</div>`).join('')}</div>`,
        buttons: pending
          ? [{ t: `פתח WhatsApp (${pending} מחכות לתשובה)`, fn: () => openApp('whatsapp') }, { t: 'אחר כך', primary: false }]
          : [{ t: 'המשך' }],
      });
    }

    // ---------- Achievements ----------
    function checkAchievements() {
      ACHIEVEMENTS.forEach(a => {
        if (state.achievements.includes(a.id) || !a.test(state)) return;
        state.achievements.push(a.id);
        const rw = [];
        if (a.rw.m) { earn(a.rw.m); rw.push(`+₪${fmt(a.rw.m)}`); }
        if (a.rw.f) { state.followers += a.rw.f; rw.push(`+${fmt(a.rw.f)} עוקבים`); }
        state.logs.push(`🏆 הישג חדש: ${a.n}! (${rw.join(', ')})`);
        showToast(`🏆 הישג: ${a.n} ${rw.join(', ')}`);
      });
    }

    // ---------- Rendering ----------
    const FAME_STEPS = [[0, 'F'], [500, 'D'], [2500, 'C'], [10000, 'B'], [50000, 'A'], [100000, 'S+'], [1000000, 'S+']];
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
      $('dash-verified').classList.toggle('hidden', !state.verified);
      renderFame();
      renderAppGrid();
      renderGraph();

      $('trend-hot').innerText = GENRES[state.trend.hot];
      $('trend-cold').innerText = GENRES[state.trend.cold];
      $('trend-weeks').innerText = `מתחלף בעוד ${state.trend.weeksLeft} שבועות`;

      renderSkills();
      renderStudio();
      renderMyChartLine();
      renderAchievements();
      renderGigs();
      renderMoney();
      renderShop();
      if (currentApp) renderApp();

      $('dash-logs').innerHTML = state.logs.slice(-6).reverse().map(l => `<li class="bg-gray-900/60 p-2.5 rounded-lg border border-gray-800">${l}</li>`).join('');
      state.logs = state.logs.slice(-40);
      saveState();
    }

    function renderFame() {
      const f = state.followers;
      let i = 0;
      while (i < FAME_STEPS.length - 2 && f >= FAME_STEPS[i + 1][0]) i++;
      const [lo] = FAME_STEPS[i], [hi, nextRank] = FAME_STEPS[i + 1];
      const pct = clamp((f - lo) / (hi - lo) * 100, 0, 100);
      $('fame-rank').innerText = fameRank();
      $('fame-bar').style.width = pct + '%';
      $('fame-next').innerText = f >= 1000000 ? 'אגדה 👑' : `עוד ${fmt(hi - f)} עוקבים לדרגה ${nextRank === fameRank() ? 'הבאה' : nextRank}`;
    }

    function renderGraph() {
      const h = state.history.length ? state.history : [{ l: state.listeners }];
      $('graph-listeners').innerText = fmt(state.listeners);
      const prev = h.length > 1 ? h[h.length - 2].l : 0;
      const d = state.listeners - prev;
      $('graph-delta').innerHTML = h.length > 1 ? `<span class="${d >= 0 ? 'text-spotifyGreen' : 'text-red-400'}">${d >= 0 ? '▲' : '▼'} ${fmt(Math.abs(d))}</span>` : '';
      $('graph-svg').innerHTML = lineChart(h.map(x => x.l), '#ecc94b');
    }
    // Small SVG line chart. Drawn left-to-right in time, so it is flipped for RTL readers.
    function lineChart(values, color) {
      if (values.length < 2) return '<div class="h-full flex items-center justify-center text-[11px] text-gray-500">הגרף יתמלא אחרי כמה שבועות</div>';
      const W = 300, H = 100, pad = 6;
      const min = Math.min(...values), max = Math.max(...values);
      const span = max - min || 1;
      const pts = values.map((v, i) => [pad + i * (W - 2 * pad) / (values.length - 1), H - pad - (v - min) / span * (H - 2 * pad)]);
      const path = pts.map((p, i) => (i ? 'L' : 'M') + p[0].toFixed(1) + ' ' + p[1].toFixed(1)).join(' ');
      const area = path + ` L${pts[pts.length - 1][0].toFixed(1)} ${H} L${pts[0][0].toFixed(1)} ${H} Z`;
      return `<svg viewBox="0 0 ${W} ${H}" preserveAspectRatio="none" class="w-full h-full" style="direction:ltr">
        <path d="${area}" fill="${color}" opacity="0.12"/>
        <path d="${path}" fill="none" stroke="${color}" stroke-width="2.5" vector-effect="non-scaling-stroke" stroke-linejoin="round"/>
        ${pts.map(p => `<circle cx="${p[0].toFixed(1)}" cy="${p[1].toFixed(1)}" r="2.2" fill="${color}"/>`).join('')}
      </svg>`;
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

    function songCard(song, idx, pos) {
      const tm = trendMult(song.genre);
      const p = pos[idx];
      return `<div class="bg-cardDark p-3 rounded-xl border border-gray-800">
        <div class="flex justify-between items-start gap-2">
          <div class="min-w-0">
            <div class="text-xs font-bold text-white flex items-center gap-1.5 flex-wrap">
              <i class="fa-solid fa-music text-spotifyGreen"></i> ${esc(song.title)}
              ${song.explicit ? '<span class="text-[9px] bg-gray-700 text-gray-200 px-1 rounded">E</span>' : ''}
              ${song.isAlbum ? '<span class="text-[10px] bg-gray-800 px-1.5 py-0.5 rounded text-gray-400">אלבום</span>' : ''}
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
    }
    function renderStudio() {
      const pos = myChartPositions();
      $('studio-albums').innerHTML = state.albums.length ? state.albums.slice().reverse().map(a => {
        const tracks = albumTracks(a.id);
        const streams = tracks.reduce((x, s) => x + s.streams, 0);
        const ready = tracks.length >= ALBUM_MIN_TRACKS;
        return `<div class="bg-cardDark p-3 rounded-xl border ${a.released ? 'border-yellow-800/60' : 'border-gray-800'}">
          <div class="flex justify-between items-center gap-2">
            <div class="min-w-0">
              <div class="text-xs font-bold text-white"><i class="fa-solid fa-compact-disc text-goldAccent ml-1"></i>${esc(a.name)}</div>
              <div class="text-[10px] text-gray-400 mt-0.5">${tracks.length} שירים · ${fmt(streams)} השמעות${a.released ? ` · יצא בשבוע ${a.week}` : ''}</div>
            </div>
            ${a.released ? '<span class="text-[11px] text-goldAccent font-bold shrink-0">✓ יצא</span>'
              : `<button onclick="releaseAlbum('${a.id}')" class="${ready ? 'bg-goldAccent text-black' : 'bg-gray-800 text-gray-500'} text-xs font-bold px-3 py-1.5 rounded-xl shrink-0">${ready ? 'שחרר אלבום (10 ⚡)' : `${tracks.length}/${ALBUM_MIN_TRACKS} שירים`}</button>`}
          </div>
        </div>`;
      }).join('') : '<div class="bg-cardDark p-3 rounded-xl border border-gray-800 text-[11px] text-gray-500">אין עדיין אלבומים. בשיר חדש, בחר "+ אלבום חדש" כדי להתחיל לבנות אחד. אחרי 4 שירים אפשר לשחרר אותו.</div>';
      $('studio-songs-list').innerHTML = state.songs.length
        ? state.songs.map((song, idx) => ({ song, idx })).reverse().map(({ song, idx }) => songCard(song, idx, pos)).join('')
        : `<div class="bg-cardDark p-4 rounded-xl border border-gray-800 text-center text-xs text-gray-500 py-6">עדיין לא הקלטת שירים. לחץ על "שיר חדש" להתחלה.</div>`;
    }

    function chartRow(item, idx) {
      const pos = idx + 1;
      let arrow = '<span class="text-[9px] text-cyan-400 font-bold">חדש</span>';
      if (item.prev) {
        const d = item.prev - pos;
        arrow = d > 0 ? `<span class="text-[9px] text-spotifyGreen">▲${d}</span>` : d < 0 ? `<span class="text-[9px] text-red-400">▼${-d}</span>` : '<span class="text-[9px] text-gray-500">=</span>';
      }
      return `<div class="flex items-center justify-between p-2 rounded-lg text-xs ${item.me ? 'bg-[#1DB954]/15' : ''}">
        <div class="flex items-center gap-2 min-w-0">
          <span class="font-bold text-gray-400 w-5 text-center">${pos}</span>
          <span class="w-6 text-center">${arrow}</span>
          <div class="w-9 h-9 rounded bg-gradient-to-br ${item.me ? 'from-[#1DB954] to-emerald-900' : 'from-gray-600 to-gray-800'} flex items-center justify-center text-white/80 shrink-0"><i class="fa-solid fa-music text-[11px]"></i></div>
          <div class="min-w-0">
            <div class="font-bold truncate ${item.me ? 'text-[#1DB954]' : 'text-white'}">${esc(item.s)}</div>
            <div class="text-[10px] text-gray-400 truncate">${esc(item.a)}</div>
          </div>
        </div>
        <div class="text-[11px] text-gray-400 font-medium shrink-0">${shortNum(item.st)}</div>
      </div>`;
    }
    function renderMyChartLine() {
      const rows = combinedChart();
      const pos = myChartPositions();
      const entries = Object.entries(pos).sort((a, b) => a[1] - b[1]);
      let text;
      if (!entries.length) text = 'עוד אין לך שירים. הקלט שיר כדי להיכנס למצעד.';
      else {
        const [idx, p] = entries[0];
        const s = state.songs[idx];
        const need = rows[49] ? rows[49].st : 0;
        text = p <= 50
          ? `השיר הכי גבוה שלך: <b class="text-spotifyGreen">"${esc(s.title)}" במקום #${p}</b>${s.peak ? ` (שיא: #${s.peak})` : ''}`
          : `"${esc(s.title)}" במקום <b>#${p}</b>. עוד ${fmt(need - s.lastWeek)} השמעות שבועיות לטופ 50.`;
      }
      $('dash-my-chart').innerHTML = `<i class="fa-brands fa-spotify text-spotifyGreen text-lg"></i><span class="flex-1">${text}</span><i class="fa-solid fa-chevron-left text-gray-500"></i>`;
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

    function renderGigs() {
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

    function renderMoney() {
      const nw = netWorth();
      $('money-networth').innerText = money(nw.total);
      $('money-breakdown').innerText = `מזומן ${money(state.money)} · השקעות ₪${shortNum(nw.inv)} · קבוצות ₪${shortNum(nw.teams)} · רכוש ₪${shortNum(nw.items)}`;
      const thisYear = state.income[state.year] || 0;
      const lastYear = state.income[state.year - 1] || 0;
      $('money-income').innerHTML = `הרווחת <b class="text-spotifyGreen">₪${fmt(thisYear)}</b> השנה (₪${fmt(state.lastWeekIncome)} בשבוע שעבר). כולל תמלוגים, הופעות, משכורת ומכירות.${lastYear ? ` בשנה שעברה: <b class="text-goldAccent">₪${fmt(lastYear)}</b>.` : ''}`;
      if (lastYear) {
        // Compare with the same point last year
        const pace = thisYear / Math.max(1, state.week) * 52;
        const ch = (pace - lastYear) / lastYear * 100;
        $('money-yoy').innerHTML = `<span class="${ch >= 0 ? 'text-spotifyGreen' : 'text-red-400'}">${ch >= 0 ? '+' : ''}${ch.toFixed(1)}% בקצב שנתי</span>`;
      } else $('money-yoy').innerText = '';

      if (state.job) {
        const j = JOBS.find(x => x.id === state.job.id);
        $('money-job').innerHTML = `<div class="font-bold text-white mb-1"><i class="fa-solid ${j.icon} ml-1"></i>${j.name}</div>
          מרוויח <b class="text-spotifyGreen">₪${fmt(state.job.pay)}</b> לשבוע, נשארו <b>${state.job.weeksLeft}</b> שבועות בחוזה. זה עולה <b class="text-accentOrange">${j.e}</b> אנרגיה כל שבוע.
          <button onclick="quitJob()" class="block mt-2 text-red-400 text-[11px] font-bold hover:underline">התפטר</button>`;
      } else {
        $('money-job').innerHTML = 'אין לך עבודה כרגע. עבודה נותנת משכורת קבועה, אבל לוקחת אנרגיה כל שבוע.';
      }

      $('money-investments').innerHTML = INVESTMENTS.map(inv => {
        const v = state.investments[inv.id] || 0;
        const last = state.invLast && state.invLast[inv.id];
        return `<div class="bg-gray-900/60 border border-gray-800 rounded-xl p-2.5">
          <div class="flex justify-between items-center">
            <div><div class="text-xs font-bold text-white"><i class="fa-solid ${inv.icon} ml-1 text-gray-400"></i>${inv.name}</div>
              <div class="text-[10px] text-gray-500">סיכון: ${inv.risk}</div></div>
            <div class="text-left"><div class="text-xs font-bold text-white">${v ? money(v) : '—'}</div>
              ${v && last !== undefined ? `<div class="text-[10px] ${last >= 0 ? 'text-spotifyGreen' : 'text-red-400'}">${last >= 0 ? '▲' : '▼'} ${(Math.abs(last) * 100).toFixed(1)}% בשבוע</div>` : ''}</div>
          </div>
          <div class="flex gap-1.5 mt-2 text-[11px]">
            <button onclick="invest('${inv.id}', 1000)" class="flex-1 bg-gray-800 rounded-lg py-1.5 text-gray-200 hover:bg-gray-700">+₪1K</button>
            <button onclick="invest('${inv.id}', 10000)" class="flex-1 bg-gray-800 rounded-lg py-1.5 text-gray-200 hover:bg-gray-700">+₪10K</button>
            <button onclick="invest('${inv.id}', 100000)" class="flex-1 bg-gray-800 rounded-lg py-1.5 text-gray-200 hover:bg-gray-700">+₪100K</button>
            ${v ? `<button onclick="sellInvestment('${inv.id}')" class="flex-1 bg-red-900/50 rounded-lg py-1.5 text-red-300 hover:bg-red-900">מכור הכל</button>` : ''}
          </div>
        </div>`;
      }).join('');

      $('money-teams').innerHTML = TEAMS.map(t => {
        const own = state.teams[t.id];
        const res = own && own.last ? { win: '🏆 ניצחון', draw: '🤝 תיקו', loss: '😞 הפסד' }[own.last] : '';
        return `<div class="bg-gray-900/60 border border-gray-800 rounded-xl p-2.5 flex justify-between items-center gap-2">
          <div class="min-w-0"><div class="text-xs font-bold text-white"><i class="fa-solid ${t.icon} ml-1 text-gray-400"></i>${t.name}</div>
            <div class="text-[10px] text-gray-500">${t.sport} · ${own ? `שווי ${money(own.value)}${res ? ' · ' + res : ''}` : `₪${fmt(t.cost)} · עד ₪${fmt(t.income * 1.6)} בשבוע`}</div></div>
          ${own ? `<button onclick="sellTeam('${t.id}')" class="bg-gray-800 text-gray-200 text-xs font-bold px-3 py-1.5 rounded-xl shrink-0">מכור</button>`
            : `<button onclick="buyTeam('${t.id}')" class="${state.money >= t.cost ? 'bg-goldAccent text-black' : 'bg-gray-800 text-gray-500'} text-xs font-bold px-3 py-1.5 rounded-xl shrink-0">קנה</button>`}
        </div>`;
      }).join('');
    }

    function renderShop() {
      $('shop-owned-items').innerHTML = state.inventory.length
        ? state.inventory.map(id => `<span class="bg-gray-800 px-2 py-1 rounded-lg border border-gray-700 text-spotifyGreen font-semibold">${SHOP.find(i => i.id === id).name}</span>`).join('')
        : '<span class="bg-gray-800 px-2 py-1 rounded-lg border border-gray-700 text-gray-500">אין רכוש עדיין</span>';
      $('shop-rent').innerText = `🏠 הוצאות מחיה שבועיות: ₪${fmt(weeklyRent())} | ⚡ אנרגיה שבועית: ${maxEnergy()} | 🎚️ רמת האולפן הביתי: ${homeStudioLevel()}`;
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

    // ---------- Navigation ----------
    function navTo(screen) {
      closeApp();
      document.querySelectorAll('main > section').forEach(s => s.classList.add('hidden'));
      document.querySelectorAll('nav > button').forEach(b => { b.classList.remove('nav-active'); b.classList.add('text-gray-400'); });
      $(`screen-${screen}`).classList.remove('hidden');
      $(`nav-${screen}`).classList.add('nav-active');
      $('main-content').scrollTop = 0;
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
      addInboxMessage('אמא', `בהצלחה חמוד שלי! אני גאה בך. רק תאכל משהו מדי פעם ❤️`);
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
