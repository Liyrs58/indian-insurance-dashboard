// ─── State ──────────────────────────────────────────────────────────
let DATA = null;
let currentView = 'overview';
let table = null;
let chart = null;
let chartSeries = null;
let chartType = 'all';

// ─── Load ───────────────────────────────────────────────────────────
fetch('data/irdai-processed.json')
  .then(r => {
    if (!r.ok) throw new Error('HTTP ' + r.status);
    return r.json();
  })
  .then(d => { DATA = d; init(); })
  .catch(() => {
    document.getElementById('dataStatus').textContent = 'ERR';
    document.getElementById('dataStatus').style.color = 'var(--red)';
    document.querySelector('.status-dot').style.background = 'var(--red)';
  });

// ─── Init ───────────────────────────────────────────────────────────
function init() {
  updateClock();
  setInterval(updateClock, 1000);
  renderTicker();
  renderKPI();
  renderView('overview');
  setupNav();
  setupKeys();
  setupCmd();
}

// ─── Clock ──────────────────────────────────────────────────────────
function updateClock() {
  const now = new Date();
  const h = String(now.getHours()).padStart(2,'0');
  const m = String(now.getMinutes()).padStart(2,'0');
  const s = String(now.getSeconds()).padStart(2,'0');
  document.getElementById('clock').textContent = h + ':' + m + ':' + s + ' IST';
}

// ─── Helpers ────────────────────────────────────────────────────────
function fmtCr(val) {
  if (!val && val !== 0) return '--';
  if (val >= 100000) return '\u20B9' + (val/100000).toFixed(1) + 'L Cr';
  if (val >= 1000) return '\u20B9' + (val/1000).toFixed(1) + 'K Cr';
  return '\u20B9' + val.toFixed(0) + ' Cr';
}
function fmtPct(v) {
  if (v === undefined || v === null) return '--';
  return (v >= 0 ? '+' : '') + v.toFixed(1) + '%';
}
function getLifeLatest() { return DATA.life.monthly_data[DATA.life.monthly_data.length - 1]; }
function getNonLifeLatest() { return DATA.non_life.monthly_data[DATA.non_life.monthly_data.length - 1]; }

// ─── Ticker ─────────────────────────────────────────────────────────
function renderTicker() {
  const latest = getNonLifeLatest();
  const items = latest.insurers.map(function(i) {
    var cls = i.yoy_growth_pct >= 0 ? 'up' : 'dn';
    return '<span class="ticker-item">' +
      '<span class="t-sym">' + i.name.split(' ')[0] + '</span>' +
      '<span class="t-px">' + fmtCr(i.premium_cr) + '</span>' +
      '<span class="t-chg ' + cls + '">' + fmtPct(i.yoy_growth_pct) + '</span>' +
    '</span>';
  }).join('');
  document.getElementById('ticker').innerHTML = items + items;
}

// ─── KPI ────────────────────────────────────────────────────────────
function renderKPI() {
  var s = DATA.summary;
  var kpis = [
    { label: 'TOTAL MARKET', value: '\u20B9' + (s.total_market_premium_cr/1000).toFixed(1) + 'K Cr', sub: 'FY2025-26', color: 'var(--amber)' },
    { label: 'LIFE PREMIUM', value: '\u20B9' + (s.life_premium_cr/1000).toFixed(1) + 'K Cr', sub: Math.round((s.life_premium_cr/s.total_market_premium_cr)*100) + '% share', color: 'var(--green)' },
    { label: 'NON-LIFE', value: '\u20B9' + (s.non_life_premium_cr/1000).toFixed(1) + 'K Cr', sub: Math.round((s.non_life_premium_cr/s.total_market_premium_cr)*100) + '% share', color: 'var(--cyan)' },
    { label: 'PENETRATION', value: s.insurance_penetration_pct + '%', sub: 'Global: ' + s.global_penetration_avg_pct + '%', color: 'var(--purple)' },
    { label: 'DENSITY', value: '$' + s.insurance_density_usd, sub: 'Per capita', color: 'var(--orange)' },
    { label: 'PLAYERS', value: getLifeLatest().insurers.length + getNonLifeLatest().insurers.length, sub: 'Monitored', color: 'var(--pink)' },
  ];
  document.getElementById('kpiStrip').innerHTML = kpis.map(function(k) {
    return '<div class="kpi-item"><div class="kpi-label">' + k.label + '</div><div class="kpi-value" style="color:' + k.color + '">' + k.value + '</div><div class="kpi-sub">' + k.sub + '</div></div>';
  }).join('');
}

