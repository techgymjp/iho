# 摘発カウントダウン（Web版 MVP）

架空の繁華街「ネオン横丁」のバーを舞台にした、3分で遊べるワンタップ偽装経営ゲーム。

> 本作はフィクションです。実在の人物・団体・店舗・事件とは関係ありません。
> 現実の無許可営業は法律で禁止されています。

## 遊び方
舞台は架空のバー「BAR 夜更し」の店内。表向きはただのバーだけど、実は女性キャストがカウンター席でお客さんの隣に座って接客している（無許可）。
22:00〜翌05:00（3分）を摘発されずに稼ぎ切るゲームです。

- お客さんは女性キャストと**同伴**で来店し、カウンターに2人並んで座る（後ろ姿）。
- **お客さんをタップ**：お酒が出る。飲み終わったら、またタップでおかわり（ビール→ハイボール→ワイン→シャンパン→シャンパンタワー）。
- **ドアが開く音（カランコロン）**：お客さんも警察も同じ音で入ってくる。👮警察なら**キャストをタップ**してカウンターの中へ逃がす。
- 警察が店内を見回すときにキャストが客の隣にいたら、聞き込みされてアウト（摘発）。警察が出ていくまで油断禁止。
- 警察が帰ったら、カウンターの中のキャストをタップしてまた隣へ。
- お酒や接待で「疑惑」が上がると警察が来やすくなり、MAXで踏み込まれる。00:00・02:00・04:00ごろの立入調査は必ず来る。夜が更けるほど警察が早く・素早くなる。
- スコア＝売上高（ランク：S 150万円〜／A 110万円〜／B 70万円〜／C 30万円〜）

PC では 1〜3＝キャスト、Q/W/E＝お酒。

## 構成
```
index.html            画面（タイトル／ゲーム／結果）
css/style.css         ネオン調UI（9:16、セーフエリア対応、縦長端末は9:21まで拡張）
js/config.js          調整値を集約（時間・来客・売上・イベント・スコア・広告）
js/game.js            ゲーム本体（状態遷移・時間・来客・イベント・描画・保存・広告ダミー）
manifest.webmanifest  ホーム画面追加用
```
外部ライブラリなし。ビルド不要の静的ファイルです。

## ローカル実行
```bash
python3 -m http.server 8000
```
→ http://localhost:8000/

デバッグ用 URL パラメータ：`?seed=123`（イベント乱数を固定）、`?speed=4`（倍速）、`?noads=1`（広告を無効化）

## GitHub Pages
Settings → Pages → Source を「Deploy from a branch」、Branch を `main` / `(root)` に設定。

## Android アプリ
- パッケージ名：`jp.techgym.iho`／アプリ名：摘発カウントダウン（英語：Raid Countdown）
- 構成：Capacitor 8（`@capacitor/app`・`@capacitor/share`・`@capacitor-community/admob`）。ゲームのファイルはアプリに同梱（オフラインで遊べる）
- 動作確認用 APK（デバッグ署名・テスト広告）：
  - リリース画面：https://github.com/techgymjp/iho/releases/tag/android-latest
  - APK 直接：https://github.com/techgymjp/iho/releases/latest/download/iho.apk

  ![APK のリリース画面の QR コード](docs/apk-qr.png)
- ビルドは GitHub Actions（`.github/workflows/android.yml`）。`main` への push で APK を作って上の Release に載せる。
  GitHub Secrets（`ANDROID_KEYSTORE_BASE64` など 4 つ）を登録すると、Google Play 用の署名付き AAB（本番広告）も Artifact に作られる
- 広告（`js/ads.js`）：アプリのときだけ動く。Web 版では出さない
  - バナー：タイトル・あそびかた・ポーズ・結果画面の下中央
  - 全画面広告：プレイ開始・トップへ戻る・ポーズからの再開・もう一度 のたびに
  - リワード：摘発されたとき「広告を見て もみ消す」で、摘発をなかったことにして営業を続ける（1 ゲーム 1 回）
  - 本番の広告ユニット ID は未設定（届いたら `js/ads.js` の `production` と `android/app/src/main/res/values/strings.xml` の `admob_app_id` に入れる）
- ローカルでのビルド：
  ```bash
  npm ci
  npm run android:sync   # www/ を作って android/ にコピー（テスト広告）
  npm run android:open   # Android Studio で開く
  ```

## 保存データ（localStorage）
ベストスコア（最高売上）、総プレイ回数、累計売上、サウンド設定、チュートリアル完了。

## ライセンス
著作権はテックジム株式会社に帰属します（All rights reserved）。許可なく複製・改変・再配布すること、Web サイトやアプリとして公開・販売すること、名前・ロゴ・アイコン・画像を使うことを禁止します。テックジムの受講生が学習目的で複製・改変することは許可しますが、アプリストアでの公開・広告の掲載・販売などの商用利用は禁止です。詳しくは `LICENSE` を見てください。
