/* =========================================================
 * 摘発カウントダウン - 日本語 / 英語の文言
 * 端末の言語が日本語なら日本語、それ以外は英語。タイトル画面で切り替えられる（端末内に保存）
 * ========================================================= */
window.I18N = (() => {
  const KEY = 'tekihatsu_lang';
  const DICT = {
    ja: {
      'doc.title': '摘発カウントダウン',
      'doc.desc': '表向きは、ただのバー。ドアの音がしたら要注意！3分のワンタップ偽装経営ゲーム。',
      'store': 'BAR 夜更し',
      'title.sub': '架空の繁華街「ネオン横丁」',
      'title.logo': '摘発<br>カウントダウン',
      'title.catch': '表向きは、ただのバー。',
      'title.howto': '遊び方',
      'title.soundOn': '🔊 サウンド ON',
      'title.soundOff': '🔇 サウンド OFF',
      'title.stats': 'プレイ {plays}回 ・ 累計売上 {sales}',
      'title.disclaimer': '※本作はフィクションです。実在の人物・団体・店舗・事件とは関係ありません。現実の無許可営業は法律で禁止されています。',
      'legal.privacy': 'プライバシーポリシー',
      'legal.adSettings': '広告の設定',
      'url.privacy': 'https://techgym.jp/privacy-policy/',
      'hud.sales': '売上',
      'hud.customers': '来客数',
      'hud.remain': '残り {t}',
      'unit.groups': '{n}組',
      'pause.title': '一時停止中',
      'pause.resume': '再開',
      'pause.toTitle': 'タイトルへ',
      'howto.title': '遊び方',
      'howto.lead': '朝5時まで<b>{time}</b>、<br>摘発されずに稼げ！',
      'howto.tapGuest': '<b>客をタップ</b><br>お酒で売上UP',
      'howto.door': '<b>ドアの音</b>に注意<br>👮警察かも！',
      'howto.tapCast': '<b>キャストをタップ</b><br>カウンターへ逃がす',
      'howto.bust': '聞き込みされたら<br><b>摘発！</b>',
      'howto.note': '※フィクションです。無許可営業は法律で禁止されています。',
      'howto.ok': 'OK',
      'howto.open': '開店！',
      'time.min': '{n}分',
      'time.sec': '{n}秒',
      'redo.watch': '▶ 広告を見て もみ消す',
      'redo.loading': '読み込み中…',
      'redo.skip': '結果へ（{s}）',
      'res.clear': '🌅 今夜も逃げ切った！',
      'res.bust': '🚨 摘発…',
      'res.sales': '本日の売上 ＝ SCORE',
      'res.customers': '来客数',
      'res.rank': '最終ランク',
      'res.passed': '警察をやり過ごした',
      'res.time': '営業時間',
      'res.rankValue': '{r}ランク',
      'res.times': '{n}回',
      'res.until': '{t}まで',
      'res.best': 'BEST {v}',
      'res.newBest': '🏆 NEW BEST SCORE!',
      'res.breakdown': 'お酒 {d}杯（タワー {t}回） ・ キャストを逃がした {e}回',
      'res.redo': ' ・ もみ消し {n}回',
      'res.newsPaper': 'ネオン横丁新聞（架空）',
      'res.newsHead': '「{store}」を摘発<br>バーと偽り 無許可で接待営業の疑い',
      'res.newsBody': '{t}ごろ、警察が店内に立ち入ったところ、女性従業員が客の隣に座って接客していたという。',
      'res.tip': '<b>💡 現実では</b> 客の隣に座って談笑・お酌をするなどの「接待」をする営業には、風俗営業の許可が必要とされています。許可なく接待営業を行うことは法律で禁止されています。<small>※本作はフィクションです。説明は一般的な内容を簡略化したものです。</small>',
      'res.retry': 'RETRY',
      'res.title': 'TITLE',
      'res.share': '結果をシェア',
      'share.copied': 'コピーしました',
      'share.title': '摘発カウントダウン',
      'share.dialog': '結果をシェア',
      'share.redo': '・もみ消し{n}回',
      'share.bust': '【摘発カウントダウン】{t}に摘発されました…売上{sales}{redo} #摘発カウントダウン',
      'share.clear': '【摘発カウントダウン】朝まで逃げ切った！売上{sales}・警察を{passed}回やり過ごし{redo}・{rank}ランク #摘発カウントダウン',
      'stamp': '摘 発 ！',
    },
    en: {
      'doc.title': 'Raid Countdown',
      'doc.desc': 'Just an ordinary bar. Or is it? Watch out when the door chimes! A 3-minute one-tap game.',
      'store': 'BAR Yofukashi',
      'title.sub': 'Neon Alley — a fictional nightlife district',
      'title.logo': 'RAID<br>COUNTDOWN',
      'title.catch': 'Just an ordinary bar. Or is it?',
      'title.howto': 'How to play',
      'title.soundOn': '🔊 Sound ON',
      'title.soundOff': '🔇 Sound OFF',
      'title.stats': 'Played {plays} times · Total sales {sales}',
      'title.disclaimer': 'This game is fiction. Any resemblance to real people, organizations, businesses or events is coincidental. Running such a business without a license is illegal in real life.',
      'legal.privacy': 'Privacy policy',
      'legal.adSettings': 'Ad settings',
      'url.privacy': 'https://techgym.jp/privacy-policy-en/',
      'hud.sales': 'Sales',
      'hud.customers': 'Guests',
      'hud.remain': 'Left {t}',
      'unit.groups': '{n}',
      'pause.title': 'Paused',
      'pause.resume': 'Resume',
      'pause.toTitle': 'Title',
      'howto.title': 'How to play',
      'howto.lead': 'Make money for <b>{time}</b><br>until 5 AM without getting busted!',
      'howto.tapGuest': '<b>Tap a guest</b><br>to sell another drink',
      'howto.door': 'Listen for the <b>door</b><br>👮 It may be the police!',
      'howto.tapCast': '<b>Tap a hostess</b><br>to hide her behind the counter',
      'howto.bust': 'If she gets questioned,<br><b>you\'re busted!</b>',
      'howto.note': 'This is fiction. Running such a business without a license is illegal.',
      'howto.ok': 'OK',
      'howto.open': 'Open the bar!',
      'time.min': '{n} min',
      'time.sec': '{n} sec',
      'redo.watch': '▶ Watch an ad to cover it up',
      'redo.loading': 'Loading…',
      'redo.skip': 'Results ({s})',
      'res.clear': '🌅 You made it through the night!',
      'res.bust': '🚨 Busted…',
      'res.sales': 'Tonight\'s sales = SCORE',
      'res.customers': 'Guests',
      'res.rank': 'Rank',
      'res.passed': 'Police fooled',
      'res.time': 'Open until',
      'res.rankValue': 'Rank {r}',
      'res.times': '{n}×',
      'res.until': '{t}',
      'res.best': 'BEST {v}',
      'res.newBest': '🏆 NEW BEST SCORE!',
      'res.breakdown': 'Drinks {d} (towers {t}) · Hostesses hidden {e}×',
      'res.redo': ' · Cover-ups {n}',
      'res.newsPaper': 'The Neon Alley Times (fictional)',
      'res.newsHead': '"{store}" raided<br>Unlicensed hostess service behind a bar front',
      'res.newsBody': 'At around {t}, police entered the bar and reportedly found a female employee sitting next to a customer and entertaining him.',
      'res.tip': '<b>💡 In real life</b> In Japan, a business where staff sit with customers to chat and pour drinks needs a special license, and running one without it is against the law.<small>This game is fiction. The explanation is a simplified general description.</small>',
      'res.retry': 'RETRY',
      'res.title': 'TITLE',
      'res.share': 'Share result',
      'share.copied': 'Copied!',
      'share.title': 'Raid Countdown',
      'share.dialog': 'Share result',
      'share.redo': ' · {n} cover-ups',
      'share.bust': '[Raid Countdown] Busted at {t}… Sales {sales}{redo} #RaidCountdown',
      'share.clear': '[Raid Countdown] Made it to morning! Sales {sales} · Fooled the police {passed}×{redo} · Rank {rank} #RaidCountdown',
      'stamp': 'BUSTED!',
    },
  };
  const detect = () => {
    try { const s = localStorage.getItem(KEY); if (s === 'ja' || s === 'en') return s; } catch (e) { /* noop */ }
    const l = (navigator.languages && navigator.languages[0]) || navigator.language || 'ja';
    return /^ja/i.test(l) ? 'ja' : 'en';
  };
  let lang = detect();
  const listeners = [];
  function t(key, vars) {
    let s = (DICT[lang] && DICT[lang][key]) ?? DICT.ja[key] ?? key;
    if (vars) s = s.replace(/\{(\w+)\}/g, (m, k) => (vars[k] !== undefined ? vars[k] : m));
    return s;
  }
  // data-i18n（文字）・data-i18n-html（HTML）・data-i18n-href（リンク先）を書き換える
  function apply() {
    document.documentElement.lang = lang;
    document.title = t('doc.title');
    const meta = document.querySelector('meta[name="description"]'); if (meta) meta.content = t('doc.desc');
    document.querySelectorAll('[data-i18n]').forEach((el) => { el.textContent = t(el.dataset.i18n); });
    document.querySelectorAll('[data-i18n-html]').forEach((el) => { el.innerHTML = t(el.dataset.i18nHtml); });
    document.querySelectorAll('[data-i18n-href]').forEach((el) => { el.href = t(el.dataset.i18nHref); });
    document.querySelectorAll('[data-lang]').forEach((el) => el.classList.toggle('sel', el.dataset.lang === lang));
  }
  function setLang(l) {
    if (l !== 'ja' && l !== 'en') return;
    lang = l;
    try { localStorage.setItem(KEY, l); } catch (e) { /* noop */ }
    apply();
    listeners.forEach((f) => f(l));
  }
  return { t, apply, setLang, onChange: (f) => listeners.push(f), get lang() { return lang; } };
})();