// ─── Navigation ─────────────────────────────────────────────────────
function setupNav() {
  document.querySelectorAll('#navTabs .nav-tab').forEach(function(el) {
    el.addEventListener('click', function() {
      document.querySelectorAll('#navTabs .nav-tab').forEach(function(n) { n.classList.remove('active'); });
      el.classList.add('active');
      renderView(el.dataset.view);
    });
  });
  document.querySelectorAll('.panel-tab').forEach(function(el) {
    el.addEventListener('click', function() {
      var parent = el.closest('.panel');
      parent.querySelectorAll('.panel-tab').forEach(function(n) { n.classList.remove('active'); });
      el.classList.add('active');
      parent.querySelectorAll('.tab-content').forEach(function(n) { n.classList.remove('active'); });
      var target = document.getElementById(el.dataset.tab + '-tab') || document.getElementById(el.dataset.panel + '-tab');
      if (target) target.classList.add('active');
    });
  });
  document.querySelectorAll('[data-tf]').forEach(function(el) {
    el.addEventListener('click', function() {
      document.querySelectorAll('[data-tf]').forEach(function(n) { n.classList.remove('active'); });
      el.classList.add('active');
      chartType = el.dataset.tf;
      updateChart();
    });
  });
}

function setupKeys() {
  document.addEventListener('keydown', function(e) {
    if (e.key === '1') { e.preventDefault(); switchView('overview'); }
    if (e.key === '2') { e.preventDefault(); switchView('life'); }
    if (e.key === '3') { e.preventDefault(); switchView('nonlife'); }
    if (e.key === '4') { e.preventDefault(); switchView('compare'); }
    if (e.key === 'Escape') closePopup();
    if (e.key === 'r' && (e.ctrlKey || e.metaKey)) { e.preventDefault(); refreshData(); }
  });
}

function switchView(view) {
  document.querySelectorAll('#navTabs .nav-tab').forEach(function(n) {
    n.classList.toggle('active', n.dataset.view === view);
  });
  renderView(view);
}

// ─── Command Bar ────────────────────────────────────────────────────
function setupCmd() {
  var input = document.getElementById('cmdInput');
  input.addEventListener('keydown', function(e) {
    if (e.key === 'Enter') {
      var cmd = input.value.trim().toLowerCase();
      input.value = '';
      if (cmd === 'help' || cmd === '?') showHelp();
      else if (cmd === 'overview' || cmd === '1') switchView('overview');
      else if (cmd === 'life' || cmd === '2') switchView('life');
      else if (cmd === 'nonlife' || cmd === '3') switchView('nonlife');
      else if (cmd === 'compare' || cmd === '4') switchView('compare');
      else if (cmd.indexOf('search ') === 0) {
        var q = cmd.slice(7);
        if (table) table.setFilter('name', 'like', q);
      } else {
        document.getElementById('cmdStatus').textContent = 'Unknown: ' + cmd;
        setTimeout(function() { document.getElementById('cmdStatus').textContent = '60 insurers tracked'; }, 2000);
      }
    }
  });
}

function showHelp() {
  showPopup('IRDAI COMMANDS',
    '<div style="display:grid;grid-template-columns:80px 1fr;gap:4px 10px;font-size:9px;">' +
      '<span style="color:var(--cyan)">1 / overview</span><span>Market overview</span>' +
      '<span style="color:var(--cyan)">2 / life</span><span>Life insurance view</span>' +
      '<span style="color:var(--cyan)">3 / nonlife</span><span>Non-life insurance view</span>' +
      '<span style="color:var(--cyan)">4 / compare</span><span>Life vs Non-Life comparison</span>' +
      '<span style="color:var(--cyan)">search &lt;name&gt;</span><span>Filter table by company name</span>' +
      '<span style="color:var(--cyan)">Ctrl+R</span><span>Refresh data</span>' +
      '<span style="color:var(--cyan)">Esc</span><span>Close popup</span>' +
    '</div>' +
    '<div style="margin-top:8px;color:var(--gray);font-size:8px;">IRDAI · Indian Insurance Market Terminal v1.0</div>'
  );
}

