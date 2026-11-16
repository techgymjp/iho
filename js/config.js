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

  // --- 来客 ---
  minCustomerInterval: 1.3,
  maxCustomerInterval: 2.6,
  maxWaiting: 3,                // 入口で待てる人数
  minWaitSeconds: 3.0,          // 入口で待つ時間（過ぎると帰る）
  maxWaitSeconds: 5.0,
  seats: 3,                     // カウンター席（客＋隣にキャスト）の組数
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
  heatUndercover: 40,           // 内偵客の隣にキャストを座らせてしまった
  heatTipOff: 25,               // タレコミ
  heatAfterPassedVisit: -25,    // 警察をやり過ごした後

  // --- 来訪者（ノック） ---
  visitIntervalSeconds: [4.5, 7.5],
  policeChanceBase: 0.3,        // 疑惑0のとき警察である確率
  policeChanceAtMaxHeat: 0.85,
  warningSecondsSafe: 2.4,      // 疑惑0のときの猶予（ノックからドアが開くまで）
  warningSecondsHot: 1.2,       // 疑惑100のときの猶予
  raidWarningSeconds: 1.0,      // 疑惑MAXの踏み込み
  castToCounterSeconds: 0.35,   // タップしたキャストがカウンターに戻るまで
  castToBoxSeconds: 0.5,        // キャストが客の隣に座るまで
  policeInsideSeconds: 1.8,     // 警察が店内を見回る時間
  visitorInsideSeconds: 1.2,
  sleepyLookoutFactor: 0.55,    // 見張りが居眠り中は猶予が短くなる
  sleepyLookoutSeconds: 8,

  // --- イベント ---
  minRandomEvents: 3,
  maxRandomEvents: 5,
  maxVipEvents: 2,
  buzzExtraCustomers: 8,

  // --- スコア（100点満点。プレイテストで調整する仮設定） ---
  salesPerPoint: 10000,         // 売上 50点満点 → 500,000円
  customersPerPoint: 1.5,       // 来客 20点満点 → 30人
  survivalScore: 30,            // 朝まで摘発されなければ30点
  ranks: [['S', 90], ['A', 80], ['B', 65], ['C', 50], ['D', 0]],

  // --- 広告（Web版はダミー表示。ネイティブ化時に AdMob へ差し替え） ---
  ads: {
    enabled: true,
    interstitialEveryNPlays: 1,
    interstitialSeconds: 3,
    rewardedSeconds: 5,
  },
});
