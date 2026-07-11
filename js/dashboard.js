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
let selectedMonth = null;
let viewMonthSelection = {};
let comparisonMode = false;
let comparisonCompanies = [];
var demoMode = false;
var demoInterval = null;
const WATCHLIST_KEY = 'irdai_watchlist';
let watchlist = loadWatchlist();
const SAVED_VIEWS_KEY = 'irdai_saved_views';
let savedViews = loadSavedViews();
const ALERT_CONFIG_KEY = 'irdai_alert_config';
const DEFAULT_ALERT_CONFIG = {
  riskDropPct: -10,
  growthSurgePct: 20,
  shareMovePp: 1,
  watchGrowthPct: 10,
  watchShareMovePp: 0.5,
};
let alertConfig = loadAlertConfig();
const COMMAND_HISTORY_KEY = 'irdai_command_history';
const COMMAND_REGISTRY = [
  { code: 'HELP', label: 'Open command palette' },
  { code: 'MKT', label: 'Market overview' },
  { code: 'TOPLIFE', label: 'Top life insurers' },
  { code: 'TOPNL', label: 'Top non-life insurers' },
  { code: 'TOPALL', label: 'Top insurers across segments' },
  { code: 'FIND <name>', label: 'Search table and profiles' },
  { code: 'COMPARE <a> VS <b>', label: 'Company comparison' },
  { code: 'WLIST', label: 'Watchlist monitor' },
  { code: 'ALERTS', label: 'Alert thresholds' },
  { code: 'AUDIT', label: 'Data quality audit' },
  { code: 'EXPORTAUDIT', label: 'Download audit pack' },
  { code: 'VIEW <name>', label: 'Load saved view' },
];
let commandHistory = loadCommandHistory();
let commandHistoryIndex = -1;

var FIELD_MAP = {
  premium: 'premium_cr',
  share: 'market_share_pct',
  growth: 'yoy_growth_pct',
  share_chg_pp: 'share_chg_pp',
  cagr_3m: 'cagr_3m',
  rank: 'rank',
  name: 'name',
  segment: 'seg',
  seg: 'seg',
};

function getAvailableMonths() {
  if (!DATA) return [];
  var months = {};
  DATA.life.monthly_data.concat(DATA.non_life.monthly_data).forEach(function(m) { months[m.month] = true; });
  return Object.keys(months).sort();
}

function getSharedMonths() {
  if (!DATA) return [];
  var lifeMonths = {};
  DATA.life.monthly_data.forEach(function(m) { lifeMonths[m.month] = true; });
  return DATA.non_life.monthly_data.filter(function(m) { return lifeMonths[m.month]; }).map(function(m) { return m.month; }).sort();
}

function getMonthData(segment, month) {
  if (!DATA || !DATA[segment]) return null;
  var m = month || selectedMonth;
  if (!m) return DATA[segment].monthly_data[DATA[segment].monthly_data.length - 1];
  for (var i = 0; i < DATA[segment].monthly_data.length; i++) {
    if (DATA[segment].monthly_data[i].month === m) return DATA[segment].monthly_data[i];
  }
  return null;
}

function getMonthDataOrLatest(segment, month) {
  var result = getMonthData(segment, month);
  if (result) return result;
  return DATA && DATA[segment] ? DATA[segment].monthly_data[DATA[segment].monthly_data.length - 1] : null;
}

function getLatestSegmentMonth(segment) {
  if (!DATA || !DATA[segment] || !DATA[segment].monthly_data.length) return null;
  return DATA[segment].monthly_data[DATA[segment].monthly_data.length - 1];
}

function getSharedMonthPair(month) {
  if (!DATA) return { month: null, life: null, nonlife: null };
  var months = getSharedMonths();
  if (!months.length) return { month: null, life: null, nonlife: null };
  var target = month && months.indexOf(month) !== -1 ? month : (DATA._meta && DATA._meta.latest_shared_month) || months[months.length - 1];
  if (months.indexOf(target) === -1) target = months[months.length - 1];
  return {
    month: target,
    life: getMonthData('life', target),
    nonlife: getMonthData('non_life', target),
  };
}

function sortByPremium(arr) {
  return (arr || []).slice().sort(function(a, b) { return b.premium_cr - a.premium_cr; });
}

function shortName(name) {
  if (!name) return '--';
  if (name === 'Life Insurance Corporation of India') return 'LIC';
  if (name === 'New India Assurance') return 'New India';
  return name.split(' ').slice(0, 2).join(' ');
}

function segmentDisplayLabel(segment) {
  if (segment === 'non_life' || segment === 'nonlife') return 'Non-Life';
  if (segment === 'life') return 'Life';
  return String(segment || '').replace(/_/g, ' ');
}

function escapeHtml(value) {
  return String(value == null ? '' : value).replace(/[&<>"']/g, function(ch) {
    return ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[ch];
  });
}

function loadWatchlist() {
  try {
    var parsed = JSON.parse(localStorage.getItem(WATCHLIST_KEY) || '[]');
    return Array.isArray(parsed) ? parsed.filter(function(name) { return typeof name === 'string' && name.trim(); }) : [];
  } catch(e) {
    return [];
  }
}

function saveWatchlist() {
  watchlist = watchlist.filter(function(name, idx, arr) { return name && arr.indexOf(name) === idx; }).sort();
  try { localStorage.setItem(WATCHLIST_KEY, JSON.stringify(watchlist)); } catch(e) {}
}

function normalizeAlertConfig(candidate) {
  var config = Object.assign({}, DEFAULT_ALERT_CONFIG);
  Object.keys(DEFAULT_ALERT_CONFIG).forEach(function(key) {
    var value = candidate && Number(candidate[key]);
    if (Number.isFinite(value)) config[key] = value;
  });
  config.riskDropPct = -Math.abs(config.riskDropPct);
  config.shareMovePp = Math.abs(config.shareMovePp);
  config.watchGrowthPct = Math.abs(config.watchGrowthPct);
  config.watchShareMovePp = Math.abs(config.watchShareMovePp);
  return config;
}

function loadAlertConfig() {
  try {
    return normalizeAlertConfig(JSON.parse(localStorage.getItem(ALERT_CONFIG_KEY) || '{}'));
  } catch(e) {
    return normalizeAlertConfig({});
  }
}

function saveAlertConfig() {
  alertConfig = normalizeAlertConfig(alertConfig);
  try { localStorage.setItem(ALERT_CONFIG_KEY, JSON.stringify(alertConfig)); } catch(e) {}
}

function setAlertThreshold(kind, value) {
  var parsed = Number(value);
  if (!Number.isFinite(parsed)) return null;
  var map = {
    growth: { key: 'growthSurgePct', label: 'Growth surge', value: Math.abs(parsed), suffix: '%' },
    surge: { key: 'growthSurgePct', label: 'Growth surge', value: Math.abs(parsed), suffix: '%' },
    risk: { key: 'riskDropPct', label: 'Risk drop', value: -Math.abs(parsed), suffix: '%' },
    drop: { key: 'riskDropPct', label: 'Risk drop', value: -Math.abs(parsed), suffix: '%' },
    share: { key: 'shareMovePp', label: 'Share move', value: Math.abs(parsed), suffix: 'pp' },
    watch: { key: 'watchGrowthPct', label: 'Watch growth', value: Math.abs(parsed), suffix: '%' },
  };
  var target = map[kind];
  if (!target) return null;
  alertConfig[target.key] = target.value;
  saveAlertConfig();
  renderWatchlistMonitor();
  return target;
}

function formatAlertConfigHtml() {
  return '<strong class="c-amb">Alert Configuration</strong><br>' +
    'Growth surge: ' + escapeHtml(alertConfig.growthSurgePct) + '%<br>' +
    'Risk drop: ' + escapeHtml(alertConfig.riskDropPct) + '%<br>' +
    'Share move: ±' + escapeHtml(alertConfig.shareMovePp) + 'pp<br>' +
    'Watch growth: ' + escapeHtml(alertConfig.watchGrowthPct) + '%<br>' +
    'Watch share move: ±' + escapeHtml(alertConfig.watchShareMovePp) + 'pp<br>' +
    '<span class="c-gry">Commands: set alert growth 12, set alert risk 8, set alert share 0.75, reset alerts.</span>';
}

function showChatAlertConfig() {
  chatSay(formatAlertConfigHtml(), false);
}

function loadCommandHistory() {
  try {
    var parsed = JSON.parse(localStorage.getItem(COMMAND_HISTORY_KEY) || '[]');
    return Array.isArray(parsed) ? parsed.filter(function(item) { return typeof item === 'string' && item.trim(); }).slice(0, 30) : [];
  } catch(e) {
    return [];
  }
}

function saveCommandHistory() {
  try { localStorage.setItem(COMMAND_HISTORY_KEY, JSON.stringify(commandHistory.slice(0, 30))); } catch(e) {}
}

function rememberCommand(raw) {
  var command = String(raw || '').trim();
  if (!command) return;
  commandHistory = commandHistory.filter(function(item) { return item !== command; });
  commandHistory.unshift(command);
  commandHistory = commandHistory.slice(0, 30);
  commandHistoryIndex = -1;
  saveCommandHistory();
}

function recallCommandHistory(direction, input) {
  if (!input || !commandHistory.length) return false;
  if (direction < 0) {
    commandHistoryIndex = Math.min(commandHistoryIndex + 1, commandHistory.length - 1);
  } else {
    commandHistoryIndex = Math.max(commandHistoryIndex - 1, -1);
  }
  input.value = commandHistoryIndex === -1 ? '' : commandHistory[commandHistoryIndex];
  input.setSelectionRange(input.value.length, input.value.length);
  return true;
}

function showCommandPalette() {
  var html = '<strong class="c-amb">COMMANDS</strong><br>' +
    '<span class="c-gry">Press Ctrl+K to focus this line. Use ArrowUp / ArrowDown for command history.</span><br>';
  COMMAND_REGISTRY.forEach(function(cmd) {
    html += '<div class="command-row"><span class="command-code">' + escapeHtml(cmd.code) + '</span><span>' + escapeHtml(cmd.label) + '</span></div>';
  });
  if (commandHistory.length) {
    html += '<br><strong class="c-amb">RECENT</strong><br>';
    commandHistory.slice(0, 5).forEach(function(item) {
      html += '<span class="command-code">' + escapeHtml(item) + '</span> ';
    });
  }
  chatSay(html, false);
}

function runMnemonicCommand(raw) {
  var text = String(raw || '').trim();
  var upper = text.toUpperCase();
  if (upper === 'HELP' || upper === 'COMMANDS' || upper === 'CMDS') { showCommandPalette(); return true; }
  if (upper === 'MKT' || upper === 'MARKET') { switchView('overview'); showChatMarketOverview(); return true; }
  if (upper === 'TOPLIFE') { selectedMonth = null; switchView('life'); showChatTopCompanies('top 5 life'); return true; }
  if (upper === 'TOPNL' || upper === 'TOPNONLIFE') { selectedMonth = null; switchView('nonlife'); showChatTopCompanies('top 5 non life'); return true; }
  if (upper === 'TOPALL') { switchView('overview'); showChatTopCompanies('top 5'); return true; }
  if (upper === 'WLIST' || upper === 'WATCH') { showChatWatchlist(); return true; }
  if (upper === 'ALERTS') { showChatAlertConfig(); return true; }
  if (upper === 'AUDIT' || upper === 'SOURCES') { showAudit(); return true; }
  if (upper === 'EXPORTAUDIT') {
    try { exportAuditPack(); } catch(e) { chatSay('Could not export the audit pack.', false); }
    return true;
  }
  if (upper.indexOf('FIND ') === 0) {
    var q = text.slice(5).trim();
    if (q) {
      applySearchFilter(q);
      chatSay('Table filtered for <strong>' + escapeHtml(q) + '</strong>. Type <strong>clear</strong> to reset.', false);
    }
    return true;
  }
  if (upper.indexOf('VIEW ') === 0) {
    var loadedPreset = applySavedViewPreset(text.slice(5).trim());
    if (loadedPreset) chatSay('Loaded view <strong>' + escapeHtml(loadedPreset.name) + '</strong>.', false);
    else chatSay('No saved view named <strong>' + escapeHtml(text.slice(5).trim()) + '</strong>. Type <strong>views</strong> to list presets.', false);
    return true;
  }
  if (upper.indexOf('COMPARE ') === 0) {
    var compareText = text.slice(8).trim();
    var compareMatch = compareText.match(/(.+?)\s+(?:vs|versus|and|,)\s+(.+)/i);
    if (compareMatch) startCompanyComparison(compareMatch[1].trim(), compareMatch[2].trim());
    else chatSay('Use <strong>COMPARE LIC VS HDFC Life</strong>.', false);
    return true;
  }
  return false;
}

function isWatched(name) {
  return watchlist.indexOf(name) !== -1;
}

function toggleWatchlist(name) {
  if (!name) return false;
  var idx = watchlist.indexOf(name);
  if (idx === -1) watchlist.push(name);
  else watchlist.splice(idx, 1);
  saveWatchlist();
  if (table) table.redraw(true);
  renderWatchlistMonitor();
  return isWatched(name);
}

function findLatestCompanyRow(name) {
  if (!DATA || !name) return null;
  var latestLife = getLatestSegmentMonth('life');
  var latestNonLife = getLatestSegmentMonth('non_life');
  var pools = [
    { key: 'life', label: 'Life', month: latestLife },
    { key: 'non_life', label: 'Non-Life', month: latestNonLife },
  ];
  for (var p = 0; p < pools.length; p++) {
    var pool = pools[p];
    if (!pool.month) continue;
    var enriched = enrichInsurers(pool.month.insurers, pool.key, pool.month.month);
    for (var i = 0; i < enriched.length; i++) {
      if (enriched[i].name === name) {
        return Object.assign({}, enriched[i], { _seg: pool.label, seg: pool.label, _month: pool.month.month });
      }
    }
  }
  return null;
}

function getWatchlistAlerts() {
  if (!DATA || !watchlist.length) return [];
  var scope = getActiveAnalysisScope();
  var inScopeByName = {};
  scope.rows.forEach(function(row) { inScopeByName[row.name] = row; });
  var config = normalizeAlertConfig(alertConfig);

  return watchlist.map(function(name) {
    var row = inScopeByName[name] || findLatestCompanyRow(name);
    if (!row) return null;
    var growth = row.yoy_growth_pct;
    var shareMove = row.share_chg_pp;
    var severity = 'neutral';
    var reason = 'steady';
    if (growth <= config.riskDropPct || shareMove <= -config.shareMovePp) {
      severity = 'risk';
      reason = growth <= config.riskDropPct ? 'YoY contraction' : 'share loss';
    } else if (growth >= config.growthSurgePct || shareMove >= config.shareMovePp) {
      severity = 'surge';
      reason = growth >= config.growthSurgePct ? 'growth surge' : 'share gain';
    } else if (growth >= config.watchGrowthPct || shareMove >= config.watchShareMovePp || growth <= -(config.watchGrowthPct / 2) || shareMove <= -config.watchShareMovePp) {
      severity = 'watch';
      reason = growth < 0 || shareMove < 0 ? 'softening' : 'momentum';
    }
    return Object.assign({}, row, { _alertSeverity: severity, _alertReason: reason });
  }).filter(Boolean).sort(function(a, b) {
    var rank = { risk: 0, surge: 1, watch: 2, neutral: 3 };
    return rank[a._alertSeverity] - rank[b._alertSeverity] || Math.abs(b.yoy_growth_pct || 0) - Math.abs(a.yoy_growth_pct || 0);
  });
}