var refreshCount = 0;
function refreshData() {
  refreshCount++;
  document.getElementById('dataStatus').textContent = 'REFRESH';
  setTimeout(function() { document.getElementById('dataStatus').textContent = 'LIVE'; }, 1000);
}

// ─── Popup ──────────────────────────────────────────────────────────
function showPopup(title, body) {
  document.getElementById('popupTitle').textContent = title;
  document.getElementById('popupBody').innerHTML = body;
  document.getElementById('popup').classList.add('show');
}
function closePopup() {
  document.getElementById('popup').classList.remove('show');
}

// ─── Render View ────────────────────────────────────────────────────
function renderView(view) {
  currentView = view;
  if (table) { table.destroy(); table = null; }
  if (chart) { chart.remove(); chart = null; chartSeries = null; }

  if (view === 'overview') renderOverview();
  else if (view === 'life') renderSegment('life');
  else if (view === 'nonlife') renderSegment('nonlife');
  else if (view === 'compare') renderCompare();
}

// ─── Render Overview ────────────────────────────────────────────────
function renderOverview() {
  var life = getLifeLatest();
  var nonlife = getNonLifeLatest();
  var combined = life.insurers.map(function(i) { return Object.assign({}, i, { _seg: 'Life' }); })
    .concat(nonlife.insurers.map(function(i) { return Object.assign({}, i, { _seg: 'Non-Life' }); }))
    .sort(function(a, b) { return b.premium_cr - a.premium_cr; });

  document.getElementById('tableTitle').textContent = 'ALL INSURERS';
  document.getElementById('tableMonth').textContent = nonlife.month;

  buildTable(combined, ['rank', 'name', 'segment', 'premium', 'share', 'growth'],
    { rank: { title: '#', width: 30 }, name: { title: 'Company', width: 200 }, segment: { title: 'Type', width: 60 }, premium: { title: 'Premium' }, share: { title: 'Share %' }, growth: { title: 'YoY %' } }
  );

  updateChartData('all');
  updateChartHeader('IRDAI', fmtCr(combined[0].premium_cr), fmtPct(combined[0].yoy_growth_pct), combined[0].yoy_growth_pct >= 0);
  updateMeta(life, nonlife);
  renderOverviewInsights(life, nonlife);
  renderPlayers(life.insurers.slice(0, 8), nonlife.insurers.slice(0, 8));
  renderPenetration();
}

// ─── Render Segment ─────────────────────────────────────────────────
function renderSegment(segment) {
  var segData = DATA[segment];
  var latest = segData.monthly_data[segData.monthly_data.length - 1];
  var label = segment === 'life' ? 'LIFE INSURANCE' : 'NON-LIFE INSURANCE';

  document.getElementById('tableTitle').textContent = label;
  document.getElementById('tableMonth').textContent = latest.month;

  buildTable(latest.insurers, ['rank', 'name', 'premium', 'share', 'growth'],
    { rank: { title: '#', width: 30 }, name: { title: 'Company', width: 220 }, premium: { title: 'Premium' }, share: { title: 'Share %' }, growth: { title: 'YoY %' } }
  );

  updateChartData(segment);
  updateChartHeader(label, fmtCr(latest.total_premium_cr), fmtPct(latest.total_growth_pct), latest.total_growth_pct >= 0);
  updateMetaSegment(latest, segment);
  renderSegmentInsights(latest, segment);
}

