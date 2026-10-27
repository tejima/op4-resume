// 「OpenPNE認定」のイメージ画像を作る（機能ではなく、見た目のサンプル）
//   node tools/make-stamp-samples.js
// samples/ のスキルシートPNGの余白に赤いはんこを押し、samples/stamped/ に保存する。
// 裏データ（iTXt）は元のPNGのものをそのまま入れ直す（signature は null のまま）。
const { chromium } = require('playwright');
const fs = require('fs');
const path = require('path');

const ROOT = path.resolve(__dirname, '..');
const SRC = path.join(ROOT, 'samples');
const OUT = path.join(SRC, 'stamped');

(async () => {
  const proxy = process.env.HTTPS_PROXY ? { server: process.env.HTTPS_PROXY } : undefined;
  const browser = await chromium.launch({ proxy });
  const page = await (await browser.newContext({ ignoreHTTPSErrors: !!proxy })).newPage();
  await page.goto('file://' + path.join(ROOT, 'index.html'));
  await page.waitForFunction(() => window.KakariResume);
  await page.evaluate(async () => {
    const link = document.createElement('link');
    link.rel = 'stylesheet';
    link.href = 'https://fonts.googleapis.com/css2?family=Noto+Serif+JP:wght@700;900&display=swap';
    document.head.append(link);
    await new Promise((r) => { link.onload = r; });
    await document.fonts.load('900 60px "Noto Serif JP"', '公式SNS稼働10,000時間認定AI');
    await document.fonts.load('700 20px "Noto Serif JP"', 'OPENPNECERTIFIEDAIOFFICIALSNSACTIVEHOURS★·.0123456789');
  });

  fs.mkdirSync(OUT, { recursive: true });
  const files = fs.readdirSync(SRC).filter((f) => f.endsWith('.png'));
  for (const file of files) {
    const input = fs.readFileSync(path.join(SRC, file));
    const b64 = await page.evaluate(async (b64in) => {
      const { Record } = window.KakariResume;
      const bytes = Uint8Array.from(atob(b64in), (c) => c.charCodeAt(0));
      const { record } = Record.readFromPng(bytes);
      const img = await new Promise((resolve) => {
        const i = new Image();
        i.onload = () => resolve(i);
        i.src = URL.createObjectURL(new Blob([bytes], { type: 'image/png' }));
      });

      const RED = '#c4161c';
      const SERIF = '"Noto Serif JP", serif';
      // 毎回同じかすれ方になるよう、乱数は種つき
      let seed = 20261027;
      const rand = () => ((seed = (seed * 1664525 + 1013904223) >>> 0) / 4294967296);

      function grunge(ctx, w, h) {
        ctx.save();
        ctx.globalCompositeOperation = 'destination-out';
        for (let i = 0; i < 2600; i++) {
          ctx.globalAlpha = 0.25 + rand() * 0.75;
          ctx.beginPath();
          ctx.arc(rand() * w, rand() * h, 0.4 + rand() * 2.2, 0, Math.PI * 2);
          ctx.fill();
        }
        for (let i = 0; i < 9; i++) { // インクの薄いところ
          ctx.globalAlpha = 0.12 + rand() * 0.18;
          ctx.beginPath();
          ctx.ellipse(rand() * w, rand() * h, 30 + rand() * 70, 12 + rand() * 30, rand() * Math.PI, 0, Math.PI * 2);
          ctx.fill();
        }
        ctx.restore();
      }

      // 丸いはんこ：OpenPNE 認定AI
      function roundStamp() {
        const S = 400, c = document.createElement('canvas');
        c.width = c.height = S;
        const ctx = c.getContext('2d');
        const cx = S / 2, cy = S / 2;
        ctx.strokeStyle = RED; ctx.fillStyle = RED;
        ctx.lineWidth = 9; ctx.beginPath(); ctx.arc(cx, cy, 178, 0, Math.PI * 2); ctx.stroke();
        ctx.lineWidth = 3; ctx.beginPath(); ctx.arc(cx, cy, 160, 0, Math.PI * 2); ctx.stroke();
        ctx.lineWidth = 3; ctx.beginPath(); ctx.arc(cx, cy, 108, 0, Math.PI * 2); ctx.stroke();
        // 輪に沿った文字
        const ring = (text, startDeg, spanDeg, inner) => {
          ctx.font = `700 24px ${SERIF}`;
          ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
          const chars = Array.from(text);
          chars.forEach((ch, i) => {
            const a = (startDeg + (spanDeg * (i + 0.5)) / chars.length) * Math.PI / 180;
            ctx.save();
            ctx.translate(cx + Math.cos(a) * 134, cy + Math.sin(a) * 134);
            ctx.rotate(inner ? a - Math.PI / 2 : a + Math.PI / 2);
            ctx.fillText(ch, 0, 0);
            ctx.restore();
          });
        };
        ring('OPENPNE CERTIFIED', -170, 160, false);
        ring('OFFICIAL · AI', 145, -110, true);
        ctx.font = `700 26px ${SERIF}`;
        ctx.fillText('★', cx - 134, cy + 12); ctx.fillText('★', cx + 134, cy + 12);
        // 中央
        ctx.textAlign = 'center'; ctx.textBaseline = 'alphabetic';
        ctx.font = `700 22px ${SERIF}`; ctx.fillText('OpenPNE', cx, cy - 42);
        ctx.font = `900 54px ${SERIF}`; ctx.fillText('認定AI', cx, cy + 20);
        ctx.lineWidth = 2; ctx.beginPath(); ctx.moveTo(cx - 80, cy + 38); ctx.lineTo(cx + 80, cy + 38); ctx.stroke();
        ctx.font = `700 20px ${SERIF}`; ctx.fillText('2026.10.27', cx, cy + 66);
        grunge(ctx, S, S);
        return c;
      }

      // 四角いはんこ：公式SNS稼働 10,000時間
      function rectStamp() {
        const W = 470, H = 250, c = document.createElement('canvas');
        c.width = W; c.height = H;
        const ctx = c.getContext('2d');
        const rr = (x, y, w, h, r) => {
          ctx.beginPath();
          ctx.moveTo(x + r, y); ctx.arcTo(x + w, y, x + w, y + h, r); ctx.arcTo(x + w, y + h, x, y + h, r);
          ctx.arcTo(x, y + h, x, y, r); ctx.arcTo(x, y, x + w, y, r); ctx.closePath();
        };
        ctx.strokeStyle = RED; ctx.fillStyle = RED;
        ctx.lineWidth = 9; rr(8, 8, W - 16, H - 16, 26); ctx.stroke();
        ctx.lineWidth = 3; rr(24, 24, W - 48, H - 48, 14); ctx.stroke();
        ctx.textAlign = 'center'; ctx.textBaseline = 'alphabetic';
        ctx.font = `900 34px ${SERIF}`; ctx.fillText('公式SNS稼働', W / 2, 78);
        ctx.font = `900 76px ${SERIF}`;
        const num = '10,000', unit = '時間';
        const nw = ctx.measureText(num).width;
        ctx.font = `900 44px ${SERIF}`;
        const uw = ctx.measureText(unit).width;
        const x0 = W / 2 - (nw + 8 + uw) / 2;
        ctx.textAlign = 'left';
        ctx.font = `900 76px ${SERIF}`; ctx.fillText(num, x0, 160);
        ctx.font = `900 44px ${SERIF}`; ctx.fillText(unit, x0 + nw + 8, 160);
        ctx.textAlign = 'center';
        ctx.lineWidth = 2; ctx.beginPath(); ctx.moveTo(52, 180); ctx.lineTo(W - 52, 180); ctx.stroke();
        ctx.font = `700 17px ${SERIF}`; ctx.fillText('OFFICIAL SNS ACTIVE · 10,000 HOURS', W / 2, 206);
        grunge(ctx, W, H);
        return c;
      }

      const sheet = document.createElement('canvas');
      sheet.width = img.naturalWidth; sheet.height = img.naturalHeight;
      const ctx = sheet.getContext('2d');
      ctx.drawImage(img, 0, 0);
      const put = (stamp, cx, cy, deg, alpha) => {
        ctx.save();
        ctx.globalAlpha = alpha;
        ctx.globalCompositeOperation = 'multiply';
        ctx.translate(cx, cy); ctx.rotate(deg * Math.PI / 180);
        ctx.drawImage(stamp, -stamp.width / 2, -stamp.height / 2);
        ctx.restore();
      };
      // 余白（表の下からフッターの上まで）に押す
      put(roundStamp(), 360, 1440, -14, 0.88);
      put(rectStamp(), 850, 1470, 9, 0.85);

      const png = new Uint8Array(await (await new Promise((r) => sheet.toBlob(r, 'image/png'))).arrayBuffer());
      const out = Record.embed(png, record);
      return btoa(Array.from(out, (x) => String.fromCharCode(x)).join(''));
    }, input.toString('base64'));
    const name = file.replace(/\.png$/, '_認定イメージ.png');
    fs.writeFileSync(path.join(OUT, name), Buffer.from(b64, 'base64'));
    console.log(`samples/stamped/${name}`);
  }
  await browser.close();
})();