function renderWatchlistMonitorHtml() {
  var alerts = getWatchlistAlerts();
  var count = watchlist.length;
  var body = '';
  if (!count) {
    body = '<div class="watchlist-empty">No saved insurers. Use the star column or type "watch LIC".</div>';
  } else if (!alerts.length) {
    body = '<div class="watchlist-empty">' + count + ' saved insurer' + (count === 1 ? '' : 's') + ', but none are visible in the loaded data.</div>';
  } else {
    body = alerts.slice(0, 6).map(function(row) {
      var cls = row._alertSeverity;
      var segColor = row._seg === 'Life' ? 'var(--green)' : 'var(--cyan)';
      return '<div class="watchlist-alert ' + cls + '">' +
        '<span class="watchlist-name">' + escapeHtml(shortName(row.name)) + '</span>' +
        '<span style="color:' + segColor + '">' + escapeHtml(row._seg || row.seg || '--') + '</span>' +
        '<span>' + fmtCr(row.premium_cr) + '</span>' +
        '<span class="' + ((row.yoy_growth_pct || 0) >= 0 ? 'up' : 'dn') + '">' + fmtPct(row.yoy_growth_pct) + '</span>' +
        '<span>' + escapeHtml(row._alertReason) + '</span>' +
      '</div>';
    }).join('');
  }
  return '<div class="insight-card watchlist-monitor" id="watchlistMonitor">' +
    '<div class="label">Watchlist Monitor</div>' +
    '<div class="value" style="color:var(--amber)">' + count + ' saved</div>' +
    '<div class="desc">Local monitor · risk ≤ ' + escapeHtml(alertConfig.riskDropPct) + '% YoY, surge ≥ ' + escapeHtml(alertConfig.growthSurgePct) + '% YoY, share ±' + escapeHtml(alertConfig.shareMovePp) + 'pp</div>' +
    '<div class="watchlist-alerts">' + body + '</div>' +
  '</div>';
}

function renderWatchlistMonitor() {
  var el = document.getElementById('watchlistMonitor');
  if (el) el.outerHTML = renderWatchlistMonitorHtml();
}

function normalizeSavedViewName(name) {
  return String(name || '').trim().replace(/\s+/g, ' ').toLowerCase().slice(0, 48);
}

function loadSavedViews() {
  try {
    var parsed = JSON.parse(localStorage.getItem(SAVED_VIEWS_KEY) || '{}');
    return parsed && typeof parsed === 'object' && !Array.isArray(parsed) ? parsed : {};
  } catch(e) {
    return {};
  }
}

function saveSavedViews() {
  try { localStorage.setItem(SAVED_VIEWS_KEY, JSON.stringify(savedViews)); } catch(e) {}
}

function syncPeriodButtons() {
  document.querySelectorAll('.period-btn').forEach(function(el) {
    el.style.borderColor = el.dataset.period === chartPeriod ? 'var(--amber)' : 'var(--border2)';
  });
}

function captureSavedView(name) {
  var key = normalizeSavedViewName(name);
  if (!key) return null;
  return {
    version: 1,
    name: key,
    view: currentView,
    selectedMonth: selectedMonth,
    chartPeriod: chartPeriod,
    watchlist: watchlist.slice(),
    savedAt: new Date().toISOString(),
  };
}

function saveCurrentViewPreset(name) {
  var preset = captureSavedView(name);
  if (!preset) return null;
  savedViews[preset.name] = preset;
  saveSavedViews();
  return preset;
}

function getSavedViewPreset(name) {
  return savedViews[normalizeSavedViewName(name)] || null;
}

function applySavedViewPreset(name) {
  var preset = getSavedViewPreset(name);
  if (!preset) return null;
  if (Array.isArray(preset.watchlist)) {
    watchlist = preset.watchlist.filter(function(item) { return typeof item === 'string' && item.trim(); });
    saveWatchlist();
  }
  chartPeriod = preset.chartPeriod || 'all';
  if (preset.view) {
    viewMonthSelection[preset.view] = preset.selectedMonth || null;
    selectedMonth = preset.selectedMonth || null;
    switchView(preset.view);
  }
  syncPeriodButtons();
  renderWatchlistMonitor();
  return preset;
}

function deleteSavedViewPreset(name) {
  var key = normalizeSavedViewName(name);
  if (!savedViews[key]) return false;
  delete savedViews[key];
  saveSavedViews();
  return true;
}

function formatSavedViewLine(preset) {
  return '<strong>' + escapeHtml(preset.name) + '</strong> — ' +
    escapeHtml(preset.view || '--') + ', ' +
    escapeHtml(preset.selectedMonth || 'latest') + ', ' +
    escapeHtml((preset.watchlist || []).length + ' watched');
}

function getActiveAnalysisScope() {
  var scope = {
    view: currentView,
    label: 'Comparable Market',
    period: selectedMonth || '--',
    segments: [],
    rows: [],
  };

  function addSegment(key, label, monthData, color) {
    if (!monthData) return;
    var enriched = enrichInsurers(monthData.insurers, key, monthData.month).map(function(i) {
      return Object.assign({}, i, { _seg: label, seg: label, _month: monthData.month });
    });
    scope.segments.push({
      key: key,
      label: label,
      color: color,
      month: monthData.month,
      total_premium_cr: monthData.total_premium_cr,
      total_growth_pct: monthData.total_growth_pct,
      insurers: enriched,
      source_file: monthData.source_file,
      period_type: monthData.period_type,
    });
    scope.rows = scope.rows.concat(enriched);
  }

  if (currentView === 'life') {
    var life = getMonthData('life', selectedMonth) || getLatestSegmentMonth('life');
    scope.label = 'Life Insurance';
    scope.period = life ? life.month : '--';
    addSegment('life', 'Life', life, 'var(--green)');
  } else if (currentView === 'nonlife') {
    var nonlife = getMonthData('non_life', selectedMonth) || getLatestSegmentMonth('non_life');
    scope.label = 'Non-Life Insurance';
    scope.period = nonlife ? nonlife.month : '--';
    addSegment('non_life', 'Non-Life', nonlife, 'var(--cyan)');
  } else {
    var pair = getSharedMonthPair(selectedMonth);
    scope.label = currentView === 'compare' ? 'Life vs Non-Life' : 'Comparable Market';
    scope.period = pair.month ? pair.month + ' shared' : '--';
    addSegment('life', 'Life', pair.life, 'var(--green)');
    addSegment('non_life', 'Non-Life', pair.nonlife, 'var(--cyan)');
  }

  return scope;
}

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

function getMonthsForView(view) {
  if (!DATA) return [];
  var months = view === 'life' ? DATA.life.monthly_data.map(function(m) { return m.month; }).sort()
    : view === 'nonlife' ? DATA.non_life.monthly_data.map(function(m) { return m.month; }).sort()
    : getSharedMonths();
  return months.length ? months : getAvailableMonths();
}

function getDefaultMonthForView(view, months) {
  if (!months.length) return null;
  var meta = DATA && DATA._meta ? DATA._meta : {};
  var candidate = view === 'life' ? meta.latest_life_month
    : view === 'nonlife' ? meta.latest_non_life_month
    : meta.latest_shared_month;
  return candidate && months.indexOf(candidate) !== -1 ? candidate : months[months.length - 1];
}

function renderMonthSelector() {
  var sel = document.getElementById('monthSelect');
  if (!sel || !DATA) return;
  var months = getMonthsForView(currentView);
  var remembered = viewMonthSelection[currentView];
  var activeMonth = remembered && months.indexOf(remembered) !== -1 ? remembered : getDefaultMonthForView(currentView, months);
  selectedMonth = activeMonth || null;
  viewMonthSelection[currentView] = selectedMonth;
  sel.innerHTML = months.map(function(m) {
    var label = m;
    var isSelected = (m === activeMonth);
    var isLatest = (m === months[months.length - 1]);
    return '<option value="' + m + '"' + (isSelected ? ' selected' : '') + '>' + label + (isLatest ? ' (Latest)' : '') + '</option>';
  }).join('');
}

function changeMonth(month) {
  selectedMonth = month || null;
  viewMonthSelection[currentView] = selectedMonth;
  renderView(currentView);
}

function fitChart() {
  if (chart) chart.timeScale().fitContent();
}