// ─── Render Compare ────────────────────────────────────────────────
function renderCompare() {
  var life = getLifeLatest();
  var nonlife = getNonLifeLatest();

  document.getElementById('tableTitle').textContent = 'LIFE vs NON-LIFE';
  document.getElementById('tableMonth').textContent = life.month;

  var both = [
    { name: 'Life Insurance', premium_cr: life.total_premium_cr, market_share_pct: 0, yoy_growth_pct: life.total_growth_pct, _seg: 'Life' },
    { name: 'Non-Life Insurance', premium_cr: nonlife.total_premium_cr, market_share_pct: 0, yoy_growth_pct: nonlife.total_growth_pct, _seg: 'Non-Life' },
  ];
  buildTable(both, ['name', 'premium', 'growth', 'seg'],
    { name: { title: 'Segment', width: 200 }, premium: { title: 'Premium' }, growth: { title: 'YoY %' }, seg: { title: 'Type' } }
  );

  updateChartData('compare');
  updateChartHeader('IRDAI ALL', fmtCr(life.total_premium_cr + nonlife.total_premium_cr), fmtPct(DATA.summary.insurance_penetration_pct), true);
  updateMeta(life, nonlife);
  renderCompareInsights(life, nonlife);
}

// ─── Build Table (Tabulator) ────────────────────────────────────────
function buildTable(data, columns, colDefs) {
  var colArr = columns.map(function(key) {
    var def = colDefs[key] || {};
    var formatter = 'plaintext';

    if (key === 'rank') {
      formatter = function(c) { return '<span style="color:var(--gray)">' + c.getValue() + '</span>'; };
    } else if (key === 'name') {
      formatter = function(c) { return '<span style="color:var(--cyan);font-weight:600">' + c.getValue() + '</span>'; };
    } else if (key === 'segment' || key === 'seg') {
      formatter = function(c) {
        var v = c.getValue();
        var cls = v === 'Life' ? 'green' : 'cyan';
        return '<span style="color:var(--' + cls + ')">' + v + '</span>';
      };
    } else if (key === 'premium') {
      formatter = function(c) { return '<span style="color:var(--white);font-variant-numeric:tabular-nums">' + fmtCr(c.getValue()) + '</span>'; };
    } else if (key === 'share') {
      formatter = function(c) { return '<span style="color:var(--amber);font-variant-numeric:tabular-nums">' + c.getValue().toFixed(1) + '%</span>'; };
    } else if (key === 'growth') {
      formatter = function(c) {
        var v = c.getValue();
        var cls = v >= 0 ? 'var(--green)' : 'var(--red)';
        return '<span style="color:' + cls + ';font-variant-numeric:tabular-nums">' + fmtPct(v) + '</span>';
      };
    }

    return {
      title: def.title || key.toUpperCase(),
      field: key,
      width: def.width,
      hozAlign: (key === 'rank' || key === 'name' || key === 'segment' || key === 'seg') ? 'left' : 'right',
      headerFilter: key === 'name' ? 'input' : false,
      headerFilterPlaceholder: key === 'name' ? 'Search...' : '',
      formatter: formatter,
      sorter: (key === 'name' ? 'string' : (key === 'rank' || key === 'premium' || key === 'share' || key === 'growth') ? 'number' : 'string'),
    };
  });

  var rows = data.map(function(d, i) {
    var r = Object.assign({}, d, { rank: i + 1 });
    if (d._seg) r.seg = d._seg;
    return r;
  });

  table = new Tabulator('#tableContainer', {
    data: rows,
    columns: colArr,
    layout: 'fitDataFill',
    height: '100%',
    virtualDom: true,
    rowFormatter: function(row) {
      var d = row.getData();
      if (d._seg === 'Life' || d.seg === 'Life') {
        row.getElement().style.borderLeft = '2px solid rgba(0,204,68,0.3)';
      } else if (d._seg === 'Non-Life' || d.seg === 'Non-Life') {
        row.getElement().style.borderLeft = '2px solid rgba(0,204,255,0.3)';
      }
    },
  });

  table.on('rowClick', function(e, row) {
    var d = row.getData();
    showPopup(d.name,
      '<div style="display:grid;grid-template-columns:100px 1fr;gap:4px 12px;font-size:10px;">' +
        '<span style="color:var(--gray)">Premium</span><span style="color:var(--white)">' + fmtCr(d.premium_cr) + '</span>' +
        '<span style="color:var(--gray)">Market Share</span><span style="color:var(--amber)">' + d.market_share_pct.toFixed(1) + '%</span>' +
        '<span style="color:var(--gray)">YoY Growth</span><span style="color:' + (d.yoy_growth_pct >= 0 ? 'var(--green)' : 'var(--red)') + '">' + fmtPct(d.yoy_growth_pct) + '</span>' +
        '<span style="color:var(--gray)">Rank</span><span>#' + d.rank + '</span>' +
        (d._seg ? '<span style="color:var(--gray)">Segment</span><span>' + d._seg + '</span>' : '') +
      '</div>'
    );
  });
}

