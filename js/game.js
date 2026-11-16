/* =========================================================
 * 摘発カウントダウン - Web版
 * 表向きは「ただのバー」。実は無許可で接待営業をしている架空の店。
 * 警察が来たら、客の隣に座っているキャストをタップしてカウンターへ戻せ！
 * 本作はフィクションです。実在の人物・店舗・事件とは関係ありません。
 * ========================================================= */
(() => {
  'use strict';
  const C = window.CONFIG;
  const W = 360, H = 640;              // 論理解像度（9:16）
  const TOTAL_MIN = C.gameHours * 60;
  const params = new URLSearchParams(location.search);
  const SPEED = clamp(parseFloat(params.get('speed')) || 1, 0.25, 20); // テスト用
  const NO_ADS = params.get('noads') === '1';
  const STORE = 'BAR 夜更し';

  // ---------------------------------------------------------------- utils
  function clamp(v, a, b) { return Math.max(a, Math.min(b, v)); }
  function lerp(a, b, t) { return a + (b - a) * t; }
  function yen(n) { return (n < 0 ? '-' : '') + '¥' + Math.abs(Math.round(n)).toLocaleString('ja-JP'); }
  function $(id) { return document.getElementById(id); }
  function mulberry32(a) {
    return function () {
      a |= 0; a = (a + 0x6D2B79F5) | 0;
      let t = Math.imul(a ^ (a >>> 15), 1 | a);
      t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
      return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
    };
  }
  let rng = Math.random;                       // ?seed=123 で再現可能
  const rand = (a, b) => a + rng() * (b - a);
  const randInt = (a, b) => Math.floor(rand(a, b + 1));
  const pick = (arr) => arr[Math.floor(rng() * arr.length)];
  const vrand = Math.random;                    // 見た目専用

  // ---------------------------------------------------------------- storage
  const Storage = {
    key: 'tekihatsu_countdown_v2',
    data: { bestScore: 0, plays: 0, totalSales: 0, totalPoints: 0, sound: true, tutorialDone: false, sinceAd: 0 },
    load() { try { const d = JSON.parse(localStorage.getItem(this.key)); if (d) Object.assign(this.data, d); } catch (e) { /* noop */ } },
    save() { try { localStorage.setItem(this.key, JSON.stringify(this.data)); } catch (e) { /* noop */ } },
  };

  // ---------------------------------------------------------------- sound
  const Sound = {
    ctx: null,
    get on() { return Storage.data.sound; },
    init() {
      if (!this.ctx) { try { this.ctx = new (window.AudioContext || window.webkitAudioContext)(); } catch (e) { this.ctx = null; } }
      if (this.ctx && this.ctx.state === 'suspended') this.ctx.resume();
    },
    tone(freq, dur, type = 'sine', vol = 0.12, when = 0, slideTo = null) {
      if (!this.on || !this.ctx) return;
      const t = this.ctx.currentTime + when;
      const o = this.ctx.createOscillator(), g = this.ctx.createGain();
      o.type = type; o.frequency.setValueAtTime(freq, t);
      if (slideTo) o.frequency.exponentialRampToValueAtTime(slideTo, t + dur);
      g.gain.setValueAtTime(vol, t); g.gain.exponentialRampToValueAtTime(0.0001, t + dur);
      o.connect(g).connect(this.ctx.destination); o.start(t); o.stop(t + dur + 0.05);
    },
    bell() { this.tone(1568, 0.25, 'sine', 0.05); this.tone(2093, 0.3, 'sine', 0.04, 0.08); },
    coin(p = 0) { this.tone(988 + p * 120, 0.06, 'square', 0.05); this.tone(1319 + p * 160, 0.14, 'square', 0.05, 0.05); },
    pour() { this.tone(500, 0.12, 'sine', 0.06, 0, 900); },
    tower() { [784, 988, 1175, 1568, 1976].forEach((f, i) => this.tone(f, 0.18, 'triangle', 0.08, i * 0.07)); },
    knock() { this.tone(140, 0.07, 'square', 0.18); this.tone(140, 0.07, 'square', 0.18, 0.16); },
    whoosh() { this.tone(900, 0.12, 'sine', 0.06, 0, 300); },
    notify() { this.tone(880, 0.1, 'sine', 0.08); this.tone(660, 0.16, 'sine', 0.08, 0.1); },
    fanfare() { [523, 659, 784, 1047].forEach((f, i) => this.tone(f, 0.16, 'triangle', 0.09, i * 0.09)); },
    clear() { [523, 659, 784, 1047, 1319].forEach((f, i) => this.tone(f, 0.25, 'triangle', 0.1, i * 0.12)); },
    warn() { for (let i = 0; i < 3; i++) this.tone(220, 0.16, 'square', 0.06, i * 0.2); },
    siren() { for (let i = 0; i < 4; i++) this.tone(650, 0.42, 'sawtooth', 0.06, i * 0.45, 1050); },
    tick() { this.tone(1200, 0.03, 'square', 0.035); },
    relief() { this.tone(400, 0.2, 'sine', 0.08, 0, 600); this.tone(600, 0.25, 'sine', 0.08, 0.18, 900); },
  };

  // ---------------------------------------------------------------- ads（Web版はダミー。失敗してもゲーム継続）
  const Ads = {
    available() { return C.ads.enabled && !NO_ADS; },
    showInterstitial() { return this.available() ? showAdOverlay('インタースティシャル広告', C.ads.interstitialSeconds, false).catch(() => false) : Promise.resolve(false); },
    showRewarded() { return this.available() ? showAdOverlay('リワード広告', C.ads.rewardedSeconds, true).catch(() => false) : Promise.resolve(false); },
  };
  function showAdOverlay(kind, secs, rewarded) {
    return new Promise((resolve) => {
      const ov = $('ad-overlay'), close = $('ad-close'), count = $('ad-count');
      $('ad-kind').textContent = kind;
      ov.classList.remove('hidden'); close.classList.add('hidden');
      let left = secs; count.textContent = left + '秒';
      const done = (ok) => { clearInterval(iv); ov.classList.add('hidden'); close.onclick = null; resolve(ok); };
      const iv = setInterval(() => {
        left--;
        if (left > 0) { count.textContent = left + '秒'; return; }
        clearInterval(iv);
        count.textContent = rewarded ? '報酬を獲得しました！' : '';
        close.classList.remove('hidden'); close.onclick = () => done(true);
      }, 1000);
      if (rewarded) { close.classList.remove('hidden'); close.onclick = () => done(left <= 0); }
    });
  }

  // ---------------------------------------------------------------- data
  const CUSTOMER_TEXTS = {
    normal: ['一杯だけ飲みたいな', 'ここ初めてなんだけど', '仕事終わり〜', '終電逃しちゃった'],
    wants: ['隣に誰かついてくれる？', 'かわいい子いる？', '今日は飲むぞー！'],
    vip: ['💎 一番いい席を頼むよ'],
    undercover: ['…一人。ここ、どんな店？', '…静かに飲みたいんだが'],
  };
  const FALSE_VISITORS = [
    { icon: '🍕', name: 'ピザの配達', line: '宅配ピザでーす！…あれ、違う店？' },
    { icon: '🍶', name: '酔っ払い', line: 'ういっく…トイレどこぉ？' },
    { icon: '📦', name: '酒屋の配達', line: 'まいど！おしぼりとお酒です' },
    { icon: '🐱', name: '野良猫', line: 'にゃー' },
    { icon: '🧹', name: '隣の店のママ', line: 'ちょっと氷貸してくれない？' },
  ];
  const CASTS = [
    { name: 'ミナ', dress: '#ff4f9e', hair: '#3a1e14', hl: '#ff9ccc' },
    { name: 'レイ', dress: '#36d6e7', hair: '#141414', hl: '#a9f6ff' },
    { name: 'サキ', dress: '#ffc23d', hair: '#7a4a1f', hl: '#ffe39a' },
  ];
  const COLORS = ['#4fc3f7', '#ffb74d', '#9575cd', '#81c784', '#e57373', '#4db6ac', '#90a4ae', '#7986cb', '#a1887f'];
  const HAIRS = ['#1b1b1b', '#3e2723', '#5d4037', '#262626', '#8d6e63', '#9e9e9e'];

  // レイアウト（論理座標）
  const DOOR = { x: 294, y: 200, w: 58, h: 200 };
  const QUEUE = [{ x: 322, y: 486 }, { x: 344, y: 478 }, { x: 366, y: 472 }];
  const COUNTER_TOP = 340;
  const CAST_HOME = [44, 104, 164];             // カウンター内（バーテンとして立つ位置）
  const PAIR_X = [52, 144, 236];                // カウンター席（客＋隣のキャスト）の中心
  const CUST_DX = -21, CAST_DX = 21;
  const SEAT_Y = 446;                           // スツールの座面

  // ---------------------------------------------------------------- game state
  const STATE = { title: 'title', playing: 'playing', ending: 'ending', result: 'result' };
  let state = STATE.title;
  let G = null;

  function newGame() {
    const seed = params.get('seed');
    rng = seed !== null ? mulberry32(parseInt(seed, 10) || 0) : Math.random;
    G = {
      elapsed: 0, min: 0,
      sales: 0, customers: 0, heat: 0,
      queue: [], seats: Array(C.seats).fill(null),
      walkers: [], popups: [], particles: [],
      casts: CASTS.map((c, i) => ({ ...c, i, state: 'counter', t: 1, from: null, target: 'counter', dur: 1 })),
      spawnT: 0.5, buzzLeft: 0, vipCount: 0,
      visit: null, visitT: rand(C.visitIntervalSeconds[0] + 1.5, C.visitIntervalSeconds[1] + 1.5),
      inspAt: (C.inspectionHour + 24 - C.openingHour) * 60 + rand(-C.inspectionJitterMinutes, C.inspectionJitterMinutes),
      inspected: false, sleepyT: 0,
      events: scheduleEvents(),
      stats: { passed: 0, falseAlarms: 0, drinks: 0, towers: 0 },
      outcome: null, paused: false, shake: 0, flash: 0, bustT: 0,
    };
  }

  function scheduleEvents() {
    const n = randInt(C.minRandomEvents, C.maxRandomEvents);
    const pool = ['buzz', 'vip', 'undercover', 'tipoff', 'sleepy'];
    const list = []; let prev = null, vips = 0;
    for (let i = 0; i < n; i++) {
      let t, guard = 0;
      do { t = pick(pool); guard++; } while ((t === prev || (t === 'vip' && vips >= C.maxVipEvents)) && guard < 50);
      if (t === 'vip') vips++;
      prev = t; list.push(t);
    }
    return list.map((type, i) => ({ type, at: (0.08 + (0.84 * (i + rand(0.2, 0.8))) / n) * TOTAL_MIN, done: false }));
  }

  // 「カウンター」以外の状態（隣に座っている／移動中）は警察に見られたらアウト
  const castExposed = (c) => c.state !== 'counter';
  const settaiCount = () => G.casts.filter((c) => c.state === 'box').length;

  // ---------- customers
  function makeCustomer(kind) {
    const look = {
      body: kind === 'vip' ? '#1c1c22' : kind === 'undercover' ? '#b59a6a' : COLORS[Math.floor(vrand() * COLORS.length)],
      hair: HAIRS[Math.floor(vrand() * HAIRS.length)],
      skin: vrand() < 0.5 ? '#f1c7a5' : '#e0ac83',
      glasses: kind === 'undercover', gold: kind === 'vip',
    };
    const textKey = kind === 'normal' ? (rng() < 0.45 ? 'wants' : 'normal') : kind;
    const wait = rand(C.minWaitSeconds, C.maxWaitSeconds) * (kind === 'vip' ? 1.5 : 1);
    return { kind, look, text: pick(CUSTOMER_TEXTS[textKey]), wait, maxWait: wait, x: 400, y: QUEUE[0].y, alpha: 1, phase: vrand() * 6 };
  }
  function spawnCustomer(kind = 'normal') {
    if (G.queue.length >= C.maxWaiting) {
      if (kind === 'normal') return;
      const out = G.queue.pop(); leaveToDoor(out);
    }
    G.queue.push(makeCustomer(kind));
    Sound.bell();
  }
  function leaveToDoor(c) {
    G.walkers.push({ look: c.look, x: c.x || 300, y: c.y || 420, tx: DOOR.x + 28, ty: DOOR.y + DOOR.h, alpha: 1, phase: 0 });
  }

  function seatGuest() {
    if (state !== STATE.playing || G.paused) return;
    const c = G.queue[0];
    if (!c || Math.abs(c.x - QUEUE[0].x) > 6) { Sound.tick(); return; }
    const i = G.seats.indexOf(null);
    if (i < 0) { msg('カウンターは満席です', '#ffcc66'); Sound.tick(); return; }
    G.queue.shift();
    const stay = rand(...C.staySeconds) * (c.kind === 'vip' ? 1.4 : 1);
    G.seats[i] = { ...c, stay, maxStay: stay, drinks: 0, drinking: 0, drinkMax: 1, glass: null, leaving: 0, cheer: 0, undercoverHit: false };
    G.customers++; addSales(C.setCharge, PAIR_X[i] + CUST_DX, 400, '#9be7ff'); Sound.coin();
    // 誰も来ていない時は、キャストが自動で客の隣に座る
    const cast = G.casts[i];
    if (!G.visit && cast.state === 'counter') moveCast(cast, 'box');
    else if (G.visit) msg('⚠ 来客中…キャストは待機（タップで隣へ）', '#ffcc66');
  }

  function addSales(amount, x, y, color) {
    G.sales += amount;
    popup('+' + yen(amount), x, y, color || '#7CFFB2');
    for (let k = 0; k < 5; k++) G.particles.push({ x, y, vx: (vrand() - 0.5) * 110, vy: -50 - vrand() * 70, life: 0.7, c: '#ffd54f' });
  }

  // ---------- casts
  const homePos = (i) => ({ x: CAST_HOME[i], y: COUNTER_TOP + 8 });
  const boxPos = (i) => ({ x: PAIR_X[i] + CAST_DX, y: SEAT_Y + 34 });
  function castPos(cast) {
    if (cast.state === 'counter') return homePos(cast.i);
    if (cast.state === 'box') return boxPos(cast.i);
    const to = cast.target === 'box' ? boxPos(cast.i) : homePos(cast.i);
    const e = easeInOut(clamp(cast.t, 0, 1));
    return { x: lerp(cast.from.x, to.x, e), y: lerp(cast.from.y, to.y, e) - Math.sin(e * Math.PI) * 26 };
  }
  function easeInOut(t) { return t < 0.5 ? 2 * t * t : 1 - Math.pow(-2 * t + 2, 2) / 2; }
  function moveCast(cast, where) {
    cast.from = castPos(cast);
    cast.state = where === 'box' ? 'toBox' : 'toCounter';
    cast.target = where; cast.t = 0;
    cast.dur = where === 'box' ? C.castToBoxSeconds : C.castToCounterSeconds;
    Sound.whoosh();
  }
  function tapCast(cast) {
    if (state !== STATE.playing || G.paused) return;
    if (cast.state === 'box' || cast.state === 'toBox') {
      moveCast(cast, 'counter');
      popup('カウンターの中へ！', PAIR_X[cast.i] + CAST_DX, 380, '#9be7ff', 0.8);
    } else if (cast.state === 'counter') {
      if (G.seats[cast.i]) moveCast(cast, 'box');
      else { Sound.tick(); popup('お客さんがいない', CAST_HOME[cast.i], 250, '#ccc', 0.8); }
    }
  }

  // ---------- drinks（キャストが隣にいる時だけ注文してくれる）
  function tapBoxCustomer(i) {
    if (state !== STATE.playing || G.paused) return;
    const b = G.seats[i]; if (!b || b.leaving) return;
    if (b.drinking > 0) { popup('まだ飲んでる…', PAIR_X[i] + CUST_DX, 370, '#ccc', 0.6); Sound.tick(); return; }
    const cast = G.casts[i];
    if (cast.state !== 'box') { popup('キャストがいないと…', PAIR_X[i] + CUST_DX, 380, '#ccc', 0.8); Sound.tick(); return; }
    const d = C.drinks[Math.min(b.drinks, C.drinks.length - 1)];
    const price = d[2] * (b.kind === 'vip' ? C.vipDrinkMultiplier : 1);
    b.drinks++; G.stats.drinks++;
    b.glass = d[0]; b.drinkMax = b.drinking = C.drinkSeconds * (b.kind === 'vip' ? 0.7 : 1);
    b.stay = Math.max(b.stay, b.drinking + 0.6); // 飲み終わるまでは帰らない
    G.heat = Math.min(100, G.heat + C.heatPerDrink);
    addSales(price, PAIR_X[i], 395, price >= 20000 ? '#ffd54f' : '#7CFFB2');
    popup(`${d[0]} ${d[1]}！`, PAIR_X[i], 365, '#fff', 0.9);
    b.cheer = 0.4;
    if (b.drinks >= C.drinks.length) {
      G.stats.towers++; Sound.tower(); G.shake = 0.15;
      b.leaving = b.drinking + 0.5;
      popup('ごちそうさま〜♪', PAIR_X[i], 340, '#ff9ccc', 1.2);
    } else { Sound.pour(); Sound.coin(b.drinks); }
  }

  // ---------- visitors / police
  function startVisit(kind, reason) {
    let warn = reason === 'raid' ? C.raidWarningSeconds : lerp(C.warningSecondsSafe, C.warningSecondsHot, G.heat / 100);
    if (G.sleepyT > 0) warn *= C.sleepyLookoutFactor;
    const who = kind === 'police' ? { icon: '👮', name: '警察' } : pick(FALSE_VISITORS);
    G.visit = { kind, reason, who, phase: 'knock', t: warn, max: warn };
    Sound.knock();
    $('alarm').classList.remove('hidden');
    $('alarm').classList.toggle('raid', reason === 'raid');
    $('alarm-text').textContent = reason === 'raid' ? '🚨 ドンドンドン！！ 警察だ、開けなさい！' : '🚪 コンコン！ 誰か来た… 窓を見て！';
  }
  function updateVisit(dt) {
    const v = G.visit;
    v.t -= dt;
    if (v.phase === 'knock') {
      $('alarm-fill').style.width = clamp(v.t / v.max, 0, 1) * 100 + '%';
      if (v.t > 0) return;
      v.phase = 'inside'; $('alarm').classList.add('hidden');
      v.t = v.kind === 'police' ? C.policeInsideSeconds : C.visitorInsideSeconds;
      if (v.kind === 'police') {
        Sound.siren();
        toast(v.reason === 'inspection' ? '👮 警察です。立入調査を行います' : v.reason === 'raid' ? '👮 警察だ！ そのまま動くな！' : '👮 警察です。ちょっと中を見せてください', 'blue');
      } else {
        toast(`${v.who.icon} ${v.who.line}`, 'pink');
        G.stats.falseAlarms++;
      }
    }
    if (v.phase === 'inside') {
      if (v.kind === 'police') {
        const caught = G.casts.find(castExposed);
        if (caught) { bust(caught); return; }
      }
      if (v.t > 0) return;
      if (v.kind === 'police') {
        G.stats.passed++;
        G.heat = clamp(G.heat + C.heatAfterPassedVisit, 0, 100);
        toast('👮「…ただのバーですね。失礼しました」 セーフ！', 'green');
        Sound.relief();
        if (G.seats.some((b, i) => b && G.casts[i].state === 'counter')) msg('💃 キャストをタップしてまた隣へ！', '#ff9ccc');
      } else {
        msg(`なんだ、${v.who.name}か…`, '#ccc');
      }
      G.visit = null;
      G.visitT = rand(...C.visitIntervalSeconds);
    }
  }

  // 警察が客の隣にいるキャストを見つけ、聞き込みをした時点でアウト
  function bust(cast) {
    G.outcome = 'bust'; state = STATE.ending; G.bustT = 0;
    G.caught = { i: cast.i, name: cast.name, pos: castPos(cast) };
    $('alarm').classList.add('hidden');
    toast(`👮「…ん？ そこのお姉さん、ちょっといいですか？」`, 'blue');
    Sound.warn();
    setTimeout(() => { if (!G) return; Sound.siren(); G.shake = 0.6; G.flash = 1; toast(`🚨 ${cast.name}への聞き込みで発覚！ 無許可の接待営業で摘発！`, 'red'); }, 1500);
    setTimeout(finish, 3300);
  }

  // ---------- events
  function runEvent(type) {
    switch (type) {
      case 'buzz': G.buzzLeft = C.buzzExtraCustomers; G.spawnT = 0.2; toast('📱 SNSでバズった！ 客が押し寄せる！', 'pink'); Sound.notify(); break;
      case 'vip':
        if (G.vipCount >= C.maxVipEvents) return;
        G.vipCount++; spawnCustomer('vip'); toast('💎 VIP来店！ ボックスでお酒を勧めまくれ！', 'gold'); Sound.fanfare(); break;
      case 'undercover': spawnCustomer('undercover'); toast('🕶 なんだか目つきの鋭い客が来た…', 'orange'); Sound.notify(); break;
      case 'tipoff':
        G.heat = Math.min(100, G.heat + C.heatTipOff);
        toast(`📢 元従業員がタレコミ！ 疑惑 +${C.heatTipOff}`, 'orange'); Sound.warn(); break;
      case 'sleepy': G.sleepyT = C.sleepyLookoutSeconds; toast('😪 見張りが居眠り中… ノックに気づくのが遅れる！', 'orange'); Sound.notify(); break;
    }
  }

  // ---------- update
  function update(dt) {
    if (!G) return;
    animate(dt);
    if (state === STATE.ending) { G.bustT += dt; return; }
    if (state !== STATE.playing || G.paused) return;

    G.elapsed += dt;
    G.min = Math.min(TOTAL_MIN, (G.elapsed / C.gameDurationSeconds) * TOTAL_MIN);
    if (G.min >= TOTAL_MIN) {
      G.outcome = 'clear'; state = STATE.ending; $('alarm').classList.add('hidden');
      Sound.clear(); toast('🌅 朝5時！ 今夜も逃げ切った！', 'gold');
      setTimeout(finish, 1500); return;
    }

    for (const e of G.events) if (!e.done && G.min >= e.at) { e.done = true; runEvent(e.type); }

    // 来客
    G.spawnT -= dt;
    if (G.spawnT <= 0) {
      if (G.buzzLeft > 0) { G.buzzLeft--; G.spawnT = rand(0.4, 0.7); } else G.spawnT = rand(C.minCustomerInterval, C.maxCustomerInterval);
      spawnCustomer();
    }
    for (let i = G.queue.length - 1; i >= 0; i--) {
      const c = G.queue[i]; c.wait -= dt;
      if (c.wait <= 0) { G.queue.splice(i, 1); leaveToDoor(c); popup('💢 帰っちゃった', c.x - 20, 300, '#ff8a8a', 1); }
    }
    // 着席客
    G.seats.forEach((b, i) => {
      if (!b) return;
      if (b.cheer > 0) b.cheer -= dt;
      if (b.drinking > 0) b.drinking -= dt;
      const cast = G.casts[i];
      if (cast.state === 'box' && b.kind === 'undercover' && !b.undercoverHit) {
        b.undercoverHit = true; G.heat = Math.min(100, G.heat + C.heatUndercover);
        toast(`🕶 内偵捜査だった！ 疑惑 +${C.heatUndercover}`, 'red'); Sound.warn(); G.shake = 0.3;
      }
      if (b.leaving > 0) { b.leaving -= dt; if (b.leaving <= 0) b.stay = 0; }
      if ((b.stay -= dt) <= 0) {
        G.seats[i] = null; leaveToDoor({ look: b.look, x: PAIR_X[i] + CUST_DX, y: 492 });
        if (cast.state === 'box' || cast.state === 'toBox') moveCast(cast, 'counter');
      }
    });
    // キャスト移動
    G.casts.forEach((c) => {
      if (c.state !== 'toBox' && c.state !== 'toCounter') return;
      c.t += dt / c.dur;
      if (c.t >= 1) c.state = c.target === 'box' && G.seats[c.i] ? 'box' : 'counter';
    });

    // 疑惑ゲージ
    const st = settaiCount();
    if (st > 0) G.heat = Math.min(100, G.heat + st * C.heatPerSettaiSecond * dt);
    else G.heat = Math.max(0, G.heat - C.heatDecayNoSettai * dt);
    if (G.sleepyT > 0) G.sleepyT -= dt;

    // 来訪者
    if (G.visit) updateVisit(dt);
    else if (!G.inspected && G.min >= G.inspAt) { G.inspected = true; startVisit('police', 'inspection'); }
    else if (G.heat >= 100) startVisit('police', 'raid');
    else {
      G.visitT -= dt;
      if (G.visitT <= 0) startVisit(rng() < lerp(C.policeChanceBase, C.policeChanceAtMaxHeat, G.heat / 100) ? 'police' : 'other', 'patrol');
    }
  }

  function animate(dt) {
    G.queue.forEach((c, i) => {
      const q = QUEUE[i]; const dx = q.x - c.x, step = 220 * dt;
      c.walking = Math.abs(dx) > 1; c.x = Math.abs(dx) <= step ? q.x : c.x + Math.sign(dx) * step; c.y = q.y;
      if (c.walking) c.phase += dt * 12;
    });
    G.walkers.forEach((w) => {
      const dx = w.tx - w.x, dy = w.ty - w.y, d = Math.hypot(dx, dy), step = 200 * dt;
      if (d > step) { w.x += (dx / d) * step; w.y += (dy / d) * step; w.phase += dt * 12; } else w.alpha -= dt * 3;
    });
    G.walkers = G.walkers.filter((w) => w.alpha > 0);
    G.popups.forEach((p) => { p.y -= 34 * dt; p.life -= dt; });
    G.popups = G.popups.filter((p) => p.life > 0);
    G.particles.forEach((p) => { p.x += p.vx * dt; p.y += p.vy * dt; p.vy += 260 * dt; p.life -= dt; });
    G.particles = G.particles.filter((p) => p.life > 0);
    if (G.shake > 0) G.shake -= dt;
    if (G.flash > 0) G.flash -= dt * 0.8;
  }

  // ---------- end
  function computeScore() {
    const salesScore = Math.min(50, G.sales / C.salesPerPoint);
    const customerScore = Math.min(20, G.customers / C.customersPerPoint);
    const survival = G.outcome === 'clear' ? C.survivalScore : 0;
    const total = Math.round(salesScore + customerScore + survival);
    const rank = C.ranks.find(([, m]) => total >= m)[0];
    return { salesScore, customerScore, survival, total, rank };
  }
  function finish() {
    if (state === STATE.result || !G) return;
    state = STATE.result;
    G.score = computeScore();
    const d = Storage.data;
    d.plays++; d.totalSales += G.sales; d.totalPoints += G.score.total;
    G.newBest = G.score.total > d.bestScore; if (G.newBest) d.bestScore = G.score.total;
    Storage.save();
    showResult();
  }

  // ---------------------------------------------------------------- UI
  const screens = { title: $('screen-title'), game: $('screen-game'), result: $('screen-result') };
  function showScreen(name) { Object.entries(screens).forEach(([k, el]) => el.classList.toggle('active', k === name)); }
  function toast(text, color = 'pink') {
    const el = document.createElement('div'); el.className = 'toast ' + color; el.textContent = text;
    const area = $('toast-area'); area.appendChild(el);
    while (area.children.length > 2) area.removeChild(area.firstChild);
    setTimeout(() => el.classList.add('out'), 2300); setTimeout(() => el.remove(), 2700);
  }
  let msgTimer = 0;
  function msg(text, color) {
    const el = $('msg-line'); el.textContent = text; el.style.color = color || '#fff';
    el.classList.add('show'); clearTimeout(msgTimer); msgTimer = setTimeout(() => el.classList.remove('show'), 1800);
  }
  function popup(text, x, y, color, life = 1.1) { G.popups.push({ text, x, y, color, life, max: life }); }

  const cache = {};
  function setText(id, v) { if (cache[id] !== v) { cache[id] = v; $(id).textContent = v; } }
  function fmtTime(min) {
    const t = Math.floor(min), hh = (C.openingHour + Math.floor(t / 60)) % 24, mm = t % 60;
    return String(hh).padStart(2, '0') + ':' + String(mm).padStart(2, '0');
  }
  function updateHUD() {
    if (!G) return;
    setText('hud-time', fmtTime(G.min));
    setText('hud-remain', '残り ' + Math.max(0, Math.ceil(C.gameDurationSeconds - G.elapsed)) + '秒');
    setText('hud-sales', yen(G.sales));
    setText('hud-cust', G.customers + '人');
    $('heat-fill').style.width = G.heat + '%';
    $('heat-fill').className = G.heat > 80 ? 'hot' : G.heat > 50 ? 'warm' : '';
    const st = G.casts.filter(castExposed).length;
    setText('hud-mode', st ? `接待中 ${st}` : 'ただのバー');
    $('hud-mode').className = 'mode ' + (st ? 'settai' : 'bar');
    const front = G.queue[0] && Math.abs(G.queue[0].x - QUEUE[0].x) < 6;
    $('btn-seat').classList.toggle('ready', !!front && G.seats.includes(null));
  }

  function showResult() {
    const r = G.score, bust = G.outcome === 'bust';
    $('res-headline').textContent = bust ? '🚨 摘発…' : '🌅 今夜も逃げ切った！';
    $('res-headline').className = 'res-headline ' + (bust ? 'bust' : 'clear');
    const news = $('res-news');
    news.classList.toggle('hidden', !bust);
    if (bust) news.innerHTML = `<small>ネオン横丁新聞（架空）</small><b>「${STORE}」を摘発<br>バーと偽り 無許可で接待営業の疑い</b><span>${fmtTime(G.min)}ごろ、警察が店内に立ち入ったところ、女性従業員が客の隣に座って接客していたという。</span>`;
    $('res-sales').textContent = yen(G.sales);
    $('res-cust').textContent = G.customers + '人';
    $('res-rank').textContent = r.rank + 'ランク'; $('res-rank').className = 'rank-' + r.rank;
    $('res-pass').textContent = G.stats.passed + '回';
    $('res-time').textContent = fmtTime(G.min) + 'まで';
    $('res-score').textContent = r.total;
    $('res-best').textContent = G.newBest ? '🏆 NEW BEST SCORE!' : `BEST ${Storage.data.bestScore}`;
    $('res-breakdown').textContent = `売上 ${r.salesScore.toFixed(1)}/50 ・ 来客 ${r.customerScore.toFixed(1)}/20 ・ 生存 ${r.survival}/30\nお酒 ${G.stats.drinks}杯（タワー ${G.stats.towers}回） ・ 空振りノック ${G.stats.falseAlarms}回`;
    $('res-tip').innerHTML = '<b>💡 現実では</b> 客の隣に座って談笑・お酌をするなどの「接待」をする営業には、風俗営業の許可が必要とされています。許可なく接待営業を行うことは法律で禁止されています。<small>※本作はフィクションです。説明は一般的な内容を簡略化したものです。</small>';
    const dbl = $('btn-double');
    dbl.classList.toggle('hidden', !Ads.available()); dbl.disabled = false; dbl.textContent = '▶ 広告を見て獲得ポイント2倍（任意）';
    G.doubled = false;
    showScreen('result');
  }

  function startGame() {
    Sound.init(); newGame(); state = STATE.playing;
    Object.keys(cache).forEach((k) => delete cache[k]);
    $('toast-area').innerHTML = ''; $('alarm').classList.add('hidden');
    showScreen('game'); updateHUD();
    toast(`🏮 ${STORE} 開店！ 表向きは、ただのバー`, 'pink');
  }
  function goTitle() { state = STATE.title; G = null; $('alarm').classList.add('hidden'); renderTitle(); showScreen('title'); }
  async function afterResult(next) {
    Storage.data.sinceAd++;
    if (Storage.data.sinceAd >= C.ads.interstitialEveryNPlays) {
      Storage.data.sinceAd = 0; Storage.save();
      try { await Ads.showInterstitial(); } catch (e) { /* 広告失敗でも継続 */ }
    }
    next();
  }
  function renderTitle() {
    const d = Storage.data;
    $('title-best').textContent = d.bestScore;
    $('title-stats').textContent = d.plays ? `プレイ ${d.plays}回 ・ 累計売上 ${yen(d.totalSales)} ・ 累計 ${d.totalPoints}pt` : '';
    $('btn-sound').textContent = d.sound ? '🔊 サウンド ON' : '🔇 サウンド OFF';
    $('ad-banner').classList.toggle('hidden', !Ads.available());
  }
  function modal(html, buttons) {
    const box = $('modal-box');
    box.innerHTML = html + '<div class="modal-btns">' + buttons.map((b, i) => `<button class="btn ${b.cls || 'btn-primary'}" data-i="${i}">${b.label}</button>`).join('') + '</div>';
    $('modal').classList.remove('hidden');
    box.querySelectorAll('[data-i]').forEach((el) => el.addEventListener('click', () => {
      $('modal').classList.add('hidden'); Sound.tick(); const f = buttons[+el.dataset.i].onClick; if (f) f();
    }));
  }
  const HOWTO = `
    <h2>遊び方</h2>
    <p>あなたは「${STORE}」のオーナー。表向きはただのバーだけど、実は<b>女性キャストがお客さんの隣で接客</b>している（もちろん無許可）。<b>22:00〜翌5:00（45秒）</b>、摘発されずに稼ぎ切れ！</p>
    <ul class="howto">
      <li><b>🚪 案内する</b>：お客さんをカウンター席へ。キャストが隣に座って接客する。</li>
      <li><b>🍾 お客さんをタップ</b>：お酒をどんどん勧める！ ビール→ハイボール→ワイン→シャンパン→タワーと単価UP。ただし疑惑も上がる。</li>
      <li><b>🚪 ノック</b>：ドアの窓に映る影をチェック。<b>👮警察なら、客の隣のキャストをタップしてカウンターの中へ戻せ！</b> 間に合わなければ摘発。</li>
      <li>警察が帰ったら、カウンターの中のキャストをタップしてまた隣へ。疑惑が溜まると警察が来やすくなり、MAXで踏み込まれる！ 3時ごろの立入調査は必ず来る。</li>
    </ul>
    <p class="small">※本作はフィクションです。現実の無許可営業は法律で禁止されています。</p>`;

  // ---------------------------------------------------------------- input
  function bindTap(el, fn) { el.addEventListener('pointerdown', (e) => { e.preventDefault(); Sound.init(); fn(); }); }
  bindTap($('btn-seat'), seatGuest);

  const canvas = $('scene'), ctx = canvas.getContext('2d');
  canvas.addEventListener('pointerdown', (e) => {
    if (state !== STATE.playing || !G || G.paused) return;
    e.preventDefault(); Sound.init();
    const r = canvas.getBoundingClientRect();
    const x = ((e.clientX - r.left) / r.width) * W;
    const y = ((e.clientY - r.top) / r.height) * VH - OY;
    handleTap(x, y);
  });
  function handleTap(x, y) {
    // キャスト優先（指で押しやすいよう判定は大きめ）
    let best = null, bd = 1e9;
    G.casts.forEach((c) => {
      const p = castPos(c);
      const cy = c.state === 'counter' ? p.y - 62 : c.state === 'box' ? p.y - 58 : p.y - 45;
      const d = Math.hypot(x - p.x, (y - cy) * 0.75);
      if (d < 26 && d < bd) { bd = d; best = c; }
    });
    if (best) { tapCast(best); return; }
    for (let i = 0; i < G.seats.length; i++) {
      if (Math.abs(x - PAIR_X[i]) < 46 && y > SEAT_Y - 90 && y < SEAT_Y + 40) {
        if (x < PAIR_X[i]) { if (G.seats[i]) tapBoxCustomer(i); } else tapCast(G.casts[i]);
        return;
      }
    }
  }

  $('btn-pause').addEventListener('click', () => {
    if (state !== STATE.playing || G.paused) return;
    G.paused = true;
    modal('<h2>一時停止中</h2>', [
      { label: '再開', onClick: () => { G.paused = false; } },
      { label: 'タイトルへ', cls: 'btn-ghost', onClick: () => { goTitle(); } },
    ]);
  });
  $('btn-start').addEventListener('click', () => {
    Sound.init();
    if (!Storage.data.tutorialDone) modal(HOWTO, [{ label: '開店！', onClick: () => { Storage.data.tutorialDone = true; Storage.save(); startGame(); } }]);
    else startGame();
  });
  $('btn-howto').addEventListener('click', () => { Sound.init(); modal(HOWTO, [{ label: 'OK' }]); });
  $('btn-sound').addEventListener('click', () => { Storage.data.sound = !Storage.data.sound; Storage.save(); Sound.init(); Sound.tick(); renderTitle(); });
  $('btn-retry').addEventListener('click', () => afterResult(startGame));
  $('btn-title').addEventListener('click', () => afterResult(goTitle));
  $('btn-double').addEventListener('click', async () => {
    if (!G || G.doubled) return;
    const btn = $('btn-double'); btn.disabled = true;
    let ok = false; try { ok = await Ads.showRewarded(); } catch (e) { ok = false; }
    if (ok) {
      G.doubled = true; Storage.data.totalPoints += G.score.total; Storage.save();
      btn.textContent = `✓ 獲得ポイント2倍！（+${G.score.total}pt）`; $('res-score').textContent = `${G.score.total} ×2`;
    } else btn.disabled = false;
  });
  $('btn-share').addEventListener('click', async () => {
    if (!G) return;
    const text = G.outcome === 'bust'
      ? `【摘発カウントダウン】${fmtTime(G.min)}に摘発されました…売上${yen(G.sales)}（${G.score.total}点） #摘発カウントダウン`
      : `【摘発カウントダウン】朝まで逃げ切った！売上${yen(G.sales)}・警察を${G.stats.passed}回やり過ごし・${G.score.rank}ランク（${G.score.total}点） #摘発カウントダウン`;
    const url = location.href.split('?')[0];
    try {
      if (navigator.share) await navigator.share({ text, url });
      else { await navigator.clipboard.writeText(text + ' ' + url); const b = $('btn-share'); b.textContent = 'コピーしました'; setTimeout(() => { b.textContent = '結果をシェア'; }, 1500); }
    } catch (e) { /* キャンセル */ }
  });
  document.addEventListener('keydown', (e) => {
    if (state !== STATE.playing || !G || G.paused || e.repeat) return;
    if (e.code === 'Space' || e.code === 'Enter') { e.preventDefault(); seatGuest(); }
    else if (['1', '2', '3'].includes(e.key)) tapCast(G.casts[+e.key - 1]);
    else if (['q', 'w', 'e'].includes(e.key)) tapBoxCustomer('qwe'.indexOf(e.key));
  });
  document.addEventListener('visibilitychange', () => {
    if (document.hidden && state === STATE.playing && G && !G.paused) {
      G.paused = true; modal('<h2>一時停止中</h2>', [{ label: '再開', onClick: () => { G.paused = false; } }]);
    }
  });

  // ---------------------------------------------------------------- rendering
  const app = $('app');
  let scale = 1, VH = H, OY = 0;
  function resize() {
    const vw = window.innerWidth, vh = window.innerHeight;
    const w = Math.min(vw, (vh * 9) / 16), h = Math.min(vh, (w * 21) / 9);
    VH = (W * h) / w; OY = (VH - H) / 2;
    app.style.width = w + 'px'; app.style.height = h + 'px';
    document.documentElement.style.setProperty('--u', w / 360 + 'px');
    const dpr = Math.min(window.devicePixelRatio || 1, 3);
    canvas.width = Math.round(w * dpr); canvas.height = Math.round(h * dpr);
    scale = canvas.width / W;
  }
  window.addEventListener('resize', resize);

  const FONT = '"Hiragino Kaku Gothic ProN","Hiragino Sans","Noto Sans JP","Yu Gothic",Meiryo,sans-serif';
  function rr(x, y, w, h, r) {
    ctx.beginPath(); ctx.moveTo(x + r, y); ctx.arcTo(x + w, y, x + w, y + h, r); ctx.arcTo(x + w, y + h, x, y + h, r);
    ctx.arcTo(x, y + h, x, y, r); ctx.arcTo(x, y, x + w, y, r); ctx.closePath();
  }
  let T = 0;
  function neon(text, x, y, size, color, alpha = 1) {
    ctx.save(); ctx.globalAlpha *= alpha;
    ctx.font = `900 ${size}px ${FONT}`; ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
    ctx.shadowColor = color; ctx.shadowBlur = 16; ctx.fillStyle = color; ctx.fillText(text, x, y);
    ctx.shadowBlur = 3; ctx.fillStyle = '#fff'; ctx.globalAlpha *= 0.8; ctx.fillText(text, x, y);
    ctx.restore();
  }
  const flick = (s) => (Math.sin(T * 13 + s * 7) + Math.sin(T * 3.1 + s) > 1.75 ? 0.4 : 1);

  // 店内の静的背景をオフスクリーンに一度だけ描く
  let bgLayer = null;
  function buildBG() {
    const S = 2, off = document.createElement('canvas'); off.width = W * S; off.height = H * S;
    const c = off.getContext('2d'); c.scale(S, S);
    const r = mulberry32(777);
    const wall = c.createLinearGradient(0, 0, 0, 340);
    wall.addColorStop(0, '#1a0f2e'); wall.addColorStop(1, '#2a1640');
    c.fillStyle = wall; c.fillRect(0, 0, W, 340);
    c.globalAlpha = 0.18; c.fillStyle = '#000';
    for (let x = 0; x < W; x += 24) c.fillRect(x, 0, 2, 340);
    c.globalAlpha = 1;
    // 酒棚
    c.fillStyle = '#120a1f'; c.fillRect(14, 160, 262, 120);
    for (let row = 0; row < 3; row++) {
      const sy = 198 + row * 36;
      c.fillStyle = '#5a3a22'; c.fillRect(14, sy, 262, 5);
      for (let x = 22; x < 268; x += 11 + r() * 6) {
        const h = 16 + r() * 12, col = ['#3d7a3a', '#7a2a2a', '#c99a3a', '#2a4a7a', '#9a9aa8', '#5a2a6a'][Math.floor(r() * 6)];
        c.fillStyle = col; c.globalAlpha = 0.85;
        c.fillRect(x, sy - h, 7, h); c.fillRect(x + 2, sy - h - 6, 3, 6);
        c.globalAlpha = 0.35; c.fillStyle = '#fff'; c.fillRect(x + 1, sy - h + 2, 1.5, h - 4); c.globalAlpha = 1;
      }
    }
    // 床
    const floor = c.createLinearGradient(0, 330, 0, 640);
    floor.addColorStop(0, '#2b1b2e'); floor.addColorStop(1, '#100912');
    c.fillStyle = floor; c.fillRect(0, 330, W, 310);
    c.globalAlpha = 0.12; c.strokeStyle = '#ff9ccc'; c.lineWidth = 1;
    for (let i = -8; i < 16; i++) { c.beginPath(); c.moveTo(180 + i * 40, 330); c.lineTo(180 + i * 90, 700); c.stroke(); }
    c.globalAlpha = 1;
    bgLayer = off;
  }

  // ---------- people
  function drawHead(x, y, look, female) {
    if (female) { ctx.fillStyle = look.hair; rr(x - 12, y - 8, 24, 30, 9); ctx.fill(); }
    ctx.fillStyle = look.skin; ctx.beginPath(); ctx.arc(x, y, 10, 0, Math.PI * 2); ctx.fill();
    ctx.fillStyle = look.hair; ctx.beginPath(); ctx.arc(x, y - 2, 10.5, Math.PI * 1.02, Math.PI * 1.98); ctx.fill();
    if (look.glasses) { ctx.fillStyle = '#111'; ctx.fillRect(x - 9, y - 2, 18, 4); }
    if (look.cap) {
      ctx.fillStyle = '#16233f'; rr(x - 11, y - 15, 22, 8, 3); ctx.fill(); ctx.fillRect(x - 13, y - 8, 26, 3);
      ctx.fillStyle = '#ffd54f'; ctx.fillRect(x - 2, y - 13, 4, 4);
    }
    if (look.gold) { ctx.fillStyle = '#ffd54f'; ctx.fillRect(x - 1.5, y + 13, 3, 12); }
    if (female && look.hl) { ctx.fillStyle = look.hl; ctx.beginPath(); ctx.arc(x + 7, y - 7, 3, 0, Math.PI * 2); ctx.fill(); }
  }
  function drawStanding(x, y, look, opts = {}) {
    const bob = opts.walking ? Math.abs(Math.sin(opts.phase || 0)) * 2 : 0;
    const sw = opts.walking ? Math.sin(opts.phase || 0) * 3 : 0;
    ctx.fillStyle = 'rgba(0,0,0,0.35)'; ctx.beginPath(); ctx.ellipse(x, y + 2, 14, 4, 0, 0, Math.PI * 2); ctx.fill();
    if (opts.female) {
      ctx.fillStyle = look.skin; ctx.fillRect(x - 6 + sw, y - 22, 4, 22); ctx.fillRect(x + 2 - sw, y - 22, 4, 22);
      ctx.fillStyle = look.body; ctx.beginPath(); ctx.moveTo(x - 8, y - 56 - bob); ctx.lineTo(x + 8, y - 56 - bob); ctx.lineTo(x + 15, y - 20); ctx.lineTo(x - 15, y - 20); ctx.closePath(); ctx.fill();
    } else {
      ctx.fillStyle = '#16141f'; ctx.fillRect(x - 8 + sw, y - 24, 6, 24); ctx.fillRect(x + 2 - sw, y - 24, 6, 24);
      rr(x - 13, y - 58 - bob, 26, 36, 9); ctx.fillStyle = look.body; ctx.fill();
    }
    drawHead(x, y - 68 - bob, look, opts.female);
  }
  const castLook = (c) => ({ body: c.dress, hair: c.hair, skin: '#f6d2b8', hl: c.hl });

  function drawBubble(c) {
    ctx.save(); ctx.font = `bold 12px ${FONT}`;
    const text = c.text, w = Math.min(ctx.measureText(text).width + 20, 230), h = 30;
    const bx = clamp(c.x - w + 24, 6, W - 6 - w), by = c.y - 126;
    const gold = c.kind === 'vip';
    rr(bx, by, w, h, 10); ctx.fillStyle = gold ? '#fff6d6' : 'rgba(255,255,255,0.96)'; ctx.fill();
    ctx.strokeStyle = gold ? '#ffb300' : '#ff2e88'; ctx.lineWidth = 2; ctx.stroke();
    ctx.beginPath(); ctx.moveTo(c.x - 8, by + h); ctx.lineTo(c.x - 2, by + h + 8); ctx.lineTo(c.x + 2, by + h); ctx.fillStyle = gold ? '#fff6d6' : '#fff'; ctx.fill();
    ctx.fillStyle = '#1a1026'; ctx.textAlign = 'center'; ctx.textBaseline = 'middle'; ctx.fillText(text, bx + w / 2, by + 13);
    const p = clamp(c.wait / c.maxWait, 0, 1);
    ctx.fillStyle = '#ddd'; ctx.fillRect(bx + 10, by + h - 6, w - 20, 3);
    ctx.fillStyle = p > 0.5 ? '#2ecc71' : p > 0.25 ? '#f1c40f' : '#e74c3c'; ctx.fillRect(bx + 10, by + h - 6, (w - 20) * p, 3);
    ctx.restore();
  }

  function drawPolice(two) {
    const look = { body: '#24345a', hair: '#111', skin: '#f1c7a5', cap: true };
    if (two) drawStanding(DOOR.x + 2, 418, look);
    drawStanding(DOOR.x + 28, 428, look);
  }

  function drawCounterCast(c) {
    const x = CAST_HOME[c.i], y = COUNTER_TOP + 8;
    drawStanding(x, y, castLook(c), { female: true });
    if (G && state === STATE.playing && G.seats[c.i] && c.state === 'counter') {
      ctx.save(); ctx.font = `bold 10px ${FONT}`; ctx.textAlign = 'center'; ctx.fillStyle = '#ff9ccc';
      ctx.globalAlpha = 0.6 + 0.4 * Math.sin(T * 6); ctx.fillText('👆隣へ', x, y - 92); ctx.restore();
    }
  }

  // 後ろ姿で座っている人（カウンターに向かっている）
  function drawBack(x, seatY, look, opts = {}) {
    ctx.save(); ctx.translate(x, seatY); ctx.rotate(opts.lean || 0);
    ctx.fillStyle = opts.female ? look.skin : '#16141f';
    ctx.fillRect(-7, 2, 5, 20); ctx.fillRect(2, 2, 5, 20);
    if (opts.female) {
      ctx.fillStyle = look.body; ctx.beginPath(); ctx.moveTo(-9, -34); ctx.lineTo(9, -34); ctx.lineTo(14, 4); ctx.lineTo(-14, 4); ctx.closePath(); ctx.fill();
    } else { rr(-14, -38, 28, 42, 10); ctx.fillStyle = look.body; ctx.fill(); ctx.fillStyle = 'rgba(0,0,0,0.18)'; ctx.fillRect(-1, -34, 2, 36); }
    if (opts.arm) {
      ctx.strokeStyle = opts.female ? look.skin : look.body; ctx.lineWidth = 5; ctx.lineCap = 'round';
      ctx.beginPath(); ctx.moveTo(opts.arm * 9, -28); ctx.lineTo(opts.arm * 22, -24 + Math.sin(T * 5) * 2); ctx.stroke();
    }
    if (opts.drinkArm) { // グラスを口へ
      ctx.strokeStyle = look.body; ctx.lineWidth = 5; ctx.lineCap = 'round';
      ctx.beginPath(); ctx.moveTo(-9, -28); ctx.lineTo(-13, -46); ctx.stroke();
      ctx.font = `11px ${FONT}`; ctx.textAlign = 'center'; ctx.textBaseline = 'middle'; ctx.fillText(opts.drinkArm, -14, -52);
    }
    ctx.fillStyle = look.skin; ctx.beginPath(); ctx.arc(-10, -46, 3, 0, Math.PI * 2); ctx.arc(10, -46, 3, 0, Math.PI * 2); ctx.fill();
    ctx.fillStyle = look.hair; ctx.beginPath(); ctx.arc(0, -47, 10.5, 0, Math.PI * 2); ctx.fill();
    if (opts.female) { rr(-11, -48, 22, 30, 8); ctx.fill(); if (look.hl) { ctx.fillStyle = look.hl; ctx.beginPath(); ctx.arc(-6, -54, 3, 0, Math.PI * 2); ctx.fill(); } }
    if (look.gold) { ctx.fillStyle = '#ffd54f'; ctx.fillRect(-14, -12, 28, 3); }
    if (look.glasses) { ctx.fillStyle = '#111'; ctx.fillRect(-11, -47, 3, 2); ctx.fillRect(8, -47, 3, 2); }
    ctx.restore();
  }

  function drawStool(x) {
    ctx.fillStyle = '#1a1a1a'; ctx.fillRect(x - 2, SEAT_Y + 4, 4, 36);
    ctx.fillStyle = '#333'; ctx.fillRect(x - 10, SEAT_Y + 38, 20, 3);
    ctx.fillStyle = '#7a1f4a'; rr(x - 14, SEAT_Y - 2, 28, 9, 4); ctx.fill();
  }

  function label(text, x, y, color, size = 10) {
    ctx.save(); ctx.font = `bold ${size}px ${FONT}`; ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
    ctx.lineWidth = 3; ctx.strokeStyle = 'rgba(0,0,0,0.75)'; ctx.strokeText(text, x, y); ctx.fillStyle = color; ctx.fillText(text, x, y); ctx.restore();
  }

  function drawPair(i) {
    const cx = PAIR_X[i], b = G && G.seats[i], cast = G ? G.casts[i] : null;
    const withCast = cast && cast.state === 'box';
    const ux = cx + CUST_DX;
    // カウンター上の空きグラス（飲んだ分）
    if (b && b.drinks) {
      const icons = C.drinks.slice(0, Math.min(b.drinks, C.drinks.length)).map((d) => d[0]).join('');
      ctx.save(); ctx.globalAlpha = 0.55; ctx.font = `10px ${FONT}`; ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
      ctx.fillText(icons, cx, COUNTER_TOP - 12); ctx.restore();
    }
    drawStool(ux); drawStool(cx + CAST_DX);
    if (b) {
      const lean = b.cheer > 0 ? Math.sin(T * 30) * 0.08 : withCast ? 0.06 : 0;
      const sip = b.drinking > 0 ? b.glass : null;
      drawBack(ux, SEAT_Y, b.look, { lean, arm: withCast && !sip ? 1 : 0, drinkArm: sip });
      if (b.kind === 'vip' || b.kind === 'undercover') label(b.kind === 'vip' ? '💎' : '🕶', ux - 18, SEAT_Y - 60, '#fff', 12);
      // 滞在時間
      const p = clamp(b.stay / b.maxStay, 0, 1);
      ctx.fillStyle = 'rgba(255,255,255,0.2)'; ctx.fillRect(ux - 16, SEAT_Y + 46, 32, 3);
      ctx.fillStyle = '#ff9ccc'; ctx.fillRect(ux - 16, SEAT_Y + 46, 32 * p, 3);
      if (b.drinking > 0) {
        // 飲み終わるまでのゲージ
        const q = 1 - b.drinking / b.drinkMax;
        ctx.fillStyle = 'rgba(0,0,0,0.6)'; rr(ux - 18, SEAT_Y + 54, 36, 7, 3); ctx.fill();
        ctx.fillStyle = '#ffd54f'; rr(ux - 17, SEAT_Y + 55, 34 * q, 5, 2); ctx.fill();
        label('ゴクゴク…', ux, SEAT_Y + 70, '#fff', 9);
      } else if (withCast && !b.leaving && state === STATE.playing) {
        const next = C.drinks[Math.min(b.drinks, C.drinks.length - 1)];
        ctx.save(); ctx.globalAlpha = 0.75 + 0.25 * Math.sin(T * 8);
        label(b.drinks ? `👆おかわり${next[0]}` : `👆${next[0]}${next[1]}`, ux + 4, SEAT_Y + 62, '#ffe08a'); ctx.restore();
      }
    }
    if (withCast) {
      drawBack(cx + CAST_DX, SEAT_Y, castLook(cast), { female: true, lean: -0.14, arm: -1 });
      ctx.save(); ctx.globalAlpha = 0.7 + 0.3 * Math.sin(T * 5); ctx.font = `11px ${FONT}`; ctx.textAlign = 'center';
      ctx.fillText('💗', cx, SEAT_Y - 66 + Math.sin(T * 3) * 3); ctx.restore();
      label(cast.name, cx + CAST_DX + 2, SEAT_Y + 32, cast.hl, 9);
      if (G.visit) { // ノック中は隣のキャストを赤く強調
        ctx.save(); ctx.strokeStyle = '#ff3355'; ctx.lineWidth = 3; ctx.globalAlpha = 0.5 + 0.5 * Math.sin(T * 18);
        ctx.beginPath(); ctx.arc(cx + CAST_DX, SEAT_Y - 30, 30, 0, Math.PI * 2); ctx.stroke(); ctx.restore();
        label('👆逃がせ！', cx + CAST_DX, SEAT_Y - 70, '#ff6b85', 10);
      }
    }
  }

  function speech(text, x, y, color = '#fff', border = '#4d7cff') {
    ctx.save(); ctx.font = `bold 11px ${FONT}`;
    const w = ctx.measureText(text).width + 16, h = 24, bx = clamp(x - w / 2, 4, W - 4 - w);
    rr(bx, y - h, w, h, 8); ctx.fillStyle = color; ctx.fill(); ctx.strokeStyle = border; ctx.lineWidth = 2; ctx.stroke();
    ctx.fillStyle = '#1a1026'; ctx.textAlign = 'center'; ctx.textBaseline = 'middle'; ctx.fillText(text, bx + w / 2, y - h / 2);
    ctx.restore();
  }
  function drawQuestioning() {
    const look = { body: '#24345a', hair: '#111', skin: '#f1c7a5', cap: true };
    const p = G.caught.pos;
    drawStanding(DOOR.x + 28, 428, look); // 入口に立つ1人
    const t = clamp(G.bustT / 0.8, 0, 1), e = easeInOut(t);
    const tx = p.x + 30, ty = SEAT_Y + 40;
    const x = lerp(DOOR.x + 6, tx, e), y = lerp(422, ty, e);
    drawStanding(x, y, look, { walking: t < 1, phase: T * 12 });
    if (t >= 1) {
      speech('お姉さん、ここで何してるの？', clamp(x - 20, 90, 270), y - 92);
      if (G.bustT > 1.1) speech('えっと…お客さんの隣で接客を…', clamp(p.x, 100, 260), p.y - 64, '#ffe0ef', '#ff2e88');
    }
  }

  function render(dt) {
    T += dt;
    ctx.setTransform(scale, 0, 0, scale, 0, OY * scale);
    ctx.fillStyle = '#1a0f2e'; ctx.fillRect(0, -OY, W, OY + 2);
    ctx.fillStyle = '#100912'; ctx.fillRect(0, H - 2, W, OY + 4);
    ctx.save();
    if (G && G.shake > 0) ctx.translate((vrand() - 0.5) * 7, (vrand() - 0.5) * 7);
    if (bgLayer) ctx.drawImage(bgLayer, 0, 0, W, H);

    // 間接照明・店内ネオン
    const lamp = ctx.createRadialGradient(140, 150, 10, 140, 150, 220);
    lamp.addColorStop(0, 'rgba(255,120,200,0.18)'); lamp.addColorStop(1, 'rgba(255,120,200,0)');
    ctx.fillStyle = lamp; ctx.fillRect(0, 0, W, 360);
    neon(STORE, 145, 140, 22, '#ff5fb0', flick(1));
    neon('♪', 26, 140, 18, '#3ff2ff', flick(2));

    // ドア
    const v = G && G.visit;
    const doorOpen = (v && v.phase === 'inside') || (state === STATE.ending && G && G.outcome === 'bust');
    ctx.fillStyle = '#0d0716'; ctx.fillRect(DOOR.x - 4, DOOR.y - 4, DOOR.w + 8, DOOR.h + 4);
    if (doorOpen) {
      ctx.fillStyle = '#0a1028'; ctx.fillRect(DOOR.x, DOOR.y, DOOR.w, DOOR.h);
      ctx.fillStyle = '#5a3a66'; ctx.fillRect(DOOR.x, DOOR.y, 10, DOOR.h);
    } else {
      ctx.fillStyle = '#4a2d55'; ctx.fillRect(DOOR.x, DOOR.y, DOOR.w, DOOR.h);
      ctx.fillStyle = '#ffd54f'; ctx.fillRect(DOOR.x + 8, DOOR.y + 90, 4, 16);
      const win = { x: DOOR.x + 10, y: DOOR.y + 14, w: DOOR.w - 20, h: 48 };
      const knocking = v && v.phase === 'knock';
      ctx.fillStyle = knocking ? '#3a3f70' : '#1f2340'; ctx.fillRect(win.x, win.y, win.w, win.h);
      if (knocking) {
        ctx.save(); ctx.font = `30px ${FONT}`; ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
        ctx.fillText(v.who.icon, win.x + win.w / 2, win.y + win.h / 2 + 2); ctx.restore();
        ctx.save(); ctx.strokeStyle = v.kind === 'police' ? '#ff3355' : '#ffcc33'; ctx.lineWidth = 3;
        ctx.globalAlpha = 0.5 + 0.5 * Math.sin(T * 20); ctx.strokeRect(DOOR.x - 3, DOOR.y - 3, DOOR.w + 6, DOOR.h + 3); ctx.restore();
        ctx.save(); ctx.font = `bold 12px ${FONT}`; ctx.fillStyle = '#fff'; ctx.textAlign = 'center';
        ctx.fillText(v.reason === 'raid' ? 'ドンドン!!' : 'コンコン', DOOR.x + DOOR.w / 2 - 6 + Math.sin(T * 30) * 2, DOOR.y - 10); ctx.restore();
      }
      ctx.strokeStyle = '#2a1a33'; ctx.lineWidth = 2; ctx.strokeRect(win.x, win.y, win.w, win.h);
    }

    // カウンター内のキャスト（下半身はカウンターに隠れる）
    if (G) G.casts.forEach((c) => { if (c.state === 'counter') drawCounterCast(c); });
    else CASTS.forEach((c, i) => drawCounterCast({ ...c, i, state: 'counter' }));
    // マスター
    drawStanding(236, COUNTER_TOP + 10, { body: '#2b2b2b', hair: '#666', skin: '#e9bf9c' });
    ctx.fillStyle = '#ff2e88'; ctx.fillRect(232, COUNTER_TOP - 54, 8, 4);

    // カウンター
    ctx.fillStyle = '#6b3f22'; ctx.fillRect(0, COUNTER_TOP - 6, 284, 12);
    ctx.fillStyle = '#c98a4a'; ctx.fillRect(0, COUNTER_TOP - 6, 284, 3);
    ctx.fillStyle = '#3a2016'; ctx.fillRect(0, COUNTER_TOP + 6, 278, 58);
    ctx.save(); ctx.strokeStyle = '#ff2e88'; ctx.shadowColor = '#ff2e88'; ctx.shadowBlur = 8; ctx.lineWidth = 1.5;
    ctx.beginPath(); ctx.moveTo(0, COUNTER_TOP + 62); ctx.lineTo(278, COUNTER_TOP + 62); ctx.stroke(); ctx.restore();
    // カウンター席（客＋隣のキャスト）
    PAIR_X.forEach((_, i) => drawPair(i));

    if (G) {
      for (let i = G.queue.length - 1; i >= 0; i--) {
        const c = G.queue[i];
        drawStanding(c.x, c.y, c.look, { walking: c.walking, phase: c.phase });
      }
      if (G.queue[0] && Math.abs(G.queue[0].x - QUEUE[0].x) < 6 && state === STATE.playing) drawBubble(G.queue[0]);
      G.walkers.forEach((w) => { ctx.save(); ctx.globalAlpha = clamp(w.alpha, 0, 1) * 0.9; drawStanding(w.x, w.y, w.look, { walking: true, phase: w.phase }); ctx.restore(); });
      // 移動中のキャスト（最前面）
      G.casts.forEach((c) => { if (c.state === 'toBox' || c.state === 'toCounter') { const p = castPos(c); drawStanding(p.x, p.y, castLook(c), { female: true, walking: true, phase: T * 14 }); } });
      // 来訪者
      const bustNow = state === STATE.ending && G.outcome === 'bust';
      if (bustNow && G.caught) drawQuestioning();
      else if (v && v.phase === 'inside' && v.kind === 'police') {
        drawPolice(v.reason !== 'patrol');
        ctx.save(); ctx.globalAlpha = 0.16; ctx.fillStyle = '#fffbe0';
        const ang = Math.sin(T * 2.2) * 0.55 + Math.PI * 0.9;
        ctx.beginPath(); ctx.moveTo(DOOR.x + 18, 372); ctx.arc(DOOR.x + 18, 372, 330, ang - 0.17, ang + 0.17); ctx.closePath(); ctx.fill(); ctx.restore();
      } else if (v && v.phase === 'inside') {
        ctx.save(); ctx.font = `34px ${FONT}`; ctx.textAlign = 'center'; ctx.fillText(v.who.icon, DOOR.x + 28, 400); ctx.restore();
      }
      G.particles.forEach((q) => { ctx.globalAlpha = clamp(q.life, 0, 1); ctx.fillStyle = q.c; ctx.fillRect(q.x, q.y, 3, 3); });
      ctx.globalAlpha = 1;
      G.popups.forEach((q) => {
        ctx.save(); ctx.globalAlpha = clamp((q.life / q.max) * 1.5, 0, 1);
        ctx.font = `900 14px ${FONT}`; ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
        ctx.lineWidth = 4; ctx.strokeStyle = 'rgba(0,0,0,0.85)'; ctx.strokeText(q.text, q.x, q.y); ctx.fillStyle = q.color; ctx.fillText(q.text, q.x, q.y);
        ctx.restore();
      });
      if ((v && v.kind === 'police' && v.phase === 'inside') || (bustNow && G.bustT > 1.5)) {
        ctx.fillStyle = Math.floor(T * 5) % 2 ? 'rgba(255,30,60,0.14)' : 'rgba(30,90,255,0.14)'; ctx.fillRect(0, -OY, W, VH);
      }
      if (G.flash > 0 && (!bustNow || G.bustT > 1.5)) { ctx.fillStyle = `rgba(255,255,255,${G.flash * 0.6})`; ctx.fillRect(0, -OY, W, VH); }
      if (bustNow && G.bustT > 1.5) {
        const s = Math.min(1, (G.bustT - 1.5) * 3);
        ctx.save(); ctx.translate(180, 250); ctx.scale(0.5 + s * 0.6, 0.5 + s * 0.6); ctx.rotate(-0.12);
        ctx.fillStyle = '#d4001e'; rr(-110, -34, 220, 68, 8); ctx.fill();
        ctx.strokeStyle = '#fff'; ctx.lineWidth = 4; rr(-104, -28, 208, 56, 6); ctx.stroke();
        ctx.font = `900 40px ${FONT}`; ctx.fillStyle = '#fff'; ctx.textAlign = 'center'; ctx.textBaseline = 'middle'; ctx.fillText('摘 発 ！', 0, 2);
        ctx.restore();
      }
      if (state === STATE.ending && G.outcome === 'clear') { ctx.fillStyle = 'rgba(255,200,140,0.25)'; ctx.fillRect(0, -OY, W, VH); }
    }
    ctx.restore();
  }

  // ---------------------------------------------------------------- loop
  let last = performance.now();
  function frame(now) {
    const realDt = Math.min(0.1, Math.max(0, (now - last) / 1000)); last = now;
    try {
      update(realDt * SPEED);
      if (state === STATE.playing) updateHUD();
      render(realDt);
    } catch (e) { console.error(e); }
    requestAnimationFrame(frame);
  }

  Storage.load(); resize(); buildBG(); renderTitle();
  requestAnimationFrame(frame);

  // テスト用フック
  window.__game = { get state() { return state; }, get G() { return G; }, seatGuest, tapCast, tapBoxCustomer, startGame };
})();
