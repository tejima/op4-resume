// サンプル（翻訳係・Tips係）のアイコンを作り、sample-icons.js に書き出す
//   node tools/make-sample-icons.js
// index.html の Avatar（ロボット）に、係ごとの小物を描き足す。
const { chromium } = require('playwright');
const fs = require('fs');
const path = require('path');

const ROOT = path.resolve(__dirname, '..');

(async () => {
  const proxy = process.env.HTTPS_PROXY ? { server: process.env.HTTPS_PROXY } : undefined;
  const browser = await chromium.launch({ proxy });
  const page = await (await browser.newContext({ ignoreHTTPSErrors: !!proxy })).newPage();
  await page.goto('file://' + path.join(ROOT, 'index.html'));
  await page.waitForFunction(() => window.KakariResume);

  const icons = await page.evaluate(async () => {
    const { Avatar } = window.KakariResume;
    await document.fonts.load('700 72px "Noto Sans JP"', 'あA');

    function bubble(ctx, x, y, w, h, tailX, fill, text, color) {
      ctx.fillStyle = fill;
      Avatar.roundRect(ctx, x, y, w, h, 28); ctx.fill();
      ctx.beginPath();
      ctx.moveTo(tailX - 16, y + h - 2); ctx.lineTo(tailX + 16, y + h - 2); ctx.lineTo(tailX + (tailX < 256 ? 26 : -26), y + h + 34);
      ctx.closePath(); ctx.fill();
      ctx.fillStyle = color;
      ctx.font = '700 72px "Noto Sans JP"';
      ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
      ctx.fillText(text, x + w / 2, y + h / 2 + 4);
    }

    const extras = {
      // 翻訳係：「あ」と「A」の吹き出し
      translation(ctx, t) {
        bubble(ctx, 22, 26, 134, 112, 120, t.accent, 'あ', '#ffffff');
        bubble(ctx, 356, 26, 134, 112, 392, '#ffffff', 'A', t.accent);
      },
      // Tips係：光る電球
      tips(ctx, t) {
        const cx = 412, cy = 88;
        ctx.strokeStyle = t.accent; ctx.lineWidth = 9; ctx.lineCap = 'round';
        for (let i = 0; i < 7; i++) {
          const a = Math.PI * (0.95 + i * 0.185);
          ctx.beginPath();
          ctx.moveTo(cx + Math.cos(a) * 62, cy + Math.sin(a) * 62);
          ctx.lineTo(cx + Math.cos(a) * 82, cy + Math.sin(a) * 82);
          ctx.stroke();
        }
        ctx.fillStyle = '#fff3b0'; ctx.strokeStyle = t.ink; ctx.lineWidth = 7;
        ctx.beginPath(); ctx.arc(cx, cy, 44, 0.8 * Math.PI, 2.2 * Math.PI); ctx.lineTo(cx + 20, cy + 62); ctx.lineTo(cx - 20, cy + 62); ctx.closePath();
        ctx.fill(); ctx.stroke();
        ctx.fillStyle = t.ink;
        Avatar.roundRect(ctx, cx - 22, cy + 66, 44, 12, 5); ctx.fill();
        Avatar.roundRect(ctx, cx - 18, cy + 82, 36, 12, 5); ctx.fill();
        // 小さなきらめき
        ctx.fillStyle = t.accent;
        const star = (x, y, r) => {
          ctx.beginPath();
          for (let i = 0; i < 8; i++) {
            const a = (Math.PI / 4) * i, rr = i % 2 ? r * 0.35 : r;
            ctx.lineTo(x + Math.cos(a - Math.PI / 2) * rr, y + Math.sin(a - Math.PI / 2) * rr);
          }
          ctx.closePath(); ctx.fill();
        };
        star(84, 96, 34); star(140, 52, 18);
      },
    };

    const out = {};
    for (const id of Object.keys(extras)) {
      const c = document.createElement('canvas');
      c.width = c.height = Avatar.SIZE;
      const ctx = c.getContext('2d');
      const theme = Avatar.THEMES[id];
      Avatar.draw(ctx, theme);
      extras[id](ctx, theme);
      out[id] = c.toDataURL('image/png');
    }
    return out;
  });

  const lines = Object.entries(icons).map(([id, url]) => `  ${id}: '${url}',`);
  fs.writeFileSync(path.join(ROOT, 'sample-icons.js'),
    '// サンプルのアイコン（512×512 PNG）。tools/make-sample-icons.js で生成。手で編集しない。\n' +
    'window.KAKARI_SAMPLE_ICONS = {\n' + lines.join('\n') + '\n};\n');
  for (const [id, url] of Object.entries(icons)) {
    console.log(`${id}: ${Math.round(url.length / 1024)}KB (data URL)`);
  }
  await browser.close();
})();