// ─── Chart ──────────────────────────────────────────────────────────
function updateChartData(segment) {
  var container = document.getElementById('trendChart');
  if (!chart) {
    chart = LightweightCharts.createChart(container, {
      layout: {
        background: { type: 'solid', color: 'transparent' },
        textColor: '#666680',
        fontSize: 9,
        fontFamily: "'IBM Plex Mono', monospace",
      },
      grid: {
        vertLines: { color: '#1e203030' },
        horzLines: { color: '#1e203030' },
      },
      crosshair: {
        mode: LightweightCharts.CrosshairMode.Normal,
        vertLine: { color: '#ff990060', width: 1, style: LightweightCharts.LineStyle.Dashed },
        horzLine: { color: '#ff990060', width: 1, style: LightweightCharts.LineStyle.Dashed },
      },
      timeScale: {
        borderColor: '#282a3a',
        timeVisible: false,
      },
      rightPriceScale: {
        borderColor: '#282a3a',
        scaleMargins: { top: 0.1, bottom: 0.2 },
      },
      handleScroll: false,
      handleScale: false,
    });

    chart.applyOptions({
      watermark: {
        visible: true,
        text: 'IRDAI',
        color: '#1e203040',
        fontFamily: "'IBM Plex Mono', monospace",
        fontSize: 24,
      },
    });
  }

  chart.resize(container.clientWidth || 300, container.clientHeight || 200);
  updateChart();

  // Resize on window resize
  var resizeFn = function() {
    var r = container.getBoundingClientRect();
    if (r.width > 0 && r.height > 0) chart.resize(r.width, r.height);
  };
  window.addEventListener('resize', resizeFn);
}

function updateChart() {
  if (!chart) return;
  if (chartSeries) { chart.removeSeries(chartSeries); chartSeries = null; }

  var data, color, label;
  if (chartType === 'all' || chartType === 'overview') {
    data = DATA.life.monthly_data.map(function(m, i) {
      var non = DATA.non_life.monthly_data[i] || DATA.non_life.monthly_data[DATA.non_life.monthly_data.length - 1];
      return { time: m.month, value: m.total_premium_cr + non.total_premium_cr };
    });
    color = '#ff9900';
    label = 'Total Premium';
  } else if (chartType === 'life') {
    data = DATA.life.monthly_data.map(function(m) { return { time: m.month, value: m.total_premium_cr }; });
    color = '#00cc44';
    label = 'Life Premium';
  } else if (chartType === 'nonlife') {
    data = DATA.non_life.monthly_data.map(function(m) { return { time: m.month, value: m.total_premium_cr }; });
    color = '#00ccff';
    label = 'Non-Life Premium';
  } else if (chartType === 'compare') {
    color = '#ff9900';
    label = 'Total Premium';
    var lifeData = DATA.life.monthly_data;
    var nonData = DATA.non_life.monthly_data;
    // Show both as separate series
    var lifeSeries = chart.addAreaSeries({
      lineColor: '#00cc44',
      topColor: '#00cc4420',
      bottomColor: '#00cc4405',
      lineWidth: 1,
      lastValueVisible: true,
      priceFormat: { type: 'volume' },
    });
    lifeSeries.setData(lifeData.map(function(m) { return { time: m.month, value: m.total_premium_cr }; }));
    chartSeries = lifeSeries;

    var nonSeries = chart.addAreaSeries({
      lineColor: '#00ccff',
      topColor: '#00ccff20',
      bottomColor: '#00ccff05',
      lineWidth: 1,
    });
    nonSeries.setData(nonData.map(function(m) { return { time: m.month, value: m.total_premium_cr }; }));

    chart.timeScale().fitContent();
    return;
  }

  chartSeries = chart.addAreaSeries({
    lineColor: color,
    topColor: color + '20',
    bottomColor: color + '05',
    lineWidth: 1.5,
    lastValueVisible: true,
    priceFormat: { type: 'volume' },
  });
  chartSeries.setData(data);
  chart.timeScale().fitContent();
}

