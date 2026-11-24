// Web ファイルを www/ にコピーする
//   npm run build     … Web 版用。そのままコピーする
//   npm run build:app … Android アプリ用(APP_BUILD=1)。Web 版だけの部分(テスト用の URL パラメータや window.__game など)を取り除く
// Web 版だけの部分は目印で囲む: HTML は <!-- web-only --> … <!-- /web-only -->、JS は // web-only:start … // web-only:end
// (アプリの中に「審査で見えない機能」を残すと、ストアの審査で却下されることがあるため)
const fs = require('fs');
const path = require('path');

const root = path.join(__dirname, '..');
const out = path.join(root, 'www');
fs.rmSync(out, { recursive: true, force: true });
fs.mkdirSync(out);
const APP = process.env.APP_BUILD === '1';
// ブラウザ用のファイル（ホーム画面に追加するためのマニフェストとアイコン）は Web 版だけ
const items = ['index.html', 'css', 'js', ...(APP ? [] : ['icon.svg', 'manifest.webmanifest'])];
for (const item of items) {
  const src = path.join(root, item);
  if (fs.existsSync(src)) fs.cpSync(src, path.join(out, item), { recursive: true });
}

// アプリの OS（android / ios）。指定すると、ほかの OS だけの部分（戻るボタン・広告 ID）を取り除く
const PLATFORM = process.env.APP_PLATFORM || '';
if (APP && PLATFORM && !['android', 'ios'].includes(PLATFORM)) { console.error(`APP_PLATFORM は android か ios: ${PLATFORM}`); process.exit(1); }
const PRODUCTION = process.env.ADMOB_MODE === 'production';

if (APP) {
  // 目印で囲んだ部分を取り除く:
  //   web-only           … Web 版だけ（テスト用のフック・URL パラメータ・X のボタンなど）
  //   platform:<OS>      … その OS だけ（APP_PLATFORM が別の OS のとき取り除く）
  //   ads:test           … テスト用の広告 ID（ストア用＝本番広告のビルドでは取り除く）
  // （アプリの中に「審査で見えない機能」や使われないコードを残さないため。App Store Guideline 5.6）
  const jsBlock = (name) => new RegExp(`[ \\t]*\\/\\/ ${name}:start[\\s\\S]*?\\/\\/ ${name}:end[ \\t]*\\n?`, 'g');
  const jsStrips = [jsBlock('web-only')];
  if (PLATFORM) for (const other of ['android', 'ios'].filter((o) => o !== PLATFORM)) jsStrips.push(jsBlock(`platform:${other}`));
  if (PRODUCTION) jsStrips.push(jsBlock('ads:test'));
  const htmlStrip = /[ \t]*<!-- web-only -->[\s\S]*?<!-- \/web-only -->[ \t]*\n?/g;
  // 取り除き忘れがあればビルドを止める
  const banned = [/web-only/, /__game/, /params\.get\(/];
  if (PLATFORM === 'ios') banned.push(/backButton/, /platform:android/);
  if (PLATFORM === 'android') banned.push(/platform:ios/);
  if (PRODUCTION) banned.push(/3940256099942544/); // Google のテスト用 ID
  const problems = [];
  const files = ['index.html', ...fs.readdirSync(path.join(out, 'js')).map((f) => path.join('js', f))];
  for (const name of files) {
    const file = path.join(out, name), ext = path.extname(name);
    if (ext !== '.js' && ext !== '.html') continue;
    let text = fs.readFileSync(file, 'utf8');
    if (ext === '.html') text = text.replace(htmlStrip, '');
    else for (const re of jsStrips) text = text.replace(re, '');
    fs.writeFileSync(file, text);
    for (const b of banned) if (b.test(text)) problems.push(`${name}: ${b}`);
  }
  if (problems.length) {
    console.error('アプリ用のビルドに、入れてはいけない部分が残っています:\n  ' + problems.join('\n  '));
    process.exit(1);
  }
}
// Google Play 用のビルドでは本番の広告を使う
const mode = PRODUCTION ? 'production' : 'test';
fs.writeFileSync(path.join(out, 'js', 'ads-config.js'), `// ビルド時に生成\nwindow.AD_MODE = '${mode}';\n`);
// タイトル画面に出すバージョン（CI では VERSION_NAME / VERSION_CODE を使う）
const version = process.env.VERSION_CODE
  ? `v${process.env.VERSION_NAME || require('../package.json').version} (build ${process.env.VERSION_CODE})`
  : 'dev';
fs.writeFileSync(path.join(out, 'js', 'build-info.js'), `// ビルド時に生成\nwindow.APP_VERSION = '${version}';\n`);
console.log(`built web assets into www/ (${APP ? 'app' + (PLATFORM ? ':' + PLATFORM : '') : 'web'}, ads: ${mode}, version: ${version})`);
