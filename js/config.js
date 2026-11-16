/* =========================================================
 * 摘発カウントダウン - ゲーム設定値（調整はこのファイルに集約）
 * ゲーム内ルールは法令を簡略化した「架空のルール」です。
 * ========================================================= */
window.CONFIG = Object.freeze({
  // --- 時間 ---
  gameDurationSeconds: 45,      // 22:00〜05:00 を何秒で進めるか（30〜60で調整）
  openingHour: 22,
  closingHour: 5,
  gameHours: 7,
  investigationHour: 3,         // 03:00前後に必ず1回
  investigationJitterMinutes: 15,

  // --- 来客 ---
  minCustomerInterval: 1.5,
  maxCustomerInterval: 3.0,
  maxVisibleCustomers: 5,
  minStaySeconds: 2.0,          // 待ち時間（これを過ぎると帰ってしまう）
  maxStaySeconds: 4.0,
  serveCooldown: 0.35,          // 1回の接客にかかる時間

  // --- 売上 ---
  normalCustomerSales: 5000,
  groupCustomerSales: 15000,    // 3名様
  groupSize: 3,
  vipCustomerSales: 30000,
  entertainmentSales: 12000,    // 接待を伴う飲食店での接待サービス（許可範囲内）

  // --- 経営 ---
  initialFunds: 100000,
  hourlyCost: 12000,            // 家賃・人件費（ゲーム内1時間ごと）
  repairCost: 10000,
  checkSeconds: 1.6,            // 営業確認中は入口を閉める
  checkCostPerIssue: 3000,
  correctionCostPerIssue: 20000,

  // --- コンプライアンス ---
  initialCompliance: 100,
  minimumCompliance: 0,
  issueDrainPerSecond: 0.9,     // 未是正の不整合1件あたり、現実1秒ごとに減る量
  issueChance: {                // 接客ごとに記録漏れ等の不整合が生じる確率
    generalRestaurant: 0.10,
    entertainmentWithService: 0.18,
  },
  investigationOkBonus: 5,
  correctionPenaltyPerIssue: 10,
  seriousIssueCount: 3,         // 調査時にこの件数以上なら営業停止

  // --- イベント ---
  minRandomEvents: 3,
  maxRandomEvents: 5,
  maxVipEvents: 2,
  buzzExtraCustomers: 10,
  buzzSeconds: 7,

  // --- スコア（100点満点。プレイテストで調整する仮設定） ---
  salesPerPoint: 5000,          // 売上 40点満点 → 200,000円
  customersPerPoint: 1.25,      // 来客 20点満点 → 25人
  operationScore: 20,
  complianceWeight: 0.2,
  ranks: [ ['S', 90], ['A', 80], ['B', 65], ['C', 50], ['D', 0] ],

  // --- 広告（Web版はダミー表示。ネイティブ化時に AdMob へ差し替え） ---
  ads: {
    enabled: true,
    useTestIds: true,
    interstitialEveryNPlays: 1,
    interstitialSeconds: 3,
    rewardedSeconds: 5,
  },
});