function updateChartHeader(ticker, price, change, isUp) {
  document.getElementById('chTicker').textContent = ticker;
  document.getElementById('chPrice').textContent = price;
  var el = document.getElementById('chChange');
  el.textContent = change;
  el.className = 'chart-change ' + (isUp ? 'up' : 'dn');
}

function updateMeta(life, nonlife) {
  document.getElementById('chartMeta').innerHTML =
    '<span>Life \u20B9<span>' + fmtCr(life.total_premium_cr) + '</span></span>' +
    '<span>Non-Life \u20B9<span>' + fmtCr(nonlife.total_premium_cr) + '</span></span>' +
    '<span>Life YoY <span class="' + (life.total_growth_pct >= 0 ? 'up' : 'dn') + '">' + fmtPct(life.total_growth_pct) + '</span></span>' +
    '<span>Non-Life YoY <span class="' + (nonlife.total_growth_pct >= 0 ? 'up' : 'dn') + '">' + fmtPct(nonlife.total_growth_pct) + '</span></span>';
}

function updateMetaSegment(latest, segment) {
  var color = segment === 'life' ? 'var(--green)' : 'var(--cyan)';
  document.getElementById('chartMeta').innerHTML =
    '<span>Total <span style="color:' + color + '">' + fmtCr(latest.total_premium_cr) + '</span></span>' +
    '<span>YoY <span class="' + (latest.total_growth_pct >= 0 ? 'up' : 'dn') + '">' + fmtPct(latest.total_growth_pct) + '</span></span>' +
    '<span>Players <span>' + latest.insurers.length + '</span></span>' +
    '<span>Top Share <span>' + latest.insurers[0].market_share_pct.toFixed(1) + '%</span></span>';
}

// ─── Insights Tab ───────────────────────────────────────────────────
function renderOverviewInsights(life, nonlife) {
  var total = life.total_premium_cr + nonlife.total_premium_cr;
  document.getElementById('insights-tab').innerHTML =
    '<div class="insight-card">' +
      '<div class="label">Total Market Premium</div>' +
      '<div class="value" style="color:var(--amber)">' + fmtCr(total) + '</div>' +
      '<div class="desc">Combined life + non-life for current period</div>' +
    '</div>' +
    '<div class="insight-grid">' +
      '<div class="insight-card">' +
        '<div class="label">Life Share</div>' +
        '<div class="value" style="color:var(--green)">' + Math.round(life.total_premium_cr / total * 100) + '%</div>' +
        '<div class="desc">YoY: ' + fmtPct(life.total_growth_pct) + '</div>' +
      '</div>' +
      '<div class="insight-card">' +
        '<div class="label">Non-Life Share</div>' +
        '<div class="value" style="color:var(--cyan)">' + Math.round(nonlife.total_premium_cr / total * 100) + '%</div>' +
        '<div class="desc">YoY: ' + fmtPct(nonlife.total_growth_pct) + '</div>' +
      '</div>' +
      '<div class="insight-card">' +
        '<div class="label">Top Life Player</div>' +
        '<div class="value" style="color:var(--green);font-size:10px;">' + life.insurers[0].name.split(' ')[0] + '</div>' +
        '<div class="desc">' + life.insurers[0].market_share_pct.toFixed(1) + '% market share</div>' +
      '</div>' +
      '<div class="insight-card">' +
        '<div class="label">Top Non-Life Player</div>' +
        '<div class="value" style="color:var(--cyan);font-size:10px;">' + nonlife.insurers[0].name.split(' ')[0] + '</div>' +
        '<div class="desc">' + nonlife.insurers[0].market_share_pct.toFixed(1) + '% market share</div>' +
      '</div>' +
    '</div>' +
    '<div class="insight-card" style="margin-top:4px;">' +
      '<div class="label">Market Penetration Gap</div>' +
      '<div class="value" style="color:var(--purple)">' + (DATA.summary.global_penetration_avg_pct - DATA.summary.insurance_penetration_pct).toFixed(1) + 'pp</div>' +
      '<div class="desc">Below global average of ' + DATA.summary.global_penetration_avg_pct + '%</div>' +
    '</div>';
}

