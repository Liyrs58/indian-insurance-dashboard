// ─── State ──────────────────────────────────────────────────────────
let STOCKS = null;
let DATA = null;
let currentView = 'overview';
let table = null;
let chart = null;
let chartSeries = [];
let chartType = 'all';
let resizeHandler = null;
let renderedTabs = {};
let showEMA = false;
let emaSeries = null;
let chartPeriod = 'all';

// ─── Company Enrichment DB ──────────────────────────────────────────
const COMPANY_DB = {
  'LIC': { group:'LIC', founded:1956, ticker:'', rating:'AAA', segment:'Life', specialties:'Individual & group life, pension, health', desc:'Life Insurance Corporation of India — the country\'s largest insurer with majority market share. Government-owned.' },
  'HDFC Life Insurance Company Limited': { group:'HDFC', founded:2000, ticker:'HDFCLIFE.NS', rating:'AAA', segment:'Life', specialties:'ULIPs, protection, retirement, savings', desc:'HDFC Life is a joint venture between HDFC and Standard Life Aberdeen. One of India\'s leading private life insurers.' },
  'ICICI Prudential Life Insurance Company Limited': { group:'ICICI', founded:2001, ticker:'ICICIPRULI.NS', rating:'AAA', segment:'Life', specialties:'Protection, savings, retirement, health', desc:'ICICI Prudential Life is a joint venture between ICICI Bank and Prudential Corporation Holdings.' },
  'SBI Life Insurance Company Limited': { group:'SBI', founded:2001, ticker:'SBILIFE.NS', rating:'AAA', segment:'Life', specialties:'Individual & group life, pension, unit-linked', desc:'SBI Life is a joint venture between State Bank of India and BNP Paribas Cardif.' },
  'Bajaj Allianz Life Insurance Company Limited': { group:'Bajaj', founded:2001, ticker:'', rating:'AAA', segment:'Life', specialties:'ULIPs, savings, protection, retirement', desc:'A joint venture between Bajaj Finserv and Allianz SE.' },
  'Max Life Insurance Company Limited': { group:'Max', founded:2000, ticker:'', rating:'AAA', segment:'Life', specialties:'Protection, savings, retirement, health', desc:'Max Life is a joint venture between Max Financial Services and Mitsui Sumitomo Insurance.' },
  'Tata AIA Life Insurance Company Limited': { group:'Tata', founded:2001, ticker:'', rating:'AAA', segment:'Life', specialties:'Protection, savings, retirement, ULIPs', desc:'A joint venture between Tata Sons and AIA Group.' },
  'Kotak Mahindra Life Insurance Company Limited': { group:'Kotak', founded:2001, ticker:'KOTAKBANK.NS', rating:'AAA', segment:'Life', specialties:'Savings, protection, retirement, health', desc:'Kotak Mahindra Life is a subsidiary of Kotak Mahindra Bank.' },
  'Aditya Birla Sun Life Insurance Company Limited': { group:'Aditya Birla', founded:2000, ticker:'', rating:'AA+', segment:'Life', specialties:'ULIPs, savings, protection, retirement', desc:'A joint venture between Aditya Birla Group and Sun Life Financial.' },
  'Reliance Nippon Life Insurance Company Limited': { group:'Reliance', founded:2001, ticker:'', rating:'AA+', segment:'Life', specialties:'Protection, savings, retirement, health', desc:'A joint venture between Reliance Capital and Nippon Life Insurance.' },
  'ICICI Lombard General Insurance Company Limited': { group:'ICICI', founded:2001, ticker:'ICICIGI.NS', rating:'AAA', segment:'Non-Life', specialties:'Motor, health, travel, property, marine', desc:'India\'s leading private non-life insurer, a JV between ICICI Bank and Fairfax Financial.' },
  'The New India Assurance Company Limited': { group:'Government', founded:1919, ticker:'NIACL.NS', rating:'AAA', segment:'Non-Life', specialties:'Motor, health, fire, marine, engineering', desc:'India\'s largest public sector non-life insurer, owned by Government of India.' },
  'Star Health and Allied Insurance Company Limited': { group:'Star Health', founded:2006, ticker:'STARHEALTH.NS', rating:'AA+', segment:'Non-Life', specialties:'Health insurance, critical illness, personal accident', desc:'India\'s largest standalone health insurer.' },
  'Bajaj Allianz General Insurance Company Limited': { group:'Bajaj', founded:2001, ticker:'BAJAJFINSV.NS', rating:'AAA', segment:'Non-Life', specialties:'Motor, health, travel, property, marine', desc:'A joint venture between Bajaj Finserv and Allianz SE.' },
  'National Insurance Company Limited': { group:'Government', founded:1906, ticker:'', rating:'AA-', segment:'Non-Life', specialties:'Motor, health, fire, marine, engineering', desc:'Public sector general insurer under Government of India ownership.' },
  'United India Insurance Company Limited': { group:'Government', founded:1938, ticker:'', rating:'AA-', segment:'Non-Life', specialties:'Motor, health, fire, marine, engineering', desc:'Public sector general insurer owned by Government of India.' },
  'SBI General Insurance Company Limited': { group:'SBI', founded:2009, ticker:'', rating:'AAA', segment:'Non-Life', specialties:'Motor, health, travel, property', desc:'A joint venture between SBI and Insurance Australia Group (IAG).' },
  'Tata AIG General Insurance Company Limited': { group:'Tata', founded:2001, ticker:'', rating:'AAA', segment:'Non-Life', specialties:'Motor, health, travel, marine, fire', desc:'A joint venture between Tata Sons and American International Group (AIG).' },
  'Care Health Insurance Company Limited': { group:'', founded:2007, ticker:'', rating:'AA+', segment:'Non-Life', specialties:'Health insurance, critical illness, personal accident', desc:'Formerly Religare Health Insurance, a standalone health insurer.' },
  'Go Digit General Insurance Limited': { group:'Go Digit', founded:2017, ticker:'DIGIT.NS', rating:'AA', segment:'Non-Life', specialties:'Motor, health, travel, property, cyber', desc:'Backed by Fairfax Group and backed by cricketer MS Dhoni. Digital-first insurer.' },
  'Acko General Insurance Limited': { group:'Acko', founded:2017, ticker:'', rating:'AA', segment:'Non-Life', specialties:'Motor, health, travel, gadget, bike', desc:'India\'s first digital-only insurance company, backed by Narayana Murthy.' },
  'Future Generali India Insurance Company Limited': { group:'Generali', founded:2008, ticker:'', rating:'AA', segment:'Non-Life', specialties:'Motor, health, travel, home, marine', desc:'A joint venture between Future Group and Generali Italia.' },
  'Royal Sundaram General Insurance Company Limited': { group:'Sundaram', founded:2001, ticker:'', rating:'AA+', segment:'Non-Life', specialties:'Motor, health, travel, home, marine', desc:'A joint venture between Sundaram Finance and RSA Group.' },
  'Cholamandalam MS General Insurance Company Limited': { group:'Murugappa', founded:2001, ticker:'', rating:'AA+', segment:'Non-Life', specialties:'Motor, health, travel, crop, marine', desc:'A joint venture between Murugappa Group and Mitsui Sumitomo Insurance.' },
  'HDFC ERGO General Insurance Company Limited': { group:'HDFC', founded:2002, ticker:'', rating:'AAA', segment:'Non-Life', specialties:'Motor, health, travel, fire, marine', desc:'A joint venture between HDFC and ERGO (Munich Re Group).' },
  'Reliance General Insurance Company Limited': { group:'Reliance', founded:2000, ticker:'', rating:'AA', segment:'Non-Life', specialties:'Motor, health, travel, property, marine', desc:'A subsidiary of Reliance Capital.' },
  'Acko Life Insurance Limited': { group:'Acko', founded:2017, ticker:'', rating:'AA', segment:'Life', specialties:'Term life, digital-first life insurance', desc:'Digital life insurer, part of the Acko group.' },
  'Pramerica Life Insurance Company Limited': { group:'Prudential US', founded:2004, ticker:'', rating:'AA+', segment:'Life', specialties:'Savings, protection, retirement, ULIPs', desc:'A joint venture between Prudential of the US and Dewan Housing Finance (DHFL).' },
  'Shriram Life Insurance Company Limited': { group:'Shriram', founded:2005, ticker:'', rating:'AA', segment:'Life', specialties:'Savings, protection, rural insurance', desc:'A joint venture between Shriram Group and Sanlam Life Insurance.' },
  'Canara HSBC Life Insurance Company Limited': { group:'Canara', founded:2008, ticker:'', rating:'AAA', segment:'Life', specialties:'Savings, protection, retirement, unit-linked', desc:'A joint venture between Canara Bank, HSBC Insurance, and Punjab National Bank.' },
  'IndiaFirst Life Insurance Company Limited': { group:'BoB', founded:2009, ticker:'', rating:'AA+', segment:'Life', specialties:'Savings, protection, retirement', desc:'A joint venture between Bank of Baroda, Union Bank, and Carmel Point Investments.' },
  'Edelweiss Tokio Life Insurance Company Limited': { group:'Edelweiss', founded:2011, ticker:'', rating:'AA', segment:'Life', specialties:'Protection, savings, retirement', desc:'A joint venture between Edelweiss Financial and Tokio Marine.' },
  'Nippon India Life': { group:'Nippon', founded:2001, ticker:'', rating:'AA+', segment:'Life', specialties:'ULIPs, protection, savings, retirement', desc:'Part of Nippon Life Group.' },
};