function showSplash() {
  var s = DATA ? DATA.summary : {};
  var pair = getSharedMonthPair(DATA && DATA._meta ? DATA._meta.latest_shared_month : null);
  var life = pair.life;
  var nonlife = pair.nonlife;
  var total = life && nonlife ? life.total_premium_cr + nonlife.total_premium_cr : (s.total_market_premium_cr || 0);
  var meta = DATA && DATA._meta ? DATA._meta : {};
  showPopup('IRDAI INDIAN INSURANCE MARKET ' + (pair.month || ''),
    '<div style="font-size:10px;line-height:1.6;">' +
      '<div style="color:var(--amber);font-size:14px;font-weight:700;letter-spacing:2px;margin-bottom:6px;">INDIAN INSURANCE TERMINAL</div>' +
      '<div style="color:var(--gray);font-size:8px;margin-bottom:8px;">IRDAI Flash Figures · Integrated NSE Data · Market-terminal interface</div>' +
      '<div style="display:grid;grid-template-columns:1fr 1fr;gap:4px 12px;font-size:9px;margin-bottom:6px;">' +
        '<span style="color:var(--gray2)">Comparable Month</span><span style="color:var(--amber)">' + (pair.month || '--') + '</span>' +
        '<span style="color:var(--gray2)">Total Market</span><span style="color:var(--amber)">\u20B9' + (total/1000).toFixed(1) + 'K Cr</span>' +
        '<span style="color:var(--gray2)">Life Premium</span><span style="color:var(--green)">\u20B9' + (life ? life.total_premium_cr.toFixed(0) : '--') + ' Cr</span>' +
        '<span style="color:var(--gray2)">Non-Life Premium</span><span style="color:var(--cyan)">\u20B9' + (nonlife ? nonlife.total_premium_cr.toFixed(0) : '--') + ' Cr</span>' +
        '<span style="color:var(--gray2)">Penetration</span><span style="color:var(--purple)">' + s.insurance_penetration_pct + '% (Global: ' + s.global_penetration_avg_pct + '%)</span>' +
        '<span style="color:var(--gray2)">Density</span><span style="color:var(--orange)">$' + s.insurance_density_usd + '/capita</span>' +
        '<span style="color:var(--gray2)">Latest Life</span><span style="color:var(--green)">' + (meta.latest_life_month || '--') + '</span>' +
        '<span style="color:var(--gray2)">Latest Non-Life</span><span style="color:var(--cyan)">' + (meta.latest_non_life_month || '--') + '</span>' +
        '<span style="color:var(--gray2)">NSE Stocks</span><span style="color:var(--amber)">' + (STOCKS ? Object.keys(STOCKS.prices).length : 0) + '</span>' +
        '<span style="color:var(--gray2)">Data Months</span><span>' + getAvailableMonths().length + '</span>' +
      '</div>' +
      '<div style="color:var(--gray2);font-size:7px;border-top:1px solid var(--border);padding-top:4px;">Press ? for commands · 1-4 for views · I for this screen · Double-click chart for fullscreen</div>' +
    '</div>'
  );
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

// ─── Cache ──────────────────────────────────────────────────────────
function cacheSave(key, data) {
  try { localStorage.setItem('irdai_' + key, JSON.stringify({ t: Date.now(), d: data })); } catch(e) {}
}
function cacheLoad(key, maxAgeMs) {
  try {
    var raw = localStorage.getItem('irdai_' + key);
    if (!raw) return null;
    var parsed = JSON.parse(raw);
    if (Date.now() - parsed.t > maxAgeMs) return null;
    return parsed.d;
  } catch(e) { return null; }
}

// ─── Load ───────────────────────────────────────────────────────────
var cachedData = cacheLoad('data', 3600000); // 1 hour cache
var cachedStocks = cacheLoad('stocks', 600000); // 10 min cache
var cachedBrief = cacheLoad('brief', 3600000);

if (cachedData) {
  DATA = cachedData;
  STOCKS = cachedStocks;
  if (cachedBrief) window._briefMd = cachedBrief;
  updateDataStatus('snapshot');
  init();
  // Still fetch fresh data in background
}

Promise.all([
  fetch('data/irdai-processed.json').then(function(r) { if (!r.ok) throw new Error('HTTP ' + r.status); return r.json(); }),
  fetch('data/stock-prices.json').then(function(r) { if (!r.ok) return null; return r.json(); }).catch(function() { return null; }),
  fetch('data/analysis_summary.md').then(function(r) { if (!r.ok) return null; return r.text(); }).catch(function() { return null; }),
])
  .then(function(results) {
    DATA = results[0];
    STOCKS = results[1];
    cacheSave('data', DATA);
    cacheSave('stocks', STOCKS);
    if (results[2]) { window._briefMd = results[2]; cacheSave('brief', results[2]); }
    if (!cachedData) init();
    else {
      // Re-render with fresh data
      document.body.classList.remove('loading');
      renderMonthSelector();
      renderTicker();
      renderKPI();
      renderView(currentView);
    }
    updateDataStatus('snapshot');
  })
  .catch(function() {
    updateDataStatus('error');
  });

// ─── Init ───────────────────────────────────────────────────────────
function init() {
  loadTheme();
  document.body.classList.remove('loading');
  updateClock();
  setInterval(updateClock, 1000);
  renderMonthSelector();
  renderTicker();
  renderKPI();
  renderView('overview');
  setInterval(refreshData, 300000);
  setupNav();
  setupKeys();
  setupChat();
  setupStatus();
}

// ─── Theme ──────────────────────────────────────────────────────────
function loadTheme() {
  try {
    var saved = localStorage.getItem('irdai_theme');
    if (saved === 'light') document.documentElement.setAttribute('data-theme', 'light');
  } catch(e) {}
}
function toggleTheme() {
  var html = document.documentElement;
  var current = html.getAttribute('data-theme') || 'dark';
  var next = current === 'dark' ? 'light' : 'dark';
  html.setAttribute('data-theme', next);
  try { localStorage.setItem('irdai_theme', next); } catch(e) {}
}

// ─── Clock ──────────────────────────────────────────────────────────
function updateClock() {
  var now = new Date();
  var ts = now.toLocaleString('en-IN', { timeZone: 'Asia/Kolkata', hour: '2-digit', minute: '2-digit', second: '2-digit', hour12: false });
  document.getElementById('clock').textContent = ts + ' IST';
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
function getLifeLatest() { return getLatestSegmentMonth('life'); }
function getNonLifeLatest() { return getLatestSegmentMonth('non_life'); }
function getLifeData(month) { return getMonthData('life', month); }
function getNonLifeData(month) { return getMonthData('non_life', month); }

// ─── Demo Playback ─────────────────────────────────────────────────
function getAvailableMonths() {
  var set = {};
  ['life', 'non_life'].forEach(function(k) {
    (DATA[k] ? DATA[k].monthly_data : []).forEach(function(m) { set[m.month] = true; });
  });
  return Object.keys(set).sort();
}

function updateStatusForDemo() {
  var el = document.getElementById('dataStatus');
  if (el && demoMode) {
    el.innerHTML = '· DEMO · ' + (selectedMonth || '');
  }
}

function startDemoPlayback() {
  if (demoMode) return;
  var months = getAvailableMonths();
  if (months.length < 2) { chatSay('Need at least 2 months for demo playback.', false); return; }
  demoMode = true;
  var idx = months.indexOf(selectedMonth);
  if (idx === -1) idx = 0;
  demoInterval = setInterval(function() {
    idx = (idx + 1) % months.length;
    selectedMonth = months[idx];
    renderView(currentView);
    updateStatusForDemo();
  }, 3000);
  chatSay('Demo playback started. Auto-stepping through <strong>' + months.length + '</strong> months. Type <strong>stop demo</strong> to end.', false);
  updateStatusForDemo();
}

function stopDemoPlayback() {
  if (!demoMode) return;
  demoMode = false;
  if (demoInterval) { clearInterval(demoInterval); demoInterval = null; }
  var el = document.getElementById('dataStatus');
  if (el) updateDataStatus();
  chatSay('Demo playback stopped.', false);
}

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
  chatSay('Exported <strong>' + rows.length + '</strong> rows as CSV.', false);
}

function downloadTextFile(filename, text, mimeType) {
  var blob = new Blob([text], { type: mimeType || 'text/plain' });
  var a = document.createElement('a');
  a.href = URL.createObjectURL(blob);
  a.download = filename;
  a.click();
  URL.revokeObjectURL(a.href);
}

function generateAuditPack() {
  if (!DATA || !DATA._meta) return '# IRDAI Insurance Terminal Audit Pack\n\nData is not loaded.\n';
  var meta = DATA._meta;
  var validation = meta.validation || { status: 'unvalidated', issues: [] };
  var issues = validation.issues || [];
  var hygiene = meta.source_hygiene || {};
  var scope = getActiveAnalysisScope();
  var counts = issues.reduce(function(acc, issue) {
    acc[issue.severity] = (acc[issue.severity] || 0) + 1;
    return acc;
  }, {});
  var alerts = getWatchlistAlerts();
  var stocksCount = STOCKS && STOCKS.prices ? Object.keys(STOCKS.prices).length : 0;
  var lines = [
    '# IRDAI Insurance Terminal Audit Pack',
    '',
    'Generated At: ' + new Date().toISOString(),
    'Research As Of: ' + (meta.research_as_of || meta.last_updated || '--'),
    'Active View: ' + currentView,
    'Active Period: ' + (scope.period || '--'),
    'Validation Status: ' + String(validation.status || 'unvalidated').toUpperCase(),
    'Validation Counts: ' + (counts.error || 0) + ' errors, ' + (counts.warning || 0) + ' warnings, ' + (counts.info || 0) + ' info',
    'Latest Life Month: ' + (meta.latest_life_month || '--'),
    'Latest Non-Life Month: ' + (meta.latest_non_life_month || '--'),
    'Latest Shared Month: ' + (meta.latest_shared_month || '--'),
    'NSE Stock Snapshots: ' + stocksCount,
    '',
    '## Source Hygiene',
    '- Raw files processed: ' + (hygiene.raw_files_processed == null ? '--' : hygiene.raw_files_processed),
    '- Records loaded: ' + (hygiene.records_loaded == null ? '--' : hygiene.records_loaded),
    '- Records retained: ' + (hygiene.records_retained == null ? '--' : hygiene.records_retained),
    '- Dropped duplicates: ' + (hygiene.records_dropped == null ? '--' : hygiene.records_dropped),
    '- Filename/header mismatches: ' + ((hygiene.filename_header_mismatches || []).length),
  ];

  (hygiene.duplicate_resolutions || []).forEach(function(item) {
    lines.push('- Duplicate ' + item.segment + ' ' + item.month + ': kept ' + item.kept_source_file + ', dropped ' + item.dropped_source_file + ' (' + item.reason + ')');
  });
  (hygiene.filename_header_mismatches || []).forEach(function(item) {
    lines.push('- Month mismatch: ' + item.source_file + ' filename ' + item.filename_month + ', header ' + item.header_month + ', selected ' + item.selected_month);
  });

  lines.push('', '## Primary Sources');
  (meta.source_links || []).forEach(function(src) {
    lines.push('- ' + src.name + ': ' + (src.latest_observed || src.url));
  });

  lines.push('', '## Validation Items');
  if (!issues.length) {
    lines.push('- No validation issues tracked.');
  } else {
    issues.slice(0, 25).forEach(function(issue) {
      lines.push('- [' + String(issue.severity || '').toUpperCase() + '] ' + issue.code + ': ' + issue.message);
    });
  }

  lines.push('', '## Watchlist Monitor');
  if (!watchlist.length) {
    lines.push('- No watched insurers saved locally.');
  } else if (!alerts.length) {
    lines.push('- ' + watchlist.length + ' watched insurer' + (watchlist.length === 1 ? '' : 's') + ', but no matching loaded data.');
  } else {
    alerts.forEach(function(row) {
      lines.push('- ' + row.name + ' | ' + (row._seg || row.seg || '--') + ' | ' + fmtCr(row.premium_cr) + ' | YoY ' + fmtPct(row.yoy_growth_pct) + ' | ' + row._alertSeverity.toUpperCase() + ' - ' + row._alertReason);
    });
  }

  lines.push('', '## Alert Configuration');
  lines.push('- Growth surge: ' + alertConfig.growthSurgePct + '%');
  lines.push('- Risk drop: ' + alertConfig.riskDropPct + '%');
  lines.push('- Share move: ±' + alertConfig.shareMovePp + 'pp');
  lines.push('- Watch growth: ' + alertConfig.watchGrowthPct + '%');
  lines.push('- Watch share move: ±' + alertConfig.watchShareMovePp + 'pp');

  lines.push('', '## Saved View Presets');
  var savedViewKeys = Object.keys(savedViews).sort();
  if (!savedViewKeys.length) {
    lines.push('- No saved views stored locally.');
  } else {
    savedViewKeys.forEach(function(key) {
      var preset = savedViews[key];
      lines.push('- ' + preset.name + ' | ' + (preset.view || '--') + ' | ' + (preset.selectedMonth || 'latest') + ' | ' + ((preset.watchlist || []).length) + ' watched | saved ' + (preset.savedAt || '--'));
    });
  }

  lines.push('', '## Active Scope');
  scope.segments.forEach(function(segment) {
    lines.push('- ' + segment.label + ' ' + segment.month + ': ' + fmtCr(segment.total_premium_cr) + ', YoY ' + fmtPct(segment.total_growth_pct) + ', source ' + (segment.source_file || '--'));
  });

  lines.push('', '## Caveats');
  lines.push('- Figures are provisional and unaudited where source flash reports say so.');
  lines.push('- Cumulative YTD series reset at fiscal-year boundaries.');
  lines.push('- Watchlist selections are local browser state and are not uploaded.');

  return lines.join('\n') + '\n';
}

function exportAuditPack() {
  var datePart = (DATA && DATA._meta && (DATA._meta.research_as_of || DATA._meta.last_updated)) || new Date().toISOString().slice(0, 10);
  downloadTextFile('irdai-audit-pack-' + datePart + '.md', generateAuditPack(), 'text/markdown');
  chatSay('Exported <strong>audit pack</strong> as Markdown.', false);
}

// ─── AI Insight ─────────────────────────────────────────────────────
function generateOverviewAISummary(life, nonlife, total) {
  var lifeGrowth = life.total_growth_pct;
  var nonlifeGrowth = nonlife.total_growth_pct;
  var sortedLife = sortByPremium(life.insurers);
  var sortedNonLife = sortByPremium(nonlife.insurers);
  var topLife = sortedLife[0];
  var topNonLife = sortedNonLife[0];
  if (!topLife || !topNonLife) return '';
  var lifeShare = Math.round(life.total_premium_cr / total * 100);
  var nonlifeShare = Math.round(nonlife.total_premium_cr / total * 100);
  var growing = lifeGrowth > 0 && nonlifeGrowth > 0;
  var text = 'The combined market stands at <strong>' + fmtCr(total) + '</strong>, with Life Insurance holding ' + lifeShare + '% share and Non-Life at ' + nonlifeShare + '%. ';
  text += 'Life is growing at <strong>' + fmtPct(lifeGrowth) + '</strong> YoY, while Non-Life is at <strong>' + fmtPct(nonlifeGrowth) + '</strong>. ';
  text += 'The top Life player is <strong>' + shortName(topLife.name) + '</strong> at ' + topLife.market_share_pct.toFixed(1) + '% share, and in Non-Life, <strong>' + shortName(topNonLife.name) + '</strong> leads at ' + topNonLife.market_share_pct.toFixed(1) + '%.';
  return '<div class="insight-card" style="margin-top:6px;"><div class="label">AI INSIGHT</div><div class="desc" style="font-size:9px;margin-top:2px;line-height:1.6;color:var(--gray)">' + text + '</div></div>';
}

function generateSegmentAISummary(latest, segment) {
  var color = segment === 'life' ? 'var(--green)' : 'var(--cyan)';
  var segLabel = segmentDisplayLabel(segment);
  var sorted = sortByPremium(latest.insurers);
  var total = latest.insurers.reduce(function(s, i) { return s + i.premium_cr; }, 0);
  var top = sorted[0];
  if (!top) return '';
  var top3Share = sorted.slice(0, 3).reduce(function(s, i) { return s + i.market_share_pct; }, 0);
  var growthLeaders = latest.insurers.filter(function(i) { return i.yoy_growth_pct > 10 && i.premium_cr >= 100; }).length;
  var text = 'The ' + segLabel + ' segment aggregates <strong>' + fmtCr(latest.total_premium_cr) + '</strong> in premiums, growing at <strong>' + fmtPct(latest.total_growth_pct) + '</strong> YoY. ';
  text += 'The top 3 insurers control ' + top3Share.toFixed(1) + '% of the market, with <strong>' + shortName(top.name) + '</strong> leading at ' + top.market_share_pct.toFixed(1) + '% share. ';
  if (growthLeaders > 0) text += 'There are ' + growthLeaders + ' insurers growing faster than 10% YoY with a meaningful premium base.';
  else text += 'No insurers are growing faster than 10% YoY with a meaningful premium base.';
  return '<div class="insight-card" style="margin-top:6px;"><div class="label">AI INSIGHT</div><div class="desc" style="font-size:9px;margin-top:2px;line-height:1.6;color:var(--gray)">' + text + '</div></div>';
}

function generateCompareAISummary(life, nonlife) {
  var total = life.total_premium_cr + nonlife.total_premium_cr;
  var lifeShare = Math.round(life.total_premium_cr / total * 100);
  var nonlifeShare = Math.round(nonlife.total_premium_cr / total * 100);
  var gap = Math.abs(life.total_premium_cr - nonlife.total_premium_cr);
  var leader = life.total_premium_cr > nonlife.total_premium_cr ? 'Life' : 'Non-Life';
  var text = leader + ' leads the market with a premium gap of <strong>' + fmtCr(gap) + '</strong>. ';
  text += 'Life holds ' + lifeShare + '% of the combined market (growing at ' + fmtPct(life.total_growth_pct) + '), while Non-Life holds ' + nonlifeShare + '% (growing at ' + fmtPct(nonlife.total_growth_pct) + '). ';
  return '<div class="insight-card" style="margin-top:6px;"><div class="label">AI INSIGHT</div><div class="desc" style="font-size:9px;margin-top:2px;line-height:1.6;color:var(--gray)">' + text + '</div></div>';
}

// ─── Ticker ─────────────────────────────────────────────────────────
function renderTicker() {
  var life = getLifeLatest();
  var nonlife = getNonLifeLatest();
  var sortedLife = sortByPremium(life.insurers);
  var sortedNonLife = sortByPremium(nonlife.insurers);

  // Interleave life + non-life insurers
  var maxLen = Math.max(sortedLife.length, sortedNonLife.length);
  var items = '';
  for (var i = 0; i < maxLen; i++) {
    if (i < sortedLife.length) {
      var li = sortedLife[i];
      items += '<span class="ticker-item">' +
        '<span class="t-sym" style="color:var(--green)">' + li.name.split(' ')[0] + '</span>' +
        '<span class="t-px">' + fmtCr(li.premium_cr) + '</span>' +
        '<span class="t-chg ' + (li.yoy_growth_pct >= 0 ? 'up' : 'dn') + '">' + fmtPct(li.yoy_growth_pct) + '</span>' +
      '</span>';
    }
    if (i < sortedNonLife.length) {
      var ni = sortedNonLife[i];
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
  var referenceMonth = (DATA._meta && DATA._meta.latest_shared_month) || (getSharedMonths().slice(-1)[0] || getAvailableMonths().slice(-1)[0] || '');
  var fiscalYear = referenceMonth ? (parseInt(referenceMonth.slice(0,4)) + (referenceMonth.slice(5) >= '04' ? 1 : 0)) : 2026;
  var fyLabel = 'FY' + (fiscalYear - 1) + '-' + String(fiscalYear).slice(2);
  var latestLife = getLifeLatest();
  var latestNonLife = getNonLifeLatest();
  var kpis = [
    { label: 'TOTAL MARKET', value: '\u20B9' + (s.total_market_premium_cr/1000).toFixed(1) + 'K Cr', sub: 'Shared ' + referenceMonth + ' · ' + fyLabel, color: 'var(--amber)', tip: 'Comparable life + non-life premium: \u20B9' + s.total_market_premium_cr.toFixed(0) + ' Cr' },
    { label: 'LIFE PREMIUM', value: '\u20B9' + (s.life_premium_cr/1000).toFixed(1) + 'K Cr', sub: Math.round((s.life_premium_cr/s.total_market_premium_cr)*100) + '% share', color: 'var(--green)', tip: 'Life premium: \u20B9' + s.life_premium_cr.toFixed(0) + ' Cr' },
    { label: 'NON-LIFE', value: '\u20B9' + (s.non_life_premium_cr/1000).toFixed(1) + 'K Cr', sub: Math.round((s.non_life_premium_cr/s.total_market_premium_cr)*100) + '% share', color: 'var(--cyan)', tip: 'Non-life premium: \u20B9' + s.non_life_premium_cr.toFixed(0) + ' Cr' },
    { label: 'PENETRATION', value: s.insurance_penetration_pct + '%', sub: 'Global: ' + s.global_penetration_avg_pct + '%', color: 'var(--purple)', tip: 'Insurance penetration as % of GDP. Global avg: ' + s.global_penetration_avg_pct + '%' },
    { label: 'DENSITY', value: '$' + s.insurance_density_usd, sub: 'Per capita', color: 'var(--orange)', tip: 'Premium per person per year in USD' },
    { label: 'PLAYERS', value: latestLife.insurers.length + latestNonLife.insurers.length, sub: 'Monitored', color: 'var(--pink)', tip: latestLife.insurers.length + ' life + ' + latestNonLife.insurers.length + ' non-life insurers tracked' },
  ];
  document.getElementById('kpiStrip').innerHTML = kpis.map(function(k) {
    return '<div class="kpi-item" title="' + k.tip + '"><div class="kpi-label">' + k.label + '</div><div class="kpi-value" style="color:' + k.color + '">' + k.value + '</div><div class="kpi-sub">' + k.sub + '</div></div>';
  }).join('');
}

// ─── Navigation ─────────────────────────────────────────────────────
function activatePanelTab(panel, tabKey) {
  if (!panel || !tabKey) return;
  panel.querySelectorAll('.panel-tab').forEach(function(n) {
    var key = n.dataset.tab || n.dataset.panel;
    n.classList.toggle('active', key === tabKey);
  });
  panel.querySelectorAll('.tab-content').forEach(function(n) { n.classList.remove('active'); });
  var target = document.getElementById(tabKey + '-tab');
  if (target && panel.contains(target)) {
    target.classList.add('active');
    if (tabKey === 'hhi' && typeof renderHHI === 'function') renderHHI();
    if (tabKey === 'movers' && typeof renderMovers === 'function') renderMovers();
    if (tabKey === 'brief' && typeof renderBrief === 'function') renderBrief();
  }
}

function resetPanelTabs() {
  document.querySelectorAll('.panel').forEach(function(panel) {
    if (panel.querySelector('[data-tab="table"]')) activatePanelTab(panel, 'table');
    else if (panel.querySelector('[data-panel="insights"]')) activatePanelTab(panel, 'insights');
  });
}

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
      var tabKey = el.dataset.tab || el.dataset.panel;
      activatePanelTab(parent, tabKey);
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

  // Hide period buttons that exceed available months
  var allMonthsCount = getAvailableMonths().length;
  document.querySelectorAll('.period-btn').forEach(function(el) {
    var p = el.dataset.period;
    var needed = { '1m': 1, '3m': 3, '6m': 6 }[p] || 0;
    if (needed > 0 && allMonthsCount < needed) {
      el.style.display = 'none';
    }
  });

  // Period buttons
  document.querySelectorAll('.period-btn').forEach(function(el) {
    el.addEventListener('click', function() {
      document.querySelectorAll('.period-btn').forEach(function(n) { n.style.borderColor = 'var(--border2)'; });
      el.style.borderColor = 'var(--amber)';
      chartPeriod = el.dataset.period;
      updateChart();
    });
  });
  var themeBtn = document.getElementById('themeToggle');
  if (themeBtn) themeBtn.addEventListener('click', toggleTheme);
}

function setupKeys() {
  document.addEventListener('keydown', function(e) {
    if (e.key === 'Escape') { closePopup(); return; }
    if (e.ctrlKey && e.key.toLowerCase() === 'k' || e.metaKey && e.key.toLowerCase() === 'k') {
      e.preventDefault();
      var cmdInput = document.getElementById('chatInput');
      if (cmdInput) {
        cmdInput.focus();
        cmdInput.select();
      }
      showCommandPalette();
      return;
    }
    if (e.key === 'r' && (e.ctrlKey || e.metaKey)) { e.preventDefault(); refreshData(); return; }
    var tag = e.target && e.target.tagName;
    if (tag === 'INPUT' || tag === 'TEXTAREA' || tag === 'SELECT') return;
    if (e.key === '?' || e.key === '/') { e.preventDefault(); showHelp(); return; }
    if (e.key.length !== 1) return;
    if (e.key === '1') { e.preventDefault(); switchView('overview'); }
    else if (e.key === '2') { e.preventDefault(); switchView('life'); }
    else if (e.key === '3') { e.preventDefault(); switchView('nonlife'); }
    else if (e.key === '4') { e.preventDefault(); switchView('compare'); }
    else if (e.key === 'f' || e.key === 'F') { e.preventDefault(); fitChart(); }
    else if (e.key === 'e' || e.key === 'E') { e.preventDefault(); toggleEMAByKey(); }
    else if (e.key === 'i' || e.key === 'I') { e.preventDefault(); showSplash(); }
  });
}

function switchView(view) {
  if (comparisonMode) {
    comparisonMode = false;
    comparisonCompanies = [];
    if (table) { table.destroy(); table = null; }
    if (emaSeries && chart) { chart.removeSeries(emaSeries); emaSeries = null; }
    showEMA = false;
    if (chart) { chart.remove(); chart = null; chartSeries = []; }
    renderedTabs = {};
  }
  document.querySelectorAll('#navTabs .nav-tab').forEach(function(n) {
    n.classList.toggle('active', n.dataset.view === view);
  });
  renderView(view);
}

// ─── Chat Assistant ──────────────────────────────────────────────────
var CHAT_HISTORY = [];

function chatSay(text, isUser) {
  if (isUser && !text) return;
  CHAT_HISTORY.push({ text: text, isUser: !!isUser });
  var el = document.getElementById('chatMessages');
  if (!el) return;
  var div = document.createElement('div');
  div.className = 'chat-msg ' + (isUser ? 'user' : 'bot');
  var bubble = document.createElement('div');
  bubble.className = 'chat-bubble';
  bubble.innerHTML = text;
  div.appendChild(bubble);
  el.appendChild(div);
  el.scrollTop = el.scrollHeight;
}

function chatStatus(text) {
  var el = document.getElementById('chatStatus');
  if (el) el.textContent = text || '';
}

function clearChat() {
  var el = document.getElementById('chatMessages');
  if (!el) return;
  el.innerHTML = '<div class="chat-msg bot"><div class="chat-bubble">Chat cleared. Ask me anything!</div></div>';
  CHAT_HISTORY = [];
  chatStatus('');
}

function setupChat() {
  var input = document.getElementById('chatInput');
  var sendBtn = document.getElementById('chatSend');
  var clearBtn = document.getElementById('chatClear');

  function submit() {
    var raw = input.value.trim();
    if (!raw) return;
    input.value = '';
    rememberCommand(raw);
    chatSay(escapeHtml(raw), true);
    processChatInput(raw);
  }

  input.addEventListener('keydown', function(e) {
    if (e.key === 'Enter') submit();
    else if (e.key === 'ArrowUp') {
      if (recallCommandHistory(-1, input)) e.preventDefault();
    } else if (e.key === 'ArrowDown') {
      if (recallCommandHistory(1, input)) e.preventDefault();
    }
  });
  sendBtn.addEventListener('click', submit);
  if (clearBtn) clearBtn.addEventListener('click', clearChat);
}

function processChatInput(raw) {
  var text = raw.trim();
  var lower = text.toLowerCase();

  if (runMnemonicCommand(text)) return;

  if (lower === 'help' || lower === '?' || lower === 'what can you do' || lower === 'what can you do?') {
    showChatHelp(); return;
  }
  if (lower === 'exit' || lower === 'clear' || lower === 'go back' || lower === 'stop') {
    if (comparisonMode) { exitCompanyComparison(); chatSay('Comparison cleared. Showing normal view.', false); }
    else if (table) { table.clearFilter(true); chatSay('Table filter cleared.', false); }
    else chatSay('Nothing to clear.', false);
    return;
  }
  if (lower === 'demo' || lower === 'start demo' || lower === 'play' || lower === 'playback') {
    startDemoPlayback(); return;
  }
  if (lower === 'stop demo' || lower === 'pause' || lower === 'stop playback') {
    stopDemoPlayback(); return;
  }
  if (lower === 'overview' || lower === 'show overview' || lower === 'go to overview' || lower === 'home' || lower === 'main') {
    switchView('overview'); chatSay('Switched to <strong>Market Overview</strong>.', false); return;
  }
  if (lower === 'life' || lower === 'show life' || lower === 'life insurance' || lower === 'go to life') {
    switchView('life'); chatSay('Switched to <strong>Life Insurance</strong> view.', false); return;
  }
  if (lower === 'nonlife' || lower === 'non-life' || lower === 'non life' || lower === 'show non life' || lower === 'general insurance') {
    switchView('nonlife'); chatSay('Switched to <strong>Non-Life Insurance</strong> view.', false); return;
  }
  if (lower === 'compare' || lower === 'show compare' || lower === 'life vs nonlife' || lower === 'segment compare') {
    switchView('compare'); chatSay('Switched to <strong>Life vs Non-Life</strong> segment comparison.', false); return;
  }

  if (lower === 'export audit' || lower === 'audit pack' || lower === 'download audit' || lower === 'export audit pack') {
    try { exportAuditPack(); } catch(e) { chatSay('Could not export the audit pack.', false); }
    return;
  }
  if (lower === 'export' || lower === 'download' || lower === 'csv' || lower === 'export csv') {
    try { exportCSV(); chatSay('CSV exported! Check your downloads.', false); } catch(e) { chatSay('Could not export CSV. Make sure a table is visible.', false); }
    return;
  }
  if (lower === 'export pdf' || lower === 'print' || lower === 'pdf') {
    chatSay('Opening print dialog... Save as PDF from there.', false);
    setTimeout(function() { window.print(); }, 300);
    return;
  }
  if (lower === 'audit' || lower === 'sources' || lower === 'data audit' || lower === 'data quality') {
    showAudit(); return;
  }
  if (lower === 'splash' || lower === 'market overview' || lower === 'summary') {
    showSplash(); return;
  }
  if (lower === 'watchlist' || lower === 'show watchlist' || lower === 'monitor' || lower === 'watchlist monitor') {
    showChatWatchlist(); return;
  }
  if (lower === 'alert config' || lower === 'alerts' || lower === 'alert thresholds') {
    showChatAlertConfig(); return;
  }
  if (lower === 'reset alerts' || lower === 'reset alert config') {
    alertConfig = normalizeAlertConfig(DEFAULT_ALERT_CONFIG);
    saveAlertConfig();
    renderWatchlistMonitor();
    showChatAlertConfig();
    return;
  }
  var setAlertMatch = lower.match(/^set alert\s+(growth|surge|risk|drop|share|watch)\s+(-?\d+(?:\.\d+)?)$/);
  if (setAlertMatch) {
    var updatedAlert = setAlertThreshold(setAlertMatch[1], setAlertMatch[2]);
    if (updatedAlert) {
      chatSay('Updated <strong>' + escapeHtml(updatedAlert.label) + '</strong> to <strong>' + escapeHtml(updatedAlert.value) + updatedAlert.suffix + '</strong>. Type <strong>alert config</strong> to review thresholds.', false);
    } else {
      chatSay('Use a numeric alert value, for example <strong>set alert growth 12</strong>.', false);
    }
    return;
  }
  if (lower === 'views' || lower === 'saved views' || lower === 'show saved views') {
    showChatSavedViews(); return;
  }
  var saveViewMatch = lower.match(/^save view\s+(.+)/);
  if (saveViewMatch) {
    var savedPreset = saveCurrentViewPreset(saveViewMatch[1]);
    if (savedPreset) chatSay('Saved view <strong>' + escapeHtml(savedPreset.name) + '</strong>. Type <strong>load view ' + escapeHtml(savedPreset.name) + '</strong> to restore it.', false);
    else chatSay('Give the view a name, for example <strong>save view nonlife desk</strong>.', false);
    return;
  }
  var loadViewMatch = lower.match(/^(?:load|open|restore) view\s+(.+)/);
  if (loadViewMatch) {
    var loadedPreset = applySavedViewPreset(loadViewMatch[1]);
    if (loadedPreset) chatSay('Loaded view <strong>' + escapeHtml(loadedPreset.name) + '</strong>.', false);
    else chatSay('No saved view named <strong>' + escapeHtml(loadViewMatch[1]) + '</strong>. Type <strong>views</strong> to list presets.', false);
    return;
  }
  var deleteViewMatch = lower.match(/^delete view\s+(.+)/);
  if (deleteViewMatch) {
    if (deleteSavedViewPreset(deleteViewMatch[1])) chatSay('Deleted saved view <strong>' + escapeHtml(normalizeSavedViewName(deleteViewMatch[1])) + '</strong>.', false);
    else chatSay('No saved view named <strong>' + escapeHtml(deleteViewMatch[1]) + '</strong>.', false);
    return;
  }
  var unwatchMatch = lower.match(/^(?:unwatch|remove from watchlist|remove)\s+(.+)/);
  if (unwatchMatch) {
    setChatWatchlistCompany(unwatchMatch[1].trim(), false); return;
  }
  var watchMatch = lower.match(/^(?:watch|add watch|add to watchlist)\s+(.+)/);
  if (watchMatch) {
    setChatWatchlistCompany(watchMatch[1].trim(), true); return;
  }
  if (lower === 'fit' || lower === 'reset chart' || lower === 'fit chart') {
    fitChart(); chatSay('Chart zoom reset.', false); return;
  }
  if (lower === 'ema' || lower === 'toggle ema' || lower === 'show ema') {
    toggleEMAByKey(); chatSay('EMA toggled.', false); return;
  }
  if (lower === 'refresh' || lower === 'reload') {
    refreshData(); chatSay('Refreshing data...', false); return;
  }

  var compareMatch = lower.match(/compare\s+(.+?)\s+(?:vs|versus|and|,)\s+(.+)/);
  if (compareMatch) {
    startCompanyComparison(compareMatch[1].trim(), compareMatch[2].trim());
    return;
  }

  var searchMatch = lower.match(/(?:search|find|filter|look up|show)\s+(.+)/);
  if (searchMatch && !searchMatch[1].match(/^(?:overview|life|non.?life|compare|help|export|audit|splash)$/)) {
    var q = searchMatch[1].trim();
    applySearchFilter(q);
    chatSay('Table filtered for <strong>' + escapeHtml(q) + '</strong>. Type <strong>clear</strong> to reset.', false);
    return;
  }

  var whoMatch = lower.match(/(?:who is|tell me about|about|what is|show me)\s+(.+)/);
  if (whoMatch) {
    showChatCompanyProfile(whoMatch[1].trim()); return;
  }

  var topMatch = lower.match(/(?:top|largest|biggest|leading|best)\s+(\d+)?\s*(life|non.?life|insurer|company|player|general)?/i);
  if (topMatch || lower.indexOf('top') !== -1 || lower.indexOf('largest') !== -1) {
    showChatTopCompanies(lower); return;
  }

  if (lower.indexOf('total') !== -1 || lower.indexOf('market') !== -1 || lower === 'size' || lower === 'market size') {
    showChatMarketOverview(); return;
  }
  if (lower.indexOf('penetration') !== -1 || lower.indexOf('density') !== -1 || lower.indexOf('gap') !== -1) {
    showChatPenetration(); return;
  }
  if (lower.indexOf('growth') !== -1 || lower.indexOf('yoy') !== -1) {
    var company = lower.replace(/(?:growth|yoy|performance)\s*(?:of|for|rate)?\s*/i, '').trim();
    if (company && company.length > 2) { showChatCompanyProfile(company); return; }
    showChatMarketOverview(); return;
  }
  if (lower.indexOf('share') !== -1 || lower.indexOf('market share') !== -1) {
    var company = lower.replace(/(?:market )?share\s*(?:of|for)?\s*/i, '').trim();
    if (company && company.length > 2) { showChatCompanyProfile(company); return; }
    showChatMarketOverview(); return;
  }
  if (lower.indexOf('stock') !== -1 || lower.indexOf('nse') !== -1 || lower.indexOf('price') !== -1 || lower.indexOf('share price') !== -1 || lower.indexOf('ticker') !== -1) {
    handleChatStockQuery(lower); return;
  }
  if (lower.indexOf('hhi') !== -1 || lower.indexOf('concentration') !== -1 || lower.indexOf('herfindahl') !== -1) {
    activatePanelTab(document.querySelector('.panel-left'), 'hhi');
    chatSay('Showing <strong>Concentration (HHI)</strong> tab in the left panel.', false); return;
  }
  if (lower.indexOf('mover') !== -1 || lower.indexOf('growing') !== -1 || lower.indexOf('shrink') !== -1 || lower.indexOf('fastest') !== -1) {
    activatePanelTab(document.querySelector('.panel-left'), 'movers');
    chatSay('Showing <strong>Movers</strong> tab in the left panel.', false); return;
  }
  if (lower.indexOf('player') !== -1 || lower.indexOf('top companies') !== -1) {
    resetPanelTabs();
    var playerTab = document.querySelector('[data-panel="players"]');
    if (playerTab) { playerTab.click(); chatSay('Showing <strong>Top Players</strong> tab.', false); }
    return;
  }
  if (lower === 'hello' || lower === 'hi' || lower === 'hey' || lower === 'namaste') {
    chatSay('Hello! I can help you explore the Indian insurance market. Try asking about a specific company or type <strong>help</strong>.', false); return;
  }

  var resolved = resolveCompanyName(text);
  if (resolved) { showChatCompanyProfile(resolved.name); return; }

  chatSay('I\'m not sure I understand. Ask me something like <strong>"Who is the top life insurer?"</strong>, <strong>"Compare LIC and HDFC Life"</strong>, or type <strong>help</strong> to see what I can do.', false);
}

function showChatHelp() {
  chatSay(
    'Here\'s what I can help you with:<br><br>' +
    '<strong>Companies</strong> — "Tell me about LIC", "What is ICICI Lombard?", "Show me SBI Life"<br>' +
    '<strong>Compare</strong> — "Compare LIC vs HDFC Life", "Compare ICICI Lombard, New India"<br>' +
    '<strong>Market</strong> — "What\'s the total market premium?", "Show me penetration", "Market size"<br>' +
    '<strong>Top lists</strong> — "Who are the top life insurers?", "Largest non-life companies"<br>' +
    '<strong>Watchlist</strong> — "Watch LIC", "Unwatch LIC", "Watchlist"<br>' +
    '<strong>Alerts</strong> — "Alert config", "Set alert growth 12", "Set alert share 0.75"<br>' +
    '<strong>Saved views</strong> — "Save view nonlife desk", "Load view nonlife desk", "Views"<br>' +
    '<strong>Views</strong> — "Show overview", "Go to life", "Non-life view", "Compare segments"<br>' +
    '<strong>Data</strong> — "Export", "Export PDF", "Export audit", "Refresh", "Audit"<br>' +
    '<strong>Search</strong> — "Find Star Health", "Search ICICI"<br>' +
    '<strong>Stocks</strong> — "What\'s the NSE price of LIC?", "Stock of ICICI Prudential"<br>' +
    '<strong>Demo</strong> — "Demo" to start auto-playback, "Stop demo" to end<br>' +
    '<strong>Exit</strong> — "Exit comparison", "Clear search"', false);
}

function showChatSavedViews() {
  var keys = Object.keys(savedViews).sort();
  if (!keys.length) {
    chatSay('No saved views yet. Try <strong>save view nonlife desk</strong>.', false);
    return;
  }
  var html = '<strong class="c-amb">Saved Views</strong><br>';
  keys.forEach(function(key, idx) {
    html += (idx + 1) + '. ' + formatSavedViewLine(savedViews[key]) + '<br>';
  });
  chatSay(html, false);
}

function setChatWatchlistCompany(query, shouldWatch) {
  var resolved = resolveCompanyName(query);
  if (!resolved) {
    chatSay('I couldn\'t find <strong>' + escapeHtml(query) + '</strong> for the watchlist.', false);
    return;
  }
  var alreadyWatched = isWatched(resolved.name);
  if (shouldWatch && !alreadyWatched) {
    watchlist.push(resolved.name);
    saveWatchlist();
  } else if (!shouldWatch && alreadyWatched) {
    watchlist.splice(watchlist.indexOf(resolved.name), 1);
    saveWatchlist();
  }
  if (table) table.redraw(true);
  renderWatchlistMonitor();
  chatSay(
    '<strong>' + escapeHtml(shortName(resolved.name)) + '</strong> ' +
    (shouldWatch ? 'is on the watchlist.' : 'is off the watchlist.') +
    ' Type <strong>watchlist</strong> to review monitored alerts.',
    false
  );
}

function showChatWatchlist() {
  if (!watchlist.length) {
    chatSay('Watchlist is empty. Type <strong>watch LIC</strong> or use the star column beside a company.', false);
    return;
  }
  var alerts = getWatchlistAlerts();
  var html = '<strong class="c-amb">Watchlist Monitor</strong><br>';
  if (!alerts.length) {
    html += '<span class="c-gry">' + watchlist.length + ' saved insurer' + (watchlist.length === 1 ? '' : 's') + ', but none are available in loaded periods.</span>';
  } else {
    alerts.forEach(function(row, idx) {
      var cls = row._alertSeverity === 'risk' ? 'c-red' : (row._alertSeverity === 'surge' ? 'c-grn' : 'c-gry');
      html += (idx + 1) + '. <strong>' + escapeHtml(shortName(row.name)) + '</strong> ' +
        '<span class="c-gry">' + escapeHtml(row._seg || row.seg || '') + '</span> — ' +
        fmtCr(row.premium_cr) + ', <span class="' + cls + '">' + fmtPct(row.yoy_growth_pct) + '</span> ' +
        '<span class="c-gry">(' + escapeHtml(row._alertReason) + ')</span><br>';
    });
  }
  chatSay(html, false);
}

function showChatCompanyProfile(query) {
  var resolved = resolveCompanyName(query);
  if (!resolved) { chatSay('I couldn\'t find <strong>' + escapeHtml(query) + '</strong>. Try a different name or search the table.', false); return; }
  var data = null;
  var seg = null;
  var scope1 = getScopeForCompany(resolved.name);
  if (scope1.segment) {
    var m = getMonthData(scope1.segment, null);
    if (m) {
      for (var i = 0; i < m.insurers.length; i++) {
        if (m.insurers[i].name === resolved.name) { data = m.insurers[i]; seg = scope1.segment; break; }
      }
    }
  }
  var scope2 = { segment: seg === 'life' ? 'non_life' : 'life' };
  if (!data) {
    scope2.segment = 'non_life';
    var m2 = getMonthData('non_life', null);
    if (m2) {
      for (var i = 0; i < m2.insurers.length; i++) {
        if (m2.insurers[i].name === resolved.name) { data = m2.insurers[i]; seg = 'non_life'; break; }
      }
    }
  }
  var profile = resolved.profile || lookupCompany(resolved.name);
  var color = seg === 'life' ? 'var(--green)' : 'var(--cyan)';
  var segLabel = seg === 'life' ? 'Life' : 'Non-Life';
  var html = '<strong style="color:' + color + '">' + shortName(resolved.name) + '</strong><br>';
  if (profile && profile.segment) html += '<span class="c-gry">Segment:</span> ' + profile.segment + '<br>';
  if (profile && profile.founded) html += '<span class="c-gry">Founded:</span> ' + profile.founded + '<br>';
  if (profile && profile.rating) html += '<span class="c-gry">Rating:</span> ' + profile.rating + '<br>';
  if (profile && profile.specialties) html += '<span class="c-gry">Specialties:</span> ' + profile.specialties + '<br>';
  if (profile && profile.group) html += '<span class="c-gry">Group:</span> ' + profile.group + '<br>';
  if (data) {
    html += '<br><strong class="c-amb">Latest Data</strong><br>';
    html += '<span class="c-gry">Premium:</span> ' + fmtCr(data.premium_cr) + '<br>';
    html += '<span class="c-gry">Market Share:</span> ' + (data.market_share_pct != null ? data.market_share_pct.toFixed(1) + '%' : '--') + '<br>';
    html += '<span class="c-gry">YoY Growth:</span> <span class="' + (data.yoy_growth_pct >= 0 ? 'c-grn' : 'c-red') + '">' + fmtPct(data.yoy_growth_pct) + '</span><br>';
  }
  if (profile && profile.ticker) {
    var sp = getStockPrice(profile.ticker);
    if (sp && sp.price) html += '<br><span class="c-gry">NSE (' + profile.ticker.replace('.NS','') + '):</span> <strong class="c-amb">₹' + sp.price.toFixed(2) + '</strong>';
  }
  if (profile && profile.desc) html += '<br><br><span class="c-gry">' + profile.desc + '</span>';
  chatSay(html, false);
}

function showChatTopCompanies(lower) {
  var seg = lower.indexOf('non') !== -1 || lower.indexOf('general') !== -1 ? 'non_life' : (lower.indexOf('life') !== -1 ? 'life' : null);
  var count = 5;
  var countMatch = lower.match(/(\d+)/);
  if (countMatch) count = Math.min(parseInt(countMatch[1]), 15);
  if (seg === 'life' || seg === 'non_life') {
    var m = getMonthData(seg, null);
    if (!m) { chatSay('No data available for this segment.', false); return; }
    var sorted = sortByPremium(m.insurers).slice(0, count);
    var label = seg === 'life' ? 'Life Insurers' : 'Non-Life Insurers';
    var color = seg === 'life' ? 'c-grn' : 'c-cyn';
    var html = '<strong class="' + color + '">Top ' + label + '</strong> <span class="c-gry">(' + count + ')</span><br>';
    sorted.forEach(function(i, idx) {
      html += (idx + 1) + '. <strong>' + shortName(i.name) + '</strong> — ' + fmtCr(i.premium_cr) + ' (' + i.market_share_pct.toFixed(1) + '% share, <span class="' + (i.yoy_growth_pct >= 0 ? 'c-grn' : 'c-red') + '">' + fmtPct(i.yoy_growth_pct) + '</span>)<br>';
    });
    chatSay(html, false);
  } else {
    var pair = getSharedMonthPair(selectedMonth);
    if (!pair.life || !pair.nonlife) { chatSay('No market data available.', false); return; }
    var all = [];
    pair.life.insurers.forEach(function(i) { all.push({ name: i.name, premium: i.premium_cr, share: i.market_share_pct, growth: i.yoy_growth_pct, seg: 'Life', color: 'c-grn' }); });
    pair.nonlife.insurers.forEach(function(i) { all.push({ name: i.name, premium: i.premium_cr, share: i.market_share_pct, growth: i.yoy_growth_pct, seg: 'Non-Life', color: 'c-cyn' }); });
    all.sort(function(a, b) { return b.premium - a.premium; });
    var top = all.slice(0, count);
    var html = '<strong class="c-amb">Top ' + count + ' Insurers (All Segments)</strong><br>';
    top.forEach(function(i, idx) {
      html += (idx + 1) + '. <strong>' + shortName(i.name) + '</strong> <span class="' + i.color + '">' + i.seg + '</span> — ' + fmtCr(i.premium) + ' (' + i.share.toFixed(1) + '%)<br>';
    });
    chatSay(html, false);
  }
}

function showChatMarketOverview() {
  var s = DATA ? DATA.summary : null;
  if (!s) { chatSay('Market data not loaded yet.', false); return; }
  var pair = getSharedMonthPair(DATA._meta ? DATA._meta.latest_shared_month : null);
  var month = (pair && pair.month) || 'latest';
  chatSay(
    '<strong class="c-amb">Indian Insurance Market (' + month + ')</strong><br>' +
    '<span class="c-gry">Total Market:</span> ₹' + (s.total_market_premium_cr/1000).toFixed(1) + 'K Cr<br>' +
    '<span class="c-grn">Life:</span> ₹' + (s.life_premium_cr/1000).toFixed(1) + 'K Cr (' + Math.round(s.life_premium_cr/s.total_market_premium_cr*100) + '% share)<br>' +
    '<span class="c-cyn">Non-Life:</span> ₹' + (s.non_life_premium_cr/1000).toFixed(1) + 'K Cr (' + Math.round(s.non_life_premium_cr/s.total_market_premium_cr*100) + '% share)<br>' +
    '<span class="c-gry">Penetration:</span> ' + s.insurance_penetration_pct + '% of GDP (Global avg: ' + s.global_penetration_avg_pct + '%)<br>' +
    '<span class="c-gry">Density:</span> $' + s.insurance_density_usd + '/capita<br>' +
    '<span class="c-gry">Players Tracked:</span> ' + (s.life_insurer_count + s.non_life_insurer_count) + ' insurers', false);
}

function showChatPenetration() {
  var s = DATA ? DATA.summary : null;
  if (!s) { chatSay('Data not loaded yet.', false); return; }
  var gap = (s.global_penetration_avg_pct - s.insurance_penetration_pct).toFixed(1);
  chatSay(
    '<strong class="c-amb">Insurance Penetration & Density</strong><br>' +
    '<span class="c-gry">India Penetration:</span> ' + s.insurance_penetration_pct + '% of GDP<br>' +
    '<span class="c-gry">Global Average:</span> ' + s.global_penetration_avg_pct + '%<br>' +
    '<span class="c-gry">Gap:</span> ' + gap + 'pp below global<br>' +
    '<span class="c-gry">Density:</span> $' + s.insurance_density_usd + ' per capita<br>' +
    '<span class="c-gry">Opportunity:</span> India needs ~' + (gap * 2).toFixed(0) + 'x current penetration to match peers', false);
}

function handleChatStockQuery(lower) {
  var company = lower.replace(/(?:stock|nse|price|share price|ticker|of)\s*/gi, '').trim();
  if (!company || company.length < 2) {
    // Show all stock tickers
    if (!STOCKS || !STOCKS.prices) { chatSay('Stock data not available.', false); return; }
    var tickers = Object.keys(STOCKS.prices);
    if (!tickers.length) { chatSay('No stock data loaded.', false); return; }
    var html = '<strong class="c-amb">NSE Stock Prices</strong><br>';
    tickers.forEach(function(t) {
      html += '<span class="c-gry">' + t.replace('.NS','') + ':</span> ₹' + (STOCKS.prices[t] && STOCKS.prices[t].price ? STOCKS.prices[t].price.toFixed(2) : '--') + '<br>';
    });
    chatSay(html, false);
    return;
  }
  var resolved = resolveCompanyName(company);
  if (!resolved) { chatSay('I couldn\'t find that company.', false); return; }
  var profile = resolved.profile || lookupCompany(resolved.name);
  if (!profile || !profile.ticker) { chatSay(shortName(resolved.name) + ' is not listed on NSE (no ticker data).', false); return; }
  var sp = getStockPrice(profile.ticker);
  if (!sp || !sp.price) { chatSay(shortName(resolved.name) + ' (' + profile.ticker.replace('.NS','') + '): No recent price data available.', false); return; }
  chatSay('<strong>' + shortName(resolved.name) + '</strong> — <strong class="c-amb">₹' + sp.price.toFixed(2) + '</strong> on ' + sp.exchange + '<br><span class="c-gry">Ticker:</span> ' + profile.ticker.replace('.NS',''), false);
}

function applySearchFilter(query) {
  if (!table) return;
  var q = (query || '').trim().toLowerCase();
  if (!q) {
    table.clearFilter(true);
    return;
  }
  var aliases = {
    lic: 'life insurance corporation of india',
    niacl: 'new india assurance',
    newindia: 'new india assurance',
    hdfc: 'hdfc',
    icici: 'icici',
    sbi: 'sbi',
  };
  var expanded = aliases[q] || q;
  table.clearFilter(true);
  table.setFilter(function(data) {
    var name = (data.name || '').toLowerCase();
    var seg = (data.seg || data._seg || '').toLowerCase();
    return name.indexOf(q) !== -1 || name.indexOf(expanded) !== -1 || seg.indexOf(q) !== -1;
  });
}

function updateCmdStatus() {
  if (!DATA) return;
  var life = getLifeLatest();
  var nonlife = getNonLifeLatest();
  if (!life || !nonlife) return;
  var status = DATA._meta && DATA._meta.validation ? DATA._meta.validation.status.toUpperCase() : 'UNVALIDATED';
  chatStatus(life.insurers.length + ' life + ' + nonlife.insurers.length + ' non-life · ' + status);
}

function setupStatus() {
  var status = document.querySelector('.topbar-status');
  if (!status) return;
  status.setAttribute('role', 'button');
  status.setAttribute('tabindex', '0');
  status.addEventListener('click', function() { showAudit(); });
  status.addEventListener('keydown', function(e) {
    if (e.key === 'Enter' || e.key === ' ') {
      e.preventDefault();
      showAudit();
    }
  });
}

var refreshCount = 0;
function refreshData() {
  refreshCount++;
  updateDataStatus('loading');
  Promise.all([
    fetch('data/irdai-processed.json').then(function(r) { if (!r.ok) throw new Error('HTTP ' + r.status); return r.json(); }),
    fetch('data/stock-prices.json').then(function(r) { if (!r.ok) return null; return r.json(); }).catch(function() { return null; }),
    fetch('data/analysis_summary.md').then(function(r) { if (!r.ok) return null; return r.text(); }).catch(function() { return null; }),
  ]).then(function(results) {
    DATA = results[0];
    STOCKS = results[1];
    cacheSave('data', DATA);
    cacheSave('stocks', STOCKS);
    if (results[2]) { window._briefMd = results[2]; cacheSave('brief', results[2]); }
    renderMonthSelector();
    renderTicker();
    renderKPI();
    renderView(currentView);
    updateDataStatus('snapshot');
  }).catch(function() {
    updateDataStatus('error');
  });
}

function updateDataStatus(state) {
  var el = document.getElementById('dataStatus');
  var dot = document.querySelector('.status-dot');
  if (!el) return;
  if (state === 'loading') {
    el.textContent = 'LOADING';
    el.style.color = 'var(--amber)';
    if (dot) dot.style.background = 'var(--amber)';
  } else if (state === 'error') {
    el.textContent = 'OFFLINE';
    el.style.color = 'var(--red)';
    if (dot) dot.style.background = 'var(--red)';
  } else if (state === 'snapshot' && DATA && DATA._meta) {
    var ts = DATA._meta.research_as_of || DATA._meta.last_updated || DATA._meta.generated_at || 'unknown';
    var validation = DATA._meta.validation ? DATA._meta.validation.status : 'ok';
    var isStale = false;
    if (ts && ts.length === 10 && ts.indexOf('-') === 4) {
      var snapshotDate = new Date(ts + 'T00:00:00');
      var daysOld = (Date.now() - snapshotDate.getTime()) / 86400000;
      isStale = daysOld > 7;
    }
    el.textContent = 'SNAPSHOT: ' + ts + (validation !== 'ok' ? ' · ' + validation.toUpperCase() : '') + (isStale ? ' · STALE' : '');
    var statusColor = validation === 'error' ? 'var(--red)' : (isStale ? 'var(--amber)' : (validation === 'warning' ? 'var(--amber)' : 'var(--green)'));
    el.style.color = statusColor;
    if (dot) dot.style.background = statusColor;
  } else {
    el.textContent = 'SNAPSHOT';
    el.style.color = 'var(--green)';
    if (dot) dot.style.background = 'var(--green)';
  }
}

function showAudit() {
  if (!DATA || !DATA._meta) {
    showPopup('DATA AUDIT', '<div style="font-size:9px;color:var(--gray2);">No data loaded.</div>');
    return;
  }
  var meta = DATA._meta;
  var validation = meta.validation || { status: 'unvalidated', issues: [] };
  var issues = validation.issues || [];
  var counts = issues.reduce(function(acc, issue) {
    acc[issue.severity] = (acc[issue.severity] || 0) + 1;
    return acc;
  }, {});
  var statusColor = validation.status === 'error' ? 'var(--red)' : (validation.status === 'warning' ? 'var(--amber)' : 'var(--green)');
  var sourceHtml = (meta.source_links || []).map(function(src) {
    return '<div class="audit-row">' +
      '<span>' + escapeHtml(src.name) + '</span>' +
      '<span>' + escapeHtml(src.latest_observed || src.url) + '</span>' +
    '</div>';
  }).join('');
  var hygiene = meta.source_hygiene || {};
  var duplicateResolutions = hygiene.duplicate_resolutions || [];
  var monthMismatches = hygiene.filename_header_mismatches || [];
  var hygieneRows = [
    ['Raw files processed', hygiene.raw_files_processed],
    ['Records loaded', hygiene.records_loaded],
    ['Records retained', hygiene.records_retained],
    ['Dropped duplicates', hygiene.records_dropped],
    ['Filename/header mismatches', monthMismatches.length],
  ].map(function(row) {
    return '<div class="audit-row"><span>' + escapeHtml(row[0]) + '</span><span>' + escapeHtml(row[1] == null ? '--' : String(row[1])) + '</span></div>';
  }).join('');
  var duplicateHtml = duplicateResolutions.map(function(item) {
    return '<div class="audit-note">Duplicate ' + escapeHtml(item.segment || '--') + ' month ' + escapeHtml(item.month || '--') +
      ': kept ' + escapeHtml(item.kept_source_file || '--') +
      ' and dropped ' + escapeHtml(item.dropped_source_file || '--') +
      ' (' + escapeHtml(item.reason || 'deduplicated') + ')</div>';
  }).join('');
  var mismatchHtml = monthMismatches.map(function(item) {
    return '<div class="audit-note">Month mismatch: ' + escapeHtml(item.source_file || '--') +
      ' filename ' + escapeHtml(item.filename_month || '--') +
      ', header ' + escapeHtml(item.header_month || '--') +
      ', selected ' + escapeHtml(item.selected_month || '--') + '</div>';
  }).join('');
  var hygieneNoteHtml = (duplicateHtml || mismatchHtml)
    ? duplicateHtml + mismatchHtml
    : '<div class="audit-note">No duplicate or filename/header source exceptions detected.</div>';
  var issueHtml = issues.slice(0, 8).map(function(issue) {
    var color = issue.severity === 'error' ? 'var(--red)' : (issue.severity === 'warning' ? 'var(--amber)' : 'var(--gray2)');
    return '<div class="audit-issue">' +
      '<span style="color:' + color + '">' + escapeHtml(issue.severity.toUpperCase()) + '</span>' +
      '<span>' + escapeHtml(issue.code) + '</span>' +
      '<span>' + escapeHtml(issue.message) + '</span>' +
    '</div>';
  }).join('');
  var extractionNotes = DATA.life.monthly_data.concat(DATA.non_life.monthly_data)
    .reduce(function(all, month) { return all.concat(month.extraction_notes || []); }, []);
  var notesHtml = extractionNotes.length ? extractionNotes.map(function(note) {
    return '<div class="audit-note">' + escapeHtml(note) + '</div>';
  }).join('') : '<div class="audit-note">No duplicate source records retained in processed output.</div>';

  showPopup('DATA QUALITY AUDIT',
    '<div class="audit-grid">' +
      '<div class="audit-card"><div class="label">Snapshot</div><div class="value" style="color:var(--cyan)">' + escapeHtml(meta.research_as_of || meta.last_updated || '--') + '</div><div class="desc">Research as-of date</div></div>' +
      '<div class="audit-card"><div class="label">Validation</div><div class="value" style="color:' + statusColor + '">' + escapeHtml((validation.status || 'unvalidated').toUpperCase()) + '</div><div class="desc">' + issues.length + ' issues tracked</div></div>' +
      '<div class="audit-card"><div class="label">Shared Month</div><div class="value" style="color:var(--amber)">' + escapeHtml(meta.latest_shared_month || '--') + '</div><div class="desc">Comparable headline period</div></div>' +
      '<div class="audit-card"><div class="label">Latest Segment</div><div class="value" style="color:var(--white)">' + escapeHtml((meta.latest_life_month || '--') + ' / ' + (meta.latest_non_life_month || '--')) + '</div><div class="desc">Life / non-life</div></div>' +
    '</div>' +
    '<div class="section-label">SEVERITY COUNTS</div>' +
    '<div class="audit-row"><span>Errors</span><span style="color:var(--red)">' + (counts.error || 0) + '</span></div>' +
    '<div class="audit-row"><span>Warnings</span><span style="color:var(--amber)">' + (counts.warning || 0) + '</span></div>' +
    '<div class="audit-row"><span>Info</span><span style="color:var(--gray2)">' + (counts.info || 0) + '</span></div>' +
    '<div class="section-label">PRIMARY SOURCES</div>' + sourceHtml +
    '<div class="section-label">SOURCE HYGIENE</div>' + hygieneRows + hygieneNoteHtml +
    '<div class="section-label">TOP VALIDATION ITEMS</div>' + issueHtml +
    '<div class="section-label">EXTRACTION NOTES</div>' + notesHtml
  );
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
  renderedTabs = {};
  resetPanelTabs();
  renderMonthSelector();
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
  var pair = getSharedMonthPair(selectedMonth);
  var life = pair.life;
  var nonlife = pair.nonlife;
  if (!life || !nonlife) {
    document.getElementById('tableTitle').textContent = 'ALL INSURERS — UNAVAILABLE';
    document.getElementById('tableMonth').textContent = 'No shared life/non-life month';
    document.getElementById('tableContainer').innerHTML = '<div style="color:var(--gray2);font-size:9px;padding:20px;text-align:center;">Comparable market data unavailable</div>';
    return;
  }
  var enrichedLife = enrichInsurers(life.insurers, 'life', life.month);
  var enrichedNonLife = enrichInsurers(nonlife.insurers, 'non_life', nonlife.month);
  var combined = enrichedLife.map(function(i) { return Object.assign({}, i, { _seg: 'Life' }); })
    .concat(enrichedNonLife.map(function(i) { return Object.assign({}, i, { _seg: 'Non-Life' }); }))
    .sort(function(a, b) { return b.premium_cr - a.premium_cr; });

  document.getElementById('tableTitle').textContent = 'ALL INSURERS';
  document.getElementById('tableMonth').textContent = pair.month + ' shared';

  buildTable(combined, ['watch', 'rank', 'name', 'segment', 'premium', 'share', 'growth', 'share_chg_pp', 'cagr_3m'],
    { watch: { title: '', width: 34 }, rank: { title: '#', width: 30 }, name: { title: 'Company', width: 200 }, segment: { title: 'Type', width: 60 }, premium: { title: 'Premium' }, share: { title: 'Shr%' }, growth: { title: 'YoY%' }, share_chg_pp: { title: 'ShrChg' }, cagr_3m: { title: '3M CAGR' } }
  );

  updateChartData('all');
  var top = combined[0];
  if (top) updateChartHeader('IRDAI', fmtCr(top.premium_cr), fmtPct(top.yoy_growth_pct), top.yoy_growth_pct >= 0);
  updateMeta(life, nonlife);
  renderOverviewInsights(life, nonlife);
  var sortedLife = sortByPremium(life.insurers);
  var sortedNonLife = sortByPremium(nonlife.insurers);
  renderPlayers(sortedLife.slice(0, 8), sortedNonLife.slice(0, 8));
  renderPenetration();
}

// ─── Render Segment ─────────────────────────────────────────────────
function renderSegment(segment) {
  var segKey = segment === 'life' ? 'life' : 'non_life';
  var latest = getMonthData(segKey, null);
  if (!latest) {
    document.getElementById('tableTitle').textContent = (segment === 'life' ? 'LIFE INSURANCE' : 'NON-LIFE INSURANCE') + ' — UNAVAILABLE';
    document.getElementById('tableMonth').textContent = selectedMonth ? 'No data for ' + selectedMonth : 'No data';
    document.getElementById('tableContainer').innerHTML = '<div style="color:var(--gray2);font-size:9px;padding:20px;text-align:center;">Data unavailable for selected period</div>';
    return;
  }
  var label = segment === 'life' ? 'LIFE INSURANCE' : 'NON-LIFE INSURANCE';

  document.getElementById('tableTitle').textContent = label;
  document.getElementById('tableMonth').textContent = latest.month;

  var enriched = enrichInsurers(latest.insurers, segKey, latest.month);
  var sorted = sortByPremium(enriched);
  buildTable(sorted, ['watch', 'rank', 'name', 'premium', 'share', 'growth', 'share_chg_pp', 'cagr_3m'],
    { watch: { title: '', width: 34 }, rank: { title: '#', width: 30 }, name: { title: 'Company', width: 220 }, premium: { title: 'Premium' }, share: { title: 'Shr%' }, growth: { title: 'YoY%' }, share_chg_pp: { title: 'ShrChg' }, cagr_3m: { title: '3M CAGR' } }
  );

  updateChartData(segKey);
  updateChartHeader(label, fmtCr(latest.total_premium_cr), fmtPct(latest.total_growth_pct), latest.total_growth_pct >= 0);
  updateMetaSegment(latest, segKey);
  renderSegmentInsights(latest, segKey);
}

// ─── Render Compare ────────────────────────────────────────────────
function renderCompare() {
  var pair = getSharedMonthPair(selectedMonth);
  var life = pair.life;
  var nonlife = pair.nonlife;
  if (!life || !nonlife) {
    document.getElementById('tableTitle').textContent = 'LIFE vs NON-LIFE — UNAVAILABLE';
    document.getElementById('tableMonth').textContent = 'No shared month';
    document.getElementById('tableContainer').innerHTML = '<div style="color:var(--gray2);font-size:9px;padding:20px;text-align:center;">Comparable segment data unavailable</div>';
    return;
  }

  document.getElementById('tableTitle').textContent = 'LIFE vs NON-LIFE';
  document.getElementById('tableMonth').textContent = pair.month + ' shared';

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

// ─── Enhanced Insurer Data ─────────────────────────────────────────
function enrichInsurers(insurers, segment, month) {
  if (!insurers || !insurers.length) return insurers;
  var segKey = segment === 'life' ? 'life' : 'non_life';
  var allData = DATA[segKey] ? DATA[segKey].monthly_data : [];
  var currentIdx = -1;
  for (var i = 0; i < allData.length; i++) {
    if (allData[i].month === month) { currentIdx = i; break; }
  }

  var prevData = (currentIdx > 0) ? allData[currentIdx - 1] : null;

  // Build prev month lookup by name
  var prevByName = {};
  if (prevData) {
    prevData.insurers.forEach(function(ins) { prevByName[ins.name] = ins; });
  }

  return insurers.map(function(ins) {
    var r = Object.assign({}, ins);
    // Market share change vs prev month
    if (prevByName[ins.name]) {
      r.share_chg_pp = parseFloat((ins.market_share_pct - prevByName[ins.name].market_share_pct).toFixed(2));
    } else {
      r.share_chg_pp = null;
    }

    // 3-month CAGR if enough data
    if (currentIdx >= 2 && allData[currentIdx - 2]) {
      var older = allData[currentIdx - 2];
      var olderIns = null;
      for (var j = 0; j < older.insurers.length; j++) {
        if (older.insurers[j].name === ins.name) { olderIns = older.insurers[j]; break; }
      }
      if (olderIns && olderIns.premium_cr > 0 && ins.premium_cr > 0) {
        var periods = 3;
        var ratio = ins.premium_cr / olderIns.premium_cr;
        r.cagr_3m = parseFloat(((Math.pow(ratio, 1/periods) - 1) * 100).toFixed(1));
      } else if (olderIns && olderIns.premium_cr === 0 && ins.premium_cr === 0) {
        r.cagr_3m = 0;
      } else if (olderIns && olderIns.premium_cr === 0 && ins.premium_cr > 0) {
        r.cagr_3m = Infinity;
      } else {
        r.cagr_3m = null;
      }
    } else {
      r.cagr_3m = null;
    }

    return r;
  });
}

// ─── Build Table (Tabulator) ────────────────────────────────────────
function buildTable(data, columns, colDefs) {
  var colArr = columns.map(function(key) {
    var def = colDefs[key] || {};
    var formatter = 'plaintext';
    var field = FIELD_MAP[key] || key;

    if (key === 'watch') {
      formatter = function(c) {
        var d = c.getRow().getData();
        var active = isWatched(d.name);
        var title = (active ? 'Remove from watchlist: ' : 'Add to watchlist: ') + d.name;
        return '<button type="button" class="watch-toggle' + (active ? ' active' : '') + '" title="' + escapeHtml(title) + '" aria-label="' + escapeHtml(title) + '">' + (active ? '\u2605' : '\u2606') + '</button>';
      };
    } else if (key === 'rank') {
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
      formatter = function(c) {
        var v = c.getValue();
        if (v === null || v === undefined) return '<span style="color:var(--gray2)">--</span>';
        return '<span style="color:var(--amber);font-variant-numeric:tabular-nums">' + v.toFixed(1) + '%</span>';
      };
    } else if (key === 'growth') {
      formatter = function(c) {
        var v = c.getValue();
        if (v === null || v === undefined) return '<span style="color:var(--gray2)">--</span>';
        var cls = v >= 0 ? 'var(--green)' : 'var(--red)';
        return '<span style="color:' + cls + ';font-variant-numeric:tabular-nums">' + fmtPct(v) + '</span>';
      };
    } else if (key === 'share_chg_pp') {
      formatter = function(c) {
        var v = c.getValue();
        if (v === null || v === undefined) return '<span style="color:var(--gray2)">--</span>';
        var cls = v >= 0 ? 'var(--green)' : 'var(--red)';
        return '<span style="color:' + cls + ';font-variant-numeric:tabular-nums">' + (v >= 0 ? '+' : '') + v.toFixed(2) + 'pp</span>';
      };
    } else if (key === 'cagr_3m') {
      formatter = function(c) {
        var v = c.getValue();
        if (v === null || v === undefined) return '<span style="color:var(--gray2)">--</span>';
        var cls = v >= 0 ? 'var(--green)' : 'var(--red)';
        return '<span style="color:' + cls + ';font-variant-numeric:tabular-nums">' + (v >= 0 ? '+' : '') + v.toFixed(1) + '%</span>';
      };
    }

    var columnDef = {
      title: def.title || key.toUpperCase(),
      field: field,
      width: def.width,
      hozAlign: key === 'watch' ? 'center' : ((key === 'rank' || key === 'name' || key === 'segment' || key === 'seg') ? 'left' : 'right'),
      headerFilter: key === 'name' ? 'input' : false,
      headerFilterPlaceholder: key === 'name' ? 'Search...' : '',
      formatter: formatter,
      sorter: (key === 'name' ? 'string' : (key === 'rank' || key === 'premium' || key === 'share' || key === 'growth' || key === 'share_chg_pp' || key === 'cagr_3m') ? 'number' : 'string'),
    };
    if (key === 'watch') {
      columnDef.headerSort = false;
      columnDef.cellClick = function(e, cell) {
        e.preventDefault();
        e.stopPropagation();
        toggleWatchlist(cell.getRow().getData().name);
      };
    }
    return columnDef;
  });

  var rows = data.map(function(d, i) {
    var r = Object.assign({}, d);
    Object.keys(FIELD_MAP).forEach(function(k) {
      var src = FIELD_MAP[k];
      if (d[src] !== undefined) r[k] = d[src];
    });
    r.rank = i + 1;
    if (d._seg) r.seg = d._seg;
    if (d.seg) r.seg = d.seg;
    r._watched = isWatched(r.name);
    return r;
  });

  table = new Tabulator('#tableContainer', {
    data: rows,
    columns: colArr,
    layout: 'fitDataFill',
    height: '100%',
    rowFormatter: function(row) {
      var d = row.getData();
      if (d._seg === 'Life' || d.seg === 'Life') {
        row.getElement().style.borderLeft = '2px solid rgba(0,204,68,0.3)';
      } else if (d._seg === 'Non-Life' || d.seg === 'Non-Life') {
        row.getElement().style.borderLeft = '2px solid rgba(0,204,255,0.3)';
      }
      row.getElement().classList.toggle('is-watched', isWatched(d.name));
    },
  });

  table.on('rowClick', function(e, row) {
    if (e.target && e.target.closest && e.target.closest('.watch-toggle')) return;
    var d = row.getData();
    var profile = lookupCompany(d.name);
    var html =
      '<div style="display:grid;grid-template-columns:100px 1fr;gap:4px 12px;font-size:10px;">' +
        '<span style="color:var(--gray)">Premium</span><span style="color:var(--white)">' + fmtCr(d.premium_cr) + '</span>' +
        '<span style="color:var(--gray)">Market Share</span><span style="color:var(--amber)">' + (d.market_share_pct != null ? d.market_share_pct.toFixed(1) + '%' : '--') + '</span>' +
        '<span style="color:var(--gray)">Share Chg</span><span style="color:' + (d.share_chg_pp >= 0 ? 'var(--green)' : 'var(--red)') + '">' + (d.share_chg_pp != null ? (d.share_chg_pp >= 0 ? '+' : '') + d.share_chg_pp.toFixed(2) + 'pp' : '<span style="color:var(--gray2)">--</span>') + '</span>' +
        '<span style="color:var(--gray)">3M CAGR</span><span style="color:' + (d.cagr_3m >= 0 ? 'var(--green)' : 'var(--red)') + '">' + (d.cagr_3m != null ? (d.cagr_3m >= 0 ? '+' : '') + d.cagr_3m.toFixed(1) + '%' : '<span style="color:var(--gray2)">--</span>') + '</span>' +
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
  var data, minPoints = 6;
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

  if (data.length < minPoints) {
    showEMA = false;
    chatSay('Need at least <strong>' + minPoints + '</strong> data periods for EMA calculation.', false);
    return;
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
  if (data.length < months) {
    chatSay('Only <strong>' + data.length + '</strong> months available for this period. Showing all.', false);
    return data;
  }
  return data.slice(-months);
}

function updateChart() {
  if (!chart) return;
  chartSeries.forEach(function(s) { chart.removeSeries(s); });
  chartSeries = [];

  if (comparisonMode && comparisonCompanies.length === 2) {
    renderCompanyComparisonChart();
    var caveatEl = document.getElementById('chartCaveat');
    if (caveatEl) caveatEl.textContent = '\u26A0 Individual company premium trends; not adjusted for market growth.';
    return;
  }

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

  // Show data caveat
  var caveatEl = document.getElementById('chartCaveat');
  if (!caveatEl) {
    caveatEl = document.createElement('div');
    caveatEl.id = 'chartCaveat';
    caveatEl.style.cssText = 'font-size:7px;color:var(--gray2);text-align:center;padding:1px 0;letter-spacing:0.5px;';
    var chartControls = document.querySelector('.chart-controls');
    if (chartControls && chartControls.parentNode) chartControls.parentNode.insertBefore(caveatEl, chartControls.nextSibling);
  }
  caveatEl.textContent = '\u26A0 Cumulative YTD series reset at fiscal-year boundaries; compare shared months only.';
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
    '<span>Life <span>' + fmtCr(life.total_premium_cr) + '</span></span>' +
    '<span>Non-Life <span>' + fmtCr(nonlife.total_premium_cr) + '</span></span>' +
    '<span>Life YoY <span class="' + (life.total_growth_pct >= 0 ? 'up' : 'dn') + '">' + fmtPct(life.total_growth_pct) + '</span></span>' +
    '<span>Non-Life YoY <span class="' + (nonlife.total_growth_pct >= 0 ? 'up' : 'dn') + '">' + fmtPct(nonlife.total_growth_pct) + '</span></span>';
}

function updateMetaSegment(latest, segment) {
  var color = segment === 'life' ? 'var(--green)' : 'var(--cyan)';
  var top = sortByPremium(latest.insurers)[0];
  var topShare = top ? top.market_share_pct.toFixed(1) + '%' : '--';
  document.getElementById('chartMeta').innerHTML =
    '<span>Total <span style="color:' + color + '">' + fmtCr(latest.total_premium_cr) + '</span></span>' +
    '<span>YoY <span class="' + (latest.total_growth_pct >= 0 ? 'up' : 'dn') + '">' + fmtPct(latest.total_growth_pct) + '</span></span>' +
    '<span>Players <span>' + latest.insurers.length + '</span></span>' +
    '<span>Top Share <span>' + topShare + '</span></span>';
}

// ─── Brief Tab ──────────────────────────────────────────────────────
var BRIEF_RENDERED = false;
function generateBrief() {
  if (!DATA) return 'No data available.';
  var scope = getActiveAnalysisScope();
  if (!scope.segments.length) return 'No data available.';
  var totalCr = scope.segments.reduce(function(sum, segment) { return sum + segment.total_premium_cr; }, 0) / 1000;
  var line = function(t) { return '<div style="color:var(--gray2);font-size:9px;margin:1px 0;">' + t + '</div>'; };
  var heading = function(t) { return '<div style="color:var(--amber);font-size:9px;font-weight:600;letter-spacing:1px;text-transform:uppercase;margin:6px 0 2px;">' + t + '</div>'; };
  var strong = function(t) { return '<strong style="color:var(--white)">' + t + '</strong>'; };
  var fmt = function(v) { return (v >= 0 ? '+' : '') + v.toFixed(1) + '%'; };
  var html = heading(scope.label + ' Brief');
  html += line('Period: ' + strong(scope.period));
  html += line('Total Premium: ' + strong('\u20B9' + totalCr.toFixed(1) + 'K Cr'));
  scope.segments.forEach(function(segment) {
    html += line(segment.label + ' Premium: ' + strong('\u20B9' + (segment.total_premium_cr/1000).toFixed(1) + 'K Cr') + ' | YoY: ' + fmt(segment.total_growth_pct));
  });
  html += line('Penetration: ' + strong((DATA.summary.insurance_penetration_pct || 0) + '%') + ' of GDP | Global avg: ' + strong((DATA.summary.global_penetration_avg_pct || 0) + '%'));
  scope.segments.forEach(function(segment) {
    html += heading('Top ' + segment.label + ' Insurers');
    sortByPremium(segment.insurers).slice(0, 5).forEach(function(i, idx) {
      html += line((idx + 1) + '. ' + strong(i.name) + ': \u20B9' + (i.premium_cr/1000).toFixed(1) + 'K Cr (' + i.market_share_pct.toFixed(1) + '% share, ' + fmt(i.yoy_growth_pct) + ' YoY)');
    });
  });
  html += '<div style="color:var(--gray);font-size:7px;margin-top:6px;border-top:1px solid var(--border);padding-top:3px;">Generated from source snapshot ' + ((DATA._meta && DATA._meta.research_as_of) || '--') + '. Validation: ' + ((DATA._meta && DATA._meta.validation && DATA._meta.validation.status) || 'unvalidated') + '.</div>';
  return html;
}
function renderBrief() {
  var el = document.getElementById('brief-tab');
  if (!el) return;
  el.innerHTML = '<p style="margin:0;color:var(--gray2);font-size:9px;">' + generateBrief() + '</p>';
}

// ─── HHI / Concentration Tab ────────────────────────────────────────
function renderHHI() {
  var scope = getActiveAnalysisScope();
  var tabKey = currentView + '-' + scope.period + '-hhi';
  if (renderedTabs[tabKey]) return;
  renderedTabs[tabKey] = true;
  if (!scope.segments.length) {
    document.getElementById('hhiContainer').innerHTML = '<div style="color:var(--gray2);font-size:9px;padding:10px;">No concentration data available.</div>';
    return;
  }

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

  function topContributors(insurers, n) {
    return sortByPremium(insurers).sort(function(a, b) {
      return b.market_share_pct - a.market_share_pct;
    }).slice(0, n);
  }

  var html = '<div class="section-label">' + scope.label.toUpperCase() + ' · ' + scope.period + '</div><div class="insight-grid">';
  scope.segments.forEach(function(segment) {
    var hhi = calcHHI(segment.insurers);
    var level = getConcentrationLevel(hhi);
    var maxHHI = 3000;
    var barPct = Math.min(100, (hhi / maxHHI) * 100);
    html += '<div class="insight-card">' +
      '<div class="label">' + segment.label.toUpperCase() + ' HHI</div>' +
      '<div class="value" style="color:' + level.color + '">' + hhi.toFixed(1) + '</div>' +
      '<div style="margin-top:4px;"><div class="bar-container"><div class="bar-fill" style="width:' + barPct + '%;background:' + level.color + '"></div><span style="font-size:7px;color:var(--gray2);flex-shrink:0;">' + barPct.toFixed(0) + '%</span></div></div>' +
      '<div class="desc">' + level.label + '</div>' +
    '</div>';
  });
  html += '</div>' +
    '<div style="margin-bottom:4px;font-size:7px;color:var(--gray2);letter-spacing:0.5px;">Herfindahl-Hirschman Index = sum of squared market shares. &lt;1500 = competitive, 1500-2500 = moderate, &gt;2500 = concentrated.</div>';

  scope.segments.forEach(function(segment) {
    html += '<div class="section-label">TOP CONTRIBUTORS TO ' + segment.label.toUpperCase() + ' CONCENTRATION</div>';
    topContributors(segment.insurers, 5).forEach(function(i, idx) {
      html += '<div class="player-row">' +
        '<span class="player-rank">#' + (idx + 1) + '</span>' +
        '<span class="player-name">' + shortName(i.name) + '</span>' +
        '<span class="player-share" style="color:' + segment.color + '">' + i.market_share_pct.toFixed(1) + '%</span>' +
        '<span style="font-size:8px;color:var(--gray)">' + (i.market_share_pct * i.market_share_pct).toFixed(1) + '</span>' +
      '</div>';
    });
  });

  document.getElementById('hhiContainer').innerHTML = html;
}

// ─── Movers Tab ─────────────────────────────────────────────────────
function renderMovers() {
  var scope = getActiveAnalysisScope();
  var tabKey = currentView + '-' + scope.period + '-movers';
  if (renderedTabs[tabKey]) return;
  renderedTabs[tabKey] = true;
  var all = scope.rows.filter(function(i) {
    return i.yoy_growth_pct !== null && i.yoy_growth_pct !== undefined && Math.abs(i.premium_cr || 0) >= 100;
  });
  var sorted = all.slice().sort(function(a, b) { return b.yoy_growth_pct - a.yoy_growth_pct; });

  var top5 = sorted.slice(0, 5);
  var bottom5 = sorted.slice(-5).reverse();

  var html = '<div class="section-label">' + scope.label.toUpperCase() + ' · ' + scope.period + '</div>' +
    '<div style="font-size:7px;color:var(--gray2);margin-bottom:4px;">Meaningful movers filter: premium base >= \u20B9100 Cr.</div>' +
    '<div class="section-label">TOP 5 — FASTEST GROWING</div>';
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
  var topLife = sortByPremium(life.insurers)[0];
  var topNonLife = sortByPremium(nonlife.insurers)[0];
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
        '<div class="value" style="color:var(--green);font-size:10px;">' + (topLife ? shortName(topLife.name) : '--') + '</div>' +
        '<div class="desc">' + (topLife ? topLife.market_share_pct.toFixed(1) + '% market share' : '--') + '</div>' +
      '</div>' +
      '<div class="insight-card">' +
        '<div class="label">Top Non-Life Player</div>' +
        '<div class="value" style="color:var(--cyan);font-size:10px;">' + (topNonLife ? shortName(topNonLife.name) : '--') + '</div>' +
        '<div class="desc">' + (topNonLife ? topNonLife.market_share_pct.toFixed(1) + '% market share' : '--') + '</div>' +
      '</div>' +
    '</div>' +
    '<div class="insight-card" style="margin-top:4px;">' +
      '<div class="label">Market Penetration Gap</div>' +
      '<div class="value" style="color:var(--purple)">' + (DATA.summary.global_penetration_avg_pct - DATA.summary.insurance_penetration_pct).toFixed(1) + 'pp</div>' +
      '<div class="desc">Below global average of ' + DATA.summary.global_penetration_avg_pct + '%</div>' +
    '</div>' +
    renderWatchlistMonitorHtml() +
    generateOverviewAISummary(life, nonlife, total);
}

function renderSegmentInsights(latest, segment) {
  var color = segment === 'life' ? 'var(--green)' : 'var(--cyan)';
  var sorted = sortByPremium(latest.insurers);
  var total = latest.insurers.reduce(function(s, i) { return s + i.premium_cr; }, 0);
  var top3Share = sorted.slice(0, 3).reduce(function(s, i) { return s + i.market_share_pct; }, 0);
  var top = sorted[0];
  var topName = top ? shortName(top.name) : '--';
  var topShare = top ? top.market_share_pct.toFixed(1) + '% share' : '--';
  var growthLeaders = latest.insurers.filter(function(i) { return i.yoy_growth_pct > 10 && i.premium_cr >= 100; }).length;

  document.getElementById('insights-tab').innerHTML =
    '<div class="insight-card">' +
      '<div class="label">Total ' + segmentDisplayLabel(segment).toUpperCase() + ' Premium</div>' +
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
        '<div class="value" style="color:' + color + ';font-size:10px;">' + topName + '</div>' +
        '<div class="desc">' + topShare + '</div>' +
      '</div>' +
      '<div class="insight-card">' +
        '<div class="label">Growth Leaders</div>' +
        '<div class="value" style="color:var(--green);font-size:9px;">' + growthLeaders + '</div>' +
        '<div class="desc">Growing >10% YoY</div>' +
      '</div>' +
    '</div>' +
    renderWatchlistMonitorHtml() +
    generateSegmentAISummary(latest, segment);
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
    '</div>' +
    renderWatchlistMonitorHtml() +
    generateCompareAISummary(life, nonlife);
}

// ─── Top Players Tab ────────────────────────────────────────────────
function renderPlayers(lifeTop, nonlifeTop) {
  if (!lifeTop) lifeTop = [];
  if (!nonlifeTop) nonlifeTop = [];
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

// ─── Company Comparison ────────────────────────────────────────────
function resolveCompanyName(input) {
  if (!input || !DATA) return null;
  var q = input.trim().toLowerCase();
  var aliases = {
    lic: 'life insurance corporation of india',
    niacl: 'new india assurance',
    newindia: 'new india assurance',
  };
  var dataQuery = aliases[q] || q;
  var allData = [].concat(DATA.life ? DATA.life.monthly_data : [], DATA.non_life ? DATA.non_life.monthly_data : []);
  for (var i = 0; i < allData.length; i++) {
    var insurers = allData[i].insurers || [];
    for (var j = 0; j < insurers.length; j++) {
      var n = insurers[j].name;
      if (n.toLowerCase() === dataQuery || n.toLowerCase().indexOf(dataQuery) !== -1) {
        return { name: n, profile: lookupCompany(n) };
      }
    }
  }
  for (var key in COMPANY_DB) {
    if (key.toLowerCase().indexOf(q) !== -1 || q.indexOf(key.toLowerCase()) !== -1) {
      return { name: key, profile: COMPANY_DB[key] };
    }
  }
  return null;
}

function getCompanyPremiumHistory(name) {
  var history = [];
  ['life', 'non_life'].forEach(function(segKey) {
    (DATA[segKey] ? DATA[segKey].monthly_data : []).forEach(function(m) {
      (m.insurers || []).forEach(function(i) {
        if (i.name === name) {
          history.push({ time: m.month, value: i.premium_cr, segment: segKey });
        }
      });
    });
  });
  history.sort(function(a, b) { return a.time.localeCompare(b.time); });
  return history;
}

function getScopeForCompany(name) {
  var life = getLifeLatest();
  if (life && life.insurers.some(function(i) { return i.name === name; })) {
    return { segment: 'life', month: life.month };
  }
  var nonlife = getNonLifeLatest();
  if (nonlife && nonlife.insurers.some(function(i) { return i.name === name; })) {
    return { segment: 'non_life', month: nonlife.month };
  }
  return { segment: null, month: null };
}

function startCompanyComparison(input1, input2) {
  var r1 = resolveCompanyName(input1);
  var r2 = resolveCompanyName(input2);
  if (!r1) { chatSay('Company not found: <strong>' + escapeHtml(input1) + '</strong>. Try a different name.', false); return; }
  if (!r2) { chatSay('Company not found: <strong>' + escapeHtml(input2) + '</strong>. Try a different name.', false); return; }
  if (r1.name === r2.name) { chatSay('You can\'t compare a company with itself!', false); return; }

  comparisonMode = 'company';
  comparisonCompanies = [r1, r2];
  chatSay('Comparing <strong>' + shortName(r1.name) + '</strong> vs <strong>' + shortName(r2.name) + '</strong>. Check the table and chart! Type <strong>exit</strong> to leave comparison mode.', false);

  if (table) { table.destroy(); table = null; }
  if (emaSeries && chart) { chart.removeSeries(emaSeries); emaSeries = null; }
  showEMA = false;
  if (chart) { chart.remove(); chart = null; chartSeries = []; }
  renderedTabs = {};

  renderCompanyComparison();
}

function exitCompanyComparison() {
  comparisonMode = false;
  comparisonCompanies = [];
  if (table) { table.destroy(); table = null; }
  if (emaSeries && chart) { chart.removeSeries(emaSeries); emaSeries = null; }
  showEMA = false;
  if (chart) { chart.remove(); chart = null; chartSeries = []; }
  renderedTabs = {};
  renderView(currentView);
}

function companyCardHtml(name, data, scope) {
  var color = scope.segment === 'life' ? 'var(--green)' : 'var(--cyan)';
  var profile = lookupCompany(name);
  var stockHtml = '';
  if (profile && profile.ticker) {
    var sp = getStockPrice(profile.ticker);
    if (sp && sp.price) stockHtml = '<div style="margin-top:6px;padding-top:4px;border-top:1px solid var(--border);font-size:9px;display:grid;grid-template-columns:90px 1fr;gap:2px 8px;"><span style="color:var(--gray2)">NSE</span><span style="color:var(--amber)">' + profile.ticker.replace('.NS','') + ' ₹' + sp.price.toFixed(2) + '</span></div>';
  }
  return '<div style="background:var(--bg3);border:1px solid ' + color + ';padding:10px;">' +
    '<div style="color:' + color + ';font-size:11px;font-weight:700;letter-spacing:1px;margin-bottom:6px;">' + shortName(name) + '</div>' +
    '<div style="display:grid;grid-template-columns:90px 1fr;gap:4px 8px;font-size:9px;">' +
      (data ? '' +
        '<span style="color:var(--gray2)">Premium</span><span style="color:var(--white)">' + fmtCr(data.premium_cr) + '</span>' +
        '<span style="color:var(--gray2)">Share</span><span style="color:var(--amber)">' + (data.market_share_pct != null ? data.market_share_pct.toFixed(1) + '%' : '<span style="color:var(--gray2)">--</span>') + '</span>' +
        '<span style="color:var(--gray2)">YoY</span><span style="color:' + (data.yoy_growth_pct >= 0 ? 'var(--green)' : 'var(--red)') + '">' + fmtPct(data.yoy_growth_pct) + '</span>' +
        '<span style="color:var(--gray2)">3M CAGR</span><span style="color:' + (data.cagr_3m >= 0 ? 'var(--green)' : 'var(--red)') + '">' + (data.cagr_3m != null ? fmtPct(data.cagr_3m) : '<span style="color:var(--gray2)">--</span>') + '</span>' +
        '<span style="color:var(--gray2)">Share Chg</span><span style="color:' + (data.share_chg_pp >= 0 ? 'var(--green)' : 'var(--red)') + '">' + (data.share_chg_pp != null ? (data.share_chg_pp >= 0 ? '+' : '') + data.share_chg_pp.toFixed(2) + 'pp' : '<span style="color:var(--gray2)">--</span>') + '</span>' +
        '<span style="color:var(--gray2)">Segment</span><span style="color:' + color + '">' + segmentDisplayLabel(scope.segment) + '</span>'
      : '<span style="color:var(--gray2)">No data for this period</span>') +
    '</div>' + stockHtml +
    (profile && profile.desc ? '<div style="margin-top:6px;font-size:8px;color:var(--gray2);line-height:1.5;">' + profile.desc + '</div>' : '') +
  '</div>';
}

function renderCompanyComparison() {
  if (comparisonCompanies.length !== 2) return;
  var c1 = comparisonCompanies[0];
  var c2 = comparisonCompanies[1];
  var scope1 = getScopeForCompany(c1.name);
  var scope2 = getScopeForCompany(c2.name);

  document.getElementById('tableTitle').textContent = 'COMPARE: ' + shortName(c1.name) + ' vs ' + shortName(c2.name);
  var pair = getSharedMonthPair(selectedMonth);
  document.getElementById('tableMonth').textContent = (pair && pair.month) ? pair.month + ' shared' : '--';

  function getDataForCompany(name, scope, pair) {
    if (!pair) return null;
    var m = scope.segment === 'life' ? pair.life : pair.nonlife;
    if (!m || !m.insurers) return null;
    for (var i = 0; i < m.insurers.length; i++) {
      if (m.insurers[i].name === name) return Object.assign({}, m.insurers[i]);
    }
    return null;
  }

  var d1 = getDataForCompany(c1.name, scope1, pair);
  var d2 = getDataForCompany(c2.name, scope2, pair);
  var enriched1 = d1 ? enrichInsurers([d1], scope1.segment, (pair && pair.month) || '') : null;
  var enriched2 = d2 ? enrichInsurers([d2], scope2.segment, (pair && pair.month) || '') : null;
  var e1 = (enriched1 && enriched1[0]) || d1;
  var e2 = (enriched2 && enriched2[0]) || d2;

  document.getElementById('tableContainer').innerHTML =
    '<div style="display:grid;grid-template-columns:1fr 1fr;gap:6px;padding:8px;">' +
      companyCardHtml(c1.name, e1, scope1) +
      companyCardHtml(c2.name, e2, scope2) +
    '</div>';

  updateChartData('company_compare');
  renderCompanyComparisonInsights(e1, e2, c1, c2, scope1, scope2, pair);
}

function renderCompanyComparisonInsights(d1, d2, c1, c2, scope1, scope2, pair) {
  var monthLabel = (pair && pair.month) ? pair.month : 'latest';
  var html = '<div class="insight-card">' +
    '<div class="label">COMPARISON: ' + shortName(c1.name) + ' vs ' + shortName(c2.name) + '</div>' +
    '<div class="desc" style="font-size:8px;margin-top:2px;color:var(--gray)">Shared month: ' + monthLabel + '</div>' +
  '</div>';

  if (d1 && d2) {
    var diffPremium = d1.premium_cr - d2.premium_cr;
    var diffGrowth = d1.yoy_growth_pct - d2.yoy_growth_pct;
    html += '<div class="insight-grid">' +
      '<div class="insight-card"><div class="label">Premium Gap</div><div class="value" style="color:var(--amber);font-size:11px;">' + fmtCr(Math.abs(diffPremium)) + '</div><div class="desc">' + (diffPremium > 0 ? shortName(c1.name) : shortName(c2.name)) + ' leads</div></div>' +
      '<div class="insight-card"><div class="label">Growth Delta</div><div class="value" style="color:' + (diffGrowth >= 0 ? 'var(--green)' : 'var(--red)') + '">' + fmtPct(diffGrowth) + '</div><div class="desc">YoY advantage</div></div>' +
    '</div>';
    html += '<div class="insight-card" style="margin-top:4px;"><div class="label">Market Position</div><div class="desc" style="font-size:9px;margin-top:2px;">' + shortName(c1.name) + ' (' + (scope1.segment === 'life' ? 'Life' : 'Non-Life') + ') vs ' + shortName(c2.name) + ' (' + (scope2.segment === 'life' ? 'Life' : 'Non-Life') + ')</div></div>';

    if (d1.market_share_pct != null && d2.market_share_pct != null && d2.market_share_pct > 0) {
      var shareRatio = d1.market_share_pct / d2.market_share_pct;
      html += '<div class="insight-card"><div class="label">Share Ratio</div><div class="value" style="color:var(--purple)">' + shareRatio.toFixed(1) + 'x</div><div class="desc">' + shortName(c1.name) + ' is ' + shareRatio.toFixed(1) + 'x larger by share</div></div>';
    }
  } else {
    html += '<div class="insight-card"><div class="label">Data Note</div><div class="desc" style="font-size:8px;color:var(--gray2)">One or both companies lack data for the selected period.</div></div>';
  }

  html += '<div class="insight-card" style="margin-top:4px;"><div class="label">Chart Key</div><div class="desc" style="font-size:8px;margin-top:2px;color:var(--gray2)">Premium trend: ' + shortName(c1.name) + ' (' + (scope1.segment === 'life' ? 'green' : 'cyan') + ' line) vs ' + shortName(c2.name) + ' (amber line). Raw premium over available months.</div></div>';

  html += '<div class="insight-card" style="margin-top:4px;"><div class="label">Exit</div><div class="desc" style="font-size:8px;margin-top:2px;color:var(--gray2)">Type "exit" or press 1-4 to exit comparison mode.</div></div>';

  document.getElementById('insights-tab').innerHTML = html;
}

function renderCompanyComparisonChart() {
  var c1 = comparisonCompanies[0];
  var c2 = comparisonCompanies[1];
  var hist1 = getCompanyPremiumHistory(c1.name);
  var hist2 = getCompanyPremiumHistory(c2.name);
  var scope1 = getScopeForCompany(c1.name);
  var scope2 = getScopeForCompany(c2.name);
  var color1 = scope1.segment === 'life' ? '#00cc44' : '#00ccff';
  var color2 = '#ff9900';

  if (hist1.length) {
    var s1 = chart.addLineSeries({
      color: color1, lineWidth: 2, lastValueVisible: true,
      priceFormat: { type: 'volume' },
    });
    s1.setData(applyPeriod(hist1));
    chartSeries.push(s1);
  }
  if (hist2.length) {
    var s2 = chart.addLineSeries({
      color: color2, lineWidth: 2, lastValueVisible: true,
      priceFormat: { type: 'volume' },
    });
    s2.setData(applyPeriod(hist2));
    chartSeries.push(s2);
  }
  chart.timeScale().fitContent();
}
