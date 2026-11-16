/* =========================================================
 * 摘発カウントダウン - ゲーム設定値（調整はこのファイルに集約）
 * 本作はフィクションです。実在の人物・店舗・事件とは関係ありません。
 * ========================================================= */
window.CONFIG = Object.freeze({
  // --- 時間 ---
  gameDurationSeconds: 45,      // 22:00〜05:00 を何秒で進めるか（30〜60で調整）
  openingHour: 22,
  gameHours: 7,
  inspectionHour: 3,            // 03:00前後に必ず立入調査
  inspectionJitterMinutes: 10,

  // --- 来客（お客さんはキャストと同伴で来店し、カウンターに並んで座る） ---
  minCustomerInterval: 1.6,
  maxCustomerInterval: 3.0,
  seats: 3,                     // カウンター席（客＋隣にキャスト）の組数
  pairEnterSeconds: 0.9,        // ドアから席に着くまで
  staySeconds: [7.0, 9.5],

  // --- 売上 ---
  setCharge: 4000,              // 席料（普通のバーとしての売上）
  drinks: [                     // 隣にキャストがいる客をタップするたびに一杯（だんだん高くなる）
    ['🍺', 'ビール', 2000],
    ['🥃', 'ハイボール', 3000],
    ['🍷', 'ワイン', 6000],
    ['🍾', 'シャンパン', 12000],
    ['🥂', 'シャンパンタワー', 30000],
  ],
  vipDrinkMultiplier: 2,
  drinkSeconds: 1.1,            // 1杯を飲み終わるまで（その間は次を出せない）

  // --- 疑惑ゲージ（0〜100。100で警察が踏み込む） ---
  heatPerSettaiSecond: 1.0,     // 客の隣にキャストが座っている1組あたり
  heatPerDrink: 2.5,            // お酒を勧めるたび
  heatDecayNoSettai: 2.5,       // 誰も接待していない時の減少量
  heatTipOff: 25,               // タレコミ
  heatAfterPassedVisit: -25,    // 警察をやり過ごした後

  // --- 警察（ドアの開く音で来店。見回りが始まるまでにキャストを逃がす） ---
  visitIntervalSeconds: [6.0, 10.0],
  visitIntervalAtMaxHeat: 0.5,  // 疑惑MAX付近では間隔がこの倍率まで短くなる
  warningSecondsSafe: 1.8,      // 疑惑0：ドアが開いてから店内を見るまで
  warningSecondsHot: 1.0,       // 疑惑100
  raidWarningSeconds: 0.7,      // 疑惑MAXの踏み込み
  castToCounterSeconds: 0.35,   // タップしたキャストがカウンターの中に逃げるまで
  castToBoxSeconds: 0.5,        // キャストが客の隣に戻るまで
  policeInsideSeconds: 1.8,     // 警察が店内を見回る時間
  policeExitSeconds: 0.7,       // 帰っていく時間（出ていくまで油断禁止）
  sleepyLookoutFactor: 0.6,     // 見張りが居眠り中は猶予が短くなる
  sleepyLookoutSeconds: 8,
  crackdownSeconds: 8,          // 取り締まり強化中は警察が早く来る

  // --- イベント ---
  minRandomEvents: 3,
  maxRandomEvents: 5,
  maxVipEvents: 2,
  buzzExtraCustomers: 5,

  // --- スコア（＝売上高）。ランクは売上で決まる ---
  ranks: [['S', 500000], ['A', 350000], ['B', 200000], ['C', 100000], ['D', 0]],

  // --- BGM（ナイトバー風ジャズ） ---
  bgmVolume: 0.5,
  bgmTempo: 88,

  // --- 広告（Web版はダミー表示。ネイティブ化時に AdMob へ差し替え） ---
  ads: {
    enabled: true,
    interstitialEveryNPlays: 1,
    interstitialSeconds: 3,
    rewardedSeconds: 5,
  },
});