function lookupCompany(name) {
  if (!name) return null;
  var n = name.trim();
  if (COMPANY_DB[n]) return COMPANY_DB[n];
  var lc = n.toLowerCase();
  for (var key in COMPANY_DB) {
    if (key.toLowerCase().indexOf(lc) !== -1 || lc.indexOf(key.toLowerCase()) !== -1) {
      return COMPANY_DB[key];
    }
  }
  return null;
}

var COMPANY_DOMAINS = {
  'LIC':'licindia.in','HDFC Life Insurance Company Limited':'hdfclife.com',
  'ICICI Prudential Life Insurance Company Limited':'iciciprulife.com',
  'SBI Life Insurance Company Limited':'sbilife.co.in',
  'ICICI Lombard General Insurance Company Limited':'icicilombard.com',
  'The New India Assurance Company Limited':'newindia.co.in',
  'Star Health and Allied Insurance Company Limited':'starhealth.in',
  'Bajaj Allianz General Insurance Company Limited':'bajajallianz.com',
  'National Insurance Company Limited':'nationalinsuranceindia.com',
  'United India Insurance Company Limited':'uiic.co.in',
  'Tata AIG General Insurance Company Limited':'tataaig.com',
  'Go Digit General Insurance Limited':'godigit.com',
  'Acko General Insurance Limited':'acko.com',
  'HDFC ERGO General Insurance Company Limited':'hdfcergo.com',
  'SBI General Insurance Company Limited':'sbigen.com',
  'Max Life Insurance Company Limited':'maxlifeinsurance.com',
  'Tata AIA Life Insurance Company Limited':'tataaia.com',
  'Kotak Mahindra Life Insurance Company Limited':'kotaklifeinsurance.com',
  'Care Health Insurance Company Limited':'careinsurance.com',
  'Bajaj Allianz Life Insurance Company Limited':'bajajallianzlife.com',
};

