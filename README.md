# Indian Insurance Market Dashboard

Market-terminal-inspired dashboard for Indian insurance industry data.
It parses local IRDAI/Life Council/GIC source files, renders ranked insurer
tables, comparable period views, trend charts, concentration analysis, and NSE
stock-price context for listed insurers.

**Live:** https://liyrs58.github.io/indian-insurance-dashboard/

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
snapshot status instead of a live-feed claim.

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
- GitHub Actions — Auto-deploy to GitHub Pages
