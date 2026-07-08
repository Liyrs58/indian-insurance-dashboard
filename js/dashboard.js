Chart.defaults.font.family = "'JetBrains Mono', monospace";
Chart.defaults.color = '#888';

const COLORS = {
  green: '#00ff41',
  amber: '#ffb000',
  cyan: '#40e0d0',
  red: '#ff6b6b',
  purple: '#a29bfe',
  pink: '#fd79a8',
  blue: '#74b9ff',
  mint: '#55efc4',
  gray: '#636e72',
};

function createGradient(ctx, chartArea, color1, color2) {
  const grad = ctx.createLinearGradient(0, chartArea.top, 0, chartArea.bottom);
  grad.addColorStop(0, color1 + '55');
  grad.addColorStop(1, color1 + '05');
  return grad;
}

function fmt(num) {
  if (num >= 1000) return num.toLocaleString('en-IN');
  return num.toString();
}

// Clock
function updateClock() {
  const now = new Date();
  document.getElementById('clock').textContent =
    now.toLocaleTimeString('en-GB', { hour12: false });
}
setInterval(updateClock, 1000);
updateClock();

// Load and render
fetch('data/irdai-data.json')
  .then(r => r.json())
  .then(data => {
    renderKPIs(data);
    renderTicker(data);
    renderPremiumTrend(data);
    renderGrowthRates(data);
    renderGlobalCompare(data);
    renderLifeShare(data);
    renderGeneralShare(data);
    renderKeyPlayers(data);
    renderPlayersTable(data);
  });

function renderKPIs(data) {
  document.getElementById('total-premium').textContent =
    '$' + data.market_overview.total_premium.value + 'B';
  document.getElementById('penetration').textContent =
    data.market_overview.insurance_penetration.value + '%';
  document.getElementById('density').textContent =
    '$' + data.market_overview.insurance_density.value;
  document.getElementById('global-rank').textContent =
    '#' + data.market_overview.global_rank.value;
}

function renderTicker(data) {
  const items = data.key_players_summary.map(p =>
    `<span class="ticker-item">
      <span class="ticker-name">${p.name}</span>
      <span class="ticker-val">${p.market_share}</span>
    </span>`
  );
  const html = items.join('') + items.join('');
  document.getElementById('ticker').innerHTML = html;
}

function renderPremiumTrend(data) {
  const ctx = document.getElementById('premiumTrend').getContext('2d');
  const years = data.premium_trends.map(d => d.year);
  new Chart(ctx, {
    type: 'line',
    data: {
      labels: years,
      datasets: [
        {
          label: 'Life',
          data: data.premium_trends.map(d => d.life_premium),
          borderColor: COLORS.green,
          backgroundColor: ctx => createGradient(ctx.chart.ctx, ctx.chart.chartArea, COLORS.green, COLORS.green),
          fill: true,
          tension: 0.3,
          pointRadius: 2,
        },
        {
          label: 'Non-Life',
          data: data.premium_trends.map(d => d.non_life_premium),
          borderColor: COLORS.amber,
          backgroundColor: ctx => createGradient(ctx.chart.ctx, ctx.chart.chartArea, COLORS.amber, COLORS.amber),
          fill: true,
          tension: 0.3,
          pointRadius: 2,
        },
        {
          label: 'Total',
          data: data.premium_trends.map(d => d.total),
          borderColor: COLORS.cyan,
          borderDash: [4, 3],
          fill: false,
          tension: 0.3,
          pointRadius: 0,
        }
      ]
    },
    options: chartOpts({ scales: { y: { beginAtZero: true } } })
  });
}

function renderGrowthRates(data) {
  const ctx = document.getElementById('growthRates').getContext('2d');
  new Chart(ctx, {
    type: 'bar',
    data: {
      labels: data.growth_rates.map(d => d.year),
      datasets: [
        {
          label: 'Life Growth %',
          data: data.growth_rates.map(d => d.life_growth),
          backgroundColor: COLORS.green + '66',
          borderColor: COLORS.green,
          borderWidth: 1,
        },
        {
          label: 'Non-Life Growth %',
          data: data.growth_rates.map(d => d.non_life_growth),
          backgroundColor: COLORS.amber + '66',
          borderColor: COLORS.amber,
          borderWidth: 1,
        }
      ]
    },
    options: chartOpts({ scales: { y: { beginAtZero: true } } })
  });
}

