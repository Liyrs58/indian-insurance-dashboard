import assert from 'node:assert/strict';
import { createReadStream } from 'node:fs';
import { readFile, stat } from 'node:fs/promises';
import { createServer } from 'node:http';
import { extname, join, normalize, resolve, sep } from 'node:path';
import { fileURLToPath } from 'node:url';

import { chromium } from 'playwright';

const root = resolve(fileURLToPath(new URL('../', import.meta.url)));

const mimeTypes = {
  '.css': 'text/css',
  '.html': 'text/html',
  '.js': 'text/javascript',
  '.json': 'application/json',
  '.md': 'text/markdown',
  '.pdf': 'application/pdf',
  '.png': 'image/png',
  '.svg': 'image/svg+xml',
};

function safePath(urlPath) {
  const decoded = decodeURIComponent(urlPath.split('?')[0]);
  const requested = normalize(decoded === '/' ? '/index.html' : decoded);
  const absolute = resolve(join(root, requested));
  if (absolute !== root && !absolute.startsWith(root + sep)) {
    return null;
  }
  return absolute;
}

async function startStaticServer() {
  const server = createServer(async (req, res) => {
    try {
      const absolute = safePath(req.url || '/');
      if (!absolute) {
        res.writeHead(403);
        res.end('Forbidden');
        return;
      }
      const info = await stat(absolute);
      if (!info.isFile()) {
        res.writeHead(404);
        res.end('Not found');
        return;
      }
      res.writeHead(200, {
        'Content-Length': info.size,
        'Content-Type': mimeTypes[extname(absolute)] || 'application/octet-stream',
      });
      createReadStream(absolute).pipe(res);
    } catch {
      res.writeHead(404);
      res.end('Not found');
    }
  });

  await new Promise((resolveListen) => server.listen(0, '127.0.0.1', resolveListen));
  const address = server.address();
  return {
    baseUrl: `http://127.0.0.1:${address.port}`,
    close: () => new Promise((resolveClose) => server.close(resolveClose)),
  };
}

async function assertNoBrowserErrors(pageErrors, consoleErrors) {
  assert.deepEqual(pageErrors, [], 'page errors should be empty');
  assert.deepEqual(consoleErrors, [], 'browser console errors should be empty');
}

async function closePopup(page) {
  await page.locator('.popup-close').click();
  await page.waitForFunction(() => !document.querySelector('#popup')?.classList.contains('show'), null, { timeout: 5000 });
}

const server = await startStaticServer();
const browser = await chromium.launch({ headless: true });