function getCompanyLogo(name) {
  if (!name) return '';
  var domain = COMPANY_DOMAINS[name] || '';
  if (!domain) {
    var profile = lookupCompany(name);
    var g = (profile && profile.group || '').toLowerCase().replace(/\s+/g, '');
    if (g) domain = g + '.com';
  }
  return domain ? 'https://logo.clearbit.com/' + domain : '';
}

function getStockPrice(ticker) {
  if (!STOCKS || !ticker || !STOCKS.prices[ticker]) return null;
  return STOCKS.prices[ticker];
}

function fitChart() {
  if (chart) chart.timeScale().fitContent();
}

var fullscreenChart = false;
function toggleFullscreenChart() {
  var el = document.querySelector('.chart-panel-body');
  if (!el) return;
  fullscreenChart = !fullscreenChart;
  el.classList.toggle('fullscreen', fullscreenChart);
  setTimeout(function() {
    if (chart) chart.resize(el.clientWidth, el.clientHeight || 300);
  }, 50);
}

// ─── Load ───────────────────────────────────────────────────────────
Promise.all([
  fetch('data/irdai-processed.json').then(function(r) { if (!r.ok) throw new Error('HTTP ' + r.status); return r.json(); }),
  fetch('data/stock-prices.json').then(function(r) { if (!r.ok) return null; return r.json(); }).catch(function() { return null; }),
])
  .then(function(results) {
    DATA = results[0];
    STOCKS = results[1];
    init();
  })
  .catch(function() {
    document.getElementById('dataStatus').textContent = 'ERR';
    document.getElementById('dataStatus').style.color = 'var(--red)';
    document.querySelector('.status-dot').style.background = 'var(--red)';
  });

