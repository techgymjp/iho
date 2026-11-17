# App Store 掲載情報（下書き）

App Store Connect の「配信」タブ（iOS App のバージョン 1.0.0）と「App 情報」に入力します。プライマリ言語は日本語、英語（U.S.）をローカリゼーションとして追加してください。
Google Play 用の文章は `../listing.md` にあります（「概要」はそちらの「詳しい説明」を流用）。

## 画像（このフォルダ）

| 用途 | ファイル | サイズ |
| --- | --- | --- |
| スクリーンショット（日本語） | `6.3inch/ja-1-title.png` 〜 `ja-4-bust.png` | 1206 × 2622（縦向き） |
| スクリーンショット（英語） | `6.3inch/en-1-title.png` 〜 `en-4-bust.png` | 1206 × 2622（縦向き） |
| ヘッダ | `appstore-header-3840x1646.png` | 3840 × 1646（文字なし） |
| 検索結果 | `appstore-search-3840x2560.png` | 3840 × 2560（文字なし） |

スクリーンショットは「Dynamic Island 搭載 iPhone（中型ディスプレイ）」（6.3 インチ）の欄に入れます。縦画面のゲームなので縦向き（1206 × 2622）です。すべて透過なしの PNG です。

---

## 日本語

| 欄 | 文字数 | 内容 |
| --- | --- | --- |
| 名前 | 30 文字以内 | `摘発カウントダウン` |
| サブタイトル | 30 文字以内（18） | `表向きはただのバー。警察から逃げ切れ` |
| キーワード | 100 文字以内（55） | `バー,ナイトバー,キャスト,警察,摘発,接客,経営,タップ,カジュアル,お酒,シャンパン,夜,ネオン,逃げ切り` |

**プロモーション用テキスト**（170 文字以内・80 文字。審査なしでいつでも書き換えられる）

```
表向きは、ただのバー。お酒を勧めて稼ぎ、ドアの音がしたら警察か確かめて、キャストをカウンターの中へ逃がそう。1プレイ3分、朝5時まで摘発されずに営業できるか！？
```

**概要**：`../listing.md` の日本語の「詳しい説明」をそのまま貼る。

---

## English (U.S.)

| Field | Limit | Text |
| --- | --- | --- |
| Name | 30 | `Raid Countdown: Night Bar` |
| Subtitle | 30 (30) | `Hide the hostesses from police` |
| Keywords | 100 (97) | `bar,nightlife,hostess,police,raid,bartender,tap,casual,drinks,champagne,neon,night,escape,manager` |

**Promotional text** (max 170 · 161)

```
It looks like an ordinary bar. Pour drinks to boost sales, and when the door chimes, hide the hostesses before the police question them. Can you last until 5 AM?
```

**Description**: paste the English "Full description" from `../listing.md`.

---

## そのほかの欄

| 項目 | 入力内容 |
| --- | --- |
| サポート URL | https://techgym.jp/ |
| マーケティング URL（任意） | https://techgym.jp/column/claude-code-game-iho/ |
| プライバシーポリシー URL（App 情報） | https://techgym.jp/privacy-policy/ （英語は https://techgym.jp/privacy-policy-en/ ） |
| 著作権 | 2026 TECH GYM K.K. |
| カテゴリ | ゲーム（サブカテゴリ：シミュレーション、またはカジュアル） |
| 価格 | 無料 |
| コンテンツの配信権 | 第三者のコンテンツ「いいえ」（絵・音はすべて自作） |
| 年齢制限 | 質問に正直に答える。お酒（アルコール）の描写がゲームの中心なので「アルコール、タバコ、ドラッグの使用または言及」は「頻繁／極端」に当たる可能性が高い。暴力・性的な描写・ギャンブル・ユーザー同士の交流はなし |
| App のプライバシー | `docs/IOS_BUILD.md` の 5 章 |