function renderGlobalCompare(data) {
  const ctx = document.getElementById('globalCompare').getContext('2d');
  const sorted = [...data.insurance_vs_global].sort((a, b) => b.penetration - a.penetration);
  const colors = sorted.map(d => d.country === 'India' ? COLORS.green : COLORS.gray);
  new Chart(ctx, {
    type: 'bar',
    data: {
      labels: sorted.map(d => d.country),
      datasets: [{
        label: 'Penetration (% GDP)',
        data: sorted.map(d => d.penetration),
        backgroundColor: colors.map(c => c + '88'),
        borderColor: colors,
        borderWidth: 1,
      }]
    },
    options: chartOpts({ indexAxis: 'y', scales: { x: { beginAtZero: true } } })
  });
}

function renderLifeShare(data) {
  const ctx = document.getElementById('lifeShare').getContext('2d');
  const items = data.market_share_life;
  new Chart(ctx, {
    type: 'doughnut',
    data: {
      labels: items.map(d => d.company),
      datasets: [{
        data: items.map(d => d.share),
        backgroundColor: items.map(d => d.color),
        borderWidth: 0,
      }]
    },
    options: {
      responsive: true,
      maintainAspectRatio: false,
      plugins: {
        legend: { display: false },
        tooltip: {
          backgroundColor: '#1a1a1a',
          titleColor: '#fff',
          bodyColor: '#ccc',
          borderColor: '#333',
          borderWidth: 1,
          callbacks: {
            label: ctx => ` ${ctx.label}: ${ctx.raw}%`
          }
        }
      },
      cutout: '60%',
    }
  });
  renderLegend('lifeLegend', items);
}

function renderGeneralShare(data) {
  const ctx = document.getElementById('generalShare').getContext('2d');
  const items = data.market_share_general;
  new Chart(ctx, {
    type: 'doughnut',
    data: {
      labels: items.map(d => d.company),
      datasets: [{
        data: items.map(d => d.share),
        backgroundColor: items.map(d => d.color),
        borderWidth: 0,
      }]
    },
    options: {
      responsive: true,
      maintainAspectRatio: false,
      plugins: {
        legend: { display: false },
        tooltip: {
          backgroundColor: '#1a1a1a',
          titleColor: '#fff',
          bodyColor: '#ccc',
          borderColor: '#333',
          borderWidth: 1,
          callbacks: {
            label: ctx => ` ${ctx.label}: ${ctx.raw}%`
          }
        }
      },
      cutout: '60%',
    }
  });
  renderLegend('generalLegend', items);
}

function renderLegend(id, items) {
  const el = document.getElementById(id);
  el.innerHTML = items.map(d =>
    `<span class="legend-item">
      <span class="legend-dot" style="background:${d.color}"></span>
      ${d.company}
    </span>`
  ).join('');
}

function renderKeyPlayers(data) {
  const ctx = document.getElementById('keyPlayers').getContext('2d');
  const sorted = [...data.key_players_summary].sort((a, b) =>
    parseInt(b.premium_income.replace(/,/g, '')) - parseInt(a.premium_income.replace(/,/g, ''))
  );
  const colors = sorted.map(d => d.type === 'Life' ? COLORS.green : COLORS.amber);
  new Chart(ctx, {
    type: 'bar',
    data: {
      labels: sorted.map(d => d.name),
      datasets: [{
        label: 'Premium Income (Cr INR)',
        data: sorted.map(d => parseInt(d.premium_income.replace(/,/g, ''))),
        backgroundColor: colors.map(c => c + '77'),
        borderColor: colors,
        borderWidth: 1,
      }]
    },
    options: chartOpts({ indexAxis: 'y', scales: { x: { beginAtZero: true } } })
  });
}

function renderPlayersTable(data) {
  const tbody = document.querySelector('#players-table tbody');
  tbody.innerHTML = data.key_players_summary.map(p =>
    `<tr>
      <td class="highlight">${p.name}</td>
      <td>${p.type}</td>
      <td>${p.founded}</td>
      <td>${p.market_cap}</td>
      <td>${p.premium_income}</td>
      <td>${p.market_share}</td>
    </tr>`
  ).join('');
}

// Shared chart options
function chartOpts(extra = {}) {
  const base = {
    responsive: true,
    maintainAspectRatio: false,
    plugins: {
      legend: {
        labels: {
          color: '#666',
          font: { size: 10 },
          boxWidth: 10,
          padding: 8,
        }
      },
      tooltip: {
        backgroundColor: '#1a1a1a',
        titleColor: '#fff',
        bodyColor: '#ccc',
        borderColor: '#333',
        borderWidth: 1,
      }
    },
    scales: {
      x: {
        grid: { color: '#1a1a1a', drawBorder: false },
        ticks: { color: '#555', font: { size: 10 } },
      },
      y: {
        grid: { color: '#1a1a1a', drawBorder: false },
        ticks: { color: '#555', font: { size: 10 } },
      }
    },
  };

  for (const key in extra) {
    base[key] = { ...base[key], ...extra[key] };
  }
  return base;
}
