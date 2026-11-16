/* =========================================================
 * 摘発カウントダウン - ゲーム設定値（調整はこのファイルに集約）
 * 本作はフィクションです。実在の人物・店舗・事件とは関係ありません。
 * ========================================================= */
window.CONFIG = Object.freeze({
  // --- 時間 ---
  gameDurationSeconds: 180,     // 22:00〜05:00 を何秒で進めるか（3 分）
  openingHour: 22,
  gameHours: 7,
  inspectionHours: [0, 2, 4],   // 00:00・02:00・04:00 前後に必ず立入調査
  inspectionJitterMinutes: 10,

  // --- 来客（お客さんはキャストと同伴で来店し、カウンターに並んで座る） ---
  minCustomerInterval: 1.4,
  maxCustomerInterval: 2.6,
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
  heatPerSettaiSecond: 1.4,     // 客の隣にキャストが座っている1組あたり
  heatPerDrink: 3.0,            // お酒を勧めるたび
  heatDecayNoSettai: 2.0,       // 誰も接待していない時の減少量
  heatTipOff: 25,               // タレコミ
  heatAfterPassedVisit: -25,    // 警察をやり過ごした後

  // --- 警察（ドアの開く音で来店。見回りが始まるまでにキャストを逃がす） ---
  visitIntervalSeconds: [4.0, 7.0],
  firstVisitSeconds: [9, 13],    // 開店してから最初に警察が来るまで（慣れる時間）
  visitIntervalAtMaxHeat: 0.45, // 疑惑MAX付近では間隔がこの倍率まで短くなる
  warningSecondsSafe: 2.2,      // 疑惑0：ドアが開いてから店内を見るまで
  warningSecondsHot: 1.1,       // 疑惑100
  raidWarningSeconds: 0.75,     // 疑惑MAXの踏み込み
  castToCounterSeconds: 0.35,   // タップしたキャストがカウンターの中に逃げるまで
  castToBoxSeconds: 0.5,        // キャストが客の隣に戻るまで
  policeInsideSeconds: 2.2,     // 警察が店内を見回る時間
  policeExitSeconds: 0.7,       // 帰っていく時間（出ていくまで油断禁止）
  policeWalkSpeed: 115,         // キャストに歩み寄る速さ（たどり着く前に逃がせばセーフ）
  sleepyLookoutFactor: 0.6,     // 見張りが居眠り中は猶予が短くなる
  sleepyLookoutSeconds: 8,
  crackdownSeconds: 10,         // 取り締まり強化中は警察が早く来る
  // 夜が更けるほど厳しくなる（閉店間際にこの倍率になる）
  lateIntervalFactor: 0.65,     // 警察が来る間隔
  lateWarningFactor: 0.7,       // 入ってきてから見回るまでの猶予
  lateWalkFactor: 1.6,          // キャストに歩み寄る速さ

  // --- イベント ---
  minRandomEvents: 12,
  maxRandomEvents: 16,
  maxVipEvents: 5,
  buzzExtraCustomers: 5,

  // --- スコア（＝売上高）。ランクは売上で決まる ---
  ranks: [['S', 1500000], ['A', 1100000], ['B', 700000], ['C', 300000], ['D', 0]],

  // --- BGM（ナイトバー風ジャズ） ---
  bgmVolume: 0.5,
  bgmTempo: 88,

});
