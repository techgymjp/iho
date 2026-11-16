/* =========================================================
 * 摘発カウントダウン - Web版
 * 表向きは「ただのバー」。実は女性キャストがカウンター席で客の隣に座って
 * 接客している（無許可）架空の店。お客さんはキャストと同伴で来店する。
 * ドアが開く音がしたら要注意。警察なら、キャストをタップしてカウンターの中へ！
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
  const IS_NATIVE = !!(window.Capacitor && window.Capacitor.isNativePlatform && window.Capacitor.isNativePlatform());
  const STORE = 'BAR 夜更し';

  // ---------------------------------------------------------------- utils
  function clamp(v, a, b) { return Math.max(a, Math.min(b, v)); }
  function lerp(a, b, t) { return a + (b - a) * t; }
  function easeInOut(t) { return t < 0.5 ? 2 * t * t : 1 - Math.pow(-2 * t + 2, 2) / 2; }
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
    key: 'tekihatsu_countdown_v4',
    data: { bestScore: 0, plays: 0, totalSales: 0, sound: true, tutorialDone: false, sinceAd: 0 },
    load() { try { const d = JSON.parse(localStorage.getItem(this.key)); if (d) Object.assign(this.data, d); } catch (e) { /* noop */ } },
    save() { try { localStorage.setItem(this.key, JSON.stringify(this.data)); } catch (e) { /* noop */ } },
  };

  // ---------------------------------------------------------------- sound
  const Sound = {
    ctx: null, noiseBuf: null,
    get on() { return Storage.data.sound; },
    init() {
      if (!this.ctx) { try { this.ctx = new (window.AudioContext || window.webkitAudioContext)(); } catch (e) { this.ctx = null; } }
      if (this.ctx && this.ctx.state === 'suspended') this.ctx.resume();
      if (this.ctx && this.on && !document.hidden) Music.start();
    },
    ensureNoise() {
      if (this.noiseBuf || !this.ctx) return;
      const n = this.ctx.sampleRate; this.noiseBuf = this.ctx.createBuffer(1, n, n);
      const d = this.noiseBuf.getChannelData(0); for (let i = 0; i < n; i++) d[i] = Math.random() * 2 - 1;
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
    noise(dur, vol, when = 0, freq = 800) {
      if (!this.on || !this.ctx) return;
      this.ensureNoise();
      const t = this.ctx.currentTime + when;
      const src = this.ctx.createBufferSource(), f = this.ctx.createBiquadFilter(), g = this.ctx.createGain();
      src.buffer = this.noiseBuf; f.type = 'bandpass'; f.frequency.value = freq; f.Q.value = 1.2;
      g.gain.setValueAtTime(vol, t); g.gain.exponentialRampToValueAtTime(0.0001, t + dur);
      src.connect(f).connect(g).connect(this.ctx.destination); src.start(t); src.stop(t + dur + 0.05);
    },
    // 金属ベルの一打（非整数倍音で「カーン」という響き）
    bellStrike(freq, when, dur, vol) {
      [[1, 1], [2.76, 0.45], [5.4, 0.22], [8.93, 0.1]].forEach(([r, v], i) => {
        this.tone(freq * r * (1 + (Math.random() - 0.5) * 0.004), dur / (1 + i * 0.8), 'sine', vol * v, when);
      });
      this.noise(0.015, vol * 0.6, when, freq * 3); // 打撃のアタック
    },
    // ドアチャイム「カランコロン」— お客さんも警察も同じ音
    door() {
      this.noise(0.04, 0.12, 0, 1500);              // ドアノブ（カチャ）
      this.bellStrike(1980, 0.05, 0.25, 0.07);      // カ
      this.bellStrike(1760, 0.12, 0.7, 0.08);       // ラン
      this.bellStrike(1480, 0.34, 0.25, 0.07);      // コ
      this.bellStrike(1245, 0.41, 0.9, 0.08);       // ロン
      this.bellStrike(1760, 0.62, 0.5, 0.025);      // 余韻の揺れ
    },
    steps() { for (let i = 0; i < 3; i++) this.noise(0.08, 0.35, 0.35 + i * 0.22, 220); },
    coin(p = 0) { this.tone(988 + p * 120, 0.06, 'square', 0.05); this.tone(1319 + p * 160, 0.14, 'square', 0.05, 0.05); },
    pour() { this.tone(500, 0.12, 'sine', 0.06, 0, 900); },
    tower() { [784, 988, 1175, 1568, 1976].forEach((f, i) => this.tone(f, 0.18, 'triangle', 0.08, i * 0.07)); },
    whoosh() { this.tone(900, 0.12, 'sine', 0.06, 0, 300); },
    notify() { this.tone(880, 0.1, 'sine', 0.08); this.tone(660, 0.16, 'sine', 0.08, 0.1); },
    fanfare() { [523, 659, 784, 1047].forEach((f, i) => this.tone(f, 0.16, 'triangle', 0.09, i * 0.09)); },
    clear() { [523, 659, 784, 1047, 1319].forEach((f, i) => this.tone(f, 0.25, 'triangle', 0.1, i * 0.12)); },
    warn() { for (let i = 0; i < 3; i++) this.tone(220, 0.16, 'square', 0.06, i * 0.2); },
    siren() { for (let i = 0; i < 4; i++) this.tone(650, 0.42, 'sawtooth', 0.06, i * 0.45, 1050); },
    tick() { this.tone(1200, 0.03, 'square', 0.035); },
    relief() { this.tone(400, 0.2, 'sine', 0.08, 0, 600); this.tone(600, 0.25, 'sine', 0.08, 0.18, 900); },
  };


  // ---------------------------------------------------------------- BGM（ナイトバー風ジャズをリアルタイム合成）
  // ウォーキングベース＋エレピのコンピング＋ブラシ/ライド＋時々ビブラフォン。スウィングの8小節ループ。
  const Music = {
    playing: false, nextTime: 0, step: 0, timer: null, out: null, filter: null,
    // 8小節：Dm9 | G13 | Cmaj9 | A7(b9) | Em9 | A13 | Dm9 | G7(alt)
    PROG: [
      { root: 38, v: [53, 57, 60, 64] }, { root: 43, v: [53, 59, 64, 69] },
      { root: 36, v: [52, 55, 59, 62] }, { root: 45, v: [55, 58, 61, 64] },
      { root: 40, v: [55, 59, 62, 66] }, { root: 45, v: [55, 61, 66, 69] },
      { root: 38, v: [53, 57, 60, 64] }, { root: 43, v: [53, 59, 63, 68] },
    ],
    COMP: [[3, 6], [2, 5], [3], [1, 4, 7], [0, 3], [3, 7]],
    start() {
      const a = Sound.ctx;
      if (!a || !Sound.on || this.playing) return;
      this.out = a.createGain(); this.out.gain.value = 0;
      this.filter = a.createBiquadFilter(); this.filter.type = 'lowpass'; this.filter.frequency.value = 12000;
      this.out.connect(this.filter).connect(a.destination);
      this.out.gain.linearRampToValueAtTime(C.bgmVolume, a.currentTime + 1.5);
      this.playing = true; this.step = 0; this.nextTime = a.currentTime + 0.15; this.walk = null;
      this.timer = setInterval(() => this.tick(), 40);
    },
    stop(fade = 0.6) {
      if (!this.playing) return;
      const a = Sound.ctx, o = this.out, f = this.filter;
      o.gain.cancelScheduledValues(a.currentTime); o.gain.setValueAtTime(o.gain.value, a.currentTime);
      o.gain.linearRampToValueAtTime(0, a.currentTime + fade);
      clearInterval(this.timer); this.playing = false;
      setTimeout(() => { try { o.disconnect(); f.disconnect(); } catch (e) { /* noop */ } }, fade * 1000 + 400);
    },
    // 警察が店内にいる間は音がこもって小さくなる
    tension(on) {
      if (!this.playing) return;
      const t = Sound.ctx.currentTime;
      this.filter.frequency.setTargetAtTime(on ? 450 : 12000, t, 0.12);
      this.out.gain.setTargetAtTime(on ? C.bgmVolume * 0.55 : C.bgmVolume, t, 0.2);
    },
    tick() {
      const a = Sound.ctx; if (!a) return;
      if (this.nextTime < a.currentTime - 0.1) this.nextTime = a.currentTime + 0.05; // タブ復帰時の取りこぼし対策
      const beat = 60 / C.bgmTempo;
      while (this.nextTime < a.currentTime + 0.25) {
        this.schedule(this.step, this.nextTime);
        this.nextTime += this.step % 2 === 0 ? beat * 2 / 3 : beat / 3; // スウィング
        this.step++;
      }
    },
    schedule(step, t) {
      const bar = Math.floor(step / 8) % 8, pos = step % 8, onBeat = pos % 2 === 0, beatNo = pos >> 1;
      const ch = this.PROG[bar], next = this.PROG[(bar + 1) % 8];
      if (pos === 0) { // 小節ごとにウォーキングラインとコンプのリズムを決める
        const r = ch.root, third = ch.v[0] % 12 === (r + 3) % 12 ? 3 : 4;
        const approach = next.root + (Math.random() < 0.5 ? -1 : 1);
        this.walk = [r, r + (Math.random() < 0.5 ? 7 : third), r + (Math.random() < 0.5 ? 12 : 10), approach];
        this.comp = this.COMP[Math.floor(Math.random() * this.COMP.length)];
      }
      if (onBeat) this.bass(this.walk[beatNo], t);
      // ライド：チーン、チーン・カ、チーン、チーン・カ
      if (onBeat) this.ride(t, 0.05); else if (pos === 3 || pos === 7) this.ride(t, 0.032);
      // ハイハット（2・4拍）とブラシ
      if (pos === 2 || pos === 6) { this.hat(t); this.brush(t); }
      if (pos === 0 && Math.random() < 0.6) this.kick(t);
      if (this.comp.includes(pos)) this.epiano(ch.v, t, onBeat ? 0.9 : 0.6);
      if (Math.random() < 0.16 && bar % 2 === 1) this.vibe(ch.v[Math.floor(Math.random() * 4)] + 12, t);
    },
    f(m) { return 440 * Math.pow(2, (m - 69) / 12); },
    env(node, t, vol, a, d) {
      const g = Sound.ctx.createGain();
      g.gain.setValueAtTime(0.0001, t); g.gain.exponentialRampToValueAtTime(vol, t + a); g.gain.exponentialRampToValueAtTime(0.0001, t + a + d);
      node.connect(g).connect(this.out); return g;
    },
    osc(type, freq, t, vol, a, d) {
      const o = Sound.ctx.createOscillator(); o.type = type; o.frequency.setValueAtTime(freq, t);
      this.env(o, t, vol, a, d); o.start(t); o.stop(t + a + d + 0.05); return o;
    },
    noise(t, vol, d, type, freq) {
      const a = Sound.ctx; Sound.ensureNoise();
      const src = a.createBufferSource(); src.buffer = Sound.noiseBuf;
      const fl = a.createBiquadFilter(); fl.type = type; fl.frequency.value = freq;
      src.connect(fl); this.env(fl, t, vol, 0.003, d);
      src.start(t, Math.random() * 0.5); src.stop(t + d + 0.05);
    },
    bass(m, t) { const fr = this.f(m); this.osc('sine', fr, t, 0.32, 0.01, 0.55); this.osc('triangle', fr, t, 0.12, 0.005, 0.25); },
    epiano(notes, t, len) {
      notes.forEach((m, i) => {
        const fr = this.f(m), tt = t + i * 0.008;
        this.osc('sine', fr, tt, 0.045, 0.015, len + 0.6);
        this.osc('sine', fr * 2, tt, 0.012, 0.005, 0.35); // ベルっぽい倍音
      });
    },
    vibe(m, t) { const fr = this.f(m); this.osc('sine', fr, t, 0.06, 0.005, 1.3); this.osc('sine', fr * 4, t, 0.008, 0.002, 0.2); },
    ride(t, vol) { this.noise(t, vol, 0.28, 'highpass', 6500); this.osc('sine', 5400 + Math.random() * 200, t, vol * 0.15, 0.002, 0.3); },
    hat(t) { this.noise(t, 0.04, 0.05, 'highpass', 8000); },
    brush(t) { this.noise(t, 0.035, 0.18, 'bandpass', 2800); },
    kick(t) { const o = Sound.ctx.createOscillator(); o.frequency.setValueAtTime(95, t); o.frequency.exponentialRampToValueAtTime(48, t + 0.12); this.env(o, t, 0.12, 0.005, 0.16); o.start(t); o.stop(t + 0.25); },
  };

  // ---------------------------------------------------------------- ads（Web版はダミー。失敗してもゲーム継続）
  const Ads = {
    // Web版では広告を出さない。ネイティブアプリ（Android）で動いている時だけ有効。
    available() { return C.ads.enabled && !NO_ADS && IS_NATIVE; },
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
  const CAST_ROSTER = window.Art.CASTS;
  const COLORS = ['#2b3a67', '#3a3a46', '#5a3e2b', '#4a4f5a', '#5b2a3a', '#2f4f4f', '#6b6b78', '#3d2f5a'];
  const TIES = ['#b3263c', '#2a6fd6', '#d6a12a', '#7a2ab3', '#1f8a5b', '#d64f8a'];
  const HAIRS = ['#1b1b1b', '#3e2723', '#5d4037', '#262626', '#8d6e63', '#9e9e9e'];

  // レイアウト（論理座標）
  const DOOR = { x: 294, y: 236, w: 58, h: 204 };
  const ENTRY = { x: DOOR.x + 28, y: 452 };     // ドアを入ったところ
  const COUNTER_TOP = 372;
  const CAST_HOME = [44, 104, 164];             // カウンターの中（逃げ込む場所）
  const PAIR_X = [52, 144, 236];                // カウンター席（客＋隣のキャスト）の中心
  const CUST_DX = -21, CAST_DX = 21;
  const SEAT_Y = 492;                           // スツールの座面
  const SEAT_S = 1.15;                          // 座っている2人の拡大率
  const LOOK = { x: 214, y: 552 };              // 警察が店内を見回す位置

  // ---------------------------------------------------------------- game state
  const STATE = { title: 'title', playing: 'playing', ending: 'ending', result: 'result' };
  let state = STATE.title;
  let G = null;

  function newGame() {
    const seed = params.get('seed');
    rng = seed !== null ? mulberry32(parseInt(seed, 10) || 0) : Math.random;
    G = {
      elapsed: 0, min: 0, sales: 0, customers: 0, heat: 0,
      seats: Array(C.seats).fill(null),   // 着席中の客
      casts: Array(C.seats).fill(null),   // その客と同伴のキャスト
      walkers: [], popups: [], particles: [], fx: [], alertT: 0, heatFlash: 0,
      spawnT: 0.6, buzzLeft: 0, vipNext: 0, vipCount: 0,
      visit: null, visitT: rand(...C.visitIntervalSeconds),
      inspAt: (C.inspectionHour + 24 - C.openingHour) * 60 + rand(-C.inspectionJitterMinutes, C.inspectionJitterMinutes),
      inspected: false, sleepyT: 0, crackdownT: 0, doorT: 0,
      events: scheduleEvents(),
      stats: { passed: 0, drinks: 0, towers: 0, escapes: 0 },
      outcome: null, paused: false, shake: 0, flash: 0, bustT: 0, caught: null,
    };
  }

  function scheduleEvents() {
    const n = randInt(C.minRandomEvents, C.maxRandomEvents);
    const pool = ['buzz', 'vip', 'tipoff', 'sleepy', 'crackdown'];
    const list = []; let prev = null, vips = 0;
    for (let i = 0; i < n; i++) {
      let t, guard = 0;
      do { t = pick(pool); guard++; } while ((t === prev || (t === 'vip' && vips >= C.maxVipEvents)) && guard < 50);
      if (t === 'vip') vips++;
      prev = t; list.push(t);
    }
    return list.map((type, i) => ({ type, at: (0.08 + (0.84 * (i + rand(0.2, 0.8))) / n) * TOTAL_MIN, done: false }));
  }

  // 位置
  const custSeatFeet = (i) => ({ x: PAIR_X[i] + CUST_DX, y: SEAT_Y + 34 });
  const castSeatFeet = (i) => ({ x: PAIR_X[i] + CAST_DX, y: SEAT_Y + 34 });
  const castHome = (i) => ({ x: CAST_HOME[i], y: COUNTER_TOP + 8 });

  // 隣に座っている・隣へ移動中・逃げ切れていない＝警察に見られたらアウト
  const castExposed = (c) => c && (c.state === 'box' || c.state === 'toBox' || c.state === 'toCounter');
  const settaiCount = () => G.casts.filter((c) => c && c.state === 'box').length;
  const policeInStore = () => !!G.visit;

  // ---------- 来店（客＋同伴キャスト）
  function spawnPair(kind = 'normal') {
    const i = G.seats.indexOf(null);
    if (i < 0) return false;
    const used = G.casts.filter(Boolean).map((c) => c.name);
    const free = CAST_ROSTER.filter((c) => !used.includes(c.name));
    const cast = { ...pick(free.length ? free : CAST_ROSTER), i, state: 'toBox', t: 0, dur: C.pairEnterSeconds, from: { ...ENTRY } };
    const look = {
      body: kind === 'vip' ? '#1c1c22' : COLORS[Math.floor(vrand() * COLORS.length)],
      hair: HAIRS[Math.floor(vrand() * HAIRS.length)], skin: vrand() < 0.5 ? '#f6d3bb' : '#e8b896', gold: kind === 'vip',
      tie: TIES[Math.floor(vrand() * TIES.length)],
    };
    const stay = rand(...C.staySeconds) * (kind === 'vip' ? 1.4 : 1);
    G.seats[i] = { kind, look, enterT: 0, stay, maxStay: stay, drinks: 0, drinking: 0, drinkMax: 1, glass: null, leaving: 0, cheer: 0, charged: false };
    G.casts[i] = cast;
    openDoor();
    burst(kind === 'vip' ? '💎' : '💕', ENTRY.x - 14, 300, kind === 'vip' ? 1.3 : 0.9);
    return true;
  }
  function openDoor(t = 0.7) { G.doorT = Math.max(G.doorT, t); Sound.door(); }

  function seatedAt(i) { const b = G.seats[i]; return b && b.enterT >= 1; }

  // ---------- キャスト
  function castPos(c) {
    if (c.state === 'box') return castSeatFeet(c.i);
    if (c.state === 'counter') return castHome(c.i);
    const to = c.state === 'toBox' ? castSeatFeet(c.i) : castHome(c.i);
    const e = easeInOut(clamp(c.t, 0, 1));
    const hop = c.from.y === ENTRY.y && c.from.x === ENTRY.x ? 0 : 26; // 入店時は歩く、逃げる時はぴょんと跳ぶ
    return { x: lerp(c.from.x, to.x, e), y: lerp(c.from.y, to.y, e) - Math.sin(e * Math.PI) * hop };
  }
  function moveCast(c, where) {
    c.from = castPos(c);
    c.state = where === 'box' ? 'toBox' : 'toCounter';
    c.t = 0; c.dur = where === 'box' ? C.castToBoxSeconds : C.castToCounterSeconds;
    Sound.whoosh();
  }
  function tapCast(c) {
    if (state !== STATE.playing || G.paused || !c) return;
    if (c.state === 'box' || c.state === 'toBox') {
      moveCast(c, 'counter'); G.stats.escapes++;
      burst('💨', castHome(c.i).x + 14, 270, 0.6);
    } else if (c.state === 'counter') {
      if (G.seats[c.i]) moveCast(c, 'box');
    }
  }

  // ---------- お酒（隣にキャストがいる時だけ。飲み終わったら、またタップでおかわり）
  function tapCustomer(i) {
    if (state !== STATE.playing || G.paused) return;
    const b = G.seats[i]; if (!b || b.leaving || b.enterT < 1) return;
    const c = G.casts[i];
    if (!c || c.state !== 'box') { burst('💔', custSeatFeet(i).x, 380, 0.6); b.nope = 0.3; Sound.tick(); return; }
    if (b.drinking > 0) { b.nope = 0.3; Sound.tick(); return; }
    const d = C.drinks[Math.min(b.drinks, C.drinks.length - 1)];
    const price = d[2] * (b.kind === 'vip' ? C.vipDrinkMultiplier : 1);
    b.drinks++; G.stats.drinks++;
    b.glass = d[0]; b.drinkMax = b.drinking = C.drinkSeconds * (b.kind === 'vip' ? 0.7 : 1);
    b.stay = Math.max(b.stay, b.drinking + 0.6);
    G.heat = Math.min(100, G.heat + C.heatPerDrink);
    addSales(price, PAIR_X[i], 395, price >= 20000 ? '#ffd54f' : '#7CFFB2');
    burst(d[0], PAIR_X[i] - 12, 372, 0.6 + b.drinks * 0.12);
    b.cheer = 0.4;
    if (b.drinks >= C.drinks.length) {
      G.stats.towers++; Sound.tower(); G.shake = 0.15;
      b.leaving = b.drinking + 0.5;
      burst('🥂', PAIR_X[i], 330, 1.5); for (let k = 0; k < 6; k++) burst('✨', PAIR_X[i] + (vrand() - 0.5) * 60, 330 + (vrand() - 0.5) * 40, 0.6);
    } else { Sound.pour(); Sound.coin(b.drinks); }
  }

  function addSales(amount, x, y, color) {
    G.sales += amount;
    popup('+' + yen(amount), x, y, color || '#7CFFB2');
    for (let k = 0; k < 5; k++) G.particles.push({ x, y, vx: (vrand() - 0.5) * 110, vy: -50 - vrand() * 70, life: 0.7, c: '#ffd54f' });
  }

  // 帰る：客とキャスト（お見送り）が一緒にドアへ
  function pairLeaves(i) {
    const b = G.seats[i], c = G.casts[i];
    const cp = custSeatFeet(i);
    G.walkers.push({ look: b.look, x: cp.x, y: cp.y, alpha: 1, phase: 0 });
    if (c) { const p = castPos(c); G.walkers.push({ look: castLook(c), female: true, x: p.x, y: p.y, alpha: 1, phase: 1, delay: 0.15 }); }
    G.seats[i] = null; G.casts[i] = null;
  }

  // ---------- 警察（ドアの開く音で入ってくる）
  function startVisit(reason) {
    let enter = reason === 'raid' ? C.raidWarningSeconds : lerp(C.warningSecondsSafe, C.warningSecondsHot, G.heat / 100);
    if (G.sleepyT > 0) enter *= C.sleepyLookoutFactor;
    G.visit = { reason, phase: 'enter', t: enter, max: enter, x: ENTRY.x, y: ENTRY.y };
    Music.tension(true);
    openDoor(enter + 0.2);
    Sound.steps();
    G.alertT = 1.2;
    if (reason === 'raid') { burst('🚨', 180, 250, 2.0); Sound.siren(); }
  }
  function updateVisit(dt) {
    const v = G.visit;
    v.t -= dt;
    if (v.phase === 'enter') {
      const e = easeInOut(clamp(1 - v.t / v.max, 0, 1));
      v.x = lerp(ENTRY.x, LOOK.x, e); v.y = lerp(ENTRY.y, LOOK.y, e);
      if (v.t > 0) return;
      v.phase = 'look'; v.t = C.policeInsideSeconds;
      burst(v.reason === 'inspection' ? '📋' : '🔦', v.x, v.y - 120, 1.0);
      Sound.siren();
    }
    if (v.phase === 'look' || v.phase === 'exit') {
      const caught = G.casts.find(castExposed);
      if (caught) { bust(caught); return; }
    }
    if (v.phase === 'look' && v.t <= 0) {
      v.phase = 'exit'; v.t = C.policeExitSeconds;
      burst('🙆', G.visit.x, G.visit.y - 120, 1.0);
      return;
    }
    if (v.phase === 'exit') {
      const e = easeInOut(clamp(1 - v.t / C.policeExitSeconds, 0, 1));
      v.x = lerp(LOOK.x, ENTRY.x, e); v.y = lerp(LOOK.y, ENTRY.y, e);
      if (v.t > 0) return;
      openDoor(0.4);
      G.stats.passed++;
      G.heat = clamp(G.heat + C.heatAfterPassedVisit, 0, 100);
      Sound.relief();
      burst('🆗', 180, 250, 1.6); for (let k = 0; k < 8; k++) burst('✨', 180 + (vrand() - 0.5) * 200, 250 + (vrand() - 0.5) * 100, 0.7);
      G.visit = null; Music.tension(false);
      const k = lerp(1, C.visitIntervalAtMaxHeat, G.heat / 100) * (G.crackdownT > 0 ? 0.5 : 1);
      G.visitT = rand(...C.visitIntervalSeconds) * k;
      G.spawnT = Math.min(G.spawnT, 0.8);
    }
  }

  // 警察がキャストに聞き込みをした時点でアウト
  function bust(cast) {
    G.outcome = 'bust'; state = STATE.ending; G.bustT = 0;
    Music.stop(0.25);
    G.caught = { name: cast.name, pos: castPos(cast), from: { x: G.visit.x, y: G.visit.y } };

    Sound.warn();
    setTimeout(() => { if (!G) return; Sound.siren(); G.shake = 0.6; G.flash = 1; }, 1500);
    setTimeout(finish, 3300);
  }

  // ---------- events
  function runEvent(type) {
    switch (type) {
      case 'buzz': G.buzzLeft = C.buzzExtraCustomers; G.spawnT = Math.min(G.spawnT, 0.3); eventIcon('📱', '💕'); Sound.notify(); break;
      case 'vip':
        if (G.vipCount >= C.maxVipEvents) return;
        G.vipCount++; G.vipNext++; G.spawnT = Math.min(G.spawnT, 0.3);
        eventIcon('💎', '✨'); Sound.fanfare(); break;
      case 'tipoff':
        G.heat = Math.min(100, G.heat + C.heatTipOff);
        eventIcon('📢', '👁'); G.heatFlash = 1.2; Sound.warn(); break;
      case 'sleepy': G.sleepyT = C.sleepyLookoutSeconds; eventIcon('😪', '💤'); Sound.notify(); break;
      case 'crackdown':
        G.crackdownT = C.crackdownSeconds; G.visitT = Math.min(G.visitT, rand(1.5, 3));
        eventIcon('🚓', '🚨'); Sound.notify(); break;
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
      G.outcome = 'clear'; state = STATE.ending;
      Sound.clear(); burst('🌅', 180, 260, 2.4);
      setTimeout(finish, 1500); return;
    }
    for (const e of G.events) if (!e.done && G.min >= e.at) { e.done = true; runEvent(e.type); }

    // 来店（警察がいる間は来ない）
    if (!policeInStore()) {
      G.spawnT -= dt;
      if (G.spawnT <= 0) {
        const kind = G.vipNext > 0 ? 'vip' : 'normal';
        if (spawnPair(kind)) {
          if (kind === 'vip') G.vipNext--;
          if (G.buzzLeft > 0) { G.buzzLeft--; G.spawnT = rand(0.5, 0.9); } else G.spawnT = rand(C.minCustomerInterval, C.maxCustomerInterval);
        } else G.spawnT = 0.4; // 満席なら少し待つ
      }
    }

    // 客
    G.seats.forEach((b, i) => {
      if (!b) return;
      if (b.enterT < 1) {
        b.enterT = Math.min(1, b.enterT + dt / C.pairEnterSeconds);
        if (b.enterT >= 1 && !b.charged) { b.charged = true; G.customers++; addSales(C.setCharge, custSeatFeet(i).x, 395, '#9be7ff'); Sound.coin(); }
        return;
      }
      if (b.cheer > 0) b.cheer -= dt;
      if (b.drinking > 0) b.drinking -= dt;
      if (b.leaving > 0) { b.leaving -= dt; if (b.leaving <= 0) b.stay = 0; }
      if ((b.stay -= dt) <= 0) pairLeaves(i);
    });
    // キャスト移動
    G.casts.forEach((c) => {
      if (!c || (c.state !== 'toBox' && c.state !== 'toCounter')) return;
      c.t += dt / c.dur;
      if (c.t >= 1) c.state = c.state === 'toBox' ? 'box' : 'counter';
    });

    // 疑惑ゲージ
    const st = settaiCount();
    if (st > 0) G.heat = Math.min(100, G.heat + st * C.heatPerSettaiSecond * dt);
    else G.heat = Math.max(0, G.heat - C.heatDecayNoSettai * dt);
    if (G.sleepyT > 0) G.sleepyT -= dt;
    if (G.crackdownT > 0) G.crackdownT -= dt;

    // 警察
    if (G.visit) updateVisit(dt);
    else if (!G.inspected && G.min >= G.inspAt) { G.inspected = true; startVisit('inspection'); }
    else if (G.heat >= 100) startVisit('raid');
    else if ((G.visitT -= dt) <= 0) startVisit('patrol');
  }

  function animate(dt) {
    G.walkers.forEach((w) => {
      if (w.delay > 0) { w.delay -= dt; return; }
      const dx = ENTRY.x - w.x, dy = ENTRY.y - w.y, d = Math.hypot(dx, dy), step = 190 * dt;
      if (d > step) { w.x += (dx / d) * step; w.y += (dy / d) * step; w.phase += dt * 12; }
      else { if (!w.out) { w.out = true; G.doorT = Math.max(G.doorT, 0.4); } w.alpha -= dt * 4; }
    });
    G.walkers = G.walkers.filter((w) => w.alpha > 0);
    G.popups.forEach((p) => { p.y -= 30 * dt; p.life -= dt; });
    G.fx.forEach((f) => { f.t += dt; }); G.fx = G.fx.filter((f) => f.t < f.life);
    if (G.alertT > 0) G.alertT -= dt; if (G.heatFlash > 0) G.heatFlash -= dt;
    G.seats.forEach((b) => { if (b && b.nope > 0) b.nope -= dt; });
    G.popups = G.popups.filter((p) => p.life > 0);
    G.particles.forEach((p) => { p.x += p.vx * dt; p.y += p.vy * dt; p.vy += 260 * dt; p.life -= dt; });
    G.particles = G.particles.filter((p) => p.life > 0);
    if (G.shake > 0) G.shake -= dt;
    if (G.flash > 0) G.flash -= dt * 0.8;
    if (G.doorT > 0) G.doorT -= dt;
  }

  // ---------- end
  // スコア＝売上高
  function computeScore() {
    const total = G.sales;
    const rank = C.ranks.find(([, m]) => total >= m)[0];
    return { total, rank };
  }
  function finish() {
    if (state === STATE.result || !G) return;
    state = STATE.result;
    G.score = computeScore();
    const d = Storage.data;
    d.plays++; d.totalSales += G.sales;
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
  // 文字の代わりに絵文字がポンと弾ける演出
  function burst(icon, x, y, size = 1) { if (G) G.fx.push({ icon, x, y, size, t: 0, life: 0.9 + size * 0.25 }); }
  function eventIcon(main, sub) {
    burst(main, 180, 250, 2.2);
    for (let k = 0; k < 6; k++) { const a = (k / 6) * Math.PI * 2; burst(sub, 180 + Math.cos(a) * 70, 250 + Math.sin(a) * 45, 0.8); }
  }

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
    setText('hud-cust', G.customers + '組');
    $('heat-fill').style.width = G.heat + '%';
    $('heat-fill').className = G.heat > 80 || G.heatFlash > 0 ? 'hot' : G.heat > 50 ? 'warm' : '';
    const st = G.casts.filter(castExposed).length;
    setText('hud-mode', st ? '💗'.repeat(st) : '🍸');
    $('hud-mode').className = 'mode ' + (st ? 'settai' : 'bar');
  }

  function showResult() {
    const r = G.score, bust = G.outcome === 'bust';
    $('res-headline').textContent = bust ? '🚨 摘発…' : '🌅 今夜も逃げ切った！';
    $('res-headline').className = 'res-headline ' + (bust ? 'bust' : 'clear');
    const news = $('res-news');
    news.classList.toggle('hidden', !bust);
    if (bust) news.innerHTML = `<small>ネオン横丁新聞（架空）</small><b>「${STORE}」を摘発<br>バーと偽り 無許可で接待営業の疑い</b><span>${fmtTime(G.min)}ごろ、警察が店内に立ち入ったところ、女性従業員が客の隣に座って接客していたという。</span>`;
    $('res-sales').textContent = yen(G.sales);
    $('res-cust').textContent = G.customers + '組';
    $('res-rank').textContent = r.rank + 'ランク'; $('res-rank').className = 'rank-' + r.rank;
    $('res-pass').textContent = G.stats.passed + '回';
    $('res-time').textContent = fmtTime(G.min) + 'まで';
    $('res-best').textContent = G.newBest ? '🏆 NEW BEST SCORE!' : `BEST ${yen(Storage.data.bestScore)}`;
    $('res-breakdown').textContent = `お酒 ${G.stats.drinks}杯（タワー ${G.stats.towers}回） ・ キャストを逃がした ${G.stats.escapes}回`;
    $('res-tip').innerHTML = '<b>💡 現実では</b> 客の隣に座って談笑・お酌をするなどの「接待」をする営業には、風俗営業の許可が必要とされています。許可なく接待営業を行うことは法律で禁止されています。<small>※本作はフィクションです。説明は一般的な内容を簡略化したものです。</small>';
    const dbl = $('btn-double');
    dbl.classList.toggle('hidden', !Ads.available()); dbl.disabled = false; dbl.textContent = '▶ 広告を見て売上2倍（任意）';
    G.doubled = false;
    showScreen('result');
  }

  function startGame() {
    Sound.init(); newGame(); state = STATE.playing; Music.tension(false);
    Object.keys(cache).forEach((k) => delete cache[k]);
    $('toast-area').innerHTML = '';
    showScreen('game'); updateHUD();
    burst('🍸', 180, 250, 1.8);
  }
  function goTitle() { state = STATE.title; G = null; renderTitle(); showScreen('title'); }
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
    $('title-best').textContent = yen(d.bestScore);
    $('title-stats').textContent = d.plays ? `プレイ ${d.plays}回 ・ 累計売上 ${yen(d.totalSales)}` : '';
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
    <p>あなたは「${STORE}」のオーナー。表向きはただのバーだけど、実は<b>女性キャストがカウンター席でお客さんの隣に座って接客</b>している（もちろん無許可）。<b>22:00〜翌5:00（45秒）</b>、摘発されずに稼ぎ切れ！</p>
    <ul class="howto">
      <li><b>🚪 来店</b>：お客さんはキャストと同伴でやって来て、カウンターに並んで座る。</li>
      <li><b>👆 お客さんをタップ</b>：お酒が出る。飲み終わったら、またタップでおかわり！ ビール→ハイボール→ワイン→シャンパン→タワーと単価UP。</li>
      <li><b>🔔 ドアの開く音に注意</b>：お客さんも警察も同じ音で入ってくる。<b>👮警察だったら、隣のキャストをタップしてカウンターの中へ逃がせ！</b></li>
      <li>警察がキャストに聞き込みをしたらその時点でアウト（摘発）。警察が出ていくまで油断禁止。</li>
      <li>警察が帰ったら、カウンターの中のキャストをタップしてまた隣へ。お酒や接待で「疑惑」が溜まると警察が来やすくなり、MAXで踏み込まれる！ 3時ごろの立入調査は必ず来る。</li>
    </ul>
    <p class="small">※本作はフィクションです。現実の無許可営業は法律で禁止されています。</p>`;

  // ---------------------------------------------------------------- input
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
      if (!c) return;
      const p = castPos(c);
      const cy = c.state === 'counter' ? p.y - 62 : c.state === 'box' ? p.y - 58 : p.y - 45;
      const d = Math.hypot(x - p.x, (y - cy) * 0.75);
      if (d < 28 && d < bd) { bd = d; best = c; }
    });
    if (best) { tapCast(best); return; }
    for (let i = 0; i < C.seats; i++) {
      if (Math.abs(x - PAIR_X[i]) < 46 && y > SEAT_Y - 90 && y < SEAT_Y + 45) {
        if (x < PAIR_X[i]) tapCustomer(i); else tapCast(G.casts[i]);
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
  $('btn-sound').addEventListener('click', () => {
    Storage.data.sound = !Storage.data.sound; Storage.save();
    if (!Storage.data.sound) Music.stop(0.3);
    Sound.init(); Sound.door(); renderTitle();
  });
  $('btn-retry').addEventListener('click', () => afterResult(startGame));
  $('btn-title').addEventListener('click', () => afterResult(goTitle));
  $('btn-double').addEventListener('click', async () => {
    if (!G || G.doubled) return;
    const btn = $('btn-double'); btn.disabled = true;
    let ok = false; try { ok = await Ads.showRewarded(); } catch (e) { ok = false; }
    if (ok) {
      G.doubled = true; G.score.total *= 2;
      const d = Storage.data; d.totalSales += G.sales;
      if (G.score.total > d.bestScore) { d.bestScore = G.score.total; $('res-best').textContent = '🏆 NEW BEST SCORE!'; }
      Storage.save();
      btn.textContent = '✓ 売上2倍！'; $('res-sales').textContent = yen(G.score.total);
    } else btn.disabled = false;
  });
  $('btn-share').addEventListener('click', async () => {
    if (!G) return;
    const text = G.outcome === 'bust'
      ? `【摘発カウントダウン】${fmtTime(G.min)}に摘発されました…売上${yen(G.score.total)} #摘発カウントダウン`
      : `【摘発カウントダウン】朝まで逃げ切った！売上${yen(G.score.total)}・警察を${G.stats.passed}回やり過ごし・${G.score.rank}ランク #摘発カウントダウン`;
    const url = location.href.split('?')[0];
    try {
      if (navigator.share) await navigator.share({ text, url });
      else { await navigator.clipboard.writeText(text + ' ' + url); const b = $('btn-share'); b.textContent = 'コピーしました'; setTimeout(() => { b.textContent = '結果をシェア'; }, 1500); }
    } catch (e) { /* キャンセル */ }
  });
  document.addEventListener('keydown', (e) => {
    if (state !== STATE.playing || !G || G.paused || e.repeat) return;
    if (['1', '2', '3'].includes(e.key)) tapCast(G.casts[+e.key - 1]);
    else if (['q', 'w', 'e'].includes(e.key)) tapCustomer('qwe'.indexOf(e.key));
  });
  document.addEventListener('visibilitychange', () => {
    if (Sound.ctx) { if (document.hidden) Sound.ctx.suspend(); else Sound.ctx.resume(); }
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
  function label(text, x, y, color, size = 10) {
    ctx.save(); ctx.font = `bold ${size}px ${FONT}`; ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
    ctx.lineWidth = 3; ctx.strokeStyle = 'rgba(0,0,0,0.75)'; ctx.strokeText(text, x, y); ctx.fillStyle = color; ctx.fillText(text, x, y); ctx.restore();
  }

  // 店内の静的背景
  let bgLayer = null;
  function buildBG() {
    const S = 2, off = document.createElement('canvas'); off.width = W * S; off.height = H * S;
    const c = off.getContext('2d'); c.scale(S, S);
    const r = mulberry32(777);
    const wall = c.createLinearGradient(0, 0, 0, 430);
    wall.addColorStop(0, '#1a0f2e'); wall.addColorStop(1, '#2a1640');
    c.fillStyle = wall; c.fillRect(0, 0, W, 430);
    c.globalAlpha = 0.18; c.fillStyle = '#000';
    for (let x = 0; x < W; x += 24) c.fillRect(x, 0, 2, 430);
    c.globalAlpha = 1;
    c.fillStyle = '#120a1f'; c.fillRect(14, 176, 262, 136);
    for (let row = 0; row < 3; row++) {
      const sy = 218 + row * 40;
      c.fillStyle = '#5a3a22'; c.fillRect(14, sy, 262, 5);
      for (let x = 22; x < 268; x += 11 + r() * 6) {
        const h = 16 + r() * 12, col = ['#3d7a3a', '#7a2a2a', '#c99a3a', '#2a4a7a', '#9a9aa8', '#5a2a6a'][Math.floor(r() * 6)];
        c.fillStyle = col; c.globalAlpha = 0.85;
        c.fillRect(x, sy - h, 7, h); c.fillRect(x + 2, sy - h - 6, 3, 6);
        c.globalAlpha = 0.35; c.fillStyle = '#fff'; c.fillRect(x + 1, sy - h + 2, 1.5, h - 4); c.globalAlpha = 1;
      }
    }
    const floor = c.createLinearGradient(0, 430, 0, 640);
    floor.addColorStop(0, '#2b1b2e'); floor.addColorStop(1, '#100912');
    c.fillStyle = floor; c.fillRect(0, 430, W, 210);
    c.globalAlpha = 0.12; c.strokeStyle = '#ff9ccc'; c.lineWidth = 1;
    for (let i = -8; i < 16; i++) { c.beginPath(); c.moveTo(180 + i * 40, 430); c.lineTo(180 + i * 90, 700); c.stroke(); }
    c.globalAlpha = 1;
    bgLayer = off;
  }

  // ---------- people
  function drawStanding(x, y, look, opts = {}) {
    if (opts.female) Art.girlFront(ctx, x, y, opts.s || 1, look, T, opts);
    else Art.manFront(ctx, x, y, opts.s || 1, look, T, opts);
  }
  function drawBack(x, seatY, look, opts = {}) {
    if (opts.female) Art.girlBack(ctx, x, seatY, SEAT_S, look, T, opts);
    else Art.manBack(ctx, x, seatY, SEAT_S, look, T, { lean: opts.lean, arm: opts.arm, drink: opts.drinkArm });
  }
  const castLook = (c) => c;
  const POLICE = { police: true, hair: '#141414', skin: '#f1c7a5' };
  const MASTER = { vest: true, hair: '#8a8a8a', skin: '#ecc3a3' };

  function drawStool(x) {
    ctx.fillStyle = '#1a1a1a'; ctx.fillRect(x - 2, SEAT_Y + 4, 4, 36);
    ctx.fillStyle = '#333'; ctx.fillRect(x - 10, SEAT_Y + 38, 20, 3);
    ctx.fillStyle = '#7a1f4a'; rr(x - 14, SEAT_Y - 2, 28, 9, 4); ctx.fill();
  }

  // カウンターの中に逃げ込んだキャスト（下半身はカウンターに隠れる）
  function drawHiddenCast(c) {
    const p = castHome(c.i);
    drawStanding(p.x, p.y, castLook(c), { female: true });
    if (state === STATE.playing && !G.visit) {
      finger(p.x + 10, p.y - 96, '💗');
    }
  }

  function drawPair(i) {
    const cx = PAIR_X[i], b = G && G.seats[i], cast = G && G.casts[i];
    const seated = b && b.enterT >= 1;
    const withCast = cast && cast.state === 'box';
    const ux = cx + CUST_DX;
    if (seated && b.drinks) {
      const icons = C.drinks.slice(0, Math.min(b.drinks, C.drinks.length)).map((d) => d[0]).join('');
      ctx.save(); ctx.globalAlpha = 0.55; ctx.font = `10px ${FONT}`; ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
      ctx.fillText(icons, cx, COUNTER_TOP - 12); ctx.restore();
    }
    drawStool(ux); drawStool(cx + CAST_DX);
    if (seated) {
      const lean = b.cheer > 0 ? Math.sin(T * 30) * 0.08 : withCast ? 0.06 : 0;
      const sip = b.drinking > 0 ? b.glass : null;
      const nope = b.nope > 0 ? Math.sin(T * 60) * 0.06 : 0;
      drawBack(ux, SEAT_Y, b.look, { lean: lean + nope, arm: withCast && !sip ? 1 : 0, drinkArm: sip });
      if (b.kind === 'vip') { emoji('💎', ux - 16, SEAT_Y - 62, 13); Art.sparkle(ctx, ux + 10, SEAT_Y - 50, 3 + Math.sin(T * 6) * 1.5, 0.9, '#fff3b0'); }
      const p = clamp(b.stay / b.maxStay, 0, 1);
      ctx.fillStyle = 'rgba(255,255,255,0.2)'; ctx.fillRect(ux - 16, SEAT_Y + 46, 32, 3);
      ctx.fillStyle = '#ff9ccc'; ctx.fillRect(ux - 16, SEAT_Y + 46, 32 * p, 3);
      if (b.drinking > 0) {
        const q = 1 - b.drinking / b.drinkMax;
        ctx.fillStyle = 'rgba(0,0,0,0.6)'; rr(ux - 18, SEAT_Y + 54, 36, 7, 3); ctx.fill();
        ctx.fillStyle = '#ffd54f'; rr(ux - 17, SEAT_Y + 55, 34 * q, 5, 2); ctx.fill();

      } else if (withCast && !b.leaving && state === STATE.playing) {
        const next = C.drinks[Math.min(b.drinks, C.drinks.length - 1)];
        finger(ux, SEAT_Y - 82, next[0]);
      }
    }
    if (withCast) {
      drawBack(cx + CAST_DX, SEAT_Y, castLook(cast), { female: true, lean: -0.14, arm: -1 });
      ctx.save(); ctx.globalAlpha = 0.7 + 0.3 * Math.sin(T * 5); ctx.font = `11px ${FONT}`; ctx.textAlign = 'center';
      ctx.fillText('💗', cx, SEAT_Y - 66 + Math.sin(T * 3) * 3); ctx.restore();

      if (G.visit && state === STATE.playing) {
        ctx.save(); ctx.strokeStyle = '#ff3355'; ctx.lineWidth = 3; ctx.globalAlpha = 0.5 + 0.5 * Math.sin(T * 18);
        ctx.beginPath(); ctx.arc(cx + CAST_DX, SEAT_Y - 30, 30, 0, Math.PI * 2); ctx.stroke(); ctx.restore();
        emoji('❗', cx + CAST_DX, SEAT_Y - 86 + Math.sin(T * 14) * 3, 20);
      }
    }
  }

  function emoji(ch, x, y, size) {
    ctx.save(); ctx.font = `${size}px ${FONT}`; ctx.textAlign = 'center'; ctx.textBaseline = 'middle'; ctx.fillText(ch, x, y); ctx.restore();
  }
  // タップの合図（指が揺れる）＋何が起きるかのアイコン
  function finger(x, y, icon) {
    const b = Math.sin(T * 9) * 3;
    ctx.save(); ctx.globalAlpha = 0.95;
    ctx.fillStyle = 'rgba(255,255,255,0.92)'; ctx.beginPath(); ctx.arc(x, y + b, 11, 0, Math.PI * 2); ctx.fill();
    ctx.strokeStyle = '#ff2e88'; ctx.lineWidth = 2; ctx.stroke();
    emoji(icon, x, y + b + 1, 13);
    emoji('👆', x + 9, y + b + 16 + Math.abs(Math.sin(T * 9)) * 3, 15);
    ctx.restore();
  }
  function iconBubble(ch, x, y, color = '#fff', border = '#4d7cff') {
    ctx.save(); const s = 1 + Math.sin(T * 8) * 0.06; ctx.translate(x, y); ctx.scale(s, s);
    ctx.beginPath(); ctx.arc(0, 0, 15, 0, Math.PI * 2); ctx.fillStyle = color; ctx.fill(); ctx.strokeStyle = border; ctx.lineWidth = 2.5; ctx.stroke();
    ctx.beginPath(); ctx.moveTo(-4, 13); ctx.lineTo(0, 22); ctx.lineTo(5, 12); ctx.fill();
    emoji(ch, 0, 1, 17); ctx.restore();
  }
  function speech(text, x, y, color = '#fff', border = '#4d7cff') {
    ctx.save(); ctx.font = `bold 11px ${FONT}`;
    const w = ctx.measureText(text).width + 16, h = 24, bx = clamp(x - w / 2, 4, W - 4 - w);
    rr(bx, y - h, w, h, 8); ctx.fillStyle = color; ctx.fill(); ctx.strokeStyle = border; ctx.lineWidth = 2; ctx.stroke();
    ctx.fillStyle = '#1a1026'; ctx.textAlign = 'center'; ctx.textBaseline = 'middle'; ctx.fillText(text, bx + w / 2, y - h / 2);
    ctx.restore();
  }
  function drawQuestioning() {
    const p = G.caught.pos, f = G.caught.from;
    const t = clamp(G.bustT / 0.7, 0, 1), e = easeInOut(t);
    const tx = p.x + 30, ty = Math.max(p.y + 6, SEAT_Y + 40);
    const x = lerp(f.x, tx, e), y = lerp(f.y, ty, e);
    drawStanding(ENTRY.x + 4, ENTRY.y + 6, POLICE);
    drawStanding(x, y, POLICE, { walking: t < 1, phase: T * 12 });
    if (t >= 1) {
      iconBubble('❓', x + 4, y - 112);
      if (G.bustT > 1.0) iconBubble('💦', p.x - 8, p.y - 100, '#ffe0ef', '#ff2e88');
    }
  }

  const SPARKS = Array.from({ length: 22 }, (_, i) => ({ x: (i * 73 + 20) % 350 + 5, y: (i * 131) % 430 + 90, p: i * 0.77, r: 1.6 + (i % 4) * 0.8 }));
  const SPECKS = Array.from({ length: 16 }, (_, i) => ({ a: (i / 16) * Math.PI * 2, d: 70 + (i % 5) * 38, c: ['#ff9ccc', '#9be7ff', '#fff3b0', '#c9a6ff'][i % 4] }));
  function drawMirrorBall() {
    const bx = 236, by = 104;
    ctx.strokeStyle = '#555'; ctx.lineWidth = 1; ctx.beginPath(); ctx.moveTo(bx, 70); ctx.lineTo(bx, by - 11); ctx.stroke();
    const g = ctx.createRadialGradient(bx - 4, by - 4, 2, bx, by, 12); g.addColorStop(0, '#ffffff'); g.addColorStop(0.5, '#b9b6d0'); g.addColorStop(1, '#4a4766');
    ctx.fillStyle = g; ctx.beginPath(); ctx.arc(bx, by, 11, 0, Math.PI * 2); ctx.fill();
    ctx.strokeStyle = 'rgba(40,30,60,0.45)'; ctx.lineWidth = 0.6;
    for (let k = -2; k <= 2; k++) { ctx.beginPath(); ctx.moveTo(bx - 11, by + k * 4.4); ctx.lineTo(bx + 11, by + k * 4.4); ctx.stroke(); }
    for (let k = -2; k <= 2; k++) { const o = ((T * 8 + k * 4.4) % 22) - 11; ctx.beginPath(); ctx.moveTo(bx + o, by - 10); ctx.lineTo(bx + o, by + 10); ctx.stroke(); }
    Art.sparkle(ctx, bx - 5, by - 5, 3 + Math.sin(T * 7) * 1.5, 0.9);
    // 壁に映る光の粒
    SPECKS.forEach((sp, i) => {
      const a = sp.a + T * 0.35, x = bx + Math.cos(a) * sp.d * 1.4, y = by + 60 + Math.sin(a) * sp.d * 0.9;
      if (y < 60 || y > 420) return;
      ctx.fillStyle = sp.c; ctx.globalAlpha = 0.25 + 0.2 * Math.sin(T * 3 + i);
      ctx.beginPath(); ctx.arc(x, y, 2.2, 0, Math.PI * 2); ctx.fill();
    });
    ctx.globalAlpha = 1;
  }
  function drawSparkles(alpha = 1) {
    SPARKS.forEach((p) => {
      const k = Math.max(0, Math.sin(T * 1.8 + p.p * 3));
      if (k > 0.05) Art.sparkle(ctx, p.x, p.y, p.r * (0.6 + k), alpha * k);
    });
  }

  function render(dt) {
    T += dt;
    ctx.setTransform(scale, 0, 0, scale, 0, OY * scale);
    ctx.fillStyle = '#1a0f2e'; ctx.fillRect(0, -OY, W, OY + 2);
    ctx.fillStyle = '#100912'; ctx.fillRect(0, H - 2, W, OY + 4);
    ctx.save();
    if (G && G.shake > 0) ctx.translate((vrand() - 0.5) * 7, (vrand() - 0.5) * 7);
    if (bgLayer) ctx.drawImage(bgLayer, 0, 0, W, H);

    const lamp = ctx.createRadialGradient(140, 150, 10, 140, 150, 220);
    lamp.addColorStop(0, 'rgba(255,120,200,0.18)'); lamp.addColorStop(1, 'rgba(255,120,200,0)');
    ctx.fillStyle = lamp; ctx.fillRect(0, 0, W, 360);
    neon(STORE, 145, 152, 24, '#ff5fb0', flick(1));
    neon('♪', 26, 152, 18, '#3ff2ff', flick(2));
    drawMirrorBall();

    // ドア
    const open = G && G.doorT > 0;
    ctx.fillStyle = '#0d0716'; ctx.fillRect(DOOR.x - 4, DOOR.y - 4, DOOR.w + 8, DOOR.h + 4);
    if (open) {
      ctx.fillStyle = '#0a1028'; ctx.fillRect(DOOR.x, DOOR.y, DOOR.w, DOOR.h);
      const g = ctx.createLinearGradient(DOOR.x, 0, DOOR.x + DOOR.w, 0); g.addColorStop(0, 'rgba(120,150,255,0.25)'); g.addColorStop(1, 'rgba(120,150,255,0)');
      ctx.fillStyle = g; ctx.fillRect(DOOR.x, DOOR.y, DOOR.w, DOOR.h);
      ctx.fillStyle = '#5a3a66'; ctx.fillRect(DOOR.x, DOOR.y, 12, DOOR.h);
    } else {
      ctx.fillStyle = '#4a2d55'; ctx.fillRect(DOOR.x, DOOR.y, DOOR.w, DOOR.h);
      ctx.fillStyle = '#ffd54f'; ctx.fillRect(DOOR.x + 8, DOOR.y + 96, 4, 16);
      ctx.fillStyle = '#1f2340'; ctx.fillRect(DOOR.x + 10, DOOR.y + 14, DOOR.w - 20, 46);
      ctx.strokeStyle = '#2a1a33'; ctx.lineWidth = 2; ctx.strokeRect(DOOR.x + 10, DOOR.y + 14, DOOR.w - 20, 46);
    }
    // ドアベル
    const ring = open ? Math.sin(T * 40) * 0.4 : 0;
    ctx.save(); ctx.translate(DOOR.x + DOOR.w - 8, DOOR.y - 2); ctx.rotate(ring);
    ctx.fillStyle = '#ffd54f'; ctx.beginPath(); ctx.moveTo(-5, 12); ctx.lineTo(5, 12); ctx.lineTo(3, 2); ctx.lineTo(-3, 2); ctx.closePath(); ctx.fill(); ctx.restore();
    if (open && G && state === STATE.playing) { emoji('🔔', DOOR.x + DOOR.w - 8 + Math.sin(T * 40) * 2, DOOR.y - 16, 16); emoji('♪', DOOR.x + 6, DOOR.y - 14 - (T * 30 % 14), 14); }

    // カウンターの中のキャスト
    if (G) G.casts.forEach((c) => { if (c && c.state === 'counter') drawHiddenCast(c); });
    // マスター
    drawStanding(236, COUNTER_TOP + 10, MASTER);

    // カウンター
    ctx.fillStyle = '#6b3f22'; ctx.fillRect(0, COUNTER_TOP - 6, 284, 12);
    ctx.fillStyle = '#c98a4a'; ctx.fillRect(0, COUNTER_TOP - 6, 284, 3);
    ctx.fillStyle = '#3a2016'; ctx.fillRect(0, COUNTER_TOP + 6, 278, 58);
    ctx.save(); ctx.strokeStyle = '#ff2e88'; ctx.shadowColor = '#ff2e88'; ctx.shadowBlur = 8; ctx.lineWidth = 1.5;
    ctx.beginPath(); ctx.moveTo(0, COUNTER_TOP + 62); ctx.lineTo(278, COUNTER_TOP + 62); ctx.stroke(); ctx.restore();
    PAIR_X.forEach((_, i) => drawPair(i));

    if (G) {
      // 入店中の客
      G.seats.forEach((b, i) => {
        if (!b || b.enterT >= 1) return;
        const to = custSeatFeet(i), e = easeInOut(b.enterT);
        drawStanding(lerp(ENTRY.x - 10, to.x, e), lerp(ENTRY.y, to.y, e), b.look, { walking: true, phase: T * 12 });
      });
      // 帰る客・お見送りのキャスト
      G.walkers.forEach((w) => { ctx.save(); ctx.globalAlpha = clamp(w.alpha, 0, 1); drawStanding(w.x, w.y, w.look, { walking: true, phase: w.phase, female: w.female }); ctx.restore(); });
      // 移動中のキャスト（最前面）
      G.casts.forEach((c) => { if (c && (c.state === 'toBox' || c.state === 'toCounter')) { const p = castPos(c); drawStanding(p.x, p.y, castLook(c), { female: true, walking: true, phase: T * 14 }); } });
      // 警察
      const bustNow = state === STATE.ending && G.outcome === 'bust';
      const v = G.visit;
      if (bustNow && G.caught) drawQuestioning();
      else if (v) {
        if (v.reason !== 'patrol') drawStanding(ENTRY.x + 4, ENTRY.y + 6, POLICE);
        drawStanding(v.x, v.y, POLICE, { walking: v.phase !== 'look', phase: T * 12 });
        if (v.phase === 'look') {
          ctx.save(); ctx.globalAlpha = 0.16; ctx.fillStyle = '#fffbe0';
          const ang = Math.sin(T * 2.2) * 0.6 + Math.PI * 1.15;
          ctx.beginPath(); ctx.moveTo(v.x - 8, v.y - 50); ctx.arc(v.x - 8, v.y - 50, 300, ang - 0.2, ang + 0.2); ctx.closePath(); ctx.fill(); ctx.restore();
          emoji('👀', v.x, v.y - 104, 18);
        }
      }
      G.particles.forEach((q) => { ctx.globalAlpha = clamp(q.life, 0, 1); ctx.fillStyle = q.c; ctx.fillRect(q.x, q.y, 3, 3); });
      ctx.globalAlpha = 1;
      G.fx.forEach((f) => {
        const k = f.t / f.life, pop = k < 0.2 ? easeInOut(k / 0.2) * 1.25 : 1.25 - Math.min(0.25, (k - 0.2) * 1.2);
        ctx.save(); ctx.globalAlpha = k > 0.7 ? (1 - k) / 0.3 : 1;
        emoji(f.icon, f.x, f.y - k * 24, 26 * f.size * pop); ctx.restore();
      });
      // 警察が来た瞬間：画面の縁が赤青に光る＋🚨
      if (v && state === STATE.playing) {
        const on = Math.floor(T * 6) % 2;
        const g = ctx.createRadialGradient(180, 320, 140, 180, 320, 380);
        g.addColorStop(0, 'rgba(0,0,0,0)'); g.addColorStop(1, on ? 'rgba(255,30,60,0.55)' : 'rgba(30,90,255,0.55)');
        ctx.fillStyle = g; ctx.fillRect(0, -OY, W, VH);
        if (v.phase === 'enter') emoji('🚨', 330, 150 + Math.sin(T * 20) * 3, 30 + (G.alertT > 0 ? G.alertT * 14 : 0));
      }
      ctx.globalAlpha = 1;
      G.popups.forEach((q) => {
        ctx.save(); ctx.globalAlpha = clamp((q.life / q.max) * 1.5, 0, 1);
        ctx.font = `900 13px ${FONT}`; ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
        ctx.lineWidth = 4; ctx.strokeStyle = 'rgba(0,0,0,0.85)'; ctx.strokeText(q.text, q.x, q.y); ctx.fillStyle = q.color; ctx.fillText(q.text, q.x, q.y);
        ctx.restore();
      });
      if ((v && v.phase === 'look') || (bustNow && G.bustT > 1.5)) {
        ctx.fillStyle = Math.floor(T * 5) % 2 ? 'rgba(255,30,60,0.12)' : 'rgba(30,90,255,0.12)'; ctx.fillRect(0, -OY, W, VH);
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
      drawSparkles(0.6);
    } else {
      // タイトル：キャスト勢ぞろい
      ctx.fillStyle = 'rgba(10,4,24,0.55)'; ctx.fillRect(0, -OY, W, VH);
      const glow = ctx.createRadialGradient(180, 330, 10, 180, 330, 170);
      glow.addColorStop(0, 'rgba(255,110,190,0.45)'); glow.addColorStop(1, 'rgba(255,110,190,0)');
      ctx.fillStyle = glow; ctx.fillRect(0, 140, W, 360);
      drawSparkles(1);
      [[1, 64, 442, 1.85], [3, 296, 442, 1.85], [0, 128, 452, 2.05], [5, 232, 452, 2.05], [2, 180, 462, 2.3]].forEach(([k, x, y, sc]) =>
        drawStanding(x, y, CAST_ROSTER[k], { female: true, s: sc }));
      drawSparkles(0.8);
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

  // ブラウザの制約で、最初のタップ時にBGMを開始する
  document.addEventListener('pointerdown', () => Sound.init(), { once: false, passive: true });
  Storage.load(); resize(); buildBG(); renderTitle();
  requestAnimationFrame(frame);

  // テスト用フック
  window.__game = { get state() { return state; }, get G() { return G; }, tapCast, tapCustomer, startGame, Music };
})();
