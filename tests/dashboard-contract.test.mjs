import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import test from 'node:test';

const root = new URL('../', import.meta.url);

async function readText(path) {
  return readFile(new URL(path, root), 'utf8');
}

async function readJson(path) {
  return JSON.parse(await readText(path));
}

async function fileExists(path) {
  try {
    await readFile(new URL(path, root));
    return true;
  } catch (error) {
    if (error && error.code === 'ENOENT') return false;
    throw error;
  }
}

function latest(segmentData) {
  return segmentData.monthly_data.at(-1);
}

test('processed data carries source, freshness, and validation metadata', async () => {
  const data = await readJson('data/irdai-processed.json');
  const sourceHygiene = data._meta.source_hygiene;
  assert.equal(data._meta.research_as_of, '2026-07-07');
  assert.match(data._meta.generated_at, /^\d{4}-\d{2}-\d{2}/);
  assert.equal(data._meta.validation?.status, 'ok');
  assert.ok(Array.isArray(data._meta.validation?.issues));
  assert.equal(data._meta.validation.issues.some((issue) => issue.code === 'duplicate_total'), false);
  assert.equal(data._meta.validation.issues.some((issue) => issue.severity === 'warning'), false);
  assert.equal(data._meta.validation.issues.filter((issue) => issue.code === 'fiscal_year_reset').length, 2);
  assert.equal(data._meta.validation.issues.filter((issue) => issue.code === 'signed_source_adjustment').length, 2);
  assert.equal(sourceHygiene.raw_files_processed, 10);
  assert.equal(sourceHygiene.records_loaded, 10);
  assert.equal(sourceHygiene.records_retained, 9);
  assert.equal(sourceHygiene.records_dropped, 1);
  assert.equal(sourceHygiene.filename_header_mismatches.length, 1);
  assert.deepEqual(sourceHygiene.filename_header_mismatches[0], {
    source_file: 'Life_FirstYear_Jan2026.xlsx',
    filename_month: '2026-01',
    header_month: '2026-02',
    selected_month: '2026-02',
  });
  assert.equal(sourceHygiene.duplicate_resolutions.length, 1);
  assert.deepEqual(sourceHygiene.duplicate_resolutions[0], {
    segment: 'life',
    month: '2026-02',
    kept_source_file: 'Life_FirstYear_Feb2026.xlsx',
    dropped_source_file: 'Life_FirstYear_Jan2026.xlsx',
    reason: 'higher month-source confidence',
  });

  for (const segment of ['life', 'non_life']) {
    const months = data[segment].monthly_data.map((month) => month.month);
    assert.equal(new Set(months).size, months.length, `${segment} has duplicate month records`);
    for (const month of data[segment].monthly_data) {
      assert.ok(month.source_file, `${segment} ${month.month} missing source_file`);
      assert.ok(month.generated_at, `${segment} ${month.month} missing generated_at`);
      assert.match(month.period_type, /^(monthly|cumulative_ytd|unknown)$/);
    }
  }
});

test('insurer arrays are sorted by premium so raw order cannot leak into rankings', async () => {
  const data = await readJson('data/irdai-processed.json');

  for (const segment of ['life', 'non_life']) {
    for (const month of data[segment].monthly_data) {
      const premiums = month.insurers.map((insurer) => insurer.premium_cr);
      const sorted = premiums.slice().sort((a, b) => b - a);
      assert.deepEqual(premiums, sorted, `${segment} ${month.month} is not sorted by premium`);
    }
  }

  assert.match(latest(data.life).insurers[0].name, /Life Insurance Corporation|LIC/);
  assert.match(latest(data.non_life).insurers[0].name, /New India/);
});

