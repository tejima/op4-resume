// 係のスキルシートメーカーの往復テスト（ヘッドレス Chromium で index.html を開いて検査する）
//   node tests/roundtrip.js
// サンプル2件の書き出しPNGを samples/ に保存し、完了条件の各項目を確認する。
const { chromium } = require('playwright');
const fs = require('fs');
const path = require('path');

const ROOT = path.resolve(__dirname, '..');
const OUT = path.join(ROOT, 'samples');

(async () => {
  const proxy = process.env.HTTPS_PROXY ? { server: process.env.HTTPS_PROXY } : undefined;
  const browser = await chromium.launch({ proxy });
  const context = await browser.newContext({ ignoreHTTPSErrors: !!proxy, viewport: { width: 1400, height: 1000 } });
  const page = await context.newPage();
  const errors = [];
  page.on('pageerror', (e) => errors.push(e.message));
  page.on('dialog', (d) => d.accept());
  await page.goto('file://' + path.join(ROOT, 'index.html'));
  await page.waitForFunction(() => window.KakariResume);

  const results = [];
  const check = (name, ok, detail = '') => {
    results.push({ name, ok });
    console.log(`${ok ? 'OK  ' : 'FAIL'} ${name}${detail ? ' — ' + detail : ''}`);
  };

  fs.mkdirSync(OUT, { recursive: true });
  const samples = await page.evaluate(() => window.KAKARI_SAMPLES.map((s) => s.id));
  for (const id of samples) {
    const r = await page.evaluate(async (id) => {
      const { Handbook, HandbookText, Exporter, App, Record } = window.KakariResume;
      const s = window.KAKARI_SAMPLES.find((x) => x.id === id);
      const { bytes, record } = await Exporter.makePng(s.data);
      const analysis = await App.analyzePng(bytes);
      const norm = Handbook.normalize(s.data);
      const back = analysis.record ? Handbook.normalize(analysis.record) : null;
      // テキスト往復
      const text = HandbookText.serialize(norm);
      const parsed = HandbookText.parse(text).data;
      // 1バイト書き換え：全バイト位置のうち一定間隔で試す
      let flipFail = 0, flipTried = 0;
      for (let i = 0; i < bytes.length; i += Math.max(1, Math.floor(bytes.length / 400))) {
        const b = bytes.slice(); b[i] ^= 0x01; flipTried++;
        const a = await App.analyzePng(b);
        if (a.status === 'ok' && a.match) flipFail++;
      }
      // 裏データJSONの一文字を書き換え、CRCも正しく付け直したもの
      const rec2 = JSON.parse(JSON.stringify(record));
      rec2.kakari.donts[0] = rec2.kakari.donts[0].replace(/^./, 'X');
      const { PngChunks } = window.KakariResume;
      const tampered = Record.embed(bytes, rec2);
      const ta = await App.analyzePng(tampered);
      return {
        b64: btoa(Array.from(bytes, (x) => String.fromCharCode(x)).join('')),
        size: bytes.length,
        name: Exporter.fileName(record.kakari),
        status: analysis.status, match: analysis.match, checks: analysis.checks,
        same: JSON.stringify(back) === JSON.stringify(norm),
        textSame: analysis.record?.handbookText === text,
        textRoundTrip: JSON.stringify(parsed) === JSON.stringify({ ...norm, icon: null }),
        flipFail, flipTried,
        tamperedStatus: ta.status, tamperedMatch: ta.match,
        structureOk: analysis.checks?.structure,
      };
    }, id);
    const file = path.join(OUT, r.name);
    fs.writeFileSync(file, Buffer.from(r.b64, 'base64'));
    console.log(`\n# ${id} → samples/${r.name} (${Math.round(r.size / 1024)}KB)`);
    check('書き出し→読み込みで裏データあり・照合一致', r.status === 'ok' && r.match === true, JSON.stringify(r.checks));
    check('入力内容が完全に復元される', r.same);
    check('全文（handbookText）が一致', r.textSame);
    check('テキスト形式の往復', r.textRoundTrip);
    check(`1バイト書き換えで一致にならない（${r.flipTried}箇所）`, r.flipFail === 0, `一致になった箇所：${r.flipFail}`);
    check('JSON改変（CRC付け直し）で不一致', r.tamperedStatus === 'ok' && r.tamperedMatch === false);
    check('ファイルサイズ 1MB 以下', r.size <= 1024 * 1024, `${r.size} bytes`);
  }

  console.log('\n# その他');
  const misc = await page.evaluate(async () => {
    const { App, Icon, Exporter, Resume } = window.KakariResume;
    // 裏データのない普通のPNG
    const c = document.createElement('canvas'); c.width = c.height = 32;
    const plain = new Uint8Array(await (await new Promise((r) => c.toBlob(r, 'image/png'))).arrayBuffer());
    const plainRes = await App.analyzePng(plain);
    // SVG を拒否
    const svg = new File(['<svg xmlns="http://www.w3.org/2000/svg" width="10" height="10"></svg>'], 'icon.svg', { type: 'image/svg+xml' });
    const svgAsPng = new File(['<svg xmlns="http://www.w3.org/2000/svg"></svg>'], 'icon.png', { type: 'image/png' });
    const rejected = [];
    for (const f of [svg, svgAsPng]) { try { await Icon.fromFile(f); rejected.push(false); } catch (e) { rejected.push(true); } }
    // アイコンつきの書き出し（写真風のノイズ画像で最悪ケースに近いサイズを確認）
    const ic = document.createElement('canvas'); ic.width = 900; ic.height = 700;
    const ctx = ic.getContext('2d');
    const id = ctx.createImageData(900, 700);
    for (let i = 0; i < id.data.length; i += 4) { id.data[i] = Math.random() * 255; id.data[i + 1] = (i / 4) % 255; id.data[i + 2] = Math.random() * 255; id.data[i + 3] = 255; }
    ctx.putImageData(id, 0, 0);
    const icFile = new File([await new Promise((r) => ic.toBlob(r, 'image/png'))], 'noise.png', { type: 'image/png' });
    const icon = await Icon.fromFile(icFile);
    const iconImg = await Icon.loadImage(icon);
    const data = { ...window.KAKARI_SAMPLES[0].data, icon };
    const { bytes } = await Exporter.makePng(data);
    const a = await App.analyzePng(bytes);
    const fontLoaded = Array.from(document.fonts).filter((f) => f.family.replace(/"/g, '') === 'Noto Sans JP' && f.status === 'loaded').length;
    return {
      plainStatus: plainRes.status, rejected, iconSize: [iconImg.naturalWidth, iconImg.naturalHeight],
      withIconSize: bytes.length, withIconMatch: a.match, iconBack: a.record?.icon === icon, fontLoaded,
    };
  });
  check('裏データのないPNGは「裏データなし」', misc.plainStatus === 'missing');
  check('SVGアイコンを拒否（拡張子 .svg / 中身SVGの .png とも）', misc.rejected.every(Boolean));
  check('アイコンは512×512', misc.iconSize.join('x') === '512x512');
  check('アイコンつきでも往復一致・アイコン復元', misc.withIconMatch && misc.iconBack);
  check('アイコン（写真相当のノイズ画像）つきでも 1MB 以下', misc.withIconSize <= 1024 * 1024, `${misc.withIconSize} bytes`);
  check('Noto Sans JP のフォントが読み込まれている', misc.fontLoaded > 0, `${misc.fontLoaded} faces`);
  check('ページでエラーが出ていない', errors.length === 0, errors.join(' / '));

  // すべての欄を上限まで埋めても1枚に収まり、上限を超えると書き出しボタンが無効になる
  const fill = (extra) => page.evaluate((extra) => {
    const { App, Handbook } = window.KakariResume;
    const long = (n) => 'あ'.repeat(n);
    const k = Handbook.emptyKakari();
    k.name = 'あ'.repeat(20); k.version = 'v'.repeat(10);
    for (const f of Handbook.FIELDS.slice(2)) k[f.key] = Array(f.maxItems).fill(long(f.max + extra));
    const credits = { author: long(30), illustrator: long(30), textLicense: 'CC BY 4.0', imageLicense: 'CC BY 4.0' };
    App.setData({ kakari: k, credits, icon: null });
  }, extra);
  const ui = () => page.evaluate(() => ({
    disabled: document.getElementById('btn-export').disabled,
    status: document.getElementById('make-status').textContent,
  }));
  await fill(0);
  await page.waitForTimeout(500);
  const maxUi = await ui();
  check('すべての欄を上限まで埋めても1枚に収まる', !maxUi.disabled && /収まっています/.test(maxUi.status), maxUi.status);
  await page.evaluate(() => { document.querySelector('.preview-pane').scrollIntoView(); });
  await page.locator('#preview').screenshot({ path: path.join(ROOT, 'tests', 'screen-max.png') });
  await fill(5);
  await page.waitForTimeout(500);
  const overUi = await ui();
  check('上限を超えると警告が出て書き出し無効', overUi.disabled && /注意があります/.test(overUi.status), overUi.status);

  // 読むモード（画面操作）
  await page.click('#tab-read');
  const sampleFile = path.join(OUT, fs.readdirSync(OUT).find((f) => f.includes('翻訳係')));
  // 日本語のパスを直接渡すと Playwright がファイルを渡せないため、中身で渡す
  await page.setInputFiles('#input-png', { name: path.basename(sampleFile), mimeType: 'image/png', buffer: fs.readFileSync(sampleFile) });
  await page.waitForSelector('#read-data:not([hidden])');
  const readUi = await page.evaluate(() => ({
    checks: document.getElementById('read-checks').textContent,
    text: document.getElementById('read-text').textContent,
    caution: document.querySelector('.caution').textContent,
  }));
  check('読むモード：一致・未認定・全文が表示される',
    /一致：表と裏は同じ元データ/.test(readUi.checks) && /未認定/.test(readUi.checks) && readUi.text.startsWith('【AI Handbook：翻訳係】v1.0'));
  check('読むモード：注意書きが表示される', /採用する前に、必ず運営者が全文を読んで確認してください/.test(readUi.caution));
  await page.screenshot({ path: path.join(ROOT, 'tests', 'screen-read.png') });
  const plainFile = path.join(ROOT, 'tests', 'screen-make-tmp.png');
  await page.screenshot({ path: plainFile, clip: { x: 0, y: 0, width: 50, height: 50 } });
  await page.setInputFiles('#input-png', plainFile);
  await page.waitForSelector('#read-missing:not([hidden])');
  const missingText = await page.textContent('#read-missing');
  fs.unlinkSync(plainFile);
  check('読むモード：普通のPNGで「裏データがありません」', /この画像には裏データがありません。SNSへのアップロード時に消えた可能性があります。/.test(missingText));
  await page.click('#tab-make');

  // 画面のスクリーンショット（目視確認用）
  await page.selectOption('#sample-select', 'translation');
  await page.waitForTimeout(800);
  await page.evaluate(() => window.scrollTo(0, 0));
  await page.screenshot({ path: path.join(ROOT, 'tests', 'screen-make.png') });
  await page.setViewportSize({ width: 375, height: 800 });
  await page.waitForTimeout(300);
  await page.screenshot({ path: path.join(ROOT, 'tests', 'screen-mobile.png'), fullPage: false });
  const hscroll = await page.evaluate(() => document.documentElement.scrollWidth > window.innerWidth);
  check('スマホ幅で横スクロールが出ない', !hscroll);

  await browser.close();
  const failed = results.filter((r) => !r.ok).length;
  console.log(`\n${results.length - failed}/${results.length} 件 OK`);
  process.exit(failed ? 1 : 0);
})();