function renderSegmentInsights(latest, segment) {
  var color = segment === 'life' ? 'var(--green)' : 'var(--cyan)';
  var total = latest.insurers.reduce(function(s, i) { return s + i.premium_cr; }, 0);
  var top3Share = latest.insurers.slice(0, 3).reduce(function(s, i) { return s + i.market_share_pct; }, 0);

  document.getElementById('insights-tab').innerHTML =
    '<div class="insight-card">' +
      '<div class="label">Total ' + segment.toUpperCase() + ' Premium</div>' +
      '<div class="value" style="color:' + color + '">' + fmtCr(latest.total_premium_cr) + '</div>' +
      '<div class="desc">YoY: ' + fmtPct(latest.total_growth_pct) + '</div>' +
    '</div>' +
    '<div class="insight-grid">' +
      '<div class="insight-card">' +
        '<div class="label">Top 3 Concentration</div>' +
        '<div class="value" style="color:var(--amber)">' + top3Share.toFixed(1) + '%</div>' +
        '<div class="desc">Combined market share</div>' +
      '</div>' +
      '<div class="insight-card">' +
        '<div class="label">Total Players</div>' +
        '<div class="value" style="color:var(--pink)">' + latest.insurers.length + '</div>' +
        '<div class="desc">Active insurers</div>' +
      '</div>' +
      '<div class="insight-card">' +
        '<div class="label">Top Player</div>' +
        '<div class="value" style="color:' + color + ';font-size:10px;">' + latest.insurers[0].name.split(' ')[0] + '</div>' +
        '<div class="desc">' + latest.insurers[0].market_share_pct.toFixed(1) + '% share</div>' +
      '</div>' +
      '<div class="insight-card">' +
        '<div class="label">Growth Leaders</div>' +
        '<div class="value" style="color:var(--green);font-size:9px;">' + latest.insurers.slice(0, 5).filter(function(i) { return i.yoy_growth_pct > 10; }).length + '</div>' +
        '<div class="desc">Growing >10% YoY</div>' +
      '</div>' +
    '</div>';
}

function renderCompareInsights(life, nonlife) {
  document.getElementById('insights-tab').innerHTML =
    '<div class="insight-card">' +
      '<div class="label">Life vs Non-Life Premium Gap</div>' +
      '<div class="value" style="color:var(--amber)">' + fmtCr(Math.abs(life.total_premium_cr - nonlife.total_premium_cr)) + '</div>' +
      '<div class="desc">' + (life.total_premium_cr > nonlife.total_premium_cr ? 'Life' : 'Non-Life') + ' leads</div>' +
    '</div>' +
    '<div class="insight-grid">' +
      '<div class="insight-card">' +
        '<div class="label">Life YoY Growth</div>' +
        '<div class="value" style="color:' + (life.total_growth_pct >= 0 ? 'var(--green)' : 'var(--red)') + '">' + fmtPct(life.total_growth_pct) + '</div>' +
      '</div>' +
      '<div class="insight-card">' +
        '<div class="label">Non-Life YoY Growth</div>' +
        '<div class="value" style="color:' + (nonlife.total_growth_pct >= 0 ? 'var(--green)' : 'var(--red)') + '">' + fmtPct(nonlife.total_growth_pct) + '</div>' +
      '</div>' +
    '</div>' +
    '<div class="insight-card" style="margin-top:4px;">' +
      '<div class="label">Combined Market Premium</div>' +
      '<div class="value" style="color:var(--amber)">' + fmtCr(life.total_premium_cr + nonlife.total_premium_cr) + '</div>' +
      '<div class="desc">Life: ' + Math.round(life.total_premium_cr / (life.total_premium_cr + nonlife.total_premium_cr) * 100) + '% | Non-Life: ' + Math.round(nonlife.total_premium_cr / (life.total_premium_cr + nonlife.total_premium_cr) * 100) + '%</div>' +
    '</div>';
}

