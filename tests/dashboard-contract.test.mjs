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

function latest(segmentData) {
  return segmentData.monthly_data.at(-1);
}

test('processed data carries source, freshness, and validation metadata', async () => {
  const data = await readJson('data/irdai-processed.json');
  assert.equal(data._meta.research_as_of, '2026-07-07');
  assert.match(data._meta.generated_at, /^\d{4}-\d{2}-\d{2}/);
  assert.notEqual(data._meta.validation?.status, 'error');
  assert.ok(Array.isArray(data._meta.validation?.issues));
  assert.equal(data._meta.validation.issues.some((issue) => issue.code === 'duplicate_total'), false);
  assert.ok(data._meta.validation.issues.some((issue) => issue.code === 'large_period_drop'));

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
  assert.match(source, /'audit'/);
  assert.match(source, /showAudit/);
  assert.match(source, /setupStatus/);
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