try {
  const page = await browser.newPage({ acceptDownloads: true, viewport: { width: 1440, height: 920 } });
  const pageErrors = [];
  const consoleErrors = [];
  page.on('pageerror', (error) => pageErrors.push(error.message));
  page.on('console', (message) => {
    if (message.type() === 'error') consoleErrors.push(message.text());
  });
  await page.addInitScript(() => {
    localStorage.setItem('irdai_watchlist', JSON.stringify(['Life Insurance Corporation of India']));
  });

  await page.goto(server.baseUrl, { waitUntil: 'domcontentloaded' });
  await page.waitForSelector('.tabulator-row', { timeout: 20000 });
  await page.waitForFunction(() => document.querySelector('#dataStatus')?.textContent.includes('SNAPSHOT'), null, { timeout: 20000 });

  const desktop = await page.evaluate(() => ({
    status: document.querySelector('#dataStatus')?.textContent || '',
    tableTitle: document.querySelector('#tableTitle')?.textContent || '',
    tableMonth: document.querySelector('#tableMonth')?.textContent || '',
    rowCount: document.querySelectorAll('.tabulator-row').length,
    firstRow: document.querySelector('.tabulator-row')?.innerText || '',
    tableBackground: getComputedStyle(document.querySelector('.tabulator-table')).backgroundColor,
    scrollWidth: document.documentElement.scrollWidth,
    innerWidth: window.innerWidth,
  }));

  assert.match(desktop.status, /SNAPSHOT: 2026-07-07/);
  assert.doesNotMatch(desktop.status, /WARNING|ERROR/);
  assert.equal(desktop.tableTitle, 'ALL INSURERS');
  assert.equal(desktop.tableMonth, '2026-05 shared');
  assert.ok(desktop.rowCount >= 50, `expected at least 50 rows, got ${desktop.rowCount}`);
  assert.match(desktop.firstRow, /Life Insurance Corporation|LIC|New India/);
  assert.equal(desktop.tableBackground, 'rgba(0, 0, 0, 0)');
  assert.ok(desktop.scrollWidth <= desktop.innerWidth + 2, `desktop horizontal overflow: ${desktop.scrollWidth} > ${desktop.innerWidth}`);

  const insightsText = await page.locator('#insights-tab').innerText();
  assert.match(insightsText, /WATCHLIST MONITOR/);
  assert.match(insightsText, /Life Insurance Corporation|LIC/);
  await page.locator('.watch-toggle').first().click();
  await page.waitForFunction(() => {
    const saved = JSON.parse(localStorage.getItem('irdai_watchlist') || '[]');
    return !saved.includes('Life Insurance Corporation of India');
  }, null, { timeout: 5000 });
  assert.equal(await page.locator('#popup.show').count(), 0, 'watch toggle must not open row detail popup');

  await page.locator('.tabulator-row').first().click();
  await page.waitForSelector('#popup.show', { timeout: 5000 });
  const popupText = await page.locator('#popup').innerText();
  assert.match(popupText, /Premium/);
  assert.doesNotMatch(popupText, /Premium\s+--/);
  await closePopup(page);

  await page.locator('[data-view="nonlife"]').click();
  await page.waitForFunction(() => document.querySelector('#tableTitle')?.textContent === 'NON-LIFE INSURANCE');
  const nonLifeInsights = await page.locator('#insights-tab').innerText();
  assert.match(nonLifeInsights, /TOTAL NON-LIFE PREMIUM/);
  assert.doesNotMatch(nonLifeInsights, /NON_LIFE/);

  await page.locator('#chatInput').fill('save view nonlife desk');
  await page.keyboard.press('Enter');
  await page.waitForFunction(() => {
    const saved = JSON.parse(localStorage.getItem('irdai_saved_views') || '{}');
    return saved['nonlife desk']?.view === 'nonlife';
  }, null, { timeout: 5000 });
  await page.locator('#chatInput').fill('overview');
  await page.keyboard.press('Enter');
  await page.waitForFunction(() => document.querySelector('#tableTitle')?.textContent === 'ALL INSURERS');
  await page.locator('#chatInput').fill('load view nonlife desk');
  await page.keyboard.press('Enter');
  await page.waitForFunction(() => document.querySelector('#tableTitle')?.textContent === 'NON-LIFE INSURANCE');
  await page.locator('#chatInput').fill('views');
  await page.keyboard.press('Enter');
  await page.waitForFunction(() => document.querySelector('#chatMessages')?.innerText.includes('nonlife desk'), null, { timeout: 5000 });

  await page.locator('#chatInput').fill('set alert growth 12');
  await page.keyboard.press('Enter');
  await page.waitForFunction(() => {
    const config = JSON.parse(localStorage.getItem('irdai_alert_config') || '{}');
    return config.growthSurgePct === 12;
  }, null, { timeout: 5000 });
  await page.locator('#chatInput').fill('alert config');
  await page.keyboard.press('Enter');
  await page.waitForFunction(() => document.querySelector('#chatMessages')?.innerText.includes('Growth surge: 12%'), null, { timeout: 5000 });

  await page.locator('#chatInput').fill('TOPLIFE');
  await page.keyboard.press('Enter');
  await page.waitForFunction(() => document.querySelector('#chatMessages')?.innerText.includes('Top Life Insurers'), null, { timeout: 5000 });
  await page.waitForFunction(() => {
    const history = JSON.parse(localStorage.getItem('irdai_command_history') || '[]');
    return history[0] === 'TOPLIFE';
  }, null, { timeout: 5000 });
  await page.locator('#chatInput').fill('');
  await page.keyboard.press('ArrowUp');
  await page.waitForFunction(() => document.querySelector('#chatInput')?.value === 'TOPLIFE', null, { timeout: 5000 });
  await page.keyboard.press(process.platform === 'darwin' ? 'Meta+K' : 'Control+K');
  await page.waitForFunction(() => document.querySelector('#chatMessages')?.innerText.includes('COMMANDS'), null, { timeout: 5000 });

  await page.locator('#chatInput').fill('sources');
  await page.keyboard.press('Enter');
  await page.waitForSelector('#popup.show', { timeout: 5000 });
  const auditText = await page.locator('#popup').innerText();
  assert.match(auditText, /DATA QUALITY AUDIT/);
  assert.match(auditText, /PRIMARY SOURCES/);
  assert.match(auditText, /SOURCE HYGIENE/);
  assert.match(auditText, /Records retained/);
  assert.match(auditText, /Dropped duplicates/);
  assert.match(auditText, /Filename\/header mismatches/);
  assert.match(auditText, /Life_FirstYear_Jan2026\.xlsx/);
  assert.match(auditText, /kept Life_FirstYear_Feb2026\.xlsx/i);
  assert.match(auditText, /General Insurance Council/);
  await closePopup(page);

  await page.locator('#chatInput').fill('watch lic');
  await page.keyboard.press('Enter');
  await page.waitForFunction(() => {
    const saved = JSON.parse(localStorage.getItem('irdai_watchlist') || '[]');
    return saved.includes('Life Insurance Corporation of India');
  }, null, { timeout: 5000 });
  const downloadPromise = page.waitForEvent('download');
  await page.locator('#chatInput').fill('export audit');
  await page.keyboard.press('Enter');
  const download = await downloadPromise;
  assert.match(download.suggestedFilename(), /^irdai-audit-pack-\d{4}-\d{2}-\d{2}\.md$/);
  const auditPackPath = await download.path();
  const auditPackText = await readFile(auditPackPath, 'utf8');
  assert.match(auditPackText, /IRDAI Insurance Terminal Audit Pack/);
  assert.match(auditPackText, /Validation Status: OK/);
  assert.match(auditPackText, /Source Hygiene/);
  assert.match(auditPackText, /Watchlist Monitor/);
  assert.match(auditPackText, /Growth surge: 12%/);
  assert.match(auditPackText, /Life Insurance Corporation of India|LIC/);

  await page.setViewportSize({ width: 390, height: 844 });
  await page.reload({ waitUntil: 'domcontentloaded' });
  await page.waitForSelector('.tabulator-row', { timeout: 20000 });
  const mobileLayout = await page.evaluate(() => {
    const ticker = document.querySelector('.ticker-tape');
    const tablePanel = document.querySelector('.panel-left');
    const chatInput = document.querySelector('#chatInput');
    const chatBar = document.querySelector('.chat-bar');
    const kpiStrip = document.querySelector('.kpi-strip');
    return {
      tickerDisplay: getComputedStyle(ticker).display,
      tablePanelTop: tablePanel.getBoundingClientRect().top,
      tablePanelHeight: tablePanel.getBoundingClientRect().height,
      kpiHeight: kpiStrip.getBoundingClientRect().height,
      chatInputHeight: chatInput.getBoundingClientRect().height,
      chatBarHeight: chatBar.getBoundingClientRect().height,
      chatBarBottom: chatBar.getBoundingClientRect().bottom,
      kpiBottom: kpiStrip.getBoundingClientRect().bottom,
      viewportHeight: window.innerHeight,
    };
  });
  assert.equal(mobileLayout.tickerDisplay, 'none', 'mobile should suppress ticker tape to reduce first-screen noise');
  assert.ok(mobileLayout.kpiHeight >= 48, `mobile KPI strip collapsed: ${mobileLayout.kpiHeight}`);
  assert.ok(mobileLayout.tablePanelTop >= mobileLayout.kpiBottom, `mobile table overlaps KPI strip: table ${mobileLayout.tablePanelTop}, kpi ${mobileLayout.kpiBottom}`);
  assert.ok(mobileLayout.tablePanelHeight <= 310, `mobile table panel too tall: ${mobileLayout.tablePanelHeight}`);
  assert.ok(mobileLayout.chatInputHeight >= 34, `mobile command input too small: ${mobileLayout.chatInputHeight}`);
  assert.ok(mobileLayout.chatBarHeight >= 120, `mobile command bar collapsed: ${mobileLayout.chatBarHeight}`);
  assert.ok(mobileLayout.chatBarBottom <= mobileLayout.viewportHeight + 2, `mobile command bar offscreen: ${mobileLayout.chatBarBottom}`);
  assert.ok(mobileLayout.kpiBottom < mobileLayout.viewportHeight * 0.18, `mobile KPIs consume too much first-screen height: ${mobileLayout.kpiBottom}`);
  await page.locator('.topbar-status').click();
  await page.waitForSelector('#popup.show', { timeout: 5000 });
  const mobile = await page.evaluate(() => {
    const popupBox = document.querySelector('.popup-content').getBoundingClientRect();
    return {
      popupWidth: popupBox.width,
      scrollWidth: document.documentElement.scrollWidth,
      innerWidth: window.innerWidth,
    };
  });
  mobile.layout = mobileLayout;
  assert.ok(mobile.popupWidth <= mobile.innerWidth, `mobile popup overflow: ${mobile.popupWidth} > ${mobile.innerWidth}`);
  assert.ok(mobile.scrollWidth <= mobile.innerWidth + 2, `mobile horizontal overflow: ${mobile.scrollWidth} > ${mobile.innerWidth}`);

  await assertNoBrowserErrors(pageErrors, consoleErrors);
  console.log(JSON.stringify({ desktop, mobile }, null, 2));
} finally {
  await browser.close();
  await server.close();
}
