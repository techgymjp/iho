/* =========================================================
 * 摘発カウントダウン - Web版 MVP
 * 架空の繁華街「ネオン横丁」を舞台にしたワンタップ経営ゲーム。
 * 実在の人物・店舗・事件とは無関係のフィクションです。
 * ========================================================= */
(() => {
  'use strict';
  const C = window.CONFIG;
  const W = 360, H = 640;              // 論理解像度（9:16）
  const TOTAL_MIN = C.gameHours * 60;  // 420分
  const params = new URLSearchParams(location.search);
  const SPEED = clamp(parseFloat(params.get('speed')) || 1, 0.25, 20); // テスト用
  const NO_ADS = params.get('noads') === '1';

  // ---------------------------------------------------------------- utils
  function clamp(v, a, b) { return Math.max(a, Math.min(b, v)); }
  function yen(n) { return (n < 0 ? '-' : '') + '¥' + Math.abs(Math.round(n)).toLocaleString('ja-JP'); }
  function $(id) { return document.getElementById(id); }
  function lerp(a, b, t) { return a + (b - a) * t; }
  function mixColor(c1, c2, t) {
    const p = (c) => [1, 3, 5].map((i) => parseInt(c.slice(i, i + 2), 16));
    const a = p(c1), b = p(c2);
    return 'rgb(' + a.map((v, i) => Math.round(lerp(v, b[i], t))).join(',') + ')';
  }
  // 乱数シード注入可能（?seed=123 でイベントを再現できる）
  function mulberry32(a) {
    return function () {
      a |= 0; a = (a + 0x6D2B79F5) | 0;
      let t = Math.imul(a ^ (a >>> 15), 1 | a);
      t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
      return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
    };
  }
  let rng = Math.random;
  const rand = (a, b) => a + rng() * (b - a);
  const randInt = (a, b) => Math.floor(rand(a, b + 1));
  const pick = (arr) => arr[Math.floor(rng() * arr.length)];
  const vrand = Math.random; // 見た目だけの乱数（ゲーム結果に影響しない）

  // ---------------------------------------------------------------- storage
  const Storage = {
    key: 'tekihatsu_countdown_v1',
    data: { bestScore: 0, plays: 0, totalSales: 0, totalPoints: 0, sound: true, tutorialDone: false, lastType: 'generalRestaurant' },
    load() { try { const d = JSON.parse(localStorage.getItem(this.key)); if (d) Object.assign(this.data, d); } catch (e) { /* noop */ } },
    save() { try { localStorage.setItem(this.key, JSON.stringify(this.data)); } catch (e) { /* noop */ } },
  };

  // ---------------------------------------------------------------- sound (WebAudio 生成音)
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
    bell() { this.tone(1568, 0.25, 'sine', 0.06); this.tone(2093, 0.3, 'sine', 0.05, 0.08); },
    coin() { this.tone(988, 0.07, 'square', 0.06); this.tone(1319, 0.16, 'square', 0.06, 0.06); },
    refuse() { this.tone(520, 0.08, 'triangle', 0.08); this.tone(390, 0.12, 'triangle', 0.08, 0.08); },
    notify() { this.tone(880, 0.1, 'sine', 0.1); this.tone(660, 0.16, 'sine', 0.1, 0.1); },
    fanfare() { [523, 659, 784, 1047].forEach((f, i) => this.tone(f, 0.16, 'triangle', 0.1, i * 0.09)); },
    clear() { [523, 659, 784, 1047, 1319].forEach((f, i) => this.tone(f, 0.25, 'triangle', 0.1, i * 0.12)); },
    warn() { for (let i = 0; i < 3; i++) this.tone(220, 0.18, 'square', 0.07, i * 0.22); },
    siren() { for (let i = 0; i < 3; i++) this.tone(650, 0.42, 'sawtooth', 0.05, i * 0.45, 1050); },
    tick() { this.tone(1200, 0.03, 'square', 0.04); },
    bad() { this.tone(150, 0.3, 'sawtooth', 0.09); },
  };

  // ---------------------------------------------------------------- ads（Web版はダミー。失敗してもゲームは継続）
  const Ads = {
    available() { return C.ads.enabled && !NO_ADS; },
    showInterstitial() {
      if (!this.available()) return Promise.resolve(false);
      return showAdOverlay('インタースティシャル広告', C.ads.interstitialSeconds, false).catch(() => false);
    },
    showRewarded() {
      if (!this.available()) return Promise.resolve(false);
      return showAdOverlay('リワード広告', C.ads.rewardedSeconds, true).catch(() => false);
    },
  };
  function showAdOverlay(kind, secs, rewarded) {
    return new Promise((resolve) => {
      const ov = $('ad-overlay'), close = $('ad-close'), count = $('ad-count');
      $('ad-kind').textContent = kind;
      ov.classList.remove('hidden'); close.classList.add('hidden');
      let left = secs;
      count.textContent = left + '秒';
      const done = (ok) => { clearInterval(iv); ov.classList.add('hidden'); close.onclick = null; resolve(ok); };
      const iv = setInterval(() => {
        left--;
        if (left > 0) { count.textContent = left + '秒'; return; }
        clearInterval(iv);
        count.textContent = rewarded ? '報酬を獲得しました！' : '';
        close.classList.remove('hidden');
        close.onclick = () => done(true);
      }, 1000);
      if (rewarded) { // 報酬なしで閉じることも可能（視聴を強制しない）
        close.classList.remove('hidden');
        close.onclick = () => done(left <= 0);
      }
    });
  }

  // ---------------------------------------------------------------- data
  const BUSINESS = {
    generalRestaurant: {
      name: '一般飲食店', store: 'BAR 夜更し',
      license: '許可：飲食店営業（深夜酒類提供 届出済）',
      desc: '接待なし。記録の不整合が起きにくい堅実経営。',
      services: ['飲食提供'],
      entertainmentAllowed: false,
    },
    entertainmentWithService: {
      name: '接待を伴う飲食店', store: 'Lounge 月灯',
      license: '許可：接待飲食等営業（ゲーム内設定）／深夜帯は接待不可',
      desc: '接待で客単価UP。ただし管理項目が多く、0時以降は接待できない。',
      services: ['飲食提供', '接待（0時まで）'],
      entertainmentAllowed: true,
    },
  };

  const KINDS = {
    normal: { icon: '🍺', texts: ['ハイボールください', '一杯だけ飲みたい', 'カウンター空いてる？', '終電逃した〜'] },
    group: { icon: '👥', texts: ['3名いけます？', '二次会で来ました！'] },
    settai: { icon: '🗣️', texts: ['隣で話し相手になってよ', 'お酌してくれる人いる？'] },
    dance: { icon: '💃', texts: ['朝まで踊れる？', 'DJ呼んで盛り上げて！'] },
    minor: { icon: '🎒', texts: ['20歳っす…たぶん', '身分証？忘れました'] },
    vip: { icon: '💎', texts: ['VIP：一番いい酒を頼むよ'] },
  };

  const ISSUES = [
    { name: '営業記録の記入漏れ', item: 'records' },
    { name: '従業員名簿の未更新', item: 'docs' },
    { name: '料金表の掲示漏れ', item: 'docs' },
    { name: '許可証の掲示漏れ', item: 'license' },
    { name: '年齢確認記録の不備', item: 'records' },
    { name: '客席の照度不足', item: 'actual' },
  ];
  const INV_ITEMS = [
    { key: 'license', label: '営業許可の内容' },
    { key: 'actual', label: '実際の営業内容' },
    { key: 'records', label: '営業記録' },
    { key: 'docs', label: '必要書類の整備' },
  ];
  const TIPS = {
    settai: '客の隣に座って談笑・お酌をするなどの「接待」を行う営業には、風俗営業の許可が必要とされています。',
    minor: '20歳未満の者への酒類の提供は法律で禁止されています。年齢確認は基本中の基本です。',
    dance: '深夜（0時〜6時）に酒類を提供しながら客に遊興をさせる営業には、特定遊興飲食店営業の許可が必要とされています。',
    late: '深夜（0時〜6時）に主として酒類を提供する飲食店は、公安委員会への届出が必要とされています。',
    records: '許可の内容と実際の営業内容が一致していること、記録や書類が整っていることが、適法な営業の土台です。',
    night: '風俗営業の許可を受けた店でも、深夜の営業時間は原則として制限されています。',
  };

  const STATE = { title: 'title', playing: 'playing', investigation: 'investigation', correction: 'correction', gameOver: 'gameOver', result: 'result' };

  // ---------------------------------------------------------------- game
  let state = STATE.title;
  let G = null;
  let businessType = 'generalRestaurant';

  const QX = [228, 260, 292, 324, 356];
  const DOOR_X = 180, FEET_Y = 486;
  const COLORS = ['#e94e77', '#4fc3f7', '#ffb74d', '#9575cd', '#81c784', '#f06292', '#4db6ac', '#ffd54f', '#90a4ae', '#7986cb'];
  const HAIRS = ['#1b1b1b', '#3e2723', '#5d4037', '#c9a66b', '#262626', '#8d6e63'];

  function newGame() {
    const seedParam = params.get('seed');
    rng = seedParam !== null ? mulberry32(parseInt(seedParam, 10) || 0) : Math.random;
    const B = BUSINESS[businessType];
    G = {
      B, type: businessType,
      elapsed: 0, min: 0, lastHour: 0,
      sales: 0, customers: 0, lost: 0, funds: C.initialFunds, compliance: C.initialCompliance,
      issues: [], refusedKinds: {}, servedSettai: 0,
      queue: [], leaving: [], popups: [], particles: [],
      spawnT: 0.4, serveCD: 0, checking: 0,
      buzzLeft: 0, vipCount: 0,
      events: scheduleEvents(),
      invAt: (C.investigationHour + 24 - C.openingHour) * 60 + rand(-C.investigationJitterMinutes, C.investigationJitterMinutes),
      investigated: false, suspended: false, completed: false, outcome: null,
      paused: false, shake: 0, police: 0, flash: 0,
    };
  }

  function scheduleEvents() {
    const n = randInt(C.minRandomEvents, C.maxRandomEvents);
    const pool = ['buzz', 'vip', 'failure', 'complaint', 'licenseCheck'];
    const list = []; let prev = null, vips = 0;
    for (let i = 0; i < n; i++) {
      let t; let guard = 0;
      do { t = pick(pool); guard++; } while ((t === prev || (t === 'vip' && vips >= C.maxVipEvents)) && guard < 50);
      if (t === 'vip') vips++;
      prev = t; list.push(t);
    }
    // 均等に近い間隔で配置（調査時間帯 0.66〜0.78 付近は避ける）
    const slots = [];
    for (let i = 0; i < n; i++) {
      let f = 0.07 + (0.86 * (i + rand(0.15, 0.85))) / n;
      if (f > 0.66 && f < 0.78) f = f < 0.72 ? 0.64 : 0.8;
      slots.push(f);
    }
    slots.sort((a, b) => a - b);
    return list.map((type, i) => ({ type, at: slots[i] * TOTAL_MIN, done: false }));
  }

  function nowHour() { return (C.openingHour + Math.floor(G.min / 60)) % 24; }
  function isLateNight() { return G.min >= (24 - C.openingHour) * 60; } // 0:00以降

  // ---------- customers
  function spawnCustomer(forceKind) {
    if (G.queue.length >= C.maxVisibleCustomers) {
      if (forceKind !== 'vip') return;
      const out = G.queue.pop(); out.state = 'leave'; out.tx = 430; G.leaving.push(out);
    }
    let kind = forceKind;
    if (!kind) {
      const ent = G.B.entertainmentAllowed;
      const table = [
        ['normal', 0.5], ['group', 0.13], ['settai', ent ? 0.24 : 0.14], ['minor', 0.09],
        ['dance', isLateNight() ? 0.12 : 0],
      ];
      const total = table.reduce((s, r) => s + r[1], 0);
      let r = rng() * total;
      kind = 'normal';
      for (const [k, w] of table) { if ((r -= w) < 0) { kind = k; break; } }
    }
    const K = KINDS[kind];
    const stay = rand(C.minStaySeconds, C.maxStaySeconds) * (kind === 'vip' ? 1.5 : 1);
    const c = {
      kind, icon: K.icon, text: pick(K.texts),
      x: 400 + vrand() * 20, tx: 400, y: FEET_Y, alpha: 1, state: 'queue',
      stay, maxStay: stay, phase: vrand() * 6,
      color: kind === 'vip' ? '#1c1c22' : kind === 'minor' ? '#2c3e75' : COLORS[Math.floor(vrand() * COLORS.length)],
      hair: HAIRS[Math.floor(vrand() * HAIRS.length)],
      skin: vrand() < 0.5 ? '#f1c7a5' : '#e0ac83',
      group: kind === 'group',
    };
    G.queue.push(c);
    Sound.bell();
  }

  function sendAway(c, dir = 1) { c.state = 'leave'; c.tx = dir > 0 ? 440 : -60; G.leaving.push(c); }

  function addIssue(name) {
    let issue;
    if (name) issue = ISSUES.find((i) => i.name === name) || { name, item: 'actual' };
    else {
      const fresh = ISSUES.filter((i) => !G.issues.some((x) => x.name === i.name));
      issue = pick(fresh.length ? fresh : ISSUES);
    }
    G.issues.push(issue);
    popup('📋 ' + issue.name, 180, 300, '#ffcc66', 1.6);
  }

  function makeSale(amount, count, x) {
    G.sales += amount; G.funds += amount; G.customers += count;
    popup('+' + yen(amount), x, 410, amount >= C.vipCustomerSales ? '#ffd54f' : '#7CFFB2');
    for (let i = 0; i < 6; i++) G.particles.push({ x, y: 430, vx: (vrand() - 0.5) * 120, vy: -60 - vrand() * 80, life: 0.8, c: '#ffd54f' });
    Sound.coin();
    if (rng() < C.issueChance[G.type]) addIssue();
  }

  // 「接客する」：許可された営業サービスの範囲内でのみ接客。許可外の要望は自動的にお断りする。
  function serve() {
    if (state !== STATE.playing || G.paused) return;
    if (G.checking > 0) { msg('🔍 営業確認中…入口を閉めています', '#ffcc66'); Sound.tick(); return; }
    if (G.serveCD > 0) return;
    const c = G.queue[0];
    if (!c || !c.arrived) { Sound.tick(); return; }
    G.serveCD = C.serveCooldown;
    G.queue.shift();
    const enter = () => { c.state = 'enter'; c.tx = DOOR_X; G.leaving.push(c); };
    const refuse = (reason, tipKey, orderInstead) => {
      G.refusedKinds[tipKey] = (G.refusedKinds[tipKey] || 0) + 1;
      if (orderInstead && rng() < 0.5) {
        msg(`✋ ${reason} → 通常の飲食でご案内`, '#9be7ff');
        enter(); makeSale(C.normalCustomerSales, 1, c.x);
      } else {
        msg(`✋ ${reason}`, '#9be7ff');
        sendAway(c); Sound.refuse();
        popup('お断り ✓', c.x, 420, '#9be7ff');
      }
    };
    switch (c.kind) {
      case 'normal': enter(); makeSale(C.normalCustomerSales, 1, c.x); break;
      case 'group': enter(); makeSale(C.groupCustomerSales, C.groupSize, c.x); break;
      case 'vip': enter(); makeSale(C.vipCustomerSales, 1, c.x); break;
      case 'minor': refuse('年齢確認：20歳未満の可能性のため酒類は提供できません', 'minor', false); break;
      case 'dance': refuse('深夜の遊興サービスは許可の範囲外です', 'dance', true); break;
      case 'settai':
        if (G.B.entertainmentAllowed && !isLateNight()) {
          enter(); G.servedSettai++; makeSale(C.entertainmentSales, 1, c.x);
          msg('🗣️ 許可の範囲内で接待サービス', '#ff9ad5');
        } else if (G.B.entertainmentAllowed) {
          refuse('深夜帯は接待できません（営業時間の制限）', 'night', true);
        } else {
          refuse('当店は一般飲食店のため接待はできません', 'settai', true);
        }
        break;
    }
  }

  // 「営業確認」：許可内容・営業内容・記録を確認し、不整合を是正する（入口を一時的に閉める）
  function check() {
    if (state !== STATE.playing || G.paused || G.checking > 0) return;
    const n = G.issues.length;
    const cost = Math.max(1, n) * C.checkCostPerIssue;
    G.funds -= cost;
    G.checking = C.checkSeconds;
    G.checkingCount = n;
    msg('🔍 営業確認中… 許可内容・営業内容・記録をチェック', '#ffcc66');
    Sound.tick();
  }
  function finishCheck() {
    // 確認中に発生した分も含めて是正
    const fixed = G.issues.length;
    G.issues = [];
    if (fixed > 0) { popup(`✓ 不整合 ${fixed}件を是正`, 180, 300, '#7CFFB2', 1.6); Sound.fanfare(); msg('✓ 是正完了。適法な営業状態です', '#7CFFB2'); }
    else { popup('✓ 問題なし', 180, 300, '#7CFFB2', 1.4); msg('✓ 許可内容と営業内容は一致しています', '#7CFFB2'); }
  }

  // ---------- events
  function runEvent(type) {
    switch (type) {
      case 'buzz':
        G.buzzLeft = C.buzzExtraCustomers; G.spawnT = 0.2;
        toast('📱 SNSでバズった！ 来客が急増中', 'pink'); Sound.notify(); break;
      case 'vip':
        if (G.vipCount >= C.maxVipEvents) return;
        G.vipCount++; spawnCustomer('vip');
        toast('💎 VIP来店！ 逃さず接客しよう', 'gold'); Sound.fanfare(); break;
      case 'failure':
        G.funds -= C.repairCost; G.shake = 0.3;
        toast(`🔧 製氷機が故障！ 修理費 -${yen(C.repairCost)}`, 'orange'); Sound.bad(); break;
      case 'complaint':
        addIssue('騒音苦情への対応未了');
        toast('📢 近隣から苦情！ 営業確認で対応しよう', 'orange'); Sound.notify();
        G.checkHint = 3; break;
      case 'licenseCheck':
        if (G.issues.length) {
          const d = 5 * G.issues.length; G.compliance -= d;
          toast(`📄 許可内容の確認：ズレあり（-${d}） 営業確認を！`, 'orange'); Sound.warn(); G.checkHint = 3;
        } else {
          G.compliance = Math.min(100, G.compliance + 3);
          toast('📄 許可内容の確認：営業実態と一致（+3）', 'green'); Sound.fanfare();
        }
        break;
    }
  }

  // ---------- investigation（03:00前後に必ず1回。ゲーム時間は停止）
  function startInvestigation() {
    state = STATE.investigation;
    G.investigated = true;
    G.police = 0.001;
    G.checking = 0;
    G.queue.forEach((c) => sendAway(c)); G.queue = [];
    Sound.siren();
    const inv = $('inv');
    $('inv-title').textContent = '🚨 警察による立入調査です';
    $('inv-sub').textContent = '営業許可と営業実態の整合性を確認します';
    $('inv-list').innerHTML = INV_ITEMS.map((it) => `<li data-k="${it.key}"><span>${it.label}</span><b>…</b></li>`).join('');
    $('inv-result').textContent = '';
    $('inv-result').className = 'inv-result';
    const btn = $('inv-btn'); btn.textContent = '確認する'; btn.disabled = false;
    btn.onclick = revealInvestigation;
    inv.classList.remove('hidden');
  }

  function revealInvestigation() {
    const btn = $('inv-btn'); btn.disabled = true; Sound.init();
    const lis = [...$('inv-list').children];
    let i = 0;
    const step = () => {
      if (i >= lis.length) return finishInvestigation();
      const li = lis[i]; const k = li.dataset.k;
      const bad = G.issues.filter((x) => x.item === k);
      li.classList.add(bad.length ? 'ng' : 'ok');
      li.querySelector('b').textContent = bad.length ? '✗ ' + bad.map((x) => x.name).join('・') : '✓ 整合';
      bad.length ? Sound.bad() : Sound.tick();
      i++; setTimeout(step, 380);
    };
    step();
  }

  function finishInvestigation() {
    const n = G.issues.length;
    const res = $('inv-result'), btn = $('inv-btn');
    btn.disabled = false;
    if (n === 0) {
      G.compliance = Math.min(100, G.compliance + C.investigationOkBonus);
      res.textContent = `調査完了：許可内容と営業実態の整合を確認しました（コンプライアンス +${C.investigationOkBonus}）`;
      res.className = 'inv-result ok'; Sound.clear();
      btn.textContent = '営業再開'; btn.onclick = resumeFromInvestigation;
    } else if (n >= C.seriousIssueCount) {
      res.textContent = `重大な不整合（${n}件）を確認。是正不能と判断され、営業停止となりました。`;
      res.className = 'inv-result ng'; Sound.warn();
      G.suspended = true;
      btn.textContent = '結果へ'; btn.onclick = () => { hideInv(); endGame('suspended'); };
    } else {
      // CORRECTION（是正対応）
      state = STATE.correction;
      const cost = n * C.correctionCostPerIssue, pen = n * C.correctionPenaltyPerIssue;
      $('inv-title').textContent = '🛠 是正対応';
      $('inv-sub').textContent = '該当サービスを停止し、記録・書類を整備します';
      res.innerHTML = `不整合 ${n}件<br>是正費用 <b>${yen(cost)}</b> ／ コンプライアンス <b>-${pen}</b>`;
      res.className = 'inv-result warn'; Sound.notify();
      btn.textContent = '是正する';
      btn.onclick = () => {
        if (G.funds < cost) {
          res.textContent = '是正費用が不足しています。是正不能のため営業停止となりました。';
          res.className = 'inv-result ng'; Sound.warn(); G.suspended = true;
          btn.textContent = '結果へ'; btn.onclick = () => { hideInv(); endGame('suspended'); };
          return;
        }
        G.funds -= cost; G.compliance -= pen; G.issues = [];
        if (G.compliance <= C.minimumCompliance) {
          G.compliance = 0;
          res.textContent = 'コンプライアンスが0になりました。営業停止となりました。';
          res.className = 'inv-result ng'; Sound.warn(); G.suspended = true;
          btn.textContent = '結果へ'; btn.onclick = () => { hideInv(); endGame('suspended'); };
          return;
        }
        res.textContent = '是正完了。適法な営業を再開します。';
        res.className = 'inv-result ok'; Sound.fanfare();
        btn.textContent = '営業再開'; btn.onclick = resumeFromInvestigation;
      };
    }
  }
  function hideInv() { $('inv').classList.add('hidden'); }
  function resumeFromInvestigation() {
    hideInv(); state = STATE.playing; G.police = -1; // パトカー退場
    G.spawnT = 0.6;
    msg('🚓 調査終了。営業再開！', '#9be7ff');
  }

  // ---------- update
  function update(dt) {
    if (!G) return;
    animate(dt);
    if (state !== STATE.playing || G.paused) return;

    G.elapsed += dt;
    G.min = Math.min(TOTAL_MIN, (G.elapsed / C.gameDurationSeconds) * TOTAL_MIN);

    // 1時間ごとの固定費
    const h = Math.floor(G.min / 60);
    if (h > G.lastHour) {
      G.lastHour = h;
      if (h < C.gameHours) { G.funds -= C.hourlyCost; popup(`家賃・人件費 -${yen(C.hourlyCost)}`, 180, 250, '#ff9a9a', 1.4); }
    }

    if (G.min >= TOTAL_MIN) { G.completed = true; endGame('clear'); return; }
    if (!G.investigated && G.min >= G.invAt) { startInvestigation(); return; }

    // ランダムイベント
    for (const e of G.events) if (!e.done && G.min >= e.at) { e.done = true; runEvent(e.type); }

    // 来客
    G.spawnT -= dt;
    if (G.spawnT <= 0) {
      if (G.buzzLeft > 0) { G.buzzLeft--; G.spawnT = rand(0.35, 0.6); }
      else G.spawnT = rand(C.minCustomerInterval, C.maxCustomerInterval);
      spawnCustomer();
    }

    // 待ち時間（全員）
    for (let i = G.queue.length - 1; i >= 0; i--) {
      const c = G.queue[i];
      if (Math.abs(c.x - c.tx) < 40) c.stay -= dt;
      if (c.stay <= 0) {
        G.queue.splice(i, 1); sendAway(c); G.lost++;
        popup('💢 帰っちゃった', c.x, 420, '#ff8a8a', 1);
      }
    }

    if (G.serveCD > 0) G.serveCD -= dt;
    if (G.checking > 0) { G.checking -= dt; if (G.checking <= 0) finishCheck(); }
    if (G.checkHint > 0) G.checkHint -= dt;

    // 未是正の不整合でコンプライアンス低下
    if (G.issues.length) {
      G.compliance -= G.issues.length * C.issueDrainPerSecond * dt;
      if (G.compliance <= C.minimumCompliance) {
        G.compliance = 0; G.suspended = true;
        toast('⛔ コンプライアンス0：営業停止', 'red'); Sound.warn();
        endGame('suspended'); return;
      }
    }
    if (G.funds < 0) { toast('💸 資金ショート：経営破綻', 'red'); Sound.warn(); endGame('bankrupt'); return; }
  }

  function animate(dt) {
    const all = G.queue.concat(G.leaving);
    G.queue.forEach((c, i) => { c.tx = QX[i]; });
    for (const c of all) {
      const dx = c.tx - c.x, step = 210 * dt;
      c.walking = Math.abs(dx) > 1;
      c.x = Math.abs(dx) <= step ? c.tx : c.x + Math.sign(dx) * step;
      if (c.walking) c.phase += dt * 12;
      if (c.state === 'enter' && Math.abs(c.x - c.tx) < 3) { c.alpha -= dt * 3.5; c.y -= dt * 25; }
      if (c.state === 'leave') c.alpha -= dt * 0.9;
    }
    G.leaving = G.leaving.filter((c) => c.alpha > 0 && c.x > -50 && c.x < 430);
    const f = G.queue[0]; if (f) f.arrived = Math.abs(f.x - f.tx) < 4;
    G.popups.forEach((p) => { p.y -= 34 * dt; p.life -= dt; });
    G.popups = G.popups.filter((p) => p.life > 0);
    G.particles.forEach((p) => { p.x += p.vx * dt; p.y += p.vy * dt; p.vy += 260 * dt; p.life -= dt; });
    G.particles = G.particles.filter((p) => p.life > 0);
    if (G.shake > 0) G.shake -= dt;
    if (G.police > 0 && G.police < 1) G.police = Math.min(1, G.police + dt * 1.5);
    if (G.police < 0) { G.police -= dt * 1.2; if (G.police < -1.99) G.police = 0; }
  }

  // ---------- end
  function endGame(outcome) {
    if (state === STATE.gameOver || state === STATE.result) return;
    G.outcome = outcome;
    state = outcome === 'clear' ? STATE.result : STATE.gameOver;
    if (outcome === 'clear') { Sound.clear(); G.queue.forEach((c) => sendAway(c)); G.queue = []; }
    const r = computeScore();
    G.score = r;
    Storage.data.plays++;
    Storage.data.totalSales += G.sales;
    Storage.data.totalPoints += r.total;
    G.newBest = r.total > Storage.data.bestScore;
    if (G.newBest) Storage.data.bestScore = r.total;
    Storage.data.lastType = G.type;
    Storage.save();
    setTimeout(() => { state = STATE.result; showResult(); }, outcome === 'clear' ? 1400 : 900);
  }

  function computeScore() {
    const salesScore = Math.min(40, G.sales / C.salesPerPoint);
    const customerScore = Math.min(20, G.customers / C.customersPerPoint);
    const operationScore = G.completed && !G.suspended ? C.operationScore : 0;
    const complianceScore = clamp(G.compliance, 0, 100) * C.complianceWeight;
    const total = Math.round(salesScore + customerScore + operationScore + complianceScore);
    const rank = C.ranks.find(([, min]) => total >= min)[0];
    return { salesScore, customerScore, operationScore, complianceScore, total, rank };
  }

  // ---------------------------------------------------------------- UI
  const screens = { title: $('screen-title'), game: $('screen-game'), result: $('screen-result') };
  function showScreen(name) { Object.entries(screens).forEach(([k, el]) => el.classList.toggle('active', k === name)); }

  function toast(text, color = 'pink') {
    const el = document.createElement('div');
    el.className = 'toast ' + color; el.textContent = text;
    const area = $('toast-area'); area.appendChild(el);
    while (area.children.length > 2) area.removeChild(area.firstChild);
    setTimeout(() => el.classList.add('out'), 2300);
    setTimeout(() => el.remove(), 2700);
  }
  let msgTimer = 0;
  function msg(text, color) {
    const el = $('msg-line'); el.textContent = text; el.style.color = color || '#fff';
    el.classList.add('show'); clearTimeout(msgTimer);
    msgTimer = setTimeout(() => el.classList.remove('show'), 1800);
  }
  function popup(text, x, y, color, life = 1.1) { G.popups.push({ text, x, y, color, life, max: life }); }

  const hudCache = {};
  function setText(id, v) { if (hudCache[id] !== v) { hudCache[id] = v; $(id).textContent = v; } }
  function fmtTime(min) {
    const t = Math.floor(min);
    const hh = (C.openingHour + Math.floor(t / 60)) % 24, mm = t % 60;
    return String(hh).padStart(2, '0') + ':' + String(mm).padStart(2, '0');
  }
  function updateHUD() {
    if (!G) return;
    setText('hud-time', fmtTime(G.min));
    setText('hud-remain', '残り ' + Math.max(0, Math.ceil(C.gameDurationSeconds - G.elapsed)) + '秒');
    setText('hud-sales', yen(G.sales));
    setText('hud-cust', G.customers + '人');
    setText('hud-funds', yen(G.funds));
    const n = G.issues.length;
    const st = n === 0 ? ['適法', 'ok'] : n < C.seriousIssueCount ? [`要確認 ${n}`, 'warn'] : [`違反の恐れ ${n}`, 'bad'];
    setText('hud-status', st[0]); $('hud-status').className = 'status ' + st[1];
    const gp = G.investigated ? 100 : clamp(G.min / G.invAt, 0, 1) * 100;
    $('gauge-fill').style.width = gp + '%';
    $('gauge-fill').className = G.investigated ? 'done' : gp > 85 ? 'hot' : gp > 60 ? 'warm' : '';
    const cv = clamp(G.compliance, 0, 100);
    $('comp-fill').style.width = cv + '%';
    $('comp-fill').className = cv < 30 ? 'low' : cv < 60 ? 'mid' : '';
    setText('comp-val', String(Math.round(cv)));
    $('btn-check').classList.toggle('busy', G.checking > 0);
    $('btn-check').classList.toggle('hint', G.checking <= 0 && (n > 0 && (G.checkHint > 0 || n >= 2 || (!G.investigated && G.min > G.invAt - 50))));
    $('btn-serve').classList.toggle('ready', !!(G.queue[0] && G.queue[0].arrived && G.checking <= 0));
    $('btn-quit').disabled = state !== STATE.playing;
  }

  function fmtDuration(min) { const t = Math.floor(min); return `${Math.floor(t / 60)}時間${String(t % 60).padStart(2, '0')}分`; }
  function showResult() {
    const r = G.score;
    const head = { clear: '🌅 朝まで営業成功！', suspended: '⛔ 営業停止…', bankrupt: '💸 資金ショート…経営破綻', closed: '🏮 本日は自主閉店' }[G.outcome];
    $('res-headline').textContent = head;
    $('res-headline').className = 'res-headline ' + G.outcome;
    $('res-type').textContent = `${G.B.store}（${G.B.name}）`;
    $('res-sales').textContent = yen(G.sales);
    $('res-cust').textContent = G.customers + '人';
    $('res-rank').textContent = r.rank + 'ランク';
    $('res-rank').className = 'rank-' + r.rank;
    $('res-comp').textContent = Math.round(clamp(G.compliance, 0, 100)) + '点';
    $('res-time').textContent = fmtTime(G.min) + 'まで';
    $('res-score').textContent = r.total;
    $('res-best').textContent = G.newBest ? '🏆 NEW BEST SCORE!' : `BEST ${Storage.data.bestScore}`;
    $('res-breakdown').textContent =
      `売上 ${r.salesScore.toFixed(1)}/40 ・ 来客 ${r.customerScore.toFixed(1)}/20 ・ 営業達成 ${r.operationScore}/20 ・ 法令遵守 ${r.complianceScore.toFixed(1)}/20` +
      `\n営業時間 ${fmtDuration(G.min)} ・ 営業停止 ${G.suspended ? 'あり' : 'なし'}`;
    $('res-tip').innerHTML = '<b>💡 豆知識</b> ' + pickTip() + '<small>※ゲーム用に簡略化した一般的な説明です</small>';
    const dbl = $('btn-double');
    dbl.classList.toggle('hidden', !Ads.available());
    dbl.disabled = false; dbl.textContent = '▶ 広告を見て獲得ポイント2倍（任意）';
    G.doubled = false;
    showScreen('result');
  }
  function pickTip() {
    const keys = Object.keys(G.refusedKinds);
    if (G.outcome === 'suspended') return TIPS.records;
    if (keys.length) return TIPS[pick(keys)];
    return TIPS[pick(['late', 'records', 'settai', 'minor'])];
  }

  function startGame() {
    Sound.init();
    newGame();
    state = STATE.playing;
    Object.keys(hudCache).forEach((k) => delete hudCache[k]);
    $('hud-license').textContent = G.B.license;
    $('toast-area').innerHTML = '';
    hideInv();
    showScreen('game');
    updateHUD();
    toast(`🏮 ${G.B.store} 開店！ 22:00〜翌5:00`, 'pink');
  }

  function goTitle() {
    state = STATE.title; G = null; hideInv();
    renderTitle(); showScreen('title');
  }

  async function afterResult(next) {
    Storage.data._sinceAd = (Storage.data._sinceAd || 0) + 1;
    if (Storage.data._sinceAd >= C.ads.interstitialEveryNPlays) {
      Storage.data._sinceAd = 0; Storage.save();
      try { await Ads.showInterstitial(); } catch (e) { /* 広告失敗でも継続 */ }
    }
    next();
  }

  function renderTitle() {
    $('title-best').textContent = Storage.data.bestScore;
    $('title-stats').textContent = Storage.data.plays
      ? `プレイ ${Storage.data.plays}回 ・ 累計売上 ${yen(Storage.data.totalSales)} ・ 累計pt ${Storage.data.totalPoints}` : '';
    const sel = $('type-select');
    sel.innerHTML = Object.entries(BUSINESS).map(([k, b]) => `
      <button class="type-card ${k === businessType ? 'sel' : ''}" data-type="${k}">
        <b>${b.name}</b><span class="store">${b.store}</span><small>${b.desc}</small>
      </button>`).join('');
    sel.querySelectorAll('.type-card').forEach((el) => el.addEventListener('click', () => {
      businessType = el.dataset.type; Storage.data.lastType = businessType; Storage.save();
      Sound.init(); Sound.tick(); renderTitle();
    }));
    $('btn-sound').textContent = Storage.data.sound ? '🔊 サウンド ON' : '🔇 サウンド OFF';
    $('ad-banner').classList.toggle('hidden', !Ads.available());
  }

  function modal(html, buttons) {
    const box = $('modal-box');
    box.innerHTML = html + '<div class="modal-btns">' + buttons.map((b, i) => `<button class="btn ${b.cls || 'btn-primary'}" data-i="${i}">${b.label}</button>`).join('') + '</div>';
    $('modal').classList.remove('hidden');
    box.querySelectorAll('[data-i]').forEach((el) => el.addEventListener('click', () => {
      $('modal').classList.add('hidden'); Sound.tick(); buttons[+el.dataset.i].onClick && buttons[+el.dataset.i].onClick();
    }));
  }
  const HOWTO = `
    <h2>遊び方</h2>
    <p>架空の繁華街「ネオン横丁」でお店を経営。<b>22:00〜翌5:00（約45秒）</b>を、許可の範囲内で営業し切ろう。</p>
    <ul class="howto">
      <li><b>🍸 接客する</b>：先頭のお客さんを接客して売上GET。許可外の要望（接待・深夜の遊興・未成年への酒類提供など）は自動でお断りします。</li>
      <li><b>🔍 営業確認</b>：忙しいと「記録漏れ」などの不整合が溜まり、コンプライアンスが減っていきます。営業確認で是正！ ただし確認中は入口を閉めます。</li>
      <li><b>🚨 立入調査</b>：3時前後に必ず発生。それまでの経営判断で結果が決まります。不整合が多いと営業停止！</li>
      <li><b>💸 資金</b>：毎時の家賃・人件費や修理費を払えなくなると経営破綻。</li>
    </ul>
    <p class="small">スコア＝売上40＋来客20＋営業達成20＋法令遵守20（100点満点）</p>`;

  // ---------------------------------------------------------------- input
  function bindTap(el, fn) {
    el.addEventListener('pointerdown', (e) => { e.preventDefault(); Sound.init(); fn(); });
  }
  bindTap($('btn-serve'), serve);
  bindTap($('btn-check'), check);
  $('btn-quit').addEventListener('click', () => {
    if (state !== STATE.playing) return;
    G.paused = true;
    modal('<h2>営業終了しますか？</h2><p>自主閉店すると「営業達成」の20点は獲得できません。</p>', [
      { label: '営業を続ける', onClick: () => { G.paused = false; } },
      { label: '営業終了', cls: 'btn-ghost', onClick: () => { G.paused = false; endGame('closed'); } },
    ]);
  });
  $('btn-start').addEventListener('click', () => {
    Sound.init();
    if (!Storage.data.tutorialDone) {
      modal(HOWTO, [{ label: '営業開始！', onClick: () => { Storage.data.tutorialDone = true; Storage.save(); startGame(); } }]);
    } else startGame();
  });
  $('btn-howto').addEventListener('click', () => { Sound.init(); modal(HOWTO, [{ label: 'OK' }]); });
  $('btn-sound').addEventListener('click', () => { Storage.data.sound = !Storage.data.sound; Storage.save(); Sound.init(); Sound.tick(); renderTitle(); });
  $('btn-retry').addEventListener('click', () => afterResult(startGame));
  $('btn-title').addEventListener('click', () => afterResult(goTitle));
  $('btn-double').addEventListener('click', async () => {
    if (!G || G.doubled) return;
    const btn = $('btn-double'); btn.disabled = true;
    let ok = false;
    try { ok = await Ads.showRewarded(); } catch (e) { ok = false; }
    if (ok) {
      G.doubled = true;
      Storage.data.totalPoints += G.score.total; Storage.save();
      btn.textContent = `✓ 獲得ポイント2倍！（+${G.score.total}pt）`;
      $('res-score').textContent = `${G.score.total} ×2`;
    } else { btn.disabled = false; }
  });
  $('btn-share').addEventListener('click', async () => {
    if (!G) return;
    const text = `【摘発カウントダウン】${G.B.name}で${fmtTime(G.min)}まで営業！ 売上${yen(G.sales)}・来客${G.customers}人・${G.score.rank}ランク（${G.score.total}点） #摘発カウントダウン`;
    const url = location.href.split('?')[0];
    try {
      if (navigator.share) await navigator.share({ text, url });
      else { await navigator.clipboard.writeText(text + ' ' + url); toastGlobal('結果をコピーしました'); }
    } catch (e) { /* キャンセル */ }
  });
  function toastGlobal(t) { const b = $('btn-share'); const o = b.textContent; b.textContent = t; setTimeout(() => { b.textContent = o; }, 1500); }

  document.addEventListener('keydown', (e) => {
    if (e.repeat) return;
    if (state === STATE.playing) {
      if (e.code === 'Space' || e.code === 'Enter') { e.preventDefault(); serve(); }
      else if (e.key === 'c' || e.key === 'C' || e.code === 'ShiftLeft') { check(); }
    } else if ((state === STATE.investigation || state === STATE.correction) && (e.code === 'Space' || e.code === 'Enter')) {
      e.preventDefault(); const b = $('inv-btn'); if (!b.disabled) b.click();
    }
  });
  // バックグラウンド移行で一時停止
  document.addEventListener('visibilitychange', () => {
    if (document.hidden && state === STATE.playing && G && !G.paused) {
      G.paused = true;
      modal('<h2>一時停止中</h2><p>準備ができたら再開してください。</p>', [{ label: '再開', onClick: () => { G.paused = false; } }]);
    }
  });

  // ---------------------------------------------------------------- rendering
  const canvas = $('scene'), ctx = canvas.getContext('2d');
  const app = $('app');
  let scale = 1, VH = H, OY = 0;
  function resize() {
    const vw = window.innerWidth, vh = window.innerHeight;
    const w = Math.min(vw, (vh * 9) / 16);
    const h = Math.min(vh, (w * 21) / 9); // 縦長端末は 9:21 まで縦に伸ばす
    VH = (W * h) / w; OY = (VH - H) / 2;
    app.style.width = w + 'px'; app.style.height = h + 'px';
    document.documentElement.style.setProperty('--u', w / 360 + 'px');
    const dpr = Math.min(window.devicePixelRatio || 1, 3);
    canvas.width = Math.round(w * dpr); canvas.height = Math.round(h * dpr);
    scale = canvas.width / W;
  }
  window.addEventListener('resize', resize);

  function rr(x, y, w, h, r) {
    ctx.beginPath();
    ctx.moveTo(x + r, y); ctx.arcTo(x + w, y, x + w, y + h, r); ctx.arcTo(x + w, y + h, x, y + h, r);
    ctx.arcTo(x, y + h, x, y, r); ctx.arcTo(x, y, x + w, y, r); ctx.closePath();
  }
  const FONT = '"Hiragino Kaku Gothic ProN","Hiragino Sans","Noto Sans JP","Yu Gothic",Meiryo,sans-serif';

  // 背景（ビル群）をオフスクリーンに一度だけ描画
  let bgLayer = null;
  function buildBG() {
    const S = 2;
    const off = document.createElement('canvas'); off.width = W * S; off.height = H * S;
    const c = off.getContext('2d'); c.scale(S, S);
    const r = mulberry32(20261116);
    // 遠景
    let x = -10;
    while (x < W + 10) {
      const w = 26 + r() * 46, h = 150 + r() * 210, top = 440 - h;
      c.fillStyle = '#110b22'; c.fillRect(x, top, w, h);
      for (let wy = top + 8; wy < 430; wy += 12) for (let wx = x + 5; wx < x + w - 6; wx += 9) {
        if (r() < 0.32) { c.fillStyle = r() < 0.7 ? 'rgba(255,214,120,0.55)' : 'rgba(120,200,255,0.45)'; c.fillRect(wx, wy, 4, 6); }
      }
      x += w + 2;
    }
    // 近景（左右の雑居ビル）
    c.fillStyle = '#0c0818'; c.fillRect(0, 130, 62, 320); c.fillRect(298, 110, 62, 340);
    for (let wy = 150; wy < 430; wy += 22) for (const wx of [8, 34, 306, 332]) {
      c.fillStyle = r() < 0.5 ? 'rgba(255,190,110,0.35)' : 'rgba(40,30,70,0.9)'; c.fillRect(wx, wy, 18, 12);
    }
    bgLayer = off;
  }
  const STARS = Array.from({ length: 40 }, (_, i) => ({ x: (i * 97) % W, y: (i * 53) % 220, s: (i % 3) * 0.4 + 0.6 }));

  let T = 0;
  function neonText(text, x, y, size, color, flicker = 1, align = 'center') {
    ctx.save();
    ctx.font = `900 ${size}px ${FONT}`; ctx.textAlign = align; ctx.textBaseline = 'middle';
    ctx.globalAlpha *= flicker;
    ctx.shadowColor = color; ctx.shadowBlur = 16; ctx.fillStyle = color; ctx.fillText(text, x, y);
    ctx.shadowBlur = 4; ctx.fillStyle = '#fff'; ctx.globalAlpha *= 0.85; ctx.fillText(text, x, y);
    ctx.restore();
  }
  function flick(seed) { const v = Math.sin(T * 13 + seed * 7) + Math.sin(T * 3.1 + seed); return v > 1.7 ? 0.35 : 1; }

  function drawVerticalSign(x, y, text, color, seed) {
    ctx.save();
    rr(x - 13, y - 6, 26, text.length * 22 + 12, 5); ctx.fillStyle = 'rgba(10,6,20,0.9)'; ctx.fill();
    ctx.strokeStyle = color; ctx.lineWidth = 1.5; ctx.shadowColor = color; ctx.shadowBlur = 10; ctx.globalAlpha = flick(seed); ctx.stroke();
    ctx.restore();
    [...text].forEach((ch, i) => neonText(ch, x, y + 11 + i * 22, 17, color, flick(seed)));
  }

  function drawPerson(c) {
    const x = c.x, y = c.y, bob = c.walking ? Math.abs(Math.sin(c.phase)) * 2 : 0;
    ctx.save(); ctx.globalAlpha = clamp(c.alpha, 0, 1);
    ctx.fillStyle = 'rgba(0,0,0,0.45)'; ctx.beginPath(); ctx.ellipse(x, y + 2, 15, 4, 0, 0, Math.PI * 2); ctx.fill();
    const legSwing = c.walking ? Math.sin(c.phase) * 3 : 0;
    ctx.fillStyle = '#16141f'; ctx.fillRect(x - 8 + legSwing, y - 24, 6, 24); ctx.fillRect(x + 2 - legSwing, y - 24, 6, 24);
    rr(x - 13, y - 58 - bob, 26, 36, 9); ctx.fillStyle = c.color; ctx.fill();
    if (c.kind === 'vip') { ctx.fillStyle = '#ffd54f'; ctx.fillRect(x - 1.5, y - 56 - bob, 3, 14); }
    if (c.kind === 'minor') { ctx.fillStyle = '#7a5230'; rr(x + 9, y - 54 - bob, 8, 20, 3); ctx.fill(); }
    ctx.fillStyle = c.skin; ctx.beginPath(); ctx.arc(x, y - 68 - bob, 10, 0, Math.PI * 2); ctx.fill();
    ctx.fillStyle = c.hair; ctx.beginPath(); ctx.arc(x, y - 70 - bob, 10.5, Math.PI * 1.05, Math.PI * 1.95); ctx.fill();
    if (c.group) { // 連れ
      ctx.globalAlpha *= 0.85;
      ctx.fillStyle = '#5c6bc0'; rr(x + 8, y - 50, 18, 28, 7); ctx.fill();
      ctx.fillStyle = c.skin; ctx.beginPath(); ctx.arc(x + 17, y - 58, 8, 0, Math.PI * 2); ctx.fill();
    }
    ctx.restore();
  }

  function drawStaff(x, y, color, hat) {
    const c = { x, y, alpha: 1, walking: false, phase: 0, color, skin: '#f1c7a5', hair: '#1b1b1b', kind: 'staff' };
    drawPerson(c);
    ctx.save();
    if (hat) { // 警察官の帽子
      ctx.fillStyle = '#16233f'; rr(x - 11, y - 82, 22, 8, 3); ctx.fill(); ctx.fillRect(x - 13, y - 75, 26, 3);
      ctx.fillStyle = '#ffd54f'; ctx.fillRect(x - 2, y - 80, 4, 4);
    } else { // 蝶ネクタイ
      ctx.fillStyle = '#ff2e88'; ctx.beginPath(); ctx.moveTo(x, y - 55); ctx.lineTo(x - 6, y - 59); ctx.lineTo(x - 6, y - 51); ctx.closePath(); ctx.fill();
      ctx.beginPath(); ctx.moveTo(x, y - 55); ctx.lineTo(x + 6, y - 59); ctx.lineTo(x + 6, y - 51); ctx.closePath(); ctx.fill();
    }
    ctx.restore();
  }

  function drawBubble(c) {
    if (!c.arrived) return;
    ctx.save();
    ctx.font = `bold 12.5px ${FONT}`;
    const text = c.icon + ' ' + c.text;
    const w = Math.min(ctx.measureText(text).width + 22, 300), h = 34;
    const bx = clamp(c.x - w / 2, 6, W - 6 - w), by = c.y - 128;
    rr(bx, by, w, h, 10);
    ctx.fillStyle = c.kind === 'vip' ? '#fff6d6' : 'rgba(255,255,255,0.96)'; ctx.fill();
    ctx.strokeStyle = c.kind === 'vip' ? '#ffb300' : '#ff2e88'; ctx.lineWidth = 2; ctx.stroke();
    ctx.beginPath(); ctx.moveTo(c.x - 6, by + h); ctx.lineTo(c.x + 2, by + h + 9); ctx.lineTo(c.x + 7, by + h);
    ctx.fillStyle = c.kind === 'vip' ? '#fff6d6' : 'rgba(255,255,255,0.96)'; ctx.fill();
    ctx.fillStyle = '#1a1026'; ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
    ctx.fillText(text, bx + w / 2, by + 14);
    const p = clamp(c.stay / c.maxStay, 0, 1);
    ctx.fillStyle = '#ddd'; ctx.fillRect(bx + 10, by + h - 7, w - 20, 3);
    ctx.fillStyle = p > 0.5 ? '#2ecc71' : p > 0.25 ? '#f1c40f' : '#e74c3c'; ctx.fillRect(bx + 10, by + h - 7, (w - 20) * p, 3);
    ctx.restore();
  }

  function drawPatienceDot(c) {
    const p = clamp(c.stay / c.maxStay, 0, 1);
    ctx.save(); ctx.globalAlpha = c.alpha;
    ctx.strokeStyle = p > 0.5 ? '#2ecc71' : p > 0.25 ? '#f1c40f' : '#e74c3c'; ctx.lineWidth = 3;
    ctx.beginPath(); ctx.arc(c.x, c.y - 96, 6, -Math.PI / 2, -Math.PI / 2 + Math.PI * 2 * p); ctx.stroke();
    ctx.font = `12px ${FONT}`; ctx.textAlign = 'center'; ctx.textBaseline = 'middle'; ctx.fillText(c.icon, c.x, c.y - 96);
    ctx.restore();
  }

  function drawPoliceCar(t) {
    const x = lerp(-130, 4, t);
    ctx.save();
    ctx.fillStyle = 'rgba(0,0,0,0.5)'; ctx.beginPath(); ctx.ellipse(x + 55, 492, 60, 6, 0, 0, Math.PI * 2); ctx.fill();
    rr(x, 458, 112, 30, 8); ctx.fillStyle = '#f4f4f4'; ctx.fill();
    ctx.fillStyle = '#111'; ctx.fillRect(x, 474, 112, 14);
    rr(x + 24, 440, 62, 22, 7); ctx.fillStyle = '#f4f4f4'; ctx.fill();
    ctx.fillStyle = '#7fb3ff'; ctx.fillRect(x + 30, 445, 22, 13); ctx.fillRect(x + 57, 445, 23, 13);
    const on = Math.floor(T * 8) % 2 === 0;
    ctx.shadowBlur = 22;
    ctx.shadowColor = on ? '#ff1e3c' : '#1e5bff'; ctx.fillStyle = on ? '#ff1e3c' : '#1e5bff';
    rr(x + 40, 432, 30, 8, 3); ctx.fill();
    ctx.shadowBlur = 0;
    ctx.fillStyle = '#222'; ctx.beginPath(); ctx.arc(x + 24, 489, 9, 0, Math.PI * 2); ctx.arc(x + 88, 489, 9, 0, Math.PI * 2); ctx.fill();
    ctx.font = `bold 9px ${FONT}`; ctx.fillStyle = '#fff'; ctx.textAlign = 'center'; ctx.fillText('POLICE', x + 56, 482);
    ctx.restore();
  }

  function render(dt) {
    T += dt;
    ctx.setTransform(scale, 0, 0, scale, 0, OY * scale);
    ctx.fillStyle = '#06040c'; ctx.fillRect(0, -OY, W, VH);
    const min = G ? G.min : 0;
    const dawn = clamp((min - 330) / 90, 0, 1); // 03:30以降に夜明け
    ctx.save();
    if (G && G.shake > 0) ctx.translate((vrand() - 0.5) * 6, (vrand() - 0.5) * 6);

    // 空
    const sky = ctx.createLinearGradient(0, -OY, 0, 460);
    sky.addColorStop(0, mixColor('#05030f', '#2a2a6e', dawn));
    sky.addColorStop(0.6, mixColor('#170a30', '#b0558f', dawn));
    sky.addColorStop(1, mixColor('#2b0f3f', '#ffb27a', dawn));
    ctx.fillStyle = sky; ctx.fillRect(0, -OY, W, 460 + OY);
    ctx.fillStyle = `rgba(255,255,255,${0.7 * (1 - dawn)})`;
    STARS.forEach((s) => { ctx.globalAlpha = (0.5 + 0.5 * Math.sin(T * 2 + s.x)) * (1 - dawn); ctx.fillRect(s.x, s.y, s.s, s.s); });
    ctx.globalAlpha = 1;
    if (dawn > 0) { // 朝日
      const g = ctx.createRadialGradient(180, 470, 10, 180, 470, 220);
      g.addColorStop(0, `rgba(255,220,150,${0.8 * dawn})`); g.addColorStop(1, 'rgba(255,180,120,0)');
      ctx.fillStyle = g; ctx.fillRect(0, 200, W, 280);
    }
    if (bgLayer) ctx.drawImage(bgLayer, 0, 0, W, H);

    // 近景の看板（架空）
    drawVerticalSign(31, 150, 'スナック', '#ff4fd8', 1);
    drawVerticalSign(329, 128, 'カラオケ', '#3ff2ff', 2);
    neonText('居酒屋', 31, 360, 13, '#ffcc33', flick(3));
    neonText('BAR', 329, 360, 15, '#7cff6b', flick(4));

    // 店舗
    const B = G ? G.B : BUSINESS[businessType];
    ctx.fillStyle = '#1d1233'; ctx.fillRect(68, 196, 224, 248);
    ctx.fillStyle = '#25173f'; ctx.fillRect(68, 196, 224, 10);
    // 看板
    rr(86, 168, 188, 40, 8); ctx.fillStyle = '#0b0614'; ctx.fill();
    ctx.save(); ctx.strokeStyle = '#ff2e88'; ctx.shadowColor = '#ff2e88'; ctx.shadowBlur = 12; ctx.lineWidth = 2; rr(86, 168, 188, 40, 8); ctx.stroke(); ctx.restore();
    neonText(B.store, 180, 189, 21, '#ff5fb0', flick(5));
    // 窓
    const open = !G || (state === STATE.playing && G.checking <= 0);
    const warm = open ? 'rgba(255,190,110,0.85)' : 'rgba(120,110,160,0.5)';
    for (const wx of [80, 224]) {
      const g = ctx.createLinearGradient(0, 240, 0, 360); g.addColorStop(0, warm); g.addColorStop(1, 'rgba(255,120,80,0.5)');
      ctx.fillStyle = g; ctx.fillRect(wx, 240, 56, 112);
      ctx.strokeStyle = '#3a2a5a'; ctx.lineWidth = 3; ctx.strokeRect(wx, 240, 56, 112); ctx.fillStyle = '#3a2a5a'; ctx.fillRect(wx + 26, 240, 3, 112);
      // 店内シルエット
      ctx.fillStyle = 'rgba(40,20,40,0.55)';
      for (let i = 0; i < 2; i++) { ctx.beginPath(); ctx.arc(wx + 16 + i * 24, 318 + Math.sin(T * 2 + i + wx) * 1.5, 7, 0, Math.PI * 2); ctx.fill(); ctx.fillRect(wx + 9 + i * 24, 325, 14, 27); }
    }
    // ドア
    ctx.fillStyle = open ? '#ffcf86' : '#2a2140'; ctx.fillRect(152, 350, 56, 94);
    ctx.strokeStyle = '#4a3770'; ctx.lineWidth = 3; ctx.strokeRect(152, 350, 56, 94);
    if (open) { const g = ctx.createRadialGradient(180, 444, 5, 180, 444, 80); g.addColorStop(0, 'rgba(255,200,120,0.35)'); g.addColorStop(1, 'rgba(255,200,120,0)'); ctx.fillStyle = g; ctx.fillRect(100, 400, 160, 90); }
    if (G && G.checking > 0) {
      ctx.fillStyle = '#ffcc33'; rr(140, 380, 80, 22, 4); ctx.fill();
      ctx.font = `bold 12px ${FONT}`; ctx.fillStyle = '#222'; ctx.textAlign = 'center'; ctx.textBaseline = 'middle'; ctx.fillText('営業確認中', 180, 391);
    }
    // 営業状態ランプ
    const n = G ? G.issues.length : 0;
    const lamp = n === 0 ? '#2ef58a' : n < C.seriousIssueCount ? '#ffcc33' : '#ff3355';
    ctx.save(); ctx.fillStyle = lamp; ctx.shadowColor = lamp; ctx.shadowBlur = 14; ctx.beginPath(); ctx.arc(180, 338, 5, 0, Math.PI * 2); ctx.fill(); ctx.restore();

    // 路面
    const road = ctx.createLinearGradient(0, 444, 0, H + OY);
    road.addColorStop(0, mixColor('#140c24', '#3a2c48', dawn)); road.addColorStop(1, '#06040c');
    ctx.fillStyle = road; ctx.fillRect(0, 444, W, H + OY - 444);
    // ネオンの映り込み
    ctx.save(); ctx.globalAlpha = 0.18 * (1 - dawn * 0.7);
    [['#ff2e88', 180, 60], ['#ff4fd8', 31, 16], ['#3ff2ff', 329, 16]].forEach(([col, x, w]) => {
      const g = ctx.createLinearGradient(0, 446, 0, 620); g.addColorStop(0, col); g.addColorStop(1, 'rgba(0,0,0,0)');
      ctx.fillStyle = g; ctx.fillRect(x - w / 2, 446, w, 170);
    });
    ctx.restore();

    if (G) {
      // パトカー・警察官
      const showP = G.police !== 0;
      const pt = G.police > 0 ? G.police : Math.max(0, 1 - (-G.police - 1));
      if (showP) {
        drawPoliceCar(pt);
        if (state === STATE.investigation || state === STATE.correction) { drawStaff(118, FEET_Y, '#24345a', true); drawStaff(144, FEET_Y, '#24345a', true); }
      }
      // 店員
      drawStaff(state === STATE.investigation || state === STATE.correction ? 196 : 132, FEET_Y, '#2b2b2b', false);
      // 客
      const all = G.leaving.concat(G.queue.slice().reverse());
      all.forEach(drawPerson);
      G.queue.slice(1).forEach(drawPatienceDot);
      if (G.queue[0]) drawBubble(G.queue[0]);
      // パーティクル・ポップアップ
      G.particles.forEach((q) => { ctx.globalAlpha = clamp(q.life, 0, 1); ctx.fillStyle = q.c; ctx.fillRect(q.x, q.y, 3, 3); });
      ctx.globalAlpha = 1;
      G.popups.forEach((q) => {
        ctx.save(); ctx.globalAlpha = clamp(q.life / q.max * 1.5, 0, 1);
        ctx.font = `900 15px ${FONT}`; ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
        ctx.lineWidth = 4; ctx.strokeStyle = 'rgba(0,0,0,0.8)'; ctx.strokeText(q.text, q.x, q.y); ctx.fillStyle = q.color; ctx.fillText(q.text, q.x, q.y);
        ctx.restore();
      });
      // 立入調査の赤青ライト
      if (state === STATE.investigation || state === STATE.correction) {
        ctx.fillStyle = Math.floor(T * 4) % 2 ? 'rgba(255,30,60,0.12)' : 'rgba(30,90,255,0.12)'; ctx.fillRect(0, -OY, W, VH);
      }
    } else {
      drawStaff(132, FEET_Y, '#2b2b2b', false);
    }
    ctx.restore();
  }

  // ---------------------------------------------------------------- loop（経過時間ベース）
  let last = performance.now();
  function frame(now) {
    const realDt = Math.min(0.1, Math.max(0, (now - last) / 1000));
    last = now;
    const dt = realDt * SPEED;
    try {
      update(dt);
      if (state === STATE.playing || state === STATE.investigation || state === STATE.correction) updateHUD();
      render(realDt);
    } catch (e) { console.error(e); }
    requestAnimationFrame(frame);
  }

  // ---------------------------------------------------------------- boot
  Storage.load();
  businessType = BUSINESS[Storage.data.lastType] ? Storage.data.lastType : 'generalRestaurant';
  resize(); buildBG(); renderTitle();
  requestAnimationFrame(frame);

  // テスト用フック
  window.__game = { get state() { return state; }, get G() { return G; }, serve, check, startGame, STATE };
})();
