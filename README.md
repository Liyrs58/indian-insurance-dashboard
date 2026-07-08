# Indian Insurance Market Dashboard

Bloomberg-terminal-style dashboard for Indian insurance industry data.
Parses IRDAI Flash Figures, Life Council, and GIC source files into ranked
insurer tables, comparable-period views, trend charts, HHI concentration
analysis, and live NSE stock prices for listed insurers.

**Live:** https://liyrs58.github.io/indian-insurance-dashboard/

## What This Demonstrates

| Area | What It Shows |
|------|---------------|
| **Data Engineering** | Python pipeline parses Excel source files → validated JSON with schema enforcement, duplicate detection, period-type labelling, and audit metadata |
| **Frontend Architecture** | Bloomberg-terminal-style grid layout, TradingView LightweightCharts, Tabulator tables, keyboard-driven navigation, responsive down to 500px |
| **Real-Time Integration** | NSE stock prices fetched every hour via GitHub Actions, auto-refreshed in-browser every 5 minutes |
| **Testing & Quality** | 8 contract tests (Node) for data integrity, source quality, label leakage, and interaction fixes — run in CI on every push |
| **CI/CD** | GitHub Actions → GitHub Pages: auto-deploy on push + hourly scheduled stock refresh |

## Preview

```bash
python3 -m http.server 8080
# Open http://localhost:8080
```

## Validation

```bash
npm test
node --check js/dashboard.js
python3 -m py_compile data/parse_irdai.py data/fetch_stocks.py
```

The parser stores source freshness, selected report months, and validation
warnings in `data/irdai-processed.json` under `_meta`. The dashboard shows a
snapshot status with validation tier instead of a live-feed claim.

## Data Pipeline

```bash
python3 -m pip install -r data/requirements.txt
python3 data/parse_irdai.py
python3 data/fetch_stocks.py
```

Headline market totals use the latest shared life/non-life month only. Segment
pages can show newer segment-specific data, such as June 2026 non-life figures,
when a matching life report is not yet available locally.

## Data Sources
- General Insurance Council flash figures
- IRDAI monthly business figures archive
- Life Insurance Council new business performance archive
- IRDAI handbook and public sector statistics
- Yahoo Finance-compatible NSE stock quote endpoints

## Stack
- HTML/CSS market-terminal UI
- [TradingView LightweightCharts](https://tradingview.github.io/lightweight-charts/) — Interactive area/line charts
- [Tabulator](https://tabulator.info/) — Sortable/filterable data tables
- IBM Plex Mono — Monospaced UI font
- Clearbit Logo API — Company logos in detail popups
- Python (parse_irdai.py, fetch_stocks.py) — Data pipeline
- GitHub Actions — Scheduled hourly stock refresh + auto-deploy to GitHub Pages