test('dashboard source avoids raw-order top-player logic and refreshes month options per view', async () => {
  const source = await readText('js/dashboard.js');
  const html = await readText('index.html');
  const readme = await readText('README.md');

  const fieldMapIndex = source.indexOf('var FIELD_MAP');
  const cachedDataIndex = source.indexOf('if (cachedData)');
  assert.ok(fieldMapIndex > -1 && cachedDataIndex > -1);
  assert.ok(fieldMapIndex < cachedDataIndex, 'FIELD_MAP must be defined before cached init can call buildTable');

  const renderViewBody = source.match(/function renderView\(view\) \{[\s\S]*?\n\}/)?.[0] || '';
  assert.match(renderViewBody, /renderMonthSelector\(\)/, 'renderView must refresh month options when switching views');
  assert.match(source, /viewMonthSelection/, 'month selection must be remembered per view, not leaked across views');

  for (const forbidden of [
    'life.insurers[0]',
    'nonlife.insurers[0]',
    'latest.insurers[0]',
    'latest.insurers.slice(0, 3)',
    'latest.insurers.slice(0, 5)',
  ]) {
    assert.equal(source.includes(forbidden), false, `raw-order ranking remains: ${forbidden}`);
  }

  assert.match(source, /function applySearchFilter/);
  assert.equal(source.includes("table.setFilter('name', 'like', q)"), false);
  assert.equal(source.includes("Life \\u20B9<span>' + fmtCr"), false, 'chart meta must not render double rupee symbols');
  assert.equal(source.includes("Non-Life \\u20B9<span>' + fmtCr"), false, 'chart meta must not render double rupee symbols');
  assert.equal(source.includes('Bloomberg'), false, 'public UI copy must be legally distinct from Bloomberg branding');
  assert.equal(html.includes('>LIVE<'), false, 'initial status must not claim live data before snapshot loads');
  assert.equal(readme.includes('Bloomberg'), false, 'README should describe the product as legally distinct market-terminal software');
});

test('overview and compare use the latest shared life/non-life month', async () => {
  const data = await readJson('data/irdai-processed.json');
  const source = await readText('js/dashboard.js');

  assert.equal(data._meta.latest_shared_month, '2026-05');
  assert.equal(data._meta.latest_life_month, '2026-05');
  assert.equal(data._meta.latest_non_life_month, '2026-06');
  assert.match(source, /function getSharedMonthPair/);

  const renderOverview = source.match(/function renderOverview\(\) \{[\s\S]*?\n\}/)?.[0] || '';
  const renderCompare = source.match(/function renderCompare\(\) \{[\s\S]*?\n\}/)?.[0] || '';
  const showSplash = source.match(/function showSplash\(\) \{[\s\S]*?\n\}/)?.[0] || '';
  assert.doesNotMatch(renderOverview, /getLifeLatest\(\)/);
  assert.doesNotMatch(renderOverview, /getNonLifeLatest\(\)/);
  assert.doesNotMatch(renderCompare, /getLifeLatest\(\)/);
  assert.doesNotMatch(renderCompare, /getNonLifeLatest\(\)/);
  assert.match(showSplash, /getSharedMonthPair/);
  assert.doesNotMatch(showSplash, /getLifeLatest\(\)/);
  assert.doesNotMatch(showSplash, /getNonLifeLatest\(\)/);
});