// ─── Top Players Tab ────────────────────────────────────────────────
function renderPlayers(lifeTop, nonlifeTop) {
  var html = '<div class="section-label">LIFE INSURANCE — TOP 8</div>';
  lifeTop.forEach(function(i, idx) {
    html += '<div class="player-row">' +
      '<span class="player-rank">#' + (idx + 1) + '</span>' +
      '<span class="player-name">' + i.name.split(' ').slice(0, 2).join(' ') + '</span>' +
      '<span class="player-share" style="color:var(--green)">' + i.market_share_pct.toFixed(1) + '%</span>' +
      '<span class="player-growth ' + (i.yoy_growth_pct >= 0 ? 'up' : 'dn') + '">' + fmtPct(i.yoy_growth_pct) + '</span>' +
    '</div>';
  });

  html += '<div class="section-label" style="margin-top:6px;">NON-LIFE INSURANCE — TOP 8</div>';
  nonlifeTop.forEach(function(i, idx) {
    html += '<div class="player-row">' +
      '<span class="player-rank">#' + (idx + 1) + '</span>' +
      '<span class="player-name">' + i.name.split(' ').slice(0, 2).join(' ') + '</span>' +
      '<span class="player-share" style="color:var(--cyan)">' + i.market_share_pct.toFixed(1) + '%</span>' +
      '<span class="player-growth ' + (i.yoy_growth_pct >= 0 ? 'up' : 'dn') + '">' + fmtPct(i.yoy_growth_pct) + '</span>' +
    '</div>';
  });

  document.getElementById('players-tab').innerHTML = html;
}

// ─── Penetration Tab ────────────────────────────────────────────────
function renderPenetration() {
  var s = DATA.summary;
  var gap = (s.global_penetration_avg_pct - s.insurance_penetration_pct).toFixed(1);
  var gapPct = Math.round(s.insurance_penetration_pct / s.global_penetration_avg_pct * 100);

  document.getElementById('penetration-tab').innerHTML =
    '<div class="insight-card">' +
      '<div class="label">Insurance Penetration</div>' +
      '<div class="value" style="color:var(--purple)">' + s.insurance_penetration_pct + '% of GDP</div>' +
      '<div class="desc">India ranks below the global average of ' + s.global_penetration_avg_pct + '%</div>' +
    '</div>' +
    '<div class="insight-grid">' +
      '<div class="insight-card">' +
        '<div class="label">Gap to Global Avg</div>' +
        '<div class="value" style="color:var(--amber)">' + gap + 'pp</div>' +
      '</div>' +
      '<div class="insight-card">' +
        '<div class="label">Penetration Rate</div>' +
        '<div class="value" style="color:var(--pink)">' + gapPct + '%</div>' +
        '<div class="desc">% of global average achieved</div>' +
      '</div>' +
    '</div>' +
    '<div class="insight-card" style="margin-top:4px;">' +
      '<div class="label">Insurance Density</div>' +
      '<div class="value" style="color:var(--orange)">$' + s.insurance_density_usd + '/capita</div>' +
      '<div class="desc">Premium per person per year</div>' +
    '</div>' +
    '<div class="insight-card" style="margin-top:4px;">' +
      '<div class="label">Addressable Opportunity</div>' +
      '<div class="value" style="color:var(--amber)">' + (gap * 2).toFixed(0) + 'x</div>' +
      '<div class="desc">India needs to grow penetration ' + (gap * 2).toFixed(0) + 'x to match global peers</div>' +
    '</div>';
}
