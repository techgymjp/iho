/* =========================================================
 * 摘発カウントダウン - キャラクター・エフェクト描画（オリジナル）
 * アニメ調のキャスト（正面・後ろ姿）、男性客、警察官、マスター、キラキラ。
 * 座標はすべて「足元（または座面）」基準、s は拡大率（1 = ゲーム内サイズ）。
 * ========================================================= */
(() => {
  'use strict';

  // ---------- 色ユーティリティ
  function hex(c) { return [1, 3, 5].map((i) => parseInt(c.slice(i, i + 2), 16)); }
  function shade(c, k) { // k<0 で暗く、k>0 で明るく
    const [r, g, b] = hex(c);
    const f = (v) => Math.round(k < 0 ? v * (1 + k) : v + (255 - v) * k);
    return `rgb(${f(r)},${f(g)},${f(b)})`;
  }
  function rgba(c, a) { const [r, g, b] = hex(c); return `rgba(${r},${g},${b},${a})`; }
  function lg(ctx, x0, y0, x1, y1, stops) { const g = ctx.createLinearGradient(x0, y0, x1, y1); stops.forEach(([o, c]) => g.addColorStop(o, c)); return g; }
  function ell(ctx, x, y, rx, ry, rot = 0) { ctx.beginPath(); ctx.ellipse(x, y, rx, ry, rot, 0, Math.PI * 2); }

  const SKIN = '#ffe2d0', SKIN_SH = '#f3bfa6';

  // ---------- キラキラ
  function sparkle(ctx, x, y, r, alpha = 1, color = '#fff') {
    ctx.save(); ctx.globalAlpha *= alpha; ctx.translate(x, y);
    ctx.shadowColor = color; ctx.shadowBlur = r * 2.2; ctx.fillStyle = color;
    ctx.beginPath();
    ctx.moveTo(0, -r); ctx.quadraticCurveTo(r * 0.14, -r * 0.14, r, 0); ctx.quadraticCurveTo(r * 0.14, r * 0.14, 0, r);
    ctx.quadraticCurveTo(-r * 0.14, r * 0.14, -r, 0); ctx.quadraticCurveTo(-r * 0.14, -r * 0.14, 0, -r);
    ctx.fill();
    ctx.globalAlpha *= 0.9; ctx.beginPath(); ctx.arc(0, 0, r * 0.18, 0, Math.PI * 2); ctx.fill();
    ctx.restore();
  }

  // ---------- 目（アニメ調・瞬きあり）
  function animeEyes(ctx, cx, cy, eye, t, seed, lashColor = '#2b1414') {
    const blink = (t * 0.85 + seed * 0.37) % 3.4 < 0.13;
    [-1, 1].forEach((side) => {
      const ex = cx + side * 5.6, ey = cy;
      if (blink) {
        ctx.strokeStyle = lashColor; ctx.lineWidth = 1.5; ctx.lineCap = 'round';
        ctx.beginPath(); ctx.moveTo(ex - 4, ey); ctx.quadraticCurveTo(ex, ey + 2.6, ex + 4, ey); ctx.stroke();
        return;
      }
      // 白目
      ctx.fillStyle = '#fff'; ell(ctx, ex, ey, 4.1, 5.2); ctx.fill();
      // 虹彩（グラデーション）
      const g = ctx.createLinearGradient(0, ey - 5, 0, ey + 5);
      g.addColorStop(0, shade(eye, -0.55)); g.addColorStop(0.55, eye); g.addColorStop(1, shade(eye, 0.55));
      ctx.fillStyle = g; ell(ctx, ex + side * 0.2, ey + 0.4, 3.3, 4.6); ctx.fill();
      ctx.fillStyle = shade(eye, -0.7); ell(ctx, ex + side * 0.2, ey + 0.6, 1.5, 2.3); ctx.fill();
      // ハイライト
      ctx.fillStyle = '#fff'; ell(ctx, ex + 1.3, ey - 1.8, 1.45, 1.6); ctx.fill();
      ctx.globalAlpha = 0.85; ell(ctx, ex - 1.2, ey + 2.4, 0.7, 0.7); ctx.fill(); ctx.globalAlpha = 1;
      // 上まつげ（太め＋外側にはね）
      ctx.strokeStyle = lashColor; ctx.lineWidth = 1.9; ctx.lineCap = 'round';
      ctx.beginPath(); ctx.moveTo(ex - side * 4.3, ey - 3.2); ctx.quadraticCurveTo(ex, ey - 6.6, ex + side * 4.6, ey - 3.6);
      ctx.lineTo(ex + side * 6.2, ey - 5.2); ctx.stroke();
      ctx.lineWidth = 0.8; ctx.beginPath(); ctx.moveTo(ex - 2.5, ey + 5.1); ctx.quadraticCurveTo(ex, ey + 5.9, ex + 2.5, ey + 5.1); ctx.stroke();
    });
  }

  // ---------- 髪型（後ろ髪）
  function backHair(ctx, style, hairG, t) {
    ctx.fillStyle = hairG;
    if (style === 'updo') {
      ell(ctx, 0, -86, 8.5, 7.5); ctx.fill();                  // お団子
      ctx.beginPath(); ctx.arc(0, -68, 15.5, Math.PI * 0.9, Math.PI * 2.1); ctx.lineTo(13, -56); ctx.lineTo(-13, -56); ctx.fill();
      return;
    }
    if (style === 'side') {
      ctx.beginPath(); ctx.arc(0, -68, 15.5, Math.PI, 0); ctx.lineTo(15, -58); ctx.lineTo(-15, -58); ctx.fill();
      const sw = Math.sin(t * 2) * 1.5;
      ctx.beginPath(); ctx.moveTo(12, -76); ctx.bezierCurveTo(28, -70, 22 + sw, -48, 18 + sw, -34);
      ctx.bezierCurveTo(14, -44, 14, -60, 8, -70); ctx.fill();
      return;
    }
    const wavy = style === 'wavy', bottom = wavy ? -28 : -24, w = wavy ? 20 : 17;
    ctx.beginPath(); ctx.arc(0, -68, 15.5, Math.PI, 0);
    ctx.bezierCurveTo(w, -58, w + 2, -44, w - 2, bottom);
    if (wavy) {
      for (let i = 0; i < 4; i++) { const x0 = w - 2 - i * ((w - 2) * 2 / 4), x1 = x0 - (w - 2) * 2 / 4; ctx.quadraticCurveTo((x0 + x1) / 2, bottom + 7, x1, bottom); }
    } else ctx.quadraticCurveTo(0, bottom + 4, -(w - 2), bottom);
    ctx.bezierCurveTo(-w - 2, -44, -w, -58, -15.5, -68);
    ctx.fill();
  }

  // ---------- 前髪・サイド・ツヤ
  function frontHair(ctx, style, hairG, hairHi) {
    ctx.fillStyle = hairG;
    // 頭頂〜前髪（ギザギザの毛先）
    ctx.beginPath();
    ctx.moveTo(-15.5, -66);
    ctx.bezierCurveTo(-17, -80, -8, -86, 0, -85.5);
    ctx.bezierCurveTo(8, -86, 17, -80, 15.5, -66);
    const tips = [[12, -63, 9.5, -70], [7, -65, 4.5, -71], [1.5, -64, -1.5, -71], [-4.5, -65.5, -7, -70.5], [-10, -64, -12, -70]];
    ctx.lineTo(15, -63);
    tips.forEach(([tx, ty, bx, by]) => { ctx.quadraticCurveTo(tx + 1.5, ty - 1, tx, ty); ctx.quadraticCurveTo(bx + 1, by + 2, bx, by); });
    ctx.quadraticCurveTo(-14, -66, -15.5, -60);
    ctx.closePath(); ctx.fill();
    // サイドの髪（顔の横〜肩）
    if (style !== 'updo') {
      const len = style === 'side' ? -50 : -40;
      [-1, 1].forEach((sd) => {
        if (style === 'side' && sd === 1) return;
        ctx.beginPath(); ctx.moveTo(sd * 15.5, -70);
        ctx.bezierCurveTo(sd * 18, -60, sd * 17, -50, sd * 14, len);
        ctx.bezierCurveTo(sd * 12.5, -52, sd * 12.5, -60, sd * 11.5, -66); ctx.fill();
      });
    } else {
      ctx.strokeStyle = hairG; ctx.lineWidth = 1.6;
      [-1, 1].forEach((sd) => { ctx.beginPath(); ctx.moveTo(sd * 13.5, -66); ctx.bezierCurveTo(sd * 16, -60, sd * 12, -57, sd * 15, -52); ctx.stroke(); });
    }
    // 天使の輪（ツヤ）
    ctx.strokeStyle = hairHi; ctx.lineWidth = 2.2; ctx.lineCap = 'round';
    ctx.beginPath(); ctx.arc(0, -71, 11, Math.PI * 1.15, Math.PI * 1.42); ctx.stroke();
    ctx.beginPath(); ctx.arc(0, -71, 11, Math.PI * 1.58, Math.PI * 1.85); ctx.stroke();
  }

  function accessory(ctx, acc, t, back = false) {
    if (acc === 'flower') {
      const fx = back ? 9 : -10, fy = -79;
      ctx.fillStyle = '#fff';
      for (let i = 0; i < 5; i++) { const a = (i / 5) * Math.PI * 2; ell(ctx, fx + Math.cos(a) * 2.6, fy + Math.sin(a) * 2.6, 2.1, 2.1); ctx.fill(); }
      ctx.fillStyle = '#ffd54f'; ell(ctx, fx, fy, 1.4, 1.4); ctx.fill();
    } else if (acc === 'tiara') {
      ctx.fillStyle = lg(ctx, 0, -88, 0, -80, [[0, '#fff8d0'], [1, '#e0b040']]);
      ctx.beginPath(); ctx.moveTo(-8, -81); ctx.lineTo(-6, -86); ctx.lineTo(-3, -83); ctx.lineTo(0, -89); ctx.lineTo(3, -83); ctx.lineTo(6, -86); ctx.lineTo(8, -81); ctx.closePath(); ctx.fill();
      sparkle(ctx, 0, -88, 2.6, 0.6 + 0.4 * Math.sin(t * 5));
    } else if (acc === 'pin') {
      ctx.fillStyle = '#e8f6ff'; ctx.save(); ctx.translate(back ? -9 : 9, -78); ctx.rotate(0.5); ctx.fillRect(-4, -1, 8, 2); ctx.restore();
      sparkle(ctx, back ? -9 : 9, -78, 2.4, 0.7 + 0.3 * Math.sin(t * 4), '#bfe9ff');
    } else if (acc === 'ribbon') {
      ctx.fillStyle = '#ff4f9e';
      const rx = back ? 0 : 0, ry = back ? -60 : -84;
      ctx.beginPath(); ctx.moveTo(rx, ry); ctx.lineTo(rx - 7, ry - 4); ctx.lineTo(rx - 7, ry + 4); ctx.closePath(); ctx.fill();
      ctx.beginPath(); ctx.moveTo(rx, ry); ctx.lineTo(rx + 7, ry - 4); ctx.lineTo(rx + 7, ry + 4); ctx.closePath(); ctx.fill();
    }
  }

  function dressGrad(ctx, c, y0, y1) { return lg(ctx, 0, y0, 0, y1, [[0, shade(c.dress, 0.45)], [0.45, c.dress], [1, shade(c.dress, -0.3)]]); }
  function sequins(ctx, t, pts) {
    pts.forEach(([x, y], i) => { const a = 0.35 + 0.65 * Math.max(0, Math.sin(t * 3 + i * 1.7)); ctx.fillStyle = `rgba(255,255,255,${a})`; ell(ctx, x, y, 0.7, 0.7); ctx.fill(); });
  }

  // ---------- キャスト（正面）
  function girlFront(ctx, x, y, s, c, t, opts = {}) {
    const walk = opts.walking ? Math.sin(opts.phase || 0) : 0;
    const bob = opts.walking ? Math.abs(walk) * 1.5 : 0;
    ctx.save(); ctx.translate(x, y); ctx.scale(s, s);
    // 影
    ctx.fillStyle = 'rgba(0,0,0,0.3)'; ell(ctx, 0, 1, 13, 3.2); ctx.fill();
    ctx.translate(0, -bob);
    const hairG = lg(ctx, 0, -88, 0, -24, [[0, shade(c.hair, 0.25)], [0.5, c.hair], [1, shade(c.hair, -0.35)]]);
    backHair(ctx, c.style, hairG, t);
    // 脚・ヒール
    [-1, 1].forEach((sd) => {
      const sw = sd * walk * 2.5;
      ctx.fillStyle = lg(ctx, sd * 5, 0, sd * 2, 0, [[0, SKIN_SH], [1, SKIN]]);
      ctx.beginPath(); ctx.moveTo(sd * 2 + sw, -18); ctx.lineTo(sd * 6.5 + sw, -18); ctx.lineTo(sd * 5 + sw, -2); ctx.lineTo(sd * 2.8 + sw, -2); ctx.fill();
      ctx.fillStyle = shade(c.dress, -0.35); ell(ctx, sd * 4.2 + sw, -1.2, 3, 1.6); ctx.fill();
    });
    // 腕
    ctx.strokeStyle = SKIN; ctx.lineWidth = 3.6; ctx.lineCap = 'round';
    ctx.beginPath(); ctx.moveTo(-9, -49); ctx.quadraticCurveTo(-14, -40, -11 - walk * 2, -31); ctx.stroke();
    ctx.beginPath(); ctx.moveTo(9, -49); ctx.quadraticCurveTo(14, -40, 11 + walk * 2, -31); ctx.stroke();
    // 首・デコルテ
    ctx.fillStyle = SKIN; ctx.fillRect(-3, -57, 6, 7);
    ctx.beginPath(); ctx.moveTo(-9, -51); ctx.quadraticCurveTo(0, -46, 9, -51); ctx.lineTo(8, -45); ctx.lineTo(-8, -45); ctx.fill();
    // ドレス
    ctx.fillStyle = dressGrad(ctx, c, -50, -14);
    ctx.beginPath();
    ctx.moveTo(-8.5, -47); ctx.quadraticCurveTo(-4.5, -44, 0, -46.5); ctx.quadraticCurveTo(4.5, -44, 8.5, -47);
    ctx.lineTo(7.5, -38); ctx.bezierCurveTo(12, -30, 16, -22, 17, -15);
    ctx.quadraticCurveTo(8.5, -11.5, 0, -13.5); ctx.quadraticCurveTo(-8.5, -11.5, -17, -15);
    ctx.bezierCurveTo(-16, -22, -12, -30, -7.5, -38); ctx.closePath(); ctx.fill();
    // ウエストのライン・ツヤ・スパンコール
    ctx.strokeStyle = rgba('#ffffff', 0.55); ctx.lineWidth = 1;
    ctx.beginPath(); ctx.moveTo(-7.5, -38); ctx.quadraticCurveTo(0, -36, 7.5, -38); ctx.stroke();
    ctx.fillStyle = 'rgba(255,255,255,0.28)'; ctx.beginPath(); ctx.moveTo(-4, -44); ctx.quadraticCurveTo(-9, -28, -8, -16); ctx.lineTo(-5, -16); ctx.quadraticCurveTo(-6, -30, -2, -44); ctx.fill();
    sequins(ctx, t, [[-6, -24], [3, -30], [9, -20], [-11, -18], [5, -18], [-2, -40], [0, -22]]);
    // ネックレス
    ctx.strokeStyle = 'rgba(255,255,255,0.8)'; ctx.lineWidth = 0.7; ctx.beginPath(); ctx.arc(0, -53, 5, Math.PI * 0.15, Math.PI * 0.85); ctx.stroke();
    sparkle(ctx, 0, -48.2, 1.8, 0.7 + 0.3 * Math.sin(t * 6 + x));
    // 顔
    ctx.fillStyle = lg(ctx, 0, -84, 0, -50, [[0, '#fff3ea'], [1, SKIN]]);
    ctx.beginPath(); ctx.moveTo(-13.5, -68);
    ctx.bezierCurveTo(-13.5, -58, -6, -51.5, 0, -51); ctx.bezierCurveTo(6, -51.5, 13.5, -58, 13.5, -68);
    ctx.arc(0, -68, 13.5, 0, Math.PI, true); ctx.fill();
    // 頬
    ctx.fillStyle = 'rgba(255,120,150,0.33)'; ell(ctx, -8, -58.5, 3.2, 1.8); ctx.fill(); ell(ctx, 8, -58.5, 3.2, 1.8); ctx.fill();
    // 眉
    ctx.strokeStyle = shade(c.hair, -0.2); ctx.lineWidth = 0.9;
    ctx.beginPath(); ctx.moveTo(-9, -71.5); ctx.quadraticCurveTo(-5.5, -73, -2.5, -71.8); ctx.stroke();
    ctx.beginPath(); ctx.moveTo(9, -71.5); ctx.quadraticCurveTo(5.5, -73, 2.5, -71.8); ctx.stroke();
    animeEyes(ctx, 0, -63.5, c.eye, t, x * 0.1 + (c.seed || 0));
    // 口
    ctx.strokeStyle = '#d4576b'; ctx.lineWidth = 1.1; ctx.lineCap = 'round';
    ctx.beginPath(); ctx.moveTo(-2.2, -55.6); ctx.quadraticCurveTo(0, -54, 2.2, -55.6); ctx.stroke();
    // ピアス
    sparkle(ctx, -13, -58, 1.6, 0.6 + 0.4 * Math.sin(t * 5), '#fff6c0'); sparkle(ctx, 13, -58, 1.6, 0.6 + 0.4 * Math.cos(t * 5), '#fff6c0');
    frontHair(ctx, c.style, hairG, rgba('#ffffff', 0.45));
    accessory(ctx, c.acc, t);
    ctx.restore();
  }

  // ---------- キャスト（後ろ姿・スツールに座る）
  function girlBack(ctx, x, seatY, s, c, t, opts = {}) {
    ctx.save(); ctx.translate(x, seatY); ctx.rotate(opts.lean || 0); ctx.scale(s, s);
    // 脚
    [-1, 1].forEach((sd) => {
      ctx.fillStyle = SKIN_SH; ctx.beginPath(); ctx.moveTo(sd * 2, 2); ctx.lineTo(sd * 6.5, 2); ctx.lineTo(sd * 5.5, 20); ctx.lineTo(sd * 2.8, 20); ctx.fill();
      ctx.fillStyle = shade(c.dress, -0.35); ell(ctx, sd * 4.2, 20.5, 2.8, 1.5); ctx.fill();
    });
    // 背中の肌（Vカット）
    ctx.fillStyle = SKIN; ctx.beginPath(); ctx.moveTo(-9, -35); ctx.lineTo(9, -35); ctx.lineTo(2, -18); ctx.lineTo(-2, -18); ctx.fill();
    // ドレス（背中）
    ctx.fillStyle = dressGrad(ctx, c, -36, 6);
    ctx.beginPath(); ctx.moveTo(-9.5, -35); ctx.lineTo(-2, -18); ctx.lineTo(2, -18); ctx.lineTo(9.5, -35);
    ctx.bezierCurveTo(12, -24, 15, -8, 15.5, 5); ctx.quadraticCurveTo(0, 8, -15.5, 5); ctx.bezierCurveTo(-15, -8, -12, -24, -9.5, -35); ctx.fill();
    ctx.fillStyle = 'rgba(255,255,255,0.25)'; ctx.beginPath(); ctx.moveTo(-8, -28); ctx.quadraticCurveTo(-12, -10, -11, 4); ctx.lineTo(-8, 4); ctx.quadraticCurveTo(-9, -10, -5, -26); ctx.fill();
    sequins(ctx, t, [[-6, -6], [5, -12], [9, 0], [-10, 2], [1, -2]]);
    // 腕（客の方へ）
    if (opts.arm) {
      ctx.strokeStyle = SKIN; ctx.lineWidth = 3.6; ctx.lineCap = 'round';
      ctx.beginPath(); ctx.moveTo(opts.arm * 9, -31); ctx.quadraticCurveTo(opts.arm * 17, -26, opts.arm * 23, -26 + Math.sin(t * 5) * 1.5); ctx.stroke();
    }
    // 頭・後ろ髪
    const hairG = lg(ctx, 0, -62, 0, -10, [[0, shade(c.hair, 0.3)], [0.45, c.hair], [1, shade(c.hair, -0.35)]]);
    ctx.fillStyle = hairG;
    ell(ctx, 0, -48, 13, 13.5); ctx.fill();
    if (c.style === 'updo') {
      ell(ctx, 0, -62, 7.5, 6.5); ctx.fill();
      ctx.fillStyle = SKIN; ctx.fillRect(-3.5, -37, 7, 4);                  // うなじ
      ctx.fillStyle = hairG; ctx.beginPath(); ctx.moveTo(-13, -48); ctx.quadraticCurveTo(-8, -38, 0, -37.5); ctx.quadraticCurveTo(8, -38, 13, -48); ctx.fill();
    } else if (c.style === 'side') {
      ctx.beginPath(); ctx.moveTo(-6, -40); ctx.bezierCurveTo(-18, -34, -16, -18, -14, -10); ctx.bezierCurveTo(-11, -20, -6, -30, 2, -38); ctx.fill();
    } else {
      const wavy = c.style === 'wavy', bottom = wavy ? -12 : -8;
      ctx.beginPath(); ctx.moveTo(-13, -50); ctx.bezierCurveTo(-15, -36, -14, -24, -12, bottom);
      if (wavy) { for (let i = 0; i < 4; i++) { const x0 = -12 + i * 6, x1 = x0 + 6; ctx.quadraticCurveTo((x0 + x1) / 2, bottom + 5, x1, bottom); } }
      else ctx.quadraticCurveTo(0, bottom + 3, 12, bottom);
      ctx.bezierCurveTo(14, -24, 15, -36, 13, -50); ctx.fill();
    }
    ctx.strokeStyle = 'rgba(255,255,255,0.4)'; ctx.lineWidth = 2; ctx.lineCap = 'round';
    ctx.beginPath(); ctx.arc(0, -46, 10, Math.PI * 1.15, Math.PI * 1.45); ctx.stroke();
    ctx.beginPath(); ctx.moveTo(-7, -34); ctx.quadraticCurveTo(-8, -24, -6, -16); ctx.stroke();
    accessory(ctx, c.acc, t, true);
    ctx.restore();
  }

  // ---------- 男性（客・警察・マスター）正面
  function manFront(ctx, x, y, s, look, t, opts = {}) {
    const walk = opts.walking ? Math.sin(opts.phase || 0) : 0, bob = opts.walking ? Math.abs(walk) * 1.5 : 0;
    const suit = look.police ? '#203462' : look.vest ? '#1d1d24' : look.body;
    ctx.save(); ctx.translate(x, y); ctx.scale(s, s);
    ctx.fillStyle = 'rgba(0,0,0,0.3)'; ell(ctx, 0, 1, 13, 3.2); ctx.fill();
    ctx.translate(0, -bob);
    // 脚
    [-1, 1].forEach((sd) => {
      const sw = sd * walk * 3;
      ctx.fillStyle = look.police ? '#1a2a50' : '#1b1a22';
      ctx.fillRect(sd * 1 + (sd < 0 ? -6 : 0) + sw, -24, 6, 23);
      ctx.fillStyle = '#0d0d10'; ell(ctx, sd * 4 + sw, -1, 4, 1.8); ctx.fill();
    });
    // 胴（スーツ）
    ctx.fillStyle = look.vest ? '#f4f4f4' : lg(ctx, -14, 0, 14, 0, [[0, shade(suit, -0.25)], [0.5, shade(suit, 0.12)], [1, shade(suit, -0.3)]]);
    ctx.beginPath(); ctx.moveTo(-12, -50); ctx.quadraticCurveTo(-15, -36, -13, -22); ctx.lineTo(13, -22); ctx.quadraticCurveTo(15, -36, 12, -50); ctx.quadraticCurveTo(0, -54, -12, -50); ctx.fill();
    if (look.vest) {
      ctx.fillStyle = '#1d1d24'; ctx.beginPath(); ctx.moveTo(-9, -47); ctx.lineTo(-1, -36); ctx.lineTo(-1, -22); ctx.lineTo(-11, -22); ctx.fill();
      ctx.beginPath(); ctx.moveTo(9, -47); ctx.lineTo(1, -36); ctx.lineTo(1, -22); ctx.lineTo(11, -22); ctx.fill();
      ctx.fillStyle = '#ff2e88'; ctx.beginPath(); ctx.moveTo(0, -48); ctx.lineTo(-5, -51); ctx.lineTo(-5, -45); ctx.closePath(); ctx.moveTo(0, -48); ctx.lineTo(5, -51); ctx.lineTo(5, -45); ctx.closePath(); ctx.fill();
    } else if (look.police) {
      ctx.fillStyle = '#e8eef8'; ctx.beginPath(); ctx.moveTo(-3, -50); ctx.lineTo(0, -45); ctx.lineTo(3, -50); ctx.fill();
      ctx.fillStyle = '#0f1a33'; ctx.fillRect(-13, -30, 26, 3);
      ctx.fillStyle = '#ffd54f'; ell(ctx, -6, -42, 1.8, 2.2); ctx.fill();
      sparkle(ctx, -6, -42, 1.5, 0.6);
    } else {
      ctx.fillStyle = '#f2f2f2'; ctx.beginPath(); ctx.moveTo(-5, -51); ctx.lineTo(0, -40); ctx.lineTo(5, -51); ctx.fill();
      ctx.fillStyle = look.tie || '#b3263c'; ctx.beginPath(); ctx.moveTo(-1.3, -48); ctx.lineTo(1.3, -48); ctx.lineTo(2, -39); ctx.lineTo(0, -37); ctx.lineTo(-2, -39); ctx.fill();
      ctx.strokeStyle = 'rgba(0,0,0,0.3)'; ctx.lineWidth = 1; ctx.beginPath(); ctx.moveTo(-5, -51); ctx.lineTo(-1, -30); ctx.moveTo(5, -51); ctx.lineTo(1, -30); ctx.stroke();
      if (look.gold) { ctx.strokeStyle = '#ffd54f'; ctx.lineWidth = 1.2; ctx.beginPath(); ctx.arc(0, -49, 5, Math.PI * 0.1, Math.PI * 0.9); ctx.stroke(); }
    }
    // 腕
    ctx.strokeStyle = look.vest ? '#f4f4f4' : shade(suit, -0.1); ctx.lineWidth = 5; ctx.lineCap = 'round';
    ctx.beginPath(); ctx.moveTo(-12, -48); ctx.lineTo(-14 - walk * 2, -28); ctx.moveTo(12, -48); ctx.lineTo(14 + walk * 2, -28); ctx.stroke();
    // 顔
    const skin = look.skin || '#f6d3bb';
    ctx.fillStyle = skin; ctx.fillRect(-3, -56, 6, 6);
    ctx.fillStyle = lg(ctx, 0, -80, 0, -52, [[0, shade(skin, 0.25)], [1, skin]]);
    ctx.beginPath(); ctx.moveTo(-12, -67); ctx.bezierCurveTo(-12, -58, -6, -53, 0, -52.5); ctx.bezierCurveTo(6, -53, 12, -58, 12, -67); ctx.arc(0, -67, 12, 0, Math.PI, true); ctx.fill();
    // 目（シンプル）
    const blink = (t * 0.8 + x * 0.05) % 3.6 < 0.12;
    ctx.fillStyle = '#2a1c1c'; ctx.strokeStyle = '#2a1c1c'; ctx.lineWidth = 1.3;
    [-4.6, 4.6].forEach((dx) => {
      if (blink) { ctx.beginPath(); ctx.moveTo(dx - 2.2, -63); ctx.lineTo(dx + 2.2, -63); ctx.stroke(); return; }
      ell(ctx, dx, -63, 1.8, 2.4); ctx.fill();
      ctx.fillStyle = '#fff'; ell(ctx, dx + 0.6, -63.9, 0.6, 0.6); ctx.fill(); ctx.fillStyle = '#2a1c1c';
    });
    ctx.beginPath(); ctx.moveTo(-7, -68); ctx.lineTo(-2.5, -68.6); ctx.moveTo(7, -68); ctx.lineTo(2.5, -68.6); ctx.stroke();
    ctx.strokeStyle = '#a85a50'; ctx.lineWidth = 1; ctx.beginPath(); ctx.moveTo(-2, -57); ctx.quadraticCurveTo(0, look.police ? -57 : -56, 2, -57); ctx.stroke();
    // 髪
    const hair = look.hair || '#2a2a2a';
    ctx.fillStyle = lg(ctx, 0, -82, 0, -64, [[0, shade(hair, 0.25)], [1, hair]]);
    ctx.beginPath(); ctx.moveTo(-12.5, -64); ctx.bezierCurveTo(-14, -80, -6, -82, 0, -81.5); ctx.bezierCurveTo(8, -82, 14, -78, 12.5, -64);
    ctx.quadraticCurveTo(9, -71, 2, -72); ctx.quadraticCurveTo(-6, -70, -10, -73); ctx.quadraticCurveTo(-11, -68, -12.5, -64); ctx.fill();
    if (look.police) { // 制帽
      ctx.fillStyle = '#16233f'; ctx.beginPath(); ctx.moveTo(-13, -73); ctx.quadraticCurveTo(0, -90, 13, -73); ctx.closePath(); ctx.fill();
      ctx.fillStyle = '#0b1226'; ctx.beginPath(); ctx.ellipse(0, -72.5, 14, 2.6, 0, 0, Math.PI); ctx.fill();
      ctx.fillStyle = '#ffd54f'; ell(ctx, 0, -79, 2.2, 2.2); ctx.fill();
    }
    ctx.restore();
  }

  // ---------- 男性客（後ろ姿・スツールに座る）
  function manBack(ctx, x, seatY, s, look, t, opts = {}) {
    ctx.save(); ctx.translate(x, seatY); ctx.rotate(opts.lean || 0); ctx.scale(s, s);
    ctx.fillStyle = '#18171e'; ctx.fillRect(-7, 2, 5, 20); ctx.fillRect(2, 2, 5, 20);
    ctx.fillStyle = '#0d0d10'; ell(ctx, -4.5, 22, 3.6, 1.6); ctx.fill(); ell(ctx, 4.5, 22, 3.6, 1.6); ctx.fill();
    const suit = look.body;
    ctx.fillStyle = lg(ctx, -15, 0, 15, 0, [[0, shade(suit, -0.3)], [0.45, shade(suit, 0.15)], [1, shade(suit, -0.35)]]);
    ctx.beginPath(); ctx.moveTo(-13, -36); ctx.quadraticCurveTo(-16, -15, -15, 5); ctx.lineTo(15, 5); ctx.quadraticCurveTo(16, -15, 13, -36); ctx.quadraticCurveTo(0, -40, -13, -36); ctx.fill();
    ctx.strokeStyle = 'rgba(0,0,0,0.28)'; ctx.lineWidth = 1; ctx.beginPath(); ctx.moveTo(0, -36); ctx.lineTo(0, 5); ctx.stroke();
    if (look.gold) { ctx.fillStyle = '#ffd54f'; ctx.fillRect(-14, -10, 28, 2); }
    if (opts.arm) {
      ctx.strokeStyle = shade(suit, -0.1); ctx.lineWidth = 5; ctx.lineCap = 'round';
      ctx.beginPath(); ctx.moveTo(opts.arm * 11, -31); ctx.quadraticCurveTo(opts.arm * 18, -26, opts.arm * 22, -24); ctx.stroke();
    }
    if (opts.drink) { // グラスを口へ
      ctx.strokeStyle = shade(suit, -0.1); ctx.lineWidth = 5; ctx.lineCap = 'round';
      ctx.beginPath(); ctx.moveTo(-11, -31); ctx.lineTo(-13, -46); ctx.stroke();
      ctx.font = '11px sans-serif'; ctx.textAlign = 'center'; ctx.textBaseline = 'middle'; ctx.fillText(opts.drink, -14, -52);
    }
    // シャツの襟・首
    ctx.fillStyle = '#f0f0f0'; ctx.fillRect(-5, -39, 10, 3);
    ctx.fillStyle = look.skin || '#f1c7a5'; ctx.fillRect(-4, -43, 8, 5);
    ell(ctx, -10.5, -48, 2.6, 3.2); ctx.fill(); ell(ctx, 10.5, -48, 2.6, 3.2); ctx.fill();
    const hair = look.hair || '#2a2a2a';
    ctx.fillStyle = lg(ctx, 0, -60, 0, -40, [[0, shade(hair, 0.25)], [1, shade(hair, -0.2)]]);
    ell(ctx, 0, -49, 11, 11.5); ctx.fill();
    ctx.beginPath(); ctx.moveTo(-10, -48); ctx.quadraticCurveTo(0, -38, 10, -48); ctx.fill();
    ctx.strokeStyle = 'rgba(255,255,255,0.25)'; ctx.lineWidth = 1.8; ctx.beginPath(); ctx.arc(0, -50, 8, Math.PI * 1.2, Math.PI * 1.5); ctx.stroke();
    ctx.restore();
  }

  // ---------- キャスト一覧（オリジナル）
  const CASTS = [
    { name: 'ミナ', dress: '#ff5fa8', hair: '#6b3a22', eye: '#a8562e', style: 'wavy', acc: 'flower', seed: 1 },
    { name: 'レイ', dress: '#46c9ef', hair: '#1c1820', eye: '#3a6fb0', style: 'long', acc: 'pin', seed: 2 },
    { name: 'サキ', dress: '#ffc23d', hair: '#e8c27a', eye: '#c27a10', style: 'updo', acc: 'tiara', seed: 3 },
    { name: 'ユナ', dress: '#b67cff', hair: '#4a2a1e', eye: '#7b4fb0', style: 'side', acc: 'ribbon', seed: 4 },
    { name: 'アイ', dress: '#ff7a6a', hair: '#9a4a2a', eye: '#b5402a', style: 'wavy', acc: 'tiara', seed: 5 },
    { name: 'ルカ', dress: '#6fe3b0', hair: '#d8d4e8', eye: '#2e8b6e', style: 'long', acc: 'flower', seed: 6 },
  ];
  CASTS.forEach((c) => { c.hl = shade(c.dress, 0.5); });

  window.Art = { sparkle, girlFront, girlBack, manFront, manBack, CASTS, shade, rgba };
})();