test('secondary analytics follow the active view and terminal exposes data audit', async () => {
  const source = await readText('js/dashboard.js');

  assert.match(source, /function resetPanelTabs/);
  const renderView = source.match(/function renderView\(view\) \{[\s\S]*?\n\}/)?.[0] || '';
  assert.match(renderView, /resetPanelTabs\(\)/, 'view switches must reset visible panel tabs to current content');

  assert.match(source, /function getActiveAnalysisScope/);
  assert.match(source, /function renderHHI\(\) \{\n\s+var scope = getActiveAnalysisScope\(\);/);
  assert.match(source, /function renderMovers\(\) \{\n\s+var scope = getActiveAnalysisScope\(\);/);
  assert.match(source, /function generateBrief\(\) \{[\s\S]*?getActiveAnalysisScope\(\)/);

  assert.match(source, /function showAudit/);
  assert.match(source, /function getSignedSourceAdjustments/);
  assert.match(source, /SIGNED SOURCE ADJUSTMENTS/);
  assert.match(source, /signed-source-adjustment/);
  assert.match(source, /is-source-adjustment/);
  assert.match(source, /'audit'/);
  assert.match(source, /showAudit/);
  assert.match(source, /setupStatus/);
});

test('terminal supports persistent watchlist monitoring workflow', async () => {
  const source = await readText('js/dashboard.js');
  const smoke = await readText('tests/browser-smoke.test.mjs');

  assert.match(source, /WATCHLIST_KEY/);
  assert.match(source, /function loadWatchlist/);
  assert.match(source, /function saveWatchlist/);
  assert.match(source, /function toggleWatchlist/);
  assert.match(source, /function renderWatchlistMonitor/);
  assert.match(source, /function getWatchlistAlerts/);
  assert.match(source, /watch-toggle/);
  assert.match(source, /Watchlist Monitor/);
  assert.match(source, /watchlist|watch\s+/);

  assert.match(smoke, /irdai_watchlist/);
  assert.match(smoke, /WATCHLIST MONITOR/);
  assert.match(smoke, /watch-toggle/);
});

test('terminal can export a readable audit pack', async () => {
  const source = await readText('js/dashboard.js');
  const smoke = await readText('tests/browser-smoke.test.mjs');
  const readme = await readText('README.md');

  assert.match(source, /function generateAuditPack/);
  assert.match(source, /function exportAuditPack/);
  assert.match(source, /function downloadTextFile/);
  assert.match(source, /IRDAI Insurance Terminal Audit Pack/);
  assert.match(source, /export audit/);
  assert.match(source, /source_hygiene/);
  assert.match(source, /getWatchlistAlerts/);

  assert.match(smoke, /waitForEvent\('download'\)/);
  assert.match(smoke, /irdai-audit-pack-/);
  assert.match(smoke, /IRDAI Insurance Terminal Audit Pack/);
  assert.match(readme, /export audit/);
});

test('terminal supports saved view presets', async () => {
  const source = await readText('js/dashboard.js');
  const smoke = await readText('tests/browser-smoke.test.mjs');
  const readme = await readText('README.md');

  assert.match(source, /SAVED_VIEWS_KEY/);
  assert.match(source, /function loadSavedViews/);
  assert.match(source, /function saveSavedViews/);
  assert.match(source, /function captureSavedView/);
  assert.match(source, /function saveCurrentViewPreset/);
  assert.match(source, /function applySavedViewPreset/);
  assert.match(source, /function deleteSavedViewPreset/);
  assert.match(source, /function showChatSavedViews/);
  assert.match(source, /save view/);
  assert.match(source, /load view/);

  assert.match(smoke, /irdai_saved_views/);
  assert.match(smoke, /save view nonlife desk/);
  assert.match(smoke, /load view nonlife desk/);
  assert.match(readme, /save view/);
});

test('watchlist alerts expose configurable local thresholds', async () => {
  const source = await readText('js/dashboard.js');
  const smoke = await readText('tests/browser-smoke.test.mjs');
  const readme = await readText('README.md');

  assert.match(source, /ALERT_CONFIG_KEY/);
  assert.match(source, /DEFAULT_ALERT_CONFIG/);
  assert.match(source, /function loadAlertConfig/);
  assert.match(source, /function saveAlertConfig/);
  assert.match(source, /function setAlertThreshold/);
  assert.match(source, /function showChatAlertConfig/);
  assert.match(source, /alert config/);
  assert.match(source, /set alert growth/);
  assert.match(source, /alertConfig/);

  assert.match(smoke, /irdai_alert_config/);
  assert.match(smoke, /set alert growth 12/);
  assert.match(smoke, /Growth surge: 12%/);
  assert.match(readme, /set alert growth/);
});

test('assistant exposes command mnemonics and input history', async () => {
  const source = await readText('js/dashboard.js');
  const smoke = await readText('tests/browser-smoke.test.mjs');
  const readme = await readText('README.md');

  assert.match(source, /COMMAND_REGISTRY/);
  assert.match(source, /COMMAND_HISTORY_KEY/);
  assert.match(source, /function loadCommandHistory/);
  assert.match(source, /function saveCommandHistory/);
  assert.match(source, /function rememberCommand/);
  assert.match(source, /function recallCommandHistory/);
  assert.match(source, /function showCommandPalette/);
  assert.match(source, /function runMnemonicCommand/);
  assert.match(source, /function encodeWorkspaceState/);
  assert.match(source, /function applyWorkspaceStateFromHash/);
  assert.match(source, /function buildWorkspaceLink/);
  assert.match(source, /function shareWorkspaceLink/);
  assert.match(source, /HELP/);
  assert.match(source, /TOPLIFE/);
  assert.match(source, /FIND/);
  assert.match(source, /LINK/);
  assert.match(source, /EXPORTCSV/);
  assert.match(source, /URLSearchParams/);
  assert.match(source, /location\.hash/);
  assert.match(source, /ArrowUp/);
  assert.match(source, /ctrlKey && e.key.toLowerCase\(\) === 'k'/);
  assert.match(source, /function handleFunctionKey/);
  assert.match(source, /F1/);
  assert.match(source, /F2/);
  assert.match(source, /F3/);
  assert.match(source, /F4/);

  assert.match(smoke, /TOPLIFE/);
  assert.match(smoke, /irdai_command_history/);
  assert.match(smoke, /ArrowUp/);
  assert.match(smoke, /keyboard\.press\('F2'\)/);
  assert.match(smoke, /keyboard\.press\('F4'\)/);
  assert.match(smoke, /#view=nonlife&month=2026-06&period=3m/);
  assert.match(smoke, /Shareable workspace link/);
  assert.match(smoke, /irdai-.*\\.csv/);
  assert.match(smoke, /Life Insurance Corporation of India/);
  assert.match(smoke, /COMMANDS/);
  assert.match(readme, /TOPLIFE/);
  assert.match(readme, /LINK/);
  assert.match(readme, /EXPORTCSV/);
  assert.match(readme, /Ctrl\+K/);
  assert.match(readme, /F1/);
  assert.match(readme, /F4/);
});

test('visible segment labels do not leak internal data keys', async () => {
  const source = await readText('js/dashboard.js');

  assert.match(source, /function segmentDisplayLabel/);
  assert.equal(source.includes("segment.toUpperCase() + ' Premium'"), false, 'non-life insights must not render as NON_LIFE');
  assert.equal(source.includes('NON_LIFE Premium'), false);
  assert.match(source, /Cumulative YTD/);
  assert.equal(source.includes('Data may mix cumulative and monthly periods'), false);
});

test('table body resize handles cannot intercept row popup clicks', async () => {
  const css = await readText('css/bloomberg.css');

  assert.match(css, /\.tabulator-row\s+\.tabulator-col-resize-handle\s*\{/);
  assert.match(css, /\.tabulator-row\s+\.tabulator-col-resize-handle\s*\{[^}]*pointer-events:\s*none/s);
});

test('tabulator table substrate is dark, not the library default white', async () => {
  const css = await readText('css/bloomberg.css');

  assert.match(css, /\.tabulator-table\s*\{/);
  assert.match(css, /\.tabulator-table\s*\{[^}]*background:\s*transparent\s*!important/s);
  assert.match(css, /\.tabulator-table\s*\{[^}]*color:\s*var\(--white\)\s*!important/s);
});

test('mobile layout suppresses low-value ticker noise and improves touch command input', async () => {
  const css = await readText('css/bloomberg.css');
  const smoke = await readText('tests/browser-smoke.test.mjs');

  assert.match(css, /@media\s*\(max-width:\s*500px\)[\s\S]*\.ticker-tape\s*\{[^}]*display:\s*none/s);
  assert.match(css, /@media\s*\(max-width:\s*500px\)[\s\S]*\.kpi-strip\s*\{[^}]*min-height:\s*48px/s);
  assert.match(css, /@media\s*\(max-width:\s*500px\)[\s\S]*\.panel-left\s*\{[^}]*max-height:\s*32vh/s);
  assert.match(css, /@media\s*\(max-width:\s*500px\)[\s\S]*\.chat-bar\s*\{[^}]*position:\s*fixed/s);
  assert.match(css, /@media\s*\(max-width:\s*500px\)[\s\S]*\.chat-input\s*\{[^}]*min-height:\s*34px/s);
  assert.match(smoke, /tickerDisplay/);
  assert.match(smoke, /mobile KPI strip collapsed/);
  assert.match(smoke, /mobile table panel too tall/);
  assert.match(smoke, /mobile command input too small/);
  assert.match(smoke, /mobile command bar collapsed/);
});

test('repo exposes browser smoke coverage for the rendered dashboard', async () => {
  const pkg = await readJson('package.json');
  const readme = await readText('README.md');

  assert.equal(pkg.scripts?.['test:browser'], 'node tests/browser-smoke.test.mjs');
  assert.equal(await fileExists('tests/browser-smoke.test.mjs'), true);

  const smoke = await readText('tests/browser-smoke.test.mjs');
  assert.match(smoke, /from 'playwright'/);
  assert.match(smoke, /SNAPSHOT: 2026-07-07/);
  assert.match(smoke, /DATA QUALITY AUDIT/);
  assert.match(smoke, /TOTAL NON-LIFE PREMIUM/);
  assert.match(smoke, /setViewportSize\(\{\s*width:\s*390,\s*height:\s*844/s);
  assert.match(readme, /npm run test:browser/);
});