// ─── Init ───────────────────────────────────────────────────────────
function init() {
  document.body.classList.remove('loading');
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

// ─── Export ─────────────────────────────────────────────────────────
function exportCSV() {
  if (!table) return;
  var rows = table.getData();
  if (!rows.length) return;
  var cols = Object.keys(rows[0]).filter(function(k) { return k !== '_seg' && k !== 'seg'; });
  var csv = cols.map(function(c) { return c.toUpperCase(); }).join(',') + '\n';
  rows.forEach(function(r) {
    csv += cols.map(function(c) {
      var v = r[c];
      if (typeof v === 'string') return '"' + v.replace(/"/g, '""') + '"';
      return v === undefined || v === null ? '' : v;
    }).join(',') + '\n';
  });
  var blob = new Blob([csv], { type: 'text/csv' });
  var a = document.createElement('a');
  a.href = URL.createObjectURL(blob);
  a.download = 'irdai-' + currentView + '-' + new Date().toISOString().slice(0, 10) + '.csv';
  a.click();
  URL.revokeObjectURL(a.href);
  document.getElementById('cmdStatus').textContent = 'Exported ' + rows.length + ' rows';
  setTimeout(function() { document.getElementById('cmdStatus').textContent = '60 insurers tracked'; }, 3000);
}

// ─── Ticker ─────────────────────────────────────────────────────────
function renderTicker() {
  var life = getLifeLatest();
  var nonlife = getNonLifeLatest();

  // Interleave life + non-life insurers
  var maxLen = Math.max(life.insurers.length, nonlife.insurers.length);
  var items = '';
  for (var i = 0; i < maxLen; i++) {
    if (i < life.insurers.length) {
      var li = life.insurers[i];
      items += '<span class="ticker-item">' +
        '<span class="t-sym" style="color:var(--green)">' + li.name.split(' ')[0] + '</span>' +
        '<span class="t-px">' + fmtCr(li.premium_cr) + '</span>' +
        '<span class="t-chg ' + (li.yoy_growth_pct >= 0 ? 'up' : 'dn') + '">' + fmtPct(li.yoy_growth_pct) + '</span>' +
      '</span>';
    }
    if (i < nonlife.insurers.length) {
      var ni = nonlife.insurers[i];
      items += '<span class="ticker-item">' +
        '<span class="t-sym" style="color:var(--cyan)">' + ni.name.split(' ')[0] + '</span>' +
        '<span class="t-px">' + fmtCr(ni.premium_cr) + '</span>' +
        '<span class="t-chg ' + (ni.yoy_growth_pct >= 0 ? 'up' : 'dn') + '">' + fmtPct(ni.yoy_growth_pct) + '</span>' +
      '</span>';
    }
  }

  // Append stock tickers for listed insurers
  if (STOCKS) {
    var stockItems = Object.keys(STOCKS.prices).map(function(t) {
      var p = STOCKS.prices[t];
      return '<span class="ticker-item" style="border-right-color:var(--amber-dim)">' +
        '<span class="t-sym" style="color:var(--amber)">' + t.replace('.NS', '') + '</span>' +
        '<span class="t-px">\u20B9' + p.price.toFixed(1) + '</span>' +
      '</span>';
    }).join('');
    items += stockItems;
  }

  document.getElementById('ticker').innerHTML = items + items;
}

// ─── KPI ────────────────────────────────────────────────────────────
function renderKPI() {
  var s = DATA.summary;
  var kpis = [
    { label: 'TOTAL MARKET', value: '\u20B9' + (s.total_market_premium_cr/1000).toFixed(1) + 'K Cr', sub: 'FY2025-26', color: 'var(--amber)', tip: 'Total insurance premium: \u20B9' + s.total_market_premium_cr.toFixed(0) + ' Cr' },
    { label: 'LIFE PREMIUM', value: '\u20B9' + (s.life_premium_cr/1000).toFixed(1) + 'K Cr', sub: Math.round((s.life_premium_cr/s.total_market_premium_cr)*100) + '% share', color: 'var(--green)', tip: 'Life premium: \u20B9' + s.life_premium_cr.toFixed(0) + ' Cr' },
    { label: 'NON-LIFE', value: '\u20B9' + (s.non_life_premium_cr/1000).toFixed(1) + 'K Cr', sub: Math.round((s.non_life_premium_cr/s.total_market_premium_cr)*100) + '% share', color: 'var(--cyan)', tip: 'Non-life premium: \u20B9' + s.non_life_premium_cr.toFixed(0) + ' Cr' },
    { label: 'PENETRATION', value: s.insurance_penetration_pct + '%', sub: 'Global: ' + s.global_penetration_avg_pct + '%', color: 'var(--purple)', tip: 'Insurance penetration as % of GDP. Global avg: ' + s.global_penetration_avg_pct + '%' },
    { label: 'DENSITY', value: '$' + s.insurance_density_usd, sub: 'Per capita', color: 'var(--orange)', tip: 'Premium per person per year in USD' },
    { label: 'PLAYERS', value: getLifeLatest().insurers.length + getNonLifeLatest().insurers.length, sub: 'Monitored', color: 'var(--pink)', tip: getLifeLatest().insurers.length + ' life + ' + getNonLifeLatest().insurers.length + ' non-life insurers tracked' },
  ];
  document.getElementById('kpiStrip').innerHTML = kpis.map(function(k) {
    return '<div class="kpi-item" title="' + k.tip + '"><div class="kpi-label">' + k.label + '</div><div class="kpi-value" style="color:' + k.color + '">' + k.value + '</div><div class="kpi-sub">' + k.sub + '</div></div>';
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
      var tabKey = el.dataset.tab || el.dataset.panel;
      var target = document.getElementById(tabKey + '-tab');
      if (target) {
        target.classList.add('active');
        // Lazy-render HHI and Movers tabs
        if (tabKey === 'hhi' && typeof renderHHI === 'function') renderHHI();
        if (tabKey === 'movers' && typeof renderMovers === 'function') renderMovers();
      }
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

  // EMA indicator toggle
  var emaBtn = document.querySelector('[data-indicator="ema"]');
  if (emaBtn) {
    emaBtn.addEventListener('click', function() {
      showEMA = !showEMA;
      emaBtn.style.color = showEMA ? 'var(--bg)' : 'var(--amber)';
      emaBtn.style.background = showEMA ? 'var(--amber)' : 'transparent';
      emaBtn.style.borderColor = showEMA ? 'var(--amber)' : 'var(--amber-dim)';
      toggleEMA();
    });
  }

  // Period buttons
  document.querySelectorAll('.period-btn').forEach(function(el) {
    el.addEventListener('click', function() {
      document.querySelectorAll('.period-btn').forEach(function(n) { n.style.borderColor = 'var(--border2)'; });
      el.style.borderColor = 'var(--amber)';
      chartPeriod = el.dataset.period;
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
    if (e.key === '?' || e.key === '/') { e.preventDefault(); showHelp(); }
    if (e.key === 'f' || e.key === 'F') { e.preventDefault(); fitChart(); }
    if (e.key === 'e' || e.key === 'E') { e.preventDefault(); toggleEMAByKey(); }
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
      else if (cmd === 'export') { exportCSV(); }
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
      '<span style="color:var(--cyan)">export</span><span>Download table as CSV</span>' +
      '<span style="color:var(--cyan)">F / fit</span><span>Reset chart zoom</span>' +
      '<span style="color:var(--cyan)">E / ema</span><span>Toggle EMA overlay</span>' +
      '<span style="color:var(--cyan)">? / help</span><span>Show this help</span>' +
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

  // Remove EMA series before destroying chart
  if (emaSeries && chart) { chart.removeSeries(emaSeries); emaSeries = null; }
  showEMA = false;

  if (chart) { chart.remove(); chart = null; chartSeries = []; }

  // Sync chartType with view
  var viewMap = { overview:'all', life:'life', nonlife:'nonlife', compare:'compare' };
  chartType = viewMap[view] || 'all';

  // Sync active filter button
  document.querySelectorAll('[data-tf]').forEach(function(n) {
    n.classList.toggle('active', n.dataset.tf === chartType);
  });
  var emaBtn = document.querySelector('[data-indicator="ema"]');
  if (emaBtn) {
    emaBtn.style.color = 'var(--amber)';
    emaBtn.style.background = 'transparent';
    emaBtn.style.borderColor = 'var(--amber-dim)';
  }

  // Lazy-rendered tabs tracked per view; no reset needed

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
    var profile = lookupCompany(d.name);
    var html =
      '<div style="display:grid;grid-template-columns:100px 1fr;gap:4px 12px;font-size:10px;">' +
        '<span style="color:var(--gray)">Premium</span><span style="color:var(--white)">' + fmtCr(d.premium_cr) + '</span>' +
        '<span style="color:var(--gray)">Market Share</span><span style="color:var(--amber)">' + d.market_share_pct.toFixed(1) + '%</span>' +
        '<span style="color:var(--gray)">YoY Growth</span><span style="color:' + (d.yoy_growth_pct >= 0 ? 'var(--green)' : 'var(--red)') + '">' + fmtPct(d.yoy_growth_pct) + '</span>' +
        '<span style="color:var(--gray)">Rank</span><span>#' + d.rank + '</span>' +
        (d._seg ? '<span style="color:var(--gray)">Segment</span><span>' + d._seg + '</span>' : '') +
      '</div>';
    if (profile) {
      var logoUrl = getCompanyLogo(d.name);
      html +=
        '<div style="margin-top:8px;padding-top:6px;border-top:1px solid var(--border);font-size:9px;">' +
          '<div style="display:flex;align-items:center;gap:6px;margin-bottom:4px;">' +
            (logoUrl ? '<img src="' + logoUrl + '" onerror="this.style.display=\'none\'" style="width:20px;height:20px;border:1px solid var(--border2);border-radius:2px;flex-shrink:0;">' : '') +
            '<div style="color:var(--gray);font-size:8px;letter-spacing:1px;text-transform:uppercase;">COMPANY PROFILE</div>' +
          '</div>' +
          '<div style="display:grid;grid-template-columns:80px 1fr;gap:3px 8px;">' +
            (profile.group ? '<span style="color:var(--gray2)">Group</span><span>' + profile.group + '</span>' : '') +
            (profile.founded ? '<span style="color:var(--gray2)">Founded</span><span>' + profile.founded + '</span>' : '') +
            (profile.ticker ? '<span style="color:var(--gray2)">Ticker</span><span style="color:var(--cyan)">' + profile.ticker + '</span>' : '') +
            (profile.rating ? '<span style="color:var(--gray2)">Rating</span><span style="color:var(--amber)">' + profile.rating + '</span>' : '') +
            (profile.specialties ? '<span style="color:var(--gray2)">Specialties</span><span>' + profile.specialties + '</span>' : '') +
          '</div>' +
          (function() {
            var sp = profile.ticker ? getStockPrice(profile.ticker) : null;
            return sp && sp.price ? (
              '<div style="margin-top:4px;padding-top:4px;border-top:1px solid var(--border);font-size:9px;">' +
                '<div style="display:grid;grid-template-columns:80px 1fr;gap:3px 8px;">' +
                  '<span style="color:var(--gray2)">NSE Price</span><span style="color:var(--amber)">\u20B9' + sp.price.toFixed(2) + '</span>' +
                  '<span style="color:var(--gray2)">Exchange</span><span>' + sp.exchange + '</span>' +
                '</div>' +
              '</div>'
            ) : '';
          })() +
          (profile.desc ? '<div style="margin-top:4px;color:var(--gray2);font-size:8px;line-height:1.5;">' + profile.desc + '</div>' : '') +
        '</div>';
    }
    showPopup(d.name, html);
  });
}

// ─── Chart ──────────────────────────────────────────────────────────
function updateChartData(segment) {
  var container = document.getElementById('trendChart');

  // Remove old resize handler before adding new one
  if (resizeHandler) {
    window.removeEventListener('resize', resizeHandler);
  }

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
      handleScroll: true,
      handleScale: true,
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

  // Deduplicated resize handler
  resizeHandler = function() {
    var r = container.getBoundingClientRect();
    if (r.width > 0 && r.height > 0) chart.resize(r.width, r.height);
  };
  window.addEventListener('resize', resizeHandler);

  // Double-click to fullscreen
  var chartPanel = document.querySelector('.chart-panel-body');
  if (chartPanel && !chartPanel._fullscreenWired) {
    chartPanel._fullscreenWired = true;
    chartPanel.addEventListener('dblclick', function() { toggleFullscreenChart(); });
  }
}

// ─── EMA ────────────────────────────────────────────────────────────
function calcEMA(data, period) {
  if (!data || data.length < period) return null;
  var k = 2 / (period + 1);
  var result = [];
  // First EMA = SMA for first `period` values
  var sum = 0;
  for (var i = 0; i < period; i++) sum += data[i].value;
  var prevEMA = sum / period;
  result.push({ time: data[period - 1].time, value: prevEMA });

  for (var i = period; i < data.length; i++) {
    var ema = data[i].value * k + prevEMA * (1 - k);
    result.push({ time: data[i].time, value: ema });
    prevEMA = ema;
  }
  return result;
}

function toggleEMAByKey() {
  showEMA = !showEMA;
  var emaBtn = document.querySelector('[data-indicator="ema"]');
  if (emaBtn) {
    emaBtn.style.color = showEMA ? 'var(--bg)' : 'var(--amber)';
    emaBtn.style.background = showEMA ? 'var(--amber)' : 'transparent';
    emaBtn.style.borderColor = showEMA ? 'var(--amber)' : 'var(--amber-dim)';
  }
  toggleEMA();
}

function toggleEMA() {
  if (!chart) return;
  if (emaSeries) { chart.removeSeries(emaSeries); emaSeries = null; }
  if (!showEMA) return;

  // Rebuild data from current chartType
  var data;
  if (chartType === 'all' || chartType === 'overview') {
    var nonLifeByMonth = {};
    DATA.non_life.monthly_data.forEach(function(m) { nonLifeByMonth[m.month] = m; });
    data = DATA.life.monthly_data.map(function(m) {
      var non = nonLifeByMonth[m.month];
      if (!non) return null;
      return { time: m.month, value: m.total_premium_cr + non.total_premium_cr };
    }).filter(function(d) { return d !== null; });
  } else if (chartType === 'life') {
    data = DATA.life.monthly_data.map(function(m) { return { time: m.month, value: m.total_premium_cr }; });
  } else if (chartType === 'nonlife') {
    data = DATA.non_life.monthly_data.map(function(m) { return { time: m.month, value: m.total_premium_cr }; });
  } else {
    return; // Skip EMA for compare view
  }

  var emaData = calcEMA(data, 3);
  if (!emaData) return;

  emaSeries = chart.addLineSeries({
    color: '#ff9900',
    lineWidth: 1.5,
    lastValueVisible: true,
    priceFormat: { type: 'volume' },
    lineStyle: 2,
  });
  emaSeries.setData(emaData);
}

function applyPeriod(data) {
  if (chartPeriod === 'all' || !data || !data.length) return data;
  var months = { '1m': 1, '3m': 3, '6m': 6 }[chartPeriod] || 0;
  if (months <= 0) return data;
  return data.slice(-months);
}

function updateChart() {
  if (!chart) return;
  // Remove all existing series
  chartSeries.forEach(function(s) { chart.removeSeries(s); });
  chartSeries = [];

  var data, color;
  if (chartType === 'all' || chartType === 'overview') {
    // Match by month string, not by index (life and non-life may have different months)
    var nonLifeByMonth = {};
    DATA.non_life.monthly_data.forEach(function(m) { nonLifeByMonth[m.month] = m; });
    data = DATA.life.monthly_data.map(function(m) {
      var non = nonLifeByMonth[m.month];
      if (!non) return null;
      return { time: m.month, value: m.total_premium_cr + non.total_premium_cr };
    }).filter(function(d) { return d !== null; });
    // If no aligned months, fall back to combining all unique months
    if (!data.length) {
      var allMonths = {};
      DATA.life.monthly_data.concat(DATA.non_life.monthly_data).forEach(function(m) {
        allMonths[m.month] = (allMonths[m.month] || 0) + m.total_premium_cr;
      });
      data = Object.keys(allMonths).sort().map(function(t) { return { time: t, value: allMonths[t] }; });
    }
    color = '#ff9900';
  } else if (chartType === 'life') {
    data = DATA.life.monthly_data.map(function(m) { return { time: m.month, value: m.total_premium_cr }; });
    color = '#00cc44';
  } else if (chartType === 'nonlife') {
    data = DATA.non_life.monthly_data.map(function(m) { return { time: m.month, value: m.total_premium_cr }; });
    color = '#00ccff';
  } else if (chartType === 'compare') {
    // Two series: Life and Non-Life
    var lifeData = DATA.life.monthly_data;
    var nonData = DATA.non_life.monthly_data;

    var lifePoints = lifeData.map(function(m) { return { time: m.month, value: m.total_premium_cr }; });
    lifePoints = applyPeriod(lifePoints);
    var lifeSeries = chart.addAreaSeries({
      lineColor: '#00cc44',
      topColor: '#00cc4420',
      bottomColor: '#00cc4405',
      lineWidth: 1,
      lastValueVisible: true,
      priceFormat: { type: 'volume' },
    });
    lifeSeries.setData(lifePoints);
    chartSeries.push(lifeSeries);

    var nonPoints = nonData.map(function(m) { return { time: m.month, value: m.total_premium_cr }; });
    nonPoints = applyPeriod(nonPoints);
    var nonSeries = chart.addAreaSeries({
      lineColor: '#00ccff',
      topColor: '#00ccff20',
      bottomColor: '#00ccff05',
      lineWidth: 1,
      lastValueVisible: true,
      priceFormat: { type: 'volume' },
    });
    nonSeries.setData(nonPoints);
    chartSeries.push(nonSeries);

    chart.timeScale().fitContent();
    return;
  }

  data = applyPeriod(data);
  var series = chart.addAreaSeries({
    lineColor: color,
    topColor: color + '20',
    bottomColor: color + '05',
    lineWidth: 1.5,
    lastValueVisible: true,
    priceFormat: { type: 'volume' },
  });
  series.setData(data);
  chartSeries.push(series);
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

// ─── HHI / Concentration Tab ────────────────────────────────────────
function renderHHI() {
  var tabKey = currentView + '-hhi';
  if (renderedTabs[tabKey]) return;
  renderedTabs[tabKey] = true;

  var life = getLifeLatest();
  var nonlife = getNonLifeLatest();

  function calcHHI(insurers) {
    var hhi = 0;
    insurers.forEach(function(i) { hhi += i.market_share_pct * i.market_share_pct; });
    return hhi;
  }

  function getConcentrationLevel(hhi) {
    if (hhi < 1500) return { label: 'COMPETITIVE', color: 'var(--green)' };
    if (hhi < 2500) return { label: 'MODERATELY CONCENTRATED', color: 'var(--amber)' };
    return { label: 'HIGHLY CONCENTRATED', color: 'var(--red)' };
  }

  var lifeHHI = calcHHI(life.insurers);
  var nonLifeHHI = calcHHI(nonlife.insurers);
  var lifeLevel = getConcentrationLevel(lifeHHI);
  var nonLifeLevel = getConcentrationLevel(nonLifeHHI);

  function topContributors(insurers, n) {
    return insurers.slice().sort(function(a, b) {
      return b.market_share_pct - a.market_share_pct;
    }).slice(0, n);
  }

  var html =
    '<div class="insight-grid">' +
      '<div class="insight-card">' +
        '<div class="label">LIFE HHI</div>' +
        '<div class="value" style="color:' + lifeLevel.color + '">' + lifeHHI.toFixed(1) + '</div>' +
        '<div class="desc">' + lifeLevel.label + '</div>' +
      '</div>' +
      '<div class="insight-card">' +
        '<div class="label">NON-LIFE HHI</div>' +
        '<div class="value" style="color:' + nonLifeLevel.color + '">' + nonLifeHHI.toFixed(1) + '</div>' +
        '<div class="desc">' + nonLifeLevel.label + '</div>' +
      '</div>' +
    '</div>' +
    '<div style="margin-bottom:4px;font-size:7px;color:var(--gray2);letter-spacing:0.5px;">Herfindahl-Hirschman Index = sum of squared market shares. &lt;1500 = competitive, 1500-2500 = moderate, &gt;2500 = concentrated.</div>' +
    '<div class="section-label">TOP CONTRIBUTORS TO LIFE CONCENTRATION</div>';

  var lifeTop = topContributors(life.insurers, 5);
  lifeTop.forEach(function(i, idx) {
    html += '<div class="player-row">' +
      '<span class="player-rank">#' + (idx + 1) + '</span>' +
      '<span class="player-name">' + i.name.split(' ').slice(0, 2).join(' ') + '</span>' +
      '<span class="player-share" style="color:var(--green)">' + i.market_share_pct.toFixed(1) + '%</span>' +
      '<span style="font-size:8px;color:var(--gray)">' + (i.market_share_pct * i.market_share_pct).toFixed(1) + '</span>' +
    '</div>';
  });

  html += '<div class="section-label" style="margin-top:4px;">TOP CONTRIBUTORS TO NON-LIFE CONCENTRATION</div>';
  var nonLifeTop = topContributors(nonlife.insurers, 5);
  nonLifeTop.forEach(function(i, idx) {
    html += '<div class="player-row">' +
      '<span class="player-rank">#' + (idx + 1) + '</span>' +
      '<span class="player-name">' + i.name.split(' ').slice(0, 2).join(' ') + '</span>' +
      '<span class="player-share" style="color:var(--cyan)">' + i.market_share_pct.toFixed(1) + '%</span>' +
      '<span style="font-size:8px;color:var(--gray)">' + (i.market_share_pct * i.market_share_pct).toFixed(1) + '</span>' +
    '</div>';
  });

  document.getElementById('hhiContainer').innerHTML = html;
}

// ─── Movers Tab ─────────────────────────────────────────────────────
function renderMovers() {
  var tabKey = currentView + '-movers';
  if (renderedTabs[tabKey]) return;
  renderedTabs[tabKey] = true;

  var life = getLifeLatest();
  var nonlife = getNonLifeLatest();

  var all = life.insurers.map(function(i) { return Object.assign({}, i, { _seg: 'Life' }); })
    .concat(nonlife.insurers.map(function(i) { return Object.assign({}, i, { _seg: 'Non-Life' }); }));

  var sorted = all.slice().sort(function(a, b) { return b.yoy_growth_pct - a.yoy_growth_pct; });

  var top5 = sorted.slice(0, 5);
  var bottom5 = sorted.slice(-5).reverse();

  var html = '<div class="section-label">TOP 5 — FASTEST GROWING</div>';
  top5.forEach(function(i, idx) {
    var segColor = i._seg === 'Life' ? 'var(--green)' : 'var(--cyan)';
    html += '<div class="player-row">' +
      '<span class="player-rank">#' + (idx + 1) + '</span>' +
      '<span class="player-name">' + i.name + '</span>' +
      '<span style="color:' + segColor + ';font-size:8px;width:50px">' + i._seg + '</span>' +
      '<span class="player-growth up">' + fmtPct(i.yoy_growth_pct) + '</span>' +
    '</div>';
  });

  html += '<div class="section-label" style="margin-top:6px;">BOTTOM 5 — FASTEST SHRINKING</div>';
  bottom5.forEach(function(i, idx) {
    var segColor = i._seg === 'Life' ? 'var(--green)' : 'var(--cyan)';
    html += '<div class="player-row">' +
      '<span class="player-rank">#' + (idx + 1) + '</span>' +
      '<span class="player-name">' + i.name + '</span>' +
      '<span style="color:' + segColor + ';font-size:8px;width:50px">' + i._seg + '</span>' +
      '<span class="player-growth dn">' + fmtPct(i.yoy_growth_pct) + '</span>' +
    '</div>';
  });

  document.getElementById('moversContainer').innerHTML = html;
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
